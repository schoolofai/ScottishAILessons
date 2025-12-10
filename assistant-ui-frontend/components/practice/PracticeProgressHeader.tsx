"use client";

/**
 * PracticeProgressHeader - Persistent progress display for infinite practice
 *
 * Shows block progress at the top of the practice chat, providing constant
 * visibility of the student's position and mastery across all blocks.
 */

import React from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircleIcon, CircleDotIcon, CircleIcon } from "lucide-react";

export interface BlockProgress {
  block_id: string;
  mastery_score: number;
  is_complete: boolean;
}

export interface PracticeProgressData {
  session_id: string;
  total_blocks: number;
  completed_blocks: number;
  current_block_index: number;
  overall_mastery: number;
  blocks: BlockProgress[];
}

interface PracticeProgressHeaderProps {
  progress: PracticeProgressData | null;
  currentBlockTitle?: string;
}

export function PracticeProgressHeader({
  progress,
  currentBlockTitle,
}: PracticeProgressHeaderProps) {
  // Don't render if no progress data yet
  if (!progress) {
    return null;
  }

  const {
    total_blocks,
    completed_blocks,
    current_block_index,
    overall_mastery,
    blocks,
  } = progress;

  const overallProgressPercent = (completed_blocks / total_blocks) * 100;
  const masteryPercent = Math.round(overall_mastery * 100);

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      {/* Top row: Current block and mastery */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">
            Block {current_block_index + 1} of {total_blocks}
          </span>
          {currentBlockTitle && (
            <span className="text-sm text-gray-500">• {currentBlockTitle}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {completed_blocks} completed
          </span>
          <span className="text-sm font-medium text-blue-600">
            {masteryPercent}% mastery
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={overallProgressPercent} className="h-2 mb-2" />

      {/* Block indicators */}
      <div className="flex gap-1">
        {blocks.map((block, idx) => (
          <div
            key={block.block_id}
            className="flex-1 flex items-center justify-center"
            title={`Block ${idx + 1}: ${Math.round(block.mastery_score * 100)}% mastery${block.is_complete ? " (Complete)" : ""}`}
          >
            {block.is_complete ? (
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
            ) : idx === current_block_index ? (
              <CircleDotIcon className="w-4 h-4 text-blue-500 animate-pulse" />
            ) : (
              <CircleIcon className="w-4 h-4 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      {/* Block progress bars (alternative visual) */}
      <div className="flex gap-1 mt-1">
        {blocks.map((block, idx) => (
          <div
            key={`bar-${block.block_id}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              block.is_complete
                ? "bg-green-500"
                : idx === current_block_index
                ? "bg-blue-500"
                : "bg-gray-200"
            }`}
            title={`Block ${idx + 1}: ${Math.round(block.mastery_score * 100)}%`}
          />
        ))}
      </div>
    </div>
  );
}

export default PracticeProgressHeader;
