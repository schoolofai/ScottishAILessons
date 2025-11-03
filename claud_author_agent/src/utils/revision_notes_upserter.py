"""Revision Notes Upserter - Post-processing utility.

Handles database persistence of generated revision notes to Appwrite.
Compresses JSON content and creates/updates revision_notes documents.
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from .appwrite_mcp import create_appwrite_document, update_appwrite_document, get_appwrite_document
    from .compression import compress_json_gzip_base64
except ImportError:
    from appwrite_mcp import create_appwrite_document, update_appwrite_document, get_appwrite_document
    from compression import compress_json_gzip_base64

logger = logging.getLogger(__name__)


async def upsert_revision_notes(
    revision_notes_path: str,
    lessonTemplateId: Optional[str] = None,
    sessionId: Optional[str] = None,
    execution_id: str = None,
    mcp_config_path: str = ".mcp.json"
) -> str:
    """Upsert revision notes to Appwrite database.

    Args:
        revision_notes_path: Path to revision_notes.json file
        lessonTemplateId: Lesson template ID (for template-based generation)
        sessionId: Session ID (for session-based generation)
        execution_id: Execution ID for tracing
        mcp_config_path: Path to MCP configuration

    Returns:
        Document ID of created/updated revision notes

    Raises:
        ValueError: If neither lessonTemplateId nor sessionId provided
        FileNotFoundError: If revision_notes.json not found
    """
    if not lessonTemplateId and not sessionId:
        raise ValueError("Must provide either lessonTemplateId or sessionId")

    logger.info(f"Starting revision notes upserting...")
    logger.info(f"  Mode: {'session' if sessionId else 'template'}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 1: Read and Validate Revision Notes JSON
    # ═══════════════════════════════════════════════════════════════

    revision_notes_file = Path(revision_notes_path)
    if not revision_notes_file.exists():
        raise FileNotFoundError(f"Revision notes file not found: {revision_notes_path}")

    with open(revision_notes_file, 'r', encoding='utf-8') as f:
        notes_content = json.load(f)

    logger.info(f"✓ Loaded revision notes JSON")
    logger.info(f"  Word count: {_calculate_word_count(notes_content)}")
    logger.info(f"  Key concepts: {len(notes_content.get('key_concepts', []))}")
    logger.info(f"  Worked examples: {len(notes_content.get('worked_examples', []))}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 2: Compress JSON Content
    # ═══════════════════════════════════════════════════════════════

    logger.info(f"Compressing revision notes content...")

    notes_content_compressed = compress_json_gzip_base64(notes_content)

    original_size = len(json.dumps(notes_content))
    compressed_size = len(notes_content_compressed)
    compression_ratio = (1 - compressed_size / original_size) * 100

    logger.info(f"✓ Compression complete")
    logger.info(f"  Original size: {original_size:,} bytes")
    logger.info(f"  Compressed size: {compressed_size:,} bytes")
    logger.info(f"  Compression ratio: {compression_ratio:.1f}%")

    # ═══════════════════════════════════════════════════════════════
    # STEP 3: Extract Metadata
    # ═══════════════════════════════════════════════════════════════

    metadata = notes_content.get("metadata", {})
    summary = notes_content.get("summary", "")

    generation_mode = "session" if sessionId else "template"
    word_count = _calculate_word_count(notes_content)

    # Extract student ID if session-based
    studentId = None
    courseId = None

    if sessionId:
        # Fetch session to get student ID and course ID
        try:
            from .appwrite_mcp import get_appwrite_document

            session_doc = await get_appwrite_document(
                database_id="default",
                collection_id="sessions",
                document_id=sessionId,
                mcp_config_path=mcp_config_path
            )

            if session_doc:
                studentId = session_doc.get("studentId")

                # Extract courseId from lessonSnapshot
                lesson_snapshot_raw = session_doc.get("lessonSnapshot")
                if lesson_snapshot_raw:
                    if isinstance(lesson_snapshot_raw, str):
                        try:
                            from .compression import decompress_json_gzip_base64
                            lesson_snapshot = decompress_json_gzip_base64(lesson_snapshot_raw)
                        except ValueError:
                            lesson_snapshot = json.loads(lesson_snapshot_raw)
                    else:
                        lesson_snapshot = lesson_snapshot_raw

                    courseId = lesson_snapshot.get("courseId")

                logger.info(f"✓ Extracted session metadata: studentId={studentId}, courseId={courseId}")

        except Exception as e:
            logger.warning(f"Failed to extract session metadata: {e}")

    # If template-based, fetch course ID from lesson template
    if not courseId and lessonTemplateId:
        try:
            template_doc = await get_appwrite_document(
                database_id="default",
                collection_id="lesson_templates",
                document_id=lessonTemplateId,
                mcp_config_path=mcp_config_path
            )

            if template_doc:
                courseId = template_doc.get("courseId")
                logger.info(f"✓ Extracted course ID from template: {courseId}")

        except Exception as e:
            logger.warning(f"Failed to extract course ID from template: {e}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 4: Check for Existing Document
    # ═══════════════════════════════════════════════════════════════

    existing_doc_id = None

    try:
        # Check if revision notes already exist for this lesson/session
        from .appwrite_mcp import list_appwrite_documents

        if sessionId:
            # Session-based: unique by sessionId
            query = [f'equal("sessionId", "{sessionId}")']
        else:
            # Template-based: unique by lessonTemplateId
            query = [f'equal("lessonTemplateId", "{lessonTemplateId}")']

        existing_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="revision_notes",
            queries=query,
            mcp_config_path=mcp_config_path
        )

        if existing_docs and len(existing_docs) > 0:
            existing_doc_id = existing_docs[0].get("$id")
            logger.info(f"✓ Found existing revision notes document: {existing_doc_id}")
        else:
            logger.info(f"No existing revision notes found - will create new document")

    except Exception as e:
        logger.warning(f"Failed to check for existing document: {e}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 5: Prepare Document Data
    # ═══════════════════════════════════════════════════════════════

    document_data = {
        "contentVersion": "1.0",
        "notesContent": notes_content_compressed,
        "generatedAt": datetime.now().isoformat(),
        "generatedBy": "revision_notes_author_agent",
        "generationMode": generation_mode,
        "executionId": execution_id or "",
        "wordCount": word_count,
        "estimatedStudyMinutes": metadata.get("estimated_study_time", 20),
        "sqaOutcomeRefs": json.dumps(metadata.get("sqa_outcome_refs", [])),
        "keyConceptsCount": len(notes_content.get("key_concepts", [])),
        "workedExamplesCount": len(notes_content.get("worked_examples", [])),
        "basedOnEvidence": generation_mode == "session",
        "downloadCount": 0,
        "markdownExported": False,
        "pdfExported": False
    }

    # Add IDs based on mode
    if sessionId:
        document_data["sessionId"] = sessionId
        if studentId:
            document_data["studentId"] = studentId

    if lessonTemplateId:
        document_data["lessonTemplateId"] = lessonTemplateId

    if courseId:
        document_data["courseId"] = courseId

    # ═══════════════════════════════════════════════════════════════
    # STEP 6: Create or Update Document
    # ═══════════════════════════════════════════════════════════════

    if existing_doc_id:
        # Update existing document
        logger.info(f"Updating existing revision notes document...")

        document_id = await update_appwrite_document(
            database_id="default",
            collection_id="revision_notes",
            document_id=existing_doc_id,
            data=document_data,
            mcp_config_path=mcp_config_path
        )

        logger.info(f"✅ Updated revision notes document: {document_id}")

    else:
        # Create new document
        logger.info(f"Creating new revision notes document...")

        document_id = await create_appwrite_document(
            database_id="default",
            collection_id="revision_notes",
            data=document_data,
            mcp_config_path=mcp_config_path
        )

        logger.info(f"✅ Created revision notes document: {document_id}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 7: Return Document ID
    # ═══════════════════════════════════════════════════════════════

    logger.info(f"✅ Revision notes upserting complete")
    logger.info(f"  Document ID: {document_id}")
    logger.info(f"  Mode: {generation_mode}")
    logger.info(f"  Word count: {word_count}")

    return document_id


def _calculate_word_count(notes_content: Dict[str, Any]) -> int:
    """Calculate total word count across all text fields.

    Args:
        notes_content: Revision notes JSON object

    Returns:
        Total word count
    """
    total_words = 0

    # Summary
    summary = notes_content.get("summary", "")
    total_words += len(summary.split())

    # Key concepts
    for kc in notes_content.get("key_concepts", []):
        total_words += len(kc.get("title", "").split())
        total_words += len(kc.get("explanation", "").split())
        if kc.get("real_world_connection"):
            total_words += len(kc["real_world_connection"].split())

    # Worked examples
    for we in notes_content.get("worked_examples", []):
        total_words += len(we.get("problem", "").split())
        for step in we.get("solution_steps", []):
            total_words += len(step.split())
        total_words += len(we.get("answer", "").split())
        total_words += len(we.get("key_insight", "").split())

    # Common mistakes
    for cm in notes_content.get("common_mistakes", []):
        total_words += len(cm.get("mistake", "").split())
        total_words += len(cm.get("why_wrong", "").split())
        total_words += len(cm.get("correction", "").split())
        total_words += len(cm.get("tip", "").split())

    # Quick quiz
    for qq in notes_content.get("quick_quiz", []):
        total_words += len(qq.get("question", "").split())
        total_words += len(qq.get("answer", "").split())
        total_words += len(qq.get("explanation", "").split())

    # Memory aids
    for ma in notes_content.get("memory_aids", []):
        total_words += len(ma.get("content", "").split())
        total_words += len(ma.get("application", "").split())

    # Exam tips
    for tip in notes_content.get("exam_tips", []):
        total_words += len(tip.split())

    return total_words
