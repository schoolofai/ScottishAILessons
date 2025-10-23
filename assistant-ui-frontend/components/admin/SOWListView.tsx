'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AuthoredSOWDriver } from '@/lib/appwrite/driver/AuthoredSOWDriver';
import { CourseDriver } from '@/lib/appwrite/driver/CourseDriver';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { AlertCircle } from 'lucide-react';
import type { AuthoredSOWData } from '@/lib/appwrite/types';

/**
 * SOWListView displays all authored SOWs with their statuses
 * Allows admin to view details and publish SOWs
 */
export function SOWListView() {
  const [sows, setSOWs] = useState<Array<AuthoredSOWData & { $id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [courseById, setCourseById] = useState<Record<string, { subject: string; level: string }>>({});

  useEffect(() => {
    fetchSOWs();
  }, []);

  async function fetchSOWs() {
    try {
      setLoading(true);
      setError(null);
      const driver = new AuthoredSOWDriver();
      const data = await driver.getAllSOWsForAdmin();
      setSOWs(data);

      // Fetch course metadata (subject/level) for unique courseIds in parallel
      const uniqueCourseIds = Array.from(new Set((data || []).map(s => s.courseId).filter(Boolean)));
      if (uniqueCourseIds.length > 0) {
        const courseDriver = new CourseDriver();
        const courseResults = await Promise.all(
          uniqueCourseIds.map(id => courseDriver.getCourseByCourseId(id).catch(() => null))
        );

        const map: Record<string, { subject: string; level: string }> = {};
        for (const c of courseResults) {
          if (c && c.courseId) {
            map[c.courseId] = { subject: c.subject, level: c.level };
          }
        }
        setCourseById(map);
      } else {
        setCourseById({});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load SOWs';
      setError(message);
      console.error('[SOWListView] Error fetching SOWs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(sowId: string, event: React.MouseEvent) {
    event.stopPropagation();

    if (!confirm('Publish this SOW? This action cannot be undone.')) {
      return;
    }

    try {
      setPublishingId(sowId);
      const driver = new AuthoredSOWDriver();
      await driver.publishSOW(sowId);

      // Refresh the list
      await fetchSOWs();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish SOW';
      setError(message);
      console.error('[SOWListView] Error publishing SOW:', err);
    } finally {
      setPublishingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <InlineLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading SOWs</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (sows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No SOWs found</p>
      </div>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
      case 'review':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Authored SOWs</h2>
          <p className="text-sm text-gray-600 mt-1">
            {sows.length} SOW{sows.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {sows.map(sow => (
          <Link
            key={sow.$id}
            href={`/admin/sow/${sow.$id}`}
            className="no-underline"
          >
            <div className="border rounded-lg p-4 hover:bg-gray-50 hover:shadow-md transition-all cursor-pointer">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">
                    {sow.metadata.course_name}
                  </h3>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Course ID:</span> {sow.courseId}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Subject:</span> {courseById[sow.courseId]?.subject ?? '—'} •{' '}
                      <span className="font-medium">Level:</span> {courseById[sow.courseId]?.level ?? '—'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Version:</span> {sow.version}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Lessons:</span> {sow.metadata.total_lessons} •{' '}
                      <span className="font-medium">Est. Duration:</span> {sow.metadata.total_estimated_minutes} min
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 items-start ml-4">
                  <Badge variant={getStatusVariant(sow.status)} className="whitespace-nowrap">
                    {sow.status}
                  </Badge>

                  {sow.status !== 'published' && (
                    <Button
                      size="sm"
                      onClick={(e) => handlePublish(sow.$id, e)}
                      disabled={publishingId === sow.$id}
                    >
                      {publishingId === sow.$id ? 'Publishing...' : 'Publish'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
