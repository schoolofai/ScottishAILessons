"""Pre-defined Excalidraw canvas templates for common drawing tasks.

This module provides reusable canvas templates that can be pre-loaded into
the Excalidraw drawing tool to scaffold student diagram submissions.

Templates include coordinate systems, number lines, geometric shapes,
and other mathematical/scientific structures commonly used in lessons.

Usage in lesson templates:
    {
        "cfu": {
            "type": "drawing",
            "canvas_config": {
                "template": "cartesian_graph",  # References CANVAS_TEMPLATES key
                "width": 700,
                "height": 600,
                "gridMode": true
            }
        }
    }
"""

from typing import Dict, List, Any, Optional


def generate_cartesian_graph(
    width: int = 700,
    height: int = 600,
    x_range: tuple = (-10, 10),
    y_range: tuple = (-10, 10),
    show_labels: bool = True
) -> List[Dict[str, Any]]:
    """Generate a Cartesian coordinate system with X and Y axes.

    Args:
        width: Canvas width in pixels
        height: Canvas height in pixels
        x_range: Tuple of (min, max) for x-axis labels
        y_range: Tuple of (min, max) for y-axis labels
        show_labels: Whether to show axis labels

    Returns:
        List of Excalidraw elements representing the coordinate system
    """
    center_x = width // 2
    center_y = height // 2

    elements = []

    # X-axis (horizontal line)
    elements.append({
        "type": "line",
        "x": 50,
        "y": center_y,
        "width": width - 100,
        "height": 0,
        "strokeColor": "#000000",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "strokeSharpness": "round",
        "seed": 1234567890,
        "version": 1,
        "versionNonce": 1,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False
    })

    # Y-axis (vertical line)
    elements.append({
        "type": "line",
        "x": center_x,
        "y": 50,
        "width": 0,
        "height": height - 100,
        "strokeColor": "#000000",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "strokeSharpness": "round",
        "seed": 1234567891,
        "version": 1,
        "versionNonce": 1,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False
    })

    # Origin label
    if show_labels:
        elements.append({
            "type": "text",
            "x": center_x - 20,
            "y": center_y + 10,
            "width": 20,
            "height": 25,
            "text": "O",
            "fontSize": 16,
            "fontFamily": 1,
            "textAlign": "center",
            "verticalAlign": "top",
            "strokeColor": "#000000",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "roughness": 0,
            "opacity": 100,
            "seed": 1234567892,
            "version": 1,
            "versionNonce": 1,
            "isDeleted": False,
            "boundElements": None,
            "updated": 1,
            "link": None,
            "locked": False
        })

        # X-axis label
        elements.append({
            "type": "text",
            "x": width - 70,
            "y": center_y + 10,
            "width": 20,
            "height": 25,
            "text": "x",
            "fontSize": 16,
            "fontFamily": 1,
            "textAlign": "center",
            "verticalAlign": "top",
            "strokeColor": "#000000",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "roughness": 0,
            "opacity": 100,
            "seed": 1234567893,
            "version": 1,
            "versionNonce": 1,
            "isDeleted": False,
            "boundElements": None,
            "updated": 1,
            "link": None,
            "locked": False
        })

        # Y-axis label
        elements.append({
            "type": "text",
            "x": center_x + 10,
            "y": 60,
            "width": 20,
            "height": 25,
            "text": "y",
            "fontSize": 16,
            "fontFamily": 1,
            "textAlign": "center",
            "verticalAlign": "top",
            "strokeColor": "#000000",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 1,
            "roughness": 0,
            "opacity": 100,
            "seed": 1234567894,
            "version": 1,
            "versionNonce": 1,
            "isDeleted": False,
            "boundElements": None,
            "updated": 1,
            "link": None,
            "locked": False
        })

    return elements


def generate_number_line(
    width: int = 700,
    min_val: int = -10,
    max_val: int = 10,
    show_ticks: bool = True,
    tick_interval: int = 1
) -> List[Dict[str, Any]]:
    """Generate a horizontal number line with tick marks.

    Args:
        width: Canvas width in pixels
        min_val: Minimum value on number line
        max_val: Maximum value on number line
        show_ticks: Whether to show tick marks
        tick_interval: Spacing between tick marks

    Returns:
        List of Excalidraw elements representing the number line
    """
    elements = []
    y_position = 200  # Fixed vertical position
    x_start = 50
    x_end = width - 50
    line_length = x_end - x_start

    # Main horizontal line
    elements.append({
        "type": "line",
        "x": x_start,
        "y": y_position,
        "width": line_length,
        "height": 0,
        "strokeColor": "#000000",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "seed": 2234567890,
        "version": 1,
        "isDeleted": False
    })

    # Add tick marks if requested
    if show_ticks:
        value_range = max_val - min_val
        num_ticks = value_range // tick_interval + 1

        for i in range(num_ticks):
            value = min_val + (i * tick_interval)
            x_pos = x_start + (line_length * i / (num_ticks - 1))

            # Tick mark (vertical line)
            elements.append({
                "type": "line",
                "x": x_pos,
                "y": y_position - 10,
                "width": 0,
                "height": 20,
                "strokeColor": "#000000",
                "strokeWidth": 1,
                "roughness": 0,
                "seed": 2234567890 + i
            })

            # Tick label
            elements.append({
                "type": "text",
                "x": x_pos - 10,
                "y": y_position + 20,
                "width": 20,
                "height": 20,
                "text": str(value),
                "fontSize": 14,
                "textAlign": "center",
                "strokeColor": "#000000",
                "seed": 2234567900 + i
            })

    return elements


# ═══════════════════════════════════════════════════════════════
# Template Registry
# ═══════════════════════════════════════════════════════════════

CANVAS_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "blank": {
        "name": "Blank Canvas",
        "description": "Empty canvas for freeform drawing",
        "elements": [],
        "default_config": {
            "width": 700,
            "height": 500,
            "gridMode": False
        }
    },

    "cartesian_graph": {
        "name": "Cartesian Coordinate System",
        "description": "X-Y axes with origin labeled, perfect for plotting points and graphing functions",
        "elements": generate_cartesian_graph(),
        "default_config": {
            "width": 700,
            "height": 600,
            "gridMode": True  # Grid helps with accurate plotting
        }
    },

    "number_line": {
        "name": "Number Line",
        "description": "Horizontal number line with tick marks from -10 to +10",
        "elements": generate_number_line(),
        "default_config": {
            "width": 700,
            "height": 400,
            "gridMode": False
        }
    },

    "blank_graph": {
        "name": "Blank Graph Paper",
        "description": "Empty canvas with grid enabled for precise drawing",
        "elements": [],
        "default_config": {
            "width": 700,
            "height": 500,
            "gridMode": True
        }
    },

    # Future templates can be added here:
    # - "scatter_plot_axes": Pre-labeled axes with quadrants
    # - "angle_template": Protractor-style arc for measuring angles
    # - "fraction_circles": Circles divided into segments
    # - "venn_diagram": Two or three overlapping circles
    # - "bar_chart_axes": Vertical/horizontal axes for bar graphs
}


# ═══════════════════════════════════════════════════════════════
# Public API Functions
# ═══════════════════════════════════════════════════════════════

def get_template_elements(
    template_name: str,
    custom_config: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Retrieve template elements by name with optional custom configuration.

    Args:
        template_name: Name of the template (key in CANVAS_TEMPLATES)
        custom_config: Optional override for template configuration
                      (e.g., {"width": 800, "height": 700})

    Returns:
        List of Excalidraw elements for the template

    Raises:
        KeyError: If template_name doesn't exist

    Example:
        >>> elements = get_template_elements("cartesian_graph")
        >>> # Use in lesson template CFU config:
        >>> cfu["canvas_config"]["initialElements"] = elements
    """
    if template_name not in CANVAS_TEMPLATES:
        raise KeyError(
            f"Template '{template_name}' not found. "
            f"Available templates: {', '.join(CANVAS_TEMPLATES.keys())}"
        )

    template = CANVAS_TEMPLATES[template_name]

    # If custom config provided, regenerate dynamic templates
    if custom_config and template_name == "cartesian_graph":
        return generate_cartesian_graph(
            width=custom_config.get("width", 700),
            height=custom_config.get("height", 600)
        )
    elif custom_config and template_name == "number_line":
        return generate_number_line(
            width=custom_config.get("width", 700),
            min_val=custom_config.get("min_val", -10),
            max_val=custom_config.get("max_val", 10)
        )

    return template["elements"]


def list_templates() -> Dict[str, str]:
    """List all available templates with descriptions.

    Returns:
        Dictionary mapping template names to descriptions

    Example:
        >>> templates = list_templates()
        >>> for name, desc in templates.items():
        ...     print(f"{name}: {desc}")
    """
    return {
        name: template["description"]
        for name, template in CANVAS_TEMPLATES.items()
    }


def get_template_config(template_name: str) -> Dict[str, Any]:
    """Get the default configuration for a template.

    Args:
        template_name: Name of the template

    Returns:
        Dictionary with default width, height, gridMode settings

    Raises:
        KeyError: If template_name doesn't exist
    """
    if template_name not in CANVAS_TEMPLATES:
        raise KeyError(f"Template '{template_name}' not found")

    return CANVAS_TEMPLATES[template_name]["default_config"]
