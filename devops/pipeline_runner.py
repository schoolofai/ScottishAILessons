#!/usr/bin/env python3
"""Pipeline Orchestrator for Content Authoring.

Main entry point for running content generation pipelines.
Orchestrates step execution with checkpoint/resume support.

Usage:
    # New run
    python pipeline_runner.py lessons --subject mathematics --level national_5

    # Resume failed run
    python pipeline_runner.py lessons --resume 20260109_143022

    # Dry run (preview without execution)
    python pipeline_runner.py lessons --subject math --level n5 --dry-run

    # List previous runs
    python pipeline_runner.py list

    # Skip diagram generation
    python pipeline_runner.py lessons --subject physics --level higher --skip-diagrams

    # Skip seed+SOW (use existing course/SOW)
    python pipeline_runner.py lessons --subject application_of_mathematics --level higher --skip-seed-sow

    # Combine flags: skip seed+SOW and diagrams
    python pipeline_runner.py lessons --subject aom --level h --skip-seed-sow --skip-diagrams
"""

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional, Dict, Any

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from devops.lib.checkpoint_manager import CheckpointManager, PipelineState, StepState
from devops.lib.step_runner import StepRunner, StepResult
from devops.lib.observability import ObservabilityManager
from devops.lib.diagram_service import DiagramServiceManager, DiagramServiceError
from devops.lib.validators import validate_subject_level, get_valid_subjects, get_valid_levels


class PipelineStep(Enum):
    """Pipeline steps in execution order."""

    SEED = "seed"
    SOW = "sow"
    LESSONS = "lessons"
    DIAGRAMS = "diagrams"


@dataclass
class PipelineConfig:
    """Configuration for pipeline execution."""

    subject: str
    level: str
    run_id: str = field(default_factory=lambda: datetime.now().strftime("%Y%m%d_%H%M%S"))
    dry_run: bool = False
    skip_diagrams: bool = False
    skip_seed_sow: bool = False
    force: bool = False
    diagram_timeout: int = 60
    use_iterative_sow: bool = True  # Use iterative SOW authoring by default
    version: str = "1"  # SOW version number

    @classmethod
    def from_checkpoint(cls, run_id: str) -> "PipelineConfig":
        """Load config from existing checkpoint.

        Args:
            run_id: Run ID to resume

        Returns:
            PipelineConfig loaded from checkpoint

        Raises:
            FileNotFoundError: If checkpoint doesn't exist
        """
        checkpoint_mgr = CheckpointManager(run_id)
        if not checkpoint_mgr.exists():
            raise FileNotFoundError(
                f"No checkpoint found for run_id: {run_id}. "
                f"Use 'python pipeline_runner.py list' to see available runs."
            )

        state = checkpoint_mgr.load_or_create()
        return cls(
            subject=state.subject,
            level=state.level,
            run_id=run_id
        )


class LessonsPipeline:
    """Orchestrates the complete course creation pipeline.

    Pipeline Steps:
    1. SEED: Seed course + outcomes from SQA data (TypeScript)
    2. SOW: Generate Scheme of Work via Claude Agent
    3. LESSONS: Generate all lesson content via Claude Agent (batch)
    4. DIAGRAMS: Generate diagrams for lessons via Claude Agent (batch)

    Features:
    - Checkpoint/resume from any completed step
    - Observability: logging, metrics, JSON reports
    - Health checks for external services
    - Dry-run mode for testing
    """

    STEPS = [
        PipelineStep.SEED,
        PipelineStep.SOW,
        PipelineStep.LESSONS,
        PipelineStep.DIAGRAMS
    ]

    def __init__(self, config: PipelineConfig):
        """Initialize pipeline with configuration.

        Args:
            config: Pipeline configuration
        """
        self.config = config
        self.checkpoint_mgr = CheckpointManager(config.run_id)
        self.observability = ObservabilityManager(config.run_id)
        self.step_runner = StepRunner(config, self.observability)
        self.diagram_service = DiagramServiceManager()

    async def run(self) -> Dict[str, Any]:
        """Execute the pipeline with checkpoint/resume support.

        Returns:
            Result dictionary with success status, metrics, and outputs
        """
        # Load or create pipeline state
        state = self.checkpoint_mgr.load_or_create(
            subject=self.config.subject,
            level=self.config.level
        )

        # Update state status
        state.status = "in_progress"
        self.checkpoint_mgr.save(state)

        self.observability.pipeline_started(state)

        try:
            # Handle --skip-seed-sow: lookup course_id and validate SOW exists
            if self.config.skip_seed_sow:
                self.observability.log_info(
                    "Skip SEED+SOW enabled - looking up existing course"
                )

                # Lookup course_id from database
                course_id = await self.step_runner.lookup_course_id(
                    subject=self.config.subject,
                    level=self.config.level
                )
                state.course_id = course_id

                # Validate SOW exists
                await self.step_runner.validate_sow_exists(course_id)

                # Mark SEED and SOW as skipped in state
                state.last_completed_step = "sow"
                self.checkpoint_mgr.save(state)

                self.observability.step_skipped("seed", "skip_seed_sow flag set")
                self.observability.step_skipped("sow", "skip_seed_sow flag set")

            # Find starting step (resume support)
            start_index = self._get_start_index(state)

            if start_index > 0:
                self.observability.log_info(
                    f"Resuming from step {self.STEPS[start_index].value} "
                    f"(completed: {state.last_completed_step})"
                )

            for step in self.STEPS[start_index:]:
                # Skip SEED/SOW if --skip-seed-sow is set
                if self.config.skip_seed_sow and step in (PipelineStep.SEED, PipelineStep.SOW):
                    continue

                # Skip diagrams if requested
                if step == PipelineStep.DIAGRAMS and self.config.skip_diagrams:
                    self.observability.step_skipped(step.value, "skip_diagrams flag set")
                    continue

                # Pre-step: Health check for diagram service
                if step == PipelineStep.DIAGRAMS:
                    await self._ensure_diagram_service()

                # Execute step
                result = await self._execute_step(step, state)

                # Update state and checkpoint
                state = self._update_state(state, step, result)
                self.checkpoint_mgr.save(state)

                # Save detailed step result
                self.checkpoint_mgr.save_step_result(
                    step.value,
                    {
                        "success": result.success,
                        "outputs": result.outputs,
                        "metrics": result.metrics,
                        "error": result.error
                    }
                )

                # Check for failure
                if not result.success:
                    state.status = "failed"
                    state.error = result.error
                    state.next_step = step.value
                    self.checkpoint_mgr.save(state)
                    self.observability.pipeline_failed(state, step.value, result.error)
                    return self._build_result(state, success=False, error=result.error)

            # Pipeline completed successfully
            state.status = "completed"
            self.checkpoint_mgr.save(state)
            self.observability.pipeline_completed(state)
            return self._build_result(state, success=True)

        except Exception as e:
            state.status = "failed"
            state.error = str(e)
            self.checkpoint_mgr.save(state)
            self.observability.pipeline_failed(state, None, str(e))
            raise

    async def _execute_step(
        self,
        step: PipelineStep,
        state: PipelineState
    ) -> StepResult:
        """Execute a single pipeline step.

        Args:
            step: Pipeline step to execute
            state: Current pipeline state

        Returns:
            StepResult with success status and outputs
        """
        self.observability.step_started(step.value)

        # Dry run mode - simulate success
        if self.config.dry_run:
            self.observability.log_info(f"[DRY RUN] Would execute step: {step.value}")
            result = StepResult(
                success=True,
                outputs={"dry_run": True},
                metrics={"input_tokens": 0, "output_tokens": 0, "cost_usd": 0}
            )
            self.observability.step_completed(step.value, result.to_dict(), success=True)
            return result

        # Execute actual step
        if step == PipelineStep.SEED:
            result = await self.step_runner.run_seed(
                subject=self.config.subject,
                level=self.config.level
            )
            # Update state with course_id from seed
            if result.success and result.outputs:
                state.course_id = result.outputs.get("course_id")

        elif step == PipelineStep.SOW:
            if not state.course_id:
                raise ValueError("course_id not set. Run seed step first.")
            result = await self.step_runner.run_sow(
                course_id=state.course_id,
                use_iterative=self.config.use_iterative_sow
            )

        elif step == PipelineStep.LESSONS:
            if not state.course_id:
                raise ValueError("course_id not set. Run seed step first.")
            result = await self.step_runner.run_lessons(course_id=state.course_id)

        elif step == PipelineStep.DIAGRAMS:
            if not state.course_id:
                raise ValueError("course_id not set. Run seed step first.")
            result = await self.step_runner.run_diagrams(course_id=state.course_id)

        else:
            raise ValueError(f"Unknown step: {step}")

        self.observability.step_completed(
            step.value,
            result.to_dict(),
            success=result.success
        )

        return result

    async def _ensure_diagram_service(self) -> None:
        """Health check + wait for diagram service.

        Raises:
            DiagramServiceError: If service not available after timeout
        """
        self.observability.log_info(
            f"Checking diagram service health (timeout: {self.config.diagram_timeout}s)"
        )

        is_healthy = await self.diagram_service.wait_for_health(
            timeout_seconds=self.config.diagram_timeout
        )

        if not is_healthy:
            raise DiagramServiceError(
                "Diagram screenshot service not available. "
                f"Waited {self.config.diagram_timeout} seconds."
            )

        self.observability.log_info("Diagram service is healthy")

    def _get_start_index(self, state: PipelineState) -> int:
        """Determine which step to start from (resume support).

        Args:
            state: Current pipeline state

        Returns:
            Index of step to start from
        """
        if state.last_completed_step is None:
            return 0

        # Find the completed step
        for i, step in enumerate(self.STEPS):
            if step.value == state.last_completed_step:
                # Start from the next step
                return min(i + 1, len(self.STEPS))

        return 0

    def _update_state(
        self,
        state: PipelineState,
        step: PipelineStep,
        result: StepResult
    ) -> PipelineState:
        """Update pipeline state after step completion.

        Args:
            state: Current pipeline state
            step: Completed step
            result: Step result

        Returns:
            Updated pipeline state
        """
        # Create step state
        step_state = StepState(
            step=step.value,
            status="completed" if result.success else "failed",
            started_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            completed_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            outputs=result.outputs,
            metrics=result.metrics,
            error=result.error,
            execution_id=result.execution_id,
            workspace_path=result.workspace_path
        )

        # Add step to state
        state.add_step(step_state)

        # Update course_id if extracted from seed
        if step == PipelineStep.SEED and result.success:
            if result.outputs and "course_id" in result.outputs:
                state.course_id = result.outputs["course_id"]

        # Set next step
        current_index = self.STEPS.index(step)
        if current_index + 1 < len(self.STEPS):
            state.next_step = self.STEPS[current_index + 1].value
        else:
            state.next_step = None

        return state

    def _build_result(
        self,
        state: PipelineState,
        success: bool,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build final result dictionary.

        Args:
            state: Final pipeline state
            success: Whether pipeline succeeded
            error: Error message if failed

        Returns:
            Result dictionary
        """
        return {
            "success": success,
            "run_id": self.config.run_id,
            "pipeline": "lessons",
            "subject": state.subject,
            "level": state.level,
            "course_id": state.course_id,
            "steps_completed": len(state.completed_steps),
            "last_step": state.last_completed_step,
            "total_cost_usd": state.total_cost_usd,
            "total_tokens": state.total_tokens,
            "error": error,
            "reports_dir": str(self.observability.reports_dir),
            "logs_dir": str(self.observability.logs_dir)
        }


def print_summary(result: Dict[str, Any]) -> None:
    """Print pipeline execution summary.

    Args:
        result: Pipeline result dictionary
    """
    print("\n" + "=" * 60)
    print("PIPELINE EXECUTION SUMMARY")
    print("=" * 60)

    status = "SUCCESS" if result["success"] else "FAILED"
    status_icon = "\u2705" if result["success"] else "\u274c"

    print(f"\n{status_icon} Status: {status}")
    print(f"\nRun ID: {result['run_id']}")
    print(f"Pipeline: {result['pipeline']}")
    print(f"Subject: {result['subject']}")
    print(f"Level: {result['level']}")

    if result.get("course_id"):
        print(f"Course ID: {result['course_id']}")

    print(f"\nSteps Completed: {result['steps_completed']}")
    print(f"Last Step: {result.get('last_step', 'N/A')}")
    print(f"Total Cost: ${result.get('total_cost_usd', 0):.2f}")
    print(f"Total Tokens: {result.get('total_tokens', 0):,}")

    if result.get("error"):
        print(f"\nError: {result['error']}")

    print(f"\nReports: {result.get('reports_dir', 'N/A')}")
    print(f"Logs: {result.get('logs_dir', 'N/A')}")
    print("=" * 60 + "\n")


def list_runs() -> None:
    """List all pipeline runs with their status."""
    runs = CheckpointManager.list_runs()

    if not runs:
        print("\nNo pipeline runs found.\n")
        return

    print("\n" + "=" * 80)
    print("PIPELINE RUNS")
    print("=" * 80)

    # Header
    print(f"\n{'Run ID':<20} {'Subject':<15} {'Level':<12} {'Status':<12} {'Cost':>10}")
    print("-" * 80)

    for run in runs:
        cost = f"${run.get('total_cost_usd', 0):.2f}"
        print(
            f"{run['run_id']:<20} "
            f"{run['subject']:<15} "
            f"{run['level']:<12} "
            f"{run['status']:<12} "
            f"{cost:>10}"
        )

    print("-" * 80)
    print(f"Total runs: {len(runs)}")

    # Show resumable runs
    resumable = [r for r in runs if r["status"] in ("failed", "in_progress")]
    if resumable:
        print(f"\nResumable runs ({len(resumable)}):")
        for run in resumable[:5]:
            print(f"  - {run['run_id']}: {run['subject']}/{run['level']} (last: {run.get('last_completed_step', 'N/A')})")
        print("\nResume with: python pipeline_runner.py lessons --resume <run_id>")

    print()


def show_help() -> None:
    """Show detailed help information."""
    print(__doc__)

    print("\nValid Subjects:")
    for subject in get_valid_subjects():
        print(f"  - {subject}")

    print("\nValid Levels:")
    for level in get_valid_levels():
        print(f"  - {level}")

    print("\nExamples:")
    print("  # Generate full course for N5 Mathematics")
    print("  python pipeline_runner.py lessons --subject mathematics --level national_5")
    print()
    print("  # Resume a failed run")
    print("  python pipeline_runner.py lessons --resume 20260109_143022")
    print()
    print("  # Test with dry-run (no actual execution)")
    print("  python pipeline_runner.py lessons --subject physics --level higher --dry-run")
    print()
    print("  # Skip diagram generation")
    print("  python pipeline_runner.py lessons --subject chemistry --level n5 --skip-diagrams")
    print()
    print("  # Skip seed+SOW (use existing course/SOW)")
    print("  python pipeline_runner.py lessons --subject application_of_mathematics --level higher --skip-seed-sow")
    print()
    print("  # Combine flags: skip seed+SOW and diagrams")
    print("  python pipeline_runner.py lessons --subject aom --level h --skip-seed-sow --skip-diagrams")
    print()


async def main() -> int:
    """Main entry point.

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    parser = argparse.ArgumentParser(
        description="Content Authoring Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Use 'python pipeline_runner.py --help-full' for detailed help."
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # Lessons pipeline
    lessons_parser = subparsers.add_parser(
        "lessons",
        help="Run course creation pipeline"
    )
    lessons_parser.add_argument(
        "--subject",
        help="SQA subject (e.g., mathematics, physics)"
    )
    lessons_parser.add_argument(
        "--level",
        help="SQA level (e.g., national_5, higher)"
    )
    lessons_parser.add_argument(
        "--resume",
        metavar="RUN_ID",
        help="Resume from run ID"
    )
    lessons_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without execution"
    )
    lessons_parser.add_argument(
        "--skip-diagrams",
        action="store_true",
        help="Skip diagram generation step"
    )
    lessons_parser.add_argument(
        "--skip-seed-sow",
        action="store_true",
        help="Skip SEED and SOW steps (requires existing course+SOW in database)"
    )
    lessons_parser.add_argument(
        "--force",
        action="store_true",
        help="Force regenerate (ignore existing content)"
    )
    lessons_parser.add_argument(
        "--diagram-timeout",
        type=int,
        default=60,
        help="Timeout in seconds for diagram service (default: 60)"
    )

    # SOW authoring mode options (mutually exclusive)
    sow_mode_group = lessons_parser.add_mutually_exclusive_group()
    sow_mode_group.add_argument(
        "--iterative",
        action="store_true",
        default=True,
        help="Use iterative lesson-by-lesson SOW authoring (default, better schema compliance)"
    )
    sow_mode_group.add_argument(
        "--legacy",
        action="store_true",
        help="Use legacy monolithic SOW authoring (backward compatibility)"
    )

    # SOW version option
    lessons_parser.add_argument(
        "--version",
        type=str,
        default="1",
        dest="sow_version",  # Use dest to avoid conflict with argparse's --version
        help="SOW version to generate (default: 1)"
    )

    # List command
    subparsers.add_parser("list", help="List all pipeline runs")

    # Help command
    subparsers.add_parser("help", help="Show detailed help")

    args = parser.parse_args()

    # Handle commands
    if args.command == "list":
        list_runs()
        return 0

    if args.command == "help":
        show_help()
        return 0

    if args.command == "lessons":
        try:
            if args.resume:
                # Resume mode
                print(f"\nResuming pipeline run: {args.resume}")
                config = PipelineConfig.from_checkpoint(args.resume)
                # Apply runtime flags
                config.dry_run = args.dry_run
                config.skip_diagrams = args.skip_diagrams
                config.skip_seed_sow = args.skip_seed_sow
                config.force = args.force
                config.diagram_timeout = args.diagram_timeout
                config.use_iterative_sow = not args.legacy  # --legacy overrides default
                config.version = args.sow_version  # SOW version
            else:
                # New run
                if not args.subject or not args.level:
                    parser.error("--subject and --level required for new runs")

                # Validate and normalize subject/level
                subject, level = validate_subject_level(args.subject, args.level)

                print(f"\nStarting new pipeline run")
                print(f"Subject: {subject}")
                print(f"Level: {level}")

                # Determine SOW authoring mode (--legacy overrides default --iterative)
                use_iterative = not args.legacy

                config = PipelineConfig(
                    subject=subject,
                    level=level,
                    dry_run=args.dry_run,
                    skip_diagrams=args.skip_diagrams,
                    skip_seed_sow=args.skip_seed_sow,
                    force=args.force,
                    diagram_timeout=args.diagram_timeout,
                    use_iterative_sow=use_iterative,
                    version=args.sow_version
                )

            if config.dry_run:
                print("\n[DRY RUN MODE - No actual execution]")

            # Show SOW authoring mode and version
            sow_mode = "Iterative (lesson-by-lesson)" if config.use_iterative_sow else "Legacy (monolithic)"
            print(f"SOW Authoring Mode: {sow_mode}")
            print(f"SOW Version: {config.version}")

            # Run pipeline
            pipeline = LessonsPipeline(config)
            result = await pipeline.run()

            # Print summary
            print_summary(result)

            return 0 if result["success"] else 1

        except ValueError as e:
            print(f"\nError: {e}")
            return 1
        except FileNotFoundError as e:
            print(f"\nError: {e}")
            return 1
        except DiagramServiceError as e:
            print(f"\nError: {e}")
            return 1
        except KeyboardInterrupt:
            print("\n\nPipeline interrupted by user.")
            print("Resume with: python pipeline_runner.py lessons --resume <run_id>")
            return 1
        except Exception as e:
            print(f"\nUnexpected error: {e}")
            import traceback
            traceback.print_exc()
            return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
