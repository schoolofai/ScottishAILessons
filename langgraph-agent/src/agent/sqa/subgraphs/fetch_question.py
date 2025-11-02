"""SG_FetchQuestion Subgraph

DRY question retrieval logic used by both main graphs.

Flow:
1. ensure_outcome: Pick outcome if not specified
2. collect_candidates: Fetch questions from sources
3. apply_novelty: Ensure no duplicates

This subgraph implements the core question selection strategy:
- Local questions first
- Nat5+ gets US/past papers
- LLM fallback if nothing found
- Mutation for novelty
"""

import logging
from typing import Dict, Any

from langgraph.graph import StateGraph

from ..states import FetchQuestionState
from ..question_source import QuestionSource
from ..utils import choose_outcome

logger = logging.getLogger(__name__)


# ============================================================================
# Node Functions
# ============================================================================

def ensure_outcome(state: FetchQuestionState) -> Dict[str, Any]:
    """Ensure a target outcome is selected.

    If target_outcome is not provided, selects one from SQA spec
    using weighted random selection.
    """
    logger.info("=== FETCH_QUESTION: ensure_outcome ===")

    if state.get("target_outcome"):
        logger.debug(f"Using provided outcome: {state['target_outcome']}")
        return {}

    # Get SQA spec to choose from
    subject = state["subject"]
    level = state["level"]

    logger.debug(f"Fetching spec for {subject} {level}")
    spec = QuestionSource.get_sqa_spec(subject, level)

    # Choose outcome with history awareness
    selected_outcome = choose_outcome(
        spec["outcomes"],
        used_question_ids=state.get("used_question_ids", [])
    )

    logger.info(f"Selected outcome: {selected_outcome}")
    return {"target_outcome": selected_outcome}


def collect_candidates(state: FetchQuestionState) -> Dict[str, Any]:
    """Collect candidate questions from all available sources.

    Strategy:
    1. Always fetch local questions
    2. If Nat5+, also fetch US/past papers
    3. If nothing found, generate with LLM
    """
    logger.info("=== FETCH_QUESTION: collect_candidates ===")

    subject = state["subject"]
    level = state["level"]
    outcome_id = state["target_outcome"]

    candidates = []

    # Step 1: Local questions
    logger.debug("Fetching local questions...")
    local_questions = QuestionSource.get_local_questions(
        subject, level, outcome_id, limit=5
    )
    candidates.extend(local_questions)
    logger.info(f"Found {len(local_questions)} local questions")

    # Step 2: Nat5+ rule - US/past papers
    eligible_levels = ["Nat 5", "Higher", "Advanced Higher"]
    if level in eligible_levels:
        logger.debug("Level eligible for US/past papers, fetching...")
        us_past_questions = QuestionSource.get_us_or_past_questions(
            subject, level, outcome_id, limit=5
        )
        candidates.extend(us_past_questions)
        logger.info(f"Found {len(us_past_questions)} US/past questions")
    else:
        logger.debug(f"Level {level} not eligible for US/past papers")

    # Step 3: LLM fallback
    if len(candidates) == 0:
        logger.warning("No questions found, using LLM fallback")
        llm_question = QuestionSource.generate_question(
            subject, level, outcome_id, marks=4
        )
        candidates.append(llm_question)
        logger.info("Generated LLM question")

    logger.info(f"Total candidates collected: {len(candidates)}")
    return {"__candidates": candidates}


def apply_novelty(state: FetchQuestionState) -> Dict[str, Any]:
    """Apply novelty check to ensure no duplicate questions.

    Strategy:
    1. Try to find unused question from candidates
    2. If all used, mutate one to create variant
    3. Update used_question_ids tracking
    """
    logger.info("=== FETCH_QUESTION: apply_novelty ===")

    candidates = state.get("__candidates", [])
    used_ids = set(state.get("used_question_ids", []))

    logger.debug(f"Checking {len(candidates)} candidates against {len(used_ids)} used IDs")

    # Try to find unused question
    chosen = None
    for candidate in candidates:
        if candidate["id"] not in used_ids:
            chosen = candidate
            logger.info(f"Found unused question: {candidate['id']}")
            break

    # All questions used? Mutate one
    if chosen is None:
        logger.warning("All candidates already used, creating variant")
        if candidates:
            chosen = QuestionSource.mutate_question(candidates[0])
            logger.info(f"Created variant: {chosen['id']}")
        else:
            raise ValueError("No candidates available for mutation")

    # Update tracking
    updated_used_ids = list(used_ids | {chosen["id"]})

    logger.info(f"Selected question: {chosen['id']} (source: {chosen['source']})")
    logger.debug(f"Updated used_ids count: {len(updated_used_ids)}")

    return {
        "question": chosen,
        "used_question_ids": updated_used_ids,
        "__candidates": None  # Clear temporary state
    }


# ============================================================================
# Graph Construction
# ============================================================================

# Build the fetch question subgraph
fetch_graph = StateGraph(FetchQuestionState)

# Add nodes
fetch_graph.add_node("ensure_outcome", ensure_outcome)
fetch_graph.add_node("collect_candidates", collect_candidates)
fetch_graph.add_node("apply_novelty", apply_novelty)

# Add edges (linear flow)
fetch_graph.add_edge("__start__", "ensure_outcome")
fetch_graph.add_edge("ensure_outcome", "collect_candidates")
fetch_graph.add_edge("collect_candidates", "apply_novelty")

# Compile
compiled_fetch_graph = fetch_graph.compile()

logger.info("SG_FetchQuestion subgraph compiled successfully")
