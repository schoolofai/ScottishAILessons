# Lesson Completion API - Debug Plan

## Schema Analysis Summary

### 1. **Evidence Collection** ✅ Schema is correct
```
REQUIRED:
  - sessionId: string (size: 50)
  - itemId: string (size: 50)
  - response: string (size: 100000)
  - correct: boolean

OPTIONAL:
  - attempts: integer (default: 1)
  - confidence: double (default: 0)
  - reasoning: string
  - feedback: string
  - timestamp: datetime
  - attemptIndex: integer (default: 0)
  - score: double (default: 0)
  - outcomeScores: string (default: "{}")
  - submittedAt: datetime
  - student_drawing_file_ids: string[]
  - student_drawing_text: string

Document Security: false
```

**Current Error**: Server Error 500 when creating evidence records

**Possible Causes**:
- Field name mismatch (`itemId` vs `item_id`)
- Missing required fields
- Invalid data types
- Field size exceeded (response > 100000 chars)

---

### 2. **MasteryV2 Collection** ❌ API USES WRONG SCHEMA!
```
REQUIRED:
  - studentId: string (size: 50)
  - courseId: string (size: 50)
  - updatedAt: datetime

OPTIONAL:
  - emaByOutcome: string (size: 5000) [JSON string]
    Format: { "O1": 0.75, "AS1.1": 0.82, ... }

Document Security: false
Unique Index: [studentId, courseId]
```

**CRITICAL ISSUE**:
- ✅ MasteryV2 stores ONE document per student/course with ALL outcomes in `emaByOutcome` JSON
- ❌ API tries to create/update INDIVIDUAL records per outcome with `outcomeId` field
- ❌ `outcomeId` field DOES NOT EXIST in MasteryV2 schema!

**API Code (INCORRECT)**:
```typescript
// Lines 143-186 in complete/route.ts
// Tries to query with outcomeId:
Query.equal('outcomeId', outcomeId)  // ❌ Field doesn't exist!

// Tries to create with outcomeId:
{
  studentId: student.$id,
  courseId: session.courseId,
  outcomeId: outcomeId,  // ❌ Not in schema!
  ema: newEMA
}
```

**CORRECT APPROACH**:
```typescript
// 1. Fetch single MasteryV2 document for student/course
const masteryDoc = await databases.listDocuments('default', 'MasteryV2', [
  Query.equal('studentId', student.$id),
  Query.equal('courseId', session.courseId)
]);

// 2. Parse emaByOutcome JSON
const emaByOutcome = masteryDoc.length > 0
  ? JSON.parse(masteryDoc[0].emaByOutcome || '{}')
  : {};

// 3. Update ALL outcomes at once
masteryUpdates.forEach(update => {
  emaByOutcome[update.outcomeId] = update.newEMA;
});

// 4. Save back as single document
if (masteryDoc.length > 0) {
  await databases.updateDocument('default', 'MasteryV2', masteryDoc[0].$id, {
    emaByOutcome: JSON.stringify(emaByOutcome),
    updatedAt: new Date().toISOString()
  });
} else {
  await databases.createDocument('default', 'MasteryV2', ID.unique(), {
    studentId: student.$id,
    courseId: session.courseId,
    emaByOutcome: JSON.stringify(emaByOutcome),
    updatedAt: new Date().toISOString()
  }, permissions);
}
```

---

### 3. **Routine Collection** ⚠️ Document Security Enabled
```
REQUIRED:
  - studentId: string (size: 50)
  - courseId: string (size: 50)

OPTIONAL:
  - lastSessionDate: datetime
  - daysSinceLastSession: integer (default: 0)
  - lastTaughtAt: datetime
  - dueAtByOutcome: string (size: 5000) [JSON string]
    Format: { "O1": "2025-11-28T...", "AS1.1": "2025-11-28T...", ... }
  - spacingPolicyVersion: integer (default: 1)
  - schema_version: integer (default: 1)

Document Security: true ⚠️
```

**Issue**: Document Security is enabled, requiring permissions for create/update

**API Code (lines 260-276)**: Already has permissions handling ✅
```typescript
const permissions = [
  Permission.read(Role.user(user.$id)),
  Permission.update(Role.user(user.$id)),
  Permission.delete(Role.user(user.$id))
];
```

**Schema Usage**: ✅ Correct - stores all outcomes in `dueAtByOutcome` JSON

---

### 4. **Sessions Collection** ✅ Already verified
```
REQUIRED:
  - studentId: string (size: 50)
  - courseId: string (size: 50)
  - startedAt: datetime
  - lessonSnapshot: string (size: 100000)
  - status: string

Document Security: false
```

**API Usage**: ✅ Correct (lines 49-89)

---

## Debug Action Plan

### Priority 1: Fix MasteryV2 Schema Mismatch (CRITICAL)
**Impact**: This is blocking ALL lesson completions

**Steps**:
1. Rewrite mastery update logic (lines 130-196) to use correct schema
2. Fetch single MasteryV2 document per student/course
3. Update `emaByOutcome` JSON with all outcome updates
4. Handle unique constraint on [studentId, courseId]
5. Update integration tests to match new logic

**Files to modify**:
- `/app/api/student/sessions/[sessionId]/complete/route.ts` (lines 130-196)
- `__tests__/integration/api/completion.test.ts` (mastery test expectations)

---

### Priority 2: Debug Evidence Creation Error
**Impact**: Currently failing with Server Error 500

**Steps**:
1. Add detailed logging (already done in latest code)
2. Retry lesson completion to see exact error details
3. Verify field name mapping (`itemId` vs `item_id`)
4. Check for field size violations (response > 100000 chars)
5. Validate data types match schema

**Data Flow**:
```
Frontend (LessonCompletionSummaryTool.tsx):
  evidence.map() → {
    sessionId,     ✅
    itemId,        ✅
    response,      ✅
    correct,       ✅
    attempts,      ✅
    confidence,    ✅
    reasoning,     ✅
    feedback,      ✅
    timestamp      ✅
  }

API receives: evidenceData
API creates: databases.createDocument('evidence', ..., evidenceData)
```

**Hypothesis**: Field names look correct, likely a data type or size issue

---

### Priority 3: Verify Routine Update Logic
**Impact**: Low - routine logic looks correct

**Status**: ✅ API code looks correct
- Uses correct collection name: `'routine'`
- Handles permissions properly
- Updates `dueAtByOutcome` JSON correctly

---

## Testing Strategy

### 1. Unit Test MasteryV2 Fix
```typescript
// Test single document per student/course
// Test emaByOutcome JSON merging
// Test unique constraint handling
```

### 2. Integration Test with Mock Data
```typescript
// Run existing tests after MasteryV2 fix
// All 9 tests should pass
```

### 3. E2E Test with Real Lesson
```typescript
// Complete a lesson session
// Verify all 4 collections updated correctly:
//   - Evidence records created
//   - MasteryV2 emaByOutcome updated
//   - Routine dueAtByOutcome updated
//   - Session status = 'completed'
```

---

## Expected Outcomes

After fixes:
1. ✅ Evidence records created successfully
2. ✅ MasteryV2 document updated with all outcome EMAs
3. ✅ Routine document updated with spaced repetition schedules
4. ✅ Session marked as completed
5. ✅ Review tab shows overdue outcomes when due dates pass

---

## Current Status

- ❌ Evidence creation: Failing with Server Error 500 (needs debugging)
- ❌ MasteryV2 update: Using wrong schema (needs complete rewrite)
- ✅ Routine update: Schema looks correct
- ✅ Session verification: Working correctly
