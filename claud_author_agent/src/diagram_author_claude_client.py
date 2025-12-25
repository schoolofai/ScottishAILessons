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
from .tools.json_validator_mcp_tool import json_validator_server
from .tools.tool_factory import (
    get_servers_for_types,
    get_tool_names_for_types,
    get_tool_config,
    TOOL_CONFIG
)

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
            3 subagents: jsxgraph_researcher_subagent, diagram_generation_subagent, visual_critic_subagent
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 3 subagent prompts
        subagents = {
            "jsxgraph_researcher_subagent": AgentDefinition(
                description="JSXGraph researcher subagent for researching best implementation approaches BEFORE diagram generation. Use this to find correct element types, attributes, and avoid common pitfalls.",
                prompt=(prompts_dir / "jsxgraph_researcher_subagent.md").read_text()
            ),
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

    def _extract_tool_types_from_eligible_cards(self, eligible_cards: List[Dict[str, Any]]) -> List[str]:
        """Extract unique tool types from eligible cards.

        Scans all lesson and CFU diagram specs to collect the tool_type field.
        Used to determine which MCP servers to register.

        Args:
            eligible_cards: List of eligible card dictionaries with diagram specs

        Returns:
            List of unique tool types (e.g., ["MATPLOTLIB", "PLOTLY", "JSXGRAPH"])
        """
        tool_types = set()

        for card in eligible_cards:
            # Extract from lesson diagram specs
            lesson_specs = card.get("lesson_diagram_specs", [])
            for spec in lesson_specs:
                tool_type = spec.get("tool_type", "JSXGRAPH")  # Default for backward compatibility
                if tool_type and tool_type != "NONE":
                    tool_types.add(tool_type)

            # Extract from CFU diagram specs
            cfu_specs = card.get("cfu_diagram_specs", [])
            for spec in cfu_specs:
                tool_type = spec.get("tool_type", "JSXGRAPH")  # Default for backward compatibility
                if tool_type and tool_type != "NONE":
                    tool_types.add(tool_type)

        unique_types = list(tool_types)
        logger.info(f"Extracted {len(unique_types)} unique tool types from eligible cards: {unique_types}")
        return unique_types

    def _copy_jsxgraph_templates_to_workspace(self, workspace_path: Path) -> Dict[str, Any]:
        """Copy validated JSXGraph templates to workspace for agent reference.

        This enables the agent to READ actual validated template files instead of
        relying on inline examples in prompts, which prevents hallucination of
        incorrect JSXGraph syntax.

        Args:
            workspace_path: Path to the isolated workspace directory

        Returns:
            dict with:
                - copied: bool (success status)
                - path: str or None (template directory path)
                - inventory: dict (category -> list of files)
        """
        import shutil

        templates_source = Path(__file__).parent / "prompts" / "jsxgraph_examples"
        templates_dest = workspace_path / "jsxgraph_templates"

        if not templates_source.exists():
            logger.warning(f"JSXGraph templates not found at {templates_source}")
            return {"copied": False, "path": None, "inventory": {}}

        # Copy entire directory tree (preserves structure)
        shutil.copytree(templates_source, templates_dest)

        # Build inventory for logging
        template_inventory = {}
        for category_dir in templates_dest.iterdir():
            if category_dir.is_dir():
                files = list(category_dir.glob("*"))
                template_inventory[category_dir.name] = [f.name for f in files]

        logger.info(f"✅ Copied JSXGraph templates to {templates_dest}")
        for category, files in template_inventory.items():
            logger.info(f"   {category}/: {', '.join(files)}")

        return {
            "copied": True,
            "path": str(templates_dest),
            "inventory": template_inventory
        }

    async def execute(
        self,
        courseId: str,
        order: int,
        card_order: Optional[int] = None
    ) -> Dict[str, Any]:
        """Execute the complete diagram generation pipeline.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW (required)
            card_order: Optional card position in lesson (1-indexed). When provided, generates diagrams
                       for ONLY this card. When omitted, generates diagrams for ALL cards.

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
        # Determine mode
        if card_order is not None:
            single_card_mode = True
            single_card_index = card_order - 1  # Convert to 0-indexed
            logger.info(f"🎯 SINGLE CARD MODE: Generating diagrams for card #{card_order} in lesson order {order}")
        else:
            single_card_mode = False
            single_card_index = None
            logger.info(f"📚 FULL MODE: Generating diagrams for all cards in lesson order {order}")

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

                # ═══════════════════════════════════════════════════════════════
                # SINGLE CARD MODE: Filter lesson template to single card BEFORE eligibility
                # ═══════════════════════════════════════════════════════════════
                if single_card_mode:
                    cards = lesson_template.get("cards", [])

                    # Validate card index
                    if single_card_index >= len(cards):
                        error_msg = (
                            f"Card index {card_order} (0-indexed: {single_card_index}) "
                            f"is out of range. Lesson has {len(cards)} cards (indices 1-{len(cards)})."
                        )
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    # Extract the single card
                    selected_card = cards[single_card_index]
                    card_id = selected_card.get("id", "UNKNOWN")

                    # Replace cards array with single-card array
                    lesson_template["cards"] = [selected_card]

                    logger.info(
                        f"🎯 Single card mode: Filtered {total_cards} → 1 card "
                        f"(card #{card_order}, id: {card_id})"
                    )

                    # Update total_cards for downstream logging
                    total_cards = 1

                # Write lesson_template.json to workspace (after filtering if single card mode)
                lesson_template_path = workspace_path / "lesson_template.json"
                with open(lesson_template_path, 'w') as f:
                    json.dump(lesson_template, f, indent=2)
                logger.info(f"✅ lesson_template.json written to workspace")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Copy validated JSXGraph templates to workspace
                # ═══════════════════════════════════════════════════════════════
                # Templates enable the agent to READ actual validated JSON files
                # instead of relying on inline examples which may be hallucinated.
                template_result = self._copy_jsxgraph_templates_to_workspace(workspace_path)
                templates_available = template_result["copied"]
                if templates_available:
                    logger.info(f"📁 JSXGraph templates available at {template_result['path']}")

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

                # ALWAYS write eligible_cards.json to workspace (even if empty list)
                # This enables debugging and provides audit trail for eligibility decisions
                eligible_cards_path = workspace_path / "eligible_cards.json"
                with open(eligible_cards_path, 'w') as f:
                    json.dump(eligible_cards, f, indent=2)
                logger.info(f"✅ eligible_cards.json written to workspace ({len(eligible_cards)} cards)")

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

                # ═══════════════════════════════════════════════════════════════
                # Register MCP Tools for Diagram Author Agent (Multi-Tool Support)
                # ═══════════════════════════════════════════════════════════════
                # Register ONLY the tools needed based on tool_type from eligibility.
                #
                # Multi-Tool Architecture:
                # - Each diagram spec now has a tool_type field
                # - Tool factory creates only the needed MCP servers
                # - Reduces token context by excluding unused tools
                #
                # Available Tools:
                # - DESMOS: Function graphing (mcp__desmos__render_desmos)
                # - MATPLOTLIB: Pure geometry (mcp__matplotlib__render_matplotlib)
                # - JSXGRAPH: Coordinate geometry (mcp__diagram-screenshot__render_diagram)
                # - PLOTLY: Statistics/charts (mcp__plotly__render_plotly)
                # - IMAGE_GENERATION: AI images (mcp__imagen__render_imagen)
                #
                # Why Appwrite MCP Not Needed:
                # - Lesson template PRE-FETCHED by Python utility (diagram_extractor.py)
                # - Diagram author agent works with FILES in workspace, not database
                # ═══════════════════════════════════════════════════════════════

                # Extract unique tool types from eligible cards
                tool_types_needed = self._extract_tool_types_from_eligible_cards(eligible_cards)

                # If no tool types found (backward compatibility), default to JSXGRAPH
                if not tool_types_needed:
                    logger.warning("No tool_type found in eligible cards - defaulting to JSXGRAPH")
                    tool_types_needed = ["JSXGRAPH"]

                # Create MCP servers for the needed tool types
                try:
                    mcp_servers_for_diagram_author = get_servers_for_types(
                        tool_types=tool_types_needed,
                        workspace_path=str(workspace_path)
                    )
                except Exception as e:
                    logger.error(f"Failed to create diagram tool servers: {e}")
                    raise

                # Add JSON validator (always needed for self-correction)
                mcp_servers_for_diagram_author["json-validator"] = json_validator_server

                # Build list of tool names for allowed_tools
                diagram_tool_names = get_tool_names_for_types(tool_types_needed)

                logger.info(f"Registered {len(tool_types_needed)} diagram tools: {tool_types_needed}")
                logger.info(f"MCP servers: {list(mcp_servers_for_diagram_author.keys())}")

                # Configure Claude SDK client with permission_mode='bypassPermissions'
                # Build allowed_tools with base tools + dynamic diagram tools
                base_tools = [
                    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite', 'Task',
                    'WebSearch', 'WebFetch',
                    'mcp__json-validator__validate_json'  # JSON validation for self-correction
                ]
                allowed_tools = base_tools + diagram_tool_names

                logger.info(f"Allowed tools ({len(allowed_tools)}): {allowed_tools}")

                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',  # CRITICAL: Bypass all permission prompts
                    mcp_servers=mcp_servers_for_diagram_author,  # Dynamic tool servers
                    allowed_tools=allowed_tools,  # Dynamic based on tool_type from eligibility
                    max_turns=500,  # High limit to ensure agent can complete complex diagram authoring work
                    cwd=str(workspace_path)  # Set agent working directory to isolated workspace
                )

                logger.info(f"Agent configured: bypassPermissions + cwd={workspace_path} + max_turns=500")

                # Execute pipeline (2 subagents: diagram_generation, visual_critic)
                async with ClaudeSDKClient(options) as client:
                    # Initial prompt to orchestrate subagents
                    initial_prompt = self._build_initial_prompt(
                        courseId=courseId,
                        order=order,
                        lesson_template_id=lesson_template_id,
                        title=title,
                        cards_needing_diagrams=cards_needing_diagrams,
                        workspace_path=str(workspace_path),
                        tool_types_needed=tool_types_needed  # Pass tool types for multi-tool guidance
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

                # Separate critical errors from recoverable JSON validation warnings
                critical_failures = {}  # Missing fields that block upsert (no image)
                json_warnings = {}  # Invalid JSON but image exists - can recover

                for diagram in diagrams:
                    card_id = diagram.get("cardId", "UNKNOWN")
                    is_valid, errors = validate_diagram_output_schema(diagram, card_id)

                    if not is_valid:
                        # Check if we have a valid image (can still upsert without jsxgraph_json)
                        has_image = bool(diagram.get("image_path"))

                        # Separate JSON errors from truly critical errors
                        json_errors = [e for e in errors if "jsxgraph_json" in e.lower()]
                        critical_errors = [e for e in errors if "jsxgraph_json" not in e.lower()]

                        if critical_errors:
                            # Missing cardId, image_path, etc. = truly broken
                            critical_failures[card_id] = critical_errors

                        if json_errors and has_image:
                            # Invalid JSON but we have an image = recoverable
                            json_warnings[card_id] = json_errors
                            # Clear the invalid JSON (will be set to null in upsert)
                            diagram["jsxgraph_json"] = None
                            diagram["jsxgraph_validation_warning"] = json_errors
                            logger.warning(f"⚠️ {card_id}: Invalid jsxgraph_json - will upsert with null JSON")
                            for error in json_errors:
                                logger.warning(f"   - {error}")
                        elif json_errors and not has_image:
                            # No image and bad JSON = truly broken
                            critical_failures[card_id] = errors

                # Handle critical failures (missing image, cardId, etc.) - these are blocking
                if critical_failures:
                    total_failures = len(critical_failures)
                    error_details = []
                    for card_id, errors in critical_failures.items():
                        error_details.append(f"  • {card_id}: {', '.join(errors)}")

                    error_msg = (
                        f"❌ Agent output validation FAILED: {total_failures}/{len(diagrams)} diagrams "
                        f"missing required fields.\n\n"
                        f"Validation errors:\n" + "\n".join(error_details) + "\n\n"
                        f"This is a PROMPT ADHERENCE issue - the diagram generation subagent "
                        f"must include ALL required fields in diagrams_output.json.\n\n"
                        f"Troubleshooting:\n"
                        f"  1. Check workspace file: {workspace_path}/diagrams_output.json\n"
                        f"  2. Verify agent is generating PNG files before writing output\n"
                        f"  3. Review agent logs for prompt adherence issues"
                    )
                    logger.error(error_msg)
                    raise ValueError(error_msg)

                # Log summary of JSON warnings (non-blocking)
                if json_warnings:
                    logger.warning(
                        f"⚠️ JSON validation: {len(json_warnings)}/{len(diagrams)} diagrams have invalid jsxgraph_json "
                        f"- will upsert with null JSON (images are still valid)"
                    )

                valid_count = len(diagrams) - len(json_warnings)
                logger.info(f"✅ Schema validation: {valid_count}/{len(diagrams)} diagrams fully valid, {len(json_warnings)} with JSON warnings")

                # Prepare diagrams for batch upsert with diagram_index support
                logger.info("Starting batch upsert to Appwrite lesson_diagrams collection...")

                # Group diagrams by cardId to assign diagram_index (0, 1, 2, ...)
                # This handles both single-diagram cards and multi-diagram cards
                from collections import defaultdict
                diagrams_by_card = defaultdict(list)
                for diagram in diagrams:
                    diagrams_by_card[diagram["cardId"]].append(diagram)

                # Build diagrams_data with diagram_index assigned per card
                diagrams_data = []
                for card_id, card_diagrams in diagrams_by_card.items():
                    for diagram_index, diagram in enumerate(card_diagrams):
                        diagrams_data.append({
                            "lesson_template_id": lesson_template_id,
                            "card_id": card_id,
                            "diagram_index": diagram_index,  # NEW: 0, 1, 2, ... for multi-diagram cards
                            "jsxgraph_json": diagram["jsxgraph_json"],
                            "image_base64": diagram["image_base64"],
                            "diagram_type": diagram["diagram_type"],
                            "diagram_context": diagram.get("diagram_context"),
                            "diagram_description": diagram.get("diagram_description", ""),
                            "visual_critique_score": diagram["visual_critique_score"],
                            "critique_iterations": diagram["critique_iterations"],
                            "critique_feedback": diagram["critique_feedback"],
                            "execution_id": self.execution_id
                        })

                logger.info(
                    f"Grouped {len(diagrams)} total diagrams across {len(diagrams_by_card)} cards "
                    f"(avg {len(diagrams) / len(diagrams_by_card):.1f} diagrams per card)"
                )

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
        workspace_path: str,
        tool_types_needed: Optional[List[str]] = None
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
            tool_types_needed: List of tool types needed (e.g., ["MATPLOTLIB", "PLOTLY"])

        Returns:
            Formatted initial prompt string
        """
        # Load main orchestrator prompt
        prompts_dir = Path(__file__).parent / "prompts"
        main_prompt = (prompts_dir / "diagram_author_prompt.md").read_text()

        # Build tool-specific guidance section
        tool_types_needed = tool_types_needed or ["JSXGRAPH"]
        tool_guidance = self._build_tool_guidance(tool_types_needed)

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
- eligible_cards.json (pre-filtered cards needing diagrams with tool_type classification)
- jsxgraph_templates/ (VALIDATED template examples - READ THESE FIRST for JSXGRAPH tools!)
  - bar_chart/vertical_bars.json (chart element with chartStyle="bar")
  - pie_chart/basic_pie_chart.json (chart element with chartStyle="pie")
  - coordinate_graph/linear_function.json (function graph with axis)
  - geometry/right_triangle.json (polygon with labels and angles)

{tool_guidance}

**Your task**:
1. Read eligible_cards.json to see which cards need diagrams
2. **IMPORTANT**: Each diagram spec has a `tool_type` field - use the CORRECT MCP tool for each:
{self._get_tool_mapping_instructions(tool_types_needed)}
3. For EVERY card in eligible_cards.json, orchestrate the diagram generation and critique loop:
   - Use the **Task tool** with subagent_type="diagram_generation_subagent" (include tool_type in prompt)
   - Use the **Task tool** with subagent_type="visual_critic_subagent" to critique the diagram
   - If score < 0.85 and iteration < 10, refine and iterate
   - If score ≥ 0.85, accept and move to next card
   - If score < 0.85 after 10 iterations, mark as failed and continue to next card
4. After processing ALL cards, write diagrams_output.json with all accepted diagrams and errors

**CRITICAL REQUIREMENTS**:
- ❌ DO NOT ignore the `tool_type` field - use the correct rendering tool for each diagram
- ❌ DO NOT stop after a few diagrams to "demonstrate" the workflow
- ❌ DO NOT write `diagrams_output_partial.json` or any filename other than `diagrams_output.json`
- ❌ DO NOT use placeholder text like "[Generated successfully]" - include actual base64 PNG data
- ✅ MUST use the tool_type specified in each diagram spec
- ✅ MUST process ALL {cards_needing_diagrams} cards before completing
- ✅ MUST write EXACT filename: `diagrams_output.json`
- ✅ MUST include actual base64 image data from the appropriate render tool
- ✅ MUST include `tool_type` field in diagrams_output.json for each diagram

**IMPORTANT**: You MUST use the Task tool to invoke subagents. Writing "@subagent_name" as text will NOT invoke the subagent - it will just output text and terminate the pipeline!

**Quality threshold**: ≥0.85 across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)
**Max iterations per card**: 10

Begin by reading eligible_cards.json and processing each diagram with its specified tool_type.
"""

        # Combine main prompt with instruction
        return f"{main_prompt}\n\n---\n\n{instruction}"

    def _build_tool_guidance(self, tool_types: List[str]) -> str:
        """Build tool-specific guidance for the prompt.

        Args:
            tool_types: List of tool types needed

        Returns:
            Formatted tool guidance string
        """
        tool_descriptions = {
            "DESMOS": "DESMOS: Function graphing (y=f(x), quadratics, trigonometry) - use mcp__desmos__render_desmos",
            "MATPLOTLIB": "MATPLOTLIB: Pure geometry (circle theorems, constructions, angles) - use mcp__matplotlib__render_matplotlib",
            "JSXGRAPH": "JSXGRAPH: Coordinate geometry (transformations, vectors, lines) - use mcp__diagram-screenshot__render_diagram",
            "PLOTLY": "PLOTLY: Statistics/charts (bar, pie, histogram, scatter) - use mcp__plotly__render_plotly",
            "IMAGE_GENERATION": "IMAGE_GENERATION: Real-world images (word problem illustrations) - use mcp__imagen__render_imagen"
        }

        guidance_lines = ["**🔧 MULTI-TOOL SUPPORT - Tool Types Available**:"]
        for tool_type in tool_types:
            if tool_type in tool_descriptions:
                guidance_lines.append(f"- {tool_descriptions[tool_type]}")

        guidance_lines.append("")
        guidance_lines.append("Each diagram spec in eligible_cards.json has a `tool_type` field.")
        guidance_lines.append("You MUST use the correct MCP tool based on this field.")

        return "\n".join(guidance_lines)

    def _get_tool_mapping_instructions(self, tool_types: List[str]) -> str:
        """Get tool mapping instructions for the prompt.

        Args:
            tool_types: List of tool types needed

        Returns:
            Formatted instructions string
        """
        mappings = {
            "DESMOS": "   - tool_type: DESMOS → call mcp__desmos__render_desmos",
            "MATPLOTLIB": "   - tool_type: MATPLOTLIB → call mcp__matplotlib__render_matplotlib",
            "JSXGRAPH": "   - tool_type: JSXGRAPH → call mcp__diagram-screenshot__render_diagram",
            "PLOTLY": "   - tool_type: PLOTLY → call mcp__plotly__render_plotly",
            "IMAGE_GENERATION": "   - tool_type: IMAGE_GENERATION → call mcp__imagen__render_imagen"
        }

        lines = []
        for tool_type in tool_types:
            if tool_type in mappings:
                lines.append(mappings[tool_type])

        return "\n".join(lines)
