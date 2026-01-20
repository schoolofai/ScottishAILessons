# Content Authoring Pipeline

> Single-command course creation with checkpoint/resume and observability

---

## Quick Start

```bash
# Activate environment
source claud_author_agent/.venv/bin/activate

# Create a complete course (seed → SOW → lessons → diagrams)
./devops/pipeline.sh lessons --subject mathematics --level national_5

# Resume a failed run
./devops/pipeline.sh lessons --resume 20260109_143022

# Dry-run (preview without execution)
./devops/pipeline.sh lessons --subject physics --level higher --dry-run

# List all runs
./devops/pipeline.sh list
```

## Features

| Feature | Description |
|---------|-------------|
| Single Command | One command to create entire course |
| Checkpoint/Resume | Resume from any failed step |
| Observability | LangSmith traces + JSON reports + web dashboard |
| Validation | Subject/level validation with helpful aliases |
| CI/CD Ready | GitHub Actions workflow included |

## Pipeline Steps

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    SEED      │───▶│  SOW AUTHOR  │───▶│LESSON AUTHOR │───▶│DIAGRAM AUTHOR│
│  (TypeScript)│    │   (Claude)   │    │   (Claude)   │    │   (Claude)   │
│   ~3 secs    │    │   ~5 mins    │    │  ~1-2 hours  │    │  ~30-60 mins │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   courses            Authored_SOW       lesson_templates    lesson_diagrams
   course_outcomes
```

## Documentation

- [Pipeline Reference](docs/PIPELINE_REFERENCE.md) - All pipeline steps explained
- [Orchestrator Guide](docs/ORCHESTRATOR_GUIDE.md) - How the automation works
- [Checkpoint/Resume](docs/CHECKPOINT_RESUME.md) - State persistence details
- [Observability](docs/OBSERVABILITY.md) - Metrics and monitoring
- [Dashboard Guide](docs/DASHBOARD_GUIDE.md) - Web UI usage
- [CI/CD Setup](docs/CI_CD.md) - GitHub Actions configuration

## CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `lessons` | Run course creation pipeline |
| `list` | List all pipeline runs |
| `help` | Show detailed help |

### Options (lessons command)

| Option | Description |
|--------|-------------|
| `--subject` | SQA subject (e.g., mathematics, physics) |
| `--level` | SQA level (e.g., national_5, higher) |
| `--resume <run_id>` | Resume from checkpoint |
| `--dry-run` | Preview without execution |
| `--skip-diagrams` | Skip diagram generation step |
| `--skip-seed-sow` | Skip SEED and SOW steps (requires existing course+SOW) |
| `--force` | Force regenerate existing content |
| `--diagram-timeout` | Timeout for diagram service (default: 60s) |
| `--iterative` | Use iterative lesson-by-lesson SOW authoring (default) |
| `--legacy` | Use legacy monolithic SOW authoring |

### Subject Aliases

| Input | Normalized |
|-------|------------|
| `math`, `maths` | `mathematics` |
| `app_math` | `application_of_mathematics` |
| `n5`, `nat5` | `national_5` |
| `ah` | `advanced_higher` |

### Skip Seed and SOW Steps

For courses where seeding and SOW already exist in the database, use `--skip-seed-sow` to start directly from lesson generation:

```bash
# Skip seed+SOW when course already exists
python devops/pipeline_runner.py lessons --subject application_of_mathematics --level higher --skip-seed-sow

# Combine with other flags
python devops/pipeline_runner.py lessons --subject aom --level higher --skip-seed-sow --skip-diagrams
```

**Prerequisites for `--skip-seed-sow`:**
- Course must exist in `default.courses` collection
- SOW must exist in `default.Authored_SOW` collection

The pipeline will fail fast with clear error messages if prerequisites are not met:
```
No course found for subject=gaelic, level=advanced_higher.
Run without --skip-seed-sow to seed the course first.

No SOW found for course course_c84775.
Run without --skip-seed-sow to generate SOW first.
```

### SOW Authoring Modes

Two SOW authoring modes are available:

| Mode | Flag | Description |
|------|------|-------------|
| **Iterative** (default) | `--iterative` | Lesson-by-lesson generation with better schema compliance |
| **Legacy** | `--legacy` | Original monolithic approach for backward compatibility |

```bash
# Use iterative mode (default - better for new courses)
./devops/pipeline.sh lessons --subject mathematics --level national_5

# Explicitly use iterative mode
./devops/pipeline.sh lessons --subject physics --level higher --iterative

# Use legacy mode (if iterative has issues)
./devops/pipeline.sh lessons --subject chemistry --level n5 --legacy
```

**Iterative Mode Benefits:**
- Each lesson generated independently (~4K tokens vs ~50K+ monolithic)
- Better Pydantic schema compliance
- Cross-lesson coherence validation
- Easier debugging (per-lesson workspace files)

## Directory Structure

```
devops/
├── pipeline.sh              # Main CLI entry point
├── pipeline_runner.py       # Python orchestrator
├── lib/                     # Core modules
│   ├── checkpoint_manager.py
│   ├── step_runner.py
│   ├── observability.py
│   ├── diagram_service.py
│   └── validators.py
├── checkpoints/             # Pipeline state (auto-created)
├── reports/                 # JSON reports (auto-created)
├── logs/                    # Execution logs (auto-created)
├── config/                  # Configuration files
└── docs/                    # Documentation
```

## Cost Estimates

| Step | Time | Cost |
|------|------|------|
| Seed | 2-3 seconds | Free |
| SOW | 3-5 minutes | ~$2 |
| Lessons (20) | 1-2 hours | ~$20 |
| Diagrams (20) | 30-60 min | ~$10 |
| **Total** | **2-4 hours** | **~$32** |

## Prerequisites

1. **Python 3.11+** with claud_author_agent dependencies
2. **Node.js 18+** for TypeScript seeding script
3. **Appwrite credentials** configured
4. **Anthropic API key** for Claude agents
5. **Diagram screenshot service** (optional, for Step 4)

## Environment Setup

```bash
# 1. Install author agent dependencies
cd claud_author_agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# 2. Install frontend dependencies (for seeding)
cd ../assistant-ui-frontend
npm install --legacy-peer-deps

# 3. Configure environment variables
# - claud_author_agent/.env
# - assistant-ui-frontend/.env.local

# 4. (Optional) Start diagram service for Step 4
cd ../diagramScreenshot
docker-compose up -d
```

## Example: Full Course Creation

```bash
# 1. Activate environment
source claud_author_agent/.venv/bin/activate

# 2. Run full pipeline
./devops/pipeline.sh lessons --subject mathematics --level national_5

# Example output:
# ═══════════════════════════════════════════════════════════════════════════
# PIPELINE: lessons
# Run ID: 20260109_143022
# Subject: mathematics
# Level: national_5
# ═══════════════════════════════════════════════════════════════════════════
#
# Step 1/4: SEED
#   ✅ Completed in 2.3s
#   Output: course_id = course_c84775
#
# Step 2/4: SOW
#   ✅ Completed in 4m 23s
#   Output: 18 lesson entries created
#   Cost: $1.85 (15,420 input / 8,234 output tokens)
#
# Step 3/4: LESSONS
#   ✅ Completed in 1h 12m
#   Output: 18/18 lessons generated
#   Cost: $18.50
#
# Step 4/4: DIAGRAMS
#   ✅ Completed in 45m
#   Output: 42 diagrams generated
#   Cost: $8.25
#
# ═══════════════════════════════════════════════════════════════════════════
# PIPELINE COMPLETED SUCCESSFULLY
# Total time: 2h 02m
# Total cost: $28.60
# ═══════════════════════════════════════════════════════════════════════════
```

## Troubleshooting

### Common Issues

**Pipeline fails at Step 1 (SEED)**
```
Cause: Node.js or npm not installed
Fix: Install Node.js 18+ and run npm install in assistant-ui-frontend
```

**Pipeline fails at Step 4 (DIAGRAMS)**
```
Cause: Diagram screenshot service not running
Fix: cd diagramScreenshot && docker-compose up -d
Or: Use --skip-diagrams flag to skip this step
```

**Resume command not working**
```
Cause: Invalid run_id or corrupted checkpoint
Fix: Check devops/checkpoints/{run_id}/checkpoint.json exists
     Use --force to start fresh if needed
```

### Log Locations

```
devops/
├── logs/
│   └── {run_id}/
│       ├── pipeline.log      # Main orchestrator log
│       └── steps/
│           ├── seed.log
│           ├── sow.log
│           ├── lessons.log
│           └── diagrams.log
├── reports/
│   └── {run_id}/
│       ├── summary.json      # Pipeline summary
│       ├── metrics.json      # Cost/token metrics
│       └── events.jsonl      # Event stream
└── checkpoints/
    └── {run_id}/
        └── checkpoint.json   # Resumable state
```

## Support

For issues or questions:
1. Check logs in `devops/logs/{run_id}/`
2. Review checkpoint state in `devops/checkpoints/{run_id}/`
3. Consult the [Troubleshooting Guide](docs/PIPELINE_REFERENCE.md#troubleshooting)
