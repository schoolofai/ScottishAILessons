"""Mock exam validation module - NO auto-correction.

This module previously applied auto-corrections to fix common agent mistakes.
Auto-corrections have been REMOVED because they were treating symptoms, not causes.

The root causes have been fixed:
1. MCQ is_correct marking - Prompt now has explicit examples and rules
2. Empty hints - Prompt now requires minimum 1 hint
3. Missing misconception fields - Prompt now shows all required fields
4. Standards type field - Schema now matches source (field-presence, no type discriminator)

This module is now a pass-through for backward compatibility.
Validation happens in Pydantic schema (mock_exam_schema_models.py).

If validation fails, the agent prompt should be improved - NOT this module.
"""

import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)


def auto_correct_mock_exam(mock_exam_data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """Pass-through function - NO auto-corrections applied.

    Previously this function applied auto-corrections to fix agent mistakes.
    Auto-corrections have been removed in favor of fixing root causes:
    - Better prompts with explicit examples
    - Schema aligned with source data

    Args:
        mock_exam_data: Mock exam data after conversion to full schema

    Returns:
        Tuple of (data, corrections_log)
        - data: Same as input (unchanged)
        - corrections_log: Empty list (no corrections applied)

    Note:
        If validation fails, fix the agent prompt - not this module.
    """
    logger.debug("Auto-correction pass-through (no corrections applied)")

    # Return data unchanged - no auto-corrections
    # Validation happens in Pydantic schema
    return mock_exam_data, []


def get_correction_stats(corrections: List[str]) -> Dict[str, int]:
    """Get statistics about corrections applied.

    Since auto-corrections have been removed, this always returns zeros.

    Args:
        corrections: List of correction messages (will be empty)

    Returns:
        Dict with all counts at 0
    """
    return {
        "total": 0,
        "mcq_fixes": 0,
        "hints_fixes": 0,
        "misconceptions_fixes": 0,
        "other": 0
    }
