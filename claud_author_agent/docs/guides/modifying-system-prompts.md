**Source:** https://docs.claude.com/en/api/agent-sdk/modifying-system-prompts

# Modifying System Prompts in Claude Agent SDK

## System Prompts Overview

A system prompt defines Claude's behavior, capabilities, and response style. By default, the Agent SDK uses an empty system prompt for maximum flexibility.

## Four Methods of Modification

### 1. CLAUDE.md Files (Project-Level Instructions)

- Located in `CLAUDE.md` or `.claude/CLAUDE.md`
- Provides persistent project-specific context
- Requires explicitly configuring `settingSources`

Example CLAUDE.md:
```markdown
# Project Guidelines

## Code Style
- Use TypeScript strict mode
- Prefer functional components in React
- Always include JSDoc comments for public APIs

## Testing
- Run `npm test` before committing
- Maintain >80% code coverage
```

### 2. Output Styles (Persistent Configurations)

- Saved markdown files with reusable configurations
- Can be activated via CLI or settings
- Stored in `~/.claude/output-styles`

Example creation:
```typescript
await createOutputStyle(
  "Code Reviewer",
  "Thorough code review assistant",
  `You are an expert code reviewer.

For every code submission:
1. Check for bugs and security issues
2. Evaluate performance
3. Suggest improvements
4. Rate code quality (1-10)`
);
```

### 3. systemPrompt with Append

- Add custom instructions while preserving default functionality
- Useful for adding specific coding standards

Example:
```typescript
const messages = [];

for await (const message of query({
  prompt: "Help me write a Python function",
  options: {
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: "Always include detailed docstrings and type hints."
    }
  }
})) {
  messages.push(message);
}
```

### 4. Custom System Prompts

- Complete replacement of default instructions
- Provides total control over Claude's behavior

Example:
```typescript
const customPrompt = `You are a Python coding specialist.
Follow these guidelines:
- Write clean, well-documented code
- Use type hints for all function parameters
- Include comprehensive error handling`;

for await (const message of query({
  prompt: "Create a data processing function",
  options: {
    systemPrompt: {
      type: "custom",
      content: customPrompt
    }
  }
})) {
  // Process messages
}
```
