"""Input Validators for Pipeline Parameters.

Validates subject/level combinations against known SQA courses.

Usage:
    from devops.lib.validators import validate_subject_level

    validate_subject_level("mathematics", "national_5")  # OK
    validate_subject_level("math", "n5")  # Normalized to mathematics/national_5
    validate_subject_level("invalid", "level")  # Raises ValueError
"""

from typing import Tuple, Optional, Dict, List
import re


# Valid SQA subjects (underscore format for CLI, hyphen format for database)
VALID_SUBJECTS = {
    "mathematics": ["mathematics", "math", "maths"],
    "application_of_mathematics": ["application_of_mathematics", "aom", "app_math", "application-of-mathematics"],
    "applications_of_mathematics": ["applications_of_mathematics", "aoms", "apps_math", "applications-of-mathematics"],
    "physics": ["physics", "phys"],
    "chemistry": ["chemistry", "chem"],
    "biology": ["biology", "bio"],
    "computing_science": ["computing_science", "computing", "cs", "computing-science"],
    "english": ["english", "eng"],
    "history": ["history", "hist"],
    "geography": ["geography", "geo"],
    "modern_studies": ["modern_studies", "modern-studies", "ms"],
    "music": ["music"],
    "art": ["art", "art_and_design"],
    "drama": ["drama"],
    "french": ["french"],
    "german": ["german"],
    "spanish": ["spanish"],
    "gaelic": ["gaelic"],
}

# Valid SQA levels (underscore format for CLI, hyphen format for database)
VALID_LEVELS = {
    "national_3": ["national_3", "national-3", "n3", "nat3"],
    "national_4": ["national_4", "national-4", "n4", "nat4"],
    "national_5": ["national_5", "national-5", "n5", "nat5"],
    "higher": ["higher", "h", "high"],
    "advanced_higher": ["advanced_higher", "advanced-higher", "ah", "adv_higher"],
}


def normalize_subject(subject: str) -> str:
    """Normalize subject input to canonical underscore format.

    Args:
        subject: Subject string (any format)

    Returns:
        Normalized subject (underscore format)

    Raises:
        ValueError: If subject is not recognized
    """
    subject_lower = subject.lower().strip()

    for canonical, aliases in VALID_SUBJECTS.items():
        if subject_lower in aliases or subject_lower == canonical:
            return canonical

    valid_list = list(VALID_SUBJECTS.keys())
    raise ValueError(
        f"Invalid subject: '{subject}'. "
        f"Valid subjects: {', '.join(valid_list)}"
    )


def normalize_level(level: str) -> str:
    """Normalize level input to canonical underscore format.

    Args:
        level: Level string (any format)

    Returns:
        Normalized level (underscore format)

    Raises:
        ValueError: If level is not recognized
    """
    level_lower = level.lower().strip()

    for canonical, aliases in VALID_LEVELS.items():
        if level_lower in aliases or level_lower == canonical:
            return canonical

    valid_list = list(VALID_LEVELS.keys())
    raise ValueError(
        f"Invalid level: '{level}'. "
        f"Valid levels: {', '.join(valid_list)}"
    )


def validate_subject_level(subject: str, level: str) -> Tuple[str, str]:
    """Validate and normalize subject/level combination.

    Args:
        subject: Subject string (any format)
        level: Level string (any format)

    Returns:
        Tuple of (normalized_subject, normalized_level)

    Raises:
        ValueError: If subject or level is invalid
    """
    normalized_subject = normalize_subject(subject)
    normalized_level = normalize_level(level)

    return normalized_subject, normalized_level


def subject_to_db_format(subject: str) -> str:
    """Convert subject from underscore to hyphen format for database.

    Args:
        subject: Subject in underscore format

    Returns:
        Subject in hyphen format
    """
    return subject.replace("_", "-")


def level_to_db_format(level: str) -> str:
    """Convert level from underscore to hyphen format for database.

    Args:
        level: Level in underscore format

    Returns:
        Level in hyphen format
    """
    return level.replace("_", "-")


def validate_course_id(course_id: str) -> bool:
    """Validate course ID format.

    Args:
        course_id: Course ID to validate

    Returns:
        True if valid format

    Raises:
        ValueError: If format is invalid
    """
    pattern = r"^course_[a-zA-Z0-9]+$"
    if not re.match(pattern, course_id):
        raise ValueError(
            f"Invalid course_id format: '{course_id}'. "
            f"Expected format: course_XXXXX (e.g., course_c84775)"
        )
    return True


def validate_run_id(run_id: str) -> bool:
    """Validate run ID format.

    Args:
        run_id: Run ID to validate

    Returns:
        True if valid format

    Raises:
        ValueError: If format is invalid
    """
    # Format: YYYYMMDD_HHMMSS
    pattern = r"^\d{8}_\d{6}$"
    if not re.match(pattern, run_id):
        raise ValueError(
            f"Invalid run_id format: '{run_id}'. "
            f"Expected format: YYYYMMDD_HHMMSS (e.g., 20260109_143022)"
        )
    return True


def get_valid_subjects() -> List[str]:
    """Get list of valid subjects."""
    return list(VALID_SUBJECTS.keys())


def get_valid_levels() -> List[str]:
    """Get list of valid levels."""
    return list(VALID_LEVELS.keys())


def get_subject_aliases(subject: str) -> List[str]:
    """Get all aliases for a subject.

    Args:
        subject: Canonical subject name

    Returns:
        List of aliases including canonical name
    """
    return VALID_SUBJECTS.get(subject, [])


def get_level_aliases(level: str) -> List[str]:
    """Get all aliases for a level.

    Args:
        level: Canonical level name

    Returns:
        List of aliases including canonical name
    """
    return VALID_LEVELS.get(level, [])
