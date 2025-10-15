# Claude Agent SDK - Quick Reference

## Installation

```bash
pip install claude-agent-sdk anyio
```

## Basic Usage

```python
import anyio
from claude_agent_sdk import query

async def main():
    async for message in query(prompt="What is 2 + 2?"):
        print(message)

anyio.run(main)
```

---

## 1. File Input

### Basic Configuration
```python
from claude_agent_sdk import ClaudeAgentOptions

options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Glob", "Grep"],
    cwd=".",  # Working directory
    add_dirs=["./extra_dir"]  # Additional directories
)
```

### Example
```python
prompt = "Read and analyze config.json"
async for msg in query(prompt=prompt, options=options):
    print(msg)
```

---

## 2. Subagents

### A. Programmatic Subagents

```python
options = ClaudeAgentOptions(
    agents={
        'code-reviewer': {
            'description': 'Use for code quality reviews',
            'prompt': 'You are a senior engineer...',
            'tools': ['Read', 'Grep'],
            'model': 'sonnet'
        }
    }
)
```

### B. Filesystem Subagents

**Location:** `.claude/agents/my-agent.md`

**Format:**
```markdown
---
name: sql-expert
description: SQL optimization expert
tools: Read, Grep, Bash
model: sonnet
---

System prompt goes here...
```

**Load in Code:**
```python
options = ClaudeAgentOptions(
    setting_sources=["project"]  # Loads .claude/ configs
)
```

---

## 3. Custom MCP Tools

### Define Tool
```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("greet", "Greet user", {"name": str})
async def greet(args):
    return {
        "content": [
            {"type": "text", "text": f"Hello {args['name']}!"}
        ]
    }
```

### Create Server
```python
server = create_sdk_mcp_server(
    name="my-tools",
    version="1.0.0",
    tools=[greet]
)
```

### Use with Agent
```python
options = ClaudeAgentOptions(
    mcp_servers={"tools": server},
    allowed_tools=["mcp__tools__greet"]
)
```

**Tool Naming:** `mcp__<server>__<tool>`

---

## Combined Example

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, query, ClaudeAgentOptions

# 1. Define custom tool
@tool("analyze", "Analyze text", {"text": str})
async def analyze(args):
    word_count = len(args["text"].split())
    return {
        "content": [{"type": "text", "text": f"Words: {word_count}"}]
    }

# 2. Create MCP server
server = create_sdk_mcp_server(
    name="text-tools",
    version="1.0.0",
    tools=[analyze]
)

# 3. Configure agent
options = ClaudeAgentOptions(
    # File access
    allowed_tools=["Read", "mcp__text-tools__analyze"],
    cwd=".",

    # MCP tools
    mcp_servers={"text-tools": server},

    # Subagents
    agents={
        'analyzer': {
            'description': 'Text analysis expert',
            'prompt': 'You analyze text...',
            'tools': ['Read'],
            'model': 'sonnet'
        }
    },

    # Load filesystem configs
    setting_sources=["project"],
    permission_mode='acceptEdits'
)

# 4. Execute
async def main():
    async for msg in query(
        prompt="Analyze README.md",
        options=options
    ):
        print(msg)

anyio.run(main)
```

---

## Common Options

```python
ClaudeAgentOptions(
    # File access
    allowed_tools=["Read", "Write", "Glob", "Grep", "Bash"],
    cwd=".",
    add_dirs=["./extra"],

    # Tools
    mcp_servers={"server": server},

    # Subagents
    agents={"name": {...}},
    setting_sources=["project"],

    # Behavior
    permission_mode='acceptEdits',  # or 'manual'
    system_prompt="Custom prompt",
    max_turns=10,
    model='sonnet'  # or 'opus', 'haiku'
)
```

---

## Built-in Tools

- `Read` - Read files
- `Write` - Write files
- `Edit` - Edit files
- `Glob` - File patterns
- `Grep` - Search files
- `Bash` - Shell commands
- `Task` - Subtasks
- `WebFetch` - Fetch URLs
- `WebSearch` - Search web

---

## Error Handling

```python
try:
    async for message in query(prompt="...", options=options):
        if hasattr(message, 'content'):
            for block in message.content:
                if hasattr(block, 'text'):
                    print(block.text)
except Exception as e:
    print(f"Error: {e}")
```

---

## Tips

1. **File Access:** Always specify `allowed_tools`
2. **Subagents:** Use clear descriptions for automatic selection
3. **MCP Tools:** Keep tools focused and well-documented
4. **Permissions:** Use `acceptEdits` for automation
5. **Cost Control:** Set `max_turns` appropriately
6. **Debugging:** Check tool naming format

---

## Examples in This Directory

- `simple_agent.py` - Basic agent
- `example_file_input.py` - File operations
- `example_subagents.py` - Subagent creation
- `example_mcp_tools.py` - Custom tools
- `example_comprehensive.py` - All features combined

---

## Documentation

- [Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk/overview)
- [GitHub](https://github.com/anthropics/claude-agent-sdk-python)
- [PyPI](https://pypi.org/project/claude-agent-sdk/)
