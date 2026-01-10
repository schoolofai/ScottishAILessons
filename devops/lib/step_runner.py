"""Step Runner for Pipeline Execution.

Executes individual pipeline steps with direct Python imports for agents.
Uses subprocess only for TypeScript seeding step.

Architecture:
- Step 1 (Seed): TypeScript subprocess (tsx scripts/seedSingleCourse.ts)
- Step 2 (SOW): Direct Python import (SOWAuthorClaudeAgent)
- Step 3 (Lessons): Direct Python import (LessonAuthorClaudeAgent)
- Step 4 (Diagrams): Direct Python import (DiagramAuthorClaudeAgent)

Usage:
    from devops.lib.step_runner import StepRunner, StepResult

    runner = StepRunner(config, observability)
    result = await runner.run_seed(subject="mathematics", level="national_5")
"""

import asyncio
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add claud_author_agent to path for direct imports
DEVOPS_LIB_DIR = Path(__file__).parent
DEVOPS_DIR = DEVOPS_LIB_DIR.parent
PROJECT_ROOT = DEVOPS_DIR.parent
AGENT_PATH = PROJECT_ROOT / "claud_author_agent"

# Add to Python path if not already present
if str(AGENT_PATH) not in sys.path:
    sys.path.insert(0, str(AGENT_PATH))


@dataclass
class StepResult:
    """Result from a pipeline step execution."""

    success: bool
    outputs: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    execution_id: Optional[str] = None
    workspace_path: Optional[str] = None
    skipped: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "success": self.success,
            "outputs": self.outputs,
            "metrics": self.metrics,
            "error": self.error,
            "execution_id": self.execution_id,
            "workspace_path": self.workspace_path,
            "skipped": self.skipped
        }


class StepRunner:
    """Executes individual pipeline steps.

    Uses DIRECT PYTHON IMPORTS for agent steps (better metrics access).
    Uses SUBPROCESS for TypeScript seeding step.

    Benefits of direct import:
    - Direct access to CostTracker metrics
    - Structured result dict (no stdout parsing)
    - Better exception handling with stack traces
    - Access to execution_id and workspace_path
    """

    def __init__(self, config, observability):
        """Initialize step runner.

        Args:
            config: PipelineConfig with run settings
            observability: ObservabilityManager for logging/metrics
        """
        self.config = config
        self.observability = observability
        self.project_root = PROJECT_ROOT
        self.mcp_config_path = str(AGENT_PATH / ".mcp.json")
        self.logger = logging.getLogger(f"step_runner.{config.run_id}")

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: SEED (TypeScript - subprocess)
    # ═══════════════════════════════════════════════════════════════════════════

    async def run_seed(self, subject: str, level: str) -> StepResult:
        """Execute Step 1: Seed course + outcomes (TypeScript subprocess).

        Runs: tsx scripts/seedSingleCourse.ts --subject <subject> --level <level>

        Args:
            subject: SQA subject (underscore format)
            level: SQA level (underscore format)

        Returns:
            StepResult with course_id in outputs
        """
        self.logger.info(f"Starting seed for {subject}/{level}")

        cmd = [
            "tsx",
            "scripts/seedSingleCourse.ts",
            "--subject", subject,
            "--level", level
        ]

        if self.config.force:
            cmd.append("--force-update")

        if self.config.dry_run:
            cmd.append("--dry-run")

        result = await self._run_subprocess(
            cmd,
            cwd=self.project_root / "assistant-ui-frontend",
            step_name="seed"
        )

        if result.success:
            # Parse output to extract course_id
            stdout = result.outputs.get("stdout", "")
            course_id = self._extract_course_id(stdout)
            if course_id:
                result.outputs["course_id"] = course_id
                self.logger.info(f"Seed completed: course_id={course_id}")
            else:
                self.logger.warning("Could not extract course_id from seed output")

        return result

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: SOW AUTHOR (Direct Python Import)
    # ═══════════════════════════════════════════════════════════════════════════

    async def run_sow(self, course_id: str) -> StepResult:
        """Execute Step 2: Author SOW via direct Python import.

        Args:
            course_id: Course identifier (e.g., course_c84775)

        Returns:
            StepResult with sow_document_id and lesson_count in outputs
        """
        self.logger.info(f"Starting SOW authoring for {course_id}")

        try:
            # Import agent class
            from src.sow_author_claude_client import SOWAuthorClaudeAgent

            # Instantiate agent with workspace persistence for debugging
            agent = SOWAuthorClaudeAgent(
                mcp_config_path=self.mcp_config_path,
                persist_workspace=True,
                log_level="INFO"
            )

            # Execute agent - returns structured result dict
            result = await agent.execute(
                courseId=course_id,
                force=self.config.force
            )

            # result contains: {success, execution_id, workspace_path, metrics, error, ...}
            return StepResult(
                success=result.get("success", False),
                outputs={
                    "sow_document_id": result.get("sow_document_id"),
                    "lesson_count": result.get("lesson_count"),
                    "version": result.get("version")
                },
                metrics=self._extract_agent_metrics(result),
                error=result.get("error"),
                execution_id=result.get("execution_id"),
                workspace_path=result.get("workspace_path")
            )

        except ImportError as e:
            error_msg = f"Failed to import SOWAuthorClaudeAgent: {e}"
            self.logger.error(error_msg)
            return StepResult(success=False, error=error_msg)

        except Exception as e:
            self.logger.error(f"SOW authoring failed: {e}", exc_info=True)
            return StepResult(success=False, error=str(e))

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: LESSON AUTHOR (Direct Python Import - Batch)
    # ═══════════════════════════════════════════════════════════════════════════

    async def run_lessons(self, course_id: str) -> StepResult:
        """Execute Step 3: Batch lesson generation via direct Python import.

        Iterates through all SOW entries and generates lessons.
        Collects metrics from each lesson's CostTracker.

        Args:
            course_id: Course identifier

        Returns:
            StepResult with batch statistics in outputs
        """
        self.logger.info(f"Starting batch lesson generation for {course_id}")

        try:
            # Import agent and utilities
            from src.lesson_author_claude_client import LessonAuthorClaudeAgent
            from src.utils.appwrite_mcp import list_appwrite_documents

            # Get SOW entries for this course
            sow_docs = await list_appwrite_documents(
                database_id="default",
                collection_id="Authored_SOW",
                queries=[f'equal("courseId", "{course_id}")'],
                mcp_config_path=self.mcp_config_path
            )

            if not sow_docs:
                raise ValueError(f"No SOW found for course {course_id}")

            # Parse entries from SOW document
            sow_doc = sow_docs[0]
            entries_json = sow_doc.get("entries", "[]")
            if isinstance(entries_json, str):
                import json
                entries = json.loads(entries_json)
            else:
                entries = entries_json

            if not entries:
                raise ValueError(f"SOW has no entries for course {course_id}")

            total_lessons = len(entries)
            completed = 0
            failed = 0
            skipped = 0
            total_metrics = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0}
            lesson_results = []

            for entry in entries:
                order = entry.get("order")
                self.logger.info(f"Processing lesson {order}/{total_lessons}")

                # Check if lesson already exists (skip logic)
                if not self.config.force:
                    existing = await list_appwrite_documents(
                        database_id="default",
                        collection_id="lesson_templates",
                        queries=[
                            f'equal("courseId", "{course_id}")',
                            f'equal("sow_order", {order})'
                        ],
                        mcp_config_path=self.mcp_config_path
                    )
                    if existing:
                        self.logger.info(f"Lesson {order} already exists, skipping")
                        skipped += 1
                        lesson_results.append({
                            "order": order,
                            "success": True,
                            "skipped": True
                        })
                        continue

                try:
                    # Create agent instance for each lesson
                    agent = LessonAuthorClaudeAgent(
                        mcp_config_path=self.mcp_config_path,
                        persist_workspace=True,
                        log_level="INFO"
                    )

                    result = await agent.execute(
                        courseId=course_id,
                        order=order
                    )

                    if result.get("success"):
                        completed += 1
                        metrics = self._extract_agent_metrics(result)
                        total_metrics["input_tokens"] += metrics.get("input_tokens", 0)
                        total_metrics["output_tokens"] += metrics.get("output_tokens", 0)
                        total_metrics["cost_usd"] += metrics.get("cost_usd", 0)
                    else:
                        failed += 1

                    lesson_results.append({
                        "order": order,
                        "success": result.get("success"),
                        "execution_id": result.get("execution_id"),
                        "error": result.get("error")
                    })

                except Exception as e:
                    self.logger.error(f"Lesson {order} failed: {e}")
                    failed += 1
                    lesson_results.append({
                        "order": order,
                        "success": False,
                        "error": str(e)
                    })

            success = failed == 0

            return StepResult(
                success=success,
                outputs={
                    "total_lessons": total_lessons,
                    "completed": completed,
                    "failed": failed,
                    "skipped": skipped,
                    "lesson_results": lesson_results
                },
                metrics=total_metrics,
                error=f"{failed} lessons failed" if failed > 0 else None
            )

        except ImportError as e:
            error_msg = f"Failed to import LessonAuthorClaudeAgent: {e}"
            self.logger.error(error_msg)
            return StepResult(success=False, error=error_msg)

        except Exception as e:
            self.logger.error(f"Batch lesson generation failed: {e}", exc_info=True)
            return StepResult(success=False, error=str(e))

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 4: DIAGRAM AUTHOR (Direct Python Import - Batch)
    # ═══════════════════════════════════════════════════════════════════════════

    async def run_diagrams(self, course_id: str) -> StepResult:
        """Execute Step 4: Batch diagram generation via direct Python import.

        Iterates through all lesson templates and generates diagrams.

        Args:
            course_id: Course identifier

        Returns:
            StepResult with batch statistics in outputs
        """
        self.logger.info(f"Starting batch diagram generation for {course_id}")

        try:
            # Import agent and utilities
            from src.diagram_author_claude_client import DiagramAuthorClaudeAgent
            from src.utils.appwrite_mcp import list_appwrite_documents

            # Get all lesson templates for this course
            lessons = await list_appwrite_documents(
                database_id="default",
                collection_id="lesson_templates",
                queries=[f'equal("courseId", "{course_id}")'],
                mcp_config_path=self.mcp_config_path
            )

            if not lessons:
                raise ValueError(f"No lesson templates found for course {course_id}")

            # Sort by sow_order
            lessons.sort(key=lambda x: x.get("sow_order", 0))

            total_lessons = len(lessons)
            completed = 0
            failed = 0
            skipped = 0
            total_metrics = {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0}
            diagram_results = []

            for lesson in lessons:
                order = lesson.get("sow_order")
                lesson_id = lesson.get("$id")
                self.logger.info(f"Processing diagrams for lesson {order}/{total_lessons}")

                try:
                    agent = DiagramAuthorClaudeAgent(
                        mcp_config_path=self.mcp_config_path,
                        persist_workspace=True,
                        log_level="INFO"
                    )

                    result = await agent.execute(
                        courseId=course_id,
                        order=order,
                        force=self.config.force
                    )

                    if result.get("success"):
                        completed += 1
                        metrics = self._extract_agent_metrics(result)
                        total_metrics["input_tokens"] += metrics.get("input_tokens", 0)
                        total_metrics["output_tokens"] += metrics.get("output_tokens", 0)
                        total_metrics["cost_usd"] += metrics.get("cost_usd", 0)
                    elif result.get("skipped"):
                        skipped += 1
                    else:
                        failed += 1

                    diagram_results.append({
                        "order": order,
                        "lesson_id": lesson_id,
                        "success": result.get("success"),
                        "skipped": result.get("skipped", False),
                        "diagrams_created": result.get("diagrams_created", 0),
                        "error": result.get("error")
                    })

                except Exception as e:
                    self.logger.error(f"Diagram generation for lesson {order} failed: {e}")
                    failed += 1
                    diagram_results.append({
                        "order": order,
                        "lesson_id": lesson_id,
                        "success": False,
                        "error": str(e)
                    })

            success = failed == 0

            return StepResult(
                success=success,
                outputs={
                    "total_lessons": total_lessons,
                    "completed": completed,
                    "failed": failed,
                    "skipped": skipped,
                    "diagram_results": diagram_results
                },
                metrics=total_metrics,
                error=f"{failed} diagram generations failed" if failed > 0 else None
            )

        except ImportError as e:
            error_msg = f"Failed to import DiagramAuthorClaudeAgent: {e}"
            self.logger.error(error_msg)
            return StepResult(success=False, error=error_msg)

        except Exception as e:
            self.logger.error(f"Batch diagram generation failed: {e}", exc_info=True)
            return StepResult(success=False, error=str(e))

    # ═══════════════════════════════════════════════════════════════════════════
    # HELPER METHODS
    # ═══════════════════════════════════════════════════════════════════════════

    def _extract_agent_metrics(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract metrics from agent result (direct access to CostTracker data).

        Args:
            result: Result dictionary from agent.execute()

        Returns:
            Normalized metrics dictionary
        """
        metrics = result.get("metrics", {})

        return {
            "input_tokens": metrics.get("total_input_tokens", 0),
            "output_tokens": metrics.get("total_output_tokens", 0),
            "cost_usd": metrics.get("total_cost", 0),
            "execution_time_seconds": metrics.get("execution_time_seconds", 0),
            "subagent_count": len(metrics.get("subagent_metrics", {}))
        }

    async def _run_subprocess(
        self,
        cmd: List[str],
        cwd: Path,
        step_name: str
    ) -> StepResult:
        """Execute a subprocess command (for TypeScript step).

        Args:
            cmd: Command and arguments
            cwd: Working directory
            step_name: Name for logging

        Returns:
            StepResult with stdout in outputs
        """
        log_file = self._get_log_path(step_name)
        log_file.parent.mkdir(parents=True, exist_ok=True)

        self.logger.debug(f"Running command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env={**os.environ}  # Inherit environment
            )

            stdout, _ = await process.communicate()
            stdout_str = stdout.decode("utf-8")

            # Write to log file
            with open(log_file, "w") as f:
                f.write(f"Command: {' '.join(cmd)}\n")
                f.write(f"Working directory: {cwd}\n")
                f.write(f"Exit code: {process.returncode}\n")
                f.write("-" * 40 + "\n")
                f.write(stdout_str)

            success = process.returncode == 0

            return StepResult(
                success=success,
                outputs={"stdout": stdout_str},
                metrics={},  # TypeScript step doesn't have token metrics
                error=None if success else f"Exit code: {process.returncode}"
            )

        except FileNotFoundError as e:
            error_msg = f"Command not found: {cmd[0]}. Error: {e}"
            self.logger.error(error_msg)
            return StepResult(success=False, error=error_msg)

        except Exception as e:
            self.logger.error(f"Subprocess failed: {e}", exc_info=True)
            return StepResult(success=False, error=str(e))

    def _get_log_path(self, step_name: str) -> Path:
        """Get log file path for a step."""
        return (
            self.project_root /
            "devops/logs" /
            self.config.run_id /
            "steps" /
            f"{step_name}.log"
        )

    def _extract_course_id(self, output: str) -> Optional[str]:
        """Extract course_id from seed script output.

        Looks for patterns like:
        - course_id: course_c84775
        - courseId: "course_c84775"
        - Created course: course_c84775
        """
        patterns = [
            r'course_id["\s:]+([a-zA-Z0-9_]+)',
            r'courseId["\s:]+([a-zA-Z0-9_]+)',
            r'Created course[:\s]+([a-zA-Z0-9_]+)',
            r'(course_[a-zA-Z0-9]+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, output, re.IGNORECASE)
            if match:
                return match.group(1)

        return None
