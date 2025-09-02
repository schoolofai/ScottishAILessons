import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite/client';
import { getErrorMessage } from '@/lib/appwrite/auth';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const { account } = createAdminClient();
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`;

    try {
      await account.createRecovery(email, redirectUrl);

      return NextResponse.json({ 
        success: true, 
        message: 'Recovery email sent' 
      });
    } catch (error) {
      return NextResponse.json(
        { error: getErrorMessage(error) },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}