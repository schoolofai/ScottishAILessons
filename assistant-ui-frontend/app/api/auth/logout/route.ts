import { NextResponse } from 'next/server';
import { createSessionClient, SESSION_COOKIE } from '@/lib/server/appwrite';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Try to delete the session server-side if it exists
    try {
      const { account } = await createSessionClient();
      await account.deleteSession('current');
    } catch (error) {
      // Session may already be invalid, continue with cookie deletion
      console.log('[Logout] Session already invalid or not found');
    }

    // Clear the httpOnly session cookie
    // Must specify path to match the cookie that was set during login
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/', // Must match the path used during cookie creation
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Logout] Error:', error);

    // Even if there's an error, try to clear the cookie
    try {
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
    } catch (cookieError) {
      console.error('[Logout] Failed to clear cookie:', cookieError);
    }

    return NextResponse.json({ success: true });
  }
}