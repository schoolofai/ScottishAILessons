# Nat5+ SQA Mock Exam Author Guide

## Overview

The Nat5+ Exam Author Agent generates unique SQA-style mock exams from Scheme of Work (SOW) topics using AI. It produces exams with proper marking schemes that follow SQA examination standards.

**Key Features:**
- Granular question-by-question generation (2-3K tokens each)
- SQA-style marking schemes (generic + illustrative)
- Uniqueness checking via topic/style/difficulty fingerprints
- **Subject-agnostic design** - Works for Mathematics, English, History, or any SQA subject
- Cross-exam uniqueness tracking via fingerprint summaries

## Design Principles

### Subject-Agnostic Architecture

The system uses **prompt engineering** and **LLM capabilities** rather than hardcoded subject-specific values:

```python
# ❌ WRONG - Hardcoded subject-specific values
context_type: Literal["pure_math", "real_world", "geometric"]  # Math-only!

# ✅ CORRECT - Subject-agnostic with LLM guidance
subject: str = ""  # "Mathematics", "English", "History"
level: str = ""    # "National 5", "Higher"
# Let the LLM determine appropriate contexts based on subject
```

**Why this matters:**
- The same codebase generates exams for ANY SQA subject
- No code changes needed when adding new subjects
- LLM uses its domain knowledge to create appropriate question contexts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Nat5+ Exam Author Pipeline                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1: Pre-processing (Python, 0 tokens)                    │
│  ├── Extract SOW topics from Authored_SOW collection           │
│  ├── Extract past paper templates from us_papers               │
│  └── Load existing exam summaries for uniqueness               │
│                                                                 │
│  PHASE 2: Plan Exam (Claude SDK, ~2K tokens)                   │
│  └── Generate exam plan: topics × templates × difficulty       │
│                                                                 │
│  PHASE 3: Generate Questions (Parallel, ~2-3K each)            │
│  ├── FOR EACH question spec (in parallel batches):             │
│  │   ├── Generate question (structured output)                 │
│  │   ├── Validate with critic                                  │
│  │   └── Check uniqueness                                      │
│  └── Write: workspace/questions/q_{n}.json                     │
│                                                                 │
│  PHASE 4: Assemble & Post-process (Python, 0 tokens)           │
│  ├── Stitch questions into sections                            │
│  ├── Validate with Pydantic models                             │
│  └── Upsert to Appwrite nat5_plus_mock_exams                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Appwrite access with proper credentials
- Course with SOW authored in `Authored_SOW` collection
- Past papers in `us_papers` collection (sqa_education database)

### Generate an Exam

```bash
cd claud_author_agent
source .venv/bin/activate

# Generate a single exam for a course
python -m src.nat5_plus.exam_generator_client generate \
  --course-id "YOUR_COURSE_ID" \
  --workspace ./workspaces/exam_001
```

### List Exams

```bash
# List all exams for a course
python -m src.nat5_plus.exam_generator_client list --course-id "YOUR_COURSE_ID"

# List all exams (no filter)
python -m src.nat5_plus.exam_generator_client list
```

### Delete an Exam

```bash
# Delete an exam by document ID (also removes associated summary)
python -m src.nat5_plus.exam_generator_client delete --exam-id "exam_doc_id"
```

**Important**: Deleting an exam also removes its summary from `nat5_plus_exam_summaries`, which frees up the question fingerprints for future exam generation.

### CLI Commands

| Command    | Description                     |
| ---------- | ------------------------------- |
| `generate` | Generate a new mock exam        |
| `list`     | List exams for a course         |
| `delete`   | Delete an exam and its summary  |

### Generate Options

| Option | Description | Default |
|--------|-------------|---------|
| `--course-id` | Target course ID | Required |
| `--workspace` | Output directory | Required |
| `--target-marks` | Total exam marks | 90 |
| `--target-questions` | Number of questions | 15 |
| `--force-regenerate` | Skip uniqueness checks | False |
| `--dry-run` | Generate without upserting | False |

## Directory Structure

```
claud_author_agent/
├── src/nat5_plus/
│   ├── __init__.py
│   ├── exam_generator_client.py      # Main pipeline orchestrator
│   ├── sow_topic_extractor.py        # Extract topics from SOW
│   ├── past_paper_template_extractor.py  # Extract templates
│   ├── uniqueness_manager.py         # Ensure exam uniqueness
│   ├── exam_assembler.py             # Stitch questions into exam
│   └── exam_upserter.py              # Upsert to Appwrite
│
├── src/models/
│   ├── nat5_plus_exam_models.py      # Full exam Pydantic schemas
│   └── nat5_plus_question_generation_schema.py  # Question generation
│
└── tests/
    ├── unit/
    ├── contracts/
    │   └── test_nat5_plus_contracts.py  # Contract tests
    └── integration/
```

## Pydantic Models

### QuestionSpec (Planning Phase)

The specification for generating a single question - uses subject-agnostic diversity fields:

```python
class QuestionSpec(BaseModel):
    # Core fields
    topic: str                    # SOW topic to test
    template_paper_id: str        # Past paper style template
    marks: int                    # Target marks
    difficulty: Literal["easy", "medium", "hard"]
    question_style: Literal["procedural", "application", "problem_solving"]

    # SUBJECT CONTEXT - passed to LLM
    subject: str = ""             # e.g., "Mathematics", "English", "History"
    level: str = ""               # e.g., "National 5", "Higher"

    # DIVERSITY FIELDS - work for ANY subject
    sub_topic_focus: str = ""     # Specific learning outcome from SOW
    learning_outcome_id: str = "" # SOW outcome ID for traceability
    variation_seed: int = 0       # Random seed for unique variations
    avoid_patterns: List[str] = [] # Stem patterns already used
    question_position: int = 0    # Position in exam (1-15)
```

### Nat5PlusQuestion (Generated Output)

```python
class Nat5PlusQuestion(BaseModel):
    question_id: str
    question_number: str
    marks: int
    difficulty: Literal["easy", "medium", "hard"]
    stem: str
    stem_latex: str
    marking_scheme: MarkingScheme
    topic_ids: List[str]
    hints: Optional[List[str]]
    common_errors: Optional[List[str]]
```

### MarkingScheme

```python
class MarkingScheme(BaseModel):
    max_marks: int
    generic_scheme: List[MarkingBullet]      # What earns marks
    illustrative_scheme: List[IllustrativeAnswer]  # Example answers
    notes: Optional[List[str]]               # Marking notes
```

## SQA Marking Style

The marking schemes follow SQA standards:

1. **Generic Scheme** - Describes the process that earns each mark
2. **Illustrative Scheme** - Shows example answers with tolerances
3. **Notes** - Additional marking guidance

Example:
```json
{
  "max_marks": 3,
  "generic_scheme": [
    {"bullet": 1, "process": "Correctly expand brackets", "marks": 1},
    {"bullet": 2, "process": "Correctly simplify terms", "marks": 1},
    {"bullet": 3, "process": "State final answer", "marks": 1}
  ],
  "illustrative_scheme": [
    {"bullet": 1, "answer": "2x + 6 - x + 4"},
    {"bullet": 2, "answer": "x + 10"},
    {"bullet": 3, "answer": "x + 10", "acceptable_variations": ["10 + x"]}
  ]
}
```

## Testing

### Unit Tests

```bash
cd claud_author_agent
pytest tests/unit/ -v
```

### Contract Tests

```bash
pytest tests/contracts/ -v
```

### Integration Tests

```bash
pytest tests/integration/ -v
```

## Uniqueness Management

### Within-Exam Uniqueness

The system ensures variety through multiple mechanisms:

1. **Shuffled Difficulties**: Random ordering instead of deterministic sequences
2. **Topic Variety Enforcement**: `_select_topic_with_variety()` prevents topic overuse
3. **Randomized Template Matching**: Top-3 selection instead of greedy best-match
4. **Spec-Level Fingerprinting**: Detect duplicates before generation, not after
5. **Avoid Pattern Tracking**: Previously used stems passed to LLM to avoid repetition

### Cross-Exam Uniqueness Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-EXAM UNIQUENESS ALGORITHM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Load Existing Summaries                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  nat5_plus_exam_summaries                                            │   │
│  │  ├── Exam 1: fingerprints = [fp1, fp2, fp3, ...]                    │   │
│  │  ├── Exam 2: fingerprints = [fp4, fp5, fp6, ...]                    │   │
│  │  └── Exam N: fingerprints = [...]                                    │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  STEP 2: Build Known Fingerprint Set                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  known_fingerprints = {fp1, fp2, fp3, fp4, fp5, fp6, ...}           │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  STEP 3: Generate New Questions                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FOR each new question:                                              │   │
│  │    1. Generate question via LLM                                      │   │
│  │    2. Compute fingerprint = SHA256(normalize(stem))[:16]            │   │
│  │    3. IF fingerprint IN known_fingerprints:                         │   │
│  │         → Log warning (regeneration not yet implemented)            │   │
│  │    4. Register fingerprint for within-exam tracking                  │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  STEP 4: Persist New Summary                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Create new exam summary with:                                       │   │
│  │  • question_fingerprints: [new_fp1, new_fp2, ...]                   │   │
│  │  • topic_ids, question_styles, difficulty_mix                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Each exam creates a summary in `nat5_plus_exam_summaries` containing:

- Topic IDs covered
- Question styles used
- Difficulty distribution
- Question fingerprints (SHA-256 content hashes)

Subsequent generations load all existing summaries and check against the combined fingerprint set.

### Verification Results (2026-01-13)

| Metric | Exam 1 (Pre-Fix) | Exam 2 (Post-Fix) | Exam 3 (Post-Fix) |
|--------|------------------|-------------------|-------------------|
| Internal Duplicates | 40% ❌ | 0% ✅ | 0% ✅ |
| Cross-Exam Overlap | - | 0 fingerprints ✅ | 0 fingerprints ✅ |

## Troubleshooting

### "No SOW topics found"

Verify the course has authored SOW:
```bash
# Check Authored_SOW collection has documents for course_id
```

### "No templates found"

Verify past papers exist for the subject/level in `us_papers` collection.

### "Uniqueness exhausted"

All unique topic combinations have been used. Options:
- Add more SOW topics to the course
- Archive existing exams
- Use `--force-regenerate` (may produce similar exams)

## Related Documentation

- [Plan File](/Users/niladribose/.claude/plans/luminous-humming-ember.md) - Full implementation plan
- [LangGraph Evaluator](../langgraph-agent/src/agent/graph_nat5_plus_exam.py) - Grading graph
- [Frontend Types](../assistant-ui-frontend/lib/sqa-mock-exam/types.ts) - TypeScript interfaces
