import { NextRequest, NextResponse } from 'next/server';
import { useAppwrite, SessionDriver } from '@/lib/appwrite';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { createDriver } = useAppwrite();
    const sessionDriver = createDriver(SessionDriver);
    
    await sessionDriver.updateLastMessageTime(sessionId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update session message time:', error);
    return NextResponse.json(
      { error: 'Failed to update session timestamp' },
      { status: 500 }
    );
  }
}