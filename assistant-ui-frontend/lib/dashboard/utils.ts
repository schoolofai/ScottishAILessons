/**
 * Course data from API including progress information
 */
export interface Course {
  $id: string;
  courseId: string;
  subject: string;
  phase: string;
  level: string;
  progress?: number;
  completedLessons?: number;
  totalLessons?: number;
  nextLessonTitle?: string;
  overdueLessons?: number;
}

export interface Session {
  $id: string;
  studentId: string;
  courseId: string;
  lessonTemplateId?: string;
  startedAt: string;
  endedAt?: string;
  stage: string;
  status: 'created' | 'active' | 'completed' | 'abandoned' | 'failed';
  completedAt?: string;
  durationMinutes?: number;
  updatedAt?: string;
}

/**
 * Transform raw course data into a generic format
 * @deprecated Use transformToEnhancedCourseData in EnhancedStudentDashboard instead
 */
export function transformCoursesForNavigation(courses: Course[]): any[] {
  return courses.map((course: Course) => ({
    id: course.courseId,
    subject: course.subject.toLowerCase(),
    level: course.level,
    title: course.subject.charAt(0).toUpperCase() + course.subject.slice(1),
    progress: course.progress || 0,
    enrolled: true,
    completedLessons: course.completedLessons || 0,
    totalLessons: course.totalLessons || 0,
    nextLessonTitle: course.nextLessonTitle,
    overdueLessons: course.overdueLessons || 0,
    status: 'active' as const
  }));
}

/**
 * Format error messages for user display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Validate if we have the minimum required data to start a lesson
 * Note: threadId is optional - sessions can be created without pre-existing threads
 */
export function validateLessonStartContext(
  lessonTemplateId: string,
  courseId: string,
  threadId?: string
): { isValid: boolean; error?: string } {
  if (!lessonTemplateId) {
    return { isValid: false, error: 'Missing lesson template ID' };
  }

  if (!courseId) {
    return { isValid: false, error: 'Missing course ID' };
  }

  // threadId is optional - not required for validation
  // Sessions can be created without pre-existing recommendation threads

  return { isValid: true };
}

/**
 * Create the payload for lesson start API
 */
export function createLessonStartPayload(
  lessonTemplateId: string,
  courseId: string,
  threadId: string,
  recommendationsState: any
) {
  return {
    lessonTemplateId,
    courseId,
    threadId,
    recommendationsState
  };
}

/**
 * Determine the session URL from the lesson start response
 */
export function getSessionUrl(data: { sessionId?: string; threadId?: string }): string {
  if (data.sessionId) {
    return `/session/${data.sessionId}`;
  }
  if (data.threadId) {
    return `/session/${data.threadId}`;
  }
  throw new Error('No session or thread ID returned from lesson start');
}

/**
 * Debounce function for reducing API calls during rapid interactions
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Check if the current device/browser supports touch interactions
 */
export function supportsTouch(): boolean {
  return typeof window !== 'undefined' && 'ontouchstart' in window;
}

/**
 * Get appropriate event handlers based on device capabilities
 */
export function getInteractionHandlers(
  clickHandler: () => void
): {
  onClick?: () => void;
  onTouchStart?: () => void;
} {
  if (supportsTouch()) {
    return {
      onTouchStart: clickHandler
    };
  }

  return {
    onClick: clickHandler
  };
}

/**
 * Calculate progress percentage with proper rounding
 */
export function calculateProgressPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Format lesson count for display
 */
export function formatLessonCount(completed: number, total: number): string {
  return `${completed}/${total} lessons`;
}

/**
 * Generate a unique key for React list items
 */
export function generateListKey(prefix: string, id: string, index?: number): string {
  if (index !== undefined) {
    return `${prefix}-${id}-${index}`;
  }
  return `${prefix}-${id}`;
}

/**
 * Validate if a course ID is valid
 */
export function isValidCourseId(courseId: string): boolean {
  return typeof courseId === 'string' && courseId.length > 0;
}

/**
 * Get the display name for a student
 */
export function getStudentDisplayName(student: any): string {
  if (student?.name && typeof student.name === 'string') {
    return student.name;
  }
  return 'Student';
}

/**
 * Check if we're in a development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Log debug information only in development
 */
export function debugLog(message: string, data?: any): void {
  if (isDevelopment()) {
    console.log(`[Dashboard Debug] ${message}`, data || '');
  }
}