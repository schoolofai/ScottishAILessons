**Source:** https://docs.claude.com/en/api/agent-sdk/cost-tracking

# Cost Tracking in Claude Agent SDK

## Key Concepts of Cost Tracking

The guide explains how to track token usage and costs when interacting with Claude through the Agent SDK. The core principles include:

### Usage Reporting Structure
- A "step" is a single request/response pair
- Messages within a step can include text and tool uses
- Usage data is attached to assistant messages

### Important Usage Rules
- Messages with the same ID share identical usage data
- Charge users only once per step
- The final result message contains cumulative usage

## Implementation Example

Here's a sample implementation of a cost tracking system:

```typescript
class CostTracker {
  private processedMessageIds = new Set<string>();
  private stepUsages: Array<any> = [];

  async trackConversation(prompt: string) {
    const result = await query({
      prompt,
      options: {
        onMessage: (message) => {
          this.processMessage(message);
        }
      }
    });

    return {
      result,
      stepUsages: this.stepUsages,
      totalCost: result.usage?.total_cost_usd || 0
    };
  }

  private processMessage(message: any) {
    // Process only assistant messages with usage
    if (message.type !== 'assistant' || !message.usage) return;

    // Avoid processing duplicate message IDs
    if (this.processedMessageIds.has(message.id)) return;

    this.processedMessageIds.add(message.id);
    this.stepUsages.push({
      messageId: message.id,
      timestamp: new Date().toISOString(),
      usage: message.usage,
      costUSD: this.calculateCost(message.usage)
    });
  }

  private calculateCost(usage: any): number {
    const inputCost = usage.input_tokens * 0.00003;
    const outputCost = usage.output_tokens * 0.00015;
    const cacheReadCost = (usage.cache_read_input_tokens || 0) * 0.000003;
    const cacheWriteCost = (usage.cache_creation_input_tokens || 0) * 0.0000375;

    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
  }
}
```
