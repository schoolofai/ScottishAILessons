import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/appwrite/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = request.cookies.get("appwrite-session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { databases } = createSessionClient(sessionId);
    
    const session = await databases.getDocument(
      'default',
      'sessions',
      params.id
    );

    return NextResponse.json(session);
    
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json(
      { error: "Failed to fetch session" }, 
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = request.cookies.get("appwrite-session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const updates = await request.json();
    const { databases } = createSessionClient(sessionId);
    
    const session = await databases.updateDocument(
      'default',
      'sessions',
      params.id,
      updates
    );

    return NextResponse.json(session);
    
  } catch (error) {
    console.error('Session update error:', error);
    return NextResponse.json(
      { error: "Failed to update session" }, 
      { status: 500 }
    );
  }
}