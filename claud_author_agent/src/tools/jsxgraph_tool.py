"""JSXGraph Coordinate Geometry MCP Tool.

Provides MCP tool interface for rendering coordinate geometry and transformations
using JSXGraph via the DiagramScreenshot REST API service.

**Purpose**: Coordinate geometry and transformations
- Coordinate geometry: midpoints, distances, gradients between points
- Geometric transformations on coordinate plane:
  - Reflections (in x-axis, y-axis, y = x, y = -x, or other lines)
  - Rotations about a point (90, 180, 270 degrees)
  - Translations by a vector
  - Enlargements from a center with scale factor
- Vectors: representing, adding, or scaling vectors visually
- Straight line geometry: finding equations, parallel/perpendicular lines
- Plotting shapes on coordinate grids with labeled vertices
- Loci problems on coordinate plane

**FILE-BASED ARCHITECTURE**: Writes PNG files to workspace and returns file paths
instead of base64 data, enabling efficient token usage and visual critique.

Service Contract:
- Endpoint: POST {base_url}/api/v1/render
- Request: {diagram: {board, elements}, options}
- Success: {success: true, image: string (base64), metadata: {...}}
- Error: {success: false, error: {code, message, details}}

Tool Pattern:
- Tool name convention: mcp__jsxgraph__render_jsxgraph
- Fast-fail on all errors (HTTP errors, timeouts, validation failures)
- FILE-BASED: Writes PNG to {workspace}/diagrams/ and returns path

Usage:
    Tool name: mcp__jsxgraph__render_jsxgraph
    Args: {
        "diagram": {
            "board": {"boundingbox": [-5, 5, 5, -5], "axis": true},
            "elements": [
                {"type": "point", "coords": [1, 2], "attributes": {"name": "A"}}
            ]
        },
        "card_id": "q4",
        "diagram_context": "question"
    }

Returns:
    - Success: {"success": true, "image_path": "/path/diagrams/q4_question.png", "metadata": {...}}
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

# Default render options for JSXGraph
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

def _write_diagram_file(
    image_base64: str,
    card_id: str,
    diagram_context: str,
    workspace_path: str,
    diagram_index: int = 0
) -> str:
    """Write diagram PNG file to workspace and return absolute path."""
    logger.info(f"📁 JSXGraph: Writing diagram to workspace: {workspace_path}")

    diagrams_dir = Path(workspace_path) / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    if diagram_index > 0:
        filename = f"{card_id}_{diagram_context}_{diagram_index}.png"
    else:
        filename = f"{card_id}_{diagram_context}.png"
    file_path = diagrams_dir / filename

    png_bytes = base64.b64decode(image_base64)
    file_path.write_bytes(png_bytes)

    logger.info(f"✅ JSXGraph: Wrote diagram file: {file_path} ({len(png_bytes)} bytes)")

    return str(file_path.absolute())


def _build_error_response(
    code: str,
    message: str,
    details: Optional[Any] = None,
    suggestion: Optional[str] = None
) -> Dict[str, Any]:
    """Build standardized error response for MCP protocol."""
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

def create_jsxgraph_server(workspace_path: str, api_base_url: str, api_key: str = None):
    """Create JSXGraph MCP server with workspace path and API config captured in closure.

    This factory function creates a render_jsxgraph tool for coordinate geometry
    that has access to configuration through closure.

    Args:
        workspace_path: Absolute path to workspace directory where diagrams will be written
        api_base_url: Base URL for DiagramScreenshot service (e.g., "http://localhost:3001")
        api_key: API key for DiagramScreenshot service (optional)

    Returns:
        MCP server instance with render_jsxgraph tool configured

    Example:
        server = create_jsxgraph_server("/workspace", "http://localhost:3001", "api-key")
    """

    @tool(
        "render_jsxgraph",
        "Render coordinate geometry using JSXGraph. Best for: transformations, vectors, coordinate points, line equations, reflections, rotations, translations, enlargements. Returns PNG file path.",
        {
            "diagram": {
                "type": "object",
                "description": "JSXGraph diagram with 'board' (boundingbox, axis) and 'elements' array (points, lines, polygons, vectors)",
                "required": True
            },
            "card_id": {
                "type": "string",
                "description": "Card/question identifier for filename (e.g., 'q4')",
                "required": True
            },
            "diagram_context": {
                "type": "string",
                "description": "Context: 'question', 'worked_solution', 'hint', or 'misconception'",
                "required": True
            },
            "diagram_index": {
                "type": "integer",
                "description": "Index for multiple diagrams per card (0 for first/only)",
                "required": False
            },
            "options": {
                "type": "object",
                "description": "Render options: {width, height, scale, backgroundColor}",
                "required": False
            }
        }
    )
    async def render_jsxgraph(args):
        """Render coordinate geometry using JSXGraph via HTTP service.

        **JSXGRAPH STRENGTHS**:
        - Clean coordinate grid rendering
        - Good for transformation before/after comparisons
        - Vector arrow notation
        - Precise coordinate labeling

        **Example diagram structure**:
        {
            "board": {
                "boundingbox": [-5, 5, 5, -5],  # [xmin, ymax, xmax, ymin]
                "axis": true,
                "grid": true
            },
            "elements": [
                {"type": "point", "coords": [1, 2], "attributes": {"name": "A", "color": "blue"}},
                {"type": "point", "coords": [4, 2], "attributes": {"name": "B", "color": "blue"}},
                {"type": "line", "points": ["A", "B"], "attributes": {"strokeColor": "red"}},
                {"type": "polygon", "vertices": [[1,1], [3,1], [2,3]], "attributes": {"fillColor": "yellow"}},
                {"type": "arrow", "points": [[0,0], [2,3]], "attributes": {"strokeColor": "green"}}
            ]
        }

        Process:
        1. Send JSXGraph diagram JSON to DiagramScreenshot service
        2. Receive base64-encoded PNG
        3. Write PNG to {workspace}/diagrams/{card_id}_{context}.png
        4. Return absolute file path

        Args:
            args: Dictionary with diagram, card_id, diagram_context, options

        Returns:
            Success: {success: true, image_path: "...", metadata: {...}}
            Failure: {success: false, error: {...}, isError: true}
        """
        try:
            # Extract arguments
            diagram = args.get("diagram")
            card_id = args.get("card_id")
            diagram_context = args.get("diagram_context")
            diagram_index = args.get("diagram_index", 0)
            options = args.get("options", {})

            # Parse JSON strings to objects (SDK may pass as strings)
            if isinstance(diagram, str):
                try:
                    diagram = json.loads(diagram)
                    logger.info("🔧 JSXGraph: Parsed diagram from JSON string")
                except json.JSONDecodeError as e:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message=f"Field 'diagram' is not valid JSON: {str(e)}",
                        suggestion="Ensure diagram is a valid JSON object with 'board' and 'elements'"
                    )

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
                        message=f"Field 'diagram_index' must be an integer",
                        suggestion="Ensure diagram_index is 0, 1, 2, etc."
                    )

            # Validate required fields
            if not diagram:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'diagram' not provided",
                    suggestion="Provide JSXGraph diagram with 'board' and 'elements'"
                )

            if not isinstance(diagram, dict):
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Field 'diagram' must be an object",
                    details={"received_type": type(diagram).__name__},
                    suggestion="Provide diagram as {board: {...}, elements: [...]}"
                )

            if "board" not in diagram:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Diagram missing required field 'board'",
                    suggestion="Add 'board' with boundingbox configuration"
                )

            if "elements" not in diagram:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Diagram missing required field 'elements'",
                    suggestion="Add 'elements' array with JSXGraph element definitions"
                )

            if not card_id:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'card_id' not provided",
                    suggestion="Provide card_id for filename (e.g., 'q4')"
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

            logger.info(f"🔧 JSXGraph render_jsxgraph called: card_id={card_id}, context={diagram_context}")
            logger.info(f"🔧 JSXGraph elements count: {len(diagram.get('elements', []))}")

            # Merge with defaults
            render_options = {**DEFAULT_RENDER_OPTIONS, **options}

            # Build request payload
            payload = {
                "diagram": diagram,
                "options": render_options
            }

            # Make HTTP POST request (JSXGraph uses the legacy /render endpoint)
            render_url = f"{api_base_url}/api/v1/render"

            try:
                headers = {"Content-Type": "application/json"}
                if api_key:
                    headers["X-API-Key"] = api_key

                logger.info(f"🔧 JSXGraph: POST to {render_url}")

                response = requests.post(
                    render_url,
                    json=payload,
                    timeout=REQUEST_TIMEOUT,
                    headers=headers
                )

                # Parse response
                try:
                    response_data = response.json()
                except json.JSONDecodeError as e:
                    return _build_error_response(
                        code="INVALID_RESPONSE",
                        message="DiagramScreenshot service returned invalid JSON",
                        details={"raw_response": response.text[:500], "parse_error": str(e)},
                        suggestion="Check if DiagramScreenshot service is running correctly"
                    )

                # Handle HTTP errors - FAST FAIL
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
                            suggestion="Check JSXGraph diagram syntax"
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
                        suggestion="Check DiagramScreenshot service implementation"
                    )

                # Success! Write PNG file
                image_base64 = response_data["image"]
                image_path = _write_diagram_file(
                    image_base64, card_id, diagram_context, workspace_path, diagram_index
                )

                logger.info(f"✅ JSXGraph: Diagram rendered successfully: {image_path}")

                result = {
                    "success": True,
                    "image_path": image_path,
                    "tool_used": "JSXGRAPH",
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
                    suggestion="Check if service is overloaded or diagram is too complex"
                )

            except RequestException as e:
                return _build_error_response(
                    code="SERVICE_UNREACHABLE",
                    message=f"Failed to connect to DiagramScreenshot service: {str(e)}",
                    suggestion=f"Ensure DiagramScreenshot service is running at {api_base_url}"
                )

        except Exception as e:
            logger.error(f"JSXGraph render_jsxgraph unexpected error: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error in render_jsxgraph tool: {str(e)}",
                suggestion="Check tool implementation and logs"
            )

    # Return MCP server
    return create_sdk_mcp_server(
        name="jsxgraph",
        version="1.0.0",
        tools=[render_jsxgraph]
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server Entry Point
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    """Run JSXGraph MCP server when invoked via python -m."""
    import asyncio
    import os

    workspace_path = os.environ.get("WORKSPACE_PATH")
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:8080")
    api_key = os.environ.get("API_KEY", "")

    if not workspace_path:
        raise RuntimeError("WORKSPACE_PATH environment variable is required")

    logger.info(f"🚀 Starting JSXGraph MCP server - workspace: {workspace_path}")

    server = create_jsxgraph_server(
        workspace_path=workspace_path,
        api_base_url=api_base_url,
        api_key=api_key
    )
    asyncio.run(server.run())
