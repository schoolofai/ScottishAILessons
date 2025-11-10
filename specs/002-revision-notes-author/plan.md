# Implementation Plan: Course Revision Notes Author Agent

**Branch**: `002-revision-notes-author` | **Date**: 2025-11-10 | **Spec**: [spec.md](./spec.md)

## Summary

Create an autonomous Course Revision Notes Author agent using Claude Agent SDK to generate evidence-based revision materials from published Scheme of Work (SOW) documents. The agent produces two types of markdown outputs: (1) a course-level cheat sheet consolidating all lessons and outcomes, and (2) per-lesson quick notes with card-by-card breakdowns.

**Technical Approach**: Python agent using Claude Agent SDK with isolated workspace pattern. Pre-processing extracts all required data from Appwrite into workspace files. Notes author subagent generates markdown files using pedagogical note-taking methods (Cornell Method, spaced repetition cues). **Post-processing uploads markdown to Appwrite Storage "documents" bucket and stores file ID references in `revision_notes` collection** (no compression needed).

**Key Architectural Decision**: Markdown content stored in Appwrite Storage (not database) following the same pattern as lesson diagrams, providing better scalability and performance for large files.

## Technical Context

**Language/Version**: Python 3.11+ (matching existing claud_author_agent stack)

**Primary Dependencies**:
- `claude-agent-sdk` (subagent orchestration)
- `appwrite` SDK via MCP server (database + storage operations)
- Existing utilities: `IsolatedFilesystem`, `CostTracker`, `validate_input_schema`, `appwrite_mcp.py`

**MCP Architecture Pattern** (following lesson_author/sow_author):
- **Python Orchestrator**: Uses Appwrite MCP via `appwrite_mcp.py` utilities for all database/storage operations
- **Claude Subagent**: Works with workspace FILES only - NO Appwrite MCP access (saves 5,000-10,000 tokens)
- **Data Flow**: Pre-processing extracts TO files → Subagent processes files → Post-processing uploads FROM files
- **Configuration**: Requires `.mcp.json` with Appwrite server config (API endpoint, project ID, API key)

**Storage**: Appwrite (cloud-hosted)
- **Input collections**: `default.courses`, `default.Authored_SOW`, `default.lesson_templates`, `sqa_education.sqa_current`, `sqa_education.course_outcomes`, `default.lesson_diagrams`
- **Output collection**: `default.revision_notes` (NEW - stores metadata + file references)
- **Output storage**: `documents` bucket (NEW - stores actual markdown files)

**Testing**: Manual (Playwright MCP), Unit (pytest), Integration (end-to-end pipeline)

**Target Platform**: macOS/Linux with Appwrite MCP server access

**Project Type**: Single Python project (agent module within `claud_author_agent/`)

**Performance Goals**:
- Course cheat sheet generation: <5 minutes for 10-15 lesson courses
- Token budget: <60,000 tokens per execution (~$2 cost)
- Workspace cleanup: <1 second when persist=False

**Constraints**:
- **Storage file size**: 50MB limit per file (markdown typically <1MB)
- Claude Agent SDK: bypassPermissions mode required
- SOW dependency: Only published SOWs valid (status="published")

**Scale/Scope**:
- Target: 50-100 courses in first deployment
- Lesson range: 8-25 lessons per course
- Output: 1 cheat sheet + N lesson notes per course

## Constitution Check

✅ **All checks passed** - See original plan.md for detailed verification

**Violations Requiring Justification**: None

## Project Structure

### Documentation (this feature)

```
specs/002-revision-notes-author/
├── plan.md              # This file
├── research.md          # Phase 0 (COMPLETE)
├── data-model.md        # Phase 1 (COMPLETE - updated for storage)
├── quickstart.md        # Phase 1 (COMPLETE - updated for storage)
├── contracts/           # Phase 1 (COMPLETE)
│   └── notes_author_interface.md
└── tasks.md             # Phase 2 (pending /speckit.tasks command)
```

### Source Code (repository root)

```
claud_author_agent/
├── src/
│   ├── notes_author_claude_client.py  # Main orchestrator (NEW)
│   ├── prompts/
│   │   ├── notes_author_prompt.md     # Subagent prompt (NEW)
│   │   └── schemas/
│   │       └── revision_notes_output.md  # Markdown structure (NEW)
│   └── utils/
│       ├── notes_data_extractor.py    # Extract from Appwrite (NEW)
│       └── notes_storage_upserter.py  # Upload to Storage + DB (NEW - renamed)
├── scripts/
│   ├── notes_author_cli.py            # CLI interface (NEW)
│   └── setup_revision_notes_infrastructure.py  # One-time setup (NEW)
└── docs/guides/
    └── notes-author-guide.md          # Usage docs (NEW)
```

**Structure Decision**: Integrated into existing `claud_author_agent` following sow_author/lesson_author patterns.

## Key Implementation Changes (Storage Architecture)

### Post-Processing Flow (Updated)

```python
async def _upload_to_storage_and_database(self, workspace_path, courseId, version, execution_id):
    """Upload markdown to Storage, then store file IDs in database."""

    # 1. Upload course cheat sheet to Storage
    cheat_sheet_path = workspace_path / "course_cheat_sheet.md"
    cheat_sheet_file_id = await upload_to_appwrite_storage(
        bucket_id="documents",
        file_path=cheat_sheet_path,
        file_id=f"revision_notes_{courseId}_cheat_sheet.md",
        mcp_config_path=self.mcp_config_path
    )

    # 2. Create database document with file ID reference
    await create_appwrite_document(
        database_id="default",
        collection_id="revision_notes",
        document_id=f"revision_notes_{courseId}_cheat_sheet",
        data={
            "courseId": courseId,
            "noteType": "cheat_sheet",
            "lessonOrder": None,
            "status": "published",
            "execution_id": execution_id,
            "markdown_file_id": cheat_sheet_file_id,  # Storage reference
            "version": version,
            "generation_timestamp": datetime.now().isoformat()
        },
        mcp_config_path=self.mcp_config_path
    )

    # 3. Repeat for each lesson note...
```

### One-Time Infrastructure Setup

```python
# scripts/setup_revision_notes_infrastructure.py
async def setup_infrastructure(mcp_config_path):
    """Create revision_notes collection AND documents storage bucket."""

    # 1. Create collection (metadata only)
    await create_revision_notes_collection(mcp_config_path)

    # 2. Create Storage bucket (NEW)
    await create_documents_storage_bucket(mcp_config_path)

    logger.info("✅ Infrastructure ready")
```

### Data Retrieval (Frontend Integration)

```typescript
// Fetch revision note
const noteDoc = await databases.getDocument(
  'default',
  'revision_notes',
  `revision_notes_${courseId}_cheat_sheet`
);

// Download markdown from Storage
const markdownContent = await storage.getFileView(
  'documents',
  noteDoc.markdown_file_id
);

// Render markdown
<MarkdownRenderer content={markdownContent} />
```

## Phase Status

### Phase 0: Research ✅ COMPLETE
- **Output**: research.md with pedagogical methods, diagram integration, storage strategy, ASCII diagram libraries
- **Key Decisions**:
  - Cornell Method structure
  - Storage-based architecture (no compression)
  - **Mermaid syntax for diagrams** (zero dependencies, universal markdown support)
  - Rich library for fallback ASCII art (simple tables/boxes)

### Phase 1: Design & Contracts ✅ COMPLETE (Updated for Storage)
- **Outputs**:
  - `data-model.md` - RevisionNote entity with `markdown_file_id` field + Storage bucket schema
  - `contracts/notes_author_interface.md` - Agent subagent interface
  - `quickstart.md` - Usage guide with storage setup instructions
- **Updates Applied**: All references to `content_markdown` replaced with `markdown_file_id`

### Phase 2: Task Generation ⏳ PENDING
- **Command**: `/speckit.tasks` (run after plan approval)
- **Expected Tasks**:
  1. Create "documents" Storage bucket (one-time setup)
  2. Create `revision_notes` collection (one-time setup)
  3. Implement `notes_storage_upserter.py` (Storage upload + DB upsert)
  4. Implement `notes_data_extractor.py`
  5. Implement `notes_author_claude_client.py`
  6. Write prompts and schemas
  7. Implement CLI wrapper
  8. Write tests
  9. Update documentation

## Next Steps

1. ✅ Review this updated plan focusing on storage architecture
2. ⏳ Run `/speckit.tasks` to generate implementation tasks
3. ⏳ Execute tasks in dependency order
4. ⏳ Manual testing with Playwright

## References

- **Spec**: `specs/002-revision-notes-author/spec.md` (updated with Storage requirements)
- **Data Model**: `specs/002-revision-notes-author/data-model.md` (updated with Storage bucket schema)
- **Research**: `specs/002-revision-notes-author/research.md`
- **Existing Patterns**: `claud_author_agent/src/sow_author_claude_client.py`, `lesson_author_claude_client.py`
- **Storage Reference**: Lesson diagrams implementation (`images` bucket pattern)
