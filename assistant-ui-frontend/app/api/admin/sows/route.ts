import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import type { AuthoredSOW } from '@/lib/appwrite/types';
import { decompressJSON } from '@/lib/appwrite/utils/compression';

/**
 * GET /api/admin/sows
 *
 * Fetches all SOWs (Scheme of Work) for admin review.
 * Requires admin authentication via httpOnly cookie.
 *
 * Returns:
 * - 200: List of SOWs
 *   - success: true
 *   - sows: Array of SOW documents with decompressed data
 * - 401: Not authenticated or not admin
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Admin SOWs API] Fetching all SOWs for admin...');

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin SOWs API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin SOWs API] Non-admin user ${user.$id} attempted to access admin endpoint`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin SOWs API] Admin user ${user.$id} accessing SOWs`);

    // Fetch all SOWs ordered by creation date (newest first)
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'Authored_SOW';

    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      [Query.orderDesc('$createdAt')]
    );

    console.log(`[Admin SOWs API] Found ${response.documents.length} SOWs`);

    // Transform the documents to match expected format
    // IMPORTANT: Both entries AND metadata may be gzip compressed
    // Use decompressJSON for both to handle compressed and uncompressed data
    const sows = response.documents.map((doc: any) => {
      const typedDoc = doc as AuthoredSOW;

      // Decompress entries and metadata
      const entries = decompressJSON(typedDoc.entries);
      const metadata = decompressJSON(typedDoc.metadata);

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

      return {
        $id: typedDoc.$id,
        courseId: typedDoc.courseId,
        version: typedDoc.version,
        status: typedDoc.status,
        entries: entries,
        metadata: {
          ...metadata,
          total_lessons: totalLessons,
          total_estimated_minutes: totalMinutes
        },
        accessibility_notes: typedDoc.accessibility_notes,
        $createdAt: typedDoc.$createdAt,
        $updatedAt: typedDoc.$updatedAt
      };
    });

    return NextResponse.json({
      success: true,
      sows
    });

  } catch (error: any) {
    console.error('[Admin SOWs API] Failed to fetch SOWs:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch SOWs',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
