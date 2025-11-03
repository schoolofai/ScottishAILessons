"""Revision Notes Data Extractor - Pre-processing utility.

Extracts lesson data and context from Appwrite for revision notes generation.
Supports both session-based (with evidence) and template-based generation.

This module handles:
- Lesson snapshot extraction from sessions or lesson_templates
- SOW context extraction for curriculum positioning
- Evidence summary generation from session performance data
- Course data preparation
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

try:
    from .appwrite_mcp import get_appwrite_document, list_appwrite_documents
    from .compression import decompress_json_gzip_base64
except ImportError:
    from appwrite_mcp import get_appwrite_document, list_appwrite_documents
    from compression import decompress_json_gzip_base64

logger = logging.getLogger(__name__)


async def extract_lesson_data_to_workspace(
    lessonTemplateId: Optional[str] = None,
    sessionId: Optional[str] = None,
    mcp_config_path: str = ".mcp.json",
    workspace_path: Path = None
) -> Dict[str, Any]:
    """Extract lesson data and write to workspace files.

    Args:
        lessonTemplateId: Lesson template ID (for template-based generation)
        sessionId: Session ID (for session-based generation with evidence)
        mcp_config_path: Path to MCP configuration
        workspace_path: Path to isolated workspace

    Returns:
        Dictionary with extracted metadata:
            - subject: Course subject
            - level: Course level
            - title: Lesson title
            - lesson_type: Lesson type
            - courseId: Course ID

    Raises:
        ValueError: If neither lessonTemplateId nor sessionId provided
        ValueError: If session or template not found

    Files Created:
        - lesson_snapshot.json: Full lesson content
        - sow_context.json: SOW curriculum context (optional)
        - evidence_summary.json: Performance metrics (session mode only)
    """
    if not lessonTemplateId and not sessionId:
        raise ValueError("Must provide either lessonTemplateId or sessionId")

    logger.info(f"Starting lesson data extraction...")
    logger.info(f"  Mode: {'session' if sessionId else 'template'}")
    logger.info(f"  ID: {sessionId or lessonTemplateId}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 1: Extract Lesson Snapshot
    # ═══════════════════════════════════════════════════════════════

    lesson_snapshot = None
    courseId = None
    metadata = {}

    if sessionId:
        # Session-based: Extract from sessions collection
        logger.info(f"Fetching session document: {sessionId}")

        session_doc = await get_appwrite_document(
            database_id="default",
            collection_id="sessions",
            document_id=sessionId,
            mcp_config_path=mcp_config_path
        )

        if not session_doc:
            raise ValueError(f"Session not found: {sessionId}")

        # Extract lessonSnapshot (may be compressed)
        lesson_snapshot_raw = session_doc.get("lessonSnapshot")
        if not lesson_snapshot_raw:
            raise ValueError(f"Session {sessionId} has no lessonSnapshot")

        # Decompress if needed
        if isinstance(lesson_snapshot_raw, str):
            try:
                lesson_snapshot = decompress_json_gzip_base64(lesson_snapshot_raw)
            except ValueError:
                # Not compressed, parse as JSON
                lesson_snapshot = json.loads(lesson_snapshot_raw)
        else:
            lesson_snapshot = lesson_snapshot_raw

        courseId = lesson_snapshot.get("courseId")
        lessonTemplateId = lesson_snapshot.get("lessonTemplateId")

        logger.info(f"✓ Extracted lesson snapshot from session")
        logger.info(f"  Lesson: {lesson_snapshot.get('title', 'N/A')}")
        logger.info(f"  Course ID: {courseId}")

    else:
        # Template-based: Extract from lesson_templates collection
        logger.info(f"Fetching lesson template document: {lessonTemplateId}")

        template_doc = await get_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            document_id=lessonTemplateId,
            mcp_config_path=mcp_config_path
        )

        if not template_doc:
            raise ValueError(f"Lesson template not found: {lessonTemplateId}")

        # Decompress cards if needed
        cards_raw = template_doc.get("cards")
        if isinstance(cards_raw, str):
            try:
                cards = decompress_json_gzip_base64(cards_raw)
            except ValueError:
                cards = json.loads(cards_raw)
        else:
            cards = cards_raw

        # Build lesson snapshot from template
        lesson_snapshot = {
            "lessonTemplateId": lessonTemplateId,
            "courseId": template_doc.get("courseId"),
            "title": template_doc.get("title") or template_doc.get("label"),
            "lesson_type": template_doc.get("lesson_type"),
            "estMinutes": template_doc.get("estMinutes"),
            "outcomeRefs": template_doc.get("outcomeRefs", []),
            "engagement_tags": template_doc.get("engagement_tags", []),
            "policy": template_doc.get("policy", {}),
            "cards": cards
        }

        courseId = template_doc.get("courseId")

        logger.info(f"✓ Extracted lesson snapshot from template")
        logger.info(f"  Lesson: {lesson_snapshot.get('title', 'N/A')}")
        logger.info(f"  Course ID: {courseId}")

    # Write lesson_snapshot.json to workspace
    lesson_snapshot_path = workspace_path / "lesson_snapshot.json"
    with open(lesson_snapshot_path, 'w', encoding='utf-8') as f:
        json.dump(lesson_snapshot, f, indent=2, ensure_ascii=False)

    logger.info(f"✅ Wrote lesson_snapshot.json to workspace")

    # ═══════════════════════════════════════════════════════════════
    # STEP 2: Extract Course Metadata (for subject/level)
    # ═══════════════════════════════════════════════════════════════

    logger.info(f"Fetching course metadata: {courseId}")

    course_doc = await get_appwrite_document(
        database_id="default",
        collection_id="courses",
        document_id=courseId,
        mcp_config_path=mcp_config_path
    )

    if not course_doc:
        raise ValueError(f"Course not found: {courseId}")

    subject = course_doc.get("subject", "").lower()
    level = course_doc.get("level", "").lower()

    logger.info(f"✓ Course: {subject} ({level})")

    metadata.update({
        "subject": subject,
        "level": level,
        "title": lesson_snapshot.get("title"),
        "lesson_type": lesson_snapshot.get("lesson_type"),
        "courseId": courseId
    })

    # ═══════════════════════════════════════════════════════════════
    # STEP 3: Extract SOW Context (Optional)
    # ═══════════════════════════════════════════════════════════════

    try:
        logger.info(f"Fetching SOW context for courseId: {courseId}")

        sow_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[
                f'equal("courseId", "{courseId}")',
                'equal("status", "published")'
            ],
            mcp_config_path=mcp_config_path
        )

        if sow_docs and len(sow_docs) > 0:
            sow_doc = sow_docs[0]

            sow_context = {
                "sow_id": sow_doc.get("$id"),
                "version": sow_doc.get("version", "v1.0"),
                "coherence": sow_doc.get("coherence", ""),
                "accessibility_notes": sow_doc.get("accessibility_notes", ""),
                "engagement_strategies": sow_doc.get("engagement_strategies", [])
            }

            # Write sow_context.json to workspace
            sow_context_path = workspace_path / "sow_context.json"
            with open(sow_context_path, 'w', encoding='utf-8') as f:
                json.dump(sow_context, f, indent=2, ensure_ascii=False)

            logger.info(f"✅ Wrote sow_context.json to workspace")
        else:
            logger.warning(f"No published SOW found for courseId: {courseId}")

    except Exception as e:
        logger.warning(f"Failed to extract SOW context: {e}")

    # ═══════════════════════════════════════════════════════════════
    # STEP 4: Extract Evidence Summary (Session Mode Only)
    # ═══════════════════════════════════════════════════════════════

    if sessionId:
        try:
            logger.info(f"Extracting evidence for session: {sessionId}")

            evidence_docs = await list_appwrite_documents(
                database_id="default",
                collection_id="evidence",
                queries=[
                    f'equal("sessionId", "{sessionId}")'
                ],
                mcp_config_path=mcp_config_path
            )

            if evidence_docs and len(evidence_docs) > 0:
                # Analyze evidence to create summary
                evidence_summary = _analyze_evidence(evidence_docs)

                # Write evidence_summary.json to workspace
                evidence_summary_path = workspace_path / "evidence_summary.json"
                with open(evidence_summary_path, 'w', encoding='utf-8') as f:
                    json.dump(evidence_summary, f, indent=2, ensure_ascii=False)

                logger.info(f"✅ Wrote evidence_summary.json to workspace")
                logger.info(f"  Evidence records: {len(evidence_docs)}")
                logger.info(f"  Overall accuracy: {evidence_summary['overall_accuracy']:.1%}")
            else:
                logger.warning(f"No evidence found for session: {sessionId}")

        except Exception as e:
            logger.warning(f"Failed to extract evidence: {e}")

    logger.info(f"✅ Lesson data extraction complete")

    return metadata


def _analyze_evidence(evidence_docs: list) -> Dict[str, Any]:
    """Analyze evidence records to generate performance summary.

    Args:
        evidence_docs: List of evidence documents from Appwrite

    Returns:
        Dictionary with performance metrics:
            - overall_accuracy: Overall correct percentage
            - first_attempt_success: First-try correct percentage
            - average_attempts: Average attempts per question
            - strong_areas: List of card IDs with high performance
            - challenge_areas: List of card IDs with low performance
            - common_errors: List of frequently wrong items
    """
    if not evidence_docs:
        return {
            "overall_accuracy": 0.0,
            "first_attempt_success": 0.0,
            "average_attempts": 0.0,
            "strong_areas": [],
            "challenge_areas": [],
            "common_errors": []
        }

    total_items = len(evidence_docs)
    correct_count = 0
    first_attempt_correct = 0
    total_attempts = 0

    # Track performance by card/item
    item_performance = {}

    for evidence in evidence_docs:
        item_id = evidence.get("itemId", "unknown")
        is_correct = evidence.get("correct", False)
        attempts = evidence.get("attempts", 1)

        if is_correct:
            correct_count += 1

        if attempts == 1 and is_correct:
            first_attempt_correct += 1

        total_attempts += attempts

        # Track by item
        if item_id not in item_performance:
            item_performance[item_id] = {
                "correct_count": 0,
                "total_count": 0,
                "total_attempts": 0
            }

        item_performance[item_id]["total_count"] += 1
        if is_correct:
            item_performance[item_id]["correct_count"] += 1
        item_performance[item_id]["total_attempts"] += attempts

    # Calculate metrics
    overall_accuracy = correct_count / total_items if total_items > 0 else 0.0
    first_attempt_success = first_attempt_correct / total_items if total_items > 0 else 0.0
    average_attempts = total_attempts / total_items if total_items > 0 else 0.0

    # Identify strong and challenge areas
    strong_areas = []
    challenge_areas = []

    for item_id, perf in item_performance.items():
        accuracy = perf["correct_count"] / perf["total_count"] if perf["total_count"] > 0 else 0.0

        if accuracy >= 0.8:
            strong_areas.append(item_id)
        elif accuracy < 0.5:
            challenge_areas.append(item_id)

    # Identify common errors (items with low accuracy and high attempts)
    common_errors = []
    for item_id, perf in item_performance.items():
        accuracy = perf["correct_count"] / perf["total_count"] if perf["total_count"] > 0 else 0.0
        avg_attempts = perf["total_attempts"] / perf["total_count"] if perf["total_count"] > 0 else 0.0

        if accuracy < 0.5 and avg_attempts > 1.5:
            common_errors.append({
                "item_id": item_id,
                "accuracy": accuracy,
                "average_attempts": avg_attempts
            })

    # Sort common errors by severity (low accuracy + high attempts)
    common_errors.sort(key=lambda x: (x["accuracy"], -x["average_attempts"]))

    return {
        "overall_accuracy": overall_accuracy,
        "first_attempt_success": first_attempt_success,
        "average_attempts": average_attempts,
        "strong_areas": strong_areas,
        "challenge_areas": challenge_areas,
        "common_errors": common_errors[:5]  # Top 5 problematic items
    }
