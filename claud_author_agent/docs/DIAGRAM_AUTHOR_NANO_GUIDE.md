# Diagram Author Nano Guide

> Gemini-based diagram generation using Gemini Flash (`gemini-2.5-flash-image`)

## Overview

`diagram_author_nano` is an alternative diagram generation pipeline that uses Gemini's direct image generation capabilities instead of the JSXGraph + DiagramScreenshot approach.

**Key Difference**: Gemini generates PNG images directly from natural language prompts, eliminating the need for JSXGraph JSON code generation and the screenshot rendering service.

---

## Quick Start

```bash
cd claud_author_agent

# 1. Set environment variables
export GEMINI_API_KEY=your_gemini_key

# 2. Run for a lesson
python -m src.diagram_author_nano_cli --courseId course_xxx --order 1

# 3. Single card mode (faster for testing)
python -m src.diagram_author_nano_cli --courseId course_xxx --order 1 --card-order 2
```

### CLI Options

| Option | Required | Description |
|--------|----------|-------------|
| `--courseId` | Yes | Course ID (e.g., `course_c84474`) |
| `--order` | Yes | Lesson order within course (1-indexed) |
| `--card-order` | No | Process single card only (1-indexed) |
| `--persist` | No | Keep workspace after execution (default: True) |
| `--log-level` | No | DEBUG, INFO, WARNING, ERROR (default: INFO) |

---

## Architecture Comparison

| Aspect | JSXGraph Pipeline | Gemini Nano Pipeline |
|--------|-------------------|----------------------|
| **Generation** | Claude generates JSON code → DiagramScreenshot renders PNG | Gemini generates PNG directly |
| **Refinement** | Regenerate entire JSON code | Multi-turn chat with visual feedback |
| **Critique Input** | PNG + JSXGraph JSON for code review | PNG only (no code to review) |
| **Feedback Format** | Code changes: "Set boundingbox to..." | Visual descriptions: "Add 10% padding..." |
| **Storage** | jsxgraph_json + image_file_id | image_file_id only (jsxgraph_json = "") |
| **Backend ID** | `rendering_backend = "jsxgraph"` | `rendering_backend = "gemini_nano"` |
| **Dependencies** | DiagramScreenshot service running | GEMINI_API_KEY only |

---

## Master Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DIAGRAM AUTHOR NANO PIPELINE                        │
└─────────────────────────────────────────────────────────────────────────────┘

 CLI Input                                                    Final Output
 ────────                                                    ────────────
 --courseId course_abc123                                    ┌──────────────┐
 --order 3                                                   │ Appwrite DB  │
 --card-order 2 (optional)                                   │  Storage &   │
     │                                                       │  Collection  │
     ▼                                                       └──────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  SUBSYSTEM 1 │───►│  SUBSYSTEM 2 │───►│  SUBSYSTEM 3 │───►│ SUBSYSTEM │ │
│  │   Lesson     │    │  Eligibility │    │   Diagram    │    │    4      │ │
│  │   Fetch      │    │   Analyzer   │    │  Generation  │    │  Upsert   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│        │                   │                   │                   │       │
│        ▼                   ▼                   ▼                   ▼       │
│   lesson_template     eligible_cards     diagrams_output      Appwrite    │
│      .json              .json              .json              Documents   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Subsystem Details

### SUBSYSTEM 1: Lesson Template Fetch

**File**: `src/utils/diagram_extractor.py` → `fetch_lesson_template()`

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SUBSYSTEM 1: LESSON TEMPLATE FETCH                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT                                                                   │
│  ─────                                                                   │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  courseId:  "course_c84474"                                │         │
│  │  order:     3 (1-indexed lesson order)                     │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  PROCESS                                                                │
│  ───────                                                                │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  1. Query Appwrite (default.lesson_templates)              │         │
│  │     - Filter: courseId = X AND sow_order = Y               │         │
│  │                                                            │         │
│  │  2. Decompress if needed                                   │         │
│  │     - Cards may be gzip+base64 compressed                  │         │
│  │     - decompress_json_gzip_base64() extracts JSON array    │         │
│  │                                                            │         │
│  │  3. Validate (fast-fail)                                   │         │
│  │     - No template found → ValueError                       │         │
│  │     - Multiple templates → Warning, use first              │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  OUTPUT                                                                 │
│  ──────                                                                 │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  {                                                         │         │
│  │    "lessonTemplateId": "lesson_template_abc123",           │         │
│  │    "courseId": "course_c84474",                            │         │
│  │    "title": "Right-Angled Triangles",                      │         │
│  │    "sow_order": 3,                                         │         │
│  │    "cards": [                                              │         │
│  │      {                                                     │         │
│  │        "id": "card_001",                                   │         │
│  │        "title": "Pythagorean Theorem",                     │         │
│  │        "explainer": "In a right triangle...",              │         │
│  │        "cfu": { "question": "Calculate..." }               │         │
│  │      },                                                    │         │
│  │      { "id": "card_002", ... },                            │         │
│  │      ...                                                   │         │
│  │    ]                                                       │         │
│  │  }                                                         │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### SUBSYSTEM 2: Eligibility Analyzer

**File**: `src/eligibility_analyzer_agent.py` → `EligibilityAnalyzerAgent.analyze()`

This subsystem is **reused from the JSXGraph pipeline** - no changes needed.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SUBSYSTEM 2: ELIGIBILITY ANALYZER                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT                                                                   │
│  ─────                                                                   │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  lesson_template dict (from Subsystem 1)                   │         │
│  │  - Contains "cards" array with N cards                     │         │
│  │  - Each card has: id, title, explainer, cfu                │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  PROCESS (Claude Agent SDK)                                             │
│  ──────────────────────────                                             │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  1. Create temp workspace                                  │         │
│  │     - Write lesson_template.json to workspace              │         │
│  │                                                            │         │
│  │  2. Run Claude Agent                                       │         │
│  │     - Model: claude-sonnet-4-5                             │         │
│  │     - Prompt: eligibility_analyzer_prompt.md               │         │
│  │     - Tools: Read, Write, Edit, Glob, Grep                 │         │
│  │                                                            │         │
│  │  3. LLM Semantic Analysis (per card)                       │         │
│  │     ┌─────────────────────────────────────────────────┐    │         │
│  │     │  For each card:                                 │    │         │
│  │     │   ✓ Analyze "explainer" (lesson content)        │    │         │
│  │     │   ✓ Analyze "cfu" (assessment questions)        │    │         │
│  │     │   ✓ Determine: needs_lesson_diagram (bool)      │    │         │
│  │     │   ✓ Determine: needs_cfu_diagram (bool)         │    │         │
│  │     │                                                 │    │         │
│  │     │  ELIGIBLE if content has:                       │    │         │
│  │     │   - Geometric shapes/angles/constructions       │    │         │
│  │     │   - Coordinate graphs/functions                 │    │         │
│  │     │   - Statistical charts/histograms               │    │         │
│  │     │                                                 │    │         │
│  │     │  NOT ELIGIBLE if content has:                   │    │         │
│  │     │   - Pure text definitions                       │    │         │
│  │     │   - Rubrics/grading criteria                    │    │         │
│  │     │   - Concept maps/flowcharts                     │    │         │
│  │     └─────────────────────────────────────────────────┘    │         │
│  │                                                            │         │
│  │  4. Agent writes eligible_cards.json to workspace          │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  OUTPUT                                                                 │
│  ──────                                                                 │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  [                                                         │         │
│  │    {                                                       │         │
│  │      "id": "card_001",                                     │         │
│  │      "title": "Pythagorean Theorem",                       │         │
│  │      "explainer": "In a right triangle...",                │         │
│  │      "cfu": {...},                                         │         │
│  │                                                            │         │
│  │      // Eligibility additions ↓                            │         │
│  │      "needs_lesson_diagram": true,                         │         │
│  │      "needs_cfu_diagram": true,                            │         │
│  │      "lesson_diagram_reason": "Contains geometric...",     │         │
│  │      "cfu_diagram_reason": "CFU asks to calculate...",     │         │
│  │      "diagram_contexts": ["lesson", "cfu"],                │         │
│  │      "_eligibility_method": "claude_agent_sdk_analysis"    │         │
│  │    },                                                      │         │
│  │    ...                                                     │         │
│  │  ]                                                         │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
│  Note: Cards with empty diagram_contexts are filtered out               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### SUBSYSTEM 3: Diagram Generation Loop

**Files**:
- `src/diagram_author_nano_client.py` → `_generate_diagram_for_context()`
- `src/utils/gemini_image_generator.py` → `GeminiDiagramChat`
- `src/utils/visual_critic_claude.py` → `critique_image()`

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 SUBSYSTEM 3: DIAGRAM GENERATION LOOP                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT (per eligible card per context)                                   │
│  ────────────────────────────────────                                    │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  card:             Card dict with explainer/cfu content    │         │
│  │  diagram_context:  "lesson" or "cfu"                       │         │
│  │  lesson_template:  Full template for metadata              │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    GENERATION LOOP (max 10 iterations)           │   │
│  │                                                                  │   │
│  │  ITERATION 1: Initial Generation                                │   │
│  │  ────────────────────────────────                                │   │
│  │                                                                  │   │
│  │  ┌─────────────┐   Natural Language   ┌─────────────────────┐   │   │
│  │  │   Build     │      Prompt          │   Gemini Nano       │   │   │
│  │  │   Prompt    │─────────────────────►│   Banana Pro        │   │   │
│  │  │             │                      │                     │   │   │
│  │  │ - Title     │                      │ gemini-3-pro-image  │   │   │
│  │  │ - Content   │                      │ -preview            │   │   │
│  │  │ - Colors    │                      │                     │   │   │
│  │  │ - Context   │                      │ Aspect: 16:9        │   │   │
│  │  │   rules     │                      │ Size: 2K            │   │   │
│  │  └─────────────┘                      └──────────┬──────────┘   │   │
│  │                                                  │              │   │
│  │                                           ┌──────▼──────┐       │   │
│  │                                           │  PNG Image  │       │   │
│  │                                           │  (base64)   │       │   │
│  │                                           └──────┬──────┘       │   │
│  │                                                  │              │   │
│  │  CRITIQUE PHASE                                  ▼              │   │
│  │  ──────────────                           ┌─────────────┐       │   │
│  │                                           │ Save to     │       │   │
│  │  ┌──────────────────────────────────────►│ workspace   │       │   │
│  │  │                                        └──────┬──────┘       │   │
│  │  │                                               │              │   │
│  │  │         ┌─────────────────────────────────────▼───────────┐  │   │
│  │  │         │             CLAUDE VISUAL CRITIC                │  │   │
│  │  │         │                                                 │  │   │
│  │  │         │  Input:                                         │  │   │
│  │  │         │   - PNG image (base64)                          │  │   │
│  │  │         │   - Card content (for context)                  │  │   │
│  │  │         │   - diagram_context ("lesson" or "cfu")         │  │   │
│  │  │         │   - Iteration number                            │  │   │
│  │  │         │                                                 │  │   │
│  │  │         │  Scoring (4 dimensions):                        │  │   │
│  │  │         │   ┌─────────────────────────────────────────┐   │  │   │
│  │  │         │   │ Clarity    (0.35 weight): Readability   │   │  │   │
│  │  │         │   │ Accuracy   (0.35 weight): Math correct  │   │  │   │
│  │  │         │   │ Pedagogy   (0.20 weight): Teaching value│   │  │   │
│  │  │         │   │ Aesthetics (0.10 weight): Visual appeal │   │  │   │
│  │  │         │   └─────────────────────────────────────────┘   │  │   │
│  │  │         │                                                 │  │   │
│  │  │         │  Output:                                        │  │   │
│  │  │         │   {                                             │  │   │
│  │  │         │     "decision": "ACCEPT|REFINE|REJECT",         │  │   │
│  │  │         │     "final_score": 0.82,                        │  │   │
│  │  │         │     "feedback": "Add 10% padding..."            │  │   │
│  │  │         │   }                                             │  │   │
│  │  │         └────────────────────────┬────────────────────────┘  │   │
│  │  │                                  │                           │   │
│  │  │                                  ▼                           │   │
│  │  │                     ┌───────────────────────┐                │   │
│  │  │                     │   score >= 0.85 ?     │                │   │
│  │  │                     └───────────┬───────────┘                │   │
│  │  │                            ┌────┴────┐                       │   │
│  │  │                            │         │                       │   │
│  │  │                          YES        NO                       │   │
│  │  │                           │          │                       │   │
│  │  │                           ▼          ▼                       │   │
│  │  │                     ┌──────────┐  ┌──────────────────┐       │   │
│  │  │                     │  ACCEPT  │  │ iteration < 10 ? │       │   │
│  │  │                     │  break   │  └────────┬─────────┘       │   │
│  │  │                     └──────────┘      ┌────┴────┐            │   │
│  │  │                                      YES       NO            │   │
│  │  │                                       │         │            │   │
│  │  │  REFINEMENT LOOP                      ▼         ▼            │   │
│  │  │  ────────────────             ┌─────────────┐ ┌──────────┐   │   │
│  │  │                               │   REFINE    │ │  REJECT  │   │   │
│  │  └───────────────────────────────│ (next iter) │ │  break   │   │   │
│  │                                  │             │ └──────────┘   │   │
│  │     Visual Feedback              │ Send to     │                │   │
│  │     (NOT code changes!)          │ Gemini chat │                │   │
│  │                                  │ for refine  │                │   │
│  │     "Add 10% padding"            └─────────────┘                │   │
│  │     "Make labels larger"               │                        │   │
│  │     "Use thicker lines"                │                        │   │
│  │                                        └─────────►(loop)        │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  OUTPUT (per card per context)                                          │
│  ─────────────────────────────                                          │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  {                                                         │         │
│  │    "success": true,                                        │         │
│  │    "diagram": {                                            │         │
│  │      "lesson_template_id": "lesson_template_abc123",       │         │
│  │      "card_id": "card_001",                                │         │
│  │      "jsxgraph_json": "",           // Empty for Gemini    │         │
│  │      "image_base64": "iVBORw0K...", // PNG image           │         │
│  │      "image_path": "/tmp/workspace/diagrams/card_001.png", │         │
│  │      "diagram_type": "geometry",                           │         │
│  │      "diagram_context": "lesson",                          │         │
│  │      "visual_critique_score": 0.89,                        │         │
│  │      "critique_iterations": 3,                             │         │
│  │      "critique_feedback": [...],    // Full history        │         │
│  │      "rendering_backend": "gemini_nano"                    │         │
│  │    }                                                       │         │
│  │  }                                                         │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### SUBSYSTEM 4: Diagram Upserter (Persistence)

**File**: `src/utils/diagram_upserter.py` → `batch_upsert_diagrams()` + `upsert_lesson_diagram()`

This subsystem was **modified** to support the new `rendering_backend` field and optional `jsxgraph_json`.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SUBSYSTEM 4: DIAGRAM UPSERTER                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT                                                                   │
│  ─────                                                                   │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  diagrams_data: Array of diagram dicts from Subsystem 3    │         │
│  │                                                            │         │
│  │  Each diagram contains:                                    │         │
│  │   - lesson_template_id                                     │         │
│  │   - card_id                                                │         │
│  │   - image_base64 (PNG)                                     │         │
│  │   - jsxgraph_json ("" for gemini_nano)                     │         │
│  │   - diagram_type, diagram_context                          │         │
│  │   - visual_critique_score, critique_iterations             │         │
│  │   - rendering_backend                                      │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  PROCESS (per diagram)                                                  │
│  ─────────────────────                                                  │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │                                                            │         │
│  │  1. VALIDATION                                             │         │
│  │     ┌───────────────────────────────────────────────────┐  │         │
│  │     │ ✓ Required fields present                        │  │         │
│  │     │ ✓ visual_critique_score in [0.0, 1.0]            │  │         │
│  │     │ ✓ critique_iterations in [1, 10]                 │  │         │
│  │     │ ✓ diagram_type in [geometry|algebra|stats|mixed] │  │         │
│  │     │ ✓ diagram_context in [lesson|cfu]                │  │         │
│  │     │ ✓ rendering_backend in [jsxgraph|gemini_nano]    │  │         │
│  │     └───────────────────────────────────────────────────┘  │         │
│  │                              │                             │         │
│  │                              ▼                             │         │
│  │  2. NORMALIZE DIAGRAM TYPE                                 │         │
│  │     ┌───────────────────────────────────────────────────┐  │         │
│  │     │ "trigonometry" → "geometry"                       │  │         │
│  │     │ "inverse_trig" → "geometry"                       │  │         │
│  │     │ "mixed_practice" → "mixed"                        │  │         │
│  │     │ "histogram" → "statistics"                        │  │         │
│  │     └───────────────────────────────────────────────────┘  │         │
│  │                              │                             │         │
│  │                              ▼                             │         │
│  │  3. UPLOAD IMAGE TO STORAGE                                │         │
│  │     ┌───────────────────────────────────────────────────┐  │         │
│  │     │  Appwrite Storage Bucket: "diagram_images"        │  │         │
│  │     │                                                   │  │         │
│  │     │  File ID: {lessonTemplateId}_{cardId}_{context}   │  │         │
│  │     │  Returns: image_file_id (Storage reference)       │  │         │
│  │     └───────────────────────────────────────────────────┘  │         │
│  │                              │                             │         │
│  │                              ▼                             │         │
│  │  4. UPSERT DOCUMENT TO COLLECTION                          │         │
│  │     ┌───────────────────────────────────────────────────┐  │         │
│  │     │  Collection: default.lesson_diagrams              │  │         │
│  │     │                                                   │  │         │
│  │     │  Query: lessonTemplateId + cardId + context       │  │         │
│  │     │         + diagram_index                           │  │         │
│  │     │                                                   │  │         │
│  │     │  EXISTS?                                          │  │         │
│  │     │   ├─ YES → UPDATE existing document               │  │         │
│  │     │   └─ NO  → CREATE new document                    │  │         │
│  │     │            (ID: dgm_{md5_hash[:8]})               │  │         │
│  │     └───────────────────────────────────────────────────┘  │         │
│  │                                                            │         │
│  └────────────────────────────────────────────────────────────┘         │
│                              │                                          │
│                              ▼                                          │
│  OUTPUT                                                                 │
│  ──────                                                                 │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  Appwrite Document (default.lesson_diagrams):              │         │
│  │                                                            │         │
│  │  {                                                         │         │
│  │    "$id": "dgm_a1b2c3d4",                                  │         │
│  │    "lessonTemplateId": "lesson_template_abc123",           │         │
│  │    "cardId": "card_001",                                   │         │
│  │    "diagram_context": "lesson",                            │         │
│  │    "diagram_index": 0,                                     │         │
│  │                                                            │         │
│  │    // Image stored as reference (not base64)               │         │
│  │    "image_file_id": "file_xyz789",                         │         │
│  │                                                            │         │
│  │    // Empty for Gemini Nano backend                        │         │
│  │    "jsxgraph_json": "",                                    │         │
│  │                                                            │         │
│  │    "diagram_type": "geometry",                             │         │
│  │    "visual_critique_score": 0.89,                          │         │
│  │    "critique_iterations": 3,                               │         │
│  │    "critique_feedback": "[{...}, {...}, {...}]",           │         │
│  │    "execution_id": "exec_20250131_143022",                 │         │
│  │    "rendering_backend": "gemini_nano"   // KEY FIELD       │         │
│  │  }                                                         │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
│  Batch Result:                                                           │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │  {                                                         │         │
│  │    "total": 5,                                             │         │
│  │    "succeeded": 4,                                         │         │
│  │    "failed": 1,                                            │         │
│  │    "documents": [...],                                     │         │
│  │    "errors": [{ "card_id": "card_003", "error": "..." }]   │         │
│  │  }                                                         │         │
│  └────────────────────────────────────────────────────────────┘         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow Summary

```
 ╔══════════════════════════════════════════════════════════════════════════╗
 ║                         COMPLETE DATA FLOW                               ║
 ╠══════════════════════════════════════════════════════════════════════════╣
 ║                                                                          ║
 ║   CLI INVOCATION                                                         ║
 ║   ──────────────                                                         ║
 ║   $ python -m src.diagram_author_nano_cli \                              ║
 ║       --courseId course_c84474 --order 3                                 ║
 ║                                                                          ║
 ║         │                                                                ║
 ║         ▼                                                                ║
 ║   ┌──────────────────────────────────────────────────────────────────┐   ║
 ║   │                  DiagramAuthorNanoAgent.execute()                │   ║
 ║   └──────────────────────────────────────────────────────────────────┘   ║
 ║         │                                                                ║
 ║         │  Step 1-2: Validate inputs, check Gemini API                   ║
 ║         │  Step 3: Create workspace                                      ║
 ║         ▼                                                                ║
 ║   ┌──────────────────────────────────────────────────────────────────┐   ║
 ║   │  fetch_lesson_template(courseId, order)     [SUBSYSTEM 1]        │   ║
 ║   │                                                                  │   ║
 ║   │  Appwrite Query → Decompress → lesson_template dict              │   ║
 ║   └──────────────────────────────────────────────────────────────────┘   ║
 ║         │                                                                ║
 ║         │  lesson_template with cards[]                                  ║
 ║         ▼                                                                ║
 ║   ┌──────────────────────────────────────────────────────────────────┐   ║
 ║   │  EligibilityAnalyzerAgent.analyze(lesson_template) [SUBSYSTEM 2] │   ║
 ║   │                                                                  │   ║
 ║   │  Claude Agent → Semantic Analysis → eligible_cards[]             │   ║
 ║   │  - needs_lesson_diagram (bool)                                   │   ║
 ║   │  - needs_cfu_diagram (bool)                                      │   ║
 ║   │  - diagram_contexts (["lesson"] / ["cfu"] / ["lesson", "cfu"])   │   ║
 ║   └──────────────────────────────────────────────────────────────────┘   ║
 ║         │                                                                ║
 ║         │  For each card in eligible_cards:                              ║
 ║         │    For each context in diagram_contexts:                       ║
 ║         ▼                                                                ║
 ║   ┌──────────────────────────────────────────────────────────────────┐   ║
 ║   │  _generate_diagram_for_context(card, context)   [SUBSYSTEM 3]    │   ║
 ║   │                                                                  │   ║
 ║   │  ┌─────────────────────────────────────────────────────────────┐ │   ║
 ║   │  │  GENERATION LOOP:                                           │ │   ║
 ║   │  │                                                             │ │   ║
 ║   │  │  1. Build prompt (title, content, colors, rules)            │ │   ║
 ║   │  │  2. Gemini.start_session(prompt) → PNG                      │ │   ║
 ║   │  │  3. Save PNG to workspace                                   │ │   ║
 ║   │  │  4. Claude critique_image() → score + feedback              │ │   ║
 ║   │  │  5. if score >= 0.85: ACCEPT, break                         │ │   ║
 ║   │  │  6. if iteration < 10: Gemini.refine(feedback), goto 3      │ │   ║
 ║   │  │  7. else: REJECT                                            │ │   ║
 ║   │  └─────────────────────────────────────────────────────────────┘ │   ║
 ║   │                                                                  │   ║
 ║   │  Output: diagram dict with image_base64, score, feedback         │   ║
 ║   └──────────────────────────────────────────────────────────────────┘   ║
 ║         │                                                                ║
 ║         │  Collect all diagram dicts → diagrams_output.json              ║
 ║         ▼                                                                ║
 ║   ┌──────────────────────────────────────────────────────────────────┐   ║
 ║   │  batch_upsert_diagrams(diagrams_output)         [SUBSYSTEM 4]    │   ║
 ║   │                                                                  │   ║
 ║   │  For each diagram:                                               │   ║
 ║   │   1. Validate fields                                             │   ║
 ║   │   2. Normalize diagram_type                                      │   ║
 ║   │   3. Upload PNG to Storage → image_file_id                       │   ║
 ║   │   4. Upsert to lesson_diagrams collection                        │   ║
 ║   └──────────────────────────────────────────────────────────────────┘   ║
 ║         │                                                                ║
 ║         ▼                                                                ║
 ║   ┌──────────────────────────────────────────────────────────────────┐   ║
 ║   │                      FINAL OUTPUT                                │   ║
 ║   │                                                                  │   ║
 ║   │  {                                                               │   ║
 ║   │    "success": true,                                              │   ║
 ║   │    "execution_id": "exec_20250131_143022",                       │   ║
 ║   │    "diagrams_created": 4,                                        │   ║
 ║   │    "diagrams_failed": 0,                                         │   ║
 ║   │    "workspace_path": "/tmp/nano_exec_20250131_143022",           │   ║
 ║   │    "errors": []                                                  │   ║
 ║   │  }                                                               │   ║
 ║   └──────────────────────────────────────────────────────────────────┘   ║
 ║                                                                          ║
 ╚══════════════════════════════════════════════════════════════════════════╝
```

---

## File Inventory

### New Files (Created for Nano)

| File | Purpose |
|------|---------|
| `src/diagram_author_nano_client.py` | Main orchestrator class |
| `src/diagram_author_nano_cli.py` | CLI interface |
| `src/utils/gemini_client.py` | Gemini API singleton client |
| `src/utils/gemini_image_generator.py` | Multi-turn chat for generation/refinement |
| `src/utils/visual_critic_claude.py` | Claude vision API for image critique |
| `src/prompts/nano_diagram_author_prompt.md` | Orchestration instructions |
| `src/prompts/nano_diagram_generator.md` | Gemini prompt building guidelines |
| `src/prompts/visual_critic_nano.md` | Visual feedback format |

### Modified Files

| File | Change |
|------|--------|
| `src/utils/diagram_upserter.py` | Added `rendering_backend` param, made `jsxgraph_json` optional |
| `.env.example` | Added Gemini configuration section |
| `requirements.txt` | Added `google-genai>=0.7.0` |

### Reused Files (No Changes)

| File | Purpose |
|------|---------|
| `src/eligibility_analyzer_agent.py` | Card eligibility analysis |
| `src/utils/diagram_extractor.py` | Lesson template fetching |
| `src/utils/storage_uploader.py` | Appwrite Storage upload |
| `src/utils/filesystem.py` | Workspace isolation |
| `src/utils/validation.py` | Input validation |
| `src/prompts/eligibility_analyzer_prompt.md` | Eligibility prompt |

---

## Environment Configuration

Add to `.env`:

```bash
# Gemini API Configuration
GEMINI_API_KEY=your_api_key_here

# Optional overrides (defaults shown)
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
GEMINI_IMAGE_ASPECT_RATIO=16:9
GEMINI_IMAGE_SIZE=2K
```

---

## Error Handling Pattern (Fast-Fail)

All subsystems follow the same pattern - **no fallback mechanisms**:

```
                           ┌──────────────┐
                           │    INPUT     │
                           └──────┬───────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │      VALIDATION            │
                    │  ┌────────────────────┐    │
                    │  │ Missing field?     │───►│ ValueError ──► FAIL FAST
                    │  │ Invalid range?     │    │
                    │  │ Wrong type?        │    │
                    │  └────────────────────┘    │
                    └─────────────┬──────────────┘
                                  │ ✓ Valid
                                  ▼
                    ┌────────────────────────────┐
                    │      PROCESS               │
                    │  ┌────────────────────┐    │
                    │  │ API error?         │───►│ Exception ──► FAIL FAST
                    │  │ Network timeout?   │    │ (no fallback!)
                    │  │ Parse error?       │    │
                    │  └────────────────────┘    │
                    └─────────────┬──────────────┘
                                  │ ✓ Success
                                  ▼
                           ┌──────────────┐
                           │   OUTPUT     │
                           └──────────────┘

                    NEVER use fallback mechanisms
                    NEVER silently swallow errors
                    ALWAYS log detailed error context
```

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `GeminiConfigurationError: GEMINI_API_KEY not set` | Missing API key | Set `GEMINI_API_KEY` environment variable |
| `ValueError: Lesson template not found` | Invalid courseId/order | Verify courseId and order in Appwrite |
| `GeminiIterationLimitError: Max iterations exceeded` | Quality threshold not met | Image may not be achievable; check prompt |

### Debug Mode

```bash
python -m src.diagram_author_nano_cli \
    --courseId course_xxx --order 1 \
    --log-level DEBUG \
    --persist
```

This will:
- Show detailed logs for each step
- Preserve workspace in `/tmp/nano_exec_*` for inspection
- Save intermediate images for review

---

## See Also

- [DIAGRAM_AUTHOR_GUIDE.md](./DIAGRAM_AUTHOR_GUIDE.md) - JSXGraph pipeline documentation
- [nano_bannana_pro.md](./nano_bannana_pro.md) - Gemini API examples
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Common commands
