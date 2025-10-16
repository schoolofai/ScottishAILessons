"""Lesson Template Upserter for Lesson Author Agent.

Upserts lesson templates to Appwrite lesson_templates collection with card compression.
Ports compression logic from TypeScript seedAuthoredLesson.ts script.
"""

import base64
import gzip
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from .appwrite_mcp import (
    list_appwrite_documents,
    create_appwrite_document,
    update_appwrite_document
)

logger = logging.getLogger(__name__)


def compress_cards_gzip_base64(cards: list) -> str:
    """Compress cards using gzip + base64 (ported from TypeScript).

    Args:
        cards: List of card dictionaries

    Returns:
        Base64-encoded gzip-compressed JSON string

    Raises:
        ValueError: If cards is not serializable to JSON
    """
    try:
        # Step 1: Convert cards to JSON string
        cards_json = json.dumps(cards)

        # Step 2: Encode to UTF-8 bytes
        cards_bytes = cards_json.encode('utf-8')

        # Step 3: Compress with gzip
        compressed = gzip.compress(cards_bytes)

        # Step 4: Base64 encode
        b64_encoded = base64.b64encode(compressed).decode('ascii')

        return b64_encoded

    except (TypeError, ValueError) as e:
        raise ValueError(f"Failed to compress cards: {e}")


def get_compression_stats(cards: list) -> Dict[str, Any]:
    """Calculate compression statistics for logging.

    Args:
        cards: List of card dictionaries

    Returns:
        Dictionary with compression metrics
    """
    original_json = json.dumps(cards)
    compressed = compress_cards_gzip_base64(cards)

    original_size = len(original_json)
    compressed_size = len(compressed)
    ratio = (compressed_size / original_size) * 100
    savings = ((1 - compressed_size / original_size) * 100)

    return {
        "original_bytes": original_size,
        "compressed_bytes": compressed_size,
        "ratio_percent": f"{ratio:.1f}%",
        "savings_percent": f"{savings:.1f}%"
    }


async def upsert_lesson_template(
    lesson_template_path: str,
    courseId: str,
    order: int,
    execution_id: str,
    mcp_config_path: str
) -> str:
    """Upsert lesson template to Appwrite lesson_templates collection.

    Replicates TypeScript logic from seedAuthoredLesson.ts:
    - Compresses cards field using gzip + base64
    - Queries by (courseId, sow_order) for uniqueness
    - Updates if exists, creates if new

    Args:
        lesson_template_path: Path to lesson_template.json file
        courseId: Course identifier
        order: Lesson order (stored as sow_order)
        execution_id: Unique execution identifier
        mcp_config_path: Path to MCP config

    Returns:
        Document ID (string)

    Raises:
        FileNotFoundError: If lesson_template.json missing
        ValueError: If JSON invalid or schema mismatch
    """
    logger.info(f"Starting lesson template upsert for courseId='{courseId}', order={order}")

    # Step 1: Load lesson_template.json
    template_file = Path(lesson_template_path)

    if not template_file.exists():
        raise FileNotFoundError(
            f"Lesson template file not found: {lesson_template_path}. "
            f"Agent may have failed to generate lesson_template.json."
        )

    try:
        with open(template_file, 'r') as f:
            template = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in lesson_template.json: {e}")

    logger.info(f"Loaded lesson template: {template.get('title', 'N/A')}")

    # Step 2: Extract and compress cards
    cards = template.get("cards", [])

    if not cards:
        logger.warning("No cards found in lesson template - proceeding with empty cards")

    compressed_cards = compress_cards_gzip_base64(cards)

    # Log compression stats
    stats = get_compression_stats(cards)
    logger.info(f"Card compression: {stats['original_bytes']} → {stats['compressed_bytes']} bytes "
                f"({stats['ratio_percent']}, saved {stats['savings_percent']})")

    # Step 3: Query for existing document by (courseId, sow_order)
    logger.info(f"Checking for existing lesson template: courseId='{courseId}', sow_order={order}")

    existing_docs = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=[
            f'equal("courseId", "{courseId}")',
            f'equal("sow_order", {order})'
        ],
        mcp_config_path=mcp_config_path
    )

    # Step 4: Prepare document data (match TypeScript field mapping)
    doc_data = {
        "courseId": courseId,
        "sow_order": order,
        "title": template.get("title", "Untitled Lesson"),
        "createdBy": "lesson_author_agent",
        "version": 1,
        "status": "draft",
        "model_version": "claud_Agent_sdk",  # Track which authoring system generated this
        "lesson_type": template.get("lesson_type", "teach"),
        "estMinutes": template.get("estMinutes", 50),
        "outcomeRefs": json.dumps(template.get("outcomeRefs", [])),
        "engagement_tags": json.dumps(template.get("engagement_tags", [])),
        "policy": json.dumps(template.get("policy", {})),
        "cards": compressed_cards  # Compressed, not JSON string
    }

    # Step 5: Upsert (update if exists, create if new)
    if existing_docs and len(existing_docs) > 0:
        # Update existing document
        doc_id = existing_docs[0]["$id"]
        logger.info(f"Updating existing document: {doc_id}")

        await update_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            document_id=doc_id,
            data=doc_data,
            mcp_config_path=mcp_config_path
        )

        logger.info(f"✅ Updated lesson template: {doc_id}")

    else:
        # Create new document
        logger.info("Creating new document (no existing document found)")

        doc = await create_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            data=doc_data,
            mcp_config_path=mcp_config_path
        )

        doc_id = doc["$id"]
        logger.info(f"✅ Created lesson template: {doc_id}")

    return doc_id


def decompress_cards_gzip_base64(compressed_cards: str) -> list:
    """Decompress cards from gzip + base64 format (for verification).

    Args:
        compressed_cards: Base64-encoded gzip-compressed JSON string

    Returns:
        List of card dictionaries

    Raises:
        ValueError: If decompression fails
    """
    try:
        # Step 1: Base64 decode
        compressed_bytes = base64.b64decode(compressed_cards.encode('ascii'))

        # Step 2: Gzip decompress
        decompressed_bytes = gzip.decompress(compressed_bytes)

        # Step 3: UTF-8 decode
        cards_json = decompressed_bytes.decode('utf-8')

        # Step 4: JSON parse
        cards = json.loads(cards_json)

        return cards

    except (ValueError, gzip.BadGzipFile, json.JSONDecodeError) as e:
        raise ValueError(f"Failed to decompress cards: {e}")
