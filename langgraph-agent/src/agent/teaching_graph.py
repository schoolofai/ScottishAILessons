"""LangGraph teaching loop for Scottish AI Lessons.

Implements the Design -> Delivery -> Mark -> Progress teaching loop.
"""

from __future__ import annotations

from typing import Dict
from datetime import datetime
import json
import uuid

from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
from langgraph.graph import StateGraph, END

try:
    from .shared_state import UnifiedState
except ImportError:
    from agent.shared_state import UnifiedState


def design_node(state: UnifiedState) -> Dict:
    """Design node: Router + Designer - Prepare cards OR route to appropriate stage."""
    from .llm_teacher import LLMTeacher
    
    # Get current state
    stage = state.get("stage", "design")
    student_response = state.get("student_response")
    
    # ROUTING LOGIC - If already in deliver stage with a response, skip design
    if stage == "deliver" and student_response:
        print(f"[DEBUG] design_node - ROUTING: stage=deliver with response, passing through")
        # We're resuming with an answer - don't regenerate the card message
        # Just pass through maintaining the current state
        return {
            "stage": "deliver",  # Maintain deliver stage
            "student_response": student_response,  # Keep the response
            # Don't add messages - avoid duplicate
        }
    
    # ROUTING LOGIC - If already in deliver stage without response (waiting state)
    if stage == "deliver" and not student_response:
        print(f"[DEBUG] design_node - ROUTING: stage=deliver without response, maintaining state")
        # Already delivered, waiting for response
        return {
            "stage": "deliver"
            # No new messages
        }
    
    # DESIGN LOGIC - Only execute if stage is "design" or we need a new card
    # This is where we actually design and present new content
    print(f"[DEBUG] design_node - DESIGNING: stage={stage}, preparing content")
    
    teacher = LLMTeacher()
    lesson_snapshot = state["lesson_snapshot"]
    
    # Initialize progression fields if not present (first time or missing from checkpointed state)
    current_index = state.get("current_card_index", 0)
    cards_completed = state.get("cards_completed", [])
    
    cards = lesson_snapshot.get("cards", [])
    
    print(f"[DEBUG] design_node - current_index: {current_index}, total_cards: {len(cards)}")
    
    if current_index >= len(cards):
        # No more cards, lesson complete
        # Progress node already generated completion message, so just end
        print(f"[DEBUG] Lesson complete - no more cards, ending without duplicate message")
        return {
            "current_card_index": current_index,
            "cards_completed": cards_completed,
            "stage": "done",
            "should_exit": True,
            "evidence": state.get("evidence", []),
            "mastery_updates": state.get("mastery_updates", []),
            # No messages - avoid duplicate completion message
        }
    
    current_card = cards[current_index]
    print(f"[DEBUG] Presenting card {current_index}: {current_card.get('id', 'unknown')}")
    
    # Generate conversational card presentation with CFU-type awareness
    cfu = current_card.get("cfu", {})
    cfu_type = cfu.get("type", "")
    print(f"[DEBUG] Card CFU type: {cfu_type}")
    
    if current_index == 0:
        # First card ONLY - check if MCQ and use appropriate greeting method
        if cfu_type == "mcq":
            print(f"[DEBUG] Using MCQ greeting for first card")
            message_obj = teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card)
            print(f"[DEBUG] Successfully generated MCQ greeting with first card")
        else:
            print(f"[DEBUG] Using standard greeting for first card")
            message_obj = teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card)
            print(f"[DEBUG] Successfully generated standard greeting with first card")
    else:
        # Subsequent cards (index 1, 2, etc.) - check if MCQ and use appropriate method
        if cfu_type == "mcq":
            print(f"[DEBUG] Using MCQ presentation for card {current_index}")
            message_obj = teacher.present_mcq_card_sync_full(current_card)
            print(f"[DEBUG] Successfully generated MCQ content for {current_card.get('title', 'unknown')}")
        else:
            print(f"[DEBUG] Using standard LLM card presentation for card {current_index}")
            message_obj = teacher.present_card_sync_full(current_card)
            print(f"[DEBUG] Successfully generated standard LLM card content for {current_card.get('title', 'unknown')}")
    
    return {
        "current_card": current_card,
        "current_card_index": current_index,
        "cards_completed": cards_completed,
        "stage": "deliver",
        "attempts": 0,
        "hint_level": 0,
        "max_attempts": state.get("max_attempts", 3),  # Default to 3, configurable per lesson
        "evidence": state.get("evidence", []),
        "mastery_updates": state.get("mastery_updates", []),
        "should_exit": False,
        "messages": [message_obj]
    }


def deliver_node(state: UnifiedState) -> Dict:
    """Delivery node: Check if we have student response to process."""
    # If we have a student response, proceed to marking
    # If not, stay in deliver mode (waiting for student input)
    student_response = state.get("student_response")
    
    if student_response and student_response.strip():
        return {"stage": "mark"}
    else:
        # No response yet, stay in deliver mode and wait
        # Return empty update to maintain state
        return {}


def mark_node(state: UnifiedState) -> Dict:
    """Mark node: Evaluate student response and provide feedback using LLM with structured output."""
    from .llm_teacher import LLMTeacher
    
    teacher = LLMTeacher()
    current_card = state["current_card"]
    student_response = state.get("student_response", "")
    attempts = state.get("attempts", 0) + 1
    max_attempts = state.get("max_attempts", 3)
    
    if not current_card or not student_response:
        return {"stage": "deliver"}
    
    cfu = current_card["cfu"]
    
    # Use structured LLM evaluation instead of deterministic logic
    evaluation = teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=cfu.get("expected"),
        card_context=current_card,
        attempt_number=attempts,
        max_attempts=max_attempts
    )
    
    # Extract evaluation results - keep correctness separate from progression
    is_correct = evaluation.is_correct
    feedback = evaluation.feedback
    
    # Deterministic progression logic (no LLM decision)
    should_progress = is_correct or (attempts >= max_attempts)
    
    # Record evidence with structured evaluation details
    evidence_entry = {
        "timestamp": datetime.now().isoformat(),
        "item_id": cfu["id"],
        "response": student_response,
        "correct": evaluation.is_correct,  # Original LLM decision
        "should_progress": should_progress,  # Code-based decision
        "confidence": evaluation.confidence,
        "partial_credit": evaluation.partial_credit,
        "reasoning": evaluation.reasoning,
        "attempts": attempts,
        "feedback": feedback,
        "max_attempts_reached": attempts >= max_attempts
    }
    
    evidence = state.get("evidence", [])
    evidence.append(evidence_entry)
    
    # If max attempts reached without success, provide correct answer explanation
    messages = []
    if attempts >= max_attempts and not is_correct:
        # Get previous attempts from evidence for context
        previous_attempts = [entry["response"] for entry in evidence if entry["item_id"] == cfu["id"]]
        
        explanation_message = teacher.explain_correct_answer_sync_full(
            current_card=current_card,
            student_attempts=previous_attempts
        )
        messages = [AIMessage(content=feedback), explanation_message]
    else:
        # Regular feedback only
        feedback_message = AIMessage(content=feedback)
        messages = [feedback_message]
    
    # Determine next stage based on deterministic progression
    next_stage = "progress" if should_progress else "deliver"
    
    return {
        "is_correct": is_correct,
        "should_progress": should_progress,
        "feedback": feedback,
        "attempts": attempts,
        "evidence": evidence,
        "stage": next_stage,
        "student_response": None,  # Clear student response after processing
        "messages": messages
    }


def progress_node(state: UnifiedState) -> Dict:
    """Progress node: Update mastery and move to next card."""
    from .llm_teacher import LLMTeacher
    
    teacher = LLMTeacher()
    current_card_index = state.get("current_card_index", 0)
    lesson_snapshot = state["lesson_snapshot"]
    cards = lesson_snapshot.get("cards", [])
    cards_completed = state.get("cards_completed", [])
    current_card = state.get("current_card")
    
    if current_card:
        cards_completed.append(current_card["id"])
    
    # Update mastery (simplified EMA calculation)
    outcome_refs = lesson_snapshot.get("outcomeRefs", [])
    mastery_updates = state.get("mastery_updates", [])
    
    for outcome in outcome_refs:
        # Simple mastery update based on correctness
        is_correct = state.get("is_correct", False)
        attempts = state.get("attempts", 1)
        
        # Calculate score (1.0 for first try, decreasing with attempts)
        score = 1.0 if is_correct and attempts == 1 else (0.7 if is_correct else 0.3)
        
        mastery_update = {
            "outcome_id": f"{outcome['unit']}_{outcome['outcome']}",
            "score": score,
            "timestamp": datetime.now().isoformat()
        }
        mastery_updates.append(mastery_update)
    
    # Move to next card
    next_card_index = current_card_index + 1
    next_card = cards[next_card_index] if next_card_index < len(cards) else None
    
    # Generate transition message
    transition_obj = teacher.transition_to_next_sync_full(
        completed_card=current_card,
        next_card=next_card,
        progress_context={
            "cards_completed": len(cards_completed),
            "total_cards": len(cards),
            "current_performance": state.get("is_correct", False)
        }
    )
    
    return {
        "current_card_index": next_card_index,
        "cards_completed": cards_completed,
        "mastery_updates": mastery_updates,
        "stage": "design",
        "student_response": None,
        "is_correct": None,
        "feedback": None,
        "messages": [transition_obj]
    }


def should_continue_from_design(state: UnifiedState) -> str:
    """Determine next step after design node."""
    if state.get("should_exit", False) or state.get("stage") == "done":
        return END
    return state.get("stage", "deliver")


def should_continue_from_mark(state: UnifiedState) -> str:
    """Determine next step after marking."""
    if state.get("should_progress", False):
        return "progress"
    else:
        return "deliver"


# Build the teaching graph
teaching_graph = StateGraph(UnifiedState)

# Add nodes
teaching_graph.add_node("design", design_node)
teaching_graph.add_node("deliver", deliver_node)
teaching_graph.add_node("mark", mark_node)
teaching_graph.add_node("progress", progress_node)

# Add edges with proper conditional routing
teaching_graph.add_edge("__start__", "design")

# From design: either continue to deliver or end if done
teaching_graph.add_conditional_edges(
    "design",
    should_continue_from_design,
    {
        "deliver": "deliver",
        END: END
    }
)

# From deliver: go to mark only if we have a response, otherwise end (wait for input)
def should_continue_from_deliver(state: UnifiedState) -> str:
    """Check if we should proceed to marking or wait for input."""
    student_response = state.get("student_response")
    if student_response and student_response.strip():
        return "mark"
    else:
        return END  # Wait for student input

teaching_graph.add_conditional_edges(
    "deliver",
    should_continue_from_deliver,
    {
        "mark": "mark",
        END: END
    }
)

# From mark: go to progress if correct, back to deliver if incorrect
teaching_graph.add_conditional_edges(
    "mark",
    should_continue_from_mark,
    {
        "progress": "progress",
        "deliver": "deliver"
    }
)

# From progress: always return to design for next card
teaching_graph.add_edge("progress", "design")

# Compile the teaching graph
compiled_teaching_graph = teaching_graph.compile(
    name="teaching_loop"
)