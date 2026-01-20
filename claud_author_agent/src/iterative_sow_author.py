"""Iterative SOW Author using Claude Agent SDK with Native Structured Output.

Implements lesson-by-lesson SOW generation with critic loops for quality assurance.
Uses Claude Agent SDK's native structured output (`output_format` parameter) for
schema-compliant generation.

Architecture:
    1. Outline Author → Generates lesson sequence skeleton (structured output)
    2. Outline Critic → Validates outline (PASS/REVISION_REQUIRED loop)
    3. Lesson Entry Author (loop) → Generates each lesson (structured output)
    4. Lesson Critic (per lesson) → Validates each lesson (PASS/REVISION_REQUIRED loop)
    5. Metadata Author → Generates course-level metadata (structured output)
    6. Python Assembler → Combines into final AuthoredSOW (no LLM)

Benefits:
    - Native structured output ensures schema compliance at generation time
    - Critic loops catch pedagogical issues before proceeding
    - Small token scope per call = better coherence
    - Each lesson validates individually = early error detection
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions
)

from .utils.filesystem import IsolatedFilesystem
from .utils.validation import validate_input_schema
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging, add_workspace_file_handler
from .utils.sdk_message_logger import log_sdk_message, create_phase_logger
# NOTE: MCP servers removed due to SDK transport bug with query() in v0.1.19
# Validation is now handled by structured output + Pydantic after generation
from .tools.sow_schema_models import LessonOutline, SOWEntry, Metadata
from pydantic import ValidationError
from .tools.critic_schema_models import (
    OutlineCriticResult,
    LessonCriticResult,
    calculate_overall_score,
    should_pass
)
# Minimal schemas for SDK structured output (no descriptions, no $defs)
# Pydantic models still used for validation after extraction
from .utils.minimal_schemas import (
    LESSON_OUTLINE_SCHEMA,
    OUTLINE_CRITIC_RESULT_SCHEMA,
    SOW_ENTRY_SCHEMA,
    LESSON_CRITIC_RESULT_SCHEMA,
    METADATA_SCHEMA
)

logger = logging.getLogger(__name__)


def _parse_json_strings_recursive(data: Any) -> Any:
    """Recursively parse JSON strings found in structured output.

    The Claude SDK sometimes returns nested objects as JSON strings instead of
    dicts when using ToolUseBlock with complex schemas. This function recursively
    finds and parses those strings.

    Args:
        data: Any value (dict, list, str, etc.)

    Returns:
        Data with JSON strings parsed into proper Python objects
    """
    if isinstance(data, str):
        # Check if string looks like JSON object or array
        stripped = data.strip()
        if (stripped.startswith('{') and stripped.endswith('}')) or \
           (stripped.startswith('[') and stripped.endswith(']')):
            try:
                parsed = json.loads(data)
                logger.debug(f"Parsed JSON string into {type(parsed).__name__}")
                # Recursively process the parsed result
                return _parse_json_strings_recursive(parsed)
            except json.JSONDecodeError:
                # Not valid JSON, return as-is
                return data
        return data
    elif isinstance(data, dict):
        return {k: _parse_json_strings_recursive(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_parse_json_strings_recursive(item) for item in data]
    else:
        return data


def _unwrap_structured_output(data: Dict[str, Any]) -> Dict[str, Any]:
    """Unwrap structured output if wrapped in a single-key container.

    Claude sometimes wraps structured output data in various wrapper keys like
    {"output": {...}}, {"json_output": {...}}, or {"result": {...}} instead
    of putting properties at the root level. This function handles any
    single-key wrapper where the value is a dictionary.

    Also handles the SDK quirk where nested objects are returned as JSON strings
    instead of proper dicts by recursively parsing them.

    Args:
        data: Structured output data (may or may not be wrapped)

    Returns:
        Unwrapped data dictionary with JSON strings parsed
    """
    # First, recursively parse any JSON strings in the data
    data = _parse_json_strings_recursive(data)

    if isinstance(data, dict) and len(data) == 1:
        # Get the single key and its value
        wrapper_key = next(iter(data.keys()))
        inner_value = data[wrapper_key]

        # If the inner value is a dict, unwrap it
        if isinstance(inner_value, dict):
            logger.debug(f"Unwrapping structured output from '{wrapper_key}' key")
            return inner_value

    return data


def _extract_structured_output_from_message(message: Any) -> Optional[Dict[str, Any]]:
    """Extract structured output from AssistantMessage ToolUseBlock.

    The SDK's StructuredOutput tool validates data before returning it via
    `structured_output` attribute. When Claude wraps data in {"output": {...}},
    the tool validation fails. This function extracts the data directly from
    the ToolUseBlock to work around this SDK quirk.

    Args:
        message: SDK message (may be AssistantMessage with ToolUseBlock)

    Returns:
        Extracted and unwrapped data dict, or None if not found
    """
    # Check if this is an AssistantMessage with content
    if not hasattr(message, 'content'):
        return None

    content = message.content
    if not isinstance(content, list):
        return None

    # Look for StructuredOutput ToolUseBlock
    for block in content:
        # Handle dict representation
        if isinstance(block, dict):
            if block.get('type') == 'tool_use' and block.get('name') == 'StructuredOutput':
                input_data = block.get('input', {})
                logger.debug(f"Found StructuredOutput in dict block: {list(input_data.keys())}")
                return _unwrap_structured_output(input_data)
        # Handle ToolUseBlock object (SDK returns this type)
        elif type(block).__name__ == 'ToolUseBlock':
            if getattr(block, 'name', None) == 'StructuredOutput':
                input_data = getattr(block, 'input', {})
                logger.debug(f"Found StructuredOutput in ToolUseBlock: {list(input_data.keys())}")
                return _unwrap_structured_output(input_data)
        # Handle object with name attribute (fallback)
        elif hasattr(block, 'name') and hasattr(block, 'input'):
            if block.name == 'StructuredOutput':
                input_data = getattr(block, 'input', {})
                logger.debug(f"Found StructuredOutput via name attr: {list(input_data.keys())}")
                return _unwrap_structured_output(input_data)

    return None


# Set maximum output token limit for Claude Agent SDK
os.environ.setdefault('CLAUDE_CODE_MAX_OUTPUT_TOKENS', '100000')
logger.info("Set CLAUDE_CODE_MAX_OUTPUT_TOKENS=100000 (agent output budget)")

# Constants for critic loops
MAX_REVISION_ATTEMPTS = 3
PASS_THRESHOLD = 0.7


def validate_lesson_entry_schema(lesson_dict: dict) -> tuple[bool, str]:
    """Validate lesson entry against SOWEntry Pydantic model (fail-fast).

    This function provides deterministic schema validation BEFORE the critic runs.
    Validation errors are formatted for LLM consumption so they can be fed back
    to the lesson author for immediate revision.

    Args:
        lesson_dict: Dictionary containing the lesson entry data

    Returns:
        (True, "") if valid
        (False, error_message) if invalid - error message fed to author for revision
    """
    try:
        SOWEntry.model_validate(lesson_dict)
        return True, ""
    except ValidationError as e:
        # Format errors for LLM consumption
        error_messages = []
        for error in e.errors():
            loc = " -> ".join(str(x) for x in error['loc'])
            error_messages.append(f"- {loc}: {error['msg']}")

        return False, "Schema validation failed:\n" + "\n".join(error_messages)


class IterativeSOWAuthor:
    """Iterative SOW authoring pipeline using Claude Agent SDK with structured output.

    Generates SOW lesson-by-lesson with critic validation loops. Each phase uses
    Claude Agent SDK's native `output_format` parameter to ensure schema compliance.

    Phases:
        1. Pre-processing (Python): Extract Course_outcomes.json from Appwrite
        2. Outline Generation (Claude SDK, structured output): Create lesson skeleton
        3. Outline Critique (Claude SDK, structured output): Validate outline quality
        4. Lesson Generation (Claude SDK, loop, structured output): Author each lesson
        5. Lesson Critique (Claude SDK, per-lesson, structured output): Validate quality
        6. Metadata Generation (Claude SDK, structured output): Create course metadata
        7. Assembly (Python): Combine lessons + metadata into AuthoredSOW
        8. Post-processing (Python): Upsert to Appwrite

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "INFO"
    ):
        """Initialize Iterative SOW Author.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        setup_logging(log_level=log_level)
        logger.info(f"Initialized IterativeSOWAuthor - Execution ID: {self.execution_id}")

    # ═══════════════════════════════════════════════════════════════════════════
    # Prompt Loading (for query() calls)
    # ═══════════════════════════════════════════════════════════════════════════

    def _load_prompt(self, prompt_name: str) -> str:
        """Load a prompt file by name.

        Args:
            prompt_name: Name of prompt file (without .md extension)

        Returns:
            Prompt content as string
        """
        prompts_dir = Path(__file__).parent / "prompts"
        prompt_path = prompts_dir / f"{prompt_name}.md"
        return prompt_path.read_text()

    # ═══════════════════════════════════════════════════════════════════════════
    # Outline Generation & Critique
    # ═══════════════════════════════════════════════════════════════════════════

    async def _generate_outline_structured(
        self,
        workspace_path: Path,
        subject: str,
        level: str,
        revision_guidance: Optional[List[str]] = None
    ) -> LessonOutline:
        """Generate lesson outline using native structured output.

        Uses query() directly (no subagents) following the working SDK pattern.

        Args:
            workspace_path: Path to isolated workspace
            subject: Course subject identifier
            level: Course level identifier
            revision_guidance: Optional guidance from previous critique

        Returns:
            Validated LessonOutline object
        """
        logger.info("📋 Generating lesson outline (structured output)...")

        # Load the outline author prompt
        base_prompt = self._load_prompt("outline_author_prompt")

        # Build task-specific prompt
        revision_section = ""
        if revision_guidance:
            guidance_list = "\n".join(f"- {g}" for g in revision_guidance)
            revision_section = f"""

## Revision Required
Previous version failed validation. Apply these corrections:
{guidance_list}
"""

        task_prompt = f"""{base_prompt}

---
## YOUR TASK FOR THIS EXECUTION

**Course Information:**
- Subject: {subject}
- Level: {level}

**Required Files (in workspace):**
- Course outcomes: /workspace/Course_outcomes.json (already populated)
{revision_section}
Generate the lesson outline now. Read Course_outcomes.json first, then create the LessonOutline.
"""

        # Configure options with structured output (following working example pattern)
        # NOTE: MCP servers removed due to SDK transport bug - validation via Pydantic after generation
        # Use minimal schema (no descriptions, no $defs) for better structured_output extraction
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            permission_mode='bypassPermissions',
            allowed_tools=[
                'Read', 'Write', 'Glob', 'WebSearch', 'WebFetch'
            ],
            max_turns=50,
            cwd=str(workspace_path),
            output_format={
                "type": "json_schema",
                "schema": LESSON_OUTLINE_SCHEMA  # Minimal schema (904 chars vs 5,028)
            }
        )

        # Use query() directly (like working example)
        # IMPORTANT: Must consume all messages to avoid async cleanup issues with sequential queries
        result = None
        async for message in query(prompt=task_prompt, options=options):
            # Log all messages for observability
            log_sdk_message(message, phase="outline")

            # Check for structured output (capture but don't return early)
            if hasattr(message, 'structured_output') and message.structured_output:
                unwrapped = _unwrap_structured_output(message.structured_output)
                result = LessonOutline.model_validate(unwrapped)
                logger.info(f"✅ Outline generated (via structured_output): {result.total_lessons} lessons")
                # Don't return early - let generator complete
            elif result is None:
                # Try to extract from ToolUseBlock (SDK workaround for wrapped output)
                extracted = _extract_structured_output_from_message(message)
                if extracted:
                    result = LessonOutline.model_validate(extracted)
                    logger.info(f"✅ Outline generated (via ToolUseBlock): {result.total_lessons} lessons")

        if result is None:
            raise ValueError("Outline generation failed: No structured output received")
        return result

    async def _critique_outline(
        self,
        workspace_path: Path,
        outline: LessonOutline
    ) -> OutlineCriticResult:
        """Critique the outline using native structured output.

        Uses query() directly (no subagents) following the working SDK pattern.

        Args:
            workspace_path: Path to isolated workspace
            outline: The outline to critique

        Returns:
            OutlineCriticResult with verdict and guidance
        """
        logger.info("🔍 Critiquing outline...")

        # Write outline for critic to read
        outline_path = workspace_path / "lesson_outline.json"
        outline_path.write_text(outline.model_dump_json(indent=2))

        # Load the critic prompt
        base_prompt = self._load_prompt("outline_critic_prompt")

        task_prompt = f"""{base_prompt}

---
## YOUR TASK FOR THIS EXECUTION

**Required Files (in workspace):**
- Course outcomes: /workspace/Course_outcomes.json
- Lesson outline: /workspace/lesson_outline.json

Evaluate the outline now. Read both files, then provide the OutlineCriticResult.
"""

        # Use minimal schema (no descriptions, no $defs) for better structured_output extraction
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            permission_mode='bypassPermissions',
            allowed_tools=['Read', 'Glob'],
            max_turns=30,
            cwd=str(workspace_path),
            output_format={
                "type": "json_schema",
                "schema": OUTLINE_CRITIC_RESULT_SCHEMA  # Minimal schema (1,375 chars vs 3,824)
            }
        )

        # Use query() directly
        # IMPORTANT: Must consume all messages to avoid async cleanup issues with sequential queries
        critique_result = None
        async for message in query(prompt=task_prompt, options=options):
            log_sdk_message(message, phase="outline_critic")

            if hasattr(message, 'structured_output') and message.structured_output:
                unwrapped = _unwrap_structured_output(message.structured_output)
                critique_result = OutlineCriticResult.model_validate(unwrapped)
                logger.info(f"📊 Outline critique (via structured_output): {critique_result.verdict} (score: {critique_result.overall_score:.2f})")
                # Don't return early - let generator complete
            elif critique_result is None:
                # Try to extract from ToolUseBlock (SDK workaround for wrapped output)
                extracted = _extract_structured_output_from_message(message)
                if extracted:
                    critique_result = OutlineCriticResult.model_validate(extracted)
                    logger.info(f"📊 Outline critique (via ToolUseBlock): {critique_result.verdict} (score: {critique_result.overall_score:.2f})")

        if critique_result is None:
            raise ValueError("Outline critique failed: No structured output received")
        return critique_result

    async def _generate_outline_with_critique_loop(
        self,
        workspace_path: Path,
        subject: str,
        level: str
    ) -> LessonOutline:
        """Generate outline with critic validation loop.

        Attempts to generate a passing outline, retrying with revision guidance
        if the critic returns REVISION_REQUIRED.

        Args:
            workspace_path: Path to isolated workspace
            subject: Course subject identifier
            level: Course level identifier

        Returns:
            Validated LessonOutline that passed critique

        Raises:
            ValueError: If max revision attempts exceeded
        """
        revision_guidance = None

        for attempt in range(1, MAX_REVISION_ATTEMPTS + 1):
            logger.info(f"📋 Outline generation attempt {attempt}/{MAX_REVISION_ATTEMPTS}")

            # Generate outline
            outline = await self._generate_outline_structured(
                workspace_path, subject, level, revision_guidance
            )

            # Critique outline
            critique = await self._critique_outline(workspace_path, outline)

            if critique.verdict == "PASS":
                logger.info(f"✅ Outline PASSED on attempt {attempt}")
                return outline

            # REVISION_REQUIRED - prepare for next attempt
            logger.warning(f"⚠️ Outline needs revision (score: {critique.overall_score:.2f})")
            logger.warning(f"   Issues: {critique.summary}")
            revision_guidance = critique.revision_guidance

        raise ValueError(
            f"Outline failed after {MAX_REVISION_ATTEMPTS} attempts. "
            f"Last critique: {critique.summary}"
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # Lesson Generation & Critique
    # ═══════════════════════════════════════════════════════════════════════════

    async def _generate_lesson_structured(
        self,
        workspace_path: Path,
        order: int,
        outline_entry: Dict[str, Any],
        previous_lessons: List[Dict[str, Any]],
        subject: str,
        level: str,
        revision_guidance: Optional[List[str]] = None
    ) -> SOWEntry:
        """Generate single lesson using native structured output.

        Uses query() directly (no subagents) following the working SDK pattern.

        Args:
            workspace_path: Path to isolated workspace
            order: Lesson order number (1-based)
            outline_entry: Outline entry for this lesson
            previous_lessons: List of previously generated lessons
            subject: Course subject identifier
            level: Course level identifier
            revision_guidance: Optional guidance from previous critique

        Returns:
            Validated SOWEntry object
        """
        logger.info(f"📝 Generating lesson {order}: {outline_entry.get('label_hint', 'Unknown')}")

        # Write context files for agent
        (workspace_path / "current_outline.json").write_text(
            json.dumps(outline_entry, indent=2)
        )
        (workspace_path / "previous_lessons.json").write_text(
            json.dumps(previous_lessons, indent=2)
        )

        # Load the lesson author prompt
        base_prompt = self._load_prompt("lesson_entry_prompt")

        # Build revision section
        revision_section = ""
        if revision_guidance:
            guidance_list = "\n".join(f"- {g}" for g in revision_guidance)
            revision_section = f"""

## Revision Required
Previous version failed validation. Apply these corrections:
{guidance_list}
"""

        task_prompt = f"""{base_prompt}

---
## YOUR TASK FOR THIS EXECUTION

**Course Information:**
- Subject: {subject}
- Level: {level}
- Lesson Order: {order}

**Required Files (in workspace):**
- Course outcomes: /workspace/Course_outcomes.json
- Current outline entry: /workspace/current_outline.json
- Previous lessons (for context): /workspace/previous_lessons.json
{revision_section}
Generate lesson {order} now. Read all context files, then create the SOWEntry.
"""

        # Configure options with structured output
        # NOTE: MCP servers removed due to SDK transport bug - validation via Pydantic after generation
        # Use minimal schema (no descriptions, no $defs) for better structured_output extraction
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            permission_mode='bypassPermissions',
            allowed_tools=[
                'Read', 'Glob', 'WebSearch', 'WebFetch'
            ],
            max_turns=50,
            cwd=str(workspace_path),
            output_format={
                "type": "json_schema",
                "schema": SOW_ENTRY_SCHEMA  # Minimal schema (3,545 chars vs 12,060)
            }
        )

        # Use query() directly
        # IMPORTANT: Must consume all messages to avoid async cleanup issues with sequential queries
        entry = None
        async for message in query(prompt=task_prompt, options=options):
            log_sdk_message(message, phase=f"lesson_{order}")

            if hasattr(message, 'structured_output') and message.structured_output:
                unwrapped = _unwrap_structured_output(message.structured_output)
                entry = SOWEntry.model_validate(unwrapped)
                logger.info(f"✅ Lesson {order} generated (via structured_output): {entry.label}")
                # Don't return early - let generator complete
            elif entry is None:
                # Try to extract from ToolUseBlock (SDK workaround for wrapped output)
                extracted = _extract_structured_output_from_message(message)
                if extracted:
                    entry = SOWEntry.model_validate(extracted)
                    logger.info(f"✅ Lesson {order} generated (via ToolUseBlock): {entry.label}")

        if entry is None:
            raise ValueError(f"Lesson {order} generation failed: No structured output received")
        return entry

    async def _critique_lesson(
        self,
        workspace_path: Path,
        lesson: SOWEntry,
        order: int
    ) -> LessonCriticResult:
        """Critique the lesson using native structured output.

        Uses query() directly (no subagents) following the working SDK pattern.

        Args:
            workspace_path: Path to isolated workspace
            lesson: The lesson to critique
            order: Lesson order number

        Returns:
            LessonCriticResult with verdict and guidance
        """
        logger.info(f"🔍 Critiquing lesson {order}...")

        # Write lesson for critic to read
        lesson_path = workspace_path / f"lesson_{order:02d}.json"
        lesson_path.write_text(lesson.model_dump_json(indent=2))

        # Load the critic prompt
        base_prompt = self._load_prompt("lesson_critic_prompt")

        task_prompt = f"""{base_prompt}

---
## YOUR TASK FOR THIS EXECUTION

**Lesson Order:** {order}

**Required Files (in workspace):**
- Course outcomes: /workspace/Course_outcomes.json
- Lesson outline: /workspace/lesson_outline.json
- Lesson to critique: /workspace/lesson_{order:02d}.json

Evaluate lesson {order} now. Read all files, then provide the LessonCriticResult.
"""

        # Use minimal schema (no descriptions, no $defs) for better structured_output extraction
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            permission_mode='bypassPermissions',
            allowed_tools=['Read', 'Glob'],
            max_turns=30,
            cwd=str(workspace_path),
            output_format={
                "type": "json_schema",
                "schema": LESSON_CRITIC_RESULT_SCHEMA  # Minimal schema (1,385 chars vs 4,088)
            }
        )

        # Use query() directly
        # IMPORTANT: Must consume all messages to avoid async cleanup issues with sequential queries
        critique_result = None
        async for message in query(prompt=task_prompt, options=options):
            log_sdk_message(message, phase=f"lesson_{order}_critic")

            if hasattr(message, 'structured_output') and message.structured_output:
                unwrapped = _unwrap_structured_output(message.structured_output)
                # Inject lesson_order since we know it (not in minimal schema)
                unwrapped['lesson_order'] = order
                critique_result = LessonCriticResult.model_validate(unwrapped)
                logger.info(
                    f"📊 Lesson {order} critique (via structured_output): {critique_result.verdict} "
                    f"(score: {critique_result.overall_score:.2f})"
                )
                # Don't return early - let generator complete
            elif critique_result is None:
                # Try to extract from ToolUseBlock (SDK workaround for wrapped output)
                extracted = _extract_structured_output_from_message(message)
                if extracted:
                    # Inject lesson_order since we know it (not in minimal schema)
                    extracted['lesson_order'] = order
                    critique_result = LessonCriticResult.model_validate(extracted)
                    logger.info(
                        f"📊 Lesson {order} critique (via ToolUseBlock): {critique_result.verdict} "
                        f"(score: {critique_result.overall_score:.2f})"
                    )

        if critique_result is None:
            raise ValueError(f"Lesson {order} critique failed: No structured output received")
        return critique_result

    async def _generate_lesson_with_critique_loop(
        self,
        workspace_path: Path,
        order: int,
        outline_entry: Dict[str, Any],
        previous_lessons: List[Dict[str, Any]],
        subject: str,
        level: str
    ) -> SOWEntry:
        """Generate lesson with fail-fast schema validation and critic validation loop.

        Implements a two-stage validation approach:
        1. **Schema validation (fail-fast)**: Pydantic validates structure before critic
           - If schema fails, errors are fed directly to author for revision
           - No critic involvement for schema issues (deterministic validation)
        2. **Critic validation**: Pedagogical quality assessment (if schema passes)
           - Critic evaluates content quality across 5 dimensions
           - REVISION_REQUIRED triggers author revision with critic guidance

        Args:
            workspace_path: Path to isolated workspace
            order: Lesson order number (1-based)
            outline_entry: Outline entry for this lesson
            previous_lessons: List of previously generated lessons
            subject: Course subject identifier
            level: Course level identifier

        Returns:
            Validated SOWEntry that passed both schema and critic validation

        Raises:
            ValueError: If max revision attempts exceeded
        """
        revision_guidance = None
        schema_errors = None

        for attempt in range(1, MAX_REVISION_ATTEMPTS + 1):
            logger.info(f"📝 Lesson {order} generation attempt {attempt}/{MAX_REVISION_ATTEMPTS}")

            # Build combined revision guidance (schema errors take priority)
            combined_guidance = []
            if schema_errors:
                combined_guidance.append(f"SCHEMA VALIDATION FAILED - Fix these issues:\n{schema_errors}")
            if revision_guidance:
                combined_guidance.extend(revision_guidance)

            try:
                # Generate lesson (includes Pydantic validation)
                lesson = await self._generate_lesson_structured(
                    workspace_path, order, outline_entry, previous_lessons,
                    subject, level, combined_guidance if combined_guidance else None
                )
                # Schema validation passed (Pydantic validated in _generate_lesson_structured)
                schema_errors = None
            except ValidationError as e:
                # Schema validation failed - feed errors back to author (fail-fast)
                error_messages = []
                for error in e.errors():
                    loc = " -> ".join(str(x) for x in error['loc'])
                    error_messages.append(f"- {loc}: {error['msg']}")
                schema_errors = "\n".join(error_messages)
                logger.warning(f"⚠️ Lesson {order} schema validation failed:\n{schema_errors}")
                continue  # Retry without going to critic

            # Schema passed - now critique for pedagogical quality
            critique = await self._critique_lesson(workspace_path, lesson, order)

            if critique.verdict == "PASS":
                logger.info(f"✅ Lesson {order} PASSED on attempt {attempt}")
                return lesson

            # REVISION_REQUIRED from critic - prepare for next attempt
            logger.warning(f"⚠️ Lesson {order} needs revision (score: {critique.overall_score:.2f})")
            logger.warning(f"   Issues: {critique.summary}")
            revision_guidance = critique.revision_guidance

        # Provide appropriate error message based on failure type
        if schema_errors:
            raise ValueError(
                f"Lesson {order} failed schema validation after {MAX_REVISION_ATTEMPTS} attempts. "
                f"Schema errors:\n{schema_errors}"
            )
        else:
            raise ValueError(
                f"Lesson {order} failed after {MAX_REVISION_ATTEMPTS} attempts. "
                f"Last critique: {critique.summary}"
            )

    # ═══════════════════════════════════════════════════════════════════════════
    # Metadata Generation
    # ═══════════════════════════════════════════════════════════════════════════

    async def _generate_metadata_structured(
        self,
        workspace_path: Path,
        all_lessons: List[SOWEntry],
        subject: str,
        level: str
    ) -> Metadata:
        """Generate course metadata using native structured output.

        Uses query() directly (no subagents) following the working SDK pattern.

        Args:
            workspace_path: Path to isolated workspace
            all_lessons: List of all generated lesson entries
            subject: Course subject identifier
            level: Course level identifier

        Returns:
            Validated Metadata object
        """
        logger.info("📊 Generating course metadata (structured output)...")

        # Write all lessons for agent context
        all_lessons_dict = [lesson.model_dump() for lesson in all_lessons]
        (workspace_path / "all_lessons.json").write_text(
            json.dumps(all_lessons_dict, indent=2)
        )

        # Load the metadata author prompt
        base_prompt = self._load_prompt("metadata_author_prompt")

        task_prompt = f"""{base_prompt}

---
## YOUR TASK FOR THIS EXECUTION

**Course Information:**
- Subject: {subject}
- Level: {level}
- Total lessons: {len(all_lessons)}

**Required Files (in workspace):**
- Course outcomes: /workspace/Course_outcomes.json
- All lessons: /workspace/all_lessons.json

Generate the course metadata now. Read context files, then provide the Metadata.
"""

        # Configure options with structured output
        # NOTE: MCP servers removed due to SDK transport bug - validation via Pydantic after generation
        # Use minimal schema (no descriptions, no $defs) for better structured_output extraction
        options = ClaudeAgentOptions(
            model='claude-sonnet-4-5',
            permission_mode='bypassPermissions',
            allowed_tools=['Read', 'Glob'],
            max_turns=30,
            cwd=str(workspace_path),
            output_format={
                "type": "json_schema",
                "schema": METADATA_SCHEMA  # Minimal schema (545 chars vs 1,155)
            }
        )

        # Use query() directly
        # IMPORTANT: Must consume all messages to avoid async cleanup issues with sequential queries
        metadata = None
        async for message in query(prompt=task_prompt, options=options):
            log_sdk_message(message, phase="metadata")

            if hasattr(message, 'structured_output') and message.structured_output:
                unwrapped = _unwrap_structured_output(message.structured_output)
                metadata = Metadata.model_validate(unwrapped)
                logger.info("✅ Metadata generated (via structured_output)")
                # Don't return early - let generator complete
            elif metadata is None:
                # Try to extract from ToolUseBlock (SDK workaround for wrapped output)
                extracted = _extract_structured_output_from_message(message)
                if extracted:
                    metadata = Metadata.model_validate(extracted)
                    logger.info("✅ Metadata generated (via ToolUseBlock)")

        if metadata is None:
            raise ValueError("Metadata generation failed: No structured output received")
        return metadata

    # ═══════════════════════════════════════════════════════════════════════════
    # Test Helpers
    # ═══════════════════════════════════════════════════════════════════════════

    async def _test_phase1_outline_only(
        self,
        courseId: str
    ) -> Dict[str, Any]:
        """Test helper: Execute Phase 1 (outline generation with critique) only.

        Args:
            courseId: Course identifier (e.g., 'course_c84476')

        Returns:
            Dictionary with outline, workspace paths, and critique results
        """
        is_valid, error_msg = validate_input_schema({"courseId": courseId})
        if not is_valid:
            raise ValueError(error_msg)

        logger.info(f"🧪 TEST: Phase 1 Outline Generation - courseId='{courseId}'")

        from .utils.appwrite_mcp import list_appwrite_documents

        course_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="courses",
            queries=[f'equal("courseId", "{courseId}")'],
            mcp_config_path=str(self.mcp_config_path)
        )

        if not course_docs or len(course_docs) == 0:
            raise ValueError(f"Course not found: courseId='{courseId}'")

        course_doc = course_docs[0]
        subject = course_doc.get('subject')
        level = course_doc.get('level')

        if not subject or not level:
            raise ValueError(f"Course '{courseId}' missing subject or level")

        logger.info(f"Course: {subject} ({level})")

        with IsolatedFilesystem(
            self.execution_id,
            persist=True,
            workspace_type="test_phase1_outline"
        ) as filesystem:
            workspace_path = filesystem.root
            logger.info(f"📁 Test Workspace: {workspace_path}")

            # Set up workspace file logging for observability
            log_file_path = add_workspace_file_handler(
                workspace_path=workspace_path,
                log_filename="run.log",
                log_level="DEBUG"
            )
            logger.info(f"📝 Logs redirected to: {log_file_path}")

            # Extract Course_outcomes.json
            from .utils.course_outcomes_extractor import extract_course_outcomes_to_file

            course_outcomes_path = workspace_path / "Course_outcomes.json"
            extraction_result = await extract_course_outcomes_to_file(
                courseId=courseId,
                mcp_config_path=str(self.mcp_config_path),
                output_path=course_outcomes_path
            )

            structure_type = extraction_result.get("structure_type", "unit_based")
            logger.info(f"✅ Course_outcomes.json ready (structure_type={structure_type})")

            # Generate outline with critique loop
            outline = await self._generate_outline_with_critique_loop(
                workspace_path, subject, level
            )

            # Persist final outline
            outline_path = workspace_path / "lesson_outline.json"
            outline_path.write_text(outline.model_dump_json(indent=2))

            return {
                "outline": outline.model_dump(),
                "workspace_path": str(workspace_path),
                "course_outcomes_path": str(course_outcomes_path),
                "outline_path": str(outline_path),
                "structure_type": structure_type,
                "subject": subject,
                "level": level,
                "total_lessons": outline.total_lessons
            }

    # ═══════════════════════════════════════════════════════════════════════════
    # Main Execution
    # ═══════════════════════════════════════════════════════════════════════════

    async def execute(
        self,
        courseId: str,
        version: str = "1",
        force: bool = False
    ) -> Dict[str, Any]:
        """Execute the iterative SOW authoring pipeline with critic loops.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            version: SOW version number (default: "1")
            force: If True, overwrite existing SOW for this version

        Returns:
            Dictionary with execution results
        """
        is_valid, error_msg = validate_input_schema({"courseId": courseId})
        if not is_valid:
            logger.error(f"Input validation failed: {error_msg}")
            raise ValueError(error_msg)

        if not version.isdigit():
            raise ValueError(f"Version must be numeric string, got: '{version}'")

        logger.info(f"🚀 Iterative SOW Pipeline: courseId='{courseId}', version='{version}'")

        from .utils.appwrite_mcp import list_appwrite_documents

        course_docs = await list_appwrite_documents(
            database_id="default",
            collection_id="courses",
            queries=[f'equal("courseId", "{courseId}")'],
            mcp_config_path=str(self.mcp_config_path)
        )

        if not course_docs or len(course_docs) == 0:
            raise ValueError(f"Course not found: courseId='{courseId}'")

        course_doc = course_docs[0]
        subject = course_doc.get('subject')
        level = course_doc.get('level')

        if not subject or not level:
            raise ValueError(f"Course '{courseId}' missing subject or level")

        logger.info(f"Course: {subject} ({level})")

        # Check for existing SOW
        existing_sows = await list_appwrite_documents(
            database_id="default",
            collection_id="Authored_SOW",
            queries=[
                f'equal("courseId", "{courseId}")',
                f'equal("version", "{version}")'
            ],
            mcp_config_path=str(self.mcp_config_path)
        )

        existing_sow_id = None
        if existing_sows and len(existing_sows) > 0:
            if not force:
                raise ValueError(
                    f"SOW version {version} already exists for courseId '{courseId}'. "
                    f"Use --force to overwrite."
                )
            existing_sow_id = existing_sows[0]['$id']
            logger.warning(f"FORCE MODE: Will overwrite SOW {existing_sow_id}")

        try:
            with IsolatedFilesystem(
                self.execution_id,
                persist=self.persist_workspace,
                workspace_type="iterative_sow_author"
            ) as filesystem:
                workspace_path = filesystem.root
                logger.info(f"📁 Workspace: {workspace_path}")

                log_file_path = add_workspace_file_handler(
                    workspace_path=workspace_path,
                    log_filename="run.log",
                    log_level="DEBUG"
                )
                logger.info(f"📝 Log file: {log_file_path}")

                # ═══════════════════════════════════════════════════════════════
                # Phase 1: Extract Course_outcomes.json
                # ═══════════════════════════════════════════════════════════════
                logger.info("📥 Phase 1: Extracting Course_outcomes.json...")

                from .utils.course_outcomes_extractor import extract_course_outcomes_to_file

                course_outcomes_path = workspace_path / "Course_outcomes.json"
                extraction_result = await extract_course_outcomes_to_file(
                    courseId=courseId,
                    mcp_config_path=str(self.mcp_config_path),
                    output_path=course_outcomes_path
                )

                structure_type = extraction_result.get("structure_type", "unit_based")
                logger.info(f"✅ Course_outcomes.json ready (structure_type={structure_type})")

                # ═══════════════════════════════════════════════════════════════
                # Phase 2: Generate Outline with Critique Loop
                # ═══════════════════════════════════════════════════════════════
                logger.info("📋 Phase 2: Generating outline with critique loop...")

                outline = await self._generate_outline_with_critique_loop(
                    workspace_path, subject, level
                )

                # Persist approved outline
                outline_path = workspace_path / "lesson_outline.json"
                outline_path.write_text(outline.model_dump_json(indent=2))

                total_lessons = outline.total_lessons
                logger.info(f"✅ Outline approved: {total_lessons} lessons")

                # ═══════════════════════════════════════════════════════════════
                # Phase 3: Generate Lessons with Critique Loops
                # ═══════════════════════════════════════════════════════════════
                logger.info(f"📚 Phase 3: Generating {total_lessons} lessons with critique loops...")

                generated_lessons: List[SOWEntry] = []

                for i, outline_entry in enumerate(outline.outlines):
                    lesson = await self._generate_lesson_with_critique_loop(
                        workspace_path=workspace_path,
                        order=i + 1,
                        outline_entry=outline_entry.model_dump(),
                        previous_lessons=[l.model_dump() for l in generated_lessons],
                        subject=subject,
                        level=level
                    )
                    generated_lessons.append(lesson)

                    # Persist each approved lesson
                    lesson_path = workspace_path / f"lesson_{i + 1:02d}.json"
                    lesson_path.write_text(lesson.model_dump_json(indent=2))

                    logger.info(f"✅ Lesson {i + 1}/{total_lessons} approved")

                logger.info(f"✅ All {total_lessons} lessons approved")

                # ═══════════════════════════════════════════════════════════════
                # Phase 4: Generate Metadata
                # ═══════════════════════════════════════════════════════════════
                logger.info("📊 Phase 4: Generating metadata...")

                metadata = await self._generate_metadata_structured(
                    workspace_path, generated_lessons, subject, level
                )

                # Persist metadata
                metadata_path = workspace_path / "metadata.json"
                metadata_path.write_text(metadata.model_dump_json(indent=2))

                logger.info("✅ Metadata generated")

                # ═══════════════════════════════════════════════════════════════
                # Phase 5: Assemble Final SOW
                # ═══════════════════════════════════════════════════════════════
                logger.info("🔧 Phase 5: Assembling final SOW...")

                from .utils.sow_assembler import assemble_sow

                final_sow = assemble_sow(
                    lessons=[l.model_dump() for l in generated_lessons],
                    metadata=metadata.model_dump(),
                    courseId=courseId,
                    version=version
                )

                sow_path = workspace_path / "authored_sow.json"
                sow_path.write_text(json.dumps(final_sow, indent=2))

                logger.info(f"✅ SOW assembled: {len(generated_lessons)} entries")

                # ═══════════════════════════════════════════════════════════════
                # Phase 6: Upsert to Appwrite
                # ═══════════════════════════════════════════════════════════════
                logger.info("📤 Phase 6: Upserting to Appwrite...")

                from .utils.sow_upserter import upsert_sow_to_appwrite

                appwrite_document_id = await upsert_sow_to_appwrite(
                    sow_file_path=str(sow_path),
                    subject=subject,
                    level=level,
                    course_id=courseId,
                    version=version,
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path),
                    existing_sow_id=existing_sow_id
                )

                logger.info(f"✅ SOW upserted: {appwrite_document_id}")

                metrics_report = format_cost_report(self.cost_tracker)
                logger.info("\n" + metrics_report)

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "log_file": str(log_file_path),
                    "appwrite_document_id": appwrite_document_id,
                    "metrics": {
                        **self.cost_tracker.get_summary(),
                        "total_lessons": total_lessons
                    }
                }

        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            return {
                "success": False,
                "execution_id": self.execution_id,
                "error": str(e),
                "metrics": self.cost_tracker.get_summary()
            }


async def main():
    """CLI entry point for Iterative SOW Author."""
    import argparse

    parser = argparse.ArgumentParser(description="Iterative SOW Author")
    parser.add_argument(
        "--course-id",
        required=True,
        help="Course ID (e.g., 'course_c84476')"
    )
    parser.add_argument(
        "--phase",
        choices=["outline", "lessons", "metadata", "full"],
        default="full",
        help="Which phase to run (default: full)"
    )
    parser.add_argument(
        "--version",
        default="1",
        help="SOW version (default: '1')"
    )
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Log level (default: INFO)"
    )

    args = parser.parse_args()

    agent = IterativeSOWAuthor(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level=args.log_level
    )

    # Run the specified phase
    if args.phase == "outline":
        result = await agent._test_phase1_outline_only(args.course_id)
        if result.get("outline"):
            print(f"✅ Phase 1 completed: {result['outline']['total_lessons']} lessons")
            print(f"   Workspace: {result['workspace_path']}")
            print(f"   Critic Score: {result.get('critic_score', 'N/A')}")
        else:
            print(f"❌ Phase 1 failed: {result.get('error', 'Unknown error')}")
    else:
        result = await agent.execute(courseId=args.course_id, version=args.version)

        if result["success"]:
            print(f"✅ SOW authored successfully!")
            print(f"   Execution ID: {result['execution_id']}")
            print(f"   Workspace: {result['workspace_path']}")
            print(f"   Document ID: {result['appwrite_document_id']}")
            print(f"   Total Lessons: {result['metrics']['total_lessons']}")
        else:
            print(f"❌ SOW authoring failed: {result['error']}")


if __name__ == "__main__":
    asyncio.run(main())
