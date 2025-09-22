import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMockSession, shouldSimulateError } from '../appwrite/mock-data';
import { appwriteConfig } from '../appwrite/client';

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
export async function authenticateRequest(request?: NextRequest): Promise<AuthResult> {
  let sessionToken: string | undefined;

  // First, try to get session from cookies - look for any session cookie
  const cookieStore = await cookies();
  let sessionCookie;

  // Try the expected cookie name first
  const expectedCookieName = `a_session_${appwriteConfig.projectId}`;
  sessionCookie = cookieStore.get(expectedCookieName);

  // If not found, look for any cookie that starts with a_session_
  if (!sessionCookie) {
    const allCookies = cookieStore.getAll();
    sessionCookie = allCookies.find(cookie => cookie.name.startsWith('a_session_'));
  }

  console.log('[Auth Debug] Authentication attempt:', {
    hasCookieStore: !!cookieStore,
    expectedCookieName,
    foundCookieName: sessionCookie?.name || 'NONE',
    hasCookie: !!sessionCookie,
    hasRequest: !!request,
    requestUrl: request?.url || 'NO_REQUEST'
  });

  // Check headers first (they have the full JWT token)
  if (request) {
    const authHeader = request.headers.get('Authorization');
    const sessionHeader = request.headers.get('X-Session-Token');

    console.log('[Auth Debug] Checking request headers first:', {
      hasAuthHeader: !!authHeader,
      hasSessionHeader: !!sessionHeader,
      authHeaderPreview: authHeader?.substring(0, 30) + '...' || 'NO_AUTH_HEADER',
      sessionHeaderPreview: sessionHeader?.substring(0, 20) + '...' || 'NO_SESSION_HEADER'
    });

    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('[Auth Debug] Using Bearer token from header');
    } else if (sessionHeader) {
      sessionToken = sessionHeader;
      console.log('[Auth Debug] Using X-Session-Token from header');
    }
  }

  // Fallback to cookies if no header token found
  if (!sessionToken && sessionCookie) {
    sessionToken = sessionCookie.value;
    console.log('[Auth Debug] Using session token from cookie as fallback:', {
      hasToken: !!sessionToken,
      tokenLength: sessionToken?.length || 0,
      tokenPreview: sessionToken?.substring(0, 20) + '...' || 'NO_TOKEN',
      cookieName: sessionCookie.name
    });
  }

  if (!sessionToken) {
    console.log('[Auth Debug] No session token found, returning 401');
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

  console.log('[Auth Debug] Session token found, authentication successful:', {
    tokenLength: sessionToken.length,
    tokenPreview: sessionToken.substring(0, 20) + '...'
  });

  return {
    success: true,
    sessionToken: sessionToken
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