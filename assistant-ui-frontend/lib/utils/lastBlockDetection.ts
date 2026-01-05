/**
 * lastBlockDetection - Pure functions for detecting last block in multi-block sessions
 *
 * Extracted for TDD testing to fix the bug where isLastBlock returned false
 * when completed_blocks count was stale (due to already-complete block not incrementing),
 * causing nextBlockId to be undefined.
 *
 * BUG FIX: isLastBlock now considers BOTH:
 * 1. Count-based: completedBlocks >= totalBlocks
 * 2. Index-based: currentBlockIndex >= totalBlocks - 1
 *
 * Either condition indicates we're at the last block.
 *
 * @module lib/utils/lastBlockDetection
 */

/**
 * Determines if the current block is the last block.
 *
 * This function fixes the bug where completedBlocks count could be stale
 * (e.g., when shouldIncrementCompletedBlocks=false because block was already complete).
 *
 * @param completedBlocks - Number of completed blocks (may be stale)
 * @param totalBlocks - Total number of blocks in the session
 * @param currentBlockIndex - Current block position (0-indexed)
 * @returns true if this is the last block (by either count or position)
 *
 * @example
 * // Normal completion - both agree
 * isLastBlock(3, 3, 2) // true: 3 >= 3 AND 2 >= 2
 *
 * @example
 * // Stale count bug scenario - index saves the day
 * isLastBlock(2, 3, 2) // true: 2 < 3 BUT 2 >= 2 (index-based)
 *
 * @example
 * // Middle of session - both agree we have more
 * isLastBlock(1, 3, 0) // false: 1 < 3 AND 0 < 2
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
 * Safely gets the next block ID, returning null if at or past last block
 *
 * @param allBlockIds - Array of all block IDs in the session
 * @param currentBlockIndex - Current block position (0-indexed)
 * @returns The next block ID, or null if no more blocks
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
 * Decision result for block completion
 */
export type BlockCompletionDecision =
  | { type: "show_celebration" }
  | { type: "progress_to_next_block"; nextBlockId: string; nextBlockIndex: number };

/**
 * Complete decision function for block completion.
 * Uses the fixed isLastBlock check to avoid the undefined nextBlockId bug.
 *
 * @param allBlockIds - Array of all block IDs in the session
 * @param currentBlockIndex - Current block position (0-indexed)
 * @param completedBlocks - Number of completed blocks (may be stale)
 * @returns Decision indicating whether to show celebration or progress to next block
 *
 * @example
 * // Normal progression
 * getBlockCompletionDecision(["b1", "b2", "b3"], 0, 1)
 * // { type: "progress_to_next_block", nextBlockId: "b2", nextBlockIndex: 1 }
 *
 * @example
 * // Last block (even with stale count)
 * getBlockCompletionDecision(["b1", "b2", "b3"], 2, 2)
 * // { type: "show_celebration" }
 */
export function getBlockCompletionDecision(
  allBlockIds: string[],
  currentBlockIndex: number,
  completedBlocks: number
): BlockCompletionDecision {
  const totalBlocks = allBlockIds.length;

  // Use fixed isLastBlock that considers both count AND index
  if (isLastBlock(completedBlocks, totalBlocks, currentBlockIndex)) {
    return { type: "show_celebration" };
  }

  // Get next block - guaranteed to exist since isLastBlock returned false
  const nextBlockId = getNextBlockId(allBlockIds, currentBlockIndex);

  // This should never happen with the fixed isLastBlock check,
  // but TypeScript needs the check for type narrowing
  if (!nextBlockId) {
    // Defensive: treat as last block if somehow we can't find next
    return { type: "show_celebration" };
  }

  return {
    type: "progress_to_next_block",
    nextBlockId,
    nextBlockIndex: currentBlockIndex + 1,
  };
}
