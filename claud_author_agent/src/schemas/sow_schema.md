# SOW Schema - Authored SOW JSON Structure

**⚠️ DEPRECATION NOTICE (2025-10-19)**

This file is a **legacy reference** kept for backwards compatibility.

**CANONICAL SCHEMA LOCATION**: `/claud_author_agent/docs/schema/authored_sow_schema.md`

For current development and all new implementations, use the canonical schema documentation which includes:
- Complete field descriptions with AI-friendly explanations
- Enriched reference structures with detailed examples
- All forbidden patterns with detailed reasoning
- Validation rules with comprehensive explanations
- Pre-write validation checklist
- Complete worked examples showing valid entries

This legacy file may become outdated. For accurate, up-to-date schema requirements, always reference the canonical schema file.

---

## Complete Schema for `authored_sow.json` (Legacy Reference)

```json
{
  "metadata": {
    "subject": "string - e.g., 'mathematics'",
    "level": "string - e.g., 'national-5'",
    "total_lessons": "int - 10-20 typical",
    "coherence": "string - overall course narrative",
    "accessibility_notes": "string - dyslexia-friendly approach",
    "engagement_notes": "string - Scottish contexts used"
  },

  "entries": [
    {
      "order": "int - sequential (1, 2, 3...)",
      "label": "string - lesson title indicating covered standards",
      "lesson_type": "teach | revision | independent_practice | mock_assessment",

      "coherence": {
        "block_name": "string - thematic block",
        "block_index": "int",
        "prerequisites": ["array of prerequisite standard codes"]
      },

      "policy": {
        "calculator_allowed": "boolean",
        "assessment_notes": "string - optional"
      },

      "engagement_tags": ["array of Scottish contexts"],

      "outcomeRefs": ["array of outcome codes: O1, O2"],

      "assessmentStandardRefs": [
        {
          "code": "string - e.g., AS1.2",
          "description": "string - FULL description from Course_data.txt",
          "outcome": "string - e.g., O1"
        }
      ],

      "lesson_plan": {
        "summary": "string - 2-3 sentence pedagogical arc",

        "card_structure": [
          {
            "card_number": "int",
            "card_type": "starter | explainer | modelling | guided_practice | independent_practice | exit_ticket",
            "title": "string",
            "purpose": "string - pedagogical goal",
            "standards_addressed": [
              {
                "code": "string",
                "description": "string",
                "outcome": "string"
              }
            ],
            "pedagogical_approach": "string - detailed",
            "cfu_strategy": "string - specific CFU with exact prompt",
            "estimated_minutes": "int - 1-15 typical"
          }
        ],

        "lesson_flow_summary": "string - timeline",
        "multi_standard_integration_strategy": "string",
        "misconceptions_embedded_in_cards": ["array"],
        "assessment_progression": "string"
      },

      "accessibility_profile": {
        "key_terms_simplified": ["array"],
        "extra_time_strategy": "string",
        "dyslexia_accommodations": ["array"]
      },

      "estMinutes": "int - 45-60 typical",
      "lesson_instruction": "string - teacher guidance"
    }
  ]
}
```

## Key Requirements

1. **Enriched Format**: assessmentStandardRefs and standards_addressed MUST be objects, NOT bare strings
2. **Lesson Plan Depth**: 6-12 cards per entry
3. **Teach→Revision Pairing**: 1:1 ratio maintained
4. **Course-Level Requirements**: At least 1 independent_practice, exactly 1 mock_assessment
5. **Scottish Authenticity**: £ currency, Scottish contexts
6. **Timing**: Card timings sum to estMinutes
