# Diagram Tools for Claude Agent SDK

This directory contains tools and examples for integrating the Diagram Rendering Service with Claude Agent SDK projects.

## Files

| File | Description |
|------|-------------|
| `diagram_tools.py` | Tool definitions with Pydantic models |
| `example_agent.py` | Complete agent example with tool execution |

## Quick Start

### 1. Install Dependencies

```bash
pip install anthropic httpx pydantic
```

### 2. Start the Diagram Service

```bash
cd /path/to/diagramScreenshot
npm run dev
# Service runs on http://localhost:3000
```

### 3. Set Environment Variables

```bash
export ANTHROPIC_API_KEY="your-anthropic-key"
export DIAGRAM_API_KEY="dev-api-key"  # or your production key
export DIAGRAM_SERVICE_URL="http://localhost:3000"
```

### 4. Run the Example Agent

```bash
python example_agent.py
```

## Integration Methods

### Method 1: Direct Function Import

```python
from diagram_tools import (
    render_plotly_chart,
    render_desmos_graph,
    render_geogebra_geometry,
    generate_educational_image,
    DIAGRAM_TOOLS  # List of all tools
)

# Configure service URL and API key
import diagram_tools
diagram_tools.DIAGRAM_SERVICE_URL = "http://localhost:3000"
diagram_tools.API_KEY = "your-api-key"

# Use directly
result = render_desmos_graph(DesmosGraphInput(
    expressions=[DesmosExpression(latex="y=x^2", color="#ff0000")]
))

if result.success:
    print(f"Image: {result.image_base64[:50]}...")
```

### Method 2: With Anthropic Messages API

```python
import anthropic

client = anthropic.Anthropic()

# Tool definitions for Claude
tools = [
    {
        "name": "render_desmos_graph",
        "description": "Render mathematical function graphs...",
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
                            "latex": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
]

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[{"role": "user", "content": "Graph y = 2x + 3"}]
)

# Handle tool_use blocks and execute tools
for block in response.content:
    if block.type == "tool_use":
        result = execute_tool(block.name, block.input)
        # ... handle result
```

### Method 3: With Claude Agent SDK (Agents)

```python
from claude_agent_sdk import Agent, tool

# Define tools using the @tool decorator
@tool
def render_desmos_graph(
    expressions: list[dict],
    viewport: dict = None,
    show_grid: bool = True
) -> dict:
    """Render mathematical function graphs using Desmos."""
    # Implementation calls the diagram service
    ...

# Create agent with tools
agent = Agent(
    model="claude-sonnet-4-20250514",
    tools=[render_desmos_graph, render_plotly_chart, ...]
)

# Run agent
result = agent.run("Show me the graph of y = x^2 - 4")
```

## Tool Selection Guide

| Math Topic | Tool | Example |
|------------|------|---------|
| Bar charts, pie charts | `render_plotly_chart` | Survey results, budget breakdown |
| Line graphs | `render_plotly_chart` | Temperature over time |
| Scatter plots | `render_plotly_chart` | Correlation analysis |
| Histograms | `render_plotly_chart` | Test score distribution |
| Box plots | `render_plotly_chart` | Comparing datasets |
| Linear equations | `render_desmos_graph` | y = 2x + 3 |
| Quadratics | `render_desmos_graph` | y = x² - 4x + 3 |
| Simultaneous equations | `render_desmos_graph` | Find intersection |
| Trigonometry | `render_desmos_graph` | y = sin(x) |
| Circle theorems | `render_geogebra_geometry` | Angle at centre |
| Triangles | `render_geogebra_geometry` | Constructions, proofs |
| Angles | `render_geogebra_geometry` | Properties, bisectors |
| Real-world context | `generate_educational_image` | Word problems |

## Response Format

All tools return a `DiagramResponse`:

```python
{
    "success": True,
    "image_base64": "iVBORw0KGgo...",  # Base64-encoded PNG
    "error": None,  # Error message if failed
    "metadata": {
        "tool": "desmos",
        "renderTimeMs": 1234,
        ...
    }
}
```

## Saving Generated Images

```python
import base64
from pathlib import Path

def save_diagram(result, filename):
    if result.success and result.image_base64:
        image_data = base64.b64decode(result.image_base64)
        Path(filename).write_bytes(image_data)
        print(f"Saved: {filename}")
```

## Error Handling

```python
result = render_desmos_graph(...)

if not result.success:
    if "VALIDATION_ERROR" in result.error:
        print("Invalid input parameters")
    elif "RENDERER_NOT_INITIALIZED" in result.error:
        print("Diagram service not ready")
    elif "RATE_LIMIT" in result.error:
        print("Too many requests, wait and retry")
    else:
        print(f"Error: {result.error}")
```

## Rate Limits

- **Plotly, Desmos, GeoGebra**: No rate limits
- **Imagen (AI images)**: 10 requests per minute per IP

## Configuration

Edit `diagram_tools.py` or set at runtime:

```python
import diagram_tools

# Change service URL
diagram_tools.DIAGRAM_SERVICE_URL = "https://your-production-url.com"

# Change API key
diagram_tools.API_KEY = os.environ["DIAGRAM_API_KEY"]
```
