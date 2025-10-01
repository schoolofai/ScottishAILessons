"""Tool initialization utilities for SoW Author Agent.

Provides Tavily internet search and Appwrite MCP database tools
for curriculum research and data access.
"""

import os
import asyncio
from typing import Literal

from tavily import TavilyClient
from langchain_mcp_adapters.client import MultiServerMCPClient


# =============================================================================
# TAVILY INTERNET SEARCH TOOL
# =============================================================================

# Initialize Tavily client
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])


def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search using Tavily.

    Args:
        query: Search query string
        max_results: Maximum number of results (default: 5)
        topic: Search topic category (default: "general")
        include_raw_content: Include full page content (default: False)

    Returns:
        Search results from Tavily API
    """
    search_docs = tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
    return search_docs


# =============================================================================
# APPWRITE MCP DATABASE TOOLS
# =============================================================================

def _init_appwrite_tools():
    """Initialize Appwrite MCP tools synchronously for module-level use.

    Runs async MCP initialization at module load time, returning
    synchronous LangChain tool objects.

    Returns:
        List of LangChain BaseTool objects for Appwrite operations

    Raises:
        RuntimeError: If required environment variables missing
        ConnectionError: If MCP server connection fails
    """
    # Validate required environment variables
    required_vars = ["APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"]
    missing = [var for var in required_vars if not os.environ.get(var)]

    if missing:
        raise RuntimeError(
            f"Missing Appwrite env vars: {', '.join(missing)}"
        )

    async def _async_init():
        """Async initialization of MCP client."""
        mcp_servers = {
            "appwrite": {
                "command": "uvx",
                "args": [
                    "mcp-server-appwrite",
                    "--databases",  # Enable databases API
                ],
                "transport": "stdio",
                "env": {
                    "APPWRITE_PROJECT_ID": os.environ["APPWRITE_PROJECT_ID"],
                    "APPWRITE_API_KEY": os.environ["APPWRITE_API_KEY"],
                    "APPWRITE_ENDPOINT": os.environ.get(
                        "APPWRITE_ENDPOINT",
                        "https://cloud.appwrite.io/v1"
                    )
                }
            }
        }

        try:
            mcp_client = MultiServerMCPClient(mcp_servers)
            tools = await mcp_client.get_tools()
            return tools
        except Exception as e:
            raise ConnectionError(f"MCP init failed: {str(e)}") from e

    # Run async init synchronously at module load
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(_async_init())


# Initialize Appwrite tools at module load (runs once when imported)
try:
    appwrite_tools = _init_appwrite_tools()
    APPWRITE_AVAILABLE = True
    print(f"✅ Initialized {len(appwrite_tools)} Appwrite MCP tools")
except (RuntimeError, ConnectionError) as e:
    print(f"⚠️  Appwrite init failed: {e}")
    print("   Agent will run with Tavily search only")
    appwrite_tools = []
    APPWRITE_AVAILABLE = False


# =============================================================================
# EXPORTED TOOL LISTS
# =============================================================================

# Internet search only (lightweight research)
internet_only_tools = [internet_search]

# Appwrite database access only (curriculum data)
appwrite_only_tools = appwrite_tools

# Combined: Tavily + Appwrite (full capability)
all_tools = [internet_search] + appwrite_tools
