import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";

const COLLECTION_ID = "practice_sessions";
const DATABASE_ID = "default";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/practice-sessions/[sessionId]
 * Get a practice session by session_id
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // Validate user is authenticated
    const { account } = await createSessionClient();
    const user = await account.get();

    // Get student record
    const { databases: adminDb } = await createAdminClient();
    const studentsResult = await adminDb.listDocuments(
      DATABASE_ID,
      "students",
      [Query.equal("userId", user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student record not found" },
        { status: 404 }
      );
    }

    const studentDoc = studentsResult.documents[0];

    // Find the session by session_id
    const sessionResult = await adminDb.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal("session_id", sessionId), Query.limit(1)]
    );

    if (sessionResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Practice session not found" },
        { status: 404 }
      );
    }

    const session = sessionResult.documents[0];

    // Validate ownership
    if (session.student_id !== studentDoc.$id) {
      return NextResponse.json(
        { error: "Access denied - session belongs to another student" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    console.error("[API] /api/practice-sessions/[sessionId] GET error:", err);

    if (err.message?.includes("No session found")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to get practice session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/practice-sessions/[sessionId]
 * Update a practice session's progress
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // Validate user is authenticated
    const { account } = await createSessionClient();
    const user = await account.get();

    // Get student record
    const { databases: adminDb } = await createAdminClient();
    const studentsResult = await adminDb.listDocuments(
      DATABASE_ID,
      "students",
      [Query.equal("userId", user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student record not found" },
        { status: 404 }
      );
    }

    const studentDoc = studentsResult.documents[0];

    // Find the session by session_id
    const sessionResult = await adminDb.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal("session_id", sessionId), Query.limit(1)]
    );

    if (sessionResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Practice session not found" },
        { status: 404 }
      );
    }

    const session = sessionResult.documents[0];

    // Validate ownership
    if (session.student_id !== studentDoc.$id) {
      return NextResponse.json(
        { error: "Access denied - session belongs to another student" },
        { status: 403 }
      );
    }

    // Parse update data
    const updateData = await request.json();

    // Appwrite requires complex fields to be stored as JSON strings
    // Handle stringification server-side so clients can send normal objects
    const documentData: Record<string, unknown> = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Stringify complex fields if present and not already strings
    if (updateData.blocks_progress !== undefined) {
      documentData.blocks_progress = typeof updateData.blocks_progress === 'string'
        ? updateData.blocks_progress
        : JSON.stringify(updateData.blocks_progress || []);
    }
    if (updateData.current_question !== undefined) {
      documentData.current_question = updateData.current_question === null
        ? null
        : (typeof updateData.current_question === 'string'
            ? updateData.current_question
            : JSON.stringify(updateData.current_question));
    }
    if (updateData.source_metadata !== undefined) {
      documentData.source_metadata = typeof updateData.source_metadata === 'string'
        ? updateData.source_metadata
        : JSON.stringify(updateData.source_metadata || {});
    }
    if (updateData.blocks !== undefined) {
      documentData.blocks = typeof updateData.blocks === 'string'
        ? updateData.blocks
        : JSON.stringify(updateData.blocks || []);
    }

    // Update the document
    const updated = await adminDb.updateDocument(
      DATABASE_ID,
      COLLECTION_ID,
      session.$id,
      documentData
    );

    console.log("[API] Practice session updated:", updated.$id);

    return NextResponse.json({
      success: true,
      session: updated,
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    console.error("[API] /api/practice-sessions/[sessionId] PATCH error:", err);

    if (err.message?.includes("No session found")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to update practice session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/practice-sessions/[sessionId]
 * Delete a practice session
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    // Validate user is authenticated
    const { account } = await createSessionClient();
    const user = await account.get();

    // Get student record
    const { databases: adminDb } = await createAdminClient();
    const studentsResult = await adminDb.listDocuments(
      DATABASE_ID,
      "students",
      [Query.equal("userId", user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student record not found" },
        { status: 404 }
      );
    }

    const studentDoc = studentsResult.documents[0];

    // Find the session by session_id
    const sessionResult = await adminDb.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      [Query.equal("session_id", sessionId), Query.limit(1)]
    );

    if (sessionResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Practice session not found" },
        { status: 404 }
      );
    }

    const session = sessionResult.documents[0];

    // Validate ownership
    if (session.student_id !== studentDoc.$id) {
      return NextResponse.json(
        { error: "Access denied - session belongs to another student" },
        { status: 403 }
      );
    }

    console.log("[API] Deleting practice session:", {
      session_id: sessionId,
      document_id: session.$id,
    });

    await adminDb.deleteDocument(DATABASE_ID, COLLECTION_ID, session.$id);

    console.log("[API] Practice session deleted");

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    console.error("[API] /api/practice-sessions/[sessionId] DELETE error:", err);

    if (err.message?.includes("No session found")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to delete practice session" },
      { status: 500 }
    );
  }
}
