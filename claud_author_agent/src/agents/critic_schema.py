"""Pydantic schemas for Mock Exam Critic Agent output.

Defines the structured output format for the UX critic feedback.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum


class DimensionScore(BaseModel):
    """Score for a single evaluation dimension."""
    score: float = Field(..., ge=1.0, le=5.0, description="Score from 1.0 to 5.0")
    pass_status: bool = Field(..., description="Whether dimension passes threshold (≥3.5)")
    threshold: float = Field(default=3.5, description="Passing threshold")
    issues: List[str] = Field(default_factory=list, description="Problems identified")
    successes: List[str] = Field(default_factory=list, description="Positive aspects")


class SchemaGate(BaseModel):
    """Result of schema validation gate."""
    pass_status: bool = Field(..., description="Whether schema validation passed")
    failed_checks: List[str] = Field(default_factory=list, description="List of failed schema checks")


class ImprovementPriority(str, Enum):
    """Priority level for improvements."""
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Improvement(BaseModel):
    """Single improvement recommendation."""
    priority: ImprovementPriority
    dimension: str = Field(..., description="Which dimension this affects")
    description: str = Field(..., min_length=10, description="Specific improvement needed")
    question_refs: List[str] = Field(default_factory=list, description="Question IDs affected")


class ExamStats(BaseModel):
    """Statistics about the exam."""
    total_questions: int = Field(..., ge=0)
    total_marks: int = Field(..., ge=0)
    time_limit_minutes: int = Field(..., ge=1)
    questions_by_difficulty: Optional[Dict[str, int]] = None
    questions_by_type: Optional[Dict[str, int]] = None


class CriticFeedback(BaseModel):
    """Complete critic feedback output.

    This is the structured output schema for the mock_exam_critic agent.
    """
    # Overall result
    overall_pass: bool = Field(..., description="Whether exam passes all criteria")
    overall_score: float = Field(..., ge=0.0, le=5.0, description="Average of dimension scores")

    # Schema gate (blocking - must pass first)
    schema_gate: SchemaGate

    # Validation errors from schema check
    validation_errors: List[str] = Field(default_factory=list)

    # Dimensional scores (only evaluated if schema passes)
    dimensions: Optional[Dict[str, DimensionScore]] = Field(
        None,
        description="Scores for: question_clarity, marking_transparency, navigation_flow, accessibility"
    )

    # Summary and recommendations
    summary: str = Field(..., min_length=20, description="Comprehensive feedback summary")
    improvements_required: List[Improvement] = Field(
        default_factory=list,
        description="Prioritized list of required improvements"
    )

    # Exam statistics
    stats: ExamStats

    # Iteration tracking
    iteration: int = Field(default=1, description="Which iteration of critique this is")

    @property
    def needs_revision(self) -> bool:
        """Check if mock exam needs revision based on feedback."""
        return not self.overall_pass and len(self.improvements_required) > 0


class ClassificationItem(BaseModel):
    """Classification result for a single question."""
    question_id: str
    question_number: int
    tool: str = Field(..., description="DESMOS | MATPLOTLIB | JSXGRAPH | PLOTLY | IMAGEN | NONE")
    confidence: str = Field(..., description="HIGH | MEDIUM | LOW")
    reasoning: Dict[str, str] = Field(
        ...,
        description="Contains: selected_because, content_analysis, decision_rule_applied, alternatives_rejected, summary"
    )
    visualization_focus: Optional[str] = None
    alternative_tool: Optional[str] = None
    curriculum_topic: str
    diagram_specs: Optional[Dict[str, any]] = None


class DiagramClassificationOutput(BaseModel):
    """Output schema for diagram classifier agent.

    This is the structured output for batch classification of all questions.
    """
    batch_mode: bool = Field(default=True)
    total_questions: int = Field(..., ge=1)
    questions_needing_diagrams: int = Field(..., ge=0)
    questions_no_diagram: int = Field(..., ge=0)
    classifications: List[ClassificationItem]

    def get_questions_requiring_diagrams(self) -> List[ClassificationItem]:
        """Return only questions that need diagrams."""
        return [c for c in self.classifications if c.tool != "NONE"]
