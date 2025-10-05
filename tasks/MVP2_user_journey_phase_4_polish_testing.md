# MVP2 Phase 4: Polish & Testing

**Phase Duration**: Week 4 (5 working days)
**Dependencies**: Phases 1, 2, 3 (All core features)
**Parent Spec**: [MVP2_user_journey.md](./MVP2_user_journey.md)

---

## Overview

This phase focuses on production-ready quality: comprehensive error handling, loading states, accessibility compliance, mobile responsiveness, performance optimization, and end-to-end testing. The goal is to ensure MVP2 meets production quality standards.

**Key Deliverables**:
- ✅ Comprehensive error handling for all flows
- ✅ Loading states and skeleton screens
- ✅ Empty states (no enrollments, no courses, etc.)
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Mobile-responsive design (320px to 1920px)
- ✅ Performance optimization (lazy loading, caching)
- ✅ E2E test suite (Playwright)
- ✅ Documentation updates

---

## Quality Assurance Checklist

### 1. Error Handling

#### 1.1 Network Errors

**Scenarios**:
- Appwrite database offline
- LangGraph backend offline
- Network timeout
- Partial response errors

**Implementation**: Global error boundary

```typescript
// assistant-ui-frontend/components/ErrorBoundary.tsx

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error tracking service (Sentry)
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.handleRetry);
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={this.handleRetry}>
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Test
describe('ErrorBoundary', () => {
  it('should catch errors and display fallback UI', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/Test error/i)).toBeInTheDocument();
  });

  it('should retry on button click', () => {
    const mockRetry = jest.fn();

    render(
      <ErrorBoundary fallback={(error, retry) => (
        <button onClick={retry}>Retry</button>
      )}>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Retry'));
    // Error cleared, children re-rendered
  });
});
```

#### 1.2 Enrollment Errors

**Enhanced error messages**:

```typescript
// enrollment-service.ts updates

export class EnrollmentError extends Error {
  constructor(
    public code: 'DUPLICATE_ENROLLMENT' | 'NO_AUTHORED_SOW' | 'DATABASE_ERROR',
    message: string,
    public details?: any,
    public userMessage?: string  // NEW: User-friendly message
  ) {
    super(message);
    this.name = 'EnrollmentError';
  }

  toUserMessage(): string {
    switch (this.code) {
      case 'DUPLICATE_ENROLLMENT':
        return 'You are already enrolled in this course. Visit your dashboard to continue learning.';
      case 'NO_AUTHORED_SOW':
        return 'This course curriculum is still being prepared. Please check back later or contact support.';
      case 'DATABASE_ERROR':
        return 'We encountered a technical issue. Please try again in a few moments.';
      default:
        return 'An unexpected error occurred. Please contact support if this persists.';
    }
  }
}

// Usage in UI
try {
  await enrollStudentInCourse(studentId, courseId, databases);
} catch (error) {
  if (error instanceof EnrollmentError) {
    toast.error(error.toUserMessage());
  } else {
    toast.error('An unexpected error occurred');
  }
}
```

#### 1.3 Dashboard Errors

**Empty states**:

```typescript
// EnhancedStudentDashboard.tsx updates

// No enrollments
if (enrollments.length === 0) {
  return (
    <div className="container mx-auto p-6">
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Welcome to Scottish AI Lessons!</h2>
        <p className="text-gray-600 mb-6">
          You haven't enrolled in any courses yet.
        </p>
        <Button onClick={() => router.push('/courses/catalog')}>
          Browse Courses
        </Button>
      </div>
    </div>
  );
}

// No recommendations (SOWV2 missing)
if (recommendationsError && recommendationsError.includes('SOWV2')) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        Course data incomplete. Please try re-enrolling or contact support.
        <Button variant="link" onClick={handleFixEnrollment}>
          Fix Enrollment
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// LangGraph offline
if (recommendationsError && recommendationsError.includes('fetch')) {
  return (
    <Alert variant="warning">
      <AlertDescription>
        Unable to generate recommendations. You can still browse all lessons.
        <Button variant="link" onClick={() => router.push('/lessons')}>
          Browse All Lessons
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

---

### 2. Loading States

#### 2.1 Skeleton Screens

**Component**: `LoadingSkeleton.tsx`

```typescript
export function CourseCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4 w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded mb-2 w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded mb-4 w-2/3"></div>
      <div className="h-10 bg-gray-200 rounded w-full"></div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <div className="h-8 bg-gray-200 rounded mb-6 w-1/3 animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => <CourseCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

// Usage
function Dashboard() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return <ActualDashboard />;
}
```

#### 2.2 Loading Indicators

**Patterns**:
- Button loading states (spinner + disabled)
- Inline loading (fetching recommendations)
- Full-page loading (initial load)

```typescript
// Button with loading state
<Button disabled={enrolling} onClick={handleEnroll}>
  {enrolling ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Enrolling...
    </>
  ) : (
    'Enroll Now'
  )}
</Button>

// Inline loading
{recommendationsLoading ? (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    <p className="ml-3 text-gray-600">Generating recommendations...</p>
  </div>
) : (
  <RecommendationSection recommendations={recommendations} />
)}
```

---

### 3. Accessibility Compliance

#### 3.1 WCAG 2.1 AA Checklist

**Perceivable**:
- [ ] All images have alt text
- [ ] Color contrast ratio >= 4.5:1 for text
- [ ] Form inputs have labels
- [ ] Error messages clearly identified

**Operable**:
- [ ] All functionality available via keyboard
- [ ] Focus indicators visible
- [ ] Skip navigation links
- [ ] No keyboard traps

**Understandable**:
- [ ] Form errors have suggestions
- [ ] Consistent navigation
- [ ] Clear instructions
- [ ] Predictable behavior

**Robust**:
- [ ] Valid HTML5
- [ ] ARIA landmarks
- [ ] Screen reader tested

#### 3.2 Accessibility Audit Script

```typescript
// scripts/accessibility-audit.ts

import { chromium } from 'playwright';
import { injectAxe, checkA11y } from 'axe-playwright';

async function auditAccessibility() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000');
  await injectAxe(page);

  // Check accessibility
  const violations = await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true
    }
  });

  if (violations.length > 0) {
    console.error(`Found ${violations.length} accessibility violations:`);
    violations.forEach(violation => {
      console.error(`- ${violation.id}: ${violation.description}`);
    });
    process.exit(1);
  } else {
    console.log('✅ No accessibility violations found!');
  }

  await browser.close();
}

auditAccessibility();
```

**Run**: `npm run audit:a11y`

#### 3.3 Screen Reader Testing

**Manual Test with VoiceOver (macOS)**:

```
# Enable VoiceOver
Cmd + F5

# Navigate through dashboard
Tab → Verify course tabs announced
Enter → Verify recommendation cards read correctly
Tab through form → Verify labels announced

# Test enrollment flow
Navigate to course catalog
Verify course cards announced with status (enrolled/available)
Activate "Enroll" button
Verify success message announced
```

---

### 4. Mobile Responsiveness

#### 4.1 Breakpoints

```css
/* tailwind.config.js */
module.exports = {
  theme: {
    screens: {
      'xs': '320px',  // Mobile S
      'sm': '640px',  // Mobile L
      'md': '768px',  // Tablet
      'lg': '1024px', // Laptop
      'xl': '1280px', // Desktop
      '2xl': '1536px' // Large Desktop
    }
  }
}
```

#### 4.2 Responsive Components

```typescript
// CourseCard.tsx - Mobile responsive

export function CourseCard({ course, enrolled }: CourseCardProps) {
  return (
    <div className="
      bg-white rounded-lg shadow-md p-4
      sm:p-6
      md:hover:shadow-lg
      transition-shadow
    ">
      {/* Title - wraps on mobile */}
      <h3 className="
        text-lg sm:text-xl
        font-semibold
        mb-2
        line-clamp-2
      ">
        {course.subject}
      </h3>

      {/* Metadata - stacks on mobile */}
      <div className="
        flex flex-col sm:flex-row
        gap-2 sm:gap-4
        text-sm text-gray-600
        mb-4
      ">
        <span>{course.level}</span>
        <span className="hidden sm:inline">•</span>
        <span>{course.lessonCount} lessons</span>
      </div>

      {/* Button - full width on mobile */}
      <Button className="w-full sm:w-auto">
        {enrolled ? 'Continue Learning' : 'Enroll Now'}
      </Button>
    </div>
  );
}
```

#### 4.3 Mobile Testing Checklist

```
Device Testing:
□ iPhone SE (375x667)
□ iPhone 12 Pro (390x844)
□ iPad (768x1024)
□ Samsung Galaxy (360x740)
□ Desktop 1920x1080

Features to Test:
□ Navigation menu (hamburger on mobile)
□ Course tabs (horizontal scroll on mobile)
□ Forms (inputs sized appropriately)
□ Modals (full screen on mobile)
□ Tables (horizontal scroll or card layout)
```

---

### 5. Performance Optimization

#### 5.1 Code Splitting

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const CourseProgressView = dynamic(
  () => import('@/components/progress/CourseProgressView'),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false
  }
);

const OutcomeMasteryChart = dynamic(
  () => import('@/components/progress/OutcomeMasteryChart'),
  {
    loading: () => <div>Loading chart...</div>,
    ssr: false  // Chart library is client-only
  }
);
```

#### 5.2 Image Optimization

```typescript
import Image from 'next/image';

// Use Next.js Image component for automatic optimization
<Image
  src="/course-banner.jpg"
  alt="Course banner"
  width={800}
  height={400}
  priority={false}  // Lazy load below fold
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

#### 5.3 Caching Strategy

```typescript
// lib/cache.ts

class SimpleCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  set(key: string, data: any, ttlMs: number = 5 * 60 * 1000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const progressCache = new SimpleCache();

// Usage in progress-service.ts
export async function getCourseProgress(studentId: string, courseId: string, databases: Databases) {
  const cacheKey = `progress:${studentId}:${courseId}`;

  // Check cache
  const cached = progressCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch and cache
  const progress = await calculateCourseProgress(studentId, courseId, databases);
  progressCache.set(cacheKey, progress, 5 * 60 * 1000);  // 5 min TTL

  return progress;
}
```

#### 5.4 Performance Metrics

**Targets**:
- Lighthouse Performance: 90+
- First Contentful Paint: <1.8s
- Time to Interactive: <3.9s
- Largest Contentful Paint: <2.5s

**Measurement**:

```bash
# Run Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Run in CI
npm run audit:performance
```

---

### 6. End-to-End Test Suite

#### 6.1 Critical Path Tests

**File**: `e2e/critical-paths.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Critical User Paths', () => {
  test('new user onboarding to first lesson', async ({ page }) => {
    // 1. Signup
    await page.goto('http://localhost:3000/signup');
    const email = `test-${Date.now()}@example.com`;
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');

    // 2. Onboarding
    await expect(page.locator('text=Welcome')).toBeVisible();
    await page.click('text=Get Started');

    // 3. Profile
    await page.fill('[name="name"]', 'E2E Test User');
    await page.click('text=Next');

    // 4. Enroll in course
    await page.click('.course-card:first-child >> text=Enroll');
    await page.waitForURL('**/dashboard');

    // 5. Start lesson
    await page.click('text=Start Lesson');
    await page.waitForURL('**/session/**');

    // 6. Complete first card
    await expect(page.locator('[data-testid="lesson-card"]')).toBeVisible();
    await page.fill('[data-testid="student-response"]', '42');
    await page.click('text=Submit');

    // 7. Verify feedback
    await expect(page.locator('text=Correct')).toBeVisible({ timeout: 10000 });
  });

  test('returning user continues lesson', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('[name="email"]', 'existing@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Dashboard loads
    await page.waitForURL('**/dashboard');

    // Continue last lesson
    await page.click('text=Continue Last Lesson');
    await page.waitForURL('**/session/**');

    // Verify lesson state restored
    await expect(page.locator('[data-testid="lesson-card"]')).toBeVisible();
  });

  test('student enrolls in second course', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('[name="email"]', 'student@example.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Browse courses
    await page.click('text=Browse More Courses');
    await page.waitForURL('**/courses/catalog');

    // Enroll in unenrolled course
    await page.click('.course-card >> text=National 4 >> .. >> text=Enroll Now');

    // Verify redirect to dashboard
    await page.waitForURL('**/dashboard');

    // Verify new course appears
    await expect(page.locator('.course-tabs >> text=National 4')).toBeVisible();
  });
});
```

#### 6.2 Error Recovery Tests

```typescript
test.describe('Error Recovery', () => {
  test('recovers from network error during enrollment', async ({ page, context }) => {
    await page.goto('http://localhost:3000/courses/catalog');

    // Simulate network offline during enrollment
    await context.setOffline(true);
    await page.click('text=Enroll Now');

    // Verify error shown
    await expect(page.locator('text=network error')).toBeVisible();

    // Restore network
    await context.setOffline(false);

    // Retry
    await page.click('text=Try Again');

    // Verify success
    await page.waitForURL('**/dashboard');
  });

  test('handles missing SOWV2 gracefully', async ({ page }) => {
    // TODO: Setup test database with enrollment but no SOWV2
    // Verify error message suggests re-enrollment
    // Verify "Fix Enrollment" button works
  });
});
```

---

## Acceptance Criteria

### Must Have

- [ ] All error scenarios have user-friendly messages
- [ ] Loading states for all async operations
- [ ] Empty states for all collections
- [ ] WCAG 2.1 AA compliance (0 critical violations)
- [ ] Mobile responsive (320px to 1920px)
- [ ] Lighthouse Performance > 90
- [ ] Critical path E2E tests pass
- [ ] Documentation updated

### Should Have

- [ ] Screen reader testing passed
- [ ] Performance budget enforced
- [ ] Error tracking integrated (Sentry)
- [ ] Analytics integrated (PostHog/Mixpanel)

---

## Implementation Timeline

**Day 1**: Error handling and empty states
**Day 2**: Loading states and skeletons
**Day 3**: Accessibility audit and fixes
**Day 4**: Mobile responsiveness and performance
**Day 5**: E2E test suite and documentation

---

*End of Phase 4 Specification*
