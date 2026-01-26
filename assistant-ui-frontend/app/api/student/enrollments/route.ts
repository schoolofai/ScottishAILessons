import { NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * Calculate lesson progress for a list of courses
 * Fetches lesson templates and completed sessions to compute actual progress
 */
async function calculateCourseProgress(
  databases: any,
  courses: any[],
  studentId: string
): Promise<any[]> {
  if (courses.length === 0) return [];

  const courseIds = courses.map(c => c.courseId);

  // Fetch lesson templates for all courses (only published ones count)
  const lessonTemplatesResult = await databases.listDocuments(
    'default',
    'lesson_templates',
    [
      Query.equal('courseId', courseIds),
      Query.equal('status', 'published'),
      Query.limit(500) // Handle courses with many lessons
    ]
  );

  // Group lesson templates by courseId
  const lessonsByCoureId: Record<string, string[]> = {};
  for (const template of lessonTemplatesResult.documents) {
    const courseId = template.courseId;
    if (!lessonsByCoureId[courseId]) {
      lessonsByCoureId[courseId] = [];
    }
    lessonsByCoureId[courseId].push(template.$id);
  }

  // Fetch all completed sessions for this student
  const sessionsResult = await databases.listDocuments(
    'default',
    'sessions',
    [
      Query.equal('studentId', studentId),
      Query.equal('status', 'completed'),
      Query.limit(1000) // Handle students with many sessions
    ]
  );

  // Group completed lesson template IDs by courseId
  const completedByCoureId: Record<string, Set<string>> = {};
  for (const session of sessionsResult.documents) {
    const lessonTemplateId = session.lessonTemplateId;
    // Find which course this lesson belongs to
    for (const [courseId, lessonIds] of Object.entries(lessonsByCoureId)) {
      if (lessonIds.includes(lessonTemplateId)) {
        if (!completedByCoureId[courseId]) {
          completedByCoureId[courseId] = new Set();
        }
        completedByCoureId[courseId].add(lessonTemplateId);
        break;
      }
    }
  }

  // Enrich courses with calculated progress
  return courses.map(course => {
    const courseId = course.courseId;
    const totalLessons = lessonsByCoureId[courseId]?.length || 0;
    const completedLessons = completedByCoureId[courseId]?.size || 0;
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      ...course,
      totalLessons,
      completedLessons,
      progress
    };
  });
}

/**
 * GET /api/student/enrollments
 *
 * Fetches enrollments and courses for the authenticated student.
 * Returns both active and archived enrollments with full course data.
 * Dynamically calculates lesson progress from lesson_templates and sessions.
 *
 * Returns:
 * - 200: Enrollment and course data with calculated progress
 * - 401: Not authenticated
 * - 500: Server error
 */
export async function GET() {
  try {
    // Get authenticated session from httpOnly cookie
    const { account, databases } = await createSessionClient();

    // Get current user
    const user = await account.get();

    // Find student record
    const studentsResult = await databases.listDocuments(
      'default',
      'students',
      [Query.equal('userId', user.$id)]
    );

    if (studentsResult.documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student record not found' },
        { status: 404 }
      );
    }

    const student = studentsResult.documents[0];

    // Get ALL enrollments
    const allEnrollmentsResult = await databases.listDocuments(
      'default',
      'enrollments',
      [Query.equal('studentId', student.$id)]
    );

    // Separate active and archived
    const activeEnrollments = allEnrollmentsResult.documents.filter((e: any) => {
      return !e.status || e.status === 'active';
    });

    const archivedEnrollments = allEnrollmentsResult.documents.filter((e: any) => {
      return e.status === 'archived';
    });

    // Get course IDs
    const activeCourseIds = activeEnrollments.map((e: any) => e.courseId);
    const archivedCourseIds = archivedEnrollments.map((e: any) => e.courseId);

    // Fetch courses in PARALLEL (performance optimization)
    // Both queries run simultaneously instead of sequentially
    const [activeCoursesResult, archivedCoursesResult] = await Promise.all([
      activeCourseIds.length > 0
        ? databases.listDocuments('default', 'courses', [Query.equal('courseId', activeCourseIds)])
        : Promise.resolve({ documents: [] }),
      archivedCourseIds.length > 0
        ? databases.listDocuments('default', 'courses', [Query.equal('courseId', archivedCourseIds)])
        : Promise.resolve({ documents: [] })
    ]);

    // Calculate actual lesson progress for each course
    // This fixes the 0/0 bug by computing from lesson_templates + sessions
    const [activeCoursesWithProgress, archivedCoursesWithProgress] = await Promise.all([
      calculateCourseProgress(databases, activeCoursesResult.documents, student.$id),
      calculateCourseProgress(databases, archivedCoursesResult.documents, student.$id)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        student,
        enrollments: {
          active: activeEnrollments,
          archived: archivedEnrollments
        },
        courses: {
          active: activeCoursesWithProgress,
          archived: archivedCoursesWithProgress
        }
      }
    });

  } catch (error) {
    console.error('[API] /api/student/enrollments error:', error);

    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch enrollment data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
