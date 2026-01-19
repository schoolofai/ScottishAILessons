/**
 * Common Course Seeding Library
 *
 * This module provides shared utilities for course seeding operations used by both
 * seedSingleCourse.ts and bulkSeedAllCourses.ts.
 *
 * Responsibilities:
 * - Normalize course codes and field names
 * - Process SQA course documents
 * - Create course documents in database
 * - Create course_outcomes documents in database
 * - Route extraction logic based on structure type
 *
 * Extracted from bulkSeedAllCourses.ts to enable code reuse across scripts.
 */

import { Databases, ID, Query } from 'node-appwrite';
import {
  extractOutcomesFromUnitsBased,
  type CourseOutcome
} from './unitBasedExtraction';
import {
  extractOutcomesFromSkillsBased,
  validateSkillsBasedStructure,
  type CourseOutcomeImport as SkillsBasedOutcome
} from './skillsBasedExtraction';

/**
 * Delay function for rate limit management
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SQA Course document structure from sqa_education.sqa_current collection
 */
export interface SQACourseDoc {
  $id: string;
  subject: string;
  level: string;
  course_code?: string;
  data: string | object;
}

/**
 * Processed course after extraction and normalization
 */
export interface ProcessedCourse {
  courseId: string;
  sqaCode: string;
  subject: string;
  level: string;
  data: any;
}

/**
 * Normalize course code for courseId generation
 *
 * Rules:
 * 1. Remove all spaces
 * 2. Convert to lowercase
 *
 * Examples:
 * - "C769 73" → "c76973"
 * - "C747 75" → "c74775"
 */
export function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/\s+/g, '').toLowerCase();
}

/**
 * Convert underscore to hyphen for subject/level fields
 *
 * Database storage uses hyphens, CLI input uses underscores.
 *
 * Examples:
 * - "national_3" → "national-3"
 * - "application_of_mathematics" → "application-of-mathematics"
 */
export function underscoreToHyphen(str: string): string {
  return str.replace(/_/g, '-');
}

/**
 * Delete all course_outcomes documents for a given courseId
 *
 * Used when --force-update flag is set to replace existing outcomes.
 * Queries all outcomes for the courseId and deletes them in batches with rate limiting.
 *
 * Fail-fast pattern: Throws error if any deletion fails.
 *
 * @param databases - Appwrite Databases instance
 * @param courseId - Course identifier to delete outcomes for
 * @param dryRun - If true, skip actual deletion and just count
 * @returns Number of outcomes deleted
 * @throws Error if any deletion fails
 */
export async function deleteOutcomesForCourse(
  databases: Databases,
  courseId: string,
  dryRun: boolean
): Promise<number> {
  // Fetch all outcomes for this courseId (paginated)
  const allOutcomes: any[] = [];
  let offset = 0;
  const batchSize = 100;
  let hasMore = true;

  while (hasMore) {
    const result = await databases.listDocuments(
      'default',
      'course_outcomes',
      [
        Query.equal('courseId', courseId),
        Query.limit(batchSize),
        Query.offset(offset)
      ]
    );

    allOutcomes.push(...result.documents);
    hasMore = result.documents.length === batchSize;
    offset += batchSize;
  }

  if (dryRun) {
    return allOutcomes.length; // Would delete count
  }

  // Delete all outcomes with rate limiting
  let deletedCount = 0;
  for (let i = 0; i < allOutcomes.length; i++) {
    const outcome = allOutcomes[i];
    try {
      await databases.deleteDocument(
        'default',
        'course_outcomes',
        outcome.$id
      );
      deletedCount++;

      // Add delay between deletions to avoid rate limits
      // Skip delay for the last deletion
      if (i < allOutcomes.length - 1) {
        await delay(100); // 100ms between deletions
      }
    } catch (error: any) {
      throw new Error(
        `Failed to delete outcome ${outcome.$id} for course ${courseId}: ${error.message}`
      );
    }
  }

  return deletedCount;
}

/**
 * Process single SQA course document to extract course code and data
 *
 * Performs:
 * 1. JSON parsing of data field (if string)
 * 2. Course code extraction from data.qualification.course_code
 * 3. CourseId generation using normalization rules
 *
 * Fail-fast pattern: Throws error if course_code not found (no silent fallbacks).
 *
 * @param sqaDoc - SQA course document from sqa_education.sqa_current
 * @returns ProcessedCourse with normalized fields
 * @throws Error if course_code missing or data malformed
 */
export function processSQACourse(sqaDoc: SQACourseDoc): ProcessedCourse {
  // Parse the data field
  let parsedData;
  if (typeof sqaDoc.data === 'string') {
    parsedData = JSON.parse(sqaDoc.data);
  } else {
    parsedData = sqaDoc.data;
  }

  // Extract course_code from nested qualification object (FAIL-FAST, NO FALLBACK)
  // SQA data structure: data.subjects[0].levels[0].qualification.course_code
  const courseCode = parsedData.subjects?.[0]?.levels?.[0]?.qualification?.course_code;
  if (!courseCode) {
    throw new Error(
      `No course_code found in data.subjects[0].levels[0].qualification.\n\n` +
      `Actual structure: ${JSON.stringify(parsedData.subjects?.[0]?.levels?.[0]?.qualification || {})}`
    );
  }

  // Generate courseId
  const normalizedCode = normalizeCourseCode(courseCode);
  const courseId = `course_${normalizedCode}`;

  return {
    courseId,
    sqaCode: courseCode,
    subject: sqaDoc.subject,
    level: sqaDoc.level,
    data: parsedData
  };
}

/**
 * Create or update course document in default.courses collection
 *
 * Implements idempotent create with optional force-update:
 * 1. Check if course already exists by courseId
 * 2. If exists AND forceUpdate=true: Update all fields from SQA data
 * 3. If exists AND forceUpdate=false: Skip (existing behavior)
 * 4. If not exists: Create new course
 *
 * @param databases - Appwrite Databases instance
 * @param processedCourse - Processed course data
 * @param dryRun - If true, skip actual database write
 * @param forceUpdate - If true, update existing courses instead of skipping
 * @returns Object indicating if course was created, updated, or skipped
 */
export async function createCourseDocument(
  databases: Databases,
  processedCourse: ProcessedCourse,
  dryRun: boolean,
  forceUpdate: boolean = false
): Promise<{ created: boolean; updated: boolean; skipped: boolean }> {
  const subject = underscoreToHyphen(processedCourse.subject);
  const level = underscoreToHyphen(processedCourse.level);

  // Check if course already exists (idempotency check)
  const existing = await databases.listDocuments(
    'default',
    'courses',
    [Query.equal('courseId', processedCourse.courseId), Query.limit(1)]
  );

  if (existing.documents.length > 0) {
    if (forceUpdate) {
      // UPDATE PATH: Replace all fields from SQA data
      if (dryRun) {
        return { created: false, updated: true, skipped: false }; // Would update
      }

      const docId = existing.documents[0].$id;
      try {
        await databases.updateDocument(
          'default',
          'courses',
          docId,
          {
            courseId: processedCourse.courseId,
            subject,
            level,
            sqaCode: processedCourse.sqaCode,
            schema_version: 2
          }
        );
        return { created: false, updated: true, skipped: false };
      } catch (error: any) {
        throw new Error(
          `Failed to update course ${processedCourse.courseId}: ${error.message}`
        );
      }
    } else {
      // SKIP PATH: Existing behavior when forceUpdate=false
      return { created: false, updated: false, skipped: true };
    }
  }

  // CREATE PATH: Course doesn't exist
  if (dryRun) {
    return { created: true, updated: false, skipped: false }; // Would create
  }

  try {
    await databases.createDocument(
      'default',
      'courses',
      'unique()',
      {
        courseId: processedCourse.courseId,
        subject,
        level,
        sqaCode: processedCourse.sqaCode,
        schema_version: 2
      }
    );
    return { created: true, updated: false, skipped: false };
  } catch (error: any) {
    throw new Error(
      `Failed to create course ${processedCourse.courseId}: ${error.message}`
    );
  }
}

/**
 * Extract outcomes from processed course data
 *
 * Automatically detects structure type and routes to appropriate extraction:
 * - "unit_based" → extractOutcomesFromUnitsBased() (National 3/4)
 * - "skills_based" → extractOutcomesFromSkillsBased() (National 5+)
 *
 * For skills-based courses, performs validation before extraction.
 *
 * @param processedCourse - Processed course with parsed data
 * @returns Array of CourseOutcome documents
 * @throws Error if structure invalid or missing required fields
 */
export function extractOutcomes(processedCourse: ProcessedCourse): CourseOutcome[] {
  const data = processedCourse.data;

  // SQA data structure: data.subjects[0].levels[0] contains the level-specific data
  const levelData = data.subjects?.[0]?.levels?.[0];
  if (!levelData) {
    throw new Error('No level data found in SQA course structure (expected data.subjects[0].levels[0])');
  }

  // Detect structure type (default to unit_based for backward compatibility)
  const structureType = levelData.course_structure?.structure_type || 'unit_based';

  if (structureType === 'skills_based') {
    // ══════════════════════════════════════════════════════════════
    // SKILLS-BASED EXTRACTION (National 5+)
    // ══════════════════════════════════════════════════════════════
    const skillsFramework = levelData.course_structure.skills_framework;
    const topicAreas = levelData.course_structure.topic_areas || [];

    // Fail-fast validation
    if (!skillsFramework || !skillsFramework.skills) {
      throw new Error('Skills-based course missing skills_framework');
    }

    if (topicAreas.length === 0) {
      throw new Error('Skills-based course missing topic_areas');
    }

    // Validate structure before extraction
    const validation = validateSkillsBasedStructure(skillsFramework, topicAreas);

    if (!validation.isValid) {
      const errorDetails = validation.errors.join('\n  - ');
      throw new Error(
        `Skills-based structure validation failed:\n  - ${errorDetails}`
      );
    }

    // Log warnings if present (non-fatal)
    if (validation.warnings.length > 0) {
      console.warn(`   ⚠️  ${validation.warnings.length} warnings:`);
      validation.warnings.slice(0, 3).forEach(warn => console.warn(`      - ${warn}`));
      if (validation.warnings.length > 3) {
        console.warn(`      ... and ${validation.warnings.length - 3} more`);
      }
    }

    // Extract outcomes using skills-based logic
    const skillsBasedOutcomes = extractOutcomesFromSkillsBased(
      processedCourse.courseId,
      processedCourse.sqaCode,
      skillsFramework,
      topicAreas
    );

    return skillsBasedOutcomes;

  } else {
    // ══════════════════════════════════════════════════════════════
    // UNIT-BASED EXTRACTION (National 3/4)
    // ══════════════════════════════════════════════════════════════
    const units = levelData.course_structure?.units || [];

    // Fail-fast: no units means invalid structure
    if (units.length === 0) {
      throw new Error('No units found in course data (expected levelData.course_structure.units)');
    }

    const outcomes = extractOutcomesFromUnitsBased(
      processedCourse.courseId,
      processedCourse.sqaCode,
      units
    );

    return outcomes;
  }
}

/**
 * Create or update course_outcomes documents in default.course_outcomes collection
 *
 * Implements idempotent create with optional force-update:
 * 1. Check if outcomes already exist for courseId
 * 2. If exist AND forceUpdate=true: Delete all old outcomes, create fresh from SQA data
 * 3. If exist AND forceUpdate=false: Skip (existing behavior)
 * 4. If not exist: Create all outcomes
 *
 * Rate limiting: 300ms delay between outcome creations to avoid Appwrite rate limits.
 *
 * @param databases - Appwrite Databases instance
 * @param outcomes - Array of CourseOutcome documents to create
 * @param courseId - Course identifier for idempotency check
 * @param dryRun - If true, skip actual database writes
 * @param forceUpdate - If true, delete existing outcomes and recreate
 * @returns Object with counts of outcomes created/deleted and operation status
 * @throws Error if any outcome operation fails
 */
export async function createOutcomeDocuments(
  databases: Databases,
  outcomes: CourseOutcome[],
  courseId: string,
  dryRun: boolean,
  forceUpdate: boolean = false
): Promise<{ created: number; deleted: number; updated: boolean; skipped: boolean }> {
  // Check if outcomes already exist (idempotency check)
  const existingCheck = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (existingCheck.documents.length > 0) {
    if (forceUpdate) {
      // UPDATE PATH: Delete all + recreate strategy
      if (dryRun) {
        const deletedCount = await deleteOutcomesForCourse(databases, courseId, true);
        return {
          created: outcomes.length,
          deleted: deletedCount,
          updated: true,
          skipped: false
        }; // Would delete + create
      }

      // Delete all existing outcomes
      const deletedCount = await deleteOutcomesForCourse(databases, courseId, false);

      // Create fresh outcomes (same logic as CREATE PATH below)
      let createdCount = 0;
      for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        try {
          const docData = {
            courseId: outcome.courseId,
            courseSqaCode: outcome.courseSqaCode,
            unitCode: outcome.unitCode,
            unitTitle: outcome.unitTitle,
            scqfCredits: outcome.scqfCredits,
            outcomeId: outcome.outcomeId,
            outcomeTitle: outcome.outcomeTitle,
            assessmentStandards: outcome.assessmentStandards,
            teacherGuidance: outcome.teacherGuidance,
            keywords: JSON.stringify(outcome.keywords)
          };

          await databases.createDocument(
            'default',
            'course_outcomes',
            ID.unique(),
            docData
          );

          createdCount++;

          // Add delay between outcome creations to avoid rate limits
          // Skip delay for the last outcome
          if (i < outcomes.length - 1) {
            await delay(300); // 300ms between outcomes
          }
        } catch (error: any) {
          throw new Error(
            `Failed to create outcome ${outcome.outcomeId} after deletion: ${error.message}`
          );
        }
      }

      return {
        created: createdCount,
        deleted: deletedCount,
        updated: true,
        skipped: false
      };
    } else {
      // SKIP PATH: Existing behavior when forceUpdate=false
      return { created: 0, deleted: 0, updated: false, skipped: true };
    }
  }

  // CREATE PATH: No existing outcomes
  if (dryRun) {
    return {
      created: outcomes.length,
      deleted: 0,
      updated: false,
      skipped: false
    }; // Would create
  }

  // Create outcome documents with delays between each to avoid rate limits
  let createdCount = 0;

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    try {
      const docData = {
        courseId: outcome.courseId,
        courseSqaCode: outcome.courseSqaCode,
        unitCode: outcome.unitCode,
        unitTitle: outcome.unitTitle,
        scqfCredits: outcome.scqfCredits,
        outcomeId: outcome.outcomeId,
        outcomeTitle: outcome.outcomeTitle,
        assessmentStandards: outcome.assessmentStandards,
        teacherGuidance: outcome.teacherGuidance,
        keywords: JSON.stringify(outcome.keywords)
      };

      await databases.createDocument(
        'default',
        'course_outcomes',
        ID.unique(),
        docData
      );

      createdCount++;

      // Add delay between outcome creations to avoid rate limits
      // Skip delay for the last outcome
      if (i < outcomes.length - 1) {
        await delay(300); // 300ms between outcomes
      }
    } catch (error: any) {
      throw new Error(`Failed to create outcome ${outcome.outcomeId}: ${error.message}`);
    }
  }

  return { created: createdCount, deleted: 0, updated: false, skipped: false };
}
