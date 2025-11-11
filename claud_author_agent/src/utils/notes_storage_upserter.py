"""Storage and database upserter for Revision Notes Author.

Uploads markdown files to Appwrite Storage and creates/updates revision_notes documents.
Follows storage-based architecture where markdown content is stored in Storage bucket
and database documents contain file ID references.

All functions use appwrite_mcp.py utilities with mcp_config_path parameter.
Fast-fail principle: Throw detailed exceptions when operations fail.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from .appwrite_infrastructure import upload_to_appwrite_storage
from .appwrite_mcp import create_appwrite_document, update_appwrite_document

logger = logging.getLogger(__name__)


async def upload_markdown_to_storage(
    bucket_id: str,
    file_path: Path,
    file_id: str,
    mcp_config_path: str,
    force: bool = False
) -> str:
    """Upload a markdown file to Appwrite Storage.

    Args:
        bucket_id: Storage bucket ID (e.g., 'documents')
        file_path: Path to markdown file to upload
        file_id: Unique file ID for storage (e.g., 'course_c84874_cheat_sheet')
        mcp_config_path: Path to .mcp.json configuration
        force: If True, overwrite existing file

    Returns:
        File ID of uploaded file

    Raises:
        FileNotFoundError: If markdown file doesn't exist
        Exception: If upload fails
    """
    logger.info(f"Uploading markdown to Storage: {file_path.name}")

    if not file_path.exists():
        raise FileNotFoundError(
            f"Markdown file not found: {file_path}. "
            f"Ensure the agent generated this file in the workspace."
        )

    if not file_path.suffix == ".md":
        logger.warning(f"File {file_path.name} does not have .md extension")

    try:
        uploaded_file_id = await upload_to_appwrite_storage(
            bucket_id=bucket_id,
            file_path=file_path,
            file_id=file_id,
            mcp_config_path=mcp_config_path,
            force=force
        )

        file_size = file_path.stat().st_size
        logger.info(f"✓ Uploaded {file_path.name} ({file_size} bytes) → {uploaded_file_id}")

        return uploaded_file_id

    except Exception as e:
        raise Exception(
            f"Failed to upload markdown to Storage: {e}. "
            f"File: {file_path}, Bucket: {bucket_id}"
        )


async def create_revision_note_document(
    database_id: str,
    collection_id: str,
    document_id: str,
    data: Dict[str, Any],
    mcp_config_path: str
) -> Dict[str, Any]:
    """Create a revision_notes document in Appwrite database.

    Uses atomic create operation. If document already exists, this will fail
    (use upsert_revision_note for create-or-update semantics).

    Args:
        database_id: Database ID (e.g., 'default')
        collection_id: Collection ID (e.g., 'revision_notes')
        document_id: Document ID (e.g., 'revision_notes_course_c84874_cheat_sheet')
        data: Document data (must include all required fields)
        mcp_config_path: Path to .mcp.json

    Returns:
        Created document with metadata

    Raises:
        Exception: If document already exists or creation fails
    """
    logger.info(f"Creating revision note document: {document_id}")

    # Validate required fields
    required_fields = [
        "courseId", "noteType", "status", "execution_id",
        "markdown_file_id", "version", "generation_timestamp"
    ]

    for field in required_fields:
        if field not in data:
            raise ValueError(
                f"Missing required field '{field}' in revision note data. "
                f"Cannot create document without all required fields."
            )

    # Validate noteType enum
    if data["noteType"] not in ["cheat_sheet", "lesson_note"]:
        raise ValueError(
            f"Invalid noteType: {data['noteType']}. "
            f"Must be 'cheat_sheet' or 'lesson_note'."
        )

    # Validate status enum
    if data["status"] not in ["draft", "published"]:
        raise ValueError(
            f"Invalid status: {data['status']}. "
            f"Must be 'draft' or 'published'."
        )

    # Validate lessonOrder for lesson notes
    if data["noteType"] == "lesson_note":
        if "lessonOrder" not in data or data["lessonOrder"] is None:
            raise ValueError(
                "Lesson notes must have a lessonOrder value. "
                "Cheat sheets should have lessonOrder=null."
            )
    elif data["noteType"] == "cheat_sheet":
        if data.get("lessonOrder") is not None:
            logger.warning(
                f"Cheat sheet has lessonOrder={data['lessonOrder']}, setting to null"
            )
            data["lessonOrder"] = None

    try:
        created_doc = await create_appwrite_document(
            database_id=database_id,
            collection_id=collection_id,
            data=data,
            mcp_config_path=mcp_config_path,
            document_id=document_id
        )

        logger.info(f"✓ Created revision note: {created_doc['$id']}")
        return created_doc

    except Exception as e:
        if "409" in str(e) or "already exists" in str(e).lower():
            raise Exception(
                f"Revision note document already exists: {document_id}. "
                f"Use --force flag to overwrite existing notes."
            )
        raise Exception(f"Failed to create revision note document: {e}")


async def upsert_revision_note(
    note_path: Path,
    course_id: str,
    note_type: str,
    lesson_order: Optional[int],
    version: str,
    execution_id: str,
    mcp_config_path: str,
    sow_version: Optional[str] = None,
    token_usage: Optional[int] = None,
    cost_usd: Optional[float] = None,
    workspace_path: Optional[str] = None,
    force: bool = False
) -> Dict[str, Any]:
    """Upload markdown to Storage and create/update revision_notes document (atomic upsert).

    This is the main function orchestrating both Storage upload and database upsert.
    Implements atomic create-or-update logic based on force flag.

    Args:
        note_path: Path to markdown file in workspace
        course_id: Course ID (e.g., 'course_c84874')
        note_type: 'cheat_sheet' or 'lesson_note'
        lesson_order: Lesson order (1+) for lesson_note, None for cheat_sheet
        version: SOW version (e.g., '1')
        execution_id: Unique execution timestamp (e.g., '20251110_143052')
        mcp_config_path: Path to .mcp.json
        sow_version: SOW version used for generation (optional)
        token_usage: Total tokens used (optional)
        cost_usd: Estimated cost in USD (optional)
        workspace_path: Path to workspace if persisted (optional)
        force: If True, overwrites existing document; if False, fails on duplicate

    Returns:
        Created/updated document

    Raises:
        FileNotFoundError: If markdown file doesn't exist
        Exception: If upload or document creation fails
    """
    logger.info(f"Upserting revision note: {note_type} (course: {course_id})")

    # Step 1: Generate file_id (Storage) and document_id (Database)
    # Note: Appwrite has 36-character limit for both file_id and document_id
    # file_id should NOT include extension (detected automatically from file)
    # document_id must be <=36 chars with only a-z, A-Z, 0-9, underscore (no leading underscore)
    if note_type == "cheat_sheet":
        file_id = f"{course_id}_cheat_sheet"  # e.g., "course_c84473_cheat_sheet" (28 chars)
        document_id = f"{course_id}_cheat_sheet"  # REMOVED 'revision_notes_' prefix (25 chars)
    elif note_type == "lesson_note":
        if lesson_order is None:
            raise ValueError("lesson_order required for lesson_note type")
        file_id = f"{course_id}_lesson_{lesson_order:02d}"  # e.g., "course_c84473_lesson_01" (26 chars)
        document_id = f"{course_id}_lesson_{lesson_order:02d}"  # REMOVED 'revision_notes_' prefix (24 chars)
    else:
        raise ValueError(f"Invalid note_type: {note_type}")

    # Step 2: Upload markdown to Storage
    uploaded_file_id = await upload_markdown_to_storage(
        bucket_id="documents",
        file_path=note_path,
        file_id=file_id,
        mcp_config_path=mcp_config_path,
        force=force
    )

    # Step 3: Prepare document data
    data = {
        "courseId": course_id,
        "noteType": note_type,
        "lessonOrder": lesson_order,
        "status": "published",  # Published by default
        "execution_id": execution_id,
        "markdown_file_id": uploaded_file_id,
        "version": version,
        "sow_version": sow_version,
        "token_usage": token_usage,
        "cost_usd": cost_usd,
        "workspace_path": workspace_path,
        "generation_timestamp": datetime.now().isoformat()
    }

    # Step 4: Create or update document
    database_id = "default"
    collection_id = "revision_notes"

    try:
        if force:
            # Force mode: Try update first, create if doesn't exist
            logger.info(f"Force mode: Attempting to update existing document {document_id}")
            try:
                updated_doc = await update_appwrite_document(
                    database_id=database_id,
                    collection_id=collection_id,
                    document_id=document_id,
                    data=data,
                    mcp_config_path=mcp_config_path
                )
                logger.info(f"✓ Updated existing revision note: {document_id}")
                return updated_doc
            except Exception as update_error:
                # Check if it's a 404 error (document doesn't exist)
                error_msg = str(update_error)
                error_type = type(update_error).__name__

                is_not_found = (
                    "404" in error_msg or
                    "not found" in error_msg.lower() or
                    error_type == "AppwriteException" and hasattr(update_error, 'code') and update_error.code == 404
                )

                if is_not_found:
                    logger.info(f"Document doesn't exist, creating new one: {document_id}")
                    created_doc = await create_revision_note_document(
                        database_id=database_id,
                        collection_id=collection_id,
                        document_id=document_id,
                        data=data,
                        mcp_config_path=mcp_config_path
                    )
                    logger.info(f"✓ Successfully created new document: {document_id}")
                    return created_doc
                else:
                    logger.error(f"Update failed with non-404 error: {error_type}: {error_msg}")
                    raise update_error
        else:
            # Normal mode: Create only (fail if exists)
            created_doc = await create_revision_note_document(
                database_id=database_id,
                collection_id=collection_id,
                document_id=document_id,
                data=data,
                mcp_config_path=mcp_config_path
            )
            return created_doc

    except Exception as e:
        raise Exception(
            f"Failed to upsert revision note: {e}. "
            f"Document: {document_id}, Force: {force}"
        )


async def upsert_course_cheat_sheet(
    cheat_sheet_path: Path,
    course_id: str,
    version: str,
    execution_id: str,
    mcp_config_path: str,
    force: bool = False,
    **metadata
) -> Dict[str, Any]:
    """Convenience function to upsert course cheat sheet.

    Args:
        cheat_sheet_path: Path to course_cheat_sheet.md file
        course_id: Course ID
        version: SOW version
        execution_id: Execution timestamp
        mcp_config_path: Path to .mcp.json
        force: Overwrite existing document
        **metadata: Optional metadata (sow_version, token_usage, cost_usd, workspace_path)

    Returns:
        Created/updated document
    """
    return await upsert_revision_note(
        note_path=cheat_sheet_path,
        course_id=course_id,
        note_type="cheat_sheet",
        lesson_order=None,
        version=version,
        execution_id=execution_id,
        mcp_config_path=mcp_config_path,
        force=force,
        **metadata
    )


async def upsert_lesson_note(
    lesson_note_path: Path,
    course_id: str,
    lesson_order: int,
    version: str,
    execution_id: str,
    mcp_config_path: str,
    force: bool = False,
    **metadata
) -> Dict[str, Any]:
    """Convenience function to upsert per-lesson note.

    Args:
        lesson_note_path: Path to lesson_notes_NN.md file
        course_id: Course ID
        lesson_order: Lesson order (1-based)
        version: SOW version
        execution_id: Execution timestamp
        mcp_config_path: Path to .mcp.json
        force: Overwrite existing document
        **metadata: Optional metadata (sow_version, token_usage, cost_usd, workspace_path)

    Returns:
        Created/updated document
    """
    return await upsert_revision_note(
        note_path=lesson_note_path,
        course_id=course_id,
        note_type="lesson_note",
        lesson_order=lesson_order,
        version=version,
        execution_id=execution_id,
        mcp_config_path=mcp_config_path,
        force=force,
        **metadata
    )


async def upsert_all_revision_notes(
    outputs_dir: Path,
    course_id: str,
    lesson_count: int,
    version: str,
    execution_id: str,
    mcp_config_path: str,
    force: bool = False,
    **metadata
) -> Dict[str, Any]:
    """Upload all revision notes from workspace outputs directory.

    Uploads course cheat sheet + all lesson notes to Storage and database.

    Args:
        outputs_dir: Path to workspace outputs/ directory
        course_id: Course ID
        lesson_count: Number of lessons (for validation)
        version: SOW version
        execution_id: Execution timestamp
        mcp_config_path: Path to .mcp.json
        force: Overwrite existing documents
        **metadata: Optional metadata for all documents

    Returns:
        Summary dictionary with upload results

    Raises:
        FileNotFoundError: If expected markdown files are missing
        Exception: If uploads fail
    """
    logger.info("=" * 60)
    logger.info(f"Uploading all revision notes for course {course_id}")
    logger.info("=" * 60)

    # Validate outputs directory exists
    if not outputs_dir.exists():
        raise FileNotFoundError(
            f"Outputs directory not found: {outputs_dir}. "
            f"Ensure the agent generated markdown files."
        )

    results = {
        "course_id": course_id,
        "execution_id": execution_id,
        "cheat_sheet": {},  # Will be populated with {document_id, file_id}
        "lesson_notes": [],  # Will be populated with [{lesson_order, document_id, file_id}, ...]
        "success": True,
        "errors": []
    }

    # 1. Upload course cheat sheet
    cheat_sheet_path = outputs_dir / "course_cheat_sheet.md"

    if not cheat_sheet_path.exists():
        error_msg = f"Course cheat sheet not found: {cheat_sheet_path}"
        logger.error(error_msg)
        results["errors"].append(error_msg)
        results["success"] = False
    else:
        try:
            cheat_sheet_doc = await upsert_course_cheat_sheet(
                cheat_sheet_path=cheat_sheet_path,
                course_id=course_id,
                version=version,
                execution_id=execution_id,
                mcp_config_path=mcp_config_path,
                force=force,
                **metadata
            )
            # Return structured data for print_results compatibility
            results["cheat_sheet"] = {
                "document_id": cheat_sheet_doc["$id"],
                "file_id": cheat_sheet_doc.get("markdownFileId", "N/A")
            }
            logger.info(f"✓ Uploaded course cheat sheet")
        except Exception as e:
            error_msg = f"Failed to upload cheat sheet: {e}"
            logger.error(error_msg)
            results["errors"].append(error_msg)
            results["success"] = False

    # 2. Upload all lesson notes
    logger.info(f"Uploading {lesson_count} lesson notes...")

    for lesson_num in range(1, lesson_count + 1):
        lesson_note_path = outputs_dir / f"lesson_notes_{lesson_num:02d}.md"

        if not lesson_note_path.exists():
            error_msg = f"Lesson note missing: {lesson_note_path}"
            logger.warning(error_msg)
            results["errors"].append(error_msg)
            # Don't fail entire operation, continue with other lessons
            continue

        try:
            lesson_doc = await upsert_lesson_note(
                lesson_note_path=lesson_note_path,
                course_id=course_id,
                lesson_order=lesson_num,
                version=version,
                execution_id=execution_id,
                mcp_config_path=mcp_config_path,
                force=force,
                **metadata
            )
            # Return structured data for print_results compatibility
            results["lesson_notes"].append({
                "lesson_order": lesson_num,
                "document_id": lesson_doc["$id"],
                "file_id": lesson_doc.get("markdownFileId", "N/A")
            })
            logger.info(f"  ✓ Uploaded lesson note {lesson_num}")
        except Exception as e:
            error_msg = f"Failed to upload lesson {lesson_num}: {e}"
            logger.error(error_msg)
            results["errors"].append(error_msg)
            results["success"] = False

    logger.info("=" * 60)
    logger.info(f"✅ Upload complete: {len(results['lesson_notes'])}/{lesson_count} lesson notes")
    if results["errors"]:
        logger.warning(f"⚠️  {len(results['errors'])} errors occurred during upload")
    logger.info("=" * 60)

    return results
