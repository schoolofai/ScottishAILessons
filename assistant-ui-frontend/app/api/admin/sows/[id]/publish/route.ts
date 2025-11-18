import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';

/**
 * POST /api/admin/sows/[id]/publish
 *
 * Publishes a SOW (Scheme of Work) by updating its status to 'published'.
 * Requires admin authentication via httpOnly cookie.
 *
 * Returns:
 * - 200: SOW published successfully
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

    console.log(`[Admin SOWs Publish API] Publishing SOW ${sowId}...`);

    // Validate SOW ID
    if (!sowId || sowId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'SOW ID is required for publishing' },
        { status: 400 }
      );
    }

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin SOWs Publish API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin SOWs Publish API] Non-admin user ${user.$id} attempted to publish SOW`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin SOWs Publish API] Admin user ${user.$id} publishing SOW ${sowId}`);

    // Update SOW status to 'published'
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'Authored_SOW';

    await databases.updateDocument(
      databaseId,
      collectionId,
      sowId,
      { status: 'published' }
    );

    console.info(`✅ SOW ${sowId} published successfully`);

    return NextResponse.json({
      success: true,
      message: `SOW ${sowId} published successfully`
    });

  } catch (error: any) {
    console.error('[Admin SOWs Publish API] Failed to publish SOW:', error);

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

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || `Failed to publish SOW ${params.id}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
