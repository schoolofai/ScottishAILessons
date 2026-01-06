"use client";

/**
 * FeedbackStep - Feedback presentation with animations
 *
 * Shows whether the answer was correct/incorrect with celebratory
 * or encouraging animations, plus explanation and mastery progress.
 *
 * IMPORTANT: This component uses PracticeFeedback directly from the
 * backend contract. No transformation needed.
 * See: @/types/practice-wizard-contracts.ts
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MathRenderer } from "../shared/MathRenderer";

// Import the exact type from backend contract
import type { PracticeFeedback } from "@/types/practice-wizard-contracts";

interface FeedbackStepProps {
  /** Feedback data directly from backend - no transformation needed */
  feedbackData: PracticeFeedback;
  /** Previous mastery score (tracked by parent for animation) */
  previousMastery?: number;
  /** Current streak count (tracked by parent) */
  currentStreak?: number;
  onContinue: () => void;
  isLoading?: boolean;
  // V2 Multi-Block Progression Props
  /** Frontend-detected block completion (V2 mode doesn't send backend flag) */
  blockJustCompleted?: boolean;
  /** Current block index (0-based) for progress display */
  currentBlockIndex?: number;
  /** Total number of blocks in the lesson */
  totalBlocks?: number;
}

export function FeedbackStep({
  feedbackData,
  previousMastery = 0,
  currentStreak = 0,
  onContinue,
  isLoading = false,
  // V2 Multi-Block Progression Props
  blockJustCompleted = false,
  currentBlockIndex = 0,
  totalBlocks = 1,
}: FeedbackStepProps) {
  const [showMasteryAnimation, setShowMasteryAnimation] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // V2 COMPATIBILITY: Compute new_mastery_score from mastery_delta if missing
  // V1 backend sends: new_mastery_score (absolute value 0-1)
  // V2 backend sends: mastery_delta (change in mastery, e.g., 0.05)
  // Frontend must handle both formats gracefully
  // ═══════════════════════════════════════════════════════════════════════════

  // Cast to extended type that includes V2's mastery_delta field
  const extendedFeedback = feedbackData as PracticeFeedback & { mastery_delta?: number };

  let rawMasteryScore: number;

  if (extendedFeedback.new_mastery_score !== undefined && extendedFeedback.new_mastery_score !== null) {
    // V1 format: Use new_mastery_score directly
    rawMasteryScore = extendedFeedback.new_mastery_score;
    console.log("[FeedbackStep] Using V1 new_mastery_score:", rawMasteryScore);
  } else if (extendedFeedback.mastery_delta !== undefined && extendedFeedback.mastery_delta !== null) {
    // V2 format: Compute new mastery from previousMastery + delta
    rawMasteryScore = previousMastery + extendedFeedback.mastery_delta;
    // console.log("[FeedbackStep] Using V2 mastery_delta:", {
    //   previousMastery,
    //   delta: extendedFeedback.mastery_delta,
    //   computed: rawMasteryScore
    // });
  } else {
    // Fallback: Keep previous mastery (no change)
    rawMasteryScore = previousMastery;
    console.warn("[FeedbackStep] ⚠️ No mastery data - keeping previous:", previousMastery);
  }

  // Convert decimal (0-1) to percentage (0-100) for display
  const masteryBefore = previousMastery * 100;
  const masteryAfter = rawMasteryScore * 100;
  const masteryGain = masteryAfter - masteryBefore;

  // Initialize with percentage value (not raw 0-1)
  const [animatedMastery, setAnimatedMastery] = useState(masteryBefore);

  // Use backend field names directly
  const isCorrect = feedbackData.is_correct;
  // V2 COMPATIBILITY: Use frontend's blockJustCompleted OR backend's block_complete flag
  // V1 backend sends block_complete; V2 mode uses frontend detection via blockJustCompleted
  const isBlockComplete = blockJustCompleted || (feedbackData.block_complete ?? false);

  // Multi-block progression: Check if more blocks remain after current one
  const hasMoreBlocks = totalBlocks > 1 && currentBlockIndex < totalBlocks - 1;
  const blockNumber = currentBlockIndex + 1; // Display as 1-indexed

  // Animate mastery progress
  useEffect(() => {
    if (masteryBefore !== masteryAfter) {
      const timer = setTimeout(() => {
        setShowMasteryAnimation(true);
        // Animate the mastery bar
        const duration = 1000;
        const steps = 30;
        const increment = (masteryAfter - masteryBefore) / steps;
        let current = masteryBefore;
        let step = 0;

        const interval = setInterval(() => {
          step++;
          current = masteryBefore + increment * step;
          setAnimatedMastery(Math.min(current, masteryAfter));

          if (step >= steps) {
            clearInterval(interval);
            setAnimatedMastery(masteryAfter);
          }
        }, duration / steps);

        return () => clearInterval(interval);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [masteryBefore, masteryAfter]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Result Banner */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className={`
          relative overflow-hidden rounded-3xl p-8 text-center
          ${
            isCorrect
              ? "bg-gradient-to-br from-emerald-400 to-green-500"
              : "bg-gradient-to-br from-amber-400 to-orange-500"
          }
        `}
      >
        {/* Decorative sparkles for correct answers */}
        {isCorrect && (
          <>
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="absolute top-4 left-8"
            >
              <Sparkles className="w-6 h-6 text-yellow-200" />
            </motion.div>
            <motion.div
              initial={{ scale: 0, rotate: 45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="absolute top-6 right-12"
            >
              <Sparkles className="w-4 h-4 text-yellow-200" />
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="absolute bottom-4 right-8"
            >
              <Sparkles className="w-5 h-5 text-yellow-200" />
            </motion.div>
          </>
        )}

        {/* Result Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 300,
            damping: 15,
          }}
          className="flex justify-center mb-4"
        >
          {isCorrect ? (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-white" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-white" />
            </div>
          )}
        </motion.div>

        {/* Result Text */}
        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-white mb-2"
        >
          {isCorrect ? "Excellent!" : "Keep Going!"}
        </motion.h2>

        {/* Streak Counter - tracked by parent hook */}
        {isCorrect && currentStreak > 1 && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/80 text-sm mt-2"
          >
            {currentStreak} in a row! Keep it up!
          </motion.div>
        )}
      </motion.div>

      {/* Feedback Explanation Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="wizard-card p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          {isCorrect ? "Great work!" : "Here's what to know:"}
        </h3>
        <MathRenderer
          content={feedbackData.feedback}
          className="text-gray-700 leading-relaxed"
        />

        {/* Show correct answer if wrong */}
        {!isCorrect && feedbackData.correct_answer && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-sm font-medium text-emerald-700 mb-1">
              Correct Answer:
            </div>
            <MathRenderer
              content={feedbackData.correct_answer}
              className="text-emerald-800 font-medium"
            />
          </div>
        )}

        {/* Additional explanation */}
        {feedbackData.explanation && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-600 mb-2">
              Explanation:
            </h4>
            <MathRenderer
              content={feedbackData.explanation}
              className="text-gray-600 text-sm"
            />
          </div>
        )}
      </motion.div>

      {/* Mastery Progress */}
      {(masteryBefore !== undefined || masteryAfter !== undefined) && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="wizard-card p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-500" />
              <span className="font-semibold text-gray-800">
                Mastery Progress
              </span>
            </div>
            <AnimatePresence mode="wait">
              {showMasteryAnimation && masteryGain > 0 && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="text-emerald-600 font-bold text-sm"
                >
                  +{masteryGain.toFixed(0)}%
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Progress Bar */}
          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
              initial={{ width: `${masteryBefore}%` }}
              animate={{ width: `${animatedMastery}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            {/* Milestone markers */}
            {[25, 50, 75].map((milestone) => (
              <div
                key={milestone}
                className="absolute top-0 bottom-0 w-px bg-white/50"
                style={{ left: `${milestone}%` }}
              />
            ))}
          </div>

          {/* Progress Labels */}
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-gray-500">0%</span>
            <span className="font-bold text-purple-600">
              {Math.round(animatedMastery)}%
            </span>
            <span className="text-gray-500">100%</span>
          </div>

          {/* Mastery milestone celebration - only show when block is ACTUALLY complete
              (backend requires high mastery + 2 hard questions answered) */}
          {isBlockComplete && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.2, type: "spring" }}
              className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${
                hasMoreBlocks
                  ? "bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200"
                  : "bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                hasMoreBlocks
                  ? "bg-gradient-to-br from-emerald-400 to-cyan-500"
                  : "bg-gradient-to-br from-yellow-400 to-amber-500"
              }`}>
                <Award className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className={`font-bold ${hasMoreBlocks ? "text-emerald-800" : "text-amber-800"}`}>
                  {hasMoreBlocks
                    ? `Block ${blockNumber} of ${totalBlocks} Complete!`
                    : "Block Mastered!"}
                </div>
                <div className={`text-sm ${hasMoreBlocks ? "text-emerald-600" : "text-amber-600"}`}>
                  {hasMoreBlocks
                    ? `Great work! Ready to continue to block ${blockNumber + 1}?`
                    : "You've achieved full mastery of this concept!"}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Action Buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* Continue Button */}
        <Button
          onClick={onContinue}
          disabled={isLoading}
          className={`
            flex-1 py-5 text-lg font-bold rounded-2xl transition-all duration-300
            ${
              isCorrect
                ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                : "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            }
            text-white shadow-lg hover:shadow-xl
          `}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>
                {isBlockComplete && hasMoreBlocks
                  ? "Continue to Next Block"
                  : isBlockComplete
                    ? "Complete Lesson"
                    : "Continue"}
              </span>
              <ArrowRight className="w-5 h-5" />
            </div>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export default FeedbackStep;
