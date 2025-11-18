import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';

/**
 * POST /api/admin/sows/[id]/unpublish
 *
 * Unpublishes a SOW (Scheme of Work) by updating its status to 'draft'.
 * Requires admin authentication via httpOnly cookie.
 *
 * FAST FAIL: Throws error immediately if operation fails (no fallback).
 *
 * Returns:
 * - 200: SOW unpublished successfully
 *   - success: true
 *   - message: Success message
 * - 400: Invalid SOW ID
 * - 401: Not authenticated or not admin
 * - 500: Server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sowId = params.id;

    console.log(`[Admin SOWs Unpublish API] Unpublishing SOW ${sowId}...`);

    // Validate SOW ID
    if (!sowId || sowId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'SOW ID is required for unpublishing' },
        { status: 400 }
      );
    }

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin SOWs Unpublish API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin SOWs Unpublish API] Non-admin user ${user.$id} attempted to unpublish SOW`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin SOWs Unpublish API] Admin user ${user.$id} unpublishing SOW ${sowId}`);

    // Update SOW status to 'draft' (unpublished state)
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'Authored_SOW';

    await databases.updateDocument(
      databaseId,
      collectionId,
      sowId,
      { status: 'draft' }
    );

    console.info(`✅ SOW ${sowId} unpublished successfully`);

    return NextResponse.json({
      success: true,
      message: `SOW ${sowId} unpublished successfully`
    });

  } catch (error: any) {
    console.error('[Admin SOWs Unpublish API] Failed to unpublish SOW:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle document not found errors
    if (error.code === 404 || error.message?.includes('not found')) {
      return NextResponse.json(
        { success: false, error: `SOW not found: ${params.id}` },
        { status: 404 }
      );
    }

    // Generic error - fast fail with explicit message (NO FALLBACK)
    return NextResponse.json(
      {
        success: false,
        error: error.message || `Failed to unpublish SOW ${params.id}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
