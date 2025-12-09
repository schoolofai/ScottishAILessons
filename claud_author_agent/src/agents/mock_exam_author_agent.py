"""Mock Exam Author Agent - Standalone agent with Structured Output.

Transforms SOW mock_exam entry into frontend-ready exam JSON.
Uses Claude Agent SDK's output_format parameter to guarantee valid JSON schema on first attempt.

Input: Workspace with mock_exam_source.json and sow_context.json
Output: mock_exam.json file written to workspace (SDK guarantees schema compliance)

Architecture:
    1. Agent configured with output_format={'type': 'json_schema', 'schema': MockExam.model_json_schema()}
    2. SDK guarantees valid JSON matching schema on first attempt
    3. Python extracts structured_output from ResultMessage
    4. Python validates with Pydantic (belt-and-suspenders) and writes to file
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

# Use SIMPLIFIED schema for structured output generation (3 models vs 17+)
from ..tools.mock_exam_generation_schema import MockExamGeneration, convert_to_full_schema
# Use FULL schema for final validation only
from ..tools.mock_exam_schema_models import MockExam
# Critic schema for synthetic result when validation fails
from ..tools.mock_exam_critic_schema_models import (
    MockExamCriticResult, SchemaGate, MOCK_EXAM_CRITIC_OUTPUT_FILE
)
from ..utils.schema_sanitizer import (
    sanitize_schema_for_structured_output,
    wrap_schema_for_sdk_structured_output,
    unwrap_sdk_structured_output
)
# Note: MCP validator not needed - structured output guarantees schema compliance

logger = logging.getLogger(__name__)

# Output file name constant
MOCK_EXAM_OUTPUT_FILE = "mock_exam.json"


class MockExamAuthorAgent:
    """Standalone agent for generating mock exam JSON using Structured Output.

    This agent uses the SDK's output_format parameter to guarantee valid JSON
    matching the MockExam schema on the first attempt. No Write/Edit tools needed.
    """

    def __init__(
        self,
        workspace_path: Path,
        model: str = 'claude-sonnet-4-5',
        max_turns: int = 20  # Reduced - structured output doesn't need iteration
    ):
        """Initialize Mock Exam Author Agent.

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
        self.prompt_template = (prompts_dir / "mock_exam_author_prompt.md").read_text()

    async def execute(self) -> Dict[str, Any]:
        """Execute mock exam authoring with Structured Output.

        Returns:
            Dict with:
                - success: bool
                - mock_exam: MockExam (Pydantic model)
                - message_count: int
                - error: str (if failed)

        Raises:
            RuntimeError: If agent fails to produce valid output (fail-fast)
        """
        logger.info("=" * 60)
        logger.info("MOCK EXAM AUTHOR AGENT - Starting execution (Structured Output)")
        logger.info(f"   Workspace: {self.workspace_path}")
        logger.info("=" * 60)

        # Validate input files exist
        source_file = self.workspace_path / "mock_exam_source.json"
        context_file = self.workspace_path / "sow_context.json"
        output_file = self.workspace_path / MOCK_EXAM_OUTPUT_FILE

        if not source_file.exists():
            raise RuntimeError(f"Missing input file: {source_file}")
        if not context_file.exists():
            raise RuntimeError(f"Missing input file: {context_file}")

        # Load source data for prompt customization
        with open(source_file) as f:
            source_data = json.load(f)
        with open(context_file) as f:
            context_data = json.load(f)

        # Build prompt
        prompt = self._build_prompt(source_data, context_data)

        # Generate JSON schema from SIMPLIFIED Pydantic model (3 models vs 17+)
        # This is the key optimization - smaller schema = faster, more reliable generation
        raw_schema = MockExamGeneration.model_json_schema()
        sanitized_schema = sanitize_schema_for_structured_output(raw_schema)
        logger.info(f"📊 SIMPLIFIED Schema size: {len(json.dumps(sanitized_schema)):,} chars, {len(sanitized_schema.get('$defs', {}))} definitions")
        logger.info(f"   (vs ~13,000 chars with full MockExam schema)")
        logger.info(f"Schema sanitized for structured outputs (removed unsupported constraints)")

        # CRITICAL: Wrap schema for SDK's StructuredOutput tool
        # The SDK wraps output in {"parameter": ...}, so schema must expect that
        mock_exam_schema = wrap_schema_for_sdk_structured_output(sanitized_schema)
        logger.info(f"📦 Schema wrapped for SDK StructuredOutput tool (expects 'parameter' key)")

        # Configure agent with STRUCTURED OUTPUT (the key change!)
        options = ClaudeAgentOptions(
            model=self.model,
            permission_mode='bypassPermissions',  # Full permissions for agent autonomy
            max_turns=self.max_turns,
            cwd=str(self.workspace_path),
            # STRUCTURED OUTPUT - SDK guarantees valid JSON
            output_format={
                'type': 'json_schema',
                'schema': mock_exam_schema
            }
        )

        logger.info(f"Agent configured: model={self.model}, max_turns={self.max_turns}, output_format=json_schema")

        # Execute agent
        message_count = 0
        structured_output = None

        async with ClaudeSDKClient(options) as client:
            logger.info("Sending prompt to agent...")
            await client.query(prompt)

            logger.info("Receiving messages (waiting for structured_output)...")

            async for message in client.receive_messages():
                message_count += 1

                # Log message for debugging
                msg_type = type(message).__name__
                logger.info(f"📨 Message #{message_count}: {msg_type}")

                # ═══════════════════════════════════════════════════════════════
                # VERBOSE RAW MESSAGE LOGGING
                # ═══════════════════════════════════════════════════════════════
                logger.info(f"   RAW MESSAGE DUMP:")
                logger.info(f"   ├─ Type: {msg_type}")
                if hasattr(message, 'subtype'):
                    logger.info(f"   ├─ Subtype: {message.subtype}")
                if hasattr(message, 'structured_output'):
                    has_output = message.structured_output is not None
                    logger.info(f"   ├─ Has structured_output: {has_output}")
                    if has_output:
                        output_type = type(message.structured_output).__name__
                        logger.info(f"   ├─ structured_output type: {output_type}")

                # Log content blocks with full detail
                if hasattr(message, 'content'):
                    content = message.content
                    if isinstance(content, list):
                        logger.info(f"   ├─ Content blocks: {len(content)}")
                        for idx, block in enumerate(content):
                            block_type = type(block).__name__
                            logger.info(f"   │  ├─ Block {idx}: {block_type}")

                            # TextBlock - show truncated text
                            if hasattr(block, 'text'):
                                text_preview = block.text[:200] + "..." if len(block.text) > 200 else block.text
                                logger.info(f"   │  │  └─ Text: {text_preview}")

                            # ToolUseBlock - show tool name and input
                            if hasattr(block, 'name'):
                                logger.info(f"   │  │  ├─ Tool: {block.name}")
                                if hasattr(block, 'input'):
                                    input_str = json.dumps(block.input, default=str)[:500]
                                    logger.info(f"   │  │  └─ Input: {input_str}")

                            # ToolResultBlock - show result preview
                            if hasattr(block, 'content') and block_type == 'ToolResultBlock':
                                result_preview = str(block.content)[:300] + "..." if len(str(block.content)) > 300 else str(block.content)
                                logger.info(f"   │  │  └─ Result: {result_preview}")
                    elif isinstance(content, str):
                        content_preview = content[:300] + "..." if len(content) > 300 else content
                        logger.info(f"   ├─ Content (str): {content_preview}")

                logger.info(f"   └─ END RAW MESSAGE #{message_count}")
                # ═══════════════════════════════════════════════════════════════

                if isinstance(message, ResultMessage):
                    logger.info(f"✅ Agent completed after {message_count} messages")

                    # Handle error cases
                    if message.subtype == 'error_max_turns':
                        raise RuntimeError(
                            f"Agent exceeded max turns ({self.max_turns}) without completing"
                        )
                    if message.subtype == 'error_max_structured_output_retries':
                        raise RuntimeError(
                            "Agent could not produce valid JSON matching schema after max retries"
                        )

                    # Extract structured output - THIS IS THE KEY!
                    if hasattr(message, 'structured_output') and message.structured_output:
                        structured_output = message.structured_output
                        logger.info("✅ Structured output received from SDK")
                    else:
                        logger.warning("⚠️ No structured_output in ResultMessage")

                    break

        # Validate we got structured output
        if not structured_output:
            raise RuntimeError(
                "Agent completed but no structured_output received. "
                "Check SDK version and output_format configuration."
            )

        # structured_output is wrapped in {"parameter": <data>} by SDK
        logger.info(f"Structured output type: {type(structured_output)}")
        logger.info(f"Structured output keys: {list(structured_output.keys()) if isinstance(structured_output, dict) else 'N/A'}")

        # CRITICAL: Unwrap from SDK's {"parameter": ...} wrapper
        simplified_json = unwrap_sdk_structured_output(structured_output)
        logger.info(f"Unwrapped JSON keys: {list(simplified_json.keys()) if isinstance(simplified_json, dict) else 'N/A'}")

        # ═══════════════════════════════════════════════════════════════
        # POST-PROCESSING: Convert simplified → full schema
        # ═══════════════════════════════════════════════════════════════
        logger.info("🔄 Converting simplified schema → full MockExam schema...")

        # Step 1: Validate with simplified schema (should always pass - SDK guarantee)
        try:
            MockExamGeneration.model_validate(simplified_json)
            logger.info("✅ Simplified schema validation passed")
        except Exception as e:
            logger.error(f"Simplified schema validation failed: {e}")
            logger.error(f"Raw data keys: {list(simplified_json.keys()) if isinstance(simplified_json, dict) else simplified_json}")
            raise RuntimeError(f"Structured output doesn't match simplified schema: {e}")

        # Step 2: Convert flattened structure to nested MockExam format
        raw_json = convert_to_full_schema(simplified_json)
        logger.info("✅ Converted to full MockExam schema structure")

        # Auto-correct summary counts (LLMs are notoriously bad at counting)
        logger.info("Auto-correcting summary counts...")
        raw_json = self._fix_summary_counts(raw_json)

        # Write full schema JSON to file (Python does this, not the agent)
        logger.info(f"Writing full schema output to {MOCK_EXAM_OUTPUT_FILE}...")
        with open(output_file, 'w') as f:
            json.dump(raw_json, f, indent=2)
        logger.info(f"✅ Written {MOCK_EXAM_OUTPUT_FILE} ({output_file.stat().st_size:,} bytes)")

        # Step 3: Validate with FULL schema (belt-and-suspenders)
        # NOTE: If validation fails, we create a synthetic critic result so Reviser can fix it
        logger.info("Validating with full MockExam schema (belt-and-suspenders)...")
        try:
            mock_exam = MockExam.model_validate(raw_json)
            logger.info("✅ Full schema validation passed")
        except Exception as e:
            # Validation failed - create synthetic critic result for Reviser
            error_message = str(e)
            logger.warning(f"⚠️ Full MockExam schema validation failed: {error_message}")
            logger.warning("   Creating synthetic critic result for Reviser...")

            # Create synthetic critic result with the validation error
            synthetic_critic = self._create_synthetic_critic_result(error_message, raw_json)

            # Write synthetic critic result to workspace
            critic_output_file = self.workspace_path / MOCK_EXAM_CRITIC_OUTPUT_FILE
            with open(critic_output_file, 'w') as f:
                json.dump(synthetic_critic.model_dump(by_alias=True), f, indent=2)
            logger.info(f"✅ Written synthetic critic result to {MOCK_EXAM_CRITIC_OUTPUT_FILE}")

            # Construct a lenient MockExam object without strict validation
            mock_exam = MockExam.model_construct(**raw_json)

        logger.info("=" * 60)
        logger.info("MOCK EXAM AUTHOR AGENT - Execution complete")
        logger.info(f"   examId: {mock_exam.examId}")
        logger.info(f"   Total questions: {mock_exam.summary.total_questions}")
        logger.info(f"   Total marks: {mock_exam.metadata.totalMarks}")
        logger.info(f"   Messages: {message_count}")
        logger.info("=" * 60)

        return {
            "success": True,
            "mock_exam": mock_exam,
            "message_count": message_count
        }

    def _build_prompt(
        self,
        source_data: Dict[str, Any],
        context_data: Dict[str, Any]
    ) -> str:
        """Build prompt by injecting variables into template.

        Args:
            source_data: Contents of mock_exam_source.json
            context_data: Contents of sow_context.json

        Returns:
            Complete prompt string with variables substituted
        """
        # Extract variables from source data
        mock_exam_entries = source_data.get('mock_exam_entries', [])
        first_entry = mock_exam_entries[0] if mock_exam_entries else {}
        sow_entry_order = first_entry.get('sow_entry_order', 1)

        # Build substitution map
        variables = {
            'courseId': source_data.get('courseId', 'unknown'),
            'sowId': source_data.get('sowId', 'unknown'),
            'sowEntryOrder': str(sow_entry_order),
            'subject': context_data.get('subject', 'unknown'),
            'level': context_data.get('level', 'unknown'),
            'entry_count': str(len(mock_exam_entries)),
            'accessibility_notes': context_data.get(
                'accessibility_notes',
                'Standard accessibility requirements'
            ),
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }

        # Simple variable substitution using {{variable}} pattern
        prompt = self.prompt_template
        for key, value in variables.items():
            prompt = prompt.replace('{{' + key + '}}', value)

        return prompt

    def _fix_summary_counts(self, raw_json: Dict[str, Any]) -> Dict[str, Any]:
        """Auto-correct summary counts from actual question data.

        LLMs are notoriously bad at counting. This function computes
        correct counts from the actual questions in sections.

        Args:
            raw_json: Raw mock exam JSON dict

        Returns:
            Corrected JSON dict with accurate summary counts
        """
        sections = raw_json.get("sections", [])

        # Count totals
        total_questions = 0
        difficulty_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        standard_counts: Dict[str, int] = {}

        for section in sections:
            questions = section.get("questions", [])
            total_questions += len(questions)

            for question in questions:
                # Count by difficulty
                difficulty = question.get("difficulty", "medium")
                difficulty_counts[difficulty] = difficulty_counts.get(difficulty, 0) + 1

                # Count by question type
                q_type = question.get("question_type", "short_text")
                type_counts[q_type] = type_counts.get(q_type, 0) + 1

                # Count standards
                for standard in question.get("standards_addressed", []):
                    code = standard.get("code", "")
                    if code:
                        standard_counts[code] = standard_counts.get(code, 0) + 1

        # Build corrected summary
        corrected_summary = {
            "total_questions": total_questions,
            "questions_by_difficulty": difficulty_counts,
            "questions_by_type": type_counts,
            "standards_coverage": [
                {"code": code, "question_count": count}
                for code, count in sorted(standard_counts.items())
            ]
        }

        # Check if corrections were needed
        original_summary = raw_json.get("summary", {})
        if original_summary != corrected_summary:
            logger.info("  Summary corrections applied:")
            if original_summary.get("questions_by_difficulty") != difficulty_counts:
                logger.info(f"    difficulty: {original_summary.get('questions_by_difficulty')} -> {difficulty_counts}")
            if original_summary.get("questions_by_type") != type_counts:
                logger.info(f"    types: {original_summary.get('questions_by_type')} -> {type_counts}")

        raw_json["summary"] = corrected_summary
        return raw_json

    def _create_synthetic_critic_result(
        self,
        validation_error: str,
        raw_json: Dict[str, Any]
    ) -> MockExamCriticResult:
        """Create a synthetic critic result from a validation error.

        When Author validation fails, we create a synthetic critic result
        so the Reviser can immediately fix the issue without waiting for
        the Critic LLM call.

        Args:
            validation_error: Pydantic validation error message
            raw_json: The raw mock exam JSON that failed validation

        Returns:
            MockExamCriticResult with schema_gate failed and improvement guidance
        """
        # Parse error to extract actionable information
        error_summary = validation_error.split('\n')[0] if '\n' in validation_error else validation_error

        # Create synthetic result with failed schema gate
        return MockExamCriticResult(
            **{
                "pass": False,
                "overall_score": 0.0,
                "schema_gate": SchemaGate(
                    **{
                        "pass": False,
                        "failed_checks": [error_summary]
                    }
                ),
                "validation_errors": [validation_error],
                "dimensions": None,  # Skip dimension scoring - schema must pass first
                "summary": (
                    f"Schema validation failed. The mock exam JSON does not conform to the required schema. "
                    f"Error: {error_summary}. The Reviser must fix this structural error before "
                    f"proceeding with quality evaluation."
                ),
                "improvements_required": [
                    f"FIX SCHEMA ERROR: {error_summary}",
                    "Ensure all section marks equal the sum of question marks",
                    "Verify totalMarks equals sum of all section_marks"
                ],
                "stats": None
            }
        )


async def run_mock_exam_author(
    workspace_path: Path,
    write_to_file: bool = True
) -> MockExam:
    """Run mock exam author agent and optionally write result to file.

    Args:
        workspace_path: Path to workspace with input files
        write_to_file: If True, write mock_exam.json to workspace

    Returns:
        Validated MockExam Pydantic model

    Raises:
        RuntimeError: If agent fails
    """
    agent = MockExamAuthorAgent(workspace_path=workspace_path)
    result = await agent.execute()

    if not result["success"]:
        raise RuntimeError(f"Mock exam author failed: {result.get('error')}")

    mock_exam = result["mock_exam"]

    # Note: Agent already wrote the file - this is for explicit re-write if needed
    if write_to_file:
        output_path = workspace_path / MOCK_EXAM_OUTPUT_FILE
        if not output_path.exists():
            output_path.write_text(mock_exam.model_dump_json(indent=2))
            logger.info(f"✅ Written {MOCK_EXAM_OUTPUT_FILE} to {output_path}")
        else:
            logger.info(f"✅ {MOCK_EXAM_OUTPUT_FILE} already exists at {output_path}")

    return mock_exam


# Standalone test
async def test_mock_exam_author():
    """Test mock exam author agent independently."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from src.utils.logging_config import setup_logging
    setup_logging(log_level="INFO")

    # Use existing workspace from pre-processing test
    workspace_path = Path("workspace/20251205_132351")

    if not workspace_path.exists():
        print(f"❌ Test workspace not found: {workspace_path}")
        print("   Run preprocessing test first to create workspace")
        return

    mock_exam = await run_mock_exam_author(
        workspace_path=workspace_path,
        write_to_file=True
    )

    print(f"✅ Mock exam generated!")
    print(f"   examId: {mock_exam.examId}")
    print(f"   Questions: {mock_exam.summary.total_questions}")
    print(f"   Marks: {mock_exam.metadata.totalMarks}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_mock_exam_author())
