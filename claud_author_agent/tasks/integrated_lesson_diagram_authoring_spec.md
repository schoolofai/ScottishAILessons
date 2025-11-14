# Integrated Lesson + Diagram Authoring Specification

**Date**: 2025-11-14
**Status**: Planning
**Owner**: Lesson Author Agent Team

---

## Executive Summary

Integrate diagram generation into the lesson authoring pipeline to improve coherence by maintaining rich context (SOW design, research, pedagogical decisions) during diagram creation. Diagrams are generated gracefully (failures don't block lesson completion) with per-card eligibility analysis and automatic regeneration when lesson content changes.

### Problem Statement

Currently, diagram generation runs as a separate downstream process (`diagram_author_claude_client.py`) that:
- Fetches completed lesson templates from Appwrite
- Loses rich context from lesson authoring (SOW design, research queries, pedagogical decisions)
- Results in **disjointed diagrams** that don't align well with lesson pedagogy
- Requires manual coordination of two separate pipeline executions

### Solution Approach

**Integrate diagram generation into lesson authoring** with these key design decisions:
1. ✅ **Graceful Failure Mode**: Diagrams don't block lesson completion
2. ✅ **Per-Card Eligibility**: Lesson author decides during content authoring
3. ✅ **Dual Validation**: Diagram Critic validates diagrams individually, Combined Lesson Critic validates lesson+diagram coherence
4. ✅ **Auto-Regeneration**: Diagrams regenerate automatically when lesson content changes during critic revisions

---

## 1. Schema Changes

### 1.1 Lesson Template Card Schema

Add diagram-related fields to each card in `lesson_template.json`:

```typescript
interface Card {
  // ... existing fields (id, card_type, explainer, cfu, rubric, etc.) ...

  // ═══════════════════════════════════════════════════════════════
  // NEW DIAGRAM FIELDS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Whether this card requires a JSXGraph diagram.
   * Set by lesson author during Phase 2 (per-card eligibility).
   */
  diagram_eligible?: boolean;

  /**
   * Rich 2-3 sentence description of what diagram should visualize.
   * Written by lesson author with full SOW context.
   *
   * Example: "Visualize a linear function y = 2x + 3 with clearly labeled
   * axes, showing the y-intercept at (0, 3) and the slope as rise/run.
   * Use a Scottish context example like calculating bus fare based on distance."
   */
  diagram_description?: string;

  /**
   * Card type context for diagram generation heuristic.
   * Examples: "function_visualization", "geometry_construction",
   * "data_interpretation", "algebraic_manipulation"
   */
  diagram_context?: string;

  /**
   * Diagram generation results and metadata.
   */
  diagram_metadata?: {
    /**
     * JSXGraph JSON definition (complete diagram specification).
     */
    jsxgraph_json: object;

    /**
     * Appwrite Storage file ID for PNG image.
     * Replaces local file path after Phase 6 upload.
     */
    image_file_id?: string;

    /**
     * Overall quality score from Diagram Critic (0.0-1.0).
     * Average of 4 dimensions: clarity, accuracy, pedagogy, aesthetics.
     */
    visual_critique_score?: number;

    /**
     * Number of refinement iterations (1-3).
     */
    critique_iterations?: number;

    /**
     * Final feedback from Diagram Critic.
     */
    critique_feedback?: string;

    /**
     * Generation status for graceful failure handling.
     * - 'pending': Eligibility determined, generation not started
     * - 'success': Diagram generated and passed critique
     * - 'failed': Generation failed (graceful degradation)
     */
    generation_status: 'pending' | 'success' | 'failed';

    /**
     * Error message if generation_status = 'failed'.
     */
    error_message?: string;
  };
}
```

### 1.2 Validation Result Schema Extension

Extend `validation_result.json` to track diagram validation:

```json
{
  "is_valid": true,
  "total_errors": 0,
  "cards_validated": 12,

  // NEW FIELDS
  "diagrams_validated": 5,
  "diagram_failures": 0,
  "diagram_coherence_issues": []
}
```

### 1.3 Appwrite Collection Changes

**Collection**: `default.lesson_templates`

Add field to track diagram counts:

```typescript
{
  // ... existing fields (courseId, sow_order, lesson_template_compressed, etc.) ...

  // NEW FIELD
  diagrams_count: number;  // Count of successfully generated diagrams
}
```

**Collection**: `default.lesson_diagrams` (DEPRECATED after integration)

This collection becomes redundant since diagrams are embedded in lesson_template.json. However, keep for backwards compatibility with existing frontend code until migration is complete.

---

## 2. Updated Pipeline Architecture

### 2.1 Overview

Transform the 3-subagent lesson author pipeline into a 6-phase integrated pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│ PRE-PROCESSING (Python - Existing)                          │
│ • Extract SOW entry                                          │
│ • Extract Course_outcomes.json                               │
│ • Generate blank lesson_template.json                        │
│ • Health check DiagramScreenshot service (NEW)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Research Subagent (Existing - On-Demand)           │
│ • WebSearch/WebFetch for Scottish context                    │
│ • Pedagogical patterns and exemplars                         │
│ • Common misconceptions                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Lesson Authoring + Per-Card Diagram Planning (ENHANCED) │
│                                                               │
│ For EACH card in lesson_template:                            │
│   1. Fill all content fields (existing)                      │
│   2. Validate schema: mcp__validator__validate_lesson_template │
│   3. Fix errors and re-validate                              │
│   4. NEW: Determine diagram eligibility                      │
│   5. NEW: If eligible, write diagram_description             │
│   6. Re-validate with new diagram fields                     │
│   7. Mark card complete, move to next card                   │
│                                                               │
│ Output: lesson_template.json with diagram_eligible flags     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Diagram Generation (NEW - Batch)                   │
│                                                               │
│ For EACH card where diagram_eligible = true:                 │
│   1. Generate JSXGraph JSON (Diagram Generation Subagent)    │
│   2. Render PNG via DiagramScreenshot MCP                    │
│   3. Critique diagram (Diagram Critic Subagent)              │
│      • Score threshold: ≥0.85                                │
│      • Max iterations: 3                                     │
│      • Dimensions: clarity, accuracy, pedagogy, aesthetics   │
│   4. Store diagram_metadata in card                          │
│                                                               │
│ Graceful Failure: If diagram generation fails, mark as       │
│ 'failed' but continue lesson authoring.                      │
│                                                               │
│ Output: lesson_template.json with diagram_metadata           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: Combined Lesson Critic (ENHANCED)                  │
│                                                               │
│ Validation Dimensions:                                       │
│   1. Schema Gate (pass/fail)                                 │
│   2. SOW-Template Fidelity (75%, ≥0.90)                      │
│   3. NEW: Lesson-Diagram Coherence (15%, ≥0.85)             │
│      • Diagrams support card pedagogy                        │
│      • Scottish context alignment                            │
│      • Visual complexity matches student level               │
│   4. Basic Quality (10%, ≥0.80)                              │
│                                                               │
│ If overall_pass = false → PHASE 5                            │
│ If overall_pass = true → PHASE 6                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: Revision + Diagram Regeneration (NEW)              │
│                                                               │
│ 1. Revise lesson content based on critic feedback            │
│ 2. Track cards with content changes                          │
│ 3. Auto-regenerate diagrams for:                             │
│    • Cards flagged by critic (diagram coherence issues)      │
│    • Cards with content changes (prevent staleness)          │
│ 4. Re-run Combined Lesson Critic                             │
│                                                               │
│ Max iterations: 10 (matches existing max_critic_retries)     │
│                                                               │
│ Loop back to PHASE 4 until overall_pass = true               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: Post-Processing (ENHANCED)                         │
│                                                               │
│ 1. Upload diagram PNGs to Appwrite Storage (NEW)             │
│    • Bucket: lesson_diagrams                                 │
│    • Update diagram_metadata.image_file_id                   │
│    • Remove local image_path references                      │
│                                                               │
│ 2. Compress lesson_template.json (existing)                  │
│                                                               │
│ 3. Upsert to default.lesson_templates with:                  │
│    • lesson_template_compressed (with embedded diagrams)     │
│    • diagrams_count (NEW)                                    │
│                                                               │
│ Output: Appwrite document ID                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Phase Dependencies

| Phase | Depends On | Failure Mode |
|-------|------------|--------------|
| Pre-processing | None | **Fail-fast**: DiagramScreenshot health check must pass |
| Phase 1 (Research) | Pre-processing | **Fail-fast**: If research fails, lesson authoring cannot proceed |
| Phase 2 (Lesson + Diagram Planning) | Phase 1 | **Fail-fast**: If lesson authoring fails, abort pipeline |
| Phase 3 (Diagram Generation) | Phase 2 | **Graceful**: If diagram generation fails, continue without diagrams |
| Phase 4 (Combined Critic) | Phase 2, Phase 3 | **Fail-fast**: If critic cannot execute, abort pipeline |
| Phase 5 (Revision) | Phase 4 | **Fail-fast**: If max retries exceeded, abort pipeline |
| Phase 6 (Post-processing) | Phase 4 (pass) | **Graceful**: If diagram upload fails, log error but complete lesson upsert |

---

## 3. Detailed Phase Specifications

### 3.1 Phase 2: Enhanced Lesson Authoring

**Changes to `lesson_author_prompt_v2.md` → `lesson_author_prompt_v3.md`**

Add new steps after card content authoring and validation:

```markdown
## Step 3: Determine Diagram Eligibility (NEW)

For EACH card you just authored and validated:

### 3.1 Read Card Content
- Read the filled card content (explainer, CFU, rubric)
- Identify the card_type (teach, guided_practice, independent_practice, etc.)
- Review the mathematical/scientific concept being taught

### 3.2 Apply Eligibility Criteria

Ask yourself: **"Would a visual diagram significantly enhance learning for this card?"**

**Diagram-Eligible Card Types:**

1. **teach** cards with:
   - Complex visual concepts (functions, geometry, data visualization)
   - Spatial relationships that are hard to describe in text
   - Scottish context examples that benefit from visual representation

2. **guided_practice** cards with:
   - Geometric constructions
   - Graph plotting/interpretation
   - Visual problem-solving strategies

3. **independent_practice** cards with:
   - Spatial/geometric problems
   - Data interpretation from charts/graphs
   - Visual reasoning tasks

4. **formative_check / summative_check** cards with:
   - Diagram-based assessment questions
   - Visual CFU requiring interpretation

**NOT Diagram-Eligible:**

- Pure algebraic manipulation (unless visual scaffolding helps)
- Text-based word problems without spatial component
- Abstract concepts better explained through text
- Memorization tasks (definitions, vocabulary)

### 3.3 Set diagram_eligible Flag

Based on your analysis:

```json
{
  "diagram_eligible": true  // or false
}
```

### 3.4 Write Diagram Description (If Eligible)

If `diagram_eligible = true`, write a rich 2-3 sentence description:

**Template:**
```
"Visualize [WHAT TO SHOW] with [KEY ELEMENTS].
Use [SCOTTISH CONTEXT] to enhance engagement.
The diagram should support [PEDAGOGICAL GOAL]."
```

**Example for National 5 Linear Functions:**
```json
{
  "diagram_description": "Visualize a linear function y = 2x + 3 with clearly labeled axes, showing the y-intercept at (0, 3) and the gradient as rise over run (2/1). Use a Scottish context example like calculating taxi fare (£3 pickup + £2 per mile) with distance on x-axis and total cost on y-axis. The diagram should scaffold understanding of y-intercept as starting value and gradient as rate of change."
}
```

### 3.5 Set Diagram Context

Choose ONE context tag that best describes the diagram type:

- `function_visualization`: Graphing functions (linear, quadratic, etc.)
- `geometry_construction`: Geometric shapes, angles, constructions
- `data_interpretation`: Charts, graphs, statistical displays
- `algebraic_manipulation`: Visual algebra (balance, tiles)
- `spatial_reasoning`: 2D/3D spatial problems
- `real_world_modeling`: Scottish context scenarios

```json
{
  "diagram_context": "function_visualization"
}
```

### 3.6 Initialize Diagram Metadata

Set generation status to pending:

```json
{
  "diagram_metadata": {
    "generation_status": "pending"
  }
}
```

### 3.7 Re-Validate Card

After adding diagram fields, validate again:

```bash
mcp__validator__validate_lesson_template {"file_path": "lesson_template.json"}
```

Fix any schema errors and re-validate until valid.

### 3.8 Save and Continue

Use Edit or Write to save the card with diagram fields, then move to the next card.
```

---

### 3.2 Phase 3: Diagram Generation

**New Python Utility**: `claud_author_agent/src/utils/diagram_generator.py`

```python
"""Diagram generation utility for Phase 3 of integrated lesson authoring.

This utility orchestrates:
1. Diagram Generation Subagent (JSXGraph JSON creation)
2. DiagramScreenshot MCP (PNG rendering)
3. Diagram Critic Subagent (4D quality validation with iterative refinement)
"""

import asyncio
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition

logger = logging.getLogger(__name__)


class DiagramGenerator:
    """Generates and critiques diagrams for lesson cards."""

    def __init__(
        self,
        mcp_config_path: str,
        workspace_path: Path,
        max_iterations: int = 3,
        score_threshold: float = 0.85
    ):
        """Initialize diagram generator.

        Args:
            mcp_config_path: Path to .mcp.json
            workspace_path: Isolated workspace directory
            max_iterations: Max critique iterations per diagram (default: 3)
            score_threshold: Quality threshold (default: 0.85)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.workspace_path = workspace_path
        self.max_iterations = max_iterations
        self.score_threshold = score_threshold

    async def generate_diagrams_for_lesson(
        self,
        lesson_template: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate diagrams for all eligible cards in lesson template.

        Args:
            lesson_template: Complete lesson template with diagram_eligible flags

        Returns:
            {
                "diagrams_generated": int,
                "diagrams_failed": int,
                "failed_card_ids": List[str],
                "total_eligible": int
            }
        """
        # Filter eligible cards
        eligible_cards = [
            card for card in lesson_template.get("cards", [])
            if card.get("diagram_eligible", False)
        ]

        total_eligible = len(eligible_cards)

        if total_eligible == 0:
            logger.info("No cards require diagrams - skipping Phase 3")
            return {
                "diagrams_generated": 0,
                "diagrams_failed": 0,
                "failed_card_ids": [],
                "total_eligible": 0
            }

        logger.info(f"Phase 3: Generating diagrams for {total_eligible} eligible cards")

        diagrams_generated = 0
        diagrams_failed = 0
        failed_card_ids = []

        # Process each card
        for card in eligible_cards:
            card_id = card.get("id", "UNKNOWN")

            try:
                # Generate and critique diagram
                diagram_metadata = await self._generate_single_diagram(
                    card=card,
                    lesson_template=lesson_template
                )

                # Update card with diagram metadata
                card["diagram_metadata"] = diagram_metadata

                if diagram_metadata["generation_status"] == "success":
                    diagrams_generated += 1
                    logger.info(
                        f"✅ Diagram generated for {card_id} "
                        f"(score: {diagram_metadata['visual_critique_score']:.2f}, "
                        f"iterations: {diagram_metadata['critique_iterations']})"
                    )
                else:
                    diagrams_failed += 1
                    failed_card_ids.append(card_id)
                    logger.warning(
                        f"⚠️ Diagram generation failed for {card_id}: "
                        f"{diagram_metadata.get('error_message', 'Unknown error')}"
                    )

            except Exception as e:
                # GRACEFUL FAILURE: Log error but continue to next card
                logger.error(f"❌ Exception during diagram generation for {card_id}: {e}")
                card["diagram_metadata"] = {
                    "generation_status": "failed",
                    "error_message": str(e)
                }
                diagrams_failed += 1
                failed_card_ids.append(card_id)

        # Update lesson_template.json with diagram metadata
        lesson_template_path = self.workspace_path / "lesson_template.json"
        with open(lesson_template_path, 'w') as f:
            json.dump(lesson_template, f, indent=2)

        logger.info(
            f"Phase 3 complete: {diagrams_generated}/{total_eligible} diagrams generated, "
            f"{diagrams_failed} failed (graceful degradation)"
        )

        return {
            "diagrams_generated": diagrams_generated,
            "diagrams_failed": diagrams_failed,
            "failed_card_ids": failed_card_ids,
            "total_eligible": total_eligible
        }

    async def _generate_single_diagram(
        self,
        card: Dict[str, Any],
        lesson_template: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate and critique a single diagram with iterative refinement.

        Args:
            card: Card object with diagram_description
            lesson_template: Full lesson for context

        Returns:
            diagram_metadata dict with generation results
        """
        card_id = card.get("id", "UNKNOWN")
        diagram_description = card.get("diagram_description", "")
        diagram_context = card.get("diagram_context", "")

        # Initialize metadata
        current_jsxgraph_json = None
        current_png_path = None
        final_score = 0.0
        final_feedback = ""

        # Iterative generation + critique loop
        for iteration in range(self.max_iterations):
            logger.info(f"Diagram iteration {iteration + 1}/{self.max_iterations} for {card_id}")

            # Step 1: Generate JSXGraph JSON (or refine if iteration > 0)
            jsxgraph_json = await self._call_diagram_generation_subagent(
                card=card,
                lesson_template=lesson_template,
                diagram_description=diagram_description,
                diagram_context=diagram_context,
                previous_jsxgraph=current_jsxgraph_json,
                critique_feedback=final_feedback if iteration > 0 else None
            )

            # Step 2: Render PNG via DiagramScreenshot MCP
            png_path = await self._render_diagram_png(
                jsxgraph_json=jsxgraph_json,
                card_id=card_id
            )

            # Step 3: Critique diagram (4D scoring)
            critique_result = await self._call_diagram_critic_subagent(
                jsxgraph_json=jsxgraph_json,
                png_path=png_path,
                card=card,
                lesson_template=lesson_template
            )

            # Update tracking variables
            current_jsxgraph_json = jsxgraph_json
            current_png_path = png_path
            final_score = critique_result["overall_score"]
            final_feedback = critique_result["feedback"]

            logger.info(f"Critique score: {final_score:.2f} (threshold: {self.score_threshold})")

            # Check if threshold met
            if final_score >= self.score_threshold:
                logger.info(f"✅ Diagram passed critique at iteration {iteration + 1}")
                return {
                    "jsxgraph_json": current_jsxgraph_json,
                    "image_path": str(current_png_path),
                    "visual_critique_score": final_score,
                    "critique_iterations": iteration + 1,
                    "critique_feedback": final_feedback,
                    "generation_status": "success"
                }

        # Max iterations reached without meeting threshold
        logger.warning(
            f"⚠️ Diagram for {card_id} did not reach {self.score_threshold} threshold "
            f"after {self.max_iterations} iterations (final score: {final_score:.2f})"
        )

        # Return best attempt (still mark as success if we have a valid diagram)
        if current_jsxgraph_json and current_png_path:
            return {
                "jsxgraph_json": current_jsxgraph_json,
                "image_path": str(current_png_path),
                "visual_critique_score": final_score,
                "critique_iterations": self.max_iterations,
                "critique_feedback": final_feedback,
                "generation_status": "success"  # Accept even if below threshold
            }
        else:
            return {
                "generation_status": "failed",
                "error_message": f"No valid diagram produced after {self.max_iterations} iterations"
            }

    async def _call_diagram_generation_subagent(
        self,
        card: Dict[str, Any],
        lesson_template: Dict[str, Any],
        diagram_description: str,
        diagram_context: str,
        previous_jsxgraph: Dict[str, Any] | None,
        critique_feedback: str | None
    ) -> Dict[str, Any]:
        """Call diagram generation subagent to create/refine JSXGraph JSON.

        Args:
            card: Card object
            lesson_template: Full lesson context
            diagram_description: Rich description from lesson author
            diagram_context: Card type context
            previous_jsxgraph: Previous diagram JSON (if refinement iteration)
            critique_feedback: Feedback from previous critique (if refinement)

        Returns:
            JSXGraph JSON definition
        """
        # TODO: Implement Claude Agent SDK call to diagram_generation_subagent
        # Reuse prompt from diagram_author/prompts/diagram_generation_subagent.md
        raise NotImplementedError("diagram_generation_subagent call not implemented")

    async def _render_diagram_png(
        self,
        jsxgraph_json: Dict[str, Any],
        card_id: str
    ) -> Path:
        """Render JSXGraph JSON to PNG via DiagramScreenshot MCP.

        Args:
            jsxgraph_json: JSXGraph JSON definition
            card_id: Card identifier for filename

        Returns:
            Path to rendered PNG file
        """
        # TODO: Implement MCP call to diagram-screenshot service
        # Reuse from diagram_author/tools/diagram_screenshot_tool.py
        raise NotImplementedError("DiagramScreenshot MCP call not implemented")

    async def _call_diagram_critic_subagent(
        self,
        jsxgraph_json: Dict[str, Any],
        png_path: Path,
        card: Dict[str, Any],
        lesson_template: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call diagram critic subagent for 4D quality scoring.

        Args:
            jsxgraph_json: JSXGraph JSON definition
            png_path: Path to rendered PNG
            card: Card object
            lesson_template: Full lesson context

        Returns:
            {
                "scores": {
                    "clarity": float,
                    "accuracy": float,
                    "pedagogy": float,
                    "aesthetics": float
                },
                "overall_score": float,
                "feedback": str,
                "dimension_issues": Dict[str, List[str]]
            }
        """
        # TODO: Implement Claude Agent SDK call to diagram_critic_subagent
        # Reuse prompt from diagram_author/prompts/visual_critic_subagent.md
        raise NotImplementedError("diagram_critic_subagent call not implemented")
```

---

### 3.3 Phase 4: Enhanced Combined Lesson Critic

**Changes to `lesson_critic_prompt_v2.md` → `lesson_critic_prompt_v3.md`**

Add new validation dimension for lesson-diagram coherence:

```markdown
## Validation Dimensions (Updated)

### Dimension 1: Schema Gate (Hard Pass/Fail)

**Existing checks:**
- lesson_template.json schema compliance
- Required fields present
- Data types correct

**NEW checks:**
- `diagram_metadata` schema compliance for eligible cards
- `diagram_eligible` flag is boolean
- `diagram_description` is string if diagram_eligible = true
- `generation_status` is valid enum value

If ANY schema violation detected → **INSTANT FAIL**

---

### Dimension 2: SOW-Template Fidelity (75% Weight, Threshold: ≥0.90)

**Existing checks:**
- All SOW content preserved in lesson cards
- Card structure matches SOW design
- Pedagogical goals maintained

**NEW checks:**
- Diagram descriptions align with SOW pedagogical intent
- Diagrams don't introduce concepts not in SOW

Scoring: 0.0-1.0 (average of all fidelity checks)

---

### Dimension 3: Lesson-Diagram Coherence (NEW - 15% Weight, Threshold: ≥0.85)

**Purpose**: Validate that diagrams support lesson pedagogy effectively.

**Checks:**

1. **Pedagogical Alignment** (0.3 weight)
   - Does the diagram support the card's learning objective?
   - Is the visual complexity appropriate for the lesson stage (I-We-You)?
   - Does the diagram scaffold understanding or just decorate?

2. **Content Consistency** (0.3 weight)
   - Do diagram elements match the explainer content?
   - Are variables, notation, and units consistent between text and diagram?
   - Do diagram examples align with CFU questions?

3. **Scottish Context Authenticity** (0.2 weight)
   - Do diagram examples use authentic Scottish contexts (if applicable)?
   - Are pricing, places, services realistic for Scotland?
   - Does the diagram respect cultural considerations?

4. **Accessibility & Visual Design** (0.2 weight)
   - Is the diagram readable at CEFR level specified in lesson policy?
   - Are labels clear and dyslexia-friendly (font size, contrast)?
   - Does color usage support accessibility needs?

**Scoring**: 0.0-1.0 (weighted average of 4 sub-checks)

**Output for this dimension**:
```json
{
  "diagram_coherence_score": 0.87,
  "diagram_issues": [
    {
      "card_id": "card_003",
      "issue_type": "pedagogical_alignment",
      "description": "Diagram shows quadratic function but card teaches linear functions",
      "severity": "high",
      "requires_regeneration": true
    },
    {
      "card_id": "card_007",
      "issue_type": "content_consistency",
      "description": "Diagram uses 'm' for gradient but explainer uses 'b'",
      "severity": "medium",
      "requires_regeneration": false
    }
  ]
}
```

---

### Dimension 4: Basic Quality (10% Weight, Threshold: ≥0.80)

**Existing checks remain unchanged:**
- CFU quality
- Misconception relevance
- Rubric clarity

---

## Overall Pass Logic (Updated)

```python
overall_pass = (
    schema_gate == "pass" AND
    sow_fidelity_score >= 0.90 AND
    diagram_coherence_score >= 0.85 AND  # NEW
    basic_quality_score >= 0.80
)
```

## Output Format (Updated)

```json
{
  "overall_pass": false,
  "dimension_scores": {
    "schema_gate": "pass",
    "sow_fidelity_score": 0.92,
    "diagram_coherence_score": 0.78,  // BELOW THRESHOLD
    "basic_quality_score": 0.85
  },
  "feedback": {
    "sow_fidelity": ["Minor: ..."],
    "diagram_coherence": [
      "card_003: Diagram type mismatch with content",
      "card_007: Notation inconsistency between text and diagram"
    ],
    "basic_quality": []
  },
  "cards_needing_revision": ["card_003"],
  "diagrams_needing_regeneration": ["card_003", "card_007"]  // NEW
}
```
```

---

### 3.4 Phase 5: Revision + Auto-Regeneration

**Integration into `lesson_author_claude_client.py::execute()`**

Add revision loop after Phase 4 (Combined Lesson Critic):

```python
# After Phase 4: Combined Lesson Critic
critic_result = await combined_lesson_critic_subagent.invoke({
    "lesson_template": lesson_template,
    "sow_entry": sow_entry_data,
    "course_outcomes": outcomes_data
})

# Check if lesson passed
if not critic_result.get("overall_pass", False):
    logger.info("Lesson did not pass critic - starting revision loop (Phase 5)")

    # Track revision iterations
    max_revisions = self.max_critic_retries  # Existing config (default: 10)
    revision_count = 0

    while revision_count < max_revisions:
        revision_count += 1
        logger.info(f"Revision iteration {revision_count}/{max_revisions}")

        # Extract feedback
        cards_to_revise = critic_result.get("cards_needing_revision", [])
        diagrams_to_regenerate = critic_result.get("diagrams_needing_regeneration", [])

        # Track which cards had content changes (for auto-regeneration)
        cards_with_content_changes = set()

        # Step 5a: Revise lesson content
        if cards_to_revise:
            logger.info(f"Revising {len(cards_to_revise)} cards")

            for card_id in cards_to_revise:
                # Delegate to lesson_author for targeted revision
                await lesson_author_subagent.invoke({
                    "task": "revise_card",
                    "card_id": card_id,
                    "feedback": critic_result["feedback"],
                    "lesson_template": lesson_template
                })

                # Track content change for diagram regeneration
                cards_with_content_changes.add(card_id)
                logger.info(f"Revised card: {card_id}")

        # Step 5b: Auto-regenerate diagrams
        # Combine: explicit diagram issues + cards with content changes
        all_diagrams_to_regenerate = (
            set(diagrams_to_regenerate) | cards_with_content_changes
        )

        # Filter to only diagram-eligible cards
        all_diagrams_to_regenerate = {
            card_id for card_id in all_diagrams_to_regenerate
            if any(
                card.get("id") == card_id and card.get("diagram_eligible", False)
                for card in lesson_template.get("cards", [])
            )
        }

        if all_diagrams_to_regenerate:
            logger.info(
                f"Auto-regenerating {len(all_diagrams_to_regenerate)} diagrams: "
                f"{len(diagrams_to_regenerate)} from critic issues, "
                f"{len(cards_with_content_changes & all_diagrams_to_regenerate)} from content changes"
            )

            for card_id in all_diagrams_to_regenerate:
                card = next(
                    (c for c in lesson_template["cards"] if c["id"] == card_id),
                    None
                )
                if not card:
                    continue

                try:
                    # Regenerate diagram (same process as Phase 3)
                    diagram_metadata = await diagram_generator._generate_single_diagram(
                        card=card,
                        lesson_template=lesson_template
                    )

                    # Update card with new diagram metadata
                    card["diagram_metadata"] = diagram_metadata

                    logger.info(
                        f"✅ Regenerated diagram for {card_id} "
                        f"(score: {diagram_metadata.get('visual_critique_score', 0):.2f})"
                    )

                except Exception as e:
                    logger.error(f"❌ Diagram regeneration failed for {card_id}: {e}")
                    # GRACEFUL: Continue even if regeneration fails
                    card["diagram_metadata"] = {
                        "generation_status": "failed",
                        "error_message": f"Regeneration failed: {str(e)}"
                    }

            # Update lesson_template.json with regenerated diagrams
            lesson_template_path = workspace_path / "lesson_template.json"
            with open(lesson_template_path, 'w') as f:
                json.dump(lesson_template, f, indent=2)

        # Step 5c: Re-run Combined Lesson Critic
        logger.info("Re-running Combined Lesson Critic after revisions")
        critic_result = await combined_lesson_critic_subagent.invoke({
            "lesson_template": lesson_template,
            "sow_entry": sow_entry_data,
            "course_outcomes": outcomes_data
        })

        if critic_result.get("overall_pass", False):
            logger.info(f"✅ Lesson passed critic after {revision_count} revision(s)")
            break

    # Check if max revisions exceeded
    if revision_count >= max_revisions and not critic_result.get("overall_pass", False):
        error_msg = (
            f"Lesson failed to pass critic after {max_revisions} revisions. "
            f"Final scores: SOW fidelity={critic_result['dimension_scores']['sow_fidelity_score']:.2f}, "
            f"Diagram coherence={critic_result['dimension_scores']['diagram_coherence_score']:.2f}, "
            f"Basic quality={critic_result['dimension_scores']['basic_quality_score']:.2f}"
        )
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)

# Proceed to Phase 6 (post-processing) if lesson passed
logger.info("Lesson passed all validation - proceeding to Phase 6")
```

---

### 3.5 Phase 6: Enhanced Post-Processing

**New Python Utility**: `claud_author_agent/src/utils/diagram_uploader.py`

```python
"""Diagram PNG uploader for Appwrite Storage.

Uploads diagram PNGs to Appwrite Storage and updates lesson template
with image_file_id references.
"""

import logging
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def upload_diagrams_to_storage(
    lesson_template: Dict[str, Any],
    workspace_path: Path,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Upload all diagram PNGs to Appwrite Storage.

    Args:
        lesson_template: Lesson template with diagram_metadata
        workspace_path: Workspace directory containing PNG files
        mcp_config_path: Path to .mcp.json

    Returns:
        {
            "uploaded": int,
            "failed": int,
            "failed_card_ids": List[str]
        }
    """
    uploaded = 0
    failed = 0
    failed_card_ids = []

    for card in lesson_template.get("cards", []):
        diagram_metadata = card.get("diagram_metadata")

        # Skip cards without successful diagrams
        if not diagram_metadata or diagram_metadata.get("generation_status") != "success":
            continue

        card_id = card.get("id", "UNKNOWN")
        image_path = diagram_metadata.get("image_path")

        # Validate PNG file exists
        if not image_path:
            logger.warning(f"No image_path for card {card_id}")
            continue

        png_file = Path(image_path)
        if not png_file.exists():
            logger.error(f"PNG file not found: {image_path}")
            failed += 1
            failed_card_ids.append(card_id)
            continue

        try:
            # Upload to Appwrite Storage
            file_id = await _upload_to_appwrite_storage(
                file_path=png_file,
                bucket_id="lesson_diagrams",
                card_id=card_id,
                lesson_template_id=lesson_template.get("lessonTemplateId"),
                mcp_config_path=mcp_config_path
            )

            # Update diagram_metadata with file_id
            diagram_metadata["image_file_id"] = file_id
            diagram_metadata.pop("image_path", None)  # Remove local path

            uploaded += 1
            logger.info(f"✅ Uploaded diagram for {card_id}: {file_id}")

        except Exception as e:
            logger.error(f"❌ Failed to upload diagram for {card_id}: {e}")
            failed += 1
            failed_card_ids.append(card_id)
            # GRACEFUL: Continue even if upload fails

    logger.info(
        f"Diagram upload complete: {uploaded} uploaded, {failed} failed"
    )

    return {
        "uploaded": uploaded,
        "failed": failed,
        "failed_card_ids": failed_card_ids
    }


async def _upload_to_appwrite_storage(
    file_path: Path,
    bucket_id: str,
    card_id: str,
    lesson_template_id: str,
    mcp_config_path: str
) -> str:
    """Upload single file to Appwrite Storage.

    Args:
        file_path: Path to PNG file
        bucket_id: Appwrite storage bucket (e.g., "lesson_diagrams")
        card_id: Card identifier for filename
        lesson_template_id: Lesson template identifier
        mcp_config_path: Path to .mcp.json

    Returns:
        Appwrite file ID
    """
    # TODO: Implement Appwrite Storage upload via MCP or SDK
    # Use unique filename: {lesson_template_id}_{card_id}.png
    raise NotImplementedError("Appwrite Storage upload not implemented")
```

**Changes to `lesson_upserter.py`**:

```python
async def upsert_lesson_template(
    lesson_template_path: str,
    courseId: str,
    order: int,
    execution_id: str,
    mcp_config_path: str,
    authored_sow_id: str,
    authored_sow_version: str
) -> str:
    """Upsert lesson template with embedded diagrams to Appwrite.

    NEW: Uploads diagram PNGs to Storage before upserting lesson.
    """
    from pathlib import Path
    import json
    from .compression import compress_json_gzip_base64
    from .diagram_uploader import upload_diagrams_to_storage  # NEW

    # Load lesson template
    with open(lesson_template_path, 'r') as f:
        lesson_template = json.load(f)

    workspace_path = Path(lesson_template_path).parent

    # NEW: Upload diagram PNGs to Appwrite Storage
    logger.info("Uploading diagram PNGs to Appwrite Storage...")
    upload_result = await upload_diagrams_to_storage(
        lesson_template=lesson_template,
        workspace_path=workspace_path,
        mcp_config_path=mcp_config_path
    )

    logger.info(
        f"Diagram upload: {upload_result['uploaded']} succeeded, "
        f"{upload_result['failed']} failed"
    )

    # Update lesson_template.json with image_file_id references
    with open(lesson_template_path, 'w') as f:
        json.dump(lesson_template, f, indent=2)

    # Compress lesson template
    lesson_json = json.dumps(lesson_template)
    compressed_lesson = compress_json_gzip_base64(lesson_json)

    # Count successful diagrams
    diagrams_count = sum(
        1 for card in lesson_template.get("cards", [])
        if card.get("diagram_metadata", {}).get("generation_status") == "success"
    )

    # Prepare document data
    document_data = {
        "courseId": courseId,
        "sow_order": order,
        "lessonTemplateId": lesson_template.get("lessonTemplateId"),
        "lesson_template_compressed": compressed_lesson,
        "execution_id": execution_id,
        "authored_sow_id": authored_sow_id,
        "authored_sow_version": authored_sow_version,
        "diagrams_count": diagrams_count  # NEW
    }

    # Upsert to default.lesson_templates
    document_id = await _upsert_to_appwrite(
        database_id="default",
        collection_id="lesson_templates",
        document_data=document_data,
        mcp_config_path=mcp_config_path
    )

    logger.info(
        f"✅ Lesson template upserted: {document_id} "
        f"(with {diagrams_count} diagrams)"
    )

    return document_id
```

---

## 4. New Subagent Prompts

### 4.1 Diagram Generation Subagent

**File**: `claud_author_agent/src/prompts/diagram_generation_subagent.md`

**Reuse Strategy**: Copy from `diagram_author/prompts/diagram_generation_subagent.md` with minor modifications for integrated context.

**Key Changes**:
- Add reference to `diagram_description` field from lesson author
- Emphasize maintaining consistency with lesson_template content
- Include lesson-level context (course_subject, course_level, lesson_policy)

---

### 4.2 Diagram Critic Subagent

**File**: `claud_author_agent/src/prompts/diagram_critic_subagent_v2.md`

**Reuse Strategy**: Copy from `diagram_author/prompts/visual_critic_subagent.md` with enhanced lesson coherence checks.

**Key Changes**:
- Add check for consistency with card content (explainer, CFU)
- Add check for alignment with lesson_policy (accessibility, CEFR level)
- Emphasize pedagogical scaffolding (I-We-You progression)

---

## 5. Cost & Performance Analysis

### 5.1 Token Estimates

**Per Lesson with 12 Cards, 5 Diagrams**

| Phase | Token Estimate | Cost (Sonnet 4.5) |
|-------|----------------|-------------------|
| Pre-processing (Python) | 0 tokens | $0.00 |
| Phase 1: Research (existing) | 5,000-10,000 | $0.02-$0.03 |
| Phase 2: Lesson + Diagram Planning | 55,000-88,000 (base: 50k + diagram: 5-8k) | $0.17-$0.26 |
| Phase 3: Diagram Generation | 100,000 (20k per diagram × 5) | $0.30 |
| Phase 3: Diagram Critique | 100,000 (10k per diagram × 2 iterations × 5) | $0.30 |
| Phase 4: Combined Critic | 12,000-15,000 | $0.04-$0.05 |
| Phase 5: Revision (avg 1 iteration) | 20,000 | $0.06 |
| Phase 6: Post-processing (Python) | 0 tokens | $0.00 |
| **Total** | **~292,000-333,000 tokens** | **$0.89-$1.00** |

**Comparison to Separate Approach**:
- Lesson Author alone: 50,000 tokens ($0.15)
- Diagram Author alone: 150,000 tokens ($0.45)
- **Total Separate**: 200,000 tokens ($0.60)

**Cost Increase**: +46% more expensive, but with significantly improved diagram coherence.

---

### 5.2 Execution Time Estimates

**Per Lesson with 12 Cards, 5 Diagrams**

| Phase | Time Estimate |
|-------|---------------|
| Pre-processing | 30 seconds |
| Phase 1: Research | 2-3 minutes (on-demand) |
| Phase 2: Lesson + Diagram Planning | 8-12 minutes |
| Phase 3: Diagram Generation (5 diagrams × 2 iterations) | 10-15 minutes |
| Phase 4: Combined Critic | 2-3 minutes |
| Phase 5: Revision (if needed) | 3-5 minutes |
| Phase 6: Post-processing | 1 minute |
| **Total** | **26-40 minutes** |

**Comparison to Separate Approach**:
- Lesson Author: 15-20 minutes
- Diagram Author: 12-18 minutes
- **Total Separate**: 27-38 minutes (sequential execution)

**Time Increase**: Minimal change (similar total time) since phases run sequentially either way.

---

### 5.3 Optimization Opportunities (Future)

1. **Parallel Diagram Generation**: Generate diagrams for multiple cards in parallel (reduce Phase 3 time by 40-60%)
2. **Caching Diagram Patterns**: Reuse JSXGraph templates for similar cards (reduce Phase 3 tokens by 20-30%)
3. **Tiered Critique**: Skip Diagram Critic for simple diagrams (reduce Phase 3 tokens by 30-40%)
4. **Lazy Diagram Generation**: Generate diagrams only for cards that pass Combined Lesson Critic (reduce wasted regenerations)

---

## 6. Migration & Rollout Plan

### 6.1 Phase 1: Preparation (Week 1)

**Tasks**:
1. Update Appwrite schema:
   - Add `diagram_eligible`, `diagram_description`, `diagram_context`, `diagram_metadata` fields to lesson_template cards
   - Add `diagrams_count` field to `default.lesson_templates` collection
   - Test schema backwards compatibility with existing lessons

2. Create new prompt files:
   - `lesson_author_prompt_v3.md` (enhanced with diagram planning)
   - `lesson_critic_prompt_v3.md` (enhanced with diagram coherence)
   - Copy `diagram_generation_subagent.md` from diagram_author
   - Copy `diagram_critic_subagent_v2.md` from diagram_author

3. Create utility modules:
   - `utils/diagram_generator.py` (Phase 3 logic)
   - `utils/diagram_uploader.py` (Appwrite Storage upload)

**Deliverables**:
- Updated Appwrite schema (with migration script)
- 4 new/updated prompt files
- 2 new utility modules (with unit tests)

---

### 6.2 Phase 2: Implementation (Week 2-3)

**Tasks**:
1. Implement Phase 2 logic:
   - Update `lesson_author_claude_client.py::execute()` to include diagram planning
   - Update `_build_initial_prompt()` to include Phase 2 instructions

2. Implement Phase 3 logic:
   - Complete `DiagramGenerator` class in `utils/diagram_generator.py`
   - Integrate with DiagramScreenshot MCP tool (reuse from diagram_author)
   - Add graceful failure handling

3. Implement Phase 4 logic:
   - Update Combined Lesson Critic subagent definition
   - Add diagram coherence scoring

4. Implement Phase 5 logic:
   - Add revision loop with auto-regeneration
   - Track cards_with_content_changes
   - Regenerate diagrams for affected cards

5. Implement Phase 6 logic:
   - Complete `upload_diagrams_to_storage()` in `utils/diagram_uploader.py`
   - Update `lesson_upserter.py` to call diagram uploader
   - Add error handling for upload failures

**Deliverables**:
- Updated `lesson_author_claude_client.py` (all 6 phases integrated)
- Complete `diagram_generator.py` with tests
- Complete `diagram_uploader.py` with tests
- Updated `lesson_upserter.py`

---

### 6.3 Phase 3: Testing (Week 4)

**Test Cases**:

1. **Happy Path Test**:
   - Course: Mathematics National 5
   - Lesson: Linear Functions (teach type)
   - Expected: 12 cards, 5 diagrams, all pass critic

2. **Graceful Failure Test**:
   - Disable DiagramScreenshot service mid-execution
   - Expected: Lesson completes with `diagram_metadata.generation_status = 'failed'`

3. **Revision Loop Test**:
   - Inject artificial critic failure (low diagram coherence score)
   - Expected: Auto-regenerate diagrams, pass on retry

4. **No Diagrams Test**:
   - Lesson with no diagram-eligible cards (e.g., pure algebraic lesson)
   - Expected: Skip Phase 3, complete successfully

5. **Backwards Compatibility Test**:
   - Run against existing lesson template without diagram fields
   - Expected: No crashes, diagrams not generated (backward compatible)

**Success Criteria**:
- All 5 test cases pass
- No regressions in existing lesson authoring functionality
- Cost within 50% of separate approach ($0.90-$1.20 per lesson)
- Execution time within 50% of separate approach (26-40 minutes)

**Deliverables**:
- Test suite with 5 test cases
- Pytest fixtures for test data
- Performance benchmarking report

---

### 6.4 Phase 4: Rollout (Week 5)

**Tasks**:
1. Deploy schema changes to production Appwrite
2. Deploy updated `lesson_author_claude_client.py` to production
3. Update lesson authoring workflow documentation
4. Deprecate standalone `diagram_author_claude_client.py`:
   - Add deprecation warning in code
   - Update README to mark as deprecated
   - Plan removal for next major release

**Rollback Plan**:
- Keep separate `diagram_author_claude_client.py` available for 1 release cycle
- If critical issues detected, revert to separate approach
- Monitor first 50 production lessons for quality/cost issues

**Deliverables**:
- Production deployment of integrated pipeline
- Updated documentation
- Deprecation notice for `diagram_author_claude_client.py`

---

## 7. Key Benefits

### 7.1 Coherence Improvements

**Problem Solved**: Diagrams now inherit full lesson authoring context:
- SOW pedagogical design (I-We-You progression, scaffolding strategies)
- Research queries (Scottish context examples, common misconceptions)
- Lesson policy (accessibility preferences, CEFR level, engagement tags)
- Course metadata (subject, level, SQA course code)

**Expected Impact**:
- 30-50% reduction in "disjointed diagram" complaints from teachers
- Improved alignment between diagram examples and CFU questions
- Better Scottish context authenticity in diagrams

---

### 7.2 Operational Simplicity

**Problem Solved**: No need to run separate diagram authoring step.

**Expected Impact**:
- Single command executes both lesson + diagram authoring
- Reduced manual coordination overhead
- Easier debugging (single execution log)

---

### 7.3 Automatic Consistency

**Problem Solved**: Diagrams auto-regenerate when lesson content changes during critic revisions.

**Expected Impact**:
- Eliminate stale diagrams after lesson revisions
- Reduce manual diagram fixes by 40-60%
- Ensure diagrams always match final lesson content

---

### 7.4 Graceful Degradation

**Problem Solved**: Lesson completes even if diagram generation fails.

**Expected Impact**:
- 95%+ lesson completion rate (even if DiagramScreenshot service is down)
- Reduced false-negative failures from diagram service issues
- Better production resilience

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Increased cost** (~46% more expensive) | High | Certain | Offset by reduced manual diagram fixes; consider tiered diagram quality levels in future |
| **Longer execution time** (diagram generation adds 10-15 min) | Medium | Certain | Acceptable for batch processing; optimize with parallel diagram generation in Phase 2 |
| **DiagramScreenshot service dependency** | High | Low | Fast-fail health check at start; graceful degradation if service fails mid-execution |
| **Diagram regeneration loops** (critic triggers content changes) | Medium | Medium | Limit regeneration to max 3 iterations per card; track regeneration count to detect loops |
| **Schema migration complexity** | Medium | Low | Backwards-compatible schema (all diagram fields optional); test with existing lessons |
| **Prompt adherence issues** (agent skips diagram planning) | High | Medium | Add post-execution validation: check that diagram_eligible cards have diagram_description |
| **Token context overflow** (lesson+diagram prompts too large) | High | Low | Monitor prompt token counts; use truncation strategies if needed |

---

## 9. Success Metrics

**Tracked Metrics** (first 50 production lessons):

1. **Diagram Coherence Score**:
   - Metric: Teacher survey rating (1-5 scale)
   - Target: ≥4.2 average (vs. 3.5 for separate approach)

2. **Diagram-Lesson Alignment**:
   - Metric: % of diagrams marked as "unrelated" or "confusing" by teachers
   - Target: <5% (vs. 15-20% for separate approach)

3. **Cost Efficiency**:
   - Metric: Cost per high-quality diagram (including iterations)
   - Target: <$0.20 per diagram

4. **Execution Time**:
   - Metric: End-to-end lesson+diagram authoring time
   - Target: <40 minutes for 12-card lesson with 5 diagrams

5. **Failure Rate**:
   - Metric: % of lessons that complete successfully despite diagram failures
   - Target: >95%

6. **Regeneration Frequency**:
   - Metric: Avg diagrams regenerated per lesson due to critic feedback
   - Target: <1.5 per lesson (indicates good first-pass quality)

---

## 10. Open Questions

1. **Should we support partial diagram updates?** (e.g., regenerate only diagram elements flagged by critic, not entire diagram)

2. **Should diagram descriptions be revisable by Combined Lesson Critic?** (currently only lesson content is revisable)

3. **Should we support diagram dependencies?** (e.g., diagram in card_003 references diagram in card_001)

4. **Should we batch-upload all diagrams at once or upload incrementally?** (Phase 6 optimization)

5. **Should we create a separate `diagram_audit_log` for tracking diagram generation attempts?** (useful for quality analysis)

---

## 11. Implementation Checklist

- [ ] **Week 1: Preparation**
  - [ ] Update Appwrite schema (cards + lesson_templates collection)
  - [ ] Create `lesson_author_prompt_v3.md`
  - [ ] Create `lesson_critic_prompt_v3.md`
  - [ ] Copy `diagram_generation_subagent.md` from diagram_author
  - [ ] Copy `diagram_critic_subagent_v2.md` from diagram_author
  - [ ] Create `utils/diagram_generator.py` skeleton
  - [ ] Create `utils/diagram_uploader.py` skeleton

- [ ] **Week 2-3: Implementation**
  - [ ] Implement Phase 2 (diagram planning in lesson_author)
  - [ ] Implement Phase 3 (diagram_generator.py complete)
  - [ ] Implement Phase 4 (enhanced combined_lesson_critic)
  - [ ] Implement Phase 5 (revision loop with auto-regeneration)
  - [ ] Implement Phase 6 (diagram_uploader.py complete)
  - [ ] Update `lesson_upserter.py` to call diagram uploader
  - [ ] Write unit tests for new utilities

- [ ] **Week 4: Testing**
  - [ ] Test Case 1: Happy path (12 cards, 5 diagrams)
  - [ ] Test Case 2: Graceful failure (DiagramScreenshot down)
  - [ ] Test Case 3: Revision loop with auto-regeneration
  - [ ] Test Case 4: No diagrams (pure algebraic lesson)
  - [ ] Test Case 5: Backwards compatibility (existing lessons)
  - [ ] Performance benchmarking (cost + time)

- [ ] **Week 5: Rollout**
  - [ ] Deploy schema changes to production
  - [ ] Deploy updated lesson_author_claude_client.py
  - [ ] Update documentation (README, API docs)
  - [ ] Deprecate diagram_author_claude_client.py
  - [ ] Monitor first 50 production lessons
  - [ ] Collect teacher feedback on diagram quality

---

## 12. References

**Related Specifications**:
- `claud_author_agent/tasks/LESSON_AUTHOR_AGENT_SPEC.md` - Original lesson author architecture
- `claud_author_agent/tasks/diagram_eligibility_llm_filtering_spec.md` - Eligibility filtering approach
- `claud_author_agent/tasks/lesson_author_prompt_v2_spec.md` - Lesson author prompt design
- `claud_author_agent/tasks/lesson-author-validation-enforcement-spec.md` - Validation strategy

**Reused Components**:
- `diagram_author_claude_client.py` - Diagram generation pipeline (deprecated after integration)
- `eligibility_analyzer_agent.py` - Eligibility analysis logic (moved to lesson_author per-card)
- `tools/diagram_screenshot_tool.py` - DiagramScreenshot MCP tool (reused as-is)
- `prompts/diagram_generation_subagent.md` - Diagram generation prompt (reused)
- `prompts/visual_critic_subagent.md` - Diagram critique prompt (reused with enhancements)

---

## Appendix A: Schema Examples

### Example: Card with Successful Diagram

```json
{
  "id": "card_003",
  "card_type": "teach",
  "explainer": "A linear function has the form y = mx + c...",
  "explainer_plain": "A linear function is like a straight line...",
  "cfu": {
    "cfu_type": "mcq",
    "question": "What is the y-intercept of y = 2x + 3?",
    "options": ["2", "3", "5", "0"],
    "answerIndex": 1
  },
  "rubric": {...},
  "misconceptions": [...],

  // NEW DIAGRAM FIELDS
  "diagram_eligible": true,
  "diagram_description": "Visualize a linear function y = 2x + 3 with clearly labeled axes, showing the y-intercept at (0, 3) and the gradient as rise over run (2/1). Use a Scottish context example like calculating taxi fare (£3 pickup + £2 per mile) with distance on x-axis and total cost on y-axis. The diagram should scaffold understanding of y-intercept as starting value and gradient as rate of change.",
  "diagram_context": "function_visualization",
  "diagram_metadata": {
    "jsxgraph_json": {
      "boundingbox": [-2, 10, 8, -2],
      "axis": true,
      "elements": [
        {
          "type": "functiongraph",
          "function": "2*x + 3",
          "strokeColor": "#0066cc",
          "strokeWidth": 3
        },
        {
          "type": "point",
          "coords": [0, 3],
          "name": "y-intercept",
          "size": 4,
          "fillColor": "#ff6600"
        },
        {
          "type": "text",
          "coords": [4, 8],
          "text": "Taxi Fare: £3 + £2/mile",
          "fontSize": 16
        }
      ]
    },
    "image_file_id": "67321abc456def789",
    "visual_critique_score": 0.89,
    "critique_iterations": 2,
    "critique_feedback": "Excellent clarity and Scottish context. Minor: Consider increasing font size for dyslexia-friendly reading.",
    "generation_status": "success"
  }
}
```

### Example: Card with Failed Diagram

```json
{
  "id": "card_007",
  "card_type": "guided_practice",
  "explainer": "...",
  "diagram_eligible": true,
  "diagram_description": "Show a geometric construction of bisecting an angle using compass and straightedge.",
  "diagram_context": "geometry_construction",
  "diagram_metadata": {
    "generation_status": "failed",
    "error_message": "DiagramScreenshot service timeout after 30s (service may be overloaded)"
  }
}
```

### Example: Card Without Diagram

```json
{
  "id": "card_010",
  "card_type": "independent_practice",
  "explainer": "Solve the equation 3x + 5 = 20...",
  "diagram_eligible": false
}
```

---

**End of Specification**
