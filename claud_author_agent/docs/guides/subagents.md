**Source:** https://docs.claude.com/en/api/agent-sdk/subagents

# Subagents in Claude Agent SDK

## Subagents Overview

Subagents are specialized AI agents within the Claude Agent SDK that can be orchestrated by a main agent. They offer several key benefits:

## Key Benefits

### 1. Context Management
- Maintain separate contexts from the main agent
- Prevent information overload
- Keep interactions focused on specific tasks

### 2. Parallelization
- Multiple subagents can run concurrently
- Dramatically speed up complex workflows
- Example: Simultaneously running code review, security scanning, and test coverage checks

### 3. Specialized Instructions
- Tailored system prompts with specific expertise
- Implement targeted best practices and constraints
- Reduce unnecessary noise in main agent's instructions

## Defining Subagents

Two primary methods for creating subagents:

### 1. Programmatic Definition (Recommended)
```typescript
const result = query({
  prompt: "Review the authentication module for security issues",
  options: {
    agents: {
      'code-reviewer': {
        description: 'Expert code review specialist',
        prompt: `You are a code review specialist with expertise in security...`,
        tools: ['Read', 'Grep', 'Glob'],
        model: 'sonnet'
      }
    }
  }
});
```

### 2. Filesystem-Based Definition
- Create markdown files in `.claude/agents/` directories
- Use YAML frontmatter to define agent properties

## Agent Configuration Fields

- `description`: Explains when to use the agent (required)
- `prompt`: System prompt defining role and behavior (required)
- `tools`: Allowed tool names (optional)
- `model`: Model override (optional)

## Integration Patterns

### 1. Automatic Invocation
- SDK automatically selects appropriate subagents based on task context
- Requires clear `description` field

### 2. Explicit Invocation
- Users can directly request specific subagents in prompts

## Tool Restrictions

Subagents can be limited to specific tools:
- Read-only agents: `['Read', 'Grep', 'Glob']`
- Test execution agents: `['Bash', 'Read', 'Grep']`
