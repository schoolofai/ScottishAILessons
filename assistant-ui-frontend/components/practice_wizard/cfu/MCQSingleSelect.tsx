"use client";

/**
 * MCQSingleSelect - Single-choice multiple choice question
 *
 * Playful radio button design for selecting one answer.
 *
 * IMPORTANT: Options are simple strings from the backend.
 * The index (0, 1, 2, 3) is used as the option ID/value.
 * See: @/types/practice-wizard-contracts.ts
 */

import React from "react";
import { Check } from "lucide-react";
import { MathRenderer } from "../shared/MathRenderer";

interface MCQSingleSelectProps {
  /** Options as simple strings from backend */
  options: string[];
  /** Selected option index as string (e.g., "0", "1", "2") */
  value: string;
  /** Callback with selected index as string */
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function MCQSingleSelect({
  options,
  value,
  onChange,
  disabled = false,
}: MCQSingleSelectProps) {
  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <div className="space-y-3">
      {options.map((optionText, idx) => {
        // Use index as the option ID
        const optionId = String(idx);
        const isSelected = value === optionId;
        const label = optionLabels[idx] || String(idx + 1);

        return (
          <button
            key={optionId}
            type="button"
            onClick={() => !disabled && onChange(optionId)}
            disabled={disabled}
            className={`
              w-full p-4 rounded-2xl border-2 text-left transition-all duration-200
              flex items-start gap-4 group
              ${
                isSelected
                  ? "border-emerald-400 bg-emerald-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50"
              }
              ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {/* Option label circle */}
            <div
              className={`
                flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                font-bold text-lg transition-all duration-200
                ${
                  isSelected
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 group-hover:bg-cyan-100 group-hover:text-cyan-700"
                }
              `}
            >
              {isSelected ? <Check className="w-5 h-5" /> : label}
            </div>

            {/* Option text */}
            <div className="flex-1 pt-2">
              <MathRenderer
                content={optionText}
                className={isSelected ? "text-gray-800" : "text-gray-700"}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default MCQSingleSelect;
