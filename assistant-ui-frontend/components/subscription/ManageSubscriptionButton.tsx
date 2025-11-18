/**
 * ManageSubscriptionButton Component
 *
 * Opens Stripe Customer Portal for subscription management (payment method, cancel, invoices).
 * Uses /api/stripe/portal endpoint to create billing portal session.
 *
 * Following constitution principles:
 * - Fast fail: Shows error toast if portal creation fails
 * - No fallback mechanisms: Disabled state when subscription unavailable
 * - No caching: Fresh portal session created on each click
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Loader2 } from 'lucide-react';

interface ManageSubscriptionButtonProps {
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ManageSubscriptionButton({
  disabled = false,
  variant = 'outline',
  size = 'default',
  className = '',
}: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleManageSubscription = async () => {
    setIsLoading(true);

    try {
      console.log('[ManageSubscription] Creating portal session...');

      // Call portal API endpoint
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/dashboard`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const data = await response.json();

      console.log('[ManageSubscription] ✅ Portal session created');

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned from API');
      }
    } catch (error: any) {
      console.error('[ManageSubscription] Error:', error);

      // Fast fail - show error toast
      toast({
        title: 'Portal Access Failed',
        description: error.message || 'Unable to open subscription management portal. Please try again.',
        variant: 'destructive',
      });

      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleManageSubscription}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Opening Portal...
        </>
      ) : (
        <>
          <Settings className="mr-2 h-4 w-4" />
          Manage Subscription
        </>
      )}
    </Button>
  );
}
