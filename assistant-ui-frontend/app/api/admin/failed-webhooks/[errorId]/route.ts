import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, appwriteConfig } from '@/lib/server/appwrite';
import { ID } from 'node-appwrite';

/**
 * PATCH /api/admin/failed-webhooks/[errorId]
 *
 * Resolves a webhook error by updating its resolution status.
 * Creates an audit log entry for the resolution.
 * Requires admin authentication via httpOnly cookie.
 *
 * Request Body:
 * - resolutionStatus: 'resolved' | 'ignored' (required)
 * - adminNotes: string (required, min 10 chars)
 *
 * Returns:
 * - 200: Webhook error resolved successfully
 * - 400: Invalid request body or validation error
 * - 401: Not authenticated or not admin
 * - 404: Webhook error not found
 * - 500: Server error
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ errorId: string }> }
) {
  try {
    const { errorId } = await params;
    console.log(`[Admin Resolve Webhook API] Resolving webhook error: ${errorId}`);

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin Resolve Webhook API] User authenticated: ${user.$id}`);

    // Check if user has admin label - NO FALLBACK
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.error(`[Admin Resolve Webhook API] Non-admin user ${user.$id} attempted to resolve webhook error`);
      throw new Error('Unauthorized. Admin access required.');
    }

    // Parse and validate request body
    const body = await request.json();
    const { resolutionStatus, adminNotes } = body;

    // Validate resolutionStatus
    const validStatuses = ['resolved', 'ignored'];
    if (!resolutionStatus || !validStatuses.includes(resolutionStatus)) {
      throw new Error(`Invalid resolutionStatus. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Validate adminNotes
    if (!adminNotes || typeof adminNotes !== 'string') {
      throw new Error('adminNotes is required');
    }

    if (adminNotes.trim().length < 10) {
      throw new Error('adminNotes must be at least 10 characters');
    }

    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const webhookErrorCollectionId = appwriteConfig.webhookErrorQueueCollectionId;
    const auditLogsCollectionId = appwriteConfig.subscriptionAuditLogsCollectionId;

    // Fetch the webhook error to verify it exists
    let webhookError;
    try {
      webhookError = await databases.getDocument(
        databaseId,
        webhookErrorCollectionId,
        errorId
      );
    } catch (fetchError: any) {
      if (fetchError.code === 404) {
        throw new Error(`Webhook error not found: ${errorId}`);
      }
      throw fetchError;
    }

    console.log(`[Admin Resolve Webhook API] Found webhook error: ${webhookError.$id}, current status: ${webhookError.resolutionStatus}`);

    // Update the webhook error with resolution
    const resolvedAt = new Date().toISOString();
    const updatedError = await databases.updateDocument(
      databaseId,
      webhookErrorCollectionId,
      errorId,
      {
        resolutionStatus,
        adminUserId: user.$id,
        adminNotes: adminNotes.trim(),
        resolvedAt
      }
    );

    console.log(`[Admin Resolve Webhook API] Updated webhook error ${errorId} to status: ${resolutionStatus}`);

    // Create audit log entry for this resolution
    const auditLogEntry = {
      userId: user.$id,
      subscriptionId: `webhook_error_${errorId}`,
      timestamp: resolvedAt,
      previousStatus: webhookError.resolutionStatus || 'pending_admin_review',
      newStatus: resolutionStatus,
      triggerSource: 'manual_admin',
      eventId: webhookError.webhookEventId,
      adminUserId: user.$id,
      adminNotes: adminNotes.trim()
    };

    await databases.createDocument(
      databaseId,
      auditLogsCollectionId,
      ID.unique(),
      auditLogEntry
    );

    console.log(`[Admin Resolve Webhook API] Created audit log entry for webhook error resolution`);

    return NextResponse.json({
      success: true,
      message: `Webhook error ${resolutionStatus} successfully`,
      webhookError: {
        $id: updatedError.$id,
        webhookEventId: updatedError.webhookEventId,
        errorMessage: updatedError.errorMessage,
        retryCount: updatedError.retryCount,
        lastRetryAt: updatedError.lastRetryAt,
        resolutionStatus: updatedError.resolutionStatus,
        adminUserId: updatedError.adminUserId,
        adminNotes: updatedError.adminNotes,
        resolvedAt: updatedError.resolvedAt,
        $createdAt: updatedError.$createdAt,
        $updatedAt: updatedError.$updatedAt
      }
    });

  } catch (error: any) {
    console.error('[Admin Resolve Webhook API] Failed to resolve webhook error:', error);

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

    // Handle not found errors
    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    // Handle validation errors
    if (error.message && (
      error.message.includes('Invalid resolutionStatus') ||
      error.message.includes('adminNotes')
    )) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // Generic error - fast fail with explicit message
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to resolve webhook error',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
