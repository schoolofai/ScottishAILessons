import { NextRequest, NextResponse } from 'next/server';
import { CoursePlannerService } from '../../../../lib/appwrite/planner-service';
import { CourseRecommendation } from '../../../../lib/appwrite/schemas';
import { z } from 'zod';
import { authenticateRequest, createApiHeaders } from '../../../../lib/middleware/auth';
import { validateCourseId } from '../../../../lib/validation/request-validation';
import { handleMockError, createErrorResponse } from '../../../../lib/utils/error-responses';
import {
  isEnrolled,
  MOCK_COURSE_RECOMMENDATION
} from '../../../../lib/appwrite/mock-data';

export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Validate courseId parameter
    const validation = validateCourseId(params);
    if (!validation.success) {
      return validation.errorResponse!;
    }
    const courseId = validation.courseId!;

    // Authenticate request
    const authResult = await authenticateRequest();
    if (!authResult.success) {
      return authResult.errorResponse!;
    }

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

  } catch (error) {
    console.error('Recommendations API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: error.errors,
          statusCode: 400
        },
        {
          status: 400,
          headers: createApiHeaders()
        }
      );
    }

    return createErrorResponse(error);
  }
}

async function callCourseManagerGraph(
  context: any
): Promise<CourseRecommendation> {
  try {
    const langGraphApiUrl = process.env.LANGGRAPH_API_URL || 'http://localhost:2024';
    const langGraphApiKey = process.env.LANGGRAPH_API_KEY;

    if (!langGraphApiUrl) {
      throw new Error('LANGGRAPH_API_URL environment variable not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (langGraphApiKey) {
      headers['Authorization'] = `Bearer ${langGraphApiKey}`;
    }

    const requestBody = {
      input: {
        session_context: context,
        mode: 'course_manager'
      },
      config: {
        configurable: {
          thread_id: `course-manager-${context.student.id}-${context.course.courseId}`
        }
      }
    };

    console.log('Calling Course Manager Graph:', {
      url: `${langGraphApiUrl}/invoke`,
      courseId: context.course.courseId,
      studentId: context.student.id
    });

    const response = await fetch(`${langGraphApiUrl}/invoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Course Manager Graph error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });

      throw new Error(`Course Manager request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Extract recommendation from LangGraph response
    const recommendation = result.course_recommendation || result.output?.course_recommendation;

    if (!recommendation) {
      console.error('No recommendation in LangGraph response:', result);
      throw new Error('Course Manager did not return recommendations');
    }

    // Validate recommendation format
    const { CourseRecommendationSchema } = await import('../../../../lib/appwrite/schemas');
    return CourseRecommendationSchema.parse(recommendation);

  } catch (error) {
    console.error('Course Manager Graph call failed:', error);

    if (error.name === 'TimeoutError') {
      throw new Error('Course Manager request timed out');
    }

    if (error.message.includes('fetch')) {
      throw new Error('Unable to connect to Course Manager service');
    }

    throw error;
  }
}

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
  const plannerService = new CoursePlannerService(sessionToken);

  // Get current user to extract student ID (catch invalid session errors)
  let user;
  try {
    user = await plannerService.getCurrentUser();
  } catch (error) {
    // Check for invalid session errors
    if (error.message.includes('missing scopes') ||
        error.message.includes('guests') ||
        error.message.includes('unauthorized') ||
        error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'User not found', statusCode: 401 },
        {
          status: 401,
          headers: createApiHeaders()
        }
      );
    }
    throw error; // Re-throw other errors
  }

  if (!user) {
    return NextResponse.json(
      { error: 'User not found', statusCode: 401 },
      {
        status: 401,
        headers: createApiHeaders()
      }
    );
  }

  // Get student profile
  const student = await plannerService.getStudentByUserId(user.$id);
  if (!student) {
    return NextResponse.json(
      { error: 'Student profile not found', statusCode: 404 },
      {
        status: 404,
        headers: createApiHeaders()
      }
    );
  }

  // Verify course enrollment
  const enrollmentStatus = await plannerService.verifyEnrollment(
    student.$id,
    courseId
  );
  if (!enrollmentStatus) {
    return NextResponse.json(
      { error: 'Not enrolled in this course', statusCode: 403 },
      {
        status: 403,
        headers: createApiHeaders()
      }
    );
  }

  // Assemble scheduling context
  const context = await plannerService.assembleSchedulingContext(
    student.$id,
    courseId
  );

  // Call Course Manager via LangGraph
  const recommendations = await callCourseManagerGraph(context);

  // Save graph run ID for continuity
  if (recommendations.graphRunId) {
    await plannerService.saveGraphRunId(
      student.$id,
      courseId,
      recommendations.graphRunId
    );
  }

  return NextResponse.json(recommendations, {
    headers: createApiHeaders()
  });
}