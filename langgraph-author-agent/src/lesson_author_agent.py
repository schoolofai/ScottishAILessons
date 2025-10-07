"""Lesson Author DeepAgent - Orchestrates 7 subagents to produce LessonTemplate JSON documents for Scottish secondary education."""

import os

from langchain_google_genai import ChatGoogleGenerativeAI
from deepagents import async_create_deep_agent

# Dual-import pattern for custom state schema
try:
    from src.lesson_author_state import LessonAuthorState
except ImportError:
    from lesson_author_state import LessonAuthorState

# Dual-import pattern for prompts
try:
    from src.lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        LESSON_AUTHOR_SUBAGENT_PROMPT,
        PEDAGOGICAL_DESIGN_CRITIC_PROMPT,
        ASSESSMENT_DESIGN_CRITIC_PROMPT,
        ACCESSIBILITY_CRITIC_PROMPT,
        SCOTTISH_CONTEXT_CRITIC_PROMPT,
        COHERENCE_CRITIC_PROMPT
    )
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
except ImportError:
    from lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        LESSON_AUTHOR_SUBAGENT_PROMPT,
        PEDAGOGICAL_DESIGN_CRITIC_PROMPT,
        ASSESSMENT_DESIGN_CRITIC_PROMPT,
        ACCESSIBILITY_CRITIC_PROMPT,
        SCOTTISH_CONTEXT_CRITIC_PROMPT,
        COHERENCE_CRITIC_PROMPT
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

# Initialize Gemini model
# Flash-lite for main agent and all subagents (fast, cost-effective)
gemini = ChatGoogleGenerativeAI(
    model="models/gemini-flash-lite-latest",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)


# =============================================================================
# SUBAGENT CONFIGURATIONS
# =============================================================================

# 1. Research Subagent - Answers clarification questions with Scottish context (REUSED)
research_subagent = {
    "name": "research_subagent",
    "description": "Answer clarification questions with Scotland-specific information (policy notes, pedagogical patterns, URL lookups). No file writes unless explicitly asked.",
    "prompt": SUB_RESEARCH_PROMPT,
    "tools": all_tools  # Tavily + Appwrite
}

# 2. Lesson Author Subagent - Drafts and revises the LessonTemplate JSON document
lesson_author_subagent = {
    "name": "lesson_author_subagent",
    "description": "Draft/edit the LessonTemplate according to the schema and write to lesson_template.json. Has internet access for URL lookups and missing information.",
    "prompt": LESSON_AUTHOR_SUBAGENT_PROMPT,
    "tools": all_tools  # Tavily + Appwrite for comprehensive authoring
}

# 3. Pedagogical Design Critic - Evaluates lesson flow and scaffolding
pedagogical_design_critic = {
    "name": "pedagogical_design_critic",
    "description": "Validates I-We-You progression, scaffolding appropriateness, and lesson_type alignment with card types (≥0.85 threshold).",
    "prompt": PEDAGOGICAL_DESIGN_CRITIC_PROMPT,
    "tools": all_tools  # Tavily + Appwrite for validation
}

# 4. Assessment Design Critic - Reviews CFU quality and rubrics
assessment_design_critic = {
    "name": "assessment_design_critic",
    "description": "Reviews CFU variety, rubric criteria clarity, misconception identification, and assessment standards coverage (≥0.90 threshold).",
    "prompt": ASSESSMENT_DESIGN_CRITIC_PROMPT,
    "tools": all_tools  # Tavily + Appwrite for validation
}

# 5. Accessibility Critic - Checks inclusive design
accessibility_critic = {
    "name": "accessibility_critic",
    "description": "Checks plain language (CEFR level), dyslexia-friendly features, extra_time provisions, and explainer_plain fields (≥0.90 threshold).",
    "prompt": ACCESSIBILITY_CRITIC_PROMPT,
    "tools": internet_only_tools  # Tavily only for accessibility research
}

# 6. Scottish Context Critic - Validates Scottish authenticity
scottish_context_critic = {
    "name": "scottish_context_critic",
    "description": "Verifies £ currency, engagement_tags relevance, local context examples (ScotRail, NHS), and SQA/CfE terminology (≥0.90 threshold).",
    "prompt": SCOTTISH_CONTEXT_CRITIC_PROMPT,
    "tools": all_tools  # Tavily + Appwrite for Scottish context validation
}

# 7. Coherence Critic - Ensures SoW alignment
coherence_critic = {
    "name": "coherence_critic",
    "description": "Ensures outcome/assessment standard mapping, lesson_type consistency, timing estimates, and prerequisite handling (≥0.85 threshold).",
    "prompt": COHERENCE_CRITIC_PROMPT,
    "tools": appwrite_only_tools  # Database access for SoW alignment checks
}


# =============================================================================
# MAIN LESSON AUTHOR DEEPAGENT
# =============================================================================

# Create the Lesson Author DeepAgent with 7 subagents
# Course data is now pre-fetched by seeding script (no course_outcome_subagent needed)
# Uses custom state schema with todos reducer to prevent InvalidUpdateError
agent = async_create_deep_agent(
    model=gemini,
    tools=all_tools,  # Tavily + Appwrite for full orchestration capability
    instructions=LESSON_AGENT_PROMPT,
    subagents=[
        research_subagent,
        lesson_author_subagent,
        pedagogical_design_critic,
        assessment_design_critic,
        accessibility_critic,
        scottish_context_critic,
        coherence_critic
    ],
    context_schema=LessonAuthorState,  # Custom state with todos reducer (prevents InvalidUpdateError on concurrent critic updates)
).with_config({"recursion_limit": 1000})
