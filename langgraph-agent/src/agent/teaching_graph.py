"""LangGraph teaching loop for Scottish AI Lessons.

Implements the Design -> Delivery -> Mark -> Progress teaching loop.
"""

from __future__ import annotations

from typing import Annotated, TypedDict, Optional, List, Dict, Any, Literal
from datetime import datetime
import json
import uuid

from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages


class TeachingState(TypedDict):
    """State for the teaching loop graph."""
    # Session context
    session_id: str
    student_id: str
    course_id: str
    lesson_template_id: str
    
    # Lesson data
    lesson_snapshot: Dict[str, Any]
    current_card_index: int
    cards_completed: List[str]
    
    # Current interaction
    current_card: Optional[Dict[str, Any]]
    student_response: Optional[str]
    is_correct: Optional[bool]
    feedback: Optional[str]
    hint_level: int
    attempts: int
    
    # Evidence tracking
    evidence: List[Dict[str, Any]]
    
    # Mastery tracking  
    mastery_updates: List[Dict[str, Any]]
    
    # Control flow
    stage: Literal["design", "deliver", "mark", "progress", "done"]
    should_exit: bool
    
    # Messages for chat interface
    messages: Annotated[list[BaseMessage], add_messages]


def design_node(state: TeachingState) -> Dict:
    """Design node: Prepare the next card for delivery."""
    from .llm_teacher import LLMTeacher
    
    teacher = LLMTeacher()
    lesson_snapshot = state["lesson_snapshot"]
    current_index = state.get("current_card_index", 0)
    cards = lesson_snapshot.get("cards", [])
    
    if current_index >= len(cards):
        # No more cards, lesson complete
        try:
            completion_message = teacher.complete_lesson_sync(
                lesson_snapshot, 
                {
                    "cards_completed": len(state.get("cards_completed", [])),
                    "total_cards": len(cards)
                }
            )
        except Exception as e:
            completion_message = "🎉 Lesson complete! Great job working through all the problems!"
        return {
            "stage": "done",
            "should_exit": True,
            "messages": [AIMessage(content=completion_message)]
        }
    
    current_card = cards[current_index]
    
    # Generate conversational card presentation
    if current_index == 0:
        # First card - include lesson greeting  
        try:
            greeting = teacher.greet_student_sync(lesson_snapshot)
            card_content = teacher.present_card_sync(current_card)
            message = f"{greeting}\n\n{card_content}"
        except Exception as e:
            # Fallback if LLM fails
            greeting = f"Hi there! Ready to learn about {lesson_snapshot.get('title', 'math')}? Let's get started!"
            card_content = f"**{current_card.get('title', 'Practice')}**\n\n{current_card.get('explainer', '')}\n\n**Your turn:** {current_card['cfu']['stem']}"
            message = f"{greeting}\n\n{card_content}"
    else:
        # Subsequent cards
        try:
            card_content = teacher.present_card_sync(current_card)
            message = card_content
        except Exception as e:
            # Fallback if LLM fails
            card_content = f"**{current_card.get('title', 'Practice')}**\n\n{current_card.get('explainer', '')}\n\n**Your turn:** {current_card['cfu']['stem']}"
            message = card_content
    
    return {
        "current_card": current_card,
        "stage": "deliver",
        "attempts": 0,
        "hint_level": 0,
        "messages": [AIMessage(content=message)]
    }


def deliver_node(state: TeachingState) -> Dict:
    """Delivery node: Wait for and process student response."""
    # In production, this would integrate with the UI
    # For now, we'll return a state indicating we're waiting for input
    return {
        "stage": "mark"
    }


def mark_node(state: TeachingState) -> Dict:
    """Mark node: Evaluate student response and provide feedback."""
    from .llm_teacher import LLMTeacher
    
    teacher = LLMTeacher()
    current_card = state["current_card"]
    student_response = state.get("student_response", "")
    attempts = state.get("attempts", 0) + 1
    
    if not current_card or not student_response:
        return {"stage": "deliver"}
    
    cfu = current_card["cfu"]
    is_correct = False
    
    # Deterministic marking based on type
    if cfu["type"] == "numeric":
        try:
            # Clean and parse response
            clean_response = student_response.replace("£", "").replace(",", "").strip()
            
            # Handle fraction responses
            if "/" in clean_response:
                parts = clean_response.split("/")
                if len(parts) == 2:
                    num_response = float(parts[0]) / float(parts[1])
                else:
                    num_response = float(clean_response)
            else:
                num_response = float(clean_response)
            
            expected = cfu.get("expected")
            if isinstance(expected, str):
                if "/" in expected:
                    parts = expected.split("/")
                    expected = float(parts[0]) / float(parts[1])
                else:
                    expected = float(expected)
            
            tolerance = cfu.get("tolerance", 0)
            is_correct = abs(num_response - expected) <= tolerance
            
            # Force progress after 3 attempts
            if attempts >= 3 and not is_correct:
                is_correct = True
                    
        except (ValueError, ZeroDivisionError):
            pass  # is_correct remains False
            
    elif cfu["type"] == "mcq":
        options = cfu.get("options", [])
        answer_index = cfu.get("answerIndex", -1)
        
        # Check if response matches an option
        if student_response in options:
            selected_index = options.index(student_response)
            is_correct = selected_index == answer_index
        else:
            # Try to parse as option number
            try:
                selected_index = int(student_response) - 1
                if 0 <= selected_index < len(options):
                    is_correct = selected_index == answer_index
            except ValueError:
                pass
        
        # Force progress after 3 attempts
        if attempts >= 3 and not is_correct:
            is_correct = True
    
    # Generate intelligent feedback using LLM
    try:
        feedback = teacher.evaluate_response_sync(
            student_response=student_response,
            expected_answer=cfu.get("expected"),
            card_context=current_card,
            attempt_number=attempts,
            is_correct=is_correct
        )
    except Exception as e:
        # Fallback feedback
        if is_correct:
            feedback = "✓ Correct! Well done."
        else:
            if attempts == 1:
                feedback = "Not quite. Give it another try!"
            elif attempts == 2:
                feedback = f"Hint: The answer should be close to {cfu.get('expected')}. Try again."
            else:
                feedback = f"The correct answer is {cfu.get('expected')}. Let's move on."
    
    # Record evidence
    evidence_entry = {
        "timestamp": datetime.now().isoformat(),
        "item_id": cfu["id"],
        "response": student_response,
        "correct": is_correct,
        "attempts": attempts,
        "feedback": feedback  # Store LLM-generated feedback
    }
    
    evidence = state.get("evidence", [])
    evidence.append(evidence_entry)
    
    # Determine next stage
    next_stage = "progress" if is_correct else "deliver"
    
    return {
        "is_correct": is_correct,
        "feedback": feedback,
        "attempts": attempts,
        "evidence": evidence,
        "stage": next_stage,
        "messages": [AIMessage(content=feedback)]
    }


def progress_node(state: TeachingState) -> Dict:
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
    try:
        transition_message = teacher.transition_to_next_sync(
            completed_card=current_card,
            next_card=next_card,
            progress_context={
                "cards_completed": len(cards_completed),
                "total_cards": len(cards),
                "current_performance": state.get("is_correct", False)
            }
        )
    except Exception as e:
        # Fallback transition
        if next_card:
            transition_message = f"Great work! Now let's move on to {next_card.get('title', 'the next topic')}."
        else:
            transition_message = "🎉 Lesson complete! Great job working through all the problems!"
    
    return {
        "current_card_index": next_card_index,
        "cards_completed": cards_completed,
        "mastery_updates": mastery_updates,
        "stage": "design",
        "student_response": None,
        "is_correct": None,
        "feedback": None,
        "messages": [AIMessage(content=transition_message)]
    }


def should_continue_from_design(state: TeachingState) -> str:
    """Determine next step after design node."""
    if state.get("should_exit", False) or state.get("stage") == "done":
        return END
    return state.get("stage", "deliver")


def should_continue_from_mark(state: TeachingState) -> str:
    """Determine next step after marking."""
    if state.get("is_correct", False):
        return "progress"
    else:
        return "deliver"


# Build the teaching graph
teaching_graph = StateGraph(TeachingState)

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

# From deliver: always go to mark (student response received)
teaching_graph.add_edge("deliver", "mark")

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