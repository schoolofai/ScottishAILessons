import os
import asyncio
from dotenv import load_dotenv

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_google_genai import ChatGoogleGenerativeAI
from deepagents import async_create_deep_agent


async def main():
    """Main function to run the Appwrite Deep Agent."""

    print("🚀 Starting Appwrite Deep Agent...")
    print("=" * 60)

    # 1. Configure MCP server for Appwrite
    # The MCP server will be launched via stdio transport using uvx
    mcp_servers = {
        "appwrite": {
            "command": "uvx",
            "args": [
                "mcp-server-appwrite",
                "--databases",  # Enable databases API
                "--users"       # Enable users API (optional, can be removed)
            ],
            "transport": "stdio",
            "env": {
                "APPWRITE_PROJECT_ID": os.environ["APPWRITE_PROJECT_ID"],
                "APPWRITE_API_KEY": os.environ["APPWRITE_API_KEY"],
                "APPWRITE_ENDPOINT": os.environ.get("APPWRITE_ENDPOINT", "")
            }
        }
    }

    print("📡 Connecting to Appwrite MCP server...")

    # 2. Initialize MCP client (manual pattern, not context manager)
    mcp_client = MultiServerMCPClient(mcp_servers)
    appwrite_tools = await mcp_client.get_tools()

    print(f"✅ Connected! Discovered {len(appwrite_tools)} Appwrite tools")
    print(f"   Available tools: {[tool.name for tool in appwrite_tools]}")
    print()

    # 3. Initialize Gemini LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        api_key=os.environ["GOOGLE_API_KEY"],
        temperature=0  # Deterministic for database operations
    )

    # 4. Define agent instructions
    appwrite_agent_instructions = """You are an Appwrite database expert assistant.

Your job is to help users interact with their Appwrite databases and understand their data structure.

Available capabilities:
- List all databases in the Appwrite project
- Get database details (name, ID, status)
- List collections within databases
- Get collection schema and attributes
- Query documents and analyze data

When asked to list databases, use the appropriate Appwrite tool to fetch the data.
Present the results in a clear, organized format showing:
- Database ID
- Database name
- Enabled status
- Any other relevant metadata

Be helpful, clear, and explain what you find!

Remember: You have direct access to Appwrite APIs through MCP tools - use them confidently."""

    # 5. Create deep agent with Appwrite tools
    print("🧠 Creating Deep Agent with Appwrite tools...")
    agent = async_create_deep_agent(
        tools=appwrite_tools,
        instructions=appwrite_agent_instructions,
        model=llm
    ).with_config({"recursion_limit": 100})

    print("✅ Agent created successfully!")
    print()

    # 6. Test queries
    test_queries = [
        "List all databases in my Appwrite project",
        # Uncomment to test additional queries:
        # "Show me the collections in the first database",
        # "What is the schema of the users collection?"
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"📊 Query {i}: {query}")
        print("-" * 60)

        try:
            result = await agent.ainvoke({
                "messages": [
                    {"role": "user", "content": query}
                ]
            })

            if "messages" in result:
                response = result["messages"][-1].content
                print(response)
            else:
                print("⚠️  No response from agent")

        except Exception as e:
            error_str = str(e)
            # Check if it's a rate limit error
            if "rate_limit_error" in error_str or "429" in error_str:
                print(f"❌ Rate limit error: Your API quota needs time to reset.")
                print(f"   Please wait a few minutes and try again.")
            else:
                print(f"❌ Error processing query: {error_str}")
                import traceback
                traceback.print_exc()

        print()
        print("=" * 60)
        print()

    print("✅ Appwrite Deep Agent queries complete!")
    print("🎉 Session finished!")


if __name__ == "__main__":
    # Load environment variables from .env file
    load_dotenv()

    # Verify required environment variables
    required_env_vars = [
        "APPWRITE_PROJECT_ID",
        "APPWRITE_API_KEY",
        "GOOGLE_API_KEY"
    ]

    missing_vars = [var for var in required_env_vars if not os.environ.get(var)]

    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("Please set them in your .env file")
        exit(1)

    # Run the async main function
    asyncio.run(main())
