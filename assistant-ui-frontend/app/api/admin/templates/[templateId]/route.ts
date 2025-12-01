import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';

/**
 * DELETE /api/admin/templates/[templateId]
 *
 * Permanently deletes a lesson template.
 * Requires admin authentication via httpOnly cookie.
 *
 * FAST FAIL: Throws error immediately if operation fails (no fallback).
 *
 * Returns:
 * - 200: Template deleted successfully
 *   - success: true
 *   - message: Confirmation message
 * - 400: Invalid template ID
 * - 401: Not authenticated or not admin
 * - 500: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const templateId = params.templateId;

    console.log(`[Admin Template Delete API] Deleting template ${templateId}...`);

    // Validate template ID
    if (!templateId || templateId.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Get authenticated session - REQUIRED
    const { account, databases } = await createSessionClient();
    const user = await account.get();

    console.log(`[Admin Template Delete API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    if (!isAdmin) {
      console.warn(`[Admin Template Delete API] Non-admin user ${user.$id} attempted to delete template`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    console.log(`[Admin Template Delete API] Admin user ${user.$id} deleting template ${templateId}`);

    // Delete lesson template from database
    const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const collectionId = 'lesson_templates';

    await databases.deleteDocument(databaseId, collectionId, templateId);

    console.info(`✅ Template ${templateId} deleted successfully by admin ${user.$id}`);

    return NextResponse.json({
      success: true,
      message: `Template ${templateId} deleted successfully`
    });

  } catch (error: any) {
    console.error('[Admin Template Delete API] Failed to delete template:', error);

    // Handle authentication errors
    if (error.message && (error.message.includes('No session found') || error.message.includes('Invalid session'))) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle not found errors
    if (error.code === 404) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Generic error - fast fail with explicit message (NO FALLBACK)
    return NextResponse.json(
      {
        success: false,
        error: error.message || `Failed to delete template ${params.templateId}`,
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
