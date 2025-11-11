"""Diagram Author Claude Agent implementation.

Orchestrates a 2-subagent pipeline to generate JSXGraph diagrams for lesson templates
in Scottish secondary education.

Architecture:
    Pre-processing (Python):
    1. Fetch lesson template from Appwrite
    2. Filter eligible cards (LLM-based contextual analysis)
    3. Create workspace with lesson_template.json and eligible_cards.json

    Agent execution (2 subagents):
    4. Diagram Generation Subagent → Creates JSXGraph JSON and renders PNG
    5. Visual Critic Subagent → Validates quality across 4 dimensions

    Post-processing (Python):
    6. Upsert diagrams to default.lesson_diagrams collection
"""

import asyncio
import base64
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.validation import validate_diagram_author_input
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging
from .utils.diagram_extractor import fetch_lesson_template
from .utils.diagram_upserter import batch_upsert_diagrams
from .utils.diagram_validator import validate_diagram_output_schema
from .eligibility_analyzer_agent import EligibilityAnalyzerAgent
from .tools.diagram_screenshot_tool import create_diagram_screenshot_server_with_workspace, check_diagram_service_health

logger = logging.getLogger(__name__)


class DiagramAuthorClaudeAgent:
    """Autonomous diagram generation pipeline using Claude Agent SDK.

    Pre-processing (Python):
    1. Fetch lesson template from Appwrite (diagram_extractor.py)
    2. Filter eligible cards needing diagrams (LLM-based)
    3. Write lesson_template.json and eligible_cards.json to workspace

    Pipeline execution (2 subagents):
    4. Diagram Generation Subagent → Generates JSXGraph JSON + renders PNG
    5. Visual Critic Subagent → Critiques diagrams with 4D scoring

    Post-processing (Python):
    6. Upsert diagrams to Appwrite lesson_diagrams collection (diagram_upserter.py)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution (timestamp-based)
        cost_tracker: Tracks costs across all subagents

    Architecture Notes:
        - Lesson template fetching is Python utility (no LLM needed, saves tokens)
        - Card eligibility filtering is Python utility (simple heuristic for MVP)
        - Upserting is Python utility (deterministic, no LLM needed)
        - Only creative/judgmental tasks use LLM agents (diagram generation, critique)
        - Agent does NOT access Appwrite directly - pre/post-processing handles I/O
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "INFO"
    ):
        """Initialize Diagram Author agent.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace

        # Generate execution ID (timestamp-based)
        self.execution_id = datetime.now().strftime("exec_%Y%m%d_%H%M%S")

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging
        setup_logging(log_level=log_level)

        logger.info(f"Initialized DiagramAuthorClaudeAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Raises:
            FileNotFoundError: If prompt files are missing

        Note:
            2 subagents: diagram_generation_subagent, visual_critic_subagent
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 2 subagent prompts
        subagents = {
            "diagram_generation_subagent": AgentDefinition(
                description="Diagram generation subagent for creating JSXGraph visualizations and rendering PNG images",
                prompt=(prompts_dir / "diagram_generation_subagent.md").read_text()
            ),
            "visual_critic_subagent": AgentDefinition(
                description="Visual critic subagent for analyzing diagrams across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)",
                prompt=(prompts_dir / "visual_critic_subagent.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions")
        return subagents

    async def execute(
        self,
        courseId: str,
        order: int
    ) -> Dict[str, Any]:
        """Execute the complete diagram generation pipeline.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW (sow_order field)

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - diagrams_generated: int
                - diagrams_skipped: int (cards without diagrams)
                - diagrams_failed: int
                - appwrite_document_ids: List[str] (diagram document IDs)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If courseId or order invalid, or lesson template not found
            FileNotFoundError: If MCP config or prompts missing
            Exception: If DiagramScreenshot service unreachable (fast-fail)
        """
        # Validate input schema (courseId format, order ≥ 1)
        is_valid, error_msg = validate_diagram_author_input({
            "courseId": courseId,
            "order": order
        })
        if not is_valid:
            logger.error(f"Input validation failed: {error_msg}")
            raise ValueError(error_msg)

        # Validate DiagramScreenshot service is available (FR-065 health check)
        logger.info("Checking DiagramScreenshot service health...")
        health = check_diagram_service_health()
        if not health["available"]:
            error_msg = (
                f"DiagramScreenshot service is not available at {health['url']}. "
                f"Error: {health['error']}. "
                f"Ensure service is running: cd diagram-prototypes && docker compose up -d"
            )
            logger.error(f"❌ {error_msg}")
            raise Exception(error_msg)
        logger.info(f"✅ DiagramScreenshot service is healthy at {health['url']}")

        logger.info(f"Starting diagram generation pipeline for courseId '{courseId}', order {order}")

        try:
            # Create isolated workspace
            with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace, workspace_type="diagram") as filesystem:
                workspace_path = filesystem.root

                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Fetch lesson template and filter eligible cards
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Fetching lesson template via Python utility...")

                lesson_template = await fetch_lesson_template(
                    course_id=courseId,
                    order=order,
                    mcp_config_path=str(self.mcp_config_path)
                )

                lesson_template_id = lesson_template.get("$id", lesson_template.get("lessonTemplateId", "UNKNOWN"))
                title = lesson_template.get("title", "Untitled")
                total_cards = len(lesson_template.get("cards", []))

                logger.info(f"✅ Fetched lesson template: {lesson_template_id} - '{title}' ({total_cards} cards)")

                # Write lesson_template.json to workspace
                lesson_template_path = workspace_path / "lesson_template.json"
                with open(lesson_template_path, 'w') as f:
                    json.dump(lesson_template, f, indent=2)
                logger.info(f"✅ lesson_template.json written to workspace")

                # Filter eligible cards (Claude Agent SDK-based semantic analysis - FR-014, FR-015, FR-016)
                logger.info("Pre-processing: Filtering eligible cards via Claude Agent SDK eligibility analyzer...")

                eligibility_agent = EligibilityAnalyzerAgent()
                eligible_cards = await eligibility_agent.analyze(lesson_template)

                # ═══════════════════════════════════════════════════════════════
                # Eligibility Analysis Logging
                # ═══════════════════════════════════════════════════════════════

                cards_needing_diagrams = len(eligible_cards)
                excluded_count = total_cards - cards_needing_diagrams

                logger.info(f"📊 Eligibility Analysis Complete:")
                logger.info(f"   ✅ Eligible cards: {cards_needing_diagrams}")
                logger.info(f"   ❌ Excluded cards: {excluded_count}")

                # Log exclusion reasons breakdown (if any cards were excluded)
                if excluded_count > 0:
                    # Collect exclusion reasons from all cards
                    all_cards = lesson_template.get("cards", [])
                    eligible_ids = {card.get("id") for card in eligible_cards}

                    exclusion_reasons = {}
                    for card in all_cards:
                        card_id = card.get("id", "UNKNOWN")
                        if card_id not in eligible_ids:
                            # Card was excluded - find the reason (logged during extraction)
                            # For now, we'll indicate "Not eligible for JSXGraph diagram"
                            # In future, we could pass back reasons from extract_diagram_cards
                            reason = "Not eligible for JSXGraph diagram (LLM analysis)"
                            exclusion_reasons[reason] = exclusion_reasons.get(reason, 0) + 1

                    logger.info("📋 Exclusion Breakdown:")
                    for reason, count in sorted(exclusion_reasons.items(), key=lambda x: -x[1]):
                        logger.info(f"   - {reason}: {count} card(s)")

                logger.info(f"✅ Identified {cards_needing_diagrams}/{total_cards} cards needing diagrams")

                if cards_needing_diagrams == 0:
                    logger.info("No cards need diagrams - skipping agent execution")
                    return {
                        "success": True,
                        "execution_id": self.execution_id,
                        "workspace_path": str(workspace_path),
                        "diagrams_generated": 0,
                        "diagrams_skipped": total_cards,
                        "diagrams_failed": 0,
                        "appwrite_document_ids": [],
                        "metrics": self.cost_tracker.get_summary(),
                        "message": "No cards require diagrams"
                    }

                # Write eligible_cards.json to workspace
                eligible_cards_path = workspace_path / "eligible_cards.json"
                with open(eligible_cards_path, 'w') as f:
                    json.dump(eligible_cards, f, indent=2)
                logger.info(f"✅ eligible_cards.json written to workspace")

                # ═══════════════════════════════════════════════════════════════
                # Register MCP Tools for Diagram Author Agent
                # ═══════════════════════════════════════════════════════════════
                # ONLY register diagram_screenshot tool - Appwrite MCP excluded.
                #
                # Why Appwrite MCP Not Needed:
                # - Lesson template PRE-FETCHED by Python utility (diagram_extractor.py)
                # - Diagram author agent works with FILES in workspace, not database
                # - Removes ~50+ unused Appwrite tools from token context
                #
                # DiagramScreenshot MCP Tool (v1.0.0):
                # - Renders JSXGraph JSON to PNG via HTTP POST to localhost:3001
                # - Returns base64-encoded image on success
                # - Fast-fail on timeout (30s) or HTTP errors (4xx/5xx)
                # - Error format: {success: false, error: {code, message, details, suggestion}}
                #
                # Tool Name: mcp__diagram-screenshot__render_diagram
                # Implementation: src/tools/diagram_screenshot_tool.py
                # ═══════════════════════════════════════════════════════════════
                # Create MCP server with workspace path captured in closure
                diagram_screenshot_server = create_diagram_screenshot_server_with_workspace(str(workspace_path))
                mcp_servers_for_diagram_author = {
                    "diagram-screenshot": diagram_screenshot_server  # DiagramScreenshot with workspace path
                    # Appwrite MCP intentionally excluded - not used by diagram author
                }
                logger.info(f"Registered diagram-screenshot MCP tool with workspace: {workspace_path}")

                # Configure Claude SDK client with permission_mode='bypassPermissions'
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',  # CRITICAL: Bypass all permission prompts
                    mcp_servers=mcp_servers_for_diagram_author,  # Only diagram-screenshot MCP
                    allowed_tools=[
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
                        'WebSearch', 'WebFetch',
                        'mcp__diagram-screenshot__render_diagram'  # DiagramScreenshot tool
                    ],
                    max_turns=50,  # Reduced limit: 3 iterations per card + overhead (was 500)
                    cwd=str(workspace_path)  # Set agent working directory to isolated workspace
                )

                logger.info(f"Agent configured: bypassPermissions + cwd={workspace_path} + max_turns=50")

                # Execute pipeline (2 subagents: diagram_generation, visual_critic)
                async with ClaudeSDKClient(options) as client:
                    # Initial prompt to orchestrate subagents
                    initial_prompt = self._build_initial_prompt(
                        courseId=courseId,
                        order=order,
                        lesson_template_id=lesson_template_id,
                        title=title,
                        cards_needing_diagrams=cards_needing_diagrams,
                        workspace_path=str(workspace_path)
                    )

                    logger.info("Sending initial prompt to Claude Agent SDK...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream - logging ALL raw messages...")
                    message_count = 0

                    # Process messages until agent completion (2 subagents)
                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level (for debugging)
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            # Agent has completed pipeline
                            logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # ═══════════════════════════════════════════════════════════════
                # POST-PROCESSING: Parse diagrams_output.json and upsert to Appwrite
                # ═══════════════════════════════════════════════════════════════
                logger.info("Post-processing: Reading diagrams_output.json from workspace...")

                diagrams_output_path = workspace_path / "diagrams_output.json"
                if not diagrams_output_path.exists():
                    error_msg = f"Agent did not produce diagrams_output.json at {diagrams_output_path}"
                    logger.error(f"❌ {error_msg}")
                    raise FileNotFoundError(error_msg)

                with open(diagrams_output_path, 'r') as f:
                    diagrams_output = json.load(f)

                diagrams = diagrams_output.get("diagrams", [])
                errors = diagrams_output.get("errors", [])

                logger.info(f"✅ Parsed {len(diagrams)} diagrams, {len(errors)} errors from diagrams_output.json")

                if len(diagrams) == 0:
                    logger.warning("No diagrams generated successfully - all cards failed")
                    return {
                        "success": False,
                        "execution_id": self.execution_id,
                        "workspace_path": str(workspace_path),
                        "diagrams_generated": 0,
                        "diagrams_skipped": 0,
                        "diagrams_failed": len(errors),
                        "errors": errors,
                        "metrics": self.cost_tracker.get_summary(),
                        "message": "All diagram generation attempts failed"
                    }

                # ═══════════════════════════════════════════════════════════════
                # PHASE 4: VALIDATE IMAGE FILES AND LOAD PNG DATA (CRITICAL)
                # ═══════════════════════════════════════════════════════════════
                # FILE-BASED ARCHITECTURE: Check that ALL diagrams have image_path
                # and that the PNG files exist. Then load files and encode to base64
                # for Appwrite upload.
                #
                # Fast-fail principle: If even ONE diagram is missing its file,
                # the entire execution is marked as FAILED.
                # ═══════════════════════════════════════════════════════════════

                logger.info("Validating diagram files and loading PNG data...")

                missing_images = []
                for diagram in diagrams:
                    card_id = diagram.get("cardId", "unknown")
                    image_path = diagram.get("image_path")

                    # Check if image_path field exists
                    if not image_path or image_path == "null" or (isinstance(image_path, str) and image_path.strip() == ""):
                        missing_images.append({
                            "cardId": card_id,
                            "diagram_context": diagram.get("diagram_context", "unknown"),
                            "has_jsxgraph": bool(diagram.get("jsxgraph_json")),
                            "issue": "image_path is null, empty, or missing"
                        })
                        logger.error(f"❌ Diagram for card {card_id} is missing image_path field")
                        continue

                    # Check if file exists at the path
                    from pathlib import Path
                    file_path = Path(image_path)
                    if not file_path.exists():
                        missing_images.append({
                            "cardId": card_id,
                            "diagram_context": diagram.get("diagram_context", "unknown"),
                            "has_jsxgraph": bool(diagram.get("jsxgraph_json")),
                            "issue": f"PNG file not found at path: {image_path}"
                        })
                        logger.error(f"❌ PNG file not found: {image_path}")
                        continue

                    # Load PNG file and encode to base64
                    try:
                        png_bytes = file_path.read_bytes()
                        image_base64 = base64.b64encode(png_bytes).decode('utf-8')
                        diagram["image_base64"] = image_base64
                        logger.info(f"✅ Loaded PNG from {file_path.name} ({len(png_bytes)} bytes)")
                    except Exception as e:
                        missing_images.append({
                            "cardId": card_id,
                            "diagram_context": diagram.get("diagram_context", "unknown"),
                            "issue": f"Failed to read PNG file: {str(e)}"
                        })
                        logger.error(f"❌ Failed to read PNG file {image_path}: {e}")

                if missing_images:
                    error_msg = (
                        f"FAILED: {len(missing_images)}/{len(diagrams)} diagrams have missing or unreadable PNG files. "
                        f"The diagram generation subagent MUST call mcp__diagram-screenshot__render_diagram "
                        f"with card_id and diagram_context to write PNG files. "
                        f"Missing/failed diagrams: {[d['cardId'] for d in missing_images]}"
                    )
                    logger.error(f"❌ {error_msg}")

                    # Return failure response with detailed information
                    return {
                        "success": False,
                        "execution_id": self.execution_id,
                        "workspace_path": str(workspace_path),
                        "diagrams_generated": 0,  # No diagrams are usable without images
                        "diagrams_skipped": total_cards - cards_needing_diagrams,
                        "diagrams_failed": len(diagrams),  # All diagrams with missing images are failures
                        "errors": errors,
                        "missing_images": missing_images,
                        "metrics": self.cost_tracker.get_summary(),
                        "message": error_msg,
                        "troubleshooting": [
                            "Check if DiagramScreenshot service is running at http://localhost:3001",
                            "Review agent logs for render_diagram tool call attempts",
                            "Verify tool writes files to workspace/diagrams/ directory",
                            "Check file permissions in workspace directory",
                            f"Inspect {workspace_path}/diagrams_output.json for image_path values"
                        ]
                    }

                logger.info(f"✅ All {len(diagrams)} diagrams have valid PNG files loaded")

                # ═══════════════════════════════════════════════════════════════
                # FAST-FAIL VALIDATION: Ensure all diagrams have required fields
                # ═══════════════════════════════════════════════════════════════
                # This prevents KeyError during upsert and enforces agent prompt adherence
                logger.info("Validating diagram output schema (checking for jsxgraph_json field)...")

                validation_failures = {}
                for diagram in diagrams:
                    card_id = diagram.get("cardId", "UNKNOWN")
                    is_valid, errors = validate_diagram_output_schema(diagram, card_id)
                    if not is_valid:
                        validation_failures[card_id] = errors

                if validation_failures:
                    # Build detailed error message
                    total_failures = len(validation_failures)
                    error_details = []
                    for card_id, errors in validation_failures.items():
                        error_details.append(f"  • {card_id}: {', '.join(errors)}")

                    error_msg = (
                        f"❌ Agent output validation FAILED: {total_failures}/{len(diagrams)} diagrams "
                        f"missing required fields.\n\n"
                        f"Validation errors:\n" + "\n".join(error_details) + "\n\n"
                        f"This is a PROMPT ADHERENCE issue - the diagram generation subagent "
                        f"must include ALL required fields (especially jsxgraph_json) in diagrams_output.json.\n\n"
                        f"Troubleshooting:\n"
                        f"  1. Check workspace file: {workspace_path}/diagrams_output.json\n"
                        f"  2. Verify agent prompt includes jsxgraph_json in output schema\n"
                        f"  3. Check if agent is discarding JSXGraph JSON after PNG generation\n"
                        f"  4. Review agent logs for prompt adherence issues"
                    )
                    logger.error(error_msg)

                    # Throw exception to fail fast (no fallback mechanism)
                    raise ValueError(error_msg)

                logger.info(f"✅ Schema validation passed: All {len(diagrams)} diagrams have required fields (including jsxgraph_json)")

                # Prepare diagrams for batch upsert
                logger.info("Starting batch upsert to Appwrite lesson_diagrams collection...")

                diagrams_data = [
                    {
                        "lesson_template_id": lesson_template_id,
                        "card_id": diagram["cardId"],
                        "jsxgraph_json": diagram["jsxgraph_json"],
                        "image_base64": diagram["image_base64"],
                        "diagram_type": diagram["diagram_type"],
                        "diagram_context": diagram.get("diagram_context"),  # Optional - may not be present in older runs
                        "diagram_description": diagram.get("diagram_description", ""),  # NEW: Brief description for downstream LLMs
                        "visual_critique_score": diagram["visual_critique_score"],
                        "critique_iterations": diagram["critique_iterations"],
                        "critique_feedback": diagram["critique_feedback"],
                        "execution_id": self.execution_id
                    }
                    for diagram in diagrams
                ]

                upsert_results = await batch_upsert_diagrams(
                    diagrams_data=diagrams_data,
                    mcp_config_path=str(self.mcp_config_path)
                )

                logger.info(
                    f"✅ Batch upsert complete: {upsert_results['succeeded']} succeeded, "
                    f"{upsert_results['failed']} failed out of {upsert_results['total']}"
                )

                # Extract document IDs from successful upserts
                appwrite_document_ids = [doc["$id"] for doc in upsert_results["documents"]]

                # Generate final report
                metrics_report = format_cost_report(self.cost_tracker)
                logger.info("\n" + metrics_report)

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "diagrams_generated": upsert_results['succeeded'],
                    "diagrams_skipped": total_cards - cards_needing_diagrams,
                    "diagrams_failed": len(errors) + upsert_results['failed'],
                    "appwrite_document_ids": appwrite_document_ids,
                    "metrics": self.cost_tracker.get_summary(),
                    "errors": errors + upsert_results.get("errors", [])
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
        courseId: str,
        order: int,
        lesson_template_id: str,
        title: str,
        cards_needing_diagrams: int,
        workspace_path: str
    ) -> str:
        """Build initial prompt for the main orchestrator agent.

        This prompt instructs the agent to:
        1. Read lesson_template.json and eligible_cards.json from workspace
        2. Delegate to diagram_generation_subagent for each eligible card
        3. Delegate to visual_critic_subagent for quality validation
        4. Iterate up to 3 times if score < 0.85
        5. Write diagrams_output.json with all successful diagrams

        Args:
            courseId: Course identifier
            order: Lesson order number
            lesson_template_id: Lesson template document ID
            title: Lesson title
            cards_needing_diagrams: Number of eligible cards
            workspace_path: Path to workspace directory

        Returns:
            Formatted initial prompt string
        """
        # Load main orchestrator prompt
        prompts_dir = Path(__file__).parent / "prompts"
        main_prompt = (prompts_dir / "diagram_author_prompt.md").read_text()

        # Build context-specific instruction
        instruction = f"""You are starting a diagram generation pipeline.

**Inputs**:
- courseId: {courseId}
- order: {order}
- lesson_template_id: {lesson_template_id}
- title: "{title}"
- cards_needing_diagrams: {cards_needing_diagrams}

**Workspace**: {workspace_path}

**Available files**:
- lesson_template.json (complete lesson template)
- eligible_cards.json (pre-filtered cards needing diagrams)

**Your task**:
1. Read eligible_cards.json to see which cards need diagrams
2. For EVERY card in eligible_cards.json, orchestrate the diagram generation and critique loop:
   - Call @diagram_generation_subagent to generate JSXGraph JSON and render PNG
   - Call @visual_critic_subagent to critique the diagram
   - If score < 0.85 and iteration < 3, refine and iterate
   - If score ≥ 0.85, accept and move to next card
   - If score < 0.85 after 3 iterations, mark as failed and continue to next card
3. After processing ALL cards, write diagrams_output.json with all accepted diagrams and errors

**CRITICAL REQUIREMENTS**:
- ❌ DO NOT stop after a few diagrams to "demonstrate" the workflow
- ❌ DO NOT write `diagrams_output_partial.json` or any filename other than `diagrams_output.json`
- ❌ DO NOT use placeholder text like "[Generated successfully]" - include actual base64 PNG data
- ✅ MUST process ALL {cards_needing_diagrams} cards before completing
- ✅ MUST write EXACT filename: `diagrams_output.json`
- ✅ MUST include actual base64 image data from render_diagram tool

**Quality threshold**: ≥0.85 across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)
**Max iterations per card**: 3

Begin by reading eligible_cards.json and acknowledging that you will process ALL cards.
"""

        # Combine main prompt with instruction
        return f"{main_prompt}\n\n---\n\n{instruction}"
