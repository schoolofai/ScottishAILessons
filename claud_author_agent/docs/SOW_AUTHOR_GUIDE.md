# SOW Author System - Complete Guide

**Version**: 3.0 (Iterative Architecture)
**Last Updated**: 2026-01-20
**Testing Status**: ✅ All 4 Phases Tested and Passed

## Table of Contents

1. [Overview](#overview)
2. [Phase Testing Results](#phase-testing-results-2026-01-20)
3. [Authoring Modes](#authoring-modes)
4. [Architecture](#architecture)
   - [Iterative Mode (Default)](#iterative-mode-architecture)
   - [Legacy Mode](#legacy-mode-architecture)
5. [Quick Start](#quick-start)
6. [Installation](#installation)
7. [Usage](#usage)
8. [Input/Output Specification](#inputoutput-specification)
9. [Subagent Prompts](#subagent-prompts)
10. [Token Optimization](#token-optimization)
11. [Troubleshooting](#troubleshooting)
12. [API Reference](#api-reference)

---

## Overview

The SOW (Scheme of Work) Author is an autonomous AI-powered system that generates complete course planning documents for Scottish secondary education. It transforms a simple course identifier into a comprehensive, pedagogically sound, curriculum-aligned scheme of work with an appropriate number of lesson entries (typically 10-20, agent-determined based on course complexity).

### Key Features

- ✅ **Autonomous Authoring**: Generates complete SOW from courseId only
- ✅ **Auto-Fetching**: Automatically retrieves subject/level from Appwrite database
- ✅ **Belt-and-Braces Validation**: Two-tier validation (unified_critic + schema_critic)
- ✅ **Pydantic Validation**: Fast, deterministic schema compliance (v2.0)
- ✅ **On-Demand Research**: WebSearch/WebFetch for Scottish contexts and exemplars
- ✅ **Cost Tracking**: Detailed token usage and cost metrics
- ✅ **Workspace Isolation**: Each execution gets isolated filesystem
- ✅ **Iterative Mode (v3.0)**: Lesson-by-lesson generation for better schema compliance

### What Gets Generated

A complete SOW includes:
- **Appropriate number of lesson entries** (typically 10-20, agent-determined) with full pedagogical design
- **5-card flow per teach lesson** (starter, explainer, modelling, guided_practice, exit_ticket) - simplified for iterative mode
- **9-card structure for mock_exam** (instructions + question cards covering all skills)
- **Assessment standard alignments** with enriched SQA descriptions
- **Accessibility profiles** (dyslexia-friendly, plain language, CEFR B1)
- **Scottish context integration** (local references, cultural relevance)
- **Policy compliance** (SQA calculator rules, assessment guidelines)
- **Coherence metadata** (sequencing notes, prerequisite tracking)

**Note**: Independent practice is handled by a **separate system** outside of SOW authoring.

---

## Phase Testing Results (2026-01-20)

All 4 phases of the iterative SOW author have been comprehensively tested with **Applications of Mathematics Higher** (`course_c84476`).

### Summary

| Phase | Description | Status | Duration |
|-------|-------------|--------|----------|
| **Phase 1** | Outline Generation | ✅ PASSED | ~2 min |
| **Phase 2** | Per-Lesson Generation (19 lessons) | ✅ PASSED | 63.9 min |
| **Phase 3** | Metadata Generation | ✅ PASSED | 47.1 sec |
| **Phase 4** | Assembly & Appwrite Upsert | ✅ PASSED | 0.7 sec |

### Phase 1: Outline Generation

| Metric | Value | Status |
|--------|-------|--------|
| **Unit Tests** | 32/32 passed | ✅ |
| **Integration Tests** | 27/27 passed | ✅ |
| **E2E Tests** | 19/19 passed | ✅ |
| **Total Lessons** | 19 | ✅ In sweet spot (15-20) |
| **Critic Score** | 0.76 | ✅ PASS threshold (>0.7) |

### Phase 2: Per-Lesson Generation

| Metric | Value | Status |
|--------|-------|--------|
| **Total Lessons** | 19/19 generated | ✅ |
| **Pass Rate** | 100% | ✅ |
| **First-Attempt Pass** | 18/19 (94.7%) | ✅ |
| **Required Revision** | 1 (Lesson 14) | ✅ Critic loop worked |
| **Average Time/Lesson** | ~3.4 min | ✅ |

### Phase 3: Metadata Generation

| Metric | Value | Status |
|--------|-------|--------|
| **Elapsed Time** | 47.1 seconds | ✅ |
| **Policy Notes** | 5 items | ✅ |
| **Sequencing Notes** | 7 items | ✅ |
| **Accessibility Notes** | 6 items | ✅ |
| **Engagement Notes** | 7 items | ✅ |

### Phase 4: Assembly & Upsert

| Metric | Value | Status |
|--------|-------|--------|
| **Assembly Time** | 0.1 seconds | ✅ |
| **Original Size** | 409,834 chars | - |
| **Compressed Size** | 127,501 chars | 68.9% reduction |
| **Storage Used** | Appwrite Storage Bucket | ✅ (>100K limit) |
| **Final Document ID** | `696f676d27b78f0a71ae` | ✅ |

**Test Workspaces** (preserved for reference):
- Phase 1: `workspace/20260119_220800/`
- Phase 2: `workspace/phase2_full_test_20260119_231045/`
- Phase 3: `workspace/phase3_test_20260120_093014/`
- Phase 4: `workspace/phase4_test_20260120_*/`

---

## Authoring Modes

**v3.0** introduces two SOW authoring modes. The **iterative mode** (default) generates lessons one at a time for better schema compliance, while the **legacy mode** generates the entire SOW in a single monolithic pass.

### Mode Comparison

| Aspect | Iterative (Default) | Legacy |
|--------|---------------------|--------|
| **CLI Flag** | `--iterative` (or omit) | `--legacy` |
| **Class** | `IterativeSOWAuthor` | `SOWAuthorClaudeAgent` |
| **Generation** | Lesson-by-lesson (~4K tokens each) | Monolithic (~50K+ tokens) |
| **Schema Compliance** | ✅ Better (small scope) | ⚠️ May drift |
| **Cross-Lesson Coherence** | ✅ Explicit validation | Implicit in prompt |
| **Debugging** | ✅ Per-lesson workspace files | Single authored_sow.json |
| **Web Research** | ✅ Per-lesson WebSearch/WebFetch | ✅ Full document research |

### When to Use Each Mode

**Use Iterative Mode (Default)** when:
- Creating new courses
- Schema compliance issues have occurred with legacy mode
- Need fine-grained debugging of lesson generation
- Lessons require individualized web research

**Use Legacy Mode** when:
- Iterative mode encounters issues
- Backward compatibility is needed
- Existing workflows depend on legacy behavior

### CLI Usage

```bash
# Iterative mode (default)
python -m src.sow_author_cli --courseId course_c84474

# Explicit iterative mode
python -m src.sow_author_cli --courseId course_c84474 --iterative

# Legacy mode
python -m src.sow_author_cli --courseId course_c84474 --legacy

# Via DevOps pipeline
./devops/pipeline.sh lessons --subject mathematics --level national_5          # iterative
./devops/pipeline.sh lessons --subject physics --level higher --legacy          # legacy
```

---

## Architecture

The SOW Author system supports two architectures depending on the authoring mode selected.

### Iterative Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ITERATIVE SOW AUTHOR PIPELINE (v3.0 - Default)                  │
│                    Lesson-by-Lesson with Claude Agent SDK                    │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌────────────────────────────┐
                    │   Course_outcomes.json     │
                    │  (SQA curriculum data from │
                    │   Appwrite, Python extract)│
                    └───────────┬────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║         PHASE 1: OUTLINE GENERATION (Claude Agent SDK)               ║ │
│  ║                                                                      ║ │
│  ║   Subagent: outline_author + outline_critic (PASS/REVISE loop)      ║ │
│  ║   Prompt: src/prompts/outline_author_prompt.md                       ║ │
│  ║   Output: lesson_outline.json                                        ║ │
│  ║                                                                      ║ │
│  ║   Creates: Lesson sequence (teach + mock_exam only), standards map  ║ │
│  ║   Validated: Pydantic + Critic score >= 0.7                         ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║       PHASE 2: LESSON GENERATION (Claude Agent SDK, Loop N times)    ║ │
│  ║                                                                      ║ │
│  ║   FOR each lesson in outline (orchestrated by Python):              ║ │
│  ║   ┌────────────────────────────────────────────────────────────────┐ ║ │
│  ║   │  Subagent: lesson_author + lesson_critic (PASS/REVISE loop)   │ ║ │
│  ║   │  Prompt: src/prompts/lesson_entry_prompt.md                    │ ║ │
│  ║   │  Context: Course_outcomes + outline + previous_lessons         │ ║ │
│  ║   │  Output: lesson_{N}.json (~4K tokens each)                     │ ║ │
│  ║   │                                                                │ ║ │
│  ║   │  ✅ Pydantic validation via structured output                  │ ║ │
│  ║   │  ✅ Critic loop with 5-dimension scoring (>0.7 = PASS)         │ ║ │
│  ║   │  ✅ Previous lessons provide coherence context                  │ ║ │
│  ║   └────────────────────────────────────────────────────────────────┘ ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║         PHASE 3: METADATA GENERATION (Claude Agent SDK)              ║ │
│  ║                                                                      ║ │
│  ║   Subagent: metadata_author (no critic - summarization task)        ║ │
│  ║   Prompt: src/prompts/metadata_author_prompt.md                      ║ │
│  ║   Output: metadata.json                                              ║ │
│  ║                                                                      ║ │
│  ║   Creates: Coherence notes, accessibility notes, engagement notes    ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  ╔══════════════════════════════════════════════════════════════════════╗ │
│  ║              PHASE 4: ASSEMBLY (Pure Python, No LLM)                 ║ │
│  ║                                                                      ║ │
│  ║   Module: src/utils/sow_assembler.py                                 ║ │
│  ║                                                                      ║ │
│  ║   - Combines lesson_01..N.json + metadata.json                      ║ │
│  ║   - Cross-lesson validation (order, mock_exam count)                ║ │
│  ║   - Final AuthoredSOWIterative Pydantic validation                  ║ │
│  ║   - Compression (gzip+base64) for entries                           ║ │
│  ║   - Storage Bucket fallback if > 100K chars                         ║ │
│  ║   - Upsert to Appwrite                                              ║ │
│  ╚══════════════════════════════════════════════════════════════════════╝ │
└───────────────────────────────────────────────────────────────────────────┘
```

### Iterative Mode Files

| File | Purpose |
|------|---------|
| `src/iterative_sow_author.py` | Main orchestrator (uses Claude Agent SDK) |
| **Prompts** | |
| `src/prompts/outline_author_prompt.md` | Outline generation prompt |
| `src/prompts/outline_critic_prompt.md` | Outline critic prompt (PASS/REVISE) |
| `src/prompts/lesson_entry_prompt.md` | Single lesson generation prompt |
| `src/prompts/lesson_critic_prompt.md` | Lesson critic prompt (5-dimension scoring) |
| `src/prompts/metadata_author_prompt.md` | Metadata generation prompt |
| **Schema Models** | |
| `src/tools/sow_schema_models.py` | Pydantic models (LessonOutline, SOWEntry, Metadata, AuthoredSOW) |
| `src/tools/critic_schema_models.py` | Pydantic models for critic results |
| `src/utils/minimal_schemas.py` | Minimal JSON schemas for SDK structured output |
| **Assembly & Storage** | |
| `src/utils/sow_assembler.py` | Pure Python cross-lesson validation & assembly |
| `src/utils/sow_upserter.py` | Appwrite upsert with compression & storage bucket |
| `src/utils/entry_trimmer.py` | Non-essential field trimming for size reduction |
| `src/utils/storage_helpers.py` | Appwrite Storage bucket upload/download |

### Legacy Mode Architecture

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SOW AUTHOR PIPELINE                       │
│                        (3 stages)                            │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ STAGE 0: Pre-Processing (Python Utilities)                   │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Course Data Extractor                                    │
│     Input:  courseId                                         │
│     Output: /workspace/Course_data.txt                       │
│     Purpose: Extract official SQA data from Appwrite         │
│                                                               │
│  2. Pydantic Validator Setup (v2.0 TOKEN OPTIMIZATION)      │
│     Tool:   mcp__validator__validate_sow_schema              │
│     Source: src/tools/sow_validator_tool.py                  │
│     Replaces: 1265-line SOW_Schema.md file                   │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ STAGE 1: SOW Author (LLM Subagent)                           │
├──────────────────────────────────────────────────────────────┤
│  @sow_author subagent                                        │
│  Prompt: src/prompts/sow_author_prompt.md (588 lines)       │
│                                                               │
│  Input:                                                       │
│    • /workspace/Course_data.txt                              │
│                                                               │
│  Tools:                                                       │
│    • Read, Write, Edit, Glob, Grep, TodoWrite, Task         │
│    • WebSearch, WebFetch (on-demand research)                │
│                                                               │
│  Output:                                                      │
│    • /workspace/authored_sow.json                            │
│                                                               │
│  Strategy:                                                    │
│    • Schema-driven 10-step process                           │
│    • Incremental writing (prevents token limits)             │
│    • On-demand research (Scottish contexts, misconceptions)  │
│    • Enriched format (objects not bare strings)              │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ STAGE 2: Unified Critic (BELT - LLM Subagent)                │
├──────────────────────────────────────────────────────────────┤
│  @unified_critic subagent                                    │
│  Prompt: src/prompts/unified_critic_prompt.md (1142 lines)  │
│                                                               │
│  Input:                                                       │
│    • /workspace/Course_data.txt                              │
│    • /workspace/authored_sow.json                            │
│                                                               │
│  Validation:                                                  │
│    1. Schema Gate (blocking) - enriched format, CFU          │
│    2. Five Dimensions:                                       │
│       - Coverage (standards alignment)                       │
│       - Sequencing (pedagogical progression)                 │
│       - Policy (SQA compliance)                              │
│       - Accessibility (inclusive design)                     │
│       - Authenticity (Scottish contexts)                     │
│                                                               │
│  Output:                                                      │
│    • /workspace/sow_critic_result.json                       │
│                                                               │
│  Retry Logic:                                                 │
│    • Max 3 attempts                                          │
│    • Feedback loop: critic → author → critic                │
│    • Blocks on schema_gate failures                         │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ STAGE 3: Schema Critic (BRACES - LLM + Pydantic Tool)        │
├──────────────────────────────────────────────────────────────┤
│  @schema_critic subagent (v2.0 Pydantic-based)               │
│  Prompt: src/prompts/schema_critic_prompt.md (322 lines)    │
│                                                               │
│  Input:                                                       │
│    • /workspace/authored_sow.json                            │
│                                                               │
│  Tool:                                                        │
│    • mcp__validator__validate_sow_schema                     │
│    • Pydantic models (390 lines)                             │
│    • 8 custom validators                                     │
│                                                               │
│  Validation Checks:                                           │
│    ✓ Enriched format (entry + card level)                   │
│    ✓ CFU strategy specificity                               │
│    ✓ Metadata completeness                                   │
│    ✓ Card structure (6-12 cards, required fields)           │
│    ✓ Timing alignment (±2 min tolerance)                    │
│    ✓ Entry sequencing (1, 2, 3...)                          │
│    ✓ Rubric points validation                               │
│    ✓ Teach-revision pairing (1:1 within 3 entries)          │
│    ✓ Course requirements (≥1 independent, =1 mock)          │
│                                                               │
│  Output:                                                      │
│    • /workspace/schema_validation_result.json                │
│                                                               │
│  v2.0 Improvement:                                            │
│    • Execution: 30+ seconds → 5-10 seconds                   │
│    • Token savings: ~13-16K per execution                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ STAGE 4: Post-Processing (Python Utilities)                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  SOW Upserter (with Pydantic Pre-Flight Validation)         │
│    Input:  /workspace/authored_sow.json                      │
│    Validation: Pydantic schema check before DB write         │
│    Output: Appwrite document in default.Authored_SOW         │
│    Purpose: Final validation + save to production database   │
│                                                               │
│  Fail-Fast Protection:                                       │
│    - Validates SOW with Pydantic before database write       │
│    - Prevents invalid data from reaching production          │
│    - Provides exact error locations if validation fails      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Belt-and-Braces Strategy

**BELT (Unified Critic)**:
- **Schema Gate** (v3.0): Uses Pydantic validation tool for early schema checking
- Catches schema issues EARLY during pedagogical review (blocking gate)
- Comprehensive 5-dimension pedagogical validation (Coverage, Sequencing, Policy, Accessibility, Authenticity)
- Iterative feedback loop with author

**BRACES (Schema Critic)**:
- Final schema-only validation using same Pydantic tool (defensive double-check)
- Deterministic, fast (5-10 seconds)
- Catches ANY remaining schema violations
- Zero tolerance (any error = FAIL)

**Together**: Belt-and-braces with shared Pydantic validation ensures consistent schema compliance across both stages

---

## Quick Start

### Minimal Example (Interactive Mode)

```bash
cd claud_author_agent
python -m src.sow_author_cli
```

You'll be prompted for the courseId. The system will:
1. Auto-fetch subject/level from Appwrite
2. Generate complete SOW (appropriate number of lessons)
3. Validate with belt-and-braces strategy (unified_critic + schema_critic)
4. Final Pydantic validation before database write
5. Save to Appwrite database

### Command-Line Example

```bash
# Simple courseId input
python -m src.sow_author_cli --courseId course_c84474

# With custom configuration
python -m src.sow_author_cli \
  --courseId course_c84474 \
  --log-level DEBUG \
  --no-persist-workspace
```

### JSON File Example

Create `input.json`:
```json
{
  "courseId": "course_c84474"
}
```

Run:
```bash
python -m src.sow_author_cli --input input.json
```

---

## Installation

### Prerequisites

1. **Python 3.11+**
2. **Appwrite Database** (with courses collection)
3. **Claude API Key** (Anthropic)
4. **MCP Configuration** (.mcp.json)

### Setup Steps

```bash
# 1. Navigate to project directory
cd claud_author_agent

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -e .
pip install claude-agent-sdk mcp pydantic

# 4. Configure MCP (Appwrite connection)
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your Appwrite credentials

# 5. Set Claude API key
export ANTHROPIC_API_KEY="your-api-key-here"

# 6. Test installation
python -m src.sow_author_cli --help
```

### MCP Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": [
        "-y",
        "@niladribose/mcp-appwrite-server"
      ],
      "env": {
        "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## Usage

### CLI Options

```bash
python -m src.sow_author_cli [OPTIONS]

OPTIONS:
  # Input Methods (mutually exclusive)
  --input JSON_FILE          Load courseId from JSON file
  --courseId COURSE_ID       Provide courseId directly
  # (no options)              Interactive mode

  # Authoring Mode (v3.0)
  --iterative                Use iterative lesson-by-lesson mode (default)
  --legacy                   Use legacy monolithic mode

  # Configuration
  --mcp-config PATH          Path to MCP config (default: .mcp.json)
  --no-persist-workspace     Delete workspace after execution
  --log-level LEVEL          DEBUG|INFO|WARNING|ERROR (default: INFO)

  # Help
  --help                     Show help message
```

### Programmatic API

```python
import asyncio
from src.sow_author_claude_client import SOWAuthorClaudeAgent

async def generate_sow():
    # Initialize agent
    agent = SOWAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    # Execute (subject/level auto-fetched)
    result = await agent.execute(courseId="course_c84474")

    if result["success"]:
        print(f"✅ SOW created: {result['appwrite_document_id']}")
        print(f"📊 Cost: ${result['metrics']['total_cost_usd']:.4f}")
    else:
        print(f"❌ Failed: {result['error']}")

    return result

# Run
result = asyncio.run(generate_sow())
```

---

## Input/Output Specification

### Input Format

**Minimal Input** (courseId only):
```json
{
  "courseId": "course_c84474"
}
```

**What the system auto-fetches from Appwrite**:
- Subject (e.g., "mathematics")
- Level (e.g., "national-5")
- Course title
- SQA course code
- Units, outcomes, assessment standards

### Output Format

**Success Response**:
```json
{
  "success": true,
  "execution_id": "20251029_143045",
  "workspace_path": "/tmp/sow_author_20251029_143045",
  "appwrite_document_id": "68f616168886c3362749",
  "metrics": {
    "total_tokens": 85432,
    "total_cost_usd": 1.2456,
    "execution_time_seconds": 245.3,
    "subagent_metrics": {
      "sow_author": {"tokens": 42315, "cost_usd": 0.6234},
      "unified_critic": {"tokens": 28456, "cost_usd": 0.4187},
      "schema_critic": {"tokens": 14661, "cost_usd": 0.2035}
    }
  }
}
```

**Failure Response**:
```json
{
  "success": false,
  "execution_id": "20251029_143045",
  "error": "Schema validation failed after 3 retries",
  "workspace_path": "/tmp/sow_author_20251029_143045",
  "metrics": {
    "total_tokens": 45123,
    "total_cost_usd": 0.6234
  }
}
```

### Generated SOW Structure

The `authored_sow.json` file contains:

```json
{
  "$id": "68f616168886c3362749",
  "courseId": "course_c84474",
  "version": "1",
  "status": "published",

  "metadata": {
    "coherence": {
      "policy_notes": ["Non-calculator sections first", "..."],
      "sequencing_notes": ["Fractions → Decimals → Percentages", "..."]
    },
    "accessibility_notes": ["Dyslexia-friendly fonts", "..."],
    "engagement_notes": ["Scottish shop prices", "..."],
    "weeks": 10,
    "periods_per_week": 4
  },

  "entries": [
    {
      "order": 1,
      "label": "Fractions: Introduction and Real-World Contexts",
      "lesson_type": "teach",

      "coherence": {
        "block_name": "Fractions Unit",
        "block_index": "1.1",
        "prerequisites": []
      },

      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": "Mental fraction work"
      },

      "engagement_tags": ["scottish_contexts", "real_world"],
      "outcomeRefs": ["O1"],

      "assessmentStandardRefs": [
        {
          "code": "AS1.2",
          "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
          "outcome": "O1"
        }
      ],

      "lesson_plan": {
        "summary": "Students explore fractions in Scottish contexts...",

        "card_structure": [
          {
            "card_number": 1,
            "card_type": "starter",
            "title": "Real-World Fractions",
            "purpose": "Activate prior knowledge",
            "standards_addressed": [
              {
                "code": "AS1.2",
                "description": "Add and subtract fractions...",
                "outcome": "O1"
              }
            ],
            "pedagogical_approach": "Show images of fractions in daily life",
            "key_concepts": ["numerator", "denominator"],
            "cfu_strategy": "MCQ: Where do you see fractions? A) supermarket B) bus schedule",
            "estimated_minutes": 5
          }
          // ... 5-11 more cards
        ],

        "lesson_flow_summary": "Starter → Explainer → Modelling → Practice → Exit",
        "multi_standard_integration_strategy": "Fractions + percentages connection",
        "misconceptions_embedded_in_cards": ["misc_card_2", "misc_card_5"],
        "assessment_progression": "Formative → Summative"
      },

      "accessibility_profile": {
        "dyslexia_friendly": true,
        "plain_language_level": "CEFR_B1",
        "extra_time": true,
        "extra_time_percentage": 25,
        "key_terms_simplified": ["numerator", "denominator"],
        "visual_support_strategy": "Fraction diagrams"
      },

      "estMinutes": 50,
      "lesson_instruction": "Introduce fractions using Scottish shop prices..."
    }
    // ... 7-24 more entries
  ],

  "accessibility_notes": "All lessons use dyslexia-friendly fonts, plain language (CEFR B1), and provide 25% extra time..."
}
```

---

## Subagent Prompts

### 1. SOW Author Prompt
**Location**: `src/prompts/sow_author_prompt.md` (588 lines)

**Purpose**: Create complete SOW from course data

**Key Sections**:
- **10-Step Process**: Incremental authoring strategy
- **Enriched Format Requirements**: Objects not bare strings
- **CFU Specificity Rules**: No generic "ask questions"
- **Scottish Context Integration**: Local references, cultural relevance
- **Research Guidelines**: When/how to use WebSearch/WebFetch
- **Incremental Writing Strategy**: Prevents 32K token limits

**Example CFU Strategies** (from prompt):
- ✅ **GOOD**: "MCQ: Which fraction equals 25%? A) 1/4 B) 1/2 C) 1/3 D) 2/4"
- ✅ **GOOD**: "Numeric: A box costs £12 and is reduced by 1/3. What's the discount?"
- ❌ **BAD**: "Ask questions"
- ❌ **BAD**: "Check understanding"

---

### 2. Unified Critic Prompt
**Location**: `src/prompts/unified_critic_prompt.md` (1142 lines)

**Purpose**: Comprehensive validation (schema gate + 5 dimensions)

**Schema Gate** (blocking validation):
1. Enriched format at entry level (code/description/outcome objects)
2. Enriched format at card level (standards_addressed objects)
3. CFU strategies are specific (not generic)

**Five Dimensions** (pedagogical scoring):
1. **Coverage** (0.0-1.0): Standards alignment completeness
2. **Sequencing** (0.0-1.0): Pedagogical progression quality
3. **Policy** (0.0-1.0): SQA compliance (calculator rules, assessment)
4. **Accessibility** (0.0-1.0): Inclusive design (dyslexia, plain language)
5. **Authenticity** (0.0-1.0): Scottish contexts integration

**Pass Criteria**:
- `schema_gate.pass == true` (blocking)
- `overall_score >= 0.8` (all dimensions ≥ 0.7)

**Retry Logic**:
- Max 3 attempts
- Feedback loop: critic → author → critic
- Blocks immediately on schema_gate failures

---

### 3. Schema Critic Prompt
**Location**: `src/prompts/schema_critic_prompt.md` (322 lines, v2.0 simplified)

**Purpose**: Final schema-only validation using Pydantic tool

**v2.0 Changes**:
- ❌ No manual validation logic
- ❌ No reading 1265-line schema file
- ✅ Single tool call: `mcp__validator__validate_sow_schema`
- ✅ Deterministic Pydantic validation
- ✅ Token savings: ~13-16K per execution

**Validation Process**:
1. Read `/workspace/authored_sow.json`
2. Call Pydantic validation tool
3. Transform tool output to expected format
4. Write `/workspace/schema_validation_result.json`

**What Gets Validated** (by Pydantic tool):
- Enriched format compliance (entry + card level)
- CFU strategy specificity (rejects generic phrases)
- Complete metadata (all required fields, non-empty arrays)
- Card structure integrity (6-12 cards, required fields)
- Card timing alignment (sum matches estMinutes ±2 min)
- Entry order sequencing (1, 2, 3...)
- Rubric points validation (criteria sum to total_points)
- Teach-revision pairing (1:1 within 3 entries)
- Course requirements (≥1 independent_practice, exactly 1 mock_assessment)

---

### Iterative Mode Prompts (v3.0)

The iterative mode uses three specialized prompts for each phase of generation:

#### 4. Outline Author Prompt
**Location**: `src/prompts/outline_author_prompt.md` (~180 lines)

**Purpose**: Generate the lesson sequence outline before detailed generation

**Key Responsibilities**:
- Analyze Course_data.txt for standards and units
- Plan lesson sequence (10-20 lessons typically)
- Establish teach-revision pairing (1:1 within 3 entries)
- Map assessment standards to lessons
- Determine lesson types (teach, revision, independent_practice, mock_assessment)

**Output**: `lesson_outline.json` with `LessonOutline` schema

---

#### 5. Lesson Entry Prompt
**Location**: `src/prompts/lesson_entry_prompt.md` (~241 lines)

**Purpose**: Generate a single lesson entry with full pedagogical detail

**Key Responsibilities**:
- Read outline entry for current lesson context
- Use previous lessons for coherence
- Generate 6-12 cards with specific CFU strategies
- Apply WebSearch/WebFetch for Scottish context and misconceptions
- Ensure enriched format (objects not bare strings)

**Context Files Available**:
- `Course_data.txt` - SQA curriculum data
- `lesson_outline.json` - Full outline
- `current_outline.json` - Current lesson's outline entry
- `previous_lessons.json` - Previously generated lessons

**Output**: `lesson_{N}.json` with `SOWEntry` schema

---

#### 6. Metadata Author Prompt
**Location**: `src/prompts/metadata_author_prompt.md` (~198 lines)

**Purpose**: Generate course-level metadata after all lessons are complete

**Key Responsibilities**:
- Summarize coherence across all lessons
- Document accessibility strategies
- Capture engagement approaches
- Calculate weeks and periods per week

**Output**: `metadata.json` with `SOWMetadata` schema

---

## Token Optimization

### v2.0 Improvements (Pydantic-Based Validation)

**Before (v1.0)**:
- Schema file copy: 1265 lines × ~6 tokens/line = ~7,590 tokens
- Schema_critic prompt: 737 lines × ~6 tokens/line = ~4,422 tokens
- Manual validation logic: ~30 seconds execution
- **Total overhead**: ~12,000 tokens per SOW execution

**After (v2.0)**:
- Schema file copy: **ELIMINATED** (0 tokens)
- Schema_critic prompt: 322 lines × ~6 tokens/line = ~1,932 tokens
- Pydantic validation: ~5-10 seconds execution
- **Total overhead**: ~2,000 tokens per SOW execution

**Token Savings**: ~10,000 tokens per SOW execution
**Cost Savings**: ~$0.30-0.40 per SOW (at $30/million tokens)
**Time Savings**: ~20-25 seconds per validation

### Cost Breakdown (Typical SOW)

```
Subagent Costs (Sonnet 4.5 @ $3 input / $15 output per million tokens):
├─ SOW Author:        ~40K tokens  →  $0.60
├─ Unified Critic:    ~25K tokens  →  $0.38
├─ Schema Critic:     ~15K tokens  →  $0.23 (v2.0 optimized)
└─ Total:             ~80K tokens  →  $1.20

v1.0 Total:           ~95K tokens  →  $1.43
v2.0 Total:           ~80K tokens  →  $1.20
Savings:              ~15K tokens  →  $0.23 per SOW
```

**Annual Savings** (100 SOWs/year):
- Token savings: 1.5M tokens
- Cost savings: ~$23

---

## Troubleshooting

### Common Issues

#### 1. "Course not found in database"

**Cause**: Invalid courseId or missing from Appwrite
**Solution**:
```bash
# Verify courseId exists in default.courses collection
# Check MCP connection to Appwrite in .mcp.json
```

#### 2. "Schema validation failed after 3 retries"

**Cause**: Author consistently produces invalid schema
**Solution**:
```bash
# Check workspace for detailed errors
# Iterative mode:
cd claud_author_agent/workspace/<execution_id>
cat lesson_XX_critic.json  # Check specific lesson critic result

# Legacy mode:
cd /tmp/sow_author_<execution_id>
cat schema_validation_result.json

# Common fixes:
# - Ensure Course_outcomes.json has complete SQA descriptions
# - Check for generic CFU strategies ("ask questions")
# - Verify enriched format (objects not bare strings)
```

#### 3. "MCP server connection failed"

**Cause**: Invalid Appwrite credentials or network issues
**Solution**:
```bash
# Test MCP connection manually
cat .mcp.json  # Verify credentials
# Check Appwrite endpoint and API key
# Ensure network access to Appwrite
```

#### 4. "Out of tokens / Context limit exceeded"

**Cause**: SOW too large for single generation
**Solution**:
```python
# The system uses incremental writing to prevent this
# If still occurs:
# - Agent will automatically determine appropriate entry count
# - Split into multiple smaller courses if needed
# - Increase max_output_tokens (env var)
# - Note: Entry count is flexible (no hardcoded max)
```

#### 5. "Pydantic validation errors"

**Cause**: SOW structure doesn't match schema models
**Solution**:
```bash
# Test validation standalone
cd claud_author_agent
python3 src/tools/sow_validator_tool.py example_sow.json

# Check specific error locations in output
# Update author prompt if systematic issues found
```

#### 6. "Entries too large for Appwrite" / "Storage Bucket upload failed"

**Cause**: Compressed entries exceed 100K character limit
**Solution**:
```bash
# The system automatically handles this:
# 1. Entry trimming removes non-essential fields
# 2. If still >100K, uploads to Appwrite Storage bucket
# 3. stores "storage:<file_id>" reference in entries field

# To verify storage bucket exists:
# Check Appwrite Console → Storage → authored_sow_entries bucket

# To manually check entry size:
cd claud_author_agent/workspace/<execution_id>
python3 -c "
import json
from pathlib import Path
data = json.loads(Path('authored_sow.json').read_text())
entries_json = json.dumps(data['entries'])
print(f'Entries size: {len(entries_json):,} chars')
"
```

### Debug Mode

Enable verbose logging:
```bash
python -m src.sow_author_cli \
  --courseId course_c84474 \
  --log-level DEBUG
```

**Note**: Remove `--no-persist-workspace` to keep workspace for inspection.

Inspect workspace files:
```bash
# Iterative mode (default):
cd claud_author_agent/workspace/<execution_id>
ls -la

# Key files (iterative):
# - Course_outcomes.json (extracted SQA data)
# - lesson_outline.json (Phase 1 output)
# - outline_critic_result.json (Phase 1 critic)
# - lesson_01.json ... lesson_N.json (Phase 2 outputs)
# - lesson_XX_critic.json (Phase 2 critic per lesson)
# - metadata.json (Phase 3 output)
# - authored_sow.json (Phase 4 assembled output)

# Legacy mode:
cd /tmp/sow_author_<execution_id>

# Key files (legacy):
# - Course_data.txt (extracted SQA data)
# - authored_sow.json (generated SOW)
# - sow_critic_result.json (unified critic feedback)
# - schema_validation_result.json (pydantic validation)
```

---

## API Reference

### IterativeSOWAuthor (v3.0 - Default)

**Class**: `src.iterative_sow_author.IterativeSOWAuthor`

#### Constructor

```python
IterativeSOWAuthor(
    mcp_config_path: str = ".mcp.json",
    persist_workspace: bool = True,
    log_level: str = "INFO"
)
```

**Parameters**:
- `mcp_config_path` (str): Path to MCP configuration file
- `persist_workspace` (bool): If True, preserve workspace for debugging
- `log_level` (str): Logging level (DEBUG, INFO, WARNING, ERROR)

**Returns**: IterativeSOWAuthor instance

---

#### execute()

```python
async execute(courseId: str, version: str = "1") -> Dict[str, Any]
```

**Parameters**:
- `courseId` (str): Course identifier (must exist in default.courses)
- `version` (str): SOW version string (default: "1")

**Returns**: Dictionary with execution results

**Success Response**:
```python
{
    "success": True,
    "execution_id": "20260119_143045",
    "workspace_path": "/tmp/iterative_sow_20260119_143045",
    "appwrite_document_id": "68f616168886c3362749",
    "phases": {
        "outline": {"status": "completed", "lessons_planned": 15},
        "lessons": {"status": "completed", "generated": 15, "failed": 0},
        "metadata": {"status": "completed"},
        "assembly": {"status": "completed"}
    },
    "metrics": {
        "total_tokens": 65432,
        "total_cost_usd": 0.98,
        "execution_time_seconds": 185.3
    }
}
```

**Failure Response**:
```python
{
    "success": False,
    "execution_id": "20260119_143045",
    "error": "Lesson 5 validation failed after 3 retries",
    "workspace_path": "/tmp/iterative_sow_20260119_143045",
    "phases": {
        "outline": {"status": "completed", "lessons_planned": 15},
        "lessons": {"status": "failed", "generated": 4, "failed": 1}
    },
    "metrics": {...}
}
```

---

#### Workspace Files (Iterative Mode)

When `persist_workspace=True`, the workspace contains:

```
workspace/<execution_id>/
├── Course_outcomes.json         # Extracted SQA curriculum data from Appwrite
├── sow_research.md              # Optional: Web research notes (if conducted)
├── lesson_outline.json          # Phase 1: Lesson sequence outline
├── outline_critic_result.json   # Phase 1: Critic evaluation result
├── current_outline.json         # Context: Current lesson's outline entry
├── previous_lessons.json        # Context: Previously generated lessons
├── all_lessons.json             # Context: All lessons for metadata generation
├── lesson_01.json               # Phase 2: Lesson 1
├── lesson_01_critic.json        # Phase 2: Lesson 1 critic result
├── lesson_02.json               # Phase 2: Lesson 2
├── ...
├── lesson_N.json                # Phase 2: Final lesson
├── metadata.json                # Phase 3: Course-level metadata
├── authored_sow.json            # Phase 4: Assembled SOW (pre-compression)
└── test_metrics.json            # Debug: Phase timing and validation results
```

**Note**: Workspaces are preserved under `claud_author_agent/workspace/` directory, not `/tmp/`.

---

### SOWAuthorClaudeAgent (Legacy)

**Class**: `src.sow_author_claude_client.SOWAuthorClaudeAgent`

#### Constructor

```python
SOWAuthorClaudeAgent(
    mcp_config_path: str = ".mcp.json",
    persist_workspace: bool = True,
    log_level: str = "INFO"
)
```

**Parameters**:
- `mcp_config_path` (str): Path to MCP configuration file
- `persist_workspace` (bool): If True, preserve workspace for debugging
- `log_level` (str): Logging level (DEBUG, INFO, WARNING, ERROR)

**Note**: Retry/cycle management is handled by agent-level `max_turns` configuration (default: 500)

**Returns**: SOWAuthorClaudeAgent instance

---

#### execute()

```python
async execute(courseId: str) -> Dict[str, Any]
```

**Parameters**:
- `courseId` (str): Course identifier (must exist in default.courses)

**Returns**: Dictionary with execution results

**Success Response**:
```python
{
    "success": True,
    "execution_id": "20251029_143045",
    "workspace_path": "/tmp/sow_author_20251029_143045",
    "appwrite_document_id": "68f616168886c3362749",
    "metrics": {
        "total_tokens": 85432,
        "total_cost_usd": 1.2456,
        "execution_time_seconds": 245.3,
        "subagent_metrics": {...}
    }
}
```

**Failure Response**:
```python
{
    "success": False,
    "execution_id": "20251029_143045",
    "error": "Schema validation failed after 3 retries",
    "workspace_path": "/tmp/sow_author_20251029_143045",
    "metrics": {
        "total_tokens": 45123,
        "total_cost_usd": 0.6234
    }
}
```

---

### CLI Functions

**Module**: `src.sow_author_cli`

#### load_input_from_json()

```python
def load_input_from_json(json_path: str) -> Dict[str, str]
```

Load input parameters from JSON file.

**Parameters**:
- `json_path` (str): Path to JSON input file

**Returns**: Dictionary with courseId

**Raises**:
- `FileNotFoundError`: If JSON file not found
- `ValueError`: If JSON invalid or missing courseId

---

#### interactive_input()

```python
def interactive_input() -> Dict[str, str]
```

Prompt user for courseId interactively.

**Returns**: Dictionary with courseId

**Raises**:
- `ValueError`: If courseId is empty

---

#### run_agent()

```python
async run_agent(
    courseId: str,
    mcp_config_path: str = ".mcp.json",
    persist_workspace: bool = True,
    log_level: str = "INFO"
) -> Dict[str, Any]
```

Run SOW Author agent with given parameters (CLI helper function).

**Parameters**: Same as SOWAuthorClaudeAgent constructor + courseId

**Returns**: Result dictionary from agent execution

---

## Examples

### Example 1: Basic CLI Usage

```bash
# Interactive mode
python -m src.sow_author_cli

# Output:
# ==================================================
# SOW Author - Interactive Input
# ==================================================
#
# Please provide the Course ID:
#
# Course ID (e.g., 'course_c84474'):
#   (Must exist in default.courses collection)
#   > course_c84474
#
# ==================================================
# SOW Author Claude Agent
# ==================================================
#
# Input Parameters:
#   Course ID:     course_c84474
#   ...
#
# ✅ SOW AUTHORING COMPLETED SUCCESSFULLY!
# ==================================================
#
# Results:
#   Execution ID:     20251029_143045
#   Workspace Path:   /tmp/sow_author_20251029_143045
#   Document ID:      68f616168886c3362749
#
# Metrics:
#   Total Tokens:     85432
#   Total Cost (USD): $1.2456
```

---

### Example 2: Programmatic Usage

```python
import asyncio
from pathlib import Path
from src.sow_author_claude_client import SOWAuthorClaudeAgent

async def batch_generate_sows():
    """Generate SOWs for multiple courses."""

    course_ids = [
        "course_c84474",  # National 5 Mathematics
        "course_c75773",  # National 3 Physics
        "course_c91234"   # National 4 Biology
    ]

    agent = SOWAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    results = []
    total_cost = 0.0

    for course_id in course_ids:
        print(f"\n{'='*60}")
        print(f"Generating SOW for: {course_id}")
        print(f"{'='*60}\n")

        result = await agent.execute(courseId=course_id)
        results.append(result)

        if result["success"]:
            cost = result["metrics"]["total_cost_usd"]
            total_cost += cost
            print(f"✅ Success! Cost: ${cost:.4f}")
        else:
            print(f"❌ Failed: {result['error']}")

    print(f"\n{'='*60}")
    print(f"Batch Summary:")
    print(f"  Total SOWs: {len(course_ids)}")
    print(f"  Successful: {sum(1 for r in results if r['success'])}")
    print(f"  Failed: {sum(1 for r in results if not r['success'])}")
    print(f"  Total Cost: ${total_cost:.4f}")
    print(f"{'='*60}\n")

    return results

# Run batch generation
results = asyncio.run(batch_generate_sows())
```

---

### Example 3: Custom Validation

```python
import asyncio
import json
from pathlib import Path
from src.sow_author_claude_client import SOWAuthorClaudeAgent
from src.tools.sow_validator_tool import validate_sow_schema

async def generate_and_validate():
    """Generate SOW and run additional validation."""

    agent = SOWAuthorClaudeAgent()
    result = await agent.execute(courseId="course_c84474")

    if not result["success"]:
        print(f"❌ Generation failed: {result['error']}")
        return

    # Read generated SOW
    workspace = Path(result["workspace_path"])
    sow_path = workspace / "authored_sow.json"
    sow_json = sow_path.read_text()

    # Run standalone Pydantic validation
    validation_result = validate_sow_schema(sow_json)

    print(f"\n{'='*60}")
    print(f"Validation Results:")
    print(f"{'='*60}")
    print(json.dumps(validation_result, indent=2))

    if validation_result["valid"]:
        print(f"\n✅ SOW is valid!")
        print(f"   Entries: {validation_result['stats']['total_entries']}")
        print(f"   Cards: {validation_result['stats']['total_cards']}")
    else:
        print(f"\n❌ Validation failed with {len(validation_result['errors'])} errors")
        for error in validation_result['errors'][:5]:
            print(f"   - {error['location']}: {error['message']}")

# Run
asyncio.run(generate_and_validate())
```

---

## Version History

### v3.0.1 (2026-01-20) - Phase Testing Complete
- ✅ **All 4 phases comprehensively tested** with Applications of Mathematics Higher
- ✅ Storage Bucket fallback for entries >100K chars (Appwrite Storage)
- ✅ Entry trimming for size reduction (409K → 92K chars after compression)
- ✅ Critic loops with 5-dimension scoring (Coverage, Sequencing, Policy, Accessibility, Authenticity)
- ✅ Simplified outline lesson types: `teach` and `mock_exam` only
- ✅ Simplified card flow: 5 cards (starter, explainer, modelling, guided_practice, exit_ticket)
- ✅ Test results documented with workspace preservation
- ✅ Updated workspace file structure (Course_outcomes.json, critic results)

### v3.0 (2026-01-19) - Iterative Architecture
- ✅ New iterative lesson-by-lesson generation mode (default)
- ✅ 4-phase architecture: Outline → Lessons (loop) → Metadata → Assembly
- ✅ New `IterativeSOWAuthor` class using Claude Agent SDK
- ✅ Six prompts: `outline_author`, `outline_critic`, `lesson_entry`, `lesson_critic`, `metadata_author`
- ✅ Minimal JSON schemas for structured output (`src/utils/minimal_schemas.py`)
- ✅ Pure Python assembler with cross-lesson validation
- ✅ Better schema compliance via small scope (~4K tokens per lesson)
- ✅ WebSearch/WebFetch per lesson for targeted research
- ✅ CLI flags: `--iterative` (default), `--legacy`
- ✅ Full DevOps pipeline integration

### v2.0 (2025-10-29) - Pydantic Optimization
- ✅ Replaced 1265-line schema file with Pydantic models
- ✅ Schema_critic now uses `mcp__validator__validate_sow_schema` tool
- ✅ Token savings: ~13-16K per execution
- ✅ Execution time: 30+ seconds → 5-10 seconds
- ✅ Simplified schema_critic prompt: 737 → 322 lines

### v1.0 (2025-09-15) - Initial Release
- ✅ Auto-fetching subject/level from Appwrite
- ✅ Belt-and-braces validation strategy
- ✅ On-demand WebSearch/WebFetch research
- ✅ 3-subagent pipeline (author, unified_critic, schema_critic)
- ✅ Cost tracking and metrics

---

## Support

For issues, questions, or feature requests:
- **GitHub Issues**: https://github.com/schoolofai/ScottishAILessons/issues
- **Documentation**: `claud_author_agent/docs/`
- **Example SOWs**: `claud_author_agent/example_sow.json`

---

**End of Guide**
