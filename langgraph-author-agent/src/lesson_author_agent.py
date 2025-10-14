"""Lesson Author DeepAgent - Orchestrates 2 subagents to produce LessonTemplate JSON documents for Scottish secondary education."""

import os
import logging
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

# Configure logging
logger = logging.getLogger(__name__)

# Dual-import pattern for prompts
try:
    from src.lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        COMBINED_LESSON_CRITIC_PROMPT
    )
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
except ImportError:
    from lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        COMBINED_LESSON_CRITIC_PROMPT
    )
    from research_agent_prompts import SUB_RESEARCH_PROMPT

# Import tool utilities (Tavily + Appwrite MCP)
try:
    from src.sow_author_tools import (
        internet_search,
        appwrite_tools,
        all_tools,
        internet_only_tools,
        appwrite_only_tools,
        APPWRITE_AVAILABLE
    )
except ImportError:
    from sow_author_tools import (
        internet_search,
        appwrite_tools,
        all_tools,
        internet_only_tools,
        appwrite_only_tools,
        APPWRITE_AVAILABLE
    )

# Import model factory for dynamic model selection
try:
    from src.model_factory import get_model
except ImportError:
    from model_factory import get_model

# Initialize model dynamically based on LESSON_MODEL_VERSION env var
# Supports: gemini-2.5-pro, gemini-flash-lite, llama models, etc.
# Special case: "default" uses Anthropic Claude (no model_factory)
# Fails fast with detailed error if LESSON_MODEL_VERSION not set or invalid

lesson_model_version = os.getenv("LESSON_MODEL_VERSION", "")

if lesson_model_version == "default":
    # Skip model factory - let DeepAgents use default Anthropic Claude
    # This requires ANTHROPIC_API_KEY to be set in .env
    logger.info("🤖 Using default Anthropic Claude model (LESSON_MODEL_VERSION=default)")
    logger.info("⚠️  Ensure ANTHROPIC_API_KEY is set in .env")
    model = None  # Signal to skip model parameter
elif not lesson_model_version:
    # Fast fail if env var not set at all
    error_msg = (
        "LESSON_MODEL_VERSION environment variable is required. "
        "Set to 'default' for Anthropic Claude, or choose from available models."
    )
    logger.error(error_msg)
    raise ValueError(error_msg)
else:
    # Use model factory for custom models (Gemini, Ollama, etc.)
    logger.info(f"🤖 Using custom model from model_factory: {lesson_model_version}")
    model = get_model()
# =============================================================================
# SUBAGENT CONFIGURATIONS
# =============================================================================

# 1. Research Subagent - Answers clarification questions with Scottish context (REUSED)
research_subagent = {
    "name": "research_subagent",
    "description": "Answer clarification questions with Scotland-specific information (policy notes, pedagogical patterns, URL lookups). No file writes unless explicitly asked.",
    "prompt": SUB_RESEARCH_PROMPT,
    "tools": internet_only_tools  # Internet search only
}

# 2. Combined Lesson Critic - Evaluates all quality dimensions
combined_lesson_critic = {
    "name": "combined_lesson_critic",
    "description": "Evaluates lesson template across 5 dimensions: pedagogical design (I-We-You, scaffolding), assessment design (CFU variety, rubrics, misconceptions), accessibility (plain language, dyslexia-friendly), Scottish context (£ currency, SQA terminology, local examples), and coherence (outcome mapping, timing, policy alignment). Uses weighted scoring (ped: 0.20, assess: 0.25, access: 0.20, scottish: 0.20, coherence: 0.15) with threshold ≥0.88 overall and all dimensional thresholds met.",
    "prompt": COMBINED_LESSON_CRITIC_PROMPT,
    "tools": internet_only_tools  # Internet search for research and validation
}


# =============================================================================
# MAIN LESSON AUTHOR DEEPAGENT
# =============================================================================

# Create the Lesson Author DeepAgent with 2 subagents (Course_data.txt pre-fetched by seeding script)
# Main agent now directly authors lessons, with targeted subagents for research and critique

# Create agent with conditional model parameter
if model is None:
    # Default: Use DeepAgents' built-in Anthropic Claude (no model param)
    agent = create_deep_agent(
        tools=internet_only_tools,  # Internet search for orchestration
        instructions=LESSON_AGENT_PROMPT,
        subagents=[
            research_subagent,
            combined_lesson_critic
        ]
    ).with_config({"recursion_limit": 1000})
else:
    # Custom: Use model from model_factory (Gemini, Ollama, etc.)
    agent = create_deep_agent(
        model=model,  # Dynamic model from model_factory (supports Gemini + Ollama)
        tools=internet_only_tools,  # Internet search for orchestration
        instructions=LESSON_AGENT_PROMPT,
        subagents=[
            research_subagent,
            combined_lesson_critic
        ]
    ).with_config({"recursion_limit": 1000})
