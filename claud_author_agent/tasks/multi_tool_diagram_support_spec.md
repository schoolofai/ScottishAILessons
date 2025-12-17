# Plan: Multi-Tool Diagram Support for Lesson Diagram Author

## Quick Summary

| Aspect | Current State | Target State |
|--------|--------------|--------------|
| **Tools** | JSXGraph only | 6 tools (DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, NONE) |
| **Classification** | None | 8-rule priority-based (same rules as mock exam) |
| **Tool servers** | Need to create | **ALREADY EXIST** in `src/tools/` |
| **Classification approach** | N/A | **Option B: Inline** - extend eligibility step with dual-context classification |
| **Estimated effort** | - | 5-6 hours (mostly integration, not creation) |

## Why Option B (Inline Classification)?

The mock exam classifier is **question-centric** and not directly reusable for lessons because:
1. **Lessons have dual contexts**: Each card needs separate tool selection for lesson explainer AND CFU
2. **Different content structure**: Lessons have `explainer` + `cfu`, not question stems
3. **Single LLM call efficiency**: Extend existing eligibility analysis instead of running separate agent
4. **Cleaner integration**: No hacky adapter layer needed

## Executive Summary

Extend the Lesson Diagram Author to support **6 diagram tools** (matching Mock Exam Author):
- DESMOS (function graphing)
- MATPLOTLIB (pure geometry - local execution)
- JSXGRAPH (coordinate geometry)
- PLOTLY (statistics/data visualization)
- IMAGE_GENERATION (real-world contextual)
- NONE (no diagram needed)

Currently, Lesson Diagram Author only supports JSXGraph.

---

## Current State Analysis

### Lesson Diagram Author (Single Tool)
```
Location: claud_author_agent/src/diagram_author_claude_client.py

Pipeline:
  PRE-PROCESSING (Python)
  ├── Fetch lesson_template from Appwrite
  ├── LLM-based eligibility filtering (needs diagram Y/N)
  └── Write eligible_cards.json

  AGENT EXECUTION (Claude SDK)
  ├── jsxgraph_researcher_subagent
  ├── diagram_generation_subagent (JSXGraph ONLY)
  └── visual_critic_subagent (4D scoring)

  POST-PROCESSING (Python)
  └── Upsert to Appwrite lesson_diagrams
```

**Limitation**: No tool classification - assumes ALL diagrams are JSXGraph.

### Mock Exam Author (Multi-Tool)
```
Location: claud_author_agent/src/mock_exam_author_claude_client_v2.py

Pipeline:
  Step 3: DIAGRAM CLASSIFICATION (DiagramClassifierAgent)
  ├── Reads mock_exam.json
  ├── Classifies each question → tool type
  └── Outputs classification_output.json

  Step 4: DIAGRAM AUTHORING (DiagramAuthorAgent)
  ├── Reads classification_output.json
  ├── Dynamically registers MCP server per tool
  ├── Iterative critique loop (max 5 iterations)
  └── Progressive threshold: 0.85 → 0.82 → 0.80 → 0.78
```

---

## Classification Logic (From Mock Exam - 8 Priority Rules)

```
Rule Priority Check Order:
┌───────┬──────────────────────────────────────┬──────────────────┐
│ Rule  │ Condition                            │ Tool             │
├───────┼──────────────────────────────────────┼──────────────────┤
│ 1     │ Data points/frequencies present      │ PLOTLY           │
│ 2     │ "function", "graph y=", "plot f(x)"  │ DESMOS           │
│ 3     │ Circle theorems, pure construction   │ MATPLOTLIB       │
│ 4     │ Transformations/vectors on coords    │ JSXGRAPH         │
│ 5     │ Real-world physical scenario         │ IMAGE_GENERATION │
│ 6     │ Angles/bearings WITHOUT coordinates  │ MATPLOTLIB       │
│ 7     │ Lines/points WITH coordinates        │ JSXGRAPH         │
│ 8     │ Purely algebraic, no visualization   │ NONE             │
└───────┴──────────────────────────────────────┴──────────────────┘
```

### Tool Selection Decision Tree (Pseudocode)

```python
def classify_diagram_tool(card_content: str, cfu_content: str) -> ToolType:
    """
    Priority-ordered classification matching mock exam logic.
    Each rule checked in order - first match wins.
    """
    combined = f"{card_content} {cfu_content}".lower()

    # Rule 1: PLOTLY - Statistics/Data
    if has_data_table(combined) or has_frequency_data(combined):
        # Keywords: "frequency", "histogram", "box plot", "scatter"
        # Pattern: numeric data points, tables
        return "PLOTLY"

    # Rule 2: DESMOS - Function Graphing
    if is_function_focused(combined):
        # Keywords: "graph", "plot", "sketch the curve", "y = f(x)"
        # Pattern: function notation, transformations
        return "DESMOS"

    # Rule 3: MATPLOTLIB - Pure Geometry (no coordinates)
    if is_pure_geometry(combined) and not has_coordinates(combined):
        # Keywords: "theorem", "construct", "bisector", "perpendicular"
        # Pattern: circle theorems, angle work, geometric proofs
        return "MATPLOTLIB"

    # Rule 4: JSXGRAPH - Coordinate Transformations
    if has_transformation_on_plane(combined):
        # Keywords: "reflect in", "rotate", "translate by", "enlarge"
        # Pattern: coordinate-based transformations, vectors
        return "JSXGRAPH"

    # Rule 5: IMAGE_GENERATION - Real-world Context (use sparingly!)
    if needs_real_world_context(combined) and not is_actually_geometry(combined):
        # CRITICAL: Many "real-world" problems are just triangles!
        # Ladder against wall → right triangle → MATPLOTLIB
        # Ship on bearing → angle diagram → MATPLOTLIB
        return "IMAGE_GENERATION"

    # Rule 6: MATPLOTLIB - Angles/Bearings without coordinates
    if has_angles_or_bearings(combined) and not has_coordinates(combined):
        # Keywords: "bearing", "angle", "degrees"
        return "MATPLOTLIB"

    # Rule 7: JSXGRAPH - Coordinate Geometry
    if has_coordinates(combined):
        # Pattern: "(x, y)", "A(1,2)", "gradient between points"
        return "JSXGRAPH"

    # Rule 8: NONE - No visualization needed
    return "NONE"
```

---

## Implementation Plan

### Phase 1: Add MCP Tool Servers (Reuse from Mock Exam)

**Files to create/copy:**
```
claud_author_agent/src/tools/
├── desmos_tool.py       # Copy from mock exam, adapt for lessons
├── matplotlib_tool.py   # Copy from mock exam (local Python execution)
├── plotly_tool.py       # Copy from mock exam
├── imagen_tool.py       # Copy from mock exam
└── jsxgraph_tool.py     # Already exists (diagram_screenshot_tool.py)
```

**Pseudocode for tool factory:**
```python
# In diagram_author_claude_client.py

def _get_mcp_servers_for_tool(self, tool_type: str) -> Dict[str, Any]:
    """
    Dynamically return MCP server config based on tool type.
    Same pattern as mock_exam's DiagramAuthorAgent._get_mcp_server_config()
    """
    base_url = self.diagram_service_url  # localhost:3001

    tool_factories = {
        "DESMOS": lambda: create_desmos_server(self.workspace_path, base_url),
        "MATPLOTLIB": lambda: create_matplotlib_server(self.workspace_path, base_url),
        "JSXGRAPH": lambda: create_jsxgraph_server(self.workspace_path, base_url),
        "PLOTLY": lambda: create_plotly_server(self.workspace_path, base_url),
        "IMAGE_GENERATION": lambda: create_imagen_server(self.workspace_path, base_url),
    }

    if tool_type not in tool_factories:
        raise ValueError(f"Unknown tool type: {tool_type}")

    return tool_factories[tool_type]()
```

### Phase 2: Inline Classification in Eligibility Step (Option B)

Extend the existing eligibility analysis to include tool classification for **both** lesson explainer and CFU contexts in a single LLM call.

#### Pydantic Model for Dual-Context Classification

```python
# In claud_author_agent/src/models/diagram_classification_models.py (NEW FILE)

from typing import Literal, Optional
from pydantic import BaseModel, Field

ToolType = Literal["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "NONE"]
ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW"]


class DiagramClassificationReason(BaseModel):
    """Structured reasoning for tool selection."""
    selected_because: str = Field(..., description="Primary reason for tool choice")
    content_analysis: str = Field(..., description="What the content contains")
    decision_rule_applied: str = Field(..., description="Which of the 8 rules matched")
    alternatives_rejected: str = Field(..., description="Why other tools weren't chosen")


class ContextClassification(BaseModel):
    """Classification for a single context (lesson or CFU)."""
    needs_diagram: bool = Field(..., description="Whether this context needs a diagram")
    tool: ToolType = Field(..., description="Best tool for this content, or NONE")
    confidence: ConfidenceLevel = Field(default="HIGH")
    reasoning: DiagramClassificationReason
    visualization_focus: Optional[str] = Field(None, description="What to visualize if tool != NONE")


class CardEligibilityWithTool(BaseModel):
    """Extended eligibility result with dual-context tool classification.

    This replaces the simple needs_diagram boolean with rich classification
    for BOTH the lesson explainer content AND the CFU content separately.
    """
    card_id: str
    card_title: str

    # Lesson explainer classification
    lesson: ContextClassification

    # CFU (Check For Understanding) classification
    cfu: ContextClassification

    # Summary for logging
    summary: str = Field(..., description="One-line summary of classification decisions")


class LessonClassificationResult(BaseModel):
    """Complete classification output for all cards in a lesson."""
    lesson_template_id: str
    total_cards: int
    cards_with_lesson_diagrams: int
    cards_with_cfu_diagrams: int
    classifications: list[CardEligibilityWithTool]
```

#### Classification Prompt with 8-Rule Priority

```python
# In diagram_author_claude_client.py - new method

CLASSIFICATION_PROMPT = """
You are classifying lesson content for diagram tool selection.

## 8-RULE PRIORITY CLASSIFICATION (check in order, first match wins)

| Priority | Condition | Tool | Examples |
|----------|-----------|------|----------|
| 1 | Data points, frequency tables, statistics | PLOTLY | Bar charts, histograms, scatter plots, pie charts |
| 2 | Function graphing (y=, f(x), curves) | DESMOS | y = 2x + 3, quadratic graphs, function transformations |
| 3 | Pure geometry WITHOUT coordinates | MATPLOTLIB | Circle theorems, angle bisectors, constructions, triangles with angles |
| 4 | Transformations ON coordinate plane | JSXGRAPH | Reflect in y=x, rotate 90° about origin, translate by vector |
| 5 | Real-world context (NOT geometric) | IMAGE_GENERATION | Shopping scenarios, real objects - USE SPARINGLY |
| 6 | Angles/bearings WITHOUT coordinates | MATPLOTLIB | Bearing diagrams, angle problems, compass directions |
| 7 | Coordinate geometry (points, lines) | JSXGRAPH | Plot A(1,2), gradient between points, equation of line |
| 8 | Purely algebraic, no visualization | NONE | Solve 2x + 5 = 11, simplify expressions, factoring |

## CRITICAL RULES

1. **Rule 5 (IMAGE_GENERATION) trap**: Many "real-world" problems are actually geometry!
   - "Ladder against wall" → Right triangle → MATPLOTLIB (not IMAGE_GENERATION)
   - "Ship on bearing" → Angle diagram → MATPLOTLIB (not IMAGE_GENERATION)
   - Only use IMAGE_GENERATION for truly contextual images with no geometric focus

2. **MATPLOTLIB vs JSXGRAPH boundary**:
   - If coordinates appear (x,y) → JSXGRAPH
   - If pure shapes/angles without coords → MATPLOTLIB

3. **CFU special rule**: If a CFU asks students to identify/calculate something,
   the diagram must NOT reveal the answer. Mark as NONE if diagram would give it away.

## TASK

Analyze the lesson card below and classify BOTH contexts:

**LESSON EXPLAINER**: Content teaching the concept (may benefit from illustrative diagram)
**CFU (Check For Understanding)**: Practice question (diagram must not reveal answer)

Return classification for EACH context separately.
"""

async def _classify_card_with_tools(
    self,
    card: Dict[str, Any],
    llm: ChatAnthropic
) -> CardEligibilityWithTool:
    """
    Classify a single card for both lesson and CFU diagram requirements.
    Uses structured output for reliable parsing.
    """
    # Extract content
    card_id = card.get("cardId", card.get("$id", "unknown"))
    title = card.get("title", "")
    explainer = card.get("explainer", "")
    cfu_data = card.get("cfu", {})

    # Format CFU content
    if isinstance(cfu_data, dict):
        cfu_stem = cfu_data.get("stem", "")
        cfu_choices = cfu_data.get("choices", [])
        cfu_text = f"Question: {cfu_stem}\nChoices: {cfu_choices}"
    else:
        cfu_text = str(cfu_data)

    # Build card-specific prompt
    card_prompt = f"""
{CLASSIFICATION_PROMPT}

---

## CARD TO CLASSIFY

**Card ID**: {card_id}
**Title**: {title}

**LESSON EXPLAINER CONTENT**:
{explainer}

**CFU CONTENT**:
{cfu_text}

---

Classify this card using the 8-rule priority system for BOTH lesson and CFU contexts.
"""

    # Use structured output
    structured_llm = llm.with_structured_output(CardEligibilityWithTool)

    result = await structured_llm.ainvoke(card_prompt)
    return result
```

#### Integration into Eligibility Analysis

```python
# In diagram_author_claude_client.py - modify existing eligibility flow

async def _analyze_all_cards_for_eligibility(
    self,
    cards: List[Dict[str, Any]]
) -> LessonClassificationResult:
    """
    Analyze all cards for diagram eligibility AND tool classification.
    Replaces the old simple eligibility check.
    """
    logger.info(f"Classifying {len(cards)} cards for diagram requirements...")

    classifications = []
    cards_with_lesson_diagrams = 0
    cards_with_cfu_diagrams = 0

    for card in cards:
        classification = await self._classify_card_with_tools(card, self.llm)
        classifications.append(classification)

        if classification.lesson.needs_diagram and classification.lesson.tool != "NONE":
            cards_with_lesson_diagrams += 1
            logger.info(
                f"  Card '{classification.card_title}' LESSON → {classification.lesson.tool} "
                f"({classification.lesson.confidence})"
            )

        if classification.cfu.needs_diagram and classification.cfu.tool != "NONE":
            cards_with_cfu_diagrams += 1
            logger.info(
                f"  Card '{classification.card_title}' CFU → {classification.cfu.tool} "
                f"({classification.cfu.confidence})"
            )

    result = LessonClassificationResult(
        lesson_template_id=self.lesson_template_id,
        total_cards=len(cards),
        cards_with_lesson_diagrams=cards_with_lesson_diagrams,
        cards_with_cfu_diagrams=cards_with_cfu_diagrams,
        classifications=classifications
    )

    # Write to workspace for debugging
    output_path = self.workspace_path / "classification_result.json"
    with open(output_path, 'w') as f:
        json.dump(result.model_dump(), f, indent=2)
    logger.info(f"✅ Classification written to {output_path}")

    return result
```

### Phase 3: Modify Agent Orchestration

**Current flow:**
```
For each eligible card:
    → Call diagram_generation_subagent (JSXGraph only)
    → Call visual_critic_subagent
    → Iterate until accepted
```

**New flow:**
```
For each eligible card:
    → Read tool_type from classification
    → Register appropriate MCP server dynamically
    → Call diagram_generation_subagent with tool context
    → Call visual_critic_subagent with tool-specific criteria
    → Iterate until accepted (progressive threshold)
```

**Pseudocode for modified execute loop:**
```python
async def _generate_diagram_for_card(
    self,
    card: Dict,
    diagram_context: str,  # "lesson" or "cfu"
    tool_type: str         # NEW: from classification
) -> DiagramResult:
    """Generate diagram using classified tool type."""

    # Step 1: Register MCP server for this tool
    mcp_server_config = self._get_mcp_servers_for_tool(tool_type)

    # Step 2: Load tool-specific prompt/templates
    tool_prompt = self._load_tool_prompt(tool_type)

    # Step 3: Iterative generation loop (same as mock exam)
    for iteration in range(1, self.max_iterations + 1):
        # Generate diagram using tool-specific MCP
        result = await self._render_with_tool(
            card=card,
            tool_type=tool_type,
            mcp_config=mcp_server_config,
            prompt=tool_prompt,
            iteration=iteration
        )

        # Critique using 4D scoring
        critique = await self._critique_diagram(
            image_path=result.image_path,
            tool_type=tool_type,
            diagram_context=diagram_context
        )

        # Progressive threshold check
        threshold = self._get_threshold_for_iteration(iteration)
        if critique.final_score >= threshold:
            return DiagramResult(success=True, ...)

        # REJECT → prompt overhaul, REFINE → incremental
        if critique.decision == "REJECT":
            # Complete redesign
            pass
        else:
            # Apply specific_changes
            pass

    # Max iterations reached - accept with notes or fail
    return self._handle_max_iterations(...)
```

### Phase 4: Extend Prompts with Tool-Specific Guidance

**Files to modify:**
```
claud_author_agent/src/prompts/
├── diagram_author_prompt.md           # Add tool classification awareness
├── diagram_generation_subagent.md     # Add tool-specific generation sections
└── diagram_critic_subagent.md         # Already has tool-specific guidance!
```

**Key additions to diagram_generation_subagent.md:**
```markdown
## Tool-Specific Generation Guidelines

### DESMOS (Function Graphs)
- Use LaTeX expressions format
- Define viewport (xmin, xmax, ymin, ymax)
- Support multiple overlaid functions
- Handle transformations (shifts, stretches)

### MATPLOTLIB (Pure Geometry)
- Generate Python code with `OUTPUT_PATH` placeholder
- Use safe imports: matplotlib, numpy, math
- Pre-compute all coordinates (no runtime calculations)
- Include proper labels and annotations

### JSXGRAPH (Coordinate Geometry)
- Generate board config + elements array
- Use Scottish color palette (#0066CC primary)
- Include axis configuration
- Handle transformations explicitly

### PLOTLY (Statistics)
- Define data + layout objects
- Support bar, pie, histogram, box, scatter
- Use appropriate chart type for data
- Include proper titles and labels

### IMAGE_GENERATION (Contextual)
- Generate descriptive prompt text
- AVOID text in images (causes quality issues)
- Focus on visual context only
- Use sparingly (10x cost of other tools)
```

### Phase 5: Quality Assurance (Match Mock Exam)

**Quality mechanisms to implement:**

1. **Progressive Threshold Policy**
```python
THRESHOLDS = {
    1: 0.85, 2: 0.85,  # Strict
    3: 0.82, 4: 0.82,  # Moderate
    5: 0.80, 6: 0.80,  # Relaxed
}
DEFAULT_THRESHOLD = 0.78  # Iterations 7+
```

2. **REJECT vs REFINE Handling**
```python
if critique.decision == "REJECT":
    # Complete prompt overhaul - different visual concept
    correction_prompt = build_overhaul_prompt(critique)
else:  # REFINE
    # Incremental changes from specific_changes array
    correction_prompt = apply_specific_changes(critique.specific_changes)
```

3. **Tool-Specific Critique Dimensions**
- Same 4D scoring (clarity 0.35, accuracy 0.35, pedagogy 0.20, aesthetics 0.10)
- Tool-specific criteria within each dimension
- CFU-specific rule: "REJECT if answer revealed"

4. **File-Based Communication**
- PNG files written to workspace as paths (not inline base64)
- Critique uses Claude's native Read tool for multimodal analysis
- Reduces token usage significantly

---

## Design Decisions: Ensuring Same Quality as Mock Exam

### 1. Identical Classification Rules
- Use exact same 8-rule priority order
- Same tool boundary decisions (MATPLOTLIB vs JSXGRAPH based on coordinates)
- Same IMAGE_GENERATION caution (many "real-world" problems are actually geometry)

### 2. Identical MCP Tool Implementations
- Copy tool servers directly from mock exam
- Same API contracts (render_desmos, render_matplotlib, etc.)
- Same error handling and timeout policies

### 3. Identical Critique Loop
- Same progressive threshold policy
- Same 4D scoring weights
- Same REJECT → overhaul, REFINE → incremental pattern
- Same max iterations (5 per diagram)

### 4. Identical Fail-Fast Behavior
- No fallback mechanisms
- Critique failures immediately fail the diagram
- Explicit error reporting throughout

---

## Files to Modify/Create

### ALREADY EXISTS (Reusable from Mock Exam)
All 5 MCP tool servers already exist:
```
claud_author_agent/src/tools/desmos_tool.py         # EXISTS - Function graphing
claud_author_agent/src/tools/matplotlib_tool.py     # EXISTS - Pure geometry (local Python)
claud_author_agent/src/tools/jsxgraph_tool.py       # EXISTS - Coordinate geometry
claud_author_agent/src/tools/plotly_tool.py         # EXISTS - Statistics charts
claud_author_agent/src/tools/imagen_tool.py         # EXISTS - Real-world images
```

### New Files (Option B - Inline Classification)

```
claud_author_agent/src/models/diagram_classification_models.py
  - CardEligibilityWithTool (dual-context: lesson + CFU)
  - ContextClassification (tool, confidence, reasoning)
  - LessonClassificationResult (all cards summary)
  - NO adapter to mock exam classifier - clean standalone implementation
```

### Modified Files

**`claud_author_agent/src/diagram_author_claude_client.py`** (Main changes)

```python
# NEW IMPORTS (line ~39)
from .tools.desmos_tool import create_desmos_server
from .tools.matplotlib_tool import create_matplotlib_server
from .tools.jsxgraph_tool import create_jsxgraph_server
from .tools.plotly_tool import create_plotly_server
from .tools.imagen_tool import create_imagen_server
from .models.diagram_classification_models import (
    CardEligibilityWithTool,
    LessonClassificationResult,
    ContextClassification
)

# NEW METHOD: _classify_card_with_tools()
# - Uses CLASSIFICATION_PROMPT with 8-rule priority
# - Returns CardEligibilityWithTool with BOTH lesson and cfu classifications
# - Uses structured output for reliable parsing

# MODIFIED METHOD: _analyze_all_cards_for_eligibility()
# - Now returns LessonClassificationResult instead of simple list
# - Writes classification_result.json to workspace for debugging

# NEW METHOD: _get_mcp_server_for_tool()
def _get_mcp_server_for_tool(self, tool_type: str, workspace_path: str):
    factories = {
        "DESMOS": create_desmos_server,
        "MATPLOTLIB": create_matplotlib_server,
        "JSXGRAPH": create_jsxgraph_server,
        "PLOTLY": create_plotly_server,
        "IMAGE_GENERATION": create_imagen_server,
    }
    if tool_type not in factories:
        raise ValueError(f"Unknown tool type: {tool_type}")
    api_base_url = "http://localhost:3001"
    return factories[tool_type](str(workspace_path), api_base_url, "")

# MODIFIED: _generate_diagram_for_card()
# - Now takes tool_type parameter
# - Dynamically registers MCP server based on tool_type
# - Passes tool-specific context to generation prompt

# MODIFIED: Main execution loop
# - For each card, generate BOTH lesson and CFU diagrams if classified
# - Use lesson.tool for lesson diagram, cfu.tool for CFU diagram
```

**`claud_author_agent/src/prompts/diagram_author_prompt.md`**
- Add tool classification explanation
- Include tool-specific generation guidance sections

**`claud_author_agent/src/utils/diagram_upserter.py`**
- Add `tool_type` field to diagram documents

### Schema Updates
```
Appwrite collection: lesson_diagrams
  + tool_type: string (DESMOS|MATPLOTLIB|JSXGRAPH|PLOTLY|IMAGE_GENERATION)
```

---

## Implementation Order

**Phase 1: Models & Classification** (1-2 hours)
1. Create `diagram_classification_models.py` with Pydantic models
2. Add `CLASSIFICATION_PROMPT` constant to diagram_author_claude_client.py
3. Implement `_classify_card_with_tools()` method

**Phase 2: Tool Integration** (2-3 hours)
4. Add tool factory imports to diagram_author_claude_client.py
5. Implement `_get_mcp_server_for_tool()` method
6. Modify `_analyze_all_cards_for_eligibility()` to use new classification
7. Update main execution loop to handle dual-context (lesson + CFU)

**Phase 3: Prompts & Schema** (1 hour)
8. Update `diagram_author_prompt.md` with tool classification awareness
9. Verify `diagram_generation_subagent.md` has tool-specific sections
10. Add `tool_type` field to diagram_upserter.py
11. Update Appwrite schema if needed

**Phase 4: Testing** (2-3 hours)
12. Test classification with sample lessons covering:
    - Geometry lesson (expect MATPLOTLIB for both contexts)
    - Function graphing lesson (expect DESMOS)
    - Statistics lesson (expect PLOTLY)
    - Coordinate geometry lesson (expect JSXGRAPH)
    - Mixed lesson (expect different tools for lesson vs CFU)
13. Verify quality scores match mock exam baseline

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Classification accuracy | Use exact same 8-rule priority as proven mock exam, with dual-context awareness |
| Tool server compatibility | Reuse existing tool factories directly from `src/tools/` |
| Quality regression | Same progressive thresholds, same 4D critique loop |
| Token usage increase | File-based PNG paths, not inline base64 |
| Service availability | Same fast-fail health checks as mock exam |
| CFU answer leakage | Rule 3 in CRITICAL RULES: NONE if diagram would reveal answer |
| Lesson vs CFU mismatch | Explicit dual-context classification (CardEligibilityWithTool) |

---

## Success Criteria

1. All 6 tools available for lesson diagrams (DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, NONE)
2. Classification uses exact 8-rule priority matching mock exam
3. **DUAL-CONTEXT**: Lesson and CFU classified SEPARATELY per card
4. Quality scores match mock exam baseline
5. No regressions in existing JSXGraph-only diagrams
6. Fail-fast behavior maintained throughout (no fallbacks)
7. CFU diagrams never reveal answers (enforced by classification rule)
