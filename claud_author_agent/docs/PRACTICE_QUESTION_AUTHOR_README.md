# Practice Question Author

Autonomous pipeline for pre-generating practice questions for the Infinite Practice system using Claude Agent SDK.

## Overview

This agent takes a `lessonTemplateId` input and produces a complete set of practice questions stored in Appwrite, ready for instant delivery to students. It solves the **critical latency problem** of real-time question generation (3-8 seconds per question, up to 5 minutes with diagrams) by pre-generating all questions offline.

**Architecture Principle**: Frontend-Driven, Backend-Agnostic
- Frontend fetches pre-generated questions from Appwrite
- Backend (`infinite_practice_graph.py`) focuses solely on **marking** - zero Appwrite access
- Fast-fail pattern: No questions available → throw error with CLI command

```
┌─────────────────────────────────────────────────────────────────┐
│                    OFFLINE GENERATION PIPELINE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Pre-Processing (Python - Deterministic)         │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ├─► Fetch lesson template from Appwrite                │
│         └─► Extract lesson cards for block generation          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Block Generation Agent (Claude Agent SDK)       │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         └─► Extract concept blocks with structured output      │
│             (title, explanation, worked_example, key_skills)   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Question Generator Agent (Per Block)            │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ├─► Generate N easy questions (default: 5)             │
│         ├─► Generate M medium questions (default: 5)           │
│         └─► Generate K hard questions (default: 3)             │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Diagram Classification (REUSED - NO CODE CHANGE)│    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         └─► Classify questions: DESMOS | MATPLOTLIB | JSXGRAPH │
│                                 PLOTLY | IMAGE_GENERATION | NONE│
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Diagram Author Agent (REUSED - NO CODE CHANGE)  │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         └─► Generate diagrams for questions requiring them     │
│             (MCP tools, visual critique, Appwrite storage)     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Post-Processing (Python - Deterministic)        │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ├─► Upsert blocks → practice_blocks collection         │
│         └─► Upsert questions → practice_questions collection   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Offline Generation**: Questions pre-generated for instant retrieval (~50ms vs 3-8s)
- **Diagram Support**: Pre-generated diagrams (vs 5 minutes real-time)
- **Configurable Question Counts**: N easy, M medium, K hard per block
- **Open-Close Principle**: Reuses existing DiagramClassifierAgent and DiagramAuthorAgent without code changes
- **Content Hashing**: Deduplication and update detection via content hash
- **Fast-Fail Pattern**: No fallback - clear error messages with CLI remediation
- **Batch Processing**: Generate questions for all lessons in a course
- **Cost Tracking**: Per-subagent and total token/cost metrics
- **Scottish Curriculum Compliant**: SQA standards, CfE alignment

## How It Works

### Automatic Execution Mode Detection

The agent intelligently determines what work needs to be done:

```
┌─────────────────────────────────────────────────────────────┐
│                   EXECUTION MODE LOGIC                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  --regenerate flag?                                         │
│       │                                                     │
│       ├─► YES → full_pipeline (delete all, regenerate)     │
│       │                                                     │
│       └─► NO → Check existing content...                   │
│                   │                                         │
│                   ├─► No questions exist → full_pipeline   │
│                   │                                         │
│                   ├─► Questions exist, no diagrams →       │
│                   │       diagrams_only                     │
│                   │                                         │
│                   └─► Everything exists → skip_all         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Content Hashing for Deduplication

Each question and block gets a SHA256 content hash computed from its core fields:

```python
# Questions: stem + correctAnswer + difficulty + questionType
content_hash = sha256(f"{stem}|{correct_answer}|{difficulty}|{question_type}")

# Blocks: title + explanation + worked_example
content_hash = sha256(f"{title}|{explanation}|{worked_example}")
```

This enables:
- **Skip unchanged content** - Don't regenerate identical questions
- **Detect updates** - Regenerate only when lesson template changes
- **Query by hash** - Fast lookup for existing content

### Workspace Structure

After execution, the workspace contains:

```
workspaces/practice_questions_{lesson_id}_{timestamp}/
├── input/
│   └── lesson_template.json      # Fetched lesson data
├── blocks/
│   ├── block_0_intro.json        # Extracted concept blocks
│   ├── block_1_examples.json
│   └── ...
├── questions/
│   ├── block_0_easy_001.json     # Generated questions
│   ├── block_0_easy_002.json
│   ├── block_0_medium_001.json
│   └── ...
├── diagrams/
│   ├── q_001_matplotlib.png      # Generated diagram images
│   └── q_003_jsxgraph.json       # Interactive diagram configs
└── output/
    └── summary.json              # Execution metrics
```

Use `--no-persist-workspace` to auto-delete after execution.

## Installation

### Prerequisites

- Python 3.11+
- Claude Agent SDK access
- Appwrite instance (with MCP server configured)
- Node.js (for Appwrite MCP server)
- **Lesson templates must exist** in `default.lesson_templates` collection

### Setup

```bash
cd claud_author_agent

# Install dependencies
pip install -r requirements.txt

# Configure Appwrite MCP
cp .mcp.json.example .mcp.json
# Edit .mcp.json and add your APPWRITE_API_KEY
```

> **Note**: Appwrite collections (`practice_questions`, `practice_blocks`) are created automatically on first execution. No manual setup required.

## Usage

### Method 1: CLI with Lesson Template ID (Recommended)

```bash
source ../venv/bin/activate

# Generate questions for a single lesson
python -m src.practice_question_author_cli --lesson-id lt_abc123

# Generate questions for all lessons in a course
python -m src.practice_question_author_cli --course-id course_c84474

# Custom question counts per difficulty
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --easy 10 \
  --medium 8 \
  --hard 5

# Regenerate existing questions (overwrites)
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --regenerate
```

### Method 2: Python API (Programmatic)

```python
from src.practice_question_author_claude_client import PracticeQuestionAuthorClaudeClient

agent = PracticeQuestionAuthorClaudeClient(
    mcp_config_path=".mcp.json",
    questions_per_difficulty={"easy": 5, "medium": 5, "hard": 3},
    persist_workspace=True
)

# Single lesson
result = await agent.execute(
    lesson_template_id="lt_abc123",
    regenerate_existing=False
)

# Batch (entire course)
result = await agent.execute_batch(course_id="course_c84474")
```

### CLI Options

```bash
python -m src.practice_question_author_cli --help

Options:
  Input (one required):
    --input FILE            JSON file with lesson_template_id or course_id
    --lesson-id TEXT        Single lesson template ID
    --course-id TEXT        Process all lessons in course
    (none)                  Interactive mode - prompts for input

  Question Counts:
    --easy N                Number of easy questions per block (default: 5)
    --medium N              Number of medium questions per block (default: 5)
    --hard N                Number of hard questions per block (default: 3)

  Batch Processing:
    --max-concurrent N      Max parallel lessons for batch mode (default: 3)
    --regenerate            Delete and regenerate existing questions

  Configuration:
    --mcp-config PATH       MCP config path (default: .mcp.json)
    --no-persist-workspace  Delete workspace after execution
    --log-level LEVEL       DEBUG | INFO | WARNING | ERROR (default: INFO)
```

## Appwrite Collections

### `practice_questions` Collection

Stores pre-generated questions with their diagrams.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `lessonTemplateId` | string(50) | Yes | Links to lesson_templates |
| `blockId` | string(100) | Yes | Block identifier within lesson |
| `blockTitle` | string(255) | Yes | Human-readable block title |
| `difficulty` | enum | Yes | `easy`, `medium`, `hard` |
| `questionType` | enum | Yes | `multiple_choice`, `numeric`, `short_answer`, `structured_response` |
| `stem` | string(5000) | Yes | Question text (may contain LaTeX) |
| `stemPreview` | string(500) | Yes | Plain text preview for listings |
| `options` | string(10000) | No | JSON array of MCQ options |
| `correctAnswer` | string(2000) | Yes | The correct answer |
| `acceptableAnswers` | string(5000) | No | JSON array of acceptable alternatives |
| `solutionFileId` | string(100) | Yes | Appwrite file ID for solution markdown |
| `hintsFileId` | string(100) | Yes | Appwrite file ID for hints markdown |
| `diagramRequired` | boolean | Yes | Whether question needs a diagram |
| `diagramTool` | enum | No | `NONE`, `DESMOS`, `MATPLOTLIB`, `JSXGRAPH`, `PLOTLY`, `IMAGE_GENERATION` |
| `diagramFileId` | string(100) | No | Appwrite file ID for diagram image |
| `diagramJson` | string(50000) | No | JSXGraph/Desmos configuration JSON |
| `outcomeRefs` | string(500) | No | JSON array of learning outcome IDs |
| `contentHash` | string(64) | Yes | SHA256 for deduplication |
| `generatorVersion` | string(20) | Yes | Agent version (e.g., "1.0.0") |
| `executionId` | string(50) | Yes | Unique execution identifier |
| `generatedAt` | datetime | Yes | Generation timestamp |
| `status` | enum | Yes | `draft`, `published`, `archived` |

**Indexes**:
- `lesson_block_diff_idx`: (`lessonTemplateId`, `blockId`, `difficulty`) - Question retrieval
- `lesson_status_idx`: (`lessonTemplateId`, `status`) - Dashboard availability
- `content_hash_idx`: (`contentHash`) - Deduplication

### `practice_blocks` Collection

Stores extracted concept blocks from lesson templates.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `lessonTemplateId` | string(50) | Yes | Links to lesson_templates |
| `blockId` | string(100) | Yes | Unique block identifier |
| `blockIndex` | integer | Yes | Zero-based position in lesson |
| `title` | string(255) | Yes | Block title |
| `explanationFileId` | string(100) | Yes | Appwrite file ID for explanation markdown |
| `workedExampleFileId` | string(100) | No | Appwrite file ID for worked example |
| `keyFormulasFileId` | string(100) | No | Appwrite file ID for formulas |
| `commonMisconceptions` | string(5000) | No | JSON array of misconceptions |
| `outcomeRefs` | string(500) | No | JSON array of learning outcome IDs |
| `contentHash` | string(64) | Yes | SHA256 for cache invalidation |
| `generatorVersion` | string(20) | Yes | Agent version |
| `executionId` | string(50) | Yes | Unique execution identifier |
| `generatedAt` | datetime | Yes | Generation timestamp |

**Indexes**:
- `lesson_block_idx`: (`lessonTemplateId`, `blockId`) - Unique block lookup

## Comparison: Practice Question Author vs Other Authors

| Feature | SOW Author | Lesson Author | Revision Notes Author | Practice Question Author |
|---------|------------|---------------|----------------------|--------------------------|
| **Purpose** | Course-level planning | Lesson-level design | Exam preparation | Practice question cache |
| **Input** | subject + level + courseId | courseId + order | courseId | lessonTemplateId (or courseId for batch) |
| **Output** | SOW with 8-15 lessons | 3-15 lesson cards | Cheat sheet + notes | N questions per block per difficulty |
| **Database Collection** | `Authored_SOW` | `lesson_templates` | `revision_notes` | `practice_questions`, `practice_blocks` |
| **Subagents** | 2 | 3 | 1 | 2 + reused diagram agents |
| **Diagram Support** | No | Yes (via lesson_diagrams) | References only | Yes (pre-generated) |
| **Expected Tokens** | 50-80K | 35-60K | 30-50K | 40-70K per lesson |
| **Expected Cost** | $1.50-2.50 | $1.25-2.15 | $1.35-2.55 | $1.50-3.00 per lesson |
| **Execution Time** | 3-5 minutes | 2-4 minutes | 2-3 minutes | 5-15 minutes per lesson (with diagrams) |
| **CLI Tool** | `src.sow_author_cli` | `src.lesson_author_cli` | `scripts/notes_author_cli.py` | `src.practice_question_author_cli` |

## Typical Workflow

```bash
# Step 1: Create SOW (course planning) - if not already done
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId course_c84474

# Step 2: Author all lessons - if not already done
for order in {1..12}; do
  python -m src.lesson_author_cli \
    --courseId course_c84474 \
    --order $order
done

# Step 3: Generate practice questions for entire course (RECOMMENDED)
python -m src.practice_question_author_cli --course-id course_c84474

# Alternative: Generate for specific lesson only
python -m src.practice_question_author_cli --lesson-id lt_abc123

# Step 4: Verify questions in Appwrite console
# Navigate to: Databases > default > practice_questions
# Filter by: lessonTemplateId = "lt_abc123"
```

## Frontend Integration

### Question Fetching (Frontend Responsibility)

```typescript
// assistant-ui-frontend/lib/appwrite/driver/PracticeQuestionDriver.ts

// Check if questions exist (for dashboard gray-out)
const availability = await practiceQuestionDriver.checkQuestionsAvailable(lessonTemplateId);

if (!availability.hasQuestions) {
  // Gray out Practice button - run CLI to generate
  console.error(
    `No practice questions for ${lessonTemplateId}. ` +
    `Run: python -m src.practice_question_author_cli --lesson-id ${lessonTemplateId}`
  );
}

// Fetch random question for practice session
const question = await practiceQuestionDriver.getRandomQuestion(
  lessonTemplateId,
  blockId,
  difficulty,
  excludeIds  // Avoid recently shown questions
);
```

### Backend Marking (Appwrite-Agnostic)

```python
# langgraph-agent/src/agent/infinite_practice_graph.py

async def receive_question_node(state: InfinitePracticeState):
    """
    Validate question provided by frontend.
    NO APPWRITE ACCESS - backend is Appwrite-agnostic.
    """
    current_question = state.get("current_question")

    if not current_question:
        # FAST FAIL - frontend must provide question
        raise ValueError(
            "No question provided in state. "
            "Frontend must fetch from practice_questions collection."
        )

    return {"current_question": current_question, "stage": "present_question"}
```

## Performance Metrics

| Scenario | Without Offline Generation | With Offline Generation |
|----------|---------------------------|------------------------|
| Question retrieval | 3-8 seconds | **~50ms** |
| Question with diagram | Up to 5 minutes | **~100ms** |
| Error rate (small models) | High | **~0%** (pre-validated) |
| Student wait time | Frustrating | **Instant** |

## Error Handling

**No Fallback Pattern** - Fast fail with actionable error messages:

```python
# Frontend: No questions available
raise Error(
    f"No practice questions for lesson={lessonTemplateId}, block={blockId}. " +
    f"Run: python -m src.practice_question_author_cli --lesson-id {lessonTemplateId}"
)

# Backend: Question not in state
raise ValueError(
    "No question provided in state. "
    "Frontend must fetch from practice_questions collection."
)
```

## Implementation Status

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for current implementation progress across all author agents.

## Related Documentation

- **Detailed Guide**: `docs/PRACTICE_QUESTION_AUTHOR_GUIDE.md`
- **Quick Reference**: `docs/QUICK_REFERENCE.md`
- **Frontend Contracts**: `../assistant-ui-frontend/types/practice-wizard-contracts.ts`
- **Frontend Driver**: `../assistant-ui-frontend/lib/appwrite/driver/PracticeQuestionDriver.ts`
- **Backend Graph**: `../langgraph-agent/src/agent/infinite_practice_graph.py`
- **Backend Models**: `../langgraph-agent/src/agent/practice_models.py`
