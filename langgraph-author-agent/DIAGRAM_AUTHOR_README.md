# Diagram Author Deep Agent

Automatically generates high-quality JSXGraph visualizations for Scottish secondary mathematics lesson cards.

## Overview

The Diagram Author Deep Agent is a specialized LangGraph agent that:
- Analyzes lesson cards to identify mathematical content needing visualization
- Generates pedagogically effective JSXGraph diagrams
- Uses multimodal AI to critique and refine diagram quality
- Outputs plain JSON for frontend seeding scripts (Appwrite-agnostic)

## Architecture

```
Main Orchestrator (Gemini Flash Lite)
│
├─► Diagram Author Subagent
│   └─► Generates JSXGraph JSON + renders via DiagramScreenshot
│
└─► Visual Critic Subagent
    └─► Analyzes rendered images (4D scoring: clarity, accuracy, pedagogy, aesthetics)
```

## Files Created

### Core Modules
- **`src/diagram_author_agent.py`** - Main agent with 2 subagents (158 lines)
- **`src/diagram_author_state.py`** - State schema with custom reducers (88 lines)
- **`src/diagram_author_tools.py`** - render_diagram_tool HTTP client (251 lines)
- **`src/diagram_author_prompts.py`** - 3 comprehensive prompts (460 lines)

### Pattern Library
- **`data/jsxgraph_patterns/geometry_patterns.json`** - Right triangles, circles, angles (3 patterns)
- **`data/jsxgraph_patterns/algebra_patterns.json`** - Linear/quadratic functions, coordinates (3 patterns)
- **`data/jsxgraph_patterns/statistics_patterns.json`** - Bar charts, scatter plots, histograms (3 patterns)

### Testing
- **`tests/test_diagram_author_basic.py`** - Unit tests for all modules (185 lines)

## Prerequisites

### 1. DiagramScreenshot Service
The agent requires the DiagramScreenshot service running on port 3001:

```bash
cd diagram-prototypes
docker compose up -d
```

Verify service health:
```bash
curl http://localhost:3001/health
```

### 2. Python Environment
Activate virtual environment with dependencies:

```bash
cd /Users/niladribose/code/ScottishAILessons_All/ScottishAILessons
source venv/bin/activate
```

### 3. Environment Variables
Set in `.env`:
```bash
GOOGLE_API_KEY=<your-gemini-api-key>
DIAGRAM_SCREENSHOT_URL=http://localhost:3001  # Optional, defaults to this
```

## Usage

### Running Tests

```bash
source venv/bin/activate
cd langgraph-author-agent
python tests/test_diagram_author_basic.py
```

Expected output:
```
============================================================
Running Diagram Author Agent Basic Tests
============================================================

✅ State schema imports and dict_merger work correctly
✅ Tools module imports correctly
✅ Prompts module imports correctly with valid content
✅ Pattern file geometry_patterns.json is valid
✅ Pattern file algebra_patterns.json is valid
✅ Pattern file statistics_patterns.json is valid
✅ render_diagram_tool validation works correctly
✅ DiagramScreenshot service is running and healthy
✅ Agent module imports correctly

============================================================
✅ All basic tests passed!
============================================================
```

### Running the Agent

```bash
source venv/bin/activate
cd langgraph-author-agent
python src/diagram_author_agent.py
```

This runs the example in `diagram_author_agent.py` with a sample lesson template.

### Integration with Seeding Scripts

The agent outputs `diagrams.json` which the frontend seeding script consumes:

```bash
# After agent generates diagrams.json
cd assistant-ui-frontend
npm run seed:diagrams -- <courseId> <sow_order>
```

The seeding script:
1. Fetches lesson_template from Appwrite
2. Calls diagram_author agent
3. Persists diagrams to `lesson_diagrams` collection
4. Applies storage strategy (inline <50KB, cloud ≥50KB)

## Key Design Decisions

### 1. Appwrite-Agnostic Architecture
Following the `lesson_author_agent` pattern, this agent:
- ✅ Outputs plain JSON (`diagrams.json`)
- ✅ NO direct Appwrite database operations
- ✅ NO Appwrite MCP tools
- ✅ Frontend seeding script handles persistence

### 2. Two-Subagent Design
Simplified from original 3-subagent spec:
- ❌ Removed "Appwrite Writer Subagent"
- ✅ Kept "Diagram Author Subagent" (generation)
- ✅ Kept "Visual Critic Subagent" (quality)

### 3. Cost Optimization
Uses `models/gemini-flash-lite-latest` instead of `gemini-2.5-pro`:
- ✅ 20x cheaper per token
- ✅ Maintains multimodal vision capabilities
- ✅ Faster response times for iterative refinement

### 4. Quality Threshold
Visual Critic uses 4-dimension weighted scoring:
- **Clarity** (35%): Visual organization and readability
- **Accuracy** (35%): Mathematical correctness
- **Pedagogy** (20%): Learning objectives alignment
- **Aesthetics** (10%): Scottish color palette, accessibility

Acceptance threshold: **≥ 0.85** (strict quality control)

### 5. Scottish Context
All diagrams MUST use:
- **Primary Blue**: `#0066CC` (main elements)
- **Success Green**: `#28a745` (correct answers)
- **Warning Orange**: `#FFA500` (attention points)
- **Danger Red**: `#DC3545` (errors, critical points)
- **Neutral Gray**: `#6c757d` (secondary elements)

Plus: £ currency, meters for distance, CfE terminology

## Output Format

### diagrams.json Structure

```json
{
  "diagrams": [
    {
      "lessonTemplateId": "lesson_template_001",
      "cardId": "card_1",
      "jsxgraph_json": "{\"diagram\":{\"board\":{...},\"elements\":[...]}}",
      "image_base64": "iVBORw0KGgo...",
      "diagram_type": "geometry",
      "visual_critique_score": 0.91,
      "critique_iterations": 2,
      "critique_feedback": [
        {
          "iteration": 1,
          "score": 0.82,
          "improvements": ["Add right angle marker"]
        },
        {
          "iteration": 2,
          "score": 0.91,
          "improvements": []
        }
      ]
    }
  ]
}
```

## Error Handling

The agent implements robust error recovery:

### render_diagram_tool Errors
- **INVALID_JSON**: Fix JSON syntax, retry
- **INVALID_STRUCTURE**: Add missing board/elements
- **TIMEOUT**: Simplify diagram (reduce elements)
- **CONNECTION_ERROR**: Skip diagram, report to main agent

### Quality Refinement
- **Iteration 1**: Full critique, strict scoring
- **Iteration 2**: Focus on improvements, slight leniency (≥0.82)
- **Iteration 3**: Final attempt, increased leniency (≥0.80)

### Failure Handling
If diagram generation fails after 3 attempts:
1. Log to `diagram_errors.json`
2. Continue with remaining cards
3. Return partial success (diagrams that succeeded)

## Next Steps

### Phase 1: Testing (Current)
- [x] Basic module tests pass
- [ ] Integration test with DiagramScreenshot
- [ ] Full lesson template processing test
- [ ] Visual critique accuracy test

### Phase 2: Integration
- [ ] Create frontend seeding script (`seedDiagrams.ts`)
- [ ] Add npm script: `"seed:diagrams": "tsx scripts/seedDiagrams.ts"`
- [ ] Create `lesson_diagrams` Appwrite collection
- [ ] Create `diagrams` Storage bucket

### Phase 3: LangGraph CLI Setup
- [ ] Create `langgraph.json` configuration
- [ ] Set up development server (port 2028)
- [ ] Add health check endpoint
- [ ] Test streaming with LangGraph Studio

### Phase 4: Production
- [ ] Batch processing script for existing lessons
- [ ] Performance optimization (parallel processing)
- [ ] Monitoring and logging
- [ ] Quality metrics dashboard

## Troubleshooting

### DiagramScreenshot service not running
```bash
cd diagram-prototypes
docker compose up -d
curl http://localhost:3001/health
```

### ImportError: No module named 'deepagents'
```bash
source venv/bin/activate
pip install deepagents
```

### GOOGLE_API_KEY not set
```bash
export GOOGLE_API_KEY=<your-api-key>
# Or add to langgraph-author-agent/.env
```

### Port 3001 already in use
```bash
lsof -ti:3001 | xargs kill -9
docker compose up -d
```

## References

- **Specification**: `langgraph-author-agent/tasks/DIAGRAM_AUTHOR_AGENT_SPEC.md`
- **DiagramScreenshot API**: `diagram-prototypes/DIAGRAM_SCREENSHOT_SERVICE_DESIGN.md`
- **Seeding Script Spec**: `diagram-prototypes/DIAGRAM_SCREENSHOT_SERVICE_DESIGN.md` (Section 15)
- **JSXGraph Docs**: https://jsxgraph.org/docs/
- **LangGraph DeepAgents**: https://langchain-ai.github.io/langgraph/

---

**★ Implementation Status**: ✅ **Core modules complete, tests passing**

**Next Milestone**: Frontend seeding script integration
