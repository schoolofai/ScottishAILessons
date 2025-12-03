"""CLI interface for Diagram Author Nano.

Usage:
    python -m src.diagram_author_nano_cli --courseId course_xxx --order 1

Options:
    --courseId      Course ID (required)
    --order         Lesson order 1-indexed (required)
    --card-order    Single card mode (optional)
    --persist       Keep workspace after execution (default: True)
    --log-level     DEBUG|INFO|WARNING|ERROR (default: INFO)
    --raw           Enable raw unbuffered output to console
    --log-file      Log file name (always written to workspace, default: run_log.txt)

All outputs including log files are written to the workspace directory:
    workspace/nano_exec_YYYYMMDD_HHMMSS/
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from .diagram_author_nano_client import DiagramAuthorNanoAgent
from .utils.gemini_client import get_gemini_config


def setup_dual_logging(log_level: str, log_file_path: Path) -> logging.Logger:
    """Set up logging to both console and file.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file_path: Path to log file

    Returns:
        Configured root logger
    """
    # Get numeric log level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Clear existing handlers
    root_logger.handlers = []

    # Console handler - unbuffered
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(console_formatter)
    # Force unbuffered output
    console_handler.stream = sys.stdout
    root_logger.addHandler(console_handler)

    # File handler - detailed
    log_file_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_file_path, mode='w')
    file_handler.setLevel(logging.DEBUG)  # Always capture everything to file
    file_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(file_handler)

    return root_logger


class TeeOutput:
    """Tee stdout/stderr to both console and file."""

    def __init__(self, file_path: Path, stream=sys.stdout):
        self.file = open(file_path, 'a')
        self.stream = stream
        self.encoding = getattr(stream, 'encoding', 'utf-8')

    def write(self, data):
        self.stream.write(data)
        self.stream.flush()
        self.file.write(data)
        self.file.flush()

    def flush(self):
        self.stream.flush()
        self.file.flush()

    def close(self):
        self.file.close()


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Diagram Author Nano - Gemini-based diagram generation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Generate diagrams for all eligible cards in lesson 1
    python -m src.diagram_author_nano_cli --courseId course_abc123 --order 1

    # Generate diagram for a single card (card 2)
    python -m src.diagram_author_nano_cli --courseId course_abc123 --order 1 --card-order 2

    # Run with debug logging
    python -m src.diagram_author_nano_cli --courseId course_abc123 --order 1 --log-level DEBUG

Environment Variables:
    GEMINI_API_KEY              Required - Gemini API key from Google AI Studio
    GEMINI_IMAGE_MODEL          Optional - Model ID (default: gemini-2.5-flash-image)
    GEMINI_IMAGE_ASPECT_RATIO   Optional - Aspect ratio (default: 16:9)
    GEMINI_IMAGE_SIZE           Optional - Image size (default: 2K)
"""
    )

    # Required arguments
    parser.add_argument(
        "--courseId",
        required=True,
        help="Course ID to process (e.g., course_abc123)"
    )
    parser.add_argument(
        "--order",
        type=int,
        required=True,
        help="Lesson order within course (1-indexed)"
    )

    # Optional arguments
    parser.add_argument(
        "--card-order",
        type=int,
        default=None,
        help="Single card to process (1-indexed, optional)"
    )
    parser.add_argument(
        "--persist",
        action="store_true",
        default=True,
        help="Keep workspace after execution (default: True)"
    )
    parser.add_argument(
        "--no-persist",
        action="store_false",
        dest="persist",
        help="Delete workspace after execution"
    )
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP configuration file (default: .mcp.json)"
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        default=False,
        help="Enable raw unbuffered output to console (for real-time monitoring)"
    )
    parser.add_argument(
        "--log-file",
        default=None,
        help="Log file name (always written to workspace, default: run_log.txt)"
    )

    args = parser.parse_args()

    # Validate arguments
    if args.order < 1:
        parser.error("--order must be >= 1")
    if args.card_order is not None and args.card_order < 1:
        parser.error("--card-order must be >= 1")

    # Enable raw unbuffered mode if requested
    if args.raw:
        # Force unbuffered stdout/stderr
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__
        # Set environment for subprocess unbuffered output
        import os
        os.environ['PYTHONUNBUFFERED'] = '1'

    # Print banner (flush immediately in raw mode)
    def log_print(msg: str):
        print(msg, flush=args.raw)

    log_print("=" * 60)
    log_print("🎨 Diagram Author Nano - Gemini Image Generation")
    log_print("=" * 60)
    log_print(f"  Course ID: {args.courseId}")
    log_print(f"  Lesson Order: {args.order}")
    if args.card_order:
        log_print(f"  Card Order: {args.card_order}")
    log_print(f"  Log Level: {args.log_level}")
    log_print(f"  Persist Workspace: {args.persist}")
    log_print(f"  Raw Output: {args.raw}")
    log_print("-" * 60)
    # Display Gemini configuration
    gemini_config = get_gemini_config()
    log_print(f"  Gemini Model: {gemini_config['model']}")
    log_print(f"  Aspect Ratio: {gemini_config['aspect_ratio']}")
    log_print(f"  Image Size: {gemini_config['image_size']}")
    log_print("=" * 60)

    # Create agent
    agent = DiagramAuthorNanoAgent(
        mcp_config_path=args.mcp_config,
        persist_workspace=args.persist,
        log_level=args.log_level
    )

    # ═══════════════════════════════════════════════════════════════
    # Create workspace directory for logs (agent will use same path via IsolatedFilesystem)
    # All logs go to workspace directory regardless of --log-file argument
    # ═══════════════════════════════════════════════════════════════
    workspace_dir = Path.cwd() / "workspace" / f"nano_{agent.execution_id}"
    workspace_dir.mkdir(parents=True, exist_ok=True)

    log_print(f"  Workspace: {workspace_dir}")
    log_print("=" * 60)

    # Set up logging - always write to workspace directory
    if args.log_file:
        # User-specified log file goes to workspace
        log_file_path = workspace_dir / Path(args.log_file).name
    else:
        log_file_path = workspace_dir / "run_log.txt"

    # Set up dual logging (console + file)
    logger = setup_dual_logging(args.log_level, log_file_path)
    logger.info(f"Logging to: {log_file_path}")

    # Also tee stdout/stderr to the log file for raw output capture
    tee_stdout = TeeOutput(log_file_path, sys.stdout)
    tee_stderr = TeeOutput(log_file_path, sys.stderr)
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = tee_stdout
    sys.stderr = tee_stderr

    # Run execution
    exit_code = 0
    try:
        result = asyncio.run(
            agent.execute(
                courseId=args.courseId,
                order=args.order,
                card_order=args.card_order
            )
        )

        # Print summary
        print("\n" + "=" * 60, flush=True)
        print("📊 EXECUTION SUMMARY", flush=True)
        print("=" * 60, flush=True)
        print(f"  Success: {'✅ Yes' if result.get('success') else '❌ No'}", flush=True)
        print(f"  Diagrams Created: {result.get('diagrams_generated', 0)}", flush=True)
        print(f"  Diagrams Failed: {result.get('diagrams_failed', 0)}", flush=True)
        print(f"  Execution ID: {result.get('execution_id', 'N/A')}", flush=True)
        if result.get("workspace_path"):
            print(f"  Workspace: {result['workspace_path']}", flush=True)
        print(f"  Log File: {log_file_path}", flush=True)

        if result.get("error"):
            print(f"\n❌ Error: {result['error']}", flush=True)

        if result.get("errors"):
            print("\n⚠️  Errors:", flush=True)
            for error in result["errors"]:
                if isinstance(error, dict):
                    print(f"    - {error.get('cardId', 'N/A')}: {error.get('error', 'Unknown error')}", flush=True)
                else:
                    print(f"    - {error}", flush=True)

        print("=" * 60, flush=True)

        exit_code = 0 if result.get("success") else 1

    except KeyboardInterrupt:
        print("\n\n⚠️  Execution cancelled by user", flush=True)
        exit_code = 130

    except Exception as e:
        import traceback
        print(f"\n❌ Execution failed: {e}", flush=True)
        print(f"\n📋 Full traceback:", flush=True)
        traceback.print_exc()
        logger.exception(f"Execution failed: {e}")
        exit_code = 1

    finally:
        # Restore original stdout/stderr and close tee files
        sys.stdout = original_stdout
        sys.stderr = original_stderr
        tee_stdout.close()
        tee_stderr.close()
        print(f"\n📝 Full log saved to: {log_file_path}", flush=True)

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
