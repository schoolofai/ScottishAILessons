"""Desmos Function Graphing MCP Tool.

Provides MCP tool interface for rendering mathematical functions using Desmos calculator
via the DiagramScreenshot REST API service.

**Purpose**: Function graphing and algebraic visualization
- Plotting functions: linear (y = mx + c), quadratic (y = ax² + bx + c), trigonometric
- Exploring function transformations (shifts, stretches, reflections)
- Finding roots, intercepts, or intersections visually
- Graphing inequalities and shading regions
- Comparing multiple functions on the same axes
- Gradient and tangent line visualization

**FILE-BASED ARCHITECTURE**: Writes PNG files to workspace and returns file paths
instead of base64 data, enabling efficient token usage and visual critique.

Service Contract:
- Endpoint: POST {base_url}/api/v1/render/desmos/simple
- Request: {expressions, viewport, options}
- Success: {success: true, image: string (base64), metadata: {...}}
- Error: {success: false, error: {code, message, details}}

Tool Pattern:
- Tool name convention: mcp__desmos__render_desmos
- Fast-fail on all errors (HTTP errors, timeouts, validation failures)
- FILE-BASED: Writes PNG to {workspace}/diagrams/ and returns path

Usage:
    Tool name: mcp__desmos__render_desmos
    Args: {
        "expressions": [{"latex": "y=x^2-4x+3", "color": "#2d70b3"}],
        "viewport": {"xmin": -2, "xmax": 6, "ymin": -2, "ymax": 6},
        "card_id": "q3",
        "diagram_context": "question",
        "options": {...}
    }

Returns:
    - Success: {"success": true, "image_path": "/path/diagrams/q3_question.png", "metadata": {...}}
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

# HTTP timeout (30 seconds)
REQUEST_TIMEOUT = 30

# Default render options for Desmos
DEFAULT_RENDER_OPTIONS = {
    "width": 1200,
    "height": 800,
    "format": "png",
    "scale": 2,
    "showGrid": True,
    "showAxes": True
}

# Default viewport for Desmos
DEFAULT_VIEWPORT = {
    "xmin": -10,
    "xmax": 10,
    "ymin": -10,
    "ymax": 10
}


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def _write_diagram_file(
    image_base64: str,
    card_id: str,
    diagram_context: str,
    workspace_path: str,
    diagram_index: int = 0
) -> str:
    """Write diagram PNG file to workspace and return absolute path.

    Args:
        image_base64: Base64-encoded PNG data
        card_id: Card/question identifier (e.g., "q3")
        diagram_context: Context type ("question", "worked_solution", "hint")
        workspace_path: Absolute path to workspace directory
        diagram_index: Index for multiple diagrams per card (0, 1, 2...)

    Returns:
        Absolute path to written PNG file

    Raises:
        Exception: If file write fails (fast-fail, no fallback)
    """
    logger.info(f"📁 Desmos: Writing diagram to workspace: {workspace_path}")

    # Create diagrams directory if it doesn't exist
    diagrams_dir = Path(workspace_path) / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename: {card_id}_{context}_{index}.png (index only if > 0)
    if diagram_index > 0:
        filename = f"{card_id}_{diagram_context}_{diagram_index}.png"
    else:
        filename = f"{card_id}_{diagram_context}.png"
    file_path = diagrams_dir / filename

    # Decode base64 and write PNG bytes
    png_bytes = base64.b64decode(image_base64)
    file_path.write_bytes(png_bytes)

    logger.info(f"✅ Desmos: Wrote diagram file: {file_path} ({len(png_bytes)} bytes)")

    return str(file_path.absolute())


def _build_error_response(
    code: str,
    message: str,
    details: Optional[Any] = None,
    suggestion: Optional[str] = None
) -> Dict[str, Any]:
    """Build standardized error response for MCP protocol.

    Args:
        code: Machine-readable error code (e.g., "TIMEOUT_ERROR")
        message: Human-readable error message
        details: Additional diagnostic information
        suggestion: Suggested fix for the error

    Returns:
        dict: Error response with isError: True flag
    """
    error_obj = {
        "code": code,
        "message": message
    }

    if details is not None:
        error_obj["details"] = details
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

def create_desmos_server(workspace_path: str, api_base_url: str, api_key: str = None):
    """Create Desmos MCP server with workspace path and API config captured in closure.

    This factory function creates a render_desmos tool for function graphing
    that has access to configuration through closure.

    Args:
        workspace_path: Absolute path to workspace directory where diagrams will be written
        api_base_url: Base URL for DiagramScreenshot service (e.g., "http://localhost:3001")
        api_key: API key for DiagramScreenshot service (optional)

    Returns:
        MCP server instance with render_desmos tool configured

    Example:
        server = create_desmos_server("/workspace", "http://localhost:3001", "api-key")
    """

    @tool(
        "render_desmos",
        "Render mathematical function graph using Desmos calculator. Best for: y=f(x) functions, quadratics, trigonometry, inequalities, function transformations. Returns PNG file path.",
        {
            "expressions": {
                "type": "array",
                "description": "Array of Desmos expressions. Each: {latex: 'y=x^2', color: '#2d70b3', lineStyle: 'SOLID', lineWidth: 2, hidden: false}",
                "required": True
            },
            "viewport": {
                "type": "object",
                "description": "Graph viewport: {xmin, xmax, ymin, ymax}. Default: -10 to 10 on both axes.",
                "required": False
            },
            "card_id": {
                "type": "string",
                "description": "Card/question identifier for filename (e.g., 'q3')",
                "required": True
            },
            "diagram_context": {
                "type": "string",
                "description": "Context: 'question', 'worked_solution', 'hint', or 'misconception'",
                "required": True
            },
            "diagram_index": {
                "type": "integer",
                "description": "Index for multiple diagrams per card (0 for first/only, 1+ for additional)",
                "required": False
            },
            "options": {
                "type": "object",
                "description": "Render options: {width, height, showGrid, showAxes, degreeMode}",
                "required": False
            }
        }
    )
    async def render_desmos(args):
        """Render function graph using Desmos calculator via HTTP service.

        **DESMOS STRENGTHS**:
        - Clean, familiar interface students recognize
        - Excellent for y = f(x) style expressions
        - Handles implicit equations well
        - Great for "what happens when we change a/b/c" explorations

        **Example expressions**:
        - Linear: {"latex": "y=2x+1", "color": "#2d70b3"}
        - Quadratic: {"latex": "y=x^2-4x+3", "color": "#c74440"}
        - Roots: {"latex": "(1,0)", "color": "#000000", "pointStyle": "POINT"}
        - Inequality: {"latex": "y>2x-1", "color": "#388c46"}

        Process:
        1. Send expressions JSON to DiagramScreenshot Desmos endpoint
        2. Receive base64-encoded PNG
        3. Write PNG to {workspace}/diagrams/{card_id}_{context}.png
        4. Return absolute file path

        Args:
            args: Dictionary with expressions, viewport, card_id, diagram_context, options

        Returns:
            Success: {success: true, image_path: "...", metadata: {...}}
            Failure: {success: false, error: {...}, isError: true}
        """
        try:
            # Extract arguments
            expressions = args.get("expressions")
            viewport = args.get("viewport", {})
            card_id = args.get("card_id")
            diagram_context = args.get("diagram_context")
            diagram_index = args.get("diagram_index", 0)
            options = args.get("options", {})

            # Parse JSON strings to objects (SDK may pass as strings)
            if isinstance(expressions, str):
                try:
                    expressions = json.loads(expressions)
                    logger.info("🔧 Desmos: Parsed expressions from JSON string")
                except json.JSONDecodeError as e:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Field 'expressions' is not valid JSON: {str(e)}",
                        suggestion="Ensure expressions is a valid JSON array"
                    )

            if isinstance(viewport, str):
                try:
                    viewport = json.loads(viewport)
                except json.JSONDecodeError:
                    viewport = {}

            if isinstance(options, str):
                try:
                    options = json.loads(options)
                except json.JSONDecodeError:
                    options = {}

            if isinstance(diagram_index, str):
                try:
                    diagram_index = int(diagram_index)
                except ValueError:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Field 'diagram_index' must be an integer, received: '{diagram_index}'",
                        suggestion="Ensure diagram_index is 0, 1, 2, etc."
                    )

            # Validate required fields
            if not expressions:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'expressions' not provided",
                    suggestion="Provide array of expressions: [{latex: 'y=x^2', color: '#2d70b3'}]"
                )

            if not isinstance(expressions, list):
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Field 'expressions' must be an array",
                    details={"received_type": type(expressions).__name__},
                    suggestion="Provide expressions as array: [{latex: '...', color: '...'}]"
                )

            if not card_id:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'card_id' not provided",
                    suggestion="Provide card_id for filename (e.g., 'q3')"
                )

            if not diagram_context:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'diagram_context' not provided",
                    suggestion="Provide diagram_context: 'question', 'worked_solution', 'hint', or 'misconception'"
                )

            valid_contexts = ["question", "worked_solution", "hint", "misconception", "lesson", "cfu"]
            if diagram_context not in valid_contexts:
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message=f"Invalid diagram_context: '{diagram_context}'",
                    suggestion=f"Use one of: {', '.join(valid_contexts)}"
                )

            # Validate expressions structure
            for i, expr in enumerate(expressions):
                if not isinstance(expr, dict):
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Expression at index {i} must be an object",
                        suggestion="Each expression should be: {latex: '...', color: '...'}"
                    )
                if "latex" not in expr:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Expression at index {i} missing 'latex' field",
                        suggestion="Each expression requires 'latex' field with math expression"
                    )

            logger.info(f"🔧 Desmos render_desmos called: card_id={card_id}, context={diagram_context}")
            logger.info(f"🔧 Desmos expressions count: {len(expressions)}")

            # Merge with defaults
            render_viewport = {**DEFAULT_VIEWPORT, **viewport}
            render_options = {**DEFAULT_RENDER_OPTIONS, **options}

            # Build request payload for Desmos simple endpoint
            payload = {
                "expressions": expressions,
                "viewport": render_viewport,
                "options": render_options
            }

            # Make HTTP POST request to DiagramScreenshot Desmos endpoint
            render_url = f"{api_base_url}/api/v1/render/desmos/simple"

            try:
                headers = {
                    "Content-Type": "application/json"
                }
                if api_key:
                    headers["X-API-Key"] = api_key

                logger.info(f"🔧 Desmos: POST to {render_url}")

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

                # Handle HTTP error status codes (4xx/5xx) - FAST FAIL
                if response.status_code >= 400:
                    if isinstance(response_data, dict) and "error" in response_data:
                        error_data = response_data["error"]
                        return _build_error_response(
                            code=error_data.get("code", "HTTP_ERROR"),
                            message=error_data.get("message", f"HTTP {response.status_code} error"),
                            details=error_data.get("details"),
                            suggestion=error_data.get("suggestion")
                        )
                    else:
                        return _build_error_response(
                            code="HTTP_ERROR",
                            message=f"HTTP {response.status_code}: {response.reason}",
                            details={"response_body": response.text[:500]},
                            suggestion="Check Desmos expression syntax"
                        )

                # Validate success response
                if not isinstance(response_data, dict) or not response_data.get("success"):
                    return _build_error_response(
                        code="INVALID_RESPONSE",
                        message="DiagramScreenshot returned unexpected response format",
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

                # Success! Write PNG file to workspace
                image_base64 = response_data["image"]
                image_path = _write_diagram_file(
                    image_base64, card_id, diagram_context, workspace_path, diagram_index
                )

                logger.info(f"✅ Desmos: Diagram rendered successfully: {image_path}")

                result = {
                    "success": True,
                    "image_path": image_path,
                    "tool_used": "DESMOS",
                    "metadata": response_data.get("metadata", {})
                }

                return {
                    "content": [{
                        "type": "text",
                        "text": json.dumps(result, indent=2)
                    }]
                }

            except Timeout:
                return _build_error_response(
                    code="TIMEOUT_ERROR",
                    message=f"DiagramScreenshot service did not respond within {REQUEST_TIMEOUT} seconds",
                    details={"timeout_seconds": REQUEST_TIMEOUT, "url": render_url},
                    suggestion="Check if service is overloaded or expressions are too complex"
                )

            except RequestException as e:
                return _build_error_response(
                    code="SERVICE_UNREACHABLE",
                    message=f"Failed to connect to DiagramScreenshot service: {str(e)}",
                    details={"url": render_url, "exception_type": type(e).__name__},
                    suggestion=f"Ensure DiagramScreenshot service is running at {api_base_url}"
                )

        except Exception as e:
            logger.error(f"Desmos render_desmos unexpected error: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error in render_desmos tool: {str(e)}",
                details={"exception_type": type(e).__name__},
                suggestion="Check tool implementation and logs"
            )

    # Return MCP server with the configured tool
    return create_sdk_mcp_server(
        name="desmos",
        version="1.0.0",
        tools=[render_desmos]
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server Entry Point
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    """Run Desmos MCP server when invoked via python -m."""
    import asyncio
    import os

    workspace_path = os.environ.get("WORKSPACE_PATH")
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:8080")
    api_key = os.environ.get("API_KEY", "")

    if not workspace_path:
        raise RuntimeError("WORKSPACE_PATH environment variable is required")

    logger.info(f"🚀 Starting Desmos MCP server - workspace: {workspace_path}")

    server = create_desmos_server(
        workspace_path=workspace_path,
        api_base_url=api_base_url,
        api_key=api_key
    )
    asyncio.run(server.run())
