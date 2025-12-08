"""Diagram Author Subagent.

This subagent generates diagrams using specialized MCP tools based on
classification results from the DiagramClassificationSubagent.

Can be invoked by any orchestrator via the Task tool, enabling reuse across:
- mock_exam_author
- lesson_author
- diagram_author_nano

File-based communication pattern:
- Input: /workspace/diagram_request.json
- Output: /workspace/diagram_metadata.json
- PNG files: /workspace/diagrams/{card_id}_{context}.png
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class DiagramAuthorSubagent:
    """Subagent wrapper for diagram generation.

    This class provides a Python interface to invoke the diagram author subagent
    within an orchestrator context. The actual diagram generation is performed by
    Claude using MCP tools based on the subagent prompt.

    Usage:
        author = DiagramAuthorSubagent()
        request = author.create_request(classification, content, output_config)
        author.prepare_input(request, workspace_path)
        # Invoke via Task tool with author.get_task_prompt()
        metadata = author.read_output(workspace_path)
    """

    # Tool type to MCP server name mapping
    TOOL_TO_SERVER = {
        "DESMOS": "desmos",
        "MATPLOTLIB": "matplotlib",
        "JSXGRAPH": "jsxgraph",
        "PLOTLY": "plotly",
        "IMAGE_GENERATION": "imagen"
    }

    def __init__(self, prompt_path: Optional[Path] = None):
        """Initialize the diagram author subagent.

        Args:
            prompt_path: Optional custom path to the subagent prompt.
                         Defaults to src/prompts/diagram_author_subagent.md
        """
        if prompt_path is None:
            prompt_path = Path(__file__).parent.parent / "prompts" / "diagram_author_subagent.md"

        self.prompt_path = prompt_path
        self._prompt: Optional[str] = None

    @property
    def prompt(self) -> str:
        """Load and cache the subagent prompt."""
        if self._prompt is None:
            if not self.prompt_path.exists():
                raise FileNotFoundError(f"Prompt file not found: {self.prompt_path}")
            self._prompt = self.prompt_path.read_text()
        return self._prompt

    def prepare_input(self, request: Dict[str, Any], workspace_path: Path) -> Path:
        """Write diagram request to workspace.

        Args:
            request: Diagram request containing:
                - classification: Dict with tool, confidence, reasoning, etc.
                - content: Dict with question_stem, topic, etc.
                - output_config: Dict with card_id, context, diagram_index
                - correction_prompt: Optional str from critic
            workspace_path: Path to workspace directory

        Returns:
            Path to the written input file

        Raises:
            ValueError: If request is missing required fields
        """
        # Validate required fields
        if "classification" not in request:
            raise ValueError("Missing required field: classification")
        if "content" not in request:
            raise ValueError("Missing required field: content")
        if "output_config" not in request:
            raise ValueError("Missing required field: output_config")

        # Validate classification
        classification = request["classification"]
        if "tool" not in classification:
            raise ValueError("classification missing required field: tool")

        valid_tools = ["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION"]
        if classification["tool"] not in valid_tools:
            raise ValueError(f"Invalid tool: {classification['tool']}. Must be one of: {valid_tools}")

        # Validate output_config
        output_config = request["output_config"]
        if "card_id" not in output_config:
            raise ValueError("output_config missing required field: card_id")
        if "context" not in output_config:
            raise ValueError("output_config missing required field: context")

        # Write input file
        input_path = workspace_path / "diagram_request.json"
        input_path.write_text(json.dumps(request, indent=2))

        logger.info(f"📝 Diagram request written to: {input_path}")
        logger.info(f"📝 Tool: {classification['tool']}, Card: {output_config['card_id']}")

        return input_path

    def read_output(self, workspace_path: Path) -> Dict[str, Any]:
        """Read diagram metadata from workspace.

        Args:
            workspace_path: Path to workspace directory

        Returns:
            Diagram metadata dict containing:
                - success: bool
                - card_id: str
                - context: str
                - diagram_index: int
                - tool_used: str
                - image_path: str (if success)
                - render_details: Dict (if success)
                - error: Dict (if not success)

        Raises:
            FileNotFoundError: If output file doesn't exist
            ValueError: If output is invalid JSON or missing required fields
        """
        output_path = workspace_path / "diagram_metadata.json"

        if not output_path.exists():
            raise FileNotFoundError(f"Diagram metadata not found: {output_path}")

        try:
            output = json.loads(output_path.read_text())
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in diagram metadata: {e}")

        # Validate required fields
        required_fields = ["success", "card_id", "context", "tool_used"]
        for field in required_fields:
            if field not in output:
                raise ValueError(f"Diagram metadata missing required field: {field}")

        # Validate conditional fields
        if output["success"]:
            if "image_path" not in output:
                raise ValueError("Successful response missing 'image_path' field")
            # Verify the image file exists
            image_path = Path(output["image_path"])
            if not image_path.exists():
                raise ValueError(f"Image file does not exist: {output['image_path']}")
        else:
            if "error" not in output:
                raise ValueError("Failed response missing 'error' field")

        logger.info(f"📖 Diagram metadata read: success={output['success']}, tool={output['tool_used']}")

        return output

    def get_task_prompt(self, workspace_path: Path, tool_type: str) -> str:
        """Generate the Task tool prompt for invoking this subagent.

        This method generates the prompt string that should be passed to the
        Task tool when invoking this subagent from an orchestrator.

        Args:
            workspace_path: Path to workspace directory
            tool_type: The classified tool type (DESMOS, MATPLOTLIB, etc.)

        Returns:
            Formatted prompt string for Task tool
        """
        server_name = self.TOOL_TO_SERVER.get(tool_type, "unknown")

        return f"""You are the Diagram Author Subagent.

Your task is to generate a diagram using the {tool_type} rendering tool.

{self.prompt}

IMPORTANT:
1. Read `/workspace/diagram_request.json` first
2. The classification specifies tool={tool_type}
3. Use the mcp__{server_name}__render_* tool to generate the diagram
4. Write your metadata to `/workspace/diagram_metadata.json`
5. The diagram PNG will be saved to `/workspace/diagrams/`

Workspace path: {workspace_path}
"""

    def get_required_mcp_server(self, tool_type: str) -> str:
        """Get the MCP server name required for a tool type.

        Args:
            tool_type: The classified tool type (DESMOS, MATPLOTLIB, etc.)

        Returns:
            MCP server name (desmos, matplotlib, jsxgraph, plotly, imagen)

        Raises:
            ValueError: If tool_type is not recognized
        """
        if tool_type not in self.TOOL_TO_SERVER:
            raise ValueError(f"Unknown tool type: {tool_type}")
        return self.TOOL_TO_SERVER[tool_type]

    @staticmethod
    def create_request(
        classification: Dict[str, Any],
        content: Dict[str, Any],
        card_id: str,
        context: str,
        diagram_index: int = 0,
        correction_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a diagram request from components.

        Convenience method for creating properly formatted request from
        classification results and content.

        Args:
            classification: Classification result from DiagramClassificationSubagent
            content: Content dict with question_stem, topic, etc.
            card_id: Card/question identifier (e.g., "q3")
            context: Diagram context ("question", "worked_solution", "hint", etc.)
            diagram_index: Index for multiple diagrams (default 0)
            correction_prompt: Optional feedback from critic for refinement

        Returns:
            Properly formatted request dict for prepare_input()
        """
        request = {
            "classification": classification,
            "content": content,
            "output_config": {
                "card_id": card_id,
                "context": context,
                "diagram_index": diagram_index
            }
        }

        if correction_prompt:
            request["correction_prompt"] = correction_prompt

        return request

    @staticmethod
    def create_request_from_classification_output(
        classification_output: Dict[str, Any],
        content: Dict[str, Any],
        card_id: str,
        context: str,
        diagram_index: int = 0
    ) -> Dict[str, Any]:
        """Create diagram request from classification subagent output.

        This is a convenience method that takes the full classification output
        (as read from classification_output.json) and creates a diagram request.

        Args:
            classification_output: Full output from classification subagent
            content: Original content that was classified
            card_id: Card/question identifier
            context: Diagram context
            diagram_index: Index for multiple diagrams

        Returns:
            Properly formatted request dict
        """
        return DiagramAuthorSubagent.create_request(
            classification=classification_output,
            content=content,
            card_id=card_id,
            context=context,
            diagram_index=diagram_index
        )

    def validate_image_exists(self, workspace_path: Path, card_id: str, context: str, diagram_index: int = 0) -> Optional[str]:
        """Check if the expected diagram image exists.

        Args:
            workspace_path: Path to workspace directory
            card_id: Card identifier
            context: Diagram context
            diagram_index: Diagram index

        Returns:
            Absolute path to image if exists, None otherwise
        """
        diagrams_dir = workspace_path / "diagrams"

        if diagram_index > 0:
            filename = f"{card_id}_{context}_{diagram_index}.png"
        else:
            filename = f"{card_id}_{context}.png"

        image_path = diagrams_dir / filename

        if image_path.exists():
            return str(image_path.absolute())
        return None

    def list_generated_diagrams(self, workspace_path: Path) -> List[Dict[str, Any]]:
        """List all diagrams generated in the workspace.

        Args:
            workspace_path: Path to workspace directory

        Returns:
            List of dicts with diagram info (path, card_id, context, size_bytes)
        """
        diagrams_dir = workspace_path / "diagrams"

        if not diagrams_dir.exists():
            return []

        diagrams = []
        for png_file in diagrams_dir.glob("*.png"):
            # Parse filename: {card_id}_{context}[_{index}].png
            name_parts = png_file.stem.split("_")
            if len(name_parts) >= 2:
                card_id = name_parts[0]
                context = name_parts[1] if len(name_parts) == 2 else "_".join(name_parts[1:-1])
                diagram_index = int(name_parts[-1]) if len(name_parts) > 2 and name_parts[-1].isdigit() else 0
            else:
                card_id = png_file.stem
                context = "unknown"
                diagram_index = 0

            diagrams.append({
                "path": str(png_file.absolute()),
                "filename": png_file.name,
                "card_id": card_id,
                "context": context,
                "diagram_index": diagram_index,
                "size_bytes": png_file.stat().st_size
            })

        return diagrams
