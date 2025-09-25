# LangGraph State Management Guide

## Table of Contents

1. [Overview](#overview)
2. [State Architecture](#state-architecture)
   - [Unified State Schema](#unified-state-schema)
   - [UnifiedState Fields](#unifiedstate-fields)
   - [InterruptUnifiedState Fields](#interruptunifiedstate-fields)
3. [State Flow Patterns](#state-flow-patterns)
   - [Entry Node Initialization](#1-entry-node-initialization)
   - [Teaching Flow State Updates](#2-teaching-flow-state-updates)
   - [Interrupt Pattern](#3-interrupt-pattern)
4. [State Validation and Error Handling](#state-validation-and-error-handling)
5. [Performance Considerations](#performance-considerations)
6. [Testing State Management](#testing-state-management)
7. [Best Practices](#best-practices)
8. [Conclusion](#conclusion)

## Overview

The Scottish AI Lessons LangGraph agent uses a sophisticated state management system to handle different modes of operation (chat, teaching, course management) and manage interrupt-based user interactions. This guide provides a comprehensive overview of the state schemas, their usage patterns, and important implementation details.

## State Architecture

### Unified State Schema

The system uses a unified state approach that eliminates complex state mapping between the main graph and subgraphs. This allows direct integration and seamless data flow.

#### Core State Hierarchy

```
InterruptUnifiedState (interrupt_state.py:19)
    ↓ inherits from
UnifiedState (shared_state.py:14)
    ↓ uses
TypedDict with total=False
```

### UnifiedState Fields

**File:** `src/agent/shared_state.py:14-58`

The `UnifiedState` contains all core fields used across the application:

#### Main Graph Fields

```python
# Communication and routing (shared_state.py:22-24)
messages: Annotated[list[BaseMessage], add_messages]  # LangGraph message reducer
session_context: Optional[Dict[str, Any]]  # Frontend compatibility
mode: str  # Routing decision: "chat", "teaching", "course_manager"
```

**Usage Example:**
```python
# graph_interrupt.py:144-145
current_mode = state.get("mode", "unknown")
session_context = state.get("session_context")
```

#### Session Management Fields

```python
# Core session data (shared_state.py:27-30)
session_id: str              # Teaching session identifier
student_id: str              # Student identifier
lesson_snapshot: Dict[str, Any]  # Complete lesson data from database
student_response: Optional[str]  # Current student input
```

**Usage Example:**
```python
# graph_interrupt.py:113-126
session_id = session_context.get("session_id", "")
student_id = session_context.get("student_id", "")
course_id = lesson_snapshot.get("courseId", "") if lesson_snapshot else ""
lesson_template_id = lesson_snapshot.get("lessonTemplateId", "") if lesson_snapshot else ""
```

#### Teaching Progression Fields

```python
# Teaching flow control (shared_state.py:33-47)
course_id: str                    # Course identifier
lesson_template_id: str           # Template identifier
current_card_index: int           # Current lesson card position
cards_completed: List[str]        # Completed card IDs
current_card: Optional[Dict[str, Any]]  # Active card data
is_correct: Optional[bool]        # Last answer correctness
should_progress: Optional[bool]   # Deterministic progression decision
feedback: Optional[str]           # Generated feedback message
hint_level: int                   # Current hint level (0-3)
attempts: int                     # Current card attempts
max_attempts: int                 # Maximum attempts before force progression
evidence: List[Dict[str, Any]]    # Performance tracking data
mastery_updates: List[Dict[str, Any]]  # Skill mastery changes
stage: Literal["design", "deliver", "mark", "progress", "done"]  # Teaching flow stage
should_exit: bool                 # Lesson completion flag
```

**Key Usage Patterns:**

1. **Card Navigation** (`teacher_graph_toolcall_interrupt.py:47-48`):
```python
current_index = state.get("current_card_index", 0)
cards = state["lesson_snapshot"].get("cards", [])
```

2. **Evaluation Logic** (`teacher_graph_toolcall_interrupt.py:350-351`):
```python
attempts = state.get("attempts", 0) + 1
max_attempts = state.get("max_attempts", 3)
```

3. **Evidence Tracking** (`teacher_graph_toolcall_interrupt.py:364`):
```python
evidence = state.get("evidence", [])
```

#### Lesson Completion Fields

```python
# Enhanced completion tracking (shared_state.py:50-52)
lesson_summary: Optional[BaseMessage]        # LLM-generated comprehensive summary
performance_analysis: Optional[Dict[str, Any]]  # Detailed performance metrics
retry_recommended: Optional[bool]            # Whether student should retry
```

**Usage Example:**
```python
# teacher_graph_toolcall_interrupt.py:150-157
performance_analysis = _analyze_lesson_performance(evidence)
summary_message = teacher.summarize_completed_lesson_sync_full(
    lesson_snapshot=lesson_snapshot,
    evidence=evidence,
    performance_analysis=performance_analysis
)
```

#### Course Manager Fields

```python
# Course recommendation system (shared_state.py:55-58)
course_recommendation: Optional[Dict[str, Any]]  # Generated course recommendation
recommendation_summary: Optional[Dict[str, Any]]  # Recommendation analytics
validation_results: Optional[Dict[str, Any]]     # Validation results
error: Optional[str]                             # Error message if processing failed
```

**Usage Example:**
```python
# course_manager_graph.py:114-115
return {
    'course_recommendation': recommendation,
    'recommendation_summary': summary
}
```

### InterruptUnifiedState Fields

**File:** `src/agent/interrupt_state.py:19-33`

The `InterruptUnifiedState` extends `UnifiedState` with interrupt-specific functionality:

#### Core Interrupt Management

```python
# Active interrupt handling (interrupt_state.py:26-28)
interrupt_response: Optional[Dict[str, Any]]  # Response from get_answer interrupt
card_presentation_complete: bool              # Whether current card has been presented
tool_response_received: bool                  # Whether Tool UI has responded
```

**Key Usage:**

1. **Interrupt Flow** (`teacher_graph_toolcall_interrupt.py:98-99`):
```python
interrupt_response = state.get("interrupt_response")
if interrupt_response:
    action = interrupt_response.get("action") if isinstance(interrupt_response, dict) else None
```

2. **Router Logic** (`graph_interrupt.py:148`):
```python
if not state.get("tool_response_received", True):
    return {"mode": "teaching", "tool_response_received": True}
```

#### Interaction Tracking

```python
# Session interaction metrics (interrupt_state.py:31-33)
interrupt_count: int                    # Number of interrupts in current session
cards_presented_via_ui: List[str]       # Card IDs presented through interrupts
feedback_interactions_count: int        # Number of feedback presentations
```

**Usage Example:**
```python
# graph_interrupt.py:47-51
interrupt_init = {
    "interrupt_count": state.get("interrupt_count", 0),
    "card_presentation_complete": False,
    "tool_response_received": False,
    "cards_presented_via_ui": state.get("cards_presented_via_ui", []),
    "feedback_interactions_count": state.get("feedback_interactions_count", 0)
}
```

## State Flow Patterns

### 1. Entry Node Initialization

**File:** `src/agent/graph_interrupt.py:27-137`

The entry node processes incoming requests and initializes state based on context:

```python
# Mode detection (graph_interrupt.py:75-77)
if explicit_mode == "course_manager":
    mode = "course_manager"
elif session_context and session_context.get("session_id"):
    mode = "teaching"
else:
    mode = "chat"
```

### 2. Teaching Flow State Updates

**File:** `src/agent/teacher_graph_toolcall_interrupt.py`

#### Design Node State Updates

```python
# Answer processing (teacher_graph_toolcall_interrupt.py:117-126)
return {
    "messages": [answer_message],
    "student_response": student_response,
    "current_card": current_card,
    "current_card_index": current_index,
    "stage": "mark",
    "interrupt_response": None  # Clear after processing
}
```

#### Mark Node State Updates

```python
# Evaluation results (teacher_graph_toolcall_interrupt.py:392-402)
return {
    "is_correct": evaluation.is_correct,
    "should_progress": should_progress,
    "feedback": evaluation.feedback,
    "explanation": explanation_message,
    "attempts": attempts,
    "evidence": evidence,
    "stage": next_stage,
    "student_response": None,  # Clear response
}
```

#### Progress Node State Updates

```python
# Card progression (teacher_graph_toolcall_interrupt.py:613-623)
return {
    "current_card_index": next_card_index,
    "cards_completed": cards_completed,
    "mastery_updates": mastery_updates,
    "stage": "design",
    "student_response": None,
    "is_correct": None,
    "feedback": None,
    "attempts": 0,  # Reset attempts
    "messages": [transition_obj]
}
```

### 3. Interrupt Pattern

The interrupt system uses a two-step pattern:

#### Step 1: Tool Call Creation

```python
# Create tool call for UI (teacher_graph_toolcall_interrupt.py:240-253)
tool_call = ToolCall(
    id=tool_call_id,
    name="lesson_card_presentation",
    args={
        "card_content": current_card.get("cfu", {}).get("stem", ""),
        "card_data": current_card,
        "card_index": current_index,
        # ... additional data
    }
)
```

#### Step 2: Interrupt and Resume

```python
# Interrupt for user input (teacher_graph_toolcall_interrupt.py:286)
response = interrupt({})  # Empty payload - data comes from tool call

# Process response after resume (teacher_graph_toolcall_interrupt.py:325-328)
return {
    "interrupt_response": payload,
    "stage": "design"  # Route back to design node
}
```

## State Validation and Error Handling

### Defensive Programming Patterns

The codebase follows a "no fallback" philosophy for critical state transitions:

```python
# graph_interrupt.py:45 - Comment emphasizes no fallback pattern
# Initialize interrupt-related fields - NO FALLBACK
```

### State Presence Checks

```python
# teacher_graph_toolcall_interrupt.py:142-144
if _is_lesson_complete(state):
    # Handle completion

# teacher_graph_toolcall_interrupt.py:338-343
if not current_card or not student_response:
    return {"stage": "design"}  # Fast fail, no fallback
```

## Performance Considerations

### State Access Patterns

1. **Use .get() with defaults** for optional fields:
```python
attempts = state.get("attempts", 0)  # Safe default
```

2. **Direct access for required fields**:
```python
cards = state["lesson_snapshot"].get("cards", [])  # lesson_snapshot is guaranteed
```

3. **Batch state updates** to minimize graph transitions:
```python
# Return multiple fields in single update
return {
    "current_card": current_card,
    "current_card_index": current_index,
    "stage": "get_answer",
    "pending_tool_call_id": tool_call_id,
    "student_response": None
}
```

### Memory Management

- State fields are cleared after use: `"interrupt_response": None`
- Lists are initialized with defaults: `state.get("evidence", [])`
- Complex objects use shallow copying when needed

## Testing State Management

### Key Test Scenarios

1. **Mode Detection**: Verify correct routing based on session_context
2. **State Persistence**: Ensure state survives graph node transitions
3. **Interrupt Flow**: Test tool call → interrupt → resume → state update
4. **Field Isolation**: Verify teaching fields don't affect chat mode

### Common Debugging Patterns

```python
# State debugging (teacher_graph_toolcall_interrupt.py:92-96)
print(f"🚨 DESIGN DEBUG - State keys available: {list(state.keys())}")
print(f"🚨 DESIGN DEBUG - interrupt_response: {state.get('interrupt_response')}")
print(f"🚨 DESIGN DEBUG - current stage: {state.get('stage')}")
```

## Best Practices

### 1. State Field Naming
- Use descriptive names: `card_presentation_complete` vs `complete`
- Follow patterns: `should_*` for boolean decisions, `current_*` for active items

### 2. State Updates
- Always return dictionaries with explicit field names
- Clear fields after processing to prevent state pollution
- Use atomic updates for related fields

### 3. Error Handling
- Validate required fields before processing
- Use fast-fail patterns instead of fallbacks
- Log state transitions for debugging

### 4. Type Safety
- Leverage TypedDict for field documentation
- Use Optional[] for nullable fields
- Provide type hints for complex nested structures

## Conclusion

The LangGraph state management system provides a robust foundation for complex educational workflows. By understanding these patterns and following the established conventions, developers can extend and maintain the system effectively while ensuring data integrity and performance.

The unified state approach eliminates common integration problems while the interrupt system enables sophisticated user interactions that enhance the learning experience.