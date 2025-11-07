"""Batch validation utilities for diagram generation.

Validates lesson templates before batch diagram generation to ensure:
1. Lesson templates exist in database
2. Lesson templates have valid structure (cards, required fields)
3. Cards are eligible for diagram generation

Follows fast-fail principle: All lessons validated BEFORE generation starts.

Uses comprehensive Pydantic validation from json_validator_tool.py to catch:
- Missing required fields (courseId, title/label, outcomeRefs, etc.)
- Invalid field values (estMinutes out of range, invalid lesson_type, etc.)
- Malformed card structures (non-sequential IDs, invalid CFU types, etc.)
- Schema violations (wrong field types, constraint violations, etc.)
"""

import json
import logging
from typing import Dict, Any, List
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class ValidationResult:
    """Result of lesson template validation."""

    def __init__(
        self,
        is_valid: bool,
        errors: List[str] = None,
        warnings: List[str] = None,
        eligible_cards_count: int = 0
    ):
        self.is_valid = is_valid
        self.errors = errors or []
        self.warnings = warnings or []
        self.eligible_cards_count = eligible_cards_count


async def validate_lessons_batch(
    course_id: str,
    lesson_orders: List[int],
    mcp_config_path: str
) -> Dict[int, Dict[str, Any]]:
    """Validate all lessons in batch before diagram generation.

    Implements fast-fail validation: checks all lessons BEFORE starting generation.

    Args:
        course_id: Course identifier
        lesson_orders: List of lesson order numbers to validate
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary mapping order → validation result:
        {
            order: {
                "valid": bool,
                "errors": List[str],
                "warnings": List[str],
                "eligible_cards_count": int
            }
        }

    Example:
        >>> results = await validate_lessons_batch("course_c84874", [1, 2, 3], ".mcp.json")
        >>> results[1]["valid"]
        True
        >>> results[1]["eligible_cards_count"]
        3
    """
    from .diagram_extractor import fetch_lesson_template, extract_diagram_cards

    results = {}

    for order in lesson_orders:
        try:
            # Fetch lesson template
            logger.info(f"Validating lesson order {order}...")

            template = await fetch_lesson_template(
                course_id=course_id,
                order=order,
                mcp_config_path=mcp_config_path
            )

            if not template:
                results[order] = {
                    "valid": False,
                    "errors": [f"Lesson not found: courseId={course_id}, order={order}"],
                    "warnings": [],
                    "eligible_cards_count": 0
                }
                logger.error(f"❌ Lesson order {order}: Not found in database")
                continue

            # Validate lesson template structure
            validation_result = validate_lesson_template_structure(template)

            if not validation_result.is_valid:
                results[order] = {
                    "valid": False,
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings,
                    "eligible_cards_count": 0
                }
                logger.error(f"❌ Lesson order {order}: Validation failed with {len(validation_result.errors)} errors")
                continue

            # Extract eligible cards to count how many diagrams needed
            eligible_cards = await extract_diagram_cards(
                lesson_template=template,
                llm_client=None  # Simple heuristic (no LLM costs)
            )

            results[order] = {
                "valid": True,
                "errors": [],
                "warnings": validation_result.warnings,
                "eligible_cards_count": len(eligible_cards)
            }

            logger.info(f"✅ Lesson order {order}: Valid ({len(eligible_cards)} cards need diagrams)")

        except Exception as e:
            logger.error(f"❌ Lesson order {order}: Validation failed with exception: {e}")
            results[order] = {
                "valid": False,
                "errors": [str(e)],
                "warnings": [],
                "eligible_cards_count": 0
            }

    return results


def _parse_json_fields(template: Dict[str, Any]) -> Dict[str, Any]:
    """Parse JSON string fields in lesson template before Pydantic validation.

    Appwrite stores some fields as JSON strings. This function parses them
    into native Python objects for Pydantic validation.

    Handles:
    - outcomeRefs: "[\"O1\", \"AS1.1\"]" → ["O1", "AS1.1"]
    - engagement_tags: "[\"shopping\", \"money\"]" → ["shopping", "money"]
    - policy: "{\"calculator_allowed\": true}" → {"calculator_allowed": true}

    Args:
        template: Raw lesson template from Appwrite

    Returns:
        Template with parsed JSON fields
    """
    # Create copy to avoid modifying original
    parsed = template.copy()

    # Fields that may be stored as JSON strings
    json_fields = ["outcomeRefs", "engagement_tags", "policy"]

    for field in json_fields:
        if field in parsed and isinstance(parsed[field], str):
            try:
                parsed[field] = json.loads(parsed[field])
                logger.debug(f"Parsed {field} from JSON string")
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse {field} as JSON: {parsed[field][:100]}")
                # Keep as-is if parsing fails - Pydantic will catch the error

    return parsed


def validate_lesson_template_structure(template: Dict[str, Any]) -> ValidationResult:
    """Validate lesson template using comprehensive Pydantic schema.

    Uses the LessonTemplate model from json_validator_tool.py which validates:
    - Required fields: courseId, title/label, outcomeRefs, lesson_type, estMinutes, sow_order, cards
    - Field constraints: courseId pattern, title/label length (30-80 chars), estMinutes range (5-180)
    - Enum validation: lesson_type (teach, independent_practice, etc.), status (draft, review, published)
    - Card structure: sequential IDs (card_001, card_002, ...), card count (1-20), CFU type-specific schemas
    - Rubric validation: total_points equals sum of criteria points
    - Misconception ID format: MISC_[SUBJECT]_[TOPIC]_NNN

    NOTE: This validation is comprehensive but may be TOO strict for diagram generation.
    Cards missing 'rubric' field will fail validation, but diagrams can still be generated
    from cards with valid 'explainer' or 'cfu' content.

    Args:
        template: Lesson template document from Appwrite

    Returns:
        ValidationResult with is_valid, errors, warnings, eligible_cards_count

    Example:
        >>> result = validate_lesson_template_structure(template)
        >>> result.is_valid
        True
        >>> result.eligible_cards_count
        5
    """
    from ..tools.json_validator_tool import LessonTemplate

    try:
        # Parse JSON string fields before validation
        parsed_template = _parse_json_fields(template)

        # Validate with comprehensive Pydantic model
        validated_template = LessonTemplate(**parsed_template)

        # Count eligible cards (cards with explainer or cfu fields)
        cards_with_diagram_potential = 0
        for card in validated_template.cards:
            # Card model guarantees both explainer and cfu exist
            # Count all cards as eligible
            cards_with_diagram_potential += 1

        logger.info(
            f"✅ Pydantic validation passed: {len(validated_template.cards)} cards, "
            f"{cards_with_diagram_potential} eligible for diagrams"
        )

        return ValidationResult(
            is_valid=True,
            errors=[],
            warnings=[],
            eligible_cards_count=cards_with_diagram_potential
        )

    except ValidationError as e:
        # Format Pydantic errors into user-friendly list
        errors = []
        for err in e.errors():
            # Build field path (e.g., "cards.0.cfu.type")
            field_path = ".".join(str(loc) for loc in err['loc'])
            error_msg = f"{field_path}: {err['msg']}"

            # Add input value hint for primitive types
            input_val = err.get('input')
            if input_val is not None and isinstance(input_val, (str, int, float, bool)):
                input_str = str(input_val)
                if len(input_str) <= 50:
                    error_msg += f" (got: {input_val})"
                else:
                    error_msg += f" (got: {input_str[:50]}...)"

            errors.append(error_msg)

        logger.error(f"❌ Pydantic validation failed with {len(errors)} errors")
        for error in errors[:5]:  # Log first 5 errors only
            logger.error(f"  - {error}")

        return ValidationResult(
            is_valid=False,
            errors=errors,
            warnings=[],
            eligible_cards_count=0
        )
