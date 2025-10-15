"""
Example: Creating Custom MCP Tools with Claude Agent SDK

This demonstrates:
1. Creating custom tools with @tool decorator
2. Building an in-process MCP server
3. Using custom tools with the agent
4. Multiple tools in a single server
"""

import anyio
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions
import json
from datetime import datetime


# Example 1: Simple greeting tool
@tool("greet", "Greet a user by name", {"name": str})
async def greet_user(args):
    """Simple greeting tool."""
    name = args["name"]
    return {
        "content": [
            {"type": "text", "text": f"Hello, {name}! Welcome to Claude Agent SDK!"}
        ]
    }


# Example 2: Mathematical operations
@tool("add", "Add two numbers", {"a": float, "b": float})
async def add_numbers(args):
    """Add two numbers."""
    result = args["a"] + args["b"]
    return {
        "content": [
            {"type": "text", "text": f"Result: {args['a']} + {args['b']} = {result}"}
        ]
    }


@tool("multiply", "Multiply two numbers", {"a": float, "b": float})
async def multiply_numbers(args):
    """Multiply two numbers."""
    result = args["a"] * args["b"]
    return {
        "content": [
            {"type": "text", "text": f"Result: {args['a']} × {args['b']} = {result}"}
        ]
    }


@tool("power", "Calculate a number raised to a power", {"base": float, "exponent": float})
async def power(args):
    """Calculate power."""
    result = args["base"] ** args["exponent"]
    return {
        "content": [
            {"type": "text", "text": f"Result: {args['base']}^{args['exponent']} = {result}"}
        ]
    }


# Example 3: Data formatting tool
@tool("format_json", "Format a JSON string for readability", {"json_string": str})
async def format_json(args):
    """Format JSON string."""
    try:
        data = json.loads(args["json_string"])
        formatted = json.dumps(data, indent=2)
        return {
            "content": [
                {"type": "text", "text": f"Formatted JSON:\n```json\n{formatted}\n```"}
            ]
        }
    except json.JSONDecodeError as e:
        return {
            "content": [
                {"type": "text", "text": f"Error: Invalid JSON - {str(e)}"}
            ],
            "isError": True
        }


# Example 4: Time-based tool
@tool("get_timestamp", "Get current timestamp", {})
async def get_timestamp(args):
    """Get current timestamp."""
    now = datetime.now()
    timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
    iso_format = now.isoformat()

    return {
        "content": [
            {
                "type": "text",
                "text": f"Current Time:\n- Human readable: {timestamp}\n- ISO 8601: {iso_format}"
            }
        ]
    }


# Example 5: String manipulation tool
@tool("reverse_string", "Reverse a string", {"text": str})
async def reverse_string(args):
    """Reverse a string."""
    reversed_text = args["text"][::-1]
    return {
        "content": [
            {"type": "text", "text": f"Original: {args['text']}\nReversed: {reversed_text}"}
        ]
    }


@tool("word_count", "Count words in a text", {"text": str})
async def word_count(args):
    """Count words in text."""
    words = args["text"].split()
    char_count = len(args["text"])

    return {
        "content": [
            {
                "type": "text",
                "text": f"Text Statistics:\n- Words: {len(words)}\n- Characters: {char_count}"
            }
        ]
    }


async def simple_tool_example():
    """Example using a single custom tool."""
    print("=" * 70)
    print("Simple MCP Tool Example: Greeting Tool")
    print("=" * 70)
    print()

    # Create MCP server with greeting tool
    greeting_server = create_sdk_mcp_server(
        name="greeting",
        version="1.0.0",
        tools=[greet_user]
    )

    # Configure agent with the custom tool
    options = ClaudeAgentOptions(
        mcp_servers={"greeting": greeting_server},
        allowed_tools=["mcp__greeting__greet"],
        permission_mode='acceptEdits'
    )

    prompt = "Please greet a user named Alice using the greeting tool."

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
        print(f"Error: {e}")


async def calculator_example():
    """Example using multiple mathematical tools."""
    print()
    print("=" * 70)
    print("Multiple MCP Tools Example: Calculator")
    print("=" * 70)
    print()

    # Create MCP server with multiple math tools
    calculator_server = create_sdk_mcp_server(
        name="calculator",
        version="2.0.0",
        tools=[add_numbers, multiply_numbers, power]
    )

    options = ClaudeAgentOptions(
        mcp_servers={"calc": calculator_server},
        allowed_tools=[
            "mcp__calc__add",
            "mcp__calc__multiply",
            "mcp__calc__power"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    Perform these calculations:
    1. Add 15 and 27
    2. Multiply 8 and 12
    3. Calculate 2 to the power of 8
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


async def utility_tools_example():
    """Example using utility tools (JSON formatting, time, string manipulation)."""
    print()
    print("=" * 70)
    print("Utility Tools Example: Multiple Tool Servers")
    print("=" * 70)
    print()

    # Create multiple MCP servers for different tool categories
    text_tools_server = create_sdk_mcp_server(
        name="text-tools",
        version="1.0.0",
        tools=[reverse_string, word_count]
    )

    utility_server = create_sdk_mcp_server(
        name="utilities",
        version="1.0.0",
        tools=[format_json, get_timestamp]
    )

    options = ClaudeAgentOptions(
        mcp_servers={
            "text": text_tools_server,
            "utils": utility_server
        },
        allowed_tools=[
            "mcp__text__reverse_string",
            "mcp__text__word_count",
            "mcp__utils__format_json",
            "mcp__utils__get_timestamp"
        ],
        permission_mode='acceptEdits'
    )

    prompt = """
    Please do the following:
    1. Get the current timestamp
    2. Count words in the text: "The quick brown fox jumps over the lazy dog"
    3. Reverse the string: "Hello Claude"
    4. Format this JSON: {"name":"Alice","age":30,"city":"NYC"}
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
    await simple_tool_example()
    await calculator_example()
    await utility_tools_example()
    print()
    print("=" * 70)
    print("MCP tools examples completed!")
    print("=" * 70)
    print()
    print("Note: Tool naming format is: mcp__<server_name>__<tool_name>")


if __name__ == "__main__":
    anyio.run(main)
