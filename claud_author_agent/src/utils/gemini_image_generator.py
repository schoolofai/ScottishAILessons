"""Gemini image generation with multi-turn chat for iterative refinement.

Provides GeminiDiagramChat class for generating educational diagrams
using Gemini's Nano Banana Pro model with support for iterative
refinement based on visual critique feedback.

Key Features:
- Multi-turn chat maintains context for refinement iterations
- Direct PNG output (no JSXGraph intermediate representation)
- Base64 encoding for storage compatibility
- Maximum 10 iterations with explicit tracking
"""

import base64
import logging
import os
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from pathlib import Path

from .gemini_client import (
    get_gemini_client,
    get_gemini_config,
    GeminiAPIError,
    GeminiConfigurationError
)

logger = logging.getLogger(__name__)


class GeminiGenerationError(GeminiAPIError):
    """Raised when image generation fails."""
    pass


class GeminiRefinementError(GeminiAPIError):
    """Raised when image refinement fails."""
    pass


class GeminiIterationLimitError(GeminiAPIError):
    """Raised when maximum iterations exceeded."""
    pass


@dataclass
class GenerationResult:
    """Result of a Gemini image generation attempt.

    Attributes:
        success: Whether generation succeeded
        image_base64: Base64-encoded PNG image (if success=True)
        text_response: Any text returned by Gemini
        iteration: Current iteration number (0 for initial)
        error_message: Error details (if success=False)
    """
    success: bool
    image_base64: Optional[str] = None
    text_response: Optional[str] = None
    iteration: int = 0
    error_message: Optional[str] = None


def get_max_iterations() -> int:
    """Get maximum iterations from environment variable.

    Returns:
        int: Maximum iterations (default: 3)
    """
    try:
        return int(os.environ.get("DIAGRAM_MAX_ITERATIONS", "3"))
    except ValueError:
        logger.warning("Invalid DIAGRAM_MAX_ITERATIONS value, using default 3")
        return 3


class GeminiDiagramChat:
    """Multi-turn chat session for iterative diagram generation.

    Maintains chat context across refinement iterations, allowing
    Gemini to understand and apply visual critique feedback.

    Usage:
        chat = GeminiDiagramChat()
        result = chat.start_session("Create a right triangle diagram...")
        if result.success:
            # Initial generation succeeded
            while needs_refinement:
                result = chat.refine("Add more padding around edges...")

    Configuration:
        Set DIAGRAM_MAX_ITERATIONS in .env to control max refinement attempts.
        Default: 3
    """

    def __init__(
        self,
        model: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        image_size: Optional[str] = None,
        max_iterations: Optional[int] = None
    ):
        """Initialize Gemini diagram chat session.

        Args:
            model: Gemini model ID (default from env)
            aspect_ratio: Image aspect ratio (default from env)
            image_size: Image resolution (default from env)
            max_iterations: Maximum refinement iterations (default from env: 3)
        """
        config = get_gemini_config()

        self.model = model or config["model"]
        self.aspect_ratio = aspect_ratio or config["aspect_ratio"]
        self.image_size = image_size or config["image_size"]
        self.MAX_ITERATIONS = max_iterations or get_max_iterations()

        self.client = None  # Lazy initialization
        self.chat = None
        self.iteration_count = 0

        logger.info(
            f"GeminiDiagramChat initialized: model={self.model}, "
            f"aspect_ratio={self.aspect_ratio}, image_size={self.image_size}, "
            f"max_iterations={self.MAX_ITERATIONS}"
        )

    def _ensure_client(self):
        """Ensure Gemini client is initialized (lazy loading)."""
        if self.client is None:
            self.client = get_gemini_client()

    def _create_generate_config(self):
        """Create GenerateContentConfig for image generation."""
        from google.genai import types

        # For gemini-*-image models, use IMAGE-only response modality
        # (these models don't support TEXT+IMAGE together)
        return types.GenerateContentConfig(
            response_modalities=['IMAGE'],
        )

    def _extract_image_from_response(self, response) -> Optional[str]:
        """Extract base64-encoded image from Gemini response.

        Args:
            response: Gemini GenerateContentResponse

        Returns:
            Base64-encoded PNG string, or None if no image found
        """
        for part in response.parts:
            # Check for image data using google.genai.types.Image
            image = part.as_image() if hasattr(part, 'as_image') else None
            if image is not None:
                # google.genai.types.Image has image_bytes property directly
                # No need to use PIL - just encode the raw bytes
                image_bytes = image.image_bytes
                if image_bytes:
                    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    logger.debug(f"Extracted image: {len(image_base64)} chars base64")
                    return image_base64

        return None

    def _extract_text_from_response(self, response) -> Optional[str]:
        """Extract text content from Gemini response.

        Args:
            response: Gemini GenerateContentResponse

        Returns:
            Combined text from all text parts, or None if no text
        """
        texts = []
        for part in response.parts:
            if hasattr(part, 'text') and part.text is not None:
                texts.append(part.text)

        return "\n".join(texts) if texts else None

    def start_session(self, prompt: str) -> GenerationResult:
        """Start new diagram generation session.

        Generates initial diagram using models.generate_content.
        Stores the conversation history for subsequent refinements.
        Resets iteration counter.

        Args:
            prompt: Natural language description of desired diagram

        Returns:
            GenerationResult with initial image or error details

        Raises:
            GeminiGenerationError: If generation fails completely
        """
        self._ensure_client()
        self.iteration_count = 0

        # Initialize conversation history for refinement
        self._conversation_history = [prompt]

        logger.info(f"Starting Gemini diagram session with prompt: {prompt[:100]}...")

        try:
            # Use models.generate_content for image generation
            # (chat API doesn't work with gemini-*-image models)
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=self._create_generate_config()
            )

            # Extract results
            image_base64 = self._extract_image_from_response(response)
            text_response = self._extract_text_from_response(response)

            if image_base64:
                logger.info("Initial diagram generation successful")
                return GenerationResult(
                    success=True,
                    image_base64=image_base64,
                    text_response=text_response,
                    iteration=0
                )
            else:
                error_msg = (
                    f"Gemini did not return an image. "
                    f"Text response: {text_response or 'None'}"
                )
                logger.warning(error_msg)
                return GenerationResult(
                    success=False,
                    text_response=text_response,
                    iteration=0,
                    error_message=error_msg
                )

        except Exception as e:
            error_msg = f"Failed to generate initial diagram: {e}"
            logger.error(error_msg)
            raise GeminiGenerationError(error_msg) from e

    def refine(self, critique_feedback: str) -> GenerationResult:
        """Refine the diagram based on visual critique feedback.

        Generates a new diagram incorporating the feedback.
        Since we can't use chat history with image models, we combine
        the original prompt with refinement feedback in a new request.

        Args:
            critique_feedback: Natural language feedback describing
                what needs to be improved (e.g., "Add more padding",
                "Make labels larger", "Use darker colors")

        Returns:
            GenerationResult with refined image or error details

        Raises:
            GeminiIterationLimitError: If max iterations exceeded
            GeminiRefinementError: If refinement fails
        """
        if not hasattr(self, '_conversation_history') or not self._conversation_history:
            raise GeminiRefinementError(
                "No active session. Call start_session() first."
            )

        self.iteration_count += 1

        if self.iteration_count > self.MAX_ITERATIONS:
            error_msg = (
                f"Maximum iterations ({self.MAX_ITERATIONS}) exceeded. "
                f"Consider accepting the current result or restarting."
            )
            logger.error(error_msg)
            raise GeminiIterationLimitError(error_msg)

        logger.info(
            f"Refinement iteration {self.iteration_count}/{self.MAX_ITERATIONS}: "
            f"{critique_feedback[:100]}..."
        )

        try:
            # Combine original prompt with refinement feedback
            # (since we can't use chat history with image-only models)
            original_prompt = self._conversation_history[0]
            refinement_prompt = (
                f"{original_prompt}\n\n"
                f"REFINEMENT FEEDBACK (iteration {self.iteration_count}):\n"
                f"{critique_feedback}\n\n"
                f"Generate an improved version addressing the feedback above."
            )

            # Generate refined diagram
            response = self.client.models.generate_content(
                model=self.model,
                contents=refinement_prompt,
                config=self._create_generate_config()
            )

            # Extract results
            image_base64 = self._extract_image_from_response(response)
            text_response = self._extract_text_from_response(response)

            if image_base64:
                logger.info(f"Refinement iteration {self.iteration_count} successful")
                return GenerationResult(
                    success=True,
                    image_base64=image_base64,
                    text_response=text_response,
                    iteration=self.iteration_count
                )
            else:
                error_msg = (
                    f"Refinement did not produce an image. "
                    f"Text: {text_response or 'None'}"
                )
                logger.warning(error_msg)
                return GenerationResult(
                    success=False,
                    text_response=text_response,
                    iteration=self.iteration_count,
                    error_message=error_msg
                )

        except GeminiIterationLimitError:
            raise  # Re-raise iteration limit errors
        except Exception as e:
            error_msg = f"Refinement iteration {self.iteration_count} failed: {e}"
            logger.error(error_msg)
            raise GeminiRefinementError(error_msg) from e

    def refine_with_image(
        self,
        correction_prompt: str,
        input_image_path: str
    ) -> GenerationResult:
        """Refine diagram using image-to-image with the original as reference.

        Sends the original image along with the correction prompt to Gemini,
        enabling true image-to-image refinement where Gemini can see what
        needs to be fixed.

        Args:
            correction_prompt: Detailed correction prompt from visual critic
                (describes what to fix and what to keep)
            input_image_path: Path to the original image to refine

        Returns:
            GenerationResult with refined image or error details

        Raises:
            GeminiIterationLimitError: If max iterations exceeded
            GeminiRefinementError: If refinement fails
            FileNotFoundError: If input image not found
        """
        self._ensure_client()

        # Initialize iteration tracking if not started
        if not hasattr(self, '_conversation_history'):
            self._conversation_history = []

        self.iteration_count += 1

        if self.iteration_count > self.MAX_ITERATIONS:
            error_msg = (
                f"Maximum iterations ({self.MAX_ITERATIONS}) exceeded. "
                f"Consider accepting the current result or restarting."
            )
            logger.error(error_msg)
            raise GeminiIterationLimitError(error_msg)

        # Load the input image
        input_path = Path(input_image_path)
        if not input_path.exists():
            raise FileNotFoundError(f"Input image not found: {input_image_path}")

        image_bytes = input_path.read_bytes()

        logger.info(
            f"Image-to-image refinement iteration {self.iteration_count}/{self.MAX_ITERATIONS}"
        )
        logger.info(f"Input image: {input_image_path} ({len(image_bytes)} bytes)")
        logger.info(f"Correction prompt: {correction_prompt[:200]}...")

        try:
            from google.genai import types

            # Create image part from bytes
            image_part = types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/png"
            )

            # Build multi-modal content: image + correction prompt
            contents = [
                image_part,
                correction_prompt
            ]

            # Generate refined diagram with image input
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=self._create_generate_config()
            )

            # Extract results
            image_base64 = self._extract_image_from_response(response)
            text_response = self._extract_text_from_response(response)

            if image_base64:
                logger.info(
                    f"Image-to-image refinement iteration {self.iteration_count} successful"
                )
                return GenerationResult(
                    success=True,
                    image_base64=image_base64,
                    text_response=text_response,
                    iteration=self.iteration_count
                )
            else:
                error_msg = (
                    f"Image-to-image refinement did not produce an image. "
                    f"Text: {text_response or 'None'}"
                )
                logger.warning(error_msg)
                return GenerationResult(
                    success=False,
                    text_response=text_response,
                    iteration=self.iteration_count,
                    error_message=error_msg
                )

        except GeminiIterationLimitError:
            raise
        except Exception as e:
            error_msg = (
                f"Image-to-image refinement iteration {self.iteration_count} failed: {e}"
            )
            logger.error(error_msg)
            raise GeminiRefinementError(error_msg) from e

    def get_iteration_count(self) -> int:
        """Get current iteration count."""
        return self.iteration_count

    def is_at_limit(self) -> bool:
        """Check if at maximum iterations."""
        return self.iteration_count >= self.MAX_ITERATIONS

    def reset(self):
        """Reset session for new diagram.

        Clears the conversation history and resets iteration counter.
        """
        self._conversation_history = []
        self.iteration_count = 0
        logger.debug("GeminiDiagramChat session reset")


def save_diagram_image(
    image_base64: str,
    card_id: str,
    diagram_context: str,
    workspace_path: str,
    diagram_index: int = 0
) -> str:
    """Save base64 diagram image to workspace.

    Creates the diagrams directory if needed and saves the PNG file.

    Args:
        image_base64: Base64-encoded PNG image
        card_id: Card ID for filename
        diagram_context: Context type ("lesson" or "cfu")
        workspace_path: Path to workspace directory
        diagram_index: Index for multiple diagrams (default 0)

    Returns:
        Absolute path to saved PNG file

    Raises:
        ValueError: If image_base64 is empty
        OSError: If file cannot be written
    """
    if not image_base64:
        raise ValueError("image_base64 cannot be empty")

    # Create diagrams directory
    diagrams_dir = Path(workspace_path) / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename
    filename = f"{card_id}_{diagram_context}_{diagram_index}.png"
    filepath = diagrams_dir / filename

    # Decode and save
    try:
        image_bytes = base64.b64decode(image_base64)
        filepath.write_bytes(image_bytes)
        logger.info(f"Saved diagram to: {filepath}")
        return str(filepath.absolute())

    except Exception as e:
        error_msg = f"Failed to save diagram image to {filepath}: {e}"
        logger.error(error_msg)
        raise OSError(error_msg) from e


def load_diagram_image(filepath: str) -> str:
    """Load diagram image as base64.

    Args:
        filepath: Path to PNG file

    Returns:
        Base64-encoded PNG string

    Raises:
        FileNotFoundError: If file doesn't exist
        OSError: If file cannot be read
    """
    path = Path(filepath)

    if not path.exists():
        raise FileNotFoundError(f"Diagram file not found: {filepath}")

    try:
        image_bytes = path.read_bytes()
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        logger.debug(f"Loaded diagram from: {filepath} ({len(image_base64)} chars)")
        return image_base64

    except Exception as e:
        error_msg = f"Failed to load diagram image from {filepath}: {e}"
        logger.error(error_msg)
        raise OSError(error_msg) from e
