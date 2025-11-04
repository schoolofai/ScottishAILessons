"""Shared state schema for main graph and teaching subgraph.

This unified state eliminates the need for complex state mapping between
the main graph and teaching subgraph, allowing direct integration.
"""

from __future__ import annotations

from typing import Annotated, TypedDict, Optional, List, Dict, Any, Literal
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class UnifiedState(TypedDict, total=False):
    """Unified state schema for both main graph and teaching subgraph.
    
    Fields marked as not required (total=False) allows main graph nodes
    to operate without teaching-specific fields, while teaching nodes
    can access all necessary progression data.
    """
    # Main graph fields
    messages: Annotated[list[BaseMessage], add_messages]
    session_context: Optional[Dict[str, Any]]  # For frontend compatibility
    mode: str
    
    # Core session fields (extracted from session_context for teaching)
    session_id: str
    student_id: str
    lesson_snapshot: Dict[str, Any]
    student_response: Optional[str]

    # Drawing submission fields (for drawing CFU type)
    student_drawing: Optional[str]  # Base64-encoded PNG from Excalidraw canvas
    student_drawing_text: Optional[str]  # Optional text explanation accompanying drawing

    # Teaching progression fields
    course_id: str
    lesson_template_id: str
    current_card_index: int
    cards_completed: List[str]
    current_card: Optional[Dict[str, Any]]
    is_correct: Optional[bool]
    should_progress: Optional[bool]  # Deterministic progression decision
    feedback: Optional[str]
    hint_level: int
    attempts: int
    max_attempts: int  # Configurable maximum attempts before force progression
    evidence: List[Dict[str, Any]]
    mastery_updates: List[Dict[str, Any]]
    stage: Literal["design", "deliver", "mark", "progress", "done"]
    should_exit: bool
    
    # Enhanced lesson completion fields
    lesson_summary: Optional[BaseMessage]  # LLM-generated comprehensive summary
    performance_analysis: Optional[Dict[str, Any]]  # Detailed performance metrics
    retry_recommended: Optional[bool]  # Whether student should retry the lesson

    # Course Manager fields
    course_recommendation: Optional[Dict[str, Any]]  # Generated course recommendation
    recommendation_summary: Optional[Dict[str, Any]]  # Recommendation analytics
    validation_results: Optional[Dict[str, Any]]  # Validation results
    error: Optional[str]  # Error message if processing failed