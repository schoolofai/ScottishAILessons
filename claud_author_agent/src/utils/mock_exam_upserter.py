"""Mock Exam upserter module - deterministic Python-based database persistence.

Handles upserting of generated mock exams to Appwrite database after agent completion.
Includes compression of sections field to fit within Appwrite's 100k char limit.

Post-processing step in the pipeline:
  Extract -> Agent (Claude SDK) -> Upsert (this)
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from .compression import compress_json_gzip_base64, get_compression_stats
from ..tools.mock_exam_validator_tool import validate_mock_exam_schema

logger = logging.getLogger(__name__)


async def upsert_mock_exam_to_appwrite(
    mock_exam_file_path: str,
    courseId: str,
    version: str,
    mcp_config_path: str,
    force: bool = False
) -> str:
    """Upsert mock exam to Appwrite with version support and force mode.

    Process:
    1. Read mock_exam.json file from workspace
    2. Validate JSON structure with Pydantic schema
    3. [FORCE MODE] If existing mock exam found, delete it
    4. Transform to Appwrite schema:
       - Compress sections array (gzip+base64)
       - Stringify metadata object
       - Stringify summary object
       - Add version, status, courseId
    5. Create document in default.mock_exams collection
    6. Return document ID

    Args:
        mock_exam_file_path: Path to mock_exam.json file
        courseId: Course identifier
        version: Mock exam version (e.g., "1", "2")
        mcp_config_path: Path to .mcp.json
        force: If True, overwrite existing mock exam for this courseId+version

    Returns:
        Appwrite document ID

    Raises:
        ValueError: If mock exam file invalid or validation fails
        FileNotFoundError: If mock exam file missing
    """
    logger.info("Starting mock exam upsert to Appwrite")
    logger.info(f"  Mock exam file: {mock_exam_file_path}")
    logger.info(f"  Course ID: {courseId}")
    logger.info(f"  Version: {version}")
    logger.info(f"  Force mode: {'YES' if force else 'NO'}")

    # Step 1: Read and parse mock exam file
    mock_exam_data = _read_mock_exam_file(mock_exam_file_path)
    logger.info("Mock exam file loaded successfully")

    # Step 2: Auto-correct and validate structure with Pydantic
    # Auto-correction applies deterministic fixes before validation
    corrected_data = _validate_mock_exam_structure(mock_exam_data)
    logger.info("Mock exam structure validated (with auto-corrections applied)")

    # Step 3: Check for existing mock exam (handle force mode)
    existing_doc_id = await _check_existing_mock_exam(
        courseId, version, mcp_config_path, force
    )

    # Step 4: Transform to Appwrite schema (use corrected data)
    document_data = _transform_to_appwrite_schema(corrected_data, courseId, version)
    logger.info("Data transformation complete")

    # Step 5: Create document in Appwrite
    doc_id = await _create_mock_exam_document(
        document_data, mcp_config_path, existing_doc_id
    )

    logger.info(f"Mock exam upserted successfully: {doc_id}")
    return doc_id


def _read_mock_exam_file(file_path: str) -> Dict[str, Any]:
    """Read and parse mock exam JSON file.

    Args:
        file_path: Path to mock_exam.json

    Returns:
        Parsed JSON data as dictionary

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If JSON is invalid
    """
    mock_exam_path = Path(file_path)

    if not mock_exam_path.exists():
        raise FileNotFoundError(
            f"Mock exam file not found: {file_path}. "
            f"Agent may not have completed successfully."
        )

    try:
        with open(mock_exam_path) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in mock exam file: {e}")


def _validate_mock_exam_structure(mock_exam_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate mock exam structure with Pydantic schema.

    Applies auto-correction before validation for more deterministic results.

    Args:
        mock_exam_data: Mock exam data dictionary

    Returns:
        Corrected mock exam data dictionary

    Raises:
        ValueError: If validation fails after auto-correction
    """
    from .mock_exam_auto_correction import auto_correct_mock_exam, get_correction_stats

    # Apply auto-correction before validation
    logger.info("Running auto-correction on mock exam data...")
    corrected_data, corrections = auto_correct_mock_exam(mock_exam_data)

    if corrections:
        stats = get_correction_stats(corrections)
        logger.info(f"Auto-correction applied {stats['total']} fixes:")
        logger.info(f"  - MCQ fixes: {stats['mcq_fixes']}")
        logger.info(f"  - Hints fixes: {stats['hints_fixes']}")
        logger.info(f"  - Misconceptions fixes: {stats['misconceptions_fixes']}")
    else:
        logger.info("No auto-corrections needed")

    logger.info("Running Pydantic schema validation...")

    mock_exam_json = json.dumps(corrected_data)
    validation_result = validate_mock_exam_schema(mock_exam_json)

    if not validation_result["valid"]:
        error_summary = validation_result["summary"]
        error_details = validation_result.get("errors", [])

        # Format error messages for display
        error_messages = []
        for error in error_details[:10]:
            location = error.get("location", "unknown")
            message = error.get("message", "validation error")
            error_messages.append(f"  - {location}: {message}")

        formatted_errors = "\n".join(error_messages)

        raise ValueError(
            f"Mock exam failed Pydantic schema validation:\n"
            f"{error_summary}\n\n"
            f"Validation errors:\n{formatted_errors}\n\n"
            f"Check workspace files for details."
        )

    logger.info(f"Pydantic validation passed: {validation_result['summary']}")

    return corrected_data


async def _check_existing_mock_exam(
    courseId: str,
    version: str,
    mcp_config_path: str,
    force: bool
) -> Optional[str]:
    """Check for existing mock exam and handle force mode.

    When force=True, this function deletes:
    1. The existing mock exam document
    2. All associated diagram documents (prevents orphaned diagrams)
    3. All associated diagram images from storage

    Args:
        courseId: Course identifier
        version: Mock exam version
        mcp_config_path: Path to MCP config
        force: If True, delete existing document and its diagrams

    Returns:
        Existing document ID if found and not deleted, None otherwise

    Raises:
        ValueError: If existing mock exam found and force=False
    """
    from .appwrite_mcp import list_appwrite_documents, delete_appwrite_document
    from .diagram_cleanup import delete_existing_diagrams_for_mock_exam

    existing_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="mock_exams",
        queries=[
            f'equal("courseId", "{courseId}")',
            f'equal("version", "{version}")'
        ],
        mcp_config_path=mcp_config_path
    )

    if existing_docs and len(existing_docs) > 0:
        existing_doc = existing_docs[0]
        existing_id = existing_doc.get('$id', '')
        existing_exam_id = existing_doc.get('examId', '')

        if force:
            logger.warning(f"FORCE MODE: Deleting existing mock exam {existing_id}")

            # Step 1: Delete associated diagrams FIRST (to prevent orphans)
            if existing_exam_id:
                logger.info(f"Cleaning up diagrams for exam: {existing_exam_id}")
                try:
                    diagram_cleanup_result = await delete_existing_diagrams_for_mock_exam(
                        exam_id=existing_exam_id,
                        course_id=courseId,
                        version=version,
                        mcp_config_path=mcp_config_path
                    )
                    if diagram_cleanup_result["deleted_count"] > 0:
                        logger.info(
                            f"✅ Cleaned up {diagram_cleanup_result['deleted_count']} diagrams "
                            f"({len(diagram_cleanup_result['storage_ids'])} storage files)"
                        )
                    else:
                        logger.info("No existing diagrams found to clean up")
                except Exception as e:
                    # Log warning but continue - diagram cleanup is best-effort
                    # (diagrams may not have been persisted yet)
                    logger.warning(f"⚠️  Diagram cleanup failed (non-fatal): {e}")

            # Step 2: Delete the mock exam document
            await delete_appwrite_document(
                database_id="default",
                collection_id="mock_exams",
                document_id=existing_id,
                mcp_config_path=mcp_config_path
            )
            logger.info(f"Deleted existing mock exam: {existing_id}")
            return None
        else:
            raise ValueError(
                f"Mock exam already exists for courseId='{courseId}' version='{version}' "
                f"(document ID: {existing_id}). Use --force to overwrite."
            )

    return None


def _transform_to_appwrite_schema(
    mock_exam_data: Dict[str, Any],
    courseId: str,
    version: str
) -> Dict[str, Any]:
    """Transform mock exam data to Appwrite document schema.

    Compresses sections array and stringifies JSON objects.

    Args:
        mock_exam_data: Validated mock exam data
        courseId: Course identifier
        version: Mock exam version

    Returns:
        Document data ready for Appwrite
    """
    # Compress sections (largest field)
    sections = mock_exam_data.get("sections", [])
    sections_compressed = compress_json_gzip_base64(sections)
    sections_stats = get_compression_stats(sections)

    logger.info(
        f"Sections compressed: {sections_stats['original']} -> "
        f"{sections_stats['compressed']} chars ({sections_stats['savings']} reduction)"
    )

    # Stringify metadata object
    metadata = mock_exam_data.get("metadata", {})
    metadata_str = json.dumps(metadata)
    logger.info(f"Metadata JSON size: {len(metadata_str)} chars")

    # Stringify summary object
    summary = mock_exam_data.get("summary", {})
    summary_str = json.dumps(summary)
    logger.info(f"Summary JSON size: {len(summary_str)} chars")

    # Build document data
    document_data = {
        "examId": mock_exam_data.get("examId", ""),
        "courseId": courseId,
        "sowId": mock_exam_data.get("sowId", ""),
        "sowEntryOrder": mock_exam_data.get("sowEntryOrder", 0),
        "metadata": metadata_str,
        "sections": sections_compressed,
        "summary": summary_str,
        "version": version,
        "status": "draft",
        "generated_at": mock_exam_data.get("generated_at", ""),
        "agent_version": mock_exam_data.get("agent_version", "mock_exam_author_v1.0")
    }

    return document_data


async def _create_mock_exam_document(
    document_data: Dict[str, Any],
    mcp_config_path: str,
    existing_doc_id: Optional[str] = None
) -> str:
    """Create mock exam document in Appwrite.

    Args:
        document_data: Transformed document data
        mcp_config_path: Path to MCP config
        existing_doc_id: If provided, use this ID (for updates)

    Returns:
        Created document ID

    Raises:
        ValueError: If document creation fails
    """
    from .appwrite_mcp import create_appwrite_document

    # Use auto-generated ID
    doc_id = "unique()"

    logger.info("Creating mock exam document in Appwrite...")
    logger.info(f"  examId: {document_data['examId']}")
    logger.info(f"  courseId: {document_data['courseId']}")
    logger.info(f"  version: {document_data['version']}")

    try:
        result = await create_appwrite_document(
            database_id="default",
            collection_id="mock_exams",
            document_id=doc_id,
            data=document_data,
            permissions=['read("any")'],
            mcp_config_path=mcp_config_path
        )

        logger.info(f"Mock exam created: {result['$id']}")
        return result['$id']

    except Exception as e:
        logger.error(f"Appwrite upsert failed: {e}")

        # Log field sizes for debugging
        if "size" in str(e).lower() or "limit" in str(e).lower():
            logger.error("Field sizes being sent:")
            logger.error(f"  - sections: {len(document_data['sections'])} chars")
            logger.error(f"  - metadata: {len(document_data['metadata'])} chars")
            logger.error(f"  - summary: {len(document_data['summary'])} chars")

        raise ValueError(
            f"Failed to upsert mock exam to Appwrite: {e}. "
            f"Check Appwrite connection and field size limits."
        )


async def publish_mock_exam(
    mock_exam_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Publish a draft mock exam by setting status to 'published'.

    Args:
        mock_exam_id: Document ID of the mock exam
        mcp_config_path: Path to MCP config

    Returns:
        Updated document data

    Raises:
        ValueError: If mock exam not found or update fails
    """
    from .appwrite_mcp import update_appwrite_document, get_appwrite_document

    logger.info(f"Publishing mock exam: {mock_exam_id}")

    # Verify mock exam exists
    existing = await get_appwrite_document(
        database_id="default",
        collection_id="mock_exams",
        document_id=mock_exam_id,
        mcp_config_path=mcp_config_path
    )

    if not existing:
        raise ValueError(f"Mock exam not found: {mock_exam_id}")

    current_status = existing.get('status', 'unknown')
    if current_status == 'published':
        logger.warning(f"Mock exam {mock_exam_id} is already published")
        return existing

    # Update status to published
    result = await update_appwrite_document(
        database_id="default",
        collection_id="mock_exams",
        document_id=mock_exam_id,
        data={"status": "published"},
        mcp_config_path=mcp_config_path
    )

    logger.info(f"Mock exam published: {mock_exam_id}")
    return result


async def archive_mock_exam(
    mock_exam_id: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Archive a mock exam by setting status to 'archived'.

    Args:
        mock_exam_id: Document ID of the mock exam
        mcp_config_path: Path to MCP config

    Returns:
        Updated document data

    Raises:
        ValueError: If mock exam not found or update fails
    """
    from .appwrite_mcp import update_appwrite_document

    logger.info(f"Archiving mock exam: {mock_exam_id}")

    result = await update_appwrite_document(
        database_id="default",
        collection_id="mock_exams",
        document_id=mock_exam_id,
        data={"status": "archived"},
        mcp_config_path=mcp_config_path
    )

    logger.info(f"Mock exam archived: {mock_exam_id}")
    return result
