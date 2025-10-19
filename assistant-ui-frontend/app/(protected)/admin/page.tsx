'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIsAdmin } from '@/lib/utils/adminCheck';
import { Header } from '@/components/ui/header';
import { SOWListView } from '@/components/admin/SOWListView';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';

/**
 * Admin Page - Main admin panel for reviewing and publishing SOWs and lesson templates
 * Only accessible to users with 'admin' label
 */
export default function AdminPage() {
  const { isAdmin, loading } = useIsAdmin();
  const router = useRouter();

  useEffect(() => {
    // Redirect non-admin users to dashboard
    if (!loading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, loading, router]);

  // Show loading state while checking admin status
  if (loading) {
    return (
      <div className="h-dvh flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-7xl mx-auto p-6">
            <InlineLoadingSkeleton />
          </div>
        </main>
      </div>
    );
  }

  // Don't render anything while redirecting non-admin users
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="h-dvh flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-2">
              Review and publish Schemes of Work (SOWs) and lesson templates
            </p>
          </div>

          {/* SOW List */}
          <SOWListView />
        </div>
      </main>
    </div>
  );
}
