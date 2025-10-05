# Fixing Orphaned Course Data in Appwrite Data Model

**Related Documentation:** [Appwrite Data Model](../docs/appwrite-data-model.md)

**Issue:** The seeding process created `Authored_SOW`, `lesson_templates`, and `course_outcomes` documents with foreign key references to `courseId` values that don't exist in the `courses` collection. This happened because Appwrite (NoSQL) doesn't enforce referential integrity, and the `seedAuthoredSOW.ts` script never created the parent course documents.

**Orphaned Course IDs:**
- `course_c84473` - Applications of Mathematics, National 3
- `course_c84474` - Applications of Mathematics, National 4
- `course_c84774` - Mathematics, National 4

---

## Plan: Fix Orphaned Courses & Prevent Future Issues

### Part 1: Simplify courses Collection Schema

**Current Schema Analysis:**
```typescript
// Current (redundant fields)
interface Course {
  courseId: string;      // ✅ Keep - PK
  subject: string;       // ✅ Keep - Required
  phase: string;         // ❌ Remove - Redundant (derivable from level)
  level: string;         // ✅ Keep - Required
  sqaCode: string;       // ❌ Remove - Redundant (embedded in courseId)
  schema_version: number; // ✅ Keep - Metadata
}

// Simplified (user requirement)
interface Course {
  courseId: string;      // PK format: course_<code>
  subject: string;       // e.g., "application-of-mathematics"
  level: string;         // e.g., "national-4"
  schema_version: number;
  // Auto-managed: $createdAt, $updatedAt
}
```

**Action:** No migration needed - just stop populating phase/sqaCode in new documents.

---

### Part 2: Create 3 Missing Course Documents

**Metadata Extracted from Authored_SOW filenames:**

1. **course_c84473**
   - Subject: "application-of-mathematics"
   - Level: "national-3"

2. **course_c84474**
   - Subject: "application-of-mathematics"
   - Level: "national-4"

3. **course_c84774**
   - Subject: "mathematics"
   - Level: "national-4"

**Implementation Approach:**

Create `scripts/createMissingCourses.ts`:

```typescript
// Pseudo-code
async function createMissingCourses() {
  const coursesToCreate = [
    {
      courseId: "course_c84473",
      subject: "application-of-mathematics",
      level: "national-3"
    },
    {
      courseId: "course_c84474",
      subject: "application-of-mathematics",
      level: "national-4"
    },
    {
      courseId: "course_c84774",
      subject: "mathematics",
      level: "national-4"
    }
  ];

  for (const course of coursesToCreate) {
    // Check if exists
    const exists = await databases.listDocuments(
      DATABASE_ID,
      'courses',
      [Query.equal('courseId', course.courseId)]
    );

    if (exists.documents.length === 0) {
      // Create with simplified schema
      await databases.createDocument(
        DATABASE_ID,
        'courses',
        'unique()',
        {
          courseId: course.courseId,
          subject: course.subject,
          level: course.level,
          schema_version: 2
        }
      );
      console.log(`✅ Created course: ${course.courseId}`);
    } else {
      console.log(`⏭️  Course exists: ${course.courseId}`);
    }
  }
}
```

**Run:** `npm run create:missing-courses` (one-time script)

---

### Part 3: Update seedAuthoredSOW.ts to Auto-Create Courses

**Filename Pattern:** `<subject>_<level>.json`
- Example: `application-of-mathematics_national-4.json`
- Subject: `application-of-mathematics` (keep hyphens as-is)
- Level: `national-4` (keep hyphens as-is)

**Required Functions:**

```typescript
// 1. Parse filename to extract subject/level (NO transformation)
function parseSubjectLevel(fileName: string): { subject: string; level: string } {
  // Remove .json extension
  const baseName = fileName.replace('.json', '');

  // Split by underscore - first part is subject, rest is level
  const underscoreIndex = baseName.indexOf('_');
  if (underscoreIndex === -1) {
    throw new Error(`Invalid filename format: ${fileName} (expected <subject>_<level>.json)`);
  }

  const subject = baseName.substring(0, underscoreIndex);
  const level = baseName.substring(underscoreIndex + 1);

  return { subject, level };
}

// Example usage:
// parseSubjectLevel("application-of-mathematics_national-4.json")
// → { subject: "application-of-mathematics", level: "national-4" }

// 2. Ensure course exists before creating child data
async function ensureCourseExists(
  databases: Databases,
  courseId: string,
  subject: string,
  level: string
): Promise<void> {
  // Check if course already exists
  const existing = await databases.listDocuments(
    DATABASE_ID,
    'courses',
    [Query.equal('courseId', courseId)]
  );

  if (existing.documents.length > 0) {
    console.log(`✅ Course exists: ${courseId}`);
    return;
  }

  // Create course with simplified schema
  console.log(`🔨 Creating missing course: ${courseId}`);
  await databases.createDocument(
    DATABASE_ID,
    'courses',
    'unique()',
    {
      courseId,
      subject,
      level,
      schema_version: 2
    }
  );
  console.log(`✅ Created course: ${courseId} (${subject} - ${level})`);
}
```

**Integration Point in seedAuthoredSOW.ts:**

```typescript
// Current line ~871-905 in processSingleSOW()
async function processSingleSOW(sowFile: string, databases: Databases) {
  // Load SOW data
  const sowData = JSON.parse(fs.readFileSync(sowFile));
  const courseId = sowData.courseId; // e.g., "course_c84474"

  // Extract subject/level from filename (keep hyphens as-is)
  const fileName = path.basename(sowFile);
  const { subject, level } = parseSubjectLevel(fileName);

  // ✅ NEW: Ensure course exists BEFORE creating child data
  await ensureCourseExists(databases, courseId, subject, level);

  // NOW create child data (outcomes, SOW, lessons)
  await populateCourseOutcomes(databases, courseId, ...);
  await validateOutcomeReferences(databases, sowData.entries, courseId);
  // ... rest of seeding
}
```

---

## Summary of Changes

**Files to Create:**
1. `scripts/createMissingCourses.ts` - One-time fix for orphaned data

**Files to Modify:**
1. `scripts/seedAuthoredSOW.ts` - Add `parseSubjectLevel()` and `ensureCourseExists()` functions
2. `package.json` - Add `"create:missing-courses": "tsx scripts/createMissingCourses.ts"`

**Execution Order:**
1. Run one-time fix: `npm run create:missing-courses`
2. Update seedAuthoredSOW.ts with new functions
3. Test with existing SOW files to verify course auto-creation
4. Future seeding runs will never create orphaned data

**Benefits:**
- ✅ Fixes existing 3 orphaned courses
- ✅ Prevents future orphaned data
- ✅ Simplifies courses schema (remove phase/sqaCode)
- ✅ Maintains filename → course mapping (hyphens preserved)
