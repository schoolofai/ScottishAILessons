"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/appwrite';

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
      
      // Redirect to homepage after successful logout
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect on error to ensure user is logged out
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  return { logout, isLoading };
}