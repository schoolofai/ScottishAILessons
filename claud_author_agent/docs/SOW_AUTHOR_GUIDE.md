# SOW Author System - Complete Guide

**Version**: 2.0 (Pydantic-based validation)
**Last Updated**: 2025-10-29

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Input/Output Specification](#inputoutput-specification)
7. [Subagent Prompts](#subagent-prompts)
8. [Token Optimization](#token-optimization)
9. [Troubleshooting](#troubleshooting)
10. [API Reference](#api-reference)

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

### What Gets Generated

A complete SOW includes:
- **Appropriate number of lesson entries** (typically 10-20, agent-determined) with full pedagogical design
- **6-12 cards per lesson** (starter, explainer, modelling, guided practice, independent practice, exit ticket)
- **Assessment standard alignments** with enriched SQA descriptions
- **Accessibility profiles** (dyslexia-friendly, plain language, extra time)
- **Scottish context integration** (local references, cultural relevance)
- **Policy compliance** (SQA calculator rules, assessment guidelines)
- **Coherence metadata** (sequencing notes, prerequisite tracking)

---

## Architecture

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
cd /tmp/sow_author_<execution_id>
cat schema_validation_result.json

# Common fixes:
# - Ensure Course_data.txt has complete SQA descriptions
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

### Debug Mode

Enable verbose logging:
```bash
python -m src.sow_author_cli \
  --courseId course_c84474 \
  --log-level DEBUG \
  --no-persist-workspace  # Keep workspace for inspection
```

Inspect workspace files:
```bash
cd /tmp/sow_author_<execution_id>
ls -la

# Key files:
# - Course_data.txt (extracted SQA data)
# - authored_sow.json (generated SOW)
# - sow_critic_result.json (unified critic feedback)
# - schema_validation_result.json (pydantic validation)
```

---

## API Reference

### SOWAuthorClaudeAgent

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
