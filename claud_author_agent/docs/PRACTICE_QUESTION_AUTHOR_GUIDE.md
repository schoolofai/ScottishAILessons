# Practice Question Author - Claude Agent SDK Implementation

Autonomous pipeline for pre-generating practice questions for the Infinite Practice system, enabling instant question delivery with pre-rendered diagrams for Scottish secondary education.

## Overview

This agent transforms lesson templates into comprehensive sets of practice questions stored in Appwrite, ready for instant retrieval during student practice sessions. Unlike the real-time `infinite_practice_graph.py` (V1), which generates questions on-demand with 3-8 second latency (up to 5 minutes with diagrams), this offline pipeline pre-generates all questions for instant delivery (~50ms).

**Key Architecture Decision**: Frontend-Driven, Backend-Agnostic
- **Frontend**: Fetches pre-generated questions from Appwrite `practice_questions` collection
- **Backend**: `infinite_practice_graph.py` handles **marking only** - zero Appwrite access
- **Fast-Fail**: No questions available → throw error with CLI remediation command

**Pipeline Architecture**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRACTICE QUESTION AUTHOR PIPELINE                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Phase 1: PRE-PROCESSING (Python, 0 tokens)                            │
│  ├── Lesson Template Extractor → Fetch lesson from Appwrite            │
│  ├── Card Decompressor → Decompress gzip+base64 cards                  │
│  └── Block Identifier → Parse cards into concept blocks                │
│                                                                         │
│  Phase 2: BLOCK GENERATION (Claude Agent SDK, Structured Output)       │
│  └── @block_extraction_agent → Extract concept blocks with metadata    │
│      Output: ConceptBlock[] with title, explanation, worked_example    │
│                                                                         │
│  Phase 3: QUESTION GENERATION (Claude Agent SDK, Per Block)            │
│  FOR EACH block:                                                        │
│  ├── @question_generator_agent (easy) → Generate N easy questions      │
│  ├── @question_generator_agent (medium) → Generate M medium questions  │
│  └── @question_generator_agent (hard) → Generate K hard questions      │
│                                                                         │
│  Phase 4: DIAGRAM GENERATION (REUSED - NO CODE CHANGES)                │
│  FOR EACH question needing diagram:                                     │
│  ├── @diagram_classifier → Determine optimal rendering tool            │
│  │   (DESMOS | MATPLOTLIB | JSXGRAPH | PLOTLY | IMAGE_GENERATION | NONE)│
│  ├── @diagram_author → Generate PNG via MCP/HTTP tool                  │
│  └── @diagram_critic → Validate quality (Claude multimodal vision)     │
│                                                                         │
│  Phase 5: POST-PROCESSING (Python, 0 tokens)                           │
│  ├── Content Hashing → SHA256 for deduplication/cache invalidation     │
│  ├── Block Upsert → Appwrite `practice_blocks` collection              │
│  ├── Question Upsert → Appwrite `practice_questions` collection        │
│  └── Diagram Upload → Appwrite Storage bucket                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why Offline Generation?**
- **Latency**: Real-time generation takes 3-8 seconds per question
- **Diagram Latency**: Real-time diagram generation takes up to 5 minutes
- **Model Quality**: Smaller/faster models produce frequent errors in real-time
- **Pre-validation**: All questions validated before student sees them
- **Cost Efficiency**: Generate once, serve infinitely

## Features

- **Instant Question Delivery**: ~50ms retrieval vs 3-8s generation
- **Pre-Generated Diagrams**: ~100ms load vs 5 minute generation
- **Configurable Counts**: N easy, M medium, K hard questions per block
- **Open-Close Principle**: Reuses DiagramClassifierAgent and DiagramAuthorAgent without modification
- **Content Hashing**: Deduplication via SHA256 hash of question content
- **Batch Processing**: Generate for entire course in single command
- **Cost Tracking**: Per-subagent token usage and cost metrics
- **Scottish Curriculum**: SQA-aligned, British English, Scottish contexts
- **Fast-Fail Pattern**: Clear errors with CLI remediation (no silent fallback)

---

## Quickstart

### Prerequisites

- Python 3.11+
- Claude Agent SDK access (Anthropic API key)
- Appwrite instance (credentials configured in `.mcp.json`)
- DiagramScreenshot service running (for diagram generation)
- Lesson templates must exist in `default.lesson_templates` collection

### 5-Minute Setup

```bash
# 1. Navigate to agent directory
cd claud_author_agent

# 2. Create and activate virtual environment
python3 -m venv ../venv
source ../venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and set:
#   ANTHROPIC_API_KEY=your-api-key
#   DIAGRAM_API_URL=http://localhost:3001  (DiagramScreenshot service)
#   DIAGRAM_API_KEY=your-diagram-api-key   (optional)

# 5. Configure Appwrite credentials
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your Appwrite credentials

# 6. Create Appwrite collections (one-time setup)
python scripts/setup_practice_questions_infrastructure.py --mcp-config .mcp.json

# 7. Run the agent for a single lesson
python -m src.practice_question_author_cli --lesson-id lt_abc123

# Or generate for entire course
python -m src.practice_question_author_cli --course-id course_c84474
```

### Quick Test (Dry Run)

```bash
# Dry run - generates questions but doesn't upsert to Appwrite
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --dry-run \
  --log-level DEBUG

# View generated questions in workspace
cat workspace/<timestamp>/questions_output.json
```

---

## Installation

### System Requirements

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.11+ | Agent runtime |
| Anthropic API | - | Claude SDK access |
| Appwrite | 1.4+ | Database backend (via Python SDK) |
| DiagramScreenshot | 1.0+ | Diagram rendering API |

### Step-by-Step Installation

```bash
# Clone repository (if not already done)
git clone --recurse-submodules https://github.com/schoolofai/ScottishAILessons.git
cd ScottishAILessons/claud_author_agent

# Create virtual environment
python3 -m venv ../venv
source ../venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "from src.practice_question_author_claude_client import PracticeQuestionAuthorClaudeClient; print('OK')"
```

### Environment Configuration

Create `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-...

# Diagram Service (required for diagram generation)
DIAGRAM_API_URL=http://localhost:3001
DIAGRAM_API_KEY=optional-api-key

# Optional
LOG_LEVEL=INFO
PERSIST_WORKSPACE=true
```

### Appwrite Credentials Configuration

Create `.mcp.json` (used as a credentials config file):

```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": [
        "APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID=your-project-id",
        "APPWRITE_API_KEY=your-api-key"
      ]
    }
  }
}
```

---

## Usage

### Available Scripts

| Script | Purpose | Best For |
|--------|---------|----------|
| `src.practice_question_author_cli` | Main generation pipeline | Single lesson or batch course |
| `scripts/setup_practice_questions_infrastructure.py` | One-time Appwrite setup | Initial collection creation |

### Main Generation Pipeline

```bash
python -m src.practice_question_author_cli [OPTIONS]
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--lesson-id` | One of | - | Single lesson template ID |
| `--course-id` | these | - | Process all lessons in course |
| `--easy` | No | 5 | Number of easy questions per block |
| `--medium` | No | 5 | Number of medium questions per block |
| `--hard` | No | 3 | Number of hard questions per block |
| `--regenerate` | No | False | Overwrite existing questions |
| `--dry-run` | No | False | Generate but don't upsert |
| `--mcp-config` | No | `.mcp.json` | Path to Appwrite credentials |
| `--persist-workspace` | No | True | Keep workspace after execution |
| `--log-level` | No | `INFO` | Logging verbosity |

### Examples

```bash
# Generate for single lesson (default: 5 easy, 5 medium, 3 hard per block)
python -m src.practice_question_author_cli --lesson-id lt_abc123

# Generate for entire course
python -m src.practice_question_author_cli --course-id course_c84474

# Custom question counts
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --easy 10 \
  --medium 8 \
  --hard 5

# Regenerate existing questions (overwrites)
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --regenerate

# Dry run for testing
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --dry-run \
  --log-level DEBUG
```

### Batch Processing

```bash
# Generate for all lessons in a course (recommended)
python -m src.practice_question_author_cli --course-id course_c84474

# Or manually loop through lessons
for lesson in lt_abc123 lt_def456 lt_ghi789; do
  python -m src.practice_question_author_cli --lesson-id $lesson
done
```

---

## Architecture

### Subagent Definitions

| Subagent | Model | Purpose |
|----------|-------|---------|
| `block_extraction_agent` | claude-sonnet-4-5 | Extract concept blocks from lesson cards |
| `question_generator_agent` | claude-sonnet-4-5 | Generate questions per block/difficulty |

**Diagram Pipeline Agents (reused from Mock Exam Author - NO CODE CHANGES):**

| Subagent | Model | Purpose |
|----------|-------|---------|
| `diagram_classifier` | claude-haiku-3-5 | Classify content for diagram tool |
| `diagram_author` | claude-sonnet-4-5 | Generate diagrams via MCP/HTTP tools |
| `diagram_critic` | claude-sonnet-4-5 | Validate diagram quality |

### Diagram Tool Selection

The classifier determines the optimal rendering tool based on question content:

| Priority | Condition | Tool | Use Case |
|----------|-----------|------|----------|
| 1 | Data points/frequencies | PLOTLY | Bar charts, histograms, scatter plots |
| 2 | "function", "graph y=" | DESMOS | Function graphing, parabolas, trig |
| 3 | Circle theorems, constructions | JSXGRAPH | Pure geometry, angle proofs |
| 4 | Transformations with coords | JSXGRAPH | Reflections, rotations, vectors |
| 5 | Real-world physical context | IMAGE_GENERATION | Ladders, bridges, scenarios |
| 6 | Geometry WITHOUT coordinates | JSXGRAPH | Bearings, angles, triangles |
| 7 | Lines/points WITH coordinates | JSXGRAPH | Coordinate geometry |
| 8 | No visualization needed | NONE | Pure algebraic, word problems |

### Pydantic Models

**ConceptBlock** (Block Extraction Output):

```python
class WorkedExample(BaseModel):
    problem: str
    solution_steps: List[str]
    final_answer: str

class ConceptBlock(BaseModel):
    block_id: str               # Unique identifier
    title: str                  # Block title (max 255)
    explanation: str            # Core concept explanation
    worked_example: Optional[WorkedExample]
    key_formulas: List[str]     # Mathematical formulas
    common_misconceptions: List[str]
    outcome_refs: List[str]     # Learning outcome IDs
```

**GeneratedQuestion** (Question Generator Output):

```python
class GeneratedQuestion(BaseModel):
    stem: str                   # Question text (may contain LaTeX)
    type: Literal["mcq", "numeric", "structured_response"]
    options: Optional[List[str]]  # MCQ options (4 items)
    correct_index: Optional[int]  # MCQ correct index (0-3)
    expected_answer: Optional[str]  # Numeric answer
    expected_points: Optional[List[str]]  # Structured response key points
    correct_answer: str         # Display answer
    solution_explanation: str   # Step-by-step solution
    hints: List[str]            # Progressive hints (2-3)

    # Diagram fields (populated by diagram pipeline)
    diagram_base64: Optional[str]
    diagram_description: Optional[str]
    diagram_title: Optional[str]
    diagram_type: Optional[Literal["geometry", "algebra", "statistics"]]
```

### File-Based Communication

Subagents communicate via workspace files:

```
/workspace/
├── inputs/
│   ├── lesson_template.json       # Input: Full lesson template
│   └── sow_context.json           # Input: Course metadata
├── outputs/
│   ├── blocks_extracted.json      # Block extraction output
│   ├── questions_easy.json        # Easy questions per block
│   ├── questions_medium.json      # Medium questions per block
│   ├── questions_hard.json        # Hard questions per block
│   ├── questions_combined.json    # All questions merged
│   └── generation_metrics.json    # Token/cost metrics
├── diagrams/
│   ├── classification_input.json  # Diagram classifier input
│   ├── classification_output.json # Diagram classifier output
│   └── q_<id>_diagram.png         # Generated diagram PNGs
└── logs/
    └── execution.log              # Detailed execution log
```

---

## Appwrite Collections

### `practice_questions` Collection

Stores pre-generated questions with their diagrams.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `lessonTemplateId` | string(50) | Yes | Links to `lesson_templates` |
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

```javascript
indexes: [
  { key: "lesson_block_diff_idx", columns: ["lessonTemplateId", "blockId", "difficulty"], type: "key" },
  { key: "lesson_status_idx", columns: ["lessonTemplateId", "status"], type: "key" },
  { key: "content_hash_idx", columns: ["contentHash"], type: "key" },
  { key: "execution_idx", columns: ["executionId"], type: "key" }
]
```

### `practice_blocks` Collection

Stores extracted concept blocks from lesson templates.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `lessonTemplateId` | string(50) | Yes | Links to `lesson_templates` |
| `blockId` | string(100) | Yes | Unique block identifier |
| `blockIndex` | integer | Yes | Zero-based position in lesson |
| `title` | string(255) | Yes | Block title |
| `explanationFileId` | string(100) | Yes | Appwrite file ID for explanation |
| `workedExampleFileId` | string(100) | No | Appwrite file ID for worked example |
| `keyFormulasFileId` | string(100) | No | Appwrite file ID for formulas |
| `commonMisconceptions` | string(5000) | No | JSON array of misconceptions |
| `outcomeRefs` | string(500) | No | JSON array of learning outcome IDs |
| `contentHash` | string(64) | Yes | SHA256 for cache invalidation |
| `generatorVersion` | string(20) | Yes | Agent version |
| `executionId` | string(50) | Yes | Unique execution identifier |
| `generatedAt` | datetime | Yes | Generation timestamp |

**Indexes**:

```javascript
indexes: [
  { key: "lesson_block_idx", columns: ["lessonTemplateId", "blockId"], type: "unique" },
  { key: "content_hash_idx", columns: ["contentHash"], type: "key" }
]
```

---

## Frontend Integration

### PracticeQuestionDriver (Frontend)

The frontend uses `PracticeQuestionDriver` to fetch pre-generated questions:

**File**: `assistant-ui-frontend/lib/appwrite/driver/PracticeQuestionDriver.ts`

```typescript
// Check if questions exist (for dashboard gray-out)
const availability = await practiceQuestionDriver.checkQuestionsAvailable(lessonTemplateId);

if (!availability.hasQuestions) {
  // Gray out Practice button
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

// Get all questions for a block
const questions = await practiceQuestionDriver.getQuestionsForBlock(
  lessonTemplateId,
  blockId
);

// Get all blocks for a lesson
const blocks = await practiceQuestionDriver.getBlocksForLesson(lessonTemplateId);
```

### Dashboard Gray-Out Logic

**File**: `assistant-ui-frontend/components/curriculum/CourseCurriculum.tsx`

```typescript
// Check practice availability for all lessons
useEffect(() => {
  const checkAvailability = async () => {
    const driver = createDriver(PracticeQuestionDriver);
    const availability: Record<string, QuestionAvailability> = {};

    for (const lesson of lessons) {
      availability[lesson.lessonTemplateId] =
        await driver.checkQuestionsAvailable(lesson.lessonTemplateId);
    }

    setPracticeAvailability(availability);
  };

  checkAvailability();
}, [lessons]);

// Gray out Practice button when no questions
const isGrayedOut = !availability?.hasQuestions;

<Button
  disabled={isGrayedOut}
  className={isGrayedOut ? 'opacity-50 cursor-not-allowed' : ''}
  title={isGrayedOut
    ? 'Practice questions not yet generated for this lesson'
    : `${availability?.totalCount} practice questions available`
  }
>
  Practice
</Button>
```

### Backend Integration (Marking Only)

**File**: `langgraph-agent/src/agent/infinite_practice_graph.py`

The backend graph is **Appwrite-agnostic** - it only handles marking:

```python
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
            "Frontend must fetch from practice_questions collection. "
            f"Run: python -m src.practice_question_author_cli --lesson-id {state.get('lesson_template_id')}"
        )

    # Validate required fields
    required_fields = ["question_id", "stem", "correct_answer", "questionType", "difficulty"]
    for field in required_fields:
        if field not in current_question:
            raise ValueError(f"Question missing required field: {field}")

    return {
        "current_question": current_question,
        "stage": "present_question"
    }
```

---

## Performance Metrics

| Scenario | Without Offline Generation | With Offline Generation |
|----------|---------------------------|------------------------|
| Question retrieval | 3-8 seconds | **~50ms** |
| Question with diagram | Up to 5 minutes | **~100ms** |
| Error rate (small models) | High | **~0%** (pre-validated) |
| Student wait time | Frustrating | **Instant** |

### Cost Estimation

| Phase | Model | Tokens (per lesson) | Cost (est.) |
|-------|-------|---------------------|-------------|
| Block Extraction | claude-sonnet-4-5 | ~8K | $0.24 |
| Question Generation (13 questions) | claude-sonnet-4-5 | ~25K | $0.75 |
| Diagram Classification | claude-haiku-3-5 | ~3K | $0.008 |
| Diagram Generation (5 diagrams) | claude-sonnet-4-5 | ~10K | $0.30 |
| Diagram Critique (5 diagrams) | claude-sonnet-4-5 | ~8K | $0.24 |
| **Total per lesson** | - | **~54K** | **~$1.54** |

*Costs vary based on lesson complexity and diagram requirements.*

---

## Troubleshooting

### Common Issues

#### "No lesson template found"

```
Error: Lesson template not found: lt_abc123
```

**Solution**: Ensure the lesson template exists in `default.lesson_templates` collection.

#### "No questions generated"

```
Error: Question generation returned 0 questions for block X
```

**Solution**: Check workspace logs for LLM errors. May need prompt adjustment for specific content types.

#### "Diagram generation timeout"

**Solution**: Increase timeout or check DiagramScreenshot service:
```bash
tail -f diagram-screenshot-service/logs/app.log
```

#### "Content hash conflict"

```
Error: Document with content_hash X already exists
```

**Solution**: Use `--regenerate` flag to overwrite existing questions:
```bash
python -m src.practice_question_author_cli --lesson-id lt_abc123 --regenerate
```

### Debug Mode

```bash
# Enable verbose logging
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --log-level DEBUG \
  --persist-workspace

# Check workspace files
ls -la workspace/<timestamp>/
cat workspace/<timestamp>/outputs/questions_combined.json
cat workspace/<timestamp>/logs/execution.log
```

### Workspace Files for Debugging

| File | Check For |
|------|-----------|
| `inputs/lesson_template.json` | Lesson extraction correct? |
| `outputs/blocks_extracted.json` | Blocks identified correctly? |
| `outputs/questions_*.json` | Questions valid? Diverse? |
| `diagrams/classification_output.json` | Correct tool selected? |
| `logs/execution.log` | Any errors or warnings? |

---

## Error Handling

**No Fallback Pattern** - Fast fail with actionable error messages:

```python
# Pipeline: No questions available
raise ValueError(
    f"No questions generated for lesson={lesson_template_id}, block={block_id}. "
    f"Check workspace logs at: {workspace_path}/logs/execution.log"
)

# Frontend: No offline questions
raise Error(
    `No practice questions for lesson=${lessonTemplateId}, block=${blockId}. ` +
    `Run: python -m src.practice_question_author_cli --lesson-id ${lessonTemplateId}`
)

# Backend: Question not in state
raise ValueError(
    "No question provided in state. "
    "Frontend must fetch from practice_questions collection."
)
```

---

## Typical Workflow

### Full Course Setup

```bash
# Step 1: Create SOW (if not already done)
python -m src.sow_author_cli \
  --subject mathematics \
  --level national-5 \
  --courseId course_c84474

# Step 2: Author all lessons (if not already done)
for order in {1..12}; do
  python -m src.lesson_author_cli \
    --courseId course_c84474 \
    --order $order
done

# Step 3: Generate practice questions for entire course
python -m src.practice_question_author_cli --course-id course_c84474

# Step 4: Verify in Appwrite console
# Navigate to: Databases > default > practice_questions
# Filter by: lessonTemplateId contains "course_c84474"
```

### Single Lesson Update

```bash
# Regenerate questions for updated lesson
python -m src.practice_question_author_cli \
  --lesson-id lt_abc123 \
  --regenerate

# Verify new questions
python -c "
from src.utils.practice_question_upserter import PracticeQuestionUpserter
upserter = PracticeQuestionUpserter('.mcp.json')
count = upserter.count_questions('lt_abc123')
print(f'Questions: {count}')
"
```

---

## Related Documentation

- **Main README**: [PRACTICE_QUESTION_AUTHOR_README.md](../PRACTICE_QUESTION_AUTHOR_README.md)
- **Architecture Plan**: `/Users/niladribose/.claude/plans/swirling-marinating-hellman.md`
- **Frontend Contracts**: `assistant-ui-frontend/types/practice-wizard-contracts.ts`
- **Frontend Driver**: `assistant-ui-frontend/lib/appwrite/driver/PracticeQuestionDriver.ts`
- **Backend Graph**: `langgraph-agent/src/agent/infinite_practice_graph.py`
- **Backend Models**: `langgraph-agent/src/agent/practice_models.py`
- **Mock Exam Author**: [MOCK_EXAM_AUTHOR_GUIDE.md](./MOCK_EXAM_AUTHOR_GUIDE.md)
- **Lesson Author**: [../LESSON_AUTHOR_README.md](../LESSON_AUTHOR_README.md)

---

## Changelog

### v1.0.0 (2025-12-13)
- Initial release
- Block extraction from lesson templates
- Question generation per block/difficulty
- Integrated diagram generation pipeline (reused from Mock Exam Author)
- Appwrite collections: `practice_questions`, `practice_blocks`
- Frontend integration: `PracticeQuestionDriver`
- Dashboard gray-out logic for lessons without offline questions
- Fast-fail pattern with CLI remediation commands
