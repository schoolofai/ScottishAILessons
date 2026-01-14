"""Course Mapper for Walkthrough V2.

Maps paper metadata (subject, level) to SQA course IDs for SOW/lesson lookup.
This enables the walkthrough author to link prerequisite topics to relevant
lessons from the Authored_SOW collection.
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


# SQA Course ID mappings
# These IDs match the courseId field in the Authored_SOW collection
# Format: (subject, level) -> course_id
LEVEL_TO_COURSE_ID: Dict[tuple, str] = {
    # Mathematics
    ("Mathematics", "National 5"): "C847-75",
    ("Mathematics", "Higher"): "C847-76",
    ("Mathematics", "Advanced Higher"): "C847-77",
    ("Mathematics", "National 4"): "C847-74",
    ("Mathematics", "National 3"): "C847-73",

    # Application of Mathematics
    ("Application of Mathematics", "National 5"): "C846-75",
    ("Application of Mathematics", "National 4"): "C846-74",
    ("Application of Mathematics", "National 3"): "C846-73",

    # Lifeskills Mathematics
    ("Lifeskills Mathematics", "National 5"): "C848-75",
    ("Lifeskills Mathematics", "National 4"): "C848-74",
    ("Lifeskills Mathematics", "National 3"): "C848-73",
}

# Alternative subject name mappings for flexibility
SUBJECT_ALIASES: Dict[str, str] = {
    "Maths": "Mathematics",
    "Math": "Mathematics",
    "N5 Maths": "Mathematics",
    "N5 Mathematics": "Mathematics",
    "Higher Maths": "Mathematics",
    "Higher Mathematics": "Mathematics",
    "App Maths": "Application of Mathematics",
    "Application Maths": "Application of Mathematics",
    "Applications of Maths": "Application of Mathematics",
    "Lifeskills Maths": "Lifeskills Mathematics",
    "Life Skills Maths": "Lifeskills Mathematics",
}

# Level aliases for flexibility
LEVEL_ALIASES: Dict[str, str] = {
    "N5": "National 5",
    "N4": "National 4",
    "N3": "National 3",
    "Nat 5": "National 5",
    "Nat 4": "National 4",
    "Nat 3": "National 3",
    "AH": "Advanced Higher",
    "Adv Higher": "Advanced Higher",
}


def normalize_subject(subject: str) -> str:
    """Normalize subject name using aliases.

    Args:
        subject: Subject name in any format

    Returns:
        Normalized subject name
    """
    subject_clean = subject.strip()
    return SUBJECT_ALIASES.get(subject_clean, subject_clean)


def normalize_level(level: str) -> str:
    """Normalize level name using aliases.

    Args:
        level: Level name in any format

    Returns:
        Normalized level name
    """
    level_clean = level.strip()
    return LEVEL_ALIASES.get(level_clean, level_clean)


def get_course_id_for_paper(subject: str, level: str) -> Optional[str]:
    """Get courseId for SOW/lesson lookup.

    Args:
        subject: Subject name (e.g., 'Mathematics', 'Maths', 'N5 Maths')
        level: Level name (e.g., 'National 5', 'N5', 'Higher')

    Returns:
        Course ID if found, None otherwise
    """
    normalized_subject = normalize_subject(subject)
    normalized_level = normalize_level(level)

    course_id = LEVEL_TO_COURSE_ID.get((normalized_subject, normalized_level))

    if course_id:
        logger.info(f"Mapped ({subject}, {level}) -> {course_id}")
    else:
        logger.warning(f"No course ID found for ({subject}, {level})")
        logger.warning(f"Normalized to ({normalized_subject}, {normalized_level})")

    return course_id


def get_course_fallback_url(course_id: str) -> str:
    """Generate a fallback URL for course overview.

    Used when no specific lesson is found for a topic.

    Args:
        course_id: SQA course ID

    Returns:
        URL to course overview page
    """
    return f"/courses/{course_id}"


def extract_subject_level_from_paper_id(paper_id: str) -> tuple[Optional[str], Optional[str]]:
    """Extract subject and level from a paper ID.

    Paper ID format: {subject}-{level}-{year}-{paper_code}
    Example: mathematics-n5-2023-X847-75-01

    Args:
        paper_id: Full paper identifier

    Returns:
        Tuple of (subject, level) or (None, None) if parsing fails
    """
    parts = paper_id.lower().split("-")

    if len(parts) < 2:
        logger.warning(f"Cannot parse paper_id: {paper_id}")
        return None, None

    subject_part = parts[0]
    level_part = parts[1]

    # Map common subject parts
    subject_map = {
        "mathematics": "Mathematics",
        "maths": "Mathematics",
        "math": "Mathematics",
        "application": "Application of Mathematics",
        "lifeskills": "Lifeskills Mathematics",
    }

    # Map level abbreviations
    level_map = {
        "n5": "National 5",
        "n4": "National 4",
        "n3": "National 3",
        "higher": "Higher",
        "ah": "Advanced Higher",
    }

    subject = subject_map.get(subject_part)
    level = level_map.get(level_part)

    if subject and level:
        logger.info(f"Extracted from paper_id '{paper_id}': subject={subject}, level={level}")
        return subject, level
    else:
        logger.warning(f"Could not fully parse paper_id: {paper_id}")
        return subject, level


def get_course_id_from_paper_id(paper_id: str) -> Optional[str]:
    """Get course ID directly from paper ID.

    Convenience function that combines extraction and mapping.

    Args:
        paper_id: Full paper identifier

    Returns:
        Course ID if found, None otherwise
    """
    subject, level = extract_subject_level_from_paper_id(paper_id)

    if not subject or not level:
        return None

    return get_course_id_for_paper(subject, level)


def is_v2_pilot_paper(paper_id: str) -> bool:
    """Check if this paper should use V2 prompts.

    V2 pilot completed successfully - now enabled for ALL papers.
    Function kept for backward compatibility with existing code.

    V2 features (now standard):
    - Concept-first explanations (concept_explanation field)
    - Peer explainer tone (peer_tip field)
    - Exam-specific warnings (student_warning field)
    - Prerequisite links to lessons (prerequisite_links array)
    - Learning gap analysis (learning_gap field in errors)
    - Related topics for review (related_topics field in errors)

    Args:
        paper_id: Paper identifier (ignored - V2 enabled for all)

    Returns:
        True (V2 is now the default for all papers)
    """
    _ = paper_id  # Unused - V2 enabled for all papers
    return True
