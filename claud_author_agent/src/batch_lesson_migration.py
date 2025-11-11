#!/usr/bin/env python3
"""Batch Lesson Migration CLI - Migrate all lessons in a course to current schema.

Upgrades old lesson templates to meet current Pydantic validation standards.

Key features:
- Dry-run preview with estimates
- Pre-validation before migration (fast-fail)
- Skip already-valid lessons
- Per-lesson logging
- Batch summary report

Usage:
    # Dry-run for all lessons
    python -m src.batch_lesson_migration --courseId course_c84473 --dry-run

    # Migrate all lessons
    python -m src.batch_lesson_migration --courseId course_c84473 --yes

    # Force re-migrate already valid lessons
    python -m src.batch_lesson_migration --courseId course_c84473 --force --yes
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# ANSI color codes
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Batch Lesson Migration - Migrate all lessons in a course to current schema",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:

  # Dry-run for all lessons in course
  python -m src.batch_lesson_migration --courseId course_c84473 --dry-run

  # Migrate all invalid lessons
  python -m src.batch_lesson_migration --courseId course_c84473 --yes

  # Force re-migrate all lessons (including valid ones)
  python -m src.batch_lesson_migration --courseId course_c84473 --force --yes

Note:
  - Pre-validates all lessons BEFORE starting migration (fast-fail)
  - Skips already-valid lessons (use --force to re-migrate)
  - Creates per-lesson logs in logs/batch_migrations/{batch_id}/
  - Writes batch summary to logs/batch_migrations/{batch_id}/batch_summary.json
        """
    )

    # Required arguments
    parser.add_argument(
        '--courseId',
        type=str,
        required=True,
        help="Course identifier (e.g., 'course_c84473')"
    )

    # Optional arguments
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Preview execution plan without migrating lessons"
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help="Force re-migrate already-valid lessons"
    )

    parser.add_argument(
        '--yes',
        action='store_true',
        help="Skip confirmation prompt"
    )

    # Configuration
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        help="Path to MCP configuration file (default: .mcp.json)"
    )

    parser.add_argument(
        '--log-level',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help="Logging verbosity level (default: INFO)"
    )

    return parser.parse_args()


async def check_lessons_validity_batch(
    course_id: str,
    lesson_orders: List[int],
    mcp_config_path: str
) -> Dict[int, Dict[str, Any]]:
    """Pre-validate all lessons to determine which need migration.

    Args:
        course_id: Course identifier
        lesson_orders: List of lesson order numbers to validate
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary mapping order → validation result:
        {
            order: {
                "valid": bool,
                "errors": List[str],
                "lesson_template_id": str,
                "title": str
            }
        }
    """
    from .utils.diagram_extractor import fetch_lesson_template
    from .utils.diagram_validator import validate_lesson_template_structure

    results = {}

    for order in lesson_orders:
        try:
            logger.info(f"Pre-validating lesson order {order}...")

            # Fetch lesson template
            template = await fetch_lesson_template(
                course_id=course_id,
                order=order,
                mcp_config_path=mcp_config_path
            )

            if not template:
                results[order] = {
                    "valid": False,
                    "errors": [f"Lesson not found: courseId={course_id}, order={order}"],
                    "lesson_template_id": "",
                    "title": "NOT FOUND"
                }
                logger.error(f"❌ Lesson order {order}: Not found in database")
                continue

            # Validate lesson template
            validation_result = validate_lesson_template_structure(template)

            lesson_template_id = template.get("$id", template.get("lessonTemplateId", "UNKNOWN"))
            title = template.get("title", "Untitled")

            if validation_result.is_valid:
                results[order] = {
                    "valid": True,
                    "errors": [],
                    "lesson_template_id": lesson_template_id,
                    "title": title
                }
                logger.info(f"✅ Lesson order {order}: Already valid - '{title}'")
            else:
                results[order] = {
                    "valid": False,
                    "errors": validation_result.errors,
                    "lesson_template_id": lesson_template_id,
                    "title": title
                }
                logger.info(f"❌ Lesson order {order}: {len(validation_result.errors)} errors - '{title}'")

        except Exception as e:
            logger.error(f"❌ Lesson order {order}: Validation failed with exception: {e}")
            results[order] = {
                "valid": False,
                "errors": [str(e)],
                "lesson_template_id": "",
                "title": "ERROR"
            }

    return results


def build_migration_execution_plan(
    lesson_orders: List[int],
    validity_results: Dict[int, Dict[str, Any]],
    force: bool
) -> List[Dict[str, Any]]:
    """Build execution plan with skip/migrate decisions.

    Args:
        lesson_orders: List of lesson order numbers
        validity_results: Validation results from check_lessons_validity_batch()
        force: Whether to force re-migrate valid lessons

    Returns:
        List of execution plan dictionaries with decisions per lesson
    """
    plan = []

    for order in lesson_orders:
        validity = validity_results.get(order, {})

        # Skip if lesson not found
        if not validity.get("lesson_template_id"):
            plan.append({
                "order": order,
                "action": "SKIP",
                "reason": "Lesson not found in database",
                "errors": validity.get("errors", []),
                "title": ""
            })
            continue

        is_valid = validity.get("valid", False)
        errors = validity.get("errors", [])
        error_count = len(errors)
        title = validity.get("title", "Untitled")

        # Decision logic
        if is_valid and not force:
            # Skip valid lessons
            plan.append({
                "order": order,
                "action": "SKIP",
                "reason": f"Already valid (use --force to re-migrate)",
                "title": title,
                "errors": []
            })
        elif is_valid and force:
            # Force re-migrate valid lessons
            plan.append({
                "order": order,
                "action": "REMIGRATE",
                "reason": f"Force re-migrate (currently valid)",
                "title": title,
                "errors": []
            })
        else:
            # Migrate invalid lessons
            plan.append({
                "order": order,
                "action": "MIGRATE",
                "reason": f"Fix {error_count} validation errors",
                "error_count": error_count,
                "title": title,
                "errors": errors  # Include full error list
            })

    return plan


def display_migration_preview(execution_plan: List[Dict[str, Any]]) -> None:
    """Display ASCII table preview of execution plan with ALL validation errors."""
    print("\n" + "=" * 80)
    print("MIGRATION PREVIEW")
    print("=" * 80 + "\n")

    # Summary stats
    total = len(execution_plan)
    skip_count = sum(1 for p in execution_plan if p["action"] == "SKIP")
    migrate_count = sum(1 for p in execution_plan if p["action"] == "MIGRATE")
    remigrate_count = sum(1 for p in execution_plan if p["action"] == "REMIGRATE")

    print(f"Total Lessons: {total}")
    print(f"  - Migrate (invalid): {migrate_count}")
    print(f"  - Re-migrate (forced): {remigrate_count}")
    print(f"  - Skip: {skip_count}")
    print("\n")

    # Display detailed errors for each lesson
    for p in execution_plan:
        action_color = {
            "MIGRATE": "\033[92m",     # Green
            "REMIGRATE": "\033[93m",   # Yellow
            "SKIP": "\033[90m"         # Gray
        }.get(p["action"], "")
        reset = "\033[0m"

        order = p['order']
        action = p['action']
        title = p.get("title", "")
        reason = p["reason"]
        errors = p.get("errors", [])

        # Lesson header
        print(f"{action_color}{'─' * 80}{reset}")
        print(f"{action_color}Lesson {order}: {action}{reset} - {title}")
        print(f"{action_color}  Reason: {reason}{reset}")

        # Display ALL validation errors if present
        if errors:
            print(f"{action_color}  Validation Errors ({len(errors)}):{reset}")
            for i, error in enumerate(errors, 1):
                # Indent error messages for readability
                print(f"{action_color}    {i}. {error}{reset}")

        print()  # Blank line after each lesson

    print("=" * 80 + "\n")


def display_migration_estimates(execution_plan: List[Dict[str, Any]]) -> None:
    """Display time and cost estimates for batch migration."""
    # Count lessons to migrate
    lessons_to_migrate = sum(
        1 for p in execution_plan
        if p["action"] in ["MIGRATE", "REMIGRATE"]
    )

    if lessons_to_migrate == 0:
        print("ESTIMATES:")
        print("  No lessons to migrate (all skipped or already valid)")
        print()
        return

    # Conservative estimates per lesson (based on test results)
    avg_time_per_lesson = 2  # minutes (order 1 took 1.8 min)
    avg_cost_per_lesson = 0.50  # USD (order 1 cost $0.45)

    total_time = lessons_to_migrate * avg_time_per_lesson
    total_cost = lessons_to_migrate * avg_cost_per_lesson

    print("ESTIMATES:")
    print(f"  Lessons to migrate: {lessons_to_migrate}")
    print(f"  Time: ~{total_time} minutes (~{total_time/60:.1f} hours)")
    print(f"  Cost: ~${total_cost:.2f}")
    print(f"  Per lesson: ~{avg_time_per_lesson} min, ~${avg_cost_per_lesson:.2f}")
    print()


def write_migration_summary(
    batch_id: str,
    results: List[Dict[str, Any]],
    log_dir: Path
) -> None:
    """Write batch migration summary to JSON file."""
    # Calculate summary metrics
    total = len(results)
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    skipped_count = sum(1 for r in results if r["status"] == "SKIPPED")

    total_errors_fixed = sum(r.get("errors_fixed", 0) for r in results)
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
            "total_errors_fixed": total_errors_fixed,
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


def display_migration_report(results: List[Dict[str, Any]]) -> None:
    """Display final batch migration report."""
    print("\n" + "=" * 80)
    print("BATCH MIGRATION COMPLETE")
    print("=" * 80 + "\n")

    # Calculate metrics
    total = len(results)
    success_count = sum(1 for r in results if r["status"] == "SUCCESS")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    skipped_count = sum(1 for r in results if r["status"] == "SKIPPED")

    total_errors_fixed = sum(r.get("errors_fixed", 0) for r in results)
    total_cost = sum(r.get("cost_usd", 0) for r in results)
    total_time = sum(r.get("execution_time_seconds", 0) for r in results)

    # Summary
    print("Summary:")
    print(f"  Total Lessons: {total}")
    print(f"  Success: {success_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total Errors Fixed: {total_errors_fixed}")
    print(f"  Total Cost: ${total_cost:.2f}")
    print(f"  Total Time: {int(total_time / 60)} minutes\n")

    # Per-lesson details
    print("Per-Lesson Results:")
    print(f"{'Order':<8} {'Status':<12} {'Errors Fixed':<15} {'Cost':<10} {'Time':<10}")
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

        errors_fixed = r.get("errors_fixed", 0)
        cost = r.get("cost_usd", 0)
        time_seconds = r.get("execution_time_seconds", 0)
        time_str = f"{int(time_seconds / 60)}m {int(time_seconds % 60)}s" if time_seconds > 0 else "-"

        print(
            f"{order:<8} "
            f"{status_color}{status:<12}{reset} "
            f"{errors_fixed:<15} "
            f"${cost:<9.2f} "
            f"{time_str:<10}"
        )

    print("\n" + "=" * 80 + "\n")


async def run_batch_migration(args: argparse.Namespace) -> int:
    """Execute batch migration for all lessons.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    from .utils.validation import validate_diagram_author_input
    from .utils.batch_diagram_utils import fetch_lesson_orders_from_sow
    from .lesson_migration_claude_client import LessonMigrationClaudeAgent

    print(f"\n{BLUE}{'=' * 80}{RESET}")
    print(f"{BLUE}Batch Lesson Migration{RESET}")
    print(f"{BLUE}{'=' * 80}{RESET}\n")

    print(f"{BLUE}Course ID:{RESET} {args.courseId}")
    print(f"{BLUE}Mode:{RESET} {'Dry-run' if args.dry_run else 'Execute'}")
    print(f"{BLUE}Force:{RESET} {'Yes (will re-migrate valid lessons)' if args.force else 'No (will skip valid)'}\\n")

    # Validate courseId format
    is_valid, error = validate_diagram_author_input({"courseId": args.courseId, "order": 1})
    if not is_valid:
        print(f"{RED}❌ Input validation failed: {error}{RESET}\n")
        return 1

    # Create batch execution ID
    batch_id = datetime.now().strftime("batch_migration_%Y%m%d_%H%M%S")
    log_dir = Path(f"logs/batch_migrations/{batch_id}")

    try:
        # Step 1: Fetch lesson orders from SOW
        print(f"{BLUE}Step 1: Fetching lesson orders from SOW...{RESET}")
        lesson_orders = await fetch_lesson_orders_from_sow(
            course_id=args.courseId,
            mcp_config_path=args.mcp_config
        )
        print(f"{GREEN}✅ Found {len(lesson_orders)} lessons in SOW{RESET}\n")

        # Step 2: Pre-validate all lessons (fast-fail)
        print(f"{BLUE}Step 2: Pre-validating all lessons...{RESET}")
        validity_results = await check_lessons_validity_batch(
            course_id=args.courseId,
            lesson_orders=lesson_orders,
            mcp_config_path=args.mcp_config
        )

        valid_count = sum(1 for v in validity_results.values() if v["valid"])
        invalid_count = len(lesson_orders) - valid_count
        print(f"{GREEN}✅ Pre-validation complete: {valid_count} valid, {invalid_count} invalid{RESET}\n")

        # Step 3: Build execution plan
        print(f"{BLUE}Step 3: Building execution plan...{RESET}")
        execution_plan = build_migration_execution_plan(
            lesson_orders=lesson_orders,
            validity_results=validity_results,
            force=args.force
        )
        print(f"{GREEN}✅ Execution plan ready{RESET}\n")

        # Step 4: Display preview and estimates
        display_migration_preview(execution_plan)
        display_migration_estimates(execution_plan)

        if args.dry_run:
            print(f"{YELLOW}Dry-run mode: No changes made{RESET}\n")
            return 0

        # Step 5: Confirmation prompt
        if not args.yes:
            response = input(f"{YELLOW}Proceed with batch migration? (y/N): {RESET}")
            if response.lower() != 'y':
                print(f"{YELLOW}Cancelled by user{RESET}\n")
                return 0

        # Step 6: Execute batch migration
        print(f"\n{BLUE}{'=' * 80}{RESET}")
        print(f"{BLUE}Starting batch migration...{RESET}")
        print(f"{BLUE}{'=' * 80}{RESET}\n")

        # Create log directory
        log_dir.mkdir(parents=True, exist_ok=True)

        results = []

        for lesson_plan in execution_plan:
            order = lesson_plan["order"]

            if lesson_plan["action"] == "SKIP":
                results.append({
                    "order": order,
                    "status": "SKIPPED",
                    "reason": lesson_plan["reason"],
                    "errors_fixed": 0,
                    "cost_usd": 0,
                    "execution_time_seconds": 0
                })
                print(f"{YELLOW}⏭️  Lesson {order}: SKIPPED - {lesson_plan['reason']}{RESET}")
                continue

            print(f"\n{BLUE}🚀 Migrating lesson {order}...{RESET}")

            # Setup per-lesson logging
            lesson_log_file = log_dir / f"order_{order}.log"
            file_handler = logging.FileHandler(lesson_log_file)
            file_handler.setLevel(logging.DEBUG)
            logger.addHandler(file_handler)

            try:
                # Create migration agent
                agent = LessonMigrationClaudeAgent(
                    mcp_config_path=args.mcp_config,
                    persist_workspace=True,
                    log_level=args.log_level
                )

                result = await agent.execute(courseId=args.courseId, order=order)

                results.append({
                    "order": order,
                    "status": "SUCCESS" if result["success"] else "FAILED",
                    "errors_fixed": result.get("errors_fixed", 0),
                    "cost_usd": result["metrics"].get("total_cost_usd", 0),
                    "execution_time_seconds": result["metrics"].get("execution_time_seconds", 0),
                    "error": result.get("error") if not result["success"] else None
                })

                if result["success"]:
                    print(f"{GREEN}✅ Lesson {order}: Fixed {result.get('errors_fixed', 0)} errors{RESET}")
                else:
                    print(f"{RED}❌ Lesson {order} FAILED: {result.get('error', 'Unknown error')}{RESET}")

            except Exception as e:
                logger.error(f"Lesson {order} failed with exception: {e}", exc_info=True)
                results.append({
                    "order": order,
                    "status": "FAILED",
                    "errors_fixed": 0,
                    "cost_usd": 0,
                    "execution_time_seconds": 0,
                    "error": str(e)
                })
                print(f"{RED}❌ Lesson {order} FAILED with exception: {e}{RESET}")

            finally:
                logger.removeHandler(file_handler)

        # Step 7: Write batch summary
        print(f"\n{BLUE}Writing batch summary...{RESET}")
        write_migration_summary(batch_id, results, log_dir)
        print(f"{GREEN}✅ Summary written to {log_dir}/batch_summary.json{RESET}\n")

        # Step 8: Display final report
        display_migration_report(results)

        # Determine exit code
        failed_count = sum(1 for r in results if r["status"] == "FAILED")
        if failed_count > 0:
            print(f"{YELLOW}⚠️  Batch completed with {failed_count} failures{RESET}\n")
            return 1
        else:
            print(f"{GREEN}🎉 Batch migration completed successfully!{RESET}\n")
            return 0

    except Exception as e:
        logger.error(f"Batch migration failed: {e}", exc_info=True)
        print(f"\n{RED}{'=' * 80}{RESET}")
        print(f"{RED}❌ BATCH MIGRATION FAILED{RESET}")
        print(f"{RED}{'=' * 80}{RESET}\n")
        print(f"{YELLOW}Error: {e}{RESET}\n")
        return 1


async def main() -> int:
    """Main CLI entry point.

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    try:
        # Parse arguments
        args = parse_arguments()

        # Configure logging
        logging.basicConfig(
            level=getattr(logging, args.log_level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        # Run batch migration
        return await run_batch_migration(args)

    except KeyboardInterrupt:
        print(f"\n{YELLOW}Interrupted by user{RESET}\n")
        return 1

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"\n{RED}❌ Unexpected error: {e}{RESET}\n")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
