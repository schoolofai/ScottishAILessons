"""Pydantic models for Mock Exam schema validation.

This module defines the complete schema for Mock Exam JSON output from the
mock_exam_author agent. Also includes submission and evaluation schemas for
frontend-backend integration.

The mock exam schema transforms SOW mock_exam entries into frontend-ready
question structures with sections, marking schemes, and accessibility support.
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal, Union, Dict, Any
from enum import Enum
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class QuestionType(str, Enum):
    """Valid question types for mock exam questions."""
    MCQ = "mcq"
    MCQ_MULTISELECT = "mcq_multiselect"
    NUMERIC = "numeric"
    SHORT_TEXT = "short_text"
    STRUCTURED_RESPONSE = "structured_response"


class Difficulty(str, Enum):
    """Question difficulty levels for progressive exam design."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class CalculatorPolicy(str, Enum):
    """Calculator policy for exam sections."""
    NON_CALC = "non_calc"
    CALC = "calc"
    MIXED = "mixed"
    EXAM_CONDITIONS = "exam_conditions"


class CEFRLevel(str, Enum):
    """Common European Framework of Reference language levels."""
    CEFR_A1 = "A1"
    CEFR_A2 = "A2"
    CEFR_B1 = "B1"
    CEFR_B2 = "B2"


# ═══════════════════════════════════════════════════════════════════════════════
# STANDARD/SKILL REFERENCES (reuse from SOW)
# ═══════════════════════════════════════════════════════════════════════════════

class StandardRef(BaseModel):
    """Reference to SQA standard/outcome or skill being assessed.

    Supports both:
    - Unit-based courses (National 1-4): type="outcome", code, description
    - Skills-based courses (National 5+): type="skill", skill_name, description
    """
    type: Literal["outcome", "skill"] = Field(
        ...,
        description="Type of reference: 'outcome' for unit-based, 'skill' for skills-based"
    )
    code: Optional[str] = Field(
        None,
        description="Standard code for unit-based courses (e.g., 'MTH 4-03a')"
    )
    skill_name: Optional[str] = Field(
        None,
        description="Skill name for skills-based courses"
    )
    description: str = Field(
        ...,
        min_length=10,
        description="Full description of what this standard/skill assesses"
    )

    @model_validator(mode='after')
    def validate_type_fields(self):
        """Ensure correct fields are present for each type."""
        if self.type == "outcome" and not self.code:
            raise ValueError("Outcome type requires 'code' field")
        if self.type == "skill" and not self.skill_name:
            raise ValueError("Skill type requires 'skill_name' field")
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# MISCONCEPTIONS
# ═══════════════════════════════════════════════════════════════════════════════

class Misconception(BaseModel):
    """Common student misconception with error pattern and feedback."""
    error_pattern: str = Field(..., min_length=1, description="What the student might answer incorrectly (e.g., '350', '40', 'Red')")
    feedback: str = Field(..., min_length=10, description="Corrective feedback to show")


# ═══════════════════════════════════════════════════════════════════════════════
# MARKING SCHEME
# ═══════════════════════════════════════════════════════════════════════════════

class MarkingStep(BaseModel):
    """Single step in a marking scheme with allocated marks."""
    step: str = Field(..., min_length=5, description="What the student should do for this mark")
    marks: int = Field(..., ge=1, le=10, description="Marks allocated for this step")


class AnswerKey(BaseModel):
    """Complete answer key with marking scheme for a question."""
    correct_answer: str = Field(..., min_length=1, description="The correct answer")
    acceptable_variations: List[str] = Field(
        default_factory=list,
        description="Alternative acceptable formats (e.g., '3x²y', '3yx²', '3*x^2*y')"
    )
    marking_scheme: List[MarkingStep] = Field(
        ...,
        min_length=1,
        description="Step-by-step marking criteria"
    )

    @model_validator(mode='after')
    def validate_marking_scheme_sum(self):
        """Calculate total marks from marking scheme."""
        # Total is derived, not validated against external value
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# MCQ OPTIONS (for MCQ question types)
# ═══════════════════════════════════════════════════════════════════════════════

class MCQOption(BaseModel):
    """Single option for MCQ questions."""
    label: str = Field(..., description="Option label (A, B, C, D)")
    text: str = Field(..., min_length=1, description="Option text")
    is_correct: bool = Field(False, description="Whether this is the correct answer")
    feedback: Optional[str] = Field(
        None,
        description="Feedback shown if student selects this option (especially for wrong answers)"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# CFU CONFIG (Check For Understanding configuration)
# ═══════════════════════════════════════════════════════════════════════════════

class CFUConfig(BaseModel):
    """Configuration for question's Check For Understanding response type."""
    type: QuestionType
    expected_format: Optional[str] = Field(
        None,
        description="Expected format hint (e.g., 'algebraic_expression', 'decimal', 'fraction')"
    )
    allow_drawing: bool = Field(
        False,
        description="Whether to show drawing canvas for visual responses"
    )
    options: Optional[List[MCQOption]] = Field(
        None,
        description="MCQ options (required for mcq and mcq_multiselect types)"
    )
    answer_key: AnswerKey

    @model_validator(mode='after')
    def validate_mcq_has_options(self):
        """MCQ types must have options."""
        if self.type in [QuestionType.MCQ, QuestionType.MCQ_MULTISELECT]:
            if not self.options or len(self.options) < 2:
                raise ValueError(
                    f"Question type '{self.type.value}' requires at least 2 options"
                )
            # Validate exactly one correct for MCQ, at least one for multiselect
            correct_count = sum(1 for opt in self.options if opt.is_correct)
            if self.type == QuestionType.MCQ and correct_count != 1:
                raise ValueError(
                    f"MCQ must have exactly 1 correct option, found {correct_count}"
                )
            if self.type == QuestionType.MCQ_MULTISELECT and correct_count < 1:
                raise ValueError(
                    f"MCQ multiselect must have at least 1 correct option, found {correct_count}"
                )
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# WORKED SOLUTION
# ═══════════════════════════════════════════════════════════════════════════════

class WorkedSolution(BaseModel):
    """Step-by-step worked solution for review mode."""
    steps: List[str] = Field(
        ...,
        min_length=1,
        description="Step-by-step solution explanation (can include LaTeX)"
    )
    final_answer: str = Field(..., min_length=1, description="The final answer")


# ═══════════════════════════════════════════════════════════════════════════════
# QUESTION
# ═══════════════════════════════════════════════════════════════════════════════

class Question(BaseModel):
    """Complete exam question with all metadata for frontend rendering."""
    question_id: str = Field(..., min_length=1, description="Unique question identifier (e.g., 'q1')")
    question_number: int = Field(..., ge=1, description="Display question number")
    marks: int = Field(..., ge=1, le=20, description="Total marks for this question")
    difficulty: Difficulty
    estimated_minutes: int = Field(..., ge=1, le=30, description="Estimated time to answer")
    standards_addressed: List[StandardRef] = Field(
        ...,
        min_length=1,
        description="SQA standards/skills being assessed"
    )

    # Question content
    question_stem: str = Field(
        ...,
        min_length=10,
        description="The question text (can include LaTeX for math)"
    )
    question_stem_plain: str = Field(
        ...,
        min_length=10,
        description="Plain language version (CEFR A2-B1 accessible)"
    )

    question_type: QuestionType
    cfu_config: CFUConfig

    # Support content
    hints: List[str] = Field(
        default_factory=list,
        max_length=3,
        description="Optional hints (max 3)"
    )
    misconceptions: List[Misconception] = Field(
        default_factory=list,
        description="Common misconceptions to detect"
    )
    worked_solution: WorkedSolution

    # References
    diagram_refs: List[str] = Field(
        default_factory=list,
        description="IDs of diagrams to display with this question"
    )

    @model_validator(mode='after')
    def validate_marks_match_marking_scheme(self):
        """Ensure marks field matches marking scheme total."""
        scheme_total = sum(step.marks for step in self.cfu_config.answer_key.marking_scheme)
        if scheme_total != self.marks:
            raise ValueError(
                f"Question marks ({self.marks}) must equal marking scheme total ({scheme_total})"
            )
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION
# ═══════════════════════════════════════════════════════════════════════════════

class Section(BaseModel):
    """Exam section grouping related questions."""
    section_id: str = Field(..., min_length=1, description="Unique section ID")
    section_label: str = Field(..., min_length=5, description="Display label (e.g., 'Section A: Non-Calculator')")
    section_order: int = Field(..., ge=1, description="Section order in exam")
    section_marks: int = Field(..., ge=1, description="Total marks in this section")
    section_time_allocation: Optional[int] = Field(
        None,
        ge=1,
        description="Suggested time in minutes for this section"
    )
    section_instructions: str = Field(
        ...,
        min_length=10,
        description="Instructions specific to this section"
    )
    questions: List[Question] = Field(..., min_length=1)

    @model_validator(mode='after')
    def validate_section_marks(self):
        """Ensure section marks equals sum of question marks."""
        questions_total = sum(q.marks for q in self.questions)
        if questions_total != self.section_marks:
            raise ValueError(
                f"Section '{self.section_label}' marks ({self.section_marks}) "
                f"must equal questions total ({questions_total})"
            )
        return self

    @model_validator(mode='after')
    def validate_question_numbers_sequential(self):
        """Validate question numbers are sequential within section."""
        if not self.questions:
            return self

        numbers = [q.question_number for q in self.questions]
        for i in range(1, len(numbers)):
            if numbers[i] != numbers[i-1] + 1:
                raise ValueError(
                    f"Question numbers in section '{self.section_label}' must be sequential, "
                    f"found gap between {numbers[i-1]} and {numbers[i]}"
                )
        return self


# ═══════════════════════════════════════════════════════════════════════════════
# EXAM METADATA
# ═══════════════════════════════════════════════════════════════════════════════

class AccessibilityProfile(BaseModel):
    """Accessibility configuration for the exam."""
    plain_language_level: CEFRLevel = Field(
        default=CEFRLevel.CEFR_B1,
        description="Target CEFR level for plain language versions"
    )
    dyslexia_friendly: bool = Field(
        True,
        description="Whether dyslexia-friendly formatting is available"
    )
    extra_time_percentage: int = Field(
        default=25,
        ge=0,
        le=100,
        description="Extra time allowance percentage"
    )


class ExamMetadata(BaseModel):
    """Top-level exam metadata."""
    title: str = Field(..., min_length=10, description="Full exam title")
    subject: str = Field(..., min_length=3, description="Subject slug (e.g., 'mathematics')")
    level: str = Field(..., min_length=3, description="Level slug (e.g., 'national-5')")
    totalMarks: int = Field(..., ge=1, description="Total marks for entire exam")
    timeLimit: int = Field(..., ge=1, le=180, description="Time limit in minutes")

    instructions: str = Field(
        ...,
        min_length=20,
        description="Full exam instructions"
    )
    instructions_plain: str = Field(
        ...,
        min_length=20,
        description="Plain language instructions (CEFR A2-B1)"
    )

    calculator_policy: CalculatorPolicy
    exam_conditions: bool = Field(
        True,
        description="Whether strict exam conditions apply"
    )
    accessibility_profile: AccessibilityProfile = Field(default_factory=AccessibilityProfile)


# ═══════════════════════════════════════════════════════════════════════════════
# EXAM SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

class StandardsCoverage(BaseModel):
    """Coverage summary for a standard/skill."""
    code: str
    question_count: int


class ExamSummary(BaseModel):
    """Summary statistics for the exam."""
    total_questions: int = Field(..., ge=1)
    questions_by_difficulty: Dict[str, int] = Field(
        ...,
        description="Count by difficulty: {'easy': 5, 'medium': 7, 'hard': 3}"
    )
    questions_by_type: Dict[str, int] = Field(
        ...,
        description="Count by type: {'mcq': 5, 'numeric': 4, 'structured_response': 6}"
    )
    standards_coverage: List[StandardsCoverage] = Field(
        default_factory=list,
        description="Which standards are covered and by how many questions"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK EXAM (Top-Level)
# ═══════════════════════════════════════════════════════════════════════════════

class MockExam(BaseModel):
    """Complete mock exam structure for frontend rendering.

    This is the main output schema from the mock_exam_author agent.
    """
    # Schema version (note: no "$schema" alias - API requires alphanumeric keys only)
    schema_version: str = Field(
        default="mock_exam_v1",
        description="Schema version identifier"
    )

    # Identifiers
    examId: str = Field(..., min_length=1, description="Unique exam identifier")
    courseId: str = Field(..., min_length=1, description="Course this exam belongs to")
    sowId: str = Field(..., min_length=1, description="Source Authored_SOW document ID")
    sowEntryOrder: int = Field(..., ge=1, description="Order of mock_exam entry in SOW")

    # Content
    metadata: ExamMetadata
    sections: List[Section] = Field(..., min_length=1)
    summary: ExamSummary

    # Agent metadata
    generated_at: str = Field(..., description="ISO 8601 timestamp of generation")
    agent_version: str = Field(default="mock_exam_author_v1.0")

    @model_validator(mode='after')
    def validate_total_marks(self):
        """Ensure metadata.totalMarks equals sum of section marks."""
        sections_total = sum(s.section_marks for s in self.sections)
        if sections_total != self.metadata.totalMarks:
            raise ValueError(
                f"Metadata totalMarks ({self.metadata.totalMarks}) "
                f"must equal sections total ({sections_total})"
            )
        return self

    @model_validator(mode='after')
    def validate_summary_matches(self):
        """Validate summary statistics match actual content."""
        # Count questions
        all_questions = [q for s in self.sections for q in s.questions]
        if len(all_questions) != self.summary.total_questions:
            raise ValueError(
                f"Summary total_questions ({self.summary.total_questions}) "
                f"doesn't match actual count ({len(all_questions)})"
            )

        # Count by difficulty
        actual_difficulty = {}
        for q in all_questions:
            key = q.difficulty.value
            actual_difficulty[key] = actual_difficulty.get(key, 0) + 1

        if actual_difficulty != self.summary.questions_by_difficulty:
            raise ValueError(
                f"Summary questions_by_difficulty doesn't match actual: "
                f"expected {actual_difficulty}, got {self.summary.questions_by_difficulty}"
            )

        # Count by type
        actual_types = {}
        for q in all_questions:
            key = q.question_type.value
            actual_types[key] = actual_types.get(key, 0) + 1

        if actual_types != self.summary.questions_by_type:
            raise ValueError(
                f"Summary questions_by_type doesn't match actual: "
                f"expected {actual_types}, got {self.summary.questions_by_type}"
            )

        return self

    class Config:
        str_strip_whitespace = True


# ═══════════════════════════════════════════════════════════════════════════════
# SUBMISSION SCHEMA (Frontend -> Backend)
# ═══════════════════════════════════════════════════════════════════════════════

class AnswerResponse(BaseModel):
    """Student's response to a single question."""
    selected_option: Optional[str] = Field(
        None,
        description="Selected option label for MCQ (e.g., 'B')"
    )
    selected_options: Optional[List[str]] = Field(
        None,
        description="Selected option labels for multiselect MCQ"
    )
    response_text: Optional[str] = Field(
        None,
        description="Text response for short_text or structured_response"
    )
    numeric_value: Optional[float] = Field(
        None,
        description="Numeric answer for numeric type"
    )
    drawing_data: Optional[Dict[str, Any]] = Field(
        None,
        description="Excalidraw data for drawing responses"
    )


class SubmittedAnswer(BaseModel):
    """Complete answer record for a single question."""
    question_id: str
    question_number: int
    section_id: str
    question_type: QuestionType
    response: AnswerResponse
    time_spent_seconds: int = Field(..., ge=0, description="Time spent on this question")
    was_flagged: bool = Field(False, description="Whether student flagged for review")
    was_changed: bool = Field(False, description="Whether answer was modified")
    change_count: int = Field(0, ge=0, description="Number of times answer was changed")


class SubmissionMetadata(BaseModel):
    """Metadata about the submission."""
    started_at: str = Field(..., description="ISO 8601 timestamp when attempt started")
    submitted_at: str = Field(..., description="ISO 8601 timestamp when submitted")
    time_limit_minutes: int
    time_spent_minutes: int
    time_overage_minutes: int = Field(0, ge=0, description="Minutes over time limit")
    was_auto_submitted: bool = Field(False, description="Whether timer expired and auto-submitted")


class ExamContext(BaseModel):
    """Context about the exam attempt."""
    total_questions: int
    questions_answered: int
    questions_skipped: int
    questions_flagged: int
    sections_completed: List[str]


class ExamSubmission(BaseModel):
    """Complete exam submission from frontend to backend for evaluation.

    This is sent when the student clicks 'Submit Exam'.
    """
    submission_id: str
    exam_id: str
    attempt_id: str
    student_id: str
    course_id: str

    submission_metadata: SubmissionMetadata
    answers: List[SubmittedAnswer]
    exam_context: ExamContext


# ═══════════════════════════════════════════════════════════════════════════════
# EVALUATION SCHEMA (Backend -> Frontend)
# ═══════════════════════════════════════════════════════════════════════════════

class OverallResult(BaseModel):
    """Overall exam result summary."""
    total_marks_earned: int
    total_marks_possible: int
    percentage: float
    grade: str = Field(..., description="Letter grade (A, B, C, D, E)")
    pass_status: bool
    pass_threshold: int = Field(50, description="Minimum percentage to pass")


class SectionResult(BaseModel):
    """Result for a single section."""
    section_id: str
    section_label: str
    marks_earned: int
    marks_possible: int
    percentage: float


class MarkingBreakdownItem(BaseModel):
    """Breakdown of marks for a criterion."""
    criterion: str
    earned: int
    possible: int


class DetectedMisconception(BaseModel):
    """Misconception detected in student's answer."""
    misconception: str
    remediation: str


class QuestionResult(BaseModel):
    """Result for a single question."""
    question_id: str
    question_number: int
    marks_earned: int
    marks_possible: int
    is_correct: bool
    feedback: Optional[str] = Field(None, description="Specific feedback for this answer")
    marking_breakdown: Optional[List[MarkingBreakdownItem]] = Field(
        None,
        description="Detailed marks breakdown (for structured responses)"
    )
    misconceptions_detected: List[DetectedMisconception] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    """Complete evaluation result from LangGraph evaluation agent.

    This is returned after the evaluation agent processes the submission.
    """
    evaluation_id: str
    submission_id: str
    evaluated_at: str = Field(..., description="ISO 8601 timestamp of evaluation")

    overall_result: OverallResult
    section_results: List[SectionResult]
    question_results: List[QuestionResult]

    learning_recommendations: List[str] = Field(
        default_factory=list,
        description="Personalized learning recommendations based on performance"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def validate_mock_exam(json_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate mock exam JSON against schema.

    Args:
        json_data: Mock exam JSON data

    Returns:
        Dict with:
            - valid: bool
            - errors: List[Dict] with location, message, value, type
            - summary: str
            - stats: Dict with exam statistics
    """
    try:
        exam = MockExam.model_validate(json_data)

        # Build stats
        all_questions = [q for s in exam.sections for q in s.questions]

        stats = {
            "total_sections": len(exam.sections),
            "total_questions": len(all_questions),
            "total_marks": exam.metadata.totalMarks,
            "time_limit_minutes": exam.metadata.timeLimit,
            "questions_by_difficulty": exam.summary.questions_by_difficulty,
            "questions_by_type": exam.summary.questions_by_type,
        }

        return {
            "valid": True,
            "errors": [],
            "summary": f"Mock exam validation passed ({len(all_questions)} questions, {exam.metadata.totalMarks} marks)",
            "stats": stats
        }

    except Exception as e:
        error_str = str(e)

        # Parse Pydantic validation errors
        errors = []
        if hasattr(e, 'errors'):
            for err in e.errors():
                errors.append({
                    "location": ".".join(str(loc) for loc in err.get("loc", [])),
                    "message": err.get("msg", str(err)),
                    "value": err.get("input"),
                    "type": err.get("type", "validation_error")
                })
        else:
            errors.append({
                "location": "root",
                "message": error_str,
                "value": None,
                "type": "validation_error"
            })

        return {
            "valid": False,
            "errors": errors,
            "summary": f"Mock exam validation failed with {len(errors)} error(s)",
            "stats": {}
        }


def validate_submission(json_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate exam submission JSON against schema."""
    try:
        submission = ExamSubmission.model_validate(json_data)
        return {
            "valid": True,
            "errors": [],
            "summary": f"Submission validation passed ({len(submission.answers)} answers)"
        }
    except Exception as e:
        return {
            "valid": False,
            "errors": [{"location": "root", "message": str(e)}],
            "summary": f"Submission validation failed: {str(e)}"
        }


def validate_evaluation(json_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate evaluation result JSON against schema."""
    try:
        evaluation = EvaluationResult.model_validate(json_data)
        return {
            "valid": True,
            "errors": [],
            "summary": f"Evaluation validation passed (score: {evaluation.overall_result.percentage}%)"
        }
    except Exception as e:
        return {
            "valid": False,
            "errors": [{"location": "root", "message": str(e)}],
            "summary": f"Evaluation validation failed: {str(e)}"
        }
