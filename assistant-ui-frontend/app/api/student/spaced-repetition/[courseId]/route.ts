import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { Query } from "node-appwrite";
import { getReviewRecommendations, getReviewStats, getUpcomingReviews } from "@/lib/services/spaced-repetition-service";

/**
 * GET /api/student/spaced-repetition/[courseId]
 * Fetch spaced repetition data (reviews, stats, upcoming) via httpOnly cookie
 * Replaces client-side service calls that need authentication
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

    console.log('[API] Fetching spaced repetition data for:', {
      studentId: student.$id,
      userId: user.$id,
      courseId
    });

    // Call spaced repetition service functions with authenticated databases instance
    // Note: Increased limit from 5 to 50 so all overdue lessons are shown
    // (previously was limited to 5, causing mismatch with stats showing total count)
    const [recommendations, stats, upcoming] = await Promise.all([
      getReviewRecommendations(student.$id, courseId, databases as any, 50),
      getReviewStats(student.$id, courseId, databases as any),
      getUpcomingReviews(student.$id, courseId, databases as any, 14)  // Show next 2 weeks
    ]);

    console.log('[API] Spaced repetition results:', {
      recommendationsCount: recommendations?.length || 0,
      hasStats: !!stats,
      upcomingCount: upcoming?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        stats,
        upcomingReviews: upcoming
      }
    });

  } catch (error: any) {
    console.error('[API] /api/student/spaced-repetition/[courseId] GET error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to fetch spaced repetition data" },
      { status: 500 }
    );
  }
}
