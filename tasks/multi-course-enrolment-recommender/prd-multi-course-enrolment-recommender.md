# Product Requirements Document: Multi-Course Enrolment & Course Manager Recommender

**Product:** Multi-Course Agentic Tutor (SQA)
**Scope:** MVP1 - Core Functionality
**Date:** 15 Sep 2025
**Status:** Draft
**Author:** Team Sociotech

---

## Introduction/Overview

The Multi-Course Enrolment & Course Manager Recommender enables students to enroll in multiple SQA courses and receive AI-powered, ranked lesson recommendations based on their Scheme of Work (SoW), mastery levels, and spaced repetition scheduling. The system builds on MVP0's teaching loop by adding intelligent course-level planning and transparent recommendation reasoning.

**Problem Solved:** Students currently must manually select lessons without guidance on optimal learning progression across multiple courses, leading to fragmented learning and suboptimal study paths.

**Goal:** Enable students to view prioritized, reasoned lesson recommendations for each enrolled course and start lessons with one click, maintaining MVP0's end-to-end teaching experience.

---

## Goals

1. **Multi-Course Support:** Students can enroll in multiple SQA National qualification courses
2. **Intelligent Recommendations:** AI-powered lesson ranking based on due dates, mastery levels, and SoW progression
3. **Transparent Reasoning:** Clear explanations for why each lesson is recommended (overdue, low mastery, etc.)
4. **Seamless Integration:** One-click lesson start that flows into existing MVP0 teaching loop
5. **Zero Degradation:** System fails fast with clear error messages rather than silent fallbacks
6. **Maintainable Architecture:** Clean separation between Next.js data orchestration and LangGraph AI reasoning

---

## User Stories

**As a student studying multiple National qualifications,**
I want to see a ranked list of recommended lessons for each course I'm enrolled in,
So that I can focus on the most important content without manually choosing what to study next.

**As a student with overdue practice sessions,**
I want overdue lessons to be prioritized with clear "overdue" badges,
So that I can catch up on spaced repetition intervals and maintain long-term retention.

**As a student with varying mastery levels,**
I want lessons covering low-mastery outcomes to be ranked higher,
So that I can strengthen weak areas before they become knowledge gaps.

**As a student wanting to progress systematically,**
I want to see why each lesson is recommended (reasons like "overdue", "low mastery", "next in sequence"),
So that I understand the learning strategy and trust the recommendations.

**As a student ready to study,**
I want to click "Start" on any recommended lesson and immediately enter the teaching loop,
So that I can begin learning without additional navigation or setup.

---

## Functional Requirements

### Core Functionality

1. **Course Enrollment System**
   - Students must be able to enroll in multiple SQA National qualification courses
   - System must validate enrollment permissions and course availability
   - Enrollment must automatically bootstrap a default Scheme of Work (SoW) for the course

2. **Enrollment Dashboard**
   - System must display all enrolled courses with their respective lesson recommendations
   - Dashboard must show a maximum of 5 ranked lesson candidates per course
   - Each lesson candidate must display: title, estimated minutes, priority score, and reason badges
   - System must provide a prominent "Top Pick" CTA for the highest-ranked lesson per course

3. **AI-Powered Course Manager Recommender**
   - System must implement a LangGraph subgraph that scores and ranks lesson templates
   - Recommender must use the following scoring rubric:
     - +0.40 points for lessons covering ≥1 overdue outcomes (based on spaced repetition schedule)
     - +0.25 points for lessons covering ≥1 low-EMA outcomes (mastery < 0.6)
     - +0.15 points for early SoW order positioning (earlier = higher score)
     - -0.10 points for recently taught lessons (within last N sessions)
     - -0.05 points for lessons exceeding maximum block time (25 minutes default)
   - System must return structured recommendations with transparent reasoning for each score component

4. **Recommendation Context Assembly**
   - CoursePlannerService must gather and normalize data from Appwrite:
     - Student profile (ID, display name, accommodations)
     - Course details (ID, subject, level)
     - Scheme of Work entries with order and template references
     - Published lesson templates only (status = "published")
     - Current mastery levels (EMA by outcome)
     - Spaced repetition schedule (due dates by outcome)
   - System must validate all input data and fail fast on missing required fields

5. **Session Creation and Lesson Launch**
   - System must create a session with frozen lesson snapshot when student clicks "Start"
   - Session must preserve exact template content (cards, outcomes, version) at time of start
   - System must route student to existing MVP0 teaching loop without modification
   - Session must persist with stage "design" for MVP0 compatibility

6. **Checkpointing and State Management**
   - System must persist Course Manager's graphRunId in planner_threads table
   - Each (studentId, courseId) pair must have unique checkpoint thread for recommendation continuity
   - System must resume from existing checkpoint when available
   - System must handle checkpoint corruption by creating new thread

### Data Management

7. **Database Schema Extensions**
   - System must add planner_threads collection: {studentId, courseId, graphRunId, updatedAt}
   - System must maintain backward compatibility with all existing MVP0 collections
   - All new database writes must use typed schemas with validation

8. **API Endpoints**
   - GET /api/recommendations/:courseId must return CourseRecommendation with candidates array
   - POST /api/sessions/start must accept {courseId, lessonTemplateId} and return {sessionId}
   - All endpoints must enforce owner-only access using existing auth system
   - All endpoints must validate input using Zod schemas

### Error Handling

9. **Zero Fallback Policy**
   - System must fail fast with clear error messages when LangGraph recommender fails
   - System must not provide silent degradation or default recommendations
   - API must return appropriate HTTP status codes (400, 401, 403, 500) with descriptive error messages
   - Frontend must display specific error states for different failure scenarios

10. **Validation and Type Safety**
    - All API inputs and outputs must be validated using Zod schemas
    - TypeScript contracts must define SchedulingContextForCourse and CourseRecommendation interfaces
    - System must validate lesson template availability at session creation time
    - Database queries must use typed SDK wrappers with runtime validation

---

## Non-Goals (Out of Scope)

1. **Fallback Mechanisms:** No silent degradation or default recommendations when AI fails
2. **Cross-Course Study Planning:** MVP1 focuses on per-course recommendations only
3. **Progress Dashboards:** Detailed progress tracking is planned for MVP3
4. **Hardening Features:** Performance optimization, caching, and monitoring deferred to Phase 2
5. **Custom Rubric Configuration:** Fixed scoring weights for MVP1
6. **Multi-Language Support:** English only for initial implementation
7. **Mobile-Specific UI:** Responsive web design sufficient for MVP1

---

## Design Considerations

### Architecture Pattern
- **Next.js Gateway Pattern:** Only Next.js accesses Appwrite; LangGraph remains stateless for security
- **Contract-Based Integration:** Strict TypeScript interfaces between Next.js and LangGraph components
- **Component Separation:** CoursePlannerService handles data orchestration; Course Manager handles AI reasoning

### UI/UX Requirements & User Journey Transformation

#### Current Dashboard Analysis (MVP0)

**Existing Layout Structure:**
1. **Welcome Header** - Personal greeting with generic learning journey message
2. **Available Lessons Section** - Grid of all published lesson templates with basic "Start Lesson" buttons
3. **Previous Lessons Section** - Collapsible history with completed/in-progress sessions

**Current UX Issues:**
- No lesson prioritization or guidance
- Students must manually decide which lesson to take next
- No multi-course support (single National 3 AoM course)
- No learning progression indicators
- Generic "Available Lessons" with no context

#### MVP1 Dashboard Transformation

**New Information Architecture:**
```
┌─ Welcome Header (Enhanced)
├─ Course Enrollment Tabs/Pills
│  ├─ National 3 Applications of Mathematics
│  ├─ National 3 Physics
│  └─ National 3 English
├─ Recommended Lessons (Per Course) ⭐ NEW
│  ├─ Top Pick CTA
│  ├─ Priority List (5 lessons max)
│  └─ Recommendation Reasoning
├─ All Available Lessons (Demoted)
└─ Previous Sessions History (Unchanged)
```

#### Visual Design Specifications

**1. Enhanced Welcome Header**

*User Journey Context:* Appears immediately when student lands on dashboard (Step 1 of all journeys)

*Visual Description:* Transforms the generic welcome message into a personalized multi-course overview. The header now displays enrolled course count and shows visual pills for each subject area, creating immediate context about the student's learning scope.

*ASCII Wireframe:*
```
┌─────────────────────────────────────────────────────────────────────┐
│ Welcome back, Sarah!                                                │
│ Ready to continue your learning across 3 courses?                  │
│ Here's what we recommend next:                                      │
│                                                                     │
│ ┌──────────────┐ ┌──────────┐ ┌─────────┐                        │
│ │ Mathematics  │ │ Physics  │ │ English │                        │
│ └──────────────┘ └──────────┘ └─────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

*Implementation Code:*
```jsx
// Current (MVP0)
<h1>Welcome, {student.name}!</h1>
<p>Continue your mathematics learning journey...</p>

// MVP1 Enhancement
<h1>Welcome back, {student.name}!</h1>
<p>Ready to continue your learning across <strong>{enrolledCourses.length} courses</strong>?
   Here's what we recommend next:</p>
<div className="flex gap-2 mt-2">
  {enrolledCourses.map(course => (
    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
      {course.subject}
    </span>
  ))}
</div>
```

**2. Course Navigation Tabs**

*User Journey Context:* Primary navigation appears after welcome header (Step 2), enables course switching throughout dashboard

*Visual Description:* Horizontal tab interface with clear active/inactive states. Each tab shows course name with optional red notification badges indicating overdue lessons. Active tab gets blue accent and background highlighting. Hover states provide smooth visual feedback.

*ASCII Wireframe:*
```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────┐ ┌─────────────┐ ┌─────────────┐                │
│ │ Mathematics [2] │ │   Physics   │ │   English   │                │
│ │ ═══════════════ │ │             │ │             │                │
│ └─────────────────┘ └─────────────┘ └─────────────┘                │
│ ────────────────────────────────────────────────────────────────    │
│                                                                     │
│ [2] = Red badge showing overdue lessons count                       │
│ ═══ = Blue underline indicating active tab                         │
└─────────────────────────────────────────────────────────────────────┘
```

*Implementation Code:*
```jsx
<div className="flex gap-1 mb-6 border-b">
  {enrolledCourses.map(course => (
    <button
      className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
        selectedCourse === course.id
          ? 'border-blue-500 text-blue-600 bg-blue-50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
      onClick={() => setSelectedCourse(course.id)}
    >
      {course.subject}
      {getOverdueLessonsCount(course.id) > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
          {getOverdueLessonsCount(course.id)}
        </span>
      )}
    </button>
  ))}
</div>
```

**3. Recommended Lessons Section (Core UX Innovation)**

*User Journey Context:* Main content area after course tab selection (Step 3), primary decision-making interface

*Visual Description:* Gradient blue container with sparkle icon creates premium feel for AI recommendations. Top Pick card uses elevated styling with border emphasis, larger text, and prominent CTA. Priority list shows 4 additional options with comparative scoring. Explanation footer builds trust through transparency.

*ASCII Wireframe:*
```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Recommended for National 3 Mathematics                          │
│ ░░ AI-powered suggestions based on your progress                  ░░│
│ ░░                                                               ░░│
│ ░░ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ░░│
│ ░░ ┃ TOP PICK                                    Score: 0.87   ┃ ░░│
│ ░░ ┃ Fractions ↔ Decimals ↔ Percents                           ┃ ░░│
│ ░░ ┃ [overdue] [low mastery]                                   ┃ ░░│
│ ░░ ┃ Estimated time: 45 minutes                 [Start Now →] ┃ ░░│
│ ░░ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ░░│
│ ░░                                                               ░░│
│ ░░ #2  Score: 0.72   Algebraic Expressions          [Start]     ░░│
│ ░░ #3  Score: 0.68   Area and Perimeter            [Start]     ░░│
│ ░░ #4  Score: 0.58   Linear Equations              [Start]     ░░│
│ ░░ #5  Score: 0.45   Statistics: Mean & Mode       [Start]     ░░│
│ ░░                                                               ░░│
│ ░░ How we recommend: Overdue>LowEMA>Order | -Recent -TooLong    ░░│
└─────────────────────────────────────────────────────────────────────┘

░░ = Blue gradient background
┏━┓ = Emphasized border for Top Pick
[badges] = Color-coded reason indicators
```
```jsx
<div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-8">
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
      <SparklesIcon className="w-4 h-4 text-white" />
    </div>
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        Recommended for {selectedCourse.subject}
      </h2>
      <p className="text-sm text-gray-600">
        AI-powered suggestions based on your progress and spaced repetition
      </p>
    </div>
  </div>

  {/* Top Pick CTA */}
  {recommendations.candidates[0] && (
    <div className="bg-white rounded-lg border-2 border-blue-300 p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
              TOP PICK
            </span>
            <span className="text-sm font-medium text-gray-900">
              Score: {recommendations.candidates[0].priorityScore.toFixed(2)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">
            {recommendations.candidates[0].title}
          </h3>
          <div className="flex flex-wrap gap-1 mb-3">
            {recommendations.candidates[0].reasons.map(reason => (
              <ReasonBadge key={reason} reason={reason} />
            ))}
          </div>
          <p className="text-sm text-gray-600">
            Estimated time: {recommendations.candidates[0].estimatedMinutes} minutes
          </p>
        </div>
        <button className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Start Now →
        </button>
      </div>
    </div>
  )}

  {/* Priority List */}
  <div className="space-y-3">
    {recommendations.candidates.slice(1, 5).map((candidate, index) => (
      <div key={candidate.lessonTemplateId} className="bg-white rounded-lg border p-3 hover:border-blue-200 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-600">#{index + 2}</span>
              <span className="text-sm text-gray-500">
                Score: {candidate.priorityScore.toFixed(2)}
              </span>
            </div>
            <h4 className="font-medium text-gray-900 mb-1">{candidate.title}</h4>
            <div className="flex flex-wrap gap-1">
              {candidate.reasons.map(reason => (
                <ReasonBadge key={reason} reason={reason} size="sm" />
              ))}
            </div>
          </div>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
            Start
          </button>
        </div>
      </div>
    ))}
  </div>

  {/* Recommendation Explanation */}
  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
    <p className="text-sm text-blue-800">
      <strong>How we recommend:</strong> {recommendations.rubric}
    </p>
  </div>
</div>
```

**4. Reason Badge Component**

*User Journey Context:* Appears within recommendation cards (Step 3-4), provides contextual explanation for lesson prioritization

*Visual Description:* Small pill-shaped indicators with semantic color coding. Red for urgent (overdue), orange for learning needs (low mastery), green for curriculum flow (early order), purple for time efficiency (short win). Each badge includes border for definition and uses readable contrast ratios.

*ASCII Wireframe:*
```
Reason Badge Color Coding:
┌──────────────────────────────────────────┐
│ ┌─────────┐ ┌─────────────┐ ┌──────────┐ │
│ │ overdue │ │ low mastery │ │early ord │ │
│ │  (red)  │ │  (orange)   │ │ (green)  │ │
│ └─────────┘ └─────────────┘ └──────────┘ │
│                                          │
│ ┌───────────┐ ┌─────────┐ ┌────────────┐ │
│ │ short win │ │ recent  │ │long lesson │ │
│ │ (purple)  │ │ (gray)  │ │  (yellow)  │ │
│ └───────────┘ └─────────┘ └────────────┘ │
└──────────────────────────────────────────┘

Size Variations:
Default: px-2 py-1 text-xs
Small:   px-1.5 py-0.5 text-xs
```

*Implementation Code:*
```jsx
const ReasonBadge = ({ reason, size = 'default' }) => {
  const badgeStyles = {
    'overdue': 'bg-red-100 text-red-700 border-red-200',
    'low mastery': 'bg-orange-100 text-orange-700 border-orange-200',
    'early order': 'bg-green-100 text-green-700 border-green-200',
    'short win': 'bg-purple-100 text-purple-700 border-purple-200',
    'recent': 'bg-gray-100 text-gray-600 border-gray-200',
    'long lesson': 'bg-yellow-100 text-yellow-700 border-yellow-200'
  };

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-xs'
    : 'px-2 py-1 text-xs';

  return (
    <span className={`${badgeStyles[reason]} ${sizeClasses} border rounded-full font-medium`}>
      {reason}
    </span>
  );
};
```

#### Step-by-Step User Journey (MVP1)

**Journey 1: New Student First Visit**

1. **Dashboard Landing**
   - User sees enhanced welcome message mentioning "3 courses"
   - Course enrollment pills visible (AoM, Physics, English)
   - Loading skeleton for recommendations

2. **Course Selection**
   - User clicks "National 3 Applications of Mathematics" tab
   - Tab highlights with blue border and background
   - Red badge shows "2" overdue lessons

3. **Recommendations Appear**
   - Gradient blue section loads with sparkle icon
   - Top Pick card prominently displayed with:
     - "TOP PICK" badge
     - Score: 0.87
     - Title: "Fractions ↔ Decimals ↔ Percents"
     - Reason badges: ["overdue", "low mastery"]
     - "Start Now →" blue CTA button
   - 4 additional recommendations below with scores 0.72-0.45

4. **Understanding Context**
   - User reads explanation: "How we recommend: Overdue>LowEMA>Order | -Recent -TooLong"
   - Understands overdue lessons are prioritized
   - Sees low mastery areas highlighted

5. **Starting Top Pick**
   - User clicks "Start Now →" on top recommendation
   - Navigates to existing MVP0 teaching loop session
   - Teaching experience unchanged from MVP0

**Journey 2: Returning Student Course Switching**

1. **Quick Course Assessment**
   - User sees all 3 courses in header pills
   - Physics tab shows "1" overdue lesson badge
   - English tab shows no badges (up to date)

2. **Physics Course Selection**
   - User clicks Physics tab
   - New recommendations load for Physics content
   - Top Pick: "Newton's First Law: Motion and Forces"
   - Reason badges: ["overdue", "early order"]

3. **Progress Comparison**
   - User can quickly compare course progress
   - Visual cues help identify which course needs attention
   - Clear prioritization reduces decision fatigue

#### UX Best Practices Implementation

1. **Progressive Disclosure**
   - Recommendations shown first (most important)
   - "All Available Lessons" collapsed by default
   - "Show less/Browse all" toggle prevents overwhelm

2. **Visual Hierarchy**
   - Top Pick uses larger card, blue gradient, border emphasis
   - Priority scores provide quantitative ranking
   - Color-coded reason badges enable quick scanning

3. **Cognitive Load Reduction**
   - Maximum 5 recommendations per course (wireframe #3)
   - Clear reason badges eliminate guesswork (wireframe #4)
   - Course tabs group related content (wireframe #2)
   - Progressive disclosure with collapsible sections (wireframes #5, #6)

4. **Feedback & Transparency**
   - Recommendation rubric explained in plain English (wireframe #3)
   - Scores visible for quantitative learners (wireframe #3)
   - Reason badges provide qualitative context (wireframe #4)
   - Course filtering maintains context across sections (wireframes #2-6)

5. **Responsive Design**
   - Course tabs stack on mobile
   - Recommendation cards adjust to screen size
   - Priority list maintains readability on small screens

6. **Accessibility**
   - High contrast reason badges (WCAG AA compliant) (wireframe #4)
   - Keyboard navigation for all interactive elements (wireframes #2-6)
   - Screen reader friendly badge text and section headings
   - Focus indicators on all buttons and interactive elements
   - Semantic HTML structure with proper heading hierarchy

### Code Organization
- **File Length Limits:** Maximum 500 lines per file; extract utilities when exceeded
- **Function Length Limits:** Maximum 50 lines per function; use helper functions for complex logic
- **Module Structure:** Separate concerns into lib/appwrite/, lib/planners/, and lib/graphs/ directories
- **Component Structure:**
  - components/dashboard/EnhancedStudentDashboard.tsx
  - components/recommendations/RecommendationSection.tsx
  - components/recommendations/ReasonBadge.tsx
  - components/courses/CourseNavigationTabs.tsx

---

## Technical Considerations

### Technology Stack
- **Frontend:** Next.js 15.3.0 with App Router, TypeScript, Assistant-UI React components
- **Backend:** Next.js API routes and server actions
- **Database:** Appwrite v19.0.0 (existing collections + planner_threads)
- **AI Orchestration:** LangGraph with UnifiedState schema and subgraph integration
- **Validation:** Zod (available via Next.js compilation) for runtime type checking
- **Testing:** Outside-in TDD with Playwright v1.48.0 and pytest
- **LangGraph Client:** @langchain/langgraph-sdk v0.0.105
- **Assistant UI:** @assistant-ui/react-langgraph v0.5.11

### Dependencies
- **LangGraph Python Backend:** Must integrate with existing langgraph-agent/ implementation
- **MVP0 Teaching Loop:** Must remain unchanged and fully compatible
- **Appwrite Schema:** Must extend existing collections without breaking changes
- **Existing Auth System:** Must reuse without modification

### Performance Requirements
- **API Response Times:** Target <500ms for recommendation endpoints
- **Database Queries:** Use efficient queries with proper indexing on (studentId, courseId) pairs
- **Memory Usage:** Minimize context payload size to LangGraph recommender

---

## Success Metrics

1. **Functional Success:** Student can view ≥3 ranked candidates per enrolled course and successfully start any lesson
2. **Integration Success:** 100% compatibility with existing MVP0 teaching loop
3. **Reliability Success:** Zero silent failures; all errors must surface with clear messages
4. **Performance Success:** Recommendations API responds in <500ms for 95th percentile
5. **User Experience Success:** Clear reasoning visible for all recommendation scores
6. **Code Quality Success:** All functions <50 lines, all files <500 lines, 100% TypeScript coverage

---

## Testing Strategy

### Outside-in TDD Approach
1. **Start with E2E Tests:** Playwright tests covering full user journey from dashboard to lesson completion
2. **API Contract Tests:** Test all endpoint schemas and auth enforcement
3. **Integration Tests:** Test CoursePlannerService with real Appwrite data
4. **Unit Tests:** Test individual scoring algorithms and data transformations

### Python Backend Testing (LangGraph)
- **Framework:** pytest for Course Manager subgraph testing
- **Test Pyramid:** Following LangChain/LangGraph developer recommendations
- **Fixtures:** Seeded test data for multiple courses and mastery scenarios
- **Mocking:** Mock LLM calls for deterministic scoring tests

### Frontend Testing (Next.js)
- **Framework:** Jest + React Testing Library for component tests
- **E2E Framework:** Playwright for full user journeys
- **API Testing:** MSW (Mock Service Worker) for API route testing
- **Type Testing:** TypeScript strict mode with no 'any' types allowed

### Test Data Requirements
- **Enhanced Seed Data:** Extend MVP0 test data to include multiple course enrollments
- **Mastery Scenarios:** Test data covering high/low mastery, overdue outcomes, and fresh enrollments
- **SoW Variations:** Different course progressions and template orderings
- **Edge Cases:** Empty courses, unpublished templates, corrupted checkpoints

---

## Implementation Phases

### Phase 1: Core Implementation (MVP1)
1. **Database Schema:** Add planner_threads collection with proper indexes
2. **CoursePlannerService:** Context assembly and Appwrite integration
3. **Course Manager Subgraph:** LangGraph recommender with scoring algorithm
4. **API Endpoints:** Recommendations and session start endpoints
5. **Enrollment Dashboard:** UI for viewing and starting recommended lessons
6. **Integration Testing:** End-to-end flow from dashboard to lesson completion

### Development Order (Outside-in TDD)
1. **E2E Test Setup:** Create Playwright test for complete user journey
2. **API Contract Definition:** Define and test TypeScript interfaces
3. **Database Layer:** Implement typed Appwrite SDK wrappers
4. **LangGraph Integration:** Course Manager subgraph with deterministic scoring
5. **Frontend Components:** Dashboard UI with recommendation display
6. **Integration Testing:** Connect all components and verify MVP0 compatibility

---

## Open Questions

1. **Scoring Weight Tuning:** Should scoring weights be configurable via environment variables for A/B testing?
2. **Checkpoint Cleanup:** How long should planner_threads be retained? Auto-cleanup policy needed?
3. **Template Versioning:** How should recommendation system handle lesson template updates?
4. **Concurrent Sessions:** Should system prevent multiple active sessions per student?
5. **Audit Trail:** Do we need to log recommendation decisions for analytics/debugging?

---

## Acceptance Criteria

### Definition of Done
- [ ] Student can enroll in multiple SQA courses through existing enrollment flow
- [ ] Enrollment Dashboard displays ranked lesson recommendations with clear reasoning
- [ ] Course Manager recommender implements exact scoring rubric specified
- [ ] One-click lesson start creates session and routes to MVP0 teaching loop
- [ ] All API endpoints enforce proper authentication and validation
- [ ] Zero fallback behavior - system fails fast with clear error messages
- [ ] Complete test coverage following outside-in TDD methodology
- [ ] All code follows length limits (500 lines/file, 50 lines/function)
- [ ] TypeScript strict mode with full type coverage
- [ ] Integration with existing MVP0 teaching loop without modification

### Quality Gates
- [ ] All E2E tests pass covering happy path user journey
- [ ] All API contract tests validate schemas and auth
- [ ] Python backend tests achieve >90% coverage
- [ ] Frontend tests cover all UI states and error conditions
- [ ] Performance tests verify <500ms API response times
- [ ] Security tests confirm proper access control
- [ ] Manual testing with enhanced seed data for multiple courses

---

## Database Implementation Details

### Collection Schema Specifications

#### Core Collection Structures
All collections follow Appwrite's document structure with `$id` as the primary key. The following field-level specifications ensure consistent data handling:

**ID Format Conventions:**
- Students: `stu_{number}` (e.g., "stu_123")
- Courses: `course_{courseCode}` (e.g., "course_c84473")
- Templates: `lt_{level}_{subject}_{topic}_v{version}` (e.g., "lt_nat3_aom_best_deal_v1")
- Sessions: `sess_{number}` (e.g., "sess_001")
- Evidence: `ev_{number}` (e.g., "ev_001")
- Mastery: `mas_{number}` (e.g., "mas_001")
- Routine: `rt_{number}` (e.g., "rt_001")
- Planner Threads: `pth_{number}` (e.g., "pth_001")

#### Required Indexes
- `enrollments`: (studentId, courseId) - unique compound index
- `sow`: (studentId, courseId) - unique compound index
- `sessions`: (studentId, courseId) - for filtering by student and course
- `evidence`: (sessionId) - for session completion tracking
- `mastery`: (studentId, courseId) - unique compound index
- `routine`: (studentId, courseId) - unique compound index
- `planner_threads`: (studentId, courseId) - unique compound index

### Database Operation Patterns

#### Fetch Recommendations Flow
**Read Operations:**
- `sow` collection: Get ordered lesson plan for (studentId, courseId)
- `lesson_templates` collection: Filter by status="published" only
- `routine` collection: Get spaced repetition due dates
- `mastery` collection: Get current EMA scores by outcome
- `planner_threads` collection: Get existing graphRunId for resume

**Write Operations:**
- `planner_threads` collection: Upsert graphRunId returned by Course Manager

#### Start Lesson Flow
**Read Operations:**
- `lesson_templates` collection: Get chosen template by ID
- Validate template still exists and status="published"

**Write Operations:**
- `sessions` collection: Create with frozen lessonSnapshot containing:
  - Exact template content at time of session creation
  - Template version for audit trail
  - Cards array copied as-is from template
  - OutcomeRefs preserved for progress tracking

#### Finish Lesson Flow
**Write Operations:**
- `evidence` collection: Create attempt records with outcomeScores mapping
- `mastery` collection: Update EMA values using evidence scores
- `routine` collection: Update dueAtByOutcome and lastTaughtAt timestamps

### Context Normalization Rules

#### Template Filtering
- Include only templates where `status === "published"`
- Parse `outcomeRefs` from JSON string to array
- Parse `cards` from JSON string to object array
- Ensure `estMinutes` defaults to 20 if not specified

#### Routine Processing
- Convert all `dueAtByOutcome` timestamps to UTC ISO format
- Calculate `isOverdue` = `dueAt <= now()` for badge display
- Handle missing routine records gracefully (no previous sessions)

#### Mastery Processing
- Clamp all EMA values to range [0, 1]
- For missing outcomes, use contextual defaults (do not seed fake data)
- Calculate coverage percentage for tie-breaking in recommendations

#### Data Validation
- Validate all studentId references exist in auth system
- Ensure courseId references valid published courses
- Verify lessonTemplateId exists and is published before session creation
- Check outcome references match template definitions

### Caching Strategy

#### Cache Configuration
- **Duration**: 5-15 minutes per (studentId, courseId) pair
- **Cache Key Structure**: Hash of:
  - `sow.entries` array with order and templateId
  - `templates.$id` + `version` for all published templates
  - Top-level routine timestamps (`lastTaughtAt`, `updatedAt`)
  - Mastery hash from `emaByOutcome` values

#### Cache Invalidation Triggers
- Lesson completion (evidence submission)
- Mastery score updates
- Template publication/unpublication
- SoW modifications
- Manual assessment entry

#### Cache Implementation Notes
- Use Redis or in-memory cache for development
- Key format: `recommendations:{studentId}:{courseId}:{contextHash}`
- Implement cache-aside pattern with TTL

---

## Appendices

### A. Data Model Contracts

#### Complete Appwrite Collection Interfaces

**Core Collections (as stored in Appwrite)**

```typescript
// Student profile (from Auth system)
interface Student {
  $id: string;                    // e.g., "stu_123"
  displayName: string;            // e.g., "Amina"
  accommodations?: string[];      // e.g., ["chunking", "extra_time"]
  createdAt: string;             // ISO timestamp
}

// Course definitions (seeded)
interface Course {
  $id: string;                   // e.g., "course_c84473"
  subject: string;               // e.g., "Applications of Mathematics"
  level: string;                 // e.g., "Nat3"
  sqaCode: string;              // e.g., "C844 73"
}

// Student enrollment in courses
interface Enrollment {
  $id: string;                   // e.g., "enr_001"
  studentId: string;             // Foreign key to Student
  courseId: string;              // Foreign key to Course
  enrolledAt: string;            // ISO timestamp
}

// Scheme of Work (lesson plan per enrollment)
interface SoW {
  $id: string;                   // e.g., "sow_001"
  studentId: string;             // Foreign key to Student
  courseId: string;              // Foreign key to Course
  entries: Array<{
    order: number;               // Sequence position (1, 2, 3...)
    lessonTemplateId: string;    // Foreign key to LessonTemplate
    plannedAt?: string;          // Optional ISO timestamp
  }>;
  createdAt: string;             // ISO timestamp
}

// Lesson template definitions (seeded content)
interface LessonTemplate {
  $id: string;                   // e.g., "lt_nat3_aom_best_deal_v1"
  title: string;                 // e.g., "Best Deal: Unit Price & Simple Discounts"
  outcomeRefs: string;           // JSON string: "[\"HV7Y73_O1.4\", \"H22573_O1.2\"]"
  estMinutes?: number;           // e.g., 25 (defaults to 20)
  version: number;               // Template version (1, 2, 3...)
  status: string;                // "published" | "draft" | "archived"
  cards: string;                 // JSON string: "[{\"id\":\"q1\",\"type\":\"short\",...}]"
}

// Course Manager checkpoint (new in MVP1)
interface PlannerThread {
  $id: string;                   // e.g., "pth_001"
  studentId: string;             // Foreign key to Student
  courseId: string;              // Foreign key to Course
  graphRunId: string;            // LangGraph thread identifier
  updatedAt: string;             // ISO timestamp
}

// Teaching session instances
interface Session {
  $id: string;                   // e.g., "sess_001"
  studentId: string;             // Foreign key to Student
  courseId: string;              // Foreign key to Course
  lessonTemplateId: string;      // Foreign key to LessonTemplate
  lessonSnapshot: {              // Frozen template content (parsed objects)
    title: string;
    outcomeRefs: string[];       // Parsed from template JSON string
    cards: Array<{               // Parsed from template JSON string
      id: string;
      type: string;
      cfu: any;
    }>;
    templateVersion: number;
  };
  startedAt: string;             // ISO timestamp
  stage: string;                 // "design" | "deliver" | "mark" | "progress" | "complete"
}

// Learning evidence from completed lessons
interface Evidence {
  $id: string;                   // e.g., "ev_001"
  sessionId: string;             // Foreign key to Session
  itemId: string;                // Card ID within lesson
  attemptIndex: number;          // Attempt number (0, 1, 2...)
  response: string;              // Student's actual response
  correct: boolean;              // Whether response was correct
  score: number;                 // Score value (0-1)
  outcomeScores: {               // Score per learning outcome
    [outcomeId: string]: number; // e.g., "H22573_O1.2": 1
  };
  submittedAt: string;           // ISO timestamp
  feedback?: string;             // Optional feedback message
}

// Mastery tracking (EMA per outcome)
interface Mastery {
  $id: string;                   // e.g., "mas_001"
  studentId: string;             // Foreign key to Student
  courseId: string;              // Foreign key to Course
  emaByOutcome: {                // Exponential Moving Average scores
    [outcomeId: string]: number; // e.g., "H22573_O1.2": 0.72 (range 0-1)
  };
  updatedAt: string;             // ISO timestamp
}

// Spaced repetition scheduling
interface Routine {
  $id: string;                   // e.g., "rt_001"
  studentId: string;             // Foreign key to Student
  courseId: string;              // Foreign key to Course
  lastTaughtAt?: string;         // ISO timestamp of last lesson
  dueAtByOutcome: {              // When each outcome needs review
    [outcomeId: string]: string; // e.g., "H22573_O1.2": "2025-09-06T00:00:00Z"
  };
  spacingPolicyVersion: number;  // Algorithm version for migrations
  schema_version: number;        // Data structure version
}
```

#### SchedulingContextForCourse Interface

```typescript
// Input contract for Course Manager (normalized data)
interface SchedulingContextForCourse {
  student: {
    id: string;
    displayName?: string;
    accommodations?: string[]
  };
  course: {
    $id: string;
    courseId: string;
    subject: string;
    level: string
  };
  sow: {
    entries: Array<{
      order: number;
      lessonTemplateId: string;
      plannedAt?: string
    }>
  };
  templates: Array<{
    $id: string;
    title: string;
    outcomeRefs: string[];        // Parsed from JSON string
    estMinutes?: number;
    status: "published"
  }>;
  mastery?: {
    emaByOutcome: { [outcomeId: string]: number }
  };
  routine?: {
    dueAtByOutcome: { [outcomeId: string]: string };
    lastTaughtAt?: string;
    recentTemplateIds?: string[]
  };
  constraints?: {
    maxBlockMinutes?: number;
    avoidRepeatWithinDays?: number;
    preferOverdue?: boolean;
    preferLowEMA?: boolean
  };
  graphRunId?: string;           // For checkpoint resume
}
```

#### CourseRecommendation Interface
```typescript
interface CourseRecommendation {
  courseId: string;
  generatedAt: string;
  graphRunId: string;
  candidates: LessonCandidate[];
  rubric: string;
}

interface LessonCandidate {
  lessonTemplateId: string;
  title: string;
  targetOutcomeIds: string[];
  estimatedMinutes?: number;
  priorityScore: number;
  reasons: string[];
  flags?: string[];
}
```

### B. Test Data Requirements

#### Enhanced Seed Data (Building on MVP0)
- **Student:** test@scottishailessons.com (existing, password: red12345) - extend with multiple course enrollments
- **Current Course:** National 3 Applications of Mathematics (C844 73) - already implemented
- **Additional Courses:** Physics (C845 73) and English (C847 73) - need to seed
- **Templates:** Current AoM N3 templates exist - extend with Physics/English templates
- **Data Format:** outcomeRefs and cards stored as JSON strings (not objects)
- **Mastery:** Current EMA system via evidence/mastery collections - add varied test scores
- **Routine:** Current spaced repetition system - add overdue scenarios
- **Enrollments:** Current auto-enrollment pattern - extend to multiple courses

### C. Error Handling Scenarios

#### Critical Error States
1. **LangGraph Unavailable:** Return 500 with "Recommendation service temporarily unavailable"
2. **Invalid Course ID:** Return 404 with "Course not found"
3. **Unauthorized Access:** Return 403 with "Access denied to course"
4. **Template Not Found:** Return 400 with "Selected lesson template is no longer available"
5. **Malformed Context:** Return 500 with "Unable to prepare recommendation context"
6. **Checkpoint Corruption:** Create new thread, log incident, continue without error

### D. Appwrite Document Examples

This section provides concrete examples of how data will be structured in Appwrite collections after MVP1 implementation. These examples are based on a student enrolled in **National 3 Applications of Mathematics**.

> Note: IDs are illustrative. All timestamps are ISO (UTC). Only key fields shown.

#### 1. students (from Auth profile; already present)

```json
{
  "$id": "stu_123",
  "displayName": "Amina",
  "accommodations": ["chunking", "extra_time"],
  "createdAt": "2025-09-01T08:00:00Z"
}
```

#### 2. courses (seeded)

```json
{
  "$id": "course_c84473",
  "subject": "Applications of Mathematics",
  "level": "Nat3",
  "sqaCode": "C844 73"
}
```

#### 3. enrollments (student ↔ course)

```json
{
  "$id": "enr_001",
  "studentId": "stu_123",
  "courseId": "course_c84473",
  "enrolledAt": "2025-09-02T09:00:00Z"
}
```

#### 4. sow (Scheme of Work for this enrollment)

```json
{
  "$id": "sow_001",
  "studentId": "stu_123",
  "courseId": "course_c84473",
  "entries": [
    { "order": 1, "lessonTemplateId": "lt_nat3_num_frac_dec_pct_v1" },
    { "order": 2, "lessonTemplateId": "lt_nat3_aom_best_deal_v1" },
    { "order": 3, "lessonTemplateId": "lt_nat3_ssm_perim_area_vol_v1" }
  ],
  "createdAt": "2025-09-02T09:05:00Z"
}
```

#### 5. lesson_templates (published templates; seeded)

**Template 1: Fractions/Decimals/Percents**
```json
{
  "$id": "lt_nat3_num_frac_dec_pct_v1",
  "title": "Fractions ↔ Decimals ↔ Percents (Money contexts)",
  "outcomeRefs": "[\"H22573_O1.2\", \"H22573_O1.5\"]",
  "estMinutes": 20,
  "version": 1,
  "status": "published",
  "cards": "[{\"id\":\"q1\",\"type\":\"mcq\",\"cfu\":{\"type\":\"mcq\",\"options\":[\"10%\",\"12.5%\",\"20%\"],\"answerIndex\":1}}]"
}
```

**Template 2: Best Deal**
```json
{
  "$id": "lt_nat3_aom_best_deal_v1",
  "title": "Best Deal: Unit Price & Simple Discounts",
  "outcomeRefs": "[\"HV7Y73_O1.4\", \"H22573_O1.2\", \"H22573_O1.5\"]",
  "estMinutes": 25,
  "version": 1,
  "status": "published",
  "cards": "[{\"id\":\"q1\",\"type\":\"short\",\"cfu\":{\"type\":\"short\",\"expected\":\"2.80\"}}]"
}
```

**Template 3: Perimeter/Area/Volume**
```json
{
  "$id": "lt_nat3_ssm_perim_area_vol_v1",
  "title": "Perimeter, Area & Volume (Rectangles & Cuboids)",
  "outcomeRefs": "[\"H22573_O2.1\"]",
  "estMinutes": 20,
  "version": 1,
  "status": "published",
  "cards": "[{\"id\":\"q1\",\"type\":\"short\",\"cfu\":{\"type\":\"short\",\"expected\":\"24\"}}]"
}
```

#### 6. planner_threads (new in MVP1: recommender checkpoint)

```json
{
  "$id": "pth_001",
  "studentId": "stu_123",
  "courseId": "course_c84473",
  "graphRunId": "thread_cm_stu_123_course_c84473",
  "updatedAt": "2025-09-03T09:10:00Z"
}
```

#### 7. sessions (created when the student clicks Start)

```json
{
  "$id": "sess_001",
  "studentId": "stu_123",
  "courseId": "course_c84473",
  "lessonTemplateId": "lt_nat3_aom_best_deal_v1",
  "lessonSnapshot": {
    "title": "Best Deal: Unit Price & Simple Discounts",
    "outcomeRefs": ["HV7Y73_O1.4", "H22573_O1.2", "H22573_O1.5"],
    "cards": [{"id": "q1", "type": "short", "cfu": {"type": "short", "expected": "2.80"}}],
    "templateVersion": 1
  },
  "startedAt": "2025-09-03T09:12:00Z",
  "stage": "design"
}
```

#### 8. evidence (created at lesson END; one per attempt)

```json
{
  "$id": "ev_001",
  "sessionId": "sess_001",
  "itemId": "q1",
  "attemptIndex": 0,
  "response": "2.80",
  "correct": true,
  "score": 1,
  "outcomeScores": {
    "HV7Y73_O1.4": 1,
    "H22573_O1.2": 1,
    "H22573_O1.5": 1
  },
  "submittedAt": "2025-09-03T09:16:00Z",
  "feedback": "Great — £2.80 per kg is cheaper per 100 g."
}
```

#### 9. mastery (EMA per outcome; updated at END)

```json
{
  "$id": "mas_001",
  "studentId": "stu_123",
  "courseId": "course_c84473",
  "emaByOutcome": {
    "HV7Y73_O1.4": 0.83,
    "H22573_O1.2": 0.72,
    "H22573_O1.5": 0.46
  },
  "updatedAt": "2025-09-03T09:16:10Z"
}
```

#### 10. routine (scheduling cache with dueAtByOutcome)

```json
{
  "$id": "rt_001",
  "studentId": "stu_123",
  "courseId": "course_c84473",
  "lastTaughtAt": "2025-09-03T09:16:10Z",
  "dueAtByOutcome": {
    "H22573_O1.2": "2025-09-06T00:00:00Z",
    "HV7Y73_O1.4": "2025-09-08T00:00:00Z",
    "H22573_O1.5": "2025-09-04T00:00:00Z"
  },
  "spacingPolicyVersion": 1,
  "schema_version": 1
}
```

#### Important Notes

1. **JSON String Storage**: Note that in the lesson_templates collection, both `outcomeRefs` and `cards` are stored as JSON strings, not as arrays or objects. This matches the current codebase implementation.

2. **Session Snapshots**: The `lessonSnapshot` field in sessions contains the parsed (object) version of the template data to preserve the exact lesson content at the time of session creation.

3. **Evidence Tracking**: Each evidence record maps to specific learning outcomes with individual scores, enabling precise mastery calculation.

4. **Spaced Repetition**: The routine collection tracks when each outcome is due for review based on the spacing algorithm.

---

**Document Status:** Updated with Database Implementation Details
**Last Updated:** 22 Sep 2025
**Author:** Team Sociotech
**Codebase Review:** Completed - See codebase-alignment-addendum.md
**Data Model Enhancement:** Completed - Added comprehensive Appwrite collection specifications, database operation patterns, context normalization rules, and caching strategy from Design Brief
**Next Review:** Post-implementation retrospective

---

## Codebase Alignment Summary

**IMPORTANT:** This PRD has been updated after comprehensive codebase review. Key findings:

1. **Tech Stack Confirmed:** Next.js 15.3.0, Appwrite v19.0.0, @assistant-ui/react-langgraph v0.5.11
2. **Architecture Pattern:** UnifiedState schema enables direct subgraph integration
3. **Data Storage:** LessonTemplate.outcomeRefs and .cards stored as JSON strings (not objects)
4. **Testing Framework:** Playwright v1.48.0 already configured with test user test@scottishailessons.com
5. **Database Integration:** Current pattern uses direct client-side Appwrite SDK calls

See `codebase-alignment-addendum.md` for complete technical details.