**Source:** https://docs.claude.com/en/api/agent-sdk/sessions

# Session Management in Claude Agent SDK

## How Sessions Work

Sessions in the Claude Agent SDK allow you to maintain conversation context across multiple interactions. When you start a new query, the SDK automatically creates a session and provides a session ID.

## Getting the Session ID

Example in TypeScript:

```typescript
let sessionId: string | undefined

const response = query({
  prompt: "Help me build a web application",
  options: {
    model: "claude-sonnet-4-5"
  }
})

for await (const message of response) {
  // Capture session ID from first system message
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id
    console.log(`Session started with ID: ${sessionId}`)
  }
}
```

## Resuming Sessions

You can resume a previous session using the `resume` option with a session ID:

```typescript
const response = query({
  prompt: "Continue implementing the authentication system",
  options: {
    resume: "session-xyz", // Previous session ID
    model: "claude-sonnet-4-5",
    allowedTools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash"]
  }
})
```

## Forking Sessions

Forking allows you to create a new session branch from a previous point:

### When to Fork a Session
- Explore different approaches from the same starting point
- Create multiple conversation branches
- Test changes without affecting original session
- Maintain separate conversation paths

### Forking vs Continuing

| Behavior | `forkSession: false` (default) | `forkSession: true` |
|----------|--------------------------------|---------------------|
| Session ID | Same as original | New session ID generated |
| History | Appends to original session | Creates new branch |
| Original Session | Modified | Preserved unchanged |

## Example: Forking a Session

```typescript
// First, capture the session ID
let sessionId: string | undefined

const response = query({
  prompt: "Help me design a REST API",
  options: { model: "claude-sonnet-4-5" }
})

for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id
  }
}

// Later, fork the session to explore alternative approaches
const forkedResponse = query({
  prompt: "Actually, let's use GraphQL instead",
  options: {
    resume: sessionId,
    forkSession: true
  }
})
```
