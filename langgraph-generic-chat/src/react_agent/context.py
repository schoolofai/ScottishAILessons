"""Define the configurable parameters for the context-aware agent."""

from __future__ import annotations

import os
from dataclasses import dataclass, field, fields
from typing import Annotated

from . import prompts


@dataclass
class Context:
    """The context for the context-aware learning assistant agent."""

    # Core prompts for different context scenarios
    system_prompt_with_context: str = field(
        default=prompts.SYSTEM_PROMPT_WITH_CONTEXT,
        metadata={
            "description": "System prompt when teaching context is available"
        }
    )

    system_prompt_no_context: str = field(
        default=prompts.SYSTEM_PROMPT_NO_CONTEXT,
        metadata={
            "description": "System prompt when no teaching context is provided"
        }
    )

    system_prompt_degraded_context: str = field(
        default=prompts.SYSTEM_PROMPT_DEGRADED_CONTEXT,
        metadata={
            "description": "System prompt when context is incomplete or malformed"
        }
    )

    # Legacy compatibility
    system_prompt: str = field(
        default=prompts.SYSTEM_PROMPT_NO_CONTEXT,
        metadata={
            "description": "Default system prompt for backward compatibility"
        }
    )

    # LLM configuration
    model: Annotated[str, {"__template_metadata__": {"kind": "llm"}}] = field(
        default="anthropic/claude-3-5-sonnet-20240620",
        metadata={
            "description": "Language model for context-aware chat responses. "
            "Should be in the form: provider/model-name."
        }
    )

    # Search configuration
    max_search_results: int = field(
        default=5,
        metadata={
            "description": "Max search results (reduced for context chat to focus quality)"
        }
    )

    enable_context_search_enhancement: bool = field(
        default=True,
        metadata={
            "description": "Whether to enhance search queries with lesson context"
        }
    )

    # Context processing configuration
    max_recent_exchanges: int = field(
        default=5,
        metadata={
            "description": "Number of recent teaching exchanges to include in context"
        }
    )

    context_quality_threshold: float = field(
        default=0.3,
        metadata={
            "description": "Minimum quality score to use full context prompt (0.0-1.0)"
        }
    )

    enable_proactive_help: bool = field(
        default=True,
        metadata={
            "description": "Proactively suggest help based on detected struggles"
        }
    )

    # Educational specialization
    enable_math_specialization: bool = field(
        default=True,
        metadata={
            "description": "Enable specialized mathematics education features"
        }
    )

    enable_interactive_resources: bool = field(
        default=True,
        metadata={
            "description": "Enable search for interactive educational resources"
        }
    )

    # Error handling configuration
    enable_graceful_degradation: bool = field(
        default=True,
        metadata={
            "description": "Gracefully degrade when context is unavailable instead of failing"
        }
    )

    max_context_processing_timeout: int = field(
        default=10,
        metadata={
            "description": "Maximum seconds to spend processing teaching context"
        }
    )

    # Response customization
    response_style: str = field(
        default="supportive",
        metadata={
            "description": "Response style: 'supportive', 'concise', or 'detailed'"
        }
    )

    max_response_length: int = field(
        default=800,
        metadata={
            "description": "Maximum characters in context chat responses"
        }
    )

    def __post_init__(self) -> None:
        """Fetch env vars for attributes that were not passed as args."""
        for f in fields(self):
            if not f.init:
                continue

            if getattr(self, f.name) == f.default:
                setattr(self, f.name, os.environ.get(f.name.upper(), f.default))
