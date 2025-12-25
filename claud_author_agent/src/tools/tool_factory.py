"""Tool Factory for Multi-Tool Diagram Support.

Factory function to create appropriate MCP servers based on tool type.
Centralizes tool configuration and ensures consistent interface across
all diagram rendering tools.

Tool Types Supported:
    - DESMOS: Function graphing via DiagramScreenshot service
    - MATPLOTLIB: Pure geometry via local Python execution
    - JSXGRAPH: Coordinate geometry via DiagramScreenshot service
    - PLOTLY: Statistics/charts via DiagramScreenshot service
    - IMAGE_GENERATION: AI images via DiagramScreenshot/Imagen service

Usage:
    from tools.tool_factory import get_mcp_server_for_tool, get_all_diagram_tools

    # Get single tool server
    server = get_mcp_server_for_tool("MATPLOTLIB", workspace_path, api_base_url)

    # Get all tool servers for multi-tool support
    servers = get_all_diagram_tools(workspace_path, api_base_url, api_key)
"""

import logging
import os
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# Tool Type Configuration
# ═══════════════════════════════════════════════════════════════

# Mapping of tool types to their configurations
TOOL_CONFIG = {
    "DESMOS": {
        "server_name": "desmos",
        "tool_name": "mcp__desmos__render_desmos",
        "factory_module": "tools.desmos_tool",
        "factory_function": "create_desmos_server",
        "requires_api": True,
        "description": "Function graphing (y=f(x), quadratics, trigonometry)"
    },
    "MATPLOTLIB": {
        "server_name": "matplotlib",
        "tool_name": "mcp__matplotlib__render_matplotlib",
        "factory_module": "tools.matplotlib_tool",
        "factory_function": "create_matplotlib_server",
        "requires_api": False,  # Local execution
        "description": "Pure geometry (circle theorems, constructions, angles)"
    },
    "JSXGRAPH": {
        "server_name": "diagram-screenshot",  # Uses existing JSXGraph tool
        "tool_name": "mcp__diagram-screenshot__render_diagram",
        "factory_module": "tools.diagram_screenshot_tool",
        "factory_function": "create_diagram_screenshot_server_with_workspace",
        "requires_api": True,
        "description": "Coordinate geometry (transformations, vectors, lines)"
    },
    "PLOTLY": {
        "server_name": "plotly",
        "tool_name": "mcp__plotly__render_plotly",
        "factory_module": "tools.plotly_tool",
        "factory_function": "create_plotly_server",
        "requires_api": True,
        "description": "Statistics/data visualization (charts, histograms, plots)"
    },
    "IMAGE_GENERATION": {
        "server_name": "imagen",
        "tool_name": "mcp__imagen__render_imagen",
        "factory_module": "tools.imagen_tool",
        "factory_function": "create_imagen_server",
        "requires_api": True,
        "description": "Real-world contextual images (word problem illustrations)"
    }
}

# Default API configuration
DEFAULT_API_BASE_URL = os.environ.get("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
DEFAULT_API_KEY = os.environ.get("DIAGRAM_SCREENSHOT_API_KEY", "")


# ═══════════════════════════════════════════════════════════════
# Tool Factory Functions
# ═══════════════════════════════════════════════════════════════

def get_mcp_server_for_tool(
    tool_type: str,
    workspace_path: str,
    api_base_url: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Create MCP server configuration for a specific tool type.

    Factory function that dynamically imports and creates the appropriate
    MCP server based on tool type. Each server is configured with the
    workspace path for file output.

    Args:
        tool_type: One of DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION
        workspace_path: Absolute path to workspace directory for diagram output
        api_base_url: Base URL for DiagramScreenshot service (default: http://localhost:3001)
        api_key: API key for DiagramScreenshot service (optional)

    Returns:
        MCP server configuration dict for Claude Agent SDK

    Raises:
        ValueError: If tool_type is invalid or NONE
        ImportError: If tool module cannot be imported

    Example:
        server = get_mcp_server_for_tool("MATPLOTLIB", "/workspace", "http://localhost:3001")
    """
    # Validate tool type
    if tool_type not in TOOL_CONFIG:
        valid_tools = list(TOOL_CONFIG.keys())
        raise ValueError(
            f"Invalid tool_type '{tool_type}'. Must be one of: {valid_tools}"
        )

    if tool_type == "NONE":
        raise ValueError(
            "Cannot create MCP server for tool_type 'NONE' - no diagram needed"
        )

    # Get tool configuration
    config = TOOL_CONFIG[tool_type]
    api_base_url = api_base_url or DEFAULT_API_BASE_URL
    api_key = api_key or DEFAULT_API_KEY

    logger.info(f"Creating MCP server for tool: {tool_type} ({config['description']})")

    # Dynamic import and server creation
    try:
        # Import the factory function from the tool module
        if tool_type == "DESMOS":
            from .desmos_tool import create_desmos_server
            server = create_desmos_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )

        elif tool_type == "MATPLOTLIB":
            from .matplotlib_tool import create_matplotlib_server
            server = create_matplotlib_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,  # Not used but kept for interface consistency
                api_key=api_key
            )

        elif tool_type == "JSXGRAPH":
            from .diagram_screenshot_tool import create_diagram_screenshot_server_with_workspace
            server = create_diagram_screenshot_server_with_workspace(
                workspace_path=workspace_path
            )

        elif tool_type == "PLOTLY":
            from .plotly_tool import create_plotly_server
            server = create_plotly_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )

        elif tool_type == "IMAGE_GENERATION":
            from .imagen_tool import create_imagen_server
            server = create_imagen_server(
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )

        logger.info(f"✅ Created MCP server: {config['server_name']}")
        return server

    except ImportError as e:
        logger.error(f"Failed to import tool module for {tool_type}: {e}")
        raise ImportError(
            f"Could not import tool module for {tool_type}. "
            f"Ensure {config['factory_module']} exists and has {config['factory_function']}"
        ) from e


def get_all_diagram_tools(
    workspace_path: str,
    api_base_url: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Create all diagram MCP servers for multi-tool support.

    Returns a dictionary of all MCP server configurations, keyed by
    server name. This enables the agent to use any tool based on
    the tool_type classification from eligibility analysis.

    Args:
        workspace_path: Absolute path to workspace directory
        api_base_url: Base URL for DiagramScreenshot service
        api_key: API key for DiagramScreenshot service

    Returns:
        Dictionary mapping server names to MCP server configurations:
        {
            "desmos": <server>,
            "matplotlib": <server>,
            "diagram-screenshot": <server>,  # JSXGraph
            "plotly": <server>,
            "imagen": <server>
        }

    Example:
        servers = get_all_diagram_tools("/workspace")
        options = ClaudeAgentOptions(mcp_servers=servers, ...)
    """
    api_base_url = api_base_url or DEFAULT_API_BASE_URL
    api_key = api_key or DEFAULT_API_KEY

    logger.info(f"Creating all diagram MCP servers for workspace: {workspace_path}")

    servers = {}

    for tool_type, config in TOOL_CONFIG.items():
        try:
            server = get_mcp_server_for_tool(
                tool_type=tool_type,
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
            servers[config["server_name"]] = server
            logger.info(f"  ✅ {config['server_name']}: {config['description']}")

        except Exception as e:
            logger.error(f"  ❌ Failed to create {tool_type} server: {e}")
            # Continue with other tools - don't fail completely

    logger.info(f"Created {len(servers)}/{len(TOOL_CONFIG)} diagram MCP servers")
    return servers


def get_tool_names_for_types(tool_types: List[str]) -> List[str]:
    """Get MCP tool names for a list of tool types.

    Used to build the allowed_tools list for ClaudeAgentOptions
    when only specific tools are needed.

    Args:
        tool_types: List of tool types (e.g., ["MATPLOTLIB", "PLOTLY"])

    Returns:
        List of MCP tool names (e.g., ["mcp__matplotlib__render_matplotlib", ...])

    Example:
        tool_names = get_tool_names_for_types(["MATPLOTLIB", "DESMOS"])
        # Returns: ["mcp__matplotlib__render_matplotlib", "mcp__desmos__render_desmos"]
    """
    tool_names = []

    for tool_type in tool_types:
        if tool_type in TOOL_CONFIG:
            tool_names.append(TOOL_CONFIG[tool_type]["tool_name"])
        elif tool_type != "NONE":
            logger.warning(f"Unknown tool type: {tool_type}")

    return tool_names


def get_servers_for_types(
    tool_types: List[str],
    workspace_path: str,
    api_base_url: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Create MCP servers for only the specified tool types.

    Optimization: Only create servers that are actually needed
    based on the tool_type values from eligibility analysis.

    Args:
        tool_types: List of tool types needed (e.g., ["MATPLOTLIB", "PLOTLY"])
        workspace_path: Absolute path to workspace directory
        api_base_url: Base URL for DiagramScreenshot service
        api_key: API key for DiagramScreenshot service

    Returns:
        Dictionary mapping server names to MCP server configurations

    Example:
        # From eligibility analysis, we know we need MATPLOTLIB and PLOTLY
        servers = get_servers_for_types(
            tool_types=["MATPLOTLIB", "PLOTLY"],
            workspace_path="/workspace"
        )
    """
    api_base_url = api_base_url or DEFAULT_API_BASE_URL
    api_key = api_key or DEFAULT_API_KEY

    # Deduplicate and filter out NONE
    unique_types = set(t for t in tool_types if t != "NONE" and t in TOOL_CONFIG)

    logger.info(f"Creating MCP servers for {len(unique_types)} tool types: {unique_types}")

    servers = {}

    for tool_type in unique_types:
        try:
            config = TOOL_CONFIG[tool_type]
            server = get_mcp_server_for_tool(
                tool_type=tool_type,
                workspace_path=workspace_path,
                api_base_url=api_base_url,
                api_key=api_key
            )
            servers[config["server_name"]] = server

        except Exception as e:
            logger.error(f"Failed to create {tool_type} server: {e}")
            raise  # Fast-fail on server creation failure

    return servers


# ═══════════════════════════════════════════════════════════════
# Tool Configuration Accessors
# ═══════════════════════════════════════════════════════════════

def get_tool_config(tool_type: str) -> Dict[str, Any]:
    """Get configuration for a specific tool type.

    Args:
        tool_type: Tool type (DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION)

    Returns:
        Configuration dictionary with server_name, tool_name, description, etc.

    Raises:
        ValueError: If tool_type is invalid
    """
    if tool_type not in TOOL_CONFIG:
        raise ValueError(f"Invalid tool_type: {tool_type}")
    return TOOL_CONFIG[tool_type].copy()


def get_available_tools() -> Dict[str, Dict[str, Any]]:
    """Get all available tool configurations.

    Returns:
        Dictionary of all tool configurations
    """
    return {k: v.copy() for k, v in TOOL_CONFIG.items()}


def get_tool_name(tool_type: str) -> str:
    """Get MCP tool name for a tool type.

    Args:
        tool_type: Tool type (e.g., "MATPLOTLIB")

    Returns:
        Full MCP tool name (e.g., "mcp__matplotlib__render_matplotlib")

    Raises:
        ValueError: If tool_type is invalid
    """
    if tool_type not in TOOL_CONFIG:
        raise ValueError(f"Invalid tool_type: {tool_type}")
    return TOOL_CONFIG[tool_type]["tool_name"]


def get_server_name(tool_type: str) -> str:
    """Get MCP server name for a tool type.

    Args:
        tool_type: Tool type (e.g., "MATPLOTLIB")

    Returns:
        MCP server name (e.g., "matplotlib")

    Raises:
        ValueError: If tool_type is invalid
    """
    if tool_type not in TOOL_CONFIG:
        raise ValueError(f"Invalid tool_type: {tool_type}")
    return TOOL_CONFIG[tool_type]["server_name"]
