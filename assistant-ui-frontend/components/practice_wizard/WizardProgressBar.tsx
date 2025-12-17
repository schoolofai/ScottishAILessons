"use client";

/**
 * WizardProgressBar - Compact inline progress visualization
 *
 * Shows block progress as a sleek single-line indicator with
 * mastery percentage and block dots.
 */

import React from "react";
import { Check, Star, Sparkles } from "lucide-react";
import type { ProgressReport, WizardStage } from "@/hooks/practice/useLangGraphWizard";

interface WizardProgressBarProps {
  progress: ProgressReport;
  currentStage: WizardStage;
}

export function WizardProgressBar({ progress, currentStage }: WizardProgressBarProps) {
  const { total_blocks, current_block_index, overall_mastery, blocks } = progress;

  const masteryPercent = Math.round(overall_mastery * 100);
  const completedBlocks = blocks.filter((b) => b.is_complete).length;

  return (
    <div className="flex items-center gap-3">
      {/* Block indicator dots */}
      <div className="flex items-center gap-1.5">
        {blocks.map((block, index) => {
          const isComplete = block.is_complete;
          const isCurrent = index === current_block_index;
          const isGolden = block.mastery_score >= 0.9;

          return (
            <div
              key={block.block_id}
              className="relative group"
            >
              {/* Dot */}
              <div
                className={`
                  w-2.5 h-2.5 rounded-full transition-all duration-300
                  ${isGolden && isComplete
                    ? "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-sm shadow-amber-200"
                    : isComplete
                    ? "bg-emerald-500"
                    : isCurrent
                    ? "bg-cyan-500 ring-2 ring-cyan-200 ring-offset-1"
                    : "bg-gray-200"
                  }
                `}
              />

              {/* Current pulse */}
              {isCurrent && !isComplete && (
                <div className="absolute inset-0 rounded-full bg-cyan-400/40 animate-ping" />
              )}

              {/* Tooltip on hover */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                  {block.is_complete ? (
                    <span className="flex items-center gap-1">
                      {isGolden ? <Star className="w-3 h-3 text-amber-400" /> : <Check className="w-3 h-3" />}
                      {Math.round(block.mastery_score * 100)}%
                    </span>
                  ) : (
                    `Block ${index + 1}`
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-200" />

      {/* Mastery badge */}
      <div className="flex items-center gap-1.5">
        {masteryPercent >= 80 && (
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span className={`
          text-xs font-semibold tabular-nums
          ${masteryPercent >= 80 ? "text-amber-600" : masteryPercent >= 50 ? "text-emerald-600" : "text-gray-500"}
        `}>
          {masteryPercent}%
        </span>
      </div>
    </div>
  );
}

export default WizardProgressBar;
