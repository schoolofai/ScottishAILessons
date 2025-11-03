"""SDK MCP server for SOW schema validation using Pydantic models.

This tool provides fast, deterministic validation of SOW JSON files using the
Pydantic models defined in sow_schema_models.py. It replaces the verbose schema
markdown file approach, reducing token usage by ~13-16K per execution.

Integration: Claude Agent SDK registers this as mcp__validator__validate_sow_schema
"""

import json
import logging
from typing import Dict, Any, List
from pathlib import Path

from pydantic import ValidationError
from claude_agent_sdk import tool, create_sdk_mcp_server

try:
    from .sow_schema_models import AuthoredSOW
except ImportError:
    from sow_schema_models import AuthoredSOW

logger = logging.getLogger(__name__)


def validate_sow_schema(sow_json_str: str) -> Dict[str, Any]:
    """Validate SOW JSON against Pydantic schema.

    Args:
        sow_json_str: JSON string of authored SOW

    Returns:
        Dictionary with:
        - valid: bool - Whether SOW passes all validation
        - errors: List[Dict] - Validation errors (max 10, with locations)
        - summary: str - Human-readable summary
        - stats: Dict - SOW statistics (entries, cards, types)

    Example error format:
    {
        "location": "entries[0].lesson_plan.card_structure[2].cfu_strategy",
        "message": "CFU strategy is too generic: 'Ask questions'. Must be specific.",
        "value": "Ask questions",
        "type": "value_error"
    }
    """
    try:
        # Parse JSON
        try:
            sow_data = json.loads(sow_json_str)
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
            validated_sow = AuthoredSOW(**sow_data)

            # Collect statistics
            stats = _collect_sow_stats(validated_sow)

            return {
                "valid": True,
                "errors": [],
                "summary": f"✅ SOW validation passed ({stats['total_entries']} entries, {stats['total_cards']} cards)",
                "stats": stats
            }

        except ValidationError as e:
            # Format Pydantic errors into agent-friendly structure
            formatted_errors = _format_validation_errors(e)

            # Limit to 10 errors for concise feedback
            limited_errors = formatted_errors[:10]
            truncated_count = len(formatted_errors) - 10 if len(formatted_errors) > 10 else 0

            summary = f"❌ SOW validation failed with {len(formatted_errors)} errors"
            if truncated_count > 0:
                summary += f" (showing first 10, {truncated_count} more errors hidden)"

            return {
                "valid": False,
                "errors": limited_errors,
                "summary": summary,
                "stats": None
            }

    except Exception as e:
        logger.exception("Unexpected error during SOW validation")
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
    """Convert Pydantic ValidationError into agent-friendly error objects.

    Args:
        validation_error: Pydantic ValidationError with error details

    Returns:
        List of error dictionaries with location, message, value, type
    """
    formatted = []

    for error in validation_error.errors():
        # Build location path from error['loc'] tuple
        # Example: ('entries', 0, 'lesson_plan', 'card_structure', 2, 'cfu_strategy')
        # Becomes: "entries[0].lesson_plan.card_structure[2].cfu_strategy"
        location_parts = []
        for part in error['loc']:
            if isinstance(part, int):
                # Array index
                location_parts[-1] = f"{location_parts[-1]}[{part}]"
            else:
                # Field name
                location_parts.append(str(part))

        location = ".".join(location_parts)

        # Extract error details
        error_type = error.get('type', 'validation_error')
        message = error.get('msg', 'Validation error')

        # Get the actual value that failed (if available in context)
        value = error.get('input', None)

        formatted.append({
            "location": location,
            "message": message,
            "value": value,
            "type": error_type
        })

    return formatted


def _collect_sow_stats(sow: AuthoredSOW) -> Dict[str, Any]:
    """Collect statistics about validated SOW.

    Args:
        sow: Validated AuthoredSOW instance

    Returns:
        Dictionary with counts and breakdowns
    """
    lesson_type_counts = {}
    total_cards = 0
    card_type_counts = {}

    for entry in sow.entries:
        # Count lesson types
        lesson_type = entry.lesson_type.value
        lesson_type_counts[lesson_type] = lesson_type_counts.get(lesson_type, 0) + 1

        # Count cards
        if entry.lesson_plan and entry.lesson_plan.card_structure:
            entry_card_count = len(entry.lesson_plan.card_structure)
            total_cards += entry_card_count

            # Count card types
            for card in entry.lesson_plan.card_structure:
                card_type = card.card_type.value
                card_type_counts[card_type] = card_type_counts.get(card_type, 0) + 1

    return {
        "total_entries": len(sow.entries),
        "total_cards": total_cards,
        "lesson_types": lesson_type_counts,
        "card_types": card_type_counts,
        "course_id": sow.courseId,
        "version": sow.version,
        "status": sow.status
    }


# ════════════════════════════════════════════════════════════════════════════
# SDK MCP Server Definition for Claude Agent SDK
# ════════════════════════════════════════════════════════════════════════════

@tool(
    "validate_sow_schema",
    "Validate SOW JSON against Pydantic schema with detailed error reporting",
    {"sow_json_str": str}
)
async def validate_sow_schema_tool(args):
    """SDK tool wrapper for SOW schema validation.

    This tool validates a Scheme of Work (SOW) JSON file against the Scottish AI
    Lessons Pydantic schema. Returns detailed validation results with error
    locations, messages, and statistics.

    Args:
        args: Dictionary with 'sow_json_str' key containing complete SOW JSON as string

    Returns:
        SDK tool result with validation details and error status
    """
    sow_json_str = args["sow_json_str"]

    # Call existing validation function
    result = validate_sow_schema(sow_json_str)

    # Format result as JSON for agent consumption
    result_json = json.dumps(result, indent=2)

    # Return in SDK tool format
    return {
        "content": [{
            "type": "text",
            "text": result_json
        }],
        "isError": not result["valid"]
    }


# Create SDK MCP server (in-process, not subprocess)
sow_validation_server = create_sdk_mcp_server(
    name="sow-validator",
    version="2.0.0",
    tools=[validate_sow_schema_tool]
)

# Tool naming convention: mcp__sow-validator__validate_sow_schema


# CLI entry point for standalone testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Test mode: validate file from command line
        file_path = Path(sys.argv[1])

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)

        print(f"Validating SOW file: {file_path}")
        print("=" * 60)

        sow_json = file_path.read_text()
        result = validate_sow_schema(sow_json)

        print(json.dumps(result, indent=2))

        sys.exit(0 if result["valid"] else 1)
    else:
        print("Usage:")
        print("  python sow_validator_tool.py <path/to/sow.json>")
        print("")
        print("Note: SDK MCP server is created as 'sow_validation_server'")
        print("      Import and use directly in Claude Agent SDK applications")
        sys.exit(1)
