'use client';

import { useState, useEffect } from 'react';
import { AuthDriver } from '@/lib/appwrite/driver/AuthDriver';
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
 * Returns { isAdmin, loading } to use in components
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const authDriver = new AuthDriver();
        const user = await authDriver.getCurrentUser();
        const adminStatus = await isUserAdmin(user);
        setIsAdmin(adminStatus);
        setError(null);
      } catch (err) {
        // User not authenticated or error fetching user
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
