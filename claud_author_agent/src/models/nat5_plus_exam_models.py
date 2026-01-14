"""
Nat5+ Mock Exam Pydantic Models

These models define the complete structure for generated mock exams.
They match the contract fixtures and ensure type compatibility with
the Frontend TypeScript interfaces.

Contract: Author → Frontend (Exam Data)
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# =============================================================================
# Marking Scheme Models (SQA-style)
# =============================================================================

class MarkingBullet(BaseModel):
    """Single marking point in the generic scheme.

    SQA marking schemes award marks per "bullet point" which
    represents a specific step or process in the solution.
    """
    bullet: int = Field(..., description="Bullet number (1, 2, 3...)")
    process: str = Field(..., description="What earns this mark")
    marks: int = Field(default=1, description="Marks for this bullet")


class IllustrativeAnswer(BaseModel):
    """Illustrative (example) answer for a marking bullet.

    Shows what a correct response looks like for each bullet point.
    Includes tolerance ranges for numeric answers and acceptable variations.
    """
    bullet: int = Field(..., description="Corresponding bullet number")
    answer: str = Field(..., description="Example correct answer")
    answer_latex: Optional[str] = Field(None, description="LaTeX version of answer")
    tolerance_range: Optional[str] = Field(None, description="Acceptable tolerance for numeric")
    acceptable_variations: List[str] = Field(
        default_factory=list,
        description="Alternative correct forms"
    )


class MarkingScheme(BaseModel):
    """Complete SQA-style marking scheme for a question.

    Contains both:
    - Generic scheme: What process/steps earn marks
    - Illustrative scheme: Example correct answers
    """
    max_marks: int = Field(..., description="Total marks available")
    generic_scheme: List[MarkingBullet] = Field(
        ...,
        description="Process-based marking points"
    )
    illustrative_scheme: List[IllustrativeAnswer] = Field(
        ...,
        description="Example answers for each bullet"
    )
    notes: List[str] = Field(
        default_factory=list,
        description="Additional marking notes"
    )


# =============================================================================
# Question Models
# =============================================================================

class QuestionDiagram(BaseModel):
    """Diagram reference for a question."""
    diagram_id: str = Field(..., description="Unique diagram identifier")
    diagram_type: str = Field(..., description="Type: desmos, matplotlib, jsxgraph, etc.")
    diagram_url: Optional[str] = Field(None, description="URL if uploaded to storage")
    diagram_spec: Optional[Dict[str, Any]] = Field(None, description="Generation specification")
    description: str = Field(default="", description="Alt text description")


class Nat5PlusQuestion(BaseModel):
    """Complete question structure for Nat5+ mock exam.

    Includes question content, marking scheme, and metadata.
    """
    question_id: str = Field(..., description="Unique question identifier")
    question_number: str = Field(..., description="Display number (1, 2a, 3b(i))")
    marks: int = Field(..., description="Total marks for question")
    difficulty: Literal["easy", "medium", "hard"] = Field(..., description="Difficulty level")
    question_style: str = Field(
        default="procedural",
        description="Style: procedural, application, problem_solving"
    )

    # Question content
    stem: str = Field(..., description="Question text (plain)")
    stem_latex: str = Field(..., description="Question text with LaTeX")

    # Topic and source tracking
    topic_ids: List[str] = Field(default_factory=list, description="SOW topics tested")
    template_paper_id: str = Field(default="", description="Source template paper ID")

    # Marking and assessment
    marking_scheme: MarkingScheme = Field(..., description="SQA-style marking scheme")

    # Visual elements
    diagrams: List[QuestionDiagram] = Field(default_factory=list, description="Question diagrams")

    # Student support
    hints: List[str] = Field(default_factory=list, description="Optional hints")
    common_errors: List[str] = Field(default_factory=list, description="Common mistakes to avoid")


# =============================================================================
# Section and Exam Models
# =============================================================================

class ExamSection(BaseModel):
    """Exam section (e.g., Section A - Non-Calculator)."""
    section_id: str = Field(..., description="Unique section identifier")
    section_name: str = Field(..., description="Display name")
    total_marks: int = Field(..., description="Total marks in section")
    instructions: str = Field(default="", description="Section instructions")
    questions: List[Nat5PlusQuestion] = Field(..., description="Questions in this section")


class ExamMetadata(BaseModel):
    """Metadata about the exam."""
    title: str = Field(..., description="Exam title")
    total_marks: int = Field(..., description="Total marks")
    duration_minutes: int = Field(..., description="Exam duration")
    calculator_allowed: bool = Field(default=True, description="Calculator permitted")
    generated_at: str = Field(default="", description="Generation timestamp")
    sqa_aligned: bool = Field(default=True, description="Aligned with SQA standards")


class GenerationMetadata(BaseModel):
    """Metadata about the generation process."""
    model: str = Field(..., description="LLM model used")
    tokens_used: int = Field(default=0, description="Total tokens consumed")
    generation_timestamp: str = Field(..., description="When generated")
    pipeline_version: str = Field(default="1.0.0", description="Pipeline version")


class DifficultyDistribution(BaseModel):
    """Distribution of question difficulties."""
    easy: float = Field(default=0.3, description="Proportion of easy questions")
    medium: float = Field(default=0.5, description="Proportion of medium questions")
    hard: float = Field(default=0.2, description="Proportion of hard questions")


class Nat5PlusMockExam(BaseModel):
    """Complete Nat5+ Mock Exam structure.

    This is the primary output of the Author Agent and matches
    what the Frontend expects to receive.

    Contract: Author → Frontend
    """
    # Identification
    exam_id: str = Field(..., description="Unique exam identifier")
    course_id: str = Field(..., description="Associated course ID")
    subject: str = Field(..., description="Subject name")
    level: str = Field(..., description="Qualification level (National 5, Higher, etc.)")
    exam_version: int = Field(default=1, description="Version number for this course")
    status: Literal["draft", "published", "archived"] = Field(
        default="draft",
        description="Publication status"
    )

    # Content
    metadata: ExamMetadata = Field(..., description="Exam metadata")
    sections: List[ExamSection] = Field(..., description="Exam sections with questions")

    # Tracking for uniqueness
    topic_coverage: List[str] = Field(default_factory=list, description="All topic IDs covered")
    difficulty_distribution: DifficultyDistribution = Field(
        default_factory=DifficultyDistribution,
        description="Difficulty breakdown"
    )
    template_sources: List[str] = Field(
        default_factory=list,
        description="Paper IDs used as templates"
    )

    # Generation info
    generation_metadata: GenerationMetadata = Field(
        default=None,
        description="Generation details"
    )

    class Config:
        """Pydantic configuration."""
        extra = "allow"  # Allow extra fields from fixture
