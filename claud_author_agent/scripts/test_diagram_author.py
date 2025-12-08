#!/usr/bin/env python3
"""Test Harness for DiagramAuthorAgent.

Runs the DiagramAuthorAgent on classification files to test diagram generation.
Supports both workspace mode (existing workspace) and classification mode (new workspace from classification file).

Usage:
    # Run from classification file (non-destructive, creates new workspace)
    python scripts/test_diagram_author.py --classification test_fixtures/diagram_classifications/matplotlib/rectangle_perimeter.json

    # Run on existing workspace
    python scripts/test_diagram_author.py --workspace workspace/20251205_132351

    # Filter to specific tool types
    python scripts/test_diagram_author.py --classification path/to/file.json --tools MATPLOTLIB

    # Limit number of diagrams
    python scripts/test_diagram_author.py --classification path/to/file.json --limit 2

    # Specify output directory
    python scripts/test_diagram_author.py --classification path/to/file.json --output-dir workspace/test_runs

    # Dry run (validate setup without running agent)
    python scripts/test_diagram_author.py --classification path/to/file.json --dry-run

Examples:
    # Test all MATPLOTLIB fixtures
    python scripts/test_diagram_author.py \\
        --classification test_fixtures/diagram_classifications/matplotlib/rectangle_perimeter.json

    # Test with filtering and limit
    python scripts/test_diagram_author.py \\
        --classification test_fixtures/diagram_classifications/matplotlib/rectangle_perimeter.json \\
        --tools MATPLOTLIB \\
        --limit 1
"""

import argparse
import asyncio
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agents.diagram_author_agent import run_diagram_author
from src.tools.diagram_classifier_schema_models import DIAGRAM_CLASSIFICATION_OUTPUT_FILE
from src.utils.logging_config import setup_logging


def generate_minimal_mock_exam(classification_data: dict) -> dict:
    """Generate minimal mock_exam.json from classification data.

    Creates a mock exam structure that satisfies DiagramAuthorAgent requirements
    without needing a full mock exam file.
    """
    classifications = classification_data.get("classifications", [])

    questions = []
    for i, c in enumerate(classifications):
        question_id = c.get("question_id", f"q{i+1}")
        question_number = c.get("question_number", i + 1)
        curriculum_topic = c.get("curriculum_topic", "Mathematics")
        visualization_focus = c.get("visualization_focus", "Diagram for question")

        questions.append({
            "questionId": question_id,
            "question_id": question_id,  # Both formats for compatibility with DiagramAuthorAgent
            "question_number": question_number,
            "sectionId": "section_A",
            "question_stem": f"Question about {curriculum_topic}. {visualization_focus}",
            "question_stem_plain": f"Question about {curriculum_topic}.",
            "question_type": "short_answer",
            "marks": 2,
            "diagram_context": "cfu",
            "diagram_required": True
        })

    return {
        "examId": f"test_exam_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "courseId": "test_course",
        "version": "1",
        "title": "Test Mock Exam for Diagram Generation",
        "sections": [
            {
                "sectionId": "section_A",
                "title": "Section A",
                "total_marks": len(questions) * 2,
                "questions": questions
            }
        ],
        "summary": {
            "total_questions": len(questions),
            "total_marks": len(questions) * 2,
            "total_time_minutes": len(questions) * 2
        }
    }


def setup_workspace_from_classification(
    classification_file: Path,
    output_dir: Path,
    tools: Optional[List[str]] = None,
    limit: Optional[int] = None
) -> Path:
    """Create a new workspace from a classification file.

    Non-destructive: copies classification to new workspace directory.

    Args:
        classification_file: Path to classification JSON file
        output_dir: Base directory for test runs
        tools: Optional list of tool types to filter to
        limit: Optional limit on number of diagrams

    Returns:
        Path to the created workspace
    """
    # Read classification file
    with open(classification_file) as f:
        data = json.load(f)

    classifications = data.get("classifications", [])
    original_count = len(classifications)

    # Filter to questions needing diagrams (not NONE)
    filtered = [c for c in classifications if c.get("tool") != "NONE"]

    # Filter by specific tools if provided
    if tools:
        normalized_tools = set()
        for tool in tools:
            normalized_tools.add(tool.upper())
            # Handle IMAGEN vs IMAGE_GENERATION alias
            if tool.upper() == "IMAGE_GENERATION":
                normalized_tools.add("IMAGEN")
            if tool.upper() == "IMAGEN":
                normalized_tools.add("IMAGE_GENERATION")

        filtered = [c for c in filtered if c.get("tool", "").upper() in normalized_tools]

    # Limit count if provided
    if limit and limit > 0:
        filtered = filtered[:limit]

    if not filtered:
        raise ValueError(f"No classifications match filters (tools={tools}, limit={limit})")

    # Determine tool name for workspace directory
    tool_names = list(set(c.get("tool", "UNKNOWN") for c in filtered))
    tool_suffix = tool_names[0] if len(tool_names) == 1 else "MIXED"

    # Create workspace directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    workspace_path = output_dir / f"{timestamp}_{tool_suffix}"
    workspace_path.mkdir(parents=True, exist_ok=True)

    # Update classification data
    data["classifications"] = filtered
    data["total_questions"] = len(filtered)
    data["questions_needing_diagrams"] = len(filtered)
    data["questions_no_diagram"] = 0

    # Write classification to workspace (non-destructive copy)
    dest_classification = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
    with open(dest_classification, 'w') as f:
        json.dump(data, f, indent=2)

    # Generate and write minimal mock_exam.json
    mock_exam = generate_minimal_mock_exam(data)
    mock_exam_file = workspace_path / "mock_exam.json"
    with open(mock_exam_file, 'w') as f:
        json.dump(mock_exam, f, indent=2)

    # Create minimal sow_context.json
    sow_context = {
        "course_id": "test_course",
        "course_title": "Test Course for Diagram Generation",
        "accessibility_profile": {
            "use_plain_text": False,
            "high_contrast": False
        }
    }
    sow_context_file = workspace_path / "sow_context.json"
    with open(sow_context_file, 'w') as f:
        json.dump(sow_context, f, indent=2)

    print(f"📊 Created workspace from classification")
    print(f"   Source: {classification_file}")
    print(f"   Filtered: {original_count} → {len(filtered)} classifications")
    print(f"   Workspace: {workspace_path}")

    return workspace_path


def filter_workspace_classifications(
    workspace_path: Path,
    tools: Optional[List[str]] = None,
    limit: Optional[int] = None
) -> int:
    """Filter classifications in existing workspace by tool type and/or limit.

    WARNING: Modifies classification_output.json in place.
    Returns the number of classifications after filtering.
    """
    classification_file = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE

    if not classification_file.exists():
        raise FileNotFoundError(f"Missing: {classification_file}")

    with open(classification_file) as f:
        data = json.load(f)

    classifications = data.get("classifications", [])
    original_count = len(classifications)

    # Filter to questions needing diagrams (not NONE)
    filtered = [c for c in classifications if c.get("tool") != "NONE"]

    # Filter by specific tools if provided
    if tools:
        normalized_tools = set()
        for tool in tools:
            normalized_tools.add(tool.upper())
            if tool.upper() == "IMAGE_GENERATION":
                normalized_tools.add("IMAGEN")
            if tool.upper() == "IMAGEN":
                normalized_tools.add("IMAGE_GENERATION")

        filtered = [c for c in filtered if c.get("tool", "").upper() in normalized_tools]

    # Limit count if provided
    if limit and limit > 0:
        filtered = filtered[:limit]

    # Update data
    data["classifications"] = filtered
    data["total_questions"] = len(filtered)
    data["questions_needing_diagrams"] = len(filtered)
    data["questions_no_diagram"] = 0

    # Write back
    with open(classification_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"📊 Filtered workspace classifications: {original_count} → {len(filtered)}")

    return len(filtered)


def show_workspace_info(workspace_path: Path) -> None:
    """Display information about the workspace."""
    print(f"\n📁 Workspace: {workspace_path}")

    # Check required files
    classification_file = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
    mock_exam_file = workspace_path / "mock_exam.json"
    sow_context_file = workspace_path / "sow_context.json"

    for name, path in [
        ("classification_output.json", classification_file),
        ("mock_exam.json", mock_exam_file),
        ("sow_context.json", sow_context_file)
    ]:
        status = "✅" if path.exists() else "❌"
        print(f"   {status} {name}")

    # Show classification summary
    if classification_file.exists():
        with open(classification_file) as f:
            data = json.load(f)

        classifications = data.get("classifications", [])
        tool_counts = {}
        for c in classifications:
            tool = c.get("tool", "UNKNOWN")
            tool_counts[tool] = tool_counts.get(tool, 0) + 1

        print(f"\n   Tool distribution ({len(classifications)} total):")
        for tool, count in sorted(tool_counts.items()):
            print(f"      {tool}: {count}")


async def run_test(workspace_path: Path, log_level: str = "INFO") -> dict:
    """Run the DiagramAuthorAgent on the workspace.

    Returns:
        Dict with test results for reporting
    """
    setup_logging(log_level=log_level)

    print("\n" + "=" * 60)
    print("DIAGRAM AUTHOR AGENT TEST")
    print("=" * 60)

    result = await run_diagram_author(workspace_path=workspace_path)

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Success: {result.success}")
    print(f"Total diagrams: {result.total_diagrams}")
    print(f"Generated: {result.diagrams_generated}")
    print(f"Failed: {result.diagrams_failed}")

    # Build test report
    test_report = {
        "workspace": str(workspace_path),
        "timestamp": datetime.now().isoformat(),
        "success": result.success,
        "total_diagrams": result.total_diagrams,
        "diagrams_generated": result.diagrams_generated,
        "diagrams_failed": result.diagrams_failed,
        "results": []
    }

    if result.results:
        print("\nDiagram Details:")
        for dr in result.results:
            status = "✅" if dr.success else "❌"
            print(f"  {status} {dr.question_id} ({dr.tool})")

            result_entry = {
                "question_id": dr.question_id,
                "tool": dr.tool,
                "success": dr.success,
            }

            if dr.success:
                print(f"      Score: {dr.final_score:.2f}")
                print(f"      Iterations: {dr.iterations}")
                if dr.image_path:
                    print(f"      Image: {dr.image_path}")
                result_entry["final_score"] = dr.final_score
                result_entry["iterations"] = dr.iterations
                result_entry["image_path"] = dr.image_path
            else:
                print(f"      Error: {dr.error}")
                result_entry["error"] = dr.error

            test_report["results"].append(result_entry)

    if result.manifest_path:
        print(f"\nManifest: {result.manifest_path}")

    # List generated files
    diagrams_dir = workspace_path / "diagrams"
    if diagrams_dir.exists():
        diagram_files = list(diagrams_dir.glob("*.png"))
        print(f"\nGenerated diagrams ({len(diagram_files)}):")
        for df in diagram_files:
            print(f"  📷 {df.name}")

    # Calculate summary statistics
    if test_report["results"]:
        successful = [r for r in test_report["results"] if r.get("success")]
        if successful:
            test_report["average_score"] = sum(r.get("final_score", 0) for r in successful) / len(successful)
            test_report["average_iterations"] = sum(r.get("iterations", 0) for r in successful) / len(successful)

    # Write test report
    report_file = workspace_path / "test_report.json"
    with open(report_file, 'w') as f:
        json.dump(test_report, f, indent=2)
    print(f"\nTest report: {report_file}")

    print("=" * 60)

    return test_report


def main():
    parser = argparse.ArgumentParser(
        description="Test DiagramAuthorAgent with classification files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Input source (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--classification", "-c",
        type=Path,
        help="Path to classification JSON file (creates new workspace, non-destructive)"
    )
    input_group.add_argument(
        "--workspace", "-w",
        type=Path,
        help="Path to existing workspace directory (may modify in place)"
    )

    # Output and filtering options
    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=Path("workspace/test_runs"),
        help="Base directory for test run workspaces (default: workspace/test_runs)"
    )

    parser.add_argument(
        "--tools", "-t",
        nargs="+",
        choices=["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "IMAGEN"],
        help="Filter to specific tool types"
    )

    parser.add_argument(
        "--limit", "-l",
        type=int,
        help="Limit number of diagrams to generate"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate setup without running agent"
    )

    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()

    # Determine workspace path based on input mode
    if args.classification:
        # Classification mode: create new workspace (non-destructive)
        if not args.classification.exists():
            print(f"❌ Classification file not found: {args.classification}")
            sys.exit(1)

        try:
            workspace_path = setup_workspace_from_classification(
                classification_file=args.classification,
                output_dir=args.output_dir,
                tools=args.tools,
                limit=args.limit
            )
        except ValueError as e:
            print(f"❌ {e}")
            sys.exit(1)
    else:
        # Workspace mode: use existing workspace
        workspace_path = args.workspace

        if not workspace_path.exists():
            print(f"❌ Workspace not found: {workspace_path}")
            sys.exit(1)

        classification_file = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
        if not classification_file.exists():
            print(f"❌ Missing {DIAGRAM_CLASSIFICATION_OUTPUT_FILE} in workspace")
            sys.exit(1)

        # Apply filters if specified (modifies workspace in place - legacy behavior)
        if args.tools or args.limit:
            print("\n⚠️  Warning: Filtering modifies workspace in place. Use --classification for non-destructive mode.")
            count = filter_workspace_classifications(
                workspace_path,
                tools=args.tools,
                limit=args.limit
            )
            if count == 0:
                print("❌ No classifications match the filter criteria")
                sys.exit(1)

    # Show workspace info
    show_workspace_info(workspace_path)

    if args.dry_run:
        print("\n🔍 DRY RUN: Setup validated, skipping agent execution")
        print(f"   Workspace ready at: {workspace_path}")
        sys.exit(0)

    # Run the test
    try:
        asyncio.run(run_test(
            workspace_path=workspace_path,
            log_level=args.log_level
        ))
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
