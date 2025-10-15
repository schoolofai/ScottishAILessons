# Claude Agent SDK Examples

This directory contains comprehensive examples demonstrating how to use the Claude Agent SDK with Python.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Two Approaches](#two-approaches-query-vs-claudesdkclient)
- [ClaudeSDKClient Examples](#claudesdkclient-examples-recommended)
- [Deep Research Agent](#deep-research-agent)
- [Legacy query() Examples](#legacy-query-examples)
- [Configuration Guide](#configuration-guide)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Python 3.10+
- Claude Agent SDK installed: `pip install claude-agent-sdk anyio`
- Virtual environment activated
- Anthropic API key configured

---

## Quick Start

**For beginners**, start with the ClaudeSDKClient examples:

```bash
# Activate virtual environment
source venv/bin/activate

# Run the simplest example
python examples/client_example_01_simple_query.py
```

**For production applications**, see the [Deep Research Agent](#deep-research-agent).

---

## Two Approaches: query() vs ClaudeSDKClient

The SDK provides two ways to interact with Claude agents:

### 1. query() Function (Simple)

Best for: **Quick, one-shot tasks**

```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(allowed_tools=["Read", "Write"])

async for message in query(prompt="Analyze this code", options=options):
    if message.type == "AssistantMessage":
        print(message.content)
```

**Pros:** Simple, concise, less boilerplate
**Cons:** No session control, can't send follow-ups, limited flexibility

### 2. ClaudeSDKClient (Stateful) ⭐ RECOMMENDED

Best for: **Production apps, interactive sessions, multi-turn conversations**

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

options = ClaudeAgentOptions(allowed_tools=["Read", "Write"])
client = ClaudeSDKClient(options=options)

async with client:
    await client.connect()
    await client.query("Analyze this code")

    async for message in client.receive_messages():
        if isinstance(message, AssistantMessage):
            print(message.content)
        elif isinstance(message, ResultMessage):
            break

    # Can send follow-up queries in same session!
    await client.query("Now refactor it")
```

**Pros:** Full session control, multi-turn capable, interrupt support, production-ready
**Cons:** Slightly more verbose

---

## ClaudeSDKClient Examples (Recommended)

These examples demonstrate the **stateful ClaudeSDKClient** pattern for production use.

### 1. Simple Query/Response
**File:** `examples/client_example_01_simple_query.py`

Learn the basic ClaudeSDKClient pattern.

**Features:**
- Connection lifecycle management
- Basic message processing
- Usage metrics tracking

**Run:**
```bash
python examples/client_example_01_simple_query.py
```

**Key Pattern:**
```python
client = ClaudeSDKClient(options=options)
async with client:
    await client.connect()
    await client.query(prompt)
    async for message in client.receive_response():
        # Process messages
        if isinstance(message, ResultMessage):
            break
```

---

### 2. Subagent Delegation
**File:** `examples/client_example_02_with_subagent.py`

Learn how to delegate work to specialized subagents.

**Features:**
- AgentDefinition for subagents
- Task tool usage
- Code review specialist pattern

**Run:**
```bash
python examples/client_example_02_with_subagent.py
```

**Key Pattern:**
```python
code_reviewer = AgentDefinition(
    description='Code review specialist',
    prompt='You are a senior software engineer...',
    tools=['Read', 'Grep', 'Glob'],
    model='sonnet'
)

options = ClaudeAgentOptions(
    agents={'code-reviewer': code_reviewer},
    allowed_tools=['Task', 'Read', 'Glob']
)
```

---

### 3. File-Based Context Offloading
**File:** `examples/client_example_03_file_context.py`

Learn how to manage large context using files.

**Features:**
- Multi-phase conversations
- Context engineering with files
- Workspace management
- Building on previous outputs

**Run:**
```bash
python examples/client_example_03_file_context.py
```

**Key Pattern:**
```python
# Phase 1: Initial research
await client.query("Research topic and write to context/findings.md")
async for message in client.receive_response():
    if isinstance(message, ResultMessage):
        break

# Phase 2: Build on context
await client.query("Read context/findings.md and expand analysis")
async for message in client.receive_response():
    if isinstance(message, ResultMessage):
        break
```

---

### 4. External MCP Integration (Appwrite)
**File:** `examples/client_example_04_appwrite.py`

Learn how to integrate external MCP servers.

**Features:**
- Loading MCP configuration from `.mcp.json`
- Multi-turn database operations
- External service integration
- Appwrite database creation

**Run:**
```bash
python examples/client_example_04_appwrite.py
```

**Key Pattern:**
```python
# Load MCP servers from config
with open('.mcp.json', 'r') as f:
    mcp_config = json.load(f)

options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=[
        "mcp__appwrite__databases_list",
        "mcp__appwrite__databases_create",
        # ... other Appwrite tools
    ]
)
```

**📚 Full Documentation:** See `examples/CLIENT_EXAMPLES_README.md` for complete details on all 4 examples.

---

## Deep Research Agent

A production-ready research agent system demonstrating advanced patterns.

**Location:** `examples/deep_research_agent/`

### Features

- **Isolated Filesystem**: Temporary workspace per execution
- **Specialized Subagents**: Researcher, Data Manager, Synthesizer
- **Context Engineering**: Files used for context offloading
- **Todo Tracking**: Built-in progress monitoring
- **Optional Appwrite**: MCP tools when prompted
- **Comprehensive Logging**: Detailed execution logs

### Two Implementations

#### ClaudeSDKClient Version ⭐ RECOMMENDED
**File:** `deep_research_agent_client.py`

Production-ready implementation with stateful conversation management.

```bash
python examples/deep_research_agent/deep_research_agent_client.py
```

**Use for:** Production deployments, interactive research, multi-turn sessions

#### query() Version
**File:** `deep_research_agent_full.py`

Simpler implementation using fire-and-forget pattern.

```bash
python examples/deep_research_agent/deep_research_agent_full.py
```

**Use for:** One-shot research tasks, simpler use cases

### Quick Start Example

```python
from deep_research_agent_client import DeepResearchAgent

async def main():
    agent = DeepResearchAgent()

    user_query = """
    Research: "Modern approaches to AI agent systems"

    Steps:
    1. Use researcher subagent to research thoroughly
    2. Document findings in /context/findings.md
    3. Write detailed analysis to /research/
    4. Use synthesizer to create final summary
    """

    result = await agent.execute(user_query)
    print(f"Completed: {result['execution_id']}")
    print(f"Workspace: {result['workspace']}")
```

**📚 Full Documentation:** See `examples/deep_research_agent/README.md`

---

## Legacy query() Examples

These examples use the simpler `query()` function pattern. They're great for learning basics but less suitable for production.

### example_file_input.py
Learn how to provide files as input to Claude agents.

**Run:** `python examples/example_file_input.py`

### example_subagents.py
Learn how to create and use specialized subagents.

**Run:** `python examples/example_subagents.py`

### example_mcp_tools.py
Learn how to create custom tools using MCP.

**Run:** `python examples/example_mcp_tools.py`

### example_comprehensive.py
Combined example with files, subagents, and MCP tools.

**Run:** `python examples/example_comprehensive.py`

### simple_agent.py
Most basic example of the SDK.

**Run:** `python examples/simple_agent.py`

---

## Configuration Guide

### ClaudeAgentOptions

```python
from claude_agent_sdk import ClaudeAgentOptions, AgentDefinition

options = ClaudeAgentOptions(
    # File Access
    allowed_tools=["Read", "Write", "Glob", "Grep"],
    cwd=".",
    add_dirs=["./extra_dir"],

    # MCP Servers
    mcp_servers={"appwrite": server_config},

    # Subagents
    agents={
        'agent-name': AgentDefinition(
            description='When to use this agent',
            prompt='System prompt for the agent',
            tools=['Read', 'Write'],
            model='sonnet'  # or 'opus', 'haiku'
        )
    },

    # Settings
    setting_sources=["project"],  # Load .claude/ configs
    permission_mode='acceptEdits',
    system_prompt="Your custom system prompt",
    max_turns=10
)
```

### Available Built-in Tools

- `Read` - Read file contents
- `Write` - Write to files
- `Edit` - Edit existing files
- `Glob` - File pattern matching
- `Grep` - Search file contents
- `Bash` - Execute bash commands
- `Task` - Delegate to subagents
- `TodoWrite` - Track progress
- And more...

### MCP Tool Naming Convention

When using MCP tools, they follow this pattern:
```
mcp__<server_name>__<tool_name>
```

Example:
```python
allowed_tools=[
    "mcp__appwrite__databases_list",
    "mcp__appwrite__databases_create",
]
```

---

## Best Practices

### Choosing an Approach

**Use ClaudeSDKClient when:**
- Building production applications
- Need multi-turn conversations
- Want explicit session control
- May need to interrupt/pause
- Building interactive systems

**Use query() when:**
- Prototyping quickly
- One-shot tasks
- Simple automation scripts
- Don't need follow-ups

### Connection Management

**Always use async context managers:**
```python
async with client:
    # Your code here
    # Automatic cleanup on exit
```

### Message Handling

**Use isinstance() for type-safe processing:**
```python
if isinstance(message, AssistantMessage):
    # Handle assistant responses
elif isinstance(message, ResultMessage):
    # Handle completion
elif isinstance(message, SystemMessage):
    # Track session info
```

### Usage Metrics

**Handle both dict and object formats:**
```python
if isinstance(usage, dict):
    cost = usage.get('total_cost_usd', 0.0)
else:
    cost = getattr(usage, 'total_cost_usd', 0.0)
```

### Subagents

1. Give subagents clear, focused descriptions
2. Limit tool access to what each subagent needs
3. Use specialized prompts for specific domains
4. Consider filesystem agents (`.claude/agents/*.md`) for reusability

### File Context

1. Use files to offload large context
2. Structure directories logically (`/context/`, `/research/`, `/output/`)
3. Let agents read previous outputs in subsequent phases
4. Clean up temporary workspaces after execution

### MCP Integration

1. Load configurations from `.mcp.json`
2. Specify exact tools in `allowed_tools`
3. Use meaningful server names
4. Handle connection errors gracefully

---

## Troubleshooting

### Import Errors

```bash
# Ensure SDK is installed
pip install claude-agent-sdk anyio

# Verify installation
pip show claude-agent-sdk
```

### Authentication Issues

The SDK requires an Anthropic API key. Set it via:
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

Or in Python:
```python
import os
os.environ['ANTHROPIC_API_KEY'] = 'your-key-here'
```

### Usage Metrics AttributeError

If you see `'dict' object has no attribute 'input_tokens'`, use defensive handling:

```python
if isinstance(usage, dict):
    input_tokens = usage.get('input_tokens', 0)
else:
    input_tokens = getattr(usage, 'input_tokens', 0)
```

### Tool Not Found

- Check tool naming: `mcp__<server>__<tool>`
- Verify tool is in `allowed_tools` list
- Ensure MCP server is in `mcp_servers` dict

### MCP Config Not Found

```
Error: [Errno 2] No such file or directory: '.mcp.json'
```

**Solution:** Run from project root or provide full path

### Subagent Not Loading

- Verify `.claude/agents/` directory exists
- Check YAML frontmatter format in `*.md` files
- Add `setting_sources=["project"]` to options
- Ensure subagent name matches description

---

## Project Structure

```
claude_code_sdk/
├── examples/
│   ├── client_example_01_simple_query.py       # ClaudeSDKClient basics
│   ├── client_example_02_with_subagent.py      # Subagent delegation
│   ├── client_example_03_file_context.py       # Context offloading
│   ├── client_example_04_appwrite.py           # MCP integration
│   ├── CLIENT_EXAMPLES_README.md               # Full examples guide
│   │
│   ├── deep_research_agent/
│   │   ├── deep_research_agent_client.py       # ClaudeSDKClient version ⭐
│   │   ├── deep_research_agent_full.py         # query() version
│   │   ├── README.md                           # Full documentation
│   │   └── run_example.py                      # Interactive demos
│   │
│   ├── example_file_input.py                   # Legacy: File input
│   ├── example_subagents.py                    # Legacy: Subagents
│   ├── example_mcp_tools.py                    # Legacy: MCP tools
│   ├── example_comprehensive.py                # Legacy: Combined
│   └── simple_agent.py                         # Legacy: Basic
│
├── docs/
│   ├── README_EXAMPLES.md                      # This file
│   ├── START_HERE.md                           # Quick start guide
│   ├── QUICK_REFERENCE.md                      # Quick reference
│   └── guides/                                 # Detailed guides
│
└── .mcp.json                                   # MCP server config
```

---

## Running Examples

### ClaudeSDKClient Examples

```bash
# Activate virtual environment
source venv/bin/activate

# Run examples in order
python examples/client_example_01_simple_query.py
python examples/client_example_02_with_subagent.py
python examples/client_example_03_file_context.py
python examples/client_example_04_appwrite.py  # Requires .mcp.json

# Run Deep Research Agent
python examples/deep_research_agent/deep_research_agent_client.py
```

### Legacy Examples

```bash
python examples/simple_agent.py
python examples/example_file_input.py
python examples/example_subagents.py
python examples/example_mcp_tools.py
python examples/example_comprehensive.py
```

---

## Additional Resources

- **Full SDK Documentation:** See `docs/guides/python_sdk_docs.md`
- **Client Examples Guide:** See `examples/CLIENT_EXAMPLES_README.md`
- **Deep Research Agent:** See `examples/deep_research_agent/README.md`
- **MCP External Servers:** See `docs/README_EXTERNAL_MCP.md`
- **Quick Reference:** See `docs/QUICK_REFERENCE.md`

---

## Next Steps

1. **Beginners:** Start with `client_example_01_simple_query.py`
2. **Intermediate:** Work through examples 02-04
3. **Advanced:** Study the Deep Research Agent
4. **Production:** Use ClaudeSDKClient pattern in your applications

---

## License

These examples are provided as educational material for using the Claude Agent SDK.
