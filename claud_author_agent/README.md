# SOW Author - Claude Agent SDK Implementation

Autonomous pipeline for authoring Schemes of Work (SOW) for Scottish secondary education using Claude Agent SDK.

## Overview

This agent takes a `{subject, level, courseId}` input and produces a complete, validated SOW in the Appwrite database through a 4-subagent pipeline + deterministic Python upserter:

1. **Research Subagent** → Web research → `research_pack_json`
2. **Course Data Extractor** → Appwrite MCP → `Course_data.txt`
3. **SOW Author** → Authoring → `authored_sow_json`
4. **Unified Critic** → Validation (with retry) → `sow_critic_result_json`
5. **Python Upserter** → Database write → Appwrite `default.Authored_SOW` (deterministic)

## Features

- ✅ **Fully Autonomous**: Subject + level + courseId → complete SOW in database
- ✅ **Fail-Fast Validation**: Validates courseId exists in database before pipeline execution
- ✅ **Flat File Architecture**: Simple 4-file workspace for subagent communication
- ✅ **Quality Validation**: 5-dimension critic with automatic retry (up to 3 attempts)
- ✅ **Deterministic Database Operations**: Python-based upserting for reliability (no agent variance)
- ✅ **Cost Tracking**: Per-subagent and total token/cost metrics
- ✅ **Workspace Persistence**: Optional preservation for debugging
- ✅ **Hardcoded MVP Fields**: version="1", status="draft" for simplicity
- ✅ **Scottish Curriculum Compliant**: SQA standards, CfE alignment, Scottish contexts

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access
- Appwrite instance (with MCP server configured)
- Node.js (for Appwrite MCP server)
- **Course must exist in `default.courses` collection** with matching subject/level before authoring SOW

### Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure Appwrite MCP
cp .mcp.json.example .mcp.json
# Edit .mcp.json and add your APPWRITE_API_KEY
```

## Usage

### Method 1: CLI with JSON Input (Recommended)

```bash
# Create input.json
cat > input.json << EOF
{
  "subject": "mathematics",
  "level": "national-5",
  "courseId": "68e262811061bfe64e31"
}
EOF

# Run agent
source ../venv/bin/activate
python -m src.sow_author_cli --input input.json
```

### Method 2: CLI with Command-Line Arguments

```bash
source ../venv/bin/activate
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId 68e262811061bfe64e31
```

### Method 3: Interactive Mode

```bash
source ../venv/bin/activate
python -m src.sow_author_cli

# Follow the interactive prompts
```

### Method 4: Python API (Programmatic)

```python
from src.sow_author_claude_client import SOWAuthorClaudeAgent

agent = SOWAuthorClaudeAgent(
    mcp_config_path=".mcp.json",
    persist_workspace=True,
    max_critic_retries=3
)

result = await agent.execute(
    subject="mathematics",
    level="national-5",
    courseId="68e262811061bfe64e31"
)
```

### CLI Options

```bash
python -m src.sow_author_cli --help

Options:
  --input JSON_FILE          Path to JSON input file
  --subject TEXT             SQA subject (e.g., "mathematics")
  --level TEXT               SQA level (e.g., "national-5")
  --courseId TEXT            Course identifier
  --mcp-config PATH          MCP config path (default: .mcp.json)
  --max-retries N            Critic retry attempts (default: 3)
  --no-persist-workspace     Delete workspace after execution
  --log-level LEVEL          Logging level (default: INFO)
```

### Input Parameters

- **subject** (required): SQA subject in lowercase with hyphens (e.g., `"mathematics"`, `"application-of-mathematics"`)
- **level** (required): SQA level in lowercase with hyphens (e.g., `"national-5"`, `"higher"`)
- **courseId** (required): Course identifier (e.g., `"68e262811061bfe64e31"`)
  - **Must exist** in `default.courses` collection
  - **Must match** the subject/level provided
  - Pipeline will fail fast if courseId not found or mismatched

## Documentation

See `tasks/sow-author-claude-sdk-implementation-plan.md` for complete implementation details.
