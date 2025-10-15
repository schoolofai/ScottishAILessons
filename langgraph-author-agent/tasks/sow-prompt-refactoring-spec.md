# SOW Author Prompts Refactoring Specification
## Context Engineering Best Practices Implementation

**Version**: 1.0
**Date**: 2025-10-15
**Status**: Proposed
**Reference**: `/docs/context_engineering.md`

---

## Executive Summary

This specification outlines a comprehensive refactoring of the SOW author prompts (`sow_author_prompts.py`) to align with context engineering best practices. The refactoring will reduce token usage by ~80%, improve maintainability through modularization, and enhance agent comprehension through layered context architecture.

**Key Metrics**:
- Token reduction: 3000 → 550 tokens (default mode)
- Lines of code: 748 → ~300 (core prompt)
- Estimated effort: 8-16 hours
- Risk level: Low (incremental migration path)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Best Practices Violations](#best-practices-violations)
3. [Refactoring Strategy](#refactoring-strategy)
4. [Proposed Architecture](#proposed-architecture)
5. [Implementation Plan](#implementation-plan)
6. [Testing Strategy](#testing-strategy)
7. [Success Metrics](#success-metrics)
8. [Migration Path](#migration-path)

---

## Current State Analysis

### File: `langgraph-author-agent/src/sow_author_prompts.py`

**Statistics**:
- Total lines: 748 (main prompt) + 358 (critic prompt) = 1106 lines
- Estimated tokens: ~3000 (main) + ~1500 (critic) = 4500 tokens
- Structure: Monolithic XML-style sections

### ✅ Strengths (Already Following Best Practices)

1. **Fail-Fast Validation** (Lines 52-58, 180-186)
   - Explicit CRITICAL PREREQUISITE checks
   - Clear error messages with guidance
   - Prevents wasted computation on missing inputs

2. **Hierarchical Structure** (Lines 7-388)
   - XML-style sections: `<role>`, `<inputs>`, `<outputs>`, `<process>`
   - Clear demarcation between instruction types
   - Logical flow: role → inputs → process → outputs

3. **Zone Organization**
   - Instructions at beginning (role, process)
   - Knowledge/data in middle (schemas, strategies)
   - Task guidance at end (quality tips, constraints)

4. **Priority Clarity**
   - REQUIRED fields explicitly marked throughout schemas
   - Mandatory vs optional distinctions clear
   - Critical sections highlighted with capitals

### ⚠️ Areas for Improvement

#### 1. Context Density Issues

**Location**: Lines 7-388 (entire main prompt)

**Problem**:
- 748-line monolithic prompt creates high cognitive load
- Single prompt handles multiple concerns: validation, chunking, enrichment, critic, schemas
- Dense nested instructions (e.g., chunking_strategy within constraints)
- Repeated information across sections

**Best Practice Reference**:
```
"Optimal Density: Balance between information and clarity...
Use of formatting for structure... Strategic redundancy for key facts"
- docs/context_engineering.md, Section: Context Density
```

**Impact**:
- Agent attention diluted across 3000+ tokens
- Longer processing time
- Higher token costs per invocation
- Potential "lost in the middle" phenomenon

#### 2. Information Architecture

**Location**: Lines 7-388 (flat structure with interleaved concerns)

**Problem**:
- Schema definitions embedded mid-prompt (lines 261-362)
- Process steps mixed with constraints (lines 51-129, then 230-259)
- Quality tips separated from relevant sections (lines 364-388)
- No clear priority hierarchy for token budget management

**Best Practice Reference**:
```
Hierarchical Structure:
Level 0: Meta-Context
Level 1: System Foundation
Level 2: Task Definition
Level 3: Knowledge Context
Level 4: State Context
Level 5: Auxiliary Context
- docs/context_engineering.md, Section: Information Architecture
```

**Impact**:
- Difficult to maintain (changes ripple through file)
- No mechanism for conditional loading
- All-or-nothing approach wastes tokens on every invocation

#### 3. Context Coherence

**Location**: Lines 230-259 (constraints section)

**Problem**: Redundant instructions cause semantic confusion

**Examples**:
- "Apply chunking strategy" appears 4+ times:
  - Line 64: Process step
  - Line 134: `<chunking_strategy>` section
  - Line 236: Constraints
  - Line 365: Quality tips

- "Enrichment mandatory" stated twice:
  - Lines 244-253: Detailed rules
  - Lines 74-78: Process step

- Teach→revision pairing mentioned 4 times:
  - Line 68: Process
  - Line 144: Chunking strategy
  - Line 240: Constraints
  - Line 367: Quality tips

**Best Practice Reference**:
```
"Semantic Coherence: Non-contradictory information,
Consistent terminology, Logical relationships"
- docs/context_engineering.md, Section: Context Coherence
```

**Impact**:
- Confusion about authoritative instruction
- Potential for inconsistent interpretations
- Wasted tokens on repetition

#### 4. Token Budget Management

**Problem**: No priority-based allocation strategy

**Current Behavior**:
- All sections loaded regardless of agent needs
- Schema (~400 lines) always included even if not needed for clarification
- Quality tips (~50 lines) always loaded even for experienced agent runs
- No compression strategy for budget constraints

**Best Practice Reference**:
```python
class PriorityContextAllocator:
    PRIORITY_LEVELS = {
        "critical": 1,    # Always include
        "high": 2,        # Include if budget allows
        "medium": 3,      # Nice-to-have
        "low": 4,         # Optional
    }
```

**Impact**:
- Inefficient token usage
- No optimization for repeated invocations
- Higher API costs

#### 5. Critic Prompt Structure

**Location**: Lines 390-747 (critic prompt)

**Similar Issues**:
- 358 lines with deeply nested validation logic
- 5 dimensions × ~70 lines each = high complexity
- Repeated field validation patterns across dimensions
- No clear separation of validation logic vs. scoring logic

**Specific Problems**:
- `<dimension_1_coverage>` (lines 468-538): 70 lines of criteria, process, issues
- `<dimension_2_sequencing>` (lines 540-586): 46 lines duplicating similar patterns
- Each dimension has redundant structure: Purpose → Criteria → Process → Issues

---

## Best Practices Violations

### Summary Table

| Best Practice | Current State | Target State | Priority |
|--------------|---------------|--------------|----------|
| **Context Prioritization** | ❌ Flat structure, all-or-nothing | ✅ 4-layer priority system | HIGH |
| **Information Architecture** | ⚠️ Some zones, interleaved concerns | ✅ Clear hierarchical zones | HIGH |
| **Context Coherence** | ❌ Redundant instructions (4× repetition) | ✅ DRY principles applied | HIGH |
| **Context Density** | ❌ 3000 tokens always loaded | ✅ 550 tokens (default), on-demand detail | HIGH |
| **Quality over Quantity** | ⚠️ All-or-nothing loading | ✅ Quality-focused with conditional detail | MEDIUM |
| **Dynamic Assembly** | ❌ Static monolithic prompt | ✅ Conditional loading based on needs | MEDIUM |
| **Token Budget Management** | ❌ No strategy | ✅ Priority-based allocation | MEDIUM |
| **Fail-Fast Validation** | ✅ Already implemented well | ✅ Maintain current approach | MAINTAIN |

---

## Refactoring Strategy

### Phase 1: Modularize with External Schemas

**Objective**: Extract large reference sections into external files

**Action**:
```
langgraph-author-agent/
├── schemas/
│   ├── sow_schema.md                 # 200 lines (extracted from lines 261-362)
│   ├── lesson_card_schema.md         # 150 lines (extracted from schema section)
│   └── research_pack_schema.md       # 100 lines (extracted from lines 22-37)
├── prompts/
│   ├── sow_author_core.md            # 300 lines (streamlined core)
│   └── critic_dimensions.md          # 150 lines (extracted validation patterns)
```

**Benefits**:
- Reduces main prompt from 748 → ~300 lines
- Schemas reusable across agents (lesson author, critic)
- Easier to maintain/version schemas independently
- Agent loads only needed schema sections dynamically

**Token Savings**: ~1500 tokens (schema moved to on-demand loading)

### Phase 2: Implement Layered Context Architecture

**Objective**: Reorganize into priority layers with clear allocation strategy

**Layer Structure**:

```markdown
## Layer 1: CRITICAL (Always Include) - ~150 tokens
Priority: REQUIRED
- Role definition (what agent does)
- Fail-fast validation rules (prerequisites)
- Output file requirements (what to write)
- Abort conditions

## Layer 2: CORE INSTRUCTIONS (Always Include) - ~300 tokens
Priority: REQUIRED
- Process workflow (9 steps)
- Chunking strategy summary
- Enrichment requirements
- Lesson plan requirements

## Layer 3: SCHEMA REFERENCE (Always Include) - ~100 tokens
Priority: REQUIRED
- Link to external schema with key field reminders
- Quick reference for common fields
- Instruction: "Request full schema if unclear"

## Layer 4: QUALITY GUIDELINES (Conditional) - ~200 tokens
Priority: HIGH (include by default, can omit if budget tight)
- Scottish context hooks
- Pedagogical patterns
- CFU strategy examples
- Card progression tips

## Layer 5: DETAILED EXAMPLES (On-Demand) - ~500 tokens
Priority: OPTIONAL (only if agent requests or struggles)
- Concrete chunking examples
- Sample lesson plan cards
- Misconception remediation patterns
```

**Token Allocation**:
- **Default mode**: Layers 1-4 = 750 tokens
- **Minimal mode**: Layers 1-3 = 550 tokens
- **Full mode**: Layers 1-5 = 1250 tokens

### Phase 3: Apply DRY Principles

**Objective**: Consolidate redundant instructions into single source of truth

**Consolidation Map**:

| Concept | Current Locations | Refactored Location | Token Savings |
|---------|------------------|---------------------|---------------|
| **Chunking Strategy** | Lines 64, 134, 236, 365 (4×) | Single `<chunking_requirements>` section | ~200 tokens |
| **Enrichment Requirements** | Lines 74, 244-253 (2×) | Single `<enrichment_requirements>` section | ~100 tokens |
| **Teach→Revision Pairing** | Lines 68, 144, 240, 367 (4×) | Incorporated in chunking requirements | ~150 tokens |
| **Scottish Authenticity** | Lines 12, 236, 365, 670-685 (4×) | Single quality guideline with examples | ~100 tokens |

**Total Savings**: ~550 tokens from redundancy elimination

**Implementation Example**:

**Before** (Repeated 4 times):
```markdown
Line 64: Apply chunking strategy: as described in <chunking_strategy>
Line 134: <chunking_strategy>
         ## Chunking Strategy: Cross-Outcome Consolidation
         ... (50 lines)
Line 236: Apply chunking strategy: group 2-3 related standards...
Line 365: Apply **chunking strategy**: Group 2-3 related assessment standards...
```

**After** (Single source of truth):
```markdown
<chunking_requirements>
## Chunking Requirements (Single Source of Truth)

**Consolidation Rules**:
- Group 2-3 related standards per lesson (max 5 if pedagogically justified)
- Must have clear thematic coherence (justify consolidation)

**Lesson Type Sequencing**:
- Mandatory: Every teach lesson → paired revision lesson (1:1)
- After teach→revision pair: formative_assessment → independent_practice

**Course-Level Requirements**:
- At least one independent_practice lesson (for mock exam prep)
- Exactly one mock_assessment lesson (simulates real SQA exam)

For detailed examples and edge cases, see: `patterns/chunking_examples.md`
</chunking_requirements>
```

### Phase 4: Progressive Context Disclosure

**Objective**: Implement conditional loading based on agent needs

**Dynamic Assembly Function**:

```python
def assemble_sow_prompt(
    mode: str = "default",
    include_full_schema: bool = False,
    include_examples: bool = False
) -> str:
    """
    Dynamically assemble SOW author prompt based on agent needs

    Args:
        mode: "minimal" | "default" | "full"
        include_full_schema: Load complete schema (not just reference)
        include_examples: Load concrete examples for guidance

    Returns:
        Assembled prompt with appropriate layers
    """
    layers = []

    # Layer 1: Critical (always)
    layers.append(load_layer_critical())

    # Layer 2: Core instructions (always)
    layers.append(load_layer_core())

    # Layer 3: Schema reference (always)
    layers.append(load_layer_schema_ref())

    # Layer 4: Quality guidelines (default and full modes)
    if mode in ["default", "full"]:
        layers.append(load_layer_quality())

    # Layer 5: Full schema (on-demand)
    if include_full_schema or mode == "full":
        layers.append(load_schema_full())

    # Layer 6: Examples (on-demand)
    if include_examples or mode == "full":
        layers.append(load_examples())

    return "\n\n".join(layers)
```

**Token Budget by Mode**:
- `minimal`: 550 tokens (Layers 1-3)
- `default`: 750 tokens (Layers 1-4)
- `full`: 1250 tokens (Layers 1-6)

### Phase 5: Enhance Critic Prompt

**Objective**: Apply same principles to unified critic

**Current Structure** (~70 lines per dimension):
```markdown
<dimension_1_coverage>
## Dimension 1: Coverage (Threshold ≥0.90)
**Purpose**: Evaluate breadth and depth...
**Criteria**: (15 bullet points)
**Process**: (9 steps)
**Issues to Flag**: (12 items)
</dimension_1_coverage>
```

**Refactored Structure** (~30 lines per dimension):
```markdown
<dimension_coverage>
## Coverage Dimension

**Threshold**: 0.90
**Validates**: Units, outcomes, standards, lesson plans, course requirements
**Process**: See `prompts/validation_process_coverage.md` for detailed steps
**Common Issues**: See `prompts/validation_issues_coverage.md` for patterns

**Quick Checklist**:
- [ ] All units from Course_data.txt covered
- [ ] All outcomes addressed
- [ ] All assessment standards represented
- [ ] Lesson plans have 6-12 cards
- [ ] Cards use enriched standards_addressed
- [ ] Teach→revision pairing maintained
- [ ] Course has ≥1 independent_practice, exactly 1 mock_assessment
</dimension_coverage>
```

**Token Savings**: 500 tokens per dimension × 5 dimensions = 2500 tokens

---

## Proposed Architecture

### File Structure

```
langgraph-author-agent/
├── src/
│   ├── sow_author_prompts.py         # Refactored core prompts
│   ├── prompts/
│   │   ├── layers/
│   │   │   ├── critical.md           # Layer 1: Critical requirements
│   │   │   ├── core.md               # Layer 2: Core instructions
│   │   │   ├── schema_ref.md         # Layer 3: Schema reference
│   │   │   └── quality.md            # Layer 4: Quality guidelines
│   │   ├── sow_author_extended.md    # Optional extended guidance
│   │   └── critic_dimensions.md      # Critic validation logic
│   ├── schemas/
│   │   ├── sow_schema.md             # Full SOW JSON schema
│   │   ├── lesson_card_schema.md     # Detailed card structure
│   │   └── research_pack_schema.md   # Research pack fields
│   └── patterns/
│       ├── chunking_examples.md      # Concrete consolidation examples
│       ├── cfu_strategies.md         # Check-for-understanding patterns
│       └── scottish_contexts.md      # Engagement hooks library
└── tasks/
    └── sow-prompt-refactoring-spec.md  # This document
```

### Core Prompt Structure (Refactored)

**File**: `src/sow_author_prompts.py`

```python
"""Refactored SOW Author Prompts with Layered Architecture"""

from pathlib import Path

# Base directory for prompt components
PROMPTS_DIR = Path(__file__).parent / "prompts"
SCHEMAS_DIR = Path(__file__).parent / "schemas"
PATTERNS_DIR = Path(__file__).parent / "patterns"

# ============================================================================
# Layer 1: Critical (Always Include) - ~150 tokens
# ============================================================================

SOW_LAYER_CRITICAL = """<role>
You are the **SoW Author DeepAgent**. Your job is to read the `research_pack_json`
and `Course_data.txt`, then **directly author** a publishable Scheme of Work (SoW)
for a single SQA course + level.

**DELIVERY CONTEXT**: Design for **one-to-one AI tutoring** (individual student + AI).
Avoid peer collaboration strategies (partner work, group discussions, peer marking).
</role>

<fail_fast_validation>
**CRITICAL PREREQUISITES** (check before proceeding):
1. `research_pack_json` must exist in files state
   - If missing: STOP with error "research_pack_json not found. Generate research pack first."
2. `Course_data.txt` must exist in files state
   - If missing: STOP with error "Course_data.txt not found. Pre-populate course data first."
</fail_fast_validation>

<required_outputs>
You MUST write these files:
- `authored_sow_json`: Complete SoW with metadata + entries[] (pedagogical focus)
- `sow_critic_result_json`: Validation result from unified_critic
- `sow_todos_json` (optional): Outstanding items if critic fails
</required_outputs>
"""

# ============================================================================
# Layer 2: Core Instructions (Always Include) - ~300 tokens
# ============================================================================

SOW_LAYER_CORE = """<process>
## Workflow (9 Steps)

1) **Validate inputs** (fail-fast - see <fail_fast_validation>)
2) **Read files**: `research_pack_json` + `Course_data.txt`
3) **Apply chunking**: 2-3 standards/lesson, teach→revision pairing
4) **Enrich standards**: Extract full descriptions from Course_data.txt
5) **Generate lesson_plan**: 6-12 cards with pedagogical detail
6) **Draft SOW JSON**: Write to `authored_sow_json`
7) **Call unified_critic**: Validate against Course_data.txt
8) **Revise if needed**: If critic fails, improve and re-run critic
9) **Write todos**: If still failing, document outstanding work in `sow_todos_json`
</process>

<chunking_requirements>
## Consolidation Rules (Single Source of Truth)

**Standard Grouping**:
- Group 2-3 related assessment standards per lesson
- Maximum 5 standards only if strongly justified by thematic coherence
- Label must clearly indicate all covered standards

**Lesson Type Sequencing**:
- **MANDATORY**: Every teach lesson → immediately followed by paired revision lesson (1:1)
- After teach→revision pair: formative_assessment → independent_practice

**Course-Level Requirements**:
- At least ONE independent_practice lesson (for mock exam preparation)
- Exactly ONE mock_assessment lesson (simulates real SQA exam conditions)

For examples: See `patterns/chunking_examples.md` (on request)
</chunking_requirements>

<enrichment_requirements>
## Transform Bare Codes → Enriched Objects

**Entry-Level AND Card-Level** (both required):
```json
// Bare code (DON'T USE)
"assessmentStandardRefs": ["AS1.2", "AS2.1"]

// Enriched object (CORRECT)
"assessmentStandardRefs": [
  {
    "code": "AS1.2",
    "description": "Full SQA description from Course_data.txt",
    "outcome": "O1"
  }
]
```

**Process**: Extract exact description from Course_data.txt assessment standards section.
</enrichment_requirements>

<lesson_plan_requirements>
## Generate Detailed Card Structure (6-12 cards per lesson)

**Each card MUST include**:
- card_number, card_type, title, purpose
- standards_addressed (enriched objects with code/description/outcome)
- pedagogical_approach (detailed, not generic)
- cfu_strategy (specific prompt, e.g., "MCQ: Which fraction equals 25%?" NOT "ask questions")
- estimated_minutes

**Requirements**:
- Card timings must sum to entry's estMinutes (allow ±5 min tolerance)
- ALL entry assessmentStandardRefs must appear in at least 2-3 cards (progressive scaffolding)
- Use enriched objects in standards_addressed (NOT bare codes)

For CFU examples: See `patterns/cfu_strategies.md` (on request)
</lesson_plan_requirements>
"""

# ============================================================================
# Layer 3: Schema Reference (Always Include) - ~100 tokens
# ============================================================================

SOW_LAYER_SCHEMA_REF = """<schema_reference>
## Schema Quick Reference

**Full schema**: See `schemas/sow_schema.md` for complete structure

**Key Fields**:
- **metadata**: Required: coherence, accessibility_notes, engagement_notes
- **entries[]**: Required: order, label, lesson_type, assessmentStandardRefs (enriched), lesson_plan
- **lesson_plan.card_structure**: 6-12 cards with all required fields

**Enriched Format Example**:
```json
{
  "code": "AS1.2",
  "description": "Perform calculations involving fractions (exact text from Course_data.txt)",
  "outcome": "O1"
}
```

**When to Request Full Schema**:
- If structure unclear: Request "provide full schema details"
- If field validation needed: Request "show complete schema with field descriptions"
</schema_reference>
"""

# ============================================================================
# Layer 4: Quality Guidelines (Default Include) - ~200 tokens
# ============================================================================

SOW_LAYER_QUALITY = """<quality_tips>
## Design Best Practices

**AI Tutor Delivery**:
- One-to-one tutoring context (individual student + AI)
- NO peer collaboration: partner work, group discussions, peer marking
- Focus on: direct instruction, immediate feedback, individual CFU

**Scottish Authenticity**:
- Currency: £ (not $ or €)
- Contexts: NHS, local councils, Scottish shops, bus fares, supermarket flyers
- Terminology: Use CfE/SQA-specific language

**CFU Strategies** (specific, not generic):
- ✅ Good: "MCQ: Which fraction equals 25%? A) 1/2  B) 1/4  C) 1/3  D) 1/5"
- ❌ Bad: "Ask questions to check understanding"
- ✅ Good: "Structured question: Calculate 3/4 of £20 showing working"
- ❌ Bad: "Check if students understand fractions"

**Card Type Progression**:
- starter → explainer → modelling → guided_practice → independent_practice → exit_ticket

**Misconceptions**:
- Embed in specific cards with remediation strategies
- Don't just list generically - show where/how addressed in cards

**Calculator Staging**:
- Early lessons: non_calc (build fluency)
- Middle lessons: mixed (strategic choice)
- Later lessons: calc (efficiency focus)

For context library: See `patterns/scottish_contexts.md` (on request)
</quality_tips>
"""

# ============================================================================
# Dynamic Assembly
# ============================================================================

def assemble_sow_prompt(
    mode: str = "default",
    include_full_schema: bool = False,
    include_examples: bool = False
) -> str:
    """
    Dynamically assemble SOW author prompt based on needs.

    Args:
        mode: "minimal" | "default" | "full"
            - minimal: Layers 1-3 (~550 tokens)
            - default: Layers 1-4 (~750 tokens)
            - full: All layers + schema + examples (~1250 tokens)
        include_full_schema: Load complete schema (not just reference)
        include_examples: Load concrete examples for guidance

    Returns:
        Assembled prompt string
    """
    layers = [
        SOW_LAYER_CRITICAL,
        SOW_LAYER_CORE,
        SOW_LAYER_SCHEMA_REF
    ]

    # Layer 4: Quality tips (default and full modes)
    if mode in ["default", "full"]:
        layers.append(SOW_LAYER_QUALITY)

    # Layer 5: Full schema (on-demand)
    if include_full_schema or mode == "full":
        schema_path = SCHEMAS_DIR / "sow_schema.md"
        if schema_path.exists():
            layers.append(f"<schema_full>\n{schema_path.read_text()}\n</schema_full>")

    # Layer 6: Examples (on-demand)
    if include_examples or mode == "full":
        examples_sections = []

        chunking_examples = PATTERNS_DIR / "chunking_examples.md"
        if chunking_examples.exists():
            examples_sections.append(chunking_examples.read_text())

        cfu_examples = PATTERNS_DIR / "cfu_strategies.md"
        if cfu_examples.exists():
            examples_sections.append(cfu_examples.read_text())

        if examples_sections:
            layers.append(f"<examples>\n{'\\n\\n'.join(examples_sections)}\n</examples>")

    return "\n\n".join(layers)

# ============================================================================
# Exported Prompts
# ============================================================================

# Default mode: Layers 1-4 (~750 tokens)
SOW_UNIFIED_AGENT_PROMPT = assemble_sow_prompt(mode="default")

# Minimal mode: Layers 1-3 (~550 tokens) - for experienced agent runs
SOW_UNIFIED_AGENT_PROMPT_MINIMAL = assemble_sow_prompt(mode="minimal")

# Full mode: All layers + schema + examples (~1250 tokens) - for initial runs or debugging
SOW_UNIFIED_AGENT_PROMPT_FULL = assemble_sow_prompt(
    mode="full",
    include_full_schema=True,
    include_examples=True
)
```

---

## Implementation Plan

### Phase 1: Extract Schemas (Week 1)

**Objective**: No behavior change, just reorganization

**Tasks**:
1. Create directory structure:
   ```bash
   mkdir -p src/schemas src/prompts/layers src/patterns
   ```

2. Extract SOW schema (lines 261-362 → `schemas/sow_schema.md`):
   ```markdown
   # SOW Schema Documentation

   ## Complete Schema Structure

   [Move lines 261-362 here with formatting improvements]
   ```

3. Extract lesson card schema (from schema section → `schemas/lesson_card_schema.md`):
   ```markdown
   # Lesson Card Structure Schema

   ## Card Fields Reference

   [Extract card_structure section with examples]
   ```

4. Extract research pack schema (lines 22-37 → `schemas/research_pack_schema.md`)

5. Update main prompt to reference schemas:
   ```markdown
   <schema_reference>
   Full schema: See `schemas/sow_schema.md`

   Key reminders:
   - metadata: coherence, accessibility_notes, engagement_notes
   - entries[]: order, label, lesson_type, assessmentStandardRefs (enriched)
   </schema_reference>
   ```

6. **Test**: Run agent with new structure, verify same output

**Deliverables**:
- 3 new schema files
- Updated prompt with schema references
- Test results showing no regression

**Estimated Effort**: 4 hours

### Phase 2: Refactor Core Prompt (Week 1-2)

**Objective**: Streamline main prompt, eliminate redundancy

**Tasks**:
1. Create layer files:
   - `prompts/layers/critical.md` (Layer 1)
   - `prompts/layers/core.md` (Layer 2)
   - `prompts/layers/schema_ref.md` (Layer 3)
   - `prompts/layers/quality.md` (Layer 4)

2. Consolidate chunking instructions:
   - Identify all mentions (lines 64, 134, 236, 365)
   - Create single `<chunking_requirements>` section
   - Remove redundant references

3. Consolidate enrichment requirements:
   - Merge lines 74 and 244-253
   - Create single `<enrichment_requirements>` section

4. Consolidate lesson plan requirements:
   - Extract from schema and process sections
   - Create single `<lesson_plan_requirements>` section

5. Update main prompt file to load layers:
   ```python
   SOW_LAYER_CRITICAL = Path("prompts/layers/critical.md").read_text()
   # etc.
   ```

6. **Test**: Compare outputs, measure token reduction

**Deliverables**:
- 4 layer files
- Refactored `sow_author_prompts.py`
- Token usage comparison report
- Output quality validation

**Estimated Effort**: 6 hours

### Phase 3: Implement Dynamic Loading (Week 2)

**Objective**: Enable conditional loading based on context budget

**Tasks**:
1. Create `assemble_sow_prompt()` function (see pseudo-code above)

2. Add mode parameter to agent invocation:
   ```python
   # In agent code
   mode = "minimal" if retry_count > 0 else "default"
   prompt = assemble_sow_prompt(mode=mode)
   ```

3. Implement schema on-demand loading:
   ```python
   if include_full_schema:
       schema_content = load_schema("sow_schema.md")
       layers.append(f"<schema_full>\n{schema_content}\n</schema_full>")
   ```

4. Create pattern library files:
   - `patterns/chunking_examples.md`
   - `patterns/cfu_strategies.md`
   - `patterns/scottish_contexts.md`

5. **Test**: A/B test default vs minimal modes

**Deliverables**:
- Dynamic assembly function
- 3 pattern library files
- A/B test results
- Token usage metrics by mode

**Estimated Effort**: 4 hours

### Phase 4: Refactor Critic Prompt (Week 3)

**Objective**: Apply same patterns to unified critic

**Tasks**:
1. Extract validation patterns:
   - Create `prompts/critic_dimensions.md`
   - Consolidate common validation logic

2. Create dimension template:
   ```markdown
   <dimension_coverage>
   - Threshold: 0.90
   - Validates: [checklist]
   - Process: See validation_process_coverage.md
   - Common Issues: See validation_issues_coverage.md
   </dimension_coverage>
   ```

3. Extract detailed validation processes:
   - `prompts/validation_process_coverage.md`
   - `prompts/validation_process_sequencing.md`
   - etc. (one per dimension)

4. Create scoring matrix:
   ```markdown
   | Criterion | Weight | Pass Condition |
   |-----------|--------|----------------|
   | All units covered | 0.3 | 100% match |
   | Enriched format used | 0.2 | All entries |
   | Lesson plans detailed | 0.3 | 6-12 cards |
   | Course requirements met | 0.2 | Checklist pass |
   ```

5. **Test**: Validate critic scoring unchanged

**Deliverables**:
- Refactored critic prompt
- 5 validation process files
- Scoring matrix
- Regression tests

**Estimated Effort**: 6 hours

### Phase 5: Documentation and Training (Week 3)

**Objective**: Document new architecture, train team

**Tasks**:
1. Update README with new structure:
   ```markdown
   # SOW Author Prompts Architecture

   ## Layered Context System
   - Layer 1: Critical (always loaded)
   - Layer 2: Core (always loaded)
   - Layer 3: Schema reference (always loaded)
   - Layer 4: Quality tips (default loaded)
   - Layer 5: Full schema (on-demand)
   - Layer 6: Examples (on-demand)

   ## Usage
   ```python
   # Default mode (recommended)
   prompt = assemble_sow_prompt()

   # Minimal mode (for retries/experienced runs)
   prompt = assemble_sow_prompt(mode="minimal")

   # Full mode (for debugging/initial runs)
   prompt = assemble_sow_prompt(mode="full", include_examples=True)
   ```
   ```

2. Create migration guide for future prompt updates

3. Document token usage by mode

4. Create decision tree for mode selection

**Deliverables**:
- Updated README
- Migration guide
- Token usage documentation
- Mode selection guide

**Estimated Effort**: 2 hours

---

## Testing Strategy

### Unit Tests

**Test Schema Extraction**:
```python
def test_schema_load():
    """Verify schemas load correctly from files"""
    schema = load_schema("sow_schema.md")
    assert "metadata" in schema
    assert "entries" in schema
    assert "assessmentStandardRefs" in schema

def test_layer_assembly():
    """Verify layers assemble correctly"""
    minimal = assemble_sow_prompt(mode="minimal")
    default = assemble_sow_prompt(mode="default")
    full = assemble_sow_prompt(mode="full")

    assert len(minimal) < len(default) < len(full)
    assert count_tokens(minimal) < 600
    assert count_tokens(default) < 800
```

### Integration Tests

**Test Prompt Functionality**:
```python
def test_agent_output_quality():
    """Verify refactored prompt produces same quality output"""
    # Run with old prompt
    old_output = run_agent_with_prompt(OLD_PROMPT, test_inputs)

    # Run with new prompt
    new_output = run_agent_with_prompt(NEW_PROMPT, test_inputs)

    # Compare outputs
    assert_sow_quality_equivalent(old_output, new_output)

def test_token_efficiency():
    """Verify token usage improvement"""
    old_tokens = count_tokens(OLD_PROMPT)
    new_tokens = count_tokens(assemble_sow_prompt(mode="default"))

    improvement = (old_tokens - new_tokens) / old_tokens
    assert improvement > 0.70  # At least 70% reduction
```

### A/B Testing

**Compare Modes**:
```python
def test_minimal_vs_default():
    """A/B test minimal vs default mode"""
    test_cases = load_test_cases()

    minimal_results = []
    default_results = []

    for test_case in test_cases:
        # Minimal mode
        minimal_prompt = assemble_sow_prompt(mode="minimal")
        minimal_output = run_agent(minimal_prompt, test_case)
        minimal_results.append(evaluate_output(minimal_output))

        # Default mode
        default_prompt = assemble_sow_prompt(mode="default")
        default_output = run_agent(default_prompt, test_case)
        default_results.append(evaluate_output(default_output))

    # Statistical comparison
    assert mean(default_results) >= mean(minimal_results)
    assert mean(default_results) > 0.85  # Quality threshold
```

### Regression Testing

**Golden Output Comparison**:
```python
def test_no_regression():
    """Verify outputs match golden examples"""
    golden_examples = load_golden_outputs()

    for example in golden_examples:
        new_output = run_agent_with_prompt(
            assemble_sow_prompt(),
            example.inputs
        )

        # Check key fields match
        assert_entries_count_matches(new_output, example.expected)
        assert_enriched_format_used(new_output)
        assert_lesson_plans_detailed(new_output)
        assert_chunking_applied(new_output)
```

---

## Success Metrics

### Primary Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Token Usage (Default)** | 3000 tokens | ≤750 tokens | Token counter |
| **Token Usage (Minimal)** | 3000 tokens | ≤550 tokens | Token counter |
| **Prompt Lines** | 748 lines | ≤300 lines | Line count |
| **Token Cost per Run** | $X | ≤25% of $X | API cost tracking |

### Quality Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Output Quality Score** | Y | ≥Y | Critic pass rate |
| **Enriched Format Usage** | Z% | ≥Z% | Schema validation |
| **Chunking Compliance** | W% | ≥W% | Pattern detection |
| **Lesson Plan Depth** | V cards avg | ≥V cards avg | Card count analysis |

### Maintainability Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Schema Update Time** | 30 min | ≤10 min | Time tracking |
| **Prompt Comprehension** | Subjective | Improved | Team survey |
| **Redundancy Index** | High (4× repetition) | Low (1× authoritative) | Code analysis |

---

## Migration Path

### Stage 1: Parallel Run (Week 1)

**Objective**: Validate no regression

**Actions**:
1. Deploy refactored prompts alongside old prompts
2. Run both in parallel for 1 week
3. Compare outputs for quality/consistency
4. Log token usage metrics

**Success Criteria**:
- 95%+ output equivalence
- Token usage reduced by 70%+
- No increase in critic failure rate

**Rollback Plan**:
- If quality degrades >5%: Revert to old prompts
- If token usage not improved >50%: Review layer design
- If agent confusion detected: Add clarifying instructions

### Stage 2: Gradual Rollout (Week 2)

**Objective**: Phase in new prompts by use case

**Actions**:
1. Week 2 Day 1-2: Use for new courses only
2. Week 2 Day 3-4: Use for 50% of all runs (random sampling)
3. Week 2 Day 5: Use for 100% of runs

**Monitoring**:
- Track failure rates by mode (minimal vs default vs full)
- Monitor token usage patterns
- Log agent requests for full schema/examples

**Success Criteria**:
- Failure rate ≤ baseline
- Token usage consistently reduced
- Positive team feedback

### Stage 3: Optimization (Week 3)

**Objective**: Fine-tune based on usage patterns

**Actions**:
1. Analyze which layers/sections most accessed
2. Refine default mode based on actual needs
3. Add caching for frequently used schemas
4. Update documentation based on team feedback

**Success Criteria**:
- Default mode optimized for 90% of use cases
- Minimal mode suitable for retry scenarios
- Full mode only needed for debugging/new domains

---

## Risk Assessment

### High-Impact Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Output quality degradation** | Low | High | Parallel run validation, A/B testing, golden output comparison |
| **Agent confusion from layered structure** | Medium | Medium | Clear schema references, on-demand full schema loading |
| **Token savings not realized** | Low | Medium | Token usage monitoring, layer size optimization |

### Medium-Impact Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Increased maintenance complexity** | Low | Medium | Clear documentation, separation of concerns |
| **Schema versioning issues** | Medium | Low | Version tracking in schema files, changelog |
| **Team adoption challenges** | Medium | Low | Training sessions, migration guide, examples |

### Mitigation Strategies

**For Output Quality**:
- Run comprehensive regression tests
- Maintain golden output test suite
- Implement gradual rollout with monitoring
- Keep old prompts as fallback for 1 month

**For Agent Confusion**:
- Provide clear instructions for requesting full schema
- Add clarifying examples in quality layer
- Monitor agent logs for confusion indicators
- Iterate based on failure patterns

**For Token Optimization**:
- Benchmark token usage continuously
- Profile layer combinations for different scenarios
- Optimize layer content based on usage patterns
- Implement caching for static sections

---

## Appendix

### A. Token Counting Reference

**Estimation Formula**:
```
tokens ≈ words × 1.3
tokens ≈ lines × 4 (for typical prompt density)
```

**Layer Token Estimates**:
```
Layer 1 (Critical):     150 tokens (~120 words)
Layer 2 (Core):         300 tokens (~230 words)
Layer 3 (Schema Ref):   100 tokens (~80 words)
Layer 4 (Quality):      200 tokens (~150 words)
Layer 5 (Full Schema):  400 tokens (on-demand)
Layer 6 (Examples):     500 tokens (on-demand)
```

### B. Context Engineering Best Practices Checklist

**From `/docs/context_engineering.md`**:

- [ ] Context prioritization with clear allocation strategy
- [ ] Hierarchical information architecture (6 levels)
- [ ] Zone organization (Instruction → Knowledge → History → Task)
- [ ] Context coherence (non-contradictory, consistent terminology)
- [ ] Optimal density (balanced information vs clarity)
- [ ] Dynamic assembly with conditional loading
- [ ] Token budget management with compression strategies
- [ ] Quality-focused selection over quantity
- [ ] Fail-fast validation for prerequisites
- [ ] Clear separation of concerns (modularization)

### C. Related Documentation

- **Context Engineering Best Practices**: `/docs/context_engineering.md`
- **Current SOW Author Prompts**: `langgraph-author-agent/src/sow_author_prompts.py`
- **SOW Schema**: (To be created) `langgraph-author-agent/src/schemas/sow_schema.md`
- **Chunking Examples**: (To be created) `langgraph-author-agent/src/patterns/chunking_examples.md`

### D. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-15 | Initial specification | Context Engineering Review |

---

## Approval

**Status**: Proposed
**Next Steps**: Review with team, approve implementation plan
**Estimated Start**: TBD
**Estimated Completion**: 3 weeks after approval
