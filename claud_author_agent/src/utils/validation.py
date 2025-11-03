"""Input validation for SOW and Lesson author agents.

Validates inputs against database schema and ensures proper format before
pipeline execution.
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


# Valid SQA subjects (from sqa_education.current_sqa collection)
VALID_SUBJECTS = [
    "mathematics",
    "application-of-mathematics",
    "lifeskills-mathematics",
    "numeracy"
]

# Valid SQA levels (from sqa_education.current_sqa collection)
VALID_LEVELS = [
    "national-3",
    "national-4",
    "national-5",
    "higher",
    "advanced-higher"
]


def validate_input_schema(input_data: Dict[str, Any]) -> tuple[bool, str]:
    """Validate SOW Author input data schema and format.

    Checks that input contains required field (courseId) and that value is properly formatted.
    Subject and level are automatically fetched from the database based on courseId.

    Note: This is for SOW Author. For Lesson Author, use validate_lesson_author_input().

    Args:
        input_data: Dictionary containing courseId

    Returns:
        Tuple of (is_valid: bool, error_message: str)
        If valid, error_message is empty string.

    Example:
        >>> validate_input_schema({
        ...     "courseId": "course_c84874"
        ... })
        (True, "")

        >>> validate_input_schema({"subject": "invalid"})
        (False, "Missing required field: courseId")
    """
    # Check required field
    if "courseId" not in input_data:
        return False, "Missing required field: courseId"

    course_id = input_data["courseId"]

    # Validate type
    if not isinstance(course_id, str):
        return False, f"Field 'courseId' must be string, got {type(course_id).__name__}"

    # Validate courseId format (must start with "course_")
    if not course_id.startswith("course_"):
        return False, f"Invalid courseId format: '{course_id}'. Expected format: 'course_*' (e.g., 'course_c84874')"

    logger.info(f"Input validation passed: courseId='{course_id}'")
    return True, ""


def validate_fetched_subject_level(subject: str, level: str) -> tuple[bool, str]:
    """Validate subject and level fetched from database.

    Checks that fetched values are in expected format and logs warnings if
    they don't match known SQA subjects/levels.

    Args:
        subject: SQA subject from database (e.g., 'mathematics')
        level: SQA level from database (e.g., 'national-5')

    Returns:
        Tuple of (is_valid: bool, error_message: str)
        If valid, error_message is empty string.

    Example:
        >>> validate_fetched_subject_level("mathematics", "national-5")
        (True, "")
    """
    # Validate types
    if not isinstance(subject, str):
        return False, f"Fetched subject must be string, got {type(subject).__name__}"

    if not isinstance(level, str):
        return False, f"Fetched level must be string, got {type(level).__name__}"

    # Validate format (must be lowercase with hyphens)
    if not subject.islower() or " " in subject:
        return False, f"Invalid subject format from database: '{subject}'. Expected lowercase with hyphens (e.g., 'application-of-mathematics')"

    if not level.islower() or " " in level:
        return False, f"Invalid level format from database: '{level}'. Expected lowercase with hyphens (e.g., 'national-5')"

    # Validate against known values (warning if not in list, but don't fail)
    if subject not in VALID_SUBJECTS:
        logger.warning(f"Subject '{subject}' not in known subjects: {VALID_SUBJECTS}")

    if level not in VALID_LEVELS:
        logger.warning(f"Level '{level}' not in known levels: {VALID_LEVELS}")

    logger.info(f"Fetched data validation passed: subject='{subject}', level='{level}'")
    return True, ""


def format_subject_display(subject: str) -> str:
    """Convert subject slug to display format.

    Args:
        subject: Subject in database format (e.g., 'application-of-mathematics')

    Returns:
        Display-friendly format (e.g., 'Application Of Mathematics')

    Example:
        >>> format_subject_display("application-of-mathematics")
        'Application Of Mathematics'
    """
    return subject.replace("-", " ").replace("_", " ").title()


def format_level_display(level: str) -> str:
    """Convert level slug to display format.

    Args:
        level: Level in database format (e.g., 'national-5')

    Returns:
        Display-friendly format (e.g., 'National 5')

    Example:
        >>> format_level_display("national-5")
        'National 5'
    """
    return level.replace("-", " ").title()


def validate_lesson_author_input(input_data: Dict[str, Any]) -> tuple[bool, str]:
    """Validate Lesson Author input data schema and format.

    Checks that input contains required fields (courseId, order) and that
    values are properly formatted.

    Args:
        input_data: Dictionary containing courseId and order

    Returns:
        Tuple of (is_valid: bool, error_message: str)
        If valid, error_message is empty string.

    Example:
        >>> validate_lesson_author_input({
        ...     "courseId": "course_c84874",
        ...     "order": 1
        ... })
        (True, "")

        >>> validate_lesson_author_input({"courseId": "course_c84874"})
        (False, "Missing required field: order")
    """
    # Check required fields
    if "courseId" not in input_data:
        return False, "Missing required field: courseId"

    if "order" not in input_data:
        return False, "Missing required field: order"

    course_id = input_data["courseId"]
    order = input_data["order"]

    # Validate types
    if not isinstance(course_id, str):
        return False, f"Field 'courseId' must be string, got {type(course_id).__name__}"

    if not isinstance(order, int):
        return False, f"Field 'order' must be integer, got {type(order).__name__}"

    # Validate courseId format (must start with "course_")
    if not course_id.startswith("course_"):
        return False, f"Invalid courseId format: '{course_id}'. Expected format: 'course_*' (e.g., 'course_c84874')"

    # Validate order is 1-indexed (starts from 1, not 0)
    if order < 1:
        return False, f"Invalid order: {order}. Order must be >= 1 (1-indexed, starts from 1)"

    logger.info(f"Lesson Author input validation passed: courseId='{course_id}', order={order}")
    return True, ""


def validate_diagram_author_input(input_data: Dict[str, Any]) -> tuple[bool, str]:
    """Validate Diagram Author input data schema and format.

    Checks that input contains required fields (courseId, order) and that
    values are properly formatted. Uses same validation as Lesson Author.

    Args:
        input_data: Dictionary containing courseId and order

    Returns:
        Tuple of (is_valid: bool, error_message: str)
        If valid, error_message is empty string.

    Example:
        >>> validate_diagram_author_input({
        ...     "courseId": "course_c84874",
        ...     "order": 5
        ... })
        (True, "")

        >>> validate_diagram_author_input({"courseId": "invalid_format"})
        (False, "Invalid courseId format: ...")
    """
    # Check required fields
    if "courseId" not in input_data:
        return False, "Missing required field: courseId"

    if "order" not in input_data:
        return False, "Missing required field: order"

    course_id = input_data["courseId"]
    order = input_data["order"]

    # Validate types
    if not isinstance(course_id, str):
        return False, f"Field 'courseId' must be string, got {type(course_id).__name__}"

    if not isinstance(order, int):
        return False, f"Field 'order' must be integer, got {type(order).__name__}"

    # Validate courseId format (must start with "course_")
    if not course_id.startswith("course_"):
        return False, f"Invalid courseId format: '{course_id}'. Expected format: 'course_*' (e.g., 'course_c84874')"

    # Validate order is 1-indexed (starts from 1, not 0)
    if order < 1:
        return False, f"Invalid order: {order}. Order must be >= 1 (1-indexed, starts from 1)"

    logger.info(f"Diagram Author input validation passed: courseId='{course_id}', order={order}")
    return True, ""
