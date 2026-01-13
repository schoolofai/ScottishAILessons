# Walkthrough Author Agent - Claude SDK Implementation Specification

## Document Metadata
- **Created**: 2025-01-10
- **Status**: Implemented
- **Architecture**: Claude Agent SDK (not LangGraph)
- **Based On**: SOW/Lesson Author Agent patterns

---

## Executive Summary

Create a Claude Agent SDK-based walkthrough authoring pipeline that:
1. Takes `paper_id` + `question_number` as input (from `us_papers` collection)
2. Extracts question and marking scheme data
3. Generates examiner-aligned step-by-step walkthrough via 3-subagent pipeline
4. Upserts to Appwrite `us_walkthroughs` collection

**Key Value Proposition ("The Moat")**:
- **Examiner Alignment**: Show exactly the working needed — not more, not less
- **Mark Labelling**: Label which mark each step earns — "•1 for strategy, •2 for calculation"
- **Error Prevention**: Warn about common errors — "If you omit brackets here, you lose this mark"
- **Notation Precision**: Match the notation and phrasing examiners expect

---

## Architecture Overview

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                  WALKTHROUGH AUTHOR PIPELINE                     │
└─────────────────────────────────────────────────────────────────┘

1. INPUT VALIDATION (Python)
   └─ Validate paper_id and question_number parameters
   └─ Query Appwrite us_papers for paper document
   └─ Extract question from paper.data JSON

2. PRE-PROCESSING (Python - NO AGENT)
   └─ Extract question + solution → walkthrough_source.json
   └─ Extract paper context → paper_context.json
   └─ Generate blank template → walkthrough_template.json

3. AGENT EXECUTION (Claude Agent SDK)
   └─ Subagent 1: walkthrough_author (main authoring)
      • Map marking scheme bullets to steps
      • Generate LaTeX-formatted working
      • Add examiner notes
   └─ Subagent 2: common_errors_subagent (error generation)
      • Identify 2-4 common errors
      • Reference specific bullets for mark loss
      • Add prevention tips
   └─ Subagent 3: walkthrough_critic (validation)
      • Validate marking scheme alignment
      • Validate LaTeX syntax
      • Validate error quality
   └─ Outputs: walkthrough_template.json, walkthrough_critic_result.json

4. POST-PROCESSING (Python - NO AGENT)
   └─ Load walkthrough_template.json from workspace
   └─ Compress walkthrough content (gzip + base64)
   └─ Upsert to us_walkthroughs collection
   └─ Return document ID and metrics

5. REPORTING
   └─ Cost tracking across all subagents
   └─ Token usage summary
   └─ Success/failure status
```

---

## Database Schema

### Source Collection: `us_papers`

Paper documents contain questions with embedded marking schemes in the `data` field:
- `questions[]` - Array of questions with text, marks, topic_tags
- `questions[].solution` - Marking scheme with generic_scheme and illustrative_scheme
- `general_principles` - Paper-wide marking principles
- `formulae` - Provided formulae

### Target Collection: `us_walkthroughs`

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
| catalog_version | string | Catalog version from us_papers |
| last_modified | datetime | Last modification timestamp |

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

### V2 Schema Fields (Pedagogical Enhancements)

The V2 schema adds student-friendly pedagogical fields for improved learning:

#### Step-Level Fields (V2)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `concept_explanation` | string | Yes | Explains WHY the step works mathematically (≥50 chars) |
| `peer_tip` | string | Yes | Casual, student-friendly advice (≥20 chars). Uses voice like "So basically..." |
| `student_warning` | string | Optional | Exam-specific warning transformed from examiner notes |

#### Common Error Fields (V2)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `learning_gap` | string | Yes | Explains WHY students make this error (the underlying misconception) |
| `related_topics` | string[] | Yes | Array of related topic tags for further review |

#### Prerequisite Links (V2)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prerequisite_links` | array | Yes | Links to lessons covering prerequisite topics |
| `prerequisite_links[].topic_tag` | string | Yes | Topic identifier matching the question's topic_tags |
| `prerequisite_links[].reminder_text` | string | Yes | Brief reminder text for students |
| `prerequisite_links[].lesson_refs` | string[] | Yes | Array of lesson template IDs (empty if not linked) |
| `prerequisite_links[].course_fallback` | string | Yes | Fallback course path if no specific lessons linked |

---

## File Structure

```
claud_author_agent/
├── src/
│   ├── walkthrough_author_claude_client.py    # Main agent orchestrator
│   ├── batch_walkthrough_generator.py         # Batch CLI tool
│   ├── models/
│   │   └── walkthrough_models.py              # Pydantic schemas (including metadata models)
│   ├── prompts/
│   │   ├── walkthrough_author_prompt.md       # Main walkthrough author
│   │   ├── common_errors_subagent.md          # Error generation
│   │   └── walkthrough_critic_prompt.md       # Validation
│   └── utils/
│       ├── paper_extractor.py                 # Extract questions from us_papers
│       ├── walkthrough_upserter.py            # Upsert to us_walkthroughs
│       └── filesystem.py                      # Isolated workspace management
├── workspace/                                 # Runtime workspaces (gitignored)
│   └── batch_{id}/                            # Batch workspace with nested questions
├── tests/
│   ├── test_walkthrough_models.py             # Model validation tests
│   ├── test_walkthrough_author_client.py      # Agent tests
│   └── test_paper_extractor.py                # Extraction tests
└── tasks/
    └── WALKTHROUGH_AUTHOR_AGENT_SPEC.md       # This file
```

---

## Workspace Structure & Metadata (Observability/Resume/Debug)

### Single Question Workspace

Each question execution creates an isolated workspace with metadata files:

```
workspace/{execution_id}/
├── README.md                          # Auto-generated workspace documentation
├── execution_manifest.json            # Full context at START (paper_id, question, CLI args)
├── execution_log.json                 # Step-by-step progress during pipeline
├── final_result.json                  # Outcome + metrics at END
├── walkthrough_source.json            # Extracted question + marking scheme
├── paper_context.json                 # General marking principles
├── walkthrough_template.json          # Agent output (steps + errors)
└── walkthrough_critic_result.json     # Validation scores
```

### Batch Workspace (Nested Structure)

Batch processing uses nested workspaces for easy management:

```
workspace/batch_{batch_id}/
├── batch_manifest.json                # Batch context at START (filter, scope, config)
├── progress.json                      # Live progress tracking (updated per question)
├── failed_questions.json              # Persistent failure list (for resume)
│
├── {execution_id_1}/                  # Question 1 workspace (nested)
│   └── ... (same structure as single question)
├── {execution_id_2}/                  # Question 2 workspace (nested)
│   └── ...
└── {execution_id_n}/                  # Question N workspace (nested)
    └── ...
```

### Key Metadata Files

| File | Written When | Purpose |
|------|--------------|---------|
| `execution_manifest.json` | START of pre-processing | Full traceability (paper_id, question, CLI command) |
| `execution_log.json` | After each stage | Per-stage progress, tokens, timing |
| `final_result.json` | END of execution | Success/failure, quality scores, cost |
| `batch_manifest.json` | START of batch | Filter criteria, total scope |
| `progress.json` | After each question | Live counts, resume checkpoint |
| `failed_questions.json` | On each failure | Persistent failures for retry |

### Metadata Models (Pydantic)

All metadata files use Pydantic models for validation:

- `ExecutionManifest` - Full execution context
- `ExecutionLog` - Stage-by-stage progress
- `FinalResult` - Final outcome with metrics
- `BatchManifest` - Batch configuration
- `BatchProgress` - Live progress tracking
- `FailedQuestions` - Failure tracking for resume

---

## Component Specifications

### 1. Main Agent Class: `WalkthroughAuthorClaudeAgent`

**File**: `src/walkthrough_author_claude_client.py`

**Key Methods**:
- `_fetch_paper()`: Fetch paper document from us_papers
- `_get_subagent_definitions()`: Load 3 subagent prompts
- `_build_initial_prompt()`: Orchestration prompt for main agent
- `_run_agent_pipeline()`: Execute the 3-subagent pipeline
- `_upsert_walkthrough()`: Post-process and upsert to database
- `execute()`: Main pipeline orchestration

**Interface**:
```python
async def execute(
    self,
    paper_id: str,
    question_number: str
) -> Dict[str, Any]:
    """Execute the complete walkthrough authoring pipeline.

    Args:
        paper_id: Paper document ID (e.g., 'mathematics-n5-2023-X847-75-01')
        question_number: Question number (e.g., '1', '4a', '5b(i)')

    Returns:
        Dictionary containing:
            - success: bool
            - execution_id: str
            - workspace_path: str
            - appwrite_document_id: str (if successful)
            - metrics: dict (cost and token usage)
            - error: str (if failed)
    """
```

### 2. Batch Generator CLI

**File**: `src/batch_walkthrough_generator.py`

#### CLI Arguments Reference

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `--subject` | string | No* | Filter by subject (e.g., 'Mathematics') |
| `--level` | string | No | Filter by level (e.g., 'National 5', 'Higher') |
| `--year` | integer | No | Filter by year (e.g., 2023) |
| `--paper-id` | string | No* | Process single paper by ID |
| `--question` | string | No | Process single question (requires `--paper-id`) |
| `--discover` | flag | No | Exploration mode - list papers/questions without generation |
| `--dry-run` | flag | No | Preview execution plan without generating |
| `--force` | flag | No | Force regenerate existing walkthroughs |
| `--retry-failed` | string | No | Retry failed questions from a previous batch (e.g., 'batch_20260110_155503') |
| `--max-concurrent` | integer | No | Maximum concurrent question processing (default: 3) |
| `--mcp-config` | string | No | Path to MCP configuration file (default: .mcp.json) |
| `--log-level` | string | No | Logging verbosity: DEBUG, INFO, WARNING, ERROR |

*At least `--subject` or `--paper-id` required for generation modes (except `--retry-failed`).

#### CLI Modes

**1. Discovery Mode** - Explore available papers (no LLM cost, fast)
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
- Summary statistics (papers found, total questions, total marks)
- Per-paper details with question numbers, marks, and topic tags
- CLI suggestions for next steps (copy-paste ready commands)

**2. Dry-Run Mode** - Preview what will be processed (no LLM cost)
```bash
# Preview all N5 Mathematics papers
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --dry-run

# Preview a specific paper
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --dry-run
```

**3. Single Question Mode** - Generate for one specific question
```bash
# Generate walkthrough for question 1
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1

# Generate walkthrough for a sub-question
python -m src.batch_walkthrough_generator --paper-id mathematics-nah-2023-X847-77-11 --question 4a

# Generate for a subpart
python -m src.batch_walkthrough_generator --paper-id mathematics-nh-2023-X847-76-11 --question "5b(i)"
```

**4. Single Paper Mode** - Generate for all questions in one paper
```bash
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01
```

**5. Batch Mode** - Generate for multiple papers
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

**6. Retry Failed Mode** - Re-process failed questions from a previous batch
```bash
# Retry failed questions from a specific batch
python -m src.batch_walkthrough_generator --retry-failed batch_20260110_155503

# View available batches to retry
ls workspace/  # Look for batch_* directories
```

**Retry Mode Behavior**:

- Loads `failed_questions.json` from the specified batch directory
- Creates a nested `retry_{timestamp}` directory under the original batch
- Re-processes only the questions that previously failed
- Writes new `failed_questions.json` if any still fail (supports iterative retry)
- Shows summary of successes/failures after completion

**Retry Workspace Structure**:

```text
workspace/batch_20260110_155503/
├── failed_questions.json          # Original failures
├── retry_20260110_162000/         # Retry attempt 1
│   ├── {execution_id}/            # Individual question workspaces
│   └── failed_questions.json      # Remaining failures (if any)
└── retry_20260110_170000/         # Retry attempt 2 (if needed)
    └── ...
```

#### Available Subjects and Levels

| Subject | Level Codes | Example Paper ID |
|---------|-------------|------------------|
| Mathematics | National 5, Higher, Advanced Higher | mathematics-n5-2023-X847-75-01 |
| Application of Mathematics | National 5 | application-of-mathematics-n5-2023-... |

**Level Code Mapping**:
- `n5` → National 5
- `nh` → Higher
- `nah` → Advanced Higher

#### Typical Workflow

```bash
# Step 1: Discover what papers exist
python -m src.batch_walkthrough_generator --discover --subject Mathematics

# Step 2: Preview a specific level
python -m src.batch_walkthrough_generator --discover --subject Mathematics --level "National 5"

# Step 3: Dry-run to see what would be processed
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --dry-run

# Step 4: Generate walkthroughs
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5"

# Optional: Test single question first
python -m src.batch_walkthrough_generator --paper-id mathematics-n5-2023-X847-75-01 --question 1
```

**Features**:

- **Discovery mode**: Free exploration of available papers (no LLM calls)
- **Filter by subject, level, and year**: Flexible targeting
- **Dry-run preview**: See question counts before committing
- **Skip existing walkthroughs**: Default behavior (use `--force` to regenerate)
- **Retry failed questions**: Re-process failures from previous batches with `--retry-failed`
- **Concurrent processing**: Configurable with `--max-concurrent`
- **Nested workspaces**: Per-question workspaces under batch folder for debugging
- **Comprehensive logging**: Per-paper and batch-level reports

---

### Appwrite Storage Strategy

#### Granular Question-Level Storage

Each question walkthrough is stored as an **individual Appwrite document** in the `us_walkthroughs` collection. This enables:

- Independent CRUD operations per question
- Efficient frontend queries (fetch single walkthrough by ID)
- Granular skip/regenerate behavior in batch processing
- Simpler permission management

#### Document ID Pattern

Document IDs follow a deterministic pattern for idempotent upserts:

```text
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

**Generation Code** (`WalkthroughDocument.generate_document_id()`):

```python
def generate_document_id(self) -> str:
    """Generate unique document ID for Appwrite.
    Format: {paper_id}_q{question_number}
    Appwrite document IDs only allow: a-z, A-Z, 0-9, underscore
    """
    # Strip leading "q" to avoid double-q when we add our prefix
    q_normalized = self.question_number.lower().replace("(", "").replace(")", "").lstrip("q")
    # Replace hyphens with underscores for Appwrite compatibility
    paper_id_safe = self.paper_id.replace("-", "_")
    return f"{paper_id_safe}_q{q_normalized}"
```

#### Skip-Existing Behavior

By default, the batch generator **skips questions that already have walkthroughs** in Appwrite.

**Workflow**:

1. Query `us_walkthroughs` for all documents matching the target paper IDs
2. Build a set of existing document IDs
3. Mark matching questions with `has_existing_walkthrough = True`
4. Skip these questions during processing (unless `--force`)

**Console Output**:

```text
Checking for existing walkthroughs...
Found 5 questions with existing walkthroughs
Processing 7 questions (max 3 concurrent)...
```

#### `--force` Flag Behavior

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

1. Query existing walkthroughs (same as normal)
2. Process ALL questions (ignore `has_existing_walkthrough`)
3. **Upsert** each walkthrough (update if exists, create if not)
4. Display warning about overwrite count

```bash
python -m src.batch_walkthrough_generator --subject Mathematics --level "National 5" --force
# Output:
# ⚠️  --force mode: 5 existing walkthroughs will be overwritten
# Processing 12 questions (max 3 concurrent)...
```

**Key Difference**:

- Single question mode: Delete → Create (clean slate)
- Batch mode: Upsert (efficient update in place)

#### Storage Compression

Walkthrough content is stored as **gzip + base64 compressed JSON**:

```python
# Compression (before storage)
compressed = gzip.compress(walkthrough_json.encode('utf-8'))
walkthrough_data = base64.b64encode(compressed).decode('ascii')

# Decompression (when reading)
decoded = base64.b64decode(compressed_data.encode('ascii'))
walkthrough_json = gzip.decompress(decoded).decode('utf-8')
```

**Compression Ratio**: Typically 40-60% size reduction

- Example: 3,435 bytes → 1,792 bytes (48% reduction)

---

### 3. Pydantic Models

**File**: `src/models/walkthrough_models.py`

**Core Models**:
- `WalkthroughStep`: Single step aligned with marking scheme bullet
- `CommonError`: Common error with mark implications
- `QuestionWalkthrough`: Complete walkthrough for a question
- `WalkthroughDocument`: Full document for us_walkthroughs collection

---

## Subagent Prompts

### Subagent 1: Walkthrough Author

**File**: `src/prompts/walkthrough_author_prompt.md`

**Purpose**: Generate step-by-step walkthrough aligned with marking scheme

**Key Responsibilities**:
- Map each `generic_scheme` bullet to one walkthrough step
- Use `illustrative_scheme` for working/answer values
- Distribute `solution.notes` to relevant steps
- Generate descriptive labels ("•1: strategy", "•2: calculation")
- Format LaTeX correctly for KaTeX rendering
- Leave `common_errors` empty (filled by next subagent)

**Critical Mapping Rules**:
| Marking Scheme Source | Walkthrough Step Field |
|----------------------|------------------------|
| `generic_scheme[n].bullet` | `steps[n].bullet` |
| `generic_scheme[n].process` | `steps[n].process` |
| `illustrative_scheme[n].answer` | `steps[n].working` |
| `illustrative_scheme[n].answer_latex` | `steps[n].working_latex` |
| `solution.notes[]` (relevant) | `steps[n].examiner_notes` |

### Subagent 2: Common Errors Subagent

**File**: `src/prompts/common_errors_subagent.md`

**Purpose**: Generate realistic common errors with mark implications

**Key Responsibilities**:
- Generate 2-4 common errors per question
- Reference specific bullets for mark loss ("•1 and •2 lost")
- Provide actionable prevention tips
- Source at least one error from `solution.notes[]`
- Categorize errors: notation, calculation, concept, omission

### Subagent 3: Walkthrough Critic

**File**: `src/prompts/walkthrough_critic_prompt.md`

**Purpose**: Validate alignment and quality across 4 dimensions

**Evaluation Dimensions**:

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

## Error Handling Strategy

### Fast-Fail Principles

**NO FALLBACKS** - Always throw exceptions:
```python
# ✅ GOOD - Fast fail with clear error
if paper_doc is None:
    raise ValueError(f"Paper not found: {paper_id}")

if question_source is None:
    raise ValueError(f"Question not found: {question_number} in paper {paper_id}")

# ❌ BAD - Silent fallback (ANTI-PATTERN)
if paper_doc is None:
    paper_doc = {}  # Silent failure - NEVER DO THIS
```

---

## Implementation Status

### Completed
- [x] us_walkthroughs collection schema in Appwrite
- [x] Pydantic models (`walkthrough_models.py`)
- [x] Paper extractor utility with tests
- [x] Walkthrough author prompt
- [x] Common errors subagent prompt
- [x] Walkthrough critic prompt
- [x] Walkthrough author orchestrator with tests
- [x] Batch walkthrough generator CLI
- [x] Walkthrough upserter utility

### Frontend Integration (Completed)
- [x] PastPaperDriver with tests
- [x] API routes for past papers
- [x] Frontend browse pages
- [x] WalkthroughAccordion component
- [x] Dashboard integration
- [x] End-to-end testing with Playwright

---

## Cost Optimization

### Token Reduction Strategies

**1. Python Pre-processing** (0 tokens):
- Paper fetching (Appwrite query)
- Question extraction (JSON parsing)
- Template generation

**2. Targeted Agent Usage** (minimized tokens):
- Only use LLM for creative/judgmental tasks
- Provide structured input in JSON format

**3. Python Post-processing** (0 tokens):
- Validation against marking scheme
- Compression algorithm
- Database operations

### Estimated Token Usage

| Stage | Tokens (Estimate) | Notes |
|-------|-------------------|-------|
| Pre-processing | 0 | Python-only |
| Walkthrough Author | 3,000-5,000 | Per question |
| Common Errors | 1,500-3,000 | Per question |
| Walkthrough Critic | 2,000-4,000 | Per pass |
| Post-processing | 0 | Python-only |
| **Total (single question)** | **6,500-12,000** | |
| **Cost (Claude Sonnet)** | **~$0.03-0.06** | Per question |

---

## Success Criteria

### Functional Requirements
- ✅ Agent generates valid walkthrough matching schema
- ✅ Steps align 1:1 with marking scheme bullets
- ✅ LaTeX renders correctly in KaTeX
- ✅ Common errors reference specific bullets
- ✅ Upsert correctly handles create vs update logic
- ✅ Walkthrough content compressed for storage

### Non-Functional Requirements
- ✅ Token usage: 6,500-12,000 per question
- ✅ Execution time: 30-60 seconds per question
- ✅ Cost: ~$0.03-0.06 per question at Claude Sonnet pricing
- ✅ Workspace persistence for debugging
- ✅ Comprehensive logging to files

### Quality Requirements
- ✅ Marking scheme fidelity: ≥0.95
- ✅ LaTeX validity: ≥0.95
- ✅ Error quality: ≥0.85
- ✅ Content accuracy: ≥0.95
- ✅ Scottish authenticity: £ currency, SQA terminology

---

## Comparison with Other Author Agents

| Aspect | SOW Author | Lesson Author | Walkthrough Author |
|--------|------------|---------------|-------------------|
| **Input Source** | Subject + Level + courseId | courseId + order | paper_id + question_number |
| **Input Data** | SQA course data | SOW entry | Question + marking scheme |
| **Pre-processing** | Course data extraction | SOW entry + Course data | Question extraction |
| **Subagents** | 2 (Author, Critic) | 3 (Research, Author, Critic) | 3 (Author, Errors, Critic) |
| **Output Schema** | Authored_SOW entries | lesson_templates cards | us_walkthroughs steps |
| **Compression** | JSON string | gzip + base64 | gzip + base64 |
| **Validation** | 5 dimensions | 6 dimensions | 4 dimensions |
| **Token Usage** | 50K-80K/SOW | 30K-65K/lesson | 6.5K-12K/question |
| **Uniqueness** | (courseId) single doc | (courseId, sow_order) | (paper_id, question_number) |

---

## References

### Source Files
- Walkthrough Author: `claud_author_agent/src/walkthrough_author_claude_client.py`
- Batch Generator: `claud_author_agent/src/batch_walkthrough_generator.py`
- Models: `claud_author_agent/src/models/walkthrough_models.py`
- Paper Extractor: `claud_author_agent/src/utils/paper_extractor.py`
- Walkthrough Upserter: `claud_author_agent/src/utils/walkthrough_upserter.py`

### Related Agents
- SOW Author: `claud_author_agent/src/sow_author_claude_client.py`
- Lesson Author: `claud_author_agent/src/lesson_author_claude_client.py`

### Documentation
- Claude Agent SDK: https://github.com/anthropics/claude-agent-sdk
- Appwrite: https://appwrite.io/docs

---

**END OF SPECIFICATION**
