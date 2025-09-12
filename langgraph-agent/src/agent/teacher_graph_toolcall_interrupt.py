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




def design_node(state: InterruptUnifiedState) -> Dict:
    """Design node - creates tool calls for lesson card presentation."""
    from .llm_teacher import LLMTeacher
    
    # Entry logging with FULL STATE DEBUG
    current_idx = state.get("current_card_index", 0)
    stage = state.get("stage", "unknown")
    
    print(f"🔍 NODE_ENTRY: design_node | card_idx: {current_idx} | stage: {stage}")
    
    # Check if we have a student_response in state (from get_answer_node)
    student_response = state.get("student_response")
    if student_response:
        print(f"🚨 DESIGN DEBUG - Found student_response in state: {student_response[:50]}...")
        current_card, current_index, cfu_type = _get_current_card_info(state)
        print(f"🔍 NODE_EXIT: design_node | decision: has_response | next_stage: mark")
        return {
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
    
    print(f"🚨 TOOL DEBUG - Created AIMessage with tool call for UI rendering")
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
        "pending_tool_call_id": tool_call_id,
        "student_response": None  # Clear any previous response
    }


def get_answer_node(state: InterruptUnifiedState) -> Dict:
    """Get answer node - interrupts with empty payload and processes sendCommand response."""
    current_idx = state.get("current_card_index", 0)
    print(f"🔍 NODE_ENTRY: get_answer_node | card_idx: {current_idx}")
    
    # DEBUG: Log state on entry
    print(f"🔍 STATE_DEBUG in get_answer_node:")
    print(f"  - current_card_index: {state.get('current_card_index', 'NOT SET')}")
    print(f"  - pending_tool_call_id: {state.get('pending_tool_call_id', 'NOT SET')}")
    print(f"  - message count: {len(state.get('messages', []))}")
    
    print(f"🚨 INTERRUPT DEBUG - About to interrupt with empty payload, waiting for sendCommand response")
    
    # Interrupt with EMPTY payload - frontend already has data from tool call
    response = interrupt({})
    
    # THIS CODE EXECUTES AFTER RESUME with response from sendCommand
    # COMPREHENSIVE DEBUG LOGGING
    print(f"🚨 INTERRUPT DEBUG - Raw response received: {response}")
    print(f"🚨 INTERRUPT DEBUG - Response type: {type(response)}")
    print(f"🚨 INTERRUPT DEBUG - Response repr: {repr(response)}")
    
    # Initialize payload and action
    payload = None
    action = None
    
    # Check if it's a string and what kind
    if isinstance(response, str):
        print(f"🚨 INTERRUPT DEBUG - Response is STRING")
        print(f"🚨 INTERRUPT DEBUG - String length: {len(response)}")
        print(f"🚨 INTERRUPT DEBUG - First 100 chars: {response[:100]}")
        
        # Try to parse as JSON
        import json
        try:
            payload = json.loads(response)
            print(f"🚨 INTERRUPT DEBUG - Successfully parsed JSON string")
            print(f"🚨 INTERRUPT DEBUG - Parsed payload type: {type(payload)}")
            print(f"🚨 INTERRUPT DEBUG - Parsed payload: {payload}")
            
            # Extract action from parsed payload
            action = payload.get("action") if isinstance(payload, dict) else None
            
        except json.JSONDecodeError as e:
            print(f"🚨 INTERRUPT DEBUG - JSON parse failed: {e}")
            payload = {"value": response}
            action = None
            
    elif isinstance(response, dict):
        print(f"🚨 INTERRUPT DEBUG - Response is DICT")
        print(f"🚨 INTERRUPT DEBUG - Dict keys: {response.keys()}")
        print(f"🚨 INTERRUPT DEBUG - Dict content: {response}")
        
        # Check for resume wrapper
        if "resume" in response:
            print(f"🚨 INTERRUPT DEBUG - Has 'resume' key")
            resume_value = response["resume"]
            # Parse JSON string if resume value is a string
            if isinstance(resume_value, str):
                import json
                try:
                    payload = json.loads(resume_value)
                    print(f"🚨 INTERRUPT DEBUG - Parsed JSON from resume string: {payload}")
                except json.JSONDecodeError:
                    # If not JSON, treat as simple string value
                    payload = {"value": resume_value}
                    print(f"🚨 INTERRUPT DEBUG - Simple string resume value: {resume_value}")
            else:
                payload = resume_value
                print(f"🚨 INTERRUPT DEBUG - Direct object resume value: {payload}")
        else:
            print(f"🚨 INTERRUPT DEBUG - No 'resume' key, using direct")
            payload = response
            print(f"🚨 INTERRUPT DEBUG - Using direct response (no resume wrapper): {payload}")
        
        action = payload.get("action") if isinstance(payload, dict) else None
    else:
        print(f"🚨 INTERRUPT DEBUG - Response is NEITHER string nor dict!")
        print(f"🚨 INTERRUPT DEBUG - Actual type: {type(response).__name__}")
        payload = {}
        action = None
    
    # Log extracted action
    print(f"🚨 INTERRUPT DEBUG - Final action extracted: {action}")
    
    if action == "submit_answer":
        student_response = payload.get("student_response", "") if payload else ""
        print(f"🚨 INTERRUPT DEBUG - Processing submit_answer with response: {student_response[:50] if student_response else 'EMPTY'}...")
        
        # Update state with the response
        print(f"🔍 NODE_EXIT: get_answer_node | action: submit_answer | next_stage: mark")
        return {
            "student_response": student_response,
            "stage": "mark",  # Route directly to mark
            "interrupt_response": payload  # Store payload for debugging
        }
    
    elif action == "skip_card":
        print(f"🚨 INTERRUPT DEBUG - Processing skip_card action")
        print(f"🔍 NODE_EXIT: get_answer_node | action: skip_card | next_stage: progress")
        return {
            "stage": "progress",
            "should_progress": True,
            "skip_reason": payload.get("reason", "Student chose to skip") if payload else "Student chose to skip",
            "interrupt_response": payload
        }
    
    # Fallback if response format unexpected
    print(f"🚨 INTERRUPT DEBUG - Unexpected response format or no action, returning to design")
    print(f"🚨 INTERRUPT DEBUG - Full response was: {response}")
    print(f"🚨 INTERRUPT DEBUG - Parsed payload was: {payload}")
    print(f"🔍 NODE_EXIT: get_answer_node | action: fallback | next_stage: design")
    return {
        "stage": "design",
        "interrupt_error": f"Unexpected response: {response}"
    }


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


# Named lambda for better LangSmith trace readability
get_answer_router = lambda state: state.get("stage", "design")

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

# From get_answer: conditional edges based on stage set by interrupt response
teaching_graph_toolcall.add_conditional_edges(
    "get_answer",
    get_answer_router,  # Named lambda for better traces
    {
        "mark": "mark",      # When submit_answer received
        "progress": "progress",  # When skip_card received  
        "design": "design"   # Fallback/error case
    }
)

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