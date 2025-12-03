'use client';

/**
 * Lesson Template Card Editor Page
 * Admin interface for editing individual cards within a lesson template
 */

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CardEditor } from '@/components/admin/CardEditor';
import { useLessonDriver } from '@/lib/appwrite/hooks/useLessonDriver';
import { decompressCards, compressCards } from '@/lib/appwrite/utils/compression';
import { validateCardArray } from '@/lib/validation/cardValidator';
import { createEmptyCard } from '@/lib/validation/cardValidator';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import type { LessonTemplate, LessonCard } from '@/lib/appwrite/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LessonCardEditorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const templateId = resolvedParams.id;

  const router = useRouter();
  const lessonDriver = useLessonDriver();

  const [template, setTemplate] = useState<LessonTemplate | null>(null);
  const [cards, setCards] = useState<LessonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load template on mount
  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true);
        setError(null);

        const tmpl = await lessonDriver.getLessonTemplate(templateId);
        setTemplate(tmpl);

        // Decompress cards
        const decompressedCards = decompressCards(tmpl.cards);
        setCards(decompressedCards);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load template';
        setError(errorMsg);
        console.error('Error loading template:', err);
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [templateId, lessonDriver]);

  // Card handlers
  const handleCardUpdate = (index: number, updatedCard: LessonCard) => {
    const newCards = [...cards];
    newCards[index] = updatedCard;
    setCards(newCards);
    setSaveSuccess(false); // Clear success message when editing
  };

  const handleCardDelete = (index: number) => {
    const newCards = cards.filter((_, idx) => idx !== index);
    setCards(newCards);
    setSaveSuccess(false);
  };

  const handleCardAdd = () => {
    const newCard = createEmptyCard();
    setCards([...cards, newCard]);
    setSaveSuccess(false);
  };

  const handleCardMoveUp = (index: number) => {
    if (index === 0) return;
    const newCards = [...cards];
    [newCards[index - 1], newCards[index]] = [newCards[index], newCards[index - 1]];
    setCards(newCards);
    setSaveSuccess(false);
  };

  const handleCardMoveDown = (index: number) => {
    if (index === cards.length - 1) return;
    const newCards = [...cards];
    [newCards[index], newCards[index + 1]] = [newCards[index + 1], newCards[index]];
    setCards(newCards);
    setSaveSuccess(false);
  };

  // Save template
  const handleSaveTemplate = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      // Validate all cards
      const validation = validateCardArray(cards);
      if (!validation.isValid) {
        setError(
          `Validation failed:\n${validation.errors.slice(0, 5).join('\n')}${
            validation.errors.length > 5 ? `\n...and ${validation.errors.length - 5} more errors` : ''
          }`
        );
        return;
      }

      // Compress cards
      const compressedCards = compressCards(cards);

      // Update template via driver (FAST FAIL - no fallback)
      await lessonDriver.updateLessonTemplate(templateId, {
        cards: compressedCards
      });

      setSaveSuccess(true);

      // Reload template to get latest data
      const updatedTemplate = await lessonDriver.getLessonTemplate(templateId);
      setTemplate(updatedTemplate);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save template';
      setError(`Save failed: ${errorMsg}`);
      console.error('Error saving template:', err);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <InlineLoadingSkeleton />
      </div>
    );
  }

  // Error state
  if (error && !template) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="font-semibold">Error loading template</p>
          <p className="text-sm mt-1">{error}</p>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <p>Template not found</p>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>

        {/* SOW Context Banner */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {template.sow_order !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">SOW Order:</span>
                <Badge variant="outline" className="bg-white border-blue-300 text-blue-700">
                  Lesson {template.sow_order}
                </Badge>
              </div>
            )}
            {template.lesson_type && (
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">Type:</span>
                <Badge variant="outline" className="bg-white border-blue-300 text-blue-700 capitalize">
                  {template.lesson_type.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}
            {template.courseId && (
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">Course:</span>
                <span className="text-blue-700 font-mono text-xs">{template.courseId}</span>
              </div>
            )}
            {template.authored_sow_id && (
              <div className="flex items-center gap-2">
                <span className="text-blue-600 font-medium">SOW ID:</span>
                <span className="text-blue-700 font-mono text-xs">{template.authored_sow_id}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{template.title}</h1>
            <div className="flex gap-2 items-center">
              <Badge variant={template.status === 'published' ? 'default' : 'secondary'}>
                {template.status}
              </Badge>
              <span className="text-sm text-gray-600">
                {cards.length} card{cards.length !== 1 ? 's' : ''} • {template.estMinutes} minutes
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCardAdd}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Card
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={saving || cards.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <p className="text-green-800">
            ✅ Template saved successfully!
          </p>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <p className="font-semibold">Error</p>
          <pre className="text-sm mt-1 whitespace-pre-wrap">{error}</pre>
        </Alert>
      )}

      {/* Empty State */}
      {cards.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
          <p className="text-gray-600 text-lg mb-2">No cards in this template</p>
          <p className="text-gray-500 text-sm mb-4">
            Add your first card to get started
          </p>
          <Button onClick={handleCardAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Card
          </Button>
        </div>
      ) : (
        /* Cards List */
        <div className="space-y-4">
          {cards.map((card, index) => (
            <CardEditor
              key={card.id}
              card={card}
              index={index}
              totalCards={cards.length}
              lessonTemplateId={templateId}
              sowOrder={template.sow_order}
              lessonType={template.lesson_type}
              lessonTitle={template.title}
              onSave={(updatedCard) => handleCardUpdate(index, updatedCard)}
              onDelete={() => handleCardDelete(index)}
              onMoveUp={() => handleCardMoveUp(index)}
              onMoveDown={() => handleCardMoveDown(index)}
            />
          ))}
        </div>
      )}

      {/* Footer Actions */}
      {cards.length > 0 && (
        <div className="mt-8 pt-6 border-t flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {cards.length} card{cards.length !== 1 ? 's' : ''} total
          </p>
          <Button
            onClick={handleSaveTemplate}
            disabled={saving || cards.length === 0}
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
