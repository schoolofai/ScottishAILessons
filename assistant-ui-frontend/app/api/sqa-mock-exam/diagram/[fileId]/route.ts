import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';
import { createLogger } from '@/lib/logger';

const log = createLogger('API/sqa-mock-exam/diagram');

// Storage bucket for exam diagrams (matches backend appwrite_client.py)
const EXAM_DIAGRAMS_BUCKET_ID = "exam_diagrams";

/**
 * GET /api/sqa-mock-exam/diagram/[fileId]
 *
 * Proxies diagram images from Appwrite Storage with server-side authentication.
 * This solves the 401 issue when browser <img> tags try to access the bucket directly.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId || fileId.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'File ID is required' },
        { status: 400 }
      );
    }

    log.debug(`Fetching diagram: ${fileId}`);

    // Get authenticated storage client
    const { storage } = await createSessionClient();

    // Fetch the file from Appwrite Storage
    const fileBuffer = await storage.getFileView(
      EXAM_DIAGRAMS_BUCKET_ID,
      fileId
    );

    // Return the image with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error: unknown) {
    log.error('Error fetching diagram', { error });

    // Handle authentication errors
    if (error instanceof Error && error.message.includes('No session found')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated. Please log in.' },
        { status: 401 }
      );
    }

    // Handle file not found
    if (error instanceof Error && (
      error.message.includes('not found') ||
      error.message.includes('404')
    )) {
      return NextResponse.json(
        { success: false, error: 'Diagram not found' },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch diagram';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
