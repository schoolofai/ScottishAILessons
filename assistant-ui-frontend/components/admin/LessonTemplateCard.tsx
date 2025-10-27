'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LessonDriver } from '@/lib/appwrite/driver/LessonDriver';
import { decompressCards } from '@/lib/appwrite/utils/compression';
import { JsonViewer } from './JsonViewer';
import { MarkdownPreview } from './MarkdownPreview';
import { jsonToMarkdown } from '@/lib/utils/jsonToMarkdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, AlertCircle, Edit } from 'lucide-react';
import type { LessonTemplate } from '@/lib/appwrite/types';

interface LessonTemplateCardProps {
  template: LessonTemplate;
  onPublish?: () => void;
}

/**
 * LessonTemplateCard displays a single lesson template with expandable details
 * Shows JSON and markdown preview, allows publishing
 */
export function LessonTemplateCard({ template, onPublish }: LessonTemplateCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'json' | 'markdown'>('json');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decompress cards for display
  let decompressedCards = [];
  try {
    decompressedCards = decompressCards(template.cards);
  } catch (err) {
    console.error('[LessonTemplateCard] Error decompressing cards:', err);
    decompressedCards = [];
  }

  const templateData = {
    ...template,
    cards: decompressedCards
  };

  const markdown = jsonToMarkdown(templateData);

  async function handlePublish(event: React.MouseEvent) {
    event.stopPropagation();

    if (!confirm('Publish this lesson template? This action cannot be undone.')) {
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      const driver = new LessonDriver();
      await driver.publishTemplate(template.$id);

      // Refresh parent component
      onPublish?.();
      setIsOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish template';
      setError(message);
      console.error('[LessonTemplateCard] Error publishing:', err);
    } finally {
      setPublishing(false);
    }
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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg bg-white hover:shadow-md transition-shadow">
        {/* Header Row - Trigger and Actions */}
        <div className="flex items-center p-4 hover:bg-gray-50 group">
          {/* Expandable Trigger (Chevron + Title) */}
          <CollapsibleTrigger className="flex-1 flex items-center gap-4 min-w-0 -m-4 p-4">
            <ChevronDown
              className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />

            <div className="text-left flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{template.title}</h4>
              <p className="text-sm text-gray-600 mt-1">
                Order: {template.sow_order} • Cards: {decompressedCards.length} • Est: {template.estMinutes}
                min
              </p>
            </div>
          </CollapsibleTrigger>

          {/* Status Badge, Edit Cards, and Publish Button (Outside Trigger) */}
          <div className="flex gap-2 items-center flex-shrink-0 ml-4">
            <Badge variant={getStatusVariant(template.status)}>{template.status}</Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/admin/lesson/${template.$id}`);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Cards
            </Button>

            {template.status !== 'published' && (
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </Button>
            )}
          </div>
        </div>

        <CollapsibleContent>
          <div className="p-4 border-t space-y-4 bg-gray-50">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* View Toggle */}
            <Tabs value={view} onValueChange={(v) => setView(v as 'json' | 'markdown')}>
              <TabsList>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
              </TabsList>

              <TabsContent value="json" className="pt-4">
                <JsonViewer data={templateData} title="Lesson Template Details" />
              </TabsContent>

              <TabsContent value="markdown" className="pt-4">
                <MarkdownPreview markdown={markdown} title="Lesson Template Preview" />
              </TabsContent>
            </Tabs>

            {/* Card Count Info */}
            {decompressedCards.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">{decompressedCards.length}</span> lesson card
                  {decompressedCards.length !== 1 ? 's' : ''} included
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
