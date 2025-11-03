"""Test to see how Claude SDK agent sees the MCP tool schema.

This will show us what the agent actually receives as tool definitions,
which may differ from what we think the schema is.
"""

import json
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from src.tools.diagram_screenshot_tool import diagram_screenshot_server


async def test_mcp_schema_as_seen_by_agent():
    """Create a minimal Claude SDK client and inspect how it sees the MCP tools."""
    print("=" * 80)
    print("MCP TOOL SCHEMA AS SEEN BY CLAUDE SDK AGENT")
    print("=" * 80)
    print()

    # Configure Claude SDK with just the diagram-screenshot MCP server
    mcp_servers = {
        "diagram-screenshot": diagram_screenshot_server
    }

    options = ClaudeAgentOptions(
        model='claude-sonnet-4-5',
        permission_mode='bypassPermissions',
        mcp_servers=mcp_servers,
        allowed_tools=['mcp__diagram-screenshot__render_diagram'],
        max_turns=1,  # Just for inspection
        cwd="."
    )

    print("Creating Claude SDK client...")
    print()

    async with ClaudeSDKClient(options) as client:
        # The client should have processed the MCP server and extracted tool schemas
        print("✅ Client created successfully")
        print()

        # Try to access internal tool information
        if hasattr(client, '_tools') or hasattr(client, 'tools'):
            tools_attr = getattr(client, '_tools', None) or getattr(client, 'tools', None)
            print(f"Tools attribute type: {type(tools_attr)}")
            print(f"Tools attribute: {tools_attr}")
            print()

        # Try to list available tools via the client
        print("Attempting to query agent about available tools...")
        print()

        # Send a query asking the agent to describe its own tools
        query = """Please list all tools available to you and their parameter schemas.
For the mcp__diagram-screenshot__render_diagram tool specifically, show:
1. The exact parameter names
2. The type of each parameter (string, object, array, etc.)
3. Whether each parameter is required or optional

Format your response as a JSON object."""

        try:
            await client.query(query)
            print("✅ Query sent successfully")
            print()

            # Check for response messages
            print("Waiting for agent response...")
            print()

            # In a real scenario, we'd stream the response
            # For now, just check if the client has any response data

        except Exception as e:
            print(f"❌ Query failed: {type(e).__name__}: {e}")

    print()
    print("=" * 80)
    print("ALTERNATIVE APPROACH: Check MCP Server Directly")
    print("=" * 80)
    print()

    # Try to call MCP server's list_tools directly
    server_dict = diagram_screenshot_server
    if 'instance' in server_dict:
        mcp_instance = server_dict['instance']
        print(f"MCP Server instance: {type(mcp_instance)}")

        if hasattr(mcp_instance, 'list_tools'):
            print("Calling list_tools()...")
            try:
                # list_tools is async
                tools_list = await mcp_instance.list_tools()
                print(f"\nTools returned: {type(tools_list)}")
                print(json.dumps(tools_list, indent=2, default=str))
            except Exception as e:
                print(f"❌ list_tools failed: {type(e).__name__}: {e}")

    print()
    print("=" * 80)
    print("KEY QUESTION TO ANSWER")
    print("=" * 80)
    print()
    print("Does the MCP tool schema show:")
    print("  A) diagram: object, options: object  (CORRECT)")
    print("  B) diagram: string, options: string  (INCORRECT - agent's claim)")
    print()


if __name__ == "__main__":
    asyncio.run(test_mcp_schema_as_seen_by_agent())
