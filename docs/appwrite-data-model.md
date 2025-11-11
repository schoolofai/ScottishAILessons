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

  // Versioning and Authorship Tracking (Phase 9+)
  authored_sow_id: string;     // Foreign key to Authored_SOW document (optional, max 50 chars)
                               // Links lesson to source curriculum template for version tracking
  authored_sow_version: string; // Denormalized version string from Authored_SOW (optional, max 20 chars)
                                // Cached for quick filtering without JOIN queries
  model_version: string;        // AI model identifier for A/B testing (optional, max 50 chars)
                                // Examples: "gpt-4-0125-preview", "claude-sonnet-4", "gpt-3.5-turbo"
                                // Enables quality comparison between model generations
}
```

**Versioning Strategy**:
Lesson templates track authorship through three mechanisms:

1. **Curriculum Lineage** (`authored_sow_id`, `authored_sow_version`):
   - Links lesson to specific Authored_SOW version
   - Enables curriculum version upgrades (e.g., v1.0 → v2.0)
   - Supports rollback to previous curriculum versions
   - Denormalized version string avoids expensive JOINs

2. **AI Model Tracking** (`model_version`):
   - Records which AI model generated the lesson
   - Supports multi-model A/B testing
   - Enables quality analysis by model (GPT-4 vs Claude vs GPT-3.5)
   - Future: Automatic model selection based on performance metrics

3. **Template Versioning** (`version`):
   - Incremental version number for template updates
   - Tracks manual edits and refinements
   - Combined with `createdBy` for audit trail

**Example Usage**:
```typescript
// Generated lesson from Authored_SOW v1.2 using GPT-4
{
  courseId: "course_c84474",
  title: "Introduction to Simple Interest",
  authored_sow_id: "authored_c84474_v1.2",
  authored_sow_version: "1.2",
  model_version: "gpt-4-0125-preview",
  version: 1,
  sow_order: 5
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

### Lesson Diagrams Collection

**Purpose**: Stores metadata for AI-generated interactive diagrams (JSXGraph) associated with lesson cards. Diagrams can be generated for teaching content or assessment questions (CFU), with visual critique scoring and iteration tracking.

**Security**: `documentSecurity: false` - Public read access for diagram consumption.

**Permissions**:
- `read("any")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface LessonDiagram {
  $id: string;                    // Appwrite document ID
  lessonTemplateId: string;       // Reference to lesson template (required, max 50 chars)
  cardId: string;                 // Specific card within lesson (required, max 50 chars)
  diagram_context: 'lesson' | 'cfu';  // Teaching content vs assessment (required)
  image_file_id: string;          // Storage bucket file reference for PNG (required, max 50 chars)
  jsxgraph_json: string;          // JSXGraph construction script (required, max 50000 chars)
  diagram_type: 'geometry' | 'graph' | 'mixed';  // Diagram classification (required)
  title: string;                  // Diagram title (required, max 255 chars)
  visual_critique_score: number;  // AI quality score 0-100 (optional, min: 0, max: 100)
  critique_iterations: number;    // Number of refinement cycles (default: 0, min: 0, max: 10)
  critique_feedback: string;      // AI critique notes (max 5000 chars, default: "")
  execution_id: string;           // Diagram generation run ID for debugging (max 100 chars)
  failure_reason: string;         // Error message if generation failed (max 2000 chars)
}
```

**Indexes**:
- `lesson_card_context_idx` - Compound key index on (lessonTemplateId, cardId, diagram_context) for efficient lookups

**Storage Integration**:
- Uses bucket ID: `6907775a001b754c19a6` (shared with student drawings)
- File format: PNG images rendered from JSXGraph
- File naming: `dgm_image_{hash}` (deterministic based on lessonTemplateId + cardId)
- Preview URLs: Generated via Storage API `/storage/buckets/{bucketId}/files/{fileId}/view`

**JSXGraph Format**:
The `jsxgraph_json` field stores a JSON string with construction commands:
```json
{
  "board_config": {
    "boundingbox": [-5, 5, 5, -5],
    "axis": true,
    "showNavigation": false
  },
  "elements": [
    {
      "type": "point",
      "args": [1, 2],
      "attributes": {"name": "A", "size": 3}
    },
    {
      "type": "line",
      "args": [[0, 0], [3, 4]],
      "attributes": {"strokeColor": "blue"}
    }
  ]
}
```

**Usage in Frontend**:
- Managed by `DiagramDriver.ts`
- Fetched by diagram_context to separate teaching vs assessment diagrams
- Rendered in `LessonCardPresentationTool.tsx` via JSXGraph library
- Admin UI for diagram upload/delete operations
- Visual critique scores guide iterative refinement in authoring pipeline

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
  conversationHistory: string; // Compressed chat history for session replay (max 50000 chars, optional)
                               // Format: gzip + base64 encoded JSON array of messages
                               // Enables session replay and debugging
}
```

**Conversation History Compression**:
The `conversationHistory` field uses a two-stage compression approach to minimize storage:
1. **JSON Serialization**: Array of message objects (role, content, timestamp)
2. **Gzip Compression**: Binary compression of JSON string
3. **Base64 Encoding**: Safe storage in text field

Example compression utility:
```typescript
// Compression (SessionDriver)
const compressedHistory = btoa(pako.gzip(JSON.stringify(messages), { to: 'string' }));

// Decompression (Session replay)
const messages = JSON.parse(pako.ungzip(atob(conversationHistory), { to: 'string' }));
```

**Dual Chat Architecture**:
Sessions support two parallel conversation threads:
- **`threadId`**: Main teaching graph conversation (LangGraph agent)
- **`contextChatThreadId`**: Supplementary context chat (React agent for clarifications)

This enables students to ask clarifying questions without disrupting the main lesson flow.

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

  // Phase 10: Drawing Storage Integration (Migration from base64 to Storage)
  student_drawing_file_ids: string;  // JSON array of Storage file IDs (max 500 chars, default: "[]")
                                     // Format: ["sdraw_1234567890_uuid1", "sdraw_1234567890_uuid2", ...]
  student_drawing: string;           // DEPRECATED: Legacy base64 image data (max 50000 chars)
                                     // Maintained for backward compatibility only
                                     // New evidence should use student_drawing_file_ids
}
```

**Drawing Storage Migration**:
The Evidence collection migrated from embedding base64 images to Storage file references:

- **Legacy Pattern** (`student_drawing`):
  - Base64-encoded images stored directly in Evidence document
  - Limited to ~50KB due to document size constraints
  - Caused document bloat and slow queries

- **Current Pattern** (`student_drawing_file_ids`):
  - Array of Storage file IDs referencing uploaded PNG images
  - Uses bucket ID: `6907775a001b754c19a6` (shared with lesson diagrams)
  - File naming: `sdraw_{timestamp}_{uuid}` (~23 chars)
  - Maximum 5 images per submission, 5MB per image
  - Managed by `StudentDrawingStorageDriver.ts`

- **Backward Compatibility**:
  - `EvidenceDriver.getDrawingUrls()` handles both formats
  - Storage file IDs take precedence if present
  - Legacy base64 converted to blob URLs for rendering
  - No migration required for existing evidence

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

### Revision Notes Collection

**Purpose**: Stores metadata for AI-generated revision materials including course cheat sheets and lesson-specific quick notes. Content is stored as markdown files in Storage, with database records tracking metadata and file references.

**Security**: `documentSecurity: false` - Collection-level permissions (access control TBD based on user role requirements).

**Permissions**:
- `read("users")`, `create("users")`, `update("users")`, `delete("users")`

**Schema**:
```typescript
interface RevisionNote {
  $id: string;                  // Deterministic ID format: {courseId}_cheat_sheet or {courseId}_lesson_{order:02d}
  courseId: string;             // Reference to course (required, max 50 chars)
  noteType: 'cheat_sheet' | 'lesson_note';  // Type of revision material (required)
  lessonOrder: number;          // Lesson sequence number (optional, only for lesson_note type, min: 1, max: 999)
  markdown_file_id: string;     // Storage bucket file reference for .md content (required, max 50 chars)
  createdAt: string;            // Creation timestamp (required, ISO datetime)
  updatedAt: string;            // Last modification timestamp (required, ISO datetime)
}
```

**Document ID Patterns**:
- **Cheat Sheet**: `{courseId}_cheat_sheet` (e.g., `course_c84474_cheat_sheet`)
- **Lesson Note**: `{courseId}_lesson_{order:02d}` (e.g., `course_c84474_lesson_03`)

**Storage Integration**:
- Uses bucket ID: `documents` (markdown file storage)
- File format: Markdown (.md) with LaTeX math support
- Retrieval: Via Storage API `/storage/buckets/documents/files/{fileId}/view`
- Content rendering: Frontend markdown parser with math rendering

**Indexes**:
- None required - Uses deterministic document IDs for direct lookups by (courseId, noteType, lessonOrder)

**Error Handling Pattern**:
The `RevisionNotesDriver` implements fast-fail error handling with retry classification:
- **RetryableErrors**: Network timeouts, rate limits (500ms exponential backoff)
- **NonRetryableErrors**: 404 not found, validation errors (fail immediately)
- **Existence Checks**: `hasCheatSheet()` and `hasLessonNote()` methods for UI conditional rendering

**Usage in Frontend**:
- Managed by `RevisionNotesDriver.ts`
- Existence checks before rendering revision UI components
- Handles both metadata (database) and content (Storage) fetching
- Custom error classification for robust retry logic
- Batch operations for course-level revision material management

**Content Structure**:
Revision notes follow structured markdown format:
```markdown
# Course Cheat Sheet: Applications of Mathematics (National 4)

## Unit 1: Managing Finance and Statistics
### Key Formulas
- Simple Interest: $I = PRT$
- ...

## Unit 2: Geometry and Measures
### Key Concepts
- Pythagorean theorem: $a^2 + b^2 = c^2$
- ...
```

Lesson notes are more focused:
```markdown
# Lesson 3 Quick Notes: Calculating Simple Interest

## Key Points
1. Formula: $I = PRT$
2. P = Principal, R = Rate, T = Time
...
```

## Storage Architecture

**Purpose**: Appwrite Storage provides file storage capabilities for binary assets that exceed database document size limits or require specialized handling (images, markdown files, PDFs).

### Storage Buckets

The system uses two primary Storage buckets for different content types:

#### 1. Images Bucket (`6907775a001b754c19a6`)

**Purpose**: Stores PNG images for lesson diagrams and student drawing submissions.

**Configuration**:
- **Bucket ID**: `6907775a001b754c19a6`
- **Permissions**: Public read access (`read("any")`)
- **Allowed File Types**: PNG images (`.png`)
- **Maximum File Size**: 5MB per file
- **Compression**: None (images pre-rendered before upload)

**Content Types**:
1. **Lesson Diagrams** (JSXGraph rendered)
   - File naming: `dgm_image_{hash}` (deterministic based on lessonTemplateId + cardId)
   - Hash generation: MD5 of `${lessonTemplateId}_${cardId}_${diagram_context}`
   - Prevents duplicate uploads for same diagram
   - Typical size: 50-500KB per diagram

2. **Student Drawings** (Canvas submissions)
   - File naming: `sdraw_{timestamp}_{uuid}` (~23 characters)
   - Format: `sdraw_1704067200000_a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - Unique per submission (timestamp + UUID v4)
   - Validation: Max 5 images per evidence submission
   - Typical size: 10-200KB per drawing

**Retrieval Patterns**:
```typescript
// Preview URL generation
const previewUrl = `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/view`;

// DiagramDriver fetching
const diagrams = await DiagramDriver.fetchDiagramsByContext(lessonTemplateId, 'lesson');
const imageUrl = diagrams[0].getPreviewUrl(); // Generates view URL

// StudentDrawingStorageDriver fetching
const drawingUrls = await EvidenceDriver.getDrawingUrls(evidenceRecord);
// Returns blob URLs for legacy base64 or Storage preview URLs
```

**Cleanup Strategy**:
- Diagrams: Cascade delete when lesson template is deleted
- Drawings: Cascade delete when evidence record is deleted
- Orphan detection: Periodic scan for files without database references

#### 2. Documents Bucket (`documents`)

**Purpose**: Stores markdown files for revision materials (cheat sheets, lesson notes).

**Configuration**:
- **Bucket ID**: `documents`
- **Permissions**: User-scoped read (TBD based on role requirements)
- **Allowed File Types**: Markdown (`.md`)
- **Maximum File Size**: 1MB per file
- **Content Format**: UTF-8 encoded markdown with LaTeX math support

**Content Types**:
1. **Course Cheat Sheets**
   - File naming: `{courseId}_cheat_sheet.md`
   - Contains: Comprehensive course summary with key formulas, concepts, examples
   - Structure: Hierarchical markdown (H2 units, H3 topics)
   - LaTeX: Inline `$...$` and display `$$...$$` math notation

2. **Lesson Quick Notes**
   - File naming: `{courseId}_lesson_{order:02d}.md`
   - Contains: Focused lesson summary with key takeaways
   - Structure: Simple markdown (H2 sections, bullet lists)
   - LaTeX: Same math notation support

**Retrieval Patterns**:
```typescript
// RevisionNotesDriver fetching
const cheatSheet = await RevisionNotesDriver.getCheatSheet(courseId);
const markdown = await storage.getFileView('documents', cheatSheet.markdown_file_id);

// Frontend rendering
const renderedHtml = markdownParser.render(markdown); // With LaTeX support
```

**Error Handling**:
- Fast-fail pattern for 404 errors (notes don't exist)
- Retry logic for network timeouts (exponential backoff)
- Existence checks before rendering UI components

### File Naming Conventions

**Deterministic IDs** (prevent duplicates):
- Diagrams: Hash-based `dgm_image_{md5(lessonTemplateId_cardId_context)}`
- Revision notes: Template-based `{courseId}_cheat_sheet.md`

**Unique IDs** (allow duplicates):
- Drawings: Timestamp + UUID `sdraw_{Date.now()}_{uuidv4()}`

**Benefits**:
- Deterministic IDs enable idempotent uploads
- Unique IDs support multiple submissions
- Human-readable for debugging
- Under 50-character Appwrite limit

### Validation and Size Limits

**Per-File Limits**:
| Content Type | Max Size | Max Count | Format |
|--------------|----------|-----------|--------|
| Lesson Diagrams | 5MB | Unlimited | PNG |
| Student Drawings | 5MB | 5 per evidence | PNG |
| Revision Notes | 1MB | Unlimited | Markdown |

**Enforcement Points**:
- **Frontend**: Pre-upload validation (file size, count, type)
- **Backend**: Secondary validation in Storage drivers
- **Appwrite**: Final enforcement via bucket configuration

**Example Validation**:
```typescript
// StudentDrawingStorageDriver.validateUpload()
if (files.length > 5) {
  throw new Error("Maximum 5 drawings per submission");
}
for (const file of files) {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`File ${file.name} exceeds 5MB limit`);
  }
  if (!file.type.startsWith('image/png')) {
    throw new Error(`File ${file.name} must be PNG format`);
  }
}
```

### Storage Integration Patterns

**Database + Storage Pattern**:
All Storage files have corresponding database records for metadata:

```
Database Record                Storage File
┌─────────────────────┐       ┌──────────────────────┐
│ lesson_diagrams     │       │ Images Bucket        │
│ - lessonTemplateId  │──────▶│ dgm_image_{hash}.png │
│ - image_file_id     │       └──────────────────────┘
│ - jsxgraph_json     │
│ - diagram_type      │
└─────────────────────┘

Database Record                Storage File
┌─────────────────────┐       ┌──────────────────────┐
│ evidence            │       │ Images Bucket        │
│ - student_drawing_  │──────▶│ sdraw_{ts}_{uuid}.png│
│   file_ids: [...]   │       │ sdraw_{ts}_{uuid}.png│
└─────────────────────┘       └──────────────────────┘

Database Record                Storage File
┌─────────────────────┐       ┌──────────────────────┐
│ revision_notes      │       │ Documents Bucket     │
│ - markdown_file_id  │──────▶│ {courseId}_cheat.md  │
│ - noteType          │       └──────────────────────┘
└─────────────────────┘
```

**Access Flow**:
1. Query database for metadata record
2. Extract Storage file ID from record
3. Generate preview URL or fetch file content
4. Render in UI (image tag, markdown parser)

**Deletion Flow**:
1. Delete database record
2. Cascade delete Storage file (via driver cleanup)
3. Handle orphaned files via periodic cleanup job

### Performance Considerations

**Caching Strategies**:
- **Diagrams**: Browser caches PNG files (immutable content)
- **Drawings**: Short-lived URLs, no server-side cache needed
- **Revision Notes**: Markdown content cached client-side after first fetch

**Lazy Loading**:
- Diagrams load on-demand when lesson card is displayed
- Drawings fetch only when evidence detail is expanded
- Revision notes fetch on navigation to revision section

**Batch Operations**:
- DiagramDriver supports batch fetching by lesson template
- StudentDrawingStorageDriver batch uploads multiple files
- RevisionNotesDriver existence checks avoid redundant fetches

**CDN Integration** (Future):
- Appwrite Storage supports CDN configuration
- Static assets (diagrams, revision notes) ideal candidates
- Would reduce latency for repeated access

## Frontend Integration Patterns

### Driver Architecture

The frontend uses a driver pattern for data access, organized into three categories:

#### Core Data Drivers (Original 8)

- **BaseDriver**: Generic CRUD operations and session management
  - Abstract base class providing common database operations
  - Handles Appwrite client initialization
  - Session token management for authenticated requests
  - Error handling and retry logic

- **StudentDriver**: Student profile management
  - Extends BaseDriver for `students` collection
  - Methods: `createStudent()`, `getStudentByUserId()`, `updateStudent()`
  - Manages student profile data and accommodations

- **SessionDriver**: Learning session lifecycle
  - Manages `sessions` collection with stage progression
  - Methods: `createSession()`, `updateStage()`, `endSession()`
  - Conversation history compression/decompression utilities
  - Dual chat thread management (main + context)

- **EvidenceDriver**: Assessment data persistence
  - Manages `evidence` collection with outcome scoring
  - Methods: `createEvidence()`, `getEvidenceBySession()`, `getDrawingUrls()`
  - Handles both legacy base64 drawings and Storage file references
  - Outcome-level performance tracking

- **MasteryV2Driver**: Learning progress tracking
  - Manages `MasteryV2` collection with EMA scoring
  - Methods: `updateMastery()`, `getMasteryForCourse()`, `getOutcomeMastery()`
  - Exponential moving average calculation
  - Unique constraint on (studentId, courseId)

- **LessonDriver**: Lesson template operations
  - Manages `lesson_templates` collection
  - Methods: `getLessonById()`, `getLessonsByCourse()`, `decompressCards()`
  - LZString decompression for lesson cards
  - Filtering by lesson_type and engagement_tags

- **AuthoredSOWDriver**: AI-generated curriculum template operations
  - Manages `Authored_SOW` collection
  - Methods: `getAuthoredSOW()`, `getLatestVersion()`, `createAuthoredSOW()`
  - Version-based curriculum retrieval
  - Template source for SOWV2 instances

- **SOWDriver**: Student-specific curriculum planning (SOWV2)
  - Manages `SOWV2` collection with reference architecture
  - Methods: `getSOWForEnrollment()`, `copyFromAuthoredSOW()`, `updateCustomizations()`
  - Dereferences to Authored_SOW for curriculum data
  - Overlays student customizations on top of template

- **RoutineDriver**: Spaced repetition scheduling
  - Manages `routine` collection
  - Methods: `getRoutine()`, `updateDueAtByOutcome()`, `calculateNextReview()`
  - Spaced repetition algorithm implementation
  - Due date tracking per learning outcome

#### Phase 9+ Drivers (New 4)

- **DiagramDriver**: Lesson diagram management (Phase 9)
  - Manages `lesson_diagrams` collection + Storage bucket integration
  - Methods: `fetchDiagramsByContext()`, `uploadDiagram()`, `deleteDiagram()`, `getPreviewUrl()`
  - Context-based filtering (lesson vs cfu diagrams)
  - Batch operations for both contexts
  - Deterministic file ID generation for idempotent uploads
  - Preview URL generation from Storage bucket

- **StudentDrawingStorageDriver**: Student drawing uploads (Phase 10)
  - Manages Storage uploads without database collection (pure Storage driver)
  - Methods: `uploadDrawings()`, `deleteDrawings()`, `validateUpload()`
  - File ID format: `sdraw_{timestamp}_{uuid}` for uniqueness
  - Validation: Max 5 images, 5MB per file, PNG only
  - Batch upload/delete operations
  - Integration with EvidenceDriver via `student_drawing_file_ids` field

- **RevisionNotesDriver**: Course revision materials (Recent)
  - Manages `revision_notes` collection + Documents bucket
  - Methods: `getCheatSheet()`, `getLessonNote()`, `hasCheatSheet()`, `hasLessonNote()`
  - Fast-fail error handling with retry classification
  - Existence checks for conditional UI rendering
  - Fetches both metadata (database) and content (Storage)
  - Custom `RevisionNotesError` class with retry guidance

- **CourseOutcomesDriver**: SQA learning outcomes (Recent)
  - Manages `course_outcomes` collection (read-only operations)
  - Methods: `getOutcomesByIds()`, `getOutcomesForCourse()`, `extractOutcomeIds()`
  - Filters assessment standards from general outcomes
  - Batch fetching by multiple outcome IDs
  - Parses mixed outcomeRefs arrays (both outcomes and standards)

#### Custom React Hooks (4)

- **useLessonDriver**: Custom hook for lesson operations
  - Provides lesson state management with loading/error states
  - Methods: `fetchLesson()`, `refreshLesson()`, `decompressCards()`
  - React Query integration for caching
  - Automatic card decompression

- **useEvidence**: Evidence management hook
  - Simplifies evidence creation and retrieval
  - Methods: `submitEvidence()`, `getSessionEvidence()`, `getDrawingUrls()`
  - Handles drawing uploads via StudentDrawingStorageDriver
  - Optimistic updates for responsive UI

- **useLesson**: Lesson state management hook
  - Manages active lesson state across components
  - Methods: `startLesson()`, `completeCard()`, `submitResponse()`
  - Progress tracking within lesson
  - Card navigation state

- **useAuth**: Authentication hook
  - Wraps Appwrite authentication API
  - Methods: `login()`, `logout()`, `signup()`, `getCurrentUser()`
  - Session persistence
  - Protected route integration

#### Compression Utilities

**LZString** (Lesson Cards):
```typescript
// LessonDriver.decompressCards()
import LZString from 'lz-string';
const cards = JSON.parse(LZString.decompressFromUTF16(compressedCards));
```

**Pako** (Conversation History):
```typescript
// SessionDriver.compressHistory()
import pako from 'pako';
const compressed = btoa(pako.gzip(JSON.stringify(messages), { to: 'string' }));
const decompressed = JSON.parse(pako.ungzip(atob(compressed), { to: 'string' }));
```

**Image Utilities**:
```typescript
// StudentDrawingStorageDriver.generateFileId()
const fileId = `sdraw_${Date.now()}_${crypto.randomUUID()}`;

// DiagramDriver.generateDeterministicFileId()
import { MD5 } from 'crypto-js';
const hash = MD5(`${lessonTemplateId}_${cardId}_${context}`).toString();
const fileId = `dgm_image_${hash}`;
```

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
  ├─→ Lesson Templates (generated content) ──┐
  │                                          │
  └─→ SOWV2 (student reference + customizations) ←┐
       ↓                                           │
     Routine (spaced repetition)                   │
                                                   │
  Note: SOWV2 stores pointer to Authored_SOW ──────┘
        Curriculum data accessed via dereference

Storage Integration (Lesson Templates):
Lesson Template ──references──> Lesson Diagrams ──stores──> Storage (Images Bucket)
      │                              │                         ├─ dgm_image_{hash}.png (lesson)
      │                              │                         └─ dgm_image_{hash}.png (cfu)
      └──references──> Revision Notes ──stores──> Storage (Documents Bucket)
                                                   └─ {courseId}_lesson_{order}.md
```

### Student Learning Journey with Storage
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
  ↓                           ┌──────────────────────────────────┐
  │                           │ Dual Chat Architecture:          │
  ├─ threadId ────────────────┤ Main teaching graph              │
  └─ contextChatThreadId ─────┤ Context clarification chat       │
  ↓                           └──────────────────────────────────┘
Evidence (assessment data)
  │
  ├─ student_drawing_file_ids ──stores──> Storage (Images Bucket)
  │                                         └─ sdraw_{timestamp}_{uuid}.png (max 5)
  ↓
MasteryV2 (progress tracking)

Note: Evidence uses Storage for drawings instead of base64 to avoid document size limits.
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

The system implements several migration patterns to evolve the data model without breaking existing functionality:

#### 1. Evidence Drawing Storage Migration (Phase 10)

**Problem**: Base64-encoded images in `evidence.student_drawing` field caused:
- Document size limit issues (~50KB max for embedded images)
- Slow queries due to document bloat
- Inefficient storage (base64 adds ~33% overhead)

**Solution**: Migrate to Storage bucket with file references

**Migration Strategy**:
```typescript
// Backward-compatible read pattern (EvidenceDriver.getDrawingUrls())
async getDrawingUrls(evidence: Evidence): Promise<string[]> {
  // Prefer new Storage file IDs
  if (evidence.student_drawing_file_ids && evidence.student_drawing_file_ids.length > 0) {
    const fileIds = JSON.parse(evidence.student_drawing_file_ids);
    return fileIds.map(fileId =>
      `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view`
    );
  }

  // Fallback to legacy base64 (no migration required)
  if (evidence.student_drawing) {
    const blob = base64ToBlob(evidence.student_drawing, 'image/png');
    return [URL.createObjectURL(blob)];
  }

  return [];
}

// New writes always use Storage
async submitDrawings(files: File[]): Promise<string[]> {
  const fileIds = await StudentDrawingStorageDriver.uploadDrawings(files);
  return fileIds; // Store in evidence.student_drawing_file_ids
}
```

**Migration Status**:
- ✅ No database migration script needed
- ✅ Read path handles both formats automatically
- ✅ Write path always uses new format
- ⏳ Legacy base64 data remains in place (gradual sunset)

#### 2. Session Conversation History Compression

**Problem**: Chat message arrays grew too large for `sessions` collection documents

**Solution**: Gzip + base64 compression in `conversationHistory` field

**Implementation**:
```typescript
// Compression (SessionDriver.saveConversationHistory())
import pako from 'pako';
const json = JSON.stringify(messages);
const gzipped = pako.gzip(json, { to: 'string' });
const compressed = btoa(gzipped);
await sessionDriver.update(sessionId, { conversationHistory: compressed });

// Decompression (Session replay)
const gzipped = atob(session.conversationHistory);
const json = pako.ungzip(gzipped, { to: 'string' });
const messages = JSON.parse(json);
```

**Compression Ratio**: Typical 70-80% reduction in storage size

**Migration Status**:
- ✅ Field added as optional
- ✅ New sessions populate automatically
- ✅ Old sessions without history remain functional
- 📊 Compression analytics tracked for optimization

#### 3. SOWV2 Reference Architecture (Migration from Copy Pattern)

**Problem**: Original SOWV2 duplicated entire curriculum in `entries` field
- Data duplication across thousands of student records
- Sync issues when Authored_SOW updated
- Hit document size limits for large curricula

**Solution**: Reference-based architecture with pointer to Authored_SOW

**Migration Script** (`scripts/migrate-sowv2-to-references.ts`):
```typescript
// Pseudo-code migration logic
for (const sowv2 of allSOWV2Records) {
  if (sowv2.source_authored_sow_id) {
    continue; // Already migrated
  }

  // Find matching Authored_SOW by courseId + version
  const authoredSOW = await AuthoredSOWDriver.getLatestVersion(sowv2.courseId);

  // Convert to reference pattern
  await SOWDriver.update(sowv2.$id, {
    source_authored_sow_id: authoredSOW.$id,
    source_version: authoredSOW.version,
    entries: "[]" // Clear duplicated data
  });
}
```

**Data Access Pattern After Migration**:
```typescript
// SOWDriver.getSOWForEnrollment() - transparent to callers
async getSOWForEnrollment(studentId: string, courseId: string): Promise<SOWData> {
  const sowv2 = await this.getByStudentCourse(studentId, courseId);

  // Dereference to Authored_SOW
  const authoredSOW = await AuthoredSOWDriver.getById(sowv2.source_authored_sow_id);

  // Merge template entries with student customizations
  return {
    entries: JSON.parse(authoredSOW.entries),
    metadata: JSON.parse(authoredSOW.metadata),
    customizations: JSON.parse(sowv2.customizations)
  };
}
```

**Migration Status**:
- ⏳ Migration script ready but not yet run (requires downtime)
- ✅ Read path supports both patterns (detects presence of source_authored_sow_id)
- ✅ New enrollments use reference pattern
- ⚠️ Breaking change for direct database queries (need to dereference)

#### 4. Lesson Template Versioning (Phase 9)

**Problem**: No tracking of which AI model generated lessons or which SOW version

**Solution**: Add optional versioning fields without breaking existing records

**Schema Addition**:
```typescript
interface LessonTemplate {
  // ... existing fields ...

  // Phase 9: Optional versioning (backward compatible)
  authored_sow_id?: string;      // Links to source SOW
  authored_sow_version?: string; // Denormalized for filtering
  model_version?: string;         // AI model tracking
}
```

**Migration Strategy**:
- ✅ Fields added as optional (no default values needed)
- ✅ Existing lessons remain valid without these fields
- ✅ New lessons populate automatically via authoring pipeline
- ✅ Filtering logic handles null values gracefully

**Benefits**:
- A/B testing between AI models
- Curriculum version tracking
- Rollback capability to previous SOW versions

#### 5. Collection-Level Security Migration

**Evidence Collection** (documentSecurity: true → false):

**Problem**: Document-level permissions caused performance issues at scale
- Every evidence document had individual permission arrays
- Query performance degraded with large datasets
- Permission checks expensive for analytics queries

**Solution**: Migrate to collection-level permissions

**Migration Steps**:
1. Update collection settings: `documentSecurity: false`
2. Update collection permissions: `read("users")`, `create("users")`, etc.
3. Remove per-document permissions (cleanup script)

**Impact**:
- ✅ 40% faster evidence queries
- ✅ Simplified permission model
- ⚠️ All users can read all evidence (filtered by studentId in queries)
- 🔒 Application-level filtering ensures data isolation

### Migration Best Practices

Based on the patterns above, the system follows these principles:

1. **Additive Changes Only**: New fields are always optional
2. **Dual Read Paths**: Support both old and new formats during transition
3. **Single Write Path**: New writes always use latest format
4. **No Required Migrations**: Systems remains functional without running migration scripts
5. **Graceful Degradation**: Missing fields don't break functionality
6. **Compression for Growth**: Use compression before hitting size limits
7. **Reference Over Copy**: Pointer architecture prevents duplication
8. **Monitoring**: Track adoption of new patterns via analytics

### Version Tracking Fields

Multiple collections use versioning for evolution tracking:

| Collection | Version Field | Purpose |
|------------|--------------|---------|
| students | schema_version | Student profile schema evolution |
| enrollments | schema_version | Enrollment data format changes |
| lesson_templates | version | Template iteration tracking |
| lesson_templates | model_version | AI model comparison |
| Authored_SOW | version | Curriculum version (e.g., "1.2", "2.0") |
| SOWV2 | source_version | Denormalized for debugging |
| routine | spacingPolicyVersion | Spaced repetition algorithm version |
| routine | schema_version | Routine data format changes |

### Future Migration Considerations

**Planned Improvements**:
1. **Diagram Versioning**: Track diagram generation iterations and quality scores
2. **Outcome Standardization**: Migrate from mixed outcomeRefs to structured format
3. **Session Archival**: Move completed sessions to archive collection after 90 days
4. **Evidence Aggregation**: Pre-compute mastery statistics to reduce query load

**Technical Debt**:
- Legacy `mastery` collection still in use (migrate to MasteryV2)
- Legacy `sow` collection (migrate to SOWV2)
- Some courses still use old `phase` and `sqaCode` fields (orphaned)

This data model supports the full Scottish AI Lessons learning platform, from course enrollment through personalized lesson delivery and progress tracking, with robust security and performance characteristics.