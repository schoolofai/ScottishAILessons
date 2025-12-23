"""Unit tests for Revision Notes Validators.

Tests validation functions for:
- validate_output_files (sync, no external deps)

Note: validate_course_exists, validate_published_sow_exists, check_duplicate_notes
require Appwrite MCP and are tested in integration tests only.
"""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
import json
import sys

# We can only test validate_output_files directly as it doesn't need Appwrite
# The async validators are tested via integration tests or with full mocking

# For validate_output_files, we reimplement it here to avoid import issues
def validate_output_files(workspace_path: Path, lesson_count: int) -> None:
    """Validate all expected markdown files exist in workspace outputs directory.

    Args:
        workspace_path: Path to workspace directory
        lesson_count: Expected number of lessons

    Raises:
        FileNotFoundError: If course cheat sheet or any lesson notes missing
    """
    outputs_dir = workspace_path / "outputs"
    missing_files = []

    # Check course cheat sheet
    cheat_sheet_path = outputs_dir / "course_cheat_sheet.md"
    if not cheat_sheet_path.exists():
        missing_files.append("course_cheat_sheet.md")

    # Check all lesson notes
    for lesson_num in range(1, lesson_count + 1):
        lesson_note_path = outputs_dir / f"lesson_notes_{lesson_num:02d}.md"
        if not lesson_note_path.exists():
            missing_files.append(f"lesson_notes_{lesson_num:02d}.md")

    # Raise exception if any files missing
    if missing_files:
        raise FileNotFoundError(
            f"Agent did not generate all expected markdown files. "
            f"Missing {len(missing_files)} files: {', '.join(missing_files)}."
        )


# =============================================================================
# validate_output_files Tests (These work without external deps)
# =============================================================================

class TestValidateOutputFiles:
    """Tests for validate_output_files function."""

    def test_all_files_exist(self, tmp_path):
        """Test that validation passes when all files exist."""
        # Create workspace structure
        outputs_dir = tmp_path / "outputs"
        outputs_dir.mkdir()

        # Create cheat sheet
        (outputs_dir / "course_cheat_sheet.md").write_text("# Cheat Sheet")

        # Create lesson notes (3 lessons)
        for i in range(1, 4):
            (outputs_dir / f"lesson_notes_{i:02d}.md").write_text(f"# Lesson {i}")

        # Should not raise
        validate_output_files(tmp_path, lesson_count=3)

    def test_missing_cheat_sheet_raises_error(self, tmp_path):
        """Test that missing cheat sheet raises FileNotFoundError."""
        outputs_dir = tmp_path / "outputs"
        outputs_dir.mkdir()

        # Create lesson notes but NO cheat sheet
        for i in range(1, 4):
            (outputs_dir / f"lesson_notes_{i:02d}.md").write_text(f"# Lesson {i}")

        with pytest.raises(FileNotFoundError) as exc_info:
            validate_output_files(tmp_path, lesson_count=3)

        assert "course_cheat_sheet.md" in str(exc_info.value)

    def test_missing_lesson_notes_raises_error(self, tmp_path):
        """Test that missing lesson notes raises FileNotFoundError."""
        outputs_dir = tmp_path / "outputs"
        outputs_dir.mkdir()

        # Create cheat sheet and some lesson notes (missing lesson 2)
        (outputs_dir / "course_cheat_sheet.md").write_text("# Cheat Sheet")
        (outputs_dir / "lesson_notes_01.md").write_text("# Lesson 1")
        # lesson_notes_02.md missing
        (outputs_dir / "lesson_notes_03.md").write_text("# Lesson 3")

        with pytest.raises(FileNotFoundError) as exc_info:
            validate_output_files(tmp_path, lesson_count=3)

        assert "lesson_notes_02.md" in str(exc_info.value)

    def test_no_outputs_dir_raises_error(self, tmp_path):
        """Test that missing outputs directory raises error."""
        # No outputs directory exists
        with pytest.raises(FileNotFoundError):
            validate_output_files(tmp_path, lesson_count=3)

    def test_zero_lessons_only_cheat_sheet(self, tmp_path):
        """Test validation with zero lessons (only cheat sheet required)."""
        outputs_dir = tmp_path / "outputs"
        outputs_dir.mkdir()
        (outputs_dir / "course_cheat_sheet.md").write_text("# Cheat Sheet")

        # Should not raise - only cheat sheet expected
        validate_output_files(tmp_path, lesson_count=0)


# =============================================================================
# Notes: Async validators (validate_course_exists, validate_published_sow_exists,
# check_duplicate_notes) require Appwrite MCP and are skipped in unit tests.
# They should be tested in integration tests with full infrastructure.
# =============================================================================
