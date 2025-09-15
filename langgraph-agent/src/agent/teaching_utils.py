"""Shared utility functions for teaching graphs.

Contains helper functions that can be used by both teaching_graph.py
and teacher_graph_toolcall_interrupt.py to avoid code duplication.
"""

from __future__ import annotations
from typing import Dict, List
from datetime import datetime


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


def _update_mastery_scores(lesson_snapshot: dict, state: dict, existing_updates: list) -> list:
    """Calculate and append new mastery updates based on student performance."""
    outcome_refs = lesson_snapshot.get("outcomeRefs", [])
    mastery_updates = existing_updates.copy()

    is_correct = state.get("is_correct", False)
    attempts = state.get("attempts", 1)
    score = _calculate_mastery_score(is_correct, attempts)

    print(f"🚨 MASTERY DEBUG - Lesson snapshot keys: {list(lesson_snapshot.keys())}")
    print(f"🚨 MASTERY DEBUG - Outcome refs found: {len(outcome_refs)} - {outcome_refs}")
    print(f"🚨 MASTERY DEBUG - State: is_correct={is_correct}, attempts={attempts}, score={score}")
    print(f"🚨 MASTERY DEBUG - Existing updates: {len(existing_updates)}")

    for outcome in outcome_refs:
        mastery_update = _create_mastery_update(outcome, score)
        mastery_updates.append(mastery_update)
        print(f"🚨 MASTERY DEBUG - Created update: {mastery_update}")

    print(f"🚨 MASTERY DEBUG - Total mastery updates: {len(mastery_updates)}")
    return mastery_updates


def _get_previous_attempts(evidence: list, item_id: str) -> list[str]:
    """Extract previous attempts for this item from evidence."""
    return [entry["response"] for entry in evidence if entry["item_id"] == item_id]


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