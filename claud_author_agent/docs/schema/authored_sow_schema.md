# Authored SOW Schema - AI Agent Reference

**Version**: 1.0
**Purpose**: Defines the exact structure for `authored_sow.json` output from SOW Author Agent.
**Audience**: AI agents (SOW Author, Unified Critic, Schema Critic), human reviewers
**Last Updated**: 2025-10-19

---

## Overview

This document defines the authoritative schema for a Scottish AI Lessons **Scheme of Work (SOW)** JSON file. The SOW describes a complete learning sequence for one SQA course + level, designed for one-to-one AI tutoring.

**Key Philosophy**:
- Schema-first design - structure enables validation and downstream processing
- AI-friendly documentation - detailed descriptions with examples and reasoning
- Single source of truth - referenced by all validation agents
- Fail-fast validation - specific rules with clear violations

---

## Table of Contents

1. [Top-Level Structure](#top-level-structure)
2. [Metadata Object](#metadata-object)
3. [Entries Array](#entries-array)
4. [Coherence Object](#coherence-object)
5. [Policy Object](#policy-object)
6. [Lesson Plan Object](#lesson-plan-object)
7. [Card Structure](#card-structure)
8. [Accessibility Profile](#accessibility-profile)
9. [Enriched References](#enriched-references)
10. [Forbidden Patterns](#forbidden-patterns)
11. [Validation Rules](#validation-rules)
12. [Pre-Write Checklist](#pre-write-checklist)

---

## Top-Level Structure

The `authored_sow.json` file has this exact structure:

```json
{
  "metadata": { ... },
  "entries": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata` | object | Yes | Course-level context, coherence notes, accessibility strategy |
| `entries` | array | Yes | Array of lesson entries (10-20 typical) |

### Why This Structure

- `metadata` provides course-level coherence and context that applies to ALL lessons
- `entries` array represents sequential lessons with pedagogical content
- Flat structure (no deep nesting) simplifies validation and processing

---

## Metadata Object

**Location**: Top level, required
**Purpose**: Course-level context and guidance that spans all entries

### Structure

```json
{
  "metadata": {
    "coherence": {
      "policy_notes": ["..."],
      "sequencing_notes": ["..."]
    },
    "accessibility_notes": ["..."],
    "engagement_notes": ["..."],
    "weeks": 10,
    "periods_per_week": 4
  }
}
```

### Fields

#### `metadata.coherence` (object, REQUIRED)

Strategic planning notes that apply course-wide.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `policy_notes` | array[string] | Yes | Calculator usage sequencing at course level | `["Non-calculator units first to build conceptual understanding", "Mixed calculator units in middle", "Full calculator units at end"]` |
| `sequencing_notes` | array[string] | Yes | Curriculum flow rationale across blocks | `["Fractions before percentages (foundational)", "Algebra foundations before complex problem-solving"]` |

**Validation Rules**:
- Both arrays MUST be non-empty
- Each string should be a strategic note (1-2 sentences)
- Should reference actual lesson progression in entries

**Examples**:

✅ **Good**:
```json
{
  "policy_notes": [
    "Units 1-2 use non-calculator strategies to build number sense",
    "Units 3-4 introduce calculator as verification tool",
    "Units 5-6 assume full calculator competency"
  ],
  "sequencing_notes": [
    "Fractions → Decimals → Percentages (conceptual flow)",
    "Standard form and scientific notation follow percentages"
  ]
}
```

❌ **Bad**: Empty arrays
```json
{
  "policy_notes": [],  // FAILS - must be non-empty
  "sequencing_notes": []  // FAILS - must be non-empty
}
```

---

#### `metadata.accessibility_notes` (array[string], REQUIRED)

**Purpose**: Global accessibility strategies applied across all entries

**Description**: High-level strategies for supporting dyslexic learners and diverse abilities

**Type**: Non-empty array of strings

**Examples**:

✅ **Good**:
```json
"accessibility_notes": [
  "All materials use dyslexia-friendly fonts (sans-serif, no compressed spacing)",
  "Complex concepts broken into 3-4 small, sequential steps",
  "Extra time provision: 50% additional time for timed assessments",
  "Key terms pre-taught with visual supports in first lesson",
  "Assessment accommodations: reader/scribe available for written tasks"
]
```

❌ **Bad**: Too generic
```json
"accessibility_notes": ["Accessible"]  // FAILS - not specific enough
```

---

#### `metadata.engagement_notes` (array[string], REQUIRED)

**Purpose**: Scottish context hooks applied throughout the SOW

**Description**: How authentic Scottish contexts are woven into lessons

**Type**: Non-empty array of strings

**Examples**:

✅ **Good**:
```json
"engagement_notes": [
  "Currency always in £ sterling with Scottish shop prices (Tesco, Asda, Morrisons)",
  "NHS Scotland contexts: GP appointments, prescriptions, health statistics",
  "Public transport: Edinburgh Trams, Glasgow Subway, local bus fares",
  "Sports: Scottish football leagues, athletics records",
  "Finance: Scottish bank holidays, council tax, Scottish government services"
]
```

❌ **Bad**: No Scottish specificity
```json
"engagement_notes": ["Real-world contexts"]  // FAILS - not Scottish
```

---

#### `metadata.weeks` (integer, OPTIONAL)

**Purpose**: Estimated teaching duration

**Type**: Positive integer

**Example**: `10` weeks

---

#### `metadata.periods_per_week` (integer, OPTIONAL)

**Purpose**: Expected teaching frequency

**Type**: Positive integer

**Example**: `4` periods per week

---

## Entries Array

**Location**: Top level
**Purpose**: Ordered sequence of lesson entries
**Type**: Array of lesson entry objects

### Structure

```json
{
  "entries": [
    {
      "order": 1,
      "label": "Fractions: Introduction and Notation",
      "lesson_type": "teach",
      "coherence": { ... },
      "policy": { ... },
      "engagement_tags": [ ... ],
      "outcomeRefs": [ ... ],
      "assessmentStandardRefs": [ ... ],
      "lesson_plan": { ... },
      "accessibility_profile": { ... },
      "estMinutes": 50,
      "lesson_instruction": "..."
    },
    // More entries...
  ]
}
```

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order` | integer | Yes | Sequential position (1, 2, 3...) |
| `label` | string | Yes | Teacher-facing lesson title |
| `lesson_type` | enum | Yes | teach \| revision \| formative_assessment \| independent_practice \| mock_assessment \| spiral_revisit |
| `coherence` | object | Yes | Block naming and prerequisite links |
| `policy` | object | Yes | Calculator usage and assessment notes |
| `engagement_tags` | array[string] | Yes | Scottish context labels |
| `outcomeRefs` | array[string] | Yes | Outcome codes from Course_data.txt |
| `assessmentStandardRefs` | array[object] | Yes | **ENRICHED OBJECTS** (code, description, outcome) |
| `lesson_plan` | object | Yes | Detailed pedagogical content with 6-12 cards |
| `accessibility_profile` | object | Yes | Dyslexia-friendly and accessibility features |
| `estMinutes` | integer | Yes | Estimated lesson duration (25-50 typical) |
| `lesson_instruction` | string | Yes | Teacher guidance (NOT "notes") |

### Entry-Level Validation Rules

1. **`order` must be sequential**: Entry 1 has order=1, Entry 2 has order=2, etc.
2. **`label` must be clear**: Should indicate covered standards, not generic like "Lesson 1"
3. **`lesson_type` must be valid enum value**
4. **`assessmentStandardRefs` must use ENRICHED OBJECTS** (NOT bare strings) - see [Enriched References](#enriched-references)
5. **All required fields must be present** - no optional field skipping

---

## Coherence Object

**Location**: Each entry
**Purpose**: Link lesson to curriculum structure and prerequisites

### Structure

```json
{
  "coherence": {
    "block_name": "Fractions: Notation and Basic Operations",
    "block_index": "1.1",
    "prerequisites": ["O1", "Number Sense"]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `block_name` | string | Yes | Sub-topic label indicating thematic block |
| `block_index` | string | Yes | Ordering indicator (e.g., "1.1", "1.2", "2.1") |
| `prerequisites` | array[string] | No | Earlier lessons/concepts this builds on |

### Validation Rules

- `block_index` must be ascending (1.1 → 1.2 → 2.1, NOT random order)
- `block_index` should use notation like "Unit.Lesson" for clarity
- `prerequisites` should reference earlier `order` values or outcome codes

---

## Policy Object

**Location**: Each entry
**Purpose**: SQA policy guardrails (calculator, assessment)

### Structure

```json
{
  "policy": {
    "calculator_section": "non_calc",
    "assessment_notes": "Optional guidance for marking or re-assessment"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `calculator_section` | enum | Yes | non_calc \| mixed \| calc |
| `assessment_notes` | string | No | Clarifications for marking or re-assessment |

### Calculator Section Enum

- `"non_calc"`: Calculator NOT allowed (builds foundational skills)
- `"mixed"`: Calculator allowed for selected problems (verification)
- `"calc"`: Calculator expected (complex calculations)

**Validation Rule**: Must follow course-level calculator progression in `metadata.policy_notes`

---

## Engagement Tags

**Location**: Each entry
**Purpose**: Scottish context labels for lesson

### Structure

```json
{
  "engagement_tags": ["shopping", "supermarket_prices", "discount_calculation", "bus_fares"]
}
```

**Purpose**: Flags which Scottish contexts are woven into this lesson

**Examples**:
- `"shopping"` - Retail contexts (Tesco, Asda, etc.)
- `"bus_fares"` - Public transport
- `"nhs"` - Health service contexts
- `"finance"` - Personal finance/money management
- `"sports"` - Scottish sports (football, athletics)
- `"government_services"` - Council tax, benefits, etc.

**Validation Rule**: Each tag should correspond to actual contexts in lesson_plan cards

---

## Outcome References

**Location**: Each entry
**Purpose**: Link to SQA outcomes

### Structure

```json
{
  "outcomeRefs": ["O1", "O2"]
}
```

**Type**: Array of outcome code strings (e.g., "O1", "O2")

**Validation Rule**: Must reference valid outcomes from Course_data.txt

---

## Assessment Standard References (ENRICHED FORMAT)

**Location**: Each entry
**Purpose**: Standards addressed by this lesson
**CRITICAL**: Must use **ENRICHED OBJECTS**, NOT bare strings

### Structure

✅ **CORRECT - Enriched Objects**:

```json
{
  "assessmentStandardRefs": [
    {
      "code": "AS1.2",
      "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
      "outcome": "O1"
    },
    {
      "code": "AS1.3",
      "description": "Multiply and divide simple fractions",
      "outcome": "O1"
    }
  ]
}
```

❌ **WRONG - Bare Strings** (FAILS VALIDATION):

```json
{
  "assessmentStandardRefs": ["AS1.2", "AS1.3"]  // INVALID - bare strings
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Assessment standard code (e.g., "AS1.2") |
| `description` | string | Yes | **EXACT** description from Course_data.txt (NO paraphrasing) |
| `outcome` | string | Yes | Parent outcome reference (e.g., "O1") |

### Validation Rules

1. **MUST be object, NOT string**
2. **Description MUST match Course_data.txt exactly** - character-for-character
   - NO paraphrasing like "Add fractions" instead of full SQA text
   - NO abbreviations or simplifications
   - Copy-paste from Course_data.txt to ensure accuracy

3. **outcome reference MUST be valid** - reference actual outcome from Course_data.txt

**Why enriched format?**
- Enables downstream Lesson Author Agent to generate lessons with accurate SQA terminology
- Allows validation to verify descriptions against Course_data.txt
- Supports schema validation before Lesson Author Agent processes SOW

---

## Lesson Plan Object

**Location**: Each entry
**Purpose**: Complete pedagogical design with card sequence

### Structure

```json
{
  "lesson_plan": {
    "summary": "2-3 sentence pedagogical arc",
    "card_structure": [ ... ],
    "lesson_flow_summary": "Timeline showing card sequence",
    "multi_standard_integration_strategy": "How standards connect",
    "misconceptions_embedded_in_cards": ["Card 1: confusing numerator/denominator"],
    "assessment_progression": "Formative → summative flow"
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `summary` | string | Yes | 2-3 sentence overview of lesson pedagogical arc |
| `card_structure` | array[object] | Yes | 6-12 detailed card objects (see [Card Structure](#card-structure)) |
| `lesson_flow_summary` | string | Yes | Timeline (e.g., "5min starter → 10min explainer → 8min modelling → 50min total") |
| `multi_standard_integration_strategy` | string | Yes | For chunked lessons: How multiple standards connect across cards |
| `misconceptions_embedded_in_cards` | array[string] | Yes | Which misconceptions addressed in which cards |
| `assessment_progression` | string | Yes | How assessment builds from formative CFU to summative |

### Validation Rules

1. **`summary`**: Must be 2-3 sentences, not 1 sentence or 5+ sentences
2. **`card_structure`**: MUST contain 6-12 cards (minimum for realistic lesson)
3. **Card timings**: Sum of all `estimated_minutes` must equal entry `estMinutes` (±2 min tolerance)
4. **Standards coverage**: ALL entry-level `assessmentStandardRefs` must appear in 2-3 cards (progressive scaffolding)

---

## Card Structure

**Location**: lesson_plan.card_structure array
**Purpose**: Individual learning activities within a lesson

### Card Object Structure

```json
{
  "card_number": 1,
  "card_type": "starter",
  "title": "What Do We Know About Fractions?",
  "purpose": "Activate prior knowledge about fractions",
  "standards_addressed": [
    {
      "code": "AS1.2",
      "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
      "outcome": "O1"
    }
  ],
  "pedagogical_approach": "Class discussion about everyday fractions (half, quarter) followed by individual prediction task",
  "key_concepts": ["Numerator", "Denominator", "Common denominator"],
  "cfu_strategy": "MCQ: Which fraction is equivalent to 2/4? A) 1/2 B) 2/8 C) 4/8 D) 2/6",
  "misconceptions_addressed": [
    {
      "misconception": "Numerator must be smaller than denominator",
      "remediation": "Show examples: 5/4, 7/3. Explain improper fractions as wholes + parts"
    }
  ],
  "estimated_minutes": 8
}
```

### Card Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `card_number` | integer | Yes | Sequential (1, 2, 3...) within lesson |
| `card_type` | enum | Yes | starter \| explainer \| modelling \| guided_practice \| independent_practice \| exit_ticket |
| `title` | string | Yes | Clear, teacher-facing card name |
| `purpose` | string | Yes | Pedagogical goal for this card |
| `standards_addressed` | array[object] | No | **ENRICHED OBJECTS** (code, description, outcome) - see [Enriched References](#enriched-references) |
| `pedagogical_approach` | string | Yes | Detailed description of what happens in card (NOT generic) |
| `key_concepts` | array[string] | No | For explainer cards: 3-5 key concepts |
| `worked_example` | string | No | For modelling cards: detailed worked example with Scottish context |
| `practice_problems` | array[string] | No | For guided_practice cards: 2-4 problems with increasing complexity |
| `cfu_strategy` | string | Yes | **SPECIFIC CFU type and prompt** (NOT generic) - see [CFU Specificity](#cfu-specificity-mandatory) |
| `misconceptions_addressed` | array[object] | No | Common student errors and remediation strategies |
| `rubric_guidance` | object | No | For assessment cards: total_points and criteria array |
| `estimated_minutes` | integer | Yes | Realistic timing (1-15 min typical per card) |

### Card Type Enum

- `"starter"`: Activating prior knowledge, warm-up
- `"explainer"`: Teaching new concept, direct instruction
- `"modelling"`: Worked examples, thinking aloud
- `"guided_practice"`: Scaffolded problems with teacher support
- `"independent_practice"`: Student problem-solving with minimal support
- `"exit_ticket"`: Formative assessment, quick check of understanding

### Validation Rules

1. **`card_type` must be valid enum value**
2. **`standards_addressed` must use enriched objects** (if present)
3. **`cfu_strategy` MUST be specific** (NOT generic - see [Forbidden Patterns](#forbidden-patterns))
4. **Card timings**: Sum of all cards' `estimated_minutes` must equal parent entry `estMinutes` (±2 min tolerance)
5. **All required fields must be present**

---

## CFU Specificity (MANDATORY)

**Location**: Each card, `cfu_strategy` field
**Purpose**: Specific Check For Understanding prompt to guide AI tutor
**CRITICAL**: NOT generic phrases, MUST be specific actionable prompts

### ✅ CORRECT - Specific Strategies

```json
"cfu_strategy": "MCQ: Which fraction equals 25%? A) 1/4 B) 1/2 C) 1/3 D) 2/4"

"cfu_strategy": "Numeric: A box costs £12. It's reduced by 1/3. How much is the discount?"

"cfu_strategy": "Structured: (a) Calculate the discount amount when £20 is reduced by 3/5. (b) Calculate the final price after the discount."

"cfu_strategy": "Open-ended: Explain in your own words why 2/4 and 1/2 represent the same amount. Draw a diagram if helpful."

"cfu_strategy": "Comparative: Which is larger, 3/4 or 5/8? Explain how you decided."
```

### ❌ WRONG - Generic Phrases (FAIL VALIDATION)

```json
"cfu_strategy": "ask questions"  // TOO GENERIC

"cfu_strategy": "check understanding"  // TOO GENERIC

"cfu_strategy": "assess knowledge"  // TOO GENERIC

"cfu_strategy": "ask students to respond"  // TOO GENERIC

"cfu_strategy": "test"  // TOO GENERIC

"cfu_strategy": "evaluate student response"  // TOO GENERIC
```

### Why Specific CFU Matters

- Generic phrases don't guide the AI tutor on what question to ask
- Specific prompts enable the AI to know exactly what to present
- Downstream Lesson Author Agent uses cfu_strategy to design card interactions
- Validation catches generic CFU to prevent vague, ineffective lessons

### CFU Strategy Types

1. **MCQ** (Multiple Choice Question): Specific options
2. **Numeric**: Specific calculation with real context
3. **Structured**: Multi-part question with clear steps
4. **Open-ended**: Question inviting explanation
5. **Comparative**: Compare two concepts/solutions
6. **Matching**: Connect concepts
7. **Short answer**: Specific prompt expecting 1-2 sentence response

---

## Misconceptions Addressed

**Location**: Card level (optional but recommended)
**Purpose**: Common student errors and correction strategies

### Structure

```json
{
  "misconceptions_addressed": [
    {
      "misconception": "Numerator must always be smaller than denominator",
      "remediation": "Show examples: 5/4, 7/3. Explain improper fractions as wholes + parts"
    },
    {
      "misconception": "Larger denominator means larger fraction (e.g., 1/8 > 1/2)",
      "remediation": "Use area model: divide circle into halves vs eighths. Shade 1 of each. Visual comparison shows 1/2 > 1/8"
    }
  ]
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `misconception` | string | Common student error or misunderstanding |
| `remediation` | string | Specific strategy to address and correct |

### Validation Rules

- Present for cards addressing common misconceptions (especially in modelling, guided_practice)
- Remediation should be specific, not generic ("explain" or "clarify")

---

## Rubric Guidance

**Location**: Assessment-focused cards (optional)
**Purpose**: Marking criteria for assessment card CFU

### Structure

```json
{
  "rubric_guidance": {
    "total_points": 5,
    "criteria": [
      {
        "description": "Correctly identifies the equivalent fraction",
        "points": 2
      },
      {
        "description": "Shows working or explanation",
        "points": 2
      },
      {
        "description": "Units included in final answer",
        "points": 1
      }
    ]
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_points` | integer | Total marks available |
| `criteria` | array[object] | Array of {description, points} |

---

## Accessibility Profile

**Location**: Each entry
**Purpose**: Dyslexia-friendly and accessibility features

### Structure

```json
{
  "accessibility_profile": {
    "dyslexia_friendly": true,
    "plain_language_level": "CEFR_B1",
    "extra_time": false,
    "key_terms_simplified": ["Numerator = top number", "Denominator = bottom number"],
    "visual_support_strategy": "Use area models and bar diagrams throughout",
    "extra_time_percentage": 0
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dyslexia_friendly` | boolean | Yes | Emphasize dyslexia-friendly design (fonts, spacing, chunking) |
| `plain_language_level` | string | Yes | CEFR_A1 \| CEFR_A2 \| CEFR_B1 \| CEFR_B2 (target reading level) |
| `extra_time` | boolean | Yes | Flag for extended time provision |
| `extra_time_percentage` | integer | No | Percentage additional time (e.g., 50) |
| `key_terms_simplified` | array[string] | No | Academic terms explained in plain language |
| `visual_support_strategy` | string | No | How visual supports are used |

### Validation Rules

- ALL three main fields (`dyslexia_friendly`, `plain_language_level`, `extra_time`) MUST be present
- `plain_language_level` must be valid CEFR code

---

## Enriched References

**Purpose**: How to represent assessment standards throughout SOW
**Critical**: ALWAYS use enriched objects, NEVER bare string codes

### When Enriched Format is Required

1. **Entry-level `assessmentStandardRefs`** (mandatory)
2. **Card-level `standards_addressed`** (mandatory when present)

### Enriched Object Structure

```json
{
  "code": "AS1.2",
  "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
  "outcome": "O1"
}
```

### Validation Rules

1. **MUST be object**, not string or array
2. **`code`** must match Course_data.txt format (e.g., "AS1.2")
3. **`description`** must match Course_data.txt EXACTLY:
   - No abbreviations
   - No paraphrasing
   - Character-for-character match
   - Copy-paste from Course_data.txt to ensure accuracy
4. **`outcome`** must reference valid outcome from Course_data.txt

### Why Enriched Format?

- **For SOW Author**: Ensures accurate SQA descriptions embedded from start
- **For Unified Critic**: Can validate descriptions against Course_data.txt
- **For Lesson Author Agent**: Can generate lessons with exact SQA terminology
- **For downstream consumers**: Complete context without additional lookups

---

## Forbidden Patterns

### Pattern 1: Bare String Assessment Codes

**What NOT to do**:
```json
"assessmentStandardRefs": ["AS1.2", "AS1.3"]
"standards_addressed": ["AS1.2"]
```

**Why it fails**:
- No description context for downstream agents
- Cannot validate against Course_data.txt
- Lesson Author Agent cannot generate accurate content

**Correct approach**:
```json
"assessmentStandardRefs": [
  {
    "code": "AS1.2",
    "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
    "outcome": "O1"
  }
]
```

---

### Pattern 2: Paraphrased Descriptions

**What NOT to do**:
```json
{
  "code": "AS1.2",
  "description": "Add fractions with common denominators",  // WRONG - too short
  "outcome": "O1"
}
```

**Why it fails**:
- Loses important SQA detail
- Validation rejects it (not exact match with Course_data.txt)
- Lesson Author Agent gets incomplete standard definition

**Correct approach**:
```json
{
  "code": "AS1.2",
  "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",  // EXACT from Course_data.txt
  "outcome": "O1"
}
```

---

### Pattern 3: Generic CFU Strategies

**What NOT to do**:
```json
"cfu_strategy": "ask questions"
"cfu_strategy": "check understanding"
"cfu_strategy": "assess knowledge"
"cfu_strategy": "student response"
```

**Why it fails**:
- Doesn't specify what question to ask
- AI tutor has no guidance
- Validation rejects it as too generic

**Correct approach**:
```json
"cfu_strategy": "MCQ: Which fraction equals 25%? A) 1/4 B) 1/2 C) 1/3 D) 2/4"
"cfu_strategy": "Numeric: A box costs £12 and is reduced by 1/3. What's the discount?"
"cfu_strategy": "Structured: (a) Calculate discount (b) Calculate final price when £20 reduced by 3/5"
```

---

### Pattern 4: Incomplete Card Structure

**What NOT to do**:
```json
{
  "card_number": 1,
  "title": "Fractions",
  // Missing: card_type, purpose, pedagogical_approach, cfu_strategy, estimated_minutes
}
```

**Why it fails**:
- Required fields missing
- Validation rejects incomplete structure
- Lesson Author Agent cannot process

**Correct approach**: Include ALL required fields
```json
{
  "card_number": 1,
  "card_type": "explainer",
  "title": "Understanding Fraction Notation",
  "purpose": "Learn what numerator and denominator represent",
  "standards_addressed": [ ... ],
  "pedagogical_approach": "Using area model, explain how fraction bar divides whole into equal parts",
  "cfu_strategy": "MCQ: In 3/7, which number tells us the total parts? A) 3 B) 7",
  "estimated_minutes": 8
}
```

---

### Pattern 5: Card Timings Don't Match

**What NOT to do**:
```json
// Entry estMinutes: 50
// Cards:
{
  "estimated_minutes": 5   // Card 1
},
{
  "estimated_minutes": 5   // Card 2
},
{
  "estimated_minutes": 8   // Card 3
}
// Total: 18 minutes (MISMATCH - should be ~50)
```

**Why it fails**:
- Timings unrealistic for lesson
- Validation rejects mismatch
- Teachers confused about lesson pacing

**Correct approach**: Ensure card timings sum to estMinutes
```json
// Entry estMinutes: 50
// Cards total: 50 minutes (5+8+12+10+15 = 50) ✓
```

---

### Pattern 6: Metadata Arrays Empty

**What NOT to do**:
```json
{
  "metadata": {
    "coherence": {
      "policy_notes": [],      // EMPTY - FAILS
      "sequencing_notes": []   // EMPTY - FAILS
    },
    "accessibility_notes": [],  // EMPTY - FAILS
    "engagement_notes": []      // EMPTY - FAILS
  }
}
```

**Why it fails**:
- No strategic guidance provided
- Validation rejects empty arrays
- Critic cannot assess course coherence

**Correct approach**: Populate with meaningful notes
```json
{
  "metadata": {
    "coherence": {
      "policy_notes": [
        "Units 1-2 non-calculator to build number sense",
        "Units 3-4 mixed calculator introduction"
      ],
      "sequencing_notes": [
        "Fractions → Decimals → Percentages"
      ]
    },
    "accessibility_notes": [
      "Dyslexia-friendly fonts throughout",
      "Key terms pre-taught with visuals"
    ],
    "engagement_notes": [
      "All currency in £ sterling with Scottish shop prices"
    ]
  }
}
```

---

## Validation Rules

### Rule 1: JSON Validity
- MUST be valid JSON (use JSON validator before submission)
- No JavaScript comments
- No trailing commas

### Rule 2: Required Fields
- ALL top-level and entry-level required fields MUST be present
- No optional field skipping without good reason

### Rule 3: Enriched Format Mandatory
- Entry-level `assessmentStandardRefs` MUST use objects
- Card-level `standards_addressed` MUST use objects
- NO bare string codes anywhere

### Rule 4: Description Matching
- Descriptions MUST match Course_data.txt exactly
- Use character-for-character comparison
- Copy-paste from Course_data.txt to ensure accuracy

### Rule 5: CFU Specificity
- MUST be specific actionable prompts
- NOT generic phrases like "ask questions"

### Rule 6: Card Structure
- MUST have 6-12 cards per entry
- All required card fields MUST be present
- Card timings must sum to estMinutes (±2 min tolerance)

### Rule 7: Teach→Revision Pairing
- EVERY teach lesson MUST have corresponding revision lesson
- Revision should immediately follow (or 1-2 lessons after)
- 1:1 ratio throughout course

### Rule 8: Course-Level Requirements
- MUST have at least 1 independent_practice lesson
- MUST have exactly 1 mock_assessment lesson
- Total entry count should be 10-20 (realistic for ~10-week course)

### Rule 9: Scottish Authenticity
- All currency in £ (NOT $, €, etc.)
- All contexts must be Scottish
- NO Americanisms or non-Scottish cultural references

### Rule 10: Field Naming
- Use `lesson_instruction` (NOT "notes")
- Use `card_type` (NOT "type")
- Use `pedagogical_approach` (NOT "description")

---

## Pre-Write Validation Checklist

**BEFORE writing `authored_sow.json`, verify ALL items:**

### Metadata Validation
- [ ] metadata.coherence.policy_notes array is non-empty (2+ items)
- [ ] metadata.coherence.sequencing_notes array is non-empty (1+ items)
- [ ] metadata.accessibility_notes array is non-empty (2+ items)
- [ ] metadata.engagement_notes array is non-empty (2+ items)

### Entry-Level Structure
- [ ] Every entry has ALL required fields: order, label, lesson_type, coherence, policy, engagement_tags, outcomeRefs, assessmentStandardRefs, lesson_plan, accessibility_profile, estMinutes, lesson_instruction
- [ ] Entry order is sequential (1, 2, 3...)
- [ ] Entry count is 10-20 (realistic lesson count)

### Assessment Standard Enrichment
- [ ] Every entry assessmentStandardRefs item is an OBJECT with {code, description, outcome}
- [ ] NO bare strings like ["AS1.2", "AS1.3"]
- [ ] Description for each standard matches Course_data.txt EXACTLY
- [ ] Outcome reference is valid

### Card Structure
- [ ] Every entry has lesson_plan.card_structure array
- [ ] Card array contains 6-12 cards (realistic for 25-50 min lesson)
- [ ] Every card has ALL required fields: card_number, card_type, title, purpose, pedagogical_approach, cfu_strategy, estimated_minutes
- [ ] Every card standards_addressed item is OBJECT with {code, description, outcome}
- [ ] NO bare codes in standards_addressed

### CFU Strategies
- [ ] Every card cfu_strategy is SPECIFIC (NOT "ask questions", "check understanding", etc.)
- [ ] Each cfu_strategy includes actual prompt or question
- [ ] All CFU strategies are appropriate for card_type

### Timing Validation
- [ ] Sum of all card estimated_minutes = entry estMinutes (within ±2 min tolerance)
- [ ] estMinutes values are realistic (25-50 typical for Scottish periods)

### Lesson Type Requirements
- [ ] Teach lesson exists
- [ ] Teach→revision pairing: Every teach lesson has corresponding revision lesson nearby
- [ ] Independent practice lesson exists (at least 1)
- [ ] Mock assessment lesson exists (exactly 1)

### Accessibility & Engagement
- [ ] Every entry accessibility_profile has dyslexia_friendly, plain_language_level, extra_time fields
- [ ] engagement_tags are specific and Scottish
- [ ] At least one engagement tag per entry corresponds to actual card content

### Enrichment & SQA Grounding
- [ ] All assessmentStandardRefs descriptions match Course_data.txt character-for-character
- [ ] All card standards_addressed descriptions match Course_data.txt character-for-character
- [ ] No paraphrasing of official SQA descriptions
- [ ] outcomeRefs are valid codes from Course_data.txt

### Scottish Authenticity
- [ ] All currency shown as £ (NOT $, €, other)
- [ ] All contexts are Scottish (shops, services, cultural references)
- [ ] NO Americanisms or non-Scottish phrasing
- [ ] lesson_instruction uses British English spelling

### Field Naming & Structure
- [ ] All fields use correct names (lesson_instruction NOT notes, card_type NOT type, etc.)
- [ ] No extra/custom fields
- [ ] JSON is valid (no syntax errors)

### Pre-Release
- [ ] Run checklist BEFORE writing file
- [ ] Fix ALL failed items
- [ ] ONLY write file when ALL items pass

---

## Example: Valid SOW Entry

```json
{
  "order": 1,
  "label": "Fractions: Introduction, Notation, and Equivalence",
  "lesson_type": "teach",
  "coherence": {
    "block_name": "Fractions: Fundamentals",
    "block_index": "1.1",
    "prerequisites": ["Place value understanding"]
  },
  "policy": {
    "calculator_section": "non_calc",
    "assessment_notes": "Students should show working for all calculations"
  },
  "engagement_tags": ["shopping", "supermarket_prices", "real_world_contexts"],
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": [
    {
      "code": "AS1.1",
      "description": "Understand where a fraction is positioned on a number line",
      "outcome": "O1"
    },
    {
      "code": "AS1.2",
      "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
      "outcome": "O1"
    }
  ],
  "lesson_plan": {
    "summary": "Students learn fraction notation using real-world contexts (supermarket prices, pizza slices) and develop understanding of equivalent fractions through visual models. Lesson builds from concrete (area models) to abstract (notation).",
    "card_structure": [
      {
        "card_number": 1,
        "card_type": "starter",
        "title": "Real-World Fractions: Where Do We See Them?",
        "purpose": "Activate prior knowledge and show relevance through Scottish contexts",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Understand where a fraction is positioned on a number line",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Display images: pizza slice (1/8), supermarket discounts (1/3 off), bus schedule showing 1/4 hour intervals. Ask students where they see fractions in daily life.",
        "cfu_strategy": "MCQ: A Tesco bag of crisps costs £3 and is 1/4 off. About how much will the discount be? A) £0.50 B) £0.75 C) £1.00",
        "estimated_minutes": 5
      },
      {
        "card_number": 2,
        "card_type": "explainer",
        "title": "Understanding Fraction Notation: Numerator and Denominator",
        "purpose": "Introduce and explain fraction terminology",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Understand where a fraction is positioned on a number line",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Using area model (rectangle divided into parts), explain numerator (shaded parts) and denominator (total parts). Show 3/4 with rectangle divided into 4 equal parts, 3 shaded.",
        "key_concepts": ["Numerator (top) = parts we have", "Denominator (bottom) = total equal parts", "Fraction line = division"],
        "cfu_strategy": "Structured: In the fraction 5/7, (a) What does the 5 represent? (b) What does the 7 represent?",
        "estimated_minutes": 8
      },
      {
        "card_number": 3,
        "card_type": "modelling",
        "title": "Worked Example: Equivalent Fractions Using Area Models",
        "purpose": "Model how to recognize and create equivalent fractions",
        "standards_addressed": [
          {
            "code": "AS1.2",
            "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Draw two rectangles side by side. First divided into 4 parts with 2 shaded (2/4). Second divided into 2 parts with 1 shaded (1/2). Show that shaded area is the same. Explain: 2/4 = 1/2 because we've divided the same whole into more pieces.",
        "worked_example": "A Tesco pizza is cut into 4 equal slices. You eat 2 slices. That's 2/4 of the pizza. But if you divide it into 2 equal halves, you've eaten 1 half. So 2/4 = 1/2. Both describe the same amount!",
        "misconceptions_addressed": [
          {
            "misconception": "2/4 and 1/2 are different because the numbers are different",
            "remediation": "Use visual: two identical pizzas, one cut into 4 pieces, one into 2 pieces. Show that eating 2/4 of pizza A = eating 1/2 of pizza B. Same amount!"
          }
        ],
        "cfu_strategy": "Comparative: Is 3/6 the same as 1/2? Use a diagram to explain your answer.",
        "estimated_minutes": 10
      },
      {
        "card_number": 4,
        "card_type": "guided_practice",
        "title": "Finding Equivalent Fractions",
        "purpose": "Practice finding equivalent fractions with support",
        "standards_addressed": [
          {
            "code": "AS1.2",
            "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Provide fraction problems with visual support (partially drawn diagrams). Students complete the diagram and identify equivalent fraction. Provide guiding questions: 'How many shaded parts?' 'How many total parts?'",
        "practice_problems": [
          "A chocolate bar has 8 squares. You eat 4. What fraction is that? Is it the same as 1/2?",
          "At a Scottish bakery, 6 out of 12 cookies are chocolate chip. What fraction is that in simplest form?",
          "A bus journey is divided into 10 equal stops. The school is at stop 5. What fraction of the journey is that?"
        ],
        "cfu_strategy": "Numeric: If 3/9 of a pizza is eaten, what fraction is that in simplest form? (Hint: think about what number divides both 3 and 9)",
        "estimated_minutes": 12
      },
      {
        "card_number": 5,
        "card_type": "independent_practice",
        "title": "Independent Fraction Practice",
        "purpose": "Demonstrate understanding of fractions without support",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Understand where a fraction is positioned on a number line",
            "outcome": "O1"
          },
          {
            "code": "AS1.2",
            "description": "Add and subtract fractions by expressing them with a common denominator and then operating on the numerators",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Students solve 4-5 fraction problems independently. Problems range from simple (identify fraction from diagram) to complex (find equivalent fractions, place on number line).",
        "practice_problems": [
          "Draw a rectangle. Shade 3/5 of it. What's an equivalent fraction?",
          "On a number line from 0 to 1, place these fractions: 1/4, 2/3, 1/2, 3/4",
          "At Morrisons, 2/6 of the apples are red. What fraction is that in simplest form?",
          "Add: 1/4 + 1/4 = ? (Use a diagram if needed)"
        ],
        "cfu_strategy": "Open-ended: Explain in your own words why 4/6 is the same as 2/3. You can draw a picture.",
        "estimated_minutes": 12
      },
      {
        "card_number": 6,
        "card_type": "exit_ticket",
        "title": "Fractions Check-In: What We Learned Today",
        "purpose": "Quick formative check and consolidation",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Understand where a fraction is positioned on a number line",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "3 quick questions assessing understanding of numerator/denominator and equivalent fractions. Students answer on individual whiteboard or piece of paper.",
        "cfu_strategy": "MCQ: Which fraction is equivalent to 2/8? A) 1/2 B) 1/4 C) 2/4 D) 1/8",
        "rubric_guidance": {
          "total_points": 3,
          "criteria": [
            {
              "description": "Correctly identifies equivalent fractions (2 correct)",
              "points": 2
            },
            {
              "description": "Shows understanding through explanation or diagram",
              "points": 1
            }
          ]
        },
        "estimated_minutes": 3
      }
    ],
    "lesson_flow_summary": "5min starter (activate knowledge) → 8min explainer (terminology) → 10min modelling (worked example) → 12min guided practice (scaffolded) → 12min independent practice (demonstration) → 3min exit ticket (formative check) = 50 min total",
    "multi_standard_integration_strategy": "AS1.1 and AS1.2 are connected through progression: first understand position on number line (AS1.1), then use common denominators to add/subtract (AS1.2). Lesson plants seeds for addition in next lesson.",
    "misconceptions_embedded_in_cards": [
      "Card 3: 'Larger denominator means smaller fraction' - addressed through equal-area visual comparison",
      "Card 3: 'Different numerators always mean different amounts' - addressed through equivalent fractions using area model",
      "Card 4: 'Simplest form only has prime numbers' - addressed through guiding questions about common factors"
    ],
    "assessment_progression": "Starter checks prior knowledge (informal). Cards 3-4 use formative CFU (check understanding). Card 5 independent practice shows mastery. Card 6 exit ticket consolidates and prepares for next lesson."
  },
  "accessibility_profile": {
    "dyslexia_friendly": true,
    "plain_language_level": "CEFR_B1",
    "extra_time": false,
    "key_terms_simplified": [
      "Numerator = the number on top (how many parts)",
      "Denominator = the number on bottom (total parts)",
      "Equivalent = the same value or amount"
    ],
    "visual_support_strategy": "Every conceptual point uses area models or diagrams. Visual aids remain on screen/board throughout lesson for reference."
  },
  "estMinutes": 50,
  "lesson_instruction": "This lesson introduces fractions through real-world Scottish contexts (pizza, supermarket pricing, bus journeys). Students progress from concrete visual models (area diagrams) to abstract notation. All examples use £ currency and Scottish shops. Key to success: ensure all students understand that equivalent fractions represent the same quantity (2/4 = 1/2) before moving to addition in next lesson. For students needing extra support: stay longer on Card 3 modelling, use additional area models. For advanced students: introduce slightly larger numbers (12ths, 20ths) in Card 5."
}
```

---

## Summary

This schema defines a complete, valid SOW structure for the Scottish AI Lessons authoring pipeline. The critical principles are:

1. **Enriched format mandatory** - Objects, not bare codes
2. **Exact SQA grounding** - Descriptions match Course_data.txt exactly
3. **Specific CFU strategies** - Actionable prompts, not generic phrases
4. **Detailed lesson plans** - 6-12 cards with complete pedagogical content
5. **Scottish authenticity** - Currency, contexts, terminology
6. **Comprehensive validation** - Pre-write checklist catches issues before submission

Follow this schema precisely. Violations will be caught by schema_critic and returned for revision.

---

**Questions or clarifications?** Reference this document during authoring.
