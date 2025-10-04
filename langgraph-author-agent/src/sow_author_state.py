"""Custom state schema for SoW Author Agent with todos reducer.

This module provides an extended state schema that allows concurrent updates
to the todos field without causing InvalidUpdateError in LangGraph.
"""
from typing import Annotated, NotRequired
from deepagents.state import DeepAgentState, Todo


def todos_reducer(left: list[Todo] | None, right: list[Todo] | None) -> list[Todo] | None:
    """Reducer function for todos field that handles None values and concatenates lists.

    This function merges todo lists from concurrent subagent updates. It follows the
    same pattern as deepagents' file_reducer to properly handle None values.

    Args:
        left: Left todo list (or None)
        right: Right todo list (or None)

    Returns:
        Merged todo list, or None if both inputs are None

    Example:
        critic_1: {"todos": [{"content": "Fix coverage", "status": "pending"}]}
        critic_2: {"todos": [{"content": "Add context", "status": "pending"}]}
        Result: {"todos": [
            {"content": "Fix coverage", "status": "pending"},
            {"content": "Add context", "status": "pending"}
        ]}
    """
    if left is None:
        return right
    elif right is None:
        return left
    else:
        return left + right


class SowAuthorState(DeepAgentState):
    """Extended DeepAgentState with reducer for todos to handle concurrent updates.

    This state schema extends DeepAgentState by adding a reducer function to the
    todos field. When multiple subagents update the todos list concurrently
    (within the same execution step), the reducer merges the updates instead of
    throwing an InvalidUpdateError.

    The reducer handles None values properly (unlike operator.add) and concatenates
    non-None lists, following the same pattern as deepagents' file_reducer.

    Attributes:
        todos: List of Todo items with a custom reducer that concatenates concurrent updates.
               Inherits other fields from DeepAgentState (messages, files, etc.).
    """

    # Override todos field with a custom reducer that handles None values
    todos: Annotated[NotRequired[list[Todo]], todos_reducer]
