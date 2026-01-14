# Checkpoint/Resume System

> How the pipeline persists state for resumable execution

---

## Overview

The checkpoint system enables:
- **Resumable pipelines**: Resume from any failed step
- **Progress tracking**: Know exactly where a pipeline stopped
- **Cost tracking**: Accumulate metrics across steps
- **Audit trail**: Full history of pipeline execution

## How It Works

After each step completes, the pipeline saves state to:
```
devops/checkpoints/{run_id}/checkpoint.json
```

When resuming, the orchestrator:
1. Loads the checkpoint file
2. Identifies `last_completed_step`
3. Continues from the next step

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHECKPOINT FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  NEW RUN:                                                                   │
│  ─────────                                                                  │
│  Step 1 ──▶ Save Checkpoint ──▶ Step 2 ──▶ Save Checkpoint ──▶ ...         │
│                                                                              │
│  RESUME (after Step 2 failure):                                             │
│  ──────────────────────────────                                             │
│  Load Checkpoint ──▶ last_completed = "sow" ──▶ Start at Step 3            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Checkpoint Schema

### Full Checkpoint: `checkpoint.json`

```json
{
  "run_id": "20260109_143022",
  "pipeline": "lessons",
  "subject": "mathematics",
  "level": "national_5",
  "course_id": "course_c84775",
  "status": "in_progress",
  "started_at": "2026-01-09T14:30:22Z",
  "updated_at": "2026-01-09T14:45:33Z",
  "completed_steps": [
    {
      "step": "seed",
      "status": "completed",
      "started_at": "2026-01-09T14:30:22Z",
      "completed_at": "2026-01-09T14:30:25Z",
      "duration_seconds": 3,
      "outputs": {
        "course_id": "course_c84775",
        "outcomes_created": 42
      }
    },
    {
      "step": "sow",
      "status": "completed",
      "started_at": "2026-01-09T14:30:25Z",
      "completed_at": "2026-01-09T14:35:12Z",
      "duration_seconds": 287,
      "outputs": {
        "sow_document_id": "68f1234...",
        "lesson_count": 18
      },
      "metrics": {
        "input_tokens": 15420,
        "output_tokens": 8234,
        "cost_usd": 1.85
      }
    }
  ],
  "last_completed_step": "sow",
  "next_step": "lessons",
  "total_cost_usd": 1.85,
  "total_tokens": 23654,
  "error": null
}
```

### Schema Fields

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | string | Unique identifier (timestamp format) |
| `pipeline` | string | Pipeline type (`lessons`, etc.) |
| `subject` | string | Normalized SQA subject |
| `level` | string | Normalized SQA level |
| `course_id` | string | Created course ID (after Step 1) |
| `status` | enum | `pending`, `in_progress`, `completed`, `failed` |
| `started_at` | ISO8601 | Pipeline start time |
| `updated_at` | ISO8601 | Last checkpoint time |
| `completed_steps` | array | Array of StepState objects |
| `last_completed_step` | string | Last successfully completed step |
| `next_step` | string | Next step to execute |
| `total_cost_usd` | float | Accumulated cost |
| `total_tokens` | int | Accumulated token count |
| `error` | string | Error message if failed |

### StepState Schema

```json
{
  "step": "lessons",
  "status": "completed",
  "started_at": "2026-01-09T14:35:12Z",
  "completed_at": "2026-01-09T15:47:33Z",
  "duration_seconds": 4341,
  "outputs": {
    "total_lessons": 18,
    "completed": 18,
    "failed": 0,
    "skipped": 0
  },
  "metrics": {
    "input_tokens": 245000,
    "output_tokens": 89000,
    "cost_usd": 18.50
  },
  "error": null
}
```

## Using Resume

### List Available Runs

```bash
./devops/pipeline.sh list

# Output:
# ═══════════════════════════════════════════════════════════════════════════
# PIPELINE RUNS
# ═══════════════════════════════════════════════════════════════════════════
#
# Run ID            Subject       Level        Status       Steps  Cost
# ─────────────────────────────────────────────────────────────────────────
# 20260109_143022   mathematics   national_5   failed       2/4    $1.85
# 20260109_103015   physics       higher       completed    4/4    $32.40
# 20260108_161230   chemistry     national_5   in_progress  3/4    $25.10
```

### Resume a Failed Run

```bash
./devops/pipeline.sh lessons --resume 20260109_143022

# Output:
# ═══════════════════════════════════════════════════════════════════════════
# RESUMING PIPELINE: lessons
# Run ID: 20260109_143022
# Subject: mathematics
# Level: national_5
# Last completed: sow
# Resuming from: lessons
# ═══════════════════════════════════════════════════════════════════════════
#
# Step 3/4: LESSONS
#   ⏳ In progress...
```

### Force Fresh Start

If you want to start over instead of resuming:

```bash
# This will ignore existing checkpoint and create a new run
./devops/pipeline.sh lessons --subject mathematics --level national_5 --force
```

## CheckpointManager API

### Class: CheckpointManager

```python
class CheckpointManager:
    def __init__(self, run_id: str, base_path: Path = None):
        self.run_id = run_id
        self.base_path = base_path or Path("devops/checkpoints")
        self.checkpoint_file = self.base_path / run_id / "checkpoint.json"

    def load_or_create(self, subject: str = None, level: str = None) -> PipelineState:
        """Load existing checkpoint or create new state."""
        if self.checkpoint_file.exists():
            return self._load()
        return self._create(subject, level)

    def save(self, state: PipelineState) -> None:
        """Save current state to checkpoint file (atomic write)."""
        state.updated_at = datetime.now(timezone.utc).isoformat()
        # Write to temp file first, then rename (atomic)
        temp_file = self.checkpoint_file.with_suffix('.tmp')
        with open(temp_file, "w") as f:
            json.dump(asdict(state), f, indent=2)
        temp_file.rename(self.checkpoint_file)

    @classmethod
    def list_runs(cls, base_path: Path = None) -> List[Dict[str, Any]]:
        """List all pipeline runs with their status."""
        # Returns list of run summaries
```

### Atomic Writes

Checkpoints use atomic writes to prevent corruption:

```python
def save(self, state: PipelineState) -> None:
    # Write to temp file
    temp_file = self.checkpoint_file.with_suffix('.tmp')
    with open(temp_file, "w") as f:
        json.dump(asdict(state), f, indent=2)

    # Atomic rename (prevents partial writes)
    temp_file.rename(self.checkpoint_file)
```

## File Structure

```
devops/checkpoints/
├── 20260109_143022/
│   └── checkpoint.json
├── 20260109_103015/
│   └── checkpoint.json
└── 20260108_161230/
    └── checkpoint.json
```

## Status Values

| Status | Meaning | Resume Action |
|--------|---------|---------------|
| `pending` | Not started | Start from beginning |
| `in_progress` | Currently running | Continue from next step |
| `completed` | All steps done | No resume needed |
| `failed` | Step failed | Resume from failed step |

## Failure Scenarios

### Step Execution Failure

```json
{
  "run_id": "20260109_143022",
  "status": "failed",
  "last_completed_step": "sow",
  "next_step": "lessons",
  "error": "LessonAuthorClaudeAgent execution failed: API rate limit exceeded"
}
```

To resume:
```bash
./devops/pipeline.sh lessons --resume 20260109_143022
```

### Interrupted Execution

If the pipeline is interrupted (Ctrl+C, system crash), the checkpoint reflects the last saved state. The current step's partial progress is lost, but completed steps are preserved.

### Corrupted Checkpoint

If checkpoint.json is corrupted or deleted, you can:
1. Delete the run folder and start fresh
2. Use `--force` flag to create a new run

## Cleanup

### Remove Old Runs

```bash
# Manual cleanup
rm -rf devops/checkpoints/20260108_*

# Or use the cleanup_old_runs method (keeps last N runs)
# Built into CheckpointManager
```

### Checkpoint Retention

The `cleanup_old_runs()` method removes checkpoints older than the specified retention:

```python
CheckpointManager.cleanup_old_runs(
    max_age_days=30,
    max_runs=50
)
```

## Best Practices

1. **Don't manually edit checkpoint files** - Use the CLI instead
2. **Keep checkpoints until pipeline completes** - Don't clean up in-progress runs
3. **Use `--resume` for failures** - Don't start fresh unless necessary
4. **Check logs alongside checkpoints** - Checkpoints show what, logs show why

## Related Documentation

- [Orchestrator Guide](ORCHESTRATOR_GUIDE.md) - How the orchestrator uses checkpoints
- [Observability](OBSERVABILITY.md) - Metrics tracked alongside checkpoints
