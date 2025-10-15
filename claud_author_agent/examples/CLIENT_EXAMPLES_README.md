# ClaudeSDKClient Examples

This directory contains a series of examples demonstrating the use of `ClaudeSDKClient` for building AI agents with the Claude Agent SDK.

## Overview

The `ClaudeSDKClient` provides stateful conversation management, allowing you to build complex agents that maintain context across multiple interactions. Unlike the simple `query()` function, `ClaudeSDKClient` gives you full control over the conversation flow with support for streaming, interrupts, and dynamic message sending.

## When to Use ClaudeSDKClient

Use `ClaudeSDKClient` when you need:
- **Bidirectional communication**: Send and receive messages at any time
- **Stateful conversations**: Maintain context across multiple exchanges
- **Interactive sessions**: Send follow-ups based on responses
- **Control flow**: Support for interrupts and session management
- **Multi-turn workflows**: Complex tasks requiring multiple steps

Use `query()` for:
- Simple one-off questions
- Batch processing of prompts
- Fire-and-forget automation scripts
- When all inputs are known upfront

## Examples

### 1. Simple Query with Response (`client_example_01_simple_query.py`)

**What it demonstrates:**
- Basic `ClaudeSDKClient` initialization
- Sending a simple query
- Receiving and printing the response
- Using async context managers for cleanup
- Accessing usage metrics

**Key concepts:**
- `ClaudeAgentOptions` configuration
- `async with` context manager pattern
- `receive_response()` for single-response workflows
- Processing `AssistantMessage` and `ResultMessage` types

**Run it:**
```bash
python examples/client_example_01_simple_query.py
```

---

### 2. Using Subagents (`client_example_02_with_subagent.py`)

**What it demonstrates:**
- Defining specialized subagents using `AgentDefinition`
- Main orchestrator agent delegating to subagents
- Using the `Task` tool for delegation
- Tracking subagent execution and tool usage

**Key concepts:**
- Creating subagents with custom prompts and tools
- Passing subagents via `agents` parameter
- Task delegation pattern
- Monitoring tool usage during execution

**Run it:**
```bash
python examples/client_example_02_with_subagent.py
```

---

### 3. File Context Offloading (`client_example_03_file_context.py`)

**What it demonstrates:**
- Using files to manage large context
- Creating a workspace for context storage
- Multi-phase conversations building on stored context
- Incremental knowledge building across queries

**Key concepts:**
- Context offloading to files
- Workspace organization
- Multi-turn conversations with persistent state
- Using Read/Write tools for context management
- Building knowledge incrementally

**Run it:**
```bash
python examples/client_example_03_file_context.py
```

---

### 4. Appwrite MCP Integration (`client_example_04_appwrite.py`)

**What it demonstrates:**
- Loading external MCP server configuration
- Using Appwrite database tools via MCP
- Multi-turn database workflows
- Managing database operations with Claude

**Key concepts:**
- External MCP server integration
- Loading configuration from `.mcp.json`
- Using MCP tools (named `mcp__<server>__<tool>`)
- Multi-phase database operations
- Error handling with external services

**Prerequisites:**
- `.mcp.json` file with Appwrite configuration
- Appwrite account and credentials

**Run it:**
```bash
python examples/client_example_04_appwrite.py
```

---

## Common Patterns

### Basic Usage Pattern

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import AssistantMessage, ResultMessage

async def basic_pattern():
    options = ClaudeAgentOptions(
        model='claude-sonnet-4-5',
        max_turns=10,
        permission_mode='acceptEdits'
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect()
        await client.query("Your prompt here")

        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                # Process assistant's response
                for block in message.content:
                    if hasattr(block, 'text'):
                        print(block.text)

            elif isinstance(message, ResultMessage):
                # Session complete
                print(f"Cost: ${message.usage.total_cost_usd:.4f}")
```

### Multi-Turn Conversation Pattern

```python
async def multi_turn_pattern():
    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect()

        # Phase 1
        await client.query("First task")
        async for message in client.receive_response():
            if isinstance(message, ResultMessage):
                break

        # Phase 2 - maintains context from Phase 1
        await client.query("Build on the previous result")
        async for message in client.receive_response():
            if isinstance(message, ResultMessage):
                break
```

### Subagent Delegation Pattern

```python
from claude_agent_sdk.types import AgentDefinition

async def subagent_pattern():
    # Define subagent
    specialist = AgentDefinition(
        description='Specialized agent',
        prompt='You are a specialist in...',
        tools=['Read', 'Write'],
        model='sonnet'
    )

    options = ClaudeAgentOptions(
        agents={'specialist': specialist},
        allowed_tools=['Task'],
        system_prompt='Delegate work to specialist subagent'
    )

    # Main agent will use Task tool to delegate
    client = ClaudeSDKClient(options=options)
    # ... rest of pattern
```

## Configuration Options

### ClaudeAgentOptions

```python
options = ClaudeAgentOptions(
    # Model selection
    model='claude-sonnet-4-5',

    # Conversation limits
    max_turns=20,

    # Tool configuration
    allowed_tools=['Read', 'Write', 'Edit', 'Task'],
    denied_tools=None,

    # Permission management
    permission_mode='acceptEdits',  # or 'default', 'bypassPermissions'

    # Custom prompts
    system_prompt='Your custom system prompt',

    # Subagents
    agents={'name': AgentDefinition(...)},

    # MCP servers
    mcp_servers={'server_name': {...}},

    # Session control
    continue_conversation=True,
    resume='session-id-to-resume',
    fork_session=False
)
```

## Best Practices

1. **Always use async context managers** (`async with`) for automatic cleanup
2. **Track session IDs** for resuming or forking conversations
3. **Implement error handling** for robust agents
4. **Use files for large context** instead of keeping everything in memory
5. **Monitor costs** by tracking usage in `ResultMessage`
6. **Organize workspaces** when using file-based context
7. **Define clear subagent responsibilities** for better delegation
8. **Use descriptive prompts** in `AgentDefinition` for subagents

## Error Handling

```python
from claude_agent_sdk._errors import CLIConnectionError

try:
    async with client:
        await client.connect()
        await client.query("Your task")

        async for message in client.receive_response():
            if isinstance(message, ResultMessage):
                if message.subtype == "error":
                    print(f"Agent error: {message.result}")
                    # Handle error
                else:
                    # Success
                    return message.result

except CLIConnectionError as e:
    print(f"Connection error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

## Next Steps

1. Start with `client_example_01_simple_query.py` to understand basics
2. Explore `client_example_02_with_subagent.py` for task delegation
3. Learn context management with `client_example_03_file_context.py`
4. Integrate external services with `client_example_04_appwrite.py`

## Additional Resources

- [Claude Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/python)
- [Deep Research Agent Example](deep_research_agent/deep_research_agent_full.py) - Production-ready agent with comprehensive features
- [MCP External Servers Guide](../MCP_EXTERNAL_SERVERS.md) - Guide for integrating external MCP servers

## Troubleshooting

**Connection issues:**
- Ensure Claude Code CLI is installed
- Check API key or authentication method
- Verify network connectivity

**MCP server issues:**
- Verify `.mcp.json` configuration
- Check external service credentials
- Ensure MCP server process is accessible

**Tool permission issues:**
- Review `allowed_tools` configuration
- Check `permission_mode` setting
- Verify tool names are correct (especially for MCP: `mcp__<server>__<tool>`)

---

Created: 2025-10-15
SDK Version: 0.0.20+
