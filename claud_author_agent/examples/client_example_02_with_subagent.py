"""
Example 2: ClaudeSDKClient with Subagent

This demonstrates using subagents with ClaudeSDKClient:
- Main orchestrator agent
- Specialized subagent for specific tasks
- Task delegation using Task tool
- Tracking subagent execution
"""

import anyio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import AgentDefinition, AssistantMessage, ResultMessage


async def subagent_example():
    """
    Example: Main agent delegates work to a specialized subagent.
    """
    print("=" * 70)
    print("Example 2: Using Subagents with ClaudeSDKClient")
    print("=" * 70)
    print()

    # Define a specialized subagent
    code_reviewer = AgentDefinition(
        description='Code review specialist that analyzes code quality',
        prompt='''You are a code review specialist.

**Your Responsibilities:**
1. Analyze code for best practices
2. Identify potential issues
3. Suggest improvements
4. Focus on readability, maintainability, and performance

**Guidelines:**
- Be specific and constructive
- Provide examples when suggesting changes
- Prioritize the most impactful issues
- Keep feedback concise and actionable
''',
        tools=['Read', 'Grep', 'Glob'],
        model='sonnet'
    )

    # Configure main agent with subagent
    options = ClaudeAgentOptions(
        model='claude-sonnet-4-5',
        max_turns=20,
        permission_mode='acceptEdits',
        system_prompt='''You are an orchestrator agent managing code quality.

**Available Subagents:**
- **code-reviewer**: Specialized code review agent

**Your Responsibilities:**
1. Analyze user requests
2. Delegate code review tasks to the code-reviewer subagent using the Task tool
3. Coordinate the work
4. Present the results to the user

Use the Task tool to delegate work to subagents when appropriate.
''',
        agents={
            'code-reviewer': code_reviewer
        },
        allowed_tools=['Task', 'Read', 'Glob']
    )

    print("Configuration:")
    print(f"  - Model: {options.model}")
    print(f"  - Subagents: {list(options.agents.keys())}")
    print()

    # Create client
    client = ClaudeSDKClient(options=options)

    try:
        async with client:
            await client.connect()

            # Task that requires subagent delegation
            prompt = """
Please review the Python files in the examples/ directory for code quality.
Use the code-reviewer subagent to analyze the files and provide feedback.
"""

            print(f"Query: {prompt.strip()}")
            print()
            print("Response:")
            print("-" * 70)

            await client.query(prompt)

            # Track tool usage
            tool_uses = []

            # Receive and process messages
            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        # Print text responses
                        if hasattr(block, 'text'):
                            print(block.text)
                            print()

                        # Track tool usage (especially Task tool for subagents)
                        if hasattr(block, 'type') and block.type == 'tool_use':
                            tool_name = getattr(block, 'name', 'unknown')
                            tool_uses.append(tool_name)

                            if tool_name == 'Task':
                                print(f"\n[Delegating to subagent...]")
                                if hasattr(block, 'input'):
                                    subagent = block.input.get('subagent_type', 'unknown')
                                    description = block.input.get('description', '')
                                    print(f"  → Subagent: {subagent}")
                                    print(f"  → Task: {description}")
                                    print()

                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print()
                    print("Session Complete!")

                    # Show tool usage summary
                    if tool_uses:
                        print(f"\nTools used during execution:")
                        for tool in set(tool_uses):
                            count = tool_uses.count(tool)
                            print(f"  - {tool}: {count} time(s)")

                    if hasattr(message, 'usage') and message.usage:
                        usage = message.usage
                        # Handle both dict and object formats
                        if isinstance(usage, dict):
                            total_cost = usage.get('total_cost_usd', 0.0)
                        else:
                            total_cost = getattr(usage, 'total_cost_usd', 0.0)
                        print(f"\nCost: ${total_cost:.4f}")

    except Exception as e:
        print(f"\nError: {e}")
        raise


async def main():
    """Main entry point."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "ClaudeSDKClient Example 2" + " " * 28 + "║")
    print("║" + " " * 20 + "With Subagent" + " " * 35 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    await subagent_example()

    print()
    print("=" * 70)
    print("Example completed!")
    print("=" * 70)
    print()
    print("Key Takeaways:")
    print("  ✓ Define subagents using AgentDefinition")
    print("  ✓ Pass subagents via agents parameter in ClaudeAgentOptions")
    print("  ✓ Main agent delegates to subagents using Task tool")
    print("  ✓ Each subagent has its own prompt, tools, and model")
    print("  ✓ Track tool usage to monitor subagent delegation")
    print()


if __name__ == "__main__":
    anyio.run(main)
