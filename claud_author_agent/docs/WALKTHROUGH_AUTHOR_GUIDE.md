# Walkthrough Author - Claude Agent SDK Implementation

Autonomous pipeline for authoring step-by-step exam question walkthroughs aligned with SQA marking schemes using Claude Agent SDK.

## Overview

This agent takes a `{paper_id, question_number}` input and produces a complete, validated walkthrough in the Appwrite database through a 4-stage pipeline:

**Pre-Processing (Python, 0 tokens)**:
1. **Paper Extractor** → Fetches paper from `us_papers` collection → Extracts question + marking scheme → `walkthrough_source.json` + `paper_context.json`
2. **Blank Template Generator** → Creates `walkthrough_template.json` with correct schema structure

**Pipeline Execution (3 Subagents)**:
3. **Walkthrough Author** → Maps marking scheme bullets to steps with LaTeX → `walkthrough_template.json` (complete)
4. **Common Errors Subagent** → Generates 2-4 common errors with mark implications → Updates `walkthrough_template.json`
5. **Walkthrough Critic** → Validates alignment across 4 dimensions → `walkthrough_critic_result.json`

**Post-Processing (Python, 0 tokens)**:
6. **Content Compression + Upserter** → Compresses walkthrough (gzip+base64) → Appwrite `us_walkthroughs`

## Key Value Proposition ("The Moat")

- **Examiner Alignment**: Show exactly the working needed — not more, not less
- **Mark Labelling**: Label which mark each step earns — "•1 for strategy, •2 for calculation"
- **Error Prevention**: Warn about common errors — "If you omit brackets here, you lose this mark"
- **Notation Precision**: Match the notation and phrasing examiners expect

## Features

- ✅ **Fully Autonomous**: paper_id + question_number → complete walkthrough in database
- ✅ **Token Optimized**: Python pre/post-processing saves ~30-40% tokens
- ✅ **3-Subagent Architecture**: Author, Common Errors, Critic with validation
- ✅ **Marking Scheme Fidelity**: 1:1 mapping of bullets to steps
- ✅ **LaTeX Formatting**: KaTeX-compatible mathematical notation
- ✅ **Content Compression**: gzip+base64 encoding reduces storage by ~50%
- ✅ **Upsert Pattern**: Deterministic document IDs for idempotent operations
- ✅ **Discovery Mode**: Explore available papers without LLM cost
- ✅ **Batch Processing**: Process multiple papers/questions concurrently
- ✅ **Retry Failed**: Re-process failed questions from previous batches
- ✅ **Workspace Persistence**: Full traceability for debugging

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access (Anthropic API key)
- Appwrite instance (with MCP server configured)
- Node.js 18+ (for Appwrite MCP server)
- **Papers must exist in `us_papers` collection** (from SQA paper catalog)

### Setup

```bash
# 1. Navigate to claud_author_agent
cd claud_author_agent

# 2. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure Appwrite MCP
cp .mcp.json.example .mcp.json
# Edit .mcp.json and add your:
#   - APPWRITE_ENDPOINT
#   - APPWRITE_PROJECT_ID
#   - APPWRITE_API_KEY

# 5. Set Claude API key
export ANTHROPIC_API_KEY="your-api-key-here"
# Or add to .env file
```

## Usage

### Quick Start: Discovery Mode (No LLM Cost)

Before generating walkthroughs, explore what papers are available:

```bash
# Discover all available papers
python -m src.batch_walkthrough_generator --discover

# Discover papers for a specific subject
python -m src.batch_walkthrough_generator --discover --subject Mathematics

# Discover papers with subject + level
python -m src.batch_walkthrough_generator --discover --subject Mathematics --level "National 5"

# Discover papers for a specific year
python -m src.batch_walkthrough_generator --discover --subject Mathematics --level "National 5" --year 2023
```

**Discovery Output**:
```
╔════════════════════════════════════════════════════════════════╗
║                    Paper Discovery Results                      ║
╚════════════════════════════════════════════════════════════════╝

Subject: Mathematics
Level: National 5
Papers Found: 3

┌─────────────────────────────────────┬──────┬───────────┬────────────┐
│ Paper ID                            │ Year │ Questions │ Total Marks│
├─────────────────────────────────────┼──────┼───────────┼────────────┤
│ mathematics-n5-2023-X847-75-01      │ 2023 │ 15        │ 60         │
│ mathematics-n5-2022-X847-75-01      │ 2022 │ 15        │ 60         │
│ mathematics-n5-2021-X847-75-01      │ 2021 │ 15        │ 60         │
└─────────────────────────────────────┴──────┴───────────┴────────────┘

Suggested next steps:
  # Dry-run for 2023 paper
  python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --dry-run

  # Generate single question
  python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1
```

---

### Single Question Mode

Generate a walkthrough for one specific question:

```bash
# Generate walkthrough for question 1
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1

# Generate walkthrough for a sub-question
python -m src.batch_walkthrough_generator --paper-id mathematics-nah-2023-X847-77-11 --question 4a

# Generate for a subpart (with parentheses)
python -m src.batch_walkthrough_generator --paper-id mathematics-nh-2023-X847-76-11 --question "5b(i)"
```

---

### Single Paper Mode

Generate walkthroughs for all questions in one paper:

```bash
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01
```

---

### Batch Mode

Generate walkthroughs for multiple papers:

```bash
# All N5 Mathematics papers
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5"

# Specific year only
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --year 2023

# All Higher Mathematics
python -m src.batch_walkthrough_generator --subject Mathematics --level Higher

# Force regenerate existing walkthroughs
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --force

# Limit concurrency (useful for rate limiting)
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --max-concurrent 2
```

---

### Dry-Run Mode

Preview what will be processed without generating:

```bash
# Preview all N5 Mathematics papers
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --dry-run

# Preview a specific paper
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --dry-run
```

---

### Retry Failed Mode

Re-process failed questions from a previous batch:

```bash
# View available batches to retry
ls workspace/  # Look for batch_* directories

# Retry failed questions from a specific batch
python -m src.batch_walkthrough_generator --retry-failed batch_20260110_155503
```

**Retry Mode Behavior**:
- Loads `failed_questions.json` from the specified batch directory
- Creates a nested `retry_{timestamp}` directory under the original batch
- Re-processes only the questions that previously failed
- Writes new `failed_questions.json` if any still fail (supports iterative retry)

---

## CLI Options Reference

```bash
python -m src.batch_walkthrough_generator --help

Required (at least one):
  --subject TEXT           Filter by subject (e.g., 'Mathematics')
  --paper-id TEXT          Process single paper by ID

Optional Filters:
  --level TEXT             Filter by level (e.g., 'National 5', 'Higher')
  --year INTEGER           Filter by year (e.g., 2023)
  --question TEXT          Process single question (requires --paper-id)

Mode Options:
  --discover               Exploration mode - list papers without generation
  --dry-run                Preview execution plan without generating
  --force                  Force regenerate existing walkthroughs
  --retry-failed TEXT      Retry failed questions from a previous batch

Configuration:
  --max-concurrent INTEGER Maximum concurrent question processing (default: 3)
  --mcp-config TEXT        Path to MCP configuration file (default: .mcp.json)
  --log-level TEXT         Logging verbosity: DEBUG, INFO, WARNING, ERROR
```

---

## Typical Workflow

```bash
# Step 1: Discover what papers exist
python -m src.batch_walkthrough_generator --discover --subject Mathematics

# Step 2: Preview a specific level
python -m src.batch_walkthrough_generator --discover --subject Mathematics --level "National 5"

# Step 3: Dry-run to see what would be processed
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --dry-run

# Step 4: Test single question first (optional but recommended)
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1

# Step 5: Generate walkthroughs for all questions
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5"

# Step 6: Check for failures and retry if needed
python -m src.batch_walkthrough_generator --retry-failed batch_YYYYMMDD_HHMMSS
```

---

## Output Schema

### Walkthrough Document (us_walkthroughs)

| Field | Type | Description |
|-------|------|-------------|
| paper_id | string | FK to us_papers.$id |
| question_number | string | Question number like '1', '4a', '5b(i)' |
| paper_code | string | SQA paper code (denormalized) |
| year | integer | Exam year (denormalized) |
| subject | string | Subject name (denormalized) |
| level | string | Level name (denormalized) |
| marks | integer | Total marks for question |
| walkthrough_content | string | gzip + base64 compressed JSON |
| common_errors | string | JSON array of errors (for quick display) |
| status | string | draft/published/archived |
| model_version | string | Version of author agent |
| generation_metadata | string | Token usage, cost, timestamp |

### Walkthrough Content Schema (Uncompressed) - V2

```json
{
  "question_stem": "Evaluate 2 1/6 ÷ 8/9",
  "question_stem_latex": "Evaluate $2\\frac{1}{6} \\div \\frac{8}{9}$",
  "topic_tags": ["fractions", "division"],
  "total_marks": 2,
  "steps": [
    {
      "bullet": 1,
      "label": "•1: strategy",
      "process": "convert to improper fraction and multiply by reciprocal",
      "working": "13/6 × 9/8",
      "working_latex": "\\frac{13}{6} \\times \\frac{9}{8}",
      "marks_earned": 1,
      "examiner_notes": "Must show conversion to improper fraction",
      "concept_explanation": "When we divide by a fraction, we're asking 'how many times does this fraction fit?' Multiplying by the reciprocal gives us the same answer because division and multiplication are inverse operations.",
      "peer_tip": "So basically, dividing by 8/9 is the same as multiplying by 9/8. Just remember: KEEP the first fraction, FLIP the second, then multiply!",
      "student_warning": "Make sure you show converting 2 1/6 to an improper fraction (13/6) - if you just write the final answer, you'll lose this mark even if it's correct."
    }
  ],
  "common_errors": [
    {
      "error_type": "calculation",
      "description": "Forgetting to convert mixed number to improper fraction",
      "learning_gap": "Students often skip the conversion step because they try to divide mixed numbers directly, not realizing that fraction operations require consistent form.",
      "why_marks_lost": "•1 lost for incorrect strategy",
      "prevention_tip": "Always convert mixed numbers first",
      "related_topics": ["mixed-numbers", "improper-fractions", "fraction-conversion"]
    }
  ],
  "examiner_summary": "Correct answer without working scores 0/2.",
  "diagram_refs": [],
  "prerequisite_links": [
    {
      "topic_tag": "fractions",
      "reminder_text": "Review your notes on fractions before attempting this question.",
      "lesson_refs": [],
      "course_fallback": "/courses/C847-75"
    }
  ]
}
```

### V2 Schema Fields Reference

The V2 schema adds pedagogical fields for student-friendly learning experiences:

#### Step-Level V2 Fields

| Field | Type | Required | Min Length | Description |
|-------|------|----------|------------|-------------|
| `concept_explanation` | string | Yes | 50 chars | Explains WHY the mathematical step works |
| `peer_tip` | string | Yes | 20 chars | Casual, student-friendly advice ("So basically...") |
| `student_warning` | string | No | - | Exam-specific warning from transformed examiner notes |

#### Common Error V2 Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `learning_gap` | string | Yes | Underlying misconception that causes this error |
| `related_topics` | string[] | Yes | Topic tags for further review |

#### Prerequisite Links (Root Level)

| Field | Type | Description |
|-------|------|-------------|
| `prerequisite_links` | array | Links to lessons for prerequisite topics |
| `prerequisite_links[].topic_tag` | string | Topic identifier |
| `prerequisite_links[].reminder_text` | string | Brief reminder for students |
| `prerequisite_links[].lesson_refs` | string[] | Lesson template IDs (empty if not linked) |
| `prerequisite_links[].course_fallback` | string | Fallback course path |

### Frontend Integration Notes

When rendering walkthroughs in the frontend:

1. **Decompress content**: Use `gzip + base64` decode to get JSON
2. **Render steps** with:
   - `working_latex` in KaTeX for math display
   - `concept_explanation` in expandable "Why?" section
   - `peer_tip` as highlighted callout box
   - `student_warning` as alert/warning banner
3. **Render common errors** with:
   - `description` as main error text
   - `learning_gap` in "Understanding the mistake" accordion
   - `related_topics` as clickable review links
4. **Render prerequisite links** as "Review these topics" section with links to lessons

---

## Architecture

### 4-Stage Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ INPUT: {paper_id, question_number}                               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: PRE-PROCESSING (Python, 0 tokens)                      │
│   - Validate paper_id and question_number                        │
│   - Query Appwrite us_papers for paper document                  │
│   - Extract question from paper.data JSON                        │
│   - Extract paper context (general principles, formulae)        │
│   - Generate blank walkthrough template                          │
│   - Write: walkthrough_source.json, paper_context.json,         │
│            walkthrough_template.json                             │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: AGENT EXECUTION (Claude Agent SDK)                     │
│                                                                  │
│   ┌──────────────────────────────────────────────┐              │
│   │ Subagent 1: Walkthrough Author               │              │
│   │   - Map marking scheme bullets to steps       │              │
│   │   - Generate LaTeX-formatted working          │              │
│   │   - Add examiner notes from solution.notes    │              │
│   │   - Leave common_errors empty                 │              │
│   └──────────────────────────────────────────────┘              │
│                      ↓                                           │
│   ┌──────────────────────────────────────────────┐              │
│   │ Subagent 2: Common Errors                    │              │
│   │   - Generate 2-4 common errors               │              │
│   │   - Reference specific bullets for mark loss  │              │
│   │   - Add prevention tips                       │              │
│   │   - Source at least one from solution.notes   │              │
│   └──────────────────────────────────────────────┘              │
│                      ↓                                           │
│   ┌──────────────────────────────────────────────┐              │
│   │ Subagent 3: Walkthrough Critic               │              │
│   │   - Marking Scheme Fidelity (35%, ≥0.95)     │              │
│   │   - LaTeX Validity (25%, ≥0.95)              │              │
│   │   - Error Quality (20%, ≥0.85)               │              │
│   │   - Content Accuracy (20%, ≥0.95)            │              │
│   │   - Overall threshold: ≥0.92                  │              │
│   │   - Write: walkthrough_critic_result.json     │              │
│   └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: POST-PROCESSING (Python, 0 tokens)                     │
│   - Load walkthrough_template.json from workspace                │
│   - Compress walkthrough content (gzip + base64)                │
│   - Upsert to us_walkthroughs collection                        │
│   - Return document ID and metrics                               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ OUTPUT: {document_id, metrics, workspace_path}                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workspace Structure

### Single Question Execution

```
workspace/{execution_id}/
├── README.md                          # Auto-generated workspace documentation
├── execution_manifest.json            # Full context at START
├── execution_log.json                 # Step-by-step progress
├── final_result.json                  # Outcome + metrics at END
├── walkthrough_source.json            # Extracted question + marking scheme
├── paper_context.json                 # General marking principles
├── walkthrough_template.json          # Agent output (steps + errors)
└── walkthrough_critic_result.json     # Validation scores
```

### Batch Execution

```
workspace/batch_{batch_id}/
├── batch_manifest.json                # Batch context at START
├── progress.json                      # Live progress tracking
├── failed_questions.json              # Persistent failure list (for resume)
│
├── {execution_id_1}/                  # Question 1 workspace (nested)
│   └── ... (same structure as single question)
├── {execution_id_2}/                  # Question 2 workspace (nested)
│   └── ...
└── {execution_id_n}/                  # Question N workspace (nested)
    └── ...
```

---

## Document ID Pattern

Document IDs follow a deterministic pattern for idempotent upserts:

```
{paper_id}_q{question_number}
```

**Note**: Appwrite document IDs only allow: `a-z`, `A-Z`, `0-9`, and underscore (`_`). Hyphens are NOT allowed.

**Examples**:
- `mathematics_n5_2023_X847_75_01_q1` (Question 1)
- `mathematics_n5_2023_X847_75_01_q4a` (Question 4a)
- `mathematics_nah_2023_X847_77_11_q5bi` (Question 5b(i) - parentheses removed)

**Normalization Rules**:
- Paper ID hyphens replaced with underscores
- Question number converted to lowercase
- Leading "Q" or "q" prefix stripped (to avoid double-q)
- Parentheses `(` and `)` removed
- Example: `Q5b(i)` → `q5bi`

---

## Skip and Force Logic

### Default Behavior (Skip Existing)

By default, the batch generator **skips questions that already have walkthroughs**:

```
Checking for existing walkthroughs...
Found 5 questions with existing walkthroughs
Processing 7 questions (max 3 concurrent)...
```

### Force Mode

When `--force` is specified:

**Single Question Mode**:
1. Check if walkthrough exists
2. **Delete** existing walkthrough document
3. Generate new walkthrough from scratch
4. Create new document (not update)

```bash
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1 --force
# Output:
# 🗑️  Deleting existing walkthrough: mathematics-n5-2023-X847-75-01-q1
# ✅ Deleted, regenerating...
```

**Batch Mode**:
1. Process ALL questions (ignore existing)
2. **Upsert** each walkthrough (update if exists, create if not)

```bash
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --force
# Output:
# ⚠️  --force mode: 5 existing walkthroughs will be overwritten
# Processing 12 questions (max 3 concurrent)...
```

---

## Cost and Performance

### Token Usage (Per Question)

| Stage | Tokens | Notes |
|-------|--------|-------|
| Pre-processing | 0 | Python-only |
| Walkthrough Author | 3,000-5,000 | Main authoring |
| Common Errors | 1,500-3,000 | Error generation |
| Walkthrough Critic | 2,000-4,000 | Per validation pass |
| Post-processing | 0 | Python-only |
| **Total** | **6,500-12,000** | Per question |

### Cost Estimate (Claude Sonnet)

| Scope | Cost | Duration |
|-------|------|----------|
| Single question | ~$0.03-0.06 | 30-60 seconds |
| Single paper (15 questions) | ~$0.45-0.90 | ~10-15 minutes |
| Full batch (3 papers) | ~$1.35-2.70 | ~30-45 minutes |

### Compression Ratio

- **Typical**: 40-60% size reduction
- **Example**: 3,435 bytes → 1,792 bytes (48% reduction)

---

## Quality Thresholds

The Walkthrough Critic validates across 4 dimensions:

| Dimension | Weight | Threshold |
|-----------|--------|-----------|
| Marking Scheme Fidelity | 0.35 | ≥0.95 |
| LaTeX Validity | 0.25 | ≥0.95 |
| Error Quality | 0.20 | ≥0.85 |
| Content Accuracy | 0.20 | ≥0.95 |

**Pass Criteria** (ALL must be met):
- Each dimensional score meets threshold
- Overall score ≥ 0.92

---

## Available Subjects and Levels

| Subject | Level Codes | Example Paper ID |
|---------|-------------|------------------|
| Mathematics | National 5, Higher, Advanced Higher | mathematics-n5-2023-X847-75-01 |
| Application of Mathematics | National 5 | application-of-mathematics-n5-2023-... |

**Level Code Mapping**:
- `n5` → National 5
- `nh` → Higher
- `nah` → Advanced Higher

---

## Troubleshooting

### Error: "Paper not found"

**Cause**: Paper ID doesn't exist in `us_papers` collection

**Solution**:
```bash
# 1. Use discovery mode to find valid paper IDs
python -m src.batch_walkthrough_generator --discover --subject Mathematics

# 2. Check paper ID spelling matches exactly
```

### Error: "Question not found"

**Cause**: Question number doesn't exist in the paper's data

**Solution**:
```bash
# 1. Check available questions in the paper
python -m src.batch_walkthrough_generator --paper-id YOUR_PAPER_ID --dry-run

# 2. Verify question number format (e.g., '4a' vs '4(a)')
```

### Error: "Critic validation failed"

**Cause**: Walkthrough doesn't meet quality thresholds

**Solution**:
1. Check workspace files in `workspace/{execution_id}/`
2. Review `walkthrough_critic_result.json` for specific feedback
3. Common issues:
   - LaTeX syntax errors
   - Missing marking scheme bullets
   - Error descriptions too generic

### Error: "Appwrite MCP server not accessible"

**Cause**: MCP server not running or credentials incorrect

**Solution**:
```bash
# 1. Check .mcp.json configuration
# 2. Verify APPWRITE_ENDPOINT is accessible
# 3. Test Appwrite API key manually
```

---

## Source Files

| File | Purpose |
|------|---------|
| [src/walkthrough_author_claude_client.py](../src/walkthrough_author_claude_client.py) | Main agent orchestrator |
| [src/batch_walkthrough_generator.py](../src/batch_walkthrough_generator.py) | Batch CLI tool |
| [src/models/walkthrough_models.py](../src/models/walkthrough_models.py) | Pydantic schemas |
| [src/utils/paper_extractor.py](../src/utils/paper_extractor.py) | Extract questions from us_papers |
| [src/utils/walkthrough_upserter.py](../src/utils/walkthrough_upserter.py) | Upsert to us_walkthroughs |

## Prompts

| File | Purpose |
|------|---------|
| [src/prompts/walkthrough_author_prompt.md](../src/prompts/walkthrough_author_prompt.md) | Main authoring subagent |
| [src/prompts/common_errors_subagent.md](../src/prompts/common_errors_subagent.md) | Error generation subagent |
| [src/prompts/walkthrough_critic_prompt.md](../src/prompts/walkthrough_critic_prompt.md) | Validation subagent |

---

## Related Documentation

- **Implementation Spec**: [tasks/WALKTHROUGH_AUTHOR_AGENT_SPEC.md](../tasks/WALKTHROUGH_AUTHOR_AGENT_SPEC.md)
- **SOW Author Guide**: [docs/SOW_AUTHOR_GUIDE.md](SOW_AUTHOR_GUIDE.md)
- **Lesson Author Guide**: [docs/LESSON_AUTHOR_GUIDE.md](LESSON_AUTHOR_GUIDE.md)

---

## Comparison with Other Author Agents

| Aspect | SOW Author | Lesson Author | Walkthrough Author |
|--------|------------|---------------|-------------------|
| **Input** | subject + level + courseId | courseId + order | paper_id + question_number |
| **Output** | SOW with 8-15 entries | Lesson with 3-15 cards | Walkthrough with N steps |
| **Subagents** | 2 (Author, Critic) | 3 (Research, Author, Critic) | 3 (Author, Errors, Critic) |
| **Token Usage** | 50K-80K/SOW | 30K-65K/lesson | 6.5K-12K/question |
| **Cost** | ~$1.50-2.50 | ~$1.25-2.15 | ~$0.03-0.06 |
| **Batch Mode** | ❌ | ✅ | ✅ |
| **Discovery Mode** | ❌ | ❌ | ✅ |

---

**Version**: 1.0 (January 2026)
**Status**: Implemented
**Author**: Claude Code (Anthropic)
