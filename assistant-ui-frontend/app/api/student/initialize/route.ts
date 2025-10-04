import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/appwrite/server";
import { ID, Query } from "appwrite";
import { handleCourseEnrollment } from "@/lib/services/enrollment-service";

export async function POST(request: NextRequest) {
  try {
    const sessionSecret = request.cookies.get("a_session_68adb98e0020be2e134f")?.value;
    
    if (!sessionSecret) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { account, databases } = createSessionClient(sessionSecret);
    
    // Get current user
    const user = await account.get();
    
    // Check if student record exists
    let student;
    try {
      const studentsResult = await databases.listDocuments(
        'default',
        'students',
        [Query.equal('userId', user.$id)]
      );
      
      if (studentsResult.documents.length > 0) {
        student = studentsResult.documents[0];
      } else {
        // Create student record
        student = await databases.createDocument(
          'default',
          'students',
          ID.unique(),
          {
            userId: user.$id,
            name: user.name || user.email.split('@')[0],
            role: 'student'
          },
          [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
        );
      }
    } catch (error) {
      console.error('Error with student record:', error);
      return NextResponse.json({ error: "Failed to initialize student" }, { status: 500 });
    }

    // Get courses
    const coursesResult = await databases.listDocuments('default', 'courses');
    
    // Get lesson templates
    const templatesResult = await databases.listDocuments(
      'default', 
      'lesson_templates',
      [Query.equal('status', 'published')]
    );
    
    // Check enrollment and auto-enroll if needed
    const enrollmentsResult = await databases.listDocuments(
      'default',
      'enrollments',
      [
        Query.equal('studentId', student.$id),
        Query.equal('courseId', 'C844 73')
      ]
    );
    
    if (enrollmentsResult.documents.length === 0) {
      // Auto-enroll in National 3 course
      await databases.createDocument(
        'default',
        'enrollments',
        ID.unique(),
        {
          studentId: student.$id,
          courseId: 'C844 73',
          role: 'student'
        },
        [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
      );

      // Phase 4.1 MVP2.5: Copy Authored SOW to student's SOWV2
      try {
        await handleCourseEnrollment(student.$id, 'C844 73', databases);
        console.log(`[StudentInitialize] ✅ SOW copied for student ${student.$id}`);
      } catch (sowError) {
        // Log but don't fail enrollment if SOW copy fails
        console.error(`[StudentInitialize] ⚠️ Failed to copy SOW:`, sowError);
        // Continue with initialization even if SOW copy fails
      }
    }
    
    // Get student's sessions
    const sessionsResult = await databases.listDocuments(
      'default',
      'sessions',
      [Query.equal('studentId', student.$id)]
    );

    return NextResponse.json({
      student,
      courses: coursesResult.documents,
      lessonTemplates: templatesResult.documents,
      sessions: sessionsResult.documents
    });
    
  } catch (error) {
    console.error('Student initialization error:', error);
    return NextResponse.json(
      { error: "Failed to initialize student" }, 
      { status: 500 }
    );
  }
}