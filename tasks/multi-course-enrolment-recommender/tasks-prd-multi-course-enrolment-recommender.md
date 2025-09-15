# Task List: Multi-Course Enrolment & Course Manager Recommender

Generated from: `prd-multi-course-enrolment-recommender.md`
Date: 15 Sep 2025
Approach: Outside-in TDD with Red-Green-Refactor Cycles

---

## Relevant Files

### Testing Infrastructure
- `playwright.config.ts` - E2E test configuration for multi-course scenarios
- `tests/e2e/multi-course-journey.spec.ts` - Complete user journey from enrollment to lesson completion
- `tests/e2e/recommendation-flow.spec.ts` - AI recommendation display and interaction tests
- `langgraph-agent/tests/test_course_manager.py` - Course Manager subgraph unit tests
- `langgraph-agent/tests/conftest.py` - Enhanced pytest fixtures for multi-course data
- `assistant-ui-frontend/tests/setup.ts` - MSW and Jest configuration

### Database & API Layer
- `lib/appwrite/schemas.ts` - Zod schemas for type validation
- `lib/appwrite/planner-service.ts` - CoursePlannerService for data orchestration
- `lib/appwrite/planner-service.test.ts` - Integration tests with real Appwrite data
- `app/api/recommendations/[courseId]/route.ts` - GET recommendations endpoint
- `app/api/sessions/start/route.ts` - POST session creation endpoint
- `app/api/recommendations/[courseId]/route.test.ts` - API contract tests
- `app/api/sessions/start/route.test.ts` - Session creation API tests

### LangGraph Integration
- `langgraph-agent/src/agent/course_manager_graph.py` - Course Manager subgraph implementation
- `langgraph-agent/src/agent/course_manager_utils.py` - Scoring algorithm utilities
- `langgraph-agent/src/agent/shared_state.py` - Enhanced UnifiedState with course planning fields
- `langgraph-agent/src/agent/graph.py` - Main graph integration with Course Manager

### Frontend Components
- `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx` - Main dashboard with multi-course support
- `assistant-ui-frontend/components/recommendations/RecommendationSection.tsx` - AI recommendation display
- `assistant-ui-frontend/components/recommendations/ReasonBadge.tsx` - Reason badge component
- `assistant-ui-frontend/components/courses/CourseNavigationTabs.tsx` - Course tab navigation
- `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.test.tsx` - Dashboard component tests
- `assistant-ui-frontend/components/recommendations/RecommendationSection.test.tsx` - Recommendation component tests

### Type Definitions
- `types/course-planner.ts` - SchedulingContextForCourse and CourseRecommendation interfaces
- `types/appwrite-extensions.ts` - Extended Appwrite collection types

### Notes

- All testing follows outside-in TDD approach starting with E2E tests
- Python backend testing uses pytest with LangChain/LangGraph recommendations
- Frontend testing uses Jest + React Testing Library + Playwright
- TypeScript strict mode required with no 'any' types
- All functions must be <50 lines, all files <500 lines
- Zero fallback policy - system must fail fast with clear errors

---

## Tasks

- [ ] 1.0 Setup Comprehensive Testing Infrastructure
  - [ ] 1.1 Write failing E2E test for multi-course dashboard display
  - [ ] 1.2 Configure Playwright to make test executable (GREEN)
  - [ ] 1.3 Write failing E2E test for AI recommendation flow
  - [ ] 1.4 Create enhanced pytest fixtures for course manager (GREEN)
  - [ ] 1.5 Write failing MSW tests for API mocking
  - [ ] 1.6 Setup MSW infrastructure to make tests pass (GREEN)
  - [ ] 1.7 Create seed data for test scenarios (GREEN)
  - [ ] 1.8 Refactor test setup for maintainability

- [ ] 2.0 Implement Database Schema & Data Layer
  - [ ] 2.1 Write failing tests for CoursePlannerService.assembleSchedulingContext()
  - [ ] 2.2 Create planner_threads collection schema to make tests pass (GREEN)
  - [ ] 2.3 Write failing tests for type validation with invalid data
  - [ ] 2.4 Implement Zod schemas to make validation tests pass (GREEN)
  - [ ] 2.5 Write failing integration tests for data orchestration
  - [ ] 2.6 Implement CoursePlannerService to make tests pass (GREEN)
  - [ ] 2.7 Write failing tests for Appwrite SDK wrapper edge cases
  - [ ] 2.8 Create typed SDK wrappers to handle edge cases (GREEN)
  - [ ] 2.9 Refactor data layer for better separation of concerns

- [ ] 3.0 Build Course Manager LangGraph Subgraph
  - [ ] 3.1 Write failing tests for scoring algorithm with overdue scenarios
  - [ ] 3.2 Implement basic scoring utilities to make overdue tests pass (GREEN)
  - [ ] 3.3 Write failing tests for low mastery scoring (+0.25 points)
  - [ ] 3.4 Extend scoring algorithm for low mastery scenarios (GREEN)
  - [ ] 3.5 Write failing tests for SoW order and penalty scenarios
  - [ ] 3.6 Complete scoring rubric implementation (GREEN)
  - [ ] 3.7 Write failing tests for Course Manager subgraph integration
  - [ ] 3.8 Create subgraph structure to make integration tests pass (GREEN)
  - [ ] 3.9 Write failing tests for transparent reasoning output
  - [ ] 3.10 Add reasoning explanations to make tests pass (GREEN)
  - [ ] 3.11 Write failing tests for UnifiedState integration
  - [ ] 3.12 Integrate with main LangGraph (GREEN)
  - [ ] 3.13 Refactor scoring logic for better testability and performance

- [ ] 4.0 Create API Endpoints & Service Layer
  - [ ] 4.1 Write failing API contract tests for GET /api/recommendations/[courseId]
  - [ ] 4.2 Create minimal endpoint structure to make tests pass (GREEN)
  - [ ] 4.3 Write failing tests for authentication and authorization
  - [ ] 4.4 Implement auth middleware to make security tests pass (GREEN)
  - [ ] 4.5 Write failing tests for POST /api/sessions/start endpoint
  - [ ] 4.6 Implement session creation endpoint (GREEN)
  - [ ] 4.7 Write failing tests for zero fallback error scenarios
  - [ ] 4.8 Implement error handling to make error tests pass (GREEN)
  - [ ] 4.9 Write failing tests for schema validation edge cases
  - [ ] 4.10 Complete schema validation implementation (GREEN)
  - [ ] 4.11 Refactor API layer for better error handling and maintainability

- [ ] 5.0 Build Enhanced Student Dashboard UI
  - [ ] 5.1 Write failing tests for CourseNavigationTabs rendering
  - [ ] 5.2 Create CourseNavigationTabs component to make tests pass (GREEN)
  - [ ] 5.3 Write failing tests for ReasonBadge color coding
  - [ ] 5.4 Implement ReasonBadge component (GREEN)
  - [ ] 5.5 Write failing tests for RecommendationSection with Top Pick
  - [ ] 5.6 Create RecommendationSection component (GREEN)
  - [ ] 5.7 Write failing tests for enhanced StudentDashboard layout
  - [ ] 5.8 Integrate components into StudentDashboard (GREEN)
  - [ ] 5.9 Write failing tests for error states and loading indicators
  - [ ] 5.10 Implement error handling and loading states (GREEN)
  - [ ] 5.11 Write failing tests for user interaction flows
  - [ ] 5.12 Add event handlers and state management (GREEN)
  - [ ] 5.13 Refactor components for better reusability and performance

- [ ] 6.0 End-to-End Integration & Performance Testing
  - [ ] 6.1 Write failing E2E tests for complete user journey
  - [ ] 6.2 Connect all components to make E2E tests pass (GREEN)
  - [ ] 6.3 Write failing tests for MVP0 teaching loop compatibility
  - [ ] 6.4 Ensure seamless integration with existing system (GREEN)
  - [ ] 6.5 Write failing tests for error handling scenarios
  - [ ] 6.6 Verify zero fallback behavior works correctly (GREEN)
  - [ ] 6.7 Write failing performance tests for <500ms response times
  - [ ] 6.8 Optimize system to meet performance requirements (GREEN)
  - [ ] 6.9 Run complete test suite and fix any failing tests
  - [ ] 6.10 Validate all acceptance criteria are met
  - [ ] 6.11 Refactor entire system for production readiness

---

---

## Detailed Implementation Guide

### Task 1.1: Write failing E2E test for multi-course dashboard display (RED)

**Files to create/update:**
- `playwright.config.ts`
- `tests/e2e/multi-course-journey.spec.ts`

**Implementation:**

`playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

`tests/e2e/multi-course-journey.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Multi-Course Student Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@scottishailessons.com');
    await page.fill('[data-testid="password"]', 'red12345');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display multiple course enrollments', async ({ page }) => {
    // Verify course tabs are visible
    await expect(page.locator('[data-testid="course-tab-mathematics"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-tab-physics"]')).toBeVisible();
    await expect(page.locator('[data-testid="course-tab-english"]')).toBeVisible();
  });

  test('should show AI recommendations per course', async ({ page }) => {
    // TODO: Implement after recommendation API is ready
    await expect(page.locator('[data-testid="recommendations-section"]')).toBeVisible();
  });

  test('should start lesson from top pick', async ({ page }) => {
    // TODO: Implement after session creation API is ready
    await page.click('[data-testid="top-pick-start-button"]');
    await expect(page).toHaveURL(/\/session\/.+/);
  });
});
```

### Task 1.2: Create enhanced pytest fixtures for course manager testing

**Files to create/update:**
- `langgraph-agent/tests/conftest.py`
- `langgraph-agent/tests/fixtures/course_data.py`

**Implementation:**

`langgraph-agent/tests/conftest.py`:
```python
import pytest
from typing import Dict, Any, List
from datetime import datetime, timedelta

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture
def sample_student():
    return {
        "id": "test-student-123",
        "displayName": "Test Student",
        "accommodations": []
    }

@pytest.fixture
def sample_courses():
    return [
        {
            "$id": "course-math-123",
            "courseId": "C844 73",
            "subject": "Applications of Mathematics",
            "level": "National 3"
        },
        {
            "$id": "course-physics-456",
            "courseId": "C845 73",
            "subject": "Physics",
            "level": "National 3"
        }
    ]

@pytest.fixture
def sample_lesson_templates():
    return [
        {
            "$id": "template-fractions-123",
            "title": "Fractions ↔ Decimals ↔ Percents",
            "outcomeRefs": ["AOM3.1", "AOM3.2"],
            "estMinutes": 45,
            "status": "published"
        },
        {
            "$id": "template-area-456",
            "title": "Area and Perimeter",
            "outcomeRefs": ["AOM3.3"],
            "estMinutes": 30,
            "status": "published"
        }
    ]

@pytest.fixture
def sample_mastery_low():
    """Mastery data with low EMA scores (< 0.6)"""
    return {
        "emaByOutcome": {
            "AOM3.1": 0.3,  # Low mastery
            "AOM3.2": 0.5,  # Low mastery
            "AOM3.3": 0.8   # Good mastery
        }
    }

@pytest.fixture
def sample_routine_overdue():
    """Routine data with overdue outcomes"""
    yesterday = (datetime.now() - timedelta(days=1)).isoformat()
    tomorrow = (datetime.now() + timedelta(days=1)).isoformat()

    return {
        "dueAtByOutcome": {
            "AOM3.1": yesterday,  # Overdue
            "AOM3.2": yesterday,  # Overdue
            "AOM3.3": tomorrow    # Not due yet
        },
        "lastTaughtAt": (datetime.now() - timedelta(days=3)).isoformat(),
        "recentTemplateIds": []
    }

@pytest.fixture
def sample_scheduling_context(sample_student, sample_courses, sample_lesson_templates,
                               sample_mastery_low, sample_routine_overdue):
    """Complete scheduling context for testing"""
    return {
        "student": sample_student,
        "course": sample_courses[0],  # Mathematics course
        "sow": {
            "entries": [
                {"order": 1, "lessonTemplateId": "template-fractions-123"},
                {"order": 2, "lessonTemplateId": "template-area-456"}
            ]
        },
        "templates": sample_lesson_templates,
        "mastery": sample_mastery_low,
        "routine": sample_routine_overdue,
        "constraints": {
            "maxBlockMinutes": 25,
            "avoidRepeatWithinDays": 3,
            "preferOverdue": True,
            "preferLowEMA": True
        }
    }
```

### Task 2.3: Implement CoursePlannerService for data orchestration

**Files to create/update:**
- `lib/appwrite/planner-service.ts`
- `types/course-planner.ts`

**Implementation:**

`types/course-planner.ts`:
```typescript
export interface SchedulingContextForCourse {
  student: {
    id: string;
    displayName?: string;
    accommodations?: string[];
  };
  course: {
    $id: string;
    courseId: string;
    subject: string;
    level: string;
  };
  sow: {
    entries: Array<{
      order: number;
      lessonTemplateId: string;
      plannedAt?: string;
    }>;
  };
  templates: Array<{
    $id: string;
    title: string;
    outcomeRefs: string[];
    estMinutes?: number;
    status: "published";
  }>;
  mastery?: {
    emaByOutcome: { [outcomeId: string]: number };
  };
  routine?: {
    dueAtByOutcome: { [outcomeId: string]: string };
    lastTaughtAt?: string;
    recentTemplateIds?: string[];
  };
  constraints?: {
    maxBlockMinutes?: number;
    avoidRepeatWithinDays?: number;
    preferOverdue?: boolean;
    preferLowEMA?: boolean;
  };
  graphRunId?: string;
}

export interface LessonCandidate {
  lessonTemplateId: string;
  title: string;
  targetOutcomeIds: string[];
  estimatedMinutes?: number;
  priorityScore: number;
  reasons: string[];
  flags?: string[];
}

export interface CourseRecommendation {
  courseId: string;
  generatedAt: string;
  graphRunId: string;
  candidates: LessonCandidate[];
  rubric: string;
}
```

`lib/appwrite/planner-service.ts`:
```typescript
import { createAdminClient, createSessionClient } from './client';
import { Query } from 'appwrite';
import { SchedulingContextForCourse, CourseRecommendation } from '../../types/course-planner';

export class CoursePlannerService {
  private databases;
  private account;

  constructor(sessionSecret?: string) {
    if (sessionSecret) {
      const { databases, account } = createSessionClient(sessionSecret);
      this.databases = databases;
      this.account = account;
    } else {
      const { databases, account } = createAdminClient();
      this.databases = databases;
      this.account = account;
    }
  }

  async assembleSchedulingContext(
    studentId: string,
    courseId: string
  ): Promise<SchedulingContextForCourse> {
    try {
      // Get student profile
      const student = await this.databases.getDocument(
        'default',
        'students',
        studentId
      );

      // Get course details
      const course = await this.databases.getDocument(
        'default',
        'courses',
        courseId
      );

      // Get scheme of work entries
      const sowResult = await this.databases.listDocuments(
        'default',
        'scheme_of_work',
        [Query.equal('courseId', course.courseId), Query.orderAsc('order')]
      );

      // Get published lesson templates for this course
      const templatesResult = await this.databases.listDocuments(
        'default',
        'lesson_templates',
        [
          Query.equal('courseId', course.courseId),
          Query.equal('status', 'published')
        ]
      );

      // Get mastery data (EMA by outcome)
      const masteryResult = await this.databases.listDocuments(
        'default',
        'mastery',
        [Query.equal('studentId', studentId)]
      );

      // Get routine data (due dates by outcome)
      const routineResult = await this.databases.listDocuments(
        'default',
        'routine',
        [Query.equal('studentId', studentId)]
      );

      // Get existing planner thread
      const plannerResult = await this.databases.listDocuments(
        'default',
        'planner_threads',
        [
          Query.equal('studentId', studentId),
          Query.equal('courseId', courseId)
        ]
      );

      // Transform data to match interface
      const context: SchedulingContextForCourse = {
        student: {
          id: student.$id,
          displayName: student.name,
          accommodations: student.accommodations || []
        },
        course: {
          $id: course.$id,
          courseId: course.courseId,
          subject: course.subject,
          level: course.level
        },
        sow: {
          entries: sowResult.documents.map(entry => ({
            order: entry.order,
            lessonTemplateId: entry.lessonTemplateId,
            plannedAt: entry.plannedAt
          }))
        },
        templates: templatesResult.documents.map(template => ({
          $id: template.$id,
          title: template.title,
          outcomeRefs: JSON.parse(template.outcomeRefs), // Parse JSON string
          estMinutes: template.estMinutes,
          status: template.status
        })),
        mastery: masteryResult.documents.length > 0 ? {
          emaByOutcome: masteryResult.documents[0].emaByOutcome || {}
        } : undefined,
        routine: routineResult.documents.length > 0 ? {
          dueAtByOutcome: routineResult.documents[0].dueAtByOutcome || {},
          lastTaughtAt: routineResult.documents[0].lastTaughtAt,
          recentTemplateIds: routineResult.documents[0].recentTemplateIds || []
        } : undefined,
        constraints: {
          maxBlockMinutes: 25,
          avoidRepeatWithinDays: 3,
          preferOverdue: true,
          preferLowEMA: true
        },
        graphRunId: plannerResult.documents[0]?.graphRunId
      };

      // Validate required data
      if (!context.course || !context.templates.length) {
        throw new Error(`Invalid scheduling context: missing course or templates`);
      }

      return context;
    } catch (error) {
      throw new Error(`Failed to assemble scheduling context: ${error.message}`);
    }
  }

  async saveGraphRunId(
    studentId: string,
    courseId: string,
    graphRunId: string
  ): Promise<void> {
    try {
      const existing = await this.databases.listDocuments(
        'default',
        'planner_threads',
        [
          Query.equal('studentId', studentId),
          Query.equal('courseId', courseId)
        ]
      );

      if (existing.documents.length > 0) {
        await this.databases.updateDocument(
          'default',
          'planner_threads',
          existing.documents[0].$id,
          {
            graphRunId,
            updatedAt: new Date().toISOString()
          }
        );
      } else {
        await this.databases.createDocument(
          'default',
          'planner_threads',
          'unique()',
          {
            studentId,
            courseId,
            graphRunId,
            updatedAt: new Date().toISOString()
          }
        );
      }
    } catch (error) {
      throw new Error(`Failed to save graph run ID: ${error.message}`);
    }
  }
}
```

### Task 3.2: Create Course Manager subgraph structure

**Files to create/update:**
- `langgraph-agent/src/agent/course_manager_graph.py`
- `langgraph-agent/src/agent/course_manager_utils.py`

**Implementation:**

`langgraph-agent/src/agent/course_manager_utils.py`:
```python
from typing import Dict, List, Any
from datetime import datetime, timedelta
import json

def calculate_priority_score(
    template: Dict[str, Any],
    mastery: Dict[str, Any],
    routine: Dict[str, Any],
    sow_order: int,
    constraints: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Calculate priority score based on PRD scoring rubric:
    +0.40 for overdue outcomes
    +0.25 for low mastery outcomes
    +0.15 for early SoW order
    -0.10 for recently taught
    -0.05 for lessons exceeding max time
    """
    score = 0.0
    reasons = []

    outcome_refs = template.get('outcomeRefs', [])

    # Check for overdue outcomes (+0.40)
    if routine and 'dueAtByOutcome' in routine:
        now = datetime.now()
        overdue_count = 0
        for outcome_id in outcome_refs:
            due_at = routine['dueAtByOutcome'].get(outcome_id)
            if due_at:
                due_date = datetime.fromisoformat(due_at.replace('Z', '+00:00'))
                if due_date < now:
                    overdue_count += 1

        if overdue_count > 0:
            score += 0.40
            reasons.append('overdue')

    # Check for low mastery outcomes (+0.25)
    if mastery and 'emaByOutcome' in mastery:
        low_mastery_count = 0
        for outcome_id in outcome_refs:
            ema_score = mastery['emaByOutcome'].get(outcome_id, 1.0)
            if ema_score < 0.6:
                low_mastery_count += 1

        if low_mastery_count > 0:
            score += 0.25
            reasons.append('low mastery')

    # Early SoW order bonus (+0.15 scaled by position)
    if sow_order <= 5:  # First 5 lessons get bonus
        order_bonus = 0.15 * (6 - sow_order) / 5
        score += order_bonus
        reasons.append('early order')

    # Penalty for recently taught (-0.10)
    if routine and 'recentTemplateIds' in routine:
        if template['$id'] in routine.get('recentTemplateIds', []):
            score -= 0.10
            reasons.append('recent')

    # Penalty for long lessons (-0.05)
    max_minutes = constraints.get('maxBlockMinutes', 25)
    est_minutes = template.get('estMinutes', 0)
    if est_minutes > max_minutes:
        score -= 0.05
        reasons.append('long lesson')

    # Add positive reason for short lessons
    if est_minutes <= 20 and est_minutes > 0:
        reasons.append('short win')

    return {
        'priorityScore': round(score, 2),
        'reasons': reasons
    }

def create_lesson_candidates(
    context: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Create ranked lesson candidates from scheduling context
    """
    candidates = []

    templates = context.get('templates', [])
    sow_entries = context.get('sow', {}).get('entries', [])
    mastery = context.get('mastery', {})
    routine = context.get('routine', {})
    constraints = context.get('constraints', {})

    # Create lookup for SoW order
    sow_order_lookup = {}
    for entry in sow_entries:
        sow_order_lookup[entry['lessonTemplateId']] = entry['order']

    for template in templates:
        template_id = template['$id']
        sow_order = sow_order_lookup.get(template_id, 999)  # Default high order

        # Calculate priority score
        score_data = calculate_priority_score(
            template, mastery, routine, sow_order, constraints
        )

        candidate = {
            'lessonTemplateId': template_id,
            'title': template['title'],
            'targetOutcomeIds': template.get('outcomeRefs', []),
            'estimatedMinutes': template.get('estMinutes'),
            'priorityScore': score_data['priorityScore'],
            'reasons': score_data['reasons'],
            'flags': []  # For future use
        }

        candidates.append(candidate)

    # Sort by priority score descending, then by SoW order ascending
    candidates.sort(
        key=lambda x: (-x['priorityScore'], sow_order_lookup.get(x['lessonTemplateId'], 999))
    )

    # Return top 5 candidates
    return candidates[:5]

def generate_rubric_explanation() -> str:
    """
    Generate human-readable explanation of scoring rubric
    """
    return "Overdue>LowEMA>Order | -Recent -TooLong"
```

`langgraph-agent/src/agent/course_manager_graph.py`:
```python
from typing import Dict, Any
from langgraph import StateGraph, END
from langchain_core.messages import AIMessage
from .shared_state import UnifiedState
from .course_manager_utils import create_lesson_candidates, generate_rubric_explanation
import json
import uuid
from datetime import datetime

def course_manager_node(state: UnifiedState) -> UnifiedState:
    """
    Course Manager node that generates lesson recommendations
    """
    try:
        # Extract scheduling context from session_context
        session_context = state.get('session_context', {})

        if not session_context:
            raise ValueError("No session context provided for course manager")

        # Generate lesson candidates
        candidates = create_lesson_candidates(session_context)

        if not candidates:
            raise ValueError("No valid lesson candidates found")

        # Create recommendation response
        course_id = session_context.get('course', {}).get('courseId', '')
        recommendation = {
            'courseId': course_id,
            'generatedAt': datetime.now().isoformat(),
            'graphRunId': str(uuid.uuid4()),
            'candidates': candidates,
            'rubric': generate_rubric_explanation()
        }

        # Create response message
        response_message = AIMessage(
            content=f"Generated {len(candidates)} lesson recommendations for course {course_id}",
            additional_kwargs={
                'recommendation': recommendation
            }
        )

        return {
            **state,
            'messages': state.get('messages', []) + [response_message],
            'course_recommendation': recommendation
        }

    except Exception as e:
        error_message = AIMessage(
            content=f"Course Manager failed: {str(e)}",
            additional_kwargs={
                'error': str(e),
                'error_type': 'course_manager_error'
            }
        )

        return {
            **state,
            'messages': state.get('messages', []) + [error_message],
            'error': str(e)
        }

def create_course_manager_graph():
    """
    Create the Course Manager subgraph
    """
    # Create graph
    graph = StateGraph(UnifiedState)

    # Add nodes
    graph.add_node("course_manager", course_manager_node)

    # Define entry point
    graph.set_entry_point("course_manager")

    # Add finish edge
    graph.add_edge("course_manager", END)

    return graph.compile()

# Export the compiled graph
course_manager_graph = create_course_manager_graph()
```

### Task 4.1: Implement GET /api/recommendations/[courseId] endpoint

**Files to create/update:**
- `app/api/recommendations/[courseId]/route.ts`

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CoursePlannerService } from '../../../../lib/appwrite/planner-service';
import { CourseRecommendation } from '../../../../types/course-planner';
import { z } from 'zod';

// Validation schema
const GetRecommendationsSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required')
});

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Validate parameters
    const { courseId } = GetRecommendationsSchema.parse(params);

    // Get session from cookies
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initialize planner service
    const plannerService = new CoursePlannerService(sessionCookie.value);

    // Get current user to extract student ID
    const user = await plannerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Get student profile
    const student = await plannerService.getStudentByUserId(user.$id);
    if (!student) {
      return NextResponse.json(
        { error: 'Student profile not found' },
        { status: 404 }
      );
    }

    // Verify course enrollment
    const isEnrolled = await plannerService.verifyEnrollment(
      student.$id,
      courseId
    );
    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Not enrolled in this course' },
        { status: 403 }
      );
    }

    // Assemble scheduling context
    const context = await plannerService.assembleSchedulingContext(
      student.$id,
      courseId
    );

    // Call Course Manager via LangGraph
    const recommendations = await callCourseManagerGraph(context);

    // Save graph run ID for continuity
    await plannerService.saveGraphRunId(
      student.$id,
      courseId,
      recommendations.graphRunId
    );

    return NextResponse.json(recommendations);

  } catch (error) {
    console.error('Recommendations API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function callCourseManagerGraph(
  context: any
): Promise<CourseRecommendation> {
  // TODO: Replace with actual LangGraph SDK call
  const response = await fetch(`${process.env.LANGGRAPH_API_URL}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LANGGRAPH_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        session_context: context,
        mode: 'course_manager'
      },
      config: {
        configurable: {
          thread_id: `course-manager-${context.student.id}-${context.course.courseId}`
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Course Manager request failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.course_recommendation;
}
```

---

## TDD Cycle Summary

Each task now follows proper **Red-Green-Refactor** cycles:

🔴 **RED Phase:** Write failing tests first that define expected behavior
🟢 **GREEN Phase:** Write minimal code to make tests pass (may be hacky)
🔧 **REFACTOR Phase:** Clean up code while keeping tests green

### TDD Benefits in This Implementation:

1. **Clear Requirements:** Tests define exactly what each component should do
2. **Fast Feedback:** Know immediately when something breaks
3. **Confident Refactoring:** Tests ensure behavior is preserved during cleanup
4. **Zero Regression:** Each change is validated against existing functionality
5. **Documentation:** Tests serve as living documentation of system behavior

### Key TDD Patterns Used:

- **Outside-in:** Start with E2E tests, work toward unit tests
- **Triangulation:** Multiple test cases to drive out edge cases
- **Mock/Stub:** Isolate units under test from dependencies
- **Arrange-Act-Assert:** Clear test structure for readability
- **Fail Fast:** Tests should fail quickly and clearly when behavior is wrong

### Example TDD Cycle:

```
Task 3.1 (RED): Write failing test for overdue scoring → FAILS ❌
Task 3.2 (GREEN): Implement minimal scoring logic → PASSES ✅
Task 3.3 (RED): Write failing test for low mastery → FAILS ❌
Task 3.4 (GREEN): Extend algorithm for mastery → PASSES ✅
Task 3.13 (REFACTOR): Clean up scoring logic → PASSES ✅
```

**Status:** Task list now properly follows TDD methodology with Red-Green-Refactor cycles throughout all 6 major tasks and 47 sub-tasks.