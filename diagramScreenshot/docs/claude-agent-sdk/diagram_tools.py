"""
Diagram Rendering Tools for Claude Agent SDK

These tools wrap the Diagram Rendering Service APIs for use with the Claude Agent SDK.
Each tool is defined using the @tool decorator pattern.

Usage:
    from diagram_tools import (
        render_plotly_chart,
        render_desmos_graph,
        render_geogebra_geometry,
        generate_educational_image
    )

    # Add to your agent
    agent = Agent(
        model="claude-sonnet-4-20250514",
        tools=[
            render_plotly_chart,
            render_desmos_graph,
            render_geogebra_geometry,
            generate_educational_image
        ]
    )
"""

import httpx
from typing import Any
from pydantic import BaseModel, Field

# Configuration
DIAGRAM_SERVICE_URL = "http://localhost:3000"
API_KEY = "your-api-key"  # Set via environment variable in production


# ============================================================================
# Pydantic Models for Tool Parameters
# ============================================================================

class PlotlyMarker(BaseModel):
    """Marker styling for Plotly traces"""
    color: str | None = None
    size: int | None = None


class PlotlyTrace(BaseModel):
    """A single data trace for Plotly charts"""
    type: str = Field(description="Chart type: scatter, bar, pie, histogram, box, line")
    x: list[str | int | float] | None = Field(default=None, description="X-axis values")
    y: list[int | float] | None = Field(default=None, description="Y-axis values")
    values: list[int | float] | None = Field(default=None, description="Values for pie charts")
    labels: list[str] | None = Field(default=None, description="Labels for pie charts")
    name: str | None = Field(default=None, description="Trace name for legend")
    mode: str | None = Field(default=None, description="Display mode: lines, markers, lines+markers")
    marker: PlotlyMarker | None = None


class PlotlyAxis(BaseModel):
    """Axis configuration for Plotly"""
    title: str | None = None
    range: list[float] | None = None


class PlotlyLayout(BaseModel):
    """Layout configuration for Plotly charts"""
    title: str | None = None
    xaxis: PlotlyAxis | None = None
    yaxis: PlotlyAxis | None = None
    showlegend: bool | None = None
    barmode: str | None = Field(default=None, description="group, stack, overlay")


class PlotlyChartInput(BaseModel):
    """Input for rendering Plotly charts"""
    traces: list[PlotlyTrace] = Field(description="Array of data traces")
    layout: PlotlyLayout | None = Field(default=None, description="Chart layout options")
    width: int = Field(default=800, ge=100, le=4000)
    height: int = Field(default=600, ge=100, le=4000)


class DesmosExpression(BaseModel):
    """A mathematical expression for Desmos"""
    latex: str = Field(description="LaTeX expression, e.g., 'y=2x+3' or 'y=x^2'")
    color: str | None = Field(default=None, description="Color in hex, e.g., '#ff0000'")
    line_style: str | None = Field(default=None, description="SOLID, DASHED, or DOTTED")
    label: str | None = Field(default=None, description="Label to display")
    show_label: bool | None = None


class DesmosViewport(BaseModel):
    """Viewport bounds for Desmos graph"""
    xmin: float = -10
    xmax: float = 10
    ymin: float = -10
    ymax: float = 10


class DesmosGraphInput(BaseModel):
    """Input for rendering Desmos graphs"""
    expressions: list[DesmosExpression] = Field(description="Mathematical expressions to plot")
    viewport: DesmosViewport | None = None
    show_grid: bool = True
    show_axes: bool = True
    degree_mode: bool = False
    width: int = Field(default=800, ge=100, le=4000)
    height: int = Field(default=600, ge=100, le=4000)


class GeoGebraCoordSystem(BaseModel):
    """Coordinate system bounds for GeoGebra"""
    xmin: float = -10
    xmax: float = 10
    ymin: float = -10
    ymax: float = 10


class GeoGebraGeometryInput(BaseModel):
    """Input for rendering GeoGebra geometry"""
    commands: list[str] = Field(
        description="GeoGebra commands, e.g., ['A = (0, 0)', 'c = Circle(A, 3)']"
    )
    coord_system: GeoGebraCoordSystem | None = None
    show_axes: bool = False
    show_grid: bool = False
    width: int = Field(default=600, ge=100, le=4000)
    height: int = Field(default=600, ge=100, le=4000)


class ImageStyle(BaseModel):
    """Style configuration for AI-generated images"""
    type: str = Field(default="illustration", description="realistic, diagram, illustration, simple")
    color_scheme: str = Field(default="full-color", description="full-color, muted, monochrome")
    perspective: str | None = Field(default=None, description="front, side, top, isometric, aerial")


class EducationalContext(BaseModel):
    """Educational context for AI-generated images"""
    subject: str = "Mathematics"
    level: str = "National 5"
    topic: str | None = None


class EducationalImageInput(BaseModel):
    """Input for generating educational images"""
    description: str = Field(
        min_length=10,
        max_length=2000,
        description="Detailed description of the image to generate"
    )
    context: str | None = Field(default=None, description="How the image will be used")
    style: ImageStyle | None = None
    educational: EducationalContext | None = None
    negative_prompt: str | None = Field(default=None, description="Things to avoid")
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)


# ============================================================================
# Tool Response Models
# ============================================================================

class DiagramResponse(BaseModel):
    """Response from diagram rendering tools"""
    success: bool
    image_base64: str | None = Field(default=None, description="Base64-encoded image")
    error: str | None = None
    metadata: dict[str, Any] | None = None


# ============================================================================
# HTTP Client Helper
# ============================================================================

def _make_request(endpoint: str, payload: dict) -> DiagramResponse:
    """Make HTTP request to diagram service"""
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{DIAGRAM_SERVICE_URL}{endpoint}",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": API_KEY
                }
            )

            if response.status_code == 200:
                data = response.json()
                return DiagramResponse(
                    success=True,
                    image_base64=data.get("image") or (data.get("images", [{}])[0].get("image")),
                    metadata=data.get("metadata")
                )
            else:
                error_data = response.json()
                return DiagramResponse(
                    success=False,
                    error=error_data.get("error", {}).get("message", f"HTTP {response.status_code}")
                )
    except Exception as e:
        return DiagramResponse(success=False, error=str(e))


# ============================================================================
# Tool Definitions for Claude Agent SDK
# ============================================================================

def render_plotly_chart(input: PlotlyChartInput) -> DiagramResponse:
    """
    Render statistical charts using Plotly.

    Best for: bar charts, line graphs, scatter plots, histograms, pie charts, box plots.
    Use this tool when the student needs to visualize statistical data.

    Examples:
    - Bar chart showing survey results
    - Line graph showing temperature over time
    - Scatter plot showing correlation between height and weight
    - Pie chart showing budget breakdown
    - Histogram showing test score distribution
    - Box plot comparing data sets

    Args:
        input: Chart configuration with traces, layout, and dimensions

    Returns:
        DiagramResponse with base64-encoded PNG image
    """
    payload = {
        "chart": {
            "data": [
                {
                    "type": t.type,
                    **({"x": t.x} if t.x else {}),
                    **({"y": t.y} if t.y else {}),
                    **({"values": t.values} if t.values else {}),
                    **({"labels": t.labels} if t.labels else {}),
                    **({"name": t.name} if t.name else {}),
                    **({"mode": t.mode} if t.mode else {}),
                    **({"marker": {"color": t.marker.color, "size": t.marker.size}} if t.marker else {})
                }
                for t in input.traces
            ],
            **({"layout": {
                **({"title": input.layout.title} if input.layout.title else {}),
                **({"xaxis": {"title": input.layout.xaxis.title}} if input.layout.xaxis else {}),
                **({"yaxis": {"title": input.layout.yaxis.title}} if input.layout.yaxis else {}),
                **({"showlegend": input.layout.showlegend} if input.layout.showlegend is not None else {}),
                **({"barmode": input.layout.barmode} if input.layout.barmode else {})
            }} if input.layout else {})
        },
        "options": {
            "width": input.width,
            "height": input.height
        }
    }

    return _make_request("/api/v1/render/plotly", payload)


def render_desmos_graph(input: DesmosGraphInput) -> DiagramResponse:
    """
    Render mathematical function graphs using Desmos calculator.

    Best for: linear equations, quadratic functions, simultaneous equations,
    trigonometric functions, inequalities, and any algebraic graphs.

    LaTeX syntax examples:
    - Linear: y=2x+3
    - Quadratic: y=x^2-4x+3
    - Trigonometric: y=\\sin(x), y=\\cos(x)
    - Absolute value: y=|x-2|
    - Square root: y=\\sqrt{x}
    - Fractions: y=\\frac{1}{x}
    - Inequalities: y>2x+1
    - Points: (3, 5)
    - Vertical lines: x=2

    Args:
        input: Graph configuration with expressions, viewport, and settings

    Returns:
        DiagramResponse with base64-encoded PNG image
    """
    payload = {
        "expressions": [
            {
                "latex": expr.latex,
                **({"color": expr.color} if expr.color else {}),
                **({"lineStyle": expr.line_style} if expr.line_style else {}),
                **({"label": expr.label} if expr.label else {}),
                **({"showLabel": expr.show_label} if expr.show_label is not None else {})
            }
            for expr in input.expressions
        ],
        **({"viewport": {
            "xmin": input.viewport.xmin,
            "xmax": input.viewport.xmax,
            "ymin": input.viewport.ymin,
            "ymax": input.viewport.ymax
        }} if input.viewport else {}),
        "settings": {
            "showGrid": input.show_grid,
            "showXAxis": input.show_axes,
            "showYAxis": input.show_axes,
            "degreeMode": input.degree_mode
        },
        "options": {
            "width": input.width,
            "height": input.height
        }
    }

    return _make_request("/api/v1/render/desmos/simple", payload)


def render_geogebra_geometry(input: GeoGebraGeometryInput) -> DiagramResponse:
    """
    Render geometric constructions using GeoGebra.

    Best for: circle theorems, geometric proofs, angle properties, triangles,
    perpendicular bisectors, and any geometric construction.

    Common GeoGebra commands:
    - Point: A = (0, 0) or A = Point(0, 0)
    - Circle: c = Circle(A, 3) or c = Circle(A, B, C)
    - Segment: Segment(A, B)
    - Line: Line(A, B)
    - Perpendicular: Perpendicular(A, line)
    - Midpoint: M = Midpoint(A, B)
    - Angle: Angle(A, B, C)
    - Polygon: Polygon(A, B, C)
    - Triangle: Polygon(A, B, C)
    - Intersect: Intersect(c1, c2)
    - PerpendicularBisector: PerpendicularBisector(A, B)
    - AngleBisector: AngleBisector(A, B, C)
    - Tangent: Tangent(P, c)
    - Arc: Arc(c, A, B)

    Args:
        input: Geometry configuration with commands and coordinate system

    Returns:
        DiagramResponse with base64-encoded PNG image
    """
    payload = {
        "commands": input.commands,
        **({"coordSystem": {
            "xmin": input.coord_system.xmin,
            "xmax": input.coord_system.xmax,
            "ymin": input.coord_system.ymin,
            "ymax": input.coord_system.ymax
        }} if input.coord_system else {}),
        "showAxes": input.show_axes,
        "showGrid": input.show_grid,
        "options": {
            "width": input.width,
            "height": input.height
        }
    }

    return _make_request("/api/v1/render/geogebra/simple", payload)


def generate_educational_image(input: EducationalImageInput) -> DiagramResponse:
    """
    Generate AI educational images for real-world math applications.

    Best for: contextual illustrations showing mathematics in everyday scenarios,
    word problem visualizations, real-world applications of math concepts.

    Use this when you need to show:
    - Pythagoras theorem in architecture/construction
    - Similar triangles in surveying/shadows
    - Gradients in road design/ramps
    - Statistics in sports contexts
    - Probability in weather/games
    - Area/perimeter in gardens/rooms
    - Volume in packaging/containers
    - Percentages in sales/discounts
    - Ratios in recipes/mixing

    Note: Rate limited to 10 requests per minute.

    Args:
        input: Image description with style and educational context

    Returns:
        DiagramResponse with base64-encoded image
    """
    payload = {
        "prompt": {
            "text": input.description,
            **({"context": input.context} if input.context else {}),
            **({"style": {
                "type": input.style.type,
                "colorScheme": input.style.color_scheme,
                **({"perspective": input.style.perspective} if input.style.perspective else {})
            }} if input.style else {}),
            **({"educational": {
                "subject": input.educational.subject,
                "level": input.educational.level,
                **({"topic": input.educational.topic} if input.educational.topic else {})
            }} if input.educational else {}),
            **({"negativePrompt": input.negative_prompt} if input.negative_prompt else {})
        },
        "options": {
            "width": input.width,
            "height": input.height,
            "numberOfImages": 1
        }
    }

    return _make_request("/api/v1/render/imagen", payload)


# ============================================================================
# Tool List for Agent Configuration
# ============================================================================

DIAGRAM_TOOLS = [
    render_plotly_chart,
    render_desmos_graph,
    render_geogebra_geometry,
    generate_educational_image
]
"""List of all diagram tools for easy agent configuration"""
