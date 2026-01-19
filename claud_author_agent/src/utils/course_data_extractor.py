"""Course Data Extractor - Python utility for SQA course data extraction.

⚠️ DEPRECATED: This module is deprecated and will be removed in a future version.

Reason: Lesson author now uses default.course_outcomes directly instead of sqa_education.sqa_current.

Replacement: Use course_outcomes_extractor.py instead.

Migration: See tasks/lesson-author-course-outcomes-refactor-spec.md

Legacy Description:
Extracts course data from Appwrite's sqa_education.sqa_current collection
and formats it as Course_data.txt for SOW authoring agents.

NO FALLBACKS - Fail fast with detailed error messages.
"""

import warnings
import json
import logging

warnings.warn(
    "course_data_extractor.py is deprecated. Use course_outcomes_extractor.py instead. "
    "See tasks/lesson-author-course-outcomes-refactor-spec.md for migration details.",
    DeprecationWarning,
    stacklevel=2
)
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


async def extract_course_data_to_file(
    subject: str,
    level: str,
    mcp_config_path: str,
    output_path: Path
) -> None:
    """Extract SQA course data and write to Course_data.txt.

    This function queries sqa_education.sqa_current collection, extracts
    the nested JSON from the 'data' field, and formats it as a readable
    text file for SOW authoring agents.

    NO FALLBACKS - Fail fast with detailed error messages.

    Args:
        subject: SQA subject slug (e.g., 'mathematics', 'application-of-mathematics')
        level: SQA level slug (e.g., 'national-5', 'higher')
        mcp_config_path: Path to .mcp.json configuration
        output_path: Path to write Course_data.txt (workspace/Course_data.txt)

    Raises:
        ValueError: If no course found, data field missing/invalid, or required fields missing
        json.JSONDecodeError: If data field is not valid JSON
        IOError: If file write fails

    Example:
        >>> await extract_course_data_to_file(
        ...     subject='mathematics',
        ...     level='national-5',
        ...     mcp_config_path='.mcp.json',
        ...     output_path=Path('/workspace/Course_data.txt')
        ... )
    """
    logger.info(f"🔍 Extracting course data: {subject}, {level}")

    # Step 1: Convert subject/level to SQA format (hyphen → underscore)
    sqa_subject = subject.replace("-", "_")

    # Special case: SQA uses "applications" (plural) not "application"
    if sqa_subject == "application_of_mathematics":
        sqa_subject = "applications_of_mathematics"
        logger.info(f"  Converted to SQA plural: {sqa_subject}")

    sqa_level = level.replace("-", "_")

    logger.info(f"  Querying with SQA format: subject='{sqa_subject}', level='{sqa_level}'")

    # Step 2: Query Appwrite (fail-fast if no results)
    from .appwrite_mcp import list_appwrite_documents

    documents = await list_appwrite_documents(
        database_id="sqa_education",
        collection_id="sqa_current",
        queries=[
            f'equal("subject", "{sqa_subject}")',
            f'equal("level", "{sqa_level}")'
        ],
        mcp_config_path=mcp_config_path
    )

    # Step 3: Validate response (FAIL-FAST - NO FALLBACKS)
    if not documents or len(documents) == 0:
        raise ValueError(
            f"No SQA course data found for subject='{subject}', level='{level}'. "
            f"Queried with SQA format: subject='{sqa_subject}', level='{sqa_level}'. "
            f"Possible causes:\n"
            f"  - Course doesn't exist in sqa_education.sqa_current collection\n"
            f"  - Subject/level formatting is incorrect\n"
            f"  - Database connection issue\n"
            f"Check that the course exists in Appwrite before authoring SOW."
        )

    document = documents[0]
    document_id = document.get('$id', 'UNKNOWN_ID')
    logger.info(f"  ✓ Found document: {document_id}")

    # Step 4: Extract and parse data field (FAIL-FAST)
    if 'data' not in document:
        raise ValueError(
            f"Document {document_id} missing 'data' field. "
            f"Expected schema: {{data: JSON_STRING}}. "
            f"Available fields: {list(document.keys())}. "
            f"This indicates a database schema issue - contact administrator."
        )

    data_str = document['data']
    if not data_str:
        raise ValueError(
            f"Document {document_id} has empty 'data' field. "
            f"Cannot extract course information. "
            f"This course record may be incomplete - check database."
        )

    # Parse JSON with detailed error handling
    try:
        data_json = json.loads(data_str)
    except json.JSONDecodeError as e:
        raise json.JSONDecodeError(
            f"Failed to parse 'data' field as JSON: {e}. "
            f"Document ID: {document_id}. "
            f"Data preview: {data_str[:200]}... "
            f"This indicates corrupted data - check database.",
            doc=data_str,
            pos=e.pos
        )

    logger.info(f"  ✓ Successfully parsed data field JSON")

    # Step 5: Extract nested structure with validation (FAIL-FAST)
    # SQA data structure: data.subjects[0].levels[0] contains the level-specific data
    try:
        # Navigate to level data first
        level_data = data_json['subjects'][0]['levels'][0]

        course_name = level_data['qualification']['title']
        course_code = level_data['qualification']['course_code']
        course_structure = level_data['course_structure']
        units = course_structure.get('units', [])
        recommended_sequence = course_structure.get('recommended_sequence', [])
        sequence_rationale = course_structure.get('sequence_rationale', '')
        delivery_notes = course_structure.get('delivery_notes', [])
        assessment_model = level_data.get('assessment_model', {})
        marking_guidance = level_data.get('marking_guidance', {})
    except (KeyError, IndexError) as e:
        raise ValueError(
            f"Missing required field in data JSON: {e}. "
            f"Document ID: {document_id}. "
            f"Expected schema: {{subjects: [{{levels: [{{qualification: {{title, course_code}}, "
            f"course_structure: {{...}}}}]}}]}}. "
            f"Available keys: {list(data_json.keys())}. "
            f"This indicates a schema mismatch - check data extraction pipeline."
        )

    logger.info(f"  ✓ Extracted course: {course_name} ({course_code})")
    logger.info(f"  ✓ Units: {len(units)}")

    # Step 6: Write raw JSON dump (preserves exact database structure)
    content = json.dumps(data_json, indent=2, ensure_ascii=False)

    # Add metadata footer
    footer = f"\n\n---\nExtracted from Appwrite: {datetime.now().isoformat()}\n"
    footer += f"Document extracted using Python utility (no LLM processing) - "
    footer += f"Raw JSON dump from sqa_education.sqa_current collection's 'data' field\n"
    content = content + footer

    # Step 7: Write to file (FAIL-FAST if write fails)
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding='utf-8')
        logger.info(f"  ✅ Course_data.txt written to: {output_path}")
        logger.info(f"     Size: {len(content)} bytes (raw JSON)")
    except Exception as e:
        raise IOError(
            f"Failed to write Course_data.txt to {output_path}: {e}. "
            f"Check file permissions and disk space."
        )
