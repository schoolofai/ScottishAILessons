/**
 * Past Papers Availability API Route
 *
 * GET /api/past-papers/availability/[courseId]
 * Checks if past papers are available for a given course
 *
 * Returns: { available: boolean, subject?: string, level?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

const DATABASE_ID = 'sqa_education';
const COLLECTION_PAPERS = 'us_papers';
const COLLECTION_COURSES = 'default';
const COURSES_DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'default';
const COURSES_COLLECTION = 'courses';

interface CourseInfo {
  subject: string;
  level: string;
  sqaCode?: string;
}

/**
 * Maps course subject to past paper subject format
 * e.g., "mathematics" → "Mathematics"
 */
function normalizeSubject(subject: string): string {
  if (!subject) return '';
  // Capitalize first letter of each word
  return subject
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Maps course level to past paper level format
 * e.g., "national-5" → "National 5"
 */
function normalizeLevel(level: string): string {
  if (!level) return '';
  return level
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * GET /api/past-papers/availability/[courseId]
 * Checks if past papers are available for a course
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    // Validate user is authenticated
    try {
      const sessionClient = await createSessionClient();
      const account = sessionClient.account;
      await account.get();
    } catch {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.', statusCode: 401 },
        { status: 401 }
      );
    }

    const { courseId } = await params;

    // Validate courseId
    if (!courseId || courseId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Course ID is required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Get admin client for database access
    const { databases } = await createAdminClient();

    // Fetch course details to get subject and level
    // Query by courseId field since frontend passes courseId (e.g., "course_c84775")
    // not the Appwrite document $id
    let courseInfo: CourseInfo | null = null;

    const courseResult = await databases.listDocuments(
      COURSES_DB_ID,
      COURSES_COLLECTION,
      [
        Query.equal('courseId', courseId),
        Query.limit(1)
      ]
    );

    if (courseResult.documents.length === 0) {
      // Course not found
      console.log(`[API] Course not found for courseId: ${courseId}`);
      return NextResponse.json({
        success: true,
        available: false,
        reason: 'Course not found'
      });
    }

    const courseDoc = courseResult.documents[0];
    courseInfo = {
      subject: courseDoc.subject as string,
      level: courseDoc.level as string,
      sqaCode: courseDoc.sqaCode as string | undefined
    };

    // Normalize subject and level for querying past papers
    const normalizedSubject = normalizeSubject(courseInfo.subject);
    const normalizedLevel = normalizeLevel(courseInfo.level);

    // Check if any past papers exist for this subject/level combination
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_PAPERS,
      [
        Query.equal('subject', normalizedSubject),
        Query.equal('level', normalizedLevel),
        Query.limit(1) // We only need to know if at least one exists
      ]
    );

    const available = result.documents.length > 0;

    return NextResponse.json({
      success: true,
      available,
      subject: normalizedSubject,
      level: normalizedLevel,
      // URL-friendly versions for navigation
      subjectSlug: courseInfo.subject,
      levelSlug: courseInfo.level
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API] /api/past-papers/availability error:', err);

    return NextResponse.json(
      { error: err.message || 'Failed to check past papers availability', statusCode: 500 },
      { status: 500 }
    );
  }
}
