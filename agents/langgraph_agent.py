"""LangGraph-specific wrapper for shared chat logic.

This module creates a LangGraph-compatible agent using the shared chat logic.
"""

try:
    from typing import Annotated
except ImportError:
    from typing_extensions import Annotated

from typing import TypedDict, List
from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages

# Handle both relative and absolute imports
try:
    from .shared_chat_logic import chat_node
except ImportError:
    import sys
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    from shared_chat_logic import chat_node


# LangGraph state with add_messages reducer
class State(TypedDict):
    """State for the chat agent with LangGraph message reducer."""
    messages: Annotated[List[BaseMessage], add_messages]


async def langgraph_chat_node(state: State) -> dict:
    """LangGraph chat node that uses shared logic but returns single message."""
    # Convert to simple format for shared logic
    messages = state.get("messages", [])
    simple_state = {"messages": messages}
    
    # Use shared logic
    result = await chat_node(simple_state)
    
    # Return only the new message (add_messages reducer will handle the rest)
    new_message = result["messages"][-1]
    return {"messages": [new_message]}


# Define and compile the LangGraph graph
graph = (
    StateGraph(State)
    .add_node("chat", langgraph_chat_node)
    .add_edge("__start__", "chat")
    .compile(name="agent")  # Name must match NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID
)