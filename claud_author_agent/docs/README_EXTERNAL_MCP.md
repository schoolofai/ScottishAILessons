# External MCP Server Examples - Appwrite

This directory contains complete examples for using external MCP servers with the Claude Agent SDK, specifically demonstrating Appwrite database integration.

## What is an External MCP Server?

External MCP (Model Context Protocol) servers are separate processes that provide tools and capabilities to AI agents. Unlike in-process SDK MCP servers (which you define in Python), external servers:

- Run as separate subprocesses
- Communicate via stdio, HTTP, or SSE protocols
- Integrate with external services (databases, APIs, cloud platforms)
- Are often maintained by the community

## Files in This Section

### Configuration
- **`.mcp.json`** - MCP server configuration (contains credentials, in .gitignore)
- **`.mcp.json.template`** - Template for creating your own configuration
- **`.gitignore`** - Ensures sensitive files aren't committed

### Examples
- **`test_appwrite_connection.py`** - Test Appwrite MCP server connection
- **`example_external_mcp_appwrite.py`** - Basic Appwrite operations
- **`example_external_mcp_comprehensive.py`** - Advanced workflows

### Documentation
- **`MCP_EXTERNAL_SERVERS.md`** - Complete guide to external MCP servers
- **`README_EXTERNAL_MCP.md`** - This file

---

## Quick Start

### 1. Setup Appwrite Credentials

Copy the template and add your credentials:
```bash
cp .mcp.json.template .mcp.json
```

Edit `.mcp.json` and replace:
- `YOUR_PROJECT_ID_HERE` → Your Appwrite project ID
- `YOUR_API_KEY_HERE` → Your Appwrite API key

### 2. Install Dependencies

Ensure you have the necessary packages:
```bash
# Activate virtual environment
source venv/bin/activate  # or: ./venv/bin/activate on Mac/Linux

# Install mcp-server-appwrite (if needed)
pip install mcp-server-appwrite

# Ensure uvx is available
pip install uvx
```

### 3. Test Connection

Verify your Appwrite connection works:
```bash
./venv/bin/python test_appwrite_connection.py
```

Expected output:
```
✓ .mcp.json found
✓ mcpServers configuration present
✓ Appwrite server configured
...
✓ Test 1 PASSED: Connection successful
```

### 4. Run Basic Example

```bash
./venv/bin/python example_external_mcp_appwrite.py
```

This will:
- Load MCP configuration
- Connect to Appwrite
- List all databases in your project

### 5. Run Comprehensive Example

```bash
./venv/bin/python example_external_mcp_comprehensive.py
```

This demonstrates:
- Creating databases and collections
- Defining schemas with attributes
- CRUD operations on documents
- Querying and filtering data

---

## Configuration Explained

### Basic Configuration

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

### With Environment Variables

```json
{
  "mcpServers": {
    "appwrite": {
      "type": "stdio",
      "command": "env",
      "args": [
        "APPWRITE_PROJECT_ID=your-project-id",
        "env",
        "APPWRITE_API_KEY=your-api-key",
        "env",
        "APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1",
        "uvx",
        "mcp-server-appwrite",
        "--databases"
      ]
    }
  }
}
```

### Available Flags

- `--databases` - Enable database tools (default)
- `--users` - Enable user management tools
- `--storage` - Enable storage/file tools
- `--functions` - Enable cloud functions tools

You can combine multiple flags:
```bash
uvx mcp-server-appwrite --databases --users --storage
```

---

## Usage in Python

### Load Configuration

```python
import json
from claude_agent_sdk import query, ClaudeAgentOptions

# Load MCP config
with open('.mcp.json', 'r') as f:
    mcp_config = json.load(f)

# Configure agent
options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=[
        "mcp__appwrite__databases_list",
        "mcp__appwrite__databases_create"
    ]
)
```

### Use Natural Language

```python
prompt = """
Create a new Appwrite database called 'my_app'
and list all databases to confirm.
"""

async for message in query(prompt=prompt, options=options):
    print(message)
```

---

## Available Appwrite Tools

### Database Operations
- `mcp__appwrite__databases_list`
- `mcp__appwrite__databases_create`
- `mcp__appwrite__databases_get`
- `mcp__appwrite__databases_update`
- `mcp__appwrite__databases_delete`

### Collection Operations
- `mcp__appwrite__databases_create_collection`
- `mcp__appwrite__databases_list_collections`
- `mcp__appwrite__databases_get_collection`
- `mcp__appwrite__databases_update_collection`
- `mcp__appwrite__databases_delete_collection`

### Attribute Operations
- `mcp__appwrite__databases_create_string_attribute`
- `mcp__appwrite__databases_create_integer_attribute`
- `mcp__appwrite__databases_create_boolean_attribute`
- `mcp__appwrite__databases_create_email_attribute`
- `mcp__appwrite__databases_create_datetime_attribute`
- `mcp__appwrite__databases_list_attributes`

### Document Operations
- `mcp__appwrite__databases_create_document`
- `mcp__appwrite__databases_list_documents`
- `mcp__appwrite__databases_get_document`
- `mcp__appwrite__databases_update_document`
- `mcp__appwrite__databases_delete_document`

### Index Operations
- `mcp__appwrite__databases_create_index`
- `mcp__appwrite__databases_list_indexes`

See `MCP_EXTERNAL_SERVERS.md` for complete documentation.

---

## Examples

### Example 1: List Databases

```python
options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=["mcp__appwrite__databases_list"]
)

prompt = "List all databases in my Appwrite project"
```

### Example 2: Create Database and Collection

```python
options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=[
        "mcp__appwrite__databases_create",
        "mcp__appwrite__databases_create_collection",
        "mcp__appwrite__databases_create_string_attribute"
    ]
)

prompt = """
Create a database 'blog_db' with a collection 'posts'
and add string attributes: title, content, author
"""
```

### Example 3: CRUD Operations

```python
options = ClaudeAgentOptions(
    mcp_servers=mcp_config['mcpServers'],
    allowed_tools=[
        "mcp__appwrite__databases_create_document",
        "mcp__appwrite__databases_list_documents",
        "mcp__appwrite__databases_update_document",
        "mcp__appwrite__databases_delete_document"
    ]
)

prompt = """
In database 'blog_db', collection 'posts':
1. Create a document with title "Hello World"
2. List all documents
3. Update the document to add author "Alice"
4. Delete the document
"""
```

---

## Comparison: In-Process vs External

### In-Process SDK MCP
```python
# Defined in Python
@tool("greet", "Greet user", {"name": str})
async def greet(args):
    return {"content": [...]}

server = create_sdk_mcp_server(
    name="tools",
    tools=[greet]
)
```

**Use for:** Custom business logic, calculations, text processing

### External MCP
```json
// Configured in .mcp.json
{
  "mcpServers": {
    "appwrite": {
      "command": "uvx",
      "args": ["mcp-server-appwrite"]
    }
  }
}
```

**Use for:** External service integration, databases, APIs, cloud services

---

## Troubleshooting

### Issue: "mcp-server-appwrite not found"

**Solution:**
```bash
pip install mcp-server-appwrite
# or
pip install uvx
```

### Issue: "Authentication failed"

**Solution:**
1. Verify your credentials in `.mcp.json`
2. Check project ID is correct
3. Ensure API key has necessary permissions

### Issue: "Tool not found: mcp__appwrite__..."

**Solution:**
1. Check tool name spelling
2. Ensure tool is in `allowed_tools` list
3. Verify server is configured in `.mcp.json`

### Issue: "Connection timeout"

**Solution:**
1. Check network connectivity
2. Verify Appwrite endpoint is accessible
3. Test with: `curl https://cloud.appwrite.io/v1/health`

---

## Security Best Practices

### ✓ DO
- Keep `.mcp.json` in `.gitignore`
- Use environment variables for credentials
- Limit `allowed_tools` to minimum needed
- Use `permission_mode='manual'` for destructive operations

### ✗ DON'T
- Commit `.mcp.json` to version control
- Share API keys in code or documentation
- Give unrestricted tool access
- Use production credentials in development

---

## Additional Resources

- **Appwrite Documentation**: https://appwrite.io/docs
- **Appwrite MCP Server**: https://appwrite.io/docs/tooling/mcp
- **MCP Specification**: https://modelcontextprotocol.io/
- **Claude Agent SDK**: https://docs.claude.com/en/api/agent-sdk/overview

---

## Next Steps

1. ✓ Test connection: `python test_appwrite_connection.py`
2. ✓ Run basic example: `python example_external_mcp_appwrite.py`
3. ✓ Explore comprehensive example: `python example_external_mcp_comprehensive.py`
4. ✓ Read full documentation: `MCP_EXTERNAL_SERVERS.md`
5. ✓ Build your own integration!

---

## Summary

External MCP servers enable powerful integrations with external services:

- **Easy Configuration**: JSON-based setup
- **Natural Language**: Control services with prompts
- **Secure**: Credentials managed separately
- **Flexible**: Mix with in-process tools
- **Extensible**: Use community MCP servers

Happy coding! 🚀
