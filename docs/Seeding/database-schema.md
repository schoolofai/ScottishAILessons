# Database Schema Reference

> **Complete collection structures, fields, and patterns**

## Table of Contents

- [Collections Overview](#collections-overview)
- [Authored_SOW Collection](#authored_sow-collection)
- [lesson_templates Collection](#lesson_templates-collection)
- [course_outcomes Collection](#course_outcomes-collection)
- [JSON Stringification Pattern](#json-stringification-pattern)
- [Indexes and Queries](#indexes-and-queries)

## Collections Overview

### Relationship Diagram

```
course_outcomes (Source of Truth)
       │
       │ Referenced by document IDs
       ├─────────────────┬──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
lesson_templates    MasteryV2         Routine
  outcomeRefs:      emaByOutcome:    dueAtByOutcome:
  ["6745abc..."]    {"6745abc": 0.8} {"6745abc": "..."}
       │
       │ Referenced by template IDs
       ▼
  Authored_SOW
    entries[].lessonTemplateRef: "6745xyz..."
```

### Collection Dependencies

**Seeding Order**:
1. `course_outcomes` ← Must exist first
2. `lesson_templates` ← References outcomes
3. `Authored_SOW` ← References templates

## Authored_SOW Collection

**Purpose**: Stores versioned Scheme of Work with entries referencing lesson templates.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$id` | string | Auto | Document ID |
| `$createdAt` | string | Auto | ISO 8601 timestamp |
| `$updatedAt` | string | Auto | ISO 8601 timestamp |
| `courseId` | string | ✅ | Course identifier (e.g., `"course_c84473"`) |
| `version` | string | ✅ | Version number (`"1"`, `"2"`, etc.) |
| `status` | string | ✅ | `"draft"` \| `"published"` \| `"archived"` |
| `entries` | string | ✅ | JSON array of `AuthoredSOWEntry[]` |
| `metadata` | string | ✅ | JSON object with SOW metadata |
| `accessibility_notes` | string | ❌ | Plain text accessibility guidance |

### Upsert Pattern

```typescript
// Deterministic lookup
const existing = await databases.listDocuments(
  'default',
  'Authored_SOW',
  [
    Query.equal('courseId', 'course_c84473'),
    Query.equal('version', '2'),
    Query.limit(1)
  ]
);

if (existing.documents.length > 0) {
  // UPDATE
  await databases.updateDocument('default', 'Authored_SOW', existing.documents[0].$id, data);
} else {
  // CREATE
  await databases.createDocument('default', 'Authored_SOW', ID.unique(), data);
}
```

### entries Field Structure

Stored as JSON string, parsed as `AuthoredSOWEntry[]`:

```typescript
interface AuthoredSOWEntry {
  order: number;                    // Sequence in SOW
  lessonTemplateRef: string;        // FK: lesson_templates.$id
  label: string;                    // "Introduction to Numeracy Skills"
  lesson_type: string;              // "teach" | "formative_assessment" | etc.
  coherence: {                      // Pedagogical coherence info
    unit: string;
    block_name: string;
    block_index: string;
    prerequisites: string[];
  };
  policy: {                         // Assessment policy
    calculator_section: string;
    assessment_notes: string;
  };
  engagement_tags: string[];        // ["budgeting", "personal_finance"]
  outcomeRefs: string[];            // Logical IDs: ["O1", "O2"]
  assessmentStandardRefs: string[]; // ["AS1.1", "AS1.2"]
  pedagogical_blocks: string[];     // ["starter", "modelling", ...]
  accessibility_profile: {
    dyslexia_friendly: boolean;
    plain_language_level: string;
    extra_time: boolean;
  };
  estMinutes: number;               // Estimated duration
  notes: string;                    // Additional notes
}
```

**Example**:
```json
{
  "order": 1,
  "lessonTemplateRef": "6745abc123def456...",
  "label": "Introduction to Numeracy Skills",
  "lesson_type": "teach",
  "coherence": {
    "unit": "Numeracy (National 3)",
    "block_name": "Core Skills: Notation and Units",
    "block_index": "1.1",
    "prerequisites": []
  },
  "policy": {
    "calculator_section": "non_calc",
    "assessment_notes": "Focus on understanding place value"
  },
  "engagement_tags": ["foundations", "notation"],
  "outcomeRefs": ["O1"],
  "assessmentStandardRefs": ["AS1.1"],
  "pedagogical_blocks": ["starter", "modelling", "guided_practice"],
  "accessibility_profile": {
    "dyslexia_friendly": true,
    "plain_language_level": "CEFR_A2",
    "extra_time": true
  },
  "estMinutes": 50,
  "notes": "Introduce core mathematical symbols..."
}
```

### metadata Field Structure

Stored as JSON string:

```typescript
interface AuthoredSOWMetadata {
  course_name: string;
  level: string;
  total_lessons: number;
  total_estimated_minutes: number;
  generated_at: string;              // ISO 8601
  author_agent_version: string;
  coherence: {
    policy_notes: string[];
    sequencing_notes: string[];
  };
  accessibility_notes: string[];
  engagement_notes: string[];
  weeks: number;
  periods_per_week: number;
}
```

## lesson_templates Collection

**Purpose**: Stores lesson content. Initially created as placeholders, later populated by lesson_author agent.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$id` | string | Auto | Document ID |
| `$createdAt` | string | Auto | ISO 8601 timestamp |
| `$updatedAt` | string | Auto | ISO 8601 timestamp |
| `courseId` | string | ✅ | Course identifier |
| `sow_order` | number | ✅ | **Deterministic lookup key** |
| `title` | string | ✅ | Lesson title |
| `outcomeRefs` | string | ✅ | JSON array of outcome document IDs |
| `cards` | string | ✅ | JSON array of `LessonCard[]` (empty initially) |
| `version` | number | ✅ | Template version number |
| `status` | string | ✅ | `"draft"` \| `"published"` \| `"archived"` |
| `createdBy` | string | ✅ | `"sow_author_agent"` or `"lesson_author_agent"` |
| `lesson_type` | string | ❌ | `"teach"`, `"formative_assessment"`, etc. |
| `estMinutes` | number | ❌ | Estimated duration |
| `engagement_tags` | string | ❌ | JSON array of context tags |
| `policy` | string | ❌ | JSON object with assessment policy |

### Upsert Pattern

```typescript
// PRIMARY: Deterministic lookup
let existing = await databases.listDocuments(
  'default',
  'lesson_templates',
  [
    Query.equal('courseId', courseId),
    Query.equal('sow_order', 1),
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
      Query.equal('title', 'Introduction to Numeracy Skills'),
      Query.limit(1)
    ]
  );
}
```

**Why sow_order is Key**:
- Assigned by SOW author agent during generation
- Stable even if lesson title changes
- Unique within a course
- Enables predictable upsert behavior

### outcomeRefs Field Structure

Stored as JSON string, parsed as `string[]` (array of course_outcomes document IDs):

```typescript
// Stored in database
outcomeRefs: '["6745abc123def...", "6745def456ghi..."]'

// After JSON.parse
outcomeRefs: ["6745abc123def...", "6745def456ghi..."]
```

**NOT logical IDs** (`"O1"`, `"O2"`), but **real document IDs**.

### cards Field Structure

Stored as JSON string, parsed as `LessonCard[]`:

```typescript
interface LessonCard {
  card_type: string;       // "CFU" (Check For Understanding)
  header: string;          // Card title
  content: string;         // Main content (may include LaTeX)
  // Additional fields depending on card_type
}
```

**Empty Initially**:
```typescript
cards: '[]'  // Created by seedAuthoredSOW.ts
```

**Populated Later**:
```typescript
cards: '[{"card_type": "CFU", "header": "Calculating Weekly Wages", "content": "A part-time job..."}]'
// Populated by seedAuthoredLesson.ts → lesson_author agent
```

## course_outcomes Collection

**Purpose**: Source of truth for all course outcomes with SQA-aligned structure.

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$id` | string | Auto | **Document ID (used as foreign key everywhere)** |
| `$createdAt` | string | Auto | ISO 8601 timestamp |
| `$updatedAt` | string | Auto | ISO 8601 timestamp |
| `courseId` | string | ✅ | Course identifier |
| `courseSqaCode` | string | ✅ | SQA course code (e.g., `"C844 73"`) |
| `unitCode` | string | ✅ | SQA unit code (e.g., `"HV7Y 73"`) |
| `unitTitle` | string | ✅ | Unit title |
| `scqfCredits` | number | ✅ | SCQF credit value |
| `outcomeId` | string | ✅ | Logical outcome ID (`"O1"`, `"O2"`, etc.) |
| `outcomeTitle` | string | ✅ | Outcome description |
| `assessmentStandards` | string | ✅ | Assessment standards (e.g., `"AS1.1, AS1.2"`) |
| `teacherGuidance` | string | ❌ | Teaching guidance notes |
| `keywords` | string | ❌ | JSON array of keywords |

### Lookup Pattern

**Map Logical ID → Document ID**:
```typescript
const result = await databases.listDocuments(
  'default',
  'course_outcomes',
  [
    Query.equal('courseId', 'course_c84473'),
    Query.equal('outcomeId', 'O1'),
    Query.limit(1)
  ]
);

const documentId = result.documents[0].$id;  // "6745abc123def..."
```

## JSON Stringification Pattern

### Why JSON Stringification?

Appwrite doesn't natively support nested JSON types. Complex fields (arrays, objects) must be stored as JSON strings.

### Collections Using JSON Stringification

| Collection | Fields |
|------------|--------|
| `Authored_SOW` | `entries`, `metadata` |
| `lesson_templates` | `outcomeRefs`, `cards`, `engagement_tags`, `policy` |
| `course_outcomes` | `keywords` |

### Writing Pattern

```typescript
const templateData = {
  outcomeRefs: JSON.stringify(["6745abc...", "6745def..."]),
  cards: JSON.stringify([{ card_type: "CFU", ... }]),
  engagement_tags: JSON.stringify(["budgeting", "personal_finance"])
};

await databases.createDocument('default', 'lesson_templates', ID.unique(), templateData);
```

### Reading Pattern

```typescript
const template = await databases.getDocument('default', 'lesson_templates', docId);

const outcomeRefs: string[] = JSON.parse(template.outcomeRefs);
const cards: LessonCard[] = JSON.parse(template.cards);
const tags: string[] = JSON.parse(template.engagement_tags);
```

### TypeScript Types

```typescript
// Database schema (stored)
interface LessonTemplateDB {
  $id: string;
  courseId: string;
  sow_order: number;
  outcomeRefs: string;  // JSON string
  cards: string;        // JSON string
}

// Application schema (parsed)
interface LessonTemplate {
  $id: string;
  courseId: string;
  sow_order: number;
  outcomeRefs: string[];      // Parsed array
  cards: LessonCard[];        // Parsed array
}
```

## Indexes and Queries

### Recommended Indexes

**Authored_SOW**:
- `courseId + version` (upsert lookup)
- `courseId + status` (published version queries)

**lesson_templates**:
- `courseId + sow_order` (deterministic upsert)
- `courseId + title` (migration fallback)
- `courseId + status` (published templates)

**course_outcomes**:
- `courseId + outcomeId` (outcome ID mapping)
- `courseId` (list all outcomes for course)

### Common Query Patterns

**Get Published SOW**:
```typescript
const sows = await databases.listDocuments('default', 'Authored_SOW', [
  Query.equal('courseId', courseId),
  Query.equal('status', 'published'),
  Query.orderDesc('version'),
  Query.limit(1)
]);
```

**Get Template by Order**:
```typescript
const templates = await databases.listDocuments('default', 'lesson_templates', [
  Query.equal('courseId', courseId),
  Query.equal('sow_order', 1),
  Query.limit(1)
]);
```

**Map Outcome ID**:
```typescript
const outcomes = await databases.listDocuments('default', 'course_outcomes', [
  Query.equal('courseId', courseId),
  Query.equal('outcomeId', 'O1'),
  Query.limit(1)
]);
const documentId = outcomes.documents[0].$id;
```

---

**Next**: See [step-by-step-guide.md](./step-by-step-guide.md) for detailed execution walkthrough.
