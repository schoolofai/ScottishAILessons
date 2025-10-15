**Source:** https://docs.claude.com/en/api/agent-sdk/streaming-vs-single-mode

# Streaming Input vs Single Message Mode

## Overview

The Claude Agent SDK supports two input modes:
1. Streaming Input Mode (Recommended)
2. Single Message Input

## Streaming Input Mode

### Key Benefits
- Image uploads
- Queued messages
- Full tool integration
- Lifecycle hooks support
- Real-time feedback
- Persistent conversation context

### Implementation Example (TypeScript)
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";

async function* generateMessages() {
  // First message
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "Analyze this codebase for security issues"
    }
  };

  // Follow-up with image
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: [
        { type: "text", text: "Review this architecture diagram" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: readFileSync("diagram.png", "base64")
          }
        }
      ]
    }
  };
}

// Process streaming responses
for await (const message of query({
  prompt: generateMessages(),
  options: {
    maxTurns: 10,
    allowedTools: ["Read", "Grep"]
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

## Single Message Input

### When to Use
- One-shot responses
- Stateless environments (e.g., lambda functions)

### Limitations
- No image attachments
- No dynamic message queueing
- No real-time interruption
- No hook integration
- Limited multi-turn conversations

### Implementation Example (TypeScript)
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Simple one-shot query
for await (const message of query({
  prompt: "Analyze the authentication logic in auth.ts",
  options: {
    maxTurns: 5,
    allowedTools: ["Read", "Grep"]
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

## Recommendation

Use **Streaming Input Mode** for:
- Interactive applications
- Complex multi-turn conversations
- Applications requiring image uploads
- Systems needing fine-grained control

Use **Single Message Input** for:
- Simple, stateless queries
- Serverless functions
- Quick one-off tasks
