'use client';

/**
 * MCQ Editor Component
 * Edits Multiple Choice Question CFUs with options and answer selection
 */

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert } from '@/components/ui/alert';
import type { MCQCFU, ValidationErrors } from '@/lib/appwrite/types';

interface MCQEditorProps {
  cfu: MCQCFU;
  onChange: (cfu: MCQCFU) => void;
  errors?: ValidationErrors;
}

export function MCQEditor({ cfu, onChange, errors = {} }: MCQEditorProps) {
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
    // Adjust answer index if needed
    let newAnswerIndex = cfu.answerIndex;
    if (index === cfu.answerIndex) {
      newAnswerIndex = 0; // Reset to first option if current answer is deleted
    } else if (index < cfu.answerIndex) {
      newAnswerIndex = cfu.answerIndex - 1; // Shift down if before current answer
    }
    onChange({ ...cfu, options: newOptions, answerIndex: newAnswerIndex });
  };

  const handleAnswerChange = (value: string) => {
    onChange({ ...cfu, answerIndex: parseInt(value, 10) });
  };

  return (
    <div className="space-y-4 pl-4 border-l-4 border-blue-500">
      <div className="font-semibold text-blue-700">Multiple Choice Question</div>

      {/* Question Stem */}
      <div>
        <Label htmlFor="mcq-stem">Question Stem *</Label>
        <Textarea
          id="mcq-stem"
          value={cfu.stem}
          onChange={(e) => handleStemChange(e.target.value)}
          placeholder="Enter the question or problem statement..."
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
        <RadioGroup
          value={cfu.answerIndex.toString()}
          onValueChange={handleAnswerChange}
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
      {cfu.answerIndex !== undefined && cfu.options[cfu.answerIndex] && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <p className="text-sm text-green-800">
            <strong>Correct Answer:</strong> Option {cfu.answerIndex + 1} - &quot;
            {cfu.options[cfu.answerIndex]}&quot;
          </p>
        </div>
      )}

      {errors.cfu_answer && (
        <Alert variant="destructive">{errors.cfu_answer}</Alert>
      )}
    </div>
  );
}
