# Course Outcomes Migration Guide

> **Last Updated**: January 2025
> **Status**: Active - Using consolidated seeding scripts

## Overview

This guide explains the complete workflow for populating the `course_outcomes` collection from SQA source data (`sqa_education.sqa_current`) and creating lesson templates with real outcome references.

**Key Changes** (January 2025):
- ✅ Consolidated extraction + migration into single script: `seedSingleCourse.ts`
- ❌ Deprecated: Separate `extractSQAOutcomes.ts` and `migrateCourseOutcomes.ts` scripts
- ✅ All workflows now use existing, tested scripts
- ✅ Added support for both unit-based (National 3/4) and skills-based (National 5+) courses

## New course_outcomes Schema

**Before** (old structure):
```json
{
  "courseId": "C844 73",
  "outcomeRef": "H225 73-1",
  "title": "I can convert between fractions...",
  "$id": "68d1c5fcdaec2d5f4770"
}
```

**After** (SQA-aligned structure):
```json
{
  "courseId": "course_c84473",
  "courseSqaCode": "C844 73",
  "unitCode": "HV7Y 73",
  "unitTitle": "Applications of Mathematics: Manage Money and Data (National 3)",
  "scqfCredits": 6,
  "outcomeId": "O1",
  "outcomeTitle": "Manage money in basic real-life contexts",
  "assessmentStandards": "[{\"code\":\"AS1.1\",\"desc\":\"Identifying factors...\"}]",
  "teacherGuidance": "**AS1.1**: Identifying factors affecting income...",
  "keywords": "[\"money\",\"income\",\"expenditure\"]",
  "$id": "auto-generated"
}
```

**Key Benefits**:
- Direct mapping from SOW's `outcomeRefs: ["O1"]` to course_outcomes via `outcomeId` field
- Full SQA context (unit codes, SCQF credits, assessment standards)
- Teacher planning support (guidance, keywords)
- Authoritative source of truth from `sqa_education.sqa_current`

---

## Migration Workflow

### Step 1: Extract and Populate course_outcomes from SQA Data

**Script**: `assistant-ui-frontend/scripts/seedSingleCourse.ts`

**Purpose**: Extracts outcome data from `sqa_education.sqa_current` and directly populates the `course_outcomes` collection with the SQA-aligned structure.

**Run**:
```bash
cd assistant-ui-frontend
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
```

**Alternative - Batch Processing**:
```bash
# Process all courses at once
tsx scripts/bulkSeedAllCourses.ts
```

**Arguments for seedSingleCourse.ts**:
- `--subject`: Subject name using underscores (e.g., `application_of_mathematics`, `mathematics`)
- `--level`: Level using underscores (e.g., `national_3`, `national_5`, `higher`)
- `--dry-run`: (Optional) Preview changes without writing to database
- `--force-update`: (Optional) Update existing courses/outcomes instead of skipping

**How it Works**:
1. Queries `sqa_education.sqa_current` collection for matching subject/level
2. Extracts course code from SQA data (e.g., "C844 73")
3. Generates courseId (e.g., "course_c84473")
4. Auto-detects structure type:
   - **Unit-based extraction** for National 3/4 courses
   - **Skills-based extraction** for National 5+ courses
5. Flattens units → outcomes → assessment standards hierarchy
6. Generates teacher guidance from marking guidance
7. Extracts keywords from titles and descriptions
8. Creates course document in `default.courses` collection
9. Creates course_outcome documents in `default.course_outcomes` collection

**Expected Console Output**:
```
🌱 Phase 1A: Single Course Seeding

============================================================
Subject: application_of_mathematics
Level: national_3
Mode: LIVE
============================================================

✅ Environment variables validated
✅ Admin client created with API key authentication

🔍 Querying sqa_education.sqa_current collection...
   Subject: "application_of_mathematics"
   Level: "national_3"

✅ Found SQA course: 67a1b2c3d4e5f6g7h8i9
   Document fields available: $id, subject, level, course_code, data

📝 Processing SQA document...
   ✅ Extracted course code: "C844 73"
   ✅ Generated courseId: course_c84473
   📊 Structure Type: unit_based
   📚 Using unit-based extraction (National 3/4 course)

   ✅ Created course document
   CourseId: course_c84473
   Subject: application-of-mathematics
   Level: national-3
   SQA Code: C844 73

🔍 Extracting outcomes from course data...
   ✅ Extracted 6 outcomes

📥 Creating course_outcomes documents...
   ✅ Created 6 outcomes

============================================================
🎉 Single Course Seeding Complete!
============================================================

📊 Summary:
   Course ID: course_c84473
   SQA Code: C844 73
   Subject: application-of-mathematics
   Level: national-3
   Structure Type: unit_based
   Outcomes: 6
   Mode: LIVE

✅ Next Steps:
   1. Verify course document in Appwrite console: default.courses
      - Search for courseId: course_c84473
   2. Verify outcome documents in Appwrite console: default.course_outcomes
      - Filter by courseId: course_c84473
      - Expected count: 6
   3. Re-run this script to test idempotency (should skip existing)
   4. Run seedAuthoredSOW.ts to create lesson templates
```

**Key Features**:
- **Idempotent**: Re-running skips existing courses/outcomes (unless `--force-update` is used)
- **Fail-fast**: Throws detailed errors if SQA data is malformed or missing
- **Auto-detection**: Automatically handles both unit-based and skills-based course structures
- **Rate limiting**: Built-in delays (300ms between outcome creations) to avoid Appwrite rate limits

---

### Step 2: Seed Authored_SOW with Real Outcome References

**Script**: `assistant-ui-frontend/scripts/seedAuthoredSOW.ts` (UPDATED)

**Purpose**: Creates lesson_templates with real course_outcomes document IDs instead of placeholders.

**Run**:
```bash
cd assistant-ui-frontend
npm run seed:authored-sow
```

**New Features**:
- **Phase 0**: Validates all outcomeRefs exist in course_outcomes before template creation
- **Outcome Mapping**: Maps `outcomeRefs: ["O1"]` to real document IDs (e.g., `["70a1b2c3d4e5..."]`)
- **Fail-Fast**: Throws error if any outcome reference is missing

**Expected Console Output**:
```
🌱 Starting Authored_SOW seed script...

✅ Environment variables validated
...

✅ Successfully loaded SOW data for course: course_c84473
   Version: 2
   Status: draft
   Entries: 104 lessons

============================================================
PHASE 0: Validate Outcome References
============================================================

🔍 Validating outcome references...

   Found 12 unique outcome references

  ✅ O1: Manage money in basic real-life contexts
  ✅ O2: Interpret graphical data
  ...

  ✅ All 12 outcome references validated

============================================================
PHASE 1: Create/Update Lesson Template Placeholders
============================================================

📝 Creating lesson template placeholders...
   Total entries to process: 104

  ✅ Created #1: Introduction to Numeracy Skills (70b1c2d3e4f5...)
  ✅ Created #2: Check-in: Notation and Units (70b1c2d3e4f6...)
  ...

📊 Template Creation Summary:
   Created: 104
   Updated: 0
   Total: 104

============================================================
PHASE 2: Update Authored_SOW Entries with Real Template IDs
============================================================

🔗 Updating Authored_SOW entries with real template IDs...

  #  1. Introduction to Numeracy Skills      AUTO_TBD_1 → 70b1c2d3e4f5...
  #  2. Check-in: Notation and Units         AUTO_TBD_2 → 70b1c2d3e4f6...
  ...

✅ 104 entries updated with real template IDs

...
```

---

## Verification Steps

### 1. Verify course_outcomes Structure

```bash
# Use Appwrite MCP or console to check a sample document
```

**Expected fields**:
- `courseId`: "course_c84473"
- `courseSqaCode`: "C844 73"
- `unitCode`: "HV7Y 73"
- `outcomeId`: "O1" (maps directly to SOW outcomeRefs!)
- `outcomeTitle`: "Manage money in basic real-life contexts"
- `assessmentStandards`: JSON array
- `teacherGuidance`: Markdown text
- `keywords`: JSON array

### 2. Verify lesson_templates.outcomeRefs

**Before migration**:
```json
{
  "outcomeRefs": "[\"O1\"]"
}
```

**After migration**:
```json
{
  "outcomeRefs": "[\"70a1b2c3d4e5f6g7h8i9\", \"70a1b2c3d4e5f6g7h8ia\"]"
}
```

### 3. Verify Outcome Reference Integrity

Run this validation query for each outcome ID in lesson_templates:

```typescript
const outcome = await databases.getDocument(
  'default',
  'course_outcomes',
  '70a1b2c3d4e5f6g7h8i9'
);

console.log(outcome.outcomeId);  // "O1"
console.log(outcome.outcomeTitle);  // "Manage money in basic real-life contexts"
```

---

## Troubleshooting

### Error: "No documents found for course code"

**Cause**: `sqa_education.sqa_current` doesn't have data for the specified subject/level.

**Fix**: Verify the subject and level match exactly (use underscores, case-sensitive):
```bash
# List available courses using Appwrite MCP or console
# Check sqa_education.sqa_current collection

# Correct format examples:
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5
tsx scripts/seedSingleCourse.ts --subject computing_science --level higher
```

### Error: "Attribute not found in schema"

**Cause**: `course_outcomes` collection schema doesn't have required fields.

**Fix**: Update collection schema using Appwrite MCP or console:
```typescript
Required fields:
- courseId (string)
- courseSqaCode (string)
- unitCode (string)
- unitTitle (string)
- scqfCredits (integer)
- outcomeId (string)
- outcomeTitle (string)
- assessmentStandards (string, large size 100000+)
- teacherGuidance (string, large size 10000+)
- keywords (string, size 1000)
```

### Error: "Invalid outcome references found"

**Cause**: SOW data references outcomeIds that don't exist in course_outcomes.

**Fix 1**: Check if seedSingleCourse.ts completed successfully for the course.

**Fix 2**: Verify SOW data outcomeRefs match the outcomeIds from SQA data:
```json
// SOW data
"outcomeRefs": ["O1", "O2"]

// SQA data (sqa_current)
"outcomes": [
  {"id": "O1", ...},
  {"id": "O2", ...}
]
```

### Permission Errors

**Cause**: API key lacks permissions for sqa_education or course_outcomes.

**Fix**: Update collection permissions using Appwrite MCP:
```typescript
permissions: [
  "read(\"any\")",
  "create(\"any\")",
  "update(\"any\")",
  "delete(\"users\")"  // Restrict deletion
]
```

---

## Rollback Procedure

If seeding fails or produces incorrect results:

### 1. Delete Invalid Outcomes

Use Appwrite console or MCP to delete course_outcomes for the affected course:

```typescript
// Query all outcomes for the courseId
Query.equal('courseId', 'course_c84473')

// Delete each document manually or via script
```

### 2. Clear Lesson Templates (if created)

```bash
# Delete all templates created by the seeding script
# Use Appwrite console to filter by courseId and delete
# Or use Query.equal('courseId', 'course_c84473')
```

### 3. Re-run Seeding with --force-update

```bash
# Force update to overwrite existing data
tsx scripts/seedSingleCourse.ts \
  --subject application_of_mathematics \
  --level national_3 \
  --force-update
```

### 4. Verify with --dry-run First

```bash
# Preview changes before applying
tsx scripts/seedSingleCourse.ts \
  --subject application_of_mathematics \
  --level national_3 \
  --dry-run
```

---

## Summary

**Active Scripts**:
- ✅ `assistant-ui-frontend/scripts/seedSingleCourse.ts` - Extract + populate outcomes for single course
- ✅ `assistant-ui-frontend/scripts/bulkSeedAllCourses.ts` - Batch process all courses
- ✅ `assistant-ui-frontend/scripts/seedAuthoredSOW.ts` - Create lesson templates with outcome references
- ✅ `assistant-ui-frontend/scripts/lib/courseSeeding.ts` - Shared seeding utilities
- ✅ `assistant-ui-frontend/scripts/lib/unitBasedExtraction.ts` - Unit-based outcome extraction (National 3/4)
- ✅ `assistant-ui-frontend/scripts/lib/skillsBasedExtraction.ts` - Skills-based outcome extraction (National 5+)

**Data Transformations**:
- ✅ `sqa_education.sqa_current` → `default.courses` + `default.course_outcomes` (Step 1)
- ✅ SOW `outcomeRefs: ["O1"]` → `lesson_templates.outcomeRefs: ["docId1", "docId2"]` (Step 2)
- ✅ Single source of truth: `course_outcomes` collection

**Complete Workflow**:
1. Run `seedSingleCourse.ts` to extract and populate course + outcomes from SQA data
2. Run `seedAuthoredSOW.ts` to create lesson_templates with real outcome references
3. Verify all outcomeRefs are valid document IDs in Appwrite console
