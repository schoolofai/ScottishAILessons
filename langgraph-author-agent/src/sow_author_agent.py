"""SoW Author DeepAgent - Directly authors schema-compliant Scheme of Work JSON documents for Scottish secondary education.

This refactored architecture reduces complexity by:
- Main agent directly authors SoW (no author subagent delegation)
- Single unified_critic validates all dimensions in one pass (replaces 5 individual critics)
- 2 subagents total: research_subagent + unified_critic (down from 7)
- 62% reduction in components while maintaining full validation coverage
"""

import os

from langchain_google_genai import ChatGoogleGenerativeAI
from deepagents import async_create_deep_agent

# Dual-import pattern for custom state schema
try:
    from src.sow_author_state import SowAuthorState
except ImportError:
    from sow_author_state import SowAuthorState

# Dual-import pattern for prompts
# Using refactored prompts with full content preserved (~3000 tokens for author)
# No progressive disclosure - organizational refactoring only with DRY principles
try:
    from src.sow_author_prompts import (
        SOW_AGENT_PROMPT,      # Assembled from 5 layers: role, process, schema, workflows, quality
        CRITIC_PROMPT           # Assembled from 8 layers: role, process, 5 dimensions, scoring
    )
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
except ImportError:
    from sow_author_prompts import (
        SOW_AGENT_PROMPT,
        CRITIC_PROMPT
    )
    from research_agent_prompts import SUB_RESEARCH_PROMPT

# Import tool utilities (Tavily + Appwrite MCP)
# Note: Refactored architecture uses all_tools for all subagents
# (internet_only_tools and appwrite_only_tools no longer needed)
try:
    from src.sow_author_tools import all_tools
except ImportError:
    from sow_author_tools import all_tools

# Initialize Gemini model
gemini = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)


# =============================================================================
# SUBAGENT CONFIGURATIONS
# =============================================================================

# 1. Research Subagent - Answers clarification questions with Scottish context
research_subagent = {
    "name": "research_subagent",
    "description": "Answer clarification questions with Scotland-specific information (policy notes, sequencing hints, example contexts). No file writes unless explicitly asked.",
    "prompt": SUB_RESEARCH_PROMPT,
    "tools": all_tools  # Tavily + Appwrite
}

# 2. Unified Critic - Comprehensive validation across all dimensions
unified_critic = {
    "name": "unified_critic",
    "description": "Comprehensively validate the authored SoW across all dimensions (Coverage, Sequencing, Policy, Accessibility, Authenticity) in a single pass. Writes sow_critic_result_json with dimensional scores, pass/fail status, and prioritized todos.",
    "prompt": CRITIC_PROMPT,  # Assembled from 8 layers with full validation criteria
    "tools": all_tools  # Tavily + Appwrite for comprehensive validation
}


# =============================================================================
# MAIN SoW DEEPAGENT
# =============================================================================

# Create the SoW Author DeepAgent with 2 subagents (research + unified critic)
# Uses custom state schema with todos reducer (preserved for compatibility, though less critical with single critic)
# Architecture: Main agent directly authors SoW, then calls unified_critic for comprehensive validation
# NOTE: course data must be pre-populated before agent execution
# REFACTORED: Using modular prompt architecture with DRY principles (full content preserved)
agent = async_create_deep_agent(
    model=gemini,
    tools=all_tools,  # Tavily + Appwrite for full orchestration capability
    instructions=SOW_AGENT_PROMPT,  # Assembled from 5 semantic layers with XML structure preserved
    subagents=[
        research_subagent,
        unified_critic
    ],
    context_schema=SowAuthorState,  # Custom state with todos reducer (preserved for compatibility)
).with_config({"recursion_limit": 1000})
