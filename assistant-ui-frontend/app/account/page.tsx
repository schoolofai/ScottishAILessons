/**
 * Account Page
 *
 * User account and subscription management page.
 * Separates billing/subscription concerns from the education-focused dashboard.
 *
 * Features:
 * - User profile information
 * - Subscription status display
 * - Manage Subscription button (Stripe Customer Portal)
 *
 * Following constitution principles:
 * - Fast fail: Errors show immediately
 * - No fallback mechanisms: Clear error states
 * - Separation of concerns: Billing separate from education
 */

'use client';

import { useServerAuth } from '@/hooks/useServerAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard';
import { ManageSubscriptionButton } from '@/components/subscription/ManageSubscriptionButton';
import { Header } from '@/components/ui/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, User, Mail, Shield } from 'lucide-react';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AccountPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useServerAuth();
  const { hasAccess, stripeCustomerId, isLoading: subscriptionLoading } = useSubscription();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      redirect('/login');
    }
  }, [authLoading, isAuthenticated]);

  // Show loading state while auth is being checked
  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-4xl mx-auto py-8 px-4">
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show error if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-4xl mx-auto py-8 px-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                Authentication Required
              </CardTitle>
              <CardDescription className="text-red-600">
                Please log in to view your account settings.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto py-8 px-4">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your profile and subscription
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Section */}
          <Card data-testid="profile-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email */}
              <div className="flex items-center gap-3 py-2 border-b">
                <Mail className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Email</p>
                  <p className="text-sm">{user?.email || 'Not available'}</p>
                </div>
              </div>

              {/* User ID */}
              <div className="flex items-center gap-3 py-2 border-b">
                <Shield className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">User ID</p>
                  <p className="text-sm font-mono text-gray-500">
                    {user?.$id || 'Not available'}
                  </p>
                </div>
              </div>

              {/* Access Status */}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-gray-600">AI Features Access</span>
                <span className={`text-sm font-semibold ${
                  hasAccess ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {subscriptionLoading ? 'Checking...' : hasAccess ? 'Active' : 'Limited'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Section */}
          <div className="space-y-4" data-testid="subscription-status-card">
            <SubscriptionStatusCard />

            {/* Manage Subscription Button */}
            {stripeCustomerId && (
              <div className="flex justify-end" data-testid="manage-subscription-button">
                <ManageSubscriptionButton
                  variant="default"
                  size="default"
                  className="w-full md:w-auto"
                />
              </div>
            )}

            {/* Subscribe CTA for non-subscribed users */}
            {!hasAccess && !stripeCustomerId && !subscriptionLoading && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <p className="text-sm text-blue-800 text-center">
                    Subscribe to unlock AI-powered lessons and features.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Additional Account Options */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>
                Additional account management options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-500">
                Need help? Contact support at support@scottishailessons.com
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
