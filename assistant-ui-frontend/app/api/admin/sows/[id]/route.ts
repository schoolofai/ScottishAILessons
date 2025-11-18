import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { decompressJSON } from '@/lib/appwrite/utils/compression';

/**
 * GET /api/admin/sows/[id]
 *
 * Fetches a single SOW by ID for admin users.
 * Requires admin authentication via httpOnly cookie.
 *
 * FAST FAIL: Throws error immediately if operation fails (no fallback).
 *
 * Returns:
 * - 200: SOW data
 *   - success: true
 *   - sow: SOW document with metadata
 * - 400: Invalid SOW ID
 * - 401: Not authenticated or not admin
 * - 404: SOW not found
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sowId = params.id;

    console.log(`[Admin SOWs Detail API] Fetching SOW ${sowId}...`);

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

    console.log(`[Admin SOWs Detail API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin SOWs Detail API] Non-admin user ${user.$id} attempted to access SOW details`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin SOWs Detail API] Admin user ${user.$id} fetching SOW ${sowId}`);

    // Fetch SOW from database
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'Authored_SOW';

    const sowDoc = await databases.getDocument(
      databaseId,
      collectionId,
      sowId
    );

    console.info(`✅ SOW ${sowId} fetched successfully`);

    // Decompress entries and metadata fields
    // These may be gzip compressed in the database
    const entries = decompressJSON(sowDoc.entries);
    const metadata = decompressJSON(sowDoc.metadata);

    // Calculate total_lessons and total_estimated_minutes from entries if not in metadata
    const entriesArray = Array.isArray(entries) ? entries : [];
    const totalLessons = metadata?.total_lessons ?? entriesArray.length;

    // Parse duration strings like "20 minutes", "15 min", "1 hour" etc.
    const totalMinutes = metadata?.total_estimated_minutes ?? entriesArray.reduce((sum: number, entry: any) => {
      if (!entry?.duration) return sum;
      const durationStr = String(entry.duration).toLowerCase();
      const match = durationStr.match(/(\d+)/);
      if (!match) return sum;
      const num = parseInt(match[1], 10);
      if (durationStr.includes('hour')) return sum + num * 60;
      return sum + num; // Assume minutes
    }, 0);

    const decompressedSow = {
      ...sowDoc,
      entries: entries,
      metadata: {
        ...metadata,
        total_lessons: totalLessons,
        total_estimated_minutes: totalMinutes
      }
    };

    return NextResponse.json({
      success: true,
      sow: decompressedSow
    });

  } catch (error: any) {
    console.error('[Admin SOWs Detail API] Failed to fetch SOW:', error);

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
        error: error.message || `Failed to fetch SOW ${params.id}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
