# Quick Start: Revision Notes Author Agent

**Agent**: Course Revision Notes Author
**Purpose**: Generate pedagogically-sound revision notes from published SOWs
**Estimated Time**: 10 minutes (including Appwrite setup)

---

## Prerequisites

1. **Python Environment**: Python 3.11+ installed
2. **Appwrite Access**: Appwrite MCP server configured in `.mcp.json`
3. **Published SOW**: At least one course with `status="published"` in `default.Authored_SOW`
4. **Lesson Templates**: Corresponding lesson templates exist for the course

### Verify Prerequisites

```bash
# Check Python version
python3 --version  # Should be 3.11 or higher

# Verify Appwrite MCP configured
cat .mcp.json | grep appwrite

# Check for published SOWs (using Appwrite CLI or MCP)
# (Assumes you have a test course like course_c84874)
```

---

## Installation

### Step 1: Install Dependencies

```bash
cd claud_author_agent
pip install -e .
```

This installs the agent and all dependencies including `claude-agent-sdk`.

### Step 2: Create Appwrite Infrastructure

Run the infrastructure setup script to create both `revision_notes` collection AND `documents` storage bucket:

```bash
python scripts/setup_revision_notes_infrastructure.py --mcp-config .mcp.json
```

**Expected Output**:
```
✅ Created collection: revision_notes
✅ Added 11 attributes (including markdown_file_id)
✅ Created 3 indexes
✅ Created storage bucket: documents
✅ Set bucket permissions and configuration
Infrastructure ready for notes authoring
```

### Step 3: Verify Installation

```bash
python scripts/notes_author_cli.py --help
```

**Expected Output**:
```
Usage: notes_author_cli.py [OPTIONS]

Options:
  --courseId TEXT           Course ID (required)
  --version TEXT           SOW version (default: "1")
  --force                  Overwrite existing notes
  --mcp-config PATH        Path to .mcp.json (default: .mcp.json)
  --persist-workspace      Keep workspace after execution
  --log-level TEXT         Logging level (default: INFO)
  --help                   Show this message and exit
```

---

## Usage

### Basic Execution (Minimal Flags)

```bash
python scripts/notes_author_cli.py --courseId course_c84874
```

**What Happens**:
1. Pre-processing: Extracts SOW, lesson templates, course data, outcomes, diagrams
2. Agent execution: Generates cheat sheet + per-lesson notes
3. Post-processing: Uploads markdown to Appwrite `revision_notes` collection
4. Workspace cleanup: Deletes temporary files

**Expected Duration**: 3-5 minutes for 10-lesson course

**Expected Output**:
```
🚀 Starting Revision Notes Author Agent...
================================================
Execution ID: 20251109_143052

Pre-processing: Extracting data from Appwrite...
✅ Authored_SOW.json extracted
✅ Course_data.txt extracted
✅ course_outcomes.json extracted
✅ 12 lesson templates extracted
✅ 24 lesson diagrams extracted

Agent execution: notes_author subagent...
✅ Generated course_cheat_sheet.md (8.5 KB)
✅ Generated 12 lesson notes (2.3 KB avg)

Post-processing: Uploading to Appwrite...
✅ Uploaded revision_notes_course_c84874_cheat_sheet
✅ Uploaded 12 lesson note documents

================================================
✓ Revision notes authored successfully!
  Execution ID: 20251109_143052
  Cheat Sheet ID: revision_notes_course_c84874_cheat_sheet
  Lesson Notes: 12 documents
  Total Cost: $1.45
  Token Usage: 48,230 tokens
================================================
```

### Advanced Execution (Debug Mode)

```bash
python scripts/notes_author_cli.py \
  --courseId course_c84874 \
  --persist-workspace \
  --log-level DEBUG
```

**Flags**:
- `--persist-workspace`: Keeps workspace directory for inspection
- `--log-level DEBUG`: Verbose logging (useful for debugging)

**Workspace Location**:
```
/tmp/workspace_notes_author_20251109_143052/
```

**Inspect Generated Files**:
```bash
# View cheat sheet
cat /tmp/workspace_notes_author_20251109_143052/outputs/course_cheat_sheet.md

# View lesson notes
ls /tmp/workspace_notes_author_20251109_143052/outputs/
# lesson_notes_01.md  lesson_notes_02.md  ...
```

### Force Overwrite Existing Notes

If notes already exist for a course version:

```bash
python scripts/notes_author_cli.py \
  --courseId course_c84874 \
  --version 1 \
  --force
```

**Warning**: This OVERWRITES existing published notes. Use with caution.

### Standalone Upsert from Existing Workspace

If you need to re-upload notes from an existing workspace without regenerating them:

```bash
# Basic upsert (create-only, fails if documents already exist)
python scripts/upsert_revision_notes.py \
  --workspace-path claud_author_agent/workspace/20251110_060554

# Force mode (overwrites existing documents)
python scripts/upsert_revision_notes.py \
  --workspace-path claud_author_agent/workspace/20251110_060554 \
  --force
```

#### When to Use Standalone Upsert

- **Re-upload after manual edits**: You edited markdown files in the workspace and want to update Appwrite
- **Force overwrite**: Initial upsert failed and you want to retry with corrected files
- **Batch processing**: Upsert multiple workspaces from different test runs
- **Workspace recovery**: Agent crashed after generation but before upsert

#### Expected Output

```
📋 Execution ID: 20251110_060554
📚 Course ID: course_c84473
📝 Version: 1
🎯 Lesson Count: 16

✅ Validating Workspace Structure...
   ✓ All 16 lesson notes found
   ✓ Cheat sheet found

📤 Uploading to Appwrite...
   Database: revision_notes
   Storage: documents
   Mode: CREATE (new only)

============================================================
✅ Upsert Complete!
============================================================

📄 Cheat Sheet:
   Document ID: 68e26280b4ca28bc9abc
   File ID: revision_notes_course_c84473_cheat_sheet.md

📚 Lesson Notes:
   Uploaded: 16/16

   First 3 lessons:
      Lesson 01: 68e26280b4ca28bc9def
      Lesson 02: 68e26280b4ca28bc9ghi
      Lesson 03: 68e26280b4ca28bc9jkl
   ...
   Last 3 lessons:
      Lesson 14: 68e26280b4ca28bc9xyz
      Lesson 15: 68e26280b4ca28bc9abc
      Lesson 16: 68e26280b4ca28bc9def

============================================================
```

#### Workspace Structure Required

The script expects this structure:

```
workspace/20251110_060554/
├── inputs/
│   └── Authored_SOW.json      # Contains courseId, version, lesson entries
└── outputs/
    ├── course_cheat_sheet.md
    ├── lesson_notes_01.md
    ├── lesson_notes_02.md
    └── ... (through lesson_notes_16.md)
```

#### Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| `Authored_SOW.json not found` | Missing SOW in inputs/ | Ensure workspace has complete inputs/ directory |
| `Expected 16 lesson notes, found 10` | Missing output files | Regenerate notes or check workspace integrity |
| `Document already exists` | Notes already uploaded | Use `--force` flag to overwrite |
| `MCP config not found` | Missing .mcp.json | Ensure .mcp.json exists with Appwrite credentials |

---

## Verification

### Step 1: Query Appwrite for Generated Notes

Using Appwrite Console or CLI:

```bash
# List all notes for course
appwrite databases listDocuments \
  --databaseId default \
  --collectionId revision_notes \
  --queries 'equal("courseId", "course_c84874")'
```

**Expected**:
- 1 cheat sheet document (`noteType: "cheat_sheet"`)
- N lesson note documents (`noteType: "lesson_note"`, `lessonOrder: 1..N`)

### Step 2: Read Generated Markdown

```bash
# Fetch cheat sheet metadata
appwrite databases getDocument \
  --databaseId default \
  --collectionId revision_notes \
  --documentId revision_notes_course_c84874_cheat_sheet
```

**Check**:
- `markdown_file_id` field contains Storage file ID (e.g., "file_abc123xyz")
- `status: "published"`
- `execution_id` matches your run

**Download Markdown Content**:
```bash
# Download markdown from Storage
appwrite storage getFileView \
  --bucketId documents \
  --fileId {markdown_file_id from above}
```

This retrieves the actual markdown content from the "documents" bucket.

### Step 3: Validate Markdown Structure

If workspace persisted (`--persist-workspace`):

```bash
# Check course cheat sheet structure
grep -E "^## |^### " /tmp/workspace_.../outputs/course_cheat_sheet.md
```

**Expected Headings**:
```
## Course Overview
## Learning Outcomes Summary
## Lessons at a Glance
### Lesson 1: [Title]
### Lesson 2: [Title]
...
## Quick Reference
### Formulas Sheet
### Misconceptions to Avoid
### Assessment Standard Checklist
```

```bash
# Check lesson note structure
grep -E "^## |^### " /tmp/workspace_.../outputs/lesson_notes_01.md
```

**Expected Headings**:
```
## Lesson Summary
## Card-by-Card Breakdown
### Card 1: [Type] - [Topic]
### Card 2: [Type] - [Topic]
...
## Common Misconceptions
## Checkpoint Questions
## Visual References
## Review Schedule
```

---

## Troubleshooting

### Error: "Course not found"

**Cause**: courseId doesn't exist in `default.courses`

**Fix**:
```bash
# Verify course exists
appwrite databases listDocuments \
  --databaseId default \
  --collectionId courses \
  --queries 'equal("courseId", "course_c84874")'
```

### Error: "No published SOW for course"

**Cause**: No Authored_SOW with `status="published"` for courseId

**Fix**:
```bash
# Check SOW status
appwrite databases listDocuments \
  --databaseId default \
  --collectionId Authored_SOW \
  --queries 'equal("courseId", "course_c84874")'

# Update status if needed (using Appwrite Console)
```

### Error: "No lesson diagrams found"

**Cause**: Per spec requirement, ALL courses must have diagrams

**Fix**:
```bash
# Check if diagrams exist
appwrite databases listDocuments \
  --databaseId default \
  --collectionId lesson_diagrams \
  --queries 'equal("courseId", "course_c84874")'

# If missing, run diagram_author agent first
python scripts/diagram_author_cli.py --courseId course_c84874
```

### Error: "Revision notes version 1 already exists"

**Cause**: Notes already generated for this version

**Fix Option 1** - Force overwrite:
```bash
python scripts/notes_author_cli.py --courseId course_c84874 --force
```

**Fix Option 2** - Create new version:
```bash
python scripts/notes_author_cli.py --courseId course_c84874 --version 2
```

### Error: "Empty markdown content in outputs/"

**Cause**: Agent failed to generate markdown (LLM error or timeout)

**Fix**:
1. Check agent logs: `--log-level DEBUG`
2. Verify input files are valid (not empty)
3. Increase `max_turns` in `notes_author_claude_client.py` if timeout

### Performance: "Execution took >10 minutes"

**Cause**: Large course (20+ lessons) or slow LLM responses

**Optimization**:
- Reduce course size: Generate notes in batches (e.g., lessons 1-10, then 11-20)
- Check network latency to Appwrite/Anthropic API
- Consider using faster model (not recommended - quality may suffer)

---

## Next Steps

### Integration with Frontend

Generated notes can be displayed in student/teacher UI:

```typescript
// Fetch cheat sheet
const cheatSheet = await databases.getDocument(
  'default',
  'revision_notes',
  `revision_notes_${courseId}_cheat_sheet`
);

// Decompress if needed
let markdown = cheatSheet.content_markdown;
if (markdown.startsWith('gzip:')) {
  markdown = decompressGzipBase64(markdown);
}

// Render markdown
<MarkdownRenderer content={markdown} />
```

### Batch Generation for Multiple Courses

```bash
#!/bin/bash
# generate_all_notes.sh

COURSE_IDS=("course_c84874" "course_abc123" "course_xyz789")

for courseId in "${COURSE_IDS[@]}"; do
  echo "Generating notes for $courseId..."
  python scripts/notes_author_cli.py --courseId "$courseId"
done
```

### Schedule Periodic Regeneration

If SOWs or lesson templates are updated:

```bash
# Cron job (daily at 2 AM)
0 2 * * * /path/to/generate_all_notes.sh
```

---

## Configuration Reference

### .mcp.json (Appwrite MCP Server)

**Why Required**: The Python orchestrator uses Appwrite MCP for all database/storage operations in pre-processing and post-processing phases. The Claude subagent works with workspace files ONLY (no Appwrite access), which saves 5,000-10,000 tokens per execution.

**Architecture**: Pre-processing (Python + MCP) → Subagent (files only) → Post-processing (Python + MCP)

```json
{
  "mcpServers": {
    "appwrite": {
      "command": "npx",
      "args": [
        "-y",
        "@benborla29/appwrite-mcp-server"
      ],
      "env": {
        "APPWRITE_API_ENDPOINT": "https://cloud.appwrite.io/v1",
        "APPWRITE_PROJECT_ID": "your-project-id",
        "APPWRITE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max tokens for agent output | 100000 |
| `LOG_LEVEL` | Python logging level | INFO |

---

## Cost Estimation

Based on Claude Sonnet 4.5 pricing:

| Course Size | Token Usage | Est. Cost |
|-------------|-------------|-----------|
| 5 lessons   | ~20K tokens | $0.60 |
| 10 lessons  | ~45K tokens | $1.35 |
| 15 lessons  | ~65K tokens | $1.95 |
| 20 lessons  | ~85K tokens | $2.55 |

**Cost Breakdown**:
- Pre-processing: $0 (Python utilities, no LLM)
- Agent execution: 90% of cost (markdown generation)
- Post-processing: $0 (Python upserter, no LLM)

---

## Support

**Documentation**:
- Full spec: `specs/002-revision-notes-author/spec.md`
- Implementation plan: `specs/002-revision-notes-author/plan.md`
- Research findings: `specs/002-revision-notes-author/research.md`

**Common Issues**:
- Check CLAUDE.md for architecture patterns
- Review existing agents: `sow_author_claude_client.py`, `lesson_author_claude_client.py`
- Inspect logs: `--log-level DEBUG`

**Contact**:
- GitHub Issues: [Repository Issues Page]
- Developer Slack: #ai-lessons-dev channel
