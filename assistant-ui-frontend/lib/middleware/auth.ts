import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMockSession, shouldSimulateError } from '../appwrite/mock-data';

export interface AuthResult {
  success: boolean;
  sessionToken?: string;
  mockSession?: any;
  errorToSimulate?: string | null;
  errorResponse?: NextResponse;
}

/**
 * Authentication middleware for API routes
 * Handles session validation and mock session detection
 */
export async function authenticateRequest(): Promise<AuthResult> {
  // Get session from cookies
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'Authentication required', statusCode: 401 },
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      )
    };
  }

  // Check for mock session (for testing)
  const mockSession = getMockSession(sessionCookie.value);
  const errorToSimulate = shouldSimulateError(sessionCookie.value);

  // Handle invalid session tokens (not in mock data and not a real session)
  if (sessionCookie.value === 'invalid-session-token') {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { error: 'User not found', statusCode: 401 },
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      )
    };
  }

  return {
    success: true,
    sessionToken: sessionCookie.value,
    mockSession,
    errorToSimulate
  };
}

/**
 * Create standardized HTTP headers for API responses
 */
export function createApiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };
}