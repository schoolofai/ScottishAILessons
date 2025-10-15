**Source:** https://docs.claude.com/en/api/agent-sdk/python

# Claude Python SDK Documentation

## Overview

The Claude Python SDK provides a comprehensive framework for building complex AI agents that maintain session context across multiple interactions. The SDK is designed around the `ClaudeSDKClient` class, which offers stateful conversation management and advanced features for tool integration, permission control, and lifecycle hooks.

## ClaudeSDKClient Class

The `ClaudeSDKClient` is the primary interface for building agents with persistent session context.

### Class Definition

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions

class ClaudeSDKClient:
    """
    Main client for Claude Agent SDK with session management.
    Maintains conversation context across multiple exchanges.
    """
    def __init__(self, options: ClaudeAgentOptions | None = None)
    async def connect(self, prompt: str | AsyncIterable[dict] | None = None)
    async def query(self, prompt: str | AsyncIterable[dict], session_id: str = "default")
    async def receive_messages(self) -> AsyncIterator[Message]
    async def receive_response(self) -> AsyncIterator[Message]
    async def interrupt(self) -> None
    async def disconnect(self) -> None
```

### Key Characteristics

- **Maintains conversation context** across multiple exchanges
- **Supports continuous, stateful conversations** with context preservation
- **Provides explicit session lifecycle management** for long-running agents
- **Enables custom tool integration** and hook-based behavior modification
- **Supports streaming input/output** for real-time interactions

## Initialization

### Basic Initialization

```python
from anthropic_sdk import ClaudeSDKClient

# Simple initialization with defaults
client = ClaudeSDKClient()

# With custom options
options = ClaudeAgentOptions(
    model="claude-sonnet-4-5",
    max_turns=10,
    allowed_tools=["Read", "Write", "Edit", "Bash"]
)
client = ClaudeSDKClient(options=options)
```

### ClaudeAgentOptions

```python
class ClaudeAgentOptions:
    """Configuration options for ClaudeSDKClient"""

    # Model configuration
    model: str = "claude-sonnet-4-5"

    # Session management
    session_id: str | None = None
    resume: str | None = None  # Resume from existing session
    fork_session: bool = False
    continue_conversation: bool = True

    # Turn limits
    max_turns: int = 10

    # Tool configuration
    allowed_tools: list[str] | None = None
    denied_tools: list[str] | None = None

    # Permission management
    permission_mode: str = "default"  # Options: "default", "acceptEdits", "bypassPermissions"
    can_use_tool: Callable | None = None

    # System prompt configuration
    system_prompt: str | dict | None = None

    # Hook configuration
    hooks: dict[str, list[HookMatcher]] | None = None

    # MCP server configuration
    mcp_servers: dict[str, MCPServerConfig] | None = None

    # Settings sources
    setting_sources: list[str] | None = None
```

## Session Context Management

### Creating and Maintaining Sessions

The ClaudeSDKClient automatically manages session context, allowing complex agents to maintain state across multiple interactions.

#### Basic Session Pattern

```python
import asyncio
from anthropic_sdk import ClaudeSDKClient

async def main():
    client = ClaudeSDKClient()

    # Connect and start session
    async with client:
        # First query - creates new session
        await client.connect("Help me build a REST API")

        async for message in client.receive_messages():
            if message.type == "system" and message.subtype == "init":
                session_id = message.session_id
                print(f"Session created: {session_id}")
            elif message.type == "result":
                print(f"Response: {message.result}")

        # Subsequent queries in same session maintain context
        await client.query("Add authentication to the API")

        async for message in client.receive_messages():
            if message.type == "result":
                print(f"Response: {message.result}")

asyncio.run(main())
```

### Session Resuming

Resume a previous session to continue where you left off:

```python
async def resume_session():
    # Resume from previous session ID
    options = ClaudeAgentOptions(
        resume="session-abc-123",
        continue_conversation=True
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect("Continue implementing the authentication system")

        async for message in client.receive_messages():
            if message.type == "result":
                print(message.result)
```

### Session Forking

Create a new branch from an existing session:

```python
async def fork_session():
    # Fork session to explore alternative approaches
    options = ClaudeAgentOptions(
        resume="session-abc-123",
        fork_session=True  # Creates new session ID, preserves original
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect("Let's try a different approach using GraphQL")

        async for message in client.receive_messages():
            if message.type == "system" and message.subtype == "init":
                new_session_id = message.session_id
                print(f"Forked to new session: {new_session_id}")
```

## Complex Agent Design Patterns

### Pattern 1: Multi-Turn Conversational Agent

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions

class ConversationalAgent:
    def __init__(self):
        self.options = ClaudeAgentOptions(
            model="claude-sonnet-4-5",
            max_turns=20,
            continue_conversation=True,
            allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
        )
        self.client = ClaudeSDKClient(options=self.options)
        self.session_id = None

    async def start(self, initial_prompt: str):
        """Start a new conversation"""
        async with self.client:
            await self.client.connect(initial_prompt)

            async for message in self.client.receive_messages():
                if message.type == "system" and message.subtype == "init":
                    self.session_id = message.session_id
                elif message.type == "assistant":
                    self._process_assistant_message(message)
                elif message.type == "result":
                    return message.result

    async def continue_conversation(self, prompt: str):
        """Continue existing conversation with context"""
        async with self.client:
            await self.client.query(prompt, session_id=self.session_id)

            async for message in self.client.receive_messages():
                if message.type == "result":
                    return message.result

    def _process_assistant_message(self, message):
        """Process assistant messages for tracking"""
        for block in message.message.content:
            if block.type == "tool_use":
                print(f"Using tool: {block.name}")

# Usage
async def main():
    agent = ConversationalAgent()

    # Start conversation
    result1 = await agent.start("Help me build a Python web scraper")
    print(f"Result 1: {result1}")

    # Continue with context
    result2 = await agent.continue_conversation("Add error handling and retry logic")
    print(f"Result 2: {result2}")

    # More context-aware interactions
    result3 = await agent.continue_conversation("Now add tests for the scraper")
    print(f"Result 3: {result3}")
```

### Pattern 2: Streaming Input for Dynamic Interactions

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def stream_messages():
    """Generator that yields messages dynamically"""
    yield {
        "type": "user",
        "message": {
            "role": "user",
            "content": "Analyze this codebase for security vulnerabilities"
        }
    }

    # Can add more messages dynamically
    yield {
        "type": "user",
        "message": {
            "role": "user",
            "content": "Focus specifically on SQL injection risks"
        }
    }

async def dynamic_agent():
    options = ClaudeAgentOptions(
        max_turns=15,
        allowed_tools=["Read", "Grep", "Glob"]
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect(stream_messages())

        async for message in client.receive_messages():
            if message.type == "assistant":
                # Process streaming responses
                print(f"Assistant: {message.message}")
            elif message.type == "result":
                print(f"Final result: {message.result}")
```

### Pattern 3: Agent with Custom Tools

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions, tool, createSdkMcpServer
from zod import z

# Define custom tools
custom_server = createSdkMcpServer({
    "name": "custom-analytics",
    "version": "1.0.0",
    "tools": [
        tool(
            "analyze_metrics",
            "Analyze business metrics and generate insights",
            {
                "metric_type": z.enum(["revenue", "users", "engagement"]),
                "time_period": z.string()
            },
            lambda args: {
                "content": [{
                    "type": "text",
                    "text": f"Analysis for {args['metric_type']} over {args['time_period']}"
                }]
            }
        )
    ]
})

async def analytics_agent():
    options = ClaudeAgentOptions(
        mcp_servers={
            "analytics": custom_server
        },
        allowed_tools=[
            "mcp__analytics__analyze_metrics",
            "Read", "Write"
        ]
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect("Analyze our Q4 revenue metrics")

        async for message in client.receive_messages():
            if message.type == "result":
                print(message.result)
```

### Pattern 4: Permission-Controlled Agent

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions

async def custom_permission_handler(tool_name: str, tool_input: dict) -> bool:
    """Custom logic to approve/deny tool usage"""
    # Example: Block destructive operations
    if tool_name in ["Bash"] and any(cmd in str(tool_input) for cmd in ["rm", "delete"]):
        print(f"Blocked destructive command: {tool_input}")
        return False

    # Example: Auto-approve read operations
    if tool_name in ["Read", "Grep", "Glob"]:
        return True

    # Ask user for other operations
    print(f"Tool {tool_name} wants to execute: {tool_input}")
    user_input = input("Approve? (y/n): ")
    return user_input.lower() == 'y'

async def controlled_agent():
    options = ClaudeAgentOptions(
        permission_mode="default",
        can_use_tool=custom_permission_handler,
        allowed_tools=["Read", "Write", "Edit", "Bash"]
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect("Help me refactor this codebase")

        async for message in client.receive_messages():
            if message.type == "result":
                print(message.result)
```

### Pattern 5: Hook-Based Agent Monitoring

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions, HookMatcher

async def pre_tool_logger(context):
    """Hook called before tool execution"""
    print(f"About to execute: {context.tool_name}")
    print(f"Input: {context.tool_input}")
    return context  # Return unmodified to proceed

async def post_tool_logger(context):
    """Hook called after tool execution"""
    print(f"Completed: {context.tool_name}")
    print(f"Result: {context.tool_result}")
    return context

async def user_prompt_modifier(context):
    """Hook to modify user prompts before processing"""
    original = context.message.content
    # Add context or modify prompt
    context.message.content = f"{original}\n\nAlways follow best practices."
    return context

async def monitored_agent():
    hooks = {
        'PreToolUse': [HookMatcher(hooks=[pre_tool_logger])],
        'PostToolUse': [HookMatcher(hooks=[post_tool_logger])],
        'UserPromptSubmit': [HookMatcher(hooks=[user_prompt_modifier])]
    }

    options = ClaudeAgentOptions(
        hooks=hooks,
        max_turns=10
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        await client.connect("Build a data processing pipeline")

        async for message in client.receive_messages():
            if message.type == "result":
                print(message.result)
```

## Message Handling

### Message Types

```python
class Message:
    type: str  # "system", "user", "assistant", "result"
    subtype: str | None  # Additional context
    session_id: str | None
    message: dict | None
    result: str | None
    usage: UsageInfo | None

class UsageInfo:
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int
    total_cost_usd: float
```

### Processing Different Message Types

```python
async def message_processor():
    client = ClaudeSDKClient()

    async with client:
        await client.connect("Analyze this project")

        async for message in client.receive_messages():
            match message.type:
                case "system":
                    if message.subtype == "init":
                        print(f"Session started: {message.session_id}")
                    elif message.subtype == "compact_boundary":
                        print("Conversation compacted")

                case "assistant":
                    # Process assistant's response
                    for block in message.message.content:
                        if block.type == "text":
                            print(f"Text: {block.text}")
                        elif block.type == "tool_use":
                            print(f"Tool: {block.name}")

                case "result":
                    if message.subtype == "success":
                        print(f"Success: {message.result}")
                        if message.usage:
                            print(f"Cost: ${message.usage.total_cost_usd}")
                    elif message.subtype == "error":
                        print(f"Error: {message.result}")

                case "user":
                    print(f"User input: {message.message}")
```

## Advanced Features

### Interrupt and Control

```python
async def interruptible_agent():
    client = ClaudeSDKClient()

    async with client:
        await client.connect("Start a long-running analysis")

        # Start processing messages
        message_task = asyncio.create_task(process_messages(client))

        # Simulate user interruption after 5 seconds
        await asyncio.sleep(5)
        await client.interrupt()
        print("Interrupted agent execution")

        # Wait for cleanup
        await message_task

async def process_messages(client):
    try:
        async for message in client.receive_messages():
            if message.type == "result":
                print(message.result)
    except Exception as e:
        print(f"Processing interrupted: {e}")
```

### System Prompt Customization

```python
# Append to default prompt
options = ClaudeAgentOptions(
    system_prompt={
        "type": "preset",
        "preset": "claude_code",
        "append": "Always use type hints in Python code."
    }
)

# Or completely custom prompt
options = ClaudeAgentOptions(
    system_prompt={
        "type": "custom",
        "content": "You are a specialized Python expert focused on clean code..."
    }
)
```

### Cost Tracking

```python
class CostTrackingAgent:
    def __init__(self):
        self.total_cost = 0.0
        self.processed_message_ids = set()

    async def run(self, prompt: str):
        client = ClaudeSDKClient()

        async with client:
            await client.connect(prompt)

            async for message in client.receive_messages():
                if message.type == "assistant" and message.usage:
                    # Track costs per unique message
                    if message.id not in self.processed_message_ids:
                        self.processed_message_ids.add(message.id)
                        self.total_cost += message.usage.total_cost_usd

                if message.type == "result":
                    print(f"Total cost: ${self.total_cost:.4f}")
                    return message.result
```

## Best Practices

### 1. Always Use Context Managers

```python
# ✅ Good - Automatic cleanup
async with ClaudeSDKClient() as client:
    await client.connect("prompt")
    async for message in client.receive_messages():
        process(message)

# ❌ Avoid - Manual cleanup required
client = ClaudeSDKClient()
await client.connect("prompt")
# ... must remember to call disconnect()
await client.disconnect()
```

### 2. Handle Session IDs Properly

```python
class SessionManager:
    def __init__(self):
        self.sessions = {}

    async def create_session(self, user_id: str, prompt: str):
        client = ClaudeSDKClient()

        async with client:
            await client.connect(prompt)

            async for message in client.receive_messages():
                if message.type == "system" and message.subtype == "init":
                    self.sessions[user_id] = message.session_id
                    break

    async def resume_session(self, user_id: str, prompt: str):
        session_id = self.sessions.get(user_id)

        if not session_id:
            raise ValueError(f"No session for user {user_id}")

        options = ClaudeAgentOptions(resume=session_id)
        client = ClaudeSDKClient(options=options)

        async with client:
            await client.connect(prompt)
            async for message in client.receive_messages():
                if message.type == "result":
                    return message.result
```

### 3. Implement Proper Error Handling

```python
async def robust_agent():
    client = ClaudeSDKClient()

    try:
        async with client:
            await client.connect("Process this data")

            async for message in client.receive_messages():
                if message.type == "result":
                    if message.subtype == "error":
                        # Handle agent errors
                        print(f"Agent error: {message.result}")
                        # Implement retry logic or fallback
                    else:
                        return message.result

    except asyncio.TimeoutError:
        print("Request timed out")
        # Implement timeout handling

    except Exception as e:
        print(f"Unexpected error: {e}")
        # Implement general error handling
```

### 4. Optimize for Long-Running Sessions

```python
async def long_running_agent():
    options = ClaudeAgentOptions(
        max_turns=50,  # Allow many turns
        continue_conversation=True
    )

    client = ClaudeSDKClient(options=options)

    async with client:
        # Initial connection
        await client.connect("Start project scaffolding")

        tasks = [
            "Create project structure",
            "Set up database models",
            "Implement API endpoints",
            "Add authentication",
            "Write tests"
        ]

        for task in tasks:
            await client.query(task)

            async for message in client.receive_messages():
                if message.type == "result":
                    print(f"Completed: {task}")
                    break
```

## Error Handling

### Common Error Scenarios

```python
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions
from anthropic_sdk.exceptions import (
    SessionNotFoundError,
    ToolExecutionError,
    PermissionDeniedError
)

async def error_aware_agent():
    client = ClaudeSDKClient()

    try:
        async with client:
            await client.connect("Execute complex task")

            async for message in client.receive_messages():
                if message.type == "result":
                    return message.result

    except SessionNotFoundError as e:
        print(f"Session error: {e}")
        # Handle session errors

    except ToolExecutionError as e:
        print(f"Tool execution failed: {e}")
        # Handle tool failures

    except PermissionDeniedError as e:
        print(f"Permission denied: {e}")
        # Handle permission issues

    except Exception as e:
        print(f"Unexpected error: {e}")
        # Catch-all for other errors
```

## Complete Example: Production-Ready Agent

```python
import asyncio
import logging
from typing import Optional
from anthropic_sdk import ClaudeSDKClient, ClaudeAgentOptions, HookMatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ProductionAgent:
    """Production-ready agent with full session management"""

    def __init__(
        self,
        model: str = "claude-sonnet-4-5",
        max_turns: int = 20,
        session_id: Optional[str] = None
    ):
        self.session_id = session_id
        self.total_cost = 0.0
        self.processed_ids = set()

        # Configure hooks for monitoring
        self.hooks = {
            'PreToolUse': [HookMatcher(hooks=[self._pre_tool_hook])],
            'PostToolUse': [HookMatcher(hooks=[self._post_tool_hook])]
        }

        # Configure options
        self.options = ClaudeAgentOptions(
            model=model,
            max_turns=max_turns,
            resume=session_id,
            continue_conversation=True,
            hooks=self.hooks,
            allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
            permission_mode="default"
        )

        self.client = ClaudeSDKClient(options=self.options)

    async def _pre_tool_hook(self, context):
        """Log tool usage before execution"""
        logger.info(f"Executing tool: {context.tool_name}")
        return context

    async def _post_tool_hook(self, context):
        """Log tool results after execution"""
        logger.info(f"Tool {context.tool_name} completed")
        return context

    async def start(self, prompt: str) -> str:
        """Start new conversation or resume existing"""
        try:
            async with self.client:
                await self.client.connect(prompt)

                async for message in self.client.receive_messages():
                    # Track session ID
                    if message.type == "system" and message.subtype == "init":
                        self.session_id = message.session_id
                        logger.info(f"Session: {self.session_id}")

                    # Track costs
                    if message.type == "assistant" and message.usage:
                        if message.id not in self.processed_ids:
                            self.processed_ids.add(message.id)
                            self.total_cost += message.usage.total_cost_usd

                    # Return final result
                    if message.type == "result":
                        if message.subtype == "success":
                            logger.info(f"Cost: ${self.total_cost:.4f}")
                            return message.result
                        else:
                            raise Exception(f"Error: {message.result}")

        except Exception as e:
            logger.error(f"Agent error: {e}")
            raise

    async def continue_task(self, prompt: str) -> str:
        """Continue existing conversation"""
        return await self.start(prompt)

    def get_session_id(self) -> Optional[str]:
        """Get current session ID"""
        return self.session_id

    def get_total_cost(self) -> float:
        """Get total cost of conversation"""
        return self.total_cost

# Usage example
async def main():
    # Create agent
    agent = ProductionAgent(max_turns=30)

    # Start conversation
    result1 = await agent.start(
        "Build a REST API with authentication and rate limiting"
    )
    print(f"Phase 1 complete: {result1}")

    # Continue with context
    result2 = await agent.continue_task(
        "Add comprehensive error handling and logging"
    )
    print(f"Phase 2 complete: {result2}")

    # Add tests
    result3 = await agent.continue_task(
        "Write unit and integration tests"
    )
    print(f"Phase 3 complete: {result3}")

    # Report session info
    print(f"Session ID: {agent.get_session_id()}")
    print(f"Total cost: ${agent.get_total_cost():.4f}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Summary

The ClaudeSDKClient provides a powerful framework for building complex agents with:

1. **Session Management**: Persistent context across multiple interactions
2. **Flexible Configuration**: Extensive options for customization
3. **Tool Integration**: Custom and built-in tools
4. **Permission Control**: Fine-grained access control
5. **Hook System**: Lifecycle hooks for monitoring and modification
6. **Streaming Support**: Real-time message processing
7. **Cost Tracking**: Built-in usage and cost monitoring
8. **Error Handling**: Comprehensive error management

This makes it ideal for building production-ready AI agents that maintain context and handle complex, multi-step workflows.
