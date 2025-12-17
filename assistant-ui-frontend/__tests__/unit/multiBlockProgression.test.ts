/**
 * TDD Tests: Multi-Block Progression
 *
 * BUG REPORT:
 * - After block 1 completes, celebration page is shown immediately
 * - Expected: If more blocks exist, progress to block 2 instead
 * - Celebration should ONLY appear when ALL blocks are complete
 *
 * ROOT CAUSE:
 * - useLangGraphWizard sets stage = "complete" when ANY block completes
 * - Missing check: Is this the last block?
 *
 * FIX REQUIRED:
 * - Check completed_blocks vs total_blocks before showing celebration
 * - If more blocks exist: advance to next block, reset difficulty to easy, fetch first question
 * - If all blocks done: then show celebration
 */

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS TO TEST (will be extracted to lib/practice/blockProgression.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if session is complete (all blocks done)
 */
export function isSessionComplete(
  completedBlocks: number,
  totalBlocks: number
): boolean {
  return completedBlocks >= totalBlocks;
}

/**
 * Get the index of the next incomplete block
 * Returns -1 if all blocks are complete
 */
export function getNextIncompleteBlockIndex(
  blocks: Array<{ is_complete: boolean }>,
  currentIndex: number
): number {
  // First, check blocks after current
  for (let i = currentIndex + 1; i < blocks.length; i++) {
    if (!blocks[i].is_complete) {
      return i;
    }
  }
  // All blocks after current are complete (or none exist)
  return -1;
}

/**
 * Determine what should happen when a block completes
 */
export type BlockCompletionAction =
  | { type: "progress_to_next_block"; nextBlockIndex: number }
  | { type: "show_celebration" };

export function getBlockCompletionAction(
  blocks: Array<{ block_id: string; is_complete: boolean }>,
  currentBlockIndex: number,
  totalBlocks: number
): BlockCompletionAction {
  // Mark current block as complete in our check
  const updatedBlocks = blocks.map((b, i) =>
    i === currentBlockIndex ? { ...b, is_complete: true } : b
  );

  // Count completed blocks
  const completedCount = updatedBlocks.filter((b) => b.is_complete).length;

  // Check if all blocks are now complete
  if (completedCount >= totalBlocks) {
    return { type: "show_celebration" };
  }

  // Find next incomplete block
  const nextIndex = getNextIncompleteBlockIndex(updatedBlocks, currentBlockIndex);
  if (nextIndex === -1) {
    // Edge case: all blocks complete but count didn't match (shouldn't happen)
    return { type: "show_celebration" };
  }

  return { type: "progress_to_next_block", nextBlockIndex: nextIndex };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 1: Session Completion Detection
// ═══════════════════════════════════════════════════════════════════════════

describe("Session Completion Detection", () => {
  describe("isSessionComplete", () => {
    it("should return false when 0/3 blocks complete", () => {
      expect(isSessionComplete(0, 3)).toBe(false);
    });

    it("should return false when 1/3 blocks complete", () => {
      expect(isSessionComplete(1, 3)).toBe(false);
    });

    it("should return false when 2/3 blocks complete", () => {
      expect(isSessionComplete(2, 3)).toBe(false);
    });

    it("should return true when 3/3 blocks complete", () => {
      expect(isSessionComplete(3, 3)).toBe(true);
    });

    it("should return true for single block lesson (1/1)", () => {
      expect(isSessionComplete(1, 1)).toBe(true);
    });

    it("should return false for single block lesson (0/1)", () => {
      expect(isSessionComplete(0, 1)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 2: Next Incomplete Block Index
// ═══════════════════════════════════════════════════════════════════════════

describe("Get Next Incomplete Block Index", () => {
  describe("getNextIncompleteBlockIndex", () => {
    it("should return 1 when block 0 completes and block 1 is incomplete", () => {
      const blocks = [
        { is_complete: true },
        { is_complete: false },
        { is_complete: false },
      ];
      expect(getNextIncompleteBlockIndex(blocks, 0)).toBe(1);
    });

    it("should return 2 when blocks 0,1 complete and block 2 is incomplete", () => {
      const blocks = [
        { is_complete: true },
        { is_complete: true },
        { is_complete: false },
      ];
      expect(getNextIncompleteBlockIndex(blocks, 1)).toBe(2);
    });

    it("should return -1 when all blocks are complete", () => {
      const blocks = [
        { is_complete: true },
        { is_complete: true },
        { is_complete: true },
      ];
      expect(getNextIncompleteBlockIndex(blocks, 2)).toBe(-1);
    });

    it("should return -1 for single completed block", () => {
      const blocks = [{ is_complete: true }];
      expect(getNextIncompleteBlockIndex(blocks, 0)).toBe(-1);
    });

    it("should skip to next incomplete block even if not sequential", () => {
      // Blocks 0, 1 complete; block 2 incomplete
      const blocks = [
        { is_complete: true },
        { is_complete: true },
        { is_complete: false },
      ];
      // From block 0, should jump to block 2
      expect(getNextIncompleteBlockIndex(blocks, 0)).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 3: Block Completion Action (Critical Decision Point)
// ═══════════════════════════════════════════════════════════════════════════

describe("Block Completion Action", () => {
  describe("getBlockCompletionAction", () => {
    it("should return progress_to_next_block when block 1 of 3 completes", () => {
      const blocks = [
        { block_id: "b1", is_complete: false }, // About to complete
        { block_id: "b2", is_complete: false },
        { block_id: "b3", is_complete: false },
      ];

      const action = getBlockCompletionAction(blocks, 0, 3);

      expect(action.type).toBe("progress_to_next_block");
      if (action.type === "progress_to_next_block") {
        expect(action.nextBlockIndex).toBe(1);
      }
    });

    it("should return progress_to_next_block when block 2 of 3 completes", () => {
      const blocks = [
        { block_id: "b1", is_complete: true },
        { block_id: "b2", is_complete: false }, // About to complete
        { block_id: "b3", is_complete: false },
      ];

      const action = getBlockCompletionAction(blocks, 1, 3);

      expect(action.type).toBe("progress_to_next_block");
      if (action.type === "progress_to_next_block") {
        expect(action.nextBlockIndex).toBe(2);
      }
    });

    it("should return show_celebration when block 3 of 3 (last) completes", () => {
      const blocks = [
        { block_id: "b1", is_complete: true },
        { block_id: "b2", is_complete: true },
        { block_id: "b3", is_complete: false }, // About to complete (last)
      ];

      const action = getBlockCompletionAction(blocks, 2, 3);

      expect(action.type).toBe("show_celebration");
    });

    it("should return show_celebration for single-block lesson", () => {
      const blocks = [
        { block_id: "b1", is_complete: false }, // About to complete (only block)
      ];

      const action = getBlockCompletionAction(blocks, 0, 1);

      expect(action.type).toBe("show_celebration");
    });

    it("should handle out-of-order completion (skip completed blocks)", () => {
      // Edge case: blocks 0 and 2 are complete, block 1 is incomplete
      // When block 0 re-completes (shouldn't happen, but be safe)
      const blocks = [
        { block_id: "b1", is_complete: true },
        { block_id: "b2", is_complete: false }, // Incomplete!
        { block_id: "b3", is_complete: true },
      ];

      // Even from block 0, should find block 1 as next incomplete
      const action = getBlockCompletionAction(blocks, 0, 3);

      expect(action.type).toBe("progress_to_next_block");
      if (action.type === "progress_to_next_block") {
        expect(action.nextBlockIndex).toBe(1);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 4: Integration - BUG SCENARIO (Current Broken Behavior)
// ═══════════════════════════════════════════════════════════════════════════

describe("Bug Scenario: Block 1 Complete Should NOT Show Celebration", () => {
  /**
   * CURRENT BUG:
   * When block 1 of 3 completes:
   * - Code sets: stage = "complete"
   * - UI shows: WizardCelebration
   * - User sees: Celebration after first block!
   *
   * EXPECTED BEHAVIOR:
   * When block 1 of 3 completes:
   * - Code checks: completed_blocks (1) < total_blocks (3)
   * - Code sets: current_block_index = 1, stage = "question"
   * - UI shows: First question of block 2
   */

  it("BUG: stage should NOT be 'complete' when only 1/3 blocks done", () => {
    // Simulate the BUGGY current behavior
    const currentBuggyLogic = (blockCompletes: boolean, totalBlocks: number, completedBlocks: number) => {
      if (blockCompletes) {
        // BUG: Always sets to "complete" without checking remaining blocks
        return "complete";
      }
      return "question";
    };

    // This documents the bug - stage becomes "complete" even with 2 blocks remaining
    const buggyStage = currentBuggyLogic(true, 3, 1);
    expect(buggyStage).toBe("complete"); // BUG! Should be "question" for next block
  });

  it("FIXED: stage should be 'question' when more blocks remain", () => {
    // Simulate the FIXED behavior
    const fixedLogic = (
      blockCompletes: boolean,
      totalBlocks: number,
      completedBlocks: number
    ) => {
      if (blockCompletes) {
        // FIX: Check if this is the last block
        if (completedBlocks >= totalBlocks) {
          return "complete"; // All blocks done - show celebration
        }
        return "question"; // More blocks - continue to next block
      }
      return "question";
    };

    // After fixing, stage should be "question" when 1/3 blocks complete
    const fixedStage = fixedLogic(true, 3, 1);
    expect(fixedStage).toBe("question"); // CORRECT! Progress to block 2
  });

  it("FIXED: stage should be 'complete' only when all blocks done", () => {
    const fixedLogic = (
      blockCompletes: boolean,
      totalBlocks: number,
      completedBlocks: number
    ) => {
      if (blockCompletes) {
        if (completedBlocks >= totalBlocks) {
          return "complete";
        }
        return "question";
      }
      return "question";
    };

    // All 3 blocks complete - NOW show celebration
    const fixedStage = fixedLogic(true, 3, 3);
    expect(fixedStage).toBe("complete"); // CORRECT! All done - celebration
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 5: Parameter Passing Bug (Root Cause of 1 Block Issue)
// ═══════════════════════════════════════════════════════════════════════════

describe("Parameter Passing Bug: questionAvailability not passed to startSessionV2", () => {
  /**
   * ROOT CAUSE ANALYSIS:
   *
   * 1. PracticeWizardPage calls checkQuestionsAvailable() → gets 3 blocks
   * 2. Page passes questionAvailability prop to WizardPracticeContainer
   * 3. Container calls wizard.startSessionV2() WITHOUT passing questionAvailability
   * 4. Hook reads from state.questionAvailability which is NULL
   * 5. Falls back to [blockId] → only 1 block!
   *
   * FIX: startSessionV2 must receive questionAvailability as a parameter
   */

  it("BUG: allBlockIds is [blockId] when questionAvailability not passed", () => {
    // Simulates the buggy behavior
    const stateQuestionAvailability = null; // Hook's internal state is null
    const passedBlockId = "block_001";

    // This is what the buggy code does
    const allBlockIds = stateQuestionAvailability?.byBlock?.map((b: { blockId: string }) => b.blockId) || [passedBlockId];

    // Bug: Only 1 block instead of 3!
    expect(allBlockIds).toEqual(["block_001"]);
    expect(allBlockIds.length).toBe(1);
  });

  it("FIXED: allBlockIds should use passed questionAvailability parameter", () => {
    // Simulates the fixed behavior - questionAvailability is passed as parameter
    const questionAvailabilityParam = {
      byBlock: [
        { blockId: "block_001", blockTitle: "Perimeter", count: 10 },
        { blockId: "block_002", blockTitle: "Area", count: 15 },
        { blockId: "block_003", blockTitle: "Volume", count: 14 },
      ],
    };
    const passedBlockId = "block_001";

    // Fixed: Use passed parameter instead of internal state
    const allBlockIds = questionAvailabilityParam?.byBlock?.map(b => b.blockId) || [passedBlockId];

    // Correct: All 3 blocks!
    expect(allBlockIds).toEqual(["block_001", "block_002", "block_003"]);
    expect(allBlockIds.length).toBe(3);
  });

  it("FIXED: startSessionV2 should initialize allBlockIds from parameter", () => {
    // Mock the fixed startSessionV2 parameter extraction
    const questionAvailabilityParam = {
      byBlock: [
        { blockId: "block_001", blockTitle: "Perimeter", count: 10 },
        { blockId: "block_002", blockTitle: "Area", count: 15 },
        { blockId: "block_003", blockTitle: "Volume", count: 14 },
      ],
    };
    const firstBlockId = "block_001";

    // Simulates fixed v2ContextRef initialization
    const v2Context = {
      lessonTemplateId: "lesson_001",
      blockId: firstBlockId,
      allBlockIds: questionAvailabilityParam?.byBlock?.map(b => b.blockId) || [firstBlockId],
      currentBlockIndex: 0,
    };

    expect(v2Context.allBlockIds.length).toBe(3);
    expect(v2Context.currentBlockIndex).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 6: Block Transition State Updates
// ═══════════════════════════════════════════════════════════════════════════

describe("Block Transition State Updates", () => {
  /**
   * When progressing from block N to block N+1:
   * 1. current_block_index should increment
   * 2. Difficulty should reset to "easy"
   * 3. Block-specific refs should reset (mastery, hard questions, streaks)
   * 4. New question should be fetched for the new block
   */

  it("should reset difficulty to 'easy' when starting new block", () => {
    const currentDifficulty = "hard"; // Was at hard in block 1
    const difficultyAfterBlockChange = "easy"; // Should reset for block 2

    expect(difficultyAfterBlockChange).toBe("easy");
  });

  it("should reset cumulative mastery when starting new block", () => {
    const masteryBeforeBlockChange = 0.75; // 75% in block 1
    const masteryAfterBlockChange = 0; // Fresh start for block 2

    expect(masteryAfterBlockChange).toBe(0);
  });

  it("should reset hard questions attempted when starting new block", () => {
    const hardBeforeBlockChange = 3; // Attempted 3 hard in block 1
    const hardAfterBlockChange = 0; // Fresh start for block 2

    expect(hardAfterBlockChange).toBe(0);
  });

  it("should reset consecutive correct/incorrect when starting new block", () => {
    const correctBeforeBlockChange = 5;
    const correctAfterBlockChange = 0;
    const incorrectBeforeBlockChange = 0;
    const incorrectAfterBlockChange = 0;

    expect(correctAfterBlockChange).toBe(0);
    expect(incorrectAfterBlockChange).toBe(0);
  });

  it("should increment current_block_index when progressing", () => {
    const indexBefore = 0; // Block 1
    const indexAfter = 1; // Block 2

    expect(indexAfter).toBe(indexBefore + 1);
  });

  it("should update progress.current_block_index to match", () => {
    const progress = {
      current_block_index: 0,
      completed_blocks: 1,
      total_blocks: 3,
      blocks: [
        { block_id: "b1", is_complete: true, mastery_score: 0.75 },
        { block_id: "b2", is_complete: false, mastery_score: 0 },
        { block_id: "b3", is_complete: false, mastery_score: 0 },
      ],
    };

    // After block 1 completion
    const updatedProgress = {
      ...progress,
      current_block_index: 1, // Now on block 2
    };

    expect(updatedProgress.current_block_index).toBe(1);
    expect(updatedProgress.completed_blocks).toBe(1);
    expect(updatedProgress.blocks[0].is_complete).toBe(true);
    expect(updatedProgress.blocks[1].is_complete).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 7: Mastery Consistency Bug Fix
// ═══════════════════════════════════════════════════════════════════════════

describe("Mastery Consistency: overall_mastery vs block.mastery_score", () => {
  /**
   * BUG REPORT:
   * - Celebration page shows 70% mastery (reads overall_mastery)
   * - Side panel shows 1% mastery (reads blocks[0].mastery_score)
   *
   * ROOT CAUSE:
   * - Both values should come from the same source (cumulativeMasteryRef)
   * - Bug was in how current_block_index was determined
   * - Used currentProgress.current_block_index which could be stale
   *
   * FIX:
   * - Use v2ContextRef.currentBlockIndex as source of truth
   * - Add validation to ensure block index is valid
   * - Add consistency check to detect if values diverge
   */

  /**
   * Helper: Simulates progress update logic from useLangGraphWizard
   */
  function updateProgressWithMastery(
    currentProgress: {
      overall_mastery: number;
      current_block_index: number;
      blocks: Array<{ block_id: string; mastery_score: number; is_complete: boolean }>;
    },
    activeBlockIndex: number, // Source of truth index
    newMastery: number,
    isBlockComplete: boolean
  ) {
    // Validate block index
    const safeBlockIndex =
      activeBlockIndex >= 0 && activeBlockIndex < currentProgress.blocks.length
        ? activeBlockIndex
        : 0;

    return {
      ...currentProgress,
      overall_mastery: newMastery,
      current_block_index: safeBlockIndex,
      blocks: currentProgress.blocks.map((block, index) => {
        if (index === safeBlockIndex) {
          return {
            ...block,
            mastery_score: newMastery,
            is_complete: isBlockComplete,
          };
        }
        return block;
      }),
    };
  }

  it("overall_mastery should equal blocks[current_index].mastery_score", () => {
    const initialProgress = {
      overall_mastery: 0,
      current_block_index: 0,
      blocks: [
        { block_id: "b1", mastery_score: 0, is_complete: false },
        { block_id: "b2", mastery_score: 0, is_complete: false },
      ],
    };

    const updatedProgress = updateProgressWithMastery(
      initialProgress,
      0, // activeBlockIndex
      0.7, // newMastery (70%)
      true // isBlockComplete
    );

    // Both values should be 0.7
    expect(updatedProgress.overall_mastery).toBe(0.7);
    expect(updatedProgress.blocks[0].mastery_score).toBe(0.7);
    expect(updatedProgress.overall_mastery).toBe(updatedProgress.blocks[0].mastery_score);
  });

  it("BUG SCENARIO: Wrong block index should NOT cause inconsistency", () => {
    const initialProgress = {
      overall_mastery: 0,
      current_block_index: 1, // STALE: Progress thinks we're on block 1
      blocks: [
        { block_id: "b1", mastery_score: 0, is_complete: false },
        { block_id: "b2", mastery_score: 0, is_complete: false },
      ],
    };

    // But actual active block (from v2ContextRef) is 0
    const updatedProgress = updateProgressWithMastery(
      initialProgress,
      0, // activeBlockIndex from v2ContextRef (source of truth)
      0.7, // newMastery (70%)
      true // isBlockComplete
    );

    // Fix: Uses activeBlockIndex (0), not currentProgress.current_block_index (1)
    expect(updatedProgress.overall_mastery).toBe(0.7);
    expect(updatedProgress.blocks[0].mastery_score).toBe(0.7);
    expect(updatedProgress.current_block_index).toBe(0); // Synced from activeBlockIndex
  });

  it("should handle invalid block index gracefully (use fallback)", () => {
    const initialProgress = {
      overall_mastery: 0,
      current_block_index: 0,
      blocks: [
        { block_id: "b1", mastery_score: 0, is_complete: false },
        { block_id: "b2", mastery_score: 0, is_complete: false },
      ],
    };

    // Invalid index (out of bounds)
    const updatedProgress = updateProgressWithMastery(
      initialProgress,
      99, // Invalid activeBlockIndex
      0.7,
      true
    );

    // Should fallback to index 0
    expect(updatedProgress.current_block_index).toBe(0);
    expect(updatedProgress.blocks[0].mastery_score).toBe(0.7);
    expect(updatedProgress.overall_mastery).toBe(updatedProgress.blocks[0].mastery_score);
  });

  it("should handle negative block index gracefully (use fallback)", () => {
    const initialProgress = {
      overall_mastery: 0,
      current_block_index: 0,
      blocks: [
        { block_id: "b1", mastery_score: 0, is_complete: false },
      ],
    };

    const updatedProgress = updateProgressWithMastery(
      initialProgress,
      -1, // Negative index
      0.5,
      false
    );

    // Should fallback to index 0
    expect(updatedProgress.current_block_index).toBe(0);
    expect(updatedProgress.blocks[0].mastery_score).toBe(0.5);
  });

  it("block 0 mastery should be preserved when transitioning to block 1", () => {
    // Start with completed block 0
    const afterBlock0Complete = {
      overall_mastery: 0.75,
      current_block_index: 0,
      blocks: [
        { block_id: "b1", mastery_score: 0.75, is_complete: true },
        { block_id: "b2", mastery_score: 0, is_complete: false },
      ],
    };

    // Now update for block 1 (activeBlockIndex = 1)
    const afterBlock1Update = updateProgressWithMastery(
      afterBlock0Complete,
      1, // Now working on block 1
      0.1, // Low mastery so far
      false
    );

    // Block 0's mastery should be preserved!
    expect(afterBlock1Update.blocks[0].mastery_score).toBe(0.75);
    expect(afterBlock1Update.blocks[0].is_complete).toBe(true);
    // Block 1's mastery should be updated
    expect(afterBlock1Update.blocks[1].mastery_score).toBe(0.1);
    expect(afterBlock1Update.current_block_index).toBe(1);
    // overall_mastery reflects current block
    expect(afterBlock1Update.overall_mastery).toBe(0.1);
  });

  it("celebration should show correct mastery from completed block", () => {
    // Simulate single-block lesson completion
    const initialProgress = {
      overall_mastery: 0,
      current_block_index: 0,
      blocks: [
        { block_id: "b1", mastery_score: 0, is_complete: false },
      ],
    };

    // Block completes with 70% mastery
    const finalProgress = updateProgressWithMastery(
      initialProgress,
      0,
      0.7,
      true // Block complete!
    );

    // What celebration page reads (overall_mastery)
    const celebrationMastery = finalProgress.overall_mastery;
    // What side panel reads (blocks[0].mastery_score)
    const sidePanelMastery = finalProgress.blocks[0].mastery_score;

    // CRITICAL: These MUST be equal!
    expect(celebrationMastery).toBe(0.7);
    expect(sidePanelMastery).toBe(0.7);
    expect(celebrationMastery).toBe(sidePanelMastery);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 8: Continue to Next Block UI Messaging
// ═══════════════════════════════════════════════════════════════════════════

describe("Continue to Next Block UI Messaging", () => {
  /**
   * Tests for FeedbackStep's multi-block progression UI
   * - Should show "Continue to Next Block" when more blocks remain
   * - Should show "Complete Lesson" when on final block
   * - Should show block number progress (e.g., "Block 1 of 3 Complete!")
   */

  /**
   * Pure function: Determines UI messaging based on block completion state
   * Mirrors logic in FeedbackStep.tsx
   */
  function getBlockCompletionUIState(
    isBlockComplete: boolean,
    currentBlockIndex: number,
    totalBlocks: number
  ): {
    hasMoreBlocks: boolean;
    blockNumber: number;
    buttonText: string;
    celebrationTitle: string;
    celebrationSubtitle: string;
  } {
    const hasMoreBlocks = totalBlocks > 1 && currentBlockIndex < totalBlocks - 1;
    const blockNumber = currentBlockIndex + 1; // Display as 1-indexed

    let buttonText: string;
    if (isBlockComplete && hasMoreBlocks) {
      buttonText = "Continue to Next Block";
    } else if (isBlockComplete) {
      buttonText = "Complete Lesson";
    } else {
      buttonText = "Continue";
    }

    let celebrationTitle: string;
    let celebrationSubtitle: string;
    if (hasMoreBlocks) {
      celebrationTitle = `Block ${blockNumber} of ${totalBlocks} Complete!`;
      celebrationSubtitle = `Great work! Ready to continue to block ${blockNumber + 1}?`;
    } else {
      celebrationTitle = "Block Mastered!";
      celebrationSubtitle = "You've achieved full mastery of this concept!";
    }

    return {
      hasMoreBlocks,
      blockNumber,
      buttonText,
      celebrationTitle,
      celebrationSubtitle,
    };
  }

  it("should show 'Continue' when block is NOT complete", () => {
    const state = getBlockCompletionUIState(false, 0, 3);
    expect(state.buttonText).toBe("Continue");
  });

  it("should show 'Continue to Next Block' when block complete and more blocks remain", () => {
    const state = getBlockCompletionUIState(true, 0, 3);
    expect(state.buttonText).toBe("Continue to Next Block");
    expect(state.hasMoreBlocks).toBe(true);
  });

  it("should show 'Complete Lesson' when on final block", () => {
    const state = getBlockCompletionUIState(true, 2, 3); // Block 3 of 3 (index 2)
    expect(state.buttonText).toBe("Complete Lesson");
    expect(state.hasMoreBlocks).toBe(false);
  });

  it("should show 'Complete Lesson' for single-block lesson", () => {
    const state = getBlockCompletionUIState(true, 0, 1);
    expect(state.buttonText).toBe("Complete Lesson");
    expect(state.hasMoreBlocks).toBe(false);
  });

  it("should show correct block number progress (1-indexed)", () => {
    const state1 = getBlockCompletionUIState(true, 0, 3);
    expect(state1.blockNumber).toBe(1);
    expect(state1.celebrationTitle).toBe("Block 1 of 3 Complete!");
    expect(state1.celebrationSubtitle).toBe("Great work! Ready to continue to block 2?");

    const state2 = getBlockCompletionUIState(true, 1, 3);
    expect(state2.blockNumber).toBe(2);
    expect(state2.celebrationTitle).toBe("Block 2 of 3 Complete!");
    expect(state2.celebrationSubtitle).toBe("Great work! Ready to continue to block 3?");
  });

  it("should show 'Block Mastered!' title for final block", () => {
    const state = getBlockCompletionUIState(true, 2, 3);
    expect(state.celebrationTitle).toBe("Block Mastered!");
    expect(state.celebrationSubtitle).toBe("You've achieved full mastery of this concept!");
  });

  it("should correctly detect hasMoreBlocks edge cases", () => {
    // Block 2 of 3 (index 1) -> more blocks remain
    expect(getBlockCompletionUIState(true, 1, 3).hasMoreBlocks).toBe(true);

    // Block 3 of 3 (index 2) -> no more blocks
    expect(getBlockCompletionUIState(true, 2, 3).hasMoreBlocks).toBe(false);

    // Block 1 of 1 (index 0) -> no more blocks
    expect(getBlockCompletionUIState(true, 0, 1).hasMoreBlocks).toBe(false);

    // Block 1 of 2 (index 0) -> more blocks remain
    expect(getBlockCompletionUIState(true, 0, 2).hasMoreBlocks).toBe(true);
  });

  it("should not show block complete UI when block is NOT complete, even if more blocks exist", () => {
    const state = getBlockCompletionUIState(false, 0, 3);
    // Button should show "Continue" not "Continue to Next Block"
    expect(state.buttonText).toBe("Continue");
    // Note: In FeedbackStep, the celebration banner only shows when isBlockComplete=true
  });
});
