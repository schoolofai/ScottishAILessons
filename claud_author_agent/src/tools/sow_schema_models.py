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
    """Valid lesson types for SOW entries."""
    TEACH = "teach"
    REVISION = "revision"
    FORMATIVE_ASSESSMENT = "formative_assessment"
    INDEPENDENT_PRACTICE = "independent_practice"
    MOCK_ASSESSMENT = "mock_assessment"
    SPIRAL_REVISIT = "spiral_revisit"


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
    """Enriched assessment standard reference.

    Must include exact SQA description from Course_data.txt - no paraphrasing.
    """
    code: str = Field(..., description="Assessment standard code (e.g., 'AS1.2' or '2.1')")
    description: str = Field(..., min_length=5, description="Exact SQA description from Course_data.txt")
    outcome: str = Field(..., description="Parent outcome reference (e.g., 'O1' or '2')")

    class Config:
        str_strip_whitespace = True


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
    """
    card_number: int = Field(..., ge=1)
    card_type: CardType
    title: str = Field(..., min_length=5)
    purpose: str = Field(..., min_length=10)
    standards_addressed: List[AssessmentStandardRef] = Field(default_factory=list)
    pedagogical_approach: str = Field(..., min_length=20)
    key_concepts: Optional[List[str]] = None
    worked_example: Optional[str] = None
    practice_problems: Optional[List[Union[str, Dict[str, Any]]]] = None
    cfu_strategy: str = Field(..., min_length=5)
    misconceptions_addressed: Optional[List[MisconceptionAddressed]] = None
    rubric_guidance: Optional[RubricGuidance] = None
    estimated_minutes: int = Field(..., ge=1)

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
    """
    order: int = Field(..., ge=1)
    label: str = Field(..., min_length=10)
    lesson_type: LessonType
    coherence: Coherence
    policy: Policy
    engagement_tags: List[str] = Field(..., min_length=1)
    outcomeRefs: List[str] = Field(..., min_length=1)
    assessmentStandardRefs: List[AssessmentStandardRef] = Field(default_factory=list)  # Allow empty for synthesis lessons
    lesson_plan: LessonPlan
    accessibility_profile: AccessibilityProfile
    estMinutes: int = Field(..., ge=1)
    lesson_instruction: str = Field(..., min_length=50)

    @model_validator(mode='after')
    def validate_card_timings_match_estMinutes(self):
        """Validate card estimated_minutes sum to entry estMinutes (±2 min tolerance)."""
        if not self.lesson_plan or not self.lesson_plan.card_structure:
            return self

        card_total = sum(c.estimated_minutes for c in self.lesson_plan.card_structure)
        tolerance = 2

        if abs(card_total - self.estMinutes) > tolerance:
            raise ValueError(
                f"Entry {self.order}: Card timings sum to {card_total} minutes "
                f"but estMinutes is {self.estMinutes} (tolerance ±{tolerance} min)"
            )
        return self


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

        # Count mock_assessment
        mock_count = lesson_types.count(LessonType.MOCK_ASSESSMENT)
        if mock_count != 1:
            raise ValueError(
                f"Course must have exactly 1 mock_assessment lesson, found {mock_count}"
            )

        return self

    class Config:
        populate_by_name = True  # Allow $id alias
        str_strip_whitespace = True
