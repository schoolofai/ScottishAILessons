import os
from typing import Literal

from tavily import TavilyClient
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient

from deepagents import create_deep_agent

# Use absolute import with try/except for both installed package and direct file loading
try:
    from src.research_agent_prompts import (
        SUB_RESEARCH_PROMPT,
        RESEARCH_INSTRUCTIONS_SQA,
        SUB_CRITIC_COVERAGE,
        SUB_CRITIC_SOURCE_QUALITY,
        SUB_CRITIC_AUTHENTICITY,
        SUB_CRITIC_PEDAGOGY
    )
except ImportError:
    from research_agent_prompts import (
        SUB_RESEARCH_PROMPT,
        RESEARCH_INSTRUCTIONS_SQA,
        SUB_CRITIC_COVERAGE,
        SUB_CRITIC_SOURCE_QUALITY,
        SUB_CRITIC_AUTHENTICITY,
        SUB_CRITIC_PEDAGOGY
    )

# It's best practice to initialize the client once and reuse it.
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

# Initialize Gemini model
gemini = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    api_key=os.environ["GOOGLE_API_KEY"],
    temperature=0.7,
)

# Search tool to use to do research
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


research_sub_agent = {
    "name": "research-agent",
    "description": "Used to research more in depth questions. Only give this researcher one topic at a time. Do not pass multiple sub questions to this researcher. Instead, you should break down a large topic into the necessary components, and then call multiple research agents in parallel, one for each sub question.",
    "prompt": SUB_RESEARCH_PROMPT,
    "tools": [internet_search],
}

coverage_critic_sub_agent = {
    "name": "coverage-critic",
    "description": "Evaluates completeness and representativeness of research pack. Checks exemplars breadth, balance, metadata sufficiency, and source diversity (≥0.90 threshold).",
    "prompt": SUB_CRITIC_COVERAGE,
    "tools": [internet_search],
}

source_quality_critic_sub_agent = {
    "name": "source-quality-critic",
    "description": "Assesses authority, recency, and reliability of sources. Prioritizes SQA, Education Scotland, GTCS, and Scottish schools (≥0.80 threshold).",
    "prompt": SUB_CRITIC_SOURCE_QUALITY,
    "tools": [internet_search],
}

authenticity_critic_sub_agent = {
    "name": "authenticity-critic",
    "description": "Validates Scottish context and terminology. Ensures Scottish/UK English, £ currency, CfE/SQA alignment, and realistic Scottish contexts (≥0.90 threshold).",
    "prompt": SUB_CRITIC_AUTHENTICITY,
    "tools": [internet_search],
}

pedagogy_critic_sub_agent = {
    "name": "pedagogy-critic",
    "description": "Judges author usability for SoW and lesson construction. Evaluates actionability, CFU variety, and rubric support (≥0.90 threshold).",
    "prompt": SUB_CRITIC_PEDAGOGY,
    "tools": [internet_search],
}


# Create the agent
agent = create_deep_agent(
    model=gemini,
    tools=[internet_search],
    instructions=RESEARCH_INSTRUCTIONS_SQA,
    subagents=[
        research_sub_agent,
        coverage_critic_sub_agent,
        source_quality_critic_sub_agent,
        authenticity_critic_sub_agent,
        pedagogy_critic_sub_agent,
    ],
).with_config({"recursion_limit": 1000})
