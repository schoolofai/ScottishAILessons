import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

/**
 * GET /api/courses/[courseId]/curriculum
 *
 * Fetches all lesson templates for a course.
 * This is public data and doesn't require authentication.
 *
 * Query params:
 * - offset (optional): Pagination offset, default 0
 * - limit (optional): Pagination limit, default 100 (max)
 *
 * Returns:
 * - 200: Lesson templates
 *   - templates: Array of lesson template documents
 *   - total: Total count of templates
 *   - hasMore: Whether there are more templates to fetch
 * - 400: Missing courseId
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const { courseId } = params;
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100); // Max 100

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Curriculum API] Fetching lesson templates for course: ${courseId}, offset: ${offset}, limit: ${limit}`);

    // Create unauthenticated client for public lesson template data
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    const databases = new Databases(client);

    // Fetch lesson templates
    const templatesResult = await databases.listDocuments(
      'default',
      'lesson_templates',
      [
        Query.equal('courseId', courseId),
        Query.orderAsc('sow_order'),
        Query.limit(limit),
        Query.offset(offset)
      ]
    );

    const hasMore = templatesResult.documents.length === limit;

    console.log(`[Curriculum API] Found ${templatesResult.documents.length} lesson templates (offset: ${offset}, hasMore: ${hasMore})`);

    return NextResponse.json({
      success: true,
      data: {
        templates: templatesResult.documents,
        total: templatesResult.total,
        hasMore
      }
    });

  } catch (error: any) {
    console.error('[Curriculum API] Fatal error:', error);

    // Fast fail - throw explicit error, no fallbacks
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load curriculum',
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}
