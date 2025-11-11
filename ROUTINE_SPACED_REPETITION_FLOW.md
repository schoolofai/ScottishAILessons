# Routine & Spaced Repetition Flow - Complete System Documentation

## Overview

Your system tracks spaced repetition at the **OUTCOME level** (learning objectives), not at the lesson level. This document explains the complete flow from lesson completion to spaced repetition scheduling.

---

## 📊 Database Collections

### 1. **Routine Collection**
```typescript
{
  studentId: string;              // Which student
  courseId: string;               // Which course
  lastTaughtAt?: string;          // ISO timestamp of last lesson
  dueAtByOutcome: {               // Map of outcomes to due dates
    [outcomeId]: "2025-11-05T..."  // When each outcome is due for review
  };
  spacingPolicyVersion: number;   // Algorithm version
  schema_version: number;         // Data schema version
}
```

**Key Point**: The `dueAtByOutcome` field stores **when each learning outcome should be reviewed next**, based on the spaced repetition algorithm.

### 2. **MasteryV2 Collection**
```typescript
{
  studentId: string;
  courseId: string;
  emaByOutcomeId: {               // EMA scores (0-1)
    [outcomeId]: 0.75              // Mastery level for each outcome
  };
  updatedAt: string;
}
```

**EMA** = Exponential Moving Average (0-1 scale)
- **0.0-0.4**: Struggling (needs daily review)
- **0.4-0.6**: Making progress (1-3 day intervals)
- **0.6-0.8**: Good understanding (3-7 day intervals)
- **0.8-1.0**: Mastered (7-14 day intervals)

---

## 🔄 Complete Data Flow

### **Phase 1: Lesson Completion**

1. **Student completes a lesson** (all cards answered)
2. **Backend (teacher_graph_toolcall_interrupt.py)** generates:
   - `evidence` array - one record per card answered
   - `mastery_updates` array - EMA calculations for outcomes

3. **LessonCompletionSummaryTool.tsx (Frontend)** receives:
```typescript
{
  evidence: [
    {
      cardIndex: 0,
      question: "What is 2+2?",
      studentResponse: "4",
      isCorrect: true,
      correctAnswer: "4",
      attemptNumber: 1,
      outcomeScores: { "outcome_abc123": 1.0 }
    },
    // ... more evidence entries
  ],
  mastery_updates: [
    {
      outcomeId: "outcome_abc123",  // Document ID from course_outcomes
      score: 0.85,                  // New EMA score
      timestamp: "2025-10-29T..."
    },
    // ... more mastery updates
  ],
  session_id: "session123",
  student_id: "student456",
  course_id: "C844 73"
}
```

### **Phase 2: Auto-Persistence (useEffect Hook)**

**File**: `assistant-ui-frontend/components/tools/LessonCompletionSummaryTool.tsx:103-238`

Automatically triggers when completion summary is displayed:

```typescript
useEffect(() => {
  const persistData = async () => {
    // 1. Save evidence records
    for (const evidenceEntry of evidence) {
      await evidenceDriver.createEvidence({
        sessionId: session_id,
        studentId: student_id,
        cardIndex: evidenceEntry.cardIndex,
        studentResponse: evidenceEntry.studentResponse,
        correct: evidenceEntry.isCorrect,
        attemptNumber: evidenceEntry.attemptNumber,
        outcomeScores: JSON.stringify(evidenceEntry.outcomeScores)
      });
    }

    // 2. Batch update mastery (EMA scores)
    const emaUpdates = {};
    for (const masteryUpdate of mastery_updates) {
      emaUpdates[masteryUpdate.outcomeId] = masteryUpdate.score;
    }
    await masteryDriver.batchUpdateEMAs(student_id, course_id, emaUpdates);

    // 3. Update session status to "done"
    await sessionDriver.updateSession(session_id, {
      stage: "done",
      endedAt: new Date().toISOString()
    });
  };

  persistData();
}, [session_id, student_id, course_id, evidence, mastery_updates]);
```

### **Phase 3: Spaced Repetition Calculation**

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts:206-234`

The `calculateNextDueDate()` method determines when to review each outcome:

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

**Example**:
- EMA = 0.85 (mastered) → Review in 7-14 days
- EMA = 0.45 (struggling) → Review tomorrow (1 day)

---

## 🎯 What "Overdue" Means

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts:147-173`

```typescript
async getOverdueOutcomes(studentId: string, courseId: string): Promise<OutcomeSchedule[]> {
  const routine = await this.getRoutineForCourse(studentId, courseId);
  if (!routine) return [];

  const now = new Date().toISOString();  // Current timestamp
  const overdueOutcomes: OutcomeSchedule[] = [];

  Object.entries(routine.dueAtByOutcome).forEach(([outcomeId, dueAt]) => {
    const isOverdue = dueAt <= now;  // Due date has passed
    overdueOutcomes.push({
      outcomeId,
      dueAt,
      isOverdue
    });
  });

  // Return only overdue outcomes, sorted by most overdue first
  return overdueOutcomes
    .filter(outcome => outcome.isOverdue)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
```

**"Overdue"** means:
- The outcome's `dueAt` timestamp is **before** the current time
- Student should review this outcome now to maintain retention

**Example**:
```typescript
{
  outcomeId: "outcome_fractions_abc123",
  dueAt: "2025-10-27T14:30:00Z",  // 2 days ago
  isOverdue: true                  // NOW > dueAt
}
```

---

## 🔧 Where Routines Are Currently Set/Updated

### **Scenario 1: Initial Course Enrollment**

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts:266-288`

```typescript
async initializeRoutineForCourse(
  studentId: string,
  courseId: string,
  outcomeIds: string[]
): Promise<any> {
  const now = new Date();
  const dueAtByOutcome: { [outcomeId: string]: string } = {};

  // Set all outcomes as due NOW (for initial assessment)
  outcomeIds.forEach(outcomeId => {
    dueAtByOutcome[outcomeId] = now.toISOString();
  });

  return await this.upsertRoutine({
    studentId,
    courseId,
    dueAtByOutcome,
    spacingPolicyVersion: 1,
    schema_version: 1
  });
}
```

**When called**: During enrollment setup (currently manual, not auto-triggered in MVP)

### **Scenario 2: After Lesson Completion**

**File**: `assistant-ui-frontend/lib/appwrite/driver/RoutineDriver.ts:239-261`

```typescript
async updateOutcomeSchedule(
  studentId: string,
  courseId: string,
  outcomeId: string,
  newEMA: number
): Promise<any> {
  const routine = await this.getRoutineForCourse(studentId, courseId);
  const currentDueAt = routine?.dueAtByOutcome[outcomeId];

  // Calculate days since last review
  let daysSinceLastReview = 1;
  if (currentDueAt) {
    const lastDue = new Date(currentDueAt);
    const now = new Date();
    daysSinceLastReview = Math.max(1,
      Math.floor((now.getTime() - lastDue.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  // Use spaced repetition algorithm
  const nextDueDate = this.calculateNextDueDate(newEMA, daysSinceLastReview);

  // Update the schedule
  return await this.updateDueAtByOutcome(studentId, courseId, {
    [outcomeId]: nextDueDate
  });
}
```

---

## ❗ Current Gap: Routines Are Not Auto-Updated

### **Problem**

The routine update logic exists (`updateOutcomeSchedule`) but is **NOT CURRENTLY CALLED** after lesson completion.

The flow stops at:
1. ✅ MasteryV2 is updated (EMA scores saved)
2. ✅ Evidence is saved
3. ✅ Session marked as "done"
4. ❌ **Routine is NOT updated with new due dates**

### **Missing Integration Point**

In `LessonCompletionSummaryTool.tsx`, after saving mastery updates, we should call:

```typescript
// 4. Update routine schedule based on new EMA scores
const routineDriver = createDriver(RoutineDriver);

for (const masteryUpdate of mastery_updates) {
  await routineDriver.updateOutcomeSchedule(
    student_id,
    course_id,
    masteryUpdate.outcomeId,
    masteryUpdate.score
  );
}
```

---

## 🎯 Summary: How Routines Work

| **Concept** | **Explanation** |
|-------------|-----------------|
| **What is tracked?** | Individual **outcomes** (learning objectives), not whole lessons |
| **What is "overdue"?** | An outcome whose `dueAt` timestamp has passed |
| **How are due dates calculated?** | Spaced repetition algorithm based on EMA mastery score |
| **When are routines created?** | During enrollment (currently manual via `initializeRoutineForCourse`) |
| **When are routines updated?** | After lesson completion (currently **NOT IMPLEMENTED** - this is the gap) |
| **Where is the logic?** | `RoutineDriver.ts` - all methods exist, just not called automatically |

---

## 🚀 Next Steps for Spaced Repetition Feature

1. **Fix auto-update**: Call `updateOutcomeSchedule` after lesson completion
2. **Lesson recommender**: Map overdue outcomes → lessons that teach them
3. **UI component**: Display recommended review lessons to students
4. **Session types**: Add "review" mode to distinguish from initial teaching

---

## 🔍 Key Files Reference

| **File** | **Purpose** |
|----------|-------------|
| `RoutineDriver.ts` | Spaced repetition scheduling logic |
| `MasteryV2Driver.ts` | EMA score tracking |
| `LessonCompletionSummaryTool.tsx` | Auto-persists evidence & mastery after completion |
| `teacher_graph_toolcall_interrupt.py` | Backend calculates mastery updates |

---

**Last Updated**: 2025-10-29
