"""Diagram PNG uploader for Appwrite Storage (Phase 6 of integrated lesson authoring).

Uploads diagram PNGs from workspace to Appwrite Storage and updates lesson template
with image_file_id references. This is different from the separate diagram_upserter.py
which uploads to the lesson_diagrams collection.

This module handles diagrams that are EMBEDDED in lesson_template cards.

Usage:
    from diagram_uploader import upload_diagrams_to_storage

    result = await upload_diagrams_to_storage(
        lesson_template=lesson_template,
        workspace_path=workspace_path,
        mcp_config_path=".mcp.json"
    )
"""

import base64
import hashlib
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Appwrite Storage bucket ID for lesson diagrams
# TODO: Update this to actual bucket ID after infrastructure setup
LESSON_DIAGRAMS_BUCKET_ID = "lesson_diagrams"


def generate_diagram_file_id(lesson_template_id: str, card_id: str) -> str:
    """Generate deterministic file ID for diagram PNG in Storage.

    Uses MD5 hash of lessonTemplateId + cardId for reproducibility.
    Format: lesson_dgm_{8-char-hash}

    Args:
        lesson_template_id: Lesson template identifier
        card_id: Card identifier (e.g., "card_001")

    Returns:
        str: Deterministic file ID (e.g., "lesson_dgm_a1b2c3d4")

    Examples:
        >>> generate_diagram_file_id("lesson_template_123", "card_001")
        'lesson_dgm_f4e5d6c7'
    """
    combined = f"{lesson_template_id}_{card_id}"
    hash_suffix = hashlib.md5(combined.encode()).hexdigest()[:8]
    file_id = f"lesson_dgm_{hash_suffix}"

    logger.debug(
        f"Generated file ID: {file_id} "
        f"(hash of {lesson_template_id}_{card_id})"
    )

    return file_id


async def upload_diagrams_to_storage(
    lesson_template: Dict[str, Any],
    workspace_path: Path,
    mcp_config_path: str
) -> Dict[str, Any]:
    """Upload all diagram PNGs from workspace to Appwrite Storage.

    Processes all cards with successful diagram generation:
    1. Reads PNG file from workspace/diagrams/
    2. Uploads to Appwrite Storage bucket 'lesson_diagrams'
    3. Updates card's diagram_metadata with image_file_id
    4. Removes local image_path reference

    Args:
        lesson_template: Lesson template with diagram_metadata in cards
        workspace_path: Workspace directory containing PNG files
        mcp_config_path: Path to .mcp.json

    Returns:
        {
            "uploaded": int,
            "failed": int,
            "failed_card_ids": List[str]
        }

    Side Effects:
        - Modifies lesson_template dict in-place (updates diagram_metadata)
        - Does NOT write lesson_template.json (caller's responsibility)
    """
    uploaded = 0
    failed = 0
    failed_card_ids = []

    lesson_template_id = lesson_template.get("lessonTemplateId", "UNKNOWN")

    for card in lesson_template.get("cards", []):
        diagram_metadata = card.get("diagram_metadata")

        # Skip cards without successful diagrams
        if not diagram_metadata or diagram_metadata.get("generation_status") != "success":
            continue

        card_id = card.get("id", "UNKNOWN")
        image_path = diagram_metadata.get("image_path")

        # Validate PNG file exists
        if not image_path:
            logger.warning(f"No image_path for card {card_id}")
            continue

        png_file = Path(image_path)
        if not png_file.exists():
            logger.error(f"PNG file not found: {image_path}")
            failed += 1
            failed_card_ids.append(card_id)
            continue

        try:
            # Upload to Appwrite Storage
            file_id = await _upload_to_appwrite_storage(
                file_path=png_file,
                bucket_id=LESSON_DIAGRAMS_BUCKET_ID,
                card_id=card_id,
                lesson_template_id=lesson_template_id,
                mcp_config_path=mcp_config_path
            )

            # Update diagram_metadata with file_id
            diagram_metadata["image_file_id"] = file_id
            diagram_metadata.pop("image_path", None)  # Remove local path

            uploaded += 1
            logger.info(f"✅ Uploaded diagram for {card_id}: {file_id}")

        except Exception as e:
            logger.error(f"❌ Failed to upload diagram for {card_id}: {e}", exc_info=True)
            failed += 1
            failed_card_ids.append(card_id)
            # GRACEFUL: Continue even if upload fails

    logger.info(
        f"Diagram upload complete: {uploaded} uploaded, {failed} failed"
    )

    return {
        "uploaded": uploaded,
        "failed": failed,
        "failed_card_ids": failed_card_ids
    }


async def _upload_to_appwrite_storage(
    file_path: Path,
    bucket_id: str,
    card_id: str,
    lesson_template_id: str,
    mcp_config_path: str
) -> str:
    """Upload single PNG file to Appwrite Storage.

    Args:
        file_path: Path to PNG file
        bucket_id: Appwrite storage bucket (e.g., "lesson_diagrams")
        card_id: Card identifier for filename
        lesson_template_id: Lesson template identifier
        mcp_config_path: Path to .mcp.json

    Returns:
        Appwrite file ID

    Raises:
        Exception: If upload fails
    """
    logger.info(f"Uploading {file_path.name} to Storage bucket '{bucket_id}'")

    try:
        # Import Appwrite SDK
        from appwrite.client import Client
        from appwrite.services.storage import Storage
        from appwrite.input_file import InputFile
        from appwrite.exception import AppwriteException

        # Load MCP config for credentials
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        # Extract credentials
        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

        endpoint = None
        api_key = None
        project_id = None

        for arg in args:
            if arg.startswith("--endpoint="):
                endpoint = arg.replace("--endpoint=", "")
            elif arg.startswith("--key="):
                api_key = arg.replace("--key=", "")
            elif arg.startswith("--project="):
                project_id = arg.replace("--project=", "")

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize Appwrite client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        storage = Storage(client)

        # Generate deterministic file ID
        file_id = generate_diagram_file_id(lesson_template_id, card_id)

        # Read PNG file
        png_bytes = file_path.read_bytes()

        # Create InputFile from bytes
        input_file = InputFile.from_bytes(
            png_bytes,
            filename=f"{card_id}.png",
            mime_type="image/png"
        )

        # Check if file exists (for idempotent uploads)
        try:
            existing_file = storage.get_file(bucket_id, file_id)
            logger.info(f"File {file_id} already exists, deleting before re-upload")
            storage.delete_file(bucket_id, file_id)
        except AppwriteException as e:
            # File doesn't exist, that's fine
            if e.code != 404:
                logger.warning(f"Error checking existing file: {e}")

        # Upload file with deterministic ID
        result = storage.create_file(
            bucket_id=bucket_id,
            file_id=file_id,
            file=input_file
        )

        logger.info(f"✅ Uploaded to Storage: {result['$id']} ({len(png_bytes)} bytes)")
        return result['$id']

    except Exception as e:
        logger.error(f"Failed to upload to Appwrite Storage: {e}", exc_info=True)
        raise
