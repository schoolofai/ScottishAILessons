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
import { Client, Databases, ID, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import minimist from 'minimist';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface CLIArgs {
  dryRun: boolean;
  limit?: number;
  offset?: number;
  delayMs?: number; // Delay between courses in milliseconds
}

interface SQACourseDoc {
  $id: string;
  subject: string;
  level: string;
  course_code?: string; // Top-level if present
  data: string | object; // JSON string or parsed object
}

interface ProcessedCourse {
  courseId: string;
  sqaCode: string;
  subject: string;
  level: string;
  data: any;
}

interface CourseOutcome {
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

interface ProcessingResult {
  courseId: string;
  sqaCode: string;
  subject: string;
  level: string;
  status: 'created' | 'skipped' | 'failed';
  courseCreated: boolean;
  outcomesCreated: number;
  outcomesSkipped: boolean;
  error?: string;
  timestamp: string;
}

interface BulkReport {
  timestamp: string;
  totalProcessed: number;
  coursesCreated: number;
  coursesSkipped: number;
  coursesFailed: number;
  totalOutcomesCreated: number;
  dryRun: boolean;
  results: ProcessingResult[];
}

/**
 * Delay function for rate limit management
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    delayMs: args.delay ? parseInt(args.delay) : 2500 // Default 2.5 seconds between courses
  };
}

/**
 * Generate teacher guidance from assessment standards
 */
function generateTeacherGuidance(assessmentStandards: any[]): string {
  const guidance: string[] = [];

  assessmentStandards.forEach(as => {
    let asGuidance = `**${as.code}**: ${as.desc}`;
    if (as.marking_guidance) asGuidance += `\n  Marking: ${as.marking_guidance}`;
    if (as.skills_list?.length > 0) asGuidance += `\n  Skills: ${as.skills_list.join(', ')}`;
    guidance.push(asGuidance);
  });

  return guidance.join('\n\n');
}

/**
 * Extract keywords from outcome title and assessment standards
 */
function extractKeywords(outcomeTitle: string | undefined, assessmentStandards: any[]): string[] {
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
 * Normalize string for courseId generation
 */
function normalizeCourseCode(courseCode: string): string {
  return courseCode.replace(/\s+/g, '').toLowerCase();
}

/**
 * Convert underscore to hyphen for subject/level fields
 */
function underscoreToHyphen(str: string): string {
  return str.replace(/_/g, '-');
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
 * Process single SQA course document to extract course code and data
 */
function processSQACourse(sqaDoc: SQACourseDoc): ProcessedCourse | null {
  try {
    // Parse the data field
    let parsedData;
    if (typeof sqaDoc.data === 'string') {
      parsedData = JSON.parse(sqaDoc.data);
    } else {
      parsedData = sqaDoc.data;
    }

    // Extract course_code from nested qualification object
    const courseCode = parsedData.qualification?.course_code;
    if (!courseCode) {
      throw new Error('No course_code found in data.qualification');
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
  } catch (error: any) {
    console.error(`   ❌ Failed to process SQA document ${sqaDoc.$id}: ${error.message}`);
    return null;
  }
}

/**
 * Create course document
 */
async function createCourseDocument(
  databases: Databases,
  processedCourse: ProcessedCourse,
  dryRun: boolean
): Promise<{ created: boolean; skipped: boolean }> {
  const subject = underscoreToHyphen(processedCourse.subject);
  const level = underscoreToHyphen(processedCourse.level);

  // Check if course already exists
  const existing = await databases.listDocuments(
    'default',
    'courses',
    [Query.equal('courseId', processedCourse.courseId), Query.limit(1)]
  );

  if (existing.documents.length > 0) {
    return { created: false, skipped: true };
  }

  if (dryRun) {
    return { created: true, skipped: false }; // Would create
  }

  // Create course document
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

  return { created: true, skipped: false };
}

/**
 * Extract outcomes from processed course data
 */
function extractOutcomesFromCourse(processedCourse: ProcessedCourse): CourseOutcome[] {
  const data = processedCourse.data;
  const units = data.course_structure?.units || data.units || [];

  if (units.length === 0) {
    throw new Error('No units found in course data');
  }

  const outcomes: CourseOutcome[] = [];

  for (const unit of units) {
    const unitOutcomes = unit.outcomes || [];

    for (const outcome of unitOutcomes) {
      const teacherGuidance = generateTeacherGuidance(outcome.assessment_standards || []);
      const keywords = extractKeywords(outcome.title, outcome.assessment_standards || []);

      outcomes.push({
        courseId: processedCourse.courseId,
        courseSqaCode: processedCourse.sqaCode,
        unitCode: unit.code,
        unitTitle: unit.title,
        scqfCredits: unit.scqf_credits || 0,
        outcomeId: outcome.id,
        outcomeTitle: outcome.title,
        assessmentStandards: JSON.stringify(outcome.assessment_standards || []),
        teacherGuidance,
        keywords
      });
    }
  }

  return outcomes;
}

/**
 * Create course_outcomes documents
 */
async function createOutcomeDocuments(
  databases: Databases,
  outcomes: CourseOutcome[],
  courseId: string,
  dryRun: boolean
): Promise<{ created: number; skipped: boolean }> {
  // Check if outcomes already exist
  const existingCheck = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (existingCheck.documents.length > 0) {
    return { created: 0, skipped: true };
  }

  if (dryRun) {
    return { created: outcomes.length, skipped: false }; // Would create
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
      // Skip delay for the last outcome (we'll delay between courses instead)
      if (i < outcomes.length - 1) {
        await delay(300); // 300ms between outcomes
      }
    } catch (error: any) {
      console.error(`      ❌ Failed to create outcome ${outcome.outcomeId}: ${error.message}`);
      throw new Error(`Failed to create outcome ${outcome.outcomeId}: ${error.message}`);
    }
  }

  return { created: createdCount, skipped: false };
}

/**
 * Process single course (main processing logic)
 */
async function processSingleCourse(
  databases: Databases,
  sqaDoc: SQACourseDoc,
  dryRun: boolean,
  index: number,
  total: number
): Promise<ProcessingResult> {
  const timestamp = new Date().toISOString();

  console.log(`\n[${ index + 1}/${total}] Processing: ${sqaDoc.subject} (${sqaDoc.level})`);

  try {
    // Step 1: Process SQA document
    const processedCourse = processSQACourse(sqaDoc);
    if (!processedCourse) {
      return {
        courseId: '',
        sqaCode: sqaDoc.course_code || 'UNKNOWN',
        subject: sqaDoc.subject,
        level: sqaDoc.level,
        status: 'failed',
        courseCreated: false,
        outcomesCreated: 0,
        outcomesSkipped: false,
        error: 'Failed to process SQA document',
        timestamp
      };
    }

    console.log(`   CourseId: ${processedCourse.courseId}`);
    console.log(`   SQA Code: ${processedCourse.sqaCode}`);

    // Step 2: Create course document
    const courseResult = await createCourseDocument(databases, processedCourse, dryRun);

    if (courseResult.skipped) {
      console.log(`   ℹ️  Course already exists (SKIP)`);
    } else if (courseResult.created) {
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} course document`);
    }

    // Step 3: Extract outcomes
    const outcomes = extractOutcomesFromCourse(processedCourse);
    console.log(`   📦 Extracted ${outcomes.length} outcomes`);

    // Step 4: Create outcome documents
    const outcomeResult = await createOutcomeDocuments(
      databases,
      outcomes,
      processedCourse.courseId,
      dryRun
    );

    if (outcomeResult.skipped) {
      console.log(`   ℹ️  Outcomes already exist (SKIP)`);
    } else {
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} ${outcomeResult.created} outcomes`);
    }

    // Determine overall status
    const status = courseResult.skipped && outcomeResult.skipped ? 'skipped' : 'created';

    return {
      courseId: processedCourse.courseId,
      sqaCode: processedCourse.sqaCode,
      subject: processedCourse.subject,
      level: processedCourse.level,
      status,
      courseCreated: courseResult.created && !courseResult.skipped,
      outcomesCreated: outcomeResult.created,
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
      outcomesCreated: 0,
      outcomesSkipped: false,
      error: error.message,
      timestamp
    };
  }
}

/**
 * Generate JSON report
 */
function generateReport(results: ProcessingResult[], dryRun: boolean): BulkReport {
  const report: BulkReport = {
    timestamp: new Date().toISOString(),
    totalProcessed: results.length,
    coursesCreated: results.filter(r => r.courseCreated).length,
    coursesSkipped: results.filter(r => r.status === 'skipped').length,
    coursesFailed: results.filter(r => r.status === 'failed').length,
    totalOutcomesCreated: results.reduce((sum, r) => sum + r.outcomesCreated, 0),
    dryRun,
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
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`\n📈 Results:`);
  console.log(`   Total Processed: ${report.totalProcessed}`);
  console.log(`   ✅ Courses Created: ${report.coursesCreated}`);
  console.log(`   ℹ️  Courses Skipped: ${report.coursesSkipped}`);
  console.log(`   ❌ Courses Failed: ${report.coursesFailed}`);
  console.log(`   📦 Total Outcomes Created: ${report.totalOutcomesCreated}`);

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
        i,
        sqaCourses.length
      );
      results.push(result);

      // Add delay between courses to avoid rate limits (unless it's the last course)
      if (i < sqaCourses.length - 1) {
        const baseDelay = args.delayMs || 1500;

        // Adaptive delay: add extra time for courses with many outcomes
        let adaptiveDelay = baseDelay;
        if (result.outcomesCreated > 20) {
          adaptiveDelay = baseDelay + 1500; // Extra 1.5s for large courses
          console.log(`   ⏳ Adding extra delay (${adaptiveDelay}ms) for course with ${result.outcomesCreated} outcomes...`);
        } else if (!args.dryRun && result.status !== 'skipped') {
          console.log(`   ⏳ Waiting ${adaptiveDelay}ms before next course...`);
        }

        await delay(adaptiveDelay);
      }
    }

    // Generate and display report
    const report = generateReport(results, args.dryRun);
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
