"""LangGraph teaching loop for Scottish AI Lessons.

Implements the Design -> Delivery -> Mark -> Progress teaching loop.
"""

from __future__ import annotations

from typing import Dict

from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

try:
    from .shared_state import UnifiedState
    from .teaching_utils import (
        _analyze_lesson_performance,
        _update_mastery_scores,
        _get_previous_attempts,
        _create_evidence_entry
    )
except ImportError:
    from agent.shared_state import UnifiedState
    from agent.teaching_utils import (
        _analyze_lesson_performance,
        _update_mastery_scores,
        _get_previous_attempts,
        _create_evidence_entry
    )


def _should_skip_design(state: UnifiedState) -> bool:
    """Check if we should skip design phase based on current state."""
    stage = state.get("stage", "design")
    student_response = state.get("student_response")
    return stage == "deliver" and student_response


def _is_waiting_for_response(state: UnifiedState) -> bool:
    """Check if already in deliver stage without response (waiting state)."""
    stage = state.get("stage", "design")
    student_response = state.get("student_response")
    return stage == "deliver" and not student_response


def _is_lesson_complete(state: UnifiedState) -> bool:
    """Check if all cards have been completed."""
    current_index = state.get("current_card_index", 0)
    cards = state["lesson_snapshot"].get("cards", [])
    return current_index >= len(cards)




def _create_detailed_completion_state(state: UnifiedState, summary_message) -> Dict:
    """Create enhanced state for lesson completion with LLM analysis."""
    evidence = state.get("evidence", [])
    performance_analysis = _analyze_lesson_performance(evidence)
    
    return {
        "current_card_index": state.get("current_card_index", 0),
        "cards_completed": state.get("cards_completed", []),
        "stage": "done",
        "should_exit": True,
        "evidence": evidence,
        "mastery_updates": state.get("mastery_updates", []),
        "lesson_summary": summary_message,
        "performance_analysis": performance_analysis,
        "retry_recommended": performance_analysis.get("retry_recommended", False),
        "messages": [summary_message]
    }




def _get_current_card_info(state: UnifiedState) -> tuple[dict, int, str]:
    """Extract current card, index, and CFU type."""
    current_index = state.get("current_card_index", 0)
    cards = state["lesson_snapshot"].get("cards", [])
    current_card = cards[current_index]
    cfu_type = current_card.get("cfu", {}).get("type", "")
    return current_card, current_index, cfu_type


def _generate_first_card_message(teacher, lesson_snapshot: dict, current_card: dict, cfu_type: str):
    """Generate message for the first card with appropriate greeting."""
    if cfu_type == "mcq":
        return teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card)
    else:
        return teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card)


def _generate_subsequent_card_message(teacher, lesson_snapshot: dict, current_card: dict, cfu_type: str):
    """Generate message for subsequent cards."""
    if cfu_type == "mcq":
        return teacher.present_mcq_card_sync_full(current_card)
    else:
        return teacher.present_card_sync_full(current_card, lesson_snapshot)


def _generate_card_message(teacher, lesson_snapshot: dict, current_card: dict, current_index: int, cfu_type: str):
    """Generate appropriate message based on card position and type."""
    if current_index == 0:
        return _generate_first_card_message(teacher, lesson_snapshot, current_card, cfu_type)
    else:
        return _generate_subsequent_card_message(teacher, lesson_snapshot, current_card, cfu_type)


def _create_delivery_state(state: UnifiedState, current_card: dict, current_index: int, message_obj) -> Dict:
    """Create state for card delivery phase."""
    return {
        "current_card": current_card,
        "current_card_index": current_index,
        "cards_completed": state.get("cards_completed", []),
        "stage": "deliver",
        "attempts": 0,
        "hint_level": 0,
        "max_attempts": state.get("max_attempts", 3),
        "evidence": state.get("evidence", []),
        "mastery_updates": state.get("mastery_updates", []),
        "should_exit": False,
        "messages": [message_obj]
    }


def design_node(state: UnifiedState) -> Dict:
    """Design node: Router + Designer - Prepare cards OR route to appropriate stage."""
    from .llm_teacher import LLMTeacher
    
    # Early routing checks
    if _should_skip_design(state):
        return {
            "stage": "deliver",
            "student_response": state.get("student_response"),
        }
    
    if _is_waiting_for_response(state):
        return {"stage": "deliver"}
    
    # Check lesson completion - now with enhanced LLM analysis
    if _is_lesson_complete(state):
        teacher = LLMTeacher()
        evidence = state.get("evidence", [])
        lesson_snapshot = state["lesson_snapshot"]
        
        # Analyze performance and generate comprehensive summary
        performance_analysis = _analyze_lesson_performance(evidence)
        summary_message = teacher.summarize_completed_lesson_sync_full(
            lesson_snapshot=lesson_snapshot,
            evidence=evidence,
            performance_analysis=performance_analysis
        )
        
        return _create_detailed_completion_state(state, summary_message)
    
    # Generate new card content
    teacher = LLMTeacher()
    current_card, current_index, cfu_type = _get_current_card_info(state)
    
    message_obj = _generate_card_message(
        teacher, state["lesson_snapshot"], current_card, current_index, cfu_type
    )
    
    return _create_delivery_state(state, current_card, current_index, message_obj)


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


def _validate_marking_inputs(current_card: dict, student_response: str) -> bool:
    """Validate that we have the required inputs for marking."""
    return bool(current_card and student_response)


def _extract_marking_context(state: UnifiedState) -> tuple[dict, str, int, int, dict]:
    """Extract all context needed for marking from state."""
    current_card = state["current_card"]
    student_response = state.get("student_response", "")
    attempts = state.get("attempts", 0) + 1
    max_attempts = state.get("max_attempts", 3)
    cfu = current_card["cfu"]
    return current_card, student_response, attempts, max_attempts, cfu


def _perform_llm_evaluation(teacher, student_response: str, cfu: dict, 
                          current_card: dict, attempts: int, max_attempts: int):
    """Perform structured LLM evaluation of student response."""
    # Handle MCQ questions differently - they use answerIndex instead of expected
    if cfu.get("type") == "mcq":
        options = cfu.get("options", [])
        answer_index = cfu.get("answerIndex")
        
        if answer_index is not None and 0 <= answer_index < len(options):
            correct_option = options[answer_index]
            # Include both the correct option and context for evaluation
            expected_answer = {
                "correct_option": correct_option,
                "correct_index": answer_index,
                "correct_human_index": answer_index + 1,  # 1-indexed for humans
                "all_options": options
            }
        else:
            expected_answer = None
    else:
        # For non-MCQ questions, use the expected field
        expected_answer = cfu.get("expected")
    
    return teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=expected_answer,
        card_context=current_card,
        attempt_number=attempts,
        max_attempts=max_attempts
    )


def _determine_progression(evaluation, attempts: int, max_attempts: int) -> bool:
    """Determine if student should progress based on evaluation and attempts."""
    return evaluation.is_correct or (attempts >= max_attempts)






def _create_feedback_messages(teacher, evaluation, attempts: int, max_attempts: int, 
                             current_card: dict, evidence: list, cfu: dict) -> list:
    """Create appropriate feedback messages based on evaluation and attempt count."""
    messages = []
    
    if attempts >= max_attempts and not evaluation.is_correct:
        # Max attempts reached - provide explanation
        previous_attempts = _get_previous_attempts(evidence, cfu["id"])
        explanation_message = teacher.explain_correct_answer_sync_full(
            current_card=current_card,
            student_attempts=previous_attempts
        )
        messages = [AIMessage(content=evaluation.feedback), explanation_message]
    else:
        # Regular feedback only
        feedback_message = AIMessage(content=evaluation.feedback)
        messages = [feedback_message]
    
    return messages


def _create_marking_result(evaluation, should_progress: bool, attempts: int, 
                          evidence: list, messages: list) -> Dict:
    """Create the final marking result state."""
    next_stage = "progress" if should_progress else "deliver"
    
    return {
        "is_correct": evaluation.is_correct,
        "should_progress": should_progress,
        "feedback": evaluation.feedback,
        "attempts": attempts,
        "evidence": evidence,
        "stage": next_stage,
        "student_response": None,  # Clear student response after processing
        "messages": messages
    }


def mark_node(state: UnifiedState) -> Dict:
    """Mark node: Evaluate student response and provide feedback using LLM with structured output."""
    from .llm_teacher import LLMTeacher
    
    # Extract and validate inputs
    current_card, student_response, attempts, max_attempts, cfu = _extract_marking_context(state)
    
    if not _validate_marking_inputs(current_card, student_response):
        return {"stage": "deliver"}
    
    # Perform evaluation and determine progression
    teacher = LLMTeacher()
    evaluation = _perform_llm_evaluation(teacher, student_response, cfu, current_card, attempts, max_attempts)
    should_progress = _determine_progression(evaluation, attempts, max_attempts)
    
    # Record evidence
    evidence_entry = _create_evidence_entry(evaluation, student_response, cfu, attempts, should_progress, max_attempts)
    evidence = state.get("evidence", [])
    evidence.append(evidence_entry)
    
    # Create feedback messages
    messages = _create_feedback_messages(teacher, evaluation, attempts, max_attempts, current_card, evidence, cfu)
    
    # Return final result
    return _create_marking_result(evaluation, should_progress, attempts, evidence, messages)


def _extract_progress_context(state: UnifiedState) -> tuple[int, dict, list, list, dict]:
    """Extract context needed for progress processing from state."""
    current_card_index = state.get("current_card_index", 0)
    lesson_snapshot = state["lesson_snapshot"]
    cards = lesson_snapshot.get("cards", [])
    cards_completed = state.get("cards_completed", [])
    current_card = state.get("current_card")
    return current_card_index, lesson_snapshot, cards, cards_completed, current_card


def _update_cards_completed(cards_completed: list, current_card: dict) -> list:
    """Add current card to completed cards list."""
    if current_card:
        cards_completed.append(current_card["id"])
    return cards_completed








def _get_next_card_info(cards: list, current_card_index: int) -> tuple[int, dict]:
    """Calculate next card index and get next card if available."""
    next_card_index = current_card_index + 1
    next_card = cards[next_card_index] if next_card_index < len(cards) else None
    return next_card_index, next_card


def _create_progress_context(cards_completed: list, cards: list, state: UnifiedState) -> dict:
    """Create context dictionary for progress transition message."""
    return {
        "cards_completed": len(cards_completed),
        "total_cards": len(cards),
        "current_performance": state.get("is_correct", False)
    }


def _generate_transition_message(teacher, current_card: dict, next_card: dict, progress_context: dict):
    """Generate transition message for moving to next card."""
    return teacher.transition_to_next_sync_full(
        completed_card=current_card,
        next_card=next_card,
        progress_context=progress_context
    )


def _create_progress_result(next_card_index: int, cards_completed: list, mastery_updates: list, transition_obj) -> Dict:
    """Create the final progress result state."""
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


def progress_node(state: UnifiedState) -> Dict:
    """Progress node: Update mastery and move to next card."""
    from .llm_teacher import LLMTeacher
    
    # Extract context and update completed cards
    current_card_index, lesson_snapshot, cards, cards_completed, current_card = _extract_progress_context(state)
    cards_completed = _update_cards_completed(cards_completed, current_card)
    
    # Update mastery scores
    mastery_updates = _update_mastery_scores(lesson_snapshot, state, state.get("mastery_updates", []))
    
    # Calculate next card navigation
    next_card_index, next_card = _get_next_card_info(cards, current_card_index)
    
    # Generate transition message
    teacher = LLMTeacher()
    progress_context = _create_progress_context(cards_completed, cards, state)
    transition_obj = _generate_transition_message(teacher, current_card, next_card, progress_context)
    
    # Return final result
    return _create_progress_result(next_card_index, cards_completed, mastery_updates, transition_obj)


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