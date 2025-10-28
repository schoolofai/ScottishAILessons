'use client';

/**
 * CFU Editor Component
 * Type selector and router for different CFU types
 */

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { MCQEditor } from './MCQEditor';
import { NumericEditor } from './NumericEditor';
import { StructuredResponseEditor } from './StructuredResponseEditor';
import { ShortTextEditor } from './ShortTextEditor';
import { RubricEditor } from './RubricEditor';
import { createEmptyCFU } from '@/lib/validation/cardValidator';
import type { CFU, MCQCFU, NumericCFU, StructuredResponseCFU, ShortTextCFU, ValidationErrors } from '@/lib/appwrite/types';

interface CFUEditorProps {
  cfu: CFU;
  onChange: (cfu: CFU) => void;
  errors?: ValidationErrors;
}

export function CFUEditor({ cfu, onChange, errors = {} }: CFUEditorProps) {
  const handleTypeChange = (newType: CFU['type']) => {
    if (newType !== cfu.type) {
      // Create a new empty CFU of the selected type
      const emptyCFU = createEmptyCFU(newType);
      onChange(emptyCFU);
    }
  };

  const handleRubricChange = (rubric: CFU['rubric']) => {
    onChange({ ...cfu, rubric });
  };

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg border-2">
      <div>
        <Label className="text-lg font-bold">Check For Understanding (CFU) *</Label>
        <p className="text-sm text-gray-600 mt-1">
          The question or problem students will answer to demonstrate understanding
        </p>
      </div>

      {/* CFU Type Selector */}
      <div>
        <Label htmlFor="cfu-type">Question Type *</Label>
        <Select value={cfu.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select question type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mcq">Multiple Choice Question (MCQ)</SelectItem>
            <SelectItem value="numeric">Numeric Answer</SelectItem>
            <SelectItem value="structured_response">Structured Response (Multi-part)</SelectItem>
            <SelectItem value="short_text">Short Text Response</SelectItem>
          </SelectContent>
        </Select>
        {errors.cfu_type && (
          <p className="text-sm text-red-600 mt-1">{errors.cfu_type}</p>
        )}
      </div>

      {/* Warning when changing type */}
      {cfu.type && (
        <Alert>
          <p className="text-sm">
            <strong>Note:</strong> Changing the question type will reset all CFU fields.
          </p>
        </Alert>
      )}

      {/* Type-specific Editor */}
      <div>
        {cfu.type === 'mcq' && (
          <MCQEditor
            cfu={cfu as MCQCFU}
            onChange={onChange}
            errors={errors}
          />
        )}
        {cfu.type === 'numeric' && (
          <NumericEditor
            cfu={cfu as NumericCFU}
            onChange={onChange}
            errors={errors}
          />
        )}
        {cfu.type === 'structured_response' && (
          <StructuredResponseEditor
            cfu={cfu as StructuredResponseCFU}
            onChange={onChange}
            errors={errors}
          />
        )}
        {cfu.type === 'short_text' && (
          <ShortTextEditor
            cfu={cfu as ShortTextCFU}
            onChange={onChange}
            errors={errors}
          />
        )}
      </div>

      {/* Rubric Editor (common to all CFU types) */}
      <div>
        <RubricEditor
          rubric={cfu.rubric}
          onChange={handleRubricChange}
          errors={errors}
        />
      </div>
    </div>
  );
}
