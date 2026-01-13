"""Lesson Linker for Walkthrough V2.

Links question topics to relevant course lessons for prerequisite reminders.
Searches SOW entries by topic tags and returns matching lesson template references.

V2 Enhancement: Enables students to access relevant lessons directly
from the walkthrough when they need to brush up on prerequisites.
"""

import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

from .appwrite_mcp import list_appwrite_documents
from .compression import decompress_json_gzip_base64

logger = logging.getLogger(__name__)


# Pre-defined topic reminders for N5 Mathematics
# These provide quick concept refreshers for common topics
TOPIC_REMINDERS: Dict[str, str] = {
    # Number topics
    "fractions": "Fractions represent parts of a whole. The numerator (top) counts how many parts you have, the denominator (bottom) tells you how many equal parts make the whole.",
    "mixed-numbers": "A mixed number like 2½ combines whole numbers and fractions. To convert to improper: multiply the whole by the denominator, then add the numerator (2½ = 5/2).",
    "division": "Division asks 'how many times does B fit into A?' For fractions, we flip and multiply because it gives the same answer - it's a mathematical shortcut.",
    "percentages": "Percent means 'per hundred'. So 25% = 25/100 = 0.25 = one quarter. To find a percentage OF something, multiply by the decimal.",
    "percentages-increase": "For percentage increase: find the percentage amount, then ADD it to the original. Or multiply by (1 + rate as decimal).",
    "percentages-decrease": "For percentage decrease: find the percentage amount, then SUBTRACT from original. Or multiply by (1 - rate as decimal).",
    "ratio": "Ratios compare quantities. A ratio of 3:2 means for every 3 of one thing, there are 2 of the other. Total parts = 3+2 = 5.",
    "proportion": "Proportion means two ratios are equal. If quantities are in direct proportion, when one doubles, the other doubles too.",
    "negative-numbers": "Negative numbers are less than zero. When multiplying/dividing: same signs give positive, different signs give negative.",
    "rounding": "To round: look at the digit after your target. If it's 5 or more, round up. If it's 4 or less, round down.",
    "significant-figures": "Significant figures count meaningful digits. Start counting from the first non-zero digit. Zeros between sig figs count.",

    # Algebra topics
    "algebra": "Algebra uses letters (variables) to represent unknown numbers. An expression is a mathematical phrase, an equation says two things are equal.",
    "simplifying": "To simplify algebraic expressions, collect like terms (same letter and power). 3x + 2x = 5x. Different letters stay separate.",
    "expanding": "Expanding brackets means multiplying each term inside by what's outside. 3(x + 2) = 3x + 6. For double brackets, use FOIL.",
    "factorising": "Factorising is the reverse of expanding - find what's common and take it outside. 6x + 9 = 3(2x + 3).",
    "quadratics": "Quadratic expressions have x² as the highest power. The graph is always a parabola (U-shape or inverted U). Standard form: ax² + bx + c.",
    "quadratic-formula": "The quadratic formula solves ax² + bx + c = 0: x = (-b ± √(b²-4ac)) / 2a. Use when factorising is difficult.",
    "solving-equations": "To solve equations, do the same operation to both sides to isolate the variable. Undo operations in reverse order.",
    "simultaneous-equations": "Simultaneous equations share a common solution. Find it by elimination (make coefficients match) or substitution.",
    "inequalities": "Inequalities use < (less than), > (greater than), ≤, ≥. Solve like equations, but flip the sign if multiplying/dividing by negative.",
    "indices": "Index laws: multiply = add powers (x² × x³ = x⁵), divide = subtract powers (x⁵ ÷ x² = x³), power of power = multiply (x²)³ = x⁶.",
    "surds": "Surds are roots that don't simplify to whole numbers (like √2). To simplify: √12 = √(4×3) = 2√3. Rationalise by multiplying top and bottom.",

    # Geometry topics
    "angles": "Angles measure turn in degrees. A full turn is 360°, a straight line is 180°, a right angle is 90°.",
    "triangles": "Triangle angles sum to 180°. Isosceles has 2 equal sides and angles. Equilateral has all sides and angles equal (60° each).",
    "pythagoras": "In a right-angled triangle: a² + b² = c² where c is the hypotenuse (longest side, opposite the right angle).",
    "trigonometry": "In right triangles: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent. Remember SOHCAHTOA.",
    "area": "Area measures the space inside a shape. Rectangle = l × w, Triangle = ½ × base × height, Circle = πr².",
    "volume": "Volume measures 3D space. Cuboid = l × w × h, Cylinder = πr²h, Prism = area of cross-section × length.",
    "circle": "Circle facts: circumference = πd or 2πr, area = πr². A radius goes from centre to edge, diameter = 2 × radius.",
    "coordinates": "Coordinates locate points on a grid: (x, y). x is horizontal (along), y is vertical (up). Positive/negative shows direction.",
    "gradient": "Gradient measures steepness. Calculate as 'rise over run' = (change in y)/(change in x) = (y₂-y₁)/(x₂-x₁).",
    "straight-line": "Straight line equation: y = mx + c. m is the gradient (steepness), c is the y-intercept (where it crosses y-axis).",

    # Statistics topics
    "mean": "Mean (average) = sum of all values ÷ number of values. It uses every data point.",
    "median": "Median is the middle value when data is ordered. For even number of values, find the mean of the middle two.",
    "mode": "Mode is the most common value - the one that appears most often. There can be more than one mode.",
    "range": "Range = highest value - lowest value. It shows how spread out the data is.",
    "probability": "Probability = favourable outcomes ÷ total possible outcomes. Always between 0 (impossible) and 1 (certain).",
    "scatter-graphs": "Scatter graphs show relationships between two variables. Points cluster in patterns: positive, negative, or no correlation.",
    "line-of-best-fit": "Line of best fit goes through the middle of scattered points, roughly equal points above and below. Use for predictions.",

    # Default fallback
    "default": "Review your notes on this topic before attempting the question. Understanding the underlying concept will help you tackle similar problems."
}


def get_topic_reminder(topic_tag: str) -> str:
    """Get a concept reminder for a topic tag.

    Args:
        topic_tag: Topic tag from the question (e.g., 'fractions', 'quadratics')

    Returns:
        A quick concept reminder for the topic
    """
    # Normalize the topic tag
    normalized = topic_tag.lower().replace("_", "-").strip()

    # Try direct match first
    if normalized in TOPIC_REMINDERS:
        return TOPIC_REMINDERS[normalized]

    # Try partial match
    for key, reminder in TOPIC_REMINDERS.items():
        if key in normalized or normalized in key:
            return reminder

    # Fallback with topic name
    return f"Review your notes on {topic_tag.replace('-', ' ').replace('_', ' ')} before attempting this question."


async def get_authored_sow_for_course(
    course_id: str,
    mcp_config_path: str
) -> Optional[Dict[str, Any]]:
    """Fetch the published Authored_SOW for a course.

    Args:
        course_id: Course identifier (e.g., 'C847-75' for N5 Maths)
        mcp_config_path: Path to MCP configuration

    Returns:
        SOW document with parsed entries, or None if not found
    """
    logger.info(f"Fetching Authored_SOW for course_id='{course_id}'")

    try:
        sow_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[
                f'equal("courseId", "{course_id}")',
                'equal("status", "published")'
            ],
            mcp_config_path=mcp_config_path
        )

        if not sow_docs or len(sow_docs) == 0:
            logger.warning(f"No published SOW found for course_id='{course_id}'")
            return None

        sow_doc = sow_docs[0]

        # Parse entries field
        entries = sow_doc.get('entries', [])
        if isinstance(entries, str):
            try:
                entries = decompress_json_gzip_base64(entries)
            except ValueError as e:
                logger.error(f"Failed to decompress entries: {e}")
                return None

        sow_doc['entries'] = entries
        logger.info(f"Found SOW with {len(entries)} entries")
        return sow_doc

    except Exception as e:
        logger.error(f"Error fetching SOW for course_id='{course_id}': {e}")
        return None


def _normalize_topic(topic: str) -> str:
    """Normalize a topic string for matching."""
    return topic.lower().replace("-", " ").replace("_", " ").strip()


def _topic_matches(topic: str, text: str) -> bool:
    """Check if a topic matches within text (fuzzy)."""
    normalized_topic = _normalize_topic(topic)
    normalized_text = text.lower() if text else ""

    # Direct substring match
    if normalized_topic in normalized_text:
        return True

    # Word-level match
    topic_words = set(normalized_topic.split())
    text_words = set(normalized_text.split())
    if topic_words & text_words:  # Any overlap
        return True

    return False


async def find_lessons_for_topic(
    topic_tag: str,
    course_id: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Find lesson templates that cover a given topic.

    Searches the Authored_SOW for entries that match the topic tag by:
    1. Checking entry labels and block names
    2. Checking standards/skills addressed descriptions
    3. Checking engagement tags

    Args:
        topic_tag: Topic to search for (e.g., 'fractions', 'quadratics')
        course_id: Course identifier (e.g., 'C847-75')
        mcp_config_path: Path to MCP configuration

    Returns:
        List of matching lesson references:
        [{"lesson_template_id": "...", "label": "...", "sow_order": 1}]
    """
    logger.info(f"Searching for lessons matching topic='{topic_tag}' in course='{course_id}'")

    sow = await get_authored_sow_for_course(course_id, mcp_config_path)
    if not sow:
        logger.warning(f"No SOW found for course_id='{course_id}'")
        return []

    entries = sow.get('entries', [])
    matching_lessons = []

    for entry in entries:
        matched = False

        # Check label (e.g., "Introduction to Fractions")
        label = entry.get('label', '')
        if _topic_matches(topic_tag, label):
            matched = True

        # Check coherence block_name if present
        coherence = entry.get('coherence', {})
        if isinstance(coherence, dict):
            block_name = coherence.get('block_name', '')
            if _topic_matches(topic_tag, block_name):
                matched = True

        # Check standards_or_skills_addressed
        standards = entry.get('standards_or_skills_addressed', [])
        if isinstance(standards, list):
            for standard in standards:
                if isinstance(standard, dict):
                    description = standard.get('description', '')
                    skill_name = standard.get('skill_name', '')
                    if _topic_matches(topic_tag, description) or _topic_matches(topic_tag, skill_name):
                        matched = True
                        break

        # Check engagement_tags
        engagement_tags = entry.get('engagement_tags', [])
        if isinstance(engagement_tags, list):
            for tag in engagement_tags:
                if _topic_matches(topic_tag, str(tag)):
                    matched = True
                    break

        if matched:
            lesson_ref = {
                "lesson_template_id": entry.get('lessonTemplateRef', ''),
                "label": label,
                "sow_order": entry.get('order', 0)
            }
            # Only add if there's a lesson template reference
            if lesson_ref["lesson_template_id"]:
                matching_lessons.append(lesson_ref)
                logger.debug(f"Matched lesson: {label} (order {entry.get('order')})")

    logger.info(f"Found {len(matching_lessons)} lessons matching topic='{topic_tag}'")
    return matching_lessons


async def build_prerequisite_links(
    topic_tags: List[str],
    course_id: str,
    mcp_config_path: str
) -> List[Dict[str, Any]]:
    """Build prerequisite links for a list of topics.

    Creates PrerequisiteLink-compatible dictionaries for each topic,
    with lesson references if available, or course fallback if not.

    Args:
        topic_tags: List of topic tags from the question
        course_id: Course identifier
        mcp_config_path: Path to MCP configuration

    Returns:
        List of prerequisite link dictionaries
    """
    prerequisite_links = []

    for topic in topic_tags:
        lessons = await find_lessons_for_topic(topic, course_id, mcp_config_path)

        prerequisite_links.append({
            "topic_tag": topic,
            "reminder_text": get_topic_reminder(topic),
            "lesson_refs": lessons,
            "course_fallback": f"/courses/{course_id}" if not lessons else None
        })

    return prerequisite_links
