#!/usr/bin/env python3
"""Patch existing walkthroughs to add diagram_refs from source papers.

This script reads diagram data from us_papers and adds the diagram references
to the walkthrough_content field in us_walkthroughs. It does NOT regenerate
walkthroughs - only adds diagram_refs to existing content.

Usage:
    python scripts/patch_walkthrough_diagrams.py [--dry-run]
"""

import argparse
import asyncio
import base64
import gzip
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DATABASE_ID = 'sqa_education'
PAPERS_COLLECTION = 'us_papers'
WALKTHROUGHS_COLLECTION = 'us_walkthroughs'


def get_appwrite_client() -> tuple[Client, Databases]:
    """Initialize Appwrite client from MCP config.

    Returns:
        Tuple of (Client, Databases service)
    """
    config_path = Path(__file__).parent.parent / ".mcp.json"

    if not config_path.exists():
        raise FileNotFoundError(f"MCP config not found: {config_path}")

    with open(config_path) as f:
        config = json.load(f)

    appwrite_config = config["mcpServers"]["appwrite"]
    args = appwrite_config["args"]

    endpoint = None
    project_id = None
    api_key = None

    for arg in args:
        if arg.startswith("APPWRITE_ENDPOINT="):
            endpoint = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_PROJECT_ID="):
            project_id = arg.split("=", 1)[1]
        elif arg.startswith("APPWRITE_API_KEY="):
            api_key = arg.split("=", 1)[1]

    if not all([endpoint, project_id, api_key]):
        raise ValueError("Missing Appwrite credentials in MCP config")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    return client, Databases(client)


def decompress_walkthrough(compressed: str) -> Dict[str, Any]:
    """Decompress base64+gzip walkthrough content.

    Args:
        compressed: Base64-encoded gzip-compressed JSON string

    Returns:
        Parsed walkthrough dictionary
    """
    decoded = base64.b64decode(compressed.encode('ascii'))
    decompressed = gzip.decompress(decoded)
    return json.loads(decompressed.decode('utf-8'))


def compress_walkthrough(walkthrough: Dict[str, Any]) -> str:
    """Compress walkthrough to base64+gzip.

    Args:
        walkthrough: Walkthrough dictionary

    Returns:
        Base64-encoded gzip-compressed string
    """
    json_bytes = json.dumps(walkthrough, ensure_ascii=False).encode('utf-8')
    compressed = gzip.compress(json_bytes)
    return base64.b64encode(compressed).decode('ascii')


def find_question_diagrams(
    questions: List[Dict[str, Any]],
    question_number: str
) -> List[Dict[str, Any]]:
    """Find diagrams for a question, handling parts correctly.

    Parts inherit diagrams from their parent question.

    Args:
        questions: List of questions from paper data
        question_number: Question number to find (e.g., "1", "4a", "5b(i)")

    Returns:
        List of diagram objects for the question
    """
    for q in questions:
        q_num = str(q.get('number', ''))

        # Direct match on question number
        if q_num == question_number:
            return q.get('diagrams', [])

        # Check parts (e.g., "4a", "5b(i)")
        if q.get('has_parts') and q.get('parts'):
            parent_diagrams = q.get('diagrams', [])

            for part in q['parts']:
                part_label = part.get('part_label', '')
                part_number = f"{q_num}{part_label}"

                if part_number == question_number:
                    # Parts inherit parent diagrams
                    # Also check if part has its own diagrams
                    part_diagrams = part.get('diagrams', [])
                    return parent_diagrams + part_diagrams if part_diagrams else parent_diagrams

    return []


async def patch_walkthrough_diagrams(dry_run: bool = False):
    """Patch all walkthroughs to add diagram_refs from source papers.

    Args:
        dry_run: If True, only log what would be done without making changes
    """
    logger.info("Initializing Appwrite client...")
    client, databases = get_appwrite_client()

    # Fetch all walkthroughs
    logger.info("Fetching walkthroughs from us_walkthroughs...")
    walkthroughs_result = databases.list_documents(
        DATABASE_ID,
        WALKTHROUGHS_COLLECTION,
        [Query.limit(200)]  # Adjust if more walkthroughs exist
    )
    walkthroughs = walkthroughs_result['documents']
    logger.info(f"Found {len(walkthroughs)} walkthroughs")

    # Fetch all papers and cache by ID
    logger.info("Fetching papers from us_papers...")
    papers_result = databases.list_documents(
        DATABASE_ID,
        PAPERS_COLLECTION,
        [Query.limit(100)]
    )

    papers_cache: Dict[str, Dict[str, Any]] = {}
    for paper in papers_result['documents']:
        paper_id = paper['$id']
        try:
            paper_data = json.loads(paper['data'])
            papers_cache[paper_id] = paper_data
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse paper data for {paper_id}: {e}")

    logger.info(f"Cached {len(papers_cache)} papers")

    # Track statistics
    stats = {
        'total': len(walkthroughs),
        'patched': 0,
        'skipped_no_diagrams': 0,
        'skipped_paper_not_found': 0,
        'errors': 0
    }

    for wt in walkthroughs:
        doc_id = wt['$id']
        paper_id = wt.get('paper_id', '')
        question_number = wt.get('question_number', '')

        logger.info(f"Processing: {paper_id} Q{question_number}")

        # Get source paper
        paper_data = papers_cache.get(paper_id)
        if not paper_data:
            logger.warning(f"  ⚠️ Paper not found: {paper_id}")
            stats['skipped_paper_not_found'] += 1
            continue

        # Find question diagrams
        diagrams = find_question_diagrams(
            paper_data.get('questions', []),
            question_number
        )

        if not diagrams:
            logger.info(f"  ⏭️ No diagrams for Q{question_number}")
            stats['skipped_no_diagrams'] += 1
            continue

        try:
            # Decompress walkthrough content
            compressed = wt.get('walkthrough_content', '')
            if not compressed:
                logger.warning(f"  ⚠️ No walkthrough_content found")
                stats['errors'] += 1
                continue

            walkthrough = decompress_walkthrough(compressed)

            # Extract diagram IDs (or full diagram objects if needed)
            # Using full objects so frontend has access to file_url and description
            diagram_refs = [d.get('id', '') for d in diagrams if d.get('id')]

            # Check if already patched
            existing_refs = walkthrough.get('diagram_refs', [])
            if existing_refs and set(existing_refs) == set(diagram_refs):
                logger.info(f"  ✓ Already has correct diagram_refs, skipping")
                stats['skipped_no_diagrams'] += 1
                continue

            # Add diagram_refs
            walkthrough['diagram_refs'] = diagram_refs

            if dry_run:
                logger.info(f"  🔍 [DRY RUN] Would add {len(diagram_refs)} diagram refs: {diagram_refs}")
                stats['patched'] += 1
            else:
                # Recompress
                new_content = compress_walkthrough(walkthrough)

                # Update document
                databases.update_document(
                    DATABASE_ID,
                    WALKTHROUGHS_COLLECTION,
                    doc_id,
                    {'walkthrough_content': new_content}
                )

                logger.info(f"  ✅ Patched with {len(diagram_refs)} diagram refs: {diagram_refs}")
                stats['patched'] += 1

        except Exception as e:
            logger.error(f"  ❌ Error processing: {e}")
            stats['errors'] += 1

    # Print summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("PATCH SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total walkthroughs:      {stats['total']}")
    logger.info(f"Patched with diagrams:   {stats['patched']}")
    logger.info(f"Skipped (no diagrams):   {stats['skipped_no_diagrams']}")
    logger.info(f"Skipped (paper missing): {stats['skipped_paper_not_found']}")
    logger.info(f"Errors:                  {stats['errors']}")

    if dry_run:
        logger.info("")
        logger.info("This was a DRY RUN - no changes were made.")
        logger.info("Run without --dry-run to apply changes.")


def main():
    parser = argparse.ArgumentParser(
        description='Patch walkthrough diagram_refs from source papers'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )

    args = parser.parse_args()

    asyncio.run(patch_walkthrough_diagrams(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
