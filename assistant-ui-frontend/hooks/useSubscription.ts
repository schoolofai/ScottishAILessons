/**
 * useSubscription Hook
 *
 * Fetches current user's subscription status for access control decisions
 * Uses SWR with NO caching (security-critical data)
 *
 * Following constitution principles:
 * - No caching: Always fetch fresh subscription status
 * - Fast fail: Throw errors for authentication failures
 */

'use client';

import useSWR from 'swr';

interface SubscriptionDetails {
  planType: 'monthly_ai_access';
  billingCycle: 'monthly' | 'annual';
  paymentStatus: 'current' | 'past_due' | 'failed';
  nextBillingDate: string | null;
  lastPaymentDate: string | null;
}

interface SubscriptionStatusResponse {
  status: 'active' | 'inactive' | 'payment_failed' | 'cancelled';
  hasAccess: boolean;
  testUserFlag: boolean;
  subscriptionExpiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscription: SubscriptionDetails | null;
}

const fetcher = async (url: string): Promise<SubscriptionStatusResponse> => {
  const res = await fetch(url, {
    credentials: 'include', // Include cookies for Appwrite session
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json();
};

/**
 * Hook to fetch and manage subscription status
 * T038: SWR-based subscription status fetching with NO caching
 * T039: Error handling for authentication failures and API errors
 */
export function useSubscription() {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionStatusResponse>(
    '/api/stripe/subscription-status',
    fetcher,
    {
      // CRITICAL: No caching - always fetch fresh data
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0, // No automatic refresh
      dedupingInterval: 0, // No deduplication
      shouldRetryOnError: false, // Don't retry on auth errors
      onError: (err) => {
        console.error('[useSubscription] API Error:', err);
      }
    }
  );

  return {
    // Subscription status
    status: data?.status || 'inactive',
    hasAccess: data?.hasAccess || false,
    testUserFlag: data?.testUserFlag || false,
    subscription: data?.subscription || null,

    // Stripe IDs
    stripeCustomerId: data?.stripeCustomerId || null,
    stripeSubscriptionId: data?.stripeSubscriptionId || null,
    subscriptionExpiresAt: data?.subscriptionExpiresAt || null,

    // Loading and error states
    isLoading,
    error: error?.message || null,

    // Manual refetch function
    refetch: mutate,
  };
}
