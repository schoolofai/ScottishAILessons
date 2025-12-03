"""Diagram Author Nano Agent - Claude SDK Implementation.

Orchestrates diagram generation using Gemini Nano via Claude Agent SDK,
following the same architecture as diagram_author_claude_client.py.

Architecture:
    Pre-processing (Python):
    1. Fetch lesson template from Appwrite
    2. Filter eligible cards via EligibilityAnalyzerAgent
    3. Write lesson_template.json and eligible_cards.json to workspace

    Agent execution (2 subagents):
    4. @gemini_subagent → Generates diagrams via Gemini MCP tool
    5. @visual_critic_subagent → Critiques diagrams with 4D scoring

    Post-processing (Python):
    6. Upsert diagrams to default.lesson_diagrams collection

Key Features:
- Subject-agnostic: Supports any subject (math, science, geography, history)
- Context-aware: Different generation rules for lesson vs CFU diagrams
- Claude handles prompt crafting (not Python code)
- Visual feedback for refinement (not code changes)
"""

import asyncio
import base64
import json
import logging
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
from .utils.gemini_client import validate_gemini_availability, GeminiConfigurationError
from .utils.gemini_image_generator import get_max_iterations
from .eligibility_analyzer_agent import EligibilityAnalyzerAgent
from .tools.gemini_mcp_tool import create_gemini_mcp_server
from .tools.gemini_critic_tool import create_gemini_critic_mcp_server

logger = logging.getLogger(__name__)

# Quality threshold (max iterations loaded from DIAGRAM_MAX_ITERATIONS env var)
QUALITY_THRESHOLD = 0.85


class DiagramAuthorNanoAgent:
    """Claude Agent SDK-based diagram generation with Gemini.

    Pre-processing (Python):
    1. Fetch lesson template from Appwrite (diagram_extractor.py)
    2. Filter eligible cards needing diagrams (LLM-based)
    3. Write lesson_template.json and eligible_cards.json to workspace

    Pipeline execution (2 subagents):
    4. @gemini_subagent → Generates diagrams via Gemini MCP tool
    5. @visual_critic_subagent → Critiques diagrams with 4D scoring

    Post-processing (Python):
    6. Upsert diagrams to Appwrite lesson_diagrams collection (diagram_upserter.py)

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution (timestamp-based)
        cost_tracker: Tracks costs across all subagents
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "INFO"
    ):
        """Initialize Diagram Author Nano agent.

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

        logger.info(f"Initialized DiagramAuthorNanoAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definitions(self) -> Dict[str, AgentDefinition]:
        """Load subagent definitions with prompts.

        Returns:
            Dictionary mapping subagent names to AgentDefinition objects

        Raises:
            FileNotFoundError: If prompt files are missing
        """
        prompts_dir = Path(__file__).parent / "prompts"

        # Load 2 subagent prompts
        subagents = {
            "gemini_subagent": AgentDefinition(
                description="Gemini diagram generation subagent for creating educational diagrams via Gemini API",
                prompt=(prompts_dir / "gemini_subagent.md").read_text()
            ),
            "visual_critic_subagent": AgentDefinition(
                description="Visual critic subagent for analyzing diagram quality with 4D scoring (clarity, accuracy, pedagogy, aesthetics)",
                prompt=(prompts_dir / "visual_critic_subagent_nano.md").read_text()
            )
        }

        logger.info(f"Loaded {len(subagents)} subagent definitions: {list(subagents.keys())}")
        return subagents

    def _build_initial_prompt(
        self,
        courseId: str,
        order: int,
        lesson_template_id: str,
        title: str,
        cards_needing_diagrams: int,
        workspace_path: str,
        max_iterations: int
    ) -> str:
        """Build initial prompt for the main orchestrator agent.

        Args:
            courseId: Course identifier
            order: Lesson order number
            lesson_template_id: Lesson template document ID
            title: Lesson title
            cards_needing_diagrams: Number of eligible cards
            workspace_path: Path to workspace directory
            max_iterations: Maximum refinement iterations per diagram

        Returns:
            Formatted initial prompt string
        """
        # Load main orchestrator prompt
        prompts_dir = Path(__file__).parent / "prompts"
        main_prompt = (prompts_dir / "nano_diagram_author_prompt.md").read_text()

        # Build context-specific instruction
        instruction = f"""You are starting a Gemini-based diagram generation pipeline.

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
2. For EVERY card in eligible_cards.json:
   - Process each context in diagram_contexts (lesson, cfu, or both)
   - Call @gemini_subagent with card content + context
   - Call @visual_critic_subagent to critique PNG
   - If score < 0.85 and iteration < {max_iterations}, refine and iterate
   - If score ≥ 0.85, accept and move to next
   - If iteration >= {max_iterations}, mark as failed with best effort
3. After processing ALL cards, write diagrams_output.json with all results

**CRITICAL REQUIREMENTS**:
- ❌ DO NOT skip cards or stop early
- ❌ DO NOT write partial output files
- ❌ DO NOT show answers in CFU diagrams
- ✅ MUST process ALL {cards_needing_diagrams} cards before completing
- ✅ MUST write EXACT filename: `diagrams_output.json`
- ✅ MUST set jsxgraph_json to empty string "" for all diagrams
- ✅ MUST set rendering_backend to "gemini_nano" for all diagrams

**Available MCP Tools**:
- mcp__gemini__generate_diagram - Generate initial diagram from prompt
- mcp__gemini__refine_diagram - Refine diagram based on feedback
- mcp__gemini__get_session_status - Check session iteration count

**Quality threshold**: ≥0.85 across 4 dimensions (clarity, accuracy, pedagogy, aesthetics)
**Max iterations per diagram**: {max_iterations}

Begin by reading eligible_cards.json!
"""

        # Combine main prompt with instruction
        return f"{main_prompt}\n\n---\n\n{instruction}"

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
            card_order: Optional card position in lesson (1-indexed)

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - diagrams_generated: int
                - diagrams_skipped: int
                - diagrams_failed: int
                - appwrite_document_ids: List[str]
                - metrics: dict
                - error: str (if failed)

        Raises:
            ValueError: If courseId or order invalid
            GeminiConfigurationError: If Gemini API not available
            FileNotFoundError: If prompts missing
        """
        # Determine mode
        single_card_mode = card_order is not None
        if single_card_mode:
            single_card_index = card_order - 1
            logger.info(f"🎯 SINGLE CARD MODE: Generating diagrams for card #{card_order}")
        else:
            single_card_index = None
            logger.info(f"📚 FULL MODE: Generating diagrams for all cards in lesson order {order}")

        # Validate inputs
        is_valid, error_msg = validate_diagram_author_input({
            "courseId": courseId,
            "order": order
        })
        if not is_valid:
            raise ValueError(error_msg)

        # Validate Gemini API availability
        logger.info("Checking Gemini API availability...")
        validate_gemini_availability()
        logger.info("✅ Gemini API is available")

        logger.info(f"Starting Gemini diagram generation pipeline for courseId '{courseId}', order {order}")

        try:
            # Create isolated workspace
            with IsolatedFilesystem(f"nano_{self.execution_id}", persist=self.persist_workspace, workspace_type="diagram") as filesystem:
                workspace_path = filesystem.root
                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Fetch lesson template
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Fetching lesson template...")
                lesson_template = await fetch_lesson_template(
                    course_id=courseId,
                    order=order,
                    mcp_config_path=str(self.mcp_config_path)
                )

                lesson_template_id = lesson_template.get("$id", lesson_template.get("lessonTemplateId", "UNKNOWN"))
                title = lesson_template.get("title", "Untitled")
                total_cards = len(lesson_template.get("cards", []))

                logger.info(f"✅ Fetched lesson template: {lesson_template_id} - '{title}' ({total_cards} cards)")

                # Single card mode filter
                if single_card_mode:
                    cards = lesson_template.get("cards", [])
                    if single_card_index >= len(cards):
                        raise ValueError(
                            f"Card index {card_order} out of range. Lesson has {len(cards)} cards."
                        )
                    selected_card = cards[single_card_index]
                    lesson_template["cards"] = [selected_card]
                    logger.info(f"🎯 Single card mode: Filtered to card #{card_order}")
                    total_cards = 1

                # Write lesson_template.json to workspace
                lesson_template_path = workspace_path / "lesson_template.json"
                with open(lesson_template_path, 'w') as f:
                    json.dump(lesson_template, f, indent=2)
                logger.info("✅ lesson_template.json written to workspace")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Filter eligible cards
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Filtering eligible cards...")
                eligibility_agent = EligibilityAnalyzerAgent()
                eligible_cards = await eligibility_agent.analyze(lesson_template)

                cards_needing_diagrams = len(eligible_cards)
                logger.info(f"✅ Identified {cards_needing_diagrams}/{total_cards} cards needing diagrams")

                # Write eligible_cards.json to workspace
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
                # Register MCP Tools for Diagram Author Nano Agent
                # ═══════════════════════════════════════════════════════════════
                gemini_mcp_server = create_gemini_mcp_server(str(workspace_path))
                gemini_critic_mcp_server = create_gemini_critic_mcp_server(str(workspace_path))
                mcp_servers = {
                    "gemini": gemini_mcp_server,
                    "gemini_critic": gemini_critic_mcp_server
                }
                logger.info("Registered MCP tools: gemini (generate_diagram, refine_diagram, get_session_status), gemini_critic (critique_diagram)")

                # Configure Claude SDK client
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    agents=self._get_subagent_definitions(),
                    permission_mode='bypassPermissions',
                    mcp_servers=mcp_servers,
                    allowed_tools=[
                        'Read', 'Write', 'Edit', 'Glob', 'Grep', 'TodoWrite',
                        'mcp__gemini__generate_diagram',
                        'mcp__gemini__refine_diagram',
                        'mcp__gemini__get_session_status',
                        'mcp__gemini_critic__critique_diagram'
                    ],
                    max_turns=500,
                    cwd=str(workspace_path)
                )

                logger.info(f"Agent configured: bypassPermissions + cwd={workspace_path} + max_turns=500")

                # Execute pipeline (2 subagents)
                async with ClaudeSDKClient(options) as client:
                    initial_prompt = self._build_initial_prompt(
                        courseId=courseId,
                        order=order,
                        lesson_template_id=lesson_template_id,
                        title=title,
                        cards_needing_diagrams=cards_needing_diagrams,
                        workspace_path=str(workspace_path),
                        max_iterations=get_max_iterations()
                    )

                    logger.info("Sending initial prompt to Claude Agent SDK...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream - logging ALL raw messages...")
                    message_count = 0

                    async for message in client.receive_messages():
                        message_count += 1

                        # Log FULL raw message at INFO level (for debugging)
                        logger.info("=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info("=" * 80)
                        logger.info(f"{message}")
                        logger.info("=" * 80)

                        if isinstance(message, ResultMessage):
                            logger.info(f"✅ Pipeline completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # ═══════════════════════════════════════════════════════════════
                # POST-PROCESSING: Parse output and upsert to Appwrite
                # ═══════════════════════════════════════════════════════════════
                logger.info("Post-processing: Reading diagrams_output.json...")

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
                    logger.warning("No diagrams generated successfully")
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

                # Load PNG data and encode to base64 for Appwrite upload
                logger.info("Validating and loading diagram PNG files...")
                missing_images = []
                for diagram in diagrams:
                    card_id = diagram.get("cardId", "unknown")
                    image_path = diagram.get("image_path")

                    if not image_path:
                        missing_images.append({"cardId": card_id, "issue": "No image_path"})
                        continue

                    file_path = Path(image_path)
                    if not file_path.exists():
                        missing_images.append({"cardId": card_id, "issue": f"File not found: {image_path}"})
                        continue

                    try:
                        png_bytes = file_path.read_bytes()
                        diagram["image_base64"] = base64.b64encode(png_bytes).decode('utf-8')
                        logger.info(f"✅ Loaded PNG from {file_path.name} ({len(png_bytes)} bytes)")
                    except Exception as e:
                        missing_images.append({"cardId": card_id, "issue": str(e)})

                if missing_images:
                    error_msg = f"FAILED: {len(missing_images)} diagrams have missing PNG files"
                    logger.error(f"❌ {error_msg}")
                    return {
                        "success": False,
                        "execution_id": self.execution_id,
                        "workspace_path": str(workspace_path),
                        "diagrams_generated": 0,
                        "diagrams_failed": len(diagrams),
                        "errors": errors,
                        "missing_images": missing_images,
                        "metrics": self.cost_tracker.get_summary(),
                        "message": error_msg
                    }

                # Prepare for batch upsert
                logger.info("Starting batch upsert to Appwrite...")
                diagrams_data = []
                for diagram in diagrams:
                    diagrams_data.append({
                        "lesson_template_id": lesson_template_id,
                        "card_id": diagram.get("cardId"),
                        "diagram_index": diagram.get("diagram_index", 0),
                        "jsxgraph_json": diagram.get("jsxgraph_json", ""),
                        "image_base64": diagram.get("image_base64"),
                        "diagram_type": diagram.get("diagram_type", "geometry"),
                        "diagram_context": diagram.get("diagram_context"),
                        "diagram_description": diagram.get("diagram_description", ""),
                        "visual_critique_score": diagram.get("visual_critique_score", 0.0),
                        "critique_iterations": diagram.get("critique_iterations", 0),
                        "critique_feedback": diagram.get("critique_feedback", ""),
                        "execution_id": self.execution_id,
                        "rendering_backend": "gemini_nano"
                    })

                upsert_results = await batch_upsert_diagrams(
                    diagrams_data=diagrams_data,
                    mcp_config_path=str(self.mcp_config_path)
                )

                logger.info(
                    f"✅ Batch upsert complete: {upsert_results['succeeded']} succeeded, "
                    f"{upsert_results['failed']} failed out of {upsert_results['total']}"
                )

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
