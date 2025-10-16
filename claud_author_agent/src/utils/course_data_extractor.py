"""Course Data Extractor - Python utility for SQA course data extraction.

Extracts course data from Appwrite's sqa_education.sqa_current collection
and formats it as Course_data.txt for SOW authoring agents.

NO FALLBACKS - Fail fast with detailed error messages.
"""

import json
import logging
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
    try:
        course_name = data_json['qualification']['title']
        course_code = data_json['qualification']['course_code']
        units = data_json['course_structure']['units']
        recommended_sequence = data_json['course_structure'].get('recommended_sequence', [])
        sequence_rationale = data_json['course_structure'].get('sequence_rationale', '')
        delivery_notes = data_json['course_structure'].get('delivery_notes', [])
        assessment_model = data_json.get('assessment_model', {})
        marking_guidance = data_json.get('marking_guidance', {})
    except KeyError as e:
        raise ValueError(
            f"Missing required field in data JSON: {e}. "
            f"Document ID: {document_id}. "
            f"Expected schema: {{qualification: {{title, course_code}}, "
            f"course_structure: {{units, recommended_sequence, ...}}}}. "
            f"Available keys: {list(data_json.keys())}. "
            f"This indicates a schema mismatch - check data extraction pipeline."
        )

    logger.info(f"  ✓ Extracted course: {course_name} ({course_code})")
    logger.info(f"  ✓ Units: {len(units)}")

    # Step 6: Format as Course_data.txt
    lines = _format_course_data(
        course_name=course_name,
        course_code=course_code,
        subject=subject,
        level=level,
        units=units,
        recommended_sequence=recommended_sequence,
        sequence_rationale=sequence_rationale,
        delivery_notes=delivery_notes,
        assessment_model=assessment_model,
        marking_guidance=marking_guidance
    )

    # Step 7: Write to file (FAIL-FAST if write fails)
    content = '\n'.join(lines)
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding='utf-8')
        logger.info(f"  ✅ Course_data.txt written to: {output_path}")
        logger.info(f"     Size: {len(content)} bytes, {len(lines)} lines")
    except Exception as e:
        raise IOError(
            f"Failed to write Course_data.txt to {output_path}: {e}. "
            f"Check file permissions and disk space."
        )


def _format_course_data(
    course_name: str,
    course_code: str,
    subject: str,
    level: str,
    units: List[Dict[str, Any]],
    recommended_sequence: List[str],
    sequence_rationale: str,
    delivery_notes: List[str],
    assessment_model: Dict[str, Any],
    marking_guidance: Dict[str, Any]
) -> List[str]:
    """Format extracted course data as Course_data.txt lines.

    This helper function takes extracted course data and formats it
    as a readable text file for SOW authoring agents.

    Args:
        course_name: Full course title
        course_code: SQA course code
        subject: Subject slug (original format)
        level: Level slug (original format)
        units: List of unit dictionaries
        recommended_sequence: Recommended unit order
        sequence_rationale: Rationale for sequencing
        delivery_notes: Teaching delivery notes
        assessment_model: Assessment model dictionary
        marking_guidance: Marking guidance dictionary

    Returns:
        List of formatted text lines
    """
    lines = []

    # Header
    lines.append(f"# SQA Course Data: {course_name}")
    lines.append(f"Subject: {subject}")
    lines.append(f"Level: {level}")
    lines.append(f"Course Code: {course_code}")
    lines.append("")

    # Units section
    lines.append("## Units")
    lines.append("")

    for unit_idx, unit in enumerate(units, start=1):
        unit_title = unit.get('title', f'Unit {unit_idx}')
        lines.append(f"### Unit {unit_idx}: {unit_title}")

        # Unit marking guidance (if present)
        unit_marking_guidance = unit.get('unit_marking_guidance', '')
        if unit_marking_guidance:
            lines.append(f"**Unit Marking Guidance**: {unit_marking_guidance}")

        lines.append("")

        # Outcomes
        outcomes = unit.get('outcomes', [])
        if outcomes:
            lines.append("#### Outcomes")
            for outcome_idx, outcome in enumerate(outcomes, start=1):
                outcome_title = outcome.get('title', f'Outcome {outcome_idx}')
                lines.append(f"- **O{outcome_idx}**: {outcome_title}")
            lines.append("")

        # Assessment Standards
        # Extract from outcomes (standards may be nested under outcomes)
        lines.append("#### Assessment Standards")

        all_standards = []
        for outcome_idx, outcome in enumerate(outcomes, start=1):
            standards = outcome.get('assessment_standards', [])
            for std_idx, standard in enumerate(standards, start=1):
                if isinstance(standard, dict):
                    # Enriched format with code and description
                    code = standard.get('code', f'AS{outcome_idx}.{std_idx}')
                    description = standard.get('description', standard.get('title', ''))
                    all_standards.append((code, description, f'O{outcome_idx}'))
                elif isinstance(standard, str):
                    # Bare string - use as description
                    code = f'AS{outcome_idx}.{std_idx}'
                    all_standards.append((code, standard, f'O{outcome_idx}'))

        # Write standards in enriched format
        if all_standards:
            for code, description, outcome_ref in all_standards:
                lines.append(f"- **{code}** (Outcome: {outcome_ref}): {description}")
        else:
            lines.append("- (No assessment standards defined)")

        lines.append("")

    # Recommended Sequence
    if recommended_sequence:
        lines.append("## Recommended Sequence")
        for idx, item in enumerate(recommended_sequence, start=1):
            lines.append(f"{idx}. {item}")
        lines.append("")

    # Sequence Rationale
    if sequence_rationale:
        lines.append("## Sequence Rationale")
        lines.append(sequence_rationale)
        lines.append("")

    # Delivery Notes
    if delivery_notes:
        lines.append("## Delivery Notes")
        for note in delivery_notes:
            lines.append(f"- {note}")
        lines.append("")

    # Assessment Model
    if assessment_model:
        lines.append("## Assessment Model")

        coursework_type = assessment_model.get('coursework_type', 'N/A')
        coursework_weight = assessment_model.get('coursework_weight_percent', 0)
        lines.append(f"**Type**: {coursework_type}")
        lines.append(f"**Weight**: {coursework_weight}%")

        coursework_notes = assessment_model.get('coursework_notes', '')
        if coursework_notes:
            lines.append(f"**Notes**: {coursework_notes}")

        # Calculator policy (if present)
        calculator_policy = assessment_model.get('calculator_policy', '')
        if calculator_policy:
            lines.append(f"**Calculator Policy**: {calculator_policy}")

        lines.append("")

    # Marking Guidance
    if marking_guidance and marking_guidance.get('provided'):
        lines.append("## Marking Guidance")
        guidance_text = marking_guidance.get('guidance', '')
        if guidance_text:
            lines.append(guidance_text)
        lines.append("")

    # Footer
    lines.append("---")
    lines.append(f"Extracted from Appwrite: {datetime.now().isoformat()}")
    lines.append(f"Document extracted using Python utility (no LLM processing)")

    return lines
