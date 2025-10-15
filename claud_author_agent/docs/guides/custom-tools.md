**Source:** https://docs.claude.com/en/api/agent-sdk/custom-tools

# Custom Tools in Claude Agent SDK

## Custom Tools Overview

Custom tools allow developers to extend Claude Code's capabilities by creating specialized functions that can interact with external services, APIs, or perform complex operations.

### Key Characteristics:
- Implemented through `createSdkMcpServer` and `tool` helper functions
- Require type-safe schema definitions
- Support streaming input mode
- Can be selectively allowed or restricted

## Creating Custom Tools

Example structure using TypeScript and Zod for type safety:

```typescript
const customServer = createSdkMcpServer({
  name: "my-custom-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",
      "Get current weather for a location",
      {
        location: z.string().describe("City name or coordinates"),
        units: z.enum(["celsius", "fahrenheit"]).default("celsius")
      },
      async (args) => {
        // API call and result processing logic
        const response = await fetch(`https://api.weather.com/v1/current?q=${args.location}&units=${args.units}`);
        const data = await response.json();

        return {
          content: [{
            type: "text",
            text: `Temperature: ${data.temp}°\nConditions: ${data.conditions}`
          }]
        };
      }
    )
  ]
});
```

## Tool Naming Convention

Tools are exposed with a specific name format:
- Pattern: `mcp__{server_name}__{tool_name}`
- Example: `mcp__my-custom-tools__get_weather`

## Usage Example

```typescript
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "What's the weather in San Francisco?"
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),
  options: {
    mcpServers: {
      "my-custom-tools": customServer
    },
    allowedTools: ["mcp__my-custom-tools__get_weather"]
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```
