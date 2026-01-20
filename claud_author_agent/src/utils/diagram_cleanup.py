"""Diagram cleanup utilities for force delete operations.

Handles deletion of diagram data when --force flag is used:
1. Deletes diagram documents from lesson_diagrams collection
2. Deletes image files from Appwrite Storage

Follows fast-fail principle: Throws exceptions on delete errors.
"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


async def delete_existing_diagrams_for_lesson(
    course_id: str,
    order: int,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Delete all diagrams for a lesson (database + storage).

    Used when --force flag is set to regenerate all diagrams.

    Args:
        course_id: Course identifier
        order: Lesson order number
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary with deletion results:
        {
            "deleted_count": int,
            "database_ids": List[str],
            "storage_ids": List[str],
            "errors": List[str]
        }

    Raises:
        Exception: On fatal delete errors (fast-fail)

    Example:
        >>> result = await delete_existing_diagrams_for_lesson(
        ...     "course_c84874", 5, ".mcp.json"
        ... )
        >>> result["deleted_count"]
        3
    """
    from .diagram_extractor import fetch_lesson_template
    from .appwrite_mcp import list_appwrite_documents, delete_appwrite_document
    from .storage_uploader import delete_diagram_image

    # Fetch lesson template to get lessonTemplateId
    logger.info(f"Fetching lesson template for order {order} to get lessonTemplateId...")

    template = await fetch_lesson_template(
        course_id=course_id,
        order=order,
        mcp_config_path=mcp_config_path
    )

    if not template:
        logger.warning(f"No lesson template found for courseId={course_id}, order={order}")
        return {
            "deleted_count": 0,
            "database_ids": [],
            "storage_ids": [],
            "errors": ["Lesson template not found"]
        }

    lesson_template_id = template["$id"]
    logger.info(f"Found lesson template: {lesson_template_id}")

    # Query existing diagrams for this lesson
    logger.info(f"Querying existing diagrams for lesson {lesson_template_id}...")

    diagrams = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_diagrams",
        queries=[f'equal("lessonTemplateId", "{lesson_template_id}")'],
        mcp_config_path=mcp_config_path
    )

    # list_appwrite_documents returns a list directly, not a dict with "documents" key
    diagram_docs = diagrams if isinstance(diagrams, list) else diagrams.get("documents", [])

    if len(diagram_docs) == 0:
        logger.info(f"No existing diagrams found for lesson order {order}")
        return {
            "deleted_count": 0,
            "database_ids": [],
            "storage_ids": [],
            "errors": []
        }

    logger.info(f"Found {len(diagram_docs)} existing diagrams to delete")

    # Delete each diagram
    deleted_count = 0
    database_ids = []
    storage_ids = []
    errors = []

    for diagram in diagram_docs:
        diagram_id = diagram["$id"]
        card_id = diagram.get("cardId", "unknown")
        image_file_id = diagram.get("image_file_id")

        logger.info(f"Deleting diagram for card {card_id} (diagram_id: {diagram_id})...")

        # Delete storage file if exists
        if image_file_id:
            try:
                await delete_diagram_image(
                    file_id=image_file_id,
                    mcp_config_path=mcp_config_path
                )
                storage_ids.append(image_file_id)
                logger.info(f"✅ Deleted storage file: {image_file_id}")
            except Exception as e:
                # Log warning but continue (storage file may already be deleted)
                logger.warning(f"⚠️  Failed to delete storage file {image_file_id}: {e}")
                errors.append(f"Storage delete failed for {image_file_id}: {str(e)}")

        # Delete database record
        try:
            await delete_appwrite_document(
                database_id="default",
                collection_id="lesson_diagrams",
                document_id=diagram_id,
                mcp_config_path=mcp_config_path
            )
            database_ids.append(diagram_id)
            deleted_count += 1
            logger.info(f"✅ Deleted diagram document: {diagram_id}")

        except Exception as e:
            # Fast-fail on database delete errors
            error_msg = f"Failed to delete diagram {diagram_id}: {str(e)}"
            logger.error(f"❌ {error_msg}")
            errors.append(error_msg)
            raise Exception(error_msg)  # Fast-fail

    logger.info(f"✅ Deleted {deleted_count} diagrams for lesson order {order}")

    return {
        "deleted_count": deleted_count,
        "database_ids": database_ids,
        "storage_ids": storage_ids,
        "errors": errors
    }


async def delete_existing_diagrams_for_mock_exam(
    exam_id: str,
    course_id: str,
    version: str,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Delete all diagrams associated with a mock exam (database + storage).

    Used when --force flag is set to regenerate mock exam with new diagrams.
    Queries diagrams by examId to find all associated diagram documents.

    NOTE: This requires diagrams to have an `examId` field. If diagrams are
    stored in lesson_diagrams collection, they may need to be adapted or
    a mock_exam_diagrams collection created.

    For now, this function also attempts to query by courseId+version as a
    fallback identifier pattern.

    Args:
        exam_id: Mock exam identifier (e.g., "exam_c84473_v1")
        course_id: Course identifier (e.g., "course_c84473")
        version: Mock exam version (e.g., "1", "2")
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary with deletion results:
        {
            "deleted_count": int,
            "database_ids": List[str],
            "storage_ids": List[str],
            "errors": List[str]
        }

    Raises:
        Exception: On fatal delete errors (fast-fail)
    """
    from .appwrite_mcp import list_appwrite_documents, delete_appwrite_document
    from .storage_uploader import delete_diagram_image

    logger.info(f"Checking for existing diagrams for mock exam: {exam_id}")
    logger.info(f"   Course: {course_id}, Version: {version}")

    # Try to query diagrams by examId (if they have this field)
    # This supports future mock_exam_diagrams collection
    diagrams = []

    try:
        # Try querying by examId in lesson_diagrams (future-compatible)
        result = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_diagrams",
            queries=[f'equal("examId", "{exam_id}")'],
            mcp_config_path=mcp_config_path
        )
        diagrams = result.get("documents", []) if isinstance(result, dict) else result

    except Exception as e:
        # examId field may not exist yet - this is expected
        logger.debug(f"No examId field in lesson_diagrams (expected): {e}")

    # If no diagrams found by examId, try querying by lessonTemplateId pattern
    # Mock exams may store diagrams with lessonTemplateId = exam_id
    if not diagrams:
        try:
            result = await list_appwrite_documents(
                database_id="default",
                collection_id="lesson_diagrams",
                queries=[f'equal("lessonTemplateId", "{exam_id}")'],
                mcp_config_path=mcp_config_path
            )
            diagrams = result.get("documents", []) if isinstance(result, dict) else result

        except Exception as e:
            logger.debug(f"No diagrams found with lessonTemplateId={exam_id}: {e}")

    if not diagrams or len(diagrams) == 0:
        logger.info(f"No existing diagrams found for mock exam {exam_id}")
        return {
            "deleted_count": 0,
            "database_ids": [],
            "storage_ids": [],
            "errors": []
        }

    logger.info(f"Found {len(diagrams)} existing diagrams to delete for mock exam {exam_id}")

    # Delete each diagram
    deleted_count = 0
    database_ids = []
    storage_ids = []
    errors = []

    for diagram in diagrams:
        diagram_id = diagram["$id"]
        card_id = diagram.get("cardId", "unknown")
        image_file_id = diagram.get("image_file_id")

        logger.info(f"Deleting mock exam diagram for card {card_id} (diagram_id: {diagram_id})...")

        # Delete storage file if exists
        if image_file_id:
            try:
                await delete_diagram_image(
                    file_id=image_file_id,
                    mcp_config_path=mcp_config_path
                )
                storage_ids.append(image_file_id)
                logger.info(f"✅ Deleted storage file: {image_file_id}")
            except Exception as e:
                # Log warning but continue (storage file may already be deleted)
                logger.warning(f"⚠️  Failed to delete storage file {image_file_id}: {e}")
                errors.append(f"Storage delete failed for {image_file_id}: {str(e)}")

        # Delete database record
        try:
            await delete_appwrite_document(
                database_id="default",
                collection_id="lesson_diagrams",
                document_id=diagram_id,
                mcp_config_path=mcp_config_path
            )
            database_ids.append(diagram_id)
            deleted_count += 1
            logger.info(f"✅ Deleted diagram document: {diagram_id}")

        except Exception as e:
            # Fast-fail on database delete errors
            error_msg = f"Failed to delete diagram {diagram_id}: {str(e)}"
            logger.error(f"❌ {error_msg}")
            errors.append(error_msg)
            raise Exception(error_msg)  # Fast-fail

    logger.info(f"✅ Deleted {deleted_count} diagrams for mock exam {exam_id}")

    return {
        "deleted_count": deleted_count,
        "database_ids": database_ids,
        "storage_ids": storage_ids,
        "errors": errors
    }


async def delete_diagrams_batch(
    course_id: str,
    lesson_orders: List[int],
    mcp_config_path: str
) -> Dict[str, Any]:
    """Delete diagrams for multiple lessons in batch.

    Args:
        course_id: Course identifier
        lesson_orders: List of lesson order numbers
        mcp_config_path: Path to MCP config file

    Returns:
        Dictionary with batch deletion results:
        {
            "total_deleted": int,
            "lessons_processed": int,
            "results": Dict[int, Dict]  # order → deletion result
        }

    Example:
        >>> result = await delete_diagrams_batch(
        ...     "course_c84874", [1, 2, 3], ".mcp.json"
        ... )
        >>> result["total_deleted"]
        8
    """
    results = {}
    total_deleted = 0

    for order in lesson_orders:
        try:
            result = await delete_existing_diagrams_for_lesson(
                course_id=course_id,
                order=order,
                mcp_config_path=mcp_config_path
            )
            results[order] = result
            total_deleted += result["deleted_count"]

        except Exception as e:
            logger.error(f"Failed to delete diagrams for lesson {order}: {e}")
            results[order] = {
                "deleted_count": 0,
                "database_ids": [],
                "storage_ids": [],
                "errors": [str(e)]
            }
            # Continue to next lesson (partial success model)

    return {
        "total_deleted": total_deleted,
        "lessons_processed": len(lesson_orders),
        "results": results
    }


async def delete_diagrams_for_lesson_ids(
    diagrams: List[Dict[str, Any]],
    mcp_config_path: str,
    batch_logger: logging.Logger
) -> Dict[str, Any]:
    """Delete all diagrams (database + storage) for batch deletion mode.

    This is used by the batch delete command to delete diagrams for multiple
    lesson templates at once. It accepts pre-fetched diagram documents and
    deletes both storage files and database records.

    Args:
        diagrams: List of diagram documents (already fetched)
        mcp_config_path: Path to MCP config file
        batch_logger: Logger for batch operations

    Returns:
        Dictionary with deletion results:
        {
            "deleted_diagrams": int,
            "deleted_storage": int,
            "storage_errors": List[str]
        }

    Raises:
        Exception: On database delete failure (fast-fail)

    Example:
        >>> result = await delete_diagrams_for_lesson_ids(
        ...     diagrams=[{...}, {...}],
        ...     mcp_config_path=".mcp.json",
        ...     batch_logger=logger
        ... )
        >>> result["deleted_diagrams"]
        15
    """
    from .appwrite_mcp import delete_appwrite_document
    from .storage_uploader import delete_diagram_image

    deleted_diagrams = 0
    deleted_storage = 0
    storage_errors = []

    batch_logger.info(f"Deleting {len(diagrams)} diagrams (storage + database)...")

    for idx, diagram in enumerate(diagrams, 1):
        diagram_id = diagram.get('$id')
        lesson_id = diagram.get('lessonTemplateId', 'unknown')
        card_id = diagram.get('cardId', 'unknown')
        image_file_id = diagram.get('image_file_id')

        batch_logger.info(f"  [{idx}/{len(diagrams)}] Deleting diagram {diagram_id} (lesson: {lesson_id}, card: {card_id})")

        # Step 1: Delete storage file (non-fatal on error)
        if image_file_id:
            try:
                await delete_diagram_image(
                    file_id=image_file_id,
                    mcp_config_path=mcp_config_path
                )
                deleted_storage += 1
                batch_logger.debug(f"    ✅ Storage file deleted: {image_file_id}")
            except Exception as e:
                # Storage delete is non-fatal (file may already be gone)
                error_msg = f"Storage delete failed for {image_file_id}: {str(e)}"
                batch_logger.warning(f"    ⚠️  {error_msg}")
                storage_errors.append(error_msg)

        # Step 2: Delete database record (FATAL on error - fast-fail)
        try:
            await delete_appwrite_document(
                database_id="default",
                collection_id="lesson_diagrams",
                document_id=diagram_id,
                mcp_config_path=mcp_config_path
            )
            deleted_diagrams += 1
            batch_logger.debug(f"    ✅ Database record deleted: {diagram_id}")

        except Exception as e:
            # Database delete is FATAL - raise immediately
            error_msg = f"Failed to delete diagram document {diagram_id}: {str(e)}"
            batch_logger.error(f"    ❌ {error_msg}")
            raise Exception(error_msg)

    batch_logger.info(f"✅ Deleted {deleted_diagrams} diagram documents, {deleted_storage} storage files")

    if storage_errors:
        batch_logger.warning(f"⚠️  {len(storage_errors)} storage deletions failed (non-fatal)")

    return {
        "deleted_diagrams": deleted_diagrams,
        "deleted_storage": deleted_storage,
        "storage_errors": storage_errors
    }
