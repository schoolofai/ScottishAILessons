/**
 * Question Pool Management for Practice Wizard V2
 *
 * This module provides pure functions for managing question pools
 * and preventing question repetition.
 *
 * Key behaviors:
 * - Track shown question IDs to prevent repeats
 * - Handle pool exhaustion gracefully
 * - Support difficulty-based filtering
 * - Persist shown IDs across difficulty changes
 *
 * Bug being addressed: "Questions intermittently loop and repeat"
 */

import type { DifficultyLevel } from "@/types/practice-wizard-contracts";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of selecting a question from the pool
 */
export interface QuestionSelectionResult {
  /** The selected question ID */
  question_id: string | null;
  /** Number of questions remaining in pool */
  pool_remaining: number;
  /** Whether the pool was reset due to exhaustion */
  pool_reset: boolean;
  /** The new shown IDs list after selection */
  updated_shown_ids: string[];
}

/**
 * Pool status for a difficulty level
 */
export interface PoolStatus {
  /** Total questions at this difficulty */
  total: number;
  /** Questions not yet shown */
  available: number;
  /** Questions already shown */
  shown: number;
}

/**
 * Overall pool statistics
 */
export interface PoolStatistics {
  easy: PoolStatus;
  medium: PoolStatus;
  hard: PoolStatus;
  /** Total shown across all difficulties */
  total_shown: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Pool Management Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a question has already been shown.
 *
 * @param questionId - Question ID to check
 * @param shownIds - Array of already shown question IDs
 * @returns Whether question has been shown
 */
export function isQuestionShown(
  questionId: string,
  shownIds: string[]
): boolean {
  return shownIds.includes(questionId);
}

/**
 * Add a question ID to the shown list.
 *
 * @param questionId - Question ID to add
 * @param shownIds - Current shown IDs
 * @returns Updated shown IDs array
 */
export function addToShownIds(
  questionId: string,
  shownIds: string[]
): string[] {
  if (shownIds.includes(questionId)) {
    return shownIds; // Already in list
  }
  return [...shownIds, questionId];
}

/**
 * Get available questions (not yet shown) from a pool.
 *
 * @param allQuestionIds - All question IDs in the pool
 * @param shownIds - IDs already shown
 * @returns Array of available question IDs
 */
export function getAvailableQuestions(
  allQuestionIds: string[],
  shownIds: string[]
): string[] {
  return allQuestionIds.filter((id) => !shownIds.includes(id));
}

/**
 * Select a random question from available pool.
 *
 * If pool is exhausted, resets shown IDs and returns from full pool.
 *
 * @param allQuestionIds - All question IDs in the pool
 * @param shownIds - IDs already shown
 * @returns Selection result with question and updated state
 */
export function selectRandomQuestion(
  allQuestionIds: string[],
  shownIds: string[]
): QuestionSelectionResult {
  // Handle empty pool
  if (allQuestionIds.length === 0) {
    return {
      question_id: null,
      pool_remaining: 0,
      pool_reset: false,
      updated_shown_ids: shownIds,
    };
  }

  // Get available questions
  let available = getAvailableQuestions(allQuestionIds, shownIds);
  let poolReset = false;

  // Handle pool exhaustion - reset shown IDs
  if (available.length === 0) {
    poolReset = true;
    available = allQuestionIds;
  }

  // Select random question
  const randomIndex = Math.floor(Math.random() * available.length);
  const selectedId = available[randomIndex];

  // Update shown IDs
  const newShownIds = poolReset
    ? [selectedId] // Reset to only the new question
    : addToShownIds(selectedId, shownIds);

  return {
    question_id: selectedId,
    pool_remaining: available.length - 1,
    pool_reset: poolReset,
    updated_shown_ids: newShownIds,
  };
}

/**
 * Reset shown IDs (e.g., when starting new block or session).
 *
 * @returns Empty array
 */
export function resetShownIds(): string[] {
  return [];
}

/**
 * Check if pool is exhausted.
 *
 * @param allQuestionIds - All question IDs in the pool
 * @param shownIds - IDs already shown
 * @returns Whether all questions have been shown
 */
export function isPoolExhausted(
  allQuestionIds: string[],
  shownIds: string[]
): boolean {
  return getAvailableQuestions(allQuestionIds, shownIds).length === 0;
}

/**
 * Get pool status for a difficulty level.
 *
 * @param allQuestionIds - All question IDs at this difficulty
 * @param shownIds - IDs already shown (across all difficulties)
 * @returns Pool status
 */
export function getPoolStatus(
  allQuestionIds: string[],
  shownIds: string[]
): PoolStatus {
  const shown = allQuestionIds.filter((id) => shownIds.includes(id)).length;
  return {
    total: allQuestionIds.length,
    available: allQuestionIds.length - shown,
    shown,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Difficulty-Based Pool Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if should auto-downgrade due to small/empty pool.
 *
 * @param poolSize - Number of questions at current difficulty
 * @param minPoolSize - Minimum pool size to continue at this difficulty
 * @returns Whether to downgrade
 */
export function shouldAutoDowngrade(
  poolSize: number,
  minPoolSize: number = 2
): boolean {
  return poolSize < minPoolSize;
}

/**
 * Get effective difficulty based on pool availability.
 *
 * If the requested difficulty has too few questions,
 * downgrades to a lower difficulty.
 *
 * @param requestedDifficulty - Desired difficulty
 * @param poolSizes - Map of pool sizes by difficulty
 * @param minPoolSize - Minimum questions needed
 * @returns Effective difficulty to use
 */
export function getEffectiveDifficulty(
  requestedDifficulty: DifficultyLevel,
  poolSizes: Record<DifficultyLevel, number>,
  minPoolSize: number = 2
): DifficultyLevel {
  const difficulties: DifficultyLevel[] = ["hard", "medium", "easy"];
  const startIndex = difficulties.indexOf(requestedDifficulty);

  // Try from requested difficulty down to easy
  for (let i = startIndex; i < difficulties.length; i++) {
    const diff = difficulties[i];
    if (poolSizes[diff] >= minPoolSize) {
      return diff;
    }
  }

  // Fall back to easy even if small pool
  return "easy";
}

// ═══════════════════════════════════════════════════════════════════════════
// Cross-Block/Session Behavior
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determine if shown IDs should persist across an event.
 *
 * Shown IDs should:
 * - PERSIST across difficulty changes (within same block)
 * - PERSIST across block changes (within same session)
 * - RESET on new session start
 *
 * @param event - Type of event
 * @returns Whether to reset shown IDs
 */
export function shouldResetShownIds(
  event: "difficulty_change" | "block_change" | "session_start"
): boolean {
  switch (event) {
    case "difficulty_change":
      return false; // Keep shown IDs across difficulty changes
    case "block_change":
      return false; // Keep shown IDs across block changes
    case "session_start":
      return true; // Reset on new session
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that a question ID is unique (not already shown).
 *
 * @param questionId - Question ID to validate
 * @param shownIds - Already shown IDs
 * @throws Error if question was already shown
 */
export function validateUniqueQuestion(
  questionId: string,
  shownIds: string[]
): void {
  if (shownIds.includes(questionId)) {
    throw new Error(
      `Question ${questionId} was already shown. This indicates a bug in question selection.`
    );
  }
}

/**
 * Detect if questions are repeating unexpectedly.
 *
 * @param recentQuestions - Last N question IDs shown
 * @param windowSize - Size of window to check for duplicates
 * @returns Whether repeats were detected
 */
export function detectRepeats(
  recentQuestions: string[],
  windowSize: number = 5
): boolean {
  const window = recentQuestions.slice(-windowSize);
  const unique = new Set(window);
  return unique.size < window.length;
}
