"use client";

/**
 * BlockStopMarker - Individual metro stop on the journey timeline
 *
 * Visual states:
 * - Golden (90%+ complete): Amber gradient + star icon + glow
 * - Complete (< 90%): Emerald + checkmark
 * - Current: Cyan gradient + pulse animation
 * - Locked: Gray + lock icon
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Star, Lock, ChevronDown, Trophy, Target, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockProgress } from "@/lib/utils/extractResumePosition";
import { MasteryBreakdown } from "./MasteryBreakdown";

interface CurrentBlockDetails {
  cumulativeMastery: number;
  hardQuestionsAttempted: number;
  questionsAnswered: number;
  questionsCorrect: number;
  currentDifficulty: "easy" | "medium" | "hard";
}

/**
 * Detailed completion stats for a finished block.
 * Used to display full information in the collapsible summary.
 *
 * Supports two data sources:
 * 1. Per-difficulty breakdown (from stored_session persistence)
 * 2. Totals only (from blocks completing during current session)
 */
export interface CompletedBlockDetails {
  /** Final mastery score (0-1) */
  mastery: number;
  /** Questions attempted per difficulty level (from stored_session) */
  questionsAttempted?: { easy: number; medium: number; hard: number };
  /** Questions correct per difficulty level (from stored_session) */
  questionsCorrect?: { easy: number; medium: number; hard: number };
  /** Total questions answered (for session-completed blocks without per-difficulty data) */
  totalQuestionsAnswered?: number;
  /** Total questions correct (for session-completed blocks without per-difficulty data) */
  totalQuestionsCorrect?: number;
  /** Hard questions attempted (for session-completed blocks) */
  hardQuestionsAttempted?: number;
  /** Final difficulty level when completed */
  finalDifficulty?: "easy" | "medium" | "hard";
}

interface BlockStopMarkerProps {
  block: BlockProgress;
  index: number;
  isCurrent: boolean;
  isLocked: boolean;
  currentDetails?: CurrentBlockDetails;
  /** Detailed completion stats for finished blocks */
  completedDetails?: CompletedBlockDetails;
  blockTitle?: string;
}

export function BlockStopMarker({
  block,
  index,
  isCurrent,
  isLocked,
  currentDetails,
  completedDetails,
  blockTitle,
}: BlockStopMarkerProps) {
  // Collapsible state for completed blocks
  const [isExpanded, setIsExpanded] = useState(false);

  const masteryPercent = Math.round((block.mastery_score ?? 0) * 100);
  const isGolden = block.is_complete && masteryPercent >= 90;
  const isComplete = block.is_complete;

  // Determine stop visual state
  const getStopStyles = () => {
    if (isGolden) {
      return "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200/50";
    }
    if (isComplete) {
      return "bg-emerald-500";
    }
    if (isCurrent) {
      return "bg-gradient-to-br from-cyan-500 to-blue-500 ring-4 ring-cyan-100";
    }
    return "bg-gray-300";
  };

  // Get mastery bar color variant
  const getMasteryBarColor = () => {
    if (isGolden) return "bg-gradient-to-r from-amber-400 to-yellow-500";
    if (isComplete) return "bg-emerald-500";
    return "bg-cyan-500";
  };

  return (
    <div className="relative flex gap-3">
      {/* Stop circle */}
      <div
        className={cn(
          "relative w-5 h-5 rounded-full flex items-center justify-center z-10 flex-shrink-0 transition-all duration-300",
          getStopStyles()
        )}
      >
        {isGolden && <Star className="w-3 h-3 text-white fill-white" />}
        {isComplete && !isGolden && <Check className="w-3 h-3 text-white" />}
        {isCurrent && !isComplete && (
          <div className="w-2 h-2 bg-white rounded-full" />
        )}
        {isLocked && <Lock className="w-2.5 h-2.5 text-gray-400" />}

        {/* Current block pulse animation */}
        {isCurrent && !isComplete && (
          <motion.div
            className="absolute inset-0 rounded-full bg-cyan-400/40"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* Block info */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "font-semibold text-sm truncate",
              isCurrent
                ? "text-cyan-700"
                : isComplete
                ? "text-gray-700"
                : "text-gray-400"
            )}
          >
            Block {index + 1}{blockTitle && ` - ${blockTitle}`}
          </span>
          {isCurrent && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-cyan-500 text-white rounded flex-shrink-0">
              Current
            </span>
          )}
          {isGolden && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-white rounded flex items-center gap-0.5 flex-shrink-0">
              <Star className="w-2.5 h-2.5 fill-white" />
              Gold
            </span>
          )}
        </div>

        {/* Collapsible summary for COMPLETED blocks */}
        {isComplete && !isCurrent && (
          <div className="mt-2">
            {/* Clickable header - mastery bar with expand toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full group"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Collapse" : "Expand"} Block ${index + 1} summary`}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", getMasteryBarColor())}
                    initial={{ width: 0 }}
                    animate={{ width: `${masteryPercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular-nums min-w-[32px] text-right",
                    isGolden ? "text-amber-600" : "text-emerald-600"
                  )}
                >
                  {masteryPercent}%
                </span>
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform duration-200",
                    isGolden ? "text-amber-500" : "text-emerald-500",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>
            </button>

            {/* Expanded summary panel with emerald/golden theme */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  {completedDetails ? (
                    /* Full MasteryBreakdown with detailed stats */
                    <div className="mt-2">
                      <MasteryBreakdown
                        currentMastery={completedDetails.mastery}
                        hardQuestionsAttempted={
                          // Prefer per-difficulty hard count, fallback to total hard attempted
                          completedDetails.questionsAttempted?.hard ??
                          completedDetails.hardQuestionsAttempted ??
                          0
                        }
                        questionsAnswered={
                          // Prefer totals, fallback to sum of per-difficulty
                          completedDetails.totalQuestionsAnswered ??
                          (completedDetails.questionsAttempted
                            ? completedDetails.questionsAttempted.easy +
                              completedDetails.questionsAttempted.medium +
                              completedDetails.questionsAttempted.hard
                            : 0)
                        }
                        questionsCorrect={
                          // Prefer totals, fallback to sum of per-difficulty
                          completedDetails.totalQuestionsCorrect ??
                          (completedDetails.questionsCorrect
                            ? completedDetails.questionsCorrect.easy +
                              completedDetails.questionsCorrect.medium +
                              completedDetails.questionsCorrect.hard
                            : 0)
                        }
                        currentDifficulty={completedDetails.finalDifficulty}
                        compact
                        className={cn(
                          "p-3 rounded-xl border",
                          isGolden
                            ? "bg-amber-50/80 border-amber-200/50"
                            : "bg-emerald-50/80 border-emerald-200/50"
                        )}
                      />
                    </div>
                  ) : (
                    /* Fallback: Simple mastery display when detailed stats unavailable */
                    <div
                      className={cn(
                        "mt-2 p-3 rounded-xl border",
                        isGolden
                          ? "bg-amber-50/80 border-amber-200/50"
                          : "bg-emerald-50/80 border-emerald-200/50"
                      )}
                    >
                      {/* Completion header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center",
                            isGolden
                              ? "bg-gradient-to-br from-amber-400 to-yellow-500"
                              : "bg-gradient-to-br from-emerald-400 to-green-500"
                          )}
                        >
                          {isGolden ? (
                            <Star className="w-3.5 h-3.5 text-white fill-white" />
                          ) : (
                            <Trophy className="w-3.5 h-3.5 text-white" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-bold",
                            isGolden ? "text-amber-700" : "text-emerald-700"
                          )}
                        >
                          {isGolden ? "Gold Mastery Achieved!" : "Block Completed"}
                        </span>
                      </div>

                      {/* Mastery score display */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Target
                              className={cn(
                                "w-3.5 h-3.5",
                                isGolden ? "text-amber-500" : "text-emerald-500"
                              )}
                            />
                            <span className="text-xs text-gray-600 font-medium">
                              Final Mastery
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-bold tabular-nums",
                              isGolden ? "text-amber-600" : "text-emerald-600"
                            )}
                          >
                            {masteryPercent}%
                          </span>
                        </div>

                        {/* Visual mastery bar */}
                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              isGolden
                                ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                                : "bg-gradient-to-r from-emerald-400 to-green-500"
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${masteryPercent}%` }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          />
                        </div>

                        {/* Completion confirmation */}
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-xs",
                            isGolden ? "text-amber-600" : "text-emerald-600"
                          )}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="font-medium">
                            All requirements met
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Block Completion breakdown for current block */}
        {isCurrent && currentDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-3"
          >
            <MasteryBreakdown
              currentMastery={currentDetails.cumulativeMastery}
              hardQuestionsAttempted={currentDetails.hardQuestionsAttempted}
              questionsAnswered={currentDetails.questionsAnswered}
              questionsCorrect={currentDetails.questionsCorrect}
              currentDifficulty={currentDetails.currentDifficulty}
              compact
              className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/50"
            />
          </motion.div>
        )}

        {/* Locked state text */}
        {isLocked && (
          <p className="text-[10px] text-gray-400 mt-1">
            Complete previous blocks to unlock
          </p>
        )}
      </div>
    </div>
  );
}

export default BlockStopMarker;
