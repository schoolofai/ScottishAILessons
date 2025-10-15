"""
Example: Using External MCP Server (Appwrite) with Claude Agent SDK

This demonstrates how to use external MCP servers that run as separate processes
communicating via stdio (stdin/stdout), as opposed to in-process SDK MCP servers.

External MCP Server Features:
- Runs as a separate subprocess
- Communicates via stdio protocol
- Configured in .mcp.json file
- Can integrate with external services (like Appwrite)
"""

import anyio
from claude_agent_sdk import query, ClaudeAgentOptions
import json
import os


async def basic_appwrite_example():
    """
    Basic example using Appwrite MCP server to list databases.
    """
    print("=" * 70)
    print("Basic Appwrite MCP Server Example")
    print("=" * 70)
    print()

    # Load external MCP server configuration
    mcp_config_path = ".mcp.json"

    if not os.path.exists(mcp_config_path):
        print(f"Error: {mcp_config_path} not found!")
        print("Please ensure .mcp.json exists in the current directory.")
        return

    print(f"Loading MCP configuration from {mcp_config_path}...")
    with open(mcp_config_path, 'r') as f:
        mcp_config = json.load(f)

    print("✓ Configuration loaded")
    print()

    # Configure agent with external MCP server
    options = ClaudeAgentOptions(
        # Pass the entire MCP servers configuration
        mcp_servers=mcp_config['mcpServers'],

        # Allow specific Appwrite database tools
        allowed_tools=[
            "mcp__appwrite__databases_list",
            "mcp__appwrite__databases_get",
        ],

        permission_mode='acceptEdits',
        system_prompt="You are an Appwrite database assistant. Use Appwrite tools to manage databases."
    )

    print("Agent Configuration:")
    print("  - External MCP Server: appwrite (stdio)")
    print("  - Allowed Tools: databases_list, databases_get")
    print()

    # Simple query to list databases
    prompt = "Please list all databases in my Appwrite project using the Appwrite tools."

    print(f"Prompt: {prompt}")
    print()
    print("Agent Response:")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"\nError: {e}")
        print("\nTroubleshooting tips:")
        print("  1. Ensure uvx is installed: pip install uvx")
        print("  2. Ensure mcp-server-appwrite is available")
        print("  3. Check Appwrite credentials in .mcp.json")
        print("  4. Verify Appwrite endpoint is accessible")


async def create_database_example():
    """
    Example creating a new database in Appwrite.
    """
    print()
    print("=" * 70)
    print("Create Database Example")
    print("=" * 70)
    print()

    # Load MCP configuration
    with open('.mcp.json', 'r') as f:
        mcp_config = json.load(f)

    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_list",
            "mcp__appwrite__databases_create",
            "mcp__appwrite__databases_get"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    Create a new Appwrite database with:
    - Database ID: 'demo_db_001'
    - Name: 'Demo Database'

    After creating it, list all databases to confirm.
    """

    print(f"Prompt: {prompt.strip()}")
    print()
    print("Agent Response:")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")


async def create_collection_example():
    """
    Example creating a collection with schema in Appwrite.
    """
    print()
    print("=" * 70)
    print("Create Collection Example")
    print("=" * 70)
    print()

    with open('.mcp.json', 'r') as f:
        mcp_config = json.load(f)

    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_list",
            "mcp__appwrite__databases_create_collection",
            "mcp__appwrite__databases_create_string_attribute",
            "mcp__appwrite__databases_create_integer_attribute",
            "mcp__appwrite__databases_list_collections"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    In database 'demo_db_001', create a collection:
    - Collection ID: 'users'
    - Name: 'Users'
    - Document security: disabled

    Then add these attributes:
    1. String attribute 'name' (required, max 100 characters)
    2. String attribute 'email' (required, max 255 characters)
    3. Integer attribute 'age' (not required)

    Finally, list all collections in the database.
    """

    print(f"Prompt: {prompt.strip()}")
    print()
    print("Agent Response:")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")


async def main():
    """Main entry point."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "External MCP Server Example" + " " * 26 + "║")
    print("║" + " " * 22 + "Appwrite Database" + " " * 29 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    # Run examples
    await basic_appwrite_example()

    # Uncomment to run additional examples:
    # await create_database_example()
    # await create_collection_example()

    print()
    print("=" * 70)
    print("Examples completed!")
    print("=" * 70)
    print()
    print("Key Takeaways:")
    print("  ✓ External MCP servers run as separate processes")
    print("  ✓ Configuration is loaded from .mcp.json")
    print("  ✓ Tools are named: mcp__<server>__<tool>")
    print("  ✓ Server communicates via stdio protocol")
    print()
    print("Next steps:")
    print("  - Run example_external_mcp_comprehensive.py for advanced usage")
    print("  - Read MCP_EXTERNAL_SERVERS.md for detailed documentation")


if __name__ == "__main__":
    anyio.run(main)
