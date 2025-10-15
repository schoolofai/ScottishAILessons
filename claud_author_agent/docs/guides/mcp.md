**Source:** https://docs.claude.com/en/api/agent-sdk/mcp

# MCP (Model Context Protocol) in Claude Agent SDK

## Overview

Model Context Protocol (MCP) servers extend Claude Code by enabling custom tools and capabilities. They can run as:
- External processes
- HTTP/SSE connections
- In-process SDK servers

## Configuration

MCP servers are configured in a `.mcp.json` file at the project root. Example configuration:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/Users/me/projects"
      }
    }
  }
}
```

## Using MCP Servers

Basic usage in the SDK:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "List files in my project",
  options: {
    mcpServers: {
      "filesystem": {
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem"],
        env: {
          ALLOWED_PATHS: "/Users/me/projects"
        }
      }
    },
    allowedTools: ["mcp__filesystem__list_files"]
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

## Transport Types

1. **stdio Servers**: External processes communicating via stdin/stdout
2. **HTTP/SSE Servers**: Remote servers with network communication
3. **SDK MCP Servers**: In-process servers within the application

## Authentication

- Environment variables can be used for configuration
- OAuth2 authentication is not currently supported

## Resource Management

MCP servers can expose resources that Claude can list and read:

```typescript
for await (const message of query({
  prompt: "What resources are available from the database server?",
  options: {
    mcpServers: {
      "database": {
        command: "npx",
        args: ["@modelcontextprotocol/server-database"]
      }
    }
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```
