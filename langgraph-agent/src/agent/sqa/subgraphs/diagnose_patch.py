"""SG_DiagnoseAndPatch Subgraph

Answer marking and remediation logic used by both main graphs.

Flow:
1. check_answer: Mark against marking scheme
2. diagnose_gaps: Identify knowledge gaps (conditional - only if wrong)

This subgraph implements:
- Marking against SQA criteria
- Gap detection for remediation
- Remediation content generation
"""

import logging
from typing import Dict, Any

from langgraph.graph import StateGraph, END

from ..states import DiagnosePatchState
from ..utils import compare_with_marking, diagnose_error, build_remediation

logger = logging.getLogger(__name__)


# ============================================================================
# Node Functions
# ============================================================================

def check_answer(state: DiagnosePatchState) -> Dict[str, Any]:
    """Mark user answer against marking scheme.

    Uses fuzzy matching for numeric answers and semantic similarity
    for text answers.
    """
    logger.info("=== DIAGNOSE_PATCH: check_answer ===")

    question = state["question"]
    user_answer = state["user_answer"]

    logger.debug(f"Checking answer for question: {question['id']}")
    logger.debug(f"User answer: {user_answer}")

    # Compare against marking scheme
    is_correct = compare_with_marking(
        question["marking_scheme"],
        user_answer
    )

    if is_correct:
        logger.info("✅ Answer is CORRECT")
        return {
            "result": "correct",
            "gap_tags": []
        }
    else:
        logger.info("❌ Answer is WRONG")
        return {
            "result": "wrong"
        }


def diagnose_gaps(state: DiagnosePatchState) -> Dict[str, Any]:
    """Diagnose knowledge gaps and generate remediation.

    Only called when answer is wrong. Identifies conceptual gaps
    and builds targeted remediation content.
    """
    logger.info("=== DIAGNOSE_PATCH: diagnose_gaps ===")

    question = state["question"]
    user_answer = state["user_answer"]

    # Identify gaps
    gaps = diagnose_error(
        question["marking_scheme"],
        user_answer
    )

    logger.info(f"Identified gaps: {gaps}")

    # Build remediation content
    remediation_text = build_remediation(question, gaps)

    logger.debug(f"Remediation length: {len(remediation_text)} characters")

    return {
        "gap_tags": gaps,
        "remediation": remediation_text
    }


# ============================================================================
# Routing Logic
# ============================================================================

def route_after_check(state: DiagnosePatchState) -> str:
    """Route based on whether answer is correct.

    If correct: skip gap diagnosis (go to END)
    If wrong: diagnose gaps
    """
    result = state.get("result", "wrong")

    if result == "correct":
        logger.debug("Routing to END (correct answer)")
        return END
    else:
        logger.debug("Routing to diagnose_gaps (wrong answer)")
        return "diagnose_gaps"


# ============================================================================
# Graph Construction
# ============================================================================

# Build the diagnose and patch subgraph
diagnose_graph = StateGraph(DiagnosePatchState)

# Add nodes
diagnose_graph.add_node("check_answer", check_answer)
diagnose_graph.add_node("diagnose_gaps", diagnose_gaps)

# Add edges
diagnose_graph.add_edge("__start__", "check_answer")

# Conditional routing after check_answer
diagnose_graph.add_conditional_edges(
    "check_answer",
    route_after_check,
    {
        "diagnose_gaps": "diagnose_gaps",
        END: END
    }
)

# Compile
compiled_diagnose_graph = diagnose_graph.compile()

logger.info("SG_DiagnoseAndPatch subgraph compiled successfully")
