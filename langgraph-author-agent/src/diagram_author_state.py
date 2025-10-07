"""State schema for Diagram Author Deep Agent.

This module defines the state structure for the diagram author agent that generates
JSXGraph visualizations for lesson cards. Extends DeepAgentState with diagram-specific
fields and custom reducers for concurrent updates.

The state is completely Appwrite-agnostic - no database IDs or storage references.
"""

from __future__ import annotations
from typing import Dict, List, Any
from typing_extensions import Annotated, NotRequired
from deepagents import DeepAgentState


def dict_merger(left: Dict | None, right: Dict | None) -> Dict | None:
    """Reducer for concurrent diagram updates from multiple subagents.

    Merges diagram dictionaries with right taking precedence for conflicts.
    Used for concurrent updates to the diagrams state field.

    Args:
        left: Existing diagram dictionary (or None)
        right: New diagram dictionary to merge (or None)

    Returns:
        Merged dictionary, or None if both inputs are None
    """
    if left is None:
        return right
    elif right is None:
        return left
    else:
        merged = left.copy()
        merged.update(right)
        return merged


class DiagramAuthorState(DeepAgentState):
    """State schema for Diagram Author Deep Agent.

    This extends DeepAgentState with diagram-specific fields.
    The diagrams field uses a custom reducer to handle concurrent updates.

    NOTE: This state is Appwrite-agnostic - no database IDs, no storage references.
    All output is plain JSON suitable for frontend seeding scripts.

    Attributes:
        lesson_template_id: Reference ID for tracking (not FK)
        lesson_template: Plain JSON lesson template structure
        diagrams: Processing state - diagrams by card ID
        output_diagrams: Final output array for seeding script
        total_cards: Total number of cards in lesson
        cards_processed: Number of cards processed so far
        cards_with_diagrams: Number of cards that have diagrams
        errors: List of error records for debugging
    """

    # Input: Lesson template to process (plain JSON, no Appwrite fields)
    lesson_template_id: NotRequired[str]  # For reference only, not FK
    lesson_template: NotRequired[Dict[str, Any]]  # Plain JSON structure

    # Processing state: diagrams by card ID
    # Format: { "card_1": { "jsxgraph_json": {...}, "image_base64": "...", "critique": {...} } }
    diagrams: Annotated[NotRequired[Dict[str, Dict[str, Any]]], dict_merger]

    # Output: Array of diagram objects for frontend seeding script
    # NO Appwrite-specific fields like $id, createdAt, updatedAt
    output_diagrams: NotRequired[List[Dict[str, Any]]]

    # Processing metadata
    total_cards: NotRequired[int]
    cards_processed: NotRequired[int]
    cards_with_diagrams: NotRequired[int]

    # Error tracking
    errors: NotRequired[List[Dict[str, Any]]]
