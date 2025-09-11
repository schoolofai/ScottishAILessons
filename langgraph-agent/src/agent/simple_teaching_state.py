"""Simplified teaching state following ChatGPT interrupt pattern.

This replaces the complex InterruptUnifiedState with a simple, clean state
that follows the direct interrupt pattern shown in ChatGPT example.
"""

from __future__ import annotations

from typing import Dict, Any, Optional, List
from typing_extensions import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class SimpleTeachingState(TypedDict):
    """Simplified teaching state following ChatGPT pattern."""
    
    # Core LangGraph message handling
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Session context (same as before)
    session_context: Optional[Dict[str, Any]]
    session_id: Optional[str]
    student_id: Optional[str]
    lesson_snapshot: Optional[Dict[str, Any]]
    
    # Simple state tracking (like "approved" in ChatGPT example)
    current_stage: Optional[str]  # "design", "mark", "progress", "done"
    current_card_index: Optional[int]
    current_card: Optional[Dict[str, Any]]
    
    # Simple response tracking (like "pending" in ChatGPT example)
    student_response: Optional[str]  # Response from lesson card interaction
    is_correct: Optional[bool]       # Evaluation result
    should_progress: Optional[bool]  # Whether to move to next card
    
    # Evidence tracking (simplified)
    evidence: Optional[List[Dict[str, Any]]]
    cards_completed: Optional[List[str]]
    
    # Performance tracking
    attempts: Optional[int]
    max_attempts: Optional[int]
    
    # Lesson completion
    should_exit: Optional[bool]