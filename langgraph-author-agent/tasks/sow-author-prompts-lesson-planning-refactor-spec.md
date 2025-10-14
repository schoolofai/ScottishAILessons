# SoW Author Prompts Refactor: Lesson Planning Integration

**Created**: 2025-10-13
**Status**: Draft - Awaiting Approval
**Related Files**:
- `src/sow_author_prompts.py` (1610 lines)
- `src/sow_author_agent.py`
- `tasks/sow_prompt_refactor_part_2.md` (completed refactor removing enrichment awareness)

---

## Executive Summary

This specification refactors the SoW Author prompts to shift focus from administrative metadata management to **pedagogical lesson planning**. The current system generates lesson entries with basic metadata but lacks detailed lesson plans that the Lesson Author Agent needs to generate high-quality lesson templates.

### Current Issues

1. **Minimal Pedagogical Guidance**: `lesson_author_guidance` field is shallow (5 sub-fields provide minimal actionable guidance)
2. **Missing Lesson Plans**: No detailed lesson structure or card-by-card planning at SoW level
3. **Redundant Metadata**: Excessive focus on administrative fields (timestamps, versions, IDs) instead of educational content
4. **Superfluous Fields**: Many prompt sections describe technical boilerplate rather than pedagogical decisions
5. **Weak Critic Validation**: Unified critic doesn't deeply assess lesson plan quality or completeness

### Proposed Solution

**Transform SoW entries from administrative manifests into actionable lesson plans** by:

1. **Expanding lesson_author_guidance** → **lesson_plan** with detailed card-by-card structure
2. **Removing superfluous administrative fields** from prompts (seeding script handles these)
3. **Enhancing unified critic** to validate lesson plan completeness and pedagogical soundness
4. **Aligning with downstream consumption** by Lesson Author Agent

**CRITICAL REQUIREMENT**: All `standards_addressed` fields in lesson plan cards must use **enriched objects** (code + description + outcome), NOT bare codes:

```json
// ✅ CORRECT - Enriched objects
"standards_addressed": [
  {
    "code": "AS1.2",
    "description": "Calculate a percentage of a quantity in practical contexts",
    "outcome": "O1"
  }
]

// ❌ INCORRECT - Bare codes (no value to Lesson Author)
"standards_addressed": ["AS1.2"]
```

**Rationale**: Lesson Author Agent needs full assessment standard descriptions to:
- Understand what skills/knowledge to assess in CFU questions
- Generate appropriate rubric criteria aligned to standard descriptions
- Design scaffolding that addresses the specific standard requirements
- Create misconception remediations tied to standard expectations

---

## Goals

### Primary Goals

1. **Rich Lesson Plans**: Each SoW entry contains a detailed, card-level lesson plan ready for Lesson Author Agent consumption
2. **Pedagogical Focus**: Prompts emphasize educational design decisions, not administrative metadata
3. **Critic-Driven Quality**: Unified critic validates lesson plan completeness against chunked standards
4. **Reduced Prompt Complexity**: Remove ~200 lines of superfluous administrative field descriptions

### Success Metrics

- ✅ **Lesson plan coverage**: Every SoW entry has 6-12 planned cards with clear pedagogical purpose
- ✅ **Standard integration**: Lesson plans explicitly map cards to assessment standards (for chunked lessons)
- ✅ **Critic validation**: Unified critic checks lesson plan completeness as primary coverage dimension
- ✅ **Reduced prompt size**: Remove 15-20% of current prompt content (administrative bloat)
- ✅ **Downstream clarity**: Lesson Author Agent receives actionable plans, not vague guidance

---

## Problem Analysis

### Issue 1: Shallow `lesson_author_guidance`

**Current Structure** (5 sub-fields):
```json
{
  "lesson_author_guidance": {
    "card_count_target": "6-8 cards: starter, explainer, modelling...",
    "pedagogical_approach": "Introduce financial numeracy through Scottish shopping contexts",
    "multi_standard_integration": "Use unified shopping context: AS1.1 notation → AS1.2 calculations",
    "assessment_focus": "Primary: AS1.2 (calculations). Secondary: AS1.1 (notation)",
    "misconceptions_to_address": ["Confusing % symbol with division by 100"]
  }
}
```

**Problems**:
- Generic card count without specific structure
- Vague pedagogical approach (what exactly happens in each card?)
- No explicit card-to-standard mapping
- Misconceptions listed but not integrated into lesson flow
- No CFU strategies or rubric guidance per card

**Impact**:
- Lesson Author Agent must "guess" how to structure the lesson
- Inconsistent interpretation of chunked standards across lesson types
- No clear scaffold for teach → practice → assessment progression

---

### Issue 2: Administrative Field Overload

**Current Prompt Sections Describing Administrative Fields** (~300 lines):

1. **Lines 116-125**: `<outputs>` section describing optional metadata fields
   - `$id`, `version`, `status`, `timestamps`, `lessonTemplateRef`, `courseId`
   - **Problem**: LLM doesn't generate these; seeding script adds them

2. **Lines 286-351**: `<schema_sow_with_field_descriptions>` with verbose field descriptions
   - Includes administrative fields the LLM shouldn't worry about
   - **Problem**: Bloats prompt with irrelevant technical details

3. **Lines 270-283**: `<constraints>` section listing optional/required fields
   - **Problem**: Mixes pedagogical requirements with technical field management

**Impact**:
- Prompt complexity distracts from core pedagogical task
- LLM may waste tokens on administrative decisions instead of lesson planning
- Maintenance burden when seeding script changes metadata handling

---

### Issue 3: Weak Critic Validation of Lesson Plans

**Current Unified Critic** (lines 365-645):

**Coverage Dimension** (lines 443-479):
- Checks if standards are "covered" (present in entries)
- **Missing**: Does NOT validate if lesson plan adequately addresses each standard
- **Missing**: Does NOT check if card structure supports multi-standard integration

**Example Gap**:
```json
// Current validation: ✅ AS1.2 appears in entry
// Missing validation: ❌ Are there 2-3 cards specifically scaffolding AS1.2?
//                     ❌ Does the lesson plan show how AS1.1 + AS1.2 connect?
```

**Impact**:
- SoW passes critic but has shallow lesson plans
- Lesson Author Agent receives insufficient guidance
- Standards are "mentioned" but not pedagogically structured

---

## Proposed Changes

### Change 1: Transform `lesson_author_guidance` → `lesson_plan`

**New Structure** (detailed card-level plan):

```json
{
  "lesson_plan": {
    "summary": "Introduce percentage concepts through Scottish shopping contexts, consolidating AS1.1 (notation) and AS1.2 (calculations) via authentic supermarket scenarios",

    "card_structure": [
      {
        "card_number": 1,
        "card_type": "starter",
        "title": "What is a Percentage?",
        "purpose": "Activate prior knowledge of fractions and connect to percentage notation",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Visual representation of percentages as parts of 100 using Scottish currency (£100 note analogy)",
        "cfu_strategy": "Quick MCQ: Which represents 25%? (Options with visual grids)",
        "estimated_minutes": 5,
        "accessibility_notes": "Use visual grids for dyslexia-friendly pattern recognition"
      },
      {
        "card_number": 2,
        "card_type": "explainer",
        "title": "Percentage Notation and Symbols",
        "purpose": "Establish formal notation for percentages and relationship to fractions/decimals",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Explicit teaching of % symbol, conversion rules, and Scottish context examples (25% off at Tesco)",
        "key_concepts": [
          "% symbol means 'per hundred'",
          "25% = 25/100 = 0.25",
          "Scottish shopping contexts (discounts, VAT)"
        ],
        "cfu_strategy": "Convert between forms: 30% = __ /100 = __",
        "estimated_minutes": 8,
        "accessibility_notes": "Plain language explanation at CEFR B1 level"
      },
      {
        "card_number": 3,
        "card_type": "modelling",
        "title": "Worked Example: Supermarket Discount",
        "purpose": "Model percentage calculations in authentic Scottish context",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
          },
          {
            "code": "AS1.2",
            "description": "Calculate a percentage of a quantity in practical contexts",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Think-aloud demonstration of calculating 20% off £45 jacket at Next",
        "worked_example": "Original price: £45, Discount: 20%, Calculation: 20% of £45 = (20/100) × £45 = £9, Final price: £45 - £9 = £36",
        "misconceptions_addressed": [
          {
            "misconception": "Students may calculate 20 × 45 instead of (20/100) × 45",
            "remediation": "Emphasize % always means divide by 100 first"
          }
        ],
        "cfu_strategy": "Pause at each step: 'What operation comes next?'",
        "estimated_minutes": 10,
        "accessibility_notes": "Step-by-step breakdown with visual workings"
      },
      {
        "card_number": 4,
        "card_type": "guided_practice",
        "title": "Your Turn: Calculate Discounts",
        "purpose": "Scaffold student practice with immediate feedback",
        "standards_addressed": [
          {
            "code": "AS1.2",
            "description": "Calculate a percentage of a quantity in practical contexts",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "3 practice problems with increasing complexity, Scottish contexts (Asda, Boots, Primark)",
        "practice_problems": [
          "Easy: 10% off £20 at Asda",
          "Medium: 15% off £32 at Boots",
          "Hard: 22% off £58 at Primark"
        ],
        "cfu_strategy": "Structured question with rubric (2 marks: correct calculation, 1 mark: correct notation)",
        "rubric_guidance": {
          "total_points": 2,
          "criteria": [
            {"description": "Correct calculation method shown", "points": 2},
            {"description": "Notation error only (calc correct)", "points": 1}
          ]
        },
        "estimated_minutes": 12,
        "accessibility_notes": "Calculator allowed (policy: calc section), extra time provision"
      },
      {
        "card_number": 5,
        "card_type": "independent_practice",
        "title": "Real-World Shopping Challenge",
        "purpose": "Apply skills independently with authentic Scottish scenarios",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
          },
          {
            "code": "AS1.2",
            "description": "Calculate a percentage of a quantity in practical contexts",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "Multi-step problem requiring notation interpretation AND calculation",
        "assessment_focus": "Primary: AS1.2 (calculation accuracy), Secondary: AS1.1 (correct notation)",
        "cfu_strategy": "Open-ended: 'A £75 coat is reduced by 30%. What is the sale price? Show all working.'",
        "rubric_guidance": {
          "total_points": 4,
          "criteria": [
            {"description": "Correct percentage calculation (30% of £75)", "points": 2},
            {"description": "Correct final answer (£75 - £22.50 = £52.50)", "points": 1},
            {"description": "Clear working shown with notation", "points": 1}
          ]
        },
        "estimated_minutes": 10,
        "accessibility_notes": "Plain language stem, dyslexia-friendly formatting"
      },
      {
        "card_number": 6,
        "card_type": "exit_ticket",
        "title": "Quick Check: Percentages",
        "purpose": "Formative assessment of key learning outcomes",
        "standards_addressed": [
          {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
          },
          {
            "code": "AS1.2",
            "description": "Calculate a percentage of a quantity in practical contexts",
            "outcome": "O1"
          }
        ],
        "pedagogical_approach": "2-question rapid check (notation + calculation)",
        "cfu_strategy": "Q1: Convert 35% to decimal. Q2: Calculate 15% of £80.",
        "success_criteria": "Both correct = ready to progress. One incorrect = intervention needed.",
        "estimated_minutes": 5,
        "accessibility_notes": "Minimal cognitive load, clear success criteria"
      }
    ],

    "lesson_flow_summary": "5min starter → 8min explainer → 10min modelling → 12min guided → 10min independent → 5min exit = 50 minutes (typical Scottish period)",

    "multi_standard_integration_strategy": "Use unified shopping context throughout all 6 cards, progressively building from notation (AS1.1, cards 1-2) to calculation (AS1.2, cards 3-6) while maintaining Scottish authenticity",

    "misconceptions_embedded_in_cards": [
      "Card 3 addresses: confusing 20 × 45 vs (20/100) × 45",
      "Card 4 rubric catches: notation errors vs calculation errors",
      "Card 5 requires working shown to diagnose misconceptions"
    ],

    "assessment_progression": "Formative CFU throughout (cards 2, 3, 4), summative practice (card 5), exit ticket (card 6) - aligns with lesson_type: teach",

    "accessibility_integration": "All cards specify plain language (CEFR B1), dyslexia-friendly formatting, visual scaffolds, calculator policy clear (cards 4-6 allow calculators)"
  }
}
```

**Benefits**:
1. **Actionable for Lesson Author**: Clear card-by-card blueprint
2. **Explicit Standard Mapping**: Each card lists which standards it addresses
3. **Pedagogical Transparency**: Purpose, approach, and CFU strategy explicit
4. **Misconception Integration**: Not just listed, but embedded in specific cards
5. **Time-Realistic**: Estimated minutes per card sum to typical Scottish period (50 min)
6. **Critic-Validatable**: Unified critic can check if card_structure adequately covers all chunked standards

---

### Change 2: Remove Superfluous Administrative Field Descriptions

**Current Bloat** (~250 lines to remove):

#### Section 2.1: `<outputs>` Administrative Noise (lines 116-125)

**REMOVE**:
```xml
  * Top-level OPTIONAL: courseId, $id, version, status, timestamps (can be omitted - seeding script will add)
  * Entry-level OPTIONAL: lessonTemplateRef (can be omitted - seeding script will add)
```

**REPLACE WITH**:
```xml
  * Focus: Pedagogical content (lesson plans, coherence, accessibility)
  * Metadata: Omit technical fields - seeding script handles courseId, IDs, timestamps
```

#### Section 2.2: Schema Administrative Fields (lines 286-351)

**Current Schema Includes**:
- `$id: "string, optional - can be omitted"`
- `version: "int, optional"`
- `status: "string, optional"`
- `timestamps: "optional"`
- `lessonTemplateRef: "optional"`

**REMOVE** all these from schema description.

**ADD** instead:
```xml
<schema_focus>
This schema describes ONLY pedagogical fields you must generate:
- metadata: SoW-level coherence, accessibility, engagement strategies
- entries[]: lesson plans with detailed card structures

Technical fields ($id, version, status, timestamps, lessonTemplateRef) are omitted - seeding script adds these.
</schema_focus>
```

#### Section 2.3: Constraints Administrative Management (lines 270-283)

**REMOVE**:
```xml
- **Optional fields**: You may omit or include: courseId, $id, version, status, timestamps, lessonTemplateRef.
```

**REPLACE WITH**:
```xml
- **Focus on pedagogy**: Generate detailed lesson_plan structures, not administrative metadata.
```

**Lines Saved**: ~200-250 lines of administrative cruft removed

---

### Change 3: Enhance Unified Critic to Validate Lesson Plans

**Current Coverage Dimension** (lines 443-479) validates:
- ✅ All standards appear in entries
- ❌ Does NOT validate lesson plan depth

**Proposed Enhanced Coverage Validation**:

```xml
<dimension_1_coverage_enhanced>
## Dimension 1: Coverage (Threshold ≥0.90)

**Purpose**: Evaluate breadth AND DEPTH of coverage for all official SQA standards.

**Criteria**:
- Does the SoW cover ALL official units/outcomes/standards from Course_data.txt?
- **CHUNKING ACCEPTANCE**: Accept 2-3 (or up to 5) standards consolidated into unified lessons.
- For each consolidated lesson block:
  * Is there a **multi-lesson sequence** (teach → formative → practice → revision)?
  * Does EACH entry have a **detailed lesson_plan** with card_structure?
  * **LESSON PLAN DEPTH CHECK**:
    - Are there 6-12 cards planned per lesson (appropriate for 25-50 min period)?
    - Does each card explicitly list which standards it addresses?
    - For chunked lessons, do cards progressively scaffold ALL consolidated standards?
    - Are CFU strategies specified per card?
    - Are misconceptions embedded in specific cards, not just listed generically?
    - Is card timing realistic (summing to estMinutes)?

**Process**:
1) Check coverage of ALL units, outcomes, standards (accepting chunking)
2) For each consolidated lesson block, confirm lesson sequence exists
3) **NEW**: For EACH entry in the block:
   - Extract lesson_plan.card_structure array
   - Count cards (must be 6-12 for realistic lesson)
   - For each card:
     * Verify standards_addressed field present and lists specific codes
     * Verify pedagogical_approach is detailed, not generic
     * Verify cfu_strategy is specific (not "ask questions")
     * Check misconceptions_addressed if relevant card type
   - Aggregate standards_addressed across all cards in lesson_plan
   - Compare to entry's assessmentStandardRefs: all standards must appear in at least 2-3 cards
4) Validate enriched assessmentStandardRefs format
5) Check breadth: major themes from research pack represented
6) Check quantity: ~10-20 lessons (not 80-100)
7) Check balance: lesson_type cadence is varied

**Issues to Flag**:
- Missing units, outcomes, or assessment standards
- Incomplete lesson sequences for consolidated blocks
- **NEW**: Shallow lesson plans (< 6 cards, generic approaches, missing CFU strategies)
- **NEW**: Poor standard mapping (cards don't address all consolidated standards)
- **NEW**: Unrealistic timing (cards sum to 15min for a 50min lesson)
- **NEW**: Generic misconception handling (listed but not embedded in cards)
- Bare string codes instead of enriched objects
- Insufficient lesson count or imbalanced lesson types

**Scoring**:
- Perfect (1.0): All standards covered, all lesson plans detailed with 6-12 cards, explicit standard mapping
- Excellent (0.95): Minor gaps (e.g., 1-2 cards lack CFU strategies)
- Good (0.90): All standards covered, lesson plans present but some lack detail
- **FAIL** (<0.90): Missing standards OR lesson plans too shallow (< 6 cards per entry)
</dimension_1_coverage_enhanced>
```

**Impact**: Critic now validates lesson plan QUALITY, not just presence of standards.

---

### Change 4: Update `<process>` Workflow (lines 202-254)

**Current Step 7** (line 226-229):
```xml
7) **Generate lesson_author_guidance**:
   - For each entry, draft concrete pedagogical strategies using research pack patterns
   - Specify all 5 required sub-fields: card_count_target, pedagogical_approach, multi_standard_integration, assessment_focus, misconceptions_to_address
```

**REPLACE WITH**:
```xml
7) **Generate detailed lesson_plan for each entry**:
   - Design 6-12 cards per lesson (appropriate for 25-50 min Scottish periods)
   - For EACH card, specify:
     * card_number, card_type (starter, explainer, modelling, guided_practice, independent_practice, exit_ticket)
     * title (clear, teacher-facing card name)
     * purpose (pedagogical goal for this card)
     * standards_addressed (explicit codes from assessmentStandardRefs)
     * pedagogical_approach (what happens in this card - detailed)
     * cfu_strategy (specific CFU type and prompt)
     * estimated_minutes (realistic timing)
     * accessibility_notes (dyslexia-friendly, plain language considerations)
   - For cards addressing misconceptions, include misconceptions_addressed array with misconception + remediation
   - For cards with assessment focus, include rubric_guidance (total_points, criteria)
   - Ensure card timings sum to entry's estMinutes
   - Ensure ALL assessmentStandardRefs appear in at least 2-3 cards (progressive scaffolding)
   - Use research pack pedagogical_patterns for card design (lesson_starters, cfu_variety_examples, misconceptions)
   - Maintain Scottish contexts throughout card sequence (engagement_tags inform card contexts)
```

**Current Step 8** (lines 230-246):
```xml
8) **Draft the complete SoW JSON directly**:
   ...
   - Make pedagogical decisions for each lesson:
     * lesson_type (teach, practice, assessment, revision)
     * label (clear, teacher-facing title indicating all covered standards)
     * policy (calculator usage, assessment notes)
     * coherence (block_name, block_index, prerequisites)
     * engagement_tags (authentic Scottish contexts)
     * lesson_author_guidance (all 5 required sub-fields)
     * pedagogical_blocks (REQUIRED)
   ...
```

**REPLACE** `lesson_author_guidance` bullet WITH:
```xml
     * lesson_plan (detailed card_structure with 6-12 cards as described in step 7)
```

**REMOVE** `pedagogical_blocks (REQUIRED)` bullet (redundant - card_structure provides this).

---

## Implementation Plan

### Phase 1: Update Schema and Prompts (Days 1-2)

#### Task 1.1: Update `<schema_sow_with_field_descriptions>` (lines 286-351)

**Current**:
```json
{
  "metadata": { ... },
  "entries": [
    {
      "order": "int, REQUIRED",
      "label": "string, REQUIRED",
      "lesson_author_guidance": {
        "card_count_target": "...",
        "pedagogical_approach": "...",
        ...
      },
      ...
    }
  ]
}
```

**REPLACE** `lesson_author_guidance` section WITH:

```json
{
  "lesson_plan": {
    "summary": "string, REQUIRED - 2-3 sentence overview of lesson pedagogical arc",
    "card_structure": [
      {
        "card_number": "int, REQUIRED - sequential position (1, 2, 3...)",
        "card_type": "string, REQUIRED - starter | explainer | modelling | guided_practice | independent_practice | exit_ticket",
        "title": "string, REQUIRED - clear, teacher-facing card title",
        "purpose": "string, REQUIRED - pedagogical goal for this card",
        "standards_addressed": [
          "array of enriched objects, REQUIRED - which assessmentStandardRefs this card scaffolds",
          "Format: [{'code': 'AS1.2', 'description': 'Calculate percentage of quantity...', 'outcome': 'O1'}]",
          "CRITICAL: Use enriched objects (code + description + outcome), NOT bare codes like ['AS1.2']",
          "Rationale: Lesson Author needs full descriptions to understand assessment criteria when generating lesson cards"
        ],
        "pedagogical_approach": "string, REQUIRED - detailed description of what happens in this card",
        "key_concepts": ["array, optional - for explainer cards, list 3-5 key concepts"],
        "worked_example": "string, optional - for modelling cards, detailed worked example with Scottish context",
        "practice_problems": ["array, optional - for guided_practice cards, 2-4 problems with increasing complexity"],
        "cfu_strategy": "string, REQUIRED - specific CFU type and prompt (e.g., 'MCQ: Which fraction equals 25%?')",
        "misconceptions_addressed": [
          {
            "misconception": "string, common student error",
            "remediation": "string, correction strategy"
          }
        ],
        "rubric_guidance": {
          "total_points": "int, total marks for this card's CFU",
          "criteria": [
            {"description": "string, criterion", "points": "int, marks"}
          ]
        },
        "assessment_focus": "string, optional - for cards addressing multiple standards, which is primary vs secondary",
        "estimated_minutes": "int, REQUIRED - realistic timing for this card (1-15 minutes typical)",
        "accessibility_notes": "string, REQUIRED - dyslexia-friendly, plain language, visual scaffold notes"
      }
    ],
    "lesson_flow_summary": "string, REQUIRED - timeline showing card sequence and cumulative timing",
    "multi_standard_integration_strategy": "string, REQUIRED (for chunked lessons) - how multiple standards connect across cards",
    "misconceptions_embedded_in_cards": ["array, REQUIRED - list which cards address which misconceptions"],
    "assessment_progression": "string, REQUIRED - how assessment builds from formative CFU to summative practice",
    "accessibility_integration": "string, REQUIRED - how accessibility provisions appear across all cards"
  }
}
```

**REMOVE** from schema:
- `pedagogical_blocks` field (replaced by card_structure)
- All administrative field descriptions (`$id`, `version`, `status`, `timestamps`, `lessonTemplateRef`)

#### Task 1.2: Update `<outputs>` Section (lines 116-125)

**REPLACE**:
```xml
<outputs>
You MUST write these flat files (state["files"]["<name>"] = <json/string>):
- `authored_sow_json`: Complete SoW with pedagogical content and metadata.
  * REQUIRED: metadata (coherence, accessibility_notes, engagement_notes), entries[]
  * Each entry REQUIRED: order, label, lesson_type, coherence, policy, engagement_tags, outcomeRefs, assessmentStandardRefs (enriched objects), lesson_plan (detailed card_structure with 6-12 cards), accessibility_profile, estMinutes, lesson_instruction
  * Metadata fields: Omit technical fields - seeding script handles courseId, IDs, timestamps, lessonTemplateRef
- `sow_critic_result_json`: Written by Unified Critic (comprehensive validation across all dimensions, including lesson plan depth).
- `sow_todos_json` (optional): Outstanding items if unified critic does not pass.
</outputs>
```

#### Task 1.3: Update `<process>` Workflow (lines 202-254)

Implement changes described in **Change 4** above.

#### Task 1.4: Update `<constraints>` Section (lines 265-284)

**REPLACE**:
```xml
<constraints>
- Always ground decisions in research pack (exemplars, contexts, policies, misconceptions) and `Course_data.txt`.
- **CHUNKING STRATEGY**: Group 2-3 related standards into thematically coherent lessons (maximum 5 if justified).
- **For each consolidated lesson block, create a multi-lesson sequence** covering required lesson types.
- **ENRICHMENT MANDATORY**: Transform assessmentStandardRefs from bare codes into enriched objects.
- **LESSON PLAN MANDATORY**: Every entry must have detailed lesson_plan with:
  * 6-12 cards in card_structure (appropriate for 25-50 min Scottish periods)
  * Each card specifies: card_number, card_type, title, purpose, standards_addressed, pedagogical_approach, cfu_strategy, estimated_minutes, accessibility_notes
  * Cards with misconceptions include misconceptions_addressed array
  * Cards with assessment include rubric_guidance
  * Card timings sum to entry's estMinutes
  * ALL assessmentStandardRefs appear in at least 2-3 cards (progressive scaffolding)
- **Focus on pedagogical design**: Detailed card-by-card lesson structure, not administrative metadata.
- **CRITICAL: Sequential ordering** - Always set `order` field (1, 2, 3...) to establish lesson sequence.
- **Use official data** - Extract full SQA descriptions from Course_data.txt for enrichment.
- **Required fields**: metadata, entries with order, label, lesson_type, coherence, policy, engagement_tags, outcomeRefs, assessmentStandardRefs (enriched objects), lesson_plan (detailed card_structure), accessibility_profile, estMinutes, lesson_instruction.
- **Field naming**: Use lesson_instruction for teacher guidance about the overall lesson context.
- Write valid JSON only (no comments or self-references).
</constraints>
```

#### Task 1.5: Update `<quality_tips>` Section (lines 353-362)

**REPLACE**:
```xml
<quality_tips>
- Apply **chunking strategy**: Group 2-3 related standards into thematically coherent lessons.
- For **each consolidated lesson block**, create a multi-lesson sequence: teach → formative → practice → revision.
- **Enrich assessmentStandardRefs**: Use objects with code, description (from Course_data.txt), outcome reference.
- **Generate detailed lesson_plan**:
  * Design 6-12 cards per lesson with clear pedagogical progression
  * Explicitly map cards to standards (use standards_addressed field)
  * Embed misconceptions in specific cards, not just listed generically
  * Specify CFU strategies per card (MCQ, structured question, etc.)
  * Include rubric guidance for assessment-focused cards
  * Ensure card timings realistic and sum to estMinutes
- Use `policy.calculator_section` to stage calculator progression.
- Keep `coherence.block_index` ascending and transparent.
- Write clear `lesson_instruction` detailing overall lesson context (NOT card-by-card - that's in lesson_plan).
- Align card contexts to Scottish authenticity (engagement_tags inform card scenarios).
- Use research pack pedagogical_patterns to design varied card types (lesson_starters, cfu_variety_examples, misconceptions).
</quality_tips>
```

---

### Phase 2: Update Unified Critic Prompts (Days 3-4)

#### Task 2.1: Enhance Coverage Dimension (lines 443-479)

Implement **Change 3** (Enhanced Coverage Validation) as detailed above.

#### Task 2.2: Update Accessibility Dimension (lines 562-600)

**ADD** to accessibility validation:

```xml
- **LESSON PLAN ACCESSIBILITY CHECK**:
  * For each entry, verify ALL cards in lesson_plan.card_structure have accessibility_notes field
  * Check accessibility_notes are specific (not generic "plain language" - describe WHAT makes it accessible)
  * Verify lesson_plan.accessibility_integration summarizes how accessibility provisions span all cards
  * For dyslexia_friendly=true entries, check cards use visual scaffolds, clear formatting cues
```

#### Task 2.3: Update Authenticity Dimension (lines 607-645)

**ADD** to authenticity validation:

```xml
- **LESSON PLAN SCOTTISH CONTEXT CHECK**:
  * For cards with worked_example or practice_problems, verify Scottish contexts (£, local shops, NHS)
  * Check lesson_plan.multi_standard_integration_strategy mentions authentic Scottish scenarios
  * Verify card titles and purposes use CfE/SQA terminology
```

---

### Phase 3: Update Secondary Prompt (SOW_AUTHOR_SUBAGENT_PROMPT) (Day 5)

**Note**: `SOW_AUTHOR_SUBAGENT_PROMPT` (lines 685-1018) is deprecated but still in codebase for backward compatibility.

#### Task 3.1: Apply Same Changes to Deprecated Prompt

- Update schema (lines 959-1003) with lesson_plan structure
- Update workflow (lines 853-922) with lesson plan generation steps
- Update constraints (lines 1004-1018) with lesson plan requirements

**Rationale**: Even though deprecated, it may be in use in fallback scenarios.

---

### Phase 4: Update Deprecated Individual Critic Prompts (Day 6)

**Note**: Lines 1020-1610 contain deprecated individual critic prompts (Coverage, Sequencing, Policy, Accessibility, Authenticity critics) - replaced by unified critic but still in codebase.

#### Task 4.1: Update Deprecated Critics (Optional - Low Priority)

Since these are deprecated and unified_critic is the active system, we can:

**Option A**: Add deprecation warnings and skip updates
```python
SOW_COVERAGE_CRITIC_PROMPT = """# DEPRECATED: Use SOW_UNIFIED_CRITIC_PROMPT instead
# This prompt is not maintained and may produce inconsistent results.
# The unified critic (SOW_UNIFIED_CRITIC_PROMPT) provides comprehensive validation.
...
"""
```

**Option B**: Apply lesson_plan validation changes to all 5 critics for completeness

**Recommendation**: Option A (add warnings, skip updates) - reduces implementation burden.

---

### Phase 5: Update State Schema (Day 7)

#### Task 5.1: Review `sow_author_state.py`

Check if state schema needs updates to support lesson_plan validation in critic.

**Expected**: No changes needed (state uses dict for files, lesson_plan is just a new JSON field).

---

### Phase 6: Update Seeding Script Documentation (Day 8)

#### Task 6.1: Update `sow-seeding-enrichment-spec.md`

**ADD** section documenting that seeding script:
- Does NOT modify lesson_plan field (passes through unchanged)
- Validates lesson_plan structure (card_structure present, cards have required fields)
- Can optionally log warnings if lesson_plan appears shallow (< 6 cards)

**Rationale**: Seeding script should validate but not mutate pedagogical content.

---

## Pseudocode Examples

### Example 1: SoW Author Generating Lesson Plan

```python
# In SOW_UNIFIED_AGENT_PROMPT workflow, step 7:

# For each SoW entry (e.g., "Percentages in Context" covering AS1.1 + AS1.2):

lesson_plan = {
    "summary": "Introduce percentage concepts through Scottish shopping contexts, consolidating AS1.1 (notation) and AS1.2 (calculations)",

    "card_structure": []
}

# Generate 6-12 cards based on:
# - lesson_type (teach → 6-8 cards, formative_assessment → 4-6 cards)
# - estMinutes (50 min → can fit ~10 cards at 5 min each)
# - assessmentStandardRefs (AS1.1 + AS1.2 → need 2-3 cards for each)

# Card 1: Starter (AS1.1 focus)
lesson_plan["card_structure"].append({
    "card_number": 1,
    "card_type": "starter",
    "title": "What is a Percentage?",
    "purpose": "Activate prior knowledge of fractions, connect to percentage notation",
    "standards_addressed": [
        {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
        }
    ],  # CRITICAL: Enriched objects, NOT bare codes
    "pedagogical_approach": "Visual representation using £100 note analogy (Scottish currency)",
    "cfu_strategy": "MCQ: Which grid represents 25%? (4 visual options)",
    "estimated_minutes": 5,
    "accessibility_notes": "Dyslexia-friendly visual grids, minimal text"
})

# Card 2: Explainer (AS1.1 deep dive)
lesson_plan["card_structure"].append({
    "card_number": 2,
    "card_type": "explainer",
    "title": "Percentage Notation: % Symbol",
    "purpose": "Establish formal notation and conversion rules",
    "standards_addressed": [
        {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
        }
    ],
    "pedagogical_approach": "Explicit teaching: % = per hundred, 25% = 25/100 = 0.25",
    "key_concepts": [
        "% symbol means 'per hundred'",
        "Conversion: % ↔ fraction ↔ decimal",
        "Scottish context: 20% VAT, 10% off at Tesco"
    ],
    "cfu_strategy": "Fill in the blank: 30% = __/100 = __ (decimal)",
    "estimated_minutes": 8,
    "accessibility_notes": "Plain language at CEFR B1, step-by-step examples"
})

# Card 3: Modelling (AS1.1 + AS1.2 integration starts)
lesson_plan["card_structure"].append({
    "card_number": 3,
    "card_type": "modelling",
    "title": "Worked Example: Supermarket Discount",
    "purpose": "Model percentage calculation with think-aloud",
    "standards_addressed": [
        {
            "code": "AS1.1",
            "description": "Use percentage notation: understand percentages as parts per hundred",
            "outcome": "O1"
        },
        {
            "code": "AS1.2",
            "description": "Calculate a percentage of a quantity in practical contexts",
            "outcome": "O1"
        }
    ],
    "pedagogical_approach": "Teacher models: 20% off £45 jacket at Next",
    "worked_example": "Step 1: 20% = 20/100 (AS1.1 notation). Step 2: (20/100) × £45 = £9 (AS1.2 calculation). Step 3: £45 - £9 = £36 final price.",
    "misconceptions_addressed": [
        {
            "misconception": "Students calculate 20 × 45 instead of (20/100) × 45",
            "remediation": "Emphasize: % ALWAYS means divide by 100 first"
        }
    ],
    "cfu_strategy": "Pause at each step: 'What operation comes next?' (formative verbal CFU)",
    "estimated_minutes": 10,
    "accessibility_notes": "Step-by-step visual workings, highlight division by 100"
})

# ... (continue for cards 4-6: guided_practice, independent_practice, exit_ticket)

# Aggregate metadata
lesson_plan["lesson_flow_summary"] = "5min starter → 8min explainer → 10min modelling → 12min guided → 10min independent → 5min exit = 50 minutes"

lesson_plan["multi_standard_integration_strategy"] = "Unified shopping context across all cards: notation (AS1.1) established in cards 1-2, then applied in calculations (AS1.2) in cards 3-6. Scottish authenticity maintained throughout (£, Tesco, Next, Asda)."

lesson_plan["misconceptions_embedded_in_cards"] = [
    "Card 3: Addresses 20 × 45 vs (20/100) × 45 error via worked example",
    "Card 4: Rubric distinguishes notation errors from calculation errors",
    "Card 5: Requires working shown to diagnose misconceptions"
]

lesson_plan["assessment_progression"] = "Formative CFU in cards 2, 3, 4 (MCQ, fill-blank, verbal). Summative practice in card 5 (rubric-graded). Exit ticket in card 6 (quick check)."

lesson_plan["accessibility_integration"] = "All cards use plain language (CEFR B1), cards 1, 3, 4 emphasize dyslexia-friendly visuals, cards 4-6 allow calculators per policy.calculator_section='calc'."

# Return lesson_plan as part of SoW entry
entry["lesson_plan"] = lesson_plan
```

---

### Example 2: Unified Critic Validating Lesson Plan Depth

```python
# In SOW_UNIFIED_CRITIC_PROMPT, Coverage dimension:

def validate_coverage_dimension(authored_sow, course_data, research_pack):
    issues = []
    standards_coverage_map = {}  # Track how each standard is covered

    # For each entry in SoW:
    for entry in authored_sow["entries"]:
        lesson_plan = entry.get("lesson_plan")

        # Check 1: Lesson plan exists
        if not lesson_plan:
            issues.append(f"Entry {entry['order']}: Missing lesson_plan field")
            continue

        # Check 2: Card structure exists and has 6-12 cards
        card_structure = lesson_plan.get("card_structure", [])
        if len(card_structure) < 6:
            issues.append(f"Entry {entry['order']}: Lesson plan too shallow ({len(card_structure)} cards < 6 minimum)")
        elif len(card_structure) > 12:
            issues.append(f"Entry {entry['order']}: Lesson plan too long ({len(card_structure)} cards > 12 maximum)")

        # Check 3: Validate each card has required fields
        for card in card_structure:
            required_fields = ["card_number", "card_type", "title", "purpose",
                             "standards_addressed", "pedagogical_approach",
                             "cfu_strategy", "estimated_minutes", "accessibility_notes"]
            for field in required_fields:
                if field not in card:
                    issues.append(f"Entry {entry['order']}, Card {card.get('card_number', '?')}: Missing required field '{field}'")

            # Check 3a: Validate standards_addressed uses enriched objects, NOT bare codes
            standards_addressed = card.get("standards_addressed", [])
            if isinstance(standards_addressed, list) and len(standards_addressed) > 0:
                for std in standards_addressed:
                    if isinstance(std, str):
                        # Bare code detected - FAIL
                        issues.append(f"Entry {entry['order']}, Card {card['card_number']}: standards_addressed uses bare code '{std}' - must use enriched objects with code/description/outcome")
                    elif isinstance(std, dict):
                        # Check enriched object has required fields
                        if "code" not in std or "description" not in std or "outcome" not in std:
                            issues.append(f"Entry {entry['order']}, Card {card['card_number']}: Incomplete enriched standard object (missing code/description/outcome)")
                    else:
                        issues.append(f"Entry {entry['order']}, Card {card['card_number']}: Invalid standards_addressed format")

            # Check 4: CFU strategy not generic
            if card.get("cfu_strategy") in ["Ask questions", "Check understanding", ""]:
                issues.append(f"Entry {entry['order']}, Card {card['card_number']}: Generic CFU strategy")

        # Check 5: All assessmentStandardRefs appear in card_structure.standards_addressed
        entry_standards = [ref["code"] for ref in entry.get("assessmentStandardRefs", [])]
        card_standards_coverage = {}
        for card in card_structure:
            for std in card.get("standards_addressed", []):
                card_standards_coverage[std] = card_standards_coverage.get(std, 0) + 1

        for std in entry_standards:
            if std not in card_standards_coverage:
                issues.append(f"Entry {entry['order']}: Standard {std} not addressed in any card")
            elif card_standards_coverage[std] < 2:
                issues.append(f"Entry {entry['order']}: Standard {std} addressed in only {card_standards_coverage[std]} card(s) - need 2-3 for scaffolding")

        # Check 6: Card timings sum to estMinutes
        total_card_minutes = sum(card.get("estimated_minutes", 0) for card in card_structure)
        entry_est_minutes = entry.get("estMinutes", 0)
        if abs(total_card_minutes - entry_est_minutes) > 5:  # Allow 5-min tolerance
            issues.append(f"Entry {entry['order']}: Card timings ({total_card_minutes} min) don't match estMinutes ({entry_est_minutes} min)")

        # Track standards for global coverage check
        for std in entry_standards:
            if std not in standards_coverage_map:
                standards_coverage_map[std] = []
            standards_coverage_map[std].append(entry['order'])

    # Check 7: All Course_data standards covered
    all_course_standards = extract_all_standards(course_data)
    for std in all_course_standards:
        if std not in standards_coverage_map:
            issues.append(f"Global: Standard {std} from Course_data.txt not covered in any SoW entry")

    # Scoring
    if len(issues) == 0:
        score = 1.0
    elif len(issues) <= 3:
        score = 0.95  # Minor issues
    elif len(issues) <= 6:
        score = 0.90  # Pass threshold
    else:
        score = 0.85  # Fail

    return {
        "score": score,
        "pass": score >= 0.90,
        "threshold": 0.90,
        "issues": issues
    }
```

---

## Testing Strategy

### Unit Tests (Critic Validation)

**Test 1: Shallow Lesson Plan Rejected**
```json
{
  "entry": {
    "order": 1,
    "assessmentStandardRefs": [
      {"code": "AS1.1", "description": "...", "outcome": "O1"},
      {"code": "AS1.2", "description": "...", "outcome": "O1"}
    ],
    "lesson_plan": {
      "card_structure": [
        {"card_number": 1, "card_type": "starter", ...},
        {"card_number": 2, "card_type": "explainer", ...}
        // Only 2 cards - should FAIL (< 6 minimum)
      ]
    },
    "estMinutes": 50
  }
}
```

**Expected Critic Output**:
```json
{
  "dimensions": {
    "coverage": {
      "score": 0.75,
      "pass": false,
      "issues": [
        "Entry 1: Lesson plan too shallow (2 cards < 6 minimum)"
      ]
    }
  }
}
```

---

**Test 2: Standard Not Mapped to Cards**
```json
{
  "entry": {
    "order": 1,
    "assessmentStandardRefs": [
      {"code": "AS1.1", "description": "Use percentage notation...", "outcome": "O1"},
      {"code": "AS1.2", "description": "Calculate percentage...", "outcome": "O1"}
    ],
    "lesson_plan": {
      "card_structure": [
        {
          "card_number": 1,
          "standards_addressed": [
            {"code": "AS1.1", "description": "Use percentage notation...", "outcome": "O1"}
          ],
          ...
        },
        {
          "card_number": 2,
          "standards_addressed": [
            {"code": "AS1.1", "description": "Use percentage notation...", "outcome": "O1"}
          ],
          ...
        },
        {
          "card_number": 3,
          "standards_addressed": [
            {"code": "AS1.1", "description": "Use percentage notation...", "outcome": "O1"}
          ],
          ...
        }
        // AS1.2 never appears in cards - should FAIL
      ]
    }
  }
}
```

**Expected Critic Output**:
```json
{
  "dimensions": {
    "coverage": {
      "score": 0.80,
      "pass": false,
      "issues": [
        "Entry 1: Standard AS1.2 not addressed in any card"
      ]
    }
  }
}
```

---

**Test 3: Generic CFU Strategy**
```json
{
  "card": {
    "card_number": 3,
    "cfu_strategy": "Ask questions",  // Too generic - should WARN
    ...
  }
}
```

**Expected Critic Output**:
```json
{
  "dimensions": {
    "coverage": {
      "score": 0.92,
      "pass": true,
      "issues": [
        "Entry 1, Card 3: Generic CFU strategy"
      ]
    }
  }
}
```

---

### Integration Tests (Full SoW Generation)

**Test 4: Generate SoW for Application of Mathematics National 4**

**Input**:
- `research_pack_json`: Pre-populated with AoM context
- `Course_data.txt`: AoM N4 with ~15 assessment standards

**Expected Output**:
- `authored_sow_json` with ~6-8 entries (chunked)
- Each entry has lesson_plan with 6-12 cards
- Unified critic passes with score ≥ 0.90
- All 15 standards appear in lesson plans across entries

**Validation**:
1. Count entries: should be 6-8 (not 15+ separate lessons)
2. For each entry, count cards in lesson_plan.card_structure: 6-12
3. Extract all standards_addressed from all cards across all entries: should match Course_data.txt standards
4. Check critic result: `pass: true`

---

## Risk Assessment

### Risk 1: Prompt Complexity Increases

**Concern**: Adding detailed lesson_plan schema increases prompt size

**Mitigation**:
- We're REMOVING ~200 lines of administrative cruft
- Net effect: +100 lines (card schema) - 200 lines (admin) = **-100 lines reduction**
- Prompt clarity improves (focused on pedagogy)

---

### Risk 2: LLM Struggles with Detailed Card Generation

**Concern**: Gemini 2.5-pro may generate shallow lesson plans or skip cards

**Mitigation**:
- Unified critic provides feedback loop (agent revises if critic fails)
- Prompt includes explicit pseudocode examples (see above)
- Research pack provides pedagogical_patterns to scaffold card design
- If still shallow, adjust critic threshold to 0.95 (stricter)

---

### Risk 3: Downstream Lesson Author Agent Can't Parse lesson_plan

**Concern**: Lesson Author Agent expects old `lesson_author_guidance` schema

**Mitigation**:
- **Phase 7** (not in this spec): Update Lesson Author Agent prompts to consume lesson_plan
- **CRITICAL**: Lesson Author must receive enriched `standards_addressed` objects (code + description + outcome) in each card, NOT bare codes
  * Rationale: Lesson Author needs full assessment standard descriptions to generate appropriate CFU questions and rubrics
  * Example: `{"code": "AS1.2", "description": "Calculate a percentage of a quantity in practical contexts", "outcome": "O1"}`
- Backward compatibility: Keep old schema as fallback (if lesson_plan missing, use lesson_author_guidance)
- Seeding script can validate both schemas present during transition period

---

### Risk 4: Critic Validation Too Strict (Always Fails)

**Concern**: Enhanced critic rejects all SoW attempts

**Mitigation**:
- Start with lenient thresholds (0.85 instead of 0.90) during rollout
- Monitor critic feedback: if all SoWs fail on same issue, adjust prompt guidance
- Add critic calibration step: validate critic on known-good SoW examples first

---

## Success Metrics

### Quantitative Metrics

1. **Lesson Plan Completeness**:
   - Target: 100% of SoW entries have lesson_plan.card_structure with 6-12 cards
   - Measurement: Count entries with valid card_structure

2. **Standard-to-Card Mapping**:
   - Target: 95% of assessment standards appear in ≥2 cards (scaffolding)
   - Measurement: Aggregate standards_addressed across all cards, check frequency

3. **Prompt Size Reduction**:
   - Target: 15-20% reduction in prompt lines (~200-250 lines removed)
   - Measurement: Line count before/after refactor

4. **Critic Pass Rate**:
   - Target: 80% of SoW generations pass unified critic on first attempt (or second after revision)
   - Measurement: Track critic results across test runs

### Qualitative Metrics

1. **Lesson Author Agent Feedback**:
   - Target: Lesson templates generated from lesson_plan are coherent and match SoW intent
   - Measurement: Manual review of 5-10 generated templates

2. **Teacher Usability**:
   - Target: SoW lesson_instruction + lesson_plan provide clear blueprint for classroom delivery
   - Measurement: Teacher review of 3-5 SoW entries

3. **Pedagogical Soundness**:
   - Target: Lesson plans show realistic CFU progression, misconception handling, timing
   - Measurement: Education expert review of card sequences

---

## Rollout Plan

### Stage 1: Development (Days 1-8)

- Implement Phases 1-6 as described above
- Unit test critic validation logic
- Generate 2-3 test SoWs (AoM N4, Mathematics N5)

### Stage 2: Internal Validation (Days 9-10)

- Run full SoW generation for 5 courses
- Review lesson plans manually
- Adjust critic thresholds if needed

### Stage 3: Integration with Lesson Author Agent (Days 11-15)

- Update Lesson Author prompts to consume lesson_plan
- Test end-to-end: SoW generation → Lesson template generation
- Validate templates match lesson plan intent

### Stage 4: Production Rollout (Day 16+)

- Deploy updated prompts to production
- Monitor critic pass rates
- Collect teacher feedback on SoW usability

---

## Appendices

### Appendix A: Field Comparison (Old vs New)

| Old Field | New Field | Change |
|-----------|-----------|--------|
| `lesson_author_guidance.card_count_target` | `lesson_plan.card_structure.length` | ✅ Explicit card count |
| `lesson_author_guidance.pedagogical_approach` | `lesson_plan.summary` + per-card `pedagogical_approach` | ✅ Detailed, not generic |
| `lesson_author_guidance.multi_standard_integration` | `lesson_plan.multi_standard_integration_strategy` + per-card `standards_addressed` | ✅ Explicit mapping |
| `lesson_author_guidance.assessment_focus` | Per-card `assessment_focus` + `rubric_guidance` | ✅ Granular, actionable |
| `lesson_author_guidance.misconceptions_to_address` | Per-card `misconceptions_addressed` | ✅ Embedded in flow |
| `pedagogical_blocks` | `lesson_plan.card_structure` (card types provide this) | ✅ Redundant field removed |

### Appendix B: Critic Dimension Thresholds

| Dimension | Old Threshold | New Threshold | Rationale |
|-----------|---------------|---------------|-----------|
| Coverage | ≥0.90 | ≥0.90 (stricter validation) | Lesson plan depth now required |
| Sequencing | ≥0.80 | ≥0.80 (unchanged) | Already validates lesson flow |
| Policy | ≥0.80 | ≥0.80 (unchanged) | Lesson plan doesn't affect policy |
| Accessibility | ≥0.90 | ≥0.90 (stricter validation) | Per-card accessibility now required |
| Authenticity | ≥0.90 | ≥0.90 (stricter validation) | Scottish contexts in cards checked |

### Appendix C: Example SoW Entry (Full)

See [Appendix C - Full Example SoW Entry](./appendices/example_sow_entry_with_lesson_plan.json)

*(This would be a separate JSON file showing a complete SoW entry with the new lesson_plan structure)*

---

## Approval and Next Steps

**Awaiting User Approval**:
- Review this specification
- Approve overall approach
- Identify any concerns or adjustments needed

**Upon Approval**:
- Begin Phase 1 implementation (Days 1-2)
- Provide progress updates after each phase
- Deliver test SoW examples for validation

---

**Document Status**: Draft
**Created**: 2025-10-13
**Owner**: AI Assistant
**Reviewers**: User (pending approval)
