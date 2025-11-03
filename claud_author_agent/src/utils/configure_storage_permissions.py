#!/usr/bin/env python3
"""Script to configure Appwrite Storage bucket permissions for diagram images.

This script ensures the 'image' bucket (6907775a001b754c19a6) has public read permissions
so that diagram images can be displayed in the frontend without authentication.

Permissions Required:
- Bucket: 6907775a001b754c19a6 (image bucket)
- Read: Role:any (public read access)
- Write: Protected (only API key can write)

Usage:
    python3 configure_storage_permissions.py
"""

import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Storage bucket ID for diagram images
DIAGRAM_IMAGE_BUCKET_ID = "6907775a001b754c19a6"


async def configure_bucket_permissions():
    """Configure Storage bucket permissions for public read access."""

    try:
        from appwrite.client import Client
        from appwrite.services.storage import Storage
        from appwrite.exception import AppwriteException
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")

    # Load MCP config for credentials
    mcp_config_path = Path(__file__).parent.parent.parent / ".mcp.json"
    if not mcp_config_path.exists():
        raise FileNotFoundError(f"MCP config not found: {mcp_config_path}")

    with open(mcp_config_path) as f:
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

    # Initialize client with API key (admin access)
    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    storage = Storage(client)

    logger.info("Connected to Appwrite")
    logger.info(f"Endpoint: {endpoint}")
    logger.info(f"Project: {project_id}")
    logger.info(f"Bucket ID: {DIAGRAM_IMAGE_BUCKET_ID}")

    # Check if bucket exists
    try:
        bucket = storage.get_bucket(DIAGRAM_IMAGE_BUCKET_ID)
        logger.info(f"✅ Bucket found: {bucket.get('name', 'Unnamed')}")
    except AppwriteException as e:
        if e.code == 404:
            logger.error(f"❌ Bucket not found: {DIAGRAM_IMAGE_BUCKET_ID}")
            logger.error("Create the bucket in Appwrite Console first, then run this script.")
            return
        else:
            raise

    # Update bucket permissions for public read access
    try:
        logger.info("Updating bucket permissions for public read access...")

        # Update bucket with public read permissions
        # Permission format: read("any") allows public read access
        updated_bucket = storage.update_bucket(
            bucket_id=DIAGRAM_IMAGE_BUCKET_ID,
            name=bucket.get('name', 'image'),  # Keep existing name
            permissions=[
                "read(\"any\")",  # Public read access for frontend
            ],
            file_security=bucket.get('fileSecurity', False),  # Keep existing setting
            enabled=True,  # Ensure bucket is enabled
            maximum_file_size=bucket.get('maximumFileSize', 50000000),  # Keep existing limit
            allowed_file_extensions=bucket.get('allowedFileExtensions', []),  # Keep existing
            compression=bucket.get('compression', 'none'),  # Keep existing
            encryption=bucket.get('encryption', True),  # Keep existing
            antivirus=bucket.get('antivirus', True)  # Keep existing
        )

        logger.info("✅ Bucket permissions updated successfully!")
        logger.info(f"Permissions: {updated_bucket.get('$permissions', [])}")

    except AppwriteException as e:
        logger.error(f"❌ Failed to update bucket permissions: {e.message} (code: {e.code})")
        raise

    # Verify permissions
    logger.info("\n" + "=" * 60)
    logger.info("✅ Configuration complete!")
    logger.info("=" * 60)
    logger.info("\nBucket Configuration:")
    logger.info(f"  - Bucket ID: {DIAGRAM_IMAGE_BUCKET_ID}")
    logger.info(f"  - Name: {updated_bucket.get('name', 'N/A')}")
    logger.info(f"  - Permissions: {updated_bucket.get('$permissions', [])}")
    logger.info(f"  - File Security: {updated_bucket.get('fileSecurity', False)}")
    logger.info(f"  - Enabled: {updated_bucket.get('enabled', False)}")
    logger.info("\nNext steps:")
    logger.info("1. Verify in Appwrite Console: Storage → Buckets → image → Settings")
    logger.info("2. Restart the frontend application to test diagram display")
    logger.info("3. Check browser console for diagram fetch logs")


if __name__ == "__main__":
    import asyncio
    asyncio.run(configure_bucket_permissions())
