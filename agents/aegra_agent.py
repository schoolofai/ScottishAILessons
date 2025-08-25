"""Aegra-specific wrapper for shared chat logic.

This module creates an Aegra-compatible agent using the shared chat logic,
with the test scaffolding that Aegra requires for proper initialization.
"""

from langgraph.graph import StateGraph, END

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


def create_chat_graph():
    """Create the chat graph with Aegra-compatible structure."""
    workflow = StateGraph(ChatState)
    workflow.add_node("chat", chat_node)
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