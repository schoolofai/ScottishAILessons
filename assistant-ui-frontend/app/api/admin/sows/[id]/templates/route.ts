import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/admin/sows/[id]/templates
 *
 * Fetches all lesson templates for a specific SOW.
 * Requires admin authentication via httpOnly cookie.
 *
 * FAST FAIL: Throws error immediately if operation fails (no fallback).
 *
 * Returns:
 * - 200: List of lesson templates
 *   - success: true
 *   - templates: Array of lesson template documents
 * - 400: Invalid SOW ID
 * - 401: Not authenticated or not admin
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sowId = params.id;

    console.log(`[Admin SOW Templates API] Fetching templates for SOW ${sowId}...`);

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

    console.log(`[Admin SOW Templates API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin SOW Templates API] Non-admin user ${user.$id} attempted to access templates`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin SOW Templates API] Admin user ${user.$id} fetching templates for SOW ${sowId}`);

    // Fetch lesson templates from database
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'lesson_templates';

    // Query templates by authored_sow_id to get only templates from this SOW
    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      [
        Query.equal('authored_sow_id', sowId),
        Query.orderAsc('sow_order')  // Order by SOW order
      ]
    );

    console.info(`✅ Fetched ${response.documents.length} templates for SOW ${sowId}`);

    return NextResponse.json({
      success: true,
      templates: response.documents
    });

  } catch (error: any) {
    console.error('[Admin SOW Templates API] Failed to fetch templates:', error);

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
        error: error.message || `Failed to fetch templates for SOW ${params.id}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
