#!/usr/bin/env python3
"""CLI wrapper for Diagram Author Claude Agent.

Supports three input methods for US1 (MVP):
1. Command-line args: --courseId course_c84874 --order 1 (primary for US1)
2. JSON file: --input input.json (coming in US4)
3. Interactive prompts: (no args) (coming in US4)

Note: Order values start from 1 (not 0). SOW entries are 1-indexed.
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from .diagram_author_claude_client import DiagramAuthorClaudeAgent
from .tools.diagram_screenshot_tool import check_diagram_service_health

# ANSI color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments for US1 (single lesson mode).

    Returns:
        Parsed arguments namespace

    Note:
        US1 MVP requires --courseId and --order (both required)
        US4 will add --input (JSON file) and interactive mode support
    """
    parser = argparse.ArgumentParser(
        description="Diagram Author Claude Agent - CLI Wrapper (US1 MVP)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples (US1 - Single Lesson Mode):
  # Generate diagrams for a specific lesson
  python -m src.diagram_author_cli \\
    --courseId course_c84874 \\
    --order 1

  # With custom MCP config and debug logging
  python -m src.diagram_author_cli \\
    --courseId course_c84874 \\
    --order 1 \\
    --log-level DEBUG \\
    --mcp-config .mcp.custom.json

  # Clean up workspace after execution
  python -m src.diagram_author_cli \\
    --courseId course_c84874 \\
    --order 1 \\
    --no-persist-workspace

Note:
  - Order starts from 1 (SOW entries are 1-indexed, not 0-indexed)
  - Ensure DiagramScreenshot service is running at http://localhost:3001
  - Diagrams are persisted to default.lesson_diagrams collection
  - Workspace is preserved by default for debugging (use --no-persist-workspace to clean up)
        """
    )

    # US1 MVP: Command-line args (required)
    parser.add_argument(
        '--courseId',
        type=str,
        help="Course identifier (e.g., 'course_c84874'). Required for US1."
    )

    parser.add_argument(
        '--order',
        type=int,
        help="Lesson order number in SOW (1-indexed). Required for US1."
    )

    # Logging options
    parser.add_argument(
        '--log-level',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help="Logging verbosity level (default: INFO)"
    )

    # Workspace options
    parser.add_argument(
        '--no-persist-workspace',
        action='store_true',
        help="Delete workspace after execution (default: preserve for debugging)"
    )

    # MCP configuration
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        help="Path to MCP configuration file (default: .mcp.json)"
    )

    # US4 future: JSON file input (placeholder for US4)
    parser.add_argument(
        '--input',
        type=str,
        help="[US4] Path to JSON input file (not yet implemented)"
    )

    return parser.parse_args()


def validate_cli_args(args: argparse.Namespace) -> None:
    """Validate CLI arguments for US1 (single lesson mode).

    Args:
        args: Parsed command-line arguments

    Raises:
        ValueError: If validation fails

    Note:
        US1 requires BOTH --courseId and --order
        US4 will support --input as alternative
    """
    # US4 check: --input not yet supported
    if args.input:
        raise ValueError(
            "JSON file input (--input) is not yet implemented. "
            "This feature will be available in US4. "
            "For now, use --courseId and --order arguments."
        )

    # US1 validation: Both courseId and order required
    if not args.courseId or not args.order:
        missing = []
        if not args.courseId:
            missing.append("--courseId")
        if not args.order:
            missing.append("--order")

        raise ValueError(
            f"Missing required arguments: {', '.join(missing)}. "
            "Both --courseId and --order are required for US1 (single lesson mode). "
            "Run with --help for usage examples."
        )

    # Validate order is >= 1 (SOW entries are 1-indexed)
    if args.order < 1:
        raise ValueError(
            f"Order must be >= 1 (SOW entries start at 1), got: {args.order}"
        )


def print_success_banner(result: Dict[str, Any]) -> None:
    """Print success banner with execution metrics (green colored output).

    Args:
        result: Execution result dictionary from DiagramAuthorClaudeAgent.execute()
    """
    print(f"\n{GREEN}{'=' * 80}{RESET}")
    print(f"{GREEN}✅ DIAGRAM GENERATION SUCCESSFUL{RESET}")
    print(f"{GREEN}{'=' * 80}{RESET}\n")

    print(f"{BLUE}Execution Summary:{RESET}")
    print(f"  Execution ID:        {result['execution_id']}")
    print(f"  Workspace Path:      {result['workspace_path']}")
    print(f"  Diagrams Generated:  {result['diagrams_generated']}")
    print(f"  Diagrams Skipped:    {result['diagrams_skipped']}")
    print(f"  Diagrams Failed:     {result['diagrams_failed']}")

    if result['appwrite_document_ids']:
        print(f"\n{BLUE}Appwrite Document IDs:{RESET}")
        for doc_id in result['appwrite_document_ids']:
            print(f"  - {doc_id}")

    # Metrics
    metrics = result.get('metrics', {})
    if metrics:
        print(f"\n{BLUE}Execution Metrics:{RESET}")
        print(f"  Total Tokens:        {metrics.get('total_tokens', 0):,}")
        print(f"  Total Cost (USD):    ${metrics.get('total_cost_usd', 0):.4f}")

        if 'execution_time_seconds' in metrics:
            exec_time = metrics['execution_time_seconds']
            minutes = int(exec_time // 60)
            seconds = int(exec_time % 60)
            print(f"  Execution Time:      {minutes}m {seconds}s")

    print(f"\n{GREEN}{'=' * 80}{RESET}\n")


def print_failure_banner(error: str, execution_id: Optional[str] = None) -> None:
    """Print failure banner with error details (red colored output).

    Args:
        error: Error message
        execution_id: Optional execution ID (if available)
    """
    print(f"\n{RED}{'=' * 80}{RESET}")
    print(f"{RED}❌ DIAGRAM GENERATION FAILED{RESET}")
    print(f"{RED}{'=' * 80}{RESET}\n")

    if execution_id:
        print(f"{YELLOW}Execution ID:{RESET} {execution_id}\n")

    print(f"{YELLOW}Error Details:{RESET}")
    print(f"  {error}\n")

    print(f"{YELLOW}Troubleshooting:{RESET}")
    print(f"  1. Verify DiagramScreenshot service is running:")
    print(f"     cd diagram-prototypes && docker compose up -d")
    print(f"  2. Check courseId and order exist in Appwrite database")
    print(f"  3. Review logs for detailed stack traces")
    print(f"  4. Check workspace for intermediate files (preserved by default)")

    print(f"\n{RED}{'=' * 80}{RESET}\n")


async def main() -> int:
    """Main CLI entrypoint for Diagram Author Agent (US1 MVP).

    Returns:
        Exit code (0 = success, 1 = failure)
    """
    try:
        # Parse arguments
        args = parse_arguments()

        # Configure logging level
        logging.getLogger().setLevel(getattr(logging, args.log_level))

        # Validate arguments (US1: both --courseId and --order required)
        validate_cli_args(args)

        # Health check DiagramScreenshot service (FR-065)
        print(f"\n{BLUE}Checking DiagramScreenshot service health...{RESET}")
        health = check_diagram_service_health()

        if not health["available"]:
            print(f"{RED}❌ DiagramScreenshot service is not available at {health['url']}{RESET}")
            print(f"{YELLOW}Error: {health['error']}{RESET}")
            print(f"\n{YELLOW}Solution:{RESET}")
            print(f"  cd diagram-prototypes && docker compose up -d\n")
            return 1

        print(f"{GREEN}✅ DiagramScreenshot service is healthy at {health['url']}{RESET}\n")

        # Initialize DiagramAuthorClaudeAgent
        print(f"{BLUE}Initializing Diagram Author Agent...{RESET}")
        agent = DiagramAuthorClaudeAgent(
            mcp_config_path=args.mcp_config,
            persist_workspace=not args.no_persist_workspace,
            log_level=args.log_level
        )

        # Execute pipeline (US1: single lesson mode)
        print(f"{BLUE}Starting diagram generation pipeline...{RESET}\n")
        result = await agent.execute(
            courseId=args.courseId,
            order=args.order
        )

        # Print result
        if result["success"]:
            print_success_banner(result)
            return 0
        else:
            error_msg = result.get("error", "Unknown error")
            execution_id = result.get("execution_id")
            print_failure_banner(error_msg, execution_id)
            return 1

    except ValueError as e:
        # Validation errors (courseId format, order < 1, missing args, etc.)
        logger.error(f"Validation error: {e}")
        print_failure_banner(str(e))
        return 1

    except FileNotFoundError as e:
        # MCP config missing, prompts missing, etc.
        logger.error(f"File not found: {e}")
        print_failure_banner(str(e))
        return 1

    except Exception as e:
        # Unexpected errors
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print_failure_banner(str(e))
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
