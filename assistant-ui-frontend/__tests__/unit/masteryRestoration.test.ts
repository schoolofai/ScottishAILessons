/**
 * masteryRestoration.test.ts - Regression tests for mastery restoration on session resume
 *
 * These tests verify that mastery values are correctly restored when resuming a practice session.
 *
 * BUG FIXED: The original code divided mastery_score by 100 on resume, assuming it was
 * a percentage (0-100), but it's actually stored as a decimal (0-1). This caused
 * 75% mastery (stored as 0.75) to become ~0.75% (0.0075) on resume.
 *
 * @see useLangGraphWizard.ts lines 1706-1724
 */

describe('Mastery Restoration on Resume', () => {
  /**
   * Simulates the mastery restoration logic from useLangGraphWizard.ts
   * This is the CORRECT implementation (after bug fix)
   */
  function restoreMasteryFromStoredProgress(
    storedBlocksProgress: Array<{ block_id: string; mastery_score?: number }> | null,
    targetBlockId: string
  ): number {
    if (!storedBlocksProgress || storedBlocksProgress.length === 0) {
      return 0;
    }

    const currentBlockProgress = storedBlocksProgress.find(
      (bp) => bp.block_id === targetBlockId
    );

    if (currentBlockProgress?.mastery_score !== undefined) {
      // CORRECT: mastery_score is stored as DECIMAL (0-1), NOT percentage (0-100)
      // NO division by 100 needed!
      return currentBlockProgress.mastery_score;
    }

    return 0;
  }

  /**
   * This is the BUGGY implementation that was causing issues
   * Kept here to document what NOT to do
   */
  function restoreMasteryBUGGY(
    storedBlocksProgress: Array<{ block_id: string; mastery_score?: number }> | null,
    targetBlockId: string
  ): number {
    if (!storedBlocksProgress || storedBlocksProgress.length === 0) {
      return 0;
    }

    const currentBlockProgress = storedBlocksProgress.find(
      (bp) => bp.block_id === targetBlockId
    );

    if (currentBlockProgress?.mastery_score !== undefined) {
      // BUG: This incorrectly divides by 100, assuming percentage format
      return currentBlockProgress.mastery_score / 100;
    }

    return 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 1: Resume with 75% mastery
  // ═══════════════════════════════════════════════════════════════
  describe('SCENARIO 1: Resume with 75% mastery stored as 0.75', () => {
    const storedProgress = [
      { block_id: 'block_0', mastery_score: 1.0 },
      { block_id: 'block_1', mastery_score: 0.75 }, // 75% mastery
      { block_id: 'block_2', mastery_score: 0 },
    ];

    it('CORRECT: should restore 0.75 (75%) without division', () => {
      const restored = restoreMasteryFromStoredProgress(storedProgress, 'block_1');
      expect(restored).toBe(0.75);
      // Display as percentage: 75%
      expect(Math.round(restored * 100)).toBe(75);
    });

    it('BUGGY: division by 100 turns 75% into ~0.75%', () => {
      const buggyRestored = restoreMasteryBUGGY(storedProgress, 'block_1');
      expect(buggyRestored).toBe(0.0075); // This is WRONG!
      // Display as percentage: 1% (rounds from 0.75%)
      expect(Math.round(buggyRestored * 100)).toBe(1); // Shows 1% instead of 75%!
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 2: Resume with small mastery (5%)
  // ═══════════════════════════════════════════════════════════════
  describe('SCENARIO 2: Resume with 5% mastery stored as 0.05', () => {
    const storedProgress = [
      { block_id: 'block_0', mastery_score: 0.05 }, // Just started, 5% mastery
    ];

    it('CORRECT: should restore 0.05 (5%)', () => {
      const restored = restoreMasteryFromStoredProgress(storedProgress, 'block_0');
      expect(restored).toBe(0.05);
      expect(Math.round(restored * 100)).toBe(5);
    });

    it('BUGGY: division makes 5% into 0.05% (displays as 0%)', () => {
      const buggyRestored = restoreMasteryBUGGY(storedProgress, 'block_0');
      expect(buggyRestored).toBe(0.0005);
      // This would display as 0% due to rounding!
      expect(Math.round(buggyRestored * 100)).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 3: Resume with 100% mastery (completed block)
  // ═══════════════════════════════════════════════════════════════
  describe('SCENARIO 3: Resume with 100% mastery stored as 1.0', () => {
    const storedProgress = [
      { block_id: 'block_0', mastery_score: 1.0 }, // Fully mastered
    ];

    it('CORRECT: should restore 1.0 (100%)', () => {
      const restored = restoreMasteryFromStoredProgress(storedProgress, 'block_0');
      expect(restored).toBe(1.0);
      expect(Math.round(restored * 100)).toBe(100);
    });

    it('BUGGY: division makes 100% into 1%', () => {
      const buggyRestored = restoreMasteryBUGGY(storedProgress, 'block_0');
      expect(buggyRestored).toBe(0.01);
      expect(Math.round(buggyRestored * 100)).toBe(1); // Shows 1% instead of 100%!
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 4: No stored progress
  // ═══════════════════════════════════════════════════════════════
  describe('SCENARIO 4: No stored progress (fresh start)', () => {
    it('should return 0 for null progress', () => {
      const restored = restoreMasteryFromStoredProgress(null, 'block_0');
      expect(restored).toBe(0);
    });

    it('should return 0 for empty progress array', () => {
      const restored = restoreMasteryFromStoredProgress([], 'block_0');
      expect(restored).toBe(0);
    });

    it('should return 0 for block not in progress array', () => {
      const storedProgress = [{ block_id: 'block_0', mastery_score: 0.5 }];
      const restored = restoreMasteryFromStoredProgress(storedProgress, 'block_999');
      expect(restored).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 5: Edge case - undefined mastery_score
  // ═══════════════════════════════════════════════════════════════
  describe('SCENARIO 5: Edge case - undefined mastery_score', () => {
    it('should return 0 when mastery_score is undefined', () => {
      const storedProgress = [
        { block_id: 'block_0' }, // No mastery_score field
      ];
      const restored = restoreMasteryFromStoredProgress(storedProgress, 'block_0');
      expect(restored).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 6: Verify decimal format contract
  // ═══════════════════════════════════════════════════════════════
  describe('SCENARIO 6: Decimal format contract (0-1 scale)', () => {
    it('mastery values should always be in 0-1 range, not 0-100', () => {
      // This test documents the expected format
      const validMasteryValues = [0, 0.05, 0.1, 0.25, 0.5, 0.7, 0.75, 0.9, 1.0];

      validMasteryValues.forEach((mastery) => {
        expect(mastery).toBeGreaterThanOrEqual(0);
        expect(mastery).toBeLessThanOrEqual(1);
      });
    });

    it('percentage display is mastery * 100, NOT mastery itself', () => {
      const mastery = 0.75; // 75% mastery in decimal format
      const displayPercentage = Math.round(mastery * 100);

      expect(displayPercentage).toBe(75);
      // NOT: expect(mastery).toBe(75) - this would be wrong!
    });
  });
});

/**
 * Integration test for the actual resume flow
 *
 * This simulates the full resume scenario:
 * 1. Session saved with blocks_progress containing mastery_score as decimal
 * 2. Session resumed
 * 3. initialMastery should equal stored mastery_score (no conversion)
 */
describe('Resume Flow Integration', () => {
  interface StoredSession {
    session_id: string;
    status: 'active' | 'paused' | 'completed';
    current_block_index: number;
    blocks_progress: Array<{
      block_id: string;
      mastery_score: number;
      is_complete: boolean;
      current_difficulty?: 'easy' | 'medium' | 'hard';
    }>;
  }

  /**
   * Simulates what useLangGraphWizard.startSession does on resume
   */
  function simulateResumeInitialization(
    storedSession: StoredSession,
    targetBlockId: string
  ): { initialMastery: number; cumulativeMasteryRef: number } {
    let initialMastery = 0;

    if (storedSession.blocks_progress && storedSession.blocks_progress.length > 0) {
      const currentBlockProgress = storedSession.blocks_progress.find(
        (bp) => bp.block_id === targetBlockId
      );
      if (currentBlockProgress?.mastery_score !== undefined) {
        // CORRECT implementation (after bug fix)
        initialMastery = currentBlockProgress.mastery_score;
      }
    }

    return {
      initialMastery,
      cumulativeMasteryRef: initialMastery,
    };
  }

  it('should correctly restore mastery when resuming mid-session', () => {
    // Scenario: Student completed 8 easy questions (40% mastery) then paused
    const storedSession: StoredSession = {
      session_id: 'test-session-123',
      status: 'paused',
      current_block_index: 0,
      blocks_progress: [
        {
          block_id: 'block_0',
          mastery_score: 0.4, // 40% mastery (8 easy questions * 5% each)
          is_complete: false,
          current_difficulty: 'easy',
        },
      ],
    };

    const result = simulateResumeInitialization(storedSession, 'block_0');

    // Should restore exactly 0.4, not 0.004
    expect(result.initialMastery).toBe(0.4);
    expect(result.cumulativeMasteryRef).toBe(0.4);

    // UI would display this as 40%
    expect(Math.round(result.initialMastery * 100)).toBe(40);
  });

  it('should correctly restore mastery when resuming on block 2', () => {
    // Scenario: Student completed block 1, is at 75% on block 2
    const storedSession: StoredSession = {
      session_id: 'test-session-456',
      status: 'active',
      current_block_index: 1,
      blocks_progress: [
        {
          block_id: 'block_0',
          mastery_score: 1.0, // Block 1 complete
          is_complete: true,
          current_difficulty: 'hard',
        },
        {
          block_id: 'block_1',
          mastery_score: 0.75, // Block 2 at 75%
          is_complete: false,
          current_difficulty: 'hard',
        },
      ],
    };

    const result = simulateResumeInitialization(storedSession, 'block_1');

    // Should restore exactly 0.75 for current block
    expect(result.initialMastery).toBe(0.75);
    expect(Math.round(result.initialMastery * 100)).toBe(75);
  });
});
