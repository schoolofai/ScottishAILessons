/**
 * Adaptive Difficulty Algorithm for Practice Wizard V2
 *
 * This module provides pure functions for calculating adaptive difficulty
 * transitions based on student performance. Extracted from useLangGraphWizard
 * for better testability and reusability.
 *
 * Algorithm Overview:
 * - Upgrade: After UPGRADE_THRESHOLD consecutive correct answers
 * - Downgrade: After DOWNGRADE_THRESHOLD consecutive incorrect answers
 * - Difficulty levels: easy → medium → hard
 *
 * Enhanced Features:
 * - Personalized thresholds: Adjust based on student's historical accuracy
 * - Confidence weighting: Consider response time and hint usage
 */

import type { DifficultyLevel } from "@/types/practice-wizard-contracts";

// ═══════════════════════════════════════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default configuration for adaptive difficulty thresholds.
 * These are heuristic-based values with statistical reasoning:
 * - Upgrade: 3 consecutive correct ~12.5% chance randomly (0.5^3)
 * - Downgrade: 2 consecutive incorrect ~25% chance randomly (0.5^2)
 */
export const DEFAULT_ADAPTIVE_CONFIG = {
  upgradeThreshold: 3,
  downgradeThreshold: 2,
} as const;

/**
 * Configuration for personalized threshold calculation.
 * Adjusts thresholds based on student's historical accuracy.
 */
export const PERSONALIZED_CONFIG = {
  /** Accuracy above this (0-1) = high performer (faster upgrades) */
  highAccuracyThreshold: 0.75,
  /** Accuracy below this (0-1) = struggling (slower difficulty changes) */
  lowAccuracyThreshold: 0.50,
  /** Threshold reduction for high performers */
  highPerformerUpgradeBonus: -1, // Need 2 instead of 3
  /** Threshold increase for struggling students */
  lowPerformerUpgradePenalty: 1, // Need 4 instead of 3
  /** Threshold increase for struggling students (downgrade) */
  lowPerformerDowngradePenalty: 1, // Need 3 instead of 2
  /** Minimum questions needed to personalize */
  minQuestionsForPersonalization: 10,
} as const;

/**
 * Configuration for confidence-weighted adjustments.
 * Fast answers with no hints = confident mastery.
 * Slow answers or hint usage = uncertainty.
 */
export const CONFIDENCE_CONFIG = {
  /** Response time below this (seconds) = fast/confident */
  fastResponseThreshold: 15,
  /** Response time above this (seconds) = slow/uncertain */
  slowResponseThreshold: 45,
  /** Fast response with no hints = confident (bonus toward upgrade) */
  confidentAnswerBonus: 0.5,
  /** Slow response or hints used = uncertain (penalty) */
  uncertainAnswerPenalty: 0.5,
  /** Maximum hints that count as uncertain */
  hintPenaltyThreshold: 1,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for adaptive difficulty thresholds
 */
export interface AdaptiveConfig {
  /** Number of consecutive correct answers to upgrade difficulty */
  upgradeThreshold: number;
  /** Number of consecutive incorrect answers to downgrade difficulty */
  downgradeThreshold: number;
}

/**
 * Student history for personalized thresholds
 */
export interface StudentHistory {
  /** Total questions answered */
  totalQuestions: number;
  /** Total correct answers */
  totalCorrect: number;
  /** Historical accuracy (0-1), calculated if not provided */
  accuracy?: number;
}

/**
 * Response confidence metrics for a single answer
 */
export interface AnswerConfidence {
  /** Response time in seconds */
  responseTimeSeconds: number;
  /** Number of hints used */
  hintsUsed: number;
}

/**
 * State tracking consecutive answers for adaptive difficulty
 */
export interface AdaptiveState {
  /** Current difficulty level */
  currentDifficulty: DifficultyLevel;
  /** Consecutive correct answers */
  consecutiveCorrect: number;
  /** Consecutive incorrect answers */
  consecutiveIncorrect: number;
}

/**
 * Enhanced state with confidence tracking for weighted thresholds
 */
export interface EnhancedAdaptiveState extends AdaptiveState {
  /** Accumulated confidence score (fractional progress toward threshold) */
  confidenceScore: number;
  /** Student history for personalized thresholds */
  studentHistory?: StudentHistory;
}

/**
 * Result of adaptive difficulty calculation
 */
export interface AdaptiveResult {
  /** The new difficulty level */
  newDifficulty: DifficultyLevel;
  /** Whether the difficulty changed */
  didChange: boolean;
  /** Type of change: "upgrade", "downgrade", or "none" */
  changeType: "upgrade" | "downgrade" | "none";
  /** Updated consecutive correct count (reset if changed) */
  newConsecutiveCorrect: number;
  /** Updated consecutive incorrect count (reset if changed) */
  newConsecutiveIncorrect: number;
}

/**
 * Enhanced result with confidence score tracking
 */
export interface EnhancedAdaptiveResult extends AdaptiveResult {
  /** Updated confidence score (reset if changed) */
  newConfidenceScore: number;
  /** Effective thresholds used (after personalization) */
  effectiveConfig: AdaptiveConfig;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Algorithm Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the next difficulty level based on consecutive performance.
 *
 * Pure function - no side effects, fully deterministic.
 *
 * @param state - Current adaptive state
 * @param config - Threshold configuration (optional, uses defaults)
 * @returns Result with new difficulty and updated counters
 */
export function calculateAdaptiveDifficulty(
  state: AdaptiveState,
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG
): AdaptiveResult {
  const { currentDifficulty, consecutiveCorrect, consecutiveIncorrect } = state;
  const { upgradeThreshold, downgradeThreshold } = config;

  // Check for upgrade
  if (consecutiveCorrect >= upgradeThreshold) {
    const upgraded = upgradeDifficulty(currentDifficulty);
    if (upgraded !== currentDifficulty) {
      return {
        newDifficulty: upgraded,
        didChange: true,
        changeType: "upgrade",
        newConsecutiveCorrect: 0,
        newConsecutiveIncorrect: 0,
      };
    }
  }

  // Check for downgrade
  if (consecutiveIncorrect >= downgradeThreshold) {
    const downgraded = downgradeDifficulty(currentDifficulty);
    if (downgraded !== currentDifficulty) {
      return {
        newDifficulty: downgraded,
        didChange: true,
        changeType: "downgrade",
        newConsecutiveCorrect: 0,
        newConsecutiveIncorrect: 0,
      };
    }
  }

  // No change
  return {
    newDifficulty: currentDifficulty,
    didChange: false,
    changeType: "none",
    newConsecutiveCorrect: consecutiveCorrect,
    newConsecutiveIncorrect: consecutiveIncorrect,
  };
}

/**
 * Update consecutive counters based on answer correctness.
 *
 * @param isCorrect - Whether the answer was correct
 * @param currentCorrect - Current consecutive correct count
 * @param currentIncorrect - Current consecutive incorrect count
 * @returns Updated counts
 */
export function updateConsecutiveCounts(
  isCorrect: boolean,
  currentCorrect: number,
  currentIncorrect: number
): { consecutiveCorrect: number; consecutiveIncorrect: number } {
  if (isCorrect) {
    return {
      consecutiveCorrect: currentCorrect + 1,
      consecutiveIncorrect: 0, // Reset incorrect on correct answer
    };
  } else {
    return {
      consecutiveCorrect: 0, // Reset correct on incorrect answer
      consecutiveIncorrect: currentIncorrect + 1,
    };
  }
}

/**
 * Upgrade difficulty by one level (if possible).
 *
 * @param current - Current difficulty
 * @returns Upgraded difficulty (or same if already at max)
 */
export function upgradeDifficulty(current: DifficultyLevel): DifficultyLevel {
  switch (current) {
    case "easy":
      return "medium";
    case "medium":
      return "hard";
    case "hard":
      return "hard"; // Already at max
  }
}

/**
 * Downgrade difficulty by one level (if possible).
 *
 * @param current - Current difficulty
 * @returns Downgraded difficulty (or same if already at min)
 */
export function downgradeDifficulty(current: DifficultyLevel): DifficultyLevel {
  switch (current) {
    case "hard":
      return "medium";
    case "medium":
      return "easy";
    case "easy":
      return "easy"; // Already at min
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Difficulty Level Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All difficulty levels in order from easiest to hardest.
 */
export const DIFFICULTY_LEVELS: DifficultyLevel[] = ["easy", "medium", "hard"];

/**
 * Get the numeric index of a difficulty level (0-2).
 */
export function getDifficultyIndex(level: DifficultyLevel): number {
  return DIFFICULTY_LEVELS.indexOf(level);
}

/**
 * Check if a difficulty can be upgraded (not at max).
 */
export function canUpgrade(level: DifficultyLevel): boolean {
  return level !== "hard";
}

/**
 * Check if a difficulty can be downgraded (not at min).
 */
export function canDowngrade(level: DifficultyLevel): boolean {
  return level !== "easy";
}

// ═══════════════════════════════════════════════════════════════════════════
// Improvement 1: Personalized Thresholds
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate personalized thresholds based on student's historical accuracy.
 *
 * High performers (>75% accuracy): Need fewer consecutive correct to upgrade
 * Struggling students (<50% accuracy): Need more consecutive to change difficulty
 *
 * This ensures students aren't held back unnecessarily OR pushed too fast.
 *
 * @param studentHistory - Student's historical performance
 * @param baseConfig - Base threshold configuration
 * @returns Personalized threshold configuration
 */
export function calculatePersonalizedThresholds(
  studentHistory: StudentHistory | undefined,
  baseConfig: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG
): AdaptiveConfig {
  // If no history or not enough data, use default
  if (
    !studentHistory ||
    studentHistory.totalQuestions < PERSONALIZED_CONFIG.minQuestionsForPersonalization
  ) {
    return { ...baseConfig };
  }

  // Calculate accuracy
  const accuracy =
    studentHistory.accuracy ??
    (studentHistory.totalQuestions > 0
      ? studentHistory.totalCorrect / studentHistory.totalQuestions
      : 0);

  let upgradeThreshold = baseConfig.upgradeThreshold;
  let downgradeThreshold = baseConfig.downgradeThreshold;

  // High performer: Faster upgrades
  if (accuracy >= PERSONALIZED_CONFIG.highAccuracyThreshold) {
    upgradeThreshold = Math.max(
      2, // Minimum threshold of 2
      baseConfig.upgradeThreshold + PERSONALIZED_CONFIG.highPerformerUpgradeBonus
    );
  }

  // Struggling student: Slower difficulty changes (more practice at each level)
  if (accuracy < PERSONALIZED_CONFIG.lowAccuracyThreshold) {
    upgradeThreshold = baseConfig.upgradeThreshold + PERSONALIZED_CONFIG.lowPerformerUpgradePenalty;
    downgradeThreshold = baseConfig.downgradeThreshold + PERSONALIZED_CONFIG.lowPerformerDowngradePenalty;
  }

  return {
    upgradeThreshold,
    downgradeThreshold,
  };
}

/**
 * Get student's accuracy from history.
 *
 * @param history - Student history
 * @returns Accuracy as 0-1 value
 */
export function getStudentAccuracy(history: StudentHistory): number {
  if (history.accuracy !== undefined) {
    return history.accuracy;
  }
  if (history.totalQuestions === 0) {
    return 0;
  }
  return history.totalCorrect / history.totalQuestions;
}

// ═══════════════════════════════════════════════════════════════════════════
// Improvement 2: Confidence-Weighted Thresholds
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate confidence weight for an answer based on response time and hints.
 *
 * A fast answer with no hints suggests confident mastery → higher weight (>1.0)
 * A slow answer or one using hints suggests uncertainty → lower weight (<1.0)
 *
 * This allows confident correct answers to count MORE toward upgrades,
 * while uncertain correct answers count less.
 *
 * @param confidence - Response confidence metrics
 * @param isCorrect - Whether the answer was correct
 * @returns Weight multiplier (0.5 to 1.5)
 */
export function calculateConfidenceWeight(
  confidence: AnswerConfidence,
  isCorrect: boolean
): number {
  const { responseTimeSeconds, hintsUsed } = confidence;

  // Start with base weight of 1.0
  let weight = 1.0;

  // Hints used = uncertainty
  if (hintsUsed >= CONFIDENCE_CONFIG.hintPenaltyThreshold) {
    weight -= CONFIDENCE_CONFIG.uncertainAnswerPenalty;
  }

  // Response time evaluation
  if (responseTimeSeconds <= CONFIDENCE_CONFIG.fastResponseThreshold) {
    // Fast response = confident
    if (hintsUsed === 0) {
      weight += CONFIDENCE_CONFIG.confidentAnswerBonus;
    }
  } else if (responseTimeSeconds >= CONFIDENCE_CONFIG.slowResponseThreshold) {
    // Slow response = uncertain
    weight -= CONFIDENCE_CONFIG.uncertainAnswerPenalty;
  }

  // Clamp weight between 0.5 and 1.5
  return Math.max(0.5, Math.min(1.5, weight));
}

/**
 * Update confidence score based on answer with weighted contribution.
 *
 * Instead of counting each correct answer as exactly +1 toward the threshold,
 * confident answers contribute more (+1.5) and uncertain answers less (+0.5).
 *
 * @param isCorrect - Whether the answer was correct
 * @param confidence - Response confidence metrics
 * @param currentScore - Current accumulated confidence score
 * @returns Updated confidence score
 */
export function updateConfidenceScore(
  isCorrect: boolean,
  confidence: AnswerConfidence,
  currentScore: number
): number {
  const weight = calculateConfidenceWeight(confidence, isCorrect);

  if (isCorrect) {
    // Add weighted contribution toward upgrade threshold
    return currentScore + weight;
  } else {
    // Incorrect resets the confidence score (like consecutive count)
    return 0;
  }
}

/**
 * Calculate adaptive difficulty with confidence weighting.
 *
 * Uses confidence score instead of simple consecutive count for upgrades.
 * Maintains consecutive incorrect count for downgrades.
 *
 * @param state - Enhanced adaptive state with confidence tracking
 * @param config - Threshold configuration (optionally personalized)
 * @returns Enhanced result with new confidence score
 */
export function calculateEnhancedAdaptiveDifficulty(
  state: EnhancedAdaptiveState,
  config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG
): EnhancedAdaptiveResult {
  const {
    currentDifficulty,
    consecutiveCorrect,
    consecutiveIncorrect,
    confidenceScore,
    studentHistory,
  } = state;

  // Apply personalization if student history available
  const effectiveConfig = calculatePersonalizedThresholds(studentHistory, config);

  // Check for upgrade using confidence score
  if (confidenceScore >= effectiveConfig.upgradeThreshold) {
    const upgraded = upgradeDifficulty(currentDifficulty);
    if (upgraded !== currentDifficulty) {
      return {
        newDifficulty: upgraded,
        didChange: true,
        changeType: "upgrade",
        newConsecutiveCorrect: 0,
        newConsecutiveIncorrect: 0,
        newConfidenceScore: 0,
        effectiveConfig,
      };
    }
  }

  // Check for downgrade using consecutive incorrect (simpler for downgrades)
  if (consecutiveIncorrect >= effectiveConfig.downgradeThreshold) {
    const downgraded = downgradeDifficulty(currentDifficulty);
    if (downgraded !== currentDifficulty) {
      return {
        newDifficulty: downgraded,
        didChange: true,
        changeType: "downgrade",
        newConsecutiveCorrect: 0,
        newConsecutiveIncorrect: 0,
        newConfidenceScore: 0,
        effectiveConfig,
      };
    }
  }

  // No change
  return {
    newDifficulty: currentDifficulty,
    didChange: false,
    changeType: "none",
    newConsecutiveCorrect: consecutiveCorrect,
    newConsecutiveIncorrect: consecutiveIncorrect,
    newConfidenceScore: confidenceScore,
    effectiveConfig,
  };
}

/**
 * Process an answer with full enhanced tracking.
 *
 * Convenience function that:
 * 1. Updates consecutive counts
 * 2. Updates confidence score with weighting
 * 3. Returns both for state management
 *
 * @param isCorrect - Whether answer was correct
 * @param confidence - Response confidence metrics
 * @param currentState - Current consecutive and confidence state
 * @returns Updated state values
 */
export function processAnswerEnhanced(
  isCorrect: boolean,
  confidence: AnswerConfidence,
  currentState: {
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
    confidenceScore: number;
  }
): {
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  confidenceScore: number;
} {
  // Update consecutive counts (basic tracking)
  const counts = updateConsecutiveCounts(
    isCorrect,
    currentState.consecutiveCorrect,
    currentState.consecutiveIncorrect
  );

  // Update confidence score (weighted tracking)
  const newConfidenceScore = updateConfidenceScore(
    isCorrect,
    confidence,
    currentState.confidenceScore
  );

  return {
    ...counts,
    confidenceScore: newConfidenceScore,
  };
}
