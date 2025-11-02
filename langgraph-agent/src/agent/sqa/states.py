"""State definitions for SQA graphs.

This module defines all TypedDict classes used across the SQA graph system:
- Question and marking scheme schemas
- SQA specification schemas
- Subgraph states (FetchQuestion, DiagnosePatch)
- Main graph states (QuestionPractice, ExamAssessment)
"""

from typing import TypedDict, Optional, List, Literal, Any
from typing_extensions import NotRequired


# ============================================================================
# Question Schema
# ============================================================================

class MarkingCriteria(TypedDict):
    """Single marking criterion within a marking scheme."""
    step: str
    marks: int


class MarkingScheme(TypedDict):
    """SQA-style marking scheme for a question."""
    criteria: List[MarkingCriteria]
    total_marks: int


class Question(TypedDict):
    """Complete question data structure.

    Supports questions from multiple sources:
    - local: Centre-created questions
    - us: Understanding Standards
    - past: SQA past papers
    - llm: LLM-generated fallback
    - variant: Mutated from existing question
    """
    id: str
    source: Literal["local", "us", "past", "llm", "variant"]
    subject: str
    level: str
    outcome_id: str
    text: str
    marks: int
    marking_scheme: MarkingScheme
    metadata: NotRequired[dict]


# ============================================================================
# SQA Spec Schema
# ============================================================================

class Outcome(TypedDict):
    """SQA learning outcome definition."""
    id: str
    label: str
    weight: float


class AssessmentSection(TypedDict):
    """SQA assessment section (e.g., Paper 1, Paper 2)."""
    section: str
    outcome_ids: List[str]
    marks: int


class SQASpec(TypedDict):
    """Complete SQA subject specification."""
    outcomes: List[Outcome]
    assessment_structure: List[AssessmentSection]


# ============================================================================
# Subgraph States
# ============================================================================

class FetchQuestionState(TypedDict):
    """State for SG_FetchQuestion subgraph.

    This subgraph handles DRY question retrieval logic:
    1. Ensure outcome is selected
    2. Collect candidates from sources
    3. Apply novelty check
    """
    # Required inputs
    subject: str
    level: str

    # Optional inputs
    target_outcome: NotRequired[str]
    used_question_ids: NotRequired[List[str]]

    # Internal (temporary) - used during processing
    candidates: NotRequired[List[Question]]

    # Outputs
    question: NotRequired[Question]


class DiagnosePatchState(TypedDict):
    """State for SG_DiagnoseAndPatch subgraph.

    This subgraph handles answer marking and remediation:
    1. Check answer against marking scheme
    2. Diagnose gaps if wrong
    3. Generate remediation content
    """
    # Required inputs
    question: Question
    user_answer: str

    # Outputs
    result: NotRequired[str]  # "correct" | "wrong"
    gap_tags: NotRequired[List[str]]
    remediation: NotRequired[str]


# ============================================================================
# Main Graph States
# ============================================================================

class QuestionPracticeState(TypedDict):
    """State for QuestionPracticeGraph (rapid-fire practice).

    This graph provides infinite question practice with immediate feedback:
    1. Fetch question
    2. Present to user (interrupt)
    3. Collect answer
    4. Diagnose and provide feedback
    5. Loop back to 1
    """
    # Required inputs (from client)
    subject: str
    level: str

    # Optional inputs
    target_outcome: NotRequired[str]

    # Session state
    question: NotRequired[Question]
    user_answer: NotRequired[str]
    used_question_ids: NotRequired[List[str]]

    # Result tracking
    result: NotRequired[str]
    gap_tags: NotRequired[List[str]]
    remediation: NotRequired[str]

    # Statistics
    total_questions: NotRequired[int]
    correct_count: NotRequired[int]
    streak: NotRequired[int]

    # Control flow
    should_continue: NotRequired[bool]
    resume_data: NotRequired[dict]

    # Messages for interrupt pattern
    messages: NotRequired[List[Any]]


class ExamAssessmentState(TypedDict):
    """State for ExamAssessmentGraph (mock exams).

    This graph generates SQA-style mock exams:
    1. Build blueprint from SQA spec
    2. Fill question slots
    3. Assemble exam
    4. Deliver to user (interrupt)
    5. Collect responses
    6. Mark exam
    7. Provide remediation
    8. Loop back to 1
    """
    # Required inputs (from client)
    subject: str
    level: str

    # Blueprint
    blueprint: NotRequired[List[dict]]

    # Exam construction
    questions: NotRequired[List[Question]]
    exam_package: NotRequired[dict]

    # Responses
    responses: NotRequired[dict]  # {question_id: answer, ...}

    # Marking
    marking: NotRequired[dict]  # {question_id: {correct, marks_awarded, gap_tags}, ...}
    gap_outcomes: NotRequired[List[str]]  # Weak outcome IDs

    # Session tracking
    used_question_ids: NotRequired[List[str]]
    exam_count: NotRequired[int]

    # Control flow
    should_continue: NotRequired[bool]
    resume_data: NotRequired[dict]

    # Messages for interrupt pattern
    messages: NotRequired[List[Any]]
