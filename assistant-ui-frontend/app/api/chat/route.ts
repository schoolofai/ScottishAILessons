import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, appwriteConfig } from "@/lib/appwrite/server";

export async function POST(request: NextRequest) {
  try {
    const sessionCookieName = `a_session_${appwriteConfig.projectId}`;
    const sessionId = request.cookies.get(sessionCookieName)?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { sessionId: lessonSessionId, event } = await request.json();
    
    if (!lessonSessionId || !event) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { account, databases } = createSessionClient(sessionId);
    const user = await account.get();
    
    // Get lesson session
    const lessonSession = await databases.getDocument(
      'default',
      'sessions',
      lessonSessionId
    );
    
    // For MVP, we'll do simple deterministic marking
    // Later this will call LangGraph
    
    // Record evidence
    const evidence = await databases.createDocument(
      'default',
      'evidence',
      `${lessonSessionId}_${event.itemId}_${Date.now()}`,
      {
        sessionId: lessonSessionId,
        itemId: event.itemId,
        response: event.value,
        correct: false // Will be determined by LangGraph
      },
      [`read("user:${user.$id}")`, `write("user:${user.$id}")`]
    );

    return NextResponse.json({ 
      success: true,
      evidence: evidence
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: "Failed to process response" }, 
      { status: 500 }
    );
  }
}