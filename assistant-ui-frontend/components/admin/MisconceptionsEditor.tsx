'use client';

/**
 * Misconceptions Editor Component
 * Manages array of common student misconceptions with clarifications
 */

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import type { Misconception, ValidationErrors } from '@/lib/appwrite/types';

interface MisconceptionsEditorProps {
  misconceptions: Misconception[];
  onChange: (misconceptions: Misconception[]) => void;
  errors?: ValidationErrors;
}

export function MisconceptionsEditor({
  misconceptions,
  onChange,
  errors = {}
}: MisconceptionsEditorProps) {
  const handleAddMisconception = () => {
    const newMisc: Misconception = {
      id: `MISC_${Date.now()}`,
      misconception: '',
      clarification: ''
    };
    onChange([...misconceptions, newMisc]);
  };

  const handleRemoveMisconception = (index: number) => {
    onChange(misconceptions.filter((_, idx) => idx !== index));
  };

  const handleMisconceptionChange = (
    index: number,
    field: keyof Misconception,
    value: string
  ) => {
    const updated = [...misconceptions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Common Misconceptions
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddMisconception}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Misconception
        </Button>
      </div>

      <p className="text-sm text-gray-600">
        Anticipate common student errors and provide targeted clarifications to help students
        overcome these misconceptions.
      </p>

      {misconceptions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-md border-2 border-dashed">
          <p className="text-gray-500">No misconceptions defined yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Click &quot;Add Misconception&quot; to get started
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {misconceptions.map((misc, idx) => (
            <Card key={misc.id} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <Label className="font-semibold text-sm">
                  Misconception {idx + 1}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMisconception(idx)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              <div className="space-y-3">
                {/* ID Field */}
                <div>
                  <Label htmlFor={`misc-id-${idx}`} className="text-xs text-gray-600">
                    ID (e.g., MISC_MATH_FRACTIONS_001)
                  </Label>
                  <Input
                    id={`misc-id-${idx}`}
                    value={misc.id}
                    onChange={(e) =>
                      handleMisconceptionChange(idx, 'id', e.target.value)
                    }
                    placeholder="MISC_SUBJECT_TOPIC_###"
                    className="mt-1 font-mono text-sm"
                  />
                  {errors[`misconception_${idx}_id`] && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors[`misconception_${idx}_id`]}
                    </p>
                  )}
                </div>

                {/* Misconception Description */}
                <div>
                  <Label htmlFor={`misc-text-${idx}`}>
                    What is the misconception? *
                  </Label>
                  <Textarea
                    id={`misc-text-${idx}`}
                    value={misc.misconception}
                    onChange={(e) =>
                      handleMisconceptionChange(idx, 'misconception', e.target.value)
                    }
                    placeholder="Describe the common error or misunderstanding..."
                    className="mt-1"
                    rows={2}
                  />
                  {errors[`misconception_${idx}_text`] && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors[`misconception_${idx}_text`]}
                    </p>
                  )}
                </div>

                {/* Clarification */}
                <div>
                  <Label htmlFor={`misc-clarif-${idx}`}>
                    How to correct it? *
                  </Label>
                  <Textarea
                    id={`misc-clarif-${idx}`}
                    value={misc.clarification}
                    onChange={(e) =>
                      handleMisconceptionChange(idx, 'clarification', e.target.value)
                    }
                    placeholder="Provide a clear explanation to help students understand the correct approach..."
                    className="mt-1"
                    rows={3}
                  />
                  {errors[`misconception_${idx}_clarification`] && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors[`misconception_${idx}_clarification`]}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {errors.misconceptions && (
        <p className="text-sm text-red-600">{errors.misconceptions}</p>
      )}
    </div>
  );
}
