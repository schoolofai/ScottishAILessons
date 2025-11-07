"""Appwrite Storage uploader utilities for diagram images.

Provides functions for uploading base64-encoded PNG images to Appwrite Storage
bucket instead of storing them as document fields (best practice for large files).

Architecture:
- Images uploaded to 'image' bucket (ID: 6907775a001b754c19a6)
- File IDs are deterministic (MD5 hash of lessonTemplateId + cardId + diagram_context)
- Dual-context support: Separate file IDs for lesson vs CFU diagrams
- Idempotent: Same card+context always gets same file ID (overwrites on re-upload)
- Fast-fail: Throws exceptions on upload failures

Usage:
    from storage_uploader import upload_diagram_image

    file_id = await upload_diagram_image(
        lesson_template_id="lesson_template_123",
        card_id="card_001",
        image_base64="iVBORw0KGgoAAAANS...",
        mcp_config_path=".mcp.json"
    )
"""

import base64
import hashlib
import json
import logging
from pathlib import Path
from typing import Optional
from io import BytesIO

logger = logging.getLogger(__name__)

# Appwrite Storage bucket ID for diagram images
DIAGRAM_IMAGE_BUCKET_ID = "6907775a001b754c19a6"


def generate_file_id(lesson_template_id: str, card_id: str, diagram_context: Optional[str] = None) -> str:
    """Generate deterministic file ID for diagram image.

    Uses MD5 hash of lessonTemplateId + cardId + diagram_context for reproducibility.
    Including diagram_context ensures unique file IDs for lesson vs CFU diagrams.
    Format: dgm_image_{8-char-hash}

    Args:
        lesson_template_id: Lesson template document ID
        card_id: Card identifier (e.g., "card_001")
        diagram_context: Diagram usage context ("lesson" or "cfu") - optional for backward compatibility

    Returns:
        str: Deterministic file ID (e.g., "dgm_image_a1b2c3d4")

    Examples:
        >>> generate_file_id("lesson_template_123", "card_001", "lesson")
        'dgm_image_f4e5d6c7'
        >>> generate_file_id("lesson_template_123", "card_001", "cfu")
        'dgm_image_9a8b7c6d'  # Different hash for different context
    """
    # Include diagram_context in hash to generate unique IDs for lesson vs CFU
    context_suffix = f"_{diagram_context}" if diagram_context else ""
    combined = f"{lesson_template_id}_{card_id}{context_suffix}"
    hash_suffix = hashlib.md5(combined.encode()).hexdigest()[:8]
    file_id = f"dgm_image_{hash_suffix}"

    logger.debug(
        f"Generated file ID: {file_id} "
        f"(hash of {lesson_template_id}_{card_id}{context_suffix})"
    )

    return file_id


async def upload_diagram_image(
    lesson_template_id: str,
    card_id: str,
    image_base64: str,
    diagram_context: Optional[str] = None,
    mcp_config_path: str = ".mcp.json"
) -> str:
    """Upload base64-encoded PNG image to Appwrite Storage.

    Uploads diagram image to the 'image' bucket with a deterministic file ID.
    If a file with the same ID already exists, it will be overwritten.

    Args:
        lesson_template_id: Lesson template document ID
        card_id: Card identifier (e.g., "card_001")
        image_base64: Base64-encoded PNG image string
        diagram_context: Diagram usage context ("lesson" or "cfu") - optional for backward compatibility
        mcp_config_path: Path to MCP configuration file

    Returns:
        str: File ID of uploaded image (e.g., "dgm_image_a1b2c3d4")

    Raises:
        ValueError: If image_base64 is empty or invalid
        Exception: If upload fails (network error, quota exceeded, etc.)

    Example:
        file_id = await upload_diagram_image(
            lesson_template_id="lesson_template_123",
            card_id="card_001",
            image_base64="iVBORw0KGgoAAAANS...",
            diagram_context="lesson",
            mcp_config_path=".mcp.json"
        )
        # Returns: "dgm_image_f4e5d6c7"
    """
    logger.info(
        f"Uploading diagram image: lessonTemplateId={lesson_template_id}, "
        f"cardId={card_id}, context={diagram_context}"
    )

    # Validation
    if not image_base64:
        raise ValueError("image_base64 is required and cannot be empty")

    if not lesson_template_id:
        raise ValueError("lesson_template_id is required")

    if not card_id:
        raise ValueError("card_id is required")

    # Generate deterministic file ID (includes diagram_context for unique lesson vs CFU file IDs)
    file_id = generate_file_id(lesson_template_id, card_id, diagram_context)

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
            if arg.startswith("APPWRITE_ENDPOINT="):
                endpoint = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_API_KEY="):
                api_key = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_PROJECT_ID="):
                project_id = arg.split("=", 1)[1]

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        storage = Storage(client)

        # Decode base64 to binary
        try:
            image_binary = base64.b64decode(image_base64)
        except Exception as e:
            raise ValueError(f"Failed to decode base64 image: {e}")

        logger.info(f"Image size: {len(image_binary)} bytes ({len(image_binary) / 1024:.2f} KB)")

        # Create InputFile from binary data
        input_file = InputFile.from_bytes(
            image_binary,
            filename=f"{file_id}.png",
            mime_type="image/png"
        )

        # Upload to Storage bucket
        try:
            # Check if file already exists and delete it (for overwrite behavior)
            try:
                existing_file = storage.get_file(
                    bucket_id=DIAGRAM_IMAGE_BUCKET_ID,
                    file_id=file_id
                )
                logger.info(f"File {file_id} already exists - deleting for overwrite")
                storage.delete_file(
                    bucket_id=DIAGRAM_IMAGE_BUCKET_ID,
                    file_id=file_id
                )
                logger.info(f"✓ Existing file deleted")
            except AppwriteException as e:
                if e.code == 404:
                    # File doesn't exist - this is fine, we'll create it
                    logger.debug(f"File {file_id} doesn't exist - will create new")
                else:
                    # Other error during existence check
                    raise

            # Upload new file
            result = storage.create_file(
                bucket_id=DIAGRAM_IMAGE_BUCKET_ID,
                file_id=file_id,
                file=input_file
            )

            uploaded_file_id = result['$id']

            logger.info(
                f"✓ Image uploaded successfully: {uploaded_file_id} "
                f"({len(image_binary) / 1024:.2f} KB)"
            )

            return uploaded_file_id

        except AppwriteException as e:
            # Handle specific Appwrite errors
            if e.code == 413:
                raise Exception(
                    f"Image too large for upload: {len(image_binary) / 1024:.2f} KB. "
                    f"Appwrite bucket may have size limits. Error: {e.message}"
                )
            elif e.code == 429:
                raise Exception(
                    f"Storage quota exceeded or rate limit reached. Error: {e.message}"
                )
            elif e.code == 404:
                raise Exception(
                    f"Storage bucket not found: {DIAGRAM_IMAGE_BUCKET_ID}. "
                    f"Verify bucket exists in Appwrite Console. Error: {e.message}"
                )
            else:
                raise Exception(
                    f"Failed to upload image to Storage: {e.message} (code: {e.code})"
                )

    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")
    except Exception as e:
        logger.error(f"Failed to upload diagram image: {e}")
        raise Exception(
            f"Failed to upload diagram image for lessonTemplateId='{lesson_template_id}', "
            f"cardId='{card_id}': {str(e)}"
        ) from e


async def delete_diagram_image(
    file_id: str,
    mcp_config_path: str = ".mcp.json"
) -> None:
    """Delete diagram image from Appwrite Storage.

    Utility function for cleanup or retry scenarios.

    Args:
        file_id: File ID to delete (e.g., "dgm_image_a1b2c3d4")
        mcp_config_path: Path to MCP configuration file

    Raises:
        Exception: If deletion fails (file not found, network error, etc.)
    """
    logger.info(f"Deleting diagram image: {file_id}")

    try:
        from appwrite.client import Client
        from appwrite.services.storage import Storage
        from appwrite.exception import AppwriteException

        # Load credentials (same pattern as upload)
        config_path = Path(mcp_config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

        with open(config_path) as f:
            mcp_config = json.load(f)

        appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
        args = appwrite_config.get("args", [])

        endpoint = None
        api_key = None
        project_id = None

        for arg in args:
            if arg.startswith("APPWRITE_ENDPOINT="):
                endpoint = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_API_KEY="):
                api_key = arg.split("=", 1)[1]
            elif arg.startswith("APPWRITE_PROJECT_ID="):
                project_id = arg.split("=", 1)[1]

        if not all([endpoint, api_key, project_id]):
            raise ValueError("Missing Appwrite credentials in MCP config")

        # Initialize client
        client = Client()
        client.set_endpoint(endpoint)
        client.set_project(project_id)
        client.set_key(api_key)

        storage = Storage(client)

        # Delete file
        storage.delete_file(
            bucket_id=DIAGRAM_IMAGE_BUCKET_ID,
            file_id=file_id
        )

        logger.info(f"✓ Image deleted successfully: {file_id}")

    except AppwriteException as e:
        if e.code == 404:
            logger.warning(f"Image not found (may already be deleted): {file_id}")
        else:
            raise Exception(f"Failed to delete image: {e.message} (code: {e.code})")
    except Exception as e:
        logger.error(f"Failed to delete diagram image: {e}")
        raise
