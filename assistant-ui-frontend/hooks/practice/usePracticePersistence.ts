"use client";

/**
 * usePracticePersistence - Hook for persisting practice session and mastery data
 *
 * Handles Gap P0 (Mastery Persistence) and Gap P2 (Session Persistence).
 * Separates persistence concerns from the main wizard hook.
 *
 * Architecture:
 * - MasteryV2Driver: Updates outcome-level EMA scores
 * - PracticeSessionDriver: Updates session progress
 */

import { useCallback, useRef } from "react";
import { MasteryV2Driver } from "@/lib/appwrite/driver/MasteryV2Driver";
import {
  PracticeSessionDriver,
  type PracticeSessionProgressUpdate,
} from "@/lib/appwrite/driver/PracticeSessionDriver";

import type {
  PracticeFeedback,
  ProgressReport,
} from "@/types/practice-wizard-contracts";

/**
 * Mastery update request from V2 question context
 */
export interface MasteryUpdateRequest {
  /** Student document ID */
  studentId: string;
  /** Course ID for mastery record */
  courseId: string;
  /** Outcome IDs to update (from question.outcomeRefs) */
  outcomeIds: string[];
  /** Whether answer was correct */
  isCorrect: boolean;
  /** Partial credit (0-1) */
  partialCredit: number;
  /** Block mastery score from feedback (0-100) */
  blockMastery: number;
}

/**
 * Session update request
 */
export interface SessionUpdateRequest {
  /** Session ID to update */
  sessionId: string;
  /** Progress data from feedback */
  progress: ProgressReport;
  /** Whether current question was answered correctly */
  isCorrect: boolean;
  /** New mastery score from feedback */
  newMastery: number;
}

/**
 * EMA calculation constants
 * Using exponential moving average for smooth mastery progression
 */
const EMA_ALPHA_CORRECT = 0.3; // Weight for correct answers
const EMA_ALPHA_INCORRECT = 0.2; // Lower weight for incorrect (slower decay)
const PARTIAL_CREDIT_MULTIPLIER = 0.7; // Partial credit contribution factor

/**
 * Calculate new EMA score based on answer result
 */
function calculateNewEMA(
  currentEMA: number,
  isCorrect: boolean,
  partialCredit: number = 0
): number {
  // EMA formula: new = α * observation + (1 - α) * old
  // observation: 1.0 for correct, 0.0 for incorrect, partialCredit in between

  let observation: number;
  let alpha: number;

  if (isCorrect) {
    observation = 1.0;
    alpha = EMA_ALPHA_CORRECT;
  } else if (partialCredit > 0) {
    observation = partialCredit * PARTIAL_CREDIT_MULTIPLIER;
    alpha = (EMA_ALPHA_CORRECT + EMA_ALPHA_INCORRECT) / 2;
  } else {
    observation = 0.0;
    alpha = EMA_ALPHA_INCORRECT;
  }

  const newEMA = alpha * observation + (1 - alpha) * currentEMA;

  // Clamp to [0, 1] range
  return Math.max(0, Math.min(1, newEMA));
}

/**
 * Hook for practice persistence operations
 */
export function usePracticePersistence(sessionToken?: string) {
  const masteryDriverRef = useRef<MasteryV2Driver | null>(null);
  const sessionDriverRef = useRef<PracticeSessionDriver | null>(null);

  // Lazy initialization of drivers
  const getMasteryDriver = useCallback(() => {
    if (!masteryDriverRef.current) {
      masteryDriverRef.current = new MasteryV2Driver(sessionToken);
    }
    return masteryDriverRef.current;
  }, [sessionToken]);

  const getSessionDriver = useCallback(() => {
    if (!sessionDriverRef.current) {
      sessionDriverRef.current = new PracticeSessionDriver(sessionToken);
    }
    return sessionDriverRef.current;
  }, [sessionToken]);

  /**
   * Persist mastery update after feedback is received.
   *
   * Flow:
   * 1. Get current EMA for each outcome from MasteryV2
   * 2. Calculate new EMA based on answer result
   * 3. Batch update all affected outcomes
   *
   * @param request - Mastery update request with outcome IDs
   */
  const persistMasteryUpdate = useCallback(
    async (request: MasteryUpdateRequest): Promise<void> => {
      const { studentId, courseId, outcomeIds, isCorrect, partialCredit } = request;

      // Skip if no outcome IDs to update
      if (!outcomeIds || outcomeIds.length === 0) {
        console.log("[usePracticePersistence] No outcome IDs to update, skipping mastery persistence");
        return;
      }

      console.log("[usePracticePersistence] Persisting mastery update:", {
        studentId,
        courseId,
        outcomeIds,
        isCorrect,
        partialCredit,
      });

      try {
        const driver = getMasteryDriver();

        // 1. Get current EMAs for all outcomes
        const currentEMAs = await driver.getCourseEMAs(studentId, courseId);
        const existingEMAs = currentEMAs || {};

        console.log("[usePracticePersistence] Current EMAs:", existingEMAs);

        // 2. Calculate new EMAs for each outcome
        const updatedEMAs: { [outcomeId: string]: number } = {};

        for (const outcomeId of outcomeIds) {
          const currentEMA = existingEMAs[outcomeId] || 0.3; // Default starting EMA
          const newEMA = calculateNewEMA(currentEMA, isCorrect, partialCredit);

          updatedEMAs[outcomeId] = newEMA;

          console.log(`[usePracticePersistence] Outcome ${outcomeId}: ${currentEMA.toFixed(3)} -> ${newEMA.toFixed(3)}`);
        }

        // 3. Batch update all outcomes
        await driver.batchUpdateEMAs(studentId, courseId, updatedEMAs);

        console.log("[usePracticePersistence] ✅ Mastery update persisted successfully");
      } catch (error) {
        console.error("[usePracticePersistence] ❌ Failed to persist mastery:", error);
        // Don't throw - mastery persistence is non-critical for UX
        // Log the error but allow the session to continue
      }
    },
    [getMasteryDriver]
  );

  /**
   * Persist session progress after feedback.
   *
   * Updates:
   * - current_block_index
   * - total_questions_attempted
   * - total_questions_correct
   * - overall_mastery
   * - last_activity_at
   *
   * @param request - Session update request
   */
  const persistSessionProgress = useCallback(
    async (request: SessionUpdateRequest): Promise<void> => {
      const { sessionId, progress, isCorrect, newMastery } = request;

      if (!sessionId) {
        console.log("[usePracticePersistence] No session ID, skipping session persistence");
        return;
      }

      console.log("[usePracticePersistence] Persisting session progress:", {
        sessionId,
        progressBlocks: progress.completed_blocks,
        isCorrect,
        newMastery,
      });

      try {
        const driver = getSessionDriver();

        // Build progress update
        const progressUpdate: PracticeSessionProgressUpdate = {
          current_block_index: progress.current_block_index,
          overall_mastery: newMastery,
          last_activity_at: new Date().toISOString(),
        };

        // Check if session should be completed
        if (progress.completed_blocks >= progress.total_blocks) {
          progressUpdate.status = "completed";
        }

        await driver.updateSessionProgress(sessionId, progressUpdate);

        console.log("[usePracticePersistence] ✅ Session progress persisted successfully");
      } catch (error) {
        console.error("[usePracticePersistence] ❌ Failed to persist session:", error);
        // Don't throw - session persistence is non-critical for UX
      }
    },
    [getSessionDriver]
  );

  /**
   * Combined persistence after feedback is received.
   * Convenience method that handles both mastery and session updates.
   *
   * @param feedback - The practice feedback from backend
   * @param context - Additional context for persistence
   */
  const persistFeedbackResult = useCallback(
    async (
      feedback: PracticeFeedback,
      context: {
        studentId: string;
        courseId: string;
        sessionId?: string;
        outcomeIds?: string[];
      }
    ): Promise<void> => {
      const { studentId, courseId, sessionId, outcomeIds } = context;

      console.log("[usePracticePersistence] Persisting feedback result:", {
        isCorrect: feedback.is_correct,
        partialCredit: feedback.partial_credit,
        newMastery: feedback.new_mastery_score,
        hasOutcomeIds: !!outcomeIds?.length,
        hasSessionId: !!sessionId,
      });

      // Run both updates in parallel for better performance
      await Promise.all([
        // P0: Mastery persistence
        outcomeIds?.length
          ? persistMasteryUpdate({
              studentId,
              courseId,
              outcomeIds,
              isCorrect: feedback.is_correct,
              partialCredit: feedback.partial_credit,
              blockMastery: feedback.new_mastery_score,
            })
          : Promise.resolve(),

        // P2: Session persistence
        sessionId
          ? persistSessionProgress({
              sessionId,
              progress: feedback.progress,
              isCorrect: feedback.is_correct,
              newMastery: feedback.new_mastery_score,
            })
          : Promise.resolve(),
      ]);

      console.log("[usePracticePersistence] ✅ All persistence complete");
    },
    [persistMasteryUpdate, persistSessionProgress]
  );

  return {
    persistMasteryUpdate,
    persistSessionProgress,
    persistFeedbackResult,
  };
}

export default usePracticePersistence;
