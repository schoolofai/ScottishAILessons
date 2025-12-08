"""Main Mock Exam Author Claude Agent implementation.

Orchestrates a 2-subagent pipeline to author mock exams from Authored_SOW
mock_exam entries to Appwrite mock_exams collection.

Pipeline architecture:
    Pre-processing (Python):
    0. Mock Exam Extractor → Extracts mock_exam entries from Authored_SOW

    Agent execution (2 subagents):
    1. Mock Exam Author → Transforms SOW entry to frontend-ready exam JSON
    2. UX Critic → Validates UX quality for static frontend presentation

    Post-processing (Python):
    3. Upserter → Writes to Appwrite default.mock_exams collection
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

# Import MockExam Pydantic model for structured output schema
from .tools.mock_exam_schema_models import MockExam

from .utils.filesystem import IsolatedFilesystem
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging, add_workspace_file_handler, remove_workspace_file_handler
from .tools.mock_exam_validator_tool import mock_exam_validation_server

# Diagram MCP server factories
from .tools.desmos_tool import create_desmos_server
from .tools.matplotlib_tool import create_matplotlib_server
from .tools.plotly_tool import create_plotly_server
from .tools.jsxgraph_tool import create_jsxgraph_server
from .tools.imagen_tool import create_imagen_server

# HTTP client for health checks
import httpx

logger = logging.getLogger(__name__)

# Set maximum output token limit for Claude Agent SDK
os.environ.setdefault('CLAUDE_CODE_MAX_OUTPUT_TOKENS', '100000')
logger.info("Set CLAUDE_CODE_MAX_OUTPUT_TOKENS=100000 (agent output budget)")


class MockExamAuthorClaudeAgent:
    """Autonomous mock exam authoring pipeline using Claude Agent SDK.

    Pre-processing (Python):
    0. Mock Exam Extractor → Creates mock_exam_source.json and sow_context.json

    Pipeline execution (2 subagents):
    1. Mock Exam Author → Creates mock_exam.json
    2. UX Critic → Validates and creates mock_exam_critic_result.json (with retry)

    Post-processing (Python):
    3. Upserter → Writes to Appwrite default.mock_exams

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across all subagents

    Architecture Notes:
        - Mock exam extraction moved to Python (deterministic, no LLM needed)
        - Only creative/judgmental tasks use LLM agents (authoring, UX critique)
        - Upserting handled by Python (deterministic, no LLM needed)
        - Static frontend: Mock exams render as complete pages, not LangGraph chat
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "INFO"
    ):
        """Initialize Mock Exam Author agent.

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

        logger.info(f"Initialized MockExamAuthorClaudeAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Raises:
            FileNotFoundError: If prompt files are missing
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load subagent prompts (5 subagents: 2 core + 3 diagram)
        subagents = {
            # Core pipeline subagents
            "mock_exam_author": AgentDefinition(
                description="Mock exam author for transforming SOW entry to frontend-ready exam JSON",
                prompt=(prompts_dir / "mock_exam_author_prompt.md").read_text()
            ),
            "ux_critic": AgentDefinition(
                description="UX critic for validating mock exam quality for static frontend presentation",
                prompt=(prompts_dir / "mock_exam_ux_critic_prompt.md").read_text()
            ),

            # Diagram pipeline subagents (reusable)
            "diagram_classifier": AgentDefinition(
                description="Classifies content to determine optimal diagram rendering tool (DESMOS, MATPLOTLIB, JSXGRAPH, PLOTLY, IMAGE_GENERATION, or NONE)",
                prompt=(prompts_dir / "diagram_classification_subagent.md").read_text()
            ),
            "diagram_author": AgentDefinition(
                description="Generates diagrams using REST API tools based on classification",
                prompt=(prompts_dir / "diagram_author_subagent.md").read_text()
            ),
            "diagram_critic": AgentDefinition(
                description="Validates generated diagrams for educational quality using Claude's multimodal vision",
                prompt=(prompts_dir / "diagram_critic_subagent.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions (2 core + 3 diagram)")
        return subagents

    def _get_diagram_mcp_servers(self, workspace_path: Path) -> Dict[str, Any]:
        """Create diagram MCP servers with workspace configuration.

        Creates separate MCP servers for each diagram tool type. Each server
        has the workspace path captured in closure for file-based output.

        Args:
            workspace_path: Absolute path to workspace directory

        Returns:
            Dictionary mapping server names to MCP server instances

        Environment Variables:
            DIAGRAM_SCREENSHOT_URL: Base URL for DiagramScreenshot service (default: http://localhost:3001)
            DIAGRAM_SCREENSHOT_API_KEY: API key for DiagramScreenshot service (default: dev-api-key-change-in-production)
        """
        api_base_url = os.getenv("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
        api_key = os.getenv("DIAGRAM_SCREENSHOT_API_KEY", "dev-api-key-change-in-production")
        ws_path = str(workspace_path)

        logger.info(f"Creating diagram MCP servers with API URL: {api_base_url}")
        logger.info(f"API key configured: {'Yes (from env)' if os.getenv('DIAGRAM_SCREENSHOT_API_KEY') else 'Using default dev key'}")

        diagram_servers = {
            "desmos": create_desmos_server(ws_path, api_base_url, api_key),
            "matplotlib": create_matplotlib_server(ws_path, api_base_url, api_key),
            "plotly": create_plotly_server(ws_path, api_base_url, api_key),
            "jsxgraph": create_jsxgraph_server(ws_path, api_base_url, api_key),
            "imagen": create_imagen_server(ws_path, api_base_url, api_key),
        }

        logger.info(f"Created {len(diagram_servers)} diagram MCP servers")
        return diagram_servers

    def _copy_diagram_examples_to_workspace(self, workspace_path: Path) -> Dict[str, Any]:
        """Copy validated diagram examples to workspace for agent reference.

        These TypeScript example files contain VALIDATED, production-tested
        diagram configurations that render correctly. The diagram_author
        subagent should READ these files before generating diagrams.

        Args:
            workspace_path: Path to the isolated workspace directory

        Returns:
            dict with:
                - copied: bool
                - path: str (examples directory path)
                - inventory: dict (tool -> example filename)
                - error: str (if copy failed)

        Architecture Note:
            By copying examples to workspace, the agent has direct file access
            via Read tool without needing external file paths. This follows
            the pattern of isolated workspace containing all needed context.
        """
        import shutil

        # Source: diagramScreenshot/tests/examples/*.examples.ts
        # Path relative to this file: ../../diagramScreenshot/tests/examples
        examples_source = (
            Path(__file__).parent.parent.parent /
            "diagramScreenshot" / "tests" / "examples"
        )
        examples_dest = workspace_path / "diagram_examples"

        logger.info(f"📂 Copying diagram examples from: {examples_source}")
        logger.info(f"📂 To workspace: {examples_dest}")

        if not examples_source.exists():
            error_msg = f"Diagram examples not found at {examples_source}"
            logger.error(f"❌ {error_msg}")
            # FAIL FAST - no fallback per CLAUDE.md
            raise RuntimeError(error_msg)

        # Create destination directory
        examples_dest.mkdir(parents=True, exist_ok=True)

        # Copy TypeScript example files (matplotlib uses .py for Python examples)
        example_files = [
            "desmos.examples.ts",
            "matplotlib.examples.py",
            "jsxgraph.examples.ts",
            "plotly.examples.ts",
            "imagen.examples.ts"
        ]

        inventory = {}
        copied_count = 0

        for filename in example_files:
            src = examples_source / filename
            if src.exists():
                shutil.copy(src, examples_dest / filename)
                tool_name = filename.replace(".examples.ts", "").upper()
                inventory[tool_name] = filename
                copied_count += 1
                logger.info(f"   ✅ Copied: {filename} ({tool_name})")
            else:
                logger.warning(f"   ⚠️ Missing: {filename}")

        if copied_count == 0:
            error_msg = "No diagram example files found to copy"
            logger.error(f"❌ {error_msg}")
            raise RuntimeError(error_msg)

        logger.info(f"✅ Copied {copied_count}/{len(example_files)} diagram example files")

        return {
            "copied": True,
            "path": str(examples_dest),
            "inventory": inventory,
            "count": copied_count
        }

    async def _verify_diagram_services_health(self) -> Dict[str, Any]:
        """Verify diagram rendering services are healthy before agent execution.

        This implements the FAIL-FAST pattern as required by CLAUDE.md.
        The agent should not start if diagram services are unavailable.

        Returns:
            Health check result containing:
                - healthy: bool (all required renderers available)
                - renderers: dict (status of each renderer)
                - error: str (if any renderer unavailable)

        Raises:
            RuntimeError: If diagram services are unavailable (fail-fast)
        """
        api_base_url = os.getenv("DIAGRAM_SCREENSHOT_URL", "http://localhost:3001")
        api_key = os.getenv("DIAGRAM_SCREENSHOT_API_KEY", "dev-api-key-change-in-production")

        logger.info(f"🏥 Verifying diagram services health at: {api_base_url}/health")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{api_base_url}/health",
                    headers={"X-API-Key": api_key}
                )

                if response.status_code != 200:
                    error_msg = (
                        f"Diagram service health check failed with status {response.status_code}. "
                        f"URL: {api_base_url}/health. "
                        f"Response: {response.text[:200]}"
                    )
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

                health_data = response.json()

                # Verify service is healthy
                if health_data.get("status") != "healthy":
                    error_msg = (
                        f"Diagram service reports unhealthy status: {health_data.get('status')}. "
                        f"Service may be starting up or have configuration issues."
                    )
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

                # Verify all required renderers are initialized
                renderers = health_data.get("renderers", {})
                # Note: matplotlib runs locally, not via DiagramScreenshot service
                required_renderers = ["jsxgraph", "plotly", "desmos", "imagen"]
                unavailable_renderers = []

                for renderer in required_renderers:
                    renderer_status = renderers.get(renderer, {})
                    # Check for 'initialized' (most renderers) or 'configured' (imagen)
                    is_ready = (
                        renderer_status.get("initialized", False) or
                        renderer_status.get("configured", False)
                    )
                    if not is_ready:
                        unavailable_renderers.append(renderer)

                if unavailable_renderers:
                    error_msg = (
                        f"Required diagram renderers not initialized: {unavailable_renderers}. "
                        f"Available renderers: {list(renderers.keys())}. "
                        f"The diagram service may need to be restarted or rebuilt."
                    )
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

                # Verify Playwright browser is ready
                playwright_status = health_data.get("playwright", {})
                if not playwright_status.get("initialized", False):
                    error_msg = (
                        "Playwright browser not initialized in diagram service. "
                        "This is required for rendering. Try restarting the service."
                    )
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)

                logger.info(
                    f"✅ Diagram services healthy: "
                    f"{len(required_renderers)} renderers available, "
                    f"Playwright initialized, "
                    f"uptime={health_data.get('uptime', 0):.1f}s"
                )

                return {
                    "healthy": True,
                    "renderers": renderers,
                    "playwright": playwright_status,
                    "uptime": health_data.get("uptime", 0)
                }

        except httpx.ConnectError as e:
            error_msg = (
                f"Cannot connect to diagram service at {api_base_url}. "
                f"Please ensure the diagramScreenshot service is running. "
                f"Start it with: cd diagramScreenshot && docker compose up -d. "
                f"Connection error: {e}"
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        except httpx.TimeoutException as e:
            error_msg = (
                f"Diagram service health check timed out at {api_base_url}. "
                f"Service may be starting up or overloaded. "
                f"Timeout error: {e}"
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        except Exception as e:
            if isinstance(e, RuntimeError):
                raise  # Re-raise RuntimeError as-is
            error_msg = (
                f"Unexpected error during diagram service health check: {e}. "
                f"URL: {api_base_url}/health"
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg)

    async def _validate_prerequisites(self, courseId: str) -> Dict[str, Any]:
        """Validate prerequisites before running pipeline.

        Checks:
        1. Published SOW exists for courseId
        2. SOW contains at least one mock_exam entry

        Args:
            courseId: Course identifier

        Returns:
            Validation result dictionary with mock_exam_count

        Raises:
            ValueError: If prerequisites not met (fail-fast)
        """
        logger.info(f"Validating prerequisites for courseId='{courseId}'")

        from .utils.mock_exam_extractor import validate_mock_exam_prerequisites

        validation_result = await validate_mock_exam_prerequisites(
            courseId=courseId,
            mcp_config_path=str(self.mcp_config_path)
        )

        logger.info(
            f"Prerequisites validated: {validation_result['mock_exam_count']} "
            f"mock exam(s) found"
        )

        return validation_result

    async def _check_existing_mock_exam(
        self,
        courseId: str,
        version: str
    ) -> Optional[Dict[str, Any]]:
        """Check if mock exam already exists for courseId AND version.

        Uses FAIL FAST pattern - raises exception if corruption detected.

        Args:
            courseId: Course identifier
            version: Mock exam version to check

        Returns:
            Existing mock exam document if found, None otherwise

        Raises:
            ValueError: If multiple mock exams found (data corruption)
        """
        logger.info(f"Duplicate check: courseId='{courseId}', version='{version}'")

        from .utils.appwrite_mcp import list_appwrite_documents

        existing_exams = await list_appwrite_documents(
            database_id="default",
            collection_id="mock_exams",
            queries=[
                f'equal("courseId", "{courseId}")',
                f'equal("version", "{version}")'
            ],
            mcp_config_path=str(self.mcp_config_path)
        )

        if len(existing_exams) > 1:
            error_msg = (
                f"DATA CORRUPTION DETECTED: Found {len(existing_exams)} mock exams for "
                f"courseId='{courseId}', version='{version}'. "
                f"Database integrity violated. Manual cleanup required.\n"
                f"Document IDs: {[exam.get('$id') for exam in existing_exams]}"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        if existing_exams:
            exam = existing_exams[0]
            logger.info(
                f"Found existing mock exam: {exam['$id']} "
                f"(status={exam.get('status')}, created={exam.get('$createdAt')})"
            )
            return exam
        else:
            logger.info(f"No existing mock exam found for version '{version}'")
            return None

    async def execute(
        self,
        courseId: str,
        version: str = "1",
        force: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Execute the complete mock exam authoring pipeline.

        The pipeline extracts mock_exam entries from Authored_SOW, transforms them
        to frontend-ready JSON, validates UX quality, and upserts to Appwrite.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            version: Mock exam version number (default: "1")
            force: If True, overwrite existing mock exam for this version
            dry_run: If True, generate mock exam but don't upsert to Appwrite

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - mock_exam_id: str (examId from JSON)
                - appwrite_document_id: str (if successful and not dry_run)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If validation fails or prerequisites not met
            FileNotFoundError: If MCP config or prompts missing
        """
        # Step 1: Validate version format
        if not version.isdigit():
            error_msg = f"Version must be a numeric string (e.g., '1', '2'), got: '{version}'"
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info(
            f"Mock Exam Authoring Pipeline: courseId='{courseId}', "
            f"version='{version}', force={force}, dry_run={dry_run}"
        )

        # Step 2: Validate prerequisites (published SOW with mock_exam entries)
        try:
            prereq_result = await self._validate_prerequisites(courseId)
        except Exception as e:
            logger.error(f"Prerequisite validation failed: {e}")
            raise ValueError(f"Prerequisites not met: {e}")

        # Step 2.5: Verify diagram services are healthy (FAIL-FAST)
        # This prevents the agent from starting if diagram services are unavailable,
        # avoiding wasted LLM tokens and cryptic errors during diagram generation.
        try:
            diagram_health = await self._verify_diagram_services_health()
            logger.info(
                f"Diagram services ready: {len(diagram_health['renderers'])} renderers, "
                f"uptime={diagram_health['uptime']:.1f}s"
            )
        except RuntimeError as e:
            logger.error(f"Diagram service health check failed: {e}")
            raise ValueError(
                f"Diagram services unavailable - cannot proceed with mock exam authoring. "
                f"Details: {e}"
            )

        # Step 3: Check for existing mock exam (fail-fast unless force)
        if not dry_run:
            existing_exam = await self._check_existing_mock_exam(courseId, version)

            if existing_exam and not force:
                error_msg = (
                    f"Mock exam version {version} already exists for courseId '{courseId}'.\n"
                    f"  Document ID: {existing_exam['$id']}\n"
                    f"  Status: {existing_exam.get('status', 'UNKNOWN')}\n"
                    f"  Created: {existing_exam.get('$createdAt', 'UNKNOWN')}\n"
                    f"  Use --force flag to overwrite this version."
                )
                logger.error(error_msg)
                raise ValueError(error_msg)

            if existing_exam and force:
                logger.warning(
                    f"FORCE MODE: Will overwrite existing mock exam version {version} "
                    f"(Document ID: {existing_exam['$id']})"
                )

        logger.info(f"Starting mock exam authoring pipeline for courseId '{courseId}'")

        try:
            # Create isolated workspace
            with IsolatedFilesystem(
                self.execution_id,
                persist=self.persist_workspace,
                workspace_type="mock_exam"
            ) as filesystem:
                workspace_path = filesystem.root

                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # WORKSPACE FILE LOGGING: Capture all activity to run.log
                # ═══════════════════════════════════════════════════════════════
                log_file_path = add_workspace_file_handler(
                    workspace_path=workspace_path,
                    log_filename="run.log",
                    log_level="DEBUG"  # Capture everything in file
                )
                logger.info(f"📝 All agent activity will be logged to: {log_file_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract mock_exam entries via Python (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Extracting mock_exam entries via Python utility...")

                from .utils.mock_exam_extractor import extract_mock_exam_entries_to_workspace

                mock_exam_entries, sow_metadata = await extract_mock_exam_entries_to_workspace(
                    courseId=courseId,
                    mcp_config_path=str(self.mcp_config_path),
                    workspace_path=workspace_path
                )

                logger.info(
                    f"✅ Pre-processing complete: "
                    f"{len(mock_exam_entries)} mock_exam entry(ies) extracted"
                )
                logger.info("   Python extraction complete - no LLM tokens used")

                # ═══════════════════════════════════════════════════════════════
                # COPY DIAGRAM EXAMPLES: Validated examples for agent reference
                # ═══════════════════════════════════════════════════════════════
                logger.info("Copying diagram examples to workspace...")
                examples_result = self._copy_diagram_examples_to_workspace(workspace_path)
                logger.info(
                    f"✅ Diagram examples ready: {examples_result['count']} files in "
                    f"{examples_result['path']}"
                )
                for tool, filename in examples_result['inventory'].items():
                    logger.info(f"   📄 {tool}: {filename}")

                # MCP servers configuration (Pydantic validator + 5 diagram tools)
                mcp_servers_for_mock_exam = {
                    "validator": mock_exam_validation_server
                }

                # Add diagram MCP servers
                diagram_servers = self._get_diagram_mcp_servers(workspace_path)
                mcp_servers_for_mock_exam.update(diagram_servers)

                logger.info(
                    f"SDK MCP servers registered: validator + {len(diagram_servers)} diagram tools"
                )

                # Configure Claude SDK client with structured output
                # Structured output guarantees valid JSON matching MockExam schema
                mock_exam_schema = MockExam.model_json_schema()
                logger.info(f"Generated MockExam JSON schema for structured output")

                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',
                    mcp_servers=mcp_servers_for_mock_exam,
                    allowed_tools=[
                        # Core tools (Write/Edit removed - structured output handles JSON)
                        'Read', 'Glob', 'Grep', 'TodoWrite', 'Task',
                        # Schema validation (kept for secondary semantic validation)
                        'mcp__validator__validate_mock_exam_schema',
                        # Diagram tools (5 separate MCP servers)
                        'mcp__desmos__render_desmos',
                        'mcp__matplotlib__render_matplotlib',
                        'mcp__plotly__render_plotly',
                        'mcp__jsxgraph__render_jsxgraph',
                        'mcp__imagen__render_imagen'
                    ],
                    max_turns=500,  # Increased for debugging - allows full pipeline execution
                    cwd=str(workspace_path),
                    # NEW: Structured output configuration - SDK guarantees valid JSON
                    output_format={
                        "type": "json_schema",
                        "schema": mock_exam_schema
                    }
                )

                logger.info(
                    f"Agent configured: bypassPermissions + validator + 5 diagram tools "
                    f"+ structured_output + cwd={workspace_path} + max_turns=500"
                )

                # Execute pipeline (5 subagents: 2 core + 3 diagram)
                # Phase 1: mock_exam_author - Creates mock_exam.json
                # Phase 2: ux_critic - Validates UX quality
                # Phase 3: diagram_classifier + diagram_author + diagram_critic - Generate diagrams
                async with ClaudeSDKClient(options) as client:
                    initial_prompt = self._build_initial_prompt(
                        courseId=courseId,
                        sow_metadata=sow_metadata,
                        workspace_path=str(workspace_path)
                    )

                    logger.info("Sending initial prompt to Claude Agent SDK...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream (expecting structured output)...")
                    message_count = 0
                    structured_result = None

                    async for message in client.receive_messages():
                        message_count += 1

                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Check for structured output in result
                            if hasattr(message, 'structured_output') and message.structured_output:
                                structured_result = message.structured_output
                                logger.info(f"✅ Structured output received after {message_count} messages")
                            elif hasattr(message, 'subtype') and message.subtype == 'error_max_structured_output_retries':
                                raise RuntimeError(
                                    "Agent could not produce valid MockExam schema after max retries. "
                                    "Check schema complexity or prompt clarity."
                                )
                            else:
                                logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # ═══════════════════════════════════════════════════════════════
                # WRITE STRUCTURED OUTPUT TO FILE
                # ═══════════════════════════════════════════════════════════════
                mock_exam_file_path = workspace_path / "mock_exam.json"

                if structured_result:
                    # Validate with Pydantic (belt-and-suspenders)
                    logger.info("Validating structured output with Pydantic...")
                    mock_exam_validated = MockExam.model_validate(structured_result)
                    logger.info(
                        f"✅ Pydantic validation passed: examId={mock_exam_validated.examId}, "
                        f"questions={mock_exam_validated.summary.total_questions}"
                    )

                    # Write validated JSON to workspace file
                    with open(mock_exam_file_path, 'w') as f:
                        f.write(mock_exam_validated.model_dump_json(indent=2))
                    logger.info(f"✅ Structured output written to {mock_exam_file_path}")
                else:
                    # No structured output - check if agent wrote file directly (fallback check)
                    if not mock_exam_file_path.exists():
                        raise RuntimeError(
                            "No structured output received and no mock_exam.json found in workspace. "
                            "Agent pipeline failed to produce exam."
                        )
                    logger.warning(
                        "⚠️ No structured_output in result - using agent-written file"
                    )

                # ═══════════════════════════════════════════════════════════════
                # POST-PROCESSING: Upsert to Appwrite via Python (NO AGENT)
                # ═══════════════════════════════════════════════════════════════

                if dry_run:
                    logger.info("[DRY RUN] Skipping Appwrite upsert")

                    # Read mock exam to get examId for return value
                    if mock_exam_file_path.exists():
                        with open(mock_exam_file_path) as f:
                            mock_exam_data = json.load(f)
                        mock_exam_id = mock_exam_data.get("examId", "")
                    else:
                        mock_exam_id = ""

                    appwrite_document_id = None
                else:
                    logger.info("Starting deterministic Python upserter...")

                    from .utils.mock_exam_upserter import upsert_mock_exam_to_appwrite

                    appwrite_document_id = await upsert_mock_exam_to_appwrite(
                        mock_exam_file_path=str(mock_exam_file_path),
                        courseId=courseId,
                        version=version,
                        mcp_config_path=str(self.mcp_config_path),
                        force=force
                    )

                    logger.info(f"Mock exam upserted successfully: {appwrite_document_id}")

                    # Read mock exam to get examId
                    with open(mock_exam_file_path) as f:
                        mock_exam_data = json.load(f)
                    mock_exam_id = mock_exam_data.get("examId", "")

                # Generate final report
                metrics_report = format_cost_report(self.cost_tracker)
                logger.info("\n" + metrics_report)

                result = {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "mock_exam_id": mock_exam_id,
                    "metrics": self.cost_tracker.get_summary()
                }

                if not dry_run:
                    result["appwrite_document_id"] = appwrite_document_id

                # Log completion to file before cleanup
                logger.info("=" * 80)
                logger.info("✅ PIPELINE COMPLETED SUCCESSFULLY")
                logger.info(f"   Mock Exam ID: {mock_exam_id}")
                logger.info(f"   Workspace: {workspace_path}")
                logger.info(f"   Log file: {workspace_path}/run.log")
                logger.info("=" * 80)

                # Cleanup workspace file handler
                remove_workspace_file_handler(workspace_path)

                return result

        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}", exc_info=True)

            # Try to cleanup file handler if workspace was created
            try:
                if 'workspace_path' in locals():
                    logger.error(f"❌ PIPELINE FAILED - See {workspace_path}/run.log for details")
                    remove_workspace_file_handler(workspace_path)
            except Exception:
                pass  # Ignore cleanup errors

            return {
                "success": False,
                "execution_id": self.execution_id,
                "error": str(e),
                "metrics": self.cost_tracker.get_summary()
            }

    def _build_initial_prompt(
        self,
        courseId: str,
        sow_metadata: Dict[str, Any],
        workspace_path: str
    ) -> str:
        """Build the initial orchestration prompt for the main agent.

        Args:
            courseId: Course identifier
            sow_metadata: SOW metadata extracted during pre-processing
            workspace_path: Path to workspace

        Returns:
            Initial prompt string
        """
        subject = sow_metadata.get('subject', 'unknown')
        level = sow_metadata.get('level', 'unknown')

        return f"""# Mock Exam Authoring Pipeline - Main Orchestrator

You are orchestrating the autonomous authoring of a Mock Exam for Scottish secondary education.

## ⚠️ CRITICAL: SUBAGENT INVOCATION RULES ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT**: You MUST use the **Task tool** to invoke subagents.
Writing "@subagent_name" as text will NOT invoke the subagent - it will just
output text and the pipeline will FAIL SILENTLY!

**WRONG** (does nothing):
```
Delegating to @mock_exam_author...
```

**CORRECT** (actually invokes subagent):
```
Use Task tool with:
  subagent_type: "mock_exam_author"
  prompt: "Read /workspace/mock_exam_source.json and /workspace/sow_context.json..."
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Input Specification
- **Course ID**: {courseId}
- **Subject**: {subject}
- **Level**: {level}
- **SOW ID**: {sow_metadata.get('sowId', '')}

## Workspace
All files will be created in: {workspace_path}

## Pre-Processing (Complete)
✅ `mock_exam_source.json` - Mock exam entry extracted from Authored_SOW
   - Location: `/workspace/mock_exam_source.json`
   - Contains: courseId, sowId, mock_exam_entries array

✅ `sow_context.json` - Course-level SOW metadata
   - Location: `/workspace/sow_context.json`
   - Contains: subject, level, accessibility_notes, engagement_notes

✅ `diagram_examples/` - Validated diagram examples (CRITICAL for diagram generation)
   - Location: `/workspace/diagram_examples/`
   - Contains: desmos.examples.ts, matplotlib.examples.py, jsxgraph.examples.ts, plotly.examples.ts, imagen.examples.ts
   - **MUST READ** before generating any diagrams

✅ **Pydantic Schema Validator** - Deterministic validation tool
   - Tool: `mcp__validator__validate_mock_exam_schema`
   - Purpose: Fast schema validation with specific error locations

✅ **Diagram MCP Tools** - 5 separate diagram rendering tools
   - `mcp__desmos__render_desmos` - Function graphing
   - `mcp__matplotlib__render_matplotlib` - Geometric constructions (local Python)
   - `mcp__plotly__render_plotly` - Statistical charts
   - `mcp__jsxgraph__render_jsxgraph` - Coordinate geometry/transformations
   - `mcp__imagen__render_imagen` - Real-world context images

## Pipeline Execution

Execute the following phases in sequence:

### Phase 1: Mock Exam Author
- **Task**: Transform SOW mock_exam entry to frontend-ready exam JSON
- **Inputs**:
  - `/workspace/mock_exam_source.json` (pre-populated)
  - `/workspace/sow_context.json` (pre-populated)
- **Output**: `/workspace/mock_exam.json`
- **Invocation**: Use **Task tool** with subagent_type="mock_exam_author"
  ```
  prompt: "Read /workspace/mock_exam_source.json and /workspace/sow_context.json.
           Transform the SOW mock_exam entry to frontend-ready exam JSON.
           Output to /workspace/mock_exam.json"
  ```
- **Validation**: Use `mcp__validator__validate_mock_exam_schema` frequently

### Phase 2: UX Critic (iterate until pass)
- **Task**: Validate mock exam UX quality for static frontend presentation
- **Inputs**:
  - `/workspace/mock_exam.json` (from author)
  - `/workspace/mock_exam_source.json` (for cross-reference)
  - `/workspace/sow_context.json` (for context)
- **Output**: `/workspace/mock_exam_critic_result.json`
- **Invocation**: Use **Task tool** with subagent_type="ux_critic"
  ```
  prompt: "Read /workspace/mock_exam.json and validate UX quality.
           Cross-reference with /workspace/mock_exam_source.json.
           Output critique to /workspace/mock_exam_critic_result.json"
  ```
- **Logic**:
  - If schema_gate fails: FAIL immediately
  - If dimensional scores fail (any < 3.5): Provide feedback
  - If overall_pass = false:
    - Use **Task tool** with subagent_type="mock_exam_author" (pass feedback in prompt)
    - Re-run **Task tool** with subagent_type="ux_critic"
  - If overall_pass = true: Continue to Phase 3

### Phase 3: Diagram Generation (BATCH CLASSIFICATION + INDIVIDUAL GENERATION)

**CRITICAL EFFICIENCY**: The diagram classification MUST be done in ONE batch call, not one question at a time.

#### Step 1: BATCH CLASSIFY ALL QUESTIONS (ONE Task tool call)

Extract ALL questions from `mock_exam.json` and write to `/workspace/classification_input.json`:

```json
{{
  "batch_mode": true,
  "exam_metadata": {{
    "subject": "{subject}",
    "level": "{level}"
  }},
  "questions": [
    {{
      "question_id": "q1",
      "question_number": 1,
      "question_stem": "<from mock_exam.json>",
      "question_stem_plain": "<from mock_exam.json>",
      "topic": "<inferred from question context>"
    }},
    {{
      "question_id": "q2",
      "question_number": 2,
      "question_stem": "...",
      "question_stem_plain": "...",
      "topic": "..."
    }}
    // ... ALL questions from ALL sections
  ]
}}
```

**Invocation**: Use **Task tool** with subagent_type="diagram_classifier"
```
prompt: "Read /workspace/classification_input.json containing all questions.
         Classify each question for diagram requirements.
         Output classifications to /workspace/classification_output.json"
```

Wait for subagent to complete, then read `/workspace/classification_output.json`:
```json
{{
  "batch_mode": true,
  "total_questions": 25,
  "questions_needing_diagrams": 12,
  "questions_no_diagram": 13,
  "classifications": [
    {{ "question_id": "q1", "tool": "DESMOS", ... }},
    {{ "question_id": "q2", "tool": "NONE", ... }},
    // ... one entry per question
  ]
}}
```

#### Step 2: GENERATE DIAGRAMS (only for questions where tool != NONE)

**FOR EACH classification where `tool != "NONE"`:**

1. **Diagram Generation** (via Task tool):
   - Write request to **UNIQUE FILE**: `/workspace/diagram_requests/diagram_request_{{question_id}}.json`:
     ```json
     {{
       "classification": <classification for this question>,
       "content": <question content from mock_exam.json>,
       "output_config": {{
         "card_id": "<question_id>",
         "context": "question",
         "diagram_index": 0
       }},
       "examples_path": "/workspace/diagram_examples"
     }}
     ```
   - **Invocation**: Use **Task tool** with subagent_type="diagram_author"
     ```
     prompt: "Read /workspace/diagram_requests/diagram_request_{{question_id}}.json.
              CRITICAL: Read the appropriate example file from /workspace/diagram_examples/
              based on the classified tool (e.g., matplotlib.examples.py for MATPLOTLIB).
              Generate diagram using the MCP tool.
              Output PNG to /workspace/diagrams/{{question_id}}_question.png
              Output metadata to /workspace/diagram_outputs/diagram_metadata_{{question_id}}.json"
     ```

2. **Diagram Critique** (via Task tool):
   - Write request to **UNIQUE FILE**: `/workspace/critique_requests/critique_request_{{question_id}}.json`:
     ```json
     {{
       "image_path": "<from diagram_metadata_{{question_id}}.image_path>",
       "diagram_type": "<from classification>",
       "diagram_context": "question",
       "original_request": <classification>,
       "content": <question content>,
       "iteration": 1
     }}
     ```
   - **Invocation**: Use **Task tool** with subagent_type="diagram_critic"
     ```
     prompt: "Read /workspace/critique_requests/critique_request_{{question_id}}.json.
              View the image at image_path using Read tool.
              Critique against pedagogy/clarity/accuracy/aesthetics.
              Output to /workspace/critique_results/critique_result_{{question_id}}.json"
     ```

3. **Iteration Logic**:
   - If `decision == "ACCEPT"` or `decision == "ACCEPT_WITH_NOTES"`:
     - Update question's `diagram_refs` with image path
     - Move to next eligible question
   - If `decision == "REFINE"` AND `iteration < 3`:
     - Add `correction_prompt` from critique to diagram_request
     - Re-run **Task tool** with subagent_type="diagram_author" (incremented iteration)
     - Re-run **Task tool** with subagent_type="diagram_critic"
   - If `decision == "REJECT"` OR `iteration >= 3`:
     - Log warning, move to next question (best-effort)

#### Step 3: FINALIZE

1. **Update mock_exam.json**:
   - After all eligible questions processed, update each question's `diagram_refs`
   - Re-validate with `mcp__validator__validate_mock_exam_schema`

2. **Verification** (REQUIRED):
   - Confirm `/workspace/classification_input.json` contains ALL questions in batch format
   - Confirm `/workspace/classification_output.json` has classifications array with ALL questions
   - Report: "Classified X questions in 1 batch call, Y need diagrams, Z generated successfully"
   - If classification_output.json is missing or has wrong format, this is an ERROR

## Cost Tracking
After each subagent execution, use TodoWrite to log:
- Subagent name
- Token usage
- Estimated cost

## Final Output
When all phases complete successfully, report completion:
```
✅ Mock Exam Pipeline Complete
   - Questions authored: X
   - UX validation: PASSED
   - Diagrams generated: Y of Z eligible questions
   - Total marks: M
```

The authored mock exam will be persisted to Appwrite by the orchestrating system.

## Quality Requirements
- Every question must have question_stem_plain (accessibility)
- Marks must sum correctly at all levels
- Worked solutions must be complete and step-by-step
- Scottish contexts only (£, NHS, Scottish shops)
- Time estimates must be realistic
- Diagrams must NOT reveal answers for CFU/question contexts

## ❌ CRITICAL DON'T / ✅ CRITICAL DO

❌ DO NOT write "@subagent_name" as text - it does NOTHING
❌ DO NOT skip reading diagram examples before generation
❌ DO NOT overwrite files - use unique filenames per question
❌ DO NOT guess diagram syntax - use validated examples

✅ MUST use Task tool with subagent_type parameter to invoke subagents
✅ MUST read `/workspace/diagram_examples/*.examples.ts` before diagram generation
✅ MUST use unique file paths: `diagram_request_{{question_id}}.json`, `critique_request_{{question_id}}.json`
✅ MUST iterate with diagram_critic until score >= 0.85 or max 3 iterations

Begin pipeline execution now.
"""


async def main():
    """Example usage of Mock Exam Author agent."""
    agent = MockExamAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    result = await agent.execute(
        courseId="course_c84474",  # Must have published SOW with mock_exam entry
        version="1",
        dry_run=True  # Set to False to actually upsert
    )

    if result["success"]:
        print(f"✓ Mock exam authored successfully!")
        print(f"  Execution ID: {result['execution_id']}")
        print(f"  Workspace: {result['workspace_path']}")
        print(f"  Mock Exam ID: {result.get('mock_exam_id', 'N/A')}")
        if result.get('appwrite_document_id'):
            print(f"  Appwrite Doc ID: {result['appwrite_document_id']}")
        print(f"  Total Cost: ${result['metrics'].get('total_cost_usd', 0):.4f}")
    else:
        print(f"✗ Mock exam authoring failed: {result['error']}")


if __name__ == "__main__":
    asyncio.run(main())
