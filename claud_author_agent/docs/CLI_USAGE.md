# Author Agents CLI Usage Guide

> **Quick Reference:** All 8 author agents for the Scottish AI Lessons content authoring pipeline.

---

## Table of Contents

1. [Quick Reference (Most Common Usage)](#quick-reference-most-common-usage)
2. [SOW Author](#1-sow-author)
3. [Lesson Author](#2-lesson-author)
4. [Diagram Author](#3-diagram-author)
5. [Practice Question Author](#4-practice-question-author)
6. [Revision Notes Author](#5-revision-notes-author)
7. [Mock Exam Author (< Nat5)](#6-mock-exam-author--nat5)
8. [Nat5+ Exam Author](#7-nat5-exam-author)
9. [Walkthrough Author (Past Papers)](#8-walkthrough-author-past-papers)
10. [Common Patterns](#common-patterns)
11. [Workflow Examples](#workflow-examples)

---

## Quick Reference (Most Common Usage)

> **Copy-paste ready commands for the most frequent operations.**

```bash
# Navigate to author agents directory first
cd /path/to/ScottishAILessons/claud_author_agent

# ═══════════════════════════════════════════════════════════════════════════════
# COURSE CONTENT AUTHORING (run in order)
# ═══════════════════════════════════════════════════════════════════════════════

# 1. SOW Author - Generate Scheme of Work for a course
python -m src.sow_author_cli --courseId course_c84474

# 2. Lesson Author - Generate lesson template (single lesson)
python -m src.lesson_author_cli --courseId course_c84474 --order 1

# 2b. Lesson Author - Batch mode (all lessons in course)
python -m src.batch_lesson_generator --courseId course_c84474

# 3. Diagram Author - Generate diagrams for a lesson
python -m src.diagram_author_cli --courseId course_c84474 --order 1

# 4. Practice Questions - Generate for a single lesson
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817

# 4b. Practice Questions - Batch mode (all lessons in course)
python -m src.practice_question_author_cli --course-id course_c84474

# 5. Revision Notes - Generate from published SOW
python scripts/notes_author_cli.py --courseId course_c84474

# ═══════════════════════════════════════════════════════════════════════════════
# EXAM AUTHORING
# ═══════════════════════════════════════════════════════════════════════════════

# Mock Exam (National 3, National 4)
python scripts/run_mock_exam_author.py --course course_c84473

# Nat5+ Exam (National 5, Higher, Advanced Higher) - Calculator paper
python -m src.nat5_plus.exam_generator_client generate \
  --course-id course_nat5_maths \
  --workspace ./workspaces/exam_001 \
  --calculator true

# Nat5+ Exam - Non-calculator paper
python -m src.nat5_plus.exam_generator_client generate \
  --course-id course_nat5_maths \
  --workspace ./workspaces/exam_002 \
  --calculator false

# ═══════════════════════════════════════════════════════════════════════════════
# PAST PAPER WALKTHROUGH AUTHORING
# ═══════════════════════════════════════════════════════════════════════════════

# Walkthrough Author - Generate walkthrough for a single question
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01 \
  --question 1

# Walkthrough Author - Batch mode (all questions in a paper)
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01

# Walkthrough Author - Batch by subject/level (all papers)
python -m src.batch_walkthrough_generator \
  --subject Mathematics --level "National 5"

# Walkthrough Author - Dry run (preview without generating)
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01 --dry-run
```

---

## 1. SOW Author

**Purpose:** Generate Scheme of Work (SOW) entries for a course. The SOW defines the lesson sequence, topics, and learning outcomes.

**CLI Command:**
```bash
python -m src.sow_author_cli [OPTIONS]
```

### Input Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| CLI args | `--courseId course_c84474` | Direct command-line input |
| JSON file | `--input input.json` | Load from JSON file |
| Interactive | *(no args)* | Prompted input |

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--courseId` | string | - | Course ID (must exist in `default.courses`) |
| `--input` | file path | - | JSON file with `{"courseId": "..."}` |
| `--version` | string | `"1"` | SOW version number |
| `--force` | flag | `false` | Overwrite existing SOW for this version |
| `--iterative` | flag | `true` | Use lesson-by-lesson authoring (better schema compliance) |
| `--legacy` | flag | `false` | Use original monolithic authoring |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--no-persist-workspace` | flag | `false` | Delete workspace after execution |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### Usage Examples

```bash
# Basic usage - generate SOW v1
python -m src.sow_author_cli --courseId course_c84474

# Generate SOW v2 for same course
python -m src.sow_author_cli --courseId course_c84474 --version 2

# Force overwrite existing SOW v1
python -m src.sow_author_cli --courseId course_c84474 --version 1 --force

# Use legacy monolithic mode (backward compatibility)
python -m src.sow_author_cli --courseId course_c84474 --legacy

# Debug mode with workspace preserved
python -m src.sow_author_cli --courseId course_c84474 --log-level DEBUG

# Clean up workspace after execution
python -m src.sow_author_cli --courseId course_c84474 --no-persist-workspace

# JSON file input
echo '{"courseId": "course_c84474"}' > input.json
python -m src.sow_author_cli --input input.json

# Interactive mode (prompts for courseId)
python -m src.sow_author_cli
```

### Output

- **Appwrite Collection:** `default.Authored_SOW`
- **Workspace:** `workspace/<execution_id>/` (preserved by default)

---

## 2. Lesson Author

**Purpose:** Generate detailed lesson templates from SOW entries. Each lesson includes teaching cards, CFU (Check For Understanding) questions, and learning activities.

**CLI Command:**
```bash
python -m src.lesson_author_cli [OPTIONS]
```

### Input Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| CLI args | `--courseId course_c84474 --order 1` | Direct command-line input |
| JSON file | `--input input.json` | Load from JSON file |
| Interactive | *(no args)* | Prompted input |

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--courseId` | string | - | Course ID |
| `--order` | int | - | SOW entry order (1-indexed, starts from 1) |
| `--input` | file path | - | JSON file with `{"courseId": "...", "order": N}` |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--max-retries` | int | `10` | Maximum critic retry attempts |
| `--no-persist-workspace` | flag | `false` | Delete workspace after execution |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### Usage Examples

```bash
# Generate lesson template for first SOW entry
python -m src.lesson_author_cli --courseId course_c84474 --order 1

# Generate lesson template for fifth entry
python -m src.lesson_author_cli --courseId course_c84474 --order 5

# With custom retry limit
python -m src.lesson_author_cli --courseId course_c84474 --order 1 --max-retries 15

# Debug mode
python -m src.lesson_author_cli --courseId course_c84474 --order 1 --log-level DEBUG

# JSON file input
echo '{"courseId": "course_c84474", "order": 1}' > input.json
python -m src.lesson_author_cli --input input.json

# Interactive mode
python -m src.lesson_author_cli
```

### Output

- **Appwrite Collection:** `default.lesson_templates`
- **Workspace:** `workspace/<execution_id>/` (preserved by default)

---

### Batch Lesson Generator

**Purpose:** Generate lesson templates for ALL SOW entries in a course with smart skip logic, dry-run preview, and batch delete capabilities.

**CLI Command:**
```bash
python -m src.batch_lesson_generator [OPTIONS]
```

#### Smart Behavior

- **Default mode:** Generates only missing lessons (skips existing `claud_Agent_sdk` lessons)
- **Force mode:** Regenerates ALL lessons regardless of existing state
- **Delete mode:** Removes lessons and associated diagrams

#### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--courseId` | string | **required** | Course ID |
| `--dry-run` | flag | `false` | Preview plan without executing |
| `--force` | flag | `false` | Overwrite ALL existing lessons |
| `--delete` | flag | `false` | Delete all lessons and diagrams (DESTRUCTIVE) |
| `--all-versions` | flag | `false` | Delete all versions (not just `claud_Agent_sdk`) |
| `--yes` | flag | `false` | Skip confirmation prompts (for CI/CD) |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--max-retries` | int | `10` | Max critic retries per lesson |
| `--no-persist-workspace` | flag | `false` | Clean up workspaces after each lesson |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

#### Usage Examples

```bash
# Preview what will be generated (dry-run)
python -m src.batch_lesson_generator --courseId course_c84474 --dry-run

# Generate missing lessons (default - skips existing)
python -m src.batch_lesson_generator --courseId course_c84474

# Force regenerate ALL lessons
python -m src.batch_lesson_generator --courseId course_c84474 --force

# Automated CI/CD (skip confirmation)
python -m src.batch_lesson_generator --courseId course_c84474 --force --yes

# Preview deletion (dry-run)
python -m src.batch_lesson_generator --courseId course_c84474 --delete --dry-run

# Delete lessons with confirmation prompt
python -m src.batch_lesson_generator --courseId course_c84474 --delete

# Delete without confirmation (CI/CD)
python -m src.batch_lesson_generator --courseId course_c84474 --delete --yes

# Delete ALL lesson versions (not just claud_Agent_sdk)
python -m src.batch_lesson_generator --courseId course_c84474 --delete --all-versions
```

#### Output

- **Log Directory:** `logs/batch_runs/<batch_id>/`
  - `batch_execution.log` - Overall batch progress
  - `lesson_order_001.log` - Per-lesson execution logs
  - `batch_summary.json` - Final summary with metrics
  - `dry_run_plan.json` - Plan output (dry-run mode)

---

## 3. Diagram Author

**Purpose:** Generate lesson diagrams (visual aids) for teaching cards. Creates both lesson context diagrams and CFU question diagrams.

**CLI Command:**
```bash
python -m src.diagram_author_cli [OPTIONS]
```

### Prerequisites

- **DiagramScreenshot service** must be running at `http://localhost:3001`
  ```bash
  cd diagram-prototypes && docker compose up -d
  ```

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--courseId` | string | **required** | Course ID |
| `--order` | int | **required** | Lesson order (1-indexed) |
| `--card-order` | int | - | [EXPERIMENTAL] Single card diagrams (1-indexed) |
| `--force` | flag | `false` | Delete and regenerate existing diagrams |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--no-persist-workspace` | flag | `false` | Delete workspace after execution |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `--input` | file path | - | [US4 - Not yet implemented] |

### Usage Examples

```bash
# Generate diagrams for lesson 1
python -m src.diagram_author_cli --courseId course_c84474 --order 1

# Force regenerate existing diagrams
python -m src.diagram_author_cli --courseId course_c84474 --order 1 --force

# Generate diagrams for a single card only (experimental)
python -m src.diagram_author_cli --courseId course_c84474 --order 1 --card-order 3

# Debug mode
python -m src.diagram_author_cli --courseId course_c84474 --order 1 --log-level DEBUG

# Custom MCP config
python -m src.diagram_author_cli --courseId course_c84474 --order 1 --mcp-config .mcp.custom.json
```

### Output

- **Appwrite Collection:** `default.lesson_diagrams`
- **Appwrite Storage:** Diagram images stored in dedicated bucket
- **Workspace:** `workspace/<execution_id>/` (preserved by default)

---

## 4. Practice Question Author

**Purpose:** Generate pre-cached practice questions for the Infinite Practice V2 system. Questions are organized into blocks by topic and difficulty.

**CLI Command:**
```bash
python -m src.practice_question_author_cli [OPTIONS]
```

### Smart Automatic Behavior

The author detects existing content and acts accordingly:
- **No content exists:** Full pipeline (blocks + questions + diagrams)
- **Content exists, no diagrams:** Diagrams only
- **Everything exists:** Skip (use `--regenerate` to force)

### Prerequisites

- Diagram services must be running for diagram generation
- Integration tests run automatically (skip with `--skip-integration-tests`)

### Input Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| Single lesson | `--lesson-id <id>` | Process one lesson template |
| Batch mode | `--course-id <id>` | Process all lessons in course |
| JSON file | `--input input.json` | Load from JSON file |
| Interactive | *(no args)* | Prompted input |

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--lesson-id` | string | - | Single lesson template ID |
| `--course-id` | string | - | Course ID for batch mode |
| `--input` | file path | - | JSON file input |
| `--easy` | int | `5` | Number of easy questions per block |
| `--medium` | int | `5` | Number of medium questions per block |
| `--hard` | int | `3` | Number of hard questions per block |
| `--regenerate` | flag | `false` | Delete and regenerate all content |
| `--max-concurrent` | int | `1` | Parallel lessons (1=sequential, 3-5 for parallel) |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--no-persist-workspace` | flag | `false` | Delete workspace after execution |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `--skip-integration-tests` | flag | `false` | Skip pre-execution tests (risky) |

### Usage Examples

```bash
# Single lesson (auto-detects what needs generating)
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817

# Batch mode - sequential (default, safer)
python -m src.practice_question_author_cli --course-id course_c84474

# Batch mode - parallel execution (faster)
python -m src.practice_question_author_cli --course-id course_c84474 --max-concurrent 3

# Force regenerate everything
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817 --regenerate

# Custom question counts
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817 \
  --easy 10 --medium 8 --hard 5

# Skip integration tests (not recommended)
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817 \
  --skip-integration-tests

# Interactive mode
python -m src.practice_question_author_cli
```

### Output

- **Appwrite Collections:**
  - `default.practice_blocks` - Question blocks by topic
  - `default.practice_questions` - Individual questions with metadata
- **Workspace:** `workspace/<execution_id>/` or `workspace/<batch_id>/` (preserved by default)

---

## 5. Revision Notes Author

**Purpose:** Generate revision notes (course cheat sheet + per-lesson notes) from published SOW and lesson templates.

**CLI Command:**
```bash
python scripts/notes_author_cli.py [OPTIONS]
```

### Prerequisites

- SOW must have `status='published'` in `Authored_SOW` collection
- Lesson templates must exist for the course

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--courseId` | string | **required** | Course ID |
| `--version` | string | `"1"` | SOW version to use |
| `--force` | flag | `false` | Overwrite existing revision notes |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--persist-workspace` | flag | `false` | Keep workspace for debugging |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### Usage Examples

```bash
# Generate revision notes
python scripts/notes_author_cli.py --courseId course_c84474

# Force overwrite existing notes
python scripts/notes_author_cli.py --courseId course_c84474 --force

# Use specific SOW version
python scripts/notes_author_cli.py --courseId course_c84474 --version 2

# Debug mode with workspace preserved
python scripts/notes_author_cli.py --courseId course_c84474 --persist-workspace --log-level DEBUG
```

### Output

- **Appwrite Collection:** `default.revision_notes`
- **Appwrite Storage:** Markdown files in `documents` bucket
- **Generated Documents:**
  - 1x Course cheat sheet
  - Nx Per-lesson notes

---

## 6. Mock Exam Author (< Nat5)

**Purpose:** Generate mock exams for **National 3** and **National 4** levels. Uses a section-based parallel architecture.

**CLI Command:**
```bash
python scripts/run_mock_exam_author.py [OPTIONS]
```

### Prerequisites

- Published SOW with `mock_exam` entry type
- Diagram services running (for question diagrams)

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--course`, `-c` | string | **required** | Course ID |
| `--version`, `-v` | string | `"1"` | Mock exam version |
| `--force`, `-f` | flag | `false` | Overwrite existing mock exam |
| `--dry-run`, `-n` | flag | `false` | Generate but don't save to Appwrite |
| `--log-level`, `-l` | choice | `DEBUG` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--no-persist` | flag | `false` | Clean up workspace after execution |
| `--output`, `-o` | file path | - | Write result JSON to file |

### Usage Examples

```bash
# Basic mock exam generation
python scripts/run_mock_exam_author.py --course course_c84473

# Dry run (generate without saving)
python scripts/run_mock_exam_author.py --course course_c84473 --dry-run

# Force overwrite existing v1
python scripts/run_mock_exam_author.py --course course_c84473 --force

# Generate v2
python scripts/run_mock_exam_author.py --course course_c84473 --version 2

# Quieter output
python scripts/run_mock_exam_author.py --course course_c84473 --log-level INFO

# Save result to file
python scripts/run_mock_exam_author.py --course course_c84473 --output result.json
```

### Pipeline Steps

1. **PRE-PROCESSING:** Extract data, verify services
2. **AUTHOR-CRITIC:** Generate mock exam with quality iteration
3. **CLASSIFICATION:** Classify questions for diagram tools
4. **DIAGRAM AUTHORING:** Generate diagrams iteratively
5. **UPSERT:** Save to Appwrite database

### Output

- **Appwrite Collection:** `default.mock_exams`
- **Workspace:** `workspace/<execution_id>/` (preserved by default)

---

## 7. Nat5+ Exam Author

**Purpose:** Generate mock exams for **National 5**, **Higher**, and **Advanced Higher** levels. Uses a question-by-question parallel architecture with full SQA-style marking schemes.

**CLI Command:**
```bash
python -m src.nat5_plus.exam_generator_client <COMMAND> [OPTIONS]
```

### Subcommands

| Command | Purpose |
|---------|---------|
| `generate` | Create a new mock exam |
| `list` | List existing exams |
| `delete` | Delete an exam and its summary |
| `regenerate-diagram` | Regenerate diagram for a single question |

### Generate Command

```bash
python -m src.nat5_plus.exam_generator_client generate [OPTIONS]
```

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--course-id` | string | **required** | Target course ID |
| `--workspace` | path | **required** | Output directory for intermediate files |
| `--calculator` | bool | **required** | `true` for calculator paper, `false` for non-calculator |
| `--target-marks` | int | `90` | Total marks target |
| `--target-questions` | int | `15` | Number of questions target |
| `--force-regenerate` | flag | `false` | Skip uniqueness checks |
| `--dry-run` | flag | `false` | Generate without upserting to Appwrite |

### List Command

```bash
python -m src.nat5_plus.exam_generator_client list [OPTIONS]
```

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--course-id` | string | - | Filter by course ID (optional) |

### Delete Command

```bash
python -m src.nat5_plus.exam_generator_client delete [OPTIONS]
```

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--exam-id` | string | **required** | Document ID of exam to delete |

### Regenerate Diagram Command

```bash
python -m src.nat5_plus.exam_generator_client regenerate-diagram [OPTIONS]
```

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--workspace`, `-w` | path | **required** | Path to existing exam workspace |
| `--question-id`, `-q` | string | **required** | Question ID (e.g., `q8`) |
| `--max-iterations` | int | `3` | Max critique iterations |
| `--max-turns` | int | `200` | Max LLM turns per iteration |
| `--force-tool` | choice | - | Override tool: `MATPLOTLIB`, `DESMOS`, `JSXGRAPH`, `PLOTLY`, `IMAGE_GENERATION` |

### Usage Examples

```bash
# Generate calculator paper
python -m src.nat5_plus.exam_generator_client generate \
  --course-id course_nat5_maths \
  --workspace ./workspaces/nat5_calc_001 \
  --calculator true

# Generate non-calculator paper
python -m src.nat5_plus.exam_generator_client generate \
  --course-id course_nat5_maths \
  --workspace ./workspaces/nat5_noncalc_001 \
  --calculator false

# Custom marks and questions
python -m src.nat5_plus.exam_generator_client generate \
  --course-id course_higher_maths \
  --workspace ./workspaces/higher_001 \
  --calculator true \
  --target-marks 100 \
  --target-questions 18

# Dry run (no Appwrite save)
python -m src.nat5_plus.exam_generator_client generate \
  --course-id course_nat5_maths \
  --workspace ./workspaces/test_001 \
  --calculator true \
  --dry-run

# List all exams
python -m src.nat5_plus.exam_generator_client list

# List exams for specific course
python -m src.nat5_plus.exam_generator_client list --course-id course_nat5_maths

# Delete an exam
python -m src.nat5_plus.exam_generator_client delete --exam-id exam_doc_123

# Regenerate diagram for a question
python -m src.nat5_plus.exam_generator_client regenerate-diagram \
  --workspace ./workspaces/nat5_calc_001 \
  --question-id q8

# Regenerate with different tool
python -m src.nat5_plus.exam_generator_client regenerate-diagram \
  --workspace ./workspaces/nat5_calc_001 \
  --question-id q8 \
  --force-tool JSXGRAPH
```

### Comparison: Mock Exam vs Nat5+ Author

| Aspect | Mock Exam (< Nat5) | Nat5+ Exam Author |
|--------|-------------------|-------------------|
| **Target Levels** | National 3, National 4 | National 5, Higher, Advanced Higher |
| **Input** | SOW `mock_exam` entry | SOW topics + past papers |
| **Architecture** | Section-based (parallel) | Question-by-question (parallel batches) |
| **Marking Schemes** | Basic structure | Full SQA-style (generic + illustrative) |
| **Past Papers** | Optional | Required as templates |
| **CLI Operations** | Generate only | Generate, List, Delete, Regenerate-diagram |
| **Calculator Support** | N/A | Required (true/false) |

### Output

- **Appwrite Collection:** `default.nat5_plus_mock_exams`
- **Workspace:** Specified by `--workspace` argument
  - `questions/` - Individual question JSON files
  - `mock_exam.json` - Complete assembled exam

---

## 8. Walkthrough Author (Past Papers)

**Purpose:** Generate student-facing step-by-step walkthroughs for SQA past paper questions. Transforms marking schemes from `us_papers` into pedagogical content in `us_walkthroughs` with common errors, examiner insights, and LaTeX-formatted solutions.

**CLI Command:**
```bash
python -m src.batch_walkthrough_generator [OPTIONS]
```

### Architecture

The Walkthrough Author uses a **3-subagent pipeline** powered by Claude Agent SDK:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Walkthrough    │ ──► │  Common Errors  │ ──► │  Walkthrough    │
│    Author       │     │   Subagent      │     │    Critic       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      │                        │                        │
      ▼                        ▼                        ▼
  Generate steps         Add 2-4 common          Validate alignment
  from marking           student errors          with marking scheme
  scheme                 with bullet refs        and quality checks
```

### Prerequisites

- Papers must exist in `sqa_education.us_papers` collection with marking schemes
- MCP configuration (`.mcp.json`) with Appwrite credentials

### Input Methods

| Method | Arguments | Description |
|--------|-----------|-------------|
| Single question | `--paper-id <id> --question <num>` | Process one question |
| Single paper | `--paper-id <id>` | Process all questions in paper |
| Batch by filters | `--subject <name> --level <level>` | Process all matching papers |
| Dry run | `--dry-run` | Preview plan without execution |

### All Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--paper-id` | string | - | Paper document ID (e.g., `mathematics-n5-2023-X847-75-01`) |
| `--question` | string | - | Question number (e.g., `1`, `4a`, `5b(i)`) |
| `--subject` | string | - | Filter by subject (e.g., `Mathematics`) |
| `--level` | string | - | Filter by level (e.g., `National 5`, `Higher`) |
| `--year` | int | - | Filter by year (e.g., `2023`) |
| `--dry-run` | flag | `false` | Preview what will be generated without executing |
| `--force` | flag | `false` | Regenerate existing walkthroughs |
| `--max-critic-retries` | int | `3` | Maximum validation retry attempts |
| `--mcp-config` | file path | `.mcp.json` | MCP configuration file |
| `--no-persist-workspace` | flag | `false` | Delete workspace after execution |
| `--log-level` | choice | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### Usage Examples

```bash
# Generate walkthrough for a single question
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01 \
  --question 1

# Generate walkthroughs for all questions in a paper
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01

# Dry run - preview what will be generated
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01 \
  --dry-run

# Batch mode - all N5 Mathematics papers
python -m src.batch_walkthrough_generator \
  --subject Mathematics --level "National 5"

# Batch mode - specific year
python -m src.batch_walkthrough_generator \
  --subject Mathematics --level "National 5" --year 2023

# Force regenerate existing walkthroughs
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01 \
  --force

# Debug mode with preserved workspace
python -m src.batch_walkthrough_generator \
  --paper-id mathematics-n5-2023-X847-75-01 \
  --question 14b \
  --log-level DEBUG
```

### Pipeline Steps

1. **PRE-PROCESSING (Python):**
   - Fetch paper from `us_papers` collection
   - Extract question + marking scheme data
   - Generate blank `walkthrough_template.json`
   - Build prerequisite links (V2 papers only)

2. **WALKTHROUGH AUTHOR (Subagent 1):**
   - Read marking scheme from `walkthrough_source.json`
   - Generate step-by-step solution aligned with SQA bullets
   - Write steps to `walkthrough_template.json`

3. **COMMON ERRORS SUBAGENT (Subagent 2):**
   - Analyze question for typical student mistakes
   - Generate 2-4 common errors with bullet references
   - Add `common_errors` array to template

4. **WALKTHROUGH CRITIC (Subagent 3):**
   - Validate marking scheme alignment
   - Check LaTeX syntax correctness
   - Validate error quality and bullet references
   - Write result to `walkthrough_critic_result.json`

5. **POST-PROCESSING (Python):**
   - Validate `common_errors` schema with Pydantic
   - GZIP compress walkthrough content (~70% reduction)
   - Upsert to `us_walkthroughs` collection

### V1 vs V2 Prompts

The pipeline supports two prompt versions:

| Version | Description | Features |
|---------|-------------|----------|
| **V1** | Examiner-focused (default) | Steps, marks, examiner notes |
| **V2** | Pedagogically enhanced | + concept explanations, peer tips, learning gaps, prerequisite links |

V2 is automatically enabled for pilot papers. The model version is tracked in the output document.

### Output

- **Appwrite Collection:** `sqa_education.us_walkthroughs`
- **Appwrite Database:** `sqa_education` (NOT default)
- **Workspace:** `workspace/<execution_id>/` (preserved by default)

#### Generated Document Structure

```json
{
  "paper_id": "mathematics-n5-2023-X847-75-01",
  "question_number": "14b",
  "marks": 5,
  "status": "published",
  "model_version": "walkthrough_author_v1",
  "walkthrough_content": "<GZIP+BASE64 compressed JSON>",
  "last_modified": "2025-01-22T10:30:00Z"
}
```

#### Walkthrough Content (Decompressed)

```json
{
  "question_stem": "Calculate the gradient of the line...",
  "question_stem_latex": "Calculate the gradient of the line $y = 2x + 3$",
  "topic_tags": ["Straight Line", "Gradient"],
  "total_marks": 5,
  "steps": [
    {
      "bullet": 1,
      "label": "Step 1",
      "process": "Identify the gradient from y = mx + c form",
      "working": "m = 2",
      "working_latex": "$m = 2$",
      "marks_earned": 2,
      "examiner_notes": "Accept m = 2 stated",
      "concept_explanation": "In y = mx + c, m is the coefficient of x",
      "peer_tip": "Just look at the number in front of x!"
    }
  ],
  "common_errors": [
    {
      "error_type": "conceptual",
      "description": "Confusing gradient with y-intercept",
      "why_marks_lost": "•1 and •2 lost",
      "prevention_tip": "Remember: gradient is the coefficient of x, intercept is the constant",
      "learning_gap": "Understanding y = mx + c form",
      "related_topics": ["Straight Line Equation"]
    }
  ],
  "examiner_summary": "Well-answered question. Most candidates correctly identified...",
  "diagram_refs": ["d1", "d2"]
}
```

### Workspace Files

| File | Purpose |
|------|---------|
| `walkthrough_source.json` | Extracted question + marking scheme |
| `paper_context.json` | General marking principles, formulae |
| `walkthrough_template.json` | Generated walkthrough (final output) |
| `walkthrough_critic_result.json` | Critic validation result |
| `execution_manifest.json` | Execution metadata |
| `execution_log.json` | Stage-by-stage progress |
| `final_result.json` | Success/failure summary |

### Error Types

The `common_errors` field uses these error type categories:

| Error Type | Description |
|------------|-------------|
| `conceptual` | Misunderstanding of mathematical concepts |
| `calculation` | Arithmetic or computational errors |
| `procedural` | Wrong method or missing steps |
| `notation` | Incorrect mathematical notation |
| `misread` | Misreading the question |
| `incomplete` | Partial answer or missing conclusion |

### Troubleshooting

**"Paper not found" error:**
- Verify paper exists in `us_papers` collection
- Check paper ID format: `{subject}-{level_code}-{year}-{paper_code_normalized}`

**"Question not found" error:**
- Check question number format (e.g., `14b` not `Q14b`)
- Verify question exists in paper's `data.questions` array

**Critic validation fails repeatedly:**
- Check workspace for `walkthrough_critic_result.json`
- Review dimensional scores to identify failing criteria
- Consider increasing `--max-critic-retries`

**Schema validation fails:**
- Common with `common_errors` field
- Agent auto-corrects schema drift (wrong field names)
- Check logs for specific Pydantic validation errors

---

## Common Patterns

### Shared Arguments

These arguments are common across most or all author CLIs:

| Argument | Default | Purpose |
|----------|---------|---------|
| `--mcp-config` | `.mcp.json` | Appwrite MCP configuration |
| `--log-level` | `INFO` | Logging verbosity |
| `--no-persist-workspace` or `--persist-workspace` | varies | Workspace retention |

### Environment Setup

```bash
# Always start from claud_author_agent directory
cd /path/to/ScottishAILessons/claud_author_agent

# Ensure .mcp.json exists with Appwrite credentials
cat .mcp.json
# Should contain endpoint, projectId, apiKey

# For diagram generation, ensure services are running
cd diagram-prototypes && docker compose up -d && cd ..
```

### Log Levels

| Level | Use Case |
|-------|----------|
| `DEBUG` | Development, troubleshooting, detailed trace |
| `INFO` | Normal operation, progress tracking |
| `WARNING` | Non-critical issues, skipped items |
| `ERROR` | Critical failures only |

---

## Workflow Examples

### Complete Course Authoring Pipeline

```bash
cd /path/to/ScottishAILessons/claud_author_agent

# Step 1: Generate SOW
python -m src.sow_author_cli --courseId course_c84474
# Wait for completion...

# Step 2: Generate all lesson templates (assume 10 lessons)
for i in {1..10}; do
  echo "Generating lesson $i..."
  python -m src.lesson_author_cli --courseId course_c84474 --order $i
done

# Step 3: Generate diagrams for all lessons
for i in {1..10}; do
  echo "Generating diagrams for lesson $i..."
  python -m src.diagram_author_cli --courseId course_c84474 --order $i
done

# Step 4: Generate practice questions (batch mode)
python -m src.practice_question_author_cli --course-id course_c84474 --max-concurrent 3

# Step 5: Generate revision notes (requires published SOW)
python scripts/notes_author_cli.py --courseId course_c84474

# Step 6: Generate mock exam (if applicable)
python scripts/run_mock_exam_author.py --course course_c84474
```

### Regeneration Workflow

```bash
# Regenerate SOW (force overwrite)
python -m src.sow_author_cli --courseId course_c84474 --force

# Regenerate single lesson
python -m src.lesson_author_cli --courseId course_c84474 --order 3

# Regenerate diagrams (force)
python -m src.diagram_author_cli --courseId course_c84474 --order 3 --force

# Regenerate practice questions (full regenerate)
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817 --regenerate
```

### Debugging Workflow

```bash
# Run with DEBUG logging and preserved workspace
python -m src.sow_author_cli --courseId course_c84474 --log-level DEBUG

# Check workspace for intermediate outputs
ls -la workspace/
# Find your execution ID folder

# Inspect generated content
cat workspace/<execution_id>/sow_draft.json
cat workspace/<execution_id>/critic_feedback.json
```

---

## Appendix: JSON Input Formats

### SOW Author
```json
{
  "courseId": "course_c84474"
}
```

### Lesson Author
```json
{
  "courseId": "course_c84474",
  "order": 1
}
```

### Practice Question Author (Single)
```json
{
  "lesson_template_id": "68f51d0d0009edd1b817"
}
```

### Practice Question Author (Batch)
```json
{
  "course_id": "course_c84474"
}
```

### Walkthrough Author (Single Question)
```json
{
  "paper_id": "mathematics-n5-2023-X847-75-01",
  "question_number": "14b"
}
```

### Walkthrough Author (Batch by Filters)
```json
{
  "subject": "Mathematics",
  "level": "National 5",
  "year": 2023
}
```

---

*Last updated: January 2025*
