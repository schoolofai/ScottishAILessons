#!/usr/bin/env ts-node

/**
 * Phase 1A: Single Course Seeding Script
 *
 * This script seeds ONE SQA course and its outcomes to validate the approach
 * before scaling to bulk processing.
 *
 * NOW SUPPORTS:
 * - Unit-based courses (National 3/4) - traditional unit → outcome structure
 * - Skills-based courses (National 5+) - topic areas + skills framework
 *
 * Usage:
 *   tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
 *   tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --dry-run
 *   tsx scripts/seedSingleCourse.ts --subject science --level higher
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT environment variable
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID environment variable
 *   - APPWRITE_API_KEY environment variable (admin API key)
 *   - sqa_education.sqa_current collection populated with SQA data
 *
 * Key Features:
 *   - Auto-detects structure type (unit_based vs skills_based)
 *   - Validates SQA data structure before processing
 *   - Creates course document with courseId = course_<course_code>
 *   - Extracts and creates course_outcomes documents (uses shared libraries)
 *   - Idempotent: skips existing courses/outcomes
 *   - Fail-fast error handling with detailed messages
 *   - Verbose logging for validation
 */

import * as path from 'path';
import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import minimist from 'minimist';
import {
  processSQACourse,
  createCourseDocument,
  extractOutcomes,
  createOutcomeDocuments,
  underscoreToHyphen,
  type SQACourseDoc,
  type ProcessedCourse
} from './lib/courseSeeding';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface CLIArgs {
  subject: string;
  level: string;
  dryRun: boolean;
  forceUpdate: boolean;
}

/**
 * Parse CLI arguments
 */
function parseCLIArgs(): CLIArgs {
  const args = minimist(process.argv.slice(2));

  if (!args.subject || !args.level) {
    throw new Error(
      'Missing required arguments.\n\n' +
      'Usage:\n' +
      '  tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3\n' +
      '  tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --dry-run\n' +
      '  tsx scripts/seedSingleCourse.ts --subject science --level higher\n' +
      '  tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --force-update\n' +
      '  tsx scripts/seedSingleCourse.ts --subject mathematics --level national_5 --force-update --dry-run\n\n' +
      'Flags:\n' +
      '  --dry-run       Preview changes without writing to database\n' +
      '  --force-update  Update existing courses/outcomes instead of skipping (overwrites all fields)\n'
    );
  }

  return {
    subject: args.subject,
    level: args.level,
    dryRun: args['dry-run'] || false,
    forceUpdate: args['force-update'] || false
  };
}

/**
 * Fetch single SQA course from sqa_education.sqa_current collection
 */
async function getSQACourse(
  databases: Databases,
  subject: string,
  level: string
): Promise<SQACourseDoc> {
  console.log(`\n🔍 Querying sqa_education.sqa_current collection...`);
  console.log(`   Subject: "${subject}"`);
  console.log(`   Level: "${level}"`);

  const result = await databases.listDocuments(
    'sqa_education',
    'sqa_current',
    [
      Query.equal('subject', subject),
      Query.equal('level', level),
      Query.limit(10)
    ]
  );

  if (result.documents.length === 0) {
    throw new Error(
      `❌ No SQA course found for subject="${subject}", level="${level}".\n\n` +
      `Please verify:\n` +
      `  1. The subject/level values match what's in sqa_education.sqa_current collection\n` +
      `  2. The collection has been populated with SQA data\n` +
      `  3. Field names use underscores (e.g., "application_of_mathematics", "national_3")\n`
    );
  }

  if (result.documents.length > 1) {
    console.warn(`   ⚠️  Found ${result.documents.length} matching courses, using first one`);
  }

  const doc = result.documents[0] as any;

  console.log(`   ✅ Found SQA course: ${doc.$id}`);
  console.log(`   Document fields available: ${Object.keys(doc).join(', ')}`);

  // Return as SQACourseDoc (data parsing handled by processSQACourse)
  return {
    $id: doc.$id,
    subject: doc.subject,
    level: doc.level,
    course_code: doc.course_code,
    data: doc.data
  };
}

/**
 * Main seeding function for single course
 *
 * Uses shared libraries from lib/courseSeeding to process the course.
 * Supports both unit-based and skills-based courses automatically.
 */
async function seedSingleCourse(
  subject: string,
  level: string,
  dryRun: boolean = false,
  forceUpdate: boolean = false
): Promise<void> {
  console.log('🌱 Phase 1A: Single Course Seeding\n');
  console.log('='.repeat(60));
  console.log(`Subject: ${subject}`);
  console.log(`Level: ${level}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (forceUpdate) {
    console.log(`⚠️  Force Update: ENABLED (will overwrite existing courses/outcomes)`);
  }
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
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Project: ${projectId}`);

  // Create admin client with API key
  const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(adminClient);

  console.log('✅ Admin client created with API key authentication');

  try {
    // Step 1: Fetch SQA course
    const sqaDoc = await getSQACourse(databases, subject, level);

    // Step 2: Process SQA document (imported from lib/courseSeeding)
    console.log(`\n📝 Processing SQA document...`);
    const processedCourse: ProcessedCourse = processSQACourse(sqaDoc);

    console.log(`   ✅ Extracted course code: "${processedCourse.sqaCode}"`);
    console.log(`   ✅ Generated courseId: ${processedCourse.courseId}`);

    // Detect structure type
    const structureType = processedCourse.data.course_structure?.structure_type || 'unit_based';
    console.log(`   📊 Structure Type: ${structureType}`);

    if (structureType === 'skills_based') {
      console.log(`   🎯 Using skills-based extraction (National 5+ course)`);
    } else {
      console.log(`   📚 Using unit-based extraction (National 3/4 course)`);
    }

    // Step 3: Create course document (imported from lib/courseSeeding)
    const courseResult = await createCourseDocument(databases, processedCourse, dryRun, forceUpdate);

    if (courseResult.skipped) {
      console.log(`   ℹ️  Course already exists: ${processedCourse.courseId} (SKIP)`);
    } else if (courseResult.updated) {
      console.log(`   ⟳ ${dryRun ? 'Would update' : 'Updated'} course document (replaced all fields)`);
      console.log(`   CourseId: ${processedCourse.courseId}`);
      console.log(`   Subject: ${underscoreToHyphen(processedCourse.subject)}`);
      console.log(`   Level: ${underscoreToHyphen(processedCourse.level)}`);
      console.log(`   SQA Code: ${processedCourse.sqaCode}`);
    } else if (courseResult.created) {
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} course document`);
      console.log(`   CourseId: ${processedCourse.courseId}`);
      console.log(`   Subject: ${underscoreToHyphen(processedCourse.subject)}`);
      console.log(`   Level: ${underscoreToHyphen(processedCourse.level)}`);
      console.log(`   SQA Code: ${processedCourse.sqaCode}`);
    }

    // Step 4: Extract outcomes (imported from lib/courseSeeding - auto-detects structure type)
    console.log(`\n🔍 Extracting outcomes from course data...`);
    const outcomes = extractOutcomes(processedCourse);

    console.log(`   ✅ Extracted ${outcomes.length} outcomes`);

    if (structureType === 'skills_based') {
      // Count topics vs skills
      const topicCount = outcomes.filter(o => o.unitCode.startsWith('TOPIC_')).length;
      const skillCount = outcomes.filter(o => o.unitCode.startsWith('SKILL_')).length;
      console.log(`   📦 Topics: ${topicCount}, Skills: ${skillCount}`);
    }

    // Step 5: Create course_outcomes documents (imported from lib/courseSeeding)
    console.log(`\n📥 Creating course_outcomes documents...`);
    const outcomeResult = await createOutcomeDocuments(
      databases,
      outcomes,
      processedCourse.courseId,
      dryRun,
      forceUpdate
    );

    if (outcomeResult.skipped) {
      console.log(`   ℹ️  Outcomes already exist for ${processedCourse.courseId} (SKIP)`);
    } else if (outcomeResult.updated) {
      console.log(`   ⟳ ${dryRun ? 'Would delete' : 'Deleted'} ${outcomeResult.deleted} old outcomes`);
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} ${outcomeResult.created} new outcomes`);
    } else {
      console.log(`   ✅ ${dryRun ? 'Would create' : 'Created'} ${outcomeResult.created} outcomes`);
    }

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Single Course Seeding Complete!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Course ID: ${processedCourse.courseId}`);
    console.log(`   SQA Code: ${processedCourse.sqaCode}`);
    console.log(`   Subject: ${underscoreToHyphen(subject)}`);
    console.log(`   Level: ${underscoreToHyphen(level)}`);
    console.log(`   Structure Type: ${structureType}`);
    console.log(`   Outcomes: ${outcomes.length}`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no database writes)' : 'LIVE'}`);

    if (!dryRun) {
      console.log('\n✅ Next Steps:');
      console.log('   1. Verify course document in Appwrite console: default.courses');
      console.log(`      - Search for courseId: ${processedCourse.courseId}`);
      console.log('   2. Verify outcome documents in Appwrite console: default.course_outcomes');
      console.log(`      - Filter by courseId: ${processedCourse.courseId}`);
      console.log(`      - Expected count: ${outcomes.length}`);

      if (structureType === 'skills_based') {
        const topicCount = outcomes.filter(o => o.unitCode.startsWith('TOPIC_')).length;
        const skillCount = outcomes.filter(o => o.unitCode.startsWith('SKILL_')).length;
        console.log(`      - Expected topics: ${topicCount}`);
        console.log(`      - Expected skills: ${skillCount}`);
      }

      console.log('   3. Re-run this script to test idempotency (should skip existing)');
      console.log('   4. Once validated, proceed to Phase 1B: bulkSeedAllCourses.ts');
    }

  } catch (error: any) {
    console.error('\n❌ Seeding failed:');
    console.error(`   ${error.message}`);

    if (error.stack) {
      console.error('\n📚 Stack trace:');
      console.error(error.stack);
    }

    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const args = parseCLIArgs();
    await seedSingleCourse(args.subject, args.level, args.dryRun, args.forceUpdate);

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
