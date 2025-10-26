#!/usr/bin/env python3
"""Bulk migrate lesson template outcomeRefs from codes to document IDs.

This script updates all lesson templates (or all lessons for a specific course)
to use course_outcomes document IDs instead of outcome codes in the outcomeRefs field.

Usage:
    # Migrate all lessons for a specific course
    python migrate_all_lesson_outcome_refs.py --course-id "course_c84473"

    # Migrate ALL lessons in the database
    python migrate_all_lesson_outcome_refs.py --all

    # Dry run (preview changes without updating)
    python migrate_all_lesson_outcome_refs.py --course-id "course_c84473" --dry-run

Examples:
    # Dry run for a specific course
    python migrate_all_lesson_outcome_refs.py --course-id "course_c84473" --dry-run

    # Migrate all lessons for a course
    python migrate_all_lesson_outcome_refs.py --course-id "course_c84473"

    # Migrate ALL lessons (use with caution!)
    python migrate_all_lesson_outcome_refs.py --all
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

    Args:
        outcome_codes: List of outcome codes (e.g., ['O1', 'O2'])
        course_id: Course ID (e.g., 'course_c84473')
        mcp_config_path: Path to .mcp.json configuration

    Returns:
        Dictionary mapping codes to document IDs (or None if not found)
    """
    code_to_id_map = {}

    for outcome_code in outcome_codes:
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
            code_to_id_map[outcome_code] = None
        else:
            doc_id = result[0]["$id"]
            code_to_id_map[outcome_code] = doc_id

    return code_to_id_map


async def migrate_single_lesson(
    lesson: Dict[str, Any],
    mcp_config_path: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """Migrate a single lesson template's outcomeRefs.

    Args:
        lesson: Lesson template document
        mcp_config_path: Path to .mcp.json configuration
        dry_run: If True, don't update the document

    Returns:
        Dictionary with migration results
    """
    lesson_id = lesson.get('$id')
    course_id = lesson.get('courseId')
    title = lesson.get('title', 'Untitled')
    outcome_refs_str = lesson.get('outcomeRefs', '[]')

    result = {
        'lesson_id': lesson_id,
        'title': title,
        'course_id': course_id,
        'status': 'skipped',
        'migrated_count': 0,
        'not_found_count': 0,
        'error': None
    }

    # Parse outcomeRefs
    try:
        outcome_refs = json.loads(outcome_refs_str)
    except json.JSONDecodeError:
        result['status'] = 'error'
        result['error'] = 'Failed to parse outcomeRefs'
        return result

    # Skip if empty
    if not outcome_refs:
        result['status'] = 'skipped'
        result['error'] = 'No outcomeRefs to migrate'
        return result

    # Skip if already migrated (first ref looks like a document ID)
    if len(outcome_refs[0]) > 20:
        result['status'] = 'skipped'
        result['error'] = 'Already migrated (has document IDs)'
        return result

    # Map codes to IDs
    code_to_id_map = await map_outcome_codes_to_doc_ids_safe(
        outcome_codes=outcome_refs,
        course_id=course_id,
        mcp_config_path=mcp_config_path
    )

    # Build new outcomeRefs array
    new_outcome_refs = []
    migrated_count = 0
    not_found_count = 0

    for code in outcome_refs:
        doc_id = code_to_id_map.get(code)
        if doc_id:
            new_outcome_refs.append(doc_id)
            migrated_count += 1
        else:
            new_outcome_refs.append(code)  # Keep code as-is
            not_found_count += 1

    result['migrated_count'] = migrated_count
    result['not_found_count'] = not_found_count

    # Skip if nothing was migrated
    if migrated_count == 0:
        result['status'] = 'skipped'
        result['error'] = 'No codes successfully mapped'
        return result

    # Update document (unless dry-run)
    if dry_run:
        result['status'] = 'would_migrate'
        return result

    try:
        await update_appwrite_document(
            database_id="default",
            collection_id="lesson_templates",
            document_id=lesson_id,
            data={"outcomeRefs": json.dumps(new_outcome_refs)},
            mcp_config_path=mcp_config_path
        )
        result['status'] = 'migrated'
        return result

    except Exception as e:
        result['status'] = 'error'
        result['error'] = str(e)
        return result


async def migrate_all_lessons(
    course_id: Optional[str],
    mcp_config_path: str,
    dry_run: bool = False
) -> None:
    """Migrate all lesson templates for a course or all lessons in database.

    Args:
        course_id: Course ID to filter by, or None for all courses
        mcp_config_path: Path to .mcp.json configuration
        dry_run: If True, preview changes without updating
    """
    logger.info("=" * 80)
    logger.info(f"BULK MIGRATION {'[DRY RUN]' if dry_run else ''}")
    logger.info("=" * 80)

    if course_id:
        logger.info(f"Target: All lessons for course {course_id}")
    else:
        logger.info("Target: ALL lessons in database")

    logger.info("")

    # Fetch lesson templates
    logger.info("Step 1: Fetching lesson templates...")

    queries = []
    if course_id:
        queries.append(f'equal("courseId", "{course_id}")')

    lessons = await list_appwrite_documents(
        database_id="default",
        collection_id="lesson_templates",
        queries=queries,
        mcp_config_path=mcp_config_path
    )

    if not lessons:
        logger.warning("⚠️  No lesson templates found")
        return

    logger.info(f"✓ Found {len(lessons)} lesson template(s)")
    logger.info("")

    # Migrate each lesson
    logger.info("Step 2: Migrating lessons...")
    logger.info("")

    results = {
        'migrated': [],
        'would_migrate': [],
        'skipped': [],
        'error': []
    }

    for idx, lesson in enumerate(lessons, 1):
        lesson_id = lesson.get('$id')
        title = lesson.get('title', 'Untitled')

        logger.info(f"[{idx}/{len(lessons)}] Processing: {title} ({lesson_id})")

        result = await migrate_single_lesson(
            lesson=lesson,
            mcp_config_path=mcp_config_path,
            dry_run=dry_run
        )

        status = result['status']
        results[status].append(result)

        if status == 'migrated':
            logger.info(f"  ✅ Migrated {result['migrated_count']} outcome refs")
            if result['not_found_count'] > 0:
                logger.info(f"     ⚠️  {result['not_found_count']} codes not found (kept as-is)")
        elif status == 'would_migrate':
            logger.info(f"  🔍 Would migrate {result['migrated_count']} outcome refs")
            if result['not_found_count'] > 0:
                logger.info(f"     ⚠️  {result['not_found_count']} codes not found (would keep as-is)")
        elif status == 'skipped':
            logger.info(f"  ⏭️  Skipped: {result['error']}")
        elif status == 'error':
            logger.error(f"  ❌ Error: {result['error']}")

        logger.info("")

    # Summary
    logger.info("=" * 80)
    logger.info("MIGRATION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total lessons processed: {len(lessons)}")
    logger.info(f"Successfully migrated: {len(results['migrated'])}")
    logger.info(f"Would migrate (dry-run): {len(results['would_migrate'])}")
    logger.info(f"Skipped: {len(results['skipped'])}")
    logger.info(f"Errors: {len(results['error'])}")
    logger.info("")

    if results['migrated']:
        logger.info("Migrated lessons:")
        for r in results['migrated']:
            logger.info(f"  ✓ {r['title']} ({r['lesson_id']})")
            logger.info(f"    Mapped: {r['migrated_count']}, Not found: {r['not_found_count']}")
        logger.info("")

    if results['would_migrate']:
        logger.info("Would migrate (dry-run):")
        for r in results['would_migrate']:
            logger.info(f"  🔍 {r['title']} ({r['lesson_id']})")
            logger.info(f"    Would map: {r['migrated_count']}, Not found: {r['not_found_count']}")
        logger.info("")

    if results['error']:
        logger.info("Errors:")
        for r in results['error']:
            logger.error(f"  ❌ {r['title']} ({r['lesson_id']})")
            logger.error(f"    Error: {r['error']}")
        logger.info("")

    logger.info("=" * 80)

    if dry_run:
        logger.info("🔍 DRY RUN MODE: No changes were made")
        logger.info("   Run without --dry-run to apply changes")
    else:
        logger.info("✅ Migration complete!")


async def main():
    parser = argparse.ArgumentParser(
        description="Bulk migrate lesson template outcomeRefs from codes to document IDs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Mutually exclusive group: either --course-id or --all
    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument(
        '--course-id',
        help='Course ID to migrate lessons for (e.g., course_c84473)'
    )
    target_group.add_argument(
        '--all',
        action='store_true',
        help='Migrate ALL lessons in database (use with caution!)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without updating documents'
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

    # Confirm if migrating all lessons
    if args.all and not args.dry_run:
        logger.warning("")
        logger.warning("⚠️  WARNING: You are about to migrate ALL lessons in the database!")
        logger.warning("   This will update the outcomeRefs field for every lesson template.")
        logger.warning("")
        response = input("   Are you sure you want to continue? (yes/no): ")
        if response.lower() != 'yes':
            logger.info("Migration cancelled")
            sys.exit(0)
        logger.warning("")

    # Run bulk migration
    await migrate_all_lessons(
        course_id=args.course_id if not args.all else None,
        mcp_config_path=str(mcp_config_path),
        dry_run=args.dry_run
    )


if __name__ == '__main__':
    asyncio.run(main())
