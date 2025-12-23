"""Unit tests for SOW Schema Models.

Tests Pydantic validation for:
- LessonType enum
- StandardOrSkillRef (unit-based and skills-based)
- Card structure
- LessonPlan structure
- SOWEntry structure
- Full SOW validation
"""

import pytest
from pydantic import ValidationError

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tools.sow_schema_models import (
    LessonType,
    CardType,
    CalculatorSection,
    CEFRLevel,
    StandardOrSkillRef,
    AssessmentStandardRef,
    SkillRef,
    MisconceptionAddressed,
    RubricCriterion,
    RubricGuidance,
    Card,
    LessonPlan,
    AccessibilityProfile,
    SOWEntry
)


# =============================================================================
# LessonType Enum Tests
# =============================================================================

class TestLessonType:
    """Tests for LessonType enum validation."""

    def test_valid_teach_type(self):
        """Test 'teach' is a valid lesson type."""
        assert LessonType.TEACH.value == "teach"

    def test_valid_revision_type(self):
        """Test 'revision' is a valid lesson type."""
        assert LessonType.REVISION.value == "revision"

    def test_valid_mock_exam_type(self):
        """Test 'mock_exam' is a valid lesson type."""
        assert LessonType.MOCK_EXAM.value == "mock_exam"

    def test_valid_independent_practice_type(self):
        """Test 'independent_practice' is a valid lesson type."""
        assert LessonType.INDEPENDENT_PRACTICE.value == "independent_practice"

    def test_valid_formative_assessment_type(self):
        """Test 'formative_assessment' is a valid lesson type."""
        assert LessonType.FORMATIVE_ASSESSMENT.value == "formative_assessment"

    def test_all_lesson_types_count(self):
        """Test that exactly 5 lesson types exist."""
        assert len(LessonType) == 5


# =============================================================================
# StandardOrSkillRef Tests (Unit-based vs Skills-based)
# =============================================================================

class TestStandardOrSkillRef:
    """Tests for StandardOrSkillRef model - supports both course structures."""

    def test_valid_unit_based_reference(self):
        """Test valid unit-based reference (National 1-4)."""
        ref = StandardOrSkillRef(
            code="AS1.2",
            outcome="O1",
            description="Add and subtract fractions with same denominator"
        )
        assert ref.code == "AS1.2"
        assert ref.outcome == "O1"
        assert ref.skill_name is None

    def test_valid_skills_based_reference(self):
        """Test valid skills-based reference (National 5+)."""
        ref = StandardOrSkillRef(
            skill_name="Working with surds",
            description="Simplification, Rationalising denominators"
        )
        assert ref.skill_name == "Working with surds"
        assert ref.code is None
        assert ref.outcome is None

    def test_mixed_reference_raises_error(self):
        """Test that mixing unit-based and skills-based fields raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardOrSkillRef(
                code="AS1.2",
                outcome="O1",
                skill_name="Working with surds",  # Can't mix with code/outcome
                description="Mixed reference"
            )
        assert "Cannot mix" in str(exc_info.value)

    def test_empty_reference_raises_error(self):
        """Test that reference with only description raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardOrSkillRef(
                description="Just a description with no type indicators"
            )
        assert "Must provide either" in str(exc_info.value)

    def test_unit_based_missing_outcome_raises_error(self):
        """Test that unit-based with code but no outcome raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardOrSkillRef(
                code="AS1.2",
                # outcome missing
                description="Missing outcome field"
            )
        assert "requires BOTH code AND outcome" in str(exc_info.value)

    def test_unit_based_missing_code_raises_error(self):
        """Test that unit-based with outcome but no code raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardOrSkillRef(
                outcome="O1",
                # code missing
                description="Missing code field"
            )
        assert "requires BOTH code AND outcome" in str(exc_info.value)

    def test_description_too_short_raises_error(self):
        """Test that description under 5 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            StandardOrSkillRef(
                code="AS1",
                outcome="O1",
                description="Hi"  # Too short
            )
        assert "at least 5" in str(exc_info.value)


# =============================================================================
# RubricGuidance Tests
# =============================================================================

class TestRubricGuidance:
    """Tests for RubricGuidance model with criteria validation."""

    def test_valid_rubric_with_objects(self):
        """Test valid rubric with RubricCriterion objects."""
        rubric = RubricGuidance(
            total_points=3,
            criteria=[
                {"description": "Correct method", "points": 1},
                {"description": "Accurate calculation", "points": 1},
                {"description": "Clear answer", "points": 1}
            ]
        )
        assert rubric.total_points == 3
        assert len(rubric.criteria) == 3

    def test_valid_rubric_with_strings(self):
        """Test valid rubric with string criteria (auto-parsed)."""
        rubric = RubricGuidance(
            total_points=3,
            criteria=[
                "Correct method (1 pt)",
                "Accurate calculation (1 pt)",
                "Clear answer (1 pt)"
            ]
        )
        assert rubric.total_points == 3
        # Should be normalized to RubricCriterion objects
        assert all(hasattr(c, 'description') for c in rubric.criteria)

    def test_rubric_points_mismatch_raises_error(self):
        """Test that criteria points not summing to total_points raises error."""
        with pytest.raises(ValidationError) as exc_info:
            RubricGuidance(
                total_points=5,  # Says 5
                criteria=[
                    {"description": "Only criterion", "points": 2}  # Sums to 2
                ]
            )
        assert "does not equal total_points" in str(exc_info.value)

    def test_empty_criteria_raises_error(self):
        """Test that empty criteria list raises error."""
        with pytest.raises(ValidationError) as exc_info:
            RubricGuidance(
                total_points=1,
                criteria=[]
            )
        assert "at least 1" in str(exc_info.value)


# =============================================================================
# Card Tests
# =============================================================================

class TestCard:
    """Tests for Card model validation."""

    @pytest.fixture
    def valid_card_data(self):
        """Valid card data for testing."""
        return {
            "card_number": 1,
            "card_type": "starter",
            "title": "Starter: Review Prior Knowledge",
            "purpose": "Activate prior knowledge about fractions",
            "pedagogical_approach": "Think-pair-share with visual representations on mini-whiteboards",
            "cfu_strategy": "Mini-whiteboard fraction identification check"
        }

    def test_valid_card(self, valid_card_data):
        """Test valid card passes validation."""
        card = Card(**valid_card_data)
        assert card.card_number == 1
        assert card.card_type == CardType.STARTER

    def test_card_number_zero_raises_error(self, valid_card_data):
        """Test that card_number=0 raises error."""
        valid_card_data["card_number"] = 0
        with pytest.raises(ValidationError) as exc_info:
            Card(**valid_card_data)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_card_negative_number_raises_error(self, valid_card_data):
        """Test that negative card_number raises error."""
        valid_card_data["card_number"] = -1
        with pytest.raises(ValidationError) as exc_info:
            Card(**valid_card_data)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_card_title_too_short_raises_error(self, valid_card_data):
        """Test that title under 5 chars raises error."""
        valid_card_data["title"] = "Hi"
        with pytest.raises(ValidationError) as exc_info:
            Card(**valid_card_data)
        assert "at least 5" in str(exc_info.value)

    def test_card_invalid_type_raises_error(self, valid_card_data):
        """Test that invalid card_type raises error."""
        valid_card_data["card_type"] = "invalid_type"
        with pytest.raises(ValidationError) as exc_info:
            Card(**valid_card_data)
        # Should fail on enum validation
        assert "card_type" in str(exc_info.value).lower()

    def test_card_with_standards_addressed(self, valid_card_data):
        """Test card with standards_addressed list."""
        valid_card_data["standards_addressed"] = [
            {
                "code": "AS1.2",
                "outcome": "O1",
                "description": "Add fractions with same denominator"
            }
        ]
        card = Card(**valid_card_data)
        assert len(card.standards_addressed) == 1
        assert card.standards_addressed[0].code == "AS1.2"


# =============================================================================
# LessonPlan Tests
# =============================================================================

class TestLessonPlan:
    """Tests for LessonPlan model validation."""

    @pytest.fixture
    def valid_lesson_plan_data(self):
        """Valid lesson plan data for testing."""
        return {
            "summary": "This lesson introduces fractions as parts of a whole using Scottish context examples like sharing shortbread and pizza slices.",
            "card_structure": [
                {
                    "card_number": 1,
                    "card_type": "starter",
                    "title": "Starter: Fraction Recall",
                    "purpose": "Activate prior knowledge",
                    "pedagogical_approach": "Think-pair-share activity",
                    "cfu_strategy": "Mini-whiteboard check"
                },
                {
                    "card_number": 2,
                    "card_type": "explainer",
                    "title": "Explainer: What is a Fraction?",
                    "purpose": "Introduce fraction concept",
                    "pedagogical_approach": "Visual demonstration",
                    "cfu_strategy": "Quick questioning"
                }
            ],
            "lesson_flow_summary": "Starter -> Explainer -> Practice -> Exit Ticket",
            "multi_standard_integration_strategy": "Standards integrated throughout lesson activities",
            "assessment_progression": "Formative checks at each stage with summative exit ticket"
        }

    def test_valid_lesson_plan(self, valid_lesson_plan_data):
        """Test valid lesson plan passes validation."""
        plan = LessonPlan(**valid_lesson_plan_data)
        assert len(plan.card_structure) == 2
        assert plan.card_structure[0].card_number == 1

    def test_lesson_plan_card_numbers_not_sequential_raises_error(self, valid_lesson_plan_data):
        """Test that non-sequential card numbers raise error."""
        valid_lesson_plan_data["card_structure"][1]["card_number"] = 5  # Gap
        with pytest.raises(ValidationError) as exc_info:
            LessonPlan(**valid_lesson_plan_data)
        assert "sequential" in str(exc_info.value)

    def test_lesson_plan_empty_cards_raises_error(self, valid_lesson_plan_data):
        """Test that empty card_structure raises error."""
        valid_lesson_plan_data["card_structure"] = []
        with pytest.raises(ValidationError) as exc_info:
            LessonPlan(**valid_lesson_plan_data)
        assert "at least 1" in str(exc_info.value)

    def test_lesson_plan_summary_too_short_raises_error(self, valid_lesson_plan_data):
        """Test that summary under 50 chars raises error."""
        valid_lesson_plan_data["summary"] = "Too short summary"
        with pytest.raises(ValidationError) as exc_info:
            LessonPlan(**valid_lesson_plan_data)
        assert "at least 50" in str(exc_info.value)

    def test_lesson_plan_summary_too_long_raises_error(self, valid_lesson_plan_data):
        """Test that summary over 500 chars raises error."""
        valid_lesson_plan_data["summary"] = "x" * 501
        with pytest.raises(ValidationError) as exc_info:
            LessonPlan(**valid_lesson_plan_data)
        assert "at most 500" in str(exc_info.value)


# =============================================================================
# SOWEntry Tests
# =============================================================================

class TestSOWEntry:
    """Tests for SOWEntry model validation."""

    def test_valid_sow_entry(self, sample_sow_entry):
        """Test valid SOW entry passes validation."""
        entry = SOWEntry(**sample_sow_entry)
        assert entry.order == 1
        assert entry.lesson_type == LessonType.TEACH

    def test_valid_skills_based_sow_entry(self, sample_sow_entry_skills_based):
        """Test valid skills-based SOW entry passes validation."""
        entry = SOWEntry(**sample_sow_entry_skills_based)
        assert entry.order == 1
        assert entry.standards_or_skills_addressed[0].skill_name == "Working with surds"

    def test_sow_entry_order_zero_raises_error(self, sample_sow_entry):
        """Test that order=0 raises error."""
        sample_sow_entry["order"] = 0
        with pytest.raises(ValidationError) as exc_info:
            SOWEntry(**sample_sow_entry)
        assert "greater than or equal to 1" in str(exc_info.value)

    def test_sow_entry_invalid_lesson_type_raises_error(self, sample_sow_entry):
        """Test that invalid lesson_type raises error."""
        sample_sow_entry["lesson_type"] = "introduction"  # Not valid
        with pytest.raises(ValidationError) as exc_info:
            SOWEntry(**sample_sow_entry)
        assert "lesson_type" in str(exc_info.value).lower()

    def test_sow_entry_label_too_short_raises_error(self, sample_sow_entry):
        """Test that label under 10 chars raises error."""
        sample_sow_entry["label"] = "Short"
        with pytest.raises(ValidationError) as exc_info:
            SOWEntry(**sample_sow_entry)
        assert "at least 10" in str(exc_info.value)


# =============================================================================
# AccessibilityProfile Tests
# =============================================================================

class TestAccessibilityProfile:
    """Tests for AccessibilityProfile model."""

    def test_valid_accessibility_profile(self):
        """Test valid accessibility profile."""
        profile = AccessibilityProfile(
            dyslexia_friendly=True,
            plain_language_level=CEFRLevel.CEFR_B1
        )
        assert profile.dyslexia_friendly is True

    def test_accessibility_profile_ignores_extra_fields(self):
        """Test that extra fields are ignored (agent may add custom fields)."""
        profile = AccessibilityProfile(
            dyslexia_friendly=True,
            text_complexity="simple",  # Extra field
            visual_aids="included"  # Extra field
        )
        assert profile.dyslexia_friendly is True
        # Extra fields should be ignored, not raise error

    def test_accessibility_profile_missing_required_raises_error(self):
        """Test that missing dyslexia_friendly raises error."""
        with pytest.raises(ValidationError) as exc_info:
            AccessibilityProfile()
        assert "dyslexia_friendly" in str(exc_info.value)


# =============================================================================
# MisconceptionAddressed Tests
# =============================================================================

class TestMisconceptionAddressed:
    """Tests for MisconceptionAddressed model."""

    def test_valid_misconception(self):
        """Test valid misconception."""
        misc = MisconceptionAddressed(
            misconception="Students often add denominators when adding fractions",
            remediation="Remind that denominators stay the same - we only add numerators"
        )
        assert "add denominators" in misc.misconception

    def test_misconception_too_short_raises_error(self):
        """Test that misconception under 10 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MisconceptionAddressed(
                misconception="Short",
                remediation="This remediation is long enough to pass"
            )
        assert "at least 10" in str(exc_info.value)

    def test_remediation_too_short_raises_error(self):
        """Test that remediation under 10 chars raises error."""
        with pytest.raises(ValidationError) as exc_info:
            MisconceptionAddressed(
                misconception="This misconception is long enough",
                remediation="Short"
            )
        assert "at least 10" in str(exc_info.value)
