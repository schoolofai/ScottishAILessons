'use client';

import { useState, useCallback } from 'react';
import { AuthDriver } from '../driver/AuthDriver';
import { useAppwrite } from './useAppwrite';
import type { User } from '../types';

/**
 * Authentication hook providing auth operations and state management
 */
export function useAuth() {
  const { createDriver, clearSession, isAuthenticated } = useAppwrite();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authDriver = createDriver(AuthDriver);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const session = await authDriver.login(email, password);
      const currentUser = await authDriver.getCurrentUser();
      
      setUser(currentUser);
      return { session, user: currentUser };
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [authDriver]);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await authDriver.logout();
      clearSession();
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, [authDriver, clearSession]);

  const getCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const currentUser = await authDriver.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (err: any) {
      setError(err.message || 'Failed to get user');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authDriver]);

  const createAccount = useCallback(async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const account = await authDriver.createAccount(email, password, name);
      return account;
    } catch (err: any) {
      const errorMessage = err.message || 'Account creation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [authDriver]);

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // Actions
    login,
    logout,
    getCurrentUser,
    createAccount,
    
    // Driver access for advanced operations
    authDriver
  };
}