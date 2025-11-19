/**
 * Login API Route
 *
 * Uses explicit Response headers for cookie setting,
 * which works better with proxy environments like Replit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Client, Account } from 'node-appwrite';

const SESSION_COOKIE = 'appwrite_session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Create admin client for session creation
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const account = new Account(client);

    // Create session
    const session = await account.createEmailPasswordSession(email, password);

    console.log('[Login API] Session created:', {
      userId: session.userId,
      sessionId: session.$id
    });

    // Create response with explicit Set-Cookie header
    const response = NextResponse.json({
      success: true,
      userId: session.userId
    });

    // Set cookie with explicit options
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    console.log('[Login API] Cookie set in response:', {
      name: SESSION_COOKIE,
      secure: isProduction,
      sameSite: 'lax',
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('[Login API] Error:', error);

    if (error.code === 401) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}
