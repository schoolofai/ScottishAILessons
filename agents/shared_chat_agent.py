"""LangGraph chat interface for Assistant-UI frontend.

Handles chat messages and provides responses.
"""

from typing import TypedDict, List
try:
    from typing import Annotated
except ImportError:
    from typing_extensions import Annotated

from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import StateGraph, END


class State(TypedDict):
    """State for the chat agent.
    
    Simple message list state compatible with both LangGraph and Aegra.
    """
    messages: List[BaseMessage]


async def chat_node(state: State) -> dict:
    """Process chat messages and generate responses.
    
    This is a simple implementation that returns a friendly response.
    You can replace this with actual LLM calls using LangChain models.
    """
    # Get the existing messages
    messages = state.get("messages", [])
    
    # Get the last message from the user
    if messages:
        last_message = messages[-1]
        user_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Simple response logic - replace with LLM integration
        if "hello" in user_input.lower() or "hi" in user_input.lower():
            response_text = "Hello! I'm your LangGraph assistant. How can I help you today?"
        elif "how are you" in user_input.lower():
            response_text = "I'm functioning well, thank you for asking! What can I assist you with?"
        elif "joke" in user_input.lower():
            response_text = "Why don't scientists trust atoms? Because they make up everything! 😄"
        else:
            response_text = f"I received your message: '{user_input}'. This is a demo response from the shared agent. Both LangGraph and Aegra are using the same code!"
    else:
        response_text = "Hello! I'm ready to chat. Send me a message to get started."
    
    # Return the complete updated message list (compatible with both systems)
    updated_messages = messages + [AIMessage(content=response_text)]
    return {"messages": updated_messages}


# Define and compile the graph (compatible with both LangGraph and Aegra)
def create_chat_graph():
    """Create the chat graph with compatibility for both systems."""
    workflow = StateGraph(State)
    workflow.add_node("chat", chat_node)
    workflow.set_entry_point("chat")
    workflow.add_edge("chat", END)
    return workflow.compile()


# Create and export the graph
graph = create_chat_graph()