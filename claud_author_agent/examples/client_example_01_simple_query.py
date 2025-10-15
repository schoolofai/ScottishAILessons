"""
Example 1: Simple ClaudeSDKClient with Query and Response

This demonstrates the most basic usage of ClaudeSDKClient:
- Connect to Claude
- Send a simple query
- Receive and print the response
"""

import anyio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage


async def simple_query_example():
    """
    Basic example: Send a query and print the response.
    """
    print("=" * 70)
    print("Example 1: Simple Query with ClaudeSDKClient")
    print("=" * 70)
    print()

    # Configure agent options
    options = ClaudeAgentOptions(
        model='claude-sonnet-4-5',
        max_turns=5,
        permission_mode='acceptEdits',
        system_prompt="You are a helpful AI assistant."
    )

    print("Configuration:")
    print(f"  - Model: {options.model}")
    print(f"  - Max turns: {options.max_turns}")
    print()

    # Create client
    client = ClaudeSDKClient(options=options)

    print("Connecting to Claude...")
    print()

    try:
        # Use async context manager for automatic cleanup
        async with client:
            # Connect with initial prompt
            await client.connect()

            # Send a query
            prompt = "What are the three most important principles of clean code? Keep it brief."

            print(f"Query: {prompt}")
            print()
            print("Response:")
            print("-" * 70)

            await client.query(prompt)

            # Receive and print messages
            async for message in client.receive_response():
                # Process assistant messages
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)
                            print()

                # Process result message (final message)
                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print()
                    print("Session Complete!")
                    if hasattr(message, 'usage') and message.usage:
                        usage = message.usage
                        # Handle both dict and object formats
                        if isinstance(usage, dict):
                            input_tokens = usage.get('input_tokens', 0)
                            output_tokens = usage.get('output_tokens', 0)
                            total_cost = usage.get('total_cost_usd', 0.0)
                        else:
                            input_tokens = getattr(usage, 'input_tokens', 0)
                            output_tokens = getattr(usage, 'output_tokens', 0)
                            total_cost = getattr(usage, 'total_cost_usd', 0.0)

                        print(f"  - Input tokens: {input_tokens}")
                        print(f"  - Output tokens: {output_tokens}")
                        print(f"  - Cost: ${total_cost:.4f}")

    except Exception as e:
        print(f"\nError: {e}")
        raise


async def main():
    """Main entry point."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "ClaudeSDKClient Example 1" + " " * 28 + "║")
    print("║" + " " * 22 + "Simple Query" + " " * 35 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    await simple_query_example()

    print()
    print("=" * 70)
    print("Example completed!")
    print("=" * 70)
    print()
    print("Key Takeaways:")
    print("  ✓ ClaudeSDKClient provides stateful conversation management")
    print("  ✓ Use async context manager for automatic cleanup")
    print("  ✓ receive_response() yields messages until ResultMessage")
    print("  ✓ AssistantMessage contains the AI's response")
    print()


if __name__ == "__main__":
    anyio.run(main)
