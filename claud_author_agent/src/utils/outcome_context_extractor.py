"""Course Outcomes Context Extractor for Lesson Author Agent.

Extracts all course outcomes for a given course and formats them as
context for the lesson authoring agent to ensure accurate outcomeRef selection.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from .appwrite_mcp import list_appwrite_documents

logger = logging.getLogger(__name__)


async def extract_outcomes_context_to_file(
    course_id: str,
    mcp_config_path: str,
    output_path: str
) -> bool:
    """Extract course outcomes and save as formatted context file.

    Args:
        course_id: Course identifier (e.g., 'course_c84473')
        mcp_config_path: Path to .mcp.json configuration
        output_path: Path to save the outcomes context file

    Returns:
        True if outcomes were found and file created, False otherwise

    Raises:
        Exception: If database query fails
    """
    logger.info(f"📋 Extracting outcomes context for course: {course_id}")

    # Query course_outcomes collection
    outcomes = await list_appwrite_documents(
        database_id="default",
        collection_id="course_outcomes",
        queries=[f'equal("courseId", "{course_id}")'],
        mcp_config_path=mcp_config_path
    )

    if not outcomes:
        logger.warning(f"⚠️  No course outcomes found for course '{course_id}'")
        logger.warning("   Agent will proceed without outcome context")
        return False

    # Format outcomes as readable context
    context_lines = [
        "# Available Course Outcomes",
        "",
        f"This course has {len(outcomes)} learning outcomes. Use the exact outcomeId values",
        "shown below when specifying outcomeRefs in your lesson template.",
        "",
        "---",
        ""
    ]

    for idx, outcome in enumerate(outcomes, 1):
        outcome_id = outcome.get('outcomeId', 'UNKNOWN')
        outcome_title = outcome.get('outcomeTitle', 'No title')
        unit_code = outcome.get('unitCode', '')
        unit_title = outcome.get('unitTitle', '')

        context_lines.append(f"## Outcome {idx}: {outcome_id}")
        context_lines.append(f"**Title:** {outcome_title}")
        context_lines.append("")

        if unit_code or unit_title:
            context_lines.append(f"**Unit:** {unit_code} - {unit_title}")
            context_lines.append("")

        # Add assessment standards if available
        assessment_standards_str = outcome.get('assessmentStandards', '[]')
        try:
            standards = json.loads(assessment_standards_str)
            if standards:
                context_lines.append("**Assessment Standards:**")
                for standard in standards:
                    if isinstance(standard, dict):
                        code = standard.get('code', '')
                        desc = standard.get('desc', '')
                        if code:
                            context_lines.append(f"- **{code}**: {desc}")
                context_lines.append("")
        except (json.JSONDecodeError, TypeError):
            pass

        context_lines.append("---")
        context_lines.append("")

    context_lines.extend([
        "",
        "## Instructions",
        "",
        "When creating your lesson template:",
        "1. Review the outcomes above",
        "2. Select the most relevant outcomeId values for this lesson",
        "3. Use ONLY the exact outcomeId values shown (e.g., 'O1', 'O2', 'AS1.1')",
        "4. Add them to the outcomeRefs array in your lesson template JSON",
        "",
        "Example:",
        '```json',
        '"outcomeRefs": ["O1", "O2"]',
        '```',
        ""
    ])

    # Write to file
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(context_lines))

    logger.info(f"✅ Saved {len(outcomes)} outcomes to: {output_path}")
    logger.info(f"   File size: {output_file.stat().st_size} bytes")

    return True
