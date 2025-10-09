# Seeding Scripts Reference

> **Detailed API documentation for all seeding scripts**

## Table of Contents

- [seedAuthoredSOW.ts](#seedauthoredsowts)
  - [Seeding_Data Directory Structure](#seeding_data-directory-structure)
  - [Preparatory Phases](#preparatory-phases) (PHASE -3, -2, -1)
  - [Core Functions](#core-functions-phase-0-4) (PHASE 0-4)
- [migrateCourseOutcomes.ts](#migratecourseoutcomests)
- [seed-clean-data.ts](#seed-clean-datats-deprecated)
- [seedAuthoredLesson.ts](#seedauthoredlessonts-production-ready) ✅ **PRODUCTION READY**

## seedAuthoredSOW.ts

**Location**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`

**Purpose**: Seeds Authored_SOW collection with SOW data from sow_author_agent, creating lesson template placeholders with validated outcome references. Supports three operation modes: single file, named file, and batch processing.

**Commands**:
```bash
# Default batch mode (processes all SOW files in Seeding_Data/input/sows/)
npm run seed:authored-sow

# Single file mode (direct path)
tsx scripts/seedAuthoredSOW.ts --sow /path/to/sow_file.json

# Named file mode (uses Seeding_Data directory structure)
tsx scripts/seedAuthoredSOW.ts --name mathematics_national-4 --input-dir /path/to/Seeding_Data

# Batch mode with validation only (dry run)
tsx scripts/seedAuthoredSOW.ts --batch --validate --input-dir /path/to/Seeding_Data
```

**Prerequisites**:
1. ~~`course_outcomes` collection populated~~ **(Auto-populated by script in PHASE -1)**
2. SOW JSON files in `Seeding_Data/input/sows/` directory (batch mode)
3. Environment variables configured in `.env.local`
4. **NEW:** SQA course data in `sqa_education.sqa_current` collection

### Seeding_Data Directory Structure

The script expects a standardized directory structure for batch processing:

```
Seeding_Data/
├── input/
│   └── sows/
│       ├── mathematics_national-4.json
│       ├── application-of-mathematics_national-3.json
│       └── ... (other SOW files)
└── output/
    ├── course_outcomes_imports/
    │   ├── mathematics_national-4.json
    │   └── ... (extracted outcomes per course)
    ├── logs/
    │   └── ... (seeding logs)
    └── reports/
        └── batch-report-{timestamp}.json
```

**SOW Filename Format**: `<subject>_<level>.json`
- Subject and level use hyphens: `application-of-mathematics_national-4.json`
- The script extracts subject/level metadata from the filename
- Subject/level are used to query SQA course data

### Main Function

```typescript
async function seedSingleSOW(sowFilePath: string): Promise<void>
```

Orchestrates the 7-phase seeding process (including 3 preparatory phases).

**Execution Flow**:
1. Validates environment variables
2. Creates admin client and driver
3. Reads SOW JSON file and extracts subject/level from filename
4. **PHASE -3**: Ensures course document exists (creates if missing)
5. **PHASE -2**: Extracts outcomes from SQA collection (auto-skip if exists)
6. **PHASE -1**: Populates course_outcomes collection (auto-skip if exists)
7. **PHASE 0**: Validates outcome references
8. **PHASE 1-4**: Template creation, entry updates, upsert, validation
9. Reports summary

**Exit Codes**:
- `0`: Success
- `1`: Validation failure, missing prerequisites, or database error

### Preparatory Phases

#### PHASE -3: ensureCourseExists

```typescript
async function ensureCourseExists(
  databases: Databases,
  courseId: string,
  subject: string,
  level: string
): Promise<void>
```

**Purpose**: Creates course document if it doesn't exist, preventing orphaned foreign keys.

**Process**:
1. Queries `courses` collection for `courseId`
2. If not found, creates with schema v2: `{ courseId, subject, level, schema_version: 2 }`
3. Skips if already exists

**Output**:
```
📦 PHASE -3: Ensure Course Document Exists
  ✅ Course exists: course_c84774
```

#### PHASE -2: extractOutcomesFromSQA

```typescript
async function extractOutcomesFromSQA(
  databases: Databases,
  sowData: SOWJSONFile,
  subject: string,
  level: string,
  outputDir: string,
  fileName: string
): Promise<void>
```

**Purpose**: Extracts course outcomes from SQA education database and saves to import file.

**Process**:
1. Checks if import file already exists (auto-skip)
2. Queries `sqa_education.sqa_current` collection with underscored subject/level
3. Tries subject variants (e.g., `application_of_mathematics` vs `applications_of_mathematics`)
4. Extracts outcomes from SQA course structure
5. Generates teacher guidance and keywords from assessment standards
6. Writes to `output/course_outcomes_imports/{fileName}.json`

**Output**:
```
📦 PHASE -2: Extract Outcomes from SQA
  ✅ Import file already exists: mathematics_national-4.json (SKIP)
  # OR
  🔍 Extracting outcomes from sqa_education.sqa_current...
  ✅ Found SQA data using subject="application_of_mathematics"
  ✅ Extracted 12 outcomes → mathematics_national-4.json
```

#### PHASE -1: populateCourseOutcomes

```typescript
async function populateCourseOutcomes(
  databases: Databases,
  courseId: string,
  outputDir: string,
  fileName: string
): Promise<void>
```

**Purpose**: Populates `course_outcomes` collection from extracted import file.

**Process**:
1. Checks if outcomes already exist for courseId (auto-skip)
2. Reads import file from `output/course_outcomes_imports/{fileName}.json`
3. Filters for specified courseId
4. Creates documents in `course_outcomes` collection with full SQA structure

**Output**:
```
📦 PHASE -1: Populate course_outcomes Collection
  ✅ course_outcomes already populated for course_c84774 (SKIP)
  # OR
  📥 Populating course_outcomes collection...
  ✅ Created 12 course_outcomes documents
```

### Core Functions (PHASE 0-4)

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

## seedAuthoredLesson.ts (PRODUCTION READY)

**Location**: `assistant-ui-frontend/scripts/seedAuthoredLesson.ts`

**Status**: ✅ **FULLY IMPLEMENTED** - Production-ready with advanced error recovery

**Purpose**: Invokes lesson_author agent to populate lesson_templates.cards field with AI-generated lesson content.

**Command**:
```bash
npm run seed:authored-lesson <courseId> <order> <resourcePackPath>
```

**Example**:
```bash
npm run seed:authored-lesson course_c84774 0 ../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt
```

**Prerequisites**:
1. Authored_SOW entry exists for `courseId` + `order`
2. lesson_templates placeholder exists (created by seedAuthoredSOW.ts)
3. Resource pack file exists (research pack with pedagogical resources)
4. LangGraph lesson_author agent running (default: `http://localhost:2027`)
5. SQA course data in `sqa_education.current_sqa` collection

### Advanced Features

#### 1. Error Recovery with Retry Logic

The script implements automatic retry with exponential backoff (max 10 attempts):

```typescript
async function runLessonAuthorAgent(
  tripleInput: string,
  courseData: string,
  langgraphUrl: string,
  logFilePath: string
): Promise<any>
```

**Recovery Strategy**:
- Maintains same `threadId` across retries for state continuity
- Pre-injects `Course_data.txt` into thread state before first run
- Sends "continue" message to resume from last checkpoint on retry
- Exponential backoff: `Math.min(1000 * Math.pow(2, attempt - 1), 10000)`
- Comprehensive logging to file for debugging

**Example Flow**:
```
Attempt 1: Send triple input → Agent encounters TODO
Attempt 2: Send "continue" → Agent resolves TODO, encounters another
Attempt 3: Send "continue" → Success! lesson_template.json generated
```

#### 2. Triple JSON Input Format

The script creates a specialized input format combining three data sources:

```typescript
function createTripleInput(
  sowEntry: AuthoredSOWEntry,
  resourcePack: any,
  sowMetadata: SOWContextMetadata
): string
```

**Format**: `<sow_entry_json>,\n<resource_pack_json>,\n<sow_metadata_json>`

**Components**:
1. **SOW Entry**: Lesson order, title, outcomes, duration, engagement tags
2. **Resource Pack**: Pedagogical resources, teaching strategies, assessment items
3. **SOW Metadata**: Course-level context (coherence, accessibility, engagement notes)

**Example**:
```json
{"order":0,"label":"Introduction to Money Management",...},
{"research_pack_version":"1.0","resources":[...]},
{"coherence":{"policy_notes":[...],"sequencing_notes":[...]},...}
```

#### 3. Course Data Pre-Injection

Before invoking the agent, the script pre-loads SQA course data into the LangGraph thread:

```typescript
await client.threads.updateState(threadId, {
  values: {
    files: {
      'Course_data.txt': courseData  // Full SQA course JSON
    }
  },
  asNode: '__start__'
});
```

**Benefit**: Agent has full course context without needing to fetch it during execution.

#### 4. Card Compression

Generated lesson cards are compressed using gzip + base64 before storage:

```typescript
const compressedCards = compressCards(cards);
const stats = getCompressionStats(cards);

console.log('📦 Compression stats:', {
  original: stats.original + ' chars',
  compressed: stats.compressed + ' chars',
  ratio: stats.ratio,
  savings: stats.savings
});
```

**Typical Savings**: 60-80% reduction in storage size for card arrays.

### Main Process Flow

**Step 1: Load Resource Pack**
```typescript
const resourcePack = await loadResourcePack(resourcePackPath);
// Loads JSON from file (e.g., research_pack_json_AOM_nat3.txt)
```

**Step 2: Fetch Authored SOW**
```typescript
const authoredSOW = await getAuthoredSOW(databases, courseId);
const sowEntry = await getSOWEntryByOrder(authoredSOW, order);
```

**Step 3: Fetch Course Metadata**
```typescript
const courseMetadata = await getCourseMetadata(databases, courseId);
// Returns: { subject: "application_of_mathematics", level: "national_3" }
```

**Step 4: Fetch SQA Course Data**
```typescript
const courseData = await fetchSQACourseData(
  databases,
  courseMetadata.subject,
  courseMetadata.level
);
// Queries sqa_education.current_sqa collection
```

**Step 5: Parse SOW Metadata**
```typescript
const sowMetadata = parseSOWMetadata(authoredSOW);
// Extracts: coherence, accessibility_notes, engagement_notes, weeks, periods_per_week
```

**Step 6: Create Triple Input**
```typescript
const tripleInput = createTripleInput(sowEntry, resourcePack, sowMetadata);
```

**Step 7: Run Lesson Author Agent with Retry**
```typescript
const lessonTemplate = await runLessonAuthorAgent(
  tripleInput,
  courseData,
  LANGGRAPH_URL,
  logFile
);
// Max 10 retries with exponential backoff
```

**Step 8: Upsert to lesson_templates**
```typescript
const result = await upsertLessonTemplate(
  databases,
  lessonTemplate,
  courseId,
  order
);
// Deterministic lookup: courseId + sow_order
```

### Logging

**Log File Location**: `assistant-ui-frontend/logs/lesson-authoring/lesson_{courseId}_order{order}_{timestamp}.log`

**Log Entries**:
```
[2025-10-09T11:28:00.000Z] Thread created: thread_abc123
[2025-10-09T11:28:01.000Z] Injected Course_data.txt (45000 chars)
[2025-10-09T11:28:02.000Z] === Attempt 1/10 ===
[2025-10-09T11:29:30.000Z] ⚠️  Agent has 3 outstanding TODOs
[2025-10-09T11:29:31.000Z] === Attempt 2/10 ===
[2025-10-09T11:30:45.000Z] ✅ Success on attempt 2
```

### Example Output

**Success**:
```
🚀 Starting Lesson Authoring Pipeline
=====================================
Course ID: course_c84774
Order: 0
Resource Pack: ../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt

📂 Loading resource pack...
✅ Loaded resource pack (version 1.0)

📚 Fetching Authored SOW document...
✅ Found Authored SOW for course: course_c84774
   Total entries: 48

🎓 Fetching course metadata...
✅ Course: application_of_mathematics national_3

📚 Fetching SQA course data from sqa_education database...
✅ Fetched SQA data (45234 characters)

🔍 Extracting entry at order 0...
✅ Found entry: "Introduction to Money Management"
   Type: teach
   Duration: 50 minutes

📋 Parsing SOW context metadata...
✅ Extracted metadata:
   Policy notes: 2
   Sequencing notes: 4
   Accessibility notes: 3
   Engagement notes: 5
   Duration: 12 weeks × 3 periods/week

🔧 Creating triple JSON input...
✅ Created input (67890 characters)

🤖 Invoking lesson_author agent with error recovery...
   URL: http://localhost:2027
   Thread ID: thread_abc123xyz
   ✅ Course_data.txt pre-loaded

🔄 Attempt 1/10...
..........
✅ Lesson generated successfully on attempt 1

✅ Lesson template generated
   Title: Introduction to Money Management
   Type: teach
   Duration: 50 minutes
   Cards: 12

📦 Compression stats: {
  original: '125678 chars',
  compressed: '45234 chars',
  ratio: '0.36',
  savings: '64%'
}

💾 Upserting to lesson_templates...
✅ Updated lesson template
   Document ID: 6745abc123def...

=====================================
🎉 SUCCESS! Lesson template created
=====================================
```

**Error Recovery Example**:
```
🔄 Attempt 1/10...
..........
   ⚠️  Agent has 2 outstanding TODOs
      - CFU Critic: Missing success criteria for question 2
      - Language Critic: Explanation too complex for National 3 level

🔄 Attempt 2/10...
..........
✅ Lesson generated successfully on attempt 2
```

### Integration with seedAuthoredSOW.ts

The two scripts work together in sequence:

1. **seedAuthoredSOW.ts** creates lesson_templates **placeholders**:
   - `cards: "[]"` (empty)
   - `createdBy: "sow_author_agent"`
   - Establishes deterministic IDs via `courseId + sow_order`

2. **seedAuthoredLesson.ts** populates the placeholders:
   - `cards: "[compressed_gzip_base64_string]"` (populated)
   - `createdBy: "lesson_author_agent"`
   - Uses same deterministic lookup for upsert

**Workflow**:
```bash
# Step 1: Create SOW and template placeholders
npm run seed:authored-sow

# Step 2: Generate lesson content for each entry
npm run seed:authored-lesson course_c84774 0 ../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt
npm run seed:authored-lesson course_c84774 1 ../langgraph-author-agent/data/research_pack_json_AOM_nat3.txt
# ... repeat for all entries
```

---

**Next**: See [database-schema.md](./database-schema.md) for collection structure details.
