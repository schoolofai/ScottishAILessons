"""Practice Block Agent - Extracts concept blocks from lesson templates.

Uses Claude Agent SDK with Write tool pattern to extract blocks for
offline practice question generation.

Input: Workspace with lesson_template_input.json
Output: extracted_blocks.json (validated with Pydantic)
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, List

# Disable SDK initialize timeout - we want to assess correctness, not speed
os.environ.setdefault("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "600000")

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..models.practice_question_models import (
    BlockExtractionResult,
    ExtractedBlock,
    BLOCK_EXTRACTION_INPUT_FILE,
    BLOCK_EXTRACTION_OUTPUT_FILE
)

logger = logging.getLogger(__name__)


class PracticeBlockAgent:
    """Agent for extracting concept blocks using Write tool pattern.

    Follows the same pattern as DiagramClassifierAgent:
    - Agent writes JSON to file
    - Python validates with Pydantic afterward
    """

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 15
    ):
        """Initialize Practice Block Agent.

        Args:
            workspace_path: Path to workspace for input/output files
            model: Claude model to use
            max_turns: Maximum conversation turns
        """
        self.workspace_path = workspace_path
        self.model = model
        self.max_turns = max_turns

        # Load prompt from file
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.prompt_template = (prompts_dir / "block_extraction_prompt.md").read_text()

    async def execute(
        self,
        lesson_template_id: str,
        lesson_template: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute block extraction from lesson template.

        Args:
            lesson_template_id: Lesson template ID for tracking
            lesson_template: Full lesson template data (lesson_snapshot)

        Returns:
            Dict with:
                - success: bool
                - extraction_result: BlockExtractionResult (Pydantic model)
                - message_count: int
                - blocks_extracted: int

        Raises:
            RuntimeError: If agent fails to produce valid output (fail-fast)
            ValueError: If lesson template is invalid
        """
        logger.info("=" * 60)
        logger.info("PRACTICE BLOCK AGENT - Starting execution")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Lesson Template ID: {lesson_template_id}")
        logger.info(f"   Pattern: Write tool (file-based output)")
        logger.info("=" * 60)

        # Validate lesson template has required fields
        self._validate_lesson_template(lesson_template)

        # Write lesson template to workspace
        input_file = self.workspace_path / BLOCK_EXTRACTION_INPUT_FILE
        output_file = self.workspace_path / BLOCK_EXTRACTION_OUTPUT_FILE

        with open(input_file, 'w') as f:
            json.dump({
                "lesson_template_id": lesson_template_id,
                "lesson_template": lesson_template
            }, f, indent=2)
        logger.info(f"✅ Created {BLOCK_EXTRACTION_INPUT_FILE}")

        # Build prompt
        prompt = self._build_prompt(lesson_template_id, lesson_template)

        # Configure agent with Write tool
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
            logger.info("Sending block extraction prompt to agent...")
            await client.query(prompt)

            logger.info("Receiving messages (agent will write JSON to file)...")

            async for message in client.receive_messages():
                message_count += 1
                msg_type = type(message).__name__
                logger.info(f"📨 Message #{message_count}: {msg_type}")

                # Log tool calls for visibility
                if hasattr(message, 'content') and isinstance(message.content, list):
                    for block in message.content:
                        if hasattr(block, 'name'):
                            logger.info(f"   Tool: {block.name}")

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
                f"Agent did not write {BLOCK_EXTRACTION_OUTPUT_FILE} to workspace. "
                f"Check prompt or increase max_turns."
            )

        # Load and validate with Pydantic
        logger.info(f"Loading {BLOCK_EXTRACTION_OUTPUT_FILE} for validation...")
        try:
            with open(output_file) as f:
                raw_json = json.load(f)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Agent wrote invalid JSON: {e}")

        # Auto-correct block count (LLMs are bad at counting)
        raw_json = self._fix_block_counts(raw_json)

        logger.info("Validating with Pydantic schema...")
        try:
            extraction_result = BlockExtractionResult.model_validate(raw_json)
        except Exception as e:
            logger.error(f"Pydantic validation failed: {e}")
            raise RuntimeError(f"Block extraction JSON failed schema validation: {e}")

        # Compute content hashes for each block
        for block in extraction_result.blocks:
            block_dict = block.model_dump()
            logger.debug(f"Block '{block.title}' hash computed")

        # Write corrected JSON back to file
        with open(output_file, 'w') as f:
            json.dump(raw_json, f, indent=2)

        logger.info("=" * 60)
        logger.info("PRACTICE BLOCK AGENT - Extraction complete")
        logger.info(f"   Lesson: {extraction_result.lesson_title}")
        logger.info(f"   Blocks Extracted: {extraction_result.total_blocks}")
        logger.info(f"   Messages: {message_count}")
        logger.info("=" * 60)

        # Log block titles
        for idx, block in enumerate(extraction_result.blocks):
            logger.info(f"   Block {idx + 1}: {block.title}")

        return {
            "success": True,
            "extraction_result": extraction_result,
            "message_count": message_count,
            "blocks_extracted": extraction_result.total_blocks
        }

    def _validate_lesson_template(self, lesson_template: Dict[str, Any]) -> None:
        """Validate lesson template has required fields.

        Raises:
            ValueError: If validation fails (fail-fast)
        """
        errors = []

        if not lesson_template.get("title"):
            errors.append("Lesson template missing 'title'")

        cards = lesson_template.get("cards", [])
        if not cards:
            errors.append("Lesson template has no cards")

        # Check cards have content
        for i, card in enumerate(cards):
            if not card.get("explainer") and not card.get("explainer_plain"):
                errors.append(f"Card {i} missing explainer content")

        if errors:
            raise ValueError(
                f"Invalid lesson template: {'; '.join(errors)}"
            )

    def _build_prompt(
        self,
        lesson_template_id: str,
        lesson_template: Dict[str, Any]
    ) -> str:
        """Build the prompt for block extraction."""
        lesson_title = lesson_template.get("title", "Untitled Lesson")
        outcome_refs = lesson_template.get("outcomeRefs", [])
        cards = lesson_template.get("cards", [])

        # Prepare cards summary (truncate long content)
        cards_summary = self._prepare_cards_summary(cards)

        # Use absolute path for output file
        output_path = str((self.workspace_path / BLOCK_EXTRACTION_OUTPUT_FILE).resolve())

        lesson_context = f"""## Lesson Template to Analyze

**Lesson Template ID:** {lesson_template_id}
**Lesson Title:** {lesson_title}
**Learning Outcomes:** {json.dumps(outcome_refs)}
**Total Cards:** {len(cards)}

### Cards Summary

```json
{json.dumps(cards_summary, indent=2)}
```

## Output Instructions

1. Analyze the lesson cards and identify distinct concept blocks
2. Create 2-5 blocks depending on lesson complexity
3. Use the Write tool to save your output to: `{output_path}`

**IMPORTANT:**
- Include `lesson_template_id`: "{lesson_template_id}"
- Include `lesson_title`: "{lesson_title}"
- Include `total_blocks` matching the number of blocks in the array
- Each block must have all required fields

Write the complete JSON to `{output_path}` now using the Write tool.
"""

        return f"{self.prompt_template}\n\n{lesson_context}"

    def _prepare_cards_summary(
        self,
        cards: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Prepare cards summary for prompt (truncate long content)."""
        cards_summary = []

        for i, card in enumerate(cards):
            explainer = card.get("explainer", card.get("explainer_plain", ""))
            cfu = card.get("cfu", {})

            card_info = {
                "index": i,
                "id": card.get("id", f"card_{i}"),
                "title": card.get("title", ""),
                "explainer_preview": explainer[:800] if len(explainer) > 800 else explainer,
                "cfu_type": cfu.get("type", "unknown") if cfu else "none",
                "cfu_stem_preview": cfu.get("stem", "")[:300] if cfu else ""
            }
            cards_summary.append(card_info)

        return cards_summary

    def _fix_block_counts(self, raw_json: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-correct block counts from actual data.

        LLMs are notoriously bad at counting.
        """
        blocks = raw_json.get("blocks", [])
        actual_count = len(blocks)
        stated_count = raw_json.get("total_blocks", 0)

        if actual_count != stated_count:
            logger.info(f"  Block count correction: {stated_count} -> {actual_count}")
            raw_json["total_blocks"] = actual_count

        return raw_json


async def run_block_extraction(
    workspace_path: Path,
    lesson_template_id: str,
    lesson_template: Dict[str, Any]
) -> BlockExtractionResult:
    """Run block extraction agent and return result.

    Args:
        workspace_path: Path to workspace for file I/O
        lesson_template_id: Lesson template ID
        lesson_template: Full lesson template data

    Returns:
        Validated BlockExtractionResult Pydantic model

    Raises:
        RuntimeError: If agent fails
        ValueError: If lesson template is invalid
    """
    agent = PracticeBlockAgent(workspace_path=workspace_path)
    result = await agent.execute(lesson_template_id, lesson_template)

    if not result["success"]:
        raise RuntimeError(f"Block extraction failed: {result.get('error')}")

    return result["extraction_result"]
