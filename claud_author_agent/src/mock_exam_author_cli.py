#!/usr/bin/env python3
"""CLI for Mock Exam Author Claude Agent.

Usage:
    # Generate mock exam for a course
    python -m src.mock_exam_author_cli --courseId course_c84474

    # With version (default: "1")
    python -m src.mock_exam_author_cli --courseId course_c84474 --version 2

    # Force overwrite existing
    python -m src.mock_exam_author_cli --courseId course_c84474 --force

    # Dry run (validate only, don't upsert)
    python -m src.mock_exam_author_cli --courseId course_c84474 --dry-run

    # Verbose logging
    python -m src.mock_exam_author_cli --courseId course_c84474 --log-level DEBUG
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any

from .mock_exam_author_claude_client import MockExamAuthorClaudeAgent
from .mock_exam_author_claude_client_v2 import MockExamAuthorClaudeAgentV2

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_input_from_json(json_path: str) -> Dict[str, Any]:
    """Load input parameters from JSON file.

    Expected JSON format:
    {
        "courseId": "course_c84474",
        "version": "1"  // optional, defaults to "1"
    }

    Args:
        json_path: Path to JSON input file

    Returns:
        Dictionary with courseId and optional version

    Raises:
        FileNotFoundError: If JSON file not found
        ValueError: If JSON is invalid or missing required fields
    """
    json_file = Path(json_path)

    if not json_file.exists():
        raise FileNotFoundError(f"Input JSON file not found: {json_path}")

    try:
        with open(json_file) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in input file: {e}")

    if "courseId" not in data:
        raise ValueError(
            "Missing required field in JSON input: courseId. "
            "Expected format: {\"courseId\": \"course_c84474\"}"
        )

    result = {"courseId": data["courseId"]}

    if "version" in data:
        result["version"] = str(data["version"])

    return result


def interactive_input() -> Dict[str, str]:
    """Prompt user for input parameters interactively.

    Returns:
        Dictionary with courseId
    """
    print("=" * 70)
    print("Mock Exam Author - Interactive Input")
    print("=" * 70)
    print()
    print("Please provide the Course ID:")
    print()

    print("Course ID (e.g., 'course_c84474'):")
    print("  (Must have published SOW in default.Authored_SOW)")
    print("  (SOW must contain at least one mock_exam entry)")
    course_id = input("  > ").strip()

    if not course_id:
        raise ValueError("Course ID cannot be empty")

    print()
    return {"courseId": course_id}


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Mock Exam Author Claude Agent - CLI Wrapper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python -m src.mock_exam_author_cli --courseId course_c84474

  # Generate version 2
  python -m src.mock_exam_author_cli --courseId course_c84474 --version 2

  # Force overwrite existing mock exam
  python -m src.mock_exam_author_cli --courseId course_c84474 --force

  # Dry run (generate but don't upsert to database)
  python -m src.mock_exam_author_cli --courseId course_c84474 --dry-run

  # JSON file input
  python -m src.mock_exam_author_cli --input input.json

  # Verbose debugging
  python -m src.mock_exam_author_cli --courseId course_c84474 --log-level DEBUG
        """
    )

    # Input method options (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        '--input',
        type=str,
        metavar='JSON_FILE',
        help='Path to JSON file containing courseId'
    )

    # Direct parameter input
    parser.add_argument(
        '--courseId',
        type=str,
        help='Course identifier (must have published SOW with mock_exam entry)'
    )

    # Versioning options
    parser.add_argument(
        '--version',
        type=str,
        default='1',
        metavar='VERSION',
        help='Mock exam version number (default: 1). Must be numeric string.'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force overwrite existing mock exam for this version'
    )

    # Dry run option
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Generate mock exam but do not upsert to Appwrite (for testing)'
    )

    # Configuration options
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
        metavar='PATH',
        help='Path to MCP configuration file (default: .mcp.json)'
    )
    parser.add_argument(
        '--no-persist-workspace',
        action='store_true',
        help='Delete workspace after execution (default: persist for debugging)'
    )
    parser.add_argument(
        '--log-level',
        type=str,
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Logging level (default: INFO)'
    )

    # V2 modular architecture flag
    parser.add_argument(
        '--v2',
        action='store_true',
        help='Use V2 modular architecture with structured outputs'
    )

    return parser.parse_args()


async def run_agent(
    courseId: str,
    version: str = "1",
    force: bool = False,
    dry_run: bool = False,
    mcp_config_path: str = ".mcp.json",
    persist_workspace: bool = True,
    log_level: str = "INFO",
    use_v2: bool = False
) -> Dict[str, Any]:
    """Run the Mock Exam Author agent with given parameters.

    Args:
        courseId: Course identifier
        version: Mock exam version number
        force: Force overwrite existing mock exam
        dry_run: Generate but don't upsert
        mcp_config_path: Path to MCP config
        persist_workspace: Whether to preserve workspace
        log_level: Logging level
        use_v2: Use V2 modular architecture with structured outputs

    Returns:
        Result dictionary from agent execution
    """
    agent_version = "V2 (Modular)" if use_v2 else "V1 (Original)"
    print("=" * 70)
    print(f"Mock Exam Author Claude Agent - {agent_version}")
    print("=" * 70)
    print()
    print("Input Parameters:")
    print(f"  Course ID:     {courseId}")
    print(f"  Version:       {version}")
    print(f"  Force Mode:    {'YES' if force else 'NO'}")
    print(f"  Dry Run:       {'YES' if dry_run else 'NO'}")
    print(f"  MCP Config:    {mcp_config_path}")
    print(f"  Persist WS:    {persist_workspace}")
    print(f"  Log Level:     {log_level}")
    print(f"  Agent Version: {agent_version}")
    print()

    if force:
        print("WARNING: Force mode will overwrite existing mock exam for this version!")
        print()

    if dry_run:
        print("NOTE: Dry run mode - mock exam will NOT be saved to database")
        print()

    print("=" * 70)
    print()

    # Initialize agent based on version flag
    if use_v2:
        agent = MockExamAuthorClaudeAgentV2(
            mcp_config_path=mcp_config_path,
            persist_workspace=persist_workspace,
            log_level=log_level
        )
    else:
        agent = MockExamAuthorClaudeAgent(
            mcp_config_path=mcp_config_path,
            persist_workspace=persist_workspace,
            log_level=log_level
        )

    # Execute pipeline
    result = await agent.execute(
        courseId=courseId,
        version=version,
        force=force,
        dry_run=dry_run
    )

    return result


def print_result(result: Dict[str, Any], dry_run: bool = False) -> None:
    """Print execution result in a user-friendly format.

    Args:
        result: Result dictionary from agent execution
        dry_run: Whether this was a dry run
    """
    print()
    print("=" * 70)

    if result["success"]:
        print("MOCK EXAM AUTHORING COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print()
        print("Results:")
        print(f"  Execution ID:     {result['execution_id']}")
        print(f"  Workspace Path:   {result['workspace_path']}")
        print(f"  Mock Exam ID:     {result.get('mock_exam_id', 'N/A')}")

        if not dry_run and result.get('appwrite_document_id'):
            print(f"  Appwrite Doc ID:  {result['appwrite_document_id']}")
        elif dry_run:
            print(f"  [DRY RUN] Mock exam NOT saved to database")

        print()
        print("Metrics:")
        metrics = result.get('metrics', {})
        print(f"  Total Tokens:     {metrics.get('total_tokens', 'N/A')}")
        print(f"  Total Cost (USD): ${metrics.get('total_cost_usd', 0.0):.4f}")
        print()

        if not dry_run:
            print("Mock exam saved to Appwrite: default.mock_exams")
        else:
            print("Mock exam available in workspace: /workspace/mock_exam.json")

    else:
        print("MOCK EXAM AUTHORING FAILED")
        print("=" * 70)
        print()
        print(f"Error: {result.get('error', 'Unknown error')}")
        print()

        if 'metrics' in result:
            metrics = result['metrics']
            print("Partial Metrics:")
            print(f"  Total Tokens:     {metrics.get('total_tokens', 'N/A')}")
            print(f"  Total Cost (USD): ${metrics.get('total_cost_usd', 0.0):.4f}")

    print("=" * 70)
    print()


async def main() -> int:
    """Main CLI entry point.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    try:
        args = parse_arguments()

        # Determine input method and load parameters
        if args.input:
            logger.info(f"Loading input from JSON file: {args.input}")
            params = load_input_from_json(args.input)
            course_id = params["courseId"]
            version = params.get("version", args.version)

        elif args.courseId:
            logger.info("Using command-line argument")
            course_id = args.courseId
            version = args.version

        else:
            logger.info("No input provided, entering interactive mode")
            params = interactive_input()
            course_id = params["courseId"]
            version = args.version

        # Run agent
        result = await run_agent(
            courseId=course_id,
            version=version,
            force=args.force,
            dry_run=args.dry_run,
            mcp_config_path=args.mcp_config,
            persist_workspace=not args.no_persist_workspace,
            log_level=args.log_level,
            use_v2=args.v2
        )

        # Print result
        print_result(result, dry_run=args.dry_run)

        return 0 if result["success"] else 1

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        return 1

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"\nERROR: {e}")
        return 1


def cli_entry():
    """Entry point for console_scripts."""
    sys.exit(asyncio.run(main()))


if __name__ == "__main__":
    cli_entry()
