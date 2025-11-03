#!/usr/bin/env ts-node

/**
 * Phase 1B: Bulk Course Seeding Script
 *
 * This script seeds ALL SQA courses and their outcomes from sqa_education.sqa_current collection.
 * It extends the validated Phase 1A logic to handle bulk processing with pagination.
 *
 * Usage:
 *   tsx scripts/bulkSeedAllCourses.ts
 *   tsx scripts/bulkSeedAllCourses.ts --dry-run
 *   tsx scripts/bulkSeedAllCourses.ts --limit 10
 *   tsx scripts/bulkSeedAllCourses.ts --delay 2000  # 2 second delay between courses
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT environment variable
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID environment variable
 *   - APPWRITE_API_KEY environment variable (admin API key)
 *   - sqa_education.sqa_current collection populated with SQA data
 *   - Phase 1A validation completed successfully
 *
 * Key Features:
 *   - Processes all SQA courses with pagination
 *   - Idempotent: skips existing courses/outcomes
 *   - Graceful error handling: continues on failure
 *   - Progress tracking with detailed counts
 *   - JSON report generation
 *   - Dry-run mode for testing
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import minimist from 'minimist';
import {
  processSQACourse,
  createCourseDocument,
  extractOutcomes,
  createOutcomeDocuments,
  delay,
  type SQACourseDoc,
  type ProcessedCourse,
  type CourseOutcome
} from './lib/courseSeeding';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface CLIArgs {
  dryRun: boolean;
  limit?: number;
  offset?: number;
  delayMs?: number; // Delay between courses in milliseconds
  forceUpdate: boolean;
}

// Type interfaces imported from lib/courseSeeding

interface ProcessingResult {
  courseId: string;
  sqaCode: string;
  subject: string;
  level: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  courseCreated: boolean;
  courseUpdated: boolean;
  outcomesCreated: number;
  outcomesDeleted: number;
  outcomesSkipped: boolean;
  error?: string;
  timestamp: string;
}

interface BulkReport {
  timestamp: string;
  totalProcessed: number;
  coursesCreated: number;
  coursesUpdated: number;
  coursesSkipped: number;
  coursesFailed: number;
  totalOutcomesCreated: number;
  totalOutcomesDeleted: number;
  dryRun: boolean;
  forceUpdate: boolean;
  results: ProcessingResult[];
}

/**
 * Parse CLI arguments
 */
function parseCLIArgs(): CLIArgs {
  const args = minimist(process.argv.slice(2));

  return {
    dryRun: args['dry-run'] || false,
    limit: args.limit ? parseInt(args.limit) : undefined,
    offset: args.offset ? parseInt(args.offset) : 0,
    delayMs: args.delay ? parseInt(args.delay) : 2500, // Default 2.5 seconds between courses
    forceUpdate: args['force-update'] || false
  };
}

/**
 * Fetch all SQA courses with pagination
 */
async function fetchAllSQACourses(
  databases: Databases,
  limit?: number,
  offset: number = 0
): Promise<SQACourseDoc[]> {
  console.log('\n🔍 Fetching SQA courses from sqa_education.sqa_current...');

  const allCourses: SQACourseDoc[] = [];
  let currentOffset = offset;
  const batchSize = 100; // Appwrite max limit per query
  let hasMore = true;

  while (hasMore) {
    const result = await databases.listDocuments(
      'sqa_education',
      'sqa_current',
      [
        Query.limit(batchSize),
        Query.offset(currentOffset)
      ]
    );

    const courses = result.documents as any[];
    allCourses.push(...courses);

    console.log(`   Fetched ${courses.length} courses (offset: ${currentOffset})`);

    // Check if we've reached the limit
    if (limit && allCourses.length >= limit) {
      console.log(`   ✅ Reached limit of ${limit} courses`);
      return allCourses.slice(0, limit);
    }

    // Check if there are more documents
    hasMore = courses.length === batchSize && currentOffset + batchSize < result.total;
    currentOffset += batchSize;
  }

  console.log(`   ✅ Total courses fetched: ${allCourses.length}`);
  return allCourses;
}

/**
 * Process single course (main processing logic)
 *
 * This wrapper function handles error handling and logging for single course processing.
 * The actual processing logic is delegated to functions imported from lib/courseSeeding.
 */
async function processSingleCourse(
  databases: Databases,
  sqaDoc: SQACourseDoc,
  dryRun: boolean,
  forceUpdate: boolean,
  index: number,
  total: number
): Promise<ProcessingResult> {
  const timestamp = new Date().toISOString();

  console.log(`\n[${index + 1}/${total}] Processing: ${sqaDoc.subject} (${sqaDoc.level})`);

  try {
    // Step 1: Process SQA document (imported from lib/courseSeeding)
    const processedCourse = processSQACourse(sqaDoc);

    console.log(`   CourseId: ${processedCourse.courseId}`);
    console.log(`   SQA Code: ${processedCourse.sqaCode}`);

    // Step 2: Create course document (imported from lib/courseSeeding)
    const courseResult = await createCourseDocument(databases, processedCourse, dryRun, forceUpdate);

    if (courseResult.skipped) {
      console.log(`   ℹ️  Course already exists (SKIP)`);
    } else if (courseResult.updated) {
      console.log(`   ⟳ ${dryRun ? 'Would update' : 'Updated'} course document (replaced all fields)`);
    } else if (courseResult.created) {
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} course document`);
    }

    // Step 3: Extract outcomes (imported from lib/courseSeeding - auto-detects structure type)
    const outcomes = extractOutcomes(processedCourse);
    console.log(`   📦 Extracted ${outcomes.length} outcomes`);

    // Step 4: Create outcome documents (imported from lib/courseSeeding)
    const outcomeResult = await createOutcomeDocuments(
      databases,
      outcomes,
      processedCourse.courseId,
      dryRun,
      forceUpdate
    );

    if (outcomeResult.skipped) {
      console.log(`   ℹ️  Outcomes already exist (SKIP)`);
    } else if (outcomeResult.updated) {
      console.log(`   ⟳ ${dryRun ? 'Would delete' : 'Deleted'} ${outcomeResult.deleted} old outcomes`);
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} ${outcomeResult.created} new outcomes`);
    } else {
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} ${outcomeResult.created} outcomes`);
    }

    // Determine overall status
    let status: 'created' | 'updated' | 'skipped';
    if (courseResult.skipped && outcomeResult.skipped) {
      status = 'skipped';
    } else if (courseResult.updated || outcomeResult.updated) {
      status = 'updated';
    } else {
      status = 'created';
    }

    return {
      courseId: processedCourse.courseId,
      sqaCode: processedCourse.sqaCode,
      subject: processedCourse.subject,
      level: processedCourse.level,
      status,
      courseCreated: courseResult.created,
      courseUpdated: courseResult.updated,
      outcomesCreated: outcomeResult.created,
      outcomesDeleted: outcomeResult.deleted,
      outcomesSkipped: outcomeResult.skipped,
      timestamp
    };

  } catch (error: any) {
    console.error(`   ❌ Failed: ${error.message}`);

    return {
      courseId: '',
      sqaCode: sqaDoc.course_code || 'UNKNOWN',
      subject: sqaDoc.subject,
      level: sqaDoc.level,
      status: 'failed',
      courseCreated: false,
      courseUpdated: false,
      outcomesCreated: 0,
      outcomesDeleted: 0,
      outcomesSkipped: false,
      error: error.message,
      timestamp
    };
  }
}

/**
 * Generate JSON report
 */
function generateReport(results: ProcessingResult[], dryRun: boolean, forceUpdate: boolean): BulkReport {
  const report: BulkReport = {
    timestamp: new Date().toISOString(),
    totalProcessed: results.length,
    coursesCreated: results.filter(r => r.courseCreated).length,
    coursesUpdated: results.filter(r => r.courseUpdated).length,
    coursesSkipped: results.filter(r => r.status === 'skipped').length,
    coursesFailed: results.filter(r => r.status === 'failed').length,
    totalOutcomesCreated: results.reduce((sum, r) => sum + r.outcomesCreated, 0),
    totalOutcomesDeleted: results.reduce((sum, r) => sum + r.outcomesDeleted, 0),
    dryRun,
    forceUpdate,
    results
  };

  // Write report to file
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = path.join(
    reportsDir,
    `bulk-seed-report-${Date.now()}.json`
  );

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n📊 Report saved: ${reportFile}`);

  return report;
}

/**
 * Display summary
 */
function displaySummary(report: BulkReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Bulk Seeding Summary');
  console.log('='.repeat(60));
  console.log(`\nMode: ${report.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (report.forceUpdate) {
    console.log(`⚠️  Force Update: ENABLED`);
  }
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`\n📈 Results:`);
  console.log(`   Total Processed: ${report.totalProcessed}`);
  console.log(`   ✅ Courses Created: ${report.coursesCreated}`);
  if (report.forceUpdate) {
    console.log(`   ⟳ Courses Updated: ${report.coursesUpdated}`);
  }
  console.log(`   ℹ️  Courses Skipped: ${report.coursesSkipped}`);
  console.log(`   ❌ Courses Failed: ${report.coursesFailed}`);
  console.log(`   📦 Total Outcomes Created: ${report.totalOutcomesCreated}`);
  if (report.forceUpdate && report.totalOutcomesDeleted > 0) {
    console.log(`   🗑️  Total Outcomes Deleted: ${report.totalOutcomesDeleted}`);
  }

  if (report.coursesFailed > 0) {
    console.log(`\n❌ Failed Courses:`);
    report.results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`   - ${r.subject} (${r.level}): ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main bulk seeding function
 */
async function bulkSeedAllCourses(args: CLIArgs): Promise<void> {
  console.log('🌱 Phase 1B: Bulk Course Seeding\n');
  console.log('='.repeat(60));
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (args.forceUpdate) {
    console.log(`⚠️  Force Update: ENABLED (will overwrite existing courses/outcomes)`);
  }
  if (args.limit) console.log(`Limit: ${args.limit} courses`);
  if (args.offset) console.log(`Offset: ${args.offset}`);
  console.log(`Delay: ${args.delayMs}ms between courses (adaptive for large courses)`);
  console.log('='.repeat(60));

  // Validate environment variables
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      '❌ Missing required environment variables:\n' +
      `  NEXT_PUBLIC_APPWRITE_ENDPOINT: ${endpoint ? '✅' : '❌'}\n` +
      `  NEXT_PUBLIC_APPWRITE_PROJECT_ID: ${projectId ? '✅' : '❌'}\n` +
      `  APPWRITE_API_KEY: ${apiKey ? '✅' : '❌'}\n`
    );
  }

  console.log('\n✅ Environment variables validated');

  // Create admin client
  const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(adminClient);

  console.log('✅ Admin client created');

  try {
    // Fetch all SQA courses
    const sqaCourses = await fetchAllSQACourses(databases, args.limit, args.offset);

    if (sqaCourses.length === 0) {
      console.log('\n⚠️  No SQA courses found to process');
      return;
    }

    console.log(`\n🚀 Starting bulk processing of ${sqaCourses.length} courses...\n`);

    // Process each course with rate limit delays
    const results: ProcessingResult[] = [];

    for (let i = 0; i < sqaCourses.length; i++) {
      const result = await processSingleCourse(
        databases,
        sqaCourses[i],
        args.dryRun,
        args.forceUpdate,
        i,
        sqaCourses.length
      );
      results.push(result);

      // Add delay between courses to avoid rate limits (unless it's the last course)
      if (i < sqaCourses.length - 1) {
        const baseDelay = args.delayMs || 1500;

        // Adaptive delay: add extra time for courses with many outcomes
        let adaptiveDelay = baseDelay;
        if (result.outcomesCreated > 20 || result.outcomesDeleted > 20) {
          adaptiveDelay = baseDelay + 1500; // Extra 1.5s for large courses
          const totalOps = result.outcomesCreated + result.outcomesDeleted;
          console.log(`   ⏳ Adding extra delay (${adaptiveDelay}ms) for course with ${totalOps} outcome operations...`);
        } else if (!args.dryRun && result.status !== 'skipped') {
          console.log(`   ⏳ Waiting ${adaptiveDelay}ms before next course...`);
        }

        await delay(adaptiveDelay);
      }
    }

    // Generate and display report
    const report = generateReport(results, args.dryRun, args.forceUpdate);
    displaySummary(report);

    console.log('\n🎉 Bulk seeding complete!');

  } catch (error: any) {
    console.error('\n❌ Bulk seeding failed:');
    console.error(`   ${error.message}`);
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const args = parseCLIArgs();
    await bulkSeedAllCourses(args);

    console.log('\n👋 Exiting successfully...');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Script failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run the script
main();
