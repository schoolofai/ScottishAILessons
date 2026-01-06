"use client";

/**
 * usePracticePersistence - Hook for persisting practice session and mastery data
 *
 * Handles Gap P0 (Mastery Persistence) and Gap P2 (Session Persistence).
 * Separates persistence concerns from the main wizard hook.
 *
 * Architecture:
 * - MasteryV2Driver: Updates outcome-level EMA scores (client-side - to be migrated)
 * - Server-side API: POST/PATCH /api/practice-sessions (per CLAUDE.md server-side auth requirement)
 */

import { useCallback, useRef } from "react";
import { MasteryV2Driver } from "@/lib/appwrite/driver/MasteryV2Driver";
import { type PracticeSessionProgressUpdate } from "@/lib/appwrite/driver/PracticeSessionDriver";
import { createLogger } from "@/lib/logger";

// Create namespaced logger for practice persistence
const log = createLogger("PracticePersistence");

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
  /** Current difficulty level to persist for resume */
  currentDifficulty?: 'easy' | 'medium' | 'hard';
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
 *
 * Session updates use server-side API routes (/api/practice-sessions)
 * per CLAUDE.md requirement for server-side Appwrite auth.
 */
export function usePracticePersistence(sessionToken?: string) {
  const masteryDriverRef = useRef<MasteryV2Driver | null>(null);

  // Lazy initialization of mastery driver (TODO: migrate to server-side API)
  const getMasteryDriver = useCallback(() => {
    if (!masteryDriverRef.current) {
      masteryDriverRef.current = new MasteryV2Driver(sessionToken);
    }
    return masteryDriverRef.current;
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
        log.debug("Mastery update skipped - no outcome IDs", { studentId, courseId });
        return;
      }

      log.info("Persisting mastery update", {
        studentId,
        courseId,
        outcomeCount: outcomeIds.length,
        isCorrect,
        partialCredit,
      });

      try {
        const driver = getMasteryDriver();

        // 1. Get current EMAs for all outcomes
        const currentEMAs = await driver.getCourseEMAs(studentId, courseId);
        const existingEMAs = currentEMAs || {};

        // 2. Calculate new EMAs for each outcome
        const updatedEMAs: { [outcomeId: string]: number } = {};

        for (const outcomeId of outcomeIds) {
          const currentEMA = existingEMAs[outcomeId] || 0.3; // Default starting EMA
          const newEMA = calculateNewEMA(currentEMA, isCorrect, partialCredit);
          updatedEMAs[outcomeId] = newEMA;
          log.debug("EMA calculated", { outcomeId, currentEMA, newEMA, isCorrect });
        }

        // 3. Batch update all outcomes
        await driver.batchUpdateEMAs(studentId, courseId, updatedEMAs);
        log.info("Mastery update persisted", { outcomeCount: outcomeIds.length });
      } catch (error) {
        log.error("Failed to persist mastery", { error, studentId, courseId });
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
   * - blocks_progress (per-block mastery for resume support)
   * - overall_mastery
   * - last_activity_at
   *
   * @param request - Session update request
   */
  const persistSessionProgress = useCallback(
    async (request: SessionUpdateRequest): Promise<void> => {
      const { sessionId, progress, isCorrect, newMastery, currentDifficulty } = request;

      if (!sessionId) {
        // CRITICAL: This is a bug indicator - session should have been created during startSessionV2
        log.warn("Session progress NOT persisted - sessionId is undefined", {
          currentBlockIndex: progress.current_block_index,
          completedBlocks: progress.completed_blocks,
          totalBlocks: progress.total_blocks,
          isCorrect,
          newMastery,
        });
        return;
      }

      log.info("Persisting session progress", {
        sessionId,
        currentBlockIndex: progress.current_block_index,
        isCorrect,
        newMastery,
        currentDifficulty,
      });

      try {
        // Build progress update - CRITICAL: Include blocks_progress for resume support!
        // BUG FIX: Use progress.overall_mastery (session-level 0-1) instead of newMastery
        // newMastery is feedback.new_mastery_score which is BLOCK-level mastery (0-100)
        // The progress object already has the correct overall_mastery for the session
        const progressUpdate: PracticeSessionProgressUpdate = {
          current_block_index: progress.current_block_index,
          overall_mastery: progress.overall_mastery,
          last_activity_at: new Date().toISOString(),
        };

        // CRITICAL FIX: Save blocks_progress for session resume
        // This enables restoring per-block mastery when student returns to practice
        if (progress.blocks && progress.blocks.length > 0) {
          // Map contract's BlockProgress to driver's expected format
          // Add current_difficulty from the request so resume knows where student left off
          progressUpdate.blocks_progress = progress.blocks.map((block) => ({
            block_id: block.block_id,
            mastery_score: block.mastery_score,
            is_complete: block.is_complete,
            // Include current_difficulty for the current block being practiced
            current_difficulty: currentDifficulty || 'easy',
            // These fields are required by driver type but we only update what we track
            questions_attempted: { easy: 0, medium: 0, hard: 0 },
            questions_correct: { easy: 0, medium: 0, hard: 0 },
            started_at: null,
            completed_at: block.is_complete ? new Date().toISOString() : null,
          }));
        }

        // Check if session should be completed
        if (progress.completed_blocks >= progress.total_blocks) {
          progressUpdate.status = "completed";
        }

        // Use server-side API route instead of direct Appwrite SDK
        // This follows CLAUDE.md requirement: "all access to appwrite should use server side auth"
        const response = await fetch(`/api/practice-sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(progressUpdate),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        log.info("Session progress persisted via API", { sessionId });
      } catch (error) {
        log.error("Failed to persist session progress via API", { error, sessionId });
        // Don't throw - session persistence is non-critical for UX
      }
    },
    []
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
        /** Current difficulty to persist for resume support */
        currentDifficulty?: 'easy' | 'medium' | 'hard';
        /** Optional progress override for V2 mode where backend doesn't send progress */
        progress?: ProgressReport;
      }
    ): Promise<void> => {
      const { studentId, courseId, sessionId, outcomeIds, currentDifficulty, progress } = context;

      // Use provided progress OR feedback.progress (V2 backend doesn't include progress in feedback)
      const progressToSave = progress || feedback.progress;

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

        // P2: Session persistence (includes blocks_progress for resume)
        // CRITICAL: Skip if no progress available (V2 mode may not have progress in feedback)
        sessionId && progressToSave
          ? persistSessionProgress({
              sessionId,
              progress: progressToSave,
              isCorrect: feedback.is_correct,
              newMastery: feedback.new_mastery_score,
              currentDifficulty,
            })
          : (() => {
              if (sessionId && !progressToSave) {
                log.warn("Session progress skipped - no progress data available", {
                  sessionId,
                  hasProgress: !!progressToSave,
                  feedbackHasProgress: !!feedback.progress,
                });
              }
              return Promise.resolve();
            })(),
      ]);
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
