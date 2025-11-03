"""Main SOW Author Claude Agent implementation.

Orchestrates a 2-subagent pipeline to author complete Schemes of Work (SOW)
for Scottish secondary education from subject + level input to Appwrite database.
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.validation import validate_input_schema, format_subject_display, format_level_display
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging
from .tools.sow_validator_tool import sow_validation_server

logger = logging.getLogger(__name__)

# Set maximum output token limit for Claude Agent SDK (TOKEN BUDGET OPTIMIZATION)
# The agent pipeline can generate large SOWs with detailed pedagogical content.
# This env var ensures agents have sufficient output budget without hitting limits.
os.environ.setdefault('CLAUDE_CODE_MAX_OUTPUT_TOKENS', '100000')
logger.info("Set CLAUDE_CODE_MAX_OUTPUT_TOKENS=100000 (agent output budget)")


class SOWAuthorClaudeAgent:
    """Autonomous SOW authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    0. Course Data Extractor → Creates Course_data.txt from Appwrite (Python utility)

    Pipeline execution (2 subagents):
    1. SOW Author → Creates authored_sow_json (with on-demand WebSearch/WebFetch)
    2. Unified Critic → Validates and creates sow_critic_result_json (with retry)

    Post-processing (Python):
    3. Upserter → Writes to Appwrite default.Authored_SOW (Python utility)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents

    Architecture Notes:
        - Course data extraction moved to Python (no LLM needed, saves tokens)
        - Research moved to on-demand WebSearch/WebFetch (targeted, efficient)
        - Upserting kept as Python (deterministic, no LLM needed)
        - Only creative/judgmental tasks use LLM agents (authoring, critique)
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "INFO"
    ):
        """Initialize SOW Author agent.

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

        logger.info(f"Initialized SOWAuthorClaudeAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Raises:
            FileNotFoundError: If prompt files are missing

        Note:
            Course data extraction is now handled by Python utility (no subagent).
            Research is now handled by on-demand WebSearch/WebFetch (no subagent).
            Pipeline now includes 3 subagents: sow_author, unified_critic, schema_critic.
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 3 subagent prompts (schema_critic added for belt-and-braces validation)
        subagents = {
            "sow_author": AgentDefinition(
                description="SOW author for creating complete schemes of work with on-demand WebSearch/WebFetch",
                prompt=(prompts_dir / "sow_author_prompt.md").read_text()
            ),
            "unified_critic": AgentDefinition(
                description="Unified critic for validating SOW quality (belt validation - schema gate + 5 dimensions)",
                prompt=(prompts_dir / "unified_critic_prompt.md").read_text()
            ),
            "schema_critic": AgentDefinition(
                description="Schema-only validation gate (braces validation - final check before completion)",
                prompt=(prompts_dir / "schema_critic_prompt.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions")
        return subagents

    async def _fetch_course_details(self, courseId: str) -> tuple[str, str]:
        """Fetch subject and level from default.courses by courseId.

        This method queries the default.courses collection to retrieve the subject
        and level associated with the given courseId. This ensures we use the
        canonical values from the database rather than requiring redundant input.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')

        Returns:
            Tuple of (subject, level) both in database format (e.g., 'mathematics', 'national-5')

        Raises:
            ValueError: If course not found or missing required fields
        """
        logger.info(f"🔍 Fetching course details for courseId='{courseId}'")

        try:
            from .utils.appwrite_mcp import list_appwrite_documents

            # Query by courseId field
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

            course_doc = course_docs[0]

            # Extract subject and level
            subject = course_doc.get('subject')
            level = course_doc.get('level')

            if not subject:
                raise ValueError(
                    f"Course document '{courseId}' is missing required 'subject' field. "
                    f"Please check the course configuration in default.courses."
                )

            if not level:
                raise ValueError(
                    f"Course document '{courseId}' is missing required 'level' field. "
                    f"Please check the course configuration in default.courses."
                )

            logger.info(f"✅ Course details fetched: subject='{subject}', level='{level}'")

            # Also validate that corresponding SQA course data exists
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
            logger.info(f"✅ Course validation complete: All checks passed for courseId '{courseId}'")

            return subject, level

        except ValueError:
            raise  # Re-raise validation errors
        except Exception as e:
            error_msg = (
                f"Failed to fetch course details for courseId '{courseId}': {str(e)}. "
                f"Check that Appwrite MCP server is configured and accessible."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

    async def _check_existing_sow(
        self,
        courseId: str,
        version: str
    ) -> Optional[Dict[str, Any]]:
        """Check if SOW already exists for courseId AND version.

        This prevents creating duplicate SOWs for the same version.
        Uses FAIL FAST pattern - raises exception if corruption detected.

        Args:
            courseId: Course identifier
            version: SOW version to check

        Returns:
            Existing SOW document if found, None otherwise

        Raises:
            ValueError: If multiple SOWs found with same courseId+version (data corruption)
        """
        logger.info(f"Duplicate check: courseId='{courseId}', version='{version}'")

        try:
            from .utils.appwrite_mcp import list_appwrite_documents

            existing_sows = await list_appwrite_documents(
                database_id="default",
                collection_id="Authored_SOW",
                queries=[
                    f'equal("courseId", "{courseId}")',
                    f'equal("version", "{version}")'
                ],
                mcp_config_path=str(self.mcp_config_path)
            )

            if len(existing_sows) > 1:
                # Data corruption - multiple SOWs with same courseId+version
                error_msg = (
                    f"DATA CORRUPTION DETECTED: Found {len(existing_sows)} SOWs for "
                    f"courseId='{courseId}', version='{version}'. "
                    f"Database integrity violated. Manual cleanup required.\n"
                    f"SOW IDs: {[sow.get('$id') for sow in existing_sows]}"
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            if existing_sows:
                sow = existing_sows[0]
                logger.info(
                    f"Found existing SOW: {sow['$id']} "
                    f"(status={sow.get('status')}, created={sow.get('$createdAt')})"
                )
                return sow
            else:
                logger.info(f"No existing SOW found for version '{version}'")
                return None

        except ValueError:
            raise  # Re-raise corruption errors
        except Exception as e:
            error_msg = f"Failed to check for existing SOW: {str(e)}"
            logger.error(error_msg)
            raise ValueError(error_msg)

    async def execute(
        self,
        courseId: str,
        version: str = "1",
        force: bool = False
    ) -> Dict[str, Any]:
        """Execute the complete SOW authoring pipeline with version support.

        The pipeline automatically fetches subject and level from the database based on courseId,
        eliminating redundant input and ensuring data consistency.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            version: SOW version number (default: "1"). Must be numeric string.
            force: If True, overwrite existing SOW for this version (default: False)

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - appwrite_document_id: str (if successful)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If input validation fails, course not found, or duplicate version exists
            FileNotFoundError: If MCP config or prompts missing
        """
        # Step 1: Validate courseId format
        is_valid, error_msg = validate_input_schema({"courseId": courseId})
        if not is_valid:
            logger.error(f"Input validation failed: {error_msg}")
            raise ValueError(error_msg)

        # Step 1b: Validate version format (must be numeric string)
        if not version.isdigit():
            error_msg = f"Version must be a numeric string (e.g., '1', '2'), got: '{version}'"
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info(f"SOW Authoring Pipeline: courseId='{courseId}', version='{version}', force={force}")

        # Step 2: Fetch subject and level from database (FAIL FAST)
        logger.info(f"Fetching course details from database for courseId '{courseId}'...")
        try:
            subject, level = await self._fetch_course_details(courseId)
        except Exception as e:
            logger.error(f"Failed to fetch course details: {e}")
            raise ValueError(f"Cannot fetch course details: {e}")

        # Step 3: Validate fetched subject and level
        from .utils.validation import validate_fetched_subject_level
        is_valid, error_msg = validate_fetched_subject_level(subject, level)
        if not is_valid:
            logger.error(f"Fetched data validation failed: {error_msg}")
            raise ValueError(error_msg)

        # Step 4: Check for existing SOW with this courseId AND version (FAIL FAST)
        logger.info(f"Checking for existing SOW version '{version}' for courseId '{courseId}'...")
        existing_sow = await self._check_existing_sow(courseId, version)

        if existing_sow and not force:
            error_msg = (
                f"SOW version {version} already exists for courseId '{courseId}'.\n"
                f"  Document ID: {existing_sow['$id']}\n"
                f"  Status: {existing_sow.get('status', 'UNKNOWN')}\n"
                f"  Created: {existing_sow.get('$createdAt', 'UNKNOWN')}\n"
                f"  Use --force flag to overwrite this specific version."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        if existing_sow and force:
            logger.warning(
                f"FORCE MODE: Will overwrite existing SOW version {version} "
                f"(Document ID: {existing_sow['$id']})"
            )
            self.existing_sow_id = existing_sow['$id']
            self.version_being_overwritten = version
        else:
            self.existing_sow_id = None
            self.version_being_overwritten = None

        # Store version for downstream use
        self.sow_version = version

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

                # MCP servers configuration (TOKEN OPTIMIZATION v2.0)
                # Register SDK MCP server for Pydantic-based schema validation (in-process)
                # This replaces the 1265-line authored_sow_schema.md file copy, saving ~8-10K tokens
                mcp_servers_for_sow_author = {
                    "validator": sow_validation_server  # Provides mcp__validator__validate_sow_schema tool
                }
                logger.info("SDK MCP validator server registered (Pydantic-based validation, saves ~13-16k tokens vs v1.0)")

                # Configure Claude SDK client with permission_mode='bypassPermissions'
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',  # CRITICAL: Bypass all permission prompts
                    mcp_servers=mcp_servers_for_sow_author,  # Pydantic validator tool (v2.0)
                    allowed_tools=[
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
                        'WebSearch', 'WebFetch',
                        'mcp__validator__validate_sow_schema'  # Pydantic SOW validation tool
                    ],
                    max_turns=500,  # High limit to ensure agent can complete complex SOW authoring work
                    cwd=str(workspace_path)  # Set agent working directory to isolated workspace
                )

                logger.info(f"Agent configured: bypassPermissions + WebSearch/WebFetch + Pydantic validator (v2.0 token optimized) + cwd={workspace_path} + max_turns=500")

                # Execute pipeline (now only 2 subagents: sow_author with WebSearch/WebFetch, critic)
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

                    # Process messages until agent completion (2 subagents)
                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Agent has completed 2 subagents
                            logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # Python-based upserting (deterministic, replaces Step 5)
                logger.info("Starting deterministic Python upserter...")

                from .utils.sow_upserter import upsert_sow_to_appwrite

                sow_file_path = workspace_path / "authored_sow.json"

                appwrite_document_id = await upsert_sow_to_appwrite(
                    sow_file_path=str(sow_file_path),
                    subject=subject,
                    level=level,
                    course_id=courseId,
                    version=self.sow_version,  # Pass version
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path),
                    existing_sow_id=getattr(self, 'existing_sow_id', None)  # Pass for force mode
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
✅ `Course_data.txt` - Official SQA course structure (pre-populated by Python extraction)
   - Source: sqa_education.sqa_current collection
   - Extracted: Official SQA course structure, units, outcomes, assessment standards
   - Location: `/workspace/Course_data.txt`

✅ **Pydantic Schema Validator** - Deterministic validation tool (v2.0 TOKEN OPTIMIZATION)
   - Tool: `mcp__validator__validate_sow_schema`
   - Source: claud_author_agent/src/tools/sow_validator_tool.py (Pydantic models)
   - Replaces: 1265-line SOW_Schema.md file (saves ~8-10K tokens)
   - Purpose: Fast, deterministic schema validation with specific error locations

## Pipeline Execution

Execute the following 3 subagents in sequence with belt-and-braces validation:

### 1. SOW Author (with on-demand WebSearch/WebFetch)
- **Task**: Author complete SOW using Course_data.txt
- **Inputs**:
  - `/workspace/Course_data.txt` (pre-populated)
- **Output**: `/workspace/authored_sow.json`
- **Delegate to**: @sow_author
- **Research**: WebSearch and WebFetch tools for on-demand research (Scottish contexts, exemplars, misconceptions)

### 2. Unified Critic (belt validation - schema gate + 5 dimensions, iterate until pass)
- **Task**: Validate SOW quality with schema gate FIRST, then 5 pedagogical dimensions
- **Inputs**:
  - `/workspace/Course_data.txt` (pre-populated)
  - `/workspace/authored_sow.json` (from author)
- **Output**: `/workspace/sow_critic_result.json`
- **Delegate to**: @unified_critic
- **Logic**:
  - If schema_gate fails: FAIL immediately (no dimension scoring)
  - If schema_gate passes but dimensions fail: Provide feedback
  - If overall_pass = false:
    - Pass feedback to @sow_author for revision
    - Re-run @unified_critic
  - If overall_pass = true: proceed to schema_critic

### 3. Schema Critic (braces validation - final gate, v2.0 Pydantic-based)
- **Task**: Final schema-only validation using Pydantic validation tool
- **Inputs**:
  - `/workspace/authored_sow.json` (from unified_critic)
- **Tool**: `mcp__validator__validate_sow_schema` (Pydantic-based, deterministic)
- **Output**: `/workspace/schema_validation_result.json`
- **Delegate to**: @schema_critic
- **v2.0 Improvement**: Uses Pydantic models instead of reading 1265-line schema file (saves ~13-16K tokens)
- **Logic**:
  - If schema validation passes: Pipeline COMPLETE
  - If schema validation fails:
    - Return to step 1 (SOW Author revision)
    - Continue iterating until validation passes

## Cost Tracking
After each subagent execution, use TodoWrite to log:
- Subagent name
- Token usage
- Estimated cost

## Final Output
When both subagents complete successfully, report completion.
The authored SOW will be persisted to Appwrite by the orchestrating system.

Begin pipeline execution now.
"""


async def main():
    """Example usage of SOW Author agent."""
    agent = SOWAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    result = await agent.execute(
        courseId="course_c84874"  # Must exist in default.courses; subject/level auto-fetched
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
