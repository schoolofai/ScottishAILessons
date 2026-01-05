/**
 * validateQueryParams - Validation utilities for Appwrite query parameters
 *
 * Prevents "Invalid query: Equal queries require at least one value" errors
 * by validating parameters BEFORE they reach the Appwrite SDK.
 *
 * Per CLAUDE.md: "Never use fallback pattern - always throw exceptions for failing fast"
 *
 * @module lib/utils/validateQueryParams
 */

/** Valid difficulty levels */
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
type DifficultyLevel = typeof VALID_DIFFICULTIES[number];

/**
 * Validates parameters for getRandomQuestion before API call.
 *
 * @param lessonTemplateId - Lesson template ID (required, non-empty)
 * @param blockId - Block ID (required, non-empty)
 * @param difficulty - Question difficulty (required, must be easy/medium/hard)
 * @throws Error with descriptive message if any parameter is invalid
 *
 * @example
 * ```typescript
 * // In PracticeQuestionDriver.getRandomQuestion():
 * validateGetRandomQuestionParams(lessonTemplateId, blockId, difficulty);
 * // If validation passes, proceed with Appwrite query
 * ```
 */
export function validateGetRandomQuestionParams(
  lessonTemplateId: string,
  blockId: string,
  difficulty: DifficultyLevel
): void {
  // Validate lessonTemplateId
  if (!lessonTemplateId || lessonTemplateId.trim() === '') {
    throw new Error('lessonTemplateId is required and cannot be empty');
  }

  // Validate blockId
  if (!blockId || blockId.trim() === '') {
    throw new Error('blockId is required and cannot be empty');
  }

  // Validate difficulty
  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty as typeof VALID_DIFFICULTIES[number])) {
    throw new Error('difficulty is required and must be one of: easy, medium, hard');
  }
}
