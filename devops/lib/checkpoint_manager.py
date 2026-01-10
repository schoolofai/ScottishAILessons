"""Checkpoint Manager for Pipeline State Persistence.

Manages pipeline state persistence for checkpoint/resume capability.
State is stored as JSON files in devops/checkpoints/{run_id}/checkpoint.json.

Usage:
    checkpoint_mgr = CheckpointManager(run_id="20260109_143022")
    state = checkpoint_mgr.load_or_create(subject="mathematics", level="national_5")

    # After step completion
    state.last_completed_step = "sow"
    checkpoint_mgr.save(state)

    # Resume from checkpoint
    state = checkpoint_mgr.load_or_create()  # Loads existing state
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class StepState:
    """State for a single pipeline step."""

    step: str
    status: str  # pending, in_progress, completed, failed, skipped
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    outputs: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_id: Optional[str] = None
    workspace_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {k: v for k, v in asdict(self).items() if v is not None}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StepState":
        """Create from dictionary."""
        return cls(**data)


@dataclass
class PipelineState:
    """Complete pipeline state for persistence."""

    run_id: str
    pipeline: str
    subject: str
    level: str
    course_id: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, failed
    started_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_steps: List[StepState] = field(default_factory=list)
    last_completed_step: Optional[str] = None
    next_step: Optional[str] = None
    total_cost_usd: float = 0.0
    total_tokens: int = 0
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data["completed_steps"] = [s.to_dict() for s in self.completed_steps]
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PipelineState":
        """Create from dictionary."""
        completed_steps = [
            StepState.from_dict(s) for s in (data.pop("completed_steps", []) or [])
        ]
        return cls(completed_steps=completed_steps, **data)

    def get_step_state(self, step_name: str) -> Optional[StepState]:
        """Get state for a specific step."""
        for step in self.completed_steps:
            if step.step == step_name:
                return step
        return None

    def add_step(self, step: StepState) -> None:
        """Add or update step state."""
        # Remove existing step with same name
        self.completed_steps = [s for s in self.completed_steps if s.step != step.step]
        self.completed_steps.append(step)

        # Update aggregates
        if step.status == "completed":
            self.last_completed_step = step.step
        if step.metrics:
            self.total_cost_usd += step.metrics.get("cost_usd", 0)
            self.total_tokens += step.metrics.get("input_tokens", 0)
            self.total_tokens += step.metrics.get("output_tokens", 0)


class CheckpointManager:
    """Manages pipeline state persistence for checkpoint/resume.

    Features:
    - JSON-based state persistence
    - Atomic writes with temp file + rename
    - Resume from any completed step
    - List all runs with status

    Directory structure:
        devops/checkpoints/
        ├── 20260109_143022/
        │   ├── checkpoint.json      # Main state file
        │   └── step_results/        # Optional: per-step detailed results
        │       ├── seed.json
        │       ├── sow.json
        │       └── lessons.json
        └── 20260109_150000/
            └── checkpoint.json
    """

    def __init__(self, run_id: str, base_path: Optional[Path] = None):
        """Initialize checkpoint manager.

        Args:
            run_id: Unique identifier for this pipeline run
            base_path: Base directory for checkpoints (default: devops/checkpoints)
        """
        self.run_id = run_id
        self.base_path = base_path or Path(__file__).parent.parent / "checkpoints"
        self.checkpoint_dir = self.base_path / run_id
        self.checkpoint_file = self.checkpoint_dir / "checkpoint.json"
        self.step_results_dir = self.checkpoint_dir / "step_results"

    def exists(self) -> bool:
        """Check if checkpoint exists for this run."""
        return self.checkpoint_file.exists()

    def load_or_create(
        self,
        subject: Optional[str] = None,
        level: Optional[str] = None
    ) -> PipelineState:
        """Load existing checkpoint or create new state.

        Args:
            subject: SQA subject (required for new runs)
            level: SQA level (required for new runs)

        Returns:
            PipelineState: Loaded or newly created state

        Raises:
            ValueError: If subject/level not provided for new run
            FileNotFoundError: If checkpoint file is corrupted
        """
        if self.exists():
            logger.info(f"Loading existing checkpoint: {self.run_id}")
            return self._load()

        if not subject or not level:
            raise ValueError(
                f"subject and level required for new pipeline run. "
                f"To resume, use --resume {self.run_id}"
            )

        logger.info(f"Creating new checkpoint: {self.run_id}")
        return self._create(subject, level)

    def save(self, state: PipelineState) -> None:
        """Save current state to checkpoint file.

        Uses atomic write (temp file + rename) to prevent corruption.

        Args:
            state: Pipeline state to save
        """
        state.updated_at = datetime.utcnow().isoformat() + "Z"

        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.step_results_dir.mkdir(parents=True, exist_ok=True)

        # Atomic write: write to temp file then rename
        temp_file = self.checkpoint_file.with_suffix(".tmp")

        try:
            with open(temp_file, "w") as f:
                json.dump(state.to_dict(), f, indent=2, default=str)

            temp_file.rename(self.checkpoint_file)
            logger.debug(f"Checkpoint saved: {self.checkpoint_file}")

        except Exception as e:
            # Clean up temp file on error
            if temp_file.exists():
                temp_file.unlink()
            raise RuntimeError(f"Failed to save checkpoint: {e}") from e

    def save_step_result(self, step_name: str, result: Dict[str, Any]) -> None:
        """Save detailed result for a specific step.

        Args:
            step_name: Name of the step (seed, sow, lessons, diagrams)
            result: Full result dictionary from step execution
        """
        self.step_results_dir.mkdir(parents=True, exist_ok=True)

        result_file = self.step_results_dir / f"{step_name}.json"
        with open(result_file, "w") as f:
            json.dump(result, f, indent=2, default=str)

    def load_step_result(self, step_name: str) -> Optional[Dict[str, Any]]:
        """Load detailed result for a specific step.

        Args:
            step_name: Name of the step

        Returns:
            Result dictionary or None if not found
        """
        result_file = self.step_results_dir / f"{step_name}.json"
        if not result_file.exists():
            return None

        with open(result_file) as f:
            return json.load(f)

    def _load(self) -> PipelineState:
        """Load state from checkpoint file."""
        try:
            with open(self.checkpoint_file) as f:
                data = json.load(f)
            return PipelineState.from_dict(data)
        except json.JSONDecodeError as e:
            raise FileNotFoundError(
                f"Checkpoint file corrupted: {self.checkpoint_file}. Error: {e}"
            ) from e

    def _create(self, subject: str, level: str) -> PipelineState:
        """Create new pipeline state."""
        return PipelineState(
            run_id=self.run_id,
            pipeline="lessons",
            subject=subject,
            level=level,
            status="pending",
            started_at=datetime.utcnow().isoformat() + "Z",
            completed_steps=[]
        )

    @classmethod
    def list_runs(cls, base_path: Optional[Path] = None) -> List[Dict[str, Any]]:
        """List all pipeline runs with their status.

        Args:
            base_path: Base directory for checkpoints

        Returns:
            List of run summaries sorted by start time (newest first)
        """
        base = base_path or Path(__file__).parent.parent / "checkpoints"
        runs = []

        if not base.exists():
            return runs

        for run_dir in base.iterdir():
            if not run_dir.is_dir():
                continue

            checkpoint = run_dir / "checkpoint.json"
            if not checkpoint.exists():
                continue

            try:
                with open(checkpoint) as f:
                    data = json.load(f)

                runs.append({
                    "run_id": data["run_id"],
                    "pipeline": data.get("pipeline", "lessons"),
                    "subject": data["subject"],
                    "level": data["level"],
                    "course_id": data.get("course_id"),
                    "status": data["status"],
                    "started_at": data["started_at"],
                    "updated_at": data.get("updated_at"),
                    "last_completed_step": data.get("last_completed_step"),
                    "next_step": data.get("next_step"),
                    "total_cost_usd": data.get("total_cost_usd", 0),
                    "total_tokens": data.get("total_tokens", 0),
                    "error": data.get("error"),
                    "steps_completed": len(data.get("completed_steps", []))
                })
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Skipping corrupted checkpoint: {checkpoint}. Error: {e}")
                continue

        # Sort by started_at descending
        runs.sort(
            key=lambda r: r.get("started_at", ""),
            reverse=True
        )

        return runs

    @classmethod
    def get_resumable_runs(cls, base_path: Optional[Path] = None) -> List[Dict[str, Any]]:
        """Get runs that can be resumed (failed or in_progress).

        Returns:
            List of resumable run summaries
        """
        runs = cls.list_runs(base_path)
        return [r for r in runs if r["status"] in ("failed", "in_progress")]

    @classmethod
    def cleanup_old_runs(
        cls,
        max_age_days: int = 30,
        keep_successful: bool = True,
        base_path: Optional[Path] = None
    ) -> int:
        """Clean up old checkpoint directories.

        Args:
            max_age_days: Maximum age in days for runs to keep
            keep_successful: Keep successful runs regardless of age
            base_path: Base directory for checkpoints

        Returns:
            Number of runs deleted
        """
        import shutil

        base = base_path or Path(__file__).parent.parent / "checkpoints"
        runs = cls.list_runs(base)
        deleted = 0
        cutoff = datetime.utcnow().timestamp() - (max_age_days * 24 * 60 * 60)

        for run in runs:
            try:
                started = datetime.fromisoformat(run["started_at"].rstrip("Z"))
                if started.timestamp() > cutoff:
                    continue

                if keep_successful and run["status"] == "completed":
                    continue

                run_dir = base / run["run_id"]
                if run_dir.exists():
                    shutil.rmtree(run_dir)
                    deleted += 1
                    logger.info(f"Deleted old run: {run['run_id']}")

            except (ValueError, OSError) as e:
                logger.warning(f"Failed to cleanup run {run['run_id']}: {e}")

        return deleted
