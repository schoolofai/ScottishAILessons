"""Reusable subagents for the Claude Author Agent orchestrators.

This module provides reusable subagent classes that can be invoked via the Task tool
by any orchestrator (mock_exam_author, lesson_author, diagram_author_nano, etc.).

Subagents:
- DiagramClassificationSubagent: Determines optimal diagram rendering tool
- DiagramAuthorSubagent: Generates diagrams using REST API tools
- DiagramCriticSubagent: Validates generated diagrams using Claude's multimodal Read tool

Each subagent follows the file-based communication pattern:
1. Orchestrator writes input JSON to workspace
2. Subagent reads input, performs task, writes output JSON to workspace
3. Orchestrator reads output JSON

This enables reuse across different orchestrators without tight coupling.
"""

from .diagram_classification_subagent import DiagramClassificationSubagent
from .diagram_author_subagent import DiagramAuthorSubagent
from .diagram_critic_subagent import DiagramCriticSubagent

__all__ = [
    "DiagramClassificationSubagent",
    "DiagramAuthorSubagent",
    "DiagramCriticSubagent",
]
