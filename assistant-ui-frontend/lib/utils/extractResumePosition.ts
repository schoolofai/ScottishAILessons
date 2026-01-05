/**
 * extractResumePosition - Extracts starting block and difficulty from stored session
 *
 * Implements TDD-validated logic for determining where a student should resume
 * their practice session from.
 *
 * @module lib/utils/extractResumePosition
 */

import type { QuestionAvailability } from '@/lib/appwrite/driver/PracticeQuestionDriver';

/**
 * Difficulty levels supported by the practice system
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * Block progress entry from stored session
 */
export interface BlockProgress {
  block_id: string;
  current_difficulty?: string;
  is_complete?: boolean;
  mastery_score?: number;
}

/**
 * Stored session structure from practice_sessions collection
 * Exported for use in tests and type assertions
 */
export interface StoredSession {
  status?: 'active' | 'paused' | 'completed';
  current_block_index?: number;
  blocks_progress?: BlockProgress[];
  difficulty_mode?: 'adaptive' | 'fixed';
  fixed_difficulty?: string | null;
}

/**
 * Result of extracting resume position
 */
export interface ResumePosition {
  /** Block ID to start from */
  blockId: string;
  /** Block index (0-based) */
  blockIndex: number;
  /** Difficulty level to use */
  difficulty: DifficultyLevel;
  /** Whether this is a resume (true) or fresh start (false) */
  isResume: boolean;
}

/** Valid difficulty levels for validation */
const VALID_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard'];

/**
 * Validates if a string is a valid difficulty level
 */
function isValidDifficulty(value: unknown): value is DifficultyLevel {
  return typeof value === 'string' && VALID_DIFFICULTIES.includes(value as DifficultyLevel);
}

/**
 * Clamps a number to a valid range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Extracts the resume position from a stored session and question availability.
 *
 * This function determines where a student should start their practice session:
 * - For new sessions (no stored session): starts at block 0 with easy difficulty
 * - For completed sessions: starts fresh at block 0 with easy difficulty
 * - For active/paused sessions: resumes from saved block index and difficulty
 *
 * @param storedSession - The stored session from the database (may be null/undefined)
 * @param questionAvailability - Available questions organized by block
 * @returns ResumePosition with blockId, blockIndex, difficulty, and isResume flag
 * @throws Error if questionAvailability is missing or has no blocks
 *
 * @example
 * ```typescript
 * const position = extractResumePosition(session, availability);
 * wizard.startSessionV2(
 *   lessonId,
 *   position.blockId,
 *   position.difficulty,
 *   ...
 * );
 * ```
 */
export function extractResumePosition(
  storedSession: StoredSession | null | undefined,
  questionAvailability: QuestionAvailability
): ResumePosition {
  // ═══════════════════════════════════════════════════════════════
  // VALIDATION: Ensure questionAvailability is provided
  // ═══════════════════════════════════════════════════════════════
  if (!questionAvailability) {
    throw new Error('questionAvailability is required');
  }

  if (!questionAvailability.byBlock || questionAvailability.byBlock.length === 0) {
    throw new Error('No blocks available');
  }

  const totalBlocks = questionAvailability.byBlock.length;
  const firstBlock = questionAvailability.byBlock[0];

  // ═══════════════════════════════════════════════════════════════
  // FRESH START: No stored session or completed session
  // ═══════════════════════════════════════════════════════════════
  if (!storedSession || storedSession.status === 'completed') {
    return {
      blockId: firstBlock.blockId,
      blockIndex: 0,
      difficulty: 'easy',
      isResume: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // RESUME: Active or paused session
  // ═══════════════════════════════════════════════════════════════

  // 1. Extract and clamp block index to valid range
  let blockIndex = storedSession.current_block_index ?? 0;
  blockIndex = clamp(blockIndex, 0, totalBlocks - 1);

  const blockId = questionAvailability.byBlock[blockIndex].blockId;

  // 2. Extract difficulty with validation and fallback
  let difficulty: DifficultyLevel = 'easy'; // Default fallback

  // Check for fixed difficulty mode first (takes precedence)
  if (
    storedSession.difficulty_mode === 'fixed' &&
    storedSession.fixed_difficulty &&
    isValidDifficulty(storedSession.fixed_difficulty)
  ) {
    difficulty = storedSession.fixed_difficulty;
  }
  // Otherwise extract from blocks_progress for current block
  else if (storedSession.blocks_progress && storedSession.blocks_progress.length > 0) {
    const currentBlockProgress = storedSession.blocks_progress[blockIndex];

    if (currentBlockProgress && isValidDifficulty(currentBlockProgress.current_difficulty)) {
      difficulty = currentBlockProgress.current_difficulty;
    }
  }

  return {
    blockId,
    blockIndex,
    difficulty,
    isResume: true,
  };
}
