# Revision Notes Author Guide

**Agent**: Course Revision Notes Author
**Purpose**: Generate evidence-based revision notes from published SOWs
**Status**: 🚧 In Development

---

## Quick Start

1. **Setup Infrastructure** (one-time):
   ```bash
   cd claud_author_agent
   python scripts/setup_revision_notes_infrastructure.py --mcp-config .mcp.json
   ```

2. **Generate Revision Notes**:
   ```bash
   python scripts/notes_author_cli.py --courseId course_c84874
   ```

3. **Verify Output**:
   - Check Appwrite Console → `default.revision_notes` collection
   - Download markdown from Storage → `documents` bucket

---

## Overview

The Revision Notes Author agent automatically generates two types of revision materials:

1. **Course Cheat Sheet** - Quick reference consolidating all lessons
2. **Per-Lesson Notes** - Detailed breakdown of each lesson's cards

**Key Features**:
- Pedagogically-sound note-taking methods (Cornell Method, spaced repetition)
- Evidence-based from SOW and lesson templates (no invented content)
- Storage-based architecture (markdown stored in Appwrite Storage bucket)
- Automatic diagram integration
- Common misconception highlighting

---

## Architecture

```
Pre-Processing (Python)          Subagent (Claude)              Post-Processing (Python)
─────────────────────────         ──────────────────            ─────────────────────────
Extract data from Appwrite  →    Generate markdown    →        Upload to Storage + DB
- SOW, lessons, outcomes                                        - File ID references
- Course data, diagrams                                         - Metadata tracking
```

**MCP Pattern**:
- Python orchestrator uses Appwrite MCP for data operations
- Claude subagent works with workspace FILES only (saves 5-10K tokens)
- No Appwrite access for subagent (all data pre-extracted)

---

## Prerequisites

1. **Published SOW**: Course must have `status="published"` in `Authored_SOW` collection
2. **Lesson Templates**: Corresponding lesson templates must exist
3. **MCP Configuration**: `.mcp.json` with Appwrite credentials
4. **Infrastructure**: `revision_notes` collection and `documents` bucket created

---

## Usage Examples

### Basic Execution

```bash
python scripts/notes_author_cli.py --courseId course_c84874
```

**Output**:
```
🚀 Starting Revision Notes Author Agent...
Execution ID: 20251110_143052

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

✓ Revision notes authored successfully!
  Total Cost: $1.45
  Token Usage: 48,230 tokens
```

### Debug Mode

```bash
python scripts/notes_author_cli.py \
  --courseId course_c84874 \
  --persist-workspace \
  --log-level DEBUG
```

**Workspace Location**: `/tmp/workspace_notes_author_20251110_143052/`

**Inspect Files**:
```bash
# View cheat sheet
cat /tmp/workspace_notes_author_20251110_143052/outputs/course_cheat_sheet.md

# List lesson notes
ls /tmp/workspace_notes_author_20251110_143052/outputs/
```

### Force Overwrite

If notes already exist for a course:

```bash
python scripts/notes_author_cli.py \
  --courseId course_c84874 \
  --force
```

⚠️ **Warning**: Overwrites existing published notes with new execution_id.

---

## Cost Estimation

Based on Claude Sonnet 4.5 pricing:

| Course Size | Token Usage | Est. Cost |
|-------------|-------------|-----------|
| 5 lessons   | ~20K tokens | $0.60     |
| 10 lessons  | ~45K tokens | $1.35     |
| 15 lessons  | ~65K tokens | $1.95     |
| 20 lessons  | ~85K tokens | $2.55     |

**Breakdown**:
- Pre-processing: $0 (Python utilities, no LLM)
- Agent execution: 90% of cost (markdown generation)
- Post-processing: $0 (Python upserter, no LLM)

---

## Troubleshooting

### Error: "Course not found"

**Cause**: courseId doesn't exist in `default.courses`

**Fix**:
```bash
# Verify course exists
python -c "from src.utils.appwrite_mcp import get_appwrite_document; \
  import asyncio; \
  asyncio.run(get_appwrite_document('default', 'courses', 'course_c84874', '.mcp.json'))"
```

### Error: "No published SOW for course"

**Cause**: No Authored_SOW with `status="published"`

**Fix**: Update SOW status in Appwrite Console or via API.

### Error: "No lesson diagrams found"

**Cause**: Course has no lesson diagrams (required per spec)

**Fix**: Run diagram_author agent first:
```bash
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

---

## CLI Reference

```bash
python scripts/notes_author_cli.py [OPTIONS]
```

**Options**:

| Flag | Description | Default |
|------|-------------|---------|
| `--courseId` | Course ID (required) | - |
| `--version` | SOW version | "1" |
| `--force` | Overwrite existing notes | False |
| `--mcp-config` | Path to .mcp.json | ".mcp.json" |
| `--persist-workspace` | Keep workspace after execution | False |
| `--log-level` | Logging level (DEBUG/INFO/WARNING/ERROR) | INFO |

---

## Integration with Frontend

### Fetch Revision Notes

```typescript
// 1. Fetch note metadata
const cheatSheetDoc = await databases.getDocument(
  'default',
  'revision_notes',
  `revision_notes_${courseId}_cheat_sheet`
);

// 2. Download markdown from Storage
const markdownContent = await storage.getFileView(
  'documents',
  cheatSheetDoc.markdown_file_id
);

// 3. Render markdown
<MarkdownRenderer content={markdownContent} />
```

### List All Notes for Course

```typescript
// Query notes by courseId
const notesQuery = await databases.listDocuments(
  'default',
  'revision_notes',
  [Query.equal('courseId', courseId)]
);

// Filter by type
const cheatSheet = notesQuery.documents.find(d => d.noteType === 'cheat_sheet');
const lessonNotes = notesQuery.documents
  .filter(d => d.noteType === 'lesson_note')
  .sort((a, b) => a.lessonOrder - b.lessonOrder);
```

---

## Batch Generation

Generate notes for multiple courses:

```bash
#!/bin/bash
# generate_all_notes.sh

COURSE_IDS=("course_c84874" "course_abc123" "course_xyz789")

for courseId in "${COURSE_IDS[@]}"; do
  echo "Generating notes for $courseId..."
  python scripts/notes_author_cli.py --courseId "$courseId"
done
```

---

## Development

### Project Structure

```
claud_author_agent/
├── src/
│   ├── notes_author_claude_client.py    # Main orchestrator
│   ├── prompts/
│   │   ├── notes_author_prompt.md       # Subagent instructions
│   │   └── schemas/
│   │       └── revision_notes_output.md # Output structure
│   └── utils/
│       ├── notes_data_extractor.py      # Extract from Appwrite
│       └── notes_storage_upserter.py    # Upload to Storage + DB
├── scripts/
│   ├── notes_author_cli.py              # CLI interface
│   └── setup_revision_notes_infrastructure.py
└── docs/guides/
    └── notes-author-guide.md            # This file
```

### Testing

```bash
# Unit tests (TODO - not yet implemented)
pytest tests/test_notes_author.py

# Integration test
python scripts/notes_author_cli.py --courseId course_c84874 --persist-workspace
```

---

## FAQ

**Q: Can I generate notes for draft SOWs?**
A: No. Only published SOWs (`status="published"`) are supported. This ensures quality and prevents notes from changing SOWs.

**Q: What happens if lesson templates change?**
A: Re-run the agent with `--force` to regenerate notes with updated content.

**Q: Can I customize the note-taking method?**
A: Yes. Edit `src/prompts/notes_author_prompt.md` to change pedagogy (e.g., switch from Cornell Method to Mind Mapping).

**Q: Are diagrams embedded in markdown?**
A: No. Diagram metadata is referenced with text descriptions (`alt_text`, `diagram_context`). This keeps markdown files small and portable.

**Q: Can I export notes to PDF?**
A: Use a markdown-to-PDF converter (e.g., Pandoc, markdown-pdf) on the downloaded markdown files.

---

## Support

- **Documentation**: `specs/002-revision-notes-author/`
- **Implementation Plan**: `specs/002-revision-notes-author/plan.md`
- **Research**: `specs/002-revision-notes-author/research.md`

---

## Changelog

### 2025-11-10 - Initial Release (Planned)
- Course cheat sheet generation
- Per-lesson notes generation
- Storage-based architecture
- Cornell Method + spaced repetition cues
- Mermaid diagram support

---

**More details coming as implementation progresses...**
