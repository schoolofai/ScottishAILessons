"use client";

/**
 * WizardProgressBar - Gamified progress visualization
 *
 * Shows block progress as orbs that fill and glow as students
 * progress through the practice session.
 */

import React from "react";
import { Check, Star } from "lucide-react";
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
    <div className="space-y-2">
      {/* Mastery text */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 font-medium">
          Block {current_block_index + 1} of {total_blocks}
        </span>
        <span className="font-semibold text-emerald-600">
          {masteryPercent}% Mastery
        </span>
      </div>

      {/* Progress track with orbs */}
      <div className="relative">
        {/* Track background */}
        <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 bg-gray-200 rounded-full" />

        {/* Track fill */}
        <div
          className="absolute top-1/2 left-0 h-2 -translate-y-1/2 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${(completedBlocks / total_blocks) * 100}%`,
          }}
        />

        {/* Block orbs */}
        <div className="relative flex justify-between">
          {blocks.map((block, index) => {
            const isComplete = block.is_complete;
            const isCurrent = index === current_block_index;
            const isPast = index < current_block_index;
            const isGolden = block.mastery_score >= 0.9;

            // Determine orb style
            let orbClass = "wizard-orb ";
            if (isGolden && isComplete) {
              orbClass += "wizard-orb-golden";
            } else if (isComplete) {
              orbClass += "wizard-orb-complete";
            } else if (isCurrent) {
              orbClass += "wizard-orb-active";
            } else {
              orbClass += "wizard-orb-empty";
            }

            return (
              <div
                key={block.block_id}
                className="relative group"
                style={{
                  // Distribute orbs evenly along the track
                  flex: "0 0 auto",
                }}
              >
                {/* Orb */}
                <div
                  className={`${orbClass} relative z-10 transition-all duration-300`}
                  style={{
                    transform: isCurrent ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  {isComplete ? (
                    isGolden ? (
                      <Star className="w-5 h-5 fill-current" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Current indicator pulse */}
                {isCurrent && !isComplete && (
                  <div className="absolute inset-0 z-0 rounded-full bg-cyan-400/30 animate-ping" />
                )}

                {/* Tooltip */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    Block {index + 1}: {Math.round(block.mastery_score * 100)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Segment bars (alternative view for many blocks) */}
      {total_blocks > 6 && (
        <div className="flex gap-1 mt-3">
          {blocks.map((block, index) => {
            const isComplete = block.is_complete;
            const isCurrent = index === current_block_index;
            const isGolden = block.mastery_score >= 0.9;

            let barClass = "h-1.5 flex-1 rounded-full transition-all duration-300 ";
            if (isGolden && isComplete) {
              barClass += "bg-gradient-to-r from-amber-400 to-yellow-400";
            } else if (isComplete) {
              barClass += "bg-emerald-500";
            } else if (isCurrent) {
              barClass += "bg-cyan-500 animate-pulse";
            } else {
              barClass += "bg-gray-200";
            }

            return <div key={`bar-${block.block_id}`} className={barClass} />;
          })}
        </div>
      )}
    </div>
  );
}

export default WizardProgressBar;
