"""Command-Line Interface for Revision Notes Author Agent.

Provides easy-to-use CLI for generating revision notes from lessons.
Supports both session-based and template-based generation with export options.
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path

from .revision_notes_claude_client import RevisionNotesAuthorClaudeAgent


def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Generate revision notes for Scottish secondary education lessons",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate from session (with evidence)
  python -m src.revision_notes_cli --sessionId session_abc123 --export-format both

  # Generate from lesson template
  python -m src.revision_notes_cli --lessonTemplateId lesson_template_xyz789

  # Export markdown only
  python -m src.revision_notes_cli --lessonTemplateId lesson_123 --export-format markdown

  # Interactive mode
  python -m src.revision_notes_cli
        """
    )

    # Input mode group (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        '--sessionId',
        type=str,
        help='Session ID (for session-based generation with evidence)'
    )
    input_group.add_argument(
        '--lessonTemplateId',
        type=str,
        help='Lesson template ID (for template-based generation)'
    )

    # Export options
    parser.add_argument(
        '--export-format',
        type=str,
        choices=['markdown', 'pdf', 'both'],
        default='both',
        help='Export format (default: both)'
    )

    # Configuration
    parser.add_argument(
        '--mcp-config',
        type=str,
        default='.mcp.json',
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

    return parser.parse_args()


async def interactive_mode():
    """Run in interactive mode, prompting user for input."""
    print("=" * 70)
    print("Revision Notes Author - Interactive Mode")
    print("=" * 70)
    print()

    # Ask for input mode
    print("Generation Mode:")
    print("  1. Session-based (with student evidence)")
    print("  2. Template-based (generic)")
    print()

    mode_choice = input("Select mode (1 or 2): ").strip()

    sessionId = None
    lessonTemplateId = None

    if mode_choice == "1":
        sessionId = input("Enter session ID: ").strip()
        if not sessionId:
            print("Error: Session ID cannot be empty")
            sys.exit(1)
    elif mode_choice == "2":
        lessonTemplateId = input("Enter lesson template ID: ").strip()
        if not lessonTemplateId:
            print("Error: Lesson template ID cannot be empty")
            sys.exit(1)
    else:
        print("Error: Invalid choice")
        sys.exit(1)

    # Ask for export format
    print()
    print("Export Format:")
    print("  1. Markdown only")
    print("  2. PDF only")
    print("  3. Both (default)")
    print()

    export_choice = input("Select format (1, 2, or 3): ").strip()
    export_format_map = {
        "1": "markdown",
        "2": "pdf",
        "3": "both",
        "": "both"  # Default
    }
    export_format = export_format_map.get(export_choice, "both")

    # Configuration
    mcp_config = input("MCP config path (default: .mcp.json): ").strip() or ".mcp.json"

    persist_choice = input("Persist workspace for debugging? (Y/n): ").strip().lower()
    persist_workspace = persist_choice != "n"

    print()
    print("=" * 70)
    print("Configuration Summary")
    print("=" * 70)
    print(f"Mode: {'Session-based' if sessionId else 'Template-based'}")
    print(f"ID: {sessionId or lessonTemplateId}")
    print(f"Export Format: {export_format}")
    print(f"MCP Config: {mcp_config}")
    print(f"Persist Workspace: {persist_workspace}")
    print("=" * 70)
    print()

    proceed = input("Proceed with generation? (Y/n): ").strip().lower()
    if proceed == "n":
        print("Cancelled.")
        sys.exit(0)

    return {
        "sessionId": sessionId,
        "lessonTemplateId": lessonTemplateId,
        "export_format": export_format,
        "mcp_config_path": mcp_config,
        "persist_workspace": persist_workspace,
        "log_level": "INFO"
    }


async def run_agent(config: dict):
    """Run the revision notes author agent with given configuration.

    Args:
        config: Configuration dictionary with agent parameters

    Returns:
        Result dictionary from agent execution
    """
    agent = RevisionNotesAuthorClaudeAgent(
        mcp_config_path=config.get("mcp_config_path", ".mcp.json"),
        persist_workspace=config.get("persist_workspace", True),
        log_level=config.get("log_level", "INFO")
    )

    result = await agent.execute(
        lessonTemplateId=config.get("lessonTemplateId"),
        sessionId=config.get("sessionId"),
        export_format=config.get("export_format", "both")
    )

    return result


def print_result(result: dict):
    """Print result summary in user-friendly format.

    Args:
        result: Result dictionary from agent execution
    """
    print()
    print("=" * 70)
    if result["success"]:
        print("✓ Revision Notes Generated Successfully!")
        print("=" * 70)
        print()
        print(f"Execution ID:  {result['execution_id']}")
        print(f"Document ID:   {result['appwrite_document_id']}")
        print(f"Workspace:     {result['workspace_path']}")
        print()

        if result.get("markdown_path"):
            print(f"📄 Markdown:   {result['markdown_path']}")
        if result.get("pdf_path"):
            print(f"📕 PDF:        {result['pdf_path']}")

        print()
        metrics = result.get("metrics", {})
        if metrics:
            print("Cost Summary:")
            print(f"  Total Cost: ${metrics.get('total_cost_usd', 0):.4f}")
            print(f"  Input Tokens:  {metrics.get('input_tokens', 0):,}")
            print(f"  Output Tokens: {metrics.get('output_tokens', 0):,}")

    else:
        print("✗ Revision Notes Generation Failed")
        print("=" * 70)
        print()
        print(f"Error: {result.get('error', 'Unknown error')}")
        print()
        print(f"Execution ID: {result['execution_id']}")

    print("=" * 70)


async def main():
    """Main entry point for CLI."""
    args = parse_arguments()

    # Check if running in interactive mode
    if not args.sessionId and not args.lessonTemplateId:
        # No arguments provided - run interactive mode
        config = await interactive_mode()
    else:
        # Arguments provided - use them
        config = {
            "sessionId": args.sessionId,
            "lessonTemplateId": args.lessonTemplateId,
            "export_format": args.export_format,
            "mcp_config_path": args.mcp_config,
            "persist_workspace": not args.no_persist_workspace,
            "log_level": args.log_level
        }

    # Run agent
    print()
    print("Starting revision notes generation...")
    print()

    result = await run_agent(config)

    # Print result
    print_result(result)

    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nCancelled by user.")
        sys.exit(130)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
