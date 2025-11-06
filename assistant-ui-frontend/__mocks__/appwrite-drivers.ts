/**
 * Mock Appwrite Drivers for Testing
 *
 * This file provides factory functions for creating mock driver instances
 * with customizable behavior. Use these to test components that depend
 * on Appwrite drivers without hitting the actual API.
 *
 * Usage:
 *   const sessionDriver = createMockSessionDriver({
 *     getSessionState: jest.fn().mockResolvedValue(mockSessionData)
 *   });
 */

import { Session, LessonSnapshot } from '@/lib/appwrite/types';
import { CourseOutcome } from '@/lib/types/course-outcomes';

// ============================================
// SessionDriver Mock
// ============================================

export interface MockSessionDriver {
  getSessionWithContextChat: jest.Mock;
  getSessionState: jest.Mock;
  updateSessionThreadId: jest.Mock;
  updateContextChatThreadId: jest.Mock;
}

export interface SessionWithContextChat {
  session: Session;
  threadId?: string;
  contextChatThreadId?: string;
  hasExistingConversation: boolean;
  hasExistingContextChat: boolean;
  lastMessageAt?: string;
}

export interface SessionStateData {
  session: Session;
  parsedSnapshot: LessonSnapshot;
  progress: {
    currentCard: number;
    totalCards: number;
    completed: boolean;
  };
}

/**
 * Create a mock SessionDriver with default or custom implementations
 */
export function createMockSessionDriver(overrides?: Partial<MockSessionDriver>): MockSessionDriver {
  return {
    getSessionWithContextChat: jest.fn().mockResolvedValue({
      session: {} as Session,
      threadId: undefined,
      contextChatThreadId: undefined,
      hasExistingConversation: false,
      hasExistingContextChat: false,
    }),
    getSessionState: jest.fn().mockResolvedValue({
      session: {} as Session,
      parsedSnapshot: {} as LessonSnapshot,
      progress: { currentCard: 0, totalCards: 0, completed: false },
    }),
    updateSessionThreadId: jest.fn().mockResolvedValue(undefined),
    updateContextChatThreadId: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================
// CourseDriver Mock
// ============================================

export interface MockCourseDriver {
  getCourseCurriculumMetadata: jest.Mock;
}

export interface CourseCurriculumMetadata {
  course_subject: string;
  course_level: string;
  sqa_course_code: string;
  course_title: string;
}

/**
 * Create a mock CourseDriver with default or custom implementations
 */
export function createMockCourseDriver(overrides?: Partial<MockCourseDriver>): MockCourseDriver {
  return {
    getCourseCurriculumMetadata: jest.fn().mockResolvedValue({
      course_subject: 'mathematics',
      course_level: 'national-3',
      sqa_course_code: 'C844 73',
      course_title: 'Mathematics: National 3',
    }),
    ...overrides,
  };
}

// ============================================
// CourseOutcomesDriver Mock
// ============================================

export interface MockCourseOutcomesDriver {
  getOutcomesByIds: jest.Mock;
}

/**
 * Create a mock CourseOutcomesDriver with default or custom implementations
 */
export function createMockCourseOutcomesDriver(
  overrides?: Partial<MockCourseOutcomesDriver>
): MockCourseOutcomesDriver {
  return {
    getOutcomesByIds: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ============================================
// Mock useAppwrite Hook
// ============================================

/**
 * Mock the useAppwrite hook to return a createDriver function
 * that returns the appropriate mock driver based on the driver class
 */
export function mockUseAppwrite(
  sessionDriver: MockSessionDriver,
  courseDriver: MockCourseDriver,
  outcomeDriver: MockCourseOutcomesDriver
) {
  return {
    createDriver: jest.fn((DriverClass: any) => {
      const className = DriverClass.name || DriverClass.constructor?.name || '';

      if (className === 'SessionDriver' || className.includes('Session')) {
        return sessionDriver;
      }
      if (className === 'CourseDriver' || className.includes('Course')) {
        return courseDriver;
      }
      if (className === 'CourseOutcomesDriver' || className.includes('Outcome')) {
        return outcomeDriver;
      }

      // Fallback - return empty mock
      return {};
    }),
  };
}

// ============================================
// Helper: Create Full Mock Set
// ============================================

/**
 * Create a complete set of mock drivers with one call
 *
 * Usage:
 *   const mocks = createMockDriverSet({
 *     sessionDriver: { getSessionState: jest.fn().mockResolvedValue(...) }
 *   });
 *
 *   (useAppwrite as jest.Mock).mockReturnValue(mocks.useAppwriteMock);
 */
export function createMockDriverSet(overrides?: {
  sessionDriver?: Partial<MockSessionDriver>;
  courseDriver?: Partial<MockCourseDriver>;
  outcomeDriver?: Partial<MockCourseOutcomesDriver>;
}) {
  const sessionDriver = createMockSessionDriver(overrides?.sessionDriver);
  const courseDriver = createMockCourseDriver(overrides?.courseDriver);
  const outcomeDriver = createMockCourseOutcomesDriver(overrides?.outcomeDriver);
  const useAppwriteMock = mockUseAppwrite(sessionDriver, courseDriver, outcomeDriver);

  return {
    sessionDriver,
    courseDriver,
    outcomeDriver,
    useAppwriteMock,
  };
}
