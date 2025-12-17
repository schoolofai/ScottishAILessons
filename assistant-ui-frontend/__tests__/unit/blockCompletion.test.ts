/**
 * Block Completion Tests for Practice Wizard V2
 *
 * These tests verify block completion criteria:
 * 1. Mastery score >= 70% (MASTERY_THRESHOLD)
 * 2. At least 2 hard questions ATTEMPTED (not necessarily correct)
 * 3. OR: Student manually requested advance (override)
 *
 * CRITICAL: The criteria is hard questions ATTEMPTED, not CORRECT.
 * This prevents students from being stuck indefinitely on hard questions.
 *
 * Bug being tested: "User stuck in first block"
 */

import {
  isBlockComplete,
  checkBlockCompletion,
  shouldAllowAdvance,
  markManualAdvance,
  markBlockComplete,
  getCompletionProgress,
  getBlockStatusMessage,
  MASTERY_THRESHOLD,
  HARD_QUESTIONS_REQUIRED,
  type BlockCompletionResult,
  type CompletionReason,
} from "@/lib/practice/blockCompletion";

import {
  type BlockProgress,
  createEmptyBlockProgress,
} from "@/lib/practice/blockMastery";

// ═══════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a BlockProgress with customizable values
 */
function createBlockProgress(overrides: Partial<BlockProgress> = {}): BlockProgress {
  return {
    questions_attempted: { easy: 0, medium: 0, hard: 0 },
    questions_correct: { easy: 0, medium: 0, hard: 0 },
    mastery_score: 0,
    is_complete: false,
    ...overrides,
    questions_attempted: {
      easy: 0,
      medium: 0,
      hard: 0,
      ...overrides.questions_attempted,
    },
    questions_correct: {
      easy: 0,
      medium: 0,
      hard: 0,
      ...overrides.questions_correct,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Block Completion Constants", () => {
  it("should have MASTERY_THRESHOLD of 0.7 (70%)", () => {
    expect(MASTERY_THRESHOLD).toBe(0.7);
  });

  it("should require 2 hard questions", () => {
    expect(HARD_QUESTIONS_REQUIRED).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isBlockComplete() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("isBlockComplete()", () => {
  describe("Standard Completion Criteria", () => {
    it("should return true when mastery >= 70% AND hard attempted >= 2", () => {
      const progress = createBlockProgress({
        mastery_score: 0.70,
        questions_attempted: { easy: 5, medium: 4, hard: 2 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should return true with exactly threshold values", () => {
      const progress = createBlockProgress({
        mastery_score: 0.70,
        questions_attempted: { easy: 0, medium: 0, hard: 2 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should return true with values exceeding threshold", () => {
      const progress = createBlockProgress({
        mastery_score: 0.85,
        questions_attempted: { easy: 5, medium: 5, hard: 5 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should return false when mastery < 70%", () => {
      const progress = createBlockProgress({
        mastery_score: 0.69,
        questions_attempted: { easy: 5, medium: 5, hard: 3 },
      });
      expect(isBlockComplete(progress)).toBe(false);
    });

    it("should return false when hard attempted < 2", () => {
      const progress = createBlockProgress({
        mastery_score: 0.80,
        questions_attempted: { easy: 5, medium: 5, hard: 1 },
      });
      expect(isBlockComplete(progress)).toBe(false);
    });

    it("should return false when both criteria unmet", () => {
      const progress = createBlockProgress({
        mastery_score: 0.50,
        questions_attempted: { easy: 3, medium: 2, hard: 0 },
      });
      expect(isBlockComplete(progress)).toBe(false);
    });
  });

  describe("Manual Advance Override", () => {
    it("should return true when student_requested_advance is true (regardless of mastery)", () => {
      const progress = createBlockProgress({
        mastery_score: 0.30,
        questions_attempted: { easy: 2, medium: 0, hard: 0 },
        student_requested_advance: true,
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should return true with manual advance even at 0% mastery", () => {
      const progress = createBlockProgress({
        mastery_score: 0,
        questions_attempted: { easy: 1, medium: 0, hard: 0 },
        student_requested_advance: true,
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should return true with manual advance and no hard questions", () => {
      const progress = createBlockProgress({
        mastery_score: 0.50,
        questions_attempted: { easy: 5, medium: 3, hard: 0 },
        student_requested_advance: true,
      });
      expect(isBlockComplete(progress)).toBe(true);
    });
  });

  describe("Hard Questions ATTEMPTED (Not CORRECT)", () => {
    /**
     * CRITICAL: Block completion requires hard questions ATTEMPTED,
     * not necessarily CORRECT. This is intentional to prevent students
     * from being stuck indefinitely if they can't answer hard questions.
     */

    it("should complete with 2 hard attempted but 0 correct", () => {
      const progress = createBlockProgress({
        mastery_score: 0.72,
        questions_attempted: { easy: 5, medium: 4, hard: 2 },
        questions_correct: { easy: 5, medium: 4, hard: 0 }, // 0 hard correct!
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should complete with 2 hard attempted and 1 correct", () => {
      const progress = createBlockProgress({
        mastery_score: 0.72,
        questions_attempted: { easy: 5, medium: 4, hard: 2 },
        questions_correct: { easy: 5, medium: 4, hard: 1 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should complete with 2 hard attempted and 2 correct", () => {
      const progress = createBlockProgress({
        mastery_score: 0.72,
        questions_attempted: { easy: 5, medium: 4, hard: 2 },
        questions_correct: { easy: 5, medium: 4, hard: 2 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });
  });

  describe("Mastery Threshold Boundary Tests", () => {
    it("should NOT complete at 69.9% mastery", () => {
      const progress = createBlockProgress({
        mastery_score: 0.699,
        questions_attempted: { easy: 5, medium: 5, hard: 2 },
      });
      expect(isBlockComplete(progress)).toBe(false);
    });

    it("should complete at exactly 70% mastery", () => {
      const progress = createBlockProgress({
        mastery_score: 0.70,
        questions_attempted: { easy: 5, medium: 5, hard: 2 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should complete at 70.1% mastery", () => {
      const progress = createBlockProgress({
        mastery_score: 0.701,
        questions_attempted: { easy: 5, medium: 5, hard: 2 },
      });
      expect(isBlockComplete(progress)).toBe(true);
    });

    it("should NOT complete at 100% mastery with only 1 hard", () => {
      const progress = createBlockProgress({
        mastery_score: 1.0,
        questions_attempted: { easy: 5, medium: 5, hard: 1 },
      });
      expect(isBlockComplete(progress)).toBe(false);
    });

    it("should NOT complete at 50% mastery even with 10 hard questions", () => {
      const progress = createBlockProgress({
        mastery_score: 0.50,
        questions_attempted: { easy: 5, medium: 5, hard: 10 },
      });
      expect(isBlockComplete(progress)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// checkBlockCompletion() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("checkBlockCompletion()", () => {
  describe("Complete Status", () => {
    it("should return criteria_met when both thresholds exceeded", () => {
      const progress = createBlockProgress({
        mastery_score: 0.75,
        questions_attempted: { easy: 5, medium: 4, hard: 3 },
      });

      const result = checkBlockCompletion(progress);

      expect(result.is_complete).toBe(true);
      expect(result.reason).toBe("criteria_met");
      expect(result.mastery_score).toBe(0.75);
      expect(result.hard_questions_attempted).toBe(3);
      expect(result.manual_advance).toBe(false);
      expect(result.requirements_remaining).toBeUndefined();
    });

    it("should return manual_advance when student requested skip", () => {
      const progress = createBlockProgress({
        mastery_score: 0.40,
        questions_attempted: { easy: 3, medium: 1, hard: 0 },
        student_requested_advance: true,
      });

      const result = checkBlockCompletion(progress);

      expect(result.is_complete).toBe(true);
      expect(result.reason).toBe("manual_advance");
      expect(result.manual_advance).toBe(true);
    });
  });

  describe("Incomplete Status with Requirements", () => {
    it("should return mastery_insufficient when only mastery is missing", () => {
      const progress = createBlockProgress({
        mastery_score: 0.55,
        questions_attempted: { easy: 5, medium: 4, hard: 2 },
      });

      const result = checkBlockCompletion(progress);

      expect(result.is_complete).toBe(false);
      expect(result.reason).toBe("mastery_insufficient");
      expect(result.requirements_remaining?.mastery_needed).toBeCloseTo(0.15, 5);
      expect(result.requirements_remaining?.hard_questions_needed).toBeUndefined();
    });

    it("should return hard_questions_insufficient when only hard questions missing", () => {
      const progress = createBlockProgress({
        mastery_score: 0.75,
        questions_attempted: { easy: 5, medium: 4, hard: 1 },
      });

      const result = checkBlockCompletion(progress);

      expect(result.is_complete).toBe(false);
      expect(result.reason).toBe("hard_questions_insufficient");
      expect(result.requirements_remaining?.mastery_needed).toBeUndefined();
      expect(result.requirements_remaining?.hard_questions_needed).toBe(1);
    });

    it("should return both_insufficient when both criteria unmet", () => {
      const progress = createBlockProgress({
        mastery_score: 0.50,
        questions_attempted: { easy: 5, medium: 3, hard: 0 },
      });

      const result = checkBlockCompletion(progress);

      expect(result.is_complete).toBe(false);
      expect(result.reason).toBe("both_insufficient");
      expect(result.requirements_remaining?.mastery_needed).toBeCloseTo(0.20, 5);
      expect(result.requirements_remaining?.hard_questions_needed).toBe(2);
    });
  });

  describe("Requirements Calculation Accuracy", () => {
    it("should calculate exact mastery needed", () => {
      const progress = createBlockProgress({
        mastery_score: 0.62,
        questions_attempted: { easy: 5, medium: 4, hard: 2 },
      });

      const result = checkBlockCompletion(progress);
      expect(result.requirements_remaining?.mastery_needed).toBeCloseTo(0.08, 5);
    });

    it("should calculate exact hard questions needed", () => {
      const progress = createBlockProgress({
        mastery_score: 0.75,
        questions_attempted: { easy: 5, medium: 4, hard: 0 },
      });

      const result = checkBlockCompletion(progress);
      expect(result.requirements_remaining?.hard_questions_needed).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// shouldAllowAdvance() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("shouldAllowAdvance()", () => {
  it("should allow advance when block is complete", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
    });
    expect(shouldAllowAdvance(progress)).toBe(true);
  });

  it("should allow advance when manual advance is enabled (default)", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
      questions_attempted: { easy: 3, medium: 1, hard: 0 },
    });
    // By default, allowManualAdvance is true
    expect(shouldAllowAdvance(progress)).toBe(true);
  });

  it("should NOT allow advance when manual advance is disabled and block incomplete", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
      questions_attempted: { easy: 3, medium: 1, hard: 0 },
    });
    expect(shouldAllowAdvance(progress, false)).toBe(false);
  });

  it("should allow advance when block complete even if manual advance disabled", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
    });
    expect(shouldAllowAdvance(progress, false)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markManualAdvance() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("markManualAdvance()", () => {
  it("should set student_requested_advance to true", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
      questions_attempted: { easy: 3, medium: 1, hard: 0 },
    });

    const updated = markManualAdvance(progress);

    expect(updated.student_requested_advance).toBe(true);
  });

  it("should set is_complete to true", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
      questions_attempted: { easy: 3, medium: 1, hard: 0 },
    });

    const updated = markManualAdvance(progress);

    expect(updated.is_complete).toBe(true);
  });

  it("should set completed_at timestamp", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
    });

    const updated = markManualAdvance(progress);

    expect(updated.completed_at).toBeDefined();
    expect(new Date(updated.completed_at!)).toBeInstanceOf(Date);
  });

  it("should not mutate original progress", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
      is_complete: false,
    });

    markManualAdvance(progress);

    expect(progress.is_complete).toBe(false);
    expect(progress.student_requested_advance).toBeUndefined();
  });

  it("should preserve original mastery score", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
    });

    const updated = markManualAdvance(progress);

    expect(updated.mastery_score).toBe(0.40);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// markBlockComplete() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("markBlockComplete()", () => {
  it("should set is_complete to true", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
    });

    const updated = markBlockComplete(progress);

    expect(updated.is_complete).toBe(true);
  });

  it("should set completed_at timestamp", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
    });

    const updated = markBlockComplete(progress);

    expect(updated.completed_at).toBeDefined();
    expect(new Date(updated.completed_at!)).toBeInstanceOf(Date);
  });

  it("should not mutate original progress", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
      is_complete: false,
    });

    markBlockComplete(progress);

    expect(progress.is_complete).toBe(false);
  });

  it("should NOT set student_requested_advance", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
    });

    const updated = markBlockComplete(progress);

    expect(updated.student_requested_advance).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getCompletionProgress() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getCompletionProgress()", () => {
  it("should return 0 for empty progress", () => {
    const progress = createEmptyBlockProgress();
    expect(getCompletionProgress(progress)).toBe(0);
  });

  it("should return 100 when both criteria fully met", () => {
    const progress = createBlockProgress({
      mastery_score: 0.70, // Meets threshold exactly
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
    });
    expect(getCompletionProgress(progress)).toBe(100);
  });

  it("should cap at 100 even when exceeding thresholds", () => {
    const progress = createBlockProgress({
      mastery_score: 0.90,
      questions_attempted: { easy: 5, medium: 5, hard: 5 },
    });
    expect(getCompletionProgress(progress)).toBe(100);
  });

  it("should calculate correct progress for mastery only", () => {
    const progress = createBlockProgress({
      mastery_score: 0.35, // 50% of threshold
      questions_attempted: { easy: 3, medium: 2, hard: 0 },
    });
    // Mastery contributes 70%: 0.5 * 0.7 = 0.35
    // Hard contributes 30%: 0 * 0.3 = 0
    // Total: 35%
    expect(getCompletionProgress(progress)).toBe(35);
  });

  it("should calculate correct progress for hard questions only", () => {
    const progress = createBlockProgress({
      mastery_score: 0,
      questions_attempted: { easy: 0, medium: 0, hard: 2 },
    });
    // Mastery contributes 70%: 0 * 0.7 = 0
    // Hard contributes 30%: 1 * 0.3 = 0.3
    // Total: 30%
    expect(getCompletionProgress(progress)).toBe(30);
  });

  it("should calculate correct composite progress", () => {
    const progress = createBlockProgress({
      mastery_score: 0.35, // 50% of threshold
      questions_attempted: { easy: 5, medium: 3, hard: 1 }, // 50% of hard requirement
    });
    // Mastery: 0.5 * 0.7 = 0.35
    // Hard: 0.5 * 0.3 = 0.15
    // Total: 50%
    expect(getCompletionProgress(progress)).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getBlockStatusMessage() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getBlockStatusMessage()", () => {
  it("should return completion message when complete", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
    });
    expect(getBlockStatusMessage(progress)).toBe("Block complete! Great work!");
  });

  it("should return skip message for manual advance", () => {
    const progress = createBlockProgress({
      mastery_score: 0.40,
      student_requested_advance: true,
    });
    expect(getBlockStatusMessage(progress)).toBe("Block skipped - moving to next");
  });

  it("should return mastery needed message", () => {
    const progress = createBlockProgress({
      mastery_score: 0.55,
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
    });
    const message = getBlockStatusMessage(progress);
    expect(message).toContain("Need");
    expect(message).toContain("mastery");
  });

  it("should return hard questions needed message", () => {
    const progress = createBlockProgress({
      mastery_score: 0.75,
      questions_attempted: { easy: 5, medium: 4, hard: 0 },
    });
    const message = getBlockStatusMessage(progress);
    expect(message).toContain("Need");
    expect(message).toContain("hard question");
  });

  it("should return combined message when both needed", () => {
    const progress = createBlockProgress({
      mastery_score: 0.50,
      questions_attempted: { easy: 5, medium: 3, hard: 1 },
    });
    const message = getBlockStatusMessage(progress);
    expect(message).toContain("mastery");
    expect(message).toContain("hard question");
    expect(message).toContain("and");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bug Scenario Tests: "User Stuck in First Block"
// ═══════════════════════════════════════════════════════════════════════════

describe("Bug Scenario: User Stuck in First Block", () => {
  /**
   * These tests verify scenarios that could cause the bug where
   * users get stuck in the first block indefinitely.
   */

  it("SCENARIO: High mastery but no hard questions - should NOT complete", () => {
    const progress = createBlockProgress({
      mastery_score: 0.90,
      questions_attempted: { easy: 5, medium: 5, hard: 0 },
      questions_correct: { easy: 5, medium: 5, hard: 0 },
    });

    expect(isBlockComplete(progress)).toBe(false);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("hard_questions_insufficient");
    expect(result.requirements_remaining?.hard_questions_needed).toBe(2);
  });

  it("SCENARIO: Student fails all hard questions but met mastery - should COMPLETE", () => {
    // This is the key scenario for the bug fix:
    // Student has 70%+ mastery from easy/medium, attempts 2 hard questions but fails both
    // They should STILL complete the block because hard_attempted >= 2
    const progress = createBlockProgress({
      mastery_score: 0.72,
      questions_attempted: { easy: 5, medium: 4, hard: 2 },
      questions_correct: { easy: 5, medium: 4, hard: 0 }, // Both hard wrong!
    });

    expect(isBlockComplete(progress)).toBe(true);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("criteria_met");
  });

  it("SCENARIO: Student stuck at hard difficulty, mastery drops - should NOT complete", () => {
    // Student keeps failing hard questions, mastery drops below 70%
    const progress = createBlockProgress({
      mastery_score: 0.55, // Dropped from failing hard questions
      questions_attempted: { easy: 3, medium: 3, hard: 5 },
      questions_correct: { easy: 3, medium: 3, hard: 0 }, // All hard wrong
    });

    expect(isBlockComplete(progress)).toBe(false);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("mastery_insufficient");
  });

  it("SCENARIO: Just one hard question attempted - should NOT complete", () => {
    const progress = createBlockProgress({
      mastery_score: 0.80,
      questions_attempted: { easy: 5, medium: 4, hard: 1 },
      questions_correct: { easy: 5, medium: 4, hard: 1 },
    });

    expect(isBlockComplete(progress)).toBe(false);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("hard_questions_insufficient");
    expect(result.requirements_remaining?.hard_questions_needed).toBe(1);
  });

  it("SCENARIO: Perfect score but only easy questions - should NOT complete", () => {
    const progress = createBlockProgress({
      mastery_score: 1.0, // 100% on easy only
      questions_attempted: { easy: 10, medium: 0, hard: 0 },
      questions_correct: { easy: 10, medium: 0, hard: 0 },
    });

    expect(isBlockComplete(progress)).toBe(false);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("hard_questions_insufficient");
  });

  it("SCENARIO: All questions wrong but manual advance - should COMPLETE", () => {
    const progress = createBlockProgress({
      mastery_score: 0,
      questions_attempted: { easy: 5, medium: 5, hard: 5 },
      questions_correct: { easy: 0, medium: 0, hard: 0 },
      student_requested_advance: true,
    });

    expect(isBlockComplete(progress)).toBe(true);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("manual_advance");
  });

  it("SCENARIO: Edge case - exactly at thresholds - should COMPLETE", () => {
    const progress = createBlockProgress({
      mastery_score: 0.70, // Exactly 70%
      questions_attempted: { easy: 0, medium: 0, hard: 2 }, // Exactly 2
    });

    expect(isBlockComplete(progress)).toBe(true);
    const result = checkBlockCompletion(progress);
    expect(result.reason).toBe("criteria_met");
  });

  it("SCENARIO: Edge case - one under threshold - should NOT complete", () => {
    const progress = createBlockProgress({
      mastery_score: 0.699, // Just under
      questions_attempted: { easy: 5, medium: 5, hard: 2 },
    });
    expect(isBlockComplete(progress)).toBe(false);

    const progress2 = createBlockProgress({
      mastery_score: 0.70,
      questions_attempted: { easy: 5, medium: 5, hard: 1 }, // Just under
    });
    expect(isBlockComplete(progress2)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Complete Scenario Matrix Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Block Completion Scenario Matrix", () => {
  /**
   * Test all combinations from the plan's scenario matrix
   */

  interface Scenario {
    id: number;
    mastery: number;
    hardAttempted: number;
    hardCorrect: number;
    manualAdvance: boolean;
    expected: boolean;
  }

  const scenarios: Scenario[] = [
    { id: 1, mastery: 0.70, hardAttempted: 2, hardCorrect: 2, manualAdvance: false, expected: true },
    { id: 2, mastery: 0.70, hardAttempted: 2, hardCorrect: 0, manualAdvance: false, expected: true },
    { id: 3, mastery: 0.70, hardAttempted: 1, hardCorrect: 1, manualAdvance: false, expected: false },
    { id: 4, mastery: 0.699, hardAttempted: 2, hardCorrect: 2, manualAdvance: false, expected: false },
    { id: 5, mastery: 1.0, hardAttempted: 1, hardCorrect: 1, manualAdvance: false, expected: false },
    { id: 6, mastery: 0.50, hardAttempted: 10, hardCorrect: 5, manualAdvance: false, expected: false },
    { id: 7, mastery: 0, hardAttempted: 0, hardCorrect: 0, manualAdvance: true, expected: true },
    { id: 8, mastery: 0.50, hardAttempted: 0, hardCorrect: 0, manualAdvance: true, expected: true },
    { id: 9, mastery: 0.80, hardAttempted: 0, hardCorrect: 0, manualAdvance: false, expected: false },
    { id: 10, mastery: 0.701, hardAttempted: 2, hardCorrect: 1, manualAdvance: false, expected: true },
  ];

  scenarios.forEach((scenario) => {
    it(`Scenario ${scenario.id}: mastery=${scenario.mastery * 100}%, hard=${scenario.hardAttempted}, manual=${scenario.manualAdvance} => ${scenario.expected ? "COMPLETE" : "NOT COMPLETE"}`, () => {
      const progress = createBlockProgress({
        mastery_score: scenario.mastery,
        questions_attempted: { easy: 5, medium: 4, hard: scenario.hardAttempted },
        questions_correct: { easy: 5, medium: 4, hard: scenario.hardCorrect },
        student_requested_advance: scenario.manualAdvance,
      });

      expect(isBlockComplete(progress)).toBe(scenario.expected);
    });
  });
});
