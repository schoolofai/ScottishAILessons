/**
 * Unit Tests for extractResumePosition() utility
 *
 * TDD Phase 1 (RED): These tests define expected behavior before implementation.
 * Tests cover 14 scenarios including edge cases for session resumption logic.
 */

import { extractResumePosition, type StoredSession } from '@/lib/utils/extractResumePosition';
import type { QuestionAvailability } from '@/lib/appwrite/driver/PracticeQuestionDriver';

describe('extractResumePosition', () => {
  // Mock questionAvailability with 4 blocks
  // Using the actual QuestionAvailability structure from PracticeQuestionDriver
  const mockAvailability: QuestionAvailability = {
    lessonTemplateId: 'test-lesson-123',
    hasQuestions: true,
    totalCount: 40,
    byDifficulty: { easy: 16, medium: 12, hard: 12 },
    byBlock: [
      { blockId: 'block_0', blockTitle: 'Block 1', count: 10 },
      { blockId: 'block_1', blockTitle: 'Block 2', count: 10 },
      { blockId: 'block_2', blockTitle: 'Block 3', count: 10 },
      { blockId: 'block_3', blockTitle: 'Block 4', count: 10 },
    ],
  };

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 1: Fresh Start - No stored session
  // ═══════════════════════════════════════════════════════════════
  test('returns first block with easy difficulty when no stored session', () => {
    const result = extractResumePosition(undefined, mockAvailability);

    expect(result.blockId).toBe('block_0');
    expect(result.blockIndex).toBe(0);
    expect(result.difficulty).toBe('easy');
    expect(result.isResume).toBe(false);
  });

  test('returns first block when stored_session is null', () => {
    const result = extractResumePosition(null, mockAvailability);

    expect(result.blockId).toBe('block_0');
    expect(result.difficulty).toBe('easy');
    expect(result.isResume).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 2: Resume from Block 0 with Easy (just started)
  // ═══════════════════════════════════════════════════════════════
  test('resumes from block 0 with easy when session just started', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 0,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'easy', mastery_score: 0.1 },
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_0');
    expect(result.blockIndex).toBe(0);
    expect(result.difficulty).toBe('easy');
    expect(result.isResume).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 3: Resume from Block 2 with Medium difficulty
  // ═══════════════════════════════════════════════════════════════
  test('resumes from block 2 with medium difficulty', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 2,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'hard', mastery_score: 0.85, is_complete: true },
        { block_id: 'block_1', current_difficulty: 'hard', mastery_score: 0.90, is_complete: true },
        { block_id: 'block_2', current_difficulty: 'medium', mastery_score: 0.45 },
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_2');
    expect(result.blockIndex).toBe(2);
    expect(result.difficulty).toBe('medium');
    expect(result.isResume).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 4: Resume from Last Block (Block 3) with Hard
  // ═══════════════════════════════════════════════════════════════
  test('resumes from last block with hard difficulty', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 3,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_1', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_2', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_3', current_difficulty: 'hard', mastery_score: 0.60 },
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_3');
    expect(result.blockIndex).toBe(3);
    expect(result.difficulty).toBe('hard');
    expect(result.isResume).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 5: Completed Session - Treat as Fresh Start
  // ═══════════════════════════════════════════════════════════════
  test('treats completed session as fresh start', () => {
    const storedSession: StoredSession = {
      status: 'completed', // Key: session is finished
      current_block_index: 3,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_1', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_2', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_3', current_difficulty: 'hard', is_complete: true },
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_0');
    expect(result.difficulty).toBe('easy');
    expect(result.isResume).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 6: Paused Session - Resume from Saved Position
  // ═══════════════════════════════════════════════════════════════
  test('resumes from paused session correctly', () => {
    const storedSession: StoredSession = {
      status: 'paused', // Paused should also resume
      current_block_index: 1,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'hard', is_complete: true },
        { block_id: 'block_1', current_difficulty: 'medium', mastery_score: 0.35 },
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_1');
    expect(result.difficulty).toBe('medium');
    expect(result.isResume).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 7: Missing blocks_progress Array
  // ═══════════════════════════════════════════════════════════════
  test('falls back to easy when blocks_progress is missing', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 2,
      blocks_progress: undefined, // Missing!
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_2');
    expect(result.blockIndex).toBe(2);
    expect(result.difficulty).toBe('easy'); // Fallback
    expect(result.isResume).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 8: Empty blocks_progress Array
  // ═══════════════════════════════════════════════════════════════
  test('falls back to easy when blocks_progress is empty array', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 1,
      blocks_progress: [], // Empty array
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockId).toBe('block_1');
    expect(result.difficulty).toBe('easy');
    expect(result.isResume).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 9: Block Index Out of Bounds
  // ═══════════════════════════════════════════════════════════════
  test('clamps block index when out of bounds (too high)', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 99, // Way beyond available blocks
      blocks_progress: [],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    // Should clamp to last available block (index 3)
    expect(result.blockIndex).toBe(3);
    expect(result.blockId).toBe('block_3');
    expect(result.difficulty).toBe('easy');
  });

  test('clamps negative block index to 0', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: -1, // Invalid negative
      blocks_progress: [],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockIndex).toBe(0);
    expect(result.blockId).toBe('block_0');
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 10: Missing current_block_index (null/undefined)
  // ═══════════════════════════════════════════════════════════════
  test('defaults to block 0 when current_block_index is undefined', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: undefined,
      blocks_progress: [{ block_id: 'block_0', current_difficulty: 'medium' }],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockIndex).toBe(0);
    expect(result.difficulty).toBe('medium');
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 11: Invalid Difficulty Value
  // ═══════════════════════════════════════════════════════════════
  test('falls back to easy when difficulty is invalid string', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 1,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'hard' },
        { block_id: 'block_1', current_difficulty: 'super_hard' }, // Invalid!
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.difficulty).toBe('easy'); // Fallback for invalid
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 12: Block Progress Array Shorter Than Index
  // ═══════════════════════════════════════════════════════════════
  test('falls back to easy when progress array doesnt contain current block', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 2,
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'hard' },
        // Missing block_1 and block_2 progress
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.blockIndex).toBe(2);
    expect(result.blockId).toBe('block_2');
    expect(result.difficulty).toBe('easy'); // Fallback
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 13: Fixed Difficulty Mode (uses fixed_difficulty)
  // ═══════════════════════════════════════════════════════════════
  test('uses fixed_difficulty when set (ignores blocks_progress difficulty)', () => {
    const storedSession: StoredSession = {
      status: 'active',
      current_block_index: 1,
      difficulty_mode: 'fixed',
      fixed_difficulty: 'hard', // Global fixed difficulty
      blocks_progress: [
        { block_id: 'block_0', current_difficulty: 'easy' },
        { block_id: 'block_1', current_difficulty: 'easy' }, // Should be ignored
      ],
    };

    const result = extractResumePosition(storedSession, mockAvailability);

    expect(result.difficulty).toBe('hard'); // Uses fixed_difficulty
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 14: No questionAvailability (edge case)
  // ═══════════════════════════════════════════════════════════════
  test('throws error when questionAvailability is missing', () => {
    const storedSession: StoredSession = { status: 'active', current_block_index: 0 };

    expect(() => {
      extractResumePosition(storedSession, null as unknown as QuestionAvailability);
    }).toThrow('questionAvailability is required');
  });

  test('throws error when questionAvailability has no blocks', () => {
    const emptyAvailability: QuestionAvailability = {
      lessonTemplateId: 'test-lesson-123',
      hasQuestions: false,
      totalCount: 0,
      byDifficulty: { easy: 0, medium: 0, hard: 0 },
      byBlock: [],
    };

    expect(() => {
      extractResumePosition(undefined, emptyAvailability);
    }).toThrow('No blocks available');
  });
});
