# Course Data Schema

## Structure for `Course_data.txt`

This is a **raw JSON dump** extracted from Appwrite `sqa_education.sqa_current` collection's `data` field.

The file contains the complete, unmodified JSON structure from the database, preserving all official SQA course data.

## Format

The file contains a **raw JSON object** with this structure:

```json
{
  "qualification": {
    "title": "National 4 Applications of Mathematics",
    "course_code": "HV7X 74",
    "level_name": "National 4",
    "level_aliases": ["Nat 4", "N4"],
    "subject_name": "Applications of Mathematics"
  },
  "course_structure": {
    "units": [
      {
        "unit_number": 1,
        "title": "Unit Title",
        "code": "HV7Y 74",
        "outcomes": [
          {
            "outcome_number": 1,
            "title": "Outcome description",
            "assessment_standards": [
              {
                "code": "AS1.1",
                "description": "Full standard description with complete detail"
              }
            ]
          }
        ]
      }
    ],
    "recommended_sequence": ["unit_1", "unit_2", "unit_3"],
    "sequence_rationale": "Explanation of recommended order",
    "delivery_notes": ["Note 1", "Note 2"]
  },
  "assessment_model": {
    "coursework_type": "Assignment",
    "coursework_weight_percent": 30,
    "coursework_notes": "Assessment guidance",
    "calculator_policy": "non_calculator | calculator | mixed"
  },
  "marking_guidance": {
    "provided": true,
    "guidance": "Marking guidance text"
  }
}

---
Extracted from Appwrite: {timestamp}
Document extracted using Python utility (no LLM processing) - Raw JSON dump from sqa_education.sqa_current collection's 'data' field
```

## Usage by SOW Author

The SOW Author subagent should:

1. **Read and Parse JSON**: Load Course_data.txt and parse the JSON structure
2. **Navigate JSON Paths**: Access data via JSON paths (e.g., `data_json['course_structure']['units']`)
3. **Extract Assessment Standards**: Extract full descriptions from `outcomes[].assessment_standards[]` for enriched format
4. **Follow Recommended Sequence**: Use `data_json['course_structure']['recommended_sequence']` to order lessons
5. **Apply Calculator Policy**: Use `data_json['assessment_model']['calculator_policy']` for lesson planning
6. **Use Official Terminology**: Extract exact codes, unit names, outcome descriptions from JSON fields

## Critical Requirements

- **Parse JSON Correctly**: The file is valid JSON, not markdown - parse it with JSON.loads() or equivalent
- **Full Descriptions**: Extract COMPLETE assessment standard descriptions from `assessment_standards[].description` field
- **Exact Codes**: Use official codes from `assessment_standards[].code` field
- **Outcome References**: Link each standard to its outcome using the nested structure
- **Preserve Structure**: The JSON preserves the exact structure from Appwrite - no transformations applied
