"""
Nat5+ Question Generation Schemas (Small Structured Outputs)

These models define smaller schemas for granular question-by-question
generation using Claude Agent SDK structured outputs.

Key insight: Generating questions one at a time (2-3K tokens) is more
reliable than generating an entire exam (9K+ tokens) in one call.

Used by: question_generator_agent.py
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# =============================================================================
# Planning Phase Models
# =============================================================================

class QuestionSpec(BaseModel):
    """Specification for a single question to be generated.

    Created during the planning phase to guide question generation.

    DESIGN PRINCIPLE: No subject-specific fields (e.g., no "pure_math", "geometric").
    Let the LLM determine appropriate context/approach based on subject.
    This ensures the system works for Mathematics, English, History, or any SQA subject.
    """
    # Core fields
    topic: str = Field(..., description="SOW topic to test")
    template_paper_id: str = Field(..., description="Past paper to use as style template")
    marks: int = Field(..., description="Target marks for question")
    difficulty: Literal["easy", "medium", "hard"] = Field(..., description="Difficulty level")
    question_style: Literal["procedural", "application", "problem_solving"] = Field(
        default="procedural",
        description="Style: procedural, application, problem_solving"
    )

    # SUBJECT CONTEXT - passed to LLM for appropriate generation
    subject: str = Field(default="", description="Subject name, e.g., 'Mathematics', 'English', 'History'")
    level: str = Field(default="", description="Qualification level, e.g., 'National 5', 'Higher'")

    # GENERIC DIVERSITY FIELDS - work for ANY subject
    sub_topic_focus: str = Field(default="", description="Specific learning outcome from SOW to target")
    learning_outcome_id: str = Field(default="", description="SOW outcome ID for traceability")
    variation_seed: int = Field(default=0, description="Random seed to inspire unique variations")
    avoid_patterns: List[str] = Field(default_factory=list, description="Stem patterns already used to avoid")
    question_position: int = Field(default=0, description="Position in exam (1-15) for difficulty curve")


class ExamPlan(BaseModel):
    """Plan for the entire exam structure.

    Created before generating individual questions to ensure
    proper coverage and distribution.
    """
    question_specs: List[QuestionSpec] = Field(
        ...,
        description="Specifications for each question"
    )
    target_total_marks: int = Field(default=90, description="Target total marks")
    section_distribution: Dict[str, int] = Field(
        default_factory=dict,
        description="Marks per section"
    )


# =============================================================================
# Question Generation Models (Small Structured Output)
# =============================================================================

class GenericSchemeBullet(BaseModel):
    """Generic marking scheme bullet for generation output."""
    bullet: int
    process: str
    marks: int = 1


class IllustrativeAnswerGen(BaseModel):
    """Illustrative answer for generation output."""
    bullet: int
    answer: str
    answer_latex: Optional[str] = None


class MarkingSchemeGen(BaseModel):
    """Marking scheme for generation output."""
    max_marks: int
    generic_scheme: List[GenericSchemeBullet]
    illustrative_scheme: List[IllustrativeAnswerGen]
    notes: List[str] = Field(default_factory=list)


class DiagramSpec(BaseModel):
    """Specification for generating a diagram."""
    diagram_type: Literal["desmos", "matplotlib", "jsxgraph", "plotly", "tikz"]
    description: str = Field(..., description="What the diagram should show")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tool-specific parameters"
    )


class QuestionGeneration(BaseModel):
    """Single question output from the generator.

    This is the structured output schema for generating ONE question
    at a time. Keeping it small (~2-3K tokens) ensures reliable parsing.

    Used with Claude Agent SDK:
        options = ClaudeAgentOptions(
            output_format={
                "type": "json_schema",
                "schema": wrap_schema_for_sdk_structured_output(
                    QuestionGeneration.model_json_schema()
                )
            }
        )
    """
    question_id: str = Field(..., description="Unique identifier")
    question_number: str = Field(..., description="Display number")
    marks: int = Field(..., description="Total marks")
    difficulty: Literal["easy", "medium", "hard"]

    # Content
    stem: str = Field(..., description="Question text (plain)")
    stem_latex: str = Field(..., description="Question text with LaTeX")

    # Marking
    marking_scheme: MarkingSchemeGen

    # Diagram (optional)
    diagram_needed: bool = Field(default=False)
    diagram_spec: Optional[DiagramSpec] = None

    # Metadata
    topic_ids: List[str] = Field(default_factory=list)
    hints: List[str] = Field(default_factory=list)
    common_errors: List[str] = Field(default_factory=list)


# =============================================================================
# Critic/Validation Models
# =============================================================================

class ValidationIssue(BaseModel):
    """Issue found during question validation."""
    severity: Literal["error", "warning", "info"]
    category: str = Field(..., description="Issue category")
    message: str = Field(..., description="Description of issue")
    suggestion: Optional[str] = Field(None, description="How to fix")


class CriticResult(BaseModel):
    """Result from question critic agent.

    Validates questions against SQA standards and quality criteria.
    """
    passed: bool = Field(..., description="Whether question passed validation")
    score: float = Field(default=0.0, description="Quality score 0-1")
    issues: List[ValidationIssue] = Field(default_factory=list)
    feedback: str = Field(default="", description="Overall feedback")

    # Specific checks
    sqa_alignment_ok: bool = Field(default=True)
    marking_scheme_valid: bool = Field(default=True)
    difficulty_appropriate: bool = Field(default=True)
    latex_valid: bool = Field(default=True)
