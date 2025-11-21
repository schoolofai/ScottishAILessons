import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";

/**
 * GET /api/student/sessions/[sessionId]
 * Fetch a specific session for the authenticated student via httpOnly cookie
 * Replaces client-side databases.getDocument for sessions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    // Get authenticated user using secure httpOnly cookie
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    // Get student record
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

    // Fetch the specific session
    const session = await databases.getDocument(
      'default',
      'sessions',
      sessionId
    );

    // SECURITY: Verify the session belongs to this student
    if (session.studentId !== student.$id) {
      return NextResponse.json(
        { error: "Unauthorized access to session" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      session
    });

  } catch (error: any) {
    console.error('[API] /api/student/sessions/[sessionId] GET error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle not found errors
    if (error.code === 404 || error.message?.includes('not found')) {
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
