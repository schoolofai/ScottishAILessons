"""Mock Exam Reviser Agent - Revises mock exam based on critic feedback.

Uses Claude Agent SDK's structured output to guarantee valid JSON schema.
Takes existing mock_exam.json + critic feedback and produces revised version.

Input: Workspace with mock_exam.json, mock_exam_critic_result.json, source files
Output: Updated mock_exam.json with fixes applied
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..tools.mock_exam_generation_schema import MockExamGeneration, convert_to_full_schema
from ..tools.mock_exam_schema_models import MockExam
from ..tools.mock_exam_critic_schema_models import (
    MockExamCriticResult, MOCK_EXAM_CRITIC_OUTPUT_FILE
)
from ..utils.schema_sanitizer import sanitize_schema_for_structured_output

logger = logging.getLogger(__name__)

MOCK_EXAM_OUTPUT_FILE = "mock_exam.json"
# Use MOCK_EXAM_CRITIC_OUTPUT_FILE from schema_models for consistency


class MockExamReviserAgent:
    """Agent for revising mock exam based on critic feedback using Structured Output."""

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 20
    ):
        """Initialize Mock Exam Reviser Agent.

        Args:
            workspace_path: Path to workspace with input files
            model: Claude model to use
            max_turns: Maximum conversation turns
        """
        self.workspace_path = workspace_path
        self.model = model
        self.max_turns = max_turns

        # Load prompt from file
        prompts_dir = Path(__file__).parent.parent / "prompts"
        self.prompt_template = (prompts_dir / "mock_exam_reviser_prompt.md").read_text()

    async def execute(
        self,
        iteration: int,
        max_iterations: int
    ) -> Dict[str, Any]:
        """Execute mock exam revision with Structured Output.

        Args:
            iteration: Current iteration number (1-indexed)
            max_iterations: Maximum iterations allowed

        Returns:
            Dict with:
                - success: bool
                - mock_exam: MockExam (Pydantic model)
                - message_count: int
                - error: str (if failed)

        Raises:
            RuntimeError: If agent fails to produce valid output
        """
        logger.info("=" * 60)
        logger.info(f"MOCK EXAM REVISER AGENT - Iteration {iteration}/{max_iterations}")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info("=" * 60)

        # Validate required files exist
        mock_exam_file = self.workspace_path / MOCK_EXAM_OUTPUT_FILE
        critic_file = self.workspace_path / MOCK_EXAM_CRITIC_OUTPUT_FILE
        source_file = self.workspace_path / "mock_exam_source.json"
        context_file = self.workspace_path / "sow_context.json"

        for f, name in [
            (mock_exam_file, MOCK_EXAM_OUTPUT_FILE),
            (critic_file, MOCK_EXAM_CRITIC_OUTPUT_FILE),
            (source_file, "mock_exam_source.json"),
            (context_file, "sow_context.json")
        ]:
            if not f.exists():
                raise RuntimeError(f"Missing required file: {name}")

        # Load files for prompt building
        with open(mock_exam_file) as f:
            mock_exam_data = json.load(f)
        with open(critic_file) as f:
            critic_data = json.load(f)
        with open(context_file) as f:
            context_data = json.load(f)

        # Validate critic result with Pydantic
        critic_result = MockExamCriticResult.model_validate(critic_data)

        # Build prompt with critic feedback
        prompt = self._build_prompt(
            mock_exam_data=mock_exam_data,
            critic_result=critic_result,
            context_data=context_data,
            iteration=iteration,
            max_iterations=max_iterations
        )

        # Generate schema for structured output
        raw_schema = MockExamGeneration.model_json_schema()
        mock_exam_schema = sanitize_schema_for_structured_output(raw_schema)
        logger.info(f"Schema size: {len(json.dumps(mock_exam_schema)):,} chars")

        # Configure agent with structured output
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            max_turns=self.max_turns,
            cwd=str(self.workspace_path),
            output_format={
                'type': 'json_schema',
                'schema': mock_exam_schema
            }
        )

        logger.info(f"Reviser configured: model={self.model}, iteration={iteration}")

        # Execute agent
        message_count = 0
        structured_output = None

        async with ClaudeSDKClient(options) as client:
            logger.info("Sending revision prompt to agent...")
            await client.query(prompt)

            logger.info("Receiving messages (waiting for structured_output)...")

            async for message in client.receive_messages():
                message_count += 1

                # Log message for debugging
                msg_type = type(message).__name__
                logger.info(f"📨 Message #{message_count}: {msg_type}")

                # ═══════════════════════════════════════════════════════════════
                # VERBOSE RAW MESSAGE LOGGING (DEBUG mode)
                # ═══════════════════════════════════════════════════════════════
                logger.debug(f"   RAW MESSAGE DUMP:")
                logger.debug(f"   ├─ Type: {msg_type}")
                if hasattr(message, 'subtype'):
                    logger.debug(f"   ├─ Subtype: {message.subtype}")
                if hasattr(message, 'structured_output'):
                    has_output = message.structured_output is not None
                    logger.debug(f"   ├─ Has structured_output: {has_output}")
                    if has_output:
                        output_type = type(message.structured_output).__name__
                        logger.debug(f"   ├─ structured_output type: {output_type}")

                # Log content blocks with full detail
                if hasattr(message, 'content'):
                    content = message.content
                    if isinstance(content, list):
                        logger.debug(f"   ├─ Content blocks: {len(content)}")
                        for idx, block in enumerate(content):
                            block_type = type(block).__name__
                            logger.debug(f"   │  ├─ Block {idx}: {block_type}")

                            # TextBlock - show truncated text
                            if hasattr(block, 'text'):
                                text_preview = block.text[:200] + "..." if len(block.text) > 200 else block.text
                                logger.debug(f"   │  │  └─ Text: {text_preview}")

                            # ToolUseBlock - show tool name and input
                            if hasattr(block, 'name'):
                                logger.debug(f"   │  │  ├─ Tool: {block.name}")
                                if hasattr(block, 'input'):
                                    input_str = json.dumps(block.input, default=str)[:500]
                                    logger.debug(f"   │  │  └─ Input: {input_str}")

                            # ToolResultBlock - show result preview
                            if hasattr(block, 'content') and block_type == 'ToolResultBlock':
                                result_preview = str(block.content)[:300] + "..." if len(str(block.content)) > 300 else str(block.content)
                                logger.debug(f"   │  │  └─ Result: {result_preview}")
                    elif isinstance(content, str):
                        content_preview = content[:300] + "..." if len(content) > 300 else content
                        logger.debug(f"   ├─ Content (str): {content_preview}")

                logger.debug(f"   └─ END RAW MESSAGE #{message_count}")
                # ═══════════════════════════════════════════════════════════════

                if isinstance(message, ResultMessage):
                    logger.info(f"✅ Agent completed after {message_count} messages")

                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(
                            f"Agent exceeded max turns ({self.max_turns})"
                        )
                    if message.subtype == 'error_max_structured_output_retries':
                        raise RuntimeError(
                            "Agent could not produce valid JSON after max retries"
                        )

                    if hasattr(message, 'structured_output') and message.structured_output:
                        structured_output = message.structured_output
                        logger.info("✅ Structured output received")
                    break

        if not structured_output:
            raise RuntimeError("Agent completed but no structured_output received")

        # Convert simplified schema to full MockExam schema
        logger.info("Converting to full MockExam schema...")
        raw_json = convert_to_full_schema(structured_output)

        # Auto-correct summary counts
        raw_json = self._fix_summary_counts(raw_json)

        # Write revised exam to file (overwrite existing)
        output_file = self.workspace_path / MOCK_EXAM_OUTPUT_FILE
        logger.info(f"Writing revised exam to {MOCK_EXAM_OUTPUT_FILE}...")
        with open(output_file, 'w') as f:
            json.dump(raw_json, f, indent=2)
        logger.info(f"✅ Written {output_file.stat().st_size:,} bytes")

        # Validate with full schema
        logger.info("Validating with full MockExam schema...")
        mock_exam = MockExam.model_validate(raw_json)

        logger.info("=" * 60)
        logger.info("MOCK EXAM REVISER - Revision complete")
        logger.info(f"   examId: {mock_exam.examId}")
        logger.info(f"   Questions: {mock_exam.summary.total_questions}")
        logger.info(f"   Messages: {message_count}")
        logger.info("=" * 60)

        return {
            "success": True,
            "mock_exam": mock_exam,
            "message_count": message_count
        }

    def _build_prompt(
        self,
        mock_exam_data: Dict[str, Any],
        critic_result: MockExamCriticResult,
        context_data: Dict[str, Any],
        iteration: int,
        max_iterations: int
    ) -> str:
        """Build revision prompt with critic feedback injected.

        Args:
            mock_exam_data: Current mock_exam.json contents
            critic_result: Validated critic result
            context_data: Course context
            iteration: Current iteration
            max_iterations: Max iterations

        Returns:
            Complete prompt string
        """
        # Format dimension scores
        dimension_scores = []
        if critic_result.dimensions:
            for dim_name, dim_score in critic_result.dimensions.items():
                status = "✓ PASS" if dim_score.pass_ else "✗ FAIL"
                dimension_scores.append(
                    f"- {dim_name}: {dim_score.score:.1f}/5.0 ({status})"
                )
        dimension_scores_str = "\n".join(dimension_scores) if dimension_scores else "No dimension scores available"

        # Format improvements required
        improvements = critic_result.improvements_required or []
        improvements_str = "\n".join(f"- {imp}" for imp in improvements) if improvements else "No specific improvements listed"

        # Format dimension issues
        dimension_issues = []
        if critic_result.dimensions:
            for dim_name, dim_score in critic_result.dimensions.items():
                if dim_score.issues:
                    dimension_issues.append(f"\n**{dim_name}** (score: {dim_score.score}):")
                    for issue in dim_score.issues:
                        dimension_issues.append(f"  - {issue}")
        dimension_issues_str = "\n".join(dimension_issues) if dimension_issues else "No specific issues documented"

        # Build substitution map
        variables = {
            'examId': mock_exam_data.get('examId', 'unknown'),
            'subject': context_data.get('subject', 'unknown'),
            'level': context_data.get('level', 'unknown'),
            'iteration': str(iteration),
            'max_iterations': str(max_iterations),
            'overall_score': f"{critic_result.overall_score:.2f}",
            'dimension_scores': dimension_scores_str,
            'improvements_required': improvements_str,
            'dimension_issues': dimension_issues_str
        }

        # Apply substitutions
        prompt = self.prompt_template
        for key, value in variables.items():
            prompt = prompt.replace('{{' + key + '}}', value)

        return prompt

    def _fix_summary_counts(self, raw_json: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-correct summary counts from actual question data.

        Same logic as MockExamAuthorAgent._fix_summary_counts.
        """
        sections = raw_json.get("sections", [])

        total_questions = 0
        difficulty_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        standard_counts: Dict[str, int] = {}

        for section in sections:
            questions = section.get("questions", [])
            total_questions += len(questions)

            for question in questions:
                difficulty = question.get("difficulty", "medium")
                difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1

                q_type = question.get("question_type", "short_text")
                type_counts[q_type] = type_counts.get(q_type, 0) + 1

                for standard in question.get("standards_addressed", []):
                    code = standard.get("code", "")
                    if code:
                        standard_counts[code] = standard_counts.get(code, 0) + 1

        corrected_summary = {
            "total_questions": total_questions,
            "questions_by_difficulty": difficulty_counts,
            "questions_by_type": type_counts,
            "standards_coverage": [
                {"code": code, "question_count": count}
                for code, count in sorted(standard_counts.items())
            ]
        }

        raw_json["summary"] = corrected_summary
        return raw_json


async def run_mock_exam_reviser(
    workspace_path: Path,
    iteration: int,
    max_iterations: int
) -> MockExam:
    """Run mock exam reviser agent and return result.

    Args:
        workspace_path: Path to workspace
        iteration: Current iteration number
        max_iterations: Maximum iterations

    Returns:
        Validated MockExam Pydantic model

    Raises:
        RuntimeError: If agent fails
    """
    agent = MockExamReviserAgent(workspace_path=workspace_path)
    result = await agent.execute(
        iteration=iteration,
        max_iterations=max_iterations
    )

    if not result["success"]:
        raise RuntimeError(f"Mock exam reviser failed: {result.get('error')}")

    return result["mock_exam"]
