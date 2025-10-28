'use client';

/**
 * Short Text Editor Component
 * Edits short text response CFUs
 */

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import type { ShortTextCFU, ValidationErrors } from '@/lib/appwrite/types';

interface ShortTextEditorProps {
  cfu: ShortTextCFU;
  onChange: (cfu: ShortTextCFU) => void;
  errors?: ValidationErrors;
}

export function ShortTextEditor({ cfu, onChange, errors = {} }: ShortTextEditorProps) {
  const handleStemChange = (value: string) => {
    onChange({ ...cfu, stem: value });
  };

  return (
    <div className="space-y-4 pl-4 border-l-4 border-orange-500">
      <div className="font-semibold text-orange-700">Short Text Response Question</div>

      {/* Question Stem */}
      <div>
        <Label htmlFor="shorttext-stem">Question Stem *</Label>
        <Textarea
          id="shorttext-stem"
          value={cfu.stem}
          onChange={(e) => handleStemChange(e.target.value)}
          placeholder="Enter the short answer question..."
          className="mt-1"
          rows={3}
        />
        {errors.cfu_stem && (
          <p className="text-sm text-red-600 mt-1">{errors.cfu_stem}</p>
        )}
        <p className="text-sm text-gray-600 mt-2">
          Short text responses (typically 1-3 sentences) are assessed by the LLM teacher.
        </p>
      </div>

      {/* Info box */}
      <Alert>
        <p className="text-sm">
          <strong>Note:</strong> Short text responses are evaluated by the AI teacher based on
          content quality and rubric criteria. The student's answer will be compared against the
          rubric to determine correctness and provide feedback.
        </p>
      </Alert>
    </div>
  );
}
