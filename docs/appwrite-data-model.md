# Appwrite Data Model Documentation

## Overview

This document provides comprehensive documentation for the Scottish AI Lessons Appwrite database schema. The system uses a microservice architecture with a central Appwrite database for data persistence, serving both the main teaching application and the course management system.

## Database Structure

### Databases Available

1. **default** (`Scottish AI Lessons`) - Main production database
2. **sqa_education** (`SQA Education Database`) - Official SQA curriculum data
3. **sqa_education_test** (`SQA Education Database - Testing`) - Test database

This documentation covers both the **default** database (active data model) and the **sqa_education** database (SQA curriculum source data).

## Collections Overview

### Default Database Collections

| Collection | Purpose | Security | Key Relationships |
|------------|---------|----------|------------------|
| `students` | Student profile management | User-scoped | Links to users, enrollments |
| `courses` | Course catalog definition | Public read/write | Referenced by enrollments, lessons, links to sqa_education |
| `enrollments` | Student-course relationships | User-scoped | Links students to courses |
| `lesson_templates` | Lesson content definitions | Public write | Referenced by sessions, Authored_SOW |
| `Authored_SOW` | AI-generated curriculum templates | Public write | Template for SOWV2 instances |
| `sessions` | Learning session tracking | User-scoped | Links students to lessons |
| `evidence` | Student response data | Collection-level | Links to sessions |
| `mastery` / `MasteryV2` | Learning progress tracking | Collection/Public | Links to students, outcomes |
| `course_outcomes` | Learning objective definitions | Public write | Referenced by lessons, mastery, SOW |
| `sow` / `SOWV2` | Scheme of work planning | Collection/User-scoped | References Authored_SOW, stores customizations |
| `routine` | Spaced repetition scheduling | User-scoped | Student learning routines |
| `planner_threads` | Course manager state | User-scoped | LangGraph execution tracking |

### SQA Education Database Collections

| Collection | Purpose | Security | Key Relationships |
|------------|---------|----------|------------------|
| `sqa_current` | Official SQA course structures | Read-only public | Referenced by courses (subject+level mapping) |
| `sqa_universal_archive` | Historical SQA curriculum versions | No public access | Archival storage |

## Data Model Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SCOTTISH AI LESSONS DATA MODEL                          │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION & IDENTITY LAYER                           │
└──────────────────────────────────────────────────────────────────────────────────┘
                                      │
                     ┌────────────────┴────────────────┐
                     │   Appwrite Auth (Users)         │
                     └────────────────┬────────────────┘
                                      │
                                      ▼
                     ┌─────────────────────────────────┐
                     │       students                  │
                     │  • userId (FK to Auth)          │
                     │  • name                         │
                     │  • role                         │
                     │  • accommodations               │
                     │  • enrolledCourses              │
                     └────────┬────────────────────────┘
                              │
                              │ enrolls in
                              ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         CURRICULUM DEFINITION LAYER                               │
│                         (Public Write - AI Agent Access)                          │
└──────────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────────┐          ┌────────────────────┐
    │    courses        │          │  course_outcomes   │
    │  • courseId (PK)  │◄─────────┤  • courseId (FK)   │
    │  • subject        │  defines │  • outcomeRef      │
    │  • level          │          │  • outcomeTitle    │
    │                   │          │  • assessmentStds  │
    │  Schema v2:       │          │  • teacherGuidance │
    │  (phase removed)  │          │  • keywords        │
    │  (sqaCode removed)│          └────────────────────┘
    └─────┬─────────────┘
          │ has                              │
          │                                  │ referenced by
          ▼                                  ▼
    ┌──────────────────────────────────────────────────┐
    │           Authored_SOW                            │
    │  • courseId (FK)                                  │
    │  • version                                        │
    │  • entries[] (curriculum template)                │
    │  • metadata                                       │
    │  • status                                         │
    │                                                    │
    │  Generated by: SOW Authoring Agent                │
    │  Script: seedAuthoredSOW.ts                       │
    └───────────┬──────────────────────────────────────┘
                │
                │ generates lessons from entries
                ▼
    ┌──────────────────────────────────────────────────┐
    │          lesson_templates                         │
    │  • courseId (FK)                                  │
    │  • sow_order (links to Authored_SOW entry)        │
    │  • title                                          │
    │  • outcomeRefs (FK to course_outcomes)            │
    │  • cards[] (lesson content)                       │
    │  • lesson_type                                    │
    │  • engagement_tags                                │
    │  • policy                                         │
    │  • createdBy (user or agent)                      │
    │                                                    │
    │  Generated by: Lesson Authoring Agent             │
    │  Script: seedAuthoredLesson.ts                    │
    └──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                      STUDENT ENROLLMENT & PLANNING LAYER                          │
│                      (User-Scoped - Private to Student)                           │
└──────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────┐          ┌──────────────────────────────┐
    │   enrollments       │          │       SOWV2                  │
    │  • studentId (FK)   │  creates │  • studentId (FK)            │
    │  • courseId (FK)    │─────────►│  • courseId (FK)             │
    │  • role             │          │  • source_authored_sow_id ───┼──┐
    │  • enrolledAt       │          │  • source_version            │  │
    └─────────────────────┘          │  • customizations            │  │
                                     │                              │  │
                                     │  References: Authored_SOW    │  │
                                     │  Service: enrollment-service │  │
                                     └──────────────────────────────┘  │
                                                                        │
                                     ┌──────────────────────────────────┘
                                     │  dereferences
                                     ▼
                                     ┌──────────────────────────────┐
                                     │       Authored_SOW           │
                                     │  • courseId                  │
                                     │  • version                   │
                                     │  • entries[] (curriculum)    │
                                     │  • metadata                  │
                                     └───────────┬──────────────────┘
                                                 │
                                                 │ schedules
                                                 ▼
                                     ┌──────────────────────────┐
                                     │       routine            │
                                     │  • studentId (FK)        │
                                     │  • courseId (FK)         │
                                     │  • dueAtByOutcome        │
                                     │  • spacingPolicyVersion  │
                                     └──────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                        LEARNING EXECUTION LAYER                                   │
│                        (User-Scoped - Private to Student)                         │
└──────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────┐
    │                   planner_threads                        │
    │  • studentId (FK)                                        │
    │  • courseId (FK)                                         │
    │  • graphRunId (LangGraph thread)                         │
    │                                                           │
    │  Purpose: Course Manager recommendation state            │
    └────────────┬────────────────────────────────────────────┘
                 │
                 │ recommends
                 ▼
    ┌─────────────────────────────────────────────────────────┐
    │                    sessions                              │
    │  • studentId (FK)                                        │
    │  • courseId (FK)                                         │
    │  • lessonTemplateId (FK to lesson_templates)             │
    │  • lessonSnapshot (frozen content)                       │
    │  • threadId (LangGraph conversation)                     │
    │  • contextChatThreadId                                   │
    │  • stage (design/deliver/mark/progress/done)             │
    │                                                           │
    │  Managed by: Teaching Graph (graph_interrupt.py)         │
    └─────────┬───────────────────────────────────────────────┘
              │
              │ generates
              ▼
    ┌─────────────────────────────────────────────────────────┐
    │                    evidence                              │
    │  • sessionId (FK)                                        │
    │  • itemId (lesson card ID)                               │
    │  • response (student answer)                             │
    │  • correct (boolean)                                     │
    │  • score                                                 │
    │  • outcomeScores (per-outcome performance)               │
    │  • feedback                                              │
    │  • attempts                                              │
    └─────────┬───────────────────────────────────────────────┘
              │
              │ updates
              ▼
    ┌─────────────────────────────────────────────────────────┐
    │                   MasteryV2                              │
    │  • studentId (FK)                                        │
    │  • courseId (FK)                                         │
    │  • emaByOutcome (outcome → EMA score map)                │
    │  • updatedAt                                             │
    │                                                           │
    │  Algorithm: Exponential Moving Average                   │
    │  Unique: (studentId, courseId)                           │
    └──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                              KEY RELATIONSHIPS                                    │
└──────────────────────────────────────────────────────────────────────────────────┘

  AI Agent Flow:
  courses + course_outcomes → Authored_SOW → lesson_templates

  Student Journey:
  students → enrollments → SOWV2 → sessions → evidence → MasteryV2

  Recommendation Flow:
  MasteryV2 + routine + SOWV2 → planner_threads → sessions

  Template vs Instance:
  Authored_SOW (template, public) ←─references── SOWV2 (pointer + customizations, user-scoped)
  lesson_templates (template, public) → sessions.lessonSnapshot (frozen snapshot, user-scoped)

  Note: SOWV2 uses reference architecture (dereferences to Authored_SOW), sessions use snapshot architecture
```

## Detailed Collection Schemas

### Students Collection

**Purpose**: Stores student profile information and enrollment data.

**Security**: `documentSecurity: false` - Uses collection-level permissions with user scope.

**Permissions**:
- `create("users")`, `read("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface Student {
  $id: string;              // Appwrite document ID
  userId: string;           // Reference to Appwrite Auth user (required, 36 chars)
  name: string;             // Student display name (required, max 128 chars)
  role: string;             // User role (default: "student", max 20 chars)
  accommodations: string;   // JSON array of accommodation needs (max 5000 chars, default: "[]")
  enrolledCourses: string;  // JSON array of course IDs (max 1000 chars, default: "[]")
}
```

**Indexes**:
- `userId_idx` - Key index on userId for efficient lookups

**Usage in Frontend**:
- Managed by `StudentDriver.ts`
- Used in authentication flow and dashboard displays
- Accommodations field supports accessibility features

### Courses Collection

**Purpose**: Defines available courses with SQA (Scottish Qualifications Authority) alignment.

**Security**: `documentSecurity: false` - Public read access for course catalog.

**Permissions**:
- `read("any")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface Course {
  $id: string;           // Appwrite document ID
  courseId: string;      // Primary key - Format: course_<code> (required, max 50 chars)
                         // Example: "course_c84474"
  subject: string;       // Subject identifier with hyphens (required, max 128 chars)
                         // Example: "application-of-mathematics", "mathematics"
                         // Note: Maps to sqa_current with transformation (hyphens → underscores, singular → plural)
  level: string;         // Qualification level with hyphens (required, max 50 chars)
                         // Example: "national-3", "national-4", "national-5"
                         // Note: Maps to sqa_current with transformation (hyphens → underscores)
  schema_version: number; // Data schema version (default: 1)

  // ORPHANED FIELDS (kept for legacy compatibility, not used in new records):
  phase: string;         // Optional field (max 50 chars, default: '') - Legacy courses only
  sqaCode: string;       // Optional field (max 20 chars) - Legacy courses only
}
```

**Example Data**:
- `C844 73` - Applications of Mathematics, Senior Phase, Nat3 (legacy format with phase/sqaCode)
- `nat5-maths-2024` - Mathematics, National 5 (legacy format)
- `C843 73` - Physics, Senior Phase, Nat3 (legacy format)
- `course_c84473` - application-of-mathematics, national-3 (new format, maps to sqa_current)
- `course_c84474` - application-of-mathematics, national-4 (new format, maps to sqa_current)
- `course_c84774` - mathematics, national-4 (new format, maps to sqa_current)

**SQA Education Mapping**:
The seeding script (`seedAuthoredLesson.ts`) queries `default.courses` by `courseId`, then uses `subject` and `level` to fetch official course data from `sqa_education.sqa_current` with normalization:
- Hyphens → underscores: "application-of-mathematics" → "application_of_mathematics"
- Singular → plural: "application_of_mathematics" → "applications_of_mathematics"
- Level transformation: "national-4" → "national_4"

**Usage in Frontend**:
- Course selection in dashboards
- Lesson template filtering
- Progress tracking context

### Enrollments Collection

**Purpose**: Manages student enrollment in specific courses.

**Security**: `documentSecurity: true` - Document-level permissions.

**Permissions**:
- `read("users")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface Enrollment {
  $id: string;        // Appwrite document ID
  studentId: string;  // Reference to student (required, max 50 chars)
  courseId: string;   // Reference to course (required, max 50 chars)
  role: 'student' | 'observer'; // Enrollment type (default: "student")
  schema_version: number; // Data schema version (default: 1)
  enrolledAt: string; // ISO datetime string
}
```

**Indexes**:
- `student_course_idx` - Compound key index on (studentId, courseId)

**Usage in Frontend**:
- Dashboard course filtering
- Permission checking for lesson access
- Progress tracking scope

### Lesson Templates Collection

**Purpose**: Stores reusable lesson content with learning cards and assessments. Generated by AI agents or manually created.

**Security**: `documentSecurity: false` - Public write access for lesson authoring agents.

**Permissions**:
- `read("any")`, `create("any")`, `update("any")`, `delete("users")`

**Schema**:
```typescript
interface LessonTemplate {
  $id: string;           // Appwrite document ID
  courseId: string;      // Reference to course (required, max 50 chars)
  title: string;         // Lesson title (required, max 255 chars)
  outcomeRefs: string;   // JSON array of learning outcome IDs (required, max 500 chars)
  cards: string;         // JSON array of lesson cards (required, max 11000 chars) - Compressed with LZString
  version: number;       // Template version (default: 1)
  status: 'draft' | 'published'; // Publication status (default: "draft")
  createdBy: string;     // Creator user ID or agent name (required, max 50 chars)
  estMinutes: number;    // Estimated duration (min: 5, max: 120, default: 30)
  lesson_type: string;   // Type of lesson: teach, independent_practice, etc. (max 50 chars)
  engagement_tags: string; // JSON array of engagement tags (max 1000 chars, default: "[]")
  policy: string;        // JSON object for lesson policies (max 1000 chars, default: "{}")
  sow_order: number;     // Position in Authored SOW sequence (min: 1, max: 1000)
}
```

**Lesson Card Structure**:
```typescript
interface LessonCard {
  id: string;            // Unique card identifier
  title: string;         // Card title
  explainer: string;     // Learning content explanation
  example?: string[];    // Optional worked examples
  cfu: {                 // Check for Understanding assessment
    type: "numeric" | "mcq";
    id: string;
    stem: string;        // Question text
    expected?: number | string;   // Correct answer
    tolerance?: number;           // Numeric tolerance
    options?: string[];           // MCQ options
    answerIndex?: number;         // MCQ correct answer index
  };
}
```

**Usage in Frontend**:
- Lesson content rendering via `LessonCardPresentationTool.tsx`
- Course manager lesson recommendations
- Teaching graph lesson delivery

### Authored SOW Collection

**Purpose**: Stores AI-generated Scheme of Work templates that define complete course curricula. These templates are generated by the SOW authoring agent and serve as the basis for personalized student SOWs.

**Security**: `documentSecurity: false` - Public write access for authoring agents.

**Permissions**:
- `read("any")`, `create("any")`, `update("any")`, `delete("any")`

**Schema**:
```typescript
interface AuthoredSOW {
  $id: string;              // Appwrite document ID
  courseId: string;         // Reference to course (required, max 50 chars)
  version: string;          // SOW version identifier (required, max 20 chars)
  entries: string;          // JSON array of curriculum entries (required, max 100000 chars)
  metadata: string;         // JSON object with authoring metadata (max 10000 chars, default: "{}")
  accessibility_notes: string; // Accessibility considerations (max 2000 chars, default: "")
  status: 'draft' | 'published' | 'archived'; // Publication status (required)
}
```

**Entry Structure**:
```typescript
interface SOWEntry {
  order: number;            // Sequence position in curriculum
  label: string;            // Lesson title
  lesson_type: string;      // Type: teach, independent_practice, etc.
  estMinutes: number;       // Estimated duration
  outcomeRefs: string[];    // Learning outcomes covered
  engagement_tags?: string[]; // Engagement strategies
  policy?: {                // Lesson policies
    calculator_allowed?: boolean;
  };
  lessonTemplateRef?: string; // Reference to generated lesson template
}
```

**Indexes**:
- `course_version_idx` - Compound key index on (courseId, version) with DESC ordering on version

**Usage in Frontend**:
- Managed by `AuthoredSOWDriver.ts`
- SOW authoring agent generates these templates
- Used to seed personalized SOWV2 instances for students
- Seeding scripts: `seedAuthoredSOW.ts`, `seedAuthoredLesson.ts`

### Sessions Collection

**Purpose**: Tracks individual learning sessions between students and lessons.

**Security**: `documentSecurity: true` - Document-level permissions.

**Permissions**:
- `read("users")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface Session {
  $id: string;                // Appwrite document ID
  studentId: string;          // Reference to student (required, max 50 chars)
  courseId: string;           // Reference to course (required, max 50 chars)
  lessonTemplateId: string;   // Reference to lesson template (max 50 chars)
  startedAt: string;          // Session start time (required, ISO datetime)
  endedAt: string;            // Session end time (ISO datetime)
  stage: 'design' | 'deliver' | 'mark' | 'progress' | 'done'; // Session stage (default: "design")
  status: 'created' | 'active' | 'completed' | 'abandoned' | 'failed'; // Session lifecycle status
  score?: number;             // Overall lesson performance (0.0-1.0), optional
  lessonSnapshot: string;     // JSON snapshot of lesson content (required, max 8000 chars)
  threadId: string;           // LangGraph conversation thread ID (max 100 chars)
  lastMessageAt: string;      // Last chat interaction timestamp (ISO datetime)
  contextChatThreadId: string; // Context chat thread ID (max 100 chars)
}
```

**Indexes**:
- `studentId_idx` - Key index on studentId for efficient student lookups

**Stage Progression**:
1. `design` - Lesson planning phase
2. `deliver` - Active teaching/learning
3. `mark` - Assessment and feedback
4. `progress` - Progress tracking updates
5. `done` - Session completed

**Usage in Frontend**:
- Session management via `SessionDriver.ts`
- LangGraph teaching integration
- Progress tracking and analytics

### Evidence Collection

**Purpose**: Stores student responses and assessment data for learning analytics.

**Security**: `documentSecurity: false` - Collection-level permissions.

**Permissions**:
- `read("users")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface Evidence {
  $id: string;           // Appwrite document ID
  sessionId: string;     // Reference to session (required, max 50 chars)
  itemId: string;        // Reference to lesson card/question (required, max 50 chars)
  response: string;      // Student's response (required, max 1000 chars)
  correct: boolean;      // Whether response was correct (required)
  attempts: number;      // Number of attempts (min: 1, max: 10, default: 1)
  confidence: number;    // Confidence score (min: 0, max: 1, default: 0)
  reasoning: string;     // AI reasoning for assessment (max 2000 chars)
  feedback: string;      // Feedback provided to student (max 2000 chars)
  timestamp: string;     // Response timestamp (ISO datetime)
  attemptIndex: number;  // Zero-based attempt counter (min: 0, max: 10, default: 0)
  score: number;         // Normalized score (min: 0, max: 1, default: 0)
  outcomeScores: string; // JSON object of outcome-specific scores (max 2000 chars, default: "{}")
  submittedAt: string;   // Submission timestamp (ISO datetime)
}
```

**Usage in Frontend**:
- Managed by `EvidenceDriver.ts`
- Learning analytics and progress tracking
- Mastery calculation inputs

### Mastery Collections (V1 and V2)

**Purpose**: Tracks student mastery levels for learning outcomes using exponential moving averages.

#### MasteryV2 Collection (Current)

**Security**: `documentSecurity: false` - Public access for analytics.

**Permissions**:
- Full CRUD access for users and any role

**Schema**:
```typescript
interface MasteryV2 {
  $id: string;           // Appwrite document ID
  studentId: string;     // Reference to student (required, max 50 chars)
  courseId: string;      // Reference to course (required, max 50 chars)
  emaByOutcome: string;  // JSON object mapping outcome IDs to EMA scores (max 5000 chars, default: "{}")
  updatedAt: string;     // Last update timestamp (required, ISO datetime)
}
```

**Indexes**:
- `unique_student_course` - Unique compound index on (studentId, courseId)

#### Legacy Mastery Collection

**Security**: `documentSecurity: true` - Document-level permissions.

**Schema**:
```typescript
interface Mastery {
  $id: string;           // Appwrite document ID
  studentId: string;     // Reference to student (required, max 50 chars)
  courseId: string;      // Reference to course (max 50 chars, default: "")
  outcomeId: string;     // Outcome identifier (max 100 chars, default: "")
  ema: number;           // Exponential moving average score (min: 0, max: 1, default: 0)
  outcomeRef: string;    // Outcome reference (required, max 100 chars)
  level: number;         // Mastery level (required, min: 0, max: 1)
  confidence: number;    // Confidence in assessment (required, min: 0, max: 1)
  lastUpdated: string;   // Last update timestamp (required, ISO datetime)
}
```

**Usage in Frontend**:
- Managed by `MasteryV2Driver.ts` and `MasteryDriver.ts`
- Course manager recommendation algorithms
- Student progress dashboards

### Course Outcomes Collection

**Purpose**: Defines learning objectives and outcomes for courses with comprehensive SQA (Scottish Qualifications Authority) alignment data. Includes assessment standards, teacher guidance, and curriculum keywords.

**Security**: `documentSecurity: false` - Public write access for curriculum authoring agents.

**Permissions**:
- `read("any")`, `create("any")`, `update("any")`, `delete("users")`

**Schema**:
```typescript
interface CourseOutcome {
  $id: string;              // Appwrite document ID
  courseId: string;         // Reference to course (required, max 50 chars)
  outcomeRef: string;       // Outcome reference code (max 100 chars, default: "")
  title: string;            // Outcome description (max 255 chars, default: "")

  // SQA Course Structure
  courseSqaCode: string;    // Official SQA course code (max 50 chars)
  unitCode: string;         // Unit identifier within course (max 50 chars)
  unitTitle: string;        // Unit title (max 255 chars)
  scqfCredits: number;      // SCQF credit points for unit

  // Detailed Outcome Information
  outcomeId: string;        // Specific outcome identifier (max 50 chars)
  outcomeTitle: string;     // Full outcome description (max 500 chars)
  assessmentStandards: string; // JSON array of assessment criteria (max 100000 chars)
  teacherGuidance: string;  // Teaching notes and guidance (max 50000 chars)
  keywords: string;         // JSON array of curriculum keywords (max 5000 chars)
}
```

**Assessment Standards Structure**:
```typescript
interface AssessmentStandard {
  code: string;             // Standard identifier (e.g., "1.1", "2.3")
  description: string;      // Detailed criterion description
  exemplification?: string; // Examples and clarifications
}
```

**Usage in Frontend**:
- Lesson template outcome mapping
- Progress tracking granularity
- Assessment alignment
- SOW authoring agent curriculum planning
- Teacher guidance integration

### Scheme of Work Collections (SOW and SOWV2)

**Purpose**: Manages curriculum planning and lesson sequencing.

#### SOWV2 Collection (Reference Architecture)

**Security**: `documentSecurity: false` - Collection-level permissions.

**Purpose**: Version tracking and student customizations for curriculum.

SOWV2 uses a **reference-based architecture** where curriculum data is NOT duplicated. Instead, SOWV2 stores a reference to the authoritative Authored_SOW document and overlays student-specific customizations.

**Architecture Pattern**:
```
SOWV2 (lightweight pointer) ──references──> Authored_SOW (curriculum data)
   │
   └─> customizations (student-specific overrides)
```

**Schema**:
```typescript
interface SOWV2 {
  $id: string;                      // Appwrite document ID
  studentId: string;                // Reference to student (required, max 50 chars)
  courseId: string;                 // Reference to course (required, max 50 chars)
  source_authored_sow_id: string;   // Document ID of Authored_SOW (optional, max 50 chars)
  source_version: string;           // Version identifier for debugging/logging (optional, max 20 chars)
  customizations: string;           // Student-specific modifications (max 5000 chars, default: "{}")
  createdAt: string;                // Enrollment timestamp (required, ISO datetime)

  // ORPHANED FIELD (migration in progress - exists for backward compatibility):
  entries: string;                  // Legacy curriculum data (max 10000 chars, default: "[]")
                                    // New records use source_authored_sow_id reference instead
}
```

**Indexes**:
- `unique_student_course` - Unique compound index on (studentId, courseId)

**Customizations Schema**:
```typescript
interface StudentCustomizations {
  entries?: {
    [order: number]: {              // Key = lesson order number from Authored_SOW
      plannedAt?: string;           // Scheduled date (ISO datetime)
      skipped?: boolean;            // Lesson skipped by student
      notes?: string;               // Student notes for lesson
      custom_lesson_id?: string;    // Manually added lesson (not in template)
      added_manually?: boolean;     // Flag for custom additions
    };
  };
  preferences?: any;                // Future: student learning preferences
}
```

**Data Access Pattern**:

When reading SOW data via `SOWDriver.getSOWForEnrollment()`:
1. **Query SOWV2** by studentId + courseId (1 query)
2. **Dereference to Authored_SOW** using source_authored_sow_id (1 query)
3. **Parse curriculum data** from Authored_SOW (entries, metadata, accessibility_notes)
4. **Overlay customizations** on top of curriculum data
5. **Return unified SOWData** interface to caller

**Example Flow**:
```typescript
// Student enrollment creates lightweight reference
SOWV2 = {
  studentId: "student-123",
  courseId: "course_c84473",
  source_authored_sow_id: "authored_sow_abc",  // ← Pointer to curriculum
  source_version: "v1.0",
  customizations: "{}"  // Empty initially
}

// Reading SOW performs dereference
const sow = await getSOWForEnrollment("student-123", "course_c84473");
// Returns: { entries: [...], metadata: {...}, customizations: {...} }
// ← entries/metadata from Authored_SOW, customizations from SOWV2
```

**Benefits**:
- ✅ **Single Source of Truth**: Authored_SOW is authoritative curriculum data
- ✅ **No Data Duplication**: Eliminates sync issues between collections
- ✅ **No Size Limits**: SOWV2 becomes lightweight (only 4 fields)
- ✅ **Easy Version Upgrades**: Change source_authored_sow_id to upgrade student to new curriculum
- ✅ **Student Customizations Preserved**: Stored separately, survives curriculum updates
- ✅ **Better Architecture**: Clear separation of concerns (curriculum vs student state)

**Migration from Legacy Schema**:
- Old SOWV2 records had `entries` field (duplicated curriculum)
- New SOWV2 records use `source_authored_sow_id` (reference to curriculum)
- Migration script: `scripts/migrate-sowv2-to-references.ts`

#### Legacy SOW Collection

**Schema**:
```typescript
interface SOW {
  $id: string;        // Appwrite document ID
  courseId: string;   // Reference to course (required, max 50 chars)
  unitNumber: string; // Unit identifier (required, max 20 chars)
  unitTitle: string;  // Unit title (required, max 255 chars)
  weekNumber: number; // Week in curriculum (required, min: 1, max: 52)
  lessonIds: string;  // JSON array of lesson template IDs (required, max 2000 chars)
}
```

**Usage in Frontend**:
- Course planning and sequencing
- Lesson recommendation ordering
- Curriculum progress tracking

## SQA Education Database Collections

### SQA Current Collection

**Purpose**: Stores official Scottish Qualifications Authority (SQA) course structures and curriculum data. This is the authoritative source for SQA-aligned course content, including units, outcomes, and assessment standards.

**Security**: `documentSecurity: false` - Read-only public access for curriculum data consumption.

**Permissions**:
- `read("any")` - Public read access for agents and applications

**Schema**:
```typescript
interface SQACurrent {
  $id: string;              // Appwrite document ID
  subject: string;          // Subject identifier with underscores (required, max 255 chars)
                            // Example: "applications_of_mathematics", "mathematics"
  level: string;            // Qualification level with underscores (required, max 100 chars)
                            // Example: "national_3", "national_4", "national_5"
  catalog_version: string;  // SQA catalog version (required, max 10 chars)
  last_modified: string;    // Last update timestamp (required, ISO datetime)
  archived_versions: string[]; // Array of previous versions (optional, max 255 chars per item)
  data: string;             // Full course structure as JSON (required, max 1,000,000 chars - 1MB)
  metadata: string;         // Course metadata as JSON (required, max 10,000 chars)
  course_code: string;      // Official SQA course code (optional, max 20 chars)
}
```

**Data Structure** (stored in `data` field):
```typescript
interface SQACourseData {
  course_title: string;     // Full course name
  course_code: string;      // SQA code (e.g., "C844 74")
  level: string;            // Qualification level
  scqf_level: number;       // Scottish Credit and Qualifications Framework level
  scqf_points: number;      // SCQF credit points
  course_structure: {
    units: Array<{
      unit_code: string;    // Unit identifier
      unit_title: string;   // Unit name
      scqf_credit_points: number;
      outcomes: Array<{
        outcome_number: string;  // e.g., "1", "2", "3"
        outcome_title: string;   // Full outcome description
        assessment_standards: Array<{
          standard_number: string; // e.g., "1.1", "1.2"
          description: string;
          exemplification?: string;
        }>;
      }>;
    }>;
  };
  assessment_information?: any;  // Additional assessment details
  notes?: string;                 // Course-specific notes
}
```

**Indexes**:
- `subject_idx` - Key index on subject field (ASC)
- `level_idx` - Key index on level field (ASC)
- `subject_level_idx` - Compound key index on (subject, level) for efficient queries (ASC, ASC)
- `version_idx` - Key index on catalog_version (DESC) for latest-first ordering

**Naming Convention Mapping**:

The `default.courses` collection uses hyphens while `sqa_current` uses underscores. The seeding script handles transformation:

| default.courses | sqa_current |
|----------------|-------------|
| `application-of-mathematics` | `applications_of_mathematics` (plural!) |
| `mathematics` | `mathematics` |
| `national-4` | `national_4` |
| `national-5` | `national_5` |

**Usage in Lesson Authoring Pipeline**:
1. `seedAuthoredLesson.ts` queries `default.courses` by `courseId`
2. Extracts `subject` and `level` fields
3. Normalizes values (hyphens→underscores, singular→plural where needed)
4. Queries `sqa_education.sqa_current` using normalized values
5. Passes full SQA course structure to Lesson Author agent as 4th JSON input
6. Agent uses official outcomes, assessment standards, and terminology

**Example Document**:
```json
{
  "$id": "60168a1b2c3d4e5f6a7b8c9d",
  "subject": "applications_of_mathematics",
  "level": "national_4",
  "catalog_version": "2024",
  "last_modified": "2024-08-15T10:30:00.000Z",
  "course_code": "C844 74",
  "data": "{\"course_title\":\"Applications of Mathematics (National 4)\",\"course_structure\":{\"units\":[...]}}",
  "metadata": "{\"total_units\":3,\"total_scqf_points\":18}"
}
```

### SQA Universal Archive Collection

**Purpose**: Historical archive for all SQA curriculum versions. Stores previous versions of course documents for reference and rollback capabilities.

**Security**: `documentSecurity: false` - No public access (internal archival only).

**Permissions**: None (restricted access)

**Schema**:
```typescript
interface SQAUniversalArchive {
  $id: string;              // Appwrite document ID
  archive_id: string;       // Archive identifier (required, max 36 chars - UUID format)
  source_table: string;     // Origin collection name (required, max 255 chars)
                            // Example: "sqa_current"
  document_id: string;      // Original document ID (required, max 255 chars)
  version: string;          // Version identifier (required, max 50 chars)
  archived_at: string;      // Archival timestamp (required, ISO datetime)
  document_data: string;    // Complete document snapshot as JSON (required, max 16,777,216 chars - 16MB)
  metadata: string;         // Archival metadata (optional, max 65,535 chars, default: "{}")
}
```

**Indexes**:
- `version_idx` - Key index on version field
- `source_table_idx` - Key index on source_table field
- `document_id_idx` - Key index on document_id field
- `archived_at_idx` - Key index on archived_at field for temporal queries

**Usage**:
- Automatic archival when SQA course documents are updated
- Version history tracking for curriculum changes
- Rollback capability for curriculum errors
- Compliance and audit trail

### Routine Collection

**Purpose**: Manages spaced repetition scheduling for personalized learning.

**Security**: `documentSecurity: true` - Document-level permissions.

**Permissions**:
- `read("users")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface Routine {
  $id: string;              // Appwrite document ID
  studentId: string;        // Reference to student (required, max 50 chars)
  courseId: string;         // Reference to course (required, max 50 chars)
  lastSessionDate: string;  // Last learning session date (ISO datetime)
  daysSinceLastSession: number; // Days since last session (min: 0, max: 365, default: 0)
  lastTaughtAt: string;     // Last teaching timestamp (ISO datetime)
  dueAtByOutcome: string;   // JSON object mapping outcomes to due dates (max 5000 chars, default: "{}")
  spacingPolicyVersion: number; // Spaced repetition algorithm version (min: 1, max: 100, default: 1)
  schema_version: number;   // Data schema version (min: 1, max: 100, default: 1)
}
```

**Usage in Frontend**:
- Managed by `RoutineDriver.ts`
- Spaced repetition scheduling
- Course manager lesson prioritization

### Planner Threads Collection

**Purpose**: Tracks Course Manager LangGraph execution state for recommendation continuity.

**Security**: `documentSecurity: true` - Document-level permissions.

**Permissions**:
- `read("users")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface PlannerThread {
  $id: string;        // Appwrite document ID
  studentId: string;  // Reference to student (required, max 50 chars)
  courseId: string;   // Reference to course (required, max 50 chars)
  graphRunId: string; // LangGraph execution run ID (required, max 100 chars)
}
```

**Usage in Frontend**:
- Managed by `planner-service.ts`
- Course manager state persistence
- Recommendation session continuity

## Frontend Integration Patterns

### Driver Architecture

The frontend uses a driver pattern for data access:

- **BaseDriver**: Generic CRUD operations and session management
- **StudentDriver**: Student profile management
- **SessionDriver**: Learning session lifecycle
- **EvidenceDriver**: Assessment data persistence
- **MasteryV2Driver**: Learning progress tracking
- **LessonDriver**: Lesson template operations
- **AuthoredSOWDriver**: AI-generated curriculum template operations
- **SOWDriver**: Student-specific curriculum planning (SOWV2)
- **RoutineDriver**: Spaced repetition scheduling

### Schema Validation

All data operations use Zod schemas for validation (`schemas.ts`):

- Input sanitization and XSS prevention
- Type safety and validation
- Transformation for Appwrite compatibility
- Error handling and user feedback

### Permission Patterns

#### Collection-Level Security
- **Public Read-Only**: `courses`
- **Public Write**: `lesson_templates`, `course_outcomes`, `Authored_SOW` (for AI agents)
- **User-Scoped Collections**: `students`, `evidence`, `MasteryV2`, `SOWV2`
- **Mixed Collections**: `mastery` (legacy document-level)

#### Document-Level Security
- **User-Private**: `sessions`, `enrollments`, `routine`, `planner_threads`
- **Automatic Permissions**: Generated based on authenticated user

### Authentication Integration

Frontend authentication flows:
1. **Login/Signup**: `auth/LoginForm.tsx`, `auth/SignupForm.tsx`
2. **Session Management**: `hooks/useAuth.ts`, `hooks/useAppwrite.ts`
3. **Protected Routes**: `middleware.ts`
4. **Server-Side Auth**: `lib/appwrite/server.ts`

## Key Data Relationships

### Student Learning Journey
```
User (Appwrite Auth)
  ↓
Student (profile)
  ↓
Enrollment (course access)
  ↓
SOWV2 (curriculum reference) ─references─> Authored_SOW (curriculum template)
  ↓
Session (learning instance)
  ↓
Evidence (assessment data)
  ↓
MasteryV2 (progress tracking)

Note: SOWV2 dereferences to Authored_SOW for curriculum data. Student-specific customizations stored in SOWV2.customizations field.
```

### Curriculum Management
```
Course (subject definition)
  ↓
Course Outcomes (learning objectives)
  ↓
Authored_SOW (AI-generated curriculum template)
  ├─→ Lesson Templates (generated content)
  └─→ SOWV2 (student reference + customizations) ←┐
       ↓                                           │
     Routine (spaced repetition)                   │
                                                   │
  Note: SOWV2 stores pointer to Authored_SOW ──────┘
        Curriculum data accessed via dereference
```

### Course Manager Flow
```
Student + Course Context
  ↓
Planner Threads (LangGraph state)
  ↓
Recommendation Generation
  ↓
Session Creation
  ↓
Teaching Delivery
```

## Performance Considerations

### Indexing Strategy
- **Student Lookups**: `userId_idx` on students
- **Session History**: `studentId_idx` on sessions
- **Enrollment Checks**: `student_course_idx` on enrollments
- **Mastery Uniqueness**: `unique_student_course` on MasteryV2 and SOWV2

### Data Size Limits
- **Large JSON Fields**: `cards` (8000 chars), `lessonSnapshot` (8000 chars)
- **Text Content**: `accommodations` (5000 chars), `emaByOutcome` (5000 chars)
- **Regular Fields**: Most strings limited to 50-255 characters

### Caching Strategies
- **Static Content**: Courses, lesson templates, outcomes cached client-side
- **Dynamic Data**: Student progress, sessions fetched on-demand
- **Real-time Updates**: Session state updated during active learning

## AI Agent Integration

### Curriculum Authoring Pipeline

The system uses AI agents to generate complete course curricula:

1. **SOW Authoring Agent** (`sow_author_agent.py`)
   - Inputs: Course outcomes, SQA standards, resource packs
   - Outputs: Authored_SOW document with complete curriculum structure
   - Script: `seedAuthoredSOW.ts`

2. **Lesson Authoring Agent** (`lesson_author_agent.py`)
   - Inputs: SOW entry, resource pack, SOW context metadata, **SQA course data** (quadruple input)
   - SQA Data Source: Pre-fetched from `sqa_education.sqa_current` using course subject+level
   - Outputs: Lesson template with cards, assessments, rubrics
   - Script: `seedAuthoredLesson.ts`
   - Requires: `langgraph dev` running on port 2027
   - Features: Error recovery with thread persistence (max 10 retries)
   - Cost Optimization: Eliminates expensive Pro model subagent by pre-fetching SQA data

3. **Enrollment Flow (Reference Architecture)**
   - Student enrolls in course
   - Enrollment service creates lightweight SOWV2 reference record (NOT a copy)
   - SOWV2 stores document ID pointer via `source_authored_sow_id` (required field)
   - Version tracked via `source_version` for debugging/logging
   - Empty customizations initialized: `{}`
   - **No curriculum data duplicated** - accessed via dereference to Authored_SOW
   - Student-specific modifications stored in `customizations` field as they occur

**Data Flow**:
```
Student enrolls
  ↓
enrollment-service.ts calls SOWDriver.copyFromAuthoredSOW()
  ↓
Creates SOWV2 with:
  - source_authored_sow_id = authoredSOW.$id  (pointer, not copy)
  - source_version = authoredSOW.version
  - customizations = "{}"
  ↓
SOWDriver.getSOWForEnrollment() dereferences to Authored_SOW for curriculum data
```

### Agent Permissions

Public write access (`create("any")`, `update("any")`) enables:
- Lesson authoring agents to generate templates
- SOW authoring agents to create curriculum structures
- Course outcome updates from SQA data imports

This architecture separates:
- **Templates** (Authored_SOW, lesson_templates) - Generated by agents, shared across students
- **Instances** (SOWV2, sessions) - Per-student, user-scoped permissions

## Security Considerations

### Data Protection
- **Input Sanitization**: All string fields sanitized for XSS prevention
- **Permission Validation**: Collection and document-level access control
- **Authentication Required**: All user-specific operations require valid session
- **Agent Access**: Public write permissions limited to curriculum collections

### Privacy Controls
- **Student Data**: Isolated by user permissions
- **Progress Tracking**: Anonymizable for analytics
- **Session Content**: Temporary storage with cleanup policies
- **Template Separation**: AI-generated templates are public, student instances are private

## Migration and Versioning

### Schema Evolution
- **Version Fields**: `schema_version` for forward compatibility
- **V2 Collections**: `MasteryV2`, `SOWV2` for improved data models
- **Backward Compatibility**: Legacy collections maintained during transition

### Data Migration Patterns
- **Incremental Migration**: Gradual transition from V1 to V2 schemas
- **Validation**: Zod schemas handle both old and new data formats
- **Fallback Handling**: Graceful degradation for missing fields

This data model supports the full Scottish AI Lessons learning platform, from course enrollment through personalized lesson delivery and progress tracking, with robust security and performance characteristics.