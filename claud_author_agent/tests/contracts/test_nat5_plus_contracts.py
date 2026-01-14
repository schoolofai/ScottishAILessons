"""
Contract Tests: Author Agent → Frontend

Purpose:
    Validates that the Author Agent output matches the contract fixtures
    that the Frontend expects. These tests ensure type compatibility
    between Python Pydantic models and TypeScript interfaces.

Contract Validated:
    - Contract A: Author → Frontend (Exam Data)

Fixtures Used:
    - fixtures/sample_nat5_plus_exam.json

Run:
    pytest claud_author_agent/tests/contracts/test_nat5_plus_contracts.py -v

TDD Phase: 2 (RED - These tests should FAIL until models are implemented)
"""

import json
import pytest
from pathlib import Path

# Get the fixtures directory (relative to project root)
# Path: tests/contracts/test_nat5_plus_contracts.py
# parent.parent.parent = claud_author_agent/
# parent.parent.parent.parent = ScottishAILessons/
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
FIXTURES_DIR = PROJECT_ROOT / "fixtures"


class TestAuthorOutputMatchesFrontendContract:
    """Contract A: Author Agent output must match Frontend TypeScript types."""

    @pytest.fixture
    def sample_exam(self) -> dict:
        """Load the contract fixture for exam data."""
        fixture_path = FIXTURES_DIR / "sample_nat5_plus_exam.json"
        with open(fixture_path, "r") as f:
            return json.load(f)

    def test_author_output_validates_with_pydantic_model(self, sample_exam: dict):
        """CRITICAL: Author output must validate against Pydantic model."""
        # Import the model - this will fail until implemented (RED phase)
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam

        # Validate the fixture against the model
        validated = Nat5PlusMockExam.model_validate(sample_exam)

        # Verify critical fields exist
        assert validated.exam_id is not None
        assert validated.course_id is not None
        assert validated.subject is not None
        assert validated.level is not None

    def test_exam_metadata_structure(self, sample_exam: dict):
        """Verify metadata structure matches expected format."""
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam, ExamMetadata

        validated = Nat5PlusMockExam.model_validate(sample_exam)

        # Metadata must have these fields
        assert validated.metadata.total_marks > 0
        assert validated.metadata.duration_minutes > 0
        assert isinstance(validated.metadata.calculator_allowed, bool)

    def test_question_structure_matches_contract(self, sample_exam: dict):
        """Verify question structure matches what Frontend expects."""
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam

        validated = Nat5PlusMockExam.model_validate(sample_exam)

        # Must have at least one section with questions
        assert len(validated.sections) > 0

        for section in validated.sections:
            assert section.section_id is not None
            assert section.section_name is not None
            assert len(section.questions) > 0

            for question in section.questions:
                # Frontend expects these EXACT field names
                assert hasattr(question, 'question_id')
                assert hasattr(question, 'question_number')
                assert hasattr(question, 'stem')
                assert hasattr(question, 'stem_latex')
                assert hasattr(question, 'marks')
                assert hasattr(question, 'difficulty')
                assert hasattr(question, 'marking_scheme')

    def test_marking_scheme_structure(self, sample_exam: dict):
        """CRITICAL: Marking scheme must have generic + illustrative schemes."""
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam

        validated = Nat5PlusMockExam.model_validate(sample_exam)

        for section in validated.sections:
            for question in section.questions:
                scheme = question.marking_scheme

                # SQA-style marking requires both schemes
                assert hasattr(scheme, 'generic_scheme')
                assert hasattr(scheme, 'illustrative_scheme')
                assert hasattr(scheme, 'max_marks')
                assert scheme.max_marks > 0

                # Generic scheme bullets
                assert len(scheme.generic_scheme) > 0
                for bullet in scheme.generic_scheme:
                    assert hasattr(bullet, 'bullet')
                    assert hasattr(bullet, 'process')
                    assert hasattr(bullet, 'marks')

                # Illustrative scheme bullets
                assert len(scheme.illustrative_scheme) > 0
                for bullet in scheme.illustrative_scheme:
                    assert hasattr(bullet, 'bullet')
                    assert hasattr(bullet, 'answer')

    def test_illustrative_answer_has_required_fields(self, sample_exam: dict):
        """Verify illustrative answers have LaTeX and variations."""
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam

        validated = Nat5PlusMockExam.model_validate(sample_exam)

        for section in validated.sections:
            for question in section.questions:
                for illustrative in question.marking_scheme.illustrative_scheme:
                    # Answer is required
                    assert illustrative.answer is not None

                    # These fields should exist (can be None)
                    assert hasattr(illustrative, 'answer_latex')
                    assert hasattr(illustrative, 'tolerance_range')
                    assert hasattr(illustrative, 'acceptable_variations')

    def test_difficulty_enum_values(self, sample_exam: dict):
        """Verify difficulty uses expected enum values."""
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam

        validated = Nat5PlusMockExam.model_validate(sample_exam)

        valid_difficulties = {"easy", "medium", "hard"}

        for section in validated.sections:
            for question in section.questions:
                assert question.difficulty in valid_difficulties

    def test_status_enum_values(self, sample_exam: dict):
        """Verify status uses expected enum values."""
        from src.models.nat5_plus_exam_models import Nat5PlusMockExam

        validated = Nat5PlusMockExam.model_validate(sample_exam)

        valid_statuses = {"draft", "published", "archived"}
        assert validated.status in valid_statuses


class TestExamGenerationSchemaContract:
    """Contract tests for single question generation schema (smaller output)."""

    def test_question_generation_schema_validates(self):
        """Verify single question generation schema works."""
        from src.models.nat5_plus_question_generation_schema import QuestionGeneration

        # Sample single question output (what the LLM produces)
        question_output = {
            "question_id": "q_test_001",
            "question_number": "1a",
            "marks": 4,
            "difficulty": "medium",
            "stem": "Simplify 2x + 3x",
            "stem_latex": "$2x + 3x$",
            "marking_scheme": {
                "max_marks": 4,
                "generic_scheme": [
                    {"bullet": 1, "process": "Add like terms", "marks": 2},
                    {"bullet": 2, "process": "State answer", "marks": 2}
                ],
                "illustrative_scheme": [
                    {"bullet": 1, "answer": "5x", "answer_latex": "$5x$"}
                ],
                "notes": []
            },
            "diagram_needed": False,
            "diagram_spec": None
        }

        validated = QuestionGeneration.model_validate(question_output)
        assert validated.question_id == "q_test_001"
        assert validated.marks == 4

    def test_exam_plan_schema_validates(self):
        """Verify exam plan schema works."""
        from src.models.nat5_plus_question_generation_schema import ExamPlan, QuestionSpec

        # Sample exam plan output
        plan_output = {
            "question_specs": [
                {
                    "topic": "quadratics",
                    "template_paper_id": "sqa_nat5_2023_p1",
                    "marks": 6,
                    "difficulty": "medium",
                    "question_style": "procedural"
                },
                {
                    "topic": "trigonometry",
                    "template_paper_id": "sqa_nat5_2023_p2",
                    "marks": 4,
                    "difficulty": "easy",
                    "question_style": "application"
                }
            ],
            "target_total_marks": 90,
            "section_distribution": {
                "section_a": 40,
                "section_b": 50
            }
        }

        validated = ExamPlan.model_validate(plan_output)
        assert len(validated.question_specs) == 2
        assert validated.target_total_marks == 90
