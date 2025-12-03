"""Gemini Image Generation MCP Tool.

Provides MCP tool interface for generating educational diagrams via Gemini API.
Follows fast-fail principle with detailed error logging and no fallback mechanisms.

**FILE-BASED ARCHITECTURE**: This tool generates PNG images via Gemini API and
writes them to workspace, returning file paths for visual critique.

Tool Pattern:
- Following diagram_screenshot_tool.py MCP registration pattern
- Tool name convention: mcp__gemini__generate_diagram
- Fast-fail on all errors (API errors, validation failures)
- FILE-BASED: Writes PNG to {workspace}/diagrams/ and returns path

Usage:
    Tool name: mcp__gemini__generate_diagram
    Args: {
        "prompt": str,           # Natural language prompt for Gemini
        "output_filename": str,  # Filename (e.g., "card_001_lesson_0.png")
        "aspect_ratio": str,     # Optional: "16:9" (default), "1:1", "9:16"
    }

Returns:
    - Success: {"success": true, "image_path": "/workspace/diagrams/...", "iteration": 0}
    - Failure: {"success": false, "error": {...}} with isError: True
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import tool, create_sdk_mcp_server

from ..utils.gemini_image_generator import (
    GeminiDiagramChat,
    save_diagram_image,
    GeminiGenerationError,
    GeminiRefinementError,
    GeminiIterationLimitError
)

# Set up logging
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def _build_error_response(
    code: str,
    message: str,
    details: Optional[Any] = None,
    suggestion: Optional[str] = None
) -> Dict[str, Any]:
    """Build standardized error response for MCP protocol.

    Args:
        code: Machine-readable error code (e.g., "GENERATION_ERROR")
        message: Human-readable error message
        details: Additional diagnostic information
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


def _build_success_response(
    image_path: str,
    iteration: int = 0,
    text_response: Optional[str] = None
) -> Dict[str, Any]:
    """Build standardized success response for MCP protocol.

    Args:
        image_path: Absolute path to saved PNG file
        iteration: Iteration number (0 for initial, 1+ for refinements)
        text_response: Optional text from Gemini response

    Returns:
        dict: Success response for MCP protocol
    """
    result = {
        "success": True,
        "image_path": image_path,
        "iteration": iteration
    }

    if text_response:
        result["text_response"] = text_response

    return {
        "content": [{
            "type": "text",
            "text": json.dumps(result, indent=2)
        }]
    }


# ═══════════════════════════════════════════════════════════════
# MCP Tool Implementation Factory
# ═══════════════════════════════════════════════════════════════

def create_gemini_mcp_server(workspace_path: str):
    """Create gemini MCP server with workspace path captured in closure.

    This factory function creates a generate_diagram tool that has access to the
    workspace_path through closure, avoiding environment variable dependency.

    Args:
        workspace_path: Absolute path to workspace directory where diagrams will be written

    Returns:
        MCP server instance with generate_diagram tool configured for the workspace
    """
    # Create a GeminiDiagramChat instance per session (maintains context for refinement)
    # This is stored in closure for stateful multi-turn generation
    chat_sessions: Dict[str, GeminiDiagramChat] = {}

    @tool(
        "generate_diagram",
        "Generate an educational diagram image using Gemini API. Writes PNG to workspace and returns file path. Use for initial generation. For refinements, use refine_diagram tool.",
        {
            "prompt": {
                "type": "string",
                "description": "Natural language prompt describing the diagram to generate. Include: subject, elements to show, colors (Scottish palette), and context (lesson/CFU rules).",
                "required": True
            },
            "output_filename": {
                "type": "string",
                "description": "Filename for the output PNG (e.g., 'card_001_lesson_0.png'). Will be written to {workspace}/diagrams/",
                "required": True
            },
            "aspect_ratio": {
                "type": "string",
                "description": "Image aspect ratio: '16:9' (default, best for slides), '1:1' (square), '9:16' (portrait)",
                "required": False
            },
            "session_id": {
                "type": "string",
                "description": "Session ID for multi-turn refinement. Use card_id + context (e.g., 'card_001_lesson'). Required for refine_diagram to work.",
                "required": False
            }
        }
    )
    async def generate_diagram(args):
        """Generate educational diagram via Gemini API.

        Creates a new Gemini chat session and generates an initial diagram.
        The session is stored for subsequent refinement calls.

        Args:
            args: Dictionary with keys:
                - prompt (str): Natural language description of diagram
                - output_filename (str): Filename for PNG output
                - aspect_ratio (str, optional): Image aspect ratio
                - session_id (str, optional): ID for multi-turn session

        Returns:
            Tool response:
            - Success: {"success": true, "image_path": "...", "iteration": 0}
            - Failure: Error response with isError: True
        """
        try:
            # Extract arguments
            prompt = args.get("prompt")
            output_filename = args.get("output_filename")
            aspect_ratio = args.get("aspect_ratio", "16:9")
            session_id = args.get("session_id")

            # Validate required fields
            if not prompt:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'prompt' not provided",
                    suggestion="Provide a natural language prompt describing the diagram"
                )

            if not output_filename:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'output_filename' not provided",
                    suggestion="Provide filename for PNG output (e.g., 'card_001_lesson_0.png')"
                )

            # Log full prompt with clear markers for debugging
            logger.info("=" * 60)
            logger.info("🎨 GEMINI PROMPT (FULL)")
            logger.info("=" * 60)
            logger.info(f"Output: {output_filename}")
            logger.info(f"Aspect ratio: {aspect_ratio}")
            logger.info(f"Session ID: {session_id or 'not provided'}")
            logger.info("-" * 60)
            logger.info(prompt)  # FULL PROMPT - NOT TRUNCATED
            logger.info("=" * 60)

            # Save prompt to workspace for reference and debugging
            prompts_dir = Path(workspace_path) / "prompts"
            prompts_dir.mkdir(parents=True, exist_ok=True)
            prompt_file = prompts_dir / f"{output_filename.replace('.png', '_prompt.txt')}"
            prompt_file.write_text(prompt)
            logger.info(f"📝 Prompt saved to: {prompt_file}")

            # Create new Gemini chat session
            chat = GeminiDiagramChat(aspect_ratio=aspect_ratio)

            # Generate initial diagram
            result = chat.start_session(prompt)

            if not result.success:
                return _build_error_response(
                    code="GENERATION_FAILED",
                    message=result.error_message or "Gemini did not generate an image",
                    details={"text_response": result.text_response},
                    suggestion="Check prompt content and try again with more specific instructions"
                )

            # Save image to workspace
            diagrams_dir = Path(workspace_path) / "diagrams"
            diagrams_dir.mkdir(parents=True, exist_ok=True)

            image_path = diagrams_dir / output_filename
            image_bytes = __import__('base64').b64decode(result.image_base64)
            image_path.write_bytes(image_bytes)

            logger.info(f"✅ Diagram generated and saved: {image_path}")

            # Store session for refinement (if session_id provided)
            if session_id:
                chat_sessions[session_id] = chat
                logger.info(f"📝 Session stored: {session_id}")

            return _build_success_response(
                image_path=str(image_path.absolute()),
                iteration=0,
                text_response=result.text_response
            )

        except GeminiGenerationError as e:
            logger.error(f"Gemini generation error: {e}")
            return _build_error_response(
                code="GEMINI_ERROR",
                message=str(e),
                suggestion="Check Gemini API key and service availability"
            )

        except Exception as e:
            logger.error(f"Unexpected error in generate_diagram: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error: {str(e)}",
                suggestion="Check tool implementation and logs"
            )

    @tool(
        "refine_diagram",
        "Refine an existing diagram based on visual critique feedback. Supports two modes: (1) Text-only refinement using session context, (2) Image-to-image refinement where Gemini sees the original image. Use input_image_path for image-to-image mode.",
        {
            "session_id": {
                "type": "string",
                "description": "Session ID from generate_diagram (e.g., 'card_001_lesson'). Required for text-only mode, optional for image-to-image mode.",
                "required": False
            },
            "feedback": {
                "type": "string",
                "description": "Correction prompt describing improvements needed. For image-to-image mode, this should be a detailed correction prompt from the visual critic.",
                "required": True
            },
            "output_filename": {
                "type": "string",
                "description": "Filename for the refined PNG (can be same as original to overwrite)",
                "required": True
            },
            "input_image_path": {
                "type": "string",
                "description": "Path to original image for image-to-image refinement. When provided, Gemini will see the original image alongside the correction prompt. This enables true visual refinement where Gemini understands what needs to be fixed.",
                "required": False
            }
        }
    )
    async def refine_diagram(args):
        """Refine diagram based on visual critique feedback.

        Supports two refinement modes:
        1. Text-only (session_id required): Uses chat context from generate_diagram
        2. Image-to-image (input_image_path provided): Gemini sees the original image

        Args:
            args: Dictionary with keys:
                - session_id (str, optional): ID of active session (for text-only mode)
                - feedback (str): Correction prompt for refinement
                - output_filename (str): Filename for refined PNG
                - input_image_path (str, optional): Path to image for image-to-image mode

        Returns:
            Tool response:
            - Success: {"success": true, "image_path": "...", "iteration": N}
            - Failure: Error response with isError: True
        """
        try:
            # Extract arguments
            session_id = args.get("session_id")
            feedback = args.get("feedback")
            output_filename = args.get("output_filename")
            input_image_path = args.get("input_image_path")

            # Validate required fields
            if not feedback:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'feedback' not provided",
                    suggestion="Provide correction prompt describing improvements needed"
                )

            if not output_filename:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'output_filename' not provided",
                    suggestion="Provide filename for refined PNG output"
                )

            # Determine refinement mode
            use_image_to_image = bool(input_image_path)

            if use_image_to_image:
                # IMAGE-TO-IMAGE MODE: Gemini sees the original image
                logger.info("=" * 60)
                logger.info("🖼️ IMAGE-TO-IMAGE REFINEMENT")
                logger.info("=" * 60)
                logger.info(f"Input image: {input_image_path}")
                logger.info(f"Output: {output_filename}")
                logger.info("-" * 60)
                logger.info(feedback)  # FULL CORRECTION PROMPT
                logger.info("=" * 60)

                # Save correction prompt to workspace for reference
                prompts_dir = Path(workspace_path) / "prompts"
                prompts_dir.mkdir(parents=True, exist_ok=True)
                feedback_file = prompts_dir / f"{output_filename.replace('.png', '_correction.txt')}"
                feedback_file.write_text(feedback)
                logger.info(f"📝 Correction prompt saved to: {feedback_file}")

                # Create or get chat session for image-to-image
                if session_id and session_id in chat_sessions:
                    chat = chat_sessions[session_id]
                else:
                    # Create new chat for image-to-image (no prior context needed)
                    chat = GeminiDiagramChat()
                    if session_id:
                        chat_sessions[session_id] = chat

                # Use image-to-image refinement
                result = chat.refine_with_image(
                    correction_prompt=feedback,
                    input_image_path=input_image_path
                )

            else:
                # TEXT-ONLY MODE: Uses session context
                if not session_id:
                    return _build_error_response(
                        code="MISSING_FIELD",
                        message="Either 'session_id' or 'input_image_path' required",
                        suggestion="For text-only refinement, provide session_id. For image-to-image, provide input_image_path."
                    )

                # Get existing session
                chat = chat_sessions.get(session_id)
                if not chat:
                    return _build_error_response(
                        code="SESSION_NOT_FOUND",
                        message=f"No active session found for ID: {session_id}",
                        details={"available_sessions": list(chat_sessions.keys())},
                        suggestion="Call generate_diagram first with session_id, or use input_image_path for image-to-image mode"
                    )

                # Log full feedback with clear markers for debugging
                logger.info("=" * 60)
                logger.info(f"🔄 TEXT-ONLY REFINEMENT (iteration {chat.get_iteration_count() + 1})")
                logger.info("=" * 60)
                logger.info(f"Session ID: {session_id}")
                logger.info(f"Output: {output_filename}")
                logger.info("-" * 60)
                logger.info(feedback)  # FULL FEEDBACK
                logger.info("=" * 60)

                # Save feedback to workspace for reference
                prompts_dir = Path(workspace_path) / "prompts"
                prompts_dir.mkdir(parents=True, exist_ok=True)
                feedback_file = prompts_dir / f"{output_filename.replace('.png', f'_feedback_{chat.get_iteration_count() + 1}.txt')}"
                feedback_file.write_text(feedback)
                logger.info(f"📝 Feedback saved to: {feedback_file}")

                # Refine diagram using session context
                result = chat.refine(feedback)

            if not result.success:
                return _build_error_response(
                    code="REFINEMENT_FAILED",
                    message=result.error_message or "Gemini did not generate refined image",
                    details={"text_response": result.text_response, "iteration": result.iteration},
                    suggestion="Try different feedback or restart with new generate_diagram"
                )

            # Save refined image
            diagrams_dir = Path(workspace_path) / "diagrams"
            image_path = diagrams_dir / output_filename
            image_bytes = __import__('base64').b64decode(result.image_base64)
            image_path.write_bytes(image_bytes)

            mode_str = "image-to-image" if use_image_to_image else "text-only"
            logger.info(f"✅ Diagram refined ({mode_str}) and saved: {image_path} (iteration {result.iteration})")

            return _build_success_response(
                image_path=str(image_path.absolute()),
                iteration=result.iteration,
                text_response=result.text_response
            )

        except GeminiIterationLimitError as e:
            logger.error(f"Iteration limit reached: {e}")
            return _build_error_response(
                code="ITERATION_LIMIT",
                message=str(e),
                suggestion="Accept current result or restart with new generate_diagram"
            )

        except GeminiRefinementError as e:
            logger.error(f"Gemini refinement error: {e}")
            return _build_error_response(
                code="REFINEMENT_ERROR",
                message=str(e),
                suggestion="Check feedback format and try again"
            )

        except Exception as e:
            logger.error(f"Unexpected error in refine_diagram: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error: {str(e)}",
                suggestion="Check tool implementation and logs"
            )

    @tool(
        "get_session_status",
        "Get status of a Gemini diagram generation session. Returns iteration count and whether at limit.",
        {
            "session_id": {
                "type": "string",
                "description": "Session ID to check status for",
                "required": True
            }
        }
    )
    async def get_session_status(args):
        """Get status of diagram generation session.

        Args:
            args: Dictionary with session_id

        Returns:
            Status information about the session
        """
        session_id = args.get("session_id")

        if not session_id:
            return _build_error_response(
                code="MISSING_FIELD",
                message="Required field 'session_id' not provided",
                suggestion="Provide session_id to check"
            )

        chat = chat_sessions.get(session_id)
        if not chat:
            return {
                "content": [{
                    "type": "text",
                    "text": json.dumps({
                        "exists": False,
                        "session_id": session_id,
                        "available_sessions": list(chat_sessions.keys())
                    }, indent=2)
                }]
            }

        return {
            "content": [{
                "type": "text",
                "text": json.dumps({
                    "exists": True,
                    "session_id": session_id,
                    "iteration_count": chat.get_iteration_count(),
                    "max_iterations": chat.MAX_ITERATIONS,
                    "at_limit": chat.is_at_limit()
                }, indent=2)
            }]
        }

    # Return MCP server with configured tools
    return create_sdk_mcp_server(
        name="gemini",
        version="1.0.0",
        tools=[generate_diagram, refine_diagram, get_session_status]
    )


# ═══════════════════════════════════════════════════════════════
# Default MCP Server (for backward compatibility and tests)
# ═══════════════════════════════════════════════════════════════

# Create default server using current working directory
# Production code should use create_gemini_mcp_server(workspace_path)
gemini_mcp_server = create_gemini_mcp_server(str(Path.cwd()))

# Tool naming convention:
# - mcp__gemini__generate_diagram
# - mcp__gemini__refine_diagram
# - mcp__gemini__get_session_status
