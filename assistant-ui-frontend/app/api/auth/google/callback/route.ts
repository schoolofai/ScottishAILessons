import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/appwrite';
import { createSessionCookie, syncUserToStudentsCollection } from '@/lib/appwrite/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const secret = searchParams.get('secret');

    if (!userId || !secret) {
      return NextResponse.redirect(new URL('/login?error=invalid_callback', request.url));
    }

    const { account } = createAdminClient();

    try {
      const session = await account.createSession(userId, secret);
      
      await createSessionCookie(session.secret);
      
      const user = await account.get();
      await syncUserToStudentsCollection(user.$id, user.name, 'student');

      return NextResponse.redirect(new URL('/chat', request.url));
    } catch (error) {
      console.error('OAuth callback error:', error);
      return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
    }
  } catch (error) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url));
  }
}