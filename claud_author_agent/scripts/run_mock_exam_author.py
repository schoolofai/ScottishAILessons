#!/usr/bin/env python3
"""CLI script to run the Mock Exam Author pipeline.

Usage:
    python scripts/run_mock_exam_author.py --course course_c84473
    python scripts/run_mock_exam_author.py --course course_c84473 --version 2 --force
    python scripts/run_mock_exam_author.py --course course_c84473 --dry-run
    python scripts/run_mock_exam_author.py --course course_c84473 --log-level INFO

Pipeline Steps:
    1. PRE-PROCESSING: Extract data, verify services
    2. AUTHOR-CRITIC: Generate mock exam with quality iteration
    3. CLASSIFICATION: Classify questions for diagram tools
    4. DIAGRAM AUTHORING: Generate diagrams with iterative critique
    5. UPSERT: Save to Appwrite database

FAIL-FAST: Each step must succeed. Pipeline stops on first failure.
LOGGING: Uses DEBUG level by default for maximum verbosity.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Run the Mock Exam Author pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Dry run (generate but don't save to Appwrite)
    python scripts/run_mock_exam_author.py --course course_c84473 --dry-run

    # Full run with force overwrite
    python scripts/run_mock_exam_author.py --course course_c84473 --version 2 --force

    # Quiet mode (less verbose)
    python scripts/run_mock_exam_author.py --course course_c84473 --log-level INFO
        """
    )

    parser.add_argument(
        "--course", "-c",
        required=True,
        help="Course ID (e.g., 'course_c84473')"
    )

    parser.add_argument(
        "--version", "-v",
        default="1",
        help="Mock exam version (default: '1')"
    )

    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force overwrite existing mock exam for this version"
    )

    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Generate mock exam but don't save to Appwrite"
    )

    parser.add_argument(
        "--log-level", "-l",
        default="DEBUG",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: DEBUG for maximum verbosity)"
    )

    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to MCP configuration file (default: .mcp.json)"
    )

    parser.add_argument(
        "--no-persist",
        action="store_true",
        help="Don't persist workspace after execution (clean up)"
    )

    parser.add_argument(
        "--output", "-o",
        help="Path to write result JSON (optional)"
    )

    return parser.parse_args()


async def run_pipeline(args):
    """Execute the mock exam author pipeline."""
    from src.mock_exam_author_claude_client_v2 import MockExamAuthorClaudeAgentV2

    # Initialize pipeline
    print("=" * 80)
    print("MOCK EXAM AUTHOR PIPELINE")
    print("=" * 80)
    print(f"Course ID: {args.course}")
    print(f"Version: {args.version}")
    print(f"Force: {args.force}")
    print(f"Dry Run: {args.dry_run}")
    print(f"Log Level: {args.log_level}")
    print(f"Persist Workspace: {not args.no_persist}")
    print("=" * 80)

    agent = MockExamAuthorClaudeAgentV2(
        mcp_config_path=args.mcp_config,
        persist_workspace=not args.no_persist,
        log_level=args.log_level
    )

    try:
        result = await agent.execute(
            courseId=args.course,
            version=args.version,
            force=args.force,
            dry_run=args.dry_run
        )

        # Write result to file if requested
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump(result, f, indent=2, default=str)
            print(f"\nResult written to: {output_path}")

        return result

    except RuntimeError as e:
        print(f"\n❌ PIPELINE FAILED (FAIL-FAST): {e}")
        return {
            "success": False,
            "error": str(e),
            "execution_id": agent.execution_id
        }


def print_result(result):
    """Print formatted pipeline result."""
    print("\n" + "=" * 80)
    print("PIPELINE EXECUTION RESULT")
    print("=" * 80)

    if result.get("success"):
        print("✅ SUCCESS")
        print(f"   Execution ID: {result['execution_id']}")
        print(f"   Workspace: {result['workspace_path']}")
        print(f"   Mock Exam ID: {result['mock_exam_id']}")
        print(f"   Appwrite Document: {result.get('appwrite_document_id', 'N/A (dry_run)')}")

        if 'pipeline_metrics' in result:
            metrics = result['pipeline_metrics']
            print(f"\n📊 Pipeline Metrics:")
            print(f"   Total Duration: {metrics['total_duration_seconds']:.2f}s")
            print(f"   Total Messages: {metrics['total_messages']}")
            print(f"\n   Step Breakdown:")
            for step in metrics.get('steps', []):
                status = "✅" if step['success'] else "❌"
                print(f"      {status} {step['name']}: {step['duration_seconds']:.2f}s")
                if step.get('details'):
                    for key, value in step['details'].items():
                        if key not in ['skipped']:
                            print(f"         {key}: {value}")

        if 'diagram_metrics' in result:
            diagrams = result['diagram_metrics']
            print(f"\n🎨 Diagram Metrics:")
            print(f"   Questions Classified: {diagrams['questions_classified']}")
            print(f"   Questions Needing Diagrams: {diagrams['questions_needing_diagrams']}")
            print(f"   Diagrams Generated: {diagrams['diagrams_generated']}")
            print(f"   Diagrams Failed: {diagrams['diagrams_failed']}")

    else:
        print(f"❌ FAILED")
        print(f"   Execution ID: {result.get('execution_id', 'N/A')}")
        print(f"   Error: {result.get('error', 'Unknown error')}")
        if result.get('workspace_path'):
            print(f"   Workspace: {result['workspace_path']} (preserved for debugging)")

    print("=" * 80)


def main():
    """Main entry point."""
    args = parse_args()

    # Run the pipeline
    result = asyncio.run(run_pipeline(args))

    # Print formatted result
    print_result(result)

    # Exit with appropriate code
    if result.get("success"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
