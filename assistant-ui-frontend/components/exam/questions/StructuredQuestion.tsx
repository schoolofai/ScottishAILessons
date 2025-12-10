"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface StructuredQuestionProps {
  value: string;
  workingOut?: string;
  onChange: (answer: string, workingOut?: string) => void;
}

/**
 * StructuredQuestion - Multi-part response with working out section
 *
 * For extended responses that require showing work/reasoning.
 * Includes separate fields for working and final answer.
 */
export function StructuredQuestion({
  value,
  workingOut = '',
  onChange,
}: StructuredQuestionProps) {
  return (
    <div className="space-y-6">
      {/* Working out section */}
      <div className="space-y-3">
        <Label htmlFor="working-out" className="text-sm text-gray-600">
          Show your working (optional but recommended)
        </Label>
        <p className="text-xs text-gray-400">
          Show your calculations, reasoning, or method step by step.
          This helps you get partial marks even if your final answer is incorrect.
        </p>
        <Textarea
          id="working-out"
          value={workingOut}
          onChange={(e) => onChange(value, e.target.value)}
          placeholder="Step 1: ...
Step 2: ...
Step 3: ..."
          rows={6}
          className="resize-none font-mono text-sm"
        />
      </div>

      {/* Final answer section */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <Label htmlFor="final-answer" className="text-sm font-medium text-gray-700">
          Final Answer
        </Label>
        <Textarea
          id="final-answer"
          value={value}
          onChange={(e) => onChange(e.target.value, workingOut)}
          placeholder="Enter your final answer here..."
          rows={4}
          className="resize-none"
        />
      </div>
    </div>
  );
}
