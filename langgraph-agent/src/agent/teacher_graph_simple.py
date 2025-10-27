"""Simplified LangGraph teaching loop following ChatGPT interrupt pattern.

This replaces the complex interrupt system with a direct, simple approach
that matches the ChatGPT example for purchase approval.
"""

from __future__ import annotations

from typing import Dict
from datetime import datetime
import json
import uuid

from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END
from langgraph.types import interrupt

try:
    from .simple_teaching_state import SimpleTeachingState
except ImportError:
    from agent.simple_teaching_state import SimpleTeachingState


def _is_lesson_complete(state: SimpleTeachingState) -> bool:
    """Check if all cards have been completed."""
    current_index = state.get("current_card_index", 0)
    lesson_snapshot = state.get("lesson_snapshot", {})
    cards = lesson_snapshot.get("cards", [])
    return current_index >= len(cards)


def _get_current_card_info(state: SimpleTeachingState) -> tuple[Dict, int, str]:
    """Extract current card, index, and CFU type."""
    current_index = state.get("current_card_index", 0)
    lesson_snapshot = state.get("lesson_snapshot", {})
    cards = lesson_snapshot.get("cards", [])
    
    if current_index >= len(cards):
        return {}, current_index, ""
    
    current_card = cards[current_index]
    cfu_type = current_card.get("cfu", {}).get("type", "text")
    return current_card, current_index, cfu_type


def _generate_lesson_content(state: SimpleTeachingState) -> str:
    """Generate lesson content using LLM teacher."""
    from .llm_teacher import LLMTeacher
    
    teacher = LLMTeacher()
    lesson_snapshot = state.get("lesson_snapshot", {})
    current_card, current_index, cfu_type = _get_current_card_info(state)
    
    if current_index == 0:
        # First card with greeting
        if cfu_type == "mcq":
            message_obj = teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card)
        else:
            message_obj = teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card)
    else:
        # Subsequent cards
        if cfu_type == "mcq":
            message_obj = teacher.present_mcq_card_sync_full(current_card)
        else:
            message_obj = teacher.present_card_sync_full(current_card, lesson_snapshot)
    
    return message_obj.content


def design_node_simple(state: SimpleTeachingState) -> Dict:
    """Present lesson card using direct interrupt (ChatGPT pattern)."""
    
    # Check if we have student response from previous interrupt
    if state.get("student_response") is not None:
        return {
            "current_stage": "mark",
            "student_response": state.get("student_response")
        }
    
    # Check if lesson is complete
    if _is_lesson_complete(state):
        # Generate lesson summary
        from .llm_teacher import LLMTeacher
        teacher = LLMTeacher()
        evidence = state.get("evidence", [])
        lesson_snapshot = state.get("lesson_snapshot", {})
        
        # Simple performance analysis
        total_cards = len(evidence) if evidence else 0
        correct_count = sum(1 for e in evidence if e.get("correct", False)) if evidence else 0
        overall_accuracy = correct_count / total_cards if total_cards > 0 else 0.0
        
        performance_analysis = {
            "overall_accuracy": overall_accuracy,
            "retry_recommended": overall_accuracy < 0.7
        }
        
        summary_message = teacher.summarize_completed_lesson_sync_full(
            lesson_snapshot=lesson_snapshot,
            evidence=evidence,
            performance_analysis=performance_analysis
        )
        
        # Direct interrupt for lesson completion (like ChatGPT approval)
        completion_response = interrupt({
            "tool": "lesson_summary_presentation",
            "args": {
                "lesson_summary": summary_message.content,
                "performance_analysis": performance_analysis,
                "evidence": evidence,
                "retry_recommended": performance_analysis.get("retry_recommended", False)
            }
        })
        
        return {
            "current_stage": "done",
            "should_exit": True,
            "messages": [summary_message]
        }
    
    # Generate lesson card content
    current_card, current_index, cfu_type = _get_current_card_info(state)
    lesson_content = _generate_lesson_content(state)
    
    # Create lesson context
    lesson_snapshot = state.get("lesson_snapshot", {})
    lesson_context = {
        "lesson_title": lesson_snapshot.get("title", "Scottish AI Lesson"),
        "student_name": state.get("student_id", "Student"),
        "progress": f"{current_index + 1}/{len(lesson_snapshot.get('cards', []))}"
    }
    
    # Direct interrupt for lesson card (like ChatGPT approval pattern)
    card_response = interrupt({
        "tool": "lesson_card_presentation",
        "args": {
            "card_content": lesson_content,
            "card_data": current_card,
            "card_index": current_index,
            "total_cards": len(lesson_snapshot.get("cards", [])),
            "cfu_type": cfu_type,
            "lesson_context": lesson_context,
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        }
    })
    
    # Process card response (similar to approval processing in ChatGPT)
    if card_response.get("action") == "submit_answer":
        return {
            "student_response": card_response.get("student_response"),
            "current_card": current_card,
            "current_card_index": current_index,
            "current_stage": "mark",
            "attempts": state.get("attempts", 0) + 1,
            "max_attempts": state.get("max_attempts", 3)
        }
    elif card_response.get("action") == "skip_card":
        return {
            "current_stage": "progress",
            "should_progress": True,
            "current_card": current_card,
            "current_card_index": current_index
        }
    else:
        # Default: continue to mark stage
        return {
            "student_response": card_response.get("student_response", ""),
            "current_card": current_card,
            "current_card_index": current_index,
            "current_stage": "mark",
            "attempts": state.get("attempts", 0) + 1,
            "max_attempts": state.get("max_attempts", 3)
        }


def mark_node_simple(state: SimpleTeachingState) -> Dict:
    """Evaluate student response and provide feedback using direct interrupt."""
    
    current_card = state.get("current_card", {})
    student_response = state.get("student_response", "")
    attempts = state.get("attempts", 1)
    max_attempts = state.get("max_attempts", 3)
    
    if not current_card or not student_response.strip():
        return {"current_stage": "design"}
    
    # Perform evaluation
    from .llm_teacher import LLMTeacher
    teacher = LLMTeacher()
    cfu = current_card["cfu"]
    
    # Handle MCQ vs text questions
    if cfu.get("type") == "mcq":
        options = cfu.get("options", [])
        answer_index = cfu.get("answerIndex")
        if answer_index is not None and 0 <= answer_index < len(options):
            expected_answer = {
                "correct_option": options[answer_index],
                "correct_index": answer_index,
                "all_options": options
            }
        else:
            expected_answer = None
    else:
        expected_answer = cfu.get("expected")
    
    evaluation = teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=expected_answer,
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
        "attempts": attempts,
        "feedback": evaluation.feedback
    }
    
    evidence = state.get("evidence", []).copy()
    evidence.append(evidence_entry)
    
    # Determine if should progress
    should_progress = evaluation.is_correct or (attempts >= max_attempts)
    
    # Direct interrupt for feedback (like ChatGPT approval)
    feedback_response = interrupt({
        "tool": "feedback_presentation",
        "args": {
            "is_correct": evaluation.is_correct,
            "feedback": evaluation.feedback,
            "confidence": evaluation.confidence,
            "attempts": attempts,
            "max_attempts": max_attempts,
            "show_explanation": attempts >= max_attempts and not evaluation.is_correct,
            "card_context": {
                "card_id": current_card.get("id"),
                "question": cfu.get("question", "")
            }
        }
    })
    
    if should_progress:
        return {
            "current_stage": "progress",
            "is_correct": evaluation.is_correct,
            "should_progress": True,
            "evidence": evidence,
            "student_response": None,  # Clear for next card
            "attempts": 0  # Reset for next card
        }
    else:
        return {
            "current_stage": "design",  # Try again
            "is_correct": evaluation.is_correct,
            "should_progress": False,
            "evidence": evidence,
            "student_response": None,  # Clear response
            "attempts": attempts  # Keep attempt count
        }


def progress_node_simple(state: SimpleTeachingState) -> Dict:
    """Handle progress to next card using direct interrupt."""
    
    current_card_index = state.get("current_card_index", 0)
    lesson_snapshot = state.get("lesson_snapshot", {})
    cards = lesson_snapshot.get("cards", [])
    cards_completed = state.get("cards_completed", []).copy()
    current_card = state.get("current_card", {})
    
    # Add current card to completed
    if current_card and current_card.get("id"):
        cards_completed.append(current_card["id"])
    
    # Calculate next card
    next_card_index = current_card_index + 1
    next_card = cards[next_card_index] if next_card_index < len(cards) else None
    
    # Generate transition message
    from .llm_teacher import LLMTeacher
    teacher = LLMTeacher()
    
    progress_context = {
        "cards_completed": len(cards_completed),
        "total_cards": len(cards),
        "current_performance": state.get("is_correct", False)
    }
    
    transition_obj = teacher.transition_to_next_sync_full(
        completed_card=current_card,
        next_card=next_card,
        progress_context=progress_context
    )
    
    if next_card:
        # Direct interrupt for progress acknowledgment (like ChatGPT)
        progress_response = interrupt({
            "tool": "progress_acknowledgment", 
            "args": {
                "transition_message": transition_obj.content,
                "progress_stats": {
                    "cards_completed": len(cards_completed),
                    "total_cards": len(cards),
                    "accuracy": sum(1 for e in state.get("evidence", []) if e.get("correct")) / max(len(state.get("evidence", [])), 1)
                },
                "next_card_preview": {
                    "title": next_card.get("title", "Next Topic"),
                    "explainer": next_card.get("explainer", "")[:100] + "..." if len(next_card.get("explainer", "")) > 100 else next_card.get("explainer", "")
                }
            }
        })
    
    return {
        "current_card_index": next_card_index,
        "cards_completed": cards_completed,
        "current_stage": "design",  # Start next card
        "student_response": None,
        "is_correct": None,
        "should_progress": None,
        "messages": [transition_obj] if next_card else []
    }


# Conditional routing functions (simplified)
def should_continue_from_design(state: SimpleTeachingState) -> str:
    """Route from design based on stage."""
    if state.get("should_exit", False):
        return END
    stage = state.get("current_stage", "mark")
    return stage if stage in ["mark", "progress"] else "mark"


def should_continue_from_mark(state: SimpleTeachingState) -> str:
    """Route from mark based on progression."""
    if state.get("should_progress", False):
        return "progress"
    else:
        return "design"  # Try again


# Build the simplified teaching graph
simple_teaching_graph = StateGraph(SimpleTeachingState)

# Add nodes
simple_teaching_graph.add_node("design", design_node_simple)
simple_teaching_graph.add_node("mark", mark_node_simple)
simple_teaching_graph.add_node("progress", progress_node_simple)

# Add edges
simple_teaching_graph.add_edge("__start__", "design")

simple_teaching_graph.add_conditional_edges(
    "design",
    should_continue_from_design,
    {
        "mark": "mark",
        "progress": "progress", 
        END: END
    }
)

simple_teaching_graph.add_conditional_edges(
    "mark",
    should_continue_from_mark,
    {
        "progress": "progress",
        "design": "design"
    }
)

simple_teaching_graph.add_edge("progress", "design")

# Compile the simplified teaching graph
# Checkpointing handled by LangGraph CLI (stored in .langraph_api)
compiled_simple_teaching_graph = simple_teaching_graph.compile()