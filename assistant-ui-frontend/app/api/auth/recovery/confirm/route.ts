import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/appwrite';
import { getErrorMessage } from '@/lib/appwrite/auth';

export async function POST(request: NextRequest) {
  try {
    const { userId, secret, newPassword } = await request.json();

    if (!userId || !secret || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { account } = createAdminClient();

    try {
      await account.updateRecovery(userId, secret, newPassword);

      return NextResponse.json({ 
        success: true, 
        message: 'Password reset successful' 
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