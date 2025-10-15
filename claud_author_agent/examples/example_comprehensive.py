"""
Comprehensive Example: Combining Files, Subagents, and MCP Tools

This example demonstrates how to use all three features together:
1. File input and manipulation
2. Subagents for specialized tasks
3. Custom MCP tools for additional functionality
"""

import anyio
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions
import os
from datetime import datetime


# Custom MCP Tools
@tool("analyze_code_metrics", "Analyze code metrics (lines, functions, etc.)", {"file_path": str})
async def analyze_code_metrics(args):
    """Analyze code metrics from a file."""
    try:
        with open(args["file_path"], "r") as f:
            content = f.read()

        lines = content.split("\n")
        total_lines = len(lines)
        code_lines = len([line for line in lines if line.strip() and not line.strip().startswith("#")])
        comment_lines = len([line for line in lines if line.strip().startswith("#")])
        blank_lines = len([line for line in lines if not line.strip()])

        # Count function definitions
        functions = len([line for line in lines if line.strip().startswith("def ")])
        classes = len([line for line in lines if line.strip().startswith("class ")])

        metrics = f"""
Code Metrics for {args["file_path"]}:
- Total lines: {total_lines}
- Code lines: {code_lines}
- Comment lines: {comment_lines}
- Blank lines: {blank_lines}
- Functions: {functions}
- Classes: {classes}
- Code density: {(code_lines/total_lines*100):.1f}%
"""

        return {
            "content": [{"type": "text", "text": metrics}]
        }
    except Exception as e:
        return {
            "content": [{"type": "text", "text": f"Error analyzing file: {str(e)}"}],
            "isError": True
        }


@tool("log_activity", "Log agent activity with timestamp", {"activity": str})
async def log_activity(args):
    """Log agent activity."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {args['activity']}\n"

    with open("agent_activity.log", "a") as f:
        f.write(log_entry)

    return {
        "content": [{"type": "text", "text": f"Logged: {log_entry.strip()}"}]
    }


async def comprehensive_example():
    """
    Comprehensive example combining all features.
    """
    print("=" * 70)
    print("Comprehensive Example: Files + Subagents + MCP Tools")
    print("=" * 70)
    print()

    # Step 1: Create sample project structure
    print("Step 1: Creating sample project structure...")
    print("-" * 70)

    # Create project files
    os.makedirs("sample_project", exist_ok=True)

    with open("sample_project/calculator.py", "w") as f:
        f.write("""
class Calculator:
    \"\"\"A simple calculator class.\"\"\"

    def add(self, a, b):
        \"\"\"Add two numbers.\"\"\"
        return a + b

    def subtract(self, a, b):
        \"\"\"Subtract b from a.\"\"\"
        return a - b

    def multiply(self, a, b):
        \"\"\"Multiply two numbers.\"\"\"
        return a * b

    def divide(self, a, b):
        \"\"\"Divide a by b.\"\"\"
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b
""")

    with open("sample_project/utils.py", "w") as f:
        f.write("""
def validate_number(value):
    \"\"\"Validate if value is a number.\"\"\"
    try:
        float(value)
        return True
    except ValueError:
        return False

def format_result(result):
    \"\"\"Format calculation result.\"\"\"
    return f"Result: {result:.2f}"
""")

    print("Created sample_project/calculator.py")
    print("Created sample_project/utils.py")
    print()

    # Step 2: Create subagent definitions
    print("Step 2: Creating specialized subagents...")
    print("-" * 70)

    agents_dir = ".claude/agents"
    os.makedirs(agents_dir, exist_ok=True)

    with open(f"{agents_dir}/code-analyzer.md", "w") as f:
        f.write("""---
name: code-analyzer
description: Code analysis and quality expert. Use for analyzing code structure and quality.
tools: Read, Grep, Glob
model: sonnet
---

You are a code analysis expert specializing in Python.

Your responsibilities:
- Analyze code structure and organization
- Identify code smells and anti-patterns
- Suggest refactoring opportunities
- Assess code maintainability

Provide detailed analysis with specific recommendations.
""")

    with open(f"{agents_dir}/doc-writer.md", "w") as f:
        f.write("""---
name: doc-writer
description: Documentation specialist. Use for writing and improving code documentation.
tools: Read, Write
model: sonnet
---

You are a technical documentation specialist.

Your responsibilities:
- Write clear, comprehensive documentation
- Create docstrings following PEP 257
- Add usage examples
- Explain complex concepts clearly

Focus on making documentation helpful and accessible.
""")

    print(f"Created {agents_dir}/code-analyzer.md")
    print(f"Created {agents_dir}/doc-writer.md")
    print()

    # Step 3: Create custom MCP tools
    print("Step 3: Creating custom MCP tools...")
    print("-" * 70)

    code_tools_server = create_sdk_mcp_server(
        name="code-tools",
        version="1.0.0",
        tools=[analyze_code_metrics, log_activity]
    )

    print("Created MCP server 'code-tools' with tools:")
    print("  - analyze_code_metrics")
    print("  - log_activity")
    print()

    # Step 4: Configure agent with all features
    print("Step 4: Configuring agent with all features...")
    print("-" * 70)

    options = ClaudeAgentOptions(
        # File access
        allowed_tools=[
            "Read", "Write", "Glob", "Grep",
            "mcp__code-tools__analyze_code_metrics",
            "mcp__code-tools__log_activity"
        ],
        cwd=".",
        add_dirs=["./sample_project"],

        # MCP tools
        mcp_servers={"code-tools": code_tools_server},

        # Subagents (programmatic)
        agents={
            'test-generator': {
                'description': 'Unit test generation expert. Use for creating comprehensive test suites.',
                'prompt': '''You are a test generation expert.
Generate pytest-compatible unit tests with:
- Good test coverage
- Edge case testing
- Clear test names
- Proper assertions''',
                'tools': ['Read', 'Write'],
                'model': 'sonnet'
            }
        },

        # Load filesystem subagents
        setting_sources=["project"],

        permission_mode='acceptEdits',
        system_prompt="You are a senior software engineer and code reviewer."
    )

    print("Configured agent with:")
    print("  - File tools: Read, Write, Glob, Grep")
    print("  - Custom MCP tools: analyze_code_metrics, log_activity")
    print("  - Programmatic subagent: test-generator")
    print("  - Filesystem subagents: code-analyzer, doc-writer")
    print()

    # Step 5: Execute comprehensive task
    print("Step 5: Executing comprehensive analysis task...")
    print("-" * 70)
    print()

    prompt = """
    Please perform a comprehensive analysis of the sample_project:

    1. Use the 'analyze_code_metrics' tool to get metrics for calculator.py
    2. Read both Python files in sample_project
    3. Analyze the code quality and structure
    4. Suggest improvements for the Calculator class
    5. Log your analysis activities using the 'log_activity' tool

    Provide a detailed report with specific recommendations.
    """

    print("Prompt:", prompt.strip())
    print()
    print("Agent Response:")
    print("=" * 70)

    try:
        async for message in query(prompt=prompt, options=options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)
                        print()
            elif hasattr(message, 'subtype'):
                # Log system messages
                if message.subtype in ['init', 'success']:
                    print(f"[System: {message.subtype}]")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    print()
    print("=" * 70)

    # Show activity log
    if os.path.exists("agent_activity.log"):
        print()
        print("Activity Log:")
        print("-" * 70)
        with open("agent_activity.log", "r") as f:
            print(f.read())


async def main():
    """Main entry point."""
    await comprehensive_example()
    print()
    print("=" * 70)
    print("Comprehensive example completed!")
    print("=" * 70)
    print()
    print("This example demonstrated:")
    print("  ✓ File input and manipulation")
    print("  ✓ Programmatic subagent definitions")
    print("  ✓ Filesystem-based subagents")
    print("  ✓ Custom MCP tools")
    print("  ✓ Integrated workflow")


if __name__ == "__main__":
    anyio.run(main)
