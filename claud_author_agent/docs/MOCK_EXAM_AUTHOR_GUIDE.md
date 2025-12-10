# Mock Exam Author - Claude Agent SDK Implementation

Autonomous pipeline for authoring frontend-ready mock examination JSON from Scheme of Work entries, with automated diagram generation for Scottish secondary education.

## Overview

This agent transforms `mock_exam` type entries from `Authored_SOW` into comprehensive, static frontend-ready exam JSON structures. Unlike interactive teaching lessons (which use LangGraph), mock exams are rendered as static pages where students see all questions at once, navigate freely, and submit when ready.

**Two Pipeline Options Available**:
- **Monolithic** (`mock_exam_author_claude_client_v2.py`) - Single structured output for smaller exams (~9 questions)
- **Section-Based** (`mock_exam_author_sectioned.py`) - Parallel section generation for larger exams (13+ questions)

**Pipeline Architecture (Section-Based)**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MOCK EXAM AUTHOR PIPELINE (SECTION-BASED)            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: PRE-PROCESSING (Python, 0 tokens)                            │
│  ├── SOW Extractor → Extract mock_exam entries by courseId             │
│  └── Context Loader → Load course metadata, accessibility notes        │
│                                                                         │
│  Phase 2: SECTION-BASED GENERATION (Claude SDK, Parallel)              │
│  ├── Parse assessment cards → Identify section boundaries              │
│  ├── FOR EACH section (in parallel):                                   │
│  │   └── @section_author → Generate section JSON (~2-3K tokens each)   │
│  ├── Section Merger → Combine sections, renumber questions             │
│  └── @ux_critic → Validate full exam UX (iterate until pass)           │
│                                                                         │
│  Phase 3: DIAGRAM GENERATION (Reusable Subagents)                      │
│  FOR EACH question:                                                     │
│  ├── @diagram_classifier → Determine optimal rendering tool            │
│  ├── @diagram_author → Generate PNG via MCP tool                       │
│  └── @diagram_critic → Validate quality (Claude multimodal vision)     │
│                                                                         │
│  Phase 4: POST-PROCESSING (Python, 0 tokens)                           │
│  ├── Schema Validation → Pydantic MockExam model                       │
│  ├── Compression → gzip + base64 for sections                          │
│  └── Upsert → Appwrite `default.mock_exams` + Storage for PNGs         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why Section-Based Generation?**
- **Smaller outputs**: Each section ~2-3K tokens vs ~9K+ for monolithic
- **Parallel execution**: 4 sections generate concurrently (~4x faster)
- **Partial recovery**: Failed section doesn't invalidate others
- **Better scaling**: Handles larger exams (13+ questions) reliably

## Features

- **Static Frontend Output**: Complete exam JSON ready for React rendering (no LangGraph needed)
- **Diagram Automation**: 5 specialized rendering tools (Desmos, GeoGebra, JSXGraph, Plotly, Imagen)
- **Reusable Subagents**: Diagram pipeline works with any orchestrator (mock_exam, lesson, etc.)
- **Quality Validation**: 4-dimension UX critic + visual diagram critic
- **Accessibility**: Plain language alternatives (CEFR A2-B1) for every question
- **Scottish Curriculum**: SQA-aligned, British English, Scottish contexts (£, NHS, local refs)
- **Marking Schemes**: Step-by-step partial credit criteria for every question
- **Worked Solutions**: Complete method explanations for review mode

---

## Quickstart

### Prerequisites

- Python 3.11+
- Claude Agent SDK access (Anthropic API key)
- Appwrite instance (credentials configured in `.mcp.json`)
- DiagramScreenshot service running (for diagram generation)
- Course with `mock_exam` entry in `Authored_SOW` collection

### 5-Minute Setup

```bash
# 1. Navigate to agent directory
cd claud_author_agent

# 2. Create and activate virtual environment
python3 -m venv ../venv
source ../venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and set:
#   ANTHROPIC_API_KEY=your-api-key
#   DIAGRAM_API_URL=http://localhost:3001  (DiagramScreenshot service)
#   DIAGRAM_API_KEY=your-diagram-api-key   (optional)

# 5. Configure Appwrite credentials
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your Appwrite credentials
# NOTE: This file is used as a config source for Appwrite Python SDK
#       (NOT for MCP server - the agent uses direct SDK calls)

# 6. Run the agent (section-based for large exams, recommended)
python scripts/run_mock_exam_author_sectioned.py --course course_c74774

# Or use monolithic for smaller exams (~9 questions)
python scripts/run_mock_exam_author.py --course course_c84474
```

### Quick Test (Dry Run)

```bash
# Section-based (parallel generation, recommended for 13+ questions)
python scripts/run_mock_exam_author_sectioned.py \
  --course course_c74774 \
  --dry-run \
  --log-level DEBUG

# Monolithic (single structured output, for smaller exams)
python scripts/run_mock_exam_author.py \
  --course course_c84474 \
  --dry-run \
  --log-level DEBUG
```

This will:
1. Extract the mock_exam entry from `Authored_SOW`
2. Generate the complete exam JSON (in sections or monolithically)
3. Generate diagrams for eligible questions
4. Write output to workspace (but NOT upsert to Appwrite)

To persist after dry-run:
```bash
python scripts/upsert_mock_exam_from_workspace.py \
  --workspace workspace/<timestamp_folder> --force
```

---

## Installation

### System Requirements

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.11+ | Agent runtime |
| Anthropic API | - | Claude SDK access |
| Appwrite | 1.4+ | Database backend (via Python SDK) |
| DiagramScreenshot | 1.0+ | Diagram rendering API |

> **Note**: Node.js is NOT required. The agent uses the Appwrite Python SDK directly for database operations, not the Appwrite MCP server.

### Step-by-Step Installation

```bash
# Clone repository (if not already done)
git clone --recurse-submodules https://github.com/schoolofai/ScottishAILessons.git
cd ScottishAILessons/claud_author_agent

# Create virtual environment
python3 -m venv ../venv
source ../venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "from src.mock_exam_author_claude_client import MockExamAuthorClaudeAgent; print('OK')"
```

### Environment Configuration

Create `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Diagram Service (required for diagram generation)
DIAGRAM_API_URL=http://localhost:3001
DIAGRAM_API_KEY=optional-api-key

# Optional
LOG_LEVEL=INFO
PERSIST_WORKSPACE=true
```

### Appwrite Credentials Configuration

Create `.mcp.json` (used as a credentials config file, NOT for MCP server):

```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": [
        "APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID=your-project-id",
        "APPWRITE_API_KEY=your-api-key"
      ]
    }
  }
}
```

> **Why `.mcp.json`?** This format maintains compatibility with other agents that DO use Appwrite MCP. The mock exam author reads credentials from this file but uses the Appwrite Python SDK directly for database operations (pre/post processing phases run in Python, not via Claude agent).

---

## Usage

### Available Scripts

| Script | Purpose | Best For |
|--------|---------|----------|
| `run_mock_exam_author.py` | Monolithic generation | Small exams (~9 questions) |
| `run_mock_exam_author_sectioned.py` | Section-based parallel generation | Large exams (13+ questions) |
| `upsert_mock_exam_from_workspace.py` | Upsert only (from existing workspace) | Re-running upsert after dry-run |

### Section-Based Pipeline (Recommended for Large Exams)

```bash
python scripts/run_mock_exam_author_sectioned.py [OPTIONS]
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--course` | Yes | - | Course identifier (e.g., `course_c74774`) |
| `--version` | No | `"1"` | Exam version number |
| `--force` | No | False | Overwrite existing exam |
| `--dry-run` | No | False | Generate but don't upsert |
| `--sequential` | No | False | Disable parallel section generation |
| `--log-level` | No | `INFO` | Logging verbosity |

```bash
# Parallel section generation (default, ~4x faster)
python scripts/run_mock_exam_author_sectioned.py --course course_c74774

# Dry run for testing
python scripts/run_mock_exam_author_sectioned.py --course course_c74774 --dry-run

# Sequential mode (for debugging)
python scripts/run_mock_exam_author_sectioned.py --course course_c74774 --sequential

# Force overwrite existing
python scripts/run_mock_exam_author_sectioned.py --course course_c74774 --force
```

### Monolithic Pipeline (Original)

```bash
python scripts/run_mock_exam_author.py [OPTIONS]
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--course` | Yes | - | Course identifier (e.g., `course_c84474`) |
| `--version` | No | `"1"` | Exam version number |
| `--force` | No | False | Overwrite existing exam |
| `--dry-run` | No | False | Generate but don't upsert |
| `--log-level` | No | `INFO` | Logging verbosity |

```bash
# Basic usage
python scripts/run_mock_exam_author.py --course course_c84474

# Dry run for testing
python scripts/run_mock_exam_author.py --course course_c84474 --dry-run
```

### Upsert-Only Script (From Existing Workspace)

Use this to upsert a mock exam from an existing workspace without regenerating:

```bash
python scripts/upsert_mock_exam_from_workspace.py [OPTIONS]
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--workspace` | Yes | - | Path to workspace directory |
| `--course` | No | From JSON | Course ID (extracted from mock_exam.json if not provided) |
| `--version` | No | `"1"` | Exam version number |
| `--force` | No | False | Delete existing exam before upserting |
| `--log-level` | No | `INFO` | Logging verbosity |

```bash
# Basic upsert from workspace (courseId extracted from mock_exam.json)
python scripts/upsert_mock_exam_from_workspace.py \
  --workspace workspace/20251209_173055_sectioned

# Force overwrite existing exam
python scripts/upsert_mock_exam_from_workspace.py \
  --workspace workspace/20251209_173055_sectioned --force

# With explicit courseId (overrides value in mock_exam.json)
python scripts/upsert_mock_exam_from_workspace.py \
  --workspace workspace/20251209_173055_sectioned \
  --course course_c74774 \
  --version 2
```

**Common use cases for upsert-only:**
- Re-running upsert after a `--dry-run` to persist to database
- Fixing issues in `mock_exam.json` manually and re-upserting
- Debugging the persistence layer independently
- Version control: upserting same exam as different version

### Batch Processing

```bash
# Run batch script for multiple courses
./batch_mock_exams.sh

# Or manually loop (using section-based for large exams)
for course in course_c74774 course_c85123 course_c86789; do
  python scripts/run_mock_exam_author_sectioned.py --course $course
done
```

---

## Architecture

### Subagent Definitions

**Monolithic Pipeline Agents:**

| Subagent | Model | Purpose |
|----------|-------|---------|
| `mock_exam_author` | claude-sonnet-4-5 | Transform SOW entry to exam JSON (single output) |
| `ux_critic` | claude-sonnet-4-5 | Validate frontend UX quality |

**Section-Based Pipeline Agents:**

| Subagent | Model | Purpose |
|----------|-------|---------|
| `section_author` | claude-sonnet-4-5 | Generate single section (~2-3K tokens) |
| `section_reviser` | claude-sonnet-4-5 | Revise section based on critic feedback |
| `section_orchestrator` | Python | Coordinate parallel section generation |
| `section_merger` | Python | Combine sections, renumber questions |
| `ux_critic` | claude-sonnet-4-5 | Validate full exam UX quality |

**Diagram Pipeline Agents (shared):**

| Subagent | Model | Purpose |
|----------|-------|---------|
| `diagram_classifier` | claude-haiku-3-5 | Classify content for diagram tool |
| `diagram_author` | claude-sonnet-4-5 | Generate diagrams via MCP tools |
| `diagram_critic` | claude-sonnet-4-5 | Validate diagram quality |

### Diagram Tool Selection

The classifier determines the optimal rendering tool based on content:

| Priority | Condition | Tool | Use Case |
|----------|-----------|------|----------|
| 1 | Data points/frequencies | PLOTLY | Bar charts, histograms, scatter plots |
| 2 | "function", "graph y=" | DESMOS | Function graphing, parabolas, trig |
| 3 | Circle theorems, constructions | GEOGEBRA | Pure geometry, angle proofs |
| 4 | Transformations with coords | JSXGRAPH | Reflections, rotations, vectors |
| 5 | Real-world physical context | IMAGE_GENERATION | Ladders, bridges, scenarios |
| 6 | Geometry WITHOUT coordinates | GEOGEBRA | Bearings, angles, triangles |
| 7 | Lines/points WITH coordinates | JSXGRAPH | Coordinate geometry |

### MCP Tool Servers (Agent Runtime Only)

The agent uses MCP servers **only during Claude SDK execution** for:

| Server | Tool | Purpose |
|--------|------|---------|
| `validator` | `mcp__validator__validate_mock_exam_schema` | Pydantic schema validation |
| `desmos` | `mcp__desmos__render_desmos` | Function graphing |
| `geogebra` | `mcp__geogebra__render_geogebra` | Geometric constructions |
| `plotly` | `mcp__plotly__render_plotly` | Statistical charts |
| `jsxgraph` | `mcp__jsxgraph__render_jsxgraph` | Coordinate geometry |
| `imagen` | `mcp__imagen__render_imagen` | AI image generation |

**What does NOT use MCP:**
- Pre-processing (SOW extraction) → Python + Appwrite SDK
- Post-processing (upsert to DB) → Python + Appwrite SDK
- File I/O → Python native

### File-Based Communication

Subagents communicate via workspace files:

```
/workspace/
├── mock_exam_source.json      # Input: SOW mock_exam entry
├── sow_context.json           # Input: Course metadata
├── mock_exam.json             # Output: Complete exam
├── mock_exam_critic_result.json  # UX validation result
├── classification_input.json  # Diagram classifier input
├── classification_output.json # Diagram classifier output
├── diagram_request.json       # Diagram author input
├── diagram_metadata.json      # Diagram author output
├── critique_request.json      # Diagram critic input
├── critique_result.json       # Diagram critic output
└── diagrams/                  # Generated PNG files
    ├── q1_question.png
    ├── q3_question.png
    └── ...
```

---

## Output Schema

### MockExam JSON Structure

```json
{
  "$schema": "mock_exam_v1",
  "examId": "exam_abc123",
  "courseId": "course_c84474",
  "sowId": "sow_xyz789",
  "sowEntryOrder": 16,

  "metadata": {
    "title": "National 5 Mathematics - Mock Examination",
    "subject": "mathematics",
    "level": "national-5",
    "totalMarks": 60,
    "timeLimit": 90,
    "instructions": "Answer ALL questions...",
    "instructions_plain": "Answer every question...",
    "calculator_policy": "non_calc | calc | mixed",
    "exam_conditions": true,
    "accessibility_profile": {
      "plain_language_level": "B1",
      "dyslexia_friendly": true,
      "extra_time_percentage": 25
    }
  },

  "sections": [
    {
      "section_id": "section_a",
      "section_label": "Section A: Non-Calculator",
      "section_order": 1,
      "section_marks": 30,
      "section_time_allocation": 45,
      "section_instructions": "Do not use a calculator.",
      "questions": [
        {
          "question_id": "q1",
          "question_number": 1,
          "marks": 3,
          "difficulty": "easy | medium | hard",
          "estimated_minutes": 3,
          "standards_addressed": [...],
          "question_stem": "Simplify $\\frac{12x^3y^2}{4xy}$",
          "question_stem_plain": "Simplify: 12x³y² divided by 4xy",
          "question_type": "structured_response",
          "cfu_config": {
            "type": "structured_response",
            "expected_format": "algebraic_expression",
            "answer_key": {
              "correct_answer": "3x²y",
              "acceptable_variations": ["3x^2y"],
              "marking_scheme": [...]
            }
          },
          "hints": [...],
          "misconceptions": [...],
          "worked_solution": {...},
          "diagram_refs": ["diagrams/q1_question.png"]
        }
      ]
    }
  ],

  "summary": {
    "total_questions": 15,
    "questions_by_difficulty": {...},
    "questions_by_type": {...},
    "standards_coverage": [...]
  },

  "generated_at": "2025-12-04T10:30:00Z",
  "agent_version": "mock_exam_author_v1.0"
}
```

### Question Types

| Type | Frontend Rendering | Example |
|------|-------------------|---------|
| `mcq` | Radio buttons | Single choice |
| `mcq_multiselect` | Checkboxes | Multiple correct |
| `numeric` | Number input | 3.5, -2, 0.75 |
| `short_text` | Text input | "3x²y" |
| `structured_response` | Multi-line + drawing | Extended problems |

---

## Diagram Generation

### Diagram Workflow

```
Question Analysis
       │
       ▼
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Classification │────▶│  Diagram Author  │────▶│ Diagram Critic │
│    Subagent     │     │    Subagent      │     │   Subagent     │
└─────────────────┘     └──────────────────┘     └────────────────┘
       │                        │                        │
       ▼                        ▼                        ▼
  tool: DESMOS            PNG generated           decision: ACCEPT
  confidence: HIGH        /workspace/diagrams/    final_score: 0.88
                          q3_question.png
                                                         │
                                                         ▼
                                              ┌─────────────────┐
                                              │ If REFINE:      │
                                              │ Loop back with  │
                                              │ corrections     │
                                              │ (max 10 iters)  │
                                              └─────────────────┘
```

### Critic Scoring Dimensions

| Dimension | Weight | Focus |
|-----------|--------|-------|
| Clarity | 35% | Labels readable, no overlaps, good spacing |
| Accuracy | 35% | Mathematical correctness, proper notation |
| Pedagogy | 20% | Supports learning, NO answers for CFU |
| Aesthetics | 10% | Scottish palette, high contrast, accessible |

### Progressive Threshold Policy

| Iteration | Threshold | Early Accept |
|-----------|-----------|--------------|
| 1-2 | 0.85 | None |
| 3-4 | 0.82 | If accuracy ≥ 0.90 |
| 5-6 | 0.80 | If accuracy ≥ 0.90 AND no critical issues |
| 7-10 | 0.78 | If accuracy ≥ 0.90 AND pedagogy ≥ 0.80 |

---

## Appwrite Collections

### mock_exams Collection

```javascript
{
  // Identifiers
  "examId": "exam_abc123",        // Unique exam ID
  "courseId": "course_c84474",    // Links to course
  "sowId": "sow_xyz789",          // Links to Authored_SOW
  "sowEntryOrder": 16,            // Position in SOW

  // Content (compressed)
  "metadata": "{...}",            // JSON stringified
  "sections": "H4sIAAAA...",      // gzip + base64
  "summary": "{...}",             // JSON stringified

  // Status
  "version": "1",
  "status": "draft | published | archived",

  // Timestamps
  "generated_at": "2025-12-04T10:30:00Z",
  "agent_version": "mock_exam_author_v1.0"
}
```

### Indexes Required

```javascript
indexes: [
  { key: "courseId", type: "key" },
  { key: "sowId", type: "key" },
  { key: "status", type: "key" },
  { key: ["courseId", "version"], type: "unique" }
]
```

---

## Troubleshooting

### Common Issues

#### "No mock_exam entry found"

```
Error: No mock_exam entry found for courseId: course_c84474
```

**Solution**: Ensure the `Authored_SOW` collection has an entry with `lesson_type: "mock_exam"` for this course.

#### "DiagramScreenshot service unavailable"

```
Error: Connection refused to http://localhost:3001
```

**Solution**: Start the DiagramScreenshot service:
```bash
cd diagram-screenshot-service
npm start
```

#### "Diagram generation timeout"

**Solution**: Increase timeout or check service logs:
```bash
tail -f diagram-screenshot-service/logs/app.log
```

#### "UX critic failing repeatedly"

**Solution**: Check `mock_exam_critic_result.json` in workspace for specific feedback. Common issues:
- Missing plain language alternatives
- Marks don't sum correctly
- Missing worked solutions

### Debug Mode

```bash
# Enable verbose logging
python -m src.mock_exam_author_cli \
  --courseId course_c84474 \
  --log-level DEBUG \
  --persist-workspace

# Check workspace files
ls -la /tmp/mock_exam_*/
cat /tmp/mock_exam_*/mock_exam.json
cat /tmp/mock_exam_*/mock_exam_critic_result.json
```

### Workspace Files for Debugging

| File | Check For |
|------|-----------|
| `mock_exam_source.json` | SOW entry extraction correct? |
| `mock_exam.json` | Schema valid? Marks sum? |
| `mock_exam_critic_result.json` | UX dimensions passing? |
| `classification_output.json` | Correct tool selected? |
| `diagram_metadata.json` | PNG generated successfully? |
| `critique_result.json` | Diagram quality acceptable? |

---

## Cost Estimation

### Token Usage (Approximate)

| Phase | Model | Tokens | Cost (est.) |
|-------|-------|--------|-------------|
| Mock Exam Author | claude-sonnet-4-5 | ~15K | $0.45 |
| UX Critic (2 iterations) | claude-sonnet-4-5 | ~8K | $0.24 |
| Diagram Classifier (15 questions) | claude-haiku-3-5 | ~3K | $0.008 |
| Diagram Author (8 diagrams) | claude-sonnet-4-5 | ~12K | $0.36 |
| Diagram Critic (8 diagrams) | claude-sonnet-4-5 | ~10K | $0.30 |
| **Total** | - | **~48K** | **~$1.36** |

*Costs vary based on question complexity and diagram iteration count.*

---

## Related Documentation

- [LESSON_AUTHOR_GUIDE.md](./LESSON_AUTHOR_GUIDE.md) - Interactive lesson authoring
- [SOW_AUTHOR_GUIDE.md](./SOW_AUTHOR_GUIDE.md) - Scheme of Work authoring
- [DIAGRAM_AUTHOR_GUIDE.md](./DIAGRAM_AUTHOR_GUIDE.md) - Standalone diagram generation
- [MCP_EXTERNAL_SERVERS.md](./MCP_EXTERNAL_SERVERS.md) - MCP server configuration
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Command cheat sheet

---

## Changelog

### v1.1.0 (2025-12-09)
- **Section-Based Pipeline**: Added parallel section generation for large exams (13+ questions)
  - New orchestrator: `section_based_orchestrator.py`
  - New agent: `section_author_agent.py` with dedicated prompt
  - New merger: `section_merger.py` for combining sections with renumbering
  - New runner: `run_mock_exam_author_sectioned.py`
  - ~4x faster generation via parallel section execution
- **Standalone Upsert Script**: Added `upsert_mock_exam_from_workspace.py`
  - Run upsert from existing workspace without re-running pipeline
  - Auto-extracts courseId from mock_exam.json
  - Supports `--force` to overwrite existing exams
- **Validation Fixes**:
  - Fixed empty string handling for metadata.subject and metadata.level
  - Added calculator_policy mapping ('both' → 'mixed')
  - Fixed CEFR prefix stripping (CEFR_B1 → B1)
  - Added integer marks validation in section author prompt

### v1.0.0 (2025-12-04)
- Initial release
- Mock exam JSON generation from SOW entries
- Integrated diagram generation pipeline (5 tools)
- UX critic validation
- Appwrite upsert support
