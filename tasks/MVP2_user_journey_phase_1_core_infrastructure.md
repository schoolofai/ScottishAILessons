# MVP2 Phase 1: Core Infrastructure

**Phase Duration**: Week 1 (5 working days)
**Dependencies**: Appwrite database, SOWV2 reference architecture
**Parent Spec**: [MVP2_user_journey.md](./MVP2_user_journey.md)

---

## Overview

This phase establishes the foundational services and data flows that enable proper enrollment management. The core change is implementing the **SOWV2 reference architecture** where enrollment creates a lightweight pointer to Authored_SOW instead of duplicating curriculum data.

**Key Deliverables**:
- ✅ Enrollment service with full pipeline (enrollment → SOWV2 → MasteryV2)
- ✅ Progress service for metrics calculation
- ✅ Dashboard filtering by enrollments only
- ✅ Appwrite indexes for enrollment queries
- ✅ Unit tests for all services
- ✅ Integration tests for enrollment pipeline

---

## Architecture Changes

### Current State (MVP1)

```typescript
// Dashboard loads ALL courses
const coursesResult = await databases.listDocuments('default', 'courses');
setCourses(coursesResult.documents);  // Shows everything!

// Auto-enrollment creates only enrollment record
if (enrollmentsResult.documents.length === 0) {
  await databases.createDocument('default', 'enrollments', ID.unique(), {
    studentId: student.$id,
    courseId: 'C844 73'  // Hardcoded!
  });
}
// Missing: SOWV2 creation, MasteryV2 initialization
```

### Target State (MVP2)

```typescript
// Dashboard loads ENROLLED courses only
const enrollments = await databases.listDocuments('default', 'enrollments',
  [Query.equal('studentId', student.$id)]
);

const enrolledCourseIds = enrollments.documents.map(e => e.courseId);

if (enrolledCourseIds.length === 0) {
  router.push('/courses/catalog');  // No courses? Go browse!
  return;
}

const coursesResult = await databases.listDocuments('default', 'courses',
  [Query.equal('courseId', enrolledCourseIds)]
);
setCourses(coursesResult.documents);  // Only enrolled!

// Enrollment service creates COMPLETE pipeline
await enrollStudentInCourse(studentId, courseId, databases);
// → Creates: enrollment + SOWV2 (reference) + MasteryV2
```

---

## Implementation Specifications

### 1. Enrollment Service

**File**: `assistant-ui-frontend/lib/services/enrollment-service.ts`

**Purpose**: Complete enrollment pipeline with SOWV2 reference architecture

#### Interface

```typescript
export interface EnrollmentResult {
  enrollment: Enrollment;
  sowv2: SOWV2;
  masteryv2: MasteryV2;
  authoredSOW: AuthoredSOW;  // For verification
}

export interface EnrollmentError {
  code: 'DUPLICATE_ENROLLMENT' | 'NO_AUTHORED_SOW' | 'DATABASE_ERROR';
  message: string;
  details?: any;
}

/**
 * Enrolls a student in a course, creating the complete enrollment pipeline.
 *
 * Pipeline:
 * 1. Check for existing enrollment (fast-fail if duplicate)
 * 2. Create enrollment record
 * 3. Get latest published Authored_SOW
 * 4. Create SOWV2 reference (NOT copy - stores pointer only)
 * 5. Initialize MasteryV2 with empty EMA map
 *
 * @throws {EnrollmentError} If enrollment fails at any step
 */
export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<EnrollmentResult>;

/**
 * Checks if student is already enrolled in course.
 */
export async function checkEnrollmentExists(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<boolean>;

/**
 * Unenrolls a student from a course (cleanup all related records).
 *
 * Deletes in order:
 * 1. Sessions (if no evidence exists)
 * 2. MasteryV2
 * 3. SOWV2
 * 4. Enrollment
 */
export async function unenrollStudentFromCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<void>;
```

#### Implementation (Outside-In TDD)

**Test First**: `enrollment-service.test.ts`

```typescript
describe('enrollStudentInCourse', () => {
  // ACCEPTANCE TEST: Full enrollment pipeline
  it('should create enrollment, SOWV2 reference, and MasteryV2', async () => {
    const result = await enrollStudentInCourse(
      'student-123',
      'course_c84473',
      mockDatabases
    );

    // Verify enrollment created
    expect(result.enrollment.studentId).toBe('student-123');
    expect(result.enrollment.courseId).toBe('course_c84473');
    expect(result.enrollment.role).toBe('student');

    // Verify SOWV2 reference (NOT copy!)
    expect(result.sowv2.source_authored_sow_id).toBe(result.authoredSOW.$id);
    expect(result.sowv2.source_version).toBe(result.authoredSOW.version);
    expect(result.sowv2.customizations).toBe('{}');
    expect(result.sowv2).not.toHaveProperty('entries');  // No duplication!

    // Verify MasteryV2 initialized
    const emaByOutcome = JSON.parse(result.masteryv2.emaByOutcome);
    expect(Object.keys(emaByOutcome).length).toBeGreaterThan(0);
    expect(Object.values(emaByOutcome).every(v => v === 0.0)).toBe(true);
  });

  // ERROR HANDLING: Duplicate enrollment
  it('should throw DUPLICATE_ENROLLMENT if already enrolled', async () => {
    // Setup: Create existing enrollment
    await mockDatabases.createDocument('default', 'enrollments', ID.unique(), {
      studentId: 'student-123',
      courseId: 'course_c84473',
      role: 'student'
    });

    await expect(
      enrollStudentInCourse('student-123', 'course_c84473', mockDatabases)
    ).rejects.toMatchObject({
      code: 'DUPLICATE_ENROLLMENT',
      message: expect.stringContaining('already enrolled')
    });
  });

  // ERROR HANDLING: Missing Authored_SOW
  it('should throw NO_AUTHORED_SOW if curriculum template missing', async () => {
    // Setup: No Authored_SOW for course
    mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [] });

    await expect(
      enrollStudentInCourse('student-123', 'invalid-course', mockDatabases)
    ).rejects.toMatchObject({
      code: 'NO_AUTHORED_SOW',
      message: expect.stringContaining('No published Authored_SOW')
    });
  });

  // ROLLBACK: Transaction failure
  it('should rollback enrollment if SOWV2 creation fails', async () => {
    // Setup: Enrollment succeeds, but SOWV2 creation fails
    mockDatabases.createDocument
      .mockResolvedValueOnce({ $id: 'enrollment-123' })  // Enrollment OK
      .mockRejectedValueOnce(new Error('SOWV2 creation failed'));  // SOWV2 fails

    await expect(
      enrollStudentInCourse('student-123', 'course_c84473', mockDatabases)
    ).rejects.toThrow();

    // Verify enrollment was deleted (rollback)
    expect(mockDatabases.deleteDocument).toHaveBeenCalledWith(
      'default',
      'enrollments',
      'enrollment-123'
    );
  });
});
```

**Implementation**: `enrollment-service.ts`

```typescript
import { Databases, ID, Query } from 'appwrite';

export class EnrollmentError extends Error {
  constructor(
    public code: 'DUPLICATE_ENROLLMENT' | 'NO_AUTHORED_SOW' | 'DATABASE_ERROR',
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EnrollmentError';
  }
}

export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<EnrollmentResult> {
  console.log('[Enrollment Service] Starting enrollment:', { studentId, courseId });

  // 1. Check for existing enrollment (fast-fail)
  const existingEnrollment = await checkEnrollmentExists(studentId, courseId, databases);
  if (existingEnrollment) {
    throw new EnrollmentError(
      'DUPLICATE_ENROLLMENT',
      `Student ${studentId} is already enrolled in course ${courseId}`
    );
  }

  let enrollmentId: string | null = null;

  try {
    // 2. Create enrollment record
    const enrollment = await createEnrollmentRecord(studentId, courseId, databases);
    enrollmentId = enrollment.$id;

    // 3. Get latest published Authored_SOW
    const authoredSOW = await getLatestAuthoredSOW(courseId, databases);

    // 4. Create SOWV2 reference (NOT copy - reference architecture)
    const sowv2 = await createSOWV2Reference(
      studentId,
      courseId,
      authoredSOW,
      databases
    );

    // 5. Initialize MasteryV2
    const masteryv2 = await initializeMasteryV2(studentId, courseId, databases);

    console.log('[Enrollment Service] Success:', {
      enrollmentId: enrollment.$id,
      sowv2Id: sowv2.$id,
      masteryv2Id: masteryv2.$id
    });

    return { enrollment, sowv2, masteryv2, authoredSOW };
  } catch (error) {
    // Rollback enrollment if later steps fail
    if (enrollmentId) {
      console.error('[Enrollment Service] Rollback enrollment:', enrollmentId);
      await databases.deleteDocument('default', 'enrollments', enrollmentId);
    }

    // Re-throw with context
    if (error instanceof EnrollmentError) {
      throw error;
    }

    throw new EnrollmentError(
      'DATABASE_ERROR',
      `Enrollment failed: ${error.message}`,
      error
    );
  }
}

// Helper: Create enrollment record (extracted for <50 line limit)
async function createEnrollmentRecord(
  studentId: string,
  courseId: string,
  databases: Databases
) {
  const userId = await getUserIdFromStudentId(studentId, databases);

  return await databases.createDocument(
    'default',
    'enrollments',
    ID.unique(),
    {
      studentId,
      courseId,
      role: 'student',
      enrolledAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );
}

// Helper: Get latest Authored_SOW
async function getLatestAuthoredSOW(courseId: string, databases: Databases) {
  const authoredSOWResult = await databases.listDocuments(
    'default',
    'Authored_SOW',
    [
      Query.equal('courseId', courseId),
      Query.equal('status', 'published'),
      Query.orderDesc('version'),
      Query.limit(1)
    ]
  );

  if (authoredSOWResult.documents.length === 0) {
    throw new EnrollmentError(
      'NO_AUTHORED_SOW',
      `No published Authored_SOW found for course ${courseId}. ` +
      `Cannot create personalized curriculum.`
    );
  }

  return authoredSOWResult.documents[0];
}

// Helper: Create SOWV2 reference (reference architecture - NOT copy!)
async function createSOWV2Reference(
  studentId: string,
  courseId: string,
  authoredSOW: any,
  databases: Databases
) {
  const userId = await getUserIdFromStudentId(studentId, databases);

  // CRITICAL: SOWV2 stores REFERENCE, not copy
  return await databases.createDocument(
    'default',
    'SOWV2',
    ID.unique(),
    {
      studentId,
      courseId,
      source_authored_sow_id: authoredSOW.$id,  // ← Pointer, not copy!
      source_version: authoredSOW.version,
      customizations: JSON.stringify({}),  // Empty initially
      createdAt: new Date().toISOString()
      // NO 'entries' field - accessed via dereference!
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );
}

// Helper: Initialize MasteryV2 with empty EMA map
async function initializeMasteryV2(
  studentId: string,
  courseId: string,
  databases: Databases
) {
  const userId = await getUserIdFromStudentId(studentId, databases);

  // Get course outcomes
  const outcomesResult = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId)]
  );

  // Initialize all outcomes to 0.0 mastery
  const emaByOutcome: Record<string, number> = {};
  outcomesResult.documents.forEach((outcome: any) => {
    emaByOutcome[outcome.outcomeRef] = 0.0;
  });

  return await databases.createDocument(
    'default',
    'MasteryV2',
    ID.unique(),
    {
      studentId,
      courseId,
      emaByOutcome: JSON.stringify(emaByOutcome),
      updatedAt: new Date().toISOString()
    },
    [`read("user:${userId}")`, `write("user:${userId}")`]
  );
}

// Helper: Check enrollment exists
export async function checkEnrollmentExists(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<boolean> {
  const result = await databases.listDocuments(
    'default',
    'enrollments',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  return result.documents.length > 0;
}

// Helper: Get userId from studentId
async function getUserIdFromStudentId(
  studentId: string,
  databases: Databases
): Promise<string> {
  const student = await databases.getDocument('default', 'students', studentId);
  return student.userId;
}
```

---

### 2. Progress Service

**File**: `assistant-ui-frontend/lib/services/progress-service.ts`

**Purpose**: Calculate course progress metrics from sessions and mastery

#### Interface

```typescript
export interface CourseProgress {
  courseId: string;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  progressPercentage: number;
  averageMastery: number;  // 0-1 scale
  lastActivity: string | null;  // ISO datetime
  estimatedTimeRemaining: number;  // minutes
  completedLessonIds: string[];  // For filtering
}

/**
 * Calculates comprehensive progress metrics for a student's course enrollment.
 *
 * Data sources:
 * 1. SOWV2 → Authored_SOW (dereference for total lessons)
 * 2. Sessions (completed count)
 * 3. MasteryV2 (average mastery)
 */
export async function getCourseProgress(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<CourseProgress>;
```

#### Implementation (Outside-In TDD)

**Test First**: `progress-service.test.ts`

```typescript
describe('getCourseProgress', () => {
  it('should calculate progress with SOWV2 reference dereference', async () => {
    // Setup: SOWV2 references Authored_SOW
    const authoredSOW = {
      $id: 'authored-sow-123',
      courseId: 'course_c84473',
      version: 'v1.0',
      entries: JSON.stringify([
        { order: 1, lessonTemplateRef: 'lesson-1' },
        { order: 2, lessonTemplateRef: 'lesson-2' },
        { order: 3, lessonTemplateRef: 'lesson-3' }
      ])
    };

    const sowv2 = {
      studentId: 'student-123',
      courseId: 'course_c84473',
      source_authored_sow_id: 'authored-sow-123',  // ← Reference
      source_version: 'v1.0',
      customizations: '{}'
      // NO entries field!
    };

    // Mock: 1 completed session out of 3 lessons
    const sessions = [
      { lessonTemplateId: 'lesson-1', stage: 'done' }
    ];

    const result = await getCourseProgress(
      'student-123',
      'course_c84473',
      mockDatabases
    );

    expect(result.totalLessons).toBe(3);  // From Authored_SOW
    expect(result.completedLessons).toBe(1);
    expect(result.progressPercentage).toBe(33.33);
  });

  it('should calculate average mastery from MasteryV2', async () => {
    const masteryv2 = {
      emaByOutcome: JSON.stringify({
        'outcome-1': 0.8,
        'outcome-2': 0.6,
        'outcome-3': 0.7
      })
    };

    const result = await getCourseProgress('student-123', 'course_c84473', mockDatabases);

    expect(result.averageMastery).toBe(0.7);  // (0.8 + 0.6 + 0.7) / 3
  });

  it('should throw if SOWV2 missing (enrollment incomplete)', async () => {
    mockDatabases.listDocuments.mockResolvedValueOnce({ documents: [] });  // No SOWV2

    await expect(
      getCourseProgress('student-123', 'course_c84473', mockDatabases)
    ).rejects.toThrow('No SOWV2 found');
  });
});
```

**Implementation**: `progress-service.ts`

```typescript
export async function getCourseProgress(
  studentId: string,
  courseId: string,
  databases: Databases
): Promise<CourseProgress> {
  // 1. Get SOWV2 reference
  const sowv2Result = await databases.listDocuments('default', 'SOWV2',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (sowv2Result.documents.length === 0) {
    throw new Error(
      `No SOWV2 found for student ${studentId}, course ${courseId}. ` +
      `Enrollment may be incomplete.`
    );
  }

  const sowv2 = sowv2Result.documents[0];

  // 2. Dereference to Authored_SOW for curriculum data
  const authoredSOW = await databases.getDocument(
    'default',
    'Authored_SOW',
    sowv2.source_authored_sow_id
  );

  const sowEntries = JSON.parse(authoredSOW.entries);
  const totalLessons = sowEntries.length;

  // 3. Get course metadata
  const course = await databases.getDocument('default', 'courses', courseId);

  // 4. Count completed sessions
  const completedSessions = await getCompletedSessions(studentId, courseId, databases);
  const completedLessons = completedSessions.length;
  const progressPercentage = (completedLessons / totalLessons) * 100;

  // 5. Calculate average mastery
  const averageMastery = await calculateAverageMastery(studentId, courseId, databases);

  // 6. Get last activity
  const lastActivity = await getLastActivity(studentId, courseId, databases);

  // 7. Estimate time remaining
  const avgMinutesPerLesson = 30;  // TODO: Calculate from lesson templates
  const estimatedTimeRemaining = (totalLessons - completedLessons) * avgMinutesPerLesson;

  return {
    courseId,
    courseName: `${course.subject} - ${course.level}`,
    totalLessons,
    completedLessons,
    progressPercentage: Math.round(progressPercentage * 100) / 100,
    averageMastery: Math.round(averageMastery * 100) / 100,
    lastActivity,
    estimatedTimeRemaining,
    completedLessonIds: completedSessions.map(s => s.lessonTemplateId)
  };
}

// Helper functions (each <50 lines)
async function getCompletedSessions(studentId: string, courseId: string, databases: Databases) {
  const result = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.equal('stage', 'done')
    ]
  );
  return result.documents;
}

async function calculateAverageMastery(studentId: string, courseId: string, databases: Databases) {
  const masteryResult = await databases.listDocuments('default', 'MasteryV2',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId)
    ]
  );

  if (masteryResult.documents.length === 0) {
    return 0;
  }

  const emaByOutcome = JSON.parse(masteryResult.documents[0].emaByOutcome);
  const masteryValues = Object.values(emaByOutcome) as number[];

  if (masteryValues.length === 0) {
    return 0;
  }

  const sum = masteryValues.reduce((acc, val) => acc + val, 0);
  return sum / masteryValues.length;
}

async function getLastActivity(studentId: string, courseId: string, databases: Databases) {
  const result = await databases.listDocuments('default', 'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('courseId', courseId),
      Query.orderDesc('startedAt'),
      Query.limit(1)
    ]
  );

  return result.documents[0]?.startedAt || null;
}
```

---

### 3. Dashboard Updates

**File**: `assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx`

**Changes Required**:

1. **Replace course loading logic** (lines 131-187)
2. **Add enrollment check** before dashboard render
3. **Remove auto-enrollment** (move to onboarding)

#### Updated `loadCoursesClientSide()`

```typescript
const loadCoursesClientSide = async (databases: any, student: any) => {
  try {
    setCoursesLoading(true);
    setCoursesError(null);

    // 1. Get student's enrollments
    const enrollmentsResult = await databases.listDocuments(
      'default',
      'enrollments',
      [Query.equal('studentId', student.$id)]
    );

    // 2. Check if student has any enrollments
    if (enrollmentsResult.documents.length === 0) {
      // NO ENROLLMENTS - Redirect to course catalog
      console.log('[Dashboard] No enrollments found, redirecting to catalog');
      router.push('/courses/catalog');
      return;
    }

    // 3. Get enrolled course IDs
    const enrolledCourseIds = enrollmentsResult.documents.map(e => e.courseId);

    // 4. Fetch only enrolled courses
    const coursesResult = await databases.listDocuments(
      'default',
      'courses',
      [Query.equal('courseId', enrolledCourseIds)]
    );

    const coursesData = coursesResult.documents;
    setCourses(coursesData);

    // 5. Transform courses for navigation tabs
    const transformedCourses = transformCoursesForNavigation(coursesData);
    setCourseData(transformedCourses);

    console.log('[Dashboard] Loaded enrolled courses:', {
      enrollmentCount: enrollmentsResult.documents.length,
      courseCount: transformedCourses.length
    });

    // 6. Set initial active course
    if (transformedCourses.length > 0 && !activeCourse) {
      const firstCourse = transformedCourses[0];
      setActiveCourse(firstCourse.id);
      await loadRecommendations(firstCourse.id, student);
    }
  } catch (err) {
    console.error('[Dashboard] Failed to load courses:', err);
    setCoursesError(formatErrorMessage(err));
  } finally {
    setCoursesLoading(false);
  }
};
```

---

### 4. Appwrite Database Indexes

**Required Indexes**:

1. **enrollments collection**:
   ```
   Name: enrollment_student_course_unique
   Type: unique
   Attributes: studentId, courseId
   Purpose: Prevent duplicate enrollments, fast lookups
   ```

2. **SOWV2 collection** (existing):
   ```
   Name: unique_student_course
   Type: unique
   Attributes: studentId, courseId
   Purpose: One SOW per student per course
   ```

3. **MasteryV2 collection** (existing):
   ```
   Name: unique_student_course
   Type: unique
   Attributes: studentId, courseId
   Purpose: One mastery record per student per course
   ```

**Creation Script**:

```typescript
// File: scripts/create-enrollment-indexes.ts

import { Client, Databases } from 'node-appwrite';

async function createEnrollmentIndexes() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  const databases = new Databases(client);

  try {
    // Create unique compound index on enrollments
    await databases.createIndex(
      'default',
      'enrollments',
      'enrollment_student_course_unique',
      'unique',
      ['studentId', 'courseId']
    );

    console.log('✅ Created enrollment_student_course_unique index');
  } catch (error) {
    if (error.code === 409) {
      console.log('ℹ️  Index already exists');
    } else {
      throw error;
    }
  }
}

createEnrollmentIndexes();
```

---

## Testing Strategy

### Outside-In TDD Approach

**Test Pyramid** (for Phase 1):
```
        /\
       /  \  1 E2E Test (enrollment flow)
      /----\
     /      \ 3 Integration Tests (service integration)
    /--------\
   /          \ 15 Unit Tests (services, helpers)
  /------------\
```

### 1. Unit Tests

**Files to Test**:
- `enrollment-service.ts` - 8 unit tests
- `progress-service.ts` - 5 unit tests
- Helper functions - 2 unit tests

**Test Framework**: Jest + @testing-library/react

**Coverage Target**: 90%+

**Example Unit Tests**:

```typescript
// enrollment-service.test.ts
describe('Enrollment Service', () => {
  describe('enrollStudentInCourse', () => {
    it('should create enrollment record', async () => { /* ... */ });
    it('should create SOWV2 reference (not copy)', async () => { /* ... */ });
    it('should initialize MasteryV2 with all outcomes', async () => { /* ... */ });
    it('should throw on duplicate enrollment', async () => { /* ... */ });
    it('should throw if no Authored_SOW exists', async () => { /* ... */ });
    it('should rollback on SOWV2 creation failure', async () => { /* ... */ });
    it('should rollback on MasteryV2 creation failure', async () => { /* ... */ });
    it('should handle database connection errors', async () => { /* ... */ });
  });

  describe('checkEnrollmentExists', () => {
    it('should return true if enrollment exists', async () => { /* ... */ });
    it('should return false if no enrollment', async () => { /* ... */ });
  });
});

// progress-service.test.ts
describe('Progress Service', () => {
  describe('getCourseProgress', () => {
    it('should dereference SOWV2 to Authored_SOW', async () => { /* ... */ });
    it('should count completed sessions correctly', async () => { /* ... */ });
    it('should calculate average mastery', async () => { /* ... */ });
    it('should handle zero mastery (new enrollment)', async () => { /* ... */ });
    it('should throw if SOWV2 missing', async () => { /* ... */ });
  });
});
```

### 2. Integration Tests

**Purpose**: Test service interactions with Appwrite database

**Test Environment**: Mock Appwrite database or test database

**Files to Test**:
- Enrollment service → Appwrite (creates 3 records)
- Progress service → Appwrite (reads 4 collections)
- Dashboard → Services (enrollment flow)

**Example Integration Test**:

```typescript
// enrollment-integration.test.ts
describe('Enrollment Service Integration', () => {
  let databases: Databases;
  let testStudent: any;
  let testCourse: any;

  beforeAll(async () => {
    // Setup test Appwrite client
    databases = setupTestDatabases();
    testStudent = await createTestStudent();
    testCourse = await createTestCourse();
    await createTestAuthoredSOW(testCourse.courseId);
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestEnrollments();
  });

  it('should create complete enrollment pipeline in database', async () => {
    const result = await enrollStudentInCourse(
      testStudent.$id,
      testCourse.courseId,
      databases
    );

    // Verify enrollment exists in database
    const enrollmentCheck = await databases.getDocument(
      'default',
      'enrollments',
      result.enrollment.$id
    );
    expect(enrollmentCheck).toBeDefined();

    // Verify SOWV2 exists with reference (not copy!)
    const sowv2Check = await databases.getDocument(
      'default',
      'SOWV2',
      result.sowv2.$id
    );
    expect(sowv2Check.source_authored_sow_id).toBe(result.authoredSOW.$id);
    expect(sowv2Check).not.toHaveProperty('entries');  // Reference, not copy!

    // Verify MasteryV2 exists
    const masteryCheck = await databases.getDocument(
      'default',
      'MasteryV2',
      result.masteryv2.$id
    );
    expect(masteryCheck).toBeDefined();
  });

  it('should prevent duplicate enrollments via database constraint', async () => {
    // First enrollment succeeds
    await enrollStudentInCourse(testStudent.$id, testCourse.courseId, databases);

    // Second enrollment should fail
    await expect(
      enrollStudentInCourse(testStudent.$id, testCourse.courseId, databases)
    ).rejects.toThrow('DUPLICATE_ENROLLMENT');
  });
});
```

### 3. E2E Tests (Minimal)

**Purpose**: Test complete user flow end-to-end

**Tool**: Playwright

**Test Count**: 1 critical path test only

**Test File**: `e2e/enrollment-flow.spec.ts`

```typescript
// e2e/enrollment-flow.spec.ts
import { test, expect } from '@playwright/test';

test('student enrollment flow creates database records', async ({ page }) => {
  // 1. Login as test student
  await page.goto('http://localhost:3000/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 2. Navigate to course catalog
  await page.waitForURL('**/courses/catalog');

  // 3. Enroll in course
  await page.click('text=National 3 Mathematics');
  await page.click('button:has-text("Enroll Now")');

  // 4. Wait for enrollment to complete
  await page.waitForURL('**/dashboard');

  // 5. Verify dashboard shows enrolled course
  await expect(page.locator('text=National 3 Mathematics')).toBeVisible();

  // 6. Verify database records created (via API check)
  const enrollmentExists = await page.evaluate(async () => {
    const response = await fetch('/api/check-enrollment');
    const data = await response.json();
    return data.enrolled;
  });
  expect(enrollmentExists).toBe(true);
});
```

### 4. Manual Tests (Playwright MCP)

**Purpose**: Interactive testing during development

**Test Scenarios**:

1. **Enrollment Happy Path**:
   ```
   □ Login as new student
   □ Navigate to course catalog
   □ Select course "National 3 Mathematics"
   □ Click "Enroll Now"
   □ Verify redirect to dashboard
   □ Verify course appears in "My Courses"
   □ Verify recommendations load
   ```

2. **Duplicate Enrollment Error**:
   ```
   □ Login as student already enrolled in course
   □ Navigate to course catalog
   □ Select already-enrolled course
   □ Verify "Already Enrolled" button (disabled)
   □ Verify error message if attempting to enroll again
   ```

3. **Missing Authored_SOW Error**:
   ```
   □ Create test course without Authored_SOW
   □ Attempt to enroll in course
   □ Verify error: "No curriculum template found"
   □ Verify enrollment NOT created
   ```

4. **Dashboard Enrollment Filtering**:
   ```
   □ Login as student with 2 enrollments
   □ Verify dashboard shows 2 courses only (not all courses)
   □ Switch between course tabs
   □ Verify each tab loads correct recommendations
   ```

5. **Progress Calculation**:
   ```
   □ Login as student with partial progress
   □ Complete 1 lesson
   □ Return to dashboard
   □ Verify progress percentage updated
   □ Verify completed lesson count incremented
   ```

**Manual Test Execution Plan**:

```bash
# Start application
cd langgraph-agent && ./start.sh

# Use Playwright MCP tool for interactive testing
# Test each scenario above, documenting:
# - Steps taken
# - Expected behavior
# - Actual behavior
# - Screenshots of errors/successes
```

---

## Acceptance Criteria

### Must Have (Phase 1 Complete)

- [ ] Enrollment service creates enrollment + SOWV2 reference + MasteryV2
- [ ] SOWV2 uses reference architecture (stores `source_authored_sow_id`, NOT `entries`)
- [ ] Dashboard loads enrolled courses only (not all courses)
- [ ] Progress service calculates accurate metrics
- [ ] All unit tests pass (90%+ coverage)
- [ ] Integration tests verify database records created
- [ ] Manual tests pass all scenarios
- [ ] Appwrite indexes created and verified
- [ ] No duplicate enrollments allowed (database constraint)
- [ ] Error handling for missing Authored_SOW
- [ ] Rollback on transaction failures

### Should Have

- [ ] E2E test passes for critical enrollment flow
- [ ] Performance: Enrollment completes in <2 seconds
- [ ] Error logging includes student ID and course ID
- [ ] Documentation updated in README.md

### Could Have

- [ ] Enrollment service supports batch enrollments
- [ ] Progress service caches results for 5 minutes
- [ ] Dashboard shows enrollment date

---

## Implementation Timeline

### Day 1: Services Foundation
- [ ] Create `enrollment-service.ts` structure
- [ ] Write unit tests for enrollment service
- [ ] Implement enrollment service (TDD)
- [ ] Create Appwrite indexes

### Day 2: Progress Service
- [ ] Create `progress-service.ts` structure
- [ ] Write unit tests for progress service
- [ ] Implement progress service (TDD)
- [ ] Integration tests for both services

### Day 3: Dashboard Integration
- [ ] Update `EnhancedStudentDashboard.tsx`
- [ ] Remove auto-enrollment logic
- [ ] Add enrollment filtering
- [ ] Test dashboard with enrolled courses

### Day 4: Testing & Validation
- [ ] Run all unit tests
- [ ] Run integration tests
- [ ] Execute manual test scenarios
- [ ] Write E2E test
- [ ] Fix bugs found in testing

### Day 5: Documentation & Review
- [ ] Update README.md with new architecture
- [ ] Document enrollment service API
- [ ] Code review with team
- [ ] Deploy to staging for UAT

---

## Rollout Plan

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database indexes created in production
- [ ] Backup existing enrollments table
- [ ] Migration script ready for MVP1 students
- [ ] Rollback plan documented

### Deployment Steps

1. **Create Appwrite indexes** (non-breaking)
2. **Deploy enrollment service** (new code, no breaking changes)
3. **Deploy dashboard updates** (breaking: redirects if no enrollments)
4. **Run migration script** for existing students
5. **Verify enrollments** in production
6. **Monitor error logs** for 24 hours

### Rollback Plan

If critical issues found:
1. Revert dashboard to MVP1 (show all courses)
2. Keep enrollment service (no breaking changes)
3. Investigate and fix issues
4. Re-deploy with fixes

---

## Dependencies

### Required Before Phase 1

- [ ] Authored_SOW templates exist for all courses
- [ ] Appwrite permissions configured
- [ ] Test student accounts created
- [ ] Development environment stable

### Blocks Phase 2

Phase 2 (Onboarding) depends on:
- ✅ Enrollment service working
- ✅ Dashboard filtering by enrollments
- ✅ Progress calculation accurate

---

## Success Metrics

### Code Quality
- Unit test coverage: 90%+
- Integration test coverage: 80%+
- No critical bugs in production
- All functions <50 lines
- All files <500 lines

### Performance
- Enrollment pipeline: <2 seconds
- Dashboard load: <1 second
- Progress calculation: <500ms

### Data Integrity
- Zero duplicate enrollments
- 100% SOWV2 creation success rate
- 100% MasteryV2 initialization success rate

---

*End of Phase 1 Specification*
