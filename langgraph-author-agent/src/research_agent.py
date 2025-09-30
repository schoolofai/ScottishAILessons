import os
from typing import Literal

from tavily import TavilyClient

from deepagents import create_deep_agent

# Use absolute import with try/except for both installed package and direct file loading
try:
    from src.prompts import SUB_RESEARCH_PROMPT, SUB_CRITIQUE_PROMPT, RESEARCH_INSTRUCTIONS_SQA
except ImportError:
    from prompts import SUB_RESEARCH_PROMPT, SUB_CRITIQUE_PROMPT, RESEARCH_INSTRUCTIONS_SQA

# It's best practice to initialize the client once and reuse it.
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

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

critique_sub_agent = {
    "name": "critique-agent",
    "description": "Used to critique the final report. Give this agent some information about how you want it to critique the report.",
    "prompt": SUB_CRITIQUE_PROMPT,
}


# Create the agent
agent = create_deep_agent(
    tools=[internet_search],
    instructions=RESEARCH_INSTRUCTIONS_SQA,
    subagents=[critique_sub_agent, research_sub_agent],
).with_config({"recursion_limit": 1000})
