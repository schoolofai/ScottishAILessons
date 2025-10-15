"""
Example: Providing Files as Input to Claude Agent SDK

This demonstrates how to configure the agent to work with files:
1. Using allowed_tools to enable file operations
2. Setting the working directory
3. Adding additional directories for access
"""

import anyio
from claude_agent_sdk import query, ClaudeAgentOptions


async def file_input_example():
    """
    Example showing how to provide files as input to the agent.
    """
    print("=" * 70)
    print("File Input Example: Analyzing Python files in current directory")
    print("=" * 70)
    print()

    # Create a sample file for analysis
    sample_file = "sample_code.py"
    with open(sample_file, "w") as f:
        f.write("""
def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total

def main():
    numbers = [1, 2, 3, 4, 5]
    result = calculate_sum(numbers)
    print(f"Sum: {result}")

if __name__ == "__main__":
    main()
""")
    print(f"Created sample file: {sample_file}")
    print()

    # Configure agent with file access
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Glob", "Grep"],
        permission_mode='acceptEdits',
        system_prompt="You are a code analyzer. Analyze code quality and suggest improvements.",
        cwd=".",  # Set current working directory
        # add_dirs=["/path/to/other/directory"]  # Add additional directories
    )

    # Query the agent to analyze the file
    prompt = f"Read and analyze the file '{sample_file}'. Provide feedback on code quality."

    print(f"Prompt: {prompt}")
    print()
    print("Agent Response:")
    print("-" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            # Only print assistant messages with actual content
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
    except Exception as e:
        print(f"Error: {e}")


async def multiple_files_example():
    """
    Example showing how to work with multiple files.
    """
    print()
    print("=" * 70)
    print("Multiple Files Example: Working with several files")
    print("=" * 70)
    print()

    # Create multiple sample files
    files = {
        "config.json": '{"app_name": "MyApp", "version": "1.0.0"}',
        "utils.py": "def helper():\n    return 'Helper function'\n",
        "main.py": "from utils import helper\n\nprint(helper())\n"
    }

    for filename, content in files.items():
        with open(filename, "w") as f:
            f.write(content)
        print(f"Created: {filename}")

    print()

    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Write"],
        permission_mode='acceptEdits'
    )

    prompt = """
    Analyze all Python files in the current directory.
    1. List all Python files
    2. Read each file
    3. Provide a summary of the project structure
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
    await file_input_example()
    await multiple_files_example()
    print()
    print("=" * 70)
    print("File input examples completed!")
    print("=" * 70)


if __name__ == "__main__":
    anyio.run(main)
