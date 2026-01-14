# Pipeline Orchestrator Guide

> Deep dive into how the content authoring pipeline automation works

---

## Architecture Overview

The orchestrator (`pipeline_runner.py`) coordinates pipeline execution using a modular architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPELINE ORCHESTRATOR                                │
│                        (Python: pipeline_runner.py)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLI Arguments ──▶ PipelineConfig ──▶ LessonsPipeline ──▶ Results           │
│                                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   STEP 1     │──▶│   STEP 2     │──▶│   STEP 3     │──▶│   STEP 4     │ │
│  │    SEED      │   │  SOW AUTHOR  │   │LESSON AUTHOR │   │DIAGRAM AUTHOR│ │
│  │ (TypeScript) │   │   (Python)   │   │   (Python)   │   │   (Python)   │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘ │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     CHECKPOINT MANAGER                               │   │
│  │               (JSON files in devops/checkpoints/)                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     OBSERVABILITY LAYER                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │  LangSmith  │  │ JSON Reports│  │ Web Dashboard│                  │   │
│  │  │   (Traces)  │  │   (Files)   │  │  (Next.js)   │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. PipelineConfig

Configuration dataclass that holds all pipeline parameters:

```python
@dataclass
class PipelineConfig:
    subject: str              # SQA subject (normalized)
    level: str                # SQA level (normalized)
    run_id: str               # Unique run identifier
    dry_run: bool             # Preview mode
    skip_diagrams: bool       # Skip step 4
    force: bool               # Force regenerate
    diagram_timeout: int      # Diagram service timeout
```

### 2. LessonsPipeline

Main orchestrator class that executes the pipeline:

```python
class LessonsPipeline:
    STEPS = [SEED, SOW, LESSONS, DIAGRAMS]

    async def run(self) -> Dict[str, Any]:
        # 1. Load or create checkpoint state
        state = self.checkpoint_mgr.load_or_create()

        # 2. Find starting step (resume support)
        start_index = self._get_start_index(state)

        # 3. Execute each step
        for step in self.STEPS[start_index:]:
            result = await self._execute_step(step, state)
            self.checkpoint_mgr.save(state)  # Checkpoint after each step

            if not result.success:
                return self._build_result(state, success=False)

        return self._build_result(state, success=True)
```

### 3. StepRunner

Executes individual pipeline steps using the appropriate invocation method:

| Step | Method | Why |
|------|--------|-----|
| SEED | TypeScript subprocess | Uses frontend scripts (tsx) |
| SOW | Direct Python import | Access to CostTracker metrics |
| LESSONS | Direct Python import | Access to CostTracker metrics |
| DIAGRAMS | Direct Python import | Access to CostTracker metrics |

## Invocation Patterns

### TypeScript Subprocess (Step 1: Seed)

```python
async def run_seed(self, subject: str, level: str) -> StepResult:
    cmd = [
        "tsx",
        "scripts/seedSingleCourse.ts",
        "--subject", subject,
        "--level", level
    ]

    # Execute subprocess
    result = await self._run_subprocess(
        cmd,
        cwd=self.project_root / "assistant-ui-frontend",
        step_name="seed"
    )

    # Parse output to extract course_id
    course_id = self._extract_course_id(result.outputs["stdout"])
    return result
```

### Direct Python Import (Steps 2-4)

```python
async def run_sow(self, course_id: str) -> StepResult:
    # Direct import from claud_author_agent
    from src.sow_author_claude_client import SOWAuthorClaudeAgent

    agent = SOWAuthorClaudeAgent(
        mcp_config_path=self.mcp_config_path,
        persist_workspace=True
    )

    # Execute agent - returns structured result dict
    result = await agent.execute(
        courseId=course_id,
        force=self.config.force
    )

    # Direct access to CostTracker metrics
    return StepResult(
        success=result.get("success"),
        outputs={...},
        metrics=self._extract_agent_metrics(result)  # Token counts, costs
    )
```

**Benefits of Direct Import:**
- Direct access to CostTracker metrics (token counts, costs)
- Structured result dict (no stdout parsing)
- Better exception handling with stack traces
- Access to execution_id and workspace_path for debugging

## Step Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STEP EXECUTION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PRE-CHECK                                                               │
│     └── Diagram service health check (Step 4 only)                          │
│                                                                              │
│  2. EXECUTE                                                                 │
│     └── StepRunner.run_{step}() - Invokes appropriate method                │
│                                                                              │
│  3. UPDATE STATE                                                            │
│     └── Add StepState to completed_steps                                    │
│     └── Update last_completed_step, next_step                               │
│     └── Accumulate metrics (tokens, cost)                                   │
│                                                                              │
│  4. CHECKPOINT                                                              │
│     └── Save state to JSON file                                             │
│                                                                              │
│  5. OBSERVE                                                                 │
│     └── Emit events to observability layer                                  │
│                                                                              │
│  6. CONTINUE OR EXIT                                                        │
│     └── Success: Continue to next step                                      │
│     └── Failure: Exit with error                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## CLI Entry Points

### Main Entry Point: `pipeline.sh`

```bash
#!/bin/bash
# Activates Python environment and delegates to pipeline_runner.py

# Load environment variables
for env_file in claud_author_agent/.env ...; do
    if [ -f "$env_file" ]; then
        source "$env_file"
    fi
done

# Activate virtual environment
source claud_author_agent/.venv/bin/activate

# Run Python orchestrator
python devops/pipeline_runner.py "$@"
```

### Python CLI: `pipeline_runner.py`

```bash
# Lessons pipeline
python devops/pipeline_runner.py lessons --subject math --level n5

# List runs
python devops/pipeline_runner.py list

# Help
python devops/pipeline_runner.py --help
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for agents |
| `APPWRITE_ENDPOINT` | Yes | Appwrite server URL |
| `APPWRITE_PROJECT_ID` | Yes | Appwrite project ID |
| `APPWRITE_API_KEY` | Yes | Appwrite admin API key |
| `LANGSMITH_API_KEY` | No | LangSmith for tracing |
| `LANGSMITH_TRACING` | No | Enable tracing (`true`) |

### Pipeline Configuration

Located at `devops/config/pipeline_config.yaml`:

```yaml
pipelines:
  lessons:
    steps:
      - name: seed
        type: subprocess
        timeout: 60
      - name: sow
        type: python_import
        timeout: 600
      - name: lessons
        type: python_import
        timeout: 7200  # 2 hours
      - name: diagrams
        type: python_import
        timeout: 3600
        optional: true

defaults:
  diagram_timeout: 60
  max_retries: 3
```

## Error Handling

### Step Failure

When a step fails:
1. Error is logged to step log file
2. State is checkpointed with error info
3. Pipeline exits with non-zero code
4. User can resume with `--resume <run_id>`

### Diagram Service Unavailable

```python
async def _ensure_diagram_service(self):
    is_healthy = await self.diagram_service.wait_for_health(
        timeout_seconds=self.config.diagram_timeout
    )
    if not is_healthy:
        raise RuntimeError(
            "Diagram screenshot service not available. "
            "Start it with: cd diagramScreenshot && docker-compose up -d"
        )
```

### Retry Logic

The agent classes themselves handle retries internally (max 3 attempts with critic validation). The orchestrator does not retry failed steps - use `--resume` instead.

## Extending the Orchestrator

### Adding a New Step

1. Define step in `PipelineStep` enum:
```python
class PipelineStep(Enum):
    SEED = "seed"
    SOW = "sow"
    LESSONS = "lessons"
    DIAGRAMS = "diagrams"
    NEW_STEP = "new_step"  # Add here
```

2. Add execution method in `StepRunner`:
```python
async def run_new_step(self, course_id: str) -> StepResult:
    # Implementation
    pass
```

3. Add to step execution switch:
```python
elif step == PipelineStep.NEW_STEP:
    result = await self.step_runner.run_new_step(
        course_id=state.course_id
    )
```

### Adding a New Pipeline

Create a new pipeline class following the `LessonsPipeline` pattern:

```python
class MockExamPipeline:
    STEPS = [PipelineStep.MOCK_EXAM]

    async def run(self) -> Dict[str, Any]:
        # Similar structure to LessonsPipeline
        pass
```

Register in CLI:
```python
mock_exam_parser = subparsers.add_parser("mock-exam")
mock_exam_parser.add_argument("--course-id", required=True)
```

## Performance Considerations

### Batch Processing

Steps 3 (Lessons) and 4 (Diagrams) process multiple items. The orchestrator iterates through each item sequentially:

```python
for entry in sow_entries:
    result = await agent.execute(courseId=course_id, order=entry["order"])
    total_metrics["cost_usd"] += result.metrics.get("cost_usd", 0)
```

**Future Enhancement:** Add parallel processing with `asyncio.gather()` for faster execution.

### Memory Management

Each agent instance is created fresh for each item to avoid memory leaks:

```python
for entry in sow_entries:
    agent = LessonAuthorClaudeAgent(...)  # Fresh instance
    result = await agent.execute(...)
    # Agent is garbage collected after iteration
```

## Debugging

### Enable Verbose Logging

```bash
export PIPELINE_LOG_LEVEL=DEBUG
./devops/pipeline.sh lessons --subject math --level n5
```

### Inspect Checkpoint State

```bash
cat devops/checkpoints/{run_id}/checkpoint.json | jq .
```

### View Step Logs

```bash
tail -f devops/logs/{run_id}/steps/lessons.log
```

### Access Agent Workspaces

Agent workspaces are preserved when `persist_workspace=True`:

```
claud_author_agent/workspace/{execution_id}/
├── authored_sow.json
├── sow_critic_result.json
└── ...
```

## Related Documentation

- [Checkpoint/Resume](CHECKPOINT_RESUME.md) - State persistence details
- [Observability](OBSERVABILITY.md) - Metrics and monitoring
- [Pipeline Reference](PIPELINE_REFERENCE.md) - Step-by-step details
