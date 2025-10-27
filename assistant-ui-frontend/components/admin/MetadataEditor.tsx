'use client';

/**
 * Metadata Editor Component
 * Edits card metadata: context hooks (pedagogical guidance)
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ValidationErrors } from '@/lib/appwrite/types';

interface MetadataEditorProps {
  contextHooks?: string[];
  onChange: (contextHooks: string[]) => void;
  errors?: ValidationErrors;
}

export function MetadataEditor({
  contextHooks = [],
  onChange,
  errors = {}
}: MetadataEditorProps) {
  const handleAddContextHook = () => {
    onChange([...contextHooks, '']);
  };

  const handleRemoveContextHook = (index: number) => {
    onChange(contextHooks.filter((_, idx) => idx !== index));
  };

  const handleContextHookChange = (index: number, value: string) => {
    const updated = [...contextHooks];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-base font-semibold">
            Context Hooks (Optional)
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddContextHook}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Hook
          </Button>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          Pedagogical context and guidance for the AI teacher. These hints help the AI provide
          better scaffolding and relevant examples when teaching this concept.
        </p>

        {contextHooks.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-md border-2 border-dashed">
            <p className="text-gray-500 text-sm">No context hooks defined</p>
            <p className="text-xs text-gray-400 mt-1">
              Context hooks are optional pedagogical guidance
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contextHooks.map((hook, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-8 text-sm text-gray-500 text-center">{idx + 1}.</div>
                <Input
                  value={hook}
                  onChange={(e) => handleContextHookChange(idx, e.target.value)}
                  placeholder="e.g., 'Use real-world money examples' or 'Connect to previous lesson on percentages'"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveContextHook(idx)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {errors.context_hooks && (
          <p className="text-sm text-red-600 mt-2">{errors.context_hooks}</p>
        )}
      </div>
    </div>
  );
}
