# Frontend Auth Refactor: Test-First Implementation Plan

**Document Version:** 1.0
**Created:** 2025-11-17
**Status:** APPROVED FOR EXECUTION
**Approach:** Test-First with Playwright E2E Coverage

---

## Executive Summary

### Objective
Complete migration of all frontend components from client-side Appwrite SDK to server-side authentication via httpOnly cookies, eliminating silent auth failures and security vulnerabilities.

### Scope
- **Components Affected:** 9 frontend components identified with client SDK usage
- **Test Coverage:** Comprehensive E2E test suite covering all user flows
- **Timeline:** 3-phase approach over 5+ weeks
- **Test-First:** All migrations preceded by failing E2E tests

### Critical Requirements
1. **ZERO client-side SDK usage** for authenticated operations
2. **NO fallback patterns** - all errors must fail-fast with explicit messages
3. **Test data cleanup hygiene** - all tests clean up after themselves
4. **CI/CD compatible** - tests run on production servers with test account
5. **Blackbox testing only** - Playwright only, no framework dependencies

---

## Phase 1: E2E Test Infrastructure & Baseline (Week 1-2)

### 1.1 Test Infrastructure Setup

#### Deprecated Tests (To Remove)
- **e2e/multi-course-dashboard.spec.ts** - RED test for non-existent features, not relevant to auth refactor

#### Existing Tests (To Retain & Enhance)
- **e2e/tests/auth.spec.ts** - Authentication flow tests (KEEP & EXTEND)
- **e2e/tests/lesson-happy-path.spec.ts** - Lesson completion (KEEP)
- **e2e/tests/lesson-error-handling.spec.ts** - Error scenarios (KEEP)
- **e2e/tests/lesson-post-completion.spec.ts** - Post-lesson flow (KEEP)
- **e2e/tests/e2e/recommendation-flow.spec.ts** - Recommendations (KEEP)

#### New Test Files (To Create)
```
e2e/tests/auth-refactor/
├── admin-panel.spec.ts              # Admin access & SOW management
├── browse-courses.spec.ts           # Course catalog & enrollment
├── student-dashboard.spec.ts        # Dashboard data loading
├── onboarding-flow.spec.ts          # New user registration
├── curriculum-display.spec.ts       # Lesson listing & progress
└── course-progress-export.spec.ts   # Progress viewing & PDF export
```

#### Test Data Cleanup Module
```typescript
// e2e/tests/helpers/cleanup.ts
export class TestDataCleanup {
  /**
   * Clean up test enrollments created during tests
   */
  async cleanupEnrollments(studentId: string, courseIds: string[]): Promise<void>

  /**
   * Clean up test sessions created during tests
   */
  async cleanupSessions(studentId: string): Promise<void>

  /**
   * Clean up test student data (for onboarding tests)
   */
  async cleanupTestStudent(email: string): Promise<void>

  /**
   * Verify test data was cleaned (fail test if not)
   */
  async verifyCleanup(): Promise<boolean>
}
```

### 1.2 Test Data Strategy

#### Test Account Configuration
```typescript
// e2e/tests/helpers/constants.ts
export const TEST_ACCOUNTS = {
  STUDENT: {
    email: 'test@scottishailessons.com',
    password: 'red12345',
    studentId: '68d28c190016b1458092',  // Pre-existing
    userId: '68d28b6b0028ea8966c9'      // Auth user ID
  },
  ADMIN: {
    email: 'admin@scottishailessons.com',
    password: 'admin12345',
    labels: ['admin']  // Required for admin panel access
  },
  NEW_USER: {
    // Generated dynamically in onboarding tests
    emailPrefix: 'test-onboarding-',
    emailSuffix: '@scottishailessons.com',
    password: 'test12345'
  }
};

export const TEST_COURSES = {
  MATHEMATICS_N3: 'test_course_simple_math',  // Has 1 lesson
  APPLICATIONS_HIGHER: 'course_c84476',       // Has 24 lessons (might be empty)
  TEST_COURSE: 'test_course_simple_math'      // Known working course
};

export const TEST_SESSIONS = {
  COMPLETED: '68baa782001b883a1113',  // Pre-completed session
  // In-progress sessions created dynamically
};
```

#### Cleanup Hooks
```typescript
// e2e/tests/auth-refactor/admin-panel.spec.ts
test.afterEach(async ({ page }, testInfo) => {
  const cleanup = new TestDataCleanup(page);

  if (testInfo.status === 'passed' || testInfo.status === 'failed') {
    // Always cleanup, even on failure
    await cleanup.cleanupEnrollments(TEST_ACCOUNTS.STUDENT.studentId, [
      TEST_COURSES.TEST_COURSE
    ]);
    await cleanup.verifyCleanup();
  }
});
```

### 1.3 Baseline E2E Tests (Write BEFORE Migration)

These tests should FAIL initially (proving client SDK is broken), then PASS after migration:

#### Test 1: Admin Panel Access
```typescript
// e2e/tests/auth-refactor/admin-panel.spec.ts
test('should display admin panel for authenticated admin user', async ({ page }) => {
  // Login as admin
  await loginUser(page, TEST_ACCOUNTS.ADMIN);

  // Navigate to /admin
  await page.goto('/admin');

  // Verify no redirect to dashboard
  await expect(page).toHaveURL('/admin');

  // Verify admin panel content visible
  await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible();
  await expect(page.getByText('Authored SOWs')).toBeVisible();

  // Verify SOW list loads (server-side auth check)
  await expect(page.getByText(/13 SOWs total/)).toBeVisible({ timeout: 10000 });
});

test('should redirect non-admin users to dashboard', async ({ page }) => {
  // Login as regular student
  await loginUser(page, TEST_ACCOUNTS.STUDENT);

  // Attempt to navigate to /admin
  await page.goto('/admin');

  // Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Welcome back')).toBeVisible();
});
```

#### Test 2: Browse Courses with Enrollment Status
```typescript
// e2e/tests/auth-refactor/browse-courses.spec.ts
test('should display course catalog with enrollment status for authenticated user', async ({ page }) => {
  await loginUser(page, TEST_ACCOUNTS.STUDENT);

  // Navigate to catalog
  await page.goto('/courses/catalog');

  // Verify courses load
  await expect(page.getByRole('heading', { name: 'Course Catalog' })).toBeVisible();

  // Verify enrollment status indicators
  const enrolledCourse = page.locator(`[data-course-id="${TEST_COURSES.MATHEMATICS_N3}"]`);
  await expect(enrolledCourse.getByText('Enrolled')).toBeVisible();

  // Verify unenrolled course shows enroll button
  const unenrolledCourse = page.locator('[data-status="not-enrolled"]').first();
  await expect(unenrolled Course.getByRole('button', { name: 'Enroll' })).toBeVisible();
});

test('should allow enrollment in new course', async ({ page }) => {
  await loginUser(page, TEST_ACCOUNTS.STUDENT);
  await page.goto('/courses/catalog');

  // Find an unenrolled course
  const enrollButton = page.getByRole('button', { name: 'Enroll' }).first();
  const courseId = await enrollButton.getAttribute('data-course-id');

  // Click enroll
  await enrollButton.click();

  // Verify enrollment success (server-side operation)
  await expect(page.getByText('Successfully enrolled')).toBeVisible();

  // Cleanup: Unenroll
  const cleanup = new TestDataCleanup(page);
  await cleanup.cleanupEnrollments(TEST_ACCOUNTS.STUDENT.studentId, [courseId]);
});
```

#### Test 3: Student Dashboard Data Loading
```typescript
// e2e/tests/auth-refactor/student-dashboard.spec.ts
test('should load dashboard with all enrolled courses and recommendations', async ({ page }) => {
  await loginUser(page, TEST_ACCOUNTS.STUDENT);
  await page.goto('/dashboard');

  // Verify welcome message with course count
  await expect(page.getByText(/Ready to continue your learning across \d+ courses?/)).toBeVisible();

  // Verify enrolled courses displayed
  await expect(page.getByRole('heading', { name: 'Your Courses' })).toBeVisible();

  // Verify recommendations section loads
  await expect(page.getByRole('heading', { name: 'Reviews & Recommendations' })).toBeVisible({ timeout: 15000 });

  // Verify no console errors related to client SDK
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('401')) {
      consoleErrors.push(msg.text());
    }
  });

  // Wait for data to load
  await page.waitForTimeout(3000);

  // Should be NO 401 errors (client SDK auth failures)
  expect(consoleErrors.length).toBe(0);
});

test('should handle re-enrollment in archived course', async ({ page }) => {
  await loginUser(page, TEST_ACCOUNTS.STUDENT);
  await page.goto('/dashboard');

  // Find archived course
  const archivedCourse = page.locator('[data-enrollment-status="archived"]').first();
  await expect(archivedCourse).toBeVisible();

  // Click re-enroll button
  await archivedCourse.getByRole('button', { name: 'Re-enroll' }).click();

  // Verify re-enrollment success (server-side operation)
  await expect(page.getByText('Successfully re-enrolled')).toBeVisible();

  // Verify course now shows as active
  const courseId = await archivedCourse.getAttribute('data-course-id');
  await expect(page.locator(`[data-course-id="${courseId}"][data-enrollment-status="active"]`)).toBeVisible();

  // Cleanup
  const cleanup = new TestDataCleanup(page);
  await cleanup.cleanupEnrollments(TEST_ACCOUNTS.STUDENT.studentId, [courseId]);
});
```

#### Test 4: Onboarding Flow
```typescript
// e2e/tests/auth-refactor/onboarding-flow.spec.ts
test('should complete new user onboarding with profile creation', async ({ page }) => {
  // Generate unique test email
  const timestamp = Date.now();
  const testEmail = `${TEST_ACCOUNTS.NEW_USER.emailPrefix}${timestamp}${TEST_ACCOUNTS.NEW_USER.emailSuffix}`;

  // Sign up
  await page.goto('/signup');
  await page.fill('[name="email"]', testEmail);
  await page.fill('[name="password"]', TEST_ACCOUNTS.NEW_USER.password);
  await page.fill('[name="name"]', 'Test User');
  await page.click('[type="submit"]');

  // Should redirect to onboarding
  await expect(page).toHaveURL('/onboarding');

  // Complete onboarding steps (server-side profile creation)
  await page.fill('[name="learningGoal"]', 'Pass National 3 Mathematics');
  await page.click('[data-testid="next-button"]');

  // Select first course from catalog
  await page.click('[data-testid="course-select"]').first();
  await page.click('[data-testid="complete-onboarding"]');

  // Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText(/Welcome.*Test User/)).toBeVisible();

  // Cleanup: Delete test user
  const cleanup = new TestDataCleanup(page);
  await cleanup.cleanupTestStudent(testEmail);
});
```

#### Test 5: Curriculum Display with Sessions
```typescript
// e2e/tests/auth-refactor/curriculum-display.spec.ts
test('should display course curriculum with lesson completion status', async ({ page }) => {
  await loginUser(page, TEST_ACCOUNTS.STUDENT);

  // Navigate to course detail page
  await page.goto(`/courses/${TEST_COURSES.MATHEMATICS_N3}`);

  // Verify curriculum section loads
  await expect(page.getByRole('heading', { name: 'Course Curriculum' })).toBeVisible();

  // Verify lesson list loads (server-side session data)
  const lessonList = page.locator('[data-testid="curriculum-lessons"]');
  await expect(lessonList).toBeVisible();

  // Verify completed lessons show checkmark
  const completedLesson = lessonList.locator('[data-status="completed"]').first();
  await expect(completedLesson.getByRole('img', { name: 'Completed' })).toBeVisible();

  // Verify not-started lessons show start button
  const notStartedLesson = lessonList.locator('[data-status="not-started"]').first();
  await expect(notStartedLesson.getByRole('button', { name: 'Start Lesson' })).toBeVisible();
});
```

#### Test 6: Course Progress Export
```typescript
// e2e/tests/auth-refactor/course-progress-export.spec.ts
test('should view and export course progress as PDF', async ({ page }) => {
  await loginUser(page, TEST_ACCOUNTS.STUDENT);

  // Navigate to progress page
  await page.goto(`/dashboard/progress?courseId=${TEST_COURSES.MATHEMATICS_N3}`);

  // Verify progress data loads (server-side auth)
  await expect(page.getByRole('heading', { name: 'Course Progress' })).toBeVisible();
  await expect(page.getByText(/Overall Progress:.*%/)).toBeVisible();

  // Click export PDF button
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-testid="export-pdf-button"]')
  ]);

  // Verify PDF downloaded
  expect(download.suggestedFilename()).toMatch(/progress.*\.pdf/);
});
```

---

## Phase 2: Component Migration (Week 3-7)

### Priority 1: CRITICAL Components (Week 3-4)

#### 2.1 SessionChatAssistant.tsx
**Impact:** BLOCKS ENTIRE TEACHING FLOW
**Complexity:** COMPLEX
**Estimated Effort:** 3-5 days

**Migration Steps:**
1. Write failing E2E test:  lesson-session-loading.spec.ts`
2. Create server API endpoints:
   - `POST /api/session/load` - Load session data with outcome enrichment
   - `GET /api/session/diagram` - Fetch lesson diagram
   - `GET /api/session/revision-notes` - Get quick notes
   - `PATCH /api/session/thread-id` - Update session thread IDs
3. Update SessionChatAssistant.tsx:
   - Replace `createDriver(CourseDriver)` with `fetch('/api/session/load')`
   - Replace `createDriver(DiagramDriver)` with `fetch('/api/session/diagram')`
   - Replace `createDriver(RevisionNotesDriver)` with `fetch('/api/session/revision-notes')`
   - Replace `sessionDriver.updateSessionThreadId()` with `fetch('/api/session/thread-id')`
4. Remove ALL driver imports
5. Verify fast-fail error handling (NO fallbacks)
6. Run E2E tests - should PASS

**Test Coverage:**
- Session loads with enriched outcomes
- Diagram fetches correctly
- Revision notes available
- Thread IDs persist
- Backend boundary check fails-fast

#### 2.2 SOWListView.tsx & SOWDetailView.tsx
**Impact:** BLOCKS ADMIN PANEL
**Complexity:** MODERATE
**Estimated Effort:** 2-3 days

**Migration Steps:**
1. Write failing E2E test: `e2e/tests/auth-refactor/admin-sow-management.spec.ts`
2. Create server API endpoints:
   - `GET /api/admin/sows` - List all SOWs for admin
   - `GET /api/admin/sows/[sowId]` - Get SOW details
   - `POST /api/admin/sows/[sowId]/publish` - Publish SOW
   - `POST /api/admin/sows/[sowId]/unpublish` - Unpublish SOW
   - `POST /api/admin/sows/[sowId]/lessons/publish-all` - Bulk publish lessons
   - `POST /api/admin/sows/[sowId]/lessons/unpublish-all` - Bulk unpublish lessons
3. Update components:
   - Replace `driver.getAllSOWsForAdmin()` with `fetch('/api/admin/sows')`
   - Replace `driver.getSOWById()` with `fetch(`/api/admin/sows/${sowId}`)`
   - Replace publish/unpublish calls with server API
4. Remove driver imports
5. Run E2E tests - should PASS

**Test Coverage:**
- Admin sees SOW list
- Admin can view SOW details
- Publish/unpublish operations work
- Bulk lesson operations work
- Non-admin users cannot access

#### 2.3 EnhancedStudentDashboard.tsx
**Impact:** BLOCKS STUDENT LEARNING JOURNEY
**Complexity:** COMPLEX
**Estimated Effort:** 4-6 days

**Migration Steps:**
1. Write failing E2E test: `e2e/tests/auth-refactor/dashboard-recommendations.spec.ts`
2. **CRITICAL**: Remove fallback pattern at line 188 ("Continue without metadata")
3. Create server API endpoints:
   - `GET /api/dashboard/enrollments` - Get all enrollments with status (ALREADY EXISTS - verify)
   - `POST /api/dashboard/re-enroll` - Re-enroll in archived course
   - `GET /api/dashboard/courses` - Get courses by IDs
4. Replace client SDK calls:
   - Lines 266-269: Replace `databases.listDocuments()` (enrollments) with `/api/dashboard/enrollments`
   - Lines 305-309: Replace `databases.listDocuments()` (enrolled courses) with `/api/dashboard/courses`
   - Lines 358-362: Replace `databases.listDocuments()` (archived) with `/api/dashboard/enrollments?status=archived`
   - Lines 379-385: Replace re-enrollment client SDK with `fetch('/api/dashboard/re-enroll')`
   - Lines 440-444: Replace course fetch with `/api/dashboard/courses`
   - Lines 453-457: Replace lesson templates fetch with server API
5. Remove fallback at line 191-195 - FAIL-FAST instead
6. Run E2E tests - should PASS

**Test Coverage:**
- Dashboard loads all enrolled courses
- Recommendations load via LangGraph
- Re-enrollment works
- NO silent failures (all 401s caught)
- NO fallback pattern (fast-fail on errors)

### Priority 2: HIGH Components (Week 5-6)

#### 2.4 CourseCurriculum.tsx
**Impact:** AFFECTS LESSON DISPLAY UX
**Complexity:** SIMPLE
**Estimated Effort:** 1-2 days

**Migration Steps:**
1. Write failing E2E test: `e2e/tests/auth-refactor/curriculum-lessons.spec.ts`
2. Create server API endpoint:
   - `GET /api/courses/[courseId]/lessons` - Get lesson templates (with pagination)
   - `GET /api/courses/[courseId]/revision-notes/[lessonId]/exists` - Check notes availability
3. Replace client SDK calls:
   - Lines 110-132: Replace lesson template fetch with `/api/courses/${courseId}/lessons`
   - Lines 73-80: Replace RevisionNotesDriver with `/api/courses/${courseId}/revision-notes/${lessonId}/exists`
4. Session fetch already migrated (line 163 uses `/api/student/sessions`)
5. Run E2E tests - should PASS

**Test Coverage:**
- Lesson list displays correctly
- Session completion status shows
- Revision notes availability indicator
- Pagination works

#### 2.5 OnboardingWizard.tsx
**Impact:** AFFECTS NEW USER REGISTRATION
**Complexity:** SIMPLE
**Estimated Effort:** 1-2 days

**Migration Steps:**
1. Write failing E2E test: `e2e/tests/auth-refactor/onboarding-profile-creation.spec.ts`
2. Create server API endpoints:
   - `POST /api/student/profile` - Create/update student profile
   - `POST /api/student/enroll-first-course` - Enroll in first course
3. Replace helper functions:
   - Lines 200-236: Replace `updateStudentProfile()` with `fetch('/api/student/profile')`
   - Lines 239-267: Replace `enrollInFirstCourse()` with `fetch('/api/student/enroll-first-course')`
4. Remove direct SDK calls (`account.get()`, `databases.listDocuments()`)
5. Run E2E tests - should PASS

**Test Coverage:**
- New user completes onboarding
- Student profile created
- First course enrollment works
- Cleanup test user after test

### Priority 3: MEDIUM Components (Week 7+)

#### 2.6 CourseProgressView.tsx
**Impact:** NICE-TO-HAVE FEATURE
**Complexity:** SIMPLE
**Estimated Effort:** 1 day

**Migration Steps:**
1. Write failing E2E test: `e2e/tests/auth-refactor/progress-export.spec.ts`
2. Create server API endpoint:
   - `GET /api/student/progress/[courseId]` - Get progress data
3. Replace client SDK:
   - Lines 49-64: Replace user lookup + progress service with single API call
4. PDF generation stays client-side (jsPDF)
5. Run E2E tests - should PASS

#### 2.7 CourseCatalogStep.tsx
**Impact:** NICE-TO-HAVE (PUBLIC DATA)
**Complexity:** SIMPLE
**Estimated Effort:** 0.5 days

**Migration Steps:**
1. **ALREADY MIGRATED** - `/api/courses/catalog` exists and used in catalog page
2. Update CourseCatalogStep.tsx to use existing endpoint
3. Remove client SDK (lines 26-33)
4. Run E2E tests - should PASS

#### 2.8 StudentDashboard.tsx
**Impact:** DEPRECATED COMPONENT
**Complexity:** N/A
**Estimated Effort:** 0.5 days

**Migration Steps:**
1. **REMOVE THIS FILE** - replaced by EnhancedStudentDashboard
2. Search codebase for imports - ensure no references
3. Delete file
4. Remove from git

---

## Phase 3: Testing & Validation (Week 8+)

### 3.1 E2E Test Execution

#### Local Testing
```bash
cd e2e
npm install
npx playwright install

# Run specific test suites
npm run test:auth                  # Auth flow tests
npm run test:admin                 # Admin panel tests (NEW)
npm run test:browse-courses        # Course catalog (NEW)
npm run test:dashboard             # Dashboard loading (NEW)
npm run test:onboarding            # Onboarding flow (NEW)
npm run test:curriculum            # Curriculum display (NEW)
npm run test:progress-export       # Progress export (NEW)

# Run all auth refactor tests
npm run test:auth-refactor

# Run all existing lesson tests
npm run test:happy-path
npm run test:error-handling
npm run test:post-completion

# Run ALL tests
npm test
```

#### CI/CD Testing (GitHub Actions)
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-auth-refactor:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Start Backend Services
        run: |
          ./start.sh &
          sleep 10  # Wait for services to start

      - name: Install E2E Dependencies
        run: |
          cd e2e
          npm ci
          npx playwright install --with-deps

      - name: Run Auth Refactor Tests
        run: |
          cd e2e
          npm run test:auth-refactor
        env:
          BASE_URL: http://localhost:3000
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/playwright-report

      - name: Upload Test Videos
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-videos
          path: e2e/test-results
```

### 3.2 Test Data Cleanup Verification

#### Automated Cleanup Checks
```typescript
// e2e/tests/helpers/cleanup-verification.ts
export async function verifyNoTestDataLeaks(page: Page): Promise<void> {
  // Check for test enrollments still in database
  const response = await page.request.get('/api/admin/test-data/enrollments');
  const enrollments = await response.json();

  const testEnrollments = enrollments.data.filter((e: any) =>
    e.studentId === TEST_ACCOUNTS.STUDENT.studentId &&
    e.createdAt > new Date(Date.now() - 3600000) // Last hour
  );

  if (testEnrollments.length > 0) {
    throw new Error(`Found ${testEnrollments.length} leaked test enrollments`);
  }

  // Check for test sessions
  const sessionsResponse = await page.request.get('/api/admin/test-data/sessions');
  const sessions = await sessionsResponse.json();

  const testSessions = sessions.data.filter((s: any) =>
    s.studentId === TEST_ACCOUNTS.STUDENT.studentId &&
    s.createdAt > new Date(Date.now() - 3600000)
  );

  if (testSessions.length > 0) {
    throw new Error(`Found ${testSessions.length} leaked test sessions`);
  }
}

// Run after ALL tests complete
test.afterAll(async ({ page }) => {
  await verifyNoTestDataLeaks(page);
});
```

### 3.3 Production-Safe Testing

#### Test Account Isolation
```typescript
// e2e/playwright.config.ts
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Extra HTTP headers for test identification
    extraHTTPHeaders: {
      'X-Test-Mode': 'true',
      'X-Test-Session-Id': process.env.TEST_SESSION_ID || 'e2e-test'
    },

    // Storage state isolation
    storageState: undefined, // Always start fresh
  },

  // Cleanup after test runs
  globalTeardown: './tests/helpers/global-teardown.ts',
});
```

#### Rate Limiting Exemption
```typescript
// assistant-ui-frontend/lib/rate-limit.ts
export function isTestMode(request: NextRequest): boolean {
  const testMode = request.headers.get('X-Test-Mode');
  const testSessionId = request.headers.get('X-Test-Session-Id');

  return testMode === 'true' && testSessionId?.startsWith('e2e-test');
}

// Skip rate limiting for E2E tests
export async function rateLimit(request: NextRequest) {
  if (isTestMode(request)) {
    return { success: true };
  }

  // Normal rate limiting logic
  // ...
}
```

---

## Test Data Cleanup Strategy

### Cleanup Patterns

#### Pattern 1: After Each Test
```typescript
test.afterEach(async ({ page }, testInfo) => {
  const cleanup = new TestDataCleanup(page);

  // Always cleanup, even on failure
  await cleanup.cleanupEnrollments(TEST_ACCOUNTS.STUDENT.studentId, createdEnrollments);
  await cleanup.cleanupSessions(TEST_ACCOUNTS.STUDENT.studentId, createdSessions);
  await cleanup.verifyCleanup();
});
```

#### Pattern 2: On Test Failure
```typescript
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'failed') {
    // Log test data for debugging
    await logTestDataState(page, testInfo.title);

    // Still cleanup to not pollute database
    await cleanupTestData(page);
  }
});
```

#### Pattern 3: Global Cleanup
```typescript
// e2e/tests/helpers/global-teardown.ts
export default async function globalTeardown() {
  const page = await createPage();

  // Cleanup any leaked test data from failed tests
  await cleanupAllTestData(page);

  // Verify database clean
  await verifyNoTestDataLeaks(page);

  await page.close();
}
```

### Cleanup API Endpoints

Create admin-only endpoints for test data cleanup:

```typescript
// assistant-ui-frontend/app/api/admin/test-data/cleanup/route.ts
export async function POST(request: NextRequest) {
  // ONLY allow in development/test mode
  if (process.env.NODE_ENV === 'production' && !isTestMode(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { databases } = await createSessionClient();
  const body = await request.json();

  // Cleanup test enrollments
  if (body.studentId && body.enrollments) {
    for (const enrollmentId of body.enrollments) {
      await databases.deleteDocument('default', 'enrollments', enrollmentId);
    }
  }

  // Cleanup test sessions
  if (body.sessionIds) {
    for (const sessionId of body.sessionIds) {
      await databases.deleteDocument('default', 'sessions', sessionId);
    }
  }

  return NextResponse.json({ success: true });
}
```

---

## Success Criteria

### Phase 1 Complete When:
- [x] E2E test infrastructure setup complete
- [x] Test data cleanup module implemented
- [x] Baseline E2E tests written (should FAIL initially)
- [x] multi-course-dashboard.spec.ts deprecated

### Phase 2 Complete When:
- [ ] All 9 components migrated to server-side auth
- [ ] ZERO client SDK imports remain in components
- [ ] All E2E tests PASS
- [ ] NO fallback patterns in codebase
- [ ] StudentDashboard.tsx removed

### Phase 3 Complete When:
- [ ] All E2E tests pass consistently (3 runs in a row)
- [ ] Test data cleanup verified (no leaks)
- [ ] CI/CD pipeline integrated
- [ ] Production testing completed successfully

---

## Risk Mitigation

### Risk 1: Test Data Pollution
**Mitigation:**
- Mandatory cleanup in `afterEach` hooks
- Global cleanup verification
- Admin API for emergency cleanup

### Risk 2: Flaky Tests
**Mitigation:**
- Explicit waits for server-side operations
- Retry logic in CI/CD (max 2 retries)
- Timeout configurations per operation type

### Risk 3: Production Impact
**Mitigation:**
- Test mode headers (`X-Test-Mode: true`)
- Separate test account (`test@scottishailessons.com`)
- Rate limiting exemption for test mode
- Database isolation via test account filtering

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Test Infrastructure** | Week 1-2 | E2E tests written, cleanup module, deprecated tests removed |
| **Phase 2: Component Migration** | Week 3-7 | All 9 components migrated, all tests passing |
| **Phase 3: Validation** | Week 8+ | CI/CD integrated, production tested, documentation complete |

**Total Estimated Duration:** 8+ weeks
**Total Test Files:** 12 test files (6 existing + 6 new)
**Total API Endpoints:** 20+ new server-side endpoints

---

## Appendix A: Component Migration Checklist

### For Each Component:

- [ ] Write failing E2E test
- [ ] Identify all client SDK calls
- [ ] Create server API endpoints
- [ ] Update component to use fetch() with credentials: 'include'
- [ ] Remove driver imports
- [ ] Remove fallback patterns
- [ ] Add fast-fail error handling
- [ ] Run E2E tests - verify PASS
- [ ] Verify no console 401 errors
- [ ] Add cleanup hooks
- [ ] Update documentation

---

## Appendix B: Test File Structure

```
e2e/
├── tests/
│   ├── auth.spec.ts                            # [EXISTING] Auth flow
│   ├── lesson-happy-path.spec.ts               # [EXISTING] Lesson completion
│   ├── lesson-error-handling.spec.ts           # [EXISTING] Error scenarios
│   ├── lesson-post-completion.spec.ts          # [EXISTING] Post-lesson
│   ├── e2e/
│   │   └── recommendation-flow.spec.ts         # [EXISTING] Recommendations
│   ├── auth-refactor/
│   │   ├── admin-panel.spec.ts                 # [NEW] Admin access
│   │   ├── browse-courses.spec.ts              # [NEW] Course catalog
│   │   ├── student-dashboard.spec.ts           # [NEW] Dashboard loading
│   │   ├── onboarding-flow.spec.ts             # [NEW] User registration
│   │   ├── curriculum-display.spec.ts          # [NEW] Lesson listing
│   │   └── course-progress-export.spec.ts      # [NEW] Progress export
│   └── helpers/
│       ├── auth.ts                             # [EXISTING] Auth utilities
│       ├── lesson.ts                           # [EXISTING] Lesson utilities
│       ├── constants.ts                        # [EXISTING] Test data
│       ├── cleanup.ts                          # [NEW] Cleanup module
│       ├── cleanup-verification.ts             # [NEW] Cleanup checks
│       └── global-teardown.ts                  # [NEW] Global cleanup
├── playwright.config.ts
├── package.json
└── README.md                                   # [UPDATE] Add auth refactor tests
```

---

**Document Control:**
**Next Review Date:** After Phase 1 completion
**Owner:** Engineering Team
**Approvers:** Product, QA, DevOps
