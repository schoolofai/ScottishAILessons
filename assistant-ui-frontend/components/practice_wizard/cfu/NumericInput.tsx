"use client";

/**
 * NumericInput - Number input for numeric CFU questions
 *
 * Large, clear input field optimized for number entry.
 * Supports currency symbols (£, $, €, ¥) and percentage signs.
 */

import React from "react";
import { Hash } from "lucide-react";

interface NumericInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Validates numeric input including currency symbols.
 * Allows: numbers, decimals, negative values, currency symbols (£$€¥), and %
 * Examples: "42", "-3.14", "£50", "$99.99", "€100", "25%", "-£50.00"
 */
function isValidNumericInput(value: string): boolean {
  if (value === "") return true;

  // Pattern allows:
  // - Optional leading currency symbol (£$€¥)
  // - Optional minus sign (before or after currency)
  // - Numbers with optional decimal
  // - Optional trailing currency symbol or percentage
  const numericPattern = /^[£$€¥]?-?\d*\.?\d*[£$€¥%]?$|^-?[£$€¥]?\d*\.?\d*[%]?$/;
  return numericPattern.test(value);
}

export function NumericInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter your answer",
}: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow numbers, decimal points, minus sign, and currency symbols
    const newValue = e.target.value;
    if (isValidNumericInput(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-sm">
            <Hash className="w-5 h-5 text-white" />
          </div>
        </div>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full pl-20 pr-6 py-5 text-2xl font-semibold text-gray-800
            bg-white border-2 border-gray-200 rounded-2xl
            focus:border-violet-400 focus:ring-4 focus:ring-violet-100
            placeholder:text-gray-400 placeholder:font-normal placeholder:text-lg
            transition-all duration-200
            ${disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : ""}
          `}
        />
      </div>
      <p className="text-sm text-gray-500 pl-2">
        Enter a number (decimals, negatives, and currency symbols like £$€ allowed)
      </p>
    </div>
  );
}

export default NumericInput;
