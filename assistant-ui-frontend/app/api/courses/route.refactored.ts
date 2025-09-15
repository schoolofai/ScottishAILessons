import { NextRequest, NextResponse } from 'next/server';
import { createApiHandler } from '../../../lib/middleware/api-handler';
import { handleMockError } from '../../../lib/utils/error-responses';
import { CourseService } from '../../../lib/services/course-service';
import { createApiHeaders } from '../../../lib/middleware/auth';

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
    return handleMockSession(authResult.mockSession);
  }

  // Real service flow (for production)
  return await handleRealService(authResult.sessionToken!);
}, {
  requireAuth: true
});

/**
 * Handles mock session flow for testing
 */
function handleMockSession(mockSession: any): NextResponse {
  const mockCourses = [
    {
      $id: 'course-math-123',
      courseId: 'C844 73',
      subject: 'Applications of Mathematics',
      level: 'National 3',
      status: 'active'
    },
    {
      $id: 'course-physics-456',
      courseId: 'C845 73',
      subject: 'Physics',
      level: 'National 3',
      status: 'active'
    },
    {
      $id: 'course-english-789',
      courseId: 'C846 73',
      subject: 'English',
      level: 'National 3',
      status: 'active'
    }
  ];

  return NextResponse.json(
    { courses: mockCourses },
    { headers: createApiHeaders() }
  );
}

/**
 * Handles real service flow for production
 */
async function handleRealService(sessionToken: string): Promise<NextResponse> {
  const courseService = new CourseService(sessionToken);

  // Get enrolled courses with full validation pipeline
  return await courseService.getEnrolledCourses();
}