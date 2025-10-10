# Phase 1: Course Seeding Scripts

## Overview

Phase 1 implements standalone course and course_outcomes seeding from the `sqa_education.sqa_current` collection. This replaces the embedded phases -3, -2, -1 in the SOW seeding workflow with dedicated, reusable scripts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ sqa_education.sqa_current Collection                        │
│ (Source: SQA Course Data)                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Phase 1A/1B Scripts
                        │ Extract & Transform
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ default.courses Collection                                  │
│ - courseId: course_<normalized_code>                        │
│ - subject: <hyphenated>                                     │
│ - level: <hyphenated>                                       │
│ - sqaCode: <original>                                       │
│ - schema_version: 2                                         │
└─────────────────────────────────────────────────────────────┘
                        │
                        │ FK Reference
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ default.course_outcomes Collection                          │
│ - courseId: <FK to courses>                                 │
│ - courseSqaCode: <original>                                 │
│ - unitCode, unitTitle, scqfCredits                          │
│ - outcomeId, outcomeTitle                                   │
│ - assessmentStandards: JSON string                          │
│ - teacherGuidance: Markdown                                 │
│ - keywords: JSON string array                               │
└─────────────────────────────────────────────────────────────┘
```

## Scripts

### Phase 1A: `seedSingleCourse.ts`

**Purpose:** Test-first approach - validate logic on ONE course before bulk processing.

**Usage:**
```bash
tsx scripts/seedSingleCourse.ts --subject spanish --level national_3
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --dry-run
```

**Features:**
- Processes single SQA course by subject/level
- Verbose logging for validation
- Dry-run mode for preview
- Fail-fast error handling
- Idempotent (skips existing)

**Testing Guide:** See `PHASE1A_TESTING.md`

### Phase 1B: `bulkSeedAllCourses.ts`

**Purpose:** Production script - process ALL SQA courses with pagination and reporting.

**Usage:**
```bash
# Dry-run preview
tsx scripts/bulkSeedAllCourses.ts --dry-run --limit 5

# Small batch test
tsx scripts/bulkSeedAllCourses.ts --limit 10

# Full bulk run
tsx scripts/bulkSeedAllCourses.ts

# Resume from offset
tsx scripts/bulkSeedAllCourses.ts --offset 50 --limit 10
```

**Features:**
- Pagination (100 courses per batch)
- Progress tracking with counts
- Graceful error handling (continues on failure)
- JSON report generation
- Idempotent (skips existing)
- Dry-run mode

**Testing Guide:** See `PHASE1B_TESTING.md`

## Data Transformations

### CourseId Generation

```
SQA Course Code → Normalized → CourseId
"C769 73"       → "c76973"   → "course_c76973"
"C747 75"       → "c74775"   → "course_c74775"
```

**Rules:**
1. Remove all spaces
2. Convert to lowercase
3. Prepend "course_" prefix

### Subject/Level Normalization

```
CLI Input          → Database Storage
"spanish"          → "spanish"
"national_3"       → "national-3"
"application_of_mathematics" → "application-of-mathematics"
```

**Rules:**
1. Convert underscores to hyphens
2. Keep lowercase

### Outcome Processing

For each course:
1. Navigate to `data.course_structure.units` (or `data.units` fallback)
2. For each unit:
   - Extract unit metadata (code, title, SCQF credits)
   - For each outcome in unit:
     - Extract outcome metadata (id, title)
     - Parse assessment standards array
     - Generate teacher guidance (markdown)
     - Extract keywords (from title + assessment standards)

## Key Design Patterns

### 1. Fail-Fast Error Handling

```typescript
// NO fallback mechanisms
if (!courseCode) {
  throw new Error(
    `❌ No course_code found in data.qualification.\n\n` +
    `Actual structure: ${JSON.stringify(data)}`
  );
}
```

**Benefits:**
- Immediate visibility into data issues
- Detailed error messages with context
- No silent failures

### 2. Idempotency

```typescript
// Check before create
const existing = await databases.listDocuments(
  'default',
  'courses',
  [Query.equal('courseId', courseId), Query.limit(1)]
);

if (existing.documents.length > 0) {
  return { skipped: true };
}
```

**Benefits:**
- Safe to re-run scripts
- Supports incremental updates
- Recoverable from interruptions

### 3. Verbose Logging

```typescript
console.log(`\n🔍 Querying sqa_education.sqa_current collection...`);
console.log(`   Subject: "${subject}"`);
console.log(`   Level: "${level}"`);
console.log(`   ✅ Found SQA course: ${doc.$id}`);
console.log(`   ✅ Extracted course code: "${courseCode}"`);
```

**Benefits:**
- Easy debugging
- Progress visibility
- Validation support

### 4. Dry-Run Mode

```typescript
if (dryRun) {
  console.log(`   🏃 DRY RUN: Would create course with data:`);
  console.log(`   ${JSON.stringify(data, null, 2)}`);
  return { wouldCreate: true };
}
```

**Benefits:**
- Preview changes before committing
- Test script logic without database writes
- Validate data transformations

## Prerequisites

1. **Environment Variables** (`.env.local`):
   ```env
   NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_admin_api_key
   ```

2. **SQA Data:**
   - `sqa_education.sqa_current` collection populated
   - Each document must have:
     - `subject` (string with underscores)
     - `level` (string with underscores)
     - `data` (JSON string containing course structure)
     - `data.qualification.course_code` (nested course code)
     - `data.course_structure.units` (array of units with outcomes)

3. **Appwrite Collections:**
   - `default.courses` collection exists
   - `default.course_outcomes` collection exists
   - Admin API key has write permissions

## Testing Workflow

1. **Phase 1A Validation** (Single Course Test):
   ```bash
   # Dry-run
   tsx scripts/seedSingleCourse.ts --subject spanish --level national_3 --dry-run

   # Live run
   tsx scripts/seedSingleCourse.ts --subject spanish --level national_3

   # Verify in Appwrite Console
   # Re-run to test idempotency
   ```

2. **Phase 1B Small Batch**:
   ```bash
   # Preview
   tsx scripts/bulkSeedAllCourses.ts --dry-run --limit 5

   # Small batch
   tsx scripts/bulkSeedAllCourses.ts --limit 10

   # Verify in Appwrite Console
   # Re-run to test idempotency
   ```

3. **Phase 1B Full Bulk**:
   ```bash
   # Full run
   tsx scripts/bulkSeedAllCourses.ts

   # Review JSON report
   # Verify counts in Appwrite Console
   ```

## Success Metrics

- **Phase 1A:** 1 course + outcomes created successfully
- **Phase 1B Small Batch:** 10 courses + outcomes created successfully
- **Phase 1B Full Bulk:**
  - 150+ courses created (varies by SQA data)
  - 500-1000+ outcomes created
  - <5% failure rate
  - JSON report generated

## Output Reports

Reports are saved to `assistant-ui-frontend/reports/`:

```
reports/
├── bulk-seed-report-1696940400000.json
├── bulk-seed-report-1696940500000.json
└── ...
```

**Report Structure:**
```json
{
  "timestamp": "2025-10-10T12:00:00.000Z",
  "totalProcessed": 154,
  "coursesCreated": 153,
  "coursesSkipped": 1,
  "coursesFailed": 0,
  "totalOutcomesCreated": 728,
  "dryRun": false,
  "results": [...]
}
```

## Common Issues

### Issue: "No course_code found"
**Solution:** Check SQA data structure - course_code must be in `data.qualification.course_code`

### Issue: "No units found"
**Solution:** Verify SQA data has `data.course_structure.units` or `data.units` array

### Issue: Duplicate courses
**Solution:** Check if multiple SQA records have same course_code - may need deduplication

### Issue: Missing outcomes
**Solution:** Verify unit.outcomes array exists in SQA data - some courses may have incomplete data

## Next Steps

After Phase 1 completion:

1. **Phase 2:** Refactor `seedAuthoredSOW.ts`
   - Remove phases -3, -2, -1
   - Add fail-fast validation for prerequisites
   - Accept courseId as CLI parameter

2. **Phase 3:** Update documentation
   - Seeding workflow diagrams
   - Prerequisites documentation
   - Migration guide

3. **Phase 4:** Testing & validation
   - Regression tests
   - End-to-end workflow validation

## File Locations

```
assistant-ui-frontend/scripts/
├── seedSingleCourse.ts          # Phase 1A: Single course seeding
├── bulkSeedAllCourses.ts        # Phase 1B: Bulk seeding
├── PHASE1A_TESTING.md           # Phase 1A test guide
├── PHASE1B_TESTING.md           # Phase 1B test guide
├── README_PHASE1.md             # This file
└── reports/                     # Generated reports directory
    └── bulk-seed-report-*.json
```

## Related Documentation

- `/tasks/bulk-course-seeding-spec.md` - Complete implementation specification
- `/docs/Seeding/` - Seeding infrastructure documentation
- `seedAuthoredSOW.ts` - Original SOW seeding script (to be refactored in Phase 2)
