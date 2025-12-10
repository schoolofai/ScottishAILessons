"""Mock Exam Critic Agent - Standalone agent for UX quality evaluation.

Reviews mock_exam.json against UX dimensions after schema validation.
Uses Claude Agent SDK with Write tool for JSON output, validated post-hoc with Pydantic.

Input: Workspace with mock_exam.json, mock_exam_source.json, sow_context.json
Output: mock_exam_critic_result.json (validated with Pydantic)

Process:
1. Schema Gate (blocking): Call MCP validator - if fails, skip dimensions
2. Dimensional Scoring: Evaluate 4 UX dimensions (question_clarity, marking_transparency,
   navigation_flow, accessibility)
3. Write result JSON with scores, issues, and recommendations
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from ..tools.mock_exam_critic_schema_models import (
    MockExamCriticResult,
    MOCK_EXAM_CRITIC_OUTPUT_FILE
)
from ..tools.mock_exam_validator_tool import mock_exam_validation_server

logger = logging.getLogger(__name__)


class MockExamCriticAgent:
    """Standalone agent for evaluating mock exam UX quality.

    This agent reads mock_exam.json, validates it with MCP validator,
    then scores 4 UX dimensions (question_clarity, marking_transparency,
    navigation_flow, accessibility). Output is written to file and validated
    with Pydantic post-hoc.
    """

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 30  # Critic is simpler than author
    ):
        """Initialize Mock Exam Critic Agent.

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
        self.prompt_template = (prompts_dir / "mock_exam_ux_critic_prompt.md").read_text()

    async def execute(self) -> Dict[str, Any]:
        """Execute mock exam critique with Write tool + Pydantic validation.

        Returns:
            Dict with:
                - success: bool
                - critic_result: MockExamCriticResult (Pydantic model)
                - message_count: int
                - error: str (if failed)

        Raises:
            RuntimeError: If agent fails to produce valid output (fail-fast)
        """
        logger.info("=" * 60)
        logger.info("MOCK EXAM CRITIC AGENT - Starting execution")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info("=" * 60)

        # Validate required input files exist
        mock_exam_file = self.workspace_path / "mock_exam.json"
        source_file = self.workspace_path / "mock_exam_source.json"
        context_file = self.workspace_path / "sow_context.json"
        output_file = self.workspace_path / MOCK_EXAM_CRITIC_OUTPUT_FILE

        if not mock_exam_file.exists():
            raise RuntimeError(f"Missing input file: {mock_exam_file}")
        if not source_file.exists():
            raise RuntimeError(f"Missing input file: {source_file}")
        if not context_file.exists():
            raise RuntimeError(f"Missing input file: {context_file}")

        # Load files for context
        with open(mock_exam_file) as f:
            mock_exam_data = json.load(f)
        with open(context_file) as f:
            context_data = json.load(f)

        # Build prompt
        prompt = self._build_prompt(mock_exam_data, context_data)

        # Configure agent with Write tool (no structured output)
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',
            mcp_servers={"validator": mock_exam_validation_server},
            allowed_tools=[
                'Read',
                'Write',
                'mcp__validator__validate_mock_exam_schema'
            ],
            max_turns=self.max_turns,
            cwd=str(self.workspace_path)
        )

        logger.info(f"Agent configured: model={self.model}, max_turns={self.max_turns}")

        # Execute agent
        message_count = 0

        async with ClaudeSDKClient(options) as client:
            logger.info("Sending prompt to agent...")
            await client.query(prompt)

            logger.info("Receiving messages (agent will write critique JSON to file)...")

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

                            # ToolUseBlock - show tool name and input (also log at INFO for visibility)
                            if hasattr(block, 'name'):
                                logger.info(f"   Block {idx}: {block_type} - Tool: {block.name}")
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

                if hasattr(message, 'subtype'):
                    logger.info(f"   Subtype: {message.subtype}")

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
                f"Agent did not write {MOCK_EXAM_CRITIC_OUTPUT_FILE} to workspace. "
                f"Check prompt or increase max_turns."
            )

        # Load and validate with Pydantic
        logger.info(f"Loading {MOCK_EXAM_CRITIC_OUTPUT_FILE} for validation...")
        try:
            with open(output_file) as f:
                raw_json = json.load(f)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Agent wrote invalid JSON: {e}")

        logger.info("Validating with Pydantic schema...")
        try:
            critic_result = MockExamCriticResult.model_validate(raw_json)
        except Exception as e:
            logger.error(f"Pydantic validation failed: {e}")
            raise RuntimeError(f"Critic result JSON failed schema validation: {e}")

        logger.info("=" * 60)
        logger.info("MOCK EXAM CRITIC AGENT - Execution complete")
        logger.info(f"   Schema Gate: {'PASS' if critic_result.schema_gate.pass_ else 'FAIL'}")
        logger.info(f"   Overall Pass: {'PASS' if critic_result.pass_ else 'FAIL'}")
        logger.info(f"   Overall Score: {critic_result.overall_score:.2f}/5.0")
        logger.info(f"   Messages: {message_count}")
        logger.info("=" * 60)

        return {
            "success": True,
            "critic_result": critic_result,
            "message_count": message_count
        }

    def _build_prompt(
        self,
        mock_exam_data: Dict[str, Any],
        context_data: Dict[str, Any]
    ) -> str:
        """Build prompt by injecting variables into template.

        Args:
            mock_exam_data: Contents of mock_exam.json
            context_data: Contents of sow_context.json

        Returns:
            Complete prompt string with variables substituted
        """
        # Extract variables from data
        variables = {
            'examId': mock_exam_data.get('examId', 'unknown'),
            'total_questions': str(mock_exam_data.get('summary', {}).get('total_questions', 0)),
            'total_marks': str(mock_exam_data.get('metadata', {}).get('totalMarks', 0)),
            'subject': context_data.get('subject', 'unknown'),
            'level': context_data.get('level', 'unknown'),
            'output_file': MOCK_EXAM_CRITIC_OUTPUT_FILE
        }

        # Simple variable substitution using {{variable}} pattern
        prompt = self.prompt_template
        for key, value in variables.items():
            prompt = prompt.replace('{{' + key + '}}', value)

        return prompt


async def run_mock_exam_critic(workspace_path: Path) -> MockExamCriticResult:
    """Run mock exam critic agent and return result.

    Args:
        workspace_path: Path to workspace with mock_exam.json

    Returns:
        Validated MockExamCriticResult Pydantic model

    Raises:
        RuntimeError: If agent fails
    """
    agent = MockExamCriticAgent(workspace_path=workspace_path)
    result = await agent.execute()

    if not result["success"]:
        raise RuntimeError(f"Mock exam critic failed: {result.get('error')}")

    return result["critic_result"]


# Standalone test
async def test_mock_exam_critic():
    """Test mock exam critic agent independently."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from src.utils.logging_config import setup_logging
    setup_logging(log_level="INFO")

    # Use existing workspace from author test
    workspace_path = Path("workspace/20251205_154025")

    if not workspace_path.exists():
        print(f"❌ Test workspace not found: {workspace_path}")
        print("   Run mock_exam_author test first to create workspace")
        return

    critic_result = await run_mock_exam_critic(workspace_path=workspace_path)

    print(f"✅ Critique complete!")
    print(f"   Schema Gate: {'PASS' if critic_result.schema_gate.pass_ else 'FAIL'}")
    print(f"   Overall Pass: {'PASS' if critic_result.pass_ else 'FAIL'}")
    print(f"   Overall Score: {critic_result.overall_score:.2f}/5.0")

    if critic_result.dimensions:
        print(f"   Dimensions:")
        for dim, score in critic_result.dimensions.items():
            print(f"      {dim}: {score.score}/5.0")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_mock_exam_critic())
