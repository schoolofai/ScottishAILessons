# Claude Agent SDK Examples & Documentation

Complete examples and documentation for building AI agents with the Claude Agent SDK in Python.

## 🚀 Quick Start

### 1. Test Basic Agent
```bash
./run_agent_no_key.sh
```

### 2. Run Examples
```bash
# File operations
./venv/bin/python examples/example_file_input.py

# Subagents
./venv/bin/python examples/example_subagents.py

# Custom MCP tools
./venv/bin/python examples/example_mcp_tools.py

# External MCP (Appwrite)
./venv/bin/python examples/test_appwrite_connection.py
./venv/bin/python examples/example_external_mcp_appwrite.py
```

---

## 📚 Documentation

Start here: **[docs/START_HERE.md](docs/START_HERE.md)**

### Core Guides
- **[START_HERE.md](docs/START_HERE.md)** - Begin your journey here
- **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Quick syntax reference
- **[SUMMARY.md](docs/SUMMARY.md)** - Research findings and best practices

### Detailed Documentation
- **[README_EXAMPLES.md](docs/README_EXAMPLES.md)** - Complete guide to all examples
- **[MCP_EXTERNAL_SERVERS.md](docs/MCP_EXTERNAL_SERVERS.md)** - External MCP server guide
- **[README_EXTERNAL_MCP.md](docs/README_EXTERNAL_MCP.md)** - Appwrite integration guide

---

## 📁 Project Structure

```
claude_code_sdk/
├── examples/                          # All example scripts
│   ├── simple_agent.py               # Basic agent
│   ├── example_file_input.py         # File operations
│   ├── example_subagents.py          # Subagent creation
│   ├── example_mcp_tools.py          # Custom MCP tools
│   ├── example_comprehensive.py      # All features combined
│   ├── example_external_mcp_appwrite.py       # Appwrite basic
│   ├── example_external_mcp_comprehensive.py  # Appwrite advanced
│   └── test_appwrite_connection.py   # Connection test
├── docs/                             # All documentation
│   ├── START_HERE.md                 # Start here!
│   ├── QUICK_REFERENCE.md            # Quick reference
│   ├── README_EXAMPLES.md            # Example guide
│   ├── MCP_EXTERNAL_SERVERS.md       # External MCP guide
│   ├── README_EXTERNAL_MCP.md        # Appwrite guide
│   └── SUMMARY.md                    # Research summary
├── venv/                             # Python virtual environment
├── .mcp.json                         # MCP server config (in .gitignore)
├── .mcp.json.template                # Template for setup
├── .gitignore                        # Git ignore rules
├── run_agent_no_key.sh              # Test script
└── README.md                         # This file
```

---

## 🎯 What's Included

### 1. File Input & Operations
Learn how to provide files as input to agents and perform file operations.

**Example:** `examples/example_file_input.py`

```python
options = ClaudeAgentOptions(
    allowed_tools=["Read", "Write", "Glob", "Grep"],
    cwd="."
)
```

### 2. Subagents
Create specialized AI agents for specific tasks with isolated contexts.

**Example:** `examples/example_subagents.py`

**Programmatic:**
```python
agents={
    'code-reviewer': {
        'description': 'Use for code reviews',
        'prompt': 'You are a senior engineer...',
        'tools': ['Read', 'Grep']
    }
}
```

**Filesystem:** `.claude/agents/my-agent.md`

### 3. Custom MCP Tools (In-Process)
Create custom tools with Python functions.

**Example:** `examples/example_mcp_tools.py`

```python
@tool("greet", "Greet user", {"name": str})
async def greet(args):
    return {"content": [{"type": "text", "text": f"Hello {args['name']}!"}]}

server = create_sdk_mcp_server(name="tools", tools=[greet])
```

### 4. External MCP Servers
Integrate with external services like Appwrite databases.

**Example:** `examples/example_external_mcp_appwrite.py`

```json
// .mcp.json
{
  "mcpServers": {
    "appwrite": {
      "type": "stdio",
      "command": "uvx",
      "args": ["mcp-server-appwrite", "--databases"]
    }
  }
}
```

---

## 🔧 Setup

### Prerequisites
- Python 3.10+
- Virtual environment (already configured)

### Installation
```bash
# Activate virtual environment
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate  # Windows

# Install dependencies (already done)
pip install claude-agent-sdk anyio
```

### Appwrite Setup (Optional)
For external MCP examples:

1. Copy template:
   ```bash
   cp .mcp.json.template .mcp.json
   ```

2. Edit `.mcp.json` with your credentials
3. Test connection:
   ```bash
   ./venv/bin/python examples/test_appwrite_connection.py
   ```

---

## 📖 Learning Path

### Beginner (30 minutes)
1. Read [docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)
2. Run `./run_agent_no_key.sh`
3. Run `examples/example_mcp_tools.py`

### Intermediate (2 hours)
1. Read [docs/README_EXAMPLES.md](docs/README_EXAMPLES.md)
2. Run all examples in `examples/`
3. Review generated files

### Advanced (Half day)
1. Read all docs in `docs/`
2. Study `examples/example_comprehensive.py`
3. Build your own custom agent

---

## ✨ Key Features

### File Operations
- Read/write files
- Search with Glob and Grep
- Directory access control
- Multi-file workflows

### Subagents
- Programmatic definition
- Filesystem definition
- Specialized expertise
- Parallel execution
- Isolated contexts

### In-Process MCP Tools
- Custom Python functions
- Type-safe
- Fast execution
- Easy debugging

### External MCP Servers
- External service integration
- stdio/HTTP/SSE protocols
- Community servers
- Appwrite, databases, APIs

---

## 🎓 Common Use Cases

### Code Analysis
```bash
./venv/bin/python examples/example_file_input.py
```

### Specialized Tasks
```bash
./venv/bin/python examples/example_subagents.py
```

### Custom Functionality
```bash
./venv/bin/python examples/example_mcp_tools.py
```

### Database Integration
```bash
./venv/bin/python examples/example_external_mcp_appwrite.py
```

---

## 🔐 Security Notes

- `.mcp.json` contains credentials (in .gitignore)
- Use `.mcp.json.template` for sharing
- Never commit API keys
- Use `permission_mode='manual'` for sensitive operations

---

## 🌟 Highlights

✅ **Authentication** - Works via Claude Code (no API key needed)
✅ **File Operations** - Complete file manipulation
✅ **Subagents** - Specialized task delegation
✅ **Custom Tools** - In-process and external
✅ **Appwrite Integration** - Full database operations
✅ **Tested** - All examples verified working
✅ **Documented** - Comprehensive guides included

---

## 📚 External Resources

- [Claude Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk/overview)
- [Python SDK GitHub](https://github.com/anthropics/claude-agent-sdk-python)
- [Building Agents Blog](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Appwrite MCP](https://appwrite.io/docs/tooling/mcp)

---

## 🤝 Getting Help

- **Examples not working?** Check Python version (need 3.10+)
- **Import errors?** Activate venv: `source venv/bin/activate`
- **Authentication issues?** Verify Claude Code is installed
- **Tool not found?** Check tool naming format: `mcp__<server>__<tool>`

---

## 🎯 Next Steps

1. **Read** [docs/START_HERE.md](docs/START_HERE.md)
2. **Run** `./run_agent_no_key.sh`
3. **Explore** examples in `examples/`
4. **Study** documentation in `docs/`
5. **Build** your own agent!

---

**Ready to start?** → Open [docs/START_HERE.md](docs/START_HERE.md) and begin! 🚀
