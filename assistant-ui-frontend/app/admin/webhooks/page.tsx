'use client';

import { useRouter } from 'next/navigation';
import { AdminFailedWebhooksTable } from '@/components/admin/AdminFailedWebhooksTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useIsAdmin } from '@/lib/utils/adminCheck';

/**
 * Admin Webhooks Page
 *
 * Displays failed webhook errors for admin resolution.
 * Protected by admin role check via server API.
 *
 * Following constitution principles:
 * - Fast fail: Clear error states for non-admin users
 * - No fallback mechanisms: Explicit access denied
 */
export default function AdminWebhooksPage() {
  const router = useRouter();
  const { isAdmin, loading, error } = useIsAdmin();

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Access Denied. This page is restricted to administrators only.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Admin: Webhook Management</h1>
        <p className="text-gray-600 mt-2">
          View and resolve failed Stripe webhook events
        </p>
      </div>

      <AdminFailedWebhooksTable />
    </div>
  );
}
