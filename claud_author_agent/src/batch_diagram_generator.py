#!/usr/bin/env python3
"""Batch Diagram Generator CLI - Generate diagrams for all lessons in a course.

Supports two modes:
1. Single lesson mode: --courseId + --order (delegates to existing diagram_author_cli)
2. Batch mode: --courseId only (processes all lessons in course)

Key features:
- Dry-run preview with estimates
- Validation before generation (fast-fail)
- Skip existing diagrams (unless --force)
- Force regenerate (deletes existing diagrams)
- Per-lesson logging
- Batch summary report

Usage:
    # Dry-run for all lessons (preview only, no execution)
    python -m src.batch_diagram_generator --courseId course_c84874 --dry-run

    # Generate diagrams for all lessons (executes immediately)
    python -m src.batch_diagram_generator --courseId course_c84874

    # Force regenerate all diagrams (deletes and recreates)
    python -m src.batch_diagram_generator --courseId course_c84874 --force

    # Single lesson mode (delegates to existing CLI)
    python -m src.batch_diagram_generator --courseId course_c84874 --order 5
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
        description="Batch Diagram Generator - Generate diagrams for all lessons in a course",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:

  # Dry-run for all lessons (preview only, no execution)
  python -m src.batch_diagram_generator --courseId course_c84874 --dry-run

  # Generate diagrams for all lessons (executes immediately)
  python -m src.batch_diagram_generator --courseId course_c84874

  # Force regenerate all diagrams (deletes and recreates immediately)
  python -m src.batch_diagram_generator --courseId course_c84874 --force

  # Single lesson mode (delegates to existing diagram_author_cli)
  python -m src.batch_diagram_generator --courseId course_c84874 --order 5

Note:
  - Validates all lessons BEFORE starting generation (fast-fail)
  - Skips lessons with existing diagrams (use --force to regenerate)
  - Dry-run mode is fast (skips eligibility analysis for preview)
  - Execution mode runs full eligibility analysis and generates immediately
  - Creates per-lesson logs in logs/batch_runs/{batch_id}/
  - Writes batch summary to logs/batch_runs/{batch_id}/batch_summary.json
        """
    )

    # Required arguments
    parser.add_argument(
        '--courseId',
        type=str,
        required=True,
        help="Course identifier (e.g., 'course_c84874')"
    )

    # Optional arguments
    parser.add_argument(
        '--order',
        type=int,
        help="Single lesson order (if provided, delegates to diagram_author_cli)"
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Preview execution plan without generating diagrams"
    )

    parser.add_argument(
        '--force',
        action='store_true',
        help="Force regenerate existing diagrams (deletes and recreates)"
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


async def run_single_lesson_mode(args: argparse.Namespace) -> int:
    """Delegate to existing diagram_author_cli for single lesson.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    from .diagram_author_cli import main as diagram_author_main

    logger.info(f"Single lesson mode: Delegating to diagram_author_cli for order {args.order}")

    print(f"{BLUE}Single lesson mode detected (--order {args.order}){RESET}")
    print(f"{BLUE}Delegating to existing diagram_author_cli...{RESET}\n")

    # Create modified args for diagram_author_cli
    # Note: diagram_author_cli uses the same arg names
    return await diagram_author_main()


async def run_batch_mode(args: argparse.Namespace) -> int:
    """Execute batch diagram generation for all lessons.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    from .utils.validation import validate_diagram_author_input
    from .utils.batch_diagram_utils import (
        fetch_lesson_orders_from_sow,
        check_existing_diagrams_batch,
        build_execution_plan,
        display_dry_run_preview,
        display_estimates,
        write_batch_summary,
        display_final_report
    )
    from .utils.diagram_validator import validate_lessons_batch
    from .utils.diagram_cleanup import delete_existing_diagrams_for_lesson
    from .diagram_author_claude_client import DiagramAuthorClaudeAgent
    from .tools.diagram_screenshot_tool import check_diagram_service_health

    print(f"\n{BLUE}{'=' * 80}{RESET}")
    print(f"{BLUE}Batch Diagram Generator{RESET}")
    print(f"{BLUE}{'=' * 80}{RESET}\n")

    print(f"{BLUE}Course ID:{RESET} {args.courseId}")
    print(f"{BLUE}Mode:{RESET} {'Dry-run' if args.dry_run else 'Execute'}")
    print(f"{BLUE}Force:{RESET} {'Yes (will delete existing diagrams)' if args.force else 'No (will skip existing)'}\n")

    # Validate courseId format
    is_valid, error = validate_diagram_author_input({"courseId": args.courseId, "order": 1})
    if not is_valid:
        print(f"{RED}❌ Input validation failed: {error}{RESET}\n")
        return 1

    # Check DiagramScreenshot service health
    print(f"{BLUE}Checking DiagramScreenshot service health...{RESET}")
    health = check_diagram_service_health()

    if not health["available"]:
        print(f"{RED}❌ DiagramScreenshot service not available at {health['url']}{RESET}")
        print(f"{YELLOW}Error: {health['error']}{RESET}")
        print(f"\n{YELLOW}Solution:{RESET}")
        print(f"  cd diagram-prototypes && docker compose up -d\n")
        return 1

    print(f"{GREEN}✅ DiagramScreenshot service is healthy at {health['url']}{RESET}\n")

    # Create batch execution ID
    batch_id = datetime.now().strftime("batch_diagram_%Y%m%d_%H%M%S")
    log_dir = Path(f"logs/batch_runs/{batch_id}")

    try:
        # Step 1: Fetch lesson orders from SOW
        print(f"{BLUE}Step 1: Fetching lesson orders from SOW...{RESET}")
        lesson_orders = await fetch_lesson_orders_from_sow(
            course_id=args.courseId,
            mcp_config_path=args.mcp_config
        )
        print(f"{GREEN}✅ Found {len(lesson_orders)} lessons in SOW{RESET}\n")

        # Step 2: Validate all lessons (fast-fail)
        # Skip eligibility analysis in dry-run mode for speed
        print(f"{BLUE}Step 2: Validating all lessons...{RESET}")
        if args.dry_run:
            print(f"{YELLOW}(Dry-run: Skipping eligibility analysis for speed - will validate structure only){RESET}")

        validation_results = await validate_lessons_batch(
            course_id=args.courseId,
            lesson_orders=lesson_orders,
            mcp_config_path=args.mcp_config,
            skip_eligibility=args.dry_run  # Skip Claude agent in dry-run mode
        )

        valid_count = sum(1 for v in validation_results.values() if v["valid"])
        invalid_count = len(lesson_orders) - valid_count

        if args.dry_run:
            total_cards = sum(v.get("total_cards", 0) for v in validation_results.values() if v["valid"])
            print(f"{GREEN}✅ Validation complete: {valid_count} valid, {invalid_count} invalid ({total_cards} total cards){RESET}\n")
        else:
            print(f"{GREEN}✅ Validation complete: {valid_count} valid, {invalid_count} invalid{RESET}\n")

        # Step 3: Check existing diagrams
        print(f"{BLUE}Step 3: Checking existing diagrams...{RESET}")
        existing_diagrams = await check_existing_diagrams_batch(
            course_id=args.courseId,
            lesson_orders=lesson_orders,
            mcp_config_path=args.mcp_config
        )

        existing_count = sum(1 for diagrams in existing_diagrams.values() if diagrams)
        print(f"{GREEN}✅ Found existing diagrams for {existing_count} lessons{RESET}\n")

        # Step 4: Build execution plan
        print(f"{BLUE}Step 4: Building execution plan...{RESET}")
        execution_plan = build_execution_plan(
            lesson_orders=lesson_orders,
            validation_results=validation_results,
            existing_diagrams=existing_diagrams,
            force=args.force
        )
        print(f"{GREEN}✅ Execution plan ready{RESET}\n")

        # Step 5: Display dry-run preview
        display_dry_run_preview(execution_plan)
        display_estimates(execution_plan)

        if args.dry_run:
            print(f"{YELLOW}Dry-run mode: No changes made{RESET}\n")
            return 0

        # Step 6: Execute batch generation
        print(f"\n{BLUE}{'=' * 80}{RESET}")
        print(f"{BLUE}Starting batch execution...{RESET}")
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
                    "diagrams_generated": 0,
                    "diagrams_failed": 0,
                    "cost_usd": 0,
                    "execution_time_seconds": 0
                })
                print(f"{YELLOW}⏭️  Lesson {order}: SKIPPED - {lesson_plan['reason']}{RESET}")
                continue

            print(f"\n{BLUE}🚀 Processing lesson {order}...{RESET}")

            # Delete existing if --force
            if args.force and lesson_plan["action"] == "OVERWRITE":
                print(f"{YELLOW}Deleting {lesson_plan['existing_count']} existing diagrams...{RESET}")
                await delete_existing_diagrams_for_lesson(
                    course_id=args.courseId,
                    order=order,
                    mcp_config_path=args.mcp_config
                )
                print(f"{GREEN}✅ Existing diagrams deleted{RESET}")

            # Setup per-lesson logging
            lesson_log_file = log_dir / f"order_{order}.log"
            file_handler = logging.FileHandler(lesson_log_file)
            file_handler.setLevel(logging.DEBUG)
            logger.addHandler(file_handler)

            try:
                # REUSE EXISTING DiagramAuthorClaudeAgent (DRY compliance)
                agent = DiagramAuthorClaudeAgent(
                    mcp_config_path=args.mcp_config,
                    persist_workspace=True,
                    log_level=args.log_level
                )

                result = await agent.execute(courseId=args.courseId, order=order)

                results.append({
                    "order": order,
                    "status": "SUCCESS" if result["success"] else "FAILED",
                    "diagrams_generated": result.get("diagrams_generated", 0),
                    "diagrams_failed": result.get("diagrams_failed", 0),
                    "cost_usd": result["metrics"].get("total_cost_usd", 0),
                    "execution_time_seconds": result["metrics"].get("execution_time_seconds", 0),
                    "error": result.get("error") if not result["success"] else None
                })

                if result["success"]:
                    print(f"{GREEN}✅ Lesson {order}: {result['diagrams_generated']} diagrams generated{RESET}")
                else:
                    print(f"{RED}❌ Lesson {order} FAILED: {result.get('error', 'Unknown error')}{RESET}")

            except Exception as e:
                logger.error(f"Lesson {order} failed with exception: {e}", exc_info=True)
                results.append({
                    "order": order,
                    "status": "FAILED",
                    "diagrams_generated": 0,
                    "diagrams_failed": 0,
                    "cost_usd": 0,
                    "execution_time_seconds": 0,
                    "error": str(e)
                })
                print(f"{RED}❌ Lesson {order} FAILED with exception: {e}{RESET}")

            finally:
                logger.removeHandler(file_handler)

        # Step 8: Write batch summary
        print(f"\n{BLUE}Writing batch summary...{RESET}")
        write_batch_summary(batch_id, results, log_dir)
        print(f"{GREEN}✅ Summary written to {log_dir}/batch_summary.json{RESET}\n")

        # Step 9: Display final report
        display_final_report(results)

        # Determine exit code
        failed_count = sum(1 for r in results if r["status"] == "FAILED")
        if failed_count > 0:
            print(f"{YELLOW}⚠️  Batch completed with {failed_count} failures{RESET}\n")
            return 1
        else:
            print(f"{GREEN}🎉 Batch completed successfully!{RESET}\n")
            return 0

    except Exception as e:
        logger.error(f"Batch execution failed: {e}", exc_info=True)
        print(f"\n{RED}{'=' * 80}{RESET}")
        print(f"{RED}❌ BATCH EXECUTION FAILED{RESET}")
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

        # Determine mode
        if args.order:
            # Single lesson mode: delegate to existing diagram_author_cli
            return await run_single_lesson_mode(args)
        else:
            # Batch mode: process all lessons
            return await run_batch_mode(args)

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
