# MVP2 Phase 2: Onboarding & Course Discovery

**Phase Duration**: Week 2 (5 working days)
**Dependencies**: Phase 1 (Enrollment Service)
**Parent Spec**: [MVP2_user_journey.md](./MVP2_user_journey.md)

---

## Overview

This phase builds the new user experience: from first login through course discovery to first enrollment. The goal is to create an intuitive, welcoming onboarding flow that guides students to their first course while collecting necessary profile information.

**Key Deliverables**:
- ✅ Onboarding wizard for new users
- ✅ Course catalog with search and filters
- ✅ Course detail pages with enrollment CTAs
- ✅ Seamless integration with Phase 1 enrollment service
- ✅ Accessibility-compliant UI (WCAG 2.1 AA)
- ✅ Mobile-responsive design

---

## Component Architecture

### Component Hierarchy

```
OnboardingFlow/
├── OnboardingWizard.tsx (container)
│   ├── WelcomeStep.tsx
│   ├── ProfileStep.tsx
│   └── CourseCatalogStep.tsx
│
CourseDiscovery/
├── CourseCatalog.tsx (page)
│   ├── CourseFilterBar.tsx
│   ├── CourseGrid.tsx
│   │   └── CourseCard.tsx
│   └── CourseListView.tsx
│       └── CourseListItem.tsx
│
CourseDetail/
└── CourseDetailView.tsx (page)
    ├── CourseHeader.tsx
    ├── OutcomesSection.tsx
    ├── LessonPreviewSection.tsx
    └── EnrollmentButton.tsx
```

---

## Implementation Specifications

### 1. Onboarding Wizard

**File**: `assistant-ui-frontend/components/onboarding/OnboardingWizard.tsx`

**Purpose**: Multi-step wizard guiding new users through initial setup

#### Interface

```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<StepProps>;
  optional: boolean;
}

interface StepProps {
  onNext: (data?: any) => void;
  onBack: () => void;
  onSkip?: () => void;
}

interface OnboardingData {
  name: string;
  accommodations: string[];
  firstCourseId?: string;
}
```

#### Implementation (Outside-In TDD)

**Test First**: `OnboardingWizard.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

describe('OnboardingWizard', () => {
  // ACCEPTANCE TEST: Complete onboarding flow
  it('should complete onboarding and create student profile', async () => {
    const mockCreateStudent = jest.fn();
    const mockRouter = { push: jest.fn() };

    render(<OnboardingWizard onComplete={mockCreateStudent} router={mockRouter} />);

    // Step 1: Welcome
    expect(screen.getByText(/Welcome to Scottish AI Lessons/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Get Started/i));

    // Step 2: Profile
    await waitFor(() => {
      expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'Test Student' }
    });

    // Select accommodations
    fireEvent.click(screen.getByLabelText(/Text-to-speech/i));
    fireEvent.click(screen.getByLabelText(/Extra time/i));

    fireEvent.click(screen.getByText(/Next/i));

    // Step 3: Course catalog
    await waitFor(() => {
      expect(screen.getByText(/Choose your first course/i)).toBeInTheDocument();
    });

    // Verify student profile created with accommodations
    expect(mockCreateStudent).toHaveBeenCalledWith({
      name: 'Test Student',
      accommodations: ['text-to-speech', 'extra-time']
    });
  });

  it('should allow skipping optional steps', async () => {
    render(<OnboardingWizard />);

    // Skip profile step
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.click(screen.getByText(/Skip for now/i));

    // Should advance to course catalog
    await waitFor(() => {
      expect(screen.getByText(/Choose your first course/i)).toBeInTheDocument();
    });
  });

  it('should allow back navigation', async () => {
    render(<OnboardingWizard />);

    // Go to step 2
    fireEvent.click(screen.getByText(/Get Started/i));

    // Go back to step 1
    fireEvent.click(screen.getByText(/Back/i));

    expect(screen.getByText(/Welcome to Scottish AI Lessons/i)).toBeInTheDocument();
  });

  // ERROR HANDLING
  it('should handle student creation errors', async () => {
    const mockCreateStudent = jest.fn().mockRejectedValue(new Error('Database error'));

    render(<OnboardingWizard onComplete={mockCreateStudent} />);

    // Complete profile step
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'Test' }
    });
    fireEvent.click(screen.getByText(/Next/i));

    // Verify error shown
    await waitFor(() => {
      expect(screen.getByText(/Failed to save profile/i)).toBeInTheDocument();
    });
  });
});
```

**Implementation**: `OnboardingWizard.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WelcomeStep } from './WelcomeStep';
import { ProfileStep } from './ProfileStep';
import { CourseCatalogStep } from './CourseCatalogStep';

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  const [error, setError] = useState<string | null>(null);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Get started with Scottish AI Lessons',
      component: WelcomeStep,
      optional: false
    },
    {
      id: 'profile',
      title: 'Profile',
      description: 'Tell us about yourself',
      component: ProfileStep,
      optional: true
    },
    {
      id: 'course',
      title: 'First Course',
      description: 'Choose your first course',
      component: CourseCatalogStep,
      optional: false
    }
  ];

  const currentStep = steps[currentStepIndex];
  const StepComponent = currentStep.component;

  const handleNext = async (stepData?: any) => {
    // Merge step data into onboarding data
    setOnboardingData(prev => ({ ...prev, ...stepData }));

    // If on profile step, create student record
    if (currentStep.id === 'profile' && stepData) {
      try {
        await createStudentProfile(stepData);
      } catch (err) {
        setError('Failed to save profile. Please try again.');
        return;
      }
    }

    // Move to next step
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Onboarding complete
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep.optional) {
      handleNext();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 ${
                  index === currentStepIndex
                    ? 'text-blue-600 font-semibold'
                    : index < currentStepIndex
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                Step {index + 1}: {step.title}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentStepIndex + 1) / steps.length) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Step content */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold mb-2">{currentStep.title}</h2>
          <p className="text-gray-600 mb-6">{currentStep.description}</p>

          <StepComponent
            onNext={handleNext}
            onBack={handleBack}
            onSkip={currentStep.optional ? handleSkip : undefined}
          />
        </div>
      </div>
    </div>
  );
}

// Helper: Create student profile
async function createStudentProfile(data: { name: string; accommodations: string[] }) {
  const { Client, Account, Databases, ID } = await import('appwrite');

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

  const account = new Account(client);
  const databases = new Databases(client);

  const user = await account.get();

  await databases.createDocument(
    'default',
    'students',
    ID.unique(),
    {
      userId: user.$id,
      name: data.name,
      role: 'student',
      accommodations: JSON.stringify(data.accommodations)
    },
    [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
  );
}
```

### 2. Profile Step

**File**: `assistant-ui-frontend/components/onboarding/ProfileStep.tsx`

**Test**: `ProfileStep.test.tsx`

```typescript
describe('ProfileStep', () => {
  it('should collect name and accommodations', () => {
    const mockOnNext = jest.fn();
    render(<ProfileStep onNext={mockOnNext} onBack={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'Jane Doe' }
    });

    fireEvent.click(screen.getByLabelText(/Text-to-speech/i));

    fireEvent.click(screen.getByText(/Next/i));

    expect(mockOnNext).toHaveBeenCalledWith({
      name: 'Jane Doe',
      accommodations: ['text-to-speech']
    });
  });

  it('should require name field', () => {
    render(<ProfileStep onNext={jest.fn()} onBack={jest.fn()} />);

    fireEvent.click(screen.getByText(/Next/i));

    expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
  });

  it('should allow empty accommodations', () => {
    const mockOnNext = jest.fn();
    render(<ProfileStep onNext={mockOnNext} onBack={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: 'John' }
    });

    fireEvent.click(screen.getByText(/Next/i));

    expect(mockOnNext).toHaveBeenCalledWith({
      name: 'John',
      accommodations: []
    });
  });
});
```

**Implementation**: `ProfileStep.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';

interface ProfileStepProps {
  onNext: (data: { name: string; accommodations: string[] }) => void;
  onBack: () => void;
  onSkip?: () => void;
}

export function ProfileStep({ onNext, onBack, onSkip }: ProfileStepProps) {
  const [name, setName] = useState('');
  const [accommodations, setAccommodations] = useState<string[]>([]);
  const [error, setError] = useState('');

  const availableAccommodations = [
    { id: 'text-to-speech', label: 'Text-to-speech' },
    { id: 'extra-time', label: 'Extra time for assessments' },
    { id: 'large-text', label: 'Larger text size' },
    { id: 'high-contrast', label: 'High contrast mode' }
  ];

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    onNext({ name: name.trim(), accommodations });
  };

  const toggleAccommodation = (id: string) => {
    setAccommodations(prev =>
      prev.includes(id)
        ? prev.filter(a => a !== id)
        : [...prev, id]
    );
  };

  return (
    <div>
      {/* Name input */}
      <div className="mb-6">
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Your Name *
        </label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={e => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Enter your full name"
          className="w-full"
        />
        {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
      </div>

      {/* Accommodations */}
      <div className="mb-8">
        <p className="text-sm font-medium mb-3">
          Accessibility Accommodations (optional)
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Select any accommodations you'd like to enable:
        </p>

        <div className="space-y-3">
          {availableAccommodations.map(acc => (
            <div key={acc.id} className="flex items-center">
              <Checkbox
                id={acc.id}
                checked={accommodations.includes(acc.id)}
                onCheckedChange={() => toggleAccommodation(acc.id)}
              />
              <label htmlFor={acc.id} className="ml-2 text-sm cursor-pointer">
                {acc.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>

        <div className="space-x-2">
          {onSkip && (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          )}
          <Button onClick={handleSubmit}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Course Catalog

**File**: `assistant-ui-frontend/components/courses/CourseCatalog.tsx`

**Route**: `/courses/catalog`

**Test**: `CourseCatalog.test.tsx`

```typescript
describe('CourseCatalog', () => {
  it('should display all available courses', async () => {
    const mockCourses = [
      { courseId: 'course_c84473', subject: 'mathematics', level: 'national-3' },
      { courseId: 'course_c84474', subject: 'mathematics', level: 'national-4' }
    ];

    render(<CourseCatalog courses={mockCourses} />);

    await waitFor(() => {
      expect(screen.getByText(/mathematics/i)).toBeInTheDocument();
      expect(screen.getByText(/national-3/i)).toBeInTheDocument();
      expect(screen.getByText(/national-4/i)).toBeInTheDocument();
    });
  });

  it('should filter courses by level', async () => {
    const mockCourses = [
      { courseId: 'nat3', subject: 'math', level: 'national-3' },
      { courseId: 'nat4', subject: 'math', level: 'national-4' }
    ];

    render(<CourseCatalog courses={mockCourses} />);

    // Apply level filter
    fireEvent.click(screen.getByLabelText(/Filter by level/i));
    fireEvent.click(screen.getByText(/National 3/i));

    // Should show only National 3
    expect(screen.getByText(/national-3/i)).toBeInTheDocument();
    expect(screen.queryByText(/national-4/i)).not.toBeInTheDocument();
  });

  it('should show enrolled status on course cards', async () => {
    const mockEnrollments = ['course_c84473'];

    render(<CourseCatalog enrolledCourseIds={mockEnrollments} />);

    await waitFor(() => {
      expect(screen.getByText(/✓ Enrolled/i)).toBeInTheDocument();
    });
  });

  it('should navigate to course detail on click', async () => {
    const mockRouter = { push: jest.fn() };
    render(<CourseCatalog router={mockRouter} />);

    fireEvent.click(screen.getByText(/View Details/i));

    expect(mockRouter.push).toHaveBeenCalledWith('/courses/course_c84473');
  });
});
```

**Implementation**: `CourseCatalog.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CourseCard } from './CourseCard';
import { CourseFilterBar } from './CourseFilterBar';
import { Loader2 } from 'lucide-react';

export function CourseCatalog() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    level: 'all',
    subject: 'all',
    search: ''
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const { Client, Databases, Account, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);
      const account = new Account(client);

      // Get all courses
      const coursesResult = await databases.listDocuments('default', 'courses');

      // Get student enrollments
      const user = await account.get();
      const studentsResult = await databases.listDocuments('default', 'students',
        [Query.equal('userId', user.$id)]
      );

      if (studentsResult.documents.length > 0) {
        const student = studentsResult.documents[0];
        const enrollmentsResult = await databases.listDocuments('default', 'enrollments',
          [Query.equal('studentId', student.$id)]
        );

        setEnrolledCourseIds(enrollmentsResult.documents.map(e => e.courseId));
      }

      setCourses(coursesResult.documents);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    if (filters.level !== 'all' && course.level !== filters.level) {
      return false;
    }
    if (filters.subject !== 'all' && course.subject !== filters.subject) {
      return false;
    }
    if (filters.search && !course.subject.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Course Catalog</h1>

      <CourseFilterBar filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {filteredCourses.map(course => (
          <CourseCard
            key={course.courseId}
            course={course}
            enrolled={enrolledCourseIds.includes(course.courseId)}
            onClick={() => router.push(`/courses/${course.courseId}`)}
          />
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No courses found matching your filters.</p>
        </div>
      )}
    </div>
  );
}
```

---

## Testing Strategy

### Test Pyramid (Phase 2)

```
        /\
       /  \  2 E2E Tests (onboarding + enrollment)
      /----\
     /      \ 5 Integration Tests (API + UI)
    /--------\
   /          \ 20 Unit Tests (components)
  /------------\
```

### Unit Tests (20 total)

**Components to test**:
1. `OnboardingWizard.tsx` - 5 tests
2. `ProfileStep.tsx` - 4 tests
3. `CourseCatalog.tsx` - 6 tests
4. `CourseCard.tsx` - 3 tests
5. `CourseDetailView.tsx` - 2 tests

### Integration Tests (5 total)

1. Onboarding → Student profile creation
2. Course catalog → Appwrite query
3. Course enrollment → Enrollment service
4. Navigation flow → Router integration
5. Filter updates → Course list refresh

### E2E Tests (2 tests)

**Test 1: Complete onboarding flow**

```typescript
// e2e/onboarding-flow.spec.ts
test('new user completes onboarding', async ({ page }) => {
  // 1. Signup
  await page.goto('http://localhost:3000/signup');
  await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 2. Welcome step
  await expect(page.locator('text=Welcome to Scottish AI Lessons')).toBeVisible();
  await page.click('button:has-text("Get Started")');

  // 3. Profile step
  await page.fill('[name="name"]', 'Test Student');
  await page.click('label:has-text("Text-to-speech")');
  await page.click('button:has-text("Next")');

  // 4. Course selection
  await expect(page.locator('text=Choose your first course')).toBeVisible();
  await page.click('.course-card:first-child >> button:has-text("Enroll")');

  // 5. Verify redirect to dashboard
  await page.waitForURL('**/dashboard');
  await expect(page.locator('text=Welcome back, Test Student')).toBeVisible();
});
```

**Test 2: Course enrollment from catalog**

```typescript
// e2e/course-enrollment.spec.ts
test('student enrolls in course from catalog', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', 'existing@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Navigate to catalog
  await page.click('text=Browse More Courses');

  // Select course
  await page.click('.course-card >> text=National 4 Mathematics');

  // Verify course detail page
  await expect(page.locator('h1')).toContainText('National 4 Mathematics');

  // Enroll
  await page.click('button:has-text("Enroll Now")');

  // Wait for enrollment to complete
  await page.waitForURL('**/dashboard');

  // Verify course appears in dashboard
  await expect(page.locator('.course-tabs')).toContainText('National 4 Mathematics');
});
```

### Manual Tests (Playwright MCP)

**Scenario 1: Onboarding Happy Path**
```
□ Open http://localhost:3000 in incognito
□ Click "Sign Up"
□ Create account with test email
□ Verify redirect to onboarding
□ Complete welcome step
□ Enter name and select 2 accommodations
□ Click "Next"
□ Verify student record created in Appwrite
□ Select first course
□ Click "Enroll"
□ Verify redirect to dashboard
□ Verify course appears in "My Courses"
```

**Scenario 2: Course Discovery**
```
□ Login as existing student
□ Click "Browse More Courses"
□ Verify all published courses shown
□ Apply level filter (National 3)
□ Verify only National 3 courses shown
□ Clear filter
□ Apply subject filter (Mathematics)
□ Verify only Mathematics courses shown
□ Search "physics"
□ Verify search results correct
```

**Scenario 3: Course Enrollment**
```
□ Navigate to course catalog
□ Click on course not enrolled in
□ Verify course detail page loads
□ Click "Enroll Now"
□ Verify enrollment success message
□ Verify redirect to dashboard
□ Verify new course in course tabs
□ Verify recommendations load for new course
```

---

## Acceptance Criteria

### Must Have

- [ ] Onboarding wizard displays for new users
- [ ] Profile step collects name and accommodations
- [ ] Course catalog shows all published courses
- [ ] Course filtering by level and subject works
- [ ] Course detail page shows outcomes and lessons
- [ ] Enrollment button triggers enrollment service
- [ ] All UI components mobile-responsive
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] All unit tests pass
- [ ] E2E tests pass

### Should Have

- [ ] Onboarding wizard supports back navigation
- [ ] Skip functionality for optional steps
- [ ] Course search by keyword
- [ ] Course preview (lesson count, duration)
- [ ] Loading states for async operations

---

## Implementation Timeline

**Day 1**: Onboarding wizard structure and routing
**Day 2**: Profile step and student creation
**Day 3**: Course catalog with filters
**Day 4**: Course detail view and enrollment integration
**Day 5**: Testing and accessibility audit

---

*End of Phase 2 Specification*
