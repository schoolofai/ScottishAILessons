"""SOW Entry Extractor for Lesson Author Agent.

Extracts a specific lesson entry from Authored_SOW collection by courseId and order.
Writes two files to workspace:
1. sow_entry_input.json: The specific lesson entry
2. sow_context.json: Course-level SOW metadata

Note: Order values are 1-indexed (order 1, 2, 3...), not 0-indexed.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple

from .appwrite_mcp import list_appwrite_documents, download_from_appwrite_storage
from .compression import decompress_json_gzip_base64

logger = logging.getLogger(__name__)

# Storage bucket constants (must match sow_upserter.py)
STORAGE_PREFIX = "storage:"
STORAGE_BUCKET_ID = "authored_sow_entries"


async def extract_sow_entry_to_workspace(
    courseId: str,
    order: int,
    mcp_config_path: str,
    workspace_path: Path
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Extract SOW entry and metadata to workspace files.

    Creates two files in workspace:
    1. sow_entry_input.json: The specific lesson entry at order
    2. sow_context.json: Course-level SOW metadata

    Note: Only SOW documents with status='published' are retrieved. Draft SOWs
    are excluded from lesson template authoring to ensure quality control.

    Args:
        courseId: Course identifier (e.g., 'course_c84874')
        order: Lesson order in SOW entries (1-indexed: 1, 2, 3...)
        mcp_config_path: Path to MCP config
        workspace_path: Workspace directory path

    Returns:
        Tuple of (sow_entry_dict, sow_metadata_dict)

    Raises:
        ValueError: If published SOW not found or order invalid
    """
    logger.info(f"Extracting SOW entry for courseId='{courseId}', order={order}")

    # Query Authored_SOW collection (only published SOWs)
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
            f"Please ensure the SOW is authored and published (status='published') before creating lesson templates."
        )

    sow_doc = sow_docs[0]

    # Parse entries field (handles storage bucket refs, compressed, and uncompressed formats)
    # Supports:
    # - Storage bucket: "storage:<file_id>" - fetch from storage, then decompress
    # - TypeScript "gzip:" prefix: compressed inline
    # - Python legacy raw base64: compressed inline
    # - Uncompressed JSON: legacy format
    entries_raw = sow_doc.get('entries', [])

    if isinstance(entries_raw, str):
        # Check for storage bucket reference first
        if entries_raw.startswith(STORAGE_PREFIX):
            file_id = entries_raw[len(STORAGE_PREFIX):]
            logger.info(f"📦 Entries stored in storage bucket, fetching: {file_id}")

            try:
                # Download compressed data from storage bucket
                entries_bytes = await download_from_appwrite_storage(
                    bucket_id=STORAGE_BUCKET_ID,
                    file_id=file_id,
                    mcp_config_path=mcp_config_path
                )

                # Decode bytes to string (it's base64-encoded gzip data)
                entries_compressed = entries_bytes.decode('utf-8')

                # Decompress the data
                entries = decompress_json_gzip_base64(entries_compressed)
                logger.info(f"✓ Fetched and decompressed {len(entries)} entries from storage")

            except FileNotFoundError:
                raise ValueError(
                    f"Storage file not found for courseId '{courseId}': {file_id}. "
                    f"The storage bucket entry may have been deleted."
                )
            except Exception as e:
                logger.error(f"Failed to fetch entries from storage: {e}")
                raise ValueError(
                    f"Cannot fetch entries from storage for courseId '{courseId}': {e}. "
                    f"File ID: {file_id}, Bucket: {STORAGE_BUCKET_ID}"
                )
        else:
            # Inline compressed data (existing behavior)
            try:
                entries = decompress_json_gzip_base64(entries_raw)
            except ValueError as e:
                logger.error(f"Failed to decompress entries field: {e}")
                raise ValueError(
                    f"Cannot parse entries field for courseId '{courseId}': {e}. "
                    f"The entries field may be corrupted or in an unsupported format."
                )
    else:
        # Already parsed (list) - use as-is
        entries = entries_raw

    # Find entry with matching order
    entry = next((e for e in entries if e.get('order') == order), None)

    if entry is None:
        available_orders = [e.get('order') for e in entries if 'order' in e]
        raise ValueError(
            f"Order {order} not found in SOW entries for courseId '{courseId}'. "
            f"Available orders: {sorted(available_orders)}"
        )

    logger.info(f"Found SOW entry: {entry.get('label', 'N/A')}")

    # Extract SOW metadata (course-level context)
    sow_metadata = {
        "courseId": courseId,
        "subject": sow_doc.get('subject', ''),
        "level": sow_doc.get('level', ''),
        "coherence": sow_doc.get('coherence', ''),
        "accessibility_notes": sow_doc.get('accessibility_notes', ''),
        "engagement_notes": sow_doc.get('engagement_notes', ''),
        "total_entries": len(entries)
    }

    # Write sow_entry_input.json
    entry_file_path = workspace_path / "sow_entry_input.json"
    with open(entry_file_path, 'w') as f:
        json.dump(entry, f, indent=2)

    logger.info(f"✅ Written sow_entry_input.json to {entry_file_path}")

    # Write sow_context.json
    context_file_path = workspace_path / "sow_context.json"
    with open(context_file_path, 'w') as f:
        json.dump(sow_metadata, f, indent=2)

    logger.info(f"✅ Written sow_context.json to {context_file_path}")

    return (entry, sow_metadata)


async def get_course_metadata_from_sow(
    courseId: str,
    mcp_config_path: str
) -> Tuple[str, str]:
    """Get course subject and level from courses collection.

    This is needed for Course_data.txt extraction.

    Note: Despite the function name, this queries the courses collection,
    not the SOW. Subject and level are course properties, not SOW properties.

    Args:
        courseId: Course identifier (e.g., 'course_c84874')
        mcp_config_path: Path to MCP config

    Returns:
        Tuple of (subject, level) strings

    Raises:
        ValueError: If course not found or missing required fields
    """
    logger.info(f"Fetching course metadata from courses collection for courseId='{courseId}'")

    # Query courses collection to get subject and level
    course_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="courses",
        queries=[f'equal("courseId", "{courseId}")'],
        mcp_config_path=mcp_config_path
    )

    if not course_docs or len(course_docs) == 0:
        raise ValueError(
            f"Course not found: No course with courseId='{courseId}' in default.courses collection. "
            f"Please ensure the course exists before creating lesson templates."
        )

    course_doc = course_docs[0]

    subject = course_doc.get('subject', '')
    level = course_doc.get('level', '')

    if not subject or not level:
        raise ValueError(
            f"Course document missing subject or level fields for courseId '{courseId}'. "
            f"Got subject='{subject}', level='{level}'"
        )

    logger.info(f"Course metadata: subject='{subject}', level='{level}'")

    return (subject, level)
