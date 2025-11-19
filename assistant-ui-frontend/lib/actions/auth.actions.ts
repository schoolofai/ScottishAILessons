/**
 * Authentication Server Actions
 *
 * Following Appwrite's official SSR pattern for Next.js
 * Uses node-appwrite with "use server" directive
 *
 * These actions handle all authentication operations server-side:
 * - Login creates session and stores in httpOnly cookie
 * - Logout deletes session and clears cookie
 * - Get user retrieves current authenticated user
 */

"use server";

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient, createSessionClient, SESSION_COOKIE } from '@/lib/server/appwrite';

/**
 * Sign in with email and password
 *
 * Flow:
 * 1. Use admin client to create session with Appwrite
 * 2. Store session.secret in httpOnly cookie
 * 3. Return success or error
 *
 * @param email User's email address
 * @param password User's password
 * @returns Success status or error message
 */
export async function signInWithEmail(email: string, password: string) {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }

    // Create session using admin client (server-side)
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    // Debug: Log full session object to see available properties
    console.log('[Auth] Session created:', {
      $id: session.$id,
      userId: session.userId,
      hasSecret: !!session.secret,
      secretLength: session.secret?.length || 0,
      provider: session.provider,
      // List all keys to see what's available
      keys: Object.keys(session)
    });

    // The secret is what we need for authentication
    const sessionSecret = session.secret;

    if (!sessionSecret) {
      console.error('[Auth] ERROR: Session created but no secret returned!');
      console.error('[Auth] Session object:', JSON.stringify(session, null, 2));
      throw new Error('Session created but authentication token not available');
    }

    // Store session.secret in httpOnly cookie
    // Note: secure:true requires HTTPS, but some proxies (like Replit) may need adjustments
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, sessionSecret, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax', // Changed from 'strict' to 'lax' to support Stripe redirects
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Log cookie details for debugging
    console.log('[Auth] Cookie set:', {
      name: SESSION_COOKIE,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      secretLength: sessionSecret.length
    });

    console.log('[Auth] Login successful:', {
      userId: session.userId,
      sessionId: session.$id,
      cookieName: SESSION_COOKIE
    });

    return {
      success: true,
      userId: session.userId
    };

  } catch (error: any) {
    console.error('[Auth] Login error:', error);

    // Provide user-friendly error messages
    if (error.code === 401) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }

    return {
      success: false,
      error: error.message || 'Login failed. Please try again.'
    };
  }
}

/**
 * Sign out current user
 *
 * Flow:
 * 1. Use session client to delete session from Appwrite
 * 2. Clear session cookie
 * 3. Redirect to login page
 */
export async function signOut() {
  try {
    // Delete session from Appwrite
    const { account } = await createSessionClient();
    await account.deleteSession('current');

    console.log('[Auth] Logout successful - session deleted from Appwrite');
  } catch (error) {
    console.error('[Auth] Error deleting session from Appwrite:', error);
    // Continue to clear cookie even if Appwrite deletion fails
  }

  // Clear session cookie
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  console.log('[Auth] Logout complete - cookie cleared');

  // Redirect to login page
  redirect('/login');
}

/**
 * Get currently logged in user
 *
 * @returns User object or null if not authenticated
 */
export async function getLoggedInUser() {
  try {
    // Use session client to get current user
    const { account } = await createSessionClient();
    const user = await account.get();

    console.log('[Auth] Got logged in user:', {
      userId: user.$id,
      email: user.email,
      name: user.name
    });

    return user;

  } catch (error: any) {
    // If no session or invalid session, return null (not an error)
    if (error.message === 'No session found. User is not authenticated.') {
      console.log('[Auth] No authenticated user');
      return null;
    }

    console.error('[Auth] Error getting user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 *
 * @returns boolean indicating if user has valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getLoggedInUser();
  return user !== null;
}
