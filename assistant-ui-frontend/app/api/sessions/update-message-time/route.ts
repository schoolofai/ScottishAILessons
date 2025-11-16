/**
 * API Route: Update Session Last Message Time
 *
 * Endpoint: POST /api/sessions/update-message-time
 * Purpose: Update the lastMessageAt timestamp for a session
 * Authentication: Required (Appwrite session via SSR)
 *
 * Refactored to use SSR authentication pattern for consistency with Stripe routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionDriver } from '@/lib/appwrite';
import { createSessionClient } from '@/lib/server/appwrite';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated databases instance using SSR session client
    const { databases } = await createSessionClient();

    // Create SessionDriver with authenticated databases instance
    const sessionDriver = new SessionDriver(databases);

    await sessionDriver.updateLastMessageTime(sessionId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Update Message Time API] Error:', error);

    // Handle authentication errors
    if (error.message.includes('No session found')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update session timestamp' },
      { status: 500 }
    );
  }
}