import { NextRequest, NextResponse } from 'next/server';
import { SessionDriver } from '@/lib/appwrite';
import { authenticateRequest, createApiHeaders } from '@/lib/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Authenticate the request to get session token
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return authResult.errorResponse!;
    }

    // Create SessionDriver with authenticated session token
    const sessionDriver = new SessionDriver(authResult.sessionToken!);

    await sessionDriver.updateLastMessageTime(sessionId);

    return NextResponse.json({ success: true }, {
      headers: createApiHeaders()
    });
  } catch (error) {
    console.error('Failed to update session message time:', error);
    return NextResponse.json(
      { error: 'Failed to update session timestamp' },
      { status: 500 }
    );
  }
}