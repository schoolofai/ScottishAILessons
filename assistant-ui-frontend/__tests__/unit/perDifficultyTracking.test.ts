/**
 * TDD Tests: Per-Difficulty Question Tracking
 *
 * BUG REPORT:
 * - Error: Questions repeat when switching between difficulties
 * - Occurs when: Hard pool exhausts, user downgrades to medium, then upgrades back to hard
 * - Root cause: Single shownQuestionIdsRef shared across all difficulties
 *
 * ROOT CAUSE ANALYSIS:
 * 1. shownQuestionIdsRef was a single array: [q1_hard, q2_hard, q3_hard, q4_medium, q5_medium]
 * 2. When fetching hard question, excludeIds includes medium IDs
 * 3. Hard pool [q1, q2, q3] filtered against [q1, q2, q3, q4, q5] - all excluded
 * 4. Pool reset happens, showing q1 again
 *
 * FIX:
 * - Per-difficulty tracking with correct/incorrect split
 * - Retry incorrect questions when pool exhausts (pedagogically sound)
 * - Auto-downgrade when all questions correct but mastery not met
 */

import type { DifficultyLevel } from "@/types/practice-wizard-contracts";

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS: Per-Difficulty Question Tracking
// These mirror the logic in useLangGraphWizard.ts for testing
// ═══════════════════════════════════════════════════════════════════════════

type QuestionTrackingByDifficulty = {
  [K in DifficultyLevel]: {
    correct: string[];
    incorrect: string[];
  };
};

/**
 * Create initial tracking state
 */
export function createInitialTracking(): QuestionTrackingByDifficulty {
  return {
    easy: { correct: [], incorrect: [] },
    medium: { correct: [], incorrect: [] },
    hard: { correct: [], incorrect: [] },
  };
}

/**
 * Track a question result (correct or incorrect)
 */
export function trackQuestionResult(
  tracking: QuestionTrackingByDifficulty,
  difficulty: DifficultyLevel,
  questionId: string,
  isCorrect: boolean
): QuestionTrackingByDifficulty {
  const newTracking = JSON.parse(JSON.stringify(tracking)) as QuestionTrackingByDifficulty;
  const difficultyTracking = newTracking[difficulty];

  if (isCorrect) {
    // Move from incorrect to correct (if retry) or add to correct
    difficultyTracking.incorrect = difficultyTracking.incorrect.filter(id => id !== questionId);
    if (!difficultyTracking.correct.includes(questionId)) {
      difficultyTracking.correct.push(questionId);
    }
  } else {
    // Add to incorrect (for retry) if not already correct
    if (!difficultyTracking.correct.includes(questionId) && !difficultyTracking.incorrect.includes(questionId)) {
      difficultyTracking.incorrect.push(questionId);
    }
  }

  return newTracking;
}

/**
 * Get exclude IDs for fetching fresh questions (exclude all seen)
 */
export function getExcludeAllIds(
  tracking: QuestionTrackingByDifficulty,
  difficulty: DifficultyLevel
): string[] {
  const difficultyTracking = tracking[difficulty];
  return [...difficultyTracking.correct, ...difficultyTracking.incorrect];
}

/**
 * Get exclude IDs for retry mode (only exclude correct)
 */
export function getExcludeCorrectOnlyIds(
  tracking: QuestionTrackingByDifficulty,
  difficulty: DifficultyLevel
): string[] {
  return tracking[difficulty].correct;
}

/**
 * Check if retry pool has questions
 */
export function hasRetryQuestions(
  tracking: QuestionTrackingByDifficulty,
  difficulty: DifficultyLevel
): boolean {
  return tracking[difficulty].incorrect.length > 0;
}

/**
 * Remove question from incorrect pool (after retry)
 */
export function removeFromIncorrect(
  tracking: QuestionTrackingByDifficulty,
  difficulty: DifficultyLevel,
  questionId: string
): QuestionTrackingByDifficulty {
  const newTracking = JSON.parse(JSON.stringify(tracking)) as QuestionTrackingByDifficulty;
  newTracking[difficulty].incorrect = newTracking[difficulty].incorrect.filter(id => id !== questionId);
  return newTracking;
}

/**
 * Decision for what to do when pool exhausts
 */
export type PoolExhaustionDecision =
  | { type: "retry"; questionIds: string[] }
  | { type: "downgrade"; toDifficulty: DifficultyLevel }
  | { type: "allow_reset" }; // At easy, all correct

/**
 * Decide what to do when question pool exhausts
 */
export function getPoolExhaustionDecision(
  tracking: QuestionTrackingByDifficulty,
  currentDifficulty: DifficultyLevel
): PoolExhaustionDecision {
  const difficultyTracking = tracking[currentDifficulty];

  // First: try retry pool
  if (difficultyTracking.incorrect.length > 0) {
    return { type: "retry", questionIds: difficultyTracking.incorrect };
  }

  // Second: try downgrade
  const downgradeMap: Record<DifficultyLevel, DifficultyLevel | null> = {
    hard: "medium",
    medium: "easy",
    easy: null,
  };

  const lowerDifficulty = downgradeMap[currentDifficulty];
  if (lowerDifficulty) {
    return { type: "downgrade", toDifficulty: lowerDifficulty };
  }

  // Third: allow pool reset (at easy, all correct)
  return { type: "allow_reset" };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 1: Question Tracking Basics
// ═══════════════════════════════════════════════════════════════════════════

describe("Per-Difficulty Question Tracking", () => {
  describe("Initial state", () => {
    it("creates empty tracking for all difficulties", () => {
      const tracking = createInitialTracking();

      expect(tracking.easy.correct).toEqual([]);
      expect(tracking.easy.incorrect).toEqual([]);
      expect(tracking.medium.correct).toEqual([]);
      expect(tracking.medium.incorrect).toEqual([]);
      expect(tracking.hard.correct).toEqual([]);
      expect(tracking.hard.incorrect).toEqual([]);
    });
  });

  describe("trackQuestionResult", () => {
    it("adds correct answer to correct pool", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);

      expect(tracking.hard.correct).toContain("q1_hard");
      expect(tracking.hard.incorrect).not.toContain("q1_hard");
    });

    it("adds incorrect answer to incorrect pool", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);

      expect(tracking.hard.incorrect).toContain("q1_hard");
      expect(tracking.hard.correct).not.toContain("q1_hard");
    });

    it("moves question from incorrect to correct on retry success", () => {
      let tracking = createInitialTracking();

      // First attempt: incorrect
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);
      expect(tracking.hard.incorrect).toContain("q1_hard");

      // Retry: correct
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      expect(tracking.hard.correct).toContain("q1_hard");
      expect(tracking.hard.incorrect).not.toContain("q1_hard");
    });

    it("does not duplicate correct answers", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);

      expect(tracking.hard.correct.filter(id => id === "q1_hard").length).toBe(1);
    });

    it("tracks different difficulties independently", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      tracking = trackQuestionResult(tracking, "medium", "q1_medium", false);
      tracking = trackQuestionResult(tracking, "easy", "q1_easy", true);

      expect(tracking.hard.correct).toEqual(["q1_hard"]);
      expect(tracking.medium.incorrect).toEqual(["q1_medium"]);
      expect(tracking.easy.correct).toEqual(["q1_easy"]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 2: Exclude ID Generation
// ═══════════════════════════════════════════════════════════════════════════

describe("Exclude ID Generation", () => {
  describe("getExcludeAllIds", () => {
    it("excludes both correct and incorrect for fresh questions", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);
      tracking = trackQuestionResult(tracking, "hard", "q3_hard", true);

      const excludeIds = getExcludeAllIds(tracking, "hard");

      expect(excludeIds).toContain("q1_hard");
      expect(excludeIds).toContain("q2_hard");
      expect(excludeIds).toContain("q3_hard");
      expect(excludeIds.length).toBe(3);
    });

    it("only returns IDs for requested difficulty", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      tracking = trackQuestionResult(tracking, "medium", "q1_medium", true);

      const hardExclude = getExcludeAllIds(tracking, "hard");
      const mediumExclude = getExcludeAllIds(tracking, "medium");

      expect(hardExclude).toEqual(["q1_hard"]);
      expect(mediumExclude).toEqual(["q1_medium"]);
    });
  });

  describe("getExcludeCorrectOnlyIds (for retry mode)", () => {
    it("only excludes correct answers for retry", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);

      const excludeIds = getExcludeCorrectOnlyIds(tracking, "hard");

      expect(excludeIds).toContain("q1_hard");
      expect(excludeIds).not.toContain("q2_hard");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 3: Pool Exhaustion Decisions
// ═══════════════════════════════════════════════════════════════════════════

describe("Pool Exhaustion Decisions", () => {
  describe("hasRetryQuestions", () => {
    it("returns true when incorrect questions exist", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);

      expect(hasRetryQuestions(tracking, "hard")).toBe(true);
    });

    it("returns false when no incorrect questions", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);

      expect(hasRetryQuestions(tracking, "hard")).toBe(false);
    });
  });

  describe("getPoolExhaustionDecision", () => {
    it("returns retry when incorrect questions exist", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);
      tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);

      const decision = getPoolExhaustionDecision(tracking, "hard");

      expect(decision.type).toBe("retry");
      if (decision.type === "retry") {
        expect(decision.questionIds).toContain("q1_hard");
        expect(decision.questionIds).toContain("q2_hard");
      }
    });

    it("returns downgrade when all hard questions correct", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
      tracking = trackQuestionResult(tracking, "hard", "q2_hard", true);

      const decision = getPoolExhaustionDecision(tracking, "hard");

      expect(decision.type).toBe("downgrade");
      if (decision.type === "downgrade") {
        expect(decision.toDifficulty).toBe("medium");
      }
    });

    it("returns downgrade to easy when all medium questions correct", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "medium", "q1_medium", true);

      const decision = getPoolExhaustionDecision(tracking, "medium");

      expect(decision.type).toBe("downgrade");
      if (decision.type === "downgrade") {
        expect(decision.toDifficulty).toBe("easy");
      }
    });

    it("returns allow_reset when at easy and all correct", () => {
      let tracking = createInitialTracking();
      tracking = trackQuestionResult(tracking, "easy", "q1_easy", true);
      tracking = trackQuestionResult(tracking, "easy", "q2_easy", true);

      const decision = getPoolExhaustionDecision(tracking, "easy");

      expect(decision.type).toBe("allow_reset");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 4: The Original Bug Scenario
// ═══════════════════════════════════════════════════════════════════════════

describe("Original Bug Scenario: Cross-Difficulty ID Collision", () => {
  /**
   * This test reproduces the original bug where:
   * 1. User answers hard questions q1, q2, q3
   * 2. User downgrades to medium and answers q4, q5
   * 3. User upgrades back to hard
   * 4. OLD BUG: q1, q2, q3 shown again because excludeIds = [q1, q2, q3, q4, q5]
   *    and hard pool [q1, q2, q3] wasn't properly filtered
   * 5. FIX: Per-difficulty tracking keeps hard and medium separate
   */
  it("FIXED: per-difficulty tracking prevents cross-contamination", () => {
    let tracking = createInitialTracking();

    // User at HARD, answers 3 questions
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
    tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);
    tracking = trackQuestionResult(tracking, "hard", "q3_hard", true);

    // User downgrades to MEDIUM, answers 2 questions
    tracking = trackQuestionResult(tracking, "medium", "q4_medium", true);
    tracking = trackQuestionResult(tracking, "medium", "q5_medium", true);

    // User upgrades back to HARD
    // Get exclude IDs for hard - should ONLY contain hard question IDs
    const hardExcludeIds = getExcludeAllIds(tracking, "hard");

    // FIXED: Only hard IDs in the list, no medium contamination
    expect(hardExcludeIds).toContain("q1_hard");
    expect(hardExcludeIds).toContain("q2_hard");
    expect(hardExcludeIds).toContain("q3_hard");
    expect(hardExcludeIds).not.toContain("q4_medium");
    expect(hardExcludeIds).not.toContain("q5_medium");
    expect(hardExcludeIds.length).toBe(3);
  });

  it("FIXED: retry pool is difficulty-specific", () => {
    let tracking = createInitialTracking();

    // User gets q2_hard wrong at hard level
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
    tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);
    tracking = trackQuestionResult(tracking, "hard", "q3_hard", true);

    // User also gets q1_medium wrong at medium level
    tracking = trackQuestionResult(tracking, "medium", "q1_medium", false);

    // Hard retry pool should only contain hard questions
    const hardDecision = getPoolExhaustionDecision(tracking, "hard");
    expect(hardDecision.type).toBe("retry");
    if (hardDecision.type === "retry") {
      expect(hardDecision.questionIds).toEqual(["q2_hard"]);
      expect(hardDecision.questionIds).not.toContain("q1_medium");
    }

    // Medium retry pool should only contain medium questions
    const mediumDecision = getPoolExhaustionDecision(tracking, "medium");
    expect(mediumDecision.type).toBe("retry");
    if (mediumDecision.type === "retry") {
      expect(mediumDecision.questionIds).toEqual(["q1_medium"]);
      expect(mediumDecision.questionIds).not.toContain("q2_hard");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 5: Retry Flow
// ═══════════════════════════════════════════════════════════════════════════

describe("Retry Question Flow", () => {
  it("removes question from incorrect pool after retry attempt", () => {
    let tracking = createInitialTracking();
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);
    tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);

    // Remove q1_hard from retry pool (it's being shown now)
    tracking = removeFromIncorrect(tracking, "hard", "q1_hard");

    expect(tracking.hard.incorrect).not.toContain("q1_hard");
    expect(tracking.hard.incorrect).toContain("q2_hard");
  });

  it("tracks retry result correctly (still incorrect)", () => {
    let tracking = createInitialTracking();

    // First attempt: incorrect
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);

    // Remove from incorrect (being retried)
    tracking = removeFromIncorrect(tracking, "hard", "q1_hard");
    expect(tracking.hard.incorrect).not.toContain("q1_hard");

    // Retry: still incorrect - goes back to incorrect pool
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);
    expect(tracking.hard.incorrect).toContain("q1_hard");
  });

  it("tracks retry result correctly (now correct)", () => {
    let tracking = createInitialTracking();

    // First attempt: incorrect
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", false);

    // Remove from incorrect (being retried)
    tracking = removeFromIncorrect(tracking, "hard", "q1_hard");

    // Retry: now correct - goes to correct pool
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
    expect(tracking.hard.correct).toContain("q1_hard");
    expect(tracking.hard.incorrect).not.toContain("q1_hard");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 6: Auto-Downgrade Chain
// ═══════════════════════════════════════════════════════════════════════════

describe("Auto-Downgrade Chain", () => {
  it("downgrades hard → medium → easy when all correct", () => {
    let tracking = createInitialTracking();

    // All hard correct
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
    tracking = trackQuestionResult(tracking, "hard", "q2_hard", true);

    // Decision at hard: downgrade to medium
    const hardDecision = getPoolExhaustionDecision(tracking, "hard");
    expect(hardDecision.type).toBe("downgrade");
    if (hardDecision.type === "downgrade") {
      expect(hardDecision.toDifficulty).toBe("medium");
    }

    // All medium correct
    tracking = trackQuestionResult(tracking, "medium", "q1_medium", true);

    // Decision at medium: downgrade to easy
    const mediumDecision = getPoolExhaustionDecision(tracking, "medium");
    expect(mediumDecision.type).toBe("downgrade");
    if (mediumDecision.type === "downgrade") {
      expect(mediumDecision.toDifficulty).toBe("easy");
    }

    // All easy correct
    tracking = trackQuestionResult(tracking, "easy", "q1_easy", true);

    // Decision at easy: allow reset (nowhere to go)
    const easyDecision = getPoolExhaustionDecision(tracking, "easy");
    expect(easyDecision.type).toBe("allow_reset");
  });

  it("prefers retry over downgrade", () => {
    let tracking = createInitialTracking();

    // Mix of correct and incorrect at hard
    tracking = trackQuestionResult(tracking, "hard", "q1_hard", true);
    tracking = trackQuestionResult(tracking, "hard", "q2_hard", false);

    // Decision should be retry, not downgrade
    const decision = getPoolExhaustionDecision(tracking, "hard");
    expect(decision.type).toBe("retry");
    if (decision.type === "retry") {
      expect(decision.questionIds).toEqual(["q2_hard"]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 7: Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe("Edge Cases", () => {
  it("handles empty tracking gracefully", () => {
    const tracking = createInitialTracking();

    const hardExclude = getExcludeAllIds(tracking, "hard");
    expect(hardExclude).toEqual([]);

    const hasRetry = hasRetryQuestions(tracking, "hard");
    expect(hasRetry).toBe(false);

    // At hard with no questions answered, downgrade to medium
    const decision = getPoolExhaustionDecision(tracking, "hard");
    expect(decision.type).toBe("downgrade");
  });

  it("handles single question at easy correctly", () => {
    let tracking = createInitialTracking();
    tracking = trackQuestionResult(tracking, "easy", "only_q", true);

    const decision = getPoolExhaustionDecision(tracking, "easy");
    expect(decision.type).toBe("allow_reset");
  });

  it("handles question answered multiple times incorrectly", () => {
    let tracking = createInitialTracking();

    // First attempt: incorrect
    tracking = trackQuestionResult(tracking, "hard", "q1", false);
    expect(tracking.hard.incorrect.length).toBe(1);

    // User sees it again (retry) but tracking was cleared
    // Second attempt via retry: still incorrect
    tracking = trackQuestionResult(tracking, "hard", "q1", false);
    // Should still only have one entry (no duplicates)
    expect(tracking.hard.incorrect.length).toBe(1);
    expect(tracking.hard.incorrect).toEqual(["q1"]);
  });
});
