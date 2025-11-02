"""QuestionSource Tool Interface

Unified interface for question and specification retrieval across SQA subjects and levels.

This module provides 5 methods:
1. get_sqa_spec() - Fetch SQA specification and assessment structure
2. get_local_questions() - Fetch centre/real-life questions
3. get_us_or_past_questions() - Fetch Understanding Standards or past papers
4. generate_question() - LLM fallback generation
5. mutate_question() - Create fresh variants

Current implementation uses mock data for development. Replace with real data sources in production.
"""

import logging
import random
import uuid
from typing import List, Optional

from .states import Question, SQASpec, Outcome, AssessmentSection, MarkingScheme, MarkingCriteria

logger = logging.getLogger(__name__)


# ============================================================================
# Mock Data Repository
# ============================================================================

MOCK_SQA_SPECS = {
    ("Mathematics", "Nat 3"): {
        "outcomes": [
            {"id": "MNU-3-01", "label": "Number, money and measure", "weight": 0.4},
            {"id": "MNU-3-02", "label": "Shape, position and movement", "weight": 0.3},
            {"id": "MNU-3-03", "label": "Information handling", "weight": 0.3},
        ],
        "assessment_structure": [
            {"section": "Assignment", "outcome_ids": ["MNU-3-01", "MNU-3-02", "MNU-3-03"], "marks": 30}
        ]
    },
    ("Mathematics", "Nat 4"): {
        "outcomes": [
            {"id": "MNU-4-01", "label": "Expressions and formulae", "weight": 0.25},
            {"id": "MNU-4-02", "label": "Relationships", "weight": 0.25},
            {"id": "MNU-4-03", "label": "Numeracy", "weight": 0.25},
            {"id": "MNU-4-04", "label": "Reasoning", "weight": 0.25},
        ],
        "assessment_structure": [
            {"section": "Assignment", "outcome_ids": ["MNU-4-01", "MNU-4-02", "MNU-4-03", "MNU-4-04"], "marks": 40}
        ]
    },
    ("Mathematics", "Nat 5"): {
        "outcomes": [
            {"id": "MNU-5-01", "label": "Expressions and formulae", "weight": 0.25},
            {"id": "MNU-5-02", "label": "Relationships", "weight": 0.25},
            {"id": "MNU-5-03", "label": "Applications", "weight": 0.25},
            {"id": "MNU-5-04", "label": "Numeracy", "weight": 0.25},
        ],
        "assessment_structure": [
            {"section": "Paper 1 (Non-calculator)", "outcome_ids": ["MNU-5-01", "MNU-5-02"], "marks": 40},
            {"section": "Paper 2 (Calculator)", "outcome_ids": ["MNU-5-03", "MNU-5-04"], "marks": 50},
        ]
    },
    ("Mathematics", "Higher"): {
        "outcomes": [
            {"id": "MNU-H-01", "label": "Expressions and functions", "weight": 0.3},
            {"id": "MNU-H-02", "label": "Relationships and calculus", "weight": 0.4},
            {"id": "MNU-H-03", "label": "Applications", "weight": 0.3},
        ],
        "assessment_structure": [
            {"section": "Paper 1 (Non-calculator)", "outcome_ids": ["MNU-H-01", "MNU-H-02"], "marks": 60},
            {"section": "Paper 2 (Calculator)", "outcome_ids": ["MNU-H-02", "MNU-H-03"], "marks": 70},
        ]
    },
    ("Physics", "Nat 5"): {
        "outcomes": [
            {"id": "PHY-5-01", "label": "Dynamics and space", "weight": 0.33},
            {"id": "PHY-5-02", "label": "Electricity and energy", "weight": 0.33},
            {"id": "PHY-5-03", "label": "Waves and radiation", "weight": 0.34},
        ],
        "assessment_structure": [
            {"section": "Written Exam", "outcome_ids": ["PHY-5-01", "PHY-5-02", "PHY-5-03"], "marks": 110}
        ]
    },
    ("Physics", "Higher"): {
        "outcomes": [
            {"id": "PHY-H-01", "label": "Our dynamic universe", "weight": 0.25},
            {"id": "PHY-H-02", "label": "Particles and waves", "weight": 0.25},
            {"id": "PHY-H-03", "label": "Electricity", "weight": 0.25},
            {"id": "PHY-H-04", "label": "Researching physics", "weight": 0.25},
        ],
        "assessment_structure": [
            {"section": "Written Exam", "outcome_ids": ["PHY-H-01", "PHY-H-02", "PHY-H-03"], "marks": 130},
            {"section": "Assignment", "outcome_ids": ["PHY-H-04"], "marks": 20}
        ]
    },
}

MOCK_LOCAL_QUESTIONS = {
    "MNU-5-01": [
        {
            "id": "local_mnu_5_01_001",
            "source": "local",
            "subject": "Mathematics",
            "level": "Nat 5",
            "outcome_id": "MNU-5-01",
            "text": "Calculate the value of $\\frac{2}{10}$ as a decimal.",
            "marks": 1,
            "marking_scheme": {
                "criteria": [{"step": "Convert fraction to decimal", "marks": 1}],
                "total_marks": 1
            },
            "metadata": {"difficulty": "easy", "topic": "fractions"}
        },
        {
            "id": "local_mnu_5_01_002",
            "source": "local",
            "subject": "Mathematics",
            "level": "Nat 5",
            "outcome_id": "MNU-5-01",
            "text": "Expand and simplify: $3(x + 4) - 2(x - 1)$",
            "marks": 2,
            "marking_scheme": {
                "criteria": [
                    {"step": "Expand brackets", "marks": 1},
                    {"step": "Simplify to x + 14", "marks": 1}
                ],
                "total_marks": 2
            },
            "metadata": {"difficulty": "medium", "topic": "algebra"}
        },
    ],
    "MNU-5-02": [
        {
            "id": "local_mnu_5_02_001",
            "source": "local",
            "subject": "Mathematics",
            "level": "Nat 5",
            "outcome_id": "MNU-5-02",
            "text": "Solve the equation: $2x + 5 = 13$",
            "marks": 2,
            "marking_scheme": {
                "criteria": [
                    {"step": "Subtract 5 from both sides", "marks": 1},
                    {"step": "Divide by 2 to get x = 4", "marks": 1}
                ],
                "total_marks": 2
            },
            "metadata": {"difficulty": "easy", "topic": "equations"}
        },
    ],
    "PHY-5-01": [
        {
            "id": "local_phy_5_01_001",
            "source": "local",
            "subject": "Physics",
            "level": "Nat 5",
            "outcome_id": "PHY-5-01",
            "text": "A car accelerates from rest to 20 m/s in 5 seconds. Calculate the acceleration.",
            "marks": 3,
            "marking_scheme": {
                "criteria": [
                    {"step": "State equation a = (v-u)/t", "marks": 1},
                    {"step": "Substitute values a = (20-0)/5", "marks": 1},
                    {"step": "Calculate a = 4 m/s²", "marks": 1}
                ],
                "total_marks": 3
            },
            "metadata": {"difficulty": "medium", "topic": "dynamics"}
        },
    ],
}


# ============================================================================
# QuestionSource Class
# ============================================================================

class QuestionSource:
    """Unified question and specification retrieval tool."""

    @staticmethod
    def get_sqa_spec(subject: str, level: str) -> SQASpec:
        """Get SQA specification and assessment structure for a subject+level.

        Args:
            subject: Subject name (e.g., "Mathematics", "Physics")
            level: SQA level (e.g., "Nat 5", "Higher")

        Returns:
            SQASpec containing outcomes and assessment structure

        Raises:
            ValueError: If subject/level combination not found
        """
        logger.info(f"QuestionSource.get_sqa_spec({subject}, {level})")

        key = (subject, level)
        if key not in MOCK_SQA_SPECS:
            available = ", ".join([f"{s} {l}" for s, l in MOCK_SQA_SPECS.keys()])
            raise ValueError(
                f"SQA spec not found for {subject} {level}. "
                f"Available: {available}"
            )

        spec_data = MOCK_SQA_SPECS[key]
        logger.debug(f"Found spec with {len(spec_data['outcomes'])} outcomes")

        return SQASpec(
            outcomes=[Outcome(**o) for o in spec_data["outcomes"]],
            assessment_structure=[AssessmentSection(**s) for s in spec_data["assessment_structure"]]
        )

    @staticmethod
    def get_local_questions(
        subject: str,
        level: str,
        outcome_id: str,
        limit: int = 5
    ) -> List[Question]:
        """Fetch centre-created or real-life questions for an outcome.

        Args:
            subject: Subject name
            level: SQA level
            outcome_id: Specific outcome ID (e.g., "MNU-5-01")
            limit: Maximum number of questions to return

        Returns:
            List of Question objects (may be empty)
        """
        logger.info(f"QuestionSource.get_local_questions({subject}, {level}, {outcome_id}, limit={limit})")

        questions = MOCK_LOCAL_QUESTIONS.get(outcome_id, [])
        result = questions[:limit]

        logger.debug(f"Found {len(result)} local questions for {outcome_id}")
        return result

    @staticmethod
    def get_us_or_past_questions(
        subject: str,
        level: str,
        outcome_id: str,
        limit: int = 5
    ) -> List[Question]:
        """Fetch Understanding Standards or SQA past paper questions.

        Only available for Nat 5, Higher, and Advanced Higher.
        Returns empty list for lower levels.

        Args:
            subject: Subject name
            level: SQA level
            outcome_id: Specific outcome ID
            limit: Maximum number of questions to return

        Returns:
            List of Question objects (empty for Nat 3, Nat 4)
        """
        logger.info(f"QuestionSource.get_us_or_past_questions({subject}, {level}, {outcome_id}, limit={limit})")

        # Nat5+ rule: only these levels have US/past papers
        eligible_levels = ["Nat 5", "Higher", "Advanced Higher"]
        if level not in eligible_levels:
            logger.debug(f"Level {level} not eligible for US/past questions (must be {eligible_levels})")
            return []

        # Mock implementation: generate 1-2 US/past questions
        num_questions = random.randint(1, min(2, limit))
        questions = []

        for i in range(num_questions):
            question = {
                "id": f"us_past_{outcome_id.lower().replace('-', '_')}_{uuid.uuid4().hex[:6]}",
                "source": random.choice(["us", "past"]),
                "subject": subject,
                "level": level,
                "outcome_id": outcome_id,
                "text": f"[US/Past Paper] Sample question for {outcome_id} (mock data)",
                "marks": random.choice([2, 3, 4, 5]),
                "marking_scheme": {
                    "criteria": [
                        {"step": "Step 1", "marks": 1},
                        {"step": "Step 2", "marks": 1},
                    ],
                    "total_marks": 2
                },
                "metadata": {"source_paper": "2023", "question_number": i + 1}
            }
            questions.append(question)

        logger.debug(f"Generated {len(questions)} US/past questions for {outcome_id}")
        return questions

    @staticmethod
    def generate_question(
        subject: str,
        level: str,
        outcome_id: str,
        marks: int = 4
    ) -> Question:
        """Generate a question using LLM fallback.

        Called when no local or US/past questions are available.

        Args:
            subject: Subject name
            level: SQA level
            outcome_id: Specific outcome ID
            marks: Target marks for the question

        Returns:
            Generated Question object
        """
        logger.info(f"QuestionSource.generate_question({subject}, {level}, {outcome_id}, marks={marks})")
        logger.warning("Using LLM fallback - no questions found in local/US/past sources")

        # Mock LLM generation
        question_id = f"llm_{outcome_id.lower().replace('-', '_')}_{uuid.uuid4().hex[:8]}"

        # Generate marking criteria based on marks
        num_steps = max(1, marks // 2)
        marks_per_step = marks // num_steps
        remainder = marks % num_steps

        criteria = []
        for i in range(num_steps):
            step_marks = marks_per_step + (1 if i < remainder else 0)
            criteria.append(MarkingCriteria(
                step=f"Step {i + 1} for {outcome_id}",
                marks=step_marks
            ))

        question = Question(
            id=question_id,
            source="llm",
            subject=subject,
            level=level,
            outcome_id=outcome_id,
            text=f"[LLM Generated] Question for {subject} {level} - {outcome_id} ({marks} marks)",
            marks=marks,
            marking_scheme=MarkingScheme(
                criteria=criteria,
                total_marks=marks
            ),
            metadata={"generated": True, "model": "mock-llm"}
        )

        logger.debug(f"Generated LLM question: {question_id}")
        return question

    @staticmethod
    def mutate_question(question: Question) -> Question:
        """Create a fresh variant from an existing question.

        Used to ensure novelty when all questions have been used.

        Args:
            question: Existing question to mutate

        Returns:
            New Question object with modified content
        """
        logger.info(f"QuestionSource.mutate_question({question['id']})")

        # Count existing variants
        if "_variant_" in question["id"]:
            # Extract base_id and current variant number
            parts = question["id"].rsplit("_variant_", 1)
            base_id = parts[0]
            current_variant = int(parts[1])
            variant_num = current_variant + 1
        else:
            # First variant
            base_id = question["id"]
            variant_num = 1

        new_id = f"{base_id}_variant_{variant_num}"

        # Mock mutation: append variant marker to text
        mutated_question = Question(
            id=new_id,
            source="variant",
            subject=question["subject"],
            level=question["level"],
            outcome_id=question["outcome_id"],
            text=f"{question['text']} [Variant {variant_num}]",
            marks=question["marks"],
            marking_scheme=question["marking_scheme"].copy(),
            metadata={**question.get("metadata", {}), "variant_of": question["id"]}
        )

        logger.debug(f"Created variant: {new_id} from {question['id']}")
        return mutated_question


# ============================================================================
# Singleton Instance
# ============================================================================

# Export singleton instance for easy importing
question_source = QuestionSource()
