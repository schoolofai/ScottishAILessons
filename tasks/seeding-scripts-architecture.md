# Seeding Scripts Architecture Documentation

## Overview of the 3-Tier Seeding System

The seeding system follows a **hierarchical dependency chain**:

```
sqa_education.sqa_current (Source of Truth)
    ↓
1. extractSQAOutcomes.ts → course_outcomes_import.json
    ↓
2. migrateCourseOutcomes.ts → course_outcomes collection
    ↓
3. seedAuthoredSOW.ts → lesson_templates + Authored_SOW collections
```

---

## 1. Course Outcomes Seeding (from SQA Education Database)

### Source Data: `sqa_education.sqa_current` Collection

**Database**: `sqa_education`
**Collection**: `sqa_current`

**Structure**:
```typescript
{
  subject: "applications_of_mathematics",
  level: "national_3",
  course_code: "C844 73",  // Note: Often unpopulated - query by subject+level instead
  data: JSON.stringify({
    course_structure: {
      units: [
        {
          code: "HV7Y 73",
          title: "Applications of Mathematics: Manage Money and Data (National 3)",
          scqf_credits: 6,
          outcomes: [
            {
              id: "O1",
              title: "Manage money in basic real-life contexts",
              assessment_standards: [
                {
                  code: "AS1.1",
                  desc: "Identifying factors affecting income and expenditure",
                  skills_list: ["budgeting", "financial_awareness"],
                  marking_guidance: "Award marks for..."
                }
              ]
            }
          ]
        }
      ]
    }
  })
}
```

### Step 1: Extract SQA Outcomes

**Script**: `assistant-ui-frontend/scripts/extractSQAOutcomes.ts`

**Input**: `sqa_education.sqa_current` collection
**Output**: `/langgraph-author-agent/data/course_outcomes_import.json`

**Process**:
1. Query `sqa_current` by `subject` and `level` (not course_code - it's unpopulated)
2. Parse the JSON `data` field
3. Navigate: `data.course_structure.units` or `data.units` (fallback for different data formats)
4. Flatten hierarchy: One document per **outcome** (not per assessment standard)
5. Generate:
   - `teacherGuidance` from assessment standards' marking guidance
   - `keywords` extracted from outcome titles and descriptions

**Command**:
```bash
cd assistant-ui-frontend
tsx scripts/extractSQAOutcomes.ts \
  "applications_of_mathematics" \
  "national_3" \
  "C844 73" \
  "course_c84473"
```

**Arguments**:
- `subject`: Subject identifier from sqa_current (e.g., "applications_of_mathematics")
- `level`: Level identifier (e.g., "national_3", "national_4", "higher")
- `courseSqaCode`: SQA course code (e.g., "C844 73") - stored in output but not used for querying
- `courseId`: Internal course ID (e.g., "course_c84473") - used in lesson_templates and Authored_SOW

**Output JSON Structure**:
```json
[
  {
    "courseId": "course_c84473",
    "courseSqaCode": "C844 73",
    "unitCode": "HV7Y 73",
    "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
    "scqfCredits": 6,
    "outcomeId": "O1",
    "outcomeTitle": "Manage money in basic real-life contexts",
    "assessmentStandards": "[{\"code\":\"AS1.1\",\"desc\":\"Identifying factors affecting income and expenditure\",\"skills_list\":[\"budgeting\"],\"marking_guidance\":\"Award marks for...\"}]",
    "teacherGuidance": "**AS1.1**: Identifying factors affecting income and expenditure\n  Marking: Award marks for...\n  Skills: budgeting, financial_awareness",
    "keywords": ["manage","money","basic","reallife","contexts","identifying","factors","affecting"]
  }
]
```

**Expected Console Output**:
```
🔍 SQA Outcomes Extraction Script
============================================================
  Subject: applications_of_mathematics
  Level: national_3
  SQA Course Code: C844 73
  Internal Course ID: course_c84473
============================================================

✅ Environment variables validated

📖 Querying sqa_education.sqa_current for applications_of_mathematics (national_3)...

✅ Found 1 document(s)

📚 Processing: Application of Math - National 3
   Found 3 units

  📦 Unit: HV7Y 73 - Applications of Mathematics: Manage Money and Data (National 3)
     Outcomes: 2
     → O1: Manage money in basic real-life contexts
     → O2: Interpret graphical data

============================================================
📊 Extraction Summary:
============================================================
  Total units processed: 3
  Total outcomes extracted: 6
  Course outcomes records: 6

✅ Import file written to:
   /path/to/course_outcomes_import.json
```

### Step 2: Migrate to Database

**Script**: `assistant-ui-frontend/scripts/migrateCourseOutcomes.ts`

**Input**: `course_outcomes_import.json`
**Output**: `course_outcomes` collection (database: `default`)

**5-Phase Process**:

#### Phase 1: Read Import File
- Load JSON from `langgraph-author-agent/data/course_outcomes_import.json`
- Filter by courseId to handle multi-course import files

#### Phase 2: Backup Existing Data
- Query existing `course_outcomes` for the specified course
- Save to `course_outcomes_backup.json`
- Provides rollback capability if migration fails

#### Phase 3: Delete Old Documents
- Remove all existing outcomes for the course
- Prevents duplicates on re-run
- Uses individual delete operations to handle failures gracefully

#### Phase 4: Import New Documents
- Create documents with auto-generated IDs using `ID.unique()`
- Convert arrays to JSON strings:
  - `keywords` array → JSON string
  - `assessmentStandards` already JSON string from extraction
- Each document gets unique Appwrite document ID

#### Phase 5: Validate Import
- Query each outcomeId to verify it's queryable by:
  - `courseId` + `outcomeId` combination
- Ensures integrity before SOW seeding
- Fails fast if any outcome is missing

**Command**:
```bash
cd assistant-ui-frontend
tsx scripts/migrateCourseOutcomes.ts course_c84473
```

**Arguments**:
- `courseId`: Internal course ID (must match extractSQAOutcomes.ts)

**Expected Console Output**:
```
🔄 Course Outcomes Migration Script
============================================================
  Target Course ID: course_c84473
============================================================

✅ Environment variables validated

📖 Reading import file: /path/to/course_outcomes_import.json

✅ Loaded 6 course outcomes for course_c84473

💾 Backing up existing course_outcomes...

✅ Backed up 18 existing documents to:
   /path/to/course_outcomes_backup.json

🗑️  Deleting old course_outcomes...

  🗑️  Deleted: 68d1c5fcdaec2d5f4770
  ...

✅ Deleted 18 old documents

📥 Importing new course_outcomes...

  ✅ Created: O1 - Manage money in basic real-life contexts (70a1b2c3d4e5...)
  ✅ Created: O2 - Interpret graphical data (70a1b2c3d4e6...)
  ...

📊 Import Summary:
   Created: 6
   Errors: 0
   Total: 6

✅ Validating import...

  ✅ O1: Manage money in basic real-life contexts
  ✅ O2: Interpret graphical data
  ...

============================================================
🎉 Migration Complete!
============================================================
  ✅ Imported 6 course outcomes
  ✅ All outcome IDs validated
  ✅ Ready for seedAuthoredSOW.ts
```

**Result**: 6 `course_outcomes` documents created with structure:
```typescript
{
  $id: "68e023950028e5f8310b",  // Appwrite-generated document ID
  courseId: "course_c84473",
  courseSqaCode: "C844 73",
  unitCode: "HV7Y 73",
  unitTitle: "Applications of Mathematics: Manage Money and Data (National 3)",
  scqfCredits: 6,
  outcomeId: "O1",  // ← Direct mapping key from SOW
  outcomeTitle: "Manage money in basic real-life contexts",
  assessmentStandards: "[{...}]",  // JSON string
  teacherGuidance: "**AS1.1**: ...",
  keywords: "[\"manage\",\"money\",...]"  // JSON string
}
```

---

## 2. Placeholder Lesson Templates Seeding

### Source: JSON SOW File

**Location**: `/langgraph-author-agent/data/sow_authored_AOM_nat3.json`

**Structure**:
```json
{
  "$id": "sow-n3-appsofmath-v2-revised",
  "courseId": "course_c84473",
  "version": 2,
  "status": "draft",
  "metadata": {
    "coherence": {
      "policy_notes": ["Calculator allowed for all assessments", "..."],
      "sequencing_notes": ["Follows SQA recommended sequence", "..."]
    },
    "accessibility_notes": ["Clear fonts", "Concrete materials", "..."],
    "engagement_notes": ["Scottish contexts", "Hands-on activities", "..."],
    "weeks": 38,
    "periods_per_week": 3
  },
  "entries": [
    {
      "order": 1,
      "lessonTemplateRef": "AUTO_TBD_1",  // ← Placeholder to be replaced!
      "label": "Introduction to Numeracy Skills",
      "lesson_type": "teach",
      "estMinutes": 50,
      "outcomeRefs": ["O1"],              // ← Outcome IDs (not document IDs)
      "assessmentStandardRefs": ["AS1.1"],
      "engagement_tags": ["foundations", "notation"],
      "policy": {
        "calculator_section": "non_calc",
        "assessment_notes": "Focus on understanding place value"
      },
      "pedagogical_blocks": ["starter", "modelling", "guided_practice"],
      "accessibility_profile": {
        "dyslexia_friendly": true,
        "extra_time": true
      },
      "coherence": {
        "unit": "Numeracy (National 3)",
        "block_name": "Core Skills: Notation and Units",
        "block_index": "1.1",
        "prerequisites": []
      }
    }
  ]
}
```

### Script: `seedAuthoredSOW.ts`

**Location**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts`

**Prerequisites**:
1. ✅ `extractSQAOutcomes.ts` has been run
2. ✅ `migrateCourseOutcomes.ts` has been run
3. ✅ `course_outcomes` collection is populated

**6-Phase Process**:

#### PHASE 0: Validate Outcome References

**Function**: `validateOutcomeReferences(databases, entries, courseId)`

**Purpose**: Fail-fast validation before creating any templates

**Process**:
1. Collect all unique `outcomeRefs` from SOW entries
   ```typescript
   allOutcomeIds = ["O1", "O2", "O3", "O4", "O5", "O6"]
   ```

2. For each outcomeId, query `course_outcomes`:
   ```typescript
   Query.equal('courseId', courseId)
   Query.equal('outcomeId', outcomeId)
   ```

3. If any outcome is missing:
   - Throw error immediately
   - List all invalid references
   - Suggest running migration scripts

**Example Validation**:
```
🔍 Validating outcome references...

   Found 12 unique outcome references

  ✅ O1: Manage money in basic real-life contexts
  ✅ O2: Interpret graphical data
  ✅ O3: Use measurements in everyday contexts
  ...

  ✅ All 12 outcome references validated
```

#### PHASE 1: Create/Update Lesson Templates

**Function**: `createOrUpdateLessonTemplates(databases, entries, courseId)`

**Returns**: Map of placeholder refs → real document IDs

**For Each SOW Entry**:

**Step 1: Map Outcome IDs to Document IDs**
```typescript
mapOutcomeIdsToDocumentIds(databases, ["O1"], "course_c84473")

// Queries course_outcomes:
// - courseId = "course_c84473"
// - outcomeId = "O1"

// Returns: ["68e023950028e5f8310b"]
```

**Step 2: Build Template Data**
```typescript
{
  title: "Introduction to Numeracy Skills",
  courseId: "course_c84473",
  sow_order: 1,  // ✅ SOW entry order for deterministic identification
  outcomeRefs: JSON.stringify(["68e023950028e5f8310b"]), // ← Real document IDs!
  cards: JSON.stringify([]),  // Empty placeholder
  version: 1,
  status: "draft",
  createdBy: "sow_author_agent",

  // Phase 3 MVP2.5 pedagogy fields
  lesson_type: "teach",
  estMinutes: 50,
  engagement_tags: JSON.stringify(["foundations", "notation"]),
  policy: JSON.stringify({
    "calculator_section": "non_calc",
    "assessment_notes": "Focus on understanding place value"
  })
}
```

**Step 3: Check for Existing Template**
```typescript
// Query by courseId + sow_order for deterministic uniqueness
// sow_order is stable even if lesson titles are modified
const existing = await databases.listDocuments(
  'default',
  'lesson_templates',
  [
    Query.equal('courseId', courseId),
    Query.equal('sow_order', entry.order),
    Query.limit(1)
  ]
);

if (existing.documents.length > 0) {
  // UPDATE existing document
  templateDoc = await databases.updateDocument(
    'default',
    'lesson_templates',
    existing.documents[0].$id,
    templateData
  );
} else {
  // CREATE new document with ID.unique()
  templateDoc = await databases.createDocument(
    'default',
    'lesson_templates',
    ID.unique(),
    templateData
  );
}
```

**Step 4: Store Mapping**
```typescript
referenceMap.set("AUTO_TBD_1", "68d1c52e52cd187f6182")
//                 ↑                ↑
//           Placeholder      Real doc ID
```

**Result**: 104 lesson_templates created/updated

**Example Output**:
```
📝 Creating lesson template placeholders...
   Total entries to process: 104

  ✅ Created #1: Introduction to Numeracy Skills (68d1c52e52cd187f6182)
  ✅ Created #2: Check-in: Notation and Units (68d1c52f003a7b9c4567)
  ...

📊 Template Creation Summary:
   Created: 104
   Updated: 0
   Total: 104
```

#### PHASE 2: Update SOW Entries with Real Template IDs

**Function**: `updateEntriesWithTemplateRefs(entries, referenceMap)`

**Process**:
- Replace all "AUTO_TBD_X" placeholders with real document IDs from referenceMap
- Validate that every placeholder has a mapping
- Return updated entries array

**Example Transformation**:
```
🔗 Updating Authored_SOW entries with real template IDs...

  #  1. Introduction to Numeracy Skills      AUTO_TBD_1 → 68d1c52e52cd187...
  #  2. Check-in: Notation and Units         AUTO_TBD_2 → 68d1c52f003a7b9...
  ...

✅ 104 entries updated with real template IDs
```

**Before**:
```json
{
  "lessonTemplateRef": "AUTO_TBD_1",
  "outcomeRefs": ["O1"]
}
```

**After**:
```json
{
  "lessonTemplateRef": "68d1c52e52cd187f6182",
  "outcomeRefs": ["O1"]  // Still using outcomeId for human readability
}
```

#### PHASE 3: Prepare and Upsert Authored_SOW

**Function**: `sowDriver.upsertAuthoredSOW(authoredSOWData)`

**Data Preparation**:
```typescript
const authoredSOWData: AuthoredSOWData = {
  courseId: "course_c84473",
  version: "2",  // Convert to string
  status: "draft",
  entries: updatedEntries,  // ← Contains real template IDs!

  metadata: {
    ...sowData.metadata,
    total_lessons: 104,
    total_estimated_minutes: 5200,
    generated_at: "2025-01-04T10:30:00.000Z",
    author_agent_version: "1.0"
  },

  accessibility_notes: "Use clear fonts\nProvide concrete materials\n..."
};
```

**Upsert Logic** (in ServerAuthoredSOWDriver):
1. Query existing Authored_SOW by `courseId` + `version`
2. If exists: **UPDATE** existing document
3. If not: **CREATE** new document
4. Store `entries` array as JSON string

**Result**: Single Authored_SOW document created/updated

#### PHASE 4: Validate Template References

**Function**: `validateTemplateReferences(databases, updatedEntries)`

**Three Validation Checks**:

**Check 1: Uniqueness**
```typescript
const templateIds = entries.map(e => e.lessonTemplateRef);
const uniqueIds = new Set(templateIds);

if (uniqueIds.size !== templateIds.length) {
  // Find duplicates and throw error
}
```

**Check 2: Existence**
```typescript
for (const entry of entries) {
  await databases.getDocument(
    'default',
    'lesson_templates',
    entry.lessonTemplateRef
  );
  // Throws if document doesn't exist
}
```

**Check 3: Title Matching** (warning only)
```typescript
const template = await databases.getDocument(...);
if (template.title !== entry.label) {
  console.warn(`Title mismatch: "${entry.label}" vs "${template.title}"`);
}
```

**Example Output**:
```
✅ Validating template references...

  ✅ Uniqueness Check: All 104 template IDs are unique
  ✅ Existence Check: All 104 templates exist in database
  ✅ Title Matching: All titles match perfectly

🎉 Validation Complete: All critical checks passed!
```

### Command

```bash
cd assistant-ui-frontend
npm run seed:authored-sow
# or
tsx scripts/seedAuthoredSOW.ts
```

**Expected Console Output**:
```
🌱 Starting Authored_SOW seed script...

✅ Environment variables validated

✅ Admin client created with API key authentication

✅ ServerAuthoredSOWDriver initialized

📖 Reading SOW data from: /path/to/sow_authored_AOM_nat3.json

✅ Successfully loaded SOW data for course: course_c84473
   Version: 2
   Status: draft
   Entries: 104 lessons

============================================================
PHASE 0: Validate Outcome References
============================================================
[... validation output ...]

============================================================
PHASE 1: Create/Update Lesson Template Placeholders
============================================================
[... template creation output ...]

============================================================
PHASE 2: Update Authored_SOW Entries with Real Template IDs
============================================================
[... mapping output ...]

============================================================
PHASE 3: Prepare and Upsert Authored_SOW Data
============================================================

💾 Upserting to Authored_SOW collection...

✅ Successfully seeded Authored_SOW!
   Document ID: 68e024a1000f3c2d8901
   Course ID: course_c84473
   Version: 2
   Status: draft
   Entries stored: 104 lessons

============================================================
PHASE 4: Validate All Template References
============================================================
[... validation output ...]

============================================================
🎉 Seed script completed successfully!
============================================================

📊 Final Summary:
   ✅ Lesson templates: 104 created/updated
   ✅ Authored_SOW: 1 document upserted
   ✅ Template references: All validated
   ✅ Total lessons: 104
```

---

## 3. Final Database State

### course_outcomes Collection

**Count**: 6 documents

**Example Document**:
```json
{
  "$id": "68e023950028e5f8310b",
  "$createdAt": "2025-01-04T10:15:00.000Z",
  "$updatedAt": "2025-01-04T10:15:00.000Z",

  "courseId": "course_c84473",
  "courseSqaCode": "C844 73",
  "unitCode": "HV7Y 73",
  "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
  "scqfCredits": 6,

  "outcomeId": "O1",
  "outcomeTitle": "Manage money in basic real-life contexts",

  "assessmentStandards": "[{\"code\":\"AS1.1\",\"desc\":\"Identifying factors affecting income and expenditure\",\"skills_list\":[\"budgeting\",\"financial_awareness\"],\"marking_guidance\":\"Award marks for identifying at least 3 factors\"}]",

  "teacherGuidance": "**AS1.1**: Identifying factors affecting income and expenditure\n  Marking: Award marks for identifying at least 3 factors\n  Skills: budgeting, financial_awareness",

  "keywords": "[\"manage\",\"money\",\"basic\",\"reallife\",\"contexts\",\"identifying\",\"factors\",\"affecting\"]"
}
```

### lesson_templates Collection

**Count**: 104 documents

**Example Document**:
```json
{
  "$id": "68d1c52e52cd187f6182",
  "$createdAt": "2025-01-04T10:20:00.000Z",
  "$updatedAt": "2025-01-04T10:20:00.000Z",

  "title": "Introduction to Numeracy Skills",
  "courseId": "course_c84473",
  "sow_order": 1,  // ✅ SOW entry order for deterministic identification
  "outcomeRefs": "[\"68e023950028e5f8310b\"]",  // ← Real course_outcomes doc ID!
  "cards": "[]",
  "version": 1,
  "status": "draft",
  "createdBy": "sow_author_agent",

  "lesson_type": "teach",
  "estMinutes": 50,
  "engagement_tags": "[\"foundations\",\"notation\"]",
  "policy": "{\"calculator_section\":\"non_calc\",\"assessment_notes\":\"Focus on understanding place value\"}"
}
```

### Authored_SOW Collection

**Count**: 1 document

**Example Document**:
```json
{
  "$id": "68e024a1000f3c2d8901",
  "$createdAt": "2025-01-04T10:25:00.000Z",
  "$updatedAt": "2025-01-04T10:25:00.000Z",

  "courseId": "course_c84473",
  "version": "2",
  "status": "draft",

  "entries": "[{\"order\":1,\"lessonTemplateRef\":\"68d1c52e52cd187f6182\",\"label\":\"Introduction to Numeracy Skills\",\"outcomeRefs\":[\"O1\"],\"lesson_type\":\"teach\",\"estMinutes\":50,...},{...}]",

  "metadata": "{\"total_lessons\":104,\"total_estimated_minutes\":5200,\"generated_at\":\"2025-01-04T10:25:00.000Z\",\"author_agent_version\":\"1.0\",\"coherence\":{...},\"weeks\":38,\"periods_per_week\":3}",

  "accessibility_notes": "Use clear, sans-serif fonts and large, uncluttered diagrams.\nProvide concrete materials (e.g., fake money, 3D shapes, measuring tapes) for hands-on learning.\nBreak down multi-step problems into smaller, numbered steps to reduce cognitive load."
}
```

---

## Complete Workflow Example

### Step-by-Step Execution

```bash
# ============================================================
# Step 1: Extract from SQA Database
# ============================================================
cd assistant-ui-frontend

tsx scripts/extractSQAOutcomes.ts \
  "applications_of_mathematics" \
  "national_3" \
  "C844 73" \
  "course_c84473"

# Output: 6 outcomes extracted
# File created: langgraph-author-agent/data/course_outcomes_import.json

# ============================================================
# Step 2: Migrate to course_outcomes Collection
# ============================================================
tsx scripts/migrateCourseOutcomes.ts course_c84473

# Output: 6 documents created in course_outcomes collection
# Backup created: langgraph-author-agent/data/course_outcomes_backup.json

# ============================================================
# Step 3: Seed Lesson Templates + Authored SOW
# ============================================================
npm run seed:authored-sow
# or
tsx scripts/seedAuthoredSOW.ts

# Output:
# - 104 lesson_templates created/updated
# - 1 Authored_SOW document created/updated
# - All references validated
```

### Verification Queries

**Verify course_outcomes**:
```typescript
const outcomes = await databases.listDocuments(
  'default',
  'course_outcomes',
  [
    Query.equal('courseId', 'course_c84473'),
    Query.orderAsc('outcomeId')
  ]
);
// Should return 6 documents: O1, O2, O3, O4, O5, O6
```

**Verify lesson_templates**:
```typescript
const templates = await databases.listDocuments(
  'default',
  'lesson_templates',
  [
    Query.equal('courseId', 'course_c84473'),
    Query.equal('createdBy', 'sow_author_agent')
  ]
);
// Should return 104 documents
```

**Verify Authored_SOW**:
```typescript
const sow = await databases.listDocuments(
  'default',
  'Authored_SOW',
  [
    Query.equal('courseId', 'course_c84473'),
    Query.equal('version', '2')
  ]
);
// Should return 1 document with 104 entries
```

---

## Key Design Principles

### 1. Single Source of Truth
- `sqa_education.sqa_current` is the **authoritative source** for all outcome data
- All seeding scripts derive from SQA data, not manual definitions

### 2. Idempotency
- Re-running scripts **updates** instead of duplicating
- Uses composite keys for uniqueness:
  - course_outcomes: `courseId` + `outcomeId`
  - lesson_templates: `courseId` + `sow_order`
  - Authored_SOW: `courseId` + `version`

### 3. Deterministic Identification
- **Lesson templates** use `sow_order` (not `title`) for stable identification
- `sow_order` represents the entry's position in the original SOW
- Benefits:
  - Titles can change without breaking idempotency
  - Clear 1:1 mapping: SOW entry #1 → lesson_template with `sow_order=1`
  - Resilient to typo fixes, wording improvements, or translations
- Composite key: `courseId + sow_order` uniquely identifies every template

### 4. Fail-Fast Validation
- **Phase 0** validates outcome references before creating templates
- Catches missing data immediately with clear error messages
- Prevents partial/corrupted database state

### 5. Two-Tier Reference System
- **Human-Readable**: SOW stores `outcomeRefs: ["O1"]` for clarity
- **Database-Queryable**: lesson_templates store `outcomeRefs: ["68e0239..."]` for lookups
- Mapping happens during seeding, not at runtime

### 6. Real IDs Only
- No placeholders ("AUTO_TBD_X") remain in final database state
- All references use actual Appwrite document IDs
- Enables direct database queries without resolution layers

### 7. Backup and Recovery
- Automatic backup before destructive operations
- Rollback files stored in `langgraph-author-agent/data/`
- Can restore previous state if migration fails

---

## Troubleshooting

### Error: "No documents found for course code"

**Cause**: `course_code` field in sqa_current is unpopulated

**Fix**: Use `subject` and `level` instead:
```bash
tsx scripts/extractSQAOutcomes.ts "applications_of_mathematics" "national_3" "C844 73" "course_c84473"
```

### Error: "Invalid outcome references found"

**Cause**: SOW references outcomeIds that don't exist in course_outcomes

**Fix**:
1. Check course_outcomes collection is populated
2. Verify outcomeIds in SOW match SQA data exactly
3. Re-run migrateCourseOutcomes.ts if needed

### Error: "Attribute not found in schema"

**Cause**: course_outcomes collection schema is missing new fields

**Fix**: Update collection schema using Appwrite console or MCP:
- outcomeId (string, optional)
- outcomeTitle (string, optional)
- unitCode (string, optional)
- unitTitle (string, optional)
- scqfCredits (integer, optional)
- assessmentStandards (string, large size)
- teacherGuidance (string, large size)
- keywords (string)

### Error: "Permission denied"

**Cause**: API key lacks permissions

**Fix**: Update collection permissions:
```typescript
permissions: [
  "read(\"any\")",
  "create(\"any\")",
  "update(\"any\")",
  "delete(\"users\")"
]
```

---

## Related Documentation

- **Migration Guide**: `/langgraph-author-agent/data/OUTCOME_MIGRATION_GUIDE.md`
- **Type Definitions**: `/assistant-ui-frontend/lib/types/course-outcomes.ts`
- **Testing Instructions**: `/tasks/mvp25-database-schema-implementation.md`

---

## Version History

- **v1.0** (2025-01): Initial SQA-aligned seeding architecture
  - Replaced manual outcome definitions with SQA extraction
  - Implemented two-tier reference system
  - Added fail-fast validation

---

**Last Updated**: 2025-01-04
**Maintained By**: SOW Author Agent Team
