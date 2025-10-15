# Running the Deep Research Agent

Complete guide for running the Deep Research Agent in different modes.

## Quick Start

### 1. Set Up API Key

```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

### 2. Activate Virtual Environment

```bash
# From project root
source venv/bin/activate
```

### 3. Run the Agent

```bash
cd examples/deep_research_agent
python3 deep_research_agent_full.py
```

## Running Modes

### Full Mode (With API Key)

Runs the complete agent with actual AI execution:

```bash
# Set API key
export ANTHROPIC_API_KEY='your-key-here'

# Run agent
python3 deep_research_agent_full.py
```

**What happens:**
- Agent initializes and creates isolated filesystem
- Executes actual research using Claude
- Creates specialized subagents (Researcher, Data Manager, Synthesizer)
- Generates real research content in files
- Tracks todos and progress
- Creates comprehensive summary
- Reports costs and metrics

**Expected output:**
- Detailed logs showing agent activity
- Files created in temporary workspace:
  - `/context/findings.md` - Key insights
  - `/research/context_engineering.md` - Detailed analysis
  - `/output/summary.md` - Final synthesis
- Cost tracking and usage metrics
- Todo completion status

### Demo Mode (Without API Key)

Demonstrates agent structure and error handling without making API calls:

```bash
# Deliberately runs without API key
python3 run_demo_mode.py
```

**What happens:**
- Agent initializes successfully
- Sets up isolated filesystem
- Configures subagents
- Loads MCP servers (if configured)
- Generates system prompts
- Shows proper error handling for missing API key

**Use cases:**
- Test agent configuration
- Verify filesystem isolation works
- Check MCP configuration loading
- Demonstrate error handling
- CI/CD testing without API keys

### Shell Script Mode

Run using the provided shell script:

```bash
# Make executable (first time only)
chmod +x run_without_api_key.sh

# Run
./run_without_api_key.sh
```

This deliberately unsets the API key and shows error handling.

## Example Research Queries

### Basic Research

```python
user_query = """
Research: "Modern AI Agent Architectures"

Please research thoroughly and create a comprehensive summary.
"""
```

### Multi-Step Research

```python
user_query = """
Research: "Context Engineering Techniques"

Steps:
1. Research current state of context engineering
2. Document key findings in /context/
3. Create detailed analysis in /research/
4. Synthesize into final summary in /output/
"""
```

### With Appwrite Integration

```python
user_query = """
Research: "RAG Systems in Production"

Steps:
1. Research RAG systems
2. Check if we have previous research - use data-manager to query Appwrite
3. Build on existing findings
4. Create comprehensive synthesis
"""
```

## Understanding the Logs

The agent provides comprehensive logging organized by category:

### Log Categories

```
[Agent]      - Agent initialization and configuration
[IsolatedFS] - Filesystem operations and cleanup
[Execution]  - Execution flow and status
[Session]    - Session tracking
[Progress]   - Todo tracking and progress updates
[Cost]       - Token usage and cost tracking
[Assistant]  - Agent responses and thinking
```

### Example Log Flow

```
[Agent] Initializing DeepResearchAgent
[Agent] Execution ID: abc123
[Agent] ✓ Loaded MCP configuration
[Agent] Available MCP servers: ['appwrite']
[IsolatedFS] Setting up directory structure...
[IsolatedFS] Created directory: context/
[IsolatedFS] Created directory: research/
[IsolatedFS] Created directory: data/
[IsolatedFS] Created directory: output/
[Execution] Starting Deep Research Session
[Execution] Task: Research: "..."
[Session] Session started: session-xyz
[Progress] Todo Update: 1/5 completed | 1 in progress | 3 pending
[Progress] → Currently working on: Research background
[Assistant] I'll begin researching...
[Cost] Message cost: $0.0023 | Total: $0.0156
[Progress] Todo Update: 2/5 completed | 1 in progress | 2 pending
[Execution] ✓ Execution completed successfully
[IsolatedFS] ✓ Filesystem cleaned up successfully
```

## Workspace Structure

During execution, the agent creates:

```
/tmp/agent_<execution_id>_<random>/
├── README.md               # Workspace documentation
├── context/               # Key findings
│   └── findings.md
├── research/              # Detailed analysis
│   └── <topic>.md
├── data/                  # Data operations
│   ├── operations.log
│   └── summary.json
└── output/                # Final deliverables
    └── summary.md
```

## Configuration

### MCP Configuration

The agent loads MCP servers from `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "appwrite": {
      "type": "stdio",
      "command": "env",
      "args": [
        "APPWRITE_PROJECT_ID=your-project-id",
        "APPWRITE_API_KEY=your-api-key",
        "APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1",
        "uvx",
        "mcp-server-appwrite",
        "--databases"
      ]
    }
  }
}
```

### Agent Parameters

Customize in code:

```python
agent = DeepResearchAgent(
    mcp_config_path="/custom/path/.mcp.json"  # Optional
)

result = await agent.execute(
    task="Your research query",
    max_turns=100  # Maximum conversation turns
)
```

## Output and Results

### Result Object

```python
{
    "execution_id": "abc123",           # Unique execution ID
    "session_id": "session-xyz",        # Claude session ID
    "result": "...",                    # Final result text
    "todos": [...],                     # Todo tracking
    "cost_usd": 0.1234,                # Total cost in USD
    "output_files": [...],              # Generated files
    "workspace": "/tmp/agent_...",      # Workspace path
    "message_count": 42                 # Messages exchanged
}
```

### Todos

Track progress throughout execution:

```python
# Example todos
[
    {
        "content": "Research background",
        "status": "completed",
        "activeForm": "Researching background"
    },
    {
        "content": "Write findings",
        "status": "in_progress",
        "activeForm": "Writing findings"
    },
    {
        "content": "Create synthesis",
        "status": "pending",
        "activeForm": "Creating synthesis"
    }
]
```

## Troubleshooting

### API Key Not Set

```
Error: ANTHROPIC_API_KEY environment variable not set
```

**Solution:**
```bash
export ANTHROPIC_API_KEY='your-key-here'
```

### Module Not Found: claude_agent_sdk

```
ModuleNotFoundError: No module named 'claude_agent_sdk'
```

**Solution:**
```bash
# Activate virtual environment
source venv/bin/activate

# Or install SDK
pip install claude-agent-sdk
```

### MCP Config Not Found

```
Warning: MCP config not found at .mcp.json
```

**Solution:**
- Run from project root, OR
- Provide custom path: `DeepResearchAgent(mcp_config_path="/path/to/.mcp.json")`

### Filesystem Cleanup Issues

If temporary files aren't cleaned up:

```bash
# Find agent workspaces
ls /tmp/agent_*

# Manual cleanup if needed
rm -rf /tmp/agent_*
```

## Performance Tips

### Reduce Costs

1. Lower `max_turns`:
```python
result = await agent.execute(task, max_turns=30)  # Instead of 100
```

2. Use more specific queries:
```python
# ✅ Specific
"Research context engineering in Python agents"

# ❌ Too broad
"Research everything about AI"
```

3. Monitor costs in real-time:
```python
# Logs show per-message costs
[Cost] Message cost: $0.0023 | Total: $0.0156
```

### Optimize Execution

1. Reuse sessions for related queries:
```python
# First query creates session
result1 = await agent.execute(query1)

# Continue in same session (future enhancement)
result2 = await agent.execute(query2, session_id=result1['session_id'])
```

2. Use appropriate models:
```python
# In subagent definitions, use 'sonnet' for most tasks
# Use 'opus' only for complex reasoning
```

## Advanced Usage

### Custom Subagents

Modify subagent definitions in code:

```python
def _get_subagent_definitions(self):
    return {
        'custom-researcher': {
            'description': 'Custom research specialist',
            'prompt': 'Your custom prompt...',
            'tools': ['Read', 'Write', 'TodoWrite'],
            'model': 'sonnet'
        }
    }
```

### Permission Modes

```python
options = ClaudeAgentOptions(
    permission_mode='default'        # Ask for permissions
    # permission_mode='acceptEdits'  # Auto-approve edits
    # permission_mode='bypassPermissions'  # Skip all checks
)
```

### Custom MCP Servers

Add custom MCP servers in `.mcp.json`:

```json
{
  "mcpServers": {
    "custom-server": {
      "type": "stdio",
      "command": "your-mcp-server",
      "args": ["--option"]
    }
  }
}
```

## Testing

### Run Demo Mode

```bash
python3 run_demo_mode.py
```

Verifies:
- ✓ Agent initialization
- ✓ Filesystem isolation
- ✓ Configuration loading
- ✓ Error handling

### Run With API Key

```bash
export ANTHROPIC_API_KEY='your-key'
python3 deep_research_agent_full.py
```

Verifies full execution pipeline.

## Next Steps

1. **Customize Research Queries**: Modify the query in `deep_research_agent_full.py`

2. **Add Custom Subagents**: Define specialized agents for your domain

3. **Integrate Appwrite**: Set up Appwrite MCP for data persistence

4. **Monitor Costs**: Track usage across multiple executions

5. **Extend Functionality**: Add custom tools, hooks, or workflows

## Support

- **Specification**: See `tasks/deep_research_agent_spec.md`
- **Examples**: Check `examples/` directory
- **SDK Docs**: See `docs/guides/python_sdk_docs.md`
