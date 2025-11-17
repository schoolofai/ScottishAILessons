import { NextRequest, NextResponse } from 'next/server';
import { createSessionClient } from '@/lib/server/appwrite';

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user with their profile data and labels.
 * This endpoint is used for client-side auth checks (e.g., admin verification).
 * Requires authentication via httpOnly cookie.
 *
 * Returns:
 * - 200: User data
 *   - success: true
 *   - user: User object with labels array
 *   - isAdmin: boolean (true if user has 'admin' label)
 * - 401: Not authenticated
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Auth Me API] Fetching current user...');

    // Get authenticated session - REQUIRED
    const { account } = await createSessionClient();
    const user = await account.get();

    console.log(`[Auth Me API] User authenticated: ${user.$id}`);

    // Check if user has admin label
    const labels = (user.labels || []) as string[];
    const isAdmin = labels.includes('admin');

    console.log(`[Auth Me API] User labels: ${labels.join(', ')}, isAdmin: ${isAdmin}`);

    return NextResponse.json({
      success: true,
      user: {
        $id: user.$id,
        name: user.name,
        email: user.email,
        labels: user.labels,
        emailVerification: user.emailVerification,
        status: user.status,
        registration: user.registration,
        passwordUpdate: user.passwordUpdate,
        phone: user.phone,
        phoneVerification: user.phoneVerification,
        prefs: user.prefs
      },
      isAdmin
    });

  } catch (error: any) {
    console.error('[Auth Me API] Authentication failed:', error);

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
        error: error.message || 'Failed to fetch user data',
        details: error.code || String(error)
      },
      { status: 500 }
    );
  }
}
