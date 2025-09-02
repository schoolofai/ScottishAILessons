import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite/client';
import { createSessionCookie, syncUserToStudentsCollection } from '@/lib/appwrite/server';
import { getErrorMessage } from '@/lib/appwrite/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { account } = createAdminClient();

    try {
      const session = await account.createEmailPasswordSession(email, password);
      
      await createSessionCookie(session.secret);

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { error: getErrorMessage(error) },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}