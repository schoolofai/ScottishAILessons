# Observability Guide

> Metrics, logging, and monitoring for content authoring pipelines

---

## Three Observability Channels

The pipeline provides observability through three complementary channels:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   LangSmith     │  │  JSON Reports   │  │  Web Dashboard  │             │
│  │   (External)    │  │    (Files)      │  │   (Next.js)     │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ • Traces        │  │ • summary.json  │  │ • Run list      │             │
│  │ • Token counts  │  │ • metrics.json  │  │ • Progress bars │             │
│  │ • Latency       │  │ • events.jsonl  │  │ • Log viewer    │             │
│  │ • Errors        │  │                 │  │ • Resume action │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Best for:           Best for:           Best for:                         │
│  Deep debugging      Automation/CI       Quick status check                │
│  LLM analysis        Audit trail         Manual intervention               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. LangSmith Traces

### Setup

Enable LangSmith tracing by setting environment variables:

```bash
export LANGSMITH_API_KEY=your-api-key
export LANGSMITH_TRACING=true
export LANGSMITH_PROJECT=scottish-ai-lessons-pipeline
```

### What Gets Traced

- **Agent executions**: SOW, Lesson, Diagram author agents
- **LLM calls**: Input/output tokens, latency, model used
- **Tool calls**: MCP tool invocations (Appwrite, WebSearch)
- **Subagent calls**: Nested agent executions (critic, researcher)

### Viewing Traces

1. Navigate to [smith.langchain.com](https://smith.langchain.com/)
2. Select the `scottish-ai-lessons-pipeline` project
3. Filter by run_id or timestamp

### Trace Structure

```
📦 Pipeline Run (20260109_143022)
├── 📄 SOW Author Execution
│   ├── 🤖 Claude API Call (creative)
│   ├── 🔧 Tool: appwrite_list_documents
│   ├── 🤖 Claude API Call (critic)
│   └── 🔧 Tool: appwrite_create_document
├── 📄 Lesson Author Execution (order=1)
│   ├── 🤖 Claude API Call (research)
│   ├── 🤖 Claude API Call (author)
│   └── 🤖 Claude API Call (critic)
└── ...
```

## 2. JSON Reports

### Location

Reports are saved to `devops/reports/{run_id}/`:

```
devops/reports/
└── 20260109_143022/
    ├── summary.json      # Pipeline summary
    ├── metrics.json      # Detailed metrics
    └── events.jsonl      # Event stream
```

### summary.json

High-level pipeline results:

```json
{
  "run_id": "20260109_143022",
  "pipeline": "lessons",
  "subject": "mathematics",
  "level": "national_5",
  "course_id": "course_c84775",
  "success": true,
  "error": null,
  "started_at": "2026-01-09T14:30:22Z",
  "completed_at": "2026-01-09T16:32:45Z",
  "duration_seconds": 7343,
  "steps_completed": 4,
  "steps_total": 4,
  "total_cost_usd": 28.60,
  "total_tokens": 456789
}
```

### metrics.json

Detailed metrics per step:

```json
{
  "run_id": "20260109_143022",
  "steps": {
    "seed": {
      "started_at": "2026-01-09T14:30:22Z",
      "completed_at": "2026-01-09T14:30:25Z",
      "duration_seconds": 3,
      "success": true,
      "metrics": {}
    },
    "sow": {
      "started_at": "2026-01-09T14:30:25Z",
      "completed_at": "2026-01-09T14:35:12Z",
      "duration_seconds": 287,
      "success": true,
      "metrics": {
        "input_tokens": 15420,
        "output_tokens": 8234,
        "cost_usd": 1.85,
        "subagent_count": 2
      }
    },
    "lessons": {
      "started_at": "2026-01-09T14:35:12Z",
      "completed_at": "2026-01-09T15:47:33Z",
      "duration_seconds": 4341,
      "success": true,
      "metrics": {
        "input_tokens": 245000,
        "output_tokens": 89000,
        "cost_usd": 18.50,
        "items_processed": 18,
        "items_failed": 0
      }
    },
    "diagrams": {
      "started_at": "2026-01-09T15:47:33Z",
      "completed_at": "2026-01-09T16:32:45Z",
      "duration_seconds": 2712,
      "success": true,
      "metrics": {
        "input_tokens": 78000,
        "output_tokens": 34000,
        "cost_usd": 8.25,
        "diagrams_created": 42
      }
    }
  },
  "total_cost_usd": 28.60,
  "total_tokens": 456789,
  "total_duration_seconds": 7343
}
```

### events.jsonl

Timestamped event stream for debugging:

```jsonl
{"timestamp": "2026-01-09T14:30:22Z", "event": "pipeline_started", "run_id": "20260109_143022", "subject": "mathematics", "level": "national_5"}
{"timestamp": "2026-01-09T14:30:22Z", "event": "step_started", "step": "seed"}
{"timestamp": "2026-01-09T14:30:25Z", "event": "step_completed", "step": "seed", "success": true, "outputs": {"course_id": "course_c84775"}}
{"timestamp": "2026-01-09T14:30:25Z", "event": "step_started", "step": "sow"}
{"timestamp": "2026-01-09T14:35:12Z", "event": "step_completed", "step": "sow", "success": true, "metrics": {"cost_usd": 1.85}}
...
```

## 3. Web Dashboard

### Accessing the Dashboard

URL: `http://localhost:3000/devops` (requires frontend running)

**Note**: The dashboard is admin-only. You must be logged in with admin privileges.

### Features

| Feature | Description |
|---------|-------------|
| Run List | All pipeline runs with status, progress, cost |
| Run Detail | Step-by-step breakdown with timing |
| Log Viewer | Real-time log viewing |
| Resume Action | One-click resume for failed runs |

### API Endpoints

The dashboard uses these API endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/devops/runs` | List all runs |
| `GET /api/devops/runs/{runId}` | Get run details |
| `GET /api/devops/runs/{runId}/logs` | Get pipeline logs |
| `GET /api/devops/runs/{runId}/reports/{type}` | Get report file |

## Logging

### Log Files

Pipeline logs are saved to `devops/logs/{run_id}/`:

```
devops/logs/
└── 20260109_143022/
    ├── pipeline.log     # Main orchestrator log
    └── steps/
        ├── seed.log
        ├── sow.log
        ├── lessons.log
        └── diagrams.log
```

### Log Levels

| Level | Description | Where |
|-------|-------------|-------|
| DEBUG | Verbose debugging | File only |
| INFO | Normal operations | Console + File |
| WARNING | Recoverable issues | Console + File |
| ERROR | Step failures | Console + File |

### Log Format

```
2026-01-09 14:30:22,123 - INFO - Pipeline started: mathematics / national_5
2026-01-09 14:30:22,125 - INFO - Step started: seed
2026-01-09 14:30:25,456 - INFO - Step completed: seed - SUCCESS
2026-01-09 14:30:25,458 - DEBUG - course_id extracted: course_c84775
2026-01-09 14:30:25,460 - INFO - Step started: sow
...
```

### Real-time Log Viewing

```bash
# Watch main log
tail -f devops/logs/20260109_143022/pipeline.log

# Watch step-specific log
tail -f devops/logs/20260109_143022/steps/lessons.log
```

## Metrics Collection

### CostTracker Integration

Agent steps have direct access to CostTracker metrics:

```python
def _extract_agent_metrics(self, result: Dict[str, Any]) -> Dict[str, Any]:
    metrics = result.get("metrics", {})
    return {
        "input_tokens": metrics.get("total_input_tokens", 0),
        "output_tokens": metrics.get("total_output_tokens", 0),
        "cost_usd": metrics.get("total_cost", 0),
        "execution_time_seconds": metrics.get("execution_time_seconds", 0),
        "subagent_count": len(metrics.get("subagent_metrics", {}))
    }
```

### Cost Calculation

Costs are calculated based on Claude pricing:
- Input tokens: $3.00 per million tokens
- Output tokens: $15.00 per million tokens

## Alerting

### CI/CD Notifications

The GitHub Actions workflow posts status to the job summary:

```yaml
- name: Post Summary
  if: always()
  run: |
    echo "## Pipeline Summary" >> $GITHUB_STEP_SUMMARY
    echo "- **Status**: ${{ job.status }}" >> $GITHUB_STEP_SUMMARY
    # ... more details
```

### Custom Alerts

Add webhook notifications in `observability.py`:

```python
def pipeline_failed(self, state, step, error: str) -> None:
    # Log the failure
    self.logger.error(f"Pipeline failed at step {step}: {error}")

    # Send webhook (if configured)
    if os.environ.get("SLACK_WEBHOOK_URL"):
        self._send_slack_alert(state, step, error)
```

## Debugging Workflows

### Investigate a Failed Run

1. **Check summary**:
   ```bash
   cat devops/reports/{run_id}/summary.json | jq .
   ```

2. **View logs**:
   ```bash
   cat devops/logs/{run_id}/pipeline.log
   ```

3. **Check step-specific logs**:
   ```bash
   cat devops/logs/{run_id}/steps/lessons.log
   ```

4. **Review agent workspace** (if available):
   ```bash
   ls claud_author_agent/workspace/
   ```

5. **Check LangSmith traces** for detailed LLM call analysis

### Correlating Events

Use timestamps to correlate across sources:

```bash
# Find events around a specific time
grep "2026-01-09T14:35" devops/reports/{run_id}/events.jsonl
```

## Related Documentation

- [Orchestrator Guide](ORCHESTRATOR_GUIDE.md) - How metrics are collected
- [Dashboard Guide](DASHBOARD_GUIDE.md) - Using the web dashboard
- [CI/CD](CI_CD.md) - Observability in CI/CD workflows
