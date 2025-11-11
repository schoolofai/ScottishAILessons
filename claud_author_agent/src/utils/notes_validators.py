"""Validation helpers for Revision Notes Author.

Fast-fail validation functions for courses, SOWs, and output files.
All functions throw detailed exceptions when validation fails.
"""

import logging
from pathlib import Path
from typing import Dict, Any

from .appwrite_mcp import (
    get_appwrite_document,
    list_appwrite_documents
)

logger = logging.getLogger(__name__)


async def validate_course_exists(
    course_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Validate that course exists in default.courses collection.

    Args:
        course_id: Course ID to validate (e.g., 'course_c84473')
        mcp_config_path: Path to .mcp.json

    Returns:
        Course document if found

    Raises:
        ValueError: If course not found or validation fails
    """
    logger.info(f"Validating course exists: {course_id}")

    try:
        # Query by courseId field, not document ID
        course_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="courses",
            queries=[f'equal("courseId", "{course_id}")'],
            mcp_config_path=mcp_config_path
        )

        if not course_docs or len(course_docs) == 0:
            raise ValueError(
                f"Course not found: {course_id}. "
                f"Ensure a course exists in default.courses collection with courseId='{course_id}'."
            )

        course_doc = course_docs[0]
        logger.info(f"✓ Course found: {course_doc.get('courseTitle', 'Unknown')} (document ID: {course_doc.get('$id')})")
        return course_doc

    except ValueError:
        # Re-raise validation errors as-is
        raise
    except Exception as e:
        raise ValueError(f"Failed to validate course: {e}")


async def validate_published_sow_exists(
    course_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Validate that published SOW exists for course.

    Args:
        course_id: Course ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Published SOW document if found

    Raises:
        ValueError: If no published SOW found
    """
    logger.info(f"Validating published SOW exists for: {course_id}")

    try:
        sow_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[
                f'equal("courseId", "{course_id}")',
                'equal("status", "published")'
            ],
            mcp_config_path=mcp_config_path
        )

        if not sow_docs or len(sow_docs) == 0:
            raise ValueError(
                f"No published SOW found for course {course_id}. "
                f"Ensure an Authored_SOW document exists with status='published'. "
                f"Draft SOWs are not supported for revision notes generation."
            )

        sow_doc = sow_docs[0]
        logger.info(f"✓ Published SOW found: {sow_doc.get('$id')} (version: {sow_doc.get('version', '1')})")

        return sow_doc

    except ValueError:
        # Re-raise validation errors as-is
        raise
    except Exception as e:
        raise ValueError(f"Failed to validate SOW: {e}")


def validate_output_files(
    workspace_path: Path,
    lesson_count: int
) -> None:
    """Validate all expected markdown files exist in workspace outputs directory.

    Args:
        workspace_path: Path to workspace directory
        lesson_count: Expected number of lessons

    Raises:
        FileNotFoundError: If course cheat sheet or any lesson notes missing
    """
    logger.info("=" * 60)
    logger.info("VALIDATING OUTPUT FILES")
    logger.info("=" * 60)

    outputs_dir = workspace_path / "outputs"
    missing_files = []

    # Check course cheat sheet
    cheat_sheet_path = outputs_dir / "course_cheat_sheet.md"
    if not cheat_sheet_path.exists():
        missing_files.append("course_cheat_sheet.md")
        logger.error(f"❌ Missing: {cheat_sheet_path}")
    else:
        file_size = cheat_sheet_path.stat().st_size
        logger.info(f"✓ course_cheat_sheet.md ({file_size} bytes)")

    # Check all lesson notes
    for lesson_num in range(1, lesson_count + 1):
        lesson_note_path = outputs_dir / f"lesson_notes_{lesson_num:02d}.md"
        if not lesson_note_path.exists():
            missing_files.append(f"lesson_notes_{lesson_num:02d}.md")
            logger.error(f"❌ Missing: {lesson_note_path}")
        else:
            file_size = lesson_note_path.stat().st_size
            logger.debug(f"✓ lesson_notes_{lesson_num:02d}.md ({file_size} bytes)")

    # Raise exception if any files missing
    if missing_files:
        logger.error("")
        logger.error(f"⚠️  {len(missing_files)} expected files missing from outputs/")
        logger.error(f"   Expected: 1 cheat sheet + {lesson_count} lesson notes = {lesson_count + 1} files")
        logger.error(f"   Found: {lesson_count + 1 - len(missing_files)} files")
        logger.error("")
        logger.error("Missing files:")
        for file in missing_files:
            logger.error(f"  - {file}")
        logger.error("")
        raise FileNotFoundError(
            f"Agent did not generate all expected markdown files. "
            f"Missing {len(missing_files)} files: {', '.join(missing_files)}. "
            f"This may indicate agent execution failed or timed out. "
            f"Use --persist-workspace and --log-level DEBUG to investigate."
        )

    logger.info(f"✅ All {lesson_count + 1} expected files exist")
    logger.info(f"   1 cheat sheet + {lesson_count} lesson notes")


async def check_duplicate_notes(
    course_id: str,
    version: str,
    mcp_config_path: str,
    force: bool = False
) -> None:
    """Check if revision notes already exist for this course and version.

    Args:
        course_id: Course ID
        version: SOW version
        mcp_config_path: Path to .mcp.json
        force: If True, skip duplicate check (allow overwrite)

    Raises:
        ValueError: If notes already exist and force=False
    """
    if force:
        logger.info("Force mode enabled - skipping duplicate check")
        return

    logger.info(f"Checking for existing revision notes: {course_id} (version: {version})")

    try:
        # Query for any existing notes for this course
        existing_notes = await list_appwrite_documents(
            database_id="default",
            collection_id="revision_notes",
            queries=[f'equal("courseId", "{course_id}")'],
            mcp_config_path=mcp_config_path
        )

        if existing_notes and len(existing_notes) > 0:
            # Check if any notes match the version
            matching_version_notes = [
                note for note in existing_notes
                if note.get("version") == version
            ]

            if matching_version_notes:
                note_count = len(matching_version_notes)
                logger.error(f"❌ Found {note_count} existing revision notes for {course_id} (version: {version})")
                logger.error(f"   Note IDs: {[n.get('$id') for n in matching_version_notes[:3]]}")

                raise ValueError(
                    f"Revision notes already exist for course {course_id} (version {version}). "
                    f"Found {note_count} existing documents. "
                    f"Use --force flag to overwrite existing notes, or use --version to create a new version."
                )

        logger.info("✓ No existing notes found - safe to proceed")

    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        logger.warning(f"Failed to check for duplicates (non-fatal): {e}")
        # Don't fail execution if duplicate check fails - allow pipeline to continue
