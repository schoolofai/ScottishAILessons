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
    
    # Teaching progression fields
    course_id: str
    lesson_template_id: str
    current_card_index: int
    cards_completed: List[str]
    current_card: Optional[Dict[str, Any]]
    is_correct: Optional[bool]
    feedback: Optional[str]
    hint_level: int
    attempts: int
    evidence: List[Dict[str, Any]]
    mastery_updates: List[Dict[str, Any]]
    stage: Literal["design", "deliver", "mark", "progress", "done"]
    should_exit: bool