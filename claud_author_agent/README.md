# Scottish AI Lessons - Authoring Agents

This repository contains three autonomous agents for Scottish secondary education content creation using Claude Agent SDK:

1. **SOW Author** - Creates complete Schemes of Work (course-level planning)
2. **Lesson Author** - Creates detailed lesson templates (lesson-level design)
3. **Revision Notes Author** - Generates concise, evidence-based revision notes (student revision materials)

## Which Agent Do I Need?

| Use Case | Agent | Input | Output | Documentation |
|----------|-------|-------|--------|---------------|
| **Create course overview** with 8-15 lesson entries | SOW Author | subject + level + courseId | Authored_SOW document | [SOW Author docs](#sow-author) |
| **Create detailed lesson** with 3-15 interactive cards | Lesson Author | courseId + order | lesson_templates document | [Lesson Author docs](LESSON_AUTHOR_README.md) |
| **Generate revision notes** for student review | Revision Notes Author | lessonTemplateId OR sessionId | revision_notes document + PDF/MD | [Revision Notes docs](#revision-notes-author) |

**Typical Workflow**:
1. Use **SOW Author** to create the initial course plan (8-15 lesson entries)
2. Use **Lesson Author** to flesh out each lesson entry into a full lesson template
3. Use **Revision Notes Author** to generate student-facing revision materials for each completed lesson

---

# SOW Author

Autonomous pipeline for authoring Schemes of Work (SOW) for Scottish secondary education using Claude Agent SDK.

## Overview

This agent takes a `{subject, level, courseId}` input and produces a complete, validated SOW in the Appwrite database through Python pre-processing + 2-subagent pipeline + deterministic Python upserting:

**Pre-Processing (Python)**:
0. **Course Data Extractor (Python)** → Appwrite SDK → `Course_data.txt` (no LLM, deterministic)

**Pipeline Execution (2 Subagents)**:
1. **SOW Author (with WebSearch/WebFetch)** → Authoring with on-demand research → `authored_sow_json`
2. **Unified Critic** → Validation (with retry) → `sow_critic_result_json`

**Post-Processing (Python)**:
3. **Python Upserter** → Database write → Appwrite `default.Authored_SOW` (deterministic)

## Features

- ✅ **Fully Autonomous**: Subject + level + courseId → complete SOW in database
- ✅ **Fail-Fast Validation**: Validates courseId exists in database before pipeline execution
- ✅ **Hybrid Orchestration**: Python for deterministic operations (extraction, upserting), LLMs for creative tasks (authoring, critique)
- ✅ **On-Demand Research**: WebSearch/WebFetch tools for targeted, lesson-specific research (no upfront bulk collection)
- ✅ **Flat File Architecture**: Simple 2-file workspace for subagent communication (`Course_data.txt`, `authored_sow_json`)
- ✅ **Quality Validation**: 5-dimension critic with automatic retry (up to 3 attempts)
- ✅ **Deterministic Database Operations**: Python-based course data extraction and upserting for reliability (no agent variance)
- ✅ **Cost Optimization**: Python extraction + on-demand research saves ~10-15K tokens per execution vs. upfront bulk research
- ✅ **Cost Tracking**: Per-subagent and total token/cost metrics
- ✅ **Workspace Persistence**: Optional preservation for debugging
- ✅ **Hardcoded MVP Fields**: version="1", status="draft" for simplicity
- ✅ **Scottish Curriculum Compliant**: SQA standards, CfE alignment, Scottish contexts
- ✅ **LangGraph Prompt Alignment**: Production-ready prompts aligned with LangGraph architecture

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access
- Appwrite instance (with MCP server configured)
- Node.js (for Appwrite MCP server)
- **Course must exist in `default.courses` collection** with matching subject/level before authoring SOW

### Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure Appwrite MCP
cp .mcp.json.example .mcp.json
# Edit .mcp.json and add your APPWRITE_API_KEY
```

## Usage

### Method 1: CLI with JSON Input (Recommended)

```bash
# Create input.json
cat > input.json << EOF
{
  "subject": "mathematics",
  "level": "national-5",
  "courseId": "course_c84474"
}
EOF

# Run agent
source ../venv/bin/activate
python -m src.sow_author_cli --input input.json
```

### Method 2: CLI with Command-Line Arguments

```bash
source ../venv/bin/activate
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId course_c84474
```

### Method 3: Interactive Mode

```bash
source ../venv/bin/activate
python -m src.sow_author_cli

# Follow the interactive prompts
```

### Method 4: Python API (Programmatic)

```python
from src.sow_author_claude_client import SOWAuthorClaudeAgent

agent = SOWAuthorClaudeAgent(
    mcp_config_path=".mcp.json",
    persist_workspace=True,
    max_critic_retries=3
)

result = await agent.execute(
    subject="mathematics",
    level="national-5",
    courseId="course_c84474"
)
```

### CLI Options

```bash
python -m src.sow_author_cli --help

Options:
  --input JSON_FILE          Path to JSON input file
  --subject TEXT             SQA subject (e.g., "mathematics")
  --level TEXT               SQA level (e.g., "national-5")
  --courseId TEXT            Course identifier
  --mcp-config PATH          MCP config path (default: .mcp.json)
  --max-retries N            Critic retry attempts (default: 3)
  --no-persist-workspace     Delete workspace after execution
  --log-level LEVEL          Logging level (default: INFO)
```

### Input Parameters

- **subject** (required): SQA subject in lowercase with hyphens (e.g., `"mathematics"`, `"application-of-mathematics"`)
- **level** (required): SQA level in lowercase with hyphens (e.g., `"national-5"`, `"higher"`)
- **courseId** (required): Course identifier - the **courseId field value**, not document $id (e.g., `"course_c84474"`)
  - **Must exist** in `default.courses` collection (queried by courseId field)
  - **Must match** the subject/level provided
  - Pipeline will fail fast if courseId not found or mismatched

---

# Revision Notes Author

Autonomous pipeline for generating concise, evidence-based revision notes for Scottish secondary education using Claude Agent SDK.

## Overview

This agent takes a lesson template (or completed session with student evidence) and produces high-quality revision notes optimized for cognitive science principles through Python pre-processing + single agent + Python post-processing:

**Pre-Processing (Python)**:
0. **Lesson Data Extractor (Python)** → Appwrite SDK → `lesson_snapshot.json`, `sow_context.json`, `evidence_summary.json` (no LLM, deterministic)

**Agent Execution (Single Agent)**:
1. **Revision Notes Author (with validation)** → Authoring with cognitive science checks → `revision_notes.json`

**Post-Processing (Python)**:
2. **Markdown/PDF Exporters** → File generation → `revision_notes.md` + `revision_notes.pdf` (optional)
3. **Python Upserter** → Database write → Appwrite `default.revision_notes` (deterministic)

## Features

- ✅ **Dual Input Modes**: Template-based (generic) OR session-based (personalized with student evidence)
- ✅ **Cognitive Science Aligned**: 9 evidence-based principles (dual coding, chunking, elaboration, retrieval practice, worked examples, error correction, spacing, SQA alignment, mnemonics)
- ✅ **JSON Schema Validation**: Pydantic models with MCP tool integration for runtime validation
- ✅ **Quality Metrics**: Word counts, dual coding coverage, cognitive science alignment scoring
- ✅ **Dual Export Formats**: Markdown (with KaTeX LaTeX) + PDF (with weasyprint professional styling)
- ✅ **Compression**: Gzip + base64 encoding reduces database storage by ~70%
- ✅ **Scottish Context Library**: Authentic real-world connections (ScotRail, NHS Scotland, Edinburgh, etc.)
- ✅ **SQA Standards**: Aligned with National 3-5, Higher, Advanced Higher difficulty levels
- ✅ **Deterministic Database Operations**: Python-based extraction and upserting for reliability
- ✅ **Cost Tracking**: Token and cost metrics per execution
- ✅ **Workspace Persistence**: Optional preservation for debugging

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access
- Appwrite instance (with MCP server configured)
- Node.js (for Appwrite MCP server)
- **For PDF export**: System dependencies for weasyprint (Cairo, Pango)

### Setup

```bash
# Install dependencies
pip install -r requirements.txt

# For PDF export support (optional)
# macOS
brew install cairo pango gdk-pixbuf libffi

# Ubuntu/Debian
sudo apt-get install libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev

# Configure Appwrite MCP
cp .mcp.json.example .mcp.json
# Edit .mcp.json and add your APPWRITE_API_KEY
```

## Usage

### Method 1: Session-Based Generation (With Student Evidence)

Generate personalized revision notes based on a completed lesson session with student performance data:

```bash
source ../venv/bin/activate
python -m src.revision_notes_cli \
  --sessionId session_abc123 \
  --export-format both
```

**Features**:
- Uses student evidence to identify challenge areas
- Highlights common mistakes specific to student performance
- Personalizes examples based on misconceptions
- Includes overall accuracy, first-attempt success metrics

### Method 2: Template-Based Generation (Generic)

Generate generic revision notes from a lesson template without student evidence:

```bash
source ../venv/bin/activate
python -m src.revision_notes_cli \
  --lessonTemplateId lesson_template_xyz789 \
  --export-format markdown
```

**Features**:
- Generic revision notes suitable for all students
- Based on lesson content and SQA outcomes
- No personalization, focuses on core concepts
- Faster generation (no evidence analysis)

### Method 3: Interactive Mode

```bash
source ../venv/bin/activate
python -m src.revision_notes_cli

# Follow the interactive prompts
```

### Method 4: Python API (Programmatic)

```python
from src.revision_notes_claude_client import RevisionNotesAuthorClaudeAgent

agent = RevisionNotesAuthorClaudeAgent(
    mcp_config_path=".mcp.json",
    persist_workspace=True,
    log_level="INFO"
)

# Session-based
result = await agent.execute(
    sessionId="session_abc123",
    export_format="both"  # markdown, pdf, or both
)

# Template-based
result = await agent.execute(
    lessonTemplateId="lesson_template_xyz789",
    export_format="markdown"
)

print(f"Document ID: {result['document_id']}")
print(f"PDF Path: {result['pdf_path']}")
print(f"Markdown Path: {result['markdown_path']}")
```

### CLI Options

```bash
python -m src.revision_notes_cli --help

Options:
  --sessionId TEXT           Session identifier (for evidence-based generation)
  --lessonTemplateId TEXT    Lesson template identifier (for generic generation)
  --export-format TEXT       Export format: markdown, pdf, or both (default: both)
  --mcp-config PATH          MCP config path (default: .mcp.json)
  --no-persist-workspace     Delete workspace after execution
  --log-level LEVEL          Logging level (default: INFO)
```

### Input Parameters

- **sessionId** (optional): Session identifier from `default.sessions` collection
  - Generates personalized notes with student evidence
  - Mutually exclusive with lessonTemplateId
- **lessonTemplateId** (optional): Lesson template identifier from `default.lesson_templates` collection
  - Generates generic notes without evidence
  - Mutually exclusive with sessionId
- **export_format** (optional): Output format (default: "both")
  - `"markdown"`: Generate only Markdown file
  - `"pdf"`: Generate only PDF file (requires weasyprint)
  - `"both"`: Generate both formats

**Note**: Must provide either sessionId OR lessonTemplateId, not both.

## Output Structure

### JSON Schema

The agent generates a validated JSON file with the following structure:

```json
{
  "summary": "High-level overview (50-100 words)",
  "key_concepts": [
    {
      "title": "Concept title",
      "explanation": "30-50 words explanation",
      "visual_representation": "$$\\frac{2}{10} = \\frac{1}{5}$$",
      "real_world_connection": "Scottish context example"
    }
  ],
  "worked_examples": [...],
  "common_mistakes": [...],
  "quick_quiz": [...],
  "memory_aids": [...],
  "exam_tips": [...],
  "metadata": {
    "difficulty_level": "National 5",
    "estimated_study_time": 25,
    "sqa_outcome_refs": ["MTH 5-03a"]
  }
}
```

### Cognitive Science Principles

The revision notes are designed around 9 evidence-based principles:

1. **Dual Coding** (Paivio, 1971): Visual + verbal representations using LaTeX math notation
2. **Chunking** (Miller, 1956): 3-5 key concepts per lesson (cognitive load management)
3. **Elaboration** (Craik & Tulving, 1975): Real-world Scottish contexts
4. **Retrieval Practice** (Roediger & Karpicke, 2006): 3-5 quick check questions
5. **Worked Examples** (Sweller, 1988): Step-by-step problem solutions
6. **Error Correction** (Metcalfe, 2017): 3-4 common mistakes with corrections
7. **Spacing** (Cepeda et al., 2006): Estimated study time for distributed practice
8. **SQA Alignment**: Explicit links to Scottish curriculum outcomes
9. **Mnemonics** (Mastropieri & Scruggs, 1998): Memory aids and patterns

### Quality Metrics

After generation, the agent reports:
- **Total word count**: Target 500-800 words
- **Key concepts count**: 3-5 (chunking principle)
- **Dual coding coverage**: % of concepts with visuals
- **Cognitive science alignment**: Checklist of 9 principles met

---

## Comparison: SOW Author vs Lesson Author vs Revision Notes Author

| Feature | SOW Author | Lesson Author | Revision Notes Author |
|---------|------------|---------------|----------------------|
| **Purpose** | Course-level planning | Lesson-level detailed design | Student revision materials |
| **Input** | subject + level + courseId | courseId + order | lessonTemplateId OR sessionId |
| **Output** | Complete SOW with 8-15 lesson entries | Single lesson template with 3-15 cards | Revision notes JSON + PDF/MD |
| **Database Collection** | `default.Authored_SOW` | `default.lesson_templates` | `default.revision_notes` |
| **Subagents** | 2 (SOW Author, Unified Critic) | 3 (Research, Lesson Author, Critic) | 1 (Revision Notes Author with validation) |
| **Pipeline Stages** | 3 (extract → author → critic) | 5 (extract → research → author → critic → upsert) | 3 (extract → author → export/upsert) |
| **Expected Tokens** | 50-80K | 35-60K | 15-30K |
| **Expected Cost** | $1.50-2.50 | $1.25-2.15 | $0.50-1.00 |
| **Execution Time** | 3-5 minutes | 2-4 minutes | 1-2 minutes |
| **Retry Logic** | Up to 3 attempts | Up to 10 attempts | Validation-driven (agent self-corrects) |
| **Workspace Files** | 2-3 files | 5 files | 3-5 files (depending on mode) |
| **CLI Tool** | `src.sow_author_cli` | `src.lesson_author_cli` | `src.revision_notes_cli` |
| **Documentation** | This README | [LESSON_AUTHOR_README.md](LESSON_AUTHOR_README.md) | This README |
| **Implementation Status** | [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | [LESSON_AUTHOR_IMPLEMENTATION_STATUS.md](LESSON_AUTHOR_IMPLEMENTATION_STATUS.md) | Implemented ✅ |

### When to Use Each Agent

**Use SOW Author when you need to**:
- Create a new course structure from scratch
- Generate 8-15 high-level lesson entries for a full course
- Plan course-wide learning progression and assessment strategy
- Define engagement tags, timing allocations, and policy notes

**Use Lesson Author when you need to**:
- Create detailed interactive lesson materials
- Design 3-15 pedagogical cards with explainers, assessments, and feedback
- Add Scottish contexts and accessibility features to specific lessons
- Generate SQA-aligned rubrics and misconception anticipation

**Use Revision Notes Author when you need to**:
- Generate concise, evidence-based revision materials for students
- Create study guides aligned with cognitive science principles
- Export lesson content in student-friendly formats (PDF/Markdown)
- Personalize revision notes based on student performance (session mode)
- Provide generic revision notes for entire classes (template mode)

### Typical Workflow

```bash
# Step 1: Create SOW (course planning)
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId course_c84474

# Step 2: Author lesson 1 (first lesson)
python -m src.lesson_author_cli \
  --courseId course_c84474 \
  --order 1

# Step 3: Generate revision notes for lesson 1 (generic)
python -m src.revision_notes_cli \
  --lessonTemplateId lesson_template_12345 \
  --export-format both

# Step 4: Author lesson 2 (second lesson)
python -m src.lesson_author_cli \
  --courseId course_c84474 \
  --order 2

# Step 5: Generate revision notes for lesson 2 (generic)
python -m src.revision_notes_cli \
  --lessonTemplateId lesson_template_67890 \
  --export-format both

# Continue for all lesson entries in the SOW...
# Note: Order values start from 1 (not 0). SOW entries are 1-indexed.

# Optional: After students complete a lesson session, generate personalized revision notes
python -m src.revision_notes_cli \
  --sessionId session_abc123 \
  --export-format both
```

---

## Documentation

**SOW Author**:
- Main README: This file
- Implementation Status: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- Implementation Plan: `tasks/sow-author-claude-sdk-implementation-plan.md`

**Lesson Author**:
- Main README: [LESSON_AUTHOR_README.md](LESSON_AUTHOR_README.md)
- Implementation Status: [LESSON_AUTHOR_IMPLEMENTATION_STATUS.md](LESSON_AUTHOR_IMPLEMENTATION_STATUS.md)
- Implementation Specification: `tasks/LESSON_AUTHOR_AGENT_SPEC.md`

**Revision Notes Author**:
- Main README: This file (see [Revision Notes Author](#revision-notes-author) section)
- Implementation Specification: `../docs/revision-notes-claude-sdk-spec.md`
- Validation Tool Specification: `../docs/revision-notes-validation-tool-spec.md`
- Agent Prompt: `src/prompts/revision_notes_author_prompt.md`
- Implementation Status: Completed ✅
