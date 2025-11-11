"""Data extraction utilities for Revision Notes Author.

Extracts course data, SOW, lesson templates, outcomes, and diagrams from Appwrite
and prepares them as workspace files for the notes author subagent.

All functions use appwrite_mcp.py utilities with mcp_config_path parameter.
Fast-fail principle: Throw detailed exceptions when required data is missing.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

from .appwrite_mcp import (
    get_appwrite_document,
    list_appwrite_documents
)
from .compression import decompress_json_gzip_base64

logger = logging.getLogger(__name__)


def _construct_storage_url(
    image_file_id: str,
    endpoint: str,
    project_id: str,
    bucket_id: str = "6907775a001b754c19a6"
) -> str:
    """Construct Appwrite Storage view URL for a diagram image file.

    Args:
        image_file_id: File ID from diagram metadata (e.g., "dgm_image_0540e9bd")
        endpoint: Appwrite endpoint from MCP config (includes /v1)
        project_id: Appwrite project ID from MCP config
        bucket_id: Storage bucket ID (default: "6907775a001b754c19a6" for images bucket)

    Returns:
        Full URL to view the image in Appwrite Storage

    Example:
        https://cloud.appwrite.io/v1/storage/buckets/6907775a001b754c19a6/files/dgm_image_0540e9bd/view?project=68adb98e0020be2e134f

    Note:
        - The endpoint from MCP config already includes /v1, so we don't add it again
        - Appwrite requires the bucket ID (alphanumeric), not the bucket name ("images")
    """
    return f"{endpoint}/storage/buckets/{bucket_id}/files/{image_file_id}/view?project={project_id}"


async def extract_course_metadata(
    course_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Extract course metadata from default.courses collection.

    Args:
        course_id: Course ID (e.g., 'course_c84473')
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Course document with metadata

    Raises:
        ValueError: If course doesn't exist
    """
    logger.info(f"Extracting course metadata for {course_id}")

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
            f"Ensure the course exists in default.courses collection with courseId='{course_id}'."
        )

    course_doc = course_docs[0]
    logger.info(f"✓ Course metadata extracted: {course_doc.get('courseTitle', 'Unknown')} (document ID: {course_doc.get('$id')})")
    return course_doc


async def extract_authored_sow(
    course_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Extract published Authored SOW with decompression and validation.

    Args:
        course_id: Course ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Decompressed SOW document with entries array

    Raises:
        ValueError: If SOW not found or not published
        Exception: If decompression fails
    """
    logger.info(f"Extracting Authored SOW for {course_id}")

    # Query for published SOW
    sow_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="Authored_SOW",
        queries=[f'equal("courseId", "{course_id}")', 'equal("status", "published")'],
        mcp_config_path=mcp_config_path
    )

    if not sow_docs:
        raise ValueError(
            f"No published SOW found for course {course_id}. "
            f"Ensure an Authored_SOW document exists with status='published'. "
            f"Draft SOWs are not supported."
        )

    sow_doc = sow_docs[0]  # Take first published SOW
    logger.info(f"Found SOW: {sow_doc.get('$id')} (version: {sow_doc.get('version', '1')})")

    # Decompress entries if compressed
    entries_raw = sow_doc.get("entries")

    if not entries_raw:
        raise ValueError(
            f"SOW document {sow_doc['$id']} has no 'entries' field. "
            f"Cannot generate revision notes without lesson entries."
        )

    # Check if entries is compressed (string starting with gzip marker)
    if isinstance(entries_raw, str):
        try:
            logger.info("Decompressing SOW entries...")
            entries = decompress_json_gzip_base64(entries_raw)
            sow_doc["entries"] = entries
            logger.info(f"✓ Decompressed {len(entries)} SOW entries")
        except Exception as e:
            raise Exception(
                f"Failed to decompress SOW entries for {course_id}: {e}. "
                f"The entries field may be corrupted or use an unsupported compression format."
            )
    else:
        # Already decompressed (array)
        entries = entries_raw
        logger.info(f"✓ SOW entries already decompressed ({len(entries)} entries)")

    # Validate entries structure
    if not isinstance(entries, list) or len(entries) == 0:
        raise ValueError(
            f"SOW entries for {course_id} is not a valid array or is empty. "
            f"Cannot generate revision notes without lesson data."
        )

    logger.info(f"✓ Authored SOW validated: {len(entries)} lessons")
    return sow_doc


async def extract_lesson_templates(
    course_id: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Extract all lesson templates for a course with card decompression.

    Args:
        course_id: Course ID
        mcp_config_path: Path to .mcp.json

    Returns:
        List of lesson template documents with decompressed cards

    Raises:
        ValueError: If no lesson templates found
        Exception: If card decompression fails
    """
    logger.info(f"Extracting lesson templates for {course_id}")

    # Query lesson templates by courseId
    lesson_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=[f'equal("courseId", "{course_id}")'],
        mcp_config_path=mcp_config_path
    )

    if not lesson_docs:
        raise ValueError(
            f"No lesson templates found for course {course_id}. "
            f"Ensure lesson templates have been created for this course."
        )

    logger.info(f"Found {len(lesson_docs)} lesson templates")

    # Decompress cards for each lesson template
    for lesson_doc in lesson_docs:
        cards_raw = lesson_doc.get("cards")

        if not cards_raw:
            logger.warning(
                f"Lesson template {lesson_doc['$id']} has no 'cards' field. "
                f"This lesson will have empty content in revision notes."
            )
            lesson_doc["cards"] = []
            continue

        # Check if cards is compressed
        if isinstance(cards_raw, str):
            try:
                cards = decompress_json_gzip_base64(cards_raw)
                lesson_doc["cards"] = cards
                logger.debug(f"  ✓ Decompressed {len(cards)} cards for lesson {lesson_doc.get('sow_order')}")
            except Exception as e:
                logger.error(
                    f"Failed to decompress cards for lesson {lesson_doc['$id']}: {e}. "
                    f"This lesson will have empty content in revision notes."
                )
                lesson_doc["cards"] = []
        else:
            # Already decompressed
            logger.debug(f"  ✓ Cards already decompressed for lesson {lesson_doc.get('sow_order')}")

    # Sort by sow_order for consistent processing
    lesson_docs.sort(key=lambda x: x.get("sow_order", 0))

    logger.info(f"✓ Extracted and decompressed {len(lesson_docs)} lesson templates")
    return lesson_docs


async def extract_course_data(
    subject: str,
    level: str,
    mcp_config_path: str
) -> str:
    """Extract SQA course standards from sqa_education.sqa_current and format as text.

    Args:
        subject: Subject name (e.g., 'application-of-mathematics', 'mathematics')
        level: Level name (e.g., 'national-3', 'national-5')
        mcp_config_path: Path to .mcp.json

    Returns:
        Formatted Course_data.txt content as string

    Raises:
        ValueError: If SQA data not found
    """
    logger.info(f"Extracting SQA course data for {subject} ({level})")

    # Convert subject/level to SQA format (hyphen → underscore)
    sqa_subject = subject.replace("-", "_")

    # Special case: SQA uses "applications" (plural) not "application"
    if sqa_subject == "application_of_mathematics":
        sqa_subject = "applications_of_mathematics"
        logger.info(f"  Converted to SQA plural: {sqa_subject}")

    sqa_level = level.replace("-", "_")

    logger.info(f"  Querying with SQA format: subject='{sqa_subject}', level='{sqa_level}'")

    # Query sqa_current collection
    sqa_docs = await list_appwrite_documents(
        database_id="sqa_education",
        collection_id="sqa_current",
        queries=[
            f'equal("subject", "{sqa_subject}")',
            f'equal("level", "{sqa_level}")'
        ],
        mcp_config_path=mcp_config_path
    )

    if not sqa_docs:
        raise ValueError(
            f"No SQA course data found for subject='{subject}', level='{level}'. "
            f"Queried with SQA format: subject='{sqa_subject}', level='{sqa_level}'. "
            f"Ensure sqa_education.sqa_current has data for this subject/level combination."
        )

    sqa_doc = sqa_docs[0]  # Take first match

    # Format as text for agent consumption
    course_data_text = f"""# SQA Course Data: {subject.title()} ({level.replace('-', ' ').title()})

**Course Code**: {sqa_doc.get('course_code', 'N/A')}
**Subject**: {subject.title()}
**Level**: {level.replace('-', ' ').title()}

## Course Description

{sqa_doc.get('description', 'No description available.')}

## Assessment Standards

{sqa_doc.get('assessment_standards', 'No assessment standards documented.')}

## Key Topics

{sqa_doc.get('topics', 'No topics listed.')}

---

**Source**: SQA Education Database
**Last Updated**: {sqa_doc.get('$updatedAt', 'Unknown')}
"""

    logger.info("✓ SQA course data formatted as text")
    return course_data_text


async def extract_course_outcomes(
    course_id: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Extract course outcomes from default.course_outcomes.

    Args:
        course_id: Course ID (e.g., 'course_c84473')
        mcp_config_path: Path to .mcp.json

    Returns:
        List of course outcome documents

    Raises:
        ValueError: If no outcomes found
    """
    logger.info(f"Extracting course outcomes for {course_id}")

    # Query course_outcomes collection by courseId (NOT by subject/level)
    outcome_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="course_outcomes",
        queries=[f'equal("courseId", "{course_id}")'],
        mcp_config_path=mcp_config_path
    )

    if not outcome_docs:
        raise ValueError(
            f"No course outcomes found for courseId='{course_id}'. "
            f"Ensure default.course_outcomes has data for this course."
        )

    logger.info(f"✓ Extracted {len(outcome_docs)} course outcomes")
    return outcome_docs


async def extract_lesson_diagrams(
    course_id: str,
    lesson_template_ids: List[str],
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Extract lesson diagrams for specified lesson templates.

    Args:
        course_id: Course ID
        lesson_template_ids: List of lesson template IDs to find diagrams for
        mcp_config_path: Path to .mcp.json

    Returns:
        List of lesson diagram documents

    Raises:
        ValueError: If NO diagrams exist for the entire course (per spec requirement)
    """
    logger.info(f"Extracting lesson diagrams for {course_id}")

    # Query diagrams by lessonTemplateId for all lesson templates
    # Note: lesson_diagrams has lessonTemplateId, not courseId (normalized schema)
    # IMPORTANT: Use single equal() query with array of IDs (Appwrite OR semantics)
    # Multiple equal() on same attribute would be interpreted as AND (impossible condition)
    if lesson_template_ids:
        import json
        # Pass all IDs in a single equal() query as JSON array
        # Appwrite interprets Query.equal(field, [val1, val2, ...]) as OR logic
        lesson_id_query = f'equal("lessonTemplateId", {json.dumps(lesson_template_ids)})'

        diagram_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_diagrams",
            queries=[lesson_id_query],  # Single query with array
            mcp_config_path=mcp_config_path
        )
    else:
        logger.warning("No lesson template IDs provided, skipping diagram extraction")
        diagram_docs = []

    # Per spec edge case: If NO diagrams exist for course, throw exception
    if not diagram_docs:
        raise ValueError(
            f"No lesson diagrams found for course {course_id}. "
            f"Per specification requirement, ALL courses must have diagrams. "
            f"Run diagram_author agent first to generate diagrams, then retry notes generation."
        )

    # Filter to only diagrams matching lesson template IDs
    # (Some diagrams may be for other purposes like CFU diagrams)
    relevant_diagrams = []
    for diagram_doc in diagram_docs:
        # Match by lessonTemplateId if present
        if diagram_doc.get("lessonTemplateId") in lesson_template_ids:
            relevant_diagrams.append(diagram_doc)

    logger.info(
        f"✓ Found {len(diagram_docs)} total diagrams, "
        f"{len(relevant_diagrams)} relevant to lesson templates"
    )

    # Enrich diagrams with image URLs for embedding in markdown
    # Load MCP config to get endpoint and project_id
    config_path = Path(mcp_config_path)
    with open(config_path) as f:
        mcp_config = json.load(f)

    appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
    args = appwrite_config.get("args", [])

    endpoint = None
    project_id = None

    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="):
            endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="):
            project_id = arg.split("=", 1)[1]

    # Add image_url to each diagram
    for diagram_doc in relevant_diagrams:
        image_file_id = diagram_doc.get("image_file_id")
        if image_file_id and endpoint and project_id:
            diagram_doc["image_url"] = _construct_storage_url(
                image_file_id=image_file_id,
                endpoint=endpoint,
                project_id=project_id
                # bucket_id defaults to correct images bucket ID
            )
            logger.debug(f"  Added image_url for diagram {diagram_doc.get('$id')}")
        else:
            diagram_doc["image_url"] = None
            logger.warning(f"  Could not construct image_url for diagram {diagram_doc.get('$id')}")

    logger.info(f"✓ Enriched {len(relevant_diagrams)} diagrams with image URLs")

    return relevant_diagrams


async def extract_all_course_data(
    course_id: str,
    workspace_path: Path,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Extract all required data for a course and write to workspace.

    This is a convenience function that orchestrates all extraction functions
    and writes results to the workspace input directory.

    Args:
        course_id: Course ID to extract data for
        workspace_path: Path to workspace directory
        mcp_config_path: Path to .mcp.json

    Returns:
        Dictionary with extraction summary and file paths

    Raises:
        Various exceptions from individual extraction functions
    """
    logger.info("=" * 60)
    logger.info(f"Extracting all data for course: {course_id}")
    logger.info("=" * 60)

    inputs_dir = workspace_path / "inputs"
    inputs_dir.mkdir(parents=True, exist_ok=True)

    # 1. Extract course metadata
    course_doc = await extract_course_metadata(course_id, mcp_config_path)
    subject = course_doc.get("subject", "unknown")
    level = course_doc.get("level", "unknown")

    # 2. Extract and save Authored SOW
    sow_doc = await extract_authored_sow(course_id, mcp_config_path)
    sow_path = inputs_dir / "Authored_SOW.json"
    with open(sow_path, 'w') as f:
        json.dump(sow_doc, f, indent=2)
    logger.info(f"✓ Saved: {sow_path}")

    # 3. Extract and save lesson templates
    lesson_templates = await extract_lesson_templates(course_id, mcp_config_path)
    lesson_templates_dir = inputs_dir / "lesson_templates"
    lesson_templates_dir.mkdir(exist_ok=True)

    for lesson_doc in lesson_templates:
        lesson_order = lesson_doc.get("sow_order", 0)
        lesson_path = lesson_templates_dir / f"lesson_{lesson_order:02d}.json"
        with open(lesson_path, 'w') as f:
            json.dump(lesson_doc, f, indent=2)
    logger.info(f"✓ Saved: {len(lesson_templates)} lesson templates")

    # 4. Extract and save course data (SQA standards)
    course_data_text = await extract_course_data(subject, level, mcp_config_path)
    course_data_path = inputs_dir / "Course_data.txt"
    with open(course_data_path, 'w') as f:
        f.write(course_data_text)
    logger.info(f"✓ Saved: {course_data_path}")

    # 5. Extract and save course outcomes (OPTIONAL - may not exist for all courses)
    course_outcomes = []
    try:
        course_outcomes = await extract_course_outcomes(course_id, mcp_config_path)
        outcomes_path = inputs_dir / "course_outcomes.json"
        with open(outcomes_path, 'w') as f:
            json.dump(course_outcomes, f, indent=2)
        logger.info(f"✓ Saved: {outcomes_path}")
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            logger.warning(f"⚠️  Course outcomes collection not found - skipping (non-fatal)")
            logger.warning(f"   Collection default.course_outcomes may not exist yet")
        else:
            logger.warning(f"⚠️  Failed to extract course outcomes (non-fatal): {e}")

    # 6. Extract and save lesson diagrams (OPTIONAL - may not exist for all lessons)
    lesson_diagrams = []
    try:
        # Extract document IDs from lesson templates (use $id, not lessonTemplateId)
        # Note: lessonTemplateId is a field ON lesson_diagrams (foreign key), not ON lesson_templates
        lesson_template_ids = [lt.get("$id") for lt in lesson_templates]
        lesson_diagrams = await extract_lesson_diagrams(
            course_id,
            lesson_template_ids,
            mcp_config_path
        )
        diagrams_dir = inputs_dir / "lesson_diagrams"
        diagrams_dir.mkdir(exist_ok=True)

        for diagram_doc in lesson_diagrams:
            diagram_id = diagram_doc.get("$id")
            diagram_path = diagrams_dir / f"{diagram_id}.json"
            with open(diagram_path, 'w') as f:
                json.dump(diagram_doc, f, indent=2)
        logger.info(f"✓ Saved: {len(lesson_diagrams)} lesson diagrams")
    except Exception as e:
        logger.warning(f"⚠️  Failed to extract lesson diagrams (non-fatal): {e}")

    logger.info("=" * 60)
    logger.info("✅ All course data extracted successfully")
    logger.info("=" * 60)

    # Use SOW entries count (authoritative) not lesson_templates count (may include unpublished)
    sow_lesson_count = len(sow_doc.get("entries", []))

    return {
        "course_id": course_id,
        "subject": subject,
        "level": level,
        "sow_version": sow_doc.get("version", "1"),
        "lesson_count": sow_lesson_count,  # From SOW, not database query
        "lesson_templates_in_db": len(lesson_templates),  # For debugging
        "diagram_count": len(lesson_diagrams),
        "outcome_count": len(course_outcomes),
        "workspace_path": str(workspace_path)
    }
