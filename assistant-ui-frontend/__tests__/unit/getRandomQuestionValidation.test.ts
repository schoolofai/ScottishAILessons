/**
 * TDD Tests for getRandomQuestion parameter validation
 *
 * Bug: When completing the last block's hard phase, the next block calculation
 * produces an undefined blockId (allBlockIds[outOfBoundsIndex] = undefined).
 * This undefined value gets passed to Appwrite Query.equal(), causing:
 *   "Invalid query: Equal queries require at least one value."
 *
 * Root Cause:
 * - Block 3 (index 2) completes → nextBlockIndex = 3
 * - allBlockIds[3] = undefined (only 3 blocks: indices 0, 1, 2)
 * - getRandomQuestion(lessonId, undefined, difficulty) called
 * - Query.equal('blockId', undefined) fails with 400 error
 *
 * Fix: Validate parameters in getRandomQuestion before making API call.
 * Per CLAUDE.md: "Never use fallback pattern - always throw exceptions for failing fast"
 */

import { validateGetRandomQuestionParams } from '@/lib/utils/validateQueryParams';

describe('getRandomQuestion parameter validation', () => {
  describe('validateGetRandomQuestionParams', () => {
    it('should throw error when lessonTemplateId is empty string', () => {
      expect(() =>
        validateGetRandomQuestionParams('', 'block_001', 'easy')
      ).toThrow('lessonTemplateId is required and cannot be empty');
    });

    it('should throw error when lessonTemplateId is undefined', () => {
      expect(() =>
        validateGetRandomQuestionParams(undefined as unknown as string, 'block_001', 'easy')
      ).toThrow('lessonTemplateId is required and cannot be empty');
    });

    it('should throw error when blockId is empty string', () => {
      expect(() =>
        validateGetRandomQuestionParams('lesson_001', '', 'easy')
      ).toThrow('blockId is required and cannot be empty');
    });

    it('should throw error when blockId is undefined', () => {
      expect(() =>
        validateGetRandomQuestionParams('lesson_001', undefined as unknown as string, 'easy')
      ).toThrow('blockId is required and cannot be empty');
    });

    it('should throw error when difficulty is empty string', () => {
      expect(() =>
        validateGetRandomQuestionParams('lesson_001', 'block_001', '' as 'easy' | 'medium' | 'hard')
      ).toThrow('difficulty is required and must be one of: easy, medium, hard');
    });

    it('should throw error when difficulty is invalid value', () => {
      expect(() =>
        validateGetRandomQuestionParams('lesson_001', 'block_001', 'super_hard' as 'easy' | 'medium' | 'hard')
      ).toThrow('difficulty is required and must be one of: easy, medium, hard');
    });

    it('should not throw when all parameters are valid', () => {
      expect(() =>
        validateGetRandomQuestionParams('lesson_001', 'block_001', 'easy')
      ).not.toThrow();

      expect(() =>
        validateGetRandomQuestionParams('lesson_001', 'block_001', 'medium')
      ).not.toThrow();

      expect(() =>
        validateGetRandomQuestionParams('lesson_001', 'block_001', 'hard')
      ).not.toThrow();
    });

    it('should provide descriptive error for debugging', () => {
      try {
        validateGetRandomQuestionParams('lesson_001', undefined as unknown as string, 'easy');
      } catch (error) {
        expect((error as Error).message).toContain('blockId');
        expect((error as Error).message).toContain('required');
      }
    });
  });
});
