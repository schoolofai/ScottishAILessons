"""LangGraph chat and teaching interface for Assistant-UI frontend.

Handles chat messages and teaching loop for lessons.
"""

from __future__ import annotations

from typing import Annotated, TypedDict, Optional, Dict, Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages


class State(TypedDict):
    """State for the chat and teaching agent.
    
    Messages are handled with the add_messages reducer which 
    manages message history and updates.
    """
    messages: Annotated[list[BaseMessage], add_messages]
    session_context: Optional[Dict[str, Any]]  # For lesson sessions
    mode: str  # "chat" or "teaching"


async def entry_node(state: State) -> dict:
    """Entry point that processes input and sets up initial state.
    
    This node receives the initial input from the client which may contain
    session_context for lesson sessions. It ensures the state is properly
    initialized before routing.
    """
    # The session_context should already be in state from the input
    # Just ensure we have it properly set
    session_context = state.get("session_context")
    
    # Determine mode based on session context
    if session_context and session_context.get("session_id"):
        mode = "teaching"
    else:
        mode = "chat"
    
    return {
        "session_context": session_context,
        "mode": mode
    }


async def router_node(state: State) -> dict:
    """Route to appropriate handler based on context."""
    # Mode should already be set by entry_node
    # This is now redundant but kept for compatibility
    session_context = state.get("session_context")
    if session_context and session_context.get("session_id"):
        return {"mode": "teaching"}
    return {"mode": "chat"}


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


def teaching_subgraph_wrapper(state: State) -> dict:
    """Transform state and call teaching subgraph."""
    import json
    
    session_context = state.get("session_context", {})
    messages = state.get("messages", [])
    
    # If no session context, this shouldn't be in teaching mode
    if not session_context:
        return {
            "messages": [AIMessage(content="No session context found. Please start a lesson from the dashboard.")]
        }
    
    try:
        # Parse lesson_snapshot if it's a JSON string
        lesson_snapshot = session_context.get("lesson_snapshot", {})
        if isinstance(lesson_snapshot, str):
            lesson_snapshot = json.loads(lesson_snapshot)
        
        # Get the last message (student response) if available
        student_input = None
        if messages and len(messages) > 0:
            last_message = messages[-1]
            if isinstance(last_message, HumanMessage):
                student_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Transform main state to teaching state
        teaching_state = {
            "session_id": session_context.get("session_id", ""),
            "student_id": session_context.get("student_id", ""),
            "course_id": session_context.get("course_id", ""),
            "lesson_template_id": session_context.get("lesson_template_id", ""),
            "lesson_snapshot": lesson_snapshot,
            "current_card_index": session_context.get("current_card_index", 0),
            "cards_completed": session_context.get("cards_completed", []),
            "current_card": session_context.get("current_card"),
            "student_response": student_input,
            "is_correct": session_context.get("is_correct"),
            "feedback": session_context.get("feedback"),
            "hint_level": session_context.get("hint_level", 0),
            "attempts": session_context.get("attempts", 0),
            "evidence": session_context.get("evidence", []),
            "mastery_updates": session_context.get("mastery_updates", []),
            "stage": session_context.get("stage", "design"),
            "should_exit": session_context.get("should_exit", False),
            "messages": messages
        }
        
        # Invoke the compiled teaching graph as a subgraph
        # The teaching_subgraph is imported at module level
        result = teaching_subgraph.invoke(teaching_state)
        
        # Extract and validate response messages
        response_messages = result.get("messages", [])
        if not response_messages:
            # Fallback message if subgraph doesn't return messages
            if result.get("stage") == "done":
                response_messages = [AIMessage(content="🎉 Lesson complete! Great job!")]
            else:
                response_messages = [AIMessage(content="Processing your response...")]
        
        # Transform subgraph result back to main state
        updated_session_context = {
            **session_context,
            "current_card_index": result.get("current_card_index", session_context.get("current_card_index", 0)),
            "cards_completed": result.get("cards_completed", session_context.get("cards_completed", [])),
            "current_card": result.get("current_card", session_context.get("current_card")),
            "is_correct": result.get("is_correct", session_context.get("is_correct")),
            "feedback": result.get("feedback", session_context.get("feedback")),
            "hint_level": result.get("hint_level", session_context.get("hint_level", 0)),
            "attempts": result.get("attempts", session_context.get("attempts", 0)),
            "evidence": result.get("evidence", session_context.get("evidence", [])),
            "mastery_updates": result.get("mastery_updates", session_context.get("mastery_updates", [])),
            "stage": result.get("stage", session_context.get("stage", "design")),
            "should_exit": result.get("should_exit", session_context.get("should_exit", False))
        }
        
        return {
            "messages": response_messages,
            "session_context": updated_session_context
        }
        
    except Exception as e:
        # Handle any errors
        print(f"Teaching subgraph wrapper error: {e}")
        return {
            "messages": [AIMessage(content="I encountered an error. Please try refreshing the lesson.")],
            "session_context": session_context
        }


# Define and compile the graph
def route_by_mode(state: State) -> str:
    """Route based on mode."""
    mode = state.get("mode", "chat")
    return "teaching" if mode == "teaching" else "chat"

# Import the compiled teaching graph and create reference
try:
    from .teaching_graph import compiled_teaching_graph as teaching_subgraph
except ImportError:
    from agent.teaching_graph import compiled_teaching_graph as teaching_subgraph

# Build the main graph
main_graph = StateGraph(State)
main_graph.add_node("entry", entry_node)
main_graph.add_node("router", router_node)
main_graph.add_node("chat", chat_node)

# Add teaching subgraph using wrapper function (due to different state schemas)
main_graph.add_node("teaching", teaching_subgraph_wrapper)

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
