# SOWV2 Reference-Based Architecture Refactor

## Overview

Transform SOWV2 from a data duplication model to a reference-only model where SOWV2 serves solely as a versioning pointer to Authored_SOW documents.

### Current Architecture (Problem)
- SOWV2 duplicates curriculum data from Authored_SOW
- Data synchronization issues between Authored_SOW and SOWV2
- Hit Appwrite attribute size limits when trying to add missing fields
- No clear upgrade path for students when curriculum improves

### New Architecture (Solution)
- SOWV2 becomes lightweight reference collection
- Only stores: `source_authored_sow_id`, `source_version`, `customizations`
- SOWDriver dereferences to Authored_SOW for curriculum data
- Single source of truth: Authored_SOW
- Easy version upgrades by changing reference
- Driver abstraction hides refactor from frontend

## Schema Comparison

### Current Authored_SOW Schema
```typescript
interface AuthoredSOWEntry {
  order: number;
  lessonTemplateRef: string;  // ← Note: different field name
  label: string;
  lesson_type: 'teach' | 'independent_practice' | 'formative_assessment' |
               'mock_assessment' | 'revision' | 'project' | 'spiral_revisit' | 'summative_assessment';
  coherence: {
    unit: string;
    block_name: string;
    block_index: string;
    prerequisites: string[];
  };
  policy: {
    calculator: string;
    formulae_sheet: string;
    notes: string[];
  };
  engagement_tags: string[];
  outcomeRefs: string[];
  estMinutes?: number;
}

interface AuthoredSOWData {
  courseId: string;
  version: string;
  entries: AuthoredSOWEntry[];
  metadata: {
    course_name: string;
    level: string;
    total_lessons: number;
    total_estimated_minutes: number;
    generated_at: string;
    author_agent_version: string;
    coherence?: {
      policy_notes?: string[];
      sequencing_notes?: string[];
    };
    weeks?: number;
    periods_per_week?: number;
  };
  accessibility_notes?: string;
  status: 'draft' | 'published' | 'archived';
}
```

### Current SOWV2 Schema (Before Refactor)
```typescript
interface SOWEntry {
  order: number;
  lessonTemplateId: string;  // ← Different from AuthoredSOWEntry.lessonTemplateRef
  plannedAt?: string;
  _metadata?: {
    label?: string;
    lesson_type?: string;
    estMinutes?: number;
  };
}

interface SOWData {
  studentId: string;
  courseId: string;
  entries: SOWEntry[];  // ← Duplicates curriculum data
  createdAt: string;
  source_sow_id?: string;
  source_version?: string;
  customizations?: any;
}
```

### New SOWV2 Schema (After Refactor)
```typescript
interface SOWData {
  studentId: string;
  courseId: string;
  entries: AuthoredSOWEntry[];  // ← From dereferenced Authored_SOW
  metadata: AuthoredSOWMetadata;  // ← From dereferenced Authored_SOW
  accessibility_notes?: string;  // ← From dereferenced Authored_SOW
  createdAt: string;
  source_sow_id: string;  // ← Now required
  source_version: string;  // ← Now required
  customizations?: StudentCustomizations;
}

interface StudentCustomizations {
  entries?: {
    [order: number]: {
      plannedAt?: string;
      skipped?: boolean;
      notes?: string;
    };
  };
  preferences?: any;
}
```

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Update SOWV2 Collection Attributes

**Increase customizations field size**:
- Current: 5000 characters
- New: 10000 characters
- Reason: Will store student-specific modifications

**Make source_authored_sow_id required**:
- Current: optional string(50)
- New: required string(50)
- Reason: Core of reference architecture

**Delete entries attribute** (BREAKING CHANGE):
- Current: optional string(10000)
- Action: Remove from collection
- Reason: Will be dereferenced from Authored_SOW

#### Appwrite Commands
```bash
# 1. Increase customizations size
# Via Appwrite Console: Databases > SOWV2 > Attributes > customizations
# Change max size: 5000 → 10000

# 2. Make source_authored_sow_id required
# Via Appwrite Console: Databases > SOWV2 > Attributes > source_authored_sow_id
# Change required: false → true
# NOTE: Must populate all existing records first (see migration)

# 3. Delete entries attribute
# Via Appwrite Console: Databases > SOWV2 > Attributes > entries
# Delete attribute (after migration complete)
```

### Phase 2: TypeScript Type Updates

#### 2.1 Update SOWDriver.ts Types

**File**: `lib/appwrite/driver/SOWDriver.ts`

**Remove SOWEntry interface** (lines ~20-30):
```typescript
// DELETE THIS:
export interface SOWEntry {
  order: number;
  lessonTemplateId: string;
  plannedAt?: string;
  _metadata?: {
    label?: string;
    lesson_type?: string;
    estMinutes?: number;
  };
}
```

**Update SOWData interface** (lines ~32-42):
```typescript
// BEFORE:
export interface SOWData {
  studentId: string;
  courseId: string;
  entries: SOWEntry[];
  createdAt: string;
  source_sow_id?: string;
  source_version?: string;
  customizations?: any;
}

// AFTER:
export interface SOWData {
  studentId: string;
  courseId: string;
  entries: AuthoredSOWEntry[];  // ← Changed type
  metadata: AuthoredSOWMetadata;  // ← Added
  accessibility_notes?: string;  // ← Added
  createdAt: string;
  source_sow_id: string;  // ← Now required
  source_version: string;  // ← Now required
  customizations?: StudentCustomizations;
}

export interface StudentCustomizations {
  entries?: {
    [order: number]: {
      plannedAt?: string;
      skipped?: boolean;
      notes?: string;
    };
  };
  preferences?: any;
}
```

**Add imports** (top of file):
```typescript
import { AuthoredSOWEntry, AuthoredSOWData, AuthoredSOWMetadata } from '../types';
```

### Phase 3: Driver Method Refactoring

#### 3.1 Refactor getSOWForEnrollment() - CRITICAL

**File**: `lib/appwrite/driver/SOWDriver.ts` (lines 34-65)

**Current Implementation**:
```typescript
async getSOWForEnrollment(studentId: string, courseId: string): Promise<SOWData | null> {
  const records = await this.list('SOWV2', [
    Query.equal('studentId', studentId),
    Query.equal('courseId', courseId),
    Query.limit(1)
  ]);

  if (records.length > 0) {
    const record = records[0];
    return {
      studentId: record.studentId,
      courseId: record.courseId,
      entries: JSON.parse(record.entries || '[]'),  // ← OLD: from SOWV2
      createdAt: record.createdAt
    };
  }

  return null;
}
```

**New Implementation with Dereference**:
```typescript
async getSOWForEnrollment(studentId: string, courseId: string): Promise<SOWData | null> {
  // Step 1: Get SOWV2 reference record
  const records = await this.list('SOWV2', [
    Query.equal('studentId', studentId),
    Query.equal('courseId', courseId),
    Query.limit(1)
  ]);

  if (records.length === 0) {
    return null;
  }

  const sowRecord = records[0];

  // Step 2: Dereference to Authored_SOW
  if (!sowRecord.source_authored_sow_id) {
    throw new Error(`SOWV2 record for ${studentId}/${courseId} missing source_authored_sow_id`);
  }

  const authoredSOW = await this.get('Authored_SOW', sowRecord.source_authored_sow_id);

  if (!authoredSOW) {
    throw new Error(
      `Authored_SOW document ${sowRecord.source_authored_sow_id} not found ` +
      `(referenced by SOWV2 for ${studentId}/${courseId})`
    );
  }

  // Step 3: Parse Authored_SOW data
  const authoredEntries: AuthoredSOWEntry[] = JSON.parse(authoredSOW.entries || '[]');
  const authoredMetadata: AuthoredSOWMetadata = JSON.parse(authoredSOW.metadata || '{}');

  // Step 4: Parse customizations
  const customizations: StudentCustomizations = sowRecord.customizations
    ? JSON.parse(sowRecord.customizations)
    : {};

  // Step 5: Return combined data
  return {
    studentId: sowRecord.studentId,
    courseId: sowRecord.courseId,
    entries: authoredEntries,  // ← From Authored_SOW
    metadata: authoredMetadata,  // ← From Authored_SOW
    accessibility_notes: authoredSOW.accessibility_notes,  // ← From Authored_SOW
    createdAt: sowRecord.createdAt,
    source_sow_id: sowRecord.source_authored_sow_id,
    source_version: sowRecord.source_version || 'unknown',
    customizations
  };
}
```

#### 3.2 Refactor copyFromAuthoredSOW() - Simplified

**File**: `lib/appwrite/driver/SOWDriver.ts` (lines 427-467)

**Current Implementation**:
```typescript
async copyFromAuthoredSOW(studentId: string, courseId: string, authoredSOW: any): Promise<void> {
  const entries = JSON.parse(authoredSOW.entries || '[]').map((entry: any, index: number) => ({
    order: index + 1,
    lessonTemplateId: entry.lessonTemplateRef,
    _metadata: {
      label: entry.label,
      lesson_type: entry.lesson_type,
      estMinutes: entry.estMinutes
    }
  }));

  const sowData: SOWData = {
    studentId,
    courseId,
    entries,  // ← Duplicates data
    createdAt: new Date().toISOString(),
    source_sow_id: courseId,
    source_version: authoredSOW.version,
    customizations: {}
  };

  await this.upsertSOW(sowData);
}
```

**New Implementation (Reference Only)**:
```typescript
async copyFromAuthoredSOW(studentId: string, courseId: string, authoredSOW: any): Promise<void> {
  // Create reference-only record (no data duplication)
  const sowReferenceRecord = {
    studentId,
    courseId,
    source_authored_sow_id: authoredSOW.$id,  // ← Store document ID
    source_version: authoredSOW.version,
    customizations: '{}',  // Empty customizations initially
    createdAt: new Date().toISOString()
  };

  // Insert into SOWV2
  await this.databases.createDocument(
    this.databaseId,
    'SOWV2',
    ID.unique(),
    sowReferenceRecord
  );
}
```

#### 3.3 Refactor upsertSOW()

**File**: `lib/appwrite/driver/SOWDriver.ts` (lines 135-186)

**Current Implementation**:
```typescript
async upsertSOW(sowData: SOWData): Promise<void> {
  // ... query existing ...

  const docData: any = {
    studentId: sowData.studentId,
    courseId: sowData.courseId,
    entries: JSON.stringify(sowData.entries),  // ← Don't store entries anymore
    createdAt: sowData.createdAt,
    source_sow_id: sowData.source_sow_id,
    source_version: sowData.source_version
  };

  if (sowData.customizations !== undefined) {
    docData.customizations = JSON.stringify(sowData.customizations);
  }

  // ... create or update ...
}
```

**New Implementation**:
```typescript
async upsertSOW(sowData: SOWData): Promise<void> {
  const existing = await this.list('SOWV2', [
    Query.equal('studentId', sowData.studentId),
    Query.equal('courseId', sowData.courseId),
    Query.limit(1)
  ]);

  if (!sowData.source_sow_id) {
    throw new Error('source_sow_id is required for SOWV2 records');
  }

  const docData: any = {
    studentId: sowData.studentId,
    courseId: sowData.courseId,
    source_authored_sow_id: sowData.source_sow_id,  // ← Required reference
    source_version: sowData.source_version || 'unknown',
    createdAt: sowData.createdAt
    // NOTE: entries NOT stored in SOWV2
  };

  if (sowData.customizations !== undefined) {
    docData.customizations = JSON.stringify(sowData.customizations);
  }

  if (existing.length > 0) {
    await this.databases.updateDocument(
      this.databaseId,
      'SOWV2',
      existing[0].$id,
      docData
    );
  } else {
    await this.databases.createDocument(
      this.databaseId,
      'SOWV2',
      ID.unique(),
      docData
    );
  }
}
```

#### 3.4 Refactor updateCustomizations()

**File**: `lib/appwrite/driver/SOWDriver.ts` (lines 472-502)

**Current Implementation**: Works correctly, no changes needed

```typescript
async updateCustomizations(
  studentId: string,
  courseId: string,
  customizations: any
): Promise<void> {
  const existing = await this.list('SOWV2', [
    Query.equal('studentId', studentId),
    Query.equal('courseId', courseId),
    Query.limit(1)
  ]);

  if (existing.length === 0) {
    throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
  }

  await this.databases.updateDocument(
    this.databaseId,
    'SOWV2',
    existing[0].$id,
    { customizations: JSON.stringify(customizations) }
  );
}
```

**Status**: ✅ No changes needed - already works with reference architecture

#### 3.5 Refactor Unused Write Methods

These methods are defined but not currently used. They need refactoring to modify customizations instead of entries.

**updateSOWEntries()** (lines 214-240):
```typescript
// CURRENT: Modifies entries directly
async updateSOWEntries(studentId: string, courseId: string, entries: SOWEntry[]): Promise<void>

// NEW: Throws error - use updateCustomizations instead
async updateSOWEntries(studentId: string, courseId: string, entries: AuthoredSOWEntry[]): Promise<void> {
  throw new Error(
    'updateSOWEntries is deprecated. Curriculum entries come from Authored_SOW. ' +
    'Use updateCustomizations() to modify student-specific settings.'
  );
}
```

**addLessonToSOW()** (lines 241-272):
```typescript
// CURRENT: Adds lesson to entries array
async addLessonToSOW(studentId: string, courseId: string, lessonTemplateId: string, order?: number): Promise<void>

// NEW: Add to customizations.entries
async addLessonToSOW(studentId: string, courseId: string, lessonTemplateId: string, order?: number): Promise<void> {
  const sowData = await this.getSOWForEnrollment(studentId, courseId);
  if (!sowData) {
    throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
  }

  const customizations = sowData.customizations || { entries: {} };
  const targetOrder = order || sowData.entries.length + 1;

  // Mark as custom addition in customizations
  customizations.entries = customizations.entries || {};
  customizations.entries[targetOrder] = {
    ...customizations.entries[targetOrder],
    custom_lesson_id: lessonTemplateId,
    added_manually: true
  };

  await this.updateCustomizations(studentId, courseId, customizations);
}
```

**removeLessonFromSOW()** (lines 273-306):
```typescript
// CURRENT: Removes from entries array
async removeLessonFromSOW(studentId: string, courseId: string, order: number): Promise<void>

// NEW: Mark as skipped in customizations
async removeLessonFromSOW(studentId: string, courseId: string, order: number): Promise<void> {
  const sowData = await this.getSOWForEnrollment(studentId, courseId);
  if (!sowData) {
    throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
  }

  const customizations = sowData.customizations || { entries: {} };
  customizations.entries = customizations.entries || {};
  customizations.entries[order] = {
    ...customizations.entries[order],
    skipped: true
  };

  await this.updateCustomizations(studentId, courseId, customizations);
}
```

**scheduleLessonForDate()** (lines 341-374):
```typescript
// CURRENT: Modifies entries[].plannedAt
async scheduleLessonForDate(studentId: string, courseId: string, order: number, plannedDate: string): Promise<void>

// NEW: Store in customizations.entries[order].plannedAt
async scheduleLessonForDate(studentId: string, courseId: string, order: number, plannedDate: string): Promise<void> {
  const sowData = await this.getSOWForEnrollment(studentId, courseId);
  if (!sowData) {
    throw new Error(`No SOW found for student ${studentId}, course ${courseId}`);
  }

  const customizations = sowData.customizations || { entries: {} };
  customizations.entries = customizations.entries || {};
  customizations.entries[order] = {
    ...customizations.entries[order],
    plannedAt: plannedDate
  };

  await this.updateCustomizations(studentId, courseId, customizations);
}
```

### Phase 4: Frontend Breaking Changes

#### 4.1 Fix planner-service.ts Field Name

**File**: `lib/appwrite/planner-service.ts` (lines 444-446)

**BREAKING CHANGE**: Field name mismatch

**Current Code**:
```typescript
entries: sowEntries.map(entry => ({
  order: entry.order,
  lessonTemplateId: entry.lessonTemplateId  // ← BREAKS! Field doesn't exist in AuthoredSOWEntry
}))
```

**Fixed Code**:
```typescript
entries: sowEntries.map(entry => ({
  order: entry.order,
  lessonTemplateId: entry.lessonTemplateRef  // ← Use correct field name
}))
```

**Context**: After refactor, `getSOWForEnrollment()` returns `AuthoredSOWEntry[]` which uses `lessonTemplateRef` instead of `lessonTemplateId`.

#### 4.2 Verify enrollment-service.ts (No Changes Needed)

**File**: `lib/services/enrollment-service.ts`

**Lines 38-46**: Uses getSOWForEnrollment and copyFromAuthoredSOW
```typescript
const existingSOW = await sowDriver.getSOWForEnrollment(studentId, courseId);

if (existingSOW) {
  console.log(`[EnrollmentService] SOW already exists for ${studentId}/${courseId}, skipping copy`);
  return;
}

await sowDriver.copyFromAuthoredSOW(studentId, courseId, authoredSOW);
```

**Status**: ✅ No changes needed - driver abstraction handles refactor

**Line 71**: Uses updateCustomizations
```typescript
await sowDriver.updateCustomizations(studentId, courseId, customizations);
```

**Status**: ✅ No changes needed

### Phase 5: Migration Strategy

#### 5.1 Data Migration Script

Create migration script to populate `source_authored_sow_id` for existing SOWV2 records.

**File**: `scripts/migrate-sowv2-to-references.ts`

```typescript
import { config } from 'dotenv';
import { Client, Databases, Query, ID } from 'node-appwrite';

config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

async function migrateSOWV2ToReferences() {
  console.log('🔄 Starting SOWV2 migration to reference-based architecture...\n');

  // Step 1: Get all SOWV2 records
  const allRecords = await databases.listDocuments('default', 'SOWV2', [
    Query.limit(500)
  ]);

  console.log(`📊 Found ${allRecords.total} SOWV2 records\n`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const record of allRecords.documents) {
    try {
      // Skip if already has source_authored_sow_id
      if (record.source_authored_sow_id) {
        console.log(`✅ ${record.studentId}/${record.courseId} already migrated`);
        migratedCount++;
        continue;
      }

      // Find corresponding Authored_SOW by courseId
      const authoredSOWs = await databases.listDocuments('default', 'Authored_SOW', [
        Query.equal('courseId', record.courseId),
        Query.equal('status', 'published'),
        Query.limit(1)
      ]);

      if (authoredSOWs.documents.length === 0) {
        console.error(`❌ No Authored_SOW found for courseId: ${record.courseId}`);
        errorCount++;
        continue;
      }

      const authoredSOW = authoredSOWs.documents[0];

      // Update SOWV2 record with reference
      await databases.updateDocument('default', 'SOWV2', record.$id, {
        source_authored_sow_id: authoredSOW.$id,
        source_version: authoredSOW.version || 'v1.0'
      });

      console.log(`✅ Migrated ${record.studentId}/${record.courseId} → ${authoredSOW.$id}`);
      migratedCount++;

    } catch (error: any) {
      console.error(`❌ Failed to migrate ${record.$id}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Successfully migrated: ${migratedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`\n🎉 Migration complete!`);
}

migrateSOWV2ToReferences().catch(console.error);
```

#### 5.2 Migration Execution Plan

**Order of Operations**:

1. **Backup data** (via Appwrite console export)
2. **Run migration script** to populate source_authored_sow_id
3. **Verify migration** (all records have source_authored_sow_id)
4. **Deploy code changes** (driver refactor)
5. **Test integration** (enrollment flow, planner service)
6. **Make source_authored_sow_id required** (via Appwrite console)
7. **Delete entries attribute** (via Appwrite console)

**Rollback Plan**:
- Keep entries attribute for 1 week after deployment
- Monitor error logs for dereference failures
- If critical issues: revert code, keep old schema

### Phase 6: Documentation Updates

This phase updates **7 sections** of `docs/appwrite-data-model.md` to reflect the reference-based architecture across all mentions of SOWV2.

#### 6.1 Collections Overview Table (Line 30)

**File**: `docs/appwrite-data-model.md` (line 30)

**Current Text**:
```markdown
| `sow` / `SOWV2` | Scheme of work planning | Collection/User-scoped | Course curriculum structure |
```

**Updated Text**:
```markdown
| `sow` / `SOWV2` | Scheme of work planning | Collection/User-scoped | References Authored_SOW, stores customizations |
```

**Rationale**: Key Relationships column should reflect that SOWV2 is now a reference/pointer, not a copy of curriculum structure.

---

#### 6.2 Data Model Diagram - Student Enrollment Layer (Lines 114-125)

**File**: `docs/appwrite-data-model.md` (lines 114-125)

**Current Diagram**:
```
    ┌─────────────────────┐          ┌──────────────────────────┐
    │   enrollments       │          │       SOWV2              │
    │  • studentId (FK)   │  creates │  • studentId (FK)        │
    │  • courseId (FK)    │─────────►│  • courseId (FK)         │
    │  • role             │          │  • entries[] (personalized)│
    │  • enrolledAt       │          │  • source_authored_sow_id│
    └─────────────────────┘          │  • source_version        │
                                     │  • customizations        │
                                     │                          │
                                     │  Created from: Authored_SOW│
                                     │  Service: enrollment-service.ts│
                                     └───────────┬──────────────┘
```

**Updated Diagram**:
```
    ┌─────────────────────┐          ┌──────────────────────────────┐
    │   enrollments       │          │       SOWV2                  │
    │  • studentId (FK)   │  creates │  • studentId (FK)            │
    │  • courseId (FK)    │─────────►│  • courseId (FK)             │
    │  • role             │          │  • source_authored_sow_id ───┼──┐
    │  • enrolledAt       │          │  • source_version            │  │
    └─────────────────────┘          │  • customizations            │  │
                                     │                              │  │
                                     │  References: Authored_SOW    │  │
                                     │  Service: enrollment-service │  │
                                     └──────────────────────────────┘  │
                                                                        │
                                     ┌──────────────────────────────────┘
                                     │  dereferences
                                     ▼
                                     ┌──────────────────────────────┐
                                     │       Authored_SOW           │
                                     │  • courseId                  │
                                     │  • version                   │
                                     │  • entries[] (curriculum)    │
                                     │  • metadata                  │
                                     └──────────────────────────────┘
```

**Rationale**:
- Remove `entries[]` field from SOWV2 box (no longer stored there)
- Add visual arrow showing dereference relationship to Authored_SOW
- Change "personalized" to emphasize it's a reference, not a copy
- Show Authored_SOW as the source of curriculum data

---

#### 6.3 Key Relationships Section (Lines 201-208)

**File**: `docs/appwrite-data-model.md` (lines 201-208)

**Current Text**:
```markdown
  Template vs Instance:
  Authored_SOW (template, public) → SOWV2 (instance, user-scoped)
  lesson_templates (template, public) → sessions.lessonSnapshot (instance, user-scoped)
```

**Updated Text**:
```markdown
  Template vs Instance (Reference Architecture):
  Authored_SOW (template, public) ←─references── SOWV2 (pointer + customizations, user-scoped)
  lesson_templates (template, public) → sessions.lessonSnapshot (snapshot copy, user-scoped)

  Note: SOWV2 uses dereference pattern (pointer to template) while sessions use snapshot pattern (frozen copy)
```

**Rationale**:
- Clarify that SOWV2 and sessions use different patterns
- SOWV2 = live reference (always reflects latest curriculum via dereference)
- sessions = frozen snapshot (lesson content at time of session start)
- Show bidirectional arrow for SOWV2 to emphasize reference lookup

---

#### 6.4 SOWV2 Detailed Collection Schema (Lines 582-637)

**File**: `docs/appwrite-data-model.md` (lines 582-637)

**Current Documentation**:
```markdown
### Scheme of Work Collections (SOW and SOWV2)

**Purpose**: Manages curriculum planning and lesson sequencing.

#### SOWV2 Collection (Current)

**Security**: `documentSecurity: false` - Collection-level permissions.

**Schema**:
```typescript
interface SOWV2 {
  $id: string;                  // Appwrite document ID
  studentId: string;            // Reference to student (required, max 50 chars)
  courseId: string;             // Reference to course (required, max 50 chars)
  entries: string;              // JSON array of curriculum entries (max 10000 chars, default: "[]")
  createdAt: string;            // Creation timestamp (required, ISO datetime)

  // Source Tracking (links to Authored_SOW template)
  source_authored_sow_id: string; // Reference to Authored_SOW document (max 50 chars)
  source_version: string;       // Version of Authored_SOW used (max 20 chars)
  customizations: string;       // JSON object tracking student-specific changes (max 5000 chars, default: "{}")
}
```

**Indexes**:
- `unique_student_course` - Unique compound index on (studentId, courseId)

**Customizations Structure**:
```typescript
interface SOWCustomizations {
  modified_entries?: number[];   // Indices of entries modified from template
  added_entries?: number[];      // Indices of entries added beyond template
  removed_entries?: number[];    // Indices of template entries removed
  personalization_notes?: string; // Reasons for customizations
}
```

#### Legacy SOW Collection
... (rest of schema)
```

**New Documentation**:
```markdown
### Scheme of Work Collections (SOW and SOWV2)

**Purpose**: Manages curriculum planning and lesson sequencing.

#### SOWV2 Collection (Reference Architecture)

**Security**: `documentSecurity: false` - Collection-level permissions.

**Purpose**: Version tracking and student customizations for curriculum.

SOWV2 uses a **reference-based architecture** where curriculum data is NOT duplicated. Instead, SOWV2 stores a reference to the authoritative Authored_SOW document and overlays student-specific customizations.

**Architecture Pattern**:
```
SOWV2 (lightweight pointer) ──references──> Authored_SOW (curriculum data)
   │
   └─> customizations (student-specific overrides)
```

**Schema**:
```typescript
interface SOWV2 {
  $id: string;                      // Appwrite document ID
  studentId: string;                // Reference to student (required, max 50 chars)
  courseId: string;                 // Reference to course (required, max 50 chars)
  source_authored_sow_id: string;   // Document ID of Authored_SOW (required, max 50 chars)
  source_version: string;           // Version identifier for debugging/logging (required, max 20 chars)
  customizations: string;           // Student-specific modifications (max 10000 chars, default: "{}")
  createdAt: string;                // Enrollment timestamp (required, ISO datetime)

  // REMOVED FIELDS (no longer stored in SOWV2):
  // entries: NO LONGER EXISTS - dereferenced from Authored_SOW
}
```

**Indexes**:
- `unique_student_course` - Unique compound index on (studentId, courseId)

**Customizations Schema**:
```typescript
interface StudentCustomizations {
  entries?: {
    [order: number]: {              // Key = lesson order number from Authored_SOW
      plannedAt?: string;           // Scheduled date (ISO datetime)
      skipped?: boolean;            // Lesson skipped by student
      notes?: string;               // Student notes for lesson
      custom_lesson_id?: string;    // Manually added lesson (not in template)
      added_manually?: boolean;     // Flag for custom additions
    };
  };
  preferences?: any;                // Future: student learning preferences
}
```

**Data Access Pattern**:

When reading SOW data via `SOWDriver.getSOWForEnrollment()`:
1. **Query SOWV2** by studentId + courseId (1 query)
2. **Dereference to Authored_SOW** using source_authored_sow_id (1 query)
3. **Parse curriculum data** from Authored_SOW (entries, metadata, accessibility_notes)
4. **Overlay customizations** on top of curriculum data
5. **Return unified SOWData** interface to caller

**Example Flow**:
```typescript
// Student enrollment creates lightweight reference
SOWV2 = {
  studentId: "student-123",
  courseId: "course_c84473",
  source_authored_sow_id: "authored_sow_abc",  // ← Pointer to curriculum
  source_version: "v1.0",
  customizations: "{}"  // Empty initially
}

// Reading SOW performs dereference
const sow = await getSOWForEnrollment("student-123", "course_c84473");
// Returns: { entries: [...], metadata: {...}, customizations: {...} }
// ← entries/metadata from Authored_SOW, customizations from SOWV2
```

**Benefits**:
- ✅ **Single Source of Truth**: Authored_SOW is authoritative curriculum data
- ✅ **No Data Duplication**: Eliminates sync issues between collections
- ✅ **No Size Limits**: SOWV2 becomes lightweight (only 4 fields)
- ✅ **Easy Version Upgrades**: Change source_authored_sow_id to upgrade student to new curriculum
- ✅ **Student Customizations Preserved**: Stored separately, survives curriculum updates
- ✅ **Better Architecture**: Clear separation of concerns (curriculum vs student state)

**Migration from Legacy Schema**:
- Old SOWV2 records had `entries` field (duplicated curriculum)
- New SOWV2 records use `source_authored_sow_id` (reference to curriculum)
- Migration script: `scripts/migrate-sowv2-to-references.ts`

#### Legacy SOW Collection
... (rest of schema unchanged)
```

**Rationale**:
- Complete rewrite of SOWV2 section to reflect reference architecture
- Add visual diagram of reference pattern
- Document data access pattern step-by-step
- Include example flow for clarity
- List all benefits of new architecture
- Note migration path from old schema

---

#### 6.5 Student Learning Journey Diagram (Lines 738-751)

**File**: `docs/appwrite-data-model.md` (lines 738-751)

**Current Diagram**:
```markdown
### Student Learning Journey
```
User (Appwrite Auth)
  ↓
Student (profile)
  ↓
Enrollment (course access)
  ↓
Session (learning instance)
  ↓
Evidence (assessment data)
  ↓
MasteryV2 (progress tracking)
```
```

**Updated Diagram**:
```markdown
### Student Learning Journey
```
User (Appwrite Auth)
  ↓
Student (profile)
  ↓
Enrollment (course access)
  ↓
SOWV2 (curriculum reference) ─references─> Authored_SOW (curriculum template)
  ↓
Session (learning instance)
  ↓
Evidence (assessment data)
  ↓
MasteryV2 (progress tracking)
```

**Note**: SOWV2 dereferences to Authored_SOW for curriculum data. Student-specific customizations stored in SOWV2.customizations field.
```

**Rationale**:
- Insert SOWV2 step after Enrollment (it's created during enrollment)
- Show reference relationship to Authored_SOW
- Add note explaining dereference pattern

---

#### 6.6 Curriculum Management Flow (Lines 753-764)

**File**: `docs/appwrite-data-model.md` (lines 753-764)

**Current Diagram**:
```markdown
### Curriculum Management
```
Course (subject definition)
  ↓
Course Outcomes (learning objectives)
  ↓
Authored_SOW (AI-generated curriculum template)
  ├─→ Lesson Templates (generated content)
  └─→ SOWV2 (student-specific instance)
       ↓
     Routine (spaced repetition)
```
```

**Updated Diagram**:
```markdown
### Curriculum Management
```
Course (subject definition)
  ↓
Course Outcomes (learning objectives)
  ↓
Authored_SOW (AI-generated curriculum template)
  ├─→ Lesson Templates (generated content)
  └─→ SOWV2 (student reference + customizations) ←┐
       ↓                                           │
     Routine (spaced repetition)                   │
                                                    │
  Note: SOWV2 stores pointer to Authored_SOW ──────┘
        Curriculum data accessed via dereference
```
```

**Rationale**:
- Update description from "instance" to "reference + customizations"
- Add note explaining reference relationship
- Show visual loop back to Authored_SOW

---

#### 6.7 AI Agent Integration - Enrollment Flow (Lines 813-820)

**File**: `docs/appwrite-data-model.md` (lines 813-820)

**Current Text**:
```markdown
3. **Enrollment Flow**
   - Student enrolls in course
   - Enrollment service creates personalized SOWV2 from Authored_SOW template
   - SOWV2 tracks source template via `source_authored_sow_id` and `source_version`
   - Customizations stored for student-specific adaptations
```

**Updated Text**:
```markdown
3. **Enrollment Flow (Reference Architecture)**
   - Student enrolls in course
   - Enrollment service creates lightweight SOWV2 reference record (NOT a copy)
   - SOWV2 stores document ID pointer via `source_authored_sow_id` (required field)
   - Version tracked via `source_version` for debugging/logging
   - Empty customizations initialized: `{}`
   - **No curriculum data duplicated** - accessed via dereference to Authored_SOW
   - Student-specific modifications stored in `customizations` field as they occur

**Data Flow**:
```
Student enrolls
  ↓
enrollment-service.ts calls SOWDriver.copyFromAuthoredSOW()
  ↓
Creates SOWV2 with:
  - source_authored_sow_id = authoredSOW.$id  (pointer, not copy)
  - source_version = authoredSOW.version
  - customizations = "{}"
  ↓
SOWDriver.getSOWForEnrollment() dereferences to Authored_SOW for curriculum data
```

**Rationale**:
- Emphasize that SOWV2 is NOT a copy (common misconception)
- Explain what "reference architecture" means in practical terms
- Document data flow step-by-step
- Clarify when customizations are populated (during learning, not enrollment)

### Phase 7: Testing Checklist

#### Integration Tests

**File**: `tests/sowv2-reference-architecture.test.ts`

```typescript
describe('SOWV2 Reference Architecture', () => {
  test('getSOWForEnrollment dereferences to Authored_SOW', async () => {
    // Given: Published Authored_SOW
    const authoredSOW = await createAuthoredSOW({
      courseId: 'test-course',
      version: 'v1.0',
      entries: [{ order: 1, lessonTemplateRef: 'lesson-1', ... }]
    });

    // And: Student enrolled (SOWV2 reference created)
    await sowDriver.copyFromAuthoredSOW('student-1', 'test-course', authoredSOW);

    // When: Fetch SOW for student
    const sowData = await sowDriver.getSOWForEnrollment('student-1', 'test-course');

    // Then: Returns curriculum data from Authored_SOW
    expect(sowData).not.toBeNull();
    expect(sowData!.entries).toHaveLength(1);
    expect(sowData!.entries[0].lessonTemplateRef).toBe('lesson-1');
    expect(sowData!.source_sow_id).toBe(authoredSOW.$id);
  });

  test('customizations overlay on curriculum data', async () => {
    // Given: Enrolled student
    await sowDriver.copyFromAuthoredSOW('student-1', 'test-course', authoredSOW);

    // When: Update customizations
    await sowDriver.updateCustomizations('student-1', 'test-course', {
      entries: {
        1: { plannedAt: '2025-01-15', notes: 'Review fractions' }
      }
    });

    // Then: Customizations returned with curriculum data
    const sowData = await sowDriver.getSOWForEnrollment('student-1', 'test-course');
    expect(sowData!.customizations.entries[1].plannedAt).toBe('2025-01-15');
  });

  test('throws error if Authored_SOW missing', async () => {
    // Given: SOWV2 references non-existent Authored_SOW
    await databases.createDocument('default', 'SOWV2', ID.unique(), {
      studentId: 'student-1',
      courseId: 'test-course',
      source_authored_sow_id: 'nonexistent-id',
      source_version: 'v1.0',
      createdAt: new Date().toISOString()
    });

    // When/Then: getSOWForEnrollment throws error
    await expect(
      sowDriver.getSOWForEnrollment('student-1', 'test-course')
    ).rejects.toThrow('Authored_SOW document nonexistent-id not found');
  });

  test('enrollment flow creates reference-only record', async () => {
    // When: Student enrolls
    await sowDriver.copyFromAuthoredSOW('student-1', 'test-course', authoredSOW);

    // Then: SOWV2 record has minimal data
    const sowv2Records = await databases.listDocuments('default', 'SOWV2', [
      Query.equal('studentId', 'student-1'),
      Query.equal('courseId', 'test-course')
    ]);

    expect(sowv2Records.documents).toHaveLength(1);
    const record = sowv2Records.documents[0];
    expect(record.source_authored_sow_id).toBe(authoredSOW.$id);
    expect(record.entries).toBeUndefined();  // Should NOT exist
  });
});
```

#### Manual Testing

- [ ] Enrollment flow creates SOWV2 reference correctly
- [ ] getSOWForEnrollment returns AuthoredSOWEntry[] with correct field names
- [ ] planner-service.ts works with lessonTemplateRef field
- [ ] updateCustomizations persists student changes
- [ ] scheduleLessonForDate updates customizations
- [ ] Error handling for missing Authored_SOW
- [ ] Migration script populates source_authored_sow_id
- [ ] Performance: dereference adds <100ms latency

### Phase 8: Risk Assessment

#### High Risk

**Breaking Change: Field Name Mismatch**
- Impact: planner-service.ts breaks with `lessonTemplateId` → `lessonTemplateRef`
- Mitigation: Update before deployment
- Detection: TypeScript compiler error

**Missing Authored_SOW References**
- Impact: Students can't access curriculum if Authored_SOW deleted
- Mitigation: Prevent Authored_SOW deletion if referenced by SOWV2
- Detection: Foreign key constraint or check script

**Migration Failures**
- Impact: Some students' SOWs can't find Authored_SOW
- Mitigation: Rollback plan with entries field retention
- Detection: Migration script error reporting

#### Medium Risk

**Performance: Dereference Latency**
- Impact: Every SOW read requires 2 database queries
- Mitigation: Add caching layer for Authored_SOW documents
- Detection: Monitor query performance metrics

**Data Inconsistency During Migration**
- Impact: Students see mixed data during transition
- Mitigation: Deploy during low-traffic window
- Detection: Error logs, user reports

#### Low Risk

**Customizations Schema Evolution**
- Impact: Need to update customizations structure in future
- Mitigation: JSON field is flexible, backward compatible
- Detection: N/A - design choice

## Implementation Phases Summary

### Phase 1: Preparation (Week 1)
- [ ] Backup Appwrite database
- [ ] Create migration script
- [ ] Write integration tests
- [ ] Update documentation

### Phase 2: Migration (Week 2)
- [ ] Run migration script (populate source_authored_sow_id)
- [ ] Verify all records migrated successfully
- [ ] Increase customizations field size

### Phase 3: Code Deployment (Week 2-3)
- [ ] Update TypeScript types (SOWData interface)
- [ ] Refactor SOWDriver methods (getSOWForEnrollment, copyFromAuthoredSOW, etc.)
- [ ] Fix planner-service.ts breaking change
- [ ] Deploy to staging environment
- [ ] Run integration tests

### Phase 4: Production Rollout (Week 3)
- [ ] Deploy to production
- [ ] Monitor error logs for 48 hours
- [ ] Make source_authored_sow_id required
- [ ] Delete entries attribute (after verification)

### Phase 5: Cleanup (Week 4)
- [ ] Remove deprecated methods or update with clear errors
- [ ] Update all documentation
- [ ] Remove rollback infrastructure

## Benefits Achieved

✅ **Single Source of Truth**: Authored_SOW is authoritative curriculum data
✅ **No Data Duplication**: Eliminates sync issues between Authored_SOW and SOWV2
✅ **No Size Limits**: SOWV2 becomes lightweight reference collection
✅ **Easy Version Upgrades**: Change source_authored_sow_id to new curriculum version
✅ **Student Customizations Preserved**: Stored separately in customizations field
✅ **Better Architecture**: Clear separation of concerns (curriculum vs student state)
✅ **Maintainability**: Driver abstraction hides complexity from frontend

## References

- Original task: `/tasks/fixing_authored_sow_mismatch.md`
- SOWDriver implementation: `lib/appwrite/driver/SOWDriver.ts`
- Type definitions: `lib/appwrite/types/index.ts`
- Planner service: `lib/appwrite/planner-service.ts`
- Enrollment service: `lib/services/enrollment-service.ts`
- Data model docs: `docs/appwrite-data-model.md`
