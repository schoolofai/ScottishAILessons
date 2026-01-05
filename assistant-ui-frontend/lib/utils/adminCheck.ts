'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/lib/appwrite/types';

/**
 * Check if user has admin label
 * Admin users have 'admin' in their labels array
 */
export async function isUserAdmin(user: User): Promise<boolean> {
  if (!user) return false;

  // Appwrite User object has labels array
  // This is stored at user.labels and is an array of strings
  const labels = (user.labels || []) as string[];
  return labels.includes('admin');
}

/**
 * Hook for checking admin status
 * Returns { isAdmin, loading, error } to use in components
 *
 * Uses server-side API endpoint to check authentication and admin status
 * (cannot use client SDK as it can't access httpOnly session cookies)
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // Include httpOnly cookies
        });

        if (!response.ok) {
          if (response.status === 401) {
            // User not authenticated
            setIsAdmin(false);
            setError(null); // Not an error, just not authenticated
            return;
          }

          const errorData = await response.json().catch(() => ({ error: 'Failed to check admin status' }));
          throw new Error(errorData.error || 'Failed to check admin status');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to check admin status');
        }

        setIsAdmin(result.isAdmin || false);
        setError(null);
      } catch (err) {
        // Network error or server error
        console.error('[useIsAdmin] Failed to check admin status:', err);
        setIsAdmin(false);
        setError(err instanceof Error ? err : new Error('Failed to check admin status'));
      } finally {
        setLoading(false);
      }
    }

    checkAdmin();
  }, []);

  return { isAdmin, loading, error };
}
