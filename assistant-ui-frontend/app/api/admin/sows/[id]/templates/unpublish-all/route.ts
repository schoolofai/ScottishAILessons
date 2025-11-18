import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * POST /api/admin/sows/[id]/templates/unpublish-all
 *
 * Unpublishes all lesson templates for a specific SOW by updating their status to 'draft'.
 * Requires admin authentication via httpOnly cookie.
 *
 * FAST FAIL: Throws error immediately if operation fails (no fallback).
 *
 * Returns:
 * - 200: All templates unpublished successfully
 *   - success: true
 *   - message: Success message
 *   - count: Number of templates unpublished
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

    console.log(`[Admin Unpublish All Templates API] Unpublishing all templates for SOW ${sowId}...`);

    // Validate SOW ID
    if (!sowId || sowId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'SOW ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin Unpublish All Templates API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin Unpublish All Templates API] Non-admin user ${user.$id} attempted to unpublish templates`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin Unpublish All Templates API] Admin user ${user.$id} unpublishing all templates for SOW ${sowId}`);

    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'lesson_templates';

    // Fetch all templates for this SOW
    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      [Query.equal('authored_sow_id', sowId)]
    );

    // Update each template to draft status
    const updatePromises = response.documents.map(template =>
      databases.updateDocument(
        databaseId,
        collectionId,
        template.$id,
        { status: 'draft' }
      )
    );

    await Promise.all(updatePromises);

    console.info(`✅ Unpublished ${response.documents.length} templates for SOW ${sowId}`);

    return NextResponse.json({
      success: true,
      message: `Unpublished ${response.documents.length} lesson templates`,
      count: response.documents.length
    });

  } catch (error: any) {
    console.error('[Admin Unpublish All Templates API] Failed to unpublish templates:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Generic error - fast fail with explicit message (NO FALLBACK)
    return NextResponse.json(
      {
        success: false,
        error: error.message || `Failed to unpublish templates for SOW ${params.id}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
