#!/usr/bin/env python3
"""CLI interface for Revision Notes Author.

Generates revision notes (course cheat sheet + per-lesson notes) from published SOW
and lesson templates using the notes_author Claude subagent.

Usage:
    python notes_author_cli.py --courseId course_c84874
    python notes_author_cli.py --courseId course_c84874 --force
    python notes_author_cli.py --courseId course_c84874 --persist-workspace --log-level DEBUG
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.notes_author_claude_client import NotesAuthorClaudeClient

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def main():
    """Main entry point for notes_author CLI."""
    parser = argparse.ArgumentParser(
        description="Generate revision notes from published SOW and lesson templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate notes for a course
  python notes_author_cli.py --courseId course_c84874

  # Force overwrite existing notes
  python notes_author_cli.py --courseId course_c84874 --force

  # Debug mode with workspace persistence
  python notes_author_cli.py --courseId course_c84874 --persist-workspace --log-level DEBUG

  # Specify SOW version
  python notes_author_cli.py --courseId course_c84874 --version 2
        """
    )

    # Required arguments
    parser.add_argument(
        "--courseId",
        required=True,
        help="Course ID (e.g., 'course_c84874')"
    )

    # Optional arguments
    parser.add_argument(
        "--version",
        default="1",
        help="SOW version to use (default: '1')"
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing revision notes documents (default: fail if exists)"
    )

    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to .mcp.json configuration file (default: .mcp.json)"
    )

    parser.add_argument(
        "--persist-workspace",
        action="store_true",
        help="Keep workspace directory after execution for debugging (default: delete)"
    )

    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()

    # Update logging level based on CLI flag
    log_level = getattr(logging, args.log_level)
    logging.getLogger().setLevel(log_level)

    # Validate MCP config path exists
    mcp_config_path = Path(args.mcp_config)
    if not mcp_config_path.exists():
        logger.error(f"❌ MCP config file not found: {mcp_config_path}")
        logger.error("   Please ensure .mcp.json exists with valid Appwrite credentials")
        sys.exit(1)

    # Display execution parameters
    logger.info("=" * 70)
    logger.info("🚀 Starting Revision Notes Author Agent")
    logger.info("=" * 70)
    logger.info(f"Course ID:        {args.courseId}")
    logger.info(f"Version:          {args.version}")
    logger.info(f"Force Overwrite:  {args.force}")
    logger.info(f"MCP Config:       {mcp_config_path}")
    logger.info(f"Persist Workspace: {args.persist_workspace}")
    logger.info(f"Log Level:        {args.log_level}")
    logger.info("")

    try:
        # Initialize the notes author client
        client = NotesAuthorClaudeClient(
            mcp_config_path=str(mcp_config_path),
            persist_workspace=args.persist_workspace,
            log_level=args.log_level
        )

        # Execute the notes authoring pipeline
        result = await client.execute(
            course_id=args.courseId,
            version=args.version,
            force=args.force
        )

        # Check if execution was successful
        if not result.get('success', False):
            # Execution failed - raise exception to trigger error handling
            error_msg = result.get('error', 'Unknown error occurred')
            raise Exception(error_msg)

        # Display results
        logger.info("")
        logger.info("=" * 70)
        logger.info("🎉 Revision Notes Authored Successfully!")
        logger.info("=" * 70)

        logger.info("")
        logger.info("📊 Execution Summary:")
        logger.info(f"  Execution ID:     {result['execution_id']}")
        logger.info(f"  Course ID:        {result['course_id']}")
        logger.info(f"  SOW Version:      {result.get('sow_version', 'N/A')}")
        logger.info(f"  Lesson Count:     {result['lesson_count']}")

        logger.info("")
        logger.info("📝 Generated Documents:")
        logger.info(f"  Cheat Sheet:      {result['cheat_sheet_doc_id']}")
        logger.info(f"  Lesson Notes:     {len(result['lesson_note_doc_ids'])} documents")

        if result.get('lesson_note_doc_ids'):
            for idx, doc_id in enumerate(result['lesson_note_doc_ids'], 1):
                logger.info(f"    {idx:2d}. {doc_id}")

        logger.info("")
        logger.info("💰 Resource Usage:")
        logger.info(f"  Token Usage:      {result.get('token_usage', 'N/A'):,} tokens")
        logger.info(f"  Estimated Cost:   ${result.get('cost_usd', 0):.4f} USD")

        if result.get('workspace_path'):
            logger.info("")
            logger.info("📁 Workspace:")
            logger.info(f"  Location:         {result['workspace_path']}")
            logger.info("  Note: Workspace will be preserved for inspection")

        logger.info("")
        logger.info("✅ Next Steps:")
        logger.info("  1. Verify documents in Appwrite Console → default.revision_notes")
        logger.info("  2. Download markdown from Storage → documents bucket")
        logger.info(f"  3. Frontend can fetch notes using courseId: {args.courseId}")
        logger.info("")
        logger.info("=" * 70)

    except ValueError as e:
        logger.error("")
        logger.error("=" * 70)
        logger.error("❌ Validation Error")
        logger.error("=" * 70)
        logger.error(f"  {str(e)}")
        logger.error("")
        logger.error("💡 Troubleshooting:")

        if "course not found" in str(e).lower():
            logger.error("  - Verify course exists in default.courses collection")
            logger.error(f"  - Check course ID spelling: {args.courseId}")
        elif "no published sow" in str(e).lower():
            logger.error("  - Ensure SOW has status='published' in Authored_SOW collection")
            logger.error("  - Draft SOWs are not supported for revision notes")
        elif "no lesson templates" in str(e).lower():
            logger.error("  - Generate lesson templates first using lesson_author agent")
        elif "already exists" in str(e).lower():
            logger.error("  - Use --force flag to overwrite existing notes")
            logger.error(f"  - Or use --version to create a new version")
        else:
            logger.error("  - Check the error message above for specific details")

        logger.error("")
        sys.exit(1)

    except Exception as e:
        logger.error("")
        logger.error("=" * 70)
        logger.error("❌ Execution Failed")
        logger.error("=" * 70)
        logger.error(f"  {str(e)}")
        logger.error("")
        logger.error("💡 Debug Steps:")
        logger.error("  1. Run with --log-level DEBUG for detailed logs")
        logger.error("  2. Use --persist-workspace to inspect workspace files")
        logger.error("  3. Check Appwrite connectivity in .mcp.json")
        logger.error("  4. Verify all infrastructure is set up:")
        logger.error("     python scripts/setup_revision_notes_infrastructure.py")
        logger.error("")

        if args.log_level == "DEBUG":
            logger.exception("Detailed traceback:")

        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
