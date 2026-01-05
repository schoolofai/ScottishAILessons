"""Course Outcomes Extractor - Python utility for course_outcomes extraction.

Extracts course outcomes from Appwrite's default.course_outcomes collection
and formats them as Course_outcomes.json for lesson authoring agents.

This replaces the legacy course_data_extractor.py which queried sqa_education.sqa_current.
By using course_outcomes directly, we ensure deterministic outcome references.

NO FALLBACKS - Fail fast with detailed error messages.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


async def extract_course_outcomes_to_file(
    courseId: str,
    mcp_config_path: str,
    output_path: Path
) -> Dict[str, Any]:
    """Extract course_outcomes from default.course_outcomes and write to Course_outcomes.json.

    This function queries default.course_outcomes collection, auto-detects the course
    structure type (unit_based vs skills_based), and writes a structured JSON file
    for lesson authoring agents to use for deterministic outcome references.

    NO FALLBACKS - Fail fast with detailed error messages.

    Args:
        courseId: Course identifier (e.g., "course_c84473", "course_c84775")
        mcp_config_path: Path to .mcp.json configuration
        output_path: Path to write Course_outcomes.json (workspace/Course_outcomes.json)

    Returns:
        Dictionary containing:
            - courseId: str
            - courseSqaCode: str
            - structure_type: str ("unit_based" or "skills_based")
            - outcomes: List[CourseOutcome]

    Raises:
        ValueError: If courseId not found in course_outcomes
        ValueError: If no outcomes found for courseId
        ValueError: If courseSqaCode missing from first outcome
        IOError: If file write fails

    Note:
        Detects structure_type automatically:
        - unit_based: If any outcomeId matches /^[A-Z]+\\d+$/
        - skills_based: If any outcomeId matches /^(TOPIC|SKILL)_/

    Example:
        >>> outcomes_data = await extract_course_outcomes_to_file(
        ...     courseId='course_c84775',
        ...     mcp_config_path='.mcp.json',
        ...     output_path=Path('/workspace/Course_outcomes.json')
        ... )
        >>> print(outcomes_data['structure_type'])
        'skills_based'
    """
    logger.info(f"🔍 Extracting course_outcomes for courseId: {courseId}")

    # Step 1: Query default.course_outcomes (fail-fast if no results)
    from .appwrite_mcp import list_appwrite_documents

    try:
        outcomes_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="course_outcomes",
            queries=[
                f'equal("courseId", "{courseId}")',
                'limit(500)'  # Support large skills-based courses (National 5 Math = 46 outcomes)
            ],
            mcp_config_path=mcp_config_path
        )
    except Exception as e:
        raise ValueError(
            f"Failed to query course_outcomes collection: {e}. "
            f"Check database connection and ensure course_outcomes collection exists."
        )

    # Step 2: Validate response (FAIL-FAST - NO FALLBACKS)
    if not outcomes_docs or len(outcomes_docs) == 0:
        raise ValueError(
            f"No course_outcomes found for courseId '{courseId}'. "
            f"Possible causes:\n"
            f"  - Course hasn't been seeded to course_outcomes collection\n"
            f"  - CourseId format is incorrect (should be like 'course_c84473')\n"
            f"  - Database connection issue\n"
            f"Action required: Run seedSingleCourse.ts or bulkSeedAllCourses.ts to populate course_outcomes.\n"
            f"See: assistant-ui-frontend/scripts/seedSingleCourse.ts"
        )

    logger.info(f"  ✓ Found {len(outcomes_docs)} course_outcomes for {courseId}")

    # Step 3: Extract courseSqaCode from first outcome (OPTIONAL - warn if missing)
    first_outcome = outcomes_docs[0]
    courseSqaCode = first_outcome.get("courseSqaCode") or ""

    if not courseSqaCode:
        # Try to extract from unitCode as backup identifier
        unitCode = first_outcome.get("unitCode", "")
        logger.warning(
            f"  ⚠️ courseSqaCode is null/empty for courseId '{courseId}'. "
            f"Document ID: {first_outcome.get('$id', 'UNKNOWN')}. "
            f"Using unitCode '{unitCode}' as fallback identifier. "
            f"Consider re-seeding course_outcomes with correct courseSqaCode."
        )
        # Use unitCode as fallback if courseSqaCode is missing
        courseSqaCode = unitCode if unitCode else "UNKNOWN"

    logger.info(f"  ✓ Course SQA Code: {courseSqaCode}")

    # Step 4: Auto-detect structure_type
    structure_type = _detect_structure_type(outcomes_docs)
    logger.info(f"  ✓ Detected structure_type: {structure_type}")

    # Step 5: Build output structure
    output_data = {
        "courseId": courseId,
        "courseSqaCode": courseSqaCode,
        "structure_type": structure_type,
        "outcomes": outcomes_docs
    }

    # Step 6: Write to file (FAIL-FAST if write fails)
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        logger.info(f"  ✅ Course_outcomes.json written to: {output_path}")
        logger.info(f"     Size: {output_path.stat().st_size} bytes")
        logger.info(f"     Structure: {structure_type}, {len(outcomes_docs)} outcomes")

        # Log sample outcomeIds for debugging
        sample_ids = [outcome.get('outcomeId', 'UNKNOWN') for outcome in outcomes_docs[:5]]
        logger.info(f"     Sample outcomeIds: {sample_ids}")

    except Exception as e:
        raise IOError(
            f"Failed to write Course_outcomes.json to {output_path}: {e}. "
            f"Check file permissions and disk space."
        )

    return output_data


def _detect_structure_type(outcomes: List[Dict[str, Any]]) -> str:
    """Auto-detect course structure type from outcomeIds.

    Analyzes the outcomeId field of all outcomes to determine if this is
    a traditional unit-based course or a skills-based course.

    Args:
        outcomes: List of course_outcome documents

    Returns:
        "unit_based" or "skills_based"

    Logic:
        - If any outcomeId matches TOPIC_ or SKILL_ prefix → skills_based
        - Otherwise → unit_based

    Examples:
        >>> _detect_structure_type([{"outcomeId": "O1"}, {"outcomeId": "O2"}])
        'unit_based'

        >>> _detect_structure_type([{"outcomeId": "SKILL_WORKING_WITH_SURDS"}])
        'skills_based'

        >>> _detect_structure_type([{"outcomeId": "TOPIC_NUMERICAL_SKILLS"}])
        'skills_based'
    """
    # Check all outcomes for skills-based format
    for outcome in outcomes:
        outcome_id = outcome.get("outcomeId", "")
        if outcome_id.startswith("TOPIC_") or outcome_id.startswith("SKILL_"):
            logger.info(f"    Detected skills-based outcome: {outcome_id}")
            return "skills_based"

    # Default to unit_based if no skills-based patterns found
    logger.info(f"    No TOPIC_/SKILL_ prefixes found - defaulting to unit_based")
    return "unit_based"
