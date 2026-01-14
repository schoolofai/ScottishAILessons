"""
Unit Tests for Nat5+ Diagram Generator

Tests the diagram generation pipeline components:
- Question filtering
- Tool type mapping
- Classification input creation
- Result conversion to QuestionDiagram
"""

import pytest
from pathlib import Path
from typing import List

from src.nat5_plus.diagram_generator import (
    _filter_questions_needing_diagrams,
    _map_diagram_type_to_tool,
    _create_classification_input,
    _result_to_question_diagram,
    DiagramGenerationResult,
)
from src.models.nat5_plus_question_generation_schema import (
    QuestionGeneration,
    DiagramSpec,
    MarkingSchemeGen,
    GenericSchemeBullet,
    IllustrativeAnswerGen,
)


# =============================================================================
# Test Fixtures
# =============================================================================

def create_mock_question(
    question_id: str,
    diagram_needed: bool = False,
    diagram_type: str = "matplotlib",
    diagram_description: str = "Test diagram"
) -> QuestionGeneration:
    """Create a mock QuestionGeneration for testing."""
    diagram_spec = None
    if diagram_needed:
        diagram_spec = DiagramSpec(
            diagram_type=diagram_type,
            description=diagram_description,
            parameters={"key_elements": ["element1", "element2"]}
        )

    return QuestionGeneration(
        question_id=question_id,
        question_number="1",
        marks=3,
        difficulty="medium",
        stem="Test question stem",
        stem_latex="Test question stem with $LaTeX$",
        marking_scheme=MarkingSchemeGen(
            max_marks=3,
            generic_scheme=[
                GenericSchemeBullet(bullet=1, process="Step 1", marks=1),
                GenericSchemeBullet(bullet=2, process="Step 2", marks=2),
            ],
            illustrative_scheme=[
                IllustrativeAnswerGen(bullet=1, answer="Answer 1"),
                IllustrativeAnswerGen(bullet=2, answer="Answer 2"),
            ]
        ),
        diagram_needed=diagram_needed,
        diagram_spec=diagram_spec,
        topic_ids=["topic_1"],
        hints=["Hint 1"],
        common_errors=["Error 1"]
    )


# =============================================================================
# Test: _filter_questions_needing_diagrams
# =============================================================================

class TestFilterQuestionsNeedingDiagrams:
    """Tests for filtering questions that need diagrams."""

    def test_filters_questions_with_diagram_needed_true(self):
        """Should include questions with diagram_needed=True and valid spec."""
        questions = [
            create_mock_question("q1", diagram_needed=True),
            create_mock_question("q2", diagram_needed=False),
            create_mock_question("q3", diagram_needed=True),
        ]

        result = _filter_questions_needing_diagrams(questions)

        assert len(result) == 2
        assert result[0].question_id == "q1"
        assert result[1].question_id == "q3"

    def test_excludes_questions_without_diagram_spec(self):
        """Should exclude questions with diagram_needed=True but no spec."""
        q = create_mock_question("q1", diagram_needed=False)
        q.diagram_needed = True  # Set True but no spec
        q.diagram_spec = None

        result = _filter_questions_needing_diagrams([q])

        assert len(result) == 0

    def test_returns_empty_list_when_no_diagrams_needed(self):
        """Should return empty list when no questions need diagrams."""
        questions = [
            create_mock_question("q1", diagram_needed=False),
            create_mock_question("q2", diagram_needed=False),
        ]

        result = _filter_questions_needing_diagrams(questions)

        assert len(result) == 0


# =============================================================================
# Test: _map_diagram_type_to_tool
# =============================================================================

class TestMapDiagramTypeToTool:
    """Tests for mapping LLM diagram types to tool names."""

    @pytest.mark.parametrize("input_type,expected_tool", [
        ("tikz", "MATPLOTLIB"),
        ("TikZ", "MATPLOTLIB"),
        ("TIKZ", "MATPLOTLIB"),
        ("geogebra", "MATPLOTLIB"),
        ("GeoGebra", "MATPLOTLIB"),
        ("desmos", "DESMOS"),
        ("Desmos", "DESMOS"),
        ("matplotlib", "MATPLOTLIB"),
        ("jsxgraph", "JSXGRAPH"),
        ("plotly", "PLOTLY"),
        ("imagen", "IMAGE_GENERATION"),
        ("image_generation", "IMAGE_GENERATION"),
    ])
    def test_maps_known_types_correctly(self, input_type: str, expected_tool: str):
        """Should map known diagram types to correct tools."""
        result = _map_diagram_type_to_tool(input_type)
        assert result == expected_tool

    def test_defaults_to_matplotlib_for_unknown_types(self):
        """Should default to MATPLOTLIB for unknown types."""
        result = _map_diagram_type_to_tool("unknown_type")
        assert result == "MATPLOTLIB"


# =============================================================================
# Test: _create_classification_input
# =============================================================================

class TestCreateClassificationInput:
    """Tests for creating classification input JSON."""

    def test_creates_valid_structure(self):
        """Should create valid classification input structure."""
        questions = [
            create_mock_question("q1", diagram_needed=True, diagram_type="desmos"),
            create_mock_question("q2", diagram_needed=True, diagram_type="matplotlib"),
        ]

        result = _create_classification_input(questions, "Mathematics", "National 5")

        assert result["batch_mode"] is True
        assert result["exam_metadata"]["subject"] == "Mathematics"
        assert result["exam_metadata"]["level"] == "National 5"
        assert len(result["questions"]) == 2

    def test_includes_diagram_spec_in_output(self):
        """Should include diagram_spec for each question."""
        questions = [
            create_mock_question("q1", diagram_needed=True, diagram_description="Graph of y=x^2"),
        ]

        result = _create_classification_input(questions, "Mathematics", "National 5")

        assert result["questions"][0]["diagram_spec"] is not None
        assert result["questions"][0]["diagram_spec"]["description"] == "Graph of y=x^2"

    def test_handles_empty_question_list(self):
        """Should handle empty question list gracefully."""
        result = _create_classification_input([], "Mathematics", "National 5")

        assert result["batch_mode"] is True
        assert len(result["questions"]) == 0


# =============================================================================
# Test: _result_to_question_diagram
# =============================================================================

class TestResultToQuestionDiagram:
    """Tests for converting DiagramGenerationResult to QuestionDiagram."""

    def test_converts_successful_result(self):
        """Should convert successful result to QuestionDiagram."""
        result = DiagramGenerationResult(
            question_id="q1",
            success=True,
            iterations=2,
            final_score=0.85,
            image_path="/path/to/diagram.png",
            diagram_type="desmos"
        )
        question = create_mock_question("q1", diagram_needed=True, diagram_description="Test diagram")

        diagram = _result_to_question_diagram(result, question)

        assert diagram is not None
        assert diagram.diagram_id == "dgm_q1"
        assert diagram.diagram_type == "desmos"
        assert diagram.diagram_url == "/path/to/diagram.png"
        assert diagram.description == "Test diagram"

    def test_returns_none_for_failed_result(self):
        """Should return None for failed diagram result."""
        result = DiagramGenerationResult(
            question_id="q1",
            success=False,
            error="Generation failed"
        )
        question = create_mock_question("q1", diagram_needed=True)

        diagram = _result_to_question_diagram(result, question)

        assert diagram is None

    def test_returns_none_when_no_image_path(self):
        """Should return None when success but no image path."""
        result = DiagramGenerationResult(
            question_id="q1",
            success=True,
            image_path=None
        )
        question = create_mock_question("q1", diagram_needed=True)

        diagram = _result_to_question_diagram(result, question)

        assert diagram is None


# =============================================================================
# Test: Tool Normalization via normalize_tool_type
# =============================================================================

class TestToolNormalization:
    """Tests for tool type normalization."""

    def test_normalizes_imagen_to_image_generation(self):
        """Should normalize IMAGEN to IMAGE_GENERATION."""
        from src.tools.diagram_classifier_schema_models import normalize_tool_type

        assert normalize_tool_type("IMAGEN") == "IMAGE_GENERATION"
        assert normalize_tool_type("imagen") == "IMAGE_GENERATION"

    def test_normalizes_geogebra_to_matplotlib(self):
        """Should normalize GEOGEBRA to MATPLOTLIB."""
        from src.tools.diagram_classifier_schema_models import normalize_tool_type

        assert normalize_tool_type("GEOGEBRA") == "MATPLOTLIB"
        assert normalize_tool_type("geogebra") == "MATPLOTLIB"

    def test_preserves_valid_tool_names(self):
        """Should preserve already valid tool names."""
        from src.tools.diagram_classifier_schema_models import normalize_tool_type

        assert normalize_tool_type("DESMOS") == "DESMOS"
        assert normalize_tool_type("MATPLOTLIB") == "MATPLOTLIB"
        assert normalize_tool_type("JSXGRAPH") == "JSXGRAPH"
        assert normalize_tool_type("PLOTLY") == "PLOTLY"
