# MVP2 User Journey - Phase 5: Deployment & Monitoring

**Parent Specification**: [MVP2_user_journey.md](./MVP2_user_journey.md)

**Timeline**: Week 5
**Goal**: Launch MVP2 with production-ready monitoring and feedback systems

## Overview

Phase 5 focuses on deploying the complete MVP2 student journey to production with comprehensive monitoring, error tracking, and user feedback mechanisms. This phase ensures the application is observable, maintainable, and continuously improving based on real user data.

## Objectives

- Deploy staging environment for UAT
- Conduct user acceptance testing with real students
- Deploy to production with zero-downtime strategy
- Integrate analytics for user behavior tracking
- Set up error monitoring and alerting
- Monitor performance and Core Web Vitals
- Establish user feedback collection workflows

## Architecture Decisions

### Deployment Strategy

**Environment Progression**:
```
Development → Staging → Production
```

**Zero-Downtime Deployment**:
- Vercel Preview Deployments for staging
- Production deployment with automatic rollback capability
- Database migrations run before deployment
- Feature flags for gradual rollout

**Environment Variables**:
```bash
# Staging (.env.staging)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<staging-project-id>
NEXT_PUBLIC_LANGGRAPH_API_URL=https://staging-api.scottishailessons.com
NEXT_PUBLIC_ENVIRONMENT=staging

# Production (.env.production)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<production-project-id>
NEXT_PUBLIC_LANGGRAPH_API_URL=https://api.scottishailessons.com
NEXT_PUBLIC_ENVIRONMENT=production
```

### Monitoring Architecture

**Three-Layer Monitoring**:
1. **User Analytics**: PostHog (user behavior, funnels, retention)
2. **Error Tracking**: Sentry (exceptions, performance degradation)
3. **Performance Monitoring**: Vercel Analytics (Core Web Vitals, Edge performance)

**Data Flow**:
```
User Action → Event Capture → Analytics Pipeline → Dashboards
                ↓
            Error Detection → Sentry → Alerts
                ↓
         Performance Metrics → Vercel → Real-time Monitoring
```

## Implementation Details

### 1. Staging Environment Setup

**Vercel Staging Configuration**:

Create `vercel.staging.json`:
```json
{
  "env": {
    "NEXT_PUBLIC_APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
    "NEXT_PUBLIC_APPWRITE_PROJECT_ID": "<staging-project-id>",
    "NEXT_PUBLIC_LANGGRAPH_API_URL": "https://staging-api.scottishailessons.com",
    "NEXT_PUBLIC_ENVIRONMENT": "staging",
    "NEXT_PUBLIC_POSTHOG_KEY": "<staging-posthog-key>",
    "NEXT_PUBLIC_POSTHOG_HOST": "https://app.posthog.com",
    "NEXT_PUBLIC_SENTRY_DSN": "<staging-sentry-dsn>"
  },
  "build": {
    "env": {
      "SENTRY_AUTH_TOKEN": "@sentry-auth-token"
    }
  }
}
```

**Deployment Script** (`scripts/deploy-staging.sh`):
```bash
#!/bin/bash
set -e

echo "🚀 Deploying to Staging..."

# 1. Run tests
npm run test:unit
npm run test:integration

# 2. Build with staging config
export NODE_ENV=production
npm run build

# 3. Deploy to Vercel staging
vercel --prod --yes --token=$VERCEL_TOKEN

# 4. Run smoke tests
npm run test:smoke -- --url=https://staging.scottishailessons.com

echo "✅ Staging deployment complete!"
```

**Database Staging Sync**:
```typescript
// scripts/sync-staging-data.ts
import { Client, Databases } from 'appwrite';

async function syncStagingData() {
  // 1. Copy production Authored_SOW to staging (latest versions only)
  const authoredSOWs = await prodDB.listDocuments('default', 'Authored_SOW', [
    Query.equal('status', 'published'),
    Query.orderDesc('version')
  ]);

  for (const sow of authoredSOWs.documents) {
    await stagingDB.createDocument('default', 'Authored_SOW', sow.$id, {
      ...sow,
      // Anonymize any sensitive data
    });
  }

  // 2. Create test students with anonymized data
  const testStudents = [
    { email: 'test.student1@staging.com', name: 'Test Student 1' },
    { email: 'test.student2@staging.com', name: 'Test Student 2' }
  ];

  for (const student of testStudents) {
    await stagingDB.createDocument('default', 'students', ID.unique(), student);
  }

  console.log('✅ Staging data sync complete');
}
```

### 2. User Acceptance Testing (UAT)

**UAT Test Plan**:

**Test Users**:
- 3-5 real students from different year groups
- 1-2 teachers for observation
- Product owner for final sign-off

**UAT Scenarios** (Playwright MCP Manual Tests):

```typescript
// UAT Scenario 1: Complete Student Journey
test('UAT: Complete student journey from signup to lesson completion', async () => {
  // Given: New student accessing application
  await page.goto('https://staging.scottishailessons.com');

  // When: Student signs up
  await page.click('text=Sign Up');
  await page.fill('input[name="email"]', 'uat.student@test.com');
  await page.fill('input[name="password"]', 'TestPassword123');
  await page.click('button:has-text("Sign Up")');

  // Then: Onboarding wizard appears
  await expect(page.locator('text=Welcome to Scottish AI Lessons')).toBeVisible();

  // When: Student completes onboarding
  await page.click('text=Next');
  await page.fill('input[name="displayName"]', 'UAT Student');
  await page.selectOption('select[name="yearGroup"]', 'S3');
  await page.click('text=Next');

  // Then: Course catalog shown
  await expect(page.locator('text=Browse Courses')).toBeVisible();

  // When: Student enrolls in National 3 course
  await page.click('text=National 3 Mathematics');
  await page.click('button:has-text("Enroll in Course")');

  // Then: Enrollment success and dashboard shows progress card
  await expect(page.locator('text=Successfully enrolled')).toBeVisible();
  await expect(page.locator('[data-testid="course-progress-card"]')).toBeVisible();

  // When: Student starts first lesson
  await page.click('text=Start Lesson');

  // Then: Teaching interface loads with first card
  await expect(page.locator('[data-testid="lesson-card"]')).toBeVisible();

  // When: Student completes card with correct answer
  const answerInput = page.locator('input[data-testid="student-answer"]');
  await answerInput.fill('correct answer');
  await page.click('button:has-text("Submit")');

  // Then: Positive feedback shown
  await expect(page.locator('text=Well done')).toBeVisible();

  // When: Student clicks next
  await page.click('button:has-text("Next Card")');

  // Then: Second card shown
  await expect(page.locator('[data-testid="lesson-card"]')).toBeVisible();

  // MANUAL VERIFICATION:
  // - Check if interface feels intuitive
  // - Observe student's reaction to feedback
  // - Ask about clarity of instructions
  // - Note any confusion or hesitation
});

// UAT Scenario 2: Error Recovery
test('UAT: Network interruption during lesson', async () => {
  // Simulate network offline during lesson
  await page.context().setOffline(true);

  // Student attempts to submit answer
  await page.click('button:has-text("Submit")');

  // Should show offline message
  await expect(page.locator('text=You appear to be offline')).toBeVisible();

  // Restore network
  await page.context().setOffline(false);

  // Should auto-retry
  await expect(page.locator('text=Connection restored')).toBeVisible();

  // MANUAL VERIFICATION:
  // - Does error message feel reassuring?
  // - Is auto-retry seamless?
  // - Does student understand what happened?
});

// UAT Scenario 3: Progress Tracking
test('UAT: View progress after completing multiple lessons', async () => {
  // Given: Student has completed 3 lessons
  // (Set up via database seeding)

  // When: Student navigates to dashboard
  await page.goto('https://staging.scottishailessons.com/dashboard');

  // Then: Progress card shows accurate statistics
  await expect(page.locator('text=3 of 10 lessons complete')).toBeVisible();
  await expect(page.locator('[data-testid="progress-bar"]')).toHaveAttribute('aria-valuenow', '30');

  // When: Student clicks "View Detailed Progress"
  await page.click('text=View Detailed Progress');

  // Then: Outcome mastery chart displayed
  await expect(page.locator('[data-testid="mastery-chart"]')).toBeVisible();

  // MANUAL VERIFICATION:
  // - Is progress visualization clear?
  // - Can student understand their strengths/weaknesses?
  // - Does mastery chart motivate continued learning?
});
```

**UAT Feedback Collection**:
```typescript
// components/UAT/FeedbackWidget.tsx
export function UATFeedbackWidget() {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');

  const submitFeedback = async () => {
    await databases.createDocument('default', 'uat_feedback', ID.unique(), {
      userId: user.$id,
      pageUrl: window.location.href,
      rating,
      feedback,
      timestamp: new Date().toISOString(),
      environment: 'staging'
    });

    toast.success('Thank you for your feedback!');
  };

  if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'staging') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4">
      <h3 className="font-bold mb-2">UAT Feedback</h3>
      <div className="flex gap-2 mb-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => setRating(star)}>
            {star <= rating ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Any issues or suggestions?"
        className="w-full border rounded p-2 mb-2"
      />
      <button onClick={submitFeedback} className="btn-primary">
        Submit
      </button>
    </div>
  );
}
```

### 3. Production Deployment

**Pre-Deployment Checklist**:
```markdown
- [ ] All UAT feedback addressed or documented for future
- [ ] Database migrations tested in staging
- [ ] Environment variables configured in Vercel production
- [ ] DNS configured for custom domain
- [ ] SSL certificates verified
- [ ] Backup strategy confirmed
- [ ] Rollback plan documented
- [ ] On-call rotation scheduled
```

**Production Deployment Script** (`scripts/deploy-production.sh`):
```bash
#!/bin/bash
set -e

echo "🚀 Production Deployment Starting..."

# 1. Final safety checks
echo "⚠️  PRODUCTION DEPLOYMENT - Press ENTER to continue or Ctrl+C to cancel"
read

# 2. Create backup of current production state
echo "📦 Creating production backup..."
npm run backup:production

# 3. Run full test suite
echo "🧪 Running full test suite..."
npm run test:all

# 4. Build production bundle
echo "🏗️  Building production bundle..."
export NODE_ENV=production
npm run build

# 5. Deploy to Vercel production
echo "🌍 Deploying to production..."
vercel --prod --yes --token=$VERCEL_TOKEN

# 6. Wait for deployment to be live
echo "⏳ Waiting for deployment..."
sleep 30

# 7. Run smoke tests against production
echo "🔍 Running production smoke tests..."
npm run test:smoke -- --url=https://scottishailessons.com

# 8. Verify monitoring is active
echo "📊 Verifying monitoring..."
curl -f https://scottishailessons.com/api/health || {
  echo "❌ Health check failed! Rolling back..."
  vercel rollback --yes --token=$VERCEL_TOKEN
  exit 1
}

echo "✅ Production deployment complete!"
echo "🔗 Live at: https://scottishailessons.com"
```

**Health Check Endpoint** (`app/api/health/route.ts`):
```typescript
import { NextResponse } from 'next/server';
import { Client } from 'appwrite';

export async function GET() {
  const checks: Record<string, boolean> = {};

  try {
    // Check Appwrite connectivity
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    const databases = new Databases(client);
    await databases.listDocuments('default', 'courses', [Query.limit(1)]);
    checks.appwrite = true;
  } catch (error) {
    checks.appwrite = false;
  }

  try {
    // Check LangGraph backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_LANGGRAPH_API_URL}/health`);
    checks.langgraph = response.ok;
  } catch (error) {
    checks.langgraph = false;
  }

  const healthy = Object.values(checks).every(v => v);

  return NextResponse.json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }, {
    status: healthy ? 200 : 503
  });
}
```

### 4. Analytics Integration (PostHog)

**PostHog Setup** (`lib/analytics.ts`):
```typescript
import posthog from 'posthog-js';

export const initAnalytics = () => {
  if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug();
      }
    });
  }
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties);
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  posthog.identify(userId, traits);
};
```

**Key Events to Track**:
```typescript
// User lifecycle events
trackEvent('user_signed_up', { method: 'email', yearGroup: 'S3' });
trackEvent('user_logged_in', { returningUser: true });
trackEvent('onboarding_started');
trackEvent('onboarding_completed', { duration: 120 }); // seconds

// Course events
trackEvent('course_viewed', { courseId: 'C844 73', courseName: 'National 3' });
trackEvent('course_enrolled', { courseId: 'C844 73' });
trackEvent('course_unenrolled', { courseId: 'C844 73', reason: 'too_difficult' });

// Lesson events
trackEvent('lesson_started', {
  sessionId,
  lessonTemplateId,
  lessonTitle: 'Adding Fractions'
});
trackEvent('lesson_card_completed', {
  cardIndex: 0,
  attempts: 1,
  isCorrect: true,
  timeTaken: 45 // seconds
});
trackEvent('lesson_completed', {
  sessionId,
  totalCards: 5,
  averageAttempts: 1.2,
  totalTime: 300 // seconds
});
trackEvent('hint_requested', { cardIndex: 2, hintLevel: 1 });

// Context chat events
trackEvent('context_chat_opened', { sessionId });
trackEvent('context_chat_message_sent', { messageLength: 45 });
trackEvent('context_chat_helpful', { rating: 5 });

// Progress tracking events
trackEvent('progress_viewed', { courseId: 'C844 73' });
trackEvent('mastery_improved', { outcomeId: 'MTH-2-03a', oldLevel: 0.5, newLevel: 0.7 });

// Error events
trackEvent('error_encountered', {
  errorType: 'SOWV2_NOT_FOUND',
  context: 'lesson_start'
});
```

**Funnel Analysis Setup**:
```typescript
// Define key funnels in PostHog dashboard:

// Funnel 1: Onboarding to First Lesson
// 1. user_signed_up
// 2. onboarding_completed
// 3. course_enrolled
// 4. lesson_started

// Funnel 2: Lesson Engagement
// 1. lesson_started
// 2. lesson_card_completed (at least 1)
// 3. lesson_completed

// Funnel 3: Context Chat Usage
// 1. lesson_started
// 2. context_chat_opened
// 3. context_chat_message_sent
```

**Retention Cohorts**:
```typescript
// Define cohorts in PostHog:
// - Daily active users (DAU)
// - Weekly active users (WAU)
// - Monthly active users (MAU)
// - Users who completed onboarding
// - Users who started at least 1 lesson
// - Users who completed at least 1 lesson
```

### 5. Error Monitoring (Sentry)

**Sentry Configuration** (`sentry.client.config.ts`):
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Enhanced context
  beforeSend(event, hint) {
    // Add user context
    if (event.user) {
      event.user = {
        id: event.user.id,
        // Don't send PII
        email: undefined,
        username: undefined
      };
    }

    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      if (error instanceof Error && error.message.includes('ResizeObserver loop')) {
        return null; // Don't send to Sentry
      }
    }

    return event;
  }
});
```

**Custom Error Boundaries with Sentry**:
```typescript
// components/ErrorBoundary.tsx
import * as Sentry from '@sentry/nextjs';

export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Sentry with additional context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack
        }
      },
      tags: {
        errorBoundary: this.props.boundaryName || 'unknown'
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false, error: null })}
          eventId={Sentry.lastEventId()}
        />
      );
    }

    return this.props.children;
  }
}
```

**Error Fallback with User Feedback**:
```typescript
function ErrorFallback({ error, resetError, eventId }: Props) {
  const [feedbackSent, setFeedbackSent] = useState(false);

  const sendFeedback = () => {
    Sentry.showReportDialog({
      eventId,
      user: {
        name: 'Student',
        email: 'student@example.com' // Pre-filled from user context
      }
    });
    setFeedbackSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Oops! Something went wrong
        </h1>
        <p className="text-gray-700 mb-4">
          We're sorry for the inconvenience. Our team has been notified and is working on a fix.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Error ID: {eventId}
        </p>

        <div className="flex gap-4">
          <button onClick={resetError} className="btn-primary">
            Try Again
          </button>
          {!feedbackSent && (
            <button onClick={sendFeedback} className="btn-secondary">
              Report Issue
            </button>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="text-sm text-gray-500 cursor-pointer">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
```

**Performance Monitoring**:
```typescript
// Instrument key operations
import * as Sentry from '@sentry/nextjs';

export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<EnrollmentResult> {
  // Create Sentry transaction
  const transaction = Sentry.startTransaction({
    op: 'enrollment',
    name: 'enrollStudentInCourse'
  });

  try {
    // Span 1: Check existing enrollment
    const checkSpan = transaction.startChild({
      op: 'db.query',
      description: 'Check existing enrollment'
    });
    const existing = await databases.listDocuments('default', 'enrollments', [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]);
    checkSpan.finish();

    if (existing.documents.length > 0) {
      throw new Error('ALREADY_ENROLLED');
    }

    // Span 2: Create enrollment
    const createEnrollmentSpan = transaction.startChild({
      op: 'db.create',
      description: 'Create enrollment record'
    });
    const enrollment = await databases.createDocument(
      'default',
      'enrollments',
      ID.unique(),
      { studentId, courseId, enrolledAt: new Date().toISOString() }
    );
    createEnrollmentSpan.finish();

    // Span 3: Create SOWV2 reference
    const sowSpan = transaction.startChild({
      op: 'db.create',
      description: 'Create SOWV2 reference'
    });
    const sow = await createSOWV2Reference(studentId, courseId, databases);
    sowSpan.finish();

    // Span 4: Initialize mastery
    const masterySpan = transaction.startChild({
      op: 'db.create',
      description: 'Initialize MasteryV2'
    });
    const mastery = await initializeMasteryV2(studentId, courseId, databases);
    masterySpan.finish();

    transaction.setStatus('ok');
    return { enrollment, sow, mastery };

  } catch (error) {
    transaction.setStatus('internal_error');
    Sentry.captureException(error, {
      tags: { operation: 'enrollment' },
      extra: { studentId, courseId }
    });
    throw error;
  } finally {
    transaction.finish();
  }
}
```

### 6. Performance Monitoring (Vercel Analytics)

**Vercel Analytics Setup** (`app/layout.tsx`):
```typescript
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

**Custom Performance Tracking**:
```typescript
// lib/performance.ts
import { sendToVercelAnalytics } from '@vercel/analytics';

export function trackWebVitals(metric: Metric) {
  // Track Core Web Vitals
  if (metric.name === 'FCP' ||
      metric.name === 'LCP' ||
      metric.name === 'CLS' ||
      metric.name === 'FID' ||
      metric.name === 'TTFB') {
    sendToVercelAnalytics(metric);
  }

  // Also log to PostHog for custom dashboards
  trackEvent('web_vital', {
    metric: metric.name,
    value: metric.value,
    rating: metric.rating
  });
}

// Track custom metrics
export function trackCustomMetric(name: string, value: number) {
  sendToVercelAnalytics({
    name,
    value,
    id: crypto.randomUUID()
  });
}

// Usage example
trackCustomMetric('lesson_card_render_time', renderTime);
trackCustomMetric('recommendation_fetch_time', fetchTime);
```

**Performance Budget Monitoring**:
```json
// performance-budget.json
{
  "budgets": [
    {
      "path": "/*",
      "timings": [
        {
          "metric": "first-contentful-paint",
          "budget": 1800
        },
        {
          "metric": "largest-contentful-paint",
          "budget": 2500
        },
        {
          "metric": "time-to-interactive",
          "budget": 3900
        }
      ],
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 300
        },
        {
          "resourceType": "total",
          "budget": 500
        }
      ]
    }
  ]
}
```

### 7. User Feedback Collection

**In-App Feedback Widget**:
```typescript
// components/FeedbackWidget.tsx
'use client';

import { useState } from 'react';
import { databases, ID } from '@/lib/appwrite';
import * as Sentry from '@sentry/nextjs';

type FeedbackType = 'bug' | 'feature' | 'praise' | 'other';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = async () => {
    try {
      // Save to Appwrite
      await databases.createDocument('default', 'user_feedback', ID.unique(), {
        userId: user.$id,
        type,
        message,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT
      });

      // Track in PostHog
      trackEvent('feedback_submitted', { type, messageLength: message.length });

      // If it's a bug, also send to Sentry
      if (type === 'bug') {
        Sentry.captureMessage(`User reported bug: ${message}`, {
          level: 'info',
          tags: { source: 'user_feedback' }
        });
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setMessage('');
      }, 2000);

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Send feedback"
      >
        💬
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            {submitted ? (
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-bold text-green-600">
                  Thank you for your feedback!
                </h3>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold mb-4">Send Feedback</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    What type of feedback?
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as FeedbackType)}
                    className="w-full border rounded p-2"
                  >
                    <option value="bug">🐛 Bug Report</option>
                    <option value="feature">💡 Feature Request</option>
                    <option value="praise">❤️ Praise</option>
                    <option value="other">💬 Other</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Your message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you think..."
                    className="w-full border rounded p-2 h-32 resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={submitFeedback}
                    disabled={!message.trim()}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

**Automated NPS Surveys**:
```typescript
// components/NPSSurvey.tsx
export function NPSSurvey() {
  const [score, setScore] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show NPS survey after 7 days of usage
    const signupDate = new Date(user.signupDate);
    const daysSinceSignup = Math.floor(
      (Date.now() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceSignup >= 7 && !localStorage.getItem('nps_completed')) {
      // Show survey
    }
  }, [user]);

  const submitNPS = async () => {
    await databases.createDocument('default', 'nps_responses', ID.unique(), {
      userId: user.$id,
      score,
      timestamp: new Date().toISOString()
    });

    trackEvent('nps_submitted', { score });
    localStorage.setItem('nps_completed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-4">
      <p className="font-medium mb-2">
        How likely are you to recommend Scottish AI Lessons to a friend?
      </p>
      <div className="flex gap-2 mb-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            onClick={() => setScore(n)}
            className={`w-10 h-10 rounded ${
              score === n ? 'bg-blue-600 text-white' : 'bg-white border'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      {score !== null && (
        <button onClick={submitNPS} className="btn-primary">
          Submit
        </button>
      )}
    </div>
  );
}
```

## Testing Strategy

### Manual Testing (Playwright MCP)

**Pre-Production Checklist**:
```typescript
test('MANUAL: Production smoke test checklist', async ({ page }) => {
  // 1. Homepage loads
  await page.goto('https://scottishailessons.com');
  await expect(page).toHaveTitle(/Scottish AI Lessons/);

  // 2. Signup flow works
  await page.click('text=Sign Up');
  // ... complete signup

  // 3. Onboarding works
  // ... complete onboarding

  // 4. Course enrollment works
  // ... enroll in course

  // 5. Lesson can start
  // ... start lesson

  // 6. Teaching interface loads
  // ... verify teaching panel

  // 7. Context chat works
  // ... open context chat, send message

  // 8. Progress tracking works
  // ... view progress card

  // 9. Logout works
  await page.click('text=Logout');

  // MANUAL VERIFICATION:
  // - Check PostHog for events
  // - Check Sentry for errors
  // - Check Vercel Analytics for performance
  // - Verify health check endpoint
});

test('MANUAL: Monitoring verification', async ({ page }) => {
  // 1. Trigger an intentional error
  await page.goto('https://scottishailessons.com/test-error');

  // 2. Check Sentry dashboard for error
  // MANUAL: Open Sentry dashboard, verify error appears

  // 3. Check PostHog for error event
  // MANUAL: Open PostHog dashboard, verify 'error_encountered' event

  // 4. Check Vercel Analytics
  // MANUAL: Open Vercel dashboard, verify traffic spike

  // 5. Test health check
  const response = await page.goto('https://scottishailessons.com/api/health');
  await expect(response.status()).toBe(200);
});
```

### E2E Tests (Minimal - Critical Paths Only)

```typescript
// e2e/production.spec.ts
import { test, expect } from '@playwright/test';

test('Critical path: Signup to lesson completion', async ({ page }) => {
  // This is the ONE critical e2e test for production
  await page.goto('https://scottishailessons.com');

  // Signup
  await page.click('text=Sign Up');
  const email = `test+${Date.now()}@scottishailessons.com`;
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'TestPassword123');
  await page.click('button:has-text("Sign Up")');

  // Onboarding
  await expect(page.locator('text=Welcome')).toBeVisible();
  await page.click('text=Next');
  await page.fill('input[name="displayName"]', 'E2E Test Student');
  await page.click('text=Next');

  // Enroll
  await page.click('text=National 3 Mathematics');
  await page.click('button:has-text("Enroll in Course")');

  // Start lesson
  await page.click('text=Start Lesson');
  await expect(page.locator('[data-testid="lesson-card"]')).toBeVisible();

  // Complete first card
  await page.fill('input[data-testid="student-answer"]', 'test answer');
  await page.click('button:has-text("Submit")');

  // Verify completion
  await expect(page.locator('text=Next Card')).toBeVisible();
});
```

### Integration Tests

```typescript
// tests/integration/analytics.test.ts
import { trackEvent, initAnalytics } from '@/lib/analytics';
import posthog from 'posthog-js';

jest.mock('posthog-js');

describe('Analytics Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track enrollment event with correct properties', () => {
    trackEvent('course_enrolled', {
      courseId: 'C844 73',
      courseName: 'National 3 Mathematics'
    });

    expect(posthog.capture).toHaveBeenCalledWith('course_enrolled', {
      courseId: 'C844 73',
      courseName: 'National 3 Mathematics'
    });
  });

  it('should identify user on login', () => {
    identifyUser('user123', {
      email: 'test@example.com',
      yearGroup: 'S3'
    });

    expect(posthog.identify).toHaveBeenCalledWith('user123', {
      email: 'test@example.com',
      yearGroup: 'S3'
    });
  });
});

// tests/integration/error-monitoring.test.ts
import * as Sentry from '@sentry/nextjs';
import { enrollStudentInCourse } from '@/services/enrollmentService';

jest.mock('@sentry/nextjs');

describe('Error Monitoring Integration', () => {
  it('should capture enrollment errors in Sentry', async () => {
    const mockDatabases = {
      listDocuments: jest.fn().mockRejectedValue(new Error('Database error'))
    };

    await expect(
      enrollStudentInCourse('student123', 'course456', mockDatabases)
    ).rejects.toThrow();

    expect(Sentry.captureException).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { operation: 'enrollment' },
        extra: { studentId: 'student123', courseId: 'course456' }
      })
    );
  });
});
```

### Unit Tests

```typescript
// tests/unit/health-check.test.ts
import { GET } from '@/app/api/health/route';

describe('Health Check Endpoint', () => {
  it('should return healthy status when all checks pass', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true }); // LangGraph check

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.langgraph).toBe(true);
  });

  it('should return degraded status when LangGraph is down', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Connection failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.langgraph).toBe(false);
  });
});

// tests/unit/feedback-widget.test.ts
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackWidget } from '@/components/FeedbackWidget';

describe('FeedbackWidget', () => {
  it('should open feedback form when clicked', () => {
    render(<FeedbackWidget />);

    fireEvent.click(screen.getByLabelText('Send feedback'));

    expect(screen.getByText('Send Feedback')).toBeVisible();
  });

  it('should submit feedback with correct type and message', async () => {
    const mockCreate = jest.fn().mockResolvedValue({});
    jest.spyOn(databases, 'createDocument').mockImplementation(mockCreate);

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByLabelText('Send feedback'));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bug' } });
    fireEvent.change(screen.getByPlaceholderText('Tell us what you think...'), {
      target: { value: 'Test bug report' }
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        'default',
        'user_feedback',
        expect.any(String),
        expect.objectContaining({
          type: 'bug',
          message: 'Test bug report'
        })
      );
    });
  });
});
```

## Acceptance Criteria

### Deployment
- [ ] Staging environment accessible at https://staging.scottishailessons.com
- [ ] Production environment accessible at https://scottishailessons.com
- [ ] Health check endpoint returns 200 OK
- [ ] Zero downtime during deployment
- [ ] Automatic rollback on health check failure

### UAT
- [ ] At least 3 students complete full journey (signup → lesson completion)
- [ ] All UAT feedback documented and prioritized
- [ ] Critical bugs fixed before production deployment
- [ ] UAT participants rate overall experience ≥ 4/5

### Analytics
- [ ] PostHog tracking all key events (signup, enrollment, lesson completion)
- [ ] Funnels configured for onboarding and lesson engagement
- [ ] Retention cohorts tracking daily/weekly/monthly active users
- [ ] Real-time dashboard showing active sessions

### Error Monitoring
- [ ] Sentry capturing all unhandled exceptions
- [ ] Error boundaries implemented on all major components
- [ ] Performance transactions tracking key operations
- [ ] Alert rules configured for critical errors (> 10/hour)
- [ ] Session replay enabled for debugging

### Performance
- [ ] Lighthouse Performance score ≥ 90
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.9s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Core Web Vitals tracked in Vercel Analytics

### User Feedback
- [ ] Feedback widget accessible on all pages
- [ ] Feedback submissions saved to Appwrite
- [ ] Bug reports automatically sent to Sentry
- [ ] NPS survey shown to users after 7 days
- [ ] At least 10 feedback submissions collected in first week

## Deliverables

1. **Deployed Environments**
   - Staging: https://staging.scottishailessons.com
   - Production: https://scottishailessons.com

2. **Monitoring Dashboards**
   - PostHog: User analytics and funnels
   - Sentry: Error tracking and performance
   - Vercel Analytics: Core Web Vitals

3. **Documentation**
   - Deployment runbook (in `docs/deployment.md`)
   - Monitoring playbook (in `docs/monitoring.md`)
   - Rollback procedures (in `docs/rollback.md`)
   - On-call rotation schedule

4. **Feedback Collection**
   - UAT feedback summary report
   - NPS baseline score
   - User feedback categorization and prioritization

## Success Metrics

**Week 5 Goals**:
- [ ] Production deployment completed with zero critical incidents
- [ ] UAT participants complete at least 90% of test scenarios
- [ ] Average page load time < 2 seconds
- [ ] Error rate < 1% of total sessions
- [ ] At least 5 positive feedback submissions
- [ ] NPS score ≥ 7 (calculated from responses)

**Ongoing Metrics** (Post-Launch):
- Daily Active Users (DAU) growth
- Lesson completion rate
- Average mastery improvement per student
- Error rate trending down
- Page performance trending up
- User satisfaction (NPS) ≥ 8

---

## Outside-In TDD Approach

### Testing Pyramid for Phase 5

```
    /\
   /  \    1 E2E (Critical path: Signup → Lesson)
  /____\
 /      \   3 Integration (Analytics, Sentry, Health Check)
/________\
/          \ 15 Unit (Components, Services, Utilities)
/__________\
```

### Test Development Order

1. **Start with E2E acceptance test** (production.spec.ts)
   - Write failing test for complete user journey
   - This drives staging/production setup

2. **Add integration tests** (analytics.test.ts, error-monitoring.test.ts)
   - Test PostHog integration
   - Test Sentry integration
   - Test health check with real dependencies

3. **Finish with unit tests** (feedback-widget.test.ts, health-check.test.ts)
   - Test individual components in isolation
   - Mock external dependencies
   - Fast, focused tests

### Manual Testing with Playwright MCP

All deployment steps should be verified manually:
1. Deploy to staging
2. Run smoke tests via Playwright MCP
3. Conduct UAT sessions
4. Deploy to production
5. Run production smoke tests
6. Verify all monitoring dashboards

---

**References**:
- Parent Spec: [MVP2_user_journey.md](./MVP2_user_journey.md)
- Phase 1: [Core Infrastructure](./MVP2_user_journey_phase_1_core_infrastructure.md)
- Phase 2: [Onboarding & Discovery](./MVP2_user_journey_phase_2_onboarding_discovery.md)
- Phase 3: [Progress Tracking](./MVP2_user_journey_phase_3_progress_tracking.md)
- Phase 4: [Polish & Testing](./MVP2_user_journey_phase_4_polish_testing.md)
