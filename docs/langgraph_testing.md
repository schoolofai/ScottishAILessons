# LangGraph Integration Testing Guide

## Overview

This document describes our comprehensive approach to testing the LangGraph-based teaching system. We focus on **integration testing** to verify that the actual graph execution, state management, and message flow work correctly while maintaining test predictability through controlled dependencies.

## Testing Philosophy

### What Integration Testing Means

Integration testing for LangGraph means testing the **actual graph execution** with real node transitions, state management, and message flow - but with **controlled inputs and deterministic outputs**. We're NOT mocking the graph itself, but we ARE mocking external dependencies (LLMs, APIs) for predictability.

**Key Principles:**
1. **Real Graph Execution**: Use actual compiled graphs, not mocks
2. **Controlled Dependencies**: Mock only external services (LLMs, APIs)
3. **State Verification**: Check both message flow AND internal state changes
4. **Interrupt Testing**: Verify pause/resume mechanics work correctly
5. **Tool Call Validation**: Ensure UI components are triggered properly
6. **Deterministic Outcomes**: Use fixed responses for reproducible tests

## High-Level Testing Architecture

```ascii
┌─────────────────────────────────────────────────────────────────────┐
│                        Integration Test Suite                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Test Harness                     Production Graph                   │
│  ┌─────────────┐                  ┌─────────────────────┐          │
│  │   pytest    │                  │   graph_interrupt   │          │
│  │             │  ──invoke()───►  │                     │          │
│  │  fixtures   │                  │  ┌──────────────┐  │          │
│  │  + mocks    │                  │  │ entry_node   │  │          │
│  └─────────────┘                  │  └──────┬───────┘  │          │
│        │                          │         ▼          │          │
│        │                          │  ┌──────────────┐  │          │
│   Mock LLM                        │  │ router_node  │  │          │
│  ┌─────────────┐                  │  └──────┬───────┘  │          │
│  │ Deterministic│ ◄──LLM calls────│         ▼          │          │
│  │  Responses  │                  │  ┌──────────────┐  │          │
│  └─────────────┘                  │  │   teaching   │  │          │
│                                   │  │   subgraph   │  │          │
│   Assertions                      │  └──────────────┘  │          │
│  ┌─────────────┐                  └─────────────────────┘          │
│  │ - State     │                           │                        │
│  │ - Messages  │ ◄─────result──────────────┘                        │
│  │ - Tool calls│                                                    │
│  └─────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Production Graphs Under Test

Our MVP0 system uses two main graphs specified in `langgraph.json`:

1. **Main Graph**: `graph_interrupt.py` → `graph_interrupt`
2. **Teaching Subgraph**: `teacher_graph_toolcall_interrupt.py` → `compiled_teaching_graph_toolcall`

## Message Flow Testing Approach

### 1. Chat Mode Flow Test

```ascii
Test Input                Graph Execution              Expected Output
───────────              ─────────────────            ────────────────

HumanMessage     ──►    ┌─────────────┐
"Hello"                 │ entry_node  │
                        └──────┬──────┘
                               │ mode="chat"
                        ┌──────▼──────┐
                        │router_node  │
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐              AIMessage
                        │ chat_node   │     ──►      "Hello! How can
                        │ (mock LLM)  │              I help you?"
                        └─────────────┘

Assert: messages[-1].content == expected_response
Assert: state["mode"] == "chat"
```

### 2. Teaching Mode with Interrupts Flow Test

```ascii
Test Input                     Graph Execution                    Expected Output
───────────                   ─────────────────                  ────────────────

Initial State:           ┌─────────────────┐
session_context ────►    │   entry_node    │
                        └────────┬────────┘
                                 │ mode="teaching"
                        ┌────────▼────────┐
                        │  router_node    │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │teaching subgraph│
                        │                 │
                        │ ┌─────────────┐ │
                        │ │design_node  │ │──► AIMessage with tool_calls
                        │ └──────┬──────┘ │    [LessonCardPresentationTool]
                        │        │        │
                        │     interrupt() │──► State: interrupt_count=1
                        │        │        │
                        │ ┌──────▼──────┐ │
                        │ │ get_answer  │ │
                        │ │   (waits)   │ │
                        │ └─────────────┘ │
                        └─────────────────┘

Resume with:            ┌─────────────────┐
student_answer ─────►   │ get_answer      │
                        │ (continues)     │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   mark_node     │──► AIMessage with tool_calls
                        └────────┬────────┘    [FeedbackPresentationTool]
                                 │
                        ┌────────▼────────┐
                        │ progress_node   │──► Final state update
                        └─────────────────┘

Assert: tool_calls[0].name == "LessonCardPresentationTool"
Assert: state["interrupt_count"] == 1
Assert: state["lesson_progress"]["current_stage"] == "completed"
```

## Testing Strategy Layers

```ascii
┌──────────────────────────────────────────────────────────┐
│                    E2E Tests (Few)                        │
│  Full API → Graph → Response with real dependencies       │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│             Integration Tests (Main Focus)                │
│  Graph execution with mocked LLMs and external services   │
│  ┌────────────┐ ┌────────────┐ ┌───────────────┐       │
│  │Graph Flow  │ │State Mgmt  │ │Tool Generation│       │
│  │  Tests     │ │  Tests     │ │    Tests      │       │
│  └────────────┘ └────────────┘ └───────────────┘       │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  Unit Tests (Many)                        │
│  Individual node functions, utilities, validators         │
└──────────────────────────────────────────────────────────┘
```

## Test Execution Flow

```ascii
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│   pytest     │────►│  Test Case    │────►│  Compiled    │
│              │     │               │     │   Graph      │
└──────────────┘     └───────┬───────┘     └──────┬───────┘
                             │                     │
                      invoke(state)          execute nodes
                             │                     │
                             ▼                     ▼
                     ┌───────────────┐     ┌──────────────┐
                     │  Mock LLM     │◄────│   Node       │
                     │  Responses    │     │  Execution   │
                     └───────────────┘     └──────┬───────┘
                                                   │
                                            return state
                                                   │
                     ┌───────────────┐            ▼
                     │  Assertions   │◄────────(result)
                     │  - messages   │
                     │  - state      │
                     │  - tool calls │
                     └───────────────┘
```

## Code Examples

### Basic Integration Test Structure

```python
# tests/integration_tests/test_graph_interrupt_integration.py

import pytest
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from agent.graph_interrupt import graph_interrupt

@pytest.fixture
def mock_llm(mocker):
    """Mock LLM for deterministic responses"""
    mock = mocker.patch('agent.graph_interrupt.llm')
    mock.invoke.return_value = AIMessage(
        content="Hello! I'm here to help.",
        id="test-msg-1"
    )
    return mock

@pytest.fixture
def test_graph():
    """Create graph with in-memory checkpointer"""
    checkpointer = MemorySaver()
    return graph_interrupt.with_config(
        configurable={"checkpoint": checkpointer}
    )

async def test_chat_mode_flow(test_graph, mock_llm):
    """Test basic chat conversation flow"""

    initial_state = {
        "messages": [HumanMessage("Hello")],
        # No session_context = chat mode
    }

    result = await test_graph.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": "test-thread"}}
    )

    # Verify response
    assert len(result["messages"]) == 2
    assert result["messages"][-1].content == "Hello! I'm here to help."
    assert result["mode"] == "chat"
```

### Teaching Flow with Interrupts

```python
async def test_teaching_flow_with_interrupts(test_graph, mock_llm):
    """Test complete teaching flow with interrupts"""

    # Mock LLM to return tool calls for lesson design
    mock_llm.invoke.return_value = AIMessage(
        content="",
        tool_calls=[{
            "id": "lesson-123",
            "name": "LessonCardPresentationTool",
            "args": {
                "lessonData": {
                    "title": "Introduction to Algebra",
                    "content": "Today we'll learn about variables..."
                }
            }
        }]
    )

    # Initial state with session context
    initial_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": {
            "session_id": "test-123",
            "lesson_snapshot": {
                "currentStage": "introduction",
                "lessonPlan": {
                    "title": "Introduction to Algebra",
                    "objectives": ["Understand variables"]
                }
            }
        }
    }

    # Execute graph until first interrupt
    result1 = await test_graph.ainvoke(
        initial_state,
        config={"configurable": {"thread_id": "test-thread"}}
    )

    # Verify tool call was generated
    assert len(result1["messages"]) > 0
    last_msg = result1["messages"][-1]
    assert hasattr(last_msg, "tool_calls")
    assert last_msg.tool_calls[0]["name"] == "LessonCardPresentationTool"

    # Verify interrupt state
    assert result1["interrupt_count"] == 1
    assert result1["can_resume_from_interrupt"] == True

    # Resume with student answer
    resume_state = {
        "messages": [HumanMessage("x = 5")],
        "resume": json.dumps({"student_answer": "x = 5"})
    }

    result2 = await test_graph.ainvoke(
        resume_state,
        config={"configurable": {"thread_id": "test-thread"}}
    )

    # Verify feedback was generated
    assert result2["messages"][-1].tool_calls[0]["name"] == "FeedbackPresentationTool"
    assert result2["lesson_progress"]["current_stage"] == "completed"
```

## Test Categories

### 1. Graph Structure Tests
- Verify correct nodes exist in production graphs
- Check edge connections and routing logic
- Validate state schema compatibility

### 2. Message Flow Tests
- Test message propagation through graph
- Verify tool call message structure
- Check interrupt message handling

### 3. State Management Tests
- Test checkpoint creation and restoration
- Verify state persistence across interrupts
- Check state transitions between nodes

### 4. Interrupt Pattern Tests
- Test pause/resume mechanics
- Verify interrupt state tracking
- Check resume data processing

### 5. Tool Call Generation Tests
- Verify UI component tool calls are created
- Check tool call argument structure
- Test different tool types (LessonCard, Feedback, etc.)

### 6. End-to-End Scenario Tests
- Complete user journeys from API to graph
- Multi-interrupt lesson flows
- Error recovery scenarios

## Test Infrastructure

### Mock LLM Setup
```python
# tests/mocks/llm_mocks.py

class MockChatLLM:
    """Mock LLM for chat responses"""

    def __init__(self, responses):
        self.responses = responses
        self.call_count = 0

    def invoke(self, messages, **kwargs):
        response = self.responses[self.call_count % len(self.responses)]
        self.call_count += 1
        return AIMessage(content=response)

class MockTeachingLLM:
    """Mock LLM for teaching with tool calls"""

    def invoke(self, messages, **kwargs):
        # Return appropriate tool calls based on context
        if "design lesson" in str(messages):
            return AIMessage(
                content="",
                tool_calls=[{
                    "name": "LessonCardPresentationTool",
                    "args": {"lessonData": {...}}
                }]
            )
        # ... more conditional responses
```

### Test Fixtures
```python
# tests/fixtures/graph_fixtures.py

@pytest.fixture
def sample_session_context():
    return {
        "session_id": "test-session-123",
        "lesson_snapshot": {
            "currentStage": "introduction",
            "lessonPlan": {
                "title": "Test Lesson",
                "objectives": ["Learn variables"]
            }
        }
    }

@pytest.fixture
def expected_lesson_tool_call():
    return {
        "name": "LessonCardPresentationTool",
        "args": {
            "lessonData": {
                "title": "Test Lesson",
                "content": "Today we'll learn..."
            }
        }
    }
```

## Running Tests

```bash
# Run all integration tests
pytest tests/integration_tests/ -v

# Run specific test category
pytest tests/integration_tests/test_graph_interrupt_integration.py -v

# Run with coverage
pytest tests/integration_tests/ --cov=src/agent --cov-report=html

# Run async tests
pytest tests/integration_tests/ -v --asyncio-mode=auto
```

## Best Practices

### 1. Test Isolation
- Use fresh graph instances for each test
- Use MemorySaver for isolated checkpointing
- Reset mock state between tests

### 2. Deterministic Testing
- Mock all external API calls
- Use fixed timestamps and IDs
- Provide predictable LLM responses

### 3. Comprehensive Coverage
- Test both happy path and error scenarios
- Verify all node transitions
- Check edge cases in state management

### 4. Performance Considerations
- Keep tests fast (< 30 seconds total)
- Use async fixtures for concurrent testing
- Mock expensive operations

### 5. Debugging Support
- Add debug logging for test failures
- Provide clear assertion messages
- Include state dumps for complex failures

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure `tests/conftest.py` sets up proper paths
2. **Async Test Failures**: Use `pytest-asyncio` plugin
3. **Mock Not Working**: Check import paths match graph imports
4. **State Assertion Failures**: Verify state schema matches graph expectations
5. **Timeout Issues**: Increase test timeouts for complex graphs

### Debug Helpers

```python
def debug_graph_state(state):
    """Helper to debug graph state during tests"""
    print(f"Messages: {len(state.get('messages', []))}")
    print(f"Mode: {state.get('mode')}")
    print(f"Interrupt count: {state.get('interrupt_count')}")
    print(f"Tool calls: {[msg.tool_calls for msg in state.get('messages', []) if hasattr(msg, 'tool_calls')]}")

def assert_tool_call_structure(message, expected_name):
    """Helper to validate tool call structure"""
    assert hasattr(message, "tool_calls"), "Message should have tool_calls"
    assert len(message.tool_calls) > 0, "Should have at least one tool call"
    assert message.tool_calls[0]["name"] == expected_name, f"Expected {expected_name} tool call"
```

This testing approach ensures we maintain confidence in our LangGraph implementation while supporting rapid development and reliable deployment.