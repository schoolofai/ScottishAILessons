# Research Pack Schema v3

## Structure for `research_pack_json`

```json
{
  "research_pack_version": 3,
  "subject": "string",
  "level": "string",

  "exemplars_from_sources": [
    {
      "source_title": "string",
      "source_url": "string",
      "source_type": "sqa_exemplar | pedagogical_guide | cfe_document",
      "relevant_extract": "string - full content",
      "relevance": "string - why this matters"
    }
  ],

  "distilled_data": {
    "canonical_terms": {
      "term_name": "official definition from SQA/CfE"
    },
    "assessment_stems": [
      "string - SQA-style question stems"
    ],
    "pedagogical_patterns": {
      "lesson_starters": ["array"],
      "cfu_variety_examples": ["array"],
      "misconceptions": ["array"]
    },
    "calculator_policy": {
      "policy_description": "string",
      "non_calculator_topics": ["array"]
    }
  },

  "guidance_for_author": {
    "sequencing_principles": ["array"],
    "context_hooks": [
      {
        "context_type": "currency | supermarket | transport | service",
        "examples": ["£", "Tesco", "NHS", "Ridacard"]
      }
    ],
    "accessibility_patterns": ["array"],
    "chunking_examples": ["array"]
  },

  "citations": ["array of source URLs"],

  "research_metadata": {
    "date_generated": "ISO timestamp",
    "research_duration_minutes": "int"
  }
}
```

## Usage by SOW Author

- Extract canonical_terms for accurate SQA terminology
- Use assessment_stems for CFU strategies
- Apply context_hooks for Scottish authenticity
- Reference pedagogical_patterns for lesson design
- Follow calculator_policy for policy compliance
