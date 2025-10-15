# Deep Research Agent

A context engineering agent system with isolated filesystem and specialized subagents for deep research tasks.

## Overview

This agent demonstrates:
- **Isolated Filesystem**: Each execution gets temporary workspace for context engineering
- **User Query Input**: Takes research query to start deep research session
- **Specialized Subagents**: Researcher, Data Manager, Synthesizer
- **Context Engineering**: Files used to offload context between agents
- **Built-in Todo Tracking**: Progress monitoring throughout execution
- **Optional Appwrite**: MCP tools available when explicitly prompted
- **Comprehensive Logging**: Detailed logs throughout execution

## Two Implementations Available

This directory contains two implementations of the Deep Research Agent:

### 1. **query()-based** (`deep_research_agent_full.py`)
- Uses `query()` function from Claude Agent SDK
- Simple fire-and-forget pattern
- Single async iterator over messages
- Best for: One-shot research tasks

### 2. **ClaudeSDKClient-based** (`deep_research_agent_client.py`) ⭐ RECOMMENDED
- Uses `ClaudeSDKClient` for stateful conversation management
- Explicit connection lifecycle
- Better session control and potential for interactive features
- Best for: Production use, interactive research, multi-turn conversations

**Both implementations provide identical core functionality** - the only difference is the API client pattern used.

## Architecture

```
User Query
    ↓
ContextEngineeringAgent
    │
    ├─ Creates: /tmp/agent_<uuid>/
    │           ├── /context/    (key findings)
    │           ├── /research/   (detailed analysis)
    │           ├── /data/       (data summaries)
    │           └── /output/     (final synthesis)
    │
    ├─ Delegates to Subagents:
    │  ├── Researcher    (deep research)
    │  ├── Data Manager  (optional Appwrite)
    │  └── Synthesizer   (final synthesis)
    │
    └─ Cleanup filesystem when done
```

## Files

- **`deep_research_agent_full.py`** - Original implementation using `query()`
- **`deep_research_agent_client.py`** - ClaudeSDKClient implementation (recommended)
- **`context_engineering_agent.py`** - Earlier prototype version
- **`run_example.py`** - Interactive example runner
- **`README.md`** - This file

## Quick Start

### Option A: Using ClaudeSDKClient (Recommended)

```python
import asyncio
from deep_research_agent_client import DeepResearchAgent

async def main():
    # Initialize agent
    agent = DeepResearchAgent()

    # User's research query
    user_query = """
    Research: "Modern approaches to AI agent systems"

    Steps:
    1. Use researcher subagent to research thoroughly
    2. Document findings in /context/findings.md
    3. Write detailed analysis to /research/
    4. Use synthesizer to create final summary
    """

    # Execute
    result = await agent.execute(user_query)

    print(f"Completed: {result['execution_id']}")
    print(f"Files: {result['output_files']}")
    print(f"Workspace: {result['workspace']}")

asyncio.run(main())
```

### Option B: Using query() Function

```python
import asyncio
from deep_research_agent_full import DeepResearchAgent

async def main():
    agent = DeepResearchAgent()
    result = await agent.execute("Research: Your topic here")
    print(f"Completed: {result['execution_id']}")

asyncio.run(main())
```

### 2. Run Interactive Examples

```bash
# From the deep_research_agent directory
python run_example.py
```

Then select an example:
1. Basic Research
2. Research with Appwrite Integration
3. Multi-Topic Deep Dive

### 3. Run with Main Script

```bash
# Run ClaudeSDKClient version (recommended)
python deep_research_agent_client.py

# Or run query() version
python deep_research_agent_full.py
```

## Configuration

The agent requires:
- **`.mcp.json`** in the project root with Appwrite configuration
- **Anthropic API key** in environment or config

### MCP Configuration

The agent loads MCP servers from `.mcp.json`:

```json
{
  "mcpServers": {
    "appwrite": {
      "type": "stdio",
      "command": "env",
      "args": ["APPWRITE_PROJECT_ID=...", ...]
    }
  }
}
```

## Logging

The agent provides comprehensive logging at multiple levels:

### Log Categories

- **`[IsolatedFS]`** - Filesystem operations
- **`[Agent]`** - Agent initialization and configuration
- **`[Progress]`** - Todo tracking and progress updates
- **`[Execution]`** - Execution flow and status
- **`[Usage]`** - Token usage and costs

### Log Levels

```python
logging.basicConfig(level=logging.INFO)  # Default
logging.basicConfig(level=logging.DEBUG)  # Detailed
```

### Example Log Output

```
2025-01-14 19:52:00 - [Agent] Initializing ContextEngineeringAgent
2025-01-14 19:52:00 - [Agent] Execution ID: abc123
2025-01-14 19:52:00 - [Agent] ✓ Loaded MCP configuration
2025-01-14 19:52:00 - [IsolatedFS] Setting up directory structure...
2025-01-14 19:52:00 - [IsolatedFS] Created directory: context/
2025-01-14 19:52:00 - [IsolatedFS] Created directory: research/
2025-01-14 19:52:00 - [Execution] Starting Deep Research Session
2025-01-14 19:52:01 - [Progress] Todo Update: 0/5 completed | 1 in progress | 4 pending
2025-01-14 19:52:01 - [Progress] → Currently working on: Research background
```

## Subagents

### Researcher
- Conducts deep research
- Writes to `/context/findings.md` and `/research/<topic>.md`
- Tools: Read, Write, Grep, Glob, TodoWrite

### Data Manager
- Optional Appwrite MCP access (only when prompted)
- Writes to `/data/` directory
- Tools: Read, Write, TodoWrite, Appwrite MCP tools

### Synthesizer
- Reads all workspace files
- Creates final synthesis in `/output/summary.md`
- Tools: Read, Write, Glob, TodoWrite

## Features

### Input/Output

**Input**: User's research query (string)
```python
user_query = "Research: Your topic here"
```

**Output**: Execution results (dict)
```python
{
    "execution_id": "abc123",
    "session_id": "session-xyz",
    "result": "...",
    "todos": [...],
    "cost_usd": 0.1234,
    "output_files": [...],
    "workspace": "/tmp/agent_abc123_xyz/"
}
```

### Context Engineering

The agent uses files for context offloading:

1. **Researcher** writes findings → files in `/context/` and `/research/`
2. **Synthesizer** reads all files → creates summary in `/output/`
3. Files persist during execution, cleaned up after

### Todo Tracking

Built-in `TodoWrite` tool tracks progress:

```python
# Agent monitors todos automatically
def _process_assistant_message(self, message):
    # Extracts and logs todo updates
    # Shows: completed/total, in_progress, pending
```

### Appwrite Integration

Appwrite MCP tools are available but only used when explicitly prompted:

```python
user_query = """
Research: "Your topic"

Steps:
1. Research the topic
2. Use data-manager to query Appwrite for previous findings  # Explicit
3. Build on existing data
"""
```

## Implementation Status

✅ **Fully Implemented:**
- IsolatedFilesystem with automatic cleanup
- DeepResearchAgent structure
- Subagent definitions with detailed prompts
- Comprehensive logging throughout
- Todo monitoring pattern
- MCP configuration loading
- **ClaudeSDKClient integration** ⭐
- **query() function integration**
- Real message streaming and processing
- Live subagent orchestration
- Real-time todo updates

## Comparison: query() vs ClaudeSDKClient

| Feature | query() | ClaudeSDKClient |
|---------|---------|-----------------|
| **Connection** | Implicit | Explicit lifecycle |
| **Pattern** | Fire-and-forget | Stateful conversation |
| **Session Control** | Limited | Full control |
| **Multi-turn** | Single execution | Can send follow-ups |
| **Interrupts** | Not supported | Supported |
| **Use Case** | Simple tasks | Production/Interactive |
| **Code Complexity** | Simpler | Slightly more complex |
| **Flexibility** | Lower | Higher |

**Recommendation:** Use `deep_research_agent_client.py` (ClaudeSDKClient) for production applications and when you might need interactive features.

## Specification

Full specification available at:
- `tasks/deep_research_agent_spec.md` (v2.0 Simplified)

## Next Steps

1. **Integrate ClaudeSDKClient**: Replace placeholder with actual SDK client
2. **Test with Real Queries**: Run actual research tasks
3. **Monitor Performance**: Track costs, tokens, execution time
4. **Iterate on Prompts**: Refine subagent prompts based on results

## Troubleshooting

### MCP Config Not Found
```
Error: [Errno 2] No such file or directory: '.mcp.json'
```
**Solution**: Run from project root or provide full path to `.mcp.json`

### Appwrite Connection Issues
Check:
- Appwrite credentials in `.mcp.json`
- MCP server installation: `uvx mcp-server-appwrite`
- Network connectivity to Appwrite endpoint

### Import Errors
```
ModuleNotFoundError: No module named 'anthropic'
```
**Solution**:
```bash
pip install anthropic
# or
pip install -r requirements.txt
```

## License

See project LICENSE file.
