import { Query } from 'appwrite';
import { BaseDriver } from './BaseDriver';
import { CourseOutcome } from '../types/course-outcomes';

/**
 * Course Outcomes driver for fetching SQA-aligned learning outcomes
 * Provides methods to retrieve full CourseOutcome objects from Appwrite
 */
export class CourseOutcomesDriver extends BaseDriver {
  /**
   * Get course outcomes by outcomeId for a specific course
   *
   * Only returns outcomes that exist in the course_outcomes collection.
   * Missing outcomes are silently skipped (no errors thrown).
   *
   * @param courseId - SQA course code (e.g., "C844 73")
   * @param outcomeIds - Array of outcome IDs (e.g., ["O1", "O2"])
   * @returns Array of CourseOutcome objects (only found outcomes)
   *
   * @example
   * const driver = new CourseOutcomesDriver();
   * const outcomes = await driver.getOutcomesByIds("C844 73", ["O1", "O2"]);
   * // Returns CourseOutcome[] with full SQA data
   */
  async getOutcomesByIds(
    courseId: string,
    outcomeIds: string[]
  ): Promise<CourseOutcome[]> {
    try {
      // Filter out empty strings and trim whitespace
      const validIds = outcomeIds
        .filter(id => id && id.trim().length > 0)
        .map(id => id.trim());

      if (validIds.length === 0) {
        console.log('[CourseOutcomesDriver] No valid outcomeIds provided');
        return [];
      }

      console.log(`[CourseOutcomesDriver] Fetching outcomes for course ${courseId}:`, validIds);

      // Query course_outcomes collection
      // Matches both courseId and outcomeId from the list
      const outcomes = await this.list<CourseOutcome>('course_outcomes', [
        Query.equal('courseId', courseId),
        Query.equal('outcomeId', validIds)
      ]);

      console.log(`[CourseOutcomesDriver] Found ${outcomes.length}/${validIds.length} outcomes`);

      if (outcomes.length < validIds.length) {
        const foundIds = outcomes.map(o => o.outcomeId);
        const missingIds = validIds.filter(id => !foundIds.includes(id));
        console.warn(`[CourseOutcomesDriver] Missing outcomes:`, missingIds);
      }

      return outcomes;
    } catch (error) {
      console.error('[CourseOutcomesDriver] Failed to fetch outcomes:', error);
      throw this.handleError(error, `get outcomes for course ${courseId}`);
    }
  }

  /**
   * Extract outcomeIds from outcomeRefs array
   *
   * OutcomeIds are codes WITHOUT decimal points (e.g., "O1", "O2")
   * Assessment standards have decimals (e.g., "AS1.1", "AS1.2") and are filtered out
   *
   * @param outcomeRefs - Mixed array like ["O1", "AS1.1", "AS1.2"]
   * @returns Filtered array like ["O1"]
   *
   * @example
   * const refs = ["O1", "AS1.1", "AS1.2", "O2", "AS2.1"];
   * const ids = driver.extractOutcomeIds(refs);
   * // Returns: ["O1", "O2"]
   */
  extractOutcomeIds(outcomeRefs: string[]): string[] {
    const outcomeIds = outcomeRefs.filter(ref => {
      // Filter out nulls, empty strings, and codes with decimal points
      // Handles both "O1"/"AS1.1" pattern and "2"/"2.1" pattern
      return ref && typeof ref === 'string' && !ref.includes('.');
    });

    // Deduplicate in case outcomeRefs contains duplicate entries
    // e.g., ["2", "2", "2.1"] → ["2"]
    const uniqueOutcomeIds = [...new Set(outcomeIds)];

    console.log(`[CourseOutcomesDriver] Extracted ${uniqueOutcomeIds.length} unique outcomeIds from ${outcomeRefs.length} refs`);

    if (outcomeIds.length !== uniqueOutcomeIds.length) {
      console.warn(`[CourseOutcomesDriver] Removed ${outcomeIds.length - uniqueOutcomeIds.length} duplicate outcomeIds`);
    }

    return uniqueOutcomeIds;
  }

  /**
   * Get a single course outcome by outcomeId
   *
   * @param courseId - SQA course code
   * @param outcomeId - Outcome ID (e.g., "O1")
   * @returns CourseOutcome or null if not found
   */
  async getOutcomeById(
    courseId: string,
    outcomeId: string
  ): Promise<CourseOutcome | null> {
    try {
      const outcomes = await this.getOutcomesByIds(courseId, [outcomeId]);
      return outcomes.length > 0 ? outcomes[0] : null;
    } catch (error) {
      console.error(`[CourseOutcomesDriver] Failed to get outcome ${outcomeId}:`, error);
      return null;
    }
  }
}
