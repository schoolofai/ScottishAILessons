# Composite Key Mastery Tracking Specification

**Version**: 1.0
**Date**: 2025-11-12
**Status**: Draft
**Author**: System Architecture Team

---

## Executive Summary

### Problem Statement

After implementing document ID-based mastery tracking (fixing the empty key bug), we've successfully resolved data corruption issues but **lost assessment standard (AS) level granularity**.

**Current Behavior (After Document ID Fix):**
```javascript
// MasteryV2 emaByOutcome
{
  "outcome_test_simple_o1": 1.0  // ✅ Outcome level tracked
}
// ❌ LOST: AS1.1, AS1.2 individual scores
```

**Problem**: Assessment standards (AS1.1, AS1.2) don't have Appwrite document IDs because they're embedded within CourseOutcome documents as JSON arrays. We can't track their mastery separately using the document ID approach.

### Proposed Solution: Composite Keys

Track **both** outcome-level AND assessment standard-level mastery using a composite key format:

- **Outcome keys**: `outcome_test_simple_o1` (document ID only)
- **Assessment Standard keys**: `outcome_test_simple_o1#AS1.1` (composite: `documentId#asCode`)

**Expected Behavior (With Composite Keys):**
```javascript
// MasteryV2 emaByOutcome
{
  "outcome_test_simple_o1": 1.0,           // ✅ Outcome level
  "outcome_test_simple_o1#AS1.1": 0.9,     // ✅ AS level (granular)
  "outcome_test_simple_o1#AS1.2": 0.8      // ✅ AS level (granular)
}
```

### Benefits

1. ✅ **Preserves granularity**: Teachers can see which specific assessment standards students struggle with
2. ✅ **Hierarchical structure**: Clear parent-child relationship (outcome → AS)
3. ✅ **Backward compatible**: Doesn't break existing outcome-level tracking
4. ✅ **Fail-fast validation**: Still uses document IDs (no empty key corruption)
5. ✅ **Query flexibility**: Can filter by outcome (split on `#`) or aggregate AS scores

### Impact Summary

- **Backend**: 1 file (`teaching_utils.py`) - add AS mastery creation logic
- **Frontend Consumers**: 4 services analyzed
  - ❌ **Breaking**: SpacedRepetitionService (needs outcomeId → documentId mapping)
  - ⚠️ **Display Fix**: EnhancedStudentDashboard (parse composite keys for UI)
  - ✅ **Compatible**: ProgressService (already uses document IDs)
  - ✅ **Compatible**: PlannerService (key-agnostic passthrough)

---

## Table of Contents

1. [Data Model Design](#1-data-model-design)
2. [Backend Implementation](#2-backend-implementation)
3. [Frontend Consumer Updates](#3-frontend-consumer-updates)
4. [Helper Functions](#4-helper-functions)
5. [Migration Strategy](#5-migration-strategy)
6. [Testing Plan](#6-testing-plan)
7. [Example Data Flow](#7-example-data-flow)
8. [Performance Considerations](#8-performance-considerations)
9. [Alternative Approaches Rejected](#9-alternative-approaches-rejected)
10. [Success Criteria](#10-success-criteria)

---

## 1. Data Model Design

### 1.1 Key Format Specification

**Outcome-Level Keys** (No change from current implementation):
```
Format: {documentId}
Example: "outcome_test_simple_o1"
Length: 20+ characters (Appwrite document ID)
Validation: No '#' character
```

**Assessment Standard Keys** (NEW):
```
Format: {documentId}#{asCode}
Example: "outcome_test_simple_o1#AS1.1"
Parts:
  - documentId: Appwrite document ID (20+ chars)
  - separator: '#' (chosen because not valid in Appwrite IDs or AS codes)
  - asCode: Assessment standard code (e.g., "AS1.1", "AS2.3")
Validation: Must contain exactly one '#' character
```

### 1.2 Example MasteryV2 Record

```json
{
  "$id": "6914772e00159d6d0bd7",
  "studentId": "68d28c190016b1458092",
  "courseId": "test_course_simple_math",
  "emaByOutcome": "{
    \"outcome_test_simple_o1\": 0.95,
    \"outcome_test_simple_o1#AS1.1\": 1.0,
    \"outcome_test_simple_o1#AS1.2\": 0.9,
    \"outcome_test_simple_o2\": 0.7,
    \"outcome_test_simple_o2#AS2.1\": 0.6,
    \"outcome_test_simple_o2#AS2.2\": 0.8
  }",
  "updatedAt": "2025-11-12T14:34:12.603+00:00"
}
```

### 1.3 CourseOutcome Data Structure Reference

**Appwrite Collection**: `course_outcomes`

```typescript
interface CourseOutcome {
  $id: string;                    // "outcome_test_simple_o1"
  courseId: string;               // "test_course_simple_math"
  outcomeId: string;              // "O1" (for display)
  outcomeTitle: string;           // "Perform addition..."
  assessmentStandards: string;    // JSON: "[{code: 'AS1.1', desc: '...'}, ...]"
  // ... other fields
}
```

**Key Point**: Assessment standards are **embedded** within the CourseOutcome document (JSON string), not separate documents. This is why we need composite keys.

### 1.4 Lesson Template and Data Pipeline Structure

**📖 IMPORTANT CLARIFICATION**: The frontend has **already done the work** of associating assessment standards with their parent outcomes. The backend does NOT need to search or filter - it just needs to parse the enriched data structure.

**Database (lesson_templates collection)**:
```json
{
  "$id": "lesson_simple_addition",
  "title": "Simple Addition",
  "courseId": "test_course_simple_math",
  "outcomeRefs": "[\"O1\", \"AS1.1\"]"  // ← MIXED ARRAY (JSON string)
}
```

**Frontend Snapshot (lesson_snapshot)**:
```typescript
{
  outcomeRefs: ["O1", "AS1.1"],  // ← MIXED ARRAY (still contains both)
  // ... other fields
}
```

**Frontend Enrichment (enriched_outcomes)**:
```typescript
[
  {
    $id: "outcome_test_simple_o1",              // ← Document ID
    outcomeId: "O1",                             // ← Display string
    outcomeTitle: "Perform addition...",
    assessmentStandards: "[{\"code\": \"AS1.1\", \"description\": \"Add single digit numbers correctly\"}]"  // ← AS EMBEDDED HERE
  }
]
```

**Key Points**:
- ✅ Lesson snapshot `outcomeRefs` is a **mixed array**: `["O1", "AS1.1"]`
- ✅ Frontend filters `outcomeRefs` to extract only outcome IDs (no decimals): `["O1"]`
- ✅ Frontend fetches `CourseOutcome` objects for those IDs
- ✅ `CourseOutcome.assessmentStandards` field contains **embedded AS data** as JSON string
- ✅ Backend just needs to **iterate enriched_outcomes and parse their assessmentStandards field**
- ❌ Backend does NOT need to extract AS from `lesson_snapshot.outcomeRefs` by filtering decimals

---

### 🎯 **ARCHITECTURAL INSIGHT: Why This Design is Simple**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ KEY SIMPLIFICATION: Frontend Has Already Done The Work!     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ❌ COMPLEX APPROACH (Initial spec):                            │
│   1. Extract AS codes from lesson_snapshot.outcomeRefs         │
│      by filtering for decimal points: ["AS1.1"]                │
│   2. For each AS, search all enriched_outcomes to find parent  │
│   3. Helper function: _find_parent_outcome(as_code, outcomes)  │
│   4. ~80 lines of code with nested loops                       │
│                                                                 │
│ ✅ SIMPLE APPROACH (Final spec):                               │
│   1. Iterate enriched_outcomes (frontend already fetched)      │
│   2. For each outcome, parse its assessmentStandards field     │
│   3. Create composite keys directly: f"{outcome.$id}#{as.code}"│
│   4. ~40 lines of code, single pass                            │
│                                                                 │
│ 🔑 WHY IT WORKS:                                               │
│   Frontend's CourseOutcomesDriver.getOutcomesByIds() returns   │
│   FULL CourseOutcome objects with assessmentStandards already  │
│   embedded. The association is built-in to the data model!     │
│                                                                 │
│ 💡 LESSON LEARNED:                                             │
│   Don't re-derive data relationships that are already           │
│   embedded in your data structures. Leverage what the frontend │
│   has already prepared!                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.5 Key Parsing Logic

```typescript
/**
 * Parse a mastery key (outcome or composite)
 *
 * @param key - Mastery key from emaByOutcome
 * @returns Parsed components
 */
interface ParsedMasteryKey {
  documentId: string;        // Always present
  asCode?: string;           // Only present for composite keys
  isComposite: boolean;      // True if assessment standard
}

function parseMasteryKey(key: string): ParsedMasteryKey {
  if (key.includes('#')) {
    const [documentId, asCode] = key.split('#');
    return { documentId, asCode, isComposite: true };
  }
  return { documentId: key, isComposite: false };
}

// Examples:
parseMasteryKey("outcome_test_simple_o1")
// → { documentId: "outcome_test_simple_o1", isComposite: false }

parseMasteryKey("outcome_test_simple_o1#AS1.1")
// → { documentId: "outcome_test_simple_o1", asCode: "AS1.1", isComposite: true }
```

---

## 2. Backend Implementation

### 2.1 File Changes Required

**Primary File**: `langgraph-agent/src/agent/teaching_utils.py`

**Functions to Modify**:
1. ✅ `_create_mastery_update()` - No changes (already validates document IDs)
2. ✅ `_update_mastery_scores()` - Add AS composite key creation logic

**No Helper Functions Needed**: The frontend has already associated AS with outcomes in the `enriched_outcomes` structure. We simply iterate and parse.

### 2.2 Implementation: Updated _update_mastery_scores()

**Location**: `langgraph-agent/src/agent/teaching_utils.py` (replace lines 142-198)

**🔑 KEY INSIGHT**: Frontend has already parsed `assessmentStandards` and embedded them in each `enriched_outcomes` entry. We just iterate outcomes and parse their embedded AS field - no searching needed!

```python
def _update_mastery_scores(lesson_snapshot: dict, state: dict, existing_updates: list) -> list:
    """Calculate and append new mastery updates based on student performance.

    CRITICAL REQUIREMENT: enriched_outcomes MUST be provided by frontend.
    This function will FAIL FAST if enriched_outcomes is missing or invalid.
    NO FALLBACK to string refs - this prevents silent data corruption.

    Creates mastery updates for BOTH:
    1. Outcome-level mastery (document ID keys)
    2. Assessment standard-level mastery (composite keys: documentId#asCode)

    Frontend has already associated AS with outcomes in enriched_outcomes[].assessmentStandards.
    We simply iterate and parse - no searching or filtering needed.

    Args:
        lesson_snapshot: Lesson snapshot dict (for error context)
        state: Graph state containing enriched_outcomes (REQUIRED)
        existing_updates: List of existing mastery updates to append to

    Returns:
        Updated list of mastery updates with document IDs and composite keys

    Raises:
        ValueError: If enriched_outcomes missing, empty, or contains invalid outcomes
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
    print(f"🚨 MASTERY DEBUG - Enriched outcomes count: {len(enriched_outcomes)}")
    print(f"🚨 MASTERY DEBUG - Enriched outcomes sample: {enriched_outcomes[:2] if len(enriched_outcomes) > 0 else []}")
    print(f"🚨 MASTERY DEBUG - State: is_correct={is_correct}, attempts={attempts}, score={score}")

    # ═══════════════════════════════════════════════════════════════
    # Iterate enriched_outcomes once - create BOTH outcome AND AS mastery
    # ═══════════════════════════════════════════════════════════════
    for outcome in enriched_outcomes:
        # 1. Create outcome-level mastery update (existing logic)
        mastery_update = _create_mastery_update(outcome, score)
        mastery_updates.append(mastery_update)
        logger.info(f"✅ Created outcome mastery: outcome_id={mastery_update['outcome_id']}, score={score}")
        print(f"🚨 MASTERY DEBUG - Created outcome update: {mastery_update}")

        # 2. Parse embedded assessmentStandards and create AS-level mastery (NEW)
        as_list_json = outcome.get("assessmentStandards", "[]")

        try:
            # Parse JSON string to list
            as_list = json.loads(as_list_json) if isinstance(as_list_json, str) else as_list_json

            if isinstance(as_list, list) and len(as_list) > 0:
                logger.info(f"Found {len(as_list)} assessment standards in outcome {outcome.get('outcomeId', 'unknown')}")

                for as_obj in as_list:
                    if isinstance(as_obj, dict):
                        as_code = as_obj.get("code")  # e.g., "AS1.1"

                        if as_code:
                            # Create composite key: documentId#asCode
                            composite_key = f"{outcome['$id']}#{as_code}"

                            # Create mastery update for this AS
                            as_mastery_update = {
                                "outcome_id": composite_key,
                                "score": score,
                                "timestamp": datetime.now().isoformat()
                            }

                            mastery_updates.append(as_mastery_update)
                            logger.info(f"✅ Created AS mastery: outcome_id={composite_key}, score={score}")
                            print(f"🚨 MASTERY DEBUG - Created AS update: {as_mastery_update}")

        except (json.JSONDecodeError, TypeError) as e:
            # Non-fatal: Log warning and continue (outcome mastery still created)
            logger.warning(f"Failed to parse assessmentStandards for outcome {outcome.get('$id', 'unknown')}: {e}")
            print(f"🚨 MASTERY DEBUG - AS parsing failed for outcome, skipping AS tracking")
            continue

    logger.info(f"Successfully created {len(mastery_updates)} total mastery updates (outcomes + AS)")
    print(f"🚨 MASTERY DEBUG - Total mastery updates: {len(mastery_updates)}")
    return mastery_updates
```

### 2.3 Error Handling

**Scenario 1: Empty assessmentStandards field**
```python
# CourseOutcome has no assessment standards
outcome.assessmentStandards = "[]"  # or missing field

# Behavior: Skip AS mastery creation for this outcome
# Only outcome-level mastery created

# This is VALID - not all outcomes have assessment standards
```

**Scenario 2: Malformed assessmentStandards JSON**
```python
# CourseOutcome has invalid JSON in assessmentStandards field
outcome.assessmentStandards = "{invalid json"

# Behavior: Try-catch logs warning, continues to next outcome
logger.warning(f"Failed to parse assessmentStandards for outcome {outcome_id}: {error}")

# Result: Outcome mastery created, AS mastery skipped for that outcome
# Other outcomes still processed normally
# No exception thrown - graceful degradation
```

**Scenario 3: Missing 'code' field in AS object**
```python
# AssessmentStandards has malformed object
outcome.assessmentStandards = '[{"description": "test"}]'  # Missing "code"

# Behavior: if as_code check fails, that AS object silently skipped
# Other AS in the same outcome still processed

# Result: Partial AS mastery tracking (only valid AS objects)
```

---

## 3. Frontend Consumer Updates

### 3.1 Consumer Impact Matrix

| Consumer | File | Impact | Changes Needed |
|----------|------|--------|----------------|
| **ProgressService** | `lib/services/progress-service.ts` | ✅ None | Already uses document IDs |
| **PlannerService** | `lib/appwrite/planner-service.ts` | ✅ None | Key-agnostic passthrough |
| **SpacedRepetitionService** | `lib/services/spaced-repetition-service.ts` | ❌ Breaking | Add outcomeId → documentId mapping |
| **EnhancedStudentDashboard** | `components/dashboard/EnhancedStudentDashboard.tsx` | ⚠️ Display | Parse composite keys for UI |

### 3.2 Consumer 1: ProgressService ✅ NO CHANGES NEEDED

**File**: `assistant-ui-frontend/lib/services/progress-service.ts`

**Current Code (lines 360-371)**:
```typescript
const outcomesWithMastery = outcomesResult.documents.map((outcome: any) => {
  const foundInMastery = outcome.$id in emaByOutcome;  // ✅ Uses document ID
  const masteryScore = emaByOutcome[outcome.$id] || 0;

  return {
    outcomeRef: outcome.outcomeRef,     // "O1" for display
    outcomeTitle: outcome.description,
    mastery: masteryScore
  };
});
```

**Why Compatible**:
- Already looks up by `outcome.$id` (document ID)
- Will find: `{"outcome_test_simple_o1": 1.0}`
- Ignores composite keys automatically (doesn't iterate over all keys)
- ✅ **No changes required**

### 3.3 Consumer 2: PlannerService ✅ NO CHANGES NEEDED

**File**: `assistant-ui-frontend/lib/appwrite/planner-service.ts`

**Current Code (lines 371-398)**:
```typescript
if (masteryData) {
  mastery = {
    emaByOutcome: masteryData.emaByOutcome  // ✅ Passthrough
  };

  // Only validates EMA values (0-1 range)
  for (const [outcomeId, emaValue] of Object.entries(emaByOutcomeObj)) {
    if (typeof emaValue !== 'number' || emaValue < 0 || emaValue > 1) {
      throw new Error(`Invalid EMA value for outcome ${outcomeId}: ${emaValue}`);
    }
  }
}
```

**Why Compatible**:
- Just passes `emaByOutcome` object to backend planner
- Validation only checks value types/ranges, not key format
- Backend planner receives ALL keys (outcomes + AS composite keys)
- ✅ **No changes required**

**Potential Enhancement** (Optional):
```typescript
// Could add key format validation to catch malformed keys
for (const [key, emaValue] of Object.entries(emaByOutcomeObj)) {
  // Validate key format
  if (!key.match(/^[a-zA-Z0-9_]{20,}(#[A-Z]+\d+\.\d+)?$/)) {
    logger.warning(`Unexpected mastery key format: ${key}`);
  }

  // Validate value
  if (typeof emaValue !== 'number' || emaValue < 0 || emaValue > 1) {
    throw new Error(`Invalid EMA value for ${key}: ${emaValue}`);
  }
}
```

### 3.4 Consumer 3: SpacedRepetitionService ❌ BREAKING - NEEDS FIX

**File**: `assistant-ui-frontend/lib/services/spaced-repetition-service.ts`

**Current Code (lines 91-116) - BROKEN**:
```typescript
const masteryData = await masteryDriver.getMasteryV2(studentId, courseId);
const emaByOutcome = masteryData?.emaByOutcome || {};

const enrichedOutcomes = overdueOutcomes.map(outcome => {
  const foundInMastery = outcome.outcomeId in emaByOutcome;  // ❌ Looks up by "O1"
  const currentEMA = emaByOutcome[outcome.outcomeId] || 0.3; // ❌ Won't find document ID

  return {
    outcomeId: outcome.outcomeId,  // "O1"
    currentEMA,
    masteryLevel: getMasteryLevel(currentEMA)
  };
});
```

**Why Broken**:
- `outcome.outcomeId` is `"O1"` (display string)
- `emaByOutcome` keys are `"outcome_test_simple_o1"` (document IDs)
- Lookup fails → falls back to default `0.3` → incorrect mastery data

**Fix Required - Build Reverse Map**:

```typescript
/**
 * Get review recommendations based on spaced repetition schedule
 */
export async function getReviewRecommendations(
  studentId: string,
  courseId: string,
  databases: Databases,
  limit: number = 5
): Promise<ReviewRecommendation[]> {
  try {
    const routineDriver = new RoutineDriver(databases);
    const masteryDriver = new MasteryV2Driver(databases);
    const courseOutcomesDriver = new CourseOutcomesDriver(databases);

    // 1. Get overdue outcomes
    const overdueOutcomes = await routineDriver.getOverdueOutcomes(studentId, courseId);

    if (overdueOutcomes.length === 0) {
      console.log('[SpacedRepetition] No overdue outcomes');
      return [];
    }

    console.log(`[SpacedRepetition] Found ${overdueOutcomes.length} overdue outcomes`);

    // 2. Get mastery data for context
    const masteryData = await masteryDriver.getMasteryV2(studentId, courseId);
    const emaByOutcome = masteryData?.emaByOutcome || {};

    // ═══════════════════════════════════════════════════════════════
    // 🆕 BUILD REVERSE MAP: outcomeId → documentId
    // ═══════════════════════════════════════════════════════════════
    const outcomeIdToDocIdMap = new Map<string, string>();

    // Fetch all course outcomes to build mapping
    const courseOutcomes = await courseOutcomesDriver.getOutcomesByCourse(courseId);

    for (const outcome of courseOutcomes) {
      outcomeIdToDocIdMap.set(outcome.outcomeId, outcome.$id);
    }

    console.log(`🔍 [SpacedRepetition] Built outcomeId → docId map:`, {
      mapSize: outcomeIdToDocIdMap.size,
      sampleMappings: Array.from(outcomeIdToDocIdMap.entries()).slice(0, 3)
    });
    // ═══════════════════════════════════════════════════════════════

    // 3. Enrich overdue outcomes with mastery and timing info
    const enrichedOutcomes = overdueOutcomes.map(outcome => {
      // 🆕 MAP outcomeId → documentId for lookup
      const documentId = outcomeIdToDocIdMap.get(outcome.outcomeId);

      if (!documentId) {
        console.warn(`⚠️ [SpacedRepetition] No documentId found for outcomeId: ${outcome.outcomeId}`);
      }

      const foundInMastery = documentId && documentId in emaByOutcome;
      const currentEMA = foundInMastery ? emaByOutcome[documentId] : 0.3;
      const daysOverdue = calculateDaysOverdue(outcome.dueAt);

      console.log(`🔍 [SpacedRepetition EMA Lookup] outcomeId="${outcome.outcomeId}", documentId="${documentId}", found=${foundInMastery}, ema=${currentEMA}, usingDefault=${!foundInMastery}`);

      return {
        outcomeId: outcome.outcomeId,
        dueAt: outcome.dueAt,
        daysOverdue,
        currentEMA,
        masteryLevel: getMasteryLevel(currentEMA)
      };
    });

    console.log('[SpacedRepetition] Enriched outcomes:', enrichedOutcomes.length);

    // 4. Find lessons that teach these outcomes
    const lessonRecommendations = await findLessonsForOutcomes(
      enrichedOutcomes,
      courseId,
      studentId,
      databases
    );

    console.log(`[SpacedRepetition] Found ${lessonRecommendations.length} candidate lessons`);

    // 5. Calculate priorities and sort
    const rankedRecommendations = lessonRecommendations
      .map(rec => calculatePriority(rec))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    console.log('[SpacedRepetition] Returning top recommendations:', rankedRecommendations.length);

    return rankedRecommendations;

  } catch (error) {
    console.error('[SpacedRepetition] Failed to get recommendations:', error);
    throw new Error(`Failed to get review recommendations: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

**New Dependency Required**:
```typescript
import { CourseOutcomesDriver } from '@/lib/appwrite/driver/CourseOutcomesDriver';
```

**Same fix needed in `getReviewStats()` function (lines 149-178)**:
```typescript
export async function getReviewStats(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<ReviewStats> {
  try {
    const routineDriver = new RoutineDriver(databases);
    const masteryDriver = new MasteryV2Driver(databases);
    const courseOutcomesDriver = new CourseOutcomesDriver(databases);

    const overdueOutcomes = await routineDriver.getOverdueOutcomes(studentId, courseId);
    const masteryData = await masteryDriver.getMasteryV2(studentId, courseId);
    const emaByOutcome = masteryData?.emaByOutcome || {};

    // 🆕 BUILD REVERSE MAP
    const outcomeIdToDocIdMap = new Map<string, string>();
    const courseOutcomes = await courseOutcomesDriver.getOutcomesByCourse(courseId);
    for (const outcome of courseOutcomes) {
      outcomeIdToDocIdMap.set(outcome.outcomeId, outcome.$id);
    }

    // Count critical outcomes (EMA < 0.4)
    const criticalCount = overdueOutcomes.filter(outcome => {
      const documentId = outcomeIdToDocIdMap.get(outcome.outcomeId);
      const ema = documentId ? (emaByOutcome[documentId] || 0.3) : 0.3;
      return ema < 0.4;
    }).length;

    // ... rest of function
  }
}
```

### 3.5 Consumer 4: EnhancedStudentDashboard ⚠️ NEEDS DISPLAY FIX

**File**: `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx`

**Current Code (lines 405-414) - DISPLAY ISSUE**:
```typescript
if (masteryV2Record) {
  const emaByOutcome = masteryV2Record.emaByOutcome || {};

  // Convert ALL keys to legacy format for display
  masteryData = Object.entries(emaByOutcome).map(([outcomeId, ema]) => ({
    outcomeRef: outcomeId,        // ⚠️ Shows "outcome_test_simple_o1#AS1.1"
    masteryLevel: ema
  }));
}
```

**Problem**:
- Raw composite keys shown to users: `"outcome_test_simple_o1#AS1.1"`
- Should show: `"AS1.1"` or `"O1 → AS1.1"` (human-readable)

**Fix - Parse Composite Keys for Display**:

```typescript
if (masteryV2Record) {
  const emaByOutcome = masteryV2Record.emaByOutcome || {};

  // 🆕 HELPER: Parse composite key for display
  const parseMasteryKey = (key: string): { displayRef: string, isAS: boolean, parentId?: string } => {
    if (key.includes('#')) {
      // Composite key: "documentId#AS1.1"
      const [documentId, asCode] = key.split('#');
      return {
        displayRef: asCode,      // Show "AS1.1"
        isAS: true,
        parentId: documentId
      };
    } else {
      // Outcome key: "documentId"
      // Try to map back to outcomeId for display
      // (This requires fetching CourseOutcome, which may be expensive)
      // For now, just show the document ID
      return {
        displayRef: key,         // Show document ID (or fetch outcomeId separately)
        isAS: false
      };
    }
  };

  // Convert with composite key parsing
  masteryData = Object.entries(emaByOutcome).map(([key, ema]) => {
    const parsed = parseMasteryKey(key);

    return {
      outcomeRef: parsed.displayRef,
      masteryLevel: ema,
      isAssessmentStandard: parsed.isAS,  // 🆕 Flag for UI filtering
      parentOutcomeId: parsed.parentId    // 🆕 For hierarchical display
    };
  });

  console.log(`📊 [Dashboard] Parsed ${masteryData.length} mastery entries (outcomes + AS)`);
}
```

**UI Enhancement - Separate Outcome vs AS Display** (Optional):

```typescript
// Separate into outcome-level and AS-level mastery
const outcomeMastery = masteryData.filter(m => !m.isAssessmentStandard);
const asMastery = masteryData.filter(m => m.isAssessmentStandard);

// Display in UI with hierarchy
<div>
  <h3>Outcome-Level Mastery</h3>
  {outcomeMastery.map(m => (
    <div key={m.outcomeRef}>
      {m.outcomeRef}: {m.masteryLevel.toFixed(2)}
    </div>
  ))}

  <h3>Assessment Standard Mastery</h3>
  {asMastery.map(m => (
    <div key={m.outcomeRef} style={{ paddingLeft: '20px' }}>
      {m.outcomeRef}: {m.masteryLevel.toFixed(2)}
      <small> (Part of {m.parentOutcomeId})</small>
    </div>
  ))}
</div>
```

---

## 4. Helper Functions

### 4.1 TypeScript Helper Functions

**File**: `assistant-ui-frontend/lib/utils/mastery-helpers.ts` (NEW FILE)

```typescript
/**
 * Mastery key parsing utilities for composite key support
 *
 * Composite key format: {documentId}#{asCode}
 * Example: "outcome_test_simple_o1#AS1.1"
 */

export interface ParsedMasteryKey {
  documentId: string;        // Always present (Appwrite document ID)
  asCode?: string;           // Only present for composite keys
  isComposite: boolean;      // True if assessment standard
}

/**
 * Parse a mastery key (outcome or composite)
 *
 * @param key - Mastery key from emaByOutcome
 * @returns Parsed components
 *
 * @example
 * parseMasteryKey("outcome_test_simple_o1")
 * // → { documentId: "outcome_test_simple_o1", isComposite: false }
 *
 * parseMasteryKey("outcome_test_simple_o1#AS1.1")
 * // → { documentId: "outcome_test_simple_o1", asCode: "AS1.1", isComposite: true }
 */
export function parseMasteryKey(key: string): ParsedMasteryKey {
  if (!key || typeof key !== 'string') {
    throw new Error(`Invalid mastery key: ${key}`);
  }

  if (key.includes('#')) {
    const parts = key.split('#');

    if (parts.length !== 2) {
      throw new Error(`Malformed composite key (expected 1 '#'): ${key}`);
    }

    const [documentId, asCode] = parts;

    if (!documentId || documentId.length < 20) {
      throw new Error(`Invalid documentId in composite key: ${key}`);
    }

    if (!asCode || !asCode.match(/^[A-Z]+\d+\.\d+$/)) {
      throw new Error(`Invalid AS code in composite key: ${key}`);
    }

    return { documentId, asCode, isComposite: true };
  }

  // Outcome-level key
  if (key.length < 20) {
    throw new Error(`Invalid document ID (too short): ${key}`);
  }

  return { documentId: key, isComposite: false };
}

/**
 * Check if a mastery key is an assessment standard (composite key)
 *
 * @param key - Mastery key to check
 * @returns True if composite key (assessment standard)
 */
export function isAssessmentStandardKey(key: string): boolean {
  return key.includes('#');
}

/**
 * Extract document ID from a mastery key (works for both outcome and composite)
 *
 * @param key - Mastery key
 * @returns Document ID
 */
export function getDocumentIdFromKey(key: string): string {
  const parsed = parseMasteryKey(key);
  return parsed.documentId;
}

/**
 * Build reverse mapping: outcomeId → documentId
 *
 * @param courseOutcomes - Array of CourseOutcome objects
 * @returns Map for fast lookup
 *
 * @example
 * const outcomes = [
 *   { $id: "outcome_test_simple_o1", outcomeId: "O1" },
 *   { $id: "outcome_test_simple_o2", outcomeId: "O2" }
 * ];
 * const map = buildOutcomeIdToDocIdMap(outcomes);
 * // map.get("O1") → "outcome_test_simple_o1"
 */
export function buildOutcomeIdToDocIdMap(
  courseOutcomes: Array<{ $id: string; outcomeId: string }>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const outcome of courseOutcomes) {
    if (!outcome.$id || !outcome.outcomeId) {
      console.warn('Skipping outcome with missing $id or outcomeId:', outcome);
      continue;
    }

    map.set(outcome.outcomeId, outcome.$id);
  }

  return map;
}

/**
 * Filter emaByOutcome to only outcome-level keys (exclude AS composite keys)
 *
 * @param emaByOutcome - Full mastery data object
 * @returns Object with only outcome-level keys
 */
export function filterOutcomeLevelMastery(
  emaByOutcome: Record<string, number>
): Record<string, number> {
  const filtered: Record<string, number> = {};

  for (const [key, value] of Object.entries(emaByOutcome)) {
    if (!isAssessmentStandardKey(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Filter emaByOutcome to only assessment standard keys (composite keys)
 *
 * @param emaByOutcome - Full mastery data object
 * @returns Object with only AS composite keys
 */
export function filterAssessmentStandardMastery(
  emaByOutcome: Record<string, number>
): Record<string, number> {
  const filtered: Record<string, number> = {};

  for (const [key, value] of Object.entries(emaByOutcome)) {
    if (isAssessmentStandardKey(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Group assessment standards by parent outcome
 *
 * @param emaByOutcome - Full mastery data object
 * @returns Map: documentId → Array of AS mastery entries
 *
 * @example
 * const emaByOutcome = {
 *   "outcome_test_simple_o1": 1.0,
 *   "outcome_test_simple_o1#AS1.1": 0.9,
 *   "outcome_test_simple_o1#AS1.2": 0.8
 * };
 * const grouped = groupAssessmentStandardsByOutcome(emaByOutcome);
 * // grouped.get("outcome_test_simple_o1") →
 * //   [{asCode: "AS1.1", ema: 0.9}, {asCode: "AS1.2", ema: 0.8}]
 */
export function groupAssessmentStandardsByOutcome(
  emaByOutcome: Record<string, number>
): Map<string, Array<{ asCode: string; ema: number }>> {
  const grouped = new Map<string, Array<{ asCode: string; ema: number }>>();

  for (const [key, ema] of Object.entries(emaByOutcome)) {
    if (isAssessmentStandardKey(key)) {
      const parsed = parseMasteryKey(key);

      if (!grouped.has(parsed.documentId)) {
        grouped.set(parsed.documentId, []);
      }

      grouped.get(parsed.documentId)!.push({
        asCode: parsed.asCode!,
        ema
      });
    }
  }

  return grouped;
}
```

### 4.2 Unit Tests for Helper Functions

**File**: `assistant-ui-frontend/lib/utils/__tests__/mastery-helpers.test.ts` (NEW FILE)

```typescript
import {
  parseMasteryKey,
  isAssessmentStandardKey,
  getDocumentIdFromKey,
  buildOutcomeIdToDocIdMap,
  filterOutcomeLevelMastery,
  filterAssessmentStandardMastery,
  groupAssessmentStandardsByOutcome
} from '../mastery-helpers';

describe('mastery-helpers', () => {
  describe('parseMasteryKey', () => {
    it('should parse outcome-level key', () => {
      const result = parseMasteryKey('outcome_test_simple_o1');
      expect(result).toEqual({
        documentId: 'outcome_test_simple_o1',
        isComposite: false
      });
    });

    it('should parse composite key', () => {
      const result = parseMasteryKey('outcome_test_simple_o1#AS1.1');
      expect(result).toEqual({
        documentId: 'outcome_test_simple_o1',
        asCode: 'AS1.1',
        isComposite: true
      });
    });

    it('should throw on invalid composite key (multiple #)', () => {
      expect(() => parseMasteryKey('doc#AS1.1#extra')).toThrow('Malformed composite key');
    });

    it('should throw on invalid AS code format', () => {
      expect(() => parseMasteryKey('outcome_test_simple_o1#invalid')).toThrow('Invalid AS code');
    });

    it('should throw on too-short document ID', () => {
      expect(() => parseMasteryKey('short')).toThrow('Invalid document ID');
    });
  });

  describe('isAssessmentStandardKey', () => {
    it('should return true for composite keys', () => {
      expect(isAssessmentStandardKey('outcome_test_simple_o1#AS1.1')).toBe(true);
    });

    it('should return false for outcome keys', () => {
      expect(isAssessmentStandardKey('outcome_test_simple_o1')).toBe(false);
    });
  });

  describe('getDocumentIdFromKey', () => {
    it('should extract document ID from outcome key', () => {
      expect(getDocumentIdFromKey('outcome_test_simple_o1')).toBe('outcome_test_simple_o1');
    });

    it('should extract document ID from composite key', () => {
      expect(getDocumentIdFromKey('outcome_test_simple_o1#AS1.1')).toBe('outcome_test_simple_o1');
    });
  });

  describe('buildOutcomeIdToDocIdMap', () => {
    it('should build correct mapping', () => {
      const outcomes = [
        { $id: 'outcome_test_simple_o1', outcomeId: 'O1' },
        { $id: 'outcome_test_simple_o2', outcomeId: 'O2' }
      ];

      const map = buildOutcomeIdToDocIdMap(outcomes);

      expect(map.get('O1')).toBe('outcome_test_simple_o1');
      expect(map.get('O2')).toBe('outcome_test_simple_o2');
      expect(map.size).toBe(2);
    });

    it('should skip outcomes with missing fields', () => {
      const outcomes = [
        { $id: 'outcome_test_simple_o1', outcomeId: 'O1' },
        { $id: '', outcomeId: 'O2' },  // Missing $id
        { $id: 'outcome_test_simple_o3', outcomeId: '' }  // Missing outcomeId
      ];

      const map = buildOutcomeIdToDocIdMap(outcomes);

      expect(map.size).toBe(1);
      expect(map.get('O1')).toBe('outcome_test_simple_o1');
    });
  });

  describe('filterOutcomeLevelMastery', () => {
    it('should filter to only outcome keys', () => {
      const emaByOutcome = {
        'outcome_test_simple_o1': 1.0,
        'outcome_test_simple_o1#AS1.1': 0.9,
        'outcome_test_simple_o2': 0.7
      };

      const filtered = filterOutcomeLevelMastery(emaByOutcome);

      expect(filtered).toEqual({
        'outcome_test_simple_o1': 1.0,
        'outcome_test_simple_o2': 0.7
      });
    });
  });

  describe('filterAssessmentStandardMastery', () => {
    it('should filter to only AS composite keys', () => {
      const emaByOutcome = {
        'outcome_test_simple_o1': 1.0,
        'outcome_test_simple_o1#AS1.1': 0.9,
        'outcome_test_simple_o1#AS1.2': 0.8
      };

      const filtered = filterAssessmentStandardMastery(emaByOutcome);

      expect(filtered).toEqual({
        'outcome_test_simple_o1#AS1.1': 0.9,
        'outcome_test_simple_o1#AS1.2': 0.8
      });
    });
  });

  describe('groupAssessmentStandardsByOutcome', () => {
    it('should group AS by parent outcome', () => {
      const emaByOutcome = {
        'outcome_test_simple_o1': 1.0,
        'outcome_test_simple_o1#AS1.1': 0.9,
        'outcome_test_simple_o1#AS1.2': 0.8,
        'outcome_test_simple_o2': 0.7,
        'outcome_test_simple_o2#AS2.1': 0.6
      };

      const grouped = groupAssessmentStandardsByOutcome(emaByOutcome);

      expect(grouped.get('outcome_test_simple_o1')).toEqual([
        { asCode: 'AS1.1', ema: 0.9 },
        { asCode: 'AS1.2', ema: 0.8 }
      ]);

      expect(grouped.get('outcome_test_simple_o2')).toEqual([
        { asCode: 'AS2.1', ema: 0.6 }
      ]);

      expect(grouped.size).toBe(2);
    });
  });
});
```

---

## 5. Migration Strategy

### 5.1 Backward Compatibility

**Key Point**: Composite keys are **additive**, not a breaking change to the data model.

**Existing Data**:
```json
{
  "emaByOutcome": "{\"outcome_test_simple_o1\": 1.0}"
}
```

**After Update**:
```json
{
  "emaByOutcome": "{\"outcome_test_simple_o1\": 1.0, \"outcome_test_simple_o1#AS1.1\": 0.9}"
}
```

**Compatibility**:
- ✅ Old outcome-level keys remain valid
- ✅ New AS-level keys added alongside
- ✅ No data loss or corruption
- ✅ Gradual rollout possible (some lessons add AS keys, others don't)

### 5.2 Rollout Plan

**Phase 1: Backend Deployment**
1. Deploy updated `teaching_utils.py` to LangGraph platform
2. New lessons will start creating composite keys
3. Old lessons remain with outcome-level keys only
4. No migration script needed

**Phase 2: Frontend Consumer Updates**
1. Deploy SpacedRepetitionService fix (critical - currently broken)
2. Deploy EnhancedStudentDashboard display fix (UI improvement)
3. ProgressService and PlannerService continue working without changes

**Phase 3: Monitoring**
1. Check backend logs for AS mastery creation
2. Verify MasteryV2 records contain composite keys
3. Test spaced repetition recommendations with AS-level data
4. Validate UI displays parsed AS codes correctly

### 5.3 No Database Migration Required

**Why No Migration Needed**:
- MasteryV2 collection schema unchanged (still `emaByOutcome: string`)
- Composite keys are just new key formats in the JSON string
- Existing data remains valid (outcome-level keys)
- New data appended (AS-level keys added)

**Validation Query**:
```typescript
// Check if a student has composite keys in their mastery data
const masteryRecord = await masteryDriver.getMasteryV2(studentId, courseId);
const emaByOutcome = masteryRecord?.emaByOutcome || {};

const hasCompositeKeys = Object.keys(emaByOutcome).some(key => key.includes('#'));

console.log('Student has AS-level mastery tracking:', hasCompositeKeys);
```

### 5.4 Handling Edge Cases

**Case 1: Lesson with Only Outcomes (No AS)**
```typescript
// Lesson snapshot
{
  outcomeRefs: ["O1"],
  assessmentStandardRefs: []  // Empty
}

// Backend behavior: Only outcome-level mastery created
{
  "outcome_test_simple_o1": 1.0
}
// ✅ Works correctly - some lessons don't have AS
```

**Case 2: Lesson with AS Not in Enriched Outcomes**
```typescript
// Lesson has AS1.1 but enriched_outcomes don't contain it
assessmentStandardRefs: ["AS1.1"]
enriched_outcomes: [
  {$id: "outcome_test_simple_o1", assessmentStandards: "[{code: 'AS1.2'}]"}
]

// Backend behavior: Log warning, skip AS1.1
logger.warning("Assessment standard AS1.1 not found in any enriched outcome - skipping")

// Result: Only outcome mastery created, AS1.1 skipped
// ✅ Graceful degradation - no crash
```

**Case 3: Malformed AS JSON in CourseOutcome**
```python
# CourseOutcome has invalid assessmentStandards field
outcome.assessmentStandards = "{invalid json"

# _find_parent_outcome behavior:
try:
    as_list = json.loads(as_list_raw)
except json.JSONDecodeError as e:
    logger.warning(f"Failed to parse assessmentStandards: {e}")
    continue  # Try next outcome

# ✅ Logs warning, continues checking other outcomes
```

---

## 6. Testing Plan

### 6.1 Unit Tests (Backend)

**File**: `langgraph-agent/tests/test_teaching_utils.py` (NEW)

```python
import pytest
from src.agent.teaching_utils import (
    _update_mastery_scores,
    _create_mastery_update
)

def test_update_mastery_scores_with_embedded_as():
    """Test mastery update creation with embedded assessment standards (SIMPLIFIED)"""
    lesson_snapshot = {
        "title": "Test Lesson",
        "courseId": "test_course",
        "outcomeRefs": ["O1", "AS1.1"]  # Mixed array
    }

    state = {
        "enriched_outcomes": [
            {
                "$id": "outcome_test_simple_o1",
                "outcomeId": "O1",
                # Assessment standards EMBEDDED in outcome
                "assessmentStandards": '[{"code": "AS1.1", "description": "Test AS"}]'
            }
        ],
        "is_correct": True,
        "attempts": 1
    }

    mastery_updates = _update_mastery_scores(lesson_snapshot, state, [])

    # Should have 2 updates: 1 outcome + 1 AS (from embedded data)
    assert len(mastery_updates) == 2

    # Check outcome-level update
    outcome_update = next(u for u in mastery_updates if "#" not in u["outcome_id"])
    assert outcome_update["outcome_id"] == "outcome_test_simple_o1"
    assert outcome_update["score"] == 1.0

    # Check AS-level update (parsed from embedded assessmentStandards)
    as_updates = [u for u in mastery_updates if "#" in u["outcome_id"]]
    assert len(as_updates) == 1
    assert as_updates[0]["outcome_id"] == "outcome_test_simple_o1#AS1.1"
    assert as_updates[0]["score"] == 1.0


def test_update_mastery_scores_no_as():
    """Test outcome without assessment standards"""
    lesson_snapshot = {
        "title": "Test Lesson",
        "courseId": "test_course",
        "outcomeRefs": ["O1"]  # No AS
    }

    state = {
        "enriched_outcomes": [
            {
                "$id": "outcome_test_simple_o1",
                "outcomeId": "O1",
                "assessmentStandards": "[]"  # Empty AS list
            }
        ],
        "is_correct": True,
        "attempts": 1
    }

    mastery_updates = _update_mastery_scores(lesson_snapshot, state, [])

    # Should have 1 update: only outcome (no AS)
    assert len(mastery_updates) == 1
    assert mastery_updates[0]["outcome_id"] == "outcome_test_simple_o1"


def test_update_mastery_scores_missing_enriched_outcomes():
    """Test fail-fast when enriched_outcomes missing"""
    lesson_snapshot = {
        "title": "Test Lesson",
        "courseId": "test_course",
        "outcomeRefs": ["O1"]
    }

    state = {
        "enriched_outcomes": [],  # Empty!
        "is_correct": True,
        "attempts": 1
    }

    with pytest.raises(ValueError, match="MASTERY UPDATE BLOCKED"):
        _update_mastery_scores(lesson_snapshot, state, [])


def test_update_mastery_scores_malformed_as_json():
    """Test graceful handling of malformed assessmentStandards JSON"""
    lesson_snapshot = {
        "title": "Test Lesson",
        "courseId": "test_course",
        "outcomeRefs": ["O1"]
    }

    state = {
        "enriched_outcomes": [
            {
                "$id": "outcome_test_simple_o1",
                "outcomeId": "O1",
                "assessmentStandards": "{invalid json"  # Malformed!
            }
        ],
        "is_correct": True,
        "attempts": 1
    }

    # Should NOT crash - outcome mastery still created
    mastery_updates = _update_mastery_scores(lesson_snapshot, state, [])

    # Should have 1 update: outcome only (AS parsing failed gracefully)
    assert len(mastery_updates) == 1
    assert mastery_updates[0]["outcome_id"] == "outcome_test_simple_o1"
```

### 6.2 Integration Test (Full Lesson Flow)

**Test Scenario**: Complete a lesson with assessment standards and verify MasteryV2 data.

**Test Steps**:
1. Create test lesson with outcomeRefs: ["O1"] and assessmentStandardRefs: ["AS1.1", "AS1.2"]
2. Create test student and enroll in course
3. Start lesson session (frontend should enrich outcomes)
4. Complete all cards correctly
5. Verify lesson completion tool call contains mastery_updates with composite keys
6. Query MasteryV2 database and verify emaByOutcome contains:
   - Outcome key: `outcome_test_simple_o1`
   - AS keys: `outcome_test_simple_o1#AS1.1`, `outcome_test_simple_o1#AS1.2`

**Expected Backend Logs**:
```
INFO - Creating mastery updates: 1 outcomes, score=1.0
INFO - ✅ Created outcome mastery: outcome_id=outcome_test_simple_o1, score=1.0
INFO - Creating AS mastery updates: 2 standards
INFO - Found AS AS1.1 in outcome O1
INFO - ✅ Created AS mastery: outcome_id=outcome_test_simple_o1#AS1.1, score=1.0
INFO - Found AS AS1.2 in outcome O1
INFO - ✅ Created AS mastery: outcome_id=outcome_test_simple_o1#AS1.2, score=1.0
INFO - Successfully created 3 total mastery updates (outcomes + AS)
```

### 6.3 Consumer Integration Tests

**Test 1: SpacedRepetitionService**
```typescript
// Setup: Create mastery data with composite keys
const masteryData = {
  emaByOutcome: {
    "outcome_test_simple_o1": 0.5,
    "outcome_test_simple_o1#AS1.1": 0.3,  // Low mastery
    "outcome_test_simple_o2": 0.8
  }
};

// Mock overdue outcomes
const overdueOutcomes = [
  { outcomeId: "O1", dueAt: "2025-11-10T00:00:00Z" },
  { outcomeId: "O2", dueAt: "2025-11-11T00:00:00Z" }
];

// Call getReviewRecommendations
const recommendations = await getReviewRecommendations(
  studentId,
  courseId,
  databases,
  5
);

// Verify: Should correctly map O1 → outcome_test_simple_o1 and find EMA 0.5
expect(recommendations[0].currentEMA).toBe(0.5);  // NOT default 0.3
```

**Test 2: EnhancedStudentDashboard Display**
```typescript
// Setup: MasteryV2 with composite keys
const masteryV2Record = {
  emaByOutcome: {
    "outcome_test_simple_o1": 1.0,
    "outcome_test_simple_o1#AS1.1": 0.9,
    "outcome_test_simple_o1#AS1.2": 0.8
  }
};

// Parse and display
const masteryData = Object.entries(masteryV2Record.emaByOutcome).map(([key, ema]) => {
  const parsed = parseMasteryKey(key);
  return {
    displayRef: parsed.isComposite ? parsed.asCode : key,
    masteryLevel: ema,
    isAS: parsed.isComposite
  };
});

// Verify: AS codes displayed correctly
expect(masteryData.find(m => m.displayRef === "AS1.1")).toBeTruthy();
expect(masteryData.find(m => m.displayRef === "AS1.2")).toBeTruthy();
```

### 6.4 Edge Case Tests

**Test: Multiple Outcomes with Multiple AS Each**
```python
def test_multiple_outcomes_with_multiple_as():
    """Test mastery tracking across multiple outcomes with embedded AS"""
    lesson_snapshot = {
        "title": "Test",
        "courseId": "test",
        "outcomeRefs": ["O1", "AS1.1", "O2", "AS2.1"]  # Mixed array
    }

    state = {
        "enriched_outcomes": [
            {
                "$id": "outcome_test_simple_o1",
                "outcomeId": "O1",
                "assessmentStandards": '[{"code": "AS1.1"}]'
            },
            {
                "$id": "outcome_test_simple_o2",
                "outcomeId": "O2",
                "assessmentStandards": '[{"code": "AS2.1"}, {"code": "AS2.2"}]'
            }
        ],
        "is_correct": True,
        "attempts": 1
    }

    mastery_updates = _update_mastery_scores(lesson_snapshot, state, [])

    # Should have 5 updates: 2 outcomes + 3 AS (1 from O1, 2 from O2)
    assert len(mastery_updates) == 5

    # Check outcome updates
    assert any(u["outcome_id"] == "outcome_test_simple_o1" for u in mastery_updates)
    assert any(u["outcome_id"] == "outcome_test_simple_o2" for u in mastery_updates)

    # Check AS updates
    assert any(u["outcome_id"] == "outcome_test_simple_o1#AS1.1" for u in mastery_updates)
    assert any(u["outcome_id"] == "outcome_test_simple_o2#AS2.1" for u in mastery_updates)
    assert any(u["outcome_id"] == "outcome_test_simple_o2#AS2.2" for u in mastery_updates)


**Test: Outcome with Empty AS Array**
```python
def test_outcome_with_empty_as():
    """Test outcome without assessment standards (valid scenario)"""
    lesson_snapshot = {
        "title": "Test",
        "courseId": "test",
        "outcomeRefs": ["O1"]
    }

    state = {
        "enriched_outcomes": [
            {
                "$id": "outcome_test_simple_o1",
                "outcomeId": "O1",
                "assessmentStandards": "[]"  # Empty - valid!
            }
        ],
        "is_correct": True,
        "attempts": 1
    }

    mastery_updates = _update_mastery_scores(lesson_snapshot, state, [])

    # Should have 1 update: outcome only (no AS to track)
    assert len(mastery_updates) == 1
    assert mastery_updates[0]["outcome_id"] == "outcome_test_simple_o1"
```

---

## 7. Example Data Flow

### 7.1 Complete Example: Lesson Completion with AS Tracking

**Step 1: Lesson Template (Database)**
```json
{
  "$id": "lesson_simple_addition",
  "title": "Simple Addition",
  "courseId": "test_course_simple_math",
  "outcomeRefs": "[\"O1\", \"AS1.1\"]",  // ← MIXED ARRAY (JSON string)
  "cards": "[...]"
}
```

**Step 2: Frontend Snapshot Creation (LessonDriver.tsx)**
```typescript
// Parse outcomeRefs from database
const parsedOutcomeRefs = JSON.parse(lessonTemplate.outcomeRefs);
// → ["O1", "AS1.1"]  (MIXED ARRAY - still contains both)

const lessonSnapshot = {
  outcomeRefs: parsedOutcomeRefs,  // ["O1", "AS1.1"]
  // ... other fields
};
```

**Step 3: Frontend Enrichment (SessionChatAssistant.tsx)**
```typescript
// Extract only outcome IDs (filter out decimals)
const outcomeDriver = new CourseOutcomesDriver(databases);
const outcomeIds = outcomeDriver.extractOutcomeIds(lessonSnapshot.outcomeRefs);
// Input: ["O1", "AS1.1"]
// Output: ["O1"]  ← Assessment standards filtered out

// Fetch CourseOutcome objects
const enrichedOutcomes = await outcomeDriver.getOutcomesByIds(
  courseId,
  outcomeIds  // ["O1"]
);

// Result: Full CourseOutcome objects with EMBEDDED assessment standards
enrichedOutcomes = [
  {
    $id: "outcome_test_simple_o1",
    outcomeId: "O1",
    outcomeTitle: "Perform addition with whole numbers",
    assessmentStandards: '[{"code":"AS1.1","description":"Add single digit numbers correctly"}]',  // ← AS EMBEDDED HERE
    // ... other fields
  }
];

// Pass to backend in session_context
const context = {
  session_id: "...",
  student_id: "...",
  lesson_snapshot: lessonSnapshot,      // outcomeRefs: ["O1", "AS1.1"]
  enriched_outcomes: enrichedOutcomes   // ✅ Sent to backend with embedded AS
};
```

**Step 4: Backend Entry Node (graph_interrupt.py)**
```python
# Extract from session_context
enriched_outcomes = session_context.get("enriched_outcomes", [])
# → [{"$id": "outcome_test_simple_o1", "outcomeId": "O1", "assessmentStandards": "[...]", ...}]

# Set in state for teaching subgraph
return {
    "enriched_outcomes": enriched_outcomes,
    # ...
}
```

**Step 5: Student Completes Card (Progress Node)**
```python
# Teaching graph progress_node calls:
mastery_updates = _update_mastery_scores(
    lesson_snapshot,
    state,
    state.get("mastery_updates", [])
)

# _update_mastery_scores executes (SIMPLIFIED - no searching!):
for outcome in enriched_outcomes:  # Only 1 iteration for this example
    # 1. Create outcome-level mastery
    mastery_update = {
        "outcome_id": outcome["$id"],  # "outcome_test_simple_o1"
        "score": 1.0,
        "timestamp": "2025-11-12T14:33:15.290029"
    }
    mastery_updates.append(mastery_update)

    # 2. Parse embedded assessmentStandards
    as_list_json = outcome.get("assessmentStandards", "[]")
    # as_list_json = '[{"code":"AS1.1","description":"Add single digit numbers correctly"}]'

    as_list = json.loads(as_list_json)
    # as_list = [{"code": "AS1.1", "description": "..."}]

    for as_obj in as_list:
        as_code = as_obj.get("code")  # "AS1.1"

        if as_code:
            # Create composite key
            composite_key = f"{outcome['$id']}#{as_code}"
            # composite_key = "outcome_test_simple_o1#AS1.1"

            as_mastery_update = {
                "outcome_id": composite_key,
                "score": 1.0,
                "timestamp": "2025-11-12T14:33:15.290029"
            }
            mastery_updates.append(as_mastery_update)

# Result: mastery_updates = [
#   {"outcome_id": "outcome_test_simple_o1", "score": 1.0},
#   {"outcome_id": "outcome_test_simple_o1#AS1.1", "score": 1.0}
# ]
```

**Step 6: Lesson Completion (Completion Node)**
```python
# Create tool call with mastery_updates
tool_call = ToolCall(
    id="lesson_completion",
    name="lesson_completion_summary",
    args={
        "mastery_updates": mastery_updates,  # 2 updates (1 outcome + 1 AS)
        # ... other args
    }
)
```

**Step 7: Frontend Persistence (LessonCompletionSummaryTool.tsx)**
```typescript
// Receives mastery_updates from backend
const mastery_updates = [
  {outcome_id: "outcome_test_simple_o1", score: 1.0},
  {outcome_id: "outcome_test_simple_o1#AS1.1", score: 1.0}
];

// Convert to EMA format
const emaUpdates = {};
mastery_updates.forEach(update => {
  emaUpdates[update.outcome_id] = update.score;
});

// emaUpdates = {
//   "outcome_test_simple_o1": 1.0,
//   "outcome_test_simple_o1#AS1.1": 1.0
// }

// Persist to MasteryV2
await masteryDriver.batchUpdateEMAs(student_id, course_id, emaUpdates);
```

**Step 8: MasteryV2 Database Record**
```json
{
  "$id": "6914772e00159d6d0bd7",
  "studentId": "68d28c190016b1458092",
  "courseId": "test_course_simple_math",
  "emaByOutcome": "{\"outcome_test_simple_o1\":1.0,\"outcome_test_simple_o1#AS1.1\":1.0}",
  "updatedAt": "2025-11-12T14:34:12.603+00:00"
}
```

### 7.2 Data Flow Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: SessionChatAssistant.tsx                              │
│                                                                 │
│  outcomeRefs: ["O1"]                                           │
│         ↓                                                       │
│  enrichOutcomeRefs()                                           │
│         ↓                                                       │
│  enriched_outcomes: [                                          │
│    {$id: "outcome_test_simple_o1", outcomeId: "O1", ...}      │
│  ]                                                             │
│         ↓                                                       │
│  session_context.enriched_outcomes = enriched_outcomes         │
└─────────────────────────────────────────────────────────────────┘
                         ↓ (WebSocket)
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: graph_interrupt.py (Entry Node)                       │
│                                                                 │
│  enriched_outcomes = session_context.get("enriched_outcomes")  │
│  state["enriched_outcomes"] = enriched_outcomes                │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: teacher_graph_toolcall_interrupt.py (Progress Node)   │
│                                                                 │
│  mastery_updates = _update_mastery_scores(                     │
│    lesson_snapshot,                                            │
│    state,  # Contains enriched_outcomes                        │
│    []                                                           │
│  )                                                             │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: teaching_utils.py (_update_mastery_scores)            │
│                                                                 │
│  Iterate enriched_outcomes (SIMPLIFIED - single loop!)        │
│  ──────────────────────────────────────────────────────────     │
│  for outcome in enriched_outcomes:                             │
│    # 1. Create outcome-level mastery                           │
│    outcome_id = outcome["$id"]  # "outcome_test_simple_o1"    │
│    mastery_updates.append({                                    │
│      "outcome_id": outcome_id,                                 │
│      "score": 1.0                                              │
│    })                                                           │
│                                                                 │
│    # 2. Parse embedded assessmentStandards (NEW)               │
│    as_list = json.loads(outcome["assessmentStandards"])        │
│    # as_list = [{"code": "AS1.1", "description": "..."}]       │
│                                                                 │
│    for as_obj in as_list:                                      │
│      as_code = as_obj.get("code")  # "AS1.1"                  │
│      composite_key = f"{outcome['$id']}#{as_code}"             │
│                       # "outcome_test_simple_o1#AS1.1"         │
│      mastery_updates.append({                                  │
│        "outcome_id": composite_key,                            │
│        "score": 1.0                                            │
│      })                                                         │
│                                                                 │
│  Returns: [                                                     │
│    {outcome_id: "outcome_test_simple_o1", score: 1.0},        │
│    {outcome_id: "outcome_test_simple_o1#AS1.1", score: 1.0}   │
│  ]                                                             │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND: teacher_graph_toolcall_interrupt.py (Completion Node) │
│                                                                 │
│  tool_call = ToolCall(                                         │
│    name="lesson_completion_summary",                           │
│    args={                                                       │
│      "mastery_updates": mastery_updates  # All 3 updates       │
│    }                                                            │
│  )                                                             │
└─────────────────────────────────────────────────────────────────┘
                         ↓ (Tool Call)
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: LessonCompletionSummaryTool.tsx                      │
│                                                                 │
│  emaUpdates = {                                                │
│    "outcome_test_simple_o1": 1.0,                              │
│    "outcome_test_simple_o1#AS1.1": 1.0,                        │
│    "outcome_test_simple_o1#AS1.2": 1.0                         │
│  }                                                             │
│         ↓                                                       │
│  masteryDriver.batchUpdateEMAs(student_id, course_id, emaUpdates) │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE: MasteryV2 Collection                                 │
│                                                                 │
│  {                                                             │
│    studentId: "68d28c190016b1458092",                         │
│    courseId: "test_course_simple_math",                        │
│    emaByOutcome: "{                                            │
│      \"outcome_test_simple_o1\": 1.0,                          │
│      \"outcome_test_simple_o1#AS1.1\": 1.0,                    │
│      \"outcome_test_simple_o1#AS1.2\": 1.0                     │
│    }"                                                           │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Performance Considerations

### 8.1 Storage Impact

**Before Composite Keys**:
```json
{
  "emaByOutcome": "{\"outcome_test_simple_o1\":1.0}"
}
```
**Size**: ~50 bytes

**After Composite Keys** (1 outcome + 2 AS):
```json
{
  "emaByOutcome": "{\"outcome_test_simple_o1\":1.0,\"outcome_test_simple_o1#AS1.1\":0.9,\"outcome_test_simple_o1#AS1.2\":0.8}"
}
```
**Size**: ~125 bytes

**Typical Lesson**:
- 3 cards
- 1 outcome per card
- 2 assessment standards per outcome
- Total keys: 3 outcomes + 6 AS = **9 keys**
- Storage: ~300-400 bytes (still very small)

**Max Lesson** (edge case):
- 10 cards
- 2 outcomes per card
- 3 AS per outcome
- Total keys: 20 outcomes + 60 AS = **80 keys**
- Storage: ~3-4 KB (still acceptable)

**Conclusion**: ✅ Storage impact negligible (Appwrite document limit: 1 MB)

### 8.2 Query Performance

**MasteryV2 Queries**:
- Primary query: `Query.equal('studentId', studentId), Query.equal('courseId', courseId)`
- Returns single document with ALL mastery data
- No change in query structure (still fetches by student + course)

**Key Parsing Overhead**:
- Parsing composite keys in frontend: `O(n)` where n = number of keys
- Typical: 10-20 keys → negligible overhead (<1ms)
- Max: 100 keys → still <5ms

**Conclusion**: ✅ No significant performance impact

### 8.3 Frontend Consumer Performance

**SpacedRepetitionService**:
- NEW: Builds `outcomeId → documentId` map
- Time complexity: `O(n)` where n = number of course outcomes
- Typical course: 10-20 outcomes → <1ms
- Max course: 100 outcomes → ~5ms

**Dashboard Display**:
- NEW: Parses composite keys for display
- Time complexity: `O(m)` where m = number of mastery entries
- Typical: 20-50 entries → <1ms
- Max: 200 entries → ~5ms

**Conclusion**: ✅ No noticeable UI performance impact

### 8.4 Backend Mastery Creation Performance

**Simplified Logic** (No Searching!):
- Single loop through enriched_outcomes
- For each outcome: Parse embedded assessmentStandards
- Time complexity: `O(n × k)` where:
  - n = number of enriched outcomes (typically 1-3 per card)
  - k = average number of AS per outcome (typically 1-3)
- Typical: 2 outcomes × 2 AS each = 4 total mastery updates → <1ms
- Max: 5 outcomes × 5 AS each = 25 total mastery updates → ~1ms

**Why This is Fast**:
- ✅ No searching or filtering - just direct iteration
- ✅ Single pass through outcomes (not nested loops searching)
- ✅ AS already associated with parent in enriched_outcomes structure
- ✅ JSON parsing is fast (native operation)

**Comparison to Old Approach**:
- ❌ Old: O(k × n) search pattern - for each AS, search all outcomes
- ✅ New: O(n × k) iteration pattern - for each outcome, iterate its AS
- Performance identical in complexity class, but new approach simpler and more maintainable

**Conclusion**: ✅ Optimal implementation; no optimization needed

---

## 9. Alternative Approaches Rejected

### 9.1 Separate Collection for AS Mastery

**Approach**: Create `MasteryV2_AssessmentStandards` collection.

**Pros**:
- Clean separation of concerns
- Easier to query AS-level data independently

**Cons**:
- ❌ Requires 2 database queries (outcomes + AS)
- ❌ More complex data sync (2 collections to update)
- ❌ Potential data inconsistency (outcome updated but AS fails)
- ❌ Higher storage overhead (duplicate metadata per row)

**Why Rejected**: Composite keys achieve same granularity without complexity.

### 9.2 Outcome-Level Only (Current MVP)

**Approach**: Track mastery ONLY at outcome level, ignore AS.

**Pros**:
- ✅ Simplest implementation
- ✅ Matches document structure (outcomes have IDs, AS don't)

**Cons**:
- ❌ **Loses granularity** - can't see which specific AS student struggles with
- ❌ Teacher feedback less actionable (know O1 is weak, but not which part)
- ❌ Spaced repetition less targeted (can't prioritize specific AS)

**Why Rejected**: Assessment standards are critical for SQA alignment and granular feedback.

### 9.3 String Refs with Display Mapping

**Approach**: Keep using string refs ("O1", "AS1.1") as keys, maintain separate lookup table.

**Pros**:
- Human-readable keys in database
- No composite key parsing needed

**Cons**:
- ❌ **Fails validation** - "AS1.1" is not a document ID (fails our fail-fast check)
- ❌ Requires separate lookup table (outcomeId → documentId)
- ❌ Risk of data corruption if lookup table out of sync
- ❌ **This is the bug we just fixed!** (empty keys from missing lookups)

**Why Rejected**: Violates fail-fast principle; we already fixed this bug.

### 9.4 Nested JSON Structure

**Approach**: Store mastery as nested JSON instead of flat keys.

```json
{
  "emaByOutcome": {
    "outcome_test_simple_o1": {
      "outcomeEMA": 1.0,
      "assessmentStandards": {
        "AS1.1": 0.9,
        "AS1.2": 0.8
      }
    }
  }
}
```

**Pros**:
- Clear hierarchical structure
- No composite key parsing

**Cons**:
- ❌ Breaks existing consumers (expect flat object)
- ❌ More complex querying (need to traverse nested structure)
- ❌ Harder to filter/aggregate (can't use `Object.keys()` directly)
- ❌ Larger migration effort (change data structure)

**Why Rejected**: Composite keys provide hierarchy without breaking existing code.

---

## 10. Success Criteria

### 10.1 Backend Success Checklist

- [ ] `_find_parent_outcome()` function added to `teaching_utils.py`
- [ ] `_update_mastery_scores()` creates both outcome and AS mastery updates
- [ ] Backend logs show "Creating AS mastery updates" messages
- [ ] Backend logs show composite keys: `"outcome_test_simple_o1#AS1.1"`
- [ ] No errors when AS not found in outcomes (graceful warning logged)
- [ ] Unit tests pass for all backend changes

### 10.2 Database Success Checklist

- [ ] MasteryV2 record contains composite keys in `emaByOutcome`
- [ ] Example: `{"outcome_test_simple_o1": 1.0, "outcome_test_simple_o1#AS1.1": 0.9}`
- [ ] No empty keys (`""`) in emaByOutcome
- [ ] All keys are valid (outcome keys: 20+ chars, composite keys: contain exactly one `#`)
- [ ] EMA values are between 0 and 1

**Verification Query**:
```typescript
const masteryRecord = await masteryDriver.getMasteryV2(studentId, courseId);
const emaByOutcome = masteryRecord?.emaByOutcome || {};

console.log('Keys:', Object.keys(emaByOutcome));
// Expected: ["outcome_test_simple_o1", "outcome_test_simple_o1#AS1.1", "outcome_test_simple_o1#AS1.2"]

const hasCompositeKeys = Object.keys(emaByOutcome).some(key => key.includes('#'));
console.log('Has AS-level tracking:', hasCompositeKeys);
// Expected: true
```

### 10.3 Frontend Consumer Success Checklist

**SpacedRepetitionService**:
- [ ] `buildOutcomeIdToDocIdMap()` correctly maps outcomeId → documentId
- [ ] Overdue outcomes lookup finds correct EMA (not default 0.3)
- [ ] Recommendations prioritize based on actual mastery data

**EnhancedStudentDashboard**:
- [ ] Composite keys parsed correctly for display
- [ ] UI shows "AS1.1" instead of "outcome_test_simple_o1#AS1.1"
- [ ] Outcome-level and AS-level mastery visually separated (if implemented)

**ProgressService & PlannerService**:
- [ ] Continue working without changes (compatibility verified)

### 10.4 Integration Test Success Checklist

- [ ] Complete lesson with assessment standards
- [ ] Verify tool call contains 3+ mastery_updates (1 outcome + 2+ AS)
- [ ] Frontend receives mastery_updates with composite keys
- [ ] MasteryV2 database updated with composite keys
- [ ] Spaced repetition recommendations use AS-level data
- [ ] Dashboard displays AS mastery correctly

### 10.5 Expected Log Output

**Backend (teaching_utils.py)**:
```
INFO - Creating mastery updates: 1 outcomes, score=1.0
🚨 MASTERY DEBUG - Enriched outcomes count: 1
🚨 MASTERY DEBUG - Enriched outcomes sample: [{'$id': 'outcome_test_simple_o1', 'outcomeId': 'O1', ...}]
🚨 MASTERY DEBUG - State: is_correct=True, attempts=1, score=1.0
INFO - ✅ Created outcome mastery: outcome_id=outcome_test_simple_o1, score=1.0
🚨 MASTERY DEBUG - Created outcome update: {'outcome_id': 'outcome_test_simple_o1', 'score': 1.0, 'timestamp': '...'}
INFO - Creating AS mastery updates: 2 standards
🚨 MASTERY DEBUG - Assessment standards to track: ['AS1.1', 'AS1.2']
INFO - Found AS AS1.1 in outcome O1
INFO - ✅ Created AS mastery: outcome_id=outcome_test_simple_o1#AS1.1, score=1.0
🚨 MASTERY DEBUG - Created AS update: {'outcome_id': 'outcome_test_simple_o1#AS1.1', 'score': 1.0, 'timestamp': '...'}
INFO - Found AS AS1.2 in outcome O1
INFO - ✅ Created AS mastery: outcome_id=outcome_test_simple_o1#AS1.2, score=1.0
🚨 MASTERY DEBUG - Created AS update: {'outcome_id': 'outcome_test_simple_o1#AS1.2', 'score': 1.0, 'timestamp': '...'}
INFO - Successfully created 3 total mastery updates (outcomes + AS)
🚨 MASTERY DEBUG - Total mastery updates: 3
```

**Frontend (LessonCompletionSummaryTool.tsx)**:
```
🎯 Starting MasteryV2 EMA updates persistence...
[Mastery Debug] Converting mastery updates to EMA format: (3) [{…}, {…}, {…}]
  0: {outcome_id: 'outcome_test_simple_o1', score: 1, timestamp: '...'}
  1: {outcome_id: 'outcome_test_simple_o1#AS1.1', score: 1, timestamp: '...'}
  2: {outcome_id: 'outcome_test_simple_o1#AS1.2', score: 1, timestamp: '...'}
[MasteryV2 Debug] EMA updates to apply: {outcome_test_simple_o1: 1, outcome_test_simple_o1#AS1.1: 1, outcome_test_simple_o1#AS1.2: 1}
✅ Successfully updated MasteryV2 EMAs
```

---

## Appendix: Quick Reference

### Key Format Summary

| Type | Format | Example | Length |
|------|--------|---------|--------|
| Outcome | `{documentId}` | `outcome_test_simple_o1` | 20+ chars |
| Assessment Standard | `{documentId}#{asCode}` | `outcome_test_simple_o1#AS1.1` | 25+ chars |

### File Changes Summary

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `langgraph-agent/src/agent/teaching_utils.py` | Modify | ~80 lines (add function + update existing) |
| `assistant-ui-frontend/lib/services/spaced-repetition-service.ts` | Modify | ~30 lines (add mapping logic) |
| `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx` | Modify | ~20 lines (parse composite keys) |
| `assistant-ui-frontend/lib/utils/mastery-helpers.ts` | **New File** | ~200 lines (helper functions) |
| `assistant-ui-frontend/lib/utils/__tests__/mastery-helpers.test.ts` | **New File** | ~150 lines (unit tests) |

### Consumer Impact Summary

| Consumer | Impact | Effort |
|----------|--------|--------|
| ProgressService | ✅ None | 0 hours |
| PlannerService | ✅ None | 0 hours |
| SpacedRepetitionService | ❌ Breaking | 2-3 hours |
| EnhancedStudentDashboard | ⚠️ Display | 1-2 hours |

**Total Estimated Effort**: 8-12 hours (backend + frontend + testing)

---

**End of Specification**
