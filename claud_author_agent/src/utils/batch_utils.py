"""Utility functions for batch lesson generation.

Provides helper functions for:
- Fetching SOW entries from Appwrite
- Checking existing lessons
- Formatting dry-run tables
- Calculating estimates
- Duration formatting
"""

import json
import logging
from typing import Dict, Any, List, Optional

from .appwrite_mcp import list_appwrite_documents
from .compression import parse_sow_entries

logger = logging.getLogger(__name__)


async def fetch_sow_entries(
    courseId: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Fetch all SOW entries for courseId from Authored_SOW collection.

    Args:
        courseId: Course identifier (e.g., 'course_c84874')
        mcp_config_path: Path to MCP configuration file

    Returns:
        List of SOW entry dictionaries sorted by order

    Raises:
        ValueError: If no published SOW found or entries invalid
    """
    logger.info(f"Fetching SOW entries for courseId '{courseId}'...")

    # Query Authored_SOW for published SOW
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
            f"Published SOW not found: No published SOW with courseId='{courseId}' in default.Authored_SOW collection. "
            f"Please ensure the SOW is authored and published (status='published') before generating lessons."
        )

    sow_doc = sow_docs[0]

    # Parse entries field (handles all formats: storage bucket, compressed, uncompressed)
    # Uses unified parse_sow_entries() helper that supports:
    # - Storage bucket: "storage:<file_id>" - fetch from bucket, decompress
    # - TypeScript "gzip:" prefix: inline compressed
    # - Python legacy raw base64: inline compressed
    # - Uncompressed JSON: legacy format
    entries_raw = sow_doc.get('entries', [])
    entries = await parse_sow_entries(
        entries_raw=entries_raw,
        mcp_config_path=mcp_config_path,
        courseId=courseId
    )

    if not entries:
        raise ValueError(f"SOW document has no entries for courseId '{courseId}'")

    # Sort by order
    entries_sorted = sorted(entries, key=lambda e: e.get('order', 0))

    logger.info(f"Found {len(entries_sorted)} SOW entries for course '{courseId}'")

    return entries_sorted


async def check_existing_lessons(
    courseId: str,
    mcp_config_path: str
) -> Dict[int, Dict[str, Any]]:
    """Check which lessons already exist for this course with model_version claud_Agent_sdk.

    IMPORTANT: This function ONLY queries for lessons with model_version == "claud_Agent_sdk".
    All other lessons (different model_version or empty) are ignored and treated as "not found".
    This ensures the batch generator only manages lessons it created.

    Args:
        courseId: Course identifier
        mcp_config_path: Path to MCP configuration file

    Returns:
        Dictionary mapping order → lesson info dict or None
        Example:
            {
                1: {"doc_id": "lesson_xyz", "model_version": "claud_Agent_sdk", "created_at": "..."},
                2: None,  # Not found (or has different model_version)
                ...
            }
    """
    logger.info(f"Checking existing lessons for courseId '{courseId}' with model_version='claud_Agent_sdk'...")

    # Query lesson_templates for this course AND model_version == "claud_Agent_sdk"
    # This filters out all lessons created by other systems
    lessons = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=[
            f'equal("courseId", "{courseId}")',
            'equal("model_version", "claud_Agent_sdk")'
        ],
        mcp_config_path=mcp_config_path
    )

    logger.info(f"Database returned {len(lessons)} lessons")

    # DEBUG: Log all returned lessons
    for lesson in lessons:
        logger.info(f"  Doc: {lesson.get('$id')} | sow_order: {lesson.get('sow_order')} | model_version: {lesson.get('model_version', 'N/A')}")

    # Build map: sow_order → lesson info
    lesson_map: Dict[int, Dict[str, Any]] = {}

    for lesson in lessons:
        sow_order = lesson.get('sow_order')
        if sow_order is not None:
            lesson_map[sow_order] = {
                "doc_id": lesson.get('$id'),
                "model_version": lesson.get('model_version', ''),
                "created_at": lesson.get('$createdAt', '')
            }
        else:
            logger.warning(f"  Lesson {lesson.get('$id')} has no sow_order field!")

    logger.info(f"Built lesson_map with {len(lesson_map)} entries: orders {list(lesson_map.keys())}")

    return lesson_map


def format_dry_run_table(
    sow_entries: List[Dict[str, Any]],
    existing_lessons: Dict[int, Dict[str, Any]],
    force_mode: bool
) -> str:
    """Format dry-run plan as ASCII table.

    Args:
        sow_entries: List of SOW entry dictionaries
        existing_lessons: Map of order → lesson info
        force_mode: Whether force mode is enabled

    Returns:
        Formatted ASCII table string
    """
    # Header
    lines = []
    lines.append("╔════════════════════════════════════════════════════════════════╗")
    lines.append("║         Batch Generation Plan - DRY RUN                        ║")
    lines.append("╚════════════════════════════════════════════════════════════════╝")
    lines.append("")

    # Table header (wider to show doc_id)
    lines.append("┌───────┬─────────────────────────────────┬──────────────┬──────────────────────┬─────────────────────────┐")
    lines.append("│ Order │ Label                           │ Status       │ Doc ID               │ Model Version           │")
    lines.append("├───────┼─────────────────────────────────┼──────────────┼──────────────────────┼─────────────────────────┤")

    # Table rows
    skip_count = 0
    generate_count = 0
    overwrite_count = 0

    for entry in sow_entries:
        order = entry.get('order', 0)
        label = entry.get('label', 'Untitled')[:31]  # Truncate to fit column

        # existing_lessons only contains claud_Agent_sdk lessons (filtered at query level)
        existing = existing_lessons.get(order)

        # Extract doc_id and model_version for display
        doc_id = existing.get('doc_id', '')[:20] if existing else '-'
        model_version = existing.get('model_version', '')[:23] if existing else '-'

        if force_mode:
            if existing:
                status = "OVERWRITE"
                overwrite_count += 1
            else:
                status = "GENERATE"
                generate_count += 1
        else:
            if existing:
                # Exists with model_version == "claud_Agent_sdk" → SKIP
                status = "SKIP"
                skip_count += 1
            else:
                # Not found (or has different model_version) → GENERATE
                status = "GENERATE"
                generate_count += 1

        # Format row with doc_id and model_version columns
        lines.append(f"│ {order:5d} │ {label:31s} │ {status:12s} │ {doc_id:20s} │ {model_version:23s} │")

    # Table footer
    lines.append("└───────┴─────────────────────────────────┴──────────────┴──────────────────────┴─────────────────────────┘")

    return "\n".join(lines), skip_count, generate_count, overwrite_count


def calculate_estimates(num_lessons: int) -> Dict[str, Any]:
    """Calculate duration and cost estimates.

    Args:
        num_lessons: Number of lessons to generate

    Returns:
        Dictionary with duration and cost estimates

    Assumptions:
        - 7 minutes per lesson (average)
        - $0.17 per lesson (average)
    """
    AVG_DURATION_MINUTES = 7
    AVG_COST_USD = 0.17

    duration_minutes = num_lessons * AVG_DURATION_MINUTES
    cost_usd = num_lessons * AVG_COST_USD

    return {
        "duration_minutes": duration_minutes,
        "duration_human": format_duration(duration_minutes * 60),
        "cost_usd": round(cost_usd, 2),
        "avg_duration_per_lesson_minutes": AVG_DURATION_MINUTES,
        "avg_cost_per_lesson_usd": AVG_COST_USD
    }


def format_duration(seconds: int) -> str:
    """Format duration as human-readable string.

    Args:
        seconds: Duration in seconds

    Returns:
        Human-readable string (e.g., '2h 14m 26s', '11m 22s', '45s')

    Examples:
        >>> format_duration(8066)
        '2h 14m 26s'
        >>> format_duration(682)
        '11m 22s'
        >>> format_duration(45)
        '45s'
    """
    if seconds < 60:
        return f"{seconds}s"

    minutes = seconds // 60
    remaining_seconds = seconds % 60

    if minutes < 60:
        if remaining_seconds > 0:
            return f"{minutes}m {remaining_seconds}s"
        return f"{minutes}m"

    hours = minutes // 60
    remaining_minutes = minutes % 60

    parts = [f"{hours}h"]
    if remaining_minutes > 0:
        parts.append(f"{remaining_minutes}m")
    if remaining_seconds > 0:
        parts.append(f"{remaining_seconds}s")

    return " ".join(parts)


def format_batch_summary_console(summary: Dict[str, Any]) -> str:
    """Format batch summary for console output.

    Args:
        summary: Summary dictionary

    Returns:
        Multi-line formatted string
    """
    lines = []
    lines.append("=" * 70)
    lines.append("Batch Generation Complete")
    lines.append("=" * 70)
    lines.append("")
    lines.append("Summary:")
    lines.append(f"  Total SOW entries:    {summary.get('total_sow_entries', 0)}")
    lines.append(f"  Skipped:              {summary.get('skipped', 0)}")
    lines.append(f"  Generated (success):  {summary.get('generated', 0)}")
    lines.append(f"  Failed:               {summary.get('failed', 0)}")
    lines.append(f"  Total Duration:       {summary.get('duration_human', 'N/A')}")
    lines.append(f"  Total Cost:           ${summary.get('total_cost_usd', 0.0):.4f} USD")
    lines.append(f"  Total Tokens:         {summary.get('total_tokens', 0)}")

    if summary.get('generated', 0) > 0:
        lines.append(f"  Average per lesson:   {format_duration(summary.get('avg_duration_per_lesson_seconds', 0))}, "
                    f"${summary.get('avg_cost_per_lesson_usd', 0.0):.4f} USD")

    lines.append("")
    lines.append(f"Log directory: {summary.get('log_directory', 'N/A')}")
    lines.append("=" * 70)

    return "\n".join(lines)


# =============================================================================
# DELETE MODE UTILITIES
# =============================================================================

async def fetch_lessons_for_deletion(
    courseId: str,
    mcp_config_path: str,
    all_versions: bool = False
) -> List[Dict[str, Any]]:
    """Fetch lessons to delete for a course.

    Args:
        courseId: Course identifier
        mcp_config_path: Path to MCP configuration file
        all_versions: If False, only fetch lessons with model_version='claud_Agent_sdk'.
                     If True, fetch ALL lessons regardless of model_version.

    Returns:
        List of lesson template documents sorted by sow_order

    Raises:
        ValueError: If no lessons found for the course
    """
    logger.info(f"Fetching lessons for deletion: courseId={courseId}, all_versions={all_versions}")

    queries = [f'equal("courseId", "{courseId}")']
    if not all_versions:
        queries.append('equal("model_version", "claud_Agent_sdk")')

    lessons = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=queries,
        mcp_config_path=mcp_config_path
    )

    logger.info(f"Found {len(lessons)} lessons for deletion")

    # Sort by sow_order for consistent display
    lessons_sorted = sorted(lessons, key=lambda l: l.get('sow_order', 0))

    return lessons_sorted


async def fetch_diagrams_for_lesson_ids(
    lesson_template_ids: List[str],
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Fetch all diagrams for given lesson template IDs.

    Args:
        lesson_template_ids: List of lesson template document IDs
        mcp_config_path: Path to MCP configuration file

    Returns:
        List of diagram documents
    """
    logger.info(f"Fetching diagrams for {len(lesson_template_ids)} lesson templates...")

    all_diagrams = []

    for lesson_id in lesson_template_ids:
        diagrams = await list_appwrite_documents(
            database_id="default",
            collection_id="lesson_diagrams",
            queries=[f'equal("lessonTemplateId", "{lesson_id}")'],
            mcp_config_path=mcp_config_path
        )
        all_diagrams.extend(diagrams)
        logger.debug(f"  Lesson {lesson_id}: {len(diagrams)} diagrams")

    logger.info(f"Found {len(all_diagrams)} total diagrams to delete")

    return all_diagrams


def format_delete_dry_run_table(
    lessons: List[Dict[str, Any]],
    diagrams: List[Dict[str, Any]],
    all_versions: bool
) -> str:
    """Format delete dry-run plan as ASCII table.

    Args:
        lessons: List of lesson template documents
        diagrams: List of diagram documents
        all_versions: Whether --all-versions flag is set

    Returns:
        Formatted ASCII table string
    """
    # Build diagram count map: lessonTemplateId → count
    diagram_counts: Dict[str, int] = {}
    for diagram in diagrams:
        lesson_id = diagram.get('lessonTemplateId', '')
        diagram_counts[lesson_id] = diagram_counts.get(lesson_id, 0) + 1

    # Header
    lines = []
    lines.append("╔════════════════════════════════════════════════════════════════════════════════╗")
    lines.append("║               Batch Deletion Plan - DRY RUN (DESTRUCTIVE)                      ║")
    lines.append("╚════════════════════════════════════════════════════════════════════════════════╝")
    lines.append("")

    # Table header
    lines.append("┌───────┬─────────────────────────────────┬──────────────────────────┬──────────┐")
    lines.append("│ Order │ Title                           │ Lesson Doc ID            │ Diagrams │")
    lines.append("├───────┼─────────────────────────────────┼──────────────────────────┼──────────┤")

    # Table rows
    total_diagrams = 0
    for lesson in lessons:
        order = lesson.get('sow_order', 0)
        title = lesson.get('title', 'Untitled')[:31]
        doc_id = lesson.get('$id', '')[:24]
        diagram_count = diagram_counts.get(lesson.get('$id', ''), 0)
        total_diagrams += diagram_count

        lines.append(f"│ {order:5d} │ {title:31s} │ {doc_id:24s} │ {diagram_count:8d} │")

    # Table footer
    lines.append("└───────┴─────────────────────────────────┴──────────────────────────┴──────────┘")

    # Summary
    lines.append("")
    lines.append(f"Filter: {'All versions' if all_versions else 'model_version = claud_Agent_sdk only'}")
    lines.append("")
    lines.append("Summary of items to be PERMANENTLY DELETED:")
    lines.append(f"  📚 Lessons:        {len(lessons)}")
    lines.append(f"  🖼️  Diagrams:       {total_diagrams}")
    lines.append(f"  📁 Storage files:  {sum(1 for d in diagrams if d.get('image_file_id'))}")

    return "\n".join(lines)


def format_delete_summary_console(summary: Dict[str, Any]) -> str:
    """Format delete summary for console output.

    Args:
        summary: Summary dictionary from execute_batch_deletion

    Returns:
        Multi-line formatted string
    """
    lines = []
    lines.append("=" * 70)
    lines.append("🗑️  Batch Deletion Complete")
    lines.append("=" * 70)
    lines.append("")
    lines.append("Summary:")
    lines.append(f"  Lessons deleted:      {summary.get('deleted_lessons', 0)}")
    lines.append(f"  Diagrams deleted:     {summary.get('deleted_diagrams', 0)}")
    lines.append(f"  Storage files:        {summary.get('deleted_storage', 0)}")
    lines.append(f"  Storage warnings:     {len(summary.get('storage_errors', []))}")
    lines.append(f"  Total Duration:       {summary.get('duration_human', 'N/A')}")
    lines.append("")

    if summary.get('storage_errors'):
        lines.append("Storage warnings (non-fatal):")
        for err in summary['storage_errors'][:5]:  # Show first 5
            lines.append(f"  ⚠️  {err}")
        if len(summary['storage_errors']) > 5:
            lines.append(f"  ... and {len(summary['storage_errors']) - 5} more")
        lines.append("")

    lines.append(f"Log directory: {summary.get('log_directory', 'N/A')}")
    lines.append("=" * 70)

    return "\n".join(lines)
