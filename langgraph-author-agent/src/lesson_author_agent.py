"""Lesson Author DeepAgent - Orchestrates 8 subagents to produce LessonTemplate JSON documents for Scottish secondary education."""

import os
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

# Dual-import pattern for prompts
try:
    from src.lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        LESSON_AUTHOR_SUBAGENT_PROMPT,
        COMBINED_LESSON_CRITIC_PROMPT
    )
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
    from src.shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT
except ImportError:
    from lesson_author_prompts import (
        LESSON_AGENT_PROMPT,
        LESSON_AUTHOR_SUBAGENT_PROMPT,
        COMBINED_LESSON_CRITIC_PROMPT
    )
    from research_agent_prompts import SUB_RESEARCH_PROMPT
    from shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT

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

# Initialize Gemini model using init_chat_model (avoids --allow-blocking flag)

gemini = init_chat_model(
    "gemini-2.5-pro", model_provider="google_genai", temperature=0.7
)
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

# 2. Lesson Author Subagent - Drafts and revises the LessonTemplate JSON document
lesson_author_subagent = {
    "name": "lesson_author_subagent",
    "description": "Draft/edit the LessonTemplate according to the schema and write to lesson_template.json. Has internet access for URL lookups and missing information.",
    "prompt": LESSON_AUTHOR_SUBAGENT_PROMPT,
    "tools": internet_only_tools  # Internet search for URL lookups
}

# 3. Combined Lesson Critic - Evaluates all quality dimensions
combined_lesson_critic = {
    "name": "combined_lesson_critic",
    "description": "Evaluates lesson template across 5 dimensions: pedagogical design (I-We-You, scaffolding), assessment design (CFU variety, rubrics, misconceptions), accessibility (plain language, dyslexia-friendly), Scottish context (£ currency, SQA terminology, local examples), and coherence (outcome mapping, timing, policy alignment). Uses weighted scoring (ped: 0.20, assess: 0.25, access: 0.20, scottish: 0.20, coherence: 0.15) with threshold ≥0.88 overall and all dimensional thresholds met.",
    "prompt": COMBINED_LESSON_CRITIC_PROMPT,
    "tools": internet_only_tools  # Internet search for research and validation
}


# =============================================================================
# MAIN LESSON AUTHOR DEEPAGENT
# =============================================================================

# Create the Lesson Author DeepAgent with 3 subagents (Course_data.txt pre-fetched by seeding script)
# Uses base DeepAgentState automatically (no custom reducer needed with single critic - no concurrent updates)
agent = create_deep_agent(
    model=gemini,
    tools=internet_only_tools,  # Internet search for orchestration
    instructions=LESSON_AGENT_PROMPT,
    subagents=[
        research_subagent,
        lesson_author_subagent,
        combined_lesson_critic
    ]
).with_config({"recursion_limit": 1000})
