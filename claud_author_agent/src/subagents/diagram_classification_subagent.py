"""Diagram Classification Subagent.

This subagent analyzes mathematical/educational content and determines the optimal
rendering tool (DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, or NONE).

Can be invoked by any orchestrator via the Task tool, enabling reuse across:
- mock_exam_author
- lesson_author
- diagram_author_nano

File-based communication pattern:
- Input: /workspace/classification_input.json
- Output: /workspace/classification_output.json
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class DiagramClassificationSubagent:
    """Subagent wrapper for diagram classification.

    This class provides a Python interface to invoke the classification subagent
    within an orchestrator context. The actual classification is performed by
    Claude using the subagent prompt.

    Usage:
        classifier = DiagramClassificationSubagent()
        classification = await classifier.classify(content, workspace_path)
    """

    def __init__(self, prompt_path: Optional[Path] = None):
        """Initialize the classification subagent.

        Args:
            prompt_path: Optional custom path to the subagent prompt.
                         Defaults to src/prompts/diagram_classification_subagent.md
        """
        if prompt_path is None:
            prompt_path = Path(__file__).parent.parent / "prompts" / "diagram_classification_subagent.md"

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

    def prepare_input(self, content: Dict[str, Any], workspace_path: Path) -> Path:
        """Write classification input to workspace.

        Args:
            content: Content to classify, containing:
                - content_type: "question" | "lesson_card" | "cfu"
                - content: Dict with question_stem, topic, etc.
            workspace_path: Path to workspace directory

        Returns:
            Path to the written input file

        Raises:
            ValueError: If content is missing required fields
        """
        # Validate required fields
        if "content_type" not in content:
            raise ValueError("Missing required field: content_type")
        if "content" not in content:
            raise ValueError("Missing required field: content")

        # Ensure content has at least question_stem
        inner_content = content["content"]
        if not isinstance(inner_content, dict):
            raise ValueError("content.content must be a dictionary")
        if "question_stem" not in inner_content and "text" not in inner_content:
            raise ValueError("content.content must have 'question_stem' or 'text'")

        # Write input file
        input_path = workspace_path / "classification_input.json"
        input_path.write_text(json.dumps(content, indent=2))

        logger.info(f"📝 Classification input written to: {input_path}")

        return input_path

    def read_output(self, workspace_path: Path) -> Dict[str, Any]:
        """Read classification output from workspace.

        Args:
            workspace_path: Path to workspace directory

        Returns:
            Classification result dict containing:
                - tool: str (DESMOS, MATPLOTLIB, etc.)
                - confidence: str (HIGH, MEDIUM, LOW)
                - reasoning: str
                - visualization_focus: str
                - alternative_tool: str or None
                - curriculum_topic: str
                - diagram_specs: Dict or None

        Raises:
            FileNotFoundError: If output file doesn't exist
            ValueError: If output is invalid JSON or missing required fields
        """
        output_path = workspace_path / "classification_output.json"

        if not output_path.exists():
            raise FileNotFoundError(f"Classification output not found: {output_path}")

        try:
            output = json.loads(output_path.read_text())
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in classification output: {e}")

        # Validate required fields
        required_fields = ["tool", "confidence", "reasoning"]
        for field in required_fields:
            if field not in output:
                raise ValueError(f"Classification output missing required field: {field}")

        # Validate tool value
        valid_tools = ["DESMOS", "MATPLOTLIB", "JSXGRAPH", "PLOTLY", "IMAGE_GENERATION", "NONE"]
        if output["tool"] not in valid_tools:
            raise ValueError(f"Invalid tool value: {output['tool']}. Must be one of: {valid_tools}")

        # Validate confidence value
        valid_confidence = ["HIGH", "MEDIUM", "LOW"]
        if output["confidence"] not in valid_confidence:
            raise ValueError(f"Invalid confidence value: {output['confidence']}. Must be one of: {valid_confidence}")

        logger.info(f"📖 Classification output read: tool={output['tool']}, confidence={output['confidence']}")

        return output

    def get_task_prompt(self, workspace_path: Path) -> str:
        """Generate the Task tool prompt for invoking this subagent.

        This method generates the prompt string that should be passed to the
        Task tool when invoking this subagent from an orchestrator.

        Args:
            workspace_path: Path to workspace directory

        Returns:
            Formatted prompt string for Task tool
        """
        return f"""You are the Diagram Classification Subagent.

Your task is to classify the content in `/workspace/classification_input.json` and determine
the optimal visualization tool.

{self.prompt}

IMPORTANT:
1. Read `/workspace/classification_input.json` first
2. Analyze the content using the decision rules in your prompt
3. Write your classification to `/workspace/classification_output.json`
4. The output MUST be valid JSON matching the schema

Workspace path: {workspace_path}
"""

    @staticmethod
    def create_input_for_question(
        question_stem: str,
        question_stem_plain: Optional[str] = None,
        subject: str = "mathematics",
        level: str = "national-5",
        topic: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create classification input from question fields.

        Convenience method for creating properly formatted input from individual fields.

        Args:
            question_stem: The question text (may contain LaTeX)
            question_stem_plain: Plain language version (optional)
            subject: Subject area (default: "mathematics")
            level: Curriculum level (default: "national-5")
            topic: Topic area (optional)

        Returns:
            Properly formatted input dict for prepare_input()
        """
        content = {
            "question_stem": question_stem,
            "subject": subject,
            "level": level
        }

        if question_stem_plain:
            content["question_stem_plain"] = question_stem_plain

        if topic:
            content["topic"] = topic

        return {
            "content_type": "question",
            "content": content
        }

    @staticmethod
    def create_input_for_lesson_card(
        card_text: str,
        subject: str = "mathematics",
        level: str = "national-5",
        topic: Optional[str] = None,
        cfu_config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Create classification input from lesson card fields.

        Args:
            card_text: The card's main text content
            subject: Subject area (default: "mathematics")
            level: Curriculum level (default: "national-5")
            topic: Topic area (optional)
            cfu_config: CFU configuration if this is a CFU card (optional)

        Returns:
            Properly formatted input dict for prepare_input()
        """
        content = {
            "text": card_text,
            "subject": subject,
            "level": level
        }

        if topic:
            content["topic"] = topic

        if cfu_config:
            content["cfu_config"] = cfu_config

        content_type = "cfu" if cfu_config else "lesson_card"

        return {
            "content_type": content_type,
            "content": content
        }
