"""Lesson Template Migration Agent - Upgrades old lessons to current schema.

Orchestrates a simple migration pipeline:
1. Fetch existing lesson template from Appwrite
2. Pre-validate to identify missing fields
3. Run migration agent to add missing content (rubrics, misconceptions, etc.)
4. Post-validate to ensure schema compliance
5. Upsert migrated lesson back to Appwrite

Key Features:
- Preserves ALL existing educational content
- Adds only missing required fields (rubrics, misconceptions)
- Uses comprehensive Pydantic validation
- Retry loop with validation errors
- Cost tracking per migration

Architecture:
- Single migration subagent (no research, no multi-stage)
- Validation-driven (errors guide migration)
- Fast-fail if migration impossible after retries
"""

import asyncio
import json
import logging
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AgentDefinition, ResultMessage

from .utils.filesystem import IsolatedFilesystem
from .utils.validation import validate_diagram_author_input  # Reuse (validates courseId + order)
from .utils.metrics import CostTracker, format_cost_report
from .utils.logging_config import setup_logging
from .utils.diagram_extractor import fetch_lesson_template  # Fetch existing lesson
from .utils.lesson_upserter import upsert_lesson_template  # Write migrated lesson
from .utils.diagram_validator import _parse_json_fields  # Parse JSON strings
from .tools.json_validator_tool import validation_server, LessonTemplate
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class LessonMigrationClaudeAgent:
    """Autonomous lesson template migration pipeline using Claude Agent SDK.

    Pipeline:
    1. Fetch existing lesson template from Appwrite
    2. Pre-validate with Pydantic (identify what's missing)
    3. Run migration subagent (adds missing fields, preserves existing content)
    4. Post-validate (ensure schema compliance)
    5. Upsert migrated lesson to Appwrite

    Attributes:
        mcp_config_path: Path to .mcp.json configuration file
        persist_workspace: Whether to preserve workspace after execution
        max_retries: Maximum attempts for migration validation loop
        execution_id: Unique identifier for this execution
        cost_tracker: Tracks costs across migration attempts
    """

    def __init__(
        self,
        mcp_config_path: str = ".mcp.json",
        persist_workspace: bool = True,
        max_retries: int = 3,
        log_level: str = "INFO"
    ):
        """Initialize Lesson Migration agent.

        Args:
            mcp_config_path: Path to MCP configuration file
            persist_workspace: If True, preserve workspace for debugging
            max_retries: Maximum attempts for migration validation loop
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        """
        self.mcp_config_path = Path(mcp_config_path)
        self.persist_workspace = persist_workspace
        self.max_retries = max_retries

        # Generate execution ID (timestamp-based)
        self.execution_id = datetime.now().strftime("migration_%Y%m%d_%H%M%S")

        # Initialize cost tracker
        self.cost_tracker = CostTracker(execution_id=self.execution_id)

        # Setup logging
        setup_logging(log_level=log_level)

        logger.info(f"Initialized LessonMigrationClaudeAgent - Execution ID: {self.execution_id}")

    def _get_subagent_definition(self) -> AgentDefinition:
        """Load migration subagent definition with prompt.

        Returns:
            AgentDefinition for migration agent

        Raises:
            FileNotFoundError: If prompt file is missing
        """
        prompts_dir = Path(__file__).parent / "prompts"
        prompt_path = prompts_dir / "lesson_migration_prompt.md"

        if not prompt_path.exists():
            raise FileNotFoundError(
                f"Migration prompt not found: {prompt_path}. "
                f"Ensure lesson_migration_prompt.md exists in {prompts_dir}"
            )

        agent_def = AgentDefinition(
            description="Migration agent for upgrading lesson templates to current schema",
            prompt=prompt_path.read_text()
        )

        logger.info("Loaded migration subagent definition")
        return agent_def

    async def execute(
        self,
        courseId: str,
        order: int
    ) -> Dict[str, Any]:
        """Execute the complete lesson migration pipeline.

        Args:
            courseId: Course identifier (e.g., 'course_c84874')
            order: Lesson order number in SOW entries

        Returns:
            Dictionary containing:
                - success: bool
                - execution_id: str
                - workspace_path: str
                - migrated: bool (True if lesson was migrated, False if already valid)
                - appwrite_document_id: str (if successful)
                - validation_errors_before: list (errors before migration)
                - validation_errors_after: list (errors after migration, empty if success)
                - metrics: dict (cost and token usage)
                - error: str (if failed)

        Raises:
            ValueError: If courseId not found or order invalid
            FileNotFoundError: If MCP config or prompts missing
        """
        # Validate input schema (courseId + order format)
        is_valid, error_msg = validate_diagram_author_input({
            "courseId": courseId,
            "order": order
        })
        if not is_valid:
            logger.error(f"Input validation failed: {error_msg}")
            return {
                "success": False,
                "execution_id": self.execution_id,
                "error": f"Input validation failed: {error_msg}",
                "metrics": self.cost_tracker.get_summary()
            }

        logger.info(f"Starting migration for courseId='{courseId}', order={order}")
        start_time = time.time()

        try:
            # Step 1: Fetch existing lesson template from Appwrite
            logger.info("Step 1: Fetching existing lesson template from Appwrite...")
            template = await fetch_lesson_template(
                course_id=courseId,
                order=order,
                mcp_config_path=str(self.mcp_config_path)
            )

            lesson_template_id = template.get("$id", template.get("lessonTemplateId", "UNKNOWN"))
            title = template.get("title", "Untitled")
            logger.info(f"✓ Fetched lesson: {lesson_template_id} - '{title}'")

            # Step 2: Pre-validate to check if migration is needed
            logger.info("Step 2: Pre-validating lesson with Pydantic schema...")
            parsed_template = _parse_json_fields(template)

            try:
                validated = LessonTemplate(**parsed_template)
                logger.info("✓ Lesson is already valid - NO MIGRATION NEEDED")

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "migrated": False,
                    "message": "Lesson already meets current schema - no migration needed",
                    "appwrite_document_id": lesson_template_id,
                    "validation_errors_before": [],
                    "validation_errors_after": [],
                    "metrics": self.cost_tracker.get_summary()
                }

            except ValidationError as e:
                # Lesson needs migration
                validation_errors_before = [
                    f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
                    for err in e.errors()
                ]

                logger.warning(
                    f"✗ Lesson has {len(validation_errors_before)} validation errors - migration required"
                )
                for error in validation_errors_before[:5]:
                    logger.warning(f"  - {error}")

            # Step 3: Create isolated workspace for migration
            logger.info("Step 3: Creating isolated workspace...")

            # Use context manager for workspace - entire migration must be inside this block
            with IsolatedFilesystem(self.execution_id, persist=self.persist_workspace, workspace_type="migration") as filesystem:
                workspace_path = filesystem.root
                logger.info(f"✓ Workspace created: {workspace_path}")

                # Write current lesson to workspace
                (workspace_path / "current_lesson.json").write_text(json.dumps(template, indent=2))
                (workspace_path / "validation_errors.txt").write_text("\n".join(validation_errors_before))

                logger.info(f"✓ Wrote current_lesson.json ({len(json.dumps(template))} bytes)")
                logger.info(f"✓ Wrote validation_errors.txt ({len(validation_errors_before)} errors)")

                # Step 4: Run migration subagent with retry loop
                logger.info(f"Step 4: Running migration subagent (max {self.max_retries} attempts)...")

                # Load migration subagent definition
                migration_agent_def = self._get_subagent_definition()

                # MCP servers for migration agent (validation tool only)
                mcp_servers_for_migration = {
                    "validator": validation_server  # JSON validation tool
                }

                migrated_lesson = None
                validation_errors_after = []

                for attempt in range(1, self.max_retries + 1):
                    logger.info(f"Migration attempt {attempt}/{self.max_retries}...")

                    # Configure Claude SDK options for this attempt
                    options = ClaudeAgentOptions(
                        model='claude-sonnet-4-5',
                        agents={"migration": migration_agent_def},  # Dictionary mapping name to agent def
                        permission_mode='bypassPermissions',  # Bypass all permission prompts
                        mcp_servers=mcp_servers_for_migration,  # Validation tool MCP
                        allowed_tools=[
                            'Read', 'Write', 'Edit', 'Glob', 'Grep',
                            'mcp__validator__validate_lesson_template'  # Validation tool
                        ],
                        max_turns=100,  # Migration should be quick
                        cwd=str(workspace_path)
                    )

                    # Execute migration agent
                    async with ClaudeSDKClient(options) as client:
                        # Send initial query to start migration
                        initial_prompt = "Please start the migration process. Read the files in /workspace and perform the migration as instructed in your prompt."
                        await client.query(initial_prompt)

                        # Process messages with full raw logging
                        logger.info("Starting message stream - logging ALL raw messages...")
                        message_count = 0

                        async for message in client.receive_messages():
                            message_count += 1

                            # Log FULL raw message at INFO level
                            logger.info(f"=" * 80)
                            logger.info(f"RAW MESSAGE #{message_count} | Type: {type(message).__name__}")
                            logger.info(f"=" * 80)
                            logger.info(f"{message}")
                            logger.info(f"=" * 80)

                            if isinstance(message, ResultMessage):
                                # Migration agent has completed
                                logger.info(f"✅ Migration completed after {message_count} messages")
                                break

                        logger.info("Message stream complete")

                    # TODO: Track costs (needs proper ResultMessage handling)
                    # For now, skip cost tracking until we get migration working
                    logger.debug(f"Migration attempt {attempt} completed (cost tracking disabled for now)")

                    # Check if migrated lesson was written
                    migrated_path = workspace_path / "migrated_lesson.json"
                    if not migrated_path.exists():
                        logger.warning(f"⚠️ Agent contract violation: migrated_lesson.json not found")

                        # SALVAGE CHECK: Agent may have modified current_lesson.json in-place
                        # This violates the prompt contract but the migration work may still be valid
                        current_lesson_path = workspace_path / "current_lesson.json"

                        if current_lesson_path.exists():
                            logger.info("Checking if agent modified current_lesson.json in-place...")

                            # Read the potentially-migrated lesson
                            try:
                                current_lesson = json.loads(current_lesson_path.read_text())
                                parsed_current = _parse_json_fields(current_lesson)

                                # Try to validate it
                                validated_current = LessonTemplate(**parsed_current)

                                # If validation passes, the migration succeeded but used wrong filename
                                logger.warning("⚠️ AGENT CONTRACT VIOLATION: Agent modified current_lesson.json instead of creating migrated_lesson.json")
                                logger.info("🔧 Salvaging valid migration result from current_lesson.json...")

                                # Copy to correct location
                                shutil.copy2(current_lesson_path, migrated_path)
                                logger.info(f"✓ Salvaged migration result to migrated_lesson.json")

                                # Continue with normal flow (will re-read and validate from correct path)

                            except (ValidationError, json.JSONDecodeError) as e:
                                # If validation fails, current_lesson.json is not a valid migration
                                logger.error(f"✗ Attempt {attempt} failed: migrated_lesson.json not found and current_lesson.json invalid")
                                validation_errors_after = ["Migration agent did not write migrated_lesson.json"]
                                continue
                        else:
                            logger.error(f"✗ Attempt {attempt} failed: migrated_lesson.json not found")
                            validation_errors_after = ["Migration agent did not write migrated_lesson.json"]
                            continue

                    # Verify file exists after salvage attempt
                    if not migrated_path.exists():
                        logger.error(f"✗ Attempt {attempt} failed: migrated_lesson.json still not found after salvage")
                        validation_errors_after = ["Migration agent did not write migrated_lesson.json"]
                        continue

                    # Read migrated lesson
                    migrated_lesson = json.loads(migrated_path.read_text())
                    logger.info(f"✓ Migration agent wrote migrated_lesson.json ({len(json.dumps(migrated_lesson))} bytes)")

                    # Post-validate migrated lesson
                    logger.info(f"Validating migrated lesson (attempt {attempt})...")
                    parsed_migrated = _parse_json_fields(migrated_lesson)

                    try:
                        validated_migrated = LessonTemplate(**parsed_migrated)
                        logger.info(f"✅ Validation PASSED on attempt {attempt}!")
                        validation_errors_after = []
                        break  # Success!

                    except ValidationError as e:
                        validation_errors_after = [
                            f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
                            for err in e.errors()
                        ]

                        logger.warning(
                            f"✗ Validation FAILED on attempt {attempt}: {len(validation_errors_after)} errors"
                        )
                        for error in validation_errors_after[:5]:
                            logger.warning(f"  - {error}")

                        # Update validation errors file for next attempt
                        (workspace_path / "validation_errors.txt").write_text("\n".join(validation_errors_after))

                # Check final result
                if validation_errors_after:
                    logger.error(f"❌ Migration FAILED after {self.max_retries} attempts")
                    logger.error(f"Remaining errors: {len(validation_errors_after)}")

                    # Preserve workspace for debugging
                    if self.persist_workspace:
                        logger.info(f"Workspace preserved for debugging: {workspace_path}")

                    return {
                        "success": False,
                        "execution_id": self.execution_id,
                        "workspace_path": str(workspace_path),
                        "migrated": False,
                        "validation_errors_before": validation_errors_before,
                        "validation_errors_after": validation_errors_after,
                        "error": f"Migration failed after {self.max_retries} attempts. "
                                 f"Remaining errors: {len(validation_errors_after)}",
                        "metrics": self.cost_tracker.get_summary()
                    }

                # Step 5: Upsert migrated lesson to Appwrite
                logger.info("Step 5: Upserting migrated lesson to Appwrite...")

                upserted_id = await upsert_lesson_template(
                    lesson_template_path=str(migrated_path),
                    courseId=courseId,
                    order=order,
                    execution_id=self.execution_id,
                    mcp_config_path=str(self.mcp_config_path)
                )

                logger.info(f"✅ Migrated lesson upserted: {upserted_id}")

                # Calculate execution time
                execution_time = time.time() - start_time

                # Log workspace status (context manager handles cleanup automatically)
                if self.persist_workspace:
                    logger.info(f"Workspace preserved: {workspace_path}")
                else:
                    logger.info("Workspace will be cleaned up automatically")

                # Return success result
                logger.info(f"✅ Migration completed successfully in {execution_time:.1f}s")

                return {
                    "success": True,
                    "execution_id": self.execution_id,
                    "workspace_path": str(workspace_path) if self.persist_workspace else None,
                    "migrated": True,
                    "appwrite_document_id": upserted_id,
                    "validation_errors_before": validation_errors_before,
                    "validation_errors_after": [],
                    "errors_fixed": len(validation_errors_before),
                    "metrics": {
                        **self.cost_tracker.get_summary(),
                        "execution_time_seconds": execution_time
                    }
                }

        except Exception as e:
            logger.error(f"❌ Migration failed with exception: {e}", exc_info=True)

            return {
                "success": False,
                "execution_id": self.execution_id,
                "migrated": False,
                "error": f"Migration failed with exception: {str(e)}",
                "metrics": self.cost_tracker.get_summary()
            }


# CLI entry point for single lesson migration
async def main():
    """CLI entry point for single lesson migration.

    Usage:
        python -m src.lesson_migration_claude_client --courseId course_c84473 --order 13
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate a single lesson template to current schema"
    )
    parser.add_argument("--courseId", type=str, required=True, help="Course ID")
    parser.add_argument("--order", type=int, required=True, help="Lesson order number")
    parser.add_argument("--log-level", type=str, default="INFO", help="Logging level")

    args = parser.parse_args()

    # Create agent
    agent = LessonMigrationClaudeAgent(log_level=args.log_level)

    # Execute migration
    result = await agent.execute(courseId=args.courseId, order=args.order)

    # Print summary
    print("\n" + "="*80)
    print("MIGRATION SUMMARY")
    print("="*80 + "\n")

    if result["success"]:
        if result["migrated"]:
            print(f"✅ Migration SUCCESSFUL")
            print(f"Errors fixed: {result['errors_fixed']}")
            print(f"Appwrite document ID: {result['appwrite_document_id']}")
        else:
            print(f"✅ Lesson already valid - no migration needed")
            print(f"Appwrite document ID: {result['appwrite_document_id']}")
    else:
        print(f"❌ Migration FAILED")
        print(f"Error: {result['error']}")

    # Print cost metrics
    print("\nCost Metrics:")
    metrics = result["metrics"]
    print(f"  Total cost: ${metrics.get('total_cost_usd', 0):.4f}")
    if "execution_time_seconds" in metrics:
        print(f"  Execution time: {metrics['execution_time_seconds']:.1f}s")

    return 0 if result["success"] else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
