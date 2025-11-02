"""Test data fixtures for SQA graphs testing.

Provides sample questions, specs, and states for unit and integration tests.
"""

from typing import List, Dict, Any

# ============================================================================
# Sample Outcomes
# ============================================================================

SAMPLE_OUTCOMES = {
    "Mathematics": {
        "Nat 5": [
            {"id": "MNU-5-01", "label": "Expressions and formulae", "weight": 0.25},
            {"id": "MNU-5-02", "label": "Relationships", "weight": 0.25},
            {"id": "MNU-5-03", "label": "Applications", "weight": 0.25},
            {"id": "MNU-5-04", "label": "Numeracy", "weight": 0.25},
        ],
        "Higher": [
            {"id": "MNU-H-01", "label": "Expressions and functions", "weight": 0.3},
            {"id": "MNU-H-02", "label": "Relationships and calculus", "weight": 0.4},
            {"id": "MNU-H-03", "label": "Applications", "weight": 0.3},
        ]
    },
    "Physics": {
        "Nat 5": [
            {"id": "PHY-5-01", "label": "Dynamics and space", "weight": 0.33},
            {"id": "PHY-5-02", "label": "Electricity and energy", "weight": 0.33},
            {"id": "PHY-5-03", "label": "Waves and radiation", "weight": 0.34},
        ]
    }
}

# ============================================================================
# Sample Questions
# ============================================================================

SAMPLE_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "test_q_001",
        "source": "local",
        "subject": "Mathematics",
        "level": "Nat 5",
        "outcome_id": "MNU-5-01",
        "text": "Calculate 2/10 as a decimal.",
        "marks": 1,
        "marking_scheme": {
            "criteria": [{"step": "Convert fraction", "marks": 1}],
            "total_marks": 1
        },
        "metadata": {"difficulty": "easy"}
    },
    {
        "id": "test_q_002",
        "source": "local",
        "subject": "Mathematics",
        "level": "Nat 5",
        "outcome_id": "MNU-5-02",
        "text": "Solve: 2x + 5 = 13",
        "marks": 2,
        "marking_scheme": {
            "criteria": [
                {"step": "Subtract 5", "marks": 1},
                {"step": "Divide by 2", "marks": 1}
            ],
            "total_marks": 2
        },
        "metadata": {"difficulty": "easy"}
    },
    {
        "id": "test_q_003",
        "source": "us",
        "subject": "Physics",
        "level": "Nat 5",
        "outcome_id": "PHY-5-01",
        "text": "Calculate acceleration from v = u + at",
        "marks": 3,
        "marking_scheme": {
            "criteria": [
                {"step": "Rearrange formula", "marks": 1},
                {"step": "Substitute values", "marks": 1},
                {"step": "Calculate result", "marks": 1}
            ],
            "total_marks": 3
        },
        "metadata": {"source_paper": "2023"}
    }
]

# ============================================================================
# Sample States
# ============================================================================

def get_sample_fetch_question_state() -> Dict[str, Any]:
    """Get a sample FetchQuestionState for testing."""
    return {
        "subject": "Mathematics",
        "level": "Nat 5",
        "target_outcome": "MNU-5-01",
        "used_question_ids": []
    }


def get_sample_diagnose_patch_state() -> Dict[str, Any]:
    """Get a sample DiagnosePatchState for testing."""
    return {
        "question": SAMPLE_QUESTIONS[0],
        "user_answer": "0.2"
    }


def get_sample_question_practice_state() -> Dict[str, Any]:
    """Get a sample QuestionPracticeState for testing."""
    return {
        "subject": "Mathematics",
        "level": "Nat 5",
        "used_question_ids": [],
        "total_questions": 0,
        "correct_count": 0,
        "streak": 0,
        "should_continue": True,
        "messages": []
    }


def get_sample_exam_assessment_state() -> Dict[str, Any]:
    """Get a sample ExamAssessmentState for testing."""
    return {
        "subject": "Physics",
        "level": "Nat 5",
        "questions": [],
        "used_question_ids": [],
        "exam_count": 0,
        "should_continue": True,
        "messages": []
    }

# ============================================================================
# Sample Answers
# ============================================================================

CORRECT_ANSWERS = {
    "test_q_001": "0.2",
    "test_q_002": "x = 4",
    "test_q_003": "4 m/s²"
}

WRONG_ANSWERS = {
    "test_q_001": "completely wrong",  # No match
    "test_q_002": "I don't know",  # No attempt at equation
    "test_q_003": "not sure"  # Wrong answer
}
