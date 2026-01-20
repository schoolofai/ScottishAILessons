#!/usr/bin/env python3
"""Batch Lesson Generator for Lesson Author Agent.

Generates lesson templates for all SOW entries in a course with:
- Dry-run preview mode
- Smart skip logic (avoid regenerating existing lessons)
- Force mode (overwrite all lessons)
- Full observability (per-lesson execution logs)
- Batch metrics summary

Usage:
    python -m src.batch_lesson_generator --courseId course_c84874

Design principle: No fallback patterns - fast fail with detailed error logging.
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import time

from .lesson_author_claude_client import LessonAuthorClaudeAgent
from .utils.batch_utils import (
    fetch_sow_entries,
    check_existing_lessons,
    format_dry_run_table,
    calculate_estimates,
    format_duration,
    format_batch_summary_console,
    # Delete mode utilities
    fetch_lessons_for_deletion,
    fetch_diagrams_for_lesson_ids,
    format_delete_dry_run_table,
    format_delete_summary_console
)
from .utils.diagram_cleanup import delete_diagrams_for_lesson_ids
from .utils.appwrite_mcp import delete_appwrite_document

# Setup module logger
logger = logging.getLogger(__name__)


def setup_batch_logging(
    batch_id: str,
    courseId: str,
    log_level: str = "INFO"
) -> Tuple[Path, logging.Logger]:
    """Create batch log directory and setup batch logger.

    Args:
        batch_id: Batch identifier
        courseId: Course identifier
        log_level: Logging level string

    Returns:
        (log_dir_path, batch_logger)

    Side Effects:
        - Creates logs/batch_runs/{batch_id}/
        - Creates batch_execution.log file
    """
    # Create log directory
    script_dir = Path(__file__).parent.parent  # claud_author_agent/
    log_dir = script_dir / "logs" / "batch_runs" / batch_id
    log_dir.mkdir(parents=True, exist_ok=True)

    # Create batch logger
    batch_logger = logging.getLogger(f"batch.{batch_id}")
    batch_logger.setLevel(getattr(logging, log_level.upper()))

    # File handler for batch_execution.log
    batch_log_file = log_dir / "batch_execution.log"
    file_handler = logging.FileHandler(batch_log_file, mode='w', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)

    batch_logger.addHandler(file_handler)

    # Also log to console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))
    console_handler.setFormatter(formatter)
    batch_logger.addHandler(console_handler)

    return log_dir, batch_logger


def setup_lesson_logging(
    log_file_path: Path,
    log_level: str
) -> logging.FileHandler:
    """Setup per-lesson log file handler.

    Args:
        log_file_path: Path to lesson log file
        log_level: Logging level string

    Returns:
        FileHandler instance (must be removed after use)

    Side Effects:
        - Creates log file
        - Adds handler to root logger
    """
    file_handler = logging.FileHandler(log_file_path, mode='w', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)  # Capture everything

    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)

    # Add to root logger to capture ALL logs from all modules
    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)

    return file_handler


def write_batch_summary(
    log_dir: Path,
    summary_data: Dict[str, Any]
):
    """Write batch_summary.json to log directory.

    Args:
        log_dir: Log directory path
        summary_data: Summary dictionary

    Side Effects:
        - Writes batch_summary.json
    """
    summary_file = log_dir / "batch_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary_data, f, indent=2)


async def perform_dry_run(
    courseId: str,
    force_mode: bool,
    batch_id: str,
    log_dir: Path,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Execute dry-run analysis and output plan.

    Args:
        courseId: Course identifier
        force_mode: Whether --force is set
        batch_id: Batch identifier
        log_dir: Log directory path
        mcp_config_path: Path to MCP config

    Returns:
        Plan dictionary with skip/generate/overwrite lists

    Side Effects:
        - Prints console table
        - Writes dry_run_plan.json
    """
    # Fetch SOW entries
    sow_entries = await fetch_sow_entries(courseId, mcp_config_path)

    # Check existing lessons
    existing_lessons = await check_existing_lessons(courseId, mcp_config_path)

    # Classify each entry
    skip_list = []
    generate_list = []
    overwrite_list = []

    for entry in sow_entries:
        order = entry.get('order', 0)
        label = entry.get('label', 'Untitled')

        existing = existing_lessons.get(order)
        is_claud_sdk = existing and existing.get('model_version') == 'claud_Agent_sdk'

        if force_mode:
            if existing:
                overwrite_list.append({
                    "order": order,
                    "label": label,
                    "reason": "force_mode",
                    "existing_doc_id": existing.get('doc_id')
                })
            else:
                generate_list.append({
                    "order": order,
                    "label": label,
                    "reason": "not_found"
                })
        else:
            if is_claud_sdk:
                skip_list.append({
                    "order": order,
                    "label": label,
                    "reason": "already_exists",
                    "doc_id": existing.get('doc_id'),
                    "model_version": existing.get('model_version'),
                    "created_at": existing.get('created_at')
                })
            else:
                # existing can only be None here since check_existing_lessons()
                # filters by model_version == "claud_Agent_sdk" at query level
                generate_list.append({
                    "order": order,
                    "label": label,
                    "reason": "not_found"
                })

    # Calculate estimates
    num_to_generate = len(generate_list) + len(overwrite_list)
    estimates = calculate_estimates(num_to_generate)

    # Format console table
    table, skip_count, generate_count, overwrite_count = format_dry_run_table(
        sow_entries, existing_lessons, force_mode
    )

    # Print console output
    print()
    print(table)
    print()
    print(f"Course ID: {courseId}")
    print(f"Total SOW Entries: {len(sow_entries)}")
    print(f"Force Mode: {'Yes' if force_mode else 'No'}")
    print()
    print("Summary:")
    print(f"  Will skip (already exist):  {skip_count} lessons")
    print(f"  Will generate (new):        {generate_count} lessons")
    print(f"  Will overwrite:             {overwrite_count} lessons")
    print()
    print(f"Estimated Duration: ~{estimates['duration_minutes']} minutes ({estimates['avg_duration_per_lesson_minutes']} min/lesson average)")
    print(f"Estimated Cost: ~${estimates['cost_usd']:.2f} USD (${estimates['avg_cost_per_lesson_usd']:.2f}/lesson average)")
    print()

    # Build plan dict
    plan = {
        "batch_id": batch_id,
        "courseId": courseId,
        "dry_run": True,
        "timestamp": datetime.now().isoformat(),
        "total_sow_entries": len(sow_entries),
        "plan": {
            "skip": skip_list,
            "generate": generate_list,
            "overwrite": overwrite_list
        },
        "summary": {
            "will_skip": skip_count,
            "will_generate": generate_count,
            "will_overwrite": overwrite_count
        },
        "estimates": estimates
    }

    # Write dry_run_plan.json
    plan_file = log_dir / "dry_run_plan.json"
    with open(plan_file, 'w', encoding='utf-8') as f:
        json.dump(plan, f, indent=2)

    print(f"✓ Dry-run plan saved to: {plan_file}")
    print()
    print("No lessons were generated (dry-run mode).")
    print()

    return plan


async def generate_single_lesson(
    courseId: str,
    order: int,
    label: str,
    log_file_path: Path,
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate a single lesson with full log capture.

    Args:
        courseId: Course identifier
        order: Lesson order
        label: Lesson label (for logging)
        log_file_path: Where to write per-lesson log
        config: Configuration dict

    Returns:
        Result dict: {success, doc_id, duration_seconds, cost_usd, tokens, error}

    Side Effects:
        - Writes complete agent execution to log_file_path
        - Creates/updates lesson in Appwrite
    """
    start_time = time.time()

    # Setup lesson-specific logging
    file_handler = setup_lesson_logging(log_file_path, config.get('log_level', 'INFO'))

    try:
        # Initialize agent
        agent = LessonAuthorClaudeAgent(
            mcp_config_path=config.get('mcp_config_path', '.mcp.json'),
            persist_workspace=config.get('persist_workspace', True),
            max_critic_retries=config.get('max_retries', 10),
            log_level=config.get('log_level', 'INFO')
        )

        # Execute agent
        result = await agent.execute(courseId=courseId, order=order)

        # Calculate duration
        duration_seconds = int(time.time() - start_time)

        # Extract metrics
        if result.get('success'):
            return {
                "success": True,
                "doc_id": result.get('appwrite_document_id'),
                "duration_seconds": duration_seconds,
                "cost_usd": result.get('metrics', {}).get('total_cost_usd', 0.0),
                "tokens": result.get('metrics', {}).get('total_tokens', 0)
            }
        else:
            return {
                "success": False,
                "error": result.get('error', 'Unknown error'),
                "duration_seconds": duration_seconds,
                "cost_usd": result.get('metrics', {}).get('total_cost_usd', 0.0),
                "tokens": result.get('metrics', {}).get('total_tokens', 0)
            }

    except Exception as e:
        duration_seconds = int(time.time() - start_time)
        return {
            "success": False,
            "error": str(e),
            "duration_seconds": duration_seconds,
            "cost_usd": 0.0,
            "tokens": 0
        }
    finally:
        # Cleanup logging - remove handler to avoid log mixing
        root_logger = logging.getLogger()
        root_logger.removeHandler(file_handler)
        file_handler.close()


async def execute_batch_generation(
    courseId: str,
    force_mode: bool,
    batch_id: str,
    log_dir: Path,
    batch_logger: logging.Logger,
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute batch lesson generation with progress tracking.

    Args:
        courseId: Course identifier
        force_mode: Whether to overwrite existing lessons
        batch_id: Batch identifier
        log_dir: Log directory path
        batch_logger: Logger for batch orchestration
        config: Configuration dict

    Returns:
        Summary dictionary with results for each lesson

    Side Effects:
        - Generates lessons via LessonAuthorClaudeAgent
        - Writes per-lesson log files
        - Updates batch_execution.log
        - Writes batch_summary.json at end
    """
    start_time = time.time()

    # Fetch SOW entries
    sow_entries = await fetch_sow_entries(courseId, config['mcp_config_path'])

    # Check existing lessons
    existing_lessons = await check_existing_lessons(courseId, config['mcp_config_path'])

    # Log plan
    batch_logger.info("═" * 70)
    batch_logger.info("Batch Lesson Generation Starting")
    batch_logger.info("═" * 70)
    batch_logger.info(f"Batch ID: {batch_id}")
    batch_logger.info(f"Course ID: {courseId}")
    batch_logger.info(f"Force Mode: {'Yes' if force_mode else 'No'}")
    batch_logger.info(f"Dry Run: No")
    batch_logger.info(f"MCP Config: {config['mcp_config_path']}")
    batch_logger.info(f"Max Retries: {config['max_retries']}")
    batch_logger.info(f"Log Directory: {log_dir}/")
    batch_logger.info("─" * 70)

    batch_logger.info(f"Found {len(sow_entries)} SOW entries for course '{courseId}'")
    batch_logger.info(f"Found {len(existing_lessons)} existing lessons")

    # Determine what to do with each entry
    skip_count = 0
    generate_count = 0

    for entry in sow_entries:
        order = entry.get('order', 0)
        existing = existing_lessons.get(order)
        is_claud_sdk = existing and existing.get('model_version') == 'claud_Agent_sdk'

        if not force_mode and is_claud_sdk:
            skip_count += 1
        else:
            generate_count += 1

    batch_logger.info(f"Generation Plan: Skip {skip_count}, Generate {generate_count}")
    batch_logger.info("─" * 70)
    batch_logger.info(f"Processing {len(sow_entries)} SOW entries...")
    batch_logger.info("─" * 70)

    # Process each entry
    results = []
    skipped = 0
    generated_success = 0
    failed = 0
    total_cost = 0.0
    total_tokens = 0

    for idx, entry in enumerate(sow_entries, 1):
        order = entry.get('order', 0)
        label = entry.get('label', 'Untitled')

        existing = existing_lessons.get(order)
        is_claud_sdk = existing and existing.get('model_version') == 'claud_Agent_sdk'

        # Decide: skip or generate
        if not force_mode and is_claud_sdk:
            # SKIP
            batch_logger.info(f"[{idx}/{len(sow_entries)}] Order {order} ({label}): SKIP - Already exists (doc: {existing.get('doc_id')})")
            results.append({
                "order": order,
                "label": label,
                "status": "skipped",
                "existing_doc_id": existing.get('doc_id'),
                "log_file": None
            })
            skipped += 1
        else:
            # GENERATE
            batch_logger.info("─" * 70)
            batch_logger.info(f"[{idx}/{len(sow_entries)}] Order {order} ({label}): GENERATING")

            log_file_name = f"lesson_order_{order:03d}.log"
            log_file_path = log_dir / log_file_name
            batch_logger.info(f"Log file: {log_file_name}")

            # Generate lesson
            result = await generate_single_lesson(
                courseId=courseId,
                order=order,
                label=label,
                log_file_path=log_file_path,
                config=config
            )

            # Log result
            if result['success']:
                batch_logger.info(f"[{idx}/{len(sow_entries)}] Order {order} - ✅ SUCCESS")
                batch_logger.info(f"  Document ID: {result['doc_id']}")
                batch_logger.info(f"  Duration: {format_duration(result['duration_seconds'])}")
                batch_logger.info(f"  Cost: ${result['cost_usd']:.4f} USD")
                batch_logger.info(f"  Tokens: {result['tokens']}")

                results.append({
                    "order": order,
                    "label": label,
                    "status": "success",
                    "doc_id": result['doc_id'],
                    "duration_seconds": result['duration_seconds'],
                    "cost_usd": result['cost_usd'],
                    "tokens": result['tokens'],
                    "log_file": log_file_name
                })
                generated_success += 1
                total_cost += result['cost_usd']
                total_tokens += result['tokens']
            else:
                batch_logger.error(f"[{idx}/{len(sow_entries)}] Order {order} - ❌ FAILED")
                batch_logger.error(f"  Error: {result['error']}")
                batch_logger.error(f"  Duration: {format_duration(result['duration_seconds'])}")
                batch_logger.error(f"  Partial Cost: ${result['cost_usd']:.4f} USD")
                batch_logger.error(f"  Partial Tokens: {result['tokens']}")

                results.append({
                    "order": order,
                    "label": label,
                    "status": "failed",
                    "error": f"{result['error']} (see {log_file_name} for full trace)",
                    "duration_seconds": result['duration_seconds'],
                    "cost_usd": result['cost_usd'],
                    "tokens": result['tokens'],
                    "log_file": log_file_name
                })
                failed += 1
                total_cost += result['cost_usd']
                total_tokens += result['tokens']

    # Calculate totals
    end_time = time.time()
    total_duration_seconds = int(end_time - start_time)

    # Calculate averages (only for generated lessons)
    avg_cost_per_lesson = total_cost / generated_success if generated_success > 0 else 0.0
    avg_duration_per_lesson = total_duration_seconds // generated_success if generated_success > 0 else 0

    # Build summary
    summary = {
        "batch_id": batch_id,
        "courseId": courseId,
        "start_time": datetime.fromtimestamp(start_time).isoformat(),
        "end_time": datetime.fromtimestamp(end_time).isoformat(),
        "duration_seconds": total_duration_seconds,
        "duration_human": format_duration(total_duration_seconds),
        "force_mode": force_mode,
        "dry_run": False,
        "total_sow_entries": len(sow_entries),
        "skipped": skipped,
        "generated": generated_success,
        "failed": failed,
        "results": results,
        "total_cost_usd": round(total_cost, 4),
        "total_tokens": total_tokens,
        "avg_cost_per_lesson_usd": round(avg_cost_per_lesson, 4),
        "avg_duration_per_lesson_seconds": avg_duration_per_lesson,
        "log_directory": str(log_dir.absolute())
    }

    # Log summary
    batch_logger.info("═" * 70)
    batch_logger.info("Batch Generation Complete")
    batch_logger.info("═" * 70)
    batch_logger.info("Summary:")
    batch_logger.info(f"  Total SOW entries: {len(sow_entries)}")
    batch_logger.info(f"  Skipped: {skipped}")
    batch_logger.info(f"  Generated (success): {generated_success}")
    batch_logger.info(f"  Failed: {failed}")
    batch_logger.info(f"  Total Duration: {format_duration(total_duration_seconds)}")
    batch_logger.info(f"  Total Cost: ${total_cost:.4f} USD")
    batch_logger.info(f"  Total Tokens: {total_tokens}")
    if generated_success > 0:
        batch_logger.info(f"  Average per lesson: {format_duration(avg_duration_per_lesson)}, ${avg_cost_per_lesson:.4f} USD")
    batch_logger.info("Summary saved to: batch_summary.json")
    batch_logger.info(f"Log directory: {log_dir}/")

    # Write batch_summary.json
    write_batch_summary(log_dir, summary)

    return summary


# =============================================================================
# DELETE MODE FUNCTIONS
# =============================================================================

async def perform_delete_dry_run(
    courseId: str,
    all_versions: bool,
    batch_id: str,
    log_dir: Path,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Execute delete dry-run analysis and output plan.

    Args:
        courseId: Course identifier
        all_versions: Whether to delete all versions or just claud_Agent_sdk
        batch_id: Batch identifier
        log_dir: Log directory path
        mcp_config_path: Path to MCP config

    Returns:
        Plan dictionary with lessons and diagrams to delete

    Raises:
        ValueError: If no lessons found for the course
    """
    # Fetch lessons to delete
    lessons = await fetch_lessons_for_deletion(
        courseId=courseId,
        mcp_config_path=mcp_config_path,
        all_versions=all_versions
    )

    if not lessons:
        raise ValueError(
            f"No lessons found for courseId='{courseId}' "
            f"{'(all versions)' if all_versions else 'with model_version=claud_Agent_sdk'}. "
            f"Nothing to delete."
        )

    # Fetch diagrams for these lessons
    lesson_ids = [lesson.get('$id') for lesson in lessons]
    diagrams = await fetch_diagrams_for_lesson_ids(
        lesson_template_ids=lesson_ids,
        mcp_config_path=mcp_config_path
    )

    # Format console table
    table = format_delete_dry_run_table(lessons, diagrams, all_versions)

    # Print console output
    print()
    print(table)
    print()
    print(f"Course ID: {courseId}")
    print()
    print("⚠️  This is a DRY RUN - no data will be deleted.")
    print()
    print("To execute deletion:")
    print(f"  python -m src.batch_lesson_generator --courseId {courseId} --delete")
    print()

    # Build plan dict
    plan = {
        "batch_id": batch_id,
        "courseId": courseId,
        "dry_run": True,
        "delete_mode": True,
        "all_versions": all_versions,
        "timestamp": datetime.now().isoformat(),
        "lessons_to_delete": [
            {
                "doc_id": l.get('$id'),
                "sow_order": l.get('sow_order'),
                "title": l.get('title'),
                "model_version": l.get('model_version')
            }
            for l in lessons
        ],
        "diagrams_to_delete": [
            {
                "doc_id": d.get('$id'),
                "lessonTemplateId": d.get('lessonTemplateId'),
                "cardId": d.get('cardId'),
                "image_file_id": d.get('image_file_id')
            }
            for d in diagrams
        ],
        "summary": {
            "total_lessons": len(lessons),
            "total_diagrams": len(diagrams),
            "total_storage_files": sum(1 for d in diagrams if d.get('image_file_id'))
        }
    }

    # Write dry_run_delete_plan.json
    plan_file = log_dir / "dry_run_delete_plan.json"
    with open(plan_file, 'w', encoding='utf-8') as f:
        json.dump(plan, f, indent=2)

    print(f"✓ Dry-run delete plan saved to: {plan_file}")
    print()

    return plan


async def execute_batch_deletion(
    courseId: str,
    all_versions: bool,
    batch_id: str,
    log_dir: Path,
    batch_logger: logging.Logger,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Execute batch deletion of lessons and diagrams.

    Follows referential integrity: deletes diagrams (children) before lessons (parents).

    Args:
        courseId: Course identifier
        all_versions: Whether to delete all versions or just claud_Agent_sdk
        batch_id: Batch identifier
        log_dir: Log directory path
        batch_logger: Logger for batch orchestration
        mcp_config_path: Path to MCP config

    Returns:
        Summary dictionary with deletion results

    Raises:
        ValueError: If no lessons found
        Exception: On database delete failure (fast-fail)
    """
    start_time = time.time()

    # Log header
    batch_logger.info("═" * 70)
    batch_logger.info("🗑️  Batch Deletion Starting")
    batch_logger.info("═" * 70)
    batch_logger.info(f"Batch ID: {batch_id}")
    batch_logger.info(f"Course ID: {courseId}")
    batch_logger.info(f"All Versions: {'Yes' if all_versions else 'No (claud_Agent_sdk only)'}")
    batch_logger.info(f"Log Directory: {log_dir}/")
    batch_logger.info("─" * 70)

    # Phase 1: Discovery
    batch_logger.info("Phase 1: Discovery - fetching lessons and diagrams...")

    lessons = await fetch_lessons_for_deletion(
        courseId=courseId,
        mcp_config_path=mcp_config_path,
        all_versions=all_versions
    )

    if not lessons:
        raise ValueError(
            f"No lessons found for courseId='{courseId}' "
            f"{'(all versions)' if all_versions else 'with model_version=claud_Agent_sdk'}. "
            f"Nothing to delete."
        )

    lesson_ids = [lesson.get('$id') for lesson in lessons]
    diagrams = await fetch_diagrams_for_lesson_ids(
        lesson_template_ids=lesson_ids,
        mcp_config_path=mcp_config_path
    )

    batch_logger.info(f"Found {len(lessons)} lessons, {len(diagrams)} diagrams")
    batch_logger.info("─" * 70)

    # Phase 2: Delete diagrams (children first)
    batch_logger.info("Phase 2: Deleting diagrams (children first for referential integrity)...")

    diagram_result = await delete_diagrams_for_lesson_ids(
        diagrams=diagrams,
        mcp_config_path=mcp_config_path,
        batch_logger=batch_logger
    )

    batch_logger.info("─" * 70)

    # Phase 3: Delete lessons (parents)
    batch_logger.info("Phase 3: Deleting lesson templates...")

    deleted_lessons = 0
    for idx, lesson in enumerate(lessons, 1):
        lesson_id = lesson.get('$id')
        sow_order = lesson.get('sow_order', 0)
        title = lesson.get('title', 'Untitled')

        batch_logger.info(f"  [{idx}/{len(lessons)}] Deleting lesson {lesson_id} (order: {sow_order}, title: {title})")

        try:
            await delete_appwrite_document(
                database_id="default",
                collection_id="lesson_templates",
                document_id=lesson_id,
                mcp_config_path=mcp_config_path
            )
            deleted_lessons += 1
            batch_logger.info(f"    ✅ Deleted: {lesson_id}")

        except Exception as e:
            # Database delete is FATAL - raise immediately
            error_msg = f"Failed to delete lesson {lesson_id}: {str(e)}"
            batch_logger.error(f"    ❌ {error_msg}")
            raise Exception(error_msg)

    batch_logger.info("─" * 70)

    # Phase 4: Summary
    end_time = time.time()
    total_duration_seconds = int(end_time - start_time)

    summary = {
        "batch_id": batch_id,
        "courseId": courseId,
        "all_versions": all_versions,
        "start_time": datetime.fromtimestamp(start_time).isoformat(),
        "end_time": datetime.fromtimestamp(end_time).isoformat(),
        "duration_seconds": total_duration_seconds,
        "duration_human": format_duration(total_duration_seconds),
        "deleted_lessons": deleted_lessons,
        "deleted_diagrams": diagram_result['deleted_diagrams'],
        "deleted_storage": diagram_result['deleted_storage'],
        "storage_errors": diagram_result['storage_errors'],
        "log_directory": str(log_dir.absolute())
    }

    # Log summary
    batch_logger.info("═" * 70)
    batch_logger.info("🗑️  Batch Deletion Complete")
    batch_logger.info("═" * 70)
    batch_logger.info("Summary:")
    batch_logger.info(f"  Lessons deleted:    {deleted_lessons}")
    batch_logger.info(f"  Diagrams deleted:   {diagram_result['deleted_diagrams']}")
    batch_logger.info(f"  Storage files:      {diagram_result['deleted_storage']}")
    batch_logger.info(f"  Storage warnings:   {len(diagram_result['storage_errors'])}")
    batch_logger.info(f"  Total Duration:     {format_duration(total_duration_seconds)}")
    batch_logger.info("═" * 70)

    # Write delete_summary.json
    summary_file = log_dir / "delete_summary.json"
    with open(summary_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)

    batch_logger.info(f"Summary saved to: {summary_file}")

    return summary


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Batch Lesson Generator - Generate lesson templates for all SOW entries in a course",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run to preview plan
  python -m src.batch_lesson_generator --courseId course_c84874 --dry-run

  # Generate missing lessons (default mode)
  python -m src.batch_lesson_generator --courseId course_c84874

  # Force regenerate all lessons
  python -m src.batch_lesson_generator --courseId course_c84874 --force

  # Automated force regeneration (CI/CD)
  python -m src.batch_lesson_generator --courseId course_c84874 --force --yes

  # Delete mode - preview deletion (dry-run)
  python -m src.batch_lesson_generator --courseId course_c84874 --delete --dry-run

  # Delete with confirmation prompt
  python -m src.batch_lesson_generator --courseId course_c84874 --delete

  # Delete without confirmation (CI/CD)
  python -m src.batch_lesson_generator --courseId course_c84874 --delete --yes

  # Delete ALL lessons (not just claud_Agent_sdk)
  python -m src.batch_lesson_generator --courseId course_c84874 --delete --all-versions
        """
    )

    # Required arguments
    parser.add_argument(
        '--courseId',
        type=str,
        required=True,
        help='Course identifier (e.g., course_c84874)'
    )

    # Mode arguments
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview generation plan without executing'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite ALL existing lessons'
    )

    # Delete mode arguments
    parser.add_argument(
        '--delete',
        action='store_true',
        help='Delete ALL lessons and diagrams for courseId (DESTRUCTIVE)'
    )
    parser.add_argument(
        '--all-versions',
        action='store_true',
        help='Delete lessons regardless of model_version (default: only claud_Agent_sdk)'
    )

    # Confirmation arguments
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Skip all confirmation prompts'
    )

    # Configuration arguments
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        help='Path to MCP configuration file (default: .mcp.json)'
    )
    parser.add_argument(
        '--max-retries',
        type=int,
        default=10,
        help='Maximum critic retry attempts per lesson (default: 10)'
    )
    parser.add_argument(
        '--no-persist-workspace',
        action='store_true',
        help='Delete temporary workspaces after each lesson'
    )
    parser.add_argument(
        '--log-level',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Logging level (default: INFO)'
    )

    return parser.parse_args()


async def main() -> int:
    """CLI entry point.

    Returns:
        Exit code (0=success, 1=partial failure, 2=error)
    """
    try:
        args = parse_arguments()

        # Validate mutually exclusive modes
        if args.delete and args.force:
            print("\n❌ ERROR: --delete and --force are mutually exclusive.")
            print("   Use --delete to remove lessons, or --force to regenerate them.\n")
            return 2

        # Generate batch ID (include 'delete' prefix for delete mode)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if args.delete:
            batch_id = f"delete_{args.courseId}_{timestamp}"
        else:
            batch_id = f"batch_{args.courseId}_{timestamp}"

        # Setup batch logging
        log_dir, batch_logger = setup_batch_logging(
            batch_id,
            args.courseId,
            args.log_level
        )

        # Build config dict
        config = {
            "mcp_config_path": args.mcp_config,
            "max_retries": args.max_retries,
            "persist_workspace": not args.no_persist_workspace,
            "log_level": args.log_level
        }

        # =====================================================================
        # DELETE MODE
        # =====================================================================
        if args.delete:
            if args.dry_run:
                # Delete dry-run mode
                await perform_delete_dry_run(
                    courseId=args.courseId,
                    all_versions=args.all_versions,
                    batch_id=batch_id,
                    log_dir=log_dir,
                    mcp_config_path=args.mcp_config
                )
                return 0  # Success
            else:
                # Confirmation prompt (unless --yes)
                if not args.yes:
                    # Fetch lessons to show what will be deleted
                    lessons = await fetch_lessons_for_deletion(
                        args.courseId, args.mcp_config, args.all_versions
                    )
                    lesson_ids = [l.get('$id') for l in lessons]
                    diagrams = await fetch_diagrams_for_lesson_ids(
                        lesson_ids, args.mcp_config
                    )

                    print()
                    print("=" * 70)
                    print("⚠️  DESTRUCTIVE OPERATION - Batch Deletion")
                    print("=" * 70)
                    print(f"Course ID: {args.courseId}")
                    print(f"Filter: {'All versions' if args.all_versions else 'model_version = claud_Agent_sdk only'}")
                    print()
                    print("Items to be PERMANENTLY DELETED:")
                    print(f"  📚 Lessons:        {len(lessons)}")
                    print(f"  🖼️  Diagrams:       {len(diagrams)}")
                    print(f"  📁 Storage files:  {sum(1 for d in diagrams if d.get('image_file_id'))}")
                    print()
                    print("⚠️  THIS ACTION CANNOT BE UNDONE!")
                    print()

                    response = input("Type 'DELETE' to confirm: ").strip()
                    if response != "DELETE":
                        print("\nAborted. No data was deleted.\n")
                        return 0

                # Execute batch deletion
                summary = await execute_batch_deletion(
                    courseId=args.courseId,
                    all_versions=args.all_versions,
                    batch_id=batch_id,
                    log_dir=log_dir,
                    batch_logger=batch_logger,
                    mcp_config_path=args.mcp_config
                )

                # Print console summary
                print()
                print(format_delete_summary_console(summary))
                print()

                # Determine exit code
                if summary.get('storage_errors'):
                    return 1  # Partial failure (storage warnings)
                return 0  # Success

        # =====================================================================
        # GENERATION MODE (default)
        # =====================================================================

        # Execute dry-run OR generation
        if args.dry_run:
            # Dry-run mode
            await perform_dry_run(
                courseId=args.courseId,
                force_mode=args.force,
                batch_id=batch_id,
                log_dir=log_dir,
                mcp_config_path=args.mcp_config
            )
            return 0  # Success
        else:
            # Confirmation prompt (unless --yes)
            if not args.yes:
                # Fetch SOW entries to show plan
                sow_entries = await fetch_sow_entries(args.courseId, args.mcp_config)
                existing_lessons = await check_existing_lessons(args.courseId, args.mcp_config)

                skip_count = 0
                generate_count = 0

                for entry in sow_entries:
                    order = entry.get('order', 0)
                    existing = existing_lessons.get(order)
                    is_claud_sdk = existing and existing.get('model_version') == 'claud_Agent_sdk'

                    if not args.force and is_claud_sdk:
                        skip_count += 1
                    else:
                        generate_count += 1

                estimates = calculate_estimates(generate_count)

                print()
                print("=" * 70)
                print("Batch Generation Plan")
                print("=" * 70)
                print(f"Course ID: {args.courseId}")
                print(f"Total SOW Entries: {len(sow_entries)}")
                print(f"Will skip (already exist): {skip_count}")
                print(f"Will generate (new): {generate_count}")
                print(f"Force mode: {'Yes' if args.force else 'No'}")
                print()
                print(f"Estimated time: ~{estimates['duration_minutes']} minutes")
                print(f"Estimated cost: ~${estimates['cost_usd']:.2f} USD")
                print()

                if args.force and len(existing_lessons) > 0:
                    print("⚠️  WARNING: Force mode will OVERWRITE existing lessons")
                    print()

                response = input("Continue? [y/N]: ").strip().lower()
                if response != 'y':
                    print("Cancelled by user.")
                    return 0

            # Execute batch generation
            summary = await execute_batch_generation(
                courseId=args.courseId,
                force_mode=args.force,
                batch_id=batch_id,
                log_dir=log_dir,
                batch_logger=batch_logger,
                config=config
            )

            # Print console summary
            print()
            print(format_batch_summary_console(summary))
            print()

            # Determine exit code
            if summary['failed'] > 0:
                return 1  # Partial failure
            return 0  # Success

    except ValueError as e:
        # Batch-level error (SOW not found, etc.)
        print(f"\n❌ ERROR: {e}\n")
        return 2
    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        return 2
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}\n")
        logging.error(f"Unexpected error: {e}", exc_info=True)
        return 2


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
