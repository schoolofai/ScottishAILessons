import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";

/**
 * POST /api/sessions/[id]/expire
 *
 * Mark a session as expired when the LangGraph thread is no longer available
 * (threads expire after 7 days of inactivity).
 *
 * This is called when a student tries to resume a lesson but the thread
 * has expired. The session is marked as 'failed' with endedAt timestamp.
 * Note: 'stage' has an enum constraint, so we can't set it to 'expired'.
 *
 * Security: Uses httpOnly cookie authentication and verifies session ownership
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user using secure httpOnly cookie
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    const { id: sessionId } = params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get student record to verify ownership
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];

    // Verify session ownership before marking as expired
    const existingSession = await databases.getDocument(
      'default',
      'sessions',
      sessionId
    );

    if (existingSession.studentId !== student.$id) {
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 403 }
      );
    }

    // Don't expire already completed sessions
    if (existingSession.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Session already completed, no action taken',
        session: existingSession
      });
    }

    // Mark session as expired (status: 'failed', but keep stage unchanged due to enum constraint)
    const updatedSession = await databases.updateDocument(
      'default',
      'sessions',
      sessionId,
      {
        status: 'failed',
        endedAt: new Date().toISOString()
      }
    );

    console.log(`[API] Session ${sessionId} marked as expired (thread unavailable)`);

    return NextResponse.json({
      success: true,
      session: updatedSession
    });

  } catch (error: any) {
    console.error('[API] /api/sessions/[id]/expire POST error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle not found errors
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to mark session as expired" },
      { status: 500 }
    );
  }
}
