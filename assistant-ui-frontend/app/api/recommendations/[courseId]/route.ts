import { NextResponse } from 'next/server';
import { createApiHandler, validateCourseIdParam } from '../../../../lib/middleware/api-handler';
import { handleMockError } from '../../../../lib/utils/error-responses';
import { CourseService } from '../../../../lib/services/course-service';
import { LangGraphService } from '../../../../lib/services/langgraph-service';
import { createApiHeaders } from '../../../../lib/middleware/auth';
import {
  isEnrolled,
  MOCK_COURSE_RECOMMENDATION
} from '../../../../lib/appwrite/mock-data';

/**
 * GET /api/recommendations/[courseId]
 * Returns AI-generated lesson recommendations for a specific course
 */
export const GET = createApiHandler(async ({ authResult, params }) => {
  const courseId = params!.courseId;

  // Handle mock error scenarios
  const mockErrorResponse = await handleMockError(authResult.errorToSimulate || null);
  if (mockErrorResponse) {
    return mockErrorResponse;
  }

  // Handle mock session flow
  if (authResult.mockSession) {
    return handleMockSession(authResult.mockSession, courseId);
  }

  // Real service flow (for production)
  return await handleRealService(authResult.sessionToken!, courseId);
}, {
  requireAuth: true,
  paramValidators: {
    courseId: validateCourseIdParam
  }
});

/**
 * Handles mock session flow for testing
 */
function handleMockSession(mockSession: any, courseId: string): NextResponse {
  const { user, student } = mockSession;

  // Check mock enrollment
  if (!isEnrolled(student.$id, courseId)) {
    return NextResponse.json(
      { error: 'Not enrolled in this course', statusCode: 403 },
      {
        status: 403,
        headers: createApiHeaders()
      }
    );
  }

  // Return mock recommendation
  const mockRecommendation = {
    ...MOCK_COURSE_RECOMMENDATION,
    courseId,
    generatedAt: new Date().toISOString()
  };

  return NextResponse.json(mockRecommendation, {
    headers: createApiHeaders()
  });
}

/**
 * Handles real service flow for production
 */
async function handleRealService(sessionToken: string, courseId: string): Promise<NextResponse> {
  const courseService = new CourseService(sessionToken);
  const langGraphService = new LangGraphService();

  // Get recommendations with full validation pipeline
  const result = await courseService.getCourseRecommendations(courseId);

  // Handle validation errors
  if ('statusCode' in result) {
    return result as NextResponse;
  }

  const { context, student } = result as any;

  // Call Course Manager via LangGraph
  const recommendations = await langGraphService.getCourseRecommendations(context);

  // Save graph run ID for continuity
  await courseService.saveGraphRunId(
    student.$id,
    courseId,
    recommendations.graphRunId
  );

  return NextResponse.json(recommendations, {
    headers: createApiHeaders()
  });
}