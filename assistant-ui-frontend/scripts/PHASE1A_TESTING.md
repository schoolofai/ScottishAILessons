# Phase 1A Testing Guide

## Overview
This guide helps you test the `seedSingleCourse.ts` script before proceeding to bulk processing (Phase 1B).

## Prerequisites
1. Ensure `.env.local` has required variables:
   ```bash
   NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
   APPWRITE_API_KEY=your_admin_api_key
   ```

2. Verify `sqa_education.sqa_current` collection is populated with SQA course data

## Test 1: Dry Run (No Database Writes)

Test the script logic without modifying the database:

```bash
cd assistant-ui-frontend
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3 --dry-run
```

**Expected Output:**
- ✅ Environment variables validated
- ✅ Found SQA course from collection
- ✅ Parsed course code from `data.qualification.course_code`
- 🏃 DRY RUN messages showing what would be created
- 📊 Summary with course ID and outcome count

**What to Check:**
- Course ID format: `course_<normalized_code>` (e.g., `course_c76574`)
- Subject/level converted to hyphens: `application-of-mathematics`, `national-3`
- Outcome extraction successful with reasonable count (5-15 outcomes typical)

## Test 2: Live Run (First Time)

Create actual database documents:

```bash
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
```

**Expected Output:**
- ✅ Created course document with generated ID
- ✅ Created N outcome documents (one per outcome)
- 🎉 Success message with summary

**Manual Verification in Appwrite Console:**

### Verify Course Document
1. Navigate to: Databases → default → courses collection
2. Search for courseId: `course_<code>` (from script output)
3. Check document fields:
   - `courseId`: course_<normalized_code>
   - `subject`: application-of-mathematics (hyphens)
   - `level`: national-3 (hyphens)
   - `sqaCode`: Original SQA code (e.g., "C765 74")
   - `schema_version`: 2

### Verify Course Outcomes
1. Navigate to: Databases → default → course_outcomes collection
2. Filter by courseId: `course_<code>`
3. Expected: Multiple documents (5-15 typical)
4. Check first outcome document fields:
   - `courseId`: Matches course document
   - `courseSqaCode`: Same as course's sqaCode
   - `unitCode`: Unit identifier (e.g., "H8R1 74")
   - `unitTitle`: Unit name
   - `outcomeId`: Outcome identifier (e.g., "1", "2", "3")
   - `outcomeTitle`: Outcome description
   - `assessmentStandards`: JSON string array
   - `teacherGuidance`: Formatted markdown text
   - `keywords`: JSON string array

## Test 3: Idempotency (Re-run)

Re-run the same command to verify skip logic:

```bash
tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
```

**Expected Output:**
- ℹ️  Course already exists: course_<code> (SKIP)
- ℹ️  Outcomes already exist for course_<code> (SKIP)
- ✅ Script completes without errors
- No duplicate documents created

**Verify:**
- Document counts in Appwrite console remain unchanged
- No new duplicate entries

## Test 4: Different Course

Test with a different subject/level combination:

```bash
tsx scripts/seedSingleCourse.ts --subject science --level national_4
```

**Expected:**
- New course and outcomes created
- Different courseId generated
- Independent from previous course

## Common Issues and Solutions

### Issue: "No SQA course found"
**Cause:** Subject/level mismatch or missing SQA data
**Solution:**
1. Check `sqa_education.sqa_current` collection in Appwrite console
2. Verify exact subject/level values (use underscores)
3. Try: `applications_of_mathematics` vs `application_of_mathematics`

### Issue: "No course_code found in data.qualification"
**Cause:** Unexpected SQA data structure
**Solution:**
1. Check error message showing actual data structure
2. Verify SQA data has `data.qualification.course_code` path
3. If structure differs, may need script adjustment

### Issue: "No units found in SQA course data"
**Cause:** Missing course structure in SQA data
**Solution:**
1. Check error message showing actual data structure
2. Verify SQA data has `data.course_structure.units` or `data.units`
3. Ensure units array contains outcome objects

### Issue: Permission denied when creating documents
**Cause:** Invalid or insufficient API key permissions
**Solution:**
1. Verify `APPWRITE_API_KEY` has admin/write permissions
2. Check API key is not expired
3. Regenerate API key in Appwrite console if needed

## Success Criteria

Phase 1A is successful when:
- ✅ Script runs without errors
- ✅ Course document created with correct structure
- ✅ All outcomes extracted and created
- ✅ Idempotency verified (re-run doesn't duplicate)
- ✅ Manual console verification confirms data quality
- ✅ Different courses can be seeded independently

## Next Steps

After Phase 1A validation:
1. Document any SQA data structure variations discovered
2. Note any edge cases or data quality issues
3. Proceed to Phase 1B: Extend to bulk processing (`bulkSeedAllCourses.ts`)

## Example Test Session Output

```
🌱 Phase 1A: Single Course Seeding

============================================================
Subject: application_of_mathematics
Level: national_3
Mode: LIVE
============================================================

✅ Environment variables validated
   Endpoint: https://cloud.appwrite.io/v1
   Project: 679abc...

✅ Admin client created with API key authentication

🔍 Querying sqa_education.sqa_current collection...
   Subject: "application_of_mathematics"
   Level: "national_3"
   ✅ Found SQA course: 679xyz...
   ✅ Parsed data field successfully
   ✅ Extracted course code: "C765 74"

📝 Creating course document...
   Generated courseId: course_c76574
   Normalized subject: application-of-mathematics
   Normalized level: national-3
   ✅ Created course document: 679abc...
   CourseId: course_c76574
   Subject: application-of-mathematics
   Level: national-3
   SQA Code: C765 74

🔍 Extracting outcomes from SQA course data...
   Found 2 units
   📦 Processing unit: H8R1 74 - Applications of Mathematics Unit 1
      Outcomes: 3
      ✅ 1: Use numerical skills to solve a problem in a mathematical context
      ✅ 2: Use graphical skills to solve a problem in a mathematical context
      ✅ 3: Use statistical skills to solve a problem in a mathematical context
   ✅ Extracted 3 total outcomes

📥 Creating course_outcomes documents...
   Total outcomes to create: 3
   ✅ Created 1: Use numerical skills... (679def...)
   ✅ Created 2: Use graphical skills... (679ghi...)
   ✅ Created 3: Use statistical skills... (679jkl...)

   📊 Creation Summary:
   ✅ Created: 3
   ❌ Failed: 0
   ✅ All 3 outcomes created successfully

============================================================
🎉 Single Course Seeding Complete!
============================================================

📊 Summary:
   Course ID: course_c76574
   SQA Code: C765 74
   Subject: application-of-mathematics
   Level: national-3
   Outcomes: 3
   Mode: LIVE

✅ Next Steps:
   1. Verify course document in Appwrite console: default.courses
      - Search for courseId: course_c76574
   2. Verify outcome documents in Appwrite console: default.course_outcomes
      - Filter by courseId: course_c76574
      - Expected count: 3
   3. Re-run this script to test idempotency (should skip existing)
   4. Once validated, proceed to Phase 1B: bulkSeedAllCourses.ts

👋 Exiting successfully...
```
