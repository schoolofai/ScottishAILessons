# Nat5+ SQA Mock Exam System

## Overview

A complete mock exam system for National 5+ SQA courses with three components:

1. **Offline Mock Exam Generator** - Claude author agent generating unique exams
2. **LangGraph Evaluator** - AI-powered SQA-style marking
3. **Frontend** - `/sqa-mock-exam` route for taking exams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NAT5+ MOCK EXAM SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │  AUTHOR AGENT   │    │    FRONTEND     │    │    EVALUATOR    │        │
│  │  (Offline)      │    │  /sqa-mock-exam │    │   (LangGraph)   │        │
│  │                 │    │                 │    │                 │        │
│  │  • Generate     │───▶│  • Browse exams │───▶│  • SQA marking  │        │
│  │  • Validate     │    │  • Take exam    │    │  • Feedback     │        │
│  │  • Upsert       │    │  • Submit       │    │  • Grades       │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│           │                      │                     │                   │
│           └──────────────────────┼─────────────────────┘                   │
│                                  ▼                                         │
│                        ┌─────────────────┐                                 │
│                        │    APPWRITE     │                                 │
│                        │  nat5_plus_*    │                                 │
│                        └─────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Generate an Exam

```bash
cd claud_author_agent
source .venv/bin/activate

python -m src.nat5_plus.exam_generator_client \
  --course-id "YOUR_COURSE_ID" \
  --workspace ./workspaces/exam_001
```

### 2. Start the Application

```bash
./start.sh
```

### 3. Take an Exam

Navigate to `http://localhost:3000/sqa-mock-exam` and select an exam.

## Appwrite Collections

### nat5_plus_mock_exams

Stores generated exams with compressed content.

| Field | Type | Description |
|-------|------|-------------|
| courseId | string | Course identifier |
| subject | string | Subject name |
| level | string | Qualification level |
| exam_version | integer | Version number |
| status | enum | draft/published/archived |
| metadata | string (JSON) | Title, marks, duration |
| sections | string (compressed) | Questions with marking schemes |
| topic_coverage | string[] | Topics covered |
| difficulty_distribution | string (JSON) | Easy/medium/hard mix |

### nat5_plus_exam_attempts

Tracks student exam attempts and results.

| Field | Type | Description |
|-------|------|-------------|
| examId | string | Exam reference |
| studentId | string | Student reference |
| attempt_number | integer | Which attempt |
| status | enum | in_progress/submitted/graded |
| answers_snapshot | string (compressed) | Student answers |
| result_snapshot | string (compressed) | Evaluation result |
| marks_earned | integer | Total marks earned |
| marks_possible | integer | Maximum possible |
| percentage | float | Score percentage |
| grade | string | A/B/C/D/No Award |

### nat5_plus_exam_summaries

For uniqueness tracking by the author agent. Each generated exam creates a summary with question fingerprints (SHA-256 hashes of normalized stems).

| Field | Type | Description |
|-------|------|-------------|
| courseId | string | Course identifier |
| exam_id | string | Exam reference |
| topic_ids | string[] | Topics used |
| question_styles | string[] | Styles used |
| difficulty_mix | string (JSON) | Easy/medium/hard distribution |
| question_fingerprints | string (JSON) | SHA-256 content hashes for uniqueness |
| created_at | string | Creation timestamp |

## Cross-Exam Uniqueness

### How It Works

The system guarantees unique questions across multiple exams for the same course:

1. **Load Phase**: When generating a new exam, all existing `nat5_plus_exam_summaries` for the course are loaded
2. **Build Known Set**: All fingerprints from previous exams are combined into a known set
3. **Generate & Check**: Each new question's stem is fingerprinted and checked against known set
4. **Persist**: New exam's fingerprints are saved for future generations

### Verification Results (2026-01-13)

| Exam | Document ID | Internal Duplicates | Cross-Exam Overlap |
|------|-------------|--------------------|--------------------|
| Exam 1 (Pre-Fix) | `6966428c...` | 40% ❌ | - |
| Exam 2 (Post-Fix) | `69664b50...` | 0% ✅ | 0 fingerprints ✅ |
| Exam 3 (Post-Fix) | `69664c57...` | 0% ✅ | 0 fingerprints ✅ |

**Key Findings:**
- Post-fix exams have **0% internal duplicates** (Bug #13 fixed)
- **0 overlapping fingerprints** between any pair of exams
- Cross-exam uniqueness algorithm working correctly

## API Routes

### List Exams
```
GET /api/sqa-mock-exam?courseId={courseId}
```

### Get Exam
```
GET /api/sqa-mock-exam/{examId}
```

### Create Attempt
```
POST /api/sqa-mock-exam/attempt
Body: { examId, courseId }
```

### Submit Exam
```
POST /api/sqa-mock-exam/{examId}/submit
Body: { attemptId, answers[], mock_exam }
```

### Get Attempt Status
```
GET /api/sqa-mock-exam/attempt/{attemptId}
```

## SQA Marking System

The evaluator uses SQA-style marking:

### Grade Bands

| Grade | Percentage |
|-------|------------|
| A | 85-100% |
| B | 70-84% |
| C | 55-69% |
| D | 40-54% |
| No Award | 0-39% |

### Marking Principles

1. **Bullet-by-bullet marking** - Each mark point assessed independently
2. **Follow-through marks** - Credit for correct method with wrong values
3. **Tolerance ranges** - Accept values within specified tolerances
4. **Equivalent forms** - Accept mathematically equivalent answers

---

## LLM-Based Evaluation System

### Architecture Overview

The evaluation system uses **GPT-4o-mini** with structured output via LangChain's `with_structured_output()` to perform accurate SQA-style marking. This replaces an earlier Python pattern-matching approach that was error-prone.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LLM EVALUATION PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STUDENT SUBMISSION                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │  POST /api/sqa-mock-exam/{examId}/submit                            │       │
│  │  Body: { attemptId, answers: [{question_id, response_text, ...}] }  │       │
│  └─────────────────────────────────┬───────────────────────────────────┘       │
│                                    │                                            │
│                                    ▼                                            │
│  NEXT.JS API ROUTE                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │  1. Validate submission (Zod schema)                                │       │
│  │  2. Verify student owns attempt                                     │       │
│  │  3. Save answers_snapshot (compressed)                              │       │
│  │  4. Update status = 'submitted'                                     │       │
│  │  5. Trigger background grading ─────────────────────────────────────┼──┐    │
│  │  6. Return immediately to frontend                                  │  │    │
│  └─────────────────────────────────────────────────────────────────────┘  │    │
│                                                                            │    │
│                                    ┌───────────────────────────────────────┘    │
│                                    │                                            │
│                                    ▼                                            │
│  LANGGRAPH EVALUATOR (graph_nat5_plus_exam)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │  POST http://localhost:2024/runs/wait                               │       │
│  │  assistant_id: "graph_nat5_plus_exam"                               │       │
│  │                                                                     │       │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐       │       │
│  │  │  parse_exam   │───▶│ grade_question│───▶│  aggregate    │       │       │
│  │  │               │    │   (loop)      │    │   results     │       │       │
│  │  └───────────────┘    └───────────────┘    └───────────────┘       │       │
│  │         │                    │                    │                 │       │
│  │         │                    ▼                    │                 │       │
│  │         │         ┌───────────────────┐          │                 │       │
│  │         │         │  GPT-4o-mini +    │          │                 │       │
│  │         │         │  Structured Output│          │                 │       │
│  │         │         │  (Per Question)   │          │                 │       │
│  │         │         └───────────────────┘          │                 │       │
│  │         │                                        │                 │       │
│  │         └────────────────────────────────────────┘                 │       │
│  └─────────────────────────────────┬───────────────────────────────────┘       │
│                                    │                                            │
│                                    ▼                                            │
│  UPDATE APPWRITE                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │  nat5_plus_exam_attempts.update({                                   │       │
│  │    status: 'graded',                                                │       │
│  │    result_snapshot: compressed(EvaluationResult),                   │       │
│  │    marks_earned, marks_possible, percentage, grade                  │       │
│  │  })                                                                 │       │
│  └─────────────────────────────────────────────────────────────────────┘       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### LLM Marking Engine

**File:** `langgraph-agent/src/agent/nat5_plus_marking_engine.py`

The marking engine uses GPT-4o-mini with a carefully crafted prompt that enforces SQA marking principles:

```python
# Core grading function
async def grade_question_with_llm(
    question: Dict[str, Any],
    student_answer: Dict[str, Any],
    marking_scheme: Dict[str, Any]
) -> QuestionMarkingResult:
    """Grade using GPT-4o-mini with structured output."""

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    structured_llm = llm.with_structured_output(QuestionMarkingLLMResponse)

    response = await structured_llm.ainvoke(
        SQA_MARKING_PROMPT.format(...),
        config={"tags": ["json", "sqa_marking"]}
    )
```

### Pydantic Schemas for Structured Output

The LLM returns structured JSON matching these schemas:

```python
class BulletMarkingLLMResult(BaseModel):
    """Result for a single bullet point in the marking scheme."""
    bullet: int              # Bullet number (1, 2, 3, ...)
    achieved: bool           # Did student achieve this mark?
    marks_awarded: int       # 0 or bullet's max marks
    marks_possible: int      # Maximum for this bullet
    feedback: str            # Specific marking feedback
    student_evidence: str    # Quote from student's work

class QuestionMarkingLLMResponse(BaseModel):
    """Complete response for grading one question."""
    question_id: str
    bullet_results: List[BulletMarkingLLMResult]
    total_marks_earned: int
    total_marks_possible: int
    overall_feedback: str
    misconception_detected: Optional[str]  # Common errors identified
    marking_reasoning: str                 # Internal grading rationale
```

### SQA Marking Prompt

The prompt enforces authentic SQA examination standards:

```
You are an SQA examiner grading a National 5 Mathematics question.

## SQA MARKING PRINCIPLES (FOLLOW STRICTLY)

1. **INDEPENDENT BULLET MARKING**: Each bullet marked independently.
   A mistake in bullet 1 should NOT affect bullet 2 if bullet 2 is correct.

2. **FOLLOW-THROUGH MARKS**: If a student makes an arithmetic error early
   but uses correct METHOD throughout, award follow-through marks for
   subsequent bullets that use their incorrect value correctly.

3. **EQUIVALENT FORMS**: Accept mathematically equivalent answers:
   - "6x + 4" = "4 + 6x" = "2(3x + 2)"
   - "x = 6" = "6" = "x=6"

4. **TOLERANCE FOR NUMERIC ANSWERS**: Accept within 1% tolerance.

5. **WORKING SHOWN**: Credit correct method even with arithmetic slips.

6. **STRICT ON CORRECTNESS**: Do NOT award marks for wrong answers
   just because they "look close" or contain some correct elements.

## QUESTION BEING MARKED
{question_stem}

## MARKING SCHEME
### Generic Scheme: {generic_scheme}
### Illustrative Scheme: {illustrative_scheme}

## STUDENT'S SUBMISSION
**Answer:** {student_answer}
**Working:** {student_working}

Grade EACH bullet point independently...
```

### Evaluation Flow by Example

**Test Scenario: Mixed Answers**

| Question | Student Answer | Working Shown | Result |
|----------|---------------|---------------|--------|
| Q1 (3 marks) | "2x + 12" ❌ | "3x-2x=2x, 5+7=12" | 1/3 (constants correct) |
| Q2 (4 marks) | "6x + 8" ❌ | "P=2(2x+3+x-1)=6x+8" | 3/4 (follow-through!) |
| Q3 (5 marks) | (blank) | (blank) | 0/5 |

**Key Observations:**
- Q1: LLM awarded 1 mark for correctly combining constants (5+7=12) despite wrong coefficient
- Q2: LLM correctly applied **follow-through marking** - method was correct, only arithmetic error (2+3-1=4, not 5, so 6x+4 not 6x+8)
- Q3: Empty submissions receive 0 marks without LLM call (optimization)

---

## Evaluation Result Presentation

### Frontend Polling Flow

After submission, the frontend polls for grading completion:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND POLLING SEQUENCE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SQAExamContainer                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  phase: 'submitting'                                                │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  "Submitting your exam..."  ──▶  "Grading your answers..."  │   │   │
│  │  │           (POST submit)               (status = submitted)  │   │   │
│  │  └────────────────────────────────────────────┬────────────────┘   │   │
│  │                                               │                     │   │
│  │                                               ▼                     │   │
│  │  POLLING LOOP (every 2 seconds)                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  GET /api/sqa-mock-exam/attempt/{attemptId}                 │   │   │
│  │  │                                                             │   │   │
│  │  │  status: 'submitted' ──▶ Continue polling...                │   │   │
│  │  │  status: 'graded'    ──▶ Stop polling, show results         │   │   │
│  │  │  status: 'grading_error' ──▶ Show error message             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  phase: 'results' (when graded)                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Results Display Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESULTS PAGE LAYOUT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SQAResultsSummary                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ╔═══════════════════════════════════════════════════════╗  │   │   │
│  │  │  ║                    GRADE BADGE                        ║  │   │   │
│  │  │  ║                                                       ║  │   │   │
│  │  │  ║        ┌─────────┐                                    ║  │   │   │
│  │  │  ║        │    A    │  (or B, C, D, No Award)           ║  │   │   │
│  │  │  ║        └─────────┘                                    ║  │   │   │
│  │  │  ║                                                       ║  │   │   │
│  │  │  ║        11 / 12 marks (91.7%)                         ║  │   │   │
│  │  │  ╚═══════════════════════════════════════════════════════╝  │   │   │
│  │  │                                                             │   │   │
│  │  │  SECTION BREAKDOWN                                          │   │   │
│  │  │  ┌──────────────────────────────────────────────────────┐   │   │   │
│  │  │  │ Section A: 8/8 marks  ████████████████████ 100%     │   │   │   │
│  │  │  │ Section B: 3/4 marks  ███████████████░░░░░  75%     │   │   │   │
│  │  │  └──────────────────────────────────────────────────────┘   │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SQAFeedbackPanel (per question)                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  Question 1: Simplify 3x - 2x + 5 + 7           3/3 marks   │   │   │
│  │  │  ──────────────────────────────────────────────────────────  │   │   │
│  │  │                                                              │   │   │
│  │  │  YOUR ANSWER: x + 12                                        │   │   │
│  │  │                                                              │   │   │
│  │  │  BULLET-BY-BULLET FEEDBACK                                  │   │   │
│  │  │  ┌────────────────────────────────────────────────────────┐ │   │   │
│  │  │  │ ✓ Bullet 1 (1 mark): Combine x terms                   │ │   │   │
│  │  │  │   Your work: "3x - 2x = x" ✓                           │ │   │   │
│  │  │  │   Expected: x                                          │ │   │   │
│  │  │  ├────────────────────────────────────────────────────────┤ │   │   │
│  │  │  │ ✓ Bullet 2 (1 mark): Combine constants                 │ │   │   │
│  │  │  │   Your work: "5 + 7 = 12" ✓                            │ │   │   │
│  │  │  │   Expected: 12                                         │ │   │   │
│  │  │  ├────────────────────────────────────────────────────────┤ │   │   │
│  │  │  │ ✓ Bullet 3 (1 mark): Final answer                      │ │   │   │
│  │  │  │   Your answer: "x + 12" ✓                              │ │   │   │
│  │  │  │   Expected: x + 12                                     │ │   │   │
│  │  │  └────────────────────────────────────────────────────────┘ │   │   │
│  │  │                                                              │   │   │
│  │  │  OVERALL FEEDBACK                                           │   │   │
│  │  │  "Excellent work! All steps correct with clear working."    │   │   │
│  │  │                                                              │   │   │
│  │  │  MISCONCEPTION DETECTED: None                               │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  Question 2: Find the perimeter...              3/4 marks   │   │   │
│  │  │  ──────────────────────────────────────────────────────────  │   │   │
│  │  │                                                              │   │   │
│  │  │  YOUR ANSWER: 6x + 8 (incorrect)                            │   │   │
│  │  │                                                              │   │   │
│  │  │  BULLET-BY-BULLET FEEDBACK                                  │   │   │
│  │  │  ┌────────────────────────────────────────────────────────┐ │   │   │
│  │  │  │ ✓ Bullet 1 (1 mark): Set up perimeter expression       │ │   │   │
│  │  │  │   Your work: "P = 2(2x+3+x-1)" ✓                       │ │   │   │
│  │  │  ├────────────────────────────────────────────────────────┤ │   │   │
│  │  │  │ ✓ Bullet 2 (1 mark): Combine like terms                │ │   │   │
│  │  │  │   Your work: "2x + x = 3x" ✓ (follow-through)          │ │   │   │
│  │  │  ├────────────────────────────────────────────────────────┤ │   │   │
│  │  │  │ ✓ Bullet 3 (1 mark): Apply distributive property       │ │   │   │
│  │  │  │   Your work: "2(3x+4) = 6x+8" ✓ (follow-through)       │ │   │   │
│  │  │  ├────────────────────────────────────────────────────────┤ │   │   │
│  │  │  │ ✗ Bullet 4 (1 mark): Correct final answer              │ │   │   │
│  │  │  │   Your answer: 6x + 8                                  │ │   │   │
│  │  │  │   Expected: 6x + 4                                     │ │   │   │
│  │  │  └────────────────────────────────────────────────────────┘ │   │   │
│  │  │                                                              │   │   │
│  │  │  MISCONCEPTION DETECTED:                                    │   │   │
│  │  │  "Arithmetic error in combining constants: 3 + (-1) = 2,   │   │   │
│  │  │   not 4. This led to 6x+8 instead of 6x+4."                │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### My Attempts Tab

The "My Attempts" tab shows historical attempts:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MY ATTEMPTS                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Mock Exam v1001                                                    │   │
│  │  Attempt #1 • Completed 2026-01-15                                 │   │
│  │                                                                     │   │
│  │  ┌─────┐  11/12 marks • 91.7%                    [Review]         │   │
│  │  │  A  │                                                          │   │
│  │  └─────┘                                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Mock Exam v1001                                                    │   │
│  │  Attempt #2 • Completed 2026-01-15                                 │   │
│  │                                                                     │   │
│  │  ┌──────────┐  4/12 marks • 33.3%                [Review]         │   │
│  │  │ No Award │                                                     │   │
│  │  └──────────┘                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ERROR HANDLING                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  status: 'grading_error'                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ Grading Error                                                   │   │
│  │                                                                     │   │
│  │  We encountered an issue while grading your exam. Your answers     │   │
│  │  have been saved. Please contact support if this persists.         │   │
│  │                                                                     │   │
│  │  [Return to Exam List]                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  CAUSES:                                                                    │
│  • LangGraph service unreachable (port 2024)                               │
│  • OpenAI API rate limit exceeded                                          │
│  • Structured output parse failure                                         │
│  • Timeout during grading (> 2 minutes)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Components

### ExamBrowser
Lists available exams with metadata and allows selection.

### SQAExamContainer
Main orchestrator for the exam experience:
- Instructions phase
- In-progress with timer
- Submitting with polling
- Results display

### SQAQuestionDisplay
Renders individual questions with:
- LaTeX support
- Working/solution input
- Final answer input
- Flag for review

### SQAResultsSummary
Displays overall results:
- Grade with band visualization
- Section breakdown
- Performance summary

### SQAFeedbackPanel
Detailed per-question feedback:
- Bullet-by-bullet marks
- Expected vs actual answers
- Misconception detection

## Testing

### Run All Tests

```bash
# Contract tests
pytest claud_author_agent/tests/contracts/ -v
pytest langgraph-agent/tests/unit_tests/test_nat5_plus_contracts.py -v
npm test -- --testPathPattern=contracts

# Unit tests
pytest claud_author_agent/tests/unit/ -v
pytest langgraph-agent/tests/unit_tests/test_nat5_plus*.py -v

# Integration tests
pytest claud_author_agent/tests/integration/ -v
```

### Validation Script

```bash
./scripts/validate_nat5_plus_system.sh
```

## Contract Fixtures

Shared JSON fixtures define the API contracts:

- `fixtures/sample_nat5_plus_exam.json` - Author → Frontend
- `fixtures/sample_nat5_plus_submission.json` - Frontend → Evaluator
- `fixtures/sample_nat5_plus_evaluation.json` - Evaluator → Frontend

## Environment Variables

```bash
# Appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_api_key

# LangGraph
LANGGRAPH_URL=http://localhost:2024

# Anthropic
ANTHROPIC_API_KEY=your_claude_api_key
```

## Troubleshooting

### "No exams available"
- Check `nat5_plus_mock_exams` collection has published exams
- Verify courseId filter if applied

### "Grading failed"
- Check LangGraph backend is running on port 2024
- Verify `graph_nat5_plus_exam` is registered in `langgraph.json`
- Check backend logs for errors

### "Failed to create attempt"
- Verify student is authenticated
- Check `nat5_plus_exam_attempts` collection permissions

## Related Files

- Author Agent: `claud_author_agent/src/nat5_plus/`
- Evaluator: `langgraph-agent/src/agent/graph_nat5_plus_exam.py`
- Frontend Types: `assistant-ui-frontend/lib/sqa-mock-exam/types.ts`
- Components: `assistant-ui-frontend/components/sqa-mock-exam/`
- API Routes: `assistant-ui-frontend/app/api/sqa-mock-exam/`
- Pages: `assistant-ui-frontend/app/(protected)/sqa-mock-exam/`
