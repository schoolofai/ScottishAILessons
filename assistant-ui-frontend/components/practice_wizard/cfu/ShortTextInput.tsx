"use client";

/**
 * ShortTextInput - Single line text input for short text CFU questions
 */

import React from "react";
import { Type } from "lucide-react";

interface ShortTextInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ShortTextInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Type your answer here",
}: ShortTextInputProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-sm">
            <Type className="w-5 h-5 text-white" />
          </div>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            w-full pl-20 pr-6 py-5 text-xl font-medium text-gray-800
            bg-white border-2 border-gray-200 rounded-2xl
            focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100
            placeholder:text-gray-400 placeholder:font-normal placeholder:text-lg
            transition-all duration-200
            ${disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : ""}
          `}
        />
      </div>
    </div>
  );
}

export default ShortTextInput;
