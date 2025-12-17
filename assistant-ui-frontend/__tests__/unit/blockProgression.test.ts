/**
 * Block Progression Tests for Practice Wizard V2
 *
 * These tests verify multi-block progression scenarios:
 * - Sequential block completion
 * - Session completion detection
 * - State transitions after block completion
 * - Overall mastery calculation
 *
 * Bug being tested: "User stuck in first block" - block never completes,
 * can't progress to block 2.
 */

import {
  getNextIncompleteBlockIndex,
  isSessionComplete,
  shouldProgressToNextBlock,
  calculateOverallMastery,
  updateCompletedBlocksCount,
  transitionAfterBlockComplete,
  processQuestionCompletion,
  updateCurrentBlockProgress,
  incrementQuestionsAttempted,
  updateProgressAfterAnswer,
  createSessionState,
  getCurrentBlock,
  type SessionState,
  type BlockProgressEntry,
  type ProgressionResult,
} from "@/lib/practice/blockProgression";

import { MASTERY_THRESHOLD, HARD_QUESTIONS_REQUIRED } from "@/lib/practice/blockCompletion";

// ═══════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a BlockProgressEntry with customizable values
 */
function createBlockProgressEntry(
  blockId: string,
  overrides: Partial<BlockProgressEntry> = {}
): BlockProgressEntry {
  return {
    block_id: blockId,
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

/**
 * Create a SessionState with customizable values
 */
function createTestSessionState(
  blockCount: number,
  overrides: Partial<SessionState> = {}
): SessionState {
  const blockIds = Array.from({ length: blockCount }, (_, i) => `block_${i + 1}`);
  const base = createSessionState(blockIds);
  return {
    ...base,
    ...overrides,
    blocks_progress: overrides.blocks_progress || base.blocks_progress,
  };
}

/**
 * Create a complete block progress entry (meets completion criteria)
 */
function createCompleteBlockProgress(
  blockId: string
): BlockProgressEntry {
  return createBlockProgressEntry(blockId, {
    mastery_score: 0.75,
    questions_attempted: { easy: 5, medium: 4, hard: 2 },
    questions_correct: { easy: 4, medium: 3, hard: 1 },
    is_complete: true,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Create an incomplete block progress entry
 */
function createIncompleteBlockProgress(
  blockId: string,
  mastery: number = 0.50,
  hardAttempted: number = 1
): BlockProgressEntry {
  return createBlockProgressEntry(blockId, {
    mastery_score: mastery,
    questions_attempted: { easy: 3, medium: 2, hard: hardAttempted },
    questions_correct: { easy: 2, medium: 1, hard: 0 },
    is_complete: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// createSessionState() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("createSessionState()", () => {
  it("should create session with correct block count", () => {
    const state = createSessionState(["b1", "b2", "b3"]);
    expect(state.total_blocks).toBe(3);
    expect(state.blocks_progress).toHaveLength(3);
  });

  it("should initialize all blocks as incomplete", () => {
    const state = createSessionState(["b1", "b2"]);
    state.blocks_progress.forEach((block) => {
      expect(block.is_complete).toBe(false);
    });
  });

  it("should set correct block IDs", () => {
    const state = createSessionState(["block_a", "block_b"]);
    expect(state.blocks_progress[0].block_id).toBe("block_a");
    expect(state.blocks_progress[1].block_id).toBe("block_b");
  });

  it("should start at block index 0", () => {
    const state = createSessionState(["b1", "b2"]);
    expect(state.current_block_index).toBe(0);
  });

  it("should start with 0 completed blocks", () => {
    const state = createSessionState(["b1", "b2"]);
    expect(state.completed_blocks).toBe(0);
  });

  it("should start with 0 overall mastery", () => {
    const state = createSessionState(["b1", "b2"]);
    expect(state.overall_mastery).toBe(0);
  });

  it("should start session as not complete", () => {
    const state = createSessionState(["b1", "b2"]);
    expect(state.session_complete).toBe(false);
  });

  it("should start in question stage", () => {
    const state = createSessionState(["b1", "b2"]);
    expect(state.stage).toBe("question");
  });

  it("should handle single block lesson", () => {
    const state = createSessionState(["only_block"]);
    expect(state.total_blocks).toBe(1);
    expect(state.blocks_progress).toHaveLength(1);
  });

  it("should initialize block progress with zero counters", () => {
    const state = createSessionState(["b1"]);
    const block = state.blocks_progress[0];
    expect(block.questions_attempted).toEqual({ easy: 0, medium: 0, hard: 0 });
    expect(block.questions_correct).toEqual({ easy: 0, medium: 0, hard: 0 });
    expect(block.mastery_score).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getNextIncompleteBlockIndex() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getNextIncompleteBlockIndex()", () => {
  it("should return 0 when all blocks incomplete", () => {
    const state = createTestSessionState(3);
    expect(getNextIncompleteBlockIndex(state)).toBe(0);
  });

  it("should return 1 when first block complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(getNextIncompleteBlockIndex(state)).toBe(1);
  });

  it("should return 2 when first two blocks complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(getNextIncompleteBlockIndex(state)).toBe(2);
  });

  it("should return -1 when all blocks complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createCompleteBlockProgress("b3"),
      ],
    });
    expect(getNextIncompleteBlockIndex(state)).toBe(-1);
  });

  it("should skip middle complete block", () => {
    // If block 0 is incomplete but block 1 is complete, should return 0
    const state = createTestSessionState(3, {
      blocks_progress: [
        createIncompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(getNextIncompleteBlockIndex(state)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isSessionComplete() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("isSessionComplete()", () => {
  it("should return false when no blocks complete", () => {
    const state = createTestSessionState(3);
    expect(isSessionComplete(state)).toBe(false);
  });

  it("should return false when some blocks complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(isSessionComplete(state)).toBe(false);
  });

  it("should return true when all blocks complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createCompleteBlockProgress("b3"),
      ],
    });
    expect(isSessionComplete(state)).toBe(true);
  });

  it("should return true for single block complete session", () => {
    const state = createTestSessionState(1, {
      blocks_progress: [createCompleteBlockProgress("b1")],
    });
    expect(isSessionComplete(state)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// shouldProgressToNextBlock() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("shouldProgressToNextBlock()", () => {
  it("should return false when current block incomplete", () => {
    const state = createTestSessionState(3, {
      current_block_index: 0,
      blocks_progress: [
        createIncompleteBlockProgress("b1"),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(shouldProgressToNextBlock(state)).toBe(false);
  });

  it("should return true when current block meets completion criteria", () => {
    const state = createTestSessionState(3, {
      current_block_index: 0,
      blocks_progress: [
        createBlockProgressEntry("b1", {
          mastery_score: 0.72,
          questions_attempted: { easy: 5, medium: 4, hard: 2 },
          is_complete: false, // Not marked yet, but meets criteria
        }),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(shouldProgressToNextBlock(state)).toBe(true);
  });

  it("should return true when current block already marked complete", () => {
    const state = createTestSessionState(3, {
      current_block_index: 0,
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    expect(shouldProgressToNextBlock(state)).toBe(true);
  });

  it("should handle last block correctly", () => {
    const state = createTestSessionState(3, {
      current_block_index: 2,
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createBlockProgressEntry("b3", {
          mastery_score: 0.75,
          questions_attempted: { easy: 5, medium: 4, hard: 2 },
        }),
      ],
    });
    expect(shouldProgressToNextBlock(state)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculateOverallMastery() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("calculateOverallMastery()", () => {
  it("should return 0 for empty array", () => {
    expect(calculateOverallMastery([])).toBe(0);
  });

  it("should return single block mastery for one block", () => {
    const blocks = [createBlockProgressEntry("b1", { mastery_score: 0.75 })];
    expect(calculateOverallMastery(blocks)).toBe(0.75);
  });

  it("should average mastery across multiple blocks", () => {
    const blocks = [
      createBlockProgressEntry("b1", { mastery_score: 0.80 }),
      createBlockProgressEntry("b2", { mastery_score: 0.60 }),
    ];
    expect(calculateOverallMastery(blocks)).toBe(0.70);
  });

  it("should handle blocks with 0 mastery", () => {
    const blocks = [
      createBlockProgressEntry("b1", { mastery_score: 0.90 }),
      createBlockProgressEntry("b2", { mastery_score: 0 }),
    ];
    expect(calculateOverallMastery(blocks)).toBe(0.45);
  });

  it("should handle multiple blocks evenly", () => {
    const blocks = [
      createBlockProgressEntry("b1", { mastery_score: 0.60 }),
      createBlockProgressEntry("b2", { mastery_score: 0.70 }),
      createBlockProgressEntry("b3", { mastery_score: 0.80 }),
    ];
    expect(calculateOverallMastery(blocks)).toBeCloseTo(0.70, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateCompletedBlocksCount() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("updateCompletedBlocksCount()", () => {
  it("should count 0 when no blocks complete", () => {
    const state = createTestSessionState(3);
    const updated = updateCompletedBlocksCount(state);
    expect(updated.completed_blocks).toBe(0);
  });

  it("should count correctly when some blocks complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });
    const updated = updateCompletedBlocksCount(state);
    expect(updated.completed_blocks).toBe(1);
  });

  it("should count all when all blocks complete", () => {
    const state = createTestSessionState(3, {
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createCompleteBlockProgress("b3"),
      ],
    });
    const updated = updateCompletedBlocksCount(state);
    expect(updated.completed_blocks).toBe(3);
  });

  it("should not mutate original state", () => {
    const state = createTestSessionState(3, { completed_blocks: 0 });
    updateCompletedBlocksCount(state);
    expect(state.completed_blocks).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// transitionAfterBlockComplete() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("transitionAfterBlockComplete()", () => {
  it("should move to next block when available", () => {
    const state = createTestSessionState(3, {
      current_block_index: 0,
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });

    const updated = transitionAfterBlockComplete(state);

    expect(updated.current_block_index).toBe(1);
    expect(updated.session_complete).toBe(false);
    expect(updated.stage).toBe("question");
  });

  it("should mark session complete when all blocks done", () => {
    const state = createTestSessionState(3, {
      current_block_index: 2,
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createCompleteBlockProgress("b3"),
      ],
    });

    const updated = transitionAfterBlockComplete(state);

    expect(updated.session_complete).toBe(true);
    expect(updated.stage).toBe("complete");
    expect(updated.completed_blocks).toBe(3);
  });

  it("should update overall mastery on transition", () => {
    const state = createTestSessionState(2, {
      current_block_index: 0,
      blocks_progress: [
        createBlockProgressEntry("b1", { mastery_score: 0.80, is_complete: true }),
        createBlockProgressEntry("b2", { mastery_score: 0.60, is_complete: false }),
      ],
    });

    const updated = transitionAfterBlockComplete(state);

    expect(updated.overall_mastery).toBe(0.70);
  });

  it("should update completed_blocks count", () => {
    const state = createTestSessionState(3, {
      current_block_index: 1,
      completed_blocks: 0, // Incorrect value
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createCompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });

    const updated = transitionAfterBlockComplete(state);

    expect(updated.completed_blocks).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// processQuestionCompletion() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("processQuestionCompletion()", () => {
  it("should not progress when block incomplete", () => {
    const state = createTestSessionState(3, {
      current_block_index: 0,
      blocks_progress: [
        createIncompleteBlockProgress("b1"),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });

    const result = processQuestionCompletion(state);

    expect(result.should_progress).toBe(false);
    expect(result.new_block_index).toBeNull();
    expect(result.session_complete).toBe(false);
  });

  it("should progress when block meets criteria", () => {
    const state = createTestSessionState(3, {
      current_block_index: 0,
      blocks_progress: [
        createBlockProgressEntry("b1", {
          mastery_score: 0.72,
          questions_attempted: { easy: 5, medium: 4, hard: 2 },
        }),
        createIncompleteBlockProgress("b2"),
        createIncompleteBlockProgress("b3"),
      ],
    });

    const result = processQuestionCompletion(state);

    expect(result.should_progress).toBe(true);
    expect(result.new_block_index).toBe(1);
    expect(result.session_complete).toBe(false);
    expect(result.updated_state.blocks_progress[0].is_complete).toBe(true);
    expect(result.updated_state.blocks_progress[0].completed_at).toBeDefined();
  });

  it("should complete session when last block completes", () => {
    const state = createTestSessionState(2, {
      current_block_index: 1,
      blocks_progress: [
        createCompleteBlockProgress("b1"),
        createBlockProgressEntry("b2", {
          mastery_score: 0.75,
          questions_attempted: { easy: 5, medium: 4, hard: 2 },
        }),
      ],
    });

    const result = processQuestionCompletion(state);

    expect(result.should_progress).toBe(false);
    expect(result.new_block_index).toBeNull();
    expect(result.session_complete).toBe(true);
    expect(result.updated_state.stage).toBe("complete");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateCurrentBlockProgress() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("updateCurrentBlockProgress()", () => {
  it("should update mastery score", () => {
    const state = createTestSessionState(2, { current_block_index: 0 });
    const updated = updateCurrentBlockProgress(state, { mastery_score: 0.65 });
    expect(updated.blocks_progress[0].mastery_score).toBe(0.65);
  });

  it("should update overall mastery", () => {
    const state = createTestSessionState(2, {
      current_block_index: 0,
      blocks_progress: [
        createBlockProgressEntry("b1", { mastery_score: 0.50 }),
        createBlockProgressEntry("b2", { mastery_score: 0.70 }),
      ],
    });

    const updated = updateCurrentBlockProgress(state, { mastery_score: 0.90 });

    expect(updated.overall_mastery).toBe(0.80); // (0.90 + 0.70) / 2
  });

  it("should not mutate original state", () => {
    const state = createTestSessionState(2);
    updateCurrentBlockProgress(state, { mastery_score: 0.50 });
    expect(state.blocks_progress[0].mastery_score).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// incrementQuestionsAttempted() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("incrementQuestionsAttempted()", () => {
  it("should increment easy count", () => {
    const state = createTestSessionState(1);
    const updated = incrementQuestionsAttempted(state, "easy");
    expect(updated.blocks_progress[0].questions_attempted.easy).toBe(1);
  });

  it("should increment medium count", () => {
    const state = createTestSessionState(1);
    const updated = incrementQuestionsAttempted(state, "medium");
    expect(updated.blocks_progress[0].questions_attempted.medium).toBe(1);
  });

  it("should increment hard count", () => {
    const state = createTestSessionState(1);
    const updated = incrementQuestionsAttempted(state, "hard");
    expect(updated.blocks_progress[0].questions_attempted.hard).toBe(1);
  });

  it("should preserve other difficulty counts", () => {
    const state = createTestSessionState(1, {
      blocks_progress: [
        createBlockProgressEntry("b1", {
          questions_attempted: { easy: 3, medium: 2, hard: 1 },
        }),
      ],
    });

    const updated = incrementQuestionsAttempted(state, "medium");

    expect(updated.blocks_progress[0].questions_attempted.easy).toBe(3);
    expect(updated.blocks_progress[0].questions_attempted.medium).toBe(3);
    expect(updated.blocks_progress[0].questions_attempted.hard).toBe(1);
  });

  it("should increment on current block only", () => {
    const state = createTestSessionState(2, {
      current_block_index: 1,
      blocks_progress: [
        createBlockProgressEntry("b1", {
          questions_attempted: { easy: 5, medium: 0, hard: 0 },
        }),
        createBlockProgressEntry("b2", {
          questions_attempted: { easy: 0, medium: 0, hard: 0 },
        }),
      ],
    });

    const updated = incrementQuestionsAttempted(state, "easy");

    expect(updated.blocks_progress[0].questions_attempted.easy).toBe(5);
    expect(updated.blocks_progress[1].questions_attempted.easy).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateProgressAfterAnswer() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("updateProgressAfterAnswer()", () => {
  it("should increment attempted and correct for correct answer", () => {
    const state = createTestSessionState(1);
    const updated = updateProgressAfterAnswer(state, "easy", true);

    expect(updated.blocks_progress[0].questions_attempted.easy).toBe(1);
    expect(updated.blocks_progress[0].questions_correct.easy).toBe(1);
  });

  it("should increment only attempted for incorrect answer", () => {
    const state = createTestSessionState(1);
    const updated = updateProgressAfterAnswer(state, "easy", false);

    expect(updated.blocks_progress[0].questions_attempted.easy).toBe(1);
    expect(updated.blocks_progress[0].questions_correct.easy).toBe(0);
  });

  it("should recalculate mastery after answer", () => {
    const state = createTestSessionState(1);

    // Answer 1 easy correct: 1/1 = 100%, mastery = 100% (only easy weight counts)
    const updated = updateProgressAfterAnswer(state, "easy", true);
    expect(updated.blocks_progress[0].mastery_score).toBe(1.0); // 100% on easy
  });

  it("should calculate weighted mastery across difficulties", () => {
    const state = createTestSessionState(1, {
      blocks_progress: [
        createBlockProgressEntry("b1", {
          questions_attempted: { easy: 4, medium: 3, hard: 0 },
          questions_correct: { easy: 4, medium: 2, hard: 0 },
        }),
      ],
    });

    // Add 1 medium correct: now easy=4/4, medium=3/4
    const updated = updateProgressAfterAnswer(state, "medium", true);

    // Easy: 4/4 = 1.0, weight 0.2
    // Medium: 3/4 = 0.75, weight 0.4
    // Total weight: 0.6
    // Weighted: (1.0 * 0.2 + 0.75 * 0.4) / 0.6 = 0.5 / 0.6 = 0.833...
    expect(updated.blocks_progress[0].mastery_score).toBeCloseTo(0.833, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getCurrentBlock() Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("getCurrentBlock()", () => {
  it("should return first block at index 0", () => {
    const state = createTestSessionState(3, { current_block_index: 0 });
    const block = getCurrentBlock(state);
    expect(block?.block_id).toBe("block_1");
  });

  it("should return correct block at any index", () => {
    const state = createTestSessionState(3, { current_block_index: 2 });
    const block = getCurrentBlock(state);
    expect(block?.block_id).toBe("block_3");
  });

  it("should return undefined for out of bounds index", () => {
    const state = createTestSessionState(3, { current_block_index: 5 });
    const block = getCurrentBlock(state);
    expect(block).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Multi-Block Progression Scenarios
// ═══════════════════════════════════════════════════════════════════════════

describe("Multi-Block Progression Scenarios", () => {
  describe("Standard Two-Block Flow", () => {
    it("SCENARIO: New session -> Block 1 -> Complete -> Block 2 -> Complete -> Session Done", () => {
      // Start fresh session
      let state = createSessionState(["b1", "b2"]);
      expect(state.current_block_index).toBe(0);
      expect(state.session_complete).toBe(false);

      // Simulate completing block 1
      state = {
        ...state,
        blocks_progress: [
          createBlockProgressEntry("b1", {
            mastery_score: 0.75,
            questions_attempted: { easy: 5, medium: 4, hard: 2 },
            questions_correct: { easy: 4, medium: 3, hard: 1 },
          }),
          state.blocks_progress[1],
        ],
      };

      // Process completion
      let result = processQuestionCompletion(state);
      expect(result.should_progress).toBe(true);
      expect(result.new_block_index).toBe(1);
      state = result.updated_state;

      // Verify block 1 is marked complete
      expect(state.blocks_progress[0].is_complete).toBe(true);
      expect(state.current_block_index).toBe(1);

      // Simulate completing block 2
      state = {
        ...state,
        blocks_progress: [
          state.blocks_progress[0],
          createBlockProgressEntry("b2", {
            mastery_score: 0.72,
            questions_attempted: { easy: 5, medium: 4, hard: 2 },
            questions_correct: { easy: 4, medium: 3, hard: 1 },
          }),
        ],
      };

      // Process completion
      result = processQuestionCompletion(state);
      expect(result.session_complete).toBe(true);
      expect(result.should_progress).toBe(false);
      expect(result.updated_state.stage).toBe("complete");
    });
  });

  describe("Single Block Lesson", () => {
    it("SCENARIO: Single block complete = Session complete", () => {
      const state = createTestSessionState(1, {
        blocks_progress: [
          createBlockProgressEntry("only_block", {
            mastery_score: 0.75,
            questions_attempted: { easy: 5, medium: 4, hard: 2 },
          }),
        ],
      });

      const result = processQuestionCompletion(state);

      expect(result.session_complete).toBe(true);
      expect(result.updated_state.stage).toBe("complete");
    });
  });

  describe("Manual Advance Scenarios", () => {
    it("SCENARIO: Skip block 1 via manual advance -> Progress to block 2", () => {
      const state = createTestSessionState(2, {
        blocks_progress: [
          createBlockProgressEntry("b1", {
            mastery_score: 0.30,
            questions_attempted: { easy: 3, medium: 0, hard: 0 },
            student_requested_advance: true,
          }),
          createIncompleteBlockProgress("b2"),
        ],
      });

      const result = processQuestionCompletion(state);

      expect(result.should_progress).toBe(true);
      expect(result.new_block_index).toBe(1);
    });
  });

  describe("Difficulty Reset on Block Change", () => {
    it("SCENARIO: Block 2 difficulty starts at easy (NOT carried over from block 1)", () => {
      // This tests the expectation that when moving to a new block,
      // difficulty should reset to easy
      const state = createTestSessionState(2, {
        current_block_index: 1, // Just moved to block 2
        blocks_progress: [
          createCompleteBlockProgress("b1"),
          createBlockProgressEntry("b2", { mastery_score: 0 }), // Fresh start
        ],
      });

      // The new block should start fresh with no questions attempted
      const currentBlock = getCurrentBlock(state);
      expect(currentBlock?.questions_attempted.easy).toBe(0);
      expect(currentBlock?.questions_attempted.medium).toBe(0);
      expect(currentBlock?.questions_attempted.hard).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bug Scenario Tests: "User Stuck in First Block"
// ═══════════════════════════════════════════════════════════════════════════

describe("Bug Scenario: User Stuck in First Block", () => {
  it("BUG: Block shows complete but next block doesn't load", () => {
    // After block completion, verify transition happens
    const state = createTestSessionState(2, {
      current_block_index: 0,
      stage: "question",
      blocks_progress: [
        createBlockProgressEntry("b1", {
          mastery_score: 0.75,
          questions_attempted: { easy: 5, medium: 4, hard: 2 },
          is_complete: true,
        }),
        createIncompleteBlockProgress("b2"),
      ],
    });

    const result = transitionAfterBlockComplete(state);

    expect(result.current_block_index).toBe(1);
    expect(result.blocks_progress[1].block_id).toBe("b2");
  });

  it("BUG: Hard question count not incrementing", () => {
    // This tests that hard questions are properly counted
    let state = createTestSessionState(1, {
      blocks_progress: [
        createBlockProgressEntry("b1", {
          questions_attempted: { easy: 5, medium: 5, hard: 0 },
          mastery_score: 0.75,
        }),
      ],
    });

    // Answer a hard question
    state = incrementQuestionsAttempted(state, "hard");
    expect(state.blocks_progress[0].questions_attempted.hard).toBe(1);

    // Answer another hard question
    state = incrementQuestionsAttempted(state, "hard");
    expect(state.blocks_progress[0].questions_attempted.hard).toBe(2);

    // Now block should be complete (70%+ mastery AND 2 hard attempted)
    expect(shouldProgressToNextBlock(state)).toBe(true);
  });

  it("BUG: Mastery not updating after answer", () => {
    // Verify mastery updates after each question
    let state = createTestSessionState(1);

    // Answer 1 easy question correctly
    state = updateProgressAfterAnswer(state, "easy", true);
    expect(state.blocks_progress[0].mastery_score).toBe(1.0); // 1/1 on easy
    expect(state.blocks_progress[0].questions_attempted.easy).toBe(1);
    expect(state.blocks_progress[0].questions_correct.easy).toBe(1);
  });

  it("BUG: Block never completes despite meeting criteria", () => {
    // Create state that meets criteria but isn't marked complete
    const state = createTestSessionState(1, {
      blocks_progress: [
        createBlockProgressEntry("b1", {
          mastery_score: 0.72,
          questions_attempted: { easy: 5, medium: 4, hard: 2 },
          questions_correct: { easy: 4, medium: 3, hard: 1 },
          is_complete: false, // Not yet marked
        }),
      ],
    });

    // Should detect that block is complete
    expect(shouldProgressToNextBlock(state)).toBe(true);

    // Process should mark it complete
    const result = processQuestionCompletion(state);
    expect(result.updated_state.blocks_progress[0].is_complete).toBe(true);
    expect(result.updated_state.blocks_progress[0].completed_at).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe("Edge Cases", () => {
  it("should handle empty blocks array gracefully", () => {
    const state: SessionState = {
      current_block_index: 0,
      total_blocks: 0,
      blocks_progress: [],
      completed_blocks: 0,
      overall_mastery: 0,
      session_complete: false,
      stage: "question",
    };

    expect(isSessionComplete(state)).toBe(true); // All (none) are complete
    expect(getNextIncompleteBlockIndex(state)).toBe(-1);
    expect(calculateOverallMastery(state.blocks_progress)).toBe(0);
  });

  it("should handle many blocks (5+)", () => {
    const blockIds = ["b1", "b2", "b3", "b4", "b5"];
    const state = createSessionState(blockIds);

    expect(state.total_blocks).toBe(5);
    expect(state.blocks_progress).toHaveLength(5);

    // Mark all but last complete
    const updatedBlocks = blockIds.map((id, i) =>
      i < 4
        ? createCompleteBlockProgress(id)
        : createIncompleteBlockProgress(id)
    );

    const stateWithProgress = { ...state, blocks_progress: updatedBlocks };

    expect(getNextIncompleteBlockIndex(stateWithProgress)).toBe(4);
    expect(isSessionComplete(stateWithProgress)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Multi-Block Progression Scenario Matrix
// ═══════════════════════════════════════════════════════════════════════════

describe("Multi-Block Progression Scenario Matrix", () => {
  /**
   * Test all combinations from the plan's scenario matrix
   */

  interface Scenario {
    id: number;
    block1Status: "incomplete" | "complete" | "skipped";
    block2Status: "incomplete" | "complete" | "skipped";
    expectedNextBlock: number | null; // null = session complete
    expectedSessionStatus: "active" | "complete";
  }

  const scenarios: Scenario[] = [
    { id: 1, block1Status: "incomplete", block2Status: "incomplete", expectedNextBlock: 0, expectedSessionStatus: "active" },
    { id: 2, block1Status: "complete", block2Status: "incomplete", expectedNextBlock: 1, expectedSessionStatus: "active" },
    { id: 3, block1Status: "complete", block2Status: "complete", expectedNextBlock: null, expectedSessionStatus: "complete" },
    { id: 4, block1Status: "skipped", block2Status: "incomplete", expectedNextBlock: 1, expectedSessionStatus: "active" },
    { id: 5, block1Status: "complete", block2Status: "skipped", expectedNextBlock: null, expectedSessionStatus: "complete" },
  ];

  scenarios.forEach((scenario) => {
    it(`Scenario ${scenario.id}: b1=${scenario.block1Status}, b2=${scenario.block2Status} => next=${scenario.expectedNextBlock}, session=${scenario.expectedSessionStatus}`, () => {
      const createBlockByStatus = (
        id: string,
        status: "incomplete" | "complete" | "skipped"
      ): BlockProgressEntry => {
        switch (status) {
          case "complete":
            return createCompleteBlockProgress(id);
          case "skipped":
            return createBlockProgressEntry(id, {
              mastery_score: 0.30,
              student_requested_advance: true,
              is_complete: true,
            });
          case "incomplete":
          default:
            return createIncompleteBlockProgress(id);
        }
      };

      const state = createTestSessionState(2, {
        blocks_progress: [
          createBlockByStatus("b1", scenario.block1Status),
          createBlockByStatus("b2", scenario.block2Status),
        ],
      });

      const nextIndex = getNextIncompleteBlockIndex(state);
      const sessionComplete = isSessionComplete(state);

      if (scenario.expectedNextBlock === null) {
        expect(nextIndex).toBe(-1);
      } else {
        expect(nextIndex).toBe(scenario.expectedNextBlock);
      }

      expect(sessionComplete).toBe(scenario.expectedSessionStatus === "complete");
    });
  });
});
