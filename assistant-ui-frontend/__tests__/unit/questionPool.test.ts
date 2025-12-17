/**
 * Question Pool Tests for Practice Wizard V2
 *
 * These tests verify question pool management and repetition prevention:
 * - Shown question ID tracking
 * - Pool exhaustion handling
 * - Cross-difficulty persistence
 * - Cross-block persistence
 *
 * Bug being tested: "Questions intermittently loop and repeat"
 */

import {
  isQuestionShown,
  addToShownIds,
  getAvailableQuestions,
  selectRandomQuestion,
  resetShownIds,
  isPoolExhausted,
  getPoolStatus,
  shouldAutoDowngrade,
  getEffectiveDifficulty,
  shouldResetShownIds,
  validateUniqueQuestion,
  detectRepeats,
  type QuestionSelectionResult,
  type PoolStatus,
} from "@/lib/practice/questionPool";

import type { DifficultyLevel } from "@/types/practice-wizard-contracts";

// ═══════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const SAMPLE_QUESTIONS = ["q1", "q2", "q3", "q4", "q5"];
const SMALL_POOL = ["q1", "q2"];
const SINGLE_QUESTION = ["q1"];
const EMPTY_POOL: string[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// isQuestionShown() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("isQuestionShown()", () => {
  it("should return true if question is in shown list", () => {
    const shownIds = ["q1", "q2", "q3"];
    expect(isQuestionShown("q2", shownIds)).toBe(true);
  });

  it("should return false if question is not in shown list", () => {
    const shownIds = ["q1", "q2", "q3"];
    expect(isQuestionShown("q5", shownIds)).toBe(false);
  });

  it("should return false for empty shown list", () => {
    expect(isQuestionShown("q1", [])).toBe(false);
  });

  it("should handle first question in list", () => {
    const shownIds = ["q1", "q2", "q3"];
    expect(isQuestionShown("q1", shownIds)).toBe(true);
  });

  it("should handle last question in list", () => {
    const shownIds = ["q1", "q2", "q3"];
    expect(isQuestionShown("q3", shownIds)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// addToShownIds() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("addToShownIds()", () => {
  it("should add question to empty list", () => {
    const result = addToShownIds("q1", []);
    expect(result).toEqual(["q1"]);
  });

  it("should add question to existing list", () => {
    const result = addToShownIds("q3", ["q1", "q2"]);
    expect(result).toEqual(["q1", "q2", "q3"]);
  });

  it("should not duplicate if question already exists", () => {
    const result = addToShownIds("q2", ["q1", "q2", "q3"]);
    expect(result).toEqual(["q1", "q2", "q3"]);
  });

  it("should not mutate original array", () => {
    const original = ["q1", "q2"];
    addToShownIds("q3", original);
    expect(original).toEqual(["q1", "q2"]);
  });

  it("should preserve order", () => {
    const result = addToShownIds("q4", ["q1", "q2", "q3"]);
    expect(result).toEqual(["q1", "q2", "q3", "q4"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAvailableQuestions() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getAvailableQuestions()", () => {
  it("should return all questions when none shown", () => {
    const result = getAvailableQuestions(SAMPLE_QUESTIONS, []);
    expect(result).toEqual(SAMPLE_QUESTIONS);
  });

  it("should exclude shown questions", () => {
    const result = getAvailableQuestions(SAMPLE_QUESTIONS, ["q2", "q4"]);
    expect(result).toEqual(["q1", "q3", "q5"]);
  });

  it("should return empty array when all shown", () => {
    const result = getAvailableQuestions(SAMPLE_QUESTIONS, SAMPLE_QUESTIONS);
    expect(result).toEqual([]);
  });

  it("should handle empty pool", () => {
    const result = getAvailableQuestions([], ["q1"]);
    expect(result).toEqual([]);
  });

  it("should ignore shown IDs not in pool", () => {
    const result = getAvailableQuestions(SAMPLE_QUESTIONS, ["q1", "q99"]);
    expect(result).toEqual(["q2", "q3", "q4", "q5"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// selectRandomQuestion() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("selectRandomQuestion()", () => {
  describe("Normal Selection", () => {
    it("should select a question from available pool", () => {
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, []);
      expect(SAMPLE_QUESTIONS).toContain(result.question_id);
    });

    it("should not select already shown question", () => {
      const shownIds = ["q1", "q2", "q3"];
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, shownIds);
      expect(result.question_id).not.toBeNull();
      expect(shownIds).not.toContain(result.question_id);
    });

    it("should add selected question to shown IDs", () => {
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, ["q1"]);
      expect(result.updated_shown_ids).toContain(result.question_id);
      expect(result.updated_shown_ids).toContain("q1");
    });

    it("should report correct pool remaining", () => {
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, ["q1", "q2"]);
      // 5 total - 2 shown - 1 just selected = 2 remaining
      expect(result.pool_remaining).toBe(2);
    });

    it("should not reset pool when questions available", () => {
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, ["q1"]);
      expect(result.pool_reset).toBe(false);
    });
  });

  describe("Pool Exhaustion", () => {
    it("should reset pool when exhausted", () => {
      const allButOne = ["q1", "q2", "q3", "q4"];
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, allButOne);

      // Should select q5 (only available), not reset yet
      expect(result.question_id).toBe("q5");
      expect(result.pool_reset).toBe(false);

      // Now try with all shown
      const result2 = selectRandomQuestion(SAMPLE_QUESTIONS, SAMPLE_QUESTIONS);
      expect(result2.pool_reset).toBe(true);
      expect(SAMPLE_QUESTIONS).toContain(result2.question_id);
    });

    it("should reset shown IDs to only new question on exhaustion", () => {
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, SAMPLE_QUESTIONS);
      expect(result.updated_shown_ids).toHaveLength(1);
      expect(result.updated_shown_ids[0]).toBe(result.question_id);
    });

    it("should report full pool remaining after reset", () => {
      const result = selectRandomQuestion(SAMPLE_QUESTIONS, SAMPLE_QUESTIONS);
      // After reset, pool has all questions minus the one just selected
      expect(result.pool_remaining).toBe(SAMPLE_QUESTIONS.length - 1);
    });
  });

  describe("Edge Cases", () => {
    it("should return null for empty pool", () => {
      const result = selectRandomQuestion(EMPTY_POOL, []);
      expect(result.question_id).toBeNull();
      expect(result.pool_remaining).toBe(0);
      expect(result.pool_reset).toBe(false);
    });

    it("should handle single question pool", () => {
      const result = selectRandomQuestion(SINGLE_QUESTION, []);
      expect(result.question_id).toBe("q1");
      expect(result.pool_remaining).toBe(0);
    });

    it("should reset correctly for single question pool exhaustion", () => {
      const result = selectRandomQuestion(SINGLE_QUESTION, ["q1"]);
      expect(result.question_id).toBe("q1");
      expect(result.pool_reset).toBe(true);
      expect(result.updated_shown_ids).toEqual(["q1"]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// resetShownIds() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("resetShownIds()", () => {
  it("should return empty array", () => {
    expect(resetShownIds()).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isPoolExhausted() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("isPoolExhausted()", () => {
  it("should return false when questions available", () => {
    expect(isPoolExhausted(SAMPLE_QUESTIONS, ["q1"])).toBe(false);
  });

  it("should return true when all shown", () => {
    expect(isPoolExhausted(SAMPLE_QUESTIONS, SAMPLE_QUESTIONS)).toBe(true);
  });

  it("should return false for empty shown list", () => {
    expect(isPoolExhausted(SAMPLE_QUESTIONS, [])).toBe(false);
  });

  it("should return true for empty pool", () => {
    expect(isPoolExhausted(EMPTY_POOL, [])).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getPoolStatus() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getPoolStatus()", () => {
  it("should report correct stats for fresh pool", () => {
    const status = getPoolStatus(SAMPLE_QUESTIONS, []);
    expect(status.total).toBe(5);
    expect(status.available).toBe(5);
    expect(status.shown).toBe(0);
  });

  it("should report correct stats for partially used pool", () => {
    const status = getPoolStatus(SAMPLE_QUESTIONS, ["q1", "q3"]);
    expect(status.total).toBe(5);
    expect(status.available).toBe(3);
    expect(status.shown).toBe(2);
  });

  it("should report correct stats for exhausted pool", () => {
    const status = getPoolStatus(SAMPLE_QUESTIONS, SAMPLE_QUESTIONS);
    expect(status.total).toBe(5);
    expect(status.available).toBe(0);
    expect(status.shown).toBe(5);
  });

  it("should ignore shown IDs not in pool", () => {
    const status = getPoolStatus(SAMPLE_QUESTIONS, ["q1", "q99", "q100"]);
    expect(status.shown).toBe(1); // Only q1 is in pool
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// shouldAutoDowngrade() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("shouldAutoDowngrade()", () => {
  it("should return true when pool size < minimum", () => {
    expect(shouldAutoDowngrade(1)).toBe(true);
    expect(shouldAutoDowngrade(0)).toBe(true);
  });

  it("should return false when pool size >= minimum", () => {
    expect(shouldAutoDowngrade(2)).toBe(false);
    expect(shouldAutoDowngrade(5)).toBe(false);
  });

  it("should respect custom minimum", () => {
    expect(shouldAutoDowngrade(3, 5)).toBe(true);
    expect(shouldAutoDowngrade(5, 5)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getEffectiveDifficulty() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getEffectiveDifficulty()", () => {
  it("should return requested difficulty when pool is sufficient", () => {
    const poolSizes = { easy: 5, medium: 5, hard: 5 };
    expect(getEffectiveDifficulty("hard", poolSizes)).toBe("hard");
    expect(getEffectiveDifficulty("medium", poolSizes)).toBe("medium");
    expect(getEffectiveDifficulty("easy", poolSizes)).toBe("easy");
  });

  it("should downgrade from hard to medium when hard pool empty", () => {
    const poolSizes = { easy: 5, medium: 5, hard: 0 };
    expect(getEffectiveDifficulty("hard", poolSizes)).toBe("medium");
  });

  it("should downgrade from hard to easy when hard and medium empty", () => {
    const poolSizes = { easy: 5, medium: 0, hard: 0 };
    expect(getEffectiveDifficulty("hard", poolSizes)).toBe("easy");
  });

  it("should downgrade from medium to easy when medium pool empty", () => {
    const poolSizes = { easy: 5, medium: 0, hard: 5 };
    expect(getEffectiveDifficulty("medium", poolSizes)).toBe("easy");
  });

  it("should fall back to easy even if small pool", () => {
    const poolSizes = { easy: 1, medium: 0, hard: 0 };
    expect(getEffectiveDifficulty("hard", poolSizes)).toBe("easy");
  });

  it("should respect custom minimum pool size", () => {
    const poolSizes = { easy: 5, medium: 3, hard: 3 };
    expect(getEffectiveDifficulty("hard", poolSizes, 5)).toBe("easy");
    expect(getEffectiveDifficulty("hard", poolSizes, 2)).toBe("hard");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// shouldResetShownIds() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("shouldResetShownIds()", () => {
  it("should NOT reset on difficulty change", () => {
    expect(shouldResetShownIds("difficulty_change")).toBe(false);
  });

  it("should NOT reset on block change", () => {
    expect(shouldResetShownIds("block_change")).toBe(false);
  });

  it("should reset on session start", () => {
    expect(shouldResetShownIds("session_start")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// validateUniqueQuestion() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("validateUniqueQuestion()", () => {
  it("should not throw for unique question", () => {
    expect(() => {
      validateUniqueQuestion("q5", ["q1", "q2", "q3"]);
    }).not.toThrow();
  });

  it("should throw for duplicate question", () => {
    expect(() => {
      validateUniqueQuestion("q2", ["q1", "q2", "q3"]);
    }).toThrow(/already shown/);
  });

  it("should not throw for empty shown list", () => {
    expect(() => {
      validateUniqueQuestion("q1", []);
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// detectRepeats() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("detectRepeats()", () => {
  it("should return false for unique sequence", () => {
    expect(detectRepeats(["q1", "q2", "q3", "q4", "q5"])).toBe(false);
  });

  it("should return true for sequence with duplicates", () => {
    expect(detectRepeats(["q1", "q2", "q3", "q1", "q4"])).toBe(true);
  });

  it("should only check last N questions", () => {
    // Duplicate is outside window
    expect(detectRepeats(["q1", "q2", "q3", "q4", "q5", "q6"], 5)).toBe(false);
    // Duplicate is inside window
    expect(detectRepeats(["q1", "q2", "q3", "q4", "q3", "q5"], 5)).toBe(true);
  });

  it("should return false for empty array", () => {
    expect(detectRepeats([])).toBe(false);
  });

  it("should return false for single element", () => {
    expect(detectRepeats(["q1"])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bug Scenario Tests: "Questions Loop and Repeat"
// ═══════════════════════════════════════════════════════════════════════════

describe("Bug Scenario: Questions Loop and Repeat", () => {
  /**
   * These tests verify scenarios that could cause the bug where
   * questions repeat unexpectedly.
   */

  it("BUG: Shown IDs must persist across difficulty changes", () => {
    // Start with some shown IDs
    let shownIds = ["q1", "q2"];

    // Simulate difficulty change (easy -> medium)
    if (shouldResetShownIds("difficulty_change")) {
      shownIds = resetShownIds();
    }

    // Shown IDs should NOT be reset
    expect(shownIds).toContain("q1");
    expect(shownIds).toContain("q2");
  });

  it("BUG: Shown IDs must persist across block changes", () => {
    let shownIds = ["q1", "q2", "q3"];

    // Simulate block change (block 1 -> block 2)
    if (shouldResetShownIds("block_change")) {
      shownIds = resetShownIds();
    }

    // Shown IDs should NOT be reset
    expect(shownIds).toEqual(["q1", "q2", "q3"]);
  });

  it("BUG: Next question selection should exclude shown IDs", () => {
    const allQuestions = ["q1", "q2", "q3", "q4", "q5"];
    const shownIds = ["q1", "q2"];

    // Get next question
    const result = selectRandomQuestion(allQuestions, shownIds);

    // Should NOT be q1 or q2
    expect(["q1", "q2"]).not.toContain(result.question_id);
    expect(["q3", "q4", "q5"]).toContain(result.question_id);
  });

  it("BUG: Pool exhaustion should be detected before showing duplicate", () => {
    const questions = ["q1", "q2", "q3"];
    let shownIds: string[] = [];

    // Show all questions
    for (let i = 0; i < 3; i++) {
      const result = selectRandomQuestion(questions, shownIds);
      shownIds = result.updated_shown_ids;
    }

    // All should be shown now
    expect(isPoolExhausted(questions, shownIds)).toBe(true);

    // Next selection should reset and indicate pool_reset
    const result = selectRandomQuestion(questions, shownIds);
    expect(result.pool_reset).toBe(true);
  });

  it("BUG: Consecutive selections should never repeat", () => {
    const questions = ["q1", "q2", "q3", "q4", "q5"];
    let shownIds: string[] = [];
    const selections: string[] = [];

    // Select 5 questions consecutively
    for (let i = 0; i < 5; i++) {
      const result = selectRandomQuestion(questions, shownIds);
      shownIds = result.updated_shown_ids;
      if (result.question_id) {
        selections.push(result.question_id);
      }
    }

    // All 5 should be unique
    const uniqueSelections = new Set(selections);
    expect(uniqueSelections.size).toBe(5);
  });

  it("BUG: detectRepeats should catch improper reset", () => {
    // Simulates bug where shown IDs are cleared incorrectly
    const recentQuestions = ["q1", "q2", "q3", "q1", "q4"]; // q1 repeated!

    expect(detectRepeats(recentQuestions)).toBe(true);
  });

  it("SCENARIO: Small pool with auto-downgrade", () => {
    // If hard pool is too small, should downgrade to medium
    const poolSizes = { easy: 5, medium: 5, hard: 1 };

    const effectiveDifficulty = getEffectiveDifficulty("hard", poolSizes);
    expect(effectiveDifficulty).toBe("medium");
  });

  it("SCENARIO: Empty difficulty pool triggers downgrade chain", () => {
    const poolSizes = { easy: 3, medium: 0, hard: 0 };

    expect(getEffectiveDifficulty("hard", poolSizes)).toBe("easy");
    expect(getEffectiveDifficulty("medium", poolSizes)).toBe("easy");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration Scenario Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Question Pool Integration Scenarios", () => {
  it("SCENARIO: Full session flow - 10 questions across difficulties", () => {
    // Simulate a practice session
    const easyQuestions = ["e1", "e2", "e3"];
    const mediumQuestions = ["m1", "m2", "m3"];
    const hardQuestions = ["h1", "h2"];

    let shownIds: string[] = [];
    const questionsAsked: string[] = [];

    // Answer 3 easy questions
    for (let i = 0; i < 3; i++) {
      const result = selectRandomQuestion(easyQuestions, shownIds);
      if (result.question_id) {
        shownIds = result.updated_shown_ids;
        questionsAsked.push(result.question_id);
      }
    }

    // Difficulty changes to medium - shown IDs persist
    expect(shouldResetShownIds("difficulty_change")).toBe(false);

    // Answer 3 medium questions
    for (let i = 0; i < 3; i++) {
      const result = selectRandomQuestion(mediumQuestions, shownIds);
      if (result.question_id) {
        shownIds = result.updated_shown_ids;
        questionsAsked.push(result.question_id);
      }
    }

    // Difficulty changes to hard - shown IDs persist
    expect(shouldResetShownIds("difficulty_change")).toBe(false);

    // Answer 2 hard questions
    for (let i = 0; i < 2; i++) {
      const result = selectRandomQuestion(hardQuestions, shownIds);
      if (result.question_id) {
        shownIds = result.updated_shown_ids;
        questionsAsked.push(result.question_id);
      }
    }

    // All 8 questions should be unique
    const unique = new Set(questionsAsked);
    expect(unique.size).toBe(8);

    // No repeats detected
    expect(detectRepeats(questionsAsked)).toBe(false);
  });

  it("SCENARIO: Block change - shown IDs persist", () => {
    let shownIds = ["q1", "q2", "q3"];

    // Complete block 1
    // Block change to block 2
    if (shouldResetShownIds("block_change")) {
      shownIds = resetShownIds();
    }

    // Should still have all shown IDs
    expect(shownIds).toContain("q1");
    expect(shownIds).toContain("q2");
    expect(shownIds).toContain("q3");
  });

  it("SCENARIO: New session - shown IDs reset", () => {
    let shownIds = ["q1", "q2", "q3", "q4", "q5"];

    // Start new session
    if (shouldResetShownIds("session_start")) {
      shownIds = resetShownIds();
    }

    // Should be empty for fresh session
    expect(shownIds).toEqual([]);
  });

  it("SCENARIO: Pool exhaustion mid-block", () => {
    const smallPool = ["q1", "q2"];
    let shownIds: string[] = [];
    let poolResetOccurred = false;

    // Answer 3 questions from pool of 2
    for (let i = 0; i < 3; i++) {
      const result = selectRandomQuestion(smallPool, shownIds);
      shownIds = result.updated_shown_ids;
      if (result.pool_reset) {
        poolResetOccurred = true;
      }
    }

    // Pool reset should have occurred
    expect(poolResetOccurred).toBe(true);
  });
});
