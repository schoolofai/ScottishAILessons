"""
Example: Creating and Using Subagents with Claude Agent SDK

This demonstrates:
1. Programmatic subagent definition
2. Filesystem-based subagent definition
3. Using subagents for specialized tasks
"""

import anyio
from claude_agent_sdk import query, ClaudeAgentOptions
import os


async def programmatic_subagent_example():
    """
    Example showing programmatic subagent definition.
    """
    print("=" * 70)
    print("Programmatic Subagent Example")
    print("=" * 70)
    print()

    # Define subagents programmatically
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Grep", "Glob", "Bash"],
        permission_mode='acceptEdits',
        agents={
            'code-reviewer': {
                'description': 'Expert code review specialist. Use for quality, security, and maintainability reviews.',
                'prompt': '''You are a senior software engineer specializing in code review.
Focus on:
- Code quality and readability
- Security vulnerabilities
- Performance optimization
- Best practices
Provide constructive feedback with specific examples.''',
                'tools': ['Read', 'Grep', 'Glob'],
                'model': 'sonnet'
            },
            'test-writer': {
                'description': 'Test automation expert. Use for writing unit tests and test strategies.',
                'prompt': '''You are a test automation expert.
Your responsibilities:
- Write comprehensive unit tests
- Ensure good test coverage
- Follow testing best practices
- Use appropriate testing frameworks''',
                'tools': ['Read', 'Write', 'Grep'],
                'model': 'sonnet'
            },
            'documentation-expert': {
                'description': 'Technical documentation specialist. Use for writing and improving documentation.',
                'prompt': '''You are a technical documentation expert.
Your responsibilities:
- Write clear, concise documentation
- Explain complex concepts simply
- Follow documentation standards
- Include examples and usage instructions''',
                'tools': ['Read', 'Write'],
                'model': 'sonnet'
            }
        }
    )

    # Create a sample file to review
    sample_file = "review_me.py"
    with open(sample_file, "w") as f:
        f.write("""
def process_data(data):
    result = []
    for item in data:
        if item > 0:
            result.append(item * 2)
    return result

def main():
    data = [1, -2, 3, -4, 5]
    processed = process_data(data)
    print(processed)
""")

    print(f"Created sample file: {sample_file}")
    print()

    prompt = f"Review the code in '{sample_file}' for quality and suggest improvements."

    print(f"Prompt: {prompt}")
    print()
    print("Agent Response (may delegate to code-reviewer subagent):")
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


async def filesystem_subagent_example():
    """
    Example showing filesystem-based subagent definition.
    """
    print()
    print("=" * 70)
    print("Filesystem Subagent Example")
    print("=" * 70)
    print()

    # Create .claude/agents directory
    agents_dir = ".claude/agents"
    os.makedirs(agents_dir, exist_ok=True)

    # Create a SQL expert subagent
    sql_expert_path = os.path.join(agents_dir, "sql-expert.md")
    with open(sql_expert_path, "w") as f:
        f.write("""---
name: sql-expert
description: SQL optimization and database expert. Use for query analysis and optimization.
tools: Read, Grep, Bash
model: sonnet
---

You are an SQL optimization expert with deep knowledge of database systems.

Your expertise includes:
- Query optimization and performance tuning
- Index recommendations
- Database schema design
- SQL best practices
- Detecting N+1 queries and other anti-patterns

When analyzing SQL:
1. Identify performance bottlenecks
2. Suggest specific optimizations
3. Explain the reasoning behind recommendations
4. Consider database-specific features

Be thorough but concise in your analysis.
""")

    print(f"Created subagent definition: {sql_expert_path}")
    print()

    # Create a security analyst subagent
    security_analyst_path = os.path.join(agents_dir, "security-analyst.md")
    with open(security_analyst_path, "w") as f:
        f.write("""---
name: security-analyst
description: Security vulnerability detection specialist. Use for security audits and vulnerability analysis.
tools: Read, Grep, Glob
model: sonnet
---

You are a security analyst specializing in application security.

Your focus areas:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) vulnerabilities
- Authentication and authorization flaws
- Input validation issues
- Sensitive data exposure
- Security misconfigurations

When performing security analysis:
1. Identify potential vulnerabilities
2. Assess risk severity (Critical, High, Medium, Low)
3. Provide remediation recommendations
4. Include code examples of fixes

Be thorough and prioritize critical issues.
""")

    print(f"Created subagent definition: {security_analyst_path}")
    print()

    # Configure options to load filesystem agents
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Grep", "Glob"],
        permission_mode='acceptEdits',
        setting_sources=["project"]  # Load project-level config including agents
    )

    # Create a sample SQL file
    sql_file = "queries.sql"
    with open(sql_file, "w") as f:
        f.write("""
SELECT u.*, p.*
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.active = true;

SELECT * FROM orders WHERE user_id = 123;

SELECT * FROM products WHERE category IN (
    SELECT id FROM categories WHERE name = 'Electronics'
);
""")

    print(f"Created sample SQL file: {sql_file}")
    print()

    prompt = f"Analyze the SQL queries in '{sql_file}' for optimization opportunities."

    print(f"Prompt: {prompt}")
    print()
    print("Agent Response (may delegate to sql-expert subagent):")
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
    await programmatic_subagent_example()
    await filesystem_subagent_example()
    print()
    print("=" * 70)
    print("Subagent examples completed!")
    print("=" * 70)


if __name__ == "__main__":
    anyio.run(main)
