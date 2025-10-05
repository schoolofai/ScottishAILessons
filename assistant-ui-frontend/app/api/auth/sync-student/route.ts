import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite/client';
import { syncUserToStudentsCollection } from '@/lib/appwrite/server';

/**
 * Syncs a user account to the students collection.
 * Called after client-side signup creates the auth account.
 *
 * This endpoint is non-blocking - signup succeeds even if sync fails.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, name } = await request.json();

    if (!userId || !name) {
      return NextResponse.json(
        { error: 'User ID and name are required' },
        { status: 400 }
      );
    }

    console.log('[Sync Student] Starting sync for user:', { userId, name });

    // Sync user to students collection (idempotent - checks for existing record)
    const student = await syncUserToStudentsCollection(userId, name, 'student');

    console.log('[Sync Student] Success:', { studentId: student?.$id });

    return NextResponse.json({
      success: true,
      studentId: student?.$id
    });
  } catch (error) {
    console.error('[Sync Student] Error:', error);
    // Non-blocking error - user can still use the app
    return NextResponse.json(
      {
        error: 'Student sync failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
