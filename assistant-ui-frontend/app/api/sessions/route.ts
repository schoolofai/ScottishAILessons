import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/server/appwrite";
import { ID, Query } from "node-appwrite";
import { compressJSON } from "@/lib/appwrite/utils/compression";

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user using secure httpOnly cookie
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    const { lessonTemplateId, courseId, threadId } = await request.json();

    if (!lessonTemplateId || !courseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    // Get student record
    const studentsResult = await databases.listDocuments(
      'default',
      'students', 
      [Query.equal('userId', user.$id)]
    );
    
    if (studentsResult.documents.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    
    const student = studentsResult.documents[0];
    
    // Get lesson template
    const lessonTemplate = await databases.getDocument(
      'default',
      'lesson_templates',
      lessonTemplateId
    );
    
    // Create lesson snapshot
    const lessonSnapshot = {
      title: lessonTemplate.title,
      outcomeRefs: JSON.parse(lessonTemplate.outcomeRefs),
      cards: JSON.parse(lessonTemplate.cards),
      templateVersion: lessonTemplate.version
    };
    
    // Create session with required status field
    const newSession = await databases.createDocument(
      'default',
      'sessions',
      ID.unique(),
      {
        studentId: student.$id,
        courseId: courseId,
        lessonTemplateId: lessonTemplateId,
        startedAt: new Date().toISOString(),
        stage: 'design',
        status: 'active', // Required field for session tracking
        lessonSnapshot: compressJSON(lessonSnapshot),
        // Include threadId if provided (for recommendation context)
        ...(threadId && { threadId })
      },
      [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
    );

    return NextResponse.json({ 
      sessionId: newSession.$id,
      session: newSession 
    });
    
  } catch (error: any) {
    console.error('[API] /api/sessions POST error:', error);

    // Handle authentication errors
    if (error.message && error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create session" },
      { status: 500 }
    );
  }
}