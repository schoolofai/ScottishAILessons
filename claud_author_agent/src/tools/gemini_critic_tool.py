"""Gemini Visual Critic MCP Tool.

Provides MCP tool interface for critiquing educational diagrams using
Gemini's vision capabilities. Validates generated images against their
generation prompts and returns structured feedback.

Tool Pattern:
- Tool name: mcp__gemini_critic__critique_diagram
- Uses Gemini's multi-modal input (image + text)
- Returns structured JSON critique
- Fast-fail on all errors
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import tool, create_sdk_mcp_server

from ..utils.gemini_critic import (
    GeminiCritic,
    GeminiCritiqueError,
    CritiqueResult
)

logger = logging.getLogger(__name__)


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


def _build_success_response(critique: CritiqueResult) -> Dict[str, Any]:
    """Build standardized success response for MCP protocol."""
    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "success": True,
                **critique.to_dict()
            }, indent=2)
        }]
    }


def create_gemini_critic_mcp_server(workspace_path: str):
    """Create gemini_critic MCP server with workspace path captured in closure.

    Args:
        workspace_path: Absolute path to workspace directory for logging

    Returns:
        MCP server instance with critique_diagram tool
    """
    # Single critic instance for the session
    critic_instance: Optional[GeminiCritic] = None

    def get_critic() -> GeminiCritic:
        """Get or create critic instance (lazy initialization)."""
        nonlocal critic_instance
        if critic_instance is None:
            critic_instance = GeminiCritic()
        return critic_instance

    @tool(
        "critique_diagram",
        "Critique a generated diagram using Gemini's vision. Validates image against the generation prompt and returns structured feedback with correction prompt if needed.",
        {
            "image_path": {
                "type": "string",
                "description": "Absolute path to the PNG image to critique",
                "required": True
            },
            "generation_prompt": {
                "type": "string",
                "description": "The EXACT prompt that was used to generate this image. This is the validation source - every requirement in this prompt will be checked.",
                "required": True
            },
            "card_content": {
                "type": "string",
                "description": "Original card content (explainer or CFU stem) for educational context",
                "required": True
            },
            "diagram_context": {
                "type": "string",
                "description": "'lesson' (answers visible in green) or 'cfu' (answers hidden, show ? placeholder)",
                "required": True
            },
            "iteration": {
                "type": "integer",
                "description": "Current iteration number (1-based)",
                "required": True
            },
            "max_iterations": {
                "type": "integer",
                "description": "Maximum allowed iterations (optional, default from DIAGRAM_MAX_ITERATIONS env)",
                "required": False
            }
        }
    )
    async def critique_diagram(args):
        """Critique diagram using Gemini vision model.

        Uses Gemini's vision capabilities to validate the generated image
        against every requirement in the generation prompt. Returns structured
        critique with decision, score, and correction prompt if refinement needed.

        Args:
            args: Dictionary with keys:
                - image_path (str): Path to PNG image
                - generation_prompt (str): Original generation prompt
                - card_content (str): Card content for context
                - diagram_context (str): "lesson" or "cfu"
                - iteration (int): Current iteration number
                - max_iterations (int, optional): Maximum iterations

        Returns:
            Tool response:
            - Success: Critique result with decision, score, checklist, correction_prompt
            - Failure: Error response with isError: True
        """
        try:
            # Extract arguments
            image_path = args.get("image_path")
            generation_prompt = args.get("generation_prompt")
            card_content = args.get("card_content")
            diagram_context = args.get("diagram_context")
            iteration = args.get("iteration")
            max_iterations = args.get("max_iterations")

            # Validate required fields
            if not image_path:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'image_path' not provided",
                    suggestion="Provide the absolute path to the PNG image to critique"
                )

            if not generation_prompt:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'generation_prompt' not provided",
                    suggestion="Provide the exact prompt used to generate the image"
                )

            if not card_content:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'card_content' not provided",
                    suggestion="Provide the card content for context"
                )

            if not diagram_context:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'diagram_context' not provided",
                    suggestion="Provide 'lesson' or 'cfu'"
                )

            if diagram_context not in ["lesson", "cfu"]:
                return _build_error_response(
                    code="INVALID_FIELD",
                    message=f"Invalid diagram_context: {diagram_context}",
                    suggestion="Use 'lesson' or 'cfu'"
                )

            if iteration is None:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'iteration' not provided",
                    suggestion="Provide the current iteration number (1-based)"
                )

            # Log critique request
            logger.info("=" * 60)
            logger.info("🔍 GEMINI VISUAL CRITIQUE")
            logger.info("=" * 60)
            logger.info(f"Image: {image_path}")
            logger.info(f"Context: {diagram_context}")
            logger.info(f"Iteration: {iteration}")
            logger.info("-" * 60)
            logger.info(f"Generation prompt length: {len(generation_prompt)} chars")
            logger.info("=" * 60)

            # Save critique request to workspace for debugging
            critique_dir = Path(workspace_path) / "critiques"
            critique_dir.mkdir(parents=True, exist_ok=True)

            image_name = Path(image_path).stem
            critique_log_file = critique_dir / f"{image_name}_critique_{iteration}.json"
            critique_log_file.write_text(json.dumps({
                "image_path": image_path,
                "generation_prompt": generation_prompt,
                "card_content": card_content,
                "diagram_context": diagram_context,
                "iteration": iteration
            }, indent=2))
            logger.info(f"📝 Critique request saved to: {critique_log_file}")

            # Perform critique
            critic = get_critic()
            result = critic.critique(
                image_path=image_path,
                generation_prompt=generation_prompt,
                card_content=card_content,
                diagram_context=diagram_context,
                iteration=iteration,
                max_iterations=max_iterations
            )

            # Log result
            logger.info(f"✅ Critique complete: {result.decision} (score: {result.final_score})")
            logger.info(f"   Matched: {result.requirements_matched}/{result.requirements_total}")

            # Save result to workspace
            result_file = critique_dir / f"{image_name}_result_{iteration}.json"
            result_file.write_text(json.dumps(result.to_dict(), indent=2))
            logger.info(f"📝 Critique result saved to: {result_file}")

            return _build_success_response(result)

        except FileNotFoundError as e:
            logger.error(f"Image not found: {e}")
            return _build_error_response(
                code="IMAGE_NOT_FOUND",
                message=str(e),
                suggestion="Verify the image_path is correct and the file exists"
            )

        except GeminiCritiqueError as e:
            logger.error(f"Gemini critique error: {e}")
            return _build_error_response(
                code="CRITIQUE_ERROR",
                message=str(e),
                suggestion="Check Gemini API availability and response format"
            )

        except Exception as e:
            logger.error(f"Unexpected error in critique_diagram: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error: {str(e)}",
                suggestion="Check tool implementation and logs"
            )

    # Return MCP server with configured tool
    return create_sdk_mcp_server(
        name="gemini_critic",
        version="1.0.0",
        tools=[critique_diagram]
    )


# Default MCP server (for backward compatibility and tests)
gemini_critic_mcp_server = create_gemini_critic_mcp_server(str(Path.cwd()))

# Tool naming convention:
# - mcp__gemini_critic__critique_diagram
