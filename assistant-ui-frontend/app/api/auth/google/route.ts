import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite/client';
import { OAuthProvider } from 'appwrite';

export async function GET() {
  try {
    const { account } = createAdminClient();
    
    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
    const failureUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login?error=oauth_failed`;
    
    const redirectUrl = await account.createOAuth2Token(
      OAuthProvider.Google,
      successUrl,
      failureUrl
    );

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth' },
      { status: 500 }
    );
  }
}