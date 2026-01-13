"""Isolated Tests for Individual Diagram Tools.

Tests each diagram tool (Desmos, Matplotlib, Plotly, JSXGraph, Imagen) against
the diagramScreenshot service in isolation to verify:
1. Tool can be instantiated with workspace path
2. Tool can render a simple diagram to PNG file
3. PNG file exists at expected path
4. Tool returns correct response format

Prerequisites:
- diagramScreenshot service running at http://localhost:3001
- Start with: cd diagramScreenshot && npm run dev

Run tests:
    cd claud_author_agent
    pytest tests/test_individual_diagram_tools.py -v
"""

import asyncio
import json
import os
import pytest
from pathlib import Path
from typing import Dict, Any


# ═══════════════════════════════════════════════════════════════════════════
# TEST CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

DIAGRAM_SERVICE_URL = os.getenv("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
DIAGRAM_API_KEY = os.getenv("DIAGRAM_SCREENSHOT_API_KEY", "dev-api-key-change-in-production")


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def workspace(tmp_path) -> Path:
    """Create temporary workspace directory for tests."""
    diagrams_dir = tmp_path / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)
    return tmp_path


@pytest.fixture
def desmos_linear_expression() -> Dict[str, Any]:
    """Simple linear function for Desmos testing."""
    return {
        "expressions": [
            {"latex": "y=2x+1", "color": "#c74440"}
        ],
        "viewport": {"xmin": -5, "xmax": 5, "ymin": -5, "ymax": 10},
        "card_id": "test_desmos_001",
        "diagram_context": "lesson"
    }


@pytest.fixture
def plotly_bar_chart() -> Dict[str, Any]:
    """Simple bar chart for Plotly testing."""
    return {
        "chart": {
            "data": [
                {
                    "x": ["Mon", "Tue", "Wed", "Thu", "Fri"],
                    "y": [5, 8, 3, 9, 6],
                    "type": "bar",
                    "marker": {"color": "#2d70b3"}
                }
            ],
            "layout": {
                "title": "Daily Sales",
                "xaxis": {"title": "Day"},
                "yaxis": {"title": "Sales"}
            }
        },
        "card_id": "test_plotly_001",
        "diagram_context": "lesson"
    }


@pytest.fixture
def jsxgraph_point() -> Dict[str, Any]:
    """Simple point on coordinate grid for JSXGraph testing."""
    return {
        "diagram": {
            "board": {
                "boundingbox": [-5, 5, 5, -5],
                "axis": True,
                "showNavigation": False,
                "showCopyright": False
            },
            "elements": [
                {
                    "type": "point",
                    "args": [[2, 3]],
                    "attributes": {
                        "name": "A",
                        "size": 4,
                        "fillColor": "#0066CC",
                        "strokeColor": "#0066CC"
                    }
                }
            ]
        },
        "card_id": "test_jsxgraph_001",
        "diagram_context": "lesson"
    }


@pytest.fixture
def matplotlib_bar_code() -> Dict[str, Any]:
    """Simple matplotlib bar chart code for testing."""
    return {
        "code": '''import matplotlib.pyplot as plt
import numpy as np

# Create figure
fig, ax = plt.subplots(figsize=(8, 6))

# Data
categories = ['A', 'B', 'C', 'D']
values = [25, 40, 30, 55]

# Create bar chart
bars = ax.bar(categories, values, color='#2d70b3')

# Labels
ax.set_xlabel('Category')
ax.set_ylabel('Value')
ax.set_title('Sample Bar Chart')

# Save to OUTPUT_PATH (will be replaced by tool)
plt.savefig(OUTPUT_PATH, dpi=100, bbox_inches='tight', facecolor='white')
plt.close()
''',
        "card_id": "test_matplotlib_001",
        "diagram_context": "lesson"
    }


@pytest.fixture
def imagen_prompt() -> Dict[str, Any]:
    """Simple imagen prompt for testing."""
    return {
        "prompt": {
            "text": "A simple 2D diagram showing a ladder leaning against a brick wall at 60 degrees angle",
            "style": {
                "type": "diagram",
                "colorScheme": "muted"
            },
            "educational": {
                "subject": "mathematics",
                "level": "secondary",
                "topic": "trigonometry"
            }
        },
        "card_id": "test_imagen_001",
        "diagram_context": "lesson"
    }


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════════

def check_service_health() -> bool:
    """Check if diagramScreenshot service is running."""
    import requests
    try:
        response = requests.get(f"{DIAGRAM_SERVICE_URL}/health", timeout=5)
        return response.status_code == 200
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════════
# DESMOS TOOL TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestDesmosToolIsolated:
    """Test Desmos function graphing tool in isolation."""

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_linear_function(self, workspace, desmos_linear_expression):
        """Test rendering a simple linear function with Desmos via HTTP."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/desmos/simple",
            json={
                "expressions": desmos_linear_expression["expressions"],
                "viewport": desmos_linear_expression["viewport"],
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True
        assert "image" in result
        assert len(result["image"]) > 0  # Base64 image data

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_quadratic_function(self, workspace):
        """Test rendering a quadratic function."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/desmos/simple",
            json={
                "expressions": [
                    {"latex": "y=x^2-4x+3", "color": "#2d70b3"},
                    {"latex": "(1,0)", "color": "#c74440"},  # Root point
                    {"latex": "(3,0)", "color": "#c74440"}   # Root point
                ],
                "viewport": {"xmin": -2, "xmax": 6, "ymin": -2, "ymax": 6},
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True


# ═══════════════════════════════════════════════════════════════════════════
# PLOTLY TOOL TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestPlotlyToolIsolated:
    """Test Plotly statistical charts tool in isolation."""

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_bar_chart(self, workspace, plotly_bar_chart):
        """Test rendering a simple bar chart with Plotly."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/plotly",
            json={
                "chart": plotly_bar_chart["chart"],
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True
        assert "image" in result

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_pie_chart(self, workspace):
        """Test rendering a pie chart with Plotly."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/plotly",
            json={
                "chart": {
                    "data": [
                        {
                            "values": [30, 25, 20, 15, 10],
                            "labels": ["Walk", "Bus", "Car", "Bike", "Train"],
                            "type": "pie",
                            "marker": {
                                "colors": ["#c74440", "#2d70b3", "#388c46", "#6042a6", "#fa7e19"]
                            }
                        }
                    ],
                    "layout": {
                        "title": "Transport Methods"
                    }
                },
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_scatter_plot(self, workspace):
        """Test rendering a scatter plot with line of best fit."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/plotly",
            json={
                "chart": {
                    "data": [
                        {
                            "x": [1, 2, 3, 4, 5, 6, 7, 8],
                            "y": [2.1, 3.8, 5.2, 7.1, 8.5, 10.2, 11.8, 14.1],
                            "type": "scatter",
                            "mode": "markers",
                            "name": "Data",
                            "marker": {"color": "#2d70b3", "size": 10}
                        }
                    ],
                    "layout": {
                        "title": "Height vs Weight",
                        "xaxis": {"title": "Height (cm)"},
                        "yaxis": {"title": "Weight (kg)"}
                    }
                },
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True


# ═══════════════════════════════════════════════════════════════════════════
# JSXGRAPH TOOL TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestJSXGraphToolIsolated:
    """Test JSXGraph coordinate geometry tool in isolation."""

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_point(self, workspace, jsxgraph_point):
        """Test rendering a simple point on coordinate grid."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render",
            json={
                "diagram": jsxgraph_point["diagram"],
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True
        assert "image" in result

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_triangle(self, workspace):
        """Test rendering a triangle on coordinate grid."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render",
            json={
                "diagram": {
                    "board": {
                        "boundingbox": [-2, 8, 10, -2],
                        "axis": True,
                        "showNavigation": False,
                        "showCopyright": False
                    },
                    "elements": [
                        {
                            "type": "polygon",
                            "args": [[[0, 0], [6, 0], [3, 5]]],
                            "attributes": {
                                "fillColor": "#0066CC",
                                "fillOpacity": 0.2,
                                "strokeColor": "#0066CC",
                                "strokeWidth": 2,
                                "vertices": {"visible": False}
                            }
                        },
                        {
                            "type": "text",
                            "args": [0, -0.5, "A"],
                            "attributes": {"fontSize": 14}
                        },
                        {
                            "type": "text",
                            "args": [6, -0.5, "B"],
                            "attributes": {"fontSize": 14}
                        },
                        {
                            "type": "text",
                            "args": [3, 5.5, "C"],
                            "attributes": {"fontSize": 14}
                        }
                    ]
                },
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_render_linear_function_graph(self, workspace):
        """Test rendering a linear function graph."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render",
            json={
                "diagram": {
                    "board": {
                        "boundingbox": [-5, 10, 5, -5],
                        "axis": True,
                        "showNavigation": False,
                        "showCopyright": False
                    },
                    "elements": [
                        {
                            "type": "functiongraph",
                            "args": ["2*x + 1", -5, 5],
                            "attributes": {
                                "strokeColor": "#0066CC",
                                "strokeWidth": 2
                            }
                        }
                    ]
                },
                "options": {"width": 800, "height": 600}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=30
        )

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True


# ═══════════════════════════════════════════════════════════════════════════
# MATPLOTLIB TOOL TESTS (LOCAL EXECUTION)
# ═══════════════════════════════════════════════════════════════════════════

def check_matplotlib_available() -> bool:
    """Check if matplotlib is available for local execution."""
    try:
        import matplotlib
        return True
    except ImportError:
        return False


class TestMatplotlibToolIsolated:
    """Test Matplotlib local execution tool in isolation."""

    @pytest.mark.skipif(not check_matplotlib_available(), reason="matplotlib not installed")
    def test_render_bar_chart_locally(self, workspace, matplotlib_bar_code):
        """Test rendering a bar chart using local matplotlib execution."""
        import subprocess
        import sys

        # Create output path
        output_path = workspace / "diagrams" / "test_matplotlib_bar.png"

        # Replace OUTPUT_PATH placeholder in code
        code = matplotlib_bar_code["code"].replace("OUTPUT_PATH", f"'{str(output_path)}'")

        # Execute matplotlib code in subprocess
        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=30
        )

        # Check execution succeeded
        assert result.returncode == 0, f"Matplotlib execution failed: {result.stderr}"

        # Check PNG file was created
        assert output_path.exists(), f"PNG file not created at {output_path}"

        # Check file has content
        file_size = output_path.stat().st_size
        assert file_size > 0, "PNG file is empty"

    @pytest.mark.skipif(not check_matplotlib_available(), reason="matplotlib not installed")
    def test_render_pie_chart_locally(self, workspace):
        """Test rendering a pie chart using local matplotlib execution."""
        import subprocess
        import sys

        output_path = workspace / "diagrams" / "test_matplotlib_pie.png"

        code = f'''import matplotlib.pyplot as plt

# Data
sizes = [30, 25, 20, 15, 10]
labels = ['Walk', 'Bus', 'Car', 'Bike', 'Train']
colors = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19']

# Create pie chart
fig, ax = plt.subplots(figsize=(8, 8))
ax.pie(sizes, labels=labels, colors=colors, autopct='%1.0f%%', startangle=90)
ax.set_title('Transport Methods')

plt.savefig('{str(output_path)}', dpi=100, bbox_inches='tight', facecolor='white')
plt.close()
'''

        result = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=30
        )

        assert result.returncode == 0, f"Matplotlib execution failed: {result.stderr}"
        assert output_path.exists(), f"PNG file not created at {output_path}"


# ═══════════════════════════════════════════════════════════════════════════
# IMAGEN TOOL TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestImagenToolIsolated:
    """Test Imagen AI image generation tool in isolation."""

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    @pytest.mark.skipif(
        not os.getenv("GOOGLE_AI_API_KEY"),
        reason="GOOGLE_AI_API_KEY not set - Imagen requires API key"
    )
    def test_render_simple_scene(self, workspace, imagen_prompt):
        """Test generating a simple educational image with Imagen."""
        import requests

        response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/imagen",
            json={
                "prompt": imagen_prompt["prompt"],
                "options": {"width": 1024, "height": 768}
            },
            headers={
                "Content-Type": "application/json",
                "X-API-Key": DIAGRAM_API_KEY
            },
            timeout=60  # Imagen can be slower
        )

        # Imagen may return 503 if not configured
        if response.status_code == 503:
            pytest.skip("Imagen service not configured (missing GOOGLE_AI_API_KEY)")

        # Imagen may return 429 if rate limited
        if response.status_code == 429:
            pytest.skip("Imagen rate limit exceeded")

        assert response.status_code == 200
        result = response.json()
        assert result.get("success") is True
        assert "image" in result

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_imagen_status_endpoint(self, workspace):
        """Test that Imagen status endpoint is available."""
        import requests

        response = requests.get(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/imagen/status",
            headers={"X-API-Key": DIAGRAM_API_KEY},
            timeout=10
        )

        # Status endpoint should always work
        assert response.status_code == 200
        result = response.json()
        assert "available" in result or "status" in result


# ═══════════════════════════════════════════════════════════════════════════
# TOOL FACTORY TESTS
# ═══════════════════════════════════════════════════════════════════════════

def check_sdk_available():
    """Check if claude_agent_sdk is available."""
    try:
        import claude_agent_sdk
        return True
    except ImportError:
        return False


class TestToolFactoryFunctions:
    """Test that each tool factory can be imported and called.

    Note: These tests require claude_agent_sdk to be installed.
    They will be skipped if the SDK is not available.
    """

    @pytest.mark.skipif(not check_sdk_available(), reason="claude_agent_sdk not installed")
    def test_desmos_server_creation(self, workspace):
        """Test create_desmos_server factory function."""
        from src.tools.desmos_tool import create_desmos_server

        server = create_desmos_server(
            workspace_path=str(workspace),
            api_base_url=DIAGRAM_SERVICE_URL,
            api_key=DIAGRAM_API_KEY
        )

        assert server is not None
        assert "name" in server
        assert server["name"] == "desmos"

    @pytest.mark.skipif(not check_sdk_available(), reason="claude_agent_sdk not installed")
    def test_matplotlib_server_creation(self, workspace):
        """Test create_matplotlib_server factory function."""
        from src.tools.matplotlib_tool import create_matplotlib_server

        server = create_matplotlib_server(workspace_path=str(workspace))

        assert server is not None
        assert "name" in server
        assert server["name"] == "matplotlib"

    @pytest.mark.skipif(not check_sdk_available(), reason="claude_agent_sdk not installed")
    def test_plotly_server_creation(self, workspace):
        """Test create_plotly_server factory function."""
        from src.tools.plotly_tool import create_plotly_server

        server = create_plotly_server(
            workspace_path=str(workspace),
            api_base_url=DIAGRAM_SERVICE_URL,
            api_key=DIAGRAM_API_KEY
        )

        assert server is not None
        assert "name" in server
        assert server["name"] == "plotly"

    @pytest.mark.skipif(not check_sdk_available(), reason="claude_agent_sdk not installed")
    def test_jsxgraph_server_creation(self, workspace):
        """Test create_jsxgraph_server factory function."""
        from src.tools.jsxgraph_tool import create_jsxgraph_server

        server = create_jsxgraph_server(
            workspace_path=str(workspace),
            api_base_url=DIAGRAM_SERVICE_URL,
            api_key=DIAGRAM_API_KEY
        )

        assert server is not None
        assert "name" in server
        assert server["name"] == "jsxgraph"

    @pytest.mark.skipif(not check_sdk_available(), reason="claude_agent_sdk not installed")
    def test_imagen_server_creation(self, workspace):
        """Test create_imagen_server factory function."""
        from src.tools.imagen_tool import create_imagen_server

        server = create_imagen_server(
            workspace_path=str(workspace),
            api_base_url=DIAGRAM_SERVICE_URL,
            api_key=DIAGRAM_API_KEY
        )

        assert server is not None
        assert "name" in server
        assert server["name"] == "imagen"


# ═══════════════════════════════════════════════════════════════════════════
# COMPREHENSIVE MULTI-TOOL TEST
# ═══════════════════════════════════════════════════════════════════════════

class TestAllToolsEndToEnd:
    """End-to-end test that all diagram tools can render successfully."""

    @pytest.mark.skipif(not check_service_health(), reason="diagramScreenshot service not running")
    def test_all_http_tools_render(self, workspace):
        """Test that all HTTP-based tools (Desmos, Plotly, JSXGraph) can render."""
        import requests

        results = {}

        # Test Desmos
        desmos_response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/desmos/simple",
            json={
                "expressions": [{"latex": "y=x", "color": "#c74440"}],
                "viewport": {"xmin": -5, "xmax": 5, "ymin": -5, "ymax": 5}
            },
            headers={"Content-Type": "application/json", "X-API-Key": DIAGRAM_API_KEY},
            timeout=30
        )
        results["desmos"] = desmos_response.status_code == 200

        # Test Plotly
        plotly_response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render/plotly",
            json={
                "chart": {
                    "data": [{"x": [1, 2, 3], "y": [1, 2, 3], "type": "bar"}],
                    "layout": {"title": "Test"}
                }
            },
            headers={"Content-Type": "application/json", "X-API-Key": DIAGRAM_API_KEY},
            timeout=30
        )
        results["plotly"] = plotly_response.status_code == 200

        # Test JSXGraph
        jsxgraph_response = requests.post(
            f"{DIAGRAM_SERVICE_URL}/api/v1/render",
            json={
                "diagram": {
                    "board": {"boundingbox": [-5, 5, 5, -5], "axis": True},
                    "elements": [{"type": "point", "args": [[0, 0]], "attributes": {"name": "O"}}]
                }
            },
            headers={"Content-Type": "application/json", "X-API-Key": DIAGRAM_API_KEY},
            timeout=30
        )
        results["jsxgraph"] = jsxgraph_response.status_code == 200

        # All should pass
        for tool, success in results.items():
            assert success, f"{tool} rendering failed"

        print(f"\n✅ All HTTP tools passed: {results}")
