/**
 * SubscriptionStatusBanner Component
 *
 * Displays dismissible alert banners for subscription issues:
 * - Red alert for payment_failed status with "Update Payment Method" button
 * - Yellow alert for cancelled status with resubscribe guidance
 *
 * Following constitution principles:
 * - Fast fail: Clear error states and direct action buttons
 * - No fallback mechanisms: Explicit error handling
 * - No localStorage persistence: Banner reappears on page reload
 */

'use client';

import React, { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, XCircle, X, ExternalLink } from 'lucide-react';

export function SubscriptionStatusBanner() {
  const { status, isLoading, error, stripeCustomerId } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Handle redirect to Customer Portal
  const handleUpdatePayment = async () => {
    setIsRedirecting(true);
    setPortalError(null);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { url } = await response.json();

      if (!url) {
        throw new Error('No portal URL returned from API');
      }

      // Redirect to Stripe Customer Portal
      window.location.href = url;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access customer portal';
      setPortalError(errorMessage);
      setIsRedirecting(false);
      console.error('[SubscriptionStatusBanner] Portal redirect error:', err);
    }
  };

  // Don't render if dismissed, loading, or no issues
  if (isDismissed || isLoading) {
    return null;
  }

  // Don't render if there's an API error - let other components handle that
  if (error) {
    return null;
  }

  // Only show banner for payment_failed or cancelled status
  if (status !== 'payment_failed' && status !== 'cancelled') {
    return null;
  }

  // Payment failed banner - red/destructive
  if (status === 'payment_failed') {
    return (
      <div
        className="w-full"
        data-testid="subscription-status-banner"
        data-status="payment_failed"
      >
        <Alert
          variant="destructive"
          className="relative bg-red-50 border-red-300 text-red-800"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-8">
            <div className="flex-1">
              <span className="font-semibold">Payment Failed</span>
              <span className="mx-2">-</span>
              <span>Your subscription payment has failed. Please update your payment method to restore access to lessons.</span>
            </div>
            <div className="flex items-center gap-2">
              {stripeCustomerId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUpdatePayment}
                  disabled={isRedirecting}
                  className="whitespace-nowrap bg-red-600 hover:bg-red-700"
                  data-testid="update-payment-button"
                >
                  {isRedirecting ? (
                    'Redirecting...'
                  ) : (
                    <>
                      Update Payment Method
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </AlertDescription>

          {/* Dismiss button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-3 right-3 p-1 rounded-md hover:bg-red-200 transition-colors"
            aria-label="Dismiss banner"
            data-testid="dismiss-banner-button"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Portal error message */}
          {portalError && (
            <div
              className="mt-2 text-sm text-red-600"
              data-testid="portal-error-message"
            >
              Error: {portalError}
            </div>
          )}
        </Alert>
      </div>
    );
  }

  // Cancelled subscription banner - yellow/warning
  if (status === 'cancelled') {
    return (
      <div
        className="w-full"
        data-testid="subscription-status-banner"
        data-status="cancelled"
      >
        <Alert
          variant="default"
          className="relative bg-yellow-50 border-yellow-300 text-yellow-800"
        >
          <XCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-8">
            <div className="flex-1">
              <span className="font-semibold">Subscription Cancelled</span>
              <span className="mx-2">-</span>
              <span>Your subscription has been cancelled. You may have limited access until the end of your billing period.</span>
            </div>
            <div className="flex items-center gap-2">
              {stripeCustomerId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUpdatePayment}
                  disabled={isRedirecting}
                  className="whitespace-nowrap border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                  data-testid="manage-subscription-button"
                >
                  {isRedirecting ? (
                    'Redirecting...'
                  ) : (
                    <>
                      Manage Subscription
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </AlertDescription>

          {/* Dismiss button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-3 right-3 p-1 rounded-md hover:bg-yellow-200 transition-colors"
            aria-label="Dismiss banner"
            data-testid="dismiss-banner-button"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Portal error message */}
          {portalError && (
            <div
              className="mt-2 text-sm text-yellow-700"
              data-testid="portal-error-message"
            >
              Error: {portalError}
            </div>
          )}
        </Alert>
      </div>
    );
  }

  return null;
}
