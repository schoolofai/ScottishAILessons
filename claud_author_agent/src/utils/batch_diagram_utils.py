"""Batch diagram generation orchestration utilities.

Provides batch-specific helpers for:
1. Fetching lesson orders from SOW
2. Checking existing diagrams
3. Building execution plans
4. Displaying dry-run previews
5. Writing batch summaries

Follows DRY principle: Thin wrapper around existing utilities.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


async def fetch_lesson_orders_from_sow(
    course_id: str,
    mcp_config_path: str
) -> List[int]:
    """Fetch all lesson order numbers from Authored_SOW collection.

    Args:
        course_id: Course identifier
        mcp_config_path: Path to MCP config file

    Returns:
        Sorted list of lesson order numbers (1-indexed)

    Raises:
        ValueError: If published SOW not found

    Example:
        >>> orders = await fetch_lesson_orders_from_sow("course_c84874", ".mcp.json")
        >>> orders
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    """
    from .batch_utils import fetch_sow_entries

    logger.info(f"Fetching SOW entries for course {course_id}...")

    sow_entries = await fetch_sow_entries(
        courseId=course_id,
        mcp_config_path=mcp_config_path
    )

    # Extract order field from each entry
    lesson_orders = [entry["order"] for entry in sow_entries if "order" in entry]

    logger.info(f"Found {len(lesson_orders)} lessons in SOW for course {course_id}")

    return sorted(lesson_orders)


async def check_existing_diagrams_batch(
    course_id: str,
    lesson_orders: List[int],
    mcp_config_path: str
) -> Dict[int, List[tuple]]:
    """Check which diagrams already exist for each lesson.

    Args:
        course_id: Course identifier
        lesson_orders: List of lesson order numbers to check
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary mapping order → list of (cardId, diagram_context) tuples
        Example:
            {
                1: [("card_001", "lesson"), ("card_002", "cfu")],
                2: [],
                3: [("card_001", "lesson")]
            }

    Example:
        >>> existing = await check_existing_diagrams_batch("course_c84874", [1, 2], ".mcp.json")
        >>> existing[1]
        [("card_001", "lesson"), ("card_002", "cfu")]
    """
    from .diagram_extractor import fetch_lesson_template
    from .appwrite_mcp import list_appwrite_documents

    existing = {}

    for order in lesson_orders:
        try:
            # Fetch lesson template to get lessonTemplateId
            template = await fetch_lesson_template(
                course_id=course_id,
                order=order,
                mcp_config_path=mcp_config_path
            )

            if not template:
                existing[order] = []
                logger.warning(f"Lesson order {order}: Template not found")
                continue

            lesson_template_id = template["$id"]

            # Query lesson_diagrams collection
            diagrams = await list_appwrite_documents(
                database_id="default",
                collection_id="lesson_diagrams",
                queries=[f'equal("lessonTemplateId", "{lesson_template_id}")'],
                mcp_config_path=mcp_config_path
            )

            # Extract (cardId, diagram_context) tuples
            existing[order] = [
                (d["cardId"], d.get("diagram_context", "lesson"))
                for d in diagrams.get("documents", [])
            ]

            if existing[order]:
                logger.info(f"Lesson order {order}: Found {len(existing[order])} existing diagrams")
            else:
                logger.info(f"Lesson order {order}: No existing diagrams")

        except Exception as e:
            logger.error(f"Failed to check existing diagrams for order {order}: {e}")
            existing[order] = []

    return existing


def build_execution_plan(
    lesson_orders: List[int],
    validation_results: Dict[int, Dict[str, Any]],
    existing_diagrams: Dict[int, List[tuple]],
    force: bool
) -> List[Dict[str, Any]]:
    """Build execution plan with skip/generate/overwrite decisions.

    Args:
        lesson_orders: List of lesson order numbers
        validation_results: Validation results from validate_lessons_batch()
        existing_diagrams: Existing diagrams from check_existing_diagrams_batch()
        force: Whether to force regenerate existing diagrams

    Returns:
        List of execution plan dictionaries with decisions per lesson

    Example:
        >>> plan = build_execution_plan([1, 2], validation_results, existing_diagrams, False)
        >>> plan[0]
        {
            "order": 1,
            "action": "SKIP",
            "reason": "Already has 3 diagrams (use --force to regenerate)",
            "existing_count": 3
        }
    """
    plan = []

    for order in lesson_orders:
        validation = validation_results.get(order, {})

        # Skip if validation failed
        if not validation.get("valid", False):
            plan.append({
                "order": order,
                "action": "SKIP",
                "reason": "Validation failed",
                "errors": validation.get("errors", [])
            })
            continue

        # Get existing diagrams and eligible count
        existing = existing_diagrams.get(order, [])
        eligible_count = validation.get("eligible_cards_count", 0)

        # Decision logic
        if existing and not force:
            # Skip existing diagrams
            plan.append({
                "order": order,
                "action": "SKIP",
                "reason": f"Already has {len(existing)} diagrams (use --force to regenerate)",
                "existing_count": len(existing),
                "eligible_count": eligible_count
            })
        elif existing and force:
            # Force regenerate existing diagrams
            plan.append({
                "order": order,
                "action": "OVERWRITE",
                "reason": f"Force regenerate {len(existing)} existing diagrams",
                "existing_count": len(existing),
                "eligible_count": eligible_count
            })
        else:
            # Generate new diagrams
            plan.append({
                "order": order,
                "action": "GENERATE",
                "reason": f"Generate {eligible_count} new diagrams",
                "eligible_count": eligible_count
            })

    return plan


def display_dry_run_preview(execution_plan: List[Dict[str, Any]]) -> None:
    """Display ASCII table preview of execution plan.

    Args:
        execution_plan: Execution plan from build_execution_plan()

    Example:
        >>> display_dry_run_preview(plan)
        ================================================================================
        DRY RUN PREVIEW - No changes will be made
        ================================================================================

        Total Lessons: 10
          - Generate: 5
          - Overwrite: 2
          - Skip: 3
          - Malformed (validation failed): 1

        Order    Action       Reason
        --------------------------------------------------------------------------------
        1        SKIP         Already has 3 diagrams (use --force to regenerate)
        2        GENERATE     Generate 5 new diagrams
        ...
    """
    print("\n" + "=" * 80)
    print("DRY RUN PREVIEW - No changes will be made")
    print("=" * 80 + "\n")

    # Summary stats
    total = len(execution_plan)
    skip_count = sum(1 for p in execution_plan if p["action"] == "SKIP")
    generate_count = sum(1 for p in execution_plan if p["action"] == "GENERATE")
    overwrite_count = sum(1 for p in execution_plan if p["action"] == "OVERWRITE")
    malformed = sum(1 for p in execution_plan if "Validation failed" in p.get("reason", ""))

    print(f"Total Lessons: {total}")
    print(f"  - Generate: {generate_count}")
    print(f"  - Overwrite: {overwrite_count}")
    print(f"  - Skip: {skip_count}")
    print(f"  - Malformed (validation failed): {malformed}")
    print("\n")

    # Table header
    print(f"{'Order':<8} {'Action':<12} {'Reason':<50}")
    print("-" * 80)

    # Table rows
    for p in execution_plan:
        action_color = {
            "GENERATE": "\033[92m",   # Green
            "OVERWRITE": "\033[93m",  # Yellow
            "SKIP": "\033[90m"        # Gray
        }.get(p["action"], "")
        reset = "\033[0m"

        print(
            f"{p['order']:<8} "
            f"{action_color}{p['action']:<12}{reset} "
            f"{p['reason'][:50]:<50}"
        )

    print("\n" + "=" * 80 + "\n")


def display_estimates(execution_plan: List[Dict[str, Any]]) -> None:
    """Display time and cost estimates for batch execution.

    Args:
        execution_plan: Execution plan from build_execution_plan()

    Example:
        >>> display_estimates(plan)
        ESTIMATES:
          Lessons to process: 5
          Time: ~25 minutes (~0.4 hours)
          Cost: ~$2.50
          Per lesson: ~5 min, ~$0.50
    """
    # Count lessons to process (GENERATE or OVERWRITE)
    lessons_to_process = sum(
        1 for p in execution_plan
        if p["action"] in ["GENERATE", "OVERWRITE"]
    )

    if lessons_to_process == 0:
        print("ESTIMATES:")
        print("  No lessons to process (all skipped or malformed)")
        print()
        return

    # Conservative estimates per lesson
    avg_time_per_lesson = 5  # minutes (assumes ~3 diagrams per lesson)
    avg_cost_per_lesson = 0.50  # USD

    total_time = lessons_to_process * avg_time_per_lesson
    total_cost = lessons_to_process * avg_cost_per_lesson

    print("ESTIMATES:")
    print(f"  Lessons to process: {lessons_to_process}")
    print(f"  Time: ~{total_time} minutes (~{total_time/60:.1f} hours)")
    print(f"  Cost: ~${total_cost:.2f}")
    print(f"  Per lesson: ~{avg_time_per_lesson} min, ~${avg_cost_per_lesson:.2f}")
    print()


def write_batch_summary(
    batch_id: str,
    results: List[Dict[str, Any]],
    log_dir: Path
) -> None:
    """Write batch execution summary to JSON file.

    Args:
        batch_id: Unique batch execution ID
        results: List of execution results from execute_diagram_batch()
        log_dir: Directory to write summary file

    Creates:
        {log_dir}/batch_summary.json with metrics and results

    Example:
        >>> write_batch_summary("batch_20251106", results, Path("logs/batch_runs/batch_20251106"))
    """
    # Calculate summary metrics
    total = len(results)
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    skipped_count = sum(1 for r in results if r["status"] == "SKIPPED")

    total_diagrams = sum(r.get("diagrams_generated", 0) for r in results)
    total_cost = sum(r.get("cost_usd", 0) for r in results)
    total_time = sum(r.get("execution_time_seconds", 0) for r in results)

    summary = {
        "batch_id": batch_id,
        "timestamp": datetime.now().isoformat(),
        "metrics": {
            "total_lessons": total,
            "success": success_count,
            "failed": failed_count,
            "skipped": skipped_count,
            "total_diagrams_generated": total_diagrams,
            "total_cost_usd": round(total_cost, 4),
            "total_time_seconds": int(total_time),
            "avg_time_per_lesson_seconds": int(total_time / total) if total > 0 else 0,
            "avg_cost_per_lesson_usd": round(total_cost / total, 4) if total > 0 else 0
        },
        "results": results
    }

    # Write to JSON file
    summary_file = log_dir / "batch_summary.json"
    with open(summary_file, 'w') as f:
        json.dump(summary, f, indent=2)

    logger.info(f"✅ Batch summary written to {summary_file}")


def display_final_report(results: List[Dict[str, Any]]) -> None:
    """Display final batch execution report.

    Args:
        results: List of execution results from execute_diagram_batch()

    Example:
        >>> display_final_report(results)
        ================================================================================
        BATCH EXECUTION COMPLETE
        ================================================================================

        Summary:
          Total Lessons: 10
          Success: 8
          Failed: 1
          Skipped: 1
          Total Diagrams Generated: 24
          Total Cost: $4.25
          Total Time: 42 minutes

        ...
    """
    print("\n" + "=" * 80)
    print("BATCH EXECUTION COMPLETE")
    print("=" * 80 + "\n")

    # Calculate metrics
    total = len(results)
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    skipped_count = sum(1 for r in results if r["status"] == "SKIPPED")

    total_diagrams = sum(r.get("diagrams_generated", 0) for r in results)
    total_cost = sum(r.get("cost_usd", 0) for r in results)
    total_time = sum(r.get("execution_time_seconds", 0) for r in results)

    # Summary
    print("Summary:")
    print(f"  Total Lessons: {total}")
    print(f"  Success: {success_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total Diagrams Generated: {total_diagrams}")
    print(f"  Total Cost: ${total_cost:.2f}")
    print(f"  Total Time: {int(total_time / 60)} minutes\n")

    # Per-lesson details
    print("Per-Lesson Results:")
    print(f"{'Order':<8} {'Status':<12} {'Diagrams':<10} {'Cost':<10} {'Time':<10}")
    print("-" * 80)

    for r in results:
        order = r["order"]
        status = r["status"]

        # Color-coded status
        status_color = {
            "SUCCESS": "\033[92m",   # Green
            "FAILED": "\033[91m",    # Red
            "SKIPPED": "\033[90m"    # Gray
        }.get(status, "")
        reset = "\033[0m"

        diagrams = r.get("diagrams_generated", 0)
        cost = r.get("cost_usd", 0)
        time_seconds = r.get("execution_time_seconds", 0)
        time_str = f"{int(time_seconds / 60)}m {int(time_seconds % 60)}s" if time_seconds > 0 else "-"

        print(
            f"{order:<8} "
            f"{status_color}{status:<12}{reset} "
            f"{diagrams:<10} "
            f"${cost:<9.2f} "
            f"{time_str:<10}"
        )

    print("\n" + "=" * 80 + "\n")
