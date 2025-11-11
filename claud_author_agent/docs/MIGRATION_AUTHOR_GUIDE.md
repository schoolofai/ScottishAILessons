# Lesson Migration - Claude Agent SDK Implementation

Autonomous pipeline for upgrading legacy lesson templates to meet current schema requirements using Claude Agent SDK.

## Overview

This agent takes a `{courseId, order}` input and upgrades an existing lesson template to meet current Pydantic schema standards through a validation-driven pipeline:

**Pre-Processing (Python, 0 tokens)**:
1. **Lesson Template Fetch** → Extracts existing lesson from Appwrite by courseId + order → `current_lesson.json`
2. **Pre-Validation** → Identifies schema violations using Pydantic LessonTemplate model → `validation_errors.txt`
3. **Skip Logic** → If lesson already valid, skip migration (fast-path optimization)

**Pipeline Execution (1 Agent, Retry Loop)**:
4. **Migration Agent** → Reads current lesson + validation errors → Adds missing fields (rubrics, misconceptions) → `migrated_lesson.json`
5. **Post-Validation** → Confirms schema compliance → Retries if errors remain (up to 3 attempts)

**Post-Processing (Python, 0 tokens)**:
6. **Metadata Preservation** → Extracts authored_sow_id and authored_sow_version from existing document
7. **Card Compression + Upserter** → Compresses cards (gzip+base64) → Appwrite `default.lesson_templates` (update existing)

## Features

- ✅ **Validation-Driven**: Pydantic errors guide exactly what needs to be fixed
- ✅ **Content Preservation**: NEVER modifies existing educational content (explainer, CFU, etc.)
- ✅ **Metadata Preservation**: Maintains SOW linkage (authored_sow_id, authored_sow_version)
- ✅ **Additive-Only**: Only adds missing required fields (rubrics, misconceptions, IDs)
- ✅ **Fast-Path Optimization**: Skips lessons that already pass validation (pre-validation check)
- ✅ **Retry Loop**: Up to 3 attempts with validation errors fed back to agent
- ✅ **Salvage Logic**: Recovers valid migrations even if agent violates file naming contract
- ✅ **Batch Mode**: Migrate all lessons in a course with single command
- ✅ **Dry-Run Preview**: See validation errors before executing migrations
- ✅ **Per-Lesson Logging**: Detailed logs for each migration attempt
- ✅ **Cost Tracking**: Token usage and cost metrics per migration
- ✅ **Workspace Persistence**: Preserved for debugging (includes README)
- ✅ **Fail-Fast Design**: No fallback patterns - throws exceptions for debugging

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access (Anthropic API key)
- Appwrite instance (with MCP server configured)
- Node.js 18+ (for Appwrite MCP server and validation tool)
- **Existing lesson templates** in `default.lesson_templates` collection
- **JSON Validator MCP Server** running (port 3100)

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

# 3. Start JSON Validator MCP Server (required for validation)
cd ../json-validator-mcp
npm install
npm start  # Runs on port 3100

# 4. Set Claude API key
export ANTHROPIC_API_KEY="your-api-key-here"
# Or add to .env file
```

## Usage

### Method 1: CLI with Command-Line Arguments (Recommended)

```bash
source ../venv/bin/activate
python -m src.lesson_migration_claude_client \
  --courseId course_c84473 \
  --order 3
```

### Method 2: Python API (Programmatic)

```python
import asyncio
from src.lesson_migration_claude_client import LessonMigrationClaudeAgent

async def main():
    agent = LessonMigrationClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        max_retries=3
    )

    result = await agent.execute(
        courseId="course_c84473",
        order=3
    )

    print(f"Success: {result['success']}")
    print(f"Errors fixed: {result['errors_fixed']}")
    print(f"Document ID: {result['appwrite_document_id']}")
    print(f"Execution time: {result['execution_time_seconds']:.1f}s")

asyncio.run(main())
```

## CLI Options

```bash
python -m src.lesson_migration_claude_client --help

Options:
  --courseId TEXT            Course identifier (required)
  --order INTEGER            Lesson order in SOW entries (required)
  --log-level LEVEL          Logging level: DEBUG/INFO/WARNING/ERROR (default: INFO)
```

**Note**: Workspace persistence is always enabled for migration (cannot be disabled). This ensures migrated lessons can be inspected if issues occur.

## Input Parameters

### courseId (required)
- **Type**: String
- **Format**: Course identifier from `default.courses` collection
- **Example**: `"course_c84473"`
- **Validation**: Must exist in database with published SOW

### order (required)
- **Type**: Integer
- **Format**: 1-indexed position in SOW entries (order 1, 2, 3...)
- **Example**: `3` (third lesson)
- **Validation**: Must match existing lesson_template with `sow_order=3`

## Output

### Success Response

```json
{
  "success": true,
  "execution_id": "migration_20251107_112749",
  "workspace_path": "workspace/migration_20251107_112749",
  "appwrite_document_id": "68f50b2b0015d490c66b",
  "errors_fixed": 8,
  "execution_time_seconds": 186.1,
  "cost_usd": 0.53,
  "validation_passed": true
}
```

### Failure Response

```json
{
  "success": false,
  "execution_id": "migration_20251107_112749",
  "workspace_path": "workspace/migration_20251107_112749",
  "error": "Migration failed after 3 attempts. Remaining errors: 2",
  "errors_fixed": 0,
  "execution_time_seconds": 240.0,
  "cost_usd": 0.75,
  "validation_errors": [
    "cards.4.rubric: Field required",
    "cards.5.misconceptions: List should have at least 1 item"
  ]
}
```

## Batch Mode

### Overview

**Batch Mode** allows you to migrate **all lessons** in a course with a single command, instead of migrating lessons one at a time. This is ideal for:

- **Backward compatibility**: Upgrade all legacy lessons to current schema
- **Schema evolution**: Apply new required fields across entire course
- **Validation enforcement**: Ensure all lessons meet current standards
- **Bulk fixes**: Address systematic schema issues

**Key Features**:
- ✅ **Pre-Validation**: Fast-fail check before starting migrations
- ✅ **Smart Skip Logic**: Automatically skips lessons that already pass validation
- ✅ **Dry-Run Mode**: Preview validation errors before migration
- ✅ **Force Mode**: Re-migrate even valid lessons when needed
- ✅ **Per-Lesson Logging**: Each lesson gets its own detailed log file
- ✅ **Batch Metrics**: Comprehensive summary with costs, durations, success/failure counts
- ✅ **Fail-Fast Design**: No fallback patterns - detailed error logging for debugging

---

### Usage

#### Method 1: Dry-Run (Preview Validation Errors)

```bash
# Preview which lessons need migration and what errors they have
python -m src.batch_lesson_migration --courseId course_c84473 --dry-run
```

**Output**: Detailed per-lesson validation error breakdown

**Example Dry-Run Output**:
```
================================================================================
MIGRATION PREVIEW
================================================================================

Total Lessons: 16
  - Migrate (invalid): 13
  - Re-migrate (forced): 0
  - Skip: 3

────────────────────────────────────────────────────────────────────────────────
Lesson 1: SKIP - Money Notation, Operations and Calculations
  Reason: Already valid (use --force to re-migrate)

────────────────────────────────────────────────────────────────────────────────
Lesson 2: MIGRATE - Money Skills Revision and Consolidation
  Reason: Fix 7 validation errors
  Validation Errors (7):
    1. cards.0.rubric: Field required
    2. cards.1.rubric: Field required
    3. cards.2.rubric: Field required
    4. cards.3.rubric: Field required
    5. cards.4.rubric: Field required
    6. cards.5.rubric: Field required
    7. cards.5.misconceptions: List should have at least 1 item after validation

────────────────────────────────────────────────────────────────────────────────
Lesson 3: MIGRATE - Measurement: Recording and Interpreting
  Reason: Fix 8 validation errors
  Validation Errors (8):
    1. cards.0.rubric: Field required
    2. cards.1.rubric: Field required
    3. cards.2.rubric: Field required
    4. cards.3.rubric: Field required
    5. cards.4.cfu: Value error, CFU validation failed for type 'mcq':
       - cfu.options: List should have at least 3 items after validation, not 2
    6. cards.4.rubric: Field required
    7. cards.5.rubric: Field required
    8. cards.6.rubric: Field required

================================================================================

Estimated Duration: ~26 minutes (13 lessons × ~2 min/lesson)
Estimated Cost: ~$6.50 (13 lessons × ~$0.50/lesson)
```

---

#### Method 2: Full Batch Migration

```bash
# Migrate all invalid lessons (skip already valid)
python -m src.batch_lesson_migration --courseId course_c84473 --yes
```

**Process**:
1. Pre-validates all lessons
2. Builds execution plan (skip valid, migrate invalid)
3. Displays summary
4. Migrates lessons sequentially
5. Generates batch report

**Output**: Real-time progress + final summary

---

#### Method 3: Selective Migration (Specific Lessons)

```bash
# Migrate only specific lesson orders
python -m src.batch_lesson_migration \
  --courseId course_c84473 \
  --orders 3,4,6,7,9,10,12 \
  --yes
```

**Use Cases**:
- Retry failed migrations from previous batch
- Migrate newly identified invalid lessons
- Target specific lesson types or ranges

---

#### Method 4: Force Re-Migration (Overwrite Valid Lessons)

```bash
# Re-migrate ALL lessons, even if valid
python -m src.batch_lesson_migration \
  --courseId course_c84473 \
  --force \
  --yes
```

**⚠️ Use with Caution**: Overwrites existing valid lessons

**Use Cases**:
- Apply prompt improvements to all lessons
- Regenerate rubrics/misconceptions with updated logic
- Test migration pipeline changes

---

### Batch CLI Options

```bash
python -m src.batch_lesson_migration --help

Options:
  --courseId TEXT            Course identifier (required)
  --orders TEXT              Comma-separated lesson orders (e.g., "1,2,3,5")
                             If omitted, migrates all SOW entries
  --force                    Re-migrate even valid lessons (default: skip valid)
  --yes                      Skip confirmation prompt and execute immediately
  --dry-run                  Preview migration plan without executing
  --log-level LEVEL          Logging level (default: INFO)
```

---

### Batch Output Location

```
logs/batch_migrations/batch_migration_YYYYMMDD_HHMMSS/
├── batch_summary.json          # JSON metrics report
├── order_1.log                 # Per-lesson detailed log
├── order_2.log
├── order_3.log
└── ...
```

---

### Batch Summary Report

**Example `batch_summary.json`**:

```json
{
  "batch_id": "batch_migration_20251106_215443",
  "timestamp": "2025-11-06T23:19:33.164790",
  "metrics": {
    "total_lessons": 16,
    "success": 6,
    "failed": 7,
    "skipped": 3,
    "total_errors_fixed": 140,
    "total_cost_usd": 3.15,
    "total_time_seconds": 1967,
    "avg_time_per_lesson_seconds": 122,
    "avg_cost_per_lesson_usd": 0.52
  },
  "results": [
    {
      "order": 1,
      "status": "SKIPPED",
      "reason": "Already valid (use --force to re-migrate)",
      "errors_fixed": 0,
      "cost_usd": 0,
      "execution_time_seconds": 0
    },
    {
      "order": 2,
      "status": "SUCCESS",
      "errors_fixed": 7,
      "cost_usd": 0.48,
      "execution_time_seconds": 129.79,
      "error": null
    },
    {
      "order": 3,
      "status": "FAILED",
      "errors_fixed": 0,
      "cost_usd": 0.53,
      "execution_time_seconds": 186.1,
      "error": "Migration failed after 3 attempts. Remaining errors: 1"
    }
  ]
}
```

---

## Architecture

### Migration Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION PIPELINE                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ PRE-PROCESSING       │ (Python, 0 tokens)
├──────────────────────┤
│ 1. Fetch Lesson      │ → current_lesson.json
│ 2. Pre-Validate      │ → validation_errors.txt
│ 3. Skip if Valid     │ → Fast-path exit
└──────────────────────┘
           ↓
┌──────────────────────┐
│ AGENT EXECUTION      │ (Claude Agent SDK, Retry Loop)
├──────────────────────┤
│ 4. Migration Agent   │ → reads current_lesson.json
│    - Add Rubrics     │    + validation_errors.txt
│    - Add Misconceptions │ → writes migrated_lesson.json
│    - Fix Schema      │
│    - Validate        │ → retry if errors (max 3)
└──────────────────────┘
           ↓
┌──────────────────────┐
│ POST-PROCESSING      │ (Python, 0 tokens)
├──────────────────────┤
│ 5. Metadata Preserve │ → Extract authored_sow_id/version
│ 6. Compress + Upsert │ → gzip+base64 cards
│                      │ → Update Appwrite (not create!)
└──────────────────────┘
```

### Workspace Structure

**Migration workspace** (`workspace/migration_YYYYMMDD_HHMMSS/`):

```
migration_20251107_112749/
├── README.md                  # Migration-specific documentation
├── current_lesson.json        # Input: Existing lesson template
├── validation_errors.txt      # Input: Pydantic validation errors
└── migrated_lesson.json       # Output: Upgraded lesson (REQUIRED)
```

**Key Points**:
- ✅ Agent MUST create `migrated_lesson.json` as new file
- ❌ Agent MUST NOT modify `current_lesson.json` in-place
- ✅ Salvage logic recovers migrations if agent violates contract

---

## Migration Agent Responsibilities

### Core Mission
**Upgrade lesson templates to pass Pydantic validation by adding ONLY missing required fields.**

### What the Agent Does

#### 1. Read Inputs
- `current_lesson.json` - Existing lesson template
- `validation_errors.txt` - List of schema violations

#### 2. Identify Missing Fields
Parse validation errors to determine:
- Missing `rubric` fields on cards
- Missing `misconceptions` lists
- Invalid `title` length (< 30 chars)
- Missing card `id` fields
- Invalid CFU structures (e.g., MCQ with < 3 options)

#### 3. Generate Missing Content

**Rubrics** (card-level assessment criteria):
```json
{
  "total_points": 3,
  "criteria": [
    {
      "description": "Applies correct method/formula",
      "points": 2
    },
    {
      "description": "Calculates accurate final answer",
      "points": 1
    }
  ]
}
```

**Misconceptions** (common student errors):
```json
[
  {
    "id": "MISC_MATH_FRACTIONS_001",
    "error": "Student adds numerators and denominators separately",
    "explanation": "Misconception that 1/2 + 1/3 = 2/5"
  }
]
```

**Title Expansion** (if < 30 chars):
```
Before: "Data and Probability Revision"  (29 chars)
After:  "Data and Probability Revision and Assessment"  (45 chars)
```

#### 4. Write Output
- Create `migrated_lesson.json` with ALL fields (existing + generated)
- Call `mcp__validator__validate_lesson_template` to confirm schema compliance
- Write validation results to `validation_errors.txt`

### What the Agent NEVER Does

❌ **NEVER modify existing content**:
- `explainer` (teaching content)
- `explainer_plain` (accessible version)
- `cfu` (check for understanding)
- `outcomeRefs` (learning outcomes)
- `lesson_type` (pedagogical category)

❌ **NEVER change educational design**:
- Card order/structure
- Question types
- Difficulty levels
- Scottish curriculum alignment

✅ **ONLY add schema compliance fields**:
- Rubrics (marking schemes)
- Misconceptions (error patterns)
- Metadata (IDs, titles)

---

## Quality Assurance

### Validation-Driven Migration

**Pre-Validation** (before migration):
```
1. Fetch lesson from Appwrite
2. Parse JSON fields (outcomeRefs, engagement_tags, policy)
3. Validate with Pydantic LessonTemplate model
4. If valid → skip migration (fast-path)
5. If invalid → collect error list → proceed to migration
```

**Post-Validation** (after migration):
```
1. Read migrated_lesson.json
2. Parse JSON fields
3. Validate with Pydantic LessonTemplate model
4. If valid → SUCCESS, proceed to upsert
5. If invalid → RETRY (feed errors back to agent, max 3 attempts)
```

### Retry Loop Logic

```python
for attempt in range(1, max_retries + 1):
    # Run migration agent
    await agent.migrate(validation_errors)

    # Check if migrated_lesson.json exists
    if not migrated_path.exists():
        # Salvage logic: check if agent modified current_lesson.json in-place
        if current_lesson_valid:
            # Copy to correct location with warning
            copy(current_lesson.json, migrated_lesson.json)
        else:
            # Retry
            continue

    # Validate migrated lesson
    validation_result = validate(migrated_lesson)

    if validation_result.is_valid:
        # SUCCESS - exit retry loop
        break
    else:
        # RETRY - feed errors back to agent
        validation_errors = validation_result.errors
        write_to_workspace(validation_errors)
```

### Metadata Preservation

**Critical Fix**: Prevents corruption of SOW linkage during migration.

```python
# Before update: Extract existing metadata
existing_doc = query_appwrite(courseId, order)
existing_sow_id = existing_doc.get("authored_sow_id")
existing_sow_version = existing_doc.get("authored_sow_version")

# Preserve metadata if not explicitly provided
if not authored_sow_id:
    authored_sow_id = existing_sow_id  # Preserve
if not authored_sow_version:
    authored_sow_version = existing_sow_version  # Preserve

# Update with preserved metadata
upsert(courseId, order, lesson_data,
       authored_sow_id=authored_sow_id,
       authored_sow_version=authored_sow_version)
```

**Without this fix**:
- ❌ `authored_sow_id` → wiped to empty string
- ❌ `authored_sow_version` → changed from `1` to `v1.0`
- ❌ SOW-to-lesson linkage broken

**With this fix**:
- ✅ `authored_sow_id` → preserved from existing document
- ✅ `authored_sow_version` → preserved from existing document
- ✅ SOW-to-lesson linkage maintained

---

## Troubleshooting

### Issue 1: "migrated_lesson.json not found"

**Symptoms**:
```
✗ Attempt 3 failed: migrated_lesson.json not found
❌ Migration FAILED after 3 attempts
```

**Cause**: Agent modified `current_lesson.json` in-place instead of creating new file.

**Solution**: Salvage logic automatically detects and recovers:
```
⚠️ Agent contract violation: migrated_lesson.json not found
Checking if agent modified current_lesson.json in-place...
⚠️ AGENT CONTRACT VIOLATION: Agent modified current_lesson.json instead
🔧 Salvaging valid migration result from current_lesson.json...
✓ Salvaged migration result to migrated_lesson.json
```

**If salvage fails**: Check workspace logs, verify agent followed prompt instructions.

---

### Issue 2: "Lesson template not found"

**Symptoms**:
```
❌ Lesson order 11: Validation failed with exception:
Lesson template not found for courseId='course_c84473', order=11
```

**Cause**: No existing lesson at specified order.

**Solution**:
- Verify lesson exists in Appwrite `default.lesson_templates`
- Check `sow_order` field matches specified order
- Use dry-run to preview which lessons exist

---

### Issue 3: Metadata Corruption

**Symptoms**:
```
# Before migration
authored_sow_id: "68f3d6eacb2696fd0591"
authored_sow_version: "1"

# After migration
authored_sow_id: ""
authored_sow_version: "v1.0"
```

**Cause**: Upsert function using default parameters, overwriting existing values.

**Solution**: ✅ Fixed in `src/utils/lesson_upserter.py:157-177`
- Metadata preservation logic automatically extracts and preserves values
- Check logs for: `Preserving existing authored_sow_id: '...'`

---

### Issue 4: Validation Errors Persist

**Symptoms**:
```
✗ Validation FAILED on attempt 3: 2 errors
  - cards.4.rubric.criteria: List should have at least 1 item
  - cards.5.misconceptions.0.id: String should match pattern '^MISC_...'
```

**Cause**: Agent not following rubric/misconception format rules.

**Debug Steps**:
1. Check workspace: `workspace/migration_YYYYMMDD_HHMMSS/`
2. Read `migrated_lesson.json` to see what agent generated
3. Compare with prompt: `src/prompts/lesson_migration_prompt.md`
4. Verify validation tool is running: `http://localhost:3100/health`

**Common Fixes**:
- Rubric criteria must have ≥1 item
- Rubric total_points must equal sum of criteria points
- Misconception IDs must match pattern: `MISC_[SUBJECT]_[TOPIC]_NNN`

---

### Issue 5: Agent Runs Out of Turns

**Symptoms**:
```
Agent exceeded max_turns (100) without completing migration
```

**Cause**: Agent stuck in loop, not writing output file.

**Solution**:
- Check `src/prompts/lesson_migration_prompt.md` - ensure clear instructions
- Verify agent has Write tool permission
- Check workspace README - should match migration context
- Increase `max_turns` if lesson very complex (default: 100)

---

## Development and Testing

### Running Tests

```bash
# Single lesson migration test
python -m src.lesson_migration_claude_client \
  --courseId course_c84473 \
  --order 3

# Batch migration dry-run (no execution)
python -m src.batch_lesson_migration \
  --courseId course_c84473 \
  --dry-run

# Small batch test (3 lessons)
python -m src.batch_lesson_migration \
  --courseId course_c84473 \
  --orders 3,4,5 \
  --yes
```

### Inspecting Results

**Workspace**:
```bash
# List workspaces
ls -t workspace/migration_*/

# View latest migration workspace
cd workspace/migration_$(ls -t workspace/ | grep migration | head -1)

# Check files
cat README.md                  # Workspace documentation
cat current_lesson.json        # Input lesson
cat validation_errors.txt      # Validation errors
cat migrated_lesson.json       # Output lesson
```

**Logs**:
```bash
# View batch migration logs
tail -f logs/batch_migrations/batch_migration_YYYYMMDD_HHMMSS/order_3.log

# Check batch summary
cat logs/batch_migrations/batch_migration_YYYYMMDD_HHMMSS/batch_summary.json
```

### Debugging Failed Migrations

1. **Check pre-validation errors**:
   ```bash
   python -m src.batch_lesson_migration --courseId course_c84473 --dry-run
   ```

2. **Run single lesson with full logging**:
   ```bash
   python -m src.lesson_migration_claude_client \
     --courseId course_c84473 \
     --order 3 \
     --log-level DEBUG
   ```

3. **Inspect workspace**:
   ```bash
   cd workspace/migration_YYYYMMDD_HHMMSS
   cat validation_errors.txt          # What needs fixing
   cat migrated_lesson.json           # What agent produced
   diff current_lesson.json migrated_lesson.json  # Changes made
   ```

4. **Validate manually**:
   ```bash
   curl -X POST http://localhost:3100/validate \
     -H "Content-Type: application/json" \
     -d @workspace/migration_YYYYMMDD_HHMMSS/migrated_lesson.json
   ```

---

## Advanced Usage

### Selective Field Migration

**Use Case**: Only fix rubric fields, skip misconceptions.

**Solution**: Modify validation prompt to make misconceptions optional (requires prompt engineering).

---

### Custom Retry Limits

```python
agent = LessonMigrationClaudeAgent(
    mcp_config_path=".mcp.json",
    persist_workspace=True,
    max_retries=5  # Increase for complex lessons
)
```

---

### Integration with CI/CD

```yaml
# .github/workflows/migrate-lessons.yml
name: Migrate Lesson Templates

on:
  workflow_dispatch:
    inputs:
      courseId:
        description: 'Course ID'
        required: true
      force:
        description: 'Force re-migration of valid lessons'
        type: boolean
        default: false

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd claud_author_agent
          pip install -r requirements.txt

      - name: Run batch migration
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd claud_author_agent
          python -m src.batch_lesson_migration \
            --courseId ${{ github.event.inputs.courseId }} \
            ${{ github.event.inputs.force && '--force' || '' }} \
            --yes

      - name: Upload batch report
        uses: actions/upload-artifact@v3
        with:
          name: migration-report
          path: claud_author_agent/logs/batch_migrations/
```

---

## Comparison: Migration vs Lesson Author

| Aspect | Lesson Author | Lesson Migration |
|--------|---------------|------------------|
| **Input** | SOW entry (courseId, order) | Existing lesson template (courseId, order) |
| **Output** | Brand new lesson template | Upgraded lesson template |
| **Agent Count** | 3 (Research, Author, Critic) | 1 (Migration) |
| **Tokens** | ~45,000 tokens/lesson | ~8,000 tokens/lesson |
| **Cost** | ~$0.50-1.00/lesson | ~$0.50-0.60/lesson |
| **Duration** | ~5-8 minutes | ~2-3 minutes |
| **Validation** | Combined critic (fidelity + quality) | Pydantic schema validation |
| **Retries** | Up to 10 attempts | Up to 3 attempts |
| **Creates Content** | ✅ Explainer, CFU, all content | ❌ Only adds missing fields |
| **Preserves Content** | N/A (new lesson) | ✅ ALL existing content preserved |
| **Workspace Type** | `lesson_author` | `migration` |
| **Use Case** | Authoring new lessons | Upgrading legacy lessons |

---

## Next Steps

### After Single Lesson Migration

1. **Verify in Appwrite Console**:
   - Navigate to `default.lesson_templates`
   - Find document by `sow_order` (e.g., order=3)
   - Check `authored_sow_id` and `authored_sow_version` preserved
   - Verify cards field is compressed (gzip+base64)

2. **Test in Frontend**:
   - Load lesson in teaching interface
   - Verify rubrics display correctly
   - Check misconceptions are accessible
   - Confirm no content corruption

3. **Run Batch Migration**:
   ```bash
   python -m src.batch_lesson_migration \
     --courseId course_c84473 \
     --dry-run  # Preview first

   python -m src.batch_lesson_migration \
     --courseId course_c84473 \
     --yes      # Execute after review
   ```

---

### After Batch Migration

1. **Review Batch Summary**:
   ```bash
   cat logs/batch_migrations/batch_migration_YYYYMMDD_HHMMSS/batch_summary.json
   ```

2. **Check Failed Migrations**:
   ```bash
   # List failed lessons
   jq '.results[] | select(.status == "FAILED")' batch_summary.json

   # Inspect failed lesson logs
   cat logs/batch_migrations/batch_migration_YYYYMMDD_HHMMSS/order_7.log
   ```

3. **Retry Failed Lessons**:
   ```bash
   python -m src.batch_lesson_migration \
     --courseId course_c84473 \
     --orders 3,7,9 \
     --yes
   ```

4. **Validate All Lessons**:
   ```bash
   python -m src.batch_lesson_migration \
     --courseId course_c84473 \
     --dry-run  # Should show all valid
   ```

---

## Documentation

- **Migration Prompt**: `src/prompts/lesson_migration_prompt.md`
- **Implementation**: `src/lesson_migration_claude_client.py`
- **Batch CLI**: `src/batch_lesson_migration.py`
- **Upserter**: `src/utils/lesson_upserter.py`
- **Validator**: `src/utils/diagram_validator.py` (uses `LessonTemplate` Pydantic model)
- **Workspace Utils**: `src/utils/filesystem.py` (generalized for all agents)

---

## Support

### Getting Help

- **Issues**: Check logs in `workspace/migration_YYYYMMDD_HHMMSS/` or `logs/batch_migrations/`
- **Validation Errors**: Refer to `src/tools/json_validator_tool.py` for schema details
- **Prompt Engineering**: Review `src/prompts/lesson_migration_prompt.md`
- **Architecture Questions**: See [Architecture](#architecture) section

### Common Questions

**Q: Why does migration take 2-3 minutes per lesson?**
A: Agent must read lesson, analyze validation errors, generate rubrics/misconceptions, validate output. Includes retry logic for robustness.

**Q: Can I migrate lessons without SOW linkage?**
A: Yes, but `authored_sow_id` and `authored_sow_version` will be empty. Migration focuses on schema compliance, not SOW updates.

**Q: What if a lesson has custom fields not in schema?**
A: Migration preserves ALL existing fields, adds only missing required fields. Custom fields remain unchanged.

**Q: Can I rollback a migration?**
A: Workspace is preserved with original lesson in `current_lesson.json`. You can manually restore from workspace or re-author from SOW.

**Q: How do I migrate lessons across multiple courses?**
A: Run batch migration once per course:
```bash
for courseId in course_c84473 course_c84474 course_c84475; do
  python -m src.batch_lesson_migration --courseId $courseId --yes
done
```

---

## License

Internal tool for Scottish AI Lessons development. Not licensed for external use.
