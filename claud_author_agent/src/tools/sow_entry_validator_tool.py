"""SDK MCP server for SOWEntry schema validation using Pydantic models.

This tool validates individual lesson entries during iterative SOW authoring.
Each lesson is generated separately to reduce token scope and improve quality.

Integration: Claude Agent SDK registers this as mcp__entry-validator__validate_sow_entry

Cross-Reference Validation:
- Optionally validates standards/skills codes against Course_outcomes.json
- Ensures structure_type consistency (unit_based vs skills_based)
- Validates that referenced outcomes/skills actually exist in curriculum
"""

import json
import logging
from typing import Dict, Any, List, Optional, Set

from pydantic import ValidationError
from claude_agent_sdk import tool, create_sdk_mcp_server

try:
    from .sow_schema_models import SOWEntry, LessonType, CardType
except ImportError:
    from sow_schema_models import SOWEntry, LessonType, CardType

logger = logging.getLogger(__name__)


def validate_sow_entry(
    entry_json_str: str,
    course_outcomes_json_str: Optional[str] = None
) -> Dict[str, Any]:
    """Validate SOW entry JSON against Pydantic schema with optional cross-reference.

    Args:
        entry_json_str: JSON string of single SOW entry (lesson)
        course_outcomes_json_str: Optional JSON string of Course_outcomes.json for
                                  cross-reference validation of standards/skills codes

    Returns:
        Dictionary with:
        - valid: bool - Whether entry passes all validation
        - errors: List[Dict] - Validation errors (max 10, with locations)
        - cross_reference_errors: List[Dict] - Cross-reference validation errors (if enabled)
        - summary: str - Human-readable summary
        - stats: Dict - Entry statistics (cards, standards covered)
    """
    try:
        # Parse JSON
        try:
            entry_data = json.loads(entry_json_str)
        except json.JSONDecodeError as e:
            return {
                "valid": False,
                "errors": [{
                    "location": "root",
                    "message": f"Invalid JSON: {str(e)}",
                    "value": None,
                    "type": "json_error"
                }],
                "cross_reference_errors": [],
                "summary": "❌ JSON parsing failed",
                "stats": None
            }

        # Validate with Pydantic
        try:
            validated_entry = SOWEntry(**entry_data)

            # Collect statistics
            stats = _collect_entry_stats(validated_entry)

            # Perform cross-reference validation if Course_outcomes.json provided
            cross_ref_errors = []
            if course_outcomes_json_str:
                cross_ref_errors = _cross_reference_validate(
                    validated_entry,
                    course_outcomes_json_str
                )

            # Determine overall validity
            is_valid = len(cross_ref_errors) == 0

            if is_valid:
                summary = f"✅ SOW entry validation passed (lesson {stats['order']}: {stats['lesson_type']}, {stats['total_cards']} cards)"
                if course_outcomes_json_str:
                    summary += " + cross-reference verified"
            else:
                summary = f"⚠️ SOW entry schema valid but {len(cross_ref_errors)} cross-reference errors"

            return {
                "valid": is_valid,
                "errors": [],
                "cross_reference_errors": cross_ref_errors,
                "summary": summary,
                "stats": stats
            }

        except ValidationError as e:
            # Format Pydantic errors into agent-friendly structure
            formatted_errors = _format_validation_errors(e)

            # Limit to 10 errors for concise feedback
            limited_errors = formatted_errors[:10]
            truncated_count = len(formatted_errors) - 10 if len(formatted_errors) > 10 else 0

            summary = f"❌ SOW entry validation failed with {len(formatted_errors)} errors"
            if truncated_count > 0:
                summary += f" (showing first 10, {truncated_count} more errors hidden)"

            return {
                "valid": False,
                "errors": limited_errors,
                "cross_reference_errors": [],
                "summary": summary,
                "stats": None
            }

    except Exception as e:
        logger.exception("Unexpected error during entry validation")
        return {
            "valid": False,
            "errors": [{
                "location": "root",
                "message": f"Unexpected validation error: {str(e)}",
                "value": None,
                "type": "internal_error"
            }],
            "cross_reference_errors": [],
            "summary": f"❌ Validation system error: {str(e)}",
            "stats": None
        }


def _format_validation_errors(validation_error: ValidationError) -> List[Dict[str, Any]]:
    """Convert Pydantic ValidationError into agent-friendly error objects."""
    formatted = []

    for error in validation_error.errors():
        # Build location path from error['loc'] tuple
        location_parts = []
        for part in error['loc']:
            if isinstance(part, int):
                location_parts[-1] = f"{location_parts[-1]}[{part}]"
            else:
                location_parts.append(str(part))

        location = ".".join(location_parts)

        formatted.append({
            "location": location,
            "message": error.get('msg', 'Validation error'),
            "value": error.get('input', None),
            "type": error.get('type', 'validation_error')
        })

    return formatted


def _collect_entry_stats(entry: SOWEntry) -> Dict[str, Any]:
    """Collect statistics about validated SOW entry."""
    total_cards = 0
    card_type_counts = {}

    if entry.lesson_plan and entry.lesson_plan.card_structure:
        total_cards = len(entry.lesson_plan.card_structure)

        for card in entry.lesson_plan.card_structure:
            card_type = card.card_type.value
            card_type_counts[card_type] = card_type_counts.get(card_type, 0) + 1

    # Count standards/skills addressed
    standards_count = len(entry.standards_or_skills_addressed)

    return {
        "order": entry.order,
        "lesson_type": entry.lesson_type.value,
        "label": entry.label,
        "total_cards": total_cards,
        "card_types": card_type_counts,
        "standards_count": standards_count,
        "block_name": entry.coherence.block_name,
        "block_index": entry.coherence.block_index,
        "engagement_tags": entry.engagement_tags,
        "dyslexia_friendly": entry.accessibility_profile.dyslexia_friendly
    }


def _extract_valid_codes_from_outcomes(course_outcomes: Dict[str, Any]) -> tuple[str, Set[str]]:
    """Extract structure_type and valid codes/skill names from Course_outcomes.json.

    Args:
        course_outcomes: Parsed Course_outcomes.json data

    Returns:
        Tuple of (structure_type, set of valid codes/skill names)
    """
    structure_type = course_outcomes.get("structure_type", "unit_based")
    valid_codes: Set[str] = set()

    outcomes = course_outcomes.get("outcomes", [])

    for outcome in outcomes:
        outcome_id = outcome.get("outcomeId", "")

        if structure_type == "unit_based":
            # Unit-based: Extract AS codes from assessmentStandards
            assessment_standards = outcome.get("assessmentStandards", [])
            if isinstance(assessment_standards, str):
                try:
                    assessment_standards = json.loads(assessment_standards)
                except json.JSONDecodeError:
                    assessment_standards = []

            for std in assessment_standards:
                if isinstance(std, dict):
                    code = std.get("code", "")
                    if code:
                        valid_codes.add(code)
        else:
            # Skills-based: Extract SKILL_ outcomeIds as skill names
            if outcome_id.startswith("SKILL_"):
                # Use outcomeTitle as the skill name
                skill_name = outcome.get("outcomeTitle", "")
                if skill_name:
                    valid_codes.add(skill_name)

    return structure_type, valid_codes


def _cross_reference_validate(
    entry: SOWEntry,
    course_outcomes_json_str: str
) -> List[Dict[str, Any]]:
    """Validate entry standards/skills against Course_outcomes.json.

    Args:
        entry: Validated SOWEntry object
        course_outcomes_json_str: JSON string of Course_outcomes.json

    Returns:
        List of cross-reference validation errors
    """
    errors = []

    try:
        course_outcomes = json.loads(course_outcomes_json_str)
    except json.JSONDecodeError as e:
        return [{
            "location": "course_outcomes",
            "message": f"Invalid Course_outcomes.json: {str(e)}",
            "value": None,
            "type": "cross_reference_error"
        }]

    structure_type, valid_codes = _extract_valid_codes_from_outcomes(course_outcomes)

    # Check each standard/skill reference in the entry
    for idx, std_ref in enumerate(entry.standards_or_skills_addressed):
        # Determine which field to check based on structure type
        if structure_type == "unit_based":
            # Check code field
            if hasattr(std_ref, 'code') and std_ref.code:
                if std_ref.code not in valid_codes:
                    errors.append({
                        "location": f"standards_or_skills_addressed[{idx}].code",
                        "message": f"Code '{std_ref.code}' not found in Course_outcomes.json",
                        "value": std_ref.code,
                        "type": "cross_reference_error"
                    })
        else:
            # Check skill_name field
            if hasattr(std_ref, 'skill_name') and std_ref.skill_name:
                if std_ref.skill_name not in valid_codes:
                    errors.append({
                        "location": f"standards_or_skills_addressed[{idx}].skill_name",
                        "message": f"Skill '{std_ref.skill_name}' not found in Course_outcomes.json",
                        "value": std_ref.skill_name,
                        "type": "cross_reference_error"
                    })

    return errors


# ════════════════════════════════════════════════════════════════════════════
# SDK MCP Server Definition for Claude Agent SDK
# ════════════════════════════════════════════════════════════════════════════

@tool(
    "validate_sow_entry",
    "Validate single SOW entry (lesson) JSON for iterative SOW authoring with detailed error reporting. Optionally validates standards/skills codes against Course_outcomes.json.",
    {"entry_json_str": str, "course_outcomes_json_str": str}
)
async def validate_sow_entry_tool(args):
    """SDK tool wrapper for SOW entry schema validation with optional cross-reference.

    Args:
        args: Dictionary with:
            - 'entry_json_str': Complete entry JSON as string (required)
            - 'course_outcomes_json_str': Course_outcomes.json as string (optional)

    Returns:
        SDK tool result with validation details and error status
    """
    entry_json_str = args["entry_json_str"]
    course_outcomes_json_str = args.get("course_outcomes_json_str")

    # Call validation function with optional cross-reference
    result = validate_sow_entry(entry_json_str, course_outcomes_json_str)

    # Format result as JSON for agent consumption
    result_json = json.dumps(result, indent=2)

    return {
        "content": [{
            "type": "text",
            "text": result_json
        }],
        "isError": not result["valid"]
    }


# Create SDK MCP server (in-process, not subprocess)
entry_validation_server = create_sdk_mcp_server(
    name="entry-validator",
    version="1.0.0",
    tools=[validate_sow_entry_tool]
)

# Tool naming convention: mcp__entry-validator__validate_sow_entry


# CLI entry point for standalone testing
if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) > 1:
        file_path = Path(sys.argv[1])

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)

        print(f"Validating SOW entry file: {file_path}")
        print("=" * 60)

        entry_json = file_path.read_text()
        result = validate_sow_entry(entry_json)

        print(json.dumps(result, indent=2))

        sys.exit(0 if result["valid"] else 1)
    else:
        print("Usage:")
        print("  python sow_entry_validator_tool.py <path/to/entry.json>")
        print("")
        print("Note: SDK MCP server is created as 'entry_validation_server'")
        sys.exit(1)
