'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Client, Databases } from 'appwrite';
import type { BaseDriver } from '../driver/BaseDriver';

/**
 * Hook for managing Appwrite session and creating driver instances
 * Centralizes the localStorage session extraction logic used across components
 */
export function useAppwrite() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const extractSession = () => {
      try {
        // Extract session from localStorage.cookieFallback (same pattern used in components)
        const cookieFallback = localStorage.getItem('cookieFallback');
        if (cookieFallback) {
          const cookieData = JSON.parse(cookieFallback);
          const sessionKey = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
          const storedSession = cookieData[sessionKey];

          if (storedSession) {
            setSessionToken(storedSession);
          }
        }
      } catch (error) {
        console.error('Failed to extract session from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    extractSession();
  }, []);

  /**
   * Create Databases instance with current session
   */
  const databases = useMemo(() => {
    if (!sessionToken) {
      return null;
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setSession(sessionToken);

    return new Databases(client);
  }, [sessionToken]);

  /**
   * Factory method to create driver instances with the current session
   */
  const createDriver = useCallback(<T extends BaseDriver>(
    DriverClass: new (sessionToken?: string) => T
  ): T => {
    return new DriverClass(sessionToken);
  }, [sessionToken]);

  /**
   * Check if user is authenticated (has valid session)
   */
  const isAuthenticated = Boolean(sessionToken);

  /**
   * Clear session (for logout scenarios)
   */
  const clearSession = useCallback(() => {
    setSessionToken(null);
    localStorage.removeItem('cookieFallback');
  }, []);

  return {
    createDriver,
    databases,
    sessionToken,
    isAuthenticated,
    isLoading,
    clearSession
  };
}