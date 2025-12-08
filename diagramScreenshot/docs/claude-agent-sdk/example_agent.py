"""
Example: Math Tutor Agent with Diagram Tools

This example shows how to integrate the diagram rendering tools
with a Claude Agent SDK agent for a National 5 Mathematics tutor.

Prerequisites:
    pip install anthropic httpx pydantic

Usage:
    export ANTHROPIC_API_KEY="your-key"
    export DIAGRAM_API_KEY="your-diagram-service-key"
    python example_agent.py
"""

import os
import base64
import anthropic
from pathlib import Path

# Import the diagram tools
from diagram_tools import (
    render_plotly_chart,
    render_desmos_graph,
    render_geogebra_geometry,
    generate_educational_image,
    PlotlyChartInput,
    PlotlyTrace,
    PlotlyLayout,
    PlotlyAxis,
    DesmosGraphInput,
    DesmosExpression,
    DesmosViewport,
    GeoGebraGeometryInput,
    GeoGebraCoordSystem,
    EducationalImageInput,
    ImageStyle,
    EducationalContext,
    DIAGRAM_SERVICE_URL,
)

# Configure the diagram service
import diagram_tools
diagram_tools.API_KEY = os.environ.get("DIAGRAM_API_KEY", "dev-api-key")
diagram_tools.DIAGRAM_SERVICE_URL = os.environ.get("DIAGRAM_SERVICE_URL", "http://localhost:3000")


# ============================================================================
# Tool Definitions for Claude API
# ============================================================================

TOOL_DEFINITIONS = [
    {
        "name": "render_plotly_chart",
        "description": """Render statistical charts using Plotly. Best for: bar charts, line graphs,
scatter plots, histograms, pie charts, and box plots. Use when visualizing statistical data.""",
        "input_schema": {
            "type": "object",
            "required": ["traces"],
            "properties": {
                "traces": {
                    "type": "array",
                    "description": "Array of data traces to plot",
                    "items": {
                        "type": "object",
                        "required": ["type"],
                        "properties": {
                            "type": {"type": "string", "enum": ["bar", "scatter", "line", "pie", "histogram", "box"]},
                            "x": {"type": "array", "items": {"oneOf": [{"type": "string"}, {"type": "number"}]}},
                            "y": {"type": "array", "items": {"type": "number"}},
                            "values": {"type": "array", "items": {"type": "number"}},
                            "labels": {"type": "array", "items": {"type": "string"}},
                            "name": {"type": "string"},
                            "mode": {"type": "string", "enum": ["lines", "markers", "lines+markers"]},
                            "marker": {"type": "object", "properties": {"color": {"type": "string"}, "size": {"type": "number"}}}
                        }
                    }
                },
                "layout": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "xaxis": {"type": "object", "properties": {"title": {"type": "string"}}},
                        "yaxis": {"type": "object", "properties": {"title": {"type": "string"}}},
                        "barmode": {"type": "string", "enum": ["group", "stack"]}
                    }
                },
                "width": {"type": "integer", "default": 800},
                "height": {"type": "integer", "default": 600}
            }
        }
    },
    {
        "name": "render_desmos_graph",
        "description": """Render mathematical function graphs using Desmos. Best for: linear equations (y=mx+c),
quadratic functions (y=ax²+bx+c), simultaneous equations, trigonometric functions.
Use LaTeX syntax: y=2x+3, y=x^2, y=\\sin(x), y=\\frac{1}{x}""",
        "input_schema": {
            "type": "object",
            "required": ["expressions"],
            "properties": {
                "expressions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["latex"],
                        "properties": {
                            "latex": {"type": "string", "description": "LaTeX expression like y=2x+3"},
                            "color": {"type": "string", "description": "Hex color like #ff0000"},
                            "line_style": {"type": "string", "enum": ["SOLID", "DASHED", "DOTTED"]},
                            "label": {"type": "string"},
                            "show_label": {"type": "boolean"}
                        }
                    }
                },
                "viewport": {
                    "type": "object",
                    "properties": {
                        "xmin": {"type": "number", "default": -10},
                        "xmax": {"type": "number", "default": 10},
                        "ymin": {"type": "number", "default": -10},
                        "ymax": {"type": "number", "default": 10}
                    }
                },
                "show_grid": {"type": "boolean", "default": True},
                "show_axes": {"type": "boolean", "default": True},
                "width": {"type": "integer", "default": 800},
                "height": {"type": "integer", "default": 600}
            }
        }
    },
    {
        "name": "render_geogebra_geometry",
        "description": """Render geometric constructions using GeoGebra. Best for: circle theorems,
triangles, angles, perpendicular bisectors, geometric proofs.
Commands: A=(0,0), Circle(A,3), Segment(A,B), Angle(A,B,C), Polygon(A,B,C), Midpoint(A,B)""",
        "input_schema": {
            "type": "object",
            "required": ["commands"],
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "GeoGebra commands like ['A=(0,0)', 'B=(4,0)', 'Circle(A,3)']"
                },
                "coord_system": {
                    "type": "object",
                    "properties": {
                        "xmin": {"type": "number", "default": -10},
                        "xmax": {"type": "number", "default": 10},
                        "ymin": {"type": "number", "default": -10},
                        "ymax": {"type": "number", "default": 10}
                    }
                },
                "show_axes": {"type": "boolean", "default": False},
                "show_grid": {"type": "boolean", "default": False},
                "width": {"type": "integer", "default": 600},
                "height": {"type": "integer", "default": 600}
            }
        }
    },
    {
        "name": "generate_educational_image",
        "description": """Generate AI images showing real-world math applications. Best for:
contextual illustrations, word problem scenarios, real-world examples of math concepts.
Examples: Pythagoras in construction, similar triangles in shadows, gradients in roads.""",
        "input_schema": {
            "type": "object",
            "required": ["description"],
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Detailed description of the educational image (10-2000 chars)"
                },
                "context": {"type": "string", "description": "How the image will be used"},
                "style": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string", "enum": ["realistic", "diagram", "illustration", "simple"]},
                        "color_scheme": {"type": "string", "enum": ["full-color", "muted", "monochrome"]},
                        "perspective": {"type": "string", "enum": ["front", "side", "top", "isometric"]}
                    }
                },
                "educational": {
                    "type": "object",
                    "properties": {
                        "subject": {"type": "string", "default": "Mathematics"},
                        "level": {"type": "string", "default": "National 5"},
                        "topic": {"type": "string"}
                    }
                },
                "width": {"type": "integer", "default": 1024},
                "height": {"type": "integer", "default": 1024}
            }
        }
    }
]


# ============================================================================
# Tool Execution
# ============================================================================

def execute_tool(tool_name: str, tool_input: dict) -> dict:
    """Execute a diagram tool and return the result"""

    if tool_name == "render_plotly_chart":
        traces = [PlotlyTrace(**t) for t in tool_input.get("traces", [])]
        layout = None
        if "layout" in tool_input:
            layout = PlotlyLayout(
                title=tool_input["layout"].get("title"),
                xaxis=PlotlyAxis(**tool_input["layout"]["xaxis"]) if "xaxis" in tool_input["layout"] else None,
                yaxis=PlotlyAxis(**tool_input["layout"]["yaxis"]) if "yaxis" in tool_input["layout"] else None,
                barmode=tool_input["layout"].get("barmode")
            )
        result = render_plotly_chart(PlotlyChartInput(
            traces=traces,
            layout=layout,
            width=tool_input.get("width", 800),
            height=tool_input.get("height", 600)
        ))

    elif tool_name == "render_desmos_graph":
        expressions = [DesmosExpression(**e) for e in tool_input.get("expressions", [])]
        viewport = DesmosViewport(**tool_input["viewport"]) if "viewport" in tool_input else None
        result = render_desmos_graph(DesmosGraphInput(
            expressions=expressions,
            viewport=viewport,
            show_grid=tool_input.get("show_grid", True),
            show_axes=tool_input.get("show_axes", True),
            width=tool_input.get("width", 800),
            height=tool_input.get("height", 600)
        ))

    elif tool_name == "render_geogebra_geometry":
        coord_system = GeoGebraCoordSystem(**tool_input["coord_system"]) if "coord_system" in tool_input else None
        result = render_geogebra_geometry(GeoGebraGeometryInput(
            commands=tool_input.get("commands", []),
            coord_system=coord_system,
            show_axes=tool_input.get("show_axes", False),
            show_grid=tool_input.get("show_grid", False),
            width=tool_input.get("width", 600),
            height=tool_input.get("height", 600)
        ))

    elif tool_name == "generate_educational_image":
        style = ImageStyle(**tool_input["style"]) if "style" in tool_input else None
        educational = EducationalContext(**tool_input["educational"]) if "educational" in tool_input else None
        result = generate_educational_image(EducationalImageInput(
            description=tool_input.get("description", ""),
            context=tool_input.get("context"),
            style=style,
            educational=educational,
            width=tool_input.get("width", 1024),
            height=tool_input.get("height", 1024)
        ))
    else:
        return {"error": f"Unknown tool: {tool_name}"}

    # Convert result to dict
    return {
        "success": result.success,
        "image_base64": result.image_base64,
        "error": result.error,
        "metadata": result.metadata
    }


def save_image(image_base64: str, filename: str) -> str:
    """Save base64 image to file and return path"""
    output_dir = Path("./generated_diagrams")
    output_dir.mkdir(exist_ok=True)

    filepath = output_dir / filename
    image_data = base64.b64decode(image_base64)
    filepath.write_bytes(image_data)

    return str(filepath)


# ============================================================================
# Main Agent Loop
# ============================================================================

def run_math_tutor_agent(user_message: str):
    """Run the math tutor agent with diagram capabilities"""

    client = anthropic.Anthropic()

    system_prompt = """You are a National 5 Mathematics tutor for Scottish students.
You help students understand mathematical concepts using visual diagrams.

When explaining concepts, use the appropriate diagram tool:
- Use render_plotly_chart for statistics (bar charts, pie charts, histograms, scatter plots, box plots)
- Use render_desmos_graph for algebra and functions (linear, quadratic, trigonometric graphs)
- Use render_geogebra_geometry for geometry (circles, triangles, angles, constructions)
- Use generate_educational_image for real-world context and word problems

Always provide clear explanations alongside the diagrams.
After generating a diagram, describe what it shows and how it relates to the concept."""

    messages = [{"role": "user", "content": user_message}]

    print(f"\n{'='*60}")
    print(f"Student: {user_message}")
    print(f"{'='*60}\n")

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            tools=TOOL_DEFINITIONS,
            messages=messages
        )

        # Process the response
        assistant_content = []
        tool_results = []

        for block in response.content:
            if block.type == "text":
                print(f"Tutor: {block.text}\n")
                assistant_content.append(block)

            elif block.type == "tool_use":
                print(f"[Generating {block.name}...]")

                # Execute the tool
                result = execute_tool(block.name, block.input)

                if result["success"] and result["image_base64"]:
                    # Save the image
                    filename = f"{block.name}_{block.id[:8]}.png"
                    filepath = save_image(result["image_base64"], filename)
                    print(f"[Saved diagram: {filepath}]")

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"Diagram generated successfully and saved to {filepath}. The image shows the requested visualization."
                    })
                else:
                    print(f"[Error: {result.get('error', 'Unknown error')}]")
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"Error generating diagram: {result.get('error', 'Unknown error')}",
                        "is_error": True
                    })

                assistant_content.append(block)

        # Add assistant message
        messages.append({"role": "assistant", "content": assistant_content})

        # If there were tool uses, add results and continue
        if tool_results:
            messages.append({"role": "user", "content": tool_results})
        else:
            # No more tool calls, we're done
            break

        # Check if we should stop
        if response.stop_reason == "end_turn":
            break

    print(f"\n{'='*60}")
    print("Session complete. Check ./generated_diagrams for images.")
    print(f"{'='*60}\n")


# ============================================================================
# Example Usage
# ============================================================================

if __name__ == "__main__":
    # Example prompts to try:
    examples = [
        "Can you show me the graph of y = 2x + 3 and explain what the gradient means?",
        "Create a bar chart showing these test scores: Class A got 65, 72, 78, 82, 70 and Class B got 75, 68, 80, 85, 72",
        "Show me the angle in a semicircle theorem with a clear diagram",
        "I need help understanding Pythagoras theorem with a real-world example",
    ]

    print("Math Tutor Agent with Diagram Tools")
    print("====================================")
    print("\nExample prompts:")
    for i, ex in enumerate(examples, 1):
        print(f"  {i}. {ex}")

    print("\nEnter your question (or number 1-4 for example):")
    user_input = input("> ").strip()

    # Check if user entered a number
    if user_input.isdigit() and 1 <= int(user_input) <= len(examples):
        user_input = examples[int(user_input) - 1]

    if user_input:
        run_math_tutor_agent(user_input)
