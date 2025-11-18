import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, appwriteConfig } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';

/**
 * GET /api/admin/failed-webhooks
 *
 * Fetches failed webhook errors from webhook_error_queue collection.
 * Requires admin authentication via httpOnly cookie.
 *
 * Query Parameters:
 * - status: Filter by resolutionStatus (pending_admin_review, resolved, ignored)
 * - limit: Number of results (default: 25, max: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Returns:
 * - 200: List of webhook errors with pagination info
 * - 401: Not authenticated or not admin
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Admin Failed Webhooks API] Fetching webhook errors...');

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin Failed Webhooks API] User authenticated: ${user.$id}`);

    // Check if user has admin label - NO FALLBACK
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.error(`[Admin Failed Webhooks API] Non-admin user ${user.$id} attempted to access admin endpoint`);
      throw new Error('Unauthorized. Admin access required.');
    }

    console.log(`[Admin Failed Webhooks API] Admin user ${user.$id} accessing webhook errors`);

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // Validate and set pagination limits
    const limit = Math.min(Math.max(parseInt(limitParam || '25', 10), 1), 100);
    const offset = Math.max(parseInt(offsetParam || '0', 10), 0);

    // Build query array
    const queries: string[] = [
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
      Query.offset(offset)
    ];

    // Add status filter if provided
    if (statusFilter) {
      const validStatuses = ['pending_admin_review', 'resolved', 'ignored'];
      if (!validStatuses.includes(statusFilter)) {
        throw new Error(`Invalid status filter: ${statusFilter}. Valid values: ${validStatuses.join(', ')}`);
      }
      queries.push(Query.equal('resolutionStatus', statusFilter));
    }

    // Fetch webhook errors from database
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = appwriteConfig.webhookErrorQueueCollectionId;

    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      queries
    );

    console.log(`[Admin Failed Webhooks API] Found ${response.documents.length} webhook errors (total: ${response.total})`);

    // Transform documents to consistent format
    const webhookErrors = response.documents.map((doc: any) => ({
      $id: doc.$id,
      webhookEventId: doc.webhookEventId,
      errorMessage: doc.errorMessage,
      retryCount: doc.retryCount || 0,
      lastRetryAt: doc.lastRetryAt,
      resolutionStatus: doc.resolutionStatus,
      adminUserId: doc.adminUserId,
      adminNotes: doc.adminNotes,
      resolvedAt: doc.resolvedAt,
      $createdAt: doc.$createdAt,
      $updatedAt: doc.$updatedAt
    }));

    return NextResponse.json({
      success: true,
      webhookErrors,
      pagination: {
        total: response.total,
        limit,
        offset,
        hasMore: offset + limit < response.total
      }
    });

  } catch (error: any) {
    console.error('[Admin Failed Webhooks API] Failed to fetch webhook errors:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle authorization errors
    if (error.message && error.message.includes('Admin access required')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch webhook errors',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
