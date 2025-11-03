# Data Model: Claude Diagram Generation Agent

**Feature**: Claude Diagram Generation Agent
**Branch**: `001-claude-diagram-agent`
**Date**: 2025-10-31

This document defines all entities, relationships, and state machines for the diagram generation system.

---

## Core Entities

### 1. DiagramGenerationRequest

**Purpose**: Input schema for diagram generation (single lesson or batch)

**Source**: CLI arguments, JSON file, or interactive prompt

**Fields**:
```python
{
    "courseId": str,                    # Course identifier (e.g., "course_c84874")
    "lesson_template_id": str,          # Target lesson template (single mode)
    "order": int,                       # SOW order (alternative to lesson_template_id)
    "force": bool,                      # Regenerate existing diagrams (default: False)
    "dry_run": bool,                    # Preview without execution (batch only, default: False)
    "persist_workspace": bool,          # Keep workspace after execution (default: True)
    "log_level": str,                   # Logging verbosity (default: "INFO")
    "mcp_config_path": str              # MCP configuration file (default: ".mcp.json")
}
```

**Validation Rules**:
- `courseId` MUST match pattern `course_[a-zA-Z0-9]+`
- `lesson_template_id` OR `order` MUST be provided (mutually exclusive in single mode)
- `order` MUST be ≥1 (SOW entries are 1-indexed)
- `log_level` MUST be one of: DEBUG, INFO, WARNING, ERROR
- `mcp_config_path` file MUST exist

---

### 2. LessonTemplate

**Purpose**: Lesson template fetched from Appwrite (input to diagram generation)

**Source**: Appwrite `default.lesson_templates` collection

**Fields**:
```python
{
    "lessonTemplateId": str,            # Primary key (e.g., "lesson_template_001")
    "courseId": str,                    # Foreign key to courses collection
    "sow_order": int,                   # Sequential position in SOW
    "title": str,                       # Lesson title (30-80 chars)
    "lesson_type": str,                 # teach|independent_practice|formative_assessment|revision|mock_exam
    "estMinutes": int,                  # Estimated duration (5-180 minutes)
    "cards": [Card],                    # Array of lesson cards (see Card entity)
    "outcomeRefs": [str],               # SQA outcome codes
    "engagement_tags": [str],           # Scottish context tags
    "policy": dict,                     # Lesson constraints (JSON)
    "createdBy": str,                   # Agent/user identifier
    "version": int,                     # Template version number
    "status": str                       # draft|review|published
}
```

**Relationships**:
- One LessonTemplate has many Cards (1:N)
- One LessonTemplate may have many LessonDiagrams (1:N, created by this agent)

---

### 3. Card

**Purpose**: Individual learning card within lesson template

**Source**: Nested within LessonTemplate.cards array

**Fields**:
```python
{
    "id": str,                          # Card ID (e.g., "card_001", "card_002")
    "title": str,                       # Card heading
    "explainer": str,                   # Detailed learning content
    "explainer_plain": str,             # CEFR A2-B1 accessible version
    "cfu": dict,                        # Check For Understanding (type-specific)
    "rubric": Rubric,                   # Marking scheme
    "misconceptions": [Misconception]   # Anticipated student errors
}
```

**CFU Types** (discriminated by `cfu.type` field):
- `mcq`: Multiple choice (requires `answerIndex`)
- `numeric`: Numeric answer (requires `expected`, `tolerance`, `money2dp`)
- `structured_response`: Multi-part written response
- `short_text`: Brief written response

---

### 4. DiagramCard

**Purpose**: Extracted card that requires diagram generation (subset of Card)

**Source**: Derived from LessonTemplate.cards via eligibility filter

**Fields**:
```python
{
    "lessonTemplateId": str,            # Parent lesson template ID
    "cardId": str,                      # Card identifier (e.g., "card_001")
    "title": str,                       # Card title
    "content": str,                     # Explainer text (mathematical content)
    "cfu_type": str,                    # Type of CFU (mcq|numeric|structured_response|short_text)
    "cfu_stem": str,                    # Question text from CFU
    "mathematical_concepts": [str],     # Extracted: geometry, algebra, fractions, etc.
    "diagram_type": str                 # Inferred: geometry|algebra|statistics|mixed
}
```

**Eligibility Rules** (card needs diagram if ANY condition met):
1. CFU type is `numeric` AND stem mentions geometric terms (triangle, circle, angle, etc.)
2. CFU type is `structured_response` AND stem includes diagram instructions
3. Explainer contains mathematical expressions suitable for visualization (coordinates, inequalities, functions)
4. Explicit diagram request keywords: "visualize", "graph", "plot", "diagram", "illustrate"

**Exclusions** (card does NOT need diagram):
- Plain text MCQs with no visual context
- Short text CFUs asking for definitions or explanations
- Cards explicitly marked as text-only in metadata

---

### 5. JSXGraphDiagram

**Purpose**: Generated JSXGraph JSON specification for rendering

**Source**: Created by diagram_author_subagent

**Fields**:
```python
{
    "diagram": {
        "board": {
            "boundingbox": [float, float, float, float],  # [x_min, y_max, x_max, y_min]
            "axis": bool,                                  # Show coordinate axes
            "showNavigation": bool,                        # Show zoom controls (default: False)
            "showCopyright": bool                          # Show JSXGraph copyright (default: False)
        },
        "elements": [
            {
                "type": str,                               # point|line|circle|curve|text|polygon|angle
                "args": [Any],                             # Type-specific arguments
                "attributes": {
                    "name": str,                           # Element label
                    "size": int,                           # Point size
                    "strokeColor": str,                    # Line/border color (Scottish palette)
                    "fillColor": str,                      # Fill color (Scottish palette)
                    "strokeWidth": int,                    # Line thickness
                    "withLabel": bool,                     # Show name label
                    "label": dict                          # Label configuration
                }
            }
        ]
    }
}
```

**Scottish Color Palette** (MUST use these colors):
- Primary Blue: `#0066CC` (main elements, axes)
- Success Green: `#28a745` (correct answers, target values)
- Warning Orange: `#FFA500` (attention points, important labels)
- Danger Red: `#DC3545` (errors, incorrect values)
- Neutral Gray: `#6c757d` (secondary elements, grids)

**Validation Rules**:
- `boundingbox` MUST have 4 numeric values
- `elements` array MUST NOT be empty
- Element `type` MUST be valid JSXGraph type
- Colors MUST use Scottish palette (validated by visual critic)

---

### 6. RenderedImage

**Purpose**: PNG image rendered from JSXGraph JSON via DiagramScreenshot service

**Source**: HTTP POST to DiagramScreenshot service `/api/v1/render`

**Fields**:
```python
{
    "success": bool,                    # Rendering success status
    "image": str,                       # Base64-encoded PNG data (if success=True)
    "metadata": {
        "width": int,                   # Image width in pixels
        "height": int,                  # Image height in pixels
        "render_time_ms": int,          # Rendering duration
        "jsxgraph_version": str         # JSXGraph library version
    },
    "error": str,                       # Error message (if success=False)
    "error_code": str                   # Machine-readable error code
}
```

**Error Codes**:
- `INVALID_JSON`: JSON parsing failed
- `INVALID_STRUCTURE`: Missing diagram.board or diagram.elements
- `TIMEOUT`: Rendering exceeded 30 second timeout
- `CONNECTION_ERROR`: Cannot reach DiagramScreenshot service
- `HTTP_ERROR`: Service returned non-200 status

---

### 7. VisualCritique

**Purpose**: Quality assessment of rendered diagram from visual_critic_subagent

**Source**: Multi-modal analysis by Claude Sonnet 4.5 with vision capabilities

**Fields**:
```python
{
    "iteration": int,                   # Refinement iteration number (1-3)
    "overall_score": float,             # Weighted composite score (0.0-1.0)
    "clarity_score": float,             # Visual organization and readability (0.0-1.0)
    "accuracy_score": float,            # Mathematical correctness (0.0-1.0)
    "pedagogy_score": float,            # Learning objectives alignment (0.0-1.0)
    "aesthetics_score": float,          # Scottish palette, accessibility (0.0-1.0)
    "feedback": [str],                  # Specific improvement suggestions
    "accepted": bool                    # Met quality threshold (≥0.85)
}
```

**Scoring Weights**:
- Clarity: 35% (most important for student comprehension)
- Accuracy: 35% (mathematical correctness critical)
- Pedagogy: 20% (alignment with learning outcomes)
- Aesthetics: 10% (Scottish branding, accessibility)

**Formula**:
```
overall_score = (clarity_score * 0.35) +
                (accuracy_score * 0.35) +
                (pedagogy_score * 0.20) +
                (aesthetics_score * 0.10)
```

**Quality Threshold**: `overall_score ≥ 0.85` for acceptance

**Refinement Loop**:
1. If `overall_score < 0.85` AND `iteration < 3`: Refine and re-critique
2. If `overall_score ≥ 0.85`: Accept diagram
3. If `iteration == 3` AND `overall_score < 0.85`: **FAIL** (no fallback to low-quality diagram)

---

### 8. LessonDiagram

**Purpose**: Persisted diagram entity in Appwrite (output of diagram generation)

**Source**: Appwrite `default.lesson_diagrams` collection

**Fields**:
```python
{
    "$id": str,                         # Appwrite document ID (auto-generated)
    "lessonTemplateId": str,            # Foreign key to lesson_templates
    "cardId": str,                      # Card identifier (e.g., "card_001")
    "jsxgraph_json": str,               # Serialized JSXGraph JSON (see JSXGraphDiagram)
    "image_base64": str,                # Base64-encoded PNG image
    "diagram_type": str,                # geometry|algebra|statistics|mixed
    "visual_critique_score": float,     # Final accepted score (0.0-1.0)
    "critique_iterations": int,         # Number of refinement iterations (1-3)
    "critique_feedback": [VisualCritique],  # Serialized critique history (JSON)
    "execution_id": str,                # Unique generation execution ID (timestamp-based)
    "createdAt": datetime,              # Auto-generated by Appwrite
    "updatedAt": datetime               # Auto-generated by Appwrite
}
```

**Relationships**:
- Many LessonDiagrams belong to one LessonTemplate (N:1)
- `lessonTemplateId` + `cardId` combination SHOULD be unique (enforced in batch skip logic)

**Appwrite Collection Configuration**:
```json
{
  "collectionId": "lesson_diagrams",
  "databaseId": "default",
  "attributes": [
    {"key": "lessonTemplateId", "type": "string", "size": 50, "required": true},
    {"key": "cardId", "type": "string", "size": 20, "required": true},
    {"key": "jsxgraph_json", "type": "string", "size": 10000, "required": true},
    {"key": "image_base64", "type": "string", "size": 500000, "required": true},
    {"key": "diagram_type", "type": "string", "size": 20, "required": true},
    {"key": "visual_critique_score", "type": "double", "required": true},
    {"key": "critique_iterations", "type": "integer", "required": true},
    {"key": "critique_feedback", "type": "string", "size": 5000, "required": true},
    {"key": "execution_id", "type": "string", "size": 50, "required": true}
  ],
  "indexes": [
    {"key": "lessonTemplateId_idx", "type": "key", "attributes": ["lessonTemplateId"]},
    {"key": "cardId_idx", "type": "key", "attributes": ["cardId"]},
    {"key": "unique_lesson_card", "type": "unique", "attributes": ["lessonTemplateId", "cardId"]}
  ]
}
```

---

### 9. ExecutionReport

**Purpose**: Final result returned from agent.execute() (single lesson mode)

**Source**: Compiled by DiagramAuthorClaudeAgent

**Fields**:
```python
{
    "success": bool,                    # Overall execution success
    "execution_id": str,                # Unique execution identifier (YYYYMMDD_HHMMSS)
    "workspace_path": str,              # Absolute path to workspace directory
    "lessonTemplateId": str,            # Processed lesson template ID
    "diagrams_generated": int,          # Count of successfully generated diagrams
    "diagrams_skipped": int,            # Count of cards without diagrams needed
    "appwrite_document_ids": [str],     # List of created Appwrite document IDs
    "metrics": CostMetrics,             # Token usage and cost breakdown
    "errors": [dict],                   # List of errors encountered (if any)
    "timestamp": datetime               # Execution completion time
}
```

**Success Criteria**:
- `success = True` if at least one diagram generated OR no diagrams needed
- `success = False` if errors prevented any diagram generation

---

### 10. CostMetrics

**Purpose**: Token usage and cost tracking across all subagent invocations

**Source**: Tracked by CostTracker utility (reused from claud_author_agent)

**Fields**:
```python
{
    "execution_id": str,                # Execution identifier
    "total_tokens": int,                # Sum of input + output tokens
    "input_tokens": int,                # Total input tokens
    "output_tokens": int,               # Total output tokens
    "total_cost_usd": float,            # Total cost in USD
    "subagent_breakdown": [
        {
            "subagent_name": str,       # diagram_author_subagent | visual_critic_subagent
            "invocations": int,         # Number of times invoked
            "input_tokens": int,        # Tokens for this subagent (input)
            "output_tokens": int,       # Tokens for this subagent (output)
            "cost_usd": float           # Cost for this subagent
        }
    ],
    "execution_time_seconds": float,    # Total execution duration
    "model": str                        # Claude model used (claude-sonnet-4-5)
}
```

**Pricing** (Claude Sonnet 4.5 as of January 2025):
- Input tokens: $3.00 per 1M tokens
- Output tokens: $15.00 per 1M tokens

**Formula**:
```
total_cost_usd = (input_tokens / 1_000_000 * 3.00) +
                 (output_tokens / 1_000_000 * 15.00)
```

---

### 11. BatchReport

**Purpose**: Summary of batch processing results (batch mode)

**Source**: Compiled by DiagramAuthorBatchProcessor

**Fields**:
```python
{
    "success": bool,                    # True if no errors, False if any failures
    "courseId": str,                    # Course identifier
    "total_lessons": int,               # Total lesson templates found
    "lessons_processed": int,           # Lessons that went through diagram generation
    "lessons_skipped": int,             # Lessons with existing diagrams (no --force)
    "diagrams_generated": int,          # Total diagrams created across all lessons
    "errors": [
        {
            "lesson_template_id": str,
            "sow_order": int,
            "error": str                # Error message
        }
    ],
    "aggregate_metrics": CostMetrics,   # Sum of all individual execution metrics
    "timestamp": datetime               # Batch completion time
}
```

---

### 12. DryRunReport

**Purpose**: Cost preview analysis without execution (batch --dry-run mode)

**Source**: Compiled by DiagramAuthorBatchProcessor._analyze_batch_dry_run()

**Fields**:
```python
{
    "dry_run": bool,                    # Always True for dry-run reports
    "courseId": str,                    # Course identifier
    "total_lessons": int,               # Total lesson templates in course
    "lessons_needing_diagrams": int,    # Lessons with eligible cards
    "lessons_with_existing_diagrams": int,  # Lessons to skip (no --force)
    "total_eligible_cards": int,        # Sum of cards needing diagrams
    "estimated_tokens": int,            # Rough token estimate (5,000 per diagram)
    "estimated_cost_usd": float,        # Estimated cost based on token estimate
    "lessons_details": [
        {
            "lesson_template_id": str,
            "sow_order": int,
            "title": str,
            "eligible_cards": int,      # Count of cards needing diagrams
            "has_existing_diagrams": bool
        }
    ],
    "timestamp": datetime
}
```

**Estimation Formula**:
```
tokens_per_diagram = 5000  # Average: generation (3K) + critique (2K)
estimated_tokens = total_eligible_cards * tokens_per_diagram
estimated_cost_usd = (estimated_tokens * 0.6) * (3 / 1_000_000) +  # 60% input
                     (estimated_tokens * 0.4) * (15 / 1_000_000)   # 40% output
```

---

## State Machines

### Diagram Generation State Machine

**States**:
1. `INIT`: Execution started, workspace created
2. `FETCHING`: Fetching lesson_template from Appwrite
3. `FILTERING`: Identifying cards needing diagrams
4. `GENERATING`: Diagram author subagent creating JSXGraph JSON
5. `RENDERING`: DiagramScreenshot service rendering PNG
6. `CRITIQUING`: Visual critic subagent analyzing rendered image
7. `REFINING`: Diagram author improving based on critique (if score < 0.85)
8. `ACCEPTED`: Diagram met quality threshold
9. `PERSISTING`: Writing to Appwrite lesson_diagrams collection
10. `COMPLETED`: Execution finished successfully
11. `FAILED`: Error occurred (fast-fail, no fallback)

**Transitions**:
```
INIT → FETCHING
FETCHING → FILTERING (if lesson found) | FAILED (if not found)
FILTERING → GENERATING (if cards need diagrams) | COMPLETED (if no diagrams needed)
GENERATING → RENDERING
RENDERING → CRITIQUING (if render success) | FAILED (if render failure)
CRITIQUING → ACCEPTED (if score ≥ 0.85) | REFINING (if score < 0.85 AND iteration < 3) | FAILED (if iteration = 3 AND score < 0.85)
REFINING → GENERATING (next iteration)
ACCEPTED → PERSISTING
PERSISTING → COMPLETED (if all diagrams persisted) | FAILED (if persistence error)
```

**Error Handling**:
- ANY state can transition to FAILED on exception
- FAILED state logs error, cleans up workspace (if --no-persist-workspace), returns error report
- NO automatic retry or fallback (Constitution Principle I: fast-fail)

---

## Relationships Diagram

```
Course (1)
  └── LessonTemplate (N)
        ├── Cards (N)
        └── LessonDiagrams (N)
              ├── JSXGraphDiagram (1)
              ├── RenderedImage (1)
              └── VisualCritique (1-3)

ExecutionReport (1)
  ├── LessonTemplate (1)
  ├── LessonDiagrams (N)
  └── CostMetrics (1)
        └── SubagentMetrics (2: diagram_author, visual_critic)

BatchReport (1)
  ├── ExecutionReports (N)
  └── AggregateMetrics (1)
```

---

## Data Flow

### Single Lesson Mode

```
CLI Input (courseId + order)
  ↓
Pre-Processing (Python)
  - Fetch LessonTemplate from Appwrite
  - Filter eligible DiagramCards
  - Copy JSXGraph patterns to workspace
  ↓
Agent Execution (Claude SDK)
  - For each DiagramCard:
    ↓
    Diagram Author Subagent
      - Generate JSXGraph JSON
      - Call render_diagram MCP tool
    ↓
    Visual Critic Subagent
      - Analyze rendered PNG
      - Score across 4 dimensions
    ↓
    Refinement Loop (Python orchestrator)
      - If score < 0.85 AND iteration < 3: Refine
      - If score ≥ 0.85: Accept
      - If iteration = 3 AND score < 0.85: FAIL
  ↓
Post-Processing (Python)
  - Persist LessonDiagrams to Appwrite
  - Generate ExecutionReport with CostMetrics
  ↓
CLI Output (success banner + report)
```

### Batch Mode

```
CLI Input (courseId + --batch)
  ↓
Batch Processor (Python loop)
  - Fetch all LessonTemplates for courseId
  - For each LessonTemplate:
    ↓
    Single Lesson Mode (as above)
  ↓
  - Collect results + errors
  ↓
BatchReport with aggregate metrics
```

---

## Validation Rules Summary

| Entity | Field | Validation |
|--------|-------|------------|
| DiagramGenerationRequest | courseId | Pattern: `course_[a-zA-Z0-9]+` |
| DiagramGenerationRequest | order | ≥1 (SOW 1-indexed) |
| LessonTemplate | lesson_type | Enum: teach, independent_practice, formative_assessment, revision, mock_exam |
| LessonTemplate | estMinutes | 5-180 (5-120 for regular, 5-180 for mock_exam) |
| JSXGraphDiagram | board.boundingbox | 4 numeric values |
| JSXGraphDiagram | elements | NOT empty array |
| JSXGraphDiagram | attributes.strokeColor | Scottish palette colors |
| VisualCritique | overall_score | 0.0-1.0, threshold ≥0.85 |
| VisualCritique | iteration | 1-3 (max iterations) |
| LessonDiagram | lessonTemplateId + cardId | Unique combination in Appwrite |

---

This data model provides complete coverage of entities, relationships, state machines, and validation rules for the Claude Diagram Generation Agent implementation.
