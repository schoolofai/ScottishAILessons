import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CoursePlannerService } from '../../../lib/appwrite/planner-service';
import { langGraphClient } from '../../../lib/langgraph/client';
import { createLessonSelectionContext } from '../../../lib/langgraph/state-reading-utils';
import { authenticateRequest } from '../../../lib/middleware/auth';

// Request schema for lesson selection
const StartLessonRequestSchema = z.object({
  lessonTemplateId: z.string().min(1, "Lesson template ID is required"),
  courseId: z.string().min(1, "Course ID is required"),
  threadId: z.string().min(1, "Thread ID is required"),
  recommendationsState: z.record(z.any()).optional()
});

/**
 * POST /api/start-lesson
 * Starts a selected lesson using the LangGraph direct state reading pattern
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { lessonTemplateId, courseId, threadId, recommendationsState } =
      StartLessonRequestSchema.parse(body);

    // Authenticate request using middleware
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return authResult.errorResponse!;
    }

    // Initialize planner service
    const plannerService = new CoursePlannerService(authResult.sessionToken!);

    // Extract user ID from session token instead of calling account API
    let userId: string;
    try {
      // Decode the JWT session token to get user ID
      const sessionData = JSON.parse(atob(authResult.sessionToken!.split('.')[1] || authResult.sessionToken!));
      userId = sessionData.id || sessionData.user_id || sessionData.sub;

      if (!userId) {
        // Fallback: try to decode base64 session token directly
        const decodedSession = JSON.parse(atob(authResult.sessionToken!));
        userId = decodedSession.id;
      }

      console.log('Extracted user ID from session:', userId);
    } catch (error) {
      console.error('Failed to extract user ID from session token:', error);
      return NextResponse.json(
        { error: 'Invalid session token format', statusCode: 401 },
        { status: 401 }
      );
    }

    const student = await plannerService.getStudentByUserId(userId);
    if (!student) {
      return NextResponse.json(
        { error: 'Student profile not found', statusCode: 404 },
        { status: 404 }
      );
    }

    // Verify course enrollment
    const isEnrolled = await plannerService.verifyEnrollment(student.$id, courseId);
    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Not enrolled in this course', statusCode: 403 },
        { status: 403 }
      );
    }

    // Create lesson selection context
    const lessonContext = createLessonSelectionContext(
      lessonTemplateId,
      recommendationsState || {}
    );

    // Add required fields for session creation
    lessonContext.course_id = courseId;
    lessonContext.student_id = student.$id;

    // Start lesson in LangGraph using the existing thread
    await langGraphClient.startLesson(threadId, lessonContext);

    // Create session record in Appwrite for tracking
    const sessionResponse = await plannerService.createSession(
      student.$id,
      { lessonTemplateId, courseId }
    );

    console.log('Lesson started:', {
      threadId,
      sessionId: sessionResponse.sessionId,
      studentId: student.$id,
      courseId,
      lessonTemplateId,
      selectionSource: 'course_recommendations'
    });

    return NextResponse.json({
      success: true,
      threadId,
      sessionId: sessionResponse.sessionId,
      lessonContext,
      message: 'Lesson started successfully'
    }, { status: 200 });

  } catch (error) {
    console.error('Start lesson API error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request parameters',
          details: error.errors,
          statusCode: 400
        },
        { status: 400 }
      );
    }

    // Handle LangGraph client errors
    if (error.message.includes('Thread ID')) {
      return NextResponse.json(
        { error: 'Invalid thread state. Please get fresh recommendations.', statusCode: 400 },
        { status: 400 }
      );
    }

    // Handle enrollment/permission errors
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message, statusCode: 404 },
        { status: 404 }
      );
    }

    if (error.message.includes('not enrolled') || error.message.includes('not published')) {
      return NextResponse.json(
        { error: error.message, statusCode: 403 },
        { status: 403 }
      );
    }

    if (error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message, statusCode: 401 },
        { status: 401 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: error.message || 'Failed to start lesson',
        statusCode: 500
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/start-lesson
 * Check if a lesson can be started with the given parameters
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId');
    const lessonTemplateId = url.searchParams.get('lessonTemplateId');

    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Check thread readiness status
    const status = await langGraphClient.getThreadStatus(threadId);

    return NextResponse.json({
      threadId,
      lessonTemplateId,
      canStartLesson: status.can_select_lesson,
      status: {
        recommendations_ready: status.recommendations_ready,
        teaching_active: status.teaching_active,
        orchestration_phase: status.orchestration_phase
      }
    });

  } catch (error) {
    console.error('Start lesson status check error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to check lesson start status',
        statusCode: 500
      },
      { status: 500 }
    );
  }
}