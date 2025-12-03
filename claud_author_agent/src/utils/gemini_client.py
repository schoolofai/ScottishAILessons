"""Gemini API client for Nano Banana Pro image generation.

Provides singleton client initialization and configuration for Gemini's
image generation capabilities. Used by diagram_author_nano for direct
PNG generation from natural language prompts.

Fast-fail principles:
- Missing GEMINI_API_KEY raises GeminiAPIError immediately
- No fallback mechanisms - explicit errors for debugging
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class GeminiAPIError(Exception):
    """Fast-fail exception for Gemini API issues.

    All Gemini-related errors should raise this exception to ensure
    explicit failure with detailed error messages for debugging.
    """
    pass


class GeminiConfigurationError(GeminiAPIError):
    """Raised when Gemini configuration is invalid or missing."""
    pass


# Module-level singleton for the Gemini client
_gemini_client: Optional[object] = None


def get_gemini_client():
    """Get or create singleton Gemini client.

    Fast-fails if GEMINI_API_KEY environment variable is not set.
    Uses google.genai.Client for Gemini API access.

    Returns:
        google.genai.Client: Configured Gemini client instance

    Raises:
        GeminiConfigurationError: If GEMINI_API_KEY is missing
        GeminiAPIError: If client initialization fails
    """
    global _gemini_client

    if _gemini_client is not None:
        logger.debug("Returning existing Gemini client singleton")
        return _gemini_client

    # Fast-fail: require GEMINI_API_KEY
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        error_msg = (
            "GEMINI_API_KEY environment variable is not set. "
            "Please add GEMINI_API_KEY to your .env file. "
            "Get your API key from: https://aistudio.google.com/app/apikey"
        )
        logger.error(f"GeminiConfigurationError: {error_msg}")
        raise GeminiConfigurationError(error_msg)

    # Validate API key format (basic sanity check)
    if len(api_key) < 20:
        error_msg = (
            f"GEMINI_API_KEY appears invalid (length={len(api_key)}). "
            "Expected a valid API key from Google AI Studio."
        )
        logger.error(f"GeminiConfigurationError: {error_msg}")
        raise GeminiConfigurationError(error_msg)

    try:
        from google import genai

        logger.info("Initializing Gemini client with API key")
        _gemini_client = genai.Client(api_key=api_key)
        logger.info("Gemini client initialized successfully")

        return _gemini_client

    except ImportError as e:
        error_msg = (
            f"Failed to import google.genai: {e}. "
            "Please install: pip install google-genai>=0.7.0"
        )
        logger.error(f"GeminiAPIError: {error_msg}")
        raise GeminiAPIError(error_msg) from e

    except Exception as e:
        error_msg = f"Failed to initialize Gemini client: {e}"
        logger.error(f"GeminiAPIError: {error_msg}")
        raise GeminiAPIError(error_msg) from e


def get_gemini_config() -> dict:
    """Get Gemini configuration from environment variables.

    Returns configuration dictionary with model settings.
    Uses sensible defaults for educational diagram generation.

    Returns:
        dict: Configuration with keys:
            - model: Gemini model ID for image generation
            - critique_model: Gemini model ID for visual critique (vision+text)
            - aspect_ratio: Image aspect ratio (16:9 for educational content)
            - image_size: Output image resolution

    Environment Variables:
        GEMINI_IMAGE_MODEL: Model ID for generation (default: gemini-2.5-flash-image)
        GEMINI_CRITIQUE_MODEL: Model ID for critique (default: gemini-3-pro-preview)
        GEMINI_IMAGE_ASPECT_RATIO: Aspect ratio (default: 16:9)
        GEMINI_IMAGE_SIZE: Image size (default: 2K)
    """
    config = {
        "model": os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image"),
        "critique_model": os.getenv("GEMINI_CRITIQUE_MODEL", "gemini-3-pro-preview"),
        "aspect_ratio": os.getenv("GEMINI_IMAGE_ASPECT_RATIO", "16:9"),
        "image_size": os.getenv("GEMINI_IMAGE_SIZE", "2K")
    }

    logger.debug(f"Gemini config: model={config['model']}, "
                 f"critique_model={config['critique_model']}, "
                 f"aspect_ratio={config['aspect_ratio']}, "
                 f"image_size={config['image_size']}")

    return config


def validate_gemini_availability() -> bool:
    """Validate that Gemini API is available and configured.

    Performs a lightweight check without making API calls.
    Use this for pre-flight validation before starting diagram generation.

    Returns:
        bool: True if Gemini appears to be configured correctly

    Raises:
        GeminiConfigurationError: If configuration is invalid
    """
    # Check API key is present
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY environment variable is not set"
        )

    # Check google.genai is importable
    try:
        from google import genai
        from google.genai import types
        logger.debug("google.genai package is available")
    except ImportError as e:
        raise GeminiConfigurationError(
            f"google.genai package not installed: {e}. "
            "Install with: pip install google-genai>=0.7.0"
        ) from e

    logger.info("Gemini API availability validated successfully")
    return True


def reset_client():
    """Reset the singleton client (useful for testing).

    Clears the cached client instance, forcing re-initialization
    on next get_gemini_client() call.
    """
    global _gemini_client
    _gemini_client = None
    logger.debug("Gemini client singleton reset")
