/**
 * Past Papers API Utilities
 *
 * Shared utilities for parsing paperId from URL format and normalizing
 * subject/level values for database queries.
 */

/**
 * Parse paperId from URL format back to components
 *
 * @param paperId - URL-formatted paper ID (e.g., "applications-of-mathematics-n5-2023-X844-75-01")
 * @returns Parsed components for database query
 * @throws Error if paperId format is invalid
 *
 * @example
 * Input:  "applications-of-mathematics-n5-2023-X844-75-01"
 * Output: { subject: "Applications Of Mathematics", level: "National 5", year: 2023, paperCode: "X844/75/01" }
 */
export function parsePaperId(paperId: string): {
  subject: string;
  level: string;
  year: number;
  paperCode: string;
} {
  // Level codes appear after subject, followed by year
  // Pattern: subject-levelCode-year-paperCode
  // Level codes: n3, n4, n5, nh, nah
  const levelPattern = /-(n3|n4|n5|nh|nah)-(\d{4})-/;
  const match = paperId.match(levelPattern);

  if (!match) {
    throw new Error(`Invalid paperId format: ${paperId}. Expected format: subject-levelCode-year-paperCode`);
  }

  const levelIndex = paperId.indexOf(match[0]);
  const subjectSlug = paperId.substring(0, levelIndex);
  const levelCode = match[1];
  const year = parseInt(match[2], 10);
  const paperCodeSlug = paperId.substring(levelIndex + match[0].length);

  // Validate year is reasonable (SQA exams from 2000s onwards)
  if (year < 2000 || year > 2100) {
    throw new Error(`Invalid year in paperId: ${year}`);
  }

  // Convert back to display formats
  const subject = normalizeSubject(subjectSlug);
  const level = levelCodeToDisplay(levelCode);
  const paperCode = paperCodeSlug.replace(/-/g, '/');  // X844-75-01 → X844/75/01

  return { subject, level, year, paperCode };
}

/**
 * Normalize subject slug to display format
 *
 * @param subject - URL slug (e.g., "applications-of-mathematics")
 * @returns Display format (e.g., "Applications Of Mathematics")
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert level code to display name
 *
 * @param code - Short level code (e.g., "n5")
 * @returns Full display name (e.g., "National 5")
 */
export function levelCodeToDisplay(code: string): string {
  const map: Record<string, string> = {
    'n3': 'National 3',
    'n4': 'National 4',
    'n5': 'National 5',
    'nh': 'Higher',
    'nah': 'Advanced Higher'
  };

  const result = map[code.toLowerCase()];
  if (!result) {
    throw new Error(`Unknown level code: ${code}. Valid codes: n3, n4, n5, nh, nah`);
  }

  return result;
}

/**
 * Convert display level name to code for URL building
 *
 * @param level - Display name (e.g., "National 5")
 * @returns Short code (e.g., "n5")
 */
export function levelToCode(level: string): string {
  const map: Record<string, string> = {
    'national 3': 'n3',
    'national 4': 'n4',
    'national 5': 'n5',
    'higher': 'nh',
    'advanced higher': 'nah'
  };

  const result = map[level.toLowerCase()];
  if (!result) {
    throw new Error(`Unknown level: ${level}. Valid levels: National 3, National 4, National 5, Higher, Advanced Higher`);
  }

  return result;
}
