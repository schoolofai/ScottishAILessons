"use client";

/**
 * CFURenderer - Check For Understanding component switcher
 *
 * Renders the appropriate CFU type based on question data.
 * Supports: MCQ (single/multi), numeric, structured_response
 *
 * IMPORTANT: This component uses types from the backend contract.
 * The `options` field is a simple string array from the backend.
 * See: @/types/practice-wizard-contracts.ts
 */

import React from "react";
import { MCQSingleSelect } from "./MCQSingleSelect";
import { MCQMultiSelect } from "./MCQMultiSelect";
import { NumericInput } from "./NumericInput";
import { StructuredResponseEditor } from "./StructuredResponseEditor";

// Import the exact type from backend contract
import type { QuestionType } from "@/types/practice-wizard-contracts";

export interface CFURendererProps {
  /**
   * Question type from backend - matches QuestionType exactly.
   * Valid values: "mcq" | "numeric" | "structured_response"
   */
  questionType: QuestionType;
  /**
   * MCQ options as simple strings from backend.
   * The index (0, 1, 2, 3) is used as the option ID.
   * Example: ["Calculate 2+2", "Find derivative", "Solve for x"]
   */
  options?: string[];
  /** Number of options to select for multi-select MCQ (default: 1) */
  selectCount?: number;
  /** Current answer value */
  value: string | string[];
  /** Callback when answer changes */
  onChange: (value: string | string[]) => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Callback for structured response drawing saves */
  onDrawingSave?: (dataUrl: string, sceneData?: unknown) => void;
}

export function CFURenderer({
  questionType,
  options,
  selectCount,
  value,
  onChange,
  disabled = false,
  onDrawingSave,
}: CFURendererProps) {
  const isMultiSelect = questionType === "mcq" && selectCount && selectCount > 1;

  switch (questionType) {
    case "mcq":
      if (isMultiSelect) {
        return (
          <MCQMultiSelect
            options={options || []}
            selectCount={selectCount!}
            value={Array.isArray(value) ? value : []}
            onChange={(newValue) => onChange(newValue)}
            disabled={disabled}
          />
        );
      }
      return (
        <MCQSingleSelect
          options={options || []}
          value={typeof value === "string" ? value : ""}
          onChange={(newValue) => onChange(newValue)}
          disabled={disabled}
        />
      );

    case "numeric":
      return (
        <NumericInput
          value={typeof value === "string" ? value : ""}
          onChange={(newValue) => onChange(newValue)}
          disabled={disabled}
        />
      );

    case "structured_response":
      return (
        <StructuredResponseEditor
          value={typeof value === "string" ? value : ""}
          onChange={(newValue) => onChange(newValue)}
          disabled={disabled}
          onDrawingSave={onDrawingSave}
        />
      );

    default:
      // This should never happen if backend contract is followed
      return (
        <div className="text-red-500 p-4 border border-red-200 rounded-lg">
          Unknown question type: {questionType}
        </div>
      );
  }
}

export default CFURenderer;
