#!/usr/bin/env python3
"""Seed SQA topic taxonomy to Appwrite database.

Populates the sqa_topics collection with the complete National 5 Mathematics
topic taxonomy for use in question classification.

Usage:
    python seed_sqa_topics.py --mcp-config .mcp.json

Based on design specification: docs/claud_author_agent/understanding_standards.md
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models.sqa_extraction_models import TOPIC_TAXONOMY, Topic

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DATABASE_ID = "default"
TOPICS_COLLECTION = "sqa_topics"


async def seed_topics(mcp_config_path: str) -> Dict[str, Any]:
    """Seed the topic taxonomy to the database.

    This creates or updates all topics in the taxonomy.
    Topics are upserted by slug (unique identifier).

    Args:
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Summary of seeded topics:
        {
            "total": int,
            "created": int,
            "updated": int,
            "parent_topics": int,
            "child_topics": int
        }
    """
    from src.utils.appwrite_mcp import (
        list_appwrite_documents,
        create_appwrite_document,
        update_appwrite_document
    )

    logger.info("=" * 60)
    logger.info("Seeding SQA Topic Taxonomy")
    logger.info("=" * 60)

    created = 0
    updated = 0
    parent_count = 0
    child_count = 0

    for topic_data in TOPIC_TAXONOMY:
        try:
            # Validate with Pydantic
            topic = Topic(**topic_data)

            # Check if topic exists
            existing = await list_appwrite_documents(
                database_id=DATABASE_ID,
                collection_id=TOPICS_COLLECTION,
                queries=[f'equal("slug", "{topic.slug}")'],
                mcp_config_path=mcp_config_path
            )

            doc_data = {
                "slug": topic.slug,
                "name": topic.name,
                "parent_slug": topic.parent_slug,
                "curriculum_ref": topic.curriculum_ref,
                "description": topic.description,
            }

            if existing and len(existing.get("documents", [])) > 0:
                # Update existing topic
                doc_id = existing["documents"][0]["$id"]
                await update_appwrite_document(
                    database_id=DATABASE_ID,
                    collection_id=TOPICS_COLLECTION,
                    document_id=doc_id,
                    data=doc_data,
                    mcp_config_path=mcp_config_path
                )
                logger.info(f"  ~ Updated: {topic.slug}")
                updated += 1
            else:
                # Create new topic
                await create_appwrite_document(
                    database_id=DATABASE_ID,
                    collection_id=TOPICS_COLLECTION,
                    data=doc_data,
                    mcp_config_path=mcp_config_path
                )
                logger.info(f"  + Created: {topic.slug}")
                created += 1

            # Count parent vs child topics
            if topic.parent_slug is None:
                parent_count += 1
            else:
                child_count += 1

        except Exception as e:
            logger.error(f"  ! Failed to seed topic '{topic_data.get('slug')}': {e}")
            raise

    summary = {
        "total": len(TOPIC_TAXONOMY),
        "created": created,
        "updated": updated,
        "parent_topics": parent_count,
        "child_topics": child_count,
    }

    logger.info("\n" + "=" * 60)
    logger.info("Topic Taxonomy Seeding Complete!")
    logger.info("=" * 60)
    logger.info(f"  Total topics: {summary['total']}")
    logger.info(f"  Created: {summary['created']}")
    logger.info(f"  Updated: {summary['updated']}")
    logger.info(f"  Parent topics: {summary['parent_topics']}")
    logger.info(f"  Child topics: {summary['child_topics']}")

    return summary


async def list_topics(mcp_config_path: str) -> List[Dict[str, Any]]:
    """List all topics in the database.

    Args:
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        List of topic documents
    """
    from src.utils.appwrite_mcp import list_appwrite_documents

    result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=TOPICS_COLLECTION,
        queries=[],
        mcp_config_path=mcp_config_path
    )

    return result.get("documents", [])


async def get_topics_by_parent(
    parent_slug: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Get all child topics for a parent topic.

    Args:
        parent_slug: Parent topic slug (e.g., "algebra")
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        List of child topic documents
    """
    from src.utils.appwrite_mcp import list_appwrite_documents

    result = await list_appwrite_documents(
        database_id=DATABASE_ID,
        collection_id=TOPICS_COLLECTION,
        queries=[f'equal("parent_slug", "{parent_slug}")'],
        mcp_config_path=mcp_config_path
    )

    return result.get("documents", [])


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Seed SQA topic taxonomy to Appwrite database"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to .mcp.json configuration file (default: .mcp.json)"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List existing topics instead of seeding"
    )
    parser.add_argument(
        "--parent",
        type=str,
        help="List child topics for a specific parent slug"
    )

    args = parser.parse_args()

    mcp_config_path = Path(args.mcp_config)
    if not mcp_config_path.exists():
        logger.error(f"! MCP config file not found: {mcp_config_path}")
        sys.exit(1)

    try:
        if args.list:
            topics = await list_topics(str(mcp_config_path))
            logger.info(f"\nFound {len(topics)} topics in database:")
            for topic in topics:
                parent = f" (parent: {topic['parent_slug']})" if topic.get('parent_slug') else " (root)"
                logger.info(f"  - {topic['slug']}: {topic['name']}{parent}")
        elif args.parent:
            topics = await get_topics_by_parent(args.parent, str(mcp_config_path))
            logger.info(f"\nChild topics for '{args.parent}':")
            for topic in topics:
                logger.info(f"  - {topic['slug']}: {topic['name']}")
        else:
            await seed_topics(str(mcp_config_path))

    except Exception as e:
        logger.error(f"\n! Operation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
