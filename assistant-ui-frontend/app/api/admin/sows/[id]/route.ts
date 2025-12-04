import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { decompressJSON, compressJSON } from '@/lib/appwrite/utils/compression';

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

/**
 * PATCH /api/admin/sows/[id]
 *
 * Updates an existing SOW by ID for admin users.
 * Requires admin authentication via httpOnly cookie.
 *
 * FAST FAIL: Throws error immediately if operation fails (no fallback).
 *
 * Request body:
 * - entries: (optional) Array of SOWEntry objects
 * - metadata: (optional) SOWMetadata object
 * - status: (optional) 'draft' | 'published'
 * - accessibility_notes: (optional) string
 *
 * Returns:
 * - 200: Updated SOW data
 * - 400: Invalid request body
 * - 401: Not authenticated or not admin
 * - 404: SOW not found
 * - 500: Server error
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sowId = params.id;

    console.log(`[Admin SOWs Update API] Updating SOW ${sowId}...`);

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

    console.log(`[Admin SOWs Update API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin SOWs Update API] Non-admin user ${user.$id} attempted to update SOW`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    console.log(`[Admin SOWs Update API] Admin user ${user.$id} updating SOW ${sowId}`);
    console.log(`[Admin SOWs Update API] Update fields: ${Object.keys(body).join(', ')}`);

    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'Authored_SOW';

    // Build update payload - only include fields that are provided
    const updateData: Record<string, any> = {};

    // Handle entries - compress if provided
    if (body.entries !== undefined) {
      if (!Array.isArray(body.entries)) {
        return NextResponse.json(
          { success: false, error: 'entries must be an array' },
          { status: 400 }
        );
      }
      updateData.entries = compressJSON(body.entries);
      console.log(`[Admin SOWs Update API] Compressed ${body.entries.length} entries`);
    }

    // Handle metadata - compress if provided
    if (body.metadata !== undefined) {
      if (typeof body.metadata !== 'object' || body.metadata === null) {
        return NextResponse.json(
          { success: false, error: 'metadata must be an object' },
          { status: 400 }
        );
      }
      updateData.metadata = compressJSON(body.metadata);
      console.log(`[Admin SOWs Update API] Compressed metadata`);
    }

    // Handle status
    if (body.status !== undefined) {
      if (!['draft', 'published'].includes(body.status)) {
        return NextResponse.json(
          { success: false, error: 'status must be "draft" or "published"' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }

    // Handle accessibility_notes
    if (body.accessibility_notes !== undefined) {
      updateData.accessibility_notes = body.accessibility_notes;
    }

    // Handle version
    if (body.version !== undefined) {
      updateData.version = body.version;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the document
    const updatedDoc = await databases.updateDocument(
      databaseId,
      collectionId,
      sowId,
      updateData
    );

    console.info(`✅ SOW ${sowId} updated successfully`);

    // Decompress for response
    const entries = decompressJSON(updatedDoc.entries);
    const metadata = decompressJSON(updatedDoc.metadata);

    const entriesArray = Array.isArray(entries) ? entries : [];
    const totalLessons = metadata?.total_lessons ?? entriesArray.length;
    const totalMinutes = metadata?.total_estimated_minutes ?? entriesArray.reduce((sum: number, entry: any) => {
      if (!entry?.estMinutes) return sum;
      return sum + entry.estMinutes;
    }, 0);

    const decompressedSow = {
      ...updatedDoc,
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
    console.error('[Admin SOWs Update API] Failed to update SOW:', error);

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
        error: error.message || `Failed to update SOW ${params.id}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
