"""Shared chat logic for both LangGraph and Aegra systems.

This module contains the core chat functionality that can be used by both systems
with their respective wrapper configurations.
"""

from typing import TypedDict, List
from langchain_core.messages import AIMessage, BaseMessage


class ChatState(TypedDict):
    """Shared state definition for chat agents."""
    messages: List[BaseMessage]


async def chat_node(state: ChatState) -> dict:
    """Process chat messages and generate responses.
    
    This is a simple implementation that returns friendly responses.
    You can replace this with actual LLM calls using LangChain models.
    
    Args:
        state: The current chat state with messages
        
    Returns:
        Updated state with new message appended
    """
    # Get the existing messages
    messages = state.get("messages", [])
    
    # Get the last message from the user
    if messages:
        last_message = messages[-1]
        user_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Simple response logic - replace with LLM integration
        if "hello" in user_input.lower() or "hi" in user_input.lower():
            response_text = "Hello! I'm your shared chat agent. How can I help you today?"
        elif "how are you" in user_input.lower():
            response_text = "I'm functioning well, thank you for asking! What can I assist you with?"
        elif "joke" in user_input.lower():
            response_text = "Why don't scientists trust atoms? Because they make up everything! 😄"
        elif "test" in user_input.lower():
            response_text = "✅ Shared agent working! Both LangGraph and Aegra are using the same core logic."
        else:
            response_text = f"I received your message: '{user_input}'. This is a demo response from the shared agent. Both systems use the same code!"
    else:
        response_text = "Hello! I'm ready to chat. Send me a message to get started."
    
    # Return the complete updated message list (compatible with both systems)  
    # Create AIMessage without ID to match original format
    ai_message = AIMessage(content=response_text, id=None)
    updated_messages = messages + [ai_message]
    return {"messages": updated_messages}