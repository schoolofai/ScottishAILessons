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

    diagram_docs = diagrams.get("documents", [])

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
