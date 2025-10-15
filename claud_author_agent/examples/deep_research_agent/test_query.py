#!/usr/bin/env python3
"""
Simple test to see all messages from query()
"""

import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import AgentDefinition

async def test_simple_query():
    """Test query and print all messages"""

    print("=" * 80)
    print("Testing query() with simple prompt")
    print("=" * 80)

    # Simple options
    options = ClaudeAgentOptions(
        model='claude-sonnet-4-5',
        max_turns=5,
        allowed_tools=['Read', 'Write', 'TodoWrite'],
        permission_mode='acceptEdits'
    )

    prompt = "What is 2 + 2? Just answer briefly."

    print(f"\nPrompt: {prompt}\n")
    print("-" * 80)

    message_count = 0
    try:
        async for message in query(prompt=prompt, options=options):
            message_count += 1
            message_type = type(message).__name__

            print(f"\n[Message #{message_count}] Type: {message_type}")
            print(f"Content: {message}")
            print("-" * 80)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

    print(f"\nTotal messages received: {message_count}")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_simple_query())
