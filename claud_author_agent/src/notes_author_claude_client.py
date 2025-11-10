"""Main Revision Notes Author Claude Agent implementation.

Orchestrates single-subagent pipeline to generate course cheat sheets and per-lesson
revision notes from published SOW and lesson templates.
"""

import asyncio
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging
from .utils.notes_data_extractor import extract_all_course_data
from .utils.notes_storage_upserter import upsert_all_revision_notes
from .utils.notes_validators import (
    validate_course_exists,
    validate_published_sow_exists,
    validate_output_files,
    check_duplicate_notes
)
from .tools.json_validator_tool import validation_server

logger = logging.getLogger(__name__)


class NotesAuthorClaudeClient:
    """Autonomous revision notes authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    1. Extract SOW, lessons, outcomes, diagrams → workspace files (Python utility)

    Pipeline execution (1 subagent):
    2. Notes Author Subagent → Generates cheat sheet + per-lesson notes

    Post-processing (Python):
    3. Upload markdown to Storage → Create revision_notes documents (Python utility)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across subagent execution

    Architecture Notes:
        - Data extraction moved to Python (no LLM needed, saves tokens)
        - Upload/upsert kept as Python (deterministic, no LLM needed)
        - Only markdown generation uses LLM agent (creative task)
        - Subagent gets NO Appwrite MCP access (works with workspace files only)
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = False,
        log_level: str = "INFO"
    ):
        """Initialize Notes Author agent.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace

        # Generate execution ID (timestamp-based)
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging
        setup_logging(log_level=log_level)

        logger.info(f"Initialized NotesAuthorClaudeClient - Execution ID: {self.execution_id}")

    def _get_subagent_definition(self) -> AgentDefinition:
        """Load notes_author subagent definition with prompt.

        Returns:
            AgentDefinition for notes_author subagent

        Raises:
            FileNotFoundError: If prompt file is missing
        """
        prompts_dir = Path(__file__).parent / "prompts"
        prompt_file = prompts_dir / "notes_author_prompt.md"

        if not prompt_file.exists():
            raise FileNotFoundError(
                f"Notes author prompt not found: {prompt_file}. "
                f"Ensure prompt file exists in {prompts_dir}."
            )

        subagent = AgentDefinition(
            description="Notes author for creating revision materials with pedagogical note-taking methods",
            prompt=prompt_file.read_text()
        )

        logger.info("Loaded notes_author subagent definition")
        return subagent

    async def _extract_data_to_workspace(
        self,
        course_id: str,
        workspace_path: Path
    ) -> Dict[str, Any]:
        """Extract all course data to workspace (pre-processing).

        Calls extract_all_course_data() which orchestrates all extraction functions.

        Args:
            course_id: Course ID to extract
            workspace_path: Path to workspace directory

        Returns:
            Extraction summary with lesson count, diagram count, etc.

        Raises:
            Various exceptions from extraction functions
        """
        logger.info("=" * 60)
        logger.info("PRE-PROCESSING: Extracting data to workspace")
        logger.info("=" * 60)

        extraction_summary = await extract_all_course_data(
            course_id=course_id,
            workspace_path=workspace_path,
            mcp_config_path=str(self.mcp_config_path)
        )

        logger.info("✅ Pre-processing complete - workspace ready")
        logger.info(f"   Lessons: {extraction_summary['lesson_count']}")
        logger.info(f"   Diagrams: {extraction_summary['diagram_count']}")
        logger.info(f"   Outcomes: {extraction_summary['outcome_count']}")
        logger.info("   Python extraction - no LLM tokens used")

        return extraction_summary

    def _build_initial_prompt(
        self,
        course_id: str,
        workspace_path: Path,
        extraction_summary: Dict[str, Any]
    ) -> str:
        """Build initial prompt for notes author subagent.

        Args:
            course_id: Course ID
            workspace_path: Path to workspace
            extraction_summary: Summary from extraction phase

        Returns:
            Initial prompt string
        """
        lesson_count = extraction_summary['lesson_count']
        diagram_count = extraction_summary['diagram_count']

        prompt = f"""# Revision Notes Generation Task

You are the notes_author subagent. Your workspace contains all necessary course data.

## Your Task

Generate revision notes for **{course_id}** with **{lesson_count} lessons**.

**Required outputs**:
1. `outputs/course_cheat_sheet.md` - Course-level summary (REQUIRED)
2. `outputs/lesson_notes_01.md` through `outputs/lesson_notes_{lesson_count:02d}.md` - Per-lesson notes (REQUIRED)

## Workspace Files Available

All data is in your workspace `inputs/` directory:
- `Authored_SOW.json` - Published SOW with {lesson_count} lesson entries
- `Course_data.txt` - SQA course standards
- `course_outcomes.json` - Learning outcomes details
- `lesson_templates/` - {lesson_count} lesson templates with decompressed cards
- `lesson_diagrams/` - {diagram_count} diagram metadata files

## Execution Instructions

1. **Read your subagent prompt** (notes_author_prompt.md) for full instructions
2. **Follow the pedagogical guidelines** (Cornell Method, spaced repetition)
3. **Use TodoWrite** to track your progress (highly recommended)
4. **Generate all required markdown files** in `outputs/` directory
5. **Perform quality checks** before finishing

## Important Reminders

- Use workspace FILES only (no web search for content - only for pedagogy validation)
- Preserve LaTeX math notation from lesson cards
- **CRITICAL**: Read ALL diagram JSON files from `lesson_diagrams/` directory using glob tool
- Match diagrams to lessons by comparing `lessonTemplateId` in diagram JSON with `$id` in lesson template JSON
- Embed diagrams using markdown image syntax: `![diagram_description](image_url)`
- Each diagram JSON contains pre-built `image_url` field - use it directly
- Word count targets: Cheat sheet 1500-2500 words, Lesson notes 300-600 words each

---

**Begin generating revision notes now!**
"""

        return prompt

    async def _upload_to_storage_and_database(
        self,
        workspace_path: Path,
        course_id: str,
        version: str,
        extraction_summary: Dict[str, Any],
        force: bool = False
    ) -> Dict[str, Any]:
        """Upload generated markdown files to Storage and database (post-processing).

        Args:
            workspace_path: Path to workspace
            course_id: Course ID
            version: SOW version
            extraction_summary: Summary from extraction phase
            force: Overwrite existing documents

        Returns:
            Upload results summary

        Raises:
            FileNotFoundError: If expected markdown files missing
            Exception: If uploads fail
        """
        logger.info("=" * 60)
        logger.info("POST-PROCESSING: Uploading to Storage and Database")
        logger.info("=" * 60)

        outputs_dir = workspace_path / "outputs"

        # Get token usage and cost from cost tracker
        total_cost = self.cost_tracker.total_cost
        total_tokens = self.cost_tracker.total_input_tokens + self.cost_tracker.total_output_tokens

        # Upload all notes
        upload_results = await upsert_all_revision_notes(
            outputs_dir=outputs_dir,
            course_id=course_id,
            lesson_count=extraction_summary['lesson_count'],
            version=version,
            execution_id=self.execution_id,
            mcp_config_path=str(self.mcp_config_path),
            force=force,
            sow_version=extraction_summary.get('sow_version'),
            token_usage=total_tokens,
            cost_usd=total_cost,
            workspace_path=str(workspace_path) if self.persist_workspace else None
        )

        logger.info("✅ Post-processing complete")
        logger.info(f"   Cheat sheet uploaded: {bool(upload_results['cheat_sheet'])}")
        logger.info(f"   Lesson notes uploaded: {len(upload_results['lesson_notes'])}/{extraction_summary['lesson_count']}")

        return upload_results

    async def execute(
        self,
        course_id: str,
        version: str = "1",
        force: bool = False
    ) -> Dict[str, Any]:
        """Execute the complete revision notes authoring pipeline.

        Args:
            course_id: Course identifier (e.g., 'course_c84874')
            version: SOW version (default: '1')
            force: Overwrite existing notes if True

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - cheat_sheet_id: str (if successful)
                - lesson_note_ids: list of str (if successful)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If course not found or no published SOW
            FileNotFoundError: If MCP config or prompts missing
        """
        start_time = time.time()

        # Initialize timing metrics
        timing_metrics = {
            "validation_time": 0,
            "pre_processing_time": 0,
            "agent_execution_time": 0,
            "post_processing_time": 0,
            "workspace_cleanup_time": 0
        }

        logger.info("🚀 Starting Revision Notes Author Agent")
        logger.info(f"   Course: {course_id}")
        logger.info(f"   Version: {version}")
        logger.info(f"   Force: {force}")
        logger.info(f"   Execution ID: {self.execution_id}")

        try:
            # ═══════════════════════════════════════════════════════════════
            # VALIDATION: Fail-fast checks
            # ═══════════════════════════════════════════════════════════════
            validation_start = time.time()

            logger.info("\n" + "=" * 60)
            logger.info("VALIDATION")
            logger.info("=" * 60)

            course_doc = await validate_course_exists(course_id, str(self.mcp_config_path))
            sow_doc = await validate_published_sow_exists(course_id, str(self.mcp_config_path))

            # Check for duplicate notes (T046)
            await check_duplicate_notes(
                course_id=course_id,
                version=version,
                mcp_config_path=str(self.mcp_config_path),
                force=force
            )

            timing_metrics["validation_time"] = time.time() - validation_start
            logger.info("✅ All validations passed")
            logger.info(f"   Validation time: {timing_metrics['validation_time']:.2f}s")

            # Create isolated workspace
            with IsolatedFilesystem(
                self.execution_id,
                persist=self.persist_workspace,
                workspace_type="notes_author"
            ) as filesystem:
                workspace_path = filesystem.root

                logger.info(f"\n📁 Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract all data to workspace (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                pre_processing_start = time.time()

                extraction_summary = await self._extract_data_to_workspace(
                    course_id=course_id,
                    workspace_path=workspace_path
                )

                # Create outputs directory for agent
                outputs_dir = workspace_path / "outputs"
                outputs_dir.mkdir(exist_ok=True)

                timing_metrics["pre_processing_time"] = time.time() - pre_processing_start
                logger.info(f"   Pre-processing time: {timing_metrics['pre_processing_time']:.2f}s")

                # ═══════════════════════════════════════════════════════════════
                # AGENT EXECUTION: Notes Author Subagent
                # ═══════════════════════════════════════════════════════════════
                agent_execution_start = time.time()

                logger.info("\n" + "=" * 60)
                logger.info("AGENT EXECUTION")
                logger.info("=" * 60)

                # Load MCP config (only validator, NO Appwrite MCP for subagent)
                mcp_servers_for_notes_author = {
                    "validator": validation_server  # For schema validation if needed
                    # Appwrite MCP intentionally excluded - not used by notes author
                }
                logger.info("Registered validator MCP tool (Appwrite MCP excluded - not needed)")

                # Configure Claude SDK client
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents={"notes_author": self._get_subagent_definition()},
                    permission_mode='bypassPermissions',  # Bypass all permission prompts
                    mcp_servers=mcp_servers_for_notes_author,
                    allowed_tools=[
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
                        'WebSearch', 'WebFetch',  # For pedagogy validation only
                        'mcp__validator__validate_lesson_template'  # If needed for validation
                    ],
                    max_turns=300,  # Sufficient for notes generation
                    cwd=str(workspace_path)
                )

                logger.info(f"Agent configured: bypassPermissions + cwd={workspace_path} + max_turns=300")

                # Configure SDK logger to display all agent interactions to stdout
                sdk_logger = logging.getLogger('claude_agent_sdk')
                sdk_logger.setLevel(logging.DEBUG)
                sdk_handler = logging.StreamHandler(sys.stdout)
                sdk_handler.setFormatter(logging.Formatter('%(message)s'))
                sdk_logger.addHandler(sdk_handler)
                logger.info("✅ Verbose SDK output enabled - agent interactions will stream to stdout")

                # Execute notes author subagent
                async with ClaudeSDKClient(options) as client:
                    # Build initial prompt
                    initial_prompt = self._build_initial_prompt(
                        course_id=course_id,
                        workspace_path=workspace_path,
                        extraction_summary=extraction_summary
                    )

                    logger.info("Invoking notes_author subagent...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream - logging ALL raw messages...")
                    message_count = 0
                    result: ResultMessage = None

                    # Process messages until agent completion
                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Agent has completed
                            result = message
                            logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                    # Calculate execution time
                    timing_metrics["agent_execution_time"] = time.time() - agent_execution_start
                    logger.info(f"✅ Notes author subagent completed")
                    logger.info(f"   Agent execution time: {timing_metrics['agent_execution_time']:.2f}s")

                    # Verify result message received
                    if not result:
                        raise Exception("Agent did not return a ResultMessage - execution may have failed")

                # ═══════════════════════════════════════════════════════════════
                # VALIDATION: Verify all output files exist (FAIL-FAST)
                # ═══════════════════════════════════════════════════════════════
                validate_output_files(
                    workspace_path=workspace_path,
                    lesson_count=extraction_summary['lesson_count']
                )

                # ═══════════════════════════════════════════════════════════════
                # POST-PROCESSING: Upload to Storage and Database (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                post_processing_start = time.time()

                upload_results = await self._upload_to_storage_and_database(
                    workspace_path=workspace_path,
                    course_id=course_id,
                    version=version,
                    extraction_summary=extraction_summary,
                    force=force
                )

                timing_metrics["post_processing_time"] = time.time() - post_processing_start
                logger.info(f"   Post-processing time: {timing_metrics['post_processing_time']:.2f}s")

                # Workspace cleanup timing (will be recorded when context manager exits)
                cleanup_start = time.time()

            # Context manager exit happens here - workspace cleanup if not persisting
            timing_metrics["workspace_cleanup_time"] = time.time() - cleanup_start

            # Calculate total execution time
            execution_time = time.time() - start_time

            # Generate cost report
            cost_report = self.cost_tracker.generate_report()

            logger.info("\n" + "=" * 60)
            logger.info("✅ REVISION NOTES AUTHORING COMPLETE")
            logger.info("=" * 60)
            logger.info(f"   Execution ID: {self.execution_id}")
            logger.info(f"   Execution time: {execution_time:.1f}s")
            logger.info("")
            logger.info("   Phase Timings:")
            logger.info(f"     Validation:        {timing_metrics['validation_time']:.2f}s")
            logger.info(f"     Pre-processing:    {timing_metrics['pre_processing_time']:.2f}s")
            logger.info(f"     Agent execution:   {timing_metrics['agent_execution_time']:.2f}s")
            logger.info(f"     Post-processing:   {timing_metrics['post_processing_time']:.2f}s")
            logger.info(f"     Workspace cleanup: {timing_metrics['workspace_cleanup_time']:.2f}s")
            logger.info("")
            logger.info(f"   Total cost: ${cost_report['total_cost']:.4f}")
            logger.info(f"   Total tokens: {cost_report['total_tokens']:,}")
            logger.info(f"   Cheat sheet ID: {upload_results.get('cheat_sheet', 'N/A')}")
            logger.info(f"   Lesson notes: {len(upload_results.get('lesson_notes', []))} uploaded")
            if self.persist_workspace:
                logger.info(f"   Workspace: {workspace_path}")
            logger.info("=" * 60)

            return {
                "success": upload_results.get('success', True),
                "execution_id": self.execution_id,
                "course_id": course_id,
                "sow_version": extraction_summary.get('sow_version', '1'),
                "lesson_count": extraction_summary['lesson_count'],
                "workspace_path": str(workspace_path),
                "cheat_sheet_doc_id": upload_results.get('cheat_sheet'),
                "lesson_note_doc_ids": upload_results.get('lesson_notes', []),
                "token_usage": cost_report['total_tokens'],
                "cost_usd": cost_report['total_cost'],
                "metrics": {
                    "execution_time": execution_time,
                    "total_cost": cost_report['total_cost'],
                    "total_tokens": cost_report['total_tokens'],
                    "agents": cost_report['agents'],
                    "timing": timing_metrics
                },
                "errors": upload_results.get('errors', [])
            }

        except Exception as e:
            execution_time = time.time() - start_time

            logger.error("=" * 60)
            logger.error(f"❌ REVISION NOTES AUTHORING FAILED")
            logger.error("=" * 60)
            logger.error(f"   Error: {str(e)}")
            logger.error(f"   Execution time: {execution_time:.1f}s")
            logger.error("=" * 60)

            return {
                "success": False,
                "execution_id": self.execution_id,
                "error": str(e),
                "metrics": {
                    "execution_time": execution_time,
                    "total_cost": self.cost_tracker.total_cost,
                    "total_tokens": self.cost_tracker.total_input_tokens + self.cost_tracker.total_output_tokens
                }
            }
