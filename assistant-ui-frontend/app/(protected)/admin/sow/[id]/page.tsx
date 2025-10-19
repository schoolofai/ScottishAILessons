'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useIsAdmin } from '@/lib/utils/adminCheck';
import { Header } from '@/components/ui/header';
import { SOWDetailView } from '@/components/admin/SOWDetailView';
import { Button } from '@/components/ui/button';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ArrowLeft } from 'lucide-react';

/**
 * SOW Detail Page - Shows full details of a specific SOW with JSON and markdown preview
 * Only accessible to admin users
 */
export default function SOWDetailPage() {
  const { isAdmin, loading } = useIsAdmin();
  const router = useRouter();
  const params = useParams();
  const sowId = params.id as string;

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
          {/* Back Button */}
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Panel
          </Button>

          {/* SOW Detail View */}
          <SOWDetailView sowId={sowId} />
        </div>
      </main>
    </div>
  );
}
