/**
 * Block Progression Logic for Practice Wizard V2
 *
 * This module provides pure functions for managing multi-block
 * progression within a practice session.
 *
 * Progression Rules:
 * - Blocks are completed sequentially (block 1 → block 2 → ...)
 * - Each block starts with easy difficulty
 * - Session is complete when all blocks are complete
 * - State updates happen after block completion
 */

import type { BlockProgress } from "./blockMastery";
import { isBlockComplete, checkBlockCompletion } from "./blockCompletion";
import { createEmptyBlockProgress } from "./blockMastery";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full session state for multi-block practice
 */
export interface SessionState {
  /** Index of current block (0-based) */
  current_block_index: number;
  /** Total number of blocks in the lesson */
  total_blocks: number;
  /** Progress for each block */
  blocks_progress: BlockProgressEntry[];
  /** Number of completed blocks */
  completed_blocks: number;
  /** Overall session mastery (average of all blocks) */
  overall_mastery: number;
  /** Whether session is complete */
  session_complete: boolean;
  /** Current stage in wizard flow */
  stage: "question" | "feedback" | "complete" | "loading";
}

/**
 * Block progress with block identifier
 */
export interface BlockProgressEntry extends BlockProgress {
  /** Block document ID */
  block_id: string;
}

/**
 * Result of session progression check
 */
export interface ProgressionResult {
  /** Should progress to next block */
  should_progress: boolean;
  /** New block index (if progressing) */
  new_block_index: number | null;
  /** Is session complete */
  session_complete: boolean;
  /** Updated session state */
  updated_state: SessionState;
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Progression Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the index of the next incomplete block.
 *
 * Returns -1 if all blocks are complete.
 *
 * @param state - Current session state
 * @returns Index of next incomplete block, or -1
 */
export function getNextIncompleteBlockIndex(state: SessionState): number {
  for (let i = 0; i < state.blocks_progress.length; i++) {
    if (!state.blocks_progress[i].is_complete) {
      return i;
    }
  }
  return -1; // All blocks complete
}

/**
 * Check if the session is complete.
 *
 * Session is complete when all blocks have is_complete=true.
 *
 * @param state - Current session state
 * @returns Whether session is complete
 */
export function isSessionComplete(state: SessionState): boolean {
  return state.blocks_progress.every((block) => block.is_complete);
}

/**
 * Check if should progress to next block after answering a question.
 *
 * @param state - Current session state
 * @returns Whether to progress to next block
 */
export function shouldProgressToNextBlock(state: SessionState): boolean {
  const currentBlock = state.blocks_progress[state.current_block_index];
  if (!currentBlock) {
    return false;
  }
  return isBlockComplete(currentBlock);
}

/**
 * Calculate overall session mastery (average of all block masteries).
 *
 * @param blocksProgress - Array of block progress
 * @returns Overall mastery (0-1)
 */
export function calculateOverallMastery(
  blocksProgress: BlockProgressEntry[]
): number {
  if (blocksProgress.length === 0) {
    return 0;
  }

  const totalMastery = blocksProgress.reduce(
    (sum, block) => sum + block.mastery_score,
    0
  );

  return totalMastery / blocksProgress.length;
}

/**
 * Update completed blocks count.
 *
 * @param state - Current session state
 * @returns Updated state with correct completed_blocks count
 */
export function updateCompletedBlocksCount(state: SessionState): SessionState {
  const completedBlocks = state.blocks_progress.filter(
    (block) => block.is_complete
  ).length;

  return {
    ...state,
    completed_blocks: completedBlocks,
  };
}

/**
 * Transition to next block after completing current block.
 *
 * @param state - Current session state
 * @returns Updated state with new block index or session complete
 */
export function transitionAfterBlockComplete(
  state: SessionState
): SessionState {
  const nextBlockIndex = getNextIncompleteBlockIndex(state);

  // All blocks complete → session complete
  if (nextBlockIndex === -1) {
    return {
      ...state,
      session_complete: true,
      stage: "complete",
      completed_blocks: state.total_blocks,
      overall_mastery: calculateOverallMastery(state.blocks_progress),
    };
  }

  // Progress to next block
  return {
    ...state,
    current_block_index: nextBlockIndex,
    completed_blocks: state.blocks_progress.filter((b) => b.is_complete).length,
    overall_mastery: calculateOverallMastery(state.blocks_progress),
    stage: "question", // Ready for next question
  };
}

/**
 * Process the completion of a question and check for block/session progression.
 *
 * @param state - Current session state
 * @returns Progression result with updated state
 */
export function processQuestionCompletion(
  state: SessionState
): ProgressionResult {
  const currentBlockProgress = state.blocks_progress[state.current_block_index];

  // Check if current block is now complete
  const blockComplete = isBlockComplete(currentBlockProgress);

  if (!blockComplete) {
    // Block not complete, stay in current block
    return {
      should_progress: false,
      new_block_index: null,
      session_complete: false,
      updated_state: state,
    };
  }

  // Block is complete - mark it and transition
  const updatedBlocksProgress = [...state.blocks_progress];
  updatedBlocksProgress[state.current_block_index] = {
    ...currentBlockProgress,
    is_complete: true,
    completed_at: new Date().toISOString(),
  };

  const stateWithCompletedBlock: SessionState = {
    ...state,
    blocks_progress: updatedBlocksProgress,
  };

  // Transition to next block or session complete
  const transitionedState = transitionAfterBlockComplete(stateWithCompletedBlock);

  return {
    should_progress: !transitionedState.session_complete,
    new_block_index: transitionedState.session_complete
      ? null
      : transitionedState.current_block_index,
    session_complete: transitionedState.session_complete,
    updated_state: transitionedState,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// State Management Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Update progress for the current block.
 *
 * @param state - Current session state
 * @param updatedBlockProgress - New progress for current block
 * @returns Updated session state
 */
export function updateCurrentBlockProgress(
  state: SessionState,
  updatedBlockProgress: Partial<BlockProgress>
): SessionState {
  const updatedBlocksProgress = [...state.blocks_progress];
  updatedBlocksProgress[state.current_block_index] = {
    ...updatedBlocksProgress[state.current_block_index],
    ...updatedBlockProgress,
  };

  return {
    ...state,
    blocks_progress: updatedBlocksProgress,
    overall_mastery: calculateOverallMastery(updatedBlocksProgress),
  };
}

/**
 * Increment questions attempted for current block at given difficulty.
 *
 * @param state - Current session state
 * @param difficulty - Difficulty of question
 * @returns Updated session state
 */
export function incrementQuestionsAttempted(
  state: SessionState,
  difficulty: "easy" | "medium" | "hard"
): SessionState {
  const currentBlock = state.blocks_progress[state.current_block_index];

  return updateCurrentBlockProgress(state, {
    questions_attempted: {
      ...currentBlock.questions_attempted,
      [difficulty]: currentBlock.questions_attempted[difficulty] + 1,
    },
  });
}

/**
 * Update progress after answering a question.
 *
 * @param state - Current session state
 * @param difficulty - Difficulty of question answered
 * @param isCorrect - Whether answer was correct
 * @returns Updated session state
 */
export function updateProgressAfterAnswer(
  state: SessionState,
  difficulty: "easy" | "medium" | "hard",
  isCorrect: boolean
): SessionState {
  const currentBlock = state.blocks_progress[state.current_block_index];

  const newAttempted = {
    ...currentBlock.questions_attempted,
    [difficulty]: currentBlock.questions_attempted[difficulty] + 1,
  };

  const newCorrect = { ...currentBlock.questions_correct };
  if (isCorrect) {
    newCorrect[difficulty] = currentBlock.questions_correct[difficulty] + 1;
  }

  // Recalculate mastery (simplified - using accuracy * weight)
  const totalAttempted =
    newAttempted.easy + newAttempted.medium + newAttempted.hard;
  const totalCorrect = newCorrect.easy + newCorrect.medium + newCorrect.hard;

  let mastery = 0;
  if (totalAttempted > 0) {
    // Simple weighted average
    const weights = { easy: 0.2, medium: 0.4, hard: 0.4 };
    let totalWeight = 0;
    let weightedSum = 0;

    for (const diff of ["easy", "medium", "hard"] as const) {
      if (newAttempted[diff] > 0) {
        const accuracy = newCorrect[diff] / newAttempted[diff];
        weightedSum += accuracy * weights[diff];
        totalWeight += weights[diff];
      }
    }

    mastery = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  return updateCurrentBlockProgress(state, {
    questions_attempted: newAttempted,
    questions_correct: newCorrect,
    mastery_score: mastery,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new session state with given blocks.
 *
 * @param blockIds - Array of block IDs
 * @returns Initial session state
 */
export function createSessionState(blockIds: string[]): SessionState {
  return {
    current_block_index: 0,
    total_blocks: blockIds.length,
    blocks_progress: blockIds.map((blockId) => ({
      ...createEmptyBlockProgress(),
      block_id: blockId,
    })),
    completed_blocks: 0,
    overall_mastery: 0,
    session_complete: false,
    stage: "question",
  };
}

/**
 * Get the current block's progress.
 *
 * @param state - Current session state
 * @returns Current block progress or undefined
 */
export function getCurrentBlock(
  state: SessionState
): BlockProgressEntry | undefined {
  return state.blocks_progress[state.current_block_index];
}
