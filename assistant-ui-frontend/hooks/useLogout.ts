"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/appwrite';
import { mutate } from 'swr';

export function useLogout() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { logout: authLogout } = useAuth();

  const logout = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Use the new AuthDriver via useAuth hook
      await authLogout();

      // Clear all SWR cache to prevent stale data on next login
      mutate(() => true, undefined, { revalidate: false });

      // Redirect to homepage after successful logout
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Clear cache even on error to ensure clean state
      mutate(() => true, undefined, { revalidate: false });
      // Still redirect on error to ensure user is logged out
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  return { logout, isLoading };
}