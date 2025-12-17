/**
 * Block Mastery Calculation for Practice Wizard V2
 *
 * This module provides pure functions for calculating block-level mastery
 * using a weighted average formula based on difficulty levels.
 *
 * Mastery Calculation Formula:
 * - Easy questions: 20% weight
 * - Medium questions: 40% weight
 * - Hard questions: 40% weight
 *
 * Overall mastery = weighted sum of accuracy per difficulty level
 */

import type { DifficultyLevel } from "@/types/practice-wizard-contracts";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Weight of each difficulty level in overall mastery calculation.
 * Easy = 20%, Medium = 40%, Hard = 40%
 */
export const DIFFICULTY_WEIGHTS: Record<DifficultyLevel, number> = {
  easy: 0.2,
  medium: 0.4,
  hard: 0.4,
} as const;

/**
 * Mastery threshold required to complete a block (70%)
 */
export const MASTERY_THRESHOLD = 0.7;

/**
 * Number of hard questions required to complete a block
 */
export const HARD_QUESTIONS_REQUIRED = 2;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Counts of questions attempted and correct by difficulty level
 */
export interface DifficultyCounters {
  easy: number;
  medium: number;
  hard: number;
}

/**
 * Progress tracking for a single block
 */
export interface BlockProgress {
  /** Questions attempted per difficulty */
  questions_attempted: DifficultyCounters;
  /** Questions correct per difficulty */
  questions_correct: DifficultyCounters;
  /** Computed mastery score (0-1) */
  mastery_score: number;
  /** Whether block completion criteria are met */
  is_complete: boolean;
  /** Timestamp when block was completed (if complete) */
  completed_at?: string;
  /** Whether student requested manual advance (overrides criteria) */
  student_requested_advance?: boolean;
}

/**
 * Result of mastery calculation
 */
export interface MasteryResult {
  /** Overall mastery score (0-1) */
  mastery: number;
  /** Accuracy per difficulty level (0-1, or null if no attempts) */
  accuracy_by_difficulty: {
    easy: number | null;
    medium: number | null;
    hard: number | null;
  };
  /** Total questions attempted across all difficulties */
  total_attempted: number;
  /** Total questions correct across all difficulties */
  total_correct: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Mastery Calculation Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate accuracy for a single difficulty level.
 *
 * @param correct - Number of correct answers
 * @param attempted - Number of attempts
 * @returns Accuracy (0-1) or null if no attempts
 */
export function calculateAccuracy(
  correct: number,
  attempted: number
): number | null {
  if (attempted === 0) {
    return null;
  }
  return correct / attempted;
}

/**
 * Calculate overall block mastery using weighted average formula.
 *
 * Formula:
 *   mastery = (easy_accuracy * 0.2) + (medium_accuracy * 0.4) + (hard_accuracy * 0.4)
 *
 * If a difficulty level has no attempts, its weight is redistributed
 * proportionally to other attempted levels.
 *
 * @param progress - Block progress with question counts
 * @returns MasteryResult with computed values
 */
export function calculateBlockMastery(progress: BlockProgress): MasteryResult {
  const { questions_attempted, questions_correct } = progress;

  // Calculate accuracy per difficulty
  const easyAccuracy = calculateAccuracy(
    questions_correct.easy,
    questions_attempted.easy
  );
  const mediumAccuracy = calculateAccuracy(
    questions_correct.medium,
    questions_attempted.medium
  );
  const hardAccuracy = calculateAccuracy(
    questions_correct.hard,
    questions_attempted.hard
  );

  // Total counts
  const totalAttempted =
    questions_attempted.easy +
    questions_attempted.medium +
    questions_attempted.hard;
  const totalCorrect =
    questions_correct.easy +
    questions_correct.medium +
    questions_correct.hard;

  // If no questions attempted, mastery is 0
  if (totalAttempted === 0) {
    return {
      mastery: 0,
      accuracy_by_difficulty: {
        easy: null,
        medium: null,
        hard: null,
      },
      total_attempted: 0,
      total_correct: 0,
    };
  }

  // Calculate weighted mastery
  // Only include difficulties that have been attempted
  let totalWeight = 0;
  let weightedSum = 0;

  if (easyAccuracy !== null) {
    weightedSum += easyAccuracy * DIFFICULTY_WEIGHTS.easy;
    totalWeight += DIFFICULTY_WEIGHTS.easy;
  }
  if (mediumAccuracy !== null) {
    weightedSum += mediumAccuracy * DIFFICULTY_WEIGHTS.medium;
    totalWeight += DIFFICULTY_WEIGHTS.medium;
  }
  if (hardAccuracy !== null) {
    weightedSum += hardAccuracy * DIFFICULTY_WEIGHTS.hard;
    totalWeight += DIFFICULTY_WEIGHTS.hard;
  }

  // Normalize by total weight (redistribute unattempted difficulty weights)
  const mastery = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    mastery,
    accuracy_by_difficulty: {
      easy: easyAccuracy,
      medium: mediumAccuracy,
      hard: hardAccuracy,
    },
    total_attempted: totalAttempted,
    total_correct: totalCorrect,
  };
}

/**
 * Calculate new mastery score after answering a question.
 *
 * This updates the progress counters and recalculates mastery.
 *
 * @param progress - Current block progress
 * @param difficulty - Difficulty of the question answered
 * @param isCorrect - Whether the answer was correct
 * @returns Updated BlockProgress with new mastery
 */
export function updateMasteryAfterAnswer(
  progress: BlockProgress,
  difficulty: DifficultyLevel,
  isCorrect: boolean
): BlockProgress {
  // Clone the progress to avoid mutation
  const newProgress: BlockProgress = {
    ...progress,
    questions_attempted: { ...progress.questions_attempted },
    questions_correct: { ...progress.questions_correct },
  };

  // Increment counters
  newProgress.questions_attempted[difficulty] += 1;
  if (isCorrect) {
    newProgress.questions_correct[difficulty] += 1;
  }

  // Recalculate mastery
  const result = calculateBlockMastery(newProgress);
  newProgress.mastery_score = result.mastery;

  return newProgress;
}

/**
 * Apply mastery delta from backend feedback.
 *
 * The backend sends mastery_delta (change), and we add it to the
 * previous mastery score, clamping between 0 and 1.
 *
 * @param previousMastery - Previous mastery score (0-1)
 * @param delta - Change in mastery from backend
 * @returns New mastery score clamped to [0, 1]
 */
export function applyMasteryDelta(
  previousMastery: number,
  delta: number
): number {
  const newMastery = previousMastery + delta;
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, newMastery));
}

/**
 * Convert mastery score (0-1) to percentage (0-100).
 */
export function masteryToPercent(mastery: number): number {
  return mastery * 100;
}

/**
 * Convert percentage (0-100) to mastery score (0-1).
 */
export function percentToMastery(percent: number): number {
  return percent / 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty Progress Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create an empty block progress object.
 */
export function createEmptyBlockProgress(): BlockProgress {
  return {
    questions_attempted: { easy: 0, medium: 0, hard: 0 },
    questions_correct: { easy: 0, medium: 0, hard: 0 },
    mastery_score: 0,
    is_complete: false,
  };
}
