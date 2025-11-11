'use client';

/**
 * Structured Response Editor Component
 * Edits multi-part structured response CFUs
 */

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import type { StructuredResponseCFU, ValidationErrors } from '@/lib/appwrite/types';

interface StructuredResponseEditorProps {
  cfu: StructuredResponseCFU;
  onChange: (cfu: StructuredResponseCFU) => void;
  errors?: ValidationErrors;
}

export function StructuredResponseEditor({
  cfu,
  onChange,
  errors = {}
}: StructuredResponseEditorProps) {
  const handleStemChange = (value: string) => {
    onChange({ ...cfu, stem: value });
  };

  return (
    <div className="space-y-4 pl-4 border-l-4 border-green-500">
      <div className="font-semibold text-green-700">Structured Response Question</div>

      {/* Question Stem */}
      <div>
        <Label htmlFor="structured-stem">Question Stem *</Label>
        <Textarea
          id="structured-stem"
          value={cfu.stem}
          onChange={(e) => handleStemChange(e.target.value)}
          placeholder="Enter the multi-part question or problem..."
          className="mt-1"
          rows={4}
        />
        {errors.cfu_stem && (
          <p className="text-sm text-red-600 mt-1">{errors.cfu_stem}</p>
        )}
        <p className="text-sm text-gray-600 mt-2">
          Multi-part questions are assessed holistically by the LLM teacher based on the rubric
          criteria.
        </p>
      </div>

      {/* Info box */}
      <Alert>
        <p className="text-sm">
          <strong>Note:</strong> Structured responses are evaluated by the AI teacher using the
          rubric criteria. Ensure your rubric (below) clearly defines what constitutes a good
          response for each part of the question.
        </p>
      </Alert>
    </div>
  );
}
