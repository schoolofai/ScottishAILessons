"""Tests for Diagram Classifier Agent.

Tests the diagram classification agent with both unit tests (mock fixtures)
and integration tests (real Claude Agent SDK with workspace data).

Mock fixtures derived from workspace/20251205_220701.
"""

import json
import pytest
from pathlib import Path
from typing import Dict, Any
from unittest.mock import AsyncMock, MagicMock, patch

# Schema imports
from src.tools.diagram_classification_generation_schema import (
    DiagramClassificationGeneration,
    QuestionClassificationGeneration,
    convert_to_full_schema
)
from src.tools.diagram_classifier_schema_models import (
    DiagramClassificationResult,
    QuestionClassification,
    ClassificationReasoning,
    DiagramSpecs,
    DIAGRAM_CLASSIFICATION_INPUT_FILE,
    DIAGRAM_CLASSIFICATION_OUTPUT_FILE
)


# ═══════════════════════════════════════════════════════════════════════════
# MOCK DATA FIXTURES (derived from workspace/20251205_220701)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.fixture
def sample_mock_exam_data() -> Dict[str, Any]:
    """Sample mock exam data from workspace."""
    return {
        "schema_version": "mock_exam_v1",
        "examId": "exam_68f3d6eacb2696fd0591_1",
        "courseId": "course_c84473",
        "sowId": "68f3d6eacb2696fd0591",
        "sowEntryOrder": 16,
        "metadata": {
            "title": "Lifeskills Mathematics - Mock Unit Assessment",
            "subject": "mathematics",
            "level": "lifeskills",
            "totalMarks": 50,
            "timeLimit": 50
        },
        "sections": [
            {
                "section_id": "section_a",
                "section_label": "Section A: Numeracy",
                "questions": [
                    {
                        "question_id": "q1",
                        "question_number": 1,
                        "question_stem": "A supermarket sells milk for £1.35 per litre. Write this amount in pence.",
                        "question_stem_plain": "A supermarket sells milk for one pound thirty-five pence per litre. Write this amount in pence.",
                        "question_type": "numeric",
                        "difficulty": "easy",
                        "standards_addressed": [
                            {"type": "outcome", "code": "AS1.1", "description": "Selecting and using appropriate numerical notation"}
                        ]
                    },
                    {
                        "question_id": "q2",
                        "question_number": 2,
                        "question_stem": "Calculate: $47 + 38$",
                        "question_stem_plain": "Calculate: 47 plus 38",
                        "question_type": "numeric",
                        "difficulty": "easy",
                        "standards_addressed": [
                            {"type": "outcome", "code": "AS1.2", "description": "Selecting and carrying out calculations"}
                        ]
                    },
                    {
                        "question_id": "q3",
                        "question_number": 3,
                        "question_stem": "Graph the line y = 2x + 1",
                        "question_stem_plain": "Draw a graph showing the line y equals 2x plus 1",
                        "question_type": "structured_response",
                        "difficulty": "medium",
                        "standards_addressed": [
                            {"type": "outcome", "code": "AS2.1", "description": "Linear functions and graphs"}
                        ]
                    },
                    {
                        "question_id": "q4",
                        "question_number": 4,
                        "question_stem": "The table shows test scores. Draw a bar chart to display the data.",
                        "question_stem_plain": "Look at the test scores in the table. Draw a bar chart to show the data.",
                        "question_type": "structured_response",
                        "difficulty": "medium",
                        "standards_addressed": [
                            {"type": "outcome", "code": "AS3.1", "description": "Statistics and data presentation"}
                        ]
                    }
                ]
            }
        ]
    }


@pytest.fixture
def sample_context_data() -> Dict[str, Any]:
    """Sample SOW context data from workspace."""
    return {
        "courseId": "course_c84473",
        "sowId": "68f3d6eacb2696fd0591",
        "subject": "mathematics",
        "level": "lifeskills",
        "total_entries": 16
    }


@pytest.fixture
def sample_classification_output_simplified() -> Dict[str, Any]:
    """Sample simplified classification output (from structured output)."""
    return {
        "batch_mode": True,
        "total_questions": 4,
        "questions_needing_diagrams": 2,
        "questions_no_diagram": 2,
        "classifications": [
            {
                "question_id": "q1",
                "question_number": 1,
                "tool": "NONE",
                "confidence": "HIGH",
                "reasoning_selected_because": "Pure numerical conversion, no visualization needed",
                "reasoning_content_analysis": "Converting pounds to pence is arithmetic calculation",
                "reasoning_decision_rule": "Rule 8: purely algebraic",
                "reasoning_alternatives_rejected": "No tool adds value for unit conversion",
                "reasoning_summary": "Simple arithmetic needs no diagram",
                "visualization_focus": None,
                "alternative_tool": None,
                "curriculum_topic": "Numeracy",
                "diagram_key_elements": [],
                "diagram_educational_purpose": None
            },
            {
                "question_id": "q2",
                "question_number": 2,
                "tool": "NONE",
                "confidence": "HIGH",
                "reasoning_selected_because": "Basic addition calculation, no visual required",
                "reasoning_content_analysis": "47 + 38 is pure arithmetic",
                "reasoning_decision_rule": "Rule 8: purely algebraic",
                "reasoning_alternatives_rejected": "No diagram tool benefits addition",
                "reasoning_summary": "Addition calculation needs no diagram",
                "visualization_focus": None,
                "alternative_tool": None,
                "curriculum_topic": "Numeracy",
                "diagram_key_elements": [],
                "diagram_educational_purpose": None
            },
            {
                "question_id": "q3",
                "question_number": 3,
                "tool": "DESMOS",
                "confidence": "HIGH",
                "reasoning_selected_because": "DESMOS optimal for plotting linear functions",
                "reasoning_content_analysis": "Question asks to graph y = 2x + 1, a linear function",
                "reasoning_decision_rule": "Rule 2: graph y= → DESMOS",
                "reasoning_alternatives_rejected": "JSXGRAPH is for coordinates, not function graphing",
                "reasoning_summary": "Linear function graphing is DESMOS domain",
                "visualization_focus": "Line with gradient 2 and y-intercept 1",
                "alternative_tool": None,
                "curriculum_topic": "Linear Functions",
                "diagram_key_elements": ["line", "gradient", "y-intercept", "axes"],
                "diagram_educational_purpose": "Show relationship between equation and graph"
            },
            {
                "question_id": "q4",
                "question_number": 4,
                "tool": "PLOTLY",
                "confidence": "HIGH",
                "reasoning_selected_because": "PLOTLY optimal for statistical charts",
                "reasoning_content_analysis": "Question involves drawing bar chart from data table",
                "reasoning_decision_rule": "Rule 1: data points → PLOTLY",
                "reasoning_alternatives_rejected": "DESMOS for functions, not data charts",
                "reasoning_summary": "Data visualization is PLOTLY domain",
                "visualization_focus": "Bar chart showing score distribution",
                "alternative_tool": None,
                "curriculum_topic": "Statistics",
                "diagram_key_elements": ["bars", "x-axis labels", "y-axis scale", "title"],
                "diagram_educational_purpose": "Demonstrate bar chart construction from data"
            }
        ]
    }


@pytest.fixture
def sample_classification_output_full() -> Dict[str, Any]:
    """Sample full classification output (after conversion)."""
    return {
        "batch_mode": True,
        "total_questions": 4,
        "questions_needing_diagrams": 2,
        "questions_no_diagram": 2,
        "classifications": [
            {
                "question_id": "q1",
                "question_number": 1,
                "tool": "NONE",
                "confidence": "HIGH",
                "reasoning": {
                    "selected_because": "Pure numerical conversion",
                    "content_analysis": "Converting pounds to pence",
                    "decision_rule_applied": "Rule 8: purely algebraic",
                    "alternatives_rejected": "No tool adds value",
                    "summary": "Simple arithmetic"
                },
                "visualization_focus": None,
                "alternative_tool": None,
                "curriculum_topic": "Numeracy",
                "diagram_specs": None
            },
            {
                "question_id": "q2",
                "question_number": 2,
                "tool": "NONE",
                "confidence": "HIGH",
                "reasoning": {
                    "selected_because": "Basic addition",
                    "content_analysis": "47 + 38 arithmetic",
                    "decision_rule_applied": "Rule 8: purely algebraic",
                    "alternatives_rejected": "No tool needed",
                    "summary": "Addition calculation"
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
            },
            {
                "question_id": "q4",
                "question_number": 4,
                "tool": "PLOTLY",
                "confidence": "HIGH",
                "reasoning": {
                    "selected_because": "PLOTLY for charts",
                    "content_analysis": "Bar chart from data",
                    "decision_rule_applied": "Rule 1: data points",
                    "alternatives_rejected": "DESMOS for functions",
                    "summary": "Data visualization"
                },
                "visualization_focus": "Bar chart",
                "alternative_tool": None,
                "curriculum_topic": "Statistics",
                "diagram_specs": {
                    "key_elements": ["bars", "axes"],
                    "educational_purpose": "Bar chart construction"
                }
            }
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════
# UNIT TESTS - Schema and Conversion
# ═══════════════════════════════════════════════════════════════════════════


class TestDiagramClassificationGenerationSchema:
    """Tests for simplified generation schema."""

    def test_schema_generation(self):
        """Test that schema generates valid JSON schema."""
        schema = DiagramClassificationGeneration.model_json_schema()

        assert "properties" in schema
        assert "classifications" in schema["properties"]
        assert "total_questions" in schema["properties"]

    def test_schema_size_reasonable(self):
        """Test that schema size is reasonable for structured output."""
        schema = DiagramClassificationGeneration.model_json_schema()
        schema_str = json.dumps(schema)

        # Should be under 5KB for efficient structured output
        assert len(schema_str) < 5000, f"Schema too large: {len(schema_str)} chars"

    def test_tool_literal_values(self):
        """Test that tool field accepts valid literal values."""
        valid_tools = ["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "NONE"]

        for tool in valid_tools:
            classification = QuestionClassificationGeneration(
                question_id="q1",
                question_number=1,
                tool=tool,
                confidence="HIGH",
                reasoning_selected_because="Test",
                reasoning_content_analysis="Test",
                reasoning_decision_rule="Rule 1",
                reasoning_alternatives_rejected="None",
                reasoning_summary="Test",
                curriculum_topic="Test",
                diagram_key_elements=[]
            )
            assert classification.tool == tool

    def test_confidence_literal_values(self):
        """Test that confidence field accepts valid literal values."""
        valid_confidences = ["HIGH", "MEDIUM", "LOW"]

        for conf in valid_confidences:
            classification = QuestionClassificationGeneration(
                question_id="q1",
                question_number=1,
                tool="NONE",
                confidence=conf,
                reasoning_selected_because="Test",
                reasoning_content_analysis="Test",
                reasoning_decision_rule="Rule 1",
                reasoning_alternatives_rejected="None",
                reasoning_summary="Test",
                curriculum_topic="Test",
                diagram_key_elements=[]
            )
            assert classification.confidence == conf

    def test_optional_fields_default_to_none(self):
        """Test that optional fields default to None."""
        classification = QuestionClassificationGeneration(
            question_id="q1",
            question_number=1,
            tool="NONE",
            confidence="HIGH",
            reasoning_selected_because="Test",
            reasoning_content_analysis="Test",
            reasoning_decision_rule="Rule 1",
            reasoning_alternatives_rejected="None",
            reasoning_summary="Test",
            curriculum_topic="Test",
            diagram_key_elements=[]
        )

        assert classification.visualization_focus is None
        assert classification.alternative_tool is None
        assert classification.diagram_educational_purpose is None


class TestSchemaConversion:
    """Tests for convert_to_full_schema function."""

    def test_convert_simplified_to_full(self, sample_classification_output_simplified):
        """Test conversion from simplified to full schema."""
        full = convert_to_full_schema(sample_classification_output_simplified)

        # Check top-level fields preserved
        assert full["batch_mode"] is True
        assert full["total_questions"] == 4
        assert full["questions_needing_diagrams"] == 2
        assert full["questions_no_diagram"] == 2

        # Check classifications converted
        assert len(full["classifications"]) == 4

        # Check first classification (NONE tool)
        c1 = full["classifications"][0]
        assert c1["question_id"] == "q1"
        assert c1["tool"] == "NONE"
        assert "reasoning" in c1
        assert c1["reasoning"]["selected_because"] == "Pure numerical conversion, no visualization needed"
        assert c1["diagram_specs"] is None

        # Check third classification (DESMOS tool - has diagram_specs)
        c3 = full["classifications"][2]
        assert c3["question_id"] == "q3"
        assert c3["tool"] == "DESMOS"
        assert c3["diagram_specs"] is not None
        assert "line" in c3["diagram_specs"]["key_elements"]

    def test_conversion_handles_empty_classifications(self):
        """Test conversion handles empty classifications array."""
        simplified = {
            "batch_mode": True,
            "total_questions": 0,
            "questions_needing_diagrams": 0,
            "questions_no_diagram": 0,
            "classifications": []
        }

        full = convert_to_full_schema(simplified)
        assert full["classifications"] == []

    def test_reasoning_fields_mapped_correctly(self, sample_classification_output_simplified):
        """Test that reasoning fields are mapped to nested structure."""
        full = convert_to_full_schema(sample_classification_output_simplified)

        c = full["classifications"][2]  # DESMOS classification
        reasoning = c["reasoning"]

        assert "selected_because" in reasoning
        assert "content_analysis" in reasoning
        assert "decision_rule_applied" in reasoning
        assert "alternatives_rejected" in reasoning
        assert "summary" in reasoning


class TestDiagramClassificationResultSchema:
    """Tests for full classification result schema validation."""

    def test_validate_full_schema(self, sample_classification_output_full):
        """Test that full schema validates correctly."""
        result = DiagramClassificationResult.model_validate(sample_classification_output_full)

        assert result.batch_mode is True
        assert result.total_questions == 4
        assert result.questions_needing_diagrams == 2
        assert len(result.classifications) == 4

    def test_validate_counts_correct(self, sample_classification_output_full):
        """Test that count validation passes with correct counts."""
        result = DiagramClassificationResult.model_validate(sample_classification_output_full)
        assert result.validate_counts() is True

    def test_validate_counts_incorrect_raises(self, sample_classification_output_full):
        """Test that incorrect counts raise validation error."""
        sample_classification_output_full["total_questions"] = 10  # Wrong

        result = DiagramClassificationResult.model_validate(sample_classification_output_full)
        with pytest.raises(ValueError, match="total_questions"):
            result.validate_counts()


# ═══════════════════════════════════════════════════════════════════════════
# UNIT TESTS - Agent Methods
# ═══════════════════════════════════════════════════════════════════════════


class TestDiagramClassifierAgentMethods:
    """Tests for DiagramClassifierAgent helper methods."""

    def test_create_classification_input(
        self,
        sample_mock_exam_data,
        sample_context_data,
        tmp_path
    ):
        """Test classification input creation from mock exam."""
        from src.agents.diagram_classifier_agent import DiagramClassifierAgent

        agent = DiagramClassifierAgent(workspace_path=tmp_path)

        classification_input = agent._create_classification_input(
            sample_mock_exam_data,
            sample_context_data
        )

        assert classification_input["batch_mode"] is True
        assert classification_input["exam_metadata"]["subject"] == "mathematics"
        assert classification_input["exam_metadata"]["level"] == "lifeskills"
        assert len(classification_input["questions"]) == 4

        # Check first question extracted
        q1 = classification_input["questions"][0]
        assert q1["question_id"] == "q1"
        assert q1["question_number"] == 1
        assert "supermarket" in q1["question_stem"]

    def test_fix_classification_counts(self, tmp_path):
        """Test that count correction works correctly."""
        from src.agents.diagram_classifier_agent import DiagramClassifierAgent

        agent = DiagramClassifierAgent(workspace_path=tmp_path)

        raw_json = {
            "total_questions": 999,  # Wrong
            "questions_needing_diagrams": 999,  # Wrong
            "questions_no_diagram": 999,  # Wrong
            "classifications": [
                {"question_id": "q1", "tool": "NONE"},
                {"question_id": "q2", "tool": "DESMOS"},
                {"question_id": "q3", "tool": "PLOTLY"}
            ]
        }

        corrected = agent._fix_classification_counts(raw_json)

        assert corrected["total_questions"] == 3
        assert corrected["questions_needing_diagrams"] == 2  # DESMOS + PLOTLY
        assert corrected["questions_no_diagram"] == 1  # NONE

    def test_build_prompt_includes_questions(
        self,
        sample_mock_exam_data,
        sample_context_data,
        tmp_path
    ):
        """Test that prompt includes question data."""
        from src.agents.diagram_classifier_agent import DiagramClassifierAgent

        agent = DiagramClassifierAgent(workspace_path=tmp_path)

        classification_input = agent._create_classification_input(
            sample_mock_exam_data,
            sample_context_data
        )

        prompt = agent._build_prompt(classification_input)

        assert "Total Questions: 4" in prompt
        assert "mathematics" in prompt
        assert "lifeskills" in prompt


# ═══════════════════════════════════════════════════════════════════════════
# UNIT TESTS - Prompt Quality (addressing "noisy prompts" issue)
# ═══════════════════════════════════════════════════════════════════════════


class TestPromptQuality:
    """Tests to ensure prompts are clean and focused, not noisy."""

    def test_prompt_file_exists(self):
        """Test that clean prompt file exists."""
        prompts_dir = Path(__file__).parent.parent / "src" / "prompts"
        prompt_path = prompts_dir / "diagram_classifier_prompt.md"

        assert prompt_path.exists(), f"Prompt file not found: {prompt_path}"

    def test_prompt_is_concise(self):
        """Test that prompt is not too long (noisy prompt check)."""
        prompts_dir = Path(__file__).parent.parent / "src" / "prompts"
        prompt_path = prompts_dir / "diagram_classifier_prompt.md"

        content = prompt_path.read_text()

        # Check prompt is under 3000 chars (concise)
        assert len(content) < 3000, f"Prompt too long: {len(content)} chars"

        # Check line count is reasonable
        lines = content.split("\n")
        assert len(lines) < 80, f"Prompt has too many lines: {len(lines)}"

    def test_prompt_has_clear_structure(self):
        """Test that prompt has clear sections."""
        prompts_dir = Path(__file__).parent.parent / "src" / "prompts"
        prompt_path = prompts_dir / "diagram_classifier_prompt.md"

        content = prompt_path.read_text()

        # Check for key sections
        assert "# Diagram Classifier" in content
        assert "Tool Selection Guide" in content
        assert "Decision Priority" in content
        assert "Output Requirements" in content

    def test_prompt_avoids_excessive_examples(self):
        """Test that prompt doesn't have too many examples (noise)."""
        prompts_dir = Path(__file__).parent.parent / "src" / "prompts"
        prompt_path = prompts_dir / "diagram_classifier_prompt.md"

        content = prompt_path.read_text()

        # Count code blocks (examples)
        code_blocks = content.count("```")

        # Should have few examples (max 2-3 code blocks)
        assert code_blocks <= 6, f"Too many code examples: {code_blocks // 2}"


# ═══════════════════════════════════════════════════════════════════════════
# INTEGRATION TEST - Real Agent Execution
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
@pytest.mark.asyncio
async def test_diagram_classifier_full_execution():
    """Integration test: Run full diagram classifier with real Claude Agent SDK.

    This test requires:
    - Claude Code subscription (uses claude-agent-sdk)
    - Workspace at workspace/20251205_220701 with mock_exam.json

    Marked as integration test - skip in unit test runs.
    """
    import asyncio
    from src.agents.diagram_classifier_agent import run_diagram_classifier
    from src.utils.logging_config import setup_logging

    setup_logging(log_level="INFO")

    # Use existing workspace from previous tests
    workspace_path = Path("workspace/20251205_220701")

    if not workspace_path.exists():
        pytest.skip(f"Integration test workspace not found: {workspace_path}")

    # Check required files
    if not (workspace_path / "mock_exam.json").exists():
        pytest.skip("mock_exam.json not found in workspace")
    if not (workspace_path / "sow_context.json").exists():
        pytest.skip("sow_context.json not found in workspace")

    # Run the classifier
    result = await run_diagram_classifier(workspace_path=workspace_path)

    # Validate result
    assert result is not None
    assert isinstance(result, DiagramClassificationResult)

    # Check structure
    assert result.batch_mode is True
    assert result.total_questions > 0
    assert len(result.classifications) == result.total_questions

    # Check counts are consistent
    assert result.validate_counts() is True

    # Log results
    print()
    print("=" * 60)
    print("INTEGRATION TEST RESULTS")
    print("=" * 60)
    print(f"Total Questions: {result.total_questions}")
    print(f"Need Diagrams: {result.questions_needing_diagrams}")
    print(f"No Diagram: {result.questions_no_diagram}")

    # Show tool distribution
    tool_counts: Dict[str, int] = {}
    for c in result.classifications:
        tool_counts[c.tool] = tool_counts.get(c.tool, 0) + 1
    print("Tool distribution:")
    for tool, count in sorted(tool_counts.items()):
        print(f"   {tool}: {count}")

    # Verify output file created
    output_file = workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE
    assert output_file.exists(), "classification_output.json not created"


# ═══════════════════════════════════════════════════════════════════════════
# TEST CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════


def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires Claude subscription)"
    )
