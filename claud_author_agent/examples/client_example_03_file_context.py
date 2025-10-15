"""
Example 3: ClaudeSDKClient with File Context Offloading

This demonstrates using files for context management:
- Creating a workspace for context storage
- Writing intermediate results to files
- Reading context from files in subsequent queries
- Managing large context through file system
"""

import anyio
import tempfile
import shutil
from pathlib import Path
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage


async def file_context_example():
    """
    Example: Using files to offload and manage context.
    """
    print("=" * 70)
    print("Example 3: File Context Offloading with ClaudeSDKClient")
    print("=" * 70)
    print()

    # Create temporary workspace for context files
    workspace = Path(tempfile.mkdtemp(prefix="agent_workspace_"))
    context_dir = workspace / "context"
    context_dir.mkdir(parents=True, exist_ok=True)

    print(f"Workspace created: {workspace}")
    print(f"Context directory: {context_dir}")
    print()

    try:
        # Configure agent with file tools
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            max_turns=30,
            permission_mode='acceptEdits',
            system_prompt=f'''You are an AI assistant that uses files for context management.

**Workspace**: {workspace}
**Context Directory**: {context_dir}

**Your Responsibilities:**
1. Store intermediate results in files under {context_dir}
2. Read context from files when needed
3. Use files to manage large context efficiently
4. Keep file names descriptive and organized

**Guidelines:**
- Write key findings to {context_dir}/findings.md
- Store data summaries in {context_dir}/data.json or {context_dir}/data.txt
- Use markdown for text content
- Always use absolute paths when working with files
''',
            allowed_tools=['Read', 'Write', 'Edit', 'Glob', 'Grep']
        )

        print("Configuration:")
        print(f"  - Model: {options.model}")
        print(f"  - Allowed tools: {', '.join(options.allowed_tools or [])}")
        print()

        # Create client
        client = ClaudeSDKClient(options=options)

        async with client:
            await client.connect()

            # Phase 1: Initial analysis - agent will write to files
            print("Phase 1: Initial Analysis")
            print("-" * 70)

            prompt1 = f"""
Analyze the concept of "context engineering in AI agents" and write your key findings to:
{context_dir}/findings.md

Include:
1. What is context engineering?
2. Why is it important?
3. Common techniques

Keep it concise (300-500 words) and use clear markdown formatting.
"""

            await client.query(prompt1)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)

                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print("✓ Phase 1 complete")
                    print()

            # Phase 2: Read context and build upon it
            print("Phase 2: Building on Context")
            print("-" * 70)

            prompt2 = f"""
Read the findings from {context_dir}/findings.md and expand on technique #2.

Write a detailed explanation (500-700 words) to:
{context_dir}/technique_deep_dive.md

Include examples and use cases.
"""

            await client.query(prompt2)

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)

                elif isinstance(message, ResultMessage):
                    print("-" * 70)
                    print("✓ Phase 2 complete")
                    print()

            # Phase 3: Synthesize all context
            print("Phase 3: Context Synthesis")
            print("-" * 70)

            prompt3 = f"""
Read ALL files in {context_dir}/ and create a comprehensive summary in:
{context_dir}/summary.md

Include:
1. Overview of all findings
2. Key insights from deep dive
3. Actionable recommendations

Format as a well-structured markdown document.
"""

            await client.query(prompt3)

            total_cost = 0.0

            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if hasattr(block, 'text'):
                            print(block.text)

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

        # Show results
        print("=" * 70)
        print("Workspace Contents")
        print("=" * 70)

        files = list(context_dir.glob("*"))
        if files:
            print(f"\nFiles created in {context_dir}:")
            for file_path in sorted(files):
                if file_path.is_file():
                    size = file_path.stat().st_size
                    print(f"  ✓ {file_path.name} ({size} bytes)")

            # Show summary content
            summary_file = context_dir / "summary.md"
            if summary_file.exists():
                print("\n" + "=" * 70)
                print("Final Summary Content")
                print("=" * 70)
                print()
                print(summary_file.read_text())
        else:
            print("\nNo files created")

        print("\n" + "=" * 70)
        print(f"Session cost: ${total_cost:.4f}")
        print(f"Workspace persisted at: {workspace}")
        print("=" * 70)

    except Exception as e:
        print(f"\nError: {e}")
        raise

    finally:
        # Optional: Clean up workspace
        # Uncomment to delete workspace after execution
        # if workspace.exists():
        #     shutil.rmtree(workspace)
        #     print(f"\nWorkspace cleaned up: {workspace}")
        pass


async def main():
    """Main entry point."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "ClaudeSDKClient Example 3" + " " * 28 + "║")
    print("║" + " " * 18 + "File Context Offloading" + " " * 27 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    await file_context_example()

    print()
    print("=" * 70)
    print("Example completed!")
    print("=" * 70)
    print()
    print("Key Takeaways:")
    print("  ✓ Use files to offload large context")
    print("  ✓ Multiple queries can build upon stored context")
    print("  ✓ Files enable incremental knowledge building")
    print("  ✓ Workspace organization improves context management")
    print("  ✓ Read/Write tools allow persistent state across queries")
    print()


if __name__ == "__main__":
    anyio.run(main)
