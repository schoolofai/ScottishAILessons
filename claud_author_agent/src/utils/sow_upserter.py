"""SOW upserter module - deterministic Python-based database persistence.

Handles upserting of authored SOWs to Appwrite database after agent completion.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)


async def upsert_sow_to_appwrite(
    sow_file_path: str,
    subject: str,
    level: str,
    course_id: str,
    execution_id: str,
    mcp_config_path: str
) -> str:
    """Upsert SOW to Appwrite deterministically.

    Process:
    1. Read authored_sow_json file
    2. Validate JSON structure (has metadata, entries)
    3. Transform to Appwrite schema:
       - Extract accessibility_notes from metadata
       - Stringify entries array
       - Stringify metadata object
       - Add courseId, version="1", status="draft"
    4. Generate document ID
    5. Create document in default.Authored_SOW
    6. Return document ID

    Args:
        sow_file_path: Path to authored_sow_json file
        subject: Subject slug (e.g., 'mathematics')
        level: Level slug (e.g., 'national-5')
        course_id: Validated courseId (e.g., '68e262811061bfe64e31')
        execution_id: Execution timestamp ID
        mcp_config_path: Path to .mcp.json

    Returns:
        Appwrite document ID

    Raises:
        ValueError: If SOW file invalid
        FileNotFoundError: If SOW file missing
    """
    logger.info(f"🔄 Starting SOW upsert to Appwrite")
    logger.info(f"  SOW file: {sow_file_path}")
    logger.info(f"  Subject: {subject}, Level: {level}")
    logger.info(f"  Course ID: {course_id}")

    # Step 1: Read and parse SOW
    sow_path = Path(sow_file_path)
    if not sow_path.exists():
        raise FileNotFoundError(
            f"SOW file not found: {sow_file_path}. "
            f"Agent may not have completed successfully."
        )

    try:
        with open(sow_path) as f:
            sow_data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in SOW file: {e}")

    logger.info(f"✓ SOW file loaded successfully")

    # Step 2: Validate structure
    if "metadata" not in sow_data:
        raise ValueError(
            "Invalid SOW: missing 'metadata' field. "
            "Check SOW author subagent output."
        )

    if "entries" not in sow_data:
        raise ValueError(
            "Invalid SOW: missing 'entries' field. "
            "Check SOW author subagent output."
        )

    if not isinstance(sow_data["entries"], list):
        raise ValueError(
            "Invalid SOW: 'entries' must be an array. "
            f"Got type: {type(sow_data['entries']).__name__}"
        )

    if len(sow_data["entries"]) == 0:
        raise ValueError(
            "Invalid SOW: 'entries' array is empty. "
            "SOW must have at least one lesson entry."
        )

    logger.info(f"✓ SOW structure validated: {len(sow_data['entries'])} entries")

    # Step 3: Transform to Appwrite schema
    # Extract accessibility_notes from metadata
    accessibility_notes = sow_data["metadata"].get("accessibility_notes", "")

    # Stringify entries array
    entries_str = json.dumps(sow_data["entries"])

    # Stringify metadata object
    metadata_str = json.dumps(sow_data["metadata"])

    logger.info(f"✓ Data transformation complete")
    logger.info(f"  Entries JSON size: {len(entries_str)} chars")
    logger.info(f"  Metadata JSON size: {len(metadata_str)} chars")

    # Step 4: Build document
    document_data = {
        "courseId": course_id,
        "version": "1",  # Hardcoded for MVP
        "status": "draft",  # Hardcoded for MVP
        "entries": entries_str,
        "metadata": metadata_str,
        "accessibility_notes": accessibility_notes
    }

    # Step 5: Generate document ID
    # Format: sow_{timestamp}_{hash} (max 36 chars for Appwrite)
    # Use first 3 chars of subject + first 2 chars of level for readability
    import hashlib
    subject_prefix = subject[:3] if len(subject) >= 3 else subject
    level_prefix = level.replace("-", "")[:2]  # Remove hyphens, take 2 chars

    # Create a short hash from subject+level+execution_id for uniqueness
    hash_input = f"{subject}_{level}_{execution_id}".encode('utf-8')
    short_hash = hashlib.md5(hash_input).hexdigest()[:8]

    # Format: sow_mathna5_20251015_a3b4c5d6 (max ~30 chars)
    timestamp_short = execution_id.split("_")[0] if "_" in execution_id else execution_id[:8]
    doc_id = f"sow_{subject_prefix}{level_prefix}_{timestamp_short}_{short_hash}"

    logger.info(f"✓ Document prepared")
    logger.info(f"  Document ID: {doc_id}")
    logger.info(f"  Version: 1 (hardcoded)")
    logger.info(f"  Status: draft")

    # Step 6: Create document in Appwrite
    from .appwrite_mcp import create_appwrite_document

    try:
        result = await create_appwrite_document(
            database_id="default",
            collection_id="Authored_SOW",
            document_id=doc_id,
            data=document_data,
            permissions=["read(\"any\")"],
            mcp_config_path=mcp_config_path
        )

        logger.info(f"✅ SOW upserted successfully to Appwrite")
        logger.info(f"  Document ID: {result['$id']}")
        logger.info(f"  Created at: {result.get('$createdAt', 'N/A')}")

        return result['$id']

    except Exception as e:
        error_msg = (
            f"Failed to upsert SOW to Appwrite: {e}. "
            f"Check Appwrite connection and permissions."
        )
        logger.error(error_msg)
        raise ValueError(error_msg)
