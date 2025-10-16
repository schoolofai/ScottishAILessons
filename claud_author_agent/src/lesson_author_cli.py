#!/usr/bin/env python3
"""CLI wrapper for Lesson Author Claude Agent.

Supports three input methods:
1. JSON file: --input input.json
2. Command-line args: --courseId course_c84874 --order 1
3. Interactive prompts: (no args provided)

Note: Order values start from 1 (not 0). SOW entries are 1-indexed.
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from .lesson_author_claude_client import LessonAuthorClaudeAgent

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
        "courseId": "course_c84874",
        "order": 1
    }

    Args:
        json_path: Path to JSON input file

    Returns:
        Dictionary with courseId and order

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

    # Validate required fields
    required_fields = ["courseId", "order"]
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValueError(
            f"Missing required fields in JSON input: {', '.join(missing_fields)}. "
            f"Expected: {', '.join(required_fields)}"
        )

    # Validate order is integer
    if not isinstance(data["order"], int):
        raise ValueError(f"'order' must be an integer, got: {type(data['order']).__name__}")

    # Validate order is >= 1 (SOW entries are 1-indexed)
    if data["order"] < 1:
        raise ValueError(f"'order' must be >= 1 (SOW entries start at 1), got: {data['order']}")

    return {
        "courseId": data["courseId"],
        "order": data["order"]
    }


def interactive_input() -> Dict[str, Any]:
    """Prompt user for input parameters interactively.

    Returns:
        Dictionary with courseId and order
    """
    print("=" * 70)
    print("Lesson Author - Interactive Input")
    print("=" * 70)
    print()
    print("Please provide the following information:")
    print()

    # Course ID input with examples
    print("Course ID - courseId field value (e.g., 'course_c84874'):")
    print("  (Must exist in default.courses collection)")
    courseId = input("  > ").strip()

    if not courseId:
        raise ValueError("Course ID cannot be empty")

    # Order input with examples
    print("\nLesson Order - entry order in SOW (e.g., 1, 2, 3):")
    print("  (Must be valid order in SOW entries for this course)")
    print("  (Note: Order starts from 1, not 0)")
    order_input = input("  > ").strip()

    if not order_input:
        raise ValueError("Order cannot be empty")

    try:
        order = int(order_input)
    except ValueError:
        raise ValueError(f"Order must be an integer, got: '{order_input}'")

    # Validate order is >= 1 (SOW entries are 1-indexed)
    if order < 1:
        raise ValueError(f"Order must be >= 1 (SOW entries start at 1), got: {order}")

    print()
    return {
        "courseId": courseId,
        "order": order
    }


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description="Lesson Author Claude Agent - CLI Wrapper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # JSON file input
  python -m src.lesson_author_cli --input input.json

  # Command-line arguments
  python -m src.lesson_author_cli \\
    --courseId course_c84874 \\
    --order 1

  # Interactive mode (no arguments)
  python -m src.lesson_author_cli

  # Custom configuration
  python -m src.lesson_author_cli \\
    --input input.json \\
    --mcp-config .mcp.json \\
    --max-retries 10 \\
    --no-persist-workspace

Note: Order values start from 1 (not 0). SOW entries are 1-indexed.
        """
    )

    # Input method options (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        '--input',
        type=str,
        metavar='JSON_FILE',
        help='Path to JSON file containing courseId and order'
    )

    # Direct parameter input
    parser.add_argument(
        '--courseId',
        type=str,
        help='Course identifier (e.g., "course_c84874")'
    )
    parser.add_argument(
        '--order',
        type=int,
        help='Lesson order number in SOW entries (e.g., 1, 2, 3) - starts from 1, not 0'
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
        '--max-retries',
        type=int,
        default=10,
        metavar='N',
        help='Maximum critic retry attempts (default: 10)'
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

    return parser.parse_args()


async def run_agent(
    courseId: str,
    order: int,
    mcp_config_path: str = ".mcp.json",
    max_critic_retries: int = 10,
    persist_workspace: bool = True,
    log_level: str = "INFO"
) -> Dict[str, Any]:
    """Run the Lesson Author agent with given parameters.

    Args:
        courseId: Course identifier
        order: Lesson order number
        mcp_config_path: Path to MCP config
        max_critic_retries: Maximum critic retry attempts
        persist_workspace: Whether to preserve workspace
        log_level: Logging level

    Returns:
        Result dictionary from agent execution
    """
    print("=" * 70)
    print("Lesson Author Claude Agent")
    print("=" * 70)
    print()
    print("Input Parameters:")
    print(f"  Course ID:     {courseId}")
    print(f"  Order:         {order}")
    print(f"  MCP Config:    {mcp_config_path}")
    print(f"  Max Retries:   {max_critic_retries}")
    print(f"  Persist WS:    {persist_workspace}")
    print(f"  Log Level:     {log_level}")
    print()
    print("=" * 70)
    print()

    # Initialize agent
    agent = LessonAuthorClaudeAgent(
        mcp_config_path=mcp_config_path,
        persist_workspace=persist_workspace,
        max_critic_retries=max_critic_retries,
        log_level=log_level
    )

    # Execute pipeline
    result = await agent.execute(
        courseId=courseId,
        order=order
    )

    return result


def print_result(result: Dict[str, Any]) -> None:
    """Print execution result in a user-friendly format.

    Args:
        result: Result dictionary from agent execution
    """
    print()
    print("=" * 70)

    if result["success"]:
        print("✅ LESSON TEMPLATE AUTHORING COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print()
        print("Results:")
        print(f"  Execution ID:     {result['execution_id']}")
        print(f"  Workspace Path:   {result['workspace_path']}")
        print(f"  Document ID:      {result['appwrite_document_id']}")
        print()
        print("Metrics:")
        metrics = result.get('metrics', {})
        print(f"  Total Tokens:     {metrics.get('total_tokens', 'N/A')}")
        print(f"  Total Cost (USD): ${metrics.get('total_cost_usd', 0.0):.4f}")
        print()
        print("✓ Lesson template has been saved to Appwrite database: default.lesson_templates")

    else:
        print("❌ LESSON TEMPLATE AUTHORING FAILED")
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
            # Method 1: JSON file input
            logger.info(f"Loading input from JSON file: {args.input}")
            params = load_input_from_json(args.input)

        elif args.courseId is not None and args.order is not None:
            # Method 2: Command-line arguments
            logger.info("Using command-line arguments")
            params = {
                "courseId": args.courseId,
                "order": args.order
            }

        elif args.courseId is None and args.order is None:
            # Method 3: Interactive prompts
            logger.info("No input provided, entering interactive mode")
            params = interactive_input()

        else:
            # Partial command-line args provided (error)
            print("❌ ERROR: When using command-line arguments, both parameters are required:")
            print("  --courseId and --order")
            print()
            print("Use --help for usage examples")
            return 1

        # Run agent
        result = await run_agent(
            courseId=params["courseId"],
            order=params["order"],
            mcp_config_path=args.mcp_config,
            max_critic_retries=args.max_retries,
            persist_workspace=not args.no_persist_workspace,
            log_level=args.log_level
        )

        # Print result
        print_result(result)

        # Return exit code
        return 0 if result["success"] else 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user")
        return 1

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        print(f"\n❌ ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
