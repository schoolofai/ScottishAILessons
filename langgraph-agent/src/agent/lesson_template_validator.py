"""Lesson template field validation for teaching runtime.

Validates that lesson templates contain all required fields for proper
teaching graph execution, with warnings for missing pedagogical data.
"""

from __future__ import annotations

from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)


class ValidationResult:
    def __init__(self) -> None:
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, message: str) -> None:
        self.errors.append(message)
        logger.error(f"[VALIDATION ERROR] {message}")

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)
        logger.warning(f"[VALIDATION WARNING] {message}")

    def add_info(self, message: str) -> None:
        self.info.append(message)
        logger.info(f"[VALIDATION INFO] {message}")


def validate_lesson_template(lesson_snapshot: Dict[str, Any]) -> ValidationResult:
    """Validate lesson template has all fields needed for teaching.

    Checks:
    - Required top-level fields
    - Card structure
    - CFU completeness (rubric, hints, tolerance)
    - Misconceptions presence
    - Accessibility content (explainer_plain)
    """
    result = ValidationResult()

    # Validate top-level required fields
    required_fields = ["title", "courseId", "cards", "lesson_type"]
    for field in required_fields:
        if field not in lesson_snapshot or not lesson_snapshot[field]:
            result.add_error(f"Missing required field: {field}")
    
    # Validate lesson_type value
    valid_lesson_types = ["teach", "independent_practice", "formative_assessment", "revision", "mock_exam"]
    lesson_type = lesson_snapshot.get("lesson_type", "")
    if lesson_type and lesson_type not in valid_lesson_types:
        result.add_error(f"Invalid lesson_type: {lesson_type}. Must be one of {valid_lesson_types}")

    # Validate cards array
    cards = lesson_snapshot.get("cards", [])
    if not cards:
        result.add_error("No cards found in lesson template")
        return result

    result.add_info(f"Validating {len(cards)} cards")

    # Validate each card
    for i, card in enumerate(cards):
        card_id = card.get("id", f"card_{i}")

        # Check required card fields
        if "cfu" not in card:
            result.add_error(f"Card {card_id}: Missing CFU")
            continue

        cfu = card["cfu"]
        cfu_type = cfu.get("type", "")

        # Check CFU has rubric
        if "rubric" not in cfu:
            result.add_warning(f"Card {card_id}: Missing rubric (evaluation may be inconsistent)")
        else:
            rubric = cfu["rubric"]
            if "criteria" not in rubric or not rubric["criteria"]:
                result.add_warning(f"Card {card_id}: Rubric has no criteria")

        # Check numeric CFU has tolerance and expected
        if cfu_type == "numeric":
            if "tolerance" not in cfu:
                result.add_warning(f"Card {card_id}: Numeric CFU missing tolerance field")
            if "expected" not in cfu:
                result.add_error(f"Card {card_id}: Numeric CFU missing expected answer")
        
        # Check MCQ CFU has options and answerIndex
        if cfu_type == "mcq":
            if "options" not in cfu or not cfu["options"]:
                result.add_error(f"Card {card_id}: MCQ CFU missing options")
            if "answerIndex" not in cfu:
                result.add_error(f"Card {card_id}: MCQ CFU missing answerIndex")

        # Check for hints
        if "hints" not in cfu or not cfu["hints"]:
            result.add_warning(f"Card {card_id}: No authored hints (will use LLM fallback)")

        # Check for misconceptions
        if "misconceptions" not in card or not card["misconceptions"]:
            result.add_warning(f"Card {card_id}: No misconceptions documented")

        # Check for accessibility content
        if "explainer_plain" not in card or not card.get("explainer_plain"):
            result.add_warning(f"Card {card_id}: Missing explainer_plain (accessibility support unavailable)")

    # Check lesson-level metadata
    if "engagement_tags" not in lesson_snapshot:
        result.add_info("No engagement_tags (contextual teaching strategies unavailable)")

    if "policy" not in lesson_snapshot:
        result.add_info("No lesson policy defined")

    if "estMinutes" not in lesson_snapshot:
        result.add_info("No estMinutes defined (timing awareness unavailable)")

    return result


def validate_session_context(session_context: Dict[str, Any]) -> ValidationResult:
    """Validate session context has required curriculum metadata."""
    result = ValidationResult()

    # Required session fields
    if "lesson_snapshot" not in session_context:
        result.add_error("Missing lesson_snapshot in session context")
        return result

    # Validate lesson snapshot
    lesson_result = validate_lesson_template(session_context["lesson_snapshot"])
    result.errors.extend(lesson_result.errors)
    result.warnings.extend(lesson_result.warnings)
    result.info.extend(lesson_result.info)

    # Check curriculum metadata
    if "course_subject" not in session_context:
        result.add_warning("Missing course_subject (generic prompts will be used)")

    if "course_level" not in session_context:
        result.add_warning("Missing course_level (generic prompts will be used)")

    if "enriched_outcomes" not in session_context:
        result.add_info("No enriched_outcomes (SQA alignment info unavailable in prompts)")

    return result


