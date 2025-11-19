'use client';

/**
 * MCQ Editor Component
 * Edits Multiple Choice Question CFUs with options and answer selection
 * Supports both single-select (radio buttons) and multi-select (checkboxes)
 */

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Alert } from '@/components/ui/alert';
import type { MCQCFU, ValidationErrors } from '@/lib/appwrite/types';

interface MCQEditorProps {
  cfu: MCQCFU;
  onChange: (cfu: MCQCFU) => void;
  errors?: ValidationErrors;
}

export function MCQEditor({ cfu, onChange, errors = {} }: MCQEditorProps) {
  // Initialize answerIndices if not present (for backwards compatibility)
  const answerIndices = cfu.answerIndices || (cfu.answerIndex !== undefined ? [cfu.answerIndex] : []);
  const isMultiSelect = cfu.multiSelect || false;

  const handleStemChange = (value: string) => {
    onChange({ ...cfu, stem: value });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...cfu.options];
    newOptions[index] = value;
    onChange({ ...cfu, options: newOptions });
  };

  const handleAddOption = () => {
    onChange({ ...cfu, options: [...cfu.options, ''] });
  };

  const handleRemoveOption = (index: number) => {
    if (cfu.options.length <= 2) {
      return; // Minimum 2 options required
    }
    const newOptions = cfu.options.filter((_, idx) => idx !== index);

    if (isMultiSelect) {
      // Multi-select: filter out removed index and adjust remaining
      const newAnswerIndices = answerIndices
        .filter(i => i !== index)
        .map(i => i > index ? i - 1 : i);
      onChange({
        ...cfu,
        options: newOptions,
        answerIndices: newAnswerIndices.length > 0 ? newAnswerIndices : [0]
      });
    } else {
      // Single-select: adjust answer index if needed
      let newAnswerIndex = cfu.answerIndex || 0;
      if (index === newAnswerIndex) {
        newAnswerIndex = 0; // Reset to first option if current answer is deleted
      } else if (index < newAnswerIndex) {
        newAnswerIndex = newAnswerIndex - 1; // Shift down if before current answer
      }
      onChange({ ...cfu, options: newOptions, answerIndex: newAnswerIndex });
    }
  };

  const handleSingleAnswerChange = (value: string) => {
    const idx = parseInt(value, 10);
    onChange({
      ...cfu,
      answerIndex: idx,
      answerIndices: [idx] // Keep in sync for consistency
    });
  };

  const handleMultiAnswerToggle = (index: number, checked: boolean) => {
    let newIndices: number[];
    if (checked) {
      newIndices = [...answerIndices, index].sort((a, b) => a - b);
    } else {
      newIndices = answerIndices.filter(i => i !== index);
    }
    // Ensure at least one answer is selected
    if (newIndices.length === 0) {
      newIndices = [0];
    }
    onChange({
      ...cfu,
      answerIndices: newIndices,
      answerIndex: newIndices[0] // Keep first for backwards compatibility
    });
  };

  const handleMultiSelectToggle = (enabled: boolean) => {
    if (enabled) {
      // Switching to multi-select: convert answerIndex to answerIndices
      onChange({
        ...cfu,
        multiSelect: true,
        answerIndices: cfu.answerIndex !== undefined ? [cfu.answerIndex] : [0]
      });
    } else {
      // Switching to single-select: use first answerIndex
      onChange({
        ...cfu,
        multiSelect: false,
        answerIndex: answerIndices[0] || 0,
        answerIndices: undefined
      });
    }
  };

  return (
    <div className="space-y-4 pl-4 border-l-4 border-blue-500">
      <div className="font-semibold text-blue-700">Multiple Choice Question</div>

      {/* Multi-select Toggle */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
        <div>
          <Label htmlFor="multi-select-toggle" className="text-sm font-medium">
            Allow Multiple Answers
          </Label>
          <p className="text-xs text-gray-500">
            {isMultiSelect
              ? 'Students can select multiple correct answers (checkboxes)'
              : 'Students select one correct answer (radio buttons)'}
          </p>
        </div>
        <Switch
          id="multi-select-toggle"
          checked={isMultiSelect}
          onCheckedChange={handleMultiSelectToggle}
        />
      </div>

      {/* Question Stem */}
      <div>
        <Label htmlFor="mcq-stem">Question Stem *</Label>
        <Textarea
          id="mcq-stem"
          value={cfu.stem}
          onChange={(e) => handleStemChange(e.target.value)}
          placeholder={isMultiSelect
            ? "Enter the question (e.g., 'Select ALL correct answers...')"
            : "Enter the question or problem statement..."
          }
          className="mt-1"
          rows={3}
        />
        {errors.cfu_stem && (
          <p className="text-sm text-red-600 mt-1">{errors.cfu_stem}</p>
        )}
      </div>

      {/* Options */}
      <div>
        <Label className="mb-2 block">Answer Options *</Label>

        {isMultiSelect ? (
          /* Multi-select: Checkboxes */
          <div className="space-y-3">
            {cfu.options.map((option, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex items-center mt-2">
                  <Checkbox
                    id={`option-${idx}`}
                    checked={answerIndices.includes(idx)}
                    onCheckedChange={(checked) => handleMultiAnswerToggle(idx, checked as boolean)}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOption(idx)}
                  disabled={cfu.options.length <= 2}
                  className="mt-1"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          /* Single-select: Radio buttons */
          <RadioGroup
            value={(cfu.answerIndex || 0).toString()}
            onValueChange={handleSingleAnswerChange}
          >
            {cfu.options.map((option, idx) => (
              <div key={idx} className="flex items-start gap-2 mb-3">
                <div className="flex items-center mt-2">
                  <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
                </div>
                <div className="flex-1">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOption(idx)}
                  disabled={cfu.options.length <= 2}
                  className="mt-1"
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </RadioGroup>
        )}

        {errors.cfu_options && (
          <Alert variant="destructive" className="mt-2">
            {errors.cfu_options}
          </Alert>
        )}
        {errors.cfu_options_empty && (
          <Alert variant="destructive" className="mt-2">
            {errors.cfu_options_empty}
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddOption}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Option
        </Button>
      </div>

      {/* Answer Selection Info */}
      {isMultiSelect ? (
        /* Multi-select answer display */
        answerIndices.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              <strong>Correct Answers:</strong>{' '}
              {answerIndices
                .filter(i => cfu.options[i])
                .map(i => `Option ${i + 1} - "${cfu.options[i]}"`)
                .join(', ')}
            </p>
          </div>
        )
      ) : (
        /* Single-select answer display */
        cfu.answerIndex !== undefined && cfu.options[cfu.answerIndex] && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-800">
              <strong>Correct Answer:</strong> Option {cfu.answerIndex + 1} - &quot;
              {cfu.options[cfu.answerIndex]}&quot;
            </p>
          </div>
        )
      )}

      {errors.cfu_answer && (
        <Alert variant="destructive">{errors.cfu_answer}</Alert>
      )}
    </div>
  );
}
