# Diagram Eligibility LLM-Based Filtering - Specification

**Status**: Approved
**Priority**: High
**Created**: 2025-11-07
**Implementation**: Claude Code

---

## Problem Statement

The diagram author system currently uses simple keyword matching to determine which lesson cards need JSXGraph diagrams. This approach incorrectly flags non-diagram content for visualization, leading to:

1. **False Positives**: Content like assessment rubrics, worksheets, and forms trigger diagram generation
2. **Wasted Resources**: LLM tokens and rendering time spent on ineligible content
3. **Generation Failures**: Subagents struggle to create JSXGraph diagrams for non-mathematical content
4. **Poor User Experience**: Inappropriate diagrams stored in database

### Example Problematic Case

**Card Content**: "Self-Assessment: Pythagoras' Theorem Performance Scale - Beginning (0-30), Developing (30-60), Secure (60-100)"

**Current Behavior**:
- Keywords detected: "Pythagoras", "theorem", "scale"
- Decision: **ELIGIBLE** ✅
- Result: Attempts to create JSXGraph visualization of a rubric/form (fails)

**Expected Behavior**:
- Semantic analysis: This is an assessment rubric, not a mathematical diagram
- Decision: **EXCLUDED** ❌
- Reason: "Assessment rubric/performance scale - not JSXGraph compatible"

---

## Current Implementation

### Keyword-Based Heuristic (`diagram_extractor.py:237-347`)

**Visual Keywords** (triggers eligibility):
```python
visual_keywords = [
    "triangle", "rectangle", "circle", "square", "polygon", "angle",
    "line", "point", "coordinate", "graph", "plot", "axis",
    "gradient", "slope", "equation", "function", "parabola",
    "sketch", "draw", "diagram", "visualize", "represent",
    "chart", "histogram", "scatter", "distribution",
    "quadratic", "linear", "simultaneous"
]
```

**Skip Keywords** (prevents eligibility):
```python
skip_keywords = [
    "define", "definition", "explain", "describe", "list",
    "state", "what is", "meaning of"
]
```

**Decision Logic**:
- `visual_keywords > 0 AND skip_keywords == 0` → **ELIGIBLE**
- Otherwise → **NOT ELIGIBLE**

### Limitations

1. **No Semantic Understanding**: Cannot distinguish:
   - ✅ "Calculate the area of a rectangle" (needs diagram)
   - ❌ "List three properties of rectangles" (no diagram needed)

2. **No Content Type Differentiation**:
   - Cannot distinguish mathematical diagrams from concept maps, rubrics, worksheets, photos

3. **Placeholder LLM Code**:
   ```python
   if llm_client is None:
       logger.warning("Using simple heuristic - provide LLM client for production")
       return _simple_eligibility_heuristic(cards)
   # TODO: Implement LLM-based eligibility analysis
   ```

---

## Solution: LLM-Based Semantic Analysis

### Overview

Replace keyword matching with Claude-powered semantic analysis that understands:
- **Content purpose**: Mathematical visualization vs form/template vs concept diagram
- **JSXGraph compatibility**: Can this be rendered with geometric/algebraic elements?
- **Educational value**: Does a diagram support the learning objective?

### Eligible Content Types

**JSXGraph Mathematical Diagrams** (INCLUDE):
- ✅ Geometric constructions (triangles, circles, polygons, angles)
- ✅ Coordinate graphs (functions, lines, points, slopes)
- ✅ Statistical charts (bar, histogram, scatter plots)
- ✅ Algebraic visualizations (number lines, equation graphs)

### Excluded Content Types

**Not JSXGraph Compatible** (EXCLUDE):
- ❌ Assessment rubrics and performance scales
- ❌ Worksheets and fill-in forms/templates
- ❌ Concept maps and mind maps
- ❌ Real-world photographs or illustrations
- ❌ Text-only explanations or definitions
- ❌ Lists or step-by-step procedures without geometric/graphical component

---

## Implementation Plan

### 1. Update Diagram Extractor (`diagram_extractor.py`)

**Replace**:
```python
def _simple_eligibility_heuristic(cards: List[Dict]) -> List[CardEligibility]:
    # Keyword matching logic
    pass
```

**With**:
```python
async def _llm_based_eligibility_analysis(
    cards: List[Dict[str, Any]],
    llm_client: DiagramAuthorClaudeClient
) -> List[CardEligibility]:
    """Use LLM to semantically determine diagram eligibility."""

    if llm_client is None:
        raise ValueError(
            "LLM client is required for diagram eligibility analysis. "
            "No fallback pattern - this is a strict requirement."
        )

    eligibility_prompt = """
    Analyze this lesson card and determine if it needs a JSXGraph mathematical diagram.

    ELIGIBLE Content (return true):
    - Geometric constructions requiring shapes, angles, measurements
    - Coordinate graphs showing functions, lines, or points
    - Statistical data requiring charts (bar, histogram, scatter)
    - Algebraic visualizations on number lines or graphs

    NOT ELIGIBLE Content (return false):
    - Assessment rubrics, performance scales, grading criteria
    - Worksheets, templates, fill-in forms
    - Concept maps, mind maps, flowcharts
    - Real-world photographs or illustrations
    - Pure text definitions or explanations
    - Step-by-step procedures without geometric visualization

    Return your analysis as structured JSON.
    """

    results = []
    for card in cards:
        analysis = await llm_client.analyze_eligibility(
            explainer=card.get("explainer", ""),
            cfu=card.get("cfu", ""),
            prompt=eligibility_prompt
        )

        results.append(CardEligibility(
            card_id=card["$id"],
            lesson_context_eligible=analysis["lesson_needs_diagram"],
            cfu_context_eligible=analysis["cfu_needs_diagram"],
            reason=analysis["reason"]
        ))

    return results
```

**Remove**:
- All keyword lists (`visual_keywords`, `skip_keywords`)
- Fallback to heuristic logic
- TODO comments about LLM implementation

### 2. Add LLM Method (`diagram_author_claude_client.py`)

**New Method**:
```python
from pydantic import BaseModel, Field

class EligibilityAnalysis(BaseModel):
    """Structured output for card eligibility analysis."""
    lesson_needs_diagram: bool = Field(
        description="Whether the lesson explainer needs a JSXGraph diagram"
    )
    cfu_needs_diagram: bool = Field(
        description="Whether the CFU (check for understanding) needs a JSXGraph diagram"
    )
    reason: str = Field(
        description="Brief explanation of the eligibility decision"
    )

class DiagramAuthorClaudeClient:
    # ... existing code ...

    async def analyze_eligibility(
        self,
        explainer: str,
        cfu: str,
        prompt: str
    ) -> Dict[str, Any]:
        """Use Claude to determine if card needs JSXGraph diagram.

        Args:
            explainer: Lesson card explainer text
            cfu: Check for understanding text
            prompt: Eligibility criteria prompt

        Returns:
            Dictionary with lesson_needs_diagram, cfu_needs_diagram, reason
        """
        from langchain_core.messages import SystemMessage, HumanMessage

        # Use structured output for consistent parsing
        structured_llm = self.llm.with_structured_output(EligibilityAnalysis)

        response = await structured_llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"Explainer: {explainer}\n\nCFU: {cfu}")
        ])

        return {
            "lesson_needs_diagram": response.lesson_needs_diagram,
            "cfu_needs_diagram": response.cfu_needs_diagram,
            "reason": response.reason
        }
```

### 3. Update Batch Generator Logging (`batch_diagram_generator.py`)

**Add** after eligibility analysis:
```python
# Log eligibility decisions with detailed breakdown
eligible_count = sum(
    1 for e in eligibility
    if e.lesson_context_eligible or e.cfu_context_eligible
)
excluded_count = len(eligibility) - eligible_count

logger.info(f"📊 Eligibility Analysis Complete:")
logger.info(f"   ✅ Eligible cards: {eligible_count}")
logger.info(f"   ❌ Excluded cards: {excluded_count}")

# Group exclusion reasons for insight
if excluded_count > 0:
    exclusion_reasons = {}
    for e in eligibility:
        if not (e.lesson_context_eligible or e.cfu_context_eligible):
            reason = e.reason or "No visual component needed"
            exclusion_reasons[reason] = exclusion_reasons.get(reason, 0) + 1

    logger.info("📋 Exclusion Breakdown:")
    for reason, count in sorted(exclusion_reasons.items(), key=lambda x: -x[1]):
        logger.info(f"   - {reason}: {count} card(s)")
```

### 4. Update Prompts

**A. Main Orchestrator Prompt** (`diagram_author_prompt.md`)

Add section after line 50:
```markdown
## What Qualifies as a "Diagram"?

You will be provided with `eligible_cards.json` - cards that have been pre-filtered by LLM-based semantic analysis.

**Cards INCLUDED in eligible_cards.json** (JSXGraph-compatible):
✅ Geometric constructions (triangles, circles, polygons, angles, measurements)
✅ Coordinate graphs (functions, lines, points, slopes, intercepts)
✅ Statistical charts (bar charts, histograms, scatter plots, distributions)
✅ Algebraic visualizations (number lines, equation solving, inequalities)

**Cards EXCLUDED from eligible_cards.json** (Not JSXGraph-compatible):
❌ Assessment rubrics and performance scales
❌ Worksheets and fill-in forms/templates
❌ Concept maps and mind maps
❌ Real-world photographs or illustrations
❌ Text-only explanations or definitions
❌ Lists or procedures without geometric/graphical component

**Your Role**: For each eligible card, generate a high-quality JSXGraph diagram that visualizes the mathematical content.

**Important**: Do NOT attempt to create diagrams for excluded content types. If you receive a card that seems ineligible, document this in the error report.
```

**B. Diagram Generation Subagent** (`diagram_generation_subagent.md`)

Add section after line 80:
```markdown
## When to Return NO_DIAGRAM_NEEDED

Although cards are pre-filtered, you may occasionally receive content that cannot be visualized with JSXGraph. In such cases, return:

```json
{
  "status": "NO_DIAGRAM_NEEDED",
  "reason": "Brief explanation of why JSXGraph cannot render this content"
}
```

**Examples of NO_DIAGRAM_NEEDED scenarios**:
- Assessment rubrics or performance scales
- Worksheets or templates with fill-in blanks
- Concept maps or mind maps (non-mathematical relationship diagrams)
- Requests for real-world photographs
- Pure text explanations without geometric/graphical component

**Note**: This should be rare since eligibility filtering happens before you receive the card. If you encounter many NO_DIAGRAM_NEEDED cases, report this as a system issue.
```

---

## Testing Strategy

### Test Cases

Create a test suite with edge cases:

| Card Content | Expected Decision | Reason |
|--------------|-------------------|--------|
| "Self-Assessment: Pythagoras' Theorem Performance Scale (0-100)" | ❌ EXCLUDED | Assessment rubric |
| "Calculate the hypotenuse of a right triangle with sides 3cm and 4cm" | ✅ INCLUDED | Geometric construction |
| "Complete the worksheet by filling in the missing angles" | ❌ EXCLUDED | Worksheet template |
| "Draw the graph of y = 2x + 3 on coordinate axes" | ✅ INCLUDED | Function graph |
| "Create a concept map showing relationships between quadrilaterals" | ❌ EXCLUDED | Concept map |
| "Show a picture of a protractor measuring an angle" | ❌ EXCLUDED | Real-world photograph |
| "Plot the points A(2,3), B(5,7) and draw line AB" | ✅ INCLUDED | Coordinate geometry |
| "List three properties of isosceles triangles" | ❌ EXCLUDED | Text list |
| "Sketch a bar chart for the frequency data: 1-10 (5), 11-20 (8), 21-30 (3)" | ✅ INCLUDED | Statistical chart |

### Validation Checks

1. **Accuracy**: Run on 100 randomly selected lesson cards, manually verify decisions
2. **Consistency**: Re-run same cards, ensure identical decisions (should be deterministic with structured output)
3. **Performance**: Measure token usage vs keyword heuristic (expect ~100-200 tokens per card)
4. **Coverage**: Ensure all excluded categories represented in logs

---

## Expected Outcomes

### Quantitative Improvements

- **False Positive Rate**: Reduce from ~30% to <5%
- **Token Waste**: Eliminate ~20-30% of unnecessary diagram generation attempts
- **Generation Success Rate**: Increase from ~70% to >90% (fewer impossible tasks)

### Qualitative Improvements

- **Explainability**: Clear reasons for exclusion decisions
- **Debuggability**: Logging provides insight into filtering logic
- **Maintainability**: Easy to update eligibility criteria (change prompt, not code)
- **Accuracy**: Semantic understanding vs keyword matching

### Example Log Output

```
📊 Eligibility Analysis Complete:
   ✅ Eligible cards: 5
   ❌ Excluded cards: 3

📋 Exclusion Breakdown:
   - Assessment rubric or performance scale - not JSXGraph compatible: 2 card(s)
   - Worksheet template requiring fill-in responses - not a diagram: 1 card(s)
```

---

## Rollout Plan

### Phase 1: Implementation (This Spec)
- [ ] Implement LLM-based eligibility in `diagram_extractor.py`
- [ ] Add `analyze_eligibility()` method to `DiagramAuthorClaudeClient`
- [ ] Remove keyword heuristic fallback
- [ ] Add eligibility logging to `batch_diagram_generator.py`
- [ ] Update all prompts with eligibility criteria

### Phase 2: Testing
- [ ] Create test suite with edge cases
- [ ] Run on sample lessons (10-20 cards)
- [ ] Validate accuracy manually
- [ ] Measure token usage increase

### Phase 3: Documentation
- [ ] Update DIAGRAM_AUTHOR_GUIDE.md
- [ ] Add eligibility examples to documentation
- [ ] Update troubleshooting guide

### Phase 4: Deployment
- [ ] Deploy to production
- [ ] Monitor exclusion logs for unexpected patterns
- [ ] Gather feedback from generated diagrams

---

## Success Criteria

1. ✅ Zero assessment rubrics/performance scales flagged as eligible
2. ✅ Zero worksheets/forms flagged as eligible
3. ✅ Zero concept maps flagged as eligible
4. ✅ All geometric problems correctly identified as eligible
5. ✅ All function graphs correctly identified as eligible
6. ✅ Detailed exclusion reasons logged for debugging
7. ✅ Documentation updated with eligibility criteria

---

## Related Documents

- **Main Guide**: `claud_author_agent/docs/DIAGRAM_AUTHOR_GUIDE.md`
- **Prompts**: `claud_author_agent/src/prompts/diagram_author_prompt.md`
- **Implementation**: `claud_author_agent/src/utils/diagram_extractor.py`
- **Client**: `claud_author_agent/src/diagram_author_claude_client.py`

---

**Estimated Implementation Time**: 3-4 hours
**Token Cost Increase**: ~100-200 tokens per card analyzed (~$0.0003-0.0006 per card)
**ROI**: Eliminate 20-30% wasted diagram generation attempts, improve quality significantly
