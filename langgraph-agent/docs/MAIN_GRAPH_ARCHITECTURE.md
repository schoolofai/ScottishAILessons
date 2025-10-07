# Main Graph Architecture (graph_interrupt.py)

## Overview

The main graph (`graph_interrupt.py`) is the **entry point** for all user interactions in the Scottish AI Lessons system. It acts as a **router** that determines whether a user interaction should be handled as:

1. **Chat Mode** - General conversational interactions
2. **Teaching Mode** - Interactive lesson delivery with student assessment
3. **Course Manager Mode** - Course and student management operations

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND REQUEST                          │
│  (Assistant-UI sends message with optional session_context)   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     MAIN GRAPH ENTRY                          │
│                  (graph_interrupt.py)                         │
│                                                               │
│  ┌─────────┐      ┌────────┐      ┌──────────────────┐      │
│  │ Entry   │─────▶│ Router │─────▶│ Mode Decision    │      │
│  │ Node    │      │ Node   │      │                  │      │
│  └─────────┘      └────────┘      └──────┬───────────┘      │
│                                           │                   │
│                          ┌────────────────┼────────────────┐ │
│                          │                │                │ │
│                          ▼                ▼                ▼ │
│                   ┌──────────┐   ┌──────────┐   ┌──────────┐│
│                   │   Chat   │   │ Teaching │   │  Course  ││
│                   │   Node   │   │ Subgraph │   │ Manager  ││
│                   └──────────┘   └──────────┘   └──────────┘│
└──────────────────────────────────────────────────────────────┘
```

## Node-by-Node Flow

### 1. Entry Node (`entry_node_interrupt`)

**Purpose**: Receives initial request and extracts context to determine routing mode.

**Input State**:
```python
{
    "messages": List[BaseMessage],        # Chat history
    "session_context": Optional[Dict]     # Contains routing hints
}
```

**Processing Logic**:
```
┌─────────────────────────────────────────────────────────┐
│ 1. Extract session_context from state                   │
│ 2. Check for explicit mode in session_context.mode      │
│ 3. Determine mode based on context content:             │
│                                                          │
│    IF session_context.mode == "course_manager":         │
│       └─▶ MODE = "course_manager"                       │
│                                                          │
│    ELIF session_context.session_id exists:              │
│       └─▶ MODE = "teaching"                             │
│       └─▶ Extract teaching fields:                      │
│           • session_id                                   │
│           • student_id                                   │
│           • course_id (from lesson_snapshot.courseId)   │
│           • lesson_template_id                          │
│           • lesson_snapshot (parsed JSON)               │
│           • student_response (from last HumanMessage)   │
│       └─▶ Initialize teaching state:                    │
│           • current_stage = "design"                    │
│           • current_card_index = 0                      │
│           • attempts = 0                                │
│           • max_attempts = 3                            │
│           • evidence = []                               │
│           • cards_completed = []                        │
│                                                          │
│    ELSE:                                                 │
│       └─▶ MODE = "chat" (default)                       │
└─────────────────────────────────────────────────────────┘
```

**Output State**:
```python
# For Teaching Mode:
{
    "mode": "teaching",
    "session_context": {...},           # Original context preserved
    "session_id": str,
    "student_id": str,
    "course_id": str,                   # From lesson_snapshot.courseId
    "lesson_template_id": str,
    "lesson_snapshot": dict,            # Parsed lesson structure
    "student_response": Optional[str],
    # Teaching progression fields
    "current_stage": "design",
    "current_card_index": 0,
    "attempts": 0,
    "max_attempts": 3,
    "evidence": [],
    "cards_completed": [],
    "hint_level": 0,
    "is_correct": None,
    "should_progress": None,
    "feedback": None,
    "mastery_updates": [],
    "should_exit": False,
    # Interrupt tracking fields
    "interrupt_count": 0,
    "card_presentation_complete": False,
    "tool_response_received": False,
    "cards_presented_via_ui": [],
    "feedback_interactions_count": 0
}

# For Course Manager Mode:
{
    "mode": "course_manager",
    "session_context": {...},
    "interrupt_count": 0,
    "tool_response_received": True,     # Prevents router override
    "cards_presented_via_ui": [],
    "feedback_interactions_count": 0
}

# For Chat Mode:
{
    "mode": "chat",
    "session_context": {...},
    "interrupt_count": 0,
    "card_presentation_complete": False,
    "tool_response_received": False,
    "cards_presented_via_ui": [],
    "feedback_interactions_count": 0
}
```

**Key Implementation Details** (graph_interrupt.py:27-144):
- **No Fallback Pattern**: Mode determination is explicit and raises clear errors
- **Context Extraction**: Teaching mode extracts `course_id` from `lesson_snapshot.courseId`
- **State Initialization**: Teaching mode initializes all required fields for the teaching subgraph

---

### 2. Router Node (`router_node_interrupt`)

**Purpose**: Validates mode and ensures consistent routing (with minimal fallback logic).

**Input State**:
```python
{
    "mode": str,                        # Set by entry_node
    "session_context": Optional[Dict],
    "tool_response_received": bool      # For interrupt handling
}
```

**Processing Logic**:
```
┌─────────────────────────────────────────────────────────┐
│ 1. Read current_mode from state                         │
│ 2. Check tool_response_received flag                    │
│                                                          │
│    IF tool_response_received == False:                  │
│       └─▶ ROUTE TO: teaching (pending tool response)    │
│                                                          │
│ 3. Validate mode with fallback logging:                 │
│                                                          │
│    IF mode == "course_manager":                         │
│       └─▶ KEEP: course_manager                          │
│                                                          │
│    ELIF mode == "teaching":                             │
│       └─▶ KEEP: teaching                                │
│                                                          │
│    ELIF mode == "chat":                                 │
│       └─▶ KEEP: chat                                    │
│                                                          │
│    ELSE (unknown mode - should never happen):           │
│       └─▶ LOG WARNING                                   │
│       └─▶ Apply legacy fallback logic with logging     │
└─────────────────────────────────────────────────────────┘
```

**Output State**:
```python
{
    "mode": str  # Validated mode for routing
}
```

**Key Implementation Details** (graph_interrupt.py:147-187):
- **Tool Response Handling**: Checks for pending tool responses from interrupt system
- **Extensive Logging**: Every routing decision is logged for debugging
- **Legacy Fallback**: Minimal fallback exists only for backward compatibility

---

### 3. Route Function (`route_by_mode_interrupt`)

**Purpose**: Conditional edge function that directs flow to appropriate handler.

**Input State**:
```python
{
    "mode": str  # "chat", "teaching", or "course_manager"
}
```

**Routing Decision**:
```
┌─────────────────────────────────────────────────────────┐
│ Read state.mode:                                         │
│                                                          │
│ IF mode == "teaching":                                  │
│    └─▶ ROUTE TO: "teaching" (Teaching Subgraph)        │
│                                                          │
│ ELIF mode == "course_manager":                          │
│    └─▶ ROUTE TO: "course_manager" (Course Mgr Subgraph)│
│                                                          │
│ ELSE:                                                    │
│    └─▶ ROUTE TO: "chat" (Chat Node - default)          │
└─────────────────────────────────────────────────────────┘
```

**Key Implementation Details** (graph_interrupt.py:236-250):
- **Simple Switch**: Direct string matching with extensive logging
- **Default to Chat**: Unknown modes default to chat for safety

---

### 4. Chat Node (`chat_node_interrupt`)

**Purpose**: Handles general conversational interactions (non-lesson, non-management).

**Input State**:
```python
{
    "messages": List[BaseMessage]
}
```

**Processing Logic**:
```
┌─────────────────────────────────────────────────────────┐
│ 1. Extract last message from state.messages             │
│ 2. Parse user input from message.content                │
│ 3. Generate response based on keywords:                 │
│                                                          │
│    IF "latex" OR "test" in input:                       │
│       └─▶ Return LaTeX test examples                    │
│                                                          │
│    ELIF "hello" OR "hi" in input:                       │
│       └─▶ Return greeting                               │
│                                                          │
│    ELIF "how are you" in input:                         │
│       └─▶ Return status message                         │
│                                                          │
│    ELIF "help" in input:                                │
│       └─▶ Return help message                           │
│                                                          │
│    ELSE:                                                 │
│       └─▶ Return generic acknowledgment                 │
│                                                          │
│ 4. Wrap response in AIMessage                           │
└─────────────────────────────────────────────────────────┘
```

**Output State**:
```python
{
    "messages": [AIMessage(content=response)]
}
```

**Key Implementation Details** (graph_interrupt.py:190-232):
- **Simple Response Logic**: Keyword-based responses (can be replaced with LLM)
- **LaTeX Support**: Demonstrates math rendering capabilities
- **Terminal Node**: Chat node is a terminal node (no further routing)

---

## Graph Construction

### Node Registration
```python
main_graph_interrupt = StateGraph(InterruptUnifiedState)

# Core routing nodes
main_graph_interrupt.add_node("entry", entry_node_interrupt)
main_graph_interrupt.add_node("router", router_node_interrupt)
main_graph_interrupt.add_node("chat", chat_node_interrupt)

# Subgraph nodes (compiled graphs from other modules)
main_graph_interrupt.add_node("teaching", teaching_subgraph_interrupt)
main_graph_interrupt.add_node("course_manager", course_manager_subgraph)
```

### Edge Configuration
```python
# Linear entry → router flow
main_graph_interrupt.add_edge("__start__", "entry")
main_graph_interrupt.add_edge("entry", "router")

# Conditional routing from router
main_graph_interrupt.add_conditional_edges(
    "router",
    route_by_mode_interrupt,
    {
        "chat": "chat",
        "teaching": "teaching",
        "course_manager": "course_manager"
    }
)
```

### Compilation
```python
# Checkpointing is implicit in dev mode (stored in .langraph_api)
graph_interrupt = main_graph_interrupt.compile()
```

---

## Complete Flow Diagram

```
                                  START
                                    │
                                    ▼
                          ┌─────────────────┐
                          │   ENTRY NODE    │
                          │                 │
                          │ • Extract ctx   │
                          │ • Determine mode│
                          │ • Init fields   │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  ROUTER NODE    │
                          │                 │
                          │ • Validate mode │
                          │ • Check pending │
                          │ • Log decision  │
                          └────────┬────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼                ▼                ▼
         ┌────────────┐   ┌────────────┐   ┌────────────┐
         │    CHAT    │   │  TEACHING  │   │   COURSE   │
         │    NODE    │   │  SUBGRAPH  │   │  MANAGER   │
         │            │   │            │   │  SUBGRAPH  │
         │ • Keyword  │   │ • Design   │   │ • Manage   │
         │   response │   │ • Present  │   │   courses  │
         │ • Generate │   │ • Mark     │   │ • Manage   │
         │   message  │   │ • Progress │   │   students │
         └────────────┘   └────────────┘   └────────────┘
                 │                │                │
                 └────────────────┴────────────────┘
                                   │
                                   ▼
                                  END
```

---

## State Schema

### InterruptUnifiedState

The main graph uses `InterruptUnifiedState` which extends the base teaching state with interrupt-specific fields.

**Core Fields**:
```python
{
    # Routing and context
    "messages": List[BaseMessage],
    "session_context": Optional[Dict],
    "mode": str,  # "chat", "teaching", "course_manager"

    # Teaching session fields
    "session_id": str,
    "student_id": str,
    "course_id": str,
    "lesson_template_id": str,
    "lesson_snapshot": dict,
    "student_response": Optional[str],

    # Teaching progression
    "current_stage": str,
    "current_card_index": int,
    "current_card": Optional[dict],
    "attempts": int,
    "max_attempts": int,
    "evidence": List[dict],
    "cards_completed": List[str],
    "hint_level": int,
    "is_correct": Optional[bool],
    "should_progress": Optional[bool],
    "feedback": Optional[str],
    "mastery_updates": List[dict],
    "should_exit": bool,

    # Interrupt tracking
    "interrupt_count": int,
    "interrupt_response": Optional[dict],
    "card_presentation_complete": bool,
    "tool_response_received": bool,
    "cards_presented_via_ui": List[str],
    "feedback_interactions_count": int,
    "pending_tool_call_id": Optional[str]
}
```

---

## Interaction Patterns

### Pattern 1: Chat Interaction
```
User sends: "Hello"
    │
    ▼
Entry Node: mode="chat", session_context=None
    │
    ▼
Router Node: validates mode="chat"
    │
    ▼
Chat Node: returns AIMessage("Hello! I'm your assistant...")
    │
    ▼
Frontend displays response
```

### Pattern 2: Teaching Session Start
```
User clicks "Start Lesson"
    │
    ▼
Frontend sends:
{
    "messages": [],
    "session_context": {
        "session_id": "sess_123",
        "student_id": "stu_456",
        "lesson_snapshot": {
            "courseId": "course_789",
            "lessonTemplateId": "template_abc",
            "title": "Fractions",
            "cards": [...]
        }
    }
}
    │
    ▼
Entry Node:
  • mode="teaching"
  • Extracts: session_id, student_id, course_id, lesson_snapshot
  • Initializes: current_card_index=0, stage="design", attempts=0
    │
    ▼
Router Node: validates mode="teaching"
    │
    ▼
Teaching Subgraph: (see TEACHING_GRAPH_ARCHITECTURE.md)
  • design_node creates first card presentation
  • get_answer_node interrupts for student input
  • mark_node evaluates response
  • progress_node advances to next card
    │
    ▼
Frontend receives:
  • AIMessage with tool call for UI rendering
  • Interrupt for user input
  • Feedback messages
  • Progress updates
```

### Pattern 3: Course Manager Operation
```
User clicks "View Student Progress"
    │
    ▼
Frontend sends:
{
    "messages": [],
    "session_context": {
        "mode": "course_manager",
        "course": {"courseId": "course_123"},
        "student": {"$id": "stu_456"}
    }
}
    │
    ▼
Entry Node:
  • mode="course_manager"
  • Preserves session_context
  • Sets tool_response_received=True (prevents router override)
    │
    ▼
Router Node: validates mode="course_manager"
    │
    ▼
Course Manager Subgraph:
  • Queries student performance data
  • Returns progress summary
    │
    ▼
Frontend displays progress dashboard
```

---

## Error Handling

### Mode Determination Failures
- **Invalid Session Context**: Defaults to chat mode with logging
- **Missing Required Fields**: Logs warning and attempts to extract what's available
- **JSON Parse Errors**: Catches exceptions and logs detailed error information

### Routing Failures
- **Unknown Mode**: Falls back to chat mode with extensive logging
- **Missing Subgraph**: Would raise exception (graph construction error)

### State Validation
- **No explicit validation**: LangGraph's type system enforces schema
- **Logging**: Extensive logging at every node for debugging

---

## Key Design Principles

### 1. Explicit Mode Determination
- Mode is determined **once** in entry_node
- Router validates but does not change mode
- No silent fallbacks (unless legacy compatibility required)

### 2. State Initialization
- Teaching mode initializes **all required fields** in entry_node
- No fields left undefined for subgraphs to fill
- Clear separation between routing fields and teaching fields

### 3. Context Preservation
- Original `session_context` preserved throughout
- Individual fields extracted for subgraph consumption
- Frontend compatibility maintained

### 4. Subgraph Integration
- Subgraphs are compiled graphs, not wrapper functions
- Direct node addition to main graph
- State schema compatibility enables seamless integration

### 5. Interrupt Support
- Interrupt tracking fields initialized in entry_node
- Tool call system for UI component rendering
- Interrupt pattern for human-in-the-loop interactions

---

## Configuration and Deployment

### LangGraph Configuration (langgraph.json)
```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent/graph_interrupt.py:graph_interrupt"
  },
  "env": ".env",
  "platform": {
    "enabled": true,
    "checkpointer": "postgres"
  }
}
```

### Checkpointing
- **Dev Mode**: Automatic checkpointing in `.langraph_api` directory
- **Production**: PostgreSQL checkpointer for state persistence
- **Thread Management**: Each session gets unique thread_id for state isolation

---

## Logging and Debugging

### Log Levels
- **INFO**: Normal flow and routing decisions
- **WARNING**: Unexpected conditions or fallback usage
- **ERROR**: Actual failures requiring attention

### Key Log Messages
```python
# Entry node
logger.info("=== ENTRY NODE INTERRUPT START ===")
logger.info(f"Entry node received state keys: {list(state.keys())}")
logger.info("🎓 TEACHING MODE DETECTED (has session_id)")
logger.info("🎯 COURSE MANAGER MODE DETECTED")
logger.info("💬 CHAT MODE DETECTED (default)")

# Router node
logger.info("=== ROUTER NODE INTERRUPT START ===")
logger.info(f"Current mode from state: {current_mode}")
logger.info("✅ ROUTER: Keeping teaching mode")
logger.warning(f"⚠️ ROUTER: Unknown mode '{current_mode}'")

# Route function
logger.info(f"=== ROUTE_BY_MODE_INTERRUPT FUNCTION ===")
logger.info("🎓 ROUTING TO: teaching")
```

---

## Related Documentation

- **Teaching Subgraph**: See `TEACHING_GRAPH_ARCHITECTURE.md`
- **Interrupt Flow**: See `/docs/interrupt-flow-documentation.md`
- **State Schema**: See `interrupt_state.py`
- **Frontend Integration**: See `assistant-ui-frontend/lib/chatApi.ts`

---

## Version History

- **v1.0**: Initial interrupt-enabled graph with course manager support
- **Current**: graph_interrupt.py:300 (see file for latest changes)
