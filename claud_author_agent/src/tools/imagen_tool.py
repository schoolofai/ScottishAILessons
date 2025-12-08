"""Gemini Imagen AI Image Generation MCP Tool.

Provides MCP tool interface for generating contextual images using Google Gemini Imagen
via the DiagramScreenshot REST API service.

**Purpose**: Real-world contextual illustrations, NOT mathematical diagrams
- Word problem context that needs visual illustration
- Real-world scenarios: buildings, ladders, trees, vehicles, people
- Physical setups that help students understand the problem
- Situations where a photograph-style image aids comprehension
- Problems where students struggle to visualize the real-world context

**NOT for** (use other tools):
- Mathematical diagrams (use other tools)
- Graphs or charts (use Desmos/Plotly)
- Geometric constructions (use GeoGebra)
- Coordinate geometry (use JSXGraph)

**FILE-BASED ARCHITECTURE**: Writes PNG files to workspace and returns file paths
instead of base64 data, enabling efficient token usage and visual critique.

Service Contract:
- Endpoint: POST {base_url}/api/v1/render/imagen
- Request: {prompt: {text, style, educational}, options}
- Success: {success: true, image: string (base64), metadata: {...}}
- Error: {success: false, error: {code, message, details}}

Tool Pattern:
- Tool name convention: mcp__imagen__render_imagen
- Fast-fail on all errors (HTTP errors, timeouts, validation failures)
- FILE-BASED: Writes PNG to {workspace}/diagrams/ and returns path

Usage:
    Tool name: mcp__imagen__render_imagen
    Args: {
        "prompt": {
            "text": "A 6m ladder leaning against a vertical brick wall...",
            "style": {"type": "realistic"},
            "educational": {"subject": "mathematics", "level": "secondary"}
        },
        "card_id": "q9",
        "diagram_context": "question"
    }

Returns:
    - Success: {"success": true, "image_path": "/path/diagrams/q9_question.png", "metadata": {...}}
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

# HTTP timeout (60 seconds - Imagen can be slower)
REQUEST_TIMEOUT = 60

# Default render options for Imagen
DEFAULT_RENDER_OPTIONS = {
    "width": 1024,
    "height": 768,
    "format": "png"
}

# Default educational context
DEFAULT_EDUCATIONAL = {
    "subject": "mathematics",
    "level": "secondary"
}

# Default style
DEFAULT_STYLE = {
    "type": "realistic"
}


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def _detect_image_format(image_bytes: bytes) -> str:
    """Detect image format from magic bytes.

    Returns file extension (without dot) based on image content.
    JPEG starts with FFD8FF, PNG starts with 89504E47.
    """
    if image_bytes[:3] == b'\xff\xd8\xff':
        return "jpg"
    elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return "png"
    elif image_bytes[:4] == b'GIF8':
        return "gif"
    elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
        return "webp"
    else:
        # Default to jpg as that's what Imagen typically returns
        logger.warning("⚠️ Imagen: Unknown image format, defaulting to JPEG")
        return "jpg"


def _write_diagram_file(
    image_base64: str,
    card_id: str,
    diagram_context: str,
    workspace_path: str,
    diagram_index: int = 0
) -> str:
    """Write diagram image file to workspace and return absolute path.

    Automatically detects image format (JPEG/PNG) from content and uses
    correct file extension. Gemini Imagen typically returns JPEG.
    """
    logger.info(f"📁 Imagen: Writing image to workspace: {workspace_path}")

    diagrams_dir = Path(workspace_path) / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    # Decode base64 to detect format
    image_bytes = base64.b64decode(image_base64)
    image_format = _detect_image_format(image_bytes)
    logger.info(f"📁 Imagen: Detected image format: {image_format.upper()}")

    # Build filename with correct extension
    if diagram_index > 0:
        filename = f"{card_id}_{diagram_context}_{diagram_index}.{image_format}"
    else:
        filename = f"{card_id}_{diagram_context}.{image_format}"
    file_path = diagrams_dir / filename

    file_path.write_bytes(image_bytes)

    logger.info(f"✅ Imagen: Wrote image file: {file_path} ({len(image_bytes)} bytes)")

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

def create_imagen_server(workspace_path: str, api_base_url: str, api_key: str = None):
    """Create Imagen MCP server with workspace path and API config captured in closure.

    This factory function creates a render_imagen tool for AI image generation
    that has access to configuration through closure.

    Args:
        workspace_path: Absolute path to workspace directory where images will be written
        api_base_url: Base URL for DiagramScreenshot service (e.g., "http://localhost:3001")
        api_key: API key for DiagramScreenshot service (optional)

    Returns:
        MCP server instance with render_imagen tool configured

    Example:
        server = create_imagen_server("/workspace", "http://localhost:3001", "api-key")
    """

    @tool(
        "render_imagen",
        "Generate contextual AI image using Gemini Imagen. Best for: real-world scenarios (ladders, buildings, ships, shadows), word problem context visualization, physical setup illustrations. NOT for mathematical diagrams. Returns PNG file path.",
        {
            "prompt": {
                "type": "object",
                "description": "Image generation prompt with 'text' (description), optional 'style' ({type: 'realistic'|'diagram'}), optional 'educational' ({subject, level})",
                "required": True
            },
            "card_id": {
                "type": "string",
                "description": "Card/question identifier for filename (e.g., 'q9')",
                "required": True
            },
            "diagram_context": {
                "type": "string",
                "description": "Context: 'question', 'worked_solution', 'hint', or 'misconception'",
                "required": True
            },
            "diagram_index": {
                "type": "integer",
                "description": "Index for multiple images per card (0 for first/only)",
                "required": False
            },
            "options": {
                "type": "object",
                "description": "Render options: {width, height}",
                "required": False
            }
        }
    )
    async def render_imagen(args):
        """Generate contextual image using Gemini Imagen via HTTP service.

        **IMAGEN STRENGTHS**:
        - Realistic images for word problem context
        - Helps students visualize physical setups
        - Good for trigonometry scenarios (ladders, buildings, shadows)
        - Good for bearing/navigation contexts (ships, lighthouses)

        **Example prompts**:
        - "A 6m ladder leaning against a vertical brick wall with the foot 2m from the base"
        - "A ship sailing from a lighthouse on a bearing of 135 degrees"
        - "Two buildings with a cable stretched between their rooftops"
        - "A person's shadow on the ground with the afternoon sun behind them"
        - "A wheelchair ramp leading up to a doorway showing the angle of inclination"

        Process:
        1. Send prompt to DiagramScreenshot Imagen endpoint
        2. Receive base64-encoded PNG from Gemini
        3. Write PNG to {workspace}/diagrams/{card_id}_{context}.png
        4. Return absolute file path

        Args:
            args: Dictionary with prompt, card_id, diagram_context, options

        Returns:
            Success: {success: true, image_path: "...", metadata: {...}}
            Failure: {success: false, error: {...}, isError: true}
        """
        try:
            # Extract arguments
            prompt = args.get("prompt")
            card_id = args.get("card_id")
            diagram_context = args.get("diagram_context")
            diagram_index = args.get("diagram_index", 0)
            options = args.get("options", {})

            # Parse JSON strings to objects (SDK may pass as strings)
            if isinstance(prompt, str):
                try:
                    prompt = json.loads(prompt)
                    logger.info("🔧 Imagen: Parsed prompt from JSON string")
                except json.JSONDecodeError as e:
                    # If it's just a plain text prompt, wrap it
                    prompt = {"text": prompt}
                    logger.info("🔧 Imagen: Using plain text as prompt")

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
            if not prompt:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'prompt' not provided",
                    suggestion="Provide prompt with 'text' describing the image to generate"
                )

            if not isinstance(prompt, dict):
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Field 'prompt' must be an object",
                    details={"received_type": type(prompt).__name__},
                    suggestion="Provide prompt as {text: '...', style: {...}, educational: {...}}"
                )

            if "text" not in prompt:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Prompt missing required field 'text'",
                    suggestion="Add 'text' field with image description"
                )

            if not prompt["text"] or len(prompt["text"].strip()) < 10:
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Prompt text too short or empty",
                    suggestion="Provide detailed description (at least 10 characters)"
                )

            if not card_id:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'card_id' not provided",
                    suggestion="Provide card_id for filename (e.g., 'q9')"
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

            logger.info(f"🔧 Imagen render_imagen called: card_id={card_id}, context={diagram_context}")
            logger.info(f"🔧 Imagen prompt text: {prompt['text'][:100]}...")

            # Build full prompt with defaults
            full_prompt = {
                "text": prompt["text"],
                "style": prompt.get("style", DEFAULT_STYLE),
                "educational": prompt.get("educational", DEFAULT_EDUCATIONAL)
            }

            # Merge with defaults
            render_options = {**DEFAULT_RENDER_OPTIONS, **options}

            # Build request payload
            payload = {
                "prompt": full_prompt,
                "options": render_options
            }

            # Make HTTP POST request
            render_url = f"{api_base_url}/api/v1/render/imagen"

            try:
                headers = {"Content-Type": "application/json"}
                if api_key:
                    headers["X-API-Key"] = api_key

                logger.info(f"🔧 Imagen: POST to {render_url}")

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
                            suggestion="Check prompt content for policy violations"
                        )

                # Validate success response
                if not isinstance(response_data, dict) or not response_data.get("success"):
                    return _build_error_response(
                        code="INVALID_RESPONSE",
                        message="DiagramScreenshot returned unexpected response format",
                        details={"response": response_data},
                        suggestion="Check service compatibility"
                    )

                # Handle both 'image' (singular) and 'images' (array) response formats
                # imagen.client.ts returns: {success: true, images: [{image: base64, mimeType: ...}]}
                image_base64 = None

                if "image" in response_data:
                    # Direct image field (future-proofing)
                    image_base64 = response_data["image"]
                    logger.info("🔧 Imagen: Using 'image' field from response")
                elif "images" in response_data:
                    # Array format from imagen.client.ts
                    images = response_data["images"]
                    if not images or len(images) == 0:
                        return _build_error_response(
                            code="EMPTY_IMAGES",
                            message="Imagen returned empty images array",
                            suggestion="Check Gemini API response - may have been blocked"
                        )
                    # Extract base64 from first GeneratedImage object
                    first_image = images[0]
                    if isinstance(first_image, dict):
                        image_base64 = first_image.get("image")
                    else:
                        image_base64 = first_image
                    logger.info(f"🔧 Imagen: Using first image from 'images' array ({len(images)} total)")
                else:
                    return _build_error_response(
                        code="MISSING_FIELD",
                        message="Success response missing 'image' or 'images' field",
                        details={"response_keys": list(response_data.keys())},
                        suggestion="Check DiagramScreenshot service implementation"
                    )

                if not image_base64:
                    return _build_error_response(
                        code="EMPTY_IMAGE_DATA",
                        message="Image data is empty or null",
                        suggestion="Gemini may have blocked the image generation"
                    )

                # Success! Write PNG file
                image_path = _write_diagram_file(
                    image_base64, card_id, diagram_context, workspace_path, diagram_index
                )

                logger.info(f"✅ Imagen: Image generated successfully: {image_path}")

                result = {
                    "success": True,
                    "image_path": image_path,
                    "tool_used": "IMAGE_GENERATION",
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
                    suggestion="Imagen generation can be slow; try simplifying the prompt"
                )

            except RequestException as e:
                return _build_error_response(
                    code="SERVICE_UNREACHABLE",
                    message=f"Failed to connect to DiagramScreenshot service: {str(e)}",
                    suggestion=f"Ensure DiagramScreenshot service is running at {api_base_url}"
                )

        except Exception as e:
            logger.error(f"Imagen render_imagen unexpected error: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error in render_imagen tool: {str(e)}",
                suggestion="Check tool implementation and logs"
            )

    # Return MCP server
    return create_sdk_mcp_server(
        name="imagen",
        version="1.0.0",
        tools=[render_imagen]
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server Entry Point
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    """Run Imagen MCP server when invoked via python -m."""
    import asyncio
    import os

    workspace_path = os.environ.get("WORKSPACE_PATH")
    api_base_url = os.environ.get("API_BASE_URL", "http://localhost:8080")
    api_key = os.environ.get("API_KEY", "")

    if not workspace_path:
        raise RuntimeError("WORKSPACE_PATH environment variable is required")

    logger.info(f"🚀 Starting Imagen MCP server - workspace: {workspace_path}")

    server = create_imagen_server(
        workspace_path=workspace_path,
        api_base_url=api_base_url,
        api_key=api_key
    )
    asyncio.run(server.run())
