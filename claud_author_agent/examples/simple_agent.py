"""
Simple Claude Agent SDK Example

This script demonstrates a basic agent using the Claude Agent SDK.
It will test if authentication works without an explicit API key set.
"""

import anyio
from claude_agent_sdk import query, ClaudeAgentOptions


async def simple_agent():
    """
    Creates a simple agent that performs a basic task.
    """
    print("Starting simple Claude agent...")
    print("=" * 60)

    # Configure agent options
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write"],
        permission_mode='acceptEdits',
        system_prompt="You are a helpful assistant. Be concise and clear."
    )

    # Send a simple query to the agent
    prompt = "What is 2 + 2? Explain briefly."

    print(f"\nPrompt: {prompt}\n")
    print("Agent Response:")
    print("-" * 60)

    try:
        async for message in query(prompt=prompt, options=options):
            print(message)
    except Exception as e:
        print(f"\nError occurred: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("\nThis might indicate authentication issues or missing API key.")
        raise


async def main():
    """Main entry point."""
    await simple_agent()
    print("\n" + "=" * 60)
    print("Agent execution completed successfully!")


if __name__ == "__main__":
    anyio.run(main)
