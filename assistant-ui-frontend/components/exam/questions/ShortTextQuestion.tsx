"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ShortTextQuestionProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

/**
 * ShortTextQuestion - Short text answer input
 *
 * For brief written responses, definitions, and single-sentence answers.
 */
export function ShortTextQuestion({
  value,
  onChange,
  maxLength = 500,
}: ShortTextQuestionProps) {
  const remaining = maxLength - value.length;

  return (
    <div className="space-y-3">
      <Label htmlFor="short-answer" className="text-sm text-gray-600">
        Enter your answer
      </Label>

      <Textarea
        id="short-answer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer here..."
        rows={4}
        maxLength={maxLength}
        className="resize-none"
      />

      <div className="flex justify-end">
        <span
          className={`text-xs ${
            remaining < 50 ? 'text-amber-600' : 'text-gray-400'
          }`}
        >
          {remaining} characters remaining
        </span>
      </div>
    </div>
  );
}
