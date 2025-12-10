"""Section Author Agent - Generates a single exam section using Structured Output.

Part of the section-based scaling solution for mock exam generation.
Generates ONE section at a time instead of the entire exam.

Benefits:
- Smaller structured output (~2-3K tokens per section vs ~9K+ for full exam)
- Parallel generation (multiple sections can run concurrently)
- Partial recovery (failed section doesn't invalidate others)
- Section-level revision (only regenerate failed sections)

Input: Section specification from mock_exam_source.json + exam context
Output: SectionGeneration JSON (validated with Pydantic)
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Disable SDK initialize timeout for long-running generations
os.environ.setdefault("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "600000")

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..tools.section_generation_schema import (
    SectionGeneration,
    SectionGenerationContext,
    convert_section_to_full_schema,
    SECTION_GENERATION_OUTPUT_FILE
)
from ..utils.schema_sanitizer import (
    sanitize_schema_for_structured_output,
    wrap_schema_for_sdk_structured_output,
    unwrap_sdk_structured_output
)

logger = logging.getLogger(__name__)


class SectionAuthorAgent:
    """Agent for generating a single exam section using Structured Output.

    Uses the SDK's output_format parameter to guarantee valid JSON
    matching the SectionGeneration schema.
    """

    def __init__(
        self,
        workspace_path: Path,
        section_context: SectionGenerationContext,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 15
    ):
        """Initialize Section Author Agent.

        Args:
            workspace_path: Path to workspace with input files
            section_context: Context for this section (index, standards, etc.)
            model: Claude model to use
            max_turns: Maximum conversation turns
        """
        self.workspace_path = workspace_path
        self.section_context = section_context
        self.model = model
        self.max_turns = max_turns

        # Load prompt from file
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.prompt_template = (prompts_dir / "section_author_prompt.md").read_text()

    async def execute(self) -> Dict[str, Any]:
        """Execute section generation with Structured Output.

        Returns:
            Dict with:
                - success: bool
                - section: dict (full schema format)
                - section_raw: dict (raw generation output)
                - message_count: int

        Raises:
            RuntimeError: If agent fails to produce valid output (fail-fast)
        """
        ctx = self.section_context
        section_idx = ctx.section_index

        logger.info("=" * 60)
        logger.info(f"SECTION AUTHOR AGENT - Section {section_idx + 1}/{ctx.total_sections}")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info(f"   Question start: {ctx.question_number_start}")
        logger.info("=" * 60)

        # Build prompt
        prompt = self._build_prompt()

        # Generate JSON schema from Pydantic model
        raw_schema = SectionGeneration.model_json_schema()
        sanitized_schema = sanitize_schema_for_structured_output(raw_schema)
        logger.info(f"📊 Section schema size: {len(json.dumps(sanitized_schema)):,} chars")

        # Wrap schema for SDK's StructuredOutput tool
        section_schema = wrap_schema_for_sdk_structured_output(sanitized_schema)

        # Configure agent with STRUCTURED OUTPUT
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            max_turns=self.max_turns,
            cwd=str(self.workspace_path),
            output_format={
                'type': 'json_schema',
                'schema': section_schema
            }
        )

        logger.info(f"Agent configured: model={self.model}, output_format=json_schema")

        # Execute agent
        message_count = 0
        structured_output = None

        async with ClaudeSDKClient(options) as client:
            logger.info("Sending section prompt to agent...")
            await client.query(prompt)

            logger.info("Receiving messages (waiting for structured_output)...")

            async for message in client.receive_messages():
                message_count += 1
                msg_type = type(message).__name__
                logger.info(f"📨 Message #{message_count}: {msg_type}")

                # Verbose debug logging
                self._log_message_debug(message, message_count, msg_type)

                if isinstance(message, ResultMessage):
                    logger.info(f"✅ Section agent completed after {message_count} messages")

                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(
                            f"Section agent exceeded max turns ({self.max_turns})"
                        )
                    if message.subtype == 'error_max_structured_output_retries':
                        raise RuntimeError(
                            "Section agent could not produce valid JSON after max retries"
                        )

                    if hasattr(message, 'structured_output') and message.structured_output:
                        structured_output = message.structured_output
                        logger.info("✅ Structured output received from SDK")
                    else:
                        logger.warning("⚠️ No structured_output in ResultMessage")

                    break

        # Validate we got structured output
        if not structured_output:
            raise RuntimeError(
                "Section agent completed but no structured_output received."
            )

        # Unwrap from SDK's {"parameter": ...} wrapper
        section_raw = unwrap_sdk_structured_output(structured_output)
        logger.info(f"Unwrapped section keys: {list(section_raw.keys())}")

        # Validate with Pydantic
        try:
            SectionGeneration.model_validate(section_raw)
            logger.info("✅ Section schema validation passed")
        except Exception as e:
            logger.error(f"Section schema validation failed: {e}")
            raise RuntimeError(f"Section output doesn't match schema: {e}")

        # Auto-correct section counts
        section_raw = self._fix_section_counts(section_raw)

        # Convert to full schema format
        section_full = convert_section_to_full_schema(section_raw, {
            "examId": ctx.examId,
            "courseId": ctx.courseId
        })

        # Write section output to workspace for debugging
        output_file = self.workspace_path / f"section_{section_idx}_output.json"
        with open(output_file, 'w') as f:
            json.dump(section_raw, f, indent=2)
        logger.info(f"✅ Written section output to {output_file.name}")

        logger.info("=" * 60)
        logger.info(f"SECTION AUTHOR - Section {section_idx + 1} complete")
        logger.info(f"   Questions: {len(section_raw.get('questions', []))}")
        logger.info(f"   Marks: {section_raw.get('section_marks', 0)}")
        logger.info(f"   Messages: {message_count}")
        logger.info("=" * 60)

        return {
            "success": True,
            "section": section_full,
            "section_raw": section_raw,
            "message_count": message_count,
            "section_index": section_idx
        }

    def _build_prompt(self) -> str:
        """Build prompt by injecting section context into template."""
        ctx = self.section_context
        spec = ctx.section_spec

        # Determine calculator instruction
        is_calc = ctx.calculator_policy in ("calc", "mixed") and ctx.section_index > 0
        calc_instruction = "Calculator allowed." if is_calc else "No calculator allowed."

        # Format standards list
        standards_text = json.dumps(ctx.standards_to_address, indent=2)

        # Extract expected values from spec
        practice_problems = spec.get("practice_problems", [])
        expected_question_count = len(practice_problems)

        # Estimate marks per question (typically 3-5 marks each)
        expected_marks = sum(
            self._extract_marks_from_problem(p)
            for p in practice_problems
        )

        # Build substitution map
        variables = {
            'examId': ctx.examId,
            'courseId': ctx.courseId,
            'sowId': ctx.sowId,
            'subject': ctx.subject,
            'level': ctx.level,
            'total_exam_marks': str(ctx.total_exam_marks),
            'total_exam_time': str(ctx.total_exam_time),
            'calculator_policy': ctx.calculator_policy,
            'section_index': str(ctx.section_index),
            'total_sections': str(ctx.total_sections),
            'section_label': spec.get("title", f"Section {ctx.section_index + 1}"),
            'section_order': str(ctx.section_index + 1),
            'expected_question_count': str(expected_question_count),
            'expected_section_marks': str(expected_marks),
            'section_time_allocation': str(spec.get("estimated_minutes", 15)),
            'question_number_start': str(ctx.question_number_start),
            'question_number_start_plus_1': str(ctx.question_number_start + 1),
            'is_calculator_section': str(is_calc).lower(),
            'calculator_instruction': calc_instruction,
            'standards_list': standards_text,
            'section_spec': json.dumps(spec, indent=2)
        }

        # Simple variable substitution
        prompt = self.prompt_template
        for key, value in variables.items():
            prompt = prompt.replace('{{' + key + '}}', value)

        return prompt

    def _extract_marks_from_problem(self, problem: str) -> int:
        """Extract marks from problem string like 'Q1: ... [3 marks]'."""
        import re
        match = re.search(r'\[(\d+)\s*marks?\]', problem, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 3  # Default if not specified

    def _fix_section_counts(self, section_raw: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-correct section counts from actual question data."""
        questions = section_raw.get("questions", [])

        actual_count = len(questions)
        actual_marks = sum(q.get("marks", 0) for q in questions)

        # Check if corrections needed
        if section_raw.get("section_question_count") != actual_count:
            logger.info(f"  Correcting section_question_count: {section_raw.get('section_question_count')} -> {actual_count}")
            section_raw["section_question_count"] = actual_count

        if section_raw.get("section_total_marks") != actual_marks:
            logger.info(f"  Correcting section_total_marks: {section_raw.get('section_total_marks')} -> {actual_marks}")
            section_raw["section_total_marks"] = actual_marks

        if section_raw.get("section_marks") != actual_marks:
            logger.info(f"  Correcting section_marks: {section_raw.get('section_marks')} -> {actual_marks}")
            section_raw["section_marks"] = actual_marks

        return section_raw

    def _log_message_debug(self, message, count: int, msg_type: str):
        """Verbose debug logging for agent messages."""
        logger.debug(f"   RAW MESSAGE DUMP:")
        logger.debug(f"   ├─ Type: {msg_type}")

        if hasattr(message, 'subtype'):
            logger.debug(f"   ├─ Subtype: {message.subtype}")

        if hasattr(message, 'structured_output'):
            has_output = message.structured_output is not None
            logger.debug(f"   ├─ Has structured_output: {has_output}")

        if hasattr(message, 'content'):
            content = message.content
            if isinstance(content, list):
                logger.debug(f"   ├─ Content blocks: {len(content)}")
                for idx, block in enumerate(content):
                    block_type = type(block).__name__
                    logger.debug(f"   │  ├─ Block {idx}: {block_type}")

                    if hasattr(block, 'text'):
                        preview = block.text[:200] + "..." if len(block.text) > 200 else block.text
                        logger.debug(f"   │  │  └─ Text: {preview}")

                    if hasattr(block, 'name'):
                        logger.info(f"   Block {idx}: {block_type} - Tool: {block.name}")

        logger.debug(f"   └─ END RAW MESSAGE #{count}")


async def run_section_author(
    workspace_path: Path,
    section_context: SectionGenerationContext
) -> Dict[str, Any]:
    """Run section author agent and return result.

    Args:
        workspace_path: Path to workspace with input files
        section_context: Context for this section

    Returns:
        Dict with section in full schema format

    Raises:
        RuntimeError: If agent fails
    """
    agent = SectionAuthorAgent(
        workspace_path=workspace_path,
        section_context=section_context
    )
    return await agent.execute()
