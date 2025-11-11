# Quick Start: Claude Diagram Generation Agent

**Feature**: Claude Diagram Generation Agent
**Branch**: `001-claude-diagram-agent`
**Date**: 2025-10-31

This guide provides step-by-step instructions for installing, configuring, and using the diagram generation agent.

---

## Prerequisites

### 1. Python Environment

- **Python Version**: 3.11+
- **Virtual Environment**: Recommended

```bash
# Create virtual environment (if not exists)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Dependencies

Install required packages:

```bash
cd claud_author_agent
pip install -e .
```

**Key Dependencies**:
- `claude-agent-sdk`: Claude SDK for agent orchestration
- `requests`: HTTP client for DiagramScreenshot service
- `appwrite`: Appwrite SDK for database operations (pre/post-processing only)

### 3. DiagramScreenshot Service

The diagram generation agent requires the DiagramScreenshot service running on port 3001.

```bash
# Navigate to diagram service directory
cd diagramScreenshot

# Start Docker container
docker compose up -d

# Verify service health
curl http://localhost:3001/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T12:34:56.789Z",
  "version": "1.0.0",
  "uptime_seconds": 10
}
```

**Troubleshooting**:
- If port 3001 is in use: `lsof -ti:3001 | xargs kill -9`
- Check container logs: `docker compose logs -f`
- Rebuild container: `docker compose up --build`

---

## Configuration

### 1. Environment Variables

Create or update `.env` file in `claud_author_agent/`:

```bash
# Claude API Configuration
ANTHROPIC_API_KEY=sk-ant-...  # Your Claude API key

# DiagramScreenshot Service
DIAGRAM_SCREENSHOT_URL=http://localhost:3001
DIAGRAM_SCREENSHOT_API_KEY=dev-api-key-change-in-production

# Appwrite Configuration (pre/post-processing)
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your-project-id
APPWRITE_API_KEY=your-api-key
```

**Important**:
- `ANTHROPIC_API_KEY`: Required for Claude Sonnet 4.5 model
- `DIAGRAM_SCREENSHOT_URL`: Default is localhost:3001 (change for production)
- Appwrite credentials: Used only for reading lesson_templates and writing lesson_diagrams

### 2. MCP Configuration

The agent uses `.mcp.json` for Appwrite MCP server configuration:

```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": [
        "-y",
        "@niladribose/appwrite-mcp-server"
      ],
      "env": {
        "APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Note**: The diagram agent does NOT expose Appwrite MCP tools to the Claude agent. Appwrite operations are handled by Python utilities in pre/post-processing phases.

---

## Usage

### Input Method 1: JSON File

Create an input JSON file:

```json
{
  "courseId": "course_c84874",
  "order": 3
}
```

Run the agent:

```bash
cd claud_author_agent
python -m src.diagram_author_cli --input input.json
```

**JSON Schema**:
```json
{
  "courseId": "string (required)",
  "order": "integer (required, ≥1)",
  "force": "boolean (optional, default: false)",
  "persist_workspace": "boolean (optional, default: true)",
  "log_level": "string (optional, default: INFO)"
}
```

---

### Input Method 2: Command-Line Arguments

```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 3 \
  --force \
  --no-persist-workspace \
  --log-level DEBUG
```

**Arguments**:
- `--courseId`: Course identifier (e.g., `course_c84874`)
- `--order`: Lesson order number in SOW (1-indexed, ≥1)
- `--force`: Regenerate diagrams even if they already exist (optional)
- `--no-persist-workspace`: Delete workspace after execution (optional)
- `--log-level`: Logging verbosity - DEBUG|INFO|WARNING|ERROR (optional)
- `--mcp-config`: Path to MCP config file (optional, default: `.mcp.json`)

---

### Input Method 3: Interactive Mode

Run without arguments to enter interactive mode:

```bash
python -m src.diagram_author_cli
```

**Interactive Prompts**:
```
======================================================================
Diagram Author - Interactive Input
======================================================================

Please provide the following information:

Course ID - courseId field value (e.g., 'course_c84874'):
  (Must exist in default.courses collection)
  > course_c84874

Lesson Order - entry order in SOW (e.g., 1, 2, 3):
  (Must be valid order in SOW entries for this course)
  (Note: Order starts from 1, not 0)
  > 3

Force regeneration? (y/n):
  > n
```

---

## Batch Mode

Process all lessons for a course:

```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --batch \
  --dry-run  # Preview without execution
```

### Dry-Run Mode

Preview cost estimates without generating diagrams:

```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --batch \
  --dry-run
```

**Output**:
```json
{
  "dry_run": true,
  "courseId": "course_c84874",
  "total_lessons": 20,
  "lessons_needing_diagrams": 15,
  "total_eligible_cards": 42,
  "estimated_tokens": 210000,
  "estimated_cost_usd": 1.89,
  "lessons_details": [
    {
      "lesson_template_id": "lesson_template_001",
      "sow_order": 1,
      "title": "Introduction to Fractions",
      "eligible_cards": 3
    }
  ]
}
```

### Execute Batch

Remove `--dry-run` to execute:

```bash
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --batch
```

**Behavior**:
- Processes lessons sequentially (not parallel)
- Skips lessons with existing diagrams (unless `--force`)
- Continues processing remaining lessons if one fails
- Generates batch report with success/error summary

---

## Output

### Success Output (Single Lesson)

```
✅ SUCCESS: Diagram generation completed!
════════════════════════════════════════════════

Execution Details:
  Execution ID:       20251031_123456
  Workspace:          /path/to/workspace/20251031_123456
  Lesson Template ID: lesson_template_003
  Diagrams Generated: 3
  Diagrams Skipped:   2 (no visualization needed)

Appwrite Documents:
  - diagram_001_abc123
  - diagram_002_def456
  - diagram_003_ghi789

Cost Metrics:
  Total Tokens:  12,450
  Input Tokens:  7,200 ($0.022)
  Output Tokens: 5,250 ($0.079)
  Total Cost:    $0.101 USD

Execution Time: 3 minutes 24 seconds

Workspace preserved at: /path/to/workspace/20251031_123456
(Use --no-persist-workspace to auto-delete)
```

### Error Output

```
❌ FAILED: Diagram generation encountered errors
════════════════════════════════════════════════

Execution ID: 20251031_123456
Error: Diagram for card_002 failed to meet quality threshold (≥0.85) after 3 iterations

Details:
  - Iteration 1: score=0.78 (clarity low, axes labels missing)
  - Iteration 2: score=0.82 (improved, still below threshold)
  - Iteration 3: score=0.84 (insufficient improvement)

Partial Results:
  - card_001: ✅ Generated successfully
  - card_002: ❌ Failed quality threshold
  - card_003: ⏭️  Skipped (error prevented processing)

Cost Metrics:
  Total Tokens: 8,200
  Total Cost:   $0.067 USD

Workspace preserved for debugging: /path/to/workspace/20251031_123456
Review diagram JSON and critique feedback in workspace files.
```

### Batch Output

```
✅ BATCH COMPLETED: 18/20 lessons processed successfully
════════════════════════════════════════════════

Course ID: course_c84874
Total Lessons: 20
Processed: 18
Skipped: 2 (existing diagrams, use --force to regenerate)
Diagrams Generated: 54

Errors (2):
  - lesson_template_007 (order 7): DiagramScreenshot service timeout
  - lesson_template_015 (order 15): Quality threshold not met for card_002

Aggregate Cost:
  Total Tokens: 275,000
  Total Cost:   $2.34 USD

Execution Time: 1 hour 12 minutes

Review error logs for failed lessons:
  /path/to/workspace/20251031_123456_lesson_007/errors.json
  /path/to/workspace/20251031_123456_lesson_015/errors.json
```

---

## Workspace Structure

Each execution creates an isolated workspace:

```
workspace/20251031_123456/
├── lesson_template.json          # Input: fetched from Appwrite
├── cards_for_diagrams.json       # Eligible cards needing diagrams
├── jsxgraph_patterns/            # Pattern library (copied from data/)
│   ├── geometry_patterns.json
│   ├── algebra_patterns.json
│   └── statistics_patterns.json
├── diagrams/                     # Generated diagrams
│   ├── card_001_diagram.json     # JSXGraph JSON
│   ├── card_001_image.png        # Rendered PNG (optional)
│   ├── card_002_diagram.json
│   └── card_002_image.png
├── critique_history.json         # Refinement iteration logs
├── execution_report.json         # Final result summary
└── README.md                     # Workspace documentation

```

**Workspace Persistence**:
- Default: Preserved after execution (`persist_workspace=True`)
- Use `--no-persist-workspace` flag to auto-delete
- Preserved workspaces useful for debugging failed generations

---

## Common Workflows

### 1. Generate Diagrams for Single Lesson

```bash
# Quick check if lesson needs diagrams
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 5

# Force regeneration (if diagrams already exist)
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --order 5 \
  --force
```

### 2. Preview Batch Cost

```bash
# Dry-run to estimate tokens and cost
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --batch \
  --dry-run
```

### 3. Batch Generate All Missing Diagrams

```bash
# Process all lessons without existing diagrams
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --batch
```

### 4. Force Regenerate All Diagrams (Quality Improvement)

```bash
# Regenerate ALL diagrams (ignore existing)
python -m src.diagram_author_cli \
  --courseId course_c84874 \
  --batch \
  --force
```

---

## Troubleshooting

### DiagramScreenshot Service Unreachable

**Error**: `CONNECTION_ERROR: Cannot connect to DiagramScreenshot service at http://localhost:3001`

**Solution**:
```bash
# Check if service is running
curl http://localhost:3001/health

# If not running, start it
cd diagramScreenshot
docker compose up -d

# If port conflict, kill existing process
lsof -ti:3001 | xargs kill -9
docker compose up -d
```

### Quality Threshold Not Met

**Error**: `Diagram for card_002 failed to meet quality threshold (≥0.85) after 3 iterations`

**Solution**:
1. Review critique feedback in workspace: `critique_history.json`
2. Check JSXGraph JSON in `diagrams/card_002_diagram.json`
3. Common issues:
   - Missing axis labels → Add text elements
   - Wrong colors → Use Scottish palette (#0066CC, #28a745, etc.)
   - Cluttered diagram → Simplify elements
   - Mathematical errors → Verify coordinates/calculations
4. If pattern issue, update JSXGraph pattern library in `claud_author_agent/data/jsxgraph_patterns/`

### Lesson Template Not Found

**Error**: `Order 10 not found in SOW entries for courseId 'course_c84874'. Available orders: [1, 2, 3, 4, 5]`

**Solution**:
- Verify lesson exists in Appwrite `default.lesson_templates` collection
- Check `sow_order` field matches the order you provided
- Ensure `courseId` is correct
- Orders are 1-indexed (first lesson is order 1, not 0)

### High Token Usage / Cost

**Issue**: Batch operation costs more than expected

**Solution**:
1. Run dry-run to preview cost: `--batch --dry-run`
2. Use `--no-persist-workspace` to reduce disk usage
3. Process lessons in smaller batches (by sow_order range - future enhancement)
4. Review eligible card count - some lessons may not need diagrams

---

## Performance Guidelines

### Single Lesson Mode

- **Duration**: 3-5 minutes for 3-5 cards
- **Tokens**: ~10,000-15,000 per lesson (varies by complexity)
- **Cost**: ~$0.10-0.15 per lesson

### Batch Mode

- **Duration**: 20 lessons in ~60-90 minutes (sequential processing)
- **Tokens**: ~200,000-300,000 for 20 lessons
- **Cost**: ~$1.50-2.50 for 20 lessons

**Cost Optimization**:
- Use dry-run to preview before execution
- Skip lessons with existing diagrams (don't use `--force` unless needed)
- Run batch during off-peak hours for long courses

---

## Next Steps

After generating diagrams:

1. **Verify in Appwrite**: Check `default.lesson_diagrams` collection for persisted diagrams
2. **Review Quality**: Open workspace to inspect JSXGraph JSON and rendered PNGs
3. **Frontend Integration**: Diagrams are automatically available to frontend via lesson_diagrams collection
4. **Iterate if Needed**: Use `--force` to regenerate diagrams after prompt improvements

---

## Support

For issues or questions:
- Check logs: `--log-level DEBUG`
- Review workspace: `/path/to/workspace/{execution_id}/`
- Consult [data-model.md](./data-model.md) for entity schemas
- See [research.md](./research.md) for architecture decisions
- GitHub Issues: https://github.com/schoolofai/ScottishAILessons/issues
