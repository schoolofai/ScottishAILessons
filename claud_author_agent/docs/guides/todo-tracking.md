**Source:** https://docs.claude.com/en/api/agent-sdk/todo-tracking

# Todo Tracking in Claude Agent SDK

## Todo Lifecycle

Todos progress through four key stages:
1. **Created** as `pending` when tasks are first identified
2. **Activated** to `in_progress` when work begins
3. **Completed** when the task finishes successfully
4. **Removed** when all tasks in a group are completed

## When Todos Are Used

The SDK automatically creates todos for:
- Complex multi-step tasks requiring 3+ distinct actions
- User-provided task lists with multiple items
- Non-trivial operations benefiting from progress tracking
- Explicit requests for todo organization

## Code Examples

### Monitoring Todo Changes (TypeScript)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Optimize my React app performance and track progress with todos",
  options: { maxTurns: 15 }
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "tool_use" && block.name === "TodoWrite") {
        const todos = block.input.todos;

        console.log("Todo Status Update:");
        todos.forEach((todo, index) => {
          const status = todo.status === "completed" ? "✅" :
                        todo.status === "in_progress" ? "🔧" : "❌";
          console.log(`${index + 1}. ${status} ${todo.content}`);
        });
      }
    }
  }
}
```

### Real-time Progress Display (TypeScript)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

class TodoTracker {
  private todos: any[] = [];

  displayProgress() {
    if (this.todos.length === 0) return;

    const completed = this.todos.filter(t => t.status === "completed").length;
    const inProgress = this.todos.filter(t => t.status === "in_progress").length;
    const total = this.todos.length;

    console.log(`Progress: ${completed}/${total} completed, ${inProgress} in progress`);
  }
}
```
