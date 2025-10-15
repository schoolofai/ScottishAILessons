**Source:** https://docs.claude.com/en/api/agent-sdk/slash-commands

# Slash Commands in Claude Agent SDK

## Slash Commands Overview

Slash commands are special commands starting with "/" that allow you to control Claude Code sessions through the SDK. They provide various functionalities like managing conversation history and accessing system information.

## Discovering Available Slash Commands

You can discover available slash commands when initializing a session:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Hello Claude",
  options: { maxTurns: 1 }
})) {
  if (message.type === "system" && message.subtype === "init") {
    console.log("Available slash commands:", message.slash_commands);
    // Example output: ["/compact", "/clear", "/help"]
  }
}
```

## Common Slash Commands

### `/compact` - Compact Conversation History

Reduces conversation history size by summarizing older messages:

```typescript
for await (const message of query({
  prompt: "/compact",
  options: { maxTurns: 1 }
})) {
  if (message.type === "system" && message.subtype === "compact_boundary") {
    console.log("Compaction completed");
    console.log("Pre-compaction tokens:", message.compact_metadata.pre_tokens);
  }
}
```

### `/clear` - Clear Conversation

Starts a fresh conversation by clearing previous history:

```typescript
for await (const message of query({
  prompt: "/clear",
  options: { maxTurns: 1 }
})) {
  if (message.type === "system" && message.subtype === "init") {
    console.log("Conversation cleared, new session started");
  }
}
```

## Creating Custom Slash Commands

Custom commands are defined as markdown files in specific directories:
- Project commands: `.claude/commands/`
- Personal commands: `~/.claude/commands/`

Example custom command (`refactor.md`):
```markdown
Refactor the selected code to improve readability and maintainability.
Focus on clean code principles and best practices.
```
