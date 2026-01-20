"""SDK MCP server for SOW Metadata schema validation using Pydantic models.

This tool validates SOW metadata during iterative SOW authoring.
Metadata provides course-level coherence, accessibility, and engagement notes.

Integration: Claude Agent SDK registers this as mcp__metadata-validator__validate_sow_metadata
"""

import json
import logging
from typing import Dict, Any, List

from pydantic import ValidationError
from claude_agent_sdk import tool, create_sdk_mcp_server

try:
    from .sow_schema_models import Metadata, MetadataCoherence
except ImportError:
    from sow_schema_models import Metadata, MetadataCoherence

logger = logging.getLogger(__name__)


def validate_sow_metadata(metadata_json_str: str) -> Dict[str, Any]:
    """Validate SOW metadata JSON against Pydantic schema.

    Args:
        metadata_json_str: JSON string of SOW metadata

    Returns:
        Dictionary with:
        - valid: bool - Whether metadata passes all validation
        - errors: List[Dict] - Validation errors (max 10, with locations)
        - summary: str - Human-readable summary
        - stats: Dict - Metadata statistics (note counts)
    """
    try:
        # Parse JSON
        try:
            metadata_data = json.loads(metadata_json_str)
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
            validated_metadata = Metadata(**metadata_data)

            # Collect statistics
            stats = _collect_metadata_stats(validated_metadata)

            return {
                "valid": True,
                "errors": [],
                "summary": f"✅ SOW metadata validation passed ({stats['total_notes']} notes)",
                "stats": stats
            }

        except ValidationError as e:
            # Format Pydantic errors into agent-friendly structure
            formatted_errors = _format_validation_errors(e)

            # Limit to 10 errors for concise feedback
            limited_errors = formatted_errors[:10]
            truncated_count = len(formatted_errors) - 10 if len(formatted_errors) > 10 else 0

            summary = f"❌ SOW metadata validation failed with {len(formatted_errors)} errors"
            if truncated_count > 0:
                summary += f" (showing first 10, {truncated_count} more errors hidden)"

            return {
                "valid": False,
                "errors": limited_errors,
                "summary": summary,
                "stats": None
            }

    except Exception as e:
        logger.exception("Unexpected error during metadata validation")
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


def _collect_metadata_stats(metadata: Metadata) -> Dict[str, Any]:
    """Collect statistics about validated SOW metadata."""
    policy_notes_count = len(metadata.coherence.policy_notes)
    sequencing_notes_count = len(metadata.coherence.sequencing_notes)
    accessibility_notes_count = len(metadata.accessibility_notes)
    engagement_notes_count = len(metadata.engagement_notes)

    return {
        "policy_notes_count": policy_notes_count,
        "sequencing_notes_count": sequencing_notes_count,
        "accessibility_notes_count": accessibility_notes_count,
        "engagement_notes_count": engagement_notes_count,
        "total_notes": policy_notes_count + sequencing_notes_count + accessibility_notes_count + engagement_notes_count,
        "weeks": metadata.weeks,
        "periods_per_week": metadata.periods_per_week
    }


# ════════════════════════════════════════════════════════════════════════════
# SDK MCP Server Definition for Claude Agent SDK
# ════════════════════════════════════════════════════════════════════════════

@tool(
    "validate_sow_metadata",
    "Validate SOW metadata JSON for iterative SOW authoring with detailed error reporting",
    {"metadata_json_str": str}
)
async def validate_sow_metadata_tool(args):
    """SDK tool wrapper for SOW metadata schema validation.

    Args:
        args: Dictionary with 'metadata_json_str' key containing complete metadata JSON as string

    Returns:
        SDK tool result with validation details and error status
    """
    metadata_json_str = args["metadata_json_str"]

    # Call existing validation function
    result = validate_sow_metadata(metadata_json_str)

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
metadata_validation_server = create_sdk_mcp_server(
    name="metadata-validator",
    version="1.0.0",
    tools=[validate_sow_metadata_tool]
)

# Tool naming convention: mcp__metadata-validator__validate_sow_metadata


# CLI entry point for standalone testing
if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) > 1:
        file_path = Path(sys.argv[1])

        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            sys.exit(1)

        print(f"Validating SOW metadata file: {file_path}")
        print("=" * 60)

        metadata_json = file_path.read_text()
        result = validate_sow_metadata(metadata_json)

        print(json.dumps(result, indent=2))

        sys.exit(0 if result["valid"] else 1)
    else:
        print("Usage:")
        print("  python sow_metadata_validator_tool.py <path/to/metadata.json>")
        print("")
        print("Note: SDK MCP server is created as 'metadata_validation_server'")
        sys.exit(1)
