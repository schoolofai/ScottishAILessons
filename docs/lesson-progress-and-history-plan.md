# Lesson Progress and History - Implementation Plan

## Overview

This document outlines the simplified approach for tracking and displaying user lesson progress and session history.

## Core Constraint

**One Active Session Rule**: A user can have only ONE active session per lesson at any time. The user must complete or abandon the current session before starting a fresh attempt.

---

## Design Principles

1. ✅ **Simple State Machine** - Only 4 states per lesson: never_started, in_progress, completed, locked
2. ✅ **Clear User Intent** - "Start", "Continue", or "Retake" - no ambiguity
3. ✅ **No Migrations Required** - Use existing database schema (status field)
4. ✅ **History for Completed Only** - Only show completed sessions in history view
5. ✅ **Resumable Sessions** - User can always continue where they left off

---

## State Machine (Per Lesson)

```typescript
// Query sessions for this lesson:
const activeSessions = sessions.filter(s => s.status === 'active');
const completedSessions = sessions.filter(s => s.status === 'completed');

// State determination:
if (activeSessions.length > 0) {
  // STATE: IN PROGRESS
  // Show: "Continue" button
  action = 'continue';
  buttonText = 'Continue';
  sessionToResume = activeSessions[0]; // Most recent
} else if (completedSessions.length > 0) {
  // STATE: COMPLETED (one or more times)
  // Show: "Retake Lesson" + optional history link
  action = 'retake';
  buttonText = 'Retake Lesson';
  showHistory = true;
  historyCount = completedSessions.length;
} else {
  // STATE: NEVER STARTED
  // Show: "Start Lesson"
  action = 'start';
  buttonText = 'Start Lesson';
}
```

---

## User Journey Scenarios

### Scenario 1: First Time Starting
```
Status: No sessions
Display: "Start Lesson" button
Action: Creates new session with status='active'
Result: User begins lesson
```

### Scenario 2: Lesson In Progress
```
Status: One active session exists
Display: "Continue" button (blue, prominent)
Subtext: "Started 2 days ago" (optional)
Action: Navigates to existing session (resumes same thread)
Result: User picks up where they left off
```

### Scenario 3: Completed Once
```
Status: One completed session
Display: "Retake Lesson" button
        + "View History (1 completed)" link below
Action: Creates NEW session with status='active'
Result: Fresh start (new attempt)
```

### Scenario 4: Completed Multiple Times
```
Status: 5 completed sessions, no active
Display: "Retake Lesson" button
        + "View History (5 completed)" link
Action: Same as Scenario 3
Result: User can view past attempts before retaking
```

### Scenario 5: User Abandons Mid-Lesson
```
Status: One active session from 3 days ago
Display: "Continue" button
Action: Resumes same session (LangGraph thread persists)
Result: User continues from last card
```

---

## Implementation Changes

### Change 1: Update CourseCurriculum Component

**File:** `assistant-ui-frontend/components/curriculum/CourseCurriculum.tsx`

#### 1.1 Update Lesson Interface

```typescript
interface Lesson {
  order: number;
  label: string;
  lessonTemplateId: string;
  lesson_type: string;
  status?: 'completed' | 'in_progress' | 'not_started' | 'locked';
  estimatedMinutes?: number;
  isPublished?: boolean;
  activeSessionId?: string;  // NEW: For resume
  completedCount?: number;    // NEW: For history
}
```

#### 1.2 Update Session Map Logic

Replace lines 151-182 with:

```typescript
// Build session map with status tracking
const sessionsByLesson = new Map<string, {
  activeSession: any | null;
  completedCount: number;
}>();

allSessions.forEach((session: any) => {
  if (!sessionsByLesson.has(session.lessonTemplateId)) {
    sessionsByLesson.set(session.lessonTemplateId, {
      activeSession: null,
      completedCount: 0
    });
  }
  
  const lessonSessions = sessionsByLesson.get(session.lessonTemplateId)!;
  
  if (session.status === 'active') {
    // Only keep most recent active session
    if (!lessonSessions.activeSession || 
        new Date(session.startedAt) > new Date(lessonSessions.activeSession.startedAt)) {
      lessonSessions.activeSession = session;
    }
  } else if (session.status === 'completed') {
    lessonSessions.completedCount++;
  }
});

// Map lessons with status
const lessonsWithStatus: Lesson[] = lessonTemplates.map((template: any, index: number) => {
  const lessonSessions = sessionsByLesson.get(template.$id);
  const isPublished = template.status === 'published';
  let status: Lesson['status'] = 'not_started';

  if (!isPublished) {
    status = 'locked';
  } else if (lessonSessions?.activeSession) {
    status = 'in_progress';
  } else if (lessonSessions?.completedCount > 0) {
    status = 'completed';
  }

  return {
    order: template.sow_order || index + 1,
    label: template.title || `Lesson ${index + 1}`,
    lessonTemplateId: template.$id,
    lesson_type: template.lesson_type || 'teach',
    status,
    estimatedMinutes: template.estMinutes || 30,
    isPublished,
    activeSessionId: lessonSessions?.activeSession?.$id,
    completedCount: lessonSessions?.completedCount || 0
  };
});
```

#### 1.3 Update Button Rendering Logic

Replace the `getActionButton` function (lines 228-284):

```typescript
const getActionButton = (lesson: Lesson) => {
  const isStarting = startingLessonId === lesson.lessonTemplateId;

  if (lesson.status === 'locked') {
    return (
      <div className="text-right">
        <Button variant="ghost" size="sm" disabled className="gap-2">
          <Lock className="h-4 w-4" />
          Locked
        </Button>
      </div>
    );
  }

  // Determine button based on status
  let buttonText = 'Start Lesson';
  let buttonVariant: 'default' | 'outline' = 'default';
  let buttonIcon = <Play className="h-4 w-4" />;

  if (lesson.status === 'in_progress') {
    buttonText = 'Continue';
    buttonVariant = 'default';
    buttonIcon = <Play className="h-4 w-4" />;
  } else if (lesson.status === 'completed') {
    buttonText = 'Retake Lesson';
    buttonVariant = 'outline';
    buttonIcon = <Play className="h-4 w-4" />;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={buttonVariant}
        size="sm"
        onClick={() => onStartLesson(lesson.lessonTemplateId)}
        disabled={isStarting}
        className={`gap-2 ${buttonVariant === 'default' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
      >
        {isStarting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            {buttonIcon}
            {buttonText}
          </>
        )}
      </Button>
      
      {/* Show history link if multiple completed sessions */}
      {lesson.completedCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/lesson-sessions/${lesson.lessonTemplateId}`);
          }}
          className="text-xs text-blue-600 hover:underline"
        >
          View History ({lesson.completedCount} completed)
        </button>
      )}
    </div>
  );
};
```

#### 1.4 Add Router Import

At the top of the file, add:

```typescript
import { useRouter } from 'next/navigation';

// Inside component:
const router = useRouter();
```

---

### Change 2: Update Start Lesson Logic

**File:** `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx`

Update the `handleStartLesson` function (around line 519):

```typescript
const handleStartLesson = async (lessonTemplateId: string) => {
  try {
    setStartingLessonId(lessonTemplateId);

    // Validate
    const validation = validateLessonStartContext(
      lessonTemplateId,
      activeCourse,
      recommendations?.thread_id
    );

    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    debugLog('Starting lesson', {
      lessonTemplateId,
      courseId: activeCourse,
      threadId: recommendations?.thread_id
    });

    // Check if there's an active session for this lesson
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    const databases = new Databases(client);
    
    // Set session from localStorage
    const cookieFallback = localStorage.getItem('cookieFallback');
    if (cookieFallback) {
      const cookieData = JSON.parse(cookieFallback);
      const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
      client.setSession(cookieData[sessionKey]);
    }

    // Check for active session
    const activeSessions = await databases.listDocuments(
      'default',
      'sessions',
      [
        Query.equal('studentId', student.$id),
        Query.equal('lessonTemplateId', lessonTemplateId),
        Query.equal('status', 'active'),
        Query.limit(1)
      ]
    );

    let sessionId: string;

    if (activeSessions.documents.length > 0) {
      // CONTINUE existing session
      sessionId = activeSessions.documents[0].$id;
      debugLog('Continuing existing session', { sessionId });
    } else {
      // START new session
      const { createLessonSession } = await import('@/lib/sessions/session-manager');

      const newSession = await createLessonSession({
        lessonTemplateId,
        studentId: student.$id,
        courseId: activeCourse,
        threadId: recommendations?.thread_id
      });

      sessionId = newSession.$id;
      debugLog('Created new session', { sessionId });
    }

    // Invalidate cache
    const cacheKey = createCacheKey('recommendations', student.$id, activeCourse);
    cache.invalidate(cacheKey);
    console.log('[Cache] Invalidated cache after starting lesson:', { cacheKey });

    // Navigate to session
    router.push(`/session/${sessionId}`);
  } catch (err) {
    console.error("Failed to start lesson:", err);
    setError(formatErrorMessage(err));
    setStartingLessonId(null);
  }
};
```

---

### Change 3: Create Lesson History Page

**File:** `assistant-ui-frontend/app/(protected)/lesson-sessions/[lessonTemplateId]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { Client, Databases, Query } from 'appwrite';
import { ArrowLeft, Calendar, Clock, CheckCircle2, Loader2 } from 'lucide-react';

interface Session {
  $id: string;
  completedAt: string;
  durationMinutes?: number;
  startedAt: string;
}

export default function LessonSessionsPage() {
  const router = useRouter();
  const params = useParams();
  const lessonTemplateId = params.lessonTemplateId as string;
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lessonTitle, setLessonTitle] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [lessonTemplateId]);

  const loadSessions = async () => {
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      // Set session from localStorage
      const cookieFallback = localStorage.getItem('cookieFallback');
      if (cookieFallback) {
        const cookieData = JSON.parse(cookieFallback);
        const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
        const storedSession = cookieData[sessionKey];
        if (storedSession) {
          client.setSession(storedSession);
        }
      }

      const databases = new Databases(client);

      // Get lesson template for title
      const template = await databases.getDocument(
        'default',
        'lesson_templates',
        lessonTemplateId
      );
      setLessonTitle(template.title);

      // Get course for context
      const courseResult = await databases.listDocuments(
        'default',
        'courses',
        [Query.equal('courseId', template.courseId)]
      );
      
      if (courseResult.documents.length > 0) {
        const course = courseResult.documents[0];
        setCourseTitle(`${course.subject} - ${course.level}`);
      }

      // Get completed sessions only
      const result = await databases.listDocuments(
        'default',
        'sessions',
        [
          Query.equal('lessonTemplateId', lessonTemplateId),
          Query.equal('status', 'completed'),
          Query.orderDesc('completedAt'),
          Query.limit(50) // Last 50 completed sessions
        ]
      );

      setSessions(result.documents as Session[]);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Course
        </Button>
        
        <div className="mb-2">
          <p className="text-sm text-gray-600">{courseTitle}</p>
        </div>
        <h1 className="text-3xl font-bold mb-2">{lessonTitle}</h1>
        <p className="text-gray-600">
          You've completed this lesson <strong>{sessions.length}</strong> time{sessions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">No completed sessions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, index) => (
            <Card key={session.$id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium">
                        Completed {formatDistanceToNow(new Date(session.completedAt), { addSuffix: true })}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(session.completedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        {session.durationMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.durationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action: Retake Lesson */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold mb-2">Want to practice again?</h3>
        <p className="text-sm text-gray-600 mb-4">
          Retake this lesson to reinforce your learning
        </p>
        <Button 
          onClick={() => router.back()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Back to Course
        </Button>
      </div>
    </div>
  );
}
```

---

## Optional Enhancement: Start Over Option

If users want to abandon current in-progress session and start fresh, add this to `getActionButton`:

```typescript
{lesson.status === 'in_progress' && (
  <button
    onClick={async (e) => {
      e.stopPropagation();
      if (confirm('Abandon current progress and start fresh?')) {
        // Mark current session as abandoned
        const client = new Client()
          .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
          .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
          
        const databases = new Databases(client);
        
        await databases.updateDocument(
          'default',
          'sessions',
          lesson.activeSessionId!,
          { status: 'abandoned' }
        );
        
        // Start new session
        onStartLesson(lesson.lessonTemplateId);
      }
    }}
    className="text-xs text-gray-500 hover:text-gray-700 underline"
  >
    Start Over
  </button>
)}
```

---

## Database Schema (No Changes Required)

Using existing `sessions` collection fields:
- ✅ `status`: enum ['created', 'active', 'completed', 'abandoned', 'failed']
- ✅ `startedAt`: timestamp
- ✅ `completedAt`: timestamp  
- ✅ `durationMinutes`: number
- ✅ `studentId`, `lessonTemplateId`, `courseId`: references

---

## Testing Checklist

### Functional Tests
- [ ] First-time user can start a lesson
- [ ] Active session shows "Continue" button
- [ ] Continue button resumes correct session
- [ ] Completed lesson shows "Retake Lesson" button
- [ ] Retake creates new session (doesn't overwrite)
- [ ] History link appears only when completed sessions exist
- [ ] History page shows all completed sessions
- [ ] History page loads correct lesson title
- [ ] Sessions sorted by completion date (newest first)
- [ ] Multiple completed sessions all displayed
- [ ] Locked lessons show locked state
- [ ] Published/unpublished filtering works

### Edge Cases
- [ ] User with active session from 7 days ago can continue
- [ ] User with 20+ completed sessions (pagination)
- [ ] User abandons lesson mid-way (active session persists)
- [ ] Multiple users can't interfere with each other's sessions
- [ ] Network failure shows error gracefully
- [ ] Missing lesson template handles error
- [ ] Session without completedAt shows startedAt as fallback

### UI/UX
- [ ] Button states clear and distinct
- [ ] History link not intrusive
- [ ] Loading states smooth
- [ ] Mobile responsive
- [ ] Accessibility (screen readers, keyboard nav)
- [ ] Back button returns to correct page

---

## Benefits Summary

### Simplicity
- ✅ Only 4 states per lesson
- ✅ Clear button labels
- ✅ No complex edge cases
- ✅ Easy to test

### User Experience
- ✅ Can always resume in-progress lessons
- ✅ Can retake completed lessons unlimited times
- ✅ Can view full completion history
- ✅ No confusion about current state

### Technical
- ✅ No database migrations
- ✅ Uses existing schema
- ✅ Minimal code changes
- ✅ Follows open/closed principle

---

## Implementation Timeline

1. **Phase 1** (2-3 hours): Update CourseCurriculum component
2. **Phase 2** (1-2 hours): Update start lesson logic  
3. **Phase 3** (2-3 hours): Create history page
4. **Phase 4** (1-2 hours): Testing and polish
5. **Phase 5** (optional): Add "Start Over" feature

**Total Estimated Time: 6-10 hours**

---

## Future Enhancements (Out of Scope)

- Session analytics (time per card, accuracy trends)
- Mastery progression charts over multiple attempts
- Export session history as PDF
- Session notes/reflections
- Comparative performance between attempts
- Achievements/badges for completing lessons multiple times
