"use client";

/**
 * HintPanel - Progressive hint reveal for practice questions
 *
 * Supports two modes:
 * 1. Self-managed mode: Pass onHintUsed callback, panel handles reveal logic
 * 2. Display-only mode: Pass pre-revealed hints and totalHints, parent handles reveal
 *
 * Displays hints one at a time with a playful reveal animation.
 * Tracks how many hints have been used.
 */

import React, { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { MathRenderer } from "./MathRenderer";

interface HintPanelProps {
  /** Hints to display (in display-only mode, these are pre-revealed hints) */
  hints: string[];
  /** Callback when a hint is revealed (self-managed mode) */
  onHintUsed?: (count: number) => void;
  /** Total hints available (display-only mode) */
  totalHints?: number;
}

export function HintPanel({ hints, onHintUsed, totalHints }: HintPanelProps) {
  // Self-managed mode state
  const [revealedCount, setRevealedCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded in display mode

  // Determine if we're in display-only mode (no onHintUsed callback)
  const isDisplayOnly = !onHintUsed;

  const handleRevealHint = () => {
    // Only works in self-managed mode
    if (isDisplayOnly) return;

    if (revealedCount < hints.length) {
      const newCount = revealedCount + 1;
      setRevealedCount(newCount);
      setIsExpanded(true);
      onHintUsed(newCount);
    }
  };

  if (hints.length === 0) {
    return null;
  }

  // In display-only mode, all passed hints are already revealed
  // In self-managed mode, use internal revealedCount state
  const displayedHints = isDisplayOnly ? hints : hints.slice(0, revealedCount);
  const displayedCount = isDisplayOnly ? hints.length : revealedCount;
  const totalCount = isDisplayOnly ? (totalHints ?? hints.length) : hints.length;
  const hasMoreHints = isDisplayOnly ? false : (revealedCount < hints.length);

  return (
    <div className="wizard-hint">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-800">Hints</span>
          <span className="text-sm text-gray-500">
            ({displayedCount}/{totalCount} used)
          </span>
        </div>

        {/* Toggle button for revealed hints */}
        {displayedCount > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-full hover:bg-amber-100 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
        )}
      </div>

      {/* Revealed hints */}
      {isExpanded && displayedHints.length > 0 && (
        <div className="space-y-3 mb-3">
          {displayedHints.map((hint, idx) => (
            <div
              key={idx}
              className="flex gap-3 p-3 bg-white/70 rounded-xl border border-amber-200 animate-slide-up"
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">
                {idx + 1}
              </div>
              <div className="flex-1 text-gray-700">
                <MathRenderer content={hint} className="text-sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reveal button - only shown in self-managed mode */}
      {hasMoreHints && !isDisplayOnly ? (
        <button
          onClick={handleRevealHint}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-sm transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          {revealedCount === 0 ? "Need a hint?" : `Show hint ${revealedCount + 1}`}
        </button>
      ) : displayedCount === totalCount && displayedCount > 0 ? (
        <p className="text-center text-sm text-amber-700 font-medium">
          All hints revealed! You&apos;ve got this! 💪
        </p>
      ) : null}
    </div>
  );
}

export default HintPanel;
