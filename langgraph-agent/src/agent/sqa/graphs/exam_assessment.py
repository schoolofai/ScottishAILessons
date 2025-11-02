"""ExamAssessmentGraph - SQA-style mock exam generation and marking

This graph generates infinite SQA-style mock exams with full marking and remediation.

Flow:
1. build_blueprint - Get SQA spec and create exam structure
2. fill_slots - Fetch questions for each blueprint slot (multiple subgraph calls)
3. assemble_exam - Package questions into exam format
4. deliver_exam - Show exam to user (interrupt with tool call)
5. mark_exam - Mark all responses using diagnose subgraph
6. show_results - Display marking and remediation (interrupt with tool call)
7. check_next - Ask if user wants another exam
8. Loop back to build_blueprint or END

Following the interrupt pattern:
- Tool calls for data transport
- Interrupts for flow control
- Batch processing for efficiency
"""

import logging
from typing import Dict, Any, List
import uuid

from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

from ..states import ExamAssessmentState, Question
from ..subgraphs.fetch_question import compiled_fetch_graph
from ..subgraphs.diagnose_patch import compiled_diagnose_graph
from ..question_source import QuestionSource

logger = logging.getLogger(__name__)


# ============================================================================
# Node Functions
# ============================================================================

def build_blueprint_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Build exam blueprint from SQA specification."""
    logger.info("=== EXAM: build_blueprint_node ===")

    subject = state["subject"]
    level = state["level"]

    logger.debug(f"Building blueprint for {subject} {level}")

    # Get SQA spec
    spec = QuestionSource.get_sqa_spec(subject, level)

    # Build blueprint from assessment structure
    blueprint = []
    for section in spec["assessment_structure"]:
        section_name = section["section"]
        total_marks = section["marks"]
        outcome_ids = section["outcome_ids"]

        # Distribute marks evenly across outcomes
        marks_per_outcome = total_marks // len(outcome_ids)

        for outcome_id in outcome_ids:
            blueprint.append({
                "section": section_name,
                "outcome_id": outcome_id,
                "marks": marks_per_outcome
            })

    logger.info(f"Created blueprint with {len(blueprint)} slots, total marks: {sum(s['marks'] for s in blueprint)}")

    return {
        "blueprint": blueprint
    }


def fill_slots_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Fill each blueprint slot with a question from fetch subgraph."""
    logger.info("=== EXAM: fill_slots_node ===")

    subject = state["subject"]
    level = state["level"]
    blueprint = state["blueprint"]
    used_ids = state.get("used_question_ids", [])

    logger.debug(f"Filling {len(blueprint)} slots")

    all_questions = []

    for i, slot in enumerate(blueprint):
        outcome_id = slot["outcome_id"]
        target_marks = slot["marks"]

        logger.debug(f"Slot {i+1}/{len(blueprint)}: {outcome_id}, {target_marks} marks")

        # Fetch question for this slot
        fetch_result = compiled_fetch_graph.invoke({
            "subject": subject,
            "level": level,
            "target_outcome": outcome_id,
            "used_question_ids": used_ids
        })

        question = fetch_result["question"]
        used_ids = fetch_result["used_question_ids"]

        # Override marks to match blueprint
        question["marks"] = target_marks

        all_questions.append(question)

    logger.info(f"Filled all {len(all_questions)} slots")

    return {
        "questions": all_questions,
        "used_question_ids": used_ids
    }


def assemble_exam_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Assemble questions into exam package."""
    logger.info("=== EXAM: assemble_exam_node ===")

    subject = state["subject"]
    level = state["level"]
    questions = state["questions"]
    exam_count = state.get("exam_count", 0)

    # Generate exam ID
    exam_id = f"{subject.lower().replace(' ', '_')}_{level.lower().replace(' ', '_')}_exam_{exam_count + 1}_{uuid.uuid4().hex[:6]}"

    # Group questions by section
    sections = {}
    for i, question in enumerate(questions):
        section_name = state["blueprint"][i]["section"]
        if section_name not in sections:
            sections[section_name] = []
        sections[section_name].append({
            "number": i + 1,
            "question": question
        })

    # Calculate total marks and time
    total_marks = sum(q["marks"] for q in questions)
    # Rough estimate: 1.5 minutes per mark
    time_allowed_minutes = int(total_marks * 1.5)

    exam_package = {
        "exam_id": exam_id,
        "subject": subject,
        "level": level,
        "total_marks": total_marks,
        "question_count": len(questions),
        "time_allowed_minutes": time_allowed_minutes,
        "sections": sections,
        "instructions": f"Answer all questions in this {subject} {level} exam. You have {time_allowed_minutes} minutes."
    }

    logger.info(f"Assembled exam: {exam_id}, {total_marks} marks, {len(questions)} questions")

    return {
        "exam_package": exam_package
    }


def deliver_exam_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Deliver exam to user via tool call and interrupt."""
    logger.info("=== EXAM: deliver_exam_node ===")

    exam_package = state["exam_package"]
    questions = state["questions"]

    # Create tool call with exam data
    tool_message = AIMessage(
        content="",
        tool_calls=[{
            "id": f"deliver_exam_{exam_package['exam_id']}",
            "name": "DeliverExamTool",
            "args": {
                "exam_id": exam_package["exam_id"],
                "subject": exam_package["subject"],
                "level": exam_package["level"],
                "total_marks": exam_package["total_marks"],
                "time_allowed": exam_package["time_allowed_minutes"],
                "sections": exam_package["sections"],
                "questions": questions,  # Full question details for rendering
                "instructions": exam_package["instructions"]
            }
        }]
    )

    logger.debug(f"Delivering exam {exam_package['exam_id']}, waiting for responses")

    # Interrupt to wait for student responses
    # Frontend will resume with responses dict in resume_data
    try:
        interrupt({})
    except RuntimeError:
        # Not in runnable context (e.g., unit tests) - skip interrupt
        pass

    return {
        "messages": [tool_message]
    }


def mark_exam_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Mark all exam responses using diagnose subgraph."""
    logger.info("=== EXAM: mark_exam_node ===")

    questions = state["questions"]
    responses = state.get("responses", {})

    logger.debug(f"Marking {len(questions)} questions")

    marking = {}
    gap_outcomes = []

    for i, question in enumerate(questions):
        question_num = i + 1
        question_id = question["id"]
        user_answer = responses.get(str(question_num), "")

        logger.debug(f"Marking Q{question_num}: {question_id}")

        # Diagnose this answer
        diagnose_result = compiled_diagnose_graph.invoke({
            "question": question,
            "user_answer": user_answer
        })

        is_correct = diagnose_result["result"] == "correct"
        marks_awarded = question["marks"] if is_correct else 0

        marking[str(question_num)] = {
            "question_id": question_id,
            "correct": is_correct,
            "marks_available": question["marks"],
            "marks_awarded": marks_awarded,
            "gap_tags": diagnose_result.get("gap_tags", []),
            "remediation": diagnose_result.get("remediation")
        }

        # Track weak outcomes
        if not is_correct:
            gap_outcomes.append(question["outcome_id"])

    # Calculate totals
    total_available = sum(q["marks"] for q in questions)
    total_awarded = sum(m["marks_awarded"] for m in marking.values())
    percentage = round(total_awarded / total_available * 100, 1) if total_available > 0 else 0

    logger.info(f"Marking complete: {total_awarded}/{total_available} ({percentage}%)")
    logger.info(f"Weak outcomes: {list(set(gap_outcomes))}")

    return {
        "marking": marking,
        "gap_outcomes": list(set(gap_outcomes))  # Unique outcomes
    }


def show_results_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Show exam results and remediation via tool call."""
    logger.info("=== EXAM: show_results_node ===")

    exam_package = state["exam_package"]
    marking = state["marking"]
    gap_outcomes = state["gap_outcomes"]

    # Calculate summary stats
    total_available = sum(m["marks_available"] for m in marking.values())
    total_awarded = sum(m["marks_awarded"] for m in marking.values())
    percentage = round(total_awarded / total_available * 100, 1) if total_available > 0 else 0
    correct_count = sum(1 for m in marking.values() if m["correct"])
    total_count = len(marking)

    # Group remediation by outcome
    remediation_by_outcome = {}
    for mark_data in marking.values():
        if not mark_data["correct"]:
            question_id = mark_data["question_id"]
            # Find the question to get outcome_id
            outcome_id = None
            for q in state["questions"]:
                if q["id"] == question_id:
                    outcome_id = q["outcome_id"]
                    break

            if outcome_id:
                if outcome_id not in remediation_by_outcome:
                    remediation_by_outcome[outcome_id] = []
                remediation_by_outcome[outcome_id].append({
                    "question_id": question_id,
                    "remediation": mark_data.get("remediation"),
                    "gap_tags": mark_data.get("gap_tags", [])
                })

    # Create tool call with results
    tool_message = AIMessage(
        content="",
        tool_calls=[{
            "id": f"results_{exam_package['exam_id']}",
            "name": "ShowExamResultsTool",
            "args": {
                "exam_id": exam_package["exam_id"],
                "total_marks": total_available,
                "marks_awarded": total_awarded,
                "percentage": percentage,
                "correct_count": correct_count,
                "total_questions": total_count,
                "marking": marking,
                "weak_outcomes": gap_outcomes,
                "remediation_by_outcome": remediation_by_outcome,
                "grade": get_sqa_grade(percentage, state["level"])
            }
        }]
    )

    logger.debug(f"Showing results: {total_awarded}/{total_available} ({percentage}%)")

    # Interrupt to wait for next exam decision
    # Frontend will resume with next_exam boolean in resume_data
    try:
        interrupt({})
    except RuntimeError:
        # Not in runnable context (e.g., unit tests) - skip interrupt
        pass

    return {
        "messages": [tool_message]
    }


def check_next_exam_node(state: ExamAssessmentState) -> Dict[str, Any]:
    """Check if user wants another exam (from resume_data).

    Frontend sends: resume: JSON.stringify({ next_exam: true/false })
    """
    logger.info("=== EXAM: check_next_exam_node ===")

    resume_data = state.get("resume_data", {})
    should_continue = resume_data.get("next_exam", False)

    # Increment exam count if continuing
    exam_count = state.get("exam_count", 0)
    if should_continue:
        exam_count += 1

    logger.info(f"User wants next exam: {should_continue} (count: {exam_count})")

    return {
        "should_continue": should_continue,
        "exam_count": exam_count
    }


# ============================================================================
# Helper Functions
# ============================================================================

def get_sqa_grade(percentage: float, level: str) -> str:
    """Convert percentage to SQA grade based on level."""
    if level in ["Nat 3", "Nat 4"]:
        # Pass/Fail for National 3 and 4
        return "Pass" if percentage >= 50 else "Fail"
    else:
        # A-D grading for Nat 5, Higher, Advanced Higher
        if percentage >= 70:
            return "A"
        elif percentage >= 60:
            return "B"
        elif percentage >= 50:
            return "C"
        elif percentage >= 45:
            return "D"
        else:
            return "No Award"


# ============================================================================
# Routing Logic
# ============================================================================

def route_after_check_next(state: ExamAssessmentState) -> str:
    """Route based on whether user wants another exam."""
    should_continue = state.get("should_continue", False)

    if should_continue:
        logger.debug("Routing to: build_blueprint (next exam)")
        return "build_blueprint"
    else:
        logger.debug("Routing to: END (finish)")
        return END


# ============================================================================
# Graph Construction
# ============================================================================

# Build the exam assessment graph
exam_graph = StateGraph(ExamAssessmentState)

# Add nodes
exam_graph.add_node("build_blueprint", build_blueprint_node)
exam_graph.add_node("fill_slots", fill_slots_node)
exam_graph.add_node("assemble_exam", assemble_exam_node)
exam_graph.add_node("deliver_exam", deliver_exam_node)
exam_graph.add_node("mark_exam", mark_exam_node)
exam_graph.add_node("show_results", show_results_node)
exam_graph.add_node("check_next_exam", check_next_exam_node)

logger.info("Added all exam graph nodes")

# Add edges
exam_graph.add_edge("__start__", "build_blueprint")
exam_graph.add_edge("build_blueprint", "fill_slots")
exam_graph.add_edge("fill_slots", "assemble_exam")
exam_graph.add_edge("assemble_exam", "deliver_exam")
exam_graph.add_edge("deliver_exam", "mark_exam")
exam_graph.add_edge("mark_exam", "show_results")
exam_graph.add_edge("show_results", "check_next_exam")

# Conditional edge for looping
exam_graph.add_conditional_edges(
    "check_next_exam",
    route_after_check_next,
    {
        "build_blueprint": "build_blueprint",
        END: END
    }
)

logger.info("Added all exam graph edges")

# Compile with memory checkpointer for session persistence
checkpointer = MemorySaver()
exam_assessment_graph = exam_graph.compile(checkpointer=checkpointer)

logger.info("✅ ExamAssessmentGraph compiled successfully!")
