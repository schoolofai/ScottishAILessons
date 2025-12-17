/**
 * Block Completion Logic for Practice Wizard V2
 *
 * This module provides pure functions for determining when a block
 * is complete and a student can progress to the next block.
 *
 * Block Completion Criteria:
 * 1. Mastery score >= 70% (MASTERY_THRESHOLD)
 * 2. At least 2 hard questions ATTEMPTED (not necessarily correct)
 * 3. OR: Student manually requested advance (override)
 *
 * IMPORTANT: The criteria is hard questions ATTEMPTED, not CORRECT.
 * This prevents students from being stuck indefinitely on hard questions.
 */

import type { DifficultyLevel } from "@/types/practice-wizard-contracts";
import {
  type BlockProgress,
  MASTERY_THRESHOLD,
  HARD_QUESTIONS_REQUIRED,
} from "./blockMastery";

// Re-export constants for convenience
export { MASTERY_THRESHOLD, HARD_QUESTIONS_REQUIRED };

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of block completion check
 */
export interface BlockCompletionResult {
  /** Whether the block is complete */
  is_complete: boolean;
  /** Reason why block is/isn't complete */
  reason: CompletionReason;
  /** Current mastery score */
  mastery_score: number;
  /** Number of hard questions attempted */
  hard_questions_attempted: number;
  /** Whether student requested manual advance */
  manual_advance: boolean;
  /** What's still needed to complete (if not complete) */
  requirements_remaining?: CompletionRequirements;
}

/**
 * Reason for completion status
 */
export type CompletionReason =
  | "criteria_met" // Met mastery + hard questions
  | "manual_advance" // Student requested skip
  | "mastery_insufficient" // Need more mastery
  | "hard_questions_insufficient" // Need more hard questions
  | "both_insufficient"; // Need both mastery and hard questions

/**
 * What's still needed to complete the block
 */
export interface CompletionRequirements {
  /** Additional mastery needed (as decimal 0-1) */
  mastery_needed?: number;
  /** Additional hard questions needed */
  hard_questions_needed?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Completion Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a block meets completion criteria.
 *
 * A block is complete when:
 * 1. Mastery >= 70% AND hard_questions_attempted >= 2
 * 2. OR student_requested_advance is true
 *
 * @param progress - Block progress data
 * @returns Whether block is complete
 */
export function isBlockComplete(progress: BlockProgress): boolean {
  // Manual advance overrides all criteria
  if (progress.student_requested_advance) {
    return true;
  }

  // Standard criteria: mastery + hard questions
  const masteryMet = progress.mastery_score >= MASTERY_THRESHOLD;
  const hardMet =
    progress.questions_attempted.hard >= HARD_QUESTIONS_REQUIRED;

  return masteryMet && hardMet;
}

/**
 * Get detailed block completion status with requirements.
 *
 * @param progress - Block progress data
 * @returns Detailed completion result
 */
export function checkBlockCompletion(
  progress: BlockProgress
): BlockCompletionResult {
  const hardAttempted = progress.questions_attempted.hard;
  const mastery = progress.mastery_score;
  const manualAdvance = progress.student_requested_advance ?? false;

  // Manual advance overrides criteria
  if (manualAdvance) {
    return {
      is_complete: true,
      reason: "manual_advance",
      mastery_score: mastery,
      hard_questions_attempted: hardAttempted,
      manual_advance: true,
    };
  }

  const masteryMet = mastery >= MASTERY_THRESHOLD;
  const hardMet = hardAttempted >= HARD_QUESTIONS_REQUIRED;

  // Both criteria met
  if (masteryMet && hardMet) {
    return {
      is_complete: true,
      reason: "criteria_met",
      mastery_score: mastery,
      hard_questions_attempted: hardAttempted,
      manual_advance: false,
    };
  }

  // Determine what's missing
  let reason: CompletionReason;
  const requirements: CompletionRequirements = {};

  if (!masteryMet && !hardMet) {
    reason = "both_insufficient";
    requirements.mastery_needed = MASTERY_THRESHOLD - mastery;
    requirements.hard_questions_needed = HARD_QUESTIONS_REQUIRED - hardAttempted;
  } else if (!masteryMet) {
    reason = "mastery_insufficient";
    requirements.mastery_needed = MASTERY_THRESHOLD - mastery;
  } else {
    reason = "hard_questions_insufficient";
    requirements.hard_questions_needed = HARD_QUESTIONS_REQUIRED - hardAttempted;
  }

  return {
    is_complete: false,
    reason,
    mastery_score: mastery,
    hard_questions_attempted: hardAttempted,
    manual_advance: false,
    requirements_remaining: requirements,
  };
}

/**
 * Check if student should be allowed to advance (for UI).
 *
 * Returns true if:
 * - Block is complete (via criteria or manual advance)
 * - OR block would be complete with manual advance enabled
 *
 * @param progress - Block progress data
 * @param allowManualAdvance - Whether to allow manual advance button
 * @returns Whether advance should be allowed
 */
export function shouldAllowAdvance(
  progress: BlockProgress,
  allowManualAdvance: boolean = true
): boolean {
  // Always allow if block is complete
  if (isBlockComplete(progress)) {
    return true;
  }

  // Allow manual advance if enabled (for "skip" button)
  return allowManualAdvance;
}

/**
 * Mark a block as complete due to manual advance.
 *
 * @param progress - Current block progress
 * @returns Updated progress with manual advance flag
 */
export function markManualAdvance(progress: BlockProgress): BlockProgress {
  return {
    ...progress,
    student_requested_advance: true,
    is_complete: true,
    completed_at: new Date().toISOString(),
  };
}

/**
 * Mark a block as complete (after meeting criteria).
 *
 * @param progress - Current block progress
 * @returns Updated progress with completion status
 */
export function markBlockComplete(progress: BlockProgress): BlockProgress {
  return {
    ...progress,
    is_complete: true,
    completed_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Progress Display Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get progress percentage toward block completion.
 *
 * This is a composite score showing how close to completion:
 * - Mastery contributes 70% (since threshold is 70%)
 * - Hard questions contribute 30%
 *
 * @param progress - Block progress data
 * @returns Progress percentage (0-100)
 */
export function getCompletionProgress(progress: BlockProgress): number {
  // Mastery progress (up to 70% of completion)
  const masteryProgress = Math.min(
    progress.mastery_score / MASTERY_THRESHOLD,
    1.0
  );

  // Hard questions progress (up to 30% of completion)
  const hardProgress = Math.min(
    progress.questions_attempted.hard / HARD_QUESTIONS_REQUIRED,
    1.0
  );

  // Weighted composite (mastery is more important)
  const compositeProgress = masteryProgress * 0.7 + hardProgress * 0.3;

  return Math.round(compositeProgress * 100);
}

/**
 * Get a human-readable status message for the block.
 *
 * @param progress - Block progress data
 * @returns Status message for UI
 */
export function getBlockStatusMessage(progress: BlockProgress): string {
  const result = checkBlockCompletion(progress);

  if (result.is_complete) {
    if (result.reason === "manual_advance") {
      return "Block skipped - moving to next";
    }
    return "Block complete! Great work!";
  }

  const messages: string[] = [];

  if (result.requirements_remaining?.mastery_needed) {
    const needed = Math.round(result.requirements_remaining.mastery_needed * 100);
    messages.push(`Need ${needed}% more mastery`);
  }

  if (result.requirements_remaining?.hard_questions_needed) {
    const needed = result.requirements_remaining.hard_questions_needed;
    messages.push(
      `Need ${needed} more hard question${needed > 1 ? "s" : ""}`
    );
  }

  return messages.join(" and ");
}
