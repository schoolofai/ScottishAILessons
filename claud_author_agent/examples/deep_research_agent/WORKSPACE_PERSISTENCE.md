# Workspace Persistence Guide

The Deep Research Agent now supports **persistent workspaces** that remain available after execution completes.

## Overview

By default, the agent now **persists** the workspace directory, keeping all research files, findings, and analysis available for review after the agent completes its work.

## Key Changes

### 1. Workspace Persists by Default

**Before:**
- Workspace was automatically deleted after execution
- All research files lost
- No way to review detailed analysis

**After:**
- Workspace persists by default
- All files remain accessible
- Full research history available

### 2. Final Result Written to Workspace

The agent now writes a comprehensive `RESULT.md` file to the workspace root containing:

- Execution information (ID, session, cost, messages)
- Original research query
- Final result from the agent
- Progress summary with all todos
- List of all generated files
- Workspace location for easy access

### 3. Configurable Persistence

You can control whether the workspace persists:

```python
# Persist workspace (default)
agent = DeepResearchAgent(persist_workspace=True)

# Don't persist workspace (auto-cleanup)
agent = DeepResearchAgent(persist_workspace=False)
```

## Usage

### Default Behavior (Persist)

```python
from deep_research_agent_full import DeepResearchAgent

agent = DeepResearchAgent()  # persist_workspace=True by default

result = await agent.execute("""
Research: "Your topic here"
...
""")

# Workspace location
print(f"Workspace: {result['workspace']}")
print(f"Result file: {result['result_file']}")
```

### Accessing Results

After execution completes, you can access:

```bash
# Navigate to workspace
cd /tmp/agent_abc123_xyz

# View final result
cat RESULT.md

# Explore files
ls -la
├── README.md              # Workspace documentation
├── RESULT.md             # Final comprehensive result ⭐
├── context/              # Key findings
│   └── findings.md
├── research/             # Detailed analysis
│   └── topic.md
├── data/                 # Data operations
│   └── operations.log
└── output/               # Final synthesis
    └── summary.md
```

## Workspace Structure

### Root Files

- **`README.md`** - Workspace documentation explaining directory structure
- **`RESULT.md`** - Comprehensive final result including:
  - Execution metadata
  - Research query
  - Agent's final response
  - Todo completion status
  - File inventory

### Directories

- **`context/`** - Key findings and insights (quick reference)
- **`research/`** - Detailed research documents (comprehensive analysis)
- **`data/`** - Data operation logs and summaries
- **`output/`** - Final synthesis and deliverables

## RESULT.md Contents

The `RESULT.md` file includes:

```markdown
# Deep Research Session - Final Result

## Execution Information
- Execution ID: abc123
- Session ID: session-xyz
- Completed: 2025-01-15T04:30:00
- Total Messages: 42
- Total Cost: $0.1234

## Research Query
[Your original research query]

## Final Result
[Agent's comprehensive response]

## Progress Summary
Completed 5/5 tasks:
1. ✓ [completed] Research background
2. ✓ [completed] Write findings
3. ✓ [completed] Create analysis
4. ✓ [completed] Synthesize results
5. ✓ [completed] Generate summary

## Workspace Files
[Inventory of all generated files with sizes]

---
Note: This workspace has been persisted and is available at:
/tmp/agent_abc123_xyz

All research files, findings, and analysis remain accessible after execution.
```

## Benefits

### 1. Complete Research History

All research work is preserved:
- Initial findings
- Detailed analysis
- Data operations
- Final synthesis

### 2. Easy Review

Access any part of the research:
```bash
# Quick overview
cat RESULT.md

# Key findings
cat context/findings.md

# Detailed analysis
cat research/context_engineering.md

# Final synthesis
cat output/summary.md
```

### 3. Reproducibility

Workspace includes:
- Execution ID for tracking
- Session ID for resuming
- Complete file history
- Cost and usage metrics

### 4. Collaboration

Share research with team:
```bash
# Archive workspace
tar -czf research_session.tar.gz /tmp/agent_abc123_xyz/

# Share with team
scp research_session.tar.gz colleague@server:~/
```

## Logging

The agent logs workspace persistence status:

```
[IsolatedFS] Initialized filesystem for execution abc123
[IsolatedFS] Root directory: /tmp/agent_abc123_xyz
[IsolatedFS] Persistence: Enabled (workspace will be kept)
[IsolatedFS] Setting up directory structure...
[IsolatedFS] Created directory: context/
[IsolatedFS] Created directory: research/
[IsolatedFS] Created directory: data/
[IsolatedFS] Created directory: output/
[IsolatedFS] ✓ All directories created and ready
...
[Execution] ✓ Final result written to /tmp/agent_abc123_xyz/RESULT.md
...
[IsolatedFS] ✓ Workspace persisted at: /tmp/agent_abc123_xyz
[IsolatedFS] Files will remain available after execution
```

## Cleanup

### Manual Cleanup

If you want to clean up old workspaces:

```bash
# List all agent workspaces
ls -d /tmp/agent_*

# Remove specific workspace
rm -rf /tmp/agent_abc123_xyz

# Remove all agent workspaces
rm -rf /tmp/agent_*
```

### Automatic Cleanup

To disable persistence and auto-cleanup:

```python
agent = DeepResearchAgent(persist_workspace=False)
```

## Testing

Test workspace persistence:

```bash
# Run persistence test
python3 test_persistence.py
```

This verifies:
- ✓ Workspace persists when `persist=True`
- ✓ Workspace cleaned up when `persist=False`
- ✓ Files accessible after execution
- ✓ Logging shows correct status

## Examples

### Example 1: Review Research Files

```python
result = await agent.execute("Research: AI Agents")

# Get workspace location
workspace = Path(result['workspace'])

# Read findings
findings = (workspace / 'context' / 'findings.md').read_text()
print(findings)

# Read detailed analysis
analysis = (workspace / 'research' / 'ai_agents.md').read_text()
print(analysis)

# Read final summary
summary = (workspace / 'output' / 'summary.md').read_text()
print(summary)
```

### Example 2: Extract Specific Information

```python
result = await agent.execute("Research: Context Engineering")

# Read result file
result_md = Path(result['result_file']).read_text()

# Parse for cost information
import re
cost_match = re.search(r'Total Cost: \$(\d+\.\d+)', result_md)
if cost_match:
    cost = float(cost_match.group(1))
    print(f"Research cost: ${cost:.4f}")
```

### Example 3: Archive for Later

```python
import shutil

result = await agent.execute("Research: RAG Systems")

# Archive workspace
archive_name = f"research_{result['execution_id']}.tar.gz"
shutil.make_archive(
    archive_name.replace('.tar.gz', ''),
    'gztar',
    result['workspace']
)

print(f"Archived to: {archive_name}")
```

## Migration

### From Previous Version

If you were using the old version without persistence:

**Old code:**
```python
agent = ContextEngineeringAgent()
result = await agent.execute(task)
# Workspace deleted after execution
```

**New code (same behavior):**
```python
# Workspace persists by default now
agent = DeepResearchAgent()
result = await agent.execute(task)

# Access workspace
workspace = result['workspace']
result_file = result['result_file']

# To get old behavior (auto-cleanup):
agent = DeepResearchAgent(persist_workspace=False)
```

## Best Practices

### 1. Check Workspace After Execution

```python
result = await agent.execute(task)

# Always check workspace location
print(f"Results available at: {result['workspace']}")
print(f"Quick view: cat {result['result_file']}")
```

### 2. Validate File Generation

```python
from pathlib import Path

result = await agent.execute(task)
workspace = Path(result['workspace'])

# Verify expected files exist
expected_files = [
    'RESULT.md',
    'context/findings.md',
    'research/topic.md',
    'output/summary.md'
]

for file_path in expected_files:
    full_path = workspace / file_path
    if not full_path.exists():
        print(f"Warning: Expected file not found: {file_path}")
```

### 3. Monitor Disk Usage

Persistent workspaces accumulate over time:

```bash
# Check disk usage
du -sh /tmp/agent_*

# Cleanup old workspaces (older than 7 days)
find /tmp -name "agent_*" -type d -mtime +7 -exec rm -rf {} +
```

## Troubleshooting

### Workspace Not Found

```python
result = await agent.execute(task)

# Verify workspace exists
from pathlib import Path
workspace = Path(result['workspace'])

if not workspace.exists():
    print(f"ERROR: Workspace not found at {workspace}")
    print("Check if persist_workspace was set to False")
```

### Result File Missing

```python
result = await agent.execute(task)
result_file = Path(result['result_file'])

if not result_file.exists():
    print("ERROR: Result file not created")
    print("This may indicate execution failed before completion")
```

### Disk Space Issues

If persistent workspaces are consuming too much disk:

```bash
# Find large workspaces
du -sh /tmp/agent_* | sort -h | tail -10

# Remove oldest workspaces
ls -td /tmp/agent_* | tail -5 | xargs rm -rf
```

## Summary

The Deep Research Agent now provides:

✅ **Persistent Workspaces** - All files remain after execution
✅ **Comprehensive Result File** - Complete summary in RESULT.md
✅ **Configurable Persistence** - Enable or disable as needed
✅ **Better Logging** - Clear indication of persistence status
✅ **Easy Access** - Simple file structure for review
✅ **Backward Compatible** - Can disable persistence if needed

This makes it easy to review research work, share results, and maintain a complete history of agent executions.
