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
    
    # Generate conversational card presentation
    if current_index == 0:
        # First card ONLY - use greeting that incorporates the first card naturally
        print(f"[DEBUG] Using greeting for first card")
        try:
            message = teacher.greet_with_first_card_sync(lesson_snapshot, current_card)
            print(f"[DEBUG] Successfully generated greeting with first card")
        except Exception as e:
            print(f"[DEBUG] Error in greeting generation, using fallback: {e}")
            # Fallback if LLM fails - simple greeting + card
            greeting = f"Hi there! Ready to learn about {lesson_snapshot.get('title', 'math')}? Let's get started!"
            card_content = f"**{current_card.get('title', 'Practice')}**\n\n{current_card.get('explainer', '')}\n\n**Your turn:** {current_card['cfu']['stem']}"
            message = f"{greeting}\n\n{card_content}"
    else:
        # Subsequent cards (index 1, 2, etc.) - use simple, clean presentation WITHOUT greeting
        print(f"[DEBUG] Using simple card presentation for card {current_index}")
        title = current_card.get('title', 'Practice')
        explainer = current_card.get('explainer', '')
        examples = current_card.get('example', [])
        question = current_card.get('cfu', {}).get('stem', 'What do you think?')
        
        content = f"**{title}**\n\n{explainer}"
        if examples:
            content += "\n\n**Examples:**\n" + "\n".join(f"- {ex}" for ex in examples)
        content += f"\n\n**Your turn:** {question}"
        message = content
        print(f"[DEBUG] Generated simple card content for {title}")
    
    return {
        "current_card": current_card,
        "current_card_index": current_index,
        "cards_completed": cards_completed,
        "stage": "deliver",
        "attempts": 0,
        "hint_level": 0,
        "evidence": state.get("evidence", []),
        "mastery_updates": state.get("mastery_updates", []),
        "should_exit": False,
        "messages": [AIMessage(content=message)]
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
    
    # Generate intelligent feedback using LLM, but respect deterministic marking
    try:
        feedback = teacher.evaluate_response_sync(
            student_response=student_response,
            expected_answer=cfu.get("expected"),
            card_context=current_card,
            attempt_number=attempts,
            is_correct=is_correct
        )
        
        # Override LLM feedback if deterministic marking disagrees
        # This prevents cases where LLM incorrectly assesses a correct MCQ answer
        if is_correct and ("not the correct" in feedback.lower() or "however" in feedback.lower() or "incorrect" in feedback.lower()):
            feedback = "✓ Excellent! You correctly identified the better deal. Well done!"
        elif not is_correct and ("correct" in feedback.lower() and "great" in feedback.lower()):
            if attempts == 1:
                feedback = "Not quite right. Try again!"
            elif attempts == 2:
                feedback = f"Hint: Look carefully at the options. Try again."
            else:
                feedback = f"The correct answer is option {cfu.get('answerIndex', 0) + 1}. Let's move on."
                
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
        "student_response": None,  # Clear student response after processing
        "messages": [AIMessage(content=feedback)]
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


def should_continue_from_design(state: UnifiedState) -> str:
    """Determine next step after design node."""
    if state.get("should_exit", False) or state.get("stage") == "done":
        return END
    return state.get("stage", "deliver")


def should_continue_from_mark(state: UnifiedState) -> str:
    """Determine next step after marking."""
    if state.get("is_correct", False):
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