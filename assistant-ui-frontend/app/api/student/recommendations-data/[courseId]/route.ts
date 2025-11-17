import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";
import { MasteryV2Driver } from "@/lib/appwrite/driver/MasteryV2Driver";

/**
 * GET /api/student/recommendations-data/[courseId]
 * Fetch mastery and SOW data needed for recommendations via httpOnly cookie
 * Replaces client-side MasteryV2Driver and SOW database calls
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    // Get authenticated user using secure httpOnly cookie
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    const { courseId } = params;

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

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

    // Fetch mastery data using MasteryV2Driver with server-side databases
    const masteryV2Driver = new MasteryV2Driver(databases as any);
    const masteryV2Record = await masteryV2Driver.getMasteryV2(student.$id, courseId);

    // Fetch SOW data
    const sowResult = await databases.listDocuments(
      'default',
      'SOWV2',
      [
        Query.equal('studentId', student.$id),
        Query.equal('courseId', courseId)
      ]
    );

    // Return both datasets
    return NextResponse.json({
      success: true,
      data: {
        mastery: masteryV2Record,
        sow: sowResult.documents
      }
    });

  } catch (error: any) {
    console.error('[API] /api/student/recommendations-data/[courseId] GET error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch recommendations data" },
      { status: 500 }
    );
  }
}
