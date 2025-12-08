"""Tests for Diagram Author Agent and subagents.

Tests the diagram authoring pipeline including:
- DiagramAuthorSubagent (diagram generation helper)
- DiagramCriticSubagent (diagram critique helper)
- DiagramAuthorAgent (orchestrator with iterative critique)

Unit tests use mock fixtures; integration tests require Claude Agent SDK.
"""

import json
import pytest
from pathlib import Path
from typing import Dict, Any
from unittest.mock import AsyncMock, MagicMock, patch

# Subagent imports
from src.subagents.diagram_author_subagent import DiagramAuthorSubagent
from src.subagents.diagram_critic_subagent import DiagramCriticSubagent

# Agent imports
from src.agents.diagram_author_agent import (
    DiagramAuthorAgent,
    DiagramResult,
    DiagramAuthorResult,
    MAX_ITERATIONS_PER_DIAGRAM,
    DIAGRAM_MANIFEST_FILE
)


# ═══════════════════════════════════════════════════════════════════════════
# MOCK DATA FIXTURES
# ═══════════════════════════════════════════════════════════════════════════


@pytest.fixture
def sample_classification() -> Dict[str, Any]:
    """Sample classification result for a DESMOS diagram."""
    return {
        "question_id": "q3",
        "question_number": 3,
        "tool": "DESMOS",
        "confidence": "HIGH",
        "reasoning": {
            "selected_because": "DESMOS for linear functions",
            "content_analysis": "Graph y = 2x + 1",
            "decision_rule_applied": "Rule 2: graph y=",
            "alternatives_rejected": "JSXGRAPH for coords",
            "summary": "Linear function"
        },
        "visualization_focus": "Line with gradient 2",
        "alternative_tool": None,
        "curriculum_topic": "Linear Functions",
        "diagram_specs": {
            "key_elements": ["line", "axes"],
            "educational_purpose": "Show equation-graph relationship"
        }
    }


@pytest.fixture
def sample_question_content() -> Dict[str, Any]:
    """Sample question content for diagram generation."""
    return {
        "question_id": "q3",
        "question_number": 3,
        "question_stem": "Graph the line y = 2x + 1",
        "question_stem_plain": "Draw a graph showing the line y equals 2x plus 1",
        "question_type": "structured_response",
        "difficulty": "medium"
    }


@pytest.fixture
def sample_classification_output_file(tmp_path) -> Path:
    """Create classification_output.json in temp path."""
    classification_data = {
        "batch_mode": True,
        "total_questions": 2,
        "questions_needing_diagrams": 1,
        "questions_no_diagram": 1,
        "classifications": [
            {
                "question_id": "q1",
                "question_number": 1,
                "tool": "NONE",
                "confidence": "HIGH",
                "reasoning": {
                    "selected_because": "Pure arithmetic",
                    "content_analysis": "Addition calculation",
                    "decision_rule_applied": "Rule 8: purely algebraic",
                    "alternatives_rejected": "No tool needed",
                    "summary": "Simple calculation"
                },
                "visualization_focus": None,
                "alternative_tool": None,
                "curriculum_topic": "Numeracy",
                "diagram_specs": None
            },
            {
                "question_id": "q3",
                "question_number": 3,
                "tool": "DESMOS",
                "confidence": "HIGH",
                "reasoning": {
                    "selected_because": "DESMOS for linear functions",
                    "content_analysis": "Graph y = 2x + 1",
                    "decision_rule_applied": "Rule 2: graph y=",
                    "alternatives_rejected": "JSXGRAPH for coords",
                    "summary": "Linear function"
                },
                "visualization_focus": "Line with gradient 2",
                "alternative_tool": None,
                "curriculum_topic": "Linear Functions",
                "diagram_specs": {
                    "key_elements": ["line", "axes"],
                    "educational_purpose": "Show equation-graph relationship"
                }
            }
        ]
    }
    output_path = tmp_path / "classification_output.json"
    output_path.write_text(json.dumps(classification_data, indent=2))
    return output_path


@pytest.fixture
def sample_mock_exam_file(tmp_path, sample_question_content) -> Path:
    """Create mock_exam.json in temp path."""
    mock_exam_data = {
        "examId": "test_exam_001",
        "sections": [
            {
                "section_id": "section_a",
                "questions": [
                    {
                        "question_id": "q1",
                        "question_number": 1,
                        "question_stem": "Calculate: 47 + 38",
                        "question_type": "numeric"
                    },
                    sample_question_content
                ]
            }
        ]
    }
    output_path = tmp_path / "mock_exam.json"
    output_path.write_text(json.dumps(mock_exam_data, indent=2))
    return output_path


@pytest.fixture
def sample_critique_result_accept() -> Dict[str, Any]:
    """Sample critique result that ACCEPTs the diagram."""
    return {
        "decision": "ACCEPT",
        "final_score": 0.88,
        "dimension_scores": {
            "clarity": 0.90,
            "accuracy": 0.88,
            "pedagogy": 0.85,
            "aesthetics": 0.82
        },
        "strengths": ["Clear axis labels", "Correct gradient shown"],
        "improvements": ["Could add grid lines"],
        "specific_changes": [],
        "critical_issues": [],
        "iteration_notes": "Good quality diagram"
    }


@pytest.fixture
def sample_critique_result_refine() -> Dict[str, Any]:
    """Sample critique result that requests REFINEMENT."""
    return {
        "decision": "REFINE",
        "final_score": 0.72,
        "dimension_scores": {
            "clarity": 0.75,
            "accuracy": 0.80,
            "pedagogy": 0.65,
            "aesthetics": 0.60
        },
        "strengths": ["Correct line equation"],
        "improvements": ["Add axis labels", "Increase font size"],
        "specific_changes": [
            "Add x-axis label 'x'",
            "Add y-axis label 'y'",
            "Mark y-intercept at (0, 1)"
        ],
        "critical_issues": [],
        "iteration_notes": "Needs axis labels"
    }


@pytest.fixture
def sample_critique_result_reject() -> Dict[str, Any]:
    """Sample critique result that REJECTs the diagram."""
    return {
        "decision": "REJECT",
        "final_score": 0.35,
        "dimension_scores": {
            "clarity": 0.40,
            "accuracy": 0.20,
            "pedagogy": 0.40,
            "aesthetics": 0.50
        },
        "strengths": [],
        "improvements": [],
        "specific_changes": [],
        "critical_issues": ["Wrong gradient shown - should be 2, shows 1"],
        "iteration_notes": "Mathematical error"
    }


# ═══════════════════════════════════════════════════════════════════════════
# UNIT TESTS - DiagramAuthorSubagent
# ═══════════════════════════════════════════════════════════════════════════


class TestDiagramAuthorSubagent:
    """Tests for DiagramAuthorSubagent helper class."""

    def test_tool_to_server_mapping(self):
        """Test that tool types map to correct MCP server names."""
        author = DiagramAuthorSubagent()

        assert author.TOOL_TO_SERVER["DESMOS"] == "desmos"
        assert author.TOOL_TO_SERVER["MATPLOTLIB"] == "matplotlib"
        assert author.TOOL_TO_SERVER["JSXGRAPH"] == "jsxgraph"
        assert author.TOOL_TO_SERVER["PLOTLY"] == "plotly"
        assert author.TOOL_TO_SERVER["IMAGE_GENERATION"] == "imagen"

    def test_get_required_mcp_server(self):
        """Test getting MCP server name from tool type."""
        author = DiagramAuthorSubagent()

        assert author.get_required_mcp_server("DESMOS") == "desmos"
        assert author.get_required_mcp_server("MATPLOTLIB") == "matplotlib"

    def test_get_required_mcp_server_invalid_raises(self):
        """Test that invalid tool type raises ValueError."""
        author = DiagramAuthorSubagent()

        with pytest.raises(ValueError, match="Unknown tool type"):
            author.get_required_mcp_server("INVALID_TOOL")

    def test_create_request(self, sample_classification, sample_question_content):
        """Test creating a diagram request."""
        request = DiagramAuthorSubagent.create_request(
            classification=sample_classification,
            content=sample_question_content,
            card_id="q3",
            context="question",
            diagram_index=0
        )

        assert request["classification"]["tool"] == "DESMOS"
        assert request["content"]["question_id"] == "q3"
        assert request["output_config"]["card_id"] == "q3"
        assert request["output_config"]["context"] == "question"
        assert request["output_config"]["diagram_index"] == 0

    def test_create_request_with_correction(self, sample_classification, sample_question_content):
        """Test creating a request with correction prompt."""
        request = DiagramAuthorSubagent.create_request(
            classification=sample_classification,
            content=sample_question_content,
            card_id="q3",
            context="question",
            correction_prompt="Please add axis labels"
        )

        assert "correction_prompt" in request
        assert request["correction_prompt"] == "Please add axis labels"

    def test_prepare_input_validates_classification(self, tmp_path, sample_question_content):
        """Test that prepare_input validates classification."""
        author = DiagramAuthorSubagent()

        # Missing tool
        request = {
            "classification": {},
            "content": sample_question_content,
            "output_config": {"card_id": "q1", "context": "question"}
        }

        with pytest.raises(ValueError, match="classification missing required field: tool"):
            author.prepare_input(request, tmp_path)

    def test_prepare_input_validates_tool_type(self, tmp_path, sample_question_content):
        """Test that prepare_input validates tool type."""
        author = DiagramAuthorSubagent()

        request = {
            "classification": {"tool": "INVALID_TOOL"},
            "content": sample_question_content,
            "output_config": {"card_id": "q1", "context": "question"}
        }

        with pytest.raises(ValueError, match="Invalid tool"):
            author.prepare_input(request, tmp_path)

    def test_prepare_input_writes_file(self, tmp_path, sample_classification, sample_question_content):
        """Test that prepare_input writes JSON file."""
        author = DiagramAuthorSubagent()

        request = DiagramAuthorSubagent.create_request(
            classification=sample_classification,
            content=sample_question_content,
            card_id="q3",
            context="question"
        )

        input_path = author.prepare_input(request, tmp_path)

        assert input_path.exists()
        assert input_path.name == "diagram_request.json"

        # Verify content
        written_data = json.loads(input_path.read_text())
        assert written_data["classification"]["tool"] == "DESMOS"

    def test_list_generated_diagrams_empty(self, tmp_path):
        """Test listing diagrams when none exist."""
        author = DiagramAuthorSubagent()

        diagrams = author.list_generated_diagrams(tmp_path)
        assert diagrams == []

    def test_list_generated_diagrams_with_files(self, tmp_path):
        """Test listing diagrams when files exist."""
        author = DiagramAuthorSubagent()

        # Create diagrams directory with test files
        diagrams_dir = tmp_path / "diagrams"
        diagrams_dir.mkdir()
        (diagrams_dir / "q1_question.png").write_bytes(b"fake png data")
        (diagrams_dir / "q2_worked_solution.png").write_bytes(b"fake png data")

        diagrams = author.list_generated_diagrams(tmp_path)

        assert len(diagrams) == 2
        card_ids = [d["card_id"] for d in diagrams]
        assert "q1" in card_ids
        assert "q2" in card_ids


# ═══════════════════════════════════════════════════════════════════════════
# UNIT TESTS - DiagramCriticSubagent
# ═══════════════════════════════════════════════════════════════════════════


class TestDiagramCriticSubagent:
    """Tests for DiagramCriticSubagent helper class."""

    def test_tool_to_diagram_type_mapping(self):
        """Test that tool types map to correct diagram types."""
        critic = DiagramCriticSubagent()

        assert critic.TOOL_TO_DIAGRAM_TYPE["DESMOS"] == "function_graph"
        assert critic.TOOL_TO_DIAGRAM_TYPE["MATPLOTLIB"] == "geometric_construction"
        assert critic.TOOL_TO_DIAGRAM_TYPE["JSXGRAPH"] == "coordinate_geometry"
        assert critic.TOOL_TO_DIAGRAM_TYPE["PLOTLY"] == "statistical_chart"
        assert critic.TOOL_TO_DIAGRAM_TYPE["IMAGE_GENERATION"] == "contextual_image"

    def test_progressive_threshold_policy(self):
        """Test that thresholds decrease with iteration count."""
        critic = DiagramCriticSubagent()

        # Early iterations are strict
        assert critic.get_threshold_for_iteration(1) == 0.85
        assert critic.get_threshold_for_iteration(2) == 0.85

        # Middle iterations slightly relaxed
        assert critic.get_threshold_for_iteration(3) == 0.82
        assert critic.get_threshold_for_iteration(4) == 0.82

        # Later iterations more relaxed
        assert critic.get_threshold_for_iteration(5) == 0.80
        assert critic.get_threshold_for_iteration(6) == 0.80

        # Very late iterations use default
        assert critic.get_threshold_for_iteration(10) == 0.78

    def test_should_accept_explicit_accept(self, sample_critique_result_accept):
        """Test that explicit ACCEPT is accepted."""
        critic = DiagramCriticSubagent()

        assert critic.should_accept(sample_critique_result_accept, iteration=1) is True
        assert critic.should_accept(sample_critique_result_accept, iteration=5) is True

    def test_should_accept_explicit_reject(self, sample_critique_result_reject):
        """Test that explicit REJECT is rejected."""
        critic = DiagramCriticSubagent()

        assert critic.should_accept(sample_critique_result_reject, iteration=1) is False
        assert critic.should_accept(sample_critique_result_reject, iteration=10) is False

    def test_should_accept_refine_below_threshold(self, sample_critique_result_refine):
        """Test that REFINE with low score is rejected."""
        critic = DiagramCriticSubagent()

        # 0.72 is below 0.85 threshold at iteration 1
        assert critic.should_accept(sample_critique_result_refine, iteration=1) is False

    def test_should_accept_refine_above_threshold_late_iteration(self):
        """Test that REFINE with decent score is accepted at late iteration."""
        critic = DiagramCriticSubagent()

        result = {
            "decision": "REFINE",
            "final_score": 0.79,
            "dimension_scores": {
                "clarity": 0.80,
                "accuracy": 0.92,  # High accuracy
                "pedagogy": 0.75,
                "aesthetics": 0.70
            }
        }

        # At iteration 10, threshold is 0.78, and high accuracy triggers early accept
        assert critic.should_accept(result, iteration=10) is True

    def test_get_correction_prompt(self, sample_critique_result_refine):
        """Test generating correction prompt from critique."""
        critic = DiagramCriticSubagent()

        prompt = critic.get_correction_prompt(sample_critique_result_refine)

        assert "following changes" in prompt
        assert "Add x-axis label" in prompt
        assert "Add y-axis label" in prompt
        assert "Mark y-intercept" in prompt

    def test_get_correction_prompt_empty_changes(self):
        """Test correction prompt when no specific changes."""
        critic = DiagramCriticSubagent()

        result = {"specific_changes": []}
        prompt = critic.get_correction_prompt(result)

        assert "review and improve" in prompt.lower()

    def test_calculate_weighted_score(self):
        """Test weighted score calculation."""
        critic = DiagramCriticSubagent()

        scores = {
            "clarity": 0.90,     # 0.90 * 0.35 = 0.315
            "accuracy": 0.80,   # 0.80 * 0.35 = 0.280
            "pedagogy": 0.70,   # 0.70 * 0.20 = 0.140
            "aesthetics": 0.60  # 0.60 * 0.10 = 0.060
        }                        # Total: 0.795

        result = critic.calculate_weighted_score(scores)
        assert abs(result - 0.795) < 0.001

    def test_create_request(self, tmp_path, sample_classification, sample_question_content):
        """Test creating a critique request."""
        # Create a fake image file
        image_path = tmp_path / "test.png"
        image_path.write_bytes(b"fake png data")

        request = DiagramCriticSubagent.create_request(
            image_path=str(image_path),
            diagram_type="function_graph",
            diagram_context="question",
            original_request=sample_classification,
            content=sample_question_content,
            iteration=1
        )

        assert request["image_path"] == str(image_path)
        assert request["diagram_type"] == "function_graph"
        assert request["diagram_context"] == "question"
        assert request["iteration"] == 1

    def test_prepare_input_validates_image_exists(self, tmp_path, sample_classification, sample_question_content):
        """Test that prepare_input validates image exists."""
        critic = DiagramCriticSubagent()

        request = {
            "image_path": "/nonexistent/image.png",
            "diagram_type": "function_graph",
            "diagram_context": "question",
            "original_request": sample_classification,
            "content": sample_question_content,
            "iteration": 1
        }

        with pytest.raises(FileNotFoundError, match="Image not found"):
            critic.prepare_input(request, tmp_path)

    def test_prepare_input_validates_diagram_type(self, tmp_path, sample_classification, sample_question_content):
        """Test that prepare_input validates diagram type."""
        critic = DiagramCriticSubagent()

        # Create a fake image file
        image_path = tmp_path / "test.png"
        image_path.write_bytes(b"fake png data")

        request = {
            "image_path": str(image_path),
            "diagram_type": "invalid_type",
            "diagram_context": "question",
            "original_request": sample_classification,
            "content": sample_question_content,
            "iteration": 1
        }

        with pytest.raises(ValueError, match="Invalid diagram_type"):
            critic.prepare_input(request, tmp_path)

    def test_summarize_critique_accept(self, sample_critique_result_accept):
        """Test critique summary for ACCEPT."""
        critic = DiagramCriticSubagent()

        summary = critic.summarize_critique(sample_critique_result_accept)

        assert "✅" in summary
        assert "ACCEPT" in summary
        assert "0.88" in summary

    def test_summarize_critique_refine(self, sample_critique_result_refine):
        """Test critique summary for REFINE."""
        critic = DiagramCriticSubagent()

        summary = critic.summarize_critique(sample_critique_result_refine)

        assert "🔄" in summary
        assert "REFINE" in summary
        assert "Changes needed" in summary

    def test_summarize_critique_reject(self, sample_critique_result_reject):
        """Test critique summary for REJECT."""
        critic = DiagramCriticSubagent()

        summary = critic.summarize_critique(sample_critique_result_reject)

        assert "❌" in summary
        assert "REJECT" in summary
        assert "Critical" in summary


# ═══════════════════════════════════════════════════════════════════════════
# UNIT TESTS - DiagramAuthorAgent
# ═══════════════════════════════════════════════════════════════════════════


class TestDiagramAuthorAgent:
    """Tests for DiagramAuthorAgent orchestrator."""

    def test_initialization_creates_diagrams_dir(self, tmp_path):
        """Test that agent creates diagrams directory on init."""
        agent = DiagramAuthorAgent(workspace_path=tmp_path)

        diagrams_dir = tmp_path / "diagrams"
        assert diagrams_dir.exists()
        assert diagrams_dir.is_dir()

    def test_build_question_lookup(self, tmp_path, sample_mock_exam_file):
        """Test building question lookup from mock exam."""
        agent = DiagramAuthorAgent(workspace_path=tmp_path)

        mock_exam_data = json.loads(sample_mock_exam_file.read_text())
        lookup = agent._build_question_lookup(mock_exam_data)

        assert "q1" in lookup
        assert "q3" in lookup
        assert lookup["q3"]["question_stem"] == "Graph the line y = 2x + 1"

    def test_get_mcp_server_config_desmos(self, tmp_path):
        """Test getting MCP server config for DESMOS."""
        agent = DiagramAuthorAgent(workspace_path=tmp_path)

        config = agent._get_mcp_server_config("DESMOS")

        assert config["name"] == "desmos"
        assert "command" in config["config"]
        assert "args" in config["config"]

    def test_get_mcp_server_config_all_tools(self, tmp_path):
        """Test getting MCP server config for all tools."""
        agent = DiagramAuthorAgent(workspace_path=tmp_path)

        for tool in ["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION"]:
            config = agent._get_mcp_server_config(tool)
            assert "name" in config
            assert "config" in config

    def test_get_mcp_server_config_invalid_raises(self, tmp_path):
        """Test that invalid tool raises ValueError."""
        agent = DiagramAuthorAgent(workspace_path=tmp_path)

        with pytest.raises(ValueError, match="Unknown tool type"):
            agent._get_mcp_server_config("INVALID_TOOL")

    def test_write_manifest(self, tmp_path):
        """Test writing diagram manifest."""
        agent = DiagramAuthorAgent(workspace_path=tmp_path)

        results = [
            DiagramResult(
                question_id="q3",
                question_number=3,
                tool="DESMOS",
                success=True,
                iterations=2,
                final_score=0.88,
                image_path="/path/to/q3_question.png"
            ),
            DiagramResult(
                question_id="q5",
                question_number=5,
                tool="PLOTLY",
                success=False,
                iterations=3,
                error="Render failed"
            )
        ]

        manifest_path = agent._write_manifest(results, total_questions=10)

        assert manifest_path.exists()
        assert manifest_path.name == DIAGRAM_MANIFEST_FILE

        manifest = json.loads(manifest_path.read_text())
        assert manifest["total_questions"] == 10
        assert manifest["diagrams_generated"] == 2
        assert manifest["successful"] == 1
        assert manifest["failed"] == 1
        assert len(manifest["diagrams"]) == 2


class TestDiagramResult:
    """Tests for DiagramResult dataclass."""

    def test_diagram_result_success(self):
        """Test creating successful DiagramResult."""
        result = DiagramResult(
            question_id="q3",
            question_number=3,
            tool="DESMOS",
            success=True,
            iterations=2,
            final_score=0.88,
            image_path="/path/to/image.png"
        )

        assert result.success is True
        assert result.iterations == 2
        assert result.final_score == 0.88

    def test_diagram_result_failure(self):
        """Test creating failed DiagramResult."""
        result = DiagramResult(
            question_id="q3",
            question_number=3,
            tool="DESMOS",
            success=False,
            iterations=1,
            error="Render failed"
        )

        assert result.success is False
        assert result.error == "Render failed"


class TestDiagramAuthorResult:
    """Tests for DiagramAuthorResult dataclass."""

    def test_diagram_author_result_success(self):
        """Test creating successful DiagramAuthorResult."""
        diagram_result = DiagramResult(
            question_id="q3",
            question_number=3,
            tool="DESMOS",
            success=True,
            iterations=2
        )

        result = DiagramAuthorResult(
            success=True,
            total_diagrams=1,
            successful_diagrams=1,
            failed_diagrams=0,
            total_iterations=2,
            diagrams=[diagram_result],
            manifest_path="/path/to/manifest.json"
        )

        assert result.success is True
        assert result.total_diagrams == 1
        assert len(result.diagrams) == 1


# ═══════════════════════════════════════════════════════════════════════════
# INTEGRATION TEST - Real Agent Execution
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
@pytest.mark.asyncio
async def test_diagram_author_full_execution():
    """Integration test: Run full diagram author with real Claude Agent SDK.

    This test requires:
    - Claude Code subscription (uses claude-agent-sdk)
    - Workspace at workspace/20251205_220701 with classification_output.json
    - Running rendering API (optional - test skips if unavailable)

    Marked as integration test - skip in unit test runs.
    """
    from src.agents.diagram_author_agent import run_diagram_author
    from src.utils.logging_config import setup_logging

    setup_logging(log_level="INFO")

    # Use existing workspace from previous tests
    workspace_path = Path("workspace/20251205_220701")

    if not workspace_path.exists():
        pytest.skip(f"Integration test workspace not found: {workspace_path}")

    # Check required files
    if not (workspace_path / "classification_output.json").exists():
        pytest.skip("classification_output.json not found - run classifier first")
    if not (workspace_path / "mock_exam.json").exists():
        pytest.skip("mock_exam.json not found in workspace")

    try:
        result = await run_diagram_author(
            workspace_path=workspace_path,
            rendering_api_base="http://localhost:8080"  # Requires running API
        )

        # Validate result structure
        assert result is not None
        assert isinstance(result, DiagramAuthorResult)

        # Log results
        print()
        print("=" * 60)
        print("DIAGRAM AUTHOR INTEGRATION TEST RESULTS")
        print("=" * 60)
        print(f"Success: {result.success}")
        print(f"Total diagrams: {result.total_diagrams}")
        print(f"Successful: {result.successful_diagrams}")
        print(f"Failed: {result.failed_diagrams}")
        print(f"Total iterations: {result.total_iterations}")

        if result.manifest_path:
            print(f"Manifest: {result.manifest_path}")

        for diagram in result.diagrams:
            status = "✅" if diagram.success else "❌"
            print(f"  {status} Q{diagram.question_number}: {diagram.tool}, "
                  f"iterations={diagram.iterations}, score={diagram.final_score:.2f}")

    except Exception as e:
        # Skip if rendering API not available
        if "Connection refused" in str(e) or "render" in str(e).lower():
            pytest.skip(f"Rendering API not available: {e}")
        raise


# ═══════════════════════════════════════════════════════════════════════════
# TEST CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════


def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires Claude subscription)"
    )
