#!/usr/bin/env python3
"""CLI wrapper for SOW Author Claude Agent.

Supports three input methods:
1. JSON file: --input input.json
2. Command-line args: --subject mathematics --level national-5 --courseId course_123
3. Interactive prompts: (no args provided)

Supports two authoring modes:
- --iterative: New lesson-by-lesson approach (better schema compliance, default)
- --legacy: Original monolithic approach (backward compatibility)
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

from .sow_author_claude_client import SOWAuthorClaudeAgent
from .iterative_sow_author import IterativeSOWAuthor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_input_from_json(json_path: str) -> Dict[str, str]:
    """Load input parameters from JSON file.

    Expected JSON format:
    {
        "courseId": "course_c84874"
    }

    Note: Subject and level are automatically fetched from default.courses collection.

    Args:
        json_path: Path to JSON input file

    Returns:
        Dictionary with courseId

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

    # Validate required field
    if "courseId" not in data:
        raise ValueError(
            "Missing required field in JSON input: courseId. "
            "Expected format: {\"courseId\": \"course_c84874\"}"
        )

    return {"courseId": data["courseId"]}


def interactive_input() -> Dict[str, str]:
    """Prompt user for input parameters interactively.

    Returns:
        Dictionary with courseId
    """
    print("=" * 70)
    print("SOW Author - Interactive Input")
    print("=" * 70)
    print()
    print("Please provide the Course ID:")
    print()

    # Course ID input with examples
    print("Course ID (e.g., 'course_c84474'):")
    print("  (Must exist in default.courses collection)")
    print("  (Subject and level will be automatically fetched from the database)")
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
        description="SOW Author Claude Agent - CLI Wrapper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # JSON file input
  python -m src.sow_author_cli --input input.json

  # Command-line argument (courseId only)
  python -m src.sow_author_cli --courseId course_c84474

  # Interactive mode (no arguments)
  python -m src.sow_author_cli

  # Custom configuration
  python -m src.sow_author_cli \\
    --courseId course_c84474 \\
    --mcp-config .mcp.json \\
    --no-persist-workspace
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
        help='Course identifier (must exist in default.courses; subject/level auto-fetched)'
    )

    # Versioning options
    parser.add_argument(
        '--version',
        type=str,
        default='1',
        metavar='VERSION',
        help='SOW version number (default: 1). Must be numeric string (e.g., "1", "2").'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force overwrite existing SOW for this version (use with caution)'
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

    # Authoring mode options (mutually exclusive)
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        '--iterative',
        action='store_true',
        default=True,
        help='Use iterative lesson-by-lesson authoring (default, better schema compliance)'
    )
    mode_group.add_argument(
        '--legacy',
        action='store_true',
        help='Use legacy monolithic authoring (backward compatibility)'
    )

    return parser.parse_args()


async def run_agent(
    courseId: str,
    version: str = "1",
    force: bool = False,
    mcp_config_path: str = ".mcp.json",
    persist_workspace: bool = True,
    log_level: str = "INFO",
    use_iterative: bool = True
) -> Dict[str, Any]:
    """Run the SOW Author agent with given parameters.

    Args:
        courseId: Course identifier (subject/level auto-fetched from database)
        version: SOW version number (default: "1")
        force: Force overwrite existing SOW for this version (default: False)
        mcp_config_path: Path to MCP config
        persist_workspace: Whether to preserve workspace
        log_level: Logging level
        use_iterative: Use iterative authoring (True) or legacy monolithic (False)

    Returns:
        Result dictionary from agent execution
    """
    mode_name = "Iterative" if use_iterative else "Legacy"

    print("=" * 70)
    print(f"SOW Author Claude Agent ({mode_name} Mode)")
    print("=" * 70)
    print()
    print("Input Parameters:")
    print(f"  Course ID:     {courseId}")
    print(f"  Version:       {version}")
    print(f"  Force Mode:    {'YES' if force else 'NO'}")
    print(f"  Auth Mode:     {mode_name}")
    print(f"  MCP Config:    {mcp_config_path}")
    print(f"  Persist WS:    {persist_workspace}")
    print(f"  Log Level:     {log_level}")
    print()
    print("Note: Subject and level will be automatically fetched from database")
    if force:
        print("⚠️  WARNING: Force mode will overwrite existing SOW for this version!")
    if use_iterative:
        print("📋 Using iterative lesson-by-lesson authoring (better schema compliance)")
    else:
        print("📦 Using legacy monolithic authoring (backward compatibility)")
    print()
    print("=" * 70)
    print()

    # Initialize appropriate agent based on mode
    if use_iterative:
        agent = IterativeSOWAuthor(
            mcp_config_path=mcp_config_path,
            persist_workspace=persist_workspace,
            log_level=log_level
        )
    else:
        agent = SOWAuthorClaudeAgent(
            mcp_config_path=mcp_config_path,
            persist_workspace=persist_workspace,
            log_level=log_level
        )

    # Execute pipeline with version and force parameters
    result = await agent.execute(
        courseId=courseId,
        version=version,
        force=force
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
        print("✅ SOW AUTHORING COMPLETED SUCCESSFULLY!")
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
        print("✓ SOW has been saved to Appwrite database: default.Authored_SOW")

    else:
        print("❌ SOW AUTHORING FAILED")
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

        elif args.courseId:
            # Method 2: Command-line argument
            logger.info("Using command-line argument")
            params = {"courseId": args.courseId}

        else:
            # Method 3: Interactive prompts
            logger.info("No input provided, entering interactive mode")
            params = interactive_input()

        # Determine authoring mode (--legacy overrides default --iterative)
        use_iterative = not args.legacy

        # Run agent with version, force, and mode parameters
        result = await run_agent(
            courseId=params["courseId"],
            version=args.version,
            force=args.force,
            mcp_config_path=args.mcp_config,
            persist_workspace=not args.no_persist_workspace,
            log_level=args.log_level,
            use_iterative=use_iterative
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
