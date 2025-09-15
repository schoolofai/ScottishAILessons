#!/usr/bin/env python3
"""Basic integration tests for the main graph without LLM dependencies.

These tests focus on graph structure, routing, and state management without
requiring external API calls or complex mocking.
"""

import pytest
import json
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.checkpoint.memory import InMemorySaver

pytestmark = pytest.mark.anyio


@pytest.fixture
def test_config():
    """Standard test configuration with thread ID"""
    return {"configurable": {"thread_id": "test-thread-123"}}


async def test_main_graph_structure():
    """Test that the production main graph has the correct structure"""
    from agent.graph_interrupt import graph_interrupt

    # Verify nodes
    expected_nodes = ['__start__', 'entry', 'router', 'chat', 'teaching']
    actual_nodes = list(graph_interrupt.nodes.keys())

    assert set(actual_nodes) == set(expected_nodes), f"Node mismatch: {actual_nodes} vs {expected_nodes}"


async def test_chat_mode_basic_flow():
    """Test basic chat conversation flow without external dependencies"""
    from agent.graph_interrupt import main_graph_interrupt

    # Create graph with in-memory checkpointer for isolation
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    config = {"configurable": {"thread_id": "test-chat-basic"}}

    initial_state = {
        "messages": [HumanMessage("Hello")],
        # No session_context = chat mode
    }

    result = await test_graph.ainvoke(initial_state, config)

    # Verify response structure
    assert len(result["messages"]) == 2
    assert isinstance(result["messages"][0], HumanMessage)
    assert isinstance(result["messages"][1], AIMessage)
    assert result["messages"][0].content == "Hello"
    assert "Scottish AI Lessons assistant" in result["messages"][1].content
    assert result["mode"] == "chat"


async def test_entry_node_mode_detection():
    """Test entry node correctly determines mode from session context"""
    from agent.graph_interrupt import entry_node_interrupt

    # Test chat mode (no session context)
    chat_state = {
        "messages": [HumanMessage("Hello")]
    }

    chat_result = await entry_node_interrupt(chat_state)
    assert chat_result["mode"] == "chat"

    # Test teaching mode (with session context)
    teaching_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": {
            "session_id": "test-123",
            "student_id": "student-456",
            "lesson_snapshot": {"title": "Test Lesson"}
        }
    }

    teaching_result = await entry_node_interrupt(teaching_state)
    assert teaching_result["mode"] == "teaching"
    assert teaching_result["session_id"] == "test-123"
    assert teaching_result["student_id"] == "student-456"


async def test_router_node_routing_logic():
    """Test router node routing decisions"""
    from agent.graph_interrupt import router_node_interrupt

    # Test chat routing
    chat_state = {
        "mode": "chat"
    }

    chat_result = await router_node_interrupt(chat_state)
    assert chat_result["mode"] == "chat"

    # Test teaching routing
    teaching_state = {
        "session_context": {"session_id": "test-123"}
    }

    teaching_result = await router_node_interrupt(teaching_state)
    assert teaching_result["mode"] == "teaching"


async def test_interrupt_state_initialization_entry_node():
    """Test that entry node properly initializes interrupt state fields"""
    from agent.graph_interrupt import entry_node_interrupt

    # Test with teaching mode
    teaching_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": {
            "session_id": "test-123",
            "lesson_snapshot": {"title": "Test Lesson"}
        }
    }

    result = await entry_node_interrupt(teaching_state)

    # Verify interrupt fields are initialized
    expected_interrupt_fields = [
        "interrupt_count",
        "interrupt_history",
        "card_presentation_complete",
        "tool_response_received",
        "cards_presented_via_ui",
        "feedback_interactions_count",
        "can_resume_from_interrupt"
    ]

    for field in expected_interrupt_fields:
        assert field in result, f"Missing interrupt field: {field}"

    # Verify initial values
    assert result["interrupt_count"] == 0
    assert result["interrupt_history"] == []
    assert result["card_presentation_complete"] == False
    assert result["tool_response_received"] == False
    assert result["cards_presented_via_ui"] == []
    assert result["feedback_interactions_count"] == 0
    assert result["can_resume_from_interrupt"] == True


async def test_state_persistence_between_invocations():
    """Test state persistence with checkpointing"""
    from agent.graph_interrupt import main_graph_interrupt
    from langgraph.checkpoint.memory import InMemorySaver

    # Create checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    # Config with thread_id only (not checkpointer)
    config = {"configurable": {"thread_id": "test-thread-123"}}

    # First invocation - chat mode
    initial_state = {
        "messages": [HumanMessage("First message")]
    }

    result1 = await test_graph.ainvoke(initial_state, config)
    assert result1["mode"] == "chat"
    assert len(result1["messages"]) == 2

    # Second invocation on same thread - should maintain state
    second_state = {
        "messages": [HumanMessage("Second message")]
    }

    result2 = await test_graph.ainvoke(second_state, config)

    # Verify state continuity
    assert result2["mode"] == "chat"
    assert len(result2["messages"]) == 4  # Previous 2 + new 2


async def test_message_types_and_structure():
    """Test message type handling and structure"""
    from agent.graph_interrupt import chat_node_interrupt

    # Test with different message types
    test_cases = [
        ("hello", "Hello! I'm your Scottish AI Lessons assistant"),
        ("how are you", "I'm functioning well"),
        ("help", "I can help you with mathematics lessons"),
        ("latex test", "Testing LaTeX rendering"),
        ("random input", "I understand you're asking about")
    ]

    for user_input, expected_phrase in test_cases:
        state = {
            "messages": [HumanMessage(user_input)]
        }

        result = await chat_node_interrupt(state)

        assert "messages" in result
        assert len(result["messages"]) == 1
        assert isinstance(result["messages"][0], AIMessage)
        assert expected_phrase in result["messages"][0].content


async def test_empty_messages_handling():
    """Test handling of empty message arrays"""
    from agent.graph_interrupt import chat_node_interrupt

    state = {
        "messages": []
    }

    result = await chat_node_interrupt(state)

    assert "messages" in result
    assert len(result["messages"]) == 1
    assert isinstance(result["messages"][0], AIMessage)
    assert "Hello! I'm ready to help" in result["messages"][0].content


# Removed test_malformed_session_context_handling
# This was testing LangGraph's internal behavior, not our application logic


async def test_lesson_snapshot_json_parsing():
    """Test JSON parsing of lesson_snapshot in session context"""
    from agent.graph_interrupt import entry_node_interrupt

    # Test with JSON string lesson_snapshot
    state_with_json = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": {
            "session_id": "test-123",
            "lesson_snapshot": json.dumps({
                "title": "JSON Lesson",
                "cards": [{"id": "card1", "title": "Card 1"}]
            })
        }
    }

    result = await entry_node_interrupt(state_with_json)

    assert result["mode"] == "teaching"
    assert isinstance(result["lesson_snapshot"], dict)
    assert result["lesson_snapshot"]["title"] == "JSON Lesson"
    assert len(result["lesson_snapshot"]["cards"]) == 1


async def test_routing_conditional_edges():
    """Test the conditional edge routing logic"""
    from agent.graph_interrupt import route_by_mode_interrupt

    # Test chat routing
    chat_state = {"mode": "chat"}
    assert route_by_mode_interrupt(chat_state) == "chat"

    # Test teaching routing
    teaching_state = {"mode": "teaching"}
    assert route_by_mode_interrupt(teaching_state) == "teaching"

    # Test default routing (no mode specified)
    empty_state = {}
    assert route_by_mode_interrupt(empty_state) == "chat"

    # Test unknown mode falls back to chat
    unknown_state = {"mode": "unknown"}
    assert route_by_mode_interrupt(unknown_state) == "chat"


async def test_concurrent_isolated_threads():
    """Test that different thread IDs maintain isolation"""
    from agent.graph_interrupt import main_graph_interrupt
    import asyncio

    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    async def run_chat_session(thread_id: str, message: str):
        state = {"messages": [HumanMessage(message)]}
        config = {"configurable": {"thread_id": thread_id}}
        return await test_graph.ainvoke(state, config)

    # Run multiple concurrent sessions
    tasks = [
        run_chat_session("thread-1", "Hello from thread 1"),
        run_chat_session("thread-2", "Hello from thread 2"),
        run_chat_session("thread-3", "Hello from thread 3")
    ]

    results = await asyncio.gather(*tasks)

    # Verify all completed successfully and maintained isolation
    assert len(results) == 3
    for i, result in enumerate(results):
        assert result["mode"] == "chat"
        assert len(result["messages"]) == 2
        # Each should have processed their specific input
        assert f"thread {i+1}" in result["messages"][0].content


async def test_performance_large_message_history():
    """Test performance with large message history"""
    from agent.graph_interrupt import main_graph_interrupt

    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    config = {"configurable": {"thread_id": "test-performance"}}

    # Create large message history
    large_messages = []
    for i in range(100):
        large_messages.append(HumanMessage(f"Message {i}"))
        large_messages.append(AIMessage(f"Response {i}"))

    # Add new message
    large_messages.append(HumanMessage("Final test message"))

    state = {"messages": large_messages}

    import time
    start_time = time.time()

    result = await test_graph.ainvoke(state, config)

    end_time = time.time()
    execution_time = end_time - start_time

    # Should complete in reasonable time
    assert execution_time < 5.0, f"Large message processing took too long: {execution_time} seconds"
    assert len(result["messages"]) == 202  # 201 + 1 new response
    assert result["mode"] == "chat"