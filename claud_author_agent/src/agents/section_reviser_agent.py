"""Section Reviser Agent - Revises a single section based on critic feedback.

Part of the section-based scaling solution for mock exam generation.
Takes section-level feedback and produces a revised section.

Benefits:
- Smaller token usage (revising one section vs entire exam)
- Targeted fixes (only revise what's broken)
- Preserves good sections (no unnecessary regeneration)

Input: Section + critic feedback + context
Output: SectionGeneration JSON (validated with Pydantic)
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional

# Disable SDK initialize timeout
os.environ.setdefault("CLAUDE_CODE_STREAM_CLOSE_TIMEOUT", "600000")

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..tools.section_generation_schema import (
    SectionGeneration,
    SectionGenerationContext,
    convert_section_to_full_schema
)
from ..utils.schema_sanitizer import (
    sanitize_schema_for_structured_output,
    wrap_schema_for_sdk_structured_output,
    unwrap_sdk_structured_output
)

logger = logging.getLogger(__name__)


class SectionReviserAgent:
    """Agent for revising a single section based on critic feedback."""

    def __init__(
        self,
        workspace_path: Path,
        section_context: SectionGenerationContext,
        current_section: Dict[str, Any],
        critic_feedback: Dict[str, Any],
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 15
    ):
        """Initialize Section Reviser Agent.

        Args:
            workspace_path: Path to workspace with input files
            section_context: Context for this section
            current_section: The current section data to revise
            critic_feedback: Feedback from the critic (may be full exam or section-specific)
            model: Claude model to use
            max_turns: Maximum conversation turns
        """
        self.workspace_path = workspace_path
        self.section_context = section_context
        self.current_section = current_section
        self.critic_feedback = critic_feedback
        self.model = model
        self.max_turns = max_turns

        # Load prompt from file
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.prompt_template = (prompts_dir / "section_reviser_prompt.md").read_text()

    async def execute(self) -> Dict[str, Any]:
        """Execute section revision with Structured Output.

        Returns:
            Dict with:
                - success: bool
                - section: dict (full schema format)
                - section_raw: dict (raw generation output)
                - message_count: int

        Raises:
            RuntimeError: If agent fails to produce valid output
        """
        ctx = self.section_context
        section_idx = ctx.section_index

        logger.info("=" * 60)
        logger.info(f"SECTION REVISER AGENT - Section {section_idx + 1}/{ctx.total_sections}")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info("=" * 60)

        # Build prompt
        prompt = self._build_prompt()

        # Generate JSON schema from Pydantic model
        raw_schema = SectionGeneration.model_json_schema()
        sanitized_schema = sanitize_schema_for_structured_output(raw_schema)

        # Wrap schema for SDK
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

        # Execute agent
        message_count = 0
        structured_output = None

        async with ClaudeSDKClient(options) as client:
            logger.info("Sending section revision prompt to agent...")
            await client.query(prompt)

            async for message in client.receive_messages():
                message_count += 1
                msg_type = type(message).__name__
                logger.info(f"📨 Message #{message_count}: {msg_type}")

                # Debug logging
                self._log_message_debug(message, message_count, msg_type)

                if isinstance(message, ResultMessage):
                    logger.info(f"✅ Section reviser completed after {message_count} messages")

                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(
                            f"Section reviser exceeded max turns ({self.max_turns})"
                        )

                    if hasattr(message, 'structured_output') and message.structured_output:
                        structured_output = message.structured_output
                    break

        if not structured_output:
            raise RuntimeError("Section reviser completed but no structured_output received.")

        # Unwrap and validate
        section_raw = unwrap_sdk_structured_output(structured_output)

        try:
            SectionGeneration.model_validate(section_raw)
            logger.info("✅ Revised section validation passed")
        except Exception as e:
            raise RuntimeError(f"Revised section doesn't match schema: {e}")

        # Auto-correct counts
        section_raw = self._fix_section_counts(section_raw)

        # Convert to full schema format
        section_full = convert_section_to_full_schema(section_raw, {
            "examId": ctx.examId,
            "courseId": ctx.courseId
        })

        # Write output for debugging
        output_file = self.workspace_path / f"section_{section_idx}_revised.json"
        with open(output_file, 'w') as f:
            json.dump(section_raw, f, indent=2)

        logger.info(f"✅ Section {section_idx + 1} revision complete")

        return {
            "success": True,
            "section": section_full,
            "section_raw": section_raw,
            "message_count": message_count,
            "section_index": section_idx
        }

    def _build_prompt(self) -> str:
        """Build revision prompt with current section and feedback."""
        ctx = self.section_context

        # Extract feedback relevant to this section
        section_feedback = self._extract_section_feedback()

        variables = {
            'section_index': str(ctx.section_index),
            'total_sections': str(ctx.total_sections),
            'section_label': self.current_section.get("section_label", f"Section {ctx.section_index + 1}"),
            'current_section': json.dumps(self.current_section, indent=2),
            'critic_feedback': json.dumps(section_feedback, indent=2),
            'improvements_required': self._format_improvements()
        }

        prompt = self.prompt_template
        for key, value in variables.items():
            prompt = prompt.replace('{{' + key + '}}', value)

        return prompt

    def _extract_section_feedback(self) -> Dict[str, Any]:
        """Extract feedback relevant to this section from critic result."""
        # For now, return full feedback
        # TODO: Parse critic result to extract section-specific issues
        return {
            "pass": self.critic_feedback.get("pass", False),
            "overall_score": self.critic_feedback.get("overall_score", 0),
            "improvements_required": self.critic_feedback.get("improvements_required", []),
            "summary": self.critic_feedback.get("summary", "")
        }

    def _format_improvements(self) -> str:
        """Format improvements list for prompt."""
        improvements = self.critic_feedback.get("improvements_required", [])
        if not improvements:
            return "No specific improvements listed."
        return "\n".join(f"- {imp}" for imp in improvements[:5])

    def _fix_section_counts(self, section_raw: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-correct section counts."""
        questions = section_raw.get("questions", [])
        actual_count = len(questions)
        actual_marks = sum(q.get("marks", 0) for q in questions)

        section_raw["section_question_count"] = actual_count
        section_raw["section_total_marks"] = actual_marks
        section_raw["section_marks"] = actual_marks

        return section_raw

    def _log_message_debug(self, message, count: int, msg_type: str):
        """Verbose debug logging."""
        logger.debug(f"   RAW MESSAGE DUMP:")
        logger.debug(f"   ├─ Type: {msg_type}")

        if hasattr(message, 'subtype'):
            logger.debug(f"   ├─ Subtype: {message.subtype}")

        if hasattr(message, 'content') and isinstance(message.content, list):
            logger.debug(f"   ├─ Content blocks: {len(message.content)}")


async def run_section_reviser(
    workspace_path: Path,
    section_context: SectionGenerationContext,
    current_section: Dict[str, Any],
    critic_feedback: Dict[str, Any]
) -> Dict[str, Any]:
    """Run section reviser agent and return result.

    Args:
        workspace_path: Path to workspace
        section_context: Context for this section
        current_section: Current section to revise
        critic_feedback: Feedback from critic

    Returns:
        Dict with revised section

    Raises:
        RuntimeError: If agent fails
    """
    agent = SectionReviserAgent(
        workspace_path=workspace_path,
        section_context=section_context,
        current_section=current_section,
        critic_feedback=critic_feedback
    )
    return await agent.execute()
