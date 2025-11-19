'use client';

/**
 * Card Editor Component
 * Main inline editor for individual lesson cards
 * Handles collapsible edit interface with validation
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CFUEditor } from './CFUEditor';
import { MisconceptionsEditor } from './MisconceptionsEditor';
import { MetadataEditor } from './MetadataEditor';
import { DiagramManagementSection } from './DiagramManagementSection';
import { validateCard, hasValidationErrors } from '@/lib/validation/cardValidator';
import type { LessonCard, ValidationErrors } from '@/lib/appwrite/types';

interface CardEditorProps {
  card: LessonCard;
  index: number;
  totalCards: number;
  lessonTemplateId: string;
  onSave: (card: LessonCard) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function CardEditor({
  card,
  index,
  totalCards,
  lessonTemplateId,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown
}: CardEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [editedCard, setEditedCard] = useState<LessonCard>({
    ...card,
    misconceptions: card.misconceptions || [],
    context_hooks: card.context_hooks || []
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showValidation, setShowValidation] = useState(false);

  const handleSave = () => {
    // Validate card
    const validationErrors = validateCard(editedCard);

    if (hasValidationErrors(validationErrors)) {
      setErrors(validationErrors);
      setShowValidation(true);
      return;
    }

    // Save and collapse
    onSave(editedCard);
    setErrors({});
    setShowValidation(false);
    setExpanded(false);
  };

  const handleCancel = () => {
    // Reset to original card state with defensive defaults
    setEditedCard({
      ...card,
      misconceptions: card.misconceptions || [],
      context_hooks: card.context_hooks || []
    });
    setErrors({});
    setShowValidation(false);
    setExpanded(false);
  };

  const handleDelete = () => {
    if (confirm(`Delete card "${card.title}"? This action cannot be undone.`)) {
      onDelete();
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          {/* Card Header Info */}
          <div className="flex items-center gap-3 flex-1">
            <Badge variant="outline" className="font-mono">
              #{index + 1}
            </Badge>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{card.title}</h3>
              <p className="text-sm text-gray-500">
                {card.cfu.type.toUpperCase()}
                {card.cfu.type === 'mcq' && (card.cfu as any).multiSelect && (
                  <span className="text-purple-600 font-medium"> (Multi-Select)</span>
                )}
                {' '}• {card.misconceptions?.length || 0} misconceptions •{' '}
                {card.context_hooks?.length || 0} context hooks
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMoveUp()}
              disabled={index === 0}
              title="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMoveDown()}
              disabled={index === totalCards - 1}
              title="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse' : 'Expand to edit'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              title="Delete card"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expanded Edit View */}
      {expanded && (
        <CardContent className="pt-0">
          {/* Validation Summary */}
          {showValidation && hasValidationErrors(errors) && (
            <Alert variant="destructive" className="mb-4">
              <p className="font-semibold">Please fix the following errors:</p>
              <ul className="list-disc list-inside mt-2 text-sm">
                {Object.entries(errors).slice(0, 5).map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
                {Object.keys(errors).length > 5 && (
                  <li className="italic">...and {Object.keys(errors).length - 5} more</li>
                )}
              </ul>
            </Alert>
          )}

          <Tabs defaultValue="core" className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="core">Core Content</TabsTrigger>
              <TabsTrigger value="cfu">CFU & Rubric</TabsTrigger>
              <TabsTrigger value="misconceptions">Misconceptions</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
              <TabsTrigger value="diagrams">Diagrams</TabsTrigger>
            </TabsList>

            {/* Core Content Tab */}
            <TabsContent value="core" className="space-y-4 mt-4">
              {/* Card ID (read-only) */}
              <div>
                <Label htmlFor="card-id" className="text-xs text-gray-600">
                  Card ID (auto-generated)
                </Label>
                <Input
                  id="card-id"
                  value={editedCard.id}
                  disabled
                  className="font-mono text-sm bg-gray-50"
                />
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="card-title">Card Title *</Label>
                <Input
                  id="card-title"
                  value={editedCard.title}
                  onChange={(e) =>
                    setEditedCard({ ...editedCard, title: e.target.value })
                  }
                  placeholder="e.g., Converting Fractions to Percentages"
                  className="mt-1"
                />
                {errors.title && (
                  <p className="text-sm text-red-600 mt-1">{errors.title}</p>
                )}
              </div>

              {/* Explainer */}
              <div>
                <Label htmlFor="card-explainer">Explainer (Rich Text) *</Label>
                <p className="text-xs text-gray-600 mb-1">
                  Full explanation with LaTeX, markdown, examples
                </p>
                <Textarea
                  id="card-explainer"
                  value={editedCard.explainer}
                  onChange={(e) =>
                    setEditedCard({ ...editedCard, explainer: e.target.value })
                  }
                  placeholder="Detailed explanation of the concept..."
                  className="mt-1 font-mono text-sm"
                  rows={8}
                />
                {errors.explainer && (
                  <p className="text-sm text-red-600 mt-1">{errors.explainer}</p>
                )}
              </div>

              {/* Accessible Explainer */}
              <div>
                <Label htmlFor="card-explainer-plain">
                  Accessible Explainer (Plain Text, CEFR A2-B1) *
                </Label>
                <p className="text-xs text-gray-600 mb-1">
                  Simplified version for students with accessibility needs
                </p>
                <Textarea
                  id="card-explainer-plain"
                  value={editedCard.explainer_plain}
                  onChange={(e) =>
                    setEditedCard({ ...editedCard, explainer_plain: e.target.value })
                  }
                  placeholder="Simplified explanation using common vocabulary..."
                  className="mt-1"
                  rows={6}
                />
                {errors.explainer_plain && (
                  <p className="text-sm text-red-600 mt-1">{errors.explainer_plain}</p>
                )}
              </div>
            </TabsContent>

            {/* CFU & Rubric Tab */}
            <TabsContent value="cfu" className="mt-4">
              <CFUEditor
                cfu={editedCard.cfu}
                onChange={(cfu) => setEditedCard({ ...editedCard, cfu })}
                errors={errors}
              />
            </TabsContent>

            {/* Misconceptions Tab */}
            <TabsContent value="misconceptions" className="mt-4">
              <MisconceptionsEditor
                misconceptions={editedCard.misconceptions}
                onChange={(misconceptions) =>
                  setEditedCard({ ...editedCard, misconceptions })
                }
                errors={errors}
              />
            </TabsContent>

            {/* Metadata Tab */}
            <TabsContent value="metadata" className="mt-4">
              <MetadataEditor
                contextHooks={editedCard.context_hooks}
                onChange={(context_hooks) =>
                  setEditedCard({ ...editedCard, context_hooks })
                }
                errors={errors}
              />
            </TabsContent>

            {/* Diagrams Tab */}
            <TabsContent value="diagrams" className="mt-4">
              <DiagramManagementSection
                lessonTemplateId={lessonTemplateId}
                cardId={editedCard.id}
              />
            </TabsContent>
          </Tabs>

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
