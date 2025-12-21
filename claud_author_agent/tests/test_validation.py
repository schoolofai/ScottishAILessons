"""Unit tests for Validation Utilities.

Tests input validation functions for:
- validate_input_schema (SOW Author)
- validate_lesson_author_input
- format_subject_display
- format_level_display
"""

import pytest

import sys
from pathlib import Path

# Add src/utils directly to bypass __init__.py which has SDK dependencies
src_utils_path = Path(__file__).parent.parent / "src" / "utils"
sys.path.insert(0, str(src_utils_path))

from validation import (
    validate_input_schema,
    validate_lesson_author_input,
    format_subject_display,
    format_level_display
)


# =============================================================================
# validate_input_schema Tests (SOW Author)
# =============================================================================

class TestValidateInputSchema:
    """Tests for validate_input_schema function."""

    def test_valid_input_passes(self):
        """Test that valid input passes validation."""
        input_data = {
            "courseId": "course_test123"
        }
        is_valid, error = validate_input_schema(input_data)

        assert is_valid is True
        assert error is None

    def test_missing_course_id_fails(self):
        """Test that missing courseId fails validation."""
        input_data = {}
        is_valid, error = validate_input_schema(input_data)

        assert is_valid is False
        assert "courseId" in error

    def test_empty_course_id_fails(self):
        """Test that empty courseId fails validation."""
        input_data = {"courseId": ""}
        is_valid, error = validate_input_schema(input_data)

        assert is_valid is False
        assert "courseId" in error

    def test_none_input_fails(self):
        """Test that None input fails validation."""
        is_valid, error = validate_input_schema(None)

        assert is_valid is False
        assert error is not None

    def test_valid_course_id_format(self):
        """Test various valid courseId formats."""
        valid_ids = [
            "course_c84474",
            "course_abc123",
            "course_test"
        ]
        for course_id in valid_ids:
            input_data = {"courseId": course_id}
            is_valid, error = validate_input_schema(input_data)
            assert is_valid is True, f"Expected valid for {course_id}"


# =============================================================================
# validate_lesson_author_input Tests
# =============================================================================

class TestValidateLessonAuthorInput:
    """Tests for validate_lesson_author_input function."""

    def test_valid_input_passes(self):
        """Test that valid input passes validation."""
        input_data = {
            "courseId": "course_test123",
            "order": 1
        }
        is_valid, error = validate_lesson_author_input(input_data)

        assert is_valid is True
        assert error is None

    def test_missing_course_id_fails(self):
        """Test that missing courseId fails validation."""
        input_data = {"order": 1}
        is_valid, error = validate_lesson_author_input(input_data)

        assert is_valid is False
        assert "courseId" in error

    def test_missing_order_fails(self):
        """Test that missing order fails validation."""
        input_data = {"courseId": "course_test123"}
        is_valid, error = validate_lesson_author_input(input_data)

        assert is_valid is False
        assert "order" in error

    def test_zero_order_fails(self):
        """Test that order=0 fails validation."""
        input_data = {
            "courseId": "course_test123",
            "order": 0
        }
        is_valid, error = validate_lesson_author_input(input_data)

        assert is_valid is False
        assert "order" in error or "positive" in error.lower()

    def test_negative_order_fails(self):
        """Test that negative order fails validation."""
        input_data = {
            "courseId": "course_test123",
            "order": -1
        }
        is_valid, error = validate_lesson_author_input(input_data)

        assert is_valid is False
        assert "order" in error or "positive" in error.lower()

    def test_string_order_fails(self):
        """Test that string order fails validation."""
        input_data = {
            "courseId": "course_test123",
            "order": "one"
        }
        is_valid, error = validate_lesson_author_input(input_data)

        assert is_valid is False
        assert "order" in error or "integer" in error.lower()


# =============================================================================
# format_subject_display Tests
# =============================================================================

class TestFormatSubjectDisplay:
    """Tests for format_subject_display function."""

    def test_hyphenated_subject(self):
        """Test hyphenated subject is formatted nicely."""
        result = format_subject_display("application-of-mathematics")
        assert result == "Application Of Mathematics"

    def test_underscored_subject(self):
        """Test underscored subject is formatted nicely."""
        result = format_subject_display("application_of_mathematics")
        assert result == "Application Of Mathematics"

    def test_simple_subject(self):
        """Test simple subject is capitalized."""
        result = format_subject_display("mathematics")
        assert result == "Mathematics"

    def test_already_formatted_subject(self):
        """Test already formatted subject stays formatted."""
        result = format_subject_display("Mathematics")
        assert result == "Mathematics"


# =============================================================================
# format_level_display Tests
# =============================================================================

class TestFormatLevelDisplay:
    """Tests for format_level_display function."""

    def test_hyphenated_level(self):
        """Test hyphenated level is formatted nicely."""
        result = format_level_display("national-4")
        assert result == "National 4"

    def test_underscored_level(self):
        """Test underscored level is formatted nicely."""
        result = format_level_display("national_5")
        assert result == "National 5"

    def test_simple_level(self):
        """Test simple level is capitalized."""
        result = format_level_display("higher")
        assert result == "Higher"

    def test_advanced_higher(self):
        """Test advanced higher is formatted correctly."""
        result = format_level_display("advanced-higher")
        assert result == "Advanced Higher"

    def test_lifeskills(self):
        """Test lifeskills is capitalized."""
        result = format_level_display("lifeskills")
        assert result == "Lifeskills"
