import { NextRequest, NextResponse } from 'next/server';
import { Client, Account } from 'appwrite';
import { appwriteConfig } from '@/lib/appwrite/server';
import { getErrorMessage } from '@/lib/appwrite/auth';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = `a_session_${appwriteConfig.projectId}`;

export async function POST(request: NextRequest) {
  try {
    const { sessionSecret } = await request.json();

    if (!sessionSecret) {
      return NextResponse.json(
        { error: 'Session secret is required' },
        { status: 400 }
      );
    }

    console.log('Storing session secret from client:', {
      hasSecret: !!sessionSecret,
      secretLength: sessionSecret?.length
    });

    // Set secure httpOnly cookie with session secret from client
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    console.log('Session cookie set with name:', SESSION_COOKIE_NAME);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}