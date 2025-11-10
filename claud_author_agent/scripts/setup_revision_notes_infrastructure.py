#!/usr/bin/env python3
"""One-time Appwrite infrastructure setup for Revision Notes Author.

Creates the revision_notes collection with all required attributes/indexes
and the documents Storage bucket for markdown file storage.

Usage:
    python setup_revision_notes_infrastructure.py --mcp-config .mcp.json
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.appwrite_infrastructure import (
    create_appwrite_collection,
    create_appwrite_string_attribute,
    create_appwrite_integer_attribute,
    create_appwrite_float_attribute,
    create_appwrite_datetime_attribute,
    create_appwrite_enum_attribute,
    create_appwrite_index,
    create_appwrite_bucket
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def create_revision_notes_collection(mcp_config_path: str) -> None:
    """Create revision_notes collection with all attributes and indexes.

    Args:
        mcp_config_path: Path to .mcp.json configuration file

    Raises:
        Exception: If collection or attribute creation fails
    """
    database_id = "default"
    collection_id = "revision_notes"

    logger.info("=" * 60)
    logger.info("Creating revision_notes collection...")
    logger.info("=" * 60)

    try:
        # Step 1: Create collection
        await create_appwrite_collection(
            database_id=database_id,
            collection_id=collection_id,
            name="Revision Notes",
            mcp_config_path=mcp_config_path,
            permissions=["read(\"any\")"],  # Any authenticated user can read
            document_security=True  # Enable document-level permissions
        )
        logger.info("✓ Collection created successfully")

    except Exception as e:
        if "already exists" in str(e).lower():
            logger.warning(f"⚠️  Collection '{collection_id}' already exists, continuing with attributes...")
        else:
            logger.error(f"❌ Failed to create collection: {e}")
            raise

    # Step 2: Create attributes (wait between creates for Appwrite processing)
    logger.info("\nCreating attributes...")

    attributes = [
        ("courseId", "string", {"size": 50, "required": True}),
        ("noteType", "enum", {"elements": ["cheat_sheet", "lesson_note"], "required": True}),
        ("lessonOrder", "integer", {"required": False}),
        ("status", "enum", {"elements": ["draft", "published"], "required": False, "default": "draft"}),
        ("execution_id", "string", {"size": 50, "required": True}),
        ("markdown_file_id", "string", {"size": 50, "required": True}),
        ("version", "string", {"size": 10, "required": False, "default": "1"}),
        ("sow_version", "string", {"size": 10, "required": False}),
        ("token_usage", "integer", {"required": False}),
        ("cost_usd", "float", {"required": False}),
        ("workspace_path", "string", {"size": 200, "required": False}),
        ("generation_timestamp", "datetime", {"required": True})
    ]

    for key, attr_type, params in attributes:
        try:
            if attr_type == "string":
                await create_appwrite_string_attribute(
                    database_id=database_id,
                    collection_id=collection_id,
                    key=key,
                    mcp_config_path=mcp_config_path,
                    **params
                )
            elif attr_type == "enum":
                await create_appwrite_enum_attribute(
                    database_id=database_id,
                    collection_id=collection_id,
                    key=key,
                    mcp_config_path=mcp_config_path,
                    **params
                )
            elif attr_type == "integer":
                await create_appwrite_integer_attribute(
                    database_id=database_id,
                    collection_id=collection_id,
                    key=key,
                    mcp_config_path=mcp_config_path,
                    **params
                )
            elif attr_type == "float":
                await create_appwrite_float_attribute(
                    database_id=database_id,
                    collection_id=collection_id,
                    key=key,
                    mcp_config_path=mcp_config_path,
                    **params
                )
            elif attr_type == "datetime":
                await create_appwrite_datetime_attribute(
                    database_id=database_id,
                    collection_id=collection_id,
                    key=key,
                    mcp_config_path=mcp_config_path,
                    **params
                )

            logger.info(f"  ✓ {key} ({attr_type})")
            await asyncio.sleep(0.5)  # Brief pause between attribute creates

        except Exception as e:
            if "already exists" in str(e).lower() or "attribute with the requested key already exists" in str(e).lower():
                logger.warning(f"  ⚠️  Attribute '{key}' already exists, skipping...")
            else:
                logger.error(f"  ❌ Failed to create attribute '{key}': {e}")
                raise

    # Step 3: Create indexes
    logger.info("\nCreating indexes...")

    indexes = [
        {
            "key": "course_lesson_unique",
            "type": "unique",
            "attributes": ["courseId", "noteType", "lessonOrder"]
        },
        {
            "key": "by_course",
            "type": "key",
            "attributes": ["courseId"]
        },
        {
            "key": "by_course_type",
            "type": "key",
            "attributes": ["courseId", "noteType"]
        },
        {
            "key": "by_status",
            "type": "key",
            "attributes": ["status"]
        }
    ]

    for index in indexes:
        try:
            await create_appwrite_index(
                database_id=database_id,
                collection_id=collection_id,
                key=index["key"],
                index_type=index["type"],
                attributes=index["attributes"],
                mcp_config_path=mcp_config_path
            )
            logger.info(f"  ✓ {index['key']} ({index['type']})")
            await asyncio.sleep(0.5)

        except Exception as e:
            if "already exists" in str(e).lower() or "index with the requested key already exists" in str(e).lower():
                logger.warning(f"  ⚠️  Index '{index['key']}' already exists, skipping...")
            else:
                logger.error(f"  ❌ Failed to create index '{index['key']}': {e}")
                raise

    logger.info("\n✅ Revision notes collection setup complete!")


async def create_documents_storage_bucket(mcp_config_path: str) -> None:
    """Create documents Storage bucket for markdown files.

    Args:
        mcp_config_path: Path to .mcp.json configuration file

    Raises:
        Exception: If bucket creation fails
    """
    bucket_id = "documents"

    logger.info("=" * 60)
    logger.info("Creating documents Storage bucket...")
    logger.info("=" * 60)

    try:
        await create_appwrite_bucket(
            bucket_id=bucket_id,
            name="Documents",
            mcp_config_path=mcp_config_path,
            permissions=["read(\"any\")"],  # Any authenticated user can read
            file_security=True,
            enabled=True,
            maximum_file_size=50 * 1024 * 1024,  # 50 MB
            allowed_file_extensions=[".md", ".txt"],
            compression="none",  # No compression for markdown (human-readable)
            encryption=True,
            antivirus=True
        )

        logger.info("✅ Documents bucket created successfully!")

    except Exception as e:
        if "already exists" in str(e).lower():
            logger.warning(f"⚠️  Bucket '{bucket_id}' already exists, skipping...")
        else:
            logger.error(f"❌ Failed to create bucket: {e}")
            raise


async def main():
    """Main entry point for infrastructure setup."""
    parser = argparse.ArgumentParser(
        description="Setup Appwrite infrastructure for Revision Notes Author"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to .mcp.json configuration file (default: .mcp.json)"
    )

    args = parser.parse_args()

    mcp_config_path = Path(args.mcp_config)
    if not mcp_config_path.exists():
        logger.error(f"❌ MCP config file not found: {mcp_config_path}")
        sys.exit(1)

    logger.info("\n🚀 Starting Appwrite Infrastructure Setup")
    logger.info(f"Using MCP config: {mcp_config_path}")
    logger.info("")

    try:
        # Create collection and attributes
        await create_revision_notes_collection(str(mcp_config_path))

        # Create storage bucket
        await create_documents_storage_bucket(str(mcp_config_path))

        logger.info("\n" + "=" * 60)
        logger.info("🎉 All infrastructure setup complete!")
        logger.info("=" * 60)
        logger.info("\nNext steps:")
        logger.info("  1. Verify collection in Appwrite Console")
        logger.info("  2. Run notes_author_cli.py to generate revision notes")

    except Exception as e:
        logger.error(f"\n❌ Infrastructure setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
