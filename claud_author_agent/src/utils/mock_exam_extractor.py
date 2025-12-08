"""Mock Exam Entry Extractor for Mock Exam Author Agent.

Extracts mock_exam type entries from Authored_SOW collection by courseId.
Writes extracted data to workspace for agent processing.

Pre-processing step in the pipeline:
  Extract (this) -> Agent (Claude SDK) -> Upsert (mock_exam_upserter)
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple

from .appwrite_mcp import list_appwrite_documents
from .compression import decompress_json_gzip_base64

logger = logging.getLogger(__name__)


async def extract_mock_exam_entries_to_workspace(
    courseId: str,
    mcp_config_path: str,
    workspace_path: Path
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Extract mock_exam entries from Authored_SOW to workspace files.

    Creates files in workspace:
    1. mock_exam_source.json: All mock_exam type entries from SOW
    2. sow_context.json: Course-level SOW metadata for context

    Note: Only SOW documents with status='published' are retrieved.
    Draft SOWs are excluded to ensure quality control.

    Args:
        courseId: Course identifier (e.g., 'course_c84474')
        mcp_config_path: Path to MCP config file
        workspace_path: Workspace directory path

    Returns:
        Tuple of (mock_exam_entries_list, sow_metadata_dict)

    Raises:
        ValueError: If published SOW not found, no mock_exam entries, or data invalid
    """
    logger.info(f"Extracting mock_exam entries for courseId='{courseId}'")

    # Step 1: Query Authored_SOW collection (only published)
    sow_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="Authored_SOW",
        queries=[
            f'equal("courseId", "{courseId}")',
            'equal("status", "published")'
        ],
        mcp_config_path=mcp_config_path
    )

    if not sow_docs or len(sow_docs) == 0:
        raise ValueError(
            f"Published SOW not found: No published SOW with courseId='{courseId}' "
            f"in default.Authored_SOW collection. Please ensure the SOW is authored "
            f"and published (status='published') before generating mock exams."
        )

    sow_doc = sow_docs[0]
    sow_id = sow_doc.get('$id', '')
    logger.info(f"Found published SOW: {sow_id}")

    # Step 2: Decompress entries field
    entries = sow_doc.get('entries', [])
    if isinstance(entries, str):
        try:
            entries = decompress_json_gzip_base64(entries)
        except ValueError as e:
            logger.error(f"Failed to decompress entries field: {e}")
            raise ValueError(
                f"Cannot parse entries field for courseId '{courseId}': {e}. "
                f"The entries field may be corrupted or in an unsupported format."
            )

    if not isinstance(entries, list):
        raise ValueError(
            f"Entries field is not a list for courseId '{courseId}'. "
            f"Got type: {type(entries).__name__}"
        )

    logger.info(f"Decompressed {len(entries)} total entries from SOW")

    # Step 3: Filter entries where lesson_type == "mock_exam"
    mock_exam_entries = _filter_mock_exam_entries(entries)

    if len(mock_exam_entries) == 0:
        raise ValueError(
            f"No mock_exam entries found: SOW for courseId='{courseId}' has "
            f"{len(entries)} total entries but none with lesson_type='mock_exam'. "
            f"Available lesson_types: {_get_unique_lesson_types(entries)}"
        )

    logger.info(f"Found {len(mock_exam_entries)} mock_exam entry(ies)")

    # Step 4: Extract SOW metadata (course-level context)
    sow_metadata = _extract_sow_metadata(sow_doc, entries, courseId)

    # Step 5: Write mock_exam_source.json (all mock_exam entries)
    source_file_path = workspace_path / "mock_exam_source.json"
    source_data = {
        "courseId": courseId,
        "sowId": sow_id,
        "mock_exam_entries": mock_exam_entries,
        "total_mock_exams": len(mock_exam_entries)
    }
    with open(source_file_path, 'w') as f:
        json.dump(source_data, f, indent=2)
    logger.info(f"Written mock_exam_source.json to {source_file_path}")

    # Step 6: Write sow_context.json (SOW metadata)
    context_file_path = workspace_path / "sow_context.json"
    with open(context_file_path, 'w') as f:
        json.dump(sow_metadata, f, indent=2)
    logger.info(f"Written sow_context.json to {context_file_path}")

    return (mock_exam_entries, sow_metadata)


def _filter_mock_exam_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter SOW entries to only include mock_exam lesson types.

    Args:
        entries: List of SOW entry dictionaries

    Returns:
        Filtered list containing only mock_exam entries
    """
    mock_exam_entries = []

    for entry in entries:
        lesson_type = entry.get('lesson_type', '')

        # Check for mock_exam lesson type
        if lesson_type == 'mock_exam':
            mock_exam_entries.append(entry)
            logger.debug(
                f"Found mock_exam: order={entry.get('order')}, "
                f"label='{entry.get('label', 'N/A')}'"
            )

    return mock_exam_entries


def _get_unique_lesson_types(entries: List[Dict[str, Any]]) -> List[str]:
    """Get list of unique lesson_type values from entries.

    Args:
        entries: List of SOW entry dictionaries

    Returns:
        Sorted list of unique lesson_type values
    """
    lesson_types = set()
    for entry in entries:
        lesson_type = entry.get('lesson_type', 'unknown')
        lesson_types.add(lesson_type)
    return sorted(lesson_types)


def _extract_sow_metadata(
    sow_doc: Dict[str, Any],
    entries: List[Dict[str, Any]],
    courseId: str
) -> Dict[str, Any]:
    """Extract SOW-level metadata for context.

    Args:
        sow_doc: Full SOW document from Appwrite
        entries: Decompressed entries list
        courseId: Course identifier

    Returns:
        Dictionary with SOW metadata for agent context
    """
    return {
        "courseId": courseId,
        "sowId": sow_doc.get('$id', ''),
        "subject": sow_doc.get('subject', ''),
        "level": sow_doc.get('level', ''),
        "coherence": sow_doc.get('coherence', ''),
        "accessibility_notes": sow_doc.get('accessibility_notes', ''),
        "engagement_notes": sow_doc.get('engagement_notes', ''),
        "total_entries": len(entries),
        "lesson_type_breakdown": _get_lesson_type_counts(entries)
    }


def _get_lesson_type_counts(entries: List[Dict[str, Any]]) -> Dict[str, int]:
    """Count entries by lesson_type.

    Args:
        entries: List of SOW entry dictionaries

    Returns:
        Dictionary mapping lesson_type to count
    """
    counts: Dict[str, int] = {}
    for entry in entries:
        lesson_type = entry.get('lesson_type', 'unknown')
        counts[lesson_type] = counts.get(lesson_type, 0) + 1
    return counts


async def get_course_metadata(
    courseId: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Get course metadata from courses collection.

    Fetches course details like subject, level, title for enriching mock exam.

    Args:
        courseId: Course identifier
        mcp_config_path: Path to MCP config

    Returns:
        Dictionary with course metadata

    Raises:
        ValueError: If course not found
    """
    logger.info(f"Fetching course metadata for courseId='{courseId}'")

    course_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="courses",
        queries=[f'equal("courseId", "{courseId}")'],
        mcp_config_path=mcp_config_path
    )

    if not course_docs or len(course_docs) == 0:
        raise ValueError(
            f"Course not found: No course with courseId='{courseId}' "
            f"in default.courses collection."
        )

    course_doc = course_docs[0]

    course_metadata = {
        "courseId": courseId,
        "title": course_doc.get('title', ''),
        "subject": course_doc.get('subject', ''),
        "level": course_doc.get('level', ''),
        "sqa_course_code": course_doc.get('sqa_course_code', ''),
        "description": course_doc.get('description', '')
    }

    logger.info(
        f"Course metadata: subject='{course_metadata['subject']}', "
        f"level='{course_metadata['level']}'"
    )

    return course_metadata


async def validate_mock_exam_prerequisites(
    courseId: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Validate all prerequisites for mock exam generation.

    Pre-flight check that ensures:
    1. Course exists in courses collection
    2. Published SOW exists for course
    3. SOW contains at least one mock_exam entry

    Args:
        courseId: Course identifier
        mcp_config_path: Path to MCP config

    Returns:
        Dictionary with validation results and summary

    Raises:
        ValueError: If any prerequisite fails (fail-fast)
    """
    logger.info(f"Validating mock exam prerequisites for courseId='{courseId}'")

    # Check 1: Course exists
    course_metadata = await get_course_metadata(courseId, mcp_config_path)

    # Check 2: Published SOW exists
    sow_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="Authored_SOW",
        queries=[
            f'equal("courseId", "{courseId}")',
            'equal("status", "published")'
        ],
        mcp_config_path=mcp_config_path
    )

    if not sow_docs or len(sow_docs) == 0:
        raise ValueError(
            f"Published SOW not found for courseId='{courseId}'. "
            f"Please author and publish the SOW first."
        )

    sow_doc = sow_docs[0]

    # Check 3: Mock exam entries exist
    entries = sow_doc.get('entries', [])
    if isinstance(entries, str):
        entries = decompress_json_gzip_base64(entries)

    mock_exam_entries = _filter_mock_exam_entries(entries)

    if len(mock_exam_entries) == 0:
        raise ValueError(
            f"No mock_exam entries in SOW for courseId='{courseId}'. "
            f"The SOW must contain entries with lesson_type='mock_exam'."
        )

    validation_result = {
        "valid": True,
        "courseId": courseId,
        "course_title": course_metadata.get('title', ''),
        "course_subject": course_metadata.get('subject', ''),
        "course_level": course_metadata.get('level', ''),
        "sow_id": sow_doc.get('$id', ''),
        "total_sow_entries": len(entries),
        "mock_exam_count": len(mock_exam_entries),
        "mock_exam_orders": [e.get('order') for e in mock_exam_entries]
    }

    logger.info(
        f"Prerequisites validated: {validation_result['mock_exam_count']} "
        f"mock exam(s) found at orders {validation_result['mock_exam_orders']}"
    )

    return validation_result
