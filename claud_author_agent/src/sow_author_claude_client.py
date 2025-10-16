"""Main SOW Author Claude Agent implementation.

Orchestrates a 5-subagent pipeline to author complete Schemes of Work (SOW)
for Scottish secondary education from subject + level input to Appwrite database.
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.validation import validate_input_schema, format_subject_display, format_level_display
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging

logger = logging.getLogger(__name__)


class SOWAuthorClaudeAgent:
    """Autonomous SOW authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    0. Course Data Extractor → Creates Course_data.txt from Appwrite (Python utility)

    Pipeline execution (3 subagents):
    1. Research Subagent → Creates research_pack_json
    2. SOW Author → Creates authored_sow_json
    3. Unified Critic → Validates and creates sow_critic_result_json (with retry)

    Post-processing (Python):
    4. Upserter → Writes to Appwrite default.Authored_SOW (Python utility)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        max_critic_retries: Maximum attempts for critic validation loop
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents

    Architecture Notes:
        - Course data extraction moved to Python (no LLM needed, saves tokens)
        - Upserting kept as Python (deterministic, no LLM needed)
        - Only creative/judgmental tasks use LLM agents (research, authoring, critique)
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        max_critic_retries: int = 3,
        log_level: str = "INFO"
    ):
        """Initialize SOW Author agent.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            max_critic_retries: Maximum attempts for critic validation
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.max_critic_retries = max_critic_retries

        # Generate execution ID (timestamp-based)
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging
        setup_logging(log_level=log_level)

        logger.info(f"Initialized SOWAuthorClaudeAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Raises:
            FileNotFoundError: If prompt files are missing

        Note:
            Course data extraction is now handled by Python utility (no subagent).
            Pipeline reduced from 4 to 3 subagents.
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 3 subagent prompts (course_data_extractor removed - Python handles it)
        subagents = {
            "research_subagent": AgentDefinition(
                description="Research subagent for web research and data collection",
                prompt=(prompts_dir / "research_subagent_prompt.md").read_text()
            ),
            "sow_author": AgentDefinition(
                description="SOW author for creating complete schemes of work",
                prompt=(prompts_dir / "sow_author_prompt.md").read_text()
            ),
            "unified_critic": AgentDefinition(
                description="Unified critic for validating SOW quality",
                prompt=(prompts_dir / "unified_critic_prompt.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions")
        return subagents

    async def execute(
        self,
        subject: str,
        level: str,
        courseId: str
    ) -> Dict[str, Any]:
        """Execute the complete SOW authoring pipeline.

        Args:
            subject: SQA subject (e.g., 'mathematics', 'application-of-mathematics')
            level: SQA level (e.g., 'national-5', 'higher')
            courseId: Course identifier (e.g., 'course_c84874')

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - appwrite_document_id: str (if successful)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If input validation fails or course not found
            FileNotFoundError: If MCP config or prompts missing
        """
        # Validate input schema
        is_valid, error_msg = validate_input_schema({
            "subject": subject,
            "level": level,
            "courseId": courseId
        })
        if not is_valid:
            logger.error(f"Input validation failed: {error_msg}")
            raise ValueError(error_msg)

        # Validate course exists in database (FAIL FAST)
        logger.info(f"Validating courseId '{courseId}' exists in default.courses...")
        await self._validate_course_exists(subject, level, courseId)

        logger.info(f"Starting SOW authoring pipeline: {subject} ({level})")

        # Format display strings
        subject_display = format_subject_display(subject)
        level_display = format_level_display(level)

        try:
            # Create isolated workspace
            with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace) as filesystem:
                workspace_path = filesystem.root

                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract Course_data.txt using Python (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Extracting Course_data.txt via Python utility...")

                from .utils.course_data_extractor import extract_course_data_to_file

                course_data_path = workspace_path / "Course_data.txt"

                await extract_course_data_to_file(
                    subject=subject,
                    level=level,
                    mcp_config_path=str(self.mcp_config_path),
                    output_path=course_data_path
                )

                logger.info(f"✅ Course_data.txt ready at: {course_data_path}")
                logger.info("   Python extraction complete - no LLM tokens used")

                # Load MCP config as dict (not path string)
                mcp_config = {}
                if self.mcp_config_path.exists():
                    with open(self.mcp_config_path, 'r') as f:
                        mcp_config = json.load(f).get('mcpServers', {})
                    logger.info(f"Loaded MCP config with servers: {list(mcp_config.keys())}")

                # Configure Claude SDK client with permission_mode='bypassPermissions'
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',  # CRITICAL: Bypass all permission prompts
                    mcp_servers=mcp_config,  # Pass dict, not path
                    allowed_tools=['Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task', 'WebSearch', 'WebFetch']
                )

                logger.info(f"Agent configured with permission_mode='bypassPermissions' + WebSearch/WebFetch enabled")

                # Execute pipeline (now only 3 subagents: research, sow_author, critic)
                async with ClaudeSDKClient(options) as client:
                    # Initial prompt to orchestrate subagents
                    initial_prompt = self._build_initial_prompt(
                        subject=subject,
                        level=level,
                        courseId=courseId,
                        subject_display=subject_display,
                        level_display=level_display,
                        workspace_path=str(workspace_path)
                    )

                    logger.info("Sending initial prompt to Claude Agent SDK...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream - logging ALL raw messages...")
                    message_count = 0

                    # Process messages until agent completion (4 subagents)
                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Agent has completed 4 subagents
                            logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # Python-based upserting (deterministic, replaces Step 5)
                logger.info("Starting deterministic Python upserter...")

                from .utils.sow_upserter import upsert_sow_to_appwrite

                sow_file_path = workspace_path / "authored_sow_json"

                appwrite_document_id = await upsert_sow_to_appwrite(
                    sow_file_path=str(sow_file_path),
                    subject=subject,
                    level=level,
                    course_id=courseId,
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path)
                )

                logger.info(f"SOW upserted successfully: {appwrite_document_id}")

                # Generate final report
                metrics_report = format_cost_report(self.cost_tracker)
                logger.info("\n" + metrics_report)

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "appwrite_document_id": appwrite_document_id,
                    "metrics": self.cost_tracker.get_summary()
                }

        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}", exc_info=True)
            return {
                "success": False,
                "execution_id": self.execution_id,
                "error": str(e),
                "metrics": self.cost_tracker.get_summary()
            }

    async def _validate_course_exists(
        self,
        subject: str,
        level: str,
        courseId: str
    ) -> None:
        """Validate that course exists in default.courses with matching subject/level.

        Also validates that corresponding SQA course data exists in sqa_education.current_sqa.

        Args:
            subject: Expected SQA subject (e.g., 'application-of-mathematics')
            level: Expected SQA level (e.g., 'national-4')
            courseId: Course identifier to validate (e.g., 'course_c84474')

        Raises:
            ValueError: If course not found, subject/level mismatch, or SQA data missing
        """
        logger.info(f"🔍 Starting course validation for courseId='{courseId}'")

        # Validation 1: Check course exists in default.courses by courseId field
        try:
            from .utils.appwrite_mcp import list_appwrite_documents

            logger.info(f"  Step 1: Checking courseId field in default.courses...")
            course_docs = await list_appwrite_documents(
                database_id="default",
                collection_id="courses",
                queries=[f'equal("courseId", "{courseId}")'],
                mcp_config_path=str(self.mcp_config_path)
            )

            if not course_docs or len(course_docs) == 0:
                raise ValueError(
                    f"Course not found: No course with courseId='{courseId}' in default.courses collection. "
                    f"Please create the course first before authoring SOW."
                )

            course_doc = course_docs[0]  # Get first matching course

            logger.info(f"  ✓ Course document found: {courseId}")

            # Validate subject matches
            course_subject = course_doc.get('subject', '')
            if course_subject != subject:
                raise ValueError(
                    f"Subject mismatch: courseId '{courseId}' has subject='{course_subject}' "
                    f"but expected subject='{subject}'. Please check input parameters."
                )

            logger.info(f"  ✓ Subject matches: {subject}")

            # Validate level matches
            course_level = course_doc.get('level', '')
            if course_level != level:
                raise ValueError(
                    f"Level mismatch: courseId '{courseId}' has level='{course_level}' "
                    f"but expected level='{level}'. Please check input parameters."
                )

            logger.info(f"  ✓ Level matches: {level}")

        except ValueError:
            raise  # Re-raise validation errors
        except Exception as e:
            error_msg = (
                f"Failed to query default.courses for courseId '{courseId}': {str(e)}. "
                f"Check that Appwrite MCP server is configured and accessible."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        # Validation 2: Check SQA course data exists in sqa_education.sqa_current
        try:
            from .utils.appwrite_mcp import list_appwrite_documents

            logger.info(f"  Step 2: Checking SQA course data in sqa_education.sqa_current...")

            # Convert hyphenated format to underscore format for SQA collection
            # courses collection uses: application-of-mathematics, national-4
            # sqa_current uses: applications_of_mathematics, national_4
            sqa_subject = subject.replace("-", "_")
            # Note: SQA uses "applications" (plural) not "application"
            if sqa_subject == "application_of_mathematics":
                sqa_subject = "applications_of_mathematics"

            sqa_level = level.replace("-", "_")

            logger.info(f"  Querying with SQA format: subject='{sqa_subject}', level='{sqa_level}'")

            # Query with subject and level filters
            sqa_docs = await list_appwrite_documents(
                database_id="sqa_education",
                collection_id="sqa_current",
                queries=[
                    f'equal("subject", "{sqa_subject}")',
                    f'equal("level", "{sqa_level}")'
                ],
                mcp_config_path=str(self.mcp_config_path)
            )

            if not sqa_docs or len(sqa_docs) == 0:
                raise ValueError(
                    f"SQA course data not found: No documents in sqa_education.sqa_current "
                    f"for subject='{subject}', level='{level}'. "
                    f"Official SQA course data is required for SOW authoring."
                )

            logger.info(f"  ✓ SQA course data found: {len(sqa_docs)} document(s)")

        except ValueError:
            raise  # Re-raise validation errors
        except Exception as e:
            error_msg = (
                f"Failed to query sqa_education.sqa_current for subject='{subject}', level='{level}': {str(e)}. "
                f"Check that Appwrite MCP server is configured and accessible."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info(f"✅ Course validation complete: All checks passed for courseId '{courseId}'")

    def _build_initial_prompt(
        self,
        subject: str,
        level: str,
        courseId: str,
        subject_display: str,
        level_display: str,
        workspace_path: str
    ) -> str:
        """Build the initial orchestration prompt for the main agent.

        Args:
            subject: Subject slug
            level: Level slug
            courseId: Course identifier (pre-validated)
            subject_display: Display-friendly subject
            level_display: Display-friendly level
            workspace_path: Path to workspace

        Returns:
            Initial prompt string
        """
        return f"""# SOW Authoring Pipeline - Main Orchestrator

You are orchestrating the autonomous authoring of a Scheme of Work (SOW) for Scottish secondary education.

## Input Specification
- **Subject**: {subject} ({subject_display})
- **Level**: {level} ({level_display})
- **Course ID**: {courseId} (validated)

## Workspace
All files will be created in: {workspace_path}

## Pre-Processing (Complete)
✅ `Course_data.txt` has been pre-populated by Python extraction (no subagent needed)
   - Source: sqa_education.sqa_current collection
   - Extracted: Official SQA course structure, units, outcomes, assessment standards
   - Location: `/workspace/Course_data.txt`

## Pipeline Execution

Execute the following 3 subagents in sequence:

### 1. Research Subagent
- **Task**: Conduct web research and create research pack v3
- **Output**: `/workspace/research_pack_json`
- **Delegate to**: @research_subagent

### 2. SOW Author
- **Task**: Author complete SOW using inputs
- **Inputs**: `/workspace/Course_data.txt` (pre-populated), `/workspace/research_pack_json`
- **Output**: `/workspace/authored_sow_json`
- **Delegate to**: @sow_author
- **Note**: Course_data.txt already exists - extracted by orchestrator before agent execution

### 3. Unified Critic (with retry loop)
- **Task**: Validate SOW across 5 dimensions
- **Inputs**: All 3 files above
- **Output**: `/workspace/sow_critic_result_json`
- **Delegate to**: @unified_critic
- **Logic**:
  - If overall_pass = false and attempt < {self.max_critic_retries}:
    - Pass feedback to @sow_author for revision
    - Re-run @unified_critic
  - If overall_pass = true OR max attempts reached: proceed to completion

## Cost Tracking
After each subagent execution, use TodoWrite to log:
- Subagent name
- Token usage
- Estimated cost

## Final Output
When all 3 subagents complete successfully, report completion.
The authored SOW will be persisted to Appwrite by the orchestrating system.

Begin pipeline execution now.
"""


async def main():
    """Example usage of SOW Author agent."""
    agent = SOWAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        max_critic_retries=3,
        log_level="INFO"
    )

    result = await agent.execute(
        subject="mathematics",
        level="national-5",
        courseId="course_c84874"  # Must exist in default.courses
    )

    if result["success"]:
        print(f"✓ SOW authored successfully!")
        print(f"  Execution ID: {result['execution_id']}")
        print(f"  Workspace: {result['workspace_path']}")
        print(f"  Document ID: {result['appwrite_document_id']}")
        print(f"  Total Cost: ${result['metrics']['total_cost_usd']:.4f}")
    else:
        print(f"✗ SOW authoring failed: {result['error']}")


if __name__ == "__main__":
    asyncio.run(main())
