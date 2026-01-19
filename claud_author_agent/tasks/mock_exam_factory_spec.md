# Mock Exam Factory Pattern Enhancement Specification

## Document Metadata
- **Created**: 2026-01-12
- **Status**: Draft
- **Architecture**: Claude Agent SDK (not LangGraph)
- **Based On**: Existing Mock Exam Author Agent patterns
- **Related Collections**: `us_papers` (sqa_education), `Authored_SOW` (default), `mock_exams` (default)

---

## Executive Summary

Enhance the mock exam author agent to support multiple input sources through an extensible factory pattern:

1. **Current**: SOW (Scheme of Work) as sole input source
2. **Target**: Factory pattern supporting SOW + Past Papers (`us_papers`) as input sources
3. **Marking Enhancement**: Generate SQA-aligned marking instructions with bullet-point notation (•1, •2, etc.)
4. **Feedback Enhancement**: Show mark allocation breakdown in student feedback

**Key Value Propositions**:
- **Authenticity**: Generate mock exams that mirror real SQA paper structure and marking
- **Marking Transparency**: Students see exactly which marks they earned/lost per question
- **Examiner Alignment**: Marking schemes use SQA bullet notation (`•1`, `•2`) from real papers
- **Error Prevention**: Include common errors and why marks are lost

---

## Architecture Overview

### Current State: SOW-Only Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT MOCK EXAM PIPELINE (SOW-Only)                    │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌──────────────────┐
                           │  Authored_SOW    │
                           │    Collection    │
                           │   (default DB)   │
                           └────────┬─────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  mock_exam_extractor.py       │
                    │  ────────────────────────     │
                    │  • Filter lesson_type=        │
                    │    "mock_exam"                │
                    │  • Decompress entries         │
                    │  • Extract SOW context        │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                         ┌──────────────────┐
                         │   WORKSPACE      │
                         ├──────────────────┤
                         │ mock_exam_       │
                         │   source.json    │
                         │ sow_context.json │
                         │ sow.json         │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │ Author      │ │  Critic     │ │  Reviser    │
          │ Agent       │→│  Agent      │→│  Agent      │
          │             │ │             │ │ (if needed) │
          └─────────────┘ └─────────────┘ └─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────────┐
                    │     mock_exams Collection     │
                    │         (default DB)          │
                    └───────────────────────────────┘
```

### Target State: Multi-Source Factory Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               TARGET MOCK EXAM PIPELINE (Factory Pattern)                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                         ┌──────────────────┐
│  Authored_SOW    │                         │    us_papers     │
│    Collection    │                         │    Collection    │
│   (default DB)   │                         │ (sqa_education)  │
└────────┬─────────┘                         └────────┬─────────┘
         │                                            │
         ▼                                            ▼
┌────────────────────┐                    ┌────────────────────┐
│ SOWSourceFactory   │                    │ PastPaperFactory   │
│ ─────────────────  │                    │ ─────────────────  │
│ • Extract mock_    │                    │ • Extract questions│
│   exam entries     │                    │   from paper       │
│ • Build lesson     │                    │ • Extract marking  │
│   context          │                    │   schemes (•1, •2) │
│ • Output:          │                    │ • Extract common   │
│   unified format   │                    │   errors           │
└────────┬───────────┘                    └────────┬───────────┘
         │                                         │
         │    ┌────────────────────────────┐       │
         └───►│   MockExamSourceFactory    │◄──────┘
              │   ─────────────────────    │
              │   Interface:               │
              │   • get_source_data()      │
              │   • get_marking_template() │
              │   • get_context()          │
              └─────────────┬──────────────┘
                            │
                            ▼
                 ┌──────────────────┐
                 │   WORKSPACE      │
                 ├──────────────────┤
                 │ source_data.json │ ← Unified format
                 │ marking_         │
                 │   template.json  │ ← SQA-style bullets
                 │ context.json     │
                 └────────┬─────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │ Author      │ │  Critic     │ │  Reviser    │
   │ Agent       │→│  Agent      │→│  Agent      │
   │             │ │ (enhanced)  │ │ (if needed) │
   └─────────────┘ └─────────────┘ └─────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────┐
│                mock_exams Collection (default DB)              │
│                                                                │
│  Enhanced with:                                                │
│  • SQA-style marking bullets (•1, •2, •3...)                  │
│  • illustrative_scheme (expected answers)                     │
│  • common_errors (why marks lost)                             │
│  • examiner_notes (marking guidance)                          │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│              MARKING BACKEND (LangGraph Agent)                 │
│                                                                │
│  Input: student_answer + enhanced_marking_scheme               │
│  Process:                                                      │
│  • Match answer against illustrative_scheme                   │
│  • Award marks per bullet (•1, •2...)                         │
│  • Detect common errors                                        │
│  Output: MarkingResult with bullet-level breakdown            │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                 STUDENT FEEDBACK (Frontend)                    │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Question 3a                              Score: 2/3     │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Mark Allocation:                                        │  │
│  │   •1 Strategy: Identify need to expand    ✓ (1 mark)   │  │
│  │   •2 Expand brackets correctly            ✓ (1 mark)   │  │
│  │   •3 Simplify and collect like terms      ✗ (0 marks)  │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ Feedback: You correctly identified the approach and    │  │
│  │ expanded the brackets. However, when simplifying you   │  │
│  │ made an error combining -3x and 2x.                    │  │
│  │                                                         │  │
│  │ Common Error Detected: Sign error when collecting      │  │
│  │ like terms                                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## Factory Pattern Design

### Class Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                 MockExamSourceFactory (ABC)                  │
│  ─────────────────────────────────────────────────────────  │
│  Abstract base class defining interface for source input     │
├─────────────────────────────────────────────────────────────┤
│  @abstractmethod                                             │
│  async def extract_source_data() -> SourceData               │
│                                                              │
│  @abstractmethod                                             │
│  async def get_marking_template() -> MarkingTemplate         │
│                                                              │
│  @abstractmethod                                             │
│  async def get_context() -> SourceContext                    │
│                                                              │
│  @abstractmethod                                             │
│  def get_source_type() -> SourceType                         │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                ▼                         ▼
┌───────────────────────────┐ ┌───────────────────────────────┐
│    SOWSourceFactory       │ │    PastPaperSourceFactory     │
│  ───────────────────────  │ │  ───────────────────────────  │
│  • courseId input         │ │  • paper_id input             │
│  • Queries Authored_SOW   │ │  • Queries us_papers          │
│  • Extracts mock_exam     │ │  • Extracts questions +       │
│    entries                │ │    marking schemes            │
│  • Builds lesson context  │ │  • Preserves bullet notation  │
│  • Output: unified format │ │  • Output: unified format     │
└───────────────────────────┘ └───────────────────────────────┘
```

### Unified Source Data Schema

```python
class SourceType(str, Enum):
    """Type of source for mock exam generation."""
    SOW = "sow"              # Scheme of Work
    PAST_PAPER = "past_paper" # SQA Past Paper

class SourceData(BaseModel):
    """Unified source data format for all factory types."""
    source_type: SourceType
    source_id: str  # courseId for SOW, paper_id for past paper

    # Metadata
    subject: str
    level: str
    level_code: str  # N5, NH, NAH
    year: Optional[int]  # Only for past papers
    paper_code: Optional[str]  # Only for past papers

    # Question source
    questions: List[SourceQuestion]

    # Context
    topic_coverage: List[str]
    total_marks: int
    duration_minutes: int
    calculator_allowed: bool

class SourceQuestion(BaseModel):
    """Question from source with marking scheme."""
    question_number: str
    text: str
    text_latex: Optional[str]
    marks: int
    topic_tags: List[str]

    # Marking scheme - SQA bullet format
    marking_scheme: MarkingScheme

    # Parts (if question has subparts)
    has_parts: bool
    parts: List[SourceQuestionPart] = []

class MarkingScheme(BaseModel):
    """SQA-aligned marking scheme with bullet notation."""
    max_marks: int

    # Generic scheme - what markers look for
    generic_scheme: List[MarkingBullet]

    # Illustrative scheme - expected answers
    illustrative_scheme: List[IllustrativeBullet]

    # Common errors from SQA reports
    common_errors: List[CommonError] = []

    # Examiner notes
    notes: List[str] = []

class MarkingBullet(BaseModel):
    """Single marking bullet in SQA format."""
    bullet_number: int  # 1, 2, 3...
    label: str  # "•1", "•2", "•3"
    criterion: str  # What the student should demonstrate
    marks: int  # Usually 1, sometimes 2
    skill_type: str  # "strategy", "processing", "communication"

class IllustrativeBullet(BaseModel):
    """Expected answer for a marking bullet."""
    bullet_number: int
    expected_answer: str
    expected_answer_latex: Optional[str]
    acceptable_variations: List[str] = []

class CommonError(BaseModel):
    """Common error from SQA marking reports."""
    error_type: str  # "notation", "calculation", "concept", "omission"
    description: str
    why_marks_lost: str  # Which bullets affected
    prevention_tip: str
```

---

## Database Schemas

### Source Collection: `us_papers` (sqa_education database)

Past paper documents with questions and marking schemes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            us_papers Document                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ $id: string              │ Document ID (e.g., "mathematics-n5-2023-X847")  │
│ subject: string          │ Subject name (e.g., "Mathematics")              │
│ level: string            │ Qualification (e.g., "National 5")              │
│ level_code: string       │ Short code (e.g., "N5", "NH", "NAH")            │
│ paper_code: string       │ SQA code (e.g., "X847/75/01")                   │
│ year: number             │ Exam year                                        │
│ paper_number: number     │ Paper number (1, 2)                              │
│ total_marks: number      │ Total marks available                            │
│ duration_minutes: number │ Exam duration                                    │
│ calculator_allowed: bool │ Calculator policy                                │
│ topic_tags: string       │ JSON array of topics                             │
│ data: string             │ Compressed JSON with full paper structure       │
└─────────────────────────────────────────────────────────────────────────────┘

PAPER DATA STRUCTURE (inside `data` field):
┌─────────────────────────────────────────────────────────────────────────────┐
│ questions: [                                                                │
│   {                                                                         │
│     number: "1",                                                            │
│     text: "Evaluate 2 3/4 - 1 2/5",                                        │
│     text_latex: "Evaluate $2\\frac{3}{4} - 1\\frac{2}{5}$",                │
│     marks: 3,                                                               │
│     topic_tags: ["fractions", "subtraction"],                               │
│     solution: {                                                             │
│       max_marks: 3,                                                         │
│       generic_scheme: [                                                     │
│         { bullet: 1, criterion: "strategy", marks: 1 },                     │
│         { bullet: 2, criterion: "process", marks: 1 },                      │
│         { bullet: 3, criterion: "answer", marks: 1 }                        │
│       ],                                                                    │
│       illustrative_scheme: [                                                │
│         { bullet: 1, answer: "11/4 - 7/5" },                               │
│         { bullet: 2, answer: "55/20 - 28/20" },                            │
│         { bullet: 3, answer: "27/20 or 1 7/20" }                           │
│       ],                                                                    │
│       notes: ["Accept equivalent fractions", "Final answer must be shown"] │
│     }                                                                       │
│   }                                                                         │
│ ],                                                                          │
│ general_principles: [...],                                                  │
│ formulae: [...]                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Target Collection: `mock_exams` (default database)

Enhanced schema with SQA-aligned marking:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     mock_exams Document (Enhanced)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                         EXISTING FIELDS (unchanged)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ examId, courseId, sowId, sowEntryOrder                                      │
│ metadata: { title, subject, level, totalMarks, timeLimit, ... }            │
│ sections: [{ section_id, questions: [...] }]                                │
│ summary: { total_questions, questions_by_difficulty, ... }                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                           NEW FIELDS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ source_type: string        │ "sow" | "past_paper"                          │
│ source_paper_id: string?   │ FK to us_papers (if source_type=past_paper)   │
│ source_paper_year: int?    │ Paper year (if from past paper)               │
└─────────────────────────────────────────────────────────────────────────────┘

ENHANCED QUESTION STRUCTURE:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Question (Enhanced)                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Existing: question_id, question_number, marks, question_stem, ...          │
│                                                                             │
│ cfu_config.answer_key (ENHANCED):                                          │
│ {                                                                           │
│   correct_answer: "27/20",                                                 │
│   acceptable_variations: ["1 7/20", "1.35"],                               │
│   marking_scheme: [                      │ ENHANCED - SQA bullets         │
│     {                                                                       │
│       bullet_number: 1,                  │ •1                              │
│       label: "•1",                       │ Display label                   │
│       criterion: "strategy",             │ What marker looks for          │
│       expected_answer: "11/4 - 7/5",     │ Illustrative answer            │
│       expected_answer_latex: "\\frac{11}{4} - \\frac{7}{5}",              │
│       marks: 1,                          │ Marks for this bullet          │
│       skill_type: "strategy"             │ SQA skill category             │
│     },                                                                      │
│     {                                                                       │
│       bullet_number: 2,                                                     │
│       label: "•2",                                                          │
│       criterion: "process",                                                 │
│       expected_answer: "55/20 - 28/20",                                    │
│       marks: 1,                                                             │
│       skill_type: "processing"                                              │
│     },                                                                      │
│     {                                                                       │
│       bullet_number: 3,                                                     │
│       label: "•3",                                                          │
│       criterion: "answer",                                                  │
│       expected_answer: "27/20 or 1 7/20",                                  │
│       marks: 1,                                                             │
│       skill_type: "communication"                                           │
│     }                                                                       │
│   ],                                                                        │
│   common_errors: [                       │ NEW - From SQA reports         │
│     {                                                                       │
│       error_type: "calculation",                                            │
│       description: "Incorrect common denominator",                         │
│       bullets_affected: ["•2", "•3"],                                      │
│       why_marks_lost: "•2 and •3 lost if denominator wrong",              │
│       prevention_tip: "Find LCM of 4 and 5 = 20"                           │
│     }                                                                       │
│   ],                                                                        │
│   examiner_notes: [                      │ NEW - Marking guidance          │
│     "Accept equivalent fractions",                                          │
│     "Final answer required for •3"                                         │
│   ]                                                                         │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Enhanced Marking Backend Integration

### Marking Flow with Bullet Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MARKING BACKEND ENHANCEMENT                             │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: Student Answer + Enhanced Marking Scheme
┌─────────────────────────────────────────┐
│ student_answer: "11/4 - 7/5 = 55/20 -  │
│                  28/20 = 26/20"         │
│                                         │
│ marking_scheme: [•1, •2, •3 bullets]   │
│ common_errors: [calculation errors]     │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         LLM MARKING EVALUATION          │
│  ─────────────────────────────────────  │
│  For each bullet:                       │
│  1. Compare student work to expected    │
│  2. Determine if criterion met          │
│  3. Award or withhold marks             │
│  4. Generate bullet-specific feedback   │
│                                         │
│  Check common errors:                   │
│  1. Match student work to error patterns│
│  2. Identify which error occurred       │
│  3. Reference bullets affected          │
└───────────────────┬─────────────────────┘
                    │
                    ▼
OUTPUT: BulletLevelMarkingResult
┌─────────────────────────────────────────────────────────────────────────────┐
│ {                                                                           │
│   "question_id": "q3a",                                                     │
│   "marks_earned": 2,                                                        │
│   "marks_possible": 3,                                                      │
│   "is_correct": false,                                                      │
│                                                                             │
│   "bullet_results": [                  ← NEW: Per-bullet breakdown         │
│     {                                                                       │
│       "bullet_number": 1,                                                   │
│       "label": "•1",                                                        │
│       "criterion": "strategy",                                              │
│       "marks_earned": 1,                                                    │
│       "marks_possible": 1,                                                  │
│       "awarded": true,                                                      │
│       "student_evidence": "11/4 - 7/5",                                    │
│       "feedback": "Correctly converted to improper fractions"              │
│     },                                                                      │
│     {                                                                       │
│       "bullet_number": 2,                                                   │
│       "label": "•2",                                                        │
│       "criterion": "process",                                               │
│       "marks_earned": 1,                                                    │
│       "marks_possible": 1,                                                  │
│       "awarded": true,                                                      │
│       "student_evidence": "55/20 - 28/20",                                 │
│       "feedback": "Correct common denominator calculation"                 │
│     },                                                                      │
│     {                                                                       │
│       "bullet_number": 3,                                                   │
│       "label": "•3",                                                        │
│       "criterion": "answer",                                                │
│       "marks_earned": 0,                                                    │
│       "marks_possible": 1,                                                  │
│       "awarded": false,                                                     │
│       "student_evidence": "26/20",                                         │
│       "expected": "27/20",                                                  │
│       "feedback": "Arithmetic error: 55-28=27 not 26"                      │
│     }                                                                       │
│   ],                                                                        │
│                                                                             │
│   "detected_errors": [                  ← NEW: Error detection             │
│     {                                                                       │
│       "error_type": "calculation",                                          │
│       "description": "Subtraction error in numerator",                     │
│       "bullets_affected": ["•3"],                                          │
│       "remediation": "Double-check: 55 - 28 = 27"                          │
│     }                                                                       │
│   ],                                                                        │
│                                                                             │
│   "overall_feedback": "Good strategy and process, but check your          │
│                        subtraction in the final step."                     │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Updated Pydantic Models for Marking

```python
class BulletResult(BaseModel):
    """Result for a single marking bullet."""
    bullet_number: int
    label: str  # "•1", "•2", etc.
    criterion: str
    marks_earned: int
    marks_possible: int
    awarded: bool
    student_evidence: Optional[str] = None
    expected: Optional[str] = None
    feedback: str

class DetectedError(BaseModel):
    """Error detected in student's answer."""
    error_type: str  # "notation", "calculation", "concept", "omission"
    description: str
    bullets_affected: List[str]  # ["•2", "•3"]
    remediation: str

class EnhancedMarkingResult(BaseModel):
    """Enhanced marking result with bullet breakdown."""
    question_id: str
    marks_earned: int
    marks_possible: int
    is_correct: bool

    # Per-bullet breakdown
    bullet_results: List[BulletResult]

    # Error detection
    detected_errors: List[DetectedError]

    # Overall feedback
    overall_feedback: str

    # Confidence and reasoning (existing)
    confidence: float
    reasoning: str
```

---

## Frontend Feedback Enhancement

### Current Feedback Display

```
┌─────────────────────────────────────────────────────────────┐
│ Question 3a                                    Score: 2/3  │
├─────────────────────────────────────────────────────────────┤
│ ✗ Incorrect                                                │
│                                                             │
│ Feedback: Your final answer was incorrect.                 │
│                                                             │
│ Correct Answer: 27/20 or 1 7/20                            │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Feedback Display (Target)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Question 3a: Subtract fractions                            Score: 2/3     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ MARK ALLOCATION                                                             │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│   •1 Strategy                                                ✓ 1/1        │
│   ├─ What you showed: 11/4 - 7/5                                          │
│   └─ Correctly converted to improper fractions                            │
│                                                                             │
│   •2 Process                                                 ✓ 1/1        │
│   ├─ What you showed: 55/20 - 28/20                                       │
│   └─ Found correct common denominator                                     │
│                                                                             │
│   •3 Answer                                                  ✗ 0/1        │
│   ├─ What you wrote: 26/20                                                │
│   ├─ Expected: 27/20                                                      │
│   └─ Arithmetic error in subtraction                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ERROR DETECTED                                                              │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ ⚠ Calculation Error                                                        │
│   You wrote 55-28=26, but 55-28=27                                        │
│   This cost you: •3 (1 mark)                                              │
│   Tip: Double-check subtraction by adding back                            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ WORKED SOLUTION                                                             │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ Step 1: Convert to improper fractions                      [•1]           │
│         2¾ = 11/4,  1⅖ = 7/5                                              │
│                                                                             │
│ Step 2: Find common denominator                            [•2]           │
│         11/4 = 55/20,  7/5 = 28/20                                        │
│                                                                             │
│ Step 3: Subtract and simplify                              [•3]           │
│         55/20 - 28/20 = 27/20 = 1 7/20                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Factory Pattern Foundation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Factory Pattern Infrastructure                                     │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ 1. Create abstract factory interface                                        │
│    ├─ MockExamSourceFactory (ABC)                                          │
│    ├─ SourceData unified schema                                            │
│    └─ MarkingTemplate schema with SQA bullets                              │
│                                                                             │
│ 2. Refactor existing SOW extractor                                         │
│    ├─ Implement SOWSourceFactory                                           │
│    ├─ Adapt mock_exam_extractor.py to factory interface                    │
│    └─ Output unified SourceData format                                     │
│                                                                             │
│ 3. Create Past Paper factory                                                │
│    ├─ Implement PastPaperSourceFactory                                     │
│    ├─ Create paper_extractor.py for us_papers                              │
│    ├─ Map us_papers schema to unified format                               │
│    └─ Preserve SQA bullet notation (•1, •2, etc.)                          │
│                                                                             │
│ Files to create/modify:                                                     │
│ • src/factories/__init__.py                                                 │
│ • src/factories/base_factory.py                                            │
│ • src/factories/sow_factory.py                                             │
│ • src/factories/past_paper_factory.py                                      │
│ • src/models/source_data_models.py                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: Enhanced Marking Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Enhanced Marking Schema                                            │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ 1. Update mock_exam_schema_models.py                                        │
│    ├─ Add bullet_number to MarkingStep                                     │
│    ├─ Add label field (•1, •2...)                                          │
│    ├─ Add expected_answer and expected_answer_latex                        │
│    ├─ Add skill_type (strategy/processing/communication)                   │
│    └─ Add common_errors array to AnswerKey                                 │
│                                                                             │
│ 2. Update mock_exam_generation_schema.py                                    │
│    ├─ Simplified schema changes for structured output                      │
│    └─ Add fields for agent generation                                      │
│                                                                             │
│ 3. Update schema conversion pipeline                                        │
│    ├─ Map simplified → full schema with new fields                         │
│    └─ Validate bullet number consistency                                   │
│                                                                             │
│ Files to modify:                                                            │
│ • src/tools/mock_exam_schema_models.py                                     │
│ • src/tools/mock_exam_generation_schema.py                                 │
│ • src/utils/mock_exam_auto_correction.py                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 3: Agent Prompt Enhancement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Agent Prompt Enhancement                                           │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ 1. Update author prompt                                                     │
│    ├─ Add instructions for SQA bullet format                               │
│    ├─ Add examples from past papers                                        │
│    ├─ Include marking scheme generation guidance                           │
│    └─ Add common error identification instructions                         │
│                                                                             │
│ 2. Update critic prompt                                                     │
│    ├─ Add marking scheme validation criteria                               │
│    ├─ Check bullet numbering and consistency                               │
│    └─ Verify marks sum correctly                                           │
│                                                                             │
│ 3. Update reviser prompt                                                    │
│    ├─ Add marking scheme revision guidance                                 │
│    └─ Handle bullet-level corrections                                      │
│                                                                             │
│ Files to modify:                                                            │
│ • src/prompts/mock_exam_author_prompt.md                                   │
│ • src/prompts/mock_exam_ux_critic_prompt.md                                │
│ • src/prompts/mock_exam_reviser_prompt.md                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 4: Marking Backend Enhancement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Marking Backend Enhancement                                        │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ 1. Update marking node in LangGraph                                         │
│    ├─ Accept enhanced marking scheme                                       │
│    ├─ Generate per-bullet results                                          │
│    ├─ Detect common errors                                                 │
│    └─ Return BulletLevelMarkingResult                                      │
│                                                                             │
│ 2. Update marking prompt                                                    │
│    ├─ Add bullet-by-bullet evaluation instructions                         │
│    ├─ Add error pattern matching                                           │
│    └─ Add evidence extraction guidance                                     │
│                                                                             │
│ 3. Add marking schema models                                                │
│    ├─ BulletResult model                                                   │
│    ├─ DetectedError model                                                  │
│    └─ EnhancedMarkingResult model                                          │
│                                                                             │
│ Files to modify (langgraph-agent):                                          │
│ • src/agent/nodes/mark_response_node.py                                    │
│ • src/agent/prompts/marking_prompt.md                                      │
│ • src/agent/schemas/marking_schemas.py                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 5: Frontend Feedback Enhancement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: Frontend Feedback Enhancement                                      │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│ 1. Create BulletBreakdown component                                         │
│    ├─ Display each bullet with ✓/✗ indicator                               │
│    ├─ Show student evidence vs expected                                    │
│    ├─ Color-code awarded/not awarded                                       │
│    └─ Collapsible detailed feedback per bullet                             │
│                                                                             │
│ 2. Create ErrorAlert component                                              │
│    ├─ Display detected common errors                                       │
│    ├─ Show which bullets affected                                          │
│    └─ Provide prevention tips                                              │
│                                                                             │
│ 3. Update PracticeFeedbackTool                                              │
│    ├─ Integrate BulletBreakdown                                            │
│    ├─ Integrate ErrorAlert                                                 │
│    └─ Keep existing worked solution display                                │
│                                                                             │
│ 4. Update type contracts                                                    │
│    ├─ Add BulletResult interface                                           │
│    ├─ Add DetectedError interface                                          │
│    └─ Update PracticeFeedbackArgs                                          │
│                                                                             │
│ Files to modify (assistant-ui-frontend):                                    │
│ • components/tools/PracticeFeedbackTool.tsx                                │
│ • components/feedback/BulletBreakdown.tsx (new)                            │
│ • components/feedback/ErrorAlert.tsx (new)                                 │
│ • types/practice-wizard-contracts.ts                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure (Target State)

```
claud_author_agent/
├── src/
│   ├── factories/                          # NEW: Factory pattern
│   │   ├── __init__.py
│   │   ├── base_factory.py                 # MockExamSourceFactory ABC
│   │   ├── sow_factory.py                  # SOWSourceFactory
│   │   └── past_paper_factory.py           # PastPaperSourceFactory
│   │
│   ├── models/
│   │   ├── source_data_models.py           # NEW: Unified source models
│   │   └── marking_models.py               # NEW: Enhanced marking models
│   │
│   ├── tools/
│   │   ├── mock_exam_schema_models.py      # UPDATED: Enhanced with bullets
│   │   └── mock_exam_generation_schema.py  # UPDATED: Simplified + bullets
│   │
│   ├── utils/
│   │   ├── mock_exam_extractor.py          # REFACTORED: Delegates to factory
│   │   ├── past_paper_extractor.py         # NEW: Extract from us_papers
│   │   └── mock_exam_auto_correction.py    # UPDATED: Handle bullet fields
│   │
│   ├── prompts/
│   │   ├── mock_exam_author_prompt.md      # UPDATED: SQA bullet format
│   │   ├── mock_exam_ux_critic_prompt.md   # UPDATED: Marking validation
│   │   └── mock_exam_reviser_prompt.md     # UPDATED: Bullet corrections
│   │
│   └── mock_exam_author_claude_client_v2.py  # UPDATED: Factory integration

langgraph-agent/
├── src/agent/
│   ├── nodes/
│   │   └── mark_response_node.py           # UPDATED: Bullet-level marking
│   ├── prompts/
│   │   └── marking_prompt.md               # UPDATED: Bullet evaluation
│   └── schemas/
│       └── marking_schemas.py              # UPDATED: BulletResult etc.

assistant-ui-frontend/
├── components/
│   ├── tools/
│   │   └── PracticeFeedbackTool.tsx        # UPDATED: Bullet breakdown
│   └── feedback/
│       ├── BulletBreakdown.tsx             # NEW: Per-bullet display
│       └── ErrorAlert.tsx                  # NEW: Error detection display
└── types/
    └── practice-wizard-contracts.ts        # UPDATED: Enhanced types
```

---

## Testing Strategy

### Unit Tests

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Factory Tests                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • test_sow_factory_extracts_mock_exam_entries                              │
│ • test_sow_factory_outputs_unified_format                                  │
│ • test_past_paper_factory_extracts_questions                               │
│ • test_past_paper_factory_preserves_bullet_notation                        │
│ • test_past_paper_factory_extracts_common_errors                           │
│ • test_unified_format_validates_correctly                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Schema Tests                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ • test_marking_step_with_bullet_number                                     │
│ • test_answer_key_with_common_errors                                       │
│ • test_bullet_marks_sum_equals_question_marks                              │
│ • test_enhanced_marking_result_validation                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Marking Tests                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ • test_bullet_level_evaluation                                             │
│ • test_common_error_detection                                              │
│ • test_partial_credit_calculation                                          │
│ • test_evidence_extraction_from_answer                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Integration Tests

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ End-to-End Tests                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • test_mock_exam_from_sow_with_enhanced_marking                            │
│ • test_mock_exam_from_past_paper                                           │
│ • test_marking_returns_bullet_breakdown                                    │
│ • test_frontend_displays_bullet_results                                    │
│ • test_error_detection_shows_in_feedback                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Strategy

### Backwards Compatibility

1. **Existing mock exams**: Continue to work with current marking scheme
2. **New mock exams**: Generated with enhanced marking scheme
3. **Marking backend**: Detect schema version and handle both formats
4. **Frontend**: Graceful degradation if bullet_results not present

### Schema Migration

```python
def migrate_marking_scheme(old_scheme: List[MarkingStep]) -> List[EnhancedMarkingStep]:
    """Migrate old marking scheme to enhanced format."""
    return [
        EnhancedMarkingStep(
            bullet_number=i + 1,
            label=f"•{i + 1}",
            step=step.step,
            criterion=infer_criterion(step.step),
            expected_answer=None,  # Not available in old format
            marks=step.marks,
            skill_type=infer_skill_type(step.step)
        )
        for i, step in enumerate(old_scheme)
    ]
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Marking transparency | Students understand mark allocation | Post-attempt survey |
| Error detection rate | 80%+ of common errors identified | Compare to SQA reports |
| Feedback satisfaction | 4.0+ rating | User feedback |
| Marking accuracy | 95%+ agreement with manual marking | Spot-check audit |
| Schema validation pass | 100% of generated exams | Automated validation |

---

## Open Questions

1. **Q**: Should past papers be used as direct source or as templates for new questions?
   - **Recommendation**: Templates - generate similar questions, not copies

2. **Q**: How to handle questions where marking scheme structure differs significantly?
   - **Recommendation**: Normalize to unified format with bullet notation

3. **Q**: Should common errors be AI-generated or only from SQA reports?
   - **Recommendation**: Start with SQA reports, enhance with AI-detected patterns

---

## References

- SQA Marking Instructions format: [SQA Website](https://www.sqa.org.uk/)
- Existing walkthrough agent spec: `WALKTHROUGH_AUTHOR_AGENT_SPEC.md`
- Mock exam schema: `src/tools/mock_exam_schema_models.py`
- Past papers schema: `us_papers` collection in `sqa_education` database
