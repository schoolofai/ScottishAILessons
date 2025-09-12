# LangGraph Interrupt Flow Documentation

## Overview

This document explains the step-by-step data flow between the Assistant UI frontend and LangGraph backend using the interrupt-driven architecture. This pattern enables interactive lesson delivery where students answer questions and receive immediate feedback.

## Architecture Components

### Frontend: LessonCardPresentationTool.tsx
- **Framework**: Assistant UI React component using `makeAssistantToolUI`
- **Purpose**: Renders lesson cards and handles student interactions
- **Location**: `assistant-ui-frontend/components/tools/LessonCardPresentationTool.tsx`

### Backend: teacher_graph_toolcall_interrupt.py
- **Framework**: LangGraph StateGraph with interrupt nodes
- **Purpose**: Manages lesson flow and student evaluation
- **Location**: `langgraph-agent/src/agent/teacher_graph_toolcall_interrupt.py`

## Key Hooks and APIs

### Frontend Hooks

#### `useLangGraphInterruptState()`
```typescript
const interrupt = useLangGraphInterruptState();
```
- **Purpose**: Detects when LangGraph backend has triggered an interrupt
- **Returns**: Interrupt object or `null` if no interrupt is active
- **Critical Rule**: UI component should NOT render if `interrupt` is `null`

#### `useLangGraphSendCommand()`
```typescript
const sendCommand = useLangGraphSendCommand();
```
- **Purpose**: Sends commands back to LangGraph to resume execution
- **Usage Pattern**: 
```typescript
sendCommand({
  resume: JSON.stringify({
    action: "submit_answer",
    student_response: "user input",
    // ... additional data
  })
});
```
- **Critical Pattern**: Always wrap payload in `resume` field as JSON string

### Backend Interrupt API

#### `interrupt()` Function
```python
from langgraph.types import interrupt

# Trigger interrupt with empty payload
response = interrupt({})
```
- **Purpose**: Pauses graph execution and waits for frontend response
- **Pattern**: Empty payload `{}` - data comes from tool calls, not interrupt payload

## Complete Data Flow

### Step 1: Lesson Card Presentation (Backend → Frontend)

#### Backend: design_node()
```python
def design_node(state: InterruptUnifiedState) -> Dict:
    # Generate lesson content
    message_obj = _generate_card_message(teacher, lesson_snapshot, current_card, ...)
    
    # Create tool call for UI rendering
    tool_call = ToolCall(
        id="lesson_card_{index}",
        name="lesson_card_presentation",
        args={
            "card_content": "lesson content here",
            "card_data": current_card,
            "card_index": current_index,
            "total_cards": total_count,
            "cfu_type": "mcq" or "text",
            "lesson_context": {...},
            # ... more data
        }
    )
    
    # Create AIMessage with tool call
    tool_message = AIMessage(content="", tool_calls=[tool_call])
    
    return {
        "messages": [message_obj, tool_message],
        "stage": "get_answer",  # Route to interrupt node
        # ... other state updates
    }
```

**Key Points**:
- Tool call contains all lesson data needed by frontend
- `message_obj` provides conversational content
- `tool_message` triggers UI component rendering
- State routes to `get_answer` node for interrupt

### Step 2: Interrupt Trigger (Backend)

#### Backend: get_answer_node()
```python
def get_answer_node(state: InterruptUnifiedState) -> Dict:
    print(f"🔍 NODE_ENTRY: get_answer_node | card_idx: {current_idx}")
    
    # Trigger interrupt with EMPTY payload
    response = interrupt({})
    
    # Process the response from sendCommand
    if isinstance(response, str):
        # LangGraph passes resume value directly as JSON string
        import json
        try:
            payload = json.loads(response)
        except json.JSONDecodeError:
            payload = {"value": response}
    
    # Route based on student action
    action = payload.get("action")
    if action == "submit_answer":
        return {
            "student_response": payload.get("student_response"),
            "stage": "mark"  # Route to evaluation
        }
    elif action == "skip_card":
        return {
            "stage": "progress"  # Skip to next card
        }
```

**Key Points**:
- Interrupt uses empty payload `{}`
- Response handling expects JSON string from `sendCommand`
- Routes to different nodes based on student action

### Step 3: Frontend UI Rendering

#### Frontend: LessonCardPresentationTool Component
```typescript
export const LessonCardPresentationTool = makeAssistantToolUI<
  LessonCardPresentationArgs,
  unknown
>({
  toolName: "lesson_card_presentation",
  render: function LessonCardPresentationUI({ args }) {
    // CRITICAL: Get hooks before any conditional returns
    const interrupt = useLangGraphInterruptState();
    const sendCommand = useLangGraphSendCommand();
    const [studentAnswer, setStudentAnswer] = useState<string>("");
    
    // CHECK: Only render if there's an interrupt
    if (!interrupt) return null;
    
    // DATA: Get from tool call args (NOT from interrupt.value)
    const { card_content, card_data, cfu_type } = args;
    
    // ... render UI components
  }
});
```

**Critical Patterns**:
1. **Hook Order**: All hooks must be called BEFORE any conditional returns
2. **Interrupt Check**: Always check `if (!interrupt) return null`
3. **Data Source**: Get data from `args` (tool call), not `interrupt.value`

### Step 4: Student Response Handling

#### Frontend: Submit Answer Handler
```typescript
const handleSubmitAnswer = () => {
  const finalAnswer = cfu_type === "mcq" ? selectedMCQOption : studentAnswer;
  
  // Send command with resume wrapper
  sendCommand({
    resume: JSON.stringify({
      action: "submit_answer",
      student_response: finalAnswer,
      interaction_type: "answer_submission",
      card_id: card_data.id,
      interaction_id: args.interaction_id,
      timestamp: new Date().toISOString()
    })
  });
};
```

**Critical Patterns**:
- Always wrap payload in `resume` field
- Convert payload to JSON string
- Include action type for backend routing

### Step 5: Response Evaluation (Backend)

#### Backend: mark_node()
```python
def mark_node(state: InterruptUnifiedState) -> Dict:
    student_response = state.get("student_response", "")
    current_card = state.get("current_card")
    
    # Evaluate student response
    evaluation = teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=expected_answer,
        card_context=current_card,
        # ...
    )
    
    # Determine progression
    should_progress = evaluation.is_correct or (attempts >= max_attempts)
    
    return {
        "should_progress": should_progress,
        "is_correct": evaluation.is_correct,
        "feedback": evaluation.feedback,
        "stage": "progress" if should_progress else "design"
    }
```

### Step 6: Graph Routing

#### Conditional Edge Functions
```python
# Named lambda for better trace readability
get_answer_router = lambda state: state.get("stage", "design")

# Routing functions
def should_continue_from_design(state: InterruptUnifiedState) -> str:
    if state.get("should_exit", False):
        return END
    return state.get("stage", "get_answer")

def should_continue_from_mark(state: InterruptUnifiedState) -> str:
    should_progress = state.get("should_progress", False)
    return "progress" if should_progress else "design"

# Graph edge configuration
teaching_graph_toolcall.add_conditional_edges(
    "get_answer",
    get_answer_router,  # Routes based on stage from interrupt
    {
        "mark": "mark",      # When submit_answer received
        "progress": "progress",  # When skip_card received  
        "design": "design"   # Fallback/error case
    }
)
```

## Data Flow Summary

```mermaid
graph TD
    A[design_node] --> B[Create Tool Call]
    B --> C[Send AIMessage + Tool Call]
    C --> D[Frontend: Tool UI Renders]
    D --> E[get_answer_node: interrupt{}]
    E --> F[Frontend: Student Interaction]
    F --> G[sendCommand with resume wrapper]
    G --> H[Backend: Process JSON response]
    H --> I{Student Action?}
    I -->|submit_answer| J[mark_node: Evaluate]
    I -->|skip_card| K[progress_node: Next Card]
    J --> L{Correct/Max Attempts?}
    L -->|Yes| K
    L -->|No| A
    K --> A
```

## Critical Discoveries and Patterns

### 1. Hybrid Data Architecture
- **Tool Calls**: Carry lesson data for UI rendering
- **Interrupts**: Control execution flow, not data transport
- **State**: Manages progression and student responses

### 2. React Hooks Order
```typescript
// ✅ CORRECT: Hooks before conditionals
const interrupt = useLangGraphInterruptState();
const sendCommand = useLangGraphSendCommand();
const [state, setState] = useState();

if (!interrupt) return null;

// ❌ WRONG: Conditional before hooks
if (!interrupt) return null;
const sendCommand = useLangGraphSendCommand(); // Hook order error!
```

### 3. Resume Wrapper Pattern
```typescript
// ✅ CORRECT: Resume wrapper
sendCommand({
  resume: JSON.stringify({ action: "submit", data: "..." })
});

// ❌ WRONG: Direct payload
sendCommand({ action: "submit", data: "..." });
```

### 4. LangGraph Response Handling
```python
# LangGraph passes resume value directly, not wrapped
if isinstance(response, str):
    payload = json.loads(response)  # Direct JSON string
else:
    # Handle unexpected format
    payload = {"value": response}
```

### 5. Empty Interrupt Payload
```python
# ✅ CORRECT: Empty payload, data comes from tool calls
response = interrupt({})

# ❌ AVOID: Putting data in interrupt payload
# response = interrupt({"card_data": current_card})  # Don't do this
```

## Debugging Tips

### Backend Logging
Add these debug logs for troubleshooting:
```python
print(f"🔍 NODE_ENTRY: {node_name} | card_idx: {current_idx}")
print(f"🚨 INTERRUPT DEBUG - Response type: {type(response)}")
print(f"🔍 ROUTING: {function_name} -> {next_stage}")
```

### Frontend Logging
Add these for debugging:
```typescript
console.log('🚨 TOOL UI DEBUG - Interrupt state:', !!interrupt);
console.log('🚨 TOOL UI DEBUG - Submitting:', payload);
```

### Common Issues

1. **Empty UI**: Check if `interrupt` is null
2. **Hook Errors**: Ensure hooks are called before conditionals
3. **Routing Loops**: Verify stage transitions in state
4. **Missing Data**: Check tool call args vs interrupt payload
5. **JSON Errors**: Ensure resume wrapper with JSON.stringify

## Performance Considerations

- **Tool Calls**: Efficient data transport for UI rendering
- **Interrupts**: Minimal overhead with empty payloads
- **State Management**: LangGraph handles persistence automatically
- **Message Streaming**: Frontend receives messages in real-time

This architecture provides a robust, interactive lesson delivery system with clear separation of concerns between data transport (tool calls) and flow control (interrupts).