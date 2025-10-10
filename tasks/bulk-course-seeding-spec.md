# Bulk Course Seeding Implementation Specification

**Version:** 1.0
**Date:** 2025-10-10
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Key Decisions & Clarifications](#key-decisions--clarifications)
5. [Phase 1A: Single Course Seeding (Test First)](#phase-1a-single-course-seeding-test-first)
6. [Phase 1B: Extend to Bulk Processing](#phase-1b-extend-to-bulk-processing)
7. [Phase 2: Refactor seedAuthoredSOW.ts](#phase-2-refactor-seedauthoredsowts)
8. [Phase 3: Update Documentation](#phase-3-update-documentation)
9. [Phase 4: Testing](#phase-4-testing)
10. [Implementation Checklist](#implementation-checklist)
11. [Migration Guide](#migration-guide)

---

## Overview

### Problem Statement

Currently, the SOW seeding script (`seedAuthoredSOW.ts`) performs three preparatory phases (-3, -2, -1) that:
- Create missing course documents
- Extract outcomes from SQA database
- Populate course_outcomes collection

This creates tight coupling between SOW seeding and course setup, making it:
- Difficult to bulk-populate all courses at once
- Slow (repeated SQA queries for each SOW)
- Hard to maintain (mixed responsibilities)

### Solution Architecture

**Separate concerns into two scripts:**

1. **bulkSeedAllCourses.ts (NEW)**
   - One-time bulk seeding of ALL SQA courses
   - Populates `courses` and `course_outcomes` collections
   - Run once during initial setup

2. **seedAuthoredSOW.ts (REFACTORED)**
   - Validates prerequisites (fail-fast if courses/outcomes missing)
   - Seeds lesson templates and Authored_SOW only
   - Run per-course as SOW files become available

**Benefits:**
- Clear separation of concerns
- Faster SOW seeding (no SQA queries)
- Easier bulk course population
- Better error messages (fail-fast with actionable guidance)

---

## Key Decisions & Clarifications

### Gap 1: SQA Data Structure ✅

**Confirmed Structure:**

```typescript
// sqa_education.sqa_current document
{
  $id: string;
  course_code: string;      // ⚠️  NULL - not populated
  subject: string;          // Top-level field (underscored: "application_of_mathematics")
  level: string;            // Top-level field (underscored: "national_4")
  data: string;             // JSON string containing actual course data
}

// Parsed data structure (from data field):
{
  level_name: "National 4",
  level_aliases: ["Nat 4", "N4"],
  qualification: {
    title: "National 4 Science Course",
    course_code: "C765 74",        // ← ACTUAL COURSE CODE (nested)
    scqf: {
      level: 4,
      credits: 24
    }
  },
  course_structure: {
    units: [
      {
        code: "HV7Y 74",
        title: "Unit Title",
        scqf_credits: 6,
        outcomes: [
          {
            id: "O1",
            title: "Outcome title",
            assessment_standards: [...]
          }
        ]
      }
    ]
  }
}
```

**Key Points:**
- Course code is NESTED in `data.qualification.course_code` (not top-level)
- Subject and level are top-level fields (underscored format)
- Must parse JSON in `data` field to access course metadata

### Gap 2: courses Collection Schema ✅

**Confirmed Schema:**

```typescript
interface CourseDocument {
  // Auto fields
  $id: string;
  $createdAt: string;
  $updatedAt: string;

  // Required fields
  courseId: string;          // "course_c76574" (deterministic, used as FK)
  subject: string;           // "science" (hyphenated)
  level: string;             // "national-4" (hyphenated)
  schema_version: number;    // 2 (current schema)

  // SQA reference (field name confirmed: sqaCode)
  sqaCode: string;           // "C765 74" (original SQA course code)

  // Optional metadata
  title?: string;            // "National 4 Science Course"
}
```

### Gap 3: Duplicate Handling ✅

**Decision:** Skip if courseId already exists
- Query `courses` collection by `courseId`
- If exists: Log "Already exists" and continue to next course
- No updates to existing courses (idempotent behavior)

### Gap 4: courseId Source ✅

**Decision:** courseId comes from SOW JSON file (with CLI override option)

```typescript
// Default: Use courseId from SOW file
const courseId = sowData.courseId;

// Optional: CLI override
tsx scripts/seedAuthoredSOW.ts --sow /path/to/sow.json --course-id course_c76574
```

### Gap 5: Subject/Level Normalization ✅

**Decision:** `courses` collection is single source of truth
- Bulk script converts: underscores → hyphens ("national_4" → "national-4")
- SOW script no longer parses subject/level from filename
- All metadata comes from `courses` collection

### Gap 6: Error Messages ✅

**Fail-fast with actionable guidance:**

```
❌ PREREQUISITE FAILED: Course document not found

Course ID: course_c76574

💡 Action Required:
   Run the bulk seeding script to populate courses and outcomes:
   tsx scripts/bulkSeedAllCourses.ts
```

### Gap 7: Batch vs Single ✅

**Decision:** Batch processing only
- Process ALL SQA courses in one run
- No single-course mode (run infrequently, so batch is acceptable)
- Progress logging for long-running operations

---

## Phase 1A: Single Course Seeding (Test First)

`★ Implementation Strategy ─────────────────────────────────────`
**IMPORTANT**: Before building the full bulk processing script, we'll first create a simpler single-course version to test and validate our approach. This allows us to:
1. Verify SQA data structure assumptions
2. Test course/outcome creation logic
3. Validate database writes
4. Debug issues on one course before scaling to 150+ courses
`─────────────────────────────────────────────────────────────────`

### Phase 1A Goal

Create `seedSingleCourse.ts` - a simplified script that processes **ONE SQA course** specified by CLI argument.

### File Location

`assistant-ui-frontend/scripts/seedSingleCourse.ts`

### CLI Design

```bash
# Seed a single course by providing subject and level
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3

# Or by course code (if we know it)
tsx scripts/seedSingleCourse.ts --course-code "C844 73"

# Dry run mode
tsx scripts/seedSingleCourse.ts --subject science --level national_4 --dry-run
```

### Simplified Algorithm Flow

```
START
  ↓
1. Parse CLI Arguments
   - subject: string (underscored)
   - level: string (underscored)
   - dryRun: boolean
  ↓
2. Initialize Appwrite Admin Client
  ↓
3. Query SINGLE SQA Course
   ┌───────────────────────────────────────────┐
   │ const result = await databases.listDocuments(│
   │   'sqa_education',                        │
   │   'sqa_current',                          │
   │   [                                       │
   │     Query.equal('subject', subject),      │
   │     Query.equal('level', level),          │
   │     Query.limit(1)                        │
   │   ]                                       │
   │ )                                         │
   │                                           │
   │ if (result.documents.length === 0) {      │
   │   throw new Error('SQA course not found') │
   │ }                                         │
   │                                           │
   │ const sqaDoc = result.documents[0]        │
   └───────────────────────────────────────────┘
  ↓
4. Process Single Course
   ↓
   4.1. PARSE DATA FIELD
        Extract: courseCode = data.qualification.course_code
   ↓
   4.2. GENERATE COURSE ID
        courseId = "course_" + normalized(courseCode)
   ↓
   4.3. CONVERT SUBJECT/LEVEL
        Underscores → Hyphens
   ↓
   4.4. CHECK IF COURSE EXISTS
        If exists: Log and EXIT
   ↓
   4.5. CREATE COURSE DOCUMENT
   ↓
   4.6. EXTRACT OUTCOMES
   ↓
   4.7. CHECK IF OUTCOMES EXIST
   ↓
   4.8. CREATE COURSE_OUTCOME DOCUMENTS
   ↓
   4.9. LOG SUCCESS SUMMARY
  ↓
END
```

### Key Functions (Simplified)

```typescript
// ============================================================
// Main Function
// ============================================================
async function seedSingleCourse(
  subject: string,
  level: string,
  dryRun: boolean = false
): Promise<void> {
  // 1. Query single SQA course
  // 2. Process course
  // 3. Log results
}

// ============================================================
// Single SQA Course Fetcher
// ============================================================
async function getSQACourse(
  databases: Databases,
  subject: string,
  level: string
): Promise<SQACourse> {
  const result = await databases.listDocuments(
    'sqa_education',
    'sqa_current',
    [
      Query.equal('subject', subject),
      Query.equal('level', level),
      Query.limit(1)
    ]
  );

  if (result.documents.length === 0) {
    throw new Error(
      `SQA course not found: subject="${subject}", level="${level}"`
    );
  }

  return result.documents[0] as SQACourse;
}

// ============================================================
// All other helper functions same as Phase 1B
// ============================================================
// - extractCourseCode()
// - generateCourseId()
// - underscoreToHyphen()
// - createCourseDocument()
// - extractOutcomesFromSQADoc()
// - generateTeacherGuidance()
// - extractKeywords()
// - populateCourseOutcomes()
```

### Expected Output (Single Course)

```
🌱 Seeding Single Course...

✅ Environment variables validated
✅ Admin client created

📚 Fetching SQA course: application_of_mathematics - national_3
✅ Found SQA course: C844 73

Processing course...

📦 Parsing SQA data...
  Course Code: C844 73
  Course ID: course_c84473
  Subject: application-of-mathematics (converted from application_of_mathematics)
  Level: national-3 (converted from national_3)
  Title: National 3 Application of Mathematics Course

📝 Checking if course already exists...
  ✅ Course does not exist, proceeding with creation

💾 Creating course document...
  ✅ Course created: course_c84473

📚 Extracting outcomes from SQA data...
  Found 3 units
  Unit 1: Managing Finance and Statistics (HV7X 73) - 6 SCQF credits
    ✅ Extracted 4 outcomes
  Unit 2: Geometry and Measures (HV7Y 73) - 6 SCQF credits
    ✅ Extracted 3 outcomes
  Unit 3: Numeracy (HV80 73) - 12 SCQF credits
    ✅ Extracted 5 outcomes
  Total outcomes extracted: 12

📝 Checking if outcomes already exist...
  ✅ No existing outcomes found, proceeding with creation

💾 Creating course_outcome documents...
  [1/12] ✅ O1: Analyse an everyday situation...
  [2/12] ✅ O2: Carry out calculations...
  [3/12] ✅ O3: Compare costs...
  ...
  [12/12] ✅ O12: Use scale when working with...

✅ Created 12 course_outcome documents

═══════════════════════════════════════════════════════════
🎉 SUCCESS!
═══════════════════════════════════════════════════════════
Course ID: course_c84473
Course: National 3 Application of Mathematics
Outcomes Created: 12
═══════════════════════════════════════════════════════════
```

### Validation Steps After Phase 1A

**Before proceeding to Phase 1B, manually verify in Appwrite console:**

1. **courses Collection**
   - [ ] Document exists with courseId = "course_c84473"
   - [ ] subject = "application-of-mathematics" (hyphenated)
   - [ ] level = "national-3" (hyphenated)
   - [ ] sqaCode = "C844 73" (original)
   - [ ] schema_version = 2
   - [ ] title populated correctly

2. **course_outcomes Collection**
   - [ ] Exactly 12 documents exist with courseId = "course_c84473"
   - [ ] outcomeId fields: "O1" through "O12"
   - [ ] outcomeTitle fields populated
   - [ ] assessmentStandards is JSON string
   - [ ] teacherGuidance populated
   - [ ] keywords is JSON array

3. **Data Quality Checks**
   - [ ] All fields have expected data types
   - [ ] No null/undefined values in required fields
   - [ ] JSON strings are valid (can be parsed)
   - [ ] References look correct

4. **Idempotency Test**
   ```bash
   # Run same command again
   tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
   # Should skip (already exists)
   ```

**Once validated, proceed to Phase 1B to add bulk processing.**

---

## Phase 1B: Extend to Bulk Processing

### Phase 1B Goal

Extend the validated single-course logic to process **ALL** SQA courses in batch.

### File to Create

`assistant-ui-frontend/scripts/bulkSeedAllCourses.ts`

### TypeScript Interfaces

```typescript
/**
 * SQA course document from sqa_education.sqa_current collection
 */
interface SQACourse {
  $id: string;
  course_code: string;      // NULL in database
  subject: string;          // "application_of_mathematics" (underscored)
  level: string;            // "national_4" (underscored)
  data: string;             // JSON string
}

/**
 * Parsed data from SQA course data field
 */
interface SQACourseData {
  level_name: string;
  level_aliases: string[];
  qualification: {
    title: string;
    course_code: string;    // "C765 74"
    scqf: {
      level: number;
      credits: number;
    };
  };
  course_structure?: {
    units: Array<{
      code: string;
      title: string;
      scqf_credits: number;
      outcomes: Array<{
        id: string;
        title: string;
        assessment_standards: any[];
      }>;
    }>;
  };
  units?: Array<any>;  // Fallback structure
}

/**
 * Course outcome import structure
 */
interface CourseOutcomeImport {
  courseId: string;
  courseSqaCode: string;
  unitCode: string;
  unitTitle: string;
  scqfCredits: number;
  outcomeId: string;
  outcomeTitle: string;
  assessmentStandards: string;  // JSON string
  teacherGuidance: string;
  keywords: string[];
}

/**
 * Result of processing a single course
 */
interface BulkSeedResult {
  courseCode: string;
  courseId: string;
  subject: string;
  level: string;
  status: 'success' | 'skipped' | 'failed';
  coursesCreated: number;      // 0 or 1
  outcomesCreated: number;     // N outcomes
  error?: string;
  timestamp: string;
}

/**
 * CLI configuration
 */
interface BulkSeedConfig {
  dryRun: boolean;           // Validation only, no writes
  continueOnError: boolean;  // Continue if one course fails
}
```

### Algorithm Flow

```
START
  ↓
1. Parse CLI Arguments
   - --dry-run: boolean
   - --stop-on-error: boolean
  ↓
2. Initialize Appwrite Admin Client
   - Load .env.local
   - Validate: NEXT_PUBLIC_APPWRITE_ENDPOINT
   - Validate: NEXT_PUBLIC_APPWRITE_PROJECT_ID
   - Validate: APPWRITE_API_KEY
   - Create Client with admin API key
  ↓
3. Query ALL SQA Courses (with pagination)
   ┌───────────────────────────────────────────┐
   │ const allCourses: SQACourse[] = []        │
   │ let offset = 0                            │
   │ const limit = 100                         │
   │                                           │
   │ while (true) {                            │
   │   result = await databases.listDocuments( │
   │     'sqa_education',                      │
   │     'sqa_current',                        │
   │     [Query.limit(100), Query.offset(...)] │
   │   )                                       │
   │   allCourses.push(...result.documents)    │
   │   if (result.documents.length < 100) break│
   │   offset += 100                           │
   │ }                                         │
   └───────────────────────────────────────────┘
  ↓
4. FOR EACH sqa_current document:
   ↓
   4.1. PARSE DATA FIELD
        ┌────────────────────────────────────────┐
        │ const data: SQACourseData =            │
        │   JSON.parse(sqaDoc.data)              │
        │                                        │
        │ const courseCode =                     │
        │   data.qualification?.course_code      │
        │                                        │
        │ if (!courseCode) {                     │
        │   LOG WARNING: No course code found    │
        │   SKIP → NEXT COURSE                   │
        │ }                                      │
        └────────────────────────────────────────┘
   ↓
   4.2. GENERATE COURSE ID
        ┌────────────────────────────────────────┐
        │ Input: "C765 74"                       │
        │   ↓                                    │
        │ Remove spaces: "C76574"                │
        │   ↓                                    │
        │ Lowercase: "c76574"                    │
        │   ↓                                    │
        │ Prepend: "course_c76574"               │
        └────────────────────────────────────────┘
   ↓
   4.3. CONVERT SUBJECT/LEVEL (Underscores → Hyphens)
        ┌────────────────────────────────────────┐
        │ subject: sqaDoc.subject                │
        │   "application_of_mathematics"         │
        │   ↓ underscoreToHyphen()               │
        │   "application-of-mathematics"         │
        │                                        │
        │ level: sqaDoc.level                    │
        │   "national_4"                         │
        │   ↓ underscoreToHyphen()               │
        │   "national-4"                         │
        └────────────────────────────────────────┘
   ↓
   4.4. CHECK IF COURSE EXISTS (Idempotency)
        ┌────────────────────────────────────────┐
        │ const existing = await databases.      │
        │   listDocuments(                       │
        │     'default',                         │
        │     'courses',                         │
        │     [Query.equal('courseId', courseId)]│
        │   )                                    │
        │                                        │
        │ if (existing.documents.length > 0) {   │
        │   LOG: "⏭️  Already exists"            │
        │   SKIP → NEXT COURSE                   │
        │ }                                      │
        └────────────────────────────────────────┘
   ↓
   4.5. CREATE COURSE DOCUMENT
        ┌────────────────────────────────────────┐
        │ if (!dryRun) {                         │
        │   await databases.createDocument(      │
        │     'default',                         │
        │     'courses',                         │
        │     'unique()',                        │
        │     {                                  │
        │       courseId: "course_c76574",       │
        │       subject: "science",              │
        │       level: "national-4",             │
        │       sqaCode: "C765 74",              │
        │       schema_version: 2,               │
        │       title: data.qualification.title  │
        │     }                                  │
        │   )                                    │
        │   LOG: "✅ Course created"             │
        │ }                                      │
        └────────────────────────────────────────┘
   ↓
   4.6. EXTRACT OUTCOMES FROM SQA DATA
        ┌────────────────────────────────────────┐
        │ const units =                          │
        │   data.course_structure?.units ||      │
        │   data.units || []                     │
        │                                        │
        │ const outcomes: CourseOutcomeImport[]  │
        │   = []                                 │
        │                                        │
        │ for (const unit of units) {            │
        │   for (const outcome of unit.outcomes) {│
        │     // Generate derived fields         │
        │     const guidance =                   │
        │       generateTeacherGuidance(...)     │
        │     const keywords =                   │
        │       extractKeywords(...)             │
        │                                        │
        │     outcomes.push({                    │
        │       courseId: "course_c76574",       │
        │       courseSqaCode: "C765 74",        │
        │       unitCode: unit.code,             │
        │       unitTitle: unit.title,           │
        │       scqfCredits: unit.scqf_credits,  │
        │       outcomeId: outcome.id,           │
        │       outcomeTitle: outcome.title,     │
        │       assessmentStandards:             │
        │         JSON.stringify(...),           │
        │       teacherGuidance: guidance,       │
        │       keywords: keywords               │
        │     })                                 │
        │   }                                    │
        │ }                                      │
        │                                        │
        │ if (outcomes.length === 0) {           │
        │   LOG WARNING: No outcomes found       │
        │ }                                      │
        └────────────────────────────────────────┘
   ↓
   4.7. CHECK IF OUTCOMES EXIST (Idempotency)
        ┌────────────────────────────────────────┐
        │ const existingOutcomes = await         │
        │   databases.listDocuments(             │
        │     'default',                         │
        │     'course_outcomes',                 │
        │     [Query.equal('courseId', courseId),│
        │      Query.limit(1)]                   │
        │   )                                    │
        │                                        │
        │ if (existingOutcomes.documents.length) {│
        │   LOG: "⏭️  Outcomes already exist"    │
        │   SKIP outcomes creation               │
        │ }                                      │
        └────────────────────────────────────────┘
   ↓
   4.8. CREATE COURSE_OUTCOME DOCUMENTS
        ┌────────────────────────────────────────┐
        │ if (!dryRun && outcomes.length > 0) {  │
        │   let created = 0                      │
        │   for (const outcome of outcomes) {    │
        │     await databases.createDocument(    │
        │       'default',                       │
        │       'course_outcomes',               │
        │       ID.unique(),                     │
        │       {                                │
        │         courseId: outcome.courseId,    │
        │         courseSqaCode: outcome.courseSqaCode,│
        │         unitCode: outcome.unitCode,    │
        │         unitTitle: outcome.unitTitle,  │
        │         scqfCredits: outcome.scqfCredits,│
        │         outcomeId: outcome.outcomeId,  │
        │         outcomeTitle: outcome.outcomeTitle,│
        │         assessmentStandards:           │
        │           outcome.assessmentStandards, │
        │         teacherGuidance:               │
        │           outcome.teacherGuidance,     │
        │         keywords:                      │
        │           JSON.stringify(outcome.keywords)│
        │       }                                │
        │     )                                  │
        │     created++                          │
        │   }                                    │
        │   LOG: "✅ Created N outcomes"         │
        │ }                                      │
        └────────────────────────────────────────┘
   ↓
   4.9. LOG RESULT
        ┌────────────────────────────────────────┐
        │ Success:                               │
        │   "✅ course_c76574 (Science -         │
        │    National 4): 12 outcomes created"   │
        │                                        │
        │ Skipped:                               │
        │   "⏭️  course_c76574: Already exists"  │
        │                                        │
        │ Failed:                                │
        │   "❌ course_c76574: Error message"    │
        └────────────────────────────────────────┘
   ↓
   4.10. STORE RESULT
        ┌────────────────────────────────────────┐
        │ results.push({                         │
        │   courseCode: "C765 74",               │
        │   courseId: "course_c76574",           │
        │   subject: "science",                  │
        │   level: "national-4",                 │
        │   status: "success",                   │
        │   coursesCreated: 1,                   │
        │   outcomesCreated: 12,                 │
        │   timestamp: new Date().toISOString()  │
        │ })                                     │
        └────────────────────────────────────────┘
  ↓
5. GENERATE SUMMARY REPORT
   ┌─────────────────────────────────────────────┐
   │ Console Output:                             │
   │ ═══════════════════════════════════════════ │
   │ 📊 Bulk Seeding Summary                     │
   │ ═══════════════════════════════════════════ │
   │ Total SQA Documents: 150                    │
   │ ✅ Courses Created: 142                     │
   │ ⏭️  Courses Skipped: 5 (already exist)      │
   │ ❌ Courses Failed: 3                        │
   │ 📝 Total Outcomes Created: 1,856            │
   │                                             │
   │ JSON Report:                                │
   │ 📁 ./output/bulk-seed-report-{ts}.json      │
   └─────────────────────────────────────────────┘
  ↓
END
```

### Key Functions

```typescript
// ============================================================
// Main Orchestrator
// ============================================================
async function bulkSeedAllCourses(
  config: BulkSeedConfig
): Promise<BulkSeedResult[]> {
  // 1. Initialize Appwrite
  // 2. Query all SQA courses
  // 3. Process each course
  // 4. Generate report
  // 5. Return results
}

// ============================================================
// SQA Data Fetcher (with pagination)
// ============================================================
async function getAllSQACourses(
  databases: Databases
): Promise<SQACourse[]> {
  const allCourses: SQACourse[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const result = await databases.listDocuments(
      'sqa_education',
      'sqa_current',
      [
        Query.limit(limit),
        Query.offset(offset)
      ]
    );

    allCourses.push(...result.documents as SQACourse[]);

    if (result.documents.length < limit) break;
    offset += limit;
  }

  return allCourses;
}

// ============================================================
// Course Code Extractor
// ============================================================
function extractCourseCode(sqaDoc: SQACourse): string | null {
  try {
    const data: SQACourseData = JSON.parse(sqaDoc.data);
    return data.qualification?.course_code || null;
  } catch (error) {
    console.error(`Failed to parse data for ${sqaDoc.$id}:`, error);
    return null;
  }
}

// ============================================================
// Course ID Generator
// ============================================================
function generateCourseId(courseCode: string): string {
  // Input: "C765 74"
  // Output: "course_c76574"

  const normalized = courseCode
    .replace(/\s+/g, '')  // Remove spaces: "C76574"
    .toLowerCase();        // Lowercase: "c76574"

  return `course_${normalized}`;
}

// ============================================================
// Normalization Helper
// ============================================================
function underscoreToHyphen(str: string): string {
  // "national_4" → "national-4"
  // "application_of_mathematics" → "application-of-mathematics"
  return str.replace(/_/g, '-');
}

// ============================================================
// Course Document Creator
// ============================================================
async function createCourseDocument(
  databases: Databases,
  sqaDoc: SQACourse,
  courseId: string,
  courseCode: string,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would create course: ${courseId}`);
    return { success: true };
  }

  try {
    const data: SQACourseData = JSON.parse(sqaDoc.data);

    await databases.createDocument(
      'default',
      'courses',
      'unique()',
      {
        courseId,
        subject: underscoreToHyphen(sqaDoc.subject),
        level: underscoreToHyphen(sqaDoc.level),
        sqaCode: courseCode,
        schema_version: 2,
        title: data.qualification?.title || ''
      }
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================
// Outcome Extraction (copy from existing Phase -2)
// ============================================================
function extractOutcomesFromSQADoc(
  sqaDoc: SQACourse,
  courseId: string,
  courseCode: string
): CourseOutcomeImport[] {
  const courseOutcomes: CourseOutcomeImport[] = [];

  try {
    const data: SQACourseData = JSON.parse(sqaDoc.data);
    const units = data.course_structure?.units || data.units || [];

    for (const unit of units) {
      for (const outcome of unit.outcomes) {
        const teacherGuidance = generateTeacherGuidance(
          outcome.assessment_standards
        );
        const keywords = extractKeywords(
          outcome.title,
          outcome.assessment_standards
        );

        courseOutcomes.push({
          courseId,
          courseSqaCode: courseCode,
          unitCode: unit.code,
          unitTitle: unit.title,
          scqfCredits: unit.scqf_credits,
          outcomeId: outcome.id,
          outcomeTitle: outcome.title,
          assessmentStandards: JSON.stringify(outcome.assessment_standards),
          teacherGuidance,
          keywords
        });
      }
    }
  } catch (error: any) {
    console.error(`Failed to extract outcomes for ${courseId}:`, error);
  }

  return courseOutcomes;
}

// ============================================================
// Helper: Generate Teacher Guidance
// ============================================================
function generateTeacherGuidance(assessmentStandards: any[]): string {
  const guidance: string[] = [];

  assessmentStandards.forEach(as => {
    let asGuidance = `**${as.code}**: ${as.desc}`;
    if (as.marking_guidance) asGuidance += `\n  Marking: ${as.marking_guidance}`;
    if (as.skills_list?.length > 0) asGuidance += `\n  Skills: ${as.skills_list.join(', ')}`;
    guidance.push(asGuidance);
  });

  return guidance.join('\n\n');
}

// ============================================================
// Helper: Extract Keywords
// ============================================================
function extractKeywords(
  outcomeTitle: string,
  assessmentStandards: any[]
): string[] {
  const keywords = new Set<string>();

  // Extract from title (words > 3 chars)
  const titleWords = outcomeTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  titleWords.forEach(word => keywords.add(word));

  // Extract from assessment standards (first 3 words > 4 chars)
  assessmentStandards.forEach(as => {
    const descWords = as.desc
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4);
    descWords.slice(0, 3).forEach(word => keywords.add(word));
  });

  return Array.from(keywords);
}

// ============================================================
// Outcome Population
// ============================================================
async function populateCourseOutcomes(
  databases: Databases,
  courseId: string,
  outcomes: CourseOutcomeImport[],
  dryRun: boolean
): Promise<number> {
  if (dryRun) {
    console.log(`  [DRY RUN] Would create ${outcomes.length} outcomes`);
    return outcomes.length;
  }

  // Check if already populated
  const existing = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (existing.documents.length > 0) {
    console.log(`  ⏭️  Outcomes already exist for ${courseId}`);
    return 0;
  }

  let created = 0;
  for (const outcome of outcomes) {
    await databases.createDocument(
      'default',
      'course_outcomes',
      ID.unique(),
      {
        courseId: outcome.courseId,
        courseSqaCode: outcome.courseSqaCode,
        unitCode: outcome.unitCode,
        unitTitle: outcome.unitTitle,
        scqfCredits: outcome.scqfCredits,
        outcomeId: outcome.outcomeId,
        outcomeTitle: outcome.outcomeTitle,
        assessmentStandards: outcome.assessmentStandards,
        teacherGuidance: outcome.teacherGuidance,
        keywords: JSON.stringify(outcome.keywords)
      }
    );
    created++;
  }

  return created;
}

// ============================================================
// Single Course Processor
// ============================================================
async function processSingleCourse(
  databases: Databases,
  sqaDoc: SQACourse,
  config: BulkSeedConfig
): Promise<BulkSeedResult> {
  const startTime = Date.now();

  try {
    // Step 1: Extract course code
    const courseCode = extractCourseCode(sqaDoc);

    if (!courseCode) {
      return {
        courseCode: 'UNKNOWN',
        courseId: 'UNKNOWN',
        subject: sqaDoc.subject,
        level: sqaDoc.level,
        status: 'failed',
        coursesCreated: 0,
        outcomesCreated: 0,
        error: 'Course code not found in data.qualification.course_code',
        timestamp: new Date().toISOString()
      };
    }

    const courseId = generateCourseId(courseCode);

    // Step 2: Check if course exists
    const existing = await databases.listDocuments(
      'default',
      'courses',
      [Query.equal('courseId', courseId), Query.limit(1)]
    );

    if (existing.documents.length > 0) {
      return {
        courseCode,
        courseId,
        subject: sqaDoc.subject,
        level: sqaDoc.level,
        status: 'skipped',
        coursesCreated: 0,
        outcomesCreated: 0,
        error: 'Course already exists',
        timestamp: new Date().toISOString()
      };
    }

    // Step 3: Create course document
    const courseResult = await createCourseDocument(
      databases,
      sqaDoc,
      courseId,
      courseCode,
      config.dryRun
    );

    if (!courseResult.success) {
      return {
        courseCode,
        courseId,
        subject: sqaDoc.subject,
        level: sqaDoc.level,
        status: 'failed',
        coursesCreated: 0,
        outcomesCreated: 0,
        error: `Failed to create course: ${courseResult.error}`,
        timestamp: new Date().toISOString()
      };
    }

    // Step 4: Extract and populate outcomes
    const outcomes = extractOutcomesFromSQADoc(sqaDoc, courseId, courseCode);
    const outcomesCreated = await populateCourseOutcomes(
      databases,
      courseId,
      outcomes,
      config.dryRun
    );

    return {
      courseCode,
      courseId,
      subject: sqaDoc.subject,
      level: sqaDoc.level,
      status: 'success',
      coursesCreated: 1,
      outcomesCreated,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    return {
      courseCode: 'ERROR',
      courseId: 'ERROR',
      subject: sqaDoc.subject,
      level: sqaDoc.level,
      status: 'failed',
      coursesCreated: 0,
      outcomesCreated: 0,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================================
// Report Generator
// ============================================================
function generateReport(
  results: BulkSeedResult[],
  config: BulkSeedConfig
): void {
  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    failed: results.filter(r => r.status === 'failed').length,
    outcomesCreated: results.reduce((sum, r) => sum + r.outcomesCreated, 0)
  };

  // Console output
  console.log('\n' + '='.repeat(60));
  console.log('📊 Bulk Seeding Summary');
  console.log('='.repeat(60));
  console.log(`Total SQA Documents: ${summary.total}`);
  console.log(`✅ Courses Created: ${summary.success}`);
  console.log(`⏭️  Courses Skipped: ${summary.skipped}`);
  console.log(`❌ Courses Failed: ${summary.failed}`);
  console.log(`📝 Total Outcomes Created: ${summary.outcomesCreated}`);

  // Write JSON report
  const reportPath = `./output/bulk-seed-report-${Date.now()}.json`;
  const report = {
    timestamp: new Date().toISOString(),
    config,
    summary,
    results
  };

  fs.mkdirSync('./output', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📁 Report saved: ${reportPath}`);
}
```

### CLI Arguments

```bash
# Default: Process all courses, continue on error
tsx scripts/bulkSeedAllCourses.ts

# Dry run (validation only, no database writes)
tsx scripts/bulkSeedAllCourses.ts --dry-run

# Stop on first error (default: continue on error)
tsx scripts/bulkSeedAllCourses.ts --stop-on-error
```

### Expected Output

**Console Output:**

```
🌱 Starting Bulk Course Seeding...

✅ Environment variables validated
   Endpoint: https://cloud.appwrite.io/v1
   Project: 67421f3c001c9dd05a4e

✅ Admin client created with API key authentication

📚 Fetching all SQA courses...
✅ Found 150 SQA courses

Processing courses...

[1/150] Processing: C765 74 (science - national_4)
  ✅ Course created: course_c76574
  ✅ Created 12 outcomes

[2/150] Processing: C844 73 (application_of_mathematics - national_3)
  ⏭️  Skipped: Already exists

[3/150] Processing: NULL (mathematics - national_5)
  ❌ Failed: Course code not found in data

...

============================================================
📊 Bulk Seeding Summary
============================================================
Total SQA Documents: 150
✅ Courses Created: 142
⏭️  Courses Skipped: 5 (already exist)
❌ Courses Failed: 3
📝 Total Outcomes Created: 1,856

📁 Report saved: ./output/bulk-seed-report-1728563890123.json
```

**JSON Report Structure:**

```json
{
  "timestamp": "2025-10-10T10:00:00.000Z",
  "config": {
    "dryRun": false,
    "continueOnError": true
  },
  "summary": {
    "total": 150,
    "success": 142,
    "skipped": 5,
    "failed": 3,
    "outcomesCreated": 1856
  },
  "results": [
    {
      "courseCode": "C765 74",
      "courseId": "course_c76574",
      "subject": "science",
      "level": "national-4",
      "status": "success",
      "coursesCreated": 1,
      "outcomesCreated": 12,
      "timestamp": "2025-10-10T10:00:05.000Z"
    },
    {
      "courseCode": "C844 73",
      "courseId": "course_c84473",
      "subject": "application-of-mathematics",
      "level": "national-3",
      "status": "skipped",
      "coursesCreated": 0,
      "outcomesCreated": 0,
      "error": "Course already exists",
      "timestamp": "2025-10-10T10:00:06.000Z"
    }
  ]
}
```

---

## Phase 2: Refactor seedAuthoredSOW.ts

### Files to Modify

`assistant-ui-frontend/scripts/seedAuthoredSOW.ts`

### Code Sections to Remove

```typescript
// ❌ REMOVE: Lines 146-160 - parseSubjectLevel function
function parseSubjectLevel(fileName: string): { subject: string; level: string } {
  // ... REMOVE ENTIRE FUNCTION
}

// ❌ REMOVE: Lines 174-206 - ensureCourseExists function (PHASE -3)
async function ensureCourseExists(
  databases: Databases,
  courseId: string,
  subject: string,
  level: string
): Promise<void> {
  // ... REMOVE ENTIRE FUNCTION
}

// ❌ REMOVE: Lines 211-296 - extractOutcomesFromSQA function (PHASE -2)
async function extractOutcomesFromSQA(
  databases: Databases,
  sowData: SOWJSONFile,
  subject: string,
  level: string,
  outputDir: string,
  fileName: string
): Promise<void> {
  // ... REMOVE ENTIRE FUNCTION
}

// ❌ REMOVE: Lines 301-359 - populateCourseOutcomes function (PHASE -1)
async function populateCourseOutcomes(
  databases: Databases,
  courseId: string,
  outputDir: string,
  fileName: string
): Promise<void> {
  // ... REMOVE ENTIRE FUNCTION
}

// ❌ REMOVE: Lines 950-967 - Subject/Level parsing from filename
const fileName = path.basename(sowFilePath, '.json');
const { subject: subjectRaw, level: levelRaw } = parseSubjectLevel(fileName + '.json');
const subject = subjectRaw.replace(/-/g, '_');
const level = levelRaw.replace(/-/g, '_');
// ... REMOVE THIS ENTIRE SECTION

// ❌ REMOVE: Lines 972-988 - PHASE -3, -2, -1 calls
console.log('📦 PHASE -3: Ensure Course Document Exists');
await ensureCourseExists(databases, sowData.courseId, subjectRaw, levelRaw);

console.log('📦 PHASE -2: Extract Outcomes from SQA');
await extractOutcomesFromSQA(databases, sowData, subject, level, outputDir, fileName);

console.log('📦 PHASE -1: Populate course_outcomes Collection');
await populateCourseOutcomes(databases, sowData.courseId, outputDir, fileName);
// ... REMOVE ALL OF THIS
```

### New Code to Add

#### 1. Prerequisite Validation Function

```typescript
/**
 * Validate that course and course_outcomes exist before seeding SOW
 * FAIL-FAST with actionable error messages
 *
 * @param databases - Appwrite Databases instance
 * @param courseId - Course ID to validate
 * @param sowEntries - SOW entries to validate outcome references
 * @throws Error if prerequisites not met
 */
async function validatePrerequisites(
  databases: Databases,
  courseId: string,
  sowEntries: AuthoredSOWEntry[]
): Promise<void> {
  console.log('\n🔍 PHASE 0: Validating Prerequisites...\n');

  // ============================================================
  // CHECK 1: Course Document Exists
  // ============================================================
  console.log('  Checking course document...');
  const courseCheck = await databases.listDocuments(
    'default',
    'courses',
    [
      Query.equal('courseId', courseId),
      Query.limit(1)
    ]
  );

  if (courseCheck.documents.length === 0) {
    throw new Error(
      `❌ PREREQUISITE FAILED: Course document not found\n\n` +
      `Course ID: ${courseId}\n\n` +
      `💡 Action Required:\n` +
      `   1. Run the bulk seeding script to populate courses and outcomes:\n` +
      `      tsx scripts/bulkSeedAllCourses.ts\n\n` +
      `   2. Or verify the courseId is correct in your SOW file\n`
    );
  }

  const courseDoc = courseCheck.documents[0];
  console.log(`  ✅ Course exists: ${courseId}`);
  console.log(`     Subject: ${courseDoc.subject}`);
  console.log(`     Level: ${courseDoc.level}`);
  console.log(`     SQA Code: ${courseDoc.sqaCode}`);

  // ============================================================
  // CHECK 2: Course Outcomes Populated
  // ============================================================
  console.log('\n  Checking course outcomes...');
  const outcomesCheck = await databases.listDocuments(
    'default',
    'course_outcomes',
    [
      Query.equal('courseId', courseId),
      Query.limit(1)
    ]
  );

  if (outcomesCheck.documents.length === 0) {
    throw new Error(
      `❌ PREREQUISITE FAILED: No course outcomes found\n\n` +
      `Course ID: ${courseId}\n\n` +
      `💡 Action Required:\n` +
      `   Run the bulk seeding script to populate course outcomes:\n` +
      `   tsx scripts/bulkSeedAllCourses.ts\n`
    );
  }
  console.log(`  ✅ Course outcomes populated`);

  // ============================================================
  // CHECK 3: All Outcome References Valid
  // ============================================================
  console.log('\n  Validating outcome references in SOW entries...');
  await validateOutcomeReferences(databases, sowEntries, courseId);

  console.log('\n✅ All prerequisites validated\n');
}
```

#### 2. Update seedSingleSOW Function

```typescript
async function seedSingleSOW(
  sowFilePath: string,
  courseIdOverride?: string  // NEW: Optional CLI override
): Promise<void> {
  console.log('🌱 Starting Authored_SOW seed script...\n');

  // ... (environment validation, client setup - UNCHANGED)

  // ============================================================
  // Read SOW file and determine courseId
  // ============================================================
  console.log(`📖 Reading SOW data from: ${sowFilePath}`);

  if (!fs.existsSync(sowFilePath)) {
    throw new Error(`File not found: ${sowFilePath}`);
  }

  const fileContent = fs.readFileSync(sowFilePath, 'utf-8');
  const sowData: SOWJSONFile = JSON.parse(fileContent);

  // Use CLI override if provided, otherwise use SOW file courseId
  const courseId = courseIdOverride || sowData.courseId;

  if (courseIdOverride) {
    console.log(`⚠️  Using CLI override courseId: ${courseId}`);
  } else {
    console.log(`✅ Using courseId from SOW file: ${courseId}`);
  }

  console.log(`   Version: ${sowData.version}`);
  console.log(`   Status: ${sowData.status}`);
  console.log(`   Entries: ${sowData.entries.length} lessons\n`);

  // ============================================================
  // NEW: PHASE 0 - Comprehensive Pre-Flight Validation
  // ============================================================
  await validatePrerequisites(databases, courseId, sowData.entries);

  // ============================================================
  // PHASE 1: Create/Update Lesson Template Placeholders
  // (Everything else remains UNCHANGED)
  // ============================================================
  const referenceMap = await createOrUpdateLessonTemplates(
    databases,
    sowData.entries,
    courseId  // Use determined courseId
  );

  // ============================================================
  // PHASE 2: Update Authored_SOW Entries with Real Template IDs
  // (UNCHANGED)
  // ============================================================
  const updatedEntries = await updateEntriesWithTemplateRefs(
    sowData.entries,
    referenceMap
  );

  // ============================================================
  // PHASE 3: Prepare and Upsert Authored_SOW Data
  // (UNCHANGED)
  // ============================================================
  const authoredSOWData: AuthoredSOWData = {
    courseId,  // Use determined courseId
    version: String(sowData.version),
    status: sowData.status,
    entries: updatedEntries,
    metadata: {
      ...sowData.metadata,
      total_lessons: updatedEntries.length,
      total_estimated_minutes: updatedEntries.reduce((sum, entry) => sum + (entry.estMinutes || 0), 0),
      generated_at: new Date().toISOString(),
      author_agent_version: '1.0'
    },
    accessibility_notes: Array.isArray(sowData.metadata.accessibility_notes)
      ? sowData.metadata.accessibility_notes.join('\n')
      : sowData.metadata.accessibility_notes || ''
  };

  // ... (rest of function unchanged)
}
```

#### 3. Update CLI Argument Parsing

```typescript
interface CLIArgs {
  mode: 'single' | 'named' | 'batch';
  sowFile?: string;
  name?: string;
  inputDir?: string;
  validate?: boolean;
  courseId?: string;  // NEW
}

function parseCLIArgs(): CLIArgs {
  const args = minimist(process.argv.slice(2));

  // ... (existing logic)

  return {
    mode: /* ... */,
    sowFile: args.sow,
    courseId: args['course-id'],  // NEW
    // ... other args
  };
}

// Update main() to pass courseId
async function main() {
  const args = parseCLIArgs();

  // ... (existing logic)

  if (args.mode === 'single') {
    await seedSingleSOW(args.sowFile!, args.courseId);  // Pass courseId
  }
  // ... etc
}
```

### Updated Workflow

**OLD Workflow (Deprecated):**
```
seedAuthoredSOW.ts
  ↓
PHASE -3: Create course if missing
  ↓
PHASE -2: Extract outcomes from SQA
  ↓
PHASE -1: Populate course_outcomes
  ↓
PHASE 0-4: Seed SOW
```

**NEW Workflow:**
```
Step 1: bulkSeedAllCourses.ts (run once)
  ↓
  Creates courses + course_outcomes

Step 2: seedAuthoredSOW.ts (per SOW)
  ↓
PHASE 0: Validate prerequisites (FAIL-FAST)
  ↓
PHASE 1-4: Seed SOW
```

---

## Phase 3: Update Documentation

### Files to Update

1. `docs/Seeding/README.md`
2. `docs/Seeding/architecture.md`
3. `docs/Seeding/seeding-scripts-reference.md`
4. `docs/Seeding/step-by-step-guide.md`

### Specific Changes

#### 1. README.md

**Section: Prerequisites**

Replace entire prerequisites section with:

```markdown
## Prerequisites

### 1. **Bulk Seed All Courses (REQUIRED FIRST STEP)**

⚠️  **NEW:** Before seeding any SOW, you MUST populate the courses and course_outcomes collections.

```bash
# Run ONCE to seed all SQA courses
tsx scripts/bulkSeedAllCourses.ts

# Optional: Dry run to validate (no database writes)
tsx scripts/bulkSeedAllCourses.ts --dry-run
```

This creates:
- Course documents in `courses` collection (one per SQA course)
- Course outcome documents in `course_outcomes` collection (all outcomes)

**Output:**
- Console: Summary of courses and outcomes created
- File: `./output/bulk-seed-report-{timestamp}.json`

**When to run:**
- Initial project setup
- When new SQA courses are added to `sqa_education.sqa_current`
- Safe to re-run (idempotent - skips existing courses)

### 2. **SOW Data File**

Ensure the SOW JSON file exists:
```
langgraph-author-agent/data/sow_authored_AOM_nat3.json
```

SOW file must include `courseId` field matching the bulk-seeded course.

### 3. **Environment Variables**

Configure `.env.local`:
```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
APPWRITE_API_KEY=your_admin_api_key
```
```

**Section: Quick Start**

Replace with:

```markdown
## Quick Start

### Step 1: Bulk Seed (One-Time Setup)

```bash
cd assistant-ui-frontend
tsx scripts/bulkSeedAllCourses.ts
```

**Expected output:**
```
✅ Courses Created: 142
✅ Total Outcomes Created: 1,856
```

### Step 2: Seed Individual SOW

```bash
# Default: Use courseId from SOW file
npm run seed:authored-sow

# With courseId override
tsx scripts/seedAuthoredSOW.ts --sow /path/to/sow.json --course-id course_c76574
```

**Expected output:**
```
✅ Course exists: course_c76574
✅ Course outcomes populated
✅ Lesson templates: 48 created/updated
✅ Authored_SOW: 1 document upserted
```
```

**Section: Workflow Changes**

Add new section:

```markdown
## Workflow Changes

### OLD Workflow (Deprecated)

```
SOW Seeding Script (seedAuthoredSOW.ts)
  ├─> PHASE -3: Create course if missing
  ├─> PHASE -2: Extract outcomes from SQA
  ├─> PHASE -1: Populate course_outcomes
  └─> PHASE 0-4: Seed SOW
```

**Problems:**
- Tight coupling between SOW and course setup
- Repeated SQA queries (slow)
- Mixed responsibilities

### NEW Workflow

```
Step 1: Bulk Seed (once)
  bulkSeedAllCourses.ts
    ├─> Process all sqa_education.sqa_current documents
    ├─> Create courses collection documents
    └─> Create course_outcomes collection documents

Step 2: SOW Seeding (per course)
  seedAuthoredSOW.ts
    ├─> PHASE 0: Validate prerequisites (FAIL-FAST)
    └─> PHASE 1-4: Seed SOW
```

**Benefits:**
- Clear separation of concerns
- Faster SOW seeding (no SQA queries)
- Better error messages
- Easier bulk course management
```

#### 2. architecture.md

**Section: Data Flow**

Replace data flow diagram:

```markdown
## Data Flow (UPDATED)

### Step 1: One-Time Bulk Seeding

```
SQA Education Database (sqa_education.sqa_current)
         ↓
bulkSeedAllCourses.ts
         ↓
┌──────────────────────────────────┐
│  default database                │
│  ├─ courses (all courses)        │
│  └─ course_outcomes (all outcomes)│
└──────────────────────────────────┘
```

### Step 2: Per-Course SOW Seeding

```
SOW Author Agent → sow_authored_*.json
         ↓
seedAuthoredSOW.ts
         ↓
├─ Validates: courses & course_outcomes exist (FAIL-FAST)
├─ Creates: lesson_templates (placeholders)
└─ Creates: Authored_SOW
```

### Complete System View

```
sqa_education.sqa_current (150+ courses)
         ↓
   [ONE-TIME BULK SEED]
         ↓
┌─────────────────────────────────────────┐
│  courses (142 courses)                  │
│  course_outcomes (1,856 outcomes)       │
└─────────────────────────────────────────┘
         ↑
         │ validates
         │
sow_authored_*.json → seedAuthoredSOW.ts
         ↓
┌─────────────────────────────────────────┐
│  lesson_templates (placeholders)        │
│  Authored_SOW (SOW entries)             │
└─────────────────────────────────────────┘
```
```

#### 3. seeding-scripts-reference.md

Add new section at the beginning:

```markdown
## bulkSeedAllCourses.ts (NEW)

**Location**: `assistant-ui-frontend/scripts/bulkSeedAllCourses.ts`

**Purpose**: One-time bulk seeding of all SQA courses and outcomes from `sqa_education.sqa_current` collection.

**Commands**:
```bash
# Process all SQA courses
tsx scripts/bulkSeedAllCourses.ts

# Dry run (validation only)
tsx scripts/bulkSeedAllCourses.ts --dry-run

# Stop on first error (default: continue on error)
tsx scripts/bulkSeedAllCourses.ts --stop-on-error
```

**Prerequisites**:
1. SQA data exists in `sqa_education.sqa_current` collection
2. Environment variables configured in `.env.local`
3. Admin API key with full database permissions

**Process**:
1. Queries all documents from `sqa_education.sqa_current` (with pagination)
2. For each SQA document:
   - Extracts course_code from `data.qualification.course_code`
   - Generates courseId: `course_{normalized_code}`
   - Checks if course already exists (skip if exists)
   - Creates course document in `courses` collection
   - Extracts outcomes from `data.course_structure.units`
   - Checks if outcomes already populated (skip if exists)
   - Creates course_outcome documents in `course_outcomes` collection
3. Generates summary report (console + JSON file)

**Output Example**:
```
📊 Bulk Seeding Summary
=========================
Total SQA Documents: 150
✅ Courses Created: 142
⏭️  Courses Skipped: 5
❌ Courses Failed: 3
📝 Total Outcomes Created: 1,856

📁 Report saved: ./output/bulk-seed-report-1234567890.json
```

**Idempotency**: Safe to re-run multiple times. Skips existing courses/outcomes.

**Performance**: Processes ~150 courses in 5-10 minutes (depends on network speed).
```

Update seedAuthoredSOW.ts section:

```markdown
## seedAuthoredSOW.ts (UPDATED)

**Changes in Latest Version:**
- ❌ REMOVED: PHASE -3 (ensureCourseExists)
- ❌ REMOVED: PHASE -2 (extractOutcomesFromSQA)
- ❌ REMOVED: PHASE -1 (populateCourseOutcomes)
- ✅ ADDED: Prerequisite validation (FAIL-FAST)
- ✅ ADDED: CLI courseId override

**NEW Prerequisites**:
```bash
# Must run this FIRST
tsx scripts/bulkSeedAllCourses.ts
```

**Commands**:
```bash
# Default: Use courseId from SOW file
npm run seed:authored-sow

# Override courseId via CLI
tsx scripts/seedAuthoredSOW.ts --sow /path/to/sow.json --course-id course_c76574

# Batch mode (unchanged)
tsx scripts/seedAuthoredSOW.ts --batch --input-dir /path/to/Seeding_Data
```

**Process (Updated)**:
1. **PHASE 0**: Validate prerequisites (NEW)
   - Check course document exists
   - Check course outcomes populated
   - Validate all outcome references
   - **FAIL-FAST** with actionable error messages
2. **PHASE 1-4**: (Unchanged)
   - Create lesson templates
   - Update SOW entries
   - Upsert Authored_SOW
   - Validate references

**Error Example**:
```
❌ PREREQUISITE FAILED: Course document not found

Course ID: course_c76574

💡 Action Required:
   Run the bulk seeding script to populate courses and outcomes:
   tsx scripts/bulkSeedAllCourses.ts
```
```

#### 4. step-by-step-guide.md

Remove Phase -3, -2, -1 sections entirely and update:

```markdown
## Complete Workflow (UPDATED)

### Prerequisites Checklist

Before running `npm run seed:authored-sow`, ensure:

- [x] **Bulk seeding completed** (run `tsx scripts/bulkSeedAllCourses.ts`)
- [x] SOW JSON file exists at `langgraph-author-agent/data/sow_authored_AOM_nat3.json`
- [x] `.env.local` configured with `APPWRITE_API_KEY`
- [x] Dependencies installed (`npm install --legacy-peer-deps`)

### High-Level Flow

```
START
  ↓
Bulk Seed (One-Time)
  ├─> tsx scripts/bulkSeedAllCourses.ts
  ├─> Creates courses collection
  └─> Creates course_outcomes collection
  ↓
SOW Seeding (Per Course)
  ├─> Load SOW JSON File
  ├─> PHASE 0: Validate Prerequisites ✅
  ├─> PHASE 1: Create/Update Lesson Templates ✅
  ├─> PHASE 2: Update SOW Entries ✅
  ├─> PHASE 3: Upsert Authored_SOW ✅
  └─> PHASE 4: Post-Seeding Validation ✅
  ↓
END (Success)
```

## Phase 0: Prerequisite Validation (NEW)

**Purpose**: Ensure courses and outcomes exist before any SOW operations.

**When**: First step of SOW seeding (before any writes)

**Why**: Fail-fast with actionable error messages instead of silent failures

### Process

**Step 1: Check Course Document Exists**

```typescript
const courseCheck = await databases.listDocuments(
  'default',
  'courses',
  [Query.equal('courseId', courseId), Query.limit(1)]
);

if (courseCheck.documents.length === 0) {
  throw new Error('Course not found - run bulkSeedAllCourses.ts');
}
```

**Step 2: Check Course Outcomes Populated**

```typescript
const outcomesCheck = await databases.listDocuments(
  'default',
  'course_outcomes',
  [Query.equal('courseId', courseId), Query.limit(1)]
);

if (outcomesCheck.documents.length === 0) {
  throw new Error('Outcomes not found - run bulkSeedAllCourses.ts');
}
```

**Step 3: Validate Outcome References**

```typescript
// (Existing validation logic - unchanged)
await validateOutcomeReferences(databases, sowEntries, courseId);
```

### Expected Output

**Success**:
```
🔍 PHASE 0: Validating Prerequisites...

  Checking course document...
  ✅ Course exists: course_c76574
     Subject: science
     Level: national-4
     SQA Code: C765 74

  Checking course outcomes...
  ✅ Course outcomes populated

  Validating outcome references in SOW entries...
  ✅ O1: Analyse an everyday situation...
  ✅ O2: Carry out calculations...
  ✅ All 12 outcome references validated

✅ All prerequisites validated
```

**Failure**:
```
🔍 PHASE 0: Validating Prerequisites...

  Checking course document...
  ❌ PREREQUISITE FAILED: Course document not found

Course ID: course_c76574

💡 Action Required:
   Run the bulk seeding script to populate courses and outcomes:
   tsx scripts/bulkSeedAllCourses.ts
```
```

---

## Phase 4: Testing

### Test Checklist

#### 4.1: Bulk Seeding Script Tests

- [ ] **Dry Run Mode**
  ```bash
  tsx scripts/bulkSeedAllCourses.ts --dry-run
  ```
  - Verify: No database writes occur
  - Verify: Console shows what would be created
  - Verify: No errors thrown

- [ ] **Actual Seeding (Fresh Database)**
  ```bash
  tsx scripts/bulkSeedAllCourses.ts
  ```
  - Verify: courses collection populated
  - Verify: course_outcomes collection populated
  - Verify: JSON report generated
  - Verify: Console summary accurate

- [ ] **Idempotency (Re-run)**
  ```bash
  tsx scripts/bulkSeedAllCourses.ts
  ```
  - Verify: All courses skipped
  - Verify: No duplicates created
  - Verify: Status shows "skipped"

- [ ] **Error Handling**
  - Test: SQA doc with missing course_code
  - Test: SQA doc with invalid JSON in data field
  - Test: Network error during processing
  - Verify: Continues processing (if continueOnError=true)
  - Verify: Error logged in report

- [ ] **Stop on Error Mode**
  ```bash
  tsx scripts/bulkSeedAllCourses.ts --stop-on-error
  ```
  - Corrupt one SQA document
  - Verify: Script stops immediately
  - Verify: Partial results reported

#### 4.2: Refactored SOW Script Tests

- [ ] **Prerequisite Validation (Missing Course)**
  - Delete one course document
  - Run: `npm run seed:authored-sow`
  - Verify: Fails with clear error message
  - Verify: Message mentions running bulkSeedAllCourses.ts
  - Verify: No partial writes (lesson_templates not created)

- [ ] **Prerequisite Validation (Missing Outcomes)**
  - Delete all course_outcomes for one course
  - Run: `npm run seed:authored-sow`
  - Verify: Fails with clear error message
  - Verify: No partial writes

- [ ] **Successful SOW Seeding**
  - Ensure bulk seeding completed
  - Run: `npm run seed:authored-sow`
  - Verify: PHASE 0 validation passes
  - Verify: lesson_templates created correctly
  - Verify: Authored_SOW document created
  - Verify: All validation checks pass

- [ ] **courseId CLI Override**
  ```bash
  tsx scripts/seedAuthoredSOW.ts --sow /path/to/sow.json --course-id course_c76574
  ```
  - Verify: CLI courseId used instead of SOW file courseId
  - Verify: Console shows override warning
  - Verify: Lesson templates created with correct courseId

- [ ] **Batch Mode (Unchanged)**
  ```bash
  tsx scripts/seedAuthoredSOW.ts --batch --input-dir /path/to/Seeding_Data
  ```
  - Verify: Still works after refactoring
  - Verify: Prerequisites validated for each SOW
  - Verify: Batch report generated

#### 4.3: Regression Tests

- [ ] **Outcome ID Mapping**
  - Verify: "O1" still maps to correct document ID
  - Verify: lesson_templates.outcomeRefs contains real IDs (not "O1")

- [ ] **Lesson Template Creation**
  - Verify: Templates created with correct fields
  - Verify: sow_order field populated
  - Verify: outcomeRefs field is JSON string of document IDs
  - Verify: cards field is empty array "[]"

- [ ] **Authored_SOW Document**
  - Verify: entries field contains correct data
  - Verify: lessonTemplateRef fields contain real IDs
  - Verify: metadata populated correctly

- [ ] **Frontend Integration**
  - Load lesson session in frontend
  - Verify: Lesson data loads correctly
  - Verify: Outcomes displayed correctly
  - Verify: No breaking changes

#### 4.4: Database Verification

After running both scripts, verify in Appwrite console:

- [ ] **courses Collection**
  ```
  Query: courseId = "course_c76574"
  Verify:
    - Document exists
    - subject: "science" (hyphenated)
    - level: "national-4" (hyphenated)
    - sqaCode: "C765 74"
    - schema_version: 2
  ```

- [ ] **course_outcomes Collection**
  ```
  Query: courseId = "course_c76574"
  Verify:
    - Multiple documents exist (e.g., 12 outcomes)
    - outcomeId: "O1", "O2", etc.
    - assessmentStandards: JSON string
    - keywords: JSON string array
  ```

- [ ] **lesson_templates Collection**
  ```
  Query: courseId = "course_c76574"
  Verify:
    - Multiple documents exist (e.g., 48 templates)
    - sow_order: 1, 2, 3, etc.
    - outcomeRefs: JSON string of document IDs
    - cards: "[]" (empty initially)
  ```

- [ ] **Authored_SOW Collection**
  ```
  Query: courseId = "course_c76574"
  Verify:
    - One document exists
    - entries: JSON string with array
    - Parse entries and check lessonTemplateRef fields
  ```

---

## Implementation Checklist

### Phase 1: bulkSeedAllCourses.ts

- [ ] Create file: `assistant-ui-frontend/scripts/bulkSeedAllCourses.ts`
- [ ] Add TypeScript interfaces
  - [ ] `SQACourse`
  - [ ] `SQACourseData`
  - [ ] `CourseOutcomeImport`
  - [ ] `BulkSeedResult`
  - [ ] `BulkSeedConfig`
- [ ] Implement `getAllSQACourses()` with pagination
- [ ] Implement `extractCourseCode()` to parse `data.qualification.course_code`
- [ ] Implement `generateCourseId()` to normalize course code
- [ ] Implement `underscoreToHyphen()` for subject/level conversion
- [ ] Implement `createCourseDocument()` with idempotency check
- [ ] Implement `extractOutcomesFromSQADoc()` (copy from Phase -2)
- [ ] Implement `generateTeacherGuidance()` helper
- [ ] Implement `extractKeywords()` helper
- [ ] Implement `populateCourseOutcomes()` with idempotency check
- [ ] Implement `processSingleCourse()` with error handling
- [ ] Implement `bulkSeedAllCourses()` main orchestrator
- [ ] Implement `generateReport()` for JSON output
- [ ] Add CLI argument parsing (minimist)
- [ ] Add comprehensive console logging
- [ ] Add progress indicators for long operations
- [ ] Test dry-run mode
- [ ] Test actual seeding
- [ ] Test idempotency (re-run)
- [ ] Test error handling

### Phase 2: Refactor seedAuthoredSOW.ts

- [ ] Remove `parseSubjectLevel()` function (lines 146-160)
- [ ] Remove `ensureCourseExists()` function (lines 174-206)
- [ ] Remove `extractOutcomesFromSQA()` function (lines 211-296)
- [ ] Remove `populateCourseOutcomes()` function (lines 301-359)
- [ ] Remove subject/level parsing from filename (lines 950-967)
- [ ] Remove PHASE -3, -2, -1 calls (lines 972-988)
- [ ] Add `validatePrerequisites()` function
  - [ ] Check course exists
  - [ ] Check outcomes exist
  - [ ] Call existing `validateOutcomeReferences()`
  - [ ] Add fail-fast error messages
- [ ] Update `seedSingleSOW()` to accept courseId override
- [ ] Update `seedSingleSOW()` to call `validatePrerequisites()`
- [ ] Update `CLIArgs` interface to include `courseId`
- [ ] Update `parseCLIArgs()` to accept `--course-id` parameter
- [ ] Update `main()` to pass courseId to `seedSingleSOW()`
- [ ] Test prerequisite validation (missing course)
- [ ] Test prerequisite validation (missing outcomes)
- [ ] Test successful SOW seeding
- [ ] Test courseId CLI override

### Phase 3: Update Documentation

- [ ] Update `docs/Seeding/README.md`
  - [ ] Prerequisites section
  - [ ] Quick Start section
  - [ ] Add Workflow Changes section
- [ ] Update `docs/Seeding/architecture.md`
  - [ ] Data flow diagram
  - [ ] System components
- [ ] Update `docs/Seeding/seeding-scripts-reference.md`
  - [ ] Add bulkSeedAllCourses.ts section
  - [ ] Update seedAuthoredSOW.ts section
- [ ] Update `docs/Seeding/step-by-step-guide.md`
  - [ ] Remove Phase -3, -2, -1 sections
  - [ ] Add Phase 0 (prerequisite validation)
  - [ ] Update workflow diagram
- [ ] Create migration guide for existing users

### Phase 4: Testing & Validation

- [ ] Run all tests from testing checklist
- [ ] Verify no regressions in existing functionality
- [ ] Test with fresh database (end-to-end)
- [ ] Test with existing data (migration scenario)
- [ ] Document any issues found
- [ ] Update documentation based on testing feedback

---

## Migration Guide

### For Existing Users

If you have already run the old SOW seeding script and have existing data:

#### Step 1: Assess Current State

```bash
# Check if courses collection is populated
# Via Appwrite Console → Databases → default → courses
# Count: Should be > 0 if you've seeded before

# Check if course_outcomes is populated
# Via Appwrite Console → Databases → default → course_outcomes
# Count: Should be > 0 if you've seeded before
```

#### Step 2: Run Bulk Seed with Skip Existing

```bash
# This will skip courses that already exist
tsx scripts/bulkSeedAllCourses.ts
```

**Expected behavior:**
- Existing courses: Skipped
- Missing courses: Created
- Existing outcomes: Skipped
- Missing outcomes: Created

#### Step 3: Test SOW Seeding

```bash
# Try seeding an existing SOW
npm run seed:authored-sow
```

**Expected behavior:**
- PHASE 0 validation passes (courses/outcomes exist)
- lesson_templates updated (if already exist)
- Authored_SOW updated (if already exists)
- No errors

#### Step 4: Update Scripts (If Custom)

If you have custom scripts that import from seedAuthoredSOW.ts:

- Remove references to `ensureCourseExists`
- Remove references to `extractOutcomesFromSQA`
- Remove references to `populateCourseOutcomes`
- Add call to `bulkSeedAllCourses.ts` at the beginning

### Rollback Plan

If issues occur:

1. **Backup Database**
   - Export courses collection
   - Export course_outcomes collection
   - Export lesson_templates collection
   - Export Authored_SOW collection

2. **Revert Code Changes**
   ```bash
   git checkout <previous-commit>
   ```

3. **Restore Database** (if needed)
   - Delete new collections
   - Import backed up collections

---

## Appendix: Code Examples

### Example: Full bulkSeedAllCourses.ts Main Function

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Client, Databases, ID, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import minimist from 'minimist';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

// ... (interfaces defined above)

async function main() {
  // Parse CLI arguments
  const args = minimist(process.argv.slice(2));
  const config: BulkSeedConfig = {
    dryRun: args['dry-run'] || false,
    continueOnError: !args['stop-on-error']
  };

  console.log('🌱 Starting Bulk Course Seeding...\n');

  // Validate environment
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Project: ${projectId}\n`);

  // Initialize Appwrite
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  console.log('✅ Admin client created with API key authentication\n');

  // Get all SQA courses
  console.log('📚 Fetching all SQA courses...');
  const sqaCourses = await getAllSQACourses(databases);
  console.log(`✅ Found ${sqaCourses.length} SQA courses\n`);

  if (config.dryRun) {
    console.log('⚠️  DRY RUN MODE: No database writes will occur\n');
  }

  // Process each course
  console.log('Processing courses...\n');
  const results: BulkSeedResult[] = [];
  let processed = 0;

  for (const sqaCourse of sqaCourses) {
    processed++;
    console.log(`[${processed}/${sqaCourses.length}] Processing: ${sqaCourse.subject} - ${sqaCourse.level}`);

    const result = await processSingleCourse(databases, sqaCourse, config);
    results.push(result);

    if (result.status === 'success') {
      console.log(`  ✅ Success: ${result.outcomesCreated} outcomes created`);
    } else if (result.status === 'skipped') {
      console.log(`  ⏭️  Skipped: ${result.error}`);
    } else {
      console.error(`  ❌ Failed: ${result.error}`);
      if (!config.continueOnError) {
        console.error('\n❌ Stopping due to error (--stop-on-error)');
        process.exit(1);
      }
    }
  }

  // Generate report
  generateReport(results, config);

  console.log('\n👋 Exiting...');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
```

---

**END OF SPECIFICATION**
