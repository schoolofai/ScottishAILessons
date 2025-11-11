"""Extended state schema for interrupt-enabled graphs.

This extends the UnifiedState with interrupt-specific fields needed for
managing lesson card presentations and user interactions through Tool UIs.
"""

from __future__ import annotations

from typing import Annotated, TypedDict, Optional, List, Dict, Any, Literal
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

try:
    from .shared_state import UnifiedState
except ImportError:
    from agent.shared_state import UnifiedState


class InterruptUnifiedState(UnifiedState, total=False):
    """Extended state schema with interrupt-specific fields.

    Inherits all fields from UnifiedState and adds fields needed for
    managing interrupts and user interactions through Tool UIs.
    """
    # Core interrupt management fields (actively used)
    interrupt_response: Optional[Dict[str, Any]]  # Response from get_answer interrupt
    card_presentation_complete: bool  # Whether current card has been presented
    tool_response_received: bool  # Whether Tool UI has responded

    # Interaction tracking (actively used)
    interrupt_count: int  # Number of interrupts in current session
    cards_presented_via_ui: List[str]  # Card IDs presented through interrupts
    feedback_interactions_count: int  # Number of feedback presentations

    # Curriculum metadata fields (from courses collection via courseId lookup)
    course_subject: Optional[str]  # "mathematics", "application-of-mathematics", "physics"
    course_level: Optional[str]  # "national-3", "national-4", "national-5"
    sqa_course_code: Optional[str]  # "C844 73" (if available)
    course_title: Optional[str]  # Full course title from SQA data

    # Lesson template metadata (from lesson_templates/lesson_snapshot)
    lesson_type: Optional[str]  # "teach", "independent_practice", "assessment"
    engagement_tags: Optional[List[str]]  # ["real_world_context", "scaffolding", "visual_aids"]
    lesson_policy: Optional[Dict[str, Any]]  # {"calculator_allowed": true}
    sow_order: Optional[int]  # Position in Authored SOW sequence (1-based)
    est_minutes: Optional[int]  # Estimated lesson duration in minutes

    # Enriched outcome data (from course_outcomes via outcomeRefs)
    enriched_outcomes: Optional[List[Dict[str, Any]]]  # Full outcome objects with assessment standards

    # Display-friendly formatted strings for prompts (generated from raw fields)
    course_subject_display: Optional[str]  # "Mathematics" (Title Case)
    course_level_display: Optional[str]  # "National 3" (Title Case)
    lesson_type_display: Optional[str]  # "Teaching Lesson" (Title Case)

    # Accessibility preferences
    use_plain_text: Optional[bool]  # Use explainer_plain for dyslexia-friendly content

    # Lesson diagram (type="lesson") if available
    lesson_diagram: Optional[Dict[str, Any]]  # {image_file_id, diagram_type, title}