import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, appwriteConfig } from "@/lib/appwrite/server";
import { ID, Query } from "appwrite";
import { compressJSON } from "@/lib/appwrite/utils/compression";

export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = `a_session_${appwriteConfig.projectId}`;
    const sessionId = request.cookies.get(sessionCookieName)?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { lessonTemplateId, courseId } = await request.json();
    
    if (!lessonTemplateId || !courseId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { account, databases } = createSessionClient(sessionId);
    const user = await account.get();
    
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
    
    // Create session
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
        lessonSnapshot: compressJSON(lessonSnapshot)
      },
      [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
    );

    return NextResponse.json({ 
      sessionId: newSession.$id,
      session: newSession 
    });
    
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: "Failed to create session" }, 
      { status: 500 }
    );
  }
}