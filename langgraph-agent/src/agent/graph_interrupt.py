"""LangGraph main graph with interrupt-enabled UI interactions.

Handles chat messages and teaching loop with interrupts for lesson cards.
This is the interrupt-enabled version of the main graph that integrates with
Assistant-UI's generative interface system.
"""

from __future__ import annotations

import json
import logging
from typing import Dict, Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph

try:
    from .interrupt_state import InterruptUnifiedState
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


async def entry_node_interrupt(state: InterruptUnifiedState) -> dict:
    """Entry point that processes input and sets up initial state with interrupt support.

    This node receives the initial input from the client which may contain
    session_context for lesson sessions. It extracts session context fields
    into individual state fields for teaching subgraph consumption and initializes
    interrupt-related tracking.
    """
    logger.info("=== ENTRY NODE INTERRUPT START ===")
    logger.info(f"Entry node received state keys: {list(state.keys())}")

    session_context = state.get("session_context")
    logger.info(f"Session context: {session_context}")

    # Check for explicit mode in session_context (Course Manager integration)
    explicit_mode = session_context.get("mode") if session_context else None
    logger.info(f"Explicit mode from session_context: {explicit_mode}")

    # Initialize interrupt-related fields - NO FALLBACK
    interrupt_init = {
        "interrupt_count": state.get("interrupt_count", 0),
        "interrupt_history": state.get("interrupt_history", []),
        "card_presentation_complete": False,
        "tool_response_received": False,
        "cards_presented_via_ui": state.get("cards_presented_via_ui", []),
        "feedback_interactions_count": state.get("feedback_interactions_count", 0),
        "can_resume_from_interrupt": True
    }

    print(f"🚨 INTERRUPT DEBUG - entry_node_interrupt initialized with session_context: {bool(session_context)}")

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
            "mode": mode,
            **interrupt_init
        }

    elif session_context and isinstance(session_context, dict) and session_context.get("session_id"):
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

        # Extract course_id from lesson_snapshot where it's actually stored
        course_id = lesson_snapshot.get("courseId", "") if lesson_snapshot else ""

        logger.info(f"Teaching session_id: {session_context.get('session_id', '')}")
        logger.info(f"Teaching student_id: {session_context.get('student_id', '')}")
        logger.info(f"Teaching course_id: {course_id}")

        return {
            "session_context": session_context,  # Keep for frontend compatibility
            "mode": mode,
            # Extract fields for teaching subgraph
            "session_id": session_context.get("session_id", ""),
            "student_id": session_context.get("student_id", ""),
            "course_id": course_id,  # Extract from lesson_snapshot.courseId
            "lesson_snapshot": lesson_snapshot,
            "student_response": student_input,
            **interrupt_init
        }
    else:
        logger.info("💬 CHAT MODE DETECTED (default)")
        mode = "chat"
        return {
            "session_context": session_context,
            "mode": mode,
            **interrupt_init
        }


async def router_node_interrupt(state: InterruptUnifiedState) -> dict:
    """Route to appropriate handler based on context with interrupt awareness."""
    logger.info("=== ROUTER NODE INTERRUPT START ===")

    current_mode = state.get("mode", "unknown")
    logger.info(f"Current mode from state: {current_mode}")

    session_context = state.get("session_context")

    # Check if we have pending interrupt responses to handle
    if state.get("user_interaction_response") and not state.get("tool_response_received", True):
        logger.info("🔄 ROUTER: Processing pending interrupt response -> teaching")
        # Process pending interrupt response
        return {
            "mode": "teaching",
            "tool_response_received": True
        }

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


async def chat_node_interrupt(state: InterruptUnifiedState) -> dict:
    """Process chat messages and generate responses with optional interrupts.
    
    This maintains the same functionality as the original chat node but could
    be enhanced with interrupts for more engaging conversations.
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
            response = "Hello! I'm your Scottish AI Lessons assistant with interactive capabilities. How can I help you today?"
        elif "how are you" in user_input.lower():
            response = "I'm functioning well with enhanced interactive features, thank you for asking! What can I assist you with?"
        elif "help" in user_input.lower():
            response = "I can help you with mathematics lessons, practice problems, and learning support using interactive lesson cards. What would you like to work on?"
        else:
            response = f"I understand you're asking about: '{user_input}'. Let me help you with that using our interactive learning system."
    else:
        response = "Hello! I'm ready to help with your learning using interactive lesson cards. Send me a message to get started."
    
    # Return the response as an AIMessage
    return {
        "messages": [AIMessage(content=response)]
    }


# Route based on mode for interrupt-aware graph
def route_by_mode_interrupt(state: InterruptUnifiedState) -> str:
    """Route based on mode with interrupt considerations."""
    mode = state.get("mode", "chat")
    logger.info(f"=== ROUTE_BY_MODE_INTERRUPT FUNCTION ===")
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


# Import the compiled tool call + interrupt teaching graph and course manager subgraph
try:
    from .teacher_graph_toolcall_interrupt import compiled_teaching_graph_toolcall as teaching_subgraph_interrupt
    from .course_manager_graph import simple_course_manager_graph as course_manager_subgraph
except ImportError:
    from agent.teacher_graph_toolcall_interrupt import compiled_teaching_graph_toolcall as teaching_subgraph_interrupt
    from agent.course_manager_graph import simple_course_manager_graph as course_manager_subgraph

logger.info("Successfully imported subgraphs: teaching_interrupt and course_manager")


# Build the interrupt-enabled main graph
main_graph_interrupt = StateGraph(InterruptUnifiedState)
main_graph_interrupt.add_node("entry", entry_node_interrupt)
main_graph_interrupt.add_node("router", router_node_interrupt)
main_graph_interrupt.add_node("chat", chat_node_interrupt)

# Add interrupt-enabled teaching subgraph directly
# Note: With streamSubgraphs enabled, messages from subgraph nodes are streamed directly
# The interrupt system will handle UI presentations instead of streaming messages
main_graph_interrupt.add_node("teaching", teaching_subgraph_interrupt)

# Add course manager subgraph
main_graph_interrupt.add_node("course_manager", course_manager_subgraph)

logger.info("Added all nodes: entry, router, chat, teaching, course_manager")

# Add edges
main_graph_interrupt.add_edge("__start__", "entry")
main_graph_interrupt.add_edge("entry", "router")
main_graph_interrupt.add_conditional_edges(
    "router",
    route_by_mode_interrupt,
    {
        "chat": "chat",
        "teaching": "teaching",
        "course_manager": "course_manager"
    }
)

logger.info("Added conditional routing: chat, teaching, course_manager")

# Compile the interrupt-enabled main graph
# Checkpointing is handled implicitly by LangGraph CLI in dev mode (stored in .langraph_api)
graph_interrupt = main_graph_interrupt.compile()

logger.info("🎉 Interrupt-enabled main graph compiled successfully with course_manager support!")
logger.info("Available routes: chat, teaching, course_manager")