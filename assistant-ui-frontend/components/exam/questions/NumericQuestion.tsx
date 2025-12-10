"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumericQuestionProps {
  value?: number;
  expectedFormat?: string | null;
  onChange: (value: number | undefined) => void;
}

/**
 * NumericQuestion - Numeric answer input with optional format hints
 *
 * Supports:
 * - Decimal and integer input
 * - Currency format hints
 * - Fraction format hints
 */
export function NumericQuestion({
  value,
  expectedFormat,
  onChange,
}: NumericQuestionProps) {
  const [inputValue, setInputValue] = useState<string>(
    value !== undefined ? String(value) : ''
  );
  const [error, setError] = useState<string | null>(null);

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined) {
      setInputValue(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    setError(null);

    if (raw.trim() === '') {
      onChange(undefined);
      return;
    }

    // Allow negative, decimal, and scientific notation
    const cleanValue = raw.replace(/[^\d.\-eE]/g, '');
    const numValue = parseFloat(cleanValue);

    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }

    onChange(numValue);
  };

  const getFormatHint = (): string => {
    if (!expectedFormat) return 'Enter your numeric answer';

    switch (expectedFormat) {
      case 'fraction_or_decimal':
        return 'Enter as a decimal (e.g., 0.25) or fraction (e.g., 1/4)';
      case 'percentage':
        return 'Enter as a percentage (e.g., 25) or decimal (e.g., 0.25)';
      case 'integer':
        return 'Enter a whole number';
      case 'currency':
        return 'Enter the amount (e.g., 12.50)';
      default:
        return `Expected format: ${expectedFormat}`;
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="numeric-answer" className="text-sm text-gray-600">
        {getFormatHint()}
      </Label>

      <div className="max-w-xs">
        <Input
          id="numeric-answer"
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={handleChange}
          placeholder="Enter your answer"
          className={error ? 'border-red-500 focus:ring-red-500' : ''}
        />

        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Format examples */}
      {expectedFormat && (
        <div className="text-xs text-gray-400 mt-2">
          <p>Acceptable formats:</p>
          <ul className="list-disc list-inside">
            {expectedFormat === 'fraction_or_decimal' && (
              <>
                <li>Decimal: 0.25, 0.333</li>
                <li>Simplified decimal: .25</li>
              </>
            )}
            {expectedFormat === 'percentage' && (
              <>
                <li>Percentage: 25</li>
                <li>Decimal: 0.25</li>
              </>
            )}
            {expectedFormat === 'currency' && (
              <li>Amount: 12.50, 100</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
