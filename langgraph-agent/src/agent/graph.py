"""LangGraph chat and teaching interface for Assistant-UI frontend.

Handles chat messages and teaching loop for lessons.
"""

from __future__ import annotations

import json
from typing import Dict, Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import StateGraph

try:
    from .shared_state import UnifiedState
except ImportError:
    from agent.shared_state import UnifiedState


async def entry_node(state: UnifiedState) -> dict:
    """Entry point that processes input and sets up initial state.
    
    This node receives the initial input from the client which may contain
    session_context for lesson sessions. It extracts session context fields
    into individual state fields for teaching subgraph consumption.
    """
    session_context = state.get("session_context")
    
    # Determine mode based on session context
    if session_context and session_context.get("session_id"):
        mode = "teaching"
        
        # Extract session context fields into individual state fields
        lesson_snapshot = session_context.get("lesson_snapshot", {})
        if isinstance(lesson_snapshot, str):
            lesson_snapshot = json.loads(lesson_snapshot)
        
        # Get the last message (student response) if available
        messages = state.get("messages", [])
        student_input = None
        if messages and len(messages) > 0:
            last_message = messages[-1]
            if isinstance(last_message, HumanMessage):
                student_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        return {
            "session_context": session_context,  # Keep for frontend compatibility
            "mode": mode,
            # Extract fields for teaching subgraph
            "session_id": session_context.get("session_id", ""),
            "student_id": session_context.get("student_id", ""),
            "lesson_snapshot": lesson_snapshot,
            "student_response": student_input,
        }
    else:
        mode = "chat"
        return {
            "session_context": session_context,
            "mode": mode
        }


async def router_node(state: UnifiedState) -> dict:
    """Route to appropriate handler based on context."""
    # Mode should already be set by entry_node
    # This is now redundant but kept for compatibility
    session_context = state.get("session_context")
    if session_context and session_context.get("session_id"):
        return {"mode": "teaching"}
    return {"mode": "chat"}


async def chat_node(state: UnifiedState) -> dict:
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
            response = "Hello! I'm your Scottish AI Lessons assistant. How can I help you today?"
        elif "how are you" in user_input.lower():
            response = "I'm functioning well, thank you for asking! What can I assist you with?"
        elif "help" in user_input.lower():
            response = "I can help you with mathematics lessons, practice problems, and learning support. What would you like to work on?"
        else:
            response = f"I understand you're asking about: '{user_input}'. Let me help you with that."
    else:
        response = "Hello! I'm ready to help with your learning. Send me a message to get started."
    
    # Return the response as an AIMessage
    return {
        "messages": [AIMessage(content=response)]
    }


# Teaching subgraph wrapper function eliminated - direct subgraph integration used instead


# Define and compile the graph
def route_by_mode(state: UnifiedState) -> str:
    """Route based on mode."""
    mode = state.get("mode", "chat")
    return "teaching" if mode == "teaching" else "chat"

# Import the compiled teaching graph for direct integration
try:
    from .teaching_graph import compiled_teaching_graph as teaching_subgraph
except ImportError:
    from agent.teaching_graph import compiled_teaching_graph as teaching_subgraph

# Build the main graph
main_graph = StateGraph(UnifiedState)
main_graph.add_node("entry", entry_node)
main_graph.add_node("router", router_node)
main_graph.add_node("chat", chat_node)

# Add teaching subgraph directly (shared state schema enables direct integration)
main_graph.add_node("teaching", teaching_subgraph)

# Add edges
main_graph.add_edge("__start__", "entry")
main_graph.add_edge("entry", "router")
main_graph.add_conditional_edges(
    "router",
    route_by_mode,
    {
        "chat": "chat", 
        "teaching": "teaching"
    }
)

# Compile the main graph
graph = main_graph.compile(
    name="agent"  # Name must match NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID
)
