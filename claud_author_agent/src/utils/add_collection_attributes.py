#!/usr/bin/env python3
"""Script to add missing attributes to lesson_diagrams collection.

Adds:
1. image_file_id (string, required) - Appwrite Storage file ID reference
2. failure_reason (string, optional) - Error details for failed diagrams
"""

import asyncio
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def add_attributes():
    """Add image_file_id and failure_reason attributes to lesson_diagrams collection."""

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

    # Add image_file_id attribute
    try:
        logger.info("Creating image_file_id attribute...")
        databases.create_string_attribute(
            database_id="default",
            collection_id="lesson_diagrams",
            key="image_file_id",
            size=100,
            required=True
        )
        logger.info("✅ image_file_id attribute created successfully")
    except AppwriteException as e:
        if e.code == 409:
            logger.warning("⚠️  image_file_id attribute already exists")
        else:
            logger.error(f"❌ Failed to create image_file_id: {e.message} (code: {e.code})")
            raise

    # Add failure_reason attribute
    try:
        logger.info("Creating failure_reason attribute...")
        databases.create_string_attribute(
            database_id="default",
            collection_id="lesson_diagrams",
            key="failure_reason",
            size=5000,
            required=False  # Optional - only populated on failures
        )
        logger.info("✅ failure_reason attribute created successfully")
    except AppwriteException as e:
        if e.code == 409:
            logger.warning("⚠️  failure_reason attribute already exists")
        else:
            logger.error(f"❌ Failed to create failure_reason: {e.message} (code: {e.code})")
            raise

    # Add critique_feedback attribute
    try:
        logger.info("Creating critique_feedback attribute...")
        databases.create_string_attribute(
            database_id="default",
            collection_id="lesson_diagrams",
            key="critique_feedback",
            size=10000,  # Large field for iteration history JSON
            required=True
        )
        logger.info("✅ critique_feedback attribute created successfully")
    except AppwriteException as e:
        if e.code == 409:
            logger.warning("⚠️  critique_feedback attribute already exists")
        else:
            logger.error(f"❌ Failed to create critique_feedback: {e.message} (code: {e.code})")
            raise

    # Add execution_id attribute
    try:
        logger.info("Creating execution_id attribute...")
        databases.create_string_attribute(
            database_id="default",
            collection_id="lesson_diagrams",
            key="execution_id",
            size=50,
            required=True
        )
        logger.info("✅ execution_id attribute created successfully")
    except AppwriteException as e:
        if e.code == 409:
            logger.warning("⚠️  execution_id attribute already exists")
        else:
            logger.error(f"❌ Failed to create execution_id: {e.message} (code: {e.code})")
            raise

    # Add remaining attributes from schema
    remaining_attributes = [
        ("lessonTemplateId", 100, True),
        ("cardId", 50, True),
        ("jsxgraph_json", 50000, True),  # Large field for JSXGraph JSON
        ("diagram_type", 50, True),
        ("visual_critique_score", None, True),  # Will be float
        ("critique_iterations", None, True),  # Will be integer
    ]

    for attr_key, attr_size, attr_required in remaining_attributes:
        try:
            if attr_size is not None:
                logger.info(f"Creating {attr_key} attribute (string)...")
                databases.create_string_attribute(
                    database_id="default",
                    collection_id="lesson_diagrams",
                    key=attr_key,
                    size=attr_size,
                    required=attr_required
                )
            else:
                # Handle numeric types
                if attr_key == "visual_critique_score":
                    logger.info(f"Creating {attr_key} attribute (float)...")
                    databases.create_float_attribute(
                        database_id="default",
                        collection_id="lesson_diagrams",
                        key=attr_key,
                        required=attr_required,
                        min=0.0,
                        max=1.0
                    )
                elif attr_key == "critique_iterations":
                    logger.info(f"Creating {attr_key} attribute (integer)...")
                    databases.create_integer_attribute(
                        database_id="default",
                        collection_id="lesson_diagrams",
                        key=attr_key,
                        required=attr_required,
                        min=1,
                        max=10
                    )

            logger.info(f"✅ {attr_key} attribute created successfully")
        except AppwriteException as e:
            if e.code == 409:
                logger.warning(f"⚠️  {attr_key} attribute already exists")
            else:
                logger.error(f"❌ Failed to create {attr_key}: {e.message} (code: {e.code})")
                raise

    logger.info("\n" + "=" * 60)
    logger.info("✅ All attributes added successfully!")
    logger.info("=" * 60)
    logger.info("\nNext steps:")
    logger.info("1. Wait for attributes to be available (Appwrite processes them asynchronously)")
    logger.info("2. Verify in Appwrite Console: Database → default → lesson_diagrams → Attributes")
    logger.info("3. Test retry script to verify complete upsert")


if __name__ == "__main__":
    asyncio.run(add_attributes())
