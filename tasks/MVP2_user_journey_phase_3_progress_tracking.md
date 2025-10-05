# MVP2 Phase 3: Progress Tracking

**Phase Duration**: Week 3 (5 working days)
**Dependencies**: Phase 1 (Progress Service), Phase 2 (Enrolled courses)
**Parent Spec**: [MVP2_user_journey.md](./MVP2_user_journey.md)

---

## Overview

This phase builds comprehensive progress tracking and visualization. Students can see their learning journey, mastery levels per outcome, and course completion status. The goal is to provide motivating feedback and clear visibility into learning progress.

**Key Deliverables**:
- ✅ Course progress overview in dashboard
- ✅ Detailed progress view page
- ✅ Outcome mastery visualization
- ✅ Session history
- ✅ Course completion detection
- ✅ Progress export (PDF)

---

## Component Architecture

### Component Hierarchy

```
Progress/
├── CourseProgressCard.tsx (dashboard widget)
│   ├── ProgressRing.tsx
│   └── QuickStats.tsx
│
├── CourseProgressView.tsx (full page)
│   ├── ProgressHeader.tsx
│   ├── MasteryBreakdown.tsx
│   │   └── OutcomeMasteryChart.tsx
│   ├── SessionHistory.tsx
│   │   └── SessionListItem.tsx
│   └── ProgressActions.tsx
│       ├── ExportButton.tsx
│       └── CompletionBadge.tsx
│
└── CompletionModal.tsx (celebration)
```

---

## Implementation Specifications

### 1. Course Progress Card (Dashboard Widget)

**File**: `assistant-ui-frontend/components/progress/CourseProgressCard.tsx`

**Purpose**: Summary progress card shown in dashboard for active course

#### Interface

```typescript
interface CourseProgressCardProps {
  courseId: string;
  courseName: string;
  progress: CourseProgress;  // From progress-service.ts
  onViewDetails: () => void;
}

interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  averageMastery: number;
  lastActivity: string | null;
  estimatedTimeRemaining: number;
}
```

#### Implementation (Outside-In TDD)

**Test First**: `CourseProgressCard.test.tsx`

```typescript
describe('CourseProgressCard', () => {
  const mockProgress = {
    courseId: 'course_c84473',
    courseName: 'Mathematics - National 3',
    totalLessons: 20,
    completedLessons: 10,
    progressPercentage: 50,
    averageMastery: 0.65,
    lastActivity: '2025-10-05T10:00:00Z',
    estimatedTimeRemaining: 300
  };

  it('should display progress percentage', () => {
    render(<CourseProgressCard progress={mockProgress} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/10 of 20 lessons/i)).toBeInTheDocument();
  });

  it('should display mastery level with visual indicator', () => {
    render(<CourseProgressCard progress={mockProgress} />);

    expect(screen.getByText('0.65')).toBeInTheDocument();
    expect(screen.getByText(/Developing/i)).toBeInTheDocument(); // 0.5-0.7 = Developing
  });

  it('should show time remaining estimate', () => {
    render(<CourseProgressCard progress={mockProgress} />);

    expect(screen.getByText(/5 hours remaining/i)).toBeInTheDocument(); // 300 min = 5 hrs
  });

  it('should show last activity timestamp', () => {
    render(<CourseProgressCard progress={mockProgress} />);

    expect(screen.getByText(/Last activity:/i)).toBeInTheDocument();
    expect(screen.getByText(/Oct 5/i)).toBeInTheDocument();
  });

  it('should navigate to detailed view on button click', () => {
    const mockOnViewDetails = jest.fn();

    render(<CourseProgressCard progress={mockProgress} onViewDetails={mockOnViewDetails} />);

    fireEvent.click(screen.getByText(/View Details/i));

    expect(mockOnViewDetails).toHaveBeenCalled();
  });

  it('should show completion badge when 100% complete', () => {
    const completedProgress = { ...mockProgress, progressPercentage: 100, completedLessons: 20 };

    render(<CourseProgressCard progress={completedProgress} />);

    expect(screen.getByText(/✓ Completed/i)).toBeInTheDocument();
  });

  // ACCESSIBILITY
  it('should have accessible labels for screen readers', () => {
    render(<CourseProgressCard progress={mockProgress} />);

    expect(screen.getByLabelText(/Course progress: 50%/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Average mastery: 0.65/i)).toBeInTheDocument();
  });
});
```

**Implementation**: `CourseProgressCard.tsx`

```typescript
'use client';

import { formatDistanceToNow } from 'date-fns';
import { ProgressRing } from './ProgressRing';
import { Button } from '../ui/button';
import { TrendingUp, Clock, Award } from 'lucide-react';

export function CourseProgressCard({ progress, onViewDetails }: CourseProgressCardProps) {
  const masteryLabel = getMasteryLabel(progress.averageMastery);
  const masteryColor = getMasteryColor(progress.averageMastery);
  const hoursRemaining = Math.round(progress.estimatedTimeRemaining / 60);

  const isComplete = progress.progressPercentage === 100;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{progress.courseName}</h3>
          {isComplete && (
            <span className="inline-flex items-center px-2 py-1 text-sm bg-green-100 text-green-800 rounded-full mt-1">
              ✓ Completed
            </span>
          )}
        </div>

        <ProgressRing percentage={progress.progressPercentage} size={60} />
      </div>

      {/* Progress stats */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Lessons</span>
          <span className="font-medium" aria-label={`${progress.completedLessons} of ${progress.totalLessons} lessons completed`}>
            {progress.completedLessons} / {progress.totalLessons}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            Average Mastery
          </span>
          <span
            className="font-medium"
            style={{ color: masteryColor }}
            aria-label={`Average mastery: ${progress.averageMastery}`}
          >
            {progress.averageMastery.toFixed(2)} ({masteryLabel})
          </span>
        </div>

        {!isComplete && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Time Remaining
            </span>
            <span className="font-medium">~{hoursRemaining} hours</span>
          </div>
        )}

        {progress.lastActivity && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Last Activity</span>
            <span className="text-sm">
              {formatDistanceToNow(new Date(progress.lastActivity), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>

      {/* Action button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={onViewDetails}
      >
        View Detailed Progress
      </Button>
    </div>
  );
}

// Helpers
function getMasteryLabel(mastery: number): string {
  if (mastery < 0.3) return 'Beginner';
  if (mastery < 0.5) return 'Developing';
  if (mastery < 0.7) return 'Good';
  if (mastery < 0.9) return 'Strong';
  return 'Mastered';
}

function getMasteryColor(mastery: number): string {
  if (mastery < 0.3) return '#EF4444'; // red
  if (mastery < 0.5) return '#F97316'; // orange
  if (mastery < 0.7) return '#EAB308'; // yellow
  if (mastery < 0.9) return '#84CC16'; // light green
  return '#22C55E'; // dark green
}
```

### 2. Detailed Progress View

**File**: `assistant-ui-frontend/components/progress/CourseProgressView.tsx`

**Route**: `/dashboard/progress/:courseId`

**Test**: `CourseProgressView.test.tsx`

```typescript
describe('CourseProgressView', () => {
  it('should load and display course progress', async () => {
    render(<CourseProgressView courseId="course_c84473" />);

    await waitFor(() => {
      expect(screen.getByText(/Mathematics - National 3/i)).toBeInTheDocument();
      expect(screen.getByText(/50%/i)).toBeInTheDocument();
    });
  });

  it('should display outcome mastery breakdown', async () => {
    const mockOutcomes = [
      { outcomeRef: 'outcome-1', outcomeTitle: 'Calculate percentages', mastery: 0.8 },
      { outcomeRef: 'outcome-2', outcomeTitle: 'Apply fractions', mastery: 0.6 }
    ];

    render(<CourseProgressView courseId="course_c84473" />);

    await waitFor(() => {
      expect(screen.getByText(/Calculate percentages/i)).toBeInTheDocument();
      expect(screen.getByText('0.80')).toBeInTheDocument();
      expect(screen.getByText(/Apply fractions/i)).toBeInTheDocument();
      expect(screen.getByText('0.60')).toBeInTheDocument();
    });
  });

  it('should display session history', async () => {
    render(<CourseProgressView courseId="course_c84473" />);

    await waitFor(() => {
      expect(screen.getByText(/Recent Sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/Percentages Practice/i)).toBeInTheDocument();
      expect(screen.getByText(/Oct 5, 2025/i)).toBeInTheDocument();
    });
  });

  it('should show completion modal when course complete', async () => {
    const completeProgress = { progressPercentage: 100, averageMastery: 0.75 };

    render(<CourseProgressView courseId="course_c84473" />);

    await waitFor(() => {
      expect(screen.getByText(/🎉 Course Completed!/i)).toBeInTheDocument();
      expect(screen.getByText(/Download Certificate/i)).toBeInTheDocument();
    });
  });

  it('should export progress as PDF', async () => {
    const mockExport = jest.fn();

    render(<CourseProgressView courseId="course_c84473" onExport={mockExport} />);

    fireEvent.click(screen.getByText(/Export Progress Report/i));

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalled();
    });
  });
});
```

**Implementation**: `CourseProgressView.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCourseProgress } from '@/lib/services/progress-service';
import { MasteryBreakdown } from './MasteryBreakdown';
import { SessionHistory } from './SessionHistory';
import { CompletionModal } from './CompletionModal';
import { Button } from '../ui/button';
import { ArrowLeft, Download } from 'lucide-react';

export function CourseProgressView({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => {
    loadProgress();
  }, [courseId]);

  const loadProgress = async () => {
    try {
      const { Databases, Client, Account, Query } = await import('appwrite');

      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const databases = new Databases(client);
      const account = new Account(client);

      const user = await account.get();
      const studentsResult = await databases.listDocuments('default', 'students',
        [Query.equal('userId', user.$id)]
      );

      const student = studentsResult.documents[0];

      const progressData = await getCourseProgress(student.$id, courseId, databases);
      setProgress(progressData);

      // Show completion modal if just completed
      if (progressData.progressPercentage === 100) {
        setShowCompletionModal(true);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    // Generate PDF report
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('Course Progress Report', 20, 20);

    doc.setFontSize(12);
    doc.text(`Course: ${progress?.courseName}`, 20, 40);
    doc.text(`Progress: ${progress?.progressPercentage}%`, 20, 50);
    doc.text(`Average Mastery: ${progress?.averageMastery}`, 20, 60);
    doc.text(`Lessons Completed: ${progress?.completedLessons} / ${progress?.totalLessons}`, 20, 70);

    doc.save(`progress-${courseId}.pdf`);
  };

  if (loading || !progress) {
    return <div>Loading progress...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <h1 className="text-3xl font-bold mt-4">{progress.courseName}</h1>
        <p className="text-gray-600 mt-2">Detailed Progress Report</p>
      </div>

      {/* Overall progress summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Overall Progress</h3>
          <p className="text-3xl font-bold">{progress.progressPercentage.toFixed(1)}%</p>
          <p className="text-sm text-gray-600 mt-1">
            {progress.completedLessons} of {progress.totalLessons} lessons
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Average Mastery</h3>
          <p className="text-3xl font-bold">{progress.averageMastery.toFixed(2)}</p>
          <p className="text-sm text-gray-600 mt-1">
            {getMasteryLabel(progress.averageMastery)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm text-gray-600 mb-2">Time Remaining</h3>
          <p className="text-3xl font-bold">
            ~{Math.round(progress.estimatedTimeRemaining / 60)}h
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Estimated
          </p>
        </div>
      </div>

      {/* Mastery breakdown */}
      <MasteryBreakdown courseId={courseId} />

      {/* Session history */}
      <SessionHistory courseId={courseId} />

      {/* Export button */}
      <div className="mt-8">
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export Progress Report (PDF)
        </Button>
      </div>

      {/* Completion modal */}
      {showCompletionModal && (
        <CompletionModal
          courseName={progress.courseName}
          averageMastery={progress.averageMastery}
          onClose={() => setShowCompletionModal(false)}
        />
      )}
    </div>
  );
}
```

### 3. Outcome Mastery Chart

**File**: `assistant-ui-frontend/components/progress/OutcomeMasteryChart.tsx`

**Purpose**: Visual bar chart showing mastery per learning outcome

**Library**: Recharts

**Test**: `OutcomeMasteryChart.test.tsx`

```typescript
describe('OutcomeMasteryChart', () => {
  it('should render bar chart with outcome mastery', () => {
    const mockData = [
      { outcomeRef: 'out-1', outcomeTitle: 'Calculate percentages', mastery: 0.8 },
      { outcomeRef: 'out-2', outcomeTitle: 'Apply fractions', mastery: 0.6 }
    ];

    render(<OutcomeMasteryChart data={mockData} />);

    expect(screen.getByText(/Calculate percentages/i)).toBeInTheDocument();
    expect(screen.getByText('0.80')).toBeInTheDocument();
  });

  it('should color bars based on mastery level', () => {
    const mockData = [
      { outcomeRef: 'out-1', mastery: 0.2 },  // Red (beginner)
      { outcomeRef: 'out-2', mastery: 0.5 },  // Yellow (developing)
      { outcomeRef: 'out-3', mastery: 0.9 }   // Green (mastered)
    ];

    const { container } = render(<OutcomeMasteryChart data={mockData} />);

    const bars = container.querySelectorAll('.recharts-bar-rectangle');
    // Verify different colors applied (tested via CSS classes)
  });
});
```

**Implementation**: `OutcomeMasteryChart.tsx`

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OutcomeMasteryData {
  outcomeRef: string;
  outcomeTitle: string;
  mastery: number;
}

export function OutcomeMasteryChart({ data }: { data: OutcomeMasteryData[] }) {
  const getBarColor = (mastery: number) => {
    if (mastery < 0.3) return '#EF4444'; // red
    if (mastery < 0.5) return '#F97316'; // orange
    if (mastery < 0.7) return '#EAB308'; // yellow
    if (mastery < 0.9) return '#84CC16'; // light green
    return '#22C55E'; // dark green
  };

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="horizontal">
        <XAxis type="number" domain={[0, 1]} />
        <YAxis type="category" dataKey="outcomeTitle" width={200} />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.[0]) return null;
            const data = payload[0].payload;
            return (
              <div className="bg-white p-3 border rounded shadow">
                <p className="font-medium">{data.outcomeTitle}</p>
                <p className="text-sm">Mastery: {data.mastery.toFixed(2)}</p>
                <p className="text-sm text-gray-600">{getMasteryLabel(data.mastery)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="mastery">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.mastery)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

---

## Testing Strategy

### Test Pyramid (Phase 3)

```
        /\
       /  \  1 E2E Test (progress flow)
      /----\
     /      \ 4 Integration Tests
    /--------\
   /          \ 12 Unit Tests
  /------------\
```

### Unit Tests (12 total)

1. `CourseProgressCard.tsx` - 4 tests
2. `CourseProgressView.tsx` - 3 tests
3. `OutcomeMasteryChart.tsx` - 2 tests
4. `SessionHistory.tsx` - 2 tests
5. `CompletionModal.tsx` - 1 test

### Integration Tests (4 total)

1. Progress card → Progress service integration
2. Progress view → Appwrite data fetch
3. Mastery chart → MasteryV2 data parsing
4. Export → PDF generation

### E2E Test (1 test)

```typescript
// e2e/progress-tracking.spec.ts
test('student views progress and exports report', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Navigate to progress view
  await page.click('text=View Detailed Progress');
  await page.waitForURL('**/progress/**');

  // Verify progress shown
  await expect(page.locator('text=Overall Progress')).toBeVisible();
  await expect(page.locator('text=Average Mastery')).toBeVisible();

  // Export report
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Export Progress Report")')
  ]);

  expect(download.suggestedFilename()).toContain('progress');
});
```

### Manual Tests (Playwright MCP)

**Scenario 1: View Progress Card**
```
□ Login as student with partial progress
□ Verify progress card shows in dashboard
□ Verify progress percentage correct
□ Verify mastery level displayed
□ Verify time remaining shown
□ Click "View Details"
□ Verify navigation to progress view
```

**Scenario 2: Detailed Progress View**
```
□ Navigate to detailed progress view
□ Verify overall stats displayed
□ Verify outcome mastery chart renders
□ Verify all outcomes listed
□ Verify mastery bars colored correctly
□ Verify session history displayed
□ Scroll to bottom
□ Click "Export Progress Report"
□ Verify PDF downloaded
```

**Scenario 3: Course Completion**
```
□ Complete final lesson in course
□ Return to dashboard
□ Verify completion modal appears
□ Verify confetti animation plays
□ Click "Download Certificate"
□ Verify certificate PDF generated
□ Close modal
□ Verify completion badge on course
```

---

## Acceptance Criteria

### Must Have

- [ ] Progress card shows in dashboard for each enrolled course
- [ ] Detailed progress view displays all metrics
- [ ] Outcome mastery chart renders correctly
- [ ] Session history lists completed sessions
- [ ] Course completion detected and celebrated
- [ ] Progress export generates PDF
- [ ] All unit tests pass
- [ ] E2E test passes

### Should Have

- [ ] Progress ring animations
- [ ] Mastery trend over time
- [ ] Share progress on social media
- [ ] Compare progress with class average

---

## Implementation Timeline

**Day 1**: Progress card component and dashboard integration
**Day 2**: Detailed progress view page
**Day 3**: Outcome mastery chart and visualization
**Day 4**: Session history and export functionality
**Day 5**: Course completion and testing

---

*End of Phase 3 Specification*
