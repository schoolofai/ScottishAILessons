# MVP2 Student User Journey Specification

**Version**: 2.0
**Date**: 2025-10-05
**Status**: Planning
**Scope**: Complete student lifecycle from onboarding to course completion

---

## Executive Summary

This specification defines the complete student user journey for MVP2, transforming the current auto-enrollment MVP into a full-featured learning platform with proper enrollment management, personalized curriculum, and progress tracking.

**Key Changes from MVP1:**
- ✅ Explicit enrollment flow (vs. auto-enrollment)
- ✅ Course discovery and selection
- ✅ Proper enrollment → SOWV2 pipeline
- ✅ Dashboard shows enrolled courses only (vs. all courses)
- ✅ Onboarding experience for new students
- ✅ Progress tracking and course completion
- ❌ Spaced repetition (routine) - Out of scope for MVP2

---

## Table of Contents

1. [User Journey Overview](#user-journey-overview)
2. [Data Model Integration](#data-model-integration)
3. [Journey Stages](#journey-stages)
4. [UI Component Specifications](#ui-component-specifications)
5. [Backend Integration](#backend-integration)
6. [Error Handling & Edge Cases](#error-handling--edge-cases)
7. [Success Metrics](#success-metrics)
8. [Implementation Roadmap](#implementation-roadmap)

---

## User Journey Overview

### Complete Student Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MVP2 STUDENT USER JOURNEY                            │
└─────────────────────────────────────────────────────────────────────────────┘

Stage 1: AUTHENTICATION & ONBOARDING
  │
  ├─► First-time Login
  │     ├─ Create student profile (students collection)
  │     ├─ Welcome wizard (name, accommodations)
  │     └─ Redirect to course catalog
  │
  └─► Returning Login
        └─ Direct to dashboard (if enrollments exist)

Stage 2: COURSE DISCOVERY & ENROLLMENT
  │
  ├─► Browse Course Catalog
  │     ├─ View available courses (courses collection)
  │     ├─ Filter by level (National 3/4/5)
  │     ├─ Filter by subject (Mathematics, Physics, etc.)
  │     └─ Course detail preview
  │
  ├─► Enroll in Course
  │     ├─ Create enrollment record (enrollments collection)
  │     ├─ Trigger SOWV2 creation from Authored_SOW
  │     ├─ Initialize MasteryV2 record
  │     └─ Redirect to dashboard
  │
  └─► Enrollment Confirmation
        └─ Show course added to "My Courses"

Stage 3: LEARNING DASHBOARD (Main Hub)
  │
  ├─► View Enrolled Courses
  │     ├─ Course navigation tabs (enrolled only)
  │     ├─ Per-course progress overview
  │     └─ Switch between courses
  │
  ├─► AI Recommendations
  │     ├─ Course Manager analyzes: SOWV2 + MasteryV2
  │     ├─ Prioritized lesson suggestions
  │     └─ Reasons for each recommendation
  │
  └─► Quick Actions
        ├─ Continue last lesson
        ├─ Start recommended lesson
        └─ Browse all lessons in course

Stage 4: LESSON EXECUTION
  │
  ├─► Start Lesson
  │     ├─ Create session record (sessions collection)
  │     ├─ Load lesson snapshot from template
  │     ├─ Initialize LangGraph teaching thread
  │     └─ Navigate to session interface
  │
  ├─► Interactive Learning
  │     ├─ Lesson cards (concept, example, practice)
  │     ├─ Student responses via AI tutor
  │     ├─ Evidence collection (evidence collection)
  │     └─ Context chat for help
  │
  └─► Lesson Completion
        ├─ Final assessment and feedback
        ├─ Update MasteryV2 (per outcome)
        ├─ Mark session as done
        └─ Return to dashboard

Stage 5: PROGRESS TRACKING
  │
  ├─► Course Progress View
  │     ├─ Completed lessons count
  │     ├─ Mastery levels by outcome
  │     ├─ Time spent learning
  │     └─ Suggested next steps
  │
  ├─► Outcome Mastery Dashboard
  │     ├─ Visual mastery levels (0-1 scale)
  │     ├─ Outcome-specific feedback
  │     └─ Practice recommendations
  │
  └─► Course Completion
        ├─ All lessons completed
        ├─ Mastery thresholds met
        ├─ Certificate/completion badge
        └─ Enroll in next level suggestion

Stage 6: MULTI-COURSE MANAGEMENT
  │
  ├─► Switch Between Courses
  │     ├─ Course tabs in dashboard
  │     ├─ Independent SOWV2 per course
  │     └─ Separate progress tracking
  │
  └─► Enroll in Additional Courses
        └─ Return to course catalog anytime
```

---

## Data Model Integration

### Collections Used in User Journey

#### 1. Authentication & Profile
```typescript
// Appwrite Auth → students collection
interface Student {
  $id: string;
  userId: string;              // FK to Appwrite Auth
  name: string;
  role: 'student';
  accommodations: string;      // JSON array
  enrolledCourses: string;     // JSON array (deprecated - use enrollments)
}
```

#### 2. Course Discovery
```typescript
// courses collection (public read)
interface Course {
  $id: string;
  courseId: string;            // PK: "C844 73", "course_c84473"
  subject: string;             // "application-of-mathematics"
  level: string;               // "national-3", "national-4", "national-5"
  schema_version: number;
}

// course_outcomes collection (public read)
interface CourseOutcome {
  courseId: string;
  outcomeRef: string;
  outcomeTitle: string;
  assessmentStandards: string; // JSON
  teacherGuidance: string;
  keywords: string;            // JSON
}
```

#### 3. Enrollment Pipeline
```typescript
// enrollments collection (user-scoped)
interface Enrollment {
  $id: string;
  studentId: string;           // FK to students
  courseId: string;            // FK to courses
  role: 'student';
  enrolledAt: string;          // ISO datetime
}

// Triggered by enrollment: SOWV2 creation
// Authored_SOW collection (template, public)
interface AuthoredSOW {
  courseId: string;
  version: string;
  entries: string;             // JSON curriculum template
  metadata: string;
  status: 'published';
}

// SOWV2 collection (instance, user-scoped)
interface SOWV2 {
  studentId: string;
  courseId: string;
  entries: string;             // JSON personalized curriculum
  source_authored_sow_id: string; // FK to Authored_SOW
  source_version: string;
  customizations: string;      // JSON student-specific changes
}

// MasteryV2 collection (initialized at enrollment)
interface MasteryV2 {
  studentId: string;
  courseId: string;
  emaByOutcome: string;        // JSON: {"outcome1": 0.0, ...}
  updatedAt: string;
}
```

#### 4. Learning Execution
```typescript
// sessions collection
interface Session {
  studentId: string;
  courseId: string;
  lessonTemplateId: string;
  lessonSnapshot: string;      // Frozen lesson content
  threadId: string;            // LangGraph teaching thread
  contextChatThreadId: string;
  stage: 'design' | 'deliver' | 'mark' | 'progress' | 'done';
  startedAt: string;
  endedAt: string;
}

// evidence collection
interface Evidence {
  sessionId: string;
  itemId: string;              // Lesson card ID
  response: string;            // Student answer
  correct: boolean;
  score: number;               // 0-1
  outcomeScores: string;       // JSON: {"outcome1": 0.8, ...}
  attempts: number;
  feedback: string;
}
```

#### 5. Recommendations
```typescript
// planner_threads collection (Course Manager state)
interface PlannerThread {
  studentId: string;
  courseId: string;
  graphRunId: string;          // LangGraph thread ID
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MVP2 DATA FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

ONBOARDING FLOW:
  Appwrite Auth (new user)
    ↓
  Create students record
    ↓
  Redirect to course catalog

ENROLLMENT FLOW:
  Browse courses collection (public read)
    ↓
  Select course → Create enrollments record
    ↓
  Enrollment Service:
    ├─► Query Authored_SOW (latest version for courseId)
    ├─► Create SOWV2 (personalized from template)
    │     └─ Set source_authored_sow_id, source_version
    └─► Initialize MasteryV2 (empty emaByOutcome map)
    ↓
  Dashboard shows enrolled course

RECOMMENDATION FLOW:
  Dashboard loads for enrolled course
    ↓
  Course Manager context:
    ├─ Student data (students)
    ├─ Course data (courses)
    ├─ Lesson templates (lesson_templates)
    ├─ Mastery data (MasteryV2.emaByOutcome)
    └─ SOW schedule (SOWV2.entries)
    ↓
  LangGraph Course Manager (port 2024)
    ├─ Analyze overdue lessons (SOWV2.plannedAt)
    ├─ Analyze low mastery outcomes (MasteryV2)
    ├─ Apply prioritization rubric
    └─ Return course_recommendation
    ↓
  Display recommended lessons

LESSON EXECUTION FLOW:
  Student starts lesson
    ↓
  Create sessions record
    ├─ lessonTemplateId → load template
    ├─ lessonSnapshot (frozen content)
    └─ threadId (new LangGraph thread)
    ↓
  Teaching Graph (graph_interrupt.py)
    ├─ Present lesson cards (tool calls + interrupts)
    ├─ Collect student responses
    └─ Provide feedback
    ↓
  Evidence collection:
    └─ Create evidence records per card
        ├─ response, correct, score
        └─ outcomeScores (per outcome)
    ↓
  Update MasteryV2:
    └─ Apply EMA algorithm to emaByOutcome
        └─ Per-outcome scores from evidence
    ↓
  Mark session as done
    ↓
  Return to dashboard
```

---

## Journey Stages

### Stage 1: Authentication & Onboarding

#### 1.1 First-Time Login

**Entry Point**: `/` or `/login`

**User Actions**:
1. User enters email/password (or signs up)
2. Appwrite Auth creates user account
3. System checks for existing student record

**System Behavior**:
```typescript
// In initializeStudent() - EnhancedStudentDashboard.tsx
const user = await account.get();
const studentsResult = await databases.listDocuments('default', 'students',
  [Query.equal('userId', user.$id)]
);

if (studentsResult.documents.length === 0) {
  // NEW USER - Redirect to onboarding
  router.push('/onboarding');
} else {
  // EXISTING USER - Check enrollments
  const enrollmentsResult = await databases.listDocuments('default', 'enrollments',
    [Query.equal('studentId', student.$id)]
  );

  if (enrollmentsResult.documents.length === 0) {
    // NO ENROLLMENTS - Redirect to course catalog
    router.push('/courses/catalog');
  } else {
    // HAS ENROLLMENTS - Show dashboard
    // Continue with dashboard initialization
  }
}
```

**New Component**: `OnboardingWizard.tsx`

```typescript
// File: assistant-ui-frontend/components/onboarding/OnboardingWizard.tsx

interface OnboardingStep {
  title: string;
  description: string;
  component: React.ReactNode;
}

const OnboardingWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      title: "Welcome to Scottish AI Lessons",
      description: "Let's get you started on your learning journey",
      component: <WelcomeStep />
    },
    {
      title: "Tell us about yourself",
      description: "Help us personalize your experience",
      component: <ProfileStep />  // Name, accommodations
    },
    {
      title: "Choose your first course",
      description: "Browse our course catalog",
      component: <CourseCatalogStep />
    }
  ];

  // Wizard navigation logic
};
```

**Data Created**:
```typescript
// students collection
{
  userId: user.$id,
  name: "Student Name",
  role: "student",
  accommodations: JSON.stringify([
    "text-to-speech",
    "extra-time"
  ]),
  enrolledCourses: "[]"  // Deprecated, use enrollments
}
```

#### 1.2 Returning Login

**Entry Point**: `/` or `/login`

**User Actions**:
1. User enters credentials
2. System authenticates

**System Behavior**:
```typescript
// Existing student with enrollments
if (student && enrollments.length > 0) {
  // Direct to dashboard
  router.push('/dashboard');
}
```

### Stage 2: Course Discovery & Enrollment

#### 2.1 Course Catalog

**New Component**: `CourseCatalog.tsx`

**Location**: `assistant-ui-frontend/components/courses/CourseCatalog.tsx`

**Features**:
- Grid/list view of available courses
- Filters: Level (National 3/4/5), Subject
- Course cards showing:
  - Course title (subject + level)
  - Number of lessons
  - Estimated duration
  - Learning outcomes preview
  - Enrollment status (enrolled/not enrolled)

**Data Source**:
```typescript
// Query all published courses
const coursesResult = await databases.listDocuments('default', 'courses');

// For each course, query outcomes
const outcomesResult = await databases.listDocuments('default', 'course_outcomes',
  [Query.equal('courseId', course.courseId)]
);

// Check if student is already enrolled
const enrollmentCheck = await databases.listDocuments('default', 'enrollments',
  [
    Query.equal('studentId', student.$id),
    Query.equal('courseId', course.courseId)
  ]
);
```

**UI Mockup**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Course Catalog                                   🔍 Search      │
├─────────────────────────────────────────────────────────────────┤
│  Filters:  [All Levels ▼] [All Subjects ▼]                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │ Application of Math  │  │ Mathematics          │            │
│  │ National 3          │  │ National 4          │            │
│  │                      │  │                      │            │
│  │ 25 lessons          │  │ 30 lessons          │            │
│  │ ~15 hours           │  │ ~20 hours           │            │
│  │                      │  │                      │            │
│  │ ✓ Enrolled          │  │ [Enroll Now]        │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2 Course Detail View

**New Component**: `CourseDetailView.tsx`

**Location**: `assistant-ui-frontend/components/courses/CourseDetailView.tsx`

**Route**: `/courses/:courseId`

**Features**:
- Full course description
- Complete list of learning outcomes
- Lesson structure preview (from Authored_SOW)
- Prerequisite courses (if any)
- Enrollment button

**Data Source**:
```typescript
// Course details
const course = await databases.getDocument('default', 'courses', courseId);

// Learning outcomes
const outcomes = await databases.listDocuments('default', 'course_outcomes',
  [Query.equal('courseId', course.courseId)]
);

// Authored SOW (curriculum structure)
const authoredSOW = await databases.listDocuments('default', 'Authored_SOW',
  [
    Query.equal('courseId', course.courseId),
    Query.equal('status', 'published'),
    Query.orderDesc('version'),
    Query.limit(1)
  ]
);

// Parse entries for lesson preview
const sowEntries = JSON.parse(authoredSOW.documents[0].entries);
```

#### 2.3 Enrollment Flow

**New Service**: `enrollment-service.ts`

**Location**: `assistant-ui-frontend/lib/services/enrollment-service.ts`

**Core Function**:
```typescript
export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<{
  enrollment: Enrollment;
  sowv2: SOWV2;
  masteryv2: MasteryV2;
}> {
  // 1. Check if already enrolled
  const existingEnrollment = await databases.listDocuments(
    'default',
    'enrollments',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (existingEnrollment.documents.length > 0) {
    throw new Error('Student already enrolled in this course');
  }

  // 2. Create enrollment record
  const enrollment = await databases.createDocument(
    'default',
    'enrollments',
    ID.unique(),
    {
      studentId,
      courseId,
      role: 'student',
      enrolledAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );

  // 3. Get latest Authored_SOW template
  const authoredSOWResult = await databases.listDocuments(
    'default',
    'Authored_SOW',
    [
      Query.equal('courseId', courseId),
      Query.equal('status', 'published'),
      Query.orderDesc('version'),
      Query.limit(1)
    ]
  );

  if (authoredSOWResult.documents.length === 0) {
    throw new Error(
      `No published Authored_SOW found for course ${courseId}. ` +
      `Cannot create personalized curriculum.`
    );
  }

  const authoredSOW = authoredSOWResult.documents[0];

  // 4. Create personalized SOWV2 from template
  const sowv2 = await databases.createDocument(
    'default',
    'SOWV2',
    ID.unique(),
    {
      studentId,
      courseId,
      entries: authoredSOW.entries,  // Copy template entries
      source_authored_sow_id: authoredSOW.$id,
      source_version: authoredSOW.version,
      customizations: JSON.stringify({}),  // Empty initially
      createdAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );

  // 5. Initialize MasteryV2 with empty outcome map
  const courseOutcomes = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId)]
  );

  const initialEmaByOutcome: Record<string, number> = {};
  courseOutcomes.documents.forEach(outcome => {
    initialEmaByOutcome[outcome.outcomeRef] = 0.0;  // Start at 0 mastery
  });

  const masteryv2 = await databases.createDocument(
    'default',
    'MasteryV2',
    ID.unique(),
    {
      studentId,
      courseId,
      emaByOutcome: JSON.stringify(initialEmaByOutcome),
      updatedAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );

  console.log('[Enrollment Service] Successfully enrolled student:', {
    enrollmentId: enrollment.$id,
    sowv2Id: sowv2.$id,
    masteryv2Id: masteryv2.$id,
    outcomeCount: courseOutcomes.documents.length
  });

  return { enrollment, sowv2, masteryv2 };
}
```

**Error Handling**:
- No Authored_SOW template → Show error, suggest contacting admin
- Duplicate enrollment → Show "Already enrolled" message
- Database errors → Rollback with detailed logging

**UI Flow**:
```typescript
// In CourseDetailView.tsx
const handleEnroll = async () => {
  setEnrolling(true);
  try {
    const result = await enrollStudentInCourse(
      student.$id,
      course.courseId,
      databases
    );

    // Success toast
    toast.success(`Enrolled in ${course.subject} ${course.level}!`);

    // Redirect to dashboard with new course active
    router.push(`/dashboard?course=${course.courseId}`);
  } catch (error) {
    toast.error(error.message);
  } finally {
    setEnrolling(false);
  }
};
```

### Stage 3: Learning Dashboard (Enhanced)

#### 3.1 Dashboard Architecture

**Updated Component**: `EnhancedStudentDashboard.tsx`

**Key Changes from MVP1**:

```typescript
// OLD (MVP1): Fetch ALL courses
const coursesResult = await databases.listDocuments('default', 'courses');

// NEW (MVP2): Fetch only enrolled courses
const enrollmentsResult = await databases.listDocuments(
  'default',
  'enrollments',
  [Query.equal('studentId', student.$id)]
);

const enrolledCourseIds = enrollmentsResult.documents.map(e => e.courseId);

if (enrolledCourseIds.length === 0) {
  // NO ENROLLMENTS - Redirect to course catalog
  router.push('/courses/catalog');
  return;
}

const coursesResult = await databases.listDocuments(
  'default',
  'courses',
  [Query.equal('courseId', enrolledCourseIds)]
);
```

**Dashboard Sections**:

1. **Header Section**:
   - Welcome message with student name
   - Course count badge
   - Quick action: "Browse More Courses" button

2. **Course Navigation Tabs**:
   - Only enrolled courses shown
   - Each tab shows course name + progress percentage
   - Active course highlighted

3. **Active Course Overview Card** (NEW):
   ```typescript
   interface CourseOverview {
     courseId: string;
     courseName: string;
     totalLessons: number;
     completedLessons: number;
     progressPercentage: number;
     averageMastery: number;  // Avg of all outcomes in MasteryV2
     lastActivity: string;    // ISO datetime
     estimatedTimeRemaining: number;  // Minutes
   }
   ```

4. **Recommendations Section**:
   - Title: "Recommended Next Lessons"
   - Powered by Course Manager
   - Shows 3-5 top recommendations with:
     - Lesson title
     - Priority score
     - Reasons (overdue, low mastery, etc.)
     - "Start Lesson" button

5. **Recent Activity Section** (NEW):
   - Last 5 sessions
   - Session date, lesson name, outcome

6. **Quick Actions**:
   - Continue last lesson (if incomplete session exists)
   - Browse all lessons
   - View progress report

#### 3.2 Progress Calculation

**New Service**: `progress-service.ts`

**Location**: `assistant-ui-frontend/lib/services/progress-service.ts`

```typescript
export async function getCourseProgress(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<CourseProgress> {
  // 1. Get SOWV2 entries (total lessons in curriculum)
  const sowv2Result = await databases.listDocuments('default', 'SOWV2',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (sowv2Result.documents.length === 0) {
    throw new Error('No SOWV2 found for enrollment');
  }

  const sowEntries = JSON.parse(sowv2Result.documents[0].entries);
  const totalLessons = sowEntries.length;

  // 2. Get completed sessions
  const sessionsResult = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('stage', 'done')
    ]
  );

  const completedLessons = sessionsResult.documents.length;
  const progressPercentage = (completedLessons / totalLessons) * 100;

  // 3. Get average mastery
  const masteryV2Result = await databases.listDocuments('default', 'MasteryV2',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  let averageMastery = 0;
  if (masteryV2Result.documents.length > 0) {
    const emaByOutcome = JSON.parse(masteryV2Result.documents[0].emaByOutcome);
    const masteryValues = Object.values(emaByOutcome) as number[];
    averageMastery = masteryValues.reduce((sum, val) => sum + val, 0) / masteryValues.length;
  }

  // 4. Get last activity
  const recentSessions = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.orderDesc('startedAt'),
      Query.limit(1)
    ]
  );

  const lastActivity = recentSessions.documents[0]?.startedAt || null;

  // 5. Estimate time remaining
  const avgMinutesPerLesson = 30;  // From lesson templates estMinutes
  const estimatedTimeRemaining = (totalLessons - completedLessons) * avgMinutesPerLesson;

  return {
    courseId,
    totalLessons,
    completedLessons,
    progressPercentage,
    averageMastery,
    lastActivity,
    estimatedTimeRemaining
  };
}
```

#### 3.3 Recommendations Integration

**Updated**: `loadRecommendations()` in `EnhancedStudentDashboard.tsx`

**Key Requirement**: SOWV2 must exist (created during enrollment)

**Context Structure**:
```typescript
const context = {
  mode: "course_manager",
  student: {
    id: student.$id,
    name: student.name,
    email: student.email || `${student.name}@example.com`
  },
  course: {
    $id: course.$id,
    courseId: course.courseId,
    subject: course.subject
  },
  templates: lessonTemplates.map(t => ({
    $id: t.$id,
    title: t.title,
    outcomeRefs: JSON.parse(t.outcomeRefs),
    estMinutes: t.estMinutes
  })),
  mastery: Object.entries(emaByOutcome).map(([outcomeRef, ema]) => ({
    outcomeRef,
    masteryLevel: ema
  })),
  sow: sowEntries.map(entry => ({
    templateId: entry.lessonTemplateId,
    order: entry.order,
    plannedAt: entry.plannedAt
  }))
};
```

**Error Handling**:
```typescript
// If SOWV2 missing (should never happen with proper enrollment)
if (sowResult.documents.length === 0) {
  throw new Error(
    `No SOWV2 data found for student: ${student.$id}, course: ${courseId}. ` +
    `Enrollment may be incomplete. Please re-enroll or contact support.`
  );
}
```

### Stage 4: Lesson Execution

**No Changes Required** - Existing implementation in:
- `SessionChatAssistant.tsx`
- `MyAssistant.tsx`
- `LessonCardPresentationTool.tsx`
- Teaching graph: `teacher_graph_toolcall_interrupt.py`

**Integration Point**: `handleStartLesson()` in dashboard

```typescript
// Updated to use enrollment-aware session creation
const handleStartLesson = async (lessonTemplateId: string) => {
  // Validate enrollment exists
  const enrollmentCheck = await databases.listDocuments('default', 'enrollments',
    [
      Query.equal('studentId', student.$id),
      Query.equal('courseId', activeCourse)
    ]
  );

  if (enrollmentCheck.documents.length === 0) {
    throw new Error('Not enrolled in this course. Please enroll first.');
  }

  // Continue with existing session creation logic
  const newSession = await createLessonSession({
    lessonTemplateId,
    studentId: student.$id,
    courseId: activeCourse,
    threadId: recommendations?.thread_id
  });

  router.push(`/session/${newSession.$id}`);
};
```

### Stage 5: Progress Tracking

#### 5.1 Course Progress View

**New Component**: `CourseProgressView.tsx`

**Location**: `assistant-ui-frontend/components/progress/CourseProgressView.tsx`

**Route**: `/dashboard/progress/:courseId`

**Features**:
- Overall course completion percentage
- Lessons completed vs. total
- Time spent in course (sum of session durations)
- Outcome mastery breakdown (visual chart)
- Recent session history
- Download progress report (PDF)

**Data Sources**:
```typescript
// 1. Course progress (from progress-service.ts)
const progress = await getCourseProgress(studentId, courseId, databases);

// 2. Sessions history
const sessions = await databases.listDocuments('default', 'sessions',
  [
    Query.equal('studentId', studentId),
    Query.equal('courseId', courseId),
    Query.orderDesc('startedAt')
  ]
);

// 3. Outcome mastery details
const masteryV2 = await databases.listDocuments('default', 'MasteryV2',
  [
    Query.equal('studentId', studentId),
    Query.equal('courseId', courseId)
  ]
);

const emaByOutcome = JSON.parse(masteryV2.documents[0].emaByOutcome);

// 4. Outcome metadata (for display names)
const outcomes = await databases.listDocuments('default', 'course_outcomes',
  [Query.equal('courseId', courseId)]
);
```

**UI Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Course Progress: Application of Mathematics - National 3       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Overall Progress: ██████████░░░░░░░░░░ 50% (12 of 24 lessons) │
│  Time Spent: 6.5 hours                                          │
│  Average Mastery: 0.65 (Developing)                             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Outcome Mastery Breakdown                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Outcome 1.1: Calculate percentages                       │   │
│  │ Mastery: ████████░░ 0.80 (Good)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Outcome 1.2: Apply fractions                             │   │
│  │ Mastery: ██████░░░░ 0.60 (Developing)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Recent Sessions                                                │
│                                                                  │
│  2025-10-05  Lesson: Percentages Practice     ✓ Completed      │
│  2025-10-03  Lesson: Fractions Introduction   ✓ Completed      │
│  2025-10-01  Lesson: Number Systems           ✓ Completed      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2 Mastery Visualization

**Mastery Scale**:
- 0.0 - 0.3: Beginner (Red)
- 0.3 - 0.5: Developing (Orange)
- 0.5 - 0.7: Good (Yellow)
- 0.7 - 0.9: Strong (Light Green)
- 0.9 - 1.0: Mastered (Dark Green)

**Chart Library**: Recharts or Chart.js for outcome mastery visualization

#### 5.3 Course Completion

**Completion Criteria**:
```typescript
interface CourseCompletionCheck {
  allLessonsCompleted: boolean;     // All SOWV2 entries have sessions
  minimumMasteryMet: boolean;       // Avg mastery >= 0.7
  timeRequirementMet: boolean;      // Optional: min hours spent
}

function checkCourseCompletion(
  sessions: Session[],
  sowEntries: SOWEntry[],
  masteryV2: MasteryV2
): CourseCompletionCheck {
  // Check if all SOW lessons have completed sessions
  const completedLessonIds = new Set(
    sessions.filter(s => s.stage === 'done').map(s => s.lessonTemplateId)
  );

  const requiredLessonIds = sowEntries.map(e => e.lessonTemplateRef);
  const allLessonsCompleted = requiredLessonIds.every(id => completedLessonIds.has(id));

  // Check average mastery
  const emaByOutcome = JSON.parse(masteryV2.emaByOutcome);
  const masteryValues = Object.values(emaByOutcome) as number[];
  const avgMastery = masteryValues.reduce((sum, v) => sum + v, 0) / masteryValues.length;
  const minimumMasteryMet = avgMastery >= 0.7;

  return {
    allLessonsCompleted,
    minimumMasteryMet,
    timeRequirementMet: true  // Not enforced in MVP2
  };
}
```

**Completion UI**:
- Confetti animation on dashboard
- "Course Completed!" badge
- Certificate download (PDF with student name, course, completion date)
- Suggestion to enroll in next level

### Stage 6: Multi-Course Management

#### 6.1 Course Switching

**Updated**: Course navigation tabs in dashboard

**Requirements**:
- Each enrolled course has independent:
  - SOWV2 (personalized curriculum)
  - MasteryV2 (outcome mastery tracking)
  - Recommendations (from Course Manager)
  - Progress tracking

**Implementation**:
```typescript
// When user switches course tab
const handleCourseChange = async (courseId: string) => {
  setActiveCourse(courseId);

  // Load course-specific data
  const [progress, recommendations] = await Promise.all([
    getCourseProgress(student.$id, courseId, databases),
    loadRecommendations(courseId, student)
  ]);

  setCourseProgress(progress);
  setRecommendations(recommendations);
};
```

#### 6.2 Enroll in Additional Courses

**Access Point**: "Browse More Courses" button in dashboard header

**Flow**:
1. Click button → Navigate to `/courses/catalog`
2. Course catalog filters out already enrolled courses
3. Select new course → Enroll (creates enrollment, SOWV2, MasteryV2)
4. Return to dashboard with new course added to tabs

---

## UI Component Specifications

### New Components Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `OnboardingWizard.tsx` | `components/onboarding/` | First-time user welcome flow |
| `WelcomeStep.tsx` | `components/onboarding/` | Onboarding step 1 |
| `ProfileStep.tsx` | `components/onboarding/` | Onboarding step 2 (name, accommodations) |
| `CourseCatalogStep.tsx` | `components/onboarding/` | Onboarding step 3 (first enrollment) |
| `CourseCatalog.tsx` | `components/courses/` | Browse/filter available courses |
| `CourseCard.tsx` | `components/courses/` | Individual course display card |
| `CourseDetailView.tsx` | `components/courses/` | Full course information page |
| `CourseProgressView.tsx` | `components/progress/` | Detailed progress tracking |
| `OutcomeMasteryChart.tsx` | `components/progress/` | Visual mastery breakdown |

### Updated Components Summary

| Component | Changes Required |
|-----------|------------------|
| `EnhancedStudentDashboard.tsx` | Filter by enrollments, add progress overview, add "Browse Courses" button |
| `CourseNavigationTabs.tsx` | Only show enrolled courses, add progress badges |
| `RecommendationSection.tsx` | Handle enrollment-aware errors |

### New Services Summary

| Service | Location | Purpose |
|---------|----------|---------|
| `enrollment-service.ts` | `lib/services/` | Enrollment pipeline (enrollment → SOWV2 → MasteryV2) |
| `progress-service.ts` | `lib/services/` | Course progress calculation |

---

## Backend Integration

### LangGraph Changes

**No changes required** to existing graphs:
- `graph_interrupt.py` (main graph)
- `teacher_graph_toolcall_interrupt.py` (teaching subgraph)
- `course_manager_graph.py` (course manager subgraph)

**Reason**: Backend already supports enrollment-aware flows via session_context

### Appwrite Schema Validation

**New Validation Rules**:

```typescript
// In enrollment-service.ts
import { z } from 'zod';

const EnrollmentSchema = z.object({
  studentId: z.string().min(1).max(50),
  courseId: z.string().min(1).max(50),
  role: z.enum(['student', 'observer']),
  enrolledAt: z.string().datetime()
});

// Validate before creating enrollment
const validated = EnrollmentSchema.parse({
  studentId,
  courseId,
  role: 'student',
  enrolledAt: new Date().toISOString()
});
```

### New Indexes Required

**Appwrite Console Configuration**:

1. **enrollments collection**:
   - Add compound index: `(studentId, courseId)` - UNIQUE
   - Purpose: Prevent duplicate enrollments, fast lookup

2. **SOWV2 collection**:
   - Existing: `unique_student_course` on `(studentId, courseId)`
   - Purpose: One SOW per student per course

3. **MasteryV2 collection**:
   - Existing: `unique_student_course` on `(studentId, courseId)`
   - Purpose: One mastery record per student per course

---

## Error Handling & Edge Cases

### 1. Enrollment Errors

#### Missing Authored_SOW Template

**Scenario**: Student tries to enroll in course with no published Authored_SOW

**Error**:
```
No published curriculum template found for this course.
Please contact support or try another course.
```

**UI**: Show error in course detail view, disable "Enroll" button

**Prevention**: Admin dashboard should flag courses without Authored_SOW

#### Duplicate Enrollment

**Scenario**: Student tries to enroll twice in same course

**Error**:
```
You are already enrolled in this course.
Visit your dashboard to continue learning.
```

**UI**: Show "Already Enrolled" button (disabled) in course catalog

#### Database Transaction Failure

**Scenario**: Enrollment created but SOWV2 creation fails

**Mitigation**:
```typescript
try {
  const enrollment = await createEnrollment();
  try {
    const sowv2 = await createSOWV2();
    const masteryv2 = await initializeMasteryV2();
  } catch (sowError) {
    // Rollback enrollment
    await databases.deleteDocument('default', 'enrollments', enrollment.$id);
    throw new Error('Enrollment failed. Please try again.');
  }
} catch (error) {
  // Log to error tracking service
  console.error('[Enrollment] Critical failure:', error);
  throw error;
}
```

### 2. Dashboard Errors

#### No Enrollments (New User)

**Scenario**: Returning user with student profile but no enrollments

**Behavior**: Redirect to course catalog with message:
```
Welcome back! You haven't enrolled in any courses yet.
Browse our catalog to get started.
```

#### Missing SOWV2 Data

**Scenario**: Enrollment exists but SOWV2 missing (data corruption)

**Error**:
```
Course data incomplete. Please re-enroll in this course
or contact support for assistance.
```

**UI**: Show error in dashboard with "Fix Enrollment" button that:
1. Deletes broken enrollment
2. Re-runs enrollment service
3. Recreates SOWV2 and MasteryV2

#### Course Deleted After Enrollment

**Scenario**: Course removed from catalog but student still enrolled

**Behavior**:
- Keep enrollment active (historical data)
- Show course as "Archived" in dashboard
- Disable new lesson starts
- Allow viewing progress/completed sessions

### 3. Recommendation Errors

#### No Lesson Templates

**Scenario**: Course has Authored_SOW but no generated lesson templates

**Error**:
```
Lessons are still being prepared for this course.
Please check back later or contact support.
```

**Prevention**: Authored_SOW seeding should trigger lesson template generation

#### Course Manager Failure

**Scenario**: LangGraph backend offline or error in Course Manager

**Error**:
```
Unable to generate recommendations at this time.
You can browse all lessons manually.
```

**UI**: Show error in recommendations section, show "Browse All Lessons" fallback

### 4. Session Errors

#### Missing Lesson Template

**Scenario**: Student tries to start lesson with deleted template

**Error**:
```
This lesson is no longer available.
Please select another lesson.
```

**Prevention**: Soft delete lesson templates (mark as archived, don't delete)

---

## Success Metrics

### User Engagement Metrics

1. **Enrollment Conversion Rate**:
   - % of new users who complete onboarding and enroll in first course
   - Target: 80%+

2. **Course Completion Rate**:
   - % of enrolled students who complete all lessons
   - Target: 40%+ (industry standard for self-paced learning)

3. **Multi-Course Adoption**:
   - % of students enrolled in 2+ courses
   - Target: 30%+

4. **Daily Active Users (DAU)**:
   - Students who start at least one session per day
   - Target: 50% of enrolled students

### Learning Outcome Metrics

1. **Average Mastery Score**:
   - Mean of all MasteryV2.emaByOutcome values across students
   - Target: 0.65+ (Developing to Good)

2. **Lesson Completion Time**:
   - Actual time vs. estimated time (lesson_templates.estMinutes)
   - Target: Within 20% variance

3. **First-Attempt Success Rate**:
   - % of practice cards answered correctly on first attempt
   - Target: 60%+

### System Performance Metrics

1. **Dashboard Load Time**:
   - Time from login to dashboard ready
   - Target: < 2 seconds

2. **Enrollment Pipeline Success Rate**:
   - % of enrollments that successfully create SOWV2 + MasteryV2
   - Target: 99.5%+

3. **Recommendation Generation Time**:
   - Course Manager LangGraph execution time
   - Target: < 5 seconds

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)

**Goal**: Setup foundational services and data flows

- [ ] Create `enrollment-service.ts` with full pipeline
- [ ] Create `progress-service.ts` for metrics
- [ ] Add enrollment-related indexes to Appwrite
- [ ] Update `EnhancedStudentDashboard.tsx` to filter by enrollments
- [ ] Add enrollment validation to existing flows
- [ ] Write unit tests for enrollment pipeline

**Deliverables**:
- Working enrollment service (enrollment → SOWV2 → MasteryV2)
- Dashboard shows enrolled courses only
- Progress calculations accurate

### Phase 2: Onboarding & Course Discovery (Week 2)

**Goal**: Build new user experience

- [ ] Create `OnboardingWizard.tsx` component
- [ ] Create `WelcomeStep.tsx` (welcome message)
- [ ] Create `ProfileStep.tsx` (name, accommodations input)
- [ ] Create `CourseCatalogStep.tsx` (first enrollment)
- [ ] Create `CourseCatalog.tsx` (full catalog view)
- [ ] Create `CourseCard.tsx` (course display component)
- [ ] Create `CourseDetailView.tsx` (course information page)
- [ ] Update authentication flow to route new users to onboarding
- [ ] Add "Browse More Courses" to dashboard

**Deliverables**:
- Complete onboarding flow for new users
- Course catalog with filters and search
- Course detail pages with enrollment buttons

### Phase 3: Progress Tracking (Week 3)

**Goal**: Build progress visibility

- [ ] Create `CourseProgressView.tsx` component
- [ ] Create `OutcomeMasteryChart.tsx` (visual mastery breakdown)
- [ ] Add progress overview card to dashboard
- [ ] Implement course completion checks
- [ ] Add "View Progress" links throughout UI
- [ ] Create progress report export (PDF)

**Deliverables**:
- Detailed progress tracking views
- Course completion detection
- Visual mastery charts

### Phase 4: Polish & Testing (Week 4)

**Goal**: Production-ready quality

- [ ] Comprehensive error handling for all flows
- [ ] Loading states and skeleton screens
- [ ] Empty states (no enrollments, no courses, etc.)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile responsive design
- [ ] End-to-end testing with Playwright
- [ ] Performance optimization (lazy loading, caching)
- [ ] Documentation updates (README.md)

**Deliverables**:
- Production-ready MVP2
- Full test coverage
- Accessibility compliance
- Updated documentation

### Phase 5: Deployment & Monitoring (Week 5)

**Goal**: Launch MVP2

- [ ] Staging environment deployment
- [ ] User acceptance testing (UAT)
- [ ] Production deployment
- [ ] Analytics integration (PostHog/Mixpanel)
- [ ] Error monitoring (Sentry)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] User feedback collection mechanism

**Deliverables**:
- Live MVP2 application
- Monitoring dashboards
- Feedback collection active

---

## Appendix A: Database Migration Plan

### Migrating Existing MVP1 Students

**Scenario**: Students who logged in during MVP1 have:
- Student profile (✓)
- Auto-enrollment in C844 73 (✓)
- NO SOWV2 (✗)
- NO proper MasteryV2 (✗)

**Migration Script**:

```typescript
// File: scripts/migrate-mvp1-to-mvp2.ts

async function migrateMVP1Student(studentId: string) {
  const databases = /* ... initialize Appwrite */;

  // 1. Get existing enrollments
  const enrollments = await databases.listDocuments('default', 'enrollments',
    [Query.equal('studentId', studentId)]
  );

  for (const enrollment of enrollments.documents) {
    const courseId = enrollment.courseId;

    // 2. Check if SOWV2 exists
    const sowv2Check = await databases.listDocuments('default', 'SOWV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    if (sowv2Check.documents.length === 0) {
      console.log(`Creating SOWV2 for student ${studentId}, course ${courseId}`);

      // Get Authored_SOW template
      const authoredSOW = await databases.listDocuments('default', 'Authored_SOW',
        [
          Query.equal('courseId', courseId),
          Query.equal('status', 'published'),
          Query.orderDesc('version'),
          Query.limit(1)
        ]
      );

      if (authoredSOW.documents.length === 0) {
        console.error(`No Authored_SOW for course ${courseId}, skipping`);
        continue;
      }

      // Create SOWV2
      await databases.createDocument('default', 'SOWV2', ID.unique(), {
        studentId,
        courseId,
        entries: authoredSOW.documents[0].entries,
        source_authored_sow_id: authoredSOW.documents[0].$id,
        source_version: authoredSOW.documents[0].version,
        customizations: JSON.stringify({}),
        createdAt: new Date().toISOString()
      });
    }

    // 3. Check if MasteryV2 exists
    const masteryV2Check = await databases.listDocuments('default', 'MasteryV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    if (masteryV2Check.documents.length === 0) {
      console.log(`Creating MasteryV2 for student ${studentId}, course ${courseId}`);

      // Get course outcomes
      const outcomes = await databases.listDocuments('default', 'course_outcomes',
        [Query.equal('courseId', courseId)]
      );

      const initialEmaByOutcome: Record<string, number> = {};
      outcomes.documents.forEach(outcome => {
        initialEmaByOutcome[outcome.outcomeRef] = 0.0;
      });

      await databases.createDocument('default', 'MasteryV2', ID.unique(), {
        studentId,
        courseId,
        emaByOutcome: JSON.stringify(initialEmaByOutcome),
        updatedAt: new Date().toISOString()
      });
    }
  }

  console.log(`Migration complete for student ${studentId}`);
}
```

**Execution Plan**:
1. Run migration script for all existing students
2. Log any failures for manual review
3. Verify SOWV2 and MasteryV2 created for all enrollments
4. Deploy MVP2 code

---

## Appendix B: Future Enhancements (Out of Scope for MVP2)

### Routine & Spaced Repetition

**Data Model**: Already exists (`routine` collection)

**Feature**:
- Track last practice date per outcome
- Calculate next review date using spaced repetition algorithm
- Course Manager prioritizes overdue reviews

**Implementation Effort**: 2-3 weeks

### Social Learning Features

**Features**:
- Student discussion forums per course
- Peer study groups
- Leaderboards (optional, opt-in)

**Implementation Effort**: 4-6 weeks

### Teacher Dashboard

**Features**:
- View all enrolled students
- Monitor class progress
- Assign specific lessons
- Custom SOW modifications per student

**Implementation Effort**: 6-8 weeks

### Advanced Analytics

**Features**:
- Learning path visualizations
- Predictive success modeling
- Personalized intervention suggestions
- Export to SQA reporting formats

**Implementation Effort**: 4-6 weeks

---

## Appendix C: Testing Scenarios

### Onboarding Flow Tests

1. **Happy Path**: New user → onboarding → enroll → dashboard
2. **Skip Onboarding**: Returning user → direct to dashboard
3. **Incomplete Onboarding**: User closes browser mid-wizard
4. **Multiple Devices**: Start onboarding on mobile, complete on desktop

### Enrollment Flow Tests

1. **First Enrollment**: New student enrolls in first course
2. **Multiple Enrollments**: Enroll in 2+ courses sequentially
3. **Duplicate Enrollment**: Try to enroll twice in same course
4. **Missing Authored_SOW**: Enroll in course without curriculum template
5. **Network Failure**: Enrollment interrupted mid-process

### Dashboard Tests

1. **Empty State**: Student with no enrollments
2. **Single Course**: One enrollment, show recommendations
3. **Multiple Courses**: 3+ enrollments, test course switching
4. **Course Completion**: Complete all lessons, verify completion state
5. **Archived Course**: Course deleted after enrollment

### Progress Tracking Tests

1. **Zero Progress**: Newly enrolled, no sessions
2. **Partial Progress**: 50% lessons completed
3. **Full Completion**: 100% lessons, mastery >= 0.7
4. **Low Mastery**: All lessons done but mastery < 0.7
5. **Mixed Mastery**: Some outcomes strong, some weak

### Error Recovery Tests

1. **SOWV2 Missing**: Manually delete SOWV2, verify error handling
2. **MasteryV2 Missing**: Delete MasteryV2, check graceful degradation
3. **Backend Offline**: LangGraph down, verify fallback UI
4. **Appwrite Offline**: Database unavailable, show error state

---

## Sign-off

**Prepared by**: Claude Code
**Review Required**: Product Owner, Lead Developer, UX Designer
**Estimated Timeline**: 5 weeks (4 weeks development + 1 week deployment)
**Dependencies**: Authored_SOW templates for all courses, Appwrite permissions configured

**Next Steps**:
1. Review this specification with team
2. Prioritize any additional features
3. Assign implementation tasks
4. Begin Phase 1 development

---

*End of MVP2 Student User Journey Specification*
