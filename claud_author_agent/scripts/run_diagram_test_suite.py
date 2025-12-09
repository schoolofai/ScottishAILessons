#!/usr/bin/env python3
"""Multi-Stimulus Test Suite Runner for DiagramAuthorAgent.

Discovers and runs all diagram classification fixtures through the DiagramAuthorAgent,
collecting results and generating summary reports for fine-tuning analysis.

Usage:
    # Run all fixtures
    python scripts/run_diagram_test_suite.py

    # Run only MATPLOTLIB fixtures
    python scripts/run_diagram_test_suite.py --tool MATPLOTLIB

    # Run specific fixture file
    python scripts/run_diagram_test_suite.py --fixture test_fixtures/diagram_classifications/desmos/quadratic_functions.json

    # Dry run (validate fixtures only)
    python scripts/run_diagram_test_suite.py --dry-run

    # Run with verbose output
    python scripts/run_diagram_test_suite.py --log-level DEBUG

Examples:
    # Test all fixtures and generate report
    python scripts/run_diagram_test_suite.py

    # Test only PLOTLY diagrams
    python scripts/run_diagram_test_suite.py --tool PLOTLY

    # Validate fixture setup without running agent
    python scripts/run_diagram_test_suite.py --dry-run
"""

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables from .env file
load_dotenv()

from src.agents.diagram_author_agent import run_diagram_author
from src.tools.diagram_classifier_schema_models import DIAGRAM_CLASSIFICATION_OUTPUT_FILE
from src.utils.logging_config import setup_logging, add_workspace_file_handler, remove_workspace_file_handler


# Default fixtures directory
FIXTURES_DIR = Path(__file__).parent.parent / "test_fixtures" / "diagram_classifications"
OUTPUT_DIR = Path(__file__).parent.parent / "workspace" / "test_runs"


@dataclass
class FixtureInfo:
    """Information about a discovered fixture."""
    path: Path
    tool: str
    name: str
    description: str = ""
    difficulty: str = "unknown"
    classification_count: int = 0


@dataclass
class FixtureResult:
    """Result from running a single fixture."""
    fixture: FixtureInfo
    workspace_path: Path
    success: bool
    total_diagrams: int = 0
    diagrams_generated: int = 0
    diagrams_failed: int = 0
    average_score: Optional[float] = None
    average_iterations: Optional[float] = None
    errors: List[str] = field(default_factory=list)
    duration_seconds: float = 0.0


@dataclass
class TestSuiteResult:
    """Aggregated results from running multiple fixtures."""
    timestamp: str
    total_fixtures: int = 0
    fixtures_passed: int = 0
    fixtures_failed: int = 0
    total_diagrams: int = 0
    diagrams_generated: int = 0
    diagrams_failed: int = 0
    results_by_tool: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    fixture_results: List[FixtureResult] = field(default_factory=list)
    duration_seconds: float = 0.0


def discover_fixtures(
    fixtures_dir: Path = FIXTURES_DIR,
    tool_filter: Optional[str] = None,
    fixture_path: Optional[Path] = None
) -> List[FixtureInfo]:
    """Discover all fixture files in the fixtures directory.

    Args:
        fixtures_dir: Base directory containing tool subdirectories
        tool_filter: Optional tool name to filter by
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

        classifications = data.get("classifications", [])
        if not classifications:
            raise ValueError(f"No classifications in fixture: {fixture_path}")

        # Determine tool from classifications
        tools = list(set(c.get("tool", "UNKNOWN") for c in classifications))
        tool = tools[0] if len(tools) == 1 else "MIXED"

        metadata = data.get("_fixture_metadata", {})
        fixtures.append(FixtureInfo(
            path=fixture_path,
            tool=tool,
            name=fixture_path.stem,
            description=metadata.get("description", ""),
            difficulty=metadata.get("difficulty", "unknown"),
            classification_count=len(classifications)
        ))
        return fixtures

    # Discover all fixtures in directory
    if not fixtures_dir.exists():
        raise FileNotFoundError(f"Fixtures directory not found: {fixtures_dir}")

    for tool_dir in sorted(fixtures_dir.iterdir()):
        if not tool_dir.is_dir():
            continue

        tool_name = tool_dir.name.upper()

        # Apply tool filter if specified
        if tool_filter:
            filter_upper = tool_filter.upper()
            # Handle IMAGEN/IMAGE_GENERATION alias
            if filter_upper in ("IMAGEN", "IMAGE_GENERATION"):
                if tool_name not in ("IMAGEN", "IMAGE_GENERATION"):
                    continue
            elif tool_name != filter_upper:
                continue

        for fixture_file in sorted(tool_dir.glob("*.json")):
            try:
                with open(fixture_file) as f:
                    data = json.load(f)

                classifications = data.get("classifications", [])
                if not classifications:
                    continue

                metadata = data.get("_fixture_metadata", {})
                fixtures.append(FixtureInfo(
                    path=fixture_file,
                    tool=tool_name,
                    name=fixture_file.stem,
                    description=metadata.get("description", ""),
                    difficulty=metadata.get("difficulty", "unknown"),
                    classification_count=len(classifications)
                ))
            except (json.JSONDecodeError, KeyError) as e:
                print(f"⚠️  Skipping invalid fixture {fixture_file}: {e}")

    return fixtures


def setup_workspace_from_fixture(fixture: FixtureInfo, suite_workspace: Path) -> Path:
    """Create a workspace from a fixture file within a suite workspace.

    Args:
        fixture: FixtureInfo object
        suite_workspace: Suite workspace directory (all fixtures share this parent)

    Returns:
        Path to the created fixture workspace
    """
    # Read fixture
    with open(fixture.path) as f:
        data = json.load(f)

    classifications = data.get("classifications", [])

    # Create fixture workspace as subdirectory of suite workspace
    # This keeps all fixtures for a test run in one parent folder
    workspace_name = f"fixture_{fixture.tool}_{fixture.name}"
    workspace_path = suite_workspace / workspace_name
    workspace_path.mkdir(parents=True, exist_ok=True)

    # Generate timestamp for mock exam ID
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Copy classification data (remove metadata field)
    classification_data = {k: v for k, v in data.items() if not k.startswith("_")}
    dest_classification = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
    with open(dest_classification, 'w') as f:
        json.dump(classification_data, f, indent=2)

    # Generate minimal mock_exam.json
    questions = []
    for i, c in enumerate(classifications):
        question_id = c.get("question_id", f"q{i+1}")
        question_number = c.get("question_number", i + 1)
        curriculum_topic = c.get("curriculum_topic", "Mathematics")
        visualization_focus = c.get("visualization_focus", "Diagram for question")

        questions.append({
            "questionId": question_id,
            "question_id": question_id,  # Both formats for compatibility
            "question_number": question_number,
            "sectionId": "section_A",
            "question_stem": f"Question about {curriculum_topic}. {visualization_focus}",
            "question_stem_plain": f"Question about {curriculum_topic}.",
            "question_type": "short_answer",
            "marks": 2,
            "diagram_context": "cfu",
            "diagram_required": True
        })

    mock_exam = {
        "examId": f"test_exam_{timestamp}",
        "courseId": "test_course",
        "version": "1",
        "title": f"Test Exam - {fixture.name}",
        "sections": [{
            "sectionId": "section_A",
            "title": "Section A",
            "total_marks": len(questions) * 2,
            "questions": questions
        }],
        "summary": {
            "total_questions": len(questions),
            "total_marks": len(questions) * 2,
            "total_time_minutes": len(questions) * 2
        }
    }

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

    return workspace_path


async def run_fixture(fixture: FixtureInfo, suite_workspace: Path) -> FixtureResult:
    """Run the DiagramAuthorAgent on a single fixture.

    Args:
        fixture: FixtureInfo object
        suite_workspace: Suite workspace directory (parent for all fixtures)

    Returns:
        FixtureResult with test outcomes
    """
    start_time = datetime.now()

    # Setup workspace as subdirectory of suite workspace
    workspace_path = setup_workspace_from_fixture(fixture, suite_workspace)

    # Add workspace-specific logging for detailed debugging
    log_file = add_workspace_file_handler(workspace_path, log_filename="agent_run.log", log_level="DEBUG")
    print(f"   📝 Logging to: {log_file}")

    try:
        # Get API key from environment or use default development key
        import os
        api_key = os.environ.get("DIAGRAM_SCREENSHOT_API_KEY", "dev-api-key-change-in-production")

        # Run diagram author
        result = await run_diagram_author(
            workspace_path=workspace_path,
            rendering_api_key=api_key
        )

        # Calculate statistics
        # NOTE: DiagramAuthorResult uses 'diagrams' not 'results',
        # and 'successful_diagrams'/'failed_diagrams' not 'diagrams_generated'/'diagrams_failed'
        average_score = None
        average_iterations = None

        if result.diagrams:
            successful = [r for r in result.diagrams if r.success]
            if successful:
                average_score = sum(r.final_score for r in successful) / len(successful)
                average_iterations = sum(r.iterations for r in successful) / len(successful)

        errors = []
        for r in (result.diagrams or []):
            if not r.success and r.error:
                errors.append(f"{r.question_id}: {r.error}")

        duration = (datetime.now() - start_time).total_seconds()

        fixture_result = FixtureResult(
            fixture=fixture,
            workspace_path=workspace_path,
            success=result.success,
            total_diagrams=result.total_diagrams,
            diagrams_generated=result.successful_diagrams,
            diagrams_failed=result.failed_diagrams,
            average_score=average_score,
            average_iterations=average_iterations,
            errors=errors,
            duration_seconds=duration
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
        # Clean up workspace logging handler
        remove_workspace_file_handler(workspace_path)

    return fixture_result


async def run_test_suite(
    fixtures_dir: Path = FIXTURES_DIR,
    output_dir: Path = OUTPUT_DIR,
    tool_filter: Optional[str] = None,
    fixture_path: Optional[Path] = None,
    dry_run: bool = False,
    log_level: str = "INFO"
) -> TestSuiteResult:
    """Run the complete test suite.

    Args:
        fixtures_dir: Directory containing fixture files
        output_dir: Directory for test run outputs
        tool_filter: Optional tool name to filter by
        fixture_path: Optional specific fixture file
        dry_run: If True, validate without running agent
        log_level: Logging level

    Returns:
        TestSuiteResult with aggregated outcomes
    """
    setup_logging(log_level=log_level)
    start_time = datetime.now()

    # Discover fixtures
    print("\n" + "=" * 70)
    print("DIAGRAM AUTHOR TEST SUITE")
    print("=" * 70)

    fixtures = discover_fixtures(fixtures_dir, tool_filter, fixture_path)

    if not fixtures:
        print("❌ No fixtures found")
        return TestSuiteResult(timestamp=start_time.isoformat())

    print(f"\n📋 Discovered {len(fixtures)} fixture(s):")
    for f in fixtures:
        print(f"   • {f.tool}/{f.name} ({f.classification_count} classifications)")

    if dry_run:
        print("\n🔍 DRY RUN: Fixtures validated, skipping agent execution")
        return TestSuiteResult(
            timestamp=start_time.isoformat(),
            total_fixtures=len(fixtures)
        )

    # Create single suite workspace directory for all fixtures
    # Structure: output_dir/suite_{timestamp}_{tool_filter}/fixture_*
    output_dir.mkdir(parents=True, exist_ok=True)

    tool_suffix = tool_filter.upper() if tool_filter else "ALL"
    suite_name = f"suite_{start_time.strftime('%Y%m%d_%H%M%S')}_{tool_suffix}"
    suite_workspace = output_dir / suite_name
    suite_workspace.mkdir(parents=True, exist_ok=True)

    # Add suite-level logging
    suite_log_file = add_workspace_file_handler(suite_workspace, log_filename="suite_run.log", log_level="DEBUG")

    print(f"\n📁 Suite workspace: {suite_workspace}")
    print(f"📝 Suite log: {suite_log_file}")

    results: List[FixtureResult] = []

    for i, fixture in enumerate(fixtures, 1):
        print(f"\n{'─' * 70}")
        print(f"[{i}/{len(fixtures)}] Running: {fixture.tool}/{fixture.name}")
        print(f"{'─' * 70}")

        result = await run_fixture(fixture, suite_workspace)
        results.append(result)

        # Print result summary
        if result.success:
            score_str = f"{result.average_score:.2f}" if result.average_score else "N/A"
            print(f"   ✅ PASSED: {result.diagrams_generated}/{result.total_diagrams} diagrams (score: {score_str})")
        else:
            print(f"   ❌ FAILED: {result.diagrams_generated}/{result.total_diagrams} diagrams")
            for error in result.errors[:3]:  # Show first 3 errors
                print(f"      • {error}")

    # Aggregate results
    suite_result = TestSuiteResult(
        timestamp=start_time.isoformat(),
        total_fixtures=len(fixtures),
        fixtures_passed=sum(1 for r in results if r.success),
        fixtures_failed=sum(1 for r in results if not r.success),
        total_diagrams=sum(r.total_diagrams for r in results),
        diagrams_generated=sum(r.diagrams_generated for r in results),
        diagrams_failed=sum(r.diagrams_failed for r in results),
        fixture_results=results,
        duration_seconds=(datetime.now() - start_time).total_seconds()
    )

    # Calculate per-tool statistics
    tool_stats: Dict[str, Dict[str, Any]] = {}
    for result in results:
        tool = result.fixture.tool
        if tool not in tool_stats:
            tool_stats[tool] = {
                "fixtures": 0,
                "passed": 0,
                "failed": 0,
                "diagrams": 0,
                "generated": 0,
                "scores": []
            }

        tool_stats[tool]["fixtures"] += 1
        tool_stats[tool]["passed"] += 1 if result.success else 0
        tool_stats[tool]["failed"] += 0 if result.success else 1
        tool_stats[tool]["diagrams"] += result.total_diagrams
        tool_stats[tool]["generated"] += result.diagrams_generated
        if result.average_score:
            tool_stats[tool]["scores"].append(result.average_score)

    # Calculate average scores per tool
    for tool, stats in tool_stats.items():
        if stats["scores"]:
            stats["average_score"] = sum(stats["scores"]) / len(stats["scores"])
            stats["success_rate"] = (stats["generated"] / stats["diagrams"] * 100) if stats["diagrams"] > 0 else 0
        del stats["scores"]  # Remove raw scores

    suite_result.results_by_tool = tool_stats

    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUITE SUMMARY")
    print("=" * 70)

    print(f"\n📊 Overall Results:")
    print(f"   Fixtures: {suite_result.fixtures_passed}/{suite_result.total_fixtures} passed")
    print(f"   Diagrams: {suite_result.diagrams_generated}/{suite_result.total_diagrams} generated")
    print(f"   Duration: {suite_result.duration_seconds:.1f}s")

    print(f"\n📈 Results by Tool:")
    for tool, stats in sorted(tool_stats.items()):
        success_rate = stats.get("success_rate", 0)
        avg_score = stats.get("average_score", 0)
        status = "✅" if success_rate >= 80 else "⚠️" if success_rate >= 50 else "❌"
        print(f"   {status} {tool}: {stats['generated']}/{stats['diagrams']} ({success_rate:.0f}%), avg score: {avg_score:.2f}")

    # Write suite report to suite workspace (not output_dir)
    report_path = suite_workspace / "suite_report.json"

    # Convert to serializable format
    report_data = {
        "timestamp": suite_result.timestamp,
        "total_fixtures": suite_result.total_fixtures,
        "fixtures_passed": suite_result.fixtures_passed,
        "fixtures_failed": suite_result.fixtures_failed,
        "total_diagrams": suite_result.total_diagrams,
        "diagrams_generated": suite_result.diagrams_generated,
        "diagrams_failed": suite_result.diagrams_failed,
        "duration_seconds": suite_result.duration_seconds,
        "results_by_tool": suite_result.results_by_tool,
        "fixture_results": [
            {
                "fixture": {
                    "path": str(r.fixture.path),
                    "tool": r.fixture.tool,
                    "name": r.fixture.name,
                    "description": r.fixture.description,
                    "classification_count": r.fixture.classification_count
                },
                "workspace_path": str(r.workspace_path),
                "success": r.success,
                "total_diagrams": r.total_diagrams,
                "diagrams_generated": r.diagrams_generated,
                "diagrams_failed": r.diagrams_failed,
                "average_score": r.average_score,
                "average_iterations": r.average_iterations,
                "errors": r.errors,
                "duration_seconds": r.duration_seconds
            }
            for r in results
        ]
    }

    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2)

    print(f"\n📄 Suite report: {report_path}")
    print("=" * 70)

    # Cleanup suite-level logging
    remove_workspace_file_handler(suite_workspace)

    return suite_result


def main():
    parser = argparse.ArgumentParser(
        description="Run DiagramAuthorAgent test suite on multiple fixtures",
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
        "--tool", "-t",
        choices=["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "IMAGEN"],
        help="Run only fixtures for specific tool"
    )

    parser.add_argument(
        "--fixture", "-f",
        type=Path,
        help="Run specific fixture file"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate fixtures without running agent"
    )

    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="DEBUG",
        help="Logging level for console output (default: DEBUG for full visibility)"
    )

    args = parser.parse_args()

    try:
        result = asyncio.run(run_test_suite(
            fixtures_dir=args.fixtures_dir,
            output_dir=args.output_dir,
            tool_filter=args.tool,
            fixture_path=args.fixture,
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
