#!/usr/bin/env python3
"""Integration tests for the production graph_interrupt.py

Tests the actual graph execution with real node transitions, state management,
and message flow while maintaining test predictability through controlled dependencies.
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


async def test_graph_structure():
    """Test that the production graph has the correct structure"""
    from agent.graph_interrupt import graph_interrupt

    # Verify nodes
    expected_nodes = ['__start__', 'entry', 'router', 'chat', 'teaching']
    actual_nodes = list(graph_interrupt.nodes.keys())

    assert set(actual_nodes) == set(expected_nodes), f"Node mismatch: {actual_nodes} vs {expected_nodes}"


async def test_chat_mode_flow(test_config):
    """Test basic chat conversation flow"""
    from agent.graph_interrupt import main_graph_interrupt

    # Create graph with in-memory checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    initial_state = {
        "messages": [HumanMessage("Hello")],
        # No session_context = chat mode
    }

    result = await test_graph.ainvoke(initial_state, config=test_config)

    # Verify response
    assert len(result["messages"]) == 2
    assert isinstance(result["messages"][1], AIMessage)
    assert "Scottish AI Lessons assistant" in result["messages"][1].content
    assert result["mode"] == "chat"


async def test_teaching_mode_entry_with_session_context(sample_session_context):
    """Test that session context properly triggers teaching mode (entry node only)"""
    from agent.graph_interrupt import entry_node_interrupt

    initial_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": sample_session_context
    }

    # Test just the entry node to avoid LLM dependencies
    result = await entry_node_interrupt(initial_state)

    # Verify mode is set correctly
    assert result["mode"] == "teaching"
    assert result["session_id"] == "test-session-123"
    assert result["student_id"] == "test-student-456"
    assert result["lesson_snapshot"]["title"] == "Test Lesson"


async def test_teaching_mode_routing_logic():
    """Test routing logic for teaching mode (router node only)"""
    from agent.graph_interrupt import router_node_interrupt

    # Test teaching routing with session context
    teaching_state = {
        "session_context": {"session_id": "test-123"},
        "mode": "teaching"
    }

    result = await router_node_interrupt(teaching_state)

    # Verify routing decision
    assert result["mode"] == "teaching"


async def test_state_persistence_across_invocations():
    """Test that state is properly persisted between graph invocations (chat mode only)"""
    from agent.graph_interrupt import main_graph_interrupt

    # Create graph with in-memory checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    config = {"configurable": {"thread_id": "test-persistence"}}

    # First invocation - chat mode only to avoid LLM dependencies
    initial_state = {
        "messages": [HumanMessage("First message")]
        # No session_context = chat mode
    }

    result1 = await test_graph.ainvoke(initial_state, config=config)

    # Second invocation should maintain state
    second_state = {
        "messages": [HumanMessage("Second message")]
    }

    result2 = await test_graph.ainvoke(second_state, config=config)

    # Verify state continuity in chat mode
    assert result2["mode"] == "chat"  # Mode should persist
    assert len(result2["messages"]) == 4  # Should have all messages from both invocations


async def test_message_flow_through_nodes():
    """Test message propagation through the graph nodes (chat mode only)"""
    from agent.graph_interrupt import main_graph_interrupt

    # Create graph with in-memory checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    # Test chat flow only to avoid LLM dependencies
    chat_state = {
        "messages": [HumanMessage("Hello test")]
    }

    chat_result = await test_graph.ainvoke(
        chat_state,
        config={"configurable": {"thread_id": "chat-test"}}
    )

    # Verify message structure
    assert len(chat_result["messages"]) == 2
    assert isinstance(chat_result["messages"][0], HumanMessage)
    assert isinstance(chat_result["messages"][1], AIMessage)
    assert chat_result["messages"][0].content == "Hello test"


async def test_interrupt_state_initialization(sample_session_context):
    """Test that interrupt-related state fields are properly initialized (entry node only)"""
    from agent.graph_interrupt import entry_node_interrupt

    initial_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": sample_session_context
    }

    # Test just the entry node to avoid LLM dependencies
    result = await entry_node_interrupt(initial_state)

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


async def test_error_handling_invalid_session_context():
    """Test error handling with malformed session context (entry node only)"""
    from agent.graph_interrupt import entry_node_interrupt

    # Test with invalid session context
    invalid_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": "invalid_json_string"
    }

    # Should not crash, should fall back to chat mode
    result = await entry_node_interrupt(invalid_state)

    # Should default to chat mode when session context is invalid
    assert result["mode"] == "chat"


async def test_routing_logic_accuracy():
    """Test that routing correctly directs to chat vs teaching modes (chat mode only)"""
    from agent.graph_interrupt import main_graph_interrupt

    # Create graph with in-memory checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    # Test chat routing only to avoid LLM dependencies
    chat_state = {"messages": [HumanMessage("Hello")]}
    chat_result = await test_graph.ainvoke(
        chat_state,
        config={"configurable": {"thread_id": "route-chat"}}
    )
    assert chat_result["mode"] == "chat"

    # Test teaching mode detection via entry node (without full execution)
    from agent.graph_interrupt import entry_node_interrupt

    teaching_state = {
        "messages": [HumanMessage("Start lesson")],
        "session_context": {"session_id": "test-123"}
    }
    teaching_result = await entry_node_interrupt(teaching_state)
    assert teaching_result["mode"] == "teaching"


# Performance and edge case tests

async def test_large_message_history_performance():
    """Test graph performance with large message history (chat mode only)"""
    from agent.graph_interrupt import main_graph_interrupt

    # Create graph with in-memory checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    # Create large message history
    large_messages = [
        HumanMessage(f"Message {i}") for i in range(100)
    ]

    state = {
        "messages": large_messages
    }

    # Should handle large message history without issues
    result = await test_graph.ainvoke(
        state,
        config={"configurable": {"thread_id": "perf-test"}}
    )

    assert len(result["messages"]) == 101  # 100 + 1 response
    assert result["mode"] == "chat"


async def test_concurrent_graph_executions():
    """Test multiple concurrent graph executions with different thread IDs (chat mode only)"""
    from agent.graph_interrupt import main_graph_interrupt
    import asyncio

    # Create graph with in-memory checkpointer at compile time
    memory = InMemorySaver()
    test_graph = main_graph_interrupt.compile(checkpointer=memory)

    async def run_chat(thread_id: str, message: str):
        return await test_graph.ainvoke(
            {"messages": [HumanMessage(message)]},
            config={"configurable": {"thread_id": thread_id}}
        )

    # Run multiple concurrent executions
    tasks = [
        run_chat("thread-1", "Hello from thread 1"),
        run_chat("thread-2", "Hello from thread 2"),
        run_chat("thread-3", "Hello from thread 3")
    ]

    results = await asyncio.gather(*tasks)

    # Verify all completed successfully
    assert len(results) == 3
    for result in results:
        assert result["mode"] == "chat"
        assert len(result["messages"]) == 2