"""Minimal JSON schemas for Claude Agent SDK structured output.

These schemas are intentionally simple - no $defs, no descriptions, minimal constraints.
This follows the SDK documentation pattern for better structured_output extraction.

The Pydantic models in sow_schema_models.py are still used for validation AFTER
extraction, but these minimal schemas are passed to the SDK's output_format parameter.
"""

# ═══════════════════════════════════════════════════════════════════════════════
# LESSON OUTLINE SCHEMA (Minimal)
# ═══════════════════════════════════════════════════════════════════════════════

LESSON_OUTLINE_SCHEMA = {
    "type": "object",
    "properties": {
        "course_subject": {"type": "string"},
        "course_level": {"type": "string"},
        "total_lessons": {"type": "integer"},
        "structure_type": {
            "type": "string",
            "enum": ["unit_based", "skills_based"]
        },
        "outlines": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "order": {"type": "integer"},
                    "lesson_type": {
                        "type": "string",
                        "enum": ["teach", "mock_exam"]
                    },
                    "label_hint": {"type": "string"},
                    "block_name": {"type": "string"},
                    "block_index": {"type": "string"},
                    "primary_outcome_or_skill": {"type": "string"},
                    "standards_or_skills_codes": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "rationale": {"type": "string"}
                },
                "required": [
                    "order", "lesson_type", "label_hint", "block_name",
                    "block_index", "primary_outcome_or_skill",
                    "standards_or_skills_codes", "rationale"
                ]
            }
        }
    },
    "required": ["course_subject", "course_level", "total_lessons", "structure_type", "outlines"]
}


# ═══════════════════════════════════════════════════════════════════════════════
# OUTLINE CRITIC RESULT SCHEMA (Minimal)
# ═══════════════════════════════════════════════════════════════════════════════

OUTLINE_CRITIC_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["PASS", "REVISION_REQUIRED"]
        },
        "overall_score": {"type": "number"},
        "dimensions": {
            "type": "object",
            "properties": {
                "coverage": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "issues": {"type": "array", "items": {"type": "string"}},
                        "notes": {"type": "string"}
                    },
                    "required": ["score"]
                },
                "sequencing": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "issues": {"type": "array", "items": {"type": "string"}},
                        "notes": {"type": "string"}
                    },
                    "required": ["score"]
                },
                "balance": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "issues": {"type": "array", "items": {"type": "string"}},
                        "notes": {"type": "string"}
                    },
                    "required": ["score"]
                },
                "progression": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "issues": {"type": "array", "items": {"type": "string"}},
                        "notes": {"type": "string"}
                    },
                    "required": ["score"]
                },
                "chunking": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "issues": {"type": "array", "items": {"type": "string"}},
                        "notes": {"type": "string"}
                    },
                    "required": ["score"]
                }
            },
            "required": ["coverage", "sequencing", "balance", "progression", "chunking"]
        },
        "revision_guidance": {
            "type": "array",
            "items": {"type": "string"}
        },
        "summary": {"type": "string"}
    },
    "required": ["verdict", "overall_score", "dimensions", "summary"]
}


# ═══════════════════════════════════════════════════════════════════════════════
# SOW ENTRY SCHEMA (Minimal) - Single lesson entry
# ═══════════════════════════════════════════════════════════════════════════════

# Helper: Dimension score object (reused in critic schemas)
_DIMENSION_SCORE = {
    "type": "object",
    "properties": {
        "score": {"type": "number"},
        "issues": {"type": "array", "items": {"type": "string"}},
        "notes": {"type": "string"}
    },
    "required": ["score"]
}

# Helper: Card structure (inline, no $ref)
_CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "card_number": {"type": "integer"},
        "card_type": {
            "type": "string",
            "enum": ["starter", "explainer", "modelling", "guided_practice", "exit_ticket"]
        },
        "title": {"type": "string"},
        "purpose": {"type": "string"},
        "standards_addressed": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "outcome": {"type": "string"},
                    "skill_name": {"type": "string"},
                    "description": {"type": "string"}
                },
                "required": ["description"]
            }
        },
        "pedagogical_approach": {"type": "string"},
        "key_concepts": {"type": "array", "items": {"type": "string"}},
        "worked_example": {"type": "string"},
        "practice_problems": {"type": "array", "items": {"type": "string"}},
        "cfu_strategy": {"type": "string"},
        "misconceptions_addressed": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "misconception": {"type": "string"},
                    "remediation": {"type": "string"}
                },
                "required": ["misconception", "remediation"]
            }
        },
        "rubric_guidance": {
            "type": "object",
            "properties": {
                "total_points": {"type": "integer"},
                "criteria": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "points": {"type": "integer"}
                        },
                        "required": ["description", "points"]
                    }
                }
            }
        },
        "estimated_minutes": {"type": "integer"}
    },
    "required": ["card_number", "card_type", "title", "purpose", "pedagogical_approach", "cfu_strategy"]
}

SOW_ENTRY_SCHEMA = {
    "type": "object",
    "properties": {
        "order": {"type": "integer"},
        "label": {"type": "string"},
        "lesson_type": {
            "type": "string",
            "enum": ["teach", "independent_practice", "formative_assessment", "revision", "mock_exam"]
        },
        "coherence": {
            "type": "object",
            "properties": {
                "block_name": {"type": "string"},
                "block_index": {"type": "string"},
                "prerequisites": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["block_name", "block_index"]
        },
        "policy": {
            "type": "object",
            "properties": {
                "calculator_section": {
                    "type": "string",
                    "enum": ["non_calc", "mixed", "calc", "exam_conditions"]
                },
                "assessment_notes": {"type": "string"}
            },
            "required": ["calculator_section"]
        },
        "engagement_tags": {"type": "array", "items": {"type": "string"}},
        "standards_or_skills_addressed": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "outcome": {"type": "string"},
                    "skill_name": {"type": "string"},
                    "description": {"type": "string"}
                },
                "required": ["description"]
            }
        },
        "lesson_plan": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "card_structure": {"type": "array", "items": _CARD_SCHEMA},
                "lesson_flow_summary": {"type": "string"},
                "multi_standard_integration_strategy": {"type": "string"},
                "misconceptions_embedded_in_cards": {"type": "array", "items": {"type": "string"}},
                "assessment_progression": {"type": "string"}
            },
            "required": ["summary", "card_structure", "lesson_flow_summary",
                        "multi_standard_integration_strategy", "assessment_progression"]
        },
        "accessibility_profile": {
            "type": "object",
            "properties": {
                "dyslexia_friendly": {"type": "boolean"},
                "plain_language_level": {
                    "type": "string",
                    "enum": ["CEFR_A1", "CEFR_A2", "CEFR_B1", "CEFR_B2"]
                },
                "extra_time": {"type": "boolean"},
                "extra_time_percentage": {"type": "integer"},
                "key_terms_simplified": {"type": "array", "items": {"type": "string"}},
                "visual_support_strategy": {"type": "string"}
            },
            "required": ["dyslexia_friendly"]
        },
        "estMinutes": {"type": "integer"},
        "lesson_instruction": {"type": "string"}
    },
    "required": [
        "order", "label", "lesson_type", "coherence", "policy",
        "engagement_tags", "standards_or_skills_addressed", "lesson_plan",
        "accessibility_profile", "lesson_instruction"
    ]
}


# ═══════════════════════════════════════════════════════════════════════════════
# LESSON CRITIC RESULT SCHEMA (Minimal)
# ═══════════════════════════════════════════════════════════════════════════════

LESSON_CRITIC_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["PASS", "REVISION_REQUIRED"]
        },
        "overall_score": {"type": "number"},
        "dimensions": {
            "type": "object",
            "properties": {
                "coverage": _DIMENSION_SCORE,
                "sequencing": _DIMENSION_SCORE,
                "policy": _DIMENSION_SCORE,
                "accessibility": _DIMENSION_SCORE,
                "authenticity": _DIMENSION_SCORE
            },
            "required": ["coverage", "sequencing", "policy", "accessibility", "authenticity"]
        },
        "revision_guidance": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"}
    },
    "required": ["verdict", "overall_score", "dimensions", "summary"]
}


# ═══════════════════════════════════════════════════════════════════════════════
# METADATA SCHEMA (Minimal)
# ═══════════════════════════════════════════════════════════════════════════════

METADATA_SCHEMA = {
    "type": "object",
    "properties": {
        "coherence": {
            "type": "object",
            "properties": {
                "policy_notes": {"type": "array", "items": {"type": "string"}},
                "sequencing_notes": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["policy_notes", "sequencing_notes"]
        },
        "accessibility_notes": {"type": "array", "items": {"type": "string"}},
        "engagement_notes": {"type": "array", "items": {"type": "string"}},
        "weeks": {"type": "integer"},
        "periods_per_week": {"type": "integer"}
    },
    "required": ["coherence", "accessibility_notes", "engagement_notes"]
}


def get_schema_size(schema: dict) -> int:
    """Get the character count of a JSON schema."""
    import json
    return len(json.dumps(schema))


if __name__ == "__main__":
    """Print schema sizes for comparison."""
    print("=== MINIMAL SCHEMA SIZES ===")
    print(f"LESSON_OUTLINE_SCHEMA:        {get_schema_size(LESSON_OUTLINE_SCHEMA):,} chars")
    print(f"OUTLINE_CRITIC_RESULT_SCHEMA: {get_schema_size(OUTLINE_CRITIC_RESULT_SCHEMA):,} chars")
    print(f"SOW_ENTRY_SCHEMA:             {get_schema_size(SOW_ENTRY_SCHEMA):,} chars")
    print(f"LESSON_CRITIC_RESULT_SCHEMA:  {get_schema_size(LESSON_CRITIC_RESULT_SCHEMA):,} chars")
    print(f"METADATA_SCHEMA:              {get_schema_size(METADATA_SCHEMA):,} chars")
