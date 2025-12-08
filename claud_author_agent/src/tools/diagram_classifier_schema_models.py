"""Diagram Classifier Schema Models - Pydantic models for classification result validation.

The classifier analyzes each mock exam question and determines the optimal
rendering tool (DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, or NONE).

Schema matches the output format defined in diagram_classification_subagent.md
"""

from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


# Tool options as a Literal type for validation
# Note: IMAGEN is normalized to IMAGE_GENERATION via validator
# Note: GEOGEBRA has been replaced with MATPLOTLIB for better code generation reliability
ToolType = Literal["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "NONE"]
ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW"]


def normalize_tool_type(value: str) -> str:
    """Normalize tool type - convert legacy names to current names.

    - IMAGEN → IMAGE_GENERATION
    - GEOGEBRA → MATPLOTLIB (migration from GeoGebra to Matplotlib)
    """
    if not value:
        return value
    upper_val = value.upper()
    if upper_val == "IMAGEN":
        return "IMAGE_GENERATION"
    if upper_val == "GEOGEBRA":
        return "MATPLOTLIB"
    return value


class ClassificationReasoning(BaseModel):
    """Reasoning for the classification decision."""
    selected_because: str = Field(..., min_length=10, description="Why this tool is optimal")
    content_analysis: str = Field(..., min_length=10, description="Question elements that drove decision")
    decision_rule_applied: str = Field(..., description="Which rule (1-8) was applied")
    alternatives_rejected: str = Field(..., description="Why other tools not suitable")
    summary: str = Field(..., description="One-sentence summary")


class DiagramSpecs(BaseModel):
    """Specifications for the diagram to be generated."""
    key_elements: List[str] = Field(default_factory=list, description="Visual elements to include")
    educational_purpose: str = Field(..., description="How diagram supports learning")


class QuestionClassification(BaseModel):
    """Classification result for a single question."""
    question_id: str = Field(..., description="Question ID (e.g., 'q1')")
    question_number: int = Field(..., ge=1, description="Question number")
    tool: ToolType = Field(..., description="Selected tool or NONE")
    confidence: ConfidenceLevel = Field(..., description="Confidence in selection")
    reasoning: ClassificationReasoning = Field(..., description="Detailed reasoning")
    visualization_focus: Optional[str] = Field(None, description="What diagram should emphasize")
    alternative_tool: Optional[ToolType] = Field(None, description="Second-best tool if confidence MEDIUM/LOW")
    curriculum_topic: str = Field(..., description="Relevant topic area")
    diagram_specs: Optional[DiagramSpecs] = Field(None, description="Specs if tool is not NONE")

    @field_validator('tool', 'alternative_tool', mode='before')
    @classmethod
    def normalize_tool(cls, v):
        """Normalize IMAGEN to IMAGE_GENERATION."""
        if v is None:
            return v
        return normalize_tool_type(v)


class DiagramClassificationResult(BaseModel):
    """Complete classification result for all questions in a mock exam.

    Matches the output format from diagram_classification_subagent.md.
    """
    batch_mode: bool = Field(True, description="Always true for batch processing")
    total_questions: int = Field(..., ge=0, description="Total questions processed")
    questions_needing_diagrams: int = Field(..., ge=0, description="Questions with tool != NONE")
    questions_no_diagram: int = Field(..., ge=0, description="Questions with tool == NONE")
    classifications: List[QuestionClassification] = Field(
        ...,
        description="Classification for each question"
    )

    @field_validator('classifications')
    @classmethod
    def validate_classifications_count(cls, v, info):
        """Ensure classifications array has correct count."""
        # Note: Can't validate against total_questions here as info.data may not have it yet
        # Validation happens at higher level in agent
        return v

    def validate_counts(self) -> bool:
        """Validate that counts match the classifications array.

        Returns:
            True if counts are valid, raises ValueError otherwise
        """
        actual_total = len(self.classifications)
        if actual_total != self.total_questions:
            raise ValueError(
                f"total_questions ({self.total_questions}) doesn't match "
                f"classifications count ({actual_total})"
            )

        actual_needs_diagram = sum(
            1 for c in self.classifications if c.tool != "NONE"
        )
        if actual_needs_diagram != self.questions_needing_diagrams:
            raise ValueError(
                f"questions_needing_diagrams ({self.questions_needing_diagrams}) doesn't match "
                f"actual count ({actual_needs_diagram})"
            )

        actual_no_diagram = sum(
            1 for c in self.classifications if c.tool == "NONE"
        )
        if actual_no_diagram != self.questions_no_diagram:
            raise ValueError(
                f"questions_no_diagram ({self.questions_no_diagram}) doesn't match "
                f"actual count ({actual_no_diagram})"
            )

        return True


# Output file name constants
DIAGRAM_CLASSIFICATION_INPUT_FILE = "classification_input.json"
DIAGRAM_CLASSIFICATION_OUTPUT_FILE = "classification_output.json"
