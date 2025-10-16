# Scottish AI Lessons - Authoring Agents

This repository contains two autonomous agents for Scottish secondary education content creation using Claude Agent SDK:

1. **SOW Author** - Creates complete Schemes of Work (course-level planning)
2. **Lesson Author** - Creates detailed lesson templates (lesson-level design)

## Which Agent Do I Need?

| Use Case | Agent | Input | Output | Documentation |
|----------|-------|-------|--------|---------------|
| **Create course overview** with 8-15 lesson entries | SOW Author | subject + level + courseId | Authored_SOW document | [SOW Author docs](#sow-author) |
| **Create detailed lesson** with 3-15 interactive cards | Lesson Author | courseId + order | lesson_templates document | [Lesson Author docs](LESSON_AUTHOR_README.md) |

**Typical Workflow**:
1. Use **SOW Author** to create the initial course plan (8-15 lesson entries)
2. Use **Lesson Author** to flesh out each lesson entry into a full lesson template

---

# SOW Author

Autonomous pipeline for authoring Schemes of Work (SOW) for Scottish secondary education using Claude Agent SDK.

## Overview

This agent takes a `{subject, level, courseId}` input and produces a complete, validated SOW in the Appwrite database through Python pre-processing + 2-subagent pipeline + deterministic Python upserting:

**Pre-Processing (Python)**:
0. **Course Data Extractor (Python)** → Appwrite SDK → `Course_data.txt` (no LLM, deterministic)

**Pipeline Execution (2 Subagents)**:
1. **SOW Author (with WebSearch/WebFetch)** → Authoring with on-demand research → `authored_sow_json`
2. **Unified Critic** → Validation (with retry) → `sow_critic_result_json`

**Post-Processing (Python)**:
3. **Python Upserter** → Database write → Appwrite `default.Authored_SOW` (deterministic)

## Features

- ✅ **Fully Autonomous**: Subject + level + courseId → complete SOW in database
- ✅ **Fail-Fast Validation**: Validates courseId exists in database before pipeline execution
- ✅ **Hybrid Orchestration**: Python for deterministic operations (extraction, upserting), LLMs for creative tasks (authoring, critique)
- ✅ **On-Demand Research**: WebSearch/WebFetch tools for targeted, lesson-specific research (no upfront bulk collection)
- ✅ **Flat File Architecture**: Simple 2-file workspace for subagent communication (`Course_data.txt`, `authored_sow_json`)
- ✅ **Quality Validation**: 5-dimension critic with automatic retry (up to 3 attempts)
- ✅ **Deterministic Database Operations**: Python-based course data extraction and upserting for reliability (no agent variance)
- ✅ **Cost Optimization**: Python extraction + on-demand research saves ~10-15K tokens per execution vs. upfront bulk research
- ✅ **Cost Tracking**: Per-subagent and total token/cost metrics
- ✅ **Workspace Persistence**: Optional preservation for debugging
- ✅ **Hardcoded MVP Fields**: version="1", status="draft" for simplicity
- ✅ **Scottish Curriculum Compliant**: SQA standards, CfE alignment, Scottish contexts
- ✅ **LangGraph Prompt Alignment**: Production-ready prompts aligned with LangGraph architecture

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
  "courseId": "course_c84474"
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
  --courseId course_c84474
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
    courseId="course_c84474"
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
- **courseId** (required): Course identifier - the **courseId field value**, not document $id (e.g., `"course_c84474"`)
  - **Must exist** in `default.courses` collection (queried by courseId field)
  - **Must match** the subject/level provided
  - Pipeline will fail fast if courseId not found or mismatched

---

## Comparison: SOW Author vs Lesson Author

| Feature | SOW Author | Lesson Author |
|---------|------------|---------------|
| **Purpose** | Course-level planning | Lesson-level detailed design |
| **Input** | subject + level + courseId | courseId + order |
| **Output** | Complete SOW with 8-15 lesson entries | Single lesson template with 3-15 cards |
| **Database Collection** | `default.Authored_SOW` | `default.lesson_templates` |
| **Subagents** | 2 (SOW Author, Unified Critic) | 3 (Research, Lesson Author, Critic) |
| **Pipeline Stages** | 3 (extract → author → critic) | 5 (extract → research → author → critic → upsert) |
| **Expected Tokens** | 50-80K | 35-60K |
| **Expected Cost** | $1.50-2.50 | $1.25-2.15 |
| **Execution Time** | 3-5 minutes | 2-4 minutes |
| **Retry Logic** | Up to 3 attempts | Up to 10 attempts |
| **Workspace Files** | 2-3 files | 5 files |
| **CLI Tool** | `src.sow_author_cli` | `src.lesson_author_cli` |
| **Documentation** | This README | [LESSON_AUTHOR_README.md](LESSON_AUTHOR_README.md) |
| **Implementation Status** | [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | [LESSON_AUTHOR_IMPLEMENTATION_STATUS.md](LESSON_AUTHOR_IMPLEMENTATION_STATUS.md) |

### When to Use Each Agent

**Use SOW Author when you need to**:
- Create a new course structure from scratch
- Generate 8-15 high-level lesson entries for a full course
- Plan course-wide learning progression and assessment strategy
- Define engagement tags, timing allocations, and policy notes

**Use Lesson Author when you need to**:
- Create detailed interactive lesson materials
- Design 3-15 pedagogical cards with explainers, assessments, and feedback
- Add Scottish contexts and accessibility features to specific lessons
- Generate SQA-aligned rubrics and misconception anticipation

### Typical Workflow

```bash
# Step 1: Create SOW (course planning)
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId course_c84474

# Step 2: Author lesson 1 (first lesson)
python -m src.lesson_author_cli \
  --courseId course_c84474 \
  --order 1

# Step 3: Author lesson 2 (second lesson)
python -m src.lesson_author_cli \
  --courseId course_c84474 \
  --order 2

# Continue for all lesson entries in the SOW...
# Note: Order values start from 1 (not 0). SOW entries are 1-indexed.
```

---

## Documentation

**SOW Author**:
- Main README: This file
- Implementation Status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- Implementation Plan: `tasks/sow-author-claude-sdk-implementation-plan.md`

**Lesson Author**:
- Main README: [LESSON_AUTHOR_README.md](LESSON_AUTHOR_README.md)
- Implementation Status: [LESSON_AUTHOR_IMPLEMENTATION_STATUS.md](LESSON_AUTHOR_IMPLEMENTATION_STATUS.md)
- Implementation Specification: `tasks/LESSON_AUTHOR_AGENT_SPEC.md`
