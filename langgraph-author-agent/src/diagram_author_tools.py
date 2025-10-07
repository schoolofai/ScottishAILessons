"""Tools for Diagram Author Deep Agent.

This module provides the render_diagram_tool that communicates with the
DiagramScreenshot service via HTTP. This is the ONLY tool used by the
diagram author agent - no Appwrite tools are included.

The DiagramScreenshot service runs on http://localhost:3001 and provides
headless rendering of JSXGraph diagrams to PNG images.
"""

import os
import json
import requests
from typing import Dict, Any, Optional
from langchain_core.tools import tool


# DiagramScreenshot service configuration
DIAGRAM_SCREENSHOT_URL = os.environ.get(
    "DIAGRAM_SCREENSHOT_URL",
    "http://localhost:3001"
)
RENDER_ENDPOINT = f"{DIAGRAM_SCREENSHOT_URL}/api/v1/render"
HEALTH_ENDPOINT = f"{DIAGRAM_SCREENSHOT_URL}/health"
RENDER_TIMEOUT = 30  # seconds


@tool
def render_diagram_tool(jsxgraph_json: str) -> Dict[str, Any]:
    """Render a JSXGraph diagram to a PNG image using the DiagramScreenshot service.

    This tool sends JSXGraph JSON configuration to the headless rendering service
    and receives back a base64-encoded PNG image. The service handles all browser
    interactions using Playwright.

    Args:
        jsxgraph_json: Stringified JSON containing JSXGraph diagram configuration.
                      Must include 'diagram.board' and 'diagram.elements' structure.

    Returns:
        Dictionary with:
        - success (bool): Whether rendering succeeded
        - image (str): Base64-encoded PNG image (if success=True)
        - metadata (dict): Rendering metadata (dimensions, timing, etc.)
        - error (str): Error message (if success=False)
        - error_code (str): Machine-readable error code (if success=False)

    Example:
        >>> jsxgraph_json = json.dumps({
        ...     "diagram": {
        ...         "board": {
        ...             "boundingbox": [-5, 5, 5, -5],
        ...             "axis": True,
        ...             "showNavigation": False
        ...         },
        ...         "elements": [
        ...             {
        ...                 "type": "point",
        ...                 "args": [[0, 0]],
        ...                 "attributes": {"name": "Origin", "size": 3}
        ...             }
        ...         ]
        ...     }
        ... })
        >>> result = render_diagram_tool(jsxgraph_json)
        >>> if result["success"]:
        ...     print(f"Rendered image: {len(result['image'])} bytes")
        ... else:
        ...     print(f"Error: {result['error']}")
    """
    try:
        # Parse JSXGraph JSON to validate structure
        try:
            diagram_data = json.loads(jsxgraph_json)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Invalid JSON: {str(e)}",
                "error_code": "INVALID_JSON",
                "suggestions": [
                    "Ensure jsxgraph_json is valid JSON string",
                    "Check for proper escaping of quotes",
                    "Validate diagram.board and diagram.elements structure"
                ]
            }

        # Validate required structure
        if "diagram" not in diagram_data:
            return {
                "success": False,
                "error": "Missing 'diagram' key in JSON",
                "error_code": "INVALID_STRUCTURE",
                "suggestions": [
                    "Add 'diagram' key at root level",
                    "Structure should be: { diagram: { board: {...}, elements: [...] } }"
                ]
            }

        if "board" not in diagram_data["diagram"]:
            return {
                "success": False,
                "error": "Missing 'diagram.board' in JSON",
                "error_code": "INVALID_STRUCTURE",
                "suggestions": [
                    "Add 'board' configuration to diagram",
                    "Example: { boundingbox: [-5, 5, 5, -5], axis: true }"
                ]
            }

        if "elements" not in diagram_data["diagram"]:
            return {
                "success": False,
                "error": "Missing 'diagram.elements' in JSON",
                "error_code": "INVALID_STRUCTURE",
                "suggestions": [
                    "Add 'elements' array to diagram",
                    "Elements should contain JSXGraph objects to render"
                ]
            }

        # Make HTTP POST request to DiagramScreenshot service
        try:
            response = requests.post(
                RENDER_ENDPOINT,
                json=diagram_data,
                headers={"Content-Type": "application/json"},
                timeout=RENDER_TIMEOUT
            )

            # Handle HTTP errors
            if response.status_code != 200:
                error_data = response.json() if response.headers.get("content-type") == "application/json" else {}
                return {
                    "success": False,
                    "error": error_data.get("error", f"HTTP {response.status_code}"),
                    "error_code": error_data.get("error_code", "HTTP_ERROR"),
                    "suggestions": error_data.get("suggestions", [
                        f"DiagramScreenshot service returned status {response.status_code}",
                        "Check if service is running on http://localhost:3001",
                        "Review service logs for more details"
                    ])
                }

            # Parse successful response
            result = response.json()

            # Validate response structure
            if not result.get("success"):
                return {
                    "success": False,
                    "error": result.get("error", "Unknown error from service"),
                    "error_code": result.get("error_code", "SERVICE_ERROR"),
                    "suggestions": result.get("suggestions", [])
                }

            return {
                "success": True,
                "image": result.get("image", ""),
                "metadata": result.get("metadata", {})
            }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": f"Rendering timeout after {RENDER_TIMEOUT} seconds",
                "error_code": "TIMEOUT",
                "suggestions": [
                    "Simplify diagram (reduce number of elements)",
                    "Check if DiagramScreenshot service is responsive",
                    "Increase RENDER_TIMEOUT if diagram is complex"
                ]
            }

        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": f"Cannot connect to DiagramScreenshot service at {DIAGRAM_SCREENSHOT_URL}",
                "error_code": "CONNECTION_ERROR",
                "suggestions": [
                    "Start DiagramScreenshot service: cd diagram-prototypes && docker compose up -d",
                    f"Verify service is running: curl {HEALTH_ENDPOINT}",
                    "Check if port 3001 is available"
                ]
            }

        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"HTTP request failed: {str(e)}",
                "error_code": "REQUEST_ERROR",
                "suggestions": [
                    "Check network connectivity",
                    "Verify DiagramScreenshot service is healthy",
                    "Review service logs for errors"
                ]
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "error_code": "UNEXPECTED_ERROR",
            "suggestions": [
                "Review error message for details",
                "Check tool implementation for bugs",
                "Report issue if error persists"
            ]
        }


def check_diagram_service_health() -> Dict[str, Any]:
    """Check if DiagramScreenshot service is running and healthy.

    This is a utility function (not a tool) used for startup checks.

    Returns:
        Dictionary with:
        - healthy (bool): Whether service is healthy
        - status (str): Service status message
        - details (dict): Health check details (if available)
    """
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return {
                "healthy": data.get("status") == "healthy",
                "status": data.get("status", "unknown"),
                "details": data
            }
        else:
            return {
                "healthy": False,
                "status": "unhealthy",
                "details": {"http_status": response.status_code}
            }
    except requests.exceptions.RequestException as e:
        return {
            "healthy": False,
            "status": "unreachable",
            "details": {"error": str(e)}
        }


# Export tools list for agent configuration
diagram_tools = [render_diagram_tool]
