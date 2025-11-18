/**
 * SubscriptionStatusCard Component
 *
 * Displays current subscription status, plan details, and next billing date.
 * Integrates with useSubscription hook for real-time status updates.
 *
 * Following constitution principles:
 * - No fallback mechanisms: Shows clear error states when data unavailable
 * - Fast fail: Explicit error handling for API failures
 * - No caching: Uses SWR's revalidation for fresh data
 */

'use client';

import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

export function SubscriptionStatusCard() {
  const { subscription, hasAccess, isLoading, error } = useSubscription();

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Error state - fast fail, no fallback
  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            Subscription Status Unavailable
          </CardTitle>
          <CardDescription className="text-red-600">
            Unable to load subscription information. Please refresh the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error: {error.message || 'Unknown error'}</p>
        </CardContent>
      </Card>
    );
  }

  // No subscription state
  if (!subscription || subscription.status === 'inactive') {
    return (
      <Card className="w-full border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="w-5 h-5" />
            No Active Subscription
          </CardTitle>
          <CardDescription className="text-yellow-600">
            Subscribe to access premium AI-powered lessons and features.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Active subscription
  const isActive = subscription.status === 'active' && hasAccess;
  const isPastDue = subscription.status === 'payment_failed' || subscription.status === 'past_due';
  const isCancelled = subscription.status === 'cancelled';

  // Format dates
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    if (isActive) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (isPastDue) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          Payment Failed
        </Badge>
      );
    }
    if (isCancelled) {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelled
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
        <Clock className="w-3 h-3 mr-1" />
        {subscription.status}
      </Badge>
    );
  };

  return (
    <Card className={`w-full ${isPastDue ? 'border-red-200 bg-red-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Subscription Status</CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          {isActive && 'Your subscription is active and in good standing.'}
          {isPastDue && 'Payment failed. Please update your payment method to restore access.'}
          {isCancelled && 'Your subscription has been cancelled.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Type */}
        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-sm font-medium text-gray-600">Plan</span>
          <span className="text-sm font-semibold">
            {subscription.planType === 'monthly_ai_access' ? 'Monthly AI Access' : subscription.planType}
          </span>
        </div>

        {/* Billing Cycle */}
        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-sm font-medium text-gray-600">Billing Cycle</span>
          <span className="text-sm capitalize">{subscription.billingCycle || 'Monthly'}</span>
        </div>

        {/* Next Billing Date */}
        {isActive && subscription.nextBillingDate && (
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-gray-600">Next Billing Date</span>
            <span className="text-sm">{formatDate(subscription.nextBillingDate)}</span>
          </div>
        )}

        {/* Start Date */}
        <div className="flex justify-between items-center py-2 border-b">
          <span className="text-sm font-medium text-gray-600">Started</span>
          <span className="text-sm">{formatDate(subscription.startDate)}</span>
        </div>

        {/* End Date (if cancelled) */}
        {isCancelled && subscription.endDate && (
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-gray-600">Ended</span>
            <span className="text-sm">{formatDate(subscription.endDate)}</span>
          </div>
        )}

        {/* Payment Status */}
        <div className="flex justify-between items-center py-2">
          <span className="text-sm font-medium text-gray-600">Payment Status</span>
          <span className={`text-sm font-medium ${
            subscription.paymentStatus === 'current' ? 'text-green-600' : 'text-red-600'
          }`}>
            {subscription.paymentStatus === 'current' ? 'Current' : 'Failed'}
          </span>
        </div>

        {/* Warning for past due */}
        {isPastDue && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              Your payment has failed. Access to lessons has been revoked. Please update your payment method
              to restore access.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
