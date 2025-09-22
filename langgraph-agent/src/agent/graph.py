"""LangGraph chat and teaching interface for Assistant-UI frontend.

Handles chat messages and teaching loop for lessons.
"""

from __future__ import annotations

import json
import logging
from typing import Dict, Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.graph import StateGraph

try:
    from .shared_state import UnifiedState
except ImportError:
    from agent.shared_state import UnifiedState

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def entry_node(state: UnifiedState) -> dict:
    """Entry point that processes input and sets up initial state.

    This node receives the initial input from the client which may contain
    session_context for lesson sessions. It extracts session context fields
    into individual state fields for teaching subgraph consumption.
    """
    logger.info("=== ENTRY NODE START ===")
    logger.info(f"Entry node received state keys: {list(state.keys())}")

    session_context = state.get("session_context")
    logger.info(f"Session context: {session_context}")

    # Check for explicit mode in session_context (Course Manager integration)
    explicit_mode = session_context.get("mode") if session_context else None
    logger.info(f"Explicit mode from session_context: {explicit_mode}")

    # Determine mode based on session context
    if explicit_mode == "course_manager":
        logger.info("🎯 COURSE MANAGER MODE DETECTED")
        mode = "course_manager"

        # Log course context details for debugging
        course_info = session_context.get("course", {}) if session_context else {}
        student_info = session_context.get("student", {}) if session_context else {}

        logger.info(f"Course ID: {course_info.get('courseId', 'NOT_PROVIDED')}")
        logger.info(f"Student ID: {student_info.get('$id', 'NOT_PROVIDED')}")
        logger.info(f"Available context keys: {list(session_context.keys()) if session_context else []}")

        return {
            "session_context": session_context,
            "mode": mode
        }

    elif session_context and session_context.get("session_id"):
        logger.info("🎓 TEACHING MODE DETECTED (has session_id)")
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

        logger.info(f"Teaching session_id: {session_context.get('session_id', '')}")
        logger.info(f"Teaching student_id: {session_context.get('student_id', '')}")

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
        logger.info("💬 CHAT MODE DETECTED (default)")
        mode = "chat"
        return {
            "session_context": session_context,
            "mode": mode
        }


def router_node(state: UnifiedState) -> dict:
    """Route to appropriate handler based on context."""
    logger.info("=== ROUTER NODE START ===")

    current_mode = state.get("mode", "unknown")
    logger.info(f"Current mode from state: {current_mode}")

    session_context = state.get("session_context")

    # Mode should already be set by entry_node, but add fallback logic with logging
    if current_mode == "course_manager":
        logger.info("✅ ROUTER: Keeping course_manager mode")
        return {"mode": "course_manager"}
    elif current_mode == "teaching":
        logger.info("✅ ROUTER: Keeping teaching mode")
        return {"mode": "teaching"}
    elif current_mode == "chat":
        logger.info("✅ ROUTER: Keeping chat mode")
        return {"mode": "chat"}
    else:
        # Legacy fallback logic with extensive logging
        logger.warning(f"⚠️ ROUTER: Unknown mode '{current_mode}', applying fallback logic")

        if session_context and session_context.get("session_id"):
            logger.info("🔄 ROUTER FALLBACK: Detected session_id -> teaching")
            return {"mode": "teaching"}
        elif session_context and session_context.get("mode") == "course_manager":
            logger.info("🔄 ROUTER FALLBACK: Detected explicit course_manager mode")
            return {"mode": "course_manager"}
        else:
            logger.info("🔄 ROUTER FALLBACK: Default to chat")
            return {"mode": "chat"}


def chat_node(state: UnifiedState) -> dict:
    """Process chat messages and generate responses.
    
    This is a simple implementation that returns a friendly response.
    You can replace this with actual LLM calls using LangChain models.
    """
    # Get the last message from the user
    if state["messages"]:
        last_message = state["messages"][-1]
        user_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Simple response logic - replace with LLM integration
        if "latex" in user_input.lower() or "test" in user_input.lower():
            response = r"""Testing LaTeX rendering with different formats:

1. Standard inline math: $\frac{2}{10} = \frac{1}{5}$

2. Standard display math: $$\frac{2}{10} = \frac{1}{5} = 0.2$$

3. Parentheses format: ( \frac{2}{10} ) should become a fraction

4. Bracket format: [ \frac{2}{10} = 0.2 ]

5. Double backslash format: \\( \\frac{2}{10} \\)

6. Mixed expressions: The fraction $\frac{1}{4}$ equals 0.25 or 25%.

Let me know if you can see these as proper mathematical notation!"""
        elif "hello" in user_input.lower() or "hi" in user_input.lower():
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
    logger.info(f"=== ROUTE_BY_MODE FUNCTION ===")
    logger.info(f"Routing mode: {mode}")

    if mode == "teaching":
        logger.info("🎓 ROUTING TO: teaching")
        return "teaching"
    elif mode == "course_manager":
        logger.info("🎯 ROUTING TO: course_manager")
        return "course_manager"
    else:
        logger.info("💬 ROUTING TO: chat (default)")
        return "chat"

# Import the compiled teaching graph for direct integration
try:
    from .teaching_graph import compiled_teaching_graph as teaching_subgraph
    from .course_manager_graph import simple_course_manager_graph as course_manager_subgraph
except ImportError:
    from agent.teaching_graph import compiled_teaching_graph as teaching_subgraph
    from agent.course_manager_graph import simple_course_manager_graph as course_manager_subgraph

logger.info("Successfully imported subgraphs: teaching and course_manager")

# Build the main graph
main_graph = StateGraph(UnifiedState)
main_graph.add_node("entry", entry_node)
main_graph.add_node("router", router_node)
main_graph.add_node("chat", chat_node)

# Add teaching subgraph directly (shared state schema enables direct integration)
# Note: With streamSubgraphs enabled, messages from subgraph nodes are streamed directly
main_graph.add_node("teaching", teaching_subgraph)

# Add course manager subgraph
main_graph.add_node("course_manager", course_manager_subgraph)

logger.info("Added all nodes: entry, router, chat, teaching, course_manager")

# Add edges
main_graph.add_edge("__start__", "entry")
main_graph.add_edge("entry", "router")
main_graph.add_conditional_edges(
    "router",
    route_by_mode,
    {
        "chat": "chat",
        "teaching": "teaching",
        "course_manager": "course_manager"
    }
)

logger.info("Added conditional routing: chat, teaching, course_manager")

# Compile the main graph
graph = main_graph.compile(
    name="agent"  # Name must match NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID
)

logger.info("🎉 Main graph compiled successfully with course_manager support!")
logger.info("Available routes: chat, teaching, course_manager")
