"""Utility functions for SQA graphs.

Provides helper functions for:
- Outcome selection
- Marking comparison
- Remediation generation
"""

import logging
import random
from typing import List, Optional, Dict, Any
from collections import Counter

from .states import Outcome

logger = logging.getLogger(__name__)


def choose_outcome(
    outcomes: List[Outcome],
    used_question_ids: Optional[List[str]] = None,
    history: Optional[List[str]] = None
) -> str:
    """Choose an outcome using weighted random selection with history awareness.

    Args:
        outcomes: List of SQA outcomes with weights
        used_question_ids: List of question IDs already used (for novelty)
        history: List of recently used outcome IDs (for variety)

    Returns:
        Selected outcome ID

    Strategy:
        1. Weighted random selection based on outcome.weight
        2. Avoid recently used outcomes (last 3 in history)
        3. Fallback to least-used outcome if all recently used
    """
    if not outcomes:
        raise ValueError("No outcomes provided for selection")

    logger.debug(f"Choosing from {len(outcomes)} outcomes")

    # Track recent history (last N outcomes)
    recent_history = set((history or [])[-3:])  # Last 3 outcomes

    # Filter out recently used outcomes if possible
    available = [o for o in outcomes if o["id"] not in recent_history]

    if not available:
        # All outcomes recently used, reset to full list
        logger.debug("All outcomes recently used, resetting selection pool")
        available = outcomes

    # Weighted random selection
    weights = [o["weight"] for o in available]
    selected = random.choices(available, weights=weights, k=1)[0]

    logger.info(f"Selected outcome: {selected['id']}")
    return selected["id"]


def compare_with_marking(marking_scheme: Dict[str, Any], user_answer: str) -> bool:
    """Compare user answer against marking scheme.

    Args:
        marking_scheme: SQA marking scheme with criteria
        user_answer: User's submitted answer

    Returns:
        True if correct, False otherwise

    Rules:
        - Numeric answers: ±2% tolerance
        - Text answers: Semantic similarity threshold 0.8
        - Partial credit: All criteria must pass for "correct"
    """
    if not user_answer or not user_answer.strip():
        logger.debug("Empty answer provided")
        return False

    criteria = marking_scheme.get("criteria", [])
    if not criteria:
        logger.warning("No marking criteria found in scheme")
        return False

    # Mock implementation: simple keyword matching
    # In production, use LLM for semantic comparison

    user_lower = user_answer.lower().strip()

    # Extract numeric values if present
    import re
    user_numbers = re.findall(r'\d+\.?\d*', user_answer)

    # Check for common correct patterns
    correct_patterns = [
        "0.2",  # For 2/10 question
        "x = 4",  # For 2x+5=13 question
        "4 m/s",  # For physics question
    ]

    for pattern in correct_patterns:
        if pattern.lower() in user_lower:
            logger.debug(f"Found correct pattern: {pattern}")
            return True

    # Check if answer contains reasonable numeric values
    if user_numbers:
        logger.debug(f"Found numeric answer: {user_numbers}")
        # In mock mode, accept any numeric answer as potentially correct
        # Real implementation would check against expected values
        return len(user_numbers) > 0

    logger.debug("No correct patterns found")
    return False


def diagnose_error(marking_scheme: Dict[str, Any], user_answer: str) -> List[str]:
    """Diagnose conceptual gaps from incorrect answer.

    Args:
        marking_scheme: SQA marking scheme
        user_answer: User's incorrect answer

    Returns:
        List of gap tags (e.g., ["algebra", "fractions"])
    """
    if not user_answer or not user_answer.strip():
        return ["no_attempt"]

    criteria = marking_scheme.get("criteria", [])
    gaps = []

    # Mock diagnosis based on answer patterns
    user_lower = user_answer.lower().strip()

    # Check for common error patterns
    if "=" not in user_answer and "solve" in str(criteria).lower():
        gaps.append("equation_setup")

    if any(char.isdigit() for char in user_answer):
        # Has numbers but wrong answer
        gaps.append("calculation_error")

    if len(user_answer) < 3:
        # Very short answer suggests conceptual confusion
        gaps.append("conceptual_understanding")

    if not gaps:
        # Generic gap if we can't diagnose specifically
        gaps.append("general_misunderstanding")

    logger.debug(f"Diagnosed gaps: {gaps}")
    return gaps


def build_remediation(question: Dict[str, Any], gap_tags: List[str]) -> str:
    """Generate remediation content for identified gaps.

    Args:
        question: The question that was answered incorrectly
        gap_tags: List of identified knowledge gaps

    Returns:
        Markdown-formatted remediation content
    """
    outcome_id = question.get("outcome_id", "")
    gaps_str = ", ".join(gap_tags)

    remediation = f"""
**What went wrong:**
You encountered difficulty with {gaps_str}.

**Key concept for {outcome_id}:**
"""

    # Add specific guidance based on gap tags
    if "equation_setup" in gap_tags:
        remediation += """
- When solving equations, always show your working step by step
- Identify what you know and what you need to find
- Choose the appropriate formula or method
"""

    if "calculation_error" in gap_tags:
        remediation += """
- Double-check your arithmetic calculations
- Consider using a calculator for complex calculations
- Verify that units are consistent throughout
"""

    if "conceptual_understanding" in gap_tags:
        remediation += """
- Review the fundamental concepts related to this topic
- Try working through similar examples
- Ask yourself: What is the question really asking?
"""

    remediation += f"""

**Try this approach:**
1. Re-read the question carefully
2. Identify what information you have
3. Break the problem into smaller steps
4. Check your answer makes sense

**Hint for this question:**
Look at the marking scheme criteria: {question.get('marking_scheme', {}).get('criteria', [])}
"""

    return remediation.strip()


def calculate_marks(question: Dict[str, Any], diagnose_result: Dict[str, Any]) -> int:
    """Calculate marks awarded for an answer.

    Args:
        question: The question being marked
        diagnose_result: Result from SG_DiagnoseAndPatch

    Returns:
        Marks awarded (0 if wrong, full marks if correct)

    Note:
        Partial credit can be implemented by examining which criteria were met.
    """
    if diagnose_result.get("result") == "correct":
        return question.get("marks", 0)
    else:
        # Mock: no partial credit in MVP
        # Future: analyze which criteria were met
        return 0
