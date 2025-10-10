#!/usr/bin/env ts-node

/**
 * Phase 1A: Single Course Seeding Script
 *
 * This script seeds ONE SQA course and its outcomes to validate the approach
 * before scaling to bulk processing.
 *
 * Usage:
 *   tsx scripts/seedSingleCourse.ts --subject application_of_mathematics --level national_3
 *   tsx scripts/seedSingleCourse.ts --subject science --level national_4 --dry-run
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT environment variable
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID environment variable
 *   - APPWRITE_API_KEY environment variable (admin API key)
 *   - sqa_education.sqa_current collection populated with SQA data
 *
 * Key Features:
 *   - Validates SQA data structure
 *   - Creates course document with courseId = course_<course_code>
 *   - Extracts and creates course_outcomes documents
 *   - Idempotent: skips existing courses/outcomes
 *   - Fail-fast error handling with detailed messages
 *   - Verbose logging for validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client, Databases, ID, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import minimist from 'minimist';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface CLIArgs {
  subject: string;
  level: string;
  dryRun: boolean;
}

interface SQACourse {
  $id: string;
  subject: string;
  level: string;
  course_code: string;
  data: any; // Parsed JSON containing course structure
}

interface CourseOutcome {
  courseId: string;
  courseSqaCode: string;
  unitCode: string;
  unitTitle: string;
  scqfCredits: number;
  outcomeId: string;
  outcomeTitle: string;
  assessmentStandards: string; // JSON string
  teacherGuidance: string;
  keywords: string[]; // Will be stringified when storing
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
      '  tsx scripts/seedSingleCourse.ts --subject science --level national_4 --dry-run\n'
    );
  }

  return {
    subject: args.subject,
    level: args.level,
    dryRun: args['dry-run'] || false
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
function extractKeywords(outcomeTitle: string, assessmentStandards: any[]): string[] {
  const keywords = new Set<string>();

  // Extract from title
  const titleWords = outcomeTitle
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  titleWords.forEach(word => keywords.add(word));

  // Extract from assessment standards
  assessmentStandards.forEach(as => {
    const descWords = as.desc
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 4);
    descWords.slice(0, 3).forEach(word => keywords.add(word));
  });

  return Array.from(keywords);
}

/**
 * Normalize string for courseId generation
 * - Remove all spaces
 * - Convert to lowercase
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
 * Fetch single SQA course from sqa_education.sqa_current collection
 */
async function getSQACourse(
  databases: Databases,
  subject: string,
  level: string
): Promise<SQACourse> {
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

  // Parse the data field (contains nested course structure)
  let parsedData;
  try {
    parsedData = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
  } catch (error: any) {
    throw new Error(
      `❌ Failed to parse data field from SQA document ${doc.$id}:\n` +
      `   ${error.message}\n\n` +
      `The data field should contain valid JSON with course structure.`
    );
  }

  console.log(`   ✅ Parsed data field successfully`);
  console.log(`   Data keys: ${Object.keys(parsedData).join(', ')}`);

  // Extract course_code from nested qualification object
  const courseCode = parsedData.qualification?.course_code;
  if (!courseCode) {
    throw new Error(
      `❌ No course_code found in data.qualification object.\n\n` +
      `SQA document structure:\n${JSON.stringify(parsedData, null, 2)}`
    );
  }

  console.log(`   ✅ Extracted course code: "${courseCode}"`);

  return {
    $id: doc.$id,
    subject: doc.subject,
    level: doc.level,
    course_code: courseCode,
    data: parsedData
  };
}

/**
 * Create course document in default.courses collection
 */
async function createCourseDocument(
  databases: Databases,
  sqaCourse: SQACourse,
  dryRun: boolean
): Promise<string> {
  console.log(`\n📝 Creating course document...`);

  // Generate courseId
  const normalizedCode = normalizeCourseCode(sqaCourse.course_code);
  const courseId = `course_${normalizedCode}`;
  console.log(`   Generated courseId: ${courseId}`);

  // Convert subject/level to hyphenated format
  const subject = underscoreToHyphen(sqaCourse.subject);
  const level = underscoreToHyphen(sqaCourse.level);
  console.log(`   Normalized subject: ${subject}`);
  console.log(`   Normalized level: ${level}`);

  // Check if course already exists (idempotency)
  const existing = await databases.listDocuments(
    'default',
    'courses',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (existing.documents.length > 0) {
    console.log(`   ℹ️  Course already exists: ${courseId} (SKIP)`);
    console.log(`   Document ID: ${existing.documents[0].$id}`);
    return courseId;
  }

  if (dryRun) {
    console.log(`   🏃 DRY RUN: Would create course document with data:`);
    console.log(`   ${JSON.stringify({
      courseId,
      subject,
      level,
      sqaCode: sqaCourse.course_code,
      schema_version: 2
    }, null, 2)}`);
    return courseId;
  }

  // Create course document
  try {
    const courseDoc = await databases.createDocument(
      'default',
      'courses',
      'unique()',
      {
        courseId,
        subject,
        level,
        sqaCode: sqaCourse.course_code,
        schema_version: 2
      }
    );

    console.log(`   ✅ Created course document: ${courseDoc.$id}`);
    console.log(`   CourseId: ${courseId}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Level: ${level}`);
    console.log(`   SQA Code: ${sqaCourse.course_code}`);

    return courseId;
  } catch (error: any) {
    throw new Error(
      `❌ Failed to create course document:\n` +
      `   ${error.message}\n\n` +
      `Attempted data:\n${JSON.stringify({
        courseId,
        subject,
        level,
        sqaCode: sqaCourse.course_code,
        schema_version: 2
      }, null, 2)}`
    );
  }
}

/**
 * Extract outcomes from SQA course data
 */
function extractOutcomesFromSQACourse(
  sqaCourse: SQACourse,
  courseId: string
): CourseOutcome[] {
  console.log(`\n🔍 Extracting outcomes from SQA course data...`);

  const data = sqaCourse.data;

  // Try multiple possible locations for units/outcomes
  const units = data.course_structure?.units || data.units || [];

  if (units.length === 0) {
    throw new Error(
      `❌ No units found in SQA course data.\n\n` +
      `Expected data structure:\n` +
      `  - data.course_structure.units (preferred), or\n` +
      `  - data.units (fallback)\n\n` +
      `Actual data structure:\n${JSON.stringify(data, null, 2)}`
    );
  }

  console.log(`   Found ${units.length} units`);

  const outcomes: CourseOutcome[] = [];

  for (const unit of units) {
    console.log(`   📦 Processing unit: ${unit.code} - ${unit.title}`);

    const unitOutcomes = unit.outcomes || [];
    console.log(`      Outcomes: ${unitOutcomes.length}`);

    for (const outcome of unitOutcomes) {
      const teacherGuidance = generateTeacherGuidance(outcome.assessment_standards || []);
      const keywords = extractKeywords(outcome.title, outcome.assessment_standards || []);

      outcomes.push({
        courseId,
        courseSqaCode: sqaCourse.course_code,
        unitCode: unit.code,
        unitTitle: unit.title,
        scqfCredits: unit.scqf_credits || 0,
        outcomeId: outcome.id,
        outcomeTitle: outcome.title,
        assessmentStandards: JSON.stringify(outcome.assessment_standards || []),
        teacherGuidance,
        keywords
      });

      console.log(`      ✅ ${outcome.id}: ${outcome.title}`);
    }
  }

  console.log(`   ✅ Extracted ${outcomes.length} total outcomes`);

  return outcomes;
}

/**
 * Create course_outcomes documents in default.course_outcomes collection
 */
async function createOutcomeDocuments(
  databases: Databases,
  outcomes: CourseOutcome[],
  courseId: string,
  dryRun: boolean
): Promise<void> {
  console.log(`\n📥 Creating course_outcomes documents...`);
  console.log(`   Total outcomes to create: ${outcomes.length}`);

  // Check if outcomes already exist for this course (idempotency)
  const existingCheck = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (existingCheck.documents.length > 0) {
    console.log(`   ℹ️  Outcomes already exist for ${courseId} (SKIP)`);
    console.log(`   Found at least ${existingCheck.total} existing documents`);
    return;
  }

  if (dryRun) {
    console.log(`   🏃 DRY RUN: Would create ${outcomes.length} outcome documents`);
    console.log(`   Sample outcome data:`);
    if (outcomes.length > 0) {
      const sample = outcomes[0];
      console.log(`   ${JSON.stringify({
        courseId: sample.courseId,
        courseSqaCode: sample.courseSqaCode,
        unitCode: sample.unitCode,
        unitTitle: sample.unitTitle,
        scqfCredits: sample.scqfCredits,
        outcomeId: sample.outcomeId,
        outcomeTitle: sample.outcomeTitle,
        keywords: JSON.stringify(sample.keywords)
      }, null, 2)}`);
    }
    return;
  }

  // Create outcome documents
  let createdCount = 0;
  const errors: string[] = [];

  for (const outcome of outcomes) {
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

      const doc = await databases.createDocument(
        'default',
        'course_outcomes',
        ID.unique(),
        docData
      );

      createdCount++;
      console.log(`   ✅ Created ${outcome.outcomeId}: ${outcome.outcomeTitle} (${doc.$id})`);
    } catch (error: any) {
      const errorMsg = `${outcome.outcomeId}: ${error.message}`;
      errors.push(errorMsg);
      console.error(`   ❌ Failed to create ${errorMsg}`);
    }
  }

  console.log(`\n   📊 Creation Summary:`);
  console.log(`   ✅ Created: ${createdCount}`);
  console.log(`   ❌ Failed: ${errors.length}`);

  if (errors.length > 0) {
    throw new Error(
      `❌ Failed to create ${errors.length} outcome documents:\n` +
      errors.map(e => `  - ${e}`).join('\n')
    );
  }

  console.log(`   ✅ All ${createdCount} outcomes created successfully`);
}

/**
 * Main seeding function for single course
 */
async function seedSingleCourse(
  subject: string,
  level: string,
  dryRun: boolean = false
): Promise<void> {
  console.log('🌱 Phase 1A: Single Course Seeding\n');
  console.log('=' .repeat(60));
  console.log(`Subject: ${subject}`);
  console.log(`Level: ${level}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('=' .repeat(60));

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
    const sqaCourse = await getSQACourse(databases, subject, level);

    // Step 2: Create course document
    const courseId = await createCourseDocument(databases, sqaCourse, dryRun);

    // Step 3: Extract outcomes from SQA data
    const outcomes = extractOutcomesFromSQACourse(sqaCourse, courseId);

    // Step 4: Create course_outcomes documents
    await createOutcomeDocuments(databases, outcomes, courseId, dryRun);

    // Success summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Single Course Seeding Complete!');
    console.log('=' .repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Course ID: ${courseId}`);
    console.log(`   SQA Code: ${sqaCourse.course_code}`);
    console.log(`   Subject: ${underscoreToHyphen(subject)}`);
    console.log(`   Level: ${underscoreToHyphen(level)}`);
    console.log(`   Outcomes: ${outcomes.length}`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no database writes)' : 'LIVE'}`);

    if (!dryRun) {
      console.log('\n✅ Next Steps:');
      console.log('   1. Verify course document in Appwrite console: default.courses');
      console.log(`      - Search for courseId: ${courseId}`);
      console.log('   2. Verify outcome documents in Appwrite console: default.course_outcomes');
      console.log(`      - Filter by courseId: ${courseId}`);
      console.log(`      - Expected count: ${outcomes.length}`);
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
    await seedSingleCourse(args.subject, args.level, args.dryRun);

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
