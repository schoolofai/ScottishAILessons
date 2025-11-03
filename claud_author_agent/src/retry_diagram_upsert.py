#!/usr/bin/env python3
"""Retry diagram upsert from existing diagrams_output.json.

This script allows retrying the diagram upsert operation without re-running
the expensive diagram generation process. Useful when fixing upsert bugs like:
- Document ID length constraints
- Enum validation issues
- Query string formatting

Usage:
    python -m src.retry_diagram_upsert --workspace /path/to/workspace/exec_XXX
    python -m src.retry_diagram_upsert --workspace workspace/exec_20251101_094819 --log-level DEBUG

Requirements:
    - Workspace must contain diagrams_output.json from a previous successful generation
    - MCP config file must be present (default: .mcp.json)

Exit codes:
    0 - Success (all diagrams upserted)
    1 - Failure (workspace not found, no diagrams, or all upserts failed)
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any

# ANSI color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def setup_logging(log_level: str = "INFO") -> None:
    """Configure logging with the specified level."""
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def print_banner(message: str, color: str = RESET) -> None:
    """Print a formatted banner message."""
    border = "=" * 80
    print(f"\n{color}{border}")
    print(f"{message}")
    print(f"{border}{RESET}\n")


async def main() -> int:
    """Main entry point for retry upsert script."""
    parser = argparse.ArgumentParser(
        description="Retry diagram upsert from existing workspace diagrams_output.json",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Retry upsert with default log level
  python -m src.retry_diagram_upsert --workspace workspace/exec_20251101_094819

  # Retry with debug logging
  python -m src.retry_diagram_upsert --workspace workspace/exec_20251101_094819 --log-level DEBUG

  # Use custom MCP config
  python -m src.retry_diagram_upsert --workspace workspace/exec_20251101_094819 --mcp-config custom.mcp.json
        """
    )

    parser.add_argument(
        "--workspace",
        required=True,
        help="Path to workspace directory containing diagrams_output.json"
    )

    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP config file (default: .mcp.json)"
    )

    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()
    setup_logging(log_level=args.log_level)

    logger = logging.getLogger(__name__)

    print_banner("🔄 Diagram Upsert Retry Script", BLUE)

    # Validate workspace path
    workspace = Path(args.workspace)
    if not workspace.exists():
        logger.error(f"❌ Workspace directory not found: {workspace}")
        print_banner(f"❌ FAILED - Workspace not found: {workspace}", RED)
        return 1

    if not workspace.is_dir():
        logger.error(f"❌ Workspace path is not a directory: {workspace}")
        print_banner(f"❌ FAILED - Not a directory: {workspace}", RED)
        return 1

    # Validate diagrams_output.json
    diagrams_output = workspace / "diagrams_output.json"
    if not diagrams_output.exists():
        logger.error(f"❌ diagrams_output.json not found in {workspace}")
        print_banner(
            f"❌ FAILED - diagrams_output.json not found\n\n"
            f"Expected location: {diagrams_output}\n\n"
            f"Ensure you're using a workspace from a successful diagram generation run.",
            RED
        )
        return 1

    # Load diagrams data
    logger.info(f"Loading diagrams from {diagrams_output}")

    try:
        with open(diagrams_output, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"❌ Failed to parse diagrams_output.json: {e}")
        print_banner(f"❌ FAILED - Invalid JSON in diagrams_output.json", RED)
        return 1
    except Exception as e:
        logger.error(f"❌ Failed to read diagrams_output.json: {e}")
        print_banner(f"❌ FAILED - Could not read diagrams_output.json", RED)
        return 1

    diagrams = data.get("diagrams", [])

    if not diagrams:
        logger.error("❌ No diagrams found in diagrams_output.json")
        print_banner(
            f"❌ FAILED - No diagrams to upsert\n\n"
            f"The diagrams_output.json file is empty or malformed.",
            RED
        )
        return 1

    logger.info(f"✅ Found {len(diagrams)} diagrams to upsert")
    print(f"{GREEN}✅ Loaded {len(diagrams)} diagrams from workspace{RESET}\n")

    # Extract execution_id from workspace directory name
    execution_id = workspace.name
    logger.info(f"Using execution_id: {execution_id}")

    # Transform diagrams data for batch_upsert_diagrams function
    diagrams_data = []
    for diagram in diagrams:
        diagrams_data.append({
            "lesson_template_id": diagram["lessonTemplateId"],
            "card_id": diagram["cardId"],
            "jsxgraph_json": diagram["jsxgraph_json"],
            "image_base64": diagram["image_base64"],
            "diagram_type": diagram["diagram_type"],
            "visual_critique_score": diagram["visual_critique_score"],
            "critique_iterations": diagram["critique_iterations"],
            "critique_feedback": diagram["critique_feedback"],
            "execution_id": execution_id
        })

    # Import batch upsert function
    try:
        from .utils.diagram_upserter import batch_upsert_diagrams
    except ImportError:
        logger.error("❌ Failed to import diagram_upserter module")
        print_banner("❌ FAILED - Missing diagram_upserter module", RED)
        return 1

    # Perform batch upsert
    logger.info("Starting batch upsert...")
    print(f"{BLUE}🚀 Starting batch upsert to Appwrite...{RESET}\n")

    try:
        results = await batch_upsert_diagrams(
            diagrams_data=diagrams_data,
            mcp_config_path=args.mcp_config
        )
    except Exception as e:
        logger.error(f"❌ Batch upsert failed with exception: {e}")
        print_banner(f"❌ FAILED - Batch upsert exception\n\nError: {str(e)}", RED)
        return 1

    # Display results
    total = results["total"]
    succeeded = results["succeeded"]
    failed = results["failed"]
    errors = results.get("errors", [])

    print(f"\n{BLUE}{'=' * 80}{RESET}")
    print(f"{BLUE}Batch Upsert Results:{RESET}")
    print(f"{BLUE}{'=' * 80}{RESET}\n")

    print(f"  Total diagrams:     {total}")
    print(f"  {GREEN}✅ Succeeded:       {succeeded}{RESET}")

    if failed > 0:
        print(f"  {RED}❌ Failed:          {failed}{RESET}\n")

        # Display error details
        print(f"{RED}Error Details:{RESET}\n")
        for idx, error in enumerate(errors, start=1):
            print(f"{RED}[{idx}] {error['lesson_template_id']} / {error['card_id']}{RESET}")
            print(f"    Error: {error['error']}")
            print(f"    Type:  {error['exception_type']}\n")
    else:
        print("")

    # Print final banner
    if succeeded > 0 and failed == 0:
        print_banner(
            f"✅ SUCCESS - All {succeeded} diagrams upserted successfully!\n\n"
            f"Workspace: {workspace}\n"
            f"Execution ID: {execution_id}",
            GREEN
        )
        return 0
    elif succeeded > 0 and failed > 0:
        print_banner(
            f"⚠️  PARTIAL SUCCESS - {succeeded}/{total} diagrams upserted\n\n"
            f"{failed} diagram(s) failed. Check logs above for details.\n"
            f"Workspace: {workspace}",
            YELLOW
        )
        return 1
    else:
        print_banner(
            f"❌ FAILED - All {total} diagram upserts failed\n\n"
            f"Check error details above for troubleshooting.\n"
            f"Workspace: {workspace}",
            RED
        )
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
