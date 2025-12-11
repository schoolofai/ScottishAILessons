"use client";

/**
 * MCQMultiSelect - Multi-choice multiple choice question
 *
 * Checkbox-style selection with a limit on how many can be selected.
 *
 * IMPORTANT: Options are simple strings from the backend.
 * The index (0, 1, 2, 3) is used as the option ID/value.
 * See: @/types/practice-wizard-contracts.ts
 */

import React from "react";
import { Square, CheckSquare } from "lucide-react";
import { MathRenderer } from "../shared/MathRenderer";

interface MCQMultiSelectProps {
  /** Options as simple strings from backend */
  options: string[];
  /** Number of options to select */
  selectCount: number;
  /** Selected option indices as strings (e.g., ["0", "2"]) */
  value: string[];
  /** Callback with selected indices as strings */
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function MCQMultiSelect({
  options,
  selectCount,
  value,
  onChange,
  disabled = false,
}: MCQMultiSelectProps) {
  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const handleToggle = (optionId: string) => {
    if (disabled) return;

    const isCurrentlySelected = value.includes(optionId);

    if (isCurrentlySelected) {
      // Remove from selection
      onChange(value.filter((id) => id !== optionId));
    } else {
      // Add to selection (if under limit)
      if (value.length < selectCount) {
        onChange([...value, optionId]);
      }
    }
  };

  const isAtLimit = value.length >= selectCount;

  return (
    <div className="space-y-3">
      {/* Selection counter */}
      <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
        <span>Select {selectCount} option{selectCount > 1 ? "s" : ""}</span>
        <span
          className={`font-medium ${
            value.length === selectCount ? "text-emerald-600" : ""
          }`}
        >
          {value.length}/{selectCount} selected
        </span>
      </div>

      {options.map((optionText, idx) => {
        // Use index as the option ID
        const optionId = String(idx);
        const isSelected = value.includes(optionId);
        const label = optionLabels[idx] || String(idx + 1);
        const canSelect = !isAtLimit || isSelected;

        return (
          <button
            key={optionId}
            type="button"
            onClick={() => handleToggle(optionId)}
            disabled={disabled || (!isSelected && isAtLimit)}
            className={`
              w-full p-4 rounded-2xl border-2 text-left transition-all duration-200
              flex items-start gap-4 group
              ${
                isSelected
                  ? "border-emerald-400 bg-emerald-50 shadow-md"
                  : canSelect
                  ? "border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }
              ${disabled || !canSelect ? "cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            {/* Checkbox indicator */}
            <div
              className={`
                flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                font-bold text-lg transition-all duration-200
                ${
                  isSelected
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 group-hover:bg-cyan-100"
                }
              `}
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </div>

            {/* Option label and text */}
            <div className="flex-1">
              <div className="text-xs font-bold text-gray-400 mb-1">{label}</div>
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

export default MCQMultiSelect;
