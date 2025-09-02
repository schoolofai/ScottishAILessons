"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function useLogout() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const logout = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Clear any client-side state if needed
        // Redirect to login page
        router.push('/login');
      } else {
        console.error('Logout failed');
        // Still redirect on failure to ensure user is logged out
        router.push('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect on error to ensure user is logged out
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  return { logout, isLoading };
}