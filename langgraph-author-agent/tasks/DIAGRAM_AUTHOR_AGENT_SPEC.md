# Diagram Author Deep Agent - Complete Specification

## Executive Summary

The Diagram Author Deep Agent is a specialized LangGraph agent that automatically generates high-quality JSXGraph visualizations for lesson cards in the Scottish AI Lessons platform. It is **completely Appwrite-agnostic** and outputs JSON that frontend seeding scripts use to populate the `lesson_diagrams` Appwrite collection.

### Key Features
- **Multi-modal AI**: Uses Gemini Flash Lite with vision capabilities for cost-effective visual critique
- **Two-Subagent Architecture**: Diagram authoring → visual critique
- **Appwrite-Agnostic**: Outputs JSON for frontend seeding scripts (no direct database access)
- **Quality Assurance**: Iterative refinement based on visual analysis with 4-dimension scoring
- **Pattern Library**: Reusable JSXGraph patterns from proven prototypes
- **Clean Separation**: LangGraph generates diagrams, frontend scripts handle Appwrite persistence

---

## Database Schema

### New Collection: `lesson_diagrams`

```typescript
interface LessonDiagram {
  // Primary Keys & Foreign Keys
  $id: string;                    // Appwrite auto-generated document ID
  lessonTemplateId: string;       // FK to lesson_templates.$id
  cardId: string;                 // FK to card ID in lesson_templates.cards[]

  // Diagram Content
  jsxgraph_json: string;          // Stringified JSXGraph structure (max 8000 chars)
  image_base64: string;           // Base64 encoded PNG for inline storage (<50KB)
  image_url: string;              // Appwrite Storage file ID for large images (≥50KB)

  // Classification & Metadata
  diagram_type: 'geometry' | 'algebra' | 'statistics' | 'function' | 'other';
  version: number;                // Diagram version (1, 2, 3...)
  status: 'draft' | 'approved' | 'archived';

  // Quality Metrics
  visual_critique_score: number;  // 0.0-1.0 weighted score from Visual Critic
  critique_iterations: number;    // How many refinement cycles occurred
  critique_feedback: string;      // JSON array of critique history

  // Audit Fields
  createdBy: string;              // User/agent ID
  createdAt: string;              // ISO 8601 timestamp
  updatedAt: string;              // ISO 8601 timestamp
}
```

### Appwrite Collection Configuration

**Collection Name**: `lesson_diagrams`

**Attributes**:
```typescript
[
  { key: 'lessonTemplateId', type: 'string', size: 255, required: true },
  { key: 'cardId', type: 'string', size: 255, required: true },
  { key: 'jsxgraph_json', type: 'string', size: 8000, required: true },
  { key: 'image_base64', type: 'string', size: 100000, required: false },
  { key: 'image_url', type: 'string', size: 500, required: false },
  { key: 'diagram_type', type: 'enum', elements: ['geometry', 'algebra', 'statistics', 'function', 'other'], required: true },
  { key: 'version', type: 'integer', required: true, default: 1 },
  { key: 'status', type: 'enum', elements: ['draft', 'approved', 'archived'], required: true, default: 'draft' },
  { key: 'visual_critique_score', type: 'float', required: true, default: 0.0 },
  { key: 'critique_iterations', type: 'integer', required: true, default: 0 },
  { key: 'critique_feedback', type: 'string', size: 4000, required: false },
  { key: 'createdBy', type: 'string', size: 255, required: true }
]
```

**Indexes**:
```typescript
[
  {
    name: 'lesson_template_idx',
    type: 'key',
    attributes: ['lessonTemplateId']
  },
  {
    name: 'card_unique_idx',
    type: 'unique',
    attributes: ['lessonTemplateId', 'cardId'],
    // Ensures one diagram per card per lesson template
  },
  {
    name: 'status_score_idx',
    type: 'key',
    attributes: ['status', 'visual_critique_score'],
    orders: ['ASC', 'DESC']
    // Efficient queries for approved diagrams sorted by quality
  },
  {
    name: 'type_idx',
    type: 'key',
    attributes: ['diagram_type']
    // Query diagrams by mathematical category
  }
]
```

**Permissions**:
```typescript
[
  Permission.read(Role.any()),              // Public read for frontend
  Permission.create(Role.any()),            // Agent can create
  Permission.update(Role.any()),            // Agent can update
  Permission.delete(Role.users())           // Only authenticated users can delete
]
```

### Why Normalized Schema?

1. **Scalability**: Prevents lesson_templates.cards from hitting 8000 char limit
2. **Independent Versioning**: Update diagrams without modifying lesson templates
3. **Query Performance**: Indexed lookups for diagrams by lesson/card
4. **Reusability**: Same diagram can be referenced across multiple lessons
5. **Storage Optimization**: Large images stored in Appwrite Storage, not in documents

---

## Architecture

### Two-Subagent Design (Appwrite-Agnostic)

```
Main Orchestrator (Gemini Flash Lite Multi-modal)
│
├─► Diagram Author Subagent
│   │  • Receives: lesson template card data (from JSON input)
│   │  • Analyzes: learning objective, content type
│   │  • Generates: JSXGraph JSON structure
│   │  • Calls: render_diagram_tool (DiagramScreenshot HTTP API)
│   │  • Returns: { jsxgraph_json, image_base64 }
│   │
│   └─► Visual Critic Subagent (Gemini Flash Lite Vision)
│       │  • Receives: JSXGraph JSON + rendered image
│       │  • Analyzes: clarity, accuracy, pedagogy, aesthetics
│       │  • Scores: 4-dimension weighted score (0.0-1.0)
│       │  • Decides: ACCEPT (score ≥ 0.85) or REFINE (score < 0.85)
│       │  • Returns: { score, feedback, decision }
│
└─► Output: diagrams.json
    │  • Format: Array of diagram objects (NOT Appwrite documents)
    │  • Each object contains: lessonTemplateId, cardId, jsxgraph_json, image_base64, metadata
    │  • No Appwrite-specific fields ($id, createdAt, etc.)
    │  • Frontend seeding script converts to Appwrite documents
```

### Tool Integration

**Tools Available** (NO Appwrite tools):
1. **render_diagram_tool** (DiagramScreenshot API)
   - Endpoint: `http://localhost:3001/api/v1/render`
   - Input: `{ diagram: { board: {...}, elements: [...] } }`
   - Output: `{ success: true, image: "<base64>", metadata: {...} }`

**Tools NOT Available**:
- ❌ No Appwrite MCP tools (create_lesson_diagram_doc, upload_to_storage, get_lesson_template)
- ❌ No direct database access
- ❌ No Appwrite Storage integration

### Clean Separation Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  LangGraph Agent (Appwrite-Agnostic)                            │
│  • Input: lesson_template.json (plain JSON)                     │
│  • Process: Generate diagrams with quality critique             │
│  • Output: diagrams.json (plain JSON)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        diagrams.json
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Frontend Seeding Script (assistant-ui-frontend/scripts/)       │
│  • Reads: diagrams.json                                         │
│  • Transforms: Add Appwrite-specific fields ($id, timestamps)   │
│  • Persists: Create documents in lesson_diagrams collection     │
│  • Handles: Storage strategy (inline vs cloud based on size)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Schema

### File: `langgraph-author-agent/src/diagram_author_state.py`

```python
from __future__ import annotations
from typing import Dict, List, NotRequired, Any
from typing_extensions import Annotated
from deepagents import DeepAgentState


def dict_merger(left: Dict | None, right: Dict | None) -> Dict | None:
    """Reducer for concurrent diagram updates from multiple subagents.

    Merges diagram dictionaries with right taking precedence for conflicts.
    Used for concurrent updates to the diagrams state field.
    """
    if left is None:
        return right
    elif right is None:
        return left
    else:
        merged = left.copy()
        merged.update(right)
        return merged


class DiagramAuthorState(DeepAgentState):
    """State schema for Diagram Author Deep Agent.

    This extends DeepAgentState with diagram-specific fields.
    The diagrams field uses a custom reducer to handle concurrent updates.

    NOTE: This state is Appwrite-agnostic - no database IDs, no storage references.
    """

    # Input: Lesson template to process (plain JSON, no Appwrite fields)
    lesson_template_id: NotRequired[str]  # For reference only, not FK
    lesson_template: NotRequired[Dict[str, Any]]  # Plain JSON structure

    # Processing state: diagrams by card ID
    # Format: { "card_1": { "jsxgraph_json": {...}, "image_base64": "...", "critique": {...} } }
    diagrams: Annotated[NotRequired[Dict[str, Dict[str, Any]]], dict_merger]

    # Output: Array of diagram objects for frontend seeding script
    # NO Appwrite-specific fields like $id, createdAt, updatedAt
    output_diagrams: NotRequired[List[Dict[str, Any]]]

    # Processing metadata
    total_cards: NotRequired[int]
    cards_processed: NotRequired[int]
    cards_with_diagrams: NotRequired[int]

    # Error tracking
    errors: NotRequired[List[Dict[str, Any]]]
```

---

## Prompts

**File**: `langgraph-author-agent/src/diagram_author_prompts.py`

### 1. Main Agent Prompt (`DIAGRAM_AGENT_PROMPT`)
- Orchestrates the workflow, coordinates two subagents
- Outputs `diagrams.json` with array of diagram objects
- **NO mentions of Appwrite, no database operations**

### 2. Diagram Author Subagent Prompt (`DIAGRAM_AUTHOR_SUBAGENT_PROMPT`)
- Generates JSXGraph JSON with Scottish palette
- Uses DiagramScreenshot HTTP API for rendering
- **NO Appwrite tools, only render_diagram_tool**

### 3. Visual Critic Subagent Prompt (`VISUAL_CRITIC_SUBAGENT_PROMPT`)
- Multi-modal critique with 4-dimension scoring
- Returns scores and feedback for refinement
- **NO database interactions**

---

## JSXGraph Pattern Library

Patterns organized by mathematical domain in `langgraph-author-agent/data/jsxgraph_patterns/`:

- **geometry_patterns.json**: Triangles, circles, polygons, transformations
- **algebra_patterns.json**: Functions, equations, coordinate geometry
- **statistics_patterns.json**: Charts, distributions, data visualization
- **number_patterns.json**: Number lines, fractions, sequences

Each pattern includes:
- Unique ID and descriptive name
- Tags for searchability
- CfE outcome alignment
- Complete JSXGraph JSON
- Customization points documentation

---

## Data Flow Examples

### Example: Complete Flow for Pythagorean Theorem Card

**Step 1: Input Lesson Template Card**
```json
{
  "$id": "lesson_template_001",
  "cards": [
    {
      "id": "card_1",
      "cardType": "teach",
      "title": "Pythagorean Theorem",
      "content": "In a right triangle with sides a=3, b=4, the hypotenuse c can be found using a² + b² = c²."
    }
  ]
}
```

**Step 2: Diagram Author Generates JSXGraph JSON**
(See section 7.1 for complete JSON structure)

**Step 3: Visual Critic Scores (Iteration 1)**
```json
{
  "decision": "REFINE",
  "final_score": 0.82,
  "specific_improvements": [
    "Add right angle marker at point B",
    "Change hypotenuse label color from red to primary blue"
  ]
}
```

**Step 4: Refined Diagram (Iteration 2)**
(Incorporates feedback, achieves score 0.91)

**Step 5: Agent Output (diagrams.json)**
```json
{
  "diagrams": [
    {
      "lessonTemplateId": "lesson_template_001",
      "cardId": "card_1",
      "jsxgraph_json": "{\"diagram\":{...}}",
      "image_base64": "iVBORw0KGgo...",
      "diagram_type": "geometry",
      "visual_critique_score": 0.91,
      "critique_iterations": 2,
      "critique_feedback": "[{\"iteration\":1,\"score\":0.82,...},{\"iteration\":2,\"score\":0.91,...}]"
    }
  ]
}
```

**Step 6: Frontend Seeding Script (assistant-ui-frontend/scripts/seed-diagrams.ts)**
```typescript
// Read agent output
const { diagrams } = JSON.parse(fs.readFileSync('diagrams.json', 'utf-8'));

// Transform and persist to Appwrite
for (const diagram of diagrams) {
  // Determine storage strategy
  const imageSize = Buffer.from(diagram.image_base64, 'base64').length;

  let appwriteDoc = {
    lessonTemplateId: diagram.lessonTemplateId,
    cardId: diagram.cardId,
    jsxgraph_json: diagram.jsxgraph_json,
    diagram_type: diagram.diagram_type,
    visual_critique_score: diagram.visual_critique_score,
    critique_iterations: diagram.critique_iterations,
    critique_feedback: diagram.critique_feedback,
    status: 'approved',
    version: 1,
    createdBy: 'diagram_author_agent'
  };

  if (imageSize < 50000) {
    // Inline storage
    appwriteDoc.image_base64 = diagram.image_base64;
    appwriteDoc.image_url = '';
  } else {
    // Cloud storage
    const fileId = await uploadToStorage(diagram.image_base64);
    appwriteDoc.image_base64 = '';
    appwriteDoc.image_url = fileId;
  }

  await databases.createDocument('default', 'lesson_diagrams', ID.unique(), appwriteDoc);
}
```

---

## Frontend Integration

### Query Pattern: Get Diagram for Card

```typescript
import { databases, Query } from '@/lib/appwrite';

async function getDiagramForCard(
  lessonTemplateId: string,
  cardId: string
): Promise<LessonDiagram | null> {
  const response = await databases.listDocuments(
    'default',              // Database ID
    'lesson_diagrams',      // Collection ID
    [
      Query.equal('lessonTemplateId', lessonTemplateId),
      Query.equal('cardId', cardId),
      Query.equal('status', 'approved')
    ]
  );

  return response.documents[0] || null;
}
```

### Rendering Pattern: Display Diagram in Card

```typescript
import { useEffect, useState } from 'react';
import JSXGraph from 'jsxgraph';

function CardDiagram({ lessonTemplateId, cardId }: CardDiagramProps) {
  const [diagram, setDiagram] = useState<LessonDiagram | null>(null);

  useEffect(() => {
    async function fetchDiagram() {
      const diagramDoc = await getDiagramForCard(lessonTemplateId, cardId);
      setDiagram(diagramDoc);
    }
    fetchDiagram();
  }, [lessonTemplateId, cardId]);

  useEffect(() => {
    if (diagram && diagram.jsxgraph_json) {
      const jsxgraphData = JSON.parse(diagram.jsxgraph_json);
      const board = JXG.JSXGraph.initBoard('jxgbox', jsxgraphData.diagram.board);

      jsxgraphData.diagram.elements.forEach((element: any) => {
        board.create(element.type, element.args, element.attributes);
      });
    }
  }, [diagram]);

  if (!diagram) return null;

  return (
    <div className="card-diagram">
      {/* Fallback static image */}
      {diagram.image_base64 && (
        <img
          src={`data:image/png;base64,${diagram.image_base64}`}
          alt="Diagram preview"
        />
      )}

      {/* Interactive JSXGraph */}
      <div id="jxgbox" className="jxgbox" />

      {/* Quality indicator */}
      <div>Quality: {(diagram.visual_critique_score * 100).toFixed(0)}%</div>
    </div>
  );
}
```

---

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Create `lesson_diagrams` Appwrite collection
- [ ] Add all attributes (lessonTemplateId, cardId, jsxgraph_json, image_base64, image_url, etc.)
- [ ] Create indexes (lesson_template_idx, card_unique_idx, status_score_idx, type_idx)
- [ ] Set permissions (read any, create any, update any, delete users)
- [ ] Create `lesson-diagrams` Storage bucket (for large images ≥50KB)

### Phase 2: Pattern Library
- [ ] Create `langgraph-author-agent/data/jsxgraph_patterns/geometry_patterns.json`
- [ ] Create `langgraph-author-agent/data/jsxgraph_patterns/algebra_patterns.json`
- [ ] Create `langgraph-author-agent/data/jsxgraph_patterns/statistics_patterns.json`
- [ ] Document each pattern with description, use case, bounding box recommendations

### Phase 3: State Schema
- [ ] Create `langgraph-author-agent/src/diagram_author_state.py`
- [ ] Implement `dict_merger` reducer for concurrent updates
- [ ] Define `DiagramAuthorState` class extending `DeepAgentState`

### Phase 4: Tools Module
- [ ] Create `langgraph-author-agent/src/diagram_author_tools.py`
- [ ] Implement `render_diagram_tool` (HTTP client for DiagramScreenshot)
- [ ] **NO Appwrite tools** (no create_lesson_diagram_doc, upload_to_storage, get_lesson_template)

### Phase 5: Prompts Module
- [ ] Create `langgraph-author-agent/src/diagram_author_prompts.py`
- [ ] Write `DIAGRAM_AGENT_PROMPT` (main orchestrator, outputs diagrams.json)
- [ ] Write `DIAGRAM_AUTHOR_SUBAGENT_PROMPT` (JSXGraph generation)
- [ ] Write `VISUAL_CRITIC_SUBAGENT_PROMPT` (image analysis)
- [ ] **NO Appwrite Writer prompt** (no database subagent)

### Phase 6: Main Agent
- [ ] Create `langgraph-author-agent/src/diagram_author_agent.py`
- [ ] Initialize Gemini Flash Lite multi-modal model (cost-effective with vision capabilities)
- [ ] Configure **two subagents** (Diagram Author, Visual Critic)
- [ ] Use `async_create_deep_agent` from deepagents library
- [ ] **NO Appwrite tools** in tool list

### Phase 7: Startup Script
- [ ] Create `langgraph-author-agent/scripts/start_diagram_author.sh`
- [ ] Add health check for DiagramScreenshot (http://localhost:3001/health)
- [ ] Start DiagramScreenshot if not running (docker compose up)
- [ ] Start diagram author agent
- [ ] Output written to `diagrams.json` (not Appwrite)

### Phase 8: Frontend Seeding Script
- [ ] Create `assistant-ui-frontend/scripts/seed-diagrams.ts`
- [ ] Read `diagrams.json` from LangGraph agent
- [ ] Transform to Appwrite document format
- [ ] Implement storage strategy (inline vs cloud based on size)
- [ ] Create documents in `lesson_diagrams` collection
- [ ] Handle errors and retries

### Phase 9: Testing
- [ ] Unit tests for `render_diagram_tool` (HTTP client)
- [ ] Integration test: single card diagram generation → diagrams.json
- [ ] Integration test: full lesson template processing → diagrams.json
- [ ] Validation: Frontend seeding script successfully creates Appwrite documents

### Phase 10: Documentation
- [ ] Update `docs/appwrite-data-model.md` with lesson_diagrams schema
- [ ] Document separation: LangGraph (agnostic) vs Frontend (Appwrite integration)
- [ ] Add frontend seeding script documentation

---

## Success Criteria

### Functional Requirements
- ✅ Agent processes lesson templates and generates diagrams for appropriate cards
- ✅ Diagrams are mathematically accurate and pedagogically effective
- ✅ Visual Critic scores diagrams objectively across 4 dimensions
- ✅ Only diagrams with scores ≥ 0.85 are approved and persisted
- ✅ Foreign key relationships maintained (lessonTemplateId, cardId)
- ✅ Storage strategy correctly applied (inline vs cloud based on size)
- ✅ Frontend can query and render diagrams using lesson_diagrams collection

### Performance Requirements
- ✅ Diagram generation: < 10 seconds per card (including critique iterations)
- ✅ Full lesson template processing: < 2 minutes for 12-card lesson
- ✅ Query performance: < 100ms for single diagram lookup (with indexes)
- ✅ Batch processing: 100+ lesson templates per hour

### Quality Requirements
- ✅ 90%+ of approved diagrams have scores ≥ 0.85
- ✅ 95%+ of geometric diagrams are mathematically accurate
- ✅ 100% of diagrams use Scottish color palette
- ✅ Zero database integrity violations (FK constraints hold)

---

## Error Handling

### Error Scenarios and Recovery

| Error Type | Detection | Recovery |
|------------|-----------|----------|
| **DiagramScreenshot Unavailable** | Connection refused | Skip diagram, continue |
| **Render Timeout** | HTTP timeout >30s | Retry once, then skip |
| **Invalid JSXGraph JSON** | Service returns 400 | Provide feedback, re-generate (max 3) |
| **Low Score After 3 Iterations** | Score < 0.85 after max iterations | Create as 'draft' status |
| **Storage Upload Failure** | Appwrite Storage error | Fall back to inline base64 |
| **FK Violation** | lessonTemplateId not found | Skip diagram, log error |

---

## File Structure

```
langgraph-author-agent/
├── src/
│   ├── diagram_author_agent.py          # Main agent (2 subagents, NO Appwrite)
│   ├── diagram_author_state.py          # State schema (Appwrite-agnostic)
│   ├── diagram_author_tools.py          # render_diagram_tool ONLY (HTTP client)
│   └── diagram_author_prompts.py        # 2 subagent prompts (NO Appwrite Writer)
├── scripts/
│   └── start_diagram_author.sh          # Startup script → outputs diagrams.json
├── data/
│   └── jsxgraph_patterns/
│       ├── geometry_patterns.json       # Triangles, circles, angles
│       ├── algebra_patterns.json        # Functions, equations
│       └── statistics_patterns.json     # Charts, histograms
├── tasks/
│   └── DIAGRAM_AUTHOR_AGENT_SPEC.md     # This document
└── tests/
    ├── test_diagram_tools.py            # Unit tests (HTTP client only)
    ├── test_diagram_agent.py            # Integration tests (JSON output)
    └── fixtures/
        └── sample_lesson_template.json  # Test data

assistant-ui-frontend/scripts/
└── seed-diagrams.ts                     # Appwrite integration layer
    • Reads: diagrams.json
    • Writes: lesson_diagrams collection
    • Handles: Storage strategy, FK validation
```

---

## References

- **DiagramScreenshot API**: `diagramScreenshot/README.md`
- **Appwrite Data Model**: `docs/appwrite-data-model.md`
- **JSXGraph Documentation**: https://jsxgraph.org/docs/
- **LangGraph DeepAgents**: https://langchain-ai.github.io/langgraph/
- **Gemini Vision**: https://ai.google.dev/gemini-api/docs/vision

---

**★ Insight ─────────────────────────────────────**

**1. Separation of Concerns**: Following the lesson_author_agent pattern, the LangGraph agent is completely Appwrite-agnostic, outputting plain JSON that frontend seeding scripts transform into Appwrite documents. This keeps the agent portable and testable.

**2. Two-Subagent Architecture**: Removing the "Appwrite Writer Subagent" simplifies the design. The agent focuses solely on diagram generation and quality critique, leaving database persistence to the frontend layer where it belongs.

**3. Frontend as Integration Layer**: The `assistant-ui-frontend/scripts/seed-diagrams.ts` script acts as the broker between LangGraph (domain logic) and Appwrite (infrastructure), implementing storage strategy and FK validation at the appropriate architectural layer.

─────────────────────────────────────────────────

**Document Version**: 3.0
**Last Updated**: 2025-10-07
**Status**: Approved - Appwrite-Agnostic Architecture
