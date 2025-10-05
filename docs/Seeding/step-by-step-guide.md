# Step-by-Step Seeding Guide

> **Detailed walkthrough of the complete seeding process**

## Table of Contents

- [Complete Workflow](#complete-workflow)
- [Phase 0: Outcome Reference Validation](#phase-0-outcome-reference-validation)
- [Phase 1: Template Placeholder Creation](#phase-1-template-placeholder-creation)
- [Phase 2: SOW Entry Updates](#phase-2-sow-entry-updates)
- [Phase 3: Authored_SOW Upsert](#phase-3-authored_sow-upsert)
- [Phase 4: Post-Seeding Validation](#phase-4-post-seeding-validation)
- [Verification Steps](#verification-steps)

## Complete Workflow

### Prerequisites Checklist

Before running `npm run seed:authored-sow`, ensure:

- [ ] `course_outcomes` collection populated (run `migrateCourseOutcomes.ts`)
- [ ] SOW JSON file exists at `langgraph-author-agent/data/sow_authored_AOM_nat3.json`
- [ ] `.env.local` configured with `APPWRITE_API_KEY`
- [ ] Dependencies installed (`npm install --legacy-peer-deps`)

### Execution Command

```bash
cd assistant-ui-frontend
npm run seed:authored-sow
```

### High-Level Flow

```
START
  ↓
Environment Validation
  ↓
Load SOW JSON File
  ↓
Phase 0: Validate Outcome References ✅
  ↓
Phase 1: Create/Update Lesson Templates ✅
  ↓
Phase 2: Update SOW Entries ✅
  ↓
Phase 3: Upsert Authored_SOW ✅
  ↓
Phase 4: Post-Seeding Validation ✅
  ↓
END (Success)
```

## Phase 0: Outcome Reference Validation

**Purpose**: Ensure all outcome references exist before any writes.

**When**: Before any database writes

**Why**: Prevents orphaned foreign key references

### Process

**Step 1: Collect Unique Outcome IDs**

```typescript
const allOutcomeIds = new Set<string>();
sowData.entries.forEach(entry => {
  entry.outcomeRefs.forEach(outcomeId => allOutcomeIds.add(outcomeId));
});

console.log(`Found ${allOutcomeIds.size} unique outcome references`);
// Output: Found 12 unique outcome references
```

**Step 2: Query course_outcomes for Each ID**

```typescript
for (const outcomeId of allOutcomeIds) {
  const result = await databases.listDocuments(
    'default',
    'course_outcomes',
    [
      Query.equal('courseId', courseId),      // "course_c84473"
      Query.equal('outcomeId', outcomeId),    // "O1", "O2", etc.
      Query.limit(1)
    ]
  );

  if (result.documents.length === 0) {
    invalidRefs.push(outcomeId);
    console.error(`❌ ${outcomeId}: Not found`);
  } else {
    validCount++;
    console.log(`✅ ${outcomeId}: ${result.documents[0].outcomeTitle}`);
  }
}
```

**Step 3: Fail-Fast on Invalid References**

```typescript
if (invalidRefs.length > 0) {
  throw new Error(
    `❌ Invalid outcome references found:\n` +
    invalidRefs.map(id => `  - ${id}`).join('\n') +
    `\n\n💡 Run migrateCourseOutcomes.ts first`
  );
}
```

### Expected Output

**Success**:
```
🔍 Validating outcome references...

   Found 12 unique outcome references

  ✅ O1: Analyse an everyday situation involving money
  ✅ O2: Carry out calculations involving money
  ✅ O3: Compare costs to make informed choices
  ...
  ✅ All 12 outcome references validated
```

**Failure** (if outcomes missing):
```
🔍 Validating outcome references...

   Found 12 unique outcome references

  ✅ O1: Analyse an everyday situation involving money
  ❌ O5: Not found in course_outcomes
  ❌ O7: Not found in course_outcomes

❌ Invalid outcome references found:
  - O5
  - O7

💡 Please ensure course_outcomes collection has been populated with migrateCourseOutcomes.ts
```

## Phase 1: Template Placeholder Creation

**Purpose**: Create or update lesson_templates with outcome references mapped to document IDs.

**When**: After outcome validation passes

**Why**: Establishes deterministic template IDs for future lesson authoring

### Process

**For Each SOW Entry**:

**Step 1: Map Outcome IDs to Document IDs**

```typescript
const outcomeDocumentIds = await mapOutcomeIdsToDocumentIds(
  databases,
  entry.outcomeRefs,  // ["O1", "O2"]
  courseId
);
// Returns: ["6745abc123...", "6745def456..."]
```

**Step 2: Query for Existing Template (Deterministic)**

```typescript
// PRIMARY lookup: courseId + sow_order (stable)
let existing = await databases.listDocuments(
  'default',
  'lesson_templates',
  [
    Query.equal('courseId', courseId),
    Query.equal('sow_order', entry.order),  // e.g., 1
    Query.limit(1)
  ]
);
```

**Step 3: MIGRATION Fallback (Optional)**

```typescript
// For old templates without sow_order field
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
```

**Step 4: CREATE or UPDATE Decision**

```typescript
const templateData = {
  title: entry.label,
  courseId: courseId,
  sow_order: entry.order,
  outcomeRefs: JSON.stringify(outcomeDocumentIds),  // Real IDs!
  cards: JSON.stringify([]),                        // Empty placeholder
  version: 1,
  status: 'draft',
  createdBy: 'sow_author_agent',
  lesson_type: entry.lesson_type || 'teach',
  estMinutes: entry.estMinutes || 50,
  engagement_tags: JSON.stringify(entry.engagement_tags || []),
  policy: JSON.stringify(entry.policy || {})
};

if (existing.documents.length > 0) {
  // UPDATE existing
  templateDoc = await databases.updateDocument(
    'default',
    'lesson_templates',
    existing.documents[0].$id,
    templateData
  );
  updatedCount++;
  console.log(`✅ Updated #${entry.order}: ${entry.label} (${templateDoc.$id})`);
} else {
  // CREATE new
  templateDoc = await databases.createDocument(
    'default',
    'lesson_templates',
    ID.unique(),
    templateData
  );
  createdCount++;
  console.log(`✅ Created #${entry.order}: ${entry.label} (${templateDoc.$id})`);
}
```

**Step 5: Store Reference Mapping**

```typescript
const oldRef = entry.lessonTemplateRef;  // "AUTO_TBD_1"
const realId = templateDoc.$id;           // "6745abc123def..."

referenceMap.set(oldRef, realId);
```

### Expected Output

```
📝 Creating lesson template placeholders...
   Total entries to process: 48

  ✅ Created #1: Introduction to Numeracy Skills (6745abc...)
  ✅ Updated #2: Check-in: Notation and Units (6745def...)
  ✅ Created #3: Practice: Using Notation and Units (6745ghi...)
  ...

📊 Template Creation Summary:
   Created: 45
   Updated: 3
   Total: 48
```

## Phase 2: SOW Entry Updates

**Purpose**: Replace placeholder template IDs with real document IDs.

**When**: After all templates created/updated

**Why**: Links SOW entries to actual database documents

### Process

**Step 1: Map Entries with Real IDs**

```typescript
const updatedEntries = sowEntries.map((entry) => {
  const realTemplateId = referenceMap.get(entry.lessonTemplateRef);

  if (!realTemplateId) {
    throw new Error(
      `Missing template ID mapping for: ${entry.label}`
    );
  }

  return {
    ...entry,
    lessonTemplateRef: realTemplateId  // Replace placeholder!
  };
});
```

**Step 2: Log Transformations**

```typescript
entries.forEach((entry) => {
  const oldRef = entry.lessonTemplateRef.substring(0, 15) + '...';
  const newRef = realTemplateId.substring(0, 15) + '...';

  console.log(
    `  #${entry.order.toString().padStart(3, ' ')}. ` +
    `${entry.label.padEnd(40, ' ')} ` +
    `${oldRef} → ${newRef}`
  );
});
```

### Expected Output

```
🔗 Updating Authored_SOW entries with real template IDs...

  #  1. Introduction to Numeracy Ski... AUTO_TBD_1      → 6745abc123def...
  #  2. Check-in: Notation and Units    AUTO_TBD_2      → 6745def456ghi...
  #  3. Practice: Using Notation and... AUTO_TBD_3      → 6745ghi789jkl...
  ...

✅ 48 entries updated with real template IDs
```

## Phase 3: Authored_SOW Upsert

**Purpose**: Persist complete SOW document with validated references.

**When**: After entries updated with real IDs

**Why**: Store authoritative SOW in database

### Process

**Step 1: Prepare SOW Data**

```typescript
const authoredSOWData: AuthoredSOWData = {
  courseId: sowData.courseId,
  version: String(sowData.version),
  status: sowData.status,
  entries: updatedEntries,  // With real template IDs!
  metadata: {
    ...sowData.metadata,
    total_lessons: updatedEntries.length,
    total_estimated_minutes: updatedEntries.reduce((sum, e) => sum + (e.estMinutes || 0), 0),
    generated_at: new Date().toISOString(),
    author_agent_version: '1.0'
  },
  accessibility_notes: sowData.metadata.accessibility_notes?.join('\n') || ''
};
```

**Step 2: Upsert via ServerAuthoredSOWDriver**

```typescript
const result = await sowDriver.upsertAuthoredSOW(authoredSOWData);
```

**Internally** (in `ServerAuthoredSOWDriver.upsertAuthoredSOW`):

```typescript
// Check existing by courseId + version
const existing = await this.getByCoruseAndVersion(data.courseId, data.version);

if (existing) {
  // UPDATE
  return await this.updateAuthoredSOW(existing.$id, data);
}

// CREATE new
const docData = {
  courseId: data.courseId,
  version: data.version,
  status: data.status,
  entries: JSON.stringify(data.entries),      // JSON stringification
  metadata: JSON.stringify(data.metadata),
  accessibility_notes: data.accessibility_notes || ''
};

return await this.create<AuthoredSOW>(this.COLLECTION_ID, docData, []);
```

### Expected Output

```
💾 Upserting to Authored_SOW collection...

✅ Successfully seeded Authored_SOW!
   Document ID: 6745xyz789abc...
   Course ID: course_c84473
   Version: 2
   Status: draft
   Created At: 2025-10-04T14:30:00.000Z
   Updated At: 2025-10-04T14:30:00.000Z
   Entries stored: 48 lessons
```

## Phase 4: Post-Seeding Validation

**Purpose**: Verify referential integrity across all collections.

**When**: After Authored_SOW upserted

**Why**: Catch any data inconsistencies before they cause issues

### Process

**Check 1: Uniqueness**

```typescript
const templateIds = updatedEntries.map(e => e.lessonTemplateRef);
const uniqueIds = new Set(templateIds);

if (uniqueIds.size !== templateIds.length) {
  const duplicates = templateIds.filter((id, idx) =>
    templateIds.indexOf(id) !== idx
  );
  throw new Error(`Duplicate template references found:\n${duplicates.join('\n')}`);
}

console.log(`✅ Uniqueness Check: All ${uniqueIds.size} template IDs are unique`);
```

**Check 2: Existence**

```typescript
for (const entry of updatedEntries) {
  await databases.getDocument(
    'default',
    'lesson_templates',
    entry.lessonTemplateRef
  );
  // Throws if document doesn't exist
  validCount++;
}

console.log(`✅ Existence Check: All ${validCount} templates exist in database`);
```

**Check 3: Title Matching** (warning only)

```typescript
for (const entry of updatedEntries) {
  const template = await databases.getDocument(
    'default',
    'lesson_templates',
    entry.lessonTemplateRef
  );

  if (template.title !== entry.label) {
    console.warn(
      `⚠️  Title mismatch #${entry.order}: ` +
      `"${entry.label}" (SOW) vs "${template.title}" (template)`
    );
    titleMismatches++;
  }
}

if (titleMismatches === 0) {
  console.log(`✅ Title Matching: All titles match perfectly`);
} else {
  console.log(`⚠️  Title Matching: ${titleMismatches} mismatches found (non-critical)`);
}
```

### Expected Output

```
✅ Validating template references...

  ✅ Uniqueness Check: All 48 template IDs are unique
  ✅ Existence Check: All 48 templates exist in database
  ✅ Title Matching: All titles match perfectly

🎉 Validation Complete: All critical checks passed!
```

## Verification Steps

After seeding completes, verify the data:

### 1. Check Authored_SOW Document

```bash
# Via Appwrite Console
# Navigate to: Databases → default → Authored_SOW
# Find document with courseId: "course_c84473"
# Verify:
# - version: "2"
# - status: "draft"
# - entries field is populated (JSON string)
```

### 2. Check Lesson Templates

```bash
# Via Appwrite Console
# Navigate to: Databases → default → lesson_templates
# Filter by: courseId = "course_c84473"
# Verify:
# - Count matches SOW entries count (48)
# - All have sow_order field populated
# - outcomeRefs are JSON strings of document IDs (not "O1", "O2")
# - cards are empty arrays: "[]"
```

### 3. Programmatic Verification

```typescript
import { Client, Databases, Query } from 'node-appwrite';

const databases = new Databases(client);

// Get Authored_SOW
const sowDocs = await databases.listDocuments('default', 'Authored_SOW', [
  Query.equal('courseId', 'course_c84473'),
  Query.equal('version', '2')
]);

const sow = sowDocs.documents[0];
const entries = JSON.parse(sow.entries);

console.log(`✅ SOW has ${entries.length} entries`);

// Verify each template exists
for (const entry of entries) {
  const template = await databases.getDocument(
    'default',
    'lesson_templates',
    entry.lessonTemplateRef
  );
  console.log(`✅ Template #${entry.order}: ${template.title}`);
}
```

---

**Next**: See [troubleshooting.md](./troubleshooting.md) for common errors and solutions.
