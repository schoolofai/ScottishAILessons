"""Observability Manager for Pipeline Monitoring.

Provides centralized observability for pipeline execution:
- Structured JSON reports
- File-based logging (console + file)
- Event streaming for dashboard consumption
- LangSmith integration (optional)

Usage:
    observability = ObservabilityManager(run_id="20260109_143022")
    observability.pipeline_started(state)
    observability.step_started(step)
    observability.step_completed(step, result)
    observability.pipeline_completed(state)
"""

import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict


@dataclass
class StepMetrics:
    """Metrics for a single step execution."""

    step: str
    started_at: str
    completed_at: Optional[str] = None
    duration_seconds: float = 0.0
    success: bool = False
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    items_processed: int = 0
    items_failed: int = 0
    items_skipped: int = 0
    error: Optional[str] = None


@dataclass
class PipelineMetrics:
    """Aggregated metrics for the entire pipeline."""

    run_id: str
    pipeline: str
    subject: str
    level: str
    started_at: str
    completed_at: Optional[str] = None
    duration_seconds: float = 0.0
    status: str = "in_progress"
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    steps: Dict[str, StepMetrics] = field(default_factory=dict)
    error: Optional[str] = None


class ObservabilityManager:
    """Centralized observability for pipeline execution.

    Features:
    - Dual logging: console (INFO) + file (DEBUG)
    - JSON reports: summary.json, metrics.json
    - Event streaming: events.jsonl for real-time dashboard
    - LangSmith integration: traces for AI agents (if configured)

    Directory structure:
        devops/reports/{run_id}/
        ├── summary.json         # Final execution summary
        ├── metrics.json         # Detailed metrics
        ├── events.jsonl         # Event stream for dashboard
        └── steps/               # Per-step reports
            ├── seed.json
            ├── sow.json
            └── lessons.json

        devops/logs/{run_id}/
        ├── pipeline.log         # Main pipeline log
        └── steps/               # Per-step logs
            ├── seed.log
            ├── sow.log
            └── lessons.log
    """

    def __init__(self, run_id: str, base_path: Optional[Path] = None):
        """Initialize observability manager.

        Args:
            run_id: Unique identifier for this pipeline run
            base_path: Base directory for reports/logs (default: devops/)
        """
        self.run_id = run_id
        self.base_path = base_path or Path(__file__).parent.parent

        # Setup directories
        self.reports_dir = self.base_path / "reports" / run_id
        self.logs_dir = self.base_path / "logs" / run_id
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        (self.reports_dir / "steps").mkdir(exist_ok=True)
        (self.logs_dir / "steps").mkdir(exist_ok=True)

        # Setup logging
        self.logger = self._setup_logger()

        # Initialize metrics
        self.metrics: Optional[PipelineMetrics] = None
        self._step_start_times: Dict[str, datetime] = {}

        # LangSmith client (optional)
        self.langsmith_client = self._init_langsmith()

    def pipeline_started(self, state) -> None:
        """Record pipeline start.

        Args:
            state: PipelineState from checkpoint manager
        """
        self.logger.info(
            f"Pipeline started: {state.pipeline} - {state.subject}/{state.level}"
        )

        self.metrics = PipelineMetrics(
            run_id=self.run_id,
            pipeline=state.pipeline,
            subject=state.subject,
            level=state.level,
            started_at=datetime.utcnow().isoformat() + "Z"
        )

        self._emit_event("pipeline_started", {
            "run_id": self.run_id,
            "pipeline": state.pipeline,
            "subject": state.subject,
            "level": state.level
        })

    def step_started(self, step_name: str) -> None:
        """Record step start.

        Args:
            step_name: Name of the step (seed, sow, lessons, diagrams)
        """
        now = datetime.utcnow()
        self._step_start_times[step_name] = now

        self.logger.info(f"Step started: {step_name}")

        if self.metrics:
            self.metrics.steps[step_name] = StepMetrics(
                step=step_name,
                started_at=now.isoformat() + "Z"
            )

        self._emit_event("step_started", {
            "step": step_name,
            "started_at": now.isoformat() + "Z"
        })

    def step_completed(
        self,
        step_name: str,
        result: Dict[str, Any],
        success: bool = True
    ) -> None:
        """Record step completion.

        Args:
            step_name: Name of the step
            result: Result dictionary from step execution
            success: Whether the step succeeded
        """
        now = datetime.utcnow()
        start_time = self._step_start_times.get(step_name, now)
        duration = (now - start_time).total_seconds()

        # Extract metrics from result
        metrics = result.get("metrics", {})
        outputs = result.get("outputs", {})

        step_metrics = StepMetrics(
            step=step_name,
            started_at=start_time.isoformat() + "Z",
            completed_at=now.isoformat() + "Z",
            duration_seconds=duration,
            success=success,
            input_tokens=metrics.get("input_tokens", 0),
            output_tokens=metrics.get("output_tokens", 0),
            cost_usd=metrics.get("cost_usd", 0),
            items_processed=outputs.get("completed", outputs.get("items_processed", 0)),
            items_failed=outputs.get("failed", 0),
            items_skipped=outputs.get("skipped", 0),
            error=result.get("error")
        )

        if self.metrics:
            self.metrics.steps[step_name] = step_metrics
            self.metrics.total_input_tokens += step_metrics.input_tokens
            self.metrics.total_output_tokens += step_metrics.output_tokens
            self.metrics.total_cost_usd += step_metrics.cost_usd

        status = "SUCCESS" if success else "FAILED"
        self.logger.info(
            f"Step completed: {step_name} - {status} "
            f"(duration: {duration:.1f}s, cost: ${step_metrics.cost_usd:.2f})"
        )

        if not success and result.get("error"):
            self.logger.error(f"Step error: {result.get('error')}")

        # Save step report
        self._save_step_report(step_name, {
            "metrics": asdict(step_metrics),
            "outputs": outputs,
            "result": result
        })

        self._emit_event("step_completed", {
            "step": step_name,
            "success": success,
            "duration_seconds": duration,
            "cost_usd": step_metrics.cost_usd,
            "error": result.get("error")
        })

    def step_skipped(self, step_name: str, reason: str) -> None:
        """Record step skip.

        Args:
            step_name: Name of the step
            reason: Reason for skipping
        """
        self.logger.info(f"Step skipped: {step_name} - {reason}")

        self._emit_event("step_skipped", {
            "step": step_name,
            "reason": reason
        })

    def pipeline_completed(self, state, success: bool = True) -> None:
        """Record pipeline completion.

        Args:
            state: Final PipelineState
            success: Whether the pipeline succeeded
        """
        now = datetime.utcnow()

        if self.metrics:
            started = datetime.fromisoformat(self.metrics.started_at.rstrip("Z"))
            self.metrics.completed_at = now.isoformat() + "Z"
            self.metrics.duration_seconds = (now - started).total_seconds()
            self.metrics.status = "completed" if success else "failed"

        status = "SUCCESS" if success else "FAILED"
        self.logger.info(
            f"Pipeline completed: {status} "
            f"(duration: {self.metrics.duration_seconds:.1f}s, "
            f"cost: ${self.metrics.total_cost_usd:.2f})"
        )

        self._save_final_reports(state, success)

        self._emit_event("pipeline_completed", {
            "success": success,
            "duration_seconds": self.metrics.duration_seconds if self.metrics else 0,
            "total_cost_usd": self.metrics.total_cost_usd if self.metrics else 0
        })

    def pipeline_failed(self, state, step_name: Optional[str], error: str) -> None:
        """Record pipeline failure.

        Args:
            state: Current PipelineState
            step_name: Step where failure occurred (if any)
            error: Error message
        """
        if self.metrics:
            self.metrics.status = "failed"
            self.metrics.error = error

        self.logger.error(f"Pipeline failed at step {step_name}: {error}")

        self._save_final_reports(state, success=False, error=error)

        self._emit_event("pipeline_failed", {
            "step": step_name,
            "error": error
        })

    def log_info(self, message: str, **kwargs) -> None:
        """Log info message with optional structured data."""
        if kwargs:
            self.logger.info(f"{message} | {json.dumps(kwargs)}")
        else:
            self.logger.info(message)

    def log_error(self, message: str, exc_info: bool = False, **kwargs) -> None:
        """Log error message with optional exception info."""
        if kwargs:
            self.logger.error(f"{message} | {json.dumps(kwargs)}", exc_info=exc_info)
        else:
            self.logger.error(message, exc_info=exc_info)

    def log_debug(self, message: str, **kwargs) -> None:
        """Log debug message with optional structured data."""
        if kwargs:
            self.logger.debug(f"{message} | {json.dumps(kwargs)}")
        else:
            self.logger.debug(message)

    def _setup_logger(self) -> logging.Logger:
        """Setup file + console logging."""
        logger = logging.getLogger(f"pipeline.{self.run_id}")
        logger.setLevel(logging.DEBUG)

        # Clear existing handlers
        logger.handlers.clear()

        # File handler (DEBUG level)
        log_file = self.logs_dir / "pipeline.log"
        fh = logging.FileHandler(log_file)
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter(
            "%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        logger.addHandler(fh)

        # Console handler (INFO level)
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)
        ch.setFormatter(logging.Formatter(
            "%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%H:%M:%S"
        ))
        logger.addHandler(ch)

        # Prevent propagation to root logger
        logger.propagate = False

        return logger

    def _init_langsmith(self):
        """Initialize LangSmith client if configured."""
        try:
            import os
            if os.getenv("LANGSMITH_API_KEY"):
                from langsmith import Client
                self.logger.debug("LangSmith integration enabled")
                return Client()
        except ImportError:
            pass
        return None

    def _emit_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Emit event to events file for dashboard consumption.

        Events are written as JSONL (one JSON object per line).
        """
        events_file = self.reports_dir / "events.jsonl"

        event = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event": event_type,
            "run_id": self.run_id,
            **data
        }

        with open(events_file, "a") as f:
            f.write(json.dumps(event) + "\n")

    def _save_step_report(self, step_name: str, data: Dict[str, Any]) -> None:
        """Save detailed report for a step."""
        report_file = self.reports_dir / "steps" / f"{step_name}.json"
        with open(report_file, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def _save_final_reports(
        self,
        state,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Save final summary and metrics reports."""
        # Summary report
        summary = {
            "run_id": self.run_id,
            "pipeline": state.pipeline,
            "subject": state.subject,
            "level": state.level,
            "course_id": state.course_id,
            "success": success,
            "error": error,
            "started_at": self.metrics.started_at if self.metrics else None,
            "completed_at": self.metrics.completed_at if self.metrics else None,
            "duration_seconds": self.metrics.duration_seconds if self.metrics else 0,
            "total_cost_usd": self.metrics.total_cost_usd if self.metrics else 0,
            "total_tokens": (
                self.metrics.total_input_tokens + self.metrics.total_output_tokens
                if self.metrics else 0
            ),
            "steps_completed": len(self.metrics.steps) if self.metrics else 0
        }

        with open(self.reports_dir / "summary.json", "w") as f:
            json.dump(summary, f, indent=2)

        # Metrics report
        if self.metrics:
            metrics_dict = asdict(self.metrics)
            # Convert StepMetrics to dicts
            metrics_dict["steps"] = {
                k: asdict(v) for k, v in self.metrics.steps.items()
            }
            with open(self.reports_dir / "metrics.json", "w") as f:
                json.dump(metrics_dict, f, indent=2)

    def get_step_logger(self, step_name: str) -> logging.Logger:
        """Get a logger for a specific step.

        Creates a separate log file for the step while also
        logging to the main pipeline log.
        """
        step_logger = logging.getLogger(f"pipeline.{self.run_id}.{step_name}")
        step_logger.setLevel(logging.DEBUG)
        step_logger.handlers.clear()

        # Step-specific file handler
        step_log_file = self.logs_dir / "steps" / f"{step_name}.log"
        fh = logging.FileHandler(step_log_file)
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter(
            "%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        step_logger.addHandler(fh)

        # Also log to main pipeline logger
        step_logger.parent = self.logger

        return step_logger
