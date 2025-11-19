#!/usr/bin/env python3
"""
Migration Script: MCQ Multi-Select Support

This script migrates existing lesson templates to support multi-select MCQ questions.
It identifies MCQ questions that appear to be multi-select based on their stem content
and updates them with the new multiSelect and answerIndices fields.

Detection Heuristics:
- Stem contains "Select ALL" or "select all"
- Stem contains "Choose all that apply"
- Stem contains "Which of these" (plural indicator)
- Stem contains multiple "→" arrows (indicating multiple correct mappings)

Usage:
    python scripts/migrate_mcq_multiselect.py --dry-run  # Preview changes
    python scripts/migrate_mcq_multiselect.py --execute  # Apply changes
"""

import os
import sys
import json
import re
import logging
import argparse
import gzip
import base64
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.query import Query

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'migration_mcq_multiselect_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Multi-select detection patterns
MULTI_SELECT_PATTERNS = [
    r'select\s+all',
    r'choose\s+all\s+that\s+apply',
    r'which\s+of\s+these',
    r'tick\s+all',
    r'mark\s+all',
    r'identify\s+all',
]


def decompress_cards(data: str) -> List[Dict[str, Any]]:
    """
    Decompress gzip+base64 encoded cards.

    Handles:
    - Raw base64-encoded gzip (Python format)
    - Uncompressed JSON string (backward compatibility)

    Args:
        data: Compressed or uncompressed cards string

    Returns:
        List of card dictionaries
    """
    if not data or data.strip() == '':
        return []

    try:
        # Try raw base64-gzip decompression first (Python format)
        compressed = base64.b64decode(data)
        decompressed = gzip.decompress(compressed)
        return json.loads(decompressed.decode('utf-8'))
    except Exception as e:
        # Fallback: try parsing as uncompressed JSON
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            logger.error(f"Failed to decompress/parse cards: {e}")
            raise


def compress_cards(cards: List[Dict[str, Any]]) -> str:
    """
    Compress cards to gzip+base64 format (Python format - no prefix).

    Args:
        cards: List of card dictionaries

    Returns:
        Base64-encoded gzip string
    """
    json_str = json.dumps(cards)
    compressed = gzip.compress(json_str.encode('utf-8'))
    return base64.b64encode(compressed).decode('utf-8')


def detect_multi_select(stem: str, options: List[str]) -> Tuple[bool, str]:
    """
    Detect if an MCQ question appears to be multi-select based on heuristics.

    Args:
        stem: The question stem text
        options: List of answer options

    Returns:
        Tuple of (is_multi_select, reason)
    """
    stem_lower = stem.lower()

    # Check for explicit multi-select phrases
    for pattern in MULTI_SELECT_PATTERNS:
        if re.search(pattern, stem_lower):
            return True, f"Stem matches pattern: {pattern}"

    # Check for multiple arrows (→) indicating multiple mappings
    arrow_count = stem.count('→') + stem.count('->')
    if arrow_count >= 2:
        return True, f"Stem contains {arrow_count} mapping arrows"

    # Check options for multiple arrows
    options_with_arrows = sum(1 for opt in options if '→' in opt or '->' in opt)
    if options_with_arrows >= 2:
        return True, f"{options_with_arrows} options contain mapping arrows"

    return False, "No multi-select indicators found"


def infer_correct_indices(stem: str, options: List[str], current_index: int) -> List[int]:
    """
    Infer which options are correct for multi-select questions.

    This is a heuristic-based approach. For questions with mapping arrows,
    we try to identify correct mappings. Otherwise, we keep the original answer.

    Args:
        stem: The question stem
        options: List of answer options
        current_index: Current single answer index

    Returns:
        List of correct answer indices
    """
    # Default: keep the original answer
    correct_indices = [current_index]

    # For questions with arrows, try to identify correct mappings
    if '→' in stem or '->' in stem:
        # This would require domain knowledge to properly infer
        # For now, we mark as needing manual review
        logger.warning("Question with arrows needs manual review for correct indices")

    return correct_indices


def migrate_template(
    template: Dict[str, Any],
    dry_run: bool = True
) -> Tuple[bool, Dict[str, Any], List[str]]:
    """
    Migrate a single lesson template to support multi-select MCQs.

    Args:
        template: The lesson template document
        dry_run: If True, don't modify the template

    Returns:
        Tuple of (was_modified, modified_template, changes_made)
    """
    was_modified = False
    changes_made = []

    # Parse and decompress cards
    cards_data = template.get('cards', '')

    # Handle already-parsed arrays (shouldn't happen but defensive)
    if isinstance(cards_data, list):
        cards = cards_data
    elif isinstance(cards_data, str):
        if not cards_data or cards_data.strip() == '':
            # Empty cards field - skip this template silently
            return False, template, []
        try:
            # Decompress gzip+base64 encoded cards
            cards = decompress_cards(cards_data)
            if not cards:
                return False, template, []
        except Exception as e:
            logger.error(f"Failed to decompress cards for template {template.get('$id')}: {e}")
            return False, template, ["ERROR: Failed to decompress cards"]
    else:
        logger.warning(f"Template {template.get('$id')} has unexpected cards type: {type(cards_data).__name__}")
        return False, template, []

    # Process each card
    for card in cards:
        cfu = card.get('cfu', {})

        # Only process MCQ type
        if cfu.get('type') != 'mcq':
            continue

        stem = cfu.get('stem', '')
        options = cfu.get('options', [])
        answer_index = cfu.get('answerIndex', 0)

        # Check if already migrated
        if 'multiSelect' in cfu:
            continue

        # Detect if this should be multi-select
        is_multi_select, reason = detect_multi_select(stem, options)

        if is_multi_select:
            # Infer correct indices
            correct_indices = infer_correct_indices(stem, options, answer_index)

            # Update CFU with new fields
            if not dry_run:
                cfu['multiSelect'] = True
                cfu['answerIndices'] = correct_indices

            change_msg = (
                f"Card {card.get('id')}: Converted to multi-select. "
                f"Reason: {reason}. "
                f"Indices: {correct_indices}"
            )
            changes_made.append(change_msg)
            was_modified = True

            logger.info(f"Template {template.get('$id')}: {change_msg}")
        else:
            # Add default multiSelect=False for backwards compatibility
            if not dry_run:
                cfu['multiSelect'] = False

            change_msg = f"Card {card.get('id')}: Added multiSelect=False (single-select)"
            changes_made.append(change_msg)
            was_modified = True

    # Update cards back to template (compressed)
    if not dry_run and was_modified:
        # Always compress back to gzip+base64 format
        template['cards'] = compress_cards(cards)

    return was_modified, template, changes_made


def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(description='Migrate MCQ questions to support multi-select')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    parser.add_argument('--execute', action='store_true', help='Apply changes to database')
    parser.add_argument('--template-id', type=str, help='Migrate specific template ID')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("ERROR: Must specify --dry-run or --execute")
        parser.print_help()
        sys.exit(1)

    dry_run = args.dry_run

    logger.info("=" * 60)
    logger.info("MCQ Multi-Select Migration Script")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    logger.info("=" * 60)

    # Initialize Appwrite client
    endpoint = os.environ.get('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1')
    project_id = os.environ.get('APPWRITE_PROJECT_ID')
    api_key = os.environ.get('APPWRITE_API_KEY')
    database_id = os.environ.get('APPWRITE_DATABASE_ID', 'default')

    if not project_id or not api_key:
        logger.error("Missing required environment variables: APPWRITE_PROJECT_ID, APPWRITE_API_KEY")
        sys.exit(1)

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)

    # Fetch templates
    logger.info("Fetching lesson templates...")

    queries = []
    if args.template_id:
        queries.append(Query.equal('$id', args.template_id))

    try:
        # Paginate through all templates
        all_templates = []
        offset = 0
        limit = 100

        while True:
            response = databases.list_documents(
                database_id=database_id,
                collection_id='lesson_templates',
                queries=queries + [Query.limit(limit), Query.offset(offset)]
            )

            templates = response['documents']
            all_templates.extend(templates)

            if len(templates) < limit:
                break
            offset += limit

        logger.info(f"Found {len(all_templates)} lesson templates")

    except Exception as e:
        logger.error(f"Failed to fetch templates: {e}")
        sys.exit(1)

    # Process templates
    total_modified = 0
    total_changes = 0
    migration_summary = []

    for template in all_templates:
        template_id = template.get('$id')
        template_title = template.get('title', 'Untitled')

        was_modified, modified_template, changes = migrate_template(template, dry_run)

        if changes:
            total_changes += len(changes)
            migration_summary.append({
                'template_id': template_id,
                'title': template_title,
                'changes': changes
            })

        if was_modified:
            total_modified += 1

            if not dry_run:
                try:
                    # Update template in database
                    databases.update_document(
                        database_id=database_id,
                        collection_id='lesson_templates',
                        document_id=template_id,
                        data={'cards': modified_template['cards']}
                    )
                    logger.info(f"✅ Updated template: {template_id}")
                except Exception as e:
                    logger.error(f"❌ Failed to update template {template_id}: {e}")

    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("MIGRATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total templates processed: {len(all_templates)}")
    logger.info(f"Templates modified: {total_modified}")
    logger.info(f"Total changes: {total_changes}")

    if migration_summary:
        logger.info("\nDetailed changes:")
        for item in migration_summary:
            logger.info(f"\n📄 {item['title']} ({item['template_id']}):")
            for change in item['changes']:
                logger.info(f"   - {change}")

    if dry_run:
        logger.info("\n⚠️  DRY RUN - No changes were applied to the database")
        logger.info("Run with --execute to apply changes")
    else:
        logger.info("\n✅ Migration completed successfully")


if __name__ == '__main__':
    main()
