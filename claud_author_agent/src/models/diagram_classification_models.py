"""Diagram Classification Models for Multi-Tool Support.

Pydantic models for the 8-rule priority-based tool classification system.
Extends the existing eligibility analysis with tool type selection for
BOTH lesson explainer and CFU contexts.

Tool Types:
    - DESMOS: Function graphing (y=f(x), quadratics, trigonometry)
    - MATPLOTLIB: Pure geometry (circle theorems, constructions, angles)
    - JSXGRAPH: Coordinate geometry (transformations, vectors, line equations)
    - PLOTLY: Statistics/data visualization (bar charts, histograms, box plots)
    - IMAGE_GENERATION: Real-world contextual images (use sparingly)
    - NONE: No diagram needed

Classification Rules (8-rule priority order):
    1. Data points/frequencies present → PLOTLY
    2. Function graphing (y=, f(x), curves) → DESMOS
    3. Pure geometry WITHOUT coordinates → MATPLOTLIB
    4. Transformations ON coordinate plane → JSXGRAPH
    5. Real-world context (NOT geometric) → IMAGE_GENERATION
    6. Angles/bearings WITHOUT coordinates → MATPLOTLIB
    7. Coordinate geometry (points, lines) → JSXGRAPH
    8. Purely algebraic, no visualization → NONE

Usage:
    from models.diagram_classification_models import (
        ToolType,
        ContextClassification,
        CardEligibilityWithTool,
        LessonClassificationResult
    )
"""

from typing import Literal, Optional, List
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
# Type Definitions
# ═══════════════════════════════════════════════════════════════

ToolType = Literal[
    "DESMOS",
    "MATPLOTLIB",
    "JSXGRAPH",
    "PLOTLY",
    "IMAGE_GENERATION",
    "NONE"
]

ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW"]


# ═══════════════════════════════════════════════════════════════
# Classification Reasoning
# ═══════════════════════════════════════════════════════════════

class DiagramClassificationReason(BaseModel):
    """Structured reasoning for tool selection decision.

    Provides transparency into WHY a particular tool was chosen,
    which aids debugging and prompt refinement.
    """
    selected_because: str = Field(
        ...,
        description="Primary reason for tool choice (1 sentence)"
    )
    content_analysis: str = Field(
        ...,
        description="What the content contains that led to this decision"
    )
    decision_rule_applied: str = Field(
        ...,
        description="Which of the 8 priority rules matched (e.g., 'Rule 3: Pure geometry WITHOUT coordinates')"
    )
    alternatives_rejected: str = Field(
        ...,
        description="Why other tools weren't chosen (brief)"
    )


# ═══════════════════════════════════════════════════════════════
# Single Context Classification
# ═══════════════════════════════════════════════════════════════

class ContextClassification(BaseModel):
    """Classification for a single context (lesson or CFU).

    Each context (lesson explainer vs CFU) may need different
    tools or may not need a diagram at all.

    Examples:
        - Lesson: MATPLOTLIB for teaching angle relationships
        - CFU: NONE because showing the diagram would reveal the answer
    """
    needs_diagram: bool = Field(
        ...,
        description="Whether this context needs a diagram"
    )
    tool: ToolType = Field(
        ...,
        description="Best tool for this content, or NONE if no diagram needed"
    )
    confidence: ConfidenceLevel = Field(
        default="HIGH",
        description="Confidence in tool selection (HIGH/MEDIUM/LOW)"
    )
    reasoning: DiagramClassificationReason = Field(
        ...,
        description="Structured reasoning for the classification decision"
    )
    visualization_focus: Optional[str] = Field(
        None,
        description="What to visualize if tool != NONE (1-2 sentences)"
    )


# ═══════════════════════════════════════════════════════════════
# Card-Level Classification
# ═══════════════════════════════════════════════════════════════

class CardEligibilityWithTool(BaseModel):
    """Extended eligibility result with dual-context tool classification.

    This model captures tool selection for BOTH the lesson explainer
    content AND the CFU content separately. A card may need:
    - Different tools for lesson vs CFU
    - A diagram for lesson but not CFU (or vice versa)
    - No diagrams at all

    Critical CFU Rule:
        If a CFU diagram would reveal the answer, set cfu.tool = NONE
        even if the lesson uses a diagram.
    """
    card_id: str = Field(
        ...,
        description="Card identifier (e.g., 'card_001')"
    )
    card_title: str = Field(
        ...,
        description="Card title for logging/debugging"
    )

    # Lesson explainer classification
    lesson: ContextClassification = Field(
        ...,
        description="Tool classification for lesson explainer content"
    )

    # CFU (Check For Understanding) classification
    cfu: ContextClassification = Field(
        ...,
        description="Tool classification for CFU/assessment content"
    )

    # Summary for logging
    summary: str = Field(
        ...,
        description="One-line summary of classification decisions"
    )

    @property
    def needs_any_diagram(self) -> bool:
        """Check if any diagram is needed for this card."""
        return (
            self.lesson.needs_diagram and self.lesson.tool != "NONE"
        ) or (
            self.cfu.needs_diagram and self.cfu.tool != "NONE"
        )

    @property
    def lesson_tool(self) -> Optional[str]:
        """Get lesson tool type, or None if no diagram needed."""
        if self.lesson.needs_diagram and self.lesson.tool != "NONE":
            return self.lesson.tool
        return None

    @property
    def cfu_tool(self) -> Optional[str]:
        """Get CFU tool type, or None if no diagram needed."""
        if self.cfu.needs_diagram and self.cfu.tool != "NONE":
            return self.cfu.tool
        return None


# ═══════════════════════════════════════════════════════════════
# Lesson-Level Classification Result
# ═══════════════════════════════════════════════════════════════

class LessonClassificationResult(BaseModel):
    """Complete classification output for all cards in a lesson.

    Aggregates tool classifications for an entire lesson template,
    with statistics for logging and debugging.
    """
    lesson_template_id: str = Field(
        ...,
        description="Lesson template document ID"
    )
    total_cards: int = Field(
        ...,
        description="Total number of cards analyzed"
    )
    cards_with_lesson_diagrams: int = Field(
        ...,
        description="Number of cards needing lesson diagrams"
    )
    cards_with_cfu_diagrams: int = Field(
        ...,
        description="Number of cards needing CFU diagrams"
    )
    classifications: List[CardEligibilityWithTool] = Field(
        ...,
        description="Classification results for each card"
    )

    @property
    def cards_needing_diagrams(self) -> List[CardEligibilityWithTool]:
        """Get only cards that need at least one diagram."""
        return [c for c in self.classifications if c.needs_any_diagram]

    @property
    def tool_distribution(self) -> dict:
        """Get distribution of tools used across all contexts."""
        distribution = {
            "DESMOS": 0,
            "MATPLOTLIB": 0,
            "JSXGRAPH": 0,
            "PLOTLY": 0,
            "IMAGE_GENERATION": 0,
            "NONE": 0
        }

        for card in self.classifications:
            if card.lesson.needs_diagram:
                distribution[card.lesson.tool] += 1
            if card.cfu.needs_diagram:
                distribution[card.cfu.tool] += 1

        return distribution


# ═══════════════════════════════════════════════════════════════
# Tool Mapping Utilities
# ═══════════════════════════════════════════════════════════════

# Maps tool types to their rendering characteristics
TOOL_CHARACTERISTICS = {
    "DESMOS": {
        "description": "Function graphing calculator",
        "best_for": ["y=f(x) functions", "quadratics", "trigonometry", "inequalities"],
        "mcp_server": "desmos",
        "render_method": "render_desmos",
        "requires_api": True,
        "endpoint": "/api/v1/render/desmos/simple"
    },
    "MATPLOTLIB": {
        "description": "Pure geometry via Python code execution",
        "best_for": ["circle theorems", "constructions", "angles", "bearings", "proofs"],
        "mcp_server": "matplotlib",
        "render_method": "render_matplotlib",
        "requires_api": False,  # Local execution
        "endpoint": None
    },
    "JSXGRAPH": {
        "description": "Coordinate geometry and transformations",
        "best_for": ["coordinate points", "vectors", "reflections", "rotations", "translations"],
        "mcp_server": "jsxgraph",
        "render_method": "render_jsxgraph",
        "requires_api": True,
        "endpoint": "/api/v1/render"
    },
    "PLOTLY": {
        "description": "Statistical charts and data visualization",
        "best_for": ["bar charts", "histograms", "box plots", "scatter plots", "pie charts"],
        "mcp_server": "plotly",
        "render_method": "render_plotly",
        "requires_api": True,
        "endpoint": "/api/v1/render/plotly"
    },
    "IMAGE_GENERATION": {
        "description": "AI-generated contextual images",
        "best_for": ["real-world scenarios", "word problem context", "physical setups"],
        "mcp_server": "imagen",
        "render_method": "render_imagen",
        "requires_api": True,
        "endpoint": "/api/v1/render/imagen"
    },
    "NONE": {
        "description": "No diagram needed",
        "best_for": ["pure algebra", "text-only content"],
        "mcp_server": None,
        "render_method": None,
        "requires_api": False,
        "endpoint": None
    }
}


def get_tool_mcp_server_name(tool_type: str) -> Optional[str]:
    """Get the MCP server name for a tool type.

    Args:
        tool_type: One of DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, NONE

    Returns:
        MCP server name or None if tool doesn't need a server
    """
    if tool_type not in TOOL_CHARACTERISTICS:
        raise ValueError(f"Unknown tool type: {tool_type}")
    return TOOL_CHARACTERISTICS[tool_type]["mcp_server"]


def get_tool_render_method(tool_type: str) -> Optional[str]:
    """Get the render method name for a tool type.

    Args:
        tool_type: One of DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, NONE

    Returns:
        Render method name (e.g., 'render_desmos') or None
    """
    if tool_type not in TOOL_CHARACTERISTICS:
        raise ValueError(f"Unknown tool type: {tool_type}")
    return TOOL_CHARACTERISTICS[tool_type]["render_method"]
