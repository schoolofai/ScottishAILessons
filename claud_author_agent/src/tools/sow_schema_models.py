"""Pydantic models for SOW schema validation.

This module defines the complete schema for Scottish AI Lessons Scheme of Work (SOW)
using Pydantic for fast, deterministic validation. Replaces the 1265-line markdown
schema file with Python-native validation.

Validated against: example_sow.json (12 entries, 74 cards, National 3 Physics)
"""

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Literal, Union, Dict, Any
from enum import Enum


class CardType(str, Enum):
    """Valid card types for lesson plan cards."""
    STARTER = "starter"
    EXPLAINER = "explainer"
    MODELLING = "modelling"
    GUIDED_PRACTICE = "guided_practice"
    INDEPENDENT_PRACTICE = "independent_practice"
    EXIT_TICKET = "exit_ticket"


class LessonType(str, Enum):
    """Valid lesson types for SOW entries.

    IMPORTANT: Only these 5 values are valid:
    - teach: Core teaching lessons with new content
    - independent_practice: Skill consolidation with minimal scaffolding
    - formative_assessment: Progress check with no scaffolding
    - revision: Review and consolidation of previously taught content
    - mock_exam: Exam preparation simulating real SQA conditions (exactly 1 per course)
    """
    TEACH = "teach"
    INDEPENDENT_PRACTICE = "independent_practice"
    FORMATIVE_ASSESSMENT = "formative_assessment"
    REVISION = "revision"
    MOCK_EXAM = "mock_exam"


class CalculatorSection(str, Enum):
    """Calculator policy for lesson."""
    NON_CALC = "non_calc"
    MIXED = "mixed"
    CALC = "calc"
    EXAM_CONDITIONS = "exam_conditions"


class CEFRLevel(str, Enum):
    """Common European Framework of Reference language levels."""
    CEFR_A1 = "CEFR_A1"
    CEFR_A2 = "CEFR_A2"
    CEFR_B1 = "CEFR_B1"
    CEFR_B2 = "CEFR_B2"


class AssessmentStandardRef(BaseModel):
    """Enriched assessment standard reference (DEPRECATED - use StandardOrSkillRef).

    Must include exact SQA description from Course_data.txt - no paraphrasing.

    DEPRECATED: This model is kept for backward compatibility with National 1-4 SOWs.
    New SOWs should use StandardOrSkillRef which supports both unit-based and skills-based structures.
    """
    code: str = Field(..., description="Assessment standard code (e.g., 'AS1.2' or '2.1')")
    description: str = Field(..., min_length=5, description="Exact SQA description from Course_data.txt")
    outcome: str = Field(..., description="Parent outcome reference (e.g., 'O1' or '2')")

    class Config:
        str_strip_whitespace = True


class SkillRef(BaseModel):
    """Reference to a skill from skills_framework (National 5+ courses).

    Skills-based courses (National 5, Higher, Advanced Higher) use skills instead of
    assessment standards. Each skill has a name and description from Course_data.txt.

    Example from National 5 Mathematics:
        skill_name: "Working with surds"
        description: "Simplification, Rationalising denominators"
    """
    skill_name: str = Field(..., min_length=5, description="Skill name from Course_data.txt skills_framework.skills[].name")
    description: str = Field(..., min_length=10, description="Exact skill description from Course_data.txt skills_framework.skills[].description")

    class Config:
        str_strip_whitespace = True


class StandardOrSkillRef(BaseModel):
    """Unified reference supporting both unit-based and skills-based course structures.

    This model replaces AssessmentStandardRef and SkillRef to support both:
    - **Unit-based** (National 1-4): Uses code, description, outcome
    - **Skills-based** (National 5+): Uses skill_name, description

    The structure type is detected from Course_data.txt structure_type field.

    Examples:
        Unit-based: {"code": "AS1.2", "description": "Add fractions...", "outcome": "O1"}
        Skills-based: {"skill_name": "Working with surds", "description": "Simplification, Rationalising denominators"}
    """
    # Unit-based fields (Optional for skills-based)
    code: Optional[str] = Field(None, description="Assessment standard code (unit-based only, e.g., 'AS1.2')")
    outcome: Optional[str] = Field(None, description="Parent outcome reference (unit-based only, e.g., 'O1')")

    # Skills-based fields (Optional for unit-based)
    skill_name: Optional[str] = Field(None, description="Skill name (skills-based only)")

    # Common field (REQUIRED for both)
    description: str = Field(..., min_length=5, description="Exact SQA description or skill description from Course_data.txt")

    class Config:
        str_strip_whitespace = True

    @model_validator(mode='after')
    def validate_structure_type(self):
        """Ensure exactly one structure type is used."""
        is_unit_based = self.code is not None or self.outcome is not None
        is_skills_based = self.skill_name is not None

        if is_unit_based and is_skills_based:
            raise ValueError(
                "Cannot mix unit-based (code/outcome) with skills-based (skill_name) in same reference. "
                "Use either unit-based structure (code + outcome + description) OR "
                "skills-based structure (skill_name + description)."
            )

        if not is_unit_based and not is_skills_based:
            raise ValueError(
                "Must provide either unit-based fields (code, outcome) OR skills-based field (skill_name). "
                "Check Course_data.txt structure_type to determine which structure to use."
            )

        # Unit-based validation
        if is_unit_based:
            if not self.code or not self.outcome:
                raise ValueError(
                    "Unit-based structure requires BOTH code AND outcome. "
                    f"Provided: code={self.code}, outcome={self.outcome}"
                )

        # Skills-based validation
        if is_skills_based:
            if not self.skill_name:
                raise ValueError("Skills-based structure requires skill_name")

        return self


class MisconceptionAddressed(BaseModel):
    """Common student misconception and its remediation strategy."""
    misconception: str = Field(..., min_length=10)
    remediation: str = Field(..., min_length=10)


class RubricCriterion(BaseModel):
    """Single rubric criterion with points."""
    description: str = Field(..., min_length=5)
    points: int = Field(..., ge=1)


class RubricGuidance(BaseModel):
    """Rubric guidance for assessment cards.

    Criteria points must sum to total_points.
    """
    total_points: int = Field(..., ge=1)
    criteria: List[Union[RubricCriterion, str]] = Field(..., min_length=1)

    @model_validator(mode='after')
    def normalize_criteria(self):
        """Normalize criteria: accept RubricCriterion objects OR strings with embedded points.

        Agent may produce:
        - Objects: [{"description": "Correct method", "points": 1}] ✓
        - Strings: ["Correct method (1 pt)", "Accurate calc (1 pt)"]

        We parse strings like "Description (N pt)" to extract description and points.
        """
        import re
        normalized = []
        for item in self.criteria:
            if isinstance(item, str):
                # Parse "Description (N pt)" or "Description (N pts)"
                match = re.search(r'(.+?)\s*\((\d+)\s*pts?\)', item)
                if match:
                    normalized.append(RubricCriterion(
                        description=match.group(1).strip(),
                        points=int(match.group(2))
                    ))
                else:
                    # No points found, default to 1 point
                    normalized.append(RubricCriterion(
                        description=item.strip(),
                        points=1
                    ))
            else:
                normalized.append(item)
        self.criteria = normalized
        return self

    @model_validator(mode='after')
    def validate_points_sum(self):
        """Validate that criteria points sum to total_points."""
        criteria_sum = sum(c.points for c in self.criteria)
        if criteria_sum != self.total_points:
            raise ValueError(
                f"Rubric validation failed: Criteria points sum ({criteria_sum}) "
                f"!= total_points ({self.total_points})"
            )
        return self


class Card(BaseModel):
    """Card structure with complete validation.

    Cards are the atomic units of lesson content. Each card must have:
    - Specific CFU strategy (NOT generic phrases like "ask questions")
    - Enriched standards_addressed (objects, not bare strings)
    - Sequential card_number (1, 2, 3...)

    Note: standards_addressed now uses StandardOrSkillRef to support both:
    - Unit-based courses (National 1-4): code, outcome, description
    - Skills-based courses (National 5+): skill_name, description
    """
    card_number: int = Field(..., ge=1)
    card_type: CardType
    title: str = Field(..., min_length=5)
    purpose: str = Field(..., min_length=10)
    standards_addressed: List[StandardOrSkillRef] = Field(default_factory=list)
    pedagogical_approach: str = Field(..., min_length=20)
    key_concepts: Optional[List[str]] = None
    worked_example: Optional[str] = None
    practice_problems: Optional[List[Union[str, Dict[str, Any]]]] = None
    cfu_strategy: str = Field(..., min_length=5)
    misconceptions_addressed: Optional[List[MisconceptionAddressed]] = None
    rubric_guidance: Optional[RubricGuidance] = None
    estimated_minutes: Optional[int] = Field(None, ge=1, description="Optional estimated minutes for the card (metadata only, not validated)")

    @model_validator(mode='after')
    def normalize_practice_problems(self):
        """Normalize practice_problems: accept strings OR dicts, convert to strings.

        Agent may produce:
        - Strings: ["problem text"] ✓
        - Dicts: [{"problem": "text", "complexity": "medium", "scottish_context": true}]

        We extract the 'problem' field from dicts and discard metadata.
        """
        if self.practice_problems:
            normalized = []
            for item in self.practice_problems:
                if isinstance(item, dict):
                    # Extract 'problem' field, fallback to string representation
                    normalized.append(item.get('problem', str(item)))
                else:
                    normalized.append(item)
            self.practice_problems = normalized
        return self

    class Config:
        str_strip_whitespace = True


class LessonPlan(BaseModel):
    """Complete lesson plan with 1-12 cards and pedagogical metadata."""
    summary: str = Field(..., min_length=50, max_length=500)
    card_structure: List[Card] = Field(..., min_length=1, max_length=12)
    lesson_flow_summary: str = Field(..., min_length=20)
    multi_standard_integration_strategy: str = Field(..., min_length=20)
    misconceptions_embedded_in_cards: Union[List[str], str] = Field(default_factory=list)
    assessment_progression: str = Field(..., min_length=20)

    @model_validator(mode='after')
    def normalize_misconceptions(self):
        """Normalize misconceptions_embedded_in_cards: accept array OR single string.

        Agent may produce:
        - Array: ["Card 3: misconception 1", "Card 4: misconception 2"] ✓
        - String: "Card 3 addresses... Card 4 addresses..." (concatenated)

        We convert strings to single-item arrays.
        """
        misc = self.misconceptions_embedded_in_cards
        if isinstance(misc, str):
            self.misconceptions_embedded_in_cards = [misc]
        return self

    @model_validator(mode='after')
    def validate_card_numbers_sequential(self):
        """Validate card numbers are sequential 1, 2, 3..."""
        if not self.card_structure:
            return self

        expected = list(range(1, len(self.card_structure) + 1))
        actual = [c.card_number for c in self.card_structure]

        if actual != expected:
            raise ValueError(
                f"Card numbers must be sequential 1..{len(self.card_structure)}, "
                f"got {actual}"
            )
        return self


class AccessibilityProfile(BaseModel):
    """Accessibility features for dyslexia-friendly and inclusive design.

    Agent may produce custom fields (text_complexity, visual_aids, etc.) - we ignore them.
    """
    dyslexia_friendly: bool
    plain_language_level: Optional[CEFRLevel] = None  # Optional - agent may omit
    extra_time: Optional[bool] = None  # Optional - agent may omit
    extra_time_percentage: Optional[int] = Field(None, ge=0, le=100)
    key_terms_simplified: Optional[List[str]] = None
    visual_support_strategy: Optional[str] = None

    class Config:
        extra = "ignore"  # Ignore agent's custom fields like text_complexity


class Coherence(BaseModel):
    """Coherence metadata linking lesson to curriculum structure."""
    block_name: str = Field(..., min_length=5)
    block_index: str = Field(..., min_length=1, max_length=10)
    prerequisites: Optional[List[str]] = Field(default_factory=list)


class Policy(BaseModel):
    """SQA policy guardrails for calculator usage and assessment."""
    calculator_section: CalculatorSection
    assessment_notes: Optional[str] = None


class SOWEntry(BaseModel):
    """Single lesson entry in SOW with complete pedagogical design.

    Each entry represents one ~50-minute lesson in the course sequence.

    Structure awareness:
    - Unit-based courses (National 1-4): standards_or_skills_addressed contains code/outcome/description
    - Skills-based courses (National 5+): standards_or_skills_addressed contains skill_name/description
    - Legacy fields (outcomeRefs, assessmentStandardRefs) deprecated but kept for backward compatibility
    """
    order: int = Field(..., ge=1)
    label: str = Field(..., min_length=10)
    lesson_type: LessonType
    coherence: Coherence
    policy: Policy
    engagement_tags: List[str] = Field(..., min_length=1)

    # NEW unified field for both unit-based and skills-based courses
    standards_or_skills_addressed: List[StandardOrSkillRef] = Field(default_factory=list)

    # DEPRECATED fields for backward compatibility (National 1-4 legacy)
    outcomeRefs: Optional[List[str]] = Field(None, description="DEPRECATED: Use standards_or_skills_addressed")
    assessmentStandardRefs: Optional[List[AssessmentStandardRef]] = Field(None, description="DEPRECATED: Use standards_or_skills_addressed")

    lesson_plan: LessonPlan
    accessibility_profile: AccessibilityProfile
    estMinutes: Optional[int] = Field(None, ge=1, description="Optional estimated minutes for the lesson (metadata only, not validated)")
    lesson_instruction: str = Field(..., min_length=50)


class MetadataCoherence(BaseModel):
    """Course-level coherence notes."""
    policy_notes: List[str] = Field(..., min_length=1)
    sequencing_notes: List[str] = Field(..., min_length=1)


class Metadata(BaseModel):
    """Course-level metadata and strategic guidance."""
    coherence: MetadataCoherence
    accessibility_notes: List[str] = Field(..., min_length=1)
    engagement_notes: List[str] = Field(..., min_length=1)
    weeks: Optional[int] = Field(None, ge=1, le=52)
    periods_per_week: Optional[int] = Field(None, ge=1, le=10)


class AuthoredSOW(BaseModel):
    """Complete authored SOW with full validation.

    Validated against example_sow.json structure (National 3 Physics, 12 entries).

    Top-level structure includes:
    - Database fields: $id, courseId, version, status
    - Content: metadata, entries
    - Top-level accessibility_notes (string summary)

    Note: metadata.accessibility_notes (array) vs top-level accessibility_notes (string)
    """
    # Database-managed fields (optional - agent doesn't provide, upserter adds)
    id: Optional[str] = Field(None, alias="$id")
    courseId: Optional[str] = Field(None, min_length=5)
    version: Optional[str] = None
    status: Optional[Literal["draft", "published"]] = None

    # Core content
    metadata: Metadata
    entries: List[SOWEntry] = Field(..., min_length=1)  # Min 1 entry, no max (agent determines appropriate length)

    # Top-level accessibility summary (string, not array) - optional
    accessibility_notes: Optional[str] = Field(None, min_length=50)

    @model_validator(mode='after')
    def validate_entry_order_sequential(self):
        """Validate entry order is sequential 1, 2, 3..."""
        if not self.entries:
            return self

        expected = list(range(1, len(self.entries) + 1))
        actual = [e.order for e in self.entries]

        if actual != expected:
            raise ValueError(
                f"Entry order must be sequential 1..{len(self.entries)}, "
                f"got {actual}"
            )
        return self

    @model_validator(mode='after')
    def validate_teach_revision_pairing(self):
        """Validate every teach lesson has a corresponding revision lesson.

        Revision should appear within 3 entries of the teach lesson (1:1 pairing).
        """
        if not self.entries:
            return self

        teach_orders = [e.order for e in self.entries if e.lesson_type == LessonType.TEACH]
        revision_orders = [e.order for e in self.entries if e.lesson_type == LessonType.REVISION]

        unpaired = []
        for teach_order in teach_orders:
            # Look for revision within next 3 entries
            has_pair = any(
                abs(rev_order - teach_order) <= 3
                for rev_order in revision_orders
            )
            if not has_pair:
                unpaired.append(teach_order)

        if unpaired:
            raise ValueError(
                f"Teach lessons at orders {unpaired} have no corresponding revision lesson "
                f"within 3 entries. Every teach lesson must be paired with a revision lesson."
            )
        return self

    @model_validator(mode='after')
    def validate_course_requirements(self):
        """Validate course-level lesson type requirements.

        Requirements:
        - At least 1 independent_practice lesson
        - Exactly 1 mock_assessment lesson
        """
        if not self.entries:
            return self

        lesson_types = [e.lesson_type for e in self.entries]

        # Count independent_practice
        independent_count = lesson_types.count(LessonType.INDEPENDENT_PRACTICE)
        if independent_count < 1:
            raise ValueError(
                f"Course must have at least 1 independent_practice lesson, found {independent_count}"
            )

        # Count mock_exam
        mock_count = lesson_types.count(LessonType.MOCK_EXAM)
        if mock_count != 1:
            raise ValueError(
                f"Course must have exactly 1 mock_exam lesson, found {mock_count}"
            )

        return self

    class Config:
        populate_by_name = True  # Allow $id alias
        str_strip_whitespace = True
