#!/usr/bin/env python3
"""Script to add diagram_context enum attribute to lesson_diagrams collection.

Adds:
- diagram_context (enum: "lesson" | "cfu", required)
  Distinguishes whether diagram is for lesson content or CFU assessment
"""

import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def add_diagram_context_attribute():
    """Add diagram_context enum attribute to lesson_diagrams collection."""

    # Import Appwrite SDK
    try:
        from appwrite.client import Client
        from appwrite.services.databases import Databases
        from appwrite.exception import AppwriteException
    except ImportError:
        raise ImportError("Appwrite Python SDK not installed. Run: pip install appwrite")

    # Load MCP config for credentials
    mcp_config_path = Path(__file__).parent.parent.parent / ".mcp.json"
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

    # Initialize client
    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)

    logger.info("Connected to Appwrite")
    logger.info(f"Endpoint: {endpoint}")
    logger.info(f"Project: {project_id}")

    # Add diagram_context string attribute
    # Note: Using string instead of enum because:
    # 1. Enum attribute API is deprecated in Appwrite SDK
    # 2. Adding required enum to collection with existing data causes 500 error
    # 3. Enum validation will be enforced in diagram_upserter.py
    try:
        logger.info("Creating diagram_context string attribute...")
        databases.create_string_attribute(
            database_id="default",
            collection_id="lesson_diagrams",
            key="diagram_context",
            size=20,
            required=False  # Optional initially to avoid breaking existing documents
        )
        logger.info("✅ diagram_context string attribute created successfully")
        logger.info("   Expected values: 'lesson' (for explainer content) | 'cfu' (for CFU questions)")
        logger.info("   Note: Validation enforced in diagram_upserter.py code")
        logger.info("   Field is optional to preserve existing documents (can backfill later)")
    except AppwriteException as e:
        if e.code == 409:
            logger.warning("⚠️  diagram_context attribute already exists")
        else:
            logger.error(f"❌ Failed to create diagram_context: {e.message} (code: {e.code})")
            raise

    logger.info("\n" + "=" * 60)
    logger.info("✅ diagram_context attribute added successfully!")
    logger.info("=" * 60)
    logger.info("\nNext steps:")
    logger.info("1. Wait for attribute to be available (Appwrite processes it asynchronously)")
    logger.info("2. Verify in Appwrite Console: Database → default → lesson_diagrams → Attributes")
    logger.info("3. Update diagram_upserter.py to pass diagram_context parameter")
    logger.info("4. Update diagram_extractor.py for dual eligibility analysis")


if __name__ == "__main__":
    asyncio.run(add_diagram_context_attribute())
