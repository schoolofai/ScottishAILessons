# Seeding Scripts Reference

> **Detailed API documentation for all seeding scripts**

## Table of Contents

- [seedAuthoredSOW.ts](#seedauthoredsowts)
- [migrateCourseOutcomes.ts](#migratecourseoutcomests)
- [seed-clean-data.ts](#seed-clean-datats-deprecated)
- [Future: seedAuthoredLesson.ts](#future-seedauthoredlessonts)

## seedAuthoredSOW.ts

**Location**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`

**Purpose**: Seeds Authored_SOW collection with SOW data from sow_author_agent, creating lesson template placeholders with validated outcome references.

**Command**:
```bash
npm run seed:authored-sow
```

**Prerequisites**:
1. `course_outcomes` collection populated (run `migrateCourseOutcomes.ts` first)
2. SOW JSON file exists at `../../langgraph-author-agent/data/sow_authored_AOM_nat3.json`
3. Environment variables configured in `.env.local`

### Main Function

```typescript
async function seedAuthoredSOW(): Promise<void>
```

Orchestrates the 4-phase seeding process.

**Execution Flow**:
1. Validates environment variables
2. Creates admin client and driver
3. Reads SOW JSON file
4. Executes 4-phase pipeline
5. Reports summary

**Exit Codes**:
- `0`: Success
- `1`: Validation failure, missing prerequisites, or database error

### Core Functions

#### validateOutcomeReferences

```typescript
async function validateOutcomeReferences(
  databases: Databases,
  entries: AuthoredSOWEntry[],
  courseId: string
): Promise<void>
```

**Phase**: 0 (Pre-validation)

**Purpose**: Validates all outcome references exist before any database writes.

**Process**:
1. Collects all unique `outcomeRefs` from SOW entries
2. Queries `course_outcomes` for each `outcomeId`
3. Throws error if any outcomes missing

**Example Output**:
```
🔍 Validating outcome references...

   Found 12 unique outcome references

  ✅ O1: Analyse an everyday situation involving money
  ✅ O2: Carry out calculations involving money
  ...
  ✅ All 12 outcome references validated
```

**Error Example**:
```
❌ Invalid outcome references found:
  - O5
  - O7

💡 Please ensure course_outcomes collection has been populated with migrateCourseOutcomes.ts
```

#### mapOutcomeIdsToDocumentIds

```typescript
async function mapOutcomeIdsToDocumentIds(
  databases: Databases,
  outcomeIds: string[],      // ["O1", "O2"]
  courseId: string
): Promise<string[]>          // ["6745abc...", "6745def..."]
```

**Purpose**: Maps logical outcome IDs to course_outcomes document IDs.

**Process**:
1. For each `outcomeId`, queries `course_outcomes` with:
   - `Query.equal('courseId', courseId)`
   - `Query.equal('outcomeId', outcomeId)`
2. Extracts `$id` from result
3. Returns array of document IDs

**Usage**:
```typescript
const outcomeDocumentIds = await mapOutcomeIdsToDocumentIds(
  databases,
  ["O1", "O2", "O3"],
  "course_c84473"
);
// Returns: ["6745abc123...", "6745def456...", "6745ghi789..."]
```

#### createOrUpdateLessonTemplates

```typescript
async function createOrUpdateLessonTemplates(
  databases: Databases,
  entries: AuthoredSOWEntry[],
  courseId: string
): Promise<Map<string, string>>  // Maps: "AUTO_TBD_1" → "6745xyz..."
```

**Phase**: 1

**Purpose**: Creates or updates lesson template placeholders.

**Process** (for each entry):
1. Maps `outcomeRefs` to document IDs
2. Queries existing by `courseId + sow_order` (PRIMARY)
3. Falls back to `courseId + title` (MIGRATION)
4. Updates existing or creates new template
5. Stores mapping: `oldRef → documentId`

**Template Data Structure**:
```typescript
{
  title: entry.label,
  courseId: courseId,
  sow_order: entry.order,             // Deterministic key
  outcomeRefs: JSON.stringify([...]), // Real document IDs
  cards: JSON.stringify([]),           // Empty placeholder
  version: 1,
  status: 'draft',
  createdBy: 'sow_author_agent',
  lesson_type: entry.lesson_type || 'teach',
  estMinutes: entry.estMinutes || 50,
  engagement_tags: JSON.stringify(entry.engagement_tags || []),
  policy: JSON.stringify(entry.policy || {})
}
```

**Example Output**:
```
📝 Creating lesson template placeholders...
   Total entries to process: 48

  ✅ Created #1: Introduction to Numeracy Skills (6745abc...)
  ✅ Updated #2: Check-in: Notation and Units (6745def...)
  ...

📊 Template Creation Summary:
   Created: 45
   Updated: 3
   Total: 48
```

**Return Value**:
```typescript
Map {
  "AUTO_TBD_1" => "6745abc123def...",
  "AUTO_TBD_2" => "6745def456ghi...",
  ...
}
```

#### updateEntriesWithTemplateRefs

```typescript
async function updateEntriesWithTemplateRefs(
  entries: AuthoredSOWEntry[],
  referenceMap: Map<string, string>
): Promise<AuthoredSOWEntry[]>
```

**Phase**: 2

**Purpose**: Replaces placeholder template IDs with real document IDs.

**Process**:
1. For each entry, looks up `lessonTemplateRef` in `referenceMap`
2. Replaces placeholder with real document ID
3. Returns updated entries array

**Example Output**:
```
🔗 Updating Authored_SOW entries with real template IDs...

  #  1. Introduction to Numeracy Ski... AUTO_TBD_1      → 6745abc123def...
  #  2. Check-in: Notation and Units    AUTO_TBD_2      → 6745def456ghi...
  ...

✅ 48 entries updated with real template IDs
```

**Transformation**:
```typescript
// BEFORE
{
  order: 1,
  lessonTemplateRef: "AUTO_TBD_1",
  label: "Introduction to Numeracy Skills",
  ...
}

// AFTER
{
  order: 1,
  lessonTemplateRef: "6745abc123def...",
  label: "Introduction to Numeracy Skills",
  ...
}
```

#### validateTemplateReferences

```typescript
async function validateTemplateReferences(
  databases: Databases,
  entries: AuthoredSOWEntry[]
): Promise<void>
```

**Phase**: 4 (Post-validation)

**Purpose**: Verifies referential integrity after seeding.

**3-Tier Validation**:

**1. Uniqueness Check**:
```typescript
const templateIds = entries.map(e => e.lessonTemplateRef);
const uniqueIds = new Set(templateIds);

if (uniqueIds.size !== templateIds.length) {
  throw new Error(`Duplicate template references found`);
}
```

**2. Existence Check**:
```typescript
for (const entry of entries) {
  await databases.getDocument(
    'default',
    'lesson_templates',
    entry.lessonTemplateRef
  );  // Throws if not found
}
```

**3. Title Matching** (warning only):
```typescript
const template = await databases.getDocument(...);
if (template.title !== entry.label) {
  console.warn(`Title mismatch: "${entry.label}" vs "${template.title}"`);
}
```

**Example Output**:
```
✅ Validating template references...

  ✅ Uniqueness Check: All 48 template IDs are unique
  ✅ Existence Check: All 48 templates exist in database
  ⚠️  Title Matching: 2 mismatches found (non-critical)

🎉 Validation Complete: All critical checks passed!
```

### Configuration

**SOW Data File** (line 409):
```typescript
const jsonFilePath = path.join(
  __dirname,
  '../../langgraph-author-agent/data/sow_authored_AOM_nat3.json'
);
```

**Database**:
```typescript
const DATABASE_ID = 'default';
const AUTHORED_SOW_COLLECTION = 'Authored_SOW';
const LESSON_TEMPLATES_COLLECTION = 'lesson_templates';
const COURSE_OUTCOMES_COLLECTION = 'course_outcomes';
```

### Error Handling

**Missing Environment Variables**:
```
❌ Missing required environment variables:
  - NEXT_PUBLIC_APPWRITE_ENDPOINT
  - APPWRITE_API_KEY
```

**File Not Found**:
```
❌ File not found: /path/to/sow_authored_AOM_nat3.json
   Looking for: /path/to/sow_authored_AOM_nat3.json
```

**Invalid Outcome References**:
```
❌ Invalid outcome references found:
  - O5
  - O7

💡 Please ensure course_outcomes collection has been populated
```

**Duplicate Template IDs**:
```
❌ Duplicate template references found:
  - 6745abc123def...
```

## migrateCourseOutcomes.ts

**Location**: `assistant-ui-frontend/scripts/migrateCourseOutcomes.ts`

**Purpose**: Migrates course outcomes from SQA-extracted data to course_outcomes collection.

**Command**:
```bash
tsx scripts/migrateCourseOutcomes.ts <courseId>
```

**Example**:
```bash
tsx scripts/migrateCourseOutcomes.ts course_c84473
```

**Prerequisites**:
1. `course_outcomes_import.json` exists (generated by `extractSQAOutcomes.ts`)
2. Admin API key configured

**Process**:
1. Reads `course_outcomes_import.json`
2. Filters for specified `courseId`
3. Backs up existing outcomes (optional)
4. Deletes old course_outcomes documents
5. Creates new documents with SQA structure
6. Validates import

**Output Example**:
```
🔄 Course Outcomes Migration Script
============================================================
  Target Course ID: course_c84473
============================================================

✅ Environment variables validated

📖 Reading import file: course_outcomes_import.json
✅ Found 12 outcomes for course_c84473

🗑️  Deleting existing outcomes for course...
✅ Deleted 8 old outcomes

📝 Creating new outcomes...
  ✅ Created O1: Analyse an everyday situation... (6745abc...)
  ✅ Created O2: Carry out calculations involving... (6745def...)
  ...

✅ Migration complete: 12 outcomes created
```

## seed-clean-data.ts (DEPRECATED)

**Location**: `assistant-ui-frontend/scripts/seed-clean-data.ts`

**Status**: ⚠️ **DEPRECATED** - Uses old course_outcomes schema

**Purpose**: Historical script for populating test data with hardcoded outcomes.

**Why Deprecated**:
- Uses old schema (`outcomeRef`, `title`) instead of SQA-aligned structure
- Hardcoded test data instead of real SQA outcomes
- Not compatible with current seeding pipeline

**Replacement**: Use `migrateCourseOutcomes.ts` + `seedAuthoredSOW.ts`

**Kept For**: Historical reference and quick local testing only.

## Future: seedAuthoredLesson.ts

**Location**: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts` (planned)

**Purpose**: Invokes lesson_author agent to populate lesson_templates.cards field.

**Command** (planned):
```bash
npm run seed:authored-lesson <courseId> <order> <resourcePackPath>
```

**Example**:
```bash
npm run seed:authored-lesson course_c84473 0 ../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt
```

**Process** (planned):
1. Read Authored_SOW entry by `courseId + order`
2. Load resource pack from file
3. Create dual JSON input (SOW entry + resource pack)
4. Invoke `lesson_author` agent via LangGraph SDK
5. Extract generated lesson template from agent state
6. Upsert to `lesson_templates` using `courseId + sow_order`

**Integration**:
```typescript
// Read existing template placeholder
const existing = await databases.listDocuments(
  'default',
  'lesson_templates',
  [
    Query.equal('courseId', courseId),
    Query.equal('sow_order', order)
  ]
);

// Invoke lesson_author agent
const client = new LangGraphClient({ apiUrl: 'http://localhost:2024' });
const lessonTemplate = await runLessonAuthorAgent(dualInput, client);

// Update template with generated cards
await databases.updateDocument(
  'default',
  'lesson_templates',
  existing.documents[0].$id,
  {
    cards: JSON.stringify(lessonTemplate.cards),
    createdBy: 'lesson_author_agent'
  }
);
```

See: `../../tasks/lesson-seeding-script-spec.md` for full specification.

---

**Next**: See [database-schema.md](./database-schema.md) for collection structure details.
