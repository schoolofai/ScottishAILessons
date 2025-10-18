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

    # Parse entries field (may be JSON string)
    entries = sow_doc.get('entries', [])
    if isinstance(entries, str):
        try:
            entries = json.loads(entries)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse SOW entries JSON: {e}")

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
