"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MathInput } from "@/components/ui/math-input";
import { SimplifiedMathShortcuts, SimplifiedLevel } from "@/components/ui/simplified-math-shortcuts";
import katex from 'katex';

interface EnhancedNumericQuestionProps {
  /** Numeric value (or undefined if not answered) */
  value?: number;
  /** Expected answer format hint */
  expectedFormat?: string | null;
  /** Callback when value changes */
  onChange: (value: number | undefined) => void;
  /** SQA level for styling */
  level: SimplifiedLevel;
  /** Optional: enable rich math input for fractions */
  allowMathInput?: boolean;
  /** Callback when rich text value changes (for fraction mode) */
  onRichChange?: (html: string) => void;
  /** Rich text value (HTML) for fraction mode */
  richValue?: string;
}

/**
 * Level-specific styling for the input
 */
const LEVEL_STYLES: Record<SimplifiedLevel, {
  borderColor: string;
  focusRing: string;
  hintBg: string;
}> = {
  n3: {
    borderColor: 'border-green-400 focus:border-green-500',
    focusRing: 'focus:ring-green-500',
    hintBg: 'bg-green-50',
  },
  n4: {
    borderColor: 'border-blue-400 focus:border-blue-500',
    focusRing: 'focus:ring-blue-500',
    hintBg: 'bg-blue-50',
  },
};

/**
 * EnhancedNumericQuestion - Level-styled numeric input for NAT3/NAT4
 *
 * Features:
 * - Level-appropriate color theming
 * - Optional MathInput mode for fraction questions
 * - Large touch-friendly input
 * - Clear format hints
 *
 * @example
 * ```tsx
 * // Standard numeric input
 * <EnhancedNumericQuestion
 *   value={answer}
 *   onChange={setAnswer}
 *   level="n3"
 *   expectedFormat="integer"
 * />
 *
 * // With math input for fractions
 * <EnhancedNumericQuestion
 *   value={answer}
 *   onChange={setAnswer}
 *   level="n4"
 *   expectedFormat="fraction_or_decimal"
 *   allowMathInput={true}
 *   onRichChange={setRichAnswer}
 *   richValue={richAnswer}
 * />
 * ```
 */
export function EnhancedNumericQuestion({
  value,
  expectedFormat,
  onChange,
  level,
  allowMathInput = false,
  onRichChange,
  richValue,
}: EnhancedNumericQuestionProps) {
  const [inputValue, setInputValue] = useState<string>(
    value !== undefined ? String(value) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [showMathInput, setShowMathInput] = useState(false);
  const [isMathfieldReady, setIsMathfieldReady] = useState(false);
  const [displayLatex, setDisplayLatex] = useState<string | null>(null);
  const mathfieldRef = useRef<any>(null);

  const styles = LEVEL_STYLES[level];

  // Check if this question should use math input mode
  const isFractionMode = allowMathInput && expectedFormat === 'fraction_or_decimal';

  // Sync external value changes
  useEffect(() => {
    if (value !== undefined && !isFractionMode) {
      setInputValue(String(value));
    }
  }, [value, isFractionMode]);

  // Handle standard numeric input change
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

  // Handle mathfield ready callback
  const handleMathfieldReady = (ref: React.RefObject<any>) => {
    mathfieldRef.current = ref.current;
    setIsMathfieldReady(true);
  };

  // Handle math formula insertion
  const handleMathInsert = (latex: string) => {
    if (!latex.trim()) return;

    try {
      // Render to HTML for display
      const html = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });

      setDisplayLatex(latex);
      setShowMathInput(false);
      setIsMathfieldReady(false);

      // Store the rich content
      if (onRichChange) {
        // Wrap in a span with data-latex for extraction later
        const richHtml = `<span class="math-answer" data-latex="${encodeURIComponent(latex)}">${html}</span>`;
        onRichChange(richHtml);
      }

      // Also try to parse a numeric value from the latex
      // Simple fractions like \frac{1}{2} can be evaluated
      try {
        const fractionMatch = latex.match(/\\frac\{(\d+)\}\{(\d+)\}/);
        if (fractionMatch) {
          const numValue = parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
          onChange(numValue);
        }
      } catch {
        // Ignore parsing errors - keep undefined
      }
    } catch (err) {
      console.error('Math render error:', err);
      alert('Invalid formula. Please check your input.');
    }
  };

  // Cancel math input
  const handleMathCancel = () => {
    setShowMathInput(false);
    setIsMathfieldReady(false);
  };

  // Clear math answer
  const handleClearMath = () => {
    setDisplayLatex(null);
    if (onRichChange) onRichChange('');
    onChange(undefined);
  };

  const getFormatHint = (): string => {
    if (!expectedFormat) return 'Enter your numeric answer';

    switch (expectedFormat) {
      case 'fraction_or_decimal':
        return isFractionMode
          ? 'Enter your answer as a fraction or decimal'
          : 'Enter as a decimal (e.g., 0.25)';
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

  // Render fraction mode with MathInput
  if (isFractionMode) {
    return (
      <div className="space-y-3">
        <Label className="text-sm text-gray-600">
          {getFormatHint()}
        </Label>

        {/* Display current answer or input controls */}
        {displayLatex || richValue ? (
          <div className="space-y-2">
            {/* Rendered math answer */}
            <div
              className={`p-4 rounded-lg border-2 ${styles.borderColor} ${styles.hintBg}`}
              dangerouslySetInnerHTML={{
                __html: richValue || (displayLatex ? katex.renderToString(displayLatex, { throwOnError: false }) : '')
              }}
            />

            {/* Edit/Clear buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMathInput(true)}
                className="min-h-[44px]"
              >
                Edit Answer
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearMath}
                className="min-h-[44px] text-red-600 hover:text-red-700"
              >
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Math input toggle button */}
            {!showMathInput && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowMathInput(true)}
                  className={`min-h-[48px] ${styles.borderColor} gap-2`}
                >
                  <span className="text-xl">Σ</span>
                  Enter Fraction or Formula
                </Button>

                {/* Alternative: plain decimal input */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={inputValue}
                      onChange={handleChange}
                      placeholder="Enter decimal (e.g., 0.5)"
                      className={`min-h-[44px] text-lg ${styles.borderColor} ${styles.focusRing}`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Math input panel */}
        {showMathInput && (
          <div className={`border-2 rounded-lg overflow-hidden ${styles.borderColor}`}>
            {/* Simplified shortcuts */}
            <div className={`px-3 py-2 border-b ${styles.hintBg}`}>
              <SimplifiedMathShortcuts
                mathfieldRef={mathfieldRef}
                disabled={!isMathfieldReady}
                level={level}
              />
            </div>

            {/* MathLive input */}
            <MathInput
              onInsert={handleMathInsert}
              onCancel={handleMathCancel}
              onMathfieldReady={handleMathfieldReady}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }

  // Standard numeric input with level styling
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
          className={`
            min-h-[48px] text-xl font-mono
            ${styles.borderColor}
            ${styles.focusRing}
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
          `}
        />

        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Format examples */}
      {expectedFormat && (
        <div className={`text-xs text-gray-500 mt-2 p-2 rounded ${styles.hintBg}`}>
          <p className="font-medium mb-1">Acceptable formats:</p>
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
            {expectedFormat === 'integer' && (
              <li>Whole number: 42, -7</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
