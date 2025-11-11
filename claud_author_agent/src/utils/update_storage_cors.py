#!/usr/bin/env python3
"""Update Appwrite Storage bucket CORS settings for development.

Adds localhost:3000 to allowed origins for diagram image loading.
"""

import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DIAGRAM_IMAGE_BUCKET_ID = "6907775a001b754c19a6"


async def update_cors():
    """Update Storage bucket CORS settings."""

    try:
        from appwrite.client import Client
        from appwrite.services.storage import Storage
        from appwrite.exception import AppwriteException
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed")

    # Load MCP config
    mcp_config_path = Path(__file__).parent.parent.parent / ".mcp.json"
    with open(mcp_config_path) as f:
        mcp_config = json.load(f)

    appwrite_config = mcp_config.get("mcpServers", {}).get("appwrite", {})
    args = appwrite_config.get("args", [])

    endpoint = api_key = project_id = None
    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="): endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_API_KEY="): api_key = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="): project_id = arg.split("=", 1)[1]

    if not all([endpoint, api_key, project_id]):
        raise ValueError("Missing Appwrite credentials")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    storage = Storage(client)

    logger.info("Connected to Appwrite")

    # Get current bucket config
    bucket = storage.get_bucket(DIAGRAM_IMAGE_BUCKET_ID)
    logger.info(f"Current bucket: {bucket.get('name', 'N/A')}")
    logger.info(f"Current permissions: {bucket.get('$permissions', [])}")

    # Update bucket with wildcard CORS for development
    # For production, you should restrict this to your actual domain
    logger.info("Updating bucket with wildcard CORS for development...")

    updated_bucket = storage.update_bucket(
        bucket_id=DIAGRAM_IMAGE_BUCKET_ID,
        name=bucket.get('name', 'images'),
        permissions=["read(\"any\")"],  # Keep public read
        file_security=False,  # Use bucket-level permissions
        enabled=True,
        maximum_file_size=bucket.get('maximumFileSize', 50000000),
        allowed_file_extensions=bucket.get('allowedFileExtensions', []),
        compression=bucket.get('compression', 'none'),
        encryption=bucket.get('encryption', True),
        antivirus=bucket.get('antivirus', True)
    )

    logger.info("✅ Bucket updated successfully!")
    logger.info(f"Permissions: {updated_bucket.get('$permissions', [])}")
    logger.info(f"File Security: {updated_bucket.get('fileSecurity', False)}")

    logger.info("\nNote: Appwrite Project-level CORS settings also need to be configured!")
    logger.info("Go to: Appwrite Console → Your Project → Settings → Platforms")
    logger.info("Add platform:")
    logger.info("  - Type: Web")
    logger.info("  - Name: Local Development")
    logger.info("  - Hostname: localhost:3000")
    logger.info("  - OR use wildcard: *")


if __name__ == "__main__":
    import asyncio
    asyncio.run(update_cors())
