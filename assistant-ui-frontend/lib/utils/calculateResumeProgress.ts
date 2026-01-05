/**
 * calculateResumeProgress - Pure function for calculating progress on session resume
 *
 * Extracted for TDD testing to fix the bug where overall_mastery was calculated
 * as the average of all blocks instead of the current block's mastery.
 *
 * @module lib/utils/calculateResumeProgress
 */

import type { BlockProgress } from './extractResumePosition';

/**
 * Block with mastery score for progress calculation
 */
export interface ProgressBlock {
  block_id: string;
  mastery_score: number;
  is_complete: boolean;
}

/**
 * Stored progress entry from database
 */
export interface StoredBlockProgress {
  block_id: string;
  mastery_score?: number;
  is_complete?: boolean;
}

/**
 * Result of calculating resume progress
 */
export interface ResumeProgressResult {
  overall_mastery: number;
  completed_blocks: number;
  blocks: ProgressBlock[];
}

/**
 * Calculates the initial progress state when resuming a practice session.
 *
 * IMPORTANT: The `overall_mastery` should represent the CURRENT BLOCK's mastery,
 * not the average across all blocks. This is because during practice, the UI
 * displays the current block's progress, and switching to an average on resume
 * creates a jarring UX (e.g., jumping from 5% to 27% then back to 5%).
 *
 * @param allBlockIds - Array of all block IDs in the session
 * @param currentBlockIndex - The index of the current block (0-based)
 * @param storedProgress - Array of stored block progress from database (may be partial)
 * @returns ResumeProgressResult with overall_mastery set to current block's mastery
 *
 * @example
 * // Resuming on block 2 with block 1 complete at 80%, block 2 at 5%
 * const result = calculateResumeProgress(
 *   ['block_001', 'block_002', 'block_003'],
 *   1, // current block index
 *   [
 *     { block_id: 'block_001', mastery_score: 0.8, is_complete: true },
 *     { block_id: 'block_002', mastery_score: 0.05, is_complete: false },
 *   ]
 * );
 * // result.overall_mastery should be 0.05 (current block), NOT 0.28 (average)
 */
export function calculateResumeProgress(
  allBlockIds: string[],
  currentBlockIndex: number,
  storedProgress?: StoredBlockProgress[] | null
): ResumeProgressResult {
  // Build initial blocks array from all block IDs, merging with stored progress
  // FIX: If we're on block N, blocks 0..N-1 are implicitly complete (you can't get to N without completing them)
  const blocks: ProgressBlock[] = allBlockIds.map((blockId, blockIndex) => {
    const storedBlock = storedProgress?.find(bp => bp.block_id === blockId);

    // If stored progress exists, use it (respect explicit data)
    if (storedBlock && storedBlock.is_complete !== undefined) {
      return {
        block_id: blockId,
        mastery_score: storedBlock.mastery_score ?? 0,
        is_complete: storedBlock.is_complete,
      };
    }

    // No stored progress for this block - apply implicit completion logic:
    // Blocks before currentBlockIndex are implicitly complete
    const isImplicitlyComplete = blockIndex < currentBlockIndex;

    return {
      block_id: blockId,
      mastery_score: storedBlock?.mastery_score ?? (isImplicitlyComplete ? 1.0 : 0),
      is_complete: isImplicitlyComplete,
    };
  });

  // Calculate completed blocks count
  const completed_blocks = blocks.filter(b => b.is_complete).length;

  // FIX: Use current block's mastery, not average of all blocks
  // This matches what the UI shows during practice, preventing jarring UX on resume
  const currentBlock = blocks[currentBlockIndex];
  const overall_mastery = currentBlock?.mastery_score ?? 0;

  return {
    overall_mastery,
    completed_blocks,
    blocks,
  };
}
