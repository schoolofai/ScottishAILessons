#!/usr/bin/env python3
"""
Diagnostic Script: Analyze outcomeRefs Data Availability

This script examines lesson_templates and Authored_SOW documents to understand
the state of outcomeRefs fields before migration.

Purpose:
- Identify lessons with NULL/empty outcomeRefs
- Check if corresponding SOW entries have outcomeRefs data
- Verify course_outcomes exist for affected courses
- Validate format compatibility

Usage:
    python scripts/diagnose_outcomeRefs.py
    python scripts/diagnose_outcomeRefs.py --course-id course_c84473
"""

import os
import sys
import json
import gzip
import base64
import logging
import argparse
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Any

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
    format='%(asctime)s - %(levelname)s - %(message)s'
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
            logger.error(f"gzip: prefix decompression failed: {e}")
            return []

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
        logger.error(f"Failed to decompress/parse entries: {e}")
        return []


def get_all_lessons_with_null_outcomeRefs(
    databases: Databases,
    course_id: Optional[str] = None
) -> List[Dict]:
    """Fetch all lesson_templates with NULL/empty outcomeRefs."""
    all_lessons = []
    offset = 0
    limit = 100

    base_queries = []
    if course_id:
        base_queries.append(Query.equal('courseId', course_id))

    while True:
        result = databases.list_documents(
            database_id='default',
            collection_id='lesson_templates',
            queries=base_queries + [Query.limit(limit), Query.offset(offset)]
        )

        # Filter for NULL/empty outcomeRefs
        for doc in result['documents']:
            outcome_refs = doc.get('outcomeRefs')
            if outcome_refs is None or outcome_refs == '' or outcome_refs == '[]' or outcome_refs == 'null':
                all_lessons.append(doc)

        if len(result['documents']) < limit:
            break
        offset += limit

    return all_lessons


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


def get_course_outcomes(databases: Databases, course_id: str) -> List[Dict]:
    """Fetch all course_outcomes for a course."""
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


def analyze_course(
    databases: Databases,
    course_id: str,
    lessons: List[Dict]
) -> Dict[str, Any]:
    """Analyze a single course's data availability."""
    analysis = {
        'course_id': course_id,
        'lesson_count': len(lessons),
        'sow_exists': False,
        'sow_entries_count': 0,
        'entries_with_outcomeRefs': 0,
        'course_outcomes_count': 0,
        'outcome_ids': [],
        'migration_viable': False,
        'issues': []
    }

    # Check SOW
    sow = get_sow_for_course(databases, course_id)
    if not sow:
        analysis['issues'].append("No Authored_SOW document found")
        return analysis

    analysis['sow_exists'] = True

    # Parse SOW entries
    entries_data = sow.get('entries', '')
    entries = decompress_entries(entries_data)
    analysis['sow_entries_count'] = len(entries)

    if not entries:
        analysis['issues'].append("SOW has no entries or failed to decompress")
        return analysis

    # Check outcomeRefs in entries
    entries_with_refs = 0
    sample_refs = []
    for entry in entries:
        refs = entry.get('outcomeRefs', [])
        if refs and len(refs) > 0:
            entries_with_refs += 1
            if len(sample_refs) < 3:
                sample_refs.append({'order': entry.get('order'), 'outcomeRefs': refs})

    analysis['entries_with_outcomeRefs'] = entries_with_refs
    analysis['sample_outcomeRefs'] = sample_refs

    if entries_with_refs == 0:
        analysis['issues'].append("SOW entries have no outcomeRefs data")
        return analysis

    # Check course_outcomes
    outcomes = get_course_outcomes(databases, course_id)
    analysis['course_outcomes_count'] = len(outcomes)
    analysis['outcome_ids'] = [o.get('outcomeId') for o in outcomes]

    if len(outcomes) == 0:
        analysis['issues'].append("No course_outcomes documents - need to seed first")
        return analysis

    # Verify format compatibility
    # Extract codes from SOW entries and check they match course_outcomes
    all_sow_codes = set()
    for entry in entries:
        refs = entry.get('outcomeRefs', [])
        for ref in refs:
            if isinstance(ref, str):
                all_sow_codes.add(ref)

    outcome_id_set = set(analysis['outcome_ids'])
    matching_codes = all_sow_codes.intersection(outcome_id_set)
    unmatched_codes = all_sow_codes - outcome_id_set

    analysis['sow_codes'] = list(all_sow_codes)
    analysis['matching_codes'] = list(matching_codes)
    analysis['unmatched_codes'] = list(unmatched_codes)

    if unmatched_codes:
        analysis['issues'].append(f"Some SOW codes don't match course_outcomes: {list(unmatched_codes)[:5]}")

    # Determine if migration is viable
    analysis['migration_viable'] = (
        analysis['sow_exists'] and
        analysis['entries_with_outcomeRefs'] > 0 and
        analysis['course_outcomes_count'] > 0
    )

    return analysis


def main():
    parser = argparse.ArgumentParser(
        description='Diagnose outcomeRefs data availability before migration'
    )
    parser.add_argument('--course-id', help='Analyze specific course ID')
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("OutcomeRefs Migration Diagnostic")
    logger.info("=" * 60)

    # Initialize Appwrite client
    endpoint = os.environ.get('APPWRITE_ENDPOINT', 'https://cloud.appwrite.io/v1')
    project_id = os.environ.get('APPWRITE_PROJECT_ID')
    api_key = os.environ.get('APPWRITE_API_KEY')

    if not project_id or not api_key:
        logger.error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY environment variables")
        sys.exit(1)

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)

    databases = Databases(client)

    # Fetch lessons with NULL outcomeRefs
    logger.info("\nFetching lessons with NULL/empty outcomeRefs...")
    null_lessons = get_all_lessons_with_null_outcomeRefs(databases, args.course_id)
    logger.info(f"Found {len(null_lessons)} lessons with NULL outcomeRefs")

    if not null_lessons:
        logger.info("No lessons need migration!")
        return

    # Group by course
    lessons_by_course = defaultdict(list)
    for lesson in null_lessons:
        course_id = lesson.get('courseId', 'UNKNOWN')
        lessons_by_course[course_id].append(lesson)

    logger.info(f"\nAffected courses: {len(lessons_by_course)}")
    for course_id, lessons in lessons_by_course.items():
        logger.info(f"  {course_id}: {len(lessons)} lessons")

    # Analyze each course
    logger.info("\n" + "=" * 60)
    logger.info("Course Analysis")
    logger.info("=" * 60)

    summary = {
        'total_lessons': len(null_lessons),
        'total_courses': len(lessons_by_course),
        'viable_courses': 0,
        'blocked_courses': [],
        'missing_outcomes_courses': []
    }

    for course_id, lessons in lessons_by_course.items():
        logger.info(f"\n--- {course_id} ---")
        analysis = analyze_course(databases, course_id, lessons)

        logger.info(f"  Lessons needing migration: {analysis['lesson_count']}")
        logger.info(f"  SOW exists: {analysis['sow_exists']}")
        logger.info(f"  SOW entries: {analysis['sow_entries_count']}")
        logger.info(f"  Entries with outcomeRefs: {analysis['entries_with_outcomeRefs']}")
        logger.info(f"  course_outcomes count: {analysis['course_outcomes_count']}")

        if analysis.get('sample_outcomeRefs'):
            logger.info(f"  Sample outcomeRefs:")
            for sample in analysis['sample_outcomeRefs']:
                logger.info(f"    Order {sample['order']}: {sample['outcomeRefs']}")

        if analysis.get('outcome_ids'):
            logger.info(f"  Outcome IDs: {analysis['outcome_ids'][:10]}...")

        if analysis['issues']:
            logger.warning(f"  Issues:")
            for issue in analysis['issues']:
                logger.warning(f"    - {issue}")

        if analysis['migration_viable']:
            logger.info(f"  Migration viable: YES")
            summary['viable_courses'] += 1
        else:
            logger.warning(f"  Migration viable: NO")
            summary['blocked_courses'].append(course_id)

            if analysis['course_outcomes_count'] == 0:
                summary['missing_outcomes_courses'].append(course_id)

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("DIAGNOSTIC SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total lessons needing migration: {summary['total_lessons']}")
    logger.info(f"Total affected courses: {summary['total_courses']}")
    logger.info(f"Viable for migration: {summary['viable_courses']}")
    logger.info(f"Blocked courses: {len(summary['blocked_courses'])}")

    if summary['blocked_courses']:
        logger.info(f"\nBlocked courses: {summary['blocked_courses']}")

    if summary['missing_outcomes_courses']:
        logger.warning(f"\nCourses missing course_outcomes (need seeding first):")
        for c in summary['missing_outcomes_courses']:
            logger.warning(f"  {c}")
        logger.info("\nTo seed missing course_outcomes, run:")
        logger.info("  npx tsx scripts/seedSingleCourse.ts --subject <subject> --level <level>")

    if summary['viable_courses'] > 0:
        logger.info("\nReady to migrate! Run:")
        logger.info("  python scripts/migrate_outcomeRefs_from_sow.py --dry-run")
        logger.info("  python scripts/migrate_outcomeRefs_from_sow.py --execute")


if __name__ == '__main__':
    main()
