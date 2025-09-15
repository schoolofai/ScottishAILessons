# Codebase Alignment Addendum - Multi-Course Enrolment Recommender

**Date:** 15 Sep 2025
**Purpose:** Document critical missing context discovered during codebase review to ensure PRD aligns with current implementation

---

## Executive Summary

After reviewing the existing codebase, several critical implementation details were missing from the PRD and design brief. This addendum provides the necessary context to ensure successful implementation.

---

## Critical Codebase Findings

### 1. Current Architecture Implementation

**Frontend Tech Stack (package.json):**
- Next.js 15.3.0 (App Router pattern confirmed)
- @assistant-ui/react-langgraph v0.5.11
- @langchain/langgraph-sdk v0.0.105
- appwrite v19.0.0 (not v16 as might be assumed)
- Playwright v1.48.0 (E2E testing already configured)
- Zod included via Next.js compilation

**Backend Architecture (langgraph-agent/):**
- UnifiedState schema (shared_state.py) enables direct subgraph integration
- Main graph (graph.py) routes between chat and teaching modes
- Teaching subgraph (teaching_graph.py) is a compiled subgraph, not a separate service
- No mention of Aegra in actual codebase - PRD correctly focuses on Official LangGraph

### 2. Database & API Patterns

**Current Appwrite Integration:**
- Uses direct client-side Appwrite SDK calls in StudentDashboard.tsx (lines 55-85)
- API routes exist but dashboard bypasses them for data loading
- Session management uses cookieFallback localStorage pattern (lines 64-81)
- Auto-enrollment pattern for single course (C844 73) implemented (lines 155-170)

**Collection Interfaces (from StudentDashboard.tsx):**
```typescript
interface Course {
  $id: string;
  courseId: string;  // "C844 73"
  subject: string;
  phase: string;
  level: string;
}

interface LessonTemplate {
  $id: string;
  courseId: string;
  title: string;
  outcomeRefs: string;  // JSON string, not array
  cards: string;        // JSON string, not object
  version: number;
  status: string;
}

interface Session {
  $id: string;
  studentId: string;
  courseId: string;
  lessonTemplateId?: string;
  startedAt: string;
  endedAt?: string;
  stage: string;
  lessonSnapshot?: string; // JSON string
}
```

**Critical Discovery:** Current implementation stores `outcomeRefs` and `cards` as JSON strings, not objects. This impacts recommendation context assembly.

### 3. Testing Infrastructure

**Existing Test Structure:**
- Playwright configured with 11 test scripts (package.json:10-22)
- Python backend uses pytest with anyio backend (conftest.py)
- Test user already exists: test@scottishailessons.com, password: red12345
- E2E tests already interact with real Appwrite instance

**Missing Test Coverage:**
- No multi-course enrollment tests
- No recommendation engine tests
- No Course Manager subgraph tests

### 4. State Management & Graph Integration

**UnifiedState Schema (shared_state.py:14-52):**
- Already supports teaching progression fields
- Uses add_messages reducer for frontend compatibility
- Supports both chat and teaching modes in single state
- Fields: session_context, mode, session_id, student_id, lesson_snapshot, etc.

**Graph Routing (graph.py:122-158):**
- Main graph compiles with name "agent" (must match NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID)
- Teaching subgraph integrated directly as a node (line 141)
- Entry node extracts session_context for teaching mode routing

### 5. MVP0 Teaching Loop Integration

**Current Implementation:**
- Teaching loop is interrupt-based with tool calls for UI generation
- Uses design → deliver → mark → progress → done cycle
- Generates AIMessage tool calls for frontend generative UI components
- Frontend components: LessonCardPresentationTool.tsx, etc.

**Integration Point:** Course Manager must emit tool calls compatible with existing Assistant-UI patterns.

---

## Required PRD Updates

### 1. Technology Stack Corrections

**Update PRD Section "Technical Considerations":**
- Specify Next.js 15.3.0, not 14+
- Confirm Appwrite v19.0.0 compatibility requirements
- Note that Zod is already available via Next.js compilation
- Confirm Playwright v1.48.0 as primary E2E framework

### 2. Data Model Alignment

**Update SchedulingContextForCourse interface:**
```typescript
// UPDATED to match existing patterns
interface SchedulingContextForCourse {
  student: { id: string; displayName?: string; accommodations?: string[] };
  course: {
    $id: string;        // Appwrite document ID
    courseId: string;   // Course code like "C844 73"
    subject: string;
    level: string;
  };
  sow: { entries: Array<{ order: number; lessonTemplateId: string; plannedAt?: string }> };
  templates: Array<{
    $id: string;
    title: string;
    outcomeRefs: string[];  // Note: stored as JSON string in DB
    estMinutes?: number;
    status: "published"
  }>;
  // ... rest remains same
}
```

### 3. Implementation Strategy Updates

**Database Integration Pattern:**
- Consider following StudentDashboard pattern of direct client-side Appwrite calls
- OR implement server-side API routes following existing sessions/route.ts pattern
- Must handle JSON string parsing for outcomeRefs and cards fields

**Graph Integration Pattern:**
- Course Manager subgraph should follow teaching_graph.py compilation pattern
- Must use UnifiedState schema for consistency
- Should emit tool calls for frontend generative UI if recommendations need visual components

### 4. Testing Strategy Refinements

**Enhanced Seed Data Requirements:**
- Extend existing test@scottishailessons.com user with multiple enrollments
- Add courses for Physics (C845 73) and English (C847 73)
- Create published lesson templates for each course
- Generate mastery/routine data with varied EMA scores and due dates
- Maintain compatibility with existing MVP0 test patterns

**Test Framework Approach:**
- Leverage existing Playwright test structure and helpers
- Add Course Manager specific pytest test suite to langgraph-agent/tests/
- Use existing E2E authentication patterns with real Appwrite instance
- Follow outside-in TDD starting with Playwright tests for full user journey

---

## Implementation Priorities

### Phase 1: Foundation (Immediate)
1. **Database Schema:** Add planner_threads collection to existing Appwrite setup
2. **Test Data:** Extend seed data with multi-course scenarios
3. **Context Assembly:** Build CoursePlannerService following existing patterns
4. **Course Manager Subgraph:** Create LangGraph recommender with scoring algorithm

### Phase 2: Integration
1. **API Endpoints:** Add /api/recommendations/:courseId following existing route patterns
2. **Dashboard Updates:** Extend StudentDashboard with recommendation display
3. **E2E Testing:** Add comprehensive Playwright test coverage
4. **Documentation:** Update README with multi-course setup instructions

### Phase 3: Validation
1. **Performance Testing:** Verify <500ms recommendation response times
2. **Error Handling:** Implement zero-fallback error patterns
3. **Manual Testing:** Validate with enhanced seed data scenarios
4. **Code Review:** Ensure 500-line file and 50-line function limits

---

## Risk Mitigation

### Technical Risks
1. **JSON String Parsing:** Ensure proper handling of stringified outcomeRefs/cards
2. **State Schema Compatibility:** Verify UnifiedState works with Course Manager data
3. **Authentication Patterns:** Maintain consistency with existing cookieFallback approach
4. **Graph Compilation:** Ensure Course Manager integrates cleanly with main graph

### Implementation Risks
1. **Test Data Dependencies:** May need to coordinate with existing MVP0 test scenarios
2. **Frontend Performance:** Direct Appwrite calls may need optimization for multi-course data
3. **Error Boundaries:** Zero-fallback policy requires robust error handling at every integration point

---

## Next Steps

1. **Update PRD:** Incorporate findings from this addendum
2. **Validate Assumptions:** Confirm technical decisions with team
3. **Create Implementation Plan:** Break down Phase 1 work into specific tasks
4. **Set up Development Environment:** Ensure all team members can run existing test suite

---

**Status:** Review Required
**Reviewer:** Development Team
**Next Action:** Incorporate into final PRD and begin Phase 1 implementation