"""Integration tests for outline validator tool (Phase 1 - Outline Generation).

Tests the validate_lesson_outline function which wraps Pydantic validation
with JSON parsing and error formatting for agent consumption.

IMPORTANT: The outline generator uses a SIMPLIFIED lesson type system:
- OutlineLessonType: Only 'teach' and 'mock_exam' for outline entries
- CardType: Only 'starter', 'explainer', 'modelling', 'guided_practice', 'exit_ticket' (5 cards)
- Independent practice is handled by a SEPARATE system outside of SOW authoring

No LLM calls required - tests the tool's validation logic.
"""

import json
import pytest

import sys
from pathlib import Path

# Add src to path for imports
CLAUD_AUTHOR_AGENT_ROOT = Path(__file__).parent.parent.parent
if str(CLAUD_AUTHOR_AGENT_ROOT) not in sys.path:
    sys.path.insert(0, str(CLAUD_AUTHOR_AGENT_ROOT))

from src.tools.sow_outline_validator_tool import validate_lesson_outline


# ═══════════════════════════════════════════════════════════════════════════════
# Test Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

def create_valid_outline_dict() -> dict:
    """Create a complete valid outline for skills-based course.

    NOTE: Uses simplified lesson types (teach + mock_exam only).
    Revision and other pedagogical patterns are embedded as card types.
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
                "label_hint": "Financial Mathematics Intro",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Compound interest",
                "standards_or_skills_codes": ["Compound interest"],
                "rationale": "Foundation for financial calculations"
            },
            {
                "order": 2,
                "lesson_type": "teach",
                "label_hint": "Depreciation Calculations",
                "block_name": "Financial Mathematics",
                "block_index": "B1",
                "primary_outcome_or_skill": "Depreciation",
                "standards_or_skills_codes": ["Compound interest", "Depreciation"],
                "rationale": "Build on compound interest for depreciation"
            },
            {
                "order": 3,
                "lesson_type": "mock_exam",
                "label_hint": "Course Assessment",
                "block_name": "Assessment",
                "block_index": "A1",
                "primary_outcome_or_skill": "All",
                "standards_or_skills_codes": ["All"],
                "rationale": "Final assessment covering all content"
            }
        ]
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Valid Input Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineValidatorValidInput:
    """Tests for valid outline JSON inputs."""

    def test_valid_json_returns_valid_true(self):
        """Test outline validator accepts valid JSON and returns valid=True."""
        valid_outline = create_valid_outline_dict()
        result = validate_lesson_outline(json.dumps(valid_outline))

        assert result["valid"] is True
        assert result["errors"] == []
        assert "✅" in result["summary"]

    def test_valid_json_returns_stats(self):
        """Test outline validator returns correct statistics."""
        valid_outline = create_valid_outline_dict()
        result = validate_lesson_outline(json.dumps(valid_outline))

        assert result["stats"] is not None
        assert result["stats"]["total_lessons"] == 3
        assert result["stats"]["structure_type"] == "skills_based"
        assert result["stats"]["course_subject"] == "applications-of-mathematics"
        assert result["stats"]["course_level"] == "higher"

    def test_valid_json_lesson_type_counts(self):
        """Test outline validator counts lesson types correctly.

        NOTE: Uses simplified lesson types (teach + mock_exam only).
        """
        valid_outline = create_valid_outline_dict()
        result = validate_lesson_outline(json.dumps(valid_outline))

        lesson_types = result["stats"]["lesson_types"]
        assert lesson_types["teach"] == 2  # Two teach lessons
        assert lesson_types["mock_exam"] == 1  # One mock_exam

    def test_valid_json_blocks_extracted(self):
        """Test outline validator extracts block names."""
        valid_outline = create_valid_outline_dict()
        result = validate_lesson_outline(json.dumps(valid_outline))

        blocks = result["stats"]["blocks"]
        assert "Financial Mathematics" in blocks
        assert "Assessment" in blocks
        assert len(blocks) == 2

    def test_larger_valid_outline(self):
        """Test outline validator accepts larger valid outlines.

        NOTE: Uses simplified lesson types (teach + mock_exam only).
        All content lessons are 'teach' with mock_exam at the end.
        """
        outline = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 8,
            "structure_type": "skills_based",
            "outlines": []
        }

        # Create 8 lessons with simplified structure (teach + mock_exam only)
        lessons = [
            ("teach", "B1"),
            ("teach", "B1"),
            ("teach", "B2"),
            ("teach", "B2"),
            ("teach", "B2"),
            ("teach", "B3"),
            ("teach", "B3"),
            ("mock_exam", "A1")
        ]

        for i, (lesson_type, block_idx) in enumerate(lessons, 1):
            outline["outlines"].append({
                "order": i,
                "lesson_type": lesson_type,
                "label_hint": f"Lesson {i} - {lesson_type.replace('_', ' ').title()}",
                "block_name": f"Block {block_idx}",
                "block_index": block_idx,
                "primary_outcome_or_skill": f"Skill for lesson {i}",
                "standards_or_skills_codes": [f"Skill{i}"],
                "rationale": f"Rationale for lesson {i} placement in course"
            })

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is True
        assert result["stats"]["total_lessons"] == 8


# ═══════════════════════════════════════════════════════════════════════════════
# Invalid JSON Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineValidatorInvalidJSON:
    """Tests for malformed JSON inputs."""

    def test_invalid_json_syntax(self):
        """Test outline validator rejects malformed JSON."""
        result = validate_lesson_outline("{invalid json")

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert result["errors"][0]["type"] == "json_error"
        assert "❌" in result["summary"]
        assert result["stats"] is None

    def test_incomplete_json(self):
        """Test outline validator rejects incomplete JSON."""
        result = validate_lesson_outline('{"course_subject": "maths"')

        assert result["valid"] is False
        assert result["errors"][0]["type"] == "json_error"

    def test_empty_string(self):
        """Test outline validator rejects empty string."""
        result = validate_lesson_outline("")

        assert result["valid"] is False
        assert result["errors"][0]["type"] == "json_error"

    def test_null_json(self):
        """Test outline validator rejects null JSON."""
        result = validate_lesson_outline("null")

        assert result["valid"] is False

    def test_array_instead_of_object(self):
        """Test outline validator rejects array when object expected."""
        result = validate_lesson_outline("[]")

        assert result["valid"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# Schema Violation Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineValidatorSchemaViolations:
    """Tests for schema validation errors."""

    def test_total_lessons_mismatch(self):
        """Test outline validator reports total_lessons mismatch."""
        outline = create_valid_outline_dict()
        outline["total_lessons"] = 10  # Mismatch - actually 3

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "❌" in result["summary"]
        assert result["stats"] is None

    def test_missing_mock_exam(self):
        """Test outline validator reports missing mock_exam.

        NOTE: Uses simplified lesson types (teach only, no mock_exam).
        Outline should fail validation without a mock_exam.
        """
        outline = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 2,
            "structure_type": "skills_based",
            "outlines": [
                {
                    "order": 1,
                    "lesson_type": "teach",
                    "label_hint": "Test Lesson One",
                    "block_name": "Test Block",
                    "block_index": "B1",
                    "primary_outcome_or_skill": "Test Skill",
                    "standards_or_skills_codes": ["Skill1"],
                    "rationale": "Test rationale for lesson one"
                },
                {
                    "order": 2,
                    "lesson_type": "teach",  # Another teach, no mock_exam
                    "label_hint": "Test Lesson Two",
                    "block_name": "Test Block",
                    "block_index": "B1",
                    "primary_outcome_or_skill": "Test Skill",
                    "standards_or_skills_codes": ["Skill1"],
                    "rationale": "Test rationale for lesson two"
                }
            ]
        }

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        # Error should mention mock_exam
        error_messages = [e["message"].lower() for e in result["errors"]]
        assert any("mock_exam" in msg for msg in error_messages)

    def test_invalid_lesson_type(self):
        """Test outline validator reports invalid lesson_type."""
        outline = create_valid_outline_dict()
        outline["outlines"][0]["lesson_type"] = "introduction"  # Invalid

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        assert len(result["errors"]) > 0

    def test_empty_outlines_array(self):
        """Test outline validator reports empty outlines array."""
        outline = {
            "course_subject": "applications-of-mathematics",
            "course_level": "higher",
            "total_lessons": 0,
            "structure_type": "skills_based",
            "outlines": []
        }

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False

    def test_missing_required_field(self):
        """Test outline validator reports missing required fields."""
        outline = create_valid_outline_dict()
        del outline["course_subject"]  # Remove required field

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        error_messages = [e["message"].lower() for e in result["errors"]]
        assert any("required" in msg or "field" in msg for msg in error_messages)

    def test_non_sequential_order(self):
        """Test outline validator reports non-sequential order."""
        outline = create_valid_outline_dict()
        outline["outlines"][1]["order"] = 5  # Gap in sequence
        outline["outlines"][2]["order"] = 10

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False

    def test_invalid_structure_type(self):
        """Test outline validator reports invalid structure_type."""
        outline = create_valid_outline_dict()
        outline["structure_type"] = "hybrid"  # Invalid

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False


# ═══════════════════════════════════════════════════════════════════════════════
# Error Formatting Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineValidatorErrorFormatting:
    """Tests for error message formatting."""

    def test_error_has_location(self):
        """Test validation errors include location."""
        outline = create_valid_outline_dict()
        outline["outlines"][0]["lesson_type"] = "invalid_type"

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "location" in result["errors"][0]

    def test_error_has_message(self):
        """Test validation errors include message."""
        outline = create_valid_outline_dict()
        outline["outlines"][0]["label_hint"] = "X"  # Too short

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "message" in result["errors"][0]
        assert len(result["errors"][0]["message"]) > 0

    def test_error_has_type(self):
        """Test validation errors include type."""
        outline = create_valid_outline_dict()
        outline["total_lessons"] = "three"  # Wrong type

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        assert len(result["errors"]) > 0
        assert "type" in result["errors"][0]

    def test_summary_includes_error_count(self):
        """Test summary includes error count."""
        outline = create_valid_outline_dict()
        outline["total_lessons"] = 100  # Mismatch
        outline["structure_type"] = "invalid"  # Invalid

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        assert "error" in result["summary"].lower()

    def test_max_10_errors_returned(self):
        """Test that maximum 10 errors are returned."""
        # Create outline with many errors
        outline = {
            "course_subject": "x",  # Too short
            "course_level": "y",  # Too short
            "total_lessons": 100,  # Mismatch
            "structure_type": "invalid",  # Invalid
            "outlines": [
                {
                    "order": 0,  # Invalid
                    "lesson_type": "bad",  # Invalid
                    "label_hint": "a",  # Too short
                    "block_name": "b",  # Too short
                    "block_index": "",  # Too short
                    "primary_outcome_or_skill": "",  # Too short
                    "standards_or_skills_codes": [],  # Empty
                    "rationale": "short"  # Too short
                }
            ]
        }

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is False
        # Should limit to 10 errors maximum
        assert len(result["errors"]) <= 10


# ═══════════════════════════════════════════════════════════════════════════════
# Edge Cases Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOutlineValidatorEdgeCases:
    """Edge case tests for validator."""

    def test_unicode_in_labels(self):
        """Test validator handles unicode in labels."""
        outline = create_valid_outline_dict()
        outline["outlines"][0]["label_hint"] = "Математика - Introduction"

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is True

    def test_special_characters_in_rationale(self):
        """Test validator handles special characters in rationale."""
        outline = create_valid_outline_dict()
        outline["outlines"][0]["rationale"] = "Students learn: fractions, decimals & percentages (1/2, 0.5, 50%)"

        result = validate_lesson_outline(json.dumps(outline))

        assert result["valid"] is True

    def test_whitespace_handling(self):
        """Test validator handles extra whitespace."""
        outline = create_valid_outline_dict()
        outline["course_subject"] = "  applications-of-mathematics  "

        result = validate_lesson_outline(json.dumps(outline))

        # Pydantic should strip whitespace
        assert result["valid"] is True

    def test_nested_json_parsing(self):
        """Test validator correctly parses nested JSON structure."""
        outline = create_valid_outline_dict()
        json_str = json.dumps(outline, indent=2)

        result = validate_lesson_outline(json_str)

        assert result["valid"] is True

    def test_compact_json(self):
        """Test validator handles compact (no whitespace) JSON."""
        outline = create_valid_outline_dict()
        json_str = json.dumps(outline, separators=(',', ':'))

        result = validate_lesson_outline(json_str)

        assert result["valid"] is True
