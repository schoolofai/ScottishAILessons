"""Unit tests for SOW schema Pydantic models (Phase 1 - Outline Generation).

Tests LessonOutlineEntry and LessonOutline models for iterative SOW authoring.
These tests are designed for skills-based courses (National 5+) like
Applications of Mathematics Higher.

IMPORTANT: The outline generator uses a SIMPLIFIED lesson type system:
- OutlineLessonType: Only 'teach' and 'mock_exam' for outline entries
- CardType: Only 'starter', 'explainer', 'modelling', 'guided_practice', 'exit_ticket' (5 cards)
- Independent practice is handled by a SEPARATE system outside of SOW authoring

No LLM or network calls required - pure Pydantic validation.
"""

import pytest
from pydantic import ValidationError

import sys
from pathlib import Path

# Add src to path for imports
CLAUD_AUTHOR_AGENT_ROOT = Path(__file__).parent.parent.parent
if str(CLAUD_AUTHOR_AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(CLAUD_AUTHOR_AGENT_ROOT))

from src.tools.sow_schema_models import (
    LessonOutlineEntry,
    LessonOutline,
    OutlineLessonType,  # Simplified enum: teach + mock_exam only
)


# ═══════════════════════════════════════════════════════════════════════════════
# Test Fixtures - Valid Data for Skills-Based Courses
# ═══════════════════════════════════════════════════════════════════════════════

def create_valid_outline_entry(order: int = 1, lesson_type: str = "teach") -> dict:
    """Create a valid LessonOutlineEntry dict for skills-based courses."""
    return {
        "order": order,
        "lesson_type": lesson_type,
        "label_hint": "Introduction to Financial Mathematics",
        "block_name": "Financial Mathematics",
        "block_index": "B1",
        "primary_outcome_or_skill": "Compound interest calculations",
        "standards_or_skills_codes": ["Compound interest", "Depreciation"],
        "rationale": "Foundation for all financial calculation skills in the course"
    }


def create_minimal_valid_outline() -> dict:
    """Create a minimal valid LessonOutline with teach and mock_exam (simplified).

    NOTE: The outline generator only supports 'teach' and 'mock_exam'.
    Independent practice is handled by a SEPARATE system outside of SOW authoring.
    """
    return {
        "course_subject": "applications-of-mathematics",
        "course_level": "higher",
        "total_lessons": 3,
        "structure_type": "skills_based",
        "outlines": [
            {
                "order": 1,
                "lesson_type": "teach",
                "label_hint": "Compound Interest Introduction",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Compound interest",
                "standards_or_skills_codes": ["Compound interest"],
                "rationale": "Foundation skill for financial calculations"
            },
            {
                "order": 2,
                "lesson_type": "teach",
                "label_hint": "Depreciation Calculations",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Depreciation",
                "standards_or_skills_codes": ["Compound interest", "Depreciation"],
                "rationale": "Builds on compound interest to introduce depreciation"
            },
            {
                "order": 3,
                "lesson_type": "mock_exam",
                "label_hint": "Course Assessment",
                "block_name": "Assessment",
                "block_index": "A1",
                "primary_outcome_or_skill": "All skills",
                "standards_or_skills_codes": ["All"],
                "rationale": "Final assessment covering all course content"
            }
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# LessonOutlineEntry Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestLessonOutlineEntry:
    """Tests for LessonOutlineEntry Pydantic model.

    NOTE: The outline generator uses a SIMPLIFIED lesson type system.
    OutlineLessonType only supports 'teach' and 'mock_exam'.
    Independent practice is handled by a SEPARATE system outside of SOW authoring.
    """

    def test_valid_entry_teach(self):
        """Test LessonOutlineEntry with valid teach lesson data."""
        entry_data = create_valid_outline_entry(order=1, lesson_type="teach")
        entry = LessonOutlineEntry.model_validate(entry_data)

        assert entry.order == 1
        assert entry.lesson_type == OutlineLessonType.TEACH
        assert entry.label_hint == "Introduction to Financial Mathematics"
        assert entry.block_name == "Financial Mathematics"
        assert entry.block_index == "B1"
        assert len(entry.standards_or_skills_codes) == 2

    def test_valid_entry_mock_exam(self):
        """Test LessonOutlineEntry with valid mock_exam lesson data."""
        entry_data = create_valid_outline_entry(order=10, lesson_type="mock_exam")
        entry_data["label_hint"] = "Final Course Assessment"
        entry = LessonOutlineEntry.model_validate(entry_data)

        assert entry.order == 10
        assert entry.lesson_type == OutlineLessonType.MOCK_EXAM

    def test_invalid_lesson_type_revision(self):
        """Test LessonOutlineEntry rejects 'revision' as lesson type.

        Revision is no longer a valid outline lesson type.
        The iterative SOW author only supports 'teach' and 'mock_exam'.
        """
        entry_data = create_valid_outline_entry(order=2, lesson_type="revision")

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "lesson_type" in str(exc_info.value)

    def test_invalid_lesson_type_independent_practice(self):
        """Test LessonOutlineEntry rejects 'independent_practice' as lesson type.

        Independent practice is handled by a SEPARATE system outside of SOW authoring.
        The iterative SOW author only supports 'teach' and 'mock_exam'.
        """
        entry_data = create_valid_outline_entry(order=5, lesson_type="independent_practice")

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "lesson_type" in str(exc_info.value)

    def test_invalid_lesson_type_formative_assessment(self):
        """Test LessonOutlineEntry rejects 'formative_assessment' as lesson type.

        Formative assessment is no longer a valid outline lesson type.
        The iterative SOW author only supports 'teach' and 'mock_exam'.
        """
        entry_data = create_valid_outline_entry(order=6, lesson_type="formative_assessment")

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "lesson_type" in str(exc_info.value)

    def test_invalid_lesson_type_introduction(self):
        """Test LessonOutlineEntry rejects invalid lesson_type."""
        entry_data = create_valid_outline_entry()
        entry_data["lesson_type"] = "introduction"  # INVALID

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "lesson_type" in str(exc_info.value)

    def test_invalid_order_zero(self):
        """Test LessonOutlineEntry rejects order < 1."""
        entry_data = create_valid_outline_entry()
        entry_data["order"] = 0  # INVALID - must be >= 1

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "order" in str(exc_info.value).lower()

    def test_invalid_order_negative(self):
        """Test LessonOutlineEntry rejects negative order."""
        entry_data = create_valid_outline_entry()
        entry_data["order"] = -1  # INVALID

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "order" in str(exc_info.value).lower()

    def test_label_hint_too_short(self):
        """Test LessonOutlineEntry rejects label_hint < 5 chars."""
        entry_data = create_valid_outline_entry()
        entry_data["label_hint"] = "Hi"  # INVALID - too short

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "label_hint" in str(exc_info.value)

    def test_label_hint_too_long(self):
        """Test LessonOutlineEntry rejects label_hint > 100 chars."""
        entry_data = create_valid_outline_entry()
        entry_data["label_hint"] = "A" * 101  # INVALID - too long

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "label_hint" in str(exc_info.value)

    def test_rationale_too_short(self):
        """Test LessonOutlineEntry rejects rationale < 20 chars."""
        entry_data = create_valid_outline_entry()
        entry_data["rationale"] = "Too short"  # INVALID - < 20 chars

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "rationale" in str(exc_info.value)

    def test_rationale_too_long(self):
        """Test LessonOutlineEntry rejects rationale > 300 chars."""
        entry_data = create_valid_outline_entry()
        entry_data["rationale"] = "A" * 301  # INVALID - > 300 chars

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "rationale" in str(exc_info.value)

    def test_empty_standards_list(self):
        """Test LessonOutlineEntry rejects empty standards_or_skills_codes."""
        entry_data = create_valid_outline_entry()
        entry_data["standards_or_skills_codes"] = []  # INVALID - min_length=1

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "standards_or_skills_codes" in str(exc_info.value)

    def test_missing_required_field(self):
        """Test LessonOutlineEntry rejects missing required fields."""
        entry_data = create_valid_outline_entry()
        del entry_data["block_name"]  # Remove required field

        with pytest.raises(ValidationError) as exc_info:
            LessonOutlineEntry.model_validate(entry_data)

        assert "block_name" in str(exc_info.value)


# ═══════════════════════════════════════════════════════════════════════════════
# LessonOutline Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestLessonOutline:
    """Tests for LessonOutline Pydantic model."""

    def test_valid_outline_skills_based(self):
        """Test LessonOutline with valid skills-based course data."""
        outline_data = create_minimal_valid_outline()
        outline = LessonOutline.model_validate(outline_data)

        assert outline.total_lessons == 3
        assert outline.structure_type == "skills_based"
        assert outline.course_subject == "applications-of-mathematics"
        assert outline.course_level == "higher"
        assert len(outline.outlines) == 3

    def test_valid_outline_unit_based(self):
        """Test LessonOutline with valid unit-based course data."""
        outline_data = create_minimal_valid_outline()
        outline_data["structure_type"] = "unit_based"
        outline_data["course_level"] = "national-3"
        outline = LessonOutline.model_validate(outline_data)

        assert outline.structure_type == "unit_based"
        assert outline.course_level == "national-3"

    def test_total_lessons_mismatch(self):
        """Test LessonOutline fails when total_lessons != len(outlines)."""
        outline_data = create_minimal_valid_outline()
        outline_data["total_lessons"] = 5  # MISMATCH - actually 3 entries

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        error_msg = str(exc_info.value).lower()
        assert "total_lessons" in error_msg or "must match" in error_msg

    def test_missing_mock_exam(self):
        """Test LessonOutline fails without exactly 1 mock_exam."""
        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 2,
            "structure_type": "skills_based",
            "outlines": [
                create_valid_outline_entry(order=1, lesson_type="teach"),
                create_valid_outline_entry(order=2, lesson_type="teach")
                # NO mock_exam
            ]
        }

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        error_msg = str(exc_info.value).lower()
        assert "mock_exam" in error_msg or "exactly 1" in error_msg

    def test_multiple_mock_exams(self):
        """Test LessonOutline fails with more than 1 mock_exam."""
        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 4,
            "structure_type": "skills_based",
            "outlines": [
                create_valid_outline_entry(order=1, lesson_type="teach"),
                create_valid_outline_entry(order=2, lesson_type="teach"),
                create_valid_outline_entry(order=3, lesson_type="mock_exam"),
                create_valid_outline_entry(order=4, lesson_type="mock_exam")  # DUPLICATE
            ]
        }

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        error_msg = str(exc_info.value).lower()
        assert "mock_exam" in error_msg or "exactly 1" in error_msg

    def test_no_teach_lessons(self):
        """Test LessonOutline fails without at least 1 teach lesson.

        NOTE: With simplified outline (teach + mock_exam only), an outline
        with only mock_exam is invalid as there's no content.
        """
        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 1,
            "structure_type": "skills_based",
            "outlines": [
                create_valid_outline_entry(order=1, lesson_type="mock_exam")
                # NO teach
            ]
        }

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        error_msg = str(exc_info.value).lower()
        assert "teach" in error_msg

    def test_all_teach_lessons_valid(self):
        """Test LessonOutline accepts multiple teach lessons.

        NOTE: With simplified outline (teach + mock_exam only), multiple
        consecutive teach lessons are valid. Each teach lesson uses the
        5-card flow: starter → explainer → modelling → guided_practice → exit_ticket.
        """
        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 5,
            "structure_type": "skills_based",
            "outlines": [
                create_valid_outline_entry(order=1, lesson_type="teach"),
                create_valid_outline_entry(order=2, lesson_type="teach"),
                create_valid_outline_entry(order=3, lesson_type="teach"),
                create_valid_outline_entry(order=4, lesson_type="teach"),
                create_valid_outline_entry(order=5, lesson_type="mock_exam")
            ]
        }

        # This should now PASS - no teach-revision pairing required
        outline = LessonOutline.model_validate(outline_data)
        assert outline.total_lessons == 5

    def test_order_not_sequential(self):
        """Test LessonOutline fails when order is not sequential."""
        outline_data = create_minimal_valid_outline()
        # Make order non-sequential: 1, 3, 5 instead of 1, 2, 3
        outline_data["outlines"][1]["order"] = 3
        outline_data["outlines"][2]["order"] = 5

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        error_msg = str(exc_info.value).lower()
        assert "sequential" in error_msg or "order" in error_msg

    def test_order_with_gaps(self):
        """Test LessonOutline fails when order has gaps (e.g., 1, 2, 4)."""
        outline_data = create_minimal_valid_outline()
        outline_data["outlines"][2]["order"] = 4  # Skip order 3

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        error_msg = str(exc_info.value).lower()
        assert "sequential" in error_msg or "order" in error_msg

    def test_order_starting_from_zero(self):
        """Test LessonOutline fails when order starts from 0."""
        outline_data = create_minimal_valid_outline()
        outline_data["outlines"][0]["order"] = 0
        outline_data["outlines"][1]["order"] = 1
        outline_data["outlines"][2]["order"] = 2

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        # Either order validation or sequential check should fail
        assert "order" in str(exc_info.value).lower()

    def test_invalid_structure_type(self):
        """Test LessonOutline fails with invalid structure_type."""
        outline_data = create_minimal_valid_outline()
        outline_data["structure_type"] = "hybrid"  # INVALID - not in Literal

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        assert "structure_type" in str(exc_info.value)

    def test_empty_outlines_list(self):
        """Test LessonOutline fails with empty outlines list."""
        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 0,
            "structure_type": "skills_based",
            "outlines": []  # INVALID - min_length=1
        }

        with pytest.raises(ValidationError) as exc_info:
            LessonOutline.model_validate(outline_data)

        # Either min_length or total_lessons >= 1 should fail
        error_msg = str(exc_info.value).lower()
        assert "outlines" in error_msg or "total_lessons" in error_msg

    def test_teach_and_mock_exam_only_outline(self):
        """Test LessonOutline accepts outline with only teach and mock_exam.

        This is the simplified outline structure. Each teach lesson uses the
        5-card flow: starter → explainer → modelling → guided_practice → exit_ticket.
        Independent practice is handled by a SEPARATE system.
        """
        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 5,
            "structure_type": "skills_based",
            "outlines": [
                create_valid_outline_entry(order=1, lesson_type="teach"),
                create_valid_outline_entry(order=2, lesson_type="teach"),
                create_valid_outline_entry(order=3, lesson_type="teach"),
                create_valid_outline_entry(order=4, lesson_type="teach"),
                create_valid_outline_entry(order=5, lesson_type="mock_exam")
            ]
        }

        # This should pass - only teach + mock_exam is the valid structure
        outline = LessonOutline.model_validate(outline_data)
        assert outline.total_lessons == 5


# ═══════════════════════════════════════════════════════════════════════════════
# Edge Cases and Additional Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestLessonOutlineEdgeCases:
    """Edge case tests for LessonOutline."""

    def test_large_outline_valid(self):
        """Test LessonOutline accepts larger valid course (15 lessons).

        NOTE: With simplified outline (teach + mock_exam only), all content
        lessons are 'teach' type with mock_exam at the end. Each teach lesson
        uses the 5-card flow: starter → explainer → modelling → guided_practice → exit_ticket.
        """
        outlines = []
        # 14 teach lessons
        for i in range(1, 15):
            outlines.append(create_valid_outline_entry(order=i, lesson_type="teach"))
        # 1 mock_exam at the end
        outlines.append(create_valid_outline_entry(order=15, lesson_type="mock_exam"))

        outline_data = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 15,
            "structure_type": "skills_based",
            "outlines": outlines
        }

        outline = LessonOutline.model_validate(outline_data)
        assert outline.total_lessons == 15

    def test_whitespace_stripping(self):
        """Test that whitespace is stripped from string fields."""
        entry_data = create_valid_outline_entry()
        entry_data["label_hint"] = "  Introduction to Financial Mathematics  "
        entry_data["block_name"] = "\tFinancial Mathematics\n"

        entry = LessonOutlineEntry.model_validate(entry_data)

        assert entry.label_hint == "Introduction to Financial Mathematics"
        assert entry.block_name == "Financial Mathematics"

    def test_block_index_formats(self):
        """Test various valid block_index formats."""
        valid_indices = ["B1", "B2", "U1", "U2", "A1", "FM1", "ST2"]

        for idx in valid_indices:
            entry_data = create_valid_outline_entry()
            entry_data["block_index"] = idx
            entry = LessonOutlineEntry.model_validate(entry_data)
            assert entry.block_index == idx

    def test_single_skills_code(self):
        """Test LessonOutlineEntry accepts single skills code."""
        entry_data = create_valid_outline_entry()
        entry_data["standards_or_skills_codes"] = ["Compound interest"]

        entry = LessonOutlineEntry.model_validate(entry_data)
        assert len(entry.standards_or_skills_codes) == 1

    def test_many_skills_codes(self):
        """Test LessonOutlineEntry accepts multiple skills codes."""
        entry_data = create_valid_outline_entry()
        entry_data["standards_or_skills_codes"] = [
            "Compound interest",
            "Depreciation",
            "APR and AER",
            "Currency conversion",
            "Statistical diagrams"
        ]

        entry = LessonOutlineEntry.model_validate(entry_data)
        assert len(entry.standards_or_skills_codes) == 5
