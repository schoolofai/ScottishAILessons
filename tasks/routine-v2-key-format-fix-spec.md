# Fix Specification: RoutineV2 Key Format Translation & Validation

## Problem Statement

**Critical Bug**: The RoutineV2 spaced repetition system contains duplicate keys in different formats, causing incorrect review intervals.

### Evidence

Actual `RoutineV2.dueAtByOutcome` data shows multiple key formats:
```json
{
  "": "2025-11-19T13:18:40.329Z",                          // Empty string (invalid)
  "O1": "2025-11-19T14:13:55.732Z",                         // String ref (CORRECT)
  "AS1.1": "2025-11-19T14:13:56.207Z",                      // String ref (CORRECT)
  "outcome_test_simple_o1": "2025-11-13T15:46:50.242Z",    // Document ID (WRONG)
  "outcome_test_simple_o1#AS1.1": "2025-11-13T15:46:50.776Z" // Composite key (WRONG)
}
```

### User Impact

Student with 0.3 mastery sees "Due 7d" instead of expected "Due 1d":
- SpacedRepetitionService looks up "O1" (finds 7-day interval from old entry)
- Ignores "outcome_test_simple_o1" (correct 1-day interval from recent update)
- **Root Cause**: LessonCompletionSummaryTool passes document IDs to RoutineDriver without translation

## Data Model Context

### MasteryV2 (Source)
- Uses **document IDs** as keys in `emaByOutcome`
- Example: `{"outcome_test_simple_o1": 0.3, "outcome_test_simple_o1#AS1.1": 0.3}`
- Composite key format: `{documentId}#{asCode}`

### RoutineV2 (Consumer)
- Uses **string refs** as keys in `dueAtByOutcome`
- Example: `{"O1": "2025-11-13...", "AS1.1": "2025-11-13..."}`
- Expected key format: SQA codes ("O1", "AS1.1") - NO document IDs or composite keys

### Translation Required

| MasteryV2 Key              | RoutineV2 Key (Expected) |
|----------------------------|--------------------------|
| `outcome_test_simple_o1`   | `O1`                     |
| `outcome_test_simple_o1#AS1.1` | `AS1.1`              |

## Solution: Three-Part Fix

### Part 1: Add Translation Layer in LessonCompletionSummaryTool

**File**: `assistant-ui-frontend/components/tools/LessonCompletionSummaryTool.tsx`

**Location**: Line ~144-170 (where `updateOutcomeSchedule()` is called)

**Current Code** (BROKEN):
```typescript
// Process mastery data and update routines
for (const [outcomeId, ema] of Object.entries(emaByOutcome)) {
  try {
    await routineDriver.updateOutcomeSchedule(
      studentId,
      courseId,
      outcomeId,  // ❌ WRONG: This is a document ID or composite key
      ema
    );
  } catch (error) {
    console.error(`Failed to update schedule for outcome ${outcomeId}:`, error);
  }
}
```

**Fixed Code**:
```typescript
// Build reverse mapping: documentId → outcomeId (string ref)
const documentIdToOutcomeId = new Map<string, string>();

if (enrichedOutcomes && enrichedOutcomes.length > 0) {
  enrichedOutcomes.forEach((outcome: any) => {
    const docId = outcome.$id;          // "outcome_test_simple_o1"
    const stringRef = outcome.outcomeId; // "O1"

    if (docId && stringRef) {
      documentIdToOutcomeId.set(docId, stringRef);

      // Also map composite keys -> AS codes
      const asListJson = outcome.assessmentStandards || "[]";
      try {
        const asList = typeof asListJson === 'string' ? JSON.parse(asListJson) : asListJson;

        if (Array.isArray(asList)) {
          asList.forEach((as: any) => {
            const asCode = as.code; // "AS1.1"
            if (asCode) {
              const compositeKey = `${docId}#${asCode}`;
              documentIdToOutcomeId.set(compositeKey, asCode);
            }
          });
        }
      } catch (e) {
        console.warn(`Failed to parse assessmentStandards for ${docId}:`, e);
      }
    }
  });
}

console.log("🔑 Document ID → Outcome ID mapping:", Object.fromEntries(documentIdToOutcomeId));

// Process mastery data with translation
for (const [masteryKey, ema] of Object.entries(emaByOutcome)) {
  try {
    // Translate document ID or composite key → string ref
    const stringRef = documentIdToOutcomeId.get(masteryKey);

    if (!stringRef) {
      console.warn(`⚠️ No string ref found for mastery key: ${masteryKey}, skipping RoutineV2 update`);
      continue;
    }

    console.log(`✅ Translating mastery key: ${masteryKey} → ${stringRef}`);

    await routineDriver.updateOutcomeSchedule(
      studentId,
      courseId,
      stringRef,  // ✅ CORRECT: Now using string ref ("O1", "AS1.1")
      ema
    );
  } catch (error) {
    console.error(`Failed to update schedule for outcome ${masteryKey}:`, error);
  }
}
```

**Key Changes**:
1. Build `documentId → outcomeId` mapping from `enrichedOutcomes`
2. Parse composite keys: `"outcome_test_simple_o1#AS1.1"` → `"AS1.1"`
3. Translate before calling `updateOutcomeSchedule()`
4. Skip if no string ref found (fail-fast with warning)

### Part 2: Add Validation to RoutineDriver

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts`

**Location**: Line ~278-300 (`updateOutcomeSchedule()` method)

**Current Code** (NO VALIDATION):
```typescript
async updateOutcomeSchedule(
  studentId: string,
  courseId: string,
  outcomeId: string,  // Accepts any string
  newEMA: number
): Promise<any> {
  // ... calculation logic ...

  return await this.updateDueAtByOutcome(studentId, courseId, {
    [outcomeId]: nextDueDate
  });
}
```

**Fixed Code**:
```typescript
async updateOutcomeSchedule(
  studentId: string,
  courseId: string,
  outcomeId: string,
  newEMA: number
): Promise<any> {
  // ✅ VALIDATION: Reject invalid key formats
  if (!outcomeId || outcomeId.trim().length === 0) {
    throw new Error(`Invalid outcomeId (empty string) for RoutineV2 update`);
  }

  if (outcomeId.includes('#')) {
    throw new Error(
      `Invalid outcomeId (composite key): '${outcomeId}'. ` +
      `RoutineV2 expects string refs (e.g., "O1", "AS1.1"), not composite keys. ` +
      `Caller must parse composite keys and extract AS code.`
    );
  }

  if (outcomeId.length >= 20 && !outcomeId.includes('.')) {
    throw new Error(
      `Invalid outcomeId (document ID): '${outcomeId}'. ` +
      `RoutineV2 expects string refs (e.g., "O1", "AS1.1"), not Appwrite document IDs. ` +
      `Caller must translate document IDs to string refs using CourseOutcomesDriver.`
    );
  }

  // Valid format: "O1", "O2", "AS1.1", "AS2.3", etc.
  const validFormat = /^[A-Z]+\d+(\.\d+)?$/;
  if (!validFormat.test(outcomeId)) {
    throw new Error(
      `Invalid outcomeId format: '${outcomeId}'. ` +
      `Expected SQA code format like "O1", "AS1.1", etc.`
    );
  }

  console.log(`✅ RoutineDriver: Valid outcomeId format: ${outcomeId}`);

  // ... existing calculation logic ...

  return await this.updateDueAtByOutcome(studentId, courseId, {
    [outcomeId]: nextDueDate
  });
}
```

**Validation Rules**:
1. ❌ Reject empty strings
2. ❌ Reject composite keys (contains `#`)
3. ❌ Reject document IDs (20+ chars without decimal)
4. ✅ Accept only SQA codes: `O1`, `O2`, `AS1.1`, `AS2.3`, etc.

### Part 3: Optional Cleanup Script (Future Enhancement)

**Purpose**: Remove duplicate/invalid keys from existing RoutineV2 records

**File**: `scripts/cleanup-routine-v2-keys.ts`

**Pseudocode**:
```typescript
// For each RoutineV2 record:
// 1. Parse dueAtByOutcome JSON
// 2. Filter out invalid keys:
//    - Empty strings
//    - Document IDs (20+ chars without decimal)
//    - Composite keys (contains '#')
// 3. Keep only valid string refs
// 4. Update document with cleaned data

// Example:
// Before: {"": "...", "O1": "...", "outcome_test_simple_o1": "..."}
// After:  {"O1": "..."}
```

**Note**: This is optional and can be deferred. The validation in Part 2 prevents future corruption.

## Testing Plan

### 1. Unit Tests

**Test RoutineDriver Validation**:
```typescript
describe('RoutineDriver.updateOutcomeSchedule() validation', () => {
  it('should accept valid string refs', async () => {
    await expect(driver.updateOutcomeSchedule(studentId, courseId, "O1", 0.5)).resolves.not.toThrow();
    await expect(driver.updateOutcomeSchedule(studentId, courseId, "AS1.1", 0.7)).resolves.not.toThrow();
  });

  it('should reject empty strings', async () => {
    await expect(driver.updateOutcomeSchedule(studentId, courseId, "", 0.5)).rejects.toThrow("empty string");
  });

  it('should reject composite keys', async () => {
    await expect(driver.updateOutcomeSchedule(studentId, courseId, "outcome_test_simple_o1#AS1.1", 0.5))
      .rejects.toThrow("composite key");
  });

  it('should reject document IDs', async () => {
    await expect(driver.updateOutcomeSchedule(studentId, courseId, "outcome_test_simple_o1", 0.5))
      .rejects.toThrow("document ID");
  });
});
```

### 2. Integration Test

**Scenario**: Complete a lesson and verify RoutineV2 is updated with correct string refs

**Steps**:
1. Start lesson session with `enrichedOutcomes` containing:
   - Outcome: `{$id: "outcome_test_simple_o1", outcomeId: "O1", assessmentStandards: [{code: "AS1.1"}]}`
2. Complete lesson with mastery score 0.3
3. Verify MasteryV2 contains:
   - `{"outcome_test_simple_o1": 0.3, "outcome_test_simple_o1#AS1.1": 0.3}`
4. Verify RoutineV2 contains (AFTER fix):
   - `{"O1": "2025-11-13...", "AS1.1": "2025-11-13..."}` (1-day interval for 0.3 mastery)
5. Verify spaced repetition panel shows "Due 1d" (not "Due 7d")

**Expected Console Logs**:
```
🔑 Document ID → Outcome ID mapping: {
  "outcome_test_simple_o1": "O1",
  "outcome_test_simple_o1#AS1.1": "AS1.1"
}
✅ Translating mastery key: outcome_test_simple_o1 → O1
✅ RoutineDriver: Valid outcomeId format: O1
✅ Translating mastery key: outcome_test_simple_o1#AS1.1 → AS1.1
✅ RoutineDriver: Valid outcomeId format: AS1.1
```

### 3. Manual Test

**Before Fix**:
- Student completes lesson with 0.3 mastery
- RoutineV2 shows `{"outcome_test_simple_o1": "2025-11-13..."}` (correct interval)
- SpacedRepetitionService looks up "O1" (finds old entry with 7-day interval)
- UI shows "Due 7d" ❌

**After Fix**:
- Student completes lesson with 0.3 mastery
- RoutineV2 shows `{"O1": "2025-11-13..."}` (correct string ref + interval)
- SpacedRepetitionService looks up "O1" (finds correct 1-day interval)
- UI shows "Due 1d" ✅

## Expected Outcomes

### Before Fix
- RoutineV2 contains mixed key formats: `{"": "...", "O1": "...", "outcome_test_simple_o1": "...", "outcome_test_simple_o1#AS1.1": "..."}`
- SpacedRepetitionService finds wrong intervals due to key mismatch
- Students see incorrect review recommendations

### After Fix
- RoutineV2 contains only valid string refs: `{"O1": "...", "AS1.1": "..."}`
- SpacedRepetitionService reliably finds correct intervals
- Students see accurate review recommendations based on mastery levels
- Future updates prevented from creating invalid keys (fail-fast validation)

## Implementation Priority

**Phase 1 (CRITICAL)**:
- Part 1: Translation layer in LessonCompletionSummaryTool
- Part 2: Validation in RoutineDriver

**Phase 2 (OPTIONAL)**:
- Part 3: Cleanup script for existing data

## Related Specifications

- **Composite Key Mastery Tracking**: `tasks/composite-key-mastery-tracking-spec.md`
- **Mastery V2 Document ID Fix**: `tasks/mastery-v2-document-id-fix-spec.md`

## Anti-Patterns to Avoid

1. ❌ **NO FALLBACK**: Do not silently accept invalid keys and try to "fix" them
2. ✅ **FAIL-FAST**: Reject invalid inputs immediately with descriptive errors
3. ✅ **SINGLE SOURCE OF TRUTH**: Use `enrichedOutcomes` for translation, not guesswork
4. ✅ **VALIDATION AT BOUNDARY**: Check inputs at RoutineDriver entry point

## Notes

- This fix ensures RoutineV2 remains a **legacy consumer** of mastery data using string refs
- MasteryV2 continues using document IDs (correct for new system)
- Translation layer bridges the gap without changing either data model
- Future refactor could migrate RoutineV2 to use document IDs, but that's out of scope
