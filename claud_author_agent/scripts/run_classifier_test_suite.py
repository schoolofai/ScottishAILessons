#!/usr/bin/env python3
"""Multi-Fixture Test Suite Runner for DiagramClassifierAgent.

Discovers and runs all classifier input fixtures through the DiagramClassifierAgent,
collecting results and generating summary reports for classification accuracy analysis.

Usage:
    # Run all fixtures
    python scripts/run_classifier_test_suite.py

    # Run only fixtures in a specific category
    python scripts/run_classifier_test_suite.py --category geometry

    # Run specific fixture file
    python scripts/run_classifier_test_suite.py --fixture test_fixtures/classifier_inputs/geometry_basic.json

    # Dry run (validate fixtures only)
    python scripts/run_classifier_test_suite.py --dry-run

    # Run with verbose output
    python scripts/run_classifier_test_suite.py --log-level DEBUG

Examples:
    # Test all fixtures and generate report
    python scripts/run_classifier_test_suite.py

    # Test only algebra-related fixtures
    python scripts/run_classifier_test_suite.py --category algebra

    # Validate fixture setup without running agent
    python scripts/run_classifier_test_suite.py --dry-run
"""

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agents.diagram_classifier_agent import DiagramClassifierAgent
from src.tools.diagram_classifier_schema_models import (
    DiagramClassificationResult,
    DIAGRAM_CLASSIFICATION_OUTPUT_FILE
)
from src.utils.logging_config import setup_logging, add_workspace_file_handler, remove_workspace_file_handler


# Default directories
FIXTURES_DIR = Path(__file__).parent.parent / "test_fixtures" / "classifier_inputs"
OUTPUT_DIR = Path(__file__).parent.parent / "workspace" / "classifier_test_runs"


@dataclass
class FixtureInfo:
    """Information about a discovered classifier fixture."""
    path: Path
    name: str
    category: str  # e.g., "geometry", "algebra", "statistics"
    description: str = ""
    question_count: int = 0
    has_expected: bool = False


@dataclass
class FixtureResult:
    """Result from running classification on a single fixture."""
    fixture: FixtureInfo
    workspace_path: Path
    success: bool
    total_questions: int = 0
    questions_needing_diagrams: int = 0
    questions_no_diagram: int = 0
    tool_distribution: Dict[str, int] = field(default_factory=dict)
    accuracy: Optional[float] = None  # If expected classifications provided
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    message_count: int = 0


@dataclass
class TestSuiteResult:
    """Aggregated results from running multiple fixtures."""
    timestamp: str
    total_fixtures: int = 0
    fixtures_passed: int = 0
    fixtures_failed: int = 0
    total_questions: int = 0
    total_needing_diagrams: int = 0
    overall_tool_distribution: Dict[str, int] = field(default_factory=dict)
    average_accuracy: Optional[float] = None
    results_by_category: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    fixture_results: List[FixtureResult] = field(default_factory=list)
    duration_seconds: float = 0.0


def discover_fixtures(
    fixtures_dir: Path = FIXTURES_DIR,
    category_filter: Optional[str] = None,
    fixture_path: Optional[Path] = None
) -> List[FixtureInfo]:
    """Discover all classifier fixture files.

    Fixtures are organized by category subdirectories:
    - classifier_inputs/geometry/
    - classifier_inputs/algebra/
    - classifier_inputs/statistics/
    - etc.

    Args:
        fixtures_dir: Base directory containing category subdirectories
        category_filter: Optional category name to filter by
        fixture_path: Optional specific fixture file to use

    Returns:
        List of FixtureInfo objects
    """
    fixtures = []

    if fixture_path:
        # Use specific fixture
        if not fixture_path.exists():
            raise FileNotFoundError(f"Fixture not found: {fixture_path}")

        with open(fixture_path) as f:
            data = json.load(f)

        if "mock_exam" not in data:
            raise ValueError(f"Fixture missing 'mock_exam' field: {fixture_path}")

        # Count questions
        question_count = 0
        for section in data["mock_exam"].get("sections", []):
            question_count += len(section.get("questions", []))

        # Determine category from path or metadata
        category = fixture_path.parent.name if fixture_path.parent.name != "classifier_inputs" else "general"
        metadata = data.get("_fixture_metadata", {})

        fixtures.append(FixtureInfo(
            path=fixture_path,
            name=fixture_path.stem,
            category=metadata.get("category", category),
            description=metadata.get("description", ""),
            question_count=question_count,
            has_expected="expected_classifications" in data
        ))
        return fixtures

    # Discover all fixtures in directory
    if not fixtures_dir.exists():
        raise FileNotFoundError(f"Fixtures directory not found: {fixtures_dir}")

    # Check for flat structure (fixtures directly in classifier_inputs/)
    for fixture_file in sorted(fixtures_dir.glob("*.json")):
        fixtures.extend(_parse_fixture_file(fixture_file, "general", category_filter))

    # Check for category subdirectories
    for category_dir in sorted(fixtures_dir.iterdir()):
        if not category_dir.is_dir():
            continue

        category_name = category_dir.name

        # Apply category filter if specified
        if category_filter and category_name.lower() != category_filter.lower():
            continue

        for fixture_file in sorted(category_dir.glob("*.json")):
            fixtures.extend(_parse_fixture_file(fixture_file, category_name, category_filter))

    return fixtures


def _parse_fixture_file(
    fixture_file: Path,
    category: str,
    category_filter: Optional[str]
) -> List[FixtureInfo]:
    """Parse a single fixture file and return FixtureInfo if valid."""
    try:
        with open(fixture_file) as f:
            data = json.load(f)

        if "mock_exam" not in data:
            print(f"⚠️  Skipping {fixture_file}: missing 'mock_exam' field")
            return []

        # Count questions
        question_count = 0
        for section in data["mock_exam"].get("sections", []):
            question_count += len(section.get("questions", []))

        if question_count == 0:
            print(f"⚠️  Skipping {fixture_file}: no questions")
            return []

        metadata = data.get("_fixture_metadata", {})
        fixture_category = metadata.get("category", category)

        # Apply category filter
        if category_filter and fixture_category.lower() != category_filter.lower():
            return []

        return [FixtureInfo(
            path=fixture_file,
            name=fixture_file.stem,
            category=fixture_category,
            description=metadata.get("description", ""),
            question_count=question_count,
            has_expected="expected_classifications" in data
        )]

    except (json.JSONDecodeError, KeyError) as e:
        print(f"⚠️  Skipping invalid fixture {fixture_file}: {e}")
        return []


def setup_workspace_from_fixture(fixture: FixtureInfo, suite_workspace: Path) -> Path:
    """Create a workspace from a fixture file within a suite workspace.

    Args:
        fixture: FixtureInfo object
        suite_workspace: Suite workspace directory

    Returns:
        Path to the created fixture workspace
    """
    with open(fixture.path) as f:
        data = json.load(f)

    # Create fixture workspace
    workspace_name = f"fixture_{fixture.category}_{fixture.name}"
    workspace_path = suite_workspace / workspace_name
    workspace_path.mkdir(parents=True, exist_ok=True)

    # Write mock_exam.json
    mock_exam_file = workspace_path / "mock_exam.json"
    with open(mock_exam_file, 'w') as f:
        json.dump(data["mock_exam"], f, indent=2)

    # Write sow_context.json
    sow_context = data.get("sow_context", {
        "subject": "mathematics",
        "level": "national-5",
        "course_id": "test_course"
    })
    sow_context_file = workspace_path / "sow_context.json"
    with open(sow_context_file, 'w') as f:
        json.dump(sow_context, f, indent=2)

    # Write expected classifications if present
    if "expected_classifications" in data:
        expected_file = workspace_path / "expected_classifications.json"
        with open(expected_file, 'w') as f:
            json.dump(data["expected_classifications"], f, indent=2)

    return workspace_path


def compare_classifications(
    result: DiagramClassificationResult,
    expected_file: Path
) -> Dict[str, Any]:
    """Compare actual classifications against expected."""
    with open(expected_file) as f:
        expected_data = json.load(f)

    expected_by_id = {
        e.get("question_id"): e.get("expected_tool")
        for e in expected_data.get("expected", [])
    }

    matches = 0
    total = 0
    mismatches = []

    for c in result.classifications:
        if c.question_id in expected_by_id:
            total += 1
            if c.tool == expected_by_id[c.question_id]:
                matches += 1
            else:
                mismatches.append({
                    "question_id": c.question_id,
                    "expected": expected_by_id[c.question_id],
                    "actual": c.tool
                })

    accuracy = (matches / total * 100) if total > 0 else None

    return {
        "total_compared": total,
        "matches": matches,
        "accuracy": accuracy,
        "mismatches": mismatches
    }


async def run_fixture(
    fixture: FixtureInfo,
    suite_workspace: Path,
    model: str = "claude-sonnet-4-5",
    max_turns: int = 20
) -> FixtureResult:
    """Run the DiagramClassifierAgent on a single fixture.

    Args:
        fixture: FixtureInfo object
        suite_workspace: Suite workspace directory
        model: Claude model to use
        max_turns: Maximum agent turns

    Returns:
        FixtureResult with test outcomes
    """
    start_time = datetime.now()

    workspace_path = setup_workspace_from_fixture(fixture, suite_workspace)

    # Add workspace logging
    log_file = add_workspace_file_handler(workspace_path, log_filename="classifier_run.log", log_level="DEBUG")
    print(f"   📝 Logging to: {log_file}")

    try:
        agent = DiagramClassifierAgent(
            workspace_path=workspace_path,
            model=model,
            max_turns=max_turns
        )

        result = await agent.execute()
        classification_result: DiagramClassificationResult = result["classification_result"]

        # Calculate tool distribution
        tool_dist: Dict[str, int] = {}
        for c in classification_result.classifications:
            tool_dist[c.tool] = tool_dist.get(c.tool, 0) + 1

        # Check accuracy if expected classifications exist
        accuracy = None
        expected_file = workspace_path / "expected_classifications.json"
        if expected_file.exists():
            comparison = compare_classifications(classification_result, expected_file)
            accuracy = comparison.get("accuracy")

        duration = (datetime.now() - start_time).total_seconds()

        fixture_result = FixtureResult(
            fixture=fixture,
            workspace_path=workspace_path,
            success=result["success"],
            total_questions=classification_result.total_questions,
            questions_needing_diagrams=classification_result.questions_needing_diagrams,
            questions_no_diagram=classification_result.questions_no_diagram,
            tool_distribution=tool_dist,
            accuracy=accuracy,
            errors=[],
            duration_seconds=duration,
            message_count=result["message_count"]
        )

    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        fixture_result = FixtureResult(
            fixture=fixture,
            workspace_path=workspace_path,
            success=False,
            errors=[str(e)],
            duration_seconds=duration
        )

    finally:
        remove_workspace_file_handler(workspace_path)

    return fixture_result


async def run_test_suite(
    fixtures_dir: Path = FIXTURES_DIR,
    output_dir: Path = OUTPUT_DIR,
    category_filter: Optional[str] = None,
    fixture_path: Optional[Path] = None,
    model: str = "claude-sonnet-4-5",
    max_turns: int = 20,
    dry_run: bool = False,
    log_level: str = "INFO"
) -> TestSuiteResult:
    """Run the complete classifier test suite.

    Args:
        fixtures_dir: Directory containing fixture files
        output_dir: Directory for test run outputs
        category_filter: Optional category to filter by
        fixture_path: Optional specific fixture file
        model: Claude model to use
        max_turns: Maximum agent turns
        dry_run: If True, validate without running agent
        log_level: Logging level

    Returns:
        TestSuiteResult with aggregated outcomes
    """
    setup_logging(log_level=log_level)
    start_time = datetime.now()

    print("\n" + "=" * 70)
    print("DIAGRAM CLASSIFIER TEST SUITE")
    print("=" * 70)

    fixtures = discover_fixtures(fixtures_dir, category_filter, fixture_path)

    if not fixtures:
        print("❌ No fixtures found")
        return TestSuiteResult(timestamp=start_time.isoformat())

    print(f"\n📋 Discovered {len(fixtures)} fixture(s):")
    for f in fixtures:
        expected_marker = " 🎯" if f.has_expected else ""
        print(f"   • [{f.category}] {f.name} ({f.question_count} questions){expected_marker}")

    if dry_run:
        print("\n🔍 DRY RUN: Fixtures validated, skipping agent execution")
        return TestSuiteResult(
            timestamp=start_time.isoformat(),
            total_fixtures=len(fixtures)
        )

    # Create suite workspace
    output_dir.mkdir(parents=True, exist_ok=True)
    category_suffix = category_filter.upper() if category_filter else "ALL"
    suite_name = f"classifier_suite_{start_time.strftime('%Y%m%d_%H%M%S')}_{category_suffix}"
    suite_workspace = output_dir / suite_name
    suite_workspace.mkdir(parents=True, exist_ok=True)

    # Add suite-level logging
    suite_log = add_workspace_file_handler(suite_workspace, log_filename="suite_run.log", log_level="DEBUG")
    print(f"\n📁 Suite workspace: {suite_workspace}")
    print(f"📝 Suite log: {suite_log}")

    results: List[FixtureResult] = []

    for i, fixture in enumerate(fixtures, 1):
        print(f"\n{'─' * 70}")
        print(f"[{i}/{len(fixtures)}] Running: [{fixture.category}] {fixture.name}")
        print(f"{'─' * 70}")

        result = await run_fixture(fixture, suite_workspace, model, max_turns)
        results.append(result)

        # Print result summary
        if result.success:
            accuracy_str = f", accuracy: {result.accuracy:.0f}%" if result.accuracy is not None else ""
            print(f"   ✅ PASSED: {result.total_questions} questions classified{accuracy_str}")
            print(f"   📊 Tool distribution: {dict(sorted(result.tool_distribution.items()))}")
        else:
            print(f"   ❌ FAILED")
            for error in result.errors[:3]:
                print(f"      • {error}")

    # Aggregate results
    suite_result = TestSuiteResult(
        timestamp=start_time.isoformat(),
        total_fixtures=len(fixtures),
        fixtures_passed=sum(1 for r in results if r.success),
        fixtures_failed=sum(1 for r in results if not r.success),
        total_questions=sum(r.total_questions for r in results),
        total_needing_diagrams=sum(r.questions_needing_diagrams for r in results),
        fixture_results=results,
        duration_seconds=(datetime.now() - start_time).total_seconds()
    )

    # Aggregate tool distribution
    overall_tools: Dict[str, int] = {}
    for r in results:
        for tool, count in r.tool_distribution.items():
            overall_tools[tool] = overall_tools.get(tool, 0) + count
    suite_result.overall_tool_distribution = overall_tools

    # Calculate average accuracy (only from fixtures with expected classifications)
    accuracies = [r.accuracy for r in results if r.accuracy is not None]
    if accuracies:
        suite_result.average_accuracy = sum(accuracies) / len(accuracies)

    # Calculate per-category statistics
    category_stats: Dict[str, Dict[str, Any]] = {}
    for r in results:
        cat = r.fixture.category
        if cat not in category_stats:
            category_stats[cat] = {
                "fixtures": 0,
                "passed": 0,
                "questions": 0,
                "accuracies": []
            }
        category_stats[cat]["fixtures"] += 1
        category_stats[cat]["passed"] += 1 if r.success else 0
        category_stats[cat]["questions"] += r.total_questions
        if r.accuracy is not None:
            category_stats[cat]["accuracies"].append(r.accuracy)

    for cat, stats in category_stats.items():
        if stats["accuracies"]:
            stats["average_accuracy"] = sum(stats["accuracies"]) / len(stats["accuracies"])
        del stats["accuracies"]

    suite_result.results_by_category = category_stats

    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUITE SUMMARY")
    print("=" * 70)

    print(f"\n📊 Overall Results:")
    print(f"   Fixtures: {suite_result.fixtures_passed}/{suite_result.total_fixtures} passed")
    print(f"   Total questions classified: {suite_result.total_questions}")
    print(f"   Questions needing diagrams: {suite_result.total_needing_diagrams}")
    if suite_result.average_accuracy is not None:
        print(f"   Average accuracy: {suite_result.average_accuracy:.1f}%")
    print(f"   Duration: {suite_result.duration_seconds:.1f}s")

    print(f"\n📈 Tool Distribution (all fixtures):")
    for tool, count in sorted(overall_tools.items()):
        pct = count / suite_result.total_questions * 100 if suite_result.total_questions > 0 else 0
        print(f"   {tool}: {count} ({pct:.0f}%)")

    print(f"\n📁 Results by Category:")
    for cat, stats in sorted(category_stats.items()):
        acc_str = f", avg accuracy: {stats.get('average_accuracy', 0):.0f}%" if "average_accuracy" in stats else ""
        print(f"   {cat}: {stats['passed']}/{stats['fixtures']} passed, {stats['questions']} questions{acc_str}")

    # Write suite report
    report_path = suite_workspace / "classifier_suite_report.json"
    report_data = {
        "timestamp": suite_result.timestamp,
        "model": model,
        "total_fixtures": suite_result.total_fixtures,
        "fixtures_passed": suite_result.fixtures_passed,
        "fixtures_failed": suite_result.fixtures_failed,
        "total_questions": suite_result.total_questions,
        "total_needing_diagrams": suite_result.total_needing_diagrams,
        "average_accuracy": suite_result.average_accuracy,
        "overall_tool_distribution": suite_result.overall_tool_distribution,
        "results_by_category": suite_result.results_by_category,
        "duration_seconds": suite_result.duration_seconds,
        "fixture_results": [
            {
                "fixture": {
                    "path": str(r.fixture.path),
                    "name": r.fixture.name,
                    "category": r.fixture.category,
                    "question_count": r.fixture.question_count,
                    "has_expected": r.fixture.has_expected
                },
                "workspace_path": str(r.workspace_path),
                "success": r.success,
                "total_questions": r.total_questions,
                "questions_needing_diagrams": r.questions_needing_diagrams,
                "tool_distribution": r.tool_distribution,
                "accuracy": r.accuracy,
                "errors": r.errors,
                "duration_seconds": r.duration_seconds,
                "message_count": r.message_count
            }
            for r in results
        ]
    }

    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2)

    print(f"\n📄 Suite report: {report_path}")
    print("=" * 70)

    remove_workspace_file_handler(suite_workspace)

    return suite_result


def main():
    parser = argparse.ArgumentParser(
        description="Run DiagramClassifierAgent test suite on multiple fixtures",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "--fixtures-dir",
        type=Path,
        default=FIXTURES_DIR,
        help=f"Directory containing fixture files (default: {FIXTURES_DIR})"
    )

    parser.add_argument(
        "--output-dir", "-o",
        type=Path,
        default=OUTPUT_DIR,
        help=f"Directory for test run outputs (default: {OUTPUT_DIR})"
    )

    parser.add_argument(
        "--category", "-c",
        help="Run only fixtures in specific category (e.g., geometry, algebra)"
    )

    parser.add_argument(
        "--fixture", "-f",
        type=Path,
        help="Run specific fixture file"
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
        help="Validate fixtures without running agent"
    )

    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()

    try:
        result = asyncio.run(run_test_suite(
            fixtures_dir=args.fixtures_dir,
            output_dir=args.output_dir,
            category_filter=args.category,
            fixture_path=args.fixture,
            model=args.model,
            max_turns=args.max_turns,
            dry_run=args.dry_run,
            log_level=args.log_level
        ))

        # Exit with error code if any fixtures failed
        if result.fixtures_failed > 0:
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
