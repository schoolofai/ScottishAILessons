'use client';

/**
 * SOW Editor Component
 *
 * Main editor interface for Scheme of Work (SOW) documents.
 * Provides tabbed interface for editing:
 * - Metadata (course info, scheduling, notes)
 * - Entries (lessons)
 * - Raw JSON view
 *
 * Handles saving changes via API endpoint.
 */

import { useState, useCallback } from 'react';
import { Save, Plus, AlertCircle, Check, FileJson, List, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SOWEntryEditor } from './SOWEntryEditor';
import { SOWMetadataEditor } from './SOWMetadataEditor';
import type {
  AuthoredSOWSchema,
  SOWEntry,
  SOWMetadata,
} from '@/lib/appwrite/types/sow-schema';
import { createEmptyEntry } from '@/lib/appwrite/types/sow-schema';

interface SOWEditorProps {
  sowId: string;
  initialData: AuthoredSOWSchema;
  onSaveSuccess?: () => void;
}

export function SOWEditor({ sowId, initialData, onSaveSuccess }: SOWEditorProps) {
  const [sow, setSOW] = useState<AuthoredSOWSchema>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Track changes
  const markChanged = useCallback(() => {
    setHasChanges(true);
    setSaveSuccess(false);
    setError(null);
  }, []);

  // Update metadata
  const updateMetadata = useCallback((metadata: SOWMetadata) => {
    setSOW((prev) => ({ ...prev, metadata }));
    markChanged();
  }, [markChanged]);

  // Update entries
  const updateEntry = useCallback((index: number, entry: SOWEntry) => {
    setSOW((prev) => {
      const newEntries = [...prev.entries];
      newEntries[index] = entry;
      return { ...prev, entries: newEntries };
    });
    markChanged();
  }, [markChanged]);

  const deleteEntry = useCallback((index: number) => {
    setSOW((prev) => {
      const newEntries = prev.entries.filter((_, i) => i !== index);
      // Re-number entries after deletion
      const renumbered = newEntries.map((e, i) => ({ ...e, order: i + 1 }));
      return { ...prev, entries: renumbered };
    });
    markChanged();
  }, [markChanged]);

  const addEntry = useCallback(() => {
    setSOW((prev) => {
      const newOrder = prev.entries.length + 1;
      return { ...prev, entries: [...prev.entries, createEmptyEntry(newOrder)] };
    });
    markChanged();
  }, [markChanged]);

  const moveEntryUp = useCallback((index: number) => {
    if (index === 0) return;
    setSOW((prev) => {
      const newEntries = [...prev.entries];
      [newEntries[index - 1], newEntries[index]] = [newEntries[index], newEntries[index - 1]];
      // Re-number entries
      const renumbered = newEntries.map((e, i) => ({ ...e, order: i + 1 }));
      return { ...prev, entries: renumbered };
    });
    markChanged();
  }, [markChanged]);

  const moveEntryDown = useCallback((index: number) => {
    setSOW((prev) => {
      if (index >= prev.entries.length - 1) return prev;
      const newEntries = [...prev.entries];
      [newEntries[index], newEntries[index + 1]] = [newEntries[index + 1], newEntries[index]];
      // Re-number entries
      const renumbered = newEntries.map((e, i) => ({ ...e, order: i + 1 }));
      return { ...prev, entries: renumbered };
    });
    markChanged();
  }, [markChanged]);

  // Update accessibility notes
  const updateAccessibilityNotes = useCallback((notes: string) => {
    setSOW((prev) => ({ ...prev, accessibility_notes: notes }));
    markChanged();
  }, [markChanged]);

  // Handle JSON edit
  const handleJsonEdit = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      setSOW(parsed);
      setJsonError(null);
      markChanged();
    } catch (e) {
      setJsonError(`Invalid JSON: ${(e as Error).message}`);
    }
  }, [markChanged]);

  // Save handler
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      console.log('[SOWEditor] Saving SOW...', sowId);

      const response = await fetch(`/api/admin/sows/${sowId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          entries: sow.entries,
          metadata: sow.metadata,
          accessibility_notes: sow.accessibility_notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Save failed');
      }

      console.log('[SOWEditor] Save successful');
      toast.success('SOW saved successfully!');
      setSaveSuccess(true);
      setHasChanges(false);

      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save SOW';
      setError(message);
      toast.error(message);
      console.error('[SOWEditor] Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Calculate stats
  const totalCards = sow.entries.reduce((sum, e) => sum + e.lesson_plan.card_structure.length, 0);
  const totalMinutes = sow.entries.reduce((sum, e) => sum + (e.estMinutes || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header with Save Button */}
      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold">Edit SOW</h2>
            <p className="text-sm text-gray-500">
              {sow.entries.length} lessons • {totalCards} cards • {totalMinutes || '–'} minutes
            </p>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Unsaved Changes
            </Badge>
          )}
          {saveSuccess && (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <Check className="h-3 w-3 mr-1" /> Saved
            </Badge>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {/* Main Editor Tabs */}
      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="entries" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Lessons ({sow.entries.length})
          </TabsTrigger>
          <TabsTrigger value="metadata" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Metadata
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Raw JSON
          </TabsTrigger>
        </TabsList>

        {/* Entries Tab */}
        <TabsContent value="entries" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Edit individual lesson entries. Each entry represents a ~50 minute lesson.
              </p>
              <Button variant="outline" onClick={addEntry}>
                <Plus className="h-4 w-4 mr-2" /> Add Lesson
              </Button>
            </div>

            <div className="space-y-3">
              {sow.entries.map((entry, idx) => (
                <SOWEntryEditor
                  key={idx}
                  entry={entry}
                  index={idx}
                  totalEntries={sow.entries.length}
                  onChange={(updatedEntry) => updateEntry(idx, updatedEntry)}
                  onDelete={() => deleteEntry(idx)}
                  onMoveUp={() => moveEntryUp(idx)}
                  onMoveDown={() => moveEntryDown(idx)}
                />
              ))}
            </div>

            {sow.entries.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                <p className="text-gray-600 mb-2">No lessons in this SOW</p>
                <Button onClick={addEntry}>
                  <Plus className="h-4 w-4 mr-2" /> Add First Lesson
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="mt-4">
          <SOWMetadataEditor
            metadata={sow.metadata}
            onChange={updateMetadata}
          />

          {/* Top-level accessibility notes */}
          <div className="mt-6 p-4 border rounded-lg">
            <Label htmlFor="accessibility-notes">Top-Level Accessibility Notes</Label>
            <Textarea
              id="accessibility-notes"
              value={sow.accessibility_notes || ''}
              onChange={(e) => updateAccessibilityNotes(e.target.value)}
              placeholder="Overall accessibility summary for the entire SOW..."
              rows={4}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              A summary of accessibility considerations for the entire scheme of work.
            </p>
          </div>
        </TabsContent>

        {/* JSON Tab */}
        <TabsContent value="json" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Edit the raw JSON directly. Changes will be validated on save.
              </p>
              {jsonError && (
                <Badge variant="destructive" className="text-xs">
                  {jsonError}
                </Badge>
              )}
            </div>

            <Textarea
              value={JSON.stringify(sow, null, 2)}
              onChange={(e) => handleJsonEdit(e.target.value)}
              className="font-mono text-sm"
              rows={30}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
