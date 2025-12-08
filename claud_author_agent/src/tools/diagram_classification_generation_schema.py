"""Simplified DiagramClassification schema for structured output generation.

This schema is optimized for Claude Agent SDK structured outputs:
- Only 2 model definitions (vs 4+ in full schema)
- No enums (uses Literal inline)
- No validators (moved to post-processing)
- Flat structure (minimal nesting)
- ~1-2KB schema size

Use this schema for output_format in the agent.
Use diagram_classifier_schema_models.py for post-processing validation.
"""

from pydantic import BaseModel
from typing import Literal, Optional, Any


# Type aliases using Literal (no enums = no $defs entries)
ToolValue = Literal["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "NONE"]
ConfidenceValue = Literal["HIGH", "MEDIUM", "LOW"]


class QuestionClassificationGeneration(BaseModel):
    """Simplified classification for a single question.

    Flattened structure - reasoning fields inlined as simple strings.
    """
    question_id: str
    question_number: int
    tool: ToolValue
    confidence: ConfidenceValue

    # Reasoning - flattened from nested ClassificationReasoning
    reasoning_selected_because: str
    reasoning_content_analysis: str
    reasoning_decision_rule: str
    reasoning_alternatives_rejected: str
    reasoning_summary: str

    # Optional fields
    visualization_focus: Optional[str] = None
    alternative_tool: Optional[ToolValue] = None
    curriculum_topic: str

    # Diagram specs - flattened (no DiagramSpecs model)
    diagram_key_elements: list[str]
    diagram_educational_purpose: Optional[str] = None


class DiagramClassificationGeneration(BaseModel):
    """Simplified classification result for structured output generation.

    Only 2 model definitions total:
    - DiagramClassificationGeneration (this)
    - QuestionClassificationGeneration

    All nested structures flattened for schema simplicity.
    """
    batch_mode: bool = True
    total_questions: int
    questions_needing_diagrams: int
    questions_no_diagram: int
    classifications: list[QuestionClassificationGeneration]


def convert_to_full_schema(simplified: dict) -> dict:
    """Convert simplified generation schema to full DiagramClassificationResult schema.

    Restructures the flattened output into the nested format expected by
    validation systems.

    Args:
        simplified: Dict from DiagramClassificationGeneration structured output

    Returns:
        Dict conforming to full DiagramClassificationResult schema
    """
    converted_classifications = []

    for c in simplified.get("classifications", []):
        # Build nested reasoning object
        reasoning = {
            "selected_because": c.get("reasoning_selected_because", ""),
            "content_analysis": c.get("reasoning_content_analysis", ""),
            "decision_rule_applied": c.get("reasoning_decision_rule", ""),
            "alternatives_rejected": c.get("reasoning_alternatives_rejected", ""),
            "summary": c.get("reasoning_summary", "")
        }

        # Build diagram_specs if tool is not NONE
        diagram_specs = None
        if c.get("tool") != "NONE":
            diagram_specs = {
                "key_elements": c.get("diagram_key_elements", []),
                "educational_purpose": c.get("diagram_educational_purpose", "")
            }

        converted_classifications.append({
            "question_id": c.get("question_id"),
            "question_number": c.get("question_number"),
            "tool": c.get("tool"),
            "confidence": c.get("confidence"),
            "reasoning": reasoning,
            "visualization_focus": c.get("visualization_focus"),
            "alternative_tool": c.get("alternative_tool"),
            "curriculum_topic": c.get("curriculum_topic", ""),
            "diagram_specs": diagram_specs
        })

    return {
        "batch_mode": simplified.get("batch_mode", True),
        "total_questions": simplified.get("total_questions", 0),
        "questions_needing_diagrams": simplified.get("questions_needing_diagrams", 0),
        "questions_no_diagram": simplified.get("questions_no_diagram", 0),
        "classifications": converted_classifications
    }


def get_schema_stats() -> dict:
    """Get statistics about the simplified schema."""
    import json
    schema = DiagramClassificationGeneration.model_json_schema()
    schema_str = json.dumps(schema)

    return {
        "schema_size_chars": len(schema_str),
        "definitions_count": len(schema.get("$defs", {})),
        "top_level_properties": list(schema.get("properties", {}).keys())
    }
