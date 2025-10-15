"""
Example 4: ClaudeSDKClient with Appwrite MCP Integration

This demonstrates using external MCP servers (Appwrite) with ClaudeSDKClient:
- Loading MCP server configuration from .mcp.json
- Using Appwrite database tools via MCP
- Multi-turn conversation with database operations
- Tracking operation results
"""

import anyio
import json
import os
from pathlib import Path
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage


async def appwrite_client_example():
    """
    Example: Using ClaudeSDKClient with Appwrite MCP server.
    """
    print("=" * 70)
    print("Example 4: Appwrite Integration with ClaudeSDKClient")
    print("=" * 70)
    print()

    # Load external MCP server configuration
    mcp_config_path = ".mcp.json"

    if not os.path.exists(mcp_config_path):
        print(f"Error: {mcp_config_path} not found!")
        print("Please ensure .mcp.json exists in the current directory.")
        print()
        print("To use this example, create .mcp.json with Appwrite configuration.")
        return

    print(f"Loading MCP configuration from {mcp_config_path}...")
    with open(mcp_config_path, 'r') as f:
        mcp_config = json.load(f)

    print("✓ Configuration loaded")
    print()

    # Configure agent with Appwrite MCP server
    options = ClaudeAgentOptions(
        model='claude-sonnet-4-5',
        max_turns=30,

        # Pass the entire MCP servers configuration
        mcp_servers=mcp_config['mcpServers'],

        # Allow specific Appwrite database tools
        allowed_tools=[
            "mcp__appwrite__databases_list",
            "mcp__appwrite__databases_get",
            "mcp__appwrite__databases_create",
            "mcp__appwrite__databases_create_collection",
            "mcp__appwrite__databases_list_collections",
        ],

        permission_mode='acceptEdits',

        system_prompt="""You are an Appwrite database assistant.

**Your Responsibilities:**
1. Use Appwrite MCP tools to manage databases and collections
2. Provide clear feedback on operations
3. Handle errors gracefully
4. Report success/failure status clearly

**Available Appwrite Tools:**
- databases_list: List all databases
- databases_get: Get database details
- databases_create: Create a new database
- databases_create_collection: Create a collection in a database
- databases_list_collections: List collections in a database

**Guidelines:**
- Always confirm operations were successful
- Provide detailed information about created resources
- Use descriptive IDs and names
- Report any errors clearly
"""
    )

    print("Agent Configuration:")
    print(f"  - Model: {options.model}")
    print("  - External MCP Servers: {list(mcp_config['mcpServers'].keys())}")
    print(f"  - Allowed Tools: {len(options.allowed_tools or [])} Appwrite tools")
    print()

    # Create client
    client = ClaudeSDKClient(options=options)

    try:
        async with client:
            await client.connect()

            # Phase 1: List databases
            print("Phase 1: List Existing Databases")
            print("-" * 70)

            prompt1 = "Please list all databases in my Appwrite project using the Appwrite tools."

            await client.query(prompt1)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)

                        # Show tool usage
                        if hasattr(block, 'type') and block.type == 'tool_use':
                            tool_name = getattr(block, 'name', 'unknown')
                            print(f"\n[Using tool: {tool_name}]")

                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print("✓ Phase 1 complete")
                    print()

            # Phase 2: Create a new database
            print("Phase 2: Create New Database")
            print("-" * 70)

            prompt2 = """
Create a new Appwrite database with:
- Database ID: 'example_db_client_001'
- Name: 'Example Client Database'

After creating it, confirm the creation was successful.
"""

            await client.query(prompt2)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)

                        if hasattr(block, 'type') and block.type == 'tool_use':
                            tool_name = getattr(block, 'name', 'unknown')
                            print(f"\n[Using tool: {tool_name}]")

                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print("✓ Phase 2 complete")
                    print()

            # Phase 3: Create a collection
            print("Phase 3: Create Collection in Database")
            print("-" * 70)

            prompt3 = """
In the database 'example_db_client_001', create a collection:
- Collection ID: 'users'
- Name: 'Users'
- Document security: disabled

Then list all collections in the database to confirm.
"""

            await client.query(prompt3)

            total_cost = 0.0
            tool_count = {}

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)

                        if hasattr(block, 'type') and block.type == 'tool_use':
                            tool_name = getattr(block, 'name', 'unknown')
                            print(f"\n[Using tool: {tool_name}]")
                            tool_count[tool_name] = tool_count.get(tool_name, 0) + 1

                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print("✓ Phase 3 complete")
                    print()

                    if hasattr(message, 'usage') and message.usage:
                        usage = message.usage
                        # Handle both dict and object formats
                        if isinstance(usage, dict):
                            total_cost = usage.get('total_cost_usd', 0.0)
                        else:
                            total_cost = getattr(usage, 'total_cost_usd', 0.0)

        # Summary
        print("=" * 70)
        print("Session Summary")
        print("=" * 70)
        print()

        if tool_count:
            print("Appwrite Tools Used:")
            for tool, count in sorted(tool_count.items()):
                print(f"  - {tool}: {count} time(s)")
            print()

        print(f"Total Cost: ${total_cost:.4f}")
        print()
        print("=" * 70)

    except Exception as e:
        print(f"\nError: {e}")
        print("\nTroubleshooting tips:")
        print("  1. Ensure uvx is installed: pip install uvx")
        print("  2. Ensure mcp-server-appwrite is available")
        print("  3. Check Appwrite credentials in .mcp.json")
        print("  4. Verify Appwrite endpoint is accessible")
        raise


async def main():
    """Main entry point."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "ClaudeSDKClient Example 4" + " " * 28 + "║")
    print("║" + " " * 18 + "Appwrite Integration" + " " * 30 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    await appwrite_client_example()

    print()
    print("=" * 70)
    print("Example completed!")
    print("=" * 70)
    print()
    print("Key Takeaways:")
    print("  ✓ External MCP servers work seamlessly with ClaudeSDKClient")
    print("  ✓ Load MCP config from .mcp.json via mcp_servers parameter")
    print("  ✓ Tools are named: mcp__<server>__<tool>")
    print("  ✓ Multi-turn conversations maintain context across operations")
    print("  ✓ Agent can perform complex database workflows")
    print()


if __name__ == "__main__":
    anyio.run(main)
