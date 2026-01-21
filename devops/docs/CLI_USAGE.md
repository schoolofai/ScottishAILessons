# DevOps Pipeline CLI Reference

> Complete CLI reference for the Content Authoring Pipeline

---

## Table of Contents

- [Quick Start](#quick-start)
- [Entry Points](#entry-points)
- [Commands](#commands)
- [Options Reference](#options-reference)
- [Subject & Level Reference](#subject--level-reference)
- [Common Workflows](#common-workflows)
- [Resume & Recovery](#resume--recovery)
- [Environment Variables](#environment-variables)
- [Exit Codes](#exit-codes)

---

## Quick Start

```bash
# New course creation
./devops/pipeline.sh lessons --subject mathematics --level national_5

# Resume a failed pipeline
./devops/pipeline.sh lessons --resume 20260121_143022

# List all runs
./devops/pipeline.sh list
```

---

## Entry Points

The pipeline has two entry points:

| Entry Point | Description | Use Case |
|-------------|-------------|----------|
| `./devops/pipeline.sh` | Shell wrapper | Recommended - handles venv activation and env loading |
| `python devops/pipeline_runner.py` | Direct Python | When venv is already activated |

### Shell Wrapper (`pipeline.sh`)

The shell wrapper automatically:
1. Activates the correct Python virtual environment
2. Loads environment variables from `.env` files
3. Unsets `ANTHROPIC_API_KEY` to use subscription
4. Validates required dependencies

```bash
./devops/pipeline.sh <command> [options]
```

### Direct Python (`pipeline_runner.py`)

Use when you've already activated the virtual environment:

```bash
source claud_author_agent/.venv/bin/activate
python devops/pipeline_runner.py <command> [options]
```

---

## Commands

### `lessons` - Run Course Creation Pipeline

Creates a complete course: seed → SOW → lessons → diagrams

```bash
./devops/pipeline.sh lessons --subject <subject> --level <level> [options]
```

**Required arguments (for new runs):**
- `--subject` - SQA subject name
- `--level` - SQA qualification level

**Example:**
```bash
./devops/pipeline.sh lessons --subject mathematics --level national_5
```

### `list` - List All Pipeline Runs

Shows all pipeline runs with their status, subject, level, and cost.

```bash
./devops/pipeline.sh list
```

**Output:**
```
================================================================================
PIPELINE RUNS
================================================================================

Run ID               Subject         Level        Status       Cost
--------------------------------------------------------------------------------
20260121_143022      mathematics     national_5   completed    $28.60
20260120_091500      physics         higher       failed       $12.35
20260119_160000      chemistry       n5           in_progress  $5.20
--------------------------------------------------------------------------------
Total runs: 3

Resumable runs (2):
  - 20260120_091500: physics/higher (last: lessons)
  - 20260119_160000: chemistry/n5 (last: sow)

Resume with: python pipeline_runner.py lessons --resume <run_id>
```

### `help` - Show Detailed Help

Displays comprehensive help with examples.

```bash
./devops/pipeline.sh help
```

---

## Options Reference

### `--subject <subject>`

**Description:** SQA subject for course creation

**Accepts:** Canonical names or aliases (see [Subject Reference](#subjects))

**Examples:**
```bash
--subject mathematics
--subject math          # Alias for mathematics
--subject aom           # Alias for application_of_mathematics
```

### `--level <level>`

**Description:** SQA qualification level

**Accepts:** Canonical names or aliases (see [Level Reference](#levels))

**Examples:**
```bash
--level national_5
--level n5              # Alias for national_5
--level higher
--level ah              # Alias for advanced_higher
```

### `--resume <run_id>`

**Description:** Resume a failed or interrupted pipeline from its checkpoint

**Format:** `YYYYMMDD_HHMMSS` (automatically generated for each run)

**Notes:**
- Loads all configuration from the checkpoint (subject, level, etc.)
- Starts from the first incomplete step
- Can combine with runtime flags like `--skip-diagrams`

**Example:**
```bash
./devops/pipeline.sh lessons --resume 20260121_143022
```

### `--dry-run`

**Description:** Preview pipeline execution without actually running steps

**Use Cases:**
- Validate configuration before long-running execution
- Check which steps would be executed
- Test resume behavior

**Example:**
```bash
./devops/pipeline.sh lessons --subject physics --level higher --dry-run
```

### `--skip-diagrams`

**Description:** Skip the diagram generation step (Step 4)

**Use Cases:**
- Diagram service not available
- Diagrams not needed for testing
- Faster iteration during development

**Example:**
```bash
./devops/pipeline.sh lessons --subject chemistry --level n5 --skip-diagrams
```

### `--skip-seed-sow`

**Description:** Skip SEED and SOW steps, start directly from lesson generation

**Prerequisites:**
- Course must exist in `default.courses` collection
- SOW must exist in `default.Authored_SOW` collection

**Use Cases:**
- Course and SOW already exist from previous run
- Only need to regenerate lessons
- Iterating on lesson quality

**Example:**
```bash
./devops/pipeline.sh lessons --subject application_of_mathematics --level higher --skip-seed-sow
```

**Error if prerequisites not met:**
```
No course found for subject=gaelic, level=advanced_higher.
Run without --skip-seed-sow to seed the course first.
```

### `--force`

**Description:** Force regeneration of existing content (ignores skip logic)

**Affects:**
- Lesson generation: Regenerates lessons even if they exist
- Diagram generation: Regenerates diagrams even if they exist

**Warning:** This is expensive! Use only when you need to fully regenerate.

**Example:**
```bash
./devops/pipeline.sh lessons --subject mathematics --level national_5 --force
```

### `--diagram-timeout <seconds>`

**Description:** Timeout in seconds for diagram service health check

**Default:** `60`

**Example:**
```bash
./devops/pipeline.sh lessons --subject physics --level higher --diagram-timeout 120
```

### `--iterative` (default)

**Description:** Use iterative lesson-by-lesson SOW authoring

**Benefits:**
- Better Pydantic schema compliance
- Smaller context per generation (~4K tokens vs ~50K+)
- Cross-lesson coherence validation
- Easier debugging (per-lesson workspace files)

**Example:**
```bash
./devops/pipeline.sh lessons --subject mathematics --level national_5 --iterative
```

### `--legacy`

**Description:** Use legacy monolithic SOW authoring (backward compatibility)

**Use Cases:**
- Debugging issues with iterative mode
- Comparing output quality
- Backward compatibility

**Example:**
```bash
./devops/pipeline.sh lessons --subject chemistry --level n5 --legacy
```

### `--version <version>`

**Description:** SOW version number to generate

**Default:** `1`

**Example:**
```bash
./devops/pipeline.sh lessons --subject physics --level higher --version 2
```

---

## Subject & Level Reference

### Subjects

| Canonical Name | Aliases |
|----------------|---------|
| `mathematics` | `math`, `maths` |
| `application_of_mathematics` | `aom`, `app_math`, `application-of-mathematics` |
| `applications_of_mathematics` | `aoms`, `apps_math`, `applications-of-mathematics` |
| `physics` | `phys` |
| `chemistry` | `chem` |
| `biology` | `bio` |
| `computing_science` | `computing`, `cs`, `computing-science` |
| `english` | `eng` |
| `history` | `hist` |
| `geography` | `geo` |
| `modern_studies` | `modern-studies`, `ms` |
| `music` | - |
| `art` | `art_and_design` |
| `drama` | - |
| `french` | - |
| `german` | - |
| `spanish` | - |
| `gaelic` | - |

### Levels

| Canonical Name | Aliases |
|----------------|---------|
| `national_3` | `national-3`, `n3`, `nat3` |
| `national_4` | `national-4`, `n4`, `nat4` |
| `national_5` | `national-5`, `n5`, `nat5` |
| `higher` | `h`, `high` |
| `advanced_higher` | `advanced-higher`, `ah`, `adv_higher` |

---

## Common Workflows

### 1. Create a New Course (Full Pipeline)

```bash
# Full course creation from scratch
./devops/pipeline.sh lessons --subject mathematics --level national_5
```

**Steps executed:**
1. **SEED** (~3 seconds) - Seeds course + outcomes from SQA data
2. **SOW** (~5 minutes) - Generates Scheme of Work via Claude Agent
3. **LESSONS** (~1-2 hours) - Generates all lesson content
4. **DIAGRAMS** (~30-60 minutes) - Generates diagrams for lessons

### 2. Resume After Failure

```bash
# 1. List runs to find the failed run_id
./devops/pipeline.sh list

# 2. Resume the failed run
./devops/pipeline.sh lessons --resume 20260121_143022
```

### 3. Skip Steps for Faster Iteration

```bash
# Skip diagrams (faster, no external service needed)
./devops/pipeline.sh lessons --subject physics --level higher --skip-diagrams

# Skip seed+SOW (when course already exists)
./devops/pipeline.sh lessons --subject aom --level higher --skip-seed-sow

# Combine: skip both seed+SOW and diagrams
./devops/pipeline.sh lessons --subject chemistry --level n5 --skip-seed-sow --skip-diagrams
```

### 4. Force Regeneration

```bash
# Regenerate all lessons and diagrams for existing course
./devops/pipeline.sh lessons --subject mathematics --level national_5 --skip-seed-sow --force
```

### 5. Test Configuration (Dry Run)

```bash
# Preview what would happen without executing
./devops/pipeline.sh lessons --subject physics --level higher --dry-run
```

### 6. Use Legacy SOW Authoring

```bash
# If iterative mode has issues, use legacy mode
./devops/pipeline.sh lessons --subject chemistry --level n5 --legacy
```

---

## Resume & Recovery

### How Checkpointing Works

The pipeline saves state after each step completion:

```
devops/checkpoints/{run_id}/
├── checkpoint.json       # Current state (resumable)
├── seed_result.json      # Step outputs
├── sow_result.json
├── lessons_result.json
└── diagrams_result.json
```

### Finding Resumable Runs

```bash
# List all runs - shows resumable ones at the bottom
./devops/pipeline.sh list
```

**Resumable statuses:**
- `failed` - Pipeline failed at a step
- `in_progress` - Pipeline was interrupted

### Resume Command

```bash
./devops/pipeline.sh lessons --resume <run_id>
```

**What gets restored:**
- Subject and level
- Course ID (if seed completed)
- Last completed step

**What can be changed on resume:**
- `--skip-diagrams` - Can add to skip remaining diagram step
- `--force` - Can add to force regeneration
- `--diagram-timeout` - Can adjust timeout

### Manual Checkpoint Inspection

```bash
# View checkpoint state
cat devops/checkpoints/20260121_143022/checkpoint.json | jq .

# View step result
cat devops/checkpoints/20260121_143022/lessons_result.json | jq .
```

---

## Environment Variables

### Required for Appwrite

| Variable | Description |
|----------|-------------|
| `APPWRITE_ENDPOINT` | Appwrite database endpoint |
| `APPWRITE_PROJECT_ID` | Appwrite project ID |
| `APPWRITE_API_KEY` | Appwrite API key |

### Optional

| Variable | Description |
|----------|-------------|
| `LANGSMITH_API_KEY` | Enable LangSmith tracing |
| `LANGSMITH_TRACING` | Set to `true` to enable tracing |

### Environment File Loading

The shell wrapper loads from these locations (in order):
1. `$PROJECT_ROOT/.env`
2. `$PROJECT_ROOT/claud_author_agent/.env`
3. `$SCRIPT_DIR/.env`

**Note:** `ANTHROPIC_API_KEY` is automatically unset to use subscription mode.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Failure (check logs) |

---

## Directory Structure

```
devops/
├── pipeline.sh              # Shell wrapper (recommended entry point)
├── pipeline_runner.py       # Python orchestrator
├── lib/                     # Core modules
│   ├── checkpoint_manager.py
│   ├── step_runner.py
│   ├── observability.py
│   ├── diagram_service.py
│   └── validators.py
├── checkpoints/             # Pipeline state (auto-created)
│   └── {run_id}/
│       └── checkpoint.json
├── reports/                 # JSON reports (auto-created)
│   └── {run_id}/
│       ├── summary.json
│       ├── metrics.json
│       └── events.jsonl
├── logs/                    # Execution logs (auto-created)
│   └── {run_id}/
│       ├── pipeline.log
│       └── steps/
│           ├── seed.log
│           ├── sow.log
│           ├── lessons.log
│           └── diagrams.log
└── docs/                    # Documentation
    └── CLI_USAGE.md         # This file
```

---

## Cost Estimates

| Step | Time | Estimated Cost |
|------|------|----------------|
| Seed | 2-3 seconds | Free |
| SOW | 3-5 minutes | ~$2 |
| Lessons (20) | 1-2 hours | ~$20 |
| Diagrams (20) | 30-60 min | ~$10 |
| **Total** | **2-4 hours** | **~$32** |

---

## Troubleshooting

### "No course found for subject=X, level=Y"

**Cause:** Using `--skip-seed-sow` but course doesn't exist

**Fix:** Run without `--skip-seed-sow` to seed the course first

### "Diagram screenshot service not available"

**Cause:** Diagram service not running

**Fix:**
```bash
cd diagramScreenshot && docker-compose up -d
```
Or use `--skip-diagrams` flag

### "Invalid run_id format"

**Cause:** Typo in resume run_id

**Fix:** Use `./devops/pipeline.sh list` to see correct run_ids

### "Attribute not found in schema"

**Cause:** Schema mismatch (camelCase vs snake_case)

**Fix:** Check that query attributes match Appwrite schema (use camelCase like `lessonTemplateId`)

---

## Examples Summary

```bash
# New full course
./devops/pipeline.sh lessons --subject mathematics --level national_5

# Resume failed run
./devops/pipeline.sh lessons --resume 20260121_143022

# Skip diagrams
./devops/pipeline.sh lessons --subject physics --level h --skip-diagrams

# Skip seed+SOW (existing course)
./devops/pipeline.sh lessons --subject aom --level higher --skip-seed-sow

# Force regeneration
./devops/pipeline.sh lessons --subject math --level n5 --skip-seed-sow --force

# Dry run (preview)
./devops/pipeline.sh lessons --subject chemistry --level national_5 --dry-run

# Legacy SOW mode
./devops/pipeline.sh lessons --subject biology --level higher --legacy

# List all runs
./devops/pipeline.sh list

# Show help
./devops/pipeline.sh help
```
