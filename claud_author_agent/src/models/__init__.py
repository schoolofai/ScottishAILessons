"""Models package for diagram author.

Contains dataclasses for structured data throughout the pipeline.
"""

from .diagram_spec import DiagramSpec, DiagramSpecList, ToolType
from .diagram_classification_models import (
    ContextClassification,
    CardEligibilityWithTool,
    LessonClassificationResult,
    DiagramClassificationReason,
    TOOL_CHARACTERISTICS,
    get_tool_mcp_server_name,
    get_tool_render_method,
)

__all__ = [
    # DiagramSpec models
    "DiagramSpec",
    "DiagramSpecList",
    "ToolType",
    # Classification models
    "ContextClassification",
    "CardEligibilityWithTool",
    "LessonClassificationResult",
    "DiagramClassificationReason",
    "TOOL_CHARACTERISTICS",
    "get_tool_mcp_server_name",
    "get_tool_render_method",
]
