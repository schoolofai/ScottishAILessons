'use client';

/**
 * Numeric Editor Component
 * Edits Numeric Answer CFUs with expected value, tolerance, and currency support
 */

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { NumericCFU, ValidationErrors } from '@/lib/appwrite/types';

interface NumericEditorProps {
  cfu: NumericCFU;
  onChange: (cfu: NumericCFU) => void;
  errors?: ValidationErrors;
}

export function NumericEditor({ cfu, onChange, errors = {} }: NumericEditorProps) {
  const handleStemChange = (value: string) => {
    onChange({ ...cfu, stem: value });
  };

  const handleExpectedChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onChange({ ...cfu, expected: numValue });
    }
  };

  const handleToleranceChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      onChange({ ...cfu, tolerance: numValue });
    }
  };

  const handleMoneyToggle = (checked: boolean) => {
    onChange({ ...cfu, money2dp: checked });
  };

  const handleAddHint = () => {
    const hints = cfu.hints || [];
    onChange({ ...cfu, hints: [...hints, ''] });
  };

  const handleHintChange = (index: number, value: string) => {
    const hints = [...(cfu.hints || [])];
    hints[index] = value;
    onChange({ ...cfu, hints });
  };

  const handleRemoveHint = (index: number) => {
    const hints = (cfu.hints || []).filter((_, idx) => idx !== index);
    onChange({ ...cfu, hints });
  };

  return (
    <div className="space-y-4 pl-4 border-l-4 border-purple-500">
      <div className="font-semibold text-purple-700">Numeric Answer Question</div>

      {/* Question Stem */}
      <div>
        <Label htmlFor="numeric-stem">Question Stem *</Label>
        <Textarea
          id="numeric-stem"
          value={cfu.stem}
          onChange={(e) => handleStemChange(e.target.value)}
          placeholder="Enter the numeric question..."
          className="mt-1"
          rows={3}
        />
        {errors.cfu_stem && (
          <p className="text-sm text-red-600 mt-1">{errors.cfu_stem}</p>
        )}
      </div>

      {/* Expected Answer */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="numeric-expected">Expected Answer *</Label>
          <Input
            id="numeric-expected"
            type="number"
            step="any"
            value={cfu.expected}
            onChange={(e) => handleExpectedChange(e.target.value)}
            placeholder="0"
            className="mt-1"
          />
          {errors.cfu_expected && (
            <p className="text-sm text-red-600 mt-1">{errors.cfu_expected}</p>
          )}
        </div>

        <div>
          <Label htmlFor="numeric-tolerance">Tolerance (±) *</Label>
          <Input
            id="numeric-tolerance"
            type="number"
            step="any"
            min="0"
            value={cfu.tolerance}
            onChange={(e) => handleToleranceChange(e.target.value)}
            placeholder="0.01"
            className="mt-1"
          />
          {errors.cfu_tolerance && (
            <p className="text-sm text-red-600 mt-1">{errors.cfu_tolerance}</p>
          )}
        </div>
      </div>

      {/* Money Formatting */}
      <div className="flex items-center space-x-2">
        <Switch
          id="money-toggle"
          checked={cfu.money2dp || false}
          onCheckedChange={handleMoneyToggle}
        />
        <Label htmlFor="money-toggle" className="cursor-pointer">
          Format as currency (£X.XX)
        </Label>
      </div>

      {/* Answer Range Display */}
      <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
        <p className="text-sm text-purple-800">
          <strong>Acceptable Answer Range:</strong>{' '}
          {cfu.money2dp ? '£' : ''}
          {(cfu.expected - cfu.tolerance).toFixed(cfu.money2dp ? 2 : 4)} to{' '}
          {cfu.money2dp ? '£' : ''}
          {(cfu.expected + cfu.tolerance).toFixed(cfu.money2dp ? 2 : 4)}
        </p>
      </div>

      {/* Hints (Optional) */}
      <div>
        <Label className="mb-2 block">Hints (Optional)</Label>
        <p className="text-sm text-gray-600 mb-2">
          Progressive hints that can be revealed if student is stuck
        </p>

        {(cfu.hints || []).map((hint, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <Input
              value={hint}
              onChange={(e) => handleHintChange(idx, e.target.value)}
              placeholder={`Hint ${idx + 1}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveHint(idx)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddHint}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Hint
        </Button>

        {errors.cfu_hints && (
          <Alert variant="destructive" className="mt-2">
            {errors.cfu_hints}
          </Alert>
        )}
      </div>
    </div>
  );
}
