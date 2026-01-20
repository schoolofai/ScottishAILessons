"""Pydantic models for critic results in the iterative SOW authoring system.

These models define the structured output schemas for:
- OutlineCriticResult: Evaluates lesson outline against 5 dimensions
- LessonCriticResult: Evaluates individual lessons against 5 dimensions
- DimensionScore: Reusable score object for each dimension

Used with Claude Agent SDK's native structured output support:
    output_format={"type": "json_schema", "schema": Model.model_json_schema()}
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class DimensionScore(BaseModel):
    """Score for a single evaluation dimension.

    Attributes:
        score: Numeric score from 0.0 to 1.0
        issues: List of specific issues identified (empty if none)
        notes: Additional context or positive observations
    """

    score: float = Field(
        ge=0.0, le=1.0,
        description="Score from 0.0 (poor) to 1.0 (excellent)"
    )
    issues: List[str] = Field(
        default_factory=list,
        description="Specific issues identified for this dimension. Empty if no issues."
    )
    notes: str = Field(
        default="",
        description="Additional context, observations, or positive notes"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Outline Critic Models
# ═══════════════════════════════════════════════════════════════════════════════

class OutlineCriticDimensions(BaseModel):
    """Five dimensions for evaluating a lesson outline.

    Dimensions:
        coverage: Are all course standards/skills mapped to lessons?
        sequencing: Are prerequisites respected in lesson ordering?
        balance: Is the distribution across blocks/units reasonable?
        progression: Does complexity increase appropriately across lessons?
        chunking: Are standards grouped appropriately (2-4 per lesson)?
    """

    coverage: DimensionScore = Field(
        description="Are all course standards/skills from Course_outcomes.json mapped to lessons?"
    )
    sequencing: DimensionScore = Field(
        description="Are prerequisite dependencies respected? Are foundational topics taught before advanced ones?"
    )
    balance: DimensionScore = Field(
        description="Is the distribution of lessons across blocks/units reasonable? No block should be under/over-represented."
    )
    progression: DimensionScore = Field(
        description="Does complexity increase appropriately? Early lessons should be simpler; later lessons can be more complex."
    )
    chunking: DimensionScore = Field(
        description="Are standards grouped appropriately? Each teach lesson should cover 2-4 related standards."
    )


class OutlineCriticResult(BaseModel):
    """Result from the outline critic evaluation.

    This model is used as the structured output schema for the outline critic.
    The critic evaluates whether the generated outline is pedagogically sound
    and covers all required standards.

    Attributes:
        verdict: PASS if outline meets all criteria; REVISION_REQUIRED if changes needed
        overall_score: Weighted average of dimension scores (0.0-1.0)
        dimensions: Individual scores for each evaluation dimension
        revision_guidance: Prioritized list of specific changes needed (if REVISION_REQUIRED)
        summary: Brief human-readable explanation of the verdict
    """

    verdict: Literal["PASS", "REVISION_REQUIRED"] = Field(
        description="PASS if outline meets quality threshold; REVISION_REQUIRED if changes needed"
    )
    overall_score: float = Field(
        ge=0.0, le=1.0,
        description="Weighted average score across all dimensions (0.0-1.0). Threshold for PASS is typically 0.7"
    )
    dimensions: OutlineCriticDimensions = Field(
        description="Individual scores for each evaluation dimension"
    )
    revision_guidance: List[str] = Field(
        default_factory=list,
        description="Prioritized list of specific, actionable changes needed. Most important first. Empty if PASS."
    )
    summary: str = Field(
        description="Brief (2-3 sentence) explanation of the verdict and key observations"
    )

    @field_validator("revision_guidance")
    @classmethod
    def validate_revision_guidance(cls, v: List[str], info) -> List[str]:
        """Ensure revision guidance is provided when verdict is REVISION_REQUIRED."""
        # Access other field values from info.data
        verdict = info.data.get("verdict")
        if verdict == "REVISION_REQUIRED" and len(v) == 0:
            raise ValueError(
                "revision_guidance must contain at least one item when verdict is REVISION_REQUIRED"
            )
        return v


# ═══════════════════════════════════════════════════════════════════════════════
# Lesson Critic Models
# ═══════════════════════════════════════════════════════════════════════════════

class LessonCriticDimensions(BaseModel):
    """Five dimensions for evaluating a single lesson.

    Dimensions:
        coverage: Are the assigned standards adequately addressed in lesson cards?
        sequencing: Does card flow follow pedagogical best practices?
        policy: Are engagement tags and CFU requirements honored?
        accessibility: Are appropriate adaptations provided for diverse learners?
        authenticity: Is Scottish context used? Are examples relevant and real-world?
    """

    coverage: DimensionScore = Field(
        description="Are all assigned standards from the outline adequately addressed in the lesson cards?"
    )
    sequencing: DimensionScore = Field(
        description="Does card flow follow pedagogical sequence? (starter → explainer → modelling → practice → exit_ticket)"
    )
    policy: DimensionScore = Field(
        description="Are engagement_tags honored? Is CFU (Check For Understanding) specific and meaningful?"
    )
    accessibility: DimensionScore = Field(
        description="Are adaptations provided for diverse learners? Visual supports, scaffolding, extension activities?"
    )
    authenticity: DimensionScore = Field(
        description="Is Scottish context used where appropriate? Are examples real-world and culturally relevant?"
    )


class LessonCriticResult(BaseModel):
    """Result from the per-lesson critic evaluation.

    This model is used as the structured output schema for the lesson critic.
    Each lesson is individually evaluated after generation to ensure quality.

    Attributes:
        verdict: PASS if lesson meets all criteria; REVISION_REQUIRED if changes needed
        overall_score: Weighted average of dimension scores (0.0-1.0)
        lesson_order: Which lesson (1, 2, 3...) was evaluated
        dimensions: Individual scores for each evaluation dimension
        revision_guidance: Prioritized list of specific changes needed (if REVISION_REQUIRED)
        summary: Brief human-readable explanation of the verdict
    """

    verdict: Literal["PASS", "REVISION_REQUIRED"] = Field(
        description="PASS if lesson meets quality threshold; REVISION_REQUIRED if changes needed"
    )
    overall_score: float = Field(
        ge=0.0, le=1.0,
        description="Weighted average score across all dimensions (0.0-1.0). Threshold for PASS is typically 0.7"
    )
    lesson_order: int = Field(
        ge=1,
        description="The order (1, 2, 3...) of the lesson that was evaluated"
    )
    dimensions: LessonCriticDimensions = Field(
        description="Individual scores for each evaluation dimension"
    )
    revision_guidance: List[str] = Field(
        default_factory=list,
        description="Prioritized list of specific, actionable changes for this lesson. Most important first. Empty if PASS."
    )
    summary: str = Field(
        description="Brief (2-3 sentence) explanation of the verdict and key observations for this lesson"
    )

    @field_validator("revision_guidance")
    @classmethod
    def validate_revision_guidance(cls, v: List[str], info) -> List[str]:
        """Ensure revision guidance is provided when verdict is REVISION_REQUIRED."""
        verdict = info.data.get("verdict")
        if verdict == "REVISION_REQUIRED" and len(v) == 0:
            raise ValueError(
                "revision_guidance must contain at least one item when verdict is REVISION_REQUIRED"
            )
        return v


# ═══════════════════════════════════════════════════════════════════════════════
# Convenience Functions
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_overall_score(dimensions: OutlineCriticDimensions | LessonCriticDimensions) -> float:
    """Calculate weighted average score across all dimensions.

    Equal weighting is used (each dimension counts equally).

    Args:
        dimensions: Either OutlineCriticDimensions or LessonCriticDimensions

    Returns:
        Average score across all dimensions (0.0-1.0)
    """
    scores = [
        dimensions.coverage.score,
        dimensions.sequencing.score,
    ]

    # Add dimension-specific scores
    if isinstance(dimensions, OutlineCriticDimensions):
        scores.extend([
            dimensions.balance.score,
            dimensions.progression.score,
            dimensions.chunking.score,
        ])
    elif isinstance(dimensions, LessonCriticDimensions):
        scores.extend([
            dimensions.policy.score,
            dimensions.accessibility.score,
            dimensions.authenticity.score,
        ])

    return sum(scores) / len(scores)


def should_pass(overall_score: float, threshold: float = 0.7) -> bool:
    """Determine if a score meets the passing threshold.

    Args:
        overall_score: The calculated overall score (0.0-1.0)
        threshold: Minimum score to pass (default 0.7)

    Returns:
        True if score >= threshold
    """
    return overall_score >= threshold


# ═══════════════════════════════════════════════════════════════════════════════
# Export All Models
# ═══════════════════════════════════════════════════════════════════════════════

__all__ = [
    "DimensionScore",
    "OutlineCriticDimensions",
    "OutlineCriticResult",
    "LessonCriticDimensions",
    "LessonCriticResult",
    "calculate_overall_score",
    "should_pass",
]
