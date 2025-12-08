"""Diagram Classifier Agent - Uses Write tool for JSON output.

Analyzes each mock exam question and determines the optimal diagram rendering tool
(DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, or NONE).

Uses Write tool pattern (like mock_exam_critic) for reliable JSON output.
This avoids structured output complexity issues with large question sets.

Input: Workspace with mock_exam.json, sow_context.json
Output: classification_output.json (validated with Pydantic)
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, List

# Disable SDK initialize timeout - we want to assess correctness, not speed
# SDK default is 60s which can cause transient failures
# Set to 10 minutes (600000ms) to effectively remove the timeout
os.environ.setdefault("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "600000")

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..tools.diagram_classifier_schema_models import (
    DiagramClassificationResult,
    DIAGRAM_CLASSIFICATION_INPUT_FILE,
    DIAGRAM_CLASSIFICATION_OUTPUT_FILE
)

logger = logging.getLogger(__name__)


class DiagramClassifierAgent:
    """Agent for classifying diagram requirements using Write tool pattern.

    Instructs the agent to write classification JSON directly to file,
    then validates with Pydantic after completion.
    """

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 20
    ):
        """Initialize Diagram Classifier Agent.

        Args:
            workspace_path: Path to workspace with mock_exam.json
            model: Claude model to use
            max_turns: Maximum conversation turns
        """
        self.workspace_path = workspace_path
        self.model = model
        self.max_turns = max_turns

        # Load prompt from file
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.prompt_template = (prompts_dir / "diagram_classifier_prompt.md").read_text()

    async def execute(self) -> Dict[str, Any]:
        """Execute diagram classification using Write tool pattern.

        Agent writes classification JSON to file, Python validates afterward.

        Returns:
            Dict with:
                - success: bool
                - classification_result: DiagramClassificationResult (Pydantic model)
                - message_count: int
                - questions_needing_diagrams: int

        Raises:
            RuntimeError: If agent fails to produce valid output (fail-fast)
        """
        logger.info("=" * 60)
        logger.info("DIAGRAM CLASSIFIER AGENT - Starting execution")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Pattern: Write tool (file-based output)")
        logger.info("=" * 60)

        # Validate required input files exist
        mock_exam_file = self.workspace_path / "mock_exam.json"
        context_file = self.workspace_path / "sow_context.json"
        input_file = self.workspace_path / DIAGRAM_CLASSIFICATION_INPUT_FILE
        output_file = self.workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE

        if not mock_exam_file.exists():
            raise RuntimeError(f"Missing input file: {mock_exam_file}")
        if not context_file.exists():
            raise RuntimeError(f"Missing input file: {context_file}")

        # Load mock exam and context
        with open(mock_exam_file) as f:
            mock_exam_data = json.load(f)
        with open(context_file) as f:
            context_data = json.load(f)

        # Create classification input from mock exam questions
        classification_input = self._create_classification_input(mock_exam_data, context_data)
        total_questions = len(classification_input["questions"])

        # Write classification input to workspace
        with open(input_file, 'w') as f:
            json.dump(classification_input, f, indent=2)
        logger.info(f"✅ Created {DIAGRAM_CLASSIFICATION_INPUT_FILE} with {total_questions} questions")

        # Build prompt
        prompt = self._build_prompt(classification_input)

        # Configure agent with Write tool (no structured output)
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            allowed_tools=['Read', 'Write'],
            max_turns=self.max_turns,
            cwd=str(self.workspace_path)
        )

        logger.info(f"Agent configured: model={self.model}, max_turns={self.max_turns}")

        # Execute agent
        message_count = 0

        async with ClaudeSDKClient(options) as client:
            logger.info("Sending classification prompt to agent...")
            await client.query(prompt)

            logger.info("Receiving messages (agent will write JSON to file)...")

            async for message in client.receive_messages():
                message_count += 1
                msg_type = type(message).__name__
                logger.info(f"📨 Message #{message_count}: {msg_type}")

                # Log tool usage for debugging
                if hasattr(message, 'content'):
                    content = message.content
                    if isinstance(content, list):
                        for idx, block in enumerate(content):
                            block_type = type(block).__name__
                            if hasattr(block, 'name'):
                                logger.info(f"   Block {idx}: {block_type} - Tool: {block.name}")

                if isinstance(message, ResultMessage):
                    logger.info(f"✅ Agent completed after {message_count} messages")
                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(
                            f"Agent exceeded max turns ({self.max_turns}) without completing"
                        )
                    break

        # Validate output file exists
        if not output_file.exists():
            raise RuntimeError(
                f"Agent did not write {DIAGRAM_CLASSIFICATION_OUTPUT_FILE} to workspace. "
                f"Check prompt or increase max_turns."
            )

        # Load and validate with Pydantic
        logger.info(f"Loading {DIAGRAM_CLASSIFICATION_OUTPUT_FILE} for validation...")
        try:
            with open(output_file) as f:
                raw_json = json.load(f)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Agent wrote invalid JSON: {e}")

        # Auto-correct classification counts (LLMs are bad at counting)
        raw_json = self._fix_classification_counts(raw_json)

        logger.info("Validating with Pydantic schema...")
        try:
            classification_result = DiagramClassificationResult.model_validate(raw_json)
        except Exception as e:
            logger.error(f"Pydantic validation failed: {e}")
            raise RuntimeError(f"Classification JSON failed schema validation: {e}")

        # Write corrected JSON back to file
        with open(output_file, 'w') as f:
            json.dump(raw_json, f, indent=2)

        logger.info("=" * 60)
        logger.info("DIAGRAM CLASSIFIER - Classification complete")
        logger.info(f"   Total Questions: {classification_result.total_questions}")
        logger.info(f"   Need Diagrams: {classification_result.questions_needing_diagrams}")
        logger.info(f"   No Diagram: {classification_result.questions_no_diagram}")
        logger.info(f"   Messages: {message_count}")
        logger.info("=" * 60)

        # Log tool distribution
        tool_counts: Dict[str, int] = {}
        for c in classification_result.classifications:
            tool_counts[c.tool] = tool_counts.get(c.tool, 0) + 1
        logger.info("Tool distribution:")
        for tool, count in sorted(tool_counts.items()):
            logger.info(f"   {tool}: {count}")

        return {
            "success": True,
            "classification_result": classification_result,
            "message_count": message_count,
            "questions_needing_diagrams": classification_result.questions_needing_diagrams
        }

    def _create_classification_input(
        self,
        mock_exam_data: Dict[str, Any],
        context_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create classification input JSON from mock exam questions."""
        questions = []

        # Extract questions from all sections
        for section in mock_exam_data.get("sections", []):
            for question in section.get("questions", []):
                questions.append({
                    "question_id": question.get("question_id"),
                    "question_number": question.get("question_number"),
                    "question_stem": question.get("question_stem", ""),
                    "question_stem_plain": question.get("question_stem_plain", ""),
                    "topic": question.get("standards_addressed", [{}])[0].get("description", "")
                        if question.get("standards_addressed") else "",
                    "question_type": question.get("question_type", ""),
                    "difficulty": question.get("difficulty", "")
                })

        return {
            "batch_mode": True,
            "exam_metadata": {
                "subject": context_data.get("subject", "mathematics"),
                "level": context_data.get("level", "national-3"),
                "exam_id": mock_exam_data.get("examId", "")
            },
            "questions": questions
        }

    def _build_prompt(self, classification_input: Dict[str, Any]) -> str:
        """Build the prompt for diagram classification."""
        total_questions = len(classification_input["questions"])
        subject = classification_input["exam_metadata"]["subject"]
        level = classification_input["exam_metadata"]["level"]

        # Use TRUE absolute path for output file (resolve() converts relative to absolute)
        output_path = str((self.workspace_path / DIAGRAM_CLASSIFICATION_OUTPUT_FILE).resolve())

        # Format questions for prompt
        questions_text = json.dumps(classification_input["questions"], indent=2)

        # Generate example JSON structure
        example_classification = '''{
  "batch_mode": true,
  "total_questions": 25,
  "questions_needing_diagrams": 15,
  "questions_no_diagram": 10,
  "classifications": [
    {
      "question_id": "q1",
      "question_number": 1,
      "tool": "NONE",
      "confidence": "HIGH",
      "reasoning": {
        "selected_because": "Pure arithmetic calculation",
        "content_analysis": "Percentage and money calculation",
        "decision_rule_applied": "Purely algebraic → NONE",
        "alternatives_rejected": "No visual element needed",
        "summary": "Basic percentage problem"
      },
      "visualization_focus": null,
      "alternative_tool": null,
      "curriculum_topic": "Percentages",
      "diagram_specs": null
    },
    {
      "question_id": "q5",
      "question_number": 5,
      "tool": "MATPLOTLIB",
      "confidence": "HIGH",
      "reasoning": {
        "selected_because": "Angle measurement in geometry",
        "content_analysis": "Triangle with angle calculation",
        "decision_rule_applied": "Geometry with angles → MATPLOTLIB",
        "alternatives_rejected": "Not coordinate-based (no JSXGRAPH)",
        "summary": "Geometry angle problem"
      },
      "visualization_focus": "Triangle with labeled angles",
      "alternative_tool": null,
      "curriculum_topic": "Angles",
      "diagram_specs": {
        "key_elements": ["Triangle ABC", "Angle markers", "Degree labels"],
        "educational_purpose": "Visualize angle relationships"
      }
    }
  ]
}'''

        context_info = f"""## Questions to Classify

**Exam Details:**
- Subject: {subject}
- Level: {level}
- Total Questions: {total_questions}

**Questions:**
```json
{questions_text}
```

## Output Instructions

1. Classify ALL {total_questions} questions
2. Use the Write tool to write your classification to: `{output_path}`
3. Include a classification for every question, even those that need no diagram (tool=NONE)

## Required JSON Structure

Write a JSON file with this structure:

```json
{example_classification}
```

## Important

- `reasoning` is an OBJECT with fields: selected_because, content_analysis, decision_rule_applied, alternatives_rejected, summary
- `diagram_specs` should be null if tool=NONE, otherwise include key_elements (array) and educational_purpose (string)
- `tool` must be one of: DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, NONE
- `confidence` must be one of: HIGH, MEDIUM, LOW

Write the complete classification JSON to `{output_path}` now using the Write tool.
"""

        return f"{self.prompt_template}\n\n{context_info}"

    def _fix_classification_counts(self, raw_json: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-correct classification counts from actual data.

        LLMs are notoriously bad at counting.
        """
        classifications = raw_json.get("classifications", [])

        total_questions = len(classifications)
        questions_needing_diagrams = sum(
            1 for c in classifications if c.get("tool") != "NONE"
        )
        questions_no_diagram = total_questions - questions_needing_diagrams

        # Check if corrections were needed
        original_total = raw_json.get("total_questions", 0)
        original_needs = raw_json.get("questions_needing_diagrams", 0)
        original_none = raw_json.get("questions_no_diagram", 0)

        if (original_total != total_questions or
            original_needs != questions_needing_diagrams or
            original_none != questions_no_diagram):
            logger.info("  Classification count corrections applied:")
            if original_total != total_questions:
                logger.info(f"    total_questions: {original_total} -> {total_questions}")
            if original_needs != questions_needing_diagrams:
                logger.info(f"    questions_needing_diagrams: {original_needs} -> {questions_needing_diagrams}")
            if original_none != questions_no_diagram:
                logger.info(f"    questions_no_diagram: {original_none} -> {questions_no_diagram}")

        raw_json["total_questions"] = total_questions
        raw_json["questions_needing_diagrams"] = questions_needing_diagrams
        raw_json["questions_no_diagram"] = questions_no_diagram

        return raw_json


async def run_diagram_classifier(workspace_path: Path) -> DiagramClassificationResult:
    """Run diagram classifier agent and return result.

    Args:
        workspace_path: Path to workspace with mock_exam.json

    Returns:
        Validated DiagramClassificationResult Pydantic model

    Raises:
        RuntimeError: If agent fails
    """
    agent = DiagramClassifierAgent(workspace_path=workspace_path)
    result = await agent.execute()

    if not result["success"]:
        raise RuntimeError(f"Diagram classifier failed: {result.get('error')}")

    return result["classification_result"]
