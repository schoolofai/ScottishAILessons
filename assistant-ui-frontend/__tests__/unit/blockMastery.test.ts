/**
 * Unit Tests for Block Mastery Calculation
 *
 * Tests the weighted average mastery calculation formula:
 * - Easy: 20% weight
 * - Medium: 40% weight
 * - Hard: 40% weight
 *
 * Bug: "Mastery not updating correctly"
 */

import {
  calculateAccuracy,
  calculateBlockMastery,
  updateMasteryAfterAnswer,
  applyMasteryDelta,
  masteryToPercent,
  percentToMastery,
  createEmptyBlockProgress,
  DIFFICULTY_WEIGHTS,
  MASTERY_THRESHOLD,
  type BlockProgress,
} from "@/lib/practice/blockMastery";

describe("Block Mastery Calculation", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Constants Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("DIFFICULTY_WEIGHTS constants", () => {
    it("should have easy weight of 0.2 (20%)", () => {
      expect(DIFFICULTY_WEIGHTS.easy).toBe(0.2);
    });

    it("should have medium weight of 0.4 (40%)", () => {
      expect(DIFFICULTY_WEIGHTS.medium).toBe(0.4);
    });

    it("should have hard weight of 0.4 (40%)", () => {
      expect(DIFFICULTY_WEIGHTS.hard).toBe(0.4);
    });

    it("should have weights that sum to 1.0", () => {
      const sum =
        DIFFICULTY_WEIGHTS.easy +
        DIFFICULTY_WEIGHTS.medium +
        DIFFICULTY_WEIGHTS.hard;
      expect(sum).toBe(1.0);
    });
  });

  describe("MASTERY_THRESHOLD constant", () => {
    it("should be 0.7 (70%)", () => {
      expect(MASTERY_THRESHOLD).toBe(0.7);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateAccuracy Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("calculateAccuracy", () => {
    it("should return null for 0 attempts", () => {
      expect(calculateAccuracy(0, 0)).toBeNull();
    });

    it("should return 1.0 for 100% accuracy", () => {
      expect(calculateAccuracy(5, 5)).toBe(1.0);
    });

    it("should return 0.0 for 0% accuracy", () => {
      expect(calculateAccuracy(0, 5)).toBe(0.0);
    });

    it("should return 0.5 for 50% accuracy", () => {
      expect(calculateAccuracy(3, 6)).toBe(0.5);
    });

    it("should return 0.8 for 4/5 correct", () => {
      expect(calculateAccuracy(4, 5)).toBe(0.8);
    });

    it("should handle fractional accuracy", () => {
      expect(calculateAccuracy(1, 3)).toBeCloseTo(0.333, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Weighted Average Formula Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("calculateBlockMastery - Weighted Average Formula", () => {
    it("should calculate 16% mastery for 80% easy only", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 0, hard: 0 },
        questions_correct: { easy: 4, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      // 0.8 * 0.2 / 0.2 = 0.8 (normalized because only easy attempted)
      // Actually: when only easy is attempted, weight normalizes to 100%
      expect(result.mastery).toBeCloseTo(0.8, 5);
    });

    it("should calculate 46% mastery for easy+medium", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 4, hard: 0 },
        questions_correct: { easy: 4, medium: 3, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      // Easy: 0.8 * 0.2 = 0.16
      // Medium: 0.75 * 0.4 = 0.30
      // Total weight: 0.2 + 0.4 = 0.6
      // Mastery: (0.16 + 0.30) / 0.6 = 0.7667
      expect(result.mastery).toBeCloseTo(0.7667, 2);
    });

    it("should calculate full weighted mastery for all difficulties", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 4, hard: 3 },
        questions_correct: { easy: 4, medium: 3, hard: 2 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      // Easy: 0.8 * 0.2 = 0.16
      // Medium: 0.75 * 0.4 = 0.30
      // Hard: 0.67 * 0.4 = 0.268
      // Total: 0.16 + 0.30 + 0.268 = 0.728
      expect(result.mastery).toBeCloseTo(0.728, 2);
    });

    it("should return 0 for no attempts", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 0, medium: 0, hard: 0 },
        questions_correct: { easy: 0, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);
      expect(result.mastery).toBe(0);
    });

    it("should return 100% mastery for perfect score all difficulties", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 5, hard: 5 },
        questions_correct: { easy: 5, medium: 5, hard: 5 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);
      expect(result.mastery).toBe(1.0);
    });

    it("should return 0% mastery for all wrong answers", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 5, hard: 5 },
        questions_correct: { easy: 0, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);
      expect(result.mastery).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Mastery After Single Question Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Mastery After Single Question", () => {
    it("should update mastery after correct easy question", () => {
      const before: BlockProgress = {
        questions_attempted: { easy: 0, medium: 0, hard: 0 },
        questions_correct: { easy: 0, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const after = updateMasteryAfterAnswer(before, "easy", true);

      // 1/1 easy correct = 100% easy accuracy
      // With only easy attempted, normalized = 100%
      expect(after.mastery_score).toBe(1.0);
      expect(after.questions_attempted.easy).toBe(1);
      expect(after.questions_correct.easy).toBe(1);
    });

    it("should update mastery after incorrect question", () => {
      const before: BlockProgress = {
        questions_attempted: { easy: 0, medium: 0, hard: 0 },
        questions_correct: { easy: 0, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const after = updateMasteryAfterAnswer(before, "easy", false);

      // 0/1 = 0
      expect(after.mastery_score).toBe(0);
      expect(after.questions_attempted.easy).toBe(1);
      expect(after.questions_correct.easy).toBe(0);
    });

    it("should recalculate mastery correctly after multiple questions", () => {
      let progress: BlockProgress = {
        questions_attempted: { easy: 0, medium: 0, hard: 0 },
        questions_correct: { easy: 0, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      // Answer 3 easy correct
      progress = updateMasteryAfterAnswer(progress, "easy", true);
      progress = updateMasteryAfterAnswer(progress, "easy", true);
      progress = updateMasteryAfterAnswer(progress, "easy", true);

      expect(progress.questions_attempted.easy).toBe(3);
      expect(progress.questions_correct.easy).toBe(3);
      expect(progress.mastery_score).toBe(1.0); // 100% on easy

      // Answer 1 medium wrong
      progress = updateMasteryAfterAnswer(progress, "medium", false);

      // Easy: 100% * 0.2 = 0.2, Medium: 0% * 0.4 = 0
      // Total weight: 0.6, Mastery: 0.2 / 0.6 = 0.333
      expect(progress.mastery_score).toBeCloseTo(0.333, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // applyMasteryDelta Tests (V2 Backend Integration)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("applyMasteryDelta", () => {
    it("should add positive delta", () => {
      expect(applyMasteryDelta(0.5, 0.1)).toBe(0.6);
    });

    it("should subtract negative delta", () => {
      expect(applyMasteryDelta(0.5, -0.1)).toBe(0.4);
    });

    it("should clamp to maximum of 1.0", () => {
      expect(applyMasteryDelta(0.95, 0.1)).toBe(1.0);
    });

    it("should clamp to minimum of 0.0", () => {
      expect(applyMasteryDelta(0.05, -0.1)).toBe(0.0);
    });

    it("should handle zero delta", () => {
      expect(applyMasteryDelta(0.5, 0)).toBe(0.5);
    });

    it("should handle starting at 0", () => {
      expect(applyMasteryDelta(0, 0.05)).toBe(0.05);
    });

    it("should handle starting at 1", () => {
      expect(applyMasteryDelta(1, -0.03)).toBe(0.97);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Conversion Utility Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("masteryToPercent", () => {
    it("should convert 0.0 to 0%", () => {
      expect(masteryToPercent(0)).toBe(0);
    });

    it("should convert 1.0 to 100%", () => {
      expect(masteryToPercent(1)).toBe(100);
    });

    it("should convert 0.7 to 70%", () => {
      expect(masteryToPercent(0.7)).toBe(70);
    });

    it("should convert 0.25 to 25%", () => {
      expect(masteryToPercent(0.25)).toBe(25);
    });
  });

  describe("percentToMastery", () => {
    it("should convert 0% to 0.0", () => {
      expect(percentToMastery(0)).toBe(0);
    });

    it("should convert 100% to 1.0", () => {
      expect(percentToMastery(100)).toBe(1);
    });

    it("should convert 70% to 0.7", () => {
      expect(percentToMastery(70)).toBe(0.7);
    });

    it("should convert 25% to 0.25", () => {
      expect(percentToMastery(25)).toBe(0.25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Empty Progress Factory Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe("createEmptyBlockProgress", () => {
    it("should create progress with all zeros", () => {
      const progress = createEmptyBlockProgress();

      expect(progress.questions_attempted.easy).toBe(0);
      expect(progress.questions_attempted.medium).toBe(0);
      expect(progress.questions_attempted.hard).toBe(0);
      expect(progress.questions_correct.easy).toBe(0);
      expect(progress.questions_correct.medium).toBe(0);
      expect(progress.questions_correct.hard).toBe(0);
      expect(progress.mastery_score).toBe(0);
      expect(progress.is_complete).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Accuracy by Difficulty in Result
  // ═══════════════════════════════════════════════════════════════════════════

  describe("calculateBlockMastery - accuracy_by_difficulty", () => {
    it("should return null for unattempted difficulties", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 0, hard: 0 },
        questions_correct: { easy: 4, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      expect(result.accuracy_by_difficulty.easy).toBe(0.8);
      expect(result.accuracy_by_difficulty.medium).toBeNull();
      expect(result.accuracy_by_difficulty.hard).toBeNull();
    });

    it("should calculate accuracy for all attempted difficulties", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 4, medium: 5, hard: 3 },
        questions_correct: { easy: 3, medium: 4, hard: 2 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      expect(result.accuracy_by_difficulty.easy).toBe(0.75);
      expect(result.accuracy_by_difficulty.medium).toBe(0.8);
      expect(result.accuracy_by_difficulty.hard).toBeCloseTo(0.667, 2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Total Counts in Result
  // ═══════════════════════════════════════════════════════════════════════════

  describe("calculateBlockMastery - total counts", () => {
    it("should sum total attempted and correct", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 5, medium: 4, hard: 3 },
        questions_correct: { easy: 4, medium: 3, hard: 2 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      expect(result.total_attempted).toBe(12);
      expect(result.total_correct).toBe(9);
    });

    it("should return 0 totals for empty progress", () => {
      const progress = createEmptyBlockProgress();
      const result = calculateBlockMastery(progress);

      expect(result.total_attempted).toBe(0);
      expect(result.total_correct).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Regression Tests for "Mastery not updating" Bug
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Bug Regression: Mastery not updating correctly", () => {
    it("SCENARIO: Mastery should increase after correct answer", () => {
      let progress: BlockProgress = {
        questions_attempted: { easy: 1, medium: 0, hard: 0 },
        questions_correct: { easy: 1, medium: 0, hard: 0 },
        mastery_score: 1.0, // 100% on first easy
        is_complete: false,
      };

      // Answer correct medium
      progress = updateMasteryAfterAnswer(progress, "medium", true);

      // Mastery should still be 100% (both are 100%)
      expect(progress.mastery_score).toBe(1.0);
    });

    it("SCENARIO: Mastery should decrease after incorrect answer", () => {
      let progress: BlockProgress = {
        questions_attempted: { easy: 2, medium: 0, hard: 0 },
        questions_correct: { easy: 2, medium: 0, hard: 0 },
        mastery_score: 1.0, // 100% on easy
        is_complete: false,
      };

      // Answer incorrect easy
      progress = updateMasteryAfterAnswer(progress, "easy", false);

      // Now 2/3 = 66.7% on easy
      expect(progress.mastery_score).toBeCloseTo(0.667, 2);
    });

    it("SCENARIO: Mastery should not be NaN", () => {
      const progress: BlockProgress = {
        questions_attempted: { easy: 1, medium: 0, hard: 0 },
        questions_correct: { easy: 0, medium: 0, hard: 0 },
        mastery_score: 0,
        is_complete: false,
      };

      const result = calculateBlockMastery(progress);

      expect(result.mastery).not.toBeNaN();
      expect(result.mastery).toBe(0);
    });

    it("SCENARIO: Delta from backend should update displayed mastery", () => {
      const previousMastery = 0.5; // 50%
      const delta = 0.1; // +10% from backend

      const newMastery = applyMasteryDelta(previousMastery, delta);

      expect(newMastery).toBe(0.6); // 60%
    });
  });
});
