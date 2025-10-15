# SOW JSON Schema Documentation

**Version**: 2.0
**Last Updated**: 2025-10-15
**Purpose**: Complete schema structure for Scheme of Work (SoW) JSON output

---

## Overview

The **SoW JSON** that the SOW Author Agent writes to `authored_sow_json` follows this structure. This schema emphasizes pedagogical content (lesson plans, coherence, accessibility) while letting seeding scripts handle administrative fields (courseId, IDs, timestamps).

---

## Complete Schema Structure

```json
{
  "metadata": {
    "coherence": {
      "policy_notes": [
        "REQUIRED: Strategic calculator usage sequencing (e.g., 'Non-calc first; calc later')"
      ],
      "sequencing_notes": [
        "REQUIRED: Curriculum flow rationale (e.g., 'Fractions → Decimals → Percents')"
      ]
    },
    "accessibility_notes": [
      "REQUIRED: Global accessibility strategies (plain language, pacing, chunking)"
    ],
    "engagement_notes": [
      "REQUIRED: Scottish context hooks (£ prices, NHS, supermarket flyers, bus fares)"
    ],
    "weeks": "int, optional - planned teaching weeks",
    "periods_per_week": "int, optional - periods per week"
  },

  "entries": [
    {
      "order": "int, REQUIRED - sequential position establishing lesson order (1, 2, 3...)",
      "label": "string, REQUIRED - teacher-facing lesson title",
      "lesson_type": "string, REQUIRED - teach | independent_practice | formative_assessment | mock_assessment | summative_assessment | project | revision | spiral_revisit",

      "coherence": {
        "block_name": "string, REQUIRED - sub-topic label within the unit",
        "block_index": "string, REQUIRED - ordering indicator for visual transparency (e.g., '2.1', '2.2')",
        "prerequisites": ["optional - references to earlier lessons by order or label"]
      },

      "policy": {
        "calculator_section": "string, REQUIRED - non_calc | mixed | calc (aligns with SQA assessment model)",
        "assessment_notes": "string, optional - clarifications for marking or re-assessment"
      },

      "engagement_tags": [
        "REQUIRED - Scottish context tags: shopping, bus_fares, NHS, sports, finance, etc."
      ],

      "outcomeRefs": [
        "REQUIRED - outcome codes from Course_data.txt (e.g., 'O1', 'O2')"
      ],

      "assessmentStandardRefs": [
        {
          "code": "string, REQUIRED - assessment standard code (e.g., 'AS1.2')",
          "description": "string, REQUIRED - full SQA description from Course_data.txt",
          "outcome": "string, REQUIRED - parent outcome reference (e.g., 'O1')"
        }
      ],

      "lesson_plan": {
        "summary": "string, REQUIRED - 2-3 sentence overview of lesson pedagogical arc",

        "card_structure": [
          {
            "card_number": "int, REQUIRED - sequential position (1, 2, 3...)",
            "card_type": "string, REQUIRED - starter | explainer | modelling | guided_practice | independent_practice | exit_ticket",
            "title": "string, REQUIRED - clear, teacher-facing card title",
            "purpose": "string, REQUIRED - pedagogical goal for this card",
            "standards_addressed": [
              {
                "code": "string, REQUIRED - assessment standard code (e.g., 'AS1.2')",
                "description": "string, REQUIRED - full SQA description from Course_data.txt",
                "outcome": "string, REQUIRED - parent outcome reference (e.g., 'O1')"
              }
            ],
            "pedagogical_approach": "string, REQUIRED - detailed description of what happens in this card",
            "key_concepts": ["array, optional - for explainer cards, list 3-5 key concepts"],
            "worked_example": "string, optional - for modelling cards, detailed worked example with Scottish context",
            "practice_problems": ["array, optional - for guided_practice cards, 2-4 problems with increasing complexity"],
            "cfu_strategy": "string, REQUIRED - specific CFU type and prompt (e.g., 'MCQ: Which fraction equals 25%?')",
            "misconceptions_addressed": [
              {
                "misconception": "string, optional - common student error",
                "remediation": "string - correction strategy"
              }
            ],
            "rubric_guidance": {
              "total_points": "int, optional - total marks for this card's CFU",
              "criteria": [
                {"description": "string - criterion", "points": "int - marks"}
              ]
            },
            "assessment_focus": "string, optional - for cards addressing multiple standards, which is primary vs secondary",
            "estimated_minutes": "int, REQUIRED - realistic timing for this card (1-15 minutes typical)"
          }
        ],

        "lesson_flow_summary": "string, REQUIRED - timeline showing card sequence and cumulative timing (e.g., '5min starter → 8min explainer → 10min modelling → 50 min total')",
        "multi_standard_integration_strategy": "string, REQUIRED (for chunked lessons) - how multiple standards connect across cards",
        "misconceptions_embedded_in_cards": ["array, REQUIRED - list which cards address which misconceptions"],
        "assessment_progression": "string, REQUIRED - how assessment builds from formative CFU to summative practice"
      },

      "accessibility_profile": {
        "dyslexia_friendly": "boolean, REQUIRED - emphasize dyslexia-friendly design",
        "plain_language_level": "string, REQUIRED - target reading level (e.g., 'CEFR_B1')",
        "extra_time": "boolean, REQUIRED - flag for extended time provision"
      },

      "estMinutes": "int, REQUIRED - estimated duration (25-50 minutes typical for Scottish periods)",
      "lesson_instruction": "string, REQUIRED - clear instruction detailing lesson structure and teacher guidance"
    }
  ]
}
```

---

## Field Details

### Metadata Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `coherence` | object | Yes | Strategic notes about policy and sequencing |
| `coherence.policy_notes` | array[string] | Yes | Calculator staging, assessment notes |
| `coherence.sequencing_notes` | array[string] | Yes | Curriculum flow rationale |
| `accessibility_notes` | array[string] | Yes | Global accessibility strategies |
| `engagement_notes` | array[string] | Yes | Scottish context hooks |
| `weeks` | int | No | Planned teaching weeks |
| `periods_per_week` | int | No | Periods per week |

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order` | int | Yes | Sequential position (1, 2, 3...) |
| `label` | string | Yes | Teacher-facing lesson title |
| `lesson_type` | enum | Yes | teach, practice, assessment, revision, etc. |
| `coherence` | object | Yes | Block name, index, prerequisites |
| `policy` | object | Yes | Calculator section, assessment notes |
| `engagement_tags` | array[string] | Yes | Scottish context tags |
| `outcomeRefs` | array[string] | Yes | Outcome codes (e.g., 'O1', 'O2') |
| `assessmentStandardRefs` | array[object] | Yes | **Enriched objects** with code/description/outcome |
| `lesson_plan` | object | Yes | Detailed card structure (6-12 cards) |
| `accessibility_profile` | object | Yes | Dyslexia-friendly, plain language, extra time |
| `estMinutes` | int | Yes | Estimated duration (25-50 min typical) |
| `lesson_instruction` | string | Yes | Overall teacher guidance |

### Lesson Plan Card Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `card_number` | int | Yes | Sequential position (1, 2, 3...) |
| `card_type` | enum | Yes | starter, explainer, modelling, guided_practice, independent_practice, exit_ticket |
| `title` | string | Yes | Teacher-facing card title |
| `purpose` | string | Yes | Pedagogical goal for this card |
| `standards_addressed` | array[object] | Yes | **Enriched objects** with code/description/outcome |
| `pedagogical_approach` | string | Yes | Detailed description of what happens |
| `cfu_strategy` | string | Yes | Specific CFU type and prompt |
| `estimated_minutes` | int | Yes | Realistic timing (1-15 min typical) |
| `key_concepts` | array[string] | No | For explainer cards, 3-5 concepts |
| `worked_example` | string | No | For modelling cards, detailed example |
| `practice_problems` | array[string] | No | For guided_practice, 2-4 problems |
| `misconceptions_addressed` | array[object] | No | Misconception + remediation pairs |
| `rubric_guidance` | object | No | Total points + criteria for assessment |
| `assessment_focus` | string | No | Primary vs secondary standard focus |

---

## Critical Requirements

### 1. Enriched Format (NOT Bare Codes)

**❌ WRONG** (bare codes):
```json
"assessmentStandardRefs": ["AS1.2", "AS2.1"]
```

**✅ CORRECT** (enriched objects):
```json
"assessmentStandardRefs": [
  {
    "code": "AS1.2",
    "description": "Perform calculations involving fractions, decimal fractions and percentages (from Course_data.txt)",
    "outcome": "O1"
  }
]
```

### 2. Lesson Plan Depth

- **6-12 cards per lesson** (appropriate for 25-50 min Scottish periods)
- **All required card fields** present
- **Card timings sum to estMinutes** (allow ±5 min tolerance)
- **ALL assessmentStandardRefs appear in 2-3 cards** (progressive scaffolding)
- **Cards use enriched standards_addressed** (code/description/outcome objects)

### 3. CFU Strategies (Specific, Not Generic)

**❌ BAD**: "Ask questions to check understanding"

**✅ GOOD**: "MCQ: Which fraction equals 25%? A) 1/2  B) 1/4  C) 1/3  D) 1/5"

**✅ GOOD**: "Structured question: Calculate 3/4 of £20 showing working"

### 4. Scottish Context Authenticity

- Use **£** (not $ or €)
- Reference **NHS, local councils, Scottish shops, bus fares**
- Use **CfE/SQA-specific terminology**

---

## Validation Checklist

- [ ] All metadata fields present (coherence, accessibility_notes, engagement_notes)
- [ ] All entries have sequential `order` field (1, 2, 3...)
- [ ] assessmentStandardRefs use enriched objects (NOT bare codes)
- [ ] Every entry has lesson_plan with card_structure
- [ ] card_structure contains 6-12 cards
- [ ] All cards have required fields (card_number, card_type, title, purpose, standards_addressed, pedagogical_approach, cfu_strategy, estimated_minutes)
- [ ] Card standards_addressed use enriched objects (NOT bare codes)
- [ ] Card timings sum to estMinutes
- [ ] ALL assessmentStandardRefs appear in at least 2-3 cards
- [ ] CFU strategies are specific (not "ask questions")
- [ ] Scottish contexts used throughout (£, NHS, local shops)
- [ ] Field naming: lesson_instruction (NOT "notes")

---

## Rationale for Enriched Format

**Why enriched objects at both entry-level AND card-level?**

The Lesson Author Agent needs full SQA descriptions to:
- Generate assessment-aligned CFU questions
- Create rubrics matching official standards
- Ensure cards address standards appropriately
- Maintain Scottish terminology consistency

Bare codes lack the context needed for quality lesson card generation.

---

## Related Documentation

- **Research Pack Schema**: `research_pack_schema.md`
- **Lesson Card Schema**: `lesson_card_schema.md`
- **SOW Author Prompts**: `../sow_author_prompts.py`
