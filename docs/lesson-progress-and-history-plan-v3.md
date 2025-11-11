# Lesson Progress and History - Implementation Plan v3.0

**Status**: Simplified Production Specification
**Last Updated**: 2025-10-28
**Authors**: Claude Code + User Feedback
**Supersedes**: v2.0 (removed complex resume logic)

---

## Overview

This document outlines a **simplified, production-ready** approach for tracking and displaying lesson progress with completed session history viewing. This version **removes the complex "Continue" feature** in favor of a clean "start fresh or review completed" model.

## Core Principles

### What Changed from v2

**REMOVED Complexity:**
- ❌ Session resume/"Continue" functionality (too complex for interrupt-based architecture)
- ❌ `in_progress` state management
- ❌ "Start Over" feature
- ❌ Complex interrupt state restoration
- ❌ `session-security.ts` utilities

**KEPT Simplicity:**
- ✅ Start new lessons
- ✅ Complete lessons
- ✅ View completed session history (read-only)
- ✅ Retake completed lessons
- ✅ Lock unpublished lessons

### Philosophy

> **"If you abandon a lesson, start fresh. If you complete it, you can review it anytime."**

This aligns with the interrupt-driven teaching architecture which is designed for **real-time interaction**, not arbitrary-point resume.

---

## State Machine (Per Lesson)

### Simplified States

```typescript
type LessonStatus =
  | 'never_started'  // No sessions exist
  | 'completed'      // One or more completed sessions
  | 'locked';        // Lesson not published

type SessionStatus =
  | 'active'         // Currently being worked on
  | 'completed'      // Successfully finished
  | 'abandoned';     // Started but not finished (marked after timeout)
```

### State Transitions

```
never_started → [Start Lesson] → active → [Complete] → completed
                                        ↓
                                    [Timeout/Abandon] → abandoned

completed → [Retake Lesson] → active (new session)
```

**Key Rules:**
1. Only ONE active session per student per lesson
2. Active sessions older than 24 hours are automatically marked as `abandoned`
3. Abandoned sessions do NOT allow resume - user must start fresh
4. Completed sessions are preserved forever for history viewing

---

## User Journey Scenarios

### Scenario 1: First Time Starting
```
Status: No sessions exist
Display: "Start Lesson" button (variant="default", blue)
Action: Creates new session with status='active'
Logging: session_created event
Result: User begins lesson with fresh thread
```

### Scenario 2: Abandoned Active Session
```
Status: One active session from 3 days ago (>24h threshold)
Display: "Start Lesson" button
         Optional badge: "Previous attempt: 3 days ago"
Action:
  1. Mark old session as 'abandoned'
  2. Create new session with status='active'
Logging: session_abandoned, session_created events
Result: Clean fresh start (previous state discarded)
```

### Scenario 3: Recently Started Session
```
Status: One active session from 2 hours ago (<24h threshold)
Display: "Start Lesson" button (SAME as Scenario 1)
         Badge: "In Progress" (informational only)
         Subtext: "Started 2 hours ago - starting fresh will abandon previous attempt"
Action:
  1. Mark old session as 'abandoned'
  2. Create new session with status='active'
Logging: session_abandoned, session_created events
Result: User starts fresh (no resume)
```

### Scenario 4: Completed Once
```
Status: One completed session, no active
Display: "Retake Lesson" button (variant="outline")
         Badge: "Completed" (green check)
         Link: "View Session History (1 completed)"
Action: Creates NEW session with status='active'
Logging: session_retake event
Result: Fresh attempt (new thread, no previous context)
```

### Scenario 5: Completed Multiple Times
```
Status: 5 completed sessions, no active
Display: "Retake Lesson" button
         Badge: "Completed 5×" (green)
         Link: "View Session History (5 completed)"
Action: Same as Scenario 4
History Page: Shows all 5 attempts with:
  - Completion dates
  - Duration
  - Clickable to view conversation replay
Result: User can review past learning before retaking
```

### Scenario 6: Completed + Active Session
```
Status: 3 completed sessions + 1 active (from 10 hours ago)
Display: "Start Lesson" button
         Badge: "Completed 3× + In Progress"
         Link: "View Session History (3 completed)"
Action:
  1. Mark active session as 'abandoned'
  2. Create new session
Note: User can review completed sessions but NOT resume active one
```

---

## Simplified State Determination

```typescript
/**
 * Determines lesson status for UI rendering
 *
 * MUCH SIMPLER than v2 - no resume logic!
 */
interface LessonDisplayState {
  lessonTemplateId: string;
  studentId: string;
  status: 'never_started' | 'completed' | 'locked';
  action: 'start' | 'retake' | 'locked';
  completedCount: number;
  hasActiveSession: boolean; // Informational only
  activeSessionAge?: number; // For display warning
}

async function determineLessonStatus(
  lessonTemplateId: string,
  studentId: string,
  isPublished: boolean,
  databases: Databases
): Promise<LessonDisplayState> {
  // Validate inputs
  if (!lessonTemplateId || !studentId) {
    throw new Error('Invalid parameters');
  }

  // LOCKED state takes precedence
  if (!isPublished) {
    return {
      lessonTemplateId,
      studentId,
      status: 'locked',
      action: 'locked',
      completedCount: 0,
      hasActiveSession: false
    };
  }

  try {
    // Query completed sessions count (for badge)
    const completedSessions = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', studentId),
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'completed'),
        Query.limit(1) // Only need count
      ]
    );

    const completedCount = completedSessions.total;

    // Query active sessions (for informational display only)
    const activeSessions = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', studentId),
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'active'),
        Query.orderDesc('startedAt'),
        Query.limit(1)
      ]
    );

    const hasActiveSession = activeSessions.documents.length > 0;
    let activeSessionAge: number | undefined;

    if (hasActiveSession) {
      const activeSession = activeSessions.documents[0];
      activeSessionAge = Date.now() - new Date(activeSession.startedAt).getTime();
    }

    // Determine status (completed vs never_started)
    if (completedCount > 0) {
      return {
        lessonTemplateId,
        studentId,
        status: 'completed',
        action: 'retake',
        completedCount,
        hasActiveSession,
        activeSessionAge
      };
    } else {
      return {
        lessonTemplateId,
        studentId,
        status: 'never_started',
        action: 'start',
        completedCount: 0,
        hasActiveSession,
        activeSessionAge
      };
    }
  } catch (error) {
    logger.error('determineLessonStatus failed', {
      lessonTemplateId,
      studentId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
```

---

## Simplified Session Creation

```typescript
/**
 * Create new session - ALWAYS fresh, NEVER resume
 *
 * Automatically abandons any existing active sessions
 */
async function createFreshSession(
  databases: Databases,
  params: {
    lessonTemplateId: string;
    studentId: string;
    courseId: string;
  }
): Promise<{ sessionId: string; previousSessionAbandoned: boolean }> {
  const { lessonTemplateId, studentId, courseId } = params;

  // Validate inputs
  if (!lessonTemplateId || !studentId || !courseId) {
    throw new Error('Missing required parameters');
  }

  // Check for existing active session
  const activeSessions = await databases.listDocuments(
    'default',
    'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('lessonTemplateId', lessonTemplateId),
      Query.equal('status', 'active'),
      Query.limit(1)
    ]
  );

  let previousSessionAbandoned = false;

  // Mark existing active session as abandoned
  if (activeSessions.documents.length > 0) {
    const oldSession = activeSessions.documents[0];

    await databases.updateDocument(
      'default',
      'sessions',
      oldSession.$id,
      { status: 'abandoned' }
    );

    logger.info('session_abandoned', {
      sessionId: oldSession.$id,
      lessonTemplateId,
      studentId,
      ageMs: Date.now() - new Date(oldSession.startedAt).getTime()
    });

    previousSessionAbandoned = true;
  }

  // Create fresh session
  const { createLessonSession } = await import('@/lib/sessions/session-manager');

  const newSession = await createLessonSession({
    lessonTemplateId,
    studentId,
    courseId
    // Note: No threadId - fresh thread will be created
  });

  logger.info('session_created', {
    sessionId: newSession.$id,
    lessonTemplateId,
    studentId,
    courseId,
    previousAbandoned: previousSessionAbandoned
  });

  return {
    sessionId: newSession.$id,
    previousSessionAbandoned
  };
}
```

---

## Button Rendering (Simplified)

```typescript
import { Play, Lock, RotateCcw, History } from 'lucide-react';

const getActionButton = (lesson: LessonDisplayState) => {
  if (lesson.status === 'locked') {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Lock className="h-4 w-4" />
        Locked
      </Button>
    );
  }

  // Show warning badge if active session exists
  const showActiveWarning = lesson.hasActiveSession &&
    lesson.activeSessionAge! < 24 * 60 * 60 * 1000; // <24h

  if (lesson.status === 'completed') {
    return (
      <div className="flex flex-col items-end gap-2">
        {/* Retake button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onStartLesson(lesson.lessonTemplateId)}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Retake Lesson
        </Button>

        {/* Active session warning */}
        {showActiveWarning && (
          <p className="text-xs text-amber-600">
            In progress session will be abandoned
          </p>
        )}

        {/* History link */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/lesson-sessions/${lesson.lessonTemplateId}/history`);
          }}
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <History className="h-3 w-3" />
          View History ({lesson.completedCount} completed)
        </button>
      </div>
    );
  }

  // never_started or has abandoned session
  return (
    <div className="flex flex-col items-end gap-2">
      {/* Start/Restart button */}
      <Button
        variant="default"
        size="sm"
        onClick={() => onStartLesson(lesson.lessonTemplateId)}
        className="gap-2 bg-blue-600 hover:bg-blue-700"
      >
        <Play className="h-4 w-4" />
        Start Lesson
      </Button>

      {/* Active session warning */}
      {showActiveWarning && (
        <p className="text-xs text-amber-600">
          Previous session will be abandoned
        </p>
      )}
    </div>
  );
};
```

---

## Session History Viewing

### History List Page

**Path**: `/lesson-sessions/[lessonTemplateId]/history`

**Purpose**: Show all completed sessions for this lesson

```typescript
interface CompletedSessionSummary {
  sessionId: string;
  completedAt: string;
  startedAt: string;
  durationMinutes: number;
  cardsCompleted: number;
  totalCards: number;
}

export default function LessonHistoryPage() {
  const { lessonTemplateId } = useParams();
  const [sessions, setSessions] = useState<CompletedSessionSummary[]>([]);

  // Fetch all completed sessions
  useEffect(() => {
    loadCompletedSessions();
  }, [lessonTemplateId]);

  async function loadCompletedSessions() {
    const result = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', student.$id),
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'completed'),
        Query.orderDesc('completedAt')
      ]
    );

    setSessions(result.documents);
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1>Session History: {lessonTitle}</h1>

      {sessions.map(session => (
        <Card key={session.sessionId}>
          <CardContent>
            <p>Completed: {formatDistanceToNow(session.completedAt)}</p>
            <p>Duration: {session.durationMinutes} min</p>
            <Button
              onClick={() => router.push(`/lesson-sessions/${session.sessionId}/view`)}
            >
              View Conversation
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Session Replay Page

**Path**: `/lesson-sessions/[sessionId]/view`

**Purpose**: Display read-only replay of completed session

```typescript
export default function SessionReplayPage() {
  const { sessionId } = useParams();
  const [threadState, setThreadState] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    loadThreadHistory();
  }, [sessionId]);

  async function loadThreadHistory() {
    // Get session to retrieve threadId
    const session = await databases.getDocument('default', 'sessions', sessionId);

    // Validate ownership
    if (session.studentId !== currentStudent.$id) {
      throw new Error('Unauthorized');
    }

    // Fetch thread state from LangGraph
    const threadState = await getThreadState(session.threadId);

    setThreadState(threadState);
    setMessages(threadState.values.messages);
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-4">
        <Button onClick={() => router.back()}>← Back to History</Button>
      </div>

      <h1>Session Replay</h1>
      <p className="text-sm text-gray-600">
        Completed: {formatDate(session.completedAt)}
      </p>

      {/* Read-only message display */}
      <div className="space-y-4 mt-6">
        {messages.map((msg, idx) => (
          <MessageDisplay
            key={idx}
            message={msg}
            readOnly={true}
          />
        ))}
      </div>

      {/* Show tool calls as lesson cards (non-interactive) */}
      {threadState.toolCalls?.map(toolCall => (
        <LessonCardDisplay
          key={toolCall.id}
          cardData={toolCall.args}
          readOnly={true}
        />
      ))}
    </div>
  );
}
```

---

## Database Requirements

### Schema (Unchanged)

```sql
CREATE TABLE sessions (
  id VARCHAR PRIMARY KEY,
  studentId VARCHAR NOT NULL,
  lessonTemplateId VARCHAR NOT NULL,
  courseId VARCHAR NOT NULL,
  threadId VARCHAR,
  status ENUM('active', 'completed', 'abandoned') NOT NULL,
  startedAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL,
  durationMinutes INT,

  INDEX idx_sessions_student_lesson_completed (studentId, lessonTemplateId, status, completedAt DESC)
    WHERE status = 'completed',
  INDEX idx_sessions_student_lesson_active (studentId, lessonTemplateId, status)
    WHERE status = 'active'
);
```

### Background Cleanup Job

```typescript
/**
 * Mark old active sessions as abandoned
 * Run this periodically (e.g., daily cron job)
 */
async function cleanupAbandonedSessions() {
  const threshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

  const oldSessions = await databases.listDocuments(
    'default',
    'sessions',
    [
      Query.equal('status', 'active'),
      Query.lessThan('updatedAt', new Date(threshold).toISOString())
    ]
  );

  for (const session of oldSessions.documents) {
    await databases.updateDocument(
      'default',
      'sessions',
      session.$id,
      { status: 'abandoned' }
    );

    logger.info('session_auto_abandoned', {
      sessionId: session.$id,
      ageHours: (Date.now() - new Date(session.updatedAt).getTime()) / (60 * 60 * 1000)
    });
  }
}
```

---

## Implementation Checklist

### Phase 1: Remove Complex Resume Logic
- [ ] Delete `lib/sessions/session-security.ts` (no longer needed)
- [ ] Remove `createOrGetActiveSession()` from dashboard
- [ ] Remove `validateSessionAccess()` calls
- [ ] Remove `abandonAndRestart()` logic
- [ ] Update `AutoStartTrigger` to always start fresh (no thread reuse)

### Phase 2: Simplify Button Rendering
- [ ] Update `CourseCurriculum.tsx` with simplified button logic
- [ ] Remove "Continue" button code
- [ ] Remove "Start Over" button code
- [ ] Keep "View History" link
- [ ] Add active session warning text

### Phase 3: Update Session Creation
- [ ] Implement `createFreshSession()` in `EnhancedStudentDashboard.tsx`
- [ ] Always create new session (no resume check)
- [ ] Auto-abandon existing active sessions
- [ ] Log abandonment events

### Phase 4: Build History Viewing
- [ ] Create `/lesson-sessions/[lessonTemplateId]/history/page.tsx`
- [ ] Create `/lesson-sessions/[sessionId]/view/page.tsx`
- [ ] Implement `SessionReplayViewer` component
- [ ] Add read-only message display
- [ ] Add read-only lesson card display

### Phase 5: Background Cleanup
- [ ] Create abandoned session cleanup function
- [ ] Add cron job or scheduled task
- [ ] Log auto-abandonment events

### Phase 6: Testing
- [ ] Test: Start lesson → abandon → start fresh
- [ ] Test: Complete lesson → view history → retake
- [ ] Test: Multiple completions → view all sessions
- [ ] Test: Session replay displays correctly
- [ ] Test: Unauthorized access blocked

---

## Benefits of v3 Over v2

| Aspect | v2 (Complex) | v3 (Simplified) |
|--------|-------------|-----------------|
| **Resume Logic** | Complex interrupt restoration | None - always start fresh |
| **Code Lines** | ~1,500 lines | ~800 lines |
| **Edge Cases** | Many (stale state, race conditions) | Few (just abandonment) |
| **User Confusion** | "Continue" vs "Start Over" unclear | Clear: "Start" or "Retake" |
| **Backend Complexity** | Requires state persistence | Stateless (just thread history) |
| **Reliability** | Prone to blank screen issues | Reliable (no resume fails) |
| **History Feature** | Incomplete | Full read-only replay |

---

## Migration from v2 to v3

### Database Migration

```sql
-- Mark all existing active sessions as abandoned
UPDATE sessions
SET status = 'abandoned',
    updatedAt = NOW()
WHERE status = 'active';
```

### Code Cleanup

1. Remove files:
   - `lib/sessions/session-security.ts`
   - Tests for resume functionality

2. Simplify files:
   - `CourseCurriculum.tsx` (remove continue logic)
   - `EnhancedStudentDashboard.tsx` (remove resume checks)
   - `AutoStartTrigger.tsx` (remove thread reuse)

3. Add new files:
   - `app/(protected)/lesson-sessions/[lessonTemplateId]/history/page.tsx`
   - `app/(protected)/lesson-sessions/[sessionId]/view/page.tsx`
   - `components/sessions/SessionReplayViewer.tsx`

---

## Implementation Status

### Phase 1: Conversation History Persistence ✅ COMPLETED (2025-10-28)

**Backend (LangGraph):**
- ✅ Added `_extract_conversation_history()` function in `teacher_graph_toolcall_interrupt.py`
- ✅ Serializes LangGraph `state.messages` array with embedded tool calls
- ✅ Preserves chronological order (array index = message order)
- ✅ Included in `lesson_completion_summary` tool call args

**Database Schema:**
- ✅ Added `conversationHistory` field to Appwrite sessions collection (50KB string, optional)
- ✅ Updated TypeScript Session interface in `types/index.ts`
- ✅ Updated Zod SessionSchema in `schemas.ts`

**Frontend Compression:**
- ✅ Installed pako library (already available)
- ✅ Implemented `compressConversationHistory()` in `LessonCompletionSummaryTool.tsx`
- ✅ Uses gzip + base64 encoding (70-80% size reduction)
- ✅ Validates 50KB size limit before persistence
- ✅ Non-blocking persistence (graceful degradation if fails)

**Frontend Decompression:**
- ✅ Implemented `decompressConversationHistory()` in `SessionDriver.ts`
- ✅ Added `updateConversationHistory()` method to SessionDriver
- ✅ Added `getConversationHistory()` method to SessionDriver
- ✅ Exported ConversationHistory type for replay components

### Phase 2: Read-Only Replay UI ⏳ IN PROGRESS

**Pending:**
- ⏳ Create `ReadOnlyLessonCard` component (disabled interactions)
- ⏳ Create `ReadOnlyCompletionSummary` component
- ⏳ Update session replay page to render conversation history messages
- ⏳ Test end-to-end with real lesson completion

**Key Implementation Details:**
- Conversation history messages will be rendered in chronological order
- Tool calls with `lesson_card_presentation` name → render ReadOnlyLessonCard
- Tool calls with `lesson_completion_summary` name → render ReadOnlyCompletionSummary
- All other AI messages → render as text
- Human messages → render student responses

---

## Conclusion

Version 3 embraces the **"fresh start" philosophy** which aligns perfectly with the interrupt-driven teaching architecture. Users get:

✅ **Clarity**: Start fresh or review completed sessions
✅ **Reliability**: No complex state restoration failures
✅ **History**: Full conversation replay for completed sessions
✅ **Simplicity**: Less code, fewer bugs, easier maintenance

This approach is **production-ready** and **scalable** for thousands of students completing lessons daily.
