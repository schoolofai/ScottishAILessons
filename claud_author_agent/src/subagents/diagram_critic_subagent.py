"""Diagram Critic Subagent.

This subagent validates generated diagrams for educational quality using
Claude's native multimodal vision via the Read tool.

Can be invoked by any orchestrator via the Task tool, enabling reuse across:
- mock_exam_author
- lesson_author
- diagram_author_nano

File-based communication pattern:
- Input: /workspace/critique_request.json
- Output: /workspace/critique_result.json

NOTE: This subagent uses Claude's native Read tool for image viewing.
      NO separate MCP server is required.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Literal

logger = logging.getLogger(__name__)


# Type definitions
Decision = Literal["ACCEPT", "REFINE", "ACCEPT_WITH_NOTES", "REJECT"]
DiagramType = Literal[
    "function_graph",
    "geometric_construction",
    "coordinate_geometry",
    "statistical_chart",
    "contextual_image"
]
DiagramContext = Literal[
    "question",
    "worked_solution",
    "hint",
    "misconception",
    "lesson",
    "cfu"
]


class DiagramCriticSubagent:
    """Subagent wrapper for diagram critique and validation.

    This class provides a Python interface to invoke the diagram critic subagent
    within an orchestrator context. The actual critique is performed by Claude
    using its native multimodal Read tool based on the subagent prompt.

    Key Design: Uses Claude's Read tool (NOT external APIs like Gemini)
    - Claude can view PNG images natively via the Read tool
    - No additional MCP server required
    - Shares context with orchestrator

    Usage:
        critic = DiagramCriticSubagent()
        request = critic.create_request(image_path, diagram_type, ...)
        critic.prepare_input(request, workspace_path)
        # Invoke via Task tool with critic.get_task_prompt()
        result = critic.read_output(workspace_path)
    """

    # Tool type to diagram type mapping
    TOOL_TO_DIAGRAM_TYPE: Dict[str, DiagramType] = {
        "DESMOS": "function_graph",
        "MATPLOTLIB": "geometric_construction",
        "JSXGRAPH": "coordinate_geometry",
        "PLOTLY": "statistical_chart",
        "IMAGE_GENERATION": "contextual_image"
    }

    # Progressive threshold policy
    THRESHOLDS = {
        1: 0.85, 2: 0.85,  # Iterations 1-2: strict
        3: 0.82, 4: 0.82,  # Iterations 3-4: slightly relaxed
        5: 0.80, 6: 0.80,  # Iterations 5-6: more relaxed
    }
    DEFAULT_THRESHOLD = 0.78  # Iterations 7+

    def __init__(self, prompt_path: Optional[Path] = None):
        """Initialize the diagram critic subagent.

        Args:
            prompt_path: Optional custom path to the subagent prompt.
                         Defaults to src/prompts/diagram_critic_subagent.md
        """
        if prompt_path is None:
            prompt_path = Path(__file__).parent.parent / "prompts" / "diagram_critic_subagent.md"

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
        """Write critique request to workspace.

        Args:
            request: Critique request containing:
                - image_path: Absolute path to PNG image
                - diagram_type: Type of diagram
                - diagram_context: Context (question, cfu, etc.)
                - original_request: Classification/specs from author
                - content: Original content being diagrammed
                - iteration: Current iteration number
            workspace_path: Path to workspace directory

        Returns:
            Path to the written input file

        Raises:
            ValueError: If request is missing required fields
            FileNotFoundError: If image_path doesn't exist
        """
        # Validate required fields
        required_fields = [
            "image_path", "diagram_type", "diagram_context",
            "original_request", "content", "iteration"
        ]
        for field in required_fields:
            if field not in request:
                raise ValueError(f"Missing required field: {field}")

        # Validate image exists
        image_path = Path(request["image_path"])
        if not image_path.exists():
            raise FileNotFoundError(f"Image not found: {request['image_path']}")

        # Validate diagram_type
        valid_types = list(self.TOOL_TO_DIAGRAM_TYPE.values())
        if request["diagram_type"] not in valid_types:
            raise ValueError(
                f"Invalid diagram_type: {request['diagram_type']}. "
                f"Must be one of: {valid_types}"
            )

        # Validate diagram_context
        valid_contexts = ["question", "worked_solution", "hint", "misconception", "lesson", "cfu"]
        if request["diagram_context"] not in valid_contexts:
            raise ValueError(
                f"Invalid diagram_context: {request['diagram_context']}. "
                f"Must be one of: {valid_contexts}"
            )

        # Validate iteration
        if not isinstance(request["iteration"], int) or request["iteration"] < 1:
            raise ValueError("iteration must be a positive integer")

        # Write input file
        input_path = workspace_path / "critique_request.json"
        input_path.write_text(json.dumps(request, indent=2))

        logger.info(f"📝 Critique request written to: {input_path}")
        logger.info(f"📝 Image: {request['image_path']}, Iteration: {request['iteration']}")

        return input_path

    def read_output(self, workspace_path: Path) -> Dict[str, Any]:
        """Read critique result from workspace.

        Args:
            workspace_path: Path to workspace directory

        Returns:
            Critique result dict containing:
                - decision: ACCEPT | REFINE | ACCEPT_WITH_NOTES | REJECT
                - final_score: float (0.0-1.0)
                - dimension_scores: Dict with clarity, accuracy, pedagogy, aesthetics
                - strengths: List of positive aspects
                - improvements: List of areas for improvement
                - specific_changes: List of actionable changes (for REFINE)
                - critical_issues: List of blocking problems
                - iteration_notes: Context for this iteration

        Raises:
            FileNotFoundError: If output file doesn't exist
            ValueError: If output is invalid JSON or missing required fields
        """
        output_path = workspace_path / "critique_result.json"

        if not output_path.exists():
            raise FileNotFoundError(f"Critique result not found: {output_path}")

        try:
            output = json.loads(output_path.read_text())
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in critique result: {e}")

        # Validate required fields
        required_fields = ["decision", "final_score", "dimension_scores"]
        for field in required_fields:
            if field not in output:
                raise ValueError(f"Critique result missing required field: {field}")

        # Validate decision
        valid_decisions = ["ACCEPT", "REFINE", "ACCEPT_WITH_NOTES", "REJECT"]
        if output["decision"] not in valid_decisions:
            raise ValueError(
                f"Invalid decision: {output['decision']}. "
                f"Must be one of: {valid_decisions}"
            )

        # Validate final_score
        if not isinstance(output["final_score"], (int, float)):
            raise ValueError("final_score must be a number")
        if not 0.0 <= output["final_score"] <= 1.0:
            raise ValueError("final_score must be between 0.0 and 1.0")

        # Validate dimension_scores
        required_dimensions = ["clarity", "accuracy", "pedagogy", "aesthetics"]
        for dim in required_dimensions:
            if dim not in output["dimension_scores"]:
                raise ValueError(f"dimension_scores missing: {dim}")
            score = output["dimension_scores"][dim]
            if not isinstance(score, (int, float)) or not 0.0 <= score <= 1.0:
                raise ValueError(f"Invalid {dim} score: {score}")

        # Validate REFINE has specific_changes
        if output["decision"] == "REFINE":
            if "specific_changes" not in output or not output["specific_changes"]:
                logger.warning("REFINE decision without specific_changes - adding default")
                output["specific_changes"] = ["Review diagram and make improvements"]

        logger.info(
            f"📖 Critique result read: decision={output['decision']}, "
            f"score={output['final_score']:.2f}"
        )

        return output

    def get_task_prompt(self, workspace_path: Path) -> str:
        """Generate the Task tool prompt for invoking this subagent.

        This method generates the prompt string that should be passed to the
        Task tool when invoking this subagent from an orchestrator.

        Note: No MCP server is required - Claude uses its native Read tool.

        Args:
            workspace_path: Path to workspace directory

        Returns:
            Formatted prompt string for Task tool
        """
        return f"""You are the Diagram Critic Subagent.

Your task is to evaluate a generated diagram for educational quality.

{self.prompt}

IMPORTANT:
1. Read `/workspace/critique_request.json` first to get the image path
2. Use the Read tool to view the PNG image: Read({{file_path: "<image_path>"}})
3. Evaluate the diagram across all 4 dimensions
4. Write your critique to `/workspace/critique_result.json`

You are using Claude's native multimodal vision - NO external tools needed.

Workspace path: {workspace_path}
"""

    def get_threshold_for_iteration(self, iteration: int) -> float:
        """Get the acceptance threshold for a given iteration.

        Args:
            iteration: Current iteration number (1-based)

        Returns:
            Threshold score for acceptance
        """
        return self.THRESHOLDS.get(iteration, self.DEFAULT_THRESHOLD)

    def should_accept(self, result: Dict[str, Any], iteration: int) -> bool:
        """Determine if result should be accepted based on threshold policy.

        Args:
            result: Critique result from read_output()
            iteration: Current iteration number

        Returns:
            True if diagram should be accepted
        """
        decision = result["decision"]

        # Explicit acceptance
        if decision in ["ACCEPT", "ACCEPT_WITH_NOTES"]:
            return True

        # Explicit rejection
        if decision == "REJECT":
            return False

        # For REFINE, check against progressive threshold
        threshold = self.get_threshold_for_iteration(iteration)
        final_score = result["final_score"]

        # Check early accept conditions
        accuracy = result["dimension_scores"].get("accuracy", 0)
        pedagogy = result["dimension_scores"].get("pedagogy", 0)
        critical_issues = result.get("critical_issues", [])

        if iteration >= 3 and accuracy >= 0.90:
            if iteration >= 5 and not critical_issues:
                return True
            if iteration >= 7 and pedagogy >= 0.80:
                return True

        return final_score >= threshold

    def get_correction_prompt(self, result: Dict[str, Any]) -> str:
        """Generate correction prompt from critique result for next iteration.

        Args:
            result: Critique result from read_output()

        Returns:
            Formatted correction prompt for diagram author
        """
        changes = result.get("specific_changes", [])
        if not changes:
            return "Please review and improve the diagram based on the critique."

        correction_parts = ["Please make the following changes to the diagram:"]
        for i, change in enumerate(changes, 1):
            correction_parts.append(f"{i}. {change}")

        return "\n".join(correction_parts)

    @staticmethod
    def create_request(
        image_path: str,
        diagram_type: DiagramType,
        diagram_context: DiagramContext,
        original_request: Dict[str, Any],
        content: Dict[str, Any],
        iteration: int = 1
    ) -> Dict[str, Any]:
        """Create a critique request from components.

        Convenience method for creating properly formatted request.

        Args:
            image_path: Absolute path to the PNG image
            diagram_type: Type of diagram (function_graph, etc.)
            diagram_context: Context (question, cfu, etc.)
            original_request: Classification/specs used for generation
            content: Original content being diagrammed
            iteration: Current iteration number (default 1)

        Returns:
            Properly formatted request dict for prepare_input()
        """
        return {
            "image_path": image_path,
            "diagram_type": diagram_type,
            "diagram_context": diagram_context,
            "original_request": original_request,
            "content": content,
            "iteration": iteration
        }

    @staticmethod
    def create_request_from_metadata(
        metadata: Dict[str, Any],
        classification: Dict[str, Any],
        content: Dict[str, Any],
        context: DiagramContext,
        iteration: int = 1
    ) -> Dict[str, Any]:
        """Create critique request from diagram metadata.

        Convenience method that takes output from DiagramAuthorSubagent.

        Args:
            metadata: Diagram metadata from author subagent
            classification: Original classification result
            content: Original content being diagrammed
            context: Diagram context
            iteration: Current iteration number

        Returns:
            Properly formatted request dict
        """
        # Get diagram type from tool
        tool = classification.get("tool", metadata.get("tool_used", ""))
        diagram_type = DiagramCriticSubagent.TOOL_TO_DIAGRAM_TYPE.get(
            tool, "function_graph"
        )

        return DiagramCriticSubagent.create_request(
            image_path=metadata["image_path"],
            diagram_type=diagram_type,
            diagram_context=context,
            original_request=classification,
            content=content,
            iteration=iteration
        )

    def calculate_weighted_score(self, dimension_scores: Dict[str, float]) -> float:
        """Calculate weighted final score from dimension scores.

        Uses the standard weights:
        - Clarity: 0.35
        - Accuracy: 0.35
        - Pedagogy: 0.20
        - Aesthetics: 0.10

        Args:
            dimension_scores: Dict with clarity, accuracy, pedagogy, aesthetics

        Returns:
            Weighted final score
        """
        weights = {
            "clarity": 0.35,
            "accuracy": 0.35,
            "pedagogy": 0.20,
            "aesthetics": 0.10
        }

        total = 0.0
        for dim, weight in weights.items():
            score = dimension_scores.get(dim, 0.0)
            total += score * weight

        return round(total, 3)

    def summarize_critique(self, result: Dict[str, Any]) -> str:
        """Generate human-readable summary of critique result.

        Args:
            result: Critique result from read_output()

        Returns:
            Formatted summary string
        """
        decision = result["decision"]
        score = result["final_score"]
        dims = result["dimension_scores"]

        emoji = {
            "ACCEPT": "✅",
            "ACCEPT_WITH_NOTES": "✅",
            "REFINE": "🔄",
            "REJECT": "❌"
        }.get(decision, "❓")

        summary = [
            f"{emoji} Decision: {decision} (Score: {score:.2f})",
            f"   Clarity: {dims['clarity']:.2f} | Accuracy: {dims['accuracy']:.2f} | "
            f"Pedagogy: {dims['pedagogy']:.2f} | Aesthetics: {dims['aesthetics']:.2f}"
        ]

        if result.get("critical_issues"):
            summary.append(f"   ⚠️ Critical: {result['critical_issues'][0]}")

        if decision == "REFINE" and result.get("specific_changes"):
            summary.append(f"   📝 Changes needed: {len(result['specific_changes'])}")

        return "\n".join(summary)
