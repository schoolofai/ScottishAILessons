# External MCP Servers - Complete Guide

This guide explains how to use external Model Context Protocol (MCP) servers with the Claude Agent SDK, using Appwrite as a practical example.

## Table of Contents

1. [Overview](#overview)
2. [In-Process vs External MCP Servers](#in-process-vs-external-mcp-servers)
3. [Configuration](#configuration)
4. [Implementation](#implementation)
5. [Appwrite Example](#appwrite-example)
6. [Tool Naming Convention](#tool-naming-convention)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

External MCP servers are separate processes that communicate with the Claude Agent SDK via standard protocols (stdio, HTTP, SSE). They enable integration with external services and APIs without writing custom Python code.

### Key Benefits

- **Integration**: Connect to external services (databases, APIs, cloud services)
- **Reusability**: Use community-built MCP servers
- **Isolation**: Separate concerns and resource management
- **Flexibility**: Mix external and in-process tools

---

## In-Process vs External MCP Servers

### In-Process SDK MCP Servers

**Created in Python code:**
```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("greet", "Greet user", {"name": str})
async def greet(args):
    return {"content": [{"type": "text", "text": f"Hello {args['name']}!"}]}

server = create_sdk_mcp_server(
    name="tools",
    version="1.0.0",
    tools=[greet]
)

options = ClaudeAgentOptions(
    mcp_servers={"tools": server}
)
```

**Characteristics:**
- Defined in Python code
- Runs in same process
- Lightweight and fast
- Good for custom business logic

### External MCP Servers

**Configured in `.mcp.json`:**
```json
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

**Characteristics:**
- Separate subprocess
- Communicates via stdio/HTTP/SSE
- Integrates with external services
- Community-maintained servers available

---

## Configuration

### Configuration File: `.mcp.json`

External MCP servers are configured in a JSON file, typically `.mcp.json` in your project root.

### Stdio Server Configuration

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

**Parameters:**
- `type`: Communication type (`stdio`, `http`, or `sse`)
- `command`: Executable command
- `args`: Array of command-line arguments
- `env`: Environment variables (optional)

### HTTP/SSE Server Configuration

```json
{
  "mcpServers": {
    "remote-api": {
      "type": "sse",
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

---

## Implementation

### Step 1: Create Configuration File

Create `.mcp.json`:
```json
{
  "mcpServers": {
    "appwrite": {
      "type": "stdio",
      "command": "uvx",
      "args": ["mcp-server-appwrite", "--databases"],
      "env": {
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key",
        "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1"
      }
    }
  }
}
```

### Step 2: Load Configuration in Python

```python
import json
from claude_agent_sdk import query, ClaudeAgentOptions

# Load MCP configuration
with open('.mcp.json', 'r') as f:
    mcp_config = json.load(f)

# Configure agent
options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=[
        "mcp__appwrite__databases_list",
        "mcp__appwrite__databases_create"
    ],
    permission_mode='acceptEdits'
)

# Use the agent
async for message in query(
    prompt="List all databases",
    options=options
):
    print(message)
```

### Step 3: Use Tools

The agent can now use tools from the external MCP server by referencing them in natural language:

```python
prompt = "Create a new database called 'my_app' using Appwrite"
```

---

## Appwrite Example

### Configuration with Environment Variables

```json
{
  "mcpServers": {
    "appwrite": {
      "type": "stdio",
      "command": "env",
      "args": [
        "APPWRITE_PROJECT_ID=68adb98e0020be2e134f",
        "env",
        "APPWRITE_API_KEY=standard_929c...",
        "env",
        "APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1",
        "uvx",
        "mcp-server-appwrite",
        "--databases"
      ],
      "env": {}
    }
  }
}
```

**Why use `env` command?**
- Sets environment variables inline
- Avoids putting credentials in `env` object
- More secure for command-line execution

### Available Appwrite Database Tools

The `--databases` flag enables these tools:

**Database Operations:**
- `mcp__appwrite__databases_list` - List all databases
- `mcp__appwrite__databases_create` - Create new database
- `mcp__appwrite__databases_get` - Get database details
- `mcp__appwrite__databases_update` - Update database
- `mcp__appwrite__databases_delete` - Delete database

**Collection Operations:**
- `mcp__appwrite__databases_create_collection` - Create collection
- `mcp__appwrite__databases_list_collections` - List collections
- `mcp__appwrite__databases_get_collection` - Get collection
- `mcp__appwrite__databases_update_collection` - Update collection
- `mcp__appwrite__databases_delete_collection` - Delete collection

**Attribute Operations:**
- `mcp__appwrite__databases_create_string_attribute` - Add string attribute
- `mcp__appwrite__databases_create_integer_attribute` - Add integer attribute
- `mcp__appwrite__databases_create_boolean_attribute` - Add boolean attribute
- `mcp__appwrite__databases_create_email_attribute` - Add email attribute
- `mcp__appwrite__databases_create_datetime_attribute` - Add datetime attribute
- `mcp__appwrite__databases_list_attributes` - List attributes

**Document Operations:**
- `mcp__appwrite__databases_create_document` - Create document
- `mcp__appwrite__databases_list_documents` - List documents
- `mcp__appwrite__databases_get_document` - Get document
- `mcp__appwrite__databases_update_document` - Update document
- `mcp__appwrite__databases_delete_document` - Delete document

**Index Operations:**
- `mcp__appwrite__databases_create_index` - Create index
- `mcp__appwrite__databases_list_indexes` - List indexes

### Complete Example

```python
import anyio
from claude_agent_sdk import query, ClaudeAgentOptions
import json

async def appwrite_workflow():
    # Load config
    with open('.mcp.json', 'r') as f:
        mcp_config = json.load(f)

    # Configure agent
    options = ClaudeAgentOptions(
        mcp_servers=mcp_config['mcpServers'],
        allowed_tools=[
            "mcp__appwrite__databases_create",
            "mcp__appwrite__databases_create_collection",
            "mcp__appwrite__databases_create_string_attribute",
            "mcp__appwrite__databases_create_document",
            "mcp__appwrite__databases_list_documents"
        ],
        permission_mode='acceptEdits'
    )

    # Workflow prompt
    prompt = """
    Create a blog system in Appwrite:
    1. Create database 'blog_db'
    2. Create collection 'posts'
    3. Add string attributes: title, content, author
    4. Create a sample post
    5. List all posts
    """

    async for message in query(prompt=prompt, options=options):
        print(message)

anyio.run(appwrite_workflow)
```

---

## Tool Naming Convention

External MCP tools follow a strict naming pattern:

```
mcp__<server-name>__<tool-name>
```

### Examples

**Configuration:**
```json
{
  "mcpServers": {
    "appwrite": { ... },
    "filesystem": { ... }
  }
}
```

**Tool Names:**
- Appwrite database list: `mcp__appwrite__databases_list`
- Filesystem read: `mcp__filesystem__read_file`
- Appwrite create document: `mcp__appwrite__databases_create_document`

### Finding Available Tools

To discover what tools an external MCP server provides:

1. Check the server's documentation
2. Use the agent to list available tools
3. Review error messages if tool names are incorrect

---

## Best Practices

### 1. Security

**DO:**
- Use environment variables for sensitive data
- Add `.mcp.json` to `.gitignore` if it contains secrets
- Use `permission_mode='manual'` for destructive operations
- Limit `allowed_tools` to only what's needed

**DON'T:**
- Commit API keys to version control
- Give unrestricted tool access
- Use `acceptEdits` mode in production without validation

### 2. Configuration Management

**Development:**
```json
{
  "mcpServers": {
    "appwrite": {
      "env": {
        "APPWRITE_PROJECT_ID": "dev-project",
        "APPWRITE_API_KEY": "${DEV_API_KEY}"
      }
    }
  }
}
```

**Production:**
Use environment variables:
```bash
export APPWRITE_API_KEY="production-key"
```

### 3. Error Handling

Always handle external MCP server errors:

```python
try:
    async for message in query(prompt=prompt, options=options):
        # Process messages
        pass
except Exception as e:
    print(f"MCP Server Error: {e}")
    # Handle connection failures, timeouts, etc.
```

### 4. Tool Selection

Only enable tools you need:

```python
# ❌ Too broad
allowed_tools=["mcp__appwrite__*"]  # Not supported

# ✓ Specific
allowed_tools=[
    "mcp__appwrite__databases_list",
    "mcp__appwrite__databases_get"
]
```

### 5. Testing

Test external server connection before production:

```bash
# Test Appwrite connection
./venv/bin/python test_appwrite_connection.py
```

---

## Troubleshooting

### Issue: "MCP server not found"

**Cause:** Server executable not installed

**Solution:**
```bash
# For Appwrite
pip install mcp-server-appwrite

# For other servers
pip install <mcp-server-package>
```

### Issue: "Tool not found: mcp__appwrite__databases_list"

**Causes:**
1. Tool name misspelled
2. Tool not in `allowed_tools`
3. Server not properly configured

**Solutions:**
```python
# Check tool name format
"mcp__<server>__<tool>"

# Ensure tool is allowed
allowed_tools=["mcp__appwrite__databases_list"]

# Verify server name matches config
# .mcp.json: "appwrite" → mcp__appwrite__...
```

### Issue: "Connection timeout" or "Server not responding"

**Causes:**
1. Server process failed to start
2. Network issues
3. Invalid credentials

**Solutions:**
```bash
# Test server manually
uvx mcp-server-appwrite --databases

# Check logs
# Add debugging to see server output
```

### Issue: "Authentication failed"

**Causes:**
- Invalid API key
- Expired credentials
- Wrong project ID

**Solutions:**
1. Verify credentials in `.mcp.json`
2. Check environment variables are set correctly
3. Test credentials directly with Appwrite API

### Issue: "Permission denied"

**Causes:**
- Tool not in `allowed_tools`
- Permission mode set to `manual`

**Solutions:**
```python
# Add tool to allowed list
allowed_tools=["mcp__appwrite__databases_create"]

# Use appropriate permission mode
permission_mode='acceptEdits'  # or 'manual'
```

---

## Comparison Matrix

| Feature | In-Process MCP | External MCP |
|---------|----------------|--------------|
| **Setup** | Python code | JSON config |
| **Execution** | Same process | Subprocess |
| **Performance** | Fast | Slower (IPC overhead) |
| **Integration** | Custom logic | External services |
| **Maintenance** | Your code | Server updates |
| **Dependencies** | Python packages | External binaries |
| **Use Case** | Business logic | Service integration |

---

## Additional Resources

- [Claude Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk/overview)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Appwrite MCP Server](https://appwrite.io/docs/tooling/mcp)
- [MCP Hub](https://mcphub.tools/) - Directory of MCP servers

---

## Examples in This Directory

- `test_appwrite_connection.py` - Test Appwrite connection
- `example_external_mcp_appwrite.py` - Basic usage
- `example_external_mcp_comprehensive.py` - Advanced workflows

---

## Summary

External MCP servers enable powerful integrations with external services through a standardized protocol. Key points:

✓ Configure in `.mcp.json`
✓ Load in Python with `ClaudeAgentOptions`
✓ Use tools via natural language prompts
✓ Follow naming convention: `mcp__<server>__<tool>`
✓ Handle errors gracefully
✓ Secure credentials properly

With external MCP servers, you can build agents that interact with databases, APIs, cloud services, and more without writing custom integration code!
