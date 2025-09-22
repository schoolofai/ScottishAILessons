// Mock data for testing scenarios
// This file provides mock responses for different session tokens to simulate various API states

export interface MockUser {
  $id: string;
  email: string;
  name: string;
}

export interface MockStudent {
  $id: string;
  userId: string;
  name: string;
  accommodations: string[];
  enrolledCourses: string[];
}

export interface MockEnrollment {
  studentId: string;
  courseId: string;
  enrolled: boolean;
}

export interface MockCourseRecommendation {
  courseId: string;
  generatedAt: string;
  graphRunId: string;
  candidates: Array<{
    lessonTemplateId: string;
    title: string;
    targetOutcomeIds: string[];
    estimatedMinutes: number;
    priorityScore: number;
    reasons: string[];
    flags: string[];
  }>;
  rubric: string;
}

// Mock session tokens and their associated data
export const MOCK_SESSIONS = {
  // Standard test session from auth endpoint
  'session-test-456': {
    user: {
      $id: 'user-test-123',
      email: 'test@scottishailessons.com',
      name: 'Test User'
    } as MockUser,
    student: {
      $id: 'student-test-789',
      userId: 'user-test-123',
      name: 'Test Student',
      accommodations: [],
      enrolledCourses: ['course-math-123', 'course-physics-456', 'course-english-789']
    } as MockStudent
  },
  // Special test sessions (from auth endpoint special users)
  'session-no-student-session-456': {
    user: {
      $id: 'user-no-student-session-123',
      email: 'no-student@scottishailessons.com',
      name: 'Test User (no-student-session)'
    } as MockUser,
    student: null // No student profile
  },
  'session-no-courses-session-456': {
    user: {
      $id: 'user-no-courses-session-123',
      email: 'no-courses@scottishailessons.com',
      name: 'Test User (no-courses-session)'
    } as MockUser,
    student: {
      $id: 'student-no-courses-session-789',
      userId: 'user-no-courses-session-123',
      name: 'Test Student (no-courses-session)',
      accommodations: [],
      enrolledCourses: [] // No course enrollments
    } as MockStudent
  },
  'session-service-error-session-456': {
    user: {
      $id: 'user-service-error-session-123',
      email: 'service-error@scottishailessons.com',
      name: 'Test User (service-error-session)'
    } as MockUser,
    student: {
      $id: 'student-service-error-session-789',
      userId: 'user-service-error-session-123',
      name: 'Test Student (service-error-session)',
      accommodations: [],
      enrolledCourses: ['course-math-123']
    } as MockStudent
  },
  'session-timeout-session-456': {
    user: {
      $id: 'user-timeout-session-123',
      email: 'timeout@scottishailessons.com',
      name: 'Test User (timeout-session)'
    } as MockUser,
    student: {
      $id: 'student-timeout-session-789',
      userId: 'user-timeout-session-123',
      name: 'Test Student (timeout-session)',
      accommodations: [],
      enrolledCourses: ['course-math-123']
    } as MockStudent
  },
  // Valid sessions for different test scenarios
  'mock-valid-session-token': {
    user: {
      $id: 'user123',
      email: 'test@example.com',
      name: 'Test User'
    } as MockUser,
    student: {
      $id: 'student123',
      userId: 'user123',
      name: 'Test Student',
      accommodations: [],
      enrolledCourses: ['C844 73'] // Enrolled in math course
    } as MockStudent
  },

  'mock-valid-session-for-math': {
    user: {
      $id: 'user456',
      email: 'math-student@example.com',
      name: 'Math Student'
    } as MockUser,
    student: {
      $id: 'student456',
      userId: 'user456',
      name: 'Math Student',
      accommodations: [],
      enrolledCourses: ['C844 73']
    } as MockStudent
  },

  'mock-full-valid-session': {
    user: {
      $id: 'user789',
      email: 'full-test@example.com',
      name: 'Full Test User'
    } as MockUser,
    student: {
      $id: 'student789',
      userId: 'user789',
      name: 'Full Test Student',
      accommodations: [],
      enrolledCourses: ['C844 73']
    } as MockStudent
  },

  'mock-headers-test-session': {
    user: {
      $id: 'user-headers',
      email: 'headers@example.com',
      name: 'Headers Test'
    } as MockUser,
    student: {
      $id: 'student-headers',
      userId: 'user-headers',
      name: 'Headers Test Student',
      accommodations: [],
      enrolledCourses: ['C844 73']
    } as MockStudent
  },

  'mock-performance-session': {
    user: {
      $id: 'user-perf',
      email: 'perf@example.com',
      name: 'Performance Test'
    } as MockUser,
    student: {
      $id: 'student-perf',
      userId: 'user-perf',
      name: 'Performance Test Student',
      accommodations: [],
      enrolledCourses: ['C844 73']
    } as MockStudent
  },

  'mock-concurrent-session': {
    user: {
      $id: 'user-concurrent',
      email: 'concurrent@example.com',
      name: 'Concurrent Test'
    } as MockUser,
    student: {
      $id: 'student-concurrent',
      userId: 'user-concurrent',
      name: 'Concurrent Test Student',
      accommodations: [],
      enrolledCourses: ['C844 73']
    } as MockStudent
  }
};

// Mock enrollments
export const MOCK_ENROLLMENTS: MockEnrollment[] = [
  { studentId: 'student123', courseId: 'C844 73', enrolled: true },
  { studentId: 'student456', courseId: 'C844 73', enrolled: true },
  { studentId: 'student789', courseId: 'C844 73', enrolled: true },
  { studentId: 'student-headers', courseId: 'C844 73', enrolled: true },
  { studentId: 'student-perf', courseId: 'C844 73', enrolled: true },
  { studentId: 'student-concurrent', courseId: 'C844 73', enrolled: true },
  // Add enrollment for test student from MVP1 test data
  { studentId: 'test-student-alex', courseId: 'C844 73', enrolled: true },
  { studentId: 'test-student-alex', courseId: 'C845 73', enrolled: true },
  { studentId: 'test-student-alex', courseId: 'nat5-maths-2024', enrolled: true },
  // Add enrollment for actual student ID from session logs
  { studentId: '68b812bb0009d9755b35', courseId: 'C844 73', enrolled: true }
];

// Mock course recommendation response - matching expected test schema
export const MOCK_COURSE_RECOMMENDATION = {
  topPick: {
    templateId: 'lesson-123',
    title: 'Quadratic Equations Introduction',
    outcomeRefs: ['outcome-math-001', 'outcome-math-002'],
    estMinutes: 45,
    priority: 0.85,
    reason: 'overdue'
  },
  otherCandidates: [
    {
      templateId: 'lesson-124',
      title: 'Factoring Practice',
      outcomeRefs: ['outcome-math-003'],
      estMinutes: 30,
      priority: 0.72,
      reason: 'low_mastery'
    }
  ],
  reasoning: {
    explanation: 'Selected lessons based on overdue assignments and low EMA scores in quadratic equations domain.',
    factors: ['overdue_assignments', 'low_ema_scores', 'scheme_of_work_order'],
    confidence: 0.85
  },
  graphRunId: 'test-graph-run-123',
  timestamp: new Date().toISOString()
};

// Helper functions
export function getMockSession(sessionToken: string) {
  return MOCK_SESSIONS[sessionToken] || null;
}

export function isEnrolled(studentId: string, courseId: string): boolean {
  return MOCK_ENROLLMENTS.some(
    enrollment => enrollment.studentId === studentId &&
                  enrollment.courseId === courseId &&
                  enrollment.enrolled
  );
}

export function shouldSimulateError(sessionToken: string): string | null {
  // Special session tokens that simulate different error conditions
  if (sessionToken === 'mock-timeout-session') {
    return 'timeout';
  }
  if (sessionToken === 'mock-malformed-response-session') {
    return 'malformed_response';
  }
  if (sessionToken === 'mock-db-failure-session') {
    return 'database_error';
  }
  if (sessionToken === 'mock-valid-session-for-math') {
    return 'service_unavailable'; // This session should simulate Course Manager being down
  }
  // Special session tokens from auth endpoint that simulate errors
  if (sessionToken === 'session-service-error-session-456') {
    return 'service_unavailable';
  }
  if (sessionToken === 'session-timeout-session-456') {
    return 'timeout';
  }
  return null;
}