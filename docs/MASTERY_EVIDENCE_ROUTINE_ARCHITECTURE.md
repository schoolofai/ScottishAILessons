# Mastery + Evidence + Routine Architecture

**Comprehensive Developer Guide**
Last Updated: November 2025
Version: 2.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Data Model Specifications](#2-data-model-specifications)
3. [Key Format Translation Architecture](#3-key-format-translation-architecture)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Critical Implementation Details](#5-critical-implementation-details)
6. [Recent Fixes and Why They Matter](#6-recent-fixes-and-why-they-matter)
7. [Common Issues and Troubleshooting](#7-common-issues-and-troubleshooting)
8. [Developer Onboarding Guide](#8-developer-onboarding-guide)
9. [Code Reference Index](#9-code-reference-index)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

### 1.1 What This Document Covers

This document explains the **three-system architecture** that tracks student learning in ScottishAILessons:

1. **MasteryV2**: Tracks student mastery levels using Exponential Moving Average (EMA) scores
2. **Evidence**: Stores detailed student response data for each learning interaction
3. **RoutineV2**: Manages spaced repetition schedules for review recommendations

### 1.2 Why Three Separate Systems?

**Separation of Concerns**:
- **Evidence** = Raw interaction data (what happened)
- **MasteryV2** = Aggregated understanding level (how well they know it)
- **RoutineV2** = Scheduling metadata (when to review it)

This separation allows:
- Independent querying and optimization
- Different retention/archival policies
- Clear responsibility boundaries
- Easier debugging and testing

### 1.3 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LESSON COMPLETION                        │
│                 (LessonCompletionSummaryTool)               │
└────────┬─────────────┬──────────────────┬──────────────────┘
         │             │                  │
         ▼             ▼                  ▼
    ┌────────┐   ┌─────────┐      ┌──────────┐
    │Evidence│   │MasteryV2│      │RoutineV2 │
    │        │   │         │      │          │
    │ Raw    │   │ EMA     │      │ Due      │
    │ Records│   │ Scores  │      │ Dates    │
    └────────┘   └────┬────┘      └────┬─────┘
                      │                │
                      │   ┌────────────┘
                      │   │
                      ▼   ▼
              ┌────────────────────┐
              │ SPACED REPETITION  │
              │  (Dashboard UI)    │
              └────────────────────┘
```

### 1.4 Quick Reference

| If you need to...                      | Look at section...               |
|----------------------------------------|----------------------------------|
| Understand data models                 | [Section 2](#2-data-model-specifications) |
| Fix key format bugs                    | [Section 3](#3-key-format-translation-architecture) |
| Trace lesson completion flow           | [Section 4.1](#41-lesson-completion-flow-write-path) |
| Debug spaced repetition                | [Section 7](#7-common-issues-and-troubleshooting) |
| Add new mastery tracking               | [Section 8.3](#83-making-changes-safely) |
| Find specific code                     | [Section 9](#9-code-reference-index) |

---

## 2. Data Model Specifications

### 2.1 MasteryV2 Collection

**Collection Name**: `MasteryV2`
**Purpose**: Track student mastery levels for course outcomes and assessment standards

#### Schema

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `studentId` | string | Student document ID | `"67890abc..."` |
| `courseId` | string | SQA course code | `"C844 73"` |
| `emaByOutcome` | JSON string | Mastery scores by outcome | `{"outcome_test_simple_o1": 0.85, ...}` |
| `lastUpdated` | datetime | Last modification timestamp | `"2025-11-12T14:30:00Z"` |
| `schema_version` | number | Data schema version | `2` |

#### Key Format (CRITICAL)

MasteryV2 uses **two key formats** in `emaByOutcome`:

1. **Outcome-level keys** (document IDs):
   ```json
   "outcome_test_simple_o1": 0.85
   ```

2. **Assessment standard-level keys** (composite keys):
   ```json
   "outcome_test_simple_o1#AS1.1": 0.90
   ```

**Composite Key Format**: `{documentId}#{asCode}`

**Why?** This allows granular tracking at both the learning outcome level AND the individual assessment standard level.

#### EMA Calculation

```python
def _calculate_mastery_score(is_correct: bool, attempts: int) -> float:
    """Calculate mastery score based on correctness and attempts."""
    if is_correct and attempts == 1:
        return 1.0  # Perfect first-attempt
    elif is_correct:
        return 0.7  # Correct after retries
    else:
        return 0.3  # Incorrect
```

**EMA Update** (Exponential Moving Average):
```
new_ema = (alpha * new_score) + ((1 - alpha) * old_ema)
where alpha = 0.3 (30% weight to new, 70% to history)
```

#### Example Document

```json
{
  "$id": "mastery_student123_course456",
  "studentId": "67890abc123",
  "courseId": "C844 73",
  "emaByOutcome": "{\"outcome_test_simple_o1\":0.85,\"outcome_test_simple_o1#AS1.1\":0.90,\"outcome_test_simple_o1#AS1.2\":0.75}",
  "lastUpdated": "2025-11-12T14:30:00.000Z",
  "schema_version": 2
}
```

### 2.2 Evidence Collection

**Collection Name**: `evidence`
**Purpose**: Store detailed records of every student interaction with learning content

#### Schema

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `sessionId` | string | Link to session | `"session_abc123"` |
| `itemId` | string | Card/question ID | `"card_01"` |
| `response` | string | Student's answer | `"1/5"` |
| `correct` | boolean | Was answer correct? | `true` |
| `attempts` | number | Number of tries | `2` |
| `confidence` | number | LLM confidence | `0.95` |
| `reasoning` | string | LLM evaluation reasoning | `"Correct simplification..."` |
| `feedback` | string | Feedback to student | `"Great work! You..."` |
| `timestamp` | datetime | When recorded | `"2025-11-12T14:25:00Z"` |
| `partialCredit` | number | Partial credit score (0-1) | `0.8` |
| `maxAttemptsReached` | boolean | Hit attempt limit? | `false` |

#### Batch Creation

Evidence records are created in batches for performance:

```typescript
// LessonCompletionSummaryTool.tsx
const evidenceResults = await evidenceDriver.batchRecordEvidence(evidenceData);
```

#### Example Document

```json
{
  "$id": "evidence_xyz789",
  "sessionId": "session_abc123",
  "itemId": "card_01",
  "response": "1/5",
  "correct": true,
  "attempts": 2,
  "confidence": 0.95,
  "reasoning": "The student correctly simplified the fraction from 2/10 to 1/5.",
  "feedback": "Great work! You correctly simplified the fraction.",
  "timestamp": "2025-11-12T14:25:00.000Z",
  "partialCredit": 1.0,
  "maxAttemptsReached": false
}
```

### 2.3 RoutineV2 Collection

**Collection Name**: `Routine`
**Purpose**: Track when each outcome should be reviewed (spaced repetition scheduling)

#### Schema

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `studentId` | string | Student document ID | `"67890abc123"` |
| `courseId` | string | SQA course code | `"C844 73"` |
| `dueAtByOutcome` | JSON string | Review dates by outcome | `{"O1": "2025-11-19...", ...}` |
| `lastTaughtAt` | datetime | Last lesson completion | `"2025-11-12T14:30:00Z"` |
| `spacingPolicyVersion` | number | Algorithm version | `1` |
| `schema_version` | number | Data schema version | `1` |

#### Key Format (CRITICAL)

RoutineV2 uses **string references** (SQA codes) in `dueAtByOutcome`:

```json
{
  "O1": "2025-11-19T17:12:37.353Z",
  "AS1.1": "2025-11-19T17:12:37.850Z"
}
```

**⚠️ WARNING**: RoutineV2 uses string refs (`"O1"`), NOT document IDs (`"outcome_test_simple_o1"`)!

This is for **legacy compatibility** with the original system design.

#### Spaced Repetition Algorithm

```typescript
calculateNextDueDate(currentEMA: number, daysSinceLastReview: number = 1): string {
  let intervalDays: number;

  if (currentEMA >= 0.8) {
    // Mastered: 7-14 day intervals
    intervalDays = Math.max(7, daysSinceLastReview * 2);
  } else if (currentEMA >= 0.6) {
    // Good progress: 3-7 day intervals
    intervalDays = Math.max(3, daysSinceLastReview * 1.5);
  } else if (currentEMA >= 0.4) {
    // Some progress: 1-3 day intervals
    intervalDays = Math.max(1, daysSinceLastReview * 1.2);
  } else {
    // Struggling: daily review
    intervalDays = 1;
  }

  // Cap at 30 days maximum
  intervalDays = Math.min(intervalDays, 30);

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + intervalDays);

  return nextDue.toISOString();
}
```

#### Progressive Interval Expansion

| Review # | EMA | Days Since Last | Calculation | Next Interval |
|----------|-----|-----------------|-------------|---------------|
| 1st      | 1.0 | 1 (default)     | max(7, 1×2) = 7 | **7 days** |
| 2nd      | 1.0 | 7               | max(7, 7×2) = 14 | **14 days** |
| 3rd      | 1.0 | 14              | max(7, 14×2) = 28 | **28 days** |
| 4th      | 1.0 | 28              | max(7, 28×2) = 30 (capped) | **30 days** |

**First Review Behavior**: Even with 100% mastery, the first review is scheduled for **7 days** (minimum). This is based on memory retention research - initial consolidation requires a review within a week.

#### Example Document

```json
{
  "$id": "routine_student123_course456",
  "studentId": "67890abc123",
  "courseId": "C844 73",
  "dueAtByOutcome": "{\"O1\":\"2025-11-19T17:12:37.353Z\",\"AS1.1\":\"2025-11-19T17:12:37.850Z\"}",
  "lastTaughtAt": "2025-11-12T14:30:00.000Z",
  "spacingPolicyVersion": 1,
  "schema_version": 1
}
```

---

## 3. Key Format Translation Architecture

### 3.1 The Translation Problem

**CRITICAL CONCEPT**: MasteryV2 and RoutineV2 use **different key formats** for the same concepts.

#### The Mismatch

| System | Outcome Key | Assessment Standard Key |
|--------|-------------|-------------------------|
| **MasteryV2** | `"outcome_test_simple_o1"` (document ID) | `"outcome_test_simple_o1#AS1.1"` (composite) |
| **RoutineV2** | `"O1"` (string ref) | `"AS1.1"` (string ref) |

**Why the difference?**
- **MasteryV2**: New system, uses Appwrite document IDs (20+ character unique strings)
- **RoutineV2**: Legacy system, uses human-readable SQA codes

**What breaks without translation?**
- Passing document IDs to RoutineDriver → validation error
- Looking up string refs in MasteryV2 → defaults to 0.3 (not found)
- Creates duplicate keys in RoutineV2
- Shows wrong mastery percentages in UI

### 3.2 Translation Layers

There are **TWO translation layers** (bidirectional):

#### Write Path: MasteryV2 → RoutineV2

**File**: `assistant-ui-frontend/components/tools/LessonCompletionSummaryTool.tsx:258-320`

**When**: After lesson completion, when updating routine schedules

**Translation Logic**:

```typescript
// Build reverse mapping: documentId → outcomeId (string ref)
const documentIdToOutcomeId = new Map<string, string>();

if (enriched_outcomes && enriched_outcomes.length > 0) {
  enriched_outcomes.forEach((outcome: any) => {
    const docId = outcome.$id;          // "outcome_test_simple_o1"
    const stringRef = outcome.outcomeId; // "O1"

    if (docId && stringRef) {
      // Map outcome
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
              // "outcome_test_simple_o1#AS1.1" → "AS1.1"
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

// Process mastery data with translation
for (const masteryUpdate of mastery_updates) {
  const masteryKey = masteryUpdate.outcome_id;  // Document ID or composite key
  const stringRef = documentIdToOutcomeId.get(masteryKey);

  if (!stringRef) {
    console.warn(`⚠️ No string ref found for mastery key: ${masteryKey}`);
    continue;  // FAIL-FAST: Skip if can't translate
  }

  await routineDriver.updateOutcomeSchedule(
    student_id,
    course_id,
    stringRef,  // ✅ CORRECT: Using string ref ("O1", "AS1.1")
    masteryUpdate.score
  );
}
```

**Key Points**:
- Uses `enriched_outcomes` as single source of truth
- Handles both outcome IDs and composite keys
- Fails fast with warning if translation impossible
- Prevents wrong key formats from reaching RoutineDriver

#### Read Path: RoutineV2 → MasteryV2

**File**: `assistant-ui-frontend/lib/services/spaced-repetition-service.ts:315-404`

**When**: Dashboard loads spaced repetition recommendations

**Translation Logic**:

```typescript
async function buildOutcomeIdMapping(
  outcomeIds: string[],  // ["O1", "AS1.1"] from RoutineV2
  courseId: string,
  databases: Databases
): Promise<Map<string, string>> {
  const outcomeDriver = new CourseOutcomesDriver(databases);
  const mapping = new Map<string, string>();

  // 1. Separate outcome IDs from AS codes (AS codes contain decimal point)
  const outcomeIdsOnly = outcomeIds.filter(id => !id.includes('.'));  // ["O1"]
  const asCodesOnly = outcomeIds.filter(id => id.includes('.'));      // ["AS1.1"]

  // 2. Handle outcome IDs
  if (outcomeIdsOnly.length > 0) {
    const outcomes = await outcomeDriver.getOutcomesByIds(courseId, outcomeIdsOnly);

    outcomes.forEach(outcome => {
      const outcomeId = outcome.outcomeId; // "O1"
      const documentId = outcome.$id;      // "outcome_test_simple_o1"
      mapping.set(outcomeId, documentId);  // "O1" → "outcome_test_simple_o1"
    });
  }

  // 3. Handle AS codes (search through outcomes' assessmentStandards)
  if (asCodesOnly.length > 0) {
    const allOutcomes = await outcomeDriver.getOutcomesByIds(courseId, outcomeIdsOnly);

    for (const asCode of asCodesOnly) {
      let found = false;

      for (const outcome of allOutcomes) {
        const asListJson = outcome.assessmentStandards || "[]";
        try {
          const asList = typeof asListJson === 'string' ? JSON.parse(asListJson) : asListJson;

          if (Array.isArray(asList)) {
            const hasAS = asList.some((as: any) => as.code === asCode);

            if (hasAS) {
              // Found it! Create composite key mapping
              const compositeKey = `${outcome.$id}#${asCode}`;
              mapping.set(asCode, compositeKey);
              // "AS1.1" → "outcome_test_simple_o1#AS1.1"
              found = true;
              break;
            }
          }
        } catch (e) {
          // Skip parsing errors
        }
      }

      if (!found) {
        console.warn(`Could not find outcome containing AS code: ${asCode}`);
      }
    }
  }

  return mapping;
}
```

**Key Points**:
- Separates outcomes from AS codes by checking for decimal point
- Fetches CourseOutcome records to get document IDs
- Searches `assessmentStandards` field to find which outcome contains each AS code
- Reconstructs composite keys for AS codes
- Returns complete mapping for mastery lookup

### 3.3 Enriched Outcomes

**What are they?**

Enriched outcomes are **full CourseOutcome objects** with embedded assessment standards:

```typescript
{
  $id: "outcome_test_simple_o1",           // Appwrite document ID
  outcomeId: "O1",                         // SQA string reference
  title: "Simplify fractions",
  description: "...",
  assessmentStandards: "[{\"code\":\"AS1.1\",\"description\":\"...\"}]"  // JSON string
}
```

**Why are they needed?**

They are the **single source of truth** for key translation:
- Contains both `$id` (document ID) and `outcomeId` (string ref)
- Contains `assessmentStandards` (for composite key generation)
- Prevents guessing or hardcoding translations

**Where do they come from?**

**Backend** (`langgraph-agent/src/agent/teacher_graph_toolcall_interrupt.py:407`):
```python
tool_call = ToolCall(
    name="lesson_completion_summary",
    args={
        # ... other args ...
        "enriched_outcomes": state.get("enriched_outcomes", [])
    }
)
```

**Frontend Session Context** (set at session start):
```typescript
// SessionChatAssistant.tsx
const enrichedOutcomes = await outcomeDriver.getOutcomesByIds(
  courseId,
  outcomeIdsOnly  // Extracted from lesson_snapshot.outcomeRefs
);

session_context: {
  enriched_outcomes: enrichedOutcomes
}
```

**Critical**: Enriched outcomes must be passed from frontend to backend at session start, and returned in tool calls. Without them, translation fails.

---

### 3.6 Skills-Based Outcomes Support (National 5+)

#### Overview

The Mastery + Evidence + Routine architecture supports two outcome formats:
1. **Traditional** (National 3/4): Unit-based with hierarchical outcomes and assessment standards
2. **Skills-Based** (National 5+): Flat skills framework with topics and atomic skills

#### Outcome ID Formats

**Traditional (National 3/4)**:
- Outcomes: `"O1"`, `"O2"`, `"O3"`
- Assessment Standards: `"AS1.1"`, `"AS1.2"`, `"AS2.1"`

**Skills-Based (National 5+)**:
- Topics: `"TOPIC_NUMERICAL_SKILLS"`, `"TOPIC_ALGEBRAIC_SKILLS"`
- Skills: `"SKILL_WORKING_WITH_SURDS"`, `"SKILL_ROUNDING"`

#### Composite Key Behavior

**Traditional Outcomes**:
- Tracks at two levels: outcome (`"O1"`) and AS (`"AS1.1"`) separately
- MasteryV2: `{"outcome_doc_id": 0.85, "outcome_doc_id#AS1.1": 0.90}`
- RoutineV2: `{"O1": "2025-01-20...", "AS1.1": "2025-01-22..."}`

**Skills-Based Outcomes**:
- Tracks only at topic/skill level (no sub-components)
- Topics and Skills ARE the atomic units (no composite keys needed)
- MasteryV2: `{"topic_doc_id": 0.75, "skill_doc_id": 0.85}`
- RoutineV2: `{"TOPIC_NUMERICAL_SKILLS": "2025-01-20...", "SKILL_WORKING_WITH_SURDS": "2025-01-22..."}`

#### Validation

**RoutineDriver Regex**: `/^[A-Z_]+(\d+(\.\d+)?)?$/`
- Accepts traditional: `"O1"`, `"AS1.1"` ✅
- Accepts skills-based: `"TOPIC_X"`, `"SKILL_X"` ✅

#### Detection Logic

Backend automatically detects course type:
```python
is_skills_based = outcome_id.startswith('TOPIC_') or outcome_id.startswith('SKILL_')
```

If skills-based:
- Skip composite key generation
- Track only at outcome level (topic or skill)
- No AS-level mastery tracking

#### Impact on Three Systems

1. **MasteryV2**:
   - Traditional: Stores both outcome and AS mastery
   - Skills-based: Stores only topic/skill mastery (no composite keys)

2. **Evidence**:
   - Unchanged (format-agnostic)
   - Stores raw student responses for both course types

3. **RoutineV2**:
   - Traditional: Schedules for outcomes and AS codes separately
   - Skills-based: Schedules for topics and skills (updated regex validation)

#### Frontend Compatibility

- **Enrichment**: Decimal-based filtering works for both formats
- **SpacedRepetitionService**: Decimal-based separation works for both formats
- **Translation Layer**: Uses enriched_outcomes (format-agnostic)

#### Example Data Flow

**Skills-Based Lesson Completion**:
```typescript
1. Student completes lesson targeting "SKILL_WORKING_WITH_SURDS"
2. Backend creates mastery update:
   {
     outcome_id: "doc_skill_surds_id",  // Document ID only
     score: 0.85
   }
3. Frontend translates to RoutineV2 key:
   "doc_skill_surds_id" → "SKILL_WORKING_WITH_SURDS"
4. RoutineDriver validates: ✅ PASSES (updated regex)
5. RoutineV2 stores:
   {
     "SKILL_WORKING_WITH_SURDS": "2025-01-22T10:00:00Z"
   }
6. SpacedRepetitionService reads:
   - Fetches "SKILL_WORKING_WITH_SURDS" from RoutineV2
   - Reverse translates to "doc_skill_surds_id"
   - Fetches mastery: 0.85
   - Generates recommendation
```

No composite keys created because backend detected `SKILL_` prefix.

---

## 4. Data Flow Diagrams

### 4.1 Lesson Completion Flow (Write Path)

```
┌─────────────────────────────────────────────────────────┐
│ Student completes lesson (answers all cards)           │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Backend: Calculate mastery updates                      │
│ File: teaching_utils.py:142-243                         │
│                                                          │
│ For each outcome in enriched_outcomes:                  │
│   1. Create outcome mastery: documentId → score         │
│   2. Parse assessmentStandards                          │
│   3. Create AS mastery: compositeKey → score            │
│                                                          │
│ Result: mastery_updates = [                             │
│   {outcome_id: "outcome_test_simple_o1", score: 1.0},   │
│   {outcome_id: "outcome_test_simple_o1#AS1.1", score: 1.0}│
│ ]                                                        │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Tool Call: lesson_completion_summary                    │
│ File: teacher_graph_toolcall_interrupt.py:387-408       │
│                                                          │
│ Args include:                                            │
│   - evidence (array of student responses)               │
│   - mastery_updates (with document IDs)                 │
│   - enriched_outcomes (for translation)                 │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend: LessonCompletionSummaryTool.tsx               │
│ Auto-persistence effect (lines 153-357)                 │
└────────────────────┬───────────────────────────────────┘
                     │
         ┌───────────┴───────────┬───────────┐
         ▼                       ▼           ▼
    ┌─────────┐          ┌──────────┐  ┌──────────┐
    │ Step 1  │          │  Step 2  │  │  Step 4  │
    │ Evidence│          │ MasteryV2│  │RoutineV2 │
    └─────────┘          └──────────┘  └──────────┘

STEP 1: Save Evidence (lines 211-221)
─────────────────────────────────────
const evidenceResults = await evidenceDriver.batchRecordEvidence(evidenceData);

Creates evidence records with:
  - sessionId, itemId, response
  - correct, attempts, confidence
  - reasoning, feedback, timestamp

STEP 2: Update MasteryV2 (lines 224-244)
─────────────────────────────────────
const emaUpdates = {};
mastery_updates.forEach(update => {
  emaUpdates[update.outcome_id] = update.score;
});

await masteryDriver.batchUpdateEMAs(student_id, course_id, emaUpdates);

Stores in MasteryV2.emaByOutcome:
  {
    "outcome_test_simple_o1": 1.0,
    "outcome_test_simple_o1#AS1.1": 1.0
  }

STEP 3: Translate Keys (lines 258-290)
───────────────────────────────────────
Build mapping from enriched_outcomes:
  documentIdToOutcomeId = {
    "outcome_test_simple_o1" → "O1",
    "outcome_test_simple_o1#AS1.1" → "AS1.1"
  }

STEP 4: Update RoutineV2 (lines 292-320)
─────────────────────────────────────────
for (const masteryUpdate of mastery_updates) {
  const stringRef = documentIdToOutcomeId.get(masteryUpdate.outcome_id);

  if (!stringRef) {
    console.warn("⚠️ No string ref found, skipping");
    continue;
  }

  await routineDriver.updateOutcomeSchedule(
    student_id,
    course_id,
    stringRef,  // ✅ "O1" or "AS1.1"
    masteryUpdate.score
  );
}

Stores in RoutineV2.dueAtByOutcome:
  {
    "O1": "2025-11-19T17:12:37.353Z",
    "AS1.1": "2025-11-19T17:12:37.850Z"
  }
```

### 4.2 Spaced Repetition Flow (Read Path)

```
┌─────────────────────────────────────────────────────────┐
│ Student opens Dashboard                                  │
│ File: StudentDashboard.tsx                              │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ SpacedRepetitionPanel component loads                   │
│ File: SpacedRepetitionPanel.tsx                         │
│                                                          │
│ useEffect(() => {                                        │
│   loadRecommendations();                                │
│ }, [studentId, courseId]);                              │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Call: getReviewRecommendations()                        │
│ File: spaced-repetition-service.ts:69-151               │
└────────────────────┬───────────────────────────────────┘
                     │
         ┌───────────┴────────────┬─────────────┐
         ▼                        ▼             ▼
    ┌─────────┐          ┌──────────────┐  ┌─────────┐
    │RoutineV2│          │buildOutcome  │  │MasteryV2│
    │         │          │IdMapping()   │  │         │
    └─────────┘          └──────────────┘  └─────────┘

STEP 1: Get Overdue Outcomes from RoutineV2 (lines 82-89)
──────────────────────────────────────────────────────────
const overdueOutcomes = await routineDriver.getOverdueOutcomes(studentId, courseId);

Returns:
  [
    {outcomeId: "O1", dueAt: "2025-11-10...", isOverdue: true},
    {outcomeId: "AS1.1", dueAt: "2025-11-11...", isOverdue: true}
  ]

STEP 2: Build Translation Mapping (lines 92-93)
────────────────────────────────────────────────
const outcomeIds = overdueOutcomes.map(o => o.outcomeId);  // ["O1", "AS1.1"]
const outcomeMapping = await buildOutcomeIdMapping(outcomeIds, courseId, databases);

Returns:
  Map {
    "O1" → "outcome_test_simple_o1",
    "AS1.1" → "outcome_test_simple_o1#AS1.1"
  }

STEP 3: Get Mastery Data from MasteryV2 (lines 96-97)
──────────────────────────────────────────────────────
const masteryData = await masteryDriver.getMasteryV2(studentId, courseId);
const emaByOutcome = masteryData?.emaByOutcome || {};

Returns:
  {
    "outcome_test_simple_o1": 0.85,
    "outcome_test_simple_o1#AS1.1": 0.90
  }

STEP 4: Enrich Outcomes with Mastery (lines 107-123)
─────────────────────────────────────────────────────
const enrichedOutcomes = overdueOutcomes.map(outcome => {
  const documentId = outcomeMapping.get(outcome.outcomeId);  // Translate key
  const currentEMA = documentId ? (emaByOutcome[documentId] || 0.3) : 0.3;

  return {
    outcomeId: outcome.outcomeId,  // "O1" or "AS1.1"
    dueAt: outcome.dueAt,
    daysOverdue: calculateDaysOverdue(outcome.dueAt),
    currentEMA: currentEMA,        // Actual mastery from MasteryV2
    masteryLevel: getMasteryLevel(currentEMA)
  };
});

STEP 5: Find Lessons Teaching Overdue Outcomes (lines 128-134)
───────────────────────────────────────────────────────────────
const lessonRecommendations = await findLessonsForOutcomes(
  enrichedOutcomes,
  courseId,
  studentId,
  databases
);

Queries lesson_templates and sessions to find:
  - Which lessons teach these outcomes
  - When they were last completed
  - Calculate priority scores

STEP 6: Calculate Priority and Sort (lines 138-141)
────────────────────────────────────────────────────
const rankedRecommendations = lessonRecommendations
  .map(rec => calculatePriority(rec))
  .sort((a, b) => b.priority - a.priority)
  .slice(0, limit);

Returns top N recommendations sorted by urgency

STEP 7: Display in UI
─────────────────────
SpacedRepetitionPanel renders:
  - Stats overview (overdue count, critical count)
  - Ranked lesson cards with:
    * Mastery percentage (from enriched outcomes)
    * Overdue topics count
    * Urgency badge
    * "Review" button
```

### 4.3 Assessment Standard Tracking Flow

```
┌────────────────────────────────────────────────────────┐
│ Lesson Template                                        │
│ outcomeRefs: ["O1", "AS1.1", "AS1.2"]                 │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Frontend extracts outcomeIds (no decimals)             │
│ File: CourseOutcomesDriver.ts:78-123                   │
│                                                         │
│ extractOutcomeIds(["O1", "AS1.1"]) → ["O1"]           │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Fetch CourseOutcome records                            │
│                                                         │
│ getOutcomesByIds(courseId, ["O1"])                    │
│                                                         │
│ Returns:                                                │
│ [{                                                      │
│   $id: "outcome_test_simple_o1",                       │
│   outcomeId: "O1",                                     │
│   assessmentStandards: "[                              │
│     {\"code\":\"AS1.1\",\"description\":\"...\"},     │
│     {\"code\":\"AS1.2\",\"description\":\"...\"}      │
│   ]"                                                    │
│ }]                                                      │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Pass enriched_outcomes to backend via session_context  │
│ File: SessionChatAssistant.tsx                         │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Backend creates mastery updates                        │
│ File: teaching_utils.py:196-243                        │
│                                                         │
│ for outcome in enriched_outcomes:                      │
│   # 1. Outcome-level mastery                           │
│   mastery_updates.append({                             │
│     outcome_id: "outcome_test_simple_o1",              │
│     score: 1.0                                          │
│   })                                                    │
│                                                         │
│   # 2. Parse assessmentStandards                       │
│   as_list = json.loads(outcome.assessmentStandards)    │
│                                                         │
│   # 3. AS-level mastery (composite keys)               │
│   for as_obj in as_list:                               │
│     composite_key = f"{outcome.$id}#{as_obj.code}"     │
│     mastery_updates.append({                           │
│       outcome_id: "outcome_test_simple_o1#AS1.1",      │
│       score: 1.0                                        │
│     })                                                  │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ Frontend receives mastery_updates + enriched_outcomes  │
│                                                         │
│ Translation layer uses enriched_outcomes to map:       │
│   "outcome_test_simple_o1#AS1.1" → "AS1.1"            │
│                                                         │
│ Stores in RoutineV2:                                   │
│   {"AS1.1": "2025-11-19..."}                          │
│                                                         │
│ Spaced repetition service uses same enriched_outcomes  │
│ to reverse map:                                        │
│   "AS1.1" → "outcome_test_simple_o1#AS1.1"            │
│                                                         │
│ Looks up mastery in MasteryV2:                         │
│   emaByOutcome["outcome_test_simple_o1#AS1.1"] = 1.0  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Critical Implementation Details

### 5.1 Composite Key System

**Format**: `{documentId}#{asCode}`

**Example**: `"outcome_test_simple_o1#AS1.1"`

**Purpose**: Track mastery at both outcome level and individual assessment standard level

**Why Needed?**

Students might:
- Master an overall outcome (O1 = "Simplify fractions") at 0.85
- But struggle with a specific standard (AS1.2 = "Convert improper fractions") at 0.4

Composite keys allow granular tracking and targeted review recommendations.

**How to Parse**:

```typescript
function parseCompositeMasteryKey(key: string): {
  isComposite: boolean;
  documentId: string;
  asCode?: string;
} {
  if (key.includes('#')) {
    const [documentId, asCode] = key.split('#');
    return {
      isComposite: true,
      documentId: documentId.trim(),
      asCode: asCode.trim()
    };
  }
  return {
    isComposite: false,
    documentId: key
  };
}

// Usage
const parsed = parseCompositeMasteryKey("outcome_test_simple_o1#AS1.1");
// { isComposite: true, documentId: "outcome_test_simple_o1", asCode: "AS1.1" }
```

**How to Create**:

```python
# Backend (Python)
composite_key = f"{outcome['$id']}#{as_code}"

# Frontend (TypeScript)
const compositeKey = `${outcome.$id}#${asCode}`;
```

**Validation**:

RoutineDriver **rejects** composite keys to enforce translation:

```typescript
// RoutineDriver.ts:284-289
if (outcomeId.includes('#')) {
  throw new Error(
    `Invalid outcomeId (composite key): '${outcomeId}'. ` +
    `RoutineV2 expects string refs (e.g., "O1", "AS1.1"), not composite keys. ` +
    `Caller must parse composite keys and extract AS code.`
  );
}
```

### 5.2 Translation Function Reference

#### Write Path: LessonCompletionSummaryTool.tsx (Lines 258-320)

```typescript
// Build reverse mapping: documentId → outcomeId (string ref)
const documentIdToOutcomeId = new Map<string, string>();

if (enriched_outcomes && enriched_outcomes.length > 0) {
  enriched_outcomes.forEach((outcome: any) => {
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
for (const masteryUpdate of mastery_updates) {
  try {
    const masteryKey = masteryUpdate.outcome_id;
    const stringRef = documentIdToOutcomeId.get(masteryKey);

    if (!stringRef) {
      console.warn(`⚠️ No string ref found for mastery key: ${masteryKey}, skipping RoutineV2 update`);
      continue;
    }

    console.log(`✅ Translating mastery key: ${masteryKey} → ${stringRef}`);

    await routineDriver.updateOutcomeSchedule(
      student_id,
      course_id,
      stringRef,  // ✅ CORRECT: Now using string ref ("O1", "AS1.1")
      masteryUpdate.score
    );
  } catch (error) {
    console.error(`Failed to update schedule for outcome ${masteryUpdate.outcome_id}:`, error);
  }
}
```

**Console Logs to Watch For**:

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

#### Read Path: spaced-repetition-service.ts (Lines 315-404)

```typescript
async function buildOutcomeIdMapping(
  outcomeIds: string[],
  courseId: string,
  databases: Databases
): Promise<Map<string, string>> {
  const outcomeDriver = new CourseOutcomesDriver(databases);
  const mapping = new Map<string, string>();

  try {
    // 1. Separate outcome IDs from AS codes (AS codes contain decimal point)
    const outcomeIdsOnly = outcomeIds.filter(id => !id.includes('.'));  // ["O1"]
    const asCodesOnly = outcomeIds.filter(id => id.includes('.'));      // ["AS1.1"]

    console.log(`[SpacedRepetition] Separating IDs:`, {
      total: outcomeIds.length,
      outcomeIdsOnly: outcomeIdsOnly.length,
      asCodesOnly: asCodesOnly.length,
      outcomeIds: outcomeIdsOnly,
      asCodes: asCodesOnly
    });

    // 2. Handle outcome IDs
    if (outcomeIdsOnly.length > 0) {
      const outcomes = await outcomeDriver.getOutcomesByIds(courseId, outcomeIdsOnly);

      outcomes.forEach(outcome => {
        const outcomeId = outcome.outcomeId;
        const documentId = outcome.$id;
        mapping.set(outcomeId, documentId);
        console.log(`[SpacedRepetition] Mapped outcome: ${outcomeId} → ${documentId}`);
      });
    }

    // 3. Handle AS codes (search through outcomes' assessmentStandards)
    if (asCodesOnly.length > 0) {
      const allOutcomes = await outcomeDriver.getOutcomesByIds(courseId, outcomeIdsOnly);

      console.log(`[SpacedRepetition] Fetched ${allOutcomes.length} outcomes to search for AS codes`);

      for (const asCode of asCodesOnly) {
        let found = false;

        for (const outcome of allOutcomes) {
          const asListJson = outcome.assessmentStandards || "[]";
          try {
            const asList = typeof asListJson === 'string' ? JSON.parse(asListJson) : asListJson;

            if (Array.isArray(asList)) {
              const hasAS = asList.some((as: any) => as.code === asCode);

              if (hasAS) {
                // Found it! Create composite key mapping
                const compositeKey = `${outcome.$id}#${asCode}`;
                mapping.set(asCode, compositeKey);
                console.log(`[SpacedRepetition] Mapped AS code: ${asCode} → ${compositeKey}`);
                found = true;
                break;
              }
            }
          } catch (e) {
            console.warn(`[SpacedRepetition] Failed to parse assessmentStandards for ${outcome.$id}:`, e);
          }
        }

        if (!found) {
          console.warn(`[SpacedRepetition] Could not find outcome containing AS code: ${asCode}`);
        }
      }
    }

    console.log(`[SpacedRepetition] Built outcomeId mapping:`, {
      requestedIds: outcomeIds.length,
      outcomeIdsOnly: outcomeIdsOnly.length,
      asCodesOnly: asCodesOnly.length,
      foundIds: mapping.size,
      mappings: Object.fromEntries(mapping)
    });

    return mapping;
  } catch (error) {
    console.error('[SpacedRepetition] Failed to build outcome mapping:', error);
    return mapping;
  }
}
```

**Console Logs to Watch For**:

```
[SpacedRepetition] Separating IDs: {
  total: 2,
  outcomeIdsOnly: 1,
  asCodesOnly: 1,
  outcomeIds: ["O1"],
  asCodes: ["AS1.1"]
}
[SpacedRepetition] Mapped outcome: O1 → outcome_test_simple_o1
[SpacedRepetition] Fetched 1 outcomes to search for AS codes
[SpacedRepetition] Mapped AS code: AS1.1 → outcome_test_simple_o1#AS1.1
🔍 [SpacedRepetition EMA Lookup] outcomeId="O1", documentId="outcome_test_simple_o1", found=true, ema=1.0
🔍 [SpacedRepetition EMA Lookup] outcomeId="AS1.1", documentId="outcome_test_simple_o1#AS1.1", found=true, ema=1.0
```

### 5.3 Fail-Fast Validation

**Philosophy**: **No fallbacks, only fast failures with descriptive errors**

**Why?**
- Fallbacks hide bugs and cause silent data corruption
- Fail-fast guides developers to fix the root cause
- Clear error messages act as documentation

**Validation in RoutineDriver** (`RoutineDriver.ts:279-309`):

```typescript
async updateOutcomeSchedule(studentId: string, courseId: string, outcomeId: string, newEMA: number): Promise<any> {
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

  // ... rest of method
}
```

**Error Message Design**:
1. States what's wrong
2. Explains what's expected
3. Guides developer to fix

---

## 6. Recent Fixes and Why They Matter

### 6.1 Composite Key Mastery Tracking (November 2025)

**Problem**: Only outcome-level mastery was tracked. Assessment standards were ignored.

**Symptom**:
- Lesson has outcome O1 with standards AS1.1, AS1.2
- Student masters AS1.1 (100%) but struggles with AS1.2 (30%)
- System only tracked O1 = 65% (average)
- Lost granular insight

**Solution**: Track assessment standards separately using composite keys

**Implementation**: `teaching_utils.py:196-243`

```python
for outcome in enriched_outcomes:
    # 1. Create outcome-level mastery update
    mastery_update = _create_mastery_update(outcome, score)
    mastery_updates.append(mastery_update)

    # 2. Parse embedded assessmentStandards and create AS-level mastery (NEW)
    as_list_json = outcome.get("assessmentStandards", "[]")

    try:
        as_list = json.loads(as_list_json) if isinstance(as_list_json, str) else as_list_json

        if isinstance(as_list, list) and len(as_list) > 0:
            for as_obj in as_list:
                as_code = as_obj.get("code")  # "AS1.1"

                if as_code:
                    composite_key = f"{outcome['$id']}#{as_code}"

                    as_mastery_update = {
                        "outcome_id": composite_key,  # "outcome_test_simple_o1#AS1.1"
                        "score": score,
                        "timestamp": datetime.now().isoformat()
                    }

                    mastery_updates.append(as_mastery_update)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse assessmentStandards: {e}")
        continue
```

**Impact**:
- Spaced repetition can now recommend review of specific standards
- More targeted learning interventions
- Better visibility into student strengths/weaknesses

**Spec Document**: `tasks/composite-key-mastery-tracking-spec.md`

### 6.2 RoutineV2 Key Format Translation (November 2025)

**Problem**: LessonCompletionSummaryTool passed document IDs directly to RoutineDriver

**Symptom**:
- MasteryV2: `{"outcome_test_simple_o1": 1.0}`
- RoutineV2: `{"outcome_test_simple_o1": "2025-11-19..."}` ❌ Wrong format!
- Created duplicate keys: `{"O1": "...", "outcome_test_simple_o1": "..."}`
- SpacedRepetitionService looked up "O1", found old entry with wrong interval

**Solution**: Add translation layer before calling RoutineDriver

**Files Changed**:

1. **Backend** (`teacher_graph_toolcall_interrupt.py:406-407`):
   - Added `enriched_outcomes` to tool call args

2. **Frontend Type** (`LessonCompletionSummaryTool.tsx:108-112`):
   - Added `enriched_outcomes` to TypeScript interface

3. **Frontend Logic** (`LessonCompletionSummaryTool.tsx:258-320`):
   - Build `documentId → outcomeId` mapping from enriched outcomes
   - Parse composite keys: `"outcome_test_simple_o1#AS1.1"` → `"AS1.1"`
   - Translate before calling `updateOutcomeSchedule()`

4. **Validation** (`RoutineDriver.ts:279-309`):
   - Added 4 validation checks to reject invalid formats
   - Descriptive error messages guide callers

**Impact**:
- No more duplicate keys in RoutineV2
- Correct spaced repetition intervals
- Fail-fast prevents silent bugs

**Spec Document**: `tasks/routine-v2-key-format-fix-spec.md`

### 6.3 SpacedRepetitionService AS Code Mapping (November 2025)

**Problem**: `buildOutcomeIdMapping()` only handled outcomes, not AS codes

**Symptom**:
- RoutineV2: `{"O1": "...", "AS1.1": "..."}`
- buildOutcomeIdMapping(["O1", "AS1.1"]) only mapped "O1"
- "AS1.1" had no mapping → defaulted to 0.3 mastery
- Dashboard showed 65% mastery instead of 100%

**Solution**: Enhanced mapping function to handle AS codes

**Implementation**: `spaced-repetition-service.ts:315-404`

**Key Change**:
```typescript
// Separate outcomes from AS codes
const outcomeIdsOnly = outcomeIds.filter(id => !id.includes('.'));  // ["O1"]
const asCodesOnly = outcomeIds.filter(id => id.includes('.'));      // ["AS1.1"]

// For each AS code, search through outcomes' assessmentStandards
for (const asCode of asCodesOnly) {
  for (const outcome of allOutcomes) {
    const asList = JSON.parse(outcome.assessmentStandards || "[]");
    const hasAS = asList.some((as: any) => as.code === asCode);

    if (hasAS) {
      const compositeKey = `${outcome.$id}#${asCode}`;
      mapping.set(asCode, compositeKey);  // "AS1.1" → "outcome_test_simple_o1#AS1.1"
      break;
    }
  }
}
```

**Impact**:
- Correct mastery percentages in spaced repetition panel
- Students see accurate progress (100% instead of 65%)
- Proper review prioritization

---

## 7. Common Issues and Troubleshooting

### Issue 1: Wrong Spaced Repetition Interval

**Symptom**:
- Student has 0.3 mastery
- Expected interval: 1 day
- Actual interval shown: 7 days

**Root Cause**: Key mismatch between MasteryV2 and RoutineV2

**Debug Steps**:

1. **Check RoutineV2 document** in Appwrite:
   ```json
   {
     "dueAtByOutcome": "{\"O1\":\"2025-11-19...\",\"outcome_test_simple_o1\":\"2025-11-13...\"}"
   }
   ```
   ❌ Problem: Has both "O1" (correct) and "outcome_test_simple_o1" (wrong)

2. **Check console logs** for mapping:
   ```
   🔑 Document ID → Outcome ID mapping: {}
   ⚠️ No string ref found for mastery key: outcome_test_simple_o1
   ```
   ❌ Problem: Translation layer not working

3. **Verify enriched_outcomes** passed from backend:
   ```typescript
   console.log('enriched_outcomes:', enriched_outcomes);
   ```
   If `undefined` or `[]` → Backend not passing data

**Fix**:
- Ensure backend includes `enriched_outcomes` in tool call (line 407)
- Verify frontend session context sets enriched_outcomes
- Delete corrupt RoutineV2 document and re-complete lesson

### Issue 2: Incorrect Mastery Percentage

**Symptom**:
- MasteryV2 shows: `{"outcome_test_simple_o1": 1.0, "outcome_test_simple_o1#AS1.1": 1.0}`
- Dashboard shows: **~65% mastery** instead of 100%

**Root Cause**: AS codes not mapped to composite keys in SpacedRepetitionService

**Debug Steps**:

1. **Check console logs** for buildOutcomeIdMapping:
   ```
   [SpacedRepetition] Separating IDs: {
     outcomeIdsOnly: 1,
     asCodesOnly: 1,
     asCodes: ["AS1.1"]
   }
   [SpacedRepetition] Fetched 1 outcomes to search for AS codes
   ⚠️ Could not find outcome containing AS code: AS1.1
   ```
   ❌ Problem: Can't find which outcome contains AS1.1

2. **Check CourseOutcome record** in Appwrite:
   ```json
   {
     "$id": "outcome_test_simple_o1",
     "outcomeId": "O1",
     "assessmentStandards": "[]"  ❌ Empty!
   }
   ```
   Missing or empty `assessmentStandards` field

**Fix**:
- Ensure CourseOutcome records have populated `assessmentStandards` field
- Re-seed course_outcomes collection with correct data
- Verify frontend parsing logic in buildOutcomeIdMapping

### Issue 3: Empty Routine Document

**Symptom**:
- Dashboard spaced repetition panel shows "No reviews scheduled yet"
- Student has completed lessons

**Root Cause**: Routine not created yet (lazy initialization)

**Debug Steps**:

1. **Check RoutineV2 collection** in Appwrite:
   - Query: `studentId = <student_id> AND courseId = <course_id>`
   - Result: No documents found

2. **Check session completion**:
   - Sessions collection shows `status = "completed"`
   - But no routine created

**Fix**:
- RoutineV2 uses **lazy initialization** - created on first lesson completion
- Complete a lesson to trigger routine creation
- Verify `updateOutcomeSchedule()` is called in LessonCompletionSummaryTool (line 306)

**Expected Behavior**:
- First lesson completion → creates routine document
- Subsequent completions → updates existing document

### Issue 4: Validation Errors

**Symptom**:
```
Error: Invalid outcomeId (composite key): 'outcome_test_simple_o1#AS1.1'.
RoutineV2 expects string refs (e.g., "O1", "AS1.1"), not composite keys.
Caller must parse composite keys and extract AS code.
```

**Root Cause**: Passing composite key directly to RoutineDriver without translation

**Debug Steps**:

1. **Check translation layer** in LessonCompletionSummaryTool:
   ```typescript
   console.log("🔑 Document ID → Outcome ID mapping:", Object.fromEntries(documentIdToOutcomeId));
   ```
   If mapping is empty → enriched_outcomes not available

2. **Check console logs** for skip warning:
   ```
   ⚠️ No string ref found for mastery key: outcome_test_simple_o1#AS1.1, skipping RoutineV2 update
   ```
   This indicates translation failed (mapping missing AS code)

**Fix**:
- Verify `enriched_outcomes` contains `assessmentStandards` data
- Check composite key parsing logic (lines 269-285)
- Ensure `asList.forEach()` loop iterates correctly

### Issue 5: First Review Shows 7 Days (Not a Bug!)

**Symptom**:
- Student completes lesson with 100% mastery
- Expected: "Due 30d" (mastered)
- Actual: "Due 7d"

**Root Cause**: This is **intentional behavior** (not a bug!)

**Explanation**:

The spaced repetition algorithm uses **progressive interval expansion**:

```typescript
// First completion: daysSinceLastReview = 1 (default)
if (currentEMA >= 0.8) {
  intervalDays = Math.max(7, daysSinceLastReview * 2);  // max(7, 1*2) = 7
}
```

**Why 7 days minimum?**
- Based on memory retention research
- Even perfectly learned material needs initial review within a week
- Prevents forgetting before long-term consolidation
- Intervals expand with successful reviews: 7d → 14d → 28d → 30d

**This is correct behavior** - not a bug to fix!

---

## 8. Developer Onboarding Guide

### 8.1 Quick Start

**Step 1: Read Core Sections** (30 minutes)
- [Section 1: Executive Summary](#1-executive-summary)
- [Section 2: Data Model Specifications](#2-data-model-specifications)
- [Section 3: Key Format Translation Architecture](#3-key-format-translation-architecture)

**Step 2: Run a Test Lesson** (15 minutes)
1. Start application: `./langgraph-agent/start.sh`
2. Login as test user: `test@scottishailessons.com` / `red12345`
3. Complete "Simple Addition" lesson
4. Open browser DevTools console
5. Watch for key console logs:
   ```
   🔑 Document ID → Outcome ID mapping
   ✅ Translating mastery key
   ✅ RoutineDriver: Valid outcomeId format
   ```

**Step 3: Inspect Data** (15 minutes)

Open Appwrite console and check:

**MasteryV2**:
```json
{
  "emaByOutcome": "{\"outcome_test_simple_o1\":1,\"outcome_test_simple_o1#AS1.1\":1}"
}
```

**Evidence**:
```json
{
  "sessionId": "session_...",
  "correct": true,
  "attempts": 1
}
```

**RoutineV2**:
```json
{
  "dueAtByOutcome": "{\"O1\":\"2025-11-19...\",\"AS1.1\":\"2025-11-19...\"}"
}
```

**Step 4: Trace Data Flow** (30 minutes)
1. Read [Section 4.1: Lesson Completion Flow](#41-lesson-completion-flow-write-path)
2. Follow one mastery update through all three systems
3. Verify key transformations at each step

**Step 5: Test Spaced Repetition** (15 minutes)
1. Manually update RoutineV2 `dueAtByOutcome` to past date
2. Refresh dashboard
3. Verify recommendation appears
4. Check console logs for mapping
5. Read [Section 4.2: Spaced Repetition Flow](#42-spaced-repetition-flow-read-path)

### 8.2 Debugging Checklist

#### Enable Console Logging Filters

In browser DevTools console, filter by:
- `SpacedRepetition` - Read path logs
- `Routine Debug` - Write path logs
- `MASTERY DEBUG` - Backend mastery creation
- `🔑` - Translation mapping logs
- `✅` - Success confirmations
- `⚠️` - Warnings (key missing, etc.)

#### Key Console Log Patterns

**Successful Lesson Completion**:
```
🔍 LessonCompletionSummaryTool received args
📝 Starting evidence persistence
✅ Successfully persisted N evidence records
🎯 Starting MasteryV2 EMA updates persistence
🔑 Document ID → Outcome ID mapping: {...}
✅ Translating mastery key: outcome_test_simple_o1 → O1
✅ RoutineDriver: Valid outcomeId format: O1
✅ Updated routine schedule for outcome O1
```

**Successful Spaced Repetition Load**:
```
[SpacedRepetition] Getting review recommendations
[SpacedRepetition] Found N overdue outcomes
[SpacedRepetition] Separating IDs: {...}
[SpacedRepetition] Mapped outcome: O1 → outcome_test_simple_o1
[SpacedRepetition] Mapped AS code: AS1.1 → outcome_test_simple_o1#AS1.1
🔍 [SpacedRepetition EMA Lookup] outcomeId="O1", documentId="...", found=true, ema=1.0
```

**Translation Failure (Warning)**:
```
⚠️ No string ref found for mastery key: outcome_test_simple_o1, skipping RoutineV2 update
```
→ Check enriched_outcomes availability

**AS Code Not Found (Warning)**:
```
⚠️ Could not find outcome containing AS code: AS1.1
```
→ Check CourseOutcome.assessmentStandards field

#### Using Appwrite Console

**Quick Queries**:

```sql
-- Find student's mastery data
SELECT * FROM MasteryV2
WHERE studentId = '<student_id>'
AND courseId = '<course_id>'

-- Find student's routine
SELECT * FROM Routine
WHERE studentId = '<student_id>'
AND courseId = '<course_id>'

-- Find lesson evidence
SELECT * FROM evidence
WHERE sessionId = '<session_id>'
ORDER BY timestamp DESC
```

**Inspect JSON Fields**:
```javascript
// Parse emaByOutcome
const mastery = JSON.parse(masteryDoc.emaByOutcome);
console.table(mastery);

// Parse dueAtByOutcome
const routine = JSON.parse(routineDoc.dueAtByOutcome);
console.table(routine);
```

### 8.3 Making Changes Safely

#### Rule 1: Update All Three Systems Together

**Bad Example**:
```typescript
// ❌ Only updating MasteryV2, forgetting RoutineV2
await masteryDriver.batchUpdateEMAs(studentId, courseId, emaUpdates);
// Routine schedule never updates!
```

**Good Example**:
```typescript
// ✅ Update both in sequence
await masteryDriver.batchUpdateEMAs(studentId, courseId, emaUpdates);

for (const update of mastery_updates) {
  const stringRef = documentIdToOutcomeId.get(update.outcome_id);
  await routineDriver.updateOutcomeSchedule(studentId, courseId, stringRef, update.score);
}
```

#### Rule 2: Test Write AND Read Paths

When changing mastery tracking:

**Write Path Test**:
1. Complete a lesson
2. Check console logs for translation
3. Verify all three collections updated
4. Verify key formats correct

**Read Path Test**:
1. Refresh dashboard
2. Check spaced repetition panel
3. Verify mastery percentages correct
4. Verify review intervals correct

#### Rule 3: Verify Key Format Translation

**Checklist**:
- [ ] Backend passes `enriched_outcomes` in tool call
- [ ] Frontend receives `enriched_outcomes` in args
- [ ] Write path builds `documentId → stringRef` mapping
- [ ] Write path translates before calling RoutineDriver
- [ ] Read path builds `stringRef → documentId` mapping
- [ ] Read path uses mapping for mastery lookup

#### Rule 4: Check Both Outcomes and AS Codes

Don't forget assessment standards!

**Incomplete Test**:
```typescript
// ❌ Only testing outcome, forgetting AS
const mapping = buildOutcomeIdMapping(["O1"], courseId, databases);
```

**Complete Test**:
```typescript
// ✅ Test both outcomes and AS codes
const mapping = buildOutcomeIdMapping(["O1", "AS1.1"], courseId, databases);

expect(mapping.get("O1")).toBe("outcome_test_simple_o1");
expect(mapping.get("AS1.1")).toBe("outcome_test_simple_o1#AS1.1");
```

---

## 9. Code Reference Index

### Backend (Python)

| Function/Section | File | Lines | Purpose |
|------------------|------|-------|---------|
| Mastery calculation | `teaching_utils.py` | 93-95 | Calculate score from correctness/attempts |
| Create mastery update | `teaching_utils.py` | 98-139 | Create outcome-level mastery update |
| Update mastery scores | `teaching_utils.py` | 142-243 | Create outcome + AS mastery updates |
| Composite key creation | `teaching_utils.py` | 220-233 | Generate composite keys for AS codes |
| Enriched outcomes | `graph_interrupt.py` | 407 | Pass enriched_outcomes to tool call |

### Frontend (TypeScript)

**LessonCompletionSummaryTool.tsx**:
| Function/Section | Lines | Purpose |
|------------------|-------|---------|
| Type definition | 71-113 | Args interface with enriched_outcomes |
| Args destructuring | 128-141 | Extract enriched_outcomes from args |
| Routine updates | 253-320 | Translate keys and update RoutineV2 |
| Key translation | 258-290 | Build documentId → outcomeId mapping |
| Mastery loop | 292-320 | Translate and call updateOutcomeSchedule |

**spaced-repetition-service.ts**:
| Function/Section | Lines | Purpose |
|------------------|-------|---------|
| Get recommendations | 69-151 | Main entry point for spaced repetition |
| Build mapping | 315-404 | Translate outcomeId → documentId |
| Separate IDs | 324-334 | Split outcomes from AS codes |
| Map outcomes | 336-346 | Handle outcome IDs |
| Map AS codes | 348-388 | Search for AS codes in outcomes |
| Enrich outcomes | 107-123 | Lookup mastery using mapping |

**RoutineDriver.ts**:
| Function/Section | Lines | Purpose |
|------------------|-------|---------|
| Update schedule | 278-332 | Update due date for outcome |
| Validation | 279-309 | Reject invalid key formats |
| Calculate interval | 245-273 | Spaced repetition algorithm |

**SpacedRepetitionPanel.tsx**:
| Function/Section | Lines | Purpose |
|------------------|-------|---------|
| Component | 36-208 | Main panel UI |
| Upcoming card | 322-392 | Individual review card display |
| Mastery percentage | 340 | Calculate percentage from EMA |

---

## 10. Appendices

### Appendix A: Related Specifications

**Primary Specs**:
1. `tasks/composite-key-mastery-tracking-spec.md` - Composite key system design
2. `tasks/routine-v2-key-format-fix-spec.md` - Translation layer specification
3. `tasks/mastery-v2-document-id-fix-spec.md` - Document ID migration

**Related Docs**:
1. `docs/SPACED_REPETITION_IMPLEMENTATION_SUMMARY.md` - High-level feature summary
2. `docs/appwrite-data-model.md` - Complete database schema

### Appendix B: Data Examples

**Example 1: Successful Lesson Completion**

**MasteryV2 Document**:
```json
{
  "$id": "67890abc123_mastery_C844_73",
  "studentId": "67890abc123",
  "courseId": "C844 73",
  "emaByOutcome": "{\"outcome_test_simple_o1\":0.85,\"outcome_test_simple_o1#AS1.1\":0.90,\"outcome_test_simple_o1#AS1.2\":0.75}",
  "lastUpdated": "2025-11-12T14:30:00.000Z",
  "schema_version": 2
}
```

**RoutineV2 Document**:
```json
{
  "$id": "67890abc123_routine_C844_73",
  "studentId": "67890abc123",
  "courseId": "C844 73",
  "dueAtByOutcome": "{\"O1\":\"2025-11-19T17:12:37.353Z\",\"AS1.1\":\"2025-11-19T17:12:37.850Z\",\"AS1.2\":\"2025-11-13T15:46:50.776Z\"}",
  "lastTaughtAt": "2025-11-12T14:30:00.000Z",
  "spacingPolicyVersion": 1,
  "schema_version": 1
}
```

**Evidence Records**:
```json
[
  {
    "$id": "evidence_001",
    "sessionId": "session_abc123",
    "itemId": "card_01",
    "response": "1/5",
    "correct": true,
    "attempts": 1,
    "confidence": 0.95,
    "reasoning": "The student correctly simplified 2/10 to 1/5.",
    "feedback": "Perfect! You simplified the fraction correctly on your first try.",
    "timestamp": "2025-11-12T14:25:00.000Z",
    "partialCredit": 1.0,
    "maxAttemptsReached": false
  },
  {
    "$id": "evidence_002",
    "sessionId": "session_abc123",
    "itemId": "card_02",
    "response": "0.5",
    "correct": true,
    "attempts": 2,
    "confidence": 0.85,
    "reasoning": "The student converted 1/2 to 0.5 after one retry.",
    "feedback": "Good work! You got it on your second attempt.",
    "timestamp": "2025-11-12T14:26:30.000Z",
    "partialCredit": 1.0,
    "maxAttemptsReached": false
  }
]
```

**Example 2: Translation Examples**

**Write Path (Lesson Completion)**:
```
Input (MasteryV2 keys):
  - "outcome_test_simple_o1"
  - "outcome_test_simple_o1#AS1.1"
  - "outcome_test_simple_o1#AS1.2"

Mapping (from enriched_outcomes):
  "outcome_test_simple_o1" → "O1"
  "outcome_test_simple_o1#AS1.1" → "AS1.1"
  "outcome_test_simple_o1#AS1.2" → "AS1.2"

Output (RoutineV2 keys):
  - "O1"
  - "AS1.1"
  - "AS1.2"
```

**Read Path (Spaced Repetition)**:
```
Input (RoutineV2 keys):
  - "O1"
  - "AS1.1"
  - "AS1.2"

Mapping (from CourseOutcome query):
  "O1" → "outcome_test_simple_o1"
  "AS1.1" → "outcome_test_simple_o1#AS1.1"
  "AS1.2" → "outcome_test_simple_o1#AS1.2"

Output (MasteryV2 lookup):
  emaByOutcome["outcome_test_simple_o1"] = 0.85
  emaByOutcome["outcome_test_simple_o1#AS1.1"] = 0.90
  emaByOutcome["outcome_test_simple_o1#AS1.2"] = 0.75
```

### Appendix C: Testing Scenarios

**Test 1: Complete Lesson with AS Codes**

```typescript
describe('Lesson completion with assessment standards', () => {
  it('should create mastery updates for outcomes and AS codes', async () => {
    // 1. Setup enriched_outcomes
    const enrichedOutcomes = [{
      $id: "outcome_test_simple_o1",
      outcomeId: "O1",
      assessmentStandards: JSON.stringify([
        { code: "AS1.1", description: "..." },
        { code: "AS1.2", description: "..." }
      ])
    }];

    // 2. Complete lesson with 100% score
    const result = await completeLessonWithScore(1.0, enrichedOutcomes);

    // 3. Verify MasteryV2 updated
    const mastery = await getMasteryV2(studentId, courseId);
    const emaByOutcome = JSON.parse(mastery.emaByOutcome);

    expect(emaByOutcome["outcome_test_simple_o1"]).toBe(1.0);
    expect(emaByOutcome["outcome_test_simple_o1#AS1.1"]).toBe(1.0);
    expect(emaByOutcome["outcome_test_simple_o1#AS1.2"]).toBe(1.0);

    // 4. Verify RoutineV2 updated with string refs
    const routine = await getRoutineV2(studentId, courseId);
    const dueAtByOutcome = JSON.parse(routine.dueAtByOutcome);

    expect(dueAtByOutcome).toHaveProperty("O1");
    expect(dueAtByOutcome).toHaveProperty("AS1.1");
    expect(dueAtByOutcome).toHaveProperty("AS1.2");

    // Should NOT have document IDs or composite keys
    expect(dueAtByOutcome).not.toHaveProperty("outcome_test_simple_o1");
    expect(dueAtByOutcome).not.toHaveProperty("outcome_test_simple_o1#AS1.1");
  });
});
```

**Test 2: Spaced Repetition Shows Correct Mastery**

```typescript
describe('Spaced repetition mastery display', () => {
  it('should show correct mastery percentage for AS codes', async () => {
    // 1. Setup MasteryV2 with 100% mastery
    await setMasteryV2({
      "outcome_test_simple_o1": 1.0,
      "outcome_test_simple_o1#AS1.1": 1.0
    });

    // 2. Setup RoutineV2 with overdue outcomes
    await setRoutineV2({
      "O1": "2025-11-01T00:00:00Z",  // Overdue
      "AS1.1": "2025-11-01T00:00:00Z"  // Overdue
    });

    // 3. Load spaced repetition recommendations
    const recommendations = await getReviewRecommendations(studentId, courseId);

    // 4. Verify mastery percentage
    expect(recommendations[0].averageMastery).toBe(1.0);  // Not 0.65 or 0.3!

    // 5. Verify console logs show successful mapping
    expect(consoleLogs).toContain('Mapped AS code: AS1.1 → outcome_test_simple_o1#AS1.1');
    expect(consoleLogs).toContain('found=true, ema=1.0');
  });
});
```

**Test 3: Trace Key Transformations**

```typescript
describe('Key format transformations', () => {
  it('should translate keys correctly in both directions', () => {
    // Write Path: documentId → stringRef
    const enrichedOutcomes = [{
      $id: "outcome_test_simple_o1",
      outcomeId: "O1",
      assessmentStandards: '[{"code":"AS1.1"}]'
    }];

    const mapping = buildDocumentIdToOutcomeIdMapping(enrichedOutcomes);

    expect(mapping.get("outcome_test_simple_o1")).toBe("O1");
    expect(mapping.get("outcome_test_simple_o1#AS1.1")).toBe("AS1.1");

    // Read Path: stringRef → documentId
    const reverseMapping = await buildOutcomeIdMapping(
      ["O1", "AS1.1"],
      courseId,
      databases
    );

    expect(reverseMapping.get("O1")).toBe("outcome_test_simple_o1");
    expect(reverseMapping.get("AS1.1")).toBe("outcome_test_simple_o1#AS1.1");
  });
});
```

---

## Conclusion

This document provides a comprehensive overview of the Mastery + Evidence + Routine architecture. Key takeaways:

1. **Three systems, one goal**: Track learning from different angles
2. **Key format translation is critical**: MasteryV2 uses document IDs, RoutineV2 uses string refs
3. **Enriched outcomes are the bridge**: Single source of truth for translation
4. **Fail-fast, no fallbacks**: Clear errors guide developers to fix root causes
5. **Composite keys enable granularity**: Track both outcomes and assessment standards

When in doubt, trace the data through all three systems and verify key transformations at each step.

**Questions?** See related docs in `/docs/` folder or review code reference index above.

---

**Last Updated**: November 2025
**Maintainers**: ScottishAILessons Development Team
**Version**: 2.0
