'use client';

import { useState, useEffect } from 'react';
import { AuthoredSOWDriver } from '@/lib/appwrite/driver/AuthoredSOWDriver';
import { LessonDriver } from '@/lib/appwrite/driver/LessonDriver';
import { JsonViewer } from './JsonViewer';
import { MarkdownPreview } from './MarkdownPreview';
import { jsonToMarkdown } from '@/lib/utils/jsonToMarkdown';
import { LessonTemplateCard } from './LessonTemplateCard';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import type { AuthoredSOWData } from '@/lib/appwrite/types';
import type { LessonTemplate } from '@/lib/appwrite/types';

interface SOWDetailViewProps {
  sowId: string;
}

/**
 * SOWDetailView displays a single SOW with JSON and markdown preview
 * Also shows associated lesson templates
 */
export function SOWDetailView({ sowId }: SOWDetailViewProps) {
  const [sow, setSOW] = useState<AuthoredSOWData & { $id: string } | null>(null);
  const [templates, setTemplates] = useState<LessonTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [sowId]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const sowDriver = new AuthoredSOWDriver();
      const lessonDriver = new LessonDriver();

      const sowData = await sowDriver.getSOWById(sowId);
      // FIX: Query templates by authored_sow_id (sowId) instead of courseId
      // This ensures we only fetch templates generated from THIS specific SOW
      // not all templates ever created for the course
      const templatesData = await lessonDriver.getTemplatesByAuthoredSOWId(sowId);

      setSOW(sowData);
      setTemplates(templatesData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load SOW details';
      setError(message);
      console.error('[SOWDetailView] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading SOW</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!sow) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">SOW not found</p>
      </div>
    );
  }

  const sowMarkdown = jsonToMarkdown(sow);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold">{sow.metadata.course_name}</h2>
          <p className="text-gray-600 mt-1">v{sow.version} | Course ID: {sow.courseId}</p>
        </div>
        <Badge variant={getStatusVariant(sow.status)} className="text-lg px-3 py-1">
          {sow.status}
        </Badge>
      </div>

      {/* SOW Metadata Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-600">Lessons</p>
          <p className="text-2xl font-bold">{sow.metadata.total_lessons}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Total Duration</p>
          <p className="text-2xl font-bold">{sow.metadata.total_estimated_minutes}m</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Weeks</p>
          <p className="text-2xl font-bold">{sow.metadata.weeks || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Generated</p>
          <p className="text-sm font-medium">{sow.metadata.author_agent_version}</p>
        </div>
      </div>

      {/* SOW Tabs */}
      <div className="bg-white">
        <Tabs defaultValue="json" className="w-full">
          <TabsList className="border-b">
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="p-0 pt-6">
            <JsonViewer data={sow} title="SOW JSON Structure" />
          </TabsContent>

          <TabsContent value="markdown" className="p-0 pt-6">
            <MarkdownPreview markdown={sowMarkdown} title="SOW Markdown Preview" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Associated Lesson Templates */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">
            Associated Lesson Templates ({templates.length})
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            These templates are referenced in this SOW
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No lesson templates found for this SOW</div>
        ) : (
          <div className="grid gap-3">
            {templates.map(template => (
              <LessonTemplateCard key={template.$id} template={template} onPublish={fetchData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
