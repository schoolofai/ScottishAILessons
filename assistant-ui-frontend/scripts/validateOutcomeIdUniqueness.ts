#!/usr/bin/env ts-node

/**
 * Outcome ID Uniqueness Validation Script
 *
 * This script validates that outcomeId fields are unique within each course
 * in the course_outcomes collection.
 *
 * Purpose:
 *   - Detects duplicate outcomeIds within the same courseId
 *   - Reports violations before lesson author refactor migration
 *   - Ensures data integrity for deterministic outcome references
 *
 * Usage:
 *   tsx scripts/validateOutcomeIdUniqueness.ts
 *   tsx scripts/validateOutcomeIdUniqueness.ts --course course_c84775
 *   tsx scripts/validateOutcomeIdUniqueness.ts --fix  # (not implemented - manual fixes only)
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT environment variable
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID environment variable
 *   - APPWRITE_API_KEY environment variable (admin API key)
 *   - default.course_outcomes collection populated
 *
 * Exit Codes:
 *   0: All outcomeIds are unique within their courses
 *   1: Duplicate outcomeIds found (prints violations to stderr)
 *   2: Configuration error or database connection failure
 */

import * as path from 'path';
import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import minimist from 'minimist';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Parse command-line arguments
const argv = minimist(process.argv.slice(2), {
  string: ['course'],
  boolean: ['help', 'fix'],
  alias: { h: 'help', c: 'course', f: 'fix' }
});

// Help text
if (argv.help) {
  console.log(`
Usage: tsx scripts/validateOutcomeIdUniqueness.ts [options]

Options:
  -h, --help           Show this help message
  -c, --course <id>    Validate specific courseId only (e.g., course_c84775)
  -f, --fix            Attempt to fix duplicates (not implemented)

Examples:
  tsx scripts/validateOutcomeIdUniqueness.ts                    # Validate all courses
  tsx scripts/validateOutcomeIdUniqueness.ts --course course_c84775  # Validate one course
  `);
  process.exit(0);
}

// Validate environment variables
const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_APPWRITE_ENDPOINT');
  console.error('   NEXT_PUBLIC_APPWRITE_PROJECT_ID');
  console.error('   APPWRITE_API_KEY');
  process.exit(2);
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

interface CourseOutcome {
  $id: string;
  courseId: string;
  outcomeId: string;
  outcomeTitle: string;
  unitTitle?: string;
}

interface DuplicateReport {
  courseId: string;
  outcomeId: string;
  count: number;
  documentIds: string[];
}

async function getCourseIds(): Promise<string[]> {
  /**
   * Get all unique courseIds from course_outcomes collection
   */
  try {
    const allOutcomes = await databases.listDocuments<CourseOutcome>(
      'default',
      'course_outcomes',
      [Query.limit(500)] // Support large courses
    );

    const courseIdSet = new Set<string>();
    allOutcomes.documents.forEach(doc => {
      if (doc.courseId) {
        courseIdSet.add(doc.courseId);
      }
    });

    return Array.from(courseIdSet).sort();
  } catch (error) {
    console.error('❌ Failed to fetch course IDs:', error);
    throw error;
  }
}

async function validateCourseOutcomes(courseId: string): Promise<DuplicateReport[]> {
  /**
   * Check for duplicate outcomeIds within a single course
   */
  try {
    const outcomes = await databases.listDocuments<CourseOutcome>(
      'default',
      'course_outcomes',
      [
        Query.equal('courseId', courseId),
        Query.limit(500)
      ]
    );

    // Build map: outcomeId -> [documentIds]
    const outcomeMap = new Map<string, string[]>();

    outcomes.documents.forEach(doc => {
      if (!doc.outcomeId) {
        console.warn(`⚠️  Document ${doc.$id} has no outcomeId field`);
        return;
      }

      if (!outcomeMap.has(doc.outcomeId)) {
        outcomeMap.set(doc.outcomeId, []);
      }
      outcomeMap.get(doc.outcomeId)!.push(doc.$id);
    });

    // Find duplicates
    const duplicates: DuplicateReport[] = [];

    outcomeMap.forEach((documentIds, outcomeId) => {
      if (documentIds.length > 1) {
        duplicates.push({
          courseId,
          outcomeId,
          count: documentIds.length,
          documentIds
        });
      }
    });

    return duplicates;
  } catch (error) {
    console.error(`❌ Failed to validate course ${courseId}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🔍 Validating outcomeId uniqueness in course_outcomes collection\n');

  const specificCourse = argv.course;
  const courseIds = specificCourse
    ? [specificCourse]
    : await getCourseIds();

  console.log(`📊 Validating ${courseIds.length} course(s)...\n`);

  let totalDuplicates = 0;
  const violationsByCourse: Record<string, DuplicateReport[]> = {};

  for (const courseId of courseIds) {
    process.stdout.write(`  Checking ${courseId}... `);

    const duplicates = await validateCourseOutcomes(courseId);

    if (duplicates.length === 0) {
      console.log('✅ OK');
    } else {
      console.log(`❌ ${duplicates.length} duplicate(s) found`);
      violationsByCourse[courseId] = duplicates;
      totalDuplicates += duplicates.length;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(70));

  if (totalDuplicates === 0) {
    console.log('✅ SUCCESS: All outcomeIds are unique within their courses');
    console.log('='.repeat(70));
    process.exit(0);
  } else {
    console.error('❌ VIOLATIONS FOUND: Duplicate outcomeIds detected\n');
    console.error(`Total violations: ${totalDuplicates} across ${Object.keys(violationsByCourse).length} course(s)\n`);

    // Print detailed violations
    for (const [courseId, duplicates] of Object.entries(violationsByCourse)) {
      console.error(`\nCourse: ${courseId}`);
      console.error('-'.repeat(70));

      duplicates.forEach(dup => {
        console.error(`  outcomeId: "${dup.outcomeId}" (${dup.count} occurrences)`);
        console.error(`  Document IDs:`);
        dup.documentIds.forEach(docId => {
          console.error(`    - ${docId}`);
        });
      });
    }

    console.error('\n' + '='.repeat(70));
    console.error('\n⚠️  Action Required:');
    console.error('  1. Review duplicate outcomeIds above');
    console.error('  2. Manually inspect documents to determine which to keep');
    console.error('  3. Delete or update duplicate documents in Appwrite console');
    console.error('  4. Re-run this script to verify fixes\n');
    console.error('='.repeat(70));

    process.exit(1);
  }
}

// Run validation
main().catch(error => {
  console.error('\n❌ Fatal error during validation:');
  console.error(error);
  process.exit(2);
});
