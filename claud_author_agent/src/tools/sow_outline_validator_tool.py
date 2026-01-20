"""SDK MCP server for LessonOutline schema validation using Pydantic models.

This tool validates lesson outline JSON files during iterative SOW authoring.
The outline is the first artifact generated, establishing lesson sequence before
detailed content creation.

Integration: Claude Agent SDK registers this as mcp__outline-validator__validate_lesson_outline
"""

import json
import logging
from typing import Dict, Any, List

from pydantic import ValidationError
from claude_agent_sdk import tool, create_sdk_mcp_server

try:
    from .sow_schema_models import LessonOutline, LessonOutlineEntry, LessonType
except ImportError:
    from sow_schema_models import LessonOutline, LessonOutlineEntry, LessonType

logger = logging.getLogger(__name__)


def validate_lesson_outline(outline_json_str: str) -> Dict[str, Any]:
    """Validate lesson outline JSON against Pydantic schema.

    Args:
        outline_json_str: JSON string of lesson outline

    Returns:
        Dictionary with:
        - valid: bool - Whether outline passes all validation
        - errors: List[Dict] - Validation errors (max 10, with locations)
        - summary: str - Human-readable summary
        - stats: Dict - Outline statistics (lesson counts by type)
    """
    try:
        # Parse JSON
        try:
            outline_data = json.loads(outline_json_str)
        except json.JSONDecodeError as e:
            return {
                "valid": False,
                "errors": [{
                    "location": "root",
                    "message": f"Invalid JSON: {str(e)}",
                    "value": None,
                    "type": "json_error"
                }],
                "summary": "❌ JSON parsing failed",
                "stats": None
            }

        # Validate with Pydantic
        try:
            validated_outline = LessonOutline(**outline_data)

            # Collect statistics
            stats = _collect_outline_stats(validated_outline)

            return {
                "valid": True,
                "errors": [],
                "summary": f"✅ Lesson outline validation passed ({stats['total_lessons']} lessons)",
                "stats": stats
            }

        except ValidationError as e:
            # Format Pydantic errors into agent-friendly structure
            formatted_errors = _format_validation_errors(e)

            # Limit to 10 errors for concise feedback
            limited_errors = formatted_errors[:10]
            truncated_count = len(formatted_errors) - 10 if len(formatted_errors) > 10 else 0

            summary = f"❌ Lesson outline validation failed with {len(formatted_errors)} errors"
            if truncated_count > 0:
                summary += f" (showing first 10, {truncated_count} more errors hidden)"

            return {
                "valid": False,
                "errors": limited_errors,
                "summary": summary,
                "stats": None
            }

    except Exception as e:
        logger.exception("Unexpected error during outline validation")
        return {
            "valid": False,
            "errors": [{
                "location": "root",
                "message": f"Unexpected validation error: {str(e)}",
                "value": None,
                "type": "internal_error"
            }],
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


def _collect_outline_stats(outline: LessonOutline) -> Dict[str, Any]:
    """Collect statistics about validated lesson outline."""
    lesson_type_counts = {}

    for entry in outline.outlines:
        lesson_type = entry.lesson_type.value
        lesson_type_counts[lesson_type] = lesson_type_counts.get(lesson_type, 0) + 1

    # Get unique blocks
    blocks = list({entry.block_name for entry in outline.outlines})

    return {
        "total_lessons": outline.total_lessons,
        "structure_type": outline.structure_type,
        "lesson_types": lesson_type_counts,
        "blocks": blocks,
        "course_subject": outline.course_subject,
        "course_level": outline.course_level
    }


# ════════════════════════════════════════════════════════════════════════════
# SDK MCP Server Definition for Claude Agent SDK
# ════════════════════════════════════════════════════════════════════════════

@tool(
    "validate_lesson_outline",
    "Validate lesson outline JSON for iterative SOW authoring with detailed error reporting",
    {"outline_json_str": str}
)
async def validate_lesson_outline_tool(args):
    """SDK tool wrapper for lesson outline schema validation.

    Args:
        args: Dictionary with 'outline_json_str' key containing complete outline JSON as string

    Returns:
        SDK tool result with validation details and error status
    """
    outline_json_str = args["outline_json_str"]

    # Call existing validation function
    result = validate_lesson_outline(outline_json_str)

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
outline_validation_server = create_sdk_mcp_server(
    name="outline-validator",
    version="1.0.0",
    tools=[validate_lesson_outline_tool]
)

# Tool naming convention: mcp__outline-validator__validate_lesson_outline


# CLI entry point for standalone testing
if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) > 1:
        file_path = Path(sys.argv[1])

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)

        print(f"Validating lesson outline file: {file_path}")
        print("=" * 60)

        outline_json = file_path.read_text()
        result = validate_lesson_outline(outline_json)

        print(json.dumps(result, indent=2))

        sys.exit(0 if result["valid"] else 1)
    else:
        print("Usage:")
        print("  python sow_outline_validator_tool.py <path/to/outline.json>")
        print("")
        print("Note: SDK MCP server is created as 'outline_validation_server'")
        sys.exit(1)
