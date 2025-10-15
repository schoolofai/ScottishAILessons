**Source:** https://docs.claude.com/en/api/agent-sdk/permissions

# Handling Permissions in Claude Agent SDK

## SDK Permissions Overview

The Claude Agent SDK provides four complementary ways to control tool usage:

1. **Permission Modes**: Global permission behavior settings
2. **canUseTool Callback**: Runtime permission handler
3. **Hooks**: Fine-grained control over tool execution
4. **Permission Rules (settings.json)**: Declarative allow/deny rules

## Permission Modes

Available modes:

- `default`: Standard permission checks
- `plan`: Planning mode (read-only tools only, not currently supported)
- `acceptEdits`: Automatically approve file edits
- `bypassPermissions`: Bypass all permission checks (use with caution)

## Setting Permission Mode

Two ways to set the mode:

### 1. Initial Configuration:
```typescript
const result = await query({
  prompt: "Help me refactor this code",
  options: {
    permissionMode: 'default'
  }
});
```

### 2. Dynamic Mode Changes (Streaming):
```typescript
const q = query({
  prompt: streamInput(),
  options: {
    permissionMode: 'default'
  }
});

// Change mode dynamically
await q.setPermissionMode('acceptEdits');
```

## Mode-Specific Behaviors

### Accept Edits Mode (`acceptEdits`)
- Automatically approves file edits
- Approves filesystem operations
- Speeds up development
- Useful for rapid prototyping

### Bypass Permissions Mode (`bypassPermissions`)
- ALL tool uses automatically approved
- No permission prompts
- Hooks still execute
- Use with extreme caution

## Permission Flow

Order of evaluation:
1. Hooks
2. Deny rules
3. Allow rules
4. Ask rules
5. Permission mode
6. `canUseTool` callback

## canUseTool Callback Example

```typescript
const result = await query({
  prompt: "Help me analyze this codebase",
  options: {
    canUseTool: async (toolName, input) => {
      // Interactive tool approval logic
      return await promptForToolApproval(toolName, input);
    }
  }
});
```
