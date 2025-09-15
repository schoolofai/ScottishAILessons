import { NextResponse } from 'next/server';
import { createApiHandler } from '../../../lib/middleware/api-handler';
import { handleMockError } from '../../../lib/utils/error-responses';
import { CourseService } from '../../../lib/services/course-service';

/**
 * GET /api/courses
 * Returns courses the authenticated student is enrolled in
 */
export const GET = createApiHandler(async ({ authResult }) => {
  // Handle mock error scenarios
  const mockErrorResponse = await handleMockError(authResult.errorToSimulate || null);
  if (mockErrorResponse) {
    return mockErrorResponse;
  }

  // Handle mock session flow
  if (authResult.mockSession) {
    return CourseService.handleMockCoursesSession(authResult.mockSession);
  }

  // Real service flow (for production)
  return await handleRealService(authResult.sessionToken!);
}, {
  requireAuth: true
});


/**
 * Handles real service flow for production
 */
async function handleRealService(sessionToken: string): Promise<NextResponse> {
  const courseService = new CourseService(sessionToken);

  // Get enrolled courses with full validation pipeline
  return await courseService.getEnrolledCourses();
}