"""Aegra-specific wrapper for shared chat logic.

This module creates an Aegra-compatible agent using the shared chat logic,
with the test scaffolding that Aegra requires for proper initialization.
Includes AIMessage → AIMessageChunk conversion for frontend compatibility.
"""

from typing import TypedDict, List
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableConfig

# Handle both relative and absolute imports
try:
    from .shared_chat_logic import ChatState, chat_node
except ImportError:
    import sys
    import os
    # Add the current directory to sys.path for dynamic loading
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    from shared_chat_logic import ChatState, chat_node


async def aegra_chat_node(state: ChatState, config: RunnableConfig | None = None) -> ChatState:
    """Aegra chat node that converts AIMessage to AIMessageChunk for frontend compatibility."""
    # Use shared chat_node
    result = await chat_node(state)
    
    # Convert AIMessage to AIMessageChunk for Aegra streaming compatibility
    messages = result.get("messages", [])
    if messages and len(messages) > 0:
        from langchain_core.messages import AIMessageChunk
        last_msg = messages[-1]
        
        # Check if the last message is an AI message that needs conversion
        if hasattr(last_msg, 'type') and last_msg.type == 'ai':
            # Create an AIMessageChunk with proper format
            chunk = AIMessageChunk(
                content=last_msg.content,
                # Add run-- prefix to match expected format
                id=f"run--{last_msg.id}" if hasattr(last_msg, 'id') and last_msg.id else f"run--{id(last_msg)}"
            )
            # Return messages with the converted chunk
            return {"messages": messages[:-1] + [chunk]}
    
    return result


def create_chat_graph():
    """Create the chat graph with Aegra-compatible structure."""
    workflow = StateGraph(ChatState)
    workflow.add_node("chat", aegra_chat_node)  # Use wrapper instead of raw chat_node
    workflow.set_entry_point("chat")
    workflow.add_edge("chat", END)
    return workflow.compile()


# Create and export the graph
chat_graph = create_chat_graph()
graph = chat_graph  # Export as 'graph' for Aegra configuration


# Test scaffolding required for Aegra compatibility
if __name__ == "__main__":
    import asyncio
    from langchain_core.messages import HumanMessage
    
    async def test_chat():
        initial_state = {
            "messages": [HumanMessage(content="Hello! How are you today?")]
        }
        
        print("🤖 Testing Aegra chat graph...")
        async for event in chat_graph.astream(initial_state, stream_mode=["messages", "values"]):
            print(event)
            print("\n\n")
    
    asyncio.run(test_chat())