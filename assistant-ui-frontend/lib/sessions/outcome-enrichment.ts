import { CourseOutcome } from '../types/course-outcomes';
import { CourseOutcomesDriver } from '../appwrite/driver/CourseOutcomesDriver';

/**
 * Enrich outcomeRefs with full CourseOutcome data from Appwrite
 *
 * This function takes a mixed array of outcome references (e.g., ["O1", "AS1.1", "AS1.2"])
 * and returns full CourseOutcome objects for the outcomeIds (codes without decimals).
 *
 * Assessment standard codes (with decimals) are automatically filtered out.
 *
 * @param outcomeRefs - Array like ["O1", "AS1.1", "AS1.2"]
 * @param courseId - SQA course code (e.g., "C844 73")
 * @param driver - CourseOutcomesDriver instance
 * @returns Array of full CourseOutcome objects (only found ones, empty array on failure)
 *
 * @example
 * const refs = ["O1", "AS1.1", "AS1.2", "O2"];
 * const enriched = await enrichOutcomeRefs(refs, "C844 73", driver);
 * // Returns: [CourseOutcome for O1, CourseOutcome for O2]
 */
export async function enrichOutcomeRefs(
  outcomeRefs: string[],
  courseId: string,
  driver: CourseOutcomesDriver
): Promise<CourseOutcome[]> {
  try {
    // Validate inputs
    if (!outcomeRefs || outcomeRefs.length === 0) {
      return [];
    }

    if (!courseId || courseId.trim().length === 0) {
      console.warn('[enrichOutcomeRefs] No courseId provided, skipping enrichment');
      return [];
    }

    // Extract only outcomeIds (codes without decimal points)
    const outcomeIds = driver.extractOutcomeIds(outcomeRefs);

    if (outcomeIds.length === 0) {
      // All refs were assessment standards (with decimals), no outcomeIds to enrich
      return [];
    }

    // Fetch full CourseOutcome objects from Appwrite
    const enrichedOutcomes = await driver.getOutcomesByIds(courseId, outcomeIds);

    return enrichedOutcomes;

  } catch (error) {
    console.error('[enrichOutcomeRefs] Failed to enrich outcomes:', error);
    // Return empty array on failure - enriched_outcomes is an optional field
    // Teaching can continue without SQA alignment summary
    return [];
  }
}

/**
 * Check if an array of outcomeRefs contains any outcomeIds (codes without decimals)
 *
 * @param outcomeRefs - Array to check
 * @returns True if at least one outcomeId exists
 */
export function hasOutcomeIds(outcomeRefs: string[]): boolean {
  if (!outcomeRefs || outcomeRefs.length === 0) {
    return false;
  }

  return outcomeRefs.some(ref => ref && typeof ref === 'string' && !ref.includes('.'));
}
