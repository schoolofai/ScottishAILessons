import { NextResponse } from 'next/server';
import { createApiHeaders } from '../middleware/auth';

/**
 * Handles mock error scenarios for testing
 */
export async function handleMockError(errorToSimulate: string | null): Promise<NextResponse | null> {
  if (!errorToSimulate) {
    return null;
  }

  const headers = createApiHeaders();

  switch (errorToSimulate) {
    case 'timeout':
      // Simulate timeout by waiting then returning timeout error
      await new Promise(resolve => setTimeout(resolve, 100));
      return NextResponse.json(
        { error: 'Request timeout', statusCode: 500 },
        { status: 500, headers }
      );

    case 'malformed_response':
      return NextResponse.json(
        { error: 'Course Manager did not return recommendations', statusCode: 500 },
        { status: 500, headers }
      );

    case 'database_error':
      return NextResponse.json(
        { error: 'Database connection failed', statusCode: 500 },
        { status: 500, headers }
      );

    case 'service_unavailable':
      return NextResponse.json(
        { error: 'Unable to connect to Course Manager service', statusCode: 500 },
        { status: 500, headers }
      );

    default:
      return null;
  }
}

/**
 * Creates standardized error response for specific error types
 */
export function createErrorResponse(error: any): NextResponse {
  const headers = createApiHeaders();

  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message, statusCode: 404 },
        { status: 404, headers }
      );
    }

    if (error.message.includes('not enrolled') || error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message, statusCode: 403 },
        { status: 403, headers }
      );
    }
  }

  // Zero fallback policy - return error, don't provide placeholder data
  return NextResponse.json(
    {
      error: error?.message || 'Internal server error',
      statusCode: 500
    },
    { status: 500, headers }
  );
}