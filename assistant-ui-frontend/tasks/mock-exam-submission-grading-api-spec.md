# Mock Exam Submission & Grading API Specification

## Overview

This specification defines the backend API for mock exam submission and grading using **LangGraph**. The evaluation is implemented as the `graph_mock_exam` graph that uses `create_agent` with structured output.

**Related Spec**: [mock-exam-frontend-presentation-spec.md](./mock-exam-frontend-presentation-spec.md)

---

## Architecture Decision: LangGraph Agent

### Why LangGraph Instead of API Routes?

| Approach | Pros | Cons |
|----------|------|------|
| Next.js API Routes | Simple, familiar | No LLM for structured responses, manual orchestration |
| **LangGraph Agent** | LLM-powered grading, structured output, tool orchestration | Slightly more setup |

**Decision**: Use LangGraph `create_agent` with `ToolStrategy(EvaluationResult)` for:
- Automatic structured output validation
- LLM-powered grading of structured responses
- Personalized learning recommendations
- Consistent with existing teaching graph architecture

### Key Design Decisions

| Decision | Value |
|----------|-------|
| Graph Name | `graph_mock_exam` |
| Location | `langgraph-agent/src/agent/graph_mock_exam.py` |
| Pattern | `create_agent` with `ToolStrategy(EvaluationResult)` |
| Input | `ExamSubmissionWithExam` Pydantic model (includes full mock exam data) |
| Output | `EvaluationResult` Pydantic model |
| Model | `gpt-5.1-mini` |
| Architecture | **Appwrite-agnostic** - Backend does NOT access Appwrite |

---

## Scope

| Component | Location | Status |
|-----------|----------|--------|
| Pydantic Models | `langgraph-agent/src/agent/graph_mock_exam_models.py` | ❌ To create (self-contained) |
| Appwrite Collections | `default` database | ✅ `mock_exams`, `exam_attempts` exist |
| LangGraph Graph | `langgraph-agent/src/agent/graph_mock_exam.py` | ❌ Not created |

> **Self-Contained Architecture**: All Pydantic models are defined locally within `langgraph-agent`.
> The backend does NOT import from `claud_author_agent`. Models are duplicated to maintain independence.
> Reference: `claud_author_agent/src/tools/mock_exam_schema_models.py` (read-only for schema reference)

---

## Data Flow (Appwrite-Agnostic)

> **Architecture Principle**: Backend is a pure processing engine. It receives all data as input and returns results as output. **No database access from backend.**
>
> This follows the same pattern as `SessionChatAssistant.tsx` for interactive lessons.

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Frontend      │     │   LangGraph Agent   │     │   Appwrite      │
│   (React)       │     │   (graph_mock_exam)  │     │   (Database)    │
└────────┬────────┘     └────────┬────────────┘     └────────┬────────┘
         │                       │                           │
         │  1. Fetch mock_exam   │                           │
         │───────────────────────────────────────────────────>
         │<───────────────────────────────────────────────────
         │                       │                           │
         │  2. POST /runs        │                           │
         │  ExamSubmissionWithExam                           │
         │  (includes full       │                           │
         │   mock_exam data!)    │                           │
         │──────────────────────>│                           │
         │                       │                           │
         │                       │  [Auto-grade loop]        │
         │                       │  - MCQ: compare options   │
         │                       │  - Numeric: tolerance     │
         │                       │  - Short text: variations │
         │                       │  - Structured: LLM eval   │
         │                       │                           │
         │                       │  Calculate overall result │
         │                       │  Generate recommendations │
         │                       │                           │
         │  3. EvaluationResult  │                           │
         │  (structured_response)│                           │
         │<──────────────────────│                           │
         │                       │                           │
         │  4. Store result      │                           │
         │───────────────────────────────────────────────────>
         │                       │                           │
```

**Key Difference**: Backend has **NO arrows to Appwrite**. All database access is handled by Frontend.

**Why Appwrite-Agnostic?**
- Backend doesn't need Appwrite SDK or credentials
- Simpler to test - just pass mock data
- Consistent with existing `SessionChatAssistant.tsx` pattern
- Frontend already has the exam data (it rendered it for the student)

---

## Appwrite Collections

### Collection: `mock_exams`
Stores generated mock exam JSON from the author agent.

| Field | Type | Description |
|-------|------|-------------|
| `$id` | string | Document ID (matches `examId`) |
| `courseId` | string | Reference to course |
| `sowId` | string | Reference to Authored_SOW |
| `sowEntryOrder` | integer | Order in SOW |
| `exam_json` | string | Complete MockExam JSON (compressed) |
| `title` | string | Exam title (for listing) |
| `totalMarks` | integer | Total marks (for display) |
| `timeLimit` | integer | Time limit in minutes |
| `status` | enum | `draft`, `published`, `archived` |
| `created_at` | datetime | Generation timestamp |
| `updated_at` | datetime | Last update |

**Indexes**:
- `courseId` (for fetching exams by course)
- `status` (for filtering published exams)

### Collection: `exam_attempts`
Tracks exam attempt sessions (started but not necessarily submitted).

| Field | Type | Description |
|-------|------|-------------|
| `$id` | string | Attempt ID |
| `examId` | string | Reference to mock_exams |
| `studentId` | string | Reference to students |
| `courseId` | string | Reference to course |
| `started_at` | datetime | When attempt started |
| `submitted_at` | datetime | When submitted (null if in progress) |
| `time_limit_minutes` | integer | Time limit for this attempt |
| `status` | enum | `in_progress`, `submitted`, `timed_out`, `abandoned` |

**Indexes**:
- `studentId` + `examId` (for checking existing attempts)
- `status` (for finding in-progress attempts)

### Collection: `exam_submissions`
Stores complete submission payloads.

| Field | Type | Description |
|-------|------|-------------|
| `$id` | string | Submission ID |
| `attemptId` | string | Reference to exam_attempts |
| `examId` | string | Reference to mock_exams |
| `studentId` | string | Reference to students |
| `courseId` | string | Reference to course |
| `submission_json` | string | Complete ExamSubmission JSON |
| `submitted_at` | datetime | Submission timestamp |
| `was_auto_submitted` | boolean | True if timer expired |

**Indexes**:
- `studentId` + `examId` (for fetching student's submissions)

### Collection: `exam_results`
Stores grading results.

| Field | Type | Description |
|-------|------|-------------|
| `$id` | string | Result ID |
| `submissionId` | string | Reference to exam_submissions |
| `examId` | string | Reference to mock_exams |
| `studentId` | string | Reference to students |
| `courseId` | string | Reference to course |
| `result_json` | string | Complete EvaluationResult JSON |
| `total_marks_earned` | integer | For quick queries |
| `total_marks_possible` | integer | For quick queries |
| `percentage` | float | For quick queries |
| `grade` | string | Letter grade |
| `pass_status` | boolean | Pass/fail |
| `evaluated_at` | datetime | Grading timestamp |

**Indexes**:
- `studentId` + `courseId` (for student performance dashboard)
- `examId` (for exam analytics)

---

## API Endpoints

### POST `/api/exam/start`
Start a new exam attempt.

**Request**:
```typescript
{
  examId: string;
  studentId: string;
  courseId: string;
}
```

**Response**:
```typescript
{
  attemptId: string;
  exam: MockExam;
  timeLimit: number;
  startedAt: string;
}
```

**Logic**:
1. Check if student has existing in-progress attempt
2. If yes, return existing attempt (resume)
3. If no, create new attempt record
4. Return exam JSON with attempt ID

---

### POST `/api/exam/submit`
Submit completed exam for grading.

**Request**: `ExamSubmission`
```typescript
interface ExamSubmission {
  submission_id: string;
  exam_id: string;
  attempt_id: string;
  student_id: string;
  course_id: string;
  submission_metadata: {
    started_at: string;
    submitted_at: string;
    time_limit_minutes: number;
    time_spent_minutes: number;
    time_overage_minutes: number;
    was_auto_submitted: boolean;
  };
  answers: SubmittedAnswer[];
  exam_context: {
    total_questions: number;
    questions_answered: number;
    questions_skipped: number;
    questions_flagged: number;
    sections_completed: string[];
  };
}

interface SubmittedAnswer {
  question_id: string;
  question_number: number;
  section_id: string;
  question_type: 'mcq' | 'mcq_multiselect' | 'numeric' | 'short_text' | 'structured_response';
  response: {
    selected_option?: string;
    selected_options?: string[];
    response_text?: string;
    numeric_value?: number;
    drawing_data?: object;
  };
  time_spent_seconds: number;
  was_flagged: boolean;
  was_changed: boolean;
  change_count: number;
}
```

**Response**: `EvaluationResult`
```typescript
interface EvaluationResult {
  evaluation_id: string;
  submission_id: string;
  evaluated_at: string;
  overall_result: {
    total_marks_earned: number;
    total_marks_possible: number;
    percentage: number;
    grade: string;
    pass_status: boolean;
    pass_threshold: number;
  };
  section_results: SectionResult[];
  question_results: QuestionResult[];
  learning_recommendations: string[];
}
```

**Logic**:
1. Validate submission against schema
2. Update attempt status to `submitted`
3. Store submission JSON
4. Fetch exam JSON for answer keys
5. Auto-grade MCQ and Numeric questions
6. Generate placeholder for structured responses (manual review)
7. Calculate totals and grade
8. Store result
9. Return evaluation result

---

### GET `/api/exam/result/{submissionId}`
Fetch grading result for a submission.

**Response**: `EvaluationResult`

---

### GET `/api/exam/attempts/{studentId}`
Fetch all exam attempts for a student.

**Query Params**:
- `courseId` (optional): Filter by course
- `status` (optional): Filter by status

**Response**:
```typescript
{
  attempts: {
    attemptId: string;
    examId: string;
    examTitle: string;
    status: string;
    startedAt: string;
    submittedAt?: string;
    result?: {
      percentage: number;
      grade: string;
      passStatus: boolean;
    };
  }[];
}
```

---

## LLM-Powered Grading Architecture

> **CRITICAL DESIGN DECISION**: All grading is performed by the LLM, NOT by Python functions.
>
> This enables **constructive, personalized feedback** for every question, not just templated responses.

### Why LLM-Powered Grading?

| Aspect | Python Functions (Old) | LLM-Powered (New) |
|--------|----------------------|-------------------|
| MCQ Feedback | "Correct!" or "The correct answer was B" | "Great job! You correctly identified that..." or "You selected B, but the answer is C. Remember that probability is calculated as favorable outcomes / total outcomes..." |
| Misconception Detection | Pattern matching against predefined strings | Semantic understanding of student reasoning |
| Structured Response | "Pending manual review" | Full evaluation with partial credit and step-by-step feedback |
| Learning Recommendations | Generic "practice more" | Specific recommendations based on actual errors |

### Constructive Feedback Philosophy

Every piece of feedback should:
1. **Acknowledge** what the student did (right or wrong)
2. **Explain** why it's correct or what went wrong
3. **Guide** toward correct understanding
4. **Encourage** continued learning

---

## Structured Feedback Output Schema

### Enhanced `QuestionFeedback` Model

```python
class QuestionFeedback(BaseModel):
    """Constructive feedback for a single question - generated by LLM."""

    # Core identification
    question_id: str
    question_number: int
    section_id: str

    # Grading result
    marks_earned: int
    marks_possible: int
    is_correct: bool
    is_partially_correct: bool = False  # For multi-part questions

    # Constructive feedback components
    feedback_summary: str  # 1-2 sentence summary (e.g., "Good attempt! Your method was correct but...")

    what_you_did_well: Optional[str] = None  # Positive reinforcement (always try to find something)
    where_you_went_wrong: Optional[str] = None  # Only if incorrect - explains the error
    correct_approach: str  # Step-by-step explanation of correct solution

    # For structured responses - per-criterion breakdown
    marking_breakdown: Optional[List[MarkingCriterionResult]] = None

    # Misconception detection
    misconception_detected: Optional[MisconceptionFeedback] = None

    # Learning pointers
    related_concept: str  # e.g., "Probability with Fractions"
    suggested_review: Optional[str] = None  # e.g., "Review Chapter 5.2 on probability"


class MarkingCriterionResult(BaseModel):
    """Feedback for a single marking criterion in structured responses."""
    criterion_name: str  # e.g., "Method Selection"
    criterion_description: str  # What was being assessed
    marks_earned: int
    marks_possible: int
    feedback: str  # Specific feedback for this criterion
    evidence_seen: Optional[str] = None  # What the student showed


class MisconceptionFeedback(BaseModel):
    """Detailed misconception feedback."""
    misconception_type: str  # e.g., "fraction_addition_numerator_only"
    common_error: str  # e.g., "Adding numerators without finding common denominator"
    why_its_wrong: str  # Explanation of why this thinking is flawed
    correct_thinking: str  # How to think about it correctly
    practice_suggestion: str  # What to practice to fix this
```

### Enhanced `EvaluationResult` Model

```python
class EvaluationResult(BaseModel):
    """Complete evaluation result with constructive feedback for all questions."""

    evaluation_id: str
    submission_id: str
    evaluated_at: str  # ISO 8601 timestamp

    # Overall result
    overall_result: OverallResult

    # Section-level results
    section_results: List[SectionResult]

    # Question-level constructive feedback (the main output!)
    question_feedback: List[QuestionFeedback]

    # Personalized learning recommendations
    learning_recommendations: List[LearningRecommendation]

    # Encouragement message
    encouragement_message: str  # Personalized based on performance


class LearningRecommendation(BaseModel):
    """Specific, actionable learning recommendation."""
    priority: int  # 1 = most important
    topic: str  # e.g., "Quadratic Factorisation"
    reason: str  # Why this is recommended based on their performance
    action: str  # Specific action to take (e.g., "Practice factorising expressions where a>1")
    related_questions: List[int]  # Question numbers this relates to
```

---

## Grade Calculation (Deterministic)

Grade calculation remains deterministic (not LLM-dependent) for consistency:

```python
def calculate_grade(percentage: float) -> tuple[str, bool]:
    """Calculate SQA-style grade from percentage.

    Returns: (grade_letter, passed)
    """
    if percentage >= 70:
        return ('A', True)
    elif percentage >= 60:
        return ('B', True)
    elif percentage >= 50:
        return ('C', True)
    elif percentage >= 40:
        return ('D', True)
    else:
        return ('No Award', False)
```

---

## Local Pydantic Models (Self-Contained Backend)

> **Architecture Decision**: All Pydantic models are defined locally in `langgraph-agent/src/agent/graph_mock_exam_models.py`.
> This keeps the backend **self-contained** with no dependencies on `claud_author_agent`.
>
> **Reference**: Schema structure is based on `claud_author_agent/src/tools/mock_exam_schema_models.py` (read-only).

### File: `langgraph-agent/src/agent/graph_mock_exam_models.py`

```python
"""Local Pydantic models for Mock Exam grading.

This module contains all schema models needed for the graph_mock_exam graph.
These are defined locally to keep the backend self-contained (no claud_author_agent dependency).

Reference: claud_author_agent/src/tools/mock_exam_schema_models.py (read-only for schema consistency)
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


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
    """Question difficulty levels."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class CalculatorPolicy(str, Enum):
    """Calculator policy for exam sections."""
    NON_CALC = "non_calc"
    CALC = "calc"
    MIXED = "mixed"


# ═══════════════════════════════════════════════════════════════════════════════
# MOCK EXAM INPUT MODELS (Frontend provides these)
# ═══════════════════════════════════════════════════════════════════════════════

class MCQOption(BaseModel):
    """Single option for MCQ questions."""
    label: str
    text: str
    is_correct: bool = False
    feedback: Optional[str] = None


class MarkingStep(BaseModel):
    """Single step in a marking scheme."""
    step: str
    marks: int


class AnswerKey(BaseModel):
    """Answer key with marking scheme."""
    correct_answer: str
    acceptable_variations: List[str] = Field(default_factory=list)
    marking_scheme: List[MarkingStep] = Field(default_factory=list)


class Misconception(BaseModel):
    """Known misconception with feedback."""
    error_pattern: str
    feedback: str


class CFUConfig(BaseModel):
    """Check For Understanding configuration."""
    type: QuestionType
    expected_format: Optional[str] = None
    options: Optional[List[MCQOption]] = None
    answer_key: AnswerKey


class Question(BaseModel):
    """Exam question with answer key and misconceptions."""
    question_id: str
    question_number: int
    marks: int
    difficulty: Difficulty
    question_stem: str
    question_stem_plain: str
    question_type: QuestionType
    cfu_config: CFUConfig
    hints: List[str] = Field(default_factory=list)
    misconceptions: List[Misconception] = Field(default_factory=list)


class Section(BaseModel):
    """Exam section with questions."""
    section_id: str
    section_label: str
    section_order: int
    section_marks: int
    section_instructions: str
    questions: List[Question]


class ExamMetadata(BaseModel):
    """Exam metadata."""
    title: str
    subject: str
    level: str
    totalMarks: int
    timeLimit: int
    instructions: str
    calculator_policy: CalculatorPolicy


class MockExam(BaseModel):
    """Complete mock exam structure (input from frontend)."""
    examId: str
    courseId: str
    metadata: ExamMetadata
    sections: List[Section]


# ═══════════════════════════════════════════════════════════════════════════════
# SUBMISSION MODELS (Student answers from frontend)
# ═══════════════════════════════════════════════════════════════════════════════

class AnswerResponse(BaseModel):
    """Student's response to a question."""
    selected_option: Optional[str] = None
    selected_options: Optional[List[str]] = None
    response_text: Optional[str] = None
    numeric_value: Optional[float] = None
    drawing_data: Optional[Dict[str, Any]] = None


class SubmittedAnswer(BaseModel):
    """Complete answer record for a question."""
    question_id: str
    question_number: int
    section_id: str
    question_type: QuestionType
    response: AnswerResponse
    time_spent_seconds: int = 0
    was_flagged: bool = False


class SubmissionMetadata(BaseModel):
    """Metadata about the submission."""
    started_at: str
    submitted_at: str
    time_limit_minutes: int
    time_spent_minutes: int
    was_auto_submitted: bool = False


class ExamContext(BaseModel):
    """Context about the exam attempt."""
    total_questions: int
    questions_answered: int
    questions_skipped: int
    questions_flagged: int


class ExamSubmissionWithExam(BaseModel):
    """Complete exam submission WITH exam data for grading.

    The frontend provides BOTH the student's answers AND the full mock exam data.
    Backend does NOT access Appwrite - it receives all data it needs as input.
    """
    # Submission identifiers
    submission_id: str
    exam_id: str
    attempt_id: str
    student_id: str
    course_id: str

    # Submission data
    submission_metadata: SubmissionMetadata
    answers: List[SubmittedAnswer]
    exam_context: ExamContext

    # Full mock exam data (frontend provides this)
    mock_exam: MockExam


# ═══════════════════════════════════════════════════════════════════════════════
# EVALUATION OUTPUT MODELS (LLM returns these via structured output)
# ═══════════════════════════════════════════════════════════════════════════════

class OverallResult(BaseModel):
    """Overall exam result summary."""
    total_marks_earned: int
    total_marks_possible: int
    percentage: float
    grade: str = Field(..., description="Letter grade (A, B, C, D, No Award)")
    pass_status: bool
    pass_threshold: int = 40


class SectionResult(BaseModel):
    """Result for a single section."""
    section_id: str
    section_label: str
    marks_earned: int
    marks_possible: int
    percentage: float


class MarkingCriterionResult(BaseModel):
    """Feedback for a single marking criterion in structured responses."""
    criterion_name: str
    criterion_description: str
    marks_earned: int
    marks_possible: int
    feedback: str
    evidence_seen: Optional[str] = None


class MisconceptionFeedback(BaseModel):
    """Detailed misconception feedback."""
    misconception_type: str
    common_error: str
    why_its_wrong: str
    correct_thinking: str
    practice_suggestion: str


class QuestionFeedback(BaseModel):
    """Constructive feedback for a single question - generated by LLM."""

    # Core identification
    question_id: str
    question_number: int
    section_id: str

    # Grading result
    marks_earned: int
    marks_possible: int
    is_correct: bool
    is_partially_correct: bool = False

    # Constructive feedback components
    feedback_summary: str = Field(
        ...,
        description="1-2 sentence summary (e.g., 'Good attempt! Your method was correct but...')"
    )
    what_you_did_well: Optional[str] = Field(
        None,
        description="Positive reinforcement - always try to find something"
    )
    where_you_went_wrong: Optional[str] = Field(
        None,
        description="Only if incorrect - explains the error"
    )
    correct_approach: str = Field(
        ...,
        description="Step-by-step explanation of correct solution"
    )

    # For structured responses - per-criterion breakdown
    marking_breakdown: Optional[List[MarkingCriterionResult]] = None

    # Misconception detection
    misconception_detected: Optional[MisconceptionFeedback] = None

    # Learning pointers
    related_concept: str = Field(
        ...,
        description="e.g., 'Probability with Fractions'"
    )
    suggested_review: Optional[str] = Field(
        None,
        description="e.g., 'Review Chapter 5.2 on probability'"
    )


class LearningRecommendation(BaseModel):
    """Specific, actionable learning recommendation."""
    priority: int = Field(..., ge=1, le=5, description="1 = most important")
    topic: str = Field(..., description="e.g., 'Quadratic Factorisation'")
    reason: str = Field(..., description="Why this is recommended based on their performance")
    action: str = Field(..., description="Specific action to take")
    related_questions: List[int] = Field(
        default_factory=list,
        description="Question numbers this relates to"
    )


class EvaluationResult(BaseModel):
    """Complete evaluation result with constructive feedback for all questions.

    This is the structured output from the LLM grading agent.
    """
    evaluation_id: str
    submission_id: str
    evaluated_at: str = Field(..., description="ISO 8601 timestamp")

    # Overall result
    overall_result: OverallResult

    # Section-level results
    section_results: List[SectionResult]

    # Question-level constructive feedback (the main output!)
    question_feedback: List[QuestionFeedback]

    # Personalized learning recommendations
    learning_recommendations: List[LearningRecommendation]

    # Encouragement message
    encouragement_message: str = Field(
        ...,
        description="Personalized message based on performance"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# GRADE CALCULATION (Deterministic - not LLM-dependent)
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_grade(percentage: float) -> tuple[str, bool]:
    """Calculate SQA-style grade from percentage.

    Returns: (grade_letter, passed)

    Grading Bands (SQA Standard):
    - A: 70%+
    - B: 60-69%
    - C: 50-59%
    - D: 40-49%
    - No Award: <40%
    """
    if percentage >= 70:
        return ('A', True)
    elif percentage >= 60:
        return ('B', True)
    elif percentage >= 50:
        return ('C', True)
    elif percentage >= 40:
        return ('D', True)
    else:
        return ('No Award', False)
```

### Models Overview

| Category | Models | Purpose |
|----------|--------|---------|
| **Input (Exam)** | `MockExam`, `Section`, `Question`, `CFUConfig`, `AnswerKey` | Frontend provides full exam structure with answer keys |
| **Input (Submission)** | `ExamSubmissionWithExam`, `SubmittedAnswer`, `AnswerResponse` | Student answers combined with exam data |
| **Output (Evaluation)** | `EvaluationResult`, `QuestionFeedback`, `LearningRecommendation` | LLM-generated constructive feedback |
| **Output (Results)** | `OverallResult`, `SectionResult`, `MarkingCriterionResult` | Structured grading results |

---

## LangGraph Implementation

### Graph Architecture (Using `create_agent` with Structured Output)

> **Note**: This graph uses `create_agent` with `ToolStrategy(EvaluationResult)` for structured output.
> It has NO Appwrite dependencies. All data comes from frontend input, results go back to frontend for storage.
>
> **Grading**: The LLM performs ALL grading and generates constructive feedback. No Python grading tools.
>
> **Self-Contained**: All Pydantic models are defined locally in `graph_mock_exam_models.py`.
> No imports from `claud_author_agent` - the backend is fully independent.

```python
# graph_mock_exam.py

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
from langchain_openai import ChatOpenAI

# Import LOCAL schema models (self-contained - no claud_author_agent dependency)
from .graph_mock_exam_models import (
    ExamSubmissionWithExam,
    EvaluationResult,
    QuestionFeedback,
    OverallResult,
    SectionResult,
    LearningRecommendation,
    MockExam
)


# ═══════════════════════════════════════════════════════════════════════════════
# SYSTEM PROMPT - Defines the grading behavior and philosophy
# ═══════════════════════════════════════════════════════════════════════════════

GRADING_SYSTEM_PROMPT = """You are a supportive Scottish exam grader. Your role is to:

1. Grade each question based on the provided answer keys and marking schemes
2. Generate **constructive, encouraging feedback** for EVERY question
3. Calculate section and overall results using SQA grading bands
4. Provide specific learning recommendations

## Grading Philosophy
- **Be encouraging** - Find something positive even in wrong answers
- **Be specific** - Don't just say "wrong", explain WHY
- **Be educational** - Each feedback should teach something
- **Be supportive** - Remember this is a learning experience

## Grading Bands (SQA Standard)
- A: 70%+ (Excellent)
- B: 60-69% (Good)
- C: 50-59% (Satisfactory)
- D: 40-49% (Pass)
- No Award: <40% (More work needed)

## Question-Type Specific Guidelines
- **MCQ**: Compare student selection against correct option
- **Numeric**: Allow tolerance of ±0.001 and check acceptable variations
- **Structured Response**: Award partial marks based on marking scheme criteria
- **All wrong answers**: Check for known misconceptions and explain them helpfully

## Constructive Feedback Structure
For each question, your feedback should:
1. Acknowledge what the student did (well or wrong)
2. Explain the correct approach
3. Identify any misconceptions detected
4. Provide encouragement

## Final Output Requirements
- Include feedback for ALL questions (not just wrong ones)
- Generate 2-4 specific learning recommendations based on actual errors
- Write a personalized encouragement message
- Calculate accurate totals and percentages"""


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS - Format exam data for the LLM
# ═══════════════════════════════════════════════════════════════════════════════

def format_sections_with_answers(sections, answers) -> str:
    """Format sections with questions and student answers for the prompt."""
    output = []

    for section in sections:
        output.append(f"\n### {section.section_label}")
        output.append(f"Section Marks: {section.section_marks}")

        for q in section.questions:
            output.append(f"\n**Question {q.question_number}** ({q.marks} marks)")
            output.append(f"Type: {q.question_type}")
            output.append(f"Stem: {q.question_stem}")

            # Include correct answer info
            if q.cfu_config.options:
                output.append("Options:")
                for opt in q.cfu_config.options:
                    correct_marker = " ✓ CORRECT" if opt.is_correct else ""
                    output.append(f"  {opt.label}. {opt.text}{correct_marker}")

            if q.cfu_config.answer_key:
                output.append(f"Answer Key: {q.cfu_config.answer_key.correct_answer}")
                if q.cfu_config.answer_key.acceptable_variations:
                    output.append(f"Acceptable: {q.cfu_config.answer_key.acceptable_variations}")
                if q.cfu_config.answer_key.marking_scheme:
                    output.append("Marking Scheme:")
                    for step in q.cfu_config.answer_key.marking_scheme:
                        output.append(f"  - {step.step}: {step.marks} marks")

            # Include known misconceptions
            if q.misconceptions:
                output.append("Known Misconceptions:")
                for misc in q.misconceptions:
                    output.append(f"  - {misc.error_pattern}: {misc.feedback}")

            # Student's answer
            student_answer = next((a for a in answers if a.question_id == q.question_id), None)
            if student_answer:
                output.append(f"STUDENT ANSWER: {format_student_response(student_answer.response)}")
            else:
                output.append("STUDENT ANSWER: [No answer provided]")

    return "\n".join(output)


def format_student_response(response) -> str:
    """Format student response for display."""
    if response.selected_option:
        return f"Selected: {response.selected_option}"
    elif response.selected_options:
        return f"Selected: {', '.join(response.selected_options)}"
    elif response.numeric_value is not None:
        return f"Numeric: {response.numeric_value}"
    elif response.response_text:
        return f"Text: {response.response_text}"
    else:
        return "[Empty response]"


def build_grading_message(submission: ExamSubmissionWithExam) -> str:
    """Build the grading request message with full exam context."""
    exam = submission.mock_exam
    answers = submission.answers

    return f"""Please grade the following exam submission and return a complete EvaluationResult.

## Exam Information
- Title: {exam.metadata.title}
- Subject: {exam.metadata.subject}
- Level: {exam.metadata.level}
- Total Marks: {exam.metadata.totalMarks}
- Submission ID: {submission.submission_id}
- Exam ID: {submission.exam_id}

## Sections and Questions
{format_sections_with_answers(exam.sections, answers)}

## Instructions
Grade all questions, calculate totals, and provide constructive feedback for the student."""


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT CREATION - Using create_agent with ToolStrategy for structured output
# ═══════════════════════════════════════════════════════════════════════════════

# Configure the model with appropriate settings for grading
grading_model = ChatOpenAI(
    model="gpt-5.1-mini",
    temperature=0.3  # Low temperature for consistent, reliable grading
)

# Create the agent with structured output using ToolStrategy
# - No tools needed: The LLM does all grading directly
# - ToolStrategy ensures output conforms to EvaluationResult schema
# - Result is returned in result["structured_response"]
graph_mock_exam = create_agent(
    model=grading_model,
    tools=[],  # No tools - LLM grades directly
    system_prompt=GRADING_SYSTEM_PROMPT,
    response_format=ToolStrategy(EvaluationResult)
)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `create_agent` over `StateGraph` | Production-ready agent with built-in error handling and retry logic |
| `ToolStrategy(EvaluationResult)` | Structured output via tool calling - works with any model supporting tool calls |
| `tools=[]` | No Python tools needed - LLM performs all grading directly |
| `temperature=0.3` | Low temperature for consistent, reliable grading results |
| No state schema | Agent receives input via messages, returns result via `structured_response` |

### Invoking the Agent

```python
# Frontend builds the grading message from submission data
grading_message = build_grading_message(submission_with_exam)

# Invoke the agent with the message
result = graph_mock_exam.invoke({
    "messages": [{"role": "user", "content": grading_message}]
})

# Access the structured EvaluationResult
evaluation_result: EvaluationResult = result["structured_response"]
```

### Error Handling with ToolStrategy

`ToolStrategy` includes built-in error handling (default: `handle_errors=True`):

```python
# If the LLM generates invalid output, it automatically retries:
# 1. Schema validation errors → LLM gets feedback and retries
# 2. Multiple outputs when one expected → LLM gets feedback and retries
# 3. Custom error handling can be configured:

response_format=ToolStrategy(
    schema=EvaluationResult,
    handle_errors=True,  # Default: automatic retry with error feedback
    tool_message_content="Grading complete. Results returned to student."
)
```

### Why No Python Grading Tools?

| Old Approach | New Approach | Benefit |
|--------------|--------------|---------|
| Python `auto_grade_mcq()` tool | LLM grades directly | LLM can explain reasoning and detect nuanced errors |
| Python `detect_misconceptions()` | LLM understands context | Semantic matching instead of string matching |
| Python returns, LLM summarizes | LLM does both | Consistent voice, better feedback coherence |
| Multiple tool calls overhead | Single LLM call | Faster, simpler, more reliable |

### Example: LLM-Generated Feedback vs Python Feedback

**Question**: "What is the probability of selecting a red ball from a bag with 3 red and 5 blue balls?"

**Student Answer**: "5/8" (wrong - should be 3/8)

**Python Tool Feedback (Old)**:
```
"Incorrect. The correct answer was 3/8."
```

**LLM-Generated Feedback (New)**:
```json
{
  "feedback_summary": "You've got the right idea about probability fractions, but mixed up which number goes on top!",
  "what_you_did_well": "You correctly identified the total number of balls (8) as the denominator",
  "where_you_went_wrong": "You put the number of blue balls (5) in the numerator instead of red balls (3)",
  "correct_approach": "For probability of selecting a red ball: P(red) = number of red balls / total balls = 3/8",
  "misconception_detected": {
    "misconception_type": "probability_wrong_event",
    "common_error": "Using the count of the 'other' outcome instead of the desired outcome",
    "why_its_wrong": "When calculating P(A), the numerator must be the count of A, not the count of 'not A'",
    "correct_thinking": "Always ask: what am I trying to find the probability OF? Put that count on top.",
    "practice_suggestion": "Try more probability questions where you label the desired outcome before writing the fraction"
  },
  "related_concept": "Probability of a Single Event",
  "suggested_review": "Review the difference between P(A) and P(not A)"
}
```

### Key Changes from Original Design

| Aspect | Before | After |
|--------|--------|-------|
| **Graph API** | Manual `StateGraph` with nodes | `create_agent` with `ToolStrategy` |
| **Model** | `claude-sonnet-4-20250514` | `gpt-5.1-mini` |
| **Grading** | Python tool functions | LLM performs all grading |
| **Feedback** | Templated strings | Constructive, personalized |
| **Tools** | 5 Python grading tools | No tools - `tools=[]` |
| **Structured Output** | `.with_structured_output()` | `ToolStrategy(EvaluationResult)` |
| **Result Access** | `state.evaluation_result` | `result["structured_response"]` |
| **Error Handling** | Manual validation | Built-in retry with `handle_errors=True` |
| **Input** | `ExamSubmission` (exam_id only) | `ExamSubmissionWithExam` (includes full exam) |
| **Appwrite** | Backend fetches & stores | Frontend handles all CRUD |
| **Output Schema** | Basic `QuestionResult` | Rich `QuestionFeedback` with constructive elements |

### langgraph.json Update

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph_interrupt.py:graph_interrupt",
    "graph_mock_exam": "./src/agent/graph_mock_exam.py:graph_mock_exam"
  },
  "env": ".env"
}
```

---

## Implementation Files

### LangGraph Backend Files

With `create_agent` and self-contained models, the implementation requires just TWO files:

```
langgraph-agent/src/agent/
├── graph_mock_exam_models.py   # All Pydantic models (self-contained, no claud_author_agent dependency)
└── graph_mock_exam.py          # create_agent + helper functions
```

**Why this structure?**
- `graph_mock_exam_models.py` - All Pydantic models defined locally for independence
- `graph_mock_exam.py` - Agent creation with `create_agent` + prompt helpers
- `create_agent` handles graph construction internally
- No separate state file needed (agent uses `AgentState` with messages)
- No tools file needed (LLM grades directly, `tools=[]`)

### Files to Create

| File | Purpose |
|------|---------|
| `langgraph-agent/src/agent/graph_mock_exam_models.py` | Self-contained Pydantic models |
| `langgraph-agent/src/agent/graph_mock_exam.py` | Agent with `create_agent` + helper functions |

### Files to Modify

| File | Change |
|------|--------|
| `langgraph-agent/langgraph.json` | Add `graph_mock_exam` graph entry |

### Frontend Integration Files

```
assistant-ui-frontend/lib/exam/
├── submit-exam.ts            # LangGraph SDK client for submission
├── types.ts                  # TypeScript types matching Pydantic models
└── exam-service.ts           # Appwrite service for exam fetching
```

---

## Error Handling

| Error | HTTP Code | Response |
|-------|-----------|----------|
| Exam not found | 404 | `{ error: "Exam not found", examId }` |
| Attempt already submitted | 409 | `{ error: "Attempt already submitted", attemptId }` |
| Time limit exceeded | 400 | `{ error: "Time limit exceeded", overage }` |
| Invalid submission | 422 | `{ error: "Validation failed", details }` |
| Student not enrolled | 403 | `{ error: "Not enrolled in course", courseId }` |

---

## Security Considerations

1. **Authentication**: All endpoints require authenticated student session
2. **Authorization**: Verify student is enrolled in course
3. **Attempt Limit**: Consider limiting retakes (configurable per exam)
4. **Time Validation**: Server-side time limit enforcement
5. **Answer Tampering**: Validate answers against exam structure

---

## Testing and Evaluation Plan

This section defines the comprehensive testing strategy for the `graph_mock_exam` graph, based on the official [create_agent testing documentation](../../langgraph-agent/docs/create_agent_docs.md).

### Testing Philosophy

Agentic applications require thorough testing because:
- LLM decisions are non-deterministic
- Tool call sequences matter
- State persistence affects behavior
- Grading accuracy is critical for student trust

### 1. Unit Testing

#### 1.1 Mocking Chat Model with GenericFakeChatModel

Use LangChain's `GenericFakeChatModel` to mock LLM responses for deterministic testing.

Since we use `ToolStrategy(EvaluationResult)`, the LLM generates a tool call with the structured response:

```python
# tests/test_graph_mock_exam_unit.py
import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, ToolCall
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
# Import from LOCAL models (self-contained - no claud_author_agent dependency)
from langgraph_agent.src.agent.graph_mock_exam_models import EvaluationResult

# Sample mock EvaluationResult for testing
MOCK_EVALUATION = {
    "evaluation_id": "eval_test_001",
    "submission_id": "sub_test_001",
    "evaluated_at": "2024-01-15T10:30:00Z",
    "overall_result": {
        "total_marks_earned": 8,
        "total_marks_possible": 10,
        "percentage": 80.0,
        "grade": "A",
        "pass_status": True
    },
    "section_results": [],
    "question_feedback": [],
    "learning_recommendations": [],
    "encouragement_message": "Great job!"
}

def test_grading_returns_structured_response():
    """Test that grading returns EvaluationResult via structured_response."""
    # Mock the model to return the structured output tool call
    model = GenericFakeChatModel(messages=iter([
        AIMessage(content="", tool_calls=[
            ToolCall(
                name="EvaluationResult",
                args=MOCK_EVALUATION,
                id="call_eval_1"
            ),
        ])
    ]))

    # Create agent with mocked model (matches production setup)
    agent = create_agent(
        model=model,
        tools=[],
        response_format=ToolStrategy(EvaluationResult)
    )

    result = agent.invoke({
        "messages": [{"role": "user", "content": "Grade this exam submission..."}]
    })

    # Result is in structured_response, not evaluation_result
    assert result["structured_response"].overall_result.total_marks_earned == 8
    assert result["structured_response"].overall_result.grade == "A"
```

#### 1.2 InMemorySaver for Checkpointing (Optional)

For exam grading, checkpointing is typically NOT needed since each submission is
independent. However, if you want to support resumable grading:

```python
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

def test_with_checkpointer():
    """Test agent with checkpointing enabled (optional for exam grading)."""
    checkpointer = InMemorySaver()

    agent = create_agent(
        model="gpt-5.1-mini",
        tools=[],
        response_format=ToolStrategy(EvaluationResult),
        checkpointer=checkpointer
    )

    # Each exam submission is independent, but checkpointing could be used
    # for audit trails or debugging
    result = agent.invoke(
        {"messages": [{"role": "user", "content": grading_message}]},
        config={"configurable": {"thread_id": "exam_attempt_123"}}
    )

    assert result["structured_response"] is not None
```

#### 1.3 LLM Output Validation Tests

Since grading is LLM-powered, test that outputs conform to expected schema:

```python
# tests/test_grading_output.py
import pytest
from pydantic import ValidationError
# Import from LOCAL models (self-contained - no claud_author_agent dependency)
from langgraph_agent.src.agent.graph_mock_exam_models import (
    EvaluationResult,
    QuestionFeedback,
    LearningRecommendation,
    calculate_grade
)

def test_question_feedback_schema():
    """Test that QuestionFeedback schema validates correctly."""
    valid_feedback = {
        "question_id": "q1",
        "question_number": 1,
        "section_id": "section_a",
        "marks_earned": 2,
        "marks_possible": 2,
        "is_correct": True,
        "is_partially_correct": False,
        "feedback_summary": "Excellent work!",
        "what_you_did_well": "Perfect calculation",
        "correct_approach": "You correctly applied the formula",
        "related_concept": "Probability"
    }

    feedback = QuestionFeedback(**valid_feedback)
    assert feedback.is_correct is True
    assert feedback.feedback_summary == "Excellent work!"

def test_feedback_requires_correct_approach():
    """Test that correct_approach is required."""
    invalid_feedback = {
        "question_id": "q1",
        "question_number": 1,
        "section_id": "section_a",
        "marks_earned": 0,
        "marks_possible": 2,
        "is_correct": False,
        "feedback_summary": "Incorrect",
        # Missing correct_approach - should fail
        "related_concept": "Probability"
    }

    with pytest.raises(ValidationError):
        QuestionFeedback(**invalid_feedback)

def test_learning_recommendation_schema():
    """Test LearningRecommendation has required fields."""
    rec = LearningRecommendation(
        priority=1,
        topic="Quadratic Factorisation",
        reason="You struggled with questions 3, 7",
        action="Practice factorising when a>1",
        related_questions=[3, 7]
    )

    assert rec.priority == 1
    assert len(rec.related_questions) == 2

def test_sqa_grading_bands():
    """Test SQA grading band calculation (deterministic)."""
    # calculate_grade is imported from graph_mock_exam_models at top of file

    assert calculate_grade(75.0) == ('A', True)
    assert calculate_grade(65.0) == ('B', True)
    assert calculate_grade(55.0) == ('C', True)
    assert calculate_grade(45.0) == ('D', True)
    assert calculate_grade(35.0) == ('No Award', False)
```

### 2. Integration Testing with AgentEvals

Install the `agentevals` package:

```bash
pip install agentevals
```

#### 2.1 Trajectory Match Evaluator

With `create_agent` using `ToolStrategy(EvaluationResult)` and `tools=[]`, the trajectory is simple:

1. Human message (grading request)
2. AI message with `EvaluationResult` tool call
3. Tool message acknowledging the response

```python
# tests/test_graph_mock_exam_integration.py
from agentevals.trajectory.match import create_trajectory_match_evaluator
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# Create evaluator - strict mode since there's only ONE expected tool call
evaluator = create_trajectory_match_evaluator(
    trajectory_match_mode="strict",
)

def test_grading_trajectory():
    """Test that agent returns structured EvaluationResult."""
    from langgraph_agent.src.agent.graph_mock_exam import graph_mock_exam, build_grading_message

    grading_message = build_grading_message(sample_submission)

    result = graph_mock_exam.invoke({
        "messages": [{"role": "user", "content": grading_message}]
    })

    # Reference trajectory: Single EvaluationResult tool call
    # (No fetch/grade tools - LLM grades directly and returns structured output)
    reference_trajectory = [
        HumanMessage(content=grading_message),
        AIMessage(content="", tool_calls=[
            {
                "id": "call_eval",
                "name": "EvaluationResult",
                "args": {
                    "evaluation_id": "...",
                    "submission_id": sample_submission.submission_id,
                    # ... rest of EvaluationResult fields
                }
            },
        ]),
        ToolMessage(
            content="Grading complete. Results returned to student.",
            tool_call_id="call_eval"
        ),
    ]

    evaluation = evaluator(
        outputs=result["messages"],
        reference_outputs=reference_trajectory
    )

    assert evaluation["score"] is True, f"Trajectory mismatch: {evaluation.get('comment')}"
```

#### 2.2 Simplified Trajectory (No External Tools)

Since we use `tools=[]`, the agent's trajectory is much simpler than tool-based approaches:

| Old Approach (with tools) | New Approach (create_agent + ToolStrategy) |
|---------------------------|-------------------------------------------|
| Human → fetch_exam → grade_mcq → grade_numeric → calculate → store → AI | Human → EvaluationResult → Done |
| 5-7 tool calls | 1 tool call (the structured output) |
| Complex trajectory testing | Simple trajectory testing |

**Recommended Mode**: `strict` - Since there's only one expected tool call (EvaluationResult).

#### 2.3 LLM-as-Judge for Feedback Quality

Use LLM-as-judge to evaluate the **quality** of generated feedback, not the trajectory:

```python
from agentevals.trajectory.llm import (
    create_trajectory_llm_as_judge,
    TRAJECTORY_ACCURACY_PROMPT
)

# Custom prompt focused on feedback quality
FEEDBACK_QUALITY_PROMPT = """Evaluate the quality of the exam grading feedback.

Check that:
1. Every question has constructive feedback (not just "correct/incorrect")
2. Wrong answers explain WHY they're wrong and the correct approach
3. Misconceptions are detected and explained helpfully
4. The overall tone is encouraging and educational
5. Learning recommendations are specific and actionable

Score True if feedback meets these criteria, False otherwise."""

evaluator = create_trajectory_llm_as_judge(
    model="openai:o3-mini",
    prompt=FEEDBACK_QUALITY_PROMPT,
)

def test_feedback_quality():
    """Use LLM judge to evaluate feedback quality, not trajectory."""
    from langgraph_agent.src.agent.graph_mock_exam import graph_mock_exam, build_grading_message

    grading_message = build_grading_message(submission_with_errors)

    result = graph_mock_exam.invoke({
        "messages": [{"role": "user", "content": grading_message}]
    })

    # Evaluate the structured response quality
    evaluation = evaluator(
        outputs=result["messages"],
    )

    assert evaluation["score"] is True, f"Feedback quality issue: {evaluation.get('comment')}"
```

### 3. HTTP Recording with VCRpy

Record and replay API calls for fast, deterministic CI tests:

```python
# conftest.py
import pytest

@pytest.fixture(scope="session")
def vcr_config():
    return {
        "filter_headers": [
            ("authorization", "XXXX"),
            ("x-api-key", "XXXX"),
            ("anthropic-api-key", "XXXX"),
        ],
        "filter_query_parameters": [
            ("api_key", "XXXX"),
        ],
        "record_mode": "once",
    }
```

```ini
# pytest.ini
[pytest]
markers =
    vcr: record/replay HTTP via VCR
addopts = --record-mode=once
```

```python
# tests/test_graph_mock_exam_vcr.py
import pytest

@pytest.mark.vcr()
def test_full_exam_grading_flow():
    """Test complete exam grading with recorded HTTP calls."""
    from langgraph_agent.src.agent.graph_mock_exam import graph_mock_exam

    result = graph_mock_exam.invoke({
        "exam_submission": full_exam_submission
    })

    assert result["evaluation_result"].overall_result.grade in ["A", "B", "C", "D", "No Award"]
```

### 4. LangSmith Integration

Track experiments over time with LangSmith:

```bash
export LANGSMITH_API_KEY="your_key"
export LANGSMITH_TRACING="true"
```

```python
# tests/test_langsmith_tracking.py
import pytest
from langsmith import testing as t
from agentevals.trajectory.llm import create_trajectory_llm_as_judge, TRAJECTORY_ACCURACY_PROMPT

trajectory_evaluator = create_trajectory_llm_as_judge(
    model="openai:o3-mini",
    prompt=TRAJECTORY_ACCURACY_PROMPT,
)

@pytest.mark.langsmith
def test_grading_accuracy_tracked():
    """Test with LangSmith tracking for experiment comparison."""
    from langgraph_agent.src.agent.graph_mock_exam import graph_mock_exam

    result = graph_mock_exam.invoke({
        "exam_submission": sample_submission
    })

    # Log to LangSmith
    t.log_inputs({"exam_submission": sample_submission.dict()})
    t.log_outputs({"messages": result["messages"]})

    trajectory_evaluator(outputs=result["messages"])

# Run with: pytest tests/test_langsmith_tracking.py --langsmith-output
```

### 5. Specific Test Cases for Mock Exam Grading

| Test Case                          | Type        | Description                                          |
|------------------------------------|-------------|------------------------------------------------------|
| `test_question_feedback_schema`    | Unit        | QuestionFeedback validates with all required fields  |
| `test_misconception_feedback_schema` | Unit      | MisconceptionFeedback has all constructive elements  |
| `test_learning_recommendation_schema` | Unit     | LearningRecommendation has priority and action       |
| `test_sqa_grade_A`                 | Unit        | 70%+ → Grade A (deterministic function)              |
| `test_sqa_grade_no_award`          | Unit        | <40% → No Award (deterministic function)             |
| `test_evaluation_result_complete`  | Unit        | EvaluationResult has all required sections           |
| `test_feedback_has_correct_approach` | Unit      | Every QuestionFeedback includes correct_approach     |
| `test_llm_grades_mcq_correctly`    | Integration | LLM correctly identifies MCQ right/wrong answers     |
| `test_llm_grades_numeric_tolerance` | Integration | LLM accepts numeric answers within tolerance        |
| `test_llm_generates_constructive_feedback` | LLM Judge | Feedback includes what_you_did_well for wrong answers |
| `test_llm_detects_misconceptions`  | LLM Judge   | LLM identifies known misconceptions semantically     |
| `test_llm_feedback_is_encouraging` | LLM Judge   | Feedback tone is supportive, not discouraging        |
| `test_recommendations_are_specific` | LLM Judge  | Learning recommendations reference actual errors     |

### 6. Test File Structure

```
langgraph-agent/
├── tests/
│   ├── conftest.py                         # VCR config, fixtures
│   ├── fixtures/
│   │   ├── sample_submission.json          # Test submission data
│   │   └── sample_mock_exam.json           # Test mock exam
│   ├── cassettes/                          # VCR recordings
│   │   └── test_full_exam_grading_flow.yaml
│   ├── test_graph_mock_exam_unit.py        # Unit tests
│   ├── test_graph_mock_exam_integration.py # Trajectory tests
│   ├── test_grading_tools.py               # Tool function tests
│   └── test_langsmith_tracking.py          # LangSmith tests
├── pytest.ini                              # Pytest configuration
└── pyproject.toml                          # Project config with test deps
```

### 7. Test Dependencies

Add to `pyproject.toml`:

```toml
[project.optional-dependencies]
test = [
    "pytest>=7.0",
    "pytest-asyncio>=0.21",
    "pytest-recording>=0.12",  # VCR integration
    "vcrpy>=4.2",
    "agentevals>=0.1",         # LangChain agent evaluators
    "langsmith>=0.1",          # LangSmith integration
]
```

### 8. Running Tests

```bash
# All tests
pytest tests/

# Unit tests only
pytest tests/test_grading_tools.py tests/test_graph_mock_exam_unit.py

# Integration tests with real API (records cassettes)
pytest tests/test_graph_mock_exam_integration.py

# With LangSmith tracking
pytest tests/test_langsmith_tracking.py --langsmith-output

# With coverage
pytest tests/ --cov=src/agent --cov-report=html
```

### Test Data

Use sample mock exams from `claud_author_agent/workspaces/*/mock_exam.json` (read-only reference).

Copy test fixtures to `langgraph-agent/tests/fixtures/` for self-contained testing.

---

## Estimated Effort (LangGraph Approach)

| Task | Estimate |
|------|----------|
| Create `graph_mock_exam.py` | 2-3 hours |
| Create grading tools (`graph_mock_exam_tools.py`) | 2 hours |
| Update `langgraph.json` | 0.5 hours |
| Testing with sample mock exam data | 2 hours |
| Frontend integration (`submit-exam.ts`) | 2 hours |
| **Total** | **8-10 hours** |

**Note**: Backend has NO Appwrite integration - that time moves to frontend (Appwrite-agnostic pattern).

---

## Dependencies

- ✅ Schema reference available in `claud_author_agent/src/tools/mock_exam_schema_models.py` (read-only)
- ✅ Appwrite collections exist: `mock_exams`, `exam_attempts`
- ✅ LangGraph `create_agent` documentation in `langgraph-agent/docs/create_agent_docs.md`
- ❌ `langgraph-agent/src/agent/graph_mock_exam_models.py` - To be created (self-contained models)
- ❌ `langgraph-agent/src/agent/graph_mock_exam.py` - To be created (agent implementation)
- Frontend will call the graph after Phase 3 state management is complete

> **Self-Contained Architecture**: The backend has NO dependencies on `claud_author_agent`.
> All Pydantic models are duplicated locally in `graph_mock_exam_models.py`.

---

## Open Questions Resolved

1. ✅ **LLM Grading for Structured Responses**: Yes, using `create_agent` - the LLM evaluates against marking schemes

2. ⏳ **Retake Policy**: Tracked via `attemptNumber` in `exam_attempts` - policy TBD (configurable per exam)

3. ✅ **Partial Submission**: Handled by frontend localStorage persistence before final submission

4. ⏳ **Analytics**: Can be added by storing per-question timing data in submission

---

## Frontend Integration Details (Appwrite-Agnostic Pattern)

> **Architecture**: Frontend handles ALL Appwrite CRUD operations. Backend is a pure processing engine.
>
> This follows the same pattern as `SessionChatAssistant.tsx` for interactive lessons.

### 4-Step Integration Pattern

| Step | Component | Action |
|------|-----------|--------|
| 1 | Frontend | Fetch mock exam from Appwrite |
| 2 | Frontend | Build `ExamSubmissionWithExam` input (includes full exam data) |
| 3 | Frontend → Backend | Send to LangGraph for grading (no Appwrite access) |
| 4 | Frontend | Store `EvaluationResult` to Appwrite |

---

### Step 1: Fetch Mock Exam from Appwrite

```typescript
// assistant-ui-frontend/lib/exam/fetch-exam.ts
import { createAdminClient } from "@/lib/appwrite/config";
import { decompressSections } from "@/lib/utils/compression";
import { MockExam } from "@/lib/exam/types";

export async function fetchMockExam(examId: string): Promise<MockExam> {
  const { databases } = createAdminClient();

  const doc = await databases.getDocument(
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!,
    "mock_exams",
    examId
  );

  // Parse and decompress the exam data
  const sections = decompressSections(doc.sections);
  const metadata = JSON.parse(doc.metadata);
  const summary = JSON.parse(doc.summary);

  return {
    examId: doc.examId,
    courseId: doc.courseId,
    sowId: doc.sowId,
    sowEntryOrder: doc.sowEntryOrder,
    metadata,
    sections,
    summary,
    version: doc.version,
    status: doc.status
  };
}
```

---

### Step 2: Build Complete Input (ExamSubmissionWithExam)

```typescript
// assistant-ui-frontend/lib/exam/build-submission.ts
import { ExamSubmissionWithExam, MockExam, SubmittedAnswer } from "@/lib/exam/types";

export function buildExamSubmissionWithExam(
  exam: MockExam,
  attemptId: string,
  studentId: string,
  answers: SubmittedAnswer[],
  startedAt: Date,
  wasAutoSubmitted: boolean = false
): ExamSubmissionWithExam {
  return {
    // Submission data (student answers)
    submission_id: `sub_${Date.now()}`,
    exam_id: exam.examId,
    attempt_id: attemptId,
    student_id: studentId,
    course_id: exam.courseId,
    submission_metadata: {
      started_at: startedAt.toISOString(),
      submitted_at: new Date().toISOString(),
      time_limit_minutes: exam.metadata.timeLimit,
      time_spent_minutes: calculateTimeSpent(startedAt),
      time_overage_minutes: calculateOverage(startedAt, exam.metadata.timeLimit),
      was_auto_submitted: wasAutoSubmitted
    },
    answers,
    exam_context: {
      total_questions: countTotalQuestions(exam),
      questions_answered: answers.filter(a => a.response).length,
      questions_skipped: countSkipped(exam, answers),
      questions_flagged: answers.filter(a => a.is_flagged).length,
      sections_completed: countCompletedSections(exam, answers)
    },

    // Mock exam data (frontend already has this - no backend fetch needed!)
    mock_exam: exam
  };
}

function calculateTimeSpent(startedAt: Date): number {
  return Math.floor((Date.now() - startedAt.getTime()) / 60000);
}

function calculateOverage(startedAt: Date, timeLimit: number): number {
  const spent = calculateTimeSpent(startedAt);
  return Math.max(0, spent - timeLimit);
}

function countTotalQuestions(exam: MockExam): number {
  return exam.sections.reduce((sum, s) => sum + s.questions.length, 0);
}

function countSkipped(exam: MockExam, answers: SubmittedAnswer[]): number {
  const answeredIds = new Set(answers.filter(a => a.response).map(a => a.question_id));
  return countTotalQuestions(exam) - answeredIds.size;
}

function countCompletedSections(exam: MockExam, answers: SubmittedAnswer[]): number {
  // A section is complete if all questions have answers
  return exam.sections.filter(section => {
    const sectionQuestionIds = new Set(section.questions.map(q => q.question_id));
    const answeredInSection = answers.filter(a =>
      sectionQuestionIds.has(a.question_id) && a.response
    ).length;
    return answeredInSection === section.questions.length;
  }).length;
}
```

---

### Step 3: Call Backend for Grading (No Appwrite Access)

```typescript
// assistant-ui-frontend/lib/exam/submit-exam.ts
import { Client } from "@langchain/langgraph-sdk";
import { ExamSubmissionWithExam, EvaluationResult } from "@/lib/exam/types";

/**
 * Send exam submission to LangGraph for grading.
 *
 * NOTE: The backend does NOT access Appwrite. All exam data is included
 * in the input, and the result is returned to the frontend for storage.
 */
export async function submitExamForGrading(
  submissionWithExam: ExamSubmissionWithExam
): Promise<EvaluationResult> {
  const client = new Client({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024"
  });

  // Create a run on the graph_mock_exam graph
  // Backend receives all data it needs - no Appwrite access required
  const run = await client.runs.create(
    null, // thread_id - stateless for exam grading
    "graph_mock_exam", // assistant_id (graph name from langgraph.json)
    {
      input: {
        messages: [],
        exam_submission: submissionWithExam  // Includes mock_exam!
      }
    }
  );

  // Wait for completion and get structured response
  const result = await client.runs.wait(run.run_id);
  return result.structured_response as EvaluationResult;
}
```

---

### Step 4: Store Result to Appwrite

```typescript
// assistant-ui-frontend/lib/exam/store-result.ts
import { createAdminClient } from "@/lib/appwrite/config";
import { ID } from "appwrite";
import { EvaluationResult } from "@/lib/exam/types";

/**
 * Store the evaluation result to Appwrite after receiving from backend.
 *
 * This is the ONLY place where exam results are persisted to the database.
 * The backend never accesses Appwrite directly.
 */
export async function storeEvaluationResult(
  attemptId: string,
  result: EvaluationResult
): Promise<void> {
  const { databases } = createAdminClient();
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

  // Store the full evaluation result
  await databases.createDocument(
    databaseId,
    "exam_results",
    ID.unique(),
    {
      attemptId,
      submissionId: result.submission_id,
      evaluationId: result.evaluation_id,
      result_json: JSON.stringify(result),
      total_marks_earned: result.overall_result.total_marks_earned,
      total_marks_possible: result.overall_result.total_marks_possible,
      percentage: result.overall_result.percentage,
      grade: result.overall_result.grade,
      pass_status: result.overall_result.pass_status,
      evaluated_at: result.evaluated_at
    }
  );

  // Update the exam_attempts document with result summary
  await databases.updateDocument(
    databaseId,
    "exam_attempts",
    attemptId,
    {
      status: "graded",
      evaluationResult: JSON.stringify(result),
      score: result.overall_result.total_marks_earned,
      totalMarks: result.overall_result.total_marks_possible,
      percentage: result.overall_result.percentage
    }
  );
}
```

---

### TypeScript Types (Updated for Appwrite-Agnostic Pattern)

```typescript
// assistant-ui-frontend/lib/exam/types.ts

// NEW: Input model that includes both submission AND exam data
export interface ExamSubmissionWithExam {
  // Submission data (student answers)
  submission_id: string;
  exam_id: string;
  attempt_id: string;
  student_id: string;
  course_id: string;
  submission_metadata: SubmissionMetadata;
  answers: SubmittedAnswer[];
  exam_context: ExamContext;

  // Mock exam data (frontend provides this - backend doesn't fetch)
  mock_exam: MockExam;
}

// Matches EvaluationResult Pydantic model (unchanged)
export interface EvaluationResult {
  evaluation_id: string;
  submission_id: string;
  evaluated_at: string;
  overall_result: OverallResult;
  section_results: SectionResult[];
  question_results: QuestionResult[];
  learning_recommendations: string[];
}

// ... additional nested types (MockExam, SubmissionMetadata, etc.)
```

---

### Complete Flow in MockExamContainer

```tsx
// components/exam/MockExamContainer.tsx

import { fetchMockExam } from "@/lib/exam/fetch-exam";
import { buildExamSubmissionWithExam } from "@/lib/exam/build-submission";
import { submitExamForGrading } from "@/lib/exam/submit-exam";
import { storeEvaluationResult } from "@/lib/exam/store-result";
import { EvaluationResult, MockExam } from "@/lib/exam/types";

function MockExamContainer({ examId, studentId, attemptId }: Props) {
  const [exam, setExam] = useState<MockExam | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answers, setAnswers] = useState<SubmittedAnswer[]>([]);
  const [startedAt] = useState(new Date());

  // Step 1: Fetch exam on mount
  useEffect(() => {
    fetchMockExam(examId)
      .then(setExam)
      .catch(error => {
        console.error("Failed to fetch exam:", error);
        throw error; // Fast fail per CLAUDE.md
      });
  }, [examId]);

  const handleSubmit = async (wasAutoSubmitted: boolean = false) => {
    if (!exam) {
      throw new Error("Exam not loaded - cannot submit");
    }

    setIsSubmitting(true);

    try {
      // Step 2: Build complete input (includes exam data)
      const submissionWithExam = buildExamSubmissionWithExam(
        exam,
        attemptId,
        studentId,
        answers,
        startedAt,
        wasAutoSubmitted
      );

      // Step 3: Send to backend for grading (backend has no Appwrite access)
      const evaluationResult = await submitExamForGrading(submissionWithExam);

      // Step 4: Store result to Appwrite (frontend responsibility)
      await storeEvaluationResult(attemptId, evaluationResult);

      setResult(evaluationResult);
    } catch (error) {
      console.error("Submission failed:", error);
      throw error; // Fast fail per CLAUDE.md
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... render logic
}
```
