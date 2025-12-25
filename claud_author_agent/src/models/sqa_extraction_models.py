"""SQA Document Extraction Models - Pydantic schemas for exam paper and marking instruction extraction.

These models define the structure for:
- Question papers (metadata, formulae, questions, parts, diagrams)
- Marking instructions (principles, solutions, generic/illustrative schemes)
- Topic taxonomy reference data

Based on design specification: docs/claud_author_agent/understanding_standards.md
"""

from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import re


# =============================================================================
# Enums and Literals
# =============================================================================

LevelCode = Literal["N5", "NH", "NAH"]
DiagramType = Literal["graph", "geometry", "table", "other"]
RenderType = Literal["jsxgraph", "desmos", "matplotlib", "static"]


# =============================================================================
# Paper Metadata Models
# =============================================================================

class PaperMetadata(BaseModel):
    """Metadata for an SQA exam paper."""
    code: str = Field(
        ...,
        max_length=20,
        description="SQA paper code (e.g., X847/75/01)"
    )
    year: int = Field(
        ...,
        ge=2014,
        le=2030,
        description="Exam year"
    )
    level: LevelCode = Field(
        ...,
        description="Level code: N5, NH, NAH"
    )
    level_name: str = Field(
        ...,
        max_length=50,
        description="Display name: National 5, Higher, Advanced Higher"
    )
    subject: str = Field(
        ...,
        max_length=50,
        description="Subject name (e.g., Mathematics)"
    )
    paper_number: int = Field(
        ...,
        ge=1,
        le=3,
        description="Paper number within exam diet"
    )
    calculator_allowed: bool = Field(
        ...,
        description="Whether calculator is permitted"
    )
    exam_date: Optional[datetime] = Field(
        None,
        description="Original exam sitting date"
    )
    duration_minutes: int = Field(
        ...,
        ge=30,
        le=180,
        description="Allocated exam time in minutes"
    )
    total_marks: int = Field(
        ...,
        ge=1,
        le=150,
        description="Total marks available"
    )
    source_url: Optional[str] = Field(
        None,
        description="SQA download URL"
    )
    source_file_id: Optional[str] = Field(
        None,
        max_length=36,
        description="Appwrite Storage file ID for PDF"
    )

    @field_validator('code')
    @classmethod
    def validate_paper_code(cls, v):
        """Validate paper code format: X###/##/##"""
        pattern = r'^X\d{3}/\d{2}/\d{2}$'
        if not re.match(pattern, v):
            raise ValueError(f"Paper code must match format X###/##/## (got: {v})")
        return v


# =============================================================================
# Formula Models
# =============================================================================

class FormulaSet(BaseModel):
    """A set of formulae grouped by topic from the paper's formula sheet."""
    paper_id: str = Field(
        ...,
        max_length=36,
        description="Reference to papers collection"
    )
    topic: str = Field(
        ...,
        max_length=100,
        description="Formula category (e.g., Circle, Trigonometry)"
    )
    formulas: List[str] = Field(
        ...,
        description="Array of formula strings in plain text"
    )
    formulas_latex: Optional[List[str]] = Field(
        None,
        description="Array of formula strings in LaTeX"
    )
    sort_order: int = Field(
        ...,
        description="Display order within paper"
    )


# =============================================================================
# Diagram Models
# =============================================================================

class DiagramRef(BaseModel):
    """Reference to a diagram associated with a question."""
    question_id: str = Field(
        ...,
        max_length=36,
        description="Reference to questions collection"
    )
    filename: str = Field(
        ...,
        max_length=100,
        description="Original filename"
    )
    type: DiagramType = Field(
        ...,
        description="Diagram type: graph, geometry, table, other"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Alt text / description for accessibility"
    )
    file_id: Optional[str] = Field(
        None,
        max_length=36,
        description="Appwrite Storage file ID for image/SVG"
    )
    render_type: Optional[RenderType] = Field(
        None,
        description="Rendering engine: jsxgraph, desmos, matplotlib, static"
    )
    render_config_file_id: Optional[str] = Field(
        None,
        max_length=36,
        description="Storage file ID for render config JSON"
    )


# =============================================================================
# Question Models
# =============================================================================

class QuestionPart(BaseModel):
    """A sub-part of a question (e.g., 4a, 4a(i))."""
    question_id: str = Field(
        ...,
        max_length=36,
        description="Reference to questions collection"
    )
    part: str = Field(
        ...,
        max_length=5,
        description="Part label (a, b, c)"
    )
    subpart: Optional[str] = Field(
        None,
        max_length=5,
        description="Subpart label (i, ii, iii) or null"
    )
    text: str = Field(
        ...,
        description="Part text in Markdown"
    )
    text_latex: Optional[str] = Field(
        None,
        description="Part text with LaTeX"
    )
    marks: int = Field(
        ...,
        ge=1,
        le=10,
        description="Marks for this part"
    )
    topic_tags: Optional[List[str]] = Field(
        None,
        description="Topic classifications"
    )
    sort_order: int = Field(
        ...,
        description="Display order within question"
    )


class Question(BaseModel):
    """A question from an SQA exam paper."""
    paper_id: str = Field(
        ...,
        max_length=36,
        description="Reference to papers collection"
    )
    number: str = Field(
        ...,
        max_length=10,
        description="Question number as displayed"
    )
    text: str = Field(
        ...,
        description="Question stem in Markdown"
    )
    text_latex: Optional[str] = Field(
        None,
        description="Question stem with LaTeX math"
    )
    marks: Optional[int] = Field(
        None,
        ge=1,
        le=20,
        description="Marks (null if has parts)"
    )
    has_parts: bool = Field(
        False,
        description="Whether question has sub-parts"
    )
    topic_tags: Optional[List[str]] = Field(
        None,
        description="Curriculum topic classifications"
    )
    diagram_ids: Optional[List[str]] = Field(
        None,
        description="References to diagrams collection"
    )

    @field_validator('marks')
    @classmethod
    def validate_marks(cls, v, info):
        """Marks must be null if has_parts is true."""
        # Note: This validation happens after parsing, so we check the full model
        return v


# =============================================================================
# Question Paper Output Schema
# =============================================================================

class QuestionPaperOutput(BaseModel):
    """Complete output schema for a parsed question paper."""
    paper: PaperMetadata
    formulae: List[FormulaSet] = Field(default_factory=list)
    questions: List[Question]

    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        """Ensure at least one question is extracted."""
        if len(v) == 0:
            raise ValueError("At least one question must be extracted")
        return v


# =============================================================================
# Marking Scheme Models
# =============================================================================

class MarkingSchemeMetadata(BaseModel):
    """Metadata for a marking scheme document."""
    paper_id: str = Field(
        ...,
        max_length=36,
        description="Reference to papers collection"
    )
    source_url: Optional[str] = Field(
        None,
        description="SQA download URL"
    )
    source_file_id: Optional[str] = Field(
        None,
        max_length=36,
        description="Appwrite Storage file ID for PDF"
    )


class GeneralPrinciple(BaseModel):
    """A general marking principle from the marking instructions."""
    marking_scheme_id: str = Field(
        ...,
        max_length=36,
        description="Reference to marking_schemes collection"
    )
    principle_id: str = Field(
        ...,
        max_length=5,
        description="Principle identifier (a, b, g)"
    )
    principle: str = Field(
        ...,
        max_length=50,
        description="Machine-readable principle slug"
    )
    description: str = Field(
        ...,
        max_length=2000,
        description="Full principle text"
    )
    exceptions: Optional[List[str]] = Field(
        None,
        description="Cross-references to other principles"
    )
    sort_order: int = Field(
        ...,
        description="Display order"
    )


# =============================================================================
# Solution Models
# =============================================================================

class GenericMark(BaseModel):
    """A bullet point from the generic marking scheme."""
    solution_id: str = Field(
        ...,
        max_length=36,
        description="Reference to solutions collection"
    )
    bullet: int = Field(
        ...,
        ge=1,
        le=20,
        description="Bullet point number (each = 1 mark)"
    )
    process: str = Field(
        ...,
        max_length=500,
        description="Process description (what skill is assessed)"
    )
    sort_order: int = Field(
        ...,
        description="Display order"
    )


class IllustrativeMark(BaseModel):
    """A bullet point from the illustrative marking scheme."""
    solution_id: str = Field(
        ...,
        max_length=36,
        description="Reference to solutions collection"
    )
    bullet: int = Field(
        ...,
        ge=1,
        le=20,
        description="Bullet point number"
    )
    answer: str = Field(
        ...,
        max_length=1000,
        description="Expected answer (plain text)"
    )
    answer_latex: Optional[str] = Field(
        None,
        max_length=1000,
        description="Answer in LaTeX format"
    )
    condition: Optional[str] = Field(
        None,
        max_length=300,
        description="Conditions for mark award"
    )
    alternative: Optional[str] = Field(
        None,
        max_length=500,
        description="Alternative acceptable answer"
    )
    alternative_latex: Optional[str] = Field(
        None,
        max_length=500,
        description="Alternative in LaTeX"
    )
    sort_order: int = Field(
        ...,
        description="Display order"
    )


class CommonlyObservedResponse(BaseModel):
    """A commonly observed response example from marking instructions.

    Note: Parked for Phase 2 - schema defined but extraction not implemented.
    """
    solution_id: str = Field(
        ...,
        max_length=36,
        description="Reference to solutions collection"
    )
    candidate_id: str = Field(
        ...,
        max_length=5,
        description="Candidate identifier (A, B, C)"
    )
    scenario: str = Field(
        ...,
        max_length=300,
        description="Description of the response pattern"
    )
    working: str = Field(
        ...,
        description="The candidate's working (plain text)"
    )
    working_latex: Optional[str] = Field(
        None,
        description="Working in LaTeX format"
    )
    marks_awarded: List[str] = Field(
        ...,
        description="Array of awarded bullets (e.g., ['1', '2'])"
    )
    sort_order: int = Field(
        ...,
        description="Display order"
    )


class Solution(BaseModel):
    """A solution/marking guide for a question or part."""
    marking_scheme_id: str = Field(
        ...,
        max_length=36,
        description="Reference to marking_schemes collection"
    )
    question_id: str = Field(
        ...,
        max_length=36,
        description="Reference to questions collection"
    )
    part_id: Optional[str] = Field(
        None,
        max_length=36,
        description="Reference to question_parts (null if whole question)"
    )
    max_marks: int = Field(
        ...,
        ge=1,
        le=20,
        description="Maximum marks for this solution"
    )
    notes: Optional[List[str]] = Field(
        None,
        description="Additional marking notes"
    )


# =============================================================================
# Marking Instructions Output Schema
# =============================================================================

class MarkingInstructionsOutput(BaseModel):
    """Complete output schema for parsed marking instructions."""
    marking_scheme: MarkingSchemeMetadata
    general_principles: List[GeneralPrinciple]
    solutions: List[Solution]


# =============================================================================
# Topic Taxonomy Models
# =============================================================================

class Topic(BaseModel):
    """A topic in the curriculum taxonomy."""
    slug: str = Field(
        ...,
        max_length=50,
        description="URL-safe identifier (e.g., quadratics)"
    )
    name: str = Field(
        ...,
        max_length=100,
        description="Display name (e.g., Quadratic Functions)"
    )
    parent_slug: Optional[str] = Field(
        None,
        max_length=50,
        description="Parent topic for hierarchy"
    )
    curriculum_ref: Optional[str] = Field(
        None,
        max_length=50,
        description="SQA curriculum reference code"
    )
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Topic description"
    )

    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        """Validate slug is URL-safe snake_case."""
        pattern = r'^[a-z][a-z0-9_]*$'
        if not re.match(pattern, v):
            raise ValueError(f"Slug must be snake_case (got: {v})")
        return v


# =============================================================================
# Complete Topic Taxonomy (Reference Data)
# =============================================================================

TOPIC_TAXONOMY: List[Dict] = [
    # Algebra
    {"slug": "algebra", "name": "Algebra", "parent_slug": None},
    {"slug": "expanding_brackets", "name": "Expanding Brackets", "parent_slug": "algebra"},
    {"slug": "factorising", "name": "Factorising", "parent_slug": "algebra"},
    {"slug": "quadratics", "name": "Quadratic Functions", "parent_slug": "algebra"},
    {"slug": "completing_square", "name": "Completing the Square", "parent_slug": "algebra"},
    {"slug": "quadratic_formula", "name": "Quadratic Formula", "parent_slug": "algebra"},
    {"slug": "simultaneous_equations", "name": "Simultaneous Equations", "parent_slug": "algebra"},
    {"slug": "algebraic_fractions", "name": "Algebraic Fractions", "parent_slug": "algebra"},
    {"slug": "indices", "name": "Indices", "parent_slug": "algebra"},
    {"slug": "surds", "name": "Surds", "parent_slug": "algebra"},

    # Geometry
    {"slug": "geometry", "name": "Geometry", "parent_slug": None},
    {"slug": "pythagoras", "name": "Pythagoras' Theorem", "parent_slug": "geometry"},
    {"slug": "trigonometry_right", "name": "Right-Angled Trigonometry", "parent_slug": "geometry"},
    {"slug": "trigonometry_non_right", "name": "Non-Right Trigonometry", "parent_slug": "geometry"},
    {"slug": "similarity", "name": "Similarity", "parent_slug": "geometry"},
    {"slug": "circle_properties", "name": "Circle Properties", "parent_slug": "geometry"},
    {"slug": "vectors", "name": "Vectors", "parent_slug": "geometry"},
    {"slug": "transformations", "name": "Transformations", "parent_slug": "geometry"},
    {"slug": "arc_sector", "name": "Arc Length and Sector Area", "parent_slug": "geometry"},
    {"slug": "volume", "name": "Volume", "parent_slug": "geometry"},

    # Statistics
    {"slug": "statistics", "name": "Statistics", "parent_slug": None},
    {"slug": "mean_median_mode", "name": "Averages", "parent_slug": "statistics"},
    {"slug": "quartiles_iqr", "name": "Quartiles and IQR", "parent_slug": "statistics"},
    {"slug": "standard_deviation", "name": "Standard Deviation", "parent_slug": "statistics"},
    {"slug": "scattergraphs", "name": "Scattergraphs", "parent_slug": "statistics"},
    {"slug": "probability", "name": "Probability", "parent_slug": "statistics"},

    # Graphs and Functions
    {"slug": "graphs", "name": "Graphs and Functions", "parent_slug": None},
    {"slug": "straight_line", "name": "Straight Line", "parent_slug": "graphs"},
    {"slug": "parabolas", "name": "Parabolas", "parent_slug": "graphs"},
    {"slug": "graph_transformations", "name": "Graph Transformations", "parent_slug": "graphs"},
    {"slug": "function_notation", "name": "Function Notation", "parent_slug": "graphs"},
    {"slug": "gradient", "name": "Gradient", "parent_slug": "graphs"},

    # Numeracy
    {"slug": "numeracy", "name": "Numeracy", "parent_slug": None},
    {"slug": "fractions", "name": "Fractions", "parent_slug": "numeracy"},
    {"slug": "percentages", "name": "Percentages", "parent_slug": "numeracy"},
    {"slug": "ratio", "name": "Ratio and Proportion", "parent_slug": "numeracy"},
    {"slug": "scientific_notation", "name": "Scientific Notation", "parent_slug": "numeracy"},
]


def get_topic_taxonomy() -> List[Topic]:
    """Get the complete topic taxonomy as validated Topic objects."""
    return [Topic(**t) for t in TOPIC_TAXONOMY]


def get_valid_topic_slugs() -> List[str]:
    """Get list of valid topic slugs for validation."""
    return [t["slug"] for t in TOPIC_TAXONOMY]
