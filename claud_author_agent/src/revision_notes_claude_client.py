"""Revision Notes Author Claude Agent implementation.

Generates concise but powerful revision notes for completed lessons
using Claude Agent SDK with autonomous authoring pipeline.

Pre-processing (Python):
0. Lesson Data Extractor → Extracts lesson snapshot + SOW context (Python utility)
1. Evidence Analyzer → Summarizes student performance (Python utility, optional)

Pipeline execution (Single agent):
2. Revision Notes Author → Creates revision_notes.json (main authoring agent)

Post-processing (Python):
3. Export Generator → Create Markdown/PDF exports (Python utility)
4. Notes Upserter → Write to default.revision_notes (Python utility)
"""

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging

logger = logging.getLogger(__name__)


class RevisionNotesAuthorClaudeAgent:
    """Autonomous revision notes authoring using Claude Agent SDK.

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across execution

    Architecture Notes:
        - Lesson data extraction in Python (no LLM needed, saves tokens)
        - Evidence summarization in Python (deterministic aggregation)
        - Only creative authoring uses LLM (revision notes generation)
        - Export and upserting in Python (deterministic, no LLM needed)
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        log_level: str = "INFO"
    ):
        """Initialize Revision Notes Author agent.

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

        logger.info(f"Initialized RevisionNotesAuthorClaudeAgent - Execution ID: {self.execution_id}")

    def _get_agent_prompt(self) -> str:
        """Load revision notes author prompt.

        Returns:
            Prompt string for revision notes author

        Raises:
            FileNotFoundError: If prompt file is missing
        """
        prompts_dir = Path(__file__).parent / "prompts"
        prompt_path = prompts_dir / "revision_notes_author_prompt.md"

        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

        prompt = prompt_path.read_text()
        logger.info("Loaded revision notes author prompt")
        return prompt

    async def execute(
        self,
        lessonTemplateId: Optional[str] = None,
        sessionId: Optional[str] = None,
        export_format: str = "both"  # "markdown", "pdf", "both"
    ) -> Dict[str, Any]:
        """Execute revision notes generation pipeline.

        Args:
            lessonTemplateId: Lesson template ID (for template-based generation)
            sessionId: Session ID (for session-based generation with evidence)
            export_format: Export format ("markdown", "pdf", "both")

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - appwrite_document_id: str (if successful)
                - markdown_path: str (if markdown exported)
                - pdf_path: str (if pdf exported)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If neither lessonTemplateId nor sessionId provided
            FileNotFoundError: If MCP config or prompts missing
        """
        # Validate input
        if not lessonTemplateId and not sessionId:
            raise ValueError("Must provide either lessonTemplateId or sessionId")

        generation_mode = "session" if sessionId else "template"
        logger.info(f"Starting revision notes generation in {generation_mode} mode")

        try:
            # Create isolated workspace
            with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace) as filesystem:
                workspace_path = filesystem.root
                logger.info(f"Workspace created: {workspace_path}")

                # ═══════════════════════════════════════════════════════════════
                # PRE-PROCESSING: Extract lesson data and context (NO AGENT)
                # ═══════════════════════════════════════════════════════════════
                logger.info("Pre-processing: Extracting lesson data via Python utility...")

                from .utils.revision_notes_extractor import extract_lesson_data_to_workspace

                lesson_data = await extract_lesson_data_to_workspace(
                    lessonTemplateId=lessonTemplateId,
                    sessionId=sessionId,
                    mcp_config_path=str(self.mcp_config_path),
                    workspace_path=workspace_path
                )

                logger.info(f"✅ lesson_snapshot.json ready at: {workspace_path / 'lesson_snapshot.json'}")
                logger.info(f"✅ sow_context.json ready at: {workspace_path / 'sow_context.json'}")
                if sessionId:
                    logger.info(f"✅ evidence_summary.json ready at: {workspace_path / 'evidence_summary.json'}")
                logger.info("   Python extraction complete - no LLM tokens used")

                # Extract Course_data.txt for SQA context
                logger.info("Pre-processing: Extracting Course_data.txt via Python utility...")

                from .utils.course_data_extractor import extract_course_data_to_file

                course_data_path = workspace_path / "Course_data.txt"
                await extract_course_data_to_file(
                    subject=lesson_data["subject"],
                    level=lesson_data["level"],
                    mcp_config_path=str(self.mcp_config_path),
                    output_path=course_data_path
                )

                logger.info(f"✅ Course_data.txt ready at: {course_data_path}")
                logger.info("   Python extraction complete - no LLM tokens used")

                # ═══════════════════════════════════════════════════════════════
                # Register MCP Tools for Revision Notes Agent
                # ═══════════════════════════════════════════════════════════════
                # ONLY register validator MCP tool
                #
                # JSON Validation Tool (v1.0.0):
                # - Validates OUTPUT schema (revision_notes.json structure)
                # - Deep validation of cognitive science principles
                # - Word count validation (500-800 words)
                # - LaTeX syntax validation
                # - Chunking principle enforcement (3-5 key concepts)
                # - Error limit: Returns max 10 detailed errors per validation
                #
                # Tool Name: mcp__validator__validate_revision_notes
                # Implementation: src/tools/revision_notes_validator_tool.py
                # ═══════════════════════════════════════════════════════════════

                from .tools.revision_notes_validator_tool import validation_server

                mcp_servers_for_revision_notes = {
                    "validator": validation_server  # Revision notes validation tool (v1.0.0)
                }
                logger.info("Registered validator MCP tool for revision notes author")

                # Configure Claude SDK client
                options = ClaudeAgentOptions(
                    model='claude-sonnet-4-5',
                    permission_mode='bypassPermissions',
                    system_prompt=self._get_agent_prompt(),
                    mcp_servers=mcp_servers_for_revision_notes,
                    allowed_tools=[
                        'Read', 'Write', 'Edit', 'TodoWrite', 'WebSearch', 'WebFetch',
                        'mcp__validator__validate_revision_notes'  # Revision notes validation tool
                    ],
                    max_turns=100,  # Revision notes are shorter than full lessons
                    cwd=str(workspace_path)
                )

                logger.info(f"Agent configured: bypassPermissions + max_turns=100 + cwd={workspace_path}")

                # Execute agent
                async with ClaudeSDKClient(options) as client:
                    # Initial prompt
                    initial_prompt = self._build_initial_prompt(
                        lesson_data=lesson_data,
                        workspace_path=str(workspace_path),
                        generation_mode=generation_mode
                    )

                    logger.info("Sending initial prompt to Claude Agent SDK...")
                    await client.query(initial_prompt)

                    logger.info("Starting message stream...")
                    message_count = 0

                    # Process messages until completion
                    async for message in client.receive_messages():
                        message_count += 1
                        logger.info(f"=" * 80)
                        logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                        logger.info(f"=" * 80)
                        logger.info(f"{message}")
                        logger.info(f"=" * 80)

                        if isinstance(message, ResultMessage):
                            logger.info(f"✅ Revision notes generation completed after {message_count} messages")
                            break

                    logger.info("Message stream complete")

                # ═══════════════════════════════════════════════════════════════
                # POST-PROCESSING: Export + Upserting
                # ═══════════════════════════════════════════════════════════════
                logger.info("Starting post-processing: validation + export + upserting...")

                from .utils.revision_notes_upserter import upsert_revision_notes
                from .utils.export.markdown_exporter import export_to_markdown
                from .utils.export.pdf_exporter import export_to_pdf

                revision_notes_path = workspace_path / "revision_notes.json"

                # Validate file exists
                if not revision_notes_path.exists():
                    raise FileNotFoundError(
                        f"Agent did not create revision_notes.json. "
                        f"Check agent logs for errors."
                    )

                # Export to requested formats
                markdown_path = None
                pdf_path = None

                if export_format in ["markdown", "both"]:
                    logger.info("Exporting to Markdown...")
                    markdown_path = await export_to_markdown(
                        revision_notes_path=str(revision_notes_path),
                        output_path=str(workspace_path / "revision_notes.md")
                    )
                    logger.info(f"✅ Markdown exported: {markdown_path}")

                if export_format in ["pdf", "both"]:
                    logger.info("Exporting to PDF...")
                    try:
                        pdf_path = await export_to_pdf(
                            revision_notes_path=str(revision_notes_path),
                            output_path=str(workspace_path / "revision_notes.pdf")
                        )
                        logger.info(f"✅ PDF exported: {pdf_path}")
                    except ImportError as e:
                        logger.warning(f"PDF export failed: {e}")
                        logger.warning("Install weasyprint with: pip install weasyprint")
                        pdf_path = None

                # Upsert to database
                logger.info("Upserting to Appwrite database...")
                appwrite_document_id = await upsert_revision_notes(
                    revision_notes_path=str(revision_notes_path),
                    lessonTemplateId=lessonTemplateId,
                    sessionId=sessionId,
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path)
                )

                logger.info(f"Revision notes upserted successfully: {appwrite_document_id}")

                # Generate metrics report
                metrics_report = format_cost_report(self.cost_tracker)
                logger.info("\n" + metrics_report)

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path),
                    "appwrite_document_id": appwrite_document_id,
                    "markdown_path": markdown_path,
                    "pdf_path": pdf_path,
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
        lesson_data: Dict[str, Any],
        workspace_path: str,
        generation_mode: str
    ) -> str:
        """Build the initial orchestration prompt.

        Args:
            lesson_data: Extracted lesson metadata
            workspace_path: Path to workspace
            generation_mode: "session" or "template"

        Returns:
            Initial prompt string
        """
        evidence_context = ""
        if generation_mode == "session":
            evidence_context = """
✅ `evidence_summary.json` has been pre-populated by Python analysis
   - Source: Session evidence records
   - Analyzed: Student performance metrics, challenge areas
   - Location: `/workspace/evidence_summary.json`
"""

        return f"""# Revision Notes Generation Task

You are generating **concise but powerful** revision notes for a completed lesson.

## Input Specification
- **Lesson**: {lesson_data.get('title', 'N/A')}
- **Type**: {lesson_data.get('lesson_type', 'teach')}
- **Course**: {lesson_data.get('subject', 'N/A')} ({lesson_data.get('level', 'N/A')})
- **Generation Mode**: {generation_mode}

## Workspace
All files are in: {workspace_path}

## Pre-Processing (Complete)
✅ `lesson_snapshot.json` has been pre-populated by Python extraction
   - Source: Lesson template or session snapshot
   - Contains: Full lesson content (cards, CFUs, rubrics, misconceptions)
   - Location: `/workspace/lesson_snapshot.json`

✅ `sow_context.json` has been pre-populated by Python extraction
   - Source: Authored_SOW document
   - Contains: Curriculum positioning, coherence notes
   - Location: `/workspace/sow_context.json`

✅ `Course_data.txt` has been pre-populated by Python extraction
   - Source: sqa_education.sqa_current collection
   - Contains: Official SQA outcomes, assessment standards
   - Location: `/workspace/Course_data.txt`
{evidence_context}

## Your Task
Generate revision notes following the prompt instructions in your system prompt.

**Output**: Write `revision_notes.json` to workspace.

**Critical Steps**:
1. Read ALL input files (lesson_snapshot.json, Course_data.txt, sow_context.json)
2. Extract key concepts, worked examples, misconceptions from lesson
3. Write complete revision_notes.json with ALL required sections
4. Validate using: mcp__validator__validate_revision_notes {{"file_path": "revision_notes.json"}}
5. If validation fails: fix errors and re-validate
6. Report completion when validation passes

Begin now.
"""


async def main():
    """Example usage of Revision Notes Author agent."""
    agent = RevisionNotesAuthorClaudeAgent(
        mcp_config_path=".mcp.json",
        persist_workspace=True,
        log_level="INFO"
    )

    # Example 1: Generate from lesson template
    result = await agent.execute(
        lessonTemplateId="lesson_template_123",
        export_format="both"
    )

    # Example 2: Generate from session (with evidence)
    # result = await agent.execute(
    #     sessionId="session_456",
    #     export_format="both"
    # )

    if result["success"]:
        print(f"✓ Revision notes generated successfully!")
        print(f"  Execution ID: {result['execution_id']}")
        print(f"  Document ID: {result['appwrite_document_id']}")
        print(f"  Markdown: {result['markdown_path']}")
        print(f"  PDF: {result['pdf_path']}")
        print(f"  Total Cost: ${result['metrics']['total_cost_usd']:.4f}")
    else:
        print(f"✗ Generation failed: {result['error']}")


if __name__ == "__main__":
    asyncio.run(main())
