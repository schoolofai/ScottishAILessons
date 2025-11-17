import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";
import { decompressJSON } from "@/lib/appwrite/utils/compression";

/**
 * GET /api/sessions/[id]
 * Fetch session data with authentication via httpOnly cookie
 * Replaces client-side SessionDriver.getSessionState() and getSessionWithContextChat()
 */
export async function GET(
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

    // Fetch session document
    const session = await databases.getDocument(
      'default',
      'sessions',
      sessionId
    );

    // Verify session belongs to the authenticated student
    if (session.studentId !== student.$id) {
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 403 }
      );
    }

    // Decompress lesson snapshot
    const parsedSnapshot = decompressJSON(session.lessonSnapshot);

    if (!parsedSnapshot) {
      throw new Error('Failed to decompress lesson snapshot');
    }

    // Return complete session data matching SessionDriver structure
    return NextResponse.json({
      success: true,
      // For getSessionState compatibility
      session,
      parsedSnapshot,
      // For getSessionWithContextChat compatibility
      threadId: session.threadId || undefined,
      contextChatThreadId: session.contextChatThreadId || undefined,
      hasExistingConversation: !!session.threadId,
      hasExistingContextChat: !!session.contextChatThreadId,
      lastMessageAt: session.lastMessageAt || undefined
    });

  } catch (error: any) {
    console.error('[API] /api/sessions/[id] GET error:', error);

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
      { error: error.message || "Failed to fetch session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/[id]
 * Update session data with authentication via httpOnly cookie
 */
export async function PATCH(
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

    const updates = await request.json();

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

    // Verify session ownership before update
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

    // Update session
    const session = await databases.updateDocument(
      'default',
      'sessions',
      sessionId,
      updates
    );

    return NextResponse.json(session);

  } catch (error: any) {
    console.error('[API] /api/sessions/[id] PATCH error:', error);

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
      { error: error.message || "Failed to update session" },
      { status: 500 }
    );
  }
}
