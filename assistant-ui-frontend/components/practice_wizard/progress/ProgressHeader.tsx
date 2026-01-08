"use client";

/**
 * ProgressHeader - Enhanced persistent header for practice wizard
 *
 * Replaces cryptic WizardProgressBar dots with human-readable information:
 * - Block title and position (e.g., "Block 2 of 5")
 * - Visual mastery progress bar with 70% goal marker
 * - Stats pills (XP, Streak)
 * - Action buttons (Reference toggle, Reset)
 */

import React from "react";
import { motion } from "framer-motion";
import {
  X,
  Zap,
  Flame,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ProgressReport,
  ConceptBlock,
  PracticeQuestion,
} from "@/hooks/practice/useLangGraphWizard";

interface ProgressHeaderProps {
  progress: ProgressReport | null;
  currentBlock: ConceptBlock | null;
  currentQuestion: PracticeQuestion | null;
  totalXP: number;
  currentStreak: number;
  lessonTitle: string;
  onExit: () => void;
  onToggleReference?: () => void;
  isReferencePanelOpen?: boolean;
  onReset?: () => void;
  /** V2 mode flag for reference panel toggle */
  useV2Mode?: boolean;
}

export function ProgressHeader({
  progress,
  currentBlock,
  currentQuestion,
  totalXP,
  currentStreak,
  lessonTitle,
  onExit,
  onToggleReference,
  isReferencePanelOpen,
  onReset,
  useV2Mode,
}: ProgressHeaderProps) {
  const blockIndex = progress?.current_block_index ?? 0;
  const totalBlocks = progress?.total_blocks ?? 1;
  const blockTitle =
    currentQuestion?.block_title || currentBlock?.title || lessonTitle;

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200/50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* LEFT: Exit + Block Info */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          {/* Exit button */}
          <button
            onClick={onExit}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Exit practice"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Block info */}
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-gray-800 truncate max-w-[200px] sm:max-w-xs">
              {blockTitle}
            </h1>
            <p className="text-xs text-gray-500">
              Block {blockIndex + 1} of {totalBlocks}
            </p>
          </div>
        </div>

        {/* CENTER: Spacer for balanced layout */}
        <div className="hidden sm:flex flex-1" />

        {/* RIGHT: Stats + Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Streak badge */}
          {currentStreak > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-semibold"
            >
              <Flame className="w-3.5 h-3.5" />
              <span className="tabular-nums">{currentStreak}</span>
            </motion.div>
          )}

          {/* XP badge */}
          <div className="flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span className="tabular-nums">{totalXP}</span>
          </div>

          {/* Reference panel toggle - V2 mode only */}
          {useV2Mode && onToggleReference && (
            <button
              onClick={onToggleReference}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isReferencePanelOpen
                  ? "bg-cyan-100 text-cyan-600"
                  : "hover:bg-cyan-50 text-gray-400 hover:text-cyan-600"
              )}
              aria-label="Toggle reference panel"
              title="View block explanation and examples"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          )}

          {/* Reset button */}
          {onReset && (
            <button
              onClick={onReset}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Reset progress"
              title="Reset practice session"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default ProgressHeader;
