# Web Dashboard Guide

> Using the Next.js dashboard to monitor and manage pipeline runs

---

## Overview

The DevOps dashboard provides a web interface for:
- Viewing all pipeline runs
- Monitoring run progress
- Viewing logs and reports
- Resuming failed runs

**URL**: `http://localhost:3000/devops`

## Access Requirements

The dashboard is **admin-only**. You must:
1. Be logged in to the application
2. Have admin privileges (checked via `useIsAdmin()` hook)

## Dashboard Pages

### 1. Dashboard Home (`/devops`)

The main dashboard shows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Content Pipeline Dashboard                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Total Runs   │  │  Completed   │  │ In Progress  │  │  Total Cost  │    │
│  │     12       │  │      8       │  │      2       │  │   $245.60    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  Recent Pipeline Runs                                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Run ID            Subject       Level       Status     Progress   Cost     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  20260109_143022   mathematics   national_5   ✅        ████████   $28.60   │
│  20260109_103015   physics       higher       ⏳        ██████░░   $25.10   │
│  20260108_161230   chemistry     national_5   ❌        ████░░░░   $12.30   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features**:
- Summary cards with aggregated stats
- Sortable run list (by date, status, cost)
- Click any run to view details

### 2. Run Detail (`/devops/runs/[runId]`)

Detailed view of a specific run:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Run: 20260109_143022                                              [Resume] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Subject: mathematics    Level: national_5    Course ID: course_c84775      │
│  Started: Jan 9, 2026 2:30 PM    Duration: 2h 2m    Status: ✅ Completed    │
│                                                                              │
│  Steps                                                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ✅ SEED      3s        │ course_id: course_c84775                          │
│  ───────────────────────┼──────────────────────────────────────────────────  │
│  ✅ SOW       4m 47s    │ 18 lessons, $1.85                                 │
│  ───────────────────────┼──────────────────────────────────────────────────  │
│  ✅ LESSONS   1h 12m    │ 18/18 completed, $18.50                           │
│  ───────────────────────┼──────────────────────────────────────────────────  │
│  ✅ DIAGRAMS  45m 12s   │ 42 diagrams, $8.25                                │
│                                                                              │
│  [Steps] [Logs] [Reports]                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tabs**:
- **Steps**: Step-by-step progress with outputs and metrics
- **Logs**: Pipeline log viewer
- **Reports**: Download summary.json, metrics.json

## UI Components

### Status Badges

| Status | Badge | Meaning |
|--------|-------|---------|
| `pending` | ⏸️ Pending | Not yet started |
| `in_progress` | ⏳ In Progress | Currently running |
| `completed` | ✅ Completed | All steps done |
| `failed` | ❌ Failed | Step failed |

### Progress Bar

Visual representation of steps completed:

```
4/4 steps: ████████████████ 100%
2/4 steps: ████████░░░░░░░░  50%
1/4 steps: ████░░░░░░░░░░░░  25%
```

### Cost Display

Costs are formatted as USD:
- `$1.85` - Under $10
- `$28.60` - Standard display
- `$245.60` - Aggregated totals

## Actions

### Resume a Failed Run

1. Navigate to the failed run's detail page
2. Click the **Resume** button
3. Copy the displayed command:
   ```bash
   ./devops/pipeline.sh lessons --resume 20260108_161230
   ```
4. Run the command in your terminal

### View Logs

1. Go to run detail page
2. Click **Logs** tab
3. Logs are displayed with syntax highlighting
4. Use browser search (Ctrl+F) to find specific entries

### Download Reports

1. Go to run detail page
2. Click **Reports** tab
3. Click download links for:
   - `summary.json` - Pipeline summary
   - `metrics.json` - Detailed metrics
   - `events.jsonl` - Event stream

## API Integration

The dashboard fetches data from these endpoints:

### List Runs

```http
GET /api/devops/runs
```

Response:
```json
[
  {
    "run_id": "20260109_143022",
    "subject": "mathematics",
    "level": "national_5",
    "status": "completed",
    "started_at": "2026-01-09T14:30:22Z",
    "completed_steps": 4,
    "cost_usd": 28.60
  }
]
```

### Get Run Details

```http
GET /api/devops/runs/{runId}
```

Response:
```json
{
  "run_id": "20260109_143022",
  "pipeline": "lessons",
  "subject": "mathematics",
  "level": "national_5",
  "course_id": "course_c84775",
  "status": "completed",
  "started_at": "2026-01-09T14:30:22Z",
  "completed_steps": [...],
  "total_cost_usd": 28.60
}
```

### Get Logs

```http
GET /api/devops/runs/{runId}/logs
```

Response: Plain text log content

### Get Reports

```http
GET /api/devops/runs/{runId}/reports/{reportType}
```

- `reportType`: `summary`, `metrics`, or `events`

## Refreshing Data

The dashboard does **not** auto-refresh. To see updated data:
- Refresh the browser page
- Click the refresh button (if available)

**Note**: For real-time monitoring during long runs, use `tail -f` on log files instead.

## Troubleshooting

### Dashboard Not Loading

1. **Check frontend is running**:
   ```bash
   curl http://localhost:3000
   ```

2. **Check API endpoints**:
   ```bash
   curl http://localhost:3000/api/devops/runs
   ```

3. **Check admin access**: Ensure you're logged in with admin privileges

### No Runs Showing

1. **Check checkpoint directory exists**:
   ```bash
   ls devops/checkpoints/
   ```

2. **Check file permissions**: API routes read from filesystem

### Logs Not Displaying

1. **Check log file exists**:
   ```bash
   ls devops/logs/{run_id}/
   ```

2. **Check log file permissions**: Should be readable by Node.js process

## Development

### Dashboard Location

```
assistant-ui-frontend/
├── app/
│   └── (protected)/
│       └── devops/
│           ├── page.tsx              # Dashboard home
│           └── runs/
│               └── [runId]/
│                   └── page.tsx      # Run detail
└── app/
    └── api/
        └── devops/
            └── runs/
                ├── route.ts          # List runs
                └── [runId]/
                    ├── route.ts      # Run details
                    ├── logs/
                    │   └── route.ts  # Get logs
                    └── reports/
                        └── [reportType]/
                            └── route.ts  # Get reports
```

### Adding New Features

To add a new dashboard feature:

1. Create/modify page component in `app/(protected)/devops/`
2. Add API route if needed in `app/api/devops/`
3. Update navigation links
4. Test with admin user

## Related Documentation

- [Observability](OBSERVABILITY.md) - All observability channels
- [Checkpoint/Resume](CHECKPOINT_RESUME.md) - Understanding run status
