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
    # Interrupt management fields
    pending_card_interaction: Optional[Dict[str, Any]]  # Data for current interrupt
    user_interaction_response: Optional[Dict[str, Any]]  # Response from Tool UI
    card_presentation_complete: bool  # Whether current card has been presented
    
    # Enhanced interaction tracking
    interrupt_count: int  # Number of interrupts in current session
    last_interrupt_type: Optional[str]  # Type of last interrupt ("card", "feedback", "progress", "summary")
    interrupt_history: List[Dict[str, Any]]  # History of all interrupts and responses
    
    # Tool UI state management
    current_tool_name: Optional[str]  # Active Tool UI component name
    tool_interaction_data: Optional[Dict[str, Any]]  # Data passed to current Tool UI
    tool_response_received: bool  # Whether Tool UI has responded
    
    # Progress and completion tracking for interrupts
    cards_presented_via_ui: List[str]  # Card IDs presented through interrupts
    feedback_interactions_count: int  # Number of feedback presentations
    user_engagement_score: Optional[float]  # Calculated engagement based on interactions
    
    # Error handling for interrupts
    interrupt_errors: List[str]  # Any errors during interrupt processing
    fallback_to_messages: bool  # Whether to fall back to regular message flow
    
    # Session continuation
    can_resume_from_interrupt: bool  # Whether session can be resumed
    resume_point: Optional[str]  # Where to resume if interrupted