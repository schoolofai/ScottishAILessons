"""Helper utilities for interrupt handling in LangGraph teaching graphs.

Provides wrapper functions for interrupt() calls, response processing,
and error handling for the interactive lesson card system.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from langchain_core.messages import AIMessage
from langgraph.types import interrupt

try:
    from .interrupt_state import InterruptUnifiedState
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState


def create_lesson_card_interrupt(
    card_content: str,
    card_data: Dict[str, Any],
    card_index: int,
    total_cards: int,
    lesson_context: Dict[str, Any]
) -> Dict[str, Any]:
    """Create interrupt for lesson card presentation.
    
    Args:
        card_content: Generated lesson content with question
        card_data: Raw card data structure
        card_index: Current card index (0-based)
        total_cards: Total number of cards in lesson
        lesson_context: Additional context for the lesson
        
    Returns:
        User response from the lesson card Tool UI
    """
    cfu_type = card_data.get("cfu", {}).get("type", "text")
    
    interrupt_data = {
        "tool": "lesson_card_presentation",
        "args": {
            "card_content": card_content,
            "card_data": card_data,
            "card_index": card_index,
            "total_cards": total_cards,
            "cfu_type": cfu_type,
            "lesson_context": lesson_context,
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        },
        "config": {
            "timeout": 300,  # 5 minute timeout for card interaction
            "allow_partial": False,  # Require complete response
            "retry_on_error": True
        }
    }
    
    try:
        response = interrupt(interrupt_data)
        return response
    except Exception as e:
        # Log error and return fallback response
        print(f"Interrupt error in lesson card: {e}")
        return {
            "action": "error",
            "error": str(e),
            "fallback_to_messages": True
        }


def create_feedback_interrupt(
    evaluation: Any,
    attempts: int,
    max_attempts: int,
    current_card: Dict[str, Any],
    show_explanation: bool = False
) -> Dict[str, Any]:
    """Create interrupt for feedback presentation.
    
    Args:
        evaluation: LLM evaluation response with feedback
        attempts: Current attempt number
        max_attempts: Maximum attempts allowed
        current_card: Current card data
        show_explanation: Whether to show detailed explanation
        
    Returns:
        User response from feedback Tool UI
    """
    interrupt_data = {
        "tool": "feedback_presentation",
        "args": {
            "is_correct": evaluation.is_correct,
            "feedback": evaluation.feedback,
            "confidence": evaluation.confidence,
            "reasoning": evaluation.reasoning,
            "partial_credit": evaluation.partial_credit,
            "attempts": attempts,
            "max_attempts": max_attempts,
            "show_explanation": show_explanation,
            "card_context": {
                "card_id": current_card.get("id"),
                "question": current_card.get("cfu", {}).get("question", ""),
                "expected_answer": current_card.get("cfu", {}).get("expected")
            },
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        },
        "config": {
            "timeout": 180,  # 3 minute timeout for feedback review
            "require_acknowledgment": True
        }
    }
    
    try:
        response = interrupt(interrupt_data)
        return response
    except Exception as e:
        print(f"Interrupt error in feedback: {e}")
        return {
            "action": "acknowledge",
            "error": str(e),
            "fallback_to_messages": True
        }


def create_progress_interrupt(
    transition_message: str,
    progress_stats: Dict[str, Any],
    next_card_preview: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create interrupt for progress acknowledgment.
    
    Args:
        transition_message: Generated transition message
        progress_stats: Progress statistics and metrics
        next_card_preview: Preview of next card (if available)
        
    Returns:
        User response from progress Tool UI
    """
    interrupt_data = {
        "tool": "progress_acknowledgment",
        "args": {
            "transition_message": transition_message,
            "progress_stats": progress_stats,
            "next_card_preview": next_card_preview,
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        },
        "config": {
            "timeout": 120,  # 2 minute timeout for progress acknowledgment
            "auto_continue": True  # Allow automatic continuation
        }
    }
    
    try:
        response = interrupt(interrupt_data)
        return response
    except Exception as e:
        print(f"Interrupt error in progress: {e}")
        return {
            "action": "continue",
            "error": str(e),
            "fallback_to_messages": True
        }


def create_lesson_summary_interrupt(
    lesson_summary: str,
    performance_analysis: Dict[str, Any],
    evidence: List[Dict[str, Any]],
    retry_recommended: bool
) -> Dict[str, Any]:
    """Create interrupt for lesson completion summary.
    
    Args:
        lesson_summary: LLM-generated lesson summary
        performance_analysis: Detailed performance metrics
        evidence: Student response evidence
        retry_recommended: Whether retry is recommended
        
    Returns:
        User response from lesson summary Tool UI
    """
    interrupt_data = {
        "tool": "lesson_summary_presentation",
        "args": {
            "lesson_summary": lesson_summary,
            "performance_analysis": performance_analysis,
            "evidence": evidence,
            "retry_recommended": retry_recommended,
            "completion_stats": {
                "total_cards": len(evidence),
                "correct_answers": sum(1 for e in evidence if e.get("correct", False)),
                "average_attempts": sum(e.get("attempts", 1) for e in evidence) / len(evidence) if evidence else 0
            },
            "interaction_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat()
        },
        "config": {
            "timeout": 300,  # 5 minute timeout for final review
            "allow_retry": True,
            "show_detailed_analysis": True
        }
    }
    
    try:
        response = interrupt(interrupt_data)
        return response
    except Exception as e:
        print(f"Interrupt error in lesson summary: {e}")
        return {
            "action": "complete",
            "error": str(e),
            "fallback_to_messages": True
        }


def process_card_interaction_response(
    user_response: Dict[str, Any],
    state: InterruptUnifiedState
) -> Dict[str, Any]:
    """Process user response from lesson card interaction.
    
    Args:
        user_response: Response data from Tool UI
        state: Current state
        
    Returns:
        State updates based on user interaction
    """
    if user_response.get("action") == "submit_answer":
        return {
            "user_interaction_response": user_response,
            "student_response": user_response.get("student_response"),
            "card_presentation_complete": True,
            "stage": "deliver",
            "interrupt_count": state.get("interrupt_count", 0) + 1,
            "last_interrupt_type": "card",
            "tool_response_received": True
        }
    elif user_response.get("action") == "skip_card":
        return {
            "user_interaction_response": user_response,
            "should_progress": True,
            "stage": "progress",
            "interrupt_count": state.get("interrupt_count", 0) + 1
        }
    elif user_response.get("action") == "error":
        return {
            "fallback_to_messages": True,
            "interrupt_errors": state.get("interrupt_errors", []) + [user_response.get("error")],
            "stage": "design"  # Retry with regular messages
        }
    else:
        # Default handling
        return {
            "user_interaction_response": user_response,
            "interrupt_count": state.get("interrupt_count", 0) + 1
        }


def process_feedback_interaction_response(
    feedback_response: Dict[str, Any],
    evaluation: Any,
    state: InterruptUnifiedState
) -> Dict[str, Any]:
    """Process user response from feedback interaction.
    
    Args:
        feedback_response: Response from feedback Tool UI
        evaluation: Original evaluation object
        state: Current state
        
    Returns:
        State updates based on feedback interaction
    """
    base_updates = {
        "is_correct": evaluation.is_correct,
        "feedback": evaluation.feedback,
        "feedback_interactions_count": state.get("feedback_interactions_count", 0) + 1,
        "interrupt_count": state.get("interrupt_count", 0) + 1,
        "last_interrupt_type": "feedback"
    }
    
    if feedback_response.get("action") == "acknowledge":
        should_progress = evaluation.is_correct or state.get("attempts", 0) >= state.get("max_attempts", 3)
        return {
            **base_updates,
            "should_progress": should_progress,
            "stage": "progress" if should_progress else "deliver"
        }
    elif feedback_response.get("action") == "request_hint":
        return {
            **base_updates,
            "hint_level": state.get("hint_level", 0) + 1,
            "stage": "deliver"
        }
    elif feedback_response.get("action") == "error":
        return {
            **base_updates,
            "fallback_to_messages": True,
            "interrupt_errors": state.get("interrupt_errors", []) + [feedback_response.get("error")]
        }
    else:
        return base_updates


def should_use_interrupts(state: InterruptUnifiedState) -> bool:
    """Determine if interrupts should be used or fall back to messages.
    
    Args:
        state: Current state
        
    Returns:
        True if interrupts should be used, False for message fallback
    """
    # Check for explicit fallback flag
    if state.get("fallback_to_messages", False):
        return False
    
    # Check error count threshold
    if len(state.get("interrupt_errors", [])) >= 3:
        return False
    
    # Check if session context supports interrupts
    session_context = state.get("session_context", {})
    if session_context.get("disable_interrupts", False):
        return False
    
    return True


def create_fallback_message(
    content: str,
    interrupt_type: str,
    error: Optional[str] = None
) -> AIMessage:
    """Create fallback message when interrupts fail.
    
    Args:
        content: Message content to display
        interrupt_type: Type of interrupt that failed
        error: Optional error message
        
    Returns:
        AIMessage for regular display
    """
    if error:
        content = f"{content}\n\n_Note: Interactive display unavailable ({error}), showing text version._"
    
    return AIMessage(content=content)


def update_interrupt_history(
    state: InterruptUnifiedState,
    interrupt_type: str,
    interrupt_args: Dict[str, Any],
    user_response: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Update interrupt history with new interaction.
    
    Args:
        state: Current state
        interrupt_type: Type of interrupt
        interrupt_args: Arguments passed to interrupt
        user_response: User response from Tool UI
        
    Returns:
        Updated interrupt history list
    """
    history = state.get("interrupt_history", []).copy()
    
    history_entry = {
        "timestamp": datetime.now().isoformat(),
        "interrupt_type": interrupt_type,
        "interrupt_args": interrupt_args,
        "user_response": user_response,
        "session_id": state.get("session_id"),
        "card_index": state.get("current_card_index")
    }
    
    history.append(history_entry)
    
    # Keep only last 50 entries to avoid memory bloat
    return history[-50:]