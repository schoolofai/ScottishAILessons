'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GoogleButton } from './GoogleButton';
import { validateEmail } from '@/lib/appwrite/auth';
import { Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      // Create client-side session first to get session secret
      const { Client, Account } = await import('appwrite');
      
      const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);
      
      const account = new Account(client);
      
      // First, try to delete any existing session
      try {
        await account.deleteSession('current');
        console.log('Deleted existing session');
      } catch (e) {
        console.log('No existing session to delete or failed to delete');
      }
      
      // Create session client-side 
      const session = await account.createEmailPasswordSession(email, password);
      
      console.log('Client-side session created:', {
        sessionId: session.$id,
        userId: session.userId,
        hasSecret: !!session.secret,
        secretLength: session.secret?.length,
        fullSession: session
      });

      // For debugging, check all possible localStorage keys
      const allLocalStorageKeys = Object.keys(localStorage);
      console.log('All localStorage keys:', allLocalStorageKeys);
      
      // Try to get session from various localStorage locations
      const possibleKeys = [
        `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`,
        `appwrite_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`,
        'appwrite_session'
      ];
      
      let localStorageSession = null;
      for (const key of possibleKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          console.log(`Found session in localStorage under key: ${key}`, value.substring(0, 50) + '...');
          localStorageSession = value;
          break;
        }
      }

      // Use the session secret, localStorage session, or fall back to session ID
      let sessionToken = session.secret || localStorageSession || session.$id;
      
      console.log('Using session token:', {
        hasSecret: !!session.secret,
        hasLocalStorage: !!localStorageSession,
        usingSessionId: !session.secret && !localStorageSession,
        tokenLength: sessionToken?.length
      });
      
      if (!sessionToken) {
        throw new Error('Session creation failed - no session token available');
      }

      // Send session token to server to store in httpOnly cookie
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionSecret: sessionToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="you@example.com"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
          disabled={loading}
        />
      </div>

      <div className="text-right">
        <Link href="/reset-password" className="text-sm text-blue-600 hover:underline">
          Forgot password?
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging in...
          </>
        ) : (
          'Login'
        )}
      </Button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <GoogleButton />

      <p className="text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}