# Diagram Author System - Complete Guide

**Version**: 1.0 (Claude Agent SDK Implementation)
**Last Updated**: 2025-11-02

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Input/Output Specification](#inputoutput-specification)
7. [Subagent Prompts](#subagent-prompts)
8. [MCP Tool Integration](#mcp-tool-integration)
9. [Scottish Context Requirements](#scottish-context-requirements)
10. [Token Optimization](#token-optimization)
11. [Quality Assurance](#quality-assurance)
12. [Troubleshooting](#troubleshooting)
13. [API Reference](#api-reference)
14. [Examples](#examples)

---

## Overview

The Diagram Author is an autonomous AI-powered system that generates high-quality JSXGraph mathematical diagrams for lesson templates in Scottish secondary education. It transforms lesson card content into interactive, pedagogically sound, curriculum-aligned visual representations with automated quality validation.

### Key Features

- ✅ **Autonomous Diagram Generation**: From lesson cards to rendered PNG diagrams
- ✅ **Auto-Fetching**: Retrieves lesson template from Appwrite by courseId + order
- ✅ **2-Subagent Pipeline**: Diagram generation + visual critique with iterative refinement
- ✅ **Quality-First Approach**: Minimum score threshold (0.85) with up to 3 refinement iterations
- ✅ **MCP Tool Integration**: DiagramScreenshot service for PNG rendering via HTTP
- ✅ **Scottish Color Palette**: Mandatory brand colors (#0066CC primary blue)
- ✅ **Fast-Fail Design**: No fallback patterns - strict error handling
- ✅ **Cost Tracking**: Detailed token usage and cost metrics per diagram
- ✅ **Workspace Isolation**: Each execution gets isolated filesystem

### What Gets Generated

A complete diagram generation produces:
- **JSXGraph JSON**: Mathematical diagram configuration (board + elements)
- **Rendered PNG Image**: Base64-encoded high-resolution screenshot (1200x800, 2x scale)
- **Visual Critique Report**: 4-dimensional quality scoring (clarity, accuracy, pedagogy, aesthetics)
- **Metadata**: Diagram type, iteration count, refinement feedback history
- **Appwrite Documents**: Stored in `default.lesson_diagrams` collection

---

## Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                 DIAGRAM AUTHOR PIPELINE                          │
│                      (3 stages)                                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ STAGE 0: Pre-Processing (Python Utilities, 0 tokens)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Lesson Template Extractor                                   │
│     Input:  courseId + order                                    │
│     Source: Appwrite default.lesson_templates collection        │
│     Output: /workspace/lesson_template.json                     │
│     Purpose: Fetch complete lesson with all cards              │
│                                                                   │
│  2. Eligible Cards Filter (LLM-Based Semantic Analysis)         │
│     Input:  lesson_template.json + Claude API                   │
│     Logic:  LLM analyzes card content for JSXGraph compatibility│
│     Output: /workspace/eligible_cards.json                      │
│     Purpose: Identify cards needing mathematical diagrams       │
│     Note:   Excludes rubrics, worksheets, concept maps, photos  │
│                                                                   │
│  3. DiagramScreenshot Service Health Check                      │
│     Endpoint: GET http://localhost:3001/health                  │
│     Purpose:  Fast-fail if rendering service unavailable        │
│     Note:     Prevents agent execution without rendering        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ STAGE 1: Agent Execution (2 Subagents + Orchestrator)           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Main Orchestrator Agent                                        │
│  Prompt: src/prompts/diagram_author_prompt.md (202 lines)      │
│                                                                   │
│  Responsibilities:                                              │
│    • Read lesson_template.json and eligible_cards.json         │
│    • For each eligible card (sequential processing):           │
│      ├─ Delegate to @diagram_generation_subagent              │
│      ├─ Delegate to @visual_critic_subagent                   │
│      ├─ Quality check: score ≥ 0.85?                          │
│      │  ├─ YES → Accept, proceed to next card                 │
│      │  └─ NO → Refine (max 3 iterations per card)            │
│      └─ Record result (success or failure)                     │
│    • Write diagrams_output.json with all results              │
│                                                                   │
│  Tools Available:                                               │
│    • Read, Write, Edit, Glob, Grep                             │
│    • TodoWrite, Task                                            │
│    • WebSearch, WebFetch (for JSXGraph documentation)          │
│    • NO Appwrite MCP tools (data pre-fetched)                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│  @diagram_generation_subagent                                   │
│  Prompt: src/prompts/diagram_generation_subagent.md (308 lines)│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input (from orchestrator):                                     │
│    • cardId, title, explainer, cfu                             │
│    • cardType (teach, independent_practice, etc.)              │
│    • iteration (1, 2, or 3)                                     │
│    • critique_feedback (if iteration > 1)                       │
│                                                                   │
│  Process:                                                        │
│    1. Analyze card mathematical content                         │
│    2. Determine diagram type (geometry, algebra, statistics)    │
│    3. Generate JSXGraph JSON with Scottish color palette        │
│    4. Call mcp__diagram-screenshot__render_diagram tool         │
│    5. Handle rendering errors (retry up to 3 times)            │
│    6. Return {jsxgraph_json, image_base64, diagram_type}       │
│                                                                   │
│  Scottish Color Palette (MANDATORY):                            │
│    • Primary Blue:    #0066CC (main elements, axes)            │
│    • Success Green:   #28a745 (correct answers)                │
│    • Warning Orange:  #FFA500 (attention points)               │
│    • Danger Red:      #DC3545 (errors, critical)               │
│    • Neutral Gray:    #6c757d (secondary elements)             │
│                                                                   │
│  JSXGraph Element Types:                                        │
│    • Points, Lines, Circles, Polygons                          │
│    • Function graphs, Text labels                              │
│    • Custom elements (angles, transformations)                 │
│                                                                   │
│  Output Format:                                                  │
│    {                                                             │
│      "jsxgraph_json": "{\"board\": {...}, \"elements\": [...]}",│
│      "image_base64": "iVBORw0KGgo...",                         │
│      "diagram_type": "geometry",                                │
│      "status": "ready_for_critique",                            │
│      "render_attempts": 1,                                      │
│      "render_time_ms": 450                                      │
│    }                                                             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│  @visual_critic_subagent                                        │
│  Prompt: src/prompts/visual_critic_subagent.md (295 lines)     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input (from orchestrator):                                     │
│    • jsxgraph_json (original configuration)                     │
│    • image_base64 (rendered PNG, analyzed with vision)         │
│    • card_content (original card text for context)             │
│    • iteration (1, 2, or 3)                                     │
│    • diagram_type (geometry, algebra, statistics, mixed)       │
│                                                                   │
│  Critique Dimensions (4-Point Weighted Scale):                 │
│                                                                   │
│    1. Clarity (Weight: 35%)                                     │
│       • Appropriate bounding box (not too zoomed)               │
│       • No overlapping elements or labels                       │
│       • Clear visual hierarchy                                  │
│       • Proper element sizing                                   │
│       Threshold: 0.75-1.00 = Crystal clear                     │
│                                                                   │
│    2. Accuracy (Weight: 35%)                                    │
│       • Mathematically correct (angles, lengths, ratios)        │
│       • Accurate function graphs (shape, intercepts, roots)     │
│       • Scottish context (£, meters, not $ or feet)            │
│       • Proper mathematical notation                           │
│       Threshold: 0.75-1.00 = Perfectly accurate                │
│                                                                   │
│    3. Pedagogy (Weight: 20%)                                    │
│       • Aligns with card content and lesson type               │
│       • Supports learning objectives                            │
│       • Appropriate complexity for secondary level              │
│       • Scottish Curriculum for Excellence alignment            │
│       Threshold: 0.75-1.00 = Excellent pedagogical design      │
│                                                                   │
│    4. Aesthetics (Weight: 10%)                                  │
│       • Scottish color palette (#0066CC primary)                │
│       • High contrast (WCAG AA: 4.5:1 minimum)                 │
│       • Dyslexia-friendly spacing                              │
│       • Professional appearance                                 │
│       Threshold: 0.75-1.00 = Beautiful, accessible             │
│                                                                   │
│  Scoring Formula:                                                │
│    final_score = (clarity × 0.35) + (accuracy × 0.35) +        │
│                  (pedagogy × 0.20) + (aesthetics × 0.10)       │
│                                                                   │
│  Decision Logic:                                                 │
│    • score ≥ 0.85 → ACCEPT (high quality, ready for lessons)   │
│    • score < 0.85 → REFINE (needs improvement)                 │
│                                                                   │
│  Iteration-Specific Leniency:                                   │
│    • Iteration 1: Strict (threshold 0.85)                       │
│    • Iteration 2: Moderate (threshold 0.82)                     │
│    • Iteration 3: Lenient (threshold 0.80)                      │
│                                                                   │
│  Output Format:                                                  │
│    {                                                             │
│      "decision": "ACCEPT" | "REFINE",                           │
│      "final_score": 0.91,                                       │
│      "dimension_scores": {                                      │
│        "clarity": 0.90, "accuracy": 0.95,                      │
│        "pedagogy": 0.85, "aesthetics": 0.90                    │
│      },                                                          │
│      "strengths": ["Clear labeling...", "Accurate angles..."], │
│      "improvements": ["Increase padding...", "Add grid..."],   │
│      "specific_changes": ["Change boundingbox from...",        │
│                           "Set fontSize to 16..."],            │
│      "critical_issues": [],                                     │
│      "iteration_notes": "Ready to accept after refinement."    │
│    }                                                             │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│  Quality Check & Refinement Loop                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  If score < threshold AND iteration < 3:                        │
│    1. Orchestrator sends critique_feedback to generator         │
│    2. Generator creates refined JSXGraph JSON                   │
│    3. Generator re-renders with MCP tool                        │
│    4. Critic re-evaluates new diagram                           │
│    5. Repeat until ACCEPT or max 3 iterations                   │
│                                                                   │
│  If iteration == 3 AND score < 0.80:                            │
│    → FAIL (reject diagram, no fallback to low quality)         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ STAGE 2: Post-Processing (Python Utilities, 0 tokens)           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Parse diagrams_output.json                                  │
│     Source: /workspace/diagrams_output.json                     │
│     Extract: diagrams array + errors array                      │
│                                                                   │
│  2. Batch Upsert to Appwrite                                    │
│     Collection: default.lesson_diagrams                         │
│     Pattern:    Query by (lesson_template_id, card_id)         │
│                 → Update existing OR create new                 │
│                                                                   │
│  3. Document Structure:                                          │
│     {                                                            │
│       "lesson_template_id": "lesson_abc123",                    │
│       "card_id": "card_001",                                    │
│       "jsxgraph_json": "{...}",                                 │
│       "image_base64": "iVBORw0KGgo...",                        │
│       "diagram_type": "geometry",                               │
│       "visual_critique_score": 0.91,                            │
│       "critique_iterations": 2,                                 │
│       "critique_feedback": [...],                               │
│       "execution_id": "exec_20251102_143025"                    │
│     }                                                            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Design Principles

**1. Token Optimization via Pre/Post-Processing**
- Lesson template fetching: Python utility (0 tokens)
- Card filtering: Simple heuristic (0 tokens)
- Database upsert: Python utility (0 tokens)
- **Savings**: ~20-30K tokens vs full LLM pipeline

**2. Quality-First Philosophy**
- **No fallback patterns**: Low-quality diagrams rejected (fail-fast)
- **Iterative refinement**: Up to 3 attempts per diagram
- **Strict thresholds**: 0.85 minimum score (iteration 1)
- **4-dimensional validation**: Clarity, accuracy, pedagogy, aesthetics

**3. Scottish Curriculum Compliance**
- **Mandatory color palette**: #0066CC primary blue (brand consistency)
- **Cultural requirements**: £ (not $), meters (not feet)
- **CfE alignment**: Lesson type and outcome-specific diagrams

**4. MCP Tool Integration**
- **Single tool registration**: `mcp__diagram-screenshot__render_diagram`
- **HTTP service wrapper**: POST to localhost:3001/api/v1/render
- **Fast-fail error handling**: Timeout 30s, no retry at tool level
- **Base64 image return**: PNG encoded for direct storage

**5. LLM-Based Eligibility Determination**
- **Semantic analysis**: Claude analyzes card content for JSXGraph compatibility
- **Dual-context evaluation**: Separate decisions for lesson diagrams and CFU diagrams
- **Structured reasoning**: Returns boolean decision + human-readable explanation
- **No fallback pattern**: LLM analysis is required - no keyword heuristic fallback
- **Explicit exclusions**: Rubrics, worksheets, concept maps, photographs filtered out

---

## Quick Start

### Single Lesson Mode (Minimal Example)

```bash
cd claud_author_agent

# Ensure DiagramScreenshot service is running
cd ../diagram-prototypes
docker compose up -d
cd ../claud_author_agent

# Generate diagrams for ALL cards in lesson 1
source ../venv/bin/activate
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1

# OR: Generate diagrams for ONLY card #3 in lesson 1
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --card-order 3
```

**Expected Output**:
```
🚀 Diagram Author Claude Agent
================================================

Input Parameters:
  Course ID:     course_c84874
  Order:         1

✅ DiagramScreenshot service is healthy at http://localhost:3001

Pre-processing: Fetching lesson template...
✅ Fetched lesson template: lesson_abc123 - 'Fractions Introduction' (8 cards)

Pre-processing: Filtering eligible cards...
✅ Identified 3/8 cards needing diagrams

Starting agent execution...
[Agent processes each card with generation → critique → refine loop]

Post-processing: Batch upserting to Appwrite...
✅ Batch upsert complete: 3 succeeded, 0 failed

================================================
🎉 DIAGRAM GENERATION SUCCESSFUL
================================================

Results:
  Execution ID:        exec_20251102_143025
  Workspace Path:      workspace/exec_20251102_143025
  Diagrams Generated:  3
  Diagrams Skipped:    5 (no visual component needed)
  Diagrams Failed:     0

Appwrite Document IDs:
  - diagram_xyz789
  - diagram_abc456
  - diagram_def123

Metrics:
  Total Tokens:        28,450
  Total Cost (USD):    $0.4268
  Execution Time:      3m 42s
```

---

### Batch Mode (All Lessons in Course)

**NEW**: Generate diagrams for all lessons in a course with one command:

```bash
cd claud_author_agent
source ../venv/bin/activate

# 1. Dry-run preview (recommended first step)
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --dry-run

# 2. Review estimates and execution plan, then execute
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --yes

# 3. Force regenerate all diagrams (deletes existing)
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --force \
  --yes
```

**Dry-Run Preview Output**:
```
================================================================================
Batch Diagram Generator
================================================================================

Course ID: course_c84874
Mode: Dry-run
Force: No (will skip existing)

✅ DiagramScreenshot service is healthy at http://localhost:3001

Step 1: Fetching lesson orders from SOW...
✅ Found 10 lessons in SOW

Step 2: Validating all lessons...
✅ Validation complete: 10 valid, 0 invalid

Step 3: Checking existing diagrams...
✅ Found existing diagrams for 2 lessons

Step 4: Building execution plan...
✅ Execution plan ready

================================================================================
DRY RUN PREVIEW - No changes will be made
================================================================================

Total Lessons: 10
  - Generate: 8
  - Overwrite: 0
  - Skip: 2
  - Malformed (validation failed): 0

Order    Action       Reason
--------------------------------------------------------------------------------
1        SKIP         Already has 3 diagrams (use --force to regenerate)
2        GENERATE     Generate 5 new diagrams
3        GENERATE     Generate 2 new diagrams
4        SKIP         Already has 4 diagrams (use --force to regenerate)
5        GENERATE     Generate 3 new diagrams
...

ESTIMATES:
  Lessons to process: 8
  Time: ~40 minutes (~0.7 hours)
  Cost: ~$4.00
  Per lesson: ~5 min, ~$0.50

Dry-run mode: No changes made
```

**Batch Execution Output**:
```
================================================================================
Starting batch execution...
================================================================================

⏭️  Lesson 1: SKIPPED - Already has 3 diagrams (use --force to regenerate)

🚀 Processing lesson 2...
✅ Lesson 2: 5 diagrams generated

🚀 Processing lesson 3...
✅ Lesson 3: 2 diagrams generated

...

Writing batch summary...
✅ Summary written to logs/batch_runs/batch_diagram_20251107_143025/batch_summary.json

================================================================================
BATCH EXECUTION COMPLETE
================================================================================

Summary:
  Total Lessons: 10
  Success: 8
  Failed: 0
  Skipped: 2
  Total Diagrams Generated: 24
  Total Cost: $3.85
  Total Time: 38 minutes

🎉 Batch completed successfully!
```

**Key Features**:
- ✅ **Dry-run preview** with time/cost estimates before execution
- ✅ **Validation** of all lessons before starting (fast-fail)
- ✅ **Skip existing** diagrams automatically (use `--force` to regenerate)
- ✅ **Per-lesson logging** in `logs/batch_runs/{batch_id}/order_{N}.log`
- ✅ **Batch summary** JSON report with metrics and results
- ✅ **Progress tracking** with colored console output

---

## Installation

### Prerequisites

1. **Python 3.11+**
2. **Appwrite Database** (with lesson_templates collection)
3. **Claude API Key** (Anthropic)
4. **DiagramScreenshot Service** (Docker container, required)
5. **MCP Configuration** (.mcp.json for Appwrite access)

### DiagramScreenshot Service Setup

**CRITICAL**: The DiagramScreenshot service must be running before diagram generation.

```bash
# Navigate to diagram service
cd diagram-prototypes

# Start service (port 3001)
docker compose up -d

# Verify service is running
curl http://localhost:3001/health

# Expected response: {"status":"ok"}
```

**Service Details**:
- **URL**: http://localhost:3001
- **Endpoint**: POST /api/v1/render
- **Tech Stack**: Puppeteer + JSXGraph + Express.js
- **Purpose**: Renders JSXGraph JSON to PNG screenshots

### Python Setup

```bash
# 1. Navigate to project directory
cd claud_author_agent

# 2. Create virtual environment
python3 -m venv ../venv
source ../venv/bin/activate  # On Windows: ..\venv\Scripts\activate

# 3. Install dependencies
pip install -e .
pip install claude-agent-sdk requests

# 4. Configure MCP (Appwrite connection)
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your Appwrite credentials

# 5. Set Claude API key
export ANTHROPIC_API_KEY="your-api-key-here"

# 6. Test installation
python -m src.diagram_author_cli --help
```

### MCP Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": [
        "-y",
        "@niladribose/mcp-appwrite-server"
      ],
      "env": {
        "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Note**: Only Appwrite MCP is needed. DiagramScreenshot is accessed via HTTP, not MCP.

---

## Usage

### Single Lesson CLI Options

```bash
python -m src.diagram_author_cli [OPTIONS]

REQUIRED OPTIONS:
  --courseId TEXT        Course identifier (e.g., "course_c84874")
  --order INTEGER        Lesson order in SOW (1-indexed, required)

OPTIONAL OPTIONS:
  --card-order INTEGER   [EXPERIMENTAL] Card position in lesson (1-indexed). When provided,
                         generates diagrams for ONLY this card. Omit to process all cards.

CONFIGURATION:
  --mcp-config PATH      Path to MCP config (default: .mcp.json)
  --no-persist-workspace Delete workspace after execution (default: persist)
  --log-level LEVEL      Logging level: DEBUG|INFO|WARNING|ERROR (default: INFO)

HELP:
  --help                 Show help message
```

### Batch Mode CLI Options

```bash
python -m src.batch_diagram_generator [OPTIONS]

REQUIRED OPTIONS:
  --courseId TEXT        Course identifier (e.g., "course_c84874")

OPTIONAL OPTIONS:
  --order INTEGER        Single lesson order (if provided, delegates to diagram_author_cli)
  --dry-run              Preview execution plan without generating diagrams
  --force                Force regenerate existing diagrams (deletes and recreates)
  --yes                  Skip confirmation prompt (use with caution)

CONFIGURATION:
  --mcp-config PATH      Path to MCP config (default: .mcp.json)
  --log-level LEVEL      Logging level: DEBUG|INFO|WARNING|ERROR (default: INFO)

HELP:
  --help                 Show help message

NOTES:
  - Without --order: Processes ALL lessons in course (batch mode)
  - With --order: Processes single lesson (delegates to diagram_author_cli)
  - Dry-run is recommended before actual execution to preview plan
  - Force flag will delete existing diagrams before regenerating (destructive!)
  - Per-lesson logs saved to logs/batch_runs/{batch_id}/order_{N}.log
  - Batch summary saved to logs/batch_runs/{batch_id}/batch_summary.json
```

### Method 1: Generate Diagrams for ALL Cards in Lesson

```bash
source ../venv/bin/activate
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1
```

### Method 2: Generate Diagrams for SINGLE CARD (EXPERIMENTAL)

**Use Case**: Generate diagrams for a specific card only (useful for iteration/testing)

```bash
source ../venv/bin/activate
# Generate diagrams for card #3 in lesson 1
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --card-order 3
```

**How it works**:
- Filters lesson template to single card BEFORE eligibility analysis
- Card position is 1-indexed (card 1, 2, 3, ...)
- Generates BOTH lesson AND CFU diagrams for that card
- Validates card index is within range

**Example Output**:
```
🎯 SINGLE CARD MODE: Generating diagrams for card #3 in lesson order 1
...
🎯 Single card mode: Filtered 8 → 1 card (card #3, id: card_003)
📊 Eligibility Analysis Complete:
   ✅ Eligible cards: 1
```

### Method 3: Batch Mode (All Lessons with Dry-Run)

```bash
# Step 1: Dry-run to preview execution plan
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --dry-run

# Step 2: Review output, then execute if satisfied
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --yes
```

### Method 4: Batch Mode (Force Regenerate All)

```bash
# Force regenerate all diagrams (deletes existing first)
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --force \
  --yes \
  --log-level DEBUG
```

### Method 5: With Custom Configuration

```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --log-level DEBUG \
  --mcp-config custom.mcp.json
```

### Method 6: Programmatic API (Single Lesson)

```python
import asyncio
from src.diagram_author_claude_client import DiagramAuthorClaudeAgent

async def main():
    # Initialize agent
    agent = DiagramAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    # Full mode: Generate diagrams for ALL cards in lesson
    result = await agent.execute(
        courseId="course_c84874",
        order=1
    )

    # OR: Single card mode - Generate diagrams for ONLY card #3
    # result = await agent.execute(
    #     courseId="course_c84874",
    #     order=1,
    #     card_order=3
    # )

    if result["success"]:
        print(f"✅ Generated {result['diagrams_generated']} diagrams")
        print(f"📊 Cost: ${result['metrics']['total_cost_usd']:.4f}")
        print(f"Document IDs: {result['appwrite_document_ids']}")
    else:
        print(f"❌ Failed: {result['error']}")

    return result

# Run
result = asyncio.run(main())
```

---

## Input/Output Specification

### Input Format

**Minimal Input** (courseId + order):
```json
{
  "courseId": "course_c84874",
  "order": 1
}
```

**What the system auto-fetches**:
1. **Lesson Template** from `default.lesson_templates`:
   - All cards with explainer, cfu, cardType
   - Lesson metadata (title, lesson_type, estMinutes)
   - Outcome references

2. **Eligible Cards** (filtered by Python utility):
   - Cards with mathematical content requiring visualization
   - Geometry, algebra, statistics, function graphs
   - Excludes: plain text definitions, accessibility cards

### Output Format

#### Success Response

```json
{
  "success": true,
  "execution_id": "exec_20251102_143025",
  "workspace_path": "workspace/exec_20251102_143025",
  "diagrams_generated": 3,
  "diagrams_skipped": 5,
  "diagrams_failed": 0,
  "appwrite_document_ids": [
    "diagram_xyz789",
    "diagram_abc456",
    "diagram_def123"
  ],
  "metrics": {
    "total_tokens": 28450,
    "input_tokens": 18200,
    "output_tokens": 10250,
    "total_cost_usd": 0.4268,
    "execution_time_seconds": 222,
    "subagent_metrics": {
      "diagram_generation_subagent": {
        "invocations": 5,
        "total_tokens": 18000
      },
      "visual_critic_subagent": {
        "invocations": 5,
        "total_tokens": 10450
      }
    }
  }
}
```

#### Failure Response

```json
{
  "success": false,
  "execution_id": "exec_20251102_143025",
  "workspace_path": "workspace/exec_20251102_143025",
  "diagrams_generated": 0,
  "diagrams_skipped": 0,
  "diagrams_failed": 3,
  "errors": [
    {
      "cardId": "card_001",
      "error": "Failed to meet quality threshold after 3 iterations",
      "final_score": 0.79
    }
  ],
  "metrics": {
    "total_tokens": 15200,
    "total_cost_usd": 0.2280
  },
  "error": "All diagram generation attempts failed"
}
```

### Generated Diagram Documents (Appwrite)

Each successful diagram creates a document in `default.lesson_diagrams`:

```json
{
  "$id": "diagram_xyz789",
  "lesson_template_id": "lesson_abc123",
  "card_id": "card_001",
  "jsxgraph_json": "{\"board\":{\"boundingbox\":[-5,5,5,-5],\"axis\":true},\"elements\":[{\"type\":\"point\",\"args\":[[0,0]],\"attributes\":{\"name\":\"Origin\",\"fillColor\":\"#0066CC\"}}]}",
  "image_base64": "iVBORw0KGgoAAAANSUhEUgAABLAAAASwCAYAA...",
  "diagram_type": "geometry",
  "visual_critique_score": 0.91,
  "critique_iterations": 2,
  "critique_feedback": [
    {
      "iteration": 1,
      "score": 0.82,
      "feedback": "Increase right angle marker size, adjust label offset",
      "dimension_scores": {
        "clarity": 0.80,
        "accuracy": 0.90,
        "pedagogy": 0.85,
        "aesthetics": 0.75
      }
    },
    {
      "iteration": 2,
      "score": 0.91,
      "feedback": "Excellent improvements, ready for use",
      "dimension_scores": {
        "clarity": 0.90,
        "accuracy": 0.95,
        "pedagogy": 0.85,
        "aesthetics": 0.90
      }
    }
  ],
  "execution_id": "exec_20251102_143025",
  "$createdAt": "2025-11-02T14:30:45.123Z",
  "$updatedAt": "2025-11-02T14:30:45.123Z"
}
```

---

## Card Eligibility Determination

### LLM-Based Semantic Analysis

The system uses **Claude's language understanding** to analyze each card's content and determine if it requires a JSXGraph mathematical diagram. This replaces simple keyword matching with semantic comprehension of the card's educational purpose.

**Analysis Process**:
1. Extract card explainer and CFU (check for understanding) text
2. Submit to Claude with eligibility criteria prompt
3. Receive structured decision: `{lesson_needs_diagram: bool, cfu_needs_diagram: bool, reason: string}`
4. Log exclusion reasons for transparency and debugging

### Eligible Content Examples

**These cards WILL receive JSXGraph diagrams:**

✅ **"Calculate the area of a right triangle with base 5cm and height 12cm"**
   - Reason: Geometric construction with measurements

✅ **"Plot the function f(x) = x² - 4x + 3 on a coordinate grid from x = -2 to x = 6"**
   - Reason: Function graph on coordinate axes

✅ **"Draw a bar chart showing the frequency distribution: 0-10 (freq: 5), 11-20 (freq: 12), 21-30 (freq: 8)"**
   - Reason: Statistical chart with data visualization

✅ **"Sketch a circle with center O(3, 4) and radius 5 units on a coordinate plane"**
   - Reason: Geometric shape on coordinate system

✅ **"Represent the inequality x + 2y ≤ 6 on a number plane"**
   - Reason: Algebraic visualization with graphical solution region

### Excluded Content Examples

**These cards will NOT receive JSXGraph diagrams:**

❌ **"Self-Assessment: Rate your understanding of Pythagoras' Theorem on a scale from 0 (Beginning) to 100 (Secure)"**
   - Reason: Assessment rubric/performance scale - not a mathematical diagram

❌ **"Complete the worksheet: Fill in the missing angle measurements in the triangle diagram provided"**
   - Reason: Worksheet template requiring student input - not a generated diagram

❌ **"Create a concept map linking the properties of different types of quadrilaterals"**
   - Reason: Concept map/mind map - not JSXGraph compatible

❌ **"Show a photograph of a real-world example of a right angle (e.g., corner of a building)"**
   - Reason: Real-world photograph request - not a mathematical construction

❌ **"Define what is meant by 'hypotenuse' in the context of right-angled triangles"**
   - Reason: Text-only definition - no geometric visualization needed

❌ **"List three properties of isosceles triangles"**
   - Reason: Text list - no graphical component required

### Decision Criteria

**INCLUDED** if card requires:
- Geometric shapes with measurements or constructions
- Coordinate graphs showing mathematical relationships
- Statistical charts or data distributions
- Algebraic representations on number lines or graphs

**EXCLUDED** if card contains:
- Assessment rubrics, performance scales, or self-evaluation forms
- Worksheet templates with fill-in blanks
- Concept maps, mind maps, or non-mathematical relationship diagrams
- Requests for real-world photographs or illustrations
- Pure text explanations, definitions, or lists
- Step-by-step procedures without geometric visualization

### Benefits of LLM-Based Approach

**Over keyword matching:**
- ✅ **Contextual understanding**: "Draw a triangle" (diagram) vs "Draw a concept map" (not a diagram)
- ✅ **Semantic precision**: "Calculate area" (needs visualization) vs "List properties" (text only)
- ✅ **Explainability**: Human-readable reasons for exclusion decisions
- ✅ **Maintainability**: Update criteria by changing prompt, not code
- ✅ **Reduced false positives**: Significantly fewer inappropriate diagram attempts

---

## Subagent Prompts

### 1. Main Orchestrator Prompt

**Location**: `src/prompts/diagram_author_prompt.md` (202 lines)

**Purpose**: Coordinate diagram generation workflow for all eligible cards

**Key Sections**:
- **Input Format**: lesson_template.json + eligible_cards.json structure
- **Workflow Phases**: Initialization → Generation Loop → Output Assembly
- **Card Eligibility**: Which cards need diagrams (contextual analysis)
- **Subagent Communication**: `@diagram_generation_subagent`, `@visual_critic_subagent` syntax
- **Quality Threshold**: 0.85 minimum score with 3-iteration refinement
- **Error Handling**: Partial success model (continue on individual card failures)
- **Scottish Context**: Color palette, £ currency, meters for distance

**Workflow Steps**:
1. Read lesson_template.json and eligible_cards.json
2. For each eligible card:
   - Delegate to @diagram_generation_subagent
   - Receive JSXGraph JSON + rendered image
   - Delegate to @visual_critic_subagent
   - Check score ≥ 0.85
   - Refine if needed (max 3 iterations)
   - Accept or fail diagram
3. Write diagrams_output.json with all results

---

### 2. Diagram Generation Subagent Prompt

**Location**: `src/prompts/diagram_generation_subagent.md` (308 lines)

**Purpose**: Generate JSXGraph diagrams and render to PNG using MCP tool

**Key Sections**:

#### Input Format
```json
{
  "cardId": "card_001",
  "title": "Pythagorean Theorem",
  "explainer": "In a right triangle with sides a=3, b=4...",
  "cfu": {"type": "numeric", "stem": "What is c?"},
  "cardType": "teach",
  "iteration": 1,
  "critique_feedback": null
}
```

#### JSXGraph JSON Structure
```json
{
  "board": {
    "boundingbox": [-5, 5, 5, -5],
    "axis": true,
    "showNavigation": false,
    "showCopyright": false,
    "keepAspectRatio": true,
    "defaultAxes": {
      "x": {"ticks": {"strokeColor": "#6c757d"}},
      "y": {"ticks": {"strokeColor": "#6c757d"}}
    }
  },
  "elements": [
    {
      "type": "point",
      "args": [[1, 2]],
      "attributes": {
        "name": "A",
        "size": 3,
        "fillColor": "#0066CC",
        "strokeColor": "#0066CC"
      }
    }
  ]
}
```

#### Scottish Color Palette (MANDATORY)
- **Primary Blue** (`#0066CC`): Main elements, axes, key points
- **Success Green** (`#28a745`): Correct answers, positive highlights
- **Warning Orange** (`#FFA500`): Attention points, intermediate steps
- **Danger Red** (`#DC3545`): Errors, critical points
- **Neutral Gray** (`#6c757d`): Secondary elements, grid lines

#### JSXGraph Element Types
1. **Points**: Labeled vertices, coordinates
2. **Lines/Segments**: Straight lines, rays, segments
3. **Circles**: Center + radius or 3-point definition
4. **Function Graphs**: y = f(x) curves
5. **Polygons**: Triangles, rectangles, general polygons
6. **Text Labels**: Annotations, measurements

#### Rendering Process
1. Generate JSXGraph JSON
2. Call `mcp__diagram-screenshot__render_diagram` tool:
   ```json
   {
     "diagram": {
       "board": {...},
       "elements": [...]
     },
     "options": {
       "width": 1200,
       "height": 800,
       "format": "png",
       "scale": 2,
       "backgroundColor": "#ffffff"
     }
   }
   ```
3. Check result.success === true
4. Extract result.image (base64-encoded PNG)
5. Handle errors with retry (max 3 rendering attempts)

#### Error Recovery
- **VALIDATION_ERROR**: Fix JSON structure
- **MISSING_FIELD**: Add required board/elements
- **RENDER_ERROR**: Simplify diagram
- **TIMEOUT_ERROR**: Reduce complexity
- **SERVICE_UNREACHABLE**: Report fatal error

#### Output Format
```json
{
  "jsxgraph_json": "{\"board\": {...}, \"elements\": [...]}",
  "image_base64": "iVBORw0KGgo...",
  "diagram_type": "geometry",
  "status": "ready_for_critique",
  "render_attempts": 1,
  "render_time_ms": 450
}
```

---

### 3. Visual Critic Subagent Prompt

**Location**: `src/prompts/visual_critic_subagent.md` (295 lines)

**Purpose**: Analyze rendered diagrams using Claude's vision capabilities

**Key Sections**:

#### Input Format
```json
{
  "jsxgraph_json": "{...}",
  "image_base64": "iVBORw0KGgo...",
  "card_content": "Original card explainer + cfu text",
  "iteration": 1,
  "diagram_type": "geometry"
}
```

#### Critique Dimensions (4-Point Scale)

**1. Clarity (Weight: 35%)**
- Appropriate bounding box (not too zoomed in/out)
- No overlapping elements or text labels
- Clear visual hierarchy (main vs secondary elements)
- Proper element sizing (points, lines, labels)

**Scoring Rubric**:
- 0.75-1.00: Crystal clear, intuitive
- 0.50-0.75: Clear main elements, minor noise
- 0.25-0.50: Basic clarity, requires effort
- 0.00-0.25: Confusing, cluttered

---

**2. Accuracy (Weight: 35%)**
- Correct geometric relationships (angles, lengths, ratios)
- Accurate function graphs (shape, intercepts, asymptotes)
- Scottish context (£ for currency, meters for distance)
- Proper mathematical notation (degree symbols, variables)

**Scoring Rubric**:
- 0.75-1.00: Perfectly accurate, precise
- 0.50-0.75: Mathematically correct, minor label issues
- 0.25-0.50: Minor errors or imprecisions
- 0.00-0.25: Major mathematical errors

---

**3. Pedagogy (Weight: 20%)**
- Aligns with card content and lesson type
- Supports learning objectives
- Appropriate complexity for secondary level
- Scottish Curriculum for Excellence alignment

**Scoring Rubric**:
- 0.75-1.00: Excellent pedagogical design, scaffolds understanding
- 0.50-0.75: Supports learning, room for improvement
- 0.25-0.50: Neutral, doesn't actively help
- 0.00-0.25: Misleading or unhelpful

---

**4. Aesthetics (Weight: 10%)**
- Scottish color palette used correctly (#0066CC primary)
- High contrast (WCAG AA: 4.5:1 minimum)
- Dyslexia-friendly spacing
- Professional appearance

**Scoring Rubric**:
- 0.75-1.00: Beautiful, professional, highly accessible
- 0.50-0.75: Pleasant, good color use
- 0.25-0.50: Functional but unattractive
- 0.00-0.25: Ugly, poor color choices

---

#### Scoring Formula
```
final_score = (clarity × 0.35) +
              (accuracy × 0.35) +
              (pedagogy × 0.20) +
              (aesthetics × 0.10)
```

#### Decision Logic
- **score ≥ 0.85**: ACCEPT (high quality)
- **score < 0.85**: REFINE (needs improvement)

**Iteration-Specific Leniency**:
- Iteration 1: Strict (threshold 0.85)
- Iteration 2: Moderate (threshold 0.82)
- Iteration 3: Lenient (threshold 0.80)

If iteration 3 score < 0.80 → **REJECT** diagram (no fallback)

#### Output Format
```json
{
  "decision": "ACCEPT",
  "final_score": 0.91,
  "dimension_scores": {
    "clarity": 0.90,
    "accuracy": 0.95,
    "pedagogy": 0.85,
    "aesthetics": 0.90
  },
  "strengths": [
    "Clear labeling with good offset spacing",
    "Accurate right angle marker",
    "Scottish blue color for triangle",
    "High contrast labels"
  ],
  "improvements": [
    "Increase bounding box padding by 1 unit",
    "Add grid lines for scale",
    "Increase font size to 16px"
  ],
  "specific_changes": [
    "Change boundingbox from [-5,5,5,-5] to [-6,6,6,-6]",
    "Add 'grid': true to board config",
    "Set text fontSize to 16"
  ],
  "critical_issues": [],
  "iteration_notes": "Ready to accept after refinements."
}
```

#### Critical Issues (Automatic REFINE)
If ANY of these present, decision = REFINE regardless of score:
1. Mathematical errors (wrong calculations, incorrect geometry)
2. Missing labels (key points, axes unlabeled)
3. Wrong colors (non-Scottish palette for primary elements)
4. Cultural errors ($ instead of £, feet instead of meters)
5. Illegible text (overlapping labels, font < 12px)

---

## MCP Tool Integration

### DiagramScreenshot Service MCP Tool

**Implementation**: `src/tools/diagram_screenshot_tool.py`

**Tool Name**: `mcp__diagram-screenshot__render_diagram`

**Architecture Pattern**: HTTP service wrapper (not direct MCP server)

### Service Contract

**Endpoint**: `POST http://localhost:3001/api/v1/render`

**Request Format**:
```json
{
  "diagram": {
    "board": {
      "boundingbox": [-5, 5, 5, -5],
      "axis": true
    },
    "elements": [...]
  },
  "options": {
    "width": 1200,
    "height": 800,
    "format": "png",
    "scale": 2,
    "backgroundColor": "#ffffff"
  }
}
```

**Success Response**:
```json
{
  "success": true,
  "image": "iVBORw0KGgoAAAANSUhEUgAABLAAAASwCAYAA...",
  "metadata": {
    "format": "png",
    "width": 1200,
    "height": 800,
    "sizeBytes": 45678,
    "renderTimeMs": 450,
    "elementCount": 4,
    "timestamp": "2025-11-02T14:30:25.789Z"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Diagram missing required field 'board'",
    "details": {...},
    "suggestion": "Add 'board' field with boundingbox configuration"
  }
}
```

### Tool Implementation Details

#### MCP Tool Registration

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool(
    "render_diagram",
    "Render JSXGraph diagram JSON to PNG image using DiagramScreenshot service",
    {
        "diagram": dict,
        "options": dict  # Optional
    }
)
async def render_diagram(args):
    diagram = args.get("diagram")
    options = args.get("options", {})

    # Validate diagram structure
    if not diagram or "board" not in diagram or "elements" not in diagram:
        return error_response("MISSING_FIELD", "...")

    # Merge with defaults
    render_options = {
        "width": 1200,
        "height": 800,
        "format": "png",
        "scale": 2,
        "backgroundColor": "#ffffff",
        **options
    }

    # HTTP POST to service
    response = requests.post(
        f"{DIAGRAM_SCREENSHOT_URL}/api/v1/render",
        json={"diagram": diagram, "options": render_options},
        timeout=30,
        headers={"X-API-Key": DIAGRAM_SCREENSHOT_API_KEY}
    )

    # Return MCP tool response format
    return {
        "content": [{
            "type": "text",
            "text": json.dumps(response.json(), indent=2)
        }]
    }

# Create MCP server
diagram_screenshot_server = create_sdk_mcp_server(
    name="diagram-screenshot",
    version="1.0.0",
    tools=[render_diagram]
)
```

#### Agent Configuration

```python
# In DiagramAuthorClaudeAgent.__init__()
mcp_servers_for_diagram_author = {
    "diagram-screenshot": diagram_screenshot_server
    # Appwrite MCP EXCLUDED - data pre-fetched by Python
}

options = ClaudeAgentOptions(
    model='claude-sonnet-4-5',
    agents=self._get_subagent_definitions(),
    permission_mode='bypassPermissions',
    mcp_servers=mcp_servers_for_diagram_author,
    allowed_tools=[
        'Read', 'Write', 'Edit', 'Glob', 'Grep',
        'TodoWrite', 'Task',
        'WebSearch', 'WebFetch',
        'mcp__diagram-screenshot__render_diagram'  # ← MCP tool
    ],
    max_turns=50,
    cwd=str(workspace_path)
)
```

### Error Handling

**Fast-Fail Principle**: No fallback mechanisms, detailed error logging

**Error Codes**:
- `MISSING_FIELD`: Required diagram fields missing
- `VALIDATION_ERROR`: Invalid diagram structure
- `TIMEOUT_ERROR`: Service timeout (30s)
- `SERVICE_UNREACHABLE`: HTTP connection failed
- `RENDER_ERROR`: Browser rendering failed
- `INTERNAL_ERROR`: Unexpected tool error

**Example Error Recovery**:
```python
# In diagram_generation_subagent logic
attempt = 1
while attempt <= 3:
    result = call_render_diagram(diagram_json)

    if result.success:
        return result.image_base64

    # Analyze error code
    if result.error.code == "VALIDATION_ERROR":
        # Fix structure and retry
        diagram_json = fix_structure(diagram_json)
        attempt += 1
    elif result.error.code == "TIMEOUT_ERROR":
        # Simplify diagram and retry
        diagram_json = simplify_elements(diagram_json)
        attempt += 1
    else:
        # Fatal error, cannot recover
        raise Exception(f"Render failed: {result.error.message}")

# After 3 attempts
raise Exception("Failed to render after 3 attempts")
```

---

## Scottish Context Requirements

### Mandatory Color Palette

All diagrams MUST use the Scottish AI Lessons brand colors:

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Primary Blue | `#0066CC` | Main elements, axes, key points, primary shapes |
| Success Green | `#28a745` | Correct answers, positive highlights, checkmarks |
| Warning Orange | `#FFA500` | Attention points, warnings, intermediate steps |
| Danger Red | `#DC3545` | Errors, critical points, problem areas |
| Neutral Gray | `#6c757d` | Secondary elements, grid lines, labels, ticks |

**Enforcement**: Visual critic penalizes diagrams using non-palette colors

### Cultural Requirements

**1. Currency**:
- ✅ **CORRECT**: £, GBP, pounds
- ❌ **WRONG**: $, USD, dollars, €, EUR

**2. Measurements**:
- ✅ **CORRECT**: meters, kilometers, centimeters
- ❌ **WRONG**: feet, yards, miles (unless explicitly showing conversion)

**3. Scottish References**:
- ✅ **CORRECT**: ScotRail, Edinburgh, Glasgow, NHS Scotland
- ❌ **WRONG**: Walmart, ZIP codes, US state references

**4. CfE Terminology**:
- ✅ **CORRECT**: Outcomes, benchmarks, National 5
- ❌ **WRONG**: Standards, objectives, Grade 10

### Accessibility Requirements

**1. WCAG AA Compliance**:
- Minimum contrast ratio: 4.5:1 for text
- Primary blue (#0066CC) on white: 7.5:1 (passes)
- Red (#DC3545) on white: 5.3:1 (passes)

**2. Dyslexia-Friendly Design**:
- Font size ≥ 14px (16px recommended)
- Label offset ≥ 5px to avoid overlap
- Adequate spacing between elements

**3. Visual Clarity**:
- No overlapping text labels
- Clear visual hierarchy (main vs secondary)
- Appropriate bounding box (10% padding)

---

## Token Optimization

### Pre-Processing Savings (Python, 0 tokens)

1. **Lesson Template Fetching**: ~5-8K tokens saved
   - Direct Appwrite API query vs LLM-based retrieval
   - JSON parsing and extraction in Python

2. **Card Filtering**: ~2-3K tokens saved
   - Simple heuristic (cardType + content keywords)
   - No LLM needed for eligibility determination

3. **Health Check**: ~1K tokens saved
   - HTTP GET to service health endpoint
   - Fast-fail before agent execution

**Total Pre-Processing Savings**: ~8-12K tokens

### Post-Processing Savings (Python, 0 tokens)

1. **diagrams_output.json Parsing**: ~2-3K tokens saved
   - JSON file reading and validation
   - Extract diagrams + errors arrays

2. **Batch Upsert to Appwrite**: ~5-8K tokens saved
   - Direct Appwrite API calls
   - Query by (lesson_template_id, card_id)
   - Create or update logic in Python

**Total Post-Processing Savings**: ~7-11K tokens

### MCP Tool Context Optimization

**Appwrite MCP Excluded** from agent context:
- ~50+ Appwrite tools NOT loaded in prompt
- Saves ~15-20K tokens per execution
- Only diagram-screenshot tool registered

**Total MCP Savings**: ~15-20K tokens

### Overall Token Optimization

**Total Savings**: ~30-43K tokens per execution vs full LLM pipeline

### Expected Token Usage

**Typical Execution** (3 diagrams, 2 refinements):
- Pre-processing: 0 tokens (Python)
- Diagram generation (3 cards): 12-18K tokens
- Visual critique (5 iterations): 8-12K tokens
- Refinement iterations (2 cards): 4-6K tokens
- Post-processing: 0 tokens (Python)

**Total**: 24-36K tokens

**Cost Estimate** (Claude Sonnet 4.5 @ $3 input / $15 output):
- Input: ~$0.07-0.10
- Output: ~$0.25-0.35
- **Total**: ~$0.32-0.45 per lesson (3 diagrams)

**Per Diagram Cost**: ~$0.11-0.15

---

## Quality Assurance

### Built-in Validation

**1. Pre-Execution Validation**:
- ✅ courseId exists in `default.courses`
- ✅ Lesson template exists with matching order
- ✅ DiagramScreenshot service health check passes
- ✅ MCP configuration valid

**2. During Execution**:
- ✅ JSXGraph JSON structure validation
- ✅ Rendering error detection with retry
- ✅ 4-dimensional quality scoring (clarity, accuracy, pedagogy, aesthetics)
- ✅ Iterative refinement (up to 3 attempts)
- ✅ Scottish color palette enforcement
- ✅ Cultural requirement validation (£, meters)

**3. Post-Execution Validation**:
- ✅ diagrams_output.json schema check
- ✅ Base64 image format validation
- ✅ Appwrite document creation confirmation
- ✅ Workspace preservation for debugging

### Quality Thresholds

**Overall Score Threshold**:
- Iteration 1: ≥ 0.85 (strict)
- Iteration 2: ≥ 0.82 (moderate)
- Iteration 3: ≥ 0.80 (lenient)

**Dimension Thresholds**:
- Clarity: ≥ 0.75
- Accuracy: ≥ 0.75
- Pedagogy: ≥ 0.75
- Aesthetics: ≥ 0.75

**Failure Conditions**:
- Score < 0.80 after iteration 3 → REJECT
- Any critical issue detected → REJECT
- Mathematical error → REJECT
- Cultural requirement violated → REJECT

### Testing Strategy

**Manual Testing**:
```bash
# Test single lesson
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --log-level DEBUG

# Inspect workspace
cd workspace/exec_TIMESTAMP
cat diagrams_output.json | jq '.diagrams | length'
cat diagrams_output.json | jq '.diagrams[0].visual_critique_score'
```

**Automated Testing**:
- DiagramScreenshot service health check
- MCP tool mock testing
- Upsert logic validation
- Compression integrity checks

---

## Troubleshooting

### Error: "DiagramScreenshot service is not available"

**Cause**: Docker container not running or port 3001 blocked

**Solution**:
```bash
# Check if service is running
docker ps | grep diagram-screenshot

# If not running, start service
cd diagram-prototypes
docker compose up -d

# Test service manually
curl http://localhost:3001/health

# Check logs
docker compose logs diagram-screenshot

# Restart service if needed
docker compose restart diagram-screenshot
```

---

### Error: "Lesson template not found"

**Cause**: Invalid courseId or order, or lesson not in database

**Solution**:
```bash
# Verify courseId exists
# Check Appwrite Console → default.courses

# Verify lesson template exists with matching order
# Check Appwrite Console → default.lesson_templates
# Query: courseId = "course_c84874" AND sow_order = 1

# Check order value (must be 1-indexed, starting from 1)
# If SOW has 10 entries, valid orders are 1-10
```

---

### Error: "No cards need diagrams"

**Cause**: All cards filtered out by LLM-based eligibility analysis

**Solution**:
```bash
# Check workspace for eligible_cards.json and eligibility decisions
cd workspace/exec_TIMESTAMP
cat eligible_cards.json

# If empty, review why cards were excluded
# The system logs exclusion reasons during pre-processing

# Check execution logs for exclusion breakdown:
# Example output:
#   📊 Eligibility Analysis Complete:
#      ✅ Eligible cards: 0
#      ❌ Excluded cards: 8
#
#   📋 Exclusion Breakdown:
#      - Assessment rubric/performance scale: 2 cards
#      - Text-only definition without visualization: 3 cards
#      - Worksheet template: 1 card
#      - Concept map request: 2 cards

# If all cards are legitimately excluded:
# - This is expected behavior for lessons with no visual content
# - The lesson may focus on definitions, procedures, or assessments

# If cards SHOULD have been included but weren't:
# 1. Review the card content - does it truly need a mathematical diagram?
# 2. Check for JSXGraph compatibility:
#    ✅ Geometric constructions (triangles, circles, coordinates)
#    ✅ Algebra graphs (functions, equations)
#    ✅ Statistics charts (bar charts, histograms)
#    ❌ Assessment rubrics and performance scales
#    ❌ Worksheets and fill-in templates
#    ❌ Concept maps and mind maps
#    ❌ Real-world photographs
# 3. If the LLM incorrectly excluded a mathematical diagram:
#    - Report as a bug with the specific card content
#    - This indicates a need to refine eligibility criteria in the prompt
```

---

### Error: "Diagram validation failed after 3 iterations"

**Cause**: Cannot meet quality threshold despite refinements

**Solution**:
```bash
# 1. Check workspace for detailed critique
cd workspace/exec_TIMESTAMP
cat diagrams_output.json | jq '.errors'

# 2. Common issues:
#    - Mathematical errors (wrong angles, lengths)
#    - Scottish context violations ($ instead of £)
#    - Poor color choices (not using #0066CC)
#    - Overlapping labels
#    - Bounding box too tight

# 3. Review critique feedback
cat diagrams_output.json | jq '.errors[0].critique_feedback'

# 4. Manual fix workflow:
#    - Extract JSXGraph JSON from error
#    - Test render manually: POST to localhost:3001/api/v1/render
#    - Adjust diagram based on critique
#    - Retry generation
```

---

### Error: "TIMEOUT_ERROR: Service timeout after 30s"

**Cause**: Diagram too complex or service overloaded

**Solution**:
```bash
# 1. Check diagram complexity
cd workspace/exec_TIMESTAMP
cat diagrams_output.json | jq '.errors[0].jsxgraph_json' | jq '.elements | length'

# If element count > 50, diagram is too complex

# 2. Simplify diagram approach:
#    - Reduce element count
#    - Use simpler function graphs (fewer sample points)
#    - Remove decorative elements
#    - Increase bounding box to reduce rendering area

# 3. Check service health
docker compose logs diagram-screenshot | tail -20

# 4. Restart service if needed
cd diagram-prototypes
docker compose restart diagram-screenshot
```

---

### High Token Usage

**Symptom**: Execution costs > $1.00 per lesson

**Possible Causes**:
- Many diagrams (>5 cards needing visuals)
- Multiple refinement iterations (>2 per diagram)
- Complex lesson type (mock exam with detailed graphs)

**Optimization**:
```bash
# 1. Enable DEBUG logging to see iteration counts
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --log-level DEBUG

# 2. Review metrics
# Check "critique_iterations" in diagrams_output.json
cat workspace/exec_TIMESTAMP/diagrams_output.json | \
  jq '.diagrams[].critique_iterations'

# 3. If many iterations:
#    - Review lesson content quality
#    - Check for systematic prompt issues
#    - Verify Scottish context in lesson cards
```

---

### Appwrite Upsert Failures

**Error**: "Failed to create document in lesson_diagrams"

**Solution**:
```bash
# 1. Check Appwrite API key permissions
# Must have write access to default.lesson_diagrams

# 2. Verify collection schema matches document structure
# Required fields:
#   - lesson_template_id (string)
#   - card_id (string)
#   - jsxgraph_json (string, large text)
#   - image_base64 (string, large text)
#   - diagram_type (string)
#   - visual_critique_score (float)
#   - critique_iterations (integer)
#   - critique_feedback (json)
#   - execution_id (string)

# 3. Check field size limits
# Base64 images can be large (100-500KB)
# Ensure Appwrite field size allows large text

# 4. Test manual upsert
# Use Appwrite Console to create test document
```

---

## API Reference

### DiagramAuthorClaudeAgent

**Class**: `src.diagram_author_claude_client.DiagramAuthorClaudeAgent`

#### Constructor

```python
DiagramAuthorClaudeAgent(
    mcp_config_path: str = ".mcp.json",
    persist_workspace: bool = True,
    log_level: str = "INFO"
)
```

**Parameters**:
- `mcp_config_path` (str): Path to MCP configuration file
- `persist_workspace` (bool): If True, preserve workspace for debugging
- `log_level` (str): Logging level (DEBUG, INFO, WARNING, ERROR)

**Returns**: DiagramAuthorClaudeAgent instance

---

#### execute()

```python
async execute(
    courseId: str,
    order: int,
    card_order: Optional[int] = None
) -> Dict[str, Any]
```

**Parameters**:
- `courseId` (str, required): Course identifier (must exist in default.courses)
- `order` (int, required): Lesson order number in SOW (1-indexed, ≥ 1)
- `card_order` (Optional[int]): Card position in lesson (1-indexed, ≥ 1). When provided, generates diagrams for ONLY this card. When omitted, generates diagrams for ALL cards.

**Note**: `order` is always required. `card_order` is an optional modifier to filter to a single card.

**Returns**: Dictionary with execution results

**Success Response**:
```python
{
    "success": True,
    "execution_id": "exec_20251102_143025",
    "workspace_path": "workspace/exec_20251102_143025",
    "diagrams_generated": 3,
    "diagrams_skipped": 5,
    "diagrams_failed": 0,
    "appwrite_document_ids": ["diagram_xyz", "diagram_abc"],
    "metrics": {
        "total_tokens": 28450,
        "total_cost_usd": 0.4268,
        "execution_time_seconds": 222
    }
}
```

**Failure Response**:
```python
{
    "success": False,
    "execution_id": "exec_20251102_143025",
    "error": "All diagram generation attempts failed",
    "diagrams_failed": 3,
    "errors": [...]
}
```

---

### CLI Functions

**Module**: `src.diagram_author_cli`

#### validate_cli_args()

```python
def validate_cli_args(args: argparse.Namespace) -> None
```

**Purpose**: Validate command-line arguments

**Raises**:
- `ValueError`: If courseId or order invalid

---

#### print_success_banner()

```python
def print_success_banner(result: Dict[str, Any]) -> None
```

**Purpose**: Print colored success banner with metrics

---

#### print_failure_banner()

```python
def print_failure_banner(
    error: str,
    execution_id: Optional[str] = None
) -> None
```

**Purpose**: Print colored failure banner with troubleshooting tips

---

### MCP Tool Functions

**Module**: `src.tools.diagram_screenshot_tool`

#### check_diagram_service_health()

```python
def check_diagram_service_health() -> Dict[str, Any]
```

**Returns**:
```python
{
    "available": True,
    "url": "http://localhost:3001",
    "status_code": 200
}
```

**Purpose**: Pre-flight check for DiagramScreenshot service availability

---

#### render_diagram()

```python
@tool("render_diagram", "...", {"diagram": dict, "options": dict})
async def render_diagram(args) -> Dict[str, Any]
```

**Tool Call** (from LLM):
```json
{
  "diagram": {
    "board": {...},
    "elements": [...]
  },
  "options": {
    "width": 1200,
    "height": 800
  }
}
```

**Returns** (MCP tool response):
```python
{
    "content": [{
        "type": "text",
        "text": json.dumps({
            "success": true,
            "image": "base64...",
            "metadata": {...}
        })
    }]
}
```

---

## Examples

### Example 1: Basic CLI Usage

```bash
cd claud_author_agent
source ../venv/bin/activate

# Start DiagramScreenshot service
cd ../diagram-prototypes
docker compose up -d
cd ../claud_author_agent

# Generate diagrams
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1

# Output:
# ================================================
# 🎉 DIAGRAM GENERATION SUCCESSFUL
# ================================================
#
# Execution Summary:
#   Execution ID:        exec_20251102_143025
#   Workspace Path:      workspace/exec_20251102_143025
#   Diagrams Generated:  3
#   Diagrams Skipped:    5
#   Diagrams Failed:     0
#
# Appwrite Document IDs:
#   - diagram_xyz789
#   - diagram_abc456
#   - diagram_def123
#
# Execution Metrics:
#   Total Tokens:        28,450
#   Total Cost (USD):    $0.4268
#   Execution Time:      3m 42s
```

---

### Example 2: Single Card Mode (Experimental Feature)

```bash
cd claud_author_agent
source ../venv/bin/activate

# Start DiagramScreenshot service
cd ../diagram-prototypes
docker compose up -d
cd ../claud_author_agent

# Generate diagrams for ONLY card #3 in lesson 1
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 1 \
  --card-order 3

# Output shows single card filtering:
# 🎯 SINGLE CARD MODE: Generating diagrams for card #3 in lesson order 1
# ...
# 🎯 Single card mode: Filtered 8 → 1 card (card #3, id: card_abc456)
# ================================================
# 🎉 DIAGRAM GENERATION SUCCESSFUL
# ================================================
#
# Execution Summary:
#   Execution ID:        exec_20251121_094530
#   Workspace Path:      workspace/exec_20251121_094530
#   Diagrams Generated:  2 (lesson + CFU diagrams for card #3)
#   Diagrams Skipped:    0
#   Diagrams Failed:     0
#
# Appwrite Document IDs:
#   - diagram_lesson_abc456 (diagram_context="lesson")
#   - diagram_cfu_abc456 (diagram_context="cfu")
```

**Use Cases**:
- Iterate on diagrams for a single card during development
- Regenerate diagrams for a specific card after content changes
- Test diagram generation for specific cards without processing entire lesson
- Debug diagram generation issues on specific cards

**How it works**:
- Filters lesson template to single card BEFORE eligibility analysis
- Card position is 1-indexed (card 1, 2, 3, matching --order convention)
- Generates BOTH lesson AND CFU diagrams for selected card
- Validates card index is within lesson's card array bounds
- Independent operation - doesn't check for existing diagrams

**Database Behavior**:
- Two diagrams stored for the selected card
- One with `diagram_context: "lesson"`
- One with `diagram_context: "cfu"`
- Unique constraint: `(lessonTemplateId, cardId, diagram_context)`
- Upsert semantics: updates existing diagrams or creates new ones

---

### Example 3: Programmatic Usage with Error Handling

```python
import asyncio
from src.diagram_author_claude_client import DiagramAuthorClaudeAgent

async def generate_diagrams_with_retry():
    """Generate diagrams with automatic retry on failure."""

    agent = DiagramAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        print(f"\n{'='*60}")
        print(f"Attempt {attempt}/{max_retries}")
        print(f"{'='*60}\n")

        result = await agent.execute(
            courseId="course_c84874",
            order=1
        )

        if result["success"]:
            print(f"✅ Success on attempt {attempt}!")
            print(f"Generated: {result['diagrams_generated']} diagrams")
            print(f"Cost: ${result['metrics']['total_cost_usd']:.4f}")
            print(f"Document IDs:")
            for doc_id in result["appwrite_document_ids"]:
                print(f"  - {doc_id}")
            return result

        else:
            print(f"❌ Attempt {attempt} failed: {result['error']}")
            if attempt < max_retries:
                print(f"Retrying in 5 seconds...")
                await asyncio.sleep(5)
            else:
                print(f"Failed after {max_retries} attempts")
                return result

    return None

# Run with retry logic
result = asyncio.run(generate_diagrams_with_retry())
```

---

### Example 4: Batch Mode CLI with Dry-Run

```bash
# Step 1: Dry-run to preview execution plan
cd claud_author_agent
source ../venv/bin/activate

python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --dry-run

# Output shows:
# - Total lessons in course
# - Validation status for each lesson
# - Existing diagrams found
# - Execution plan (Generate/Skip/Overwrite)
# - Time and cost estimates

# Step 2: Review output and proceed if satisfied
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --yes

# Step 3: Check batch summary
cat logs/batch_runs/batch_diagram_YYYYMMDD_HHMMSS/batch_summary.json | jq '.'

# Step 4: Check individual lesson logs
cat logs/batch_runs/batch_diagram_YYYYMMDD_HHMMSS/order_1.log
cat logs/batch_runs/batch_diagram_YYYYMMDD_HHMMSS/order_2.log
```

---

### Example 5: Batch Mode with Force Regenerate

```bash
# Force regenerate all diagrams (deletes existing first)
# Useful for:
# - Updating diagrams after prompt changes
# - Fixing systematic errors across all lessons
# - Testing new diagram generation logic

python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --force \
  --yes \
  --log-level DEBUG

# WARNING: This will DELETE all existing diagrams before regenerating!
# Always dry-run first to understand the impact:
python -m src.batch_diagram_generator \
  --courseId course_c84874 \
  --force \
  --dry-run
```

---

### Example 6: Manual Batch Processing (Programmatic)

**Note**: The batch_diagram_generator CLI is recommended over manual looping. This example is for reference only.

```python
import asyncio
from pathlib import Path
from src.diagram_author_claude_client import DiagramAuthorClaudeAgent

async def batch_generate_diagrams():
    """Generate diagrams for all lessons in a course (manual approach)."""

    courseId = "course_c84874"
    lesson_orders = range(1, 11)  # Lessons 1-10

    agent = DiagramAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    results = []
    total_cost = 0.0
    total_diagrams = 0

    for order in lesson_orders:
        print(f"\n{'='*60}")
        print(f"Processing Lesson {order}/10")
        print(f"{'='*60}\n")

        result = await agent.execute(
            courseId=courseId,
            order=order
        )

        results.append({
            "order": order,
            "success": result["success"],
            "diagrams_generated": result.get("diagrams_generated", 0),
            "cost_usd": result["metrics"]["total_cost_usd"]
        })

        if result["success"]:
            total_cost += result["metrics"]["total_cost_usd"]
            total_diagrams += result["diagrams_generated"]
            print(f"✅ Lesson {order}: {result['diagrams_generated']} diagrams")
        else:
            print(f"❌ Lesson {order}: {result['error']}")

    # Summary
    print(f"\n{'='*60}")
    print(f"Batch Summary:")
    print(f"  Total Lessons: {len(lesson_orders)}")
    print(f"  Successful: {sum(1 for r in results if r['success'])}")
    print(f"  Failed: {sum(1 for r in results if not r['success'])}")
    print(f"  Total Diagrams: {total_diagrams}")
    print(f"  Total Cost: ${total_cost:.4f}")
    print(f"{'='*60}\n")

    return results

# Run batch generation
results = asyncio.run(batch_generate_diagrams())
```

**Recommendation**: Use the batch_diagram_generator CLI instead of manual looping for:
- Automatic SOW fetching (no need to hardcode lesson orders)
- Pre-validation with fast-fail
- Skip existing diagrams (avoids wasted regeneration)
- Dry-run preview with estimates
- Per-lesson logging
- Batch summary reports

---

### Example 7: Custom Workspace Inspection

```bash
# After successful generation
cd workspace/exec_20251102_143025

# List all files
ls -la

# View lesson template (input)
cat lesson_template.json | jq '.title, .cards | length'

# View eligible cards (filtered)
cat eligible_cards.json | jq 'length'

# View generated diagrams (output)
cat diagrams_output.json | jq '.diagrams | length'

# Check diagram quality scores
cat diagrams_output.json | jq '.diagrams[].visual_critique_score'

# View specific diagram critique
cat diagrams_output.json | jq '.diagrams[0].critique_feedback'

# Extract JSXGraph JSON for a diagram
cat diagrams_output.json | jq -r '.diagrams[0].jsxgraph_json'

# Check for errors
cat diagrams_output.json | jq '.errors'
```

---

## Support

For issues, questions, or feature requests:
- **GitHub Issues**: https://github.com/schoolofai/ScottishAILessons/issues
- **Documentation**: `claud_author_agent/docs/`
- **Workspace Inspection**: `workspace/exec_TIMESTAMP/`
- **Logs**: Enable `--log-level DEBUG` for detailed traces

---

**Version**: 1.0 (November 2025)
**Status**: Production Ready
**Author**: Claude Code (Anthropic)
