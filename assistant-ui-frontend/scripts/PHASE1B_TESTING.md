# Phase 1B Testing Guide

## Overview
This guide helps you test the `bulkSeedAllCourses.ts` script which extends Phase 1A logic to process all SQA courses in bulk.

## Prerequisites
1. Phase 1A successfully validated (Spanish course test completed)
2. `.env.local` configured with Appwrite credentials
3. `sqa_education.sqa_current` collection populated

## Test Progression

### Test 1: Dry Run with Limit (Preview)

Preview bulk processing on first 5 courses without database writes:

```bash
cd assistant-ui-frontend
tsx scripts/bulkSeedAllCourses.ts --dry-run --limit 5
```

**Expected Output:**
- ✅ Fetches 5 courses from sqa_education.sqa_current
- 🔍 Processes each course sequentially
- 🏃 "Would create" messages for each course/outcome
- 📊 Summary report showing what would be created
- 📄 JSON report saved to `reports/` directory

**What to Check:**
- All 5 courses processed without errors
- CourseId generation working for different course codes
- Outcome extraction working across different subjects
- Report shows expected counts

### Test 2: Small Batch Live Run (First 10 Courses)

Create actual documents for first 10 courses:

```bash
tsx scripts/bulkSeedAllCourses.ts --limit 10
```

**Expected Output:**
- ✅ Creates 10 course documents
- ✅ Creates N outcome documents (varies by course)
- ℹ️  Skips Spanish course if already exists from Phase 1A
- 📊 Summary with created/skipped counts
- 📄 JSON report with detailed results

**Manual Verification in Appwrite Console:**

1. **Check Courses Collection:**
   - Navigate to: Databases → default → courses
   - Filter by schema_version = 2
   - Should see 10 new courses (or 9 if Spanish was skipped)
   - Verify different subjects/levels represented

2. **Check Course Outcomes Collection:**
   - Navigate to: Databases → default → course_outcomes
   - Sort by $createdAt (newest first)
   - Should see multiple new outcomes from different courses
   - Sample 2-3 courses and verify outcome counts match report

### Test 3: Idempotency Test (Re-run Same Batch)

Re-run the same 10-course batch to verify skip logic:

```bash
tsx scripts/bulkSeedAllCourses.ts --limit 10
```

**Expected Output:**
- ℹ️  All 10 courses show "Course already exists (SKIP)"
- ℹ️  All courses show "Outcomes already exist (SKIP)"
- 📊 Summary: coursesSkipped = 10, coursesCreated = 0
- ⚡ Completes quickly (no database writes)

**Verify:**
- No duplicate documents created
- Document counts in Appwrite console unchanged
- Script handles existing data gracefully

### Test 4: Full Bulk Run (All Courses)

Process all SQA courses in the collection:

```bash
tsx scripts/bulkSeedAllCourses.ts
```

**Expected Output:**
- 🔍 Fetches all courses with pagination (batches of 100)
- 📦 Processes each course sequentially
- ℹ️  Skips courses already created in previous tests
- ✅ Creates remaining courses and outcomes
- 📊 Comprehensive summary report
- ⏱️  Completion time varies (5-10 minutes for 150+ courses)

**Monitor Progress:**
- Watch console output for each course
- Look for any error messages
- Note which courses are skipped vs created

**Post-Completion Verification:**

1. **Check Final Counts:**
   ```bash
   # In Appwrite Console or API
   # Expected: ~150-200 courses (depending on SQA data)
   # Expected: ~500-1000 outcomes (varies by course structure)
   ```

2. **Review JSON Report:**
   - Open latest report in `assistant-ui-frontend/reports/`
   - Check `coursesFailed` count (should be 0 or minimal)
   - Review any failed courses and their error messages
   - Verify `totalOutcomesCreated` is reasonable

3. **Sample Quality Checks:**
   - Pick 3 random courses from different subjects
   - Verify course documents have correct structure
   - Verify outcomes are properly linked (courseId matches)
   - Check assessment standards are populated
   - Verify teacher guidance is formatted

### Test 5: Offset Processing (Partial Batch)

Test pagination offset for incremental processing:

```bash
tsx scripts/bulkSeedAllCourses.ts --offset 10 --limit 5
```

**Expected Output:**
- Skips first 10 courses
- Processes courses 11-15
- Useful for resuming interrupted runs

## Common Issues and Solutions

### Issue: "No SQA courses found"
**Cause:** Empty sqa_education.sqa_current collection
**Solution:**
- Verify SQA data has been imported
- Check collection name is correct
- Verify database name is `sqa_education`

### Issue: Multiple courses failing with same error
**Cause:** Data structure variation in SQA collection
**Solution:**
- Check error message in report for pattern
- Investigate failing course in SQA collection
- May need script adjustment for edge cases

### Issue: Performance degradation during bulk run
**Cause:** Network latency or rate limiting
**Solution:**
- Normal for large batches (150+ courses)
- Script processes sequentially to avoid overwhelming API
- Monitor Appwrite dashboard for any issues

### Issue: Some courses missing course_code
**Cause:** Incomplete SQA data
**Solution:**
- Review failed courses in JSON report
- Check if course_code exists in SQA data
- May need manual data cleanup or import fix

### Issue: Duplicate courses with different IDs
**Cause:** CourseId collision or data inconsistency
**Solution:**
- Check if multiple SQA records map to same course_code
- Review courseId generation logic
- May need deduplication strategy

## Success Criteria

Phase 1B is successful when:
- ✅ Dry-run test completes without errors
- ✅ Small batch (10 courses) creates correct documents
- ✅ Idempotency verified (re-run skips existing)
- ✅ Full bulk run completes with <5% failure rate
- ✅ JSON report generated with detailed results
- ✅ Manual spot checks confirm data quality
- ✅ All courses have outcomes created

## Performance Benchmarks

Expected timings (approximate):
- Dry-run (5 courses): ~5-10 seconds
- Live run (10 courses): ~30-60 seconds
- Full bulk run (150 courses): ~5-10 minutes
- Idempotency check (10 courses): ~10-20 seconds

## JSON Report Structure

```json
{
  "timestamp": "2025-10-10T12:00:00.000Z",
  "totalProcessed": 150,
  "coursesCreated": 140,
  "coursesSkipped": 8,
  "coursesFailed": 2,
  "totalOutcomesCreated": 672,
  "dryRun": false,
  "results": [
    {
      "courseId": "course_c76973",
      "sqaCode": "C769 73",
      "subject": "spanish",
      "level": "national_3",
      "status": "skipped",
      "courseCreated": false,
      "outcomesCreated": 0,
      "outcomesSkipped": true,
      "timestamp": "2025-10-10T12:00:05.000Z"
    },
    {
      "courseId": "course_c74775",
      "sqaCode": "C747 75",
      "subject": "mathematics",
      "level": "national_5",
      "status": "created",
      "courseCreated": true,
      "outcomesCreated": 6,
      "outcomesSkipped": false,
      "timestamp": "2025-10-10T12:00:12.000Z"
    }
  ]
}
```

## Next Steps After Phase 1B

Once bulk seeding is validated:
1. **Document any SQA data issues discovered**
   - Missing course codes
   - Inconsistent data structures
   - Incomplete outcome information

2. **Phase 2: Refactor SOW Seeding Script**
   - Remove phases -3, -2, -1 from `seedAuthoredSOW.ts`
   - Add fail-fast validation for prerequisites
   - Update to accept courseId as CLI parameter

3. **Phase 3: Update Documentation**
   - Update seeding workflow diagrams
   - Document new prerequisites
   - Create migration guide

4. **Phase 4: Testing**
   - Complete regression testing checklist
   - Verify SOW seeding works with new prerequisites
   - Test end-to-end workflow

## Example Full Bulk Run Output

```
🌱 Phase 1B: Bulk Course Seeding

============================================================
Mode: LIVE
============================================================

✅ Environment variables validated
✅ Admin client created

🔍 Fetching SQA courses from sqa_education.sqa_current...
   Fetched 100 courses (offset: 0)
   Fetched 54 courses (offset: 100)
   ✅ Total courses fetched: 154

🚀 Starting bulk processing of 154 courses...

[1/154] Processing: spanish (national_3)
   CourseId: course_c76973
   SQA Code: C769 73
   ℹ️  Course already exists (SKIP)
   📦 Extracted 4 outcomes
   ℹ️  Outcomes already exist (SKIP)

[2/154] Processing: mathematics (national_5)
   CourseId: course_c74775
   SQA Code: C747 75
   ✅ Created course document
   📦 Extracted 6 outcomes
   ✅ Created 6 outcomes

[3/154] Processing: biology (national_4)
   CourseId: course_c70474
   SQA Code: C704 74
   ✅ Created course document
   📦 Extracted 5 outcomes
   ✅ Created 5 outcomes

...

[154/154] Processing: drama (national_3)
   CourseId: course_c84873
   SQA Code: C848 73
   ✅ Created course document
   📦 Extracted 3 outcomes
   ✅ Created 3 outcomes

📊 Report saved: reports/bulk-seed-report-1696940400000.json

============================================================
📊 Bulk Seeding Summary
============================================================

Mode: LIVE
Timestamp: 2025-10-10T12:15:00.000Z

📈 Results:
   Total Processed: 154
   ✅ Courses Created: 153
   ℹ️  Courses Skipped: 1
   ❌ Courses Failed: 0
   📦 Total Outcomes Created: 728

============================================================

🎉 Bulk seeding complete!

👋 Exiting successfully...
```

## Troubleshooting Tips

1. **Script Times Out:**
   - Reduce batch size with `--limit`
   - Check network connectivity
   - Monitor Appwrite dashboard for issues

2. **Inconsistent Results:**
   - Clear Appwrite cache
   - Restart Appwrite services if self-hosted
   - Re-run with same parameters

3. **Memory Issues:**
   - Script processes sequentially (low memory footprint)
   - If issues persist, increase Node.js heap size:
     ```bash
     NODE_OPTIONS="--max-old-space-size=4096" tsx scripts/bulkSeedAllCourses.ts
     ```

4. **Want to Restart from Scratch:**
   - Delete all schema_version=2 courses from Appwrite console
   - Delete associated outcomes by filtering courseId pattern `course_*`
   - Re-run bulk seed script
