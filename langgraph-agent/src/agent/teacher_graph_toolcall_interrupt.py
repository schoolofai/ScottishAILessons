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

from langchain_core.messages import AIMessage, HumanMessage, ToolCall
from langgraph.graph import StateGraph, START , END
from langgraph.types import interrupt

try:
    from .interrupt_state import InterruptUnifiedState
    from .interrupt_tools import should_use_interrupts
    from .teaching_utils import (
        _analyze_lesson_performance,
        _calculate_mastery_score,
        _create_mastery_update,
        _update_mastery_scores,
        _get_previous_attempts,
        _create_evidence_entry
    )
except ImportError:
    from agent.interrupt_state import InterruptUnifiedState
    from agent.interrupt_tools import should_use_interrupts
    from agent.teaching_utils import (
        _analyze_lesson_performance,
        _calculate_mastery_score,
        _create_mastery_update,
        _update_mastery_scores,
        _get_previous_attempts,
        _create_evidence_entry
    )


def _parse_numeric_response(response: str, money_format: bool = False) -> float:
    """Parse numeric response, handling currency symbols and formatting.
    
    Args:
        response: Student's numeric response string
        money_format: If True, round to 2 decimal places
        
    Returns:
        Parsed float value
        
    Raises:
        ValueError: If response cannot be parsed as a number
    """
    cleaned = response.strip()
    
    # Remove currency symbols
    cleaned = cleaned.replace("£", "").replace("$", "").replace("€", "")
    
    # Remove commas (thousands separator)
    cleaned = cleaned.replace(",", "")
    
    # Parse float
    value = float(cleaned)
    
    # Round to 2dp if money format
    if money_format:
        value = round(value, 2)
    
    return value


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




def _generate_card_message(teacher, lesson_snapshot: dict, current_card: dict, current_index: int, cfu_type: str, state: dict):
    """Generate appropriate message based on card position and type.

    Args:
        teacher: LLMTeacher instance
        lesson_snapshot: Lesson snapshot data
        current_card: Current card data
        current_index: Card index (zero-indexed)
        cfu_type: CFU type (mcq, numeric, etc.)
        state: Full InterruptUnifiedState with curriculum metadata
    """
    total_cards = len(lesson_snapshot.get("cards", []))

    if current_index == 0:
        # First card with greeting - pass state for curriculum context
        if cfu_type == "mcq":
            return teacher.greet_with_first_mcq_card_sync_full(lesson_snapshot, current_card, state)
        else:
            return teacher.greet_with_first_card_sync_full(lesson_snapshot, current_card, state)
    else:
        # Subsequent cards - pass lesson_snapshot, state AND progress information for curriculum context
        if cfu_type == "mcq":
            return teacher.present_mcq_card_sync_full(
                current_card,
                state,
                card_index=current_index,
                total_cards=total_cards
            )
        else:
            return teacher.present_card_sync_full(
                current_card,
                lesson_snapshot,  # Add lesson_snapshot parameter
                state,
                card_index=current_index,
                total_cards=total_cards
            )




def design_node(state: InterruptUnifiedState) -> InterruptUnifiedState:
    """Design node - handles all routing decisions and creates tool calls for lesson card presentation."""
    from .llm_teacher import LLMTeacher
    
    # Entry logging with FULL STATE DEBUG
    current_idx = state.get("current_card_index", 0)
    stage = state.get("stage", "unknown")
    
    print(f"🔍 NODE_ENTRY: design_node | card_idx: {current_idx} | stage: {stage}")
    
    # CRITICAL DEBUG: Log all state keys and values to understand what's available
    print(f"🚨 DESIGN DEBUG - State keys available: {list(state.keys())}")
    print(f"🚨 DESIGN DEBUG - interrupt_response: {state.get('interrupt_response')}")
    print(f"🚨 DESIGN DEBUG - student_response: {state.get('student_response')}")
    print(f"🚨 DESIGN DEBUG - current stage: {state.get('stage')}")
    
    # NEW: Check for interrupt response first (from get_answer_node)
    interrupt_response = state.get("interrupt_response")
    print(f"🚨 DESIGN DEBUG - Found interrupt_response: {interrupt_response}")
    print(f"🚨 DESIGN DEBUG - interrupt_response type: {type(interrupt_response)}")
    
    if interrupt_response:
        action = interrupt_response.get("action") if isinstance(interrupt_response, dict) else None
        print(f"🚨 DESIGN DEBUG - Processing interrupt response with action: {action}")
        
        if action == "submit_answer":
            student_response = interrupt_response.get("student_response", "")
            print(f"🚨 DESIGN DEBUG - Submit answer: {student_response[:50] if student_response else 'EMPTY'}...")
            current_card, current_index, _ = _get_current_card_info(state)
            print(f"🔍 NODE_EXIT: design_node | decision: submit_answer | next_stage: mark")

            # Create HumanMessage with the submitted answer
            answer_message = HumanMessage(
                content=f"Your Answer: {student_response}"
            )

            return_dict = {
                "messages": [answer_message],  # Add HumanMessage to stack
                "student_response": student_response,
                "current_card": current_card,
                "current_card_index": current_index,
                "stage": "mark",
                "interrupt_response": None  # Clear after processing
            }
            print(f"🚨 DESIGN DEBUG - Returning dict with stage: {return_dict.get('stage')}")
            return return_dict
        elif action == "skip_card":
            print(f"🚨 DESIGN DEBUG - Skip card action")
            print(f"🔍 NODE_EXIT: design_node | decision: skip_card | next_stage: progress")
            return {
                "stage": "progress",
                "should_progress": True,
                "skip_reason": interrupt_response.get("reason", "Student chose to skip"),
                "interrupt_response": None  # Clear after processing
            }
        else:
            print(f"🚨 DESIGN DEBUG - Unknown action in interrupt response: {action}")
    else:
        print(f"🚨 DESIGN DEBUG - No interrupt_response found, checking other conditions")
    
    # Check lesson completion FIRST - before trying to access current card
    if _is_lesson_complete(state):
        print(f"🔍 NODE_EXIT: design_node | decision: lesson_complete | generating summary...")

        teacher = LLMTeacher()
        evidence = state.get("evidence", [])
        lesson_snapshot = state["lesson_snapshot"]

        # Analyze performance using imported helper
        performance_analysis = _analyze_lesson_performance(evidence)

        # Generate comprehensive summary with LLM
        summary_message = teacher.summarize_completed_lesson_sync_full(
            lesson_snapshot=lesson_snapshot,
            evidence=evidence,
            performance_analysis=performance_analysis,
            state=state  # Pass full state for curriculum context
        )

        # Create tool call for lesson completion UI
        mastery_updates = state.get("mastery_updates", [])
        print(f"🚨 COMPLETION DEBUG - Tool call data:")
        print(f"🚨 COMPLETION DEBUG - Evidence entries: {len(evidence)}")
        print(f"🚨 COMPLETION DEBUG - Mastery updates: {len(mastery_updates)}")
        print(f"🚨 COMPLETION DEBUG - Session context: session_id={state.get('session_id')}, student_id={state.get('student_id')}, course_id={state.get('course_id')}")

        tool_call = ToolCall(
            id="lesson_completion",
            name="lesson_completion_summary",
            args={
                "summary": summary_message.content if hasattr(summary_message, 'content') else str(summary_message),
                "performance_analysis": performance_analysis,
                "evidence": evidence,
                "mastery_updates": mastery_updates,  # Add mastery data from backend
                "lesson_title": lesson_snapshot.get("title", "Lesson"),
                "total_cards": len(lesson_snapshot.get("cards", [])),
                "cards_completed": len(state.get("cards_completed", [])),
                "retry_recommended": performance_analysis.get("retry_recommended", False),
                "timestamp": datetime.now().isoformat(),
                # Session context for frontend persistence
                "session_id": state.get("session_id"),
                "student_id": state.get("student_id"),
                "course_id": state.get("course_id")
            }
        )

        # Create AIMessage with tool call for UI
        tool_message = AIMessage(
            content="",
            tool_calls=[tool_call]
        )

        print(f"🚨 COMPLETION DEBUG - Generated lesson completion summary with tool call")
        print(f"🚨 COMPLETION DEBUG - Performance: accuracy={performance_analysis.get('overall_accuracy', 0):.2f}, retry_recommended={performance_analysis.get('retry_recommended', False)}")
        # Log estimated duration for analytics (actual duration tracking TBD)
        try:
            est_minutes = state.get("est_minutes", 50)
            print(f"📏 DURATION: Estimated lesson duration (estMinutes) = {est_minutes} minutes")
        except Exception:
            pass

        return {
            "messages": [summary_message, tool_message],
            "stage": "done",
            "should_exit": True,
            "performance_analysis": performance_analysis,
            "lesson_summary": summary_message
        }

    # EXISTING: Check if we have a student_response in state (backward compatibility)
    student_response = state.get("student_response")
    print(f"🚨 DESIGN DEBUG - Checking student_response: {student_response}")
    if student_response:
        print(f"🚨 DESIGN DEBUG - Found student_response in state: {student_response[:50]}...")
        current_card, current_index, _ = _get_current_card_info(state)
        print(f"🔍 NODE_EXIT: design_node | decision: has_response | next_stage: mark")

        # Create HumanMessage with the submitted answer
        answer_message = HumanMessage(
            content=f"Your Answer: {student_response}"
        )

        return {
            "messages": [answer_message],  # Add HumanMessage to stack
            "current_card": current_card,
            "current_card_index": current_index,
            "stage": "mark"
        }

    # Generate card content and create tool call
    print(f"🚨 DESIGN DEBUG - Falling through to create new tool call - no interrupt_response or student_response found")
    teacher = LLMTeacher()
    current_card, current_index, cfu_type = _get_current_card_info(state)

    message_obj = _generate_card_message(
        teacher, state["lesson_snapshot"], current_card, current_index, cfu_type, state  # Pass full state
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
            "card_content": current_card.get("cfu", {}).get("stem", "") or current_card.get("cfu", {}).get("question", ""),
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


def get_answer_node(state: InterruptUnifiedState) -> InterruptUnifiedState:
    """Get answer node - captures interrupt response and returns to design."""
    current_idx = state.get("current_card_index", 0)
    print(f"🔍 NODE_ENTRY: get_answer_node | card_idx: {current_idx}")
    
    print(f"🚨 INTERRUPT DEBUG - About to interrupt with empty payload, waiting for sendCommand response")
    
    # Interrupt with EMPTY payload - frontend already has data from tool call
    response = interrupt({})
    
    # THIS CODE EXECUTES AFTER RESUME with response from sendCommand
    print(f"🚨 INTERRUPT DEBUG - Raw response received: {response}")
    print(f"🚨 INTERRUPT DEBUG - Response type: {type(response)}")
    
    # Parse response robustly (keep existing parsing logic)
    payload = None
    if isinstance(response, str):
        print(f"🚨 INTERRUPT DEBUG - Response is STRING, parsing JSON")
        import json
        try:
            payload = json.loads(response)
            print(f"🚨 INTERRUPT DEBUG - Successfully parsed JSON: {payload}")
        except json.JSONDecodeError as e:
            print(f"🚨 INTERRUPT DEBUG - JSON parse failed: {e}")
            payload = {"value": response}
            
    elif isinstance(response, dict):
        print(f"🚨 INTERRUPT DEBUG - Response is DICT: {response}")
        # Handle resume wrapper if present
        if "resume" in response:
            resume_value = response["resume"]
            if isinstance(resume_value, str):
                import json
                try:
                    payload = json.loads(resume_value)
                except json.JSONDecodeError:
                    payload = {"value": resume_value}
            else:
                payload = resume_value
        else:
            payload = response
    else:
        print(f"🚨 INTERRUPT DEBUG - Unexpected response type: {type(response)}")
        payload = {"value": str(response)}
    
    # Simply store the interrupt response and return to design
    print(f"🔍 NODE_EXIT: get_answer_node | returning to design with payload")
    return {
        "interrupt_response": payload,
        "stage": "design"  # Always go back to design
    }


def mark_node(state: InterruptUnifiedState) -> InterruptUnifiedState:
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
    
    # Pre-validate numeric responses BEFORE LLM evaluation
    cfu_type = cfu.get("type", "")
    if cfu_type == "numeric":
        try:
            # Extract expected answer and tolerance
            expected_numeric = float(cfu.get("expected", 0))
            tolerance = float(cfu.get("tolerance", 0.01))
            money_format = cfu.get("money2dp", False)
            
            # Parse student response (handle £, commas, etc.)
            student_numeric = _parse_numeric_response(student_response, money_format=money_format)
            
            # Check tolerance
            if abs(student_numeric - expected_numeric) <= tolerance:
                print(f"🚨 NUMERIC PRE-VALIDATION: CORRECT (within tolerance {tolerance})")
                # Create simple correct evaluation
                from .llm_teacher import EvaluationResponse
                evaluation = EvaluationResponse(
                    is_correct=True,
                    confidence=1.0,
                    feedback="Correct!",
                    reasoning="Numeric answer within acceptable tolerance",
                    should_progress=True,
                    partial_credit=1.0
                )
                
                # Skip LLM evaluation, use pre-validation result
                print(f"🚨 MARK DEBUG - Numeric pre-validation passed, skipping LLM")
                should_progress = True
                
                # Record evidence and continue
                evidence_entry = _create_evidence_entry(evaluation, student_response, cfu, attempts, should_progress, max_attempts)
                evidence = state.get("evidence", [])
                evidence.append(evidence_entry)
                
                return {
                    "is_correct": True,
                    "should_progress": True,
                    "feedback": "Correct!",
                    "attempts": attempts,
                    "evidence": evidence,
                    "stage": "progress",
                    "student_response": None
                }
            else:
                print(f"🚨 NUMERIC PRE-VALIDATION: INCORRECT (outside tolerance {tolerance})")
                # Continue to LLM evaluation for detailed feedback
                
        except (ValueError, TypeError) as e:
            print(f"🚨 NUMERIC PRE-VALIDATION: Parse error, falling back to LLM: {e}")
            # Continue to LLM evaluation
    
    # LLM evaluation for non-numeric or incorrect numeric responses
    evaluation = teacher.evaluate_response_with_structured_output(
        student_response=student_response,
        expected_answer=cfu.get("expected") if cfu.get("type") != "mcq" else cfu.get("options", [])[cfu.get("answerIndex", 0)],
        card_context=current_card,
        attempt_number=attempts,
        max_attempts=max_attempts,
        state=state  # Pass full state for curriculum context
    )
    
    # Record evidence using shared utility
    should_progress = evaluation.is_correct or (attempts >= max_attempts)
    evidence_entry = _create_evidence_entry(evaluation, student_response, cfu, attempts, should_progress, max_attempts)
    evidence = state.get("evidence", [])
    evidence.append(evidence_entry)
    
    # Determine progression (already calculated in evidence entry)
    should_progress = evidence_entry["should_progress"]

    print(f"🚨 MARK DEBUG - Evaluation result: correct={evaluation.is_correct}, should_progress={should_progress}")

    # NEW: Generate explanation if max attempts reached and incorrect
    explanation_message = None
    if attempts >= max_attempts and not evaluation.is_correct:
        print(f"🚨 MARK DEBUG - Max attempts reached with incorrect answer, generating explanation")
        previous_attempts = _get_previous_attempts(evidence, cfu["id"])
        explanation_obj = teacher.explain_correct_answer_sync_full(
            current_card=current_card,
            student_attempts=previous_attempts,
            state=state  # Pass full state for curriculum context
        )
        explanation_message = explanation_obj.content if hasattr(explanation_obj, 'content') else str(explanation_obj)
        print(f"🚨 MARK DEBUG - Generated explanation: {explanation_message[:100] if explanation_message else 'None'}...")

    # NEW ROUTING: incorrect answers go to retry, not design
    if should_progress:
        next_stage = "progress"
    else:
        next_stage = "retry"  # Changed from "design"

    print(f"🔍 NODE_EXIT: mark_node | correct: {evaluation.is_correct} | should_progress: {should_progress} | next_stage: {next_stage}")

    return {
        "is_correct": evaluation.is_correct,
        "should_progress": should_progress,
        "feedback": evaluation.feedback,
        "explanation": explanation_message,  # NEW field
        "attempts": attempts,
        "evidence": evidence,
        "stage": next_stage,
        "student_response": None,  # Clear response
        # Don't send feedback as message - it was already streamed by LLM
    }


def retry_node(state: InterruptUnifiedState) -> InterruptUnifiedState:
    """Retry node - shows feedback and creates tool call for retry attempt."""
    current_idx = state.get("current_card_index", 0)
    attempts = state.get("attempts", 1)
    print(f"🔍 NODE_ENTRY: retry_node | card_idx: {current_idx} | attempt: {attempts}")
    
    # Check for interrupt response first (from get_answer_retry_node)
    interrupt_response = state.get("interrupt_response")
    print(f"🚨 RETRY DEBUG - interrupt_response: {interrupt_response}")
    
    if interrupt_response:
        action = interrupt_response.get("action") if isinstance(interrupt_response, dict) else None
        print(f"🚨 RETRY DEBUG - Processing interrupt response with action: {action}")
        
        if action == "submit_answer":
            student_response = interrupt_response.get("student_response", "")
            print(f"🚨 RETRY DEBUG - Submit answer: {student_response[:50] if student_response else 'EMPTY'}...")
            current_card, current_index, _ = _get_current_card_info(state)
            print(f"🔍 NODE_EXIT: retry_node | decision: submit_answer | next_stage: mark")

            # Create HumanMessage with the submitted answer
            answer_message = HumanMessage(
                content=f"Your Answer: {student_response}"
            )

            return_dict = {
                "messages": [answer_message],  # Add HumanMessage to stack
                "student_response": student_response,
                "current_card": current_card,
                "current_card_index": current_index,
                "stage": "mark",
                "interrupt_response": None  # Clear after processing
            }
            return return_dict
        elif action == "skip_card":
            print(f"🚨 RETRY DEBUG - Skip card action")
            print(f"🔍 NODE_EXIT: retry_node | decision: skip_card | next_stage: progress")
            return {
                "stage": "progress",
                "should_progress": True,
                "skip_reason": interrupt_response.get("reason", "Student chose to skip"),
                "interrupt_response": None  # Clear after processing
            }
        else:
            print(f"🚨 RETRY DEBUG - Unknown action in interrupt response: {action}")
    else:
        print(f"🚨 RETRY DEBUG - No interrupt_response found, creating retry presentation")
    
    # Get retry context
    feedback = state.get("feedback", "Please try again.")
    explanation = state.get("explanation")  # NEW: Get explanation if exists
    current_card = state.get("current_card")
    current_index = state.get("current_card_index", 0)

    if not current_card:
        print("🚨 RETRY DEBUG - Missing current card, routing to design")
        return {"stage": "design"}

    # Get authored hints from CFU
    from .llm_teacher import LLMTeacher
    cfu = current_card.get("cfu", {})
    authored_hints = cfu.get("hints", [])
    
    # Determine feedback source - use authored hints if available
    if attempts <= len(authored_hints):
        # Use authored hint (0-indexed)
        hint_text = authored_hints[attempts - 1]
        feedback = f"{feedback}\n\n**Hint {attempts}:** {hint_text}"
        print(f"🚨 RETRY DEBUG - Using authored hint {attempts}/{len(authored_hints)}: {hint_text[:50]}...")
    else:
        # Hints exhausted or no hints available - use LLM fallback if needed
        if not explanation and attempts > len(authored_hints):
            print(f"🚨 RETRY DEBUG - Hints exhausted ({len(authored_hints)}), generating LLM hint")
            teacher = LLMTeacher()
            student_response = state.get("student_response", "")
            try:
                llm_hint = teacher.generate_hint_sync_full(
                    current_card=current_card,
                    student_response=student_response,
                    attempt_number=attempts,
                    state=state
                )
                feedback = f"{feedback}\n\n**Hint:** {llm_hint}"
                print(f"🚨 RETRY DEBUG - Generated LLM hint: {llm_hint[:50]}...")
            except Exception as e:
                print(f"🚨 RETRY DEBUG - LLM hint generation failed: {e}")
                # Continue with existing feedback
        else:
            print(f"🚨 RETRY DEBUG - Using existing feedback/explanation")

    # Create feedback message with explanation if available
    from langchain_core.messages import AIMessage
    if explanation:
        # Combine feedback and explanation for comprehensive message
        combined_feedback = f"{feedback}\n\n{explanation}"
        feedback_message = AIMessage(content=combined_feedback)
        print(f"🚨 RETRY DEBUG - Using combined feedback + explanation for max attempts case")
    else:
        feedback_message = AIMessage(content=feedback)
        combined_feedback = feedback
    
    # Create tool call for retry using SAME tool as design_node
    tool_call_id = f"retry_card_{current_index}_{attempts}"
    lesson_context = {
        "lesson_title": state["lesson_snapshot"].get("title", "Scottish AI Lesson"),
        "student_name": state.get("student_id", "Student"),
        "progress": f"{current_index + 1}/{len(state['lesson_snapshot'].get('cards', []))}"
    }
    
    tool_call = ToolCall(
        id=tool_call_id,
        name="lesson_card_presentation",  # SAME tool name as design_node
        args={
            "card_content": current_card.get("cfu", {}).get("stem", "") or current_card.get("cfu", {}).get("question", ""),
            "card_data": current_card,
            "card_index": current_index,
            "total_cards": len(state["lesson_snapshot"].get("cards", [])),
            "cfu_type": current_card.get("cfu", {}).get("type", ""),
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
    
    print(f"🚨 RETRY DEBUG - Created lesson_card_presentation tool call for retry attempt {attempts}")
    print(f"🚨 RETRY DEBUG - Tool call content: {'feedback + explanation' if explanation else 'feedback only'}")
    print(f"🔍 NODE_EXIT: retry_node | decision: retry_presentation | next_stage: get_answer_retry")

    return {
        "messages": [feedback_message, tool_message],
        "stage": "get_answer_retry",
        "pending_tool_call_id": tool_call_id,
        "student_response": None,  # Clear any previous response
        "explanation": None  # Clear after using
    }


def get_answer_retry_node(state: InterruptUnifiedState) -> InterruptUnifiedState:
    """Get answer retry node - captures interrupt response for retry attempts and returns to retry."""
    current_idx = state.get("current_card_index", 0)
    attempts = state.get("attempts", 1)
    print(f"🔍 NODE_ENTRY: get_answer_retry_node | card_idx: {current_idx} | attempt: {attempts}")
    
    print(f"🚨 INTERRUPT RETRY DEBUG - About to interrupt with empty payload, waiting for retry response")
    
    # Interrupt with EMPTY payload - frontend already has data from retry tool call
    response = interrupt({})
    
    # THIS CODE EXECUTES AFTER RESUME with response from sendCommand
    print(f"🚨 INTERRUPT RETRY DEBUG - Raw response received: {response}")
    print(f"🚨 INTERRUPT RETRY DEBUG - Response type: {type(response)}")
    
    # Parse response robustly (same logic as get_answer_node)
    payload = None
    if isinstance(response, str):
        print(f"🚨 INTERRUPT RETRY DEBUG - Response is STRING, parsing JSON")
        import json
        try:
            payload = json.loads(response)
            print(f"🚨 INTERRUPT RETRY DEBUG - Successfully parsed JSON: {payload}")
        except json.JSONDecodeError as e:
            print(f"🚨 INTERRUPT RETRY DEBUG - JSON parse failed: {e}")
            payload = {"value": response}
            
    elif isinstance(response, dict):
        print(f"🚨 INTERRUPT RETRY DEBUG - Response is DICT: {response}")
        # Handle resume wrapper if present
        if "resume" in response:
            resume_value = response["resume"]
            if isinstance(resume_value, str):
                import json
                try:
                    payload = json.loads(resume_value)
                except json.JSONDecodeError:
                    payload = {"value": resume_value}
            else:
                payload = resume_value
        else:
            payload = response
    else:
        print(f"🚨 INTERRUPT RETRY DEBUG - Unexpected response type: {type(response)}")
        payload = {"value": str(response)}
    
    # Simply store the interrupt response and return to retry
    print(f"🔍 NODE_EXIT: get_answer_retry_node | returning to retry with payload")
    return {
        "interrupt_response": payload,
        "stage": "retry"  # Always go back to retry
    }


def progress_node(state: InterruptUnifiedState) -> InterruptUnifiedState:
    """Progress node - move to next card."""
    from .llm_teacher import LLMTeacher
    
    current_card_index = state.get("current_card_index", 0)
    current_card = state.get("current_card")
    cards_completed = state.get("cards_completed", [])
    print(f"🔍 NODE_ENTRY: progress_node | card_idx: {current_card_index} | completed_count: {len(cards_completed)}")
    
    # Add current card to completed list
    if current_card:
        cards_completed.append(current_card["id"])

    # Update mastery scores using shared utility
    lesson_snapshot = state["lesson_snapshot"]
    mastery_updates = _update_mastery_scores(
        lesson_snapshot,
        state,
        state.get("mastery_updates", [])
    )

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
        },
        state=state  # Pass full state for curriculum context
    )
    
    print(f"🚨 PROGRESS DEBUG - Moving from card {current_card_index} to {next_card_index}")
    print(f"🚨 PROGRESS DEBUG - Mastery updates: {len(mastery_updates)} total")
    print(f"🔍 NODE_EXIT: progress_node | from_card: {current_card_index} | to_card: {next_card_index} | next_stage: design")

    return {
        "current_card_index": next_card_index,
        "cards_completed": cards_completed,
        "mastery_updates": mastery_updates,  # Add mastery tracking
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
    next_node = "progress" if should_progress else "retry"  # Changed from "design"
    print(f"🔍 ROUTING: should_continue_from_mark -> {next_node} | should_progress: {should_progress}")
    return next_node


def should_continue_from_retry(state: InterruptUnifiedState) -> str:
    """Determine next step after retry node."""
    should_exit = state.get("should_exit", False)
    stage = state.get("stage", "get_answer_retry")
    
    if should_exit or stage == "done":
        print(f"🔍 ROUTING: should_continue_from_retry -> END | should_exit: {should_exit} | stage: {stage}")
        return END
    
    print(f"🔍 ROUTING: should_continue_from_retry -> {stage} | should_exit: {should_exit}")
    return stage


# Removed: get_answer_router lambda - get_answer now always returns to design

# Build the tool call + interrupt teaching graph
teaching_graph_toolcall = StateGraph(InterruptUnifiedState)

# Add nodes
teaching_graph_toolcall.add_node("design", design_node)
teaching_graph_toolcall.add_node("get_answer", get_answer_node)
teaching_graph_toolcall.add_node("mark", mark_node)
teaching_graph_toolcall.add_node("progress", progress_node)
teaching_graph_toolcall.add_node("retry", retry_node)
teaching_graph_toolcall.add_node("get_answer_retry", get_answer_retry_node)

# Add edges
teaching_graph_toolcall.add_edge(START, "design")

# From design: route based on stage (get_answer, mark, progress, or end)
teaching_graph_toolcall.add_conditional_edges(
    "design",
    should_continue_from_design,
    {
        "get_answer": "get_answer",
        "mark": "mark",          # When student_response available
        "progress": "progress",  # When skip_card action
        END: END
    }
)

# From get_answer: always return to design (simplified flow)
teaching_graph_toolcall.add_edge("get_answer", "design")

# From mark: go to progress if correct, to retry if incorrect
teaching_graph_toolcall.add_conditional_edges(
    "mark",
    should_continue_from_mark,
    {
        "progress": "progress",
        "retry": "retry"  # Changed from "design"
    }
)

# From progress: always return to design for next card
teaching_graph_toolcall.add_edge("progress", "design")

# Add retry flow edges
# From retry: route based on stage (get_answer_retry, mark, progress)
teaching_graph_toolcall.add_conditional_edges(
    "retry",
    should_continue_from_retry,
    {
        "get_answer_retry": "get_answer_retry",
        "mark": "mark",          # When student_response available
        "progress": "progress",  # When skip_card action
        END: END
    }
)

# From get_answer_retry: always return to retry
teaching_graph_toolcall.add_edge("get_answer_retry", "retry")

# Compile the tool call + interrupt teaching graph
compiled_teaching_graph_toolcall = teaching_graph_toolcall.compile(checkpointer=True)