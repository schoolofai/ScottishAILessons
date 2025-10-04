# MVP2.6 Course Enrollment Page Implementation Specification

**Status:** Planning
**Priority:** High
**Estimated Time:** ~4 hours
**Dependencies:** MVP2.5 Database Schema (Authored_SOW, SOWV2 updates)

---

## Overview

Create a dedicated enrollment page where students can browse available courses (published Authored_SOWs), view course details, and enroll. Upon enrollment, the system creates an enrollment record and copies the Authored_SOW to a student-specific SOWV2 document, then redirects to the dashboard.

**Key Goals:**
- Replace auto-enrollment with user-driven course selection
- Provide clear course information before enrollment
- Ensure proper data flow: Authored_SOW → Enrollment + SOWV2
- Integrate seamlessly with existing dashboard

---

## User Journey

### **STEP 1: Discovery (Enrollment Page)**
```
Student → Login → Redirected to /enrollments (if no enrollments)
                → View course catalog cards
                → Filter by subject/level
                → Click "View Details" on course card
```

### **STEP 2: Course Details Modal**
```
Student → See course metadata (title, subject, level, weeks, outcomes)
        → See accessibility features
        → See estimated time commitment
        → Click "Enroll in Course" button
```

### **STEP 3: Enrollment Processing**
```
System → Validate: No existing enrollment
       → Create enrollment record
       → Copy Authored_SOW → SOWV2
       → Show success toast
       → Redirect to /dashboard
```

### **STEP 4: Dashboard Integration**
```
Dashboard → Display enrolled courses in navigation tabs
          → Load recommendations for active course
          → Show course progress
```

---

## Wireframes

### Enrollment Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] Scottish AI Lessons              [User Menu ▼]      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Discover Your Courses                                        │
│  Browse and enroll in SQA-aligned mathematics courses         │
│                                                               │
│  [🔍 Search courses...]  [Subject ▼] [Level ▼]              │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 📊 Nat 3     │  │ 📊 Nat 4     │  │ 📊 Nat 5     │      │
│  │ Applications │  │ Applications │  │ Applications │      │
│  │ of Maths     │  │ of Maths     │  │ of Maths     │      │
│  │              │  │              │  │              │      │
│  │ 38 weeks     │  │ 40 weeks     │  │ 42 weeks     │      │
│  │ 3×50min/wk   │  │ 3×50min/wk   │  │ 3×50min/wk   │      │
│  │              │  │              │  │              │      │
│  │ ✓ Dyslexia   │  │ ✓ Dyslexia   │  │ ✓ Dyslexia   │      │
│  │   friendly   │  │   friendly   │  │   friendly   │      │
│  │              │  │              │  │              │      │
│  │ [View Details│  │ [View Details│  │ [View Details│      │
│  │     ▶]       │  │     ▶]       │  │     ▶]       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  No courses available? Contact support.                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Course Details Modal
```
┌─────────────────────────────────────────────────────────┐
│  Applications of Mathematics - National 3          [✕]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📚 Course Overview                                      │
│  SQA Code: C844 73                                       │
│  Subject: Applications of Mathematics                    │
│  Level: National 3                                       │
│  Version: 1 (Published)                                  │
│                                                          │
│  📅 Time Commitment                                      │
│  Duration: 38 weeks                                      │
│  Frequency: 3 periods per week                           │
│  Period Length: 50 minutes                               │
│  Total Lessons: 88                                       │
│                                                          │
│  🎯 Learning Outcomes                                    │
│  This course covers 3 main units:                        │
│  • Managing Money and Data (23 lessons)                  │
│  • Measurement (42 lessons)                              │
│  • Mathematics in Context (23 lessons)                   │
│                                                          │
│  📖 Course Structure                                     │
│  • Teaching lessons: 60%                                 │
│  • Practice & revision: 25%                              │
│  • Assessments: 15%                                      │
│                                                          │
│  ♿ Accessibility Features                                │
│  ✓ Dyslexia-friendly design                             │
│  ✓ Plain language (CEFR A2 level)                       │
│  ✓ Extra time provisions                                 │
│  ✓ Clear visual layout                                   │
│                                                          │
│  ⚠️ Prerequisites                                         │
│  None - This is an entry-level course                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  [Cancel]        [Enroll in Course →]          │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Success Toast Notification
```
┌─────────────────────────────────────┐
│ ✓ Successfully enrolled!            │
│ You can now start learning in       │
│ Applications of Mathematics.        │
└─────────────────────────────────────┘
```

---

## Architecture & Data Flow

### Data Flow Diagram
```
┌─────────────────┐
│ Enrollment Page │
│  (User Action)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /api/      │
│  enrollments    │
└────────┬────────┘
         │
         ├─── 1. Fetch Authored_SOW (published, by courseId)
         │       AuthoredSOWDriver.getPublishedSOW()
         │
         ├─── 2. Validate (no duplicate enrollment)
         │       EnrollmentDriver.getEnrollment()
         │
         ├─── 3. Create Enrollment Record
         │       EnrollmentDriver.create()
         │       (studentId + courseId + status)
         │
         ├─── 4. Copy Authored_SOW → SOWV2
         │       SOWDriver.copyFromAuthoredSOW()
         │       (transform entries format)
         │
         └─── 5. Return success
                │
                ▼
         ┌─────────────┐
         │  Dashboard  │
         │  (Redirect) │
         └─────────────┘
```

### Component Hierarchy
```
EnrollmentsPage
├── Header
├── EnrollmentFilters
│   ├── SearchInput
│   ├── SubjectFilter
│   └── LevelFilter
├── EnrollmentGrid
│   └── CourseCard (multiple)
│       ├── Card
│       ├── Badge (status)
│       └── Button (View Details)
└── CourseDetailsModal
    ├── CourseMetadata
    ├── TimeCommitment
    ├── LearningOutcomes
    ├── AccessibilityInfo
    └── EnrollButton
```

---

## Phase 1: Backend - Drivers & API Routes

### 1.1 Create EnrollmentDriver

**File:** `assistant-ui-frontend/lib/appwrite/driver/EnrollmentDriver.ts` (NEW)

```typescript
import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { SOWDriver } from './SOWDriver';
import type { Enrollment } from '../types';
import type { AuthoredSOWData } from '../types';

/**
 * Enrollment driver handling course enrollment operations
 * Coordinates between Enrollment, Authored_SOW, and SOWV2 collections
 */
export class EnrollmentDriver extends BaseDriver {
  /**
   * Enroll student in a course (atomic operation)
   * Creates enrollment record + SOWV2 copy
   */
  async enrollInCourse(
    studentId: string,
    courseId: string,
    authoredSOW: AuthoredSOWData
  ): Promise<{ enrollment: Enrollment; sow: any }> {
    // 1. Check for existing enrollment - FAST FAIL if duplicate
    const existing = await this.getEnrollment(studentId, courseId);
    if (existing) {
      throw new Error(
        `Student ${studentId} is already enrolled in course ${courseId}`
      );
    }

    // 2. Create enrollment record
    const enrollmentData = {
      studentId,
      courseId,
      enrolledAt: new Date().toISOString(),
      status: 'active' as const
    };

    const enrollment = await this.create<Enrollment>(
      'enrollments',
      enrollmentData,
      []
    );

    // 3. Copy Authored_SOW to SOWV2 (student-specific copy)
    const sowDriver = new SOWDriver(this.databases);
    const sow = await sowDriver.copyFromAuthoredSOW(
      studentId,
      courseId,
      authoredSOW
    );

    return { enrollment, sow };
  }

  /**
   * Get enrollment for student and course
   */
  async getEnrollment(
    studentId: string,
    courseId: string
  ): Promise<Enrollment | null> {
    const enrollments = await this.list<Enrollment>('enrollments', [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.limit(1)
    ]);

    return enrollments.length > 0 ? enrollments[0] : null;
  }

  /**
   * Get all enrollments for a student
   */
  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    return await this.list<Enrollment>('enrollments', [
      Query.equal('studentId', studentId),
      Query.equal('status', 'active')
    ]);
  }

  /**
   * Unenroll student from course (set status to withdrawn)
   */
  async unenrollFromCourse(
    studentId: string,
    courseId: string
  ): Promise<Enrollment> {
    const enrollment = await this.getEnrollment(studentId, courseId);

    if (!enrollment) {
      throw new Error(
        `No enrollment found for student ${studentId} in course ${courseId}`
      );
    }

    return await this.update<Enrollment>('enrollments', enrollment.$id, {
      status: 'withdrawn'
    });
  }
}
```

### 1.2 Update AuthoredSOWDriver

**File:** `assistant-ui-frontend/lib/appwrite/driver/AuthoredSOWDriver.ts` (UPDATE)

Add new method to list all published courses:

```typescript
/**
 * List all published Authored_SOWs (for enrollment page)
 */
async listPublishedCourses(): Promise<AuthoredSOWData[]> {
  const records = await this.list<AuthoredSOW>('Authored_SOW', [
    Query.equal('status', 'published'),
    Query.orderAsc('courseId')
  ]);

  return records.map(r => ({
    courseId: r.courseId,
    version: r.version,
    status: r.status,
    entries: JSON.parse(r.entries),
    metadata: JSON.parse(r.metadata),
    accessibility_notes: r.accessibility_notes
  }));
}

/**
 * Get course summary for enrollment card (lightweight)
 */
async getCourseSummary(courseId: string): Promise<any> {
  const sow = await this.getPublishedSOW(courseId);

  if (!sow) {
    return null;
  }

  return {
    courseId: sow.courseId,
    version: sow.version,
    totalLessons: sow.entries.length,
    weeks: sow.metadata.weeks,
    periodsPerWeek: sow.metadata.periods_per_week,
    accessibility_notes: sow.accessibility_notes,
    // Extract lesson type counts for breakdown
    lessonTypeBreakdown: sow.entries.reduce((acc, entry) => {
      acc[entry.lesson_type] = (acc[entry.lesson_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}
```

### 1.3 Update SOWDriver

**File:** `assistant-ui-frontend/lib/appwrite/driver/SOWDriver.ts` (UPDATE - from MVP2.5 spec)

Ensure `copyFromAuthoredSOW` method exists:

```typescript
/**
 * Copy Authored SOW to student enrollment
 * Called when student enrolls in a course
 */
async copyFromAuthoredSOW(
  studentId: string,
  courseId: string,
  authoredSOW: AuthoredSOWData
): Promise<any> {
  // Convert AuthoredSOWEntry[] to SOWEntry[] format
  const entries = authoredSOW.entries.map((entry, idx) => ({
    order: entry.order,
    lessonTemplateId: entry.lessonTemplateRef,
    plannedAt: undefined,
    // Store original metadata for reference
    _metadata: {
      label: entry.label,
      lesson_type: entry.lesson_type,
      estMinutes: entry.estMinutes
    }
  }));

  const sowData = {
    studentId,
    courseId,
    entries: JSON.stringify(entries),
    createdAt: new Date().toISOString(),
    source_sow_id: authoredSOW.courseId, // Track source
    source_version: authoredSOW.version,
    customizations: JSON.stringify({}) // Empty initially
  };

  return await this.create('SOWV2', sowData, []);
}
```

### 1.4 Create API Routes

**File:** `assistant-ui-frontend/app/api/enrollments/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Account, Query } from 'appwrite';
import { EnrollmentDriver } from '@/lib/appwrite/driver/EnrollmentDriver';
import { AuthoredSOWDriver } from '@/lib/appwrite/driver/AuthoredSOWDriver';

/**
 * POST /api/enrollments
 * Enroll student in a course
 */
export async function POST(request: NextRequest) {
  try {
    const { studentId, courseId } = await request.json();

    // Validate input
    if (!studentId || !courseId) {
      return NextResponse.json(
        { error: 'studentId and courseId are required' },
        { status: 400 }
      );
    }

    // Initialize client with session
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    const databases = new Databases(client);

    // 1. Get published Authored_SOW for the course
    const authoredDriver = new AuthoredSOWDriver(databases);
    const authoredSOW = await authoredDriver.getPublishedSOW(courseId);

    if (!authoredSOW) {
      return NextResponse.json(
        { error: `No published course found for courseId: ${courseId}` },
        { status: 404 }
      );
    }

    // 2. Enroll student (creates enrollment + SOWV2)
    const enrollmentDriver = new EnrollmentDriver(databases);
    const result = await enrollmentDriver.enrollInCourse(
      studentId,
      courseId,
      authoredSOW
    );

    return NextResponse.json({
      success: true,
      enrollment: result.enrollment,
      sow: result.sow
    });
  } catch (error: any) {
    console.error('[Enrollment API] Error:', error);

    // Handle duplicate enrollment
    if (error.message.includes('already enrolled')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 } // Conflict
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to enroll in course' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enrollments?studentId=xxx
 * Get enrollments for a student
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId query parameter is required' },
        { status: 400 }
      );
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    const databases = new Databases(client);
    const enrollmentDriver = new EnrollmentDriver(databases);

    const enrollments = await enrollmentDriver.getStudentEnrollments(studentId);

    return NextResponse.json({ enrollments });
  } catch (error: any) {
    console.error('[Enrollment API GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enrollments' },
      { status: 500 }
    );
  }
}
```

**File:** `assistant-ui-frontend/app/api/enrollments/available/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'appwrite';
import { AuthoredSOWDriver } from '@/lib/appwrite/driver/AuthoredSOWDriver';

/**
 * GET /api/enrollments/available
 * Get all available courses (published Authored_SOWs)
 */
export async function GET(request: NextRequest) {
  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    const databases = new Databases(client);

    // Get all published Authored_SOWs
    const authoredDriver = new AuthoredSOWDriver(databases);
    const publishedCourses = await authoredDriver.listPublishedCourses();

    // Get course metadata from courses collection
    const courseIds = publishedCourses.map(sow => sow.courseId);
    const coursesResult = await databases.listDocuments('default', 'courses', [
      Query.equal('courseId', courseIds)
    ]);

    // Merge Authored_SOW data with course metadata
    const availableCourses = publishedCourses.map(sow => {
      const courseInfo = coursesResult.documents.find(
        c => c.courseId === sow.courseId
      );

      return {
        courseId: sow.courseId,
        title: courseInfo?.title || 'Unknown Course',
        subject: courseInfo?.subject || 'Mathematics',
        level: courseInfo?.level || 'Unknown',
        sqaCode: courseInfo?.sqaCode || '',
        version: sow.version,
        totalLessons: sow.entries.length,
        weeks: sow.metadata.weeks || 38,
        periodsPerWeek: sow.metadata.periods_per_week || 3,
        accessibility_notes: sow.accessibility_notes || '',
        lessonTypeBreakdown: sow.entries.reduce((acc, entry) => {
          acc[entry.lesson_type] = (acc[entry.lesson_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    });

    return NextResponse.json({
      success: true,
      courses: availableCourses
    });
  } catch (error: any) {
    console.error('[Available Courses API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available courses' },
      { status: 500 }
    );
  }
}
```

---

## Phase 2: Frontend - Components

### 2.1 Create CourseCard Component

**File:** `assistant-ui-frontend/components/enrollments/CourseCard.tsx` (NEW)

```typescript
'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, Calendar, Accessibility } from 'lucide-react';

export interface CourseCardData {
  courseId: string;
  title: string;
  subject: string;
  level: string;
  sqaCode?: string;
  totalLessons: number;
  weeks: number;
  periodsPerWeek: number;
  accessibility_notes?: string;
  lessonTypeBreakdown: Record<string, number>;
}

export interface CourseCardProps {
  course: CourseCardData;
  onViewDetails: (course: CourseCardData) => void;
}

export function CourseCard({ course, onViewDetails }: CourseCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <Badge variant="secondary">{course.level}</Badge>
          {course.sqaCode && (
            <span className="text-xs text-gray-500">{course.sqaCode}</span>
          )}
        </div>
        <CardTitle className="text-lg mt-2">{course.title}</CardTitle>
        <p className="text-sm text-gray-600">{course.subject}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Duration */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span>{course.weeks} weeks</span>
        </div>

        {/* Time commitment */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-blue-600" />
          <span>
            {course.periodsPerWeek}×50min/week
          </span>
        </div>

        {/* Total lessons */}
        <div className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span>{course.totalLessons} lessons</span>
        </div>

        {/* Accessibility */}
        {course.accessibility_notes && (
          <div className="flex items-center gap-2 text-sm">
            <Accessibility className="h-4 w-4 text-green-600" />
            <span className="text-green-700">Accessibility features</span>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button
          onClick={() => onViewDetails(course)}
          className="w-full"
          variant="default"
        >
          View Details →
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### 2.2 Create CourseDetailsModal Component

**File:** `assistant-ui-frontend/components/enrollments/CourseDetailsModal.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Calendar, Clock, Accessibility, Target } from 'lucide-react';
import type { CourseCardData } from './CourseCard';

export interface CourseDetailsModalProps {
  course: CourseCardData | null;
  onClose: () => void;
  onEnroll: (courseId: string) => Promise<void>;
}

export function CourseDetailsModal({
  course,
  onClose,
  onEnroll
}: CourseDetailsModalProps) {
  const [enrolling, setEnrolling] = useState(false);

  if (!course) return null;

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      await onEnroll(course.courseId);
      onClose();
    } catch (error) {
      console.error('Enrollment failed:', error);
    } finally {
      setEnrolling(false);
    }
  };

  // Calculate lesson breakdown percentages
  const totalLessons = course.totalLessons;
  const teachingLessons = course.lessonTypeBreakdown['teach'] || 0;
  const practiceLessons =
    (course.lessonTypeBreakdown['independent_practice'] || 0) +
    (course.lessonTypeBreakdown['revision'] || 0) +
    (course.lessonTypeBreakdown['spiral_revisit'] || 0);
  const assessmentLessons =
    (course.lessonTypeBreakdown['formative_assessment'] || 0) +
    (course.lessonTypeBreakdown['mock_assessment'] || 0) +
    (course.lessonTypeBreakdown['summative_assessment'] || 0);

  const teachingPercent = Math.round((teachingLessons / totalLessons) * 100);
  const practicePercent = Math.round((practiceLessons / totalLessons) * 100);
  const assessmentPercent = Math.round((assessmentLessons / totalLessons) * 100);

  return (
    <Dialog open={!!course} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{course.title}</DialogTitle>
            <Badge>{course.level}</Badge>
          </div>
          {course.sqaCode && (
            <DialogDescription>SQA Code: {course.sqaCode}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Course Overview */}
          <section>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              📚 Course Overview
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium">Subject:</dt>
                <dd>{course.subject}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Level:</dt>
                <dd>{course.level}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Status:</dt>
                <dd>
                  <Badge variant="secondary">Published</Badge>
                </dd>
              </div>
            </dl>
          </section>

          {/* Time Commitment */}
          <section>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Time Commitment
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium">Duration:</dt>
                <dd>{course.weeks} weeks</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Frequency:</dt>
                <dd>{course.periodsPerWeek} periods per week</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Period Length:</dt>
                <dd>50 minutes</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Total Lessons:</dt>
                <dd>{course.totalLessons}</dd>
              </div>
            </dl>
          </section>

          {/* Course Structure */}
          <section>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Course Structure
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Teaching lessons:</span>
                <span className="font-medium">{teachingPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span>Practice & revision:</span>
                <span className="font-medium">{practicePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span>Assessments:</span>
                <span className="font-medium">{assessmentPercent}%</span>
              </div>
            </div>
          </section>

          {/* Accessibility Features */}
          {course.accessibility_notes && (
            <section>
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Accessibility className="h-5 w-5 text-green-600" />
                Accessibility Features
              </h3>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Dyslexia-friendly design</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Plain language (CEFR A2 level)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Extra time provisions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Clear visual layout</span>
                </li>
              </ul>
              <p className="text-sm text-gray-600 mt-2">
                {course.accessibility_notes}
              </p>
            </section>
          )}

          {/* Prerequisites */}
          <section>
            <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Prerequisites
            </h3>
            <p className="text-sm text-gray-600">
              None - This is an entry-level course suitable for all students.
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enrolling}>
            Cancel
          </Button>
          <Button onClick={handleEnroll} disabled={enrolling}>
            {enrolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              'Enroll in Course →'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 2.3 Create EnrollmentGrid Component

**File:** `assistant-ui-frontend/components/enrollments/EnrollmentGrid.tsx` (NEW)

```typescript
'use client';

import { CourseCard, type CourseCardData } from './CourseCard';

export interface EnrollmentGridProps {
  courses: CourseCardData[];
  onViewDetails: (course: CourseCardData) => void;
}

export function EnrollmentGrid({ courses, onViewDetails }: EnrollmentGridProps) {
  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No courses available</p>
        <p className="text-gray-400 text-sm mt-2">
          Check back soon or contact support for more information.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      data-testid="enrollment-grid"
    >
      {courses.map(course => (
        <CourseCard
          key={course.courseId}
          course={course}
          onViewDetails={onViewDetails}
        />
      ))}
    </div>
  );
}
```

### 2.4 Create EnrollmentFilters Component

**File:** `assistant-ui-frontend/components/enrollments/EnrollmentFilters.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Search } from 'lucide-react';

export interface EnrollmentFiltersProps {
  onFilterChange: (filters: {
    search: string;
    subject: string;
    level: string;
  }) => void;
}

export function EnrollmentFilters({ onFilterChange }: EnrollmentFiltersProps) {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('all');
  const [level, setLevel] = useState('all');

  const handleFilterChange = (
    newSearch?: string,
    newSubject?: string,
    newLevel?: string
  ) => {
    const filters = {
      search: newSearch ?? search,
      subject: newSubject ?? subject,
      level: newLevel ?? level
    };

    setSearch(filters.search);
    setSubject(filters.subject);
    setLevel(filters.level);

    onFilterChange(filters);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={e => handleFilterChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Subject Filter */}
      <Select value={subject} onValueChange={val => handleFilterChange(undefined, val)}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Subject" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Subjects</SelectItem>
          <SelectItem value="Applications of Mathematics">
            Applications of Maths
          </SelectItem>
          <SelectItem value="Mathematics">Mathematics</SelectItem>
        </SelectContent>
      </Select>

      {/* Level Filter */}
      <Select value={level} onValueChange={val => handleFilterChange(undefined, undefined, val)}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Levels</SelectItem>
          <SelectItem value="National 3">National 3</SelectItem>
          <SelectItem value="National 4">National 4</SelectItem>
          <SelectItem value="National 5">National 5</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

### 2.5 Create Enrollments Page

**File:** `assistant-ui-frontend/app/(protected)/enrollments/page.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/ui/header';
import { EnrollmentFilters } from '@/components/enrollments/EnrollmentFilters';
import { EnrollmentGrid } from '@/components/enrollments/EnrollmentGrid';
import { CourseDetailsModal } from '@/components/enrollments/CourseDetailsModal';
import type { CourseCardData } from '@/components/enrollments/CourseCard';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Client, Databases, Account } from 'appwrite';

export default function EnrollmentsPage() {
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CourseCardData[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Initialize student
  useEffect(() => {
    initializeStudent();
  }, []);

  const initializeStudent = async () => {
    try {
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

      const account = new Account(client);
      const databases = new Databases(client);

      const user = await account.get();

      // Get student record
      const { Query } = await import('appwrite');
      const studentsResult = await databases.listDocuments('default', 'students', [
        Query.equal('userId', user.$id)
      ]);

      if (studentsResult.documents.length > 0) {
        setStudent(studentsResult.documents[0]);
      }

      // Load available courses
      await loadCourses();
    } catch (err) {
      console.error('Failed to initialize:', err);
      setError(err instanceof Error ? err.message : 'Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const response = await fetch('/api/enrollments/available');

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();
      setCourses(data.courses);
      setFilteredCourses(data.courses);
    } catch (err) {
      console.error('Failed to load courses:', err);
      throw err;
    }
  };

  const handleFilterChange = useCallback(
    (filters: { search: string; subject: string; level: string }) => {
      let filtered = [...courses];

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(
          course =>
            course.title.toLowerCase().includes(searchLower) ||
            course.subject.toLowerCase().includes(searchLower) ||
            course.sqaCode?.toLowerCase().includes(searchLower)
        );
      }

      // Subject filter
      if (filters.subject !== 'all') {
        filtered = filtered.filter(course => course.subject === filters.subject);
      }

      // Level filter
      if (filters.level !== 'all') {
        filtered = filtered.filter(course => course.level === filters.level);
      }

      setFilteredCourses(filtered);
    },
    [courses]
  );

  const handleEnroll = async (courseId: string) => {
    if (!student) {
      setError('Student not found. Please refresh the page.');
      return;
    }

    try {
      const response = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.$id,
          courseId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enroll');
      }

      // Success! Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Enrollment failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to enroll');
    }
  };

  if (loading) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading courses...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="container mx-auto p-6">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="container mx-auto p-6">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Discover Your Courses</h1>
            <p className="text-gray-600">
              Browse and enroll in SQA-aligned mathematics courses
            </p>
          </div>

          {/* Filters */}
          <EnrollmentFilters onFilterChange={handleFilterChange} />

          {/* Course Grid */}
          <EnrollmentGrid
            courses={filteredCourses}
            onViewDetails={setSelectedCourse}
          />

          {/* Course Details Modal */}
          <CourseDetailsModal
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            onEnroll={handleEnroll}
          />
        </div>
      </main>
    </div>
  );
}
```

---

## Phase 3: Dashboard Integration

### 3.1 Update EnhancedStudentDashboard

**File:** `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx` (UPDATE)

**Remove auto-enrollment logic (lines 138-163):**

```typescript
// REMOVE THIS BLOCK:
if (enrollmentsResult.documents.length === 0) {
  const { ID } = await import('appwrite');
  // Auto-enroll in National 3 course
  await databases.createDocument(
    'default',
    'enrollments',
    ID.unique(),
    {
      studentId: student.$id,
      courseId: 'C844 73',
      role: 'student'
    },
    [`read("user:${student.userId}")`, `write("user:${student.userId}")`]
  );
}
```

**Add enrollment check and redirect:**

```typescript
// Add after line 121 (after student is set):

// Check if student has any enrollments
const enrollmentsResult = await databases.listDocuments(
  'default',
  'enrollments',
  [
    Query.equal('studentId', student.$id),
    Query.equal('status', 'active')
  ]
);

// Redirect to enrollments page if no active enrollments
if (enrollmentsResult.documents.length === 0) {
  router.push('/enrollments');
  return;
}
```

---

## Phase 4: Type Updates

### 4.1 Add Dialog Component (if missing)

**File:** `assistant-ui-frontend/components/ui/dialog.tsx` (NEW - if not exists)

Use shadcn/ui dialog component:

```bash
npx shadcn-ui@latest add dialog
```

### 4.2 Add Select Component (if missing)

**File:** `assistant-ui-frontend/components/ui/select.tsx` (NEW - if not exists)

Use shadcn/ui select component:

```bash
npx shadcn-ui@latest add select
```

### 4.3 Add Toast for Success Notifications (Optional)

**File:** `assistant-ui-frontend/components/ui/use-toast.ts` (NEW - if not exists)

Use shadcn/ui toast component:

```bash
npx shadcn-ui@latest add toast
```

---

## Testing Plan

### Manual Testing Checklist

1. **Enrollment Page Load**
   - [ ] Page loads without errors
   - [ ] All published courses display as cards
   - [ ] Course cards show correct metadata

2. **Filtering**
   - [ ] Search filter works
   - [ ] Subject dropdown filters correctly
   - [ ] Level dropdown filters correctly
   - [ ] Filters can be combined

3. **Course Details Modal**
   - [ ] Modal opens on "View Details" click
   - [ ] All course information displays correctly
   - [ ] Accessibility features show if available
   - [ ] Modal can be closed

4. **Enrollment Flow**
   - [ ] "Enroll in Course" button triggers API call
   - [ ] Enrollment record created in database
   - [ ] SOWV2 document created with correct entries
   - [ ] Redirect to dashboard after success
   - [ ] Error handling for duplicate enrollment

5. **Dashboard Integration**
   - [ ] Dashboard shows enrolled courses
   - [ ] Auto-enrollment removed
   - [ ] Redirect to enrollments if no enrollments exist

### API Testing

```bash
# Test available courses endpoint
curl http://localhost:3000/api/enrollments/available

# Test enrollment endpoint
curl -X POST http://localhost:3000/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId": "xxx", "courseId": "C844 73"}'

# Test get enrollments
curl http://localhost:3000/api/enrollments?studentId=xxx
```

---

## Success Criteria

- [ ] Enrollment page accessible at `/enrollments`
- [ ] Lists all published Authored_SOWs as cards
- [ ] Course details modal shows complete metadata
- [ ] Enrollment creates both enrollment record + SOWV2 copy
- [ ] Dashboard shows only enrolled courses
- [ ] No auto-enrollment - user-driven only
- [ ] Error handling for duplicate enrollments
- [ ] Proper error messages for all failure cases
- [ ] Responsive design (mobile, tablet, desktop)

---

## Files Summary

### New Files (11)
1. `lib/appwrite/driver/EnrollmentDriver.ts`
2. `app/api/enrollments/route.ts`
3. `app/api/enrollments/available/route.ts`
4. `app/(protected)/enrollments/page.tsx`
5. `components/enrollments/CourseCard.tsx`
6. `components/enrollments/CourseDetailsModal.tsx`
7. `components/enrollments/EnrollmentGrid.tsx`
8. `components/enrollments/EnrollmentFilters.tsx`
9. `components/ui/dialog.tsx` (if missing)
10. `components/ui/select.tsx` (if missing)
11. `components/ui/use-toast.ts` (optional)

### Modified Files (2)
1. `components/dashboard/EnhancedStudentDashboard.tsx`
2. `lib/appwrite/driver/AuthoredSOWDriver.ts`

---

## Risk Mitigation

### Error Handling Strategy
1. **No Silent Failures**: All errors throw exceptions with detailed messages
2. **User Feedback**: Toast notifications for success/error states
3. **Validation**: Check for duplicate enrollments before creating
4. **Rollback**: If SOWV2 copy fails, enrollment should also fail (atomic operation)

### Backward Compatibility
- Existing enrollments continue to work
- Dashboard remains functional for already-enrolled students
- No breaking changes to Authored_SOW or SOWV2 schemas

---

## Implementation Order

1. **Backend First** (Phase 1): Drivers + API routes
2. **Component Library** (Phase 2): UI components
3. **Page Integration** (Phase 2): Enrollments page
4. **Dashboard Updates** (Phase 3): Remove auto-enrollment
5. **Testing** (Phase 4): Manual + API testing

---

## Notes

- Follows existing driver pattern from MVP2.5
- Uses shadcn/ui components for consistency
- No fallback mechanisms - fast fail with errors
- Client-side rendering for enrollment page (uses 'use client')
- API routes handle server-side database operations
- Session management via Appwrite cookies/localStorage
