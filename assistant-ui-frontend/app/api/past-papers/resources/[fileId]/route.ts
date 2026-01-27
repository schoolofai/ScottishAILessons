/**
 * Resource Download Proxy Route
 *
 * GET /api/past-papers/resources/[fileId]?filename=...
 *
 * Downloads a supporting resource file from the us_resources bucket.
 * Requires authentication to access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient, createAdminClient } from '@/lib/server/appwrite';

const BUCKET_ID = 'us_resources';

/**
 * GET /api/past-papers/resources/[fileId]
 * Downloads a resource file with proper Content-Disposition header
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Validate user is authenticated
    try {
      const sessionClient = await createSessionClient();
      const account = sessionClient.account;
      await account.get();
    } catch {
      return NextResponse.json(
        { error: 'Not authenticated. Please log in.', statusCode: 401 },
        { status: 401 }
      );
    }

    const { fileId } = await params;

    // Validate fileId
    if (!fileId || fileId.trim().length === 0) {
      return NextResponse.json(
        { error: 'File ID is required', statusCode: 400 },
        { status: 400 }
      );
    }

    // Get filename from query params (optional but recommended)
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename') || `resource-${fileId}`;

    console.log(`[API] Downloading resource: ${fileId} as "${filename}"`);

    // Use admin client to fetch file from storage
    const { storage } = await createAdminClient();

    // Get file download from Appwrite storage
    const fileBuffer = await storage.getFileDownload(BUCKET_ID, fileId);

    // Determine content type based on filename extension
    const contentType = getContentType(filename);

    // Return the file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[API] /api/past-papers/resources/[fileId] GET error:', err);

    // Check for Appwrite not found error
    if (err.message?.includes('not found') || err.message?.includes('404')) {
      return NextResponse.json(
        { error: 'Resource file not found', statusCode: 404 },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: err.message || 'Failed to download resource', statusCode: 500 },
      { status: 500 }
    );
  }
}

/**
 * Get MIME type from filename extension
 */
function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();

  const mimeTypes: Record<string, string> = {
    // Data files
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',

    // Spreadsheets
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',

    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',

    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}
