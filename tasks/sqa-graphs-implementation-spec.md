# SQA Graphs Implementation Specification

**Version:** 1.0
**Date:** 2025-11-02
**Status:** Implementation Phase

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [Architecture](#architecture)
4. [Tool Interface: QuestionSource](#tool-interface-questionsource)
5. [Shared Subgraphs](#shared-subgraphs)
6. [Main Graphs](#main-graphs)
7. [State Definitions](#state-definitions)
8. [Implementation Plan](#implementation-plan)
9. [Testing Strategy](#testing-strategy)
10. [Configuration](#configuration)

---

## Overview

This specification defines two LangGraph-based flows for SQA (Scottish Qualifications Authority) subjects:

1. **QuestionPracticeGraph** - "Infinite rapid fire" question practice with immediate remediation
2. **ExamAssessmentGraph** - "Infinite mock exams" generation, marking, and remediation

### Key Principle

**Subject and level are REQUIRED inputs** provided by the client (UI/orchestrator). The graphs do not discover or resolve these - they must be present in the initial state.

Example input:
```python
{
  "subject": "Mathematics",
  "level": "Nat 5"
}
```

---

## Goals

### Core Objectives

1. **DRY Question Retrieval** - Single reusable subgraph for fetching questions
2. **Reusable Subgraphs** - Shared logic between practice and exam flows
3. **SQA Structure** - Faithful to SQA assessment patterns
4. **Pluggable Data Sources** - Support local, US, past papers, and LLM generation
5. **Intelligent Remediation** - Diagnose gaps and provide targeted support

### Non-Goals

- Subject/level discovery (client responsibility)
- Frontend implementation (future work package)
- Real-time collaboration features
- Multi-user session management

---

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERFACE LAYER                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            QuestionSource Tool                       │  │
│  │  • get_sqa_spec()                                    │  │
│  │  • get_local_questions()                             │  │
│  │  • get_us_or_past_questions()                        │  │
│  │  • generate_question()                               │  │
│  │  • mutate_question()                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUBGRAPH LAYER                            │
│                                                             │
│  ┌────────────────────┐      ┌─────────────────────────┐  │
│  │ SG_FetchQuestion   │      │ SG_DiagnoseAndPatch     │  │
│  │ • ensure_outcome   │      │ • check_answer          │  │
│  │ • collect_cands    │      │ • diagnose_gaps         │  │
│  │ • apply_novelty    │      │ • generate_remediation  │  │
│  └────────────────────┘      └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     GRAPH LAYER                             │
│                                                             │
│  ┌──────────────────────┐    ┌───────────────────────────┐ │
│  │ QuestionPracticeGraph│    │ ExamAssessmentGraph       │ │
│  │ (Rapid Fire)         │    │ (Mock Exams)              │ │
│  └──────────────────────┘    └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
langgraph-agent/
├── src/agent/
│   ├── sqa/
│   │   ├── __init__.py
│   │   ├── states.py                    # State definitions
│   │   ├── question_source.py           # Tool interface
│   │   ├── subgraphs/
│   │   │   ├── __init__.py
│   │   │   ├── fetch_question.py        # SG_FetchQuestion
│   │   │   └── diagnose_patch.py        # SG_DiagnoseAndPatch
│   │   ├── graphs/
│   │   │   ├── __init__.py
│   │   │   ├── question_practice.py     # QuestionPracticeGraph
│   │   │   └── exam_assessment.py       # ExamAssessmentGraph
│   │   └── utils.py                     # Helper functions
│   └── langgraph.json                   # Updated config
└── tests/
    ├── sqa/
    │   ├── unit/
    │   │   ├── test_question_source.py
    │   │   ├── test_fetch_question.py
    │   │   ├── test_diagnose_patch.py
    │   │   ├── test_question_practice.py
    │   │   └── test_exam_assessment.py
    │   ├── integration/
    │   │   ├── test_practice_flow.py
    │   │   └── test_exam_flow.py
    │   └── e2e/
    │       └── test_sqa_graphs_e2e.py
    └── fixtures/
        └── sqa_test_data.py
```

---

## Tool Interface: QuestionSource

### Purpose

Unified interface for question and specification retrieval across all SQA subjects and levels.

### Methods

#### 1. `get_sqa_spec(subject: str, level: str) -> dict`

Retrieve SQA specification and assessment structure.

**Input:**
```python
{
  "subject": "Mathematics",
  "level": "Nat 5"
}
```

**Output:**
```python
{
  "outcomes": [
    {
      "id": "MNU-5-01",
      "label": "Apply numerical skills to solve problems",
      "weight": 0.25
    },
    # ... more outcomes
  ],
  "assessment_structure": [
    {
      "section": "Paper 1 (Non-calculator)",
      "outcome_ids": ["MNU-5-01", "MNU-5-02"],
      "marks": 40
    },
    {
      "section": "Paper 2 (Calculator)",
      "outcome_ids": ["MNU-5-03", "MNU-5-04"],
      "marks": 50
    }
  ]
}
```

#### 2. `get_local_questions(subject: str, level: str, outcome_id: str, limit: int = 5) -> List[Question]`

Fetch centre-created or real-life questions.

**Input:**
```python
{
  "subject": "Physics",
  "level": "Higher",
  "outcome_id": "PHY-H-01",
  "limit": 5
}
```

**Output:**
```python
[
  {
    "id": "local_phy_h_01_001",
    "source": "local",
    "subject": "Physics",
    "level": "Higher",
    "outcome_id": "PHY-H-01",
    "text": "Calculate the velocity of a car...",
    "marks": 4,
    "marking_scheme": {
      "criteria": [
        {"step": "Identify equation", "marks": 1},
        {"step": "Substitute values", "marks": 1},
        {"step": "Calculate result", "marks": 1},
        {"step": "State units", "marks": 1}
      ]
    },
    "metadata": {
      "created_by": "teacher_123",
      "difficulty": "medium"
    }
  }
  # ... more questions
]
```

#### 3. `get_us_or_past_questions(subject: str, level: str, outcome_id: str, limit: int = 5) -> List[Question]`

Fetch from Understanding Standards or SQA past papers.

**Rules:**
- Only available for levels: `["Nat 5", "Higher", "Advanced Higher"]`
- Returns `[]` for lower levels (Nat 3, Nat 4)

**Input/Output:** Same structure as `get_local_questions`

#### 4. `generate_question(subject: str, level: str, outcome_id: str, marks: int = 4) -> Question`

LLM fallback when no questions are found.

**Input:**
```python
{
  "subject": "Mathematics",
  "level": "Nat 5",
  "outcome_id": "MNU-5-01",
  "marks": 4
}
```

**Output:** Single `Question` object with `source: "llm"`

#### 5. `mutate_question(question: Question) -> Question`

Create a fresh variant from an existing question (for novelty).

**Input:** Any `Question` object

**Output:** `Question` object with:
- New `id` (appended with `_variant_N`)
- `source: "variant"`
- Modified `text` and `marking_scheme` (numbers changed, context altered)

### Question Schema

```python
class Question(TypedDict):
    id: str                    # Unique identifier
    source: str                # "local" | "us" | "past" | "llm" | "variant"
    subject: str               # e.g. "Mathematics"
    level: str                 # e.g. "Nat 5"
    outcome_id: str            # e.g. "MNU-5-01"
    text: str                  # Question content (supports LaTeX)
    marks: int                 # Total marks available
    marking_scheme: dict       # SQA-style marking criteria
    metadata: dict             # Optional additional data
```

---

## Shared Subgraphs

### SG_FetchQuestion

**Purpose:** DRY question retrieval logic used by both main graphs.

#### State Schema

```python
class FetchQuestionState(TypedDict):
    # Required inputs
    subject: str
    level: str

    # Optional inputs
    target_outcome: Optional[str]
    used_question_ids: Optional[List[str]]

    # Outputs
    question: Optional[Question]
```

#### Nodes

##### 1. `ensure_outcome`

**Logic:**
```python
if state.target_outcome is not set:
    spec = QuestionSource.get_sqa_spec(state.subject, state.level)
    state.target_outcome = choose_outcome(spec.outcomes, history=state.used_question_ids)
```

**Outcome Selection Strategy:**
- Weighted random selection based on `outcome.weight`
- Avoid recently used outcomes (check last N in history)
- Fallback to least-used outcome if all recently used

##### 2. `collect_candidates`

**Logic:**
```python
candidates = []

# Always fetch local questions
candidates += QuestionSource.get_local_questions(
    state.subject, state.level, state.target_outcome
)

# Nat5+ rule: add US/past papers
if state.level in ["Nat 5", "Higher", "Advanced Higher"]:
    candidates += QuestionSource.get_us_or_past_questions(
        state.subject, state.level, state.target_outcome
    )

# Fallback: LLM generation
if len(candidates) == 0:
    candidates = [QuestionSource.generate_question(
        state.subject, state.level, state.target_outcome, marks=4
    )]

state.__candidates = candidates
```

##### 3. `apply_novelty`

**Logic:**
```python
used = set(state.used_question_ids or [])
chosen = None

# Try to find unused question
for candidate in state.__candidates:
    if candidate.id not in used:
        chosen = candidate
        break

# All questions used? Mutate one
if chosen is None:
    chosen = QuestionSource.mutate_question(state.__candidates[0])

# Update tracking
state.question = chosen
state.used_question_ids = list(used | {chosen.id})

# Clean up temporary state
del state.__candidates
```

#### Graph Structure

```python
fetch_graph = StateGraph(FetchQuestionState)
fetch_graph.add_node("ensure_outcome", ensure_outcome)
fetch_graph.add_node("collect_candidates", collect_candidates)
fetch_graph.add_node("apply_novelty", apply_novelty)

fetch_graph.add_edge("__start__", "ensure_outcome")
fetch_graph.add_edge("ensure_outcome", "collect_candidates")
fetch_graph.add_edge("collect_candidates", "apply_novelty")

compiled_fetch_graph = fetch_graph.compile()
```

---

### SG_DiagnoseAndPatch

**Purpose:** Mark answers, identify gaps, and generate remediation.

#### State Schema

```python
class DiagnosePatchState(TypedDict):
    # Required inputs
    question: Question
    user_answer: str

    # Outputs
    result: str                        # "correct" | "wrong"
    gap_tags: List[str]                # e.g. ["algebra", "fractions"]
    remediation: Optional[str]         # Remediation content
```

#### Nodes

##### 1. `check_answer`

**Logic:**
```python
correct = compare_with_marking(
    state.question.marking_scheme,
    state.user_answer
)

if correct:
    state.result = "correct"
    state.gap_tags = []
else:
    state.result = "wrong"
```

**Marking Logic:**
- Parse marking scheme criteria
- Use fuzzy matching for numeric answers (tolerance: ±2%)
- Use semantic similarity for text answers (threshold: 0.8)
- Partial credit supported

##### 2. `diagnose_gaps`

**Condition:** Only runs if `state.result == "wrong"`

**Logic:**
```python
if state.result == "wrong":
    gaps = diagnose_error(
        state.question.marking_scheme,
        state.user_answer
    )
    state.gap_tags = gaps
    state.remediation = build_remediation(state.question, gaps)
```

**Gap Detection:**
- Identify which marking criteria failed
- Map to knowledge gaps (e.g., "equation setup" → "algebraic modeling")
- Generate targeted remediation hints

##### 3. `generate_remediation`

**Logic:**
```python
remediation_text = f"""
**What went wrong:**
{explain_error(state.question, state.user_answer, state.gap_tags)}

**Key concept:**
{explain_concept(state.gap_tags)}

**Try this:**
{generate_similar_practice(state.question, state.gap_tags)}
"""

state.remediation = remediation_text
```

#### Graph Structure

```python
diagnose_graph = StateGraph(DiagnosePatchState)
diagnose_graph.add_node("check_answer", check_answer)
diagnose_graph.add_node("diagnose_gaps", diagnose_gaps)

diagnose_graph.add_edge("__start__", "check_answer")
diagnose_graph.add_conditional_edges(
    "check_answer",
    lambda state: "diagnose" if state.result == "wrong" else "__end__",
    {
        "diagnose": "diagnose_gaps",
        "__end__": "__end__"
    }
)

compiled_diagnose_graph = diagnose_graph.compile()
```

---

## Main Graphs

### QuestionPracticeGraph

**Purpose:** Infinite rapid-fire question practice with immediate feedback.

#### State Schema

```python
class QuestionPracticeState(TypedDict):
    # Required inputs (from client)
    subject: str
    level: str

    # Optional inputs
    target_outcome: Optional[str]

    # Session state
    question: Optional[Question]
    user_answer: Optional[str]
    used_question_ids: List[str]

    # Result tracking
    result: Optional[str]
    gap_tags: Optional[List[str]]
    remediation: Optional[str]

    # Statistics
    total_questions: int
    correct_count: int
    streak: int
```

#### Nodes

##### 1. `fetch_question`

**Action:** Call `SG_FetchQuestion` subgraph

```python
fetch_result = compiled_fetch_graph.invoke({
    "subject": state.subject,
    "level": state.level,
    "target_outcome": state.target_outcome,
    "used_question_ids": state.used_question_ids
})

state.question = fetch_result["question"]
state.used_question_ids = fetch_result["used_question_ids"]
```

##### 2. `present_question`

**Action:** Interrupt for UI presentation

```python
# Create tool call for Assistant UI
tool_message = AIMessage(
    content="",
    tool_calls=[{
        "id": f"present_question_{state.question.id}",
        "name": "PresentQuestionTool",
        "args": {
            "question": state.question,
            "marks": state.question.marks,
            "outcome_id": state.question.outcome_id
        }
    }]
)

# Interrupt for user input
interrupt({})

return {"messages": [tool_message]}
```

##### 3. `collect_answer`

**Action:** Extract user answer from resume payload

```python
# Frontend sends: resume: JSON.stringify({ user_answer: "..." })
user_input = state.get("resume_data", {}).get("user_answer")
state.user_answer = user_input
```

##### 4. `diagnose`

**Action:** Call `SG_DiagnoseAndPatch` subgraph

```python
diagnose_result = compiled_diagnose_graph.invoke({
    "question": state.question,
    "user_answer": state.user_answer
})

state.result = diagnose_result["result"]
state.gap_tags = diagnose_result["gap_tags"]
state.remediation = diagnose_result.get("remediation")

# Update statistics
state.total_questions += 1
if state.result == "correct":
    state.correct_count += 1
    state.streak += 1
else:
    state.streak = 0
```

##### 5. `show_feedback`

**Action:** Present results with remediation

```python
feedback_message = AIMessage(
    content="",
    tool_calls=[{
        "id": f"feedback_{state.question.id}",
        "name": "ShowFeedbackTool",
        "args": {
            "result": state.result,
            "correct_answer": state.question.marking_scheme,
            "remediation": state.remediation,
            "stats": {
                "total": state.total_questions,
                "correct": state.correct_count,
                "streak": state.streak
            }
        }
    }]
)

return {"messages": [feedback_message]}
```

##### 6. `check_continue`

**Action:** Ask if user wants to continue

```python
# Interrupt for continue decision
interrupt({})

# Frontend sends: resume: JSON.stringify({ continue: true/false })
should_continue = state.get("resume_data", {}).get("continue", True)
return {"should_continue": should_continue}
```

#### Graph Structure

```python
practice_graph = StateGraph(QuestionPracticeState)

practice_graph.add_node("fetch_question", fetch_question)
practice_graph.add_node("present_question", present_question)
practice_graph.add_node("collect_answer", collect_answer)
practice_graph.add_node("diagnose", diagnose)
practice_graph.add_node("show_feedback", show_feedback)
practice_graph.add_node("check_continue", check_continue)

practice_graph.add_edge("__start__", "fetch_question")
practice_graph.add_edge("fetch_question", "present_question")
practice_graph.add_edge("present_question", "collect_answer")
practice_graph.add_edge("collect_answer", "diagnose")
practice_graph.add_edge("diagnose", "show_feedback")
practice_graph.add_edge("show_feedback", "check_continue")

practice_graph.add_conditional_edges(
    "check_continue",
    lambda state: "continue" if state.get("should_continue") else "end",
    {
        "continue": "fetch_question",
        "end": "__end__"
    }
)

question_practice_graph = practice_graph.compile()
```

---

### ExamAssessmentGraph

**Purpose:** Generate SQA-style mock exams, mark them, and provide remediation.

#### State Schema

```python
class ExamAssessmentState(TypedDict):
    # Required inputs (from client)
    subject: str
    level: str

    # Blueprint
    blueprint: Optional[List[dict]]  # [{section, outcome_id, marks}, ...]

    # Exam construction
    questions: List[Question]
    exam_package: Optional[dict]

    # Responses
    responses: Optional[dict]        # {question_id: answer, ...}

    # Marking
    marking: Optional[dict]          # {question_id: {correct, marks_awarded}, ...}
    gap_outcomes: List[str]          # Weak outcome IDs

    # Session tracking
    used_question_ids: List[str]
    exam_count: int
```

#### Nodes

##### 1. `build_blueprint`

**Action:** Get SQA spec and construct exam blueprint

```python
spec = QuestionSource.get_sqa_spec(state.subject, state.level)

blueprint = []
for section in spec.assessment_structure:
    for outcome_id in section.outcome_ids:
        blueprint.append({
            "section": section.section,
            "outcome_id": outcome_id,
            "marks": section.marks // len(section.outcome_ids)  # Distribute evenly
        })

state.blueprint = blueprint
```

##### 2. `fill_slots`

**Action:** Fetch questions for each blueprint slot

```python
all_questions = []
used = state.used_question_ids or []

for slot in state.blueprint:
    fetch_result = compiled_fetch_graph.invoke({
        "subject": state.subject,
        "level": state.level,
        "target_outcome": slot["outcome_id"],
        "used_question_ids": used
    })

    question = fetch_result["question"]
    question["marks"] = slot["marks"]  # Override marks to match blueprint

    all_questions.append(question)
    used = fetch_result["used_question_ids"]

state.questions = all_questions
state.used_question_ids = used
```

##### 3. `assemble_exam`

**Action:** Package questions into exam format

```python
exam_package = {
    "exam_id": f"{state.subject}_{state.level}_{state.exam_count}",
    "subject": state.subject,
    "level": state.level,
    "total_marks": sum(q["marks"] for q in state.questions),
    "sections": group_by_section(state.questions),
    "time_allowed_minutes": calculate_time(state.questions),
    "instructions": generate_instructions(state.subject, state.level)
}

state.exam_package = exam_package
```

##### 4. `deliver_exam`

**Action:** Interrupt to present exam to user

```python
exam_message = AIMessage(
    content="",
    tool_calls=[{
        "id": f"deliver_exam_{state.exam_package['exam_id']}",
        "name": "DeliverExamTool",
        "args": {
            "exam": state.exam_package,
            "questions": state.questions
        }
    }]
)

# Interrupt for exam completion
interrupt({})

return {"messages": [exam_message]}
```

##### 5. `collect_responses`

**Action:** Extract user answers from resume payload

```python
# Frontend sends: resume: JSON.stringify({ responses: {...} })
responses = state.get("resume_data", {}).get("responses", {})
state.responses = responses
```

##### 6. `mark_exam`

**Action:** Mark all responses and identify weak outcomes

```python
marking = {}
gap_outcomes = []

for question in state.questions:
    user_answer = state.responses.get(question["id"], "")

    diagnose_result = compiled_diagnose_graph.invoke({
        "question": question,
        "user_answer": user_answer
    })

    marking[question["id"]] = {
        "correct": diagnose_result["result"] == "correct",
        "marks_awarded": calculate_marks(question, diagnose_result),
        "gap_tags": diagnose_result["gap_tags"]
    }

    if diagnose_result["result"] == "wrong":
        gap_outcomes.append(question["outcome_id"])

state.marking = marking
state.gap_outcomes = list(set(gap_outcomes))  # Unique outcomes
```

##### 7. `remediate_gaps`

**Action:** Generate targeted remediation for weak outcomes

```python
remediation_content = []

for outcome_id in state.gap_outcomes:
    # Fetch additional practice questions
    practice_result = compiled_fetch_graph.invoke({
        "subject": state.subject,
        "level": state.level,
        "target_outcome": outcome_id,
        "used_question_ids": state.used_question_ids
    })

    remediation_content.append({
        "outcome_id": outcome_id,
        "explanation": generate_outcome_explanation(outcome_id),
        "practice_question": practice_result["question"]
    })

# Present remediation
remediation_message = AIMessage(
    content="",
    tool_calls=[{
        "id": f"remediate_{state.exam_package['exam_id']}",
        "name": "ShowRemediationTool",
        "args": {
            "marking": state.marking,
            "remediation": remediation_content
        }
    }]
)

return {"messages": [remediation_message]}
```

##### 8. `check_next_exam`

**Action:** Ask if user wants another exam

```python
# Interrupt for decision
interrupt({})

# Frontend sends: resume: JSON.stringify({ next_exam: true/false })
should_continue = state.get("resume_data", {}).get("next_exam", True)

if should_continue:
    state.exam_count += 1

return {"should_continue": should_continue}
```

#### Graph Structure

```python
exam_graph = StateGraph(ExamAssessmentState)

exam_graph.add_node("build_blueprint", build_blueprint)
exam_graph.add_node("fill_slots", fill_slots)
exam_graph.add_node("assemble_exam", assemble_exam)
exam_graph.add_node("deliver_exam", deliver_exam)
exam_graph.add_node("collect_responses", collect_responses)
exam_graph.add_node("mark_exam", mark_exam)
exam_graph.add_node("remediate_gaps", remediate_gaps)
exam_graph.add_node("check_next_exam", check_next_exam)

exam_graph.add_edge("__start__", "build_blueprint")
exam_graph.add_edge("build_blueprint", "fill_slots")
exam_graph.add_edge("fill_slots", "assemble_exam")
exam_graph.add_edge("assemble_exam", "deliver_exam")
exam_graph.add_edge("deliver_exam", "collect_responses")
exam_graph.add_edge("collect_responses", "mark_exam")
exam_graph.add_edge("mark_exam", "remediate_gaps")
exam_graph.add_edge("remediate_gaps", "check_next_exam")

exam_graph.add_conditional_edges(
    "check_next_exam",
    lambda state: "continue" if state.get("should_continue") else "end",
    {
        "continue": "build_blueprint",
        "end": "__end__"
    }
)

exam_assessment_graph = exam_graph.compile()
```

---

## State Definitions

### Consolidated State Module (`states.py`)

```python
from typing import TypedDict, Optional, List, Literal

# ============================================================================
# Question Schema
# ============================================================================

class MarkingCriteria(TypedDict):
    step: str
    marks: int

class MarkingScheme(TypedDict):
    criteria: List[MarkingCriteria]
    total_marks: int

class Question(TypedDict):
    id: str
    source: Literal["local", "us", "past", "llm", "variant"]
    subject: str
    level: str
    outcome_id: str
    text: str
    marks: int
    marking_scheme: MarkingScheme
    metadata: dict

# ============================================================================
# SQA Spec Schema
# ============================================================================

class Outcome(TypedDict):
    id: str
    label: str
    weight: float

class AssessmentSection(TypedDict):
    section: str
    outcome_ids: List[str]
    marks: int

class SQASpec(TypedDict):
    outcomes: List[Outcome]
    assessment_structure: List[AssessmentSection]

# ============================================================================
# Subgraph States
# ============================================================================

class FetchQuestionState(TypedDict):
    # Required inputs
    subject: str
    level: str

    # Optional inputs
    target_outcome: Optional[str]
    used_question_ids: Optional[List[str]]

    # Internal (temporary)
    __candidates: Optional[List[Question]]

    # Outputs
    question: Optional[Question]

class DiagnosePatchState(TypedDict):
    # Required inputs
    question: Question
    user_answer: str

    # Outputs
    result: str  # "correct" | "wrong"
    gap_tags: List[str]
    remediation: Optional[str]

# ============================================================================
# Main Graph States
# ============================================================================

class QuestionPracticeState(TypedDict):
    # Required inputs (from client)
    subject: str
    level: str

    # Optional inputs
    target_outcome: Optional[str]

    # Session state
    question: Optional[Question]
    user_answer: Optional[str]
    used_question_ids: List[str]

    # Result tracking
    result: Optional[str]
    gap_tags: Optional[List[str]]
    remediation: Optional[str]

    # Statistics
    total_questions: int
    correct_count: int
    streak: int

    # Control flow
    should_continue: bool
    resume_data: Optional[dict]

class ExamAssessmentState(TypedDict):
    # Required inputs (from client)
    subject: str
    level: str

    # Blueprint
    blueprint: Optional[List[dict]]

    # Exam construction
    questions: List[Question]
    exam_package: Optional[dict]

    # Responses
    responses: Optional[dict]

    # Marking
    marking: Optional[dict]
    gap_outcomes: List[str]

    # Session tracking
    used_question_ids: List[str]
    exam_count: int

    # Control flow
    should_continue: bool
    resume_data: Optional[dict]
```

---

## Implementation Plan

### Phase 1: Foundation (States & Tool Interface)

**Tasks:**
1. ✅ Create specification document
2. Create `states.py` with all TypedDict definitions
3. Implement `QuestionSource` tool in `question_source.py`
   - Mock implementations initially (return sample data)
   - Add logging for all method calls
4. Write unit tests for `QuestionSource`
   - Test each method with various inputs
   - Validate schemas with sample data

**Files Created:**
- `langgraph-agent/src/agent/sqa/__init__.py`
- `langgraph-agent/src/agent/sqa/states.py`
- `langgraph-agent/src/agent/sqa/question_source.py`
- `langgraph-agent/tests/sqa/unit/test_question_source.py`
- `langgraph-agent/tests/fixtures/sqa_test_data.py`

### Phase 2: Shared Subgraphs

**Tasks:**
1. Implement `SG_FetchQuestion` in `subgraphs/fetch_question.py`
   - Three nodes: ensure_outcome, collect_candidates, apply_novelty
   - Compile and export graph
2. Write unit tests for `SG_FetchQuestion`
   - Test outcome selection
   - Test Nat5+ rule
   - Test novelty enforcement
3. Implement `SG_DiagnoseAndPatch` in `subgraphs/diagnose_patch.py`
   - Two nodes: check_answer, diagnose_gaps
   - Conditional edges
4. Write unit tests for `SG_DiagnoseAndPatch`
   - Test correct/wrong branching
   - Test gap detection
   - Test remediation generation

**Files Created:**
- `langgraph-agent/src/agent/sqa/subgraphs/__init__.py`
- `langgraph-agent/src/agent/sqa/subgraphs/fetch_question.py`
- `langgraph-agent/src/agent/sqa/subgraphs/diagnose_patch.py`
- `langgraph-agent/tests/sqa/unit/test_fetch_question.py`
- `langgraph-agent/tests/sqa/unit/test_diagnose_patch.py`

### Phase 3: Main Graphs

**Tasks:**
1. Implement `QuestionPracticeGraph` in `graphs/question_practice.py`
   - Six nodes: fetch, present, collect, diagnose, show_feedback, check_continue
   - Interrupt patterns for UI boundaries
2. Write unit tests for `QuestionPracticeGraph`
   - Mock subgraph calls
   - Test routing and loops
3. Implement `ExamAssessmentGraph` in `graphs/exam_assessment.py`
   - Eight nodes: build_blueprint → check_next_exam
   - Complex blueprint construction
4. Write unit tests for `ExamAssessmentGraph`
   - Test blueprint generation
   - Test question slot filling
   - Test batch marking

**Files Created:**
- `langgraph-agent/src/agent/sqa/graphs/__init__.py`
- `langgraph-agent/src/agent/sqa/graphs/question_practice.py`
- `langgraph-agent/src/agent/sqa/graphs/exam_assessment.py`
- `langgraph-agent/tests/sqa/unit/test_question_practice.py`
- `langgraph-agent/tests/sqa/unit/test_exam_assessment.py`

### Phase 4: Integration & E2E Testing

**Tasks:**
1. Write integration test for question practice flow
   - Full cycle: fetch → present → answer → diagnose → loop
   - Multi-round session
2. Write integration test for exam assessment flow
   - Full cycle: blueprint → assemble → mark → remediate → loop
   - Test with realistic exam sizes (30-40 questions)
3. Write E2E tests
   - Test all SQA levels (Nat 3, 4, 5, Higher, Advanced Higher)
   - Test edge cases (no questions, all wrong, all correct)
   - Performance benchmarks

**Files Created:**
- `langgraph-agent/tests/sqa/integration/test_practice_flow.py`
- `langgraph-agent/tests/sqa/integration/test_exam_flow.py`
- `langgraph-agent/tests/sqa/e2e/test_sqa_graphs_e2e.py`

### Phase 5: Configuration & Documentation

**Tasks:**
1. Update `langgraph.json` to register both graphs
2. Create helper utilities in `utils.py`
   - Outcome selection logic
   - Marking comparison functions
   - Remediation builders
3. Write documentation
   - Architecture overview
   - Usage examples
   - API reference

**Files Created:**
- `langgraph-agent/langgraph.json` (updated)
- `langgraph-agent/src/agent/sqa/utils.py`
- `langgraph-agent/src/agent/sqa/README.md`

---

## Testing Strategy

### Unit Tests

**Scope:** Individual components in isolation

- **QuestionSource Tool:** Mock data, validate schemas
- **Subgraphs:** Mock tool calls, test node logic
- **Main Graphs:** Mock subgraph calls, test routing

**Pattern:**
```python
def test_fetch_question_ensures_outcome():
    """Test that outcome is selected when not provided."""
    state = {
        "subject": "Mathematics",
        "level": "Nat 5",
        "used_question_ids": []
    }
    result = compiled_fetch_graph.invoke(state)
    assert "question" in result
    assert result["question"]["outcome_id"] is not None
```

### Integration Tests

**Scope:** Multiple components working together

- **Question Practice Flow:** Real subgraphs, mock tool
- **Exam Assessment Flow:** Real subgraphs, mock tool

**Pattern:**
```python
def test_full_practice_session():
    """Test complete practice session with 3 questions."""
    state = {
        "subject": "Physics",
        "level": "Higher",
        "total_questions": 0,
        "correct_count": 0
    }

    for i in range(3):
        # Simulate user interaction
        result = question_practice_graph.invoke(state)
        assert result["question"] is not None

        # Provide answer
        state["resume_data"] = {"user_answer": "correct answer"}
        result = question_practice_graph.invoke(state)

        assert result["result"] in ["correct", "wrong"]
```

### E2E Tests

**Scope:** Entire system with realistic data

- **All SQA Levels:** Test Nat 3 through Advanced Higher
- **All Subjects:** Mathematics, Physics, Chemistry, Biology, etc.
- **Edge Cases:** No questions available, all wrong, all correct

**Pattern:**
```python
@pytest.mark.e2e
def test_realistic_nat5_maths_exam():
    """Test full Nat 5 Mathematics exam generation and marking."""
    state = {
        "subject": "Mathematics",
        "level": "Nat 5"
    }

    # Generate exam
    result = exam_assessment_graph.invoke(state)
    exam = result["exam_package"]

    assert exam["total_marks"] == 90  # Typical Nat 5 total
    assert len(result["questions"]) >= 30

    # Simulate marking
    responses = generate_realistic_responses(result["questions"])
    state["resume_data"] = {"responses": responses}

    final = exam_assessment_graph.invoke(state)
    assert "marking" in final
    assert "gap_outcomes" in final
```

### Test Data Fixtures

**Location:** `tests/fixtures/sqa_test_data.py`

```python
SAMPLE_OUTCOMES = {
    "Mathematics": {
        "Nat 5": [
            {"id": "MNU-5-01", "label": "Numerical skills", "weight": 0.25},
            {"id": "MNU-5-02", "label": "Algebraic skills", "weight": 0.25},
            # ...
        ]
    }
}

SAMPLE_QUESTIONS = [
    {
        "id": "test_q_001",
        "source": "local",
        "subject": "Mathematics",
        "level": "Nat 5",
        "outcome_id": "MNU-5-01",
        "text": "Calculate 2/10 as a decimal.",
        "marks": 1,
        "marking_scheme": {
            "criteria": [{"step": "Convert fraction", "marks": 1}],
            "total_marks": 1
        }
    }
]
```

---

## Configuration

### LangGraph JSON Update

**File:** `langgraph-agent/langgraph.json`

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph_interrupt.py:graph_interrupt",
    "question_practice": "./src/agent/sqa/graphs/question_practice.py:question_practice_graph",
    "exam_assessment": "./src/agent/sqa/graphs/exam_assessment.py:exam_assessment_graph"
  },
  "env": ".env",
  "image_distro": "wolfi",
  "platform": {
    "enabled": true,
    "checkpointer": "postgres",
    "storage": {
      "type": "postgres"
    }
  }
}
```

### Environment Variables

**File:** `langgraph-agent/.env`

```bash
# Existing variables
OPENAI_API_KEY=your_key_here

# SQA-specific (optional)
SQA_DATA_SOURCE=mock  # mock | database | api
SQA_QUESTION_CACHE_ENABLED=true
SQA_LLM_FALLBACK_ENABLED=true
```

---

## Usage Examples

### Question Practice Session

```python
from langgraph_sdk import get_client

client = get_client(url="http://localhost:2024")

# Start session
thread = await client.threads.create()

# Initial invocation with subject/level
state = {
    "subject": "Mathematics",
    "level": "Nat 5",
    "total_questions": 0,
    "correct_count": 0,
    "streak": 0
}

# Run graph
result = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="question_practice",
    input=state
)

# Graph will interrupt at present_question
# Frontend presents question and collects answer

# Resume with answer
await client.runs.resume(
    thread_id=thread["thread_id"],
    run_id=result["run_id"],
    command={
        "resume": json.dumps({
            "user_answer": "0.2"
        })
    }
)
```

### Exam Assessment Session

```python
# Start exam session
state = {
    "subject": "Physics",
    "level": "Higher",
    "exam_count": 0,
    "used_question_ids": []
}

result = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="exam_assessment",
    input=state
)

# Graph will interrupt at deliver_exam
# Frontend presents full exam and collects all responses

# Resume with all responses
await client.runs.resume(
    thread_id=thread["thread_id"],
    run_id=result["run_id"],
    command={
        "resume": json.dumps({
            "responses": {
                "q1_id": "answer 1",
                "q2_id": "answer 2",
                # ... all question answers
            }
        })
    }
)
```

---

## Key Design Patterns

### 1. No Fallback Pattern

**Rule:** Always throw exceptions, never silently fail.

```python
# BAD - Silent fallback
def get_question(outcome_id):
    try:
        return fetch_question(outcome_id)
    except Exception:
        return None  # Silent failure!

# GOOD - Fail fast
def get_question(outcome_id):
    try:
        return fetch_question(outcome_id)
    except QuestionNotFoundError as e:
        logger.error(f"Failed to fetch question for {outcome_id}: {e}")
        raise  # Re-raise for caller to handle
```

### 2. Interrupt for UI Boundaries

**Pattern:** Tool calls for data, interrupts for flow control.

```python
# Send data via tool call
tool_message = AIMessage(
    content="",
    tool_calls=[{
        "id": "present_123",
        "name": "PresentQuestionTool",
        "args": {"question": state.question}
    }]
)

# Interrupt to wait for user
interrupt({})

return {"messages": [tool_message]}
```

### 3. State Immutability

**Rule:** Never mutate state in-place, always return updates.

```python
# BAD - In-place mutation
def node_function(state):
    state["counter"] += 1  # Mutation!
    return {}

# GOOD - Return updates
def node_function(state):
    return {"counter": state.get("counter", 0) + 1}
```

### 4. Comprehensive Logging

**Rule:** Log all decisions and state transitions.

```python
import logging

logger = logging.getLogger(__name__)

def ensure_outcome(state):
    logger.info(f"Ensuring outcome for {state['subject']} {state['level']}")

    if not state.get("target_outcome"):
        logger.debug("No target outcome, selecting from spec")
        spec = get_sqa_spec(state["subject"], state["level"])
        outcome = choose_outcome(spec.outcomes)
        logger.info(f"Selected outcome: {outcome}")
        return {"target_outcome": outcome}

    logger.debug(f"Using provided outcome: {state['target_outcome']}")
    return {}
```

---

## Future Enhancements (Out of Scope)

### Not Included in MVP

1. **Frontend Implementation**
   - React components for question presentation
   - Exam delivery interface
   - Progress dashboards

2. **Real Data Sources**
   - Integration with SQA official APIs
   - Database schema for local questions
   - Understanding Standards parser

3. **Advanced Features**
   - Adaptive difficulty
   - Spaced repetition scheduling
   - Peer comparison analytics
   - Teacher dashboard

4. **Performance Optimization**
   - Question pre-generation
   - Caching strategies
   - Parallel subgraph execution

---

## Success Criteria

### Definition of Done

- ✅ All 5 QuestionSource methods implemented
- ✅ Both subgraphs working independently
- ✅ Both main graphs compiled and registered
- ✅ Unit tests: 80%+ coverage
- ✅ Integration tests: Both flows tested end-to-end
- ✅ E2E tests: All SQA levels tested
- ✅ Documentation: Complete README with examples
- ✅ Configuration: langgraph.json updated
- ✅ No silent failures: All errors throw exceptions

### Acceptance Tests

1. **Rapid Fire Practice:** User completes 10 questions without errors
2. **Mock Exam:** System generates valid Nat 5 Maths exam (90 marks, 30+ questions)
3. **Remediation:** Wrong answers trigger appropriate gap detection
4. **Novelty:** 50 questions in a row, no duplicates (via mutation)
5. **Performance:** Exam generation completes in < 5 seconds

---

## Appendix: YAML Specification

```yaml
# =========================
# 1. TOOL INTERFACE
# =========================
tool: QuestionSource
version: 1.0
description: Unified question/spec retrieval for SQA subjects and levels.
methods:
  - name: get_sqa_spec
    description: Get SQA spec and assessment structure for a subject+level.
    input:
      type: object
      properties:
        subject: { type: string }
        level:   { type: string }
      required: [subject, level]
    output:
      type: object
      properties:
        outcomes:
          type: array
          items:
            type: object
            properties:
              id:    { type: string }
              label: { type: string }
              weight: { type: number }
        assessment_structure:
          type: array
          items:
            type: object
            properties:
              section:     { type: string }
              outcome_ids: { type: array, items: { type: string } }
              marks:       { type: number }

  - name: get_local_questions
    description: Fetch centre/real-life questions for an outcome.
    input:
      type: object
      properties:
        subject:    { type: string }
        level:      { type: string }
        outcome_id: { type: string }
        limit:      { type: number, default: 5 }
      required: [subject, level, outcome_id]
    output:
      type: array
      items: { $ref: "#/definitions/Question" }

  - name: get_us_or_past_questions
    description: >
      Fetch from Understanding Standards or SQA past papers.
      Should return [] when level below Nat 5.
    input:
      type: object
      properties:
        subject:    { type: string }
        level:      { type: string }
        outcome_id: { type: string }
        limit:      { type: number, default: 5 }
      required: [subject, level, outcome_id]
    output:
      type: array
      items: { $ref: "#/definitions/Question" }

  - name: generate_question
    description: LLM fallback when no questions are found.
    input:
      type: object
      properties:
        subject:    { type: string }
        level:      { type: string }
        outcome_id: { type: string }
        marks:      { type: number, default: 4 }
      required: [subject, level, outcome_id]
    output:
      $ref: "#/definitions/Question"

  - name: mutate_question
    description: Create a fresh variant from an existing question.
    input:
      $ref: "#/definitions/Question"
    output:
      $ref: "#/definitions/Question"

definitions:
  Question:
    type: object
    properties:
      id:         { type: string }
      source:     { type: string, enum: ["local", "us", "past", "llm", "variant"] }
      subject:    { type: string }
      level:      { type: string }
      outcome_id: { type: string }
      text:       { type: string }
      marks:      { type: number }
      marking_scheme:
        type: object
        description: SQA-like marking scheme
      metadata:
        type: object
    required: [id, subject, level, outcome_id, text, marks]
```

---

**End of Specification**
