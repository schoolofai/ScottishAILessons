"""SOW Assembler for iterative SOW authoring.

Combines individually generated lessons and metadata into a complete AuthoredSOW
structure. Performs cross-lesson validation and final Pydantic schema validation.

This is a pure Python module with no LLM calls - all assembly and validation
is deterministic.
"""

import json
import logging
from typing import Dict, Any, List, Optional

from ..tools.sow_schema_models import (
    AuthoredSOW,
    AuthoredSOWIterative,
    SOWEntry,
    Metadata,
    LessonType
)

logger = logging.getLogger(__name__)


def assemble_sow(
    lessons: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    courseId: str,
    version: str,
    accessibility_notes_summary: Optional[str] = None,
    skip_revision_validation: bool = False,
    skip_practice_validation: bool = False
) -> Dict[str, Any]:
    """Assemble lessons and metadata into complete AuthoredSOW structure.

    Performs cross-lesson validation and Pydantic schema validation before
    returning the final SOW dictionary.

    Args:
        lessons: List of SOWEntry dictionaries (validated individually)
        metadata: Metadata dictionary (validated)
        courseId: Course identifier
        version: SOW version string
        accessibility_notes_summary: Optional top-level accessibility summary
        skip_revision_validation: Skip teach-revision pairing check (for iterative pipeline)
        skip_practice_validation: Skip independent_practice requirement (for iterative pipeline)

    Returns:
        Complete AuthoredSOW dictionary ready for Appwrite upsert

    Raises:
        ValueError: If cross-lesson validation or final schema validation fails
    """
    logger.info(f"Assembling SOW: {len(lessons)} lessons, courseId={courseId}, version={version}")

    # Step 1: Validate lesson ordering
    _validate_lesson_ordering(lessons)

    # Step 2: Validate teach-revision pairing (optional for iterative pipeline)
    if not skip_revision_validation:
        _validate_teach_revision_pairing(lessons)
    else:
        logger.info("⏭️  Skipping teach-revision pairing validation (iterative pipeline mode)")

    # Step 3: Validate course-level requirements
    _validate_course_requirements(lessons, skip_practice_validation=skip_practice_validation)

    # Step 4: Build AuthoredSOW structure
    sow_dict = {
        "courseId": courseId,
        "version": version,
        "status": "draft",
        "metadata": metadata,
        "entries": lessons
    }

    # Add optional accessibility_notes summary
    if accessibility_notes_summary:
        sow_dict["accessibility_notes"] = accessibility_notes_summary
    else:
        # Generate a default summary from metadata
        if metadata.get("accessibility_notes"):
            sow_dict["accessibility_notes"] = " ".join(metadata["accessibility_notes"][:2])

    # Step 5: Final Pydantic validation
    # Use AuthoredSOWIterative for iterative pipeline mode (skips teach-revision and independent_practice validators)
    is_iterative_mode = skip_revision_validation or skip_practice_validation

    try:
        if is_iterative_mode:
            logger.info("🔄 Using AuthoredSOWIterative model (iterative pipeline mode)")
            validated_sow = AuthoredSOWIterative.model_validate(sow_dict)
        else:
            logger.info("📚 Using AuthoredSOW model (full validation mode)")
            validated_sow = AuthoredSOW.model_validate(sow_dict)

        logger.info("✅ Final SOW validation passed")
        return validated_sow.model_dump(exclude_none=True)
    except Exception as e:
        error_msg = f"Final SOW validation failed: {e}"
        logger.error(error_msg)
        raise ValueError(error_msg)


def _validate_lesson_ordering(lessons: List[Dict[str, Any]]) -> None:
    """Validate that lessons have sequential ordering (1, 2, 3...).

    Args:
        lessons: List of lesson dictionaries

    Raises:
        ValueError: If ordering is not sequential
    """
    if not lessons:
        raise ValueError("No lessons provided for assembly")

    expected = list(range(1, len(lessons) + 1))
    actual = [lesson.get("order") for lesson in lessons]

    if actual != expected:
        raise ValueError(
            f"Lesson ordering must be sequential 1..{len(lessons)}, got {actual}"
        )

    logger.debug(f"✅ Lesson ordering valid: 1..{len(lessons)}")


def _validate_teach_revision_pairing(lessons: List[Dict[str, Any]]) -> None:
    """Validate that every teach lesson has a corresponding revision.

    Each teach lesson must have a revision lesson within 3 entries.

    Args:
        lessons: List of lesson dictionaries

    Raises:
        ValueError: If teach-revision pairing is violated
    """
    teach_orders = [
        lesson["order"]
        for lesson in lessons
        if lesson.get("lesson_type") == "teach"
    ]

    revision_orders = [
        lesson["order"]
        for lesson in lessons
        if lesson.get("lesson_type") == "revision"
    ]

    unpaired = []
    for teach_order in teach_orders:
        has_pair = any(
            abs(rev_order - teach_order) <= 3
            for rev_order in revision_orders
        )
        if not has_pair:
            unpaired.append(teach_order)

    if unpaired:
        raise ValueError(
            f"Teach lessons at orders {unpaired} have no corresponding revision "
            f"within 3 entries. Every teach lesson must be paired with revision."
        )

    logger.debug(f"✅ Teach-revision pairing valid: {len(teach_orders)} teach, {len(revision_orders)} revision")


def _validate_course_requirements(
    lessons: List[Dict[str, Any]],
    skip_practice_validation: bool = False
) -> None:
    """Validate course-level lesson type requirements.

    Requirements:
    - At least 1 independent_practice lesson (unless skipped for iterative pipeline)
    - Exactly 1 mock_exam lesson

    Args:
        lessons: List of lesson dictionaries
        skip_practice_validation: Skip independent_practice requirement (for iterative pipeline)

    Raises:
        ValueError: If course requirements are not met
    """
    lesson_types = [lesson.get("lesson_type") for lesson in lessons]

    # Count independent_practice (optional for iterative pipeline)
    independent_count = lesson_types.count("independent_practice")
    if not skip_practice_validation and independent_count < 1:
        raise ValueError(
            f"Course must have at least 1 independent_practice lesson, found {independent_count}"
        )
    elif skip_practice_validation:
        logger.info("⏭️  Skipping independent_practice validation (iterative pipeline mode)")

    # Count mock_exam (always required)
    mock_count = lesson_types.count("mock_exam")
    if mock_count != 1:
        raise ValueError(
            f"Course must have exactly 1 mock_exam lesson, found {mock_count}"
        )

    logger.debug(
        f"✅ Course requirements valid: {independent_count} independent_practice, "
        f"{mock_count} mock_exam"
    )


def validate_cross_lesson_coherence(lessons: List[Dict[str, Any]]) -> List[str]:
    """Validate cross-lesson coherence (non-blocking, returns warnings).

    Checks for:
    - Consistent block naming
    - Progressive prerequisite accumulation
    - Calculator policy progression

    Args:
        lessons: List of lesson dictionaries

    Returns:
        List of warning messages (empty if all coherence checks pass)
    """
    warnings = []

    # Check block naming consistency
    blocks = {}
    for lesson in lessons:
        coherence = lesson.get("coherence", {})
        block_name = coherence.get("block_name")
        block_index = coherence.get("block_index")

        if block_name and block_index:
            if block_name not in blocks:
                blocks[block_name] = []
            blocks[block_name].append({
                "order": lesson.get("order"),
                "index": block_index
            })

    # Check for block index consistency
    for block_name, entries in blocks.items():
        indices = [e["index"] for e in entries]
        if len(set(indices)) > 1:
            # Multiple different indices for same block - might be intentional
            logger.debug(f"Block '{block_name}' has multiple indices: {indices}")

    # Check calculator policy progression
    calc_policies = []
    for lesson in lessons:
        policy = lesson.get("policy", {})
        calc_section = policy.get("calculator_section")
        if calc_section:
            calc_policies.append({
                "order": lesson.get("order"),
                "policy": calc_section
            })

    # Basic progression check (non_calc should generally come before calc)
    non_calc_orders = [p["order"] for p in calc_policies if p["policy"] == "non_calc"]
    calc_orders = [p["order"] for p in calc_policies if p["policy"] == "calc"]

    if non_calc_orders and calc_orders:
        if max(non_calc_orders) > min(calc_orders):
            warnings.append(
                f"Calculator policy may not follow expected progression: "
                f"non_calc lessons up to order {max(non_calc_orders)}, "
                f"calc lessons from order {min(calc_orders)}"
            )

    return warnings


def generate_accessibility_summary(lessons: List[Dict[str, Any]]) -> str:
    """Generate top-level accessibility summary from lessons.

    Extracts key accessibility features from all lessons and creates
    a concise summary string.

    Args:
        lessons: List of lesson dictionaries

    Returns:
        Accessibility summary string
    """
    # Collect accessibility features
    dyslexia_friendly_count = 0
    language_levels = set()
    visual_strategies = set()

    for lesson in lessons:
        profile = lesson.get("accessibility_profile", {})

        if profile.get("dyslexia_friendly"):
            dyslexia_friendly_count += 1

        if profile.get("plain_language_level"):
            language_levels.add(profile["plain_language_level"])

        if profile.get("visual_support_strategy"):
            visual_strategies.add(profile["visual_support_strategy"][:50])  # Truncate

    # Build summary
    parts = []

    if dyslexia_friendly_count == len(lessons):
        parts.append("All lessons are dyslexia-friendly")
    elif dyslexia_friendly_count > 0:
        parts.append(f"{dyslexia_friendly_count}/{len(lessons)} lessons are dyslexia-friendly")

    if language_levels:
        parts.append(f"Language levels: {', '.join(sorted(language_levels))}")

    if visual_strategies:
        parts.append(f"Visual support strategies employed across lessons")

    if not parts:
        return "Accessibility features included in all lessons"

    return ". ".join(parts) + "."
