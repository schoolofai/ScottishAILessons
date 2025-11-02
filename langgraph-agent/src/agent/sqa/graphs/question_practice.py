"""QuestionPracticeGraph - Infinite rapid-fire question practice

This graph provides infinite question practice with immediate feedback and remediation.

Flow:
1. fetch_question - Get a question from SG_FetchQuestion
2. present_question - Show question to user (interrupt with tool call)
3. diagnose - Mark answer with SG_DiagnoseAndPatch
4. show_feedback - Display result and remediation (interrupt with tool call)
5. check_continue - Ask if user wants another question
6. Loop back to fetch_question or END

Following the interrupt pattern from teacher_graph_toolcall_interrupt.py:
- Tool calls transport data to frontend
- Interrupts control flow and wait for user input
- Resume data comes from frontend via resume_data field
"""

import logging
from typing import Dict, Any

from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from ..states import QuestionPracticeState
from ..subgraphs.fetch_question import compiled_fetch_graph
from ..subgraphs.diagnose_patch import compiled_diagnose_graph

logger = logging.getLogger(__name__)


# ============================================================================
# Node Functions
# ============================================================================

def fetch_question_node(state: QuestionPracticeState) -> Dict[str, Any]:
    """Fetch a question using SG_FetchQuestion subgraph."""
    logger.info("=== PRACTICE: fetch_question_node ===")

    subject = state["subject"]
    level = state["level"]
    target_outcome = state.get("target_outcome")
    used_ids = state.get("used_question_ids", [])

    logger.debug(f"Fetching question for {subject} {level}, outcome={target_outcome}")

    # Call fetch question subgraph
    fetch_result = compiled_fetch_graph.invoke({
        "subject": subject,
        "level": level,
        "target_outcome": target_outcome,
        "used_question_ids": used_ids
    })

    question = fetch_result["question"]
    updated_used_ids = fetch_result["used_question_ids"]

    logger.info(f"Fetched question: {question['id']} (source: {question['source']})")

    return {
        "question": question,
        "used_question_ids": updated_used_ids
    }


def present_question_node(state: QuestionPracticeState) -> Dict[str, Any]:
    """Present question to user via tool call and interrupt.

    Pattern: Tool call for data transport, interrupt for flow control.
    """
    logger.info("=== PRACTICE: present_question_node ===")

    question = state["question"]

    # Create tool call with question data
    tool_message = AIMessage(
        content="",  # Empty to avoid duplication
        tool_calls=[{
            "id": f"present_question_{question['id']}",
            "name": "PresentQuestionTool",
            "args": {
                "question_id": question["id"],
                "question_text": question["text"],
                "marks": question["marks"],
                "outcome_id": question["outcome_id"],
                "subject": question["subject"],
                "level": question["level"]
            }
        }]
    )

    logger.debug("Presenting question via tool call, waiting for user answer")

    return {
        "messages": [tool_message]
    }


def diagnose_node(state: QuestionPracticeState) -> Dict[str, Any]:
    """Diagnose user answer using SG_DiagnoseAndPatch subgraph."""
    logger.info("=== PRACTICE: diagnose_node ===")

    question = state["question"]
    user_answer = state.get("user_answer", "")

    logger.debug(f"Diagnosing answer: '{user_answer[:50]}...'")

    # Call diagnose subgraph
    diagnose_result = compiled_diagnose_graph.invoke({
        "question": question,
        "user_answer": user_answer
    })

    result = diagnose_result["result"]
    gap_tags = diagnose_result.get("gap_tags", [])
    remediation = diagnose_result.get("remediation")

    # Update statistics
    total = state.get("total_questions", 0) + 1
    correct = state.get("correct_count", 0)
    streak = state.get("streak", 0)

    if result == "correct":
        correct += 1
        streak += 1
        logger.info(f"✅ CORRECT! Streak: {streak}")
    else:
        streak = 0
        logger.info(f"❌ WRONG. Gaps: {gap_tags}")

    return {
        "result": result,
        "gap_tags": gap_tags,
        "remediation": remediation,
        "total_questions": total,
        "correct_count": correct,
        "streak": streak
    }


def show_feedback_node(state: QuestionPracticeState) -> Dict[str, Any]:
    """Show feedback and remediation via tool call."""
    logger.info("=== PRACTICE: show_feedback_node ===")

    question = state["question"]
    result = state["result"]
    remediation = state.get("remediation")

    # Build stats object
    stats = {
        "total": state.get("total_questions", 0),
        "correct": state.get("correct_count", 0),
        "streak": state.get("streak", 0),
        "accuracy": round(state.get("correct_count", 0) / max(1, state.get("total_questions", 1)) * 100, 1)
    }

    # Create tool call with feedback
    tool_message = AIMessage(
        content="",
        tool_calls=[{
            "id": f"feedback_{question['id']}",
            "name": "ShowFeedbackTool",
            "args": {
                "question_id": question["id"],
                "result": result,
                "correct_answer": question["marking_scheme"],
                "remediation": remediation,
                "stats": stats,
                "gap_tags": state.get("gap_tags", [])
            }
        }]
    )

    logger.debug(f"Showing feedback: {result}, Stats: {stats}")

    return {
        "messages": [tool_message]
    }


def check_continue_node(state: QuestionPracticeState) -> Dict[str, Any]:
    """Check if user wants to continue (from resume_data).

    Frontend sends: resume: JSON.stringify({ continue: true/false })
    """
    logger.info("=== PRACTICE: check_continue_node ===")

    resume_data = state.get("resume_data", {})
    should_continue = resume_data.get("continue", True)

    logger.info(f"User wants to continue: {should_continue}")

    return {
        "should_continue": should_continue
    }


# ============================================================================
# Routing Logic
# ============================================================================

def route_after_check_continue(state: QuestionPracticeState) -> str:
    """Route based on whether user wants to continue."""
    should_continue = state.get("should_continue", False)

    if should_continue:
        logger.debug("Routing to: fetch_question (continue)")
        return "fetch_question"
    else:
        logger.debug("Routing to: END (stop)")
        return END


# ============================================================================
# Graph Construction
# ============================================================================

# Build the question practice graph
practice_graph = StateGraph(QuestionPracticeState)

# Add nodes
practice_graph.add_node("fetch_question", fetch_question_node)
practice_graph.add_node("present_question", present_question_node)
practice_graph.add_node("diagnose", diagnose_node)
practice_graph.add_node("show_feedback", show_feedback_node)
practice_graph.add_node("check_continue", check_continue_node)

logger.info("Added all practice graph nodes")

# Add edges
practice_graph.add_edge("__start__", "fetch_question")
practice_graph.add_edge("fetch_question", "present_question")
practice_graph.add_edge("present_question", "diagnose")
practice_graph.add_edge("diagnose", "show_feedback")
practice_graph.add_edge("show_feedback", "check_continue")

# Conditional edge for looping
practice_graph.add_conditional_edges(
    "check_continue",
    route_after_check_continue,
    {
        "fetch_question": "fetch_question",
        END: END
    }
)

logger.info("Added all practice graph edges")

# Compile with memory checkpointer for session persistence
checkpointer = MemorySaver()
question_practice_graph = practice_graph.compile(checkpointer=checkpointer)

logger.info("✅ QuestionPracticeGraph compiled successfully!")
