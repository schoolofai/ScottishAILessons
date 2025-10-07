# Teaching Graph Architecture (teacher_graph_toolcall_interrupt.py)

## Overview

The teaching subgraph (`teacher_graph_toolcall_interrupt.py`) implements an **interactive lesson delivery system** that:
1. Presents lesson cards with Check for Understanding (CFU) questions
2. Uses LangGraph interrupts for human-in-the-loop interactions
3. Evaluates student responses with AI-powered feedback
4. Tracks learning progress and mastery scores
5. Provides retry opportunities with explanations

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              TEACHING SUBGRAPH FLOW                          │
│                                                              │
│  START ─▶ design ─▶ get_answer ─┐                          │
│             ▲          │         │                           │
│             │          ▼         │                           │
│             │        [INTERRUPT] │                           │
│             │          │         │                           │
│             └──────────┘         │                           │
│                                  │                           │
│           ┌──────────────────────┘                           │
│           │                                                  │
│           ▼                                                  │
│         mark ─────┐                                          │
│           │       │                                          │
│           │       ▼                                          │
│           │     retry ─▶ get_answer_retry ─┐                │
│           │       ▲          │              │                │
│           │       │          ▼              │                │
│           │       │      [INTERRUPT]        │                │
│           │       │          │              │                │
│           │       └──────────┘              │                │
│           │                                 │                │
│           ├─────────────────────────────────┘                │
│           │                                                  │
│           ▼                                                  │
│       progress ───┐                                          │
│           │       │                                          │
│           ▼       │                                          │
│        design ◀───┘ (next card)                             │
│           │                                                  │
│           ▼                                                  │
│         END (lesson complete)                               │
└─────────────────────────────────────────────────────────────┘
```

## Core Teaching Loop States

The teaching loop operates through distinct **stages** that control the flow:

```
design ─▶ get_answer ─▶ design ─▶ mark ─▶ retry ─▶ get_answer_retry ─▶ retry ─▶ mark ─▶ progress ─▶ design
  │                                 │                                              │
  │                                 └──────────────────────────────────────────────┘
  │                                          (correct or max attempts)
  │
  └─▶ END (lesson complete)
```

---

## Node-by-Node Deep Dive

### 1. Design Node (`design_node`)

**Purpose**: Central routing hub that makes ALL flow decisions and creates tool calls for UI rendering.

**Input State**:
```python
{
    "current_card_index": int,
    "stage": str,  # "design", "mark", "progress", etc.
    "interrupt_response": Optional[dict],  # From get_answer_node
    "student_response": Optional[str],      # Backward compatibility
    "lesson_snapshot": dict,
    "should_exit": bool
}
```

**Processing Logic**:
```
┌──────────────────────────────────────────────────────────────┐
│ DESIGN NODE DECISION TREE                                    │
│                                                               │
│ 1. Check for interrupt_response (from get_answer_node):      │
│                                                               │
│    IF interrupt_response.action == "submit_answer":          │
│       ├─▶ Extract student_response                           │
│       ├─▶ Create HumanMessage with answer                    │
│       ├─▶ SET stage = "mark"                                 │
│       └─▶ ROUTE TO: mark_node                                │
│                                                               │
│    ELIF interrupt_response.action == "skip_card":            │
│       ├─▶ SET stage = "progress"                             │
│       ├─▶ SET should_progress = True                         │
│       └─▶ ROUTE TO: progress_node                            │
│                                                               │
│ 2. Check for lesson completion:                              │
│                                                               │
│    IF current_card_index >= len(cards):                      │
│       ├─▶ Generate lesson summary with LLM                   │
│       ├─▶ Analyze performance (evidence)                     │
│       ├─▶ Create lesson_completion_summary tool call         │
│       ├─▶ SET stage = "done"                                 │
│       ├─▶ SET should_exit = True                             │
│       └─▶ ROUTE TO: END                                      │
│                                                               │
│ 3. Check for student_response (backward compatibility):      │
│                                                               │
│    IF student_response exists:                               │
│       ├─▶ Create HumanMessage with answer                    │
│       ├─▶ SET stage = "mark"                                 │
│       └─▶ ROUTE TO: mark_node                                │
│                                                               │
│ 4. Default: Create new card presentation:                    │
│                                                               │
│    ├─▶ Get current card from lesson_snapshot                 │
│    ├─▶ Generate card content with LLM:                       │
│    │   • First card: greet_with_first_card_sync_full()       │
│    │   • MCQ cards: present_mcq_card_sync_full()             │
│    │   • Other cards: present_card_sync_full()               │
│    ├─▶ Create lesson_card_presentation tool call             │
│    ├─▶ SET stage = "get_answer"                              │
│    └─▶ ROUTE TO: get_answer_node                             │
└──────────────────────────────────────────────────────────────┘
```

**Tool Call Structure** (for UI rendering):
```python
ToolCall(
    id="lesson_card_<index>",
    name="lesson_card_presentation",
    args={
        "card_content": str,          # Question/stem text
        "card_data": dict,            # Full card structure
        "card_index": int,            # Current position
        "total_cards": int,           # Total lesson cards
        "cfu_type": str,              # "mcq", "free_response", etc.
        "lesson_context": {
            "lesson_title": str,
            "student_name": str,
            "progress": str           # "1/5", "2/5", etc.
        },
        "interaction_id": str,        # UUID for tracking
        "timestamp": str              # ISO format
    }
)
```

**Output State**:
```python
# For new card presentation:
{
    "messages": [message_obj, tool_message],
    "current_card": dict,
    "current_card_index": int,
    "stage": "get_answer",
    "pending_tool_call_id": str,
    "student_response": None
}

# For submit_answer:
{
    "messages": [HumanMessage],
    "student_response": str,
    "current_card": dict,
    "current_card_index": int,
    "stage": "mark",
    "interrupt_response": None
}

# For lesson completion:
{
    "messages": [summary_message, tool_message],
    "stage": "done",
    "should_exit": True,
    "performance_analysis": dict,
    "lesson_summary": AIMessage
}
```

**Key Implementation Details** (teacher_graph_toolcall_interrupt.py:81-275):
- **Interrupt Response Priority**: Checks `interrupt_response` FIRST before other conditions
- **Tool Calls for Data**: Uses tool calls to transport lesson data to frontend UI
- **LLM Integration**: Uses `LLMTeacher` for generating natural language card presentations
- **Completion Tool Call**: Special `lesson_completion_summary` tool for end-of-lesson UI

---

### 2. Get Answer Node (`get_answer_node`)

**Purpose**: Interrupts execution to wait for student input via frontend UI.

**Input State**:
```python
{
    "current_card_index": int,
    "pending_tool_call_id": str  # From design_node
}
```

**Processing Logic**:
```
┌──────────────────────────────────────────────────────────────┐
│ GET ANSWER NODE FLOW                                         │
│                                                               │
│ 1. Interrupt with EMPTY payload:                             │
│    └─▶ interrupt({})                                         │
│                                                               │
│    ⏸️  EXECUTION PAUSES HERE                                 │
│    ⏸️  Waiting for frontend sendCommand()...                 │
│                                                               │
│ 2. RESUME when frontend calls sendCommand():                 │
│    └─▶ Receives response from frontend                       │
│                                                               │
│ 3. Parse response robustly:                                  │
│                                                               │
│    IF response is STRING:                                    │
│       └─▶ JSON.parse(response)                               │
│                                                               │
│    ELIF response is DICT:                                    │
│       IF "resume" key exists:                                │
│          └─▶ Extract and parse resume.value                  │
│       ELSE:                                                   │
│          └─▶ Use response directly                           │
│                                                               │
│    ELSE:                                                      │
│       └─▶ Wrap in {value: str(response)}                     │
│                                                               │
│ 4. Store parsed payload in state:                            │
│    └─▶ interrupt_response = payload                          │
│                                                               │
│ 5. Return to design_node:                                    │
│    └─▶ stage = "design"                                      │
└──────────────────────────────────────────────────────────────┘
```

**Frontend Integration Pattern**:
```typescript
// Frontend sends command with resume wrapper:
sendCommand({
  command: {
    resume: JSON.stringify({
      action: "submit_answer",
      student_response: "42"
    })
  }
})
```

**Output State**:
```python
{
    "interrupt_response": {
        "action": "submit_answer",
        "student_response": str
    },
    # OR
    "interrupt_response": {
        "action": "skip_card",
        "reason": str
    },
    "stage": "design"  # Always return to design
}
```

**Key Implementation Details** (teacher_graph_toolcall_interrupt.py:278-328):
- **Empty Interrupt Payload**: Uses `interrupt({})` because data comes from tool call
- **Resume Wrapper**: Expects frontend to wrap payload in `resume` key
- **Robust Parsing**: Handles string JSON, dict, and nested structures
- **Always Returns to Design**: Simplifies flow control

---

### 3. Mark Node (`mark_node`)

**Purpose**: Evaluates student response using LLM and records evidence.

**Input State**:
```python
{
    "student_response": str,
    "current_card": dict,
    "current_card_index": int,
    "attempts": int,
    "max_attempts": int,
    "evidence": List[dict]
}
```

**Processing Logic**:
```
┌──────────────────────────────────────────────────────────────┐
│ MARK NODE EVALUATION FLOW                                    │
│                                                               │
│ 1. Validate input:                                           │
│    IF student_response OR current_card missing:              │
│       └─▶ ROUTE BACK TO: design                              │
│                                                               │
│ 2. Increment attempts counter                                │
│                                                               │
│ 3. Evaluate response with LLM:                               │
│    └─▶ LLMTeacher.evaluate_response_with_structured_output() │
│                                                               │
│    Returns structured evaluation:                            │
│    {                                                          │
│      "is_correct": bool,                                     │
│      "feedback": str,                                        │
│      "hint_level": int,                                      │
│      "confidence": float                                     │
│    }                                                          │
│                                                               │
│ 4. Determine progression:                                    │
│    should_progress = is_correct OR (attempts >= max_attempts)│
│                                                               │
│ 5. Record evidence entry:                                    │
│    evidence.append({                                         │
│      "card_id": str,                                         │
│      "question": str,                                        │
│      "student_response": str,                                │
│      "is_correct": bool,                                     │
│      "attempts": int,                                        │
│      "should_progress": bool,                                │
│      "feedback": str,                                        │
│      "timestamp": str                                        │
│    })                                                         │
│                                                               │
│ 6. Generate explanation (if max attempts & incorrect):       │
│    IF attempts >= max_attempts AND NOT is_correct:           │
│       └─▶ LLMTeacher.explain_correct_answer_sync_full()      │
│                                                               │
│ 7. Route based on progression:                               │
│    IF should_progress:                                       │
│       └─▶ stage = "progress" → ROUTE TO: progress_node      │
│    ELSE:                                                      │
│       └─▶ stage = "retry" → ROUTE TO: retry_node            │
└──────────────────────────────────────────────────────────────┘
```

**LLM Evaluation Example**:
```python
# Input to LLM:
{
    "student_response": "The answer is 0.2",
    "expected_answer": "1/5 or 0.2",
    "card_context": {
        "cfu": {
            "stem": "Simplify 2/10",
            "type": "free_response"
        }
    },
    "attempt_number": 1,
    "max_attempts": 3
}

# LLM returns structured output:
{
    "is_correct": True,
    "feedback": "Excellent! 0.2 is the correct decimal form of 2/10...",
    "hint_level": 0,
    "confidence": 0.95
}
```

**Output State**:
```python
{
    "is_correct": bool,
    "should_progress": bool,
    "feedback": str,
    "explanation": Optional[str],  # For max attempts
    "attempts": int,
    "evidence": List[dict],
    "stage": "progress" or "retry",
    "student_response": None  # Clear for next attempt
}
```

**Key Implementation Details** (teacher_graph_toolcall_interrupt.py:331-402):
- **Structured LLM Output**: Uses `with_structured_output()` for consistent evaluation
- **Evidence Recording**: Tracks every attempt for analytics
- **Explanation Generation**: Provides detailed explanation after max attempts
- **Conditional Routing**: Routes to retry for incorrect answers, progress for correct

---

### 4. Retry Node (`retry_node`)

**Purpose**: Shows feedback and re-presents the card for another attempt.

**Input State**:
```python
{
    "interrupt_response": Optional[dict],  # From get_answer_retry_node
    "feedback": str,
    "explanation": Optional[str],
    "current_card": dict,
    "current_card_index": int,
    "attempts": int,
    "lesson_snapshot": dict
}
```

**Processing Logic**:
```
┌──────────────────────────────────────────────────────────────┐
│ RETRY NODE FLOW                                              │
│                                                               │
│ 1. Check for interrupt_response (from get_answer_retry):     │
│                                                               │
│    IF interrupt_response.action == "submit_answer":          │
│       ├─▶ Extract student_response                           │
│       ├─▶ Create HumanMessage                                │
│       ├─▶ SET stage = "mark"                                 │
│       └─▶ ROUTE TO: mark_node                                │
│                                                               │
│    ELIF interrupt_response.action == "skip_card":            │
│       ├─▶ SET stage = "progress"                             │
│       └─▶ ROUTE TO: progress_node                            │
│                                                               │
│ 2. Default: Create retry presentation                        │
│                                                               │
│    ├─▶ Get feedback from state                               │
│    ├─▶ Get explanation (if exists)                           │
│    │                                                          │
│    ├─▶ IF explanation exists:                                │
│    │   └─▶ Combine feedback + explanation                    │
│    │   └─▶ Create AIMessage with combined content            │
│    │                                                          │
│    ├─▶ ELSE:                                                 │
│    │   └─▶ Create AIMessage with feedback only               │
│    │                                                          │
│    ├─▶ Create lesson_card_presentation tool call (SAME!)     │
│    │   (Re-uses same tool as design_node)                    │
│    │                                                          │
│    ├─▶ SET stage = "get_answer_retry"                        │
│    └─▶ ROUTE TO: get_answer_retry_node                       │
└──────────────────────────────────────────────────────────────┘
```

**Retry Tool Call Structure** (identical to design_node):
```python
ToolCall(
    id="retry_card_<index>_<attempt>",  # Unique per retry
    name="lesson_card_presentation",     # SAME tool name
    args={
        "card_content": str,
        "card_data": dict,               # SAME card
        "card_index": int,
        "total_cards": int,
        "cfu_type": str,
        "lesson_context": {...},
        "interaction_id": str,           # New UUID
        "timestamp": str
    }
)
```

**Output State**:
```python
# For retry presentation:
{
    "messages": [feedback_message, tool_message],
    "stage": "get_answer_retry",
    "pending_tool_call_id": str,
    "student_response": None,
    "explanation": None  # Clear after use
}

# For submit_answer (from interrupt):
{
    "messages": [HumanMessage],
    "student_response": str,
    "stage": "mark",
    "interrupt_response": None
}
```

**Key Implementation Details** (teacher_graph_toolcall_interrupt.py:405-513):
- **Feedback + Explanation**: Combines both for comprehensive retry guidance
- **Same Tool Call**: Re-uses `lesson_card_presentation` tool (not a separate retry tool)
- **Interrupt Response Handling**: Checks for new submission before creating retry UI

---

### 5. Get Answer Retry Node (`get_answer_retry_node`)

**Purpose**: Interrupts execution to wait for retry attempt submission.

**Input State**:
```python
{
    "current_card_index": int,
    "attempts": int,
    "pending_tool_call_id": str
}
```

**Processing Logic**:
```
┌──────────────────────────────────────────────────────────────┐
│ GET ANSWER RETRY NODE FLOW                                   │
│                                                               │
│ (IDENTICAL TO get_answer_node, but returns to retry)         │
│                                                               │
│ 1. Interrupt with EMPTY payload:                             │
│    └─▶ interrupt({})                                         │
│                                                               │
│    ⏸️  EXECUTION PAUSES HERE                                 │
│                                                               │
│ 2. RESUME when frontend calls sendCommand()                  │
│                                                               │
│ 3. Parse response (same logic as get_answer_node)            │
│                                                               │
│ 4. Store in interrupt_response                               │
│                                                               │
│ 5. Return to retry_node:                                     │
│    └─▶ stage = "retry"  (not "design"!)                     │
└──────────────────────────────────────────────────────────────┘
```

**Output State**:
```python
{
    "interrupt_response": dict,
    "stage": "retry"  # Always go back to retry
}
```

**Key Implementation Details** (teacher_graph_toolcall_interrupt.py:516-567):
- **Identical to get_answer_node**: Same interrupt and parsing logic
- **Routes to Retry**: Returns to retry_node instead of design_node
- **Separate Node Needed**: Enables different routing behavior

---

### 6. Progress Node (`progress_node`)

**Purpose**: Moves to the next card and updates mastery tracking.

**Input State**:
```python
{
    "current_card_index": int,
    "current_card": dict,
    "cards_completed": List[str],
    "lesson_snapshot": dict,
    "is_correct": bool,
    "mastery_updates": List[dict]
}
```

**Processing Logic**:
```
┌──────────────────────────────────────────────────────────────┐
│ PROGRESS NODE FLOW                                           │
│                                                               │
│ 1. Add current card to completed list:                       │
│    cards_completed.append(current_card["id"])                │
│                                                               │
│ 2. Update mastery scores:                                    │
│    └─▶ _update_mastery_scores()                              │
│                                                               │
│    For each skill in current card:                           │
│    ├─▶ Calculate mastery delta based on performance          │
│    ├─▶ Apply delta to current score                          │
│    └─▶ Create mastery update entry:                          │
│        {                                                      │
│          "skill_id": str,                                    │
│          "skill_name": str,                                  │
│          "previous_score": float,                            │
│          "new_score": float,                                 │
│          "delta": float,                                     │
│          "card_id": str,                                     │
│          "timestamp": str                                    │
│        }                                                      │
│                                                               │
│ 3. Increment card index:                                     │
│    next_card_index = current_card_index + 1                  │
│                                                               │
│ 4. Generate transition message with LLM:                     │
│    └─▶ LLMTeacher.transition_to_next_sync_full()             │
│                                                               │
│    Provides encouraging transition like:                     │
│    "Great job! Let's move on to the next concept..."         │
│                                                               │
│ 5. Reset attempt counters:                                   │
│    attempts = 0                                              │
│    is_correct = None                                         │
│    feedback = None                                           │
│    student_response = None                                   │
│                                                               │
│ 6. Return to design for next card:                           │
│    └─▶ stage = "design"                                      │
└──────────────────────────────────────────────────────────────┘
```

**Mastery Score Calculation**:
```python
# For correct answer:
delta = +0.1 * (1.0 - current_score)  # Asymptotic to 1.0

# For incorrect (max attempts):
delta = -0.2 * current_score          # Asymptotic to 0.0

# Example:
current_score = 0.6
is_correct = True
delta = 0.1 * (1.0 - 0.6) = 0.04
new_score = 0.6 + 0.04 = 0.64
```

**Output State**:
```python
{
    "current_card_index": int,      # Incremented
    "cards_completed": List[str],   # Updated
    "mastery_updates": List[dict],  # New entries
    "stage": "design",              # Back to design
    "student_response": None,
    "is_correct": None,
    "feedback": None,
    "attempts": 0,                  # Reset
    "messages": [transition_message]
}
```

**Key Implementation Details** (teacher_graph_toolcall_interrupt.py:570-623):
- **Mastery Tracking**: Uses `_update_mastery_scores()` utility function
- **Transition Messages**: LLM generates contextual encouragement
- **State Reset**: Clears all attempt-specific fields for clean slate

---

## Conditional Edge Functions

### `should_continue_from_design`

**Purpose**: Determines next node after design based on stage and completion.

```python
def should_continue_from_design(state: InterruptUnifiedState) -> str:
    should_exit = state.get("should_exit", False)
    stage = state.get("stage", "get_answer")

    if should_exit or stage == "done":
        return END

    return stage  # "get_answer", "mark", "progress"
```

**Routing Map**:
```
design ─▶ "get_answer"  → get_answer_node
       ─▶ "mark"        → mark_node (direct answer submission)
       ─▶ "progress"    → progress_node (skip card)
       ─▶ END           (lesson complete)
```

### `should_continue_from_mark`

**Purpose**: Routes to progress or retry based on evaluation.

```python
def should_continue_from_mark(state: InterruptUnifiedState) -> str:
    should_progress = state.get("should_progress", False)
    return "progress" if should_progress else "retry"
```

**Routing Map**:
```
mark ─▶ "progress"  (correct or max attempts)
     ─▶ "retry"     (incorrect with attempts remaining)
```

### `should_continue_from_retry`

**Purpose**: Determines next node after retry based on stage.

```python
def should_continue_from_retry(state: InterruptUnifiedState) -> str:
    should_exit = state.get("should_exit", False)
    stage = state.get("stage", "get_answer_retry")

    if should_exit or stage == "done":
        return END

    return stage  # "get_answer_retry", "mark", "progress"
```

**Routing Map**:
```
retry ─▶ "get_answer_retry"  → get_answer_retry_node
      ─▶ "mark"              → mark_node (direct submission)
      ─▶ "progress"          → progress_node (skip card)
      ─▶ END                 (early exit)
```

---

## Complete Teaching Loop Diagram

```
                            START
                              │
                              ▼
                     ┌────────────────┐
                     │  design_node   │◀──────────┐
                     │                │           │
                     │ • Check state  │           │
                     │ • Create tool  │           │
                     │ • Route        │           │
                     └────┬───────────┘           │
                          │                       │
          ┌───────────────┼───────────────┐       │
          │               │               │       │
          ▼               ▼               ▼       │
    ┌──────────┐   ┌─────────────┐  ┌─────────┐  │
    │   mark   │   │ get_answer  │  │ progress│  │
    │  (direct)│   │             │  │ (skip)  │  │
    └────┬─────┘   └──────┬──────┘  └────┬────┘  │
         │                │               │       │
         │                ▼               └───────┘
         │          ⏸️ INTERRUPT              │
         │                │                  │
         │                ▼                  │
         │         resume design ◀───────────┘
         │                │
         │                ▼
         │         submit answer
         │                │
         ▼                ▼
    ┌─────────────────────────────┐
    │       mark_node              │
    │                              │
    │ • Evaluate with LLM          │
    │ • Record evidence            │
    │ • Determine progression      │
    └──────┬───────────────────┬───┘
           │                   │
    ┌──────▼──────┐    ┌───────▼──────┐
    │  progress   │    │    retry     │
    │             │    │              │
    │ • Update    │    │ • Feedback   │
    │   mastery   │    │ • Explanation│
    │ • Increment │    │ • Re-present │
    │   index     │    └──────┬───────┘
    │ • Transition│           │
    └──────┬──────┘           ▼
           │          ┌────────────────┐
           │          │ get_answer_    │
           │          │     retry      │
           │          └───────┬────────┘
           │                  │
           │                  ▼
           │            ⏸️ INTERRUPT
           │                  │
           │                  ▼
           │           resume retry
           │                  │
           │                  ▼
           │           submit answer
           │                  │
           └──────────────────┴─────────▶ back to design
                                            (next card)
                                               │
                                               ▼
                                          all cards
                                          complete?
                                               │
                                               ▼
                                        ┌────────────┐
                                        │ completion │
                                        │   summary  │
                                        └─────┬──────┘
                                              │
                                              ▼
                                             END
```

---

## LLM Teacher Integration

### Key LLMTeacher Methods

#### 1. Card Presentation
```python
# First card with greeting
teacher.greet_with_first_card_sync_full(
    lesson_snapshot: dict,
    current_card: dict
) -> AIMessage

# MCQ card presentation
teacher.present_mcq_card_sync_full(
    current_card: dict
) -> AIMessage

# Standard card presentation
teacher.present_card_sync_full(
    current_card: dict
) -> AIMessage
```

#### 2. Response Evaluation
```python
teacher.evaluate_response_with_structured_output(
    student_response: str,
    expected_answer: str,
    card_context: dict,
    attempt_number: int,
    max_attempts: int
) -> EvaluationResult  # Structured output

# Returns:
{
    "is_correct": bool,
    "feedback": str,
    "hint_level": int,
    "confidence": float
}
```

#### 3. Explanation Generation
```python
teacher.explain_correct_answer_sync_full(
    current_card: dict,
    student_attempts: List[dict]
) -> AIMessage

# Generates comprehensive explanation after max attempts
```

#### 4. Transition Messages
```python
teacher.transition_to_next_sync_full(
    completed_card: dict,
    next_card: Optional[dict],
    progress_context: dict
) -> AIMessage

# Provides encouraging transition between cards
```

#### 5. Lesson Summary
```python
teacher.summarize_completed_lesson_sync_full(
    lesson_snapshot: dict,
    evidence: List[dict],
    performance_analysis: dict
) -> AIMessage

# Generates comprehensive end-of-lesson summary
```

---

## State Schema Deep Dive

### InterruptUnifiedState Fields

**Session Context** (from main graph):
```python
"session_id": str               # Unique session identifier
"student_id": str               # Student identifier
"course_id": str                # Course identifier
"lesson_template_id": str       # Template identifier
"lesson_snapshot": dict         # Complete lesson structure
```

**Card Progression**:
```python
"current_card_index": int       # 0-based index
"current_card": Optional[dict]  # Current card data
"cards_completed": List[str]    # List of completed card IDs
```

**Attempt Tracking**:
```python
"attempts": int                 # Current card attempt count
"max_attempts": int             # Maximum allowed (usually 3)
"hint_level": int               # Escalating hint level
```

**Evaluation Results**:
```python
"is_correct": Optional[bool]    # Latest evaluation result
"should_progress": Optional[bool]  # Should move to next card
"feedback": Optional[str]       # Latest feedback message
"explanation": Optional[str]    # Explanation (max attempts)
```

**Evidence and Analytics**:
```python
"evidence": List[dict]          # All attempt records
"mastery_updates": List[dict]   # Skill mastery changes
"performance_analysis": Optional[dict]  # End summary
```

**Interrupt System**:
```python
"interrupt_count": int          # Total interrupts in session
"interrupt_response": Optional[dict]  # Latest user action
"pending_tool_call_id": Optional[str]  # Current tool call
"tool_response_received": bool  # For router logic
```

**Flow Control**:
```python
"stage": str                    # Current flow stage
"should_exit": bool             # Should terminate
"student_response": Optional[str]  # Latest submission
```

---

## Evidence Recording Format

Each attempt creates an evidence entry:

```python
{
    "card_id": "card_123",
    "question": "Simplify 2/10",
    "student_response": "0.2",
    "is_correct": True,
    "attempts": 1,
    "should_progress": True,
    "feedback": "Excellent! 0.2 is the correct decimal form...",
    "timestamp": "2025-10-07T10:30:00Z",
    "cfu_type": "free_response",
    "skill_ids": ["fractions_001", "decimals_002"]
}
```

## Mastery Update Format

Each card completion creates mastery updates:

```python
{
    "skill_id": "fractions_001",
    "skill_name": "Fraction Simplification",
    "previous_score": 0.60,
    "new_score": 0.64,
    "delta": 0.04,
    "card_id": "card_123",
    "timestamp": "2025-10-07T10:30:00Z",
    "is_correct": True
}
```

---

## Performance Analysis Format

End-of-lesson analysis:

```python
{
    "overall_accuracy": 0.85,        # Percentage correct
    "total_attempts": 12,            # Total attempts across all cards
    "cards_completed": 5,            # Number of cards completed
    "average_attempts_per_card": 2.4,
    "retry_recommended": False,      # Should retry lesson
    "strong_skills": ["fractions_001"],
    "weak_skills": ["decimals_003"],
    "time_spent_seconds": 420,
    "engagement_score": 0.92
}
```

---

## Graph Construction

```python
teaching_graph_toolcall = StateGraph(InterruptUnifiedState)

# Add nodes
teaching_graph_toolcall.add_node("design", design_node)
teaching_graph_toolcall.add_node("get_answer", get_answer_node)
teaching_graph_toolcall.add_node("mark", mark_node)
teaching_graph_toolcall.add_node("progress", progress_node)
teaching_graph_toolcall.add_node("retry", retry_node)
teaching_graph_toolcall.add_node("get_answer_retry", get_answer_retry_node)

# Add edges
teaching_graph_toolcall.add_edge(START, "design")
teaching_graph_toolcall.add_edge("get_answer", "design")
teaching_graph_toolcall.add_edge("progress", "design")
teaching_graph_toolcall.add_edge("get_answer_retry", "retry")

# Add conditional edges
teaching_graph_toolcall.add_conditional_edges(
    "design",
    should_continue_from_design,
    {"get_answer": "get_answer", "mark": "mark", "progress": "progress", END: END}
)

teaching_graph_toolcall.add_conditional_edges(
    "mark",
    should_continue_from_mark,
    {"progress": "progress", "retry": "retry"}
)

teaching_graph_toolcall.add_conditional_edges(
    "retry",
    should_continue_from_retry,
    {"get_answer_retry": "get_answer_retry", "mark": "mark", "progress": "progress", END: END}
)

# Compile with checkpointing
compiled_teaching_graph_toolcall = teaching_graph_toolcall.compile(checkpointer=True)
```

---

## Interaction Patterns

### Pattern 1: Correct Answer on First Try

```
design_node
  ├─▶ Creates tool call with card data
  └─▶ Routes to get_answer_node
      │
get_answer_node
  ├─▶ interrupt({})
  ├─▶ ⏸️ Waits for frontend
  ├─▶ Receives: {action: "submit_answer", student_response: "0.2"}
  └─▶ Routes to design_node with interrupt_response
      │
design_node
  ├─▶ Processes interrupt_response
  ├─▶ Creates HumanMessage
  └─▶ Routes to mark_node with student_response
      │
mark_node
  ├─▶ Evaluates: is_correct=True
  ├─▶ Records evidence
  ├─▶ should_progress=True
  └─▶ Routes to progress_node
      │
progress_node
  ├─▶ Updates mastery scores
  ├─▶ Increments card index
  ├─▶ Generates transition message
  └─▶ Routes to design_node for next card
```

### Pattern 2: Incorrect Answer with Retry

```
design_node → get_answer_node → interrupt → design_node → mark_node
                                                            │
                                                  is_correct=False
                                                  attempts=1 < 3
                                                            │
                                                            ▼
                                                      retry_node
  ├─▶ Shows feedback
  ├─▶ Creates tool call (SAME card)
  └─▶ Routes to get_answer_retry_node
      │
get_answer_retry_node
  ├─▶ interrupt({})
  ├─▶ Receives second attempt
  └─▶ Routes to retry_node with interrupt_response
      │
retry_node
  ├─▶ Processes interrupt_response
  └─▶ Routes to mark_node with new student_response
      │
mark_node
  ├─▶ Evaluates second attempt
  └─▶ Routes to progress (if correct) or retry (if still incorrect)
```

### Pattern 3: Max Attempts with Explanation

```
mark_node (3rd attempt, incorrect)
  ├─▶ is_correct=False
  ├─▶ attempts=3 >= max_attempts
  ├─▶ should_progress=True (forced)
  ├─▶ Generates explanation with LLM
  └─▶ Routes to progress_node
      │
progress_node
  ├─▶ Updates mastery (negative delta for incorrect)
  └─▶ Moves to next card
```

---

## Tool Call Types

### 1. lesson_card_presentation

**Used by**: design_node, retry_node

**Purpose**: Render interactive lesson card UI

**Args**:
```typescript
{
  card_content: string;         // Question/stem text
  card_data: {                  // Full card structure
    id: string;
    cfu: {
      type: string;
      stem?: string;
      question?: string;
      options?: string[];
      answerIndex?: number;
    };
  };
  card_index: number;
  total_cards: number;
  cfu_type: string;
  lesson_context: {
    lesson_title: string;
    student_name: string;
    progress: string;
  };
  interaction_id: string;
  timestamp: string;
}
```

### 2. lesson_completion_summary

**Used by**: design_node (end of lesson)

**Purpose**: Show lesson completion UI with analytics

**Args**:
```typescript
{
  summary: string;              // LLM-generated summary
  performance_analysis: {
    overall_accuracy: number;
    retry_recommended: boolean;
    strong_skills: string[];
    weak_skills: string[];
  };
  evidence: Array<{...}>;       // All attempts
  mastery_updates: Array<{...}>;
  lesson_title: string;
  total_cards: number;
  cards_completed: number;
  retry_recommended: boolean;
  timestamp: string;
  session_id: string;
  student_id: string;
  course_id: string;
}
```

---

## Key Design Principles

### 1. Interrupt-Based Flow Control
- **Tool Calls for Data**: Use tool calls to transport data to UI
- **Interrupts for Control**: Use `interrupt({})` to pause and wait
- **Empty Payloads**: Data comes from tool call, not interrupt payload

### 2. Centralized Routing (design_node)
- **Single Decision Point**: All routing decisions in design_node
- **Explicit Stage Management**: Stage field controls flow
- **No Implicit Fallbacks**: Every path is explicitly defined

### 3. LLM Integration
- **Structured Outputs**: Use `with_structured_output()` for evaluation
- **Natural Language**: LLM generates all user-facing text
- **Context-Aware**: Pass full context to LLM for personalized responses

### 4. Evidence-Based Analytics
- **Record Everything**: Every attempt recorded in evidence
- **Mastery Tracking**: Skill scores updated after each card
- **Performance Analysis**: End-of-lesson comprehensive analysis

### 5. Retry with Scaffolding
- **Feedback First**: Always provide feedback before retry
- **Escalating Hints**: Hint level increases with attempts
- **Max Attempts Explanation**: Full explanation after exhausting attempts

---

## Related Documentation

- **Main Graph**: See `MAIN_GRAPH_ARCHITECTURE.md`
- **Interrupt Flow**: See `/docs/interrupt-flow-documentation.md`
- **Frontend Integration**: See `assistant-ui-frontend/components/tools/`
- **LLM Teacher**: See `llm_teacher.py`

---

## Debugging and Logging

### Key Log Patterns

```python
# Node entry/exit
print(f"🔍 NODE_ENTRY: {node_name} | card_idx: {idx} | stage: {stage}")
print(f"🔍 NODE_EXIT: {node_name} | decision: {decision} | next_stage: {next_stage}")

# Interrupt debugging
print(f"🚨 INTERRUPT DEBUG - About to interrupt with empty payload")
print(f"🚨 INTERRUPT DEBUG - Raw response received: {response}")

# State debugging
print(f"🚨 DESIGN DEBUG - State keys available: {list(state.keys())}")
print(f"🚨 DESIGN DEBUG - interrupt_response: {state.get('interrupt_response')}")

# Evaluation debugging
print(f"🚨 MARK DEBUG - Evaluating response: {student_response[:50]}...")
print(f"🚨 MARK DEBUG - Evaluation result: correct={is_correct}")

# Tool call debugging
print(f"🚨 TOOL DEBUG - Created AIMessage with tool call for UI rendering")
print(f"🚨 TOOL DEBUG - Tool call ID: {tool_call_id}")
```

### Common Issues

1. **Empty UI Components**
   - Check: Is `interrupt` not null?
   - Check: Are React hooks called before conditional returns?

2. **Routing Loops**
   - Check: Is `stage` being set correctly?
   - Check: Are conditional edges configured properly?

3. **Missing Data**
   - Check: Does data come from tool call args, not interrupt payload?
   - Check: Is `pending_tool_call_id` set?

4. **Duplicate Messages**
   - Check: Are you wrapping LLM responses in new AIMessage?
   - Check: Is structured output filtered on frontend?

---

## Version History

- **v1.0**: Initial tool call + interrupt pattern
- **Current**: teacher_graph_toolcall_interrupt.py:721
