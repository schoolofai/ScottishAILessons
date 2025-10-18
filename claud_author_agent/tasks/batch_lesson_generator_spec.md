# Batch Lesson Generator - Technical Specification

**Version**: 1.0
**Date**: 2025-01-17
**Status**: Approved for Implementation

---

## Executive Summary

The Batch Lesson Generator is a long-running CLI script that automates the generation of lesson templates for all SOW (Scheme of Work) entries in a course. It provides:

- **Dry-Run Mode**: Preview generation plan without executing
- **Smart Skip Logic**: Avoid regenerating existing lessons (default behavior)
- **Force Mode**: Overwrite all lessons when needed
- **Full Observability**: Per-lesson execution logs capturing complete agent traces
- **Batch Metrics**: Comprehensive summary with costs, tokens, duration

**Key Design Principle**: No fallback patterns - fast fail with detailed error logging.

---

## 1. Overview & Purpose

### Problem Statement
Currently, generating lesson templates for a full course (10-15 lessons) requires:
- Running `lesson_author_cli.py` manually for each SOW entry order
- No visibility into which lessons already exist
- No batch progress tracking
- Scattered logs difficult to review
- No cost/time estimates before execution

### Solution
A batch orchestrator that:
1. Fetches all SOW entries for a courseId
2. Checks which lessons already exist in database
3. Generates only missing lessons (or all with `--force`)
4. Captures complete execution logs per lesson
5. Provides dry-run preview capability
6. Tracks metrics and generates comprehensive summary

### Non-Goals
- Parallel execution (v1 is sequential)
- Resume from failure (rerun the batch)
- Interactive progress UI (console logs only)

---

## 2. Core Features

### 2.1 Dry-Run Mode (`--dry-run`)

**Purpose**: Preview what will be generated WITHOUT running the agent.

**Behavior**:
1. Fetches SOW entries for courseId from `default.Authored_SOW` (status='published')
2. Queries existing lessons from `default.lesson_templates` with:
   ```sql
   courseId == X AND sow_order == Y AND model_version == "claud_Agent_sdk"
   ```
3. Classifies each SOW entry:
   - **SKIP**: Lesson exists (unless --force)
   - **GENERATE**: Lesson not found
   - **OVERWRITE**: Lesson exists but --force used
4. Displays console table with plan
5. Writes `dry_run_plan.json` to batch log directory
6. Exits WITHOUT generating any lessons (exit code 0)

**Console Output Example**:
```
╔════════════════════════════════════════════════════════════════╗
║         Batch Generation Plan - DRY RUN                        ║
╚════════════════════════════════════════════════════════════════╝

Course ID: course_c84874
Total SOW Entries: 12
Force Mode: No

┌───────┬─────────────────────────────┬──────────────┬─────────────────┐
│ Order │ Label                       │ Status       │ Reason          │
├───────┼─────────────────────────────┼──────────────┼─────────────────┤
│   1   │ Introduction to Fractions   │ SKIP         │ Already exists  │
│   2   │ Equivalent Fractions        │ SKIP         │ Already exists  │
│   3   │ Adding Fractions            │ SKIP         │ Already exists  │
│   4   │ Subtracting Fractions       │ SKIP         │ Already exists  │
│   5   │ Multiplying Fractions       │ SKIP         │ Already exists  │
│   6   │ Dividing Fractions          │ GENERATE     │ Not found       │
│   7   │ Mixed Numbers               │ GENERATE     │ Not found       │
│   8   │ Improper Fractions          │ GENERATE     │ Not found       │
│   9   │ Fraction Word Problems      │ GENERATE     │ Not found       │
│  10   │ Practice Test               │ GENERATE     │ Not found       │
│  11   │ Review Session              │ GENERATE     │ Not found       │
│  12   │ Assessment                  │ GENERATE     │ Not found       │
└───────┴─────────────────────────────┴──────────────┴─────────────────┘

Summary:
  Will skip (already exist):  5 lessons
  Will generate (new):        7 lessons
  Will overwrite:             0 lessons

Estimated Duration: ~49 minutes (7 min/lesson average)
Estimated Cost: ~$1.19 USD ($0.17/lesson average)

✓ Dry-run plan saved to: logs/batch_runs/batch_course_c84874_20250117_143052/dry_run_plan.json

No lessons were generated (dry-run mode).
```

**JSON Output** (`dry_run_plan.json`):
```json
{
  "batch_id": "batch_course_c84874_20250117_143052",
  "courseId": "course_c84874",
  "dry_run": true,
  "timestamp": "2025-01-17T14:30:52Z",
  "total_sow_entries": 12,
  "plan": {
    "skip": [
      {
        "order": 1,
        "label": "Introduction to Fractions",
        "reason": "already_exists",
        "doc_id": "lesson_xyz789",
        "model_version": "claud_Agent_sdk",
        "created_at": "2025-01-15T10:23:45Z"
      }
    ],
    "generate": [
      {
        "order": 6,
        "label": "Dividing Fractions",
        "reason": "not_found"
      }
    ],
    "overwrite": []
  },
  "summary": {
    "will_skip": 5,
    "will_generate": 7,
    "will_overwrite": 0
  },
  "estimates": {
    "duration_minutes": 49,
    "duration_human": "49 minutes",
    "cost_usd": 1.19,
    "avg_duration_per_lesson_minutes": 7,
    "avg_cost_per_lesson_usd": 0.17
  }
}
```

---

### 2.2 Skip Logic (Default Mode)

**Purpose**: Avoid regenerating existing lessons to save time and cost.

**Database Query**:
```python
queries = [
    f'equal("courseId", "{courseId}")',
    f'equal("sow_order", {order})',
    'equal("model_version", "claud_Agent_sdk")'
]
```

**Decision Logic**:
```python
if existing_lesson and not force_mode:
    status = "SKIP"
    reason = f"Already exists (doc: {existing_lesson['$id']})"
else:
    status = "GENERATE"
    reason = "Not found in database"
```

**Logging**:
```
2025-01-17 14:30:54 - INFO - [1/12] Order 1 (Introduction to Fractions): SKIP - Already exists (doc: lesson_xyz789)
2025-01-17 14:30:54 - INFO - [2/12] Order 2 (Equivalent Fractions): SKIP - Already exists (doc: lesson_abc456)
2025-01-17 14:30:54 - INFO - [6/12] Order 6 (Dividing Fractions): GENERATING - Not found in database
```

**Why `model_version == "claud_Agent_sdk"`?**
- Distinguishes lessons generated by this system vs other authoring tools
- Allows mixing manual and automated lessons
- Enables targeted regeneration by filtering on model_version

---

### 2.3 Force Mode (`--force`)

**Purpose**: Regenerate all lessons regardless of existing status.

**Behavior**:
- Ignores existence check
- Overwrites every SOW entry
- Shows warning prompt (unless `--yes` provided)

**Confirmation Prompt** (if not `--yes`):
```
⚠️  WARNING: Force mode will OVERWRITE existing lessons

Course ID: course_c84874
Total SOW entries: 12
Existing lessons found: 5 (orders: 1, 2, 3, 4, 5)
Will overwrite: 12 lessons (including 5 existing)

Estimated Duration: ~84 minutes
Estimated Cost: ~$2.04 USD

Are you ABSOLUTELY SURE you want to proceed? [y/N]:
```

**Usage Scenarios**:
1. Prompt updates (lesson_author_prompt_v2.md changed)
2. Schema changes requiring regeneration
3. Quality issues requiring full course refresh

**Logging with Force Mode**:
```
2025-01-17 14:30:55 - WARNING - Force mode enabled - will overwrite all lessons
2025-01-17 14:30:56 - INFO - [1/12] Order 1 (Introduction to Fractions): GENERATING (force mode, was: lesson_xyz789)
2025-01-17 14:42:18 - INFO - [1/12] Order 1 - SUCCESS - OVERWROTE lesson_xyz789 with lesson_new123
```

---

### 2.4 Full Log Capture (Critical Feature)

**Purpose**: Capture complete agent execution trace for each lesson for debugging and review.

**Implementation Strategy**:

1. **Per-Lesson Log Files**: Each lesson gets dedicated log file
   - Format: `lesson_order_{order:03d}.log`
   - Example: `lesson_order_006.log`, `lesson_order_010.log`
   - Only created for lessons that are generated (skipped lessons = no log file)

2. **Log Redirection**: Use Python logging FileHandler
   ```python
   def setup_lesson_logging(log_file_path, log_level):
       """Setup file handler to capture all agent output."""
       file_handler = logging.FileHandler(log_file_path, mode='w', encoding='utf-8')
       file_handler.setLevel(logging.DEBUG)  # Capture everything
       formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
       file_handler.setFormatter(formatter)

       # Add to root logger to capture ALL logs
       root_logger = logging.getLogger()
       root_logger.addHandler(file_handler)

       return file_handler
   ```

3. **Cleanup After Lesson**: Remove file handler after each lesson to avoid log mixing
   ```python
   root_logger.removeHandler(file_handler)
   file_handler.close()
   ```

**What Gets Logged**:
- ✅ Pre-processing: SOW extraction, Course_data.txt creation
- ✅ LessonAuthorClaudeAgent initialization
- ✅ Research subagent calls (WebSearch/WebFetch queries and results)
- ✅ Lesson Author v2 execution (full authoring trace, all card creation)
- ✅ Lesson Critic v2 validation (all dimensions, retry attempts)
- ✅ Post-processing: Card compression stats, Appwrite upsert
- ✅ All INFO, DEBUG, WARNING, ERROR messages from all modules
- ✅ Cost and token metrics

**Per-Lesson Log Example** (`lesson_order_006.log` - truncated):
```
2025-01-17 14:35:23 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 14:35:23 - INFO - Lesson Author Claude Agent - Execution Starting
2025-01-17 14:35:23 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 14:35:23 - INFO - Initialized LessonAuthorClaudeAgent - Execution ID: 20250117_143523
2025-01-17 14:35:23 - INFO - Validating SOW entry exists for courseId 'course_c84874' at order 6...
2025-01-17 14:35:24 - INFO - ✓ SOW entry found at order 6: Dividing Fractions
2025-01-17 14:35:24 - INFO - Starting lesson authoring pipeline: Dividing Fractions
2025-01-17 14:35:24 - INFO - Workspace created: /tmp/lesson_author_20250117_143523
2025-01-17 14:35:25 - INFO - Pre-processing: Extracting SOW entry via Python utility...
2025-01-17 14:35:26 - INFO - ✅ sow_entry_input.json ready at: /tmp/lesson_author_20250117_143523/sow_entry_input.json
2025-01-17 14:35:26 - INFO - ✅ sow_context.json ready at: /tmp/lesson_author_20250117_143523/sow_context.json
2025-01-17 14:35:26 - INFO - Python extraction complete - no LLM tokens used
2025-01-17 14:35:27 - INFO - Pre-processing: Extracting Course_data.txt via Python utility...
2025-01-17 14:35:28 - INFO - ✅ Course_data.txt ready at: /tmp/lesson_author_20250117_143523/Course_data.txt
2025-01-17 14:35:28 - INFO - Python extraction complete - no LLM tokens used
2025-01-17 14:35:29 - INFO - Loaded MCP config with servers: ['appwrite']
2025-01-17 14:35:29 - INFO - Agent configured with permission_mode='bypassPermissions' + WebSearch/WebFetch enabled
2025-01-17 14:35:30 - INFO - Sending initial prompt to Claude Agent SDK...
2025-01-17 14:35:31 - INFO - Starting message stream - logging ALL raw messages...
2025-01-17 14:35:32 - INFO - ================================================================================
2025-01-17 14:35:32 - INFO - RAW MESSAGE #1 | Type: TextMessage
2025-01-17 14:35:32 - INFO - ================================================================================
... [FULL AGENT EXECUTION TRACE - 200-500 KB] ...
2025-01-17 14:42:15 - INFO - ✅ Pipeline completed after 156 messages
2025-01-17 14:42:15 - INFO - Message stream complete
2025-01-17 14:42:16 - INFO - Starting deterministic Python upserter with compression...
2025-01-17 14:42:17 - INFO - Loaded lesson template: Dividing Fractions
2025-01-17 14:42:17 - INFO - Card compression: 45678 → 12345 bytes (27.0%, saved 73.0%)
2025-01-17 14:42:18 - INFO - Checking for existing lesson template: courseId='course_c84874', sow_order=6
2025-01-17 14:42:18 - INFO - Creating new document (no existing document found)
2025-01-17 14:42:19 - INFO - ✅ Created lesson template: lesson_def789
2025-01-17 14:42:19 - INFO - Lesson template upserted successfully: lesson_def789
2025-01-17 14:42:19 - INFO -
Total Cost: $0.1234 USD
Total Tokens: 12500
2025-01-17 14:42:19 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 14:42:19 - INFO - Lesson Generation Complete
2025-01-17 14:42:19 - INFO - ═══════════════════════════════════════════════════════════
```

**File Size Estimates**:
- Success log: 200-500 KB (includes full agent trace)
- Failed log: 50-100 KB (shorter execution before failure)
- Skipped lesson: No log file created

---

### 2.5 Batch Orchestration Logging

**Purpose**: Track batch-level progress separate from per-lesson detail.

**Log File**: `batch_execution.log`

**Content**:
- Batch initialization
- SOW entry fetching
- Existing lesson detection
- Generation plan
- Per-lesson status (start, success/failure, duration, cost)
- Final summary

**Example** (`batch_execution.log`):
```
2025-01-17 14:30:52 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 14:30:52 - INFO - Batch Lesson Generation Starting
2025-01-17 14:30:52 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 14:30:52 - INFO - Batch ID: batch_course_c84874_20250117_143052
2025-01-17 14:30:52 - INFO - Course ID: course_c84874
2025-01-17 14:30:52 - INFO - Force Mode: No
2025-01-17 14:30:52 - INFO - Dry Run: No
2025-01-17 14:30:52 - INFO - MCP Config: .mcp.json
2025-01-17 14:30:52 - INFO - Max Retries: 10
2025-01-17 14:30:52 - INFO - Log Directory: logs/batch_runs/batch_course_c84874_20250117_143052/
2025-01-17 14:30:52 - INFO - ───────────────────────────────────────────────────────────
2025-01-17 14:30:53 - INFO - Fetching SOW entries from default.Authored_SOW (status='published')...
2025-01-17 14:30:54 - INFO - Found 12 SOW entries for course_c84874
2025-01-17 14:30:54 - INFO - Checking existing lessons in default.lesson_templates...
2025-01-17 14:30:55 - INFO - Found 5 existing lessons (orders: 1, 2, 3, 4, 5)
2025-01-17 14:30:55 - INFO - Generation Plan: Skip 5, Generate 7
2025-01-17 14:30:55 - INFO - ───────────────────────────────────────────────────────────
2025-01-17 14:30:55 - INFO - Processing 12 SOW entries...
2025-01-17 14:30:55 - INFO - ───────────────────────────────────────────────────────────
2025-01-17 14:30:55 - INFO - [1/12] Order 1 (Introduction to Fractions): SKIP - Already exists (doc: lesson_xyz789)
2025-01-17 14:30:55 - INFO - [2/12] Order 2 (Equivalent Fractions): SKIP - Already exists (doc: lesson_abc456)
2025-01-17 14:30:55 - INFO - [3/12] Order 3 (Adding Fractions): SKIP - Already exists (doc: lesson_def123)
2025-01-17 14:30:55 - INFO - [4/12] Order 4 (Subtracting Fractions): SKIP - Already exists (doc: lesson_ghi789)
2025-01-17 14:30:55 - INFO - [5/12] Order 5 (Multiplying Fractions): SKIP - Already exists (doc: lesson_jkl456)
2025-01-17 14:30:56 - INFO - ───────────────────────────────────────────────────────────
2025-01-17 14:30:56 - INFO - [6/12] Order 6 (Dividing Fractions): GENERATING
2025-01-17 14:30:56 - INFO - Log file: lesson_order_006.log
2025-01-17 14:42:18 - INFO - [6/12] Order 6 - ✅ SUCCESS
2025-01-17 14:42:18 - INFO -   Document ID: lesson_def789
2025-01-17 14:42:18 - INFO -   Duration: 11m 22s
2025-01-17 14:42:18 - INFO -   Cost: $0.1234 USD
2025-01-17 14:42:18 - INFO -   Tokens: 12500
2025-01-17 14:42:19 - INFO - ───────────────────────────────────────────────────────────
2025-01-17 14:42:19 - INFO - [7/12] Order 7 (Mixed Numbers): GENERATING
2025-01-17 14:42:19 - INFO - Log file: lesson_order_007.log
2025-01-17 14:55:45 - INFO - [7/12] Order 7 - ✅ SUCCESS
2025-01-17 14:55:45 - INFO -   Document ID: lesson_mno123
2025-01-17 14:55:45 - INFO -   Duration: 13m 26s
2025-01-17 14:55:45 - INFO -   Cost: $0.1567 USD
2025-01-17 14:55:45 - INFO -   Tokens: 15200
... [continues for remaining lessons] ...
2025-01-17 15:58:12 - INFO - [10/12] Order 10 (Practice Test): GENERATING
2025-01-17 15:58:12 - INFO - Log file: lesson_order_010.log
2025-01-17 16:00:37 - ERROR - [10/12] Order 10 - ❌ FAILED
2025-01-17 16:00:37 - ERROR -   Error: Schema gate failed: Card 2 CFU missing 'stem' field
2025-01-17 16:00:37 - ERROR -   Duration: 2m 25s
2025-01-17 16:00:37 - ERROR -   Partial Cost: $0.0456 USD
2025-01-17 16:00:37 - ERROR -   Partial Tokens: 4500
2025-01-17 16:00:37 - INFO - ───────────────────────────────────────────────────────────
... [continues for remaining lessons] ...
2025-01-17 16:45:18 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 16:45:18 - INFO - Batch Generation Complete
2025-01-17 16:45:18 - INFO - ═══════════════════════════════════════════════════════════
2025-01-17 16:45:18 - INFO - Summary:
2025-01-17 16:45:18 - INFO -   Total SOW entries: 12
2025-01-17 16:45:18 - INFO -   Skipped: 5
2025-01-17 16:45:18 - INFO -   Generated (success): 6
2025-01-17 16:45:18 - INFO -   Failed: 1
2025-01-17 16:45:18 - INFO -   Total Duration: 2h 14m 26s
2025-01-17 16:45:18 - INFO -   Total Cost: $0.8456 USD
2025-01-17 16:45:18 - INFO -   Total Tokens: 125000
2025-01-17 16:45:18 - INFO -   Average per lesson: 10m 44s, $0.1409 USD
2025-01-17 16:45:18 - INFO - Summary saved to: batch_summary.json
2025-01-17 16:45:18 - INFO - Log directory: logs/batch_runs/batch_course_c84874_20250117_143052/
```

---

### 2.6 Batch Summary JSON

**Purpose**: Machine-readable summary with complete metrics.

**File**: `batch_summary.json`

**Schema**:
```json
{
  "batch_id": "string",
  "courseId": "string",
  "start_time": "ISO 8601 timestamp",
  "end_time": "ISO 8601 timestamp",
  "duration_seconds": "integer",
  "duration_human": "human-readable duration",
  "force_mode": "boolean",
  "dry_run": "boolean",
  "total_sow_entries": "integer",
  "skipped": "integer",
  "generated": "integer (successful generations)",
  "failed": "integer",
  "results": [
    {
      "order": "integer",
      "label": "string",
      "status": "skipped | success | failed",
      "existing_doc_id": "string (if skipped)",
      "doc_id": "string (if success)",
      "error": "string (if failed)",
      "duration_seconds": "integer (if generated)",
      "cost_usd": "number (if generated)",
      "tokens": "integer (if generated)",
      "log_file": "string | null"
    }
  ],
  "total_cost_usd": "number",
  "total_tokens": "integer",
  "avg_cost_per_lesson_usd": "number",
  "avg_duration_per_lesson_seconds": "integer",
  "log_directory": "string (absolute path)"
}
```

**Example**:
```json
{
  "batch_id": "batch_course_c84874_20250117_143052",
  "courseId": "course_c84874",
  "start_time": "2025-01-17T14:30:52Z",
  "end_time": "2025-01-17T16:45:18Z",
  "duration_seconds": 8066,
  "duration_human": "2h 14m 26s",
  "force_mode": false,
  "dry_run": false,
  "total_sow_entries": 12,
  "skipped": 5,
  "generated": 6,
  "failed": 1,
  "results": [
    {
      "order": 1,
      "label": "Introduction to Fractions",
      "status": "skipped",
      "existing_doc_id": "lesson_xyz789",
      "log_file": null
    },
    {
      "order": 6,
      "label": "Dividing Fractions",
      "status": "success",
      "doc_id": "lesson_def789",
      "duration_seconds": 682,
      "cost_usd": 0.1234,
      "tokens": 12500,
      "log_file": "lesson_order_006.log"
    },
    {
      "order": 10,
      "label": "Practice Test",
      "status": "failed",
      "error": "Schema gate failed: Card 2 CFU missing 'stem' field (see lesson_order_010.log for full trace)",
      "duration_seconds": 145,
      "cost_usd": 0.0456,
      "tokens": 4500,
      "log_file": "lesson_order_010.log"
    }
  ],
  "total_cost_usd": 0.8456,
  "total_tokens": 125000,
  "avg_cost_per_lesson_usd": 0.1409,
  "avg_duration_per_lesson_seconds": 644,
  "log_directory": "/Users/niladribose/code/ScottishAILessons_All/ScottishAILessons/claud_author_agent/logs/batch_runs/batch_course_c84874_20250117_143052"
}
```

---

## 3. File Structure

### 3.1 Directory Layout

```
claud_author_agent/
├── src/
│   ├── batch_lesson_generator.py         (NEW - ~500 lines)
│   ├── lesson_author_cli.py              (EXISTING - not directly used)
│   ├── lesson_author_claude_client.py    (EXISTING - reused)
│   └── utils/
│       ├── batch_utils.py                (NEW - ~300 lines)
│       ├── appwrite_mcp.py               (EXISTING - reused)
│       ├── sow_extractor.py              (EXISTING - reused)
│       ├── lesson_upserter.py            (EXISTING - reused)
│       └── ... (other existing utilities)
└── logs/
    └── batch_runs/                       (NEW - auto-created)
        └── {batch_id}/                   (per-batch directory)
            ├── batch_summary.json        (5-10 KB)
            ├── batch_execution.log       (2-5 KB)
            ├── dry_run_plan.json        (2-5 KB, if --dry-run)
            ├── lesson_order_001.log      (not created if skipped)
            ├── lesson_order_006.log      (200-500 KB, full trace)
            ├── lesson_order_007.log      (200-500 KB, full trace)
            └── ... (one per generated lesson)
```

### 3.2 Batch ID Format

**Pattern**: `batch_{courseId}_{timestamp}`

**Examples**:
- `batch_course_c84874_20250117_143052`
- `batch_course_c84874_20250118_091523`

**Components**:
- Prefix: `batch_`
- Course ID: From input parameter
- Timestamp: `YYYYMMDD_HHMMSS` (local time)

**Why This Format?**:
- Sortable chronologically
- Clear course association
- Unique per execution
- Filesystem-safe

---

## 4. CLI Interface

### 4.1 Command Syntax

```bash
python -m src.batch_lesson_generator --courseId <COURSE_ID> [OPTIONS]
```

### 4.2 Arguments

#### Required Arguments
```
--courseId COURSE_ID    Course identifier (e.g., course_c84874)
                        Must exist in default.courses collection
                        Must have published SOW in default.Authored_SOW
```

#### Mode Arguments (mutually exclusive behaviors)
```
--dry-run               Preview generation plan without executing
                        Creates dry_run_plan.json
                        Exits without generating lessons
                        Exit code: 0

--force                 Overwrite ALL existing lessons
                        Ignores skip logic
                        Shows warning prompt unless --yes provided
                        All SOW entries regenerated
```

#### Confirmation Arguments
```
--yes                   Skip all confirmation prompts
                        Use with --force for automated regeneration
                        Dangerous - use carefully!
```

#### Configuration Arguments
```
--mcp-config PATH       Path to MCP configuration file
                        Default: .mcp.json
                        Used for Appwrite connection

--max-retries N         Maximum critic retry attempts per lesson
                        Default: 10
                        Passed to LessonAuthorClaudeAgent

--no-persist-workspace  Delete temporary workspaces after each lesson
                        Default: Persist for debugging
                        Saves disk space for large batches

--log-level LEVEL       Logging verbosity level
                        Choices: DEBUG, INFO, WARNING, ERROR
                        Default: INFO
                        Affects both batch and per-lesson logs
```

### 4.3 Usage Examples

#### Example 1: Dry-Run to Preview Plan
```bash
python -m src.batch_lesson_generator \
  --courseId course_c84874 \
  --dry-run
```

**Output**: Console table + `dry_run_plan.json`
**Exit Code**: 0
**Lessons Generated**: 0

---

#### Example 2: Generate Missing Lessons (Default Mode)
```bash
python -m src.batch_lesson_generator \
  --courseId course_c84874
```

**Behavior**:
- Checks existing lessons
- Skips those with model_version == "claud_Agent_sdk"
- Generates only missing lessons
- Shows interactive plan confirmation

**Exit Code**:
- 0 if all generated lessons succeed
- 1 if any lesson fails

---

#### Example 3: Force Regenerate All Lessons
```bash
python -m src.batch_lesson_generator \
  --courseId course_c84874 \
  --force
```

**Behavior**:
- Shows warning prompt listing all lessons to overwrite
- User must type "y" to confirm
- Regenerates all 12 lessons

---

#### Example 4: Automated Force Regeneration (CI/CD)
```bash
python -m src.batch_lesson_generator \
  --courseId course_c84874 \
  --force \
  --yes \
  --no-persist-workspace
```

**Behavior**:
- No prompts
- Overwrites all lessons
- Cleans up workspaces
- Suitable for automated pipelines

---

#### Example 5: Debug Mode with Custom Config
```bash
python -m src.batch_lesson_generator \
  --courseId course_c84874 \
  --log-level DEBUG \
  --mcp-config .mcp.prod.json \
  --max-retries 15
```

**Behavior**:
- Verbose DEBUG-level logging
- Custom Appwrite connection
- Higher retry tolerance

---

#### Example 6: Review Logs After Execution
```bash
# List all batch runs
ls -la logs/batch_runs/

# View specific batch summary
cat logs/batch_runs/batch_course_c84874_20250117_143052/batch_summary.json | jq .

# Read specific lesson log
less logs/batch_runs/batch_course_c84874_20250117_143052/lesson_order_006.log

# Search for errors across all lesson logs
grep -r "ERROR" logs/batch_runs/batch_course_c84874_20250117_143052/lesson_order_*.log

# Count total log size
du -sh logs/batch_runs/batch_course_c84874_20250117_143052/
```

---

## 5. Implementation Details

### 5.1 Main Script Structure (`batch_lesson_generator.py`)

**Estimated Lines**: ~500

**Core Functions**:

```python
async def fetch_sow_entries(
    courseId: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Fetch all SOW entries for courseId from Authored_SOW.

    Args:
        courseId: Course identifier
        mcp_config_path: Path to MCP config

    Returns:
        List of SOW entry dictionaries

    Raises:
        ValueError: If no published SOW found
    """
    # Query: courseId == X AND status == 'published'
    # Parse entries field (may be JSON string)
    # Return sorted by order


async def check_existing_lessons(
    courseId: str,
    mcp_config_path: str
) -> Dict[int, Dict[str, Any]]:
    """Check which lessons already exist for this course.

    Args:
        courseId: Course identifier
        mcp_config_path: Path to MCP config

    Returns:
        Dictionary mapping order → {doc_id, model_version, created_at} or None

    Example:
        {
            1: {"doc_id": "lesson_xyz", "model_version": "claud_Agent_sdk", "created_at": "..."},
            2: {"doc_id": "lesson_abc", "model_version": "claud_Agent_sdk", "created_at": "..."},
            3: None,  # Not found
            ...
        }
    """
    # Query lesson_templates for courseId
    # Build map of sow_order → doc details


async def perform_dry_run(
    courseId: str,
    force_mode: bool,
    batch_id: str,
    log_dir: Path,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Execute dry-run analysis and output plan.

    Args:
        courseId: Course identifier
        force_mode: Whether --force is set
        batch_id: Batch identifier
        log_dir: Log directory path
        mcp_config_path: Path to MCP config

    Returns:
        Plan dictionary with skip/generate/overwrite lists

    Side Effects:
        - Prints console table
        - Writes dry_run_plan.json
    """
    # Fetch SOW entries
    # Check existing lessons
    # Classify each entry (skip/generate/overwrite)
    # Calculate estimates
    # Format console table
    # Write JSON
    # Return plan dict


async def execute_batch_generation(
    courseId: str,
    force_mode: bool,
    batch_id: str,
    log_dir: Path,
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """Execute batch lesson generation with progress tracking.

    Args:
        courseId: Course identifier
        force_mode: Whether to overwrite existing lessons
        batch_id: Batch identifier
        log_dir: Log directory path
        config: Configuration dict with mcp_config, max_retries, etc.

    Returns:
        Summary dictionary with results for each lesson

    Side Effects:
        - Generates lessons via LessonAuthorClaudeAgent
        - Writes per-lesson log files
        - Updates batch_execution.log
        - Writes batch_summary.json at end
    """
    # Fetch SOW entries
    # Check existing lessons
    # For each entry:
    #   - Skip if exists (unless force)
    #   - Generate lesson with log capture
    #   - Track result (success/failure, duration, cost)
    # Write batch_summary.json
    # Return summary


async def generate_single_lesson(
    courseId: str,
    order: int,
    label: str,
    log_file_path: Path,
    config: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate a single lesson with full log capture.

    Args:
        courseId: Course identifier
        order: Lesson order
        label: Lesson label (for logging)
        log_file_path: Where to write per-lesson log
        config: Configuration dict

    Returns:
        Result dict: {success, doc_id, duration_seconds, cost_usd, tokens, error}

    Side Effects:
        - Writes complete agent execution to log_file_path
        - Creates/updates lesson in Appwrite
    """
    # Setup lesson-specific logging
    # Initialize LessonAuthorClaudeAgent
    # Execute agent.execute()
    # Capture metrics
    # Cleanup logging
    # Return result


def setup_batch_logging(
    batch_id: str,
    courseId: str
) -> Tuple[Path, logging.Logger]:
    """Create batch log directory and setup batch logger.

    Args:
        batch_id: Batch identifier
        courseId: Course identifier

    Returns:
        (log_dir_path, batch_logger)

    Side Effects:
        - Creates logs/batch_runs/{batch_id}/
        - Creates batch_execution.log file
    """
    # Create log directory
    # Setup file handler for batch_execution.log
    # Return logger


def setup_lesson_logging(
    log_file_path: Path,
    log_level: str
) -> logging.FileHandler:
    """Setup per-lesson log file handler.

    Args:
        log_file_path: Path to lesson log file
        log_level: Logging level string

    Returns:
        FileHandler instance (must be removed after use)

    Side Effects:
        - Creates log file
        - Adds handler to root logger
    """
    # Create FileHandler
    # Set formatter
    # Add to root logger
    # Return handler for later removal


def write_batch_summary(
    log_dir: Path,
    summary_data: Dict[str, Any]
):
    """Write batch_summary.json to log directory.

    Args:
        log_dir: Log directory path
        summary_data: Summary dictionary

    Side Effects:
        - Writes batch_summary.json
    """
    # Write JSON with indent=2


def format_duration(seconds: int) -> str:
    """Format duration as human-readable string.

    Args:
        seconds: Duration in seconds

    Returns:
        Human-readable string (e.g., '2h 14m 26s')

    Examples:
        format_duration(8066) → '2h 14m 26s'
        format_duration(682) → '11m 22s'
        format_duration(45) → '45s'
    """
    # Calculate hours, minutes, seconds
    # Format string


async def main() -> int:
    """CLI entry point.

    Returns:
        Exit code (0=success, 1=failure, 2=error)
    """
    # Parse arguments
    # Validate inputs
    # Create batch_id
    # Setup logging
    # Execute dry-run OR generation
    # Handle errors
    # Return exit code
```

---

### 5.2 Utility Module (`batch_utils.py`)

**Estimated Lines**: ~300

**Functions**:

```python
async def fetch_sow_entries(
    courseId: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Fetch SOW entries from Authored_SOW collection.

    Implementation:
        1. Query: courseId == X AND status == 'published'
        2. Extract entries field
        3. Parse if JSON string
        4. Sort by order
        5. Validate structure
    """


async def check_existing_lessons(
    courseId: str,
    mcp_config_path: str
) -> Dict[int, Dict[str, Any]]:
    """Query lesson_templates for existing lessons.

    Implementation:
        1. Query: courseId == X
        2. Build map: sow_order → {doc_id, model_version, created_at}
        3. Return map
    """


def format_dry_run_table(
    plan_data: Dict[str, Any]
) -> str:
    """Format dry-run plan as ASCII table.

    Args:
        plan_data: Plan dict with skip/generate/overwrite lists

    Returns:
        Formatted ASCII table string

    Implementation:
        - Use Unicode box-drawing characters
        - Fixed-width columns
        - Color-coded status (if terminal supports)
    """


def calculate_estimates(
    num_lessons: int
) -> Dict[str, Any]:
    """Calculate duration and cost estimates.

    Args:
        num_lessons: Number of lessons to generate

    Returns:
        Dict with duration_minutes, cost_usd, etc.

    Assumptions:
        - 7 minutes per lesson (average)
        - $0.17 per lesson (average)
    """


def format_batch_summary_console(
    summary: Dict[str, Any]
) -> str:
    """Format batch summary for console output.

    Args:
        summary: Summary dictionary

    Returns:
        Multi-line formatted string
    """
```

---

## 6. Error Handling Strategy

### 6.1 Individual Lesson Failures

**Philosophy**: Individual failures should NOT stop batch execution.

**Behavior**:
1. Catch exception during lesson generation
2. Log full error to per-lesson log file
3. Log summary error to batch_execution.log
4. Record failure in batch_summary.json results array
5. Continue to next lesson

**Example**:
```python
try:
    result = await generate_single_lesson(courseId, order, label, log_file, config)
    if result["success"]:
        batch_logger.info(f"[{idx}/{total}] Order {order} - ✅ SUCCESS")
    else:
        batch_logger.error(f"[{idx}/{total}] Order {order} - ❌ FAILED: {result['error']}")
except Exception as e:
    batch_logger.error(f"[{idx}/{total}] Order {order} - ❌ EXCEPTION: {e}", exc_info=True)
    result = {"success": False, "error": str(e), ...}
```

### 6.2 Batch-Level Failures

**Philosophy**: Fast fail on infrastructure/config issues.

**Scenarios**:
1. **SOW not found**: Exit immediately (exit code 2)
2. **No SOW entries**: Exit immediately (exit code 2)
3. **Appwrite connection failure**: Exit immediately (exit code 2)
4. **MCP config missing**: Exit immediately (exit code 2)

**Behavior**:
- Log error message
- Do NOT create batch directory
- Exit with code 2

### 6.3 Exit Codes

```
0: Success (all lessons generated successfully OR dry-run completed)
1: Partial failure (some lessons failed, some succeeded)
2: Batch-level error (no lessons attempted due to config/infrastructure issue)
```

**Examples**:
```bash
# All success
$ python -m src.batch_lesson_generator --courseId course_c84874
... [generates 7 lessons, all succeed]
$ echo $?
0

# Partial failure
$ python -m src.batch_lesson_generator --courseId course_c84874
... [generates 7 lessons, 6 succeed, 1 fails]
$ echo $?
1

# Batch error
$ python -m src.batch_lesson_generator --courseId nonexistent_course
Error: Published SOW not found for courseId 'nonexistent_course'
$ echo $?
2
```

---

## 7. Integration with Existing Code

### 7.1 Direct Reuse (No Changes)

**LessonAuthorClaudeAgent Class**:
- Import from `lesson_author_claude_client.py`
- Call `agent.execute(courseId, order)` directly
- Access metrics from result dict

**Appwrite Utilities**:
- `list_appwrite_documents()` for querying
- `create_appwrite_document()` / `update_appwrite_document()` via lesson_upserter

**Validation & Metrics**:
- `validate_lesson_author_input()`
- `CostTracker`, `format_cost_report()`

### 7.2 Why Not Use lesson_author_cli.py?

**Reasons**:
1. **Log Capture**: Need direct control over logging redirection
2. **Metrics Access**: Need programmatic access to execution results
3. **Error Handling**: Need to catch exceptions without subprocess complexity
4. **Performance**: Avoid subprocess overhead (fork/exec)

**Approach**: Import LessonAuthorClaudeAgent class directly and call `execute()` method.

---

## 8. Success Criteria

### 8.1 Functional Requirements

✅ **F1**: Dry-run mode shows accurate plan without touching database
✅ **F2**: Default mode skips existing lessons with `model_version == "claud_Agent_sdk"`
✅ **F3**: Force mode overwrites all lessons with confirmation prompt
✅ **F4**: Each batch creates unique log directory with batch_id format
✅ **F5**: Per-lesson logs capture complete agent execution (all subagents)
✅ **F6**: batch_execution.log shows orchestration progress
✅ **F7**: batch_summary.json contains complete metrics (costs, tokens, duration)
✅ **F8**: Individual lesson failures don't stop batch execution
✅ **F9**: Exit codes accurately reflect success/partial failure/error
✅ **F10**: `--yes` flag skips confirmation prompts for automation

### 8.2 Non-Functional Requirements

✅ **NF1**: Easy to find logs for specific batch runs (timestamped directories)
✅ **NF2**: Easy to find logs for specific lessons (lesson_order_XXX.log naming)
✅ **NF3**: Logs contain enough detail for debugging failures
✅ **NF4**: Console output provides clear progress indication
✅ **NF5**: Dry-run completes in <10 seconds
✅ **NF6**: No leftover temporary files (proper cleanup)
✅ **NF7**: Works with existing .mcp.json configuration
✅ **NF8**: Compatible with existing Appwrite schema

### 8.3 Testing Checklist

- [ ] Dry-run with 0 existing lessons shows "generate all"
- [ ] Dry-run with all existing lessons shows "skip all"
- [ ] Dry-run with mixed shows correct skip/generate breakdown
- [ ] Default mode skips existing lessons
- [ ] Default mode generates missing lessons
- [ ] Force mode overwrites all lessons
- [ ] Force mode shows confirmation prompt
- [ ] `--yes` flag skips confirmation
- [ ] Per-lesson logs contain full agent trace
- [ ] Failed lesson doesn't stop batch
- [ ] batch_summary.json has correct counts
- [ ] Exit code 0 when all succeed
- [ ] Exit code 1 when some fail
- [ ] Exit code 2 when batch-level error
- [ ] Log files are human-readable
- [ ] JSON files are valid JSON

---

## 9. Future Enhancements (Out of Scope for v1)

### Parallel Execution
- Execute N lessons in parallel (default N=1, max N=3)
- Requires thread-safe logging
- Risk: Higher Appwrite load

### Resume from Failure
- Save checkpoint after each lesson
- Resume batch from last successful lesson
- Requires persistent state file

### Progress UI
- Real-time terminal UI with progress bars
- Live cost/token counters
- Requires `rich` or `curses` library

### Lesson Comparison
- Compare generated lesson with existing
- Show diff before overwrite in force mode
- Requires lesson diffing utility

### Cost Estimation Improvement
- Use actual historical data instead of averages
- Query recent lesson generations for metrics
- Requires metrics database

### Email Notifications
- Send summary email when batch completes
- Include failures and costs
- Requires email configuration

---

## 10. Implementation Checklist

- [ ] Create `src/batch_lesson_generator.py`
- [ ] Implement `fetch_sow_entries()`
- [ ] Implement `check_existing_lessons()`
- [ ] Implement `perform_dry_run()`
- [ ] Implement `execute_batch_generation()`
- [ ] Implement `generate_single_lesson()`
- [ ] Implement `setup_batch_logging()`
- [ ] Implement `setup_lesson_logging()`
- [ ] Implement CLI argument parsing
- [ ] Implement confirmation prompts
- [ ] Create `src/utils/batch_utils.py`
- [ ] Implement `format_dry_run_table()`
- [ ] Implement `calculate_estimates()`
- [ ] Implement `format_duration()`
- [ ] Add docstrings to all functions
- [ ] Test dry-run mode
- [ ] Test default skip logic
- [ ] Test force mode
- [ ] Test log capture
- [ ] Test error handling
- [ ] Test exit codes
- [ ] Document usage in README
- [ ] Add example commands to help text

---

## 11. Dependencies

### Required Python Packages
All dependencies already satisfied by existing `pyproject.toml`:
- `asyncio` (stdlib)
- `json` (stdlib)
- `logging` (stdlib)
- `pathlib` (stdlib)
- `datetime` (stdlib)
- `argparse` (stdlib)
- Existing project dependencies (claude_agent_sdk, etc.)

### No New Dependencies Required
This implementation reuses all existing utilities and doesn't introduce new external dependencies.

---

## 12. Glossary

**Batch**: A single execution of the batch lesson generator for one courseId.

**Batch ID**: Unique identifier for a batch run (format: `batch_{courseId}_{timestamp}`).

**SOW**: Scheme of Work - pedagogical design document containing lesson entries.

**SOW Entry**: Individual lesson specification within a SOW (has order, label, card structure, etc.).

**model_version**: Database field indicating which authoring system generated a lesson (value: `"claud_Agent_sdk"` for this system).

**Skip Logic**: Decision process for determining whether to regenerate an existing lesson.

**Force Mode**: Operation mode that ignores skip logic and regenerates all lessons.

**Dry-Run**: Preview mode that shows what would be generated without actually generating lessons.

**Per-Lesson Log**: Log file capturing complete execution trace for a single lesson generation.

**Batch Log**: Log file capturing orchestration-level progress for entire batch.

**Batch Summary**: JSON file with complete metrics for batch execution (costs, tokens, durations, results).

---

## 13. Approval & Sign-Off

This specification has been approved for implementation. Proceed with creating:

1. `src/batch_lesson_generator.py`
2. `src/utils/batch_utils.py`

No modifications to existing files are required.

---

**End of Specification**
