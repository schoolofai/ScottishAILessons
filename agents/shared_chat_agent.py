"""LangGraph chat interface for Assistant-UI frontend.

Handles chat messages and provides responses.
"""

from __future__ import annotations

from typing import TypedDict
try:
    from typing import Annotated
except ImportError:
    from typing_extensions import Annotated

from langchain_core.messages import AIMessage, BaseMessage
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages


class State(TypedDict):
    """State for the chat agent.
    
    Messages are handled with the add_messages reducer which 
    manages message history and updates.
    """
    messages: Annotated[list[BaseMessage], add_messages]


async def chat_node(state: State) -> dict:
    """Process chat messages and generate responses.
    
    This is a simple implementation that returns a friendly response.
    You can replace this with actual LLM calls using LangChain models.
    """
    # Get the last message from the user
    if state["messages"]:
        last_message = state["messages"][-1]
        user_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Simple response logic - replace with LLM integration
        if "hello" in user_input.lower() or "hi" in user_input.lower():
            response = "Hello! I'm your LangGraph assistant. How can I help you today?"
        elif "how are you" in user_input.lower():
            response = "I'm functioning well, thank you for asking! What can I assist you with?"
        elif "joke" in user_input.lower():
            response = "Why don't scientists trust atoms? Because they make up everything! 😄"
        else:
            response = f"I received your message: '{user_input}'. This is a demo response from the LangGraph backend. To add AI capabilities, integrate an LLM provider like OpenAI or Anthropic."
    else:
        response = "Hello! I'm ready to chat. Send me a message to get started."
    
    # Return the response as an AIMessage
    return {
        "messages": [AIMessage(content=response)]
    }


# Define and compile the graph
graph = (
    StateGraph(State)
    .add_node("chat", chat_node)
    .add_edge("__start__", "chat")
    .compile(name="agent")  # Name must match NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID
)