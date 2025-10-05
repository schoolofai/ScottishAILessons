# SOW Seeding Architecture

> **System design, data model, and architectural patterns**

## Table of Contents

- [System Overview](#system-overview)
- [Data Model Architecture](#data-model-architecture)
- [Seeding Pipeline](#seeding-pipeline)
- [Key Design Patterns](#key-design-patterns)
- [Driver Pattern](#driver-pattern)
- [Integration Points](#integration-points)

## System Overview

The SOW Seeding Infrastructure is a multi-phase data processing system that transforms Scheme of Work (SOW) data from the `sow_author_agent` into a validated, referentially-integrated database structure.

### Design Principles

1. **Referential Integrity First**: All foreign key relationships are validated before data insertion
2. **Idempotent Operations**: Scripts can be run multiple times without creating duplicates
3. **Fail-Fast Validation**: Invalid data is caught early with actionable error messages
4. **Deterministic Lookups**: Stable keys enable predictable upsert behavior
5. **No Fallback Anti-Pattern**: Explicit exceptions instead of silent failures

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      Data Sources                               │
├─────────────────────────────────────────────────────────────────┤
│  SQA Education Database  │  SOW Author Agent  │  Resource Packs │
│  (sqa_current)          │  (sow_authored_*.json) │  (research_pack) │
└──────────┬───────────────┴────────────┬──────────┴──────────────┘
           │                            │
           ▼                            ▼
  ┌──────────────────┐       ┌────────────────────────┐
  │ extractSQAOutcomes│       │  SOW JSON Files        │
  │ migrateCourseOutcomes │   │  (sow_authored_*.json) │
  └────────┬─────────┘       └──────────┬─────────────┘
           │                            │
           ▼                            ▼
  ┌─────────────────────────────────────────────────────┐
  │          Appwrite Database Collections               │
  ├──────────────────┬──────────────────┬───────────────┤
  │ course_outcomes  │ lesson_templates │ Authored_SOW  │
  │ (source of truth)│ (placeholders)   │ (SOW entries) │
  └──────────────────┴──────────────────┴───────────────┘
           │                            │
           └────────────┬───────────────┘
                        ▼
            ┌─────────────────────────┐
            │  Future: Lesson Author  │
            │  Populates templates    │
            └─────────────────────────┘
```

## Data Model Architecture

### Collection Relationships

The database uses a 6-collection architecture with `course_outcomes` as the source of truth for all outcome references.

```
course_outcomes (Source of Truth)
       │
       │ Referenced by document IDs
       │
       ├──────────────────┬──────────────────┬────────────────┐
       │                  │                  │                │
       ▼                  ▼                  ▼                ▼
lesson_templates     MasteryV2         Routine          SOWV2
  outcomeRefs:      emaByOutcome:    dueAtByOutcome:   templates:
  ["6745abc..."]    {"6745abc": 0.8} {"6745abc": "..."} ["6745xyz..."]
       │
       │ Referenced by template IDs
       │
       ▼
  Authored_SOW
    entries[].lessonTemplateRef: "6745xyz..."
```

### Collection Details

#### 1. course_outcomes (Foundation)

**Purpose**: Single source of truth for all course outcomes

**Key Fields**:
```typescript
{
  $id: string,                    // Document ID (used as foreign key)
  courseId: string,               // e.g., "course_c84473"
  outcomeId: string,              // Logical ID: "O1", "O2", etc.
  outcomeTitle: string,           // "Analyse an everyday situation..."
  unitCode: string,               // "HV7Y 73"
  assessmentStandards: string,    // "AS1.1, AS1.2"
  teacherGuidance: string,
  keywords: string[]              // JSON array
}
```

**Indexes**:
- `courseId + outcomeId` (for mapping logical IDs to document IDs)
- `courseId` (for listing all outcomes)

#### 2. lesson_templates (Placeholders → Populated)

**Purpose**: Stores lesson content, initially empty placeholders, later populated by lesson_author agent

**Key Fields**:
```typescript
{
  $id: string,                    // Document ID
  courseId: string,
  sow_order: number,              // ★ Deterministic lookup key
  title: string,
  outcomeRefs: string,            // JSON: ["6745abc...", "6745def..."]
  cards: string,                  // JSON: [] initially, populated later
  lesson_type: string,            // "teach", "formative_assessment", etc.
  estMinutes: number,
  engagement_tags: string,        // JSON array
  policy: string,                 // JSON object
  version: number,
  status: string,
  createdBy: string               // "sow_author_agent" or "lesson_author_agent"
}
```

**Upsert Pattern**:
```typescript
// PRIMARY: Deterministic lookup
Query.equal('courseId', courseId),
Query.equal('sow_order', sowOrder)

// FALLBACK: Migration support (deprecated)
Query.equal('courseId', courseId),
Query.equal('title', title)
```

#### 3. Authored_SOW (SOW Management)

**Purpose**: Stores versioned Scheme of Work with entries referencing lesson templates

**Key Fields**:
```typescript
{
  $id: string,
  courseId: string,
  version: string,                // "1", "2", etc.
  status: string,                 // "draft" | "published" | "archived"
  entries: string,                // JSON: AuthoredSOWEntry[]
  metadata: string,               // JSON: AuthoredSOWMetadata
  accessibility_notes: string
}
```

**Upsert Pattern**:
```typescript
Query.equal('courseId', courseId),
Query.equal('version', version)
```

**Entry Structure** (within entries JSON):
```typescript
{
  order: number,                  // Sequence in SOW
  lessonTemplateRef: string,      // FK: lesson_templates.$id
  label: string,                  // "Introduction to Numeracy Skills"
  lesson_type: string,
  outcomeRefs: string[],          // Logical IDs: ["O1", "O2"]
  assessmentStandardRefs: string[],
  pedagogical_blocks: string[],
  estMinutes: number,
  notes: string
}
```

## Seeding Pipeline

### 4-Phase Process

```
Phase 0: Validate Outcome References
         │
         ├─> Query course_outcomes for each outcomeRef
         ├─> Fail if any missing (fast-fail)
         └─> ✅ All outcomes exist
         │
         ▼
Phase 1: Create Lesson Template Placeholders
         │
         ├─> For each SOW entry:
         │    ├─> Map outcomeRefs to document IDs
         │    ├─> Query existing by courseId + sow_order
         │    ├─> CREATE new or UPDATE existing
         │    └─> Store mapping: AUTO_TBD_1 → real_doc_id
         │
         └─> ✅ All placeholders created/updated
         │
         ▼
Phase 2: Update SOW Entries with Real Template IDs
         │
         ├─> Replace AUTO_TBD_* with real document IDs
         └─> ✅ All entries linked to templates
         │
         ▼
Phase 3: Upsert Authored_SOW
         │
         ├─> Query existing by courseId + version
         ├─> CREATE new or UPDATE existing
         └─> ✅ SOW document persisted
         │
         ▼
Phase 4: Post-Seeding Validation
         │
         ├─> Uniqueness: All template IDs distinct
         ├─> Existence: All templates findable
         ├─> Title Matching: SOW labels match template titles
         └─> ✅ Data integrity verified
```

### Phase Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│ INPUT: sow_authored_AOM_nat3.json                        │
│ {                                                        │
│   courseId: "course_c84473",                             │
│   entries: [                                             │
│     {                                                    │
│       order: 1,                                          │
│       lessonTemplateRef: "AUTO_TBD_1",  ← Placeholder   │
│       outcomeRefs: ["O1"],              ← Logical IDs   │
│       ...                                                │
│     }                                                    │
│   ]                                                      │
│ }                                                        │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Phase 0: Validation    │
        │ outcomeRefs exist?     │
        └────────┬───────────────┘
                 │ ✅ Valid
                 ▼
    ┌────────────────────────────────┐
    │ Phase 1: Template Creation     │
    │ Map O1 → 6745abc...            │
    │ Create/Update lesson_templates │
    │ Return: AUTO_TBD_1 → 6745xyz..│
    └────────┬───────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────┐
  │ Phase 2: Entry Updates               │
  │ lessonTemplateRef: AUTO_TBD_1        │
  │           ↓                          │
  │ lessonTemplateRef: "6745xyz..."      │
  └────────┬─────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ Phase 3: Authored_SOW Upsert           │
│ {                                      │
│   courseId: "course_c84473",           │
│   entries: JSON.stringify([            │
│     {                                  │
│       lessonTemplateRef: "6745xyz...", │ ← Real ID
│       ...                              │
│     }                                  │
│   ])                                   │
│ }                                      │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ Phase 4: Validation            │
│ ✅ Uniqueness                  │
│ ✅ Existence                   │
│ ✅ Title Matching              │
└────────────────────────────────┘
```

## Key Design Patterns

### 1. Deterministic Upsert Pattern

**Problem**: Re-running seeding scripts creates duplicate data.

**Solution**: Use stable, business-level keys for lookup before create/update decision.

```typescript
// ❌ WRONG: Using title (can change)
Query.equal('title', 'Introduction to Numeracy Skills')

// ✅ CORRECT: Using courseId + sow_order (stable)
Query.equal('courseId', 'course_c84473'),
Query.equal('sow_order', 1)
```

**Why sow_order?**
- Assigned by SOW author agent during generation
- Represents sequence in Scheme of Work
- Stable even if lesson title changes
- Unique within a course

**Implementation**:
```typescript
async function createOrUpdateLessonTemplates() {
  // Try PRIMARY lookup
  let existing = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', courseId),
      Query.equal('sow_order', entry.order),
      Query.limit(1)
    ]
  );

  // MIGRATION FALLBACK: For old templates without sow_order
  if (existing.documents.length === 0) {
    existing = await databases.listDocuments(
      'default',
      'lesson_templates',
      [
        Query.equal('courseId', courseId),
        Query.equal('title', entry.label),
        Query.limit(1)
      ]
    );
  }

  if (existing.documents.length > 0) {
    // UPDATE existing
    await databases.updateDocument(..., existing.documents[0].$id, ...);
  } else {
    // CREATE new
    await databases.createDocument(...);
  }
}
```

### 2. Reference Map Pattern

**Problem**: Need to track transformations from placeholder IDs to real document IDs.

**Solution**: Build an in-memory Map during template creation phase.

```typescript
const referenceMap = new Map<string, string>();

// During Phase 1 (template creation)
for (const entry of sowEntries) {
  const oldRef = entry.lessonTemplateRef;  // "AUTO_TBD_1"
  const templateDoc = await createOrUpdate(...);
  const realId = templateDoc.$id;           // "6745abc123def..."

  referenceMap.set(oldRef, realId);
}

// During Phase 2 (entry updates)
const updatedEntries = entries.map(entry => ({
  ...entry,
  lessonTemplateRef: referenceMap.get(entry.lessonTemplateRef)!
}));
```

**Benefits**:
- O(1) lookup performance
- Explicit placeholder → real ID mapping
- Easy to debug with Map.entries()

### 3. Outcome ID Mapping Pattern

**Problem**: SOW data uses logical IDs (`"O1"`), database uses document IDs (`"6745abc..."`).

**Solution**: Query course_outcomes to map logical → document IDs.

```typescript
async function mapOutcomeIdsToDocumentIds(
  databases: Databases,
  outcomeIds: string[],    // ["O1", "O2"]
  courseId: string
): Promise<string[]> {
  const documentIds: string[] = [];

  for (const outcomeId of outcomeIds) {
    const result = await databases.listDocuments(
      'default',
      'course_outcomes',
      [
        Query.equal('courseId', courseId),
        Query.equal('outcomeId', outcomeId),
        Query.limit(1)
      ]
    );

    if (result.documents.length === 0) {
      throw new Error(`Outcome ${outcomeId} not found`);  // Fail-fast
    }

    documentIds.push(result.documents[0].$id);
  }

  return documentIds;  // ["6745abc...", "6745def..."]
}
```

**Usage**:
```typescript
// Input: SOW entry with outcomeRefs: ["O1", "O2"]
const outcomeDocumentIds = await mapOutcomeIdsToDocumentIds(
  databases,
  entry.outcomeRefs,
  courseId
);

// Store in lesson_templates.outcomeRefs as JSON
const templateData = {
  outcomeRefs: JSON.stringify(outcomeDocumentIds)  // ["6745abc...", ...]
};
```

### 4. JSON Stringification Pattern

**Problem**: Appwrite stores complex types (arrays, objects) as JSON strings.

**Solution**: Explicit JSON.stringify when writing, JSON.parse when reading.

```typescript
// ✅ WRITING to Appwrite
const templateData = {
  outcomeRefs: JSON.stringify(["6745abc...", "6745def..."]),
  cards: JSON.stringify([{ card_type: "CFU", ... }]),
  engagement_tags: JSON.stringify(["budgeting", "personal_finance"])
};

await databases.createDocument(..., templateData);

// ✅ READING from Appwrite
const template = await databases.getDocument(...);
const outcomeRefs = JSON.parse(template.outcomeRefs);  // string[] type
const cards = JSON.parse(template.cards);              // LessonCard[] type
```

**Why not automatic?**
- Appwrite doesn't support nested JSON types natively
- Explicit stringification prevents silent type coercion
- TypeScript types align with storage format

**Collections using JSON stringification**:
- `Authored_SOW.entries`
- `Authored_SOW.metadata`
- `lesson_templates.outcomeRefs`
- `lesson_templates.cards`
- `lesson_templates.engagement_tags`
- `lesson_templates.policy`

### 5. Fail-Fast Validation Pattern

**Problem**: Invalid data discovered late wastes time and corrupts database.

**Solution**: Validate all references BEFORE any database writes (Phase 0).

```typescript
// Phase 0: Run BEFORE any writes
async function validateOutcomeReferences() {
  const allOutcomeIds = new Set<string>();
  entries.forEach(entry => {
    entry.outcomeRefs.forEach(id => allOutcomeIds.add(id));
  });

  const invalidRefs: string[] = [];

  for (const outcomeId of allOutcomeIds) {
    const result = await databases.listDocuments(..., [
      Query.equal('courseId', courseId),
      Query.equal('outcomeId', outcomeId)
    ]);

    if (result.documents.length === 0) {
      invalidRefs.push(outcomeId);
    }
  }

  if (invalidRefs.length > 0) {
    throw new Error(
      `Invalid outcome references:\n` +
      invalidRefs.map(id => `  - ${id}`).join('\n') +
      `\n\n💡 Run migrateCourseOutcomes.ts first`
    );
  }
}
```

**Benefits**:
- No partial writes on validation failure
- Clear error messages with actionable fixes
- Prevents orphaned references

## Driver Pattern

### Inheritance Hierarchy

```
BaseDriver (abstract)
    │
    ├── ServerBaseDriver (server-side with admin API key)
    │     │
    │     └── ServerAuthoredSOWDriver
    │
    └── AuthoredSOWDriver (client-side with user permissions)
```

### BaseDriver (Abstract)

Provides common CRUD operations for all Appwrite collections.

```typescript
abstract class BaseDriver {
  protected databases: Databases;

  protected async list<T>(collection: string, queries: string[]): Promise<T[]>
  protected async get<T>(collection: string, docId: string): Promise<T>
  protected async create<T>(collection: string, data: any, permissions: string[]): Promise<T>
  protected async update<T>(collection: string, docId: string, data: any): Promise<T>
  protected async delete(collection: string, docId: string): Promise<void>
  protected handleError(error: any, operation: string): Error
}
```

### ServerAuthoredSOWDriver

Used by seeding scripts with admin API key authentication.

```typescript
class ServerAuthoredSOWDriver extends ServerBaseDriver {
  async upsertAuthoredSOW(data: AuthoredSOWData): Promise<AuthoredSOW> {
    const existing = await this.getByCoruseAndVersion(data.courseId, data.version);

    if (existing) {
      return await this.updateAuthoredSOW(existing.$id, data);
    }

    // Admin client doesn't need permissions array
    return await this.create<AuthoredSOW>(
      'Authored_SOW',
      {
        courseId: data.courseId,
        version: data.version,
        status: data.status,
        entries: JSON.stringify(data.entries),    // JSON stringification
        metadata: JSON.stringify(data.metadata),
        accessibility_notes: data.accessibility_notes || ''
      },
      []  // Empty permissions - admin key has full access
    );
  }
}
```

**Key Differences from Client Driver**:
- Uses `node-appwrite` instead of `appwrite`
- Requires `APPWRITE_API_KEY` environment variable
- No permissions array needed (admin bypasses ACL)
- Can create/update documents for any user

## Integration Points

### 1. SQA Education Database

**Source**: PostgreSQL database with SQA course specifications

**Integration**:
```
sqa_education.sqa_current
         ↓
extractSQAOutcomes.ts
         ↓
course_outcomes_import.json
         ↓
migrateCourseOutcomes.ts
         ↓
course_outcomes (Appwrite)
```

### 2. SOW Author Agent

**Source**: LangGraph agent that generates Scheme of Work

**Integration**:
```
LangGraph: sow_author_agent
         ↓
sow_authored_AOM_nat3.json
         ↓
seedAuthoredSOW.ts
         ↓
Authored_SOW + lesson_templates (Appwrite)
```

### 3. Lesson Author Agent (Future)

**Source**: LangGraph agent that generates lesson content

**Planned Integration**:
```
Authored_SOW (read entry)
         +
Resource Pack (research_pack_json_AOM_nat3.txt)
         ↓
LangGraph: lesson_author_agent
         ↓
seedAuthoredLesson.ts
         ↓
lesson_templates.cards (populated)
```

**Key Points**:
- Uses existing lesson_templates created by seedAuthoredSOW.ts
- Upserts using same deterministic pattern (courseId + sow_order)
- Populates `cards` field with generated content
- Maintains referential integrity with outcomes

## Future Enhancements

### 1. Batch Processing

```typescript
// Generate all lessons for a course in one command
npm run seed:authored-lessons course_c84473
```

### 2. Version Management

```typescript
// Support multiple SOW versions
await sowDriver.upsertAuthoredSOW({
  courseId: "course_c84473",
  version: "3",  // New version
  status: "draft"
});

// Publish version
await sowDriver.publishVersion("course_c84473", "3");
```

### 3. Incremental Updates

```typescript
// Only re-seed changed entries
const changedEntries = detectChanges(oldSOW, newSOW);
await updateLessonTemplates(changedEntries);
```

### 4. Parallel Execution

```typescript
// Process multiple courses concurrently
await Promise.all([
  seedAuthoredSOW("course_c84473"),
  seedAuthoredSOW("course_h22573"),
  seedAuthoredSOW("course_h22474")
]);
```

---

**Next**: See [seeding-scripts-reference.md](./seeding-scripts-reference.md) for detailed script API documentation.
