"""Matplotlib Geometric Diagram MCP Tool.

Provides MCP tool interface for rendering geometric diagrams using Matplotlib
via local Python code execution.

**Purpose**: Pure geometry, circle theorems, angle work, and geometric constructions
- Circle theorems (angle at center, angles in same segment, tangent properties)
- Geometric constructions (bisectors, perpendiculars, parallel lines)
- Triangle properties (medians, altitudes, circumcircle, incircle)
- Angle relationships (corresponding, alternate, co-interior angles)
- Bearings diagrams
- Geometric proofs or demonstrations
- Congruence and similarity visualizations
- Arc and sector diagrams

**LOCAL EXECUTION ARCHITECTURE**: Unlike browser-based tools (Desmos, GeoGebra, JSXGraph),
Matplotlib runs locally in a sandboxed Python subprocess. The agent generates Python code
that uses matplotlib to create the diagram, then executes it to produce a PNG.

Process:
1. Agent generates matplotlib Python code with OUTPUT_PATH placeholder
2. Tool injects actual file path for OUTPUT_PATH
3. Code executes in isolated subprocess with timeout
4. PNG written to workspace/diagrams/
5. File path returned to agent

Tool Pattern:
- Tool name convention: mcp__matplotlib__render_matplotlib
- Fast-fail on all errors (execution errors, timeouts, validation failures)
- FILE-BASED: Writes PNG to {workspace}/diagrams/ and returns path

Usage:
    Tool name: mcp__matplotlib__render_matplotlib
    Args: {
        "code": "import matplotlib.pyplot as plt\\nimport numpy as np\\n...",
        "card_id": "q5",
        "diagram_context": "question"
    }

Returns:
    - Success: {"success": true, "image_path": "/path/diagrams/q5_question.png", "metadata": {...}}
    - Failure: {"success": false, "error": {...}} with isError: True
"""

import json
import logging
import os
import subprocess
import sys
import textwrap
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import tool, create_sdk_mcp_server

# Set up logging
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Configuration Constants
# ═══════════════════════════════════════════════════════════════

# Execution timeout (30 seconds - same as GeoGebra)
EXECUTION_TIMEOUT = 30

# Default render options
DEFAULT_RENDER_OPTIONS = {
    "width": 800,
    "height": 600,
    "dpi": 100
}

# Safe imports allowed in matplotlib code
SAFE_IMPORTS = [
    "matplotlib",
    "matplotlib.pyplot",
    "matplotlib.patches",
    "matplotlib.lines",
    "matplotlib.colors",
    "numpy",
    "math"
]


# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def _ensure_diagrams_directory(workspace_path: str) -> Path:
    """Ensure diagrams directory exists and return path."""
    diagrams_dir = Path(workspace_path) / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)
    return diagrams_dir


def _build_output_filename(
    card_id: str,
    diagram_context: str,
    diagram_index: int = 0
) -> str:
    """Build filename for diagram PNG."""
    if diagram_index > 0:
        return f"{card_id}_{diagram_context}_{diagram_index}.png"
    return f"{card_id}_{diagram_context}.png"


def _build_error_response(
    code: str,
    message: str,
    details: Optional[Any] = None,
    suggestion: Optional[str] = None
) -> Dict[str, Any]:
    """Build standardized error response for MCP protocol."""
    error_obj = {
        "code": code,
        "message": message
    }

    if details is not None:
        error_obj["details"] = details
    if suggestion:
        error_obj["suggestion"] = suggestion

    return {
        "content": [{
            "type": "text",
            "text": json.dumps({
                "success": False,
                "error": error_obj
            }, indent=2)
        }],
        "isError": True
    }


def _indent_code(code: str, spaces: int = 4) -> str:
    """Indent each line of code by specified spaces."""
    indent = " " * spaces
    lines = code.splitlines()
    return "\n".join(indent + line for line in lines)


def _execute_matplotlib_sandboxed(
    code: str,
    output_path: Path,
    width: int,
    height: int,
    dpi: int
) -> Dict[str, Any]:
    """Execute matplotlib code in isolated subprocess.

    Security measures:
    - Runs in subprocess with timeout
    - Uses Agg backend (no display required)
    - Controlled execution environment

    Args:
        code: Python matplotlib code to execute (with OUTPUT_PATH placeholder)
        output_path: Path where PNG should be written
        width: Image width in pixels
        height: Image height in pixels
        dpi: DPI for output image

    Returns:
        Dict with 'success' bool and optional 'error'/'stderr' keys
    """
    # Inject OUTPUT_PATH into code
    exec_code = code.replace("OUTPUT_PATH", f'r"{output_path}"')

    # Calculate figure size from pixels and dpi
    fig_width = width / dpi
    fig_height = height / dpi

    # Create wrapper script with safety measures
    wrapper = f'''
import sys
import warnings
warnings.filterwarnings('ignore')

# Force non-interactive backend BEFORE importing pyplot
import matplotlib
matplotlib.use('Agg')

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.lines as mlines
from matplotlib.patches import Arc, FancyArrowPatch, Circle, Polygon, Rectangle, Wedge, PathPatch
from matplotlib.path import Path as MplPath
import numpy as np
import math

# Set figure defaults
plt.rcParams['figure.figsize'] = [{fig_width}, {fig_height}]
plt.rcParams['figure.dpi'] = {dpi}
plt.rcParams['savefig.dpi'] = {dpi}
plt.rcParams['savefig.bbox'] = 'tight'
plt.rcParams['savefig.facecolor'] = 'white'
plt.rcParams['axes.facecolor'] = 'white'
plt.rcParams['figure.facecolor'] = 'white'

try:
{_indent_code(exec_code, 4)}
except Exception as e:
    import traceback
    print(f"MATPLOTLIB_ERROR: {{e}}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
'''

    # Execute with timeout
    try:
        result = subprocess.run(
            [sys.executable, "-c", wrapper],
            capture_output=True,
            text=True,
            timeout=EXECUTION_TIMEOUT,
            cwd=str(output_path.parent),
            env={**os.environ, "MPLBACKEND": "Agg"}  # Force Agg backend
        )

        if result.returncode == 0 and output_path.exists():
            logger.info(f"✅ Matplotlib: Code executed successfully, output: {output_path}")
            return {"success": True}
        else:
            error_msg = result.stderr.strip() if result.stderr else "Unknown execution error"
            # Clean up matplotlib error messages
            if "MATPLOTLIB_ERROR:" in error_msg:
                error_msg = error_msg.split("MATPLOTLIB_ERROR:")[1].strip().split("\n")[0]
            logger.error(f"❌ Matplotlib execution failed: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "stderr": result.stderr,
                "stdout": result.stdout
            }

    except subprocess.TimeoutExpired:
        logger.error(f"❌ Matplotlib execution timed out ({EXECUTION_TIMEOUT}s)")
        return {
            "success": False,
            "error": f"Matplotlib execution timed out ({EXECUTION_TIMEOUT}s limit)",
            "stderr": "Timeout"
        }

    except Exception as e:
        logger.error(f"❌ Matplotlib subprocess error: {e}")
        return {
            "success": False,
            "error": str(e),
            "stderr": str(e)
        }


# ═══════════════════════════════════════════════════════════════
# MCP Tool Implementation Factory
# ═══════════════════════════════════════════════════════════════

def create_matplotlib_server(workspace_path: str, api_base_url: str = None, api_key: str = None):
    """Create Matplotlib MCP server with workspace path captured in closure.

    This factory function creates a render_matplotlib tool for geometric diagrams
    that executes Python/Matplotlib code locally.

    Args:
        workspace_path: Absolute path to workspace directory where diagrams will be written
        api_base_url: Not used (kept for interface consistency with other tools)
        api_key: Not used (kept for interface consistency with other tools)

    Returns:
        MCP server configuration dict with type='sdk' for SDK-based integration

    Example:
        server = create_matplotlib_server("/workspace")
    """

    @tool(
        "render_matplotlib",
        "Render geometric diagram using Matplotlib Python code. Best for: circle theorems, constructions, triangles, angle relationships, bearings, proofs. Executes locally, returns PNG file path.",
        {
            "code": {
                "type": "string",
                "description": "Python matplotlib code to execute. Must use OUTPUT_PATH placeholder for savefig path. Example: plt.savefig(OUTPUT_PATH, ...)",
                "required": True
            },
            "card_id": {
                "type": "string",
                "description": "Card/question identifier for filename (e.g., 'q5')",
                "required": True
            },
            "diagram_context": {
                "type": "string",
                "description": "Context: 'question', 'worked_solution', 'hint', 'misconception', 'lesson', or 'cfu'",
                "required": True
            },
            "diagram_index": {
                "type": "integer",
                "description": "Index for multiple diagrams per card (0 for first/only)",
                "required": False
            },
            "width": {
                "type": "integer",
                "description": "Image width in pixels (default: 800)",
                "required": False
            },
            "height": {
                "type": "integer",
                "description": "Image height in pixels (default: 600)",
                "required": False
            },
            "dpi": {
                "type": "integer",
                "description": "DPI for output image (default: 100)",
                "required": False
            }
        }
    )
    async def render_matplotlib(args):
        """Render geometric diagram using Matplotlib via local Python execution.

        **MATPLOTLIB STRENGTHS**:
        - Fast rendering (no browser required)
        - Precise control over angle arcs and labels
        - Clean geometric diagrams
        - Reliable AI code generation (standard Python)
        - Best for "prove" or "show that" geometry tasks

        **Code Requirements**:
        - Must import matplotlib.pyplot as plt
        - Must use OUTPUT_PATH placeholder for savefig
        - Should call plt.close() after savefig
        - Should use ax.set_aspect('equal') for geometry
        - Should use ax.axis('off') unless grid is needed

        **Example code structure**:
        ```python
        import matplotlib.pyplot as plt
        from matplotlib.patches import Circle, Arc
        import numpy as np

        fig, ax = plt.subplots(figsize=(8, 6))
        ax.set_aspect('equal')

        # Draw geometry here...

        ax.axis('off')
        plt.savefig(OUTPUT_PATH, dpi=100, bbox_inches='tight', facecolor='white')
        plt.close()
        ```

        Args:
            args: Dictionary with code, card_id, diagram_context, optional width/height/dpi

        Returns:
            Success: {success: true, image_path: "...", tool_used: "MATPLOTLIB", metadata: {...}}
            Failure: {success: false, error: {...}, isError: true}
        """
        try:
            # Extract arguments
            code = args.get("code")
            card_id = args.get("card_id")
            diagram_context = args.get("diagram_context")
            diagram_index = args.get("diagram_index", 0)
            width = args.get("width", DEFAULT_RENDER_OPTIONS["width"])
            height = args.get("height", DEFAULT_RENDER_OPTIONS["height"])
            dpi = args.get("dpi", DEFAULT_RENDER_OPTIONS["dpi"])

            # Handle string conversions (SDK may pass as strings)
            if isinstance(diagram_index, str):
                try:
                    diagram_index = int(diagram_index)
                except ValueError:
                    return _build_error_response(
                        code="VALIDATION_ERROR",
                        message="Field 'diagram_index' must be an integer",
                        suggestion="Ensure diagram_index is 0, 1, 2, etc."
                    )

            if isinstance(width, str):
                try:
                    width = int(width)
                except ValueError:
                    width = DEFAULT_RENDER_OPTIONS["width"]

            if isinstance(height, str):
                try:
                    height = int(height)
                except ValueError:
                    height = DEFAULT_RENDER_OPTIONS["height"]

            if isinstance(dpi, str):
                try:
                    dpi = int(dpi)
                except ValueError:
                    dpi = DEFAULT_RENDER_OPTIONS["dpi"]

            # Validate required fields
            if not code:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'code' not provided",
                    suggestion="Provide Python matplotlib code with OUTPUT_PATH placeholder"
                )

            if not isinstance(code, str):
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Field 'code' must be a string",
                    details={"received_type": type(code).__name__},
                    suggestion="Provide code as a string"
                )

            if not card_id:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'card_id' not provided",
                    suggestion="Provide card_id for filename (e.g., 'q5')"
                )

            if not diagram_context:
                return _build_error_response(
                    code="MISSING_FIELD",
                    message="Required field 'diagram_context' not provided",
                    suggestion="Provide diagram_context: 'question', 'worked_solution', 'hint', 'misconception', 'lesson', or 'cfu'"
                )

            valid_contexts = ["question", "worked_solution", "hint", "misconception", "lesson", "cfu"]
            if diagram_context not in valid_contexts:
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message=f"Invalid diagram_context: '{diagram_context}'",
                    suggestion=f"Use one of: {', '.join(valid_contexts)}"
                )

            # Validate code contains OUTPUT_PATH
            if "OUTPUT_PATH" not in code:
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Code must contain OUTPUT_PATH placeholder for savefig",
                    suggestion="Use plt.savefig(OUTPUT_PATH, ...) in your code"
                )

            # Validate code contains savefig
            if "savefig" not in code.lower():
                return _build_error_response(
                    code="VALIDATION_ERROR",
                    message="Code must call savefig to produce output",
                    suggestion="Add plt.savefig(OUTPUT_PATH, dpi=100, bbox_inches='tight') to your code"
                )

            logger.info(f"🔧 Matplotlib render_matplotlib called: card_id={card_id}, context={diagram_context}")
            logger.info(f"🔧 Matplotlib code length: {len(code)} chars, {len(code.splitlines())} lines")

            # Ensure diagrams directory exists
            diagrams_dir = _ensure_diagrams_directory(workspace_path)

            # Build output path
            filename = _build_output_filename(card_id, diagram_context, diagram_index)
            output_path = diagrams_dir / filename

            # Execute matplotlib code
            result = _execute_matplotlib_sandboxed(code, output_path, width, height, dpi)

            if result["success"]:
                logger.info(f"✅ Matplotlib: Diagram rendered successfully: {output_path}")

                # Get file size for metadata
                file_size = output_path.stat().st_size if output_path.exists() else 0

                response = {
                    "success": True,
                    "image_path": str(output_path.absolute()),
                    "tool_used": "MATPLOTLIB",
                    "metadata": {
                        "width": width,
                        "height": height,
                        "dpi": dpi,
                        "code_lines": len(code.splitlines()),
                        "file_size_bytes": file_size
                    }
                }

                return {
                    "content": [{
                        "type": "text",
                        "text": json.dumps(response, indent=2)
                    }]
                }
            else:
                return _build_error_response(
                    code="EXECUTION_ERROR",
                    message=result.get("error", "Unknown execution error"),
                    details={
                        "stderr": result.get("stderr", ""),
                        "stdout": result.get("stdout", "")
                    },
                    suggestion="Check matplotlib code syntax, imports, and ensure plt.savefig(OUTPUT_PATH) is called"
                )

        except Exception as e:
            logger.error(f"Matplotlib render_matplotlib unexpected error: {e}", exc_info=True)
            return _build_error_response(
                code="INTERNAL_ERROR",
                message=f"Unexpected error in render_matplotlib tool: {str(e)}",
                suggestion="Check tool implementation and logs"
            )

    # Return MCP server configuration for SDK-based integration
    return create_sdk_mcp_server(
        name="matplotlib",
        version="1.0.0",
        tools=[render_matplotlib]
    )


# ═══════════════════════════════════════════════════════════════
# MCP Server Entry Point
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    """Run Matplotlib MCP server when invoked via python -m.

    Reads configuration from environment variables:
    - WORKSPACE_PATH: Path to workspace directory (required)
    """
    import asyncio

    # Read configuration from environment
    workspace_path = os.environ.get("WORKSPACE_PATH")

    if not workspace_path:
        logger.error("❌ WORKSPACE_PATH environment variable is required")
        raise RuntimeError("WORKSPACE_PATH environment variable is required")

    logger.info(f"🚀 Starting Matplotlib MCP server")
    logger.info(f"   Workspace: {workspace_path}")

    # Create and run MCP server
    server = create_matplotlib_server(workspace_path=workspace_path)

    # Run the server (this blocks until the server exits)
    asyncio.run(server.run())
