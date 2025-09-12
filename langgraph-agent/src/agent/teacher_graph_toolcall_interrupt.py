"""LangGraph teaching loop with tool call + interrupt pattern.

Implements the two-node approach where:
1. design_node creates AIMessage with tool calls and routes to get_answer_node
2. get_answer_node interrupts and waits for ToolMessage response
3. When user responds via addResult(), ToolMessage is sent and graph continues

This pattern makes tool calls visible to Assistant UI for proper UI component display.
"""

from __future__ import annotations

from typing import Dict, List
from datetime import datetime
import uuid

from langchain_core.messages import AIMessage, ToolCall
from langgraph.graph import StateGraph, START , END
from langgraph.types import interrupt

try:
    from .interrupt_state import InterruptUnifiedState
    from .interrupt_tools import should_use_interrupts
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState
    from agent.interrupt_tools import should_use_interrupts


def _is_lesson_complete(state: InterruptUnifiedState) -> bool:
    """Check if all cards have been completed."""
    current_index = state.get("current_card_index", 0)
    cards = state["lesson_snapshot"].get("cards", [])
    return current_index >= len(cards)


def _get_current_card_info(state: InterruptUnifiedState) -> tuple[dict, int, str]:
    """Extract current card, index, and CFU type."""
    current_index = state.get("current_card_index", 0)
    cards = state["lesson_snapshot"].get("cards", [])
    current_card = cards[current_index]
    cfu_type = current_card.get("cfu", {}).get("type", "")
    return current_card, current_index, cfu_type


def _generate_card_message(teacher, lesson_snapshot: dict, current_card: dict, current_index: int, cfu_type: str):
    """Generate appropriate message based on card position and type."""
    if current_index == 0:
        # First card with greeting
        if cfu_type == "mcq":
            return teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card)
        else:
            return teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card)
    else:
        # Subsequent cards
        if cfu_type == "mcq":
            return teacher.present_mcq_card_sync_full(current_card)
        else:
            return teacher.present_card_sync_full(current_card)


def _check_for_tool_messages(state: InterruptUnifiedState) -> tuple[bool, str]:
    """Check if we received a ToolMessage response from the frontend."""
    messages = state.get("messages", [])
    current_card_idx = state.get('current_card_index', 0)
    expected_tool_call_id = f"lesson_card_{current_card_idx}"
    
    # Debug all tool messages
    print(f"🔍 TOOL_CHECK: Looking for tool_call_id='{expected_tool_call_id}' for card {current_card_idx}")
    
    for message in reversed(messages):  # Check recent messages first
        if hasattr(message, 'type') and message.type == "tool":
            actual_id = getattr(message, 'tool_call_id', 'NO_ID')
            print(f"🔍 TOOL_CHECK: Found tool message with id='{actual_id}', content preview: {str(message.content)[:30]}...")
            
            if message.tool_call_id == expected_tool_call_id:
                print(f"🔍 TOOL_CHECK: MATCH! Processing tool message for card {current_card_idx}")
                # Found our ToolMessage response
                try:
                    import json
                    response_data = json.loads(message.content)
                    return True, response_data.get("student_response", "")
                except (json.JSONDecodeError, AttributeError):
                    # Fallback: treat content as direct response
                    return True, str(message.content)
            else:
                print(f"🔍 TOOL_CHECK: SKIP - tool_call_id mismatch (expected: {expected_tool_call_id}, got: {actual_id})")
    
    print(f"🔍 TOOL_CHECK: No matching tool message found for card {current_card_idx}")
    return False, ""


def design_node(state: InterruptUnifiedState) -> Dict:
    """Design node - creates tool calls for lesson card presentation."""
    from .llm_teacher import LLMTeacher
    
    # Entry logging with FULL STATE DEBUG
    current_idx = state.get("current_card_index", 0)
    stage = state.get("stage", "unknown")
    print(f"🔍 NODE_ENTRY: design_node | card_idx: {current_idx} | stage: {stage}")
    
    # DEBUG: Log complete state to understand what's persisted
    print(f"🔍 STATE_DEBUG in design_node:")
    print(f"  - current_card_index: {state.get('current_card_index', 'NOT SET')}")
    print(f"  - cards_completed: {state.get('cards_completed', [])}")
    print(f"  - attempts: {state.get('attempts', 0)}")
    print(f"  - pending_tool_call_id: {state.get('pending_tool_call_id', 'NOT SET')}")
    print(f"  - message count: {len(state.get('messages', []))}")
    print(f"  - has session_context: {bool(state.get('session_context'))}")
    
    # Check if we received a ToolMessage response
    has_response, student_response = _check_for_tool_messages(state)
    if has_response:
        print(f"🚨 TOOL DEBUG - Found ToolMessage with response: {student_response[:50]}...")
        # Get current card info to pass to mark_node
        current_card, current_index, cfu_type = _get_current_card_info(state)
        print(f"🔍 NODE_EXIT: design_node | decision: has_response | next_stage: mark")
        return {
            "student_response": student_response,
            "current_card": current_card,
            "current_card_index": current_index,
            "stage": "mark"
        }
    
    # Check lesson completion
    if _is_lesson_complete(state):
        print(f"🔍 NODE_EXIT: design_node | decision: lesson_complete | next_stage: done")
        return {
            "stage": "done",
            "should_exit": True
        }
    
    # Generate card content and create tool call
    teacher = LLMTeacher()
    current_card, current_index, cfu_type = _get_current_card_info(state)
    
    message_obj = _generate_card_message(
        teacher, state["lesson_snapshot"], current_card, current_index, cfu_type
    )
    
    # Create tool call for lesson card presentation
    tool_call_id = f"lesson_card_{current_index}"
    lesson_context = {
        "lesson_title": state["lesson_snapshot"].get("title", "Scottish AI Lesson"),
        "student_name": state.get("student_id", "Student"),
        "progress": f"{current_index + 1}/{len(state['lesson_snapshot'].get('cards', []))}"
    }
    
    tool_call = ToolCall(
        id=tool_call_id,
        name="lesson_card_presentation",
        args={
            "card_content": "Enter your answer below",
            "card_data": current_card,
            "card_index": current_index,
            "total_cards": len(state["lesson_snapshot"].get("cards", [])),
            "cfu_type": cfu_type,
            "lesson_context": lesson_context,
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        }
    )
    
    # Create AIMessage with empty content and tool call for UI
    tool_message = AIMessage(
        content="",  # Empty to avoid duplication
        tool_calls=[tool_call]
    )
    
    print(f"🚨 TOOL DEBUG - Created AIMessage with tool call:")
    print(f"🚨 TOOL DEBUG - Tool call ID: {tool_call_id}")
    print(f"🚨 TOOL DEBUG - Tool name: {tool_call['name'] if isinstance(tool_call, dict) else tool_call.name}")
    print(f"🚨 TOOL DEBUG - Card index: {current_index}")
    print(f"🚨 TOOL DEBUG - Tool call type: {type(tool_call)}")
    
    print(f"🔍 NODE_EXIT: design_node | decision: new_card | next_stage: get_answer")
    return {
        "messages": [message_obj, tool_message],  # Both messages
        "current_card": current_card,
        "current_card_index": current_index,
        "stage": "get_answer",  # Route to get_answer_node
        "pending_tool_call_id": tool_call_id
    }


def get_answer_node(state: InterruptUnifiedState) -> Dict:
    """Get answer node - interrupts and waits for ToolMessage response."""
    current_idx = state.get("current_card_index", 0)
    print(f"🔍 NODE_ENTRY: get_answer_node | card_idx: {current_idx}")
    
    # DEBUG: Log state on entry (especially after resume)
    print(f"🔍 STATE_DEBUG in get_answer_node (RESUME CHECK):")
    print(f"  - current_card_index: {state.get('current_card_index', 'NOT SET')}")
    print(f"  - pending_tool_call_id: {state.get('pending_tool_call_id', 'NOT SET')}")
    print(f"  - message count: {len(state.get('messages', []))}")
    
    # CHECK IF WE ALREADY HAVE A RESPONSE (prevents re-interrupt on resume)
    has_response, student_response = _check_for_tool_messages(state)
    if has_response:
        print(f"🔍 NODE_EXIT: get_answer_node | found_response: True | routing back to design")
        # Response already exists, don't interrupt again
        # Let the graph continue to design_node which will handle it
        return {}  # Empty update, edge will take us back to design
    
    # No response yet, so interrupt
    print(f"🚨 INTERRUPT DEBUG - No response found, interrupting")
    print(f"🚨 INTERRUPT DEBUG - Pending tool call ID: {state.get('pending_tool_call_id')}")
    
    # Create interrupt to pause execution
    interrupt_data = {
        "waiting_for": "tool_response",
        "tool_call_id": state.get("pending_tool_call_id"),
        "card_index": current_idx,
        "timestamp": datetime.now().isoformat()
    }
    
    print(f"🚨 INTERRUPT DEBUG - About to interrupt with data: {interrupt_data}")
    
    # Interrupt execution - this pauses the graph
    interrupt(interrupt_data)
    
    # This code will NOT execute because interrupt() stops execution
    print("🚨 ERROR - This line should NEVER be reached after interrupt()")
    return {"error": "Code after interrupt() should not execute"}


def mark_node(state: InterruptUnifiedState) -> Dict:
    """Mark node - evaluate student response and provide feedback."""
    from .llm_teacher import LLMTeacher
    
    current_idx = state.get("current_card_index", 0)
    attempts = state.get("attempts", 0)
    student_response = state.get("student_response", "")
    current_card = state.get("current_card")
    print(f"🔍 NODE_ENTRY: mark_node | card_idx: {current_idx} | attempt: {attempts + 1} | has_response: {bool(student_response)}")
    
    if not student_response or not current_card:
        print("🚨 MARK DEBUG - Missing student response or current card")
        return {"stage": "design"}  # Go back to design
    
    print(f"🚨 MARK DEBUG - Evaluating response: {student_response[:50]}...")
    
    # Perform evaluation
    teacher = LLMTeacher()
    cfu = current_card["cfu"]
    attempts = state.get("attempts", 0) + 1
    max_attempts = state.get("max_attempts", 3)
    
    evaluation = teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=cfu.get("expected") if cfu.get("type") != "mcq" else cfu.get("options", [])[cfu.get("answerIndex", 0)],
        card_context=current_card,
        attempt_number=attempts,
        max_attempts=max_attempts
    )
    
    # Record evidence
    evidence_entry = {
        "timestamp": datetime.now().isoformat(),
        "item_id": cfu["id"],
        "response": student_response,
        "correct": evaluation.is_correct,
        "confidence": evaluation.confidence,
        "attempts": attempts
    }
    evidence = state.get("evidence", [])
    evidence.append(evidence_entry)
    
    # Determine progression
    should_progress = evaluation.is_correct or (attempts >= max_attempts)
    
    print(f"🚨 MARK DEBUG - Evaluation result: correct={evaluation.is_correct}, should_progress={should_progress}")
    
    next_stage = "progress" if should_progress else "design"
    print(f"🔍 NODE_EXIT: mark_node | correct: {evaluation.is_correct} | should_progress: {should_progress} | next_stage: {next_stage}")
    
    return {
        "is_correct": evaluation.is_correct,
        "should_progress": should_progress,
        "feedback": evaluation.feedback,
        "attempts": attempts,
        "evidence": evidence,
        "stage": next_stage,
        "student_response": None,  # Clear response
        # Don't send feedback as message - it was already streamed by LLM
    }


def progress_node(state: InterruptUnifiedState) -> Dict:
    """Progress node - move to next card."""
    from .llm_teacher import LLMTeacher
    
    current_card_index = state.get("current_card_index", 0)
    current_card = state.get("current_card")
    cards_completed = state.get("cards_completed", [])
    print(f"🔍 NODE_ENTRY: progress_node | card_idx: {current_card_index} | completed_count: {len(cards_completed)}")
    
    # Add current card to completed list
    if current_card:
        cards_completed.append(current_card["id"])
    
    # Move to next card
    next_card_index = current_card_index + 1
    
    # Generate transition message
    teacher = LLMTeacher()
    cards = state["lesson_snapshot"].get("cards", [])
    next_card = cards[next_card_index] if next_card_index < len(cards) else None
    
    transition_obj = teacher.transition_to_next_sync_full(
        completed_card=current_card,
        next_card=next_card,
        progress_context={
            "cards_completed": len(cards_completed),
            "total_cards": len(cards),
            "current_performance": state.get("is_correct", False)
        }
    )
    
    print(f"🚨 PROGRESS DEBUG - Moving from card {current_card_index} to {next_card_index}")
    print(f"🔍 NODE_EXIT: progress_node | from_card: {current_card_index} | to_card: {next_card_index} | next_stage: design")
    
    return {
        "current_card_index": next_card_index,
        "cards_completed": cards_completed,
        "stage": "design",  # Back to design for next card
        "student_response": None,
        "is_correct": None,
        "feedback": None,
        "attempts": 0,  # Reset attempts
        "messages": [transition_obj]
    }


def should_continue_from_design(state: InterruptUnifiedState) -> str:
    """Determine next step after design node."""
    should_exit = state.get("should_exit", False)
    stage = state.get("stage", "get_answer")
    
    if should_exit or stage == "done":
        print(f"🔍 ROUTING: should_continue_from_design -> END | should_exit: {should_exit} | stage: {stage}")
        return END
    
    print(f"🔍 ROUTING: should_continue_from_design -> {stage} | should_exit: {should_exit}")
    return stage


def should_continue_from_mark(state: InterruptUnifiedState) -> str:
    """Determine next step after marking."""
    should_progress = state.get("should_progress", False)
    next_node = "progress" if should_progress else "design"
    print(f"🔍 ROUTING: should_continue_from_mark -> {next_node} | should_progress: {should_progress}")
    return next_node


# Build the tool call + interrupt teaching graph
teaching_graph_toolcall = StateGraph(InterruptUnifiedState)

# Add nodes
teaching_graph_toolcall.add_node("design", design_node)
teaching_graph_toolcall.add_node("get_answer", get_answer_node)
teaching_graph_toolcall.add_node("mark", mark_node)
teaching_graph_toolcall.add_node("progress", progress_node)

# Add edges
teaching_graph_toolcall.add_edge(START, "design")

# From design: either go to get_answer or end if done
teaching_graph_toolcall.add_conditional_edges(
    "design",
    should_continue_from_design,
    {
        "get_answer": "get_answer",
        "mark": "mark",  # Direct to mark if we have response
        END: END
    }
)

# From get_answer: unconditional edge back to design (after user responds)
teaching_graph_toolcall.add_edge("get_answer", "design")

# From mark: go to progress if correct, back to design if incorrect
teaching_graph_toolcall.add_conditional_edges(
    "mark",
    should_continue_from_mark,
    {
        "progress": "progress",
        "design": "design"
    }
)

# From progress: always return to design for next card
teaching_graph_toolcall.add_edge("progress", "design")

# Compile the tool call + interrupt teaching graph
compiled_teaching_graph_toolcall = teaching_graph_toolcall.compile(checkpointer=True)