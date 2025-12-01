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
import { ChevronDown, AlertCircle, Edit, Upload, Archive, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { toast } from 'sonner';
import type { LessonTemplate } from '@/lib/appwrite/types';

/**
 * Format lesson_type from snake_case to display-friendly format
 * e.g., 'independent_practice' -> 'Independent Practice'
 */
function formatLessonType(lessonType: string): string {
  return lessonType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get badge variant based on lesson type
 */
function getLessonTypeBadgeVariant(lessonType: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (lessonType) {
    case 'teach':
      return 'default';
    case 'independent_practice':
      return 'secondary';
    case 'formative_assessment':
      return 'outline';
    case 'revision':
      return 'secondary';
    case 'mock_exam':
      return 'destructive';
    default:
      return 'outline';
  }
}

interface LessonTemplateCardProps {
  template: LessonTemplate;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDelete?: () => void;
}

/**
 * LessonTemplateCard displays a single lesson template with expandable details
 * Shows JSON and markdown preview, allows publishing and unpublishing
 */
export function LessonTemplateCard({ template, onPublish, onUnpublish, onDelete }: LessonTemplateCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'json' | 'markdown'>('json');
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  async function handlePublishConfirm() {
    try {
      setPublishing(true);
      setError(null);
      const driver = new LessonDriver();
      await driver.publishTemplate(template.$id);

      toast.success('Lesson published successfully!');
      // Refresh parent component
      onPublish?.();
      setShowPublishConfirm(false);
      setIsOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish template';
      setError(message);
      toast.error(message);
      console.error('[LessonTemplateCard] Error publishing:', err);
      throw err; // Fast fail
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublishConfirm() {
    try {
      setUnpublishing(true);
      setError(null);
      const driver = new LessonDriver();
      await driver.unpublishTemplate(template.$id);

      toast.success('Lesson unpublished successfully!');
      // Refresh parent component
      onUnpublish?.();
      setShowUnpublishConfirm(false);
      setIsOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpublish template';
      setError(message);
      toast.error(message);
      console.error('[LessonTemplateCard] Error unpublishing:', err);
      throw err; // Fast fail
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleDeleteConfirm() {
    try {
      setDeleting(true);
      setError(null);

      console.log('[LessonTemplateCard] Deleting template via server API...');

      // Use server API endpoint instead of client SDK
      const response = await fetch(`/api/admin/templates/${template.$id}`, {
        method: 'DELETE',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }
        if (response.status === 404) {
          throw new Error('Template not found.');
        }

        const errorData = await response.json().catch(() => ({ error: 'Failed to delete template' }));
        throw new Error(errorData.error || 'Failed to delete template');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete template');
      }

      console.log('[LessonTemplateCard] ✅ Template deleted');
      toast.success('Lesson template deleted successfully!');
      // Refresh parent component
      onDelete?.();
      setShowDeleteConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      setError(message);
      toast.error(message);
      console.error('[LessonTemplateCard] Error deleting:', err);
      throw err; // Fast fail
    } finally {
      setDeleting(false);
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'published':
        return 'default';
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

          {/* Lesson Type Badge, Status Badge, Edit Cards, and Publish/Unpublish Button (Outside Trigger) */}
          <div className="flex gap-2 items-center flex-shrink-0 ml-4">
            {template.lesson_type && (
              <Badge variant={getLessonTypeBadgeVariant(template.lesson_type)}>
                {formatLessonType(template.lesson_type)}
              </Badge>
            )}
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

            {template.status !== 'published' ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPublishConfirm(true);
                }}
                disabled={publishing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {publishing ? 'Publishing...' : 'Publish'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUnpublishConfirm(true);
                }}
                disabled={unpublishing}
              >
                <Archive className="h-4 w-4 mr-2" />
                {unpublishing ? 'Unpublishing...' : 'Unpublish'}
              </Button>
            )}

            {/* Delete Button - only show for draft templates */}
            {template.status !== 'published' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(true);
                }}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete'}
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

      {/* Publish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showPublishConfirm}
        title="Publish Lesson?"
        message={`This will publish "${template.title}" and make it visible to students in the course.`}
        confirmText="Publish"
        cancelText="Cancel"
        variant="default"
        onConfirm={handlePublishConfirm}
        onCancel={() => setShowPublishConfirm(false)}
        icon={<Upload className="h-5 w-5 text-green-600" />}
      />

      {/* Unpublish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showUnpublishConfirm}
        title="Unpublish Lesson?"
        message={`This will unpublish "${template.title}" and revert it to draft status. Students will no longer see this lesson in the course.`}
        confirmText="Unpublish"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleUnpublishConfirm}
        onCancel={() => setShowUnpublishConfirm(false)}
        icon={<Archive className="h-5 w-5 text-amber-600" />}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Lesson Template?"
        message={`This will permanently delete "${template.title}". This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        icon={<Trash2 className="h-5 w-5 text-red-600" />}
      />
    </Collapsible>
  );
}
