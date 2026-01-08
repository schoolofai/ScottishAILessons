"use client";

/**
 * MasteryBreakdown - Detailed mastery requirements panel
 *
 * Shows specific criteria needed to complete the current block:
 * - Current mastery vs target (70%)
 * - Hard questions completed vs required (2)
 * - Dynamic guidance message with specific actions needed
 */

import React from "react";
import { motion } from "framer-motion";
import { Trophy, Check, CheckCircle2, Lightbulb, Sparkles, Target, HelpCircle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

interface MasteryBreakdownProps {
  currentMastery: number; // 0-1 decimal
  hardQuestionsAttempted: number;
  questionsAnswered: number;
  questionsCorrect: number;
  currentDifficulty?: "easy" | "medium" | "hard";
  masteryGoal?: number; // default 0.7
  hardQuestionsRequired?: number; // default 2
  /** Compact mode for embedding in BlockStopMarker */
  compact?: boolean;
  className?: string;
}

export function MasteryBreakdown({
  currentMastery,
  hardQuestionsAttempted,
  questionsAnswered,
  questionsCorrect,
  currentDifficulty,
  masteryGoal = 0.7,
  hardQuestionsRequired = 2,
  compact = false,
  className,
}: MasteryBreakdownProps) {
  const currentPercent = Math.round(currentMastery * 100);
  const goalPercent = Math.round(masteryGoal * 100);
  const masteryMet = currentMastery >= masteryGoal;
  const hardQuestionsMet = hardQuestionsAttempted >= hardQuestionsRequired;
  const blockComplete = masteryMet && hardQuestionsMet;

  // Calculate progress toward goal (0-100 scale)
  const progressTowardGoal = Math.min(100, (currentMastery / masteryGoal) * 100);

  // Generate specific guidance message
  const getGuidanceMessage = (): string => {
    if (blockComplete) {
      return "Block complete! Click Continue to move to the next block.";
    }

    const needs: string[] = [];
    if (!masteryMet) {
      const needed = goalPercent - currentPercent;
      needs.push(`${needed}% more mastery`);
    }
    if (!hardQuestionsMet) {
      const remaining = hardQuestionsRequired - hardQuestionsAttempted;
      needs.push(
        `${remaining} more hard question${remaining > 1 ? "s" : ""} at 80%+ accuracy`
      );
    }

    return `Need: ${needs.join(" and ")}`;
  };

  // Calculate question accuracy
  const questionAccuracy = questionsAnswered > 0
    ? Math.round((questionsCorrect / questionsAnswered) * 100)
    : 0;

  return (
    <div className={cn(compact ? "space-y-3" : "space-y-4", className)}>
      {/* Header - only show in non-compact mode */}
      {!compact && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-sm text-gray-800">Block Completion</h3>
        </div>
      )}

      {/* Difficulty Level */}
      {currentDifficulty && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs text-gray-600 font-medium">Difficulty</span>
          </div>
          <span
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full",
              currentDifficulty === "easy" && "bg-green-100 text-green-700",
              currentDifficulty === "medium" && "bg-amber-100 text-amber-700",
              currentDifficulty === "hard" && "bg-red-100 text-red-700"
            )}
          >
            {currentDifficulty}
          </span>
        </div>
      )}

      {/* Questions Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs text-gray-600 font-medium">Questions</span>
        </div>
        <span className="text-xs font-semibold tabular-nums text-gray-700">
          {questionsCorrect}/{questionsAnswered}
          {questionsAnswered > 0 && (
            <span className="text-gray-400 font-normal ml-1">
              ({questionAccuracy}%)
            </span>
          )}
        </span>
      </div>

      {/* Mastery Requirement */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs text-gray-600 font-medium">Mastery Goal</span>
          </div>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              masteryMet ? "text-emerald-600" : "text-gray-700"
            )}
          >
            {currentPercent}% / {goalPercent}%
          </span>
        </div>

        {/* Progress bar with goal marker */}
        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
          {/* Goal marker at end */}
          <div
            className="absolute right-0 top-0 bottom-0 w-0.5 bg-violet-400 z-10"
            title={`${goalPercent}% goal`}
          />

          {/* Progress fill */}
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors duration-300",
              masteryMet
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                : "bg-gradient-to-r from-violet-400 to-purple-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressTowardGoal}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Success indicator */}
        {masteryMet && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-xs text-emerald-600"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-medium">Mastery goal reached!</span>
          </motion.div>
        )}
      </div>

      {/* Hard Questions Requirement */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-gray-600 font-medium">Hard Questions</span>
          </div>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              hardQuestionsMet ? "text-emerald-600" : "text-gray-700"
            )}
          >
            {hardQuestionsAttempted} / {hardQuestionsRequired}
          </span>
        </div>

        {/* Hard question visual boxes */}
        <div className="flex gap-2">
          {Array.from({ length: hardQuestionsRequired }).map((_, i) => {
            const isCompleted = i < hardQuestionsAttempted;
            return (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300",
                  isCompleted
                    ? "bg-emerald-100 border-2 border-emerald-400"
                    : "bg-gray-50 border-2 border-dashed border-gray-300"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <span className="text-xs font-semibold text-gray-400">
                    {i + 1}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Success indicator */}
        {hardQuestionsMet && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-xs text-emerald-600"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-medium">Hard questions complete!</span>
          </motion.div>
        )}
      </div>

      {/* Guidance Message */}
      <motion.div
        layout
        className={cn(
          "p-3 rounded-xl text-sm transition-colors duration-300",
          blockComplete
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
        )}
      >
        <div className="flex items-start gap-2">
          {blockComplete ? (
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{getGuidanceMessage()}</span>
        </div>
      </motion.div>
    </div>
  );
}

export default MasteryBreakdown;
