/**
 * SQA-aligned course outcome type definitions
 *
 * This file defines the new course_outcomes schema that matches the
 * sqa_education.sqa_current structure from the Scottish Qualifications Authority.
 *
 * Data Hierarchy: Course → Units → Outcomes → Assessment Standards
 *
 * Migration Note:
 * - OLD schema used: outcomeRef, title
 * - NEW schema uses: outcomeId, outcomeTitle (plus additional SQA context)
 */

/**
 * Assessment Standard structure (stored as JSON string in assessmentStandards field)
 */
export interface AssessmentStandard {
  code: string;                   // e.g., "AS1.1", "AS2.3"
  desc: string;                   // Description of what is being assessed
  skills_list?: string[];         // Skills being assessed (optional)
  marking_guidance?: string;      // Marking instructions for teachers (optional)
}

/**
 * SQA-aligned course outcome structure
 *
 * This is the primary interface for working with course outcomes.
 * All new code should use this structure.
 */
export interface CourseOutcome {
  // Appwrite metadata
  $id: string;                    // Appwrite document ID (used in outcomeRefs)
  $createdAt?: string;            // Creation timestamp
  $updatedAt?: string;            // Last update timestamp

  // Course identification
  courseId: string;               // Internal course ID (e.g., "course_c84473")
  courseSqaCode: string;          // SQA course code (e.g., "C844 73")

  // Unit information
  unitCode: string;               // SQA unit code (e.g., "HV7Y 73")
  unitTitle: string;              // Full unit title
  scqfCredits: number;            // SCQF credit value (typically 4, 6, or 8)

  // Outcome information
  outcomeId: string;              // Outcome ID (e.g., "O1", "O2") - LOOKUP KEY
  outcomeTitle: string;           // Full outcome title - DISPLAY TEXT

  // Assessment data
  assessmentStandards: string;    // JSON string of AssessmentStandard[]
  teacherGuidance: string;        // Auto-generated markdown guidance for teachers
  keywords: string;               // JSON string of keywords for search
}

/**
 * Parsed course outcome with typed assessment standards
 * Use this when you need to work with assessment standards as objects
 */
export interface ParsedCourseOutcome extends Omit<CourseOutcome, 'assessmentStandards' | 'keywords'> {
  assessmentStandards: AssessmentStandard[];
  keywords: string[];
}

/**
 * Enriched outcome reference for display in UI
 * Contains the essential fields needed for showing outcomes in lists
 */
export interface EnrichedOutcome {
  $id: string;                    // Document ID
  outcomeId: string;              // e.g., "O1"
  outcomeTitle: string;           // Full title for display
  unitCode: string;               // e.g., "HV7Y 73"
  unitTitle: string;              // Unit name
  courseSqaCode: string;          // SQA course code
}

/**
 * Helper function to parse assessment standards from JSON string
 */
export function parseAssessmentStandards(assessmentStandardsJson: string): AssessmentStandard[] {
  try {
    return JSON.parse(assessmentStandardsJson);
  } catch (error) {
    console.error('Failed to parse assessment standards:', error);
    return [];
  }
}

/**
 * Helper function to parse keywords from JSON string
 */
export function parseKeywords(keywordsJson: string): string[] {
  try {
    return JSON.parse(keywordsJson);
  } catch (error) {
    console.error('Failed to parse keywords:', error);
    return [];
  }
}

/**
 * Helper function to convert CourseOutcome to ParsedCourseOutcome
 */
export function parseCourseOutcome(outcome: CourseOutcome): ParsedCourseOutcome {
  return {
    ...outcome,
    assessmentStandards: parseAssessmentStandards(outcome.assessmentStandards),
    keywords: parseKeywords(outcome.keywords)
  };
}

// ============================================================
// LEGACY TYPES (DEPRECATED)
// ============================================================

/**
 * @deprecated Use CourseOutcome instead
 *
 * Legacy course outcome structure from before SQA migration.
 * This structure is no longer used in the codebase.
 *
 * Migration mapping:
 * - outcomeRef → outcomeId
 * - title → outcomeTitle
 */
export interface LegacyCourseOutcome {
  $id: string;
  courseId: string;
  outcomeRef: string;  // ❌ DEPRECATED - Use outcomeId
  title: string;       // ❌ DEPRECATED - Use outcomeTitle
}
