"""Unit tests for Practice Question Models.

Tests Pydantic validation for:
- WorkedExample
- ExtractedBlock
- BlockExtractionResult
- GeneratedQuestion
- QuestionBatch
- QuestionGenerationResult
"""

import pytest
from pydantic import ValidationError
import hashlib
import json

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from models.practice_question_models import (
    WorkedExample,
    ConceptBlockContent,
    ExtractedBlock,
    BlockExtractionResult,
    MultipleChoiceOption,
    QuestionContent,
    GeneratedQuestion,
    QuestionBatch,
    QuestionGenerationResult,
    DifficultyLevel,
    QuestionType,
    DiagramToolType,
    BLOCK_EXTRACTION_INPUT_FILE,
    BLOCK_EXTRACTION_OUTPUT_FILE,
    QUESTION_GENERATION_OUTPUT_FILE
)


# =============================================================================
# WorkedExample Tests
# =============================================================================

class TestWorkedExample:
    """Tests for WorkedExample model."""

    def test_valid_worked_example(self):
        """Test valid worked example."""
        example = WorkedExample(
            problem="Calculate 2/5 + 1/5",
            solution_steps=[
                "Keep the denominator the same: 5",
                "Add the numerators: 2 + 1 = 3",
                "Write the answer: 3/5"
            ],
            final_answer="3/5"
        )
        assert example.problem == "Calculate 2/5 + 1/5"
        assert len(example.solution_steps) == 3

    def test_worked_example_problem_too_short_raises_error(self):
        """Test that problem under 10 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            WorkedExample(
                problem="2+3",  # Too short
                solution_steps=["Add them"],
                final_answer="5"
            )
        assert "at least 10" in str(exc_info.value)

    def test_worked_example_empty_steps_raises_error(self):
        """Test that empty solution_steps raises error."""
        with pytest.raises(ValidationError) as exc_info:
            WorkedExample(
                problem="Calculate the sum of 2 and 3",
                solution_steps=[],  # Empty
                final_answer="5"
            )
        assert "at least 1" in str(exc_info.value)

    def test_worked_example_empty_answer_raises_error(self):
        """Test that empty final_answer raises error."""
        with pytest.raises(ValidationError) as exc_info:
            WorkedExample(
                problem="Calculate the sum of 2 and 3",
                solution_steps=["2 + 3 = 5"],
                final_answer=""  # Empty
            )
        assert "at least 1" in str(exc_info.value)


# =============================================================================
# ConceptBlockContent Tests
# =============================================================================

class TestConceptBlockContent:
    """Tests for ConceptBlockContent model (storage bucket content)."""

    def test_valid_concept_block_content(self):
        """Test valid concept block content."""
        content = ConceptBlockContent(
            explanation="When adding fractions with the same denominator, keep the denominator and add numerators.",
            worked_example=WorkedExample(
                problem="Calculate 1/4 + 2/4",
                solution_steps=["Add numerators: 1 + 2 = 3", "Keep denominator: 4"],
                final_answer="3/4"
            ),
            key_formulas=["a/c + b/c = (a+b)/c"],
            common_misconceptions=["Adding both numerator and denominator"]
        )
        assert "same denominator" in content.explanation

    def test_concept_block_content_explanation_too_short_raises_error(self):
        """Test that explanation under 20 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            ConceptBlockContent(
                explanation="Too short"  # Under 20 chars
            )
        assert "at least 20" in str(exc_info.value)

    def test_concept_block_content_optional_fields(self):
        """Test that optional fields can be omitted."""
        content = ConceptBlockContent(
            explanation="This explanation is definitely long enough to pass validation."
        )
        assert content.worked_example is None
        assert content.key_formulas == []
        assert content.common_misconceptions == []


# =============================================================================
# ExtractedBlock Tests
# =============================================================================

class TestExtractedBlock:
    """Tests for ExtractedBlock model."""

    @pytest.fixture
    def valid_block_data(self):
        """Valid extracted block data."""
        return {
            "block_id": "block_001",
            "title": "Adding Fractions with Same Denominator",
            "explanation_preview": "Learn to add fractions when they have the same bottom number...",
            "explanation": "When adding fractions with the same denominator, we keep the denominator the same and add the numerators. For example, 1/4 + 2/4 = 3/4.",
            "worked_example": {
                "problem": "Calculate 2/5 + 1/5",
                "solution_steps": [
                    "Keep the denominator: 5",
                    "Add numerators: 2 + 1 = 3",
                    "Answer: 3/5"
                ],
                "final_answer": "3/5"
            },
            "key_formulas": ["a/c + b/c = (a+b)/c"],
            "common_misconceptions": ["Adding denominators too"],
            "outcome_refs": ["AS1.2"],
            "card_refs": ["card_001", "card_002"]
        }

    def test_valid_extracted_block(self, valid_block_data):
        """Test valid extracted block."""
        block = ExtractedBlock(**valid_block_data)
        assert block.block_id == "block_001"
        assert block.title == "Adding Fractions with Same Denominator"

    def test_extracted_block_title_too_long_raises_error(self, valid_block_data):
        """Test that title over 255 chars raises error."""
        valid_block_data["title"] = "x" * 256
        with pytest.raises(ValidationError) as exc_info:
            ExtractedBlock(**valid_block_data)
        assert "at most 255" in str(exc_info.value)

    def test_extracted_block_preview_too_long_raises_error(self, valid_block_data):
        """Test that explanation_preview over 500 chars raises error."""
        valid_block_data["explanation_preview"] = "x" * 501
        with pytest.raises(ValidationError) as exc_info:
            ExtractedBlock(**valid_block_data)
        assert "at most 500" in str(exc_info.value)

    def test_extracted_block_compute_content_hash(self, valid_block_data):
        """Test content hash computation."""
        block = ExtractedBlock(**valid_block_data)
        hash1 = block.compute_content_hash()

        # Same content should produce same hash
        block2 = ExtractedBlock(**valid_block_data)
        hash2 = block2.compute_content_hash()
        assert hash1 == hash2

        # Different content should produce different hash
        valid_block_data["title"] = "Different Title Here"
        block3 = ExtractedBlock(**valid_block_data)
        hash3 = block3.compute_content_hash()
        assert hash1 != hash3

    def test_extracted_block_get_storage_content(self, valid_block_data):
        """Test getting storage content from block."""
        block = ExtractedBlock(**valid_block_data)
        storage_content = block.get_storage_content()

        assert isinstance(storage_content, ConceptBlockContent)
        assert storage_content.explanation == block.explanation
        assert storage_content.worked_example is not None

    def test_extracted_block_without_optional_fields(self, valid_block_data):
        """Test extracted block with minimal fields."""
        minimal_data = {
            "block_id": "block_001",
            "title": "Minimal Block",
            "explanation_preview": "Preview text here...",
            "explanation": "Full explanation text here"
        }
        block = ExtractedBlock(**minimal_data)
        assert block.worked_example is None
        assert block.key_formulas == []


# =============================================================================
# BlockExtractionResult Tests
# =============================================================================

class TestBlockExtractionResult:
    """Tests for BlockExtractionResult model."""

    @pytest.fixture
    def valid_extraction_result(self, sample_extracted_block):
        """Valid block extraction result."""
        return {
            "lesson_template_id": "template_001",
            "lesson_title": "Introduction to Fractions",
            "total_blocks": 1,
            "blocks": [sample_extracted_block]
        }

    def test_valid_extraction_result(self, valid_extraction_result):
        """Test valid extraction result."""
        result = BlockExtractionResult(**valid_extraction_result)
        assert result.lesson_template_id == "template_001"
        assert result.total_blocks == 1
        assert len(result.blocks) == 1

    def test_extraction_result_empty_blocks_raises_error(self, valid_extraction_result):
        """Test that empty blocks array raises error."""
        valid_extraction_result["blocks"] = []
        valid_extraction_result["total_blocks"] = 0
        with pytest.raises(ValidationError) as exc_info:
            BlockExtractionResult(**valid_extraction_result)
        assert "At least one block must be extracted" in str(exc_info.value)


# =============================================================================
# MultipleChoiceOption Tests
# =============================================================================

class TestMultipleChoiceOption:
    """Tests for MultipleChoiceOption model."""

    def test_valid_option(self):
        """Test valid MCQ option."""
        option = MultipleChoiceOption(
            label="A",
            text="3/5",
            is_correct=True
        )
        assert option.label == "A"
        assert option.is_correct is True

    def test_option_default_not_correct(self):
        """Test that is_correct defaults to False."""
        option = MultipleChoiceOption(
            label="B",
            text="Wrong answer"
        )
        assert option.is_correct is False


# =============================================================================
# GeneratedQuestion Tests
# =============================================================================

class TestGeneratedQuestion:
    """Tests for GeneratedQuestion model."""

    @pytest.fixture
    def valid_question_data(self):
        """Valid generated question data."""
        return {
            "question_id": "pq_001",
            "block_id": "block_001",
            "block_title": "Adding Fractions",
            "difficulty": "easy",
            "question_type": "numeric",
            "stem_preview": "Calculate: 1/6 + 2/6",
            "stem": "Calculate: $\\frac{1}{6} + \\frac{2}{6}$",
            "correct_answer": "3/6 or 1/2",
            "solution": "1/6 + 2/6 = 3/6 = 1/2 (simplified)",
            "hints": ["Keep denominator same", "Add numerators"],
            "diagram_needed": False,
            "diagram_tool": "NONE"
        }

    def test_valid_generated_question(self, valid_question_data):
        """Test valid generated question."""
        question = GeneratedQuestion(**valid_question_data)
        assert question.question_id == "pq_001"
        assert question.difficulty == "easy"
        assert question.diagram_tool == "NONE"

    def test_generated_question_invalid_difficulty_raises_error(self, valid_question_data):
        """Test that invalid difficulty raises error."""
        valid_question_data["difficulty"] = "very_hard"  # Not valid
        with pytest.raises(ValidationError) as exc_info:
            GeneratedQuestion(**valid_question_data)
        assert "difficulty" in str(exc_info.value).lower()

    def test_generated_question_invalid_type_raises_error(self, valid_question_data):
        """Test that invalid question_type raises error."""
        valid_question_data["question_type"] = "essay"  # Not valid
        with pytest.raises(ValidationError) as exc_info:
            GeneratedQuestion(**valid_question_data)
        assert "question_type" in str(exc_info.value).lower()

    def test_generated_question_invalid_diagram_tool_raises_error(self, valid_question_data):
        """Test that invalid diagram_tool raises error."""
        valid_question_data["diagram_tool"] = "PHOTOSHOP"  # Not valid
        with pytest.raises(ValidationError) as exc_info:
            GeneratedQuestion(**valid_question_data)
        assert "diagram_tool" in str(exc_info.value).lower()

    def test_generated_question_with_mcq_options(self, valid_question_data):
        """Test question with MCQ options."""
        valid_question_data["question_type"] = "multiple_choice"
        valid_question_data["options"] = [
            {"label": "A", "text": "3/6", "is_correct": True},
            {"label": "B", "text": "3/12", "is_correct": False},
            {"label": "C", "text": "2/6", "is_correct": False},
            {"label": "D", "text": "1/3", "is_correct": False}
        ]
        question = GeneratedQuestion(**valid_question_data)
        assert len(question.options) == 4
        assert question.options[0].is_correct is True

    def test_generated_question_compute_content_hash(self, valid_question_data):
        """Test content hash computation."""
        question = GeneratedQuestion(**valid_question_data)
        hash1 = question.compute_content_hash()

        # Same content should produce same hash
        question2 = GeneratedQuestion(**valid_question_data)
        hash2 = question2.compute_content_hash()
        assert hash1 == hash2

        # Different stem should produce different hash
        valid_question_data["stem"] = "Different question stem"
        question3 = GeneratedQuestion(**valid_question_data)
        hash3 = question3.compute_content_hash()
        assert hash1 != hash3

    def test_generated_question_get_storage_content(self, valid_question_data):
        """Test getting storage content from question."""
        question = GeneratedQuestion(**valid_question_data)
        storage_content = question.get_storage_content()

        assert isinstance(storage_content, QuestionContent)
        assert storage_content.stem == question.stem
        assert storage_content.correct_answer == question.correct_answer

    def test_generated_question_all_difficulty_levels(self, valid_question_data):
        """Test all valid difficulty levels."""
        for difficulty in ["easy", "medium", "hard"]:
            valid_question_data["difficulty"] = difficulty
            question = GeneratedQuestion(**valid_question_data)
            assert question.difficulty == difficulty

    def test_generated_question_all_question_types(self, valid_question_data):
        """Test all valid question types."""
        for qtype in ["multiple_choice", "numeric", "short_answer", "worked_example"]:
            valid_question_data["question_type"] = qtype
            question = GeneratedQuestion(**valid_question_data)
            assert question.question_type == qtype

    def test_generated_question_all_diagram_tools(self, valid_question_data):
        """Test all valid diagram tools."""
        tools = ["NONE", "DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION"]
        for tool in tools:
            valid_question_data["diagram_tool"] = tool
            question = GeneratedQuestion(**valid_question_data)
            assert question.diagram_tool == tool


# =============================================================================
# QuestionBatch Tests
# =============================================================================

class TestQuestionBatch:
    """Tests for QuestionBatch model."""

    def test_valid_question_batch(self, sample_generated_question):
        """Test valid question batch."""
        batch = QuestionBatch(
            block_id="block_001",
            difficulty="easy",
            questions=[sample_generated_question]
        )
        assert batch.block_id == "block_001"
        assert batch.difficulty == "easy"
        assert len(batch.questions) == 1

    def test_question_batch_empty_questions_raises_error(self):
        """Test that empty questions array raises error."""
        with pytest.raises(ValidationError) as exc_info:
            QuestionBatch(
                block_id="block_001",
                difficulty="easy",
                questions=[]  # Empty
            )
        assert "At least one question" in str(exc_info.value)


# =============================================================================
# QuestionGenerationResult Tests
# =============================================================================

class TestQuestionGenerationResult:
    """Tests for QuestionGenerationResult model."""

    def test_valid_generation_result(self, sample_generated_question):
        """Test valid question generation result."""
        result = QuestionGenerationResult(
            lesson_template_id="template_001",
            execution_id="exec_20251221_100000",
            total_questions=1,
            questions_by_difficulty={"easy": 1, "medium": 0, "hard": 0},
            questions=[sample_generated_question]
        )
        assert result.lesson_template_id == "template_001"
        assert result.total_questions == 1

    def test_generation_result_with_multiple_difficulties(self, sample_generated_question):
        """Test result with questions at multiple difficulties."""
        easy_q = sample_generated_question.copy()
        medium_q = sample_generated_question.copy()
        medium_q["question_id"] = "pq_002"
        medium_q["difficulty"] = "medium"
        hard_q = sample_generated_question.copy()
        hard_q["question_id"] = "pq_003"
        hard_q["difficulty"] = "hard"

        result = QuestionGenerationResult(
            lesson_template_id="template_001",
            execution_id="exec_001",
            total_questions=3,
            questions_by_difficulty={"easy": 1, "medium": 1, "hard": 1},
            questions=[easy_q, medium_q, hard_q]
        )
        assert result.total_questions == 3
        assert len(result.questions) == 3


# =============================================================================
# File Constants Tests
# =============================================================================

class TestFileConstants:
    """Tests for file name constants."""

    def test_block_extraction_input_file(self):
        """Test block extraction input file name."""
        assert BLOCK_EXTRACTION_INPUT_FILE == "lesson_template_input.json"

    def test_block_extraction_output_file(self):
        """Test block extraction output file name."""
        assert BLOCK_EXTRACTION_OUTPUT_FILE == "extracted_blocks.json"

    def test_question_generation_output_file(self):
        """Test question generation output file name."""
        assert QUESTION_GENERATION_OUTPUT_FILE == "generated_questions.json"
