# Data Model: Revision Notes Author

**Feature**: Course Revision Notes Author Agent
**Date**: 2025-11-09

## Entity: RevisionNote

**Collection**: `default.revision_notes` (Appwrite)

### Attributes

| Field | Type | Size | Required | Default | Description |
|-------|------|------|----------|---------|-------------|
| courseId | String | 50 | Yes | - | Links to default.courses.courseId |
| noteType | String (enum) | 20 | Yes | - | "cheat_sheet" or "lesson_note" |
| lessonOrder | Integer | - | No | null | Lesson order (null for cheat sheets, 1+ for lessons) |
| status | String (enum) | 20 | Yes | "draft" | "draft" or "published" |
| execution_id | String | 50 | Yes | - | Unique execution timestamp (YYYYMMDD_HHMMSS) |
| markdown_file_id | String | 50 | Yes | - | Appwrite Storage file ID from "documents" bucket |
| version | String | 10 | Yes | "1" | Version number for SOW updates tracking |
| sow_version | String | 10 | No | null | Version of Authored_SOW used for generation |
| token_usage | Integer | - | No | null | Total tokens used for generation |
| cost_usd | Float | - | No | null | Estimated cost in USD |
| workspace_path | String | 200 | No | null | Path to workspace if persisted |
| generation_timestamp | DateTime | - | Yes | now() | When note was generated |

### Indexes

```javascript
// Primary key (Appwrite auto-generated)
$id: unique

// Unique composite - prevents duplicate notes for same course/lesson
unique("course_lesson_unique", ["courseId", "noteType", "lessonOrder"])

// Query indexes
index("by_course", ["courseId"], "key")
index("by_course_type", ["courseId", "noteType"], "key")
index("by_status", ["status"], "key")
```

### Validation Rules

```python
def validate_revision_note(doc):
    """Validate RevisionNote document before insert/update."""

    # courseId must exist in default.courses
    assert course_exists(doc['courseId']), f"Invalid courseId: {doc['courseId']}"

    # noteType must be enum value
    assert doc['noteType'] in ['cheat_sheet', 'lesson_note'], "Invalid noteType"

    # lessonOrder constraints
    if doc['noteType'] == 'cheat_sheet':
        assert doc['lessonOrder'] is None, "Cheat sheets must have lessonOrder=null"
    else:  # lesson_note
        assert isinstance(doc['lessonOrder'], int) and doc['lessonOrder'] > 0, \
            "Lesson notes must have lessonOrder >= 1"

    # status must be enum value
    assert doc['status'] in ['draft', 'published'], "Invalid status"

    # markdown_file_id required and non-empty
    assert doc['markdown_file_id'] and doc['markdown_file_id'].strip(), \
        "markdown_file_id cannot be empty"

    return True
```

### Permissions

```javascript
// Read permissions
read("any")  // Any authenticated user can read revision notes

// Write permissions
create("role:admin")    // Only admins and service accounts
update("role:admin")
delete("role:admin")
```

---

## Entity: NotesGenerationWorkspace

**Type**: Ephemeral filesystem structure (not persisted to database unless --persist-workspace)

### Directory Structure

```
workspace_{execution_id}/
├── inputs/                        # Pre-processing extracts
│   ├── Authored_SOW.json         # Decompressed SOW with entries
│   ├── Course_data.txt           # SQA course standards
│   ├── course_outcomes.json      # Learning outcomes details
│   ├── lesson_templates/         # All lesson templates for course
│   │   ├── lesson_01.json
│   │   ├── lesson_02.json
│   │   └── ...
│   └── lesson_diagrams/          # Visual diagram metadata
│       ├── {diagram_id_1}.json
│       ├── {diagram_id_2}.json
│       └── ...
│
├── outputs/                       # Agent-generated markdown
│   ├── course_cheat_sheet.md     # Course-level summary
│   ├── lesson_notes_01.md        # Per-lesson notes
│   ├── lesson_notes_02.md
│   └── ...
│
└── logs/                          # Execution logs (optional)
    ├── pre_processing.log
    ├── agent_execution.log
    └── post_processing.log
```

### File Schemas

**Authored_SOW.json**:
```json
{
  "courseId": "course_c84874",
  "version": "1",
  "status": "published",
  "entries": [
    {
      "order": 1,
      "label": "Fractions of Amounts",
      "lesson_type": "teach",
      "estMinutes": 50,
      "outcomes": ["MTH_3_07a", "MTH_3_07b"],
      "key_concepts": ["..."],
      "worked_examples": ["..."],
      "practice_problems": ["..."]
    }
  ]
}
```

**lesson_templates/{order}.json**:
```json
{
  "$id": "template_abc123",
  "courseId": "course_c84874",
  "sow_order": 1,
  "lessonTemplateId": "...",
  "lesson_type": "teach",
  "estMinutes": 50,
  "cards": [  // Decompressed array
    {
      "id": "card_001",
      "type": "explainer",
      "explainer": "Markdown content with LaTeX",
      "explainer_plain": "Plain text version",
      "misconceptions": ["MISC_MATH_FRACTIONS_001"]
    }
  ]
}
```

**course_outcomes.json**:
```json
[
  {
    "outcome_code": "MTH_3_07a",
    "outcome_description": "I can solve problems involving fractions...",
    "assessment_standards": ["AS1", "AS2"]
  }
]
```

**lesson_diagrams/{id}.json**:
```json
{
  "$id": "diagram_xyz789",
  "diagramType": "lesson",
  "image_file_id": "file_123",
  "alt_text": "Diagram showing fraction bar model",
  "diagram_context": "Visual representation of 2/5 using bar model..."
}
```

---

## Entity: NotesAuthorSubagent

**Type**: Claude Agent SDK subagent definition (in-memory)

### Configuration

```python
subagent_definition = AgentDefinition(
    description="Notes author for creating revision materials with pedagogical note-taking methods",
    prompt=load_prompt("prompts/notes_author_prompt.md")
)
```

### Inputs (from workspace)

- `inputs/Authored_SOW.json`
- `inputs/Course_data.txt`
- `inputs/course_outcomes.json`
- `inputs/lesson_templates/*.json`
- `inputs/lesson_diagrams/*.json`

### Outputs (to workspace)

- `outputs/course_cheat_sheet.md` (REQUIRED)
- `outputs/lesson_notes_{order:02d}.md` (REQUIRED for each lesson)

### Tools Available

- `Read`: Read workspace input files
- `Write`: Create output markdown files
- `Edit`: Modify generated markdown (during self-review)
- `Glob`: Find files in workspace
- `Grep`: Search file contents
- `TodoWrite`: Track generation progress
- `Task`: Delegate sub-tasks (optional)
- `WebSearch`: Validate pedagogical techniques ONLY
- `WebFetch`: Retrieve pedagogy references ONLY

### Constraints

- NO web tools for content generation (only methodology validation)
- ALL content from provided workspace files
- MUST generate both cheat sheet and per-lesson notes
- MUST follow markdown structure from research.md

---

## Relationships

### RevisionNote Relationships

```
Course (1) ──────────────> (many) RevisionNote
  courseId                         courseId

Authored_SOW (1) ───────────> (many) RevisionNote
  courseId + version                 courseId + sow_version

LessonTemplate (1) ─────────> (1) RevisionNote [lesson_note]
  courseId + sow_order               courseId + lessonOrder
```

### Workspace Relationships

```
NotesGenerationWorkspace
  │
  ├── inputs/ ────────────> Extracted from Appwrite collections
  │                         (Authored_SOW, lesson_templates, etc.)
  │
  └── outputs/ ───────────> Uploaded to revision_notes collection
                            (course_cheat_sheet, lesson_notes)
```

---

## State Transitions

### RevisionNote Status Lifecycle

```
                ┌──────────────┐
                │   [NONE]     │  (no note exists)
                └──────┬───────┘
                       │
                  execute()
                       │
                       ▼
                ┌──────────────┐
         ┌─────>│    draft     │
         │      └──────┬───────┘
         │             │
         │        publish()
         │             │
         │             ▼
         │      ┌──────────────┐
         └──────│  published   │<───┐
         force  └──────┬───────┘    │
         update        │             │
                  execute(force=True)│
                       └─────────────┘
```

**Transitions**:
1. `execute(courseId)` → Creates draft revision notes
2. Manual approval → Status = "published"
3. `execute(courseId, force=True)` → Overwrites published notes (new version)

---

## Data Migration Plan

### Collection Creation Script

```python
async def create_revision_notes_collection(mcp_config_path):
    """Create revision_notes collection in Appwrite with schema."""

    # Create collection
    await create_appwrite_collection(
        database_id="default",
        collection_id="revision_notes",
        name="Revision Notes",
        mcp_config_path=mcp_config_path
    )

    # Add attributes
    attributes = [
        {"key": "courseId", "type": "string", "size": 50, "required": True},
        {"key": "noteType", "type": "enum", "elements": ["cheat_sheet", "lesson_note"], "required": True},
        {"key": "lessonOrder", "type": "integer", "required": False},
        {"key": "status", "type": "enum", "elements": ["draft", "published"], "required": True, "default": "draft"},
        {"key": "execution_id", "type": "string", "size": 50, "required": True},
        {"key": "markdown_file_id", "type": "string", "size": 50, "required": True},
        {"key": "version", "type": "string", "size": 10, "required": True, "default": "1"},
        {"key": "sow_version", "type": "string", "size": 10, "required": False},
        {"key": "token_usage", "type": "integer", "required": False},
        {"key": "cost_usd", "type": "float", "required": False},
        {"key": "workspace_path", "type": "string", "size": 200, "required": False},
        {"key": "generation_timestamp", "type": "datetime", "required": True}
    ]

    for attr in attributes:
        await create_appwrite_attribute(
            database_id="default",
            collection_id="revision_notes",
            **attr,
            mcp_config_path=mcp_config_path
        )

    # Create indexes
    await create_appwrite_index(
        database_id="default",
        collection_id="revision_notes",
        key="course_lesson_unique",
        type="unique",
        attributes=["courseId", "noteType", "lessonOrder"],
        mcp_config_path=mcp_config_path
    )

    await create_appwrite_index(
        database_id="default",
        collection_id="revision_notes",
        key="by_course",
        type="key",
        attributes=["courseId"],
        mcp_config_path=mcp_config_path
    )
```

**Execution**: Run as part of initial deployment before first agent execution.

### Storage Bucket Creation Script

```python
async def create_documents_storage_bucket(mcp_config_path):
    """Create 'documents' storage bucket in Appwrite for markdown files."""

    # Check if bucket exists
    try:
        await get_appwrite_bucket(
            bucket_id="documents",
            mcp_config_path=mcp_config_path
        )
        logger.info("✓ 'documents' bucket already exists")
        return
    except Exception:
        logger.info("Creating 'documents' bucket...")

    # Create bucket
    await create_appwrite_bucket(
        bucket_id="documents",
        name="Documents",
        permissions=[
            "read(\"any\")",  # Any authenticated user can read
            "create(\"role:admin\")",
            "update(\"role:admin\")",
            "delete(\"role:admin\")"
        ],
        file_security=True,  # Enable file-level permissions
        enabled=True,
        maximum_file_size=50 * 1024 * 1024,  # 50 MB
        allowed_file_extensions=[".md", ".txt"],
        compression="gzip",  # Optional compression
        encryption=True,  # At-rest encryption
        antivirus=True,  # Scan on upload
        mcp_config_path=mcp_config_path
    )

    logger.info("✓ Created 'documents' bucket")
```

**Execution**: Run as one-time setup before first agent execution (similar to collection creation).

---

## Appendix: Sample Documents

### Sample RevisionNote Document (cheat_sheet)

```json
{
  "$id": "revision_notes_course_c84874_cheat_sheet",
  "courseId": "course_c84874",
  "noteType": "cheat_sheet",
  "lessonOrder": null,
  "status": "published",
  "execution_id": "20251109_143052",
  "markdown_file_id": "file_abc123xyz789",
  "version": "1",
  "sow_version": "1",
  "token_usage": 45230,
  "cost_usd": 1.35,
  "workspace_path": "/tmp/workspace_20251109_143052",
  "generation_timestamp": "2025-11-09T14:32:15.000Z",
  "$createdAt": "2025-11-09T14:32:16.000Z",
  "$updatedAt": "2025-11-09T14:32:16.000Z"
}
```

### Sample RevisionNote Document (lesson_note)

```json
{
  "$id": "revision_notes_course_c84874_lesson_03",
  "courseId": "course_c84874",
  "noteType": "lesson_note",
  "lessonOrder": 3,
  "status": "published",
  "execution_id": "20251109_143052",
  "markdown_file_id": "file_def456uvw012",
  "version": "1",
  "sow_version": "1",
  "token_usage": 3420,
  "cost_usd": 0.12,
  "workspace_path": null,
  "generation_timestamp": "2025-11-09T14:30:45.000Z",
  "$createdAt": "2025-11-09T14:32:17.000Z",
  "$updatedAt": "2025-11-09T14:32:17.000Z"
}
```
