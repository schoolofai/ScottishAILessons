/**
 * Unit-Based Course Extraction Library
 *
 * This module provides extraction logic for unit-based courses (National 3/4).
 * Unit-based courses have a hierarchical structure:
 * - Course → Units → Outcomes → Assessment Standards
 *
 * Extracted from bulkSeedAllCourses.ts to enable code reuse across scripts.
 */

export interface CourseOutcome {
  courseId: string;
  courseSqaCode: string;
  unitCode: string;
  unitTitle: string;
  scqfCredits: number;
  outcomeId: string;
  outcomeTitle: string;
  assessmentStandards: string;
  teacherGuidance: string;
  keywords: string[];
}

export interface Unit {
  code: string;
  title: string;
  scqf_credits?: number;
  outcomes?: Outcome[];
}

export interface Outcome {
  id: string;
  title?: string;
  assessment_standards?: AssessmentStandard[];
}

export interface AssessmentStandard {
  code: string;
  desc: string;
  marking_guidance?: string;
  skills_list?: string[];
}

/**
 * Generate teacher guidance from assessment standards
 *
 * Formats assessment standards into markdown-style guidance with:
 * - Assessment standard code and description
 * - Optional marking guidance
 * - Optional skills list
 */
export function generateTeacherGuidance(assessmentStandards: AssessmentStandard[]): string {
  const guidance: string[] = [];

  assessmentStandards.forEach(as => {
    let asGuidance = `**${as.code}**: ${as.desc}`;
    if (as.marking_guidance) asGuidance += `\n  Marking: ${as.marking_guidance}`;
    if (as.skills_list?.length && as.skills_list.length > 0) {
      asGuidance += `\n  Skills: ${as.skills_list.join(', ')}`;
    }
    guidance.push(asGuidance);
  });

  return guidance.join('\n\n');
}

/**
 * Extract keywords from outcome title and assessment standards
 *
 * Extracts meaningful keywords by:
 * 1. Tokenizing outcome title (words > 3 chars)
 * 2. Extracting top 3 words from each assessment standard description (words > 4 chars)
 * 3. Deduplicating using Set
 *
 * Returns array of unique keywords for searchability.
 */
export function extractKeywords(
  outcomeTitle: string | undefined,
  assessmentStandards: AssessmentStandard[]
): string[] {
  const keywords = new Set<string>();

  // Extract from title (with null check)
  if (outcomeTitle) {
    const titleWords = outcomeTitle
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    titleWords.forEach(word => keywords.add(word));
  }

  // Extract from assessment standards
  assessmentStandards.forEach(as => {
    if (as.desc) {
      const descWords = as.desc
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 4);
      descWords.slice(0, 3).forEach(word => keywords.add(word));
    }
  });

  return Array.from(keywords);
}

/**
 * Extract outcomes from unit-based course structure
 *
 * Processes traditional unit-based courses (National 3/4) by:
 * 1. Iterating through units
 * 2. For each unit, extracting all outcomes
 * 3. For each outcome, generating:
 *    - Teacher guidance from assessment standards
 *    - Keywords for search
 *    - Structured course_outcome document
 *
 * @param courseId - Normalized course identifier (e.g., "course_c76973")
 * @param courseSqaCode - Original SQA course code (e.g., "C769 73")
 * @param units - Array of units from course_structure
 * @returns Array of CourseOutcome documents ready for database insertion
 * @throws Error if units array is empty or missing required fields
 */
export function extractOutcomesFromUnitsBased(
  courseId: string,
  courseSqaCode: string,
  units: Unit[]
): CourseOutcome[] {
  if (!units || units.length === 0) {
    throw new Error('No units found in course data');
  }

  const outcomes: CourseOutcome[] = [];

  for (const unit of units) {
    const unitOutcomes = unit.outcomes || [];

    for (const outcome of unitOutcomes) {
      const teacherGuidance = generateTeacherGuidance(outcome.assessment_standards || []);
      const keywords = extractKeywords(outcome.title, outcome.assessment_standards || []);

      outcomes.push({
        courseId,
        courseSqaCode,
        unitCode: unit.code,
        unitTitle: unit.title,
        scqfCredits: unit.scqf_credits || 0,
        outcomeId: outcome.id,
        outcomeTitle: outcome.title || '',
        assessmentStandards: JSON.stringify(outcome.assessment_standards || []),
        teacherGuidance,
        keywords
      });
    }
  }

  return outcomes;
}
