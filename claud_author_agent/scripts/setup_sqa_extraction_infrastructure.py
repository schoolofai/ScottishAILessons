#!/usr/bin/env python3
"""One-time Appwrite infrastructure setup for SQA Document Extraction.

Creates all collections, attributes, indexes, and storage buckets required
for the SQA National 5 Mathematics document extraction system.

Based on design specification: docs/claud_author_agent/understanding_standards.md

Usage:
    python setup_sqa_extraction_infrastructure.py --mcp-config .mcp.json

Collections created:
    - papers: Exam paper metadata
    - formulae: Formula sheets by topic
    - questions: Question stems
    - question_parts: Question sub-parts (a, b, i, ii)
    - diagrams: Diagram references and render configs
    - marking_schemes: Marking scheme metadata
    - general_marking_principles: General marking rules
    - solutions: Per-question solutions
    - generic_scheme: Generic marking bullets
    - illustrative_scheme: Illustrative marking bullets
    - commonly_observed_responses: COR examples (Phase 2)
    - topics: Topic taxonomy reference data

Storage buckets created:
    - source-pdfs: Original SQA PDF documents
    - sqa-diagrams: Extracted diagrams and graphs
    - render-configs: JSXGraph/Desmos configuration files
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.appwrite_infrastructure import (
    create_appwrite_collection,
    create_appwrite_string_attribute,
    create_appwrite_integer_attribute,
    create_appwrite_boolean_attribute,
    create_appwrite_datetime_attribute,
    create_appwrite_url_attribute,
    create_appwrite_index,
    create_appwrite_bucket
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DATABASE_ID = "default"


# =============================================================================
# Attribute Definitions
# =============================================================================

def get_papers_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for papers collection."""
    return [
        ("code", "string", {"size": 20, "required": True}),
        ("year", "integer", {"required": True, "min_value": 2014, "max_value": 2030}),
        ("level", "string", {"size": 10, "required": True}),
        ("level_name", "string", {"size": 50, "required": True}),
        ("subject", "string", {"size": 50, "required": True}),
        ("paper_number", "integer", {"required": True, "min_value": 1, "max_value": 3}),
        ("calculator_allowed", "boolean", {"required": True}),
        ("exam_date", "datetime", {"required": False}),
        ("duration_minutes", "integer", {"required": True, "min_value": 30, "max_value": 180}),
        ("total_marks", "integer", {"required": True, "min_value": 1, "max_value": 150}),
        ("source_url", "url", {"required": False}),
        ("source_file_id", "string", {"size": 36, "required": False}),
    ]


def get_formulae_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for formulae collection."""
    return [
        ("paper_id", "string", {"size": 36, "required": True}),
        ("topic", "string", {"size": 100, "required": True}),
        ("formulas", "string", {"size": 65535, "required": True, "array": True}),
        ("formulas_latex", "string", {"size": 65535, "required": False, "array": True}),
        ("sort_order", "integer", {"required": True}),
    ]


def get_questions_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for questions collection."""
    return [
        ("paper_id", "string", {"size": 36, "required": True}),
        ("number", "string", {"size": 10, "required": True}),
        ("text", "string", {"size": 16777216, "required": True}),
        ("text_latex", "string", {"size": 16777216, "required": False}),
        ("marks", "integer", {"required": False, "min_value": 1, "max_value": 20}),
        ("has_parts", "boolean", {"required": True, "default": False}),
        ("topic_tags", "string", {"size": 50, "required": False, "array": True}),
        ("diagram_ids", "string", {"size": 36, "required": False, "array": True}),
    ]


def get_question_parts_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for question_parts collection."""
    return [
        ("question_id", "string", {"size": 36, "required": True}),
        ("part", "string", {"size": 5, "required": True}),
        ("subpart", "string", {"size": 5, "required": False}),
        ("text", "string", {"size": 16777216, "required": True}),
        ("text_latex", "string", {"size": 16777216, "required": False}),
        ("marks", "integer", {"required": True, "min_value": 1, "max_value": 10}),
        ("topic_tags", "string", {"size": 50, "required": False, "array": True}),
        ("sort_order", "integer", {"required": True}),
    ]


def get_diagrams_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for diagrams collection."""
    return [
        ("question_id", "string", {"size": 36, "required": True}),
        ("filename", "string", {"size": 100, "required": True}),
        ("type", "string", {"size": 30, "required": True}),
        ("description", "string", {"size": 500, "required": False}),
        ("file_id", "string", {"size": 36, "required": False}),
        ("render_type", "string", {"size": 30, "required": False}),
        ("render_config_file_id", "string", {"size": 36, "required": False}),
    ]


def get_marking_schemes_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for marking_schemes collection."""
    return [
        ("paper_id", "string", {"size": 36, "required": True}),
        ("source_url", "url", {"required": False}),
        ("source_file_id", "string", {"size": 36, "required": False}),
    ]


def get_general_marking_principles_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for general_marking_principles collection."""
    return [
        ("marking_scheme_id", "string", {"size": 36, "required": True}),
        ("principle_id", "string", {"size": 5, "required": True}),
        ("principle", "string", {"size": 50, "required": True}),
        ("description", "string", {"size": 2000, "required": True}),
        ("exceptions", "string", {"size": 200, "required": False, "array": True}),
        ("sort_order", "integer", {"required": True}),
    ]


def get_solutions_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for solutions collection."""
    return [
        ("marking_scheme_id", "string", {"size": 36, "required": True}),
        ("question_id", "string", {"size": 36, "required": True}),
        ("part_id", "string", {"size": 36, "required": False}),
        ("max_marks", "integer", {"required": True, "min_value": 1, "max_value": 20}),
        ("notes", "string", {"size": 1000, "required": False, "array": True}),
    ]


def get_generic_scheme_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for generic_scheme collection."""
    return [
        ("solution_id", "string", {"size": 36, "required": True}),
        ("bullet", "integer", {"required": True, "min_value": 1, "max_value": 20}),
        ("process", "string", {"size": 500, "required": True}),
        ("sort_order", "integer", {"required": True}),
    ]


def get_illustrative_scheme_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for illustrative_scheme collection."""
    return [
        ("solution_id", "string", {"size": 36, "required": True}),
        ("bullet", "integer", {"required": True, "min_value": 1, "max_value": 20}),
        ("answer", "string", {"size": 1000, "required": True}),
        ("answer_latex", "string", {"size": 1000, "required": False}),
        ("condition", "string", {"size": 300, "required": False}),
        ("alternative", "string", {"size": 500, "required": False}),
        ("alternative_latex", "string", {"size": 500, "required": False}),
        ("sort_order", "integer", {"required": True}),
    ]


def get_commonly_observed_responses_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for commonly_observed_responses collection (Phase 2)."""
    return [
        ("solution_id", "string", {"size": 36, "required": True}),
        ("candidate_id", "string", {"size": 5, "required": True}),
        ("scenario", "string", {"size": 300, "required": True}),
        ("working", "string", {"size": 16777216, "required": True}),
        ("working_latex", "string", {"size": 16777216, "required": False}),
        ("marks_awarded", "string", {"size": 20, "required": True, "array": True}),
        ("sort_order", "integer", {"required": True}),
    ]


def get_topics_attributes() -> List[Tuple[str, str, Dict[str, Any]]]:
    """Get attribute definitions for topics collection."""
    return [
        ("slug", "string", {"size": 50, "required": True}),
        ("name", "string", {"size": 100, "required": True}),
        ("parent_slug", "string", {"size": 50, "required": False}),
        ("curriculum_ref", "string", {"size": 50, "required": False}),
        ("description", "string", {"size": 500, "required": False}),
    ]


# =============================================================================
# Index Definitions
# =============================================================================

def get_papers_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for papers collection."""
    return [
        {"key": "code_unique", "type": "unique", "attributes": ["code"]},
        {"key": "year_level_paper", "type": "key", "attributes": ["year", "level", "paper_number"]},
        {"key": "level_idx", "type": "key", "attributes": ["level"]},
    ]


def get_formulae_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for formulae collection."""
    return [
        {"key": "paper_id_idx", "type": "key", "attributes": ["paper_id"]},
    ]


def get_questions_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for questions collection."""
    return [
        {"key": "paper_id_idx", "type": "key", "attributes": ["paper_id"]},
        {"key": "paper_number_idx", "type": "key", "attributes": ["paper_id", "number"]},
    ]


def get_question_parts_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for question_parts collection."""
    return [
        {"key": "question_id_idx", "type": "key", "attributes": ["question_id"]},
        {"key": "sort_idx", "type": "key", "attributes": ["question_id", "sort_order"]},
    ]


def get_diagrams_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for diagrams collection."""
    return [
        {"key": "question_id_idx", "type": "key", "attributes": ["question_id"]},
    ]


def get_marking_schemes_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for marking_schemes collection."""
    return [
        {"key": "paper_id_unique", "type": "unique", "attributes": ["paper_id"]},
    ]


def get_general_marking_principles_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for general_marking_principles collection."""
    return [
        {"key": "marking_scheme_id_idx", "type": "key", "attributes": ["marking_scheme_id"]},
    ]


def get_solutions_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for solutions collection."""
    return [
        {"key": "question_id_idx", "type": "key", "attributes": ["question_id"]},
        {"key": "part_id_idx", "type": "key", "attributes": ["part_id"]},
        {"key": "marking_scheme_id_idx", "type": "key", "attributes": ["marking_scheme_id"]},
    ]


def get_generic_scheme_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for generic_scheme collection."""
    return [
        {"key": "solution_id_idx", "type": "key", "attributes": ["solution_id"]},
    ]


def get_illustrative_scheme_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for illustrative_scheme collection."""
    return [
        {"key": "solution_id_idx", "type": "key", "attributes": ["solution_id"]},
    ]


def get_commonly_observed_responses_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for commonly_observed_responses collection."""
    return [
        {"key": "solution_id_idx", "type": "key", "attributes": ["solution_id"]},
    ]


def get_topics_indexes() -> List[Dict[str, Any]]:
    """Get index definitions for topics collection."""
    return [
        {"key": "slug_unique", "type": "unique", "attributes": ["slug"]},
        {"key": "parent_idx", "type": "key", "attributes": ["parent_slug"]},
    ]


# =============================================================================
# Collection Setup Functions
# =============================================================================

async def create_attribute(
    database_id: str,
    collection_id: str,
    key: str,
    attr_type: str,
    params: Dict[str, Any],
    mcp_config_path: str
) -> None:
    """Create a single attribute with proper type handling."""
    try:
        # Handle array attributes - need to pass array=True to string attributes
        is_array = params.pop("array", False)

        if attr_type == "string":
            # For array strings, we need to use a different approach
            if is_array:
                from src.utils.appwrite_infrastructure import _get_appwrite_client
                from appwrite.services.databases import Databases

                client, _, _, _ = _get_appwrite_client(mcp_config_path)
                databases = Databases(client)

                databases.create_string_attribute(
                    database_id=database_id,
                    collection_id=collection_id,
                    key=key,
                    size=params.get("size", 255),
                    required=params.get("required", False),
                    default=params.get("default"),
                    array=True
                )
            else:
                await create_appwrite_string_attribute(
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
        elif attr_type == "boolean":
            await create_appwrite_boolean_attribute(
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
        elif attr_type == "url":
            await create_appwrite_url_attribute(
                database_id=database_id,
                collection_id=collection_id,
                key=key,
                mcp_config_path=mcp_config_path,
                **params
            )
        else:
            logger.warning(f"Unknown attribute type: {attr_type}")

        logger.info(f"  + {key} ({attr_type}{'[]' if is_array else ''})")
        await asyncio.sleep(0.5)

    except Exception as e:
        if "already exists" in str(e).lower():
            logger.warning(f"  ~ {key} already exists, skipping")
        else:
            logger.error(f"  ! Failed to create {key}: {e}")
            raise


async def create_collection_with_schema(
    collection_id: str,
    name: str,
    attributes: List[Tuple[str, str, Dict[str, Any]]],
    indexes: List[Dict[str, Any]],
    mcp_config_path: str
) -> None:
    """Create a collection with all its attributes and indexes."""
    logger.info(f"\n{'='*60}")
    logger.info(f"Creating collection: {name} ({collection_id})")
    logger.info(f"{'='*60}")

    # Step 1: Create collection
    try:
        await create_appwrite_collection(
            database_id=DATABASE_ID,
            collection_id=collection_id,
            name=name,
            mcp_config_path=mcp_config_path,
            permissions=["read(\"any\")"],
            document_security=True
        )
        logger.info("+ Collection created")
    except Exception as e:
        if "already exists" in str(e).lower():
            logger.warning("~ Collection already exists, continuing with attributes")
        else:
            logger.error(f"! Failed to create collection: {e}")
            raise

    # Step 2: Create attributes
    logger.info("\nCreating attributes:")
    for key, attr_type, params in attributes:
        await create_attribute(
            DATABASE_ID, collection_id, key, attr_type, params.copy(), mcp_config_path
        )

    # Step 3: Wait for attributes to be available
    logger.info("\nWaiting for attributes to be available...")
    await asyncio.sleep(2)

    # Step 4: Create indexes
    logger.info("\nCreating indexes:")
    for index in indexes:
        try:
            await create_appwrite_index(
                database_id=DATABASE_ID,
                collection_id=collection_id,
                key=index["key"],
                index_type=index["type"],
                attributes=index["attributes"],
                mcp_config_path=mcp_config_path
            )
            logger.info(f"  + {index['key']} ({index['type']})")
            await asyncio.sleep(0.5)
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"  ~ {index['key']} already exists, skipping")
            else:
                logger.error(f"  ! Failed to create index {index['key']}: {e}")
                raise

    logger.info(f"\n+ {name} collection setup complete")


async def create_storage_buckets(mcp_config_path: str) -> None:
    """Create all required storage buckets."""
    logger.info(f"\n{'='*60}")
    logger.info("Creating Storage Buckets")
    logger.info(f"{'='*60}")

    buckets = [
        {
            "id": "source-pdfs",
            "name": "Source PDFs",
            "max_size": 50 * 1024 * 1024,  # 50 MB
            "extensions": [".pdf"],
        },
        {
            "id": "sqa-diagrams",
            "name": "SQA Diagrams",
            "max_size": 5 * 1024 * 1024,  # 5 MB
            "extensions": [".svg", ".png", ".jpg", ".jpeg"],
        },
        {
            "id": "render-configs",
            "name": "Render Configs",
            "max_size": 1 * 1024 * 1024,  # 1 MB
            "extensions": [".json"],
        },
    ]

    for bucket in buckets:
        try:
            await create_appwrite_bucket(
                bucket_id=bucket["id"],
                name=bucket["name"],
                mcp_config_path=mcp_config_path,
                permissions=["read(\"any\")"],
                file_security=True,
                enabled=True,
                maximum_file_size=bucket["max_size"],
                allowed_file_extensions=bucket["extensions"],
                compression="none",
                encryption=True,
                antivirus=True
            )
            logger.info(f"+ Created bucket: {bucket['id']}")
        except Exception as e:
            if "already exists" in str(e).lower():
                logger.warning(f"~ Bucket {bucket['id']} already exists, skipping")
            else:
                logger.error(f"! Failed to create bucket {bucket['id']}: {e}")
                raise


# =============================================================================
# Main Setup Function
# =============================================================================

async def setup_all_collections(mcp_config_path: str) -> None:
    """Create all SQA extraction collections."""

    collections = [
        ("sqa_papers", "SQA Papers", get_papers_attributes(), get_papers_indexes()),
        ("sqa_formulae", "SQA Formulae", get_formulae_attributes(), get_formulae_indexes()),
        ("sqa_questions", "SQA Questions", get_questions_attributes(), get_questions_indexes()),
        ("sqa_question_parts", "SQA Question Parts", get_question_parts_attributes(), get_question_parts_indexes()),
        ("sqa_diagrams", "SQA Diagrams", get_diagrams_attributes(), get_diagrams_indexes()),
        ("sqa_marking_schemes", "SQA Marking Schemes", get_marking_schemes_attributes(), get_marking_schemes_indexes()),
        ("sqa_general_principles", "SQA General Principles", get_general_marking_principles_attributes(), get_general_marking_principles_indexes()),
        ("sqa_solutions", "SQA Solutions", get_solutions_attributes(), get_solutions_indexes()),
        ("sqa_generic_scheme", "SQA Generic Scheme", get_generic_scheme_attributes(), get_generic_scheme_indexes()),
        ("sqa_illustrative_scheme", "SQA Illustrative Scheme", get_illustrative_scheme_attributes(), get_illustrative_scheme_indexes()),
        ("sqa_cor", "SQA Commonly Observed Responses", get_commonly_observed_responses_attributes(), get_commonly_observed_responses_indexes()),
        ("sqa_topics", "SQA Topics", get_topics_attributes(), get_topics_indexes()),
    ]

    for collection_id, name, attributes, indexes in collections:
        await create_collection_with_schema(
            collection_id=collection_id,
            name=name,
            attributes=attributes,
            indexes=indexes,
            mcp_config_path=mcp_config_path
        )


async def main():
    """Main entry point for infrastructure setup."""
    parser = argparse.ArgumentParser(
        description="Setup Appwrite infrastructure for SQA Document Extraction"
    )
    parser.add_argument(
        "--mcp-config",
        default=".mcp.json",
        help="Path to .mcp.json configuration file (default: .mcp.json)"
    )
    parser.add_argument(
        "--collections-only",
        action="store_true",
        help="Only create collections, skip storage buckets"
    )
    parser.add_argument(
        "--buckets-only",
        action="store_true",
        help="Only create storage buckets, skip collections"
    )

    args = parser.parse_args()

    mcp_config_path = Path(args.mcp_config)
    if not mcp_config_path.exists():
        logger.error(f"! MCP config file not found: {mcp_config_path}")
        sys.exit(1)

    logger.info("\n" + "="*60)
    logger.info("SQA Document Extraction - Infrastructure Setup")
    logger.info("="*60)
    logger.info(f"Using MCP config: {mcp_config_path}")

    try:
        if not args.buckets_only:
            await setup_all_collections(str(mcp_config_path))

        if not args.collections_only:
            await create_storage_buckets(str(mcp_config_path))

        logger.info("\n" + "="*60)
        logger.info("Setup Complete!")
        logger.info("="*60)
        logger.info("\nCreated:")
        logger.info("  - 12 collections for SQA document data")
        logger.info("  - 3 storage buckets for PDFs and diagrams")
        logger.info("\nNext steps:")
        logger.info("  1. Run seed_sqa_topics.py to populate topic taxonomy")
        logger.info("  2. Upload SQA PDFs to source-pdfs bucket")
        logger.info("  3. Run extraction agents on uploaded PDFs")

    except Exception as e:
        logger.error(f"\n! Infrastructure setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
