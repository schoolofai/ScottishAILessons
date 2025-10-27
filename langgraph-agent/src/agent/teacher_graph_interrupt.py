"""LangGraph teaching loop with interrupt-enabled UI interactions.

Implements the Design -> Delivery -> Mark -> Progress teaching loop using
LangGraph interrupts to present lesson cards as interactive UI components
through Assistant-UI's generative interface system.
"""

from __future__ import annotations

from typing import Dict
from datetime import datetime
import uuid

from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

try:
    from .interrupt_state import InterruptUnifiedState
    from .interrupt_tools import (
        create_feedback_interrupt,
        create_progress_interrupt,
        create_lesson_summary_interrupt,
        process_feedback_interaction_response,
        should_use_interrupts,
        update_interrupt_history
    )
    from .teaching_utils import parse_outcome_refs
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState
    from agent.interrupt_tools import (
        create_feedback_interrupt,
        create_progress_interrupt,
        create_lesson_summary_interrupt,
        process_feedback_interaction_response,
        should_use_interrupts,
        update_interrupt_history
    )
    from agent.teaching_utils import parse_outcome_refs


def _should_skip_design(state: InterruptUnifiedState) -> bool:
    """Check if we should skip design phase based on current state."""
    stage = state.get("stage", "design")
    student_response = state.get("student_response")
    return stage == "deliver" and student_response


def _is_waiting_for_response(state: InterruptUnifiedState) -> bool:
    """Check if already in deliver stage without response (waiting state)."""
    stage = state.get("stage", "design")
    student_response = state.get("student_response")
    return stage == "deliver" and not student_response


def _is_lesson_complete(state: InterruptUnifiedState) -> bool:
    """Check if all cards have been completed."""
    current_index = state.get("current_card_index", 0)
    cards = state["lesson_snapshot"].get("cards", [])
    return current_index >= len(cards)


def _analyze_lesson_performance(evidence: list) -> dict:
    """Analyze student performance from evidence data."""
    if not evidence:
        return {
            "overall_accuracy": 0.0,
            "first_attempt_success": 0.0,
            "average_attempts": 0.0,
            "strong_areas": [],
            "challenge_areas": [],
            "retry_recommended": True
        }
    
    # Calculate basic metrics
    correct_count = sum(1 for entry in evidence if entry.get("correct", False))
    total_count = len(evidence)
    overall_accuracy = correct_count / total_count if total_count > 0 else 0.0
    
    # Calculate first attempt success rate
    first_attempt_correct = sum(1 for entry in evidence 
                               if entry.get("correct", False) and entry.get("attempts", 1) == 1)
    first_attempt_success = first_attempt_correct / total_count if total_count > 0 else 0.0
    
    # Calculate average attempts
    total_attempts = sum(entry.get("attempts", 1) for entry in evidence)
    average_attempts = total_attempts / total_count if total_count > 0 else 0.0
    
    # Identify areas of strength and challenge (simplified analysis)
    strong_areas = []
    challenge_areas = []
    
    # Check for patterns in confidence and partial credit
    high_confidence_correct = sum(1 for entry in evidence 
                                 if entry.get("correct", False) and entry.get("confidence", 0) > 0.8)
    low_confidence_incorrect = sum(1 for entry in evidence 
                                  if not entry.get("correct", False) and entry.get("confidence", 0) < 0.5)
    
    if high_confidence_correct >= total_count * 0.6:
        strong_areas.append("Clear understanding of key concepts")
    if low_confidence_incorrect >= total_count * 0.3:
        challenge_areas.append("Areas requiring additional practice")
    
    # Recommendation logic
    retry_recommended = (
        overall_accuracy < 0.7 or  # Less than 70% accuracy
        first_attempt_success < 0.5 or  # Less than 50% first-attempt success
        average_attempts > 2.5  # Taking too many attempts on average
    )
    
    return {
        "overall_accuracy": overall_accuracy,
        "first_attempt_success": first_attempt_success,
        "average_attempts": average_attempts,
        "strong_areas": strong_areas,
        "challenge_areas": challenge_areas,
        "retry_recommended": retry_recommended
    }


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
        # Subsequent cards - pass lesson_snapshot for context
        if cfu_type == "mcq":
            return teacher.present_mcq_card_sync_full(current_card)
        else:
            return teacher.present_card_sync_full(current_card, lesson_snapshot)


def design_node_interrupt(state: InterruptUnifiedState) -> Dict:
    """Design node with interrupt-based card presentation."""
    from .llm_teacher import LLMTeacher
    
    # Early routing checks
    if _should_skip_design(state):
        return {
            "stage": "deliver",
            "student_response": state.get("student_response"),
        }
    
    if _is_waiting_for_response(state):
        return {"stage": "deliver"}
    
    # Check lesson completion - use interrupt for enhanced summary
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
        
        # Use interrupt for lesson completion if supported
        if should_use_interrupts(state):
            try:
                completion_response = create_lesson_summary_interrupt(
                    lesson_summary=summary_message.content,
                    performance_analysis=performance_analysis,
                    evidence=evidence,
                    retry_recommended=performance_analysis.get("retry_recommended", False)
                )
                
                # Update interrupt history
                interrupt_history = update_interrupt_history(
                    state, "lesson_summary", 
                    {"performance_analysis": performance_analysis}, 
                    completion_response
                )
                
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
                    "interrupt_history": interrupt_history,
                    "last_interrupt_type": "lesson_summary",
                    "user_interaction_response": completion_response,
                    "messages": [summary_message] if completion_response.get("fallback_to_messages") else []
                }
            except Exception as e:
                # Fallback to regular message display
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
                    "interrupt_errors": state.get("interrupt_errors", []) + [str(e)],
                    "fallback_to_messages": True,
                    "messages": [summary_message]
                }
        else:
            # Regular completion without interrupts
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
    
    # Generate new card content
    teacher = LLMTeacher()
    current_card, current_index, cfu_type = _get_current_card_info(state)
    
    message_obj = _generate_card_message(
        teacher, state["lesson_snapshot"], current_card, current_index, cfu_type
    )
    
    # 🚨 INTERRUPT DEBUG: Check if interrupts should be used
    should_interrupt = should_use_interrupts(state)
    print(f"🚨 INTERRUPT DEBUG - should_use_interrupts(): {should_interrupt}")
    print(f"🚨 INTERRUPT DEBUG - fallback_to_messages: {state.get('fallback_to_messages', False)}")
    print(f"🚨 INTERRUPT DEBUG - interrupt_errors count: {len(state.get('interrupt_errors', []))}")
    
    lesson_context = {
        "lesson_title": state["lesson_snapshot"].get("title", "Scottish AI Lesson"),
        "student_name": state.get("student_id", "Student"),
        "progress": f"{current_index + 1}/{len(state['lesson_snapshot'].get('cards', []))}"
    }
    
    interrupt_payload = {
        "tool": "lesson_card_presentation",
        "args": {
            "card_content": message_obj.content,
            "card_data": current_card,
            "card_index": current_index,
            "total_cards": len(state["lesson_snapshot"].get("cards", [])),
            "cfu_type": cfu_type,
            "lesson_context": lesson_context,
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        }
    }
    
    print(f"🚨 INTERRUPT DEBUG - About to call interrupt() with payload:")
    print(f"🚨 INTERRUPT DEBUG - Tool: {interrupt_payload['tool']}")
    print(f"🚨 INTERRUPT DEBUG - Card Index: {interrupt_payload['args']['card_index']}")
    print(f"🚨 INTERRUPT DEBUG - Card ID: {interrupt_payload['args']['card_data']['id']}")
    print(f"🚨 INTERRUPT DEBUG - Full payload: {interrupt_payload}")
    
    # Use real LangGraph interrupt - NO FALLBACK, FAIL FAST
    from langgraph.types import interrupt
    
    print(f"🚨 INTERRUPT DEBUG - Calling interrupt() now...")
    card_response = interrupt(interrupt_payload)
    print(f"🚨 INTERRUPT DEBUG - interrupt() returned: {card_response}")
    
    # Process interrupt response (like simplified version)
    print(f"🚨 INTERRUPT DEBUG - Processing response action: {card_response.get('action')}")
    if card_response.get("action") == "submit_answer":
        return {
            "student_response": card_response.get("student_response"),
            "current_card": current_card,
            "current_card_index": current_index,
            "stage": "mark",
            "attempts": state.get("attempts", 0) + 1,
            "max_attempts": state.get("max_attempts", 3)
        }
    elif card_response.get("action") == "skip_card":
        return {
            "stage": "progress",
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
            "stage": "mark",
            "attempts": state.get("attempts", 0) + 1,
            "max_attempts": state.get("max_attempts", 3)
        }


def deliver_node_interrupt(state: InterruptUnifiedState) -> Dict:
    """Delivery node: Check for student response from interrupt or regular input."""
    # Check if we have a response from interrupt-based card interaction
    user_interaction = state.get("user_interaction_response")
    if user_interaction and user_interaction.get("student_response"):
        return {
            "stage": "mark",
            "student_response": user_interaction["student_response"]
        }
    
    # Check for regular student response (from messages)
    student_response = state.get("student_response")
    if student_response and student_response.strip():
        return {"stage": "mark"}
    else:
        # No response yet, stay in deliver mode and wait
        return {}


def _validate_marking_inputs(current_card: dict, student_response: str) -> bool:
    """Validate that we have the required inputs for marking."""
    return bool(current_card and student_response)


def _extract_marking_context(state: InterruptUnifiedState) -> tuple[dict, str, int, int, dict]:
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


def _create_evidence_entry(evaluation, student_response: str, cfu: dict, 
                          attempts: int, should_progress: bool, max_attempts: int) -> dict:
    """Create evidence entry for student response evaluation."""
    return {
        "timestamp": datetime.now().isoformat(),
        "item_id": cfu["id"],
        "response": student_response,
        "correct": evaluation.is_correct,
        "should_progress": should_progress,
        "confidence": evaluation.confidence,
        "partial_credit": evaluation.partial_credit,
        "reasoning": evaluation.reasoning,
        "attempts": attempts,
        "feedback": evaluation.feedback,
        "max_attempts_reached": attempts >= max_attempts
    }


def _get_previous_attempts(evidence: list, item_id: str) -> list[str]:
    """Extract previous attempts for this item from evidence."""
    return [entry["response"] for entry in evidence if entry["item_id"] == item_id]


def mark_node_interrupt(state: InterruptUnifiedState) -> Dict:
    """Mark node with interrupt-based feedback presentation."""
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
    
    # Determine if explanation should be shown
    show_explanation = attempts >= max_attempts and not evaluation.is_correct
    
    # Use real interrupt for feedback presentation if supported
    if should_use_interrupts(state):
        try:
            from langgraph.types import interrupt
            
            feedback_response = interrupt({
                "tool": "feedback_presentation",
                "args": {
                    "is_correct": evaluation.is_correct,
                    "feedback": evaluation.feedback,
                    "confidence": evaluation.confidence,
                    "attempts": attempts,
                    "max_attempts": max_attempts,
                    "show_explanation": show_explanation,
                    "card_context": {
                        "card_id": current_card.get("id"),
                        "question": cfu.get("question", "")
                    }
                }
            })
            
            if should_progress:
                return {
                    "stage": "progress",
                    "is_correct": evaluation.is_correct,
                    "should_progress": True,
                    "evidence": evidence,
                    "student_response": None,  # Clear for next card
                    "attempts": 0  # Reset for next card
                }
            else:
                return {
                    "stage": "design",  # Try again
                    "is_correct": evaluation.is_correct,
                    "should_progress": False,
                    "evidence": evidence,
                    "student_response": None,  # Clear response
                    "attempts": attempts  # Keep attempt count
                }
        except Exception as e:
            # Fallback to regular message flow
            next_stage = "progress" if should_progress else "deliver"
            return {
                "is_correct": evaluation.is_correct,
                "should_progress": should_progress,
                "feedback": evaluation.feedback,
                "attempts": attempts,
                "evidence": evidence,
                "stage": next_stage,
                "student_response": None,
                "interrupt_errors": state.get("interrupt_errors", []) + [str(e)],
                "fallback_to_messages": True,
                "messages": [AIMessage(content=evaluation.feedback)]
            }
    else:
        # Regular message-based feedback
        next_stage = "progress" if should_progress else "deliver"
        
        # Create feedback messages
        messages = [AIMessage(content=evaluation.feedback)]
        if show_explanation:
            previous_attempts = _get_previous_attempts(evidence, cfu["id"])
            explanation_message = teacher.explain_correct_answer_sync_full(
                current_card=current_card,
                student_attempts=previous_attempts
            )
            messages.append(explanation_message)
        
        return {
            "is_correct": evaluation.is_correct,
            "should_progress": should_progress,
            "feedback": evaluation.feedback,
            "attempts": attempts,
            "evidence": evidence,
            "stage": next_stage,
            "student_response": None,
            "messages": messages
        }


def _extract_progress_context(state: InterruptUnifiedState) -> tuple[int, dict, list, list, dict]:
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


def _calculate_mastery_score(is_correct: bool, attempts: int) -> float:
    """Calculate mastery score based on correctness and attempts."""
    return 1.0 if is_correct and attempts == 1 else (0.7 if is_correct else 0.3)


def _create_mastery_update(outcome: dict, score: float) -> dict:
    """Create a single mastery update entry."""
    return {
        "outcome_id": f"{outcome['unit']}_{outcome['outcome']}",
        "score": score,
        "timestamp": datetime.now().isoformat()
    }


def _update_mastery_scores(lesson_snapshot: dict, state: InterruptUnifiedState, existing_updates: list) -> list:
    """Calculate and append new mastery updates based on student performance."""
    outcome_refs = parse_outcome_refs(lesson_snapshot.get("outcomeRefs", []))
    mastery_updates = existing_updates.copy()
    
    is_correct = state.get("is_correct", False)
    attempts = state.get("attempts", 1)
    score = _calculate_mastery_score(is_correct, attempts)
    
    for outcome in outcome_refs:
        mastery_update = _create_mastery_update(outcome, score)
        mastery_updates.append(mastery_update)
    
    return mastery_updates


def _get_next_card_info(cards: list, current_card_index: int) -> tuple[int, dict]:
    """Calculate next card index and get next card if available."""
    next_card_index = current_card_index + 1
    next_card = cards[next_card_index] if next_card_index < len(cards) else None
    return next_card_index, next_card


def _create_progress_context(cards_completed: list, cards: list, state: InterruptUnifiedState) -> dict:
    """Create context dictionary for progress transition message."""
    return {
        "cards_completed": len(cards_completed),
        "total_cards": len(cards),
        "current_performance": state.get("is_correct", False)
    }


def progress_node_interrupt(state: InterruptUnifiedState) -> Dict:
    """Progress node with interrupt-based transition presentation."""
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
    transition_obj = teacher.transition_to_next_sync_full(
        completed_card=current_card,
        next_card=next_card,
        progress_context=progress_context
    )
    
    # Use interrupt for progress presentation if supported and not the last card
    if should_use_interrupts(state) and next_card:
        try:
            progress_stats = {
                "cards_completed": len(cards_completed),
                "total_cards": len(cards),
                "accuracy": sum(1 for e in state.get("evidence", []) if e.get("correct")) / max(len(state.get("evidence", [])), 1),
                "current_streak": state.get("current_streak", 0)
            }
            
            next_card_preview = {
                "title": next_card.get("title", "Next Topic"),
                "explainer": next_card.get("explainer", "")[:100] + "..." if len(next_card.get("explainer", "")) > 100 else next_card.get("explainer", "")
            } if next_card else None
            
            progress_response = create_progress_interrupt(
                transition_message=transition_obj.content,
                progress_stats=progress_stats,
                next_card_preview=next_card_preview
            )
            
            # Update interrupt history
            interrupt_history = update_interrupt_history(
                state, "progress",
                {"card_completed": current_card.get("id"), "next_card": next_card.get("id") if next_card else None},
                progress_response
            )
            
            return {
                "current_card_index": next_card_index,
                "cards_completed": cards_completed,
                "mastery_updates": mastery_updates,
                "stage": "design",
                "student_response": None,
                "is_correct": None,
                "feedback": None,
                "interrupt_history": interrupt_history,
                "last_interrupt_type": "progress",
                "user_interaction_response": progress_response,
                "messages": [] if not progress_response.get("fallback_to_messages") else [transition_obj]
            }
        except Exception as e:
            # Fallback to regular message flow
            return {
                "current_card_index": next_card_index,
                "cards_completed": cards_completed,
                "mastery_updates": mastery_updates,
                "stage": "design",
                "student_response": None,
                "is_correct": None,
                "feedback": None,
                "interrupt_errors": state.get("interrupt_errors", []) + [str(e)],
                "fallback_to_messages": True,
                "messages": [transition_obj]
            }
    else:
        # Regular message-based progress
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


def should_continue_from_design(state: InterruptUnifiedState) -> str:
    """Determine next step after design node."""
    if state.get("should_exit", False) or state.get("stage") == "done":
        return END
    return state.get("stage", "deliver")


def should_continue_from_mark(state: InterruptUnifiedState) -> str:
    """Determine next step after marking."""
    if state.get("should_progress", False):
        return "progress"
    else:
        return "deliver"


def should_continue_from_deliver(state: InterruptUnifiedState) -> str:
    """Check if we should proceed to marking or wait for input."""
    student_response = state.get("student_response")
    user_interaction = state.get("user_interaction_response", {})
    
    if (student_response and student_response.strip()) or user_interaction.get("student_response"):
        return "mark"
    else:
        return END  # Wait for student input


# Build the interrupt-enabled teaching graph
teaching_graph_interrupt = StateGraph(InterruptUnifiedState)

# Add nodes
teaching_graph_interrupt.add_node("design", design_node_interrupt)
teaching_graph_interrupt.add_node("deliver", deliver_node_interrupt)
teaching_graph_interrupt.add_node("mark", mark_node_interrupt)
teaching_graph_interrupt.add_node("progress", progress_node_interrupt)

# Add edges with proper conditional routing
teaching_graph_interrupt.add_edge("__start__", "design")

# From design: either continue to deliver or end if done
teaching_graph_interrupt.add_conditional_edges(
    "design",
    should_continue_from_design,
    {
        "deliver": "deliver",
        END: END
    }
)

# From deliver: go to mark only if we have a response, otherwise end (wait for input)
teaching_graph_interrupt.add_conditional_edges(
    "deliver",
    should_continue_from_deliver,
    {
        "mark": "mark",
        END: END
    }
)

# From mark: go to progress if correct, back to deliver if incorrect
teaching_graph_interrupt.add_conditional_edges(
    "mark",
    should_continue_from_mark,
    {
        "progress": "progress",
        "deliver": "deliver"
    }
)

# From progress: always return to design for next card
teaching_graph_interrupt.add_edge("progress", "design")

# Compile the interrupt-enabled teaching graph
# Checkpointing is handled implicitly by LangGraph CLI in dev mode (stored in .langraph_api)
compiled_teaching_graph_interrupt = teaching_graph_interrupt.compile()