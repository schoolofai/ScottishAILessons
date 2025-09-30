import pytest

from react_agent.graph import context_chat_agent
from react_agent.context import Context
from react_agent.state import InputState


def test_context_chat_agent_graph_structure():
    """Test that the context chat agent graph is properly structured."""
    # Check that the agent is properly compiled
    assert context_chat_agent is not None
    assert hasattr(context_chat_agent, 'invoke')
    assert hasattr(context_chat_agent, 'ainvoke')

    # Check that the graph has the expected nodes
    graph_nodes = context_chat_agent.get_graph().nodes
    expected_nodes = ["extract_context", "call_model", "tools"]

    for node in expected_nodes:
        assert node in graph_nodes, f"Expected node '{node}' not found in graph"

    print("✅ Graph structure validation passed!")


def test_context_configuration():
    """Test that Context configuration is working properly."""
    context = Context()

    # Test default values
    assert context.model == "anthropic/claude-3-5-sonnet-20240620"
    assert context.max_search_results == 5
    assert context.context_quality_threshold == 0.3
    assert context.enable_context_search_enhancement == True

    # Test custom values
    custom_context = Context(
        model="openai/gpt-4o-mini",
        max_search_results=3,
        context_quality_threshold=0.5
    )
    assert custom_context.model == "openai/gpt-4o-mini"
    assert custom_context.max_search_results == 3
    assert custom_context.context_quality_threshold == 0.5

    print("✅ Context configuration validation passed!")


def test_input_state_validation():
    """Test that InputState is properly structured."""
    # Test empty state
    state = InputState()
    assert state.messages == []
    assert state.static_context is None
    assert state.dynamic_context is None
    assert state.session_context is None

    # Test state with static context
    static_context = {
        "session_id": "test-123",
        "student_id": "student-456",
        "lesson_snapshot": {"title": "Test Lesson"}
    }

    state_with_context = InputState(
        messages=[("user", "Hello")],
        static_context=static_context
    )

    assert len(state_with_context.messages) == 1
    assert state_with_context.static_context == static_context

    print("✅ Input state validation passed!")


# NOTE: The following tests require API keys and are commented out
# They can be enabled when API keys are available

# @pytest.mark.asyncio
# async def test_context_chat_agent_simple_passthrough() -> None:
#     """Test basic functionality of the context-aware chat agent."""
#     res = await context_chat_agent.ainvoke(
#         {"messages": [("user", "Who is the founder of LangChain?")]},
#         context=Context(),
#     )
#     assert "messages" in res
#     assert len(res["messages"]) > 0


# @pytest.mark.asyncio
# async def test_context_chat_agent_with_static_context() -> None:
#     """Test agent with static teaching context."""
#     static_context = {
#         "session_id": "test-session-123",
#         "student_id": "student-456",
#         "lesson_snapshot": {"courseId": "math-101", "title": "Basic Mathematics"},
#         "mode": "teaching"
#     }
#     res = await context_chat_agent.ainvoke(
#         {"messages": [("user", "What are we learning today?")], "static_context": static_context},
#         context=Context(),
#     )
#     assert "messages" in res
#     assert res.get("context_processed", False) == True
