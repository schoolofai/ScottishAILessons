# Course Outcomes Migration Guide

## Overview

This guide explains the complete workflow for migrating the `course_outcomes` collection to match the SQA `sqa_current` database structure and updating the SOW seeding process to use real outcome references.

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

### Step 1: Extract SQA Outcomes

**Script**: `assistant-ui-frontend/scripts/extractSQAOutcomes.ts`

**Purpose**: Extracts outcome data from `sqa_education.sqa_current` and transforms it into the new course_outcomes schema.

**Run**:
```bash
cd assistant-ui-frontend
tsx scripts/extractSQAOutcomes.ts "C844 73" "course_c84473"
```

**Arguments**:
- `courseSqaCode`: SQA course code (e.g., "C844 73")
- `courseId`: Internal course ID used in lesson_templates and Authored_SOW (e.g., "course_c84473")

**Output**: `langgraph-author-agent/data/course_outcomes_import.json`

**Validation**:
- Queries `sqa_education.sqa_current` collection
- Flattens units → outcomes → assessment standards hierarchy
- Generates teacher guidance from marking guidance
- Extracts keywords from titles and descriptions

**Expected Console Output**:
```
🔍 SQA Outcomes Extraction Script
============================================================
  SQA Course Code: C844 73
  Internal Course ID: course_c84473
============================================================

✅ Environment variables validated

📖 Querying sqa_education.sqa_current for course: C844 73...

✅ Found 1 document(s)

📚 Processing: Application of Math - National 3
   Found 3 units

  📦 Unit: HV7Y 73 - Applications of Mathematics: Manage Money and Data (National 3)
     Outcomes: 2
     → O1: Manage money in basic real-life contexts
     → O2: Interpret graphical data

...

============================================================
📊 Extraction Summary:
============================================================
  Total units processed: 3
  Total outcomes extracted: 6
  Course outcomes records: 6

✅ Import file written to:
   /path/to/course_outcomes_import.json
```

---

### Step 2: Migrate course_outcomes Collection

**Script**: `assistant-ui-frontend/scripts/migrateCourseOutcomes.ts`

**Purpose**: Backs up, clears, and repopulates the course_outcomes collection with the SQA-aligned structure.

**Run**:
```bash
cd assistant-ui-frontend
tsx scripts/migrateCourseOutcomes.ts course_c84473
```

**Arguments**:
- `courseId`: Internal course ID (must match extractSQAOutcomes.ts)

**Process**:
1. **Backup**: Saves existing course_outcomes to `course_outcomes_backup.json`
2. **Delete**: Removes all old course_outcomes for the specified course
3. **Import**: Creates new documents from `course_outcomes_import.json`
4. **Validate**: Ensures all outcomeIds are queryable

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

---

### Step 3: Seed Authored_SOW with Real Outcome References

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

**Cause**: `sqa_current` doesn't have data for the specified course code.

**Fix**: Verify the course code matches exactly (case-sensitive, whitespace matters):
```bash
# List available courses
tsx scripts/extractSQAOutcomes.ts "C844 73" "test" 2>&1 | grep "Available course"
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

**Fix 1**: Check if migrateCourseOutcomes.ts completed successfully.

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

If migration fails or produces incorrect results:

### 1. Restore Backup

```bash
cd assistant-ui-frontend
tsx scripts/restoreCourseOutcomesBackup.ts course_c84473
```

*Note: Create this script if needed or manually restore from `course_outcomes_backup.json`*

### 2. Clear Lesson Templates

```bash
# Delete all templates created by the seeding script
# Use Appwrite MCP with Query.equal('createdBy', 'sow_author_agent')
```

### 3. Re-run Migration

Fix the issue, then re-run the migration workflow from Step 1.

---

## Summary

**Files Created/Modified**:
- ✅ `scripts/extractSQAOutcomes.ts` (NEW)
- ✅ `scripts/migrateCourseOutcomes.ts` (NEW)
- ✅ `scripts/seedAuthoredSOW.ts` (UPDATED with validation + mapping)

**Data Transformations**:
- ✅ `sqa_current` → `course_outcomes_import.json` → `course_outcomes` collection
- ✅ SOW `outcomeRefs: ["O1"]` → `lesson_templates.outcomeRefs: ["docId1", "docId2"]`
- ✅ Single source of truth: `course_outcomes` collection

**Next Steps**:
1. Run `extractSQAOutcomes.ts` to generate import file
2. Run `migrateCourseOutcomes.ts` to populate course_outcomes
3. Run `seedAuthoredSOW.ts` to create lesson_templates with real references
4. Verify all outcomeRefs are valid document IDs
