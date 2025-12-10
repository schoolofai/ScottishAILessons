#!/usr/bin/env python3
"""Run the section-based mock exam author pipeline.

Alternative to run_mock_exam_author.py that uses section-by-section generation
for better scaling with large exams.

Usage:
    python scripts/run_mock_exam_author_sectioned.py --course course_c74774
    python scripts/run_mock_exam_author_sectioned.py --course course_c74774 --sequential
    python scripts/run_mock_exam_author_sectioned.py --course course_c74774 --dry-run
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.mock_exam_author_sectioned import MockExamAuthorSectioned


async def main():
    parser = argparse.ArgumentParser(
        description="Generate mock exam using section-based pipeline"
    )
    parser.add_argument(
        "--course", "-c",
        required=True,
        help="Course ID (e.g., course_c74774)"
    )
    parser.add_argument(
        "--version", "-v",
        default="1",
        help="Mock exam version (default: 1)"
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Generate sections sequentially instead of in parallel"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate but don't upsert to Appwrite"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing mock exam"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)"
    )
    parser.add_argument(
        "--output", "-o",
        default="results_sectioned.json",
        help="Output file for results (default: results_sectioned.json)"
    )

    args = parser.parse_args()

    print("=" * 80)
    print("MOCK EXAM AUTHOR - SECTION-BASED PIPELINE")
    print("=" * 80)
    print(f"Course ID: {args.course}")
    print(f"Version: {args.version}")
    print(f"Parallel: {not args.sequential}")
    print(f"Dry Run: {args.dry_run}")
    print(f"Log Level: {args.log_level}")
    print("=" * 80)

    agent = MockExamAuthorSectioned(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level=args.log_level,
        parallel_sections=not args.sequential
    )

    try:
        result = await agent.execute(
            courseId=args.course,
            version=args.version,
            force=args.force,
            dry_run=args.dry_run
        )

        # Save results
        output_path = Path(args.output)
        with open(output_path, 'w') as f:
            # Convert Path objects to strings for JSON
            serializable_result = json.loads(
                json.dumps(result, default=str)
            )
            json.dump(serializable_result, f, indent=2)
        print(f"\n✅ Results saved to {output_path}")

        # Print summary
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)

        if result["success"]:
            metrics = result["pipeline_metrics"]
            print(f"✅ SUCCESS")
            print(f"   Execution ID: {result['execution_id']}")
            print(f"   Workspace: {result['workspace_path']}")
            print(f"   Mock Exam ID: {result['mock_exam_id']}")
            print(f"   Duration: {metrics['total_duration_seconds']:.2f}s")
            print(f"   Sections Generated: {metrics['sections_generated']}")
            print(f"   Parallel: {metrics['parallel_generation']}")
            print(f"   Total Messages: {metrics['total_messages']}")

            diagram_metrics = result.get("diagram_metrics", {})
            print(f"\nDiagrams:")
            print(f"   Questions needing diagrams: {diagram_metrics.get('questions_needing_diagrams', 0)}")
            print(f"   Diagrams generated: {diagram_metrics.get('diagrams_generated', 0)}")
        else:
            print(f"❌ FAILED")

        print("=" * 80)
        return 0

    except Exception as e:
        print(f"\n❌ PIPELINE FAILED: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
