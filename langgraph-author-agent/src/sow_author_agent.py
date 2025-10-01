"""SoW Author DeepAgent - Orchestrates 8 subagents to produce schema-compliant Scheme of Work JSON documents for Scottish secondary education."""

import os
from typing import Literal

from tavily import TavilyClient
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient

from deepagents import create_deep_agent

# Dual-import pattern for prompts
try:
    from src.sow_author_prompts import (
        SOW_AGENT_PROMPT,
        SOW_AUTHOR_SUBAGENT_PROMPT,
        SOW_COVERAGE_CRITIC_PROMPT,
        SOW_SEQUENCING_CRITIC_PROMPT,
        SOW_POLICY_CRITIC_PROMPT,
        SOW_ACCESSIBILITY_CRITIC_PROMPT,
        SOW_AUTHENTICITY_CRITIC_PROMPT
    )
    from src.research_agent_prompts import SUB_RESEARCH_PROMPT
    from src.shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT
except ImportError:
    from sow_author_prompts import (
        SOW_AGENT_PROMPT,
        SOW_AUTHOR_SUBAGENT_PROMPT,
        SOW_COVERAGE_CRITIC_PROMPT,
        SOW_SEQUENCING_CRITIC_PROMPT,
        SOW_POLICY_CRITIC_PROMPT,
        SOW_ACCESSIBILITY_CRITIC_PROMPT,
        SOW_AUTHENTICITY_CRITIC_PROMPT
    )
    from research_agent_prompts import SUB_RESEARCH_PROMPT
    from shared_prompts import COURSE_OUTCOME_SUBAGENT_PROMPT

# Initialize Tavily client for internet search
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

# Initialize Gemini model
gemini = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)

# Search tool to use for research
def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search"""
    search_docs = tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
    return search_docs


# =============================================================================
# SUBAGENT CONFIGURATIONS
# =============================================================================

# 1. Research Subagent - Answers clarification questions with Scottish context
research_subagent = {
    "name": "research_subagent",
    "description": "Answer clarification questions with Scotland-specific information (policy notes, sequencing hints, example contexts). No file writes unless explicitly asked.",
    "prompt": SUB_RESEARCH_PROMPT,
    "tools": [internet_search]
}

# 2. Course Outcome Subagent - Proposes coherent unit/block structure
course_outcome_subagent = {
    "name": "course_outcome_subagent",
    "description": "Propose consistent unit/block labels and simple indices for entries[].coherence (e.g., unit 'Number & Proportion', block_name 'Percents', block_index '2.1'). Do not fabricate formal SQA codes.",
    "prompt": COURSE_OUTCOME_SUBAGENT_PROMPT,
    "tools": []
}

# 3. SoW Author Subagent - Drafts and revises the SoW JSON document
sow_author_subagent = {
    "name": "sow_author_subagent",
    "description": "Draft/edit the SoW according to the schema defined in <schema_sow_with_field_descriptions> and write it to authored_sow_json.",
    "prompt": SOW_AUTHOR_SUBAGENT_PROMPT,
    "tools": []
}

# 4. Coverage Critic - Evaluates breadth and completeness
sow_coverage_critic = {
    "name": "sow_coverage_critic",
    "description": "Evaluates completeness and representativeness of SoW. Checks exemplars breadth, balance, metadata sufficiency (≥0.90 threshold).",
    "prompt": SOW_COVERAGE_CRITIC_PROMPT,
    "tools": [internet_search]
}

# 5. Sequencing Critic - Validates logical ordering
sow_sequencing_critic = {
    "name": "sow_sequencing_critic",
    "description": "Validates logical ordering of SoW entries. Ensures prerequisites first, realistic lesson_type cadence (≥0.80 threshold).",
    "prompt": SOW_SEQUENCING_CRITIC_PROMPT,
    "tools": [internet_search]
}

# 6. Policy Consistency Critic - Checks policy guardrails
sow_policy_consistency = {
    "name": "sow_policy_consistency",
    "description": "Checks calculator usage staging, assessment cadence, and timing consistency with research policy notes (≥0.80 threshold).",
    "prompt": SOW_POLICY_CRITIC_PROMPT,
    "tools": [internet_search]
}

# 7. Accessibility & Engagement Critic - Reviews accessibility and engagement
sow_accessibility_engage = {
    "name": "sow_accessibility_engage",
    "description": "Reviews plain-language guidance, dyslexia-friendly cues, and authentic engagement/context tags (≥0.90 threshold).",
    "prompt": SOW_ACCESSIBILITY_CRITIC_PROMPT,
    "tools": [internet_search]
}

# 8. Scotland Authenticity Critic - Verifies Scottish context and terminology
sow_authenticity_scotland = {
    "name": "sow_authenticity_scotland",
    "description": "Verifies Scottish authenticity (currency in £, local services, SQA/CfE phrasing, place-based examples).",
    "prompt": SOW_AUTHENTICITY_CRITIC_PROMPT,
    "tools": [internet_search]
}


# =============================================================================
# MAIN SoW DEEPAGENT
# =============================================================================

# Create the SoW Author DeepAgent with all 8 subagents
agent = create_deep_agent(
    model=gemini,
    tools=[internet_search],
    instructions=SOW_AGENT_PROMPT,
    subagents=[
        research_subagent,
        course_outcome_subagent,
        sow_author_subagent,
        sow_coverage_critic,
        sow_sequencing_critic,
        sow_policy_consistency,
        sow_accessibility_engage,
        sow_authenticity_scotland
    ],
).with_config({"recursion_limit": 1000})
