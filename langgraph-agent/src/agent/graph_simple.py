"""Simplified main graph using direct interrupt pattern.

This replaces graph_interrupt.py with a cleaner implementation following
the ChatGPT example pattern.
"""

from __future__ import annotations

import json
from typing import Dict, Any

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph

try:
    from .simple_teaching_state import SimpleTeachingState
except ImportError:
    from agent.simple_teaching_state import SimpleTeachingState


async def entry_node_simple(state: SimpleTeachingState) -> dict:
    """Entry point that processes input and sets up initial state."""
    session_context = state.get("session_context")
    
    # Debug logging
    print(f"[ENTRY_NODE_SIMPLE] session_context: {session_context}")
    print(f"[ENTRY_NODE_SIMPLE] session_context type: {type(session_context)}")
    if session_context:
        print(f"[ENTRY_NODE_SIMPLE] session_id: {session_context.get('session_id')}")
    
    # Determine mode based on session context
    if session_context and session_context.get("session_id"):
        mode = "teaching"
        print(f"[ENTRY_NODE_SIMPLE] Setting mode to: {mode}")
        
        # Extract session context fields
        lesson_snapshot = session_context.get("lesson_snapshot", {})
        if isinstance(lesson_snapshot, str):
            lesson_snapshot = json.loads(lesson_snapshot)
        
        # Get student input from messages
        messages = state.get("messages", [])
        student_input = None
        if messages and len(messages) > 0:
            last_message = messages[-1]
            if isinstance(last_message, HumanMessage):
                student_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        return {
            "session_context": session_context,
            "mode": mode,
            "session_id": session_context.get("session_id", ""),
            "student_id": session_context.get("student_id", ""),
            "lesson_snapshot": lesson_snapshot,
            "student_response": student_input,
            "current_stage": "design",
            "current_card_index": 0,
            "attempts": 0,
            "max_attempts": 3,
            "evidence": [],
            "cards_completed": []
        }
    else:
        mode = "chat"
        print(f"[ENTRY_NODE_SIMPLE] Setting mode to: {mode}")
        return {
            "session_context": session_context,
            "mode": mode,
            "current_stage": "chat"
        }


async def router_node_simple(state: SimpleTeachingState) -> dict:
    """Route to appropriate handler based on mode."""
    session_context = state.get("session_context")
    mode = state.get("mode", "chat")
    
    print(f"[ROUTER_NODE_SIMPLE] session_context: {session_context}")
    print(f"[ROUTER_NODE_SIMPLE] current mode from state: {mode}")
    
    if session_context and session_context.get("session_id"):
        print(f"[ROUTER_NODE_SIMPLE] Returning mode: teaching")
        return {"mode": "teaching"}
    else:
        print(f"[ROUTER_NODE_SIMPLE] Returning mode: chat")
        return {"mode": "chat"}


async def chat_node_simple(state: SimpleTeachingState) -> dict:
    """Process chat messages (same as before)."""
    if state["messages"]:
        last_message = state["messages"][-1]
        user_input = last_message.content if hasattr(last_message, 'content') else str(last_message)
        
        # Simple response logic
        if "latex" in user_input.lower() or "test" in user_input.lower():
            response = r"""Testing LaTeX rendering with different formats:

1. Standard inline math: $\frac{2}{10} = \frac{1}{5}$

2. Standard display math: $$\frac{2}{10} = \frac{1}{5} = 0.2$$

3. Mixed expressions: The fraction $\frac{1}{4}$ equals 0.25 or 25%.

Let me know if you can see these as proper mathematical notation!"""
        elif "hello" in user_input.lower() or "hi" in user_input.lower():
            response = "Hello! I'm your Scottish AI Lessons assistant with interactive capabilities. How can I help you today?"
        elif "help" in user_input.lower():
            response = "I can help you with mathematics lessons, practice problems, and learning support using interactive lesson cards. What would you like to work on?"
        else:
            response = f"I understand you're asking about: '{user_input}'. Let me help you with that using our interactive learning system."
    else:
        response = "Hello! I'm ready to help with your learning using interactive lesson cards. Send me a message to get started."
    
    return {
        "messages": [AIMessage(content=response)]
    }


def route_by_mode_simple(state: SimpleTeachingState) -> str:
    """Route based on session context directly."""
    session_context = state.get("session_context")
    if session_context and session_context.get("session_id"):
        result = "teaching"
    else:
        result = "chat"
    
    print(f"[ROUTE_BY_MODE_SIMPLE] session_context: {bool(session_context)}, session_id: {session_context.get('session_id') if session_context else None}, routing to: {result}")
    return result


# Import the compiled simple teaching graph
try:
    from .teacher_graph_simple import compiled_simple_teaching_graph as teaching_subgraph_simple
except ImportError:
    from agent.teacher_graph_simple import compiled_simple_teaching_graph as teaching_subgraph_simple


# Build the simplified main graph
main_graph_simple = StateGraph(SimpleTeachingState)
main_graph_simple.add_node("entry", entry_node_simple)
main_graph_simple.add_node("chat", chat_node_simple)

# Add simplified teaching subgraph
main_graph_simple.add_node("teaching", teaching_subgraph_simple)

# Add edges
main_graph_simple.add_edge("__start__", "entry")
main_graph_simple.add_conditional_edges(
    "entry",
    route_by_mode_simple,
    {
        "chat": "chat", 
        "teaching": "teaching"
    }
)

# Compile the simplified main graph
# Checkpointing handled by LangGraph CLI (stored in .langraph_api)
graph_simple = main_graph_simple.compile()