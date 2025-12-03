"""JSON Validator MCP Tool.

Provides a generic MCP tool for validating JSON strings.
Enables the diagram generation agent to self-correct JSON errors during generation.

Tool Pattern:
- Following diagram_screenshot_tool.py MCP registration pattern
- Tool name convention: mcp__json-validator__validate_json
- Returns detailed error information to help agent fix issues

Usage:
    Tool name: mcp__json-validator__validate_json
    Args: {
        "json_string": "{ ... }"  # The JSON string to validate
    }

Returns:
    - Valid: {"valid": true}
    - Invalid: {"valid": false, "error": "...", "error_position": N, "error_context": "..."}
"""

import json
import logging
from typing import Dict, Any

from claude_agent_sdk import tool, create_sdk_mcp_server

# Set up logging
logger = logging.getLogger(__name__)


def _get_error_context(json_string: str, position: int, context_chars: int = 40) -> str:
    """Extract context around the error position in the JSON string.

    Args:
        json_string: The full JSON string
        position: Character position where error occurred
        context_chars: Number of characters to show on each side

    Returns:
        String showing the context around the error with a marker
    """
    start = max(0, position - context_chars)
    end = min(len(json_string), position + context_chars)

    before = json_string[start:position]
    after = json_string[position:end]

    # Add ellipsis if truncated
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(json_string) else ""

    return f"{prefix}{before}<<<ERROR>>>{after}{suffix}"


@tool(
    "validate_json",
    "Validate a JSON string and return detailed error information if invalid. Use this to check jsxgraph_json before writing to diagrams_output.json.",
    {
        "json_string": {
            "type": "string",
            "description": "The JSON string to validate",
            "required": True
        }
    }
)
def validate_json(json_string: str) -> Dict[str, Any]:
    """Validate a JSON string and return detailed error information.

    Args:
        json_string: The JSON string to validate

    Returns:
        MCP-formatted response with validation result:
        - Valid: {"valid": true}
        - Invalid: {"valid": false, "error": "...", "error_position": N, "error_context": "..."}
    """
    try:
        # Handle empty or None input
        if not json_string:
            result = {
                "valid": False,
                "error": "Empty or null JSON string provided",
                "error_position": 0,
                "error_context": "(empty string)"
            }
            return {
                "content": [{
                    "type": "text",
                    "text": json.dumps(result, indent=2)
                }]
            }

        # Attempt to parse the JSON
        json.loads(json_string)

        # Success!
        result = {"valid": True}
        logger.debug("JSON validation passed")

        return {
            "content": [{
                "type": "text",
                "text": json.dumps(result, indent=2)
            }]
        }

    except json.JSONDecodeError as e:
        # Extract error details
        error_message = str(e.msg)
        error_position = e.pos
        error_context = _get_error_context(json_string, error_position)

        result = {
            "valid": False,
            "error": error_message,
            "error_position": error_position,
            "error_line": e.lineno,
            "error_column": e.colno,
            "error_context": error_context
        }

        logger.debug(f"JSON validation failed at position {error_position}: {error_message}")

        return {
            "content": [{
                "type": "text",
                "text": json.dumps(result, indent=2)
            }]
        }

    except Exception as e:
        # Unexpected error
        result = {
            "valid": False,
            "error": f"Unexpected validation error: {str(e)}",
            "error_position": None,
            "error_context": None
        }

        logger.error(f"Unexpected error during JSON validation: {e}")

        return {
            "content": [{
                "type": "text",
                "text": json.dumps(result, indent=2)
            }],
            "isError": True
        }


# Create the MCP server
json_validator_server = create_sdk_mcp_server(
    name="json-validator",
    version="1.0.0",
    tools=[validate_json]
)

# Tool naming convention: mcp__json-validator__validate_json
