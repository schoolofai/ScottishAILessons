# Content Authoring Pipelines - DevOps Guide

> **Complete reference for creating courses, lessons, mock exams, and practice content**

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              CONTENT AUTHORING PIPELINES                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                    DATA SOURCES
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           sqa_education.sqa_current                                      │
│                        (SQA Curriculum Master Data)                                      │
└─────────────────────────────────────┬───────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
        ┌───────────────────────┐           ┌───────────────────────┐
        │   default.courses     │           │ default.course_outcomes│
        │  (Course metadata)    │           │  (Learning outcomes)   │
        └───────────┬───────────┘           └───────────┬───────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                    PIPELINE 1: COURSE CREATION
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │    SEED      │───▶│  SOW AUTHOR  │───▶│LESSON AUTHOR │───▶│DIAGRAM AUTHOR│          │
│  │  (TypeScript)│    │   (Claude)   │    │   (Claude)   │    │   (Claude)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │                   │
│         ▼                   ▼                   ▼                   ▼                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   courses    │    │ Authored_SOW │    │lesson_templates│   │lesson_diagrams│         │
│  │course_outcomes│   │              │    │              │    │              │          │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                    PIPELINE 2: MOCK EXAM GENERATION
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                               │
│  │ Authored_SOW │───▶│ MOCK EXAM    │───▶│  mock_exams  │                               │
│  │(mock_exam    │    │   AUTHOR     │    │  collection  │                               │
│  │ entry type)  │    │   (Claude)   │    │              │                               │
│  └──────────────┘    └──────────────┘    └──────────────┘                               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                    PIPELINE 3: PRACTICE WIZARD GENERATION
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │lesson_templates│──▶│PRACTICE BLOCK│───▶│PRACTICE Q's  │───▶│practice_blocks│         │
│  │              │    │   EXTRACTOR  │    │  GENERATOR   │    │practice_questions│       │
│  └──────────────┘    │   (Claude)   │    │   (Claude)   │    └──────────────┘          │
│                      └──────────────┘    └──────────────┘                               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                    RUNTIME GRAPHS (LangGraph Backend)
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         infinite_practice (V2)                                    │   │
│  │  practice_questions ──▶ present ──▶ await_response ──▶ mark ──▶ feedback ──▶ END │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            graph_mock_exam                                        │   │
│  │  exam_submission ──▶ parse_submission ──▶ grade_exam ──▶ EvaluationResult ──▶ END│   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

```bash
# 1. Environment setup
cd /path/to/ScottishAILessons

# 2. Frontend dependencies (for seeding scripts)
cd assistant-ui-frontend
npm install --legacy-peer-deps
cp .env.local.example .env.local  # Configure Appwrite credentials

# 3. Author agent dependencies
cd ../claud_author_agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env  # Configure API keys
```

### Complete Course Creation (All Steps)

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Seed course + outcomes (2-3 seconds)
# ═══════════════════════════════════════════════════════════════════════════════
cd assistant-ui-frontend
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Author SOW (~3-5 minutes, ~$2)
# ═══════════════════════════════════════════════════════════════════════════════
cd ../claud_author_agent
source .venv/bin/activate
python -m src.sow_author_cli --courseId course_c84775

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Author all lessons (~1 hour for 20 lessons, ~$20)
# ═══════════════════════════════════════════════════════════════════════════════
python -m src.batch_lesson_generator --courseId course_c84775

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Generate diagrams for all lessons (~30 mins, ~$10)
# ═══════════════════════════════════════════════════════════════════════════════
python -m src.batch_diagram_generator --courseId course_c84775

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Generate practice questions (~2 hours, ~$30)
# ═══════════════════════════════════════════════════════════════════════════════
python -m src.practice_question_author_cli --course-id course_c84775

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Generate mock exam (~10 minutes, ~$3)
# ═══════════════════════════════════════════════════════════════════════════════
python -m src.mock_exam_author_cli --courseId course_c84775
```

---

## Pipeline 1: Course Creation

### Overview

Creates a complete course from SQA curriculum data through to ready-to-teach lessons with diagrams.

```
sqa_education.sqa_current
        │
        ▼ [seedSingleCourse.ts]
┌───────────────┐
│ Step 1: SEED  │──▶ default.courses + default.course_outcomes
└───────┬───────┘
        │
        ▼ [sow_author_cli.py]
┌───────────────┐
│ Step 2: SOW   │──▶ default.Authored_SOW (8-20 lesson entries)
└───────┬───────┘
        │
        ▼ [batch_lesson_generator.py]
┌───────────────┐
│ Step 3: LESSON│──▶ default.lesson_templates (full cards content)
└───────┬───────┘
        │
        ▼ [batch_diagram_generator.py]
┌───────────────┐
│ Step 4: DIAGRAM│──▶ default.lesson_diagrams (JSXGraph + PNG)
└───────────────┘
```

---

### Step 1: Seed Course + Outcomes

#### CLI Usage

```bash
cd assistant-ui-frontend

# Basic usage
tsx scripts/seedSingleCourse.ts --subject <subject> --level <level>

# Examples
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
tsx scripts/seedSingleCourse.ts --subject physics --level higher

# Options
tsx scripts/seedSingleCourse.ts --subject math --level national_5 --dry-run      # Preview only
tsx scripts/seedSingleCourse.ts --subject math --level national_5 --force-update # Overwrite existing
```

#### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `subject` | CLI arg | SQA subject slug (underscore format: `application_of_mathematics`) |
| `level` | CLI arg | SQA level slug (underscore format: `national_5`, `higher`) |
| SQA Data | `sqa_education.sqa_current` | Raw curriculum JSON from SQA |

#### Outputs

| Output | Collection | Description |
|--------|------------|-------------|
| Course Document | `default.courses` | `{courseId, subject, level, sqaCode, schema_version}` |
| Outcome Documents | `default.course_outcomes` | N documents with `{outcomeId, outcomeTitle, assessmentStandards[], ...}` |

#### Intermediate Artifacts

None - this is a direct database seeding operation.

#### Database Schema

**courses:**
```json
{
  "courseId": "course_c84775",
  "subject": "mathematics",
  "level": "national-5",
  "sqaCode": "C847 75",
  "schema_version": 2
}
```

**course_outcomes:**
```json
{
  "courseId": "course_c84775",
  "courseSqaCode": "C847 75",
  "unitCode": "H2KP 75",
  "unitTitle": "Applications",
  "outcomeId": "O1",
  "outcomeTitle": "Apply numerical skills...",
  "assessmentStandards": "[{\"code\": \"AS1.1\", \"description\": \"...\"}]",
  "teacherGuidance": "...",
  "keywords": "[\"fractions\", \"percentages\"]"
}
```

---

### Step 2: Author SOW (Scheme of Work)

#### CLI Usage

```bash
cd claud_author_agent
source .venv/bin/activate

# Basic usage (subject/level auto-fetched from database)
python -m src.sow_author_cli --courseId <courseId>

# Examples
python -m src.sow_author_cli --courseId course_c84775
python -m src.sow_author_cli --courseId course_c84775 --version 2
python -m src.sow_author_cli --courseId course_c84775 --force  # Overwrite existing

# Input methods
python -m src.sow_author_cli --input input.json  # JSON file
python -m src.sow_author_cli                      # Interactive prompts
```

#### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `courseId` | CLI arg | Course identifier (e.g., `course_c84775`) |
| Course Details | `default.courses` | Auto-fetched subject + level |
| SQA Curriculum | `sqa_education.sqa_current` | Full curriculum structure |

#### Outputs

| Output | Collection | Description |
|--------|------------|-------------|
| SOW Document | `default.Authored_SOW` | Complete scheme with 8-20 lesson entries |

#### Intermediate Artifacts

**Workspace:** `claud_author_agent/workspace/{execution_id}/`

| File | Description |
|------|-------------|
| `Course_data.txt` | Extracted SQA curriculum data (JSON format) |
| `authored_sow.json` | Generated SOW before validation |
| `sow_critic_result.json` | Critic validation with dimensional scores |
| `schema_validation_result.json` | Final Pydantic validation |

#### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SOW AUTHOR PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRE-PROCESSING (Python - NO LLM)                                           │
│  ─────────────────────────────────                                          │
│  1. Validate courseId exists in default.courses                             │
│  2. Auto-fetch subject + level                                              │
│  3. Validate SQA data exists in sqa_education.sqa_current                   │
│  4. Extract Course_data.txt to workspace                                    │
│                                                                              │
│  CLAUDE AGENT EXECUTION (2 Subagents + Retry)                               │
│  ─────────────────────────────────────────────                              │
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │   @sow_author       │ ── WebSearch/WebFetch for Scottish context        │
│  │   (creative)        │ ── Reads Course_data.txt                          │
│  │                     │ ── Writes authored_sow.json                       │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │   @unified_critic   │ ── Schema Gate (Pydantic) - BLOCKING              │
│  │   (validation)      │ ── Factual Gate (WebSearch) - BLOCKING            │
│  │                     │ ── 5 Dimensional Scoring                          │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│      ┌──────┴──────┐                                                        │
│      │ PASS?       │                                                        │
│      └──────┬──────┘                                                        │
│         NO  │  YES                                                          │
│         ▼   │                                                               │
│  ┌──────────┴─────┐                                                         │
│  │  Retry (max 3) │                                                         │
│  └────────────────┘                                                         │
│                                                                              │
│  POST-PROCESSING (Python - NO LLM)                                          │
│  ──────────────────────────────────                                         │
│  1. Parse authored_sow.json                                                 │
│  2. Final Pydantic validation                                               │
│  3. Upsert to default.Authored_SOW                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### SOW Entry Schema

Each entry in `entries[]`:

```json
{
  "order": 1,
  "label": "Introduction to Surds",
  "lesson_type": "teach",
  "standards_or_skills_addressed": [
    {"code": "O1", "outcome": "Working with surds", "description": "..."}
  ],
  "lesson_plan": {
    "cards": [
      {
        "card_number": 1,
        "card_type": "starter",
        "title": "What are Surds?",
        "purpose": "...",
        "pedagogical_approach": "...",
        "cfu_strategy": "Mini whiteboard: simplify √12"
      }
    ]
  },
  "accessibility_profile": {...},
  "coherence": {"block_name": "...", "prerequisites": [...]},
  "policy": {"calculator_section": "non-calculator"},
  "estMinutes": 50,
  "engagement_tags": ["real-world", "visual"]
}
```

---

### Step 3: Author Lessons

#### CLI Usage

```bash
cd claud_author_agent
source .venv/bin/activate

# Single lesson
python -m src.lesson_author_cli --courseId <courseId> --order <order>

# Examples
python -m src.lesson_author_cli --courseId course_c84775 --order 1
python -m src.lesson_author_cli --courseId course_c84775 --order 5

# Batch mode (all lessons for a course)
python -m src.batch_lesson_generator --courseId course_c84775
python -m src.batch_lesson_generator --courseId course_c84775 --dry-run
python -m src.batch_lesson_generator --courseId course_c84775 --force  # Regenerate all

# Input methods
python -m src.lesson_author_cli --input input.json
python -m src.lesson_author_cli  # Interactive
```

#### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `courseId` | CLI arg | Course identifier |
| `order` | CLI arg | Lesson order in SOW (1-indexed) |
| SOW Entry | `default.Authored_SOW` | Lesson blueprint from SOW |
| Outcomes | `default.course_outcomes` | Learning outcomes for context |
| Diagrams | `default.lesson_diagrams` | Pre-existing diagrams (optional) |

#### Outputs

| Output | Collection | Description |
|--------|------------|-------------|
| Lesson Template | `default.lesson_templates` | Full lesson with cards content |

#### Intermediate Artifacts

**Workspace:** `claud_author_agent/workspace/{execution_id}/`

| File | Description |
|------|-------------|
| `sow_entry.json` | Extracted SOW entry |
| `course_outcomes.json` | Course outcomes context |
| `lesson_template.json` | Generated lesson template |
| `lesson_critic_result.json` | Critic validation results |

#### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LESSON AUTHOR PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRE-PROCESSING (Python)                                                    │
│  ────────────────────────                                                   │
│  1. SOW Entry Extractor → sow_entry.json                                    │
│  2. Course Outcomes Extractor → course_outcomes.json                        │
│  3. Lesson Diagrams Extractor → existing diagrams (if any)                  │
│                                                                              │
│  CLAUDE AGENT EXECUTION (3 Subagents)                                       │
│  ─────────────────────────────────────                                      │
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │   @research         │ ── WebSearch for Scottish context                 │
│  │   (clarification)   │ ── Answers ambiguous requirements                 │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │   @lesson_author    │ ── Creates full lesson_template.json              │
│  │   (creative)        │ ── 3-15 cards per lesson                          │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │   @combined_critic  │ ── Transformation fidelity check                  │
│  │   (validation)      │ ── Schema compliance                              │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│  POST-PROCESSING (Python)                                                   │
│  ─────────────────────────                                                  │
│  1. Lesson Upserter → default.lesson_templates                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Lesson Template Schema

```json
{
  "$id": "68f1234...",
  "title": "Introduction to Surds",
  "courseId": "course_c84775",
  "sow_order": 1,
  "lesson_type": "teach",
  "outcomeRefs": "[\"68abc...\", \"68def...\"]",
  "cards": "[{...card1...}, {...card2...}]",
  "estMinutes": 50,
  "engagement_tags": "[\"real-world\"]",
  "policy": "{\"calculator_section\": \"non-calculator\"}",
  "status": "draft",
  "version": 1
}
```

---

### Step 4: Generate Diagrams

#### CLI Usage

```bash
cd claud_author_agent
source .venv/bin/activate

# Single lesson
python -m src.diagram_author_cli --courseId <courseId> --order <order>

# Single card only
python -m src.diagram_author_cli --courseId course_c84775 --order 1 --card-order 2

# Batch mode (all lessons)
python -m src.batch_diagram_generator --courseId course_c84775
python -m src.batch_diagram_generator --courseId course_c84775 --dry-run
python -m src.batch_diagram_generator --courseId course_c84775 --force
```

#### Prerequisites

The diagram pipeline requires the **DiagramScreenshot Service** running:

```bash
# Start the screenshot service (port 3001)
cd diagram-screenshot-service
npm start
```

#### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `courseId` | CLI arg | Course identifier |
| `order` | CLI arg | Lesson order |
| Lesson Template | `default.lesson_templates` | Cards needing diagrams |

#### Outputs

| Output | Collection | Description |
|--------|------------|-------------|
| Diagram Documents | `default.lesson_diagrams` | JSXGraph JSON + PNG file IDs |

#### Intermediate Artifacts

**Workspace:** `claud_author_agent/workspace/exec_{execution_id}/`

| File | Description |
|------|-------------|
| `lesson_template.json` | Source lesson |
| `eligible_cards.json` | Cards identified as needing diagrams |
| `diagram_generation_results.json` | All generated diagrams |
| `{card_id}_diagram_*.json` | Individual diagram JSXGraph specs |
| `{card_id}_diagram_*.png` | Rendered PNG images |

#### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIAGRAM AUTHOR PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRE-PROCESSING (Python)                                                    │
│  ────────────────────────                                                   │
│  1. Fetch lesson template                                                   │
│  2. Eligibility Analyzer (LLM) → Which cards need diagrams?                 │
│  3. Copy JSXGraph templates to workspace                                    │
│                                                                              │
│  CLAUDE AGENT EXECUTION (3 Subagents)                                       │
│  ─────────────────────────────────────                                      │
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │ @jsxgraph_researcher│ ── Research JSXGraph API approaches               │
│  │   (research)        │ ── Find best visualization strategy               │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │ @diagram_generator  │ ── Create JSXGraph JSON spec                      │
│  │   (creative)        │ ── Render PNG via screenshot service              │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │   @visual_critic    │ ── 4 dimensions: clarity, accuracy,               │
│  │   (validation)      │      pedagogy, aesthetics                         │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│  POST-PROCESSING (Python)                                                   │
│  ─────────────────────────                                                  │
│  1. Diagram Upserter → default.lesson_diagrams                              │
│  2. Update lesson_templates with file IDs                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline 2: Mock Exam Generation

### Overview

Generates a complete mock exam from a SOW's `mock_exam` entry type.

```
default.Authored_SOW (entry.lesson_type == "mock_exam")
        │
        ▼ [mock_exam_author_cli.py]
┌───────────────────┐
│ MOCK EXAM AUTHOR  │──▶ default.mock_exams
│    (Claude)       │
└───────────────────┘
```

### CLI Usage

```bash
cd claud_author_agent
source .venv/bin/activate

# Basic usage
python -m src.mock_exam_author_cli --courseId <courseId>

# Examples
python -m src.mock_exam_author_cli --courseId course_c84474
python -m src.mock_exam_author_cli --courseId course_c84474 --version 2
python -m src.mock_exam_author_cli --courseId course_c84474 --force     # Overwrite
python -m src.mock_exam_author_cli --courseId course_c84474 --dry-run   # Preview only

# V2 modular architecture (experimental)
python -m src.mock_exam_author_cli --courseId course_c84474 --v2

# Input methods
python -m src.mock_exam_author_cli --input input.json
```

### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `courseId` | CLI arg | Course identifier |
| `version` | CLI arg (optional) | Version number (default: "1") |
| Mock Exam Entry | `default.Authored_SOW` | Entry where `lesson_type == "mock_exam"` |
| Course Details | `default.courses` | Course metadata |

### Outputs

| Output | Collection | Description |
|--------|------------|-------------|
| Mock Exam Document | `default.mock_exams` | Complete exam with sections, questions, diagrams |

### Intermediate Artifacts

**Workspace:** `claud_author_agent/workspace/{execution_id}/`

| File | Description |
|------|-------------|
| `mock_exam_source.json` | Extracted SOW mock_exam entry |
| `sow_context.json` | Course and SOW context |
| `mock_exam.json` | Generated exam structure |
| `mock_exam_critic_result.json` | UX validation results |
| `diagrams/` | Generated diagram files (PNG/SVG) |

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MOCK EXAM AUTHOR PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRE-PROCESSING (Python)                                                    │
│  ────────────────────────                                                   │
│  1. Mock Exam Extractor → Find mock_exam entry in SOW                       │
│  2. Create mock_exam_source.json + sow_context.json                         │
│                                                                              │
│  CLAUDE AGENT EXECUTION (5 Subagents)                                       │
│  ─────────────────────────────────────                                      │
│                                                                              │
│  CORE PIPELINE:                                                             │
│  ┌─────────────────────┐                                                    │
│  │ @mock_exam_author   │ ── Transform SOW entry to exam JSON               │
│  │   (creative)        │ ── Create sections + questions                    │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │   @ux_critic        │ ── Validate UX for static presentation            │
│  │   (validation)      │                                                   │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│  DIAGRAM PIPELINE (for questions needing visuals):                          │
│  ┌─────────────────────┐                                                    │
│  │ @diagram_classifier │ ── Choose tool: DESMOS, MATPLOTLIB,               │
│  │   (classification)  │      JSXGRAPH, PLOTLY, IMAGE_GEN, NONE            │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │ @diagram_author     │ ── Generate diagram via REST API                  │
│  │   (generation)      │                                                   │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │ @diagram_critic     │ ── Validate educational quality                   │
│  │   (validation)      │                                                   │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│  POST-PROCESSING (Python)                                                   │
│  ─────────────────────────                                                  │
│  1. Mock Exam Upserter → default.mock_exams                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mock Exam Schema

```json
{
  "$id": "68f1234...",
  "courseId": "course_c84474",
  "version": "1",
  "metadata": {
    "title": "National 4 Mathematics - Mock Exam",
    "subject": "mathematics",
    "level": "national-4",
    "totalMarks": 60,
    "timeLimit": 90
  },
  "sections": [
    {
      "section_id": "section_1",
      "section_label": "Non-Calculator",
      "section_marks": 25,
      "questions": [
        {
          "question_id": "q1",
          "question_number": 1,
          "question_type": "short_answer",
          "question_stem": "Simplify 3/4 + 1/2",
          "marks": 2,
          "cfu_config": {
            "answer_key": "5/4 or 1 1/4",
            "misconceptions": ["Adding numerators only"]
          }
        }
      ]
    }
  ],
  "status": "draft"
}
```

### Runtime Graph: Mock Exam Grading

When students complete mock exams, the **graph_mock_exam** LangGraph graph handles grading:

```
Entry Point: langgraph-agent/src/agent/graph_mock_exam.py:graph_mock_exam

Input: ExamSubmissionWithExam (student answers + exam structure)
  │
  ▼ parse_submission_node
  │   └── Validate submission schema
  │
  ▼ grade_exam_node
  │   └── LLM grades all questions (GPT-4o-mini)
  │   └── Structured output: EvaluationResult
  │
  ▼ Output: EvaluationResult
      ├── question_feedback[] (per-question feedback)
      ├── section_results[] (marks per section)
      ├── overall_result {total_marks, percentage, grade, pass_status}
      └── learning_recommendations[]
```

---

## Pipeline 3: Practice Wizard Generation

### Overview

Generates practice questions from lesson content for the infinite practice wizard.

```
default.lesson_templates
        │
        ▼ [practice_question_author_cli.py]
┌───────────────────────┐
│   PRACTICE BLOCK      │──▶ default.practice_blocks
│   EXTRACTOR (Claude)  │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  PRACTICE QUESTION    │──▶ default.practice_questions
│  GENERATOR (Claude)   │
└───────────────────────┘
```

### CLI Usage

```bash
cd claud_author_agent
source .venv/bin/activate

# Single lesson
python -m src.practice_question_author_cli --lesson-id <lesson_template_id>

# Examples
python -m src.practice_question_author_cli --lesson-id 68f51d0d0009edd1b817

# Batch mode - all lessons in course
python -m src.practice_question_author_cli --course-id course_c84474

# Parallel execution (faster)
python -m src.practice_question_author_cli --course-id course_c84474 --max-concurrent 3

# Custom question counts per difficulty
python -m src.practice_question_author_cli --lesson-id lt_abc123 --easy 10 --medium 8 --hard 5

# Regenerate (delete existing + create fresh)
python -m src.practice_question_author_cli --lesson-id lt_abc123 --regenerate

# Skip integration tests (not recommended)
python -m src.practice_question_author_cli --lesson-id lt_abc123 --skip-integration-tests

# Input methods
python -m src.practice_question_author_cli --input input.json
python -m src.practice_question_author_cli  # Interactive
```

### Inputs

| Input | Source | Description |
|-------|--------|-------------|
| `lesson_template_id` | CLI arg | Single lesson to process |
| `course_id` | CLI arg | Process all lessons in course |
| `easy` | CLI arg (default: 5) | Questions per block (easy) |
| `medium` | CLI arg (default: 5) | Questions per block (medium) |
| `hard` | CLI arg (default: 3) | Questions per block (hard) |
| Lesson Template | `default.lesson_templates` | Source lesson content |

### Outputs

| Output | Collection | Description |
|--------|------------|-------------|
| Practice Blocks | `default.practice_blocks` | Concept blocks with worked examples |
| Practice Questions | `default.practice_questions` | Questions by difficulty |

### Intermediate Artifacts

**Workspace:** `claud_author_agent/workspace/{execution_id}/`

| File | Description |
|------|-------------|
| `lesson_template.json` | Source lesson |
| `extracted_blocks.json` | Concept blocks |
| `questions_by_difficulty.json` | Generated questions grouped by difficulty |
| `diagram_manifest.json` | Diagram generation status |

**Batch Workspace:** `claud_author_agent/workspace/batch_{execution_id}/`

| File | Description |
|------|-------------|
| `batch_summary.json` | Overall statistics |
| `lesson_{order}_{id}/` | Per-lesson folders |

### Agent Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRACTICE QUESTION AUTHOR PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRE-PROCESSING (Python)                                                    │
│  ────────────────────────                                                   │
│  1. Fetch lesson template                                                   │
│  2. Check existing content (blocks, questions)                              │
│  3. Auto-detect mode:                                                       │
│     - No content → Full pipeline                                            │
│     - Content exists, no diagrams → Diagrams only                           │
│     - Everything exists → Skip                                              │
│                                                                              │
│  CLAUDE AGENT EXECUTION (2 Main Agents)                                     │
│  ────────────────────────────────────────                                   │
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │ @practice_block     │ ── Extract concept blocks from lesson             │
│  │   (extraction)      │ ── Identify worked examples                       │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│             ▼                                                               │
│  ┌─────────────────────┐                                                    │
│  │ @practice_question  │ ── Generate questions per block                   │
│  │   (generation)      │ ── Multiple difficulty levels                     │
│  │                     │ ── Flag needs_diagram for visual questions        │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│  DIAGRAM PIPELINE (automatic for needs_diagram=true):                       │
│  ┌─────────────────────┐                                                    │
│  │ Diagram Generation  │ ── Creates diagrams for visual questions          │
│  │   (auto-triggered)  │                                                   │
│  └──────────┬──────────┘                                                    │
│             │                                                               │
│  POST-PROCESSING (Python)                                                   │
│  ─────────────────────────                                                  │
│  1. Batch upsert blocks → default.practice_blocks                           │
│  2. Batch upsert questions → default.practice_questions                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Smart Mode Detection

```
┌─────────────────────────────────────────────────────────────┐
│                    SMART MODE DETECTION                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Check existing content for lesson:                          │
│                                                              │
│  ┌─────────────────┐                                        │
│  │ Nothing exists? │────▶ FULL PIPELINE                     │
│  │                 │      (blocks + questions + diagrams)   │
│  └────────┬────────┘                                        │
│           │ NO                                              │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ Content exists  │────▶ DIAGRAMS ONLY                     │
│  │ but no diagrams?│      (preserve existing content)       │
│  └────────┬────────┘                                        │
│           │ NO                                              │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ All exists?     │────▶ SKIP                              │
│  │                 │      (nothing to do)                   │
│  └─────────────────┘                                        │
│                                                              │
│  With --regenerate flag:                                     │
│  DELETE ALL → FULL PIPELINE                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Practice Block Schema

```json
{
  "$id": "68f1234...",
  "lesson_template_id": "68abc...",
  "block_id": "block_001",
  "concept_name": "Simplifying Surds",
  "worked_example": {
    "problem": "Simplify √72",
    "steps": ["√72 = √(36 × 2)", "= √36 × √2", "= 6√2"],
    "answer": "6√2"
  },
  "key_concepts": ["prime factorization", "square roots"],
  "common_misconceptions": ["Adding under the root"]
}
```

### Practice Question Schema

```json
{
  "$id": "68f5678...",
  "block_id": "block_001",
  "lesson_template_id": "68abc...",
  "difficulty": "medium",
  "question_stem": "Simplify √50",
  "question_type": "short_answer",
  "answer_key": "5√2",
  "hints": ["What square number divides 50?", "50 = 25 × 2"],
  "needs_diagram": false,
  "diagram_file_id": null,
  "misconceptions_tested": ["Forgetting to simplify completely"]
}
```

### Runtime Graph: Infinite Practice (V2)

When students use the practice wizard, the **infinite_practice_graph_v2** handles marking:

```
Entry Point: langgraph-agent/src/agent/infinite_practice_graph_v2.py:infinite_practice_graph_v2

Architecture: MARKING-ONLY (questions pre-generated offline)

┌───────────────────────────────────────────────────────────────────────────┐
│                        INFINITE PRACTICE V2 FLOW                           │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Frontend fetches question from default.practice_questions                 │
│  Frontend sends question + student context to backend                      │
│                                                                            │
│  ┌──────────────────────┐                                                 │
│  │ receive_question_node│ ── Validate pre-generated question              │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │ present_question_node│ ── Tool call: practice_question                 │
│  │                      │    (displays question to student)               │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │ await_response_node  │ ── INTERRUPT: Wait for student answer           │
│  │                      │    Returns: student_response, hints_used        │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │ mark_response_node   │ ── LLM marks with MarkingResult schema          │
│  │                      │    {is_correct, feedback, explanation}          │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │ emit_feedback_node   │ ── Tool call: practice_feedback                 │
│  │                      │    (displays feedback + mastery_delta)          │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │await_feedback_ack_node│ ── INTERRUPT: Wait for acknowledgment          │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │ update_progress_node │ ── Calculate progress_update for frontend       │
│  └──────────┬───────────┘                                                 │
│             │                                                              │
│             ▼                                                              │
│  ┌──────────────────────┐                                                 │
│  │ session_complete_node│ ── Completion message                           │
│  └──────────────────────┘                                                 │
│                                                                            │
│  Frontend persists mastery updates via progress_update                     │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Database Collections Reference

### Collections Overview

| Collection | Database | Created By | Read By |
|------------|----------|------------|---------|
| `courses` | default | seedSingleCourse.ts | All agents |
| `course_outcomes` | default | seedSingleCourse.ts | Lesson Author, Teaching Agent |
| `Authored_SOW` | default | SOW Author | Lesson Author, Mock Exam Author |
| `lesson_templates` | default | Lesson Author | Diagram Author, Practice Author, Teaching Agent |
| `lesson_diagrams` | default | Diagram Author | Teaching Agent |
| `mock_exams` | default | Mock Exam Author | Mock Exam Graph |
| `practice_blocks` | default | Practice Author | Infinite Practice Graph |
| `practice_questions` | default | Practice Author | Infinite Practice Graph |
| `sqa_current` | sqa_education | External import | SOW Author, Seeding scripts |

### Collection Dependencies

```
sqa_education.sqa_current (source)
        │
        ├──▶ default.courses
        │         │
        │         └──▶ default.Authored_SOW
        │                    │
        │                    ├──▶ default.lesson_templates
        │                    │         │
        │                    │         ├──▶ default.lesson_diagrams
        │                    │         │
        │                    │         └──▶ default.practice_blocks
        │                    │                    │
        │                    │                    └──▶ default.practice_questions
        │                    │
        │                    └──▶ default.mock_exams
        │
        └──▶ default.course_outcomes
```

---

## Cost Estimates

| Pipeline Step | Time | Cost (approx) |
|---------------|------|---------------|
| Seed course + outcomes | 2-3 seconds | Free |
| Author SOW | 3-5 minutes | ~$2 |
| Author 1 lesson | 3-5 minutes | ~$1 |
| Author 20 lessons (batch) | 1-2 hours | ~$20 |
| Generate diagrams (1 lesson) | 5-10 minutes | ~$0.50 |
| Generate diagrams (20 lessons) | 30-60 minutes | ~$10 |
| Generate practice (1 lesson) | 10-15 minutes | ~$1.50 |
| Generate practice (20 lessons) | 2-4 hours | ~$30 |
| Generate mock exam | 10-15 minutes | ~$3 |
| **TOTAL (complete course)** | **4-8 hours** | **~$65** |

---

## Troubleshooting

### Common Issues

**1. "Course not found" error**
```
Cause: Course hasn't been seeded
Fix: Run seedSingleCourse.ts first
```

**2. "No SQA course data found" error**
```
Cause: sqa_education.sqa_current doesn't have this subject/level
Fix: Import SQA curriculum data first
```

**3. "Mock exam entry not found" error**
```
Cause: SOW doesn't have a lesson_type="mock_exam" entry
Fix: Re-run SOW author or manually add mock_exam entry
```

**4. "DiagramScreenshot service not available" error**
```
Cause: Screenshot service not running
Fix: cd diagram-screenshot-service && npm start
```

**5. Agent times out or fails mid-execution**
```
Fix: Check workspace/{execution_id}/ for partial outputs
     Re-run with same parameters (idempotent)
```

### Log Locations

```
claud_author_agent/
├── workspace/{execution_id}/
│   ├── execution.log          # Agent execution log
│   └── *.json                 # Intermediate artifacts
└── logs/
    └── {date}.log             # Daily aggregated logs
```

---

## Environment Variables

### Frontend (assistant-ui-frontend/.env.local)

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-admin-api-key
```

### Author Agent (claud_author_agent/.env)

```bash
ANTHROPIC_API_KEY=your-anthropic-key
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-admin-api-key
```

---

## Next Steps

1. [Database Schema Reference](./database-schema.md) - Detailed collection schemas
2. [Agent Prompt Reference](./agent-prompts.md) - Subagent prompt documentation
3. [Troubleshooting Guide](./troubleshooting.md) - Extended debugging guide
