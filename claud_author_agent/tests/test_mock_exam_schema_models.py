"""Unit tests for Mock Exam Schema Models.

Tests Pydantic validation for:
- QuestionType, Difficulty, CalculatorPolicy enums
- StandardRef (unit-based and skills-based)
- Misconception
- MarkingStep, AnswerKey
- MockExamQuestion
- MockExamSection
- MockExamMetadata
- Full MockExam validation
"""

import pytest
from pydantic import ValidationError

import sys
from pathlib import Path

# Add src/tools directly to bypass __init__.py which has SDK dependencies
src_tools_path = Path(__file__).parent.parent / "src" / "tools"
sys.path.insert(0, str(src_tools_path))

from mock_exam_schema_models import (
    QuestionType,
    Difficulty,
    CalculatorPolicy,
    CEFRLevel,
    StandardRef,
    Misconception,
    MarkingStep,
    AnswerKey,
    WorkedSolution,
    CFUConfig,
    Question,  # Note: Named "Question" not "MockExamQuestion"
    Section,   # Note: Named "Section" not "MockExamSection"
    AccessibilityProfile,
    ExamMetadata,  # Note: Named "ExamMetadata" not "MockExamMetadata"
    ExamSummary,   # Note: Named "ExamSummary" not "MockExamSummary"
    MockExam
)

# Aliases for cleaner test naming
MockExamQuestion = Question
MockExamSection = Section
MockExamMetadata = ExamMetadata
MockExamSummary = ExamSummary


# =============================================================================
# Enum Tests
# =============================================================================

class TestQuestionType:
    """Tests for QuestionType enum."""

    def test_all_question_types(self):
        """Test all valid question types exist."""
        assert QuestionType.MCQ.value == "mcq"
        assert QuestionType.MCQ_MULTISELECT.value == "mcq_multiselect"
        assert QuestionType.NUMERIC.value == "numeric"
        assert QuestionType.SHORT_TEXT.value == "short_text"
        assert QuestionType.STRUCTURED_RESPONSE.value == "structured_response"

    def test_question_type_count(self):
        """Test that exactly 5 question types exist."""
        assert len(QuestionType) == 5


class TestDifficulty:
    """Tests for Difficulty enum."""

    def test_all_difficulties(self):
        """Test all valid difficulties exist."""
        assert Difficulty.EASY.value == "easy"
        assert Difficulty.MEDIUM.value == "medium"
        assert Difficulty.HARD.value == "hard"

    def test_difficulty_count(self):
        """Test that exactly 3 difficulties exist."""
        assert len(Difficulty) == 3


class TestCalculatorPolicy:
    """Tests for CalculatorPolicy enum."""

    def test_all_calculator_policies(self):
        """Test all valid calculator policies exist."""
        assert CalculatorPolicy.NON_CALC.value == "non_calc"
        assert CalculatorPolicy.CALC.value == "calc"
        assert CalculatorPolicy.MIXED.value == "mixed"
        assert CalculatorPolicy.EXAM_CONDITIONS.value == "exam_conditions"


# =============================================================================
# StandardRef Tests
# =============================================================================

class TestStandardRef:
    """Tests for StandardRef model (mock exam version)."""

    def test_valid_unit_based_reference(self):
        """Test valid unit-based reference."""
        ref = StandardRef(
            code="AS1.2",
            outcome="O1",
            description="Add and subtract fractions with same denominator"
        )
        assert ref.code == "AS1.2"
        assert ref.outcome == "O1"

    def test_valid_skills_based_reference(self):
        """Test valid skills-based reference."""
        ref = StandardRef(
            skill_name="Working with surds",
            description="Simplification and rationalisation"
        )
        assert ref.skill_name == "Working with surds"

    def test_mixed_reference_raises_error(self):
        """Test that mixing both types raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardRef(
                code="AS1.2",
                outcome="O1",
                skill_name="Mixed",
                description="Cannot mix both"
            )
        assert "Cannot mix" in str(exc_info.value)

    def test_empty_reference_raises_error(self):
        """Test that empty reference raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardRef(
                description="No type specified"
            )
        assert "Must provide either" in str(exc_info.value)


# =============================================================================
# Misconception Tests
# =============================================================================

class TestMisconception:
    """Tests for Misconception model."""

    def test_valid_misconception(self):
        """Test valid misconception."""
        misc = Misconception(
            error_pattern="135p",
            feedback="Remember to convert pounds to pence first - £1 = 100p"
        )
        assert misc.error_pattern == "135p"

    def test_misconception_feedback_too_short_raises_error(self):
        """Test that feedback under 10 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            Misconception(
                error_pattern="wrong",
                feedback="Short"  # Too short
            )
        assert "at least 10" in str(exc_info.value)


# =============================================================================
# MarkingStep Tests
# =============================================================================

class TestMarkingStep:
    """Tests for MarkingStep model."""

    def test_valid_marking_step(self):
        """Test valid marking step."""
        step = MarkingStep(
            step="Correctly identifies the conversion factor",
            marks=1
        )
        assert step.marks == 1

    def test_marking_step_zero_marks_raises_error(self):
        """Test that 0 marks raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MarkingStep(
                step="This step has no marks",
                marks=0
            )
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_marking_step_too_many_marks_raises_error(self):
        """Test that >10 marks raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MarkingStep(
                step="This step has too many marks",
                marks=11
            )
        assert "less than or equal to 10" in str(exc_info.value)

    def test_marking_step_description_too_short_raises_error(self):
        """Test that step under 5 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MarkingStep(
                step="Hi",
                marks=1
            )
        assert "at least 5" in str(exc_info.value)


# =============================================================================
# AnswerKey Tests
# =============================================================================

class TestAnswerKey:
    """Tests for AnswerKey model."""

    def test_valid_answer_key(self):
        """Test valid answer key."""
        key = AnswerKey(
            correct_answer="135",
            acceptable_variations=["135p", "135 pence"],
            marking_scheme=[
                {"step": "Correct conversion", "marks": 3}
            ]
        )
        assert key.correct_answer == "135"
        assert len(key.acceptable_variations) == 2

    def test_answer_key_empty_marking_scheme_raises_error(self):
        """Test that empty marking scheme raises error."""
        with pytest.raises(ValidationError) as exc_info:
            AnswerKey(
                correct_answer="135",
                marking_scheme=[]  # Empty
            )
        assert "at least 1" in str(exc_info.value)


# =============================================================================
# MockExamQuestion Tests
# =============================================================================

class TestMockExamQuestion:
    """Tests for MockExamQuestion model."""

    @pytest.fixture
    def valid_question_data(self):
        """Valid mock exam question data."""
        return {
            "question_id": "q1",
            "question_number": 1,
            "marks": 3,
            "difficulty": "easy",
            "estimated_minutes": 3,
            "standards_addressed": [
                {
                    "code": "AS1.1",
                    "outcome": "O1",
                    "description": "Numerical notation"
                }
            ],
            "question_stem": "A supermarket sells milk for £1.35 per litre. Write this amount in pence.",
            "question_stem_plain": "A supermarket sells milk for one pound thirty-five pence per litre. Write this amount in pence.",
            "question_type": "numeric",
            "cfu_config": {
                "type": "numeric",
                "expected_answer": 135,
                "answer_key": {
                    "correct_answer": "135",
                    "marking_scheme": [
                        {"step": "Correct conversion", "marks": 3}
                    ]
                }
            },
            "hints": [
                {"hint_number": 1, "hint_text": "Remember £1 = 100p"}
            ]
        }

    def test_valid_mock_exam_question(self, valid_question_data):
        """Test valid mock exam question."""
        question = MockExamQuestion(**valid_question_data)
        assert question.question_id == "q1"
        assert question.marks == 3

    def test_question_zero_marks_raises_error(self, valid_question_data):
        """Test that 0 marks raises error."""
        valid_question_data["marks"] = 0
        with pytest.raises(ValidationError) as exc_info:
            MockExamQuestion(**valid_question_data)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_question_negative_estimated_minutes_raises_error(self, valid_question_data):
        """Test that negative estimated_minutes raises error."""
        valid_question_data["estimated_minutes"] = -1
        with pytest.raises(ValidationError) as exc_info:
            MockExamQuestion(**valid_question_data)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_question_stem_too_short_raises_error(self, valid_question_data):
        """Test that question_stem under 10 chars raises error."""
        valid_question_data["question_stem"] = "Short"
        with pytest.raises(ValidationError) as exc_info:
            MockExamQuestion(**valid_question_data)
        assert "at least 10" in str(exc_info.value)


# =============================================================================
# MockExamSection Tests
# =============================================================================

class TestMockExamSection:
    """Tests for MockExamSection model."""

    def test_valid_section(self, sample_mock_exam_question):
        """Test valid mock exam section."""
        section = MockExamSection(
            section_id="section_a",
            section_label="Section A: Non-Calculator",
            section_order=1,
            section_marks=30,
            section_time_allocation=45,
            section_instructions="Do not use a calculator.",
            questions=[sample_mock_exam_question]
        )
        assert section.section_id == "section_a"
        assert len(section.questions) == 1

    def test_section_empty_questions_raises_error(self):
        """Test that empty questions raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSection(
                section_id="section_a",
                section_label="Section A",
                section_order=1,
                section_marks=30,
                section_time_allocation=45,
                section_instructions="Instructions here.",
                questions=[]  # Empty
            )
        assert "at least 1" in str(exc_info.value)

    def test_section_zero_marks_raises_error(self):
        """Test that 0 section_marks raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamSection(
                section_id="section_a",
                section_label="Section A",
                section_order=1,
                section_marks=0,  # Zero
                section_time_allocation=45,
                section_instructions="Instructions here.",
                questions=[{"question_id": "q1", "question_number": 1, "marks": 3, "difficulty": "easy", "estimated_minutes": 3, "standards_addressed": [{"code": "AS1", "outcome": "O1", "description": "Test standard"}], "question_stem": "This is a test question stem long enough", "question_stem_plain": "Plain version of test question stem", "question_type": "numeric", "cfu_config": {"type": "numeric", "answer_key": {"correct_answer": "5", "marking_scheme": [{"step": "Correct", "marks": 3}]}}}]
            )
        assert "greater than or equal to 1" in str(exc_info.value)


# =============================================================================
# MockExamMetadata Tests
# =============================================================================

class TestMockExamMetadata:
    """Tests for MockExamMetadata model."""

    def test_valid_metadata(self):
        """Test valid mock exam metadata."""
        metadata = MockExamMetadata(
            title="National 4 Mathematics - Mock Examination",
            subject="mathematics",
            level="national-4",
            totalMarks=60,
            timeLimit=90,
            instructions="Answer ALL questions in the spaces provided.",
            instructions_plain="Answer every question.",
            calculator_policy="non_calc"
        )
        assert metadata.title == "National 4 Mathematics - Mock Examination"
        assert metadata.totalMarks == 60

    def test_metadata_zero_marks_raises_error(self):
        """Test that 0 totalMarks raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamMetadata(
                title="Test Exam",
                subject="mathematics",
                level="national-4",
                totalMarks=0,  # Zero
                timeLimit=90,
                instructions="Instructions here that are long enough.",
                calculator_policy="non_calc"
            )
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_metadata_zero_time_raises_error(self):
        """Test that 0 timeLimit raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MockExamMetadata(
                title="Test Exam",
                subject="mathematics",
                level="national-4",
                totalMarks=60,
                timeLimit=0,  # Zero
                instructions="Instructions here that are long enough.",
                calculator_policy="non_calc"
            )
        assert "greater than or equal to 1" in str(exc_info.value)


# =============================================================================
# MockExam Full Validation Tests
# =============================================================================

class TestMockExam:
    """Tests for full MockExam model validation."""

    def test_valid_mock_exam(self, sample_mock_exam):
        """Test valid complete mock exam."""
        exam = MockExam(**sample_mock_exam)
        assert exam.examId == "exam_test001"
        assert exam.courseId == "course_test123"
        assert len(exam.sections) == 1

    def test_mock_exam_empty_sections_raises_error(self, sample_mock_exam):
        """Test that empty sections raises error."""
        sample_mock_exam["sections"] = []
        with pytest.raises(ValidationError) as exc_info:
            MockExam(**sample_mock_exam)
        assert "at least 1" in str(exc_info.value)

    def test_mock_exam_required_fields(self):
        """Test that required fields raise error when missing."""
        with pytest.raises(ValidationError) as exc_info:
            MockExam(
                examId="exam_001"
                # Missing other required fields
            )
        # Should mention missing required fields
        error_str = str(exc_info.value)
        assert "courseId" in error_str or "Field required" in error_str


# =============================================================================
# AccessibilityProfile Tests
# =============================================================================

class TestAccessibilityProfileMockExam:
    """Tests for AccessibilityProfile in mock exam context."""

    def test_valid_accessibility_profile(self):
        """Test valid accessibility profile."""
        profile = AccessibilityProfile(
            plain_language_level="B1",
            dyslexia_friendly=True,
            extra_time_percentage=25
        )
        assert profile.plain_language_level == "B1"
        assert profile.extra_time_percentage == 25

    def test_accessibility_extra_time_over_100_raises_error(self):
        """Test that extra_time_percentage over 100 raises error."""
        with pytest.raises(ValidationError) as exc_info:
            AccessibilityProfile(
                plain_language_level="B1",
                dyslexia_friendly=True,
                extra_time_percentage=150  # Over 100
            )
        assert "less than or equal to 100" in str(exc_info.value)

    def test_accessibility_negative_extra_time_raises_error(self):
        """Test that negative extra_time_percentage raises error."""
        with pytest.raises(ValidationError) as exc_info:
            AccessibilityProfile(
                plain_language_level="B1",
                dyslexia_friendly=True,
                extra_time_percentage=-10  # Negative
            )
        assert "greater than or equal to 0" in str(exc_info.value)
