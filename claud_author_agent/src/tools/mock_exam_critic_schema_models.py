"""Mock Exam Critic Schema Models - Pydantic models for critic result validation.

The critic evaluates mock exams on multiple UX dimensions after schema validation.
These models validate the critic's JSON output.

Schema matches the output format defined in mock_exam_ux_critic_prompt.md
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator


class SchemaGate(BaseModel):
    """Schema validation gate result."""
    pass_: bool = Field(..., alias="pass", description="Whether schema validation passed")
    failed_checks: List[str] = Field(default_factory=list, description="List of failed schema checks")

    model_config = {"populate_by_name": True}


class DimensionResult(BaseModel):
    """Individual dimension scoring result with detailed feedback."""
    score: float = Field(..., ge=1.0, le=5.0, description="Score from 1-5")
    pass_: bool = Field(..., alias="pass", description="Whether dimension passes threshold")
    threshold: float = Field(default=3.5, description="Minimum score for passing")
    issues: List[str] = Field(default_factory=list, description="Issues found")
    successes: List[str] = Field(default_factory=list, description="Positive findings")

    model_config = {"populate_by_name": True}


class CriticStats(BaseModel):
    """Statistics about the examined mock exam."""
    total_questions: int = Field(..., ge=0)
    total_marks: int = Field(..., ge=0)
    time_limit_minutes: int = Field(..., ge=0)
    time_allocated_minutes: Optional[int] = Field(None, ge=0)
    time_buffer_minutes: Optional[int] = Field(None, ge=0)
    sections: Optional[int] = Field(None, ge=0)
    standards_covered: Optional[int] = Field(None, ge=0)
    questions_by_difficulty: Optional[Dict[str, int]] = None
    questions_by_type: Optional[Dict[str, int]] = None


class MockExamCriticResult(BaseModel):
    """Complete critic result schema.

    Matches the output format from mock_exam_ux_critic_prompt.md:
    - Schema gate first (blocking)
    - 4 UX dimensions (question_clarity, marking_transparency, navigation_flow, accessibility)
    - All dimensions must score >= 3.5 for overall pass
    """
    # Overall pass/fail
    pass_: bool = Field(..., alias="pass", description="Whether all criteria passed")
    overall_score: float = Field(..., ge=0.0, le=5.0, description="Average of dimension scores")

    # Schema gate (blocking - if fails, skip dimensions)
    schema_gate: SchemaGate = Field(..., description="Schema validation result")
    validation_errors: List[str] = Field(default_factory=list, description="Validation errors if any")

    # Dimensional scores (only populated if schema_gate passes)
    dimensions: Optional[Dict[str, DimensionResult]] = Field(
        None,
        description="UX dimension scores (question_clarity, marking_transparency, navigation_flow, accessibility)"
    )

    # Summary and recommendations
    summary: str = Field(..., min_length=20, description="Comprehensive summary of evaluation")
    improvements_required: List[str] = Field(default_factory=list, description="Prioritized improvement recommendations")

    # Stats
    stats: Optional[CriticStats] = Field(None, description="Mock exam statistics")

    model_config = {"populate_by_name": True}

    @field_validator('overall_score')
    @classmethod
    def validate_overall_score(cls, v):
        """Overall score should be between 0 and 5."""
        if v < 0 or v > 5:
            raise ValueError(f"Overall score must be between 0 and 5, got {v}")
        return v


# Output file name constant
MOCK_EXAM_CRITIC_OUTPUT_FILE = "mock_exam_critic_result.json"
