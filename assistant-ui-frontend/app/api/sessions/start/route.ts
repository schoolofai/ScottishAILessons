import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CoursePlannerService } from '../../../../lib/appwrite/planner-service';
import { CreateSessionRequestSchema } from '../../../../lib/appwrite/schemas';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request data
    const { lessonTemplateId, courseId } = CreateSessionRequestSchema.parse(body);

    // Get session from cookies
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    // Initialize planner service with session
    const plannerService = new CoursePlannerService(sessionCookie.value);

    // Get current user to extract student ID
    const user = await plannerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found', statusCode: 401 },
        { status: 401 }
      );
    }

    // Get student profile
    const student = await plannerService.getStudentByUserId(user.$id);
    if (!student) {
      return NextResponse.json(
        { error: 'Student profile not found', statusCode: 404 },
        { status: 404 }
      );
    }

    // Verify course enrollment
    const isEnrolled = await plannerService.verifyEnrollment(
      student.$id,
      courseId
    );
    if (!isEnrolled) {
      return NextResponse.json(
        { error: 'Not enrolled in this course', statusCode: 403 },
        { status: 403 }
      );
    }

    // Check for existing active sessions
    const activeSessions = await plannerService.getActiveSessionsForStudent(student.$id);
    if (activeSessions.length > 0) {
      console.warn(`Student ${student.$id} has ${activeSessions.length} active sessions`);
      // Could optionally limit concurrent sessions or abandon existing ones
    }

    // Create new session
    const sessionResponse = await plannerService.createSession(
      student.$id,
      { lessonTemplateId, courseId }
    );

    console.log('Session created:', {
      sessionId: sessionResponse.sessionId,
      studentId: student.$id,
      courseId,
      lessonTemplateId
    });

    return NextResponse.json(sessionResponse, { status: 201 });

  } catch (error) {
    console.error('Session creation API error:', error);

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

    // Handle specific error types
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

    // Zero fallback policy - return error, don't create placeholder session
    return NextResponse.json(
      {
        error: error.message || 'Failed to create session',
        statusCode: 500
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking session status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Get session from cookies for authentication
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    const plannerService = new CoursePlannerService(sessionCookie.value);

    // Get current user
    const user = await plannerService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'User not found', statusCode: 401 },
        { status: 401 }
      );
    }

    // Get student profile
    const student = await plannerService.getStudentByUserId(user.$id);
    if (!student) {
      return NextResponse.json(
        { error: 'Student profile not found', statusCode: 404 },
        { status: 404 }
      );
    }

    // Get session details (this would require implementing getSession in service)
    // For now, return basic status
    return NextResponse.json({
      sessionId,
      status: 'active',
      message: 'Session status check not fully implemented'
    });

  } catch (error) {
    console.error('Session status API error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to get session status',
        statusCode: 500
      },
      { status: 500 }
    );
  }
}