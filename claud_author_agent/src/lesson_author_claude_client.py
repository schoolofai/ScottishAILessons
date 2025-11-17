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
from .utils.compression import decompress_json_gzip_base64
from .tools.json_validator_tool import validation_server
from .tools.diagram_screenshot_tool import diagram_screenshot_server, check_diagram_service_health

logger = logging.getLogger(__name__)


class LessonAuthorClaudeAgent:
    """Autonomous lesson template authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    0. SOW Entry Extractor → Extracts entry from Authored_SOW (Python utility)
    1. Course Outcomes Extractor → Creates Course_outcomes.json from default.course_outcomes (Python utility)

    Pipeline execution (3 subagents):
    2. Research Subagent → Answers clarifications with Scottish context (WebSearch/WebFetch)
    3. Lesson Author v2 → Creates lesson_template.json (main authoring agent)
    4. Combined Lesson Critic v2 → Validates transformation fidelity + schema compliance (with retry)

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
            5 subagents: research_subagent, lesson_author (v3), combined_lesson_critic (v3),
            diagram_generation_subagent, diagram_critic_subagent
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 5 subagent prompts (v3 with diagram planning integration)
        subagents = {
            "research_subagent": AgentDefinition(
                description="Research subagent for answering clarifications with Scottish context",
                prompt=(prompts_dir / "research_subagent_prompt.md").read_text()
            ),
            "lesson_author": AgentDefinition(
                description="Lesson author v3 with diagram planning for creating complete lesson templates",
                prompt=(prompts_dir / "lesson_author_prompt_v3.md").read_text()
            ),
            "combined_lesson_critic": AgentDefinition(
                description="Combined lesson critic v3 with diagram coherence validation",
                prompt=(prompts_dir / "lesson_critic_prompt_v3.md").read_text()
            ),
            "diagram_generation_subagent": AgentDefinition(
                description="Diagram generation subagent for creating JSXGraph diagrams from lesson cards",
                prompt=(prompts_dir / "diagram_generation_subagent.md").read_text()
            ),
            "diagram_critic_subagent": AgentDefinition(
                description="Diagram visual critic for evaluating diagram quality across 4 dimensions",
                prompt=(prompts_dir / "visual_critic_subagent.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions (v3 with diagram integration)")
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
        sow_entry, sow_metadata = await self._validate_sow_entry_exists(courseId, order)

        logger.info(f"Starting lesson authoring pipeline: {sow_entry.get('label', 'N/A')}")

        try:
            # Create isolated workspace
            with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace, workspace_type="lesson_author") as filesystem:
                workspace_path = filesystem.root

                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract SOW entry and Course_outcomes.json (NO AGENT)
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

                logger.info("Pre-processing: Extracting Course_outcomes.json via Python utility...")

                from .utils.course_outcomes_extractor import extract_course_outcomes_to_file

                course_outcomes_path = workspace_path / "Course_outcomes.json"

                # Extract course outcomes directly from default.course_outcomes
                # This eliminates indirection through sqa_education.sqa_current
                # and provides deterministic outcome references
                outcomes_data = await extract_course_outcomes_to_file(
                    courseId=courseId,
                    mcp_config_path=str(self.mcp_config_path),
                    output_path=course_outcomes_path
                )

                logger.info(f"✅ Course_outcomes.json ready at: {course_outcomes_path}")
                logger.info(f"   Extracted {len(outcomes_data['outcomes'])} outcomes from default.course_outcomes")
                logger.info(f"   Structure type: {outcomes_data['structure_type']}")
                logger.info("   Python extraction complete - no LLM tokens used")

                # Load MCP config as dict (not path string)
                mcp_config = {}
                if self.mcp_config_path.exists():
                    with open(self.mcp_config_path, 'r') as f:
                        mcp_config = json.load(f).get('mcpServers', {})
                    logger.info(f"Loaded MCP config with servers: {list(mcp_config.keys())}")

                # ═══════════════════════════════════════════════════════════════
                # Register MCP Tools for Lesson Author Agent
                # ═══════════════════════════════════════════════════════════════
                # ONLY register validator + diagram_screenshot MCP tools - Appwrite MCP excluded.
                #
                # Why Appwrite MCP Not Needed:
                # - SOW entry and Course_outcomes.json are PRE-EXTRACTED by Python utilities
                #   (sow_extractor.py, course_outcomes_extractor.py use Appwrite MCP directly)
                # - Lesson author agent works with FILES in workspace, not database queries
                # - Removes ~5,000-10,000 tokens per execution (50+ unused Appwrite tools)
                #
                # JSON Validation Tool (v2.0.0):
                # - Validates OUTPUT schema (cards have: id, explainer, explainer_plain, rubric, misconceptions)
                # - Deep CFU validation (MCQ needs answerIndex, numeric needs expected/tolerance)
                # - Rubric sum validation (criteria points must equal total_points)
                # - Misconception ID format validation (MISC_[SUBJECT]_[TOPIC]_NNN)
                # - Card ID sequential validation (card_001, card_002, no gaps)
                # - Error limit: Returns max 10 detailed errors per validation
                #
                # Tool Name: mcp__validator__validate_lesson_template
                # Documentation: docs/guides/json-validation-tool.md
                # Implementation: src/tools/json_validator_tool.py
                #
                # DiagramScreenshot Tool (v1.0.0):
                # - Renders JSXGraph diagrams to PNG files
                # - HTTP service at localhost:3001/api/v1/render
                # - File-based output (writes to workspace/diagrams/)
                # - Used by diagram_generation_subagent during Phase 3
                #
                # Tool Name: mcp__diagram_screenshot__render_diagram
                # Implementation: src/tools/diagram_screenshot_tool.py
                # ═══════════════════════════════════════════════════════════════
                mcp_servers_for_lesson_author = {
                    "validator": validation_server,  # JSON validation tool (v2.0.0)
                    "diagram_screenshot": diagram_screenshot_server  # Diagram rendering tool (v1.0.0)
                    # Appwrite MCP intentionally excluded - not used by lesson author
                }
                logger.info("Registered validator + diagram_screenshot MCP tools (Appwrite MCP excluded - not needed)")

                # ═══════════════════════════════════════════════════════════════
                # Generate Blank Lesson Template (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                # Creates empty lesson_template.json with correct schema structure
                # based on sow_entry_input.json. Agent will fill in content using
                # Edit tool ONLY (NOT Write). This preserves structure and prevents
                # schema errors.
                # ═══════════════════════════════════════════════════════════════
                logger.info("Generating blank lesson_template.json...")

                from .utils.blank_template_generator import generate_blank_template_file

                sow_input_path = workspace_path / "sow_entry_input.json"
                blank_template_path = workspace_path / "lesson_template.json"

                if not sow_input_path.exists():
                    error_msg = f"SOW entry input not found: {sow_input_path}"
                    logger.error(f"❌ {error_msg}")
                    raise FileNotFoundError(error_msg)

                generate_blank_template_file(
                    sow_input_path=str(sow_input_path),
                    output_path=str(blank_template_path),
                    course_id=courseId
                )

                logger.info(f"✅ Blank lesson_template.json ready at: {blank_template_path}")
                logger.info("   Python generation complete - no LLM tokens used")

                # ═══════════════════════════════════════════════════════════════
                # Copy Schema Reference Files to Workspace
                # ═══════════════════════════════════════════════════════════════
                logger.info("Copying schema reference files to workspace...")
                self._copy_schema_files_to_workspace(workspace_path)

                # Configure Claude SDK client with permission_mode='bypassPermissions'
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',  # CRITICAL: Bypass all permission prompts
                    mcp_servers=mcp_servers_for_lesson_author,  # validator + diagram_screenshot MCP
                    allowed_tools=[
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
                        'WebSearch', 'WebFetch',
                        'mcp__validator__validate_lesson_template',  # JSON validation tool
                        'mcp__diagram_screenshot__render_diagram'  # Diagram rendering tool
                    ],
                    max_turns=500,  # High limit to ensure agent can complete complex lesson authoring work
                    cwd=str(workspace_path)  # Set agent working directory to isolated workspace
                )

                logger.info(f"Agent configured: bypassPermissions + WebSearch/WebFetch + cwd={workspace_path} + max_turns=500")

                # ═══════════════════════════════════════════════════════════════
                # Health Check: DiagramScreenshot Service
                # ═══════════════════════════════════════════════════════════════
                # Check if DiagramScreenshot service is running on localhost:3001
                # If service is down, diagrams will fail gracefully during Phase 3
                # (lessons will still complete without diagrams)
                # ═══════════════════════════════════════════════════════════════
                logger.info("Checking DiagramScreenshot service health...")
                diagram_service_available = await check_diagram_service_health()

                if diagram_service_available:
                    logger.info("✅ DiagramScreenshot service is running (localhost:3001)")
                else:
                    logger.warning(
                        "⚠️ DiagramScreenshot service is NOT available at localhost:3001. "
                        "Diagram generation will fail gracefully during Phase 3. "
                        "Lessons will still complete without diagrams. "
                        "To enable diagrams, start the service with: cd diagram-screenshot && npm run dev"
                    )

                # Execute pipeline (5 subagents: research, lesson_author v3, critic v3, diagram_gen, diagram_critic)
                async with ClaudeSDKClient(options) as client:
                    # Initial prompt to orchestrate subagents
                    initial_prompt = self._build_initial_prompt(
                        courseId=courseId,
                        order=order,
                        workspace_path=str(workspace_path),
                        sow_entry=sow_entry_data,
                        outcomes_data=outcomes_data
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
                            # Agent has completed - extract metrics from ResultMessage
                            logger.info(f"✅ Pipeline completed after {message_count} messages")

                            # Extract token usage from ResultMessage
                            usage = message.usage or {}
                            input_tokens = usage.get('input_tokens', 0)
                            cache_creation = usage.get('cache_creation_input_tokens', 0)
                            cache_read = usage.get('cache_read_input_tokens', 0)
                            output_tokens = usage.get('output_tokens', 0)

                            # Total input includes base + cache tokens
                            total_input = input_tokens + cache_creation + cache_read
                            total_output = output_tokens

                            # Extract cost and duration
                            total_cost = message.total_cost_usd or 0.0
                            duration_seconds = (message.duration_ms or 0) / 1000.0

                            # Record metrics in cost tracker
                            self.cost_tracker.record_subagent(
                                name="lesson_author_pipeline",
                                input_tokens=total_input,
                                output_tokens=total_output,
                                cost=total_cost,
                                execution_time=duration_seconds,
                                success=not message.is_error,
                                error=""
                            )

                            logger.info(f"📊 Metrics captured: {total_input:,} input + {total_output:,} output = ${total_cost:.4f}")
                            break

                    logger.info("Message stream complete")

                # ═══════════════════════════════════════════════════════════════
                # Phase 3: Diagram Generation (After lesson authoring, before upserting)
                # ═══════════════════════════════════════════════════════════════
                # Generate diagrams for all diagram-eligible cards in lesson_template.json
                # Uses DiagramGenerator with iterative critique loop (max 3 iterations)
                # Diagrams fail gracefully - lessons complete even if service is down
                # Updates lesson_template.json in-place with diagram_metadata
                # ═══════════════════════════════════════════════════════════════
                logger.info("=" * 80)
                logger.info("Phase 3: Diagram Generation")
                logger.info("=" * 80)

                lesson_template_path = workspace_path / "lesson_template.json"

                # Load lesson template to check for diagram-eligible cards
                if lesson_template_path.exists():
                    with open(lesson_template_path) as f:
                        lesson_template_data = json.load(f)

                    # Count diagram-eligible cards
                    eligible_count = sum(
                        1 for card in lesson_template_data.get("cards", [])
                        if card.get("diagram_eligible", False)
                    )

                    if eligible_count > 0:
                        logger.info(f"Found {eligible_count} diagram-eligible cards - starting diagram generation...")

                        from .utils.diagram_generator import DiagramGenerator

                        diagram_generator = DiagramGenerator(
                            mcp_config_path=self.mcp_config_path,
                            workspace_path=workspace_path,
                            max_iterations=3,
                            score_threshold=0.85
                        )

                        try:
                            diagram_results = await diagram_generator.generate_diagrams_for_lesson(
                                lesson_template=lesson_template_data,
                                subagent_definitions=self._get_subagent_definitions(),
                                mcp_servers=mcp_servers_for_lesson_author
                            )

                            logger.info(
                                f"✅ Diagram generation complete: "
                                f"{diagram_results['diagrams_generated']} generated, "
                                f"{diagram_results['diagrams_failed']} failed, "
                                f"{diagram_results['total_eligible']} eligible"
                            )

                            if diagram_results['diagrams_failed'] > 0:
                                logger.warning(
                                    f"⚠️ {diagram_results['diagrams_failed']} diagrams failed to generate. "
                                    f"Failed card IDs: {diagram_results.get('failed_card_ids', [])}"
                                )

                            # Record diagram generation metrics
                            self.cost_tracker.record_subagent(
                                name="diagram_generation_phase",
                                input_tokens=diagram_results.get('total_input_tokens', 0),
                                output_tokens=diagram_results.get('total_output_tokens', 0),
                                cost=diagram_results.get('total_cost_usd', 0.0),
                                execution_time=diagram_results.get('execution_time_seconds', 0.0),
                                success=diagram_results['diagrams_generated'] > 0,
                                error=""
                            )

                        except Exception as e:
                            logger.error(f"❌ Diagram generation failed: {e}", exc_info=True)
                            logger.warning("Continuing without diagrams (graceful degradation)")
                    else:
                        logger.info("No diagram-eligible cards found - skipping Phase 3")
                else:
                    logger.warning(f"lesson_template.json not found at {lesson_template_path} - skipping diagrams")

                logger.info("=" * 80)

                # Python-based upserting with compression (deterministic)
                logger.info("Starting deterministic Python upserter with compression...")

                from .utils.lesson_upserter import upsert_lesson_template

                lesson_template_path = workspace_path / "lesson_template.json"

                appwrite_document_id = await upsert_lesson_template(
                    lesson_template_path=str(lesson_template_path),
                    courseId=courseId,
                    order=order,
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path),
                    # NEW: Pass SOW reference fields for model versioning
                    authored_sow_id=sow_metadata["authored_sow_id"],
                    authored_sow_version=sow_metadata["authored_sow_version"]
                )

                logger.info(f"Lesson template upserted successfully: {appwrite_document_id}")

                # Verify validation step was completed (post-execution check)
                validation_file = workspace_path / "validation_result.json"

                if not validation_file.exists():
                    logger.warning(
                        "⚠️ PROMPT ADHERENCE ISSUE: Agent did not create validation_result.json"
                    )
                    logger.warning("Agent may have skipped validation step (Step 5 in prompt)")
                else:
                    # Verify validation passed
                    try:
                        with open(validation_file) as f:
                            validation_result = json.load(f)

                        if not validation_result.get("is_valid", False):
                            logger.warning(
                                f"⚠️ Agent proceeded to critic despite validation failure: "
                                f"{validation_result.get('total_errors')} errors found"
                            )
                        else:
                            logger.info("✅ Validation passed before critic (correct workflow)")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not read validation_result.json: {e}")

                # Generate final report
                metrics_report = format_cost_report(self.cost_tracker, agent_name="LESSON AUTHOR")
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
    ) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """Validate that SOW entry exists for courseId at given order.

        Note: Only published SOWs (status='published') are validated. Draft SOWs
        are excluded to ensure quality control before lesson template creation.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW entries

        Returns:
            Tuple of (sow_entry, sow_metadata) where:
                - sow_entry: SOW entry dictionary
                - sow_metadata: Dict with 'authored_sow_id' and 'authored_sow_version'

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

            # Parse entries field (handles compressed and uncompressed formats)
            # Supports: TypeScript "gzip:" prefix, Python legacy raw base64, and uncompressed JSON
            entries = sow_doc.get('entries', [])
            if isinstance(entries, str):
                try:
                    entries = decompress_json_gzip_base64(entries)
                except ValueError as e:
                    logger.error(f"Failed to decompress entries field: {e}")
                    raise ValueError(
                        f"Cannot parse entries field for courseId '{courseId}': {e}. "
                        f"The entries field may be corrupted or in an unsupported format."
                    )

            # Find entry with matching order
            entry = next((e for e in entries if e.get('order') == order), None)

            if entry is None:
                available_orders = [e.get('order') for e in entries if 'order' in e]
                raise ValueError(
                    f"Order {order} not found in SOW entries for courseId '{courseId}'. "
                    f"Available orders: {sorted(available_orders)}"
                )

            logger.info(f"  ✓ SOW entry found at order {order}: {entry.get('label', 'N/A')}")

            # Extract SOW metadata for model versioning
            sow_metadata = {
                "authored_sow_id": sow_doc.get("$id", ""),
                "authored_sow_version": sow_doc.get("version", "v1.0")  # Fallback to 'v1.0'
            }

            logger.info(f"  ✓ SOW metadata extracted: id={sow_metadata['authored_sow_id']}, version={sow_metadata['authored_sow_version']}")

            return entry, sow_metadata

        except ValueError:
            raise  # Re-raise validation errors
        except Exception as e:
            error_msg = (
                f"Failed to query default.Authored_SOW for courseId '{courseId}': {str(e)}. "
                f"Check that Appwrite MCP server is configured and accessible."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

    def _copy_schema_files_to_workspace(self, workspace_path: Path) -> None:
        """Copy schema reference files to workspace for agent access.

        Args:
            workspace_path: Path to isolated workspace directory

        The agent operates in an isolated workspace and cannot access source code directories.
        Pre-copying schema files enables the agent to Read them during execution if needed.
        """
        import shutil

        schemas_dir = workspace_path / "schemas"
        schemas_dir.mkdir(exist_ok=True)

        schema_files = [
            "lesson_template_schema.md",
        ]

        source_schemas = Path(__file__).parent / "prompts" / "schemas"

        for schema_file in schema_files:
            source_path = source_schemas / schema_file
            dest_path = schemas_dir / schema_file

            if not source_path.exists():
                error_msg = f"Schema file not found: {source_path}"
                logger.error(error_msg)
                raise FileNotFoundError(f"Missing schema file: {schema_file}")

            shutil.copy(source_path, dest_path)
            logger.debug(f"  Copied: {schema_file}")

        logger.info(f"✅ {len(schema_files)} schema file(s) ready at: {schemas_dir}")

    def _build_initial_prompt(
        self,
        courseId: str,
        order: int,
        workspace_path: str,
        sow_entry: Dict[str, Any],
        outcomes_data: Dict[str, Any]
    ) -> str:
        """Build the initial orchestration prompt for the main agent.

        Args:
            courseId: Course identifier (pre-validated)
            order: Lesson order number
            workspace_path: Path to workspace
            sow_entry: SOW entry dictionary
            outcomes_data: Course outcomes data with structure_type and outcomes list

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
✅ `sow_entry_input.json` - Lesson entry at order {order}
   - Location: `/workspace/sow_entry_input.json`
   - Format: JSON with label, lesson_type, estMinutes, lesson_plan.card_structure[]

✅ `sow_context.json` - Course-level coherence, accessibility, engagement notes
   - Location: `/workspace/sow_context.json`
   - Format: JSON with policy_notes, sequencing_notes, accessibility_notes

✅ `Course_outcomes.json` - Course outcomes with deterministic outcomeId references
   - Location: `/workspace/Course_outcomes.json`
   - Structure Type: {outcomes_data.get('structure_type', 'unit_based')} (unit_based or skills_based)
   - Total Outcomes: {len(outcomes_data.get('outcomes', []))}
   - Format: JSON array with outcomeId, outcomeTitle, assessmentStandards, teacherGuidance

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

### 2. Lesson Author v3 (main authoring with diagram planning - YOU)
- **Task**: Fill blank lesson template using pre-loaded files + research + diagram planning
- **Pre-loaded Inputs**:
  - `/workspace/lesson_template.json` (BLANK template - pre-generated with correct structure)
  - `/workspace/sow_entry_input.json` (SOW lesson design with rich pedagogical detail)
  - `/workspace/sow_context.json` (Course-level coherence, accessibility, engagement notes)
  - `/workspace/Course_outcomes.json` (Course outcomes with deterministic outcomeId references)
- **Additional Resources**: Use @research_subagent for any gaps
- **Output**: Filled `/workspace/lesson_template.json` with diagram planning fields
- **Process**:
  1. Read blank lesson_template.json (already exists in workspace)
  2. Read all other pre-loaded files
  3. **Create todo list with per-card validation** (see Step 3 in lesson_author_prompt_v3.md)
  4. Identify information gaps (exemplars, misconceptions, contexts)
  5. Delegate to @research_subagent for targeted queries
  6. For EACH card:
     a. Fill all fields (use Edit, or Write if Edit causes syntax errors)
     b. **NEW: Add diagram planning** (diagram_eligible, diagram_description, diagram_context, diagram_metadata)
     c. **🚨 VALIDATE using mcp__validator__validate_lesson_template**
     d. **Save validation result to /workspace/validation_result.json**
     e. Fix any errors and re-validate this card
     f. Mark card complete and move to next card
  7. After ALL cards validated individually, run final validation and save result
  8. ONLY THEN call @combined_lesson_critic

### 3. Lesson Author Strategy
- **Start with blank template**: The template already has correct card IDs, CFU types, and structure
- **Prefer Edit tool**: Fill individual fields incrementally (use Write if Edit causes syntax errors)
- **Fill cards ONE AT A TIME**: Complete all fields in card_001 before moving to card_002
- **Validate per-card**: After filling each card, validate immediately (prevents error accumulation)
- **Use research_subagent proactively**: Don't guess Scottish contexts or misconceptions
- **Example research queries**:
  * "Find 3 common misconceptions when students learn fractions of amounts"
  * "Suggest authentic Scottish shopping contexts for percentage discount problems"
  * "What is the I-We-You pedagogy progression for teaching mathematics?"
  * "Find exemplar National 5 mock exam question structures"

### 4. CRITICAL: Edit-First + Validate-Always Workflow

**Prefer Edit tool** but use Write if Edit causes syntax errors.

**ALWAYS validate frequently**:
- After filling EACH card (immediate feedback)
- After fixing syntax errors from Edit
- After using Write tool
- Final validation after all cards filled

Run: mcp__validator__validate_lesson_template {{"file_path": "lesson_template.json"}}

Validation catches schema errors at ~500 tokens.
Critic costs ~5,000-10,000 tokens.
Validate first to save 90-95% of error-fixing costs.

The blank template has been pre-generated with correct structure.
Edit preserves it best, but Write is acceptable if Edit fails.
See lesson_author_prompt_v2.md for detailed instructions.

---

### 5. Combined Lesson Critic v3 (iterate until pass)
- **Task**: Validate transformation fidelity + diagram coherence + schema compliance
- **Validation Strategy**:
  - **Schema Gate**: Hard pass/fail on schema requirements (ANY violation = instant fail)
  - **Dimension 1**: SOW-Template Fidelity (75% weight, ≥0.90 threshold) - Did lesson author preserve ALL SOW content?
  - **Dimension 2**: NEW: Lesson-Diagram Coherence (15% weight, ≥0.85 threshold) - Do diagrams support pedagogical goals?
  - **Dimension 3**: Basic Quality Checks (10% weight, ≥0.80 threshold) - Minimum quality requirements met?
  - **Focus**: Trust SOW author's pedagogy, validate transformation completeness + diagram integration + schema correctness
- **Inputs**:
  - `/workspace/lesson_template.json` (from step 2)
  - `/workspace/sow_entry_input.json` (pre-loaded)
  - `/workspace/Course_outcomes.json` (optional validation)
- **Output**: `/workspace/critic_result.json`
- **Delegate to**: @combined_lesson_critic
- **Logic**:
  - If overall_pass = false:
    - Pass feedback to yourself for revision
    - Revise lesson_template.json
    - Re-run @combined_lesson_critic
  - If overall_pass = true: proceed to completion

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
