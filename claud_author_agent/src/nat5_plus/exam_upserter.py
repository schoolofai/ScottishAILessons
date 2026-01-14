"""
Exam Upserter

Handles upserting generated exams to Appwrite:
- nat5_plus_mock_exams: Main exam storage
- nat5_plus_exam_summaries: Uniqueness tracking
- exam_diagrams bucket: Diagram image storage

Uses gzip+base64 compression for large JSON fields.
"""

import json
import gzip
import base64
import logging
from datetime import datetime
from typing import Optional
from pathlib import Path

from ..models.nat5_plus_exam_models import Nat5PlusMockExam

logger = logging.getLogger(__name__)


def compress_json(data: dict) -> str:
    """Compress a dictionary to gzip+base64 string."""
    json_str = json.dumps(data)
    compressed = gzip.compress(json_str.encode('utf-8'))
    return base64.b64encode(compressed).decode('utf-8')


def decompress_json(compressed: str) -> dict:
    """Decompress a gzip+base64 string to dictionary."""
    try:
        decoded = base64.b64decode(compressed)
        decompressed = gzip.decompress(decoded)
        return json.loads(decompressed.decode('utf-8'))
    except Exception as e:
        logger.error(f"Decompression failed: {e}")
        return {}


def _upload_exam_diagrams(exam: Nat5PlusMockExam) -> int:
    """Upload all diagrams in the exam to Appwrite Storage.

    Modifies the exam in-place, replacing local file paths with Appwrite URLs.

    Args:
        exam: The exam with diagrams to upload

    Returns:
        Number of diagrams uploaded

    Raises:
        ValueError: If diagram upload fails (fail-fast, no silent failures)
    """
    from ..utils.appwrite_client import upload_diagram

    uploaded_count = 0

    for section in exam.sections:
        for question in section.questions:
            if not question.diagrams:
                continue

            for diagram in question.diagrams:
                # Check if it's a local path (not already an HTTP URL)
                diagram_url = diagram.diagram_url
                if not diagram_url or diagram_url.startswith("http"):
                    continue

                local_path = Path(diagram_url)
                if not local_path.exists():
                    raise ValueError(
                        f"Diagram file not found for {question.question_id}: {local_path}"
                    )

                # Upload to Appwrite Storage
                logger.info(f"Uploading diagram for {question.question_id}: {local_path.name}")
                appwrite_url = upload_diagram(
                    local_path=local_path,
                    exam_id=exam.exam_id,
                    question_id=question.question_id
                )

                # Update the diagram URL to point to Appwrite
                diagram.diagram_url = appwrite_url
                uploaded_count += 1
                logger.info(f"   Uploaded: {appwrite_url}")

    return uploaded_count


async def upsert_exam(exam: Nat5PlusMockExam, upload_diagrams: bool = True) -> str:
    """Upsert exam to Appwrite nat5_plus_mock_exams collection.

    Args:
        exam: The exam to upsert
        upload_diagrams: Whether to upload diagrams to Appwrite Storage (default True)

    Returns:
        Document ID of the created/updated exam

    Raises:
        ValueError: If upsert fails or diagram upload fails
    """
    logger.info(f"Upserting exam: {exam.exam_id}")

    try:
        from ..utils.appwrite_client import get_databases
        from appwrite.id import ID
    except ImportError:
        raise ValueError("Appwrite client not configured")

    databases = get_databases()

    # Upload diagrams to Appwrite Storage first (before compressing sections)
    if upload_diagrams:
        logger.info("Uploading diagrams to Appwrite Storage...")
        try:
            diagram_count = _upload_exam_diagrams(exam)
            logger.info(f"Uploaded {diagram_count} diagrams to Appwrite Storage")
        except Exception as e:
            logger.error(f"Diagram upload failed: {e}")
            raise ValueError(f"Diagram upload failed: {e}")

    # Prepare document data
    # Compress the sections (large JSON) - now with Appwrite URLs for diagrams
    sections_data = [s.model_dump() for s in exam.sections]
    compressed_sections = compress_json(sections_data)

    # Metadata as JSON string
    metadata_json = exam.metadata.model_dump_json()

    # Difficulty distribution as JSON string
    difficulty_json = json.dumps({
        "easy": exam.difficulty_distribution.easy,
        "medium": exam.difficulty_distribution.medium,
        "hard": exam.difficulty_distribution.hard
    })

    # Generation metadata as JSON string
    gen_metadata_json = ""
    if exam.generation_metadata:
        gen_metadata_json = exam.generation_metadata.model_dump_json()

    document_data = {
        "courseId": exam.course_id,
        "subject": exam.subject,
        "level": exam.level,
        "exam_version": exam.exam_version,
        "status": exam.status,
        "metadata": metadata_json,
        "sections": compressed_sections,
        "topic_coverage": exam.topic_coverage,
        "difficulty_distribution": difficulty_json,
        "template_sources": exam.template_sources,
        "generation_metadata": gen_metadata_json,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "last_modified": datetime.utcnow().isoformat() + "Z"
    }

    try:
        # Create new document
        result = databases.create_document(
            database_id="default",
            collection_id="nat5_plus_mock_exams",
            document_id=ID.unique(),
            data=document_data
        )

        doc_id = result["$id"]
        logger.info(f"Created exam document: {doc_id}")
        return doc_id

    except Exception as e:
        logger.error(f"Failed to upsert exam: {e}")
        raise ValueError(f"Exam upsert failed: {e}")


async def update_exam_summary(
    exam: Nat5PlusMockExam,
    doc_id: str,
    question_fingerprints: list[str]
) -> str:
    """Update exam summary for uniqueness tracking.

    Args:
        exam: The exam that was created
        doc_id: Document ID of the exam
        question_fingerprints: Content fingerprints of questions

    Returns:
        Summary document ID

    Raises:
        ValueError: If update fails
    """
    logger.info(f"Creating exam summary for: {doc_id}")

    try:
        from ..utils.appwrite_client import get_databases
        from appwrite.id import ID
    except ImportError:
        raise ValueError("Appwrite client not configured")

    databases = get_databases()

    # Collect question styles
    question_styles = []
    for section in exam.sections:
        for q in section.questions:
            question_styles.append(q.question_style)

    # Difficulty mix as JSON
    difficulty_mix = json.dumps({
        "easy": exam.difficulty_distribution.easy,
        "medium": exam.difficulty_distribution.medium,
        "hard": exam.difficulty_distribution.hard
    })

    # Fingerprints as JSON array
    fingerprints_json = json.dumps(question_fingerprints)

    document_data = {
        "courseId": exam.course_id,
        "exam_id": doc_id,
        "topic_ids": exam.topic_coverage,
        "question_styles": question_styles,
        "difficulty_mix": difficulty_mix,
        "question_fingerprints": fingerprints_json,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    try:
        result = databases.create_document(
            database_id="default",
            collection_id="nat5_plus_exam_summaries",
            document_id=ID.unique(),
            data=document_data
        )

        summary_id = result["$id"]
        logger.info(f"Created exam summary: {summary_id}")
        return summary_id

    except Exception as e:
        logger.error(f"Failed to create exam summary: {e}")
        raise ValueError(f"Summary creation failed: {e}")


async def publish_exam(exam_doc_id: str) -> bool:
    """Publish an exam (change status from draft to published).

    Args:
        exam_doc_id: Document ID of the exam

    Returns:
        True if successful

    Raises:
        ValueError: If publish fails
    """
    logger.info(f"Publishing exam: {exam_doc_id}")

    try:
        from ..utils.appwrite_client import get_databases
    except ImportError:
        raise ValueError("Appwrite client not configured")

    databases = get_databases()

    try:
        databases.update_document(
            database_id="default",
            collection_id="nat5_plus_mock_exams",
            document_id=exam_doc_id,
            data={
                "status": "published",
                "last_modified": datetime.utcnow().isoformat() + "Z"
            }
        )

        logger.info(f"Published exam: {exam_doc_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to publish exam: {e}")
        raise ValueError(f"Publish failed: {e}")


async def delete_exam(exam_doc_id: str) -> dict:
    """Delete an exam and its associated summary.

    IMPORTANT: Deletes both records to free up fingerprints for future exams.
    1. nat5_plus_mock_exams - The exam document
    2. nat5_plus_exam_summaries - The fingerprint summary (found via exam_id field)

    Args:
        exam_doc_id: Document ID of the exam to delete

    Returns:
        Dictionary with deletion results:
        {
            "exam_deleted": bool,
            "summary_deleted": bool,
            "summary_id": str or None
        }

    Raises:
        ValueError: If exam deletion fails (summary deletion is non-fatal)
    """
    logger.info(f"Deleting exam: {exam_doc_id}")

    try:
        from ..utils.appwrite_client import get_databases
        from appwrite.query import Query
    except ImportError:
        raise ValueError("Appwrite client not configured")

    databases = get_databases()
    result = {"exam_deleted": False, "summary_deleted": False, "summary_id": None}

    # Step 1: Delete the exam document
    try:
        databases.delete_document(
            database_id="default",
            collection_id="nat5_plus_mock_exams",
            document_id=exam_doc_id
        )
        result["exam_deleted"] = True
        logger.info(f"Deleted exam document: {exam_doc_id}")
    except Exception as e:
        logger.error(f"Failed to delete exam: {e}")
        raise ValueError(f"Exam deletion failed: {e}")

    # Step 2: Find and delete the associated summary
    try:
        summaries = databases.list_documents(
            database_id="default",
            collection_id="nat5_plus_exam_summaries",
            queries=[Query.equal("exam_id", exam_doc_id)]
        )

        if summaries["documents"]:
            summary_doc = summaries["documents"][0]
            summary_id = summary_doc["$id"]

            databases.delete_document(
                database_id="default",
                collection_id="nat5_plus_exam_summaries",
                document_id=summary_id
            )
            result["summary_deleted"] = True
            result["summary_id"] = summary_id
            logger.info(f"Deleted exam summary: {summary_id}")
        else:
            logger.warning(f"No summary found for exam: {exam_doc_id}")

    except Exception as e:
        # Summary deletion is non-fatal - exam is already deleted
        logger.warning(f"Failed to delete summary (non-fatal): {e}")

    return result


async def list_exams(course_id: Optional[str] = None) -> list[dict]:
    """List all exams, optionally filtered by course.

    Args:
        course_id: Optional course ID to filter by

    Returns:
        List of exam summaries with key fields:
        [
            {
                "exam_id": str,
                "course_id": str,
                "subject": str,
                "level": str,
                "status": str,
                "version": int,
                "created_at": str,
                "total_marks": int,
                "question_count": int
            }
        ]

    Raises:
        ValueError: If query fails
    """
    logger.info(f"Listing exams for course: {course_id or 'ALL'}")

    try:
        from ..utils.appwrite_client import get_databases
        from appwrite.query import Query
    except ImportError:
        raise ValueError("Appwrite client not configured")

    databases = get_databases()

    queries = [Query.order_desc("created_at"), Query.limit(100)]
    if course_id:
        queries.insert(0, Query.equal("courseId", course_id))

    try:
        result = databases.list_documents(
            database_id="default",
            collection_id="nat5_plus_mock_exams",
            queries=queries
        )

        exams = []
        for doc in result["documents"]:
            # Parse metadata for marks/questions
            metadata = {}
            if doc.get("metadata"):
                try:
                    metadata = json.loads(doc["metadata"])
                except json.JSONDecodeError:
                    pass

            exams.append({
                "exam_id": doc["$id"],
                "course_id": doc.get("courseId", ""),
                "subject": doc.get("subject", ""),
                "level": doc.get("level", ""),
                "status": doc.get("status", "draft"),
                "version": doc.get("exam_version", 1),
                "created_at": doc.get("created_at", ""),
                "total_marks": metadata.get("total_marks", 0),
                "question_count": metadata.get("total_questions", 0)
            })

        logger.info(f"Found {len(exams)} exams")
        return exams

    except Exception as e:
        logger.error(f"Failed to list exams: {e}")
        raise ValueError(f"List exams failed: {e}")
