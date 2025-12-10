"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { MCQOption } from "@/lib/exam/types";

interface MCQQuestionProps {
  options: MCQOption[];
  selectedOption?: string;
  selectedOptions?: string[];
  multiSelect?: boolean;
  onSelect: (option: string, options?: string[]) => void;
}

/**
 * MCQQuestion - Multiple choice question input
 *
 * Supports both single-select (radio) and multi-select (checkbox) modes.
 * Options can contain LaTeX/Markdown content.
 */
export function MCQQuestion({
  options,
  selectedOption,
  selectedOptions = [],
  multiSelect = false,
  onSelect,
}: MCQQuestionProps) {
  const handleSelect = (label: string) => {
    if (multiSelect) {
      const newSelection = selectedOptions.includes(label)
        ? selectedOptions.filter((o) => o !== label)
        : [...selectedOptions, label];
      onSelect(label, newSelection);
    } else {
      onSelect(label);
    }
  };

  const isSelected = (label: string): boolean => {
    if (multiSelect) {
      return selectedOptions.includes(label);
    }
    return selectedOption === label;
  };

  return (
    <div className="space-y-3">
      {multiSelect && (
        <p className="text-sm text-gray-500 mb-2">
          Select all that apply
        </p>
      )}

      {options.map((option) => {
        const selected = isSelected(option.label);

        return (
          <button
            key={option.label}
            onClick={() => handleSelect(option.label)}
            className={cn(
              "w-full flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
              selected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            {/* Selection indicator */}
            <div className="flex-shrink-0 mt-0.5">
              {multiSelect ? (
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    selected
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300"
                  )}
                >
                  {selected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              ) : (
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    selected
                      ? "border-blue-500"
                      : "border-gray-300"
                  )}
                >
                  {selected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
              )}
            </div>

            {/* Option content */}
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "font-semibold flex-shrink-0",
                    selected ? "text-blue-700" : "text-gray-700"
                  )}
                >
                  {option.label}.
                </span>
                <div
                  className={cn(
                    "prose prose-sm max-w-none",
                    selected ? "text-blue-900" : "text-gray-700"
                  )}
                >
                  <MarkdownRenderer content={option.text} />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
