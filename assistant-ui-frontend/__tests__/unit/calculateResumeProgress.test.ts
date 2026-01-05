/**
 * TDD Tests for calculateResumeProgress
 *
 * Bug: When resuming a practice session, the progress percentage jumps to an
 * unexpected value before reverting after the first answer.
 *
 * Example:
 * - Block 2 at 5% progress → leave session
 * - Resume → shows 27% (wrong!)
 * - Answer question → shows 5% (correct)
 *
 * Root cause: overall_mastery was calculated as average of ALL blocks,
 * but during practice it shows only the CURRENT block's mastery.
 */

import {
  calculateResumeProgress,
  type StoredBlockProgress,
} from '@/lib/utils/calculateResumeProgress';

describe('calculateResumeProgress', () => {
  const THREE_BLOCK_IDS = ['block_001', 'block_002', 'block_003'];

  describe('overall_mastery calculation', () => {
    it('should use current block mastery, not average of all blocks', () => {
      // Scenario: Resuming on block 2 (index 1)
      // Block 1: completed at 80% mastery
      // Block 2: in progress at 5% mastery
      // Block 3: not started (0%)
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.8, is_complete: true },
        { block_id: 'block_002', mastery_score: 0.05, is_complete: false },
        { block_id: 'block_003', mastery_score: 0, is_complete: false },
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        1, // current block index (block_002)
        storedProgress
      );

      // BUG: Currently returns average = (0.8 + 0.05 + 0) / 3 = 0.283
      // EXPECTED: Should return current block's mastery = 0.05
      expect(result.overall_mastery).toBe(0.05);
    });

    it('should show 0% when resuming on first block with no progress', () => {
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0, is_complete: false },
        { block_id: 'block_002', mastery_score: 0, is_complete: false },
        { block_id: 'block_003', mastery_score: 0, is_complete: false },
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        0, // current block index (block_001)
        storedProgress
      );

      expect(result.overall_mastery).toBe(0);
    });

    it('should show current block mastery when resuming on block 3', () => {
      // Scenario from user report:
      // - Block 3 at 5% → left → resumed → showed 53%
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.8, is_complete: true },
        { block_id: 'block_002', mastery_score: 0.75, is_complete: true },
        { block_id: 'block_003', mastery_score: 0.05, is_complete: false },
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        2, // current block index (block_003)
        storedProgress
      );

      // BUG: Returns average = (0.8 + 0.75 + 0.05) / 3 = 0.533 (53%)
      // EXPECTED: Should return current block's mastery = 0.05 (5%)
      expect(result.overall_mastery).toBe(0.05);
    });

    it('should handle missing stored progress gracefully', () => {
      // Only some blocks have stored progress
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.9, is_complete: true },
        // block_002 and block_003 missing from stored progress
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        1, // resuming on block_002 (no stored progress)
        storedProgress
      );

      // Current block has no stored progress, should default to 0
      expect(result.overall_mastery).toBe(0);
    });

    it('should handle null/undefined stored progress', () => {
      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        0,
        null
      );

      expect(result.overall_mastery).toBe(0);
      expect(result.completed_blocks).toBe(0);
      expect(result.blocks).toHaveLength(3);
    });
  });

  describe('completed_blocks calculation', () => {
    it('should count completed blocks correctly', () => {
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.8, is_complete: true },
        { block_id: 'block_002', mastery_score: 0.75, is_complete: true },
        { block_id: 'block_003', mastery_score: 0.05, is_complete: false },
      ];

      const result = calculateResumeProgress(THREE_BLOCK_IDS, 2, storedProgress);

      expect(result.completed_blocks).toBe(2);
    });

    it('should return 0 when no blocks completed', () => {
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.3, is_complete: false },
        { block_id: 'block_002', mastery_score: 0, is_complete: false },
      ];

      const result = calculateResumeProgress(THREE_BLOCK_IDS, 0, storedProgress);

      expect(result.completed_blocks).toBe(0);
    });

    /**
     * BUG FIX: When starting on block N without stored progress for earlier blocks,
     * blocks 0..N-1 should be implicitly marked as complete.
     *
     * Root cause: Student starts on block 3 (index 2) but completed_blocks = 0.
     * When block 3 completes, completed_blocks becomes 1, not 3.
     * isLastBlock check: 1 >= 3 = false, so session doesn't complete.
     *
     * The system tries to progress to block 4 (doesn't exist) → 400 error.
     */
    it('should mark earlier blocks as complete when starting mid-lesson (BUG FIX)', () => {
      // Scenario: Student starts on block 3 (index 2) with no stored progress
      // This means blocks 1 and 2 must have been completed to get here
      const storedProgress: StoredBlockProgress[] = [
        // No stored progress - fresh start on block 3
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        2, // starting on block 3 (index 2)
        storedProgress
      );

      // BUG: Currently returns completed_blocks = 0
      // EXPECTED: Should return completed_blocks = 2 (blocks 0 and 1 implicitly complete)
      expect(result.completed_blocks).toBe(2);

      // Blocks 0 and 1 should be marked as complete
      expect(result.blocks[0].is_complete).toBe(true);
      expect(result.blocks[1].is_complete).toBe(true);
      expect(result.blocks[2].is_complete).toBe(false);
    });

    it('should mark earlier blocks as complete when partial stored progress (BUG FIX)', () => {
      // Scenario: Student resumes on block 3, but stored progress only has current block
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_003', mastery_score: 0.05, is_complete: false },
        // blocks 1 and 2 not in stored progress
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        2, // resuming on block 3 (index 2)
        storedProgress
      );

      // blocks 0 and 1 should be implicitly complete since we're on block 2
      expect(result.completed_blocks).toBe(2);
      expect(result.blocks[0].is_complete).toBe(true);
      expect(result.blocks[1].is_complete).toBe(true);
      expect(result.blocks[2].is_complete).toBe(false);
    });

    it('should not override stored progress that explicitly marks block as incomplete', () => {
      // Edge case: stored progress explicitly marks block 1 as incomplete
      // This shouldn't happen in normal flow, but if it does, stored data wins
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.3, is_complete: false },
        { block_id: 'block_002', mastery_score: 0.5, is_complete: true },
        { block_id: 'block_003', mastery_score: 0.05, is_complete: false },
      ];

      const result = calculateResumeProgress(
        THREE_BLOCK_IDS,
        2, // resuming on block 3
        storedProgress
      );

      // Stored progress says block 1 is incomplete - respect that
      // But block 2 is complete per stored progress
      expect(result.completed_blocks).toBe(1);
      expect(result.blocks[0].is_complete).toBe(false);
      expect(result.blocks[1].is_complete).toBe(true);
    });
  });

  describe('blocks array', () => {
    it('should merge stored progress with all block IDs', () => {
      const storedProgress: StoredBlockProgress[] = [
        { block_id: 'block_001', mastery_score: 0.8, is_complete: true },
      ];

      const result = calculateResumeProgress(THREE_BLOCK_IDS, 1, storedProgress);

      expect(result.blocks).toHaveLength(3);
      expect(result.blocks[0]).toEqual({
        block_id: 'block_001',
        mastery_score: 0.8,
        is_complete: true,
      });
      expect(result.blocks[1]).toEqual({
        block_id: 'block_002',
        mastery_score: 0,
        is_complete: false,
      });
      expect(result.blocks[2]).toEqual({
        block_id: 'block_003',
        mastery_score: 0,
        is_complete: false,
      });
    });
  });
});
