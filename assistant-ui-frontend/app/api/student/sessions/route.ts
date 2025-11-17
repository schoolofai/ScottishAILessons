import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";

/**
 * GET /api/student/sessions
 * Fetch all sessions for the authenticated student via httpOnly cookie
 * Replaces client-side databases.listDocuments for sessions
 */
export async function GET(request: NextRequest) {
  try {
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

    // Fetch ALL sessions for this student with pagination
    let allSessions: any[] = [];
    let offset = 0;
    const limit = 100; // Appwrite max limit per request
    let hasMore = true;

    while (hasMore) {
      const sessionsResult = await databases.listDocuments(
        'default',
        'sessions',
        [
          Query.equal('studentId', student.$id),
          Query.limit(limit),
          Query.offset(offset)
        ]
      );

      allSessions = allSessions.concat(sessionsResult.documents);
      offset += limit;
      hasMore = sessionsResult.documents.length === limit;
    }

    return NextResponse.json({
      success: true,
      sessions: allSessions,
      total: allSessions.length
    });

  } catch (error: any) {
    console.error('[API] /api/student/sessions GET error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
