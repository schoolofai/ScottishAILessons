/**
 * useServerAuth Hook
 *
 * Client-side hook that checks authentication status using server-side sessions (httpOnly cookies).
 * This is the correct way to check auth in the new SSR pattern.
 *
 * Uses the /api/auth/me endpoint which validates the httpOnly session cookie.
 */

'use client';

import useSWR from 'swr';

interface AuthMeResponse {
  success: boolean;
  user?: {
    $id: string;
    name: string;
    email: string;
    labels: string[];
  };
  isAdmin?: boolean;
  error?: string;
}

const fetcher = async (url: string): Promise<AuthMeResponse> => {
  const res = await fetch(url, {
    credentials: 'include', // Include httpOnly cookies
  });

  // If not authenticated, return success: false instead of throwing
  if (res.status === 401) {
    return { success: false };
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json();
};

/**
 * Hook to check authentication status using server-side session
 */
export function useServerAuth() {
  const { data, error, isLoading, mutate } = useSWR<AuthMeResponse>(
    '/api/auth/me',
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0,
      dedupingInterval: 2000, // Dedupe requests within 2 seconds
      shouldRetryOnError: false,
      onError: (err) => {
        console.error('[useServerAuth] Auth check failed:', err);
      }
    }
  );

  return {
    // Auth state
    isAuthenticated: data?.success === true,
    user: data?.user || null,
    isAdmin: data?.isAdmin || false,

    // Loading and error states
    isLoading,
    error: error?.message || null,

    // Manual refetch function
    refetch: mutate,
  };
}
