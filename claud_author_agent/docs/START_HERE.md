# Start Here: Claude Agent SDK Quick Start

Welcome to the Claude Agent SDK! This guide will get you up and running quickly.

## 🚀 Quick Navigation

- **Never used the SDK?** → [First Steps](#first-steps)
- **Want to see examples?** → [Run Examples](#run-examples)
- **Building production apps?** → [ClaudeSDKClient Guide](#claudesdkclient-production-pattern)
- **Need configuration help?** → [Configuration](#configuration)
- **Looking for specific feature?** → [Feature Guide](#feature-guide)

---

## First Steps

### 1. Prerequisites

```bash
# Python 3.10 or higher
python --version

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Mac/Linux
# or
venv\Scripts\activate  # On Windows
```

### 2. Install SDK

```bash
pip install claude-agent-sdk anyio
```

### 3. Set API Key

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

Or in Python:
```python
import os
os.environ['ANTHROPIC_API_KEY'] = 'your-key-here'
```

### 4. Run Your First Example

```bash
python examples/client_example_01_simple_query.py
```

**Success!** You just ran your first Claude agent. 🎉

---

## Two Approaches to Choose From

The SDK provides two patterns for different use cases:

### Option A: query() Function - Simple & Quick

**Best for:** Prototypes, one-shot tasks, simple scripts

```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(allowed_tools=["Read", "Write"])

async for message in query(prompt="Hello Claude!", options=options):
    print(message)
```

**Pros:**
- Minimal code
- Easy to understand
- Great for learning

**Cons:**
- No session control
- Can't send follow-ups
- Limited for production

### Option B: ClaudeSDKClient - Production Ready ⭐ RECOMMENDED

**Best for:** Production apps, interactive systems, multi-turn conversations

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

options = ClaudeAgentOptions(allowed_tools=["Read", "Write"])
client = ClaudeSDKClient(options=options)

async with client:
    await client.connect()
    await client.query("Hello Claude!")

    async for message in client.receive_messages():
        print(message)
        if isinstance(message, ResultMessage):
            break

    # Can send follow-up queries!
    await client.query("Tell me more")
```

**Pros:**
- Full session control
- Multi-turn capable
- Interrupt support
- Production-ready
- Better error handling

**Cons:**
- Slightly more code
- Need to manage lifecycle

**📚 Recommendation:** Learn with `query()`, build with `ClaudeSDKClient`.

---

## Run Examples

### Beginner Examples (5 minutes each)

#### 1. Simple Query
```bash
python examples/client_example_01_simple_query.py
```
Learn the basic pattern of connecting, querying, and processing responses.

#### 2. Subagent Delegation
```bash
python examples/client_example_02_with_subagent.py
```
See how to delegate work to specialized subagents for code review.

#### 3. File Context
```bash
python examples/client_example_03_file_context.py
```
Learn how to use files for context offloading in multi-phase tasks.

#### 4. MCP Integration
```bash
python examples/client_example_04_appwrite.py
```
Connect to external services using MCP (requires `.mcp.json` config).

### Advanced Example (15 minutes)

#### Deep Research Agent
```bash
python examples/deep_research_agent/deep_research_agent_client.py
```
Production-ready research agent with:
- Isolated filesystem
- 3 specialized subagents
- Todo tracking
- Comprehensive logging

---

## ClaudeSDKClient: Production Pattern

### Basic Pattern

```python
import asyncio
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AssistantMessage,
    ResultMessage,
    SystemMessage
)

async def main():
    # 1. Configure options
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Glob", "Grep"],
        permission_mode='acceptEdits'
    )

    # 2. Create client
    client = ClaudeSDKClient(options=options)

    # 3. Use async context manager
    async with client:
        # 4. Connect
        await client.connect()

        # 5. Send query
        await client.query("Your prompt here")

        # 6. Process messages
        async for message in client.receive_messages():
            if isinstance(message, AssistantMessage):
                # Handle assistant responses
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)

            elif isinstance(message, ResultMessage):
                # Handle completion
                print(f"Done! Cost: ${message.usage.total_cost_usd}")
                break

            elif isinstance(message, SystemMessage):
                # Track session info
                print(f"Session: {message.session_id}")

asyncio.run(main())
```

### Multi-Turn Pattern

```python
async with client:
    await client.connect()

    # First query
    await client.query("Analyze this code")
    async for message in client.receive_messages():
        if isinstance(message, ResultMessage):
            break

    # Follow-up query in same session
    await client.query("Now refactor it")
    async for message in client.receive_messages():
        if isinstance(message, ResultMessage):
            break
```

---

## Configuration

### Basic Configuration

```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    # Tools
    allowed_tools=["Read", "Write", "Glob", "Grep"],

    # Working directory
    cwd=".",

    # Additional directories
    add_dirs=["./data", "./output"],

    # Permissions
    permission_mode='acceptEdits',  # or 'manual'

    # Limits
    max_turns=10
)
```

### With Subagents

```python
from claude_agent_sdk import AgentDefinition

options = ClaudeAgentOptions(
    allowed_tools=["Task", "Read", "Write"],
    agents={
        'code-reviewer': AgentDefinition(
            description='Expert code review specialist',
            prompt='You are a senior software engineer...',
            tools=['Read', 'Grep', 'Glob'],
            model='sonnet'
        )
    }
)
```

### With MCP Servers

```python
import json

# Load from config file
with open('.mcp.json', 'r') as f:
    mcp_config = json.load(f)

options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=[
        "mcp__appwrite__databases_list",
        "mcp__appwrite__databases_create",
    ]
)
```

---

## Feature Guide

### File Operations

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Edit", "Glob", "Grep"],
    cwd="/path/to/project"
)

await client.query("""
Please:
1. Read all Python files in src/
2. Find functions longer than 50 lines
3. Refactor them into smaller functions
""")
```

### Bash Commands

```python
options = ClaudeAgentOptions(
    allowed_tools=["Bash", "Read"],
    permission_mode='acceptEdits'
)

await client.query("""
Run the test suite and analyze any failures.
""")
```

### Subagent Delegation

```python
options = ClaudeAgentOptions(
    allowed_tools=["Task"],
    agents={
        'security-analyst': AgentDefinition(
            description='Security vulnerability expert',
            prompt='You analyze code for security issues...',
            tools=['Read', 'Grep', 'Bash'],
            model='sonnet'
        )
    }
)

await client.query("""
Use the security-analyst subagent to audit this codebase
for common vulnerabilities.
""")
```

### Context Offloading

```python
import tempfile

# Create workspace
workspace = tempfile.mkdtemp()

options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write"],
    cwd=workspace
)

async with client:
    await client.connect()

    # Phase 1: Research
    await client.query(f"""
    Research AI agents and write findings to {workspace}/findings.md
    """)
    async for message in client.receive_messages():
        if isinstance(message, ResultMessage):
            break

    # Phase 2: Synthesize
    await client.query(f"""
    Read {workspace}/findings.md and create a comprehensive
    summary in {workspace}/summary.md
    """)
    async for message in client.receive_messages():
        if isinstance(message, ResultMessage):
            break
```

---

## Common Patterns

### Pattern 1: Code Analysis

```python
await client.query("""
Analyze all Python files in the src/ directory:
1. Identify functions longer than 50 lines
2. Find code duplication
3. Suggest refactorings
4. Write report to analysis.md
""")
```

### Pattern 2: Multi-Step Task

```python
await client.query("""
Please complete this workflow:
1. Read requirements.txt
2. Check for outdated packages
3. Update them if safe
4. Run tests to verify
5. Report results
""")
```

### Pattern 3: Research & Synthesis

```python
await client.query("""
Research task:
1. Use researcher subagent to gather information
2. Write findings to /context/findings.md
3. Use synthesizer subagent to create summary
4. Output to /output/summary.md
""")
```

---

## Best Practices

### ✅ DO

1. **Use async context managers** - Ensures cleanup
```python
async with client:
    # Your code
```

2. **Handle message types explicitly**
```python
if isinstance(message, AssistantMessage):
    # Process
elif isinstance(message, ResultMessage):
    # Complete
```

3. **Defensive usage metrics**
```python
if isinstance(usage, dict):
    cost = usage.get('total_cost_usd', 0.0)
else:
    cost = getattr(usage, 'total_cost_usd', 0.0)
```

4. **Set appropriate permissions**
```python
permission_mode='acceptEdits'  # For automation
permission_mode='manual'       # For interactive
```

5. **Limit tool access**
```python
allowed_tools=["Read", "Grep"]  # Only what's needed
```

### ❌ DON'T

1. **Don't forget to connect**
```python
# WRONG
async with client:
    await client.query("Hello")  # Missing connect()

# RIGHT
async with client:
    await client.connect()
    await client.query("Hello")
```

2. **Don't ignore ResultMessage**
```python
# WRONG - infinite loop
async for message in client.receive_messages():
    print(message)

# RIGHT - break on completion
async for message in client.receive_messages():
    print(message)
    if isinstance(message, ResultMessage):
        break
```

3. **Don't give unnecessary tools**
```python
# WRONG - too permissive
allowed_tools=["*"]

# RIGHT - specific tools
allowed_tools=["Read", "Write"]
```

---

## Troubleshooting

### Import Error

```
ModuleNotFoundError: No module named 'claude_agent_sdk'
```

**Fix:**
```bash
pip install claude-agent-sdk anyio
```

### API Key Not Found

```
Error: Anthropic API key not found
```

**Fix:**
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### Usage Metrics Error

```
AttributeError: 'dict' object has no attribute 'input_tokens'
```

**Fix:** Use defensive handling:
```python
if isinstance(usage, dict):
    tokens = usage.get('input_tokens', 0)
else:
    tokens = getattr(usage, 'input_tokens', 0)
```

### MCP Config Not Found

```
FileNotFoundError: .mcp.json
```

**Fix:** Run from project root or use full path:
```python
with open('/full/path/to/.mcp.json', 'r') as f:
    config = json.load(f)
```

---

## Next Steps

### Path 1: Learning (1-2 hours)
1. Run `client_example_01_simple_query.py`
2. Run `client_example_02_with_subagent.py`
3. Run `client_example_03_file_context.py`
4. Read `examples/CLIENT_EXAMPLES_README.md`

### Path 2: Building (2-4 hours)
1. Study `deep_research_agent_client.py`
2. Review its architecture
3. Adapt patterns to your use case
4. Read `docs/README_EXAMPLES.md`

### Path 3: Production (1 day)
1. Review all examples
2. Read `docs/guides/python_sdk_docs.md`
3. Design your agent architecture
4. Implement with ClaudeSDKClient
5. Add error handling and logging
6. Test thoroughly

---

## Additional Resources

### Documentation
- **Examples Guide:** `docs/README_EXAMPLES.md`
- **Full SDK Docs:** `docs/guides/python_sdk_docs.md`
- **Quick Reference:** `docs/QUICK_REFERENCE.md`
- **MCP Guide:** `docs/README_EXTERNAL_MCP.md`

### Examples
- **Client Examples:** `examples/CLIENT_EXAMPLES_README.md`
- **Deep Research Agent:** `examples/deep_research_agent/README.md`

### External
- [Claude Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk/overview)
- [GitHub Repository](https://github.com/anthropics/claude-agent-sdk-python)
- [PyPI Package](https://pypi.org/project/claude-agent-sdk/)

---

## Quick Reference Card

```python
# Import
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

# Configure
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write"],
    permission_mode='acceptEdits'
)

# Create & Connect
client = ClaudeSDKClient(options=options)
async with client:
    await client.connect()

    # Query
    await client.query("Your prompt")

    # Process
    async for message in client.receive_messages():
        if isinstance(message, ResultMessage):
            break
```

---

## Get Help

- **Examples not working?** Check [Troubleshooting](#troubleshooting)
- **Need specific feature?** See [Feature Guide](#feature-guide)
- **Building something complex?** Study the [Deep Research Agent](../examples/deep_research_agent/README.md)
- **Still stuck?** Check GitHub issues or documentation

---

**Ready to build?** Start with `python examples/client_example_01_simple_query.py`

Happy building! 🚀
