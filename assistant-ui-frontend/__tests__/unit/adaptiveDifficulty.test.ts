/**
 * Unit Tests for Adaptive Difficulty Algorithm
 *
 * Tests the pure functions that calculate difficulty transitions
 * based on consecutive correct/incorrect answers.
 */

import {
  calculateAdaptiveDifficulty,
  updateConsecutiveCounts,
  upgradeDifficulty,
  downgradeDifficulty,
  canUpgrade,
  canDowngrade,
  getDifficultyIndex,
  DEFAULT_ADAPTIVE_CONFIG,
  DIFFICULTY_LEVELS,
  // Improvement 1: Personalized thresholds
  PERSONALIZED_CONFIG,
  calculatePersonalizedThresholds,
  getStudentAccuracy,
  // Improvement 2: Confidence-weighted thresholds
  CONFIDENCE_CONFIG,
  calculateConfidenceWeight,
  updateConfidenceScore,
  calculateEnhancedAdaptiveDifficulty,
  processAnswerEnhanced,
  type AdaptiveState,
  type AdaptiveConfig,
  type StudentHistory,
  type AnswerConfidence,
  type EnhancedAdaptiveState,
} from "@/lib/practice/adaptiveDifficulty";

describe("Adaptive Difficulty Algorithm", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Core Algorithm Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("calculateAdaptiveDifficulty", () => {
    describe("upgrade scenarios", () => {
      it("should upgrade from easy to medium after 3 consecutive correct", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 3,
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
        expect(result.changeType).toBe("upgrade");
        expect(result.newConsecutiveCorrect).toBe(0);
        expect(result.newConsecutiveIncorrect).toBe(0);
      });

      it("should upgrade from medium to hard after 3 consecutive correct", () => {
        const state: AdaptiveState = {
          currentDifficulty: "medium",
          consecutiveCorrect: 3,
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("hard");
        expect(result.didChange).toBe(true);
        expect(result.changeType).toBe("upgrade");
      });

      it("should stay at hard when already at maximum", () => {
        const state: AdaptiveState = {
          currentDifficulty: "hard",
          consecutiveCorrect: 5, // More than threshold
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("hard");
        expect(result.didChange).toBe(false);
        expect(result.changeType).toBe("none");
        // Counters preserved when no change
        expect(result.newConsecutiveCorrect).toBe(5);
      });

      it("should NOT upgrade with only 2 consecutive correct", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 2,
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("easy");
        expect(result.didChange).toBe(false);
        expect(result.changeType).toBe("none");
      });

      it("should upgrade with exactly threshold value", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: DEFAULT_ADAPTIVE_CONFIG.upgradeThreshold,
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
      });

      it("should upgrade with more than threshold value", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 10, // Way more than 3
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
      });
    });

    describe("downgrade scenarios", () => {
      it("should downgrade from hard to medium after 2 consecutive incorrect", () => {
        const state: AdaptiveState = {
          currentDifficulty: "hard",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 2,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
        expect(result.changeType).toBe("downgrade");
        expect(result.newConsecutiveCorrect).toBe(0);
        expect(result.newConsecutiveIncorrect).toBe(0);
      });

      it("should downgrade from medium to easy after 2 consecutive incorrect", () => {
        const state: AdaptiveState = {
          currentDifficulty: "medium",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 2,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("easy");
        expect(result.didChange).toBe(true);
        expect(result.changeType).toBe("downgrade");
      });

      it("should stay at easy when already at minimum", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 5, // More than threshold
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("easy");
        expect(result.didChange).toBe(false);
        expect(result.changeType).toBe("none");
        // Counters preserved when no change
        expect(result.newConsecutiveIncorrect).toBe(5);
      });

      it("should NOT downgrade with only 1 consecutive incorrect", () => {
        const state: AdaptiveState = {
          currentDifficulty: "hard",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 1,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("hard");
        expect(result.didChange).toBe(false);
        expect(result.changeType).toBe("none");
      });
    });

    describe("no change scenarios", () => {
      it("should not change with zero consecutive counts", () => {
        const state: AdaptiveState = {
          currentDifficulty: "medium",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(false);
        expect(result.changeType).toBe("none");
      });

      it("should preserve counters when no change occurs", () => {
        const state: AdaptiveState = {
          currentDifficulty: "medium",
          consecutiveCorrect: 2, // Not enough for upgrade
          consecutiveIncorrect: 0,
        };

        const result = calculateAdaptiveDifficulty(state);

        expect(result.newConsecutiveCorrect).toBe(2);
        expect(result.newConsecutiveIncorrect).toBe(0);
      });
    });

    describe("custom configuration", () => {
      it("should use custom upgrade threshold", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 5,
          consecutiveIncorrect: 0,
        };

        const customConfig: AdaptiveConfig = {
          upgradeThreshold: 5, // Needs exactly 5
          downgradeThreshold: 2,
        };

        const result = calculateAdaptiveDifficulty(state, customConfig);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
      });

      it("should use custom downgrade threshold", () => {
        const state: AdaptiveState = {
          currentDifficulty: "hard",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 3,
        };

        const customConfig: AdaptiveConfig = {
          upgradeThreshold: 3,
          downgradeThreshold: 3, // Needs 3 instead of 2
        };

        const result = calculateAdaptiveDifficulty(state, customConfig);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
      });

      it("should NOT change with stricter thresholds", () => {
        const state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 3, // Default would upgrade
          consecutiveIncorrect: 0,
        };

        const strictConfig: AdaptiveConfig = {
          upgradeThreshold: 5, // Stricter
          downgradeThreshold: 3,
        };

        const result = calculateAdaptiveDifficulty(state, strictConfig);

        expect(result.newDifficulty).toBe("easy");
        expect(result.didChange).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should handle upgrade priority when both conditions met (edge case)", () => {
        // This shouldn't happen in practice, but test the precedence
        const state: AdaptiveState = {
          currentDifficulty: "medium",
          consecutiveCorrect: 3,
          consecutiveIncorrect: 2,
        };

        // Upgrade is checked first
        const result = calculateAdaptiveDifficulty(state);
        expect(result.changeType).toBe("upgrade");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Counter Update Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("updateConsecutiveCounts", () => {
    it("should increment correct and reset incorrect on correct answer", () => {
      const result = updateConsecutiveCounts(true, 2, 1);

      expect(result.consecutiveCorrect).toBe(3);
      expect(result.consecutiveIncorrect).toBe(0);
    });

    it("should increment incorrect and reset correct on incorrect answer", () => {
      const result = updateConsecutiveCounts(false, 2, 1);

      expect(result.consecutiveCorrect).toBe(0);
      expect(result.consecutiveIncorrect).toBe(2);
    });

    it("should start counting from zero", () => {
      const result = updateConsecutiveCounts(true, 0, 0);

      expect(result.consecutiveCorrect).toBe(1);
      expect(result.consecutiveIncorrect).toBe(0);
    });

    it("should build up consecutive correct streak", () => {
      let state = { consecutiveCorrect: 0, consecutiveIncorrect: 0 };

      // Answer 3 correct in a row
      for (let i = 0; i < 3; i++) {
        state = updateConsecutiveCounts(
          true,
          state.consecutiveCorrect,
          state.consecutiveIncorrect
        );
      }

      expect(state.consecutiveCorrect).toBe(3);
      expect(state.consecutiveIncorrect).toBe(0);
    });

    it("should reset streak on single wrong answer", () => {
      // Build up a streak
      let state = { consecutiveCorrect: 5, consecutiveIncorrect: 0 };

      // One wrong answer resets
      state = updateConsecutiveCounts(
        false,
        state.consecutiveCorrect,
        state.consecutiveIncorrect
      );

      expect(state.consecutiveCorrect).toBe(0);
      expect(state.consecutiveIncorrect).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Utility Function Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("upgradeDifficulty", () => {
    it("should upgrade easy to medium", () => {
      expect(upgradeDifficulty("easy")).toBe("medium");
    });

    it("should upgrade medium to hard", () => {
      expect(upgradeDifficulty("medium")).toBe("hard");
    });

    it("should keep hard at hard", () => {
      expect(upgradeDifficulty("hard")).toBe("hard");
    });
  });

  describe("downgradeDifficulty", () => {
    it("should downgrade hard to medium", () => {
      expect(downgradeDifficulty("hard")).toBe("medium");
    });

    it("should downgrade medium to easy", () => {
      expect(downgradeDifficulty("medium")).toBe("easy");
    });

    it("should keep easy at easy", () => {
      expect(downgradeDifficulty("easy")).toBe("easy");
    });
  });

  describe("canUpgrade", () => {
    it("should return true for easy", () => {
      expect(canUpgrade("easy")).toBe(true);
    });

    it("should return true for medium", () => {
      expect(canUpgrade("medium")).toBe(true);
    });

    it("should return false for hard", () => {
      expect(canUpgrade("hard")).toBe(false);
    });
  });

  describe("canDowngrade", () => {
    it("should return true for hard", () => {
      expect(canDowngrade("hard")).toBe(true);
    });

    it("should return true for medium", () => {
      expect(canDowngrade("medium")).toBe(true);
    });

    it("should return false for easy", () => {
      expect(canDowngrade("easy")).toBe(false);
    });
  });

  describe("getDifficultyIndex", () => {
    it("should return 0 for easy", () => {
      expect(getDifficultyIndex("easy")).toBe(0);
    });

    it("should return 1 for medium", () => {
      expect(getDifficultyIndex("medium")).toBe(1);
    });

    it("should return 2 for hard", () => {
      expect(getDifficultyIndex("hard")).toBe(2);
    });
  });

  describe("DIFFICULTY_LEVELS constant", () => {
    it("should contain all three levels in order", () => {
      expect(DIFFICULTY_LEVELS).toEqual(["easy", "medium", "hard"]);
    });

    it("should have length 3", () => {
      expect(DIFFICULTY_LEVELS.length).toBe(3);
    });
  });

  describe("DEFAULT_ADAPTIVE_CONFIG", () => {
    it("should have upgrade threshold of 3", () => {
      expect(DEFAULT_ADAPTIVE_CONFIG.upgradeThreshold).toBe(3);
    });

    it("should have downgrade threshold of 2", () => {
      expect(DEFAULT_ADAPTIVE_CONFIG.downgradeThreshold).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration/Simulation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("full session simulation", () => {
    it("should progress easy→medium→hard with consistent correct answers", () => {
      let state: AdaptiveState = {
        currentDifficulty: "easy",
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
      };

      // Simulate answering 10 questions correctly
      for (let i = 0; i < 10; i++) {
        // Update counters for correct answer
        const counts = updateConsecutiveCounts(
          true,
          state.consecutiveCorrect,
          state.consecutiveIncorrect
        );
        state.consecutiveCorrect = counts.consecutiveCorrect;
        state.consecutiveIncorrect = counts.consecutiveIncorrect;

        // Check for difficulty change
        const result = calculateAdaptiveDifficulty(state);
        if (result.didChange) {
          state.currentDifficulty = result.newDifficulty;
          state.consecutiveCorrect = result.newConsecutiveCorrect;
          state.consecutiveIncorrect = result.newConsecutiveIncorrect;
        }
      }

      // After 10 correct: should reach hard
      // Q1-Q3: easy (upgrade at Q3)
      // Q4-Q6: medium (upgrade at Q6)
      // Q7-Q10: hard (no more upgrades)
      expect(state.currentDifficulty).toBe("hard");
    });

    it("should progress hard→medium→easy with consistent incorrect answers", () => {
      let state: AdaptiveState = {
        currentDifficulty: "hard",
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
      };

      // Simulate answering 6 questions incorrectly
      for (let i = 0; i < 6; i++) {
        const counts = updateConsecutiveCounts(
          false,
          state.consecutiveCorrect,
          state.consecutiveIncorrect
        );
        state.consecutiveCorrect = counts.consecutiveCorrect;
        state.consecutiveIncorrect = counts.consecutiveIncorrect;

        const result = calculateAdaptiveDifficulty(state);
        if (result.didChange) {
          state.currentDifficulty = result.newDifficulty;
          state.consecutiveCorrect = result.newConsecutiveCorrect;
          state.consecutiveIncorrect = result.newConsecutiveIncorrect;
        }
      }

      // After 6 incorrect: should reach easy
      // Q1-Q2: hard (downgrade at Q2)
      // Q3-Q4: medium (downgrade at Q4)
      // Q5-Q6: easy (no more downgrades)
      expect(state.currentDifficulty).toBe("easy");
    });

    it("should handle mixed correct/incorrect answers", () => {
      let state: AdaptiveState = {
        currentDifficulty: "medium",
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
      };

      // Simulate: Correct, Correct, Incorrect, Correct, Correct, Correct
      const answers = [true, true, false, true, true, true];

      for (const isCorrect of answers) {
        const counts = updateConsecutiveCounts(
          isCorrect,
          state.consecutiveCorrect,
          state.consecutiveIncorrect
        );
        state.consecutiveCorrect = counts.consecutiveCorrect;
        state.consecutiveIncorrect = counts.consecutiveIncorrect;

        const result = calculateAdaptiveDifficulty(state);
        if (result.didChange) {
          state.currentDifficulty = result.newDifficulty;
          state.consecutiveCorrect = result.newConsecutiveCorrect;
          state.consecutiveIncorrect = result.newConsecutiveIncorrect;
        }
      }

      // After C,C,I,C,C,C: streak broken at I, then 3 correct → upgrade
      expect(state.currentDifficulty).toBe("hard");
    });

    it("should stay at easy when alternating correct/incorrect", () => {
      let state: AdaptiveState = {
        currentDifficulty: "easy",
        consecutiveCorrect: 0,
        consecutiveIncorrect: 0,
      };

      // Simulate alternating answers (never builds streak)
      const answers = [true, false, true, false, true, false, true, false];

      for (const isCorrect of answers) {
        const counts = updateConsecutiveCounts(
          isCorrect,
          state.consecutiveCorrect,
          state.consecutiveIncorrect
        );
        state.consecutiveCorrect = counts.consecutiveCorrect;
        state.consecutiveIncorrect = counts.consecutiveIncorrect;

        const result = calculateAdaptiveDifficulty(state);
        if (result.didChange) {
          state.currentDifficulty = result.newDifficulty;
          state.consecutiveCorrect = result.newConsecutiveCorrect;
          state.consecutiveIncorrect = result.newConsecutiveIncorrect;
        }
      }

      // Never builds streak, stays at easy
      expect(state.currentDifficulty).toBe("easy");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Improvement 1: Personalized Thresholds Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Personalized Thresholds (Improvement 1)", () => {
    describe("calculatePersonalizedThresholds", () => {
      it("should use default config when no history provided", () => {
        const config = calculatePersonalizedThresholds(undefined);

        expect(config.upgradeThreshold).toBe(DEFAULT_ADAPTIVE_CONFIG.upgradeThreshold);
        expect(config.downgradeThreshold).toBe(DEFAULT_ADAPTIVE_CONFIG.downgradeThreshold);
      });

      it("should use default config when not enough questions answered", () => {
        const history: StudentHistory = {
          totalQuestions: 5, // Less than minQuestionsForPersonalization (10)
          totalCorrect: 5,
          accuracy: 1.0, // 100% accuracy but not enough data
        };

        const config = calculatePersonalizedThresholds(history);

        expect(config.upgradeThreshold).toBe(DEFAULT_ADAPTIVE_CONFIG.upgradeThreshold);
      });

      it("should reduce upgrade threshold for high performers", () => {
        const highPerformer: StudentHistory = {
          totalQuestions: 20,
          totalCorrect: 16, // 80% accuracy (above 75% threshold)
        };

        const config = calculatePersonalizedThresholds(highPerformer);

        // Default is 3, high performer gets -1 bonus = 2
        expect(config.upgradeThreshold).toBe(2);
        expect(config.downgradeThreshold).toBe(DEFAULT_ADAPTIVE_CONFIG.downgradeThreshold);
      });

      it("should use provided accuracy instead of calculating", () => {
        const history: StudentHistory = {
          totalQuestions: 10,
          totalCorrect: 5, // Would be 50%
          accuracy: 0.80, // But we provide 80%
        };

        const config = calculatePersonalizedThresholds(history);

        // Should use provided accuracy (80%) = high performer
        expect(config.upgradeThreshold).toBe(2);
      });

      it("should increase thresholds for struggling students", () => {
        const strugglingStudent: StudentHistory = {
          totalQuestions: 20,
          totalCorrect: 8, // 40% accuracy (below 50% threshold)
        };

        const config = calculatePersonalizedThresholds(strugglingStudent);

        // Default 3 + 1 penalty = 4
        expect(config.upgradeThreshold).toBe(4);
        // Default 2 + 1 penalty = 3
        expect(config.downgradeThreshold).toBe(3);
      });

      it("should not change thresholds for average students", () => {
        const averageStudent: StudentHistory = {
          totalQuestions: 20,
          totalCorrect: 13, // 65% accuracy (between 50% and 75%)
        };

        const config = calculatePersonalizedThresholds(averageStudent);

        expect(config.upgradeThreshold).toBe(DEFAULT_ADAPTIVE_CONFIG.upgradeThreshold);
        expect(config.downgradeThreshold).toBe(DEFAULT_ADAPTIVE_CONFIG.downgradeThreshold);
      });

      it("should not reduce upgrade threshold below 2", () => {
        const history: StudentHistory = {
          totalQuestions: 100,
          totalCorrect: 100, // 100% accuracy
        };

        // Even with high accuracy, minimum is 2
        const config = calculatePersonalizedThresholds(history);
        expect(config.upgradeThreshold).toBeGreaterThanOrEqual(2);
      });

      it("should use custom base config", () => {
        const history: StudentHistory = {
          totalQuestions: 20,
          totalCorrect: 16, // 80% = high performer
        };

        const customBase: AdaptiveConfig = {
          upgradeThreshold: 5,
          downgradeThreshold: 3,
        };

        const config = calculatePersonalizedThresholds(history, customBase);

        // 5 - 1 = 4 (high performer bonus)
        expect(config.upgradeThreshold).toBe(4);
        expect(config.downgradeThreshold).toBe(3);
      });
    });

    describe("getStudentAccuracy", () => {
      it("should return provided accuracy if available", () => {
        const history: StudentHistory = {
          totalQuestions: 10,
          totalCorrect: 5,
          accuracy: 0.75,
        };

        expect(getStudentAccuracy(history)).toBe(0.75);
      });

      it("should calculate accuracy from totals", () => {
        const history: StudentHistory = {
          totalQuestions: 10,
          totalCorrect: 7,
        };

        expect(getStudentAccuracy(history)).toBe(0.7);
      });

      it("should return 0 for no questions", () => {
        const history: StudentHistory = {
          totalQuestions: 0,
          totalCorrect: 0,
        };

        expect(getStudentAccuracy(history)).toBe(0);
      });
    });

    describe("PERSONALIZED_CONFIG constants", () => {
      it("should have correct high accuracy threshold", () => {
        expect(PERSONALIZED_CONFIG.highAccuracyThreshold).toBe(0.75);
      });

      it("should have correct low accuracy threshold", () => {
        expect(PERSONALIZED_CONFIG.lowAccuracyThreshold).toBe(0.50);
      });

      it("should require 10 questions minimum", () => {
        expect(PERSONALIZED_CONFIG.minQuestionsForPersonalization).toBe(10);
      });
    });

    describe("personalized upgrade simulation", () => {
      it("should upgrade faster for high performers", () => {
        const highPerformerHistory: StudentHistory = {
          totalQuestions: 20,
          totalCorrect: 18, // 90% accuracy
        };

        let state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 2, // Only 2 consecutive (default needs 3)
          consecutiveIncorrect: 0,
        };

        // Get personalized config
        const personalizedConfig = calculatePersonalizedThresholds(highPerformerHistory);

        // High performer threshold is 2, so 2 consecutive should upgrade
        const result = calculateAdaptiveDifficulty(state, personalizedConfig);

        expect(result.didChange).toBe(true);
        expect(result.newDifficulty).toBe("medium");
      });

      it("should upgrade slower for struggling students", () => {
        const strugglingHistory: StudentHistory = {
          totalQuestions: 20,
          totalCorrect: 8, // 40% accuracy
        };

        let state: AdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 3, // Default would upgrade
          consecutiveIncorrect: 0,
        };

        const personalizedConfig = calculatePersonalizedThresholds(strugglingHistory);

        // Struggling threshold is 4, so 3 consecutive should NOT upgrade
        const result = calculateAdaptiveDifficulty(state, personalizedConfig);

        expect(result.didChange).toBe(false);
        expect(result.newDifficulty).toBe("easy");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Improvement 2: Confidence-Weighted Thresholds Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Confidence-Weighted Thresholds (Improvement 2)", () => {
    describe("calculateConfidenceWeight", () => {
      it("should return 1.5 for fast answer with no hints", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 10, // Fast (below 15s)
          hintsUsed: 0,
        };

        const weight = calculateConfidenceWeight(confidence, true);

        expect(weight).toBe(1.5);
      });

      it("should return 0.5 for slow answer with hints", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 60, // Slow (above 45s)
          hintsUsed: 2, // Used hints
        };

        const weight = calculateConfidenceWeight(confidence, true);

        // Base 1.0 - 0.5 (slow) - 0.5 (hints) = 0.0, but clamped to 0.5
        expect(weight).toBe(0.5);
      });

      it("should return 1.0 for average response", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 30, // Medium (between 15-45s)
          hintsUsed: 0,
        };

        const weight = calculateConfidenceWeight(confidence, true);

        expect(weight).toBe(1.0);
      });

      it("should penalize hint usage regardless of speed", () => {
        const fastWithHints: AnswerConfidence = {
          responseTimeSeconds: 10, // Fast
          hintsUsed: 1, // But used hint
        };

        const weight = calculateConfidenceWeight(fastWithHints, true);

        // Fast + hints = 1.0 - 0.5 = 0.5 (no bonus because hints used)
        expect(weight).toBe(0.5);
      });

      it("should clamp weight to 0.5 minimum", () => {
        const veryUncertain: AnswerConfidence = {
          responseTimeSeconds: 120, // Very slow
          hintsUsed: 5, // Many hints
        };

        const weight = calculateConfidenceWeight(veryUncertain, true);

        expect(weight).toBeGreaterThanOrEqual(0.5);
      });

      it("should clamp weight to 1.5 maximum", () => {
        const veryConfident: AnswerConfidence = {
          responseTimeSeconds: 1, // Instant
          hintsUsed: 0,
        };

        const weight = calculateConfidenceWeight(veryConfident, true);

        expect(weight).toBeLessThanOrEqual(1.5);
      });
    });

    describe("updateConfidenceScore", () => {
      it("should add weighted score for correct answer", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 10,
          hintsUsed: 0,
        };

        const newScore = updateConfidenceScore(true, confidence, 1.0);

        // Current 1.0 + weight 1.5 = 2.5
        expect(newScore).toBe(2.5);
      });

      it("should reset score for incorrect answer", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 10,
          hintsUsed: 0,
        };

        const newScore = updateConfidenceScore(false, confidence, 5.0);

        expect(newScore).toBe(0);
      });

      it("should accumulate score over multiple correct answers", () => {
        const fastConfident: AnswerConfidence = {
          responseTimeSeconds: 10,
          hintsUsed: 0,
        };

        let score = 0;

        // Two fast confident answers
        score = updateConfidenceScore(true, fastConfident, score); // 1.5
        score = updateConfidenceScore(true, fastConfident, score); // 3.0

        expect(score).toBe(3.0);
      });
    });

    describe("calculateEnhancedAdaptiveDifficulty", () => {
      it("should upgrade using confidence score threshold", () => {
        const state: EnhancedAdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 2,
          consecutiveIncorrect: 0,
          confidenceScore: 3.5, // Above threshold of 3
        };

        const result = calculateEnhancedAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
        expect(result.changeType).toBe("upgrade");
        expect(result.newConfidenceScore).toBe(0);
      });

      it("should NOT upgrade when confidence score below threshold", () => {
        const state: EnhancedAdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 2,
          consecutiveIncorrect: 0,
          confidenceScore: 2.5, // Below threshold of 3
        };

        const result = calculateEnhancedAdaptiveDifficulty(state);

        expect(result.didChange).toBe(false);
        expect(result.newConfidenceScore).toBe(2.5);
      });

      it("should use personalized threshold when history provided", () => {
        const state: EnhancedAdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 2,
          consecutiveIncorrect: 0,
          confidenceScore: 2.0, // Would NOT upgrade with default (3)
          studentHistory: {
            totalQuestions: 20,
            totalCorrect: 18, // 90% = high performer = threshold 2
          },
        };

        const result = calculateEnhancedAdaptiveDifficulty(state);

        // With personalized threshold of 2, score of 2.0 should upgrade
        expect(result.didChange).toBe(true);
        expect(result.newDifficulty).toBe("medium");
        expect(result.effectiveConfig.upgradeThreshold).toBe(2);
      });

      it("should downgrade using consecutive incorrect", () => {
        const state: EnhancedAdaptiveState = {
          currentDifficulty: "hard",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 2,
          confidenceScore: 0,
        };

        const result = calculateEnhancedAdaptiveDifficulty(state);

        expect(result.newDifficulty).toBe("medium");
        expect(result.didChange).toBe(true);
        expect(result.changeType).toBe("downgrade");
      });

      it("should return effective config used", () => {
        const state: EnhancedAdaptiveState = {
          currentDifficulty: "medium",
          consecutiveCorrect: 1,
          consecutiveIncorrect: 0,
          confidenceScore: 1.0,
        };

        const result = calculateEnhancedAdaptiveDifficulty(state);

        expect(result.effectiveConfig.upgradeThreshold).toBe(3);
        expect(result.effectiveConfig.downgradeThreshold).toBe(2);
      });
    });

    describe("processAnswerEnhanced", () => {
      it("should update both counts and confidence score", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 10,
          hintsUsed: 0,
        };

        const result = processAnswerEnhanced(true, confidence, {
          consecutiveCorrect: 1,
          consecutiveIncorrect: 0,
          confidenceScore: 1.5,
        });

        expect(result.consecutiveCorrect).toBe(2);
        expect(result.consecutiveIncorrect).toBe(0);
        expect(result.confidenceScore).toBe(3.0); // 1.5 + 1.5
      });

      it("should reset both on incorrect answer", () => {
        const confidence: AnswerConfidence = {
          responseTimeSeconds: 30,
          hintsUsed: 0,
        };

        const result = processAnswerEnhanced(false, confidence, {
          consecutiveCorrect: 5,
          consecutiveIncorrect: 0,
          confidenceScore: 5.0,
        });

        expect(result.consecutiveCorrect).toBe(0);
        expect(result.consecutiveIncorrect).toBe(1);
        expect(result.confidenceScore).toBe(0);
      });
    });

    describe("CONFIDENCE_CONFIG constants", () => {
      it("should have correct fast response threshold", () => {
        expect(CONFIDENCE_CONFIG.fastResponseThreshold).toBe(15);
      });

      it("should have correct slow response threshold", () => {
        expect(CONFIDENCE_CONFIG.slowResponseThreshold).toBe(45);
      });

      it("should have confident answer bonus of 0.5", () => {
        expect(CONFIDENCE_CONFIG.confidentAnswerBonus).toBe(0.5);
      });
    });

    describe("confidence-weighted simulation", () => {
      it("should upgrade faster with confident answers", () => {
        let state: EnhancedAdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 0,
          confidenceScore: 0,
        };

        const confidentAnswer: AnswerConfidence = {
          responseTimeSeconds: 10,
          hintsUsed: 0,
        };

        // Simulate 2 confident answers (weight 1.5 each = 3.0 total)
        for (let i = 0; i < 2; i++) {
          const processed = processAnswerEnhanced(true, confidentAnswer, {
            consecutiveCorrect: state.consecutiveCorrect,
            consecutiveIncorrect: state.consecutiveIncorrect,
            confidenceScore: state.confidenceScore,
          });

          state = {
            ...state,
            ...processed,
          };

          const result = calculateEnhancedAdaptiveDifficulty(state);
          if (result.didChange) {
            state.currentDifficulty = result.newDifficulty;
            state.confidenceScore = result.newConfidenceScore;
          }
        }

        // After 2 confident answers (3.0 score), should upgrade
        expect(state.currentDifficulty).toBe("medium");
      });

      it("should upgrade slower with uncertain answers", () => {
        let state: EnhancedAdaptiveState = {
          currentDifficulty: "easy",
          consecutiveCorrect: 0,
          consecutiveIncorrect: 0,
          confidenceScore: 0,
        };

        const uncertainAnswer: AnswerConfidence = {
          responseTimeSeconds: 60, // Slow
          hintsUsed: 2, // Used hints
        };

        // Simulate 4 uncertain answers (weight 0.5 each = 2.0 total)
        for (let i = 0; i < 4; i++) {
          const processed = processAnswerEnhanced(true, uncertainAnswer, {
            consecutiveCorrect: state.consecutiveCorrect,
            consecutiveIncorrect: state.consecutiveIncorrect,
            confidenceScore: state.confidenceScore,
          });

          state = {
            ...state,
            ...processed,
          };

          const result = calculateEnhancedAdaptiveDifficulty(state);
          if (result.didChange) {
            state.currentDifficulty = result.newDifficulty;
            state.confidenceScore = result.newConfidenceScore;
          }
        }

        // After 4 uncertain answers (2.0 score), NOT enough to upgrade
        expect(state.currentDifficulty).toBe("easy");

        // Need 2 more to reach 3.0
        for (let i = 0; i < 2; i++) {
          const processed = processAnswerEnhanced(true, uncertainAnswer, {
            consecutiveCorrect: state.consecutiveCorrect,
            consecutiveIncorrect: state.consecutiveIncorrect,
            confidenceScore: state.confidenceScore,
          });

          state = {
            ...state,
            ...processed,
          };

          const result = calculateEnhancedAdaptiveDifficulty(state);
          if (result.didChange) {
            state.currentDifficulty = result.newDifficulty;
            state.confidenceScore = result.newConfidenceScore;
          }
        }

        // After 6 uncertain answers (3.0 score), should upgrade
        expect(state.currentDifficulty).toBe("medium");
      });
    });
  });
});
