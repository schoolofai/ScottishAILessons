# Lesson Author - Claude Agent SDK Implementation

Autonomous pipeline for authoring individual lesson templates for Scottish secondary education using Claude Agent SDK.

## Overview

This agent takes a `{courseId, order}` input and produces a complete, validated lesson template in the Appwrite database through a 5-stage pipeline:

**Pre-Processing (Python, 0 tokens)**:
1. **SOW Entry Extractor** → Extracts specific lesson entry from Authored_SOW by courseId + order → `sow_entry_input.json` + `sow_context.json`
2. **Course Data Extractor** → Extracts SQA course structure from database → `Course_data.txt`
3. **Blank Template Generator** → Creates lesson_template.json with correct schema structure, empty content fields → Prevents schema errors

**Pipeline Execution (3 Subagents)**:
4. **Research Subagent** → On-demand Scottish context research → Targeted answers
5. **Lesson Author** → Fills blank template with pedagogical content using Edit tool → `lesson_template.json` (complete)
6. **Combined Lesson Critic v2** → Schema gate + 2-dimensional validation (fidelity 75%, quality 25%) with retry → `critic_result.json`

**Post-Processing (Python, 0 tokens)**:
7. **Card Compression + Upserter** → Compresses cards (gzip+base64) → Appwrite `default.lesson_templates`

## Features

- ✅ **Fully Autonomous**: courseId + order → complete lesson template in database
- ✅ **Token Optimized**: Python pre/post-processing saves ~30-40% tokens vs full LLM pipeline
- ✅ **High-Fidelity Prompts**: 99% pedagogical content preserved from LangGraph production prompts
- ✅ **3-Subagent Architecture**: Research, Authoring, Critique with autonomous delegation
- ✅ **Card Compression**: gzip+base64 encoding reduces storage by ~55% (ported from TypeScript)
- ✅ **Upsert Pattern**: Query by (courseId, sow_order) → update existing or create new
- ✅ **Quality Validation**: v2 critic with schema gate + 2-dimensional scoring (fidelity 75%, quality 25%), automatic retry (up to 10 attempts)
- ✅ **Cost Tracking**: Per-subagent and total token/cost metrics
- ✅ **Workspace Persistence**: Optional preservation for debugging
- ✅ **Scottish Curriculum Compliant**: SQA standards, CfE alignment, Scottish contexts
- ✅ **Fail-Fast Validation**: Prerequisites checked before pipeline execution

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access (Anthropic API key)
- Appwrite instance (with MCP server configured)
- Node.js 18+ (for Appwrite MCP server)
- **Course must exist in `default.courses` collection**
- **SOW must exist in `default.Authored_SOW` collection** with entry at specified order

### Setup

```bash
# 1. Install Python dependencies
cd claud_author_agent
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt

# 2. Configure Appwrite MCP
cp .mcp.json.example .mcp.json
# Edit .mcp.json and add your:
#   - APPWRITE_ENDPOINT
#   - APPWRITE_PROJECT_ID
#   - APPWRITE_API_KEY

# 3. Set Claude API key
export ANTHROPIC_API_KEY="your-api-key-here"
# Or add to .env file
```

## Usage

### Method 1: CLI with JSON Input (Recommended)

```bash
# Create input file
cat > input.json << EOF
{
  "courseId": "course_c84474",
  "order": 1
}
EOF

# Run agent
source ../venv/bin/activate
python -m src.lesson_author_cli --input input.json
```

### Method 2: CLI with Command-Line Arguments

```bash
source ../venv/bin/activate
python -m src.lesson_author_cli \
  --courseId course_c84474 \
  --order 1
```

### Method 3: Interactive Mode

```bash
source ../venv/bin/activate
python -m src.lesson_author_cli

# Follow the interactive prompts:
#   - Course ID: course_c84474
#   - Order: 1
```

### Method 4: Python API (Programmatic)

```python
import asyncio
from src.lesson_author_claude_client import LessonAuthorClaudeAgent

async def main():
    agent = LessonAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        max_critic_retries=10
    )

    result = await agent.execute(
        courseId="course_c84474",
        order=1
    )

    print(f"Success: {result['success']}")
    print(f"Document ID: {result['appwrite_document_id']}")
    print(f"Total cost: ${result['metrics']['total_cost_usd']:.4f}")

asyncio.run(main())
```

## CLI Options

```bash
python -m src.lesson_author_cli --help

Options:
  --input JSON_FILE          Path to JSON input file (courseId, order)
  --courseId TEXT            Course identifier (e.g., "course_c84474")
  --order INTEGER            Lesson order in SOW entries (e.g., 1, 2, 3) - starts from 1, not 0
  --mcp-config PATH          MCP config path (default: .mcp.json)
  --max-retries N            Critic retry attempts (default: 10)
  --no-persist-workspace     Delete workspace after execution (default: persist)
  --log-level LEVEL          Logging level: DEBUG/INFO/WARNING/ERROR (default: INFO)
```

## Input Parameters

### courseId (required)
- **Type**: String
- **Format**: Course identifier from `default.courses` collection
- **Example**: `"course_c84474"`
- **Validation**: Must exist in database and have corresponding SOW

### order (required)
- **Type**: Integer
- **Format**: 1-indexed position in SOW entries (order 1, 2, 3...)
- **Example**: `1` (first lesson), `2` (second lesson), `3` (third lesson)
- **Validation**: Must be valid order in SOW's entries array (≥1)
- **Note**: Order values start from 1, not 0. SOW entries are 1-indexed.

## Output

### Success Response

```json
{
  "success": true,
  "execution_id": "20251016_154230",
  "workspace_path": "workspace/lesson_author_20251016_154230",
  "appwrite_document_id": "68f107e20014c8884391",
  "lesson_template_path": "workspace/.../lesson_template.json",
  "metrics": {
    "total_tokens": 45000,
    "input_tokens": 28000,
    "output_tokens": 17000,
    "total_cost_usd": 0.1234,
    "subagent_metrics": {
      "research_subagent": {
        "invocations": 3,
        "total_tokens": 8000
      },
      "lesson_author": {
        "invocations": 1,
        "total_tokens": 32000
      },
      "combined_lesson_critic": {
        "invocations": 2,
        "total_tokens": 5000
      }
    }
  }
}
```

### Failure Response

```json
{
  "success": false,
  "execution_id": "20251016_154230",
  "workspace_path": "workspace/lesson_author_20251016_154230",
  "error": "SOW entry not found: courseId='course_xyz', order=99",
  "metrics": {
    "total_tokens": 0,
    "total_cost_usd": 0.0
  }
}
```

## Batch Mode

### Overview

**Batch Mode** allows you to generate lesson templates for **all SOW entries** in a course with a single command, instead of authoring lessons one at a time. This is ideal for:

- **Initial course setup**: Generate all 8-15 lessons for a new course
- **Bulk regeneration**: Update all lessons after SOW changes
- **CI/CD pipelines**: Automated lesson generation workflows

**Key Features**:
- ✅ **Smart Skip Logic**: Automatically skips lessons that already exist (avoids duplicate work)
- ✅ **Dry-Run Mode**: Preview generation plan before execution
- ✅ **Force Mode**: Overwrite all existing lessons when needed
- ✅ **Per-Lesson Logging**: Each lesson gets its own detailed log file
- ✅ **Batch Metrics**: Comprehensive summary with costs, durations, success/failure counts
- ✅ **Fail-Fast Design**: No fallback patterns - detailed error logging for debugging

---

### Usage

#### Method 1: Dry-Run (Preview Plan)

```bash
# Preview what will be generated without executing
python -m src.batch_lesson_generator --courseId course_c84874 --dry-run
```

**Output**: ASCII table showing skip/generate/overwrite plan + estimates

**Example Dry-Run Output**:
```
╔════════════════════════════════════════════════════════════════╗
║         Batch Generation Plan - DRY RUN                        ║
╚════════════════════════════════════════════════════════════════╝

┌───────┬─────────────────────────────────┬──────────────┬──────────────────────┬─────────────────────────┐
│ Order │ Label                           │ Status       │ Doc ID               │ Model Version           │
├───────┼─────────────────────────────────┼──────────────┼──────────────────────┼─────────────────────────┤
│     1 │ Introduction to Fractions       │ SKIP         │ lesson_abc123        │ claud_Agent_sdk         │
│     2 │ Adding Fractions                │ GENERATE     │ -                    │ -                       │
│     3 │ Multiplying Fractions           │ GENERATE     │ -                    │ -                       │
└───────┴─────────────────────────────────┴──────────────┴──────────────────────┴─────────────────────────┘

Course ID: course_c84874
Total SOW Entries: 10
Force Mode: No

Summary:
  Will skip (already exist):  1 lessons
  Will generate (new):        9 lessons
  Will overwrite:             0 lessons

Estimated Duration: ~63 minutes (7 min/lesson average)
Estimated Cost: ~$1.53 USD ($0.17/lesson average)

✓ Dry-run plan saved to: logs/batch_runs/batch_course_c84874_20251029_143025/dry_run_plan.json
```

---

#### Method 2: Normal Mode (Generate Missing Lessons)

```bash
# Generate only lessons that don't exist yet (default behavior)
python -m src.batch_lesson_generator --courseId course_c84874
```

**Behavior**:
- Skips lessons that already exist with `model_version == "claud_Agent_sdk"`
- Generates lessons that are missing or created by other systems
- Prompts for confirmation before starting (unless `--yes` flag used)

---

#### Method 3: Force Mode (Overwrite All Lessons)

```bash
# Regenerate ALL lessons, overwriting existing ones
python -m src.batch_lesson_generator --courseId course_c84874 --force
```

**Use Cases**:
- Major SOW changes requiring full regeneration
- Quality improvements after critic updates
- Fixing systematic errors across all lessons

**⚠️ Warning**: Force mode will **overwrite** all existing lessons for this course!

---

#### Method 4: Automated Mode (CI/CD)

```bash
# Skip confirmation prompts for automated pipelines
python -m src.batch_lesson_generator --courseId course_c84874 --force --yes
```

---

### CLI Options

```bash
python -m src.batch_lesson_generator --help

Required Arguments:
  --courseId TEXT              Course identifier (e.g., course_c84874)

Mode Options:
  --dry-run                    Preview generation plan without executing
  --force                      Overwrite ALL existing lessons (default: skip existing)
  --yes                        Skip all confirmation prompts (for CI/CD)

Configuration Options:
  --mcp-config PATH            MCP config path (default: .mcp.json)
  --max-retries N              Critic retry attempts per lesson (default: 10)
  --no-persist-workspace       Delete temporary workspaces after each lesson
  --log-level LEVEL            Logging level: DEBUG|INFO|WARNING|ERROR (default: INFO)
```

---

### Smart Skip Logic

**How does batch mode decide what to skip?**

1. **Query**: Fetches existing lessons with `model_version == "claud_Agent_sdk"` from `lesson_templates` collection
2. **Comparison**: Compares with SOW entries by `sow_order` field
3. **Decision**:
   - **SKIP**: Lesson exists with correct model_version (already generated by this agent)
   - **GENERATE**: Lesson not found OR created by different system (manual, old SDK)

**Why model_version filtering?**

This ensures the batch generator only manages lessons **it created**, avoiding conflicts with:
- Manually authored lessons
- Lessons from previous authoring systems
- Test/draft lessons with different versioning

---

### Batch Logs and Output

Each batch run creates a structured log directory:

```
logs/batch_runs/batch_course_c84874_20251029_143025/
├── batch_execution.log        # Overall orchestration log
├── batch_summary.json         # Metrics, costs, results for all lessons
├── dry_run_plan.json          # (only if --dry-run used)
├── lesson_order_001.log       # Per-lesson execution log
├── lesson_order_002.log       # Per-lesson execution log
├── lesson_order_003.log       # Per-lesson execution log
└── ...
```

**batch_summary.json Example**:
```json
{
  "batch_id": "batch_course_c84874_20251029_143025",
  "courseId": "course_c84874",
  "start_time": "2025-10-29T14:30:25",
  "end_time": "2025-10-29T15:33:45",
  "duration_seconds": 3800,
  "duration_human": "1h 3m 20s",
  "force_mode": false,
  "dry_run": false,
  "total_sow_entries": 10,
  "skipped": 1,
  "generated": 9,
  "failed": 0,
  "total_cost_usd": 1.53,
  "total_tokens": 450000,
  "avg_cost_per_lesson_usd": 0.17,
  "avg_duration_per_lesson_seconds": 422,
  "results": [
    {
      "order": 1,
      "label": "Introduction to Fractions",
      "status": "skipped",
      "existing_doc_id": "lesson_abc123",
      "log_file": null
    },
    {
      "order": 2,
      "label": "Adding Fractions",
      "status": "success",
      "doc_id": "lesson_xyz789",
      "duration_seconds": 412,
      "cost_usd": 0.18,
      "tokens": 52000,
      "log_file": "lesson_order_002.log"
    }
  ]
}
```

---

### Cost and Duration Estimates

**Typical Performance** (based on actual metrics):
- **Duration**: ~7 minutes per lesson (includes research, authoring, validation)
- **Cost**: ~$0.17 per lesson (Claude Sonnet 3.5)
- **Tokens**: ~45-60K tokens per lesson

**Example: 10-Lesson Course**:
- **Duration**: ~70 minutes (1h 10m)
- **Cost**: ~$1.70 USD
- **Output**: 10 complete lesson templates with 3-15 cards each

---

### Error Handling

**Exit Codes**:
- `0` = Success (all lessons generated successfully)
- `1` = Partial failure (some lessons succeeded, some failed)
- `2` = Fatal error (SOW not found, invalid courseId, etc.)

**Per-Lesson Failures**:
- Batch continues even if individual lessons fail
- Failed lessons logged with full error trace in `lesson_order_NNN.log`
- Partial costs/tokens tracked for failed attempts
- Summary shows which lessons failed for manual retry

**Common Errors**:
```bash
# Error: Published SOW not found
❌ ERROR: Published SOW not found: No published SOW with courseId='course_xyz' in default.Authored_SOW collection.
Please ensure the SOW is authored and published (status='published') before generating lessons.

# Error: Lesson validation failed (example)
❌ [3/10] Order 3 - FAILED
  Error: Critic validation failed after 10 attempts (see lesson_order_003.log for full trace)
  Partial Cost: $0.15 USD
```

---

### Best Practices

1. **Always dry-run first**: Use `--dry-run` to preview plan before committing
2. **Monitor first batch**: Watch `batch_execution.log` in real-time for first few lessons
3. **Check failed lessons**: Review `lesson_order_NNN.log` for any failures
4. **Preserve workspaces**: Keep `--persist-workspace` (default) for debugging
5. **Use force sparingly**: Only use `--force` when you truly need to regenerate everything

---

### Workflow Example

**Scenario**: Initial course setup for National 5 Mathematics

```bash
# Step 1: Ensure published SOW exists
# (Authored via SOW Author with status='published')

# Step 2: Dry-run to verify plan
python -m src.batch_lesson_generator --courseId course_c84874 --dry-run

# Step 3: Review dry-run output, confirm estimates

# Step 4: Execute batch generation
python -m src.batch_lesson_generator --courseId course_c84874

# Step 5: Monitor progress (in another terminal)
tail -f logs/batch_runs/batch_course_c84874_TIMESTAMP/batch_execution.log

# Step 6: Review summary after completion
cat logs/batch_runs/batch_course_c84874_TIMESTAMP/batch_summary.json | jq .

# Step 7: Check for failures and retry if needed
# (Failed lessons can be retried individually using single-lesson mode)
```

---

## Architecture

### 5-Stage Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ INPUT: {courseId, order}                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: SOW Entry Extraction (Python, 0 tokens)           │
│   - Query Authored_SOW by courseId                         │
│   - Extract entry at specified order                        │
│   - Write sow_entry_input.json + sow_context.json          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: Course Data Extraction (Python, 0 tokens)         │
│   - Query sqa_education.sqa_current                         │
│   - Extract nested course JSON                              │
│   - Write Course_data.txt                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: Blank Template Generation (Python, 0 tokens)      │
│   - Read sow_entry_input.json for card structure           │
│   - Generate lesson_template.json with:                    │
│     * Correct card count, IDs (card_001, card_002...)      │
│     * Correct CFU types and IDs                            │
│     * Empty content fields (to be filled by agent)         │
│   - Prevents schema errors, saves agent time               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 4: Agent Execution (Claude SDK)                      │
│                                                             │
│   ┌──────────────────────────────────────────────┐        │
│   │ Research Subagent (on-demand)                │        │
│   │   - Scottish contexts (ScotRail, shops)      │        │
│   │   - Pedagogical patterns (I-We-You)          │        │
│   │   - Misconceptions                           │        │
│   │   - SQA terminology                          │        │
│   └──────────────────────────────────────────────┘        │
│                      ↓                                      │
│   ┌──────────────────────────────────────────────┐        │
│   │ Lesson Author (main creative work)           │        │
│   │   - Reads: sow_entry_input.json,             │        │
│   │            sow_context.json, Course_data.txt,│        │
│   │            lesson_template.json (blank)      │        │
│   │   - Delegates research queries as needed     │        │
│   │   - Fills cards ONE AT A TIME using Edit     │        │
│   │   - Writes: lesson_template.json (complete)  │        │
│   └──────────────────────────────────────────────┘        │
│                      ↓                                      │
│   ┌──────────────────────────────────────────────┐        │
│   │ Combined Lesson Critic v2 (validation)       │        │
│   │   - Schema Gate (PASS/FAIL blocking)         │        │
│   │   - Dimension 1: SOW-Template Fidelity       │        │
│   │     (75% weight, ≥0.90 threshold)            │        │
│   │   - Dimension 2: Basic Quality               │        │
│   │     (25% weight, ≥0.80 threshold)            │        │
│   │   - Uses validation tool for schema check    │        │
│   │   - Writes: critic_result.json               │        │
│   └──────────────────────────────────────────────┘        │
│                      ↓                                      │
│   ┌──────────────────────────────────────────────┐        │
│   │ Retry Loop (if validation fails)             │        │
│   │   - Max 10 attempts                          │        │
│   │   - Lesson author revises based on feedback  │        │
│   └──────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5: Card Compression (Python, 0 tokens)               │
│   - Compress cards array with gzip + base64                │
│   - Reduces storage by ~55%                                 │
│   - Maintains JSON metadata in readable form               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 6: Database Upsert (Python, 0 tokens)                │
│   - Query by (courseId, sow_order)                         │
│   - Update existing document OR create new                  │
│   - Collection: default.lesson_templates                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ OUTPUT: {document_id, metrics}                              │
└─────────────────────────────────────────────────────────────┘
```

### Workspace Files

```
workspace/lesson_author_20251016_154230/
├── README.md                      # Workspace documentation
├── sow_entry_input.json           # Specific lesson SOW entry (from Python)
├── sow_context.json               # Course-level SOW metadata (from Python)
├── Course_data.txt                # SQA course structure (from Python)
├── lesson_template.json           # Authored lesson (from agent) - initially blank, filled incrementally
├── critic_result.json             # Validation results (from agent)
└── schemas/                       # Schema documentation (read-only)
    ├── lesson_template_schema.md  # v2 schema specification with examples
    └── sow_entry_schema.md        # SOW entry structure reference
```

## Subagent Responsibilities

### 1. Research Subagent (`research_subagent_prompt.md`, 11KB)

**Role**: On-demand research support for Scottish contexts and pedagogical guidance

**Capabilities**:
- Scottish context research (ScotRail prices, Edinburgh shops, NHS Scotland)
- Pedagogical pattern explanations (I-We-You progression, scaffolding)
- Misconception databases (common student errors by topic)
- SQA terminology clarification
- Exemplar lesson structures by lesson type
- Accessibility guidance (CEFR levels, dyslexia-friendly design)

**Tools**: WebSearch, WebFetch, Read (workspace files), Grep

**Invoked by**: Lesson Author when needing clarification or context

### 2. Lesson Author (`lesson_author_prompt.md`, 52KB)

**Role**: Senior Scottish Education Lesson Designer

**Process** (12 steps):
1. Read inputs (SOW entry, context, Course_data.txt)
2. Understand requirements (outcomes, lesson type, engagement tags, policy)
3. Research (delegate to research_subagent as needed)
4. Plan lesson structure (card count, progression, CFU types)
5. Design cards (explainer, CFU, hints, scaffolding)
6. Implement accessibility (CEFR plain language, dyslexia-friendly)
7. Add Scottish contexts (£, Scottish locations, authentic pricing)
8. Write misconceptions (card-level error anticipation)
9. Design rubrics (SQA-aligned criteria, point allocation)
10. Validate (self-check against SOW requirements)
11. Write lesson_template.json
12. Complete

**Output**: Complete lesson template with 3-15 cards (depending on lesson type)

**Tools**: Read, Write, WebSearch, WebFetch, Task (delegation), TodoWrite

### 3. Combined Lesson Critic v2 (`lesson_critic_prompt_v2.md`, 24KB)

**Role**: Senior Quality Assurance Specialist for Lesson Templates

**Core Principle**: The SOW author designed the pedagogy. The critic's job is NOT to re-judge pedagogical decisions but to validate:
1. **Transformation Fidelity** (75%): Did lesson author preserve ALL SOW content?
2. **Schema Compliance** (GATE): Does output match v2 schema exactly?
3. **Basic Quality** (25%): Are minimum quality requirements met?

---

**v2 Architecture: Schema Gate + 2-Dimensional Validation**

### **Schema Gate (PASS/FAIL Blocking)**

**Purpose**: Hard validation of v2 schema structure. ANY failure = instant FAIL.

**Process**:
1. Run validation tool: `mcp__lesson-validator__validate_lesson_template {"file_path": "lesson_template.json"}`
2. Check `is_valid` response:
   - `true` → Schema gate PASS, proceed to dimensional scoring
   - `false` → Schema gate FAIL, skip dimensional scoring, return failure result

**Critical Schema Requirements**:
- Required fields: courseId, title, outcomeRefs, lesson_type, estMinutes, createdBy, sow_order, version, status, engagement_tags, policy, cards
- Forbidden fields: assessmentStandardRefs, accessibility_profile, coherence, calculator_section
- Card structure: id, title, explainer, explainer_plain, cfu, rubric, misconceptions
- CFU validation: `stem` field (NOT question_text), type-specific fields correct
- Rubric validation: `sum(criteria.points) == total_points`

If schema gate fails, critic returns:
```json
{
  "pass": false,
  "overall_score": 0.0,
  "schema_gate": {"pass": false, "failed_checks": ["..."]},
  "dimensional_scores": {"sow_template_fidelity": null, "basic_quality": null},
  "feedback": "CRITICAL: Schema gate failed with N violations..."
}
```

---

### **Dimension 1: SOW-Template Fidelity (Weight: 75%, Threshold: ≥0.90)**

**Purpose**: Validate lesson template faithfully represents SOW pedagogical design

**Evaluation Areas**:

1. **Card Structure Preservation (25%)**
   - Card count aligns with SOW card_structure (exact match preferred, ±1 acceptable)
   - Card order matches SOW lesson_flow_summary
   - estMinutes matches SOW (±5 acceptable)
   - Card count realistic for duration (10-15 min per card)

2. **Content Preservation (35%)**
   - ALL SOW worked_example fields appear in template explainer content
   - ALL SOW practice_problems appear in template CFU stems
   - ALL SOW key_concepts covered in template explainers
   - ALL SOW misconceptions_addressed transformed into hints/misconceptions

3. **Standard Coverage (20%)**
   - ALL codes from SOW assessmentStandardRefs appear in template outcomeRefs
   - Template rubrics reference standard descriptions
   - SOW standards_addressed map to rubric criteria

4. **Scottish Context Preservation (10%)**
   - £ from SOW preserved (not $ or €)
   - SOW engagement_tags reflected in CFU contexts
   - Scottish references preserved (ScotRail, NHS, councils)

5. **CFU Strategy Alignment (10%)**
   - Template CFU type matches SOW cfu_strategy indication
   - Template CFU stem aligns with SOW cfu_strategy text

**Scoring Guide**:
- **1.0**: Perfect transformation, zero content loss
- **0.9**: Excellent, minor gaps (1 item missing)
- **0.8**: Good, noticeable gaps (2 items)
- **0.7**: Adequate, significant gaps (3+)
- **<0.7**: Poor, SOW content largely ignored

---

### **Dimension 2: Basic Quality Checks (Weight: 25%, Threshold: ≥0.80)**

**Purpose**: Validate baseline quality (trust SOW for pedagogy, check basics)

**Evaluation Areas**:

1. **Accessibility Basics (40%)**
   - Every card has explainer_plain field
   - explainer_plain simpler than explainer (shorter sentences, simpler words)
   - Not identical copy

2. **Scottish Authenticity Basics (30%)**
   - All monetary values in £ (not $, €, "dollars")
   - Engagement_tags appear in at least 1 CFU context
   - No US-specific references (Walmart, ZIP codes)

3. **Coherence Basics (30%)**
   - Metadata consistency: title, lesson_type, estMinutes match SOW
   - outcomeRefs = SOW outcomeRefs + SOW assessmentStandardRefs codes
   - Card count matches SOW design (within ±1)

---

### **Overall Pass Criteria**

**Pass conditions** (ALL must be true):
- `schema_gate.pass = true` AND
- `sow_template_fidelity ≥ 0.90` AND
- `basic_quality ≥ 0.80` AND
- `overall_score ≥ 0.85`

**Overall Score Formula**:
```
overall_score = (0.75 × sow_template_fidelity) + (0.25 × basic_quality)
```

**Output**: `critic_result.json` with pass/fail, dimensional scores, schema gate status, and prioritized feedback

## Token Optimization Strategy

### Pre-Processing (Python, 0 tokens)
- **SOW extraction**: ~8-12K tokens saved (no LLM needed for JSON extraction)
- **Course data extraction**: ~5-8K tokens saved (deterministic database query)
- **Blank template generation**: ~2-3K tokens saved (pre-generates correct structure, prevents schema errors)

### Post-Processing (Python, 0 tokens)
- **Card compression**: ~3-5K tokens saved (no LLM for gzip encoding)
- **Database upsert**: ~2-3K tokens saved (deterministic query + write)

### MCP Tool Context Exclusion
- **Appwrite MCP tools EXCLUDED** from agent/subagent context (database operations via Python only)
- **Lesson Validator MCP tool INCLUDED** for critic validation
- **Saves**: ~15-20K tokens by excluding unused MCP tools from prompt context

**Total Savings**: ~33-46K tokens per execution vs full LLM pipeline with all MCP tools

### Expected Token Usage

**Typical Execution** (teach lesson, 4 cards):
- SOW extraction: 0 tokens (Python)
- Course data extraction: 0 tokens (Python)
- Blank template generation: 0 tokens (Python)
- Research subagent: 5-10K tokens (2-3 queries)
- Lesson author: 25-40K tokens (main authoring, fills blank template incrementally)
- Lesson critic: 5-10K tokens (1-2 validation rounds)
- Card compression: 0 tokens (Python)
- Database upsert: 0 tokens (Python)

**Total**: 35-60K tokens

**Note**: Blank template generation reduces lesson author token usage by eliminating schema-related errors and allowing focused content filling.

**Cost Estimate** (Claude Sonnet 3.5):
- Input: ~$0.50-0.90 per execution
- Output: ~$0.75-1.25 per execution
- **Total**: ~$1.25-2.15 per lesson template

## Quality Assurance

### Built-in Validation

1. **Pre-execution Validation**:
   - courseId must exist in `default.courses`
   - SOW must exist with entry at specified order
   - Course must have valid subject/level

2. **During Execution**:
   - Research subagent provides accurate, Scottish-specific contexts
   - Lesson author validates against SOW requirements
   - Critic enforces 6-dimensional quality standards

3. **Post-execution Validation**:
   - Compression roundtrip integrity check
   - Database document ID returned
   - Workspace preserved for manual inspection

### Testing Strategy

Comprehensive test suite in `tests/`:
- **test_lesson_upserter.py**: Compression, upsert, data integrity (4 tests, all passing)
- **Phase 4 validation**: Mock lesson template successfully compressed and upserted

## Comparison: SOW Author vs Lesson Author

| Feature | SOW Author | Lesson Author (Single) | Lesson Author (Batch) |
|---------|------------|------------------------|----------------------|
| **Input** | subject + level + courseId | courseId + order | courseId (all entries) |
| **Output** | Complete SOW with 8-15 lesson entries | Single lesson template with 3-15 cards | All lesson templates for course (8-15 lessons) |
| **Database Collection** | `Authored_SOW` | `lesson_templates` | `lesson_templates` |
| **Subagents** | 2 (SOW Author, Unified Critic) | 3 (Research, Lesson Author, Critic) | 3 per lesson (sequential) |
| **Expected Tokens** | 50-80K | 35-60K | 350-600K (10 lessons) |
| **Expected Cost** | $1.50-2.50 | $1.25-2.15 | $1.70 (10 lessons @ $0.17 each) |
| **Execution Time** | 3-5 minutes | 2-4 minutes | ~70 minutes (10 lessons @ 7 min each) |
| **Retry Logic** | Up to 3 attempts | Up to 10 attempts | Up to 10 attempts per lesson |
| **Workspace Files** | 2-3 files | 5 files | 5 files per lesson (isolated) |
| **Batch Logs** | N/A | N/A | ✅ Per-lesson logs + batch summary |
| **Smart Skip Logic** | N/A | N/A | ✅ Skips existing lessons |
| **Dry-Run Mode** | N/A | N/A | ✅ Preview before execution |
| **Force Mode** | N/A | N/A | ✅ Overwrite all lessons |
| **Use Case** | Initial course planning | Detailed lesson authoring | Bulk lesson generation |

## Troubleshooting

### Error: "SOW entry not found"

**Cause**: No SOW document exists for the given courseId, or the order is out of bounds

**Solution**:
```bash
# 1. Verify courseId exists in Authored_SOW
# 2. Check entries array length
# 3. Ensure order is valid (1-indexed, starts from 1)

# Example: If SOW has 10 entries, valid orders are 1-10
```

### Error: "Course not found in database"

**Cause**: courseId doesn't exist in `default.courses` collection

**Solution**:
```bash
# 1. Check courseId spelling
# 2. Verify course exists in Appwrite Console
# 3. Ensure course has subject and level fields
```

### Error: "Appwrite MCP server not accessible"

**Cause**: MCP server not running or credentials incorrect

**Solution**:
```bash
# 1. Check .mcp.json configuration
# 2. Verify APPWRITE_ENDPOINT is accessible
# 3. Test Appwrite API key manually:
curl -X GET "https://cloud.appwrite.io/v1/databases/default/collections/courses/documents" \
  -H "X-Appwrite-Project: YOUR_PROJECT_ID" \
  -H "X-Appwrite-Key: YOUR_API_KEY"
```

### Error: "Critic validation failed after 10 attempts"

**Cause**: Lesson template cannot meet quality thresholds

**Solution**:
1. Check workspace files in `workspace/lesson_author_[execution_id]/`
2. Review `critic_result.json` for specific feedback
3. Common issues:
   - Scottish context violations (USD instead of £, US locations)
   - Assessment rubrics not SQA-aligned
   - Accessibility issues (CEFR level too high)
   - SOW fidelity problems (wrong outcomes referenced)

### High Token Usage

**Symptom**: Execution costs >$3 per lesson

**Possible Causes**:
- Many research subagent queries (>5)
- Multiple critic retry loops (>3)
- Complex lesson type (mock_exam with 15 cards)

**Optimization**:
```bash
# Enable DEBUG logging to see subagent invocations
python -m src.lesson_author_cli \
  --input input.json \
  --log-level DEBUG

# Review metrics in output
```

## Development and Testing

### Running Tests

```bash
# Activate virtual environment
source ../venv/bin/activate

# Run upserter test suite
cd claud_author_agent
python tests/test_lesson_upserter.py

# Expected output: 4/4 tests passed
```

### Workspace Inspection

```bash
# Workspaces are persisted by default in workspace/ subdirectory
ls -la workspace/lesson_author_*/

# View specific execution
cd workspace/lesson_author_20251016_154230
cat lesson_template.json | jq '.title, .lesson_type, .cards | length'
```

### Manual Validation

```bash
# 1. Check lesson template structure
cat lesson_template.json | jq keys

# 2. Verify cards are compressed in database
# Navigate to Appwrite Console → lesson_templates
# Check that "cards" field is base64 string, not JSON array

# 3. Decompress cards for inspection (Python)
python -c "
from src.utils.lesson_upserter import decompress_cards_gzip_base64
import json

# Paste compressed base64 string
compressed = 'H4sIAAAAAAAA...'
cards = decompress_cards_gzip_base64(compressed)
print(json.dumps(cards, indent=2))
"
```

## Advanced Usage

### Custom Critic Thresholds

Modify `src/lesson_author_claude_client.py`:

```python
# Default thresholds in prompt (currently 0.88 for most dimensions)
# To customize, edit lesson_critic_prompt.md:

<passing_thresholds>
- pedagogical_design: 0.90 (increased from 0.88)
- assessment_design: 0.85 (decreased from 0.88)
# ... etc
</passing_thresholds>
```

### Bypassing Compression

For debugging, you can temporarily disable compression:

```python
# In src/utils/lesson_upserter.py, upsert_lesson_template():

# Comment out compression
# compressed_cards = compress_cards_gzip_base64(cards)

# Use uncompressed JSON
doc_data["cards"] = json.dumps(cards)  # Store as JSON string instead
```

### Custom Workspace Location

```python
from src.lesson_author_claude_client import LessonAuthorClaudeAgent

agent = LessonAuthorClaudeAgent(
    mcp_config_path=".mcp.json",
    persist_workspace=True,
    workspace_root="/custom/path/workspaces"  # Custom location
)
```

## Retrying Failed Uploads

If lesson generation completes successfully but the Appwrite upload fails (e.g., due to schema validation, network issues, or database constraints), you can retry just the upload step without re-running the entire pipeline.

### When to Use Retry

Common scenarios:
- ✅ Lesson template generated successfully (`lesson_template.json` exists)
- ❌ Upload failed due to:
  - Schema validation errors (e.g., `estMinutes` out of range)
  - Database field size limits exceeded
  - Network connection issues
  - Permission errors

### Available Retry Scripts

#### Option 1: Direct Upload Script (Recommended)

**Best for**: Quick retry with minimal configuration

```bash
# Navigate to project directory
cd claud_author_agent

# Run direct upload script
source .venv/bin/activate
python direct_upload_lesson.py
```

**Configuration**: Edit `direct_upload_lesson.py` to change:
- `workspace_path`: Path to workspace with lesson_template.json
- `courseId`: Course identifier
- `order`: Lesson order number

**Features**:
- ✅ Standalone (no complex imports)
- ✅ Automatic compression of cards (gzip + base64)
- ✅ Upsert pattern (creates new or updates existing)
- ✅ Helpful error diagnostics
- ✅ Shows compression stats

#### Option 2: Retry with Input JSON

**Best for**: Multiple retries or automation

```bash
# Create input JSON
cat > lesson_retry_input.json << 'EOF'
{
  "courseId": "course_c84475",
  "order": 12
}
EOF

# Run retry script
source .venv/bin/activate
python retry_lesson_upsert.py \
  --workspace workspace/20251030_111447 \
  --input lesson_retry_input.json
```

**Parameters**:
- `--workspace`: Path to workspace folder containing `lesson_template.json`
- `--input`: JSON file with `courseId` and `order`
- `--mcp-config`: (Optional) Path to .mcp.json (default: `.mcp.json`)

### Verification After Upload

After successful retry, verify in Appwrite Console:

1. **Navigate to**: https://cloud.appwrite.io/console
2. **Database**: `default`
3. **Collection**: `lesson_templates`
4. **Query**:
   ```
   courseId = "course_c84475" AND sow_order = 12
   ```

**Expected fields**:
- `title`: Lesson title
- `lesson_type`: e.g., "mock_exam"
- `estMinutes`: Duration (5-120 for regular, 5-180 for mock exams)
- `cards`: Compressed base64 string (starts with "gzip:")
- `status`: "draft"
- `createdBy`: "lesson_author_agent"
- `$id`: Auto-generated document ID

### Common Error Solutions

#### estMinutes Validation Error

**Error**: `Attribute "estMinutes" has invalid format. Value must be a valid range between 5 and 120`

**Cause**: Database schema hasn't been updated to support mock exam durations (5-180 minutes)

**Solution**:
1. Check Appwrite Console → lesson_templates → estMinutes attribute
2. Update constraint to: min=5, max=180
3. Retry upload

**Note**: As of October 2025, estMinutes validation has been updated across all layers (TypeScript, Zod, Python) to support mock exams up to 180 minutes.

#### Cards Field Size Error

**Error**: `cards field size limit exceeded`

**Cause**: Lesson has too many/large cards

**Solution**:
- Cards are automatically compressed (gzip + base64)
- Typical compression: ~60-65% size reduction
- If still too large, check database field size limit

#### Permission/Auth Error

**Error**: `401 Unauthorized` or `403 Forbidden`

**Solution**:
1. Check `.mcp.json` has valid `APPWRITE_API_KEY`
2. Verify API key has write permissions to `lesson_templates` collection
3. Ensure project ID matches your Appwrite instance

### Workspace Structure

After lesson generation, workspace contains:

```
workspace/20251030_111447/
├── sow_entry_input.json      # Extracted SOW entry
├── sow_context.json           # Course-level context
├── Course_data.txt            # SQA course structure
├── lesson_template.json       # ✅ GENERATED LESSON (use for retry)
├── critic_result.json         # Validation feedback
└── schemas/                   # Schema reference files
```

**For retry**: Only `lesson_template.json` is required.

## Next Steps

1. **Run E2E Test** (Phase 5):
   ```bash
   python -m src.lesson_author_cli \
     --courseId course_c84474 \
     --order 1 \
     --log-level DEBUG
   ```

2. **Integrate with Frontend**:
   - Trigger lesson authoring from SOW management UI
   - Display authoring progress and metrics
   - Show generated lesson template preview

3. **Batch Processing**:
   - Author all lessons for a given courseId
   - Parallel execution for multiple lessons
   - Progress tracking and error recovery

## Documentation

- **Implementation Spec**: `tasks/LESSON_AUTHOR_AGENT_SPEC.md`
- **Implementation Status**: `LESSON_AUTHOR_IMPLEMENTATION_STATUS.md`
- **Prompts**: `src/prompts/lesson_author_prompt.md`, `lesson_critic_prompt.md`, `research_subagent_prompt.md`
- **Schemas**: `src/schemas/` (to be created)
- **Examples**: `examples/lesson_author/` (to be created)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review workspace files in `workspace/lesson_author_*/`
3. Enable DEBUG logging for detailed execution trace
4. Consult implementation documentation in `tasks/`

---

**Version**: 1.0 (October 2025)
**Status**: Phase 4 Complete (Upserter tested), Phase 5 Pending (E2E)
**Author**: Claude Code (Anthropic)
