"""Utility & helper functions for context-aware chat processing."""

import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage

from .state import TeachingContext, DynamicLessonContext


def get_message_text(msg: BaseMessage) -> str:
    """Get the text content of a message."""
    content = msg.content
    if isinstance(content, str):
        return content
    elif isinstance(content, dict):
        return content.get("text", "")
    else:
        txts = [c if isinstance(c, str) else (c.get("text") or "") for c in content]
        return "".join(txts).strip()


def load_chat_model(fully_specified_name: str) -> BaseChatModel:
    """Load a chat model from a fully specified name.

    Args:
        fully_specified_name (str): String in the format 'provider/model'.
    """
    provider, model = fully_specified_name.split("/", maxsplit=1)
    return init_chat_model(model, model_provider=provider)


def extract_teaching_context(session_context: Dict[str, Any], max_recent_exchanges: int = 5) -> Optional[TeachingContext]:
    """Extract and structure teaching context from session context.

    Args:
        session_context: Direct main graph state structure from teaching session
        max_recent_exchanges: Maximum number of recent exchanges to include

    Returns:
        TeachingContext object or None if context is insufficient
    """
    if not session_context:
        return None

    try:
        # Handle both old format (nested main_graph_state) and new format (direct state)
        # NEW FORMAT: session_context IS the main graph state directly
        if "main_graph_state" in session_context:
            # OLD FORMAT: nested structure for backward compatibility
            main_state = session_context.get("main_graph_state", {})
            print("Using legacy nested main_graph_state format")
        else:
            # NEW FORMAT: direct state structure from main graph
            main_state = session_context
            print("Using direct main graph state format")

        if not main_state:
            print("No state data found in session_context")
            return None

        # Extract lesson_snapshot directly from main graph state
        lesson_snapshot = main_state.get("lesson_snapshot", {})

        # Handle string-encoded lesson snapshot
        if isinstance(lesson_snapshot, str):
            lesson_snapshot = json.loads(lesson_snapshot)

        # Extract recent exchanges from messages
        messages = main_state.get("messages", [])
        recent_exchanges = messages[-max_recent_exchanges:] if messages else []

        # Extract identifiers - main graph flattens these to root level
        session_id = main_state.get("session_id", "")
        student_id = main_state.get("student_id", "")
        course_id = main_state.get("course_id", "") or lesson_snapshot.get("courseId", "")

        # Extract current stage - use mode for general stage awareness
        current_stage = main_state.get("current_stage", main_state.get("mode", "teaching"))

        # Extract teaching progression fields
        current_card_index = main_state.get("current_card_index", 0)
        cards = lesson_snapshot.get("cards", [])
        current_card = None

        # Get the current card based on index
        if isinstance(current_card_index, int) and 0 <= current_card_index < len(cards):
            current_card = cards[current_card_index]

        return TeachingContext(
            session_id=session_id,
            student_id=student_id,
            course_id=course_id,
            lesson_title=lesson_snapshot.get("title", ""),
            lesson_topic=lesson_snapshot.get("topic", ""),
            current_stage=current_stage,
            lesson_snapshot=lesson_snapshot,
            recent_exchanges=recent_exchanges,
            student_progress=main_state.get("student_progress", {}),
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            # Teaching progression fields
            current_card_index=current_card_index,
            current_card=current_card,
            cards_completed=main_state.get("cards_completed", []),
            is_correct=main_state.get("is_correct"),
            should_progress=main_state.get("should_progress"),
            feedback=main_state.get("feedback"),
            hint_level=main_state.get("hint_level", 0),
            attempts=main_state.get("attempts", 0),
            max_attempts=main_state.get("max_attempts", 3),
            evidence=main_state.get("evidence", []),
            mastery_updates=main_state.get("mastery_updates", []),
            stage=main_state.get("stage", ""),
            should_exit=main_state.get("should_exit", False)
        )

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"Error extracting teaching context: {e}")
        return None


def format_recent_exchanges(messages: List[Dict[str, Any]], max_count: int = 5) -> str:
    """Format recent teaching exchanges for prompt inclusion.

    Args:
        messages: List of message dictionaries from teaching session (LangGraph format)
        max_count: Maximum number of messages to include

    Returns:
        Formatted string of recent exchanges
    """
    if not messages:
        return "No recent exchanges available"

    recent = messages[-max_count:]
    formatted = []

    for msg in recent:
        try:
            # LangGraph messages use "type" field instead of "role"
            message_type = msg.get("type", "unknown")
            content = msg.get("content", "")

            # Handle different content formats
            if isinstance(content, dict):
                content = content.get("text", str(content))
            elif isinstance(content, list):
                # Handle array of content parts
                content_parts = []
                for part in content:
                    if isinstance(part, dict):
                        content_parts.append(part.get("text", str(part)))
                    else:
                        content_parts.append(str(part))
                content = " ".join(content_parts)

            # Ensure content is string
            content = str(content).strip()

            # Skip empty messages
            if not content:
                continue

            # Truncate long messages for context
            if len(content) > 150:
                content = content[:147] + "..."

            # Map LangGraph message types to readable roles
            if message_type == "human":
                role = "Student"
            elif message_type == "ai":
                role = "Teacher"
            else:
                role = message_type.title()

            formatted.append(f"- {role}: {content}")

        except (KeyError, TypeError):
            continue

    return "\n".join(formatted) if formatted else "No valid exchanges found"


def extract_lesson_keywords(lesson_snapshot: Dict[str, Any]) -> List[str]:
    """Extract key terms from lesson snapshot for search enhancement.

    Args:
        lesson_snapshot: Lesson data containing title, topic, objectives, etc.

    Returns:
        List of relevant keywords for search enhancement
    """
    keywords = []

    # Extract from title
    if lesson_snapshot.get("title"):
        title_words = re.findall(r'\b\w+\b', lesson_snapshot["title"].lower())
        keywords.extend(title_words)

    # Extract from topic
    if lesson_snapshot.get("topic"):
        topic_words = re.findall(r'\b\w+\b', lesson_snapshot["topic"].lower())
        keywords.extend(topic_words)

    # Extract from objectives
    objectives = lesson_snapshot.get("objectives", [])
    for obj in objectives:
        if isinstance(obj, str):
            obj_words = re.findall(r'\b\w+\b', obj.lower())
            keywords.extend(obj_words)

    # Remove common stop words
    stop_words = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "is", "are", "was", "were", "be", "been", "have",
        "has", "had", "will", "would", "could", "should", "may", "might"
    }

    # Filter and deduplicate
    filtered_keywords = []
    seen = set()
    for keyword in keywords:
        if (len(keyword) > 2 and
            keyword not in stop_words and
            keyword not in seen and
            keyword.isalpha()):  # Only alphabetic words
            filtered_keywords.append(keyword)
            seen.add(keyword)

    return filtered_keywords[:10]  # Limit to top 10 keywords


def calculate_context_quality_score(teaching_context: Optional[TeachingContext]) -> float:
    """Calculate a quality score for the available teaching context.

    Args:
        teaching_context: TeachingContext object to evaluate

    Returns:
        Quality score from 0.0 (no context) to 1.0 (rich context)
    """
    if not teaching_context:
        return 0.0

    score = 0.0

    # Basic identifiers (20%)
    if teaching_context.session_id:
        score += 0.1
    if teaching_context.student_id:
        score += 0.1

    # Lesson information (40%)
    if teaching_context.lesson_title:
        score += 0.15
    if teaching_context.lesson_topic:
        score += 0.15
    if teaching_context.lesson_snapshot:
        score += 0.1

    # Learning state (30%)
    if teaching_context.current_stage:
        score += 0.1
    if teaching_context.recent_exchanges:
        score += 0.1
    if teaching_context.student_progress:
        score += 0.1

    # Recency (10%)
    if teaching_context.timestamp:
        score += 0.1

    return min(score, 1.0)


def format_student_progress(progress_data: Dict[str, Any]) -> str:
    """Format student progress information for prompt inclusion.

    Args:
        progress_data: Student progress dictionary

    Returns:
        Human-readable progress summary
    """
    if not progress_data:
        return "No progress information available"

    formatted_parts = []

    # Difficulty level
    if progress_data.get("difficulty_level"):
        formatted_parts.append(f"Level: {progress_data['difficulty_level'].title()}")

    # Understanding level
    if progress_data.get("understanding_level"):
        understanding = progress_data["understanding_level"]
        if isinstance(understanding, (int, float)):
            percentage = int(understanding * 100)
            formatted_parts.append(f"Understanding: {percentage}%")

    # Current step
    if progress_data.get("current_step"):
        formatted_parts.append(f"Current step: {progress_data['current_step']}")

    # Completed steps
    completed = progress_data.get("completed_steps", [])
    if completed:
        completed_str = ", ".join(completed[:3])  # Show first 3
        if len(completed) > 3:
            completed_str += f" (and {len(completed) - 3} more)"
        formatted_parts.append(f"Completed: {completed_str}")

    # Struggles or difficulty areas
    struggles = progress_data.get("struggles", [])
    if struggles:
        struggles_str = ", ".join(struggles[:2])  # Show first 2
        formatted_parts.append(f"Challenge areas: {struggles_str}")

    return "\n".join(f"- {part}" for part in formatted_parts) if formatted_parts else "Basic progress tracking"


def format_lesson_objectives(lesson_snapshot: Dict[str, Any]) -> str:
    """Format lesson learning objectives for prompt inclusion.

    Args:
        lesson_snapshot: Lesson data containing objectives

    Returns:
        Formatted objectives string
    """
    objectives = lesson_snapshot.get("objectives", [])

    if not objectives:
        return "No specific objectives listed"

    if isinstance(objectives, str):
        return objectives

    if isinstance(objectives, list):
        formatted_objectives = []
        for i, obj in enumerate(objectives[:5], 1):  # Limit to 5 objectives
            formatted_objectives.append(f"{i}. {obj}")
        return "\n".join(formatted_objectives)

    return str(objectives)


def safe_get_nested_value(data: Dict[str, Any], path: str, default: Any = None) -> Any:
    """Safely get a nested value from a dictionary using dot notation.

    Args:
        data: Dictionary to extract from
        path: Dot-separated path (e.g., "lesson_snapshot.title")
        default: Default value if path not found

    Returns:
        Value at path or default
    """
    try:
        value = data
        for key in path.split("."):
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value
    except (KeyError, TypeError, AttributeError):
        return default


def truncate_text(text: str, max_length: int = 200, suffix: str = "...") -> str:
    """Truncate text to a maximum length with suffix.

    Args:
        text: Text to truncate
        max_length: Maximum length including suffix
        suffix: Suffix to add when truncating

    Returns:
        Truncated text
    """
    if not text or len(text) <= max_length:
        return text

    return text[:max_length - len(suffix)] + suffix


def format_math_content(text: str) -> str:
    """Convert various LaTeX formats to standard $ and $$ format.

    This ensures consistency with the frontend's LaTeX rendering which expects
    $ for inline math and $$ for display math.

    Args:
        text: Text potentially containing mathematical expressions

    Returns:
        Text with standardized LaTeX delimiters
    """
    if not text:
        return text

    import re

    # Convert [ ... ] to $$...$$  (display math)
    text = re.sub(r'\[\s*(.*?)\s*\]', r'$$\1$$', text)

    # Convert \( ... \) to $...$ (inline math)
    text = re.sub(r'\\\\?\(\s*(.*?)\s*\\\\?\)', r'$\1$', text)

    # Convert \[ ... \] to $$...$$ (display math)
    text = re.sub(r'\\\\?\[\s*(.*?)\s*\\\\?\]', r'$$\1$$', text)

    # Convert ( ... ) patterns that look mathematical to $...$ (be conservative)
    # Only convert if it contains obvious math symbols
    def is_math_expression(match_text):
        math_indicators = ['\\frac', '\\sqrt', '\\sum', '\\int', '\\lim', '\\pi', '\\theta',
                          '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon',
                          '\\cdot', '\\times', '\\div', '\\pm', '\\le', '\\ge', '\\ne',
                          '\\text{', '\\overline', '\\underline', '^', '_']
        return any(indicator in match_text for indicator in math_indicators)

    # Convert ( ... ) to $...$ only if it contains mathematical content
    def convert_parentheses(match):
        content = match.group(1)
        if is_math_expression(content):
            return f'${content}$'
        return match.group(0)  # Return original if not mathematical

    text = re.sub(r'\(\s*([^)]*(?:\\frac|\\sqrt|\\sum|\\int|\\lim|\\pi|\\theta|\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\cdot|\\times|\\div|\\pm|\\le|\\ge|\\ne|\\text\{|\\overline|\\underline|\^|_)[^)]*)\s*\)', convert_parentheses, text)

    return text


def format_current_card_context(teaching_context: TeachingContext) -> str:
    """Format current card/question information for prompt inclusion.

    Args:
        teaching_context: TeachingContext with current card information

    Returns:
        Formatted string with current question context
    """
    if not teaching_context or not teaching_context.current_card:
        return "No current question available"

    current_card = teaching_context.current_card
    lesson_snapshot = teaching_context.lesson_snapshot
    total_cards = len(lesson_snapshot.get("cards", [])) if lesson_snapshot else 0
    current_index = teaching_context.current_card_index

    # Extract question information
    cfu = current_card.get("cfu", {})
    question_stem = format_math_content(cfu.get("stem", ""))  # Format LaTeX in question
    question_type = cfu.get("type", "unknown")

    # Format question details based on type
    question_details = []
    if question_type == "numeric":
        expected = cfu.get("expected")
        tolerance = cfu.get("tolerance")
        if expected is not None:
            question_details.append(f"Expected answer: {expected}")
        if tolerance is not None:
            question_details.append(f"Tolerance: ±{tolerance}")
    elif question_type == "mcq":
        options = cfu.get("options", [])
        if options:
            question_details.append("Options:")
            for i, option in enumerate(options):
                question_details.append(f"  {chr(65+i)}. {option}")

    formatted_parts = [
        f"Card {current_index + 1} of {total_cards}",
        f"Question: {question_stem}",
        f"Type: {question_type.upper()}"
    ]

    if question_details:
        formatted_parts.extend(question_details)

    # Add attempt information
    attempts = teaching_context.attempts
    max_attempts = teaching_context.max_attempts
    if attempts > 0:
        formatted_parts.append(f"Student attempts: {attempts}/{max_attempts}")

    # Add feedback if available
    if teaching_context.feedback:
        feedback = format_math_content(truncate_text(teaching_context.feedback, 100))
        formatted_parts.append(f"Last feedback: {feedback}")

    # Add correctness status
    if teaching_context.is_correct is not None:
        status = "correct" if teaching_context.is_correct else "incorrect"
        formatted_parts.append(f"Last answer: {status}")

    return "\n".join(formatted_parts)


def format_learning_progress(teaching_context: TeachingContext) -> str:
    """Format overall lesson progress for prompt inclusion.

    Args:
        teaching_context: TeachingContext with lesson progress information

    Returns:
        Formatted string with learning progress summary
    """
    if not teaching_context:
        return "No progress information available"

    lesson_snapshot = teaching_context.lesson_snapshot
    total_cards = len(lesson_snapshot.get("cards", [])) if lesson_snapshot else 0
    completed_cards = len(teaching_context.cards_completed)
    current_index = teaching_context.current_card_index

    progress_parts = []

    # Overall progress
    if total_cards > 0:
        progress_pct = int((completed_cards / total_cards) * 100)
        progress_parts.append(f"Overall progress: {completed_cards}/{total_cards} cards completed ({progress_pct}%)")

    # Current position
    if total_cards > 0:
        progress_parts.append(f"Currently on: Card {current_index + 1} of {total_cards}")

    # Completed cards
    if teaching_context.cards_completed:
        completed_list = ", ".join(teaching_context.cards_completed[:3])
        if len(teaching_context.cards_completed) > 3:
            completed_list += f" (and {len(teaching_context.cards_completed) - 3} more)"
        progress_parts.append(f"Completed cards: {completed_list}")

    # Current stage
    if teaching_context.stage:
        stage_description = {
            "design": "presenting question",
            "deliver": "waiting for student response",
            "mark": "evaluating student answer",
            "progress": "moving to next question",
            "done": "lesson completed"
        }.get(teaching_context.stage.lower(), teaching_context.stage)
        progress_parts.append(f"Current stage: {stage_description}")

    # Evidence/performance data
    evidence_count = len(teaching_context.evidence)
    if evidence_count > 0:
        progress_parts.append(f"Performance data points: {evidence_count}")

    return "\n".join(progress_parts) if progress_parts else "Basic lesson tracking active"


def format_card_explainer_and_examples(current_card: Dict[str, Any]) -> str:
    """Format the explainer and examples from current card for context.

    Args:
        current_card: Current lesson card data

    Returns:
        Formatted explanation and examples
    """
    if not current_card:
        return "No explanation available"

    formatted_parts = []

    # Add card title if available
    if current_card.get("title"):
        formatted_parts.append(f"Topic: {current_card['title']}")

    # Add explainer
    if current_card.get("explainer"):
        explainer = format_math_content(current_card['explainer'])
        formatted_parts.append(f"Concept explanation: {explainer}")

    # Add examples
    examples = current_card.get("example", [])
    if examples:
        formatted_parts.append("Examples:")
        for example in examples[:3]:  # Limit to first 3 examples
            formatted_example = format_math_content(str(example))
            formatted_parts.append(f"  • {formatted_example}")

    return "\n".join(formatted_parts) if formatted_parts else "No detailed explanation available"


# === DUAL-SOURCE CONTEXT EXTRACTION FUNCTIONS ===

def extract_static_context(static_context_data: Dict[str, Any]) -> Optional[TeachingContext]:
    """Extract teaching context from static session data.

    This replaces extract_teaching_context for the new dual-source pattern.
    Static context contains immutable session data that doesn't change during
    graph interrupts.

    Args:
        static_context_data: Static session data from initial conversation input

    Returns:
        TeachingContext object or None if context is insufficient
    """
    if not static_context_data:
        return None

    try:
        # Extract lesson snapshot
        lesson_snapshot = static_context_data.get("lesson_snapshot", {})
        if isinstance(lesson_snapshot, str):
            lesson_snapshot = json.loads(lesson_snapshot)

        # Extract identifiers
        session_id = static_context_data.get("session_id", "")
        student_id = static_context_data.get("student_id", "")
        course_id = lesson_snapshot.get("courseId", "") if lesson_snapshot else ""

        return TeachingContext(
            session_id=session_id,
            student_id=student_id,
            course_id=course_id,
            lesson_title=lesson_snapshot.get("title", ""),
            lesson_topic=lesson_snapshot.get("topic", ""),
            current_stage="teaching",  # Static context assumes teaching mode
            lesson_snapshot=lesson_snapshot,
            recent_exchanges=[],  # Static context doesn't include dynamic exchanges
            student_progress={},  # Static context doesn't include dynamic progress
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            # Initialize progression fields (will be overridden by dynamic context)
            current_card_index=0,
            current_card=None,
            cards_completed=[],
            is_correct=None,
            should_progress=None,
            feedback=None,
            hint_level=0,
            attempts=0,
            max_attempts=3,
            evidence=[],
            mastery_updates=[],
            stage="",
            should_exit=False
        )

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"Error extracting static teaching context: {e}")
        return None


def extract_dynamic_context(dynamic_context_data: Dict[str, Any]) -> Optional[DynamicLessonContext]:
    """Extract dynamic lesson context from UI tool interaction data.

    This processes real-time card presentation data from LessonCardPresentationTool
    that provides accurate context even when main teaching graph is interrupted.

    Args:
        dynamic_context_data: Dynamic context from CurrentCardContext via frontend

    Returns:
        DynamicLessonContext object or None if data is insufficient
    """
    if not dynamic_context_data:
        return None

    try:
        return DynamicLessonContext(
            card_data=dynamic_context_data.get("card_data", {}),
            card_index=dynamic_context_data.get("card_index", 0),
            total_cards=dynamic_context_data.get("total_cards", 0),
            interaction_state=dynamic_context_data.get("interaction_state", "unknown"),
            lesson_context=dynamic_context_data.get("lesson_context")
        )

    except (KeyError, TypeError) as e:
        print(f"Error extracting dynamic lesson context: {e}")
        return None


def merge_dual_source_contexts(
    static_context: Optional[TeachingContext],
    dynamic_context: Optional[DynamicLessonContext]
) -> Dict[str, Any]:
    """Merge static and dynamic contexts into comprehensive lesson context.

    This combines static session data with real-time card presentation data
    to provide accurate context-aware responses even during graph interrupts.

    Args:
        static_context: TeachingContext from initial session data
        dynamic_context: DynamicLessonContext from UI tool interactions

    Returns:
        Dictionary containing merged context data and metadata
    """
    merged_context = {
        "static_available": static_context is not None,
        "dynamic_available": dynamic_context is not None,
        "timestamp": datetime.now(tz=timezone.utc).isoformat()
    }

    # Static context data (baseline session information)
    if static_context:
        merged_context["session"] = {
            "session_id": static_context.session_id,
            "student_id": static_context.student_id,
            "course_id": static_context.course_id,
            "lesson_title": static_context.lesson_title,
            "lesson_topic": static_context.lesson_topic,
            "lesson_snapshot": static_context.lesson_snapshot
        }

        # Extract total cards from lesson snapshot for progress calculation
        lesson_cards = static_context.lesson_snapshot.get("cards", []) if static_context.lesson_snapshot else []
        merged_context["total_cards"] = len(lesson_cards)

    # Dynamic context data (current card presentation)
    if dynamic_context:
        merged_context["current_card"] = {
            "card_index": dynamic_context.card_index,
            "total_cards": dynamic_context.total_cards,
            "card_data": dynamic_context.card_data,
            "interaction_state": dynamic_context.interaction_state,
            "lesson_context": dynamic_context.lesson_context
        }

        # Extract current question details
        card_data = dynamic_context.card_data
        if isinstance(card_data, dict) and card_data.get("cfu"):
            cfu = card_data["cfu"]
            merged_context["current_question"] = {
                "question": format_math_content(cfu.get("stem", "")),  # Fixed: use "stem" not "question"
                "type": cfu.get("type", "unknown"),
                "options": cfu.get("options", []) if cfu.get("type") == "mcq" else None,
                "expected": cfu.get("expected") if cfu.get("type") == "numeric" else None
            }

        # Calculate progress from dynamic context (more accurate)
        if dynamic_context.total_cards > 0:
            progress_percentage = ((dynamic_context.card_index + 1) / dynamic_context.total_cards) * 100
            merged_context["progress"] = {
                "current_card": dynamic_context.card_index + 1,
                "total_cards": dynamic_context.total_cards,
                "percentage": round(progress_percentage, 1)
            }

    # Context consistency check
    consistency_issues = []
    if static_context and dynamic_context:
        # Check if total cards match between static and dynamic sources
        static_total = len(static_context.lesson_snapshot.get("cards", [])) if static_context.lesson_snapshot else 0
        dynamic_total = dynamic_context.total_cards

        if static_total > 0 and dynamic_total > 0 and static_total != dynamic_total:
            consistency_issues.append(f"Card count mismatch: static={static_total}, dynamic={dynamic_total}")

    merged_context["consistency"] = {
        "has_issues": len(consistency_issues) > 0,
        "issues": consistency_issues
    }

    return merged_context


def calculate_dual_source_quality_scores(
    static_context: Optional[TeachingContext],
    dynamic_context: Optional[DynamicLessonContext]
) -> Dict[str, float]:
    """Calculate quality scores for dual-source context.

    Args:
        static_context: TeachingContext from static session data
        dynamic_context: DynamicLessonContext from UI tool interactions

    Returns:
        Dictionary with individual and combined quality scores
    """
    scores = {
        "static_quality": 0.0,
        "dynamic_quality": 0.0,
        "combined_quality": 0.0,
        "consistency_score": 1.0
    }

    # Static context quality (session data completeness)
    if static_context:
        static_score = 0.0

        # Basic identifiers (30%)
        if static_context.session_id:
            static_score += 0.1
        if static_context.student_id:
            static_score += 0.1
        if static_context.course_id:
            static_score += 0.1

        # Lesson information (50%)
        if static_context.lesson_title:
            static_score += 0.15
        if static_context.lesson_topic:
            static_score += 0.15
        if static_context.lesson_snapshot:
            static_score += 0.2

        # Timestamp (20%)
        if static_context.timestamp:
            static_score += 0.2

        scores["static_quality"] = min(static_score, 1.0)

    # Dynamic context quality (current card data completeness)
    if dynamic_context:
        dynamic_score = 0.0

        # Card positioning (30%)
        if dynamic_context.card_index >= 0:
            dynamic_score += 0.15
        if dynamic_context.total_cards > 0:
            dynamic_score += 0.15

        # Card content (50%)
        if dynamic_context.card_data:
            dynamic_score += 0.25

            # Check for CFU (question) data
            if isinstance(dynamic_context.card_data, dict) and dynamic_context.card_data.get("cfu"):
                dynamic_score += 0.25

        # Interaction state (20%)
        if dynamic_context.interaction_state != "unknown":
            dynamic_score += 0.2

        scores["dynamic_quality"] = min(dynamic_score, 1.0)

    # Combined quality (weighted average)
    if scores["static_quality"] > 0 and scores["dynamic_quality"] > 0:
        # When both available, dynamic context is weighted higher (70/30)
        scores["combined_quality"] = (scores["static_quality"] * 0.3 + scores["dynamic_quality"] * 0.7)
    elif scores["static_quality"] > 0:
        scores["combined_quality"] = scores["static_quality"] * 0.6  # Reduced because no dynamic
    elif scores["dynamic_quality"] > 0:
        scores["combined_quality"] = scores["dynamic_quality"] * 0.8  # Reduced because no static

    # Consistency score calculation
    if static_context and dynamic_context:
        consistency_score = 1.0

        # Check lesson title consistency
        static_title = static_context.lesson_title
        dynamic_title = dynamic_context.lesson_context.get("lesson_title") if dynamic_context.lesson_context else ""

        if static_title and dynamic_title and static_title.lower() != dynamic_title.lower():
            consistency_score -= 0.2

        # Check total cards consistency
        static_total = len(static_context.lesson_snapshot.get("cards", [])) if static_context.lesson_snapshot else 0
        dynamic_total = dynamic_context.total_cards

        if static_total > 0 and dynamic_total > 0 and static_total != dynamic_total:
            consistency_score -= 0.3

        scores["consistency_score"] = max(consistency_score, 0.0)

    return scores


def format_dual_source_context_for_prompt(merged_context: Dict[str, Any]) -> str:
    """Format merged dual-source context for LLM prompt inclusion.

    Args:
        merged_context: Merged context from merge_dual_source_contexts

    Returns:
        Formatted string for prompt inclusion
    """
    formatted_parts = []

    # Session information (from static context)
    if merged_context.get("session"):
        session = merged_context["session"]
        formatted_parts.append("=== LESSON SESSION ===")
        formatted_parts.append(f"Session ID: {session.get('session_id', 'N/A')}")
        formatted_parts.append(f"Student ID: {session.get('student_id', 'N/A')}")
        formatted_parts.append(f"Lesson Title: {session.get('lesson_title', 'N/A')}")
        formatted_parts.append(f"Subject Area: {session.get('lesson_topic', 'N/A')}")
        formatted_parts.append("")

    # Current card information (from dynamic context)
    if merged_context.get("current_card"):
        card = merged_context["current_card"]
        formatted_parts.append("=== CURRENT LESSON CARD ===")
        formatted_parts.append(f"Position: Card {card.get('card_index', 0) + 1} of {card.get('total_cards', '?')}")
        formatted_parts.append(f"Interaction State: {card.get('interaction_state', 'unknown').title()}")

        # Add current question if available
        if merged_context.get("current_question"):
            question = merged_context["current_question"]
            formatted_parts.append(f"Question: {question.get('question', 'No question available')}")
            formatted_parts.append(f"Question Type: {question.get('type', 'unknown').upper()}")

            if question.get("options"):
                formatted_parts.append("Answer Options:")
                for i, option in enumerate(question["options"]):
                    formatted_parts.append(f"  {chr(65+i)}. {option}")

        formatted_parts.append("")

    # Progress information
    if merged_context.get("progress"):
        progress = merged_context["progress"]
        formatted_parts.append("=== LESSON PROGRESS ===")
        formatted_parts.append(f"Current Position: {progress.get('current_card', '?')} / {progress.get('total_cards', '?')}")
        formatted_parts.append(f"Completion: {progress.get('percentage', 0)}%")
        formatted_parts.append("")

    # Context quality indicators
    context_indicators = []
    if merged_context.get("static_available"):
        context_indicators.append("Session Data ✓")
    if merged_context.get("dynamic_available"):
        context_indicators.append("Current Card ✓")

    if context_indicators:
        formatted_parts.append(f"Context Sources: {' | '.join(context_indicators)}")

    # Consistency warnings
    if merged_context.get("consistency", {}).get("has_issues"):
        issues = merged_context["consistency"]["issues"]
        formatted_parts.append("")
        formatted_parts.append("⚠️  Context Consistency Issues:")
        for issue in issues:
            formatted_parts.append(f"  - {issue}")

    return "\n".join(formatted_parts) if formatted_parts else "No context information available"
