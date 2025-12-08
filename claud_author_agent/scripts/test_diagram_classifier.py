#!/usr/bin/env python3
"""Test Harness for DiagramClassifierAgent.

Runs the DiagramClassifierAgent on mock exam fixtures to test classification accuracy.
Supports both single fixture testing and comparison against expected classifications.

Usage:
    # Run from fixture file (creates new workspace)
    python scripts/test_diagram_classifier.py --fixture test_fixtures/classifier_inputs/mixed_topics.json

    # Run on existing workspace with mock_exam.json
    python scripts/test_diagram_classifier.py --workspace workspace/20251205_132351

    # Dry run (validate setup without running agent)
    python scripts/test_diagram_classifier.py --fixture path/to/file.json --dry-run

    # Specify custom model
    python scripts/test_diagram_classifier.py --fixture path/to/file.json --model claude-sonnet-4-5

Examples:
    # Test classification on geometry questions
    python scripts/test_diagram_classifier.py \\
        --fixture test_fixtures/classifier_inputs/geometry_questions.json

    # Test with expected classifications validation
    python scripts/test_diagram_classifier.py \\
        --fixture test_fixtures/classifier_inputs/geometry_questions.json \\
        --expected test_fixtures/classifier_expected/geometry_expected.json
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agents.diagram_classifier_agent import DiagramClassifierAgent
from src.tools.diagram_classifier_schema_models import (
    DiagramClassificationResult,
    DIAGRAM_CLASSIFICATION_OUTPUT_FILE
)
from src.utils.logging_config import setup_logging, add_workspace_file_handler


def setup_workspace_from_fixture(
    fixture_file: Path,
    output_dir: Path
) -> Path:
    """Create a new workspace from a classifier fixture file.

    The fixture should contain:
    - mock_exam: Mock exam data with questions
    - sow_context: Course metadata
    - expected_classifications (optional): Expected tool assignments for validation

    Args:
        fixture_file: Path to classifier fixture JSON file
        output_dir: Base directory for test runs

    Returns:
        Path to the created workspace
    """
    # Read fixture file
    with open(fixture_file) as f:
        data = json.load(f)

    # Validate required fields
    if "mock_exam" not in data:
        raise ValueError(f"Fixture missing required 'mock_exam' field: {fixture_file}")

    # Create workspace directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    fixture_name = fixture_file.stem
    workspace_path = output_dir / f"classifier_{timestamp}_{fixture_name}"
    workspace_path.mkdir(parents=True, exist_ok=True)

    # Write mock_exam.json
    mock_exam_file = workspace_path / "mock_exam.json"
    with open(mock_exam_file, 'w') as f:
        json.dump(data["mock_exam"], f, indent=2)

    # Write sow_context.json (use from fixture or generate minimal)
    sow_context = data.get("sow_context", {
        "subject": "mathematics",
        "level": "national-5",
        "course_id": "test_course",
        "course_title": "Test Course for Classification"
    })
    sow_context_file = workspace_path / "sow_context.json"
    with open(sow_context_file, 'w') as f:
        json.dump(sow_context, f, indent=2)

    # Write expected classifications if provided (for validation)
    if "expected_classifications" in data:
        expected_file = workspace_path / "expected_classifications.json"
        with open(expected_file, 'w') as f:
            json.dump(data["expected_classifications"], f, indent=2)

    # Copy fixture metadata
    if "_fixture_metadata" in data:
        metadata_file = workspace_path / "fixture_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(data["_fixture_metadata"], f, indent=2)

    # Count questions
    question_count = 0
    for section in data["mock_exam"].get("sections", []):
        question_count += len(section.get("questions", []))

    print(f"📊 Created workspace from fixture")
    print(f"   Source: {fixture_file}")
    print(f"   Questions: {question_count}")
    print(f"   Workspace: {workspace_path}")

    return workspace_path


def show_workspace_info(workspace_path: Path) -> None:
    """Display information about the workspace."""
    print(f"\n📁 Workspace: {workspace_path}")

    # Check required files
    mock_exam_file = workspace_path / "mock_exam.json"
    sow_context_file = workspace_path / "sow_context.json"
    expected_file = workspace_path / "expected_classifications.json"

    for name, path in [
        ("mock_exam.json", mock_exam_file),
        ("sow_context.json", sow_context_file),
        ("expected_classifications.json (optional)", expected_file)
    ]:
        status = "✅" if path.exists() else "⚠️" if "optional" in name else "❌"
        print(f"   {status} {name}")

    # Show question summary
    if mock_exam_file.exists():
        with open(mock_exam_file) as f:
            data = json.load(f)

        question_count = 0
        topics = set()
        for section in data.get("sections", []):
            for question in section.get("questions", []):
                question_count += 1
                # Extract topic if available
                standards = question.get("standards_addressed", [])
                if standards:
                    topics.add(standards[0].get("description", "Unknown")[:30])

        print(f"\n   Question count: {question_count}")
        if topics:
            print(f"   Topics: {', '.join(list(topics)[:5])}")


def compare_classifications(
    actual: DiagramClassificationResult,
    expected_file: Path
) -> Dict[str, Any]:
    """Compare actual classifications against expected.

    Returns comparison results with accuracy metrics.
    """
    with open(expected_file) as f:
        expected_data = json.load(f)

    expected_by_id = {
        e.get("question_id"): e.get("expected_tool")
        for e in expected_data.get("expected", [])
    }

    matches = 0
    mismatches = []
    total = len(actual.classifications)

    for classification in actual.classifications:
        qid = classification.question_id
        actual_tool = classification.tool

        if qid in expected_by_id:
            expected_tool = expected_by_id[qid]
            if actual_tool == expected_tool:
                matches += 1
            else:
                mismatches.append({
                    "question_id": qid,
                    "expected": expected_tool,
                    "actual": actual_tool,
                    "reasoning": classification.reasoning.summary
                })

    accuracy = (matches / total * 100) if total > 0 else 0

    return {
        "total": total,
        "matches": matches,
        "mismatches": len(mismatches),
        "accuracy": accuracy,
        "mismatch_details": mismatches
    }


async def run_classifier_test(
    workspace_path: Path,
    model: str = "claude-sonnet-4-5",
    max_turns: int = 20,
    log_level: str = "INFO"
) -> Dict[str, Any]:
    """Run the DiagramClassifierAgent on the workspace.

    Returns:
        Dict with test results for reporting
    """
    setup_logging(log_level=log_level)

    # Add workspace file logging
    log_file = add_workspace_file_handler(
        workspace_path=workspace_path,
        log_filename="classifier_run.log",
        log_level="DEBUG"
    )
    print(f"📝 Logging to: {log_file}")

    print("\n" + "=" * 60)
    print("DIAGRAM CLASSIFIER AGENT TEST")
    print("=" * 60)

    start_time = datetime.now()

    # Create and run agent
    agent = DiagramClassifierAgent(
        workspace_path=workspace_path,
        model=model,
        max_turns=max_turns
    )

    result = await agent.execute()
    duration = (datetime.now() - start_time).total_seconds()

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Success: {result['success']}")
    print(f"Total Questions: {result['classification_result'].total_questions}")
    print(f"Need Diagrams: {result['questions_needing_diagrams']}")
    print(f"No Diagram: {result['classification_result'].questions_no_diagram}")
    print(f"Messages: {result['message_count']}")
    print(f"Duration: {duration:.1f}s")

    # Build test report
    classification_result: DiagramClassificationResult = result["classification_result"]

    test_report = {
        "workspace": str(workspace_path),
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "success": result["success"],
        "total_questions": classification_result.total_questions,
        "questions_needing_diagrams": classification_result.questions_needing_diagrams,
        "questions_no_diagram": classification_result.questions_no_diagram,
        "message_count": result["message_count"],
        "duration_seconds": duration,
        "tool_distribution": {},
        "classifications": []
    }

    # Calculate tool distribution
    tool_counts: Dict[str, int] = {}
    for c in classification_result.classifications:
        tool_counts[c.tool] = tool_counts.get(c.tool, 0) + 1
        test_report["classifications"].append({
            "question_id": c.question_id,
            "question_number": c.question_number,
            "tool": c.tool,
            "confidence": c.confidence,
            "reasoning_summary": c.reasoning.summary,
            "curriculum_topic": c.curriculum_topic
        })

    test_report["tool_distribution"] = tool_counts

    print("\n📊 Tool Distribution:")
    for tool, count in sorted(tool_counts.items()):
        pct = count / classification_result.total_questions * 100
        print(f"   {tool}: {count} ({pct:.0f}%)")

    # Show classification details
    print("\n📋 Classifications:")
    for c in classification_result.classifications[:10]:  # Show first 10
        confidence_icon = "🟢" if c.confidence == "HIGH" else "🟡" if c.confidence == "MEDIUM" else "🔴"
        print(f"   {confidence_icon} {c.question_id}: {c.tool} - {c.reasoning.summary[:50]}")

    if len(classification_result.classifications) > 10:
        print(f"   ... and {len(classification_result.classifications) - 10} more")

    # Check for expected classifications
    expected_file = workspace_path / "expected_classifications.json"
    if expected_file.exists():
        print("\n🎯 Comparing against expected classifications...")
        comparison = compare_classifications(classification_result, expected_file)
        test_report["comparison"] = comparison

        print(f"   Accuracy: {comparison['accuracy']:.1f}%")
        print(f"   Matches: {comparison['matches']}/{comparison['total']}")

        if comparison["mismatch_details"]:
            print(f"\n⚠️  Mismatches ({len(comparison['mismatch_details'])}):")
            for m in comparison["mismatch_details"][:5]:
                print(f"   {m['question_id']}: expected {m['expected']}, got {m['actual']}")
            if len(comparison["mismatch_details"]) > 5:
                print(f"   ... and {len(comparison['mismatch_details']) - 5} more")

    # Write test report
    report_file = workspace_path / "classifier_test_report.json"
    with open(report_file, 'w') as f:
        json.dump(test_report, f, indent=2)
    print(f"\n📄 Test report: {report_file}")

    print("=" * 60)

    return test_report


def main():
    parser = argparse.ArgumentParser(
        description="Test DiagramClassifierAgent with mock exam fixtures",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Input source (mutually exclusive)
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--fixture", "-f",
        type=Path,
        help="Path to classifier fixture JSON file (creates new workspace)"
    )
    input_group.add_argument(
        "--workspace", "-w",
        type=Path,
        help="Path to existing workspace directory with mock_exam.json"
    )

    # Output and options
    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=Path("workspace/classifier_test_runs"),
        help="Base directory for test run workspaces (default: workspace/classifier_test_runs)"
    )

    parser.add_argument(
        "--expected", "-e",
        type=Path,
        help="Path to expected classifications JSON for validation"
    )

    parser.add_argument(
        "--model", "-m",
        default="claude-sonnet-4-5",
        help="Claude model to use (default: claude-sonnet-4-5)"
    )

    parser.add_argument(
        "--max-turns",
        type=int,
        default=20,
        help="Maximum agent turns (default: 20)"
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
    if args.fixture:
        # Fixture mode: create new workspace
        if not args.fixture.exists():
            print(f"❌ Fixture file not found: {args.fixture}")
            sys.exit(1)

        try:
            workspace_path = setup_workspace_from_fixture(
                fixture_file=args.fixture,
                output_dir=args.output_dir
            )
        except ValueError as e:
            print(f"❌ {e}")
            sys.exit(1)

        # Copy expected classifications if provided separately
        if args.expected and args.expected.exists():
            import shutil
            dest = workspace_path / "expected_classifications.json"
            shutil.copy(args.expected, dest)
            print(f"   📋 Copied expected classifications")

    else:
        # Workspace mode: use existing workspace
        workspace_path = args.workspace

        if not workspace_path.exists():
            print(f"❌ Workspace not found: {workspace_path}")
            sys.exit(1)

        mock_exam_file = workspace_path / "mock_exam.json"
        if not mock_exam_file.exists():
            print(f"❌ Missing mock_exam.json in workspace")
            sys.exit(1)

    # Show workspace info
    show_workspace_info(workspace_path)

    if args.dry_run:
        print("\n🔍 DRY RUN: Setup validated, skipping agent execution")
        print(f"   Workspace ready at: {workspace_path}")
        sys.exit(0)

    # Run the test
    try:
        report = asyncio.run(run_classifier_test(
            workspace_path=workspace_path,
            model=args.model,
            max_turns=args.max_turns,
            log_level=args.log_level
        ))

        # Exit with error if comparison failed
        if "comparison" in report and report["comparison"]["accuracy"] < 80:
            print(f"\n⚠️  Accuracy below threshold (80%): {report['comparison']['accuracy']:.1f}%")
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
