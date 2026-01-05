/**
 * TDD Tests: Last Block Detection Bug Fix
 *
 * BUG REPORT:
 * - Error: [useLangGraphWizard] BUG: nextBlockId is undefined but isLastBlock=false
 * - Occurs when: All blocks finished, summary results shown
 * - Root cause: Mismatch between count-based isLastBlock check and index-based nextBlockId lookup
 *
 * ROOT CAUSE ANALYSIS:
 * 1. isLastBlock uses: `newCompletedBlocks >= totalBlocks` (count-based)
 * 2. nextBlockId uses: `allBlockIds[safeBlockIndex + 1]` (index-based)
 * 3. When a block is ALREADY marked complete (currentBlockAlreadyComplete=true),
 *    shouldIncrementCompletedBlocks=false, so completed_blocks doesn't increase
 * 4. But we're still ON that block (safeBlockIndex hasn't changed)
 * 5. Result: isLastBlock=false (count says more blocks) but nextBlockId=undefined (index out of bounds)
 *
 * FIX REQUIRED:
 * - isLastBlock should consider BOTH count AND index
 * - If safeBlockIndex >= allBlockIds.length - 1, we're on the last block by position
 */

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTION: Last Block Detection (will be extracted to lib/practice/blockProgression.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines if the current block is the last block.
 *
 * BUGGY VERSION (count-only):
 * ```
 * return completedBlocks >= totalBlocks;
 * ```
 *
 * This fails when completedBlocks counter is stale (e.g., block was already complete).
 *
 * FIXED VERSION (count OR index):
 * Considers both the completed count AND the current position.
 * If we're on the last block by index, it's the last block regardless of count.
 */
export function isLastBlock(
  completedBlocks: number,
  totalBlocks: number,
  currentBlockIndex: number
): boolean {
  // Count-based check: have we completed all blocks?
  const countBasedLast = completedBlocks >= totalBlocks;

  // Index-based check: are we on the last block position?
  const indexBasedLast = currentBlockIndex >= totalBlocks - 1;

  // Either condition means we're at the last block
  return countBasedLast || indexBasedLast;
}

/**
 * BUGGY VERSION: Only uses count-based check
 * This reproduces the original bug for comparison
 */
export function isLastBlockBuggy(
  completedBlocks: number,
  totalBlocks: number,
  _currentBlockIndex: number // Ignored in buggy version
): boolean {
  return completedBlocks >= totalBlocks;
}

/**
 * Safely gets the next block ID, returning null if at last block
 */
export function getNextBlockId(
  allBlockIds: string[],
  currentBlockIndex: number
): string | null {
  const nextIndex = currentBlockIndex + 1;
  if (nextIndex >= allBlockIds.length) {
    return null;
  }
  return allBlockIds[nextIndex];
}

/**
 * Complete decision function for block completion
 * Returns the action to take when a block completes
 */
export type LastBlockDecision =
  | { type: "show_celebration" }
  | { type: "progress_to_next_block"; nextBlockId: string; nextBlockIndex: number }
  | { type: "error"; reason: string };

export function getBlockCompletionDecision(
  allBlockIds: string[],
  currentBlockIndex: number,
  completedBlocks: number
): LastBlockDecision {
  const totalBlocks = allBlockIds.length;

  // Use fixed isLastBlock that considers both count AND index
  if (isLastBlock(completedBlocks, totalBlocks, currentBlockIndex)) {
    return { type: "show_celebration" };
  }

  // Get next block
  const nextBlockId = getNextBlockId(allBlockIds, currentBlockIndex);
  if (!nextBlockId) {
    // This should never happen with the fixed isLastBlock check
    return {
      type: "error",
      reason: `nextBlockId is undefined but isLastBlock returned false. ` +
              `completedBlocks=${completedBlocks}, totalBlocks=${totalBlocks}, ` +
              `currentBlockIndex=${currentBlockIndex}`
    };
  }

  return {
    type: "progress_to_next_block",
    nextBlockId,
    nextBlockIndex: currentBlockIndex + 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 1: The Bug Scenario - Reproducing the Error
// ═══════════════════════════════════════════════════════════════════════════

describe("Last Block Detection Bug", () => {
  describe("BUG REPRODUCTION: isLastBlockBuggy fails when completed_blocks is stale", () => {
    /**
     * This test reproduces the exact bug scenario:
     * - 3 block session
     * - User is on block 3 (index 2) - the LAST block
     * - Block is already marked complete (race condition/double render)
     * - completed_blocks stays at 2 (because shouldIncrementCompletedBlocks=false)
     * - BUGGY: isLastBlock returns FALSE → code tries to get nextBlockId
     * - nextBlockId = allBlockIds[3] → undefined!
     */
    it("BUGGY: returns FALSE when on last block but completed_blocks=2 (not incremented)", () => {
      const completedBlocks = 2; // Stale - wasn't incremented because block already complete
      const totalBlocks = 3;
      const currentBlockIndex = 2; // We ARE on the last block!

      // Buggy version only checks count
      const result = isLastBlockBuggy(completedBlocks, totalBlocks, currentBlockIndex);

      // BUG: Returns false because 2 < 3, even though we're on the last block
      expect(result).toBe(false);
    });

    it("BUGGY: leads to undefined nextBlockId", () => {
      const allBlockIds = ["block_001", "block_002", "block_003"];
      const currentBlockIndex = 2; // Last block (index 2)
      const completedBlocks = 2; // Stale count

      // Using buggy isLastBlock check
      const isLast = isLastBlockBuggy(completedBlocks, allBlockIds.length, currentBlockIndex);

      // Buggy code thinks there are more blocks
      expect(isLast).toBe(false);

      // So it tries to get the next block...
      const nextBlockId = allBlockIds[currentBlockIndex + 1]; // index 3 doesn't exist!

      // BUG: nextBlockId is undefined!
      expect(nextBlockId).toBeUndefined();
    });
  });

  describe("FIXED: isLastBlock considers both count AND index", () => {
    it("returns TRUE when on last block by INDEX even if completed_blocks is stale", () => {
      const completedBlocks = 2; // Stale - wasn't incremented
      const totalBlocks = 3;
      const currentBlockIndex = 2; // We ARE on the last block!

      // Fixed version checks both count AND index
      const result = isLastBlock(completedBlocks, totalBlocks, currentBlockIndex);

      // FIXED: Returns true because currentBlockIndex (2) >= totalBlocks - 1 (2)
      expect(result).toBe(true);
    });

    it("returns TRUE when completed_blocks >= totalBlocks (normal case)", () => {
      const completedBlocks = 3;
      const totalBlocks = 3;
      const currentBlockIndex = 2;

      const result = isLastBlock(completedBlocks, totalBlocks, currentBlockIndex);

      expect(result).toBe(true);
    });

    it("returns FALSE when more blocks remain (both count and index agree)", () => {
      const completedBlocks = 1;
      const totalBlocks = 3;
      const currentBlockIndex = 0; // First block

      const result = isLastBlock(completedBlocks, totalBlocks, currentBlockIndex);

      expect(result).toBe(false);
    });

    it("returns FALSE when on middle block", () => {
      const completedBlocks = 1;
      const totalBlocks = 3;
      const currentBlockIndex = 1; // Middle block

      const result = isLastBlock(completedBlocks, totalBlocks, currentBlockIndex);

      expect(result).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 2: getNextBlockId Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe("getNextBlockId", () => {
  const allBlockIds = ["block_001", "block_002", "block_003"];

  it("returns next block when on first block", () => {
    expect(getNextBlockId(allBlockIds, 0)).toBe("block_002");
  });

  it("returns next block when on middle block", () => {
    expect(getNextBlockId(allBlockIds, 1)).toBe("block_003");
  });

  it("returns null when on last block", () => {
    expect(getNextBlockId(allBlockIds, 2)).toBeNull();
  });

  it("returns null for out-of-bounds index", () => {
    expect(getNextBlockId(allBlockIds, 99)).toBeNull();
  });

  it("returns null for single-block array on index 0", () => {
    expect(getNextBlockId(["only_block"], 0)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 3: getBlockCompletionDecision Integration
// ═══════════════════════════════════════════════════════════════════════════

describe("getBlockCompletionDecision", () => {
  const allBlockIds = ["block_001", "block_002", "block_003"];

  describe("progress_to_next_block scenarios", () => {
    it("returns progress when on first block with more blocks", () => {
      const decision = getBlockCompletionDecision(allBlockIds, 0, 1);

      expect(decision.type).toBe("progress_to_next_block");
      if (decision.type === "progress_to_next_block") {
        expect(decision.nextBlockId).toBe("block_002");
        expect(decision.nextBlockIndex).toBe(1);
      }
    });

    it("returns progress when on middle block with more blocks", () => {
      const decision = getBlockCompletionDecision(allBlockIds, 1, 2);

      expect(decision.type).toBe("progress_to_next_block");
      if (decision.type === "progress_to_next_block") {
        expect(decision.nextBlockId).toBe("block_003");
        expect(decision.nextBlockIndex).toBe(2);
      }
    });
  });

  describe("show_celebration scenarios", () => {
    it("returns celebration when on last block (normal completion)", () => {
      const decision = getBlockCompletionDecision(allBlockIds, 2, 3);

      expect(decision.type).toBe("show_celebration");
    });

    it("returns celebration when on last block even if completed_blocks is stale", () => {
      // THE BUG SCENARIO - but now fixed!
      const decision = getBlockCompletionDecision(allBlockIds, 2, 2); // Stale count

      // FIXED: Should show celebration, not try to progress
      expect(decision.type).toBe("show_celebration");
    });

    it("returns celebration for single-block lesson", () => {
      const decision = getBlockCompletionDecision(["only_block"], 0, 1);

      expect(decision.type).toBe("show_celebration");
    });
  });

  describe("never returns error with fixed logic", () => {
    it("does NOT return error when on last block with stale count", () => {
      // This would have caused the original error
      const decision = getBlockCompletionDecision(allBlockIds, 2, 2);

      expect(decision.type).not.toBe("error");
      expect(decision.type).toBe("show_celebration");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 4: Edge Cases from Real-World Scenarios
// ═══════════════════════════════════════════════════════════════════════════

describe("Real-World Edge Cases", () => {
  describe("Race condition: block marked complete before count updates", () => {
    /**
     * Scenario: React StrictMode double-render or late server response
     * 1. Block completes, is_complete set to true
     * 2. Another feedback arrives (maybe late or duplicate)
     * 3. currentBlockAlreadyComplete = true
     * 4. shouldIncrementCompletedBlocks = false
     * 5. completed_blocks stays stale
     */
    it("handles double-completion of last block gracefully", () => {
      const allBlockIds = ["b1", "b2", "b3"];

      // First completion: completed_blocks incremented to 3
      const decision1 = getBlockCompletionDecision(allBlockIds, 2, 3);
      expect(decision1.type).toBe("show_celebration");

      // Second completion (race condition): completed_blocks stays at 3
      const decision2 = getBlockCompletionDecision(allBlockIds, 2, 3);
      expect(decision2.type).toBe("show_celebration");
    });

    it("handles completion where count lags behind index", () => {
      const allBlockIds = ["b1", "b2", "b3"];

      // User somehow on block 3 (index 2) but completed_blocks only shows 1
      // This is an edge case that shouldn't happen but we should handle gracefully
      const decision = getBlockCompletionDecision(allBlockIds, 2, 1);

      // Index says we're at the end, so show celebration
      expect(decision.type).toBe("show_celebration");
    });
  });

  describe("Session resume scenarios", () => {
    it("handles resumed session where all blocks were already complete", () => {
      const allBlockIds = ["b1", "b2", "b3"];

      // Resumed at last block, all marked complete
      const decision = getBlockCompletionDecision(allBlockIds, 2, 3);

      expect(decision.type).toBe("show_celebration");
    });
  });

  describe("Empty or invalid input handling", () => {
    it("handles empty allBlockIds array", () => {
      const decision = getBlockCompletionDecision([], 0, 0);

      // Empty session = nothing to do = show celebration
      expect(decision.type).toBe("show_celebration");
    });

    it("handles negative currentBlockIndex", () => {
      const allBlockIds = ["b1", "b2"];

      // Invalid index - isLastBlock will return false (since -1 < 1)
      // getNextBlockId will return "b1" (index 0)
      const decision = getBlockCompletionDecision(allBlockIds, -1, 0);

      expect(decision.type).toBe("progress_to_next_block");
      if (decision.type === "progress_to_next_block") {
        expect(decision.nextBlockId).toBe("b1");
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST GROUP 5: Comparison with Original Code Logic
// ═══════════════════════════════════════════════════════════════════════════

describe("Original Code Logic Simulation", () => {
  /**
   * This simulates the exact logic from useLangGraphWizard.ts lines 908-930
   * to demonstrate the bug and the fix
   */

  function simulateOriginalBuggyLogic(
    allBlockIds: string[],
    safeBlockIndex: number,
    completedBlocks: number
  ): { isLastBlock: boolean; nextBlockId: string | undefined } {
    // Line 908-910: Original buggy isLastBlock check
    const totalBlocks = allBlockIds.length;
    const isLastBlock = completedBlocks >= totalBlocks; // BUG: Only count-based

    // Line 929-930: Get next block
    const nextBlockIndex = safeBlockIndex + 1;
    const nextBlockId = allBlockIds[nextBlockIndex];

    return { isLastBlock, nextBlockId };
  }

  function simulateFixedLogic(
    allBlockIds: string[],
    safeBlockIndex: number,
    completedBlocks: number
  ): { isLastBlock: boolean; nextBlockId: string | undefined } {
    const totalBlocks = allBlockIds.length;

    // FIXED: Consider both count AND index
    const isLastBlockFixed = completedBlocks >= totalBlocks ||
                            safeBlockIndex >= totalBlocks - 1;

    const nextBlockIndex = safeBlockIndex + 1;
    const nextBlockId = allBlockIds[nextBlockIndex];

    return { isLastBlock: isLastBlockFixed, nextBlockId };
  }

  it("BUGGY: original logic causes isLastBlock=false with undefined nextBlockId", () => {
    const allBlockIds = ["b1", "b2", "b3"];
    const safeBlockIndex = 2; // On last block
    const completedBlocks = 2; // Stale count

    const result = simulateOriginalBuggyLogic(allBlockIds, safeBlockIndex, completedBlocks);

    // This is the BUG!
    expect(result.isLastBlock).toBe(false);
    expect(result.nextBlockId).toBeUndefined();
  });

  it("FIXED: new logic correctly detects last block", () => {
    const allBlockIds = ["b1", "b2", "b3"];
    const safeBlockIndex = 2; // On last block
    const completedBlocks = 2; // Stale count

    const result = simulateFixedLogic(allBlockIds, safeBlockIndex, completedBlocks);

    // FIXED!
    expect(result.isLastBlock).toBe(true);
    // nextBlockId is still undefined, but that's OK because isLastBlock=true
    // means we won't try to use it
  });
});
