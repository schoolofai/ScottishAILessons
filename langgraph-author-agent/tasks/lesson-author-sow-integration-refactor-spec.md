# Lesson Author SOW Integration Refactoring Specification
## Fully Generative Approach with Rich Pedagogical Context

**Version**: 1.0
**Date**: 2025-10-16
**Status**: Proposed
**Reference**: Example SOW at `assistant-ui-frontend/output/sow_course_c84474_391eef16-0498-47aa-bc2d-aa7ac75a5888.json`

---

## Executive Summary

This specification outlines a **fully generative, prompt-driven refactoring** of the Lesson Author Agent to leverage the new rich SOW schema. The SOW entries now contain detailed pedagogical content including `lesson_plan.card_structure` with 5+ cards per lesson, worked examples, practice problems, and misconceptions. This refactoring enhances the agent's prompts to understand and transform this rich content into executable lesson templates **without introducing utility functions** — purely through LLM reasoning with comprehensive guidance.

**Key Metrics**:
- Approach: Fully generative (prompt-driven transformation)
- Files modified: `lesson_author_prompts.py` (prompt updates only)
- New files: `test_lesson_author_sow_integration.py` (E2E tests)
- Estimated effort: 4-6 hours
- Risk level: Low (prompt enhancements only, no architectural changes)

**Core Philosophy**: The Lesson Author Agent receives rich pedagogical design from SOW entries and uses LLM reasoning to transform them into executable lesson templates. The agent understands pedagogical patterns through **detailed prompt guidance and examples**, not programmatic functions.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Schema Gap Analysis](#schema-gap-analysis)
3. [Refactoring Strategy](#refactoring-strategy)
4. [Phase 1: Update Input Schema & Prompt Context](#phase-1-update-input-schema--prompt-context)
5. [Phase 2: Update Critic Validation](#phase-2-update-critic-validation)
6. [Phase 3: E2E Testing](#phase-3-e2e-testing)
7. [Testing Strategy](#testing-strategy)
8. [Success Metrics](#success-metrics)
9. [Implementation Timeline](#implementation-timeline)
10. [Appendix](#appendix)

---

## Current State Analysis

### File: `langgraph-author-agent/src/lesson_author_prompts.py`

**Current SOW Schema Expected** (Lines 11-40 of `LESSON_AGENT_PROMPT`):

```markdown
<inputs>
- **Available Input Files**: Use file system tools to read the following files:

  **REQUIRED**:
  - `sow_entry_input.json`: Lesson requirements with schema:
    ```json
    {
      "order": <integer>,
      "label": "<lesson title>",
      "lesson_type": "<teach|independent_practice|formative_assessment|revision|mock_exam>",
      "outcomeRefs": ["O1"],
      "assessmentStandardRefs": ["AS1.1", "AS2.2"],  // BARE STRINGS
      "pedagogical_blocks": ["<starter>", "<guided_practice>"],  // UNUSED
      "notes": "<authoring guidance>"  // GENERIC
    }
    ```
```

**Current Expectations**:
- ❌ Bare assessment standard strings (e.g., `["AS1.1", "AS2.2"]`)
- ❌ Generic `notes` field with minimal guidance
- ❌ Unused `pedagogical_blocks` (agent builds cards from scratch)
- ❌ No worked examples or practice problems provided
- ❌ No misconception guidance

**Current Agent Behavior**:
1. Reads minimal SOW entry
2. Builds lesson template cards **from scratch** using research pack and Course_data.txt
3. Creates own worked examples, practice problems, misconceptions
4. Infers pedagogical flow from lesson_type

### File: `assistant-ui-frontend/output/sow_course_c84474_391eef16-0498-47aa-bc2d-aa7ac75a5888.json`

**New SOW Schema Reality** (Example entry):

```json
{
  "order": 1,
  "label": "Introduction to Numeracy: Fractions, Percentages, and Decimals (Non-Calc)",
  "lesson_type": "teach",
  "assessmentStandardRefs": [
    {
      "code": "AS1.2",
      "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
      "outcome": "O1"
    }
  ],
  "lesson_plan": {
    "summary": "This lesson introduces foundational non-calculator numeracy skills...",
    "card_structure": [
      {
        "card_number": 1,
        "card_type": "starter",
        "title": "What's the Deal?",
        "purpose": "To activate prior knowledge of fractions and percentages...",
        "pedagogical_approach": "Present a simple shopping scenario...",
        "cfu_strategy": "Open question: 'When have you used fractions or percentages this week?'",
        "estimated_minutes": 5
      },
      {
        "card_number": 2,
        "card_type": "explainer",
        "title": "Fractions, Percentages, and Decimals: The Basics",
        "standards_addressed": [
          {
            "code": "AS1.2",
            "description": "Using appropriate mathematical processes...",
            "outcome": "O1"
          }
        ],
        "key_concepts": ["Fraction", "Percentage", "Decimal", "Equivalence", "Conversion"],
        "cfu_strategy": "MCQ: 'Which of these is equivalent to 3/4?...'",
        "estimated_minutes": 10
      },
      {
        "card_number": 3,
        "card_type": "modelling",
        "title": "Calculating a Percentage of an Amount",
        "worked_example": "Find 30% of £60. Step 1: Find 10% by doing £60 / 10 = £6. Step 2: Multiply by 3 to get 30%: £6 × 3 = £18. Answer: £18",
        "cfu_strategy": "Structured question: 'Show me the steps to find 20% of £80.'",
        "estimated_minutes": 10
      },
      {
        "card_number": 4,
        "card_type": "guided_practice",
        "title": "Supermarket Savings",
        "practice_problems": [
          "A box of shortbread costs £4. It has 25% off. What is the new price?",
          "A bottle of juice is £2. It has a 10% discount. How much do you save?"
        ],
        "misconceptions_addressed": [
          {
            "misconception": "Calculating the discount but forgetting to subtract it from the original price",
            "remediation": "The AI tutor will prompt: 'Great, you've found the discount is £1. Now, what do you do with that £1 to find the new price?'"
          }
        ],
        "estimated_minutes": 15
      }
    ],
    "lesson_flow_summary": "5min starter → 10min explainer → 10min modelling → 15min guided practice → 5min exit ticket (45 min total)",
    "multi_standard_integration_strategy": "This lesson focuses solely on AS1.2 to build a strong foundation...",
    "misconceptions_embedded_in_cards": [
      "Card 4 addresses the common error of finding the discount amount but not the final price."
    ]
  }
}
```

**New SOW Provides**:
- ✅ Enriched assessment standards (code + description + outcome)
- ✅ Detailed `lesson_plan.card_structure` (5+ cards with full pedagogical design)
- ✅ Worked examples with step-by-step breakdowns
- ✅ Practice problems with Scottish cultural context
- ✅ Misconceptions with AI tutor remediation strategies
- ✅ CFU strategies (specific, not generic)
- ✅ Key concepts lists
- ✅ Pedagogical approach descriptions
- ✅ Lesson flow summary
- ✅ Multi-standard integration strategies

---

## Schema Gap Analysis

### Old SOW → New SOW Comparison

| Field | Old SOW | New SOW | Impact |
|-------|---------|---------|--------|
| **assessmentStandardRefs** | Bare strings: `["AS1.2"]` | Enriched objects: `[{code, description, outcome}]` | Agent can use full descriptions in rubrics |
| **pedagogical_blocks** | Generic hints: `["starter", "guided_practice"]` | Detailed card_structure with 5+ cards | Pre-designed pedagogical flow available |
| **notes** | Generic text: "Focus on fractions" | Rich lesson_plan with summary, flow, strategies | Comprehensive authoring guidance |
| **worked_example** | Not provided | "Find 30% of £60. Step 1: Find 10%..." | Ready-to-use explainer content |
| **practice_problems** | Not provided | Array of contextualized exercises | Transform into CFU question_text |
| **misconceptions_addressed** | Not provided | Array with misconception + remediation | Transform into hint arrays |
| **cfu_strategy** | Not provided | Specific prompts: "MCQ: Which fraction equals 3/4?" | Clear CFU type and question guidance |
| **key_concepts** | Not provided | Array: ["Fraction", "Percentage", "Decimal"] | Concept coverage validation |
| **pedagogical_approach** | Not provided | "Present a simple shopping scenario..." | Explainer writing guidance |

### Transformation Opportunities

**1. Worked Examples → Explainer Content**
- SOW provides: Step-by-step demonstrations
- Lesson template needs: `explainer` and `explainer_plain` fields
- Transformation: Extract steps, format for conversational explanation

**2. Practice Problems → CFU Question Text**
- SOW provides: Contextualized exercises with Scottish settings
- Lesson template needs: `cfu.question_text` and `cfu.question_text_plain`
- Transformation: Use as-is or adapt for CFU type

**3. Misconceptions → Hints**
- SOW provides: Common errors + AI tutor remediation
- Lesson template needs: `cfu.hints` array
- Transformation: Convert remediation text into hint strings

**4. Card Type → Template Card Type**
- SOW provides: `starter`, `explainer`, `modelling`, `guided_practice`, `independent_practice`, `exit_ticket`
- Lesson template needs: `explainer` or `cfu` card types with specific patterns
- Transformation: Map SOW card types to template formats

**5. Enriched Standards → Rubric Criteria**
- SOW provides: Full standard descriptions
- Lesson template needs: Rubric dimension descriptions
- Transformation: Reference descriptions in rubric criteria

---

## Refactoring Strategy

### Overview

This refactoring follows a **3-phase prompt enhancement approach**:

1. **Phase 1**: Update `lesson_author_prompts.py` to document new SOW schema and provide transformation guidance
2. **Phase 2**: Enhance critic validation to check SOW-Template alignment
3. **Phase 3**: Create E2E tests to validate transformation correctness

**No architectural changes, no utility functions** — purely prompt-driven generative transformation.

### Design Principles

1. **Generative Transformation**: Agent uses LLM reasoning to transform SOW content into lesson template format
2. **Rich Context**: Provide detailed examples showing before/after transformations
3. **Clear Mapping**: Explain how each SOW field maps to lesson template fields
4. **Pedagogical Guidance**: Teach the agent pedagogical design patterns through documentation
5. **Accessibility Focus**: Include plain language generation guidelines
6. **Scottish Context**: Preserve cultural references and engagement tags

---

## Phase 1: Update Input Schema & Prompt Context

### Objective

Enhance `LESSON_AGENT_PROMPT` to document the new rich SOW schema and provide comprehensive guidance on how to transform SOW content into lesson templates.

### 1.1 Document New SOW Schema

**Location**: `lesson_author_prompts.py` → `LESSON_AGENT_PROMPT` → `<inputs>` section

**Change**: Update schema documentation to reflect new rich structure

**Before**:
```markdown
<inputs>
- `sow_entry_input.json`: Lesson requirements with schema:
  ```json
  {
    "order": 1,
    "label": "Introduction to Fractions",
    "lesson_type": "teach",
    "assessmentStandardRefs": ["AS1.2"],  // BARE STRINGS
    "notes": "Focus on fractions"  // GENERIC
  }
  ```
</inputs>
```

**After**:
```markdown
<inputs>
- `sow_entry_input.json`: Rich pedagogical design with schema:
  ```json
  {
    "order": 1,
    "label": "Introduction to Numeracy: Fractions, Percentages, and Decimals",
    "lesson_type": "teach",
    "assessmentStandardRefs": [
      {
        "code": "AS1.2",
        "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
        "outcome": "O1"
      }
    ],
    "lesson_plan": {
      "summary": "This lesson introduces foundational non-calculator numeracy skills...",
      "card_structure": [
        {
          "card_number": 1,
          "card_type": "starter",
          "title": "What's the Deal?",
          "purpose": "To activate prior knowledge of fractions...",
          "pedagogical_approach": "Present a simple shopping scenario...",
          "cfu_strategy": "Open question: 'When have you used fractions this week?'",
          "estimated_minutes": 5
        },
        {
          "card_number": 2,
          "card_type": "explainer",
          "standards_addressed": [...],
          "key_concepts": ["Fraction", "Percentage", "Decimal"],
          "cfu_strategy": "MCQ: 'Which of these is equivalent to 3/4?...'",
          "estimated_minutes": 10
        },
        {
          "card_number": 3,
          "card_type": "modelling",
          "worked_example": "Find 30% of £60. Step 1: Find 10% by doing £60 / 10 = £6. Step 2: Multiply by 3 to get 30%: £6 × 3 = £18. Answer: £18",
          "cfu_strategy": "Structured question: 'Show me the steps to find 20% of £80.'",
          "estimated_minutes": 10
        },
        {
          "card_number": 4,
          "card_type": "guided_practice",
          "practice_problems": ["A box of shortbread costs £4. It has 25% off..."],
          "misconceptions_addressed": [
            {
              "misconception": "Calculating the discount but forgetting to subtract...",
              "remediation": "The AI tutor will prompt: 'Great, you've found...'"
            }
          ],
          "estimated_minutes": 15
        }
      ],
      "lesson_flow_summary": "5min starter → 10min explainer → 10min modelling → 15min guided practice...",
      "multi_standard_integration_strategy": "This lesson focuses solely on AS1.2...",
      "misconceptions_embedded_in_cards": [...]
    }
  }
  ```
</inputs>
```

### 1.2 Add SOW Field Usage Guidance

**Location**: After `<inputs>` section

**Addition**: New `<sow_field_usage>` section explaining how to use each field

```xml
<sow_field_usage>
## How to Use SOW Fields in Lesson Template Generation

**assessmentStandardRefs**: Enriched objects with code + description + outcome
- Use `description` to understand the standard's intent
- Reference in card rubrics and success criteria
- Map to lesson template `assessmentStandardRefs` array (preserve structure)

**lesson_plan.card_structure**: Pre-designed pedagogical flow
- Each SOW card represents a **pedagogical moment** in the lesson
- Transform SOW cards → lesson template cards (see transformation guide below)
- Preserve the pedagogical intent while adapting to template schema

**worked_example**: Detailed step-by-step demonstrations
- Use as explainer content for modelling cards
- Extract steps for scaffolding sequences
- Reference in CFU rubrics as exemplar

**practice_problems**: Contextualized exercises
- Transform into CFU question_text
- Use for guided_practice and independent_practice cards
- Preserve Scottish cultural context (£, local services)

**misconceptions_addressed**: Common errors + AI tutor remediation
- Transform into CFU hints array
- Use remediation text as hint content
- Link to rubric indicators for formative feedback

**cfu_strategy**: Specific CFU prompts
- Use to determine CFU type (MCQ, numeric, structured_response, short)
- Extract question wording for CFU question_text
- Adapt language for explainer_plain and question_text_plain

**key_concepts**: Topic vocabulary
- Use in explainer content to ensure coverage
- Reference in rubric criteria
- Include in context_hooks for real-world connections

**pedagogical_approach**: Instructional strategy description
- Use to guide explainer tone and style
- Inform scaffolding decisions
- Connect to engagement_tags

**lesson_flow_summary**: Overall progression
- Validate card count and timing against this summary
- Ensure template preserves intended flow
- Use for pacing guidance

**multi_standard_integration_strategy**: Cross-standard approach
- Use when multiple standards in assessmentStandardRefs
- Guide rubric criteria that span standards
- Inform CFU design for integration checks
</sow_field_usage>
```

### 1.3 Add Card Type Transformation Guide

**Location**: After `<sow_field_usage>` section

**Addition**: New `<card_type_transformations>` section with mapping rules

```xml
<card_type_transformations>
## SOW Card Type → Lesson Template Card Type Mapping

**1. starter (SOW) → explainer (Template)**

**Purpose**: Activate prior knowledge, engage curiosity

**Template Format**:
- `card_type`: "explainer"
- `explainer`: Conversational prompt matching starter's purpose
- `explainer_plain`: A2-level accessible version
- **No CFU** (starters are low-stakes engagement)

**Example**:
SOW Card:
```json
{
  "card_type": "starter",
  "title": "What's the Deal?",
  "purpose": "Activate prior knowledge of fractions and percentages",
  "pedagogical_approach": "Present a simple shopping scenario",
  "cfu_strategy": "Open question: 'When have you used fractions or percentages this week?'"
}
```

Template Card:
```json
{
  "card_id": "card_001",
  "card_type": "explainer",
  "explainer": "Let's think about fractions and percentages! When have you seen them in shops? Maybe you've noticed '25% off' signs or recipes asking for '1/2 cup' of something. Today we'll learn how these numbers work together.",
  "explainer_plain": "Think about fractions and percentages. You see them in shops. Like '25% off' or '1/2 cup'. We will learn how they work."
}
```

---

**2. explainer (SOW) → explainer (Template)**

**Purpose**: Introduce key concepts

**Template Format**:
- `card_type`: "explainer"
- `explainer`: Use key_concepts and pedagogical_approach
- Include lightweight CFU based on cfu_strategy (MCQ or open question)
- Reference standards_addressed in rubric if CFU present

**Example**:
SOW Card:
```json
{
  "card_type": "explainer",
  "title": "Fractions, Percentages, and Decimals: The Basics",
  "standards_addressed": [{"code": "AS1.2", "description": "...", "outcome": "O1"}],
  "key_concepts": ["Fraction", "Percentage", "Decimal", "Equivalence", "Conversion"],
  "cfu_strategy": "MCQ: 'Which of these is equivalent to 3/4? A) 0.75  B) 0.34  C) 7.4  D) 3.4'"
}
```

Template Card:
```json
{
  "card_id": "card_002",
  "card_type": "explainer",
  "explainer": "**Fractions, Percentages, and Decimals: The Basics**\n\nThese three ways of writing numbers are all related:\n- **Fraction**: Parts of a whole (like 3/4)\n- **Percentage**: Out of 100 (like 75%)\n- **Decimal**: Point notation (like 0.75)\n\nThey're all different ways to show the same amount! For example, 3/4 = 75% = 0.75. You can convert between them depending on what's easiest for the problem.",
  "explainer_plain": "Fractions, percentages, and decimals are related. A fraction is parts of a whole. Like 3/4. A percentage is out of 100. Like 75%. A decimal uses a point. Like 0.75. They show the same amount. You can change between them.",
  "cfu": {
    "question_text": "Which of these is equivalent to 3/4?",
    "question_text_plain": "Which one equals 3/4?",
    "type": "mcq",
    "options": ["0.75", "0.34", "7.4", "3.4"],
    "answerIndex": 0,
    "rubric": {
      "total_points": 1,
      "criteria": [
        {
          "description": "Correctly identifies decimal equivalent of fraction",
          "points": 1
        }
      ]
    }
  }
}
```

---

**3. modelling (SOW) → explainer + cfu (Template)**

**Purpose**: Demonstrate worked examples with I-do phase

**Template Format**:
- `card_type`: "explainer"
- `explainer`: Present worked_example with step-by-step breakdown
- `cfu`: Structured response asking student to replicate steps
- `rubric`: Assess procedural accuracy using worked_example as exemplar

**Example**:
SOW Card:
```json
{
  "card_type": "modelling",
  "title": "Calculating a Percentage of an Amount",
  "worked_example": "Find 30% of £60. Step 1: Find 10% by doing £60 / 10 = £6. Step 2: Multiply by 3 to get 30%: £6 × 3 = £18. Answer: £18",
  "cfu_strategy": "Structured question: 'Show me the steps to find 20% of £80.'"
}
```

Template Card:
```json
{
  "card_id": "card_003",
  "card_type": "explainer",
  "explainer": "Let's work through calculating a percentage together. Here's how to find **30% of £60**:\n\n**Step 1:** Find 10% by dividing by 10\n£60 ÷ 10 = £6\n\n**Step 2:** Multiply by 3 to get 30%\n£6 × 3 = £18\n\n**Answer:** 30% of £60 = £18\n\nNow it's your turn to try a similar problem!",
  "explainer_plain": "Let's find 30% of £60 together. First, find 10% by dividing by 10. That gives us £6. Then multiply by 3 to get 30%. That gives us £18. So 30% of £60 is £18. Now try one yourself!",
  "cfu": {
    "question_text": "Show me the steps to find 20% of £80.",
    "question_text_plain": "Show me how to find 20% of £80 step by step.",
    "type": "structured_response",
    "rubric": {
      "dimensions": [
        {
          "dimension_id": "CRIT_AS1.2_001",
          "name": "Percentage Calculation Process",
          "description": "Using appropriate mathematical processes to calculate percentages",
          "levels": [
            {
              "level": "emerging",
              "description": "Attempts calculation but makes procedural errors",
              "indicators": [
                "Identifies need to find 10% but calculates incorrectly",
                "Shows some steps but misses multiplication step"
              ]
            },
            {
              "level": "developing",
              "description": "Correctly follows one step but not both",
              "indicators": [
                "Correctly finds 10% (£80 ÷ 10 = £8)",
                "Attempts multiplication but uses wrong factor"
              ]
            },
            {
              "level": "secure",
              "description": "Correctly completes both steps",
              "indicators": [
                "Correctly finds 10%: £80 ÷ 10 = £8",
                "Correctly multiplies: £8 × 2 = £16",
                "States final answer: 20% of £80 = £16"
              ]
            }
          ]
        }
      ]
    },
    "hints": [
      "Start by finding 10% of £80. How do you find 10% of any amount?",
      "Remember: 20% is 2 times 10%. Once you have 10%, multiply by 2."
    ]
  }
}
```

---

**4. guided_practice (SOW) → cfu (Template)**

**Purpose**: We-do phase with scaffolded practice

**Template Format**:
- `card_type`: "cfu"
- `explainer`: Brief setup ("Now let's practice together...")
- `cfu`: Use practice_problems as question_text
- `type`: "structured_response" or "mcq" based on cfu_strategy
- `hints`: Transform misconceptions_addressed into hint array
- `rubric`: Detailed criteria referencing standards_addressed

**Example**:
SOW Card:
```json
{
  "card_type": "guided_practice",
  "title": "Supermarket Savings",
  "practice_problems": [
    "A box of shortbread costs £4. It has 25% off. What is the new price?"
  ],
  "misconceptions_addressed": [
    {
      "misconception": "Calculating the discount amount but forgetting to subtract it from the original price",
      "remediation": "The AI tutor will prompt: 'Great, you've found the discount is £1. Now, what do you do with that £1 to find the new price?'"
    }
  ],
  "cfu_strategy": "Structured question with Scottish shopping context"
}
```

Template Card:
```json
{
  "card_id": "card_004",
  "card_type": "cfu",
  "explainer": "Time for some practice! Let's use percentages in a real shopping scenario.",
  "explainer_plain": "Let's practice with a shopping example.",
  "cfu": {
    "question_text": "A box of shortbread costs £4. It has 25% off. What is the new price?",
    "question_text_plain": "A box of shortbread costs £4. It has 25% off. What is the new price?",
    "type": "structured_response",
    "rubric": {
      "dimensions": [
        {
          "dimension_id": "CRIT_AS1.2_002",
          "name": "Percentage Discount Application",
          "description": "Calculate discount and determine final price",
          "levels": [
            {
              "level": "emerging",
              "description": "Attempts calculation but makes errors",
              "indicators": [
                "Identifies need to find 25% but calculates incorrectly",
                "Finds discount but doesn't subtract from original"
              ]
            },
            {
              "level": "developing",
              "description": "Correctly finds discount but incomplete",
              "indicators": [
                "Correctly calculates 25% of £4 = £1",
                "States discount but not final price"
              ]
            },
            {
              "level": "secure",
              "description": "Completes full discount calculation",
              "indicators": [
                "Finds 25% of £4 = £1",
                "Subtracts: £4 - £1 = £3",
                "States new price is £3"
              ]
            }
          ]
        }
      ]
    },
    "hints": [
      "First, find 25% of £4. Remember, 25% is the same as one-quarter.",
      "Great, you've found the discount is £1. Now, what do you do with that £1 to find the new price?",
      "The new price is the original price minus the discount."
    ]
  }
}
```

---

**5. independent_practice (SOW) → cfu (Template)**

**Purpose**: You-do phase with minimal scaffolding

**Template Format**:
- Similar to guided_practice but **fewer hints**
- `rubric`: Emphasizes independence and mastery
- Higher difficulty practice problems if available

---

**6. exit_ticket (SOW) → cfu (Template)**

**Purpose**: Formative assessment of lesson learning

**Template Format**:
- Quick check question covering key standards
- Simple rubric with clear success criteria
- Minimal hints (assessing current understanding)
</card_type_transformations>
```

### 1.4 Add Accessibility Generation Guidelines

**Location**: After `<card_type_transformations>` section

**Addition**: New `<accessibility_generation>` section

```xml
<accessibility_generation>
## Generating Plain Language Versions

When generating `explainer_plain`, `question_text_plain`, and plain rubric descriptions:

**CEFR Level Targets**:
- `explainer_plain`: A2 level (elementary)
- `question_text_plain`: A2 level
- Rubric descriptions: B1 level (intermediate)

**Plain Language Strategies**:
1. **Shorter sentences**: Max 15 words per sentence (A2), 20 words (B1)
2. **Active voice**: "Find 10%" not "10% should be found"
3. **Common words**: "Find" not "determine", "use" not "utilize"
4. **Concrete examples**: Specific amounts not abstract concepts
5. **Break complexity**: Split complex ideas into multiple sentences
6. **One instruction per line**: Each step on its own line

**CEFR A2 Example**:
- Original: "To calculate the percentage, divide the amount by 100 and multiply by the percentage value."
- Plain (A2): "Find the percentage. First divide by 100. Then multiply by the percentage."

**CEFR B1 Example**:
- Original: "Demonstrates comprehensive understanding of percentage calculations with accurate method and final answer."
- Plain (B1): "Shows full understanding of percentages. Uses correct method and gets the right answer."

**Common Transformations**:
- "Utilize" → "Use"
- "Determine" → "Find"
- "Demonstrates" → "Shows"
- "Comprehensive" → "Full"
- "Accurate" → "Correct"
- "Appropriate" → "Right"
</accessibility_generation>
```

---

## Phase 2: Update Critic Validation

### Objective

Enhance `COMBINED_LESSON_CRITIC_PROMPT` to validate that the lesson template faithfully transforms the SOW pedagogical design.

### 2.1 Add SOW-Template Alignment Dimension

**Location**: `lesson_author_prompts.py` → `COMBINED_LESSON_CRITIC_PROMPT`

**Addition**: New validation dimension after existing 5 dimensions

```xml
<sow_alignment_validation>
## Dimension 6: SOW-Template Fidelity (Threshold ≥0.90)

**Purpose**: Validate that the lesson template faithfully transforms the SOW pedagogical design

**Criteria**:

1. **Card Count & Flow**:
   - Template should have similar number of cards to SOW card_structure (±1 card acceptable)
   - Pedagogical progression should match SOW lesson_flow_summary
   - Card order should preserve SOW pedagogical intent
   - Total estimated minutes should match (±5 minutes acceptable)

2. **Content Preservation**:
   - **Worked examples**: If SOW card has `worked_example`, it MUST appear in template explainer content
   - **Practice problems**: SOW `practice_problems` MUST be used in template CFU question_text
   - **Key concepts**: SOW `key_concepts` MUST be covered in template explainers
   - **Misconceptions**: SOW `misconceptions_addressed` MUST be transformed into template hints

3. **Standard Coverage**:
   - All `assessmentStandardRefs` from SOW MUST appear in template
   - Template rubrics MUST reference the enriched standard descriptions (not bare codes)
   - SOW card `standards_addressed` MUST map to template rubric criteria

4. **Scottish Context Preservation**:
   - Cultural references from SOW MUST be preserved (£, products, services)
   - Engagement contexts (ScotRail, NHS, local shops) MUST be maintained
   - SOW practice problem contexts MUST appear in template CFU stems

5. **CFU Strategy Alignment**:
   - Template CFU type MUST match SOW `cfu_strategy` indication
   - If SOW says "MCQ", template must have MCQ CFU
   - If SOW says "Structured question", template must have structured_response CFU
   - CFU question wording should align with SOW cfu_strategy text

**Validation Process**:
1. Read `sow_entry_input.json` to extract card_structure
2. Read `lesson_template.json` to extract template cards
3. Compare card counts: Count SOW cards vs template cards (should be within ±1)
4. Check content preservation:
   - For each SOW card with `worked_example`: Grep for key phrases in template explainer content
   - For each SOW card with `practice_problems`: Check if problems appear in template CFU question_text
   - For each SOW card with `misconceptions_addressed`: Verify hints exist in template
5. Validate standard coverage:
   - Extract all SOW assessmentStandardRefs codes
   - Verify all codes appear in template assessmentStandardRefs
   - Check template rubrics reference standard descriptions (not just codes)
6. Check Scottish context:
   - Verify £ currency maintained (not changed to $)
   - Check SOW contexts appear in template (ScotRail → template should reference ScotRail)
7. Validate CFU types:
   - Parse SOW cfu_strategy for type hints (MCQ, structured, numeric)
   - Check template CFU type matches

**Scoring Rubric**:
- **1.0 (10/10)**: Perfect transformation, all SOW content leveraged appropriately, zero content loss
- **0.9 (9/10)**: Excellent transformation, minor content gaps (1 misconception missing)
- **0.8 (8/10)**: Good transformation, noticeable gaps (1 practice problem not used, or 1 worked example missing)
- **0.7 (7/10)**: Adequate but missing significant SOW content (2+ items not used)
- **Below 0.7**: Poor transformation, SOW content largely ignored

**Common Issues to Flag**:
- ❌ "SOW card 3 has worked_example but template card_003 explainer is generic (worked example not used)"
- ❌ "SOW card 4 has practice_problems but template card_004 CFU uses different question"
- ❌ "SOW card 4 misconceptions not transformed into hints"
- ❌ "Template has 3 cards but SOW card_structure has 5 cards (missing 2 pedagogical moments)"
- ❌ "SOW uses £ but template changed to $ in CFU"
- ❌ "SOW cfu_strategy says 'MCQ' but template uses structured_response"

**Pass Condition**: score ≥ 0.90
</sow_alignment_validation>
```

### 2.2 Update Critic Orchestration

**Location**: `COMBINED_LESSON_CRITIC_PROMPT` → `<process>` section

**Change**: Update step 3 to include new dimension

**Before**:
```markdown
3) **Score each dimension** (0.0-1.0, threshold varies):
   - Dimension 1: Pedagogical Design (≥0.85)
   - Dimension 2: Assessment Design (≥0.90)
   - Dimension 3: Accessibility (≥0.90)
   - Dimension 4: Scottish Context (≥0.90)
   - Dimension 5: Coherence (≥0.85)
```

**After**:
```markdown
3) **Score each dimension** (0.0-1.0, threshold varies):
   - Dimension 1: Pedagogical Design (≥0.85)
   - Dimension 2: Assessment Design (≥0.90)
   - Dimension 3: Accessibility (≥0.90)
   - Dimension 4: Scottish Context (≥0.90)
   - Dimension 5: Coherence (≥0.85)
   - Dimension 6: SOW-Template Fidelity (≥0.90)
```

---

## Phase 3: E2E Testing

### Objective

Create comprehensive end-to-end tests that validate the agent correctly transforms rich SOW content into lesson templates.

### 3.1 Create Test File

**File**: `langgraph-author-agent/test_lesson_author_sow_integration.py`

**Content**:

```python
#!/usr/bin/env python3
"""E2E tests for Lesson Author with new rich SOW schema.

Tests validate that the Lesson Author Agent correctly transforms rich SOW
pedagogical content (worked examples, practice problems, misconceptions)
into executable lesson templates.
"""

import json
from pathlib import Path


def test_lesson_author_with_rich_sow_entry_1():
    """Test that Lesson Author correctly transforms rich SOW entry with 5 cards."""

    # 1. Prepare rich SOW entry input
    sow_entry = {
        "order": 1,
        "label": "Introduction to Numeracy: Fractions, Percentages, and Decimals (Non-Calc)",
        "lesson_type": "teach",
        "assessmentStandardRefs": [
            {
                "code": "AS1.2",
                "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
                "outcome": "O1"
            }
        ],
        "lesson_plan": {
            "summary": "This lesson introduces foundational non-calculator numeracy skills focusing on the relationships between fractions, percentages, and decimals.",
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "starter",
                    "title": "What's the Deal?",
                    "purpose": "To activate prior knowledge of fractions and percentages encountered in everyday contexts.",
                    "pedagogical_approach": "Present a simple shopping scenario involving a discount and ask students to recall when they've seen similar situations.",
                    "cfu_strategy": "Open question: 'When have you used fractions or percentages this week?'",
                    "estimated_minutes": 5
                },
                {
                    "card_number": 2,
                    "card_type": "explainer",
                    "title": "Fractions, Percentages, and Decimals: The Basics",
                    "standards_addressed": [
                        {
                            "code": "AS1.2",
                            "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
                            "outcome": "O1"
                        }
                    ],
                    "key_concepts": ["Fraction", "Percentage", "Decimal", "Equivalence", "Conversion"],
                    "pedagogical_approach": "Use a visual diagram showing 3/4 = 75% = 0.75 with a shaded bar to demonstrate equivalence.",
                    "cfu_strategy": "MCQ: 'Which of these is equivalent to 3/4? A) 0.75  B) 0.34  C) 7.4  D) 3.4'",
                    "estimated_minutes": 10
                },
                {
                    "card_number": 3,
                    "card_type": "modelling",
                    "title": "Calculating a Percentage of an Amount",
                    "standards_addressed": [
                        {
                            "code": "AS1.2",
                            "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
                            "outcome": "O1"
                        }
                    ],
                    "worked_example": "Find 30% of £60. Step 1: Find 10% by doing £60 / 10 = £6. Step 2: Multiply by 3 to get 30%: £6 × 3 = £18. Answer: £18",
                    "pedagogical_approach": "Model the 'find 10%, then multiply' strategy explicitly showing each calculation step on screen.",
                    "cfu_strategy": "Structured question: 'Show me the steps to find 20% of £80.'",
                    "estimated_minutes": 10
                },
                {
                    "card_number": 4,
                    "card_type": "guided_practice",
                    "title": "Supermarket Savings",
                    "standards_addressed": [
                        {
                            "code": "AS1.2",
                            "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
                            "outcome": "O1"
                        }
                    ],
                    "practice_problems": [
                        "A box of shortbread costs £4. It has 25% off. What is the new price?",
                        "A bottle of juice is £2. It has a 10% discount. How much do you save?"
                    ],
                    "misconceptions_addressed": [
                        {
                            "misconception": "Calculating the discount amount but forgetting to subtract it from the original price",
                            "remediation": "The AI tutor will prompt: 'Great, you've found the discount is £1. Now, what do you do with that £1 to find the new price?'"
                        }
                    ],
                    "pedagogical_approach": "Present Scottish supermarket contexts with scaffolded hints if students struggle.",
                    "cfu_strategy": "Structured question with rubric checking method, calculation, and final answer.",
                    "estimated_minutes": 15
                },
                {
                    "card_number": 5,
                    "card_type": "exit_ticket",
                    "title": "Quick Check: Percentages",
                    "standards_addressed": [
                        {
                            "code": "AS1.2",
                            "description": "Using appropriate mathematical processes and/or calculations to determine a solution",
                            "outcome": "O1"
                        }
                    ],
                    "cfu_strategy": "Numeric: 'Find 15% of £80.'",
                    "estimated_minutes": 5
                }
            ],
            "lesson_flow_summary": "5min starter → 10min explainer → 10min modelling → 15min guided practice → 5min exit ticket (45 min total)",
            "multi_standard_integration_strategy": "This lesson focuses solely on AS1.2 to build a strong foundation in percentage calculations before introducing additional standards.",
            "misconceptions_embedded_in_cards": [
                "Card 4 addresses the common error of finding the discount amount but not subtracting it to find the final sale price."
            ]
        },
        "estMinutes": 45
    }

    # Write to input file
    input_path = Path("sow_entry_input.json")
    input_path.write_text(json.dumps(sow_entry, indent=2))

    # 2. Run Lesson Author Agent
    # (Assumes agent execution framework is set up)
    # result = run_lesson_author_agent(input_path)

    # 3. Read generated lesson template
    output_path = Path("lesson_template.json")
    assert output_path.exists(), "lesson_template.json not generated"

    template = json.loads(output_path.read_text())

    # 4. Validation: Card count matches SOW (±1 acceptable)
    sow_card_count = len(sow_entry["lesson_plan"]["card_structure"])
    template_card_count = len(template["cards"])
    assert abs(template_card_count - sow_card_count) <= 1, \
        f"Card count mismatch: SOW has {sow_card_count} cards, template has {template_card_count}"

    # 5. Validation: Worked example appears in template explainer
    sow_worked_example = sow_entry["lesson_plan"]["card_structure"][2]["worked_example"]

    # Find modelling/explainer cards in template
    explainer_cards = [c for c in template["cards"] if c["card_type"] == "explainer"]

    worked_example_found = False
    for card in explainer_cards:
        explainer_content = card.get("explainer", "")
        # Check if key phrases from worked example appear
        if "30%" in explainer_content and "£60" in explainer_content and "£6" in explainer_content:
            worked_example_found = True
            break

    assert worked_example_found, \
        f"SOW worked_example not found in template explainer content: {sow_worked_example}"

    # 6. Validation: Practice problems used in CFU
    sow_practice_problem = sow_entry["lesson_plan"]["card_structure"][3]["practice_problems"][0]

    # Find CFU cards in template
    cfu_cards = [c for c in template["cards"] if c.get("cfu")]

    practice_problem_found = False
    for card in cfu_cards:
        cfu = card.get("cfu", {})
        question_text = cfu.get("question_text", "")
        # Check if practice problem appears in CFU
        if "shortbread" in question_text and "£4" in question_text and "25%" in question_text:
            practice_problem_found = True
            break

    assert practice_problem_found, \
        f"SOW practice_problem not found in template CFU: {sow_practice_problem}"

    # 7. Validation: Misconceptions transformed into hints
    sow_misconception_remediation = sow_entry["lesson_plan"]["card_structure"][3]["misconceptions_addressed"][0]["remediation"]

    # Check if remediation text appears in hints
    all_hints = []
    for card in cfu_cards:
        cfu = card.get("cfu", {})
        hints = cfu.get("hints", [])
        all_hints.extend(hints)

    misconception_hint_found = False
    for hint in all_hints:
        # Check if remediation guidance appears in hints
        if "discount is £1" in hint and "new price" in hint:
            misconception_hint_found = True
            break

    assert misconception_hint_found, \
        f"SOW misconception remediation not found in template hints: {sow_misconception_remediation}"

    # 8. Validation: Enriched standards preserved
    sow_standard_code = sow_entry["assessmentStandardRefs"][0]["code"]
    sow_standard_description = sow_entry["assessmentStandardRefs"][0]["description"]

    template_standards = template["assessmentStandardRefs"]

    # Check if standard code appears
    standard_codes = [s["code"] for s in template_standards if isinstance(s, dict)]
    assert sow_standard_code in standard_codes, \
        f"SOW standard code {sow_standard_code} not found in template"

    # Check if description is preserved (not bare code)
    standard_with_description = [s for s in template_standards if isinstance(s, dict) and s.get("description")]
    assert len(standard_with_description) > 0, \
        "Template uses bare standard codes instead of enriched objects"

    # 9. Validation: Scottish context preserved
    # Check £ currency maintained
    for card in cfu_cards:
        cfu = card.get("cfu", {})
        question_text = cfu.get("question_text", "")
        if "shortbread" in question_text.lower():
            assert "£" in question_text, \
                "Scottish £ currency not preserved in CFU (changed to $ or removed)"

    # 10. Validation: CFU type matches SOW cfu_strategy
    # SOW card 2 says "MCQ" → template should have MCQ
    sow_card_2_cfu_strategy = sow_entry["lesson_plan"]["card_structure"][1]["cfu_strategy"]
    assert "MCQ" in sow_card_2_cfu_strategy, "Test assumption: SOW card 2 should be MCQ"

    # Find template card 2 (or nearby explainer with CFU)
    mcq_found = False
    for card in template["cards"][:3]:  # Check first 3 cards
        cfu = card.get("cfu", {})
        cfu_type = cfu.get("type", "")
        if cfu_type == "mcq":
            mcq_found = True
            break

    assert mcq_found, \
        "SOW card 2 cfu_strategy indicated MCQ but template doesn't have MCQ in early cards"

    print("✅ All SOW-Template transformation checks passed!")
    print(f"   - Card count: {template_card_count} (SOW: {sow_card_count})")
    print(f"   - Worked example found in explainer: ✅")
    print(f"   - Practice problem found in CFU: ✅")
    print(f"   - Misconception remediation found in hints: ✅")
    print(f"   - Enriched standards preserved: ✅")
    print(f"   - Scottish £ currency maintained: ✅")
    print(f"   - CFU type matches SOW strategy: ✅")


def test_lesson_author_handles_multiple_practice_problems():
    """Test that agent can handle SOW cards with multiple practice problems."""

    sow_entry = {
        "order": 5,
        "label": "Practice: Percentage Calculations",
        "lesson_type": "independent_practice",
        "assessmentStandardRefs": [
            {
                "code": "AS1.2",
                "description": "Using appropriate mathematical processes",
                "outcome": "O1"
            }
        ],
        "lesson_plan": {
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "independent_practice",
                    "title": "Mixed Percentage Problems",
                    "practice_problems": [
                        "Find 15% of £80",
                        "Find 35% of £120",
                        "A shirt costs £25 with 20% off. What's the sale price?"
                    ],
                    "cfu_strategy": "Multiple numeric and structured questions",
                    "estimated_minutes": 20
                }
            ],
            "lesson_flow_summary": "20min independent practice",
            "multi_standard_integration_strategy": "Focus on AS1.2 with varied contexts"
        },
        "estMinutes": 20
    }

    input_path = Path("sow_entry_input.json")
    input_path.write_text(json.dumps(sow_entry, indent=2))

    # Run agent
    # result = run_lesson_author_agent(input_path)

    output_path = Path("lesson_template.json")
    assert output_path.exists()

    template = json.loads(output_path.read_text())

    # Validate: Template should create multiple CFU cards (one per practice problem)
    # OR a single card with sub-questions
    cfu_cards = [c for c in template["cards"] if c.get("cfu")]

    # Check that all 3 practice problems are represented
    all_question_texts = []
    for card in cfu_cards:
        cfu = card.get("cfu", {})
        question_text = cfu.get("question_text", "")
        all_question_texts.append(question_text.lower())

    combined_questions = " ".join(all_question_texts)

    assert "15%" in combined_questions and "£80" in combined_questions, \
        "First practice problem not found in template CFUs"
    assert "35%" in combined_questions and "£120" in combined_questions, \
        "Second practice problem not found in template CFUs"
    assert "shirt" in combined_questions and "£25" in combined_questions and "20%" in combined_questions, \
        "Third practice problem not found in template CFUs"

    print("✅ Multiple practice problems handled correctly!")
    print(f"   - CFU cards generated: {len(cfu_cards)}")
    print(f"   - All 3 practice problems represented: ✅")


def test_lesson_author_preserves_scottish_contexts():
    """Test that Scottish cultural references from SOW are preserved in template."""

    sow_entry = {
        "order": 10,
        "label": "Percentages in Scottish Contexts",
        "lesson_type": "teach",
        "assessmentStandardRefs": [
            {"code": "AS1.2", "description": "Using appropriate mathematical processes", "outcome": "O1"}
        ],
        "lesson_plan": {
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "guided_practice",
                    "title": "ScotRail Discounts",
                    "practice_problems": [
                        "A ScotRail ticket from Edinburgh to Glasgow costs £14.50. There's a 16-25 railcard discount of 1/3 off. What's the discounted price?",
                        "An NHS prescription costs £9.65. If you're exempt, you pay 0%. How much do you save?"
                    ],
                    "pedagogical_approach": "Use familiar Scottish services (ScotRail, NHS) to contextualise percentage calculations.",
                    "cfu_strategy": "Structured questions with Scottish contexts",
                    "estimated_minutes": 15
                }
            ],
            "lesson_flow_summary": "15min guided practice with Scottish contexts"
        },
        "estMinutes": 15
    }

    input_path = Path("sow_entry_input.json")
    input_path.write_text(json.dumps(sow_entry, indent=2))

    # Run agent
    # result = run_lesson_author_agent(input_path)

    output_path = Path("lesson_template.json")
    assert output_path.exists()

    template = json.loads(output_path.read_text())

    # Validate: Scottish contexts preserved
    cfu_cards = [c for c in template["cards"] if c.get("cfu")]

    all_question_texts = []
    for card in cfu_cards:
        cfu = card.get("cfu", {})
        question_text = cfu.get("question_text", "")
        all_question_texts.append(question_text.lower())

    combined_questions = " ".join(all_question_texts)

    # Check ScotRail context
    assert "scotrail" in combined_questions, \
        "ScotRail context from SOW not preserved in template"
    assert "edinburgh" in combined_questions and "glasgow" in combined_questions, \
        "Scottish city names not preserved"
    assert "£14.50" in combined_questions or "£14.5" in combined_questions, \
        "ScotRail ticket price not preserved"

    # Check NHS context
    assert "nhs" in combined_questions, \
        "NHS context from SOW not preserved in template"
    assert "£9.65" in combined_questions or "£9.6" in combined_questions, \
        "NHS prescription price not preserved"

    # Check £ currency maintained
    assert "£" in combined_questions, \
        "£ currency not preserved (changed to $ or removed)"
    assert "$" not in combined_questions, \
        "Currency changed from £ to $ (incorrect)"

    print("✅ Scottish contexts preserved correctly!")
    print(f"   - ScotRail reference: ✅")
    print(f"   - NHS reference: ✅")
    print(f"   - Edinburgh/Glasgow references: ✅")
    print(f"   - £ currency maintained: ✅")


if __name__ == "__main__":
    print("\n" + "="*80)
    print("E2E TESTS: Lesson Author SOW Integration")
    print("="*80 + "\n")

    print("Test 1: Rich SOW Entry with 5 Cards")
    print("-"*80)
    test_lesson_author_with_rich_sow_entry_1()

    print("\n" + "="*80 + "\n")

    print("Test 2: Multiple Practice Problems")
    print("-"*80)
    test_lesson_author_handles_multiple_practice_problems()

    print("\n" + "="*80 + "\n")

    print("Test 3: Scottish Context Preservation")
    print("-"*80)
    test_lesson_author_preserves_scottish_contexts()

    print("\n" + "="*80)
    print("🎉 ALL TESTS PASSED!")
    print("="*80 + "\n")
```

### 3.2 Test Execution

**Run tests**:
```bash
cd langgraph-author-agent
python test_lesson_author_sow_integration.py
```

**Expected output**:
```
================================================================================
E2E TESTS: Lesson Author SOW Integration
================================================================================

Test 1: Rich SOW Entry with 5 Cards
--------------------------------------------------------------------------------
✅ All SOW-Template transformation checks passed!
   - Card count: 5 (SOW: 5)
   - Worked example found in explainer: ✅
   - Practice problem found in CFU: ✅
   - Misconception remediation found in hints: ✅
   - Enriched standards preserved: ✅
   - Scottish £ currency maintained: ✅
   - CFU type matches SOW strategy: ✅

================================================================================

Test 2: Multiple Practice Problems
--------------------------------------------------------------------------------
✅ Multiple practice problems handled correctly!
   - CFU cards generated: 3
   - All 3 practice problems represented: ✅

================================================================================

Test 3: Scottish Context Preservation
--------------------------------------------------------------------------------
✅ Scottish contexts preserved correctly!
   - ScotRail reference: ✅
   - NHS reference: ✅
   - Edinburgh/Glasgow references: ✅
   - £ currency maintained: ✅

================================================================================
🎉 ALL TESTS PASSED!
================================================================================
```

---

## Testing Strategy

### Unit Testing

**Test Prompt Changes**:
```python
def test_prompt_includes_sow_field_usage():
    """Verify updated prompt includes SOW field usage guidance."""
    from lesson_author_prompts import LESSON_AGENT_PROMPT

    assert "<sow_field_usage>" in LESSON_AGENT_PROMPT
    assert "worked_example" in LESSON_AGENT_PROMPT
    assert "practice_problems" in LESSON_AGENT_PROMPT
    assert "misconceptions_addressed" in LESSON_AGENT_PROMPT

def test_prompt_includes_card_type_transformations():
    """Verify updated prompt includes card type mapping guide."""
    from lesson_author_prompts import LESSON_AGENT_PROMPT

    assert "<card_type_transformations>" in LESSON_AGENT_PROMPT
    assert "starter (SOW) → explainer (Template)" in LESSON_AGENT_PROMPT
    assert "modelling (SOW) → explainer + cfu (Template)" in LESSON_AGENT_PROMPT

def test_critic_includes_sow_alignment_dimension():
    """Verify critic includes SOW-Template fidelity validation."""
    from lesson_author_prompts import COMBINED_LESSON_CRITIC_PROMPT

    assert "<sow_alignment_validation>" in COMBINED_LESSON_CRITIC_PROMPT
    assert "Dimension 6: SOW-Template Fidelity" in COMBINED_LESSON_CRITIC_PROMPT
```

### Integration Testing

**Test Agent Behavior**:
```python
def test_agent_uses_sow_worked_example():
    """Verify agent extracts and uses SOW worked examples."""
    sow_entry = create_test_sow_with_worked_example()
    template = run_agent(sow_entry)

    # Check worked example appears in explainer
    assert_worked_example_in_explainer(template, sow_entry)

def test_agent_transforms_practice_problems_to_cfu():
    """Verify agent transforms practice problems into CFU question_text."""
    sow_entry = create_test_sow_with_practice_problems()
    template = run_agent(sow_entry)

    # Check practice problems used in CFUs
    assert_practice_problems_in_cfus(template, sow_entry)

def test_agent_transforms_misconceptions_to_hints():
    """Verify agent transforms misconceptions into hints."""
    sow_entry = create_test_sow_with_misconceptions()
    template = run_agent(sow_entry)

    # Check misconceptions appear in hints
    assert_misconceptions_in_hints(template, sow_entry)
```

### Regression Testing

**Golden Output Comparison**:
```python
def test_no_regression_with_old_sow_format():
    """Verify agent still handles old minimal SOW format (backward compatibility)."""
    old_sow_entry = {
        "order": 1,
        "label": "Basic Fractions",
        "lesson_type": "teach",
        "assessmentStandardRefs": ["AS1.2"],  # Bare strings
        "notes": "Focus on basic fractions"
    }

    # Agent should still work (graceful degradation)
    template = run_agent(old_sow_entry)
    assert template is not None
    assert len(template["cards"]) >= 3
```

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Worked Example Usage** | 100% | Every SOW worked_example appears in template explainer |
| **Practice Problem Usage** | 100% | Every SOW practice_problem appears in template CFU |
| **Misconception Transformation** | 100% | Every SOW misconception becomes a hint |
| **Standard Enrichment Preservation** | 100% | All enriched standard objects preserved (no bare codes) |
| **Scottish Context Preservation** | 100% | All £ currency and Scottish references maintained |

### Quality Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Critic Pass Rate** | Unknown | ≥85% | Dimension 6 (SOW-Template Fidelity) pass rate |
| **Card Count Accuracy** | Unknown | ±1 card | Template card count vs SOW card_structure count |
| **CFU Type Alignment** | Unknown | ≥90% | Template CFU type matches SOW cfu_strategy indication |

### Maintainability Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Prompt Update Time** | ≤2 hours | Time to add new SOW field guidance |
| **Test Coverage** | 100% | All transformation patterns covered by tests |
| **Documentation Completeness** | 100% | All SOW fields documented in `<sow_field_usage>` |

---

## Implementation Timeline

### Phase 1: Prompt Updates (2-3 hours)

**Week 1 - Day 1**:
- [ ] Update `<inputs>` section with new SOW schema (30 min)
- [ ] Add `<sow_field_usage>` section (45 min)
- [ ] Add `<card_type_transformations>` section with 6 mappings (60 min)
- [ ] Add `<accessibility_generation>` section (30 min)
- [ ] Review and validate prompt changes (15 min)

**Deliverable**: Updated `lesson_author_prompts.py` with enhanced prompt

### Phase 2: Critic Updates (1 hour)

**Week 1 - Day 2**:
- [ ] Add `<sow_alignment_validation>` dimension to critic (30 min)
- [ ] Update critic orchestration to include Dimension 6 (15 min)
- [ ] Review critic scoring logic (15 min)

**Deliverable**: Updated `COMBINED_LESSON_CRITIC_PROMPT` with SOW-Template fidelity checks

### Phase 3: E2E Testing (2-3 hours)

**Week 1 - Day 2-3**:
- [ ] Create `test_lesson_author_sow_integration.py` (60 min)
- [ ] Write Test 1: Rich SOW with 5 cards (45 min)
- [ ] Write Test 2: Multiple practice problems (30 min)
- [ ] Write Test 3: Scottish context preservation (30 min)
- [ ] Run tests and validate results (30 min)

**Deliverable**: Comprehensive E2E test suite

### Total Estimated Effort: 4-6 hours

---

## Appendix

### A. Example SOW Card Structures

**Teach Lesson (5 cards)**:
1. Starter (engagement)
2. Explainer (key concepts)
3. Modelling (worked example)
4. Guided Practice (scaffolded CFU)
5. Exit Ticket (formative check)

**Independent Practice Lesson (3 cards)**:
1. Practice (basic)
2. Practice (standard)
3. Practice (challenge)

**Formative Assessment Lesson (3 cards)**:
1. Assessment (standard 1)
2. Assessment (standard 2)
3. Assessment (integration)

### B. Common Transformation Patterns

**Pattern 1: Worked Example → Explainer**
```
SOW: "Find 30% of £60. Step 1: £60/10=£6. Step 2: £6×3=£18"
↓
Template: "Let's work through this together. First, find 10%: £60÷10=£6. Then multiply by 3: £6×3=£18."
```

**Pattern 2: Practice Problem → CFU Question Text**
```
SOW: "A box of shortbread costs £4. It has 25% off. What is the new price?"
↓
Template CFU: {question_text: "A box of shortbread costs £4. It has 25% off. What is the new price?"}
```

**Pattern 3: Misconception → Hint**
```
SOW: {misconception: "Forgetting to subtract discount", remediation: "Great, you found £1. Now what?"}
↓
Template Hint: "Great, you've found the discount is £1. Now, what do you do with that £1 to find the new price?"
```

### C. CEFR Plain Language Examples

**A2 Level (explainer_plain)**:
- "Find 10% of £80. Divide by 10. That gives £8."
- "Then multiply by 2. That gives £16."
- "So 20% of £80 is £16."

**B1 Level (rubric descriptions)**:
- "Shows correct method for finding percentage"
- "Calculates 10% accurately"
- "Multiplies to get final percentage"

### D. Related Files

- **Current Lesson Author Agent**: `langgraph-author-agent/src/lesson_author_agent.py`
- **Current Lesson Author Prompts**: `langgraph-author-agent/src/lesson_author_prompts.py`
- **Example Rich SOW**: `assistant-ui-frontend/output/sow_course_c84474_391eef16-0498-47aa-bc2d-aa7ac75a5888.json`
- **SOW Author Refactoring Spec**: `langgraph-author-agent/tasks/sow-prompt-refactoring-spec.md`

### E. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-10-16 | Initial specification | Lesson Author Integration Review |

---

## Approval

**Status**: Proposed
**Next Steps**: Review with team, approve implementation plan
**Estimated Start**: TBD
**Estimated Completion**: 1-2 days after approval (4-6 hours total effort)
