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