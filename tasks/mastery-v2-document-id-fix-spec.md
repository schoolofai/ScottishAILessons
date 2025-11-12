# MasteryV2 Document ID Fix - Specification

**Date Created**: 2025-11-12
**Status**: Planning
**Priority**: CRITICAL - Anti-Pattern Violation
**Related Files**:
- Debug Log: `langgraph-agent/tasks/MASTERY_FIELD_NAME_FIX_LOG.md`
- Data Model: `docs/appwrite-data-model.md`

---

## Executive Summary

The MasteryV2 collection should store outcome mastery scores indexed by **CourseOutcome document IDs** (e.g., `68f576b1000c0f5d0ae8`), but the system diverged to use **string references** (e.g., `O1`, `AS1.1`). Historical records contain empty keys (`{"": 0}`) from fallback mechanisms.

**Critical Discovery**: Phase 1 investigation proved the current data pipeline works correctly - enrichment successfully returns CourseOutcome objects with document IDs. The root issue is a **fallback mechanism in the backend that violates the fail-fast anti-pattern directive**.

---

## Problem Statement

### Current Behavior (Incorrect)

```json
{
  "$id": "695e9c5...",
  "studentId": "test_student_001",
  "courseId": "course_c84474",
  "emaByOutcome": "{\"\":0,\"O1\":1,\"AS1.1\":1}",  // ❌ Empty key, string refs
  "updatedAt": "2025-11-12T12:00:00.000Z"
}
```

**Issues:**
1. Empty key (`""`) from failed fallback logic
2. String references (`"O1"`) instead of document IDs
3. Assessment standards (`"AS1.1"`) mixed with outcomes

### Desired Behavior (Correct)

```json
{
  "$id": "695e9c5...",
  "studentId": "test_student_001",
  "courseId": "course_c84474",
  "emaByOutcome": "{\"68f576b1000c0f5d0ae8\":0.85,\"6913b73000151df21338\":0.92}",  // ✅ Document IDs only
  "updatedAt": "2025-11-12T14:30:00.000Z"
}
```

**Requirements:**
1. Keys MUST be CourseOutcome document IDs (20+ character Appwrite IDs)
2. NO empty keys allowed
3. NO string references allowed
4. Assessment standards NOT included (outcomes only)

---

## Root Cause Analysis

### Data Pipeline Flow (Working Correctly)

```
1. Lesson Template (Database)
   outcomeRefs: ["O1", "AS1.1", "AS1.2"]  ✅ Stored correctly

2. Session Creation (Frontend)
   lessonSnapshot compression: preserves all refs  ✅ Works

3. Session Loading (Frontend)
   lessonSnapshot decompression: ["O1", "AS1.1", "AS1.2"]  ✅ Works

4. Enrichment Entry (SessionChatAssistant)
   Input: ["O1", "AS1.1", "AS1.2"]  ✅ Received intact

5. Filtering (CourseOutcomesDriver.extractOutcomeIds)
   Input: ["O1", "AS1.1", "AS1.2"]
   Output: ["O1"]  ✅ Correct filtering (removes assessment standards)

6. Database Query (CourseOutcomesDriver)
   Query: ["O1"]
   Result: 3 CourseOutcome objects with $id fields  ✅ Success

7. Enrichment Output
   enrichedOutcomes: [
     {$id: "68f576b1000c0f5d0ae8", outcomeRef: "O1", ...},
     {$id: "6913b73000151df21338", outcomeRef: "O1", ...},
     {$id: "69140a2f0027c6e5edc9", outcomeRef: "O1", ...}
   ]  ✅ Success
```

**Verdict**: Pipeline works perfectly - enrichment returns CourseOutcome objects with document IDs.

### Root Cause: Backend Fallback Mechanism ❌

**File**: `langgraph-agent/src/agent/teaching_utils.py`
**Function**: `_update_mastery_scores()`

**Problematic Code Pattern**:
```python
def _update_mastery_scores(lesson_snapshot, state, existing_updates):
    enriched_outcomes = state.get("enriched_outcomes", [])

    # ❌ DANGEROUS FALLBACK - violates anti-pattern directive
    if not enriched_outcomes:
        logger.warning("No enriched_outcomes, falling back to outcomeRefs")
        outcome_refs_raw = lesson_snapshot.get("outcomeRefs", [])

        # Parse JSON if needed
        if isinstance(outcome_refs_raw, str):
            outcome_refs = json.loads(outcome_refs_raw)
        else:
            outcome_refs = outcome_refs_raw

        # ❌ This creates string refs instead of document IDs!
        enriched_outcomes = outcome_refs

    for outcome in enriched_outcomes:
        # ❌ Legacy fallback creates empty outcome_id when neither field exists
        outcome_id = outcome.get('$id', '') or outcome.get('outcomeRef', '')

        mastery_update = {
            "outcome_id": outcome_id,  # ❌ Can be "", "O1", "AS1.1"
            "score": score
        }
```

**Why This Creates Corrupted Data**:
1. **Fallback triggers** when enriched_outcomes is missing (old sessions, bugs)
2. **String refs used** instead of CourseOutcome objects with `$id` fields
3. **Empty keys created** when `outcome` is a string like `"O1"` (no `.get()` method)
4. **Silent failure** - no error raised, corrupted data persisted

**Anti-Pattern Violation**:
> User Directive (CLAUDE.md): "do not ever use fallback mechanisms unless specifically asked for - this should be considered a severe anti pattern - there should always be fast fail with error message instead."

This fallback mechanism violates the directive by:
- Silently accepting missing data
- Creating corrupted records instead of failing
- No error message to alert developers
- No debugging context logged

---

## Solution Architecture

### Design Principles

1. **Fail-Fast Everywhere**: Raise errors immediately when data is missing
2. **No Silent Fallbacks**: Remove all fallback logic that creates corrupted data
3. **Validate Structure**: Check document ID format and outcome structure
4. **Detailed Logging**: Provide debugging context in error messages
5. **User Feedback**: Show actionable error messages in UI

### Multi-Layer Validation

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Frontend Enrichment Validation                 │
│ - Detect when enrichment unexpectedly returns 0 outcomes│
│ - Distinguish "no outcomes" vs "failed to find"         │
│ - Throw error before session creation                   │
│ - Show user-friendly toast message                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Backend Data Validation                        │
│ - Require enriched_outcomes to be non-empty             │
│ - Validate outcome is dict with $id field               │
│ - Validate $id looks like Appwrite ID (>= 20 chars)     │
│ - Raise ValueError with detailed context                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Database Constraint (Future)                   │
│ - Add validation trigger to reject empty keys           │
│ - Add validation for document ID format                 │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Remove Backend Fallback (CRITICAL)

**File**: `langgraph-agent/src/agent/teaching_utils.py`
**Function**: `_update_mastery_scores()`
**Lines**: ~114-153

#### Changes Required

1. **Remove Fallback Logic**
   - Delete lines that parse `lesson_snapshot.outcomeRefs`
   - Delete `outcome.get('outcomeRef', '')` fallback
   - Delete all JSON parsing of outcomeRefs

2. **Add Fail-Fast Validation**
   ```python
   def _update_mastery_scores(lesson_snapshot: dict, state: dict, existing_updates: list) -> list:
       """Calculate and append new mastery updates based on student performance.

       CRITICAL REQUIREMENT: enriched_outcomes MUST be provided by frontend.
       This function will FAIL FAST if enriched_outcomes is missing or invalid.
       NO FALLBACK to string refs - this prevents silent data corruption.
       """
       enriched_outcomes = state.get("enriched_outcomes", [])

       # ✅ FAIL-FAST: Require enriched_outcomes with document IDs
       if not enriched_outcomes or len(enriched_outcomes) == 0:
           lesson_title = lesson_snapshot.get("title", "unknown")
           course_id = lesson_snapshot.get("courseId", "unknown")
           outcome_refs = lesson_snapshot.get("outcomeRefs", [])

           error_msg = (
               f"MASTERY UPDATE BLOCKED: Missing enriched outcomes from frontend.\n"
               f"Lesson: {lesson_title}\n"
               f"CourseID: {course_id}\n"
               f"OutcomeRefs in snapshot: {outcome_refs}\n"
               f"This indicates a data pipeline bug - frontend must provide CourseOutcome objects with $id fields.\n"
               f"NO FALLBACK is used to prevent data corruption with empty outcome_id keys."
           )
           logger.error(error_msg)
           raise ValueError(error_msg)

       mastery_updates = existing_updates.copy()
       is_correct = state.get("is_correct", False)
       attempts = state.get("attempts", 1)
       score = _calculate_mastery_score(is_correct, attempts)

       logger.info(f"Creating mastery updates: {len(enriched_outcomes)} outcomes, score={score}")

       for outcome in enriched_outcomes:
           # ✅ VALIDATE: Outcome structure
           if not isinstance(outcome, dict):
               error_msg = f"Invalid outcome type (expected dict, got {type(outcome)}): {outcome}"
               logger.error(error_msg)
               raise TypeError(error_msg)

           # ✅ VALIDATE: Document ID exists
           outcome_id = outcome.get('$id', '')
           if not outcome_id:
               error_msg = f"Outcome missing required $id field: {outcome}"
               logger.error(error_msg)
               raise ValueError(error_msg)

           # ✅ VALIDATE: Document ID format (Appwrite IDs are 20+ chars)
           if len(outcome_id) < 20:
               error_msg = f"Invalid outcome $id format (too short): {outcome_id}"
               logger.warning(error_msg)
               raise ValueError(error_msg)

           mastery_update = {
               "outcome_id": outcome_id,
               "score": score,
               "timestamp": datetime.now().isoformat()
           }
           mastery_updates.append(mastery_update)
           logger.info(f"✅ Created mastery update: outcome_id={outcome_id}, score={score}")

       logger.info(f"Successfully created {len(mastery_updates)} mastery updates")
       return mastery_updates
   ```

3. **Remove Dead Code**
   - Delete all JSON parsing utilities for outcomeRefs
   - Delete legacy fallback comments
   - Clean up imports if unused

#### Expected Impact

**Before**:
- Silent fallback when enriched_outcomes missing
- Corrupted MasteryV2 records with empty keys
- No error visibility for developers

**After**:
- Immediate `ValueError` with detailed context
- NO corrupted MasteryV2 records created
- Clear error message for debugging

---

### Phase 2: Add Frontend Validation (HIGH PRIORITY)

**File**: `assistant-ui-frontend/components/SessionChatAssistant.tsx`
**Location**: After enrichment call (~lines 176-218)

#### Changes Required

```typescript
// Enrich outcomeRefs to get full CourseOutcome objects with document IDs
const enrichedOutcomes = await enrichOutcomeRefs(
  parsedSnapshot.outcomeRefs,
  courseId,
  outcomeDriver
);

console.log('SessionChatAssistant - Enriched outcomes count:', enrichedOutcomes.length);

// ✅ VALIDATION: Fail-fast if enrichment unexpectedly returns empty
if (courseId && parsedSnapshot.outcomeRefs?.length > 0 && enrichedOutcomes.length === 0) {
  // Check if there were actual outcomeIds to enrich (not just assessment standards)
  const outcomeIds = outcomeDriver.extractOutcomeIds(parsedSnapshot.outcomeRefs);

  if (outcomeIds.length > 0) {
    // We SHOULD have found outcomes, but didn't - this is a critical error
    const errorMsg = `Outcome enrichment failed: Expected ${outcomeIds.length} outcomes from refs ${JSON.stringify(outcomeIds)}, but found 0`;

    console.error('❌ ENRICHMENT FAILURE:', {
      courseId,
      outcomeRefsInSnapshot: parsedSnapshot.outcomeRefs,
      outcomeIdsToFind: outcomeIds,
      enrichedOutcomesFound: enrichedOutcomes.length,
      errorMessage: errorMsg
    });

    // ✅ Show error to user
    toast.error('Lesson data incomplete - mastery tracking unavailable. Please contact support.');

    // ✅ FAIL-FAST: Throw error to prevent session start
    throw new Error(errorMsg);
  } else {
    console.log('SessionChatAssistant - No outcome IDs to enrich (only assessment standards) - this is expected');
  }
}
```

#### User Experience Flow

**Scenario 1: Happy Path**
1. Enrichment returns CourseOutcome objects
2. Validation passes silently
3. Session starts normally

**Scenario 2: Enrichment Failure**
1. Enrichment returns empty array (database issue)
2. Validation detects expected outcomes missing
3. Toast error shown: "Lesson data incomplete - mastery tracking unavailable. Please contact support."
4. Error thrown to prevent session creation
5. User cannot start corrupted lesson
6. Developer sees detailed error in console

---

### Phase 3: Clean Historical Data (OPTIONAL)

**File**: `assistant-ui-frontend/scripts/clean-mastery-empty-keys.ts`

#### Script Purpose

Remove empty keys from historical MasteryV2 records without breaking existing data.

#### Implementation

```typescript
import { Client, Databases, Query } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

async function cleanMasteryV2EmptyKeys() {
  console.log('🧹 Starting MasteryV2 empty key cleanup...');

  let cursor: string | null = null;
  let cleanedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  do {
    // Fetch batch of records
    const batch = await databases.listDocuments('default', 'MasteryV2', [
      Query.limit(100),
      ...(cursor ? [Query.cursorAfter(cursor)] : [])
    ]);

    console.log(`Processing batch: ${batch.documents.length} records`);

    for (const record of batch.documents) {
      try {
        const emaByOutcome = JSON.parse(record.emaByOutcome || '{}');

        // Check if empty key exists
        if ('' in emaByOutcome) {
          console.log(`Found empty key in record ${record.$id}:`, {
            studentId: record.studentId,
            courseId: record.courseId,
            keys: Object.keys(emaByOutcome),
            emptyKeyValue: emaByOutcome['']
          });

          // Remove empty key
          const cleaned = { ...emaByOutcome };
          delete cleaned[''];

          // ✅ VALIDATE: Don't create empty records
          if (Object.keys(cleaned).length === 0) {
            console.warn(`⚠️  Record ${record.$id} would be empty after cleanup - SKIPPING (manual review needed)`);
            skippedCount++;
            continue;
          }

          // Update record
          await databases.updateDocument('default', 'MasteryV2', record.$id, {
            emaByOutcome: JSON.stringify(cleaned),
            updatedAt: new Date().toISOString()
          });

          cleanedCount++;
          console.log(`✅ Cleaned record ${record.$id}: ${Object.keys(cleaned).length} valid keys remain`);
        }
      } catch (error) {
        console.error(`❌ Error cleaning record ${record.$id}:`, error);
        errorCount++;
      }
    }

    cursor = batch.documents.length === 100 ? batch.documents[batch.documents.length - 1].$id : null;
  } while (cursor);

  console.log('\n═══════════════════════════════════════');
  console.log('🎉 Cleanup complete!');
  console.log(`✅ Records cleaned: ${cleanedCount}`);
  console.log(`⚠️  Records skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('═══════════════════════════════════════\n');
}

cleanMasteryV2EmptyKeys().catch(console.error);
```

#### Execution

```bash
cd assistant-ui-frontend

# Set environment variables
export APPWRITE_ENDPOINT="https://cloud.appwrite.io/v1"
export APPWRITE_PROJECT_ID="your-project-id"
export APPWRITE_API_KEY="your-api-key"

# Run cleanup
npm run clean:mastery-empty-keys
```

#### Safety Measures

1. **Dry-Run Mode**: Add `--dry-run` flag to preview changes
2. **Backup First**: Export MasteryV2 collection before running
3. **Skip Empty Records**: Don't delete records that would become empty
4. **Error Logging**: Track all errors for manual review
5. **Batch Processing**: Process 100 records at a time to avoid timeouts

---

### Phase 4: End-to-End Testing

#### Test Scenario 1: Fresh Lesson (Happy Path)

**Prerequisites**:
- Backend running locally (langgraph dev)
- Frontend running (npm run dev)
- Test user: test@scottishailessons.com / red12345

**Steps**:
1. Login as test user
2. Navigate to Mathematics - National 3 course
3. Click "Start" on "Simple Addition Test" lesson
4. Complete first card with correct answer
5. Check browser console logs
6. Check backend logs (tail -f backend.log)
7. Query MasteryV2 collection in Appwrite console

**Expected Results**:
```
✅ Frontend Logs:
[SessionChatAssistant] Enriched outcomes count: 3
[enrichOutcomeRefs] Successfully enriched 3/1 outcomes

✅ Backend Logs:
🚨 MASTERY DEBUG - Enriched outcomes count: 3
🚨 MASTERY DEBUG - Enriched outcomes sample: [{'$id': '68f576b1000c0f5d0ae8', ...}]
✅ Created mastery update: outcome_id=68f576b1000c0f5d0ae8, score=1.0

✅ MasteryV2 Record:
{
  "$id": "695e9c5...",
  "studentId": "test_student_001",
  "courseId": "test_course_simple_math",
  "emaByOutcome": "{\"68f576b1000c0f5d0ae8\":1.0,\"6913b73000151df21338\":0.9,\"69140a2f0027c6e5edc9\":0.95}",
  "updatedAt": "2025-11-12T15:00:00.000Z"
}

✅ NO empty keys
✅ NO string refs (O1, AS1.1)
✅ Document IDs only
```

#### Test Scenario 2: Missing Enrichment (Fail-Fast Frontend)

**Prerequisites**:
- Temporarily remove outcomes from course_outcomes collection

**Steps**:
1. Delete all CourseOutcome records for test course
2. Try to start "Simple Addition Test" lesson
3. Observe error handling

**Expected Results**:
```
❌ Frontend Console:
❌ ENRICHMENT FAILURE: {
  courseId: "test_course_simple_math",
  outcomeRefsInSnapshot: ["O1", "AS1.1", "AS1.2"],
  outcomeIdsToFind: ["O1"],
  enrichedOutcomesFound: 0,
  errorMessage: "Outcome enrichment failed: Expected 1 outcomes, found 0"
}

✅ User UI:
Toast Error: "Lesson data incomplete - mastery tracking unavailable. Please contact support."
Session start blocked

✅ Database:
NO session record created
NO corrupted MasteryV2 record created

✅ Outcome: Fail-fast prevented corrupted data
```

#### Test Scenario 3: Backend Validation (Fail-Fast Backend)

**Prerequisites**:
- Mock teaching graph to send empty enriched_outcomes

**Steps**:
1. Modify teaching graph to pass empty array for enriched_outcomes
2. Start lesson and complete card
3. Observe backend error handling

**Expected Results**:
```
❌ Backend Logs:
ERROR - MASTERY UPDATE BLOCKED: Missing enriched outcomes from frontend.
Lesson: Simple Addition Test
CourseID: test_course_simple_math
OutcomeRefs in snapshot: ["O1", "AS1.1", "AS1.2"]
This indicates a data pipeline bug - frontend must provide CourseOutcome objects with $id fields.
NO FALLBACK is used to prevent data corruption with empty outcome_id keys.

ValueError: MASTERY UPDATE BLOCKED: Missing enriched outcomes from frontend.

✅ Database:
NO mastery update created
Session remains in valid state for retry

✅ Outcome: Fail-fast prevented corrupted mastery record
```

#### Test Scenario 4: Production Course

**Prerequisites**:
- Test on real production course: course_c84473 (Application of Mathematics - National 3)

**Steps**:
1. Login as test user
2. Start any lesson from course_c84473
3. Complete entire lesson
4. Verify MasteryV2 record

**Expected Results**:
```
✅ MasteryV2 Record (course_c84473):
{
  "studentId": "test_student_001",
  "courseId": "course_c84473",
  "emaByOutcome": "{\"68f576b1000c0f5d0ae8\":0.85,\"6913b73000151df21338\":0.92,...}",
  "updatedAt": "2025-11-12T15:30:00.000Z"
}

✅ All keys are 20+ character document IDs
✅ NO empty keys
✅ NO string refs
```

---

## Success Criteria

### Technical Validation

- [ ] Backend `_update_mastery_scores()` raises `ValueError` when enriched_outcomes missing
- [ ] Backend validates outcome structure (dict with $id field)
- [ ] Backend validates document ID format (>= 20 chars)
- [ ] Frontend throws error when enrichment unexpectedly returns 0 outcomes
- [ ] Frontend shows user-friendly toast error message
- [ ] Frontend prevents session creation with missing enrichment data

### Data Quality

- [ ] NEW MasteryV2 records have NO empty keys
- [ ] NEW MasteryV2 records use only document IDs as keys
- [ ] NEW MasteryV2 records have NO string refs (O1, AS1.1)
- [ ] Historical empty keys cleaned up (optional Phase 3)

### User Experience

- [ ] Users can complete lessons successfully (happy path)
- [ ] Users see actionable error messages when enrichment fails
- [ ] Users cannot start lessons with corrupted data (fail-fast prevents it)
- [ ] Support team has detailed error logs for debugging

### Developer Experience

- [ ] Error messages provide debugging context (lesson title, course ID, outcomeRefs)
- [ ] Backend logs show validation passing/failing
- [ ] Frontend console shows enrichment validation results
- [ ] No silent failures in production

---

## Rollback Plan

### If Phase 1 Breaks Production

**Symptom**: All lessons fail to create mastery updates

**Diagnosis**: enriched_outcomes not being passed from frontend

**Rollback**:
```bash
cd langgraph-agent
git revert <commit-hash>
./stop.sh && ./start.sh
```

**Fix Forward**: Debug frontend enrichment pipeline, ensure enriched_outcomes in state

### If Phase 2 Breaks Production

**Symptom**: Users cannot start any lessons

**Diagnosis**: Validation too strict, blocking valid lessons

**Rollback**:
```bash
cd assistant-ui-frontend
git revert <commit-hash>
npm run build
```

**Fix Forward**: Adjust validation logic to be less strict

---

## Monitoring and Alerting

### Metrics to Track

1. **MasteryV2 Empty Key Rate**
   - Query: Count MasteryV2 records with empty keys
   - Target: 0% after Phase 1 deployment
   - Alert: > 0% indicates fallback still triggering

2. **Enrichment Failure Rate**
   - Query: Frontend error logs for "ENRICHMENT FAILURE"
   - Target: < 0.1% (only database issues)
   - Alert: > 1% indicates systemic problem

3. **Backend Validation Failure Rate**
   - Query: Backend error logs for "MASTERY UPDATE BLOCKED"
   - Target: < 0.1% (only frontend bugs)
   - Alert: > 1% indicates frontend enrichment broken

4. **MasteryV2 Document ID Format**
   - Query: Validate all keys in emaByOutcome are 20+ chars
   - Target: 100% valid document IDs
   - Alert: < 100% indicates string refs still being created

### Dashboard Queries

```sql
-- Count records with empty keys
SELECT COUNT(*)
FROM MasteryV2
WHERE emaByOutcome LIKE '%"":0%' OR emaByOutcome LIKE '%"":1%';

-- Sample corrupted records
SELECT $id, studentId, courseId, emaByOutcome
FROM MasteryV2
WHERE emaByOutcome LIKE '%"":0%' OR emaByOutcome LIKE '%"":1%'
LIMIT 10;

-- Count records by key type (document ID vs string ref)
-- (Requires manual inspection via script)
```

---

## Timeline Estimate

| Phase | Time | Dependencies |
|-------|------|--------------|
| Phase 1: Backend Fail-Fast | 30 min | None |
| Phase 2: Frontend Validation | 30 min | Phase 1 complete |
| Phase 3: Data Cleanup (Optional) | 20 min | Phases 1-2 deployed |
| Phase 4: Testing | 60 min | All phases complete |
| **Total** | **2-3 hours** | Sequential execution |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Backend validation breaks lessons | Low | High | Thorough testing, rollback plan ready |
| Frontend validation blocks valid lessons | Medium | High | Graceful error handling, clear messages |
| Cleanup script corrupts data | Low | Critical | Dry-run mode, backup before execution |
| Historical data cannot be cleaned | Low | Low | Manual review of skipped records |
| Production deployment causes downtime | Low | Medium | Staged rollout, monitoring dashboards |

---

## Appendix A: Data Model Specification

### MasteryV2 Collection

**Collection**: `MasteryV2`
**Database**: `default`
**Security**: `documentSecurity: false`

**Schema**:
```typescript
interface MasteryV2 {
  $id: string;           // Appwrite document ID
  studentId: string;     // Reference to student (required, max 50 chars)
  courseId: string;      // Reference to course (required, max 50 chars)
  emaByOutcome: string;  // JSON object mapping outcome IDs to EMA scores (max 5000 chars)
  updatedAt: string;     // Last update timestamp (required, ISO datetime)
}
```

**emaByOutcome Structure**:
```typescript
// CORRECT FORMAT
{
  "68f576b1000c0f5d0ae8": 0.85,  // ✅ CourseOutcome document ID → EMA score
  "6913b73000151df21338": 0.92,
  "69140a2f0027c6e5edc9": 0.78
}

// INCORRECT FORMATS (Phase 1 prevents)
{
  "": 0,                          // ❌ Empty key
  "O1": 1,                        // ❌ String reference
  "AS1.1": 1                      // ❌ Assessment standard
}
```

**Indexes**:
- `unique_student_course` - Unique compound index on (studentId, courseId)

---

## Appendix B: Anti-Pattern Directive

**Source**: `CLAUDE.md`

> "do not ever use fallback mechanisms unless specifically asked for - this should be considered a severe anti pattern - there should always be fast fail with error message instead."

### Why Fallbacks Are Dangerous

1. **Silent Data Corruption**: Creates invalid records without alerting anyone
2. **Debugging Nightmare**: Errors discovered weeks later, root cause unclear
3. **Data Integrity**: Corrupted data propagates through analytics and recommendations
4. **User Impact**: Poor user experience from inaccurate progress tracking
5. **Technical Debt**: Cleanup scripts needed to fix historical data

### Fail-Fast Benefits

1. **Immediate Detection**: Errors caught at source, not downstream
2. **Clear Debugging**: Error context shows exactly what went wrong
3. **Data Quality**: NO corrupted records created
4. **User Experience**: Clear error messages instead of silent failures
5. **Maintainability**: No cleanup scripts or data migrations needed

---

## Appendix C: Related Documentation

- **Debug Log**: `langgraph-agent/tasks/MASTERY_FIELD_NAME_FIX_LOG.md` (Phase 1 investigation)
- **Data Model**: `docs/appwrite-data-model.md` (MasteryV2 specification)
- **CLAUDE.md**: Anti-pattern directive and coding standards
- **MasteryV2Driver**: `assistant-ui-frontend/lib/appwrite/driver/MasteryV2Driver.ts`
- **Teaching Utils**: `langgraph-agent/src/agent/teaching_utils.py`

---

**Status**: Ready for implementation
**Next Step**: Execute Phase 1 (Remove Backend Fallback)
