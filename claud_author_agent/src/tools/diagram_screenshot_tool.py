"""DiagramScreenshot Service MCP Tool.

Provides MCP tool interface for rendering JSXGraph diagrams to PNG images via HTTP service.
Follows fast-fail principle with detailed error logging and no fallback mechanisms.

**FILE-BASED ARCHITECTURE**: This tool writes PNG files to workspace and returns file paths
instead of base64 data, enabling efficient token usage and true visual critique.

Service Contract:
- Endpoint: POST http://localhost:3001/api/v1/render
- Request: {diagram: JSXGraphDiagram, options?: RenderOptions}
- Success: {success: true, image: string (base64), metadata: {...}}
- Error: {success: false, error: {code, message, details, renderTimeMs?, consoleErrors?, suggestion?}}

Tool Pattern:
- Following json_validator_tool.py MCP registration pattern
- Tool name convention: mcp__diagram-screenshot__render_diagram
- Fast-fail on all errors (HTTP errors, timeouts, validation failures)
- FILE-BASED: Writes PNG to {workspace}/diagrams/ and returns path

Usage:
    Tool name: mcp__diagram-screenshot__render_diagram
    Args: {
        "diagram": {...},      # JSXGraph diagram JSON
        "card_id": "card_001", # Card identifier for filename
        "diagram_context": "lesson",  # Context: "lesson" or "cfu"
        "options": {...}       # Optional: width, height, format, scale, backgroundColor
    }

Returns:
    - Success: {"success": true, "image_path": "/workspace/diagrams/card_001_lesson.png", "metadata": {...}}
    - Failure: {"success": false, "error": {...}} with isError: True
"""

import base64
import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
import requests
from requests.exceptions import RequestException, Timeout

from claude_agent_sdk import tool, create_sdk_mcp_server

# Set up logging
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Configuration Constants
# ═══════════════════════════════════════════════════════════════

# DiagramScreenshot service URL (from environment or default)
DIAGRAM_SCREENSHOT_URL = os.getenv(
    "DIAGRAM_SCREENSHOT_URL",
    "http://localhost:3001"
)

# DiagramScreenshot API key (from environment or default dev key)
DIAGRAM_SCREENSHOT_API_KEY = os.getenv(
    "DIAGRAM_SCREENSHOT_API_KEY",
    "dev-api-key-change-in-production"
)

# HTTP timeout (30 seconds as per FR-040)
REQUEST_TIMEOUT = 30

# Default render options
DEFAULT_RENDER_OPTIONS = {
    "width": 1200,
    "height": 800,
    "format": "png",
    "scale": 2,
    "backgroundColor": "#ffffff"
}


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def write_diagram_file(
    image_base64: str,
    card_id: str,
    diagram_context: str,
    workspace_path: str
) -> str:
    """Write diagram PNG file to workspace and return absolute path.

    Args:
        image_base64: Base64-encoded PNG data
        card_id: Card identifier (e.g., "card_001")
        diagram_context: Context type ("lesson" or "cfu")
        workspace_path: Absolute path to workspace directory

    Returns:
        Absolute path to written PNG file

    Raises:
        Exception: If file write fails
    """
    try:
        logger.info(f"📁 Using workspace path: {workspace_path}")

        # Create diagrams directory if it doesn't exist
        diagrams_dir = Path(workspace_path) / "diagrams"
        diagrams_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename: card_{id}_{context}.png
        filename = f"{card_id}_{diagram_context}.png"
        file_path = diagrams_dir / filename

        # Decode base64 and write PNG bytes
        png_bytes = base64.b64decode(image_base64)
        file_path.write_bytes(png_bytes)

        logger.info(f"✅ Wrote diagram file: {file_path} ({len(png_bytes)} bytes)")

        return str(file_path.absolute())

    except Exception as e:
        logger.error(f"Failed to write diagram file: {e}")
        raise


def check_diagram_service_health() -> Dict[str, Any]:
    """Check if DiagramScreenshot service is available.

    Returns:
        dict: {"available": bool, "url": str, "error": str (if unavailable)}

    Raises:
        Exception: Never raises - returns error dict instead for health checks
    """
    try:
        health_url = f"{DIAGRAM_SCREENSHOT_URL}/health"
        response = requests.get(health_url, timeout=5)

        if response.status_code == 200:
            return {
                "available": True,
                "url": DIAGRAM_SCREENSHOT_URL,
                "status_code": response.status_code
            }
        else:
            return {
                "available": False,
                "url": DIAGRAM_SCREENSHOT_URL,
                "error": f"Health check returned status {response.status_code}"
            }
    except RequestException as e:
        return {
            "available": False,
            "url": DIAGRAM_SCREENSHOT_URL,
            "error": f"Health check failed: {str(e)}"
        }


def _build_error_response(
    code: str,
    message: str,
    details: Optional[Any] = None,
    render_time_ms: Optional[int] = None,
    console_errors: Optional[list] = None,
    suggestion: Optional[str] = None
) -> Dict[str, Any]:
    """Build standardized error response matching DiagramScreenshot service format.

    Args:
        code: Machine-readable error code (e.g., "TIMEOUT_ERROR")
        message: Human-readable error message
        details: Additional diagnostic information
        render_time_ms: Time spent before error occurred
        console_errors: Browser console errors if available
        suggestion: Suggested fix for the error

    Returns:
        dict: Error response with isError: True flag for MCP protocol
    """
    error_obj = {
        "code": code,
        "message": message
    }

    if details is not None:
        error_obj["details"] = details
    if render_time_ms is not None:
        error_obj["renderTimeMs"] = render_time_ms
    if console_errors:
        error_obj["consoleErrors"] = console_errors
    if suggestion:
        error_obj["suggestion"] = suggestion

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "success": False,
                "error": error_obj
            }, indent=2)
        }],
        "isError": True
    }


# ═══════════════════════════════════════════════════════════════
# MCP Tool Implementation Factory
# ═══════════════════════════════════════════════════════════════

def create_diagram_screenshot_server_with_workspace(workspace_path: str):
    """Create diagram-screenshot MCP server with workspace path captured in closure.

    This factory function creates a render_diagram tool that has access to the
    workspace_path through closure, avoiding environment variable dependency.

    Args:
        workspace_path: Absolute path to workspace directory where diagrams will be written

    Returns:
        MCP server instance with render_diagram tool configured for the workspace
    """

    @tool(
        "render_diagram",
        "Render JSXGraph diagram to PNG file in workspace. Returns file path for visual critique. Writes to {workspace}/diagrams/card_{id}_{context}.png (overwrites on iteration). No fallback on errors.",
        {
            "diagram": {
                "type": "object",
                "description": "JSXGraph diagram specification with 'board' and 'elements' fields",
                "required": True
            },
            "card_id": {
                "type": "string",
                "description": "Card identifier for filename (e.g., 'card_001')",
                "required": True
            },
            "diagram_context": {
                "type": "string",
                "description": "Context type: 'lesson' (teaching) or 'cfu' (assessment)",
                "required": True
            },
            "options": {
                "type": "object",
                "description": "Optional rendering options (width, height, format, scale, backgroundColor)",
                "required": False
            }
        }
    )
    async def render_diagram(args):
        """Render JSXGraph diagram to PNG file via HTTP service.

        **FILE-BASED ARCHITECTURE**: This tool writes PNG files to workspace instead
        of returning base64, reducing token usage by 99.75% and enabling true visual critique.

        Process:
        1. Send diagram JSON to DiagramScreenshot service
        2. Receive base64-encoded PNG
        3. Write PNG to {workspace}/diagrams/{card_id}_{diagram_context}.png
        4. Return absolute file path (overwrites on iteration)

        Follows fast-fail principle:
        - Throws exception on HTTP 4xx/5xx errors (FR-039)
        - Throws exception on 30-second timeout (FR-040)
        - No fallback mechanisms or silent failures

        Args:
            args: Dictionary with keys:
                - diagram (dict): JSXGraph diagram JSON with board and elements
                - card_id (str): Card identifier for filename (e.g., "card_001")
                - diagram_context (str): Context type ("lesson" or "cfu")
                - options (dict, optional): Rendering options (width, height, format, etc.)

        Returns:
            Tool response:
            - Success: {
                "content": [{
                    "type": "text",
                    "text": JSON string with {
                        "success": true,
                        "image_path": "/absolute/path/to/diagrams/card_001_lesson.png",
                        "metadata": {
                            "format": "png",
                            "width": 1200,
                            "height": 800,
                            "sizeBytes": 45678,
                            "renderTimeMs": 450,
                            "elementCount": 4,
                            "timestamp": "2025-01-10T12:34:56.789Z"
                        }
                    }
                }]
            }
            - Failure: Error response with isError: True

        Raises:
            Never raises Python exceptions - returns error tool responses instead.
            Errors are logged but communicated via MCP error protocol.
        """
        try:
            # Extract arguments
            diagram = args.get("diagram")
            card_id = args.get("card_id")
            diagram_context = args.get("diagram_context")
            options = args.get("options", {})

            # Parse JSON strings to objects (needed when called via Claude Agent SDK XML interface)
            # The SDK passes parameters as strings even when schema says "type": "object"
            if isinstance(diagram, str):
                try:
                    diagram = json.loads(diagram)
                    logger.info("🔧 Parsed diagram from JSON string to dict")
                except json.JSONDecodeError as e:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Field 'diagram' is a string but not valid JSON: {str(e)}",
                        suggestion="Ensure diagram parameter contains valid JSON"
                    )

            if isinstance(options, str):
                try:
                    options = json.loads(options)
                    logger.info("🔧 Parsed options from JSON string to dict")
                except json.JSONDecodeError as e:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Field 'options' is a string but not valid JSON: {str(e)}",
                        suggestion="Ensure options parameter contains valid JSON"
                    )

            # Validate required fields
            if not card_id:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'card_id' not provided",
                    suggestion="Provide card_id for filename generation (e.g., 'card_001')"
                )

            if not diagram_context:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'diagram_context' not provided",
                    suggestion="Provide diagram_context: 'lesson' or 'cfu'"
                )

            if diagram_context not in ["lesson", "cfu"]:
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message=f"Invalid diagram_context: '{diagram_context}'. Must be 'lesson' or 'cfu'",
                    suggestion="Set diagram_context to either 'lesson' or 'cfu'"
                )

            # Log tool invocation for debugging
            logger.info(f"🔧 render_diagram tool called (FILE-BASED)")
            logger.info(f"🔧 card_id={card_id}, diagram_context={diagram_context}")
            logger.info(f"🔧 Parameter types: diagram={type(diagram).__name__}, options={type(options).__name__}")
            if diagram and isinstance(diagram, dict):
                logger.info(f"🔧 Diagram keys: {list(diagram.keys())}")
                logger.info(f"🔧 Diagram has 'board': {('board' in diagram)}, has 'elements': {('elements' in diagram)}")
            else:
                logger.warning(f"🔧 Diagram is not a dict! Received type: {type(diagram).__name__}, value preview: {str(diagram)[:100]}")

            # Validate required diagram field
            if not diagram:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'diagram' not provided",
                    suggestion="Provide diagram JSON with 'board' and 'elements' fields"
                )

            # Validate diagram structure (basic)
            if not isinstance(diagram, dict):
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Field 'diagram' must be a JSON object",
                    details={"received_type": type(diagram).__name__},
                    suggestion="Ensure diagram is a dictionary with 'board' and 'elements'"
                )

            if "board" not in diagram:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Diagram missing required field 'board'",
                    suggestion="Add 'board' field with boundingbox configuration"
                )

            if "elements" not in diagram:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Diagram missing required field 'elements'",
                    suggestion="Add 'elements' array with JSXGraph element definitions"
                )

            # Merge with default render options
            render_options = {**DEFAULT_RENDER_OPTIONS, **options}

            # Build request payload
            payload = {
                "diagram": diagram,
                "options": render_options
            }

            # Make HTTP POST request to DiagramScreenshot service
            render_url = f"{DIAGRAM_SCREENSHOT_URL}/api/v1/render"

            try:
                headers = {
                    "Content-Type": "application/json",
                    "X-API-Key": DIAGRAM_SCREENSHOT_API_KEY
                }
                response = requests.post(
                    render_url,
                    json=payload,
                    timeout=REQUEST_TIMEOUT,
                    headers=headers
                )

                # Parse response JSON
                try:
                    response_data = response.json()
                except json.JSONDecodeError as e:
                    return _build_error_response(
                        code="INVALID_RESPONSE",
                        message="DiagramScreenshot service returned invalid JSON",
                        details={"raw_response": response.text[:500], "parse_error": str(e)},
                        suggestion="Check if DiagramScreenshot service is running correctly"
                    )

                # Handle HTTP error status codes (4xx/5xx)
                if response.status_code >= 400:
                    # Extract error details from service response (FR-039)
                    if isinstance(response_data, dict) and "error" in response_data:
                        error_data = response_data["error"]
                        return _build_error_response(
                            code=error_data.get("code", "HTTP_ERROR"),
                            message=error_data.get("message", f"HTTP {response.status_code} error"),
                            details=error_data.get("details"),
                            render_time_ms=error_data.get("renderTimeMs"),
                            console_errors=error_data.get("consoleErrors"),
                            suggestion=error_data.get("suggestion")
                        )
                    else:
                        return _build_error_response(
                            code="HTTP_ERROR",
                            message=f"HTTP {response.status_code}: {response.reason}",
                            details={"response_body": response.text[:500]},
                            suggestion="Check diagram JSON syntax and DiagramScreenshot service logs"
                        )

                # Validate success response structure
                if not isinstance(response_data, dict) or not response_data.get("success"):
                    return _build_error_response(
                        code="INVALID_RESPONSE",
                        message="DiagramScreenshot service returned unexpected response format",
                        details={"response": response_data},
                        suggestion="Check service compatibility"
                    )

                if "image" not in response_data:
                    return _build_error_response(
                        code="MISSING_FIELD",
                        message="Success response missing 'image' field",
                        details={"response_keys": list(response_data.keys())},
                        suggestion="Check DiagramScreenshot service implementation"
                    )

                # Success! Write PNG file to workspace and return path
                try:
                    image_base64 = response_data["image"]
                    image_path = write_diagram_file(image_base64, card_id, diagram_context, workspace_path)

                    logger.info(f"✅ Diagram rendered successfully: {image_path}")

                    # Build response with file path instead of base64
                    result = {
                        "success": True,
                        "image_path": image_path,
                        "metadata": response_data.get("metadata", {})
                    }

                    return {
                        "content": [{
                            "type": "text",
                            "text": json.dumps(result, indent=2)
                        }]
                    }

                except Exception as write_error:
                    return _build_error_response(
                        code="FILE_WRITE_ERROR",
                        message=f"Failed to write diagram file: {str(write_error)}",
                        details={"card_id": card_id, "diagram_context": diagram_context},
                        suggestion="Check workspace permissions and disk space"
                    )

            except Timeout:
                # FR-040: Throw exception on timeout (no retry, no fallback)
                return _build_error_response(
                    code="TIMEOUT_ERROR",
                    message=f"DiagramScreenshot service did not respond within {REQUEST_TIMEOUT} seconds",
                    details={"timeout_seconds": REQUEST_TIMEOUT, "url": render_url},
                    suggestion="Check if service is overloaded or diagram is too complex"
                )

            except RequestException as e:
                # FR-040: Service unreachable
                return _build_error_response(
                    code="SERVICE_UNREACHABLE",
                    message=f"Failed to connect to DiagramScreenshot service: {str(e)}",
                    details={"url": render_url, "exception_type": type(e).__name__},
                    suggestion=f"Ensure DiagramScreenshot service is running at {DIAGRAM_SCREENSHOT_URL}"
                )

        except Exception as e:
            # Catch-all for unexpected errors (fast-fail with detailed logging)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error in render_diagram tool: {str(e)}",
                details={"exception_type": type(e).__name__},
                suggestion="Check tool implementation and logs"
            )

    # Return MCP server with the configured tool
    return create_sdk_mcp_server(
        name="diagram-screenshot",
        version="1.0.0",
        tools=[render_diagram]
    )


# ═══════════════════════════════════════════════════════════════
# Default MCP Server (for backward compatibility and tests)
# ═══════════════════════════════════════════════════════════════

# Create default server using current working directory
# Production code should use create_diagram_screenshot_server_with_workspace(workspace_path)
diagram_screenshot_server = create_diagram_screenshot_server_with_workspace(str(Path.cwd()))

# Tool naming convention: mcp__diagram-screenshot__render_diagram
