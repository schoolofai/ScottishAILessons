#!/usr/bin/env python3
"""Migrate lesson template outcomeRefs from codes to document IDs.

This script updates existing lesson templates to use course_outcomes document IDs
instead of outcome codes in the outcomeRefs field.

Usage:
    python migrate_lesson_outcome_refs.py <lesson_template_id> [--dry-run]
    python migrate_lesson_outcome_refs.py <lesson_template_id> --mcp-config /path/to/.mcp.json

Examples:
    # Dry run (preview changes without updating)
    python migrate_lesson_outcome_refs.py "67890abcdef" --dry-run

    # Actual migration
    python migrate_lesson_outcome_refs.py "67890abcdef"

    # Custom MCP config path
    python migrate_lesson_outcome_refs.py "67890abcdef" --mcp-config "../.mcp.json"
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.appwrite_mcp import (
    get_appwrite_document,
    list_appwrite_documents,
    update_appwrite_document
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def map_outcome_codes_to_doc_ids_safe(
    outcome_codes: List[str],
    course_id: str,
    mcp_config_path: str
) -> Dict[str, Optional[str]]:
    """Map outcome codes to document IDs, returning None for unfound codes.

    Unlike the strict version used during authoring, this function does NOT
    throw errors when a code is not found. Instead, it returns None for that
    code, allowing the migration to proceed gracefully.

    Args:
        outcome_codes: List of outcome codes (e.g., ['O1', 'O2'])
        course_id: Course ID (e.g., 'course_c84473')
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Dictionary mapping codes to document IDs (or None if not found)
        Example: {"O1": "70a1b2c3d4e5f6g7h8i9", "O2": None}
    """
    logger.info(f"Mapping {len(outcome_codes)} outcome codes to document IDs")

    code_to_id_map = {}

    for outcome_code in outcome_codes:
        logger.info(f"  Looking up outcome: {outcome_code}")

        # Query exactly as provided - NO normalization
        result = await list_appwrite_documents(
            database_id="default",
            collection_id="course_outcomes",
            queries=[
                f'equal("courseId", "{course_id}")',
                f'equal("outcomeId", "{outcome_code}")'
            ],
            mcp_config_path=mcp_config_path
        )

        if not result:
            logger.warning(f"  ⚠️  Outcome '{outcome_code}' not found for course '{course_id}'")
            logger.warning(f"     This code will be LEFT AS-IS (not migrated)")
            code_to_id_map[outcome_code] = None
        else:
            doc_id = result[0]["$id"]
            code_to_id_map[outcome_code] = doc_id
            logger.info(f"  ✓ Mapped {outcome_code} → {doc_id}")

    return code_to_id_map


async def migrate_lesson_outcome_refs(
    lesson_template_id: str,
    mcp_config_path: str,
    dry_run: bool = False
) -> bool:
    """Migrate a single lesson template's outcomeRefs from codes to document IDs.

    Args:
        lesson_template_id: Lesson template document ID
        mcp_config_path: Path to .mcp.json configuration
        dry_run: If True, show changes without updating the document

    Returns:
        True if migration succeeded (or would succeed in dry-run), False otherwise
    """
    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Starting migration for lesson: {lesson_template_id}")

    # Step 1: Fetch lesson template
    logger.info("Step 1: Fetching lesson template...")
    lesson_template = await get_appwrite_document(
        database_id="default",
        collection_id="lesson_templates",
        document_id=lesson_template_id,
        mcp_config_path=mcp_config_path
    )

    if not lesson_template:
        logger.error(f"❌ Lesson template not found: {lesson_template_id}")
        return False

    logger.info(f"✓ Found lesson template: {lesson_template.get('title', 'Untitled')}")

    # Step 2: Extract courseId and outcomeRefs
    course_id = lesson_template.get('courseId')
    outcome_refs_str = lesson_template.get('outcomeRefs', '[]')

    if not course_id:
        logger.error("❌ Lesson template missing courseId field")
        return False

    logger.info(f"  Course ID: {course_id}")

    # Parse outcomeRefs (it's stored as JSON string)
    try:
        outcome_refs = json.loads(outcome_refs_str)
    except json.JSONDecodeError:
        logger.error(f"❌ Failed to parse outcomeRefs: {outcome_refs_str}")
        return False

    if not outcome_refs:
        logger.info("ℹ️  No outcomeRefs to migrate (empty array)")
        return True

    logger.info(f"  Current outcomeRefs: {outcome_refs}")

    # Step 3: Check if already migrated
    # If the first ref looks like a document ID (long string), assume already migrated
    if outcome_refs and len(outcome_refs[0]) > 20:
        logger.info("ℹ️  OutcomeRefs appear to already be document IDs (not codes)")
        logger.info("   Skipping migration")
        return True

    # Step 4: Map codes to document IDs
    logger.info("Step 2: Mapping outcome codes to document IDs...")
    code_to_id_map = await map_outcome_codes_to_doc_ids_safe(
        outcome_codes=outcome_refs,
        course_id=course_id,
        mcp_config_path=mcp_config_path
    )

    # Step 5: Build new outcomeRefs array
    new_outcome_refs = []
    codes_migrated = []
    codes_not_found = []

    for code in outcome_refs:
        doc_id = code_to_id_map.get(code)
        if doc_id:
            new_outcome_refs.append(doc_id)
            codes_migrated.append(f"{code} → {doc_id}")
        else:
            new_outcome_refs.append(code)  # Keep code as-is
            codes_not_found.append(code)

    # Step 6: Show summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("MIGRATION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Lesson Template ID: {lesson_template_id}")
    logger.info(f"Title: {lesson_template.get('title', 'Untitled')}")
    logger.info(f"Course ID: {course_id}")
    logger.info("")
    logger.info(f"Total outcome refs: {len(outcome_refs)}")
    logger.info(f"Successfully mapped: {len(codes_migrated)}")
    logger.info(f"Not found (kept as-is): {len(codes_not_found)}")
    logger.info("")

    if codes_migrated:
        logger.info("Mapped codes:")
        for mapping in codes_migrated:
            logger.info(f"  ✓ {mapping}")
        logger.info("")

    if codes_not_found:
        logger.info("Codes not found (left unchanged):")
        for code in codes_not_found:
            logger.info(f"  ⚠️  {code}")
        logger.info("")

    logger.info("BEFORE:")
    logger.info(f"  outcomeRefs: {json.dumps(outcome_refs, indent=2)}")
    logger.info("")
    logger.info("AFTER:")
    logger.info(f"  outcomeRefs: {json.dumps(new_outcome_refs, indent=2)}")
    logger.info("=" * 80)
    logger.info("")

    # Step 7: Update document (unless dry-run)
    if dry_run:
        logger.info("🔍 DRY RUN MODE: No changes were made")
        logger.info("   Run without --dry-run to apply changes")
        return True

    if not codes_migrated:
        logger.info("ℹ️  No codes were successfully mapped - skipping update")
        return True

    logger.info("Step 3: Updating lesson template...")
    try:
        await update_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            document_id=lesson_template_id,
            data={"outcomeRefs": json.dumps(new_outcome_refs)},
            mcp_config_path=mcp_config_path
        )
        logger.info(f"✅ Successfully migrated lesson template: {lesson_template_id}")
        logger.info(f"   Mapped {len(codes_migrated)} outcome codes to document IDs")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to update lesson template: {e}")
        return False


async def main():
    parser = argparse.ArgumentParser(
        description="Migrate lesson template outcomeRefs from codes to document IDs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        'lesson_template_id',
        help='Lesson template document ID to migrate'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without updating the document'
    )
    parser.add_argument(
        '--mcp-config',
        default='.mcp.json',
        help='Path to MCP config file (default: .mcp.json)'
    )

    args = parser.parse_args()

    # Validate MCP config exists
    mcp_config_path = Path(args.mcp_config)
    if not mcp_config_path.exists():
        logger.error(f"❌ MCP config not found: {args.mcp_config}")
        logger.error("   Please provide a valid path with --mcp-config")
        sys.exit(1)

    # Run migration
    success = await migrate_lesson_outcome_refs(
        lesson_template_id=args.lesson_template_id,
        mcp_config_path=str(mcp_config_path),
        dry_run=args.dry_run
    )

    if success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
