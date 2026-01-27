#!/usr/bin/env python3
"""
Migration Script: Populate lesson_templates.outcomeRefs from SOW entries.

The SOW entries already have outcomeRefs data (verified in diagnostics).
This script extracts those codes and updates lesson_templates.

Background:
- 143 lessons across 10 courses have `outcomeRefs: NULL`
- This causes mastery tracking to fail with "MASTERY UPDATE BLOCKED: Missing enriched outcomes"
- SOW entries already contain the outcomeRefs we need

Format:
- outcomeRefs should be a JSON string array of codes: '["O1", "O2"]'
- NOT document IDs - the enrichment code expects codes to query against course_outcomes.outcomeId

Usage:
    python scripts/migrate_outcomeRefs_from_sow.py --dry-run                    # Preview all
    python scripts/migrate_outcomeRefs_from_sow.py --course-id course_c84473 --dry-run  # Preview one
    python scripts/migrate_outcomeRefs_from_sow.py --course-id course_c84473 --execute  # Execute one
    python scripts/migrate_outcomeRefs_from_sow.py --execute                    # Execute all
"""

import os
import sys
import json
import gzip
import base64
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

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
log_filename = f'migration_outcomeRefs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_filename),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def decompress_entries(data: str) -> List[Dict[str, Any]]:
    """Decompress gzip+base64 encoded SOW entries.

    Handles multiple formats:
    - 'gzip:' prefix + base64 (common format)
    - Raw base64-gzip (Python format)
    - Uncompressed JSON (legacy)
    """
    if not data or data.strip() == '':
        return []

    # Handle gzip: prefix format (most common)
    if data.startswith('gzip:'):
        base64_data = data[5:]  # Remove 'gzip:' prefix
        try:
            compressed = base64.b64decode(base64_data)
            decompressed = gzip.decompress(compressed)
            return json.loads(decompressed.decode('utf-8'))
        except Exception as e:
            raise ValueError(f"gzip: prefix decompression failed: {e}")

    # Try direct JSON (legacy uncompressed)
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        pass

    # Try raw base64-gzip decompression (Python format)
    try:
        compressed = base64.b64decode(data)
        decompressed = gzip.decompress(compressed)
        return json.loads(decompressed.decode('utf-8'))
    except Exception as e:
        raise ValueError(f"Failed to decompress/parse SOW entries: {e}")


def get_sow_for_course(databases: Databases, course_id: str) -> Optional[Dict]:
    """Fetch Authored_SOW document for a course."""
    result = databases.list_documents(
        database_id='default',
        collection_id='Authored_SOW',
        queries=[Query.equal('courseId', course_id), Query.limit(1)]
    )

    if not result['documents']:
        return None
    return result['documents'][0]


def get_lessons_for_course(databases: Databases, course_id: str) -> List[Dict]:
    """Fetch all lesson_templates for a course."""
    all_lessons = []
    offset = 0
    limit = 100

    while True:
        result = databases.list_documents(
            database_id='default',
            collection_id='lesson_templates',
            queries=[
                Query.equal('courseId', course_id),
                Query.limit(limit),
                Query.offset(offset)
            ]
        )

        all_lessons.extend(result['documents'])

        if len(result['documents']) < limit:
            break
        offset += limit

    return all_lessons


def get_course_outcomes(databases: Databases, course_id: str) -> List[Dict]:
    """Fetch all course_outcomes for a course to validate codes."""
    all_outcomes = []
    offset = 0
    limit = 100

    while True:
        result = databases.list_documents(
            database_id='default',
            collection_id='course_outcomes',
            queries=[
                Query.equal('courseId', course_id),
                Query.limit(limit),
                Query.offset(offset)
            ]
        )

        all_outcomes.extend(result['documents'])

        if len(result['documents']) < limit:
            break
        offset += limit

    return all_outcomes


def validate_outcome_codes(
    codes: List[str],
    valid_outcome_ids: set
) -> Tuple[List[str], List[str]]:
    """Validate that outcome codes exist in course_outcomes.

    Returns:
        Tuple of (valid_codes, invalid_codes)
    """
    valid = []
    invalid = []

    for code in codes:
        if code in valid_outcome_ids:
            valid.append(code)
        else:
            invalid.append(code)

    return valid, invalid


def migrate_course(
    databases: Databases,
    course_id: str,
    dry_run: bool = True
) -> Dict[str, int]:
    """Migrate outcomeRefs for all lessons in a course.

    Returns:
        Dictionary with migration statistics
    """
    stats = {
        'updated': 0,
        'skipped_has_refs': 0,
        'skipped_no_sow_match': 0,
        'errors': 0,
        'warnings': 0
    }

    # Get SOW for course
    logger.info(f"Fetching SOW for {course_id}...")
    sow = get_sow_for_course(databases, course_id)
    if not sow:
        raise ValueError(f"No Authored_SOW document found for {course_id}")

    # Parse SOW entries
    entries_data = sow.get('entries', '')
    entries = decompress_entries(entries_data)
    logger.info(f"Found {len(entries)} SOW entries")

    if not entries:
        raise ValueError(f"SOW has no entries or failed to decompress for {course_id}")

    # Build lookup by order
    entry_by_order = {e.get('order'): e for e in entries}

    # Get course_outcomes for validation
    outcomes = get_course_outcomes(databases, course_id)
    valid_outcome_ids = {o.get('outcomeId') for o in outcomes}
    logger.info(f"Found {len(outcomes)} course_outcomes with IDs: {list(valid_outcome_ids)[:10]}...")

    if not outcomes:
        raise ValueError(
            f"No course_outcomes found for {course_id}. "
            f"Run seedSingleCourse.ts first to populate course_outcomes."
        )

    # Get lessons
    lessons = get_lessons_for_course(databases, course_id)
    logger.info(f"Found {len(lessons)} lessons")

    for lesson in lessons:
        lesson_id = lesson['$id']
        title = lesson.get('title', 'Untitled')
        sow_order = lesson.get('sow_order')
        current_refs = lesson.get('outcomeRefs')

        # Skip if already has outcomeRefs
        if current_refs and current_refs not in ['[]', 'null', '']:
            logger.debug(f"  SKIP (has refs): {title}")
            stats['skipped_has_refs'] += 1
            continue

        # Find matching SOW entry
        if sow_order is None:
            logger.warning(f"  SKIP (no sow_order): {title}")
            stats['skipped_no_sow_match'] += 1
            continue

        entry = entry_by_order.get(sow_order)
        if not entry:
            logger.warning(f"  SKIP (no SOW entry for order {sow_order}): {title}")
            stats['skipped_no_sow_match'] += 1
            continue

        # Extract outcomeRefs from SOW entry
        outcome_refs = entry.get('outcomeRefs', [])
        if not outcome_refs:
            logger.warning(f"  SKIP (SOW entry has empty outcomeRefs): {title}")
            stats['skipped_no_sow_match'] += 1
            continue

        # Validate codes against course_outcomes
        valid_codes, invalid_codes = validate_outcome_codes(outcome_refs, valid_outcome_ids)

        if invalid_codes:
            logger.warning(
                f"  WARNING: Invalid codes for {title}: {invalid_codes} "
                f"(not in course_outcomes)"
            )
            stats['warnings'] += 1

        if not valid_codes:
            logger.warning(f"  SKIP (no valid codes): {title}")
            stats['skipped_no_sow_match'] += 1
            continue

        # Convert to JSON string
        outcome_refs_json = json.dumps(valid_codes)

        if dry_run:
            logger.info(f"  [DRY-RUN] Would update: {title} -> {outcome_refs_json}")
            stats['updated'] += 1
        else:
            try:
                databases.update_document(
                    database_id='default',
                    collection_id='lesson_templates',
                    document_id=lesson_id,
                    data={'outcomeRefs': outcome_refs_json}
                )
                logger.info(f"  UPDATED: {title} -> {outcome_refs_json}")
                stats['updated'] += 1
            except Exception as e:
                logger.error(f"  ERROR updating {title}: {e}")
                stats['errors'] += 1

    return stats


def get_affected_courses(databases: Databases) -> List[str]:
    """Find all courses that have lessons with NULL outcomeRefs."""
    courses = set()
    offset = 0
    limit = 100

    while True:
        result = databases.list_documents(
            database_id='default',
            collection_id='lesson_templates',
            queries=[Query.limit(limit), Query.offset(offset)]
        )

        for doc in result['documents']:
            outcome_refs = doc.get('outcomeRefs')
            if outcome_refs is None or outcome_refs in ['[]', 'null', '']:
                course_id = doc.get('courseId', 'UNKNOWN')
                courses.add(course_id)

        if len(result['documents']) < limit:
            break
        offset += limit

    return sorted(list(courses))


def main():
    parser = argparse.ArgumentParser(
        description='Migrate lesson outcomeRefs from SOW entries'
    )
    parser.add_argument(
        '--course-id',
        help='Specific course ID to migrate (e.g., course_c84473)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without writing to database'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Apply changes to database'
    )
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("ERROR: Must specify --dry-run or --execute")
        parser.print_help()
        sys.exit(1)

    dry_run = args.dry_run

    logger.info("=" * 70)
    logger.info("OutcomeRefs Migration: SOW -> lesson_templates")
    logger.info("=" * 70)
    logger.info(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'EXECUTE'}")
    logger.info(f"Log file: {log_filename}")

    # Initialize Appwrite client
    endpoint = os.environ.get('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1')
    project_id = os.environ.get('APPWRITE_PROJECT_ID')
    api_key = os.environ.get('APPWRITE_API_KEY')

    if not project_id or not api_key:
        logger.error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY")
        sys.exit(1)

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)

    # Determine courses to migrate
    if args.course_id:
        courses = [args.course_id]
        logger.info(f"Target: Single course {args.course_id}")
    else:
        logger.info("Scanning for affected courses...")
        courses = get_affected_courses(databases)
        logger.info(f"Found {len(courses)} courses with NULL outcomeRefs")

    if not courses:
        logger.info("No courses need migration!")
        return

    # Totals across all courses
    total_stats = {
        'updated': 0,
        'skipped_has_refs': 0,
        'skipped_no_sow_match': 0,
        'errors': 0,
        'warnings': 0
    }

    failed_courses = []
    successful_courses = []

    # Migrate each course
    for course_id in courses:
        logger.info("")
        logger.info("=" * 70)
        logger.info(f"Migrating {course_id}")
        logger.info("=" * 70)

        try:
            stats = migrate_course(databases, course_id, dry_run)

            for key, value in stats.items():
                total_stats[key] += value

            successful_courses.append({
                'course_id': course_id,
                'updated': stats['updated'],
                'errors': stats['errors']
            })

        except Exception as e:
            logger.error(f"FAILED to migrate {course_id}: {e}")
            failed_courses.append({
                'course_id': course_id,
                'error': str(e)
            })
            total_stats['errors'] += 1

    # Print summary
    logger.info("")
    logger.info("=" * 70)
    logger.info("MIGRATION SUMMARY")
    logger.info("=" * 70)
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'EXECUTED'}")
    logger.info(f"Courses processed: {len(courses)}")
    logger.info(f"Successful courses: {len(successful_courses)}")
    logger.info(f"Failed courses: {len(failed_courses)}")
    logger.info("")
    logger.info("Statistics:")
    logger.info(f"  Lessons updated: {total_stats['updated']}")
    logger.info(f"  Skipped (already has refs): {total_stats['skipped_has_refs']}")
    logger.info(f"  Skipped (no SOW match): {total_stats['skipped_no_sow_match']}")
    logger.info(f"  Warnings: {total_stats['warnings']}")
    logger.info(f"  Errors: {total_stats['errors']}")

    if successful_courses:
        logger.info("")
        logger.info("Successful courses:")
        for item in successful_courses:
            logger.info(f"  {item['course_id']}: {item['updated']} lessons updated")

    if failed_courses:
        logger.info("")
        logger.warning("Failed courses:")
        for item in failed_courses:
            logger.warning(f"  {item['course_id']}: {item['error']}")

    if dry_run:
        logger.info("")
        logger.info("This was a DRY RUN. No changes were made to the database.")
        logger.info("Run with --execute to apply changes.")
    else:
        logger.info("")
        logger.info("Migration completed!")
        logger.info("Verify by running diagnose_outcomeRefs.py again.")


if __name__ == '__main__':
    main()
