"""Main Lesson Author Claude Agent implementation.

Orchestrates a 3-subagent pipeline to author complete Lesson Templates
for Scottish secondary education from SOW entry input to Appwrite database.
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
from .utils.validation import validate_lesson_author_input
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging

logger = logging.getLogger(__name__)


class LessonAuthorClaudeAgent:
    """Autonomous lesson template authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    0. SOW Entry Extractor → Extracts entry from Authored_SOW (Python utility)
    1. Course Data Extractor → Creates Course_data.txt from Appwrite (Python utility)

    Pipeline execution (3 subagents):
    2. Research Subagent → Answers clarifications with Scottish context (WebSearch/WebFetch)
    3. Lesson Author → Creates lesson_template.json (main authoring agent)
    4. Combined Lesson Critic → Validates across 6 dimensions (with retry)

    Post-processing (Python):
    5. Lesson Upserter → Writes to default.lesson_templates (Python utility)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        max_critic_retries: Maximum attempts for critic validation loop
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents

    Architecture Notes:
        - SOW entry extraction moved to Python (no LLM needed, saves tokens)
        - Course data extraction moved to Python (no LLM needed, saves tokens)
        - Research via on-demand research_subagent (WebSearch/WebFetch as needed)
        - NO pre-loaded research pack - agent queries for specific information
        - Upserting kept as Python (deterministic, no LLM needed)
        - Only creative/judgmental tasks use LLM agents (authoring, critique)
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        max_critic_retries: int = 10,
        log_level: str = "INFO"
    ):
        """Initialize Lesson Author agent.

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

        logger.info(f"Initialized LessonAuthorClaudeAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Raises:
            FileNotFoundError: If prompt files are missing

        Note:
            3 subagents: research_subagent, lesson_author, combined_lesson_critic
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 3 subagent prompts
        subagents = {
            "research_subagent": AgentDefinition(
                description="Research subagent for answering clarifications with Scottish context",
                prompt=(prompts_dir / "research_subagent_prompt.md").read_text()
            ),
            "lesson_author": AgentDefinition(
                description="Lesson author for creating complete lesson templates",
                prompt=(prompts_dir / "lesson_author_prompt.md").read_text()
            ),
            "combined_lesson_critic": AgentDefinition(
                description="Combined lesson critic for validating lesson quality across 6 dimensions",
                prompt=(prompts_dir / "lesson_critic_prompt.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions")
        return subagents

    async def execute(
        self,
        courseId: str,
        order: int
    ) -> Dict[str, Any]:
        """Execute the complete lesson authoring pipeline.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW entries

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - appwrite_document_id: str (if successful)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If courseId not found or order invalid
            FileNotFoundError: If MCP config or prompts missing
        """
        # Validate input schema (Lesson Author specific validation)
        is_valid, error_msg = validate_lesson_author_input({
            "courseId": courseId,
            "order": order
        })
        if not is_valid:
            logger.error(f"Input validation failed: {error_msg}")
            raise ValueError(error_msg)

        # Validate SOW entry exists (FAIL FAST)
        logger.info(f"Validating SOW entry exists for courseId '{courseId}' at order {order}...")
        sow_entry = await self._validate_sow_entry_exists(courseId, order)

        logger.info(f"Starting lesson authoring pipeline: {sow_entry.get('label', 'N/A')}")

        try:
            # Create isolated workspace
            with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace) as filesystem:
                workspace_path = filesystem.root

                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract SOW entry and Course_data.txt (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Extracting SOW entry via Python utility...")

                from .utils.sow_extractor import extract_sow_entry_to_workspace

                sow_entry_data, sow_context_data = await extract_sow_entry_to_workspace(
                    courseId=courseId,
                    order=order,
                    mcp_config_path=str(self.mcp_config_path),
                    workspace_path=workspace_path
                )

                logger.info(f"✅ sow_entry_input.json ready at: {workspace_path / 'sow_entry_input.json'}")
                logger.info(f"✅ sow_context.json ready at: {workspace_path / 'sow_context.json'}")
                logger.info("   Python extraction complete - no LLM tokens used")

                logger.info("Pre-processing: Extracting Course_data.txt via Python utility...")

                from .utils.course_data_extractor import extract_course_data_to_file

                course_data_path = workspace_path / "Course_data.txt"

                # Extract subject and level from SOW entry for Course_data.txt lookup
                # These are stored in the SOW document metadata, not in individual entries
                from .utils.sow_extractor import get_course_metadata_from_sow

                subject, level = await get_course_metadata_from_sow(
                    courseId=courseId,
                    mcp_config_path=str(self.mcp_config_path)
                )

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

                # Execute pipeline (3 subagents: research_subagent, lesson_author, combined_lesson_critic)
                async with ClaudeSDKClient(options) as client:
                    # Initial prompt to orchestrate subagents
                    initial_prompt = self._build_initial_prompt(
                        courseId=courseId,
                        order=order,
                        workspace_path=str(workspace_path),
                        sow_entry=sow_entry_data
                    )

                    logger.info("Sending initial prompt to Claude Agent SDK...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream - logging ALL raw messages...")
                    message_count = 0

                    # Process messages until agent completion (3 subagents)
                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Agent has completed 3 subagents
                            logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # Python-based upserting with compression (deterministic)
                logger.info("Starting deterministic Python upserter with compression...")

                from .utils.lesson_upserter import upsert_lesson_template

                lesson_template_path = workspace_path / "lesson_template.json"

                appwrite_document_id = await upsert_lesson_template(
                    lesson_template_path=str(lesson_template_path),
                    courseId=courseId,
                    order=order,
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path)
                )

                logger.info(f"Lesson template upserted successfully: {appwrite_document_id}")

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

    async def _validate_sow_entry_exists(
        self,
        courseId: str,
        order: int
    ) -> Dict[str, Any]:
        """Validate that SOW entry exists for courseId at given order.

        Note: Only published SOWs (status='published') are validated. Draft SOWs
        are excluded to ensure quality control before lesson template creation.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW entries

        Returns:
            SOW entry dictionary

        Raises:
            ValueError: If published SOW not found or order invalid
        """
        logger.info(f"🔍 Starting SOW entry validation for courseId='{courseId}', order={order}")

        try:
            from .utils.appwrite_mcp import list_appwrite_documents

            logger.info(f"  Step 1: Checking published SOW document in default.Authored_SOW...")
            sow_docs = await list_appwrite_documents(
                database_id="default",
                collection_id="Authored_SOW",
                queries=[
                    f'equal("courseId", "{courseId}")',
                    'equal("status", "published")'
                ],
                mcp_config_path=str(self.mcp_config_path)
            )

            if not sow_docs or len(sow_docs) == 0:
                raise ValueError(
                    f"Published SOW not found: No published SOW with courseId='{courseId}' in default.Authored_SOW collection. "
                    f"Please ensure the SOW is authored and published (status='published') before creating lesson templates."
                )

            sow_doc = sow_docs[0]  # Get first matching SOW

            logger.info(f"  ✓ SOW document found: {courseId}")

            # Parse entries field (may be JSON string or already parsed)
            entries = sow_doc.get('entries', [])
            if isinstance(entries, str):
                entries = json.loads(entries)

            # Find entry with matching order
            entry = next((e for e in entries if e.get('order') == order), None)

            if entry is None:
                available_orders = [e.get('order') for e in entries if 'order' in e]
                raise ValueError(
                    f"Order {order} not found in SOW entries for courseId '{courseId}'. "
                    f"Available orders: {sorted(available_orders)}"
                )

            logger.info(f"  ✓ SOW entry found at order {order}: {entry.get('label', 'N/A')}")

            return entry

        except ValueError:
            raise  # Re-raise validation errors
        except Exception as e:
            error_msg = (
                f"Failed to query default.Authored_SOW for courseId '{courseId}': {str(e)}. "
                f"Check that Appwrite MCP server is configured and accessible."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

    def _build_initial_prompt(
        self,
        courseId: str,
        order: int,
        workspace_path: str,
        sow_entry: Dict[str, Any]
    ) -> str:
        """Build the initial orchestration prompt for the main agent.

        Args:
            courseId: Course identifier (pre-validated)
            order: Lesson order number
            workspace_path: Path to workspace
            sow_entry: SOW entry dictionary

        Returns:
            Initial prompt string
        """
        return f"""# Lesson Authoring Pipeline - Main Orchestrator

You are orchestrating the autonomous authoring of a Lesson Template for Scottish secondary education.

## Input Specification
- **Course ID**: {courseId}
- **SOW Order**: {order}
- **Lesson**: {sow_entry.get('label', 'N/A')}
- **Type**: {sow_entry.get('lesson_type', 'teach')}
- **Duration**: {sow_entry.get('estMinutes', 50)} minutes

## Workspace
All files will be created in: {workspace_path}

## Pre-Processing (Complete)
✅ `sow_entry_input.json` has been pre-populated by Python extraction (no subagent needed)
   - Source: default.Authored_SOW collection
   - Extracted: Specific lesson entry at order {order}
   - Location: `/workspace/sow_entry_input.json`

✅ `sow_context.json` has been pre-populated by Python extraction (no subagent needed)
   - Source: SOW document metadata
   - Extracted: Course-level coherence, accessibility, engagement notes
   - Location: `/workspace/sow_context.json`

✅ `Course_data.txt` has been pre-populated by Python extraction (no subagent needed)
   - Source: sqa_education.sqa_current collection
   - Extracted: Official SQA course structure, units, outcomes, assessment standards
   - Location: `/workspace/Course_data.txt`

## Pipeline Execution

Execute the following workflow with 3 available subagents:

### 1. Research Subagent (on-demand for additional information)
- **When to Use**: Whenever you need information beyond the pre-loaded files
- **Use Cases**:
  * Scottish pedagogical patterns and teaching approaches
  * Exemplar lesson structures for specific lesson types
  * Common student misconceptions for the subject area
  * Scottish context examples (local services, pricing, places)
  * CfE/SQA policy clarifications and terminology
  * Accessibility best practices (CEFR levels, dyslexia-friendly design)
- **Tools Available**: WebSearch, WebFetch
- **Delegation**: @research_subagent
- **Important**: DO NOT skip research when you need clarity on:
  * How to design cards for a specific lesson_type (e.g., mock_exam structure)
  * Scottish-specific contexts for CFU questions
  * Common misconceptions in the subject domain
  * Pedagogical scaffolding approaches (I-We-You progression)

### 2. Lesson Author (main authoring - YOU)
- **Task**: Author complete LessonTemplate using pre-loaded files + research
- **Pre-loaded Inputs**:
  - `/workspace/sow_entry_input.json` (SOW lesson design with rich pedagogical detail)
  - `/workspace/sow_context.json` (Course-level coherence, accessibility, engagement notes)
  - `/workspace/Course_data.txt` (Official SQA outcomes, assessment standards)
- **Additional Resources**: Use @research_subagent for any gaps
- **Output**: `/workspace/lesson_template.json`
- **Process**:
  1. Read all pre-loaded files
  2. Identify information gaps (exemplars, misconceptions, contexts)
  3. Delegate to @research_subagent for targeted queries
  4. Draft lesson_template.json with comprehensive pedagogical design
  5. Write lesson_template.json to workspace

### 3. Lesson Author Strategy
- **Start with SOW entry**: Extract card structures, worked examples, practice problems
- **Use research_subagent proactively**: Don't guess Scottish contexts or misconceptions
- **Example research queries**:
  * "Find 3 common misconceptions when students learn fractions of amounts"
  * "Suggest authentic Scottish shopping contexts for percentage discount problems"
  * "What is the I-We-You pedagogy progression for teaching mathematics?"
  * "Find exemplar National 5 mock exam question structures"

### 4. Combined Lesson Critic (with retry loop)
- **Task**: Validate lesson across 6 dimensions
- **Inputs**:
  - `/workspace/lesson_template.json` (from step 2)
  - `/workspace/sow_entry_input.json` (pre-loaded)
  - `/workspace/Course_data.txt` (optional validation)
- **Output**: `/workspace/critic_result.json`
- **Delegate to**: @combined_lesson_critic
- **Logic**:
  - If overall_pass = false and attempt < {self.max_critic_retries}:
    - Pass feedback to yourself for revision
    - Revise lesson_template.json
    - Re-run @combined_lesson_critic
  - If overall_pass = true OR max attempts reached: proceed to completion

## Cost Tracking
After each subagent execution, use TodoWrite to log:
- Subagent name
- Token usage (if available)
- Estimated cost

## Final Output
When lesson authoring and critique complete successfully, report completion.
The lesson template will be persisted to Appwrite by the orchestrating system.

Begin pipeline execution now.
"""


async def main():
    """Example usage of Lesson Author agent."""
    agent = LessonAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        max_critic_retries=10,
        log_level="INFO"
    )

    result = await agent.execute(
        courseId="course_c84874",  # Must exist in default.courses
        order=1  # Must be valid order in SOW entries (1-indexed, starts from 1)
    )

    if result["success"]:
        print(f"✓ Lesson template authored successfully!")
        print(f"  Execution ID: {result['execution_id']}")
        print(f"  Workspace: {result['workspace_path']}")
        print(f"  Document ID: {result['appwrite_document_id']}")
        print(f"  Total Cost: ${result['metrics']['total_cost_usd']:.4f}")
    else:
        print(f"✗ Lesson authoring failed: {result['error']}")


if __name__ == "__main__":
    asyncio.run(main())
