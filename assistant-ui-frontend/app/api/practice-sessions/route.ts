import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createSessionClient } from "@/lib/server/appwrite";
import { Query, ID } from "node-appwrite";

const COLLECTION_ID = "practice_sessions";
const DATABASE_ID = "default";

/**
 * POST /api/practice-sessions
 * Create a new practice session using server-side auth (bypasses collection permissions)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate user is authenticated
    const { account } = await createSessionClient();
    const user = await account.get();

    // Get student record to validate ownership
    const { databases: adminDb } = await createAdminClient();
    const studentsResult = await adminDb.listDocuments(
      DATABASE_ID,
      "students",
      [Query.equal("userId", user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { error: "Student record not found for authenticated user" },
        { status: 404 }
      );
    }

    const studentDoc = studentsResult.documents[0];

    // Parse request body
    const sessionData = await request.json();

    // Validate the student_id matches the authenticated user's student record
    if (sessionData.student_id !== studentDoc.$id) {
      return NextResponse.json(
        { error: "Student ID mismatch - cannot create session for another student" },
        { status: 403 }
      );
    }

    console.log("[API] Creating practice session:", {
      session_id: sessionData.session_id,
      student_id: sessionData.student_id,
      source_id: sessionData.source_id,
    });

    // Create the document using admin client (bypasses permissions)
    const document = await adminDb.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      sessionData
    );

    console.log("[API] Practice session created:", document.$id);

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    console.error("[API] /api/practice-sessions POST error:", err);

    if (err.message?.includes("No session found")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to create practice session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/practice-sessions
 * List practice sessions for the authenticated student
 * Query params: status, source_id, source_type, limit
 */
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const sourceId = searchParams.get("source_id");
    const sourceType = searchParams.get("source_type");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // Build query
    const queries: string[] = [
      Query.equal("student_id", studentDoc.$id),
      Query.orderDesc("last_activity_at"),
      Query.limit(limit),
    ];

    if (status) {
      queries.push(Query.equal("status", status));
    }
    if (sourceId) {
      queries.push(Query.equal("source_id", sourceId));
    }
    if (sourceType) {
      queries.push(Query.equal("source_type", sourceType));
    }

    console.log("[API] Listing practice sessions:", {
      student_id: studentDoc.$id,
      status,
      sourceId,
      sourceType,
      limit,
    });

    const result = await adminDb.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      queries
    );

    return NextResponse.json({
      success: true,
      sessions: result.documents,
      total: result.total,
    });
  } catch (error: unknown) {
    const err = error as Error & { code?: number };
    console.error("[API] /api/practice-sessions GET error:", err);

    if (err.message?.includes("No session found")) {
      return NextResponse.json(
        { error: "Not authenticated. Please log in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to list practice sessions" },
      { status: 500 }
    );
  }
}
