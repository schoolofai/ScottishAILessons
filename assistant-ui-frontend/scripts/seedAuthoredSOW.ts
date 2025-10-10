#!/usr/bin/env ts-node

/**
 * Authored SOW Seeding Script (Phase 2 Refactored)
 *
 * Seeds Authored_SOW collection with lesson template placeholders and validates
 * all prerequisites exist before processing. Uses fail-fast validation approach.
 *
 * Workflow:
 * 0. Validates prerequisites (course document & course_outcomes exist)
 * 1. Validates outcome references from SOW entries
 * 2. Creates/updates lesson_templates with real outcome references
 * 3. Updates Authored_SOW entries with real template IDs
 * 4. Upserts Authored_SOW document
 * 5. Validates all template references
 *
 * Usage:
 *   # Single file mode
 *   tsx scripts/seedAuthoredSOW.ts --sow path/to/sow.json
 *
 *   # Named mode (looks in input/sows directory)
 *   tsx scripts/seedAuthoredSOW.ts --name coursename
 *
 *   # Batch mode (processes all files in input/sows)
 *   tsx scripts/seedAuthoredSOW.ts --batch
 *
 *   # With courseId override (for courses with ID length issues)
 *   tsx scripts/seedAuthoredSOW.ts --sow path/to/sow.json --course-id course_c85077
 *
 * Prerequisites (REQUIRED):
 *   ⚠️  Course and outcomes must exist before running this script!
 *   Run bulk course seeding first:
 *     $ npm run seed:courses
 *     or
 *     $ tsx scripts/bulkSeedAllCourses.ts
 *
 * Environment Variables:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT (Appwrite API endpoint)
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID (Appwrite project ID)
 *   - APPWRITE_API_KEY (Admin API key for server-side operations)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client, Databases, ID, Query } from 'node-appwrite';
import { ServerAuthoredSOWDriver, AuthoredSOWData, AuthoredSOWEntry } from '../__tests__/support/ServerAuthoredSOWDriver';
import * as dotenv from 'dotenv';
import minimist from 'minimist';
import Ajv from 'ajv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface SOWJSONFile {
  $id: string;
  courseId: string;
  version: number | string;
  status: 'draft' | 'published' | 'archived';
  metadata: any;
  entries: any[];
}

// CLI Argument Interfaces
interface CLIArgs {
  mode: 'single' | 'named' | 'batch';
  sowFile?: string;
  name?: string;
  inputDir?: string;
  validate?: boolean;
  courseId?: string;
}

interface SOWFile {
  sowFile: string;
  name: string;
  subject: string;
  level: string;
}

interface ValidationResult {
  valid: boolean;
  errors: any[];
  warnings?: string[];
}

interface BatchResult {
  name: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Normalize outcome ID to standard format (e.g., "1" -> "O1", "O1" -> "O1")
 */
function normalizeOutcomeId(outcomeId: string): string {
  // If it's just a number, add "O" prefix
  if (/^\d+$/.test(outcomeId)) {
    return `O${outcomeId}`;
  }
  return outcomeId;
}

/**
 * Validate all prerequisites exist before attempting SOW seeding
 *
 * This function replaces the old ensureCourseExists(), extractOutcomesFromSQA(),
 * and populateCourseOutcomes() functions with a fail-fast validation approach.
 *
 * @param databases - Appwrite Databases instance
 * @param courseId - Course ID to validate (format: course_<code>)
 * @throws Error with actionable message if prerequisites are missing
 */
async function validatePrerequisites(
  databases: Databases,
  courseId: string
): Promise<void> {
  console.log('\n🔍 Validating prerequisites...\n');

  // Check 1: Verify course document exists
  console.log('  ✓ Checking course document...');
  const courseCheck = await databases.listDocuments(
    'default',
    'courses',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (courseCheck.documents.length === 0) {
    throw new Error(
      `❌ PREREQUISITE MISSING: Course "${courseId}" not found in courses collection.\n\n` +
      `💡 ACTION REQUIRED:\n` +
      `   Run the bulk course seeding script first:\n` +
      `   $ npm run seed:courses\n` +
      `   or\n` +
      `   $ tsx scripts/bulkSeedAllCourses.ts\n\n` +
      `This will create all course documents and their outcomes from the SQA database.`
    );
  }

  console.log(`    ✅ Course document exists: ${courseId}`);

  // Check 2: Verify course_outcomes are populated
  console.log('  ✓ Checking course outcomes...');
  const outcomesCheck = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId), Query.limit(1)]
  );

  if (outcomesCheck.documents.length === 0) {
    throw new Error(
      `❌ PREREQUISITE MISSING: No course_outcomes found for course "${courseId}".\n\n` +
      `💡 ACTION REQUIRED:\n` +
      `   The course document exists but has no outcomes populated.\n` +
      `   Run the bulk course seeding script to populate outcomes:\n` +
      `   $ npm run seed:courses\n` +
      `   or\n` +
      `   $ tsx scripts/bulkSeedAllCourses.ts\n\n` +
      `The bulk seeding script will extract outcomes from the SQA database\n` +
      `and populate the course_outcomes collection for this course.`
    );
  }

  // Get actual count of outcomes for informational purposes
  const outcomesCount = await databases.listDocuments(
    'default',
    'course_outcomes',
    [Query.equal('courseId', courseId)]
  );

  console.log(`    ✅ Course outcomes populated: ${outcomesCount.total} outcomes found`);
  console.log('\n✅ All prerequisites validated successfully!\n');
}

/**
 * Validate all outcome references exist in course_outcomes collection
 */
async function validateOutcomeReferences(
  databases: Databases,
  entries: AuthoredSOWEntry[],
  courseId: string
): Promise<void> {
  console.log('\n🔍 Validating outcome references...\n');

  // Collect all unique outcome IDs from SOW entries (normalized)
  const allOutcomeIds = new Set<string>();
  entries.forEach(entry => {
    (entry.outcomeRefs || []).forEach(outcomeId => {
      allOutcomeIds.add(normalizeOutcomeId(outcomeId));
    });
  });

  console.log(`   Found ${allOutcomeIds.size} unique outcome references\n`);

  let validCount = 0;
  let invalidRefs: string[] = [];

  // Validate each outcome ID exists in course_outcomes
  for (const outcomeId of allOutcomeIds) {
    try {
      const result = await databases.listDocuments(
        'default',
        'course_outcomes',
        [
          Query.equal('courseId', courseId),
          Query.equal('outcomeId', outcomeId),
          Query.limit(1)
        ]
      );

      if (result.documents.length === 0) {
        invalidRefs.push(outcomeId);
        console.error(`  ❌ ${outcomeId}: Not found in course_outcomes`);
      } else {
        validCount++;
        console.log(`  ✅ ${outcomeId}: ${result.documents[0].outcomeTitle}`);
      }
    } catch (error: any) {
      invalidRefs.push(outcomeId);
      console.error(`  ❌ ${outcomeId}: Query error - ${error.message}`);
    }
  }

  console.log('');

  if (invalidRefs.length > 0) {
    throw new Error(
      `❌ Invalid outcome references found:\n` +
      invalidRefs.map(id => `  - ${id}`).join('\n') +
      `\n\n💡 Please ensure course_outcomes collection has been populated with migrateCourseOutcomes.ts`
    );
  }

  console.log(`  ✅ All ${validCount} outcome references validated\n`);
}

/**
 * Map outcome IDs (e.g., "O1" or "1") to course_outcomes document IDs
 */
async function mapOutcomeIdsToDocumentIds(
  databases: Databases,
  outcomeIds: string[],
  courseId: string
): Promise<string[]> {
  const documentIds: string[] = [];

  for (const outcomeId of outcomeIds) {
    // Normalize outcome ID (e.g., "1" -> "O1")
    const normalizedOutcomeId = normalizeOutcomeId(outcomeId);

    const result = await databases.listDocuments(
      'default',
      'course_outcomes',
      [
        Query.equal('courseId', courseId),
        Query.equal('outcomeId', normalizedOutcomeId),
        Query.limit(1)
      ]
    );

    if (result.documents.length === 0) {
      throw new Error(
        `❌ Outcome ${outcomeId} (normalized: ${normalizedOutcomeId}) not found in course_outcomes for course ${courseId}. ` +
        `This should have been caught by validation.`
      );
    }

    documentIds.push(result.documents[0].$id);
  }

  return documentIds;
}

/**
 * Create or update lesson template placeholders for each Authored_SOW entry
 * Returns a map of old placeholder refs to actual document IDs
 */
async function createOrUpdateLessonTemplates(
  databases: Databases,
  entries: AuthoredSOWEntry[],
  courseId: string
): Promise<Map<string, string>> {
  const referenceMap = new Map<string, string>();

  console.log('\n📝 Creating lesson template placeholders...');
  console.log(`   Total entries to process: ${entries.length}\n`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const entry of entries) {
    const oldRef = entry.lessonTemplateRef; // e.g., "AUTO_TBD_1"

    // Map outcome IDs to real course_outcomes document IDs
    const outcomeDocumentIds = await mapOutcomeIdsToDocumentIds(
      databases,
      entry.outcomeRefs || [],
      courseId
    );

    // Create template data with Phase 3 MVP2.5 fields
    const templateData: any = {
      title: entry.label,
      courseId: courseId,
      sow_order: entry.order, // ✅ SOW entry order for deterministic identification
      outcomeRefs: JSON.stringify(outcomeDocumentIds), // ✅ Real document IDs!
      cards: JSON.stringify([]), // Empty placeholder - to be populated later
      version: 1,
      status: 'draft',
      createdBy: 'sow_author_agent', // Required field
      // Phase 3 pedagogy fields
      lesson_type: entry.lesson_type || 'teach',
      estMinutes: entry.estMinutes || 50,
      engagement_tags: JSON.stringify(entry.engagement_tags || []),
      policy: JSON.stringify(entry.policy || {})
    };

    try {
      // Check if template already exists with this courseId + sow_order
      // sow_order is deterministic and stable even if titles change
      let existing = await databases.listDocuments(
        'default',
        'lesson_templates',
        [
          Query.equal('courseId', courseId),
          Query.equal('sow_order', entry.order),
          Query.limit(1)
        ]
      );

      // MIGRATION: Fall back to title-based lookup for old templates without sow_order
      if (existing.documents.length === 0) {
        existing = await databases.listDocuments(
          'default',
          'lesson_templates',
          [
            Query.equal('courseId', courseId),
            Query.equal('title', entry.label),
            Query.limit(1)
          ]
        );
      }

      let templateDoc;
      if (existing.documents.length > 0) {
        // Update existing template (either found by sow_order or title)
        templateDoc = await databases.updateDocument(
          'default',
          'lesson_templates',
          existing.documents[0].$id,
          templateData
        );
        updatedCount++;
        console.log(`  ✅ Updated #${entry.order}: ${entry.label} (${templateDoc.$id})`);
      } else {
        // Create new template with admin permissions
        templateDoc = await databases.createDocument(
          'default',
          'lesson_templates',
          ID.unique(),
          templateData
          // No permissions parameter - admin API key has full access
        );
        createdCount++;
        console.log(`  ✅ Created #${entry.order}: ${entry.label} (${templateDoc.$id})`);
      }

      // Store mapping: old placeholder → real document ID
      referenceMap.set(oldRef, templateDoc.$id);

    } catch (error: any) {
      console.error(`  ❌ Failed to process entry #${entry.order}: ${entry.label}`);
      console.error(`     Error: ${error.message}`);
      throw error;
    }
  }

  console.log(`\n📊 Template Creation Summary:`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Total: ${referenceMap.size}`);

  return referenceMap;
}

/**
 * Update Authored_SOW entries with real template IDs
 */
async function updateEntriesWithTemplateRefs(
  entries: AuthoredSOWEntry[],
  referenceMap: Map<string, string>
): Promise<AuthoredSOWEntry[]> {

  console.log('\n🔗 Updating Authored_SOW entries with real template IDs...\n');

  const updatedEntries = entries.map((entry) => {
    const realTemplateId = referenceMap.get(entry.lessonTemplateRef);

    if (!realTemplateId) {
      throw new Error(
        `Missing template ID mapping for entry: ${entry.label} ` +
        `(placeholder ref: ${entry.lessonTemplateRef})`
      );
    }

    const oldRef = entry.lessonTemplateRef.substring(0, 15) + '...'; // Truncate for display
    const newRef = realTemplateId.substring(0, 15) + '...';
    console.log(`  #${entry.order.toString().padStart(3, ' ')}. ${entry.label.padEnd(40, ' ')} ${oldRef} → ${newRef}`);

    return {
      ...entry,
      lessonTemplateRef: realTemplateId // Replace placeholder with real ID!
    };
  });

  console.log(`\n✅ ${updatedEntries.length} entries updated with real template IDs`);

  return updatedEntries;
}

/**
 * Validate all template references
 * - Check uniqueness of all IDs
 * - Verify all templates exist in database
 * - Validate title matching (warning only)
 */
async function validateTemplateReferences(
  databases: Databases,
  entries: AuthoredSOWEntry[]
): Promise<void> {

  console.log('\n✅ Validating template references...\n');

  const templateIds = entries.map(e => e.lessonTemplateRef);

  // Check 1: All IDs are unique
  const uniqueIds = new Set(templateIds);
  if (uniqueIds.size !== templateIds.length) {
    const duplicates = templateIds.filter((id, idx) =>
      templateIds.indexOf(id) !== idx
    );
    throw new Error(
      `Duplicate template references found:\n` +
      duplicates.map(id => `  - ${id}`).join('\n')
    );
  }
  console.log(`  ✅ Uniqueness Check: All ${uniqueIds.size} template IDs are unique`);

  // Check 2: All referenced templates exist
  let validCount = 0;
  let invalidRefs: string[] = [];

  for (const entry of entries) {
    try {
      await databases.getDocument(
        'default',
        'lesson_templates',
        entry.lessonTemplateRef
      );
      validCount++;
    } catch (error) {
      invalidRefs.push(`#${entry.order} ${entry.label}: ${entry.lessonTemplateRef}`);
    }
  }

  if (invalidRefs.length > 0) {
    throw new Error(
      `Invalid template references (documents don't exist):\n` +
      invalidRefs.map(r => `  - ${r}`).join('\n')
    );
  }

  console.log(`  ✅ Existence Check: All ${validCount} templates exist in database`);

  // Check 3: Verify titles match (warning only)
  let titleMismatches = 0;
  for (const entry of entries) {
    const template = await databases.getDocument(
      'default',
      'lesson_templates',
      entry.lessonTemplateRef
    );

    if (template.title !== entry.label) {
      console.warn(
        `  ⚠️  Title mismatch #${entry.order}: "${entry.label}" (SOW) vs "${template.title}" (template)`
      );
      titleMismatches++;
    }
  }

  if (titleMismatches === 0) {
    console.log(`  ✅ Title Matching: All titles match perfectly`);
  } else {
    console.log(`  ⚠️  Title Matching: ${titleMismatches} mismatches found (non-critical)`);
  }

  console.log('\n🎉 Validation Complete: All critical checks passed!\n');
}

/**
 * Parse CLI arguments
 */
function parseCLIArgs(): CLIArgs {
  const args = minimist(process.argv.slice(2));

  // Parse courseId if provided (used for all modes)
  const courseId = args['course-id'] || undefined;

  // Determine mode
  if (args.batch) {
    return {
      mode: 'batch',
      inputDir: args['input-dir'],
      validate: args.validate || false,
      courseId
    };
  } else if (args.name) {
    return {
      mode: 'named',
      name: args.name,
      inputDir: args['input-dir'],
      courseId
    };
  } else if (args.sow) {
    return {
      mode: 'single',
      sowFile: args.sow,
      courseId
    };
  } else {
    // Default to batch mode
    return {
      mode: 'batch',
      validate: false,
      courseId
    };
  }
}

/**
 * Validate directory structure
 */
function validateDirectoryStructure(baseDir: string): ValidationResult {
  const required = [
    'input/sows',
    'output/logs',
    'output/reports'
  ];

  const errors: string[] = [];

  for (const dir of required) {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing required directory: ${dir}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate SOW file using JSON schema
 */
async function validateSOWFile(filePath: string): Promise<ValidationResult> {
  const ajv = new Ajv();

  const schema = {
    type: 'object',
    required: ['$id', 'courseId', 'version', 'status', 'metadata', 'entries'],
    properties: {
      $id: { type: 'string' },
      courseId: { type: 'string', pattern: '^course_[a-z0-9]+$' },
      version: { type: ['number', 'string'], minimum: 1 },
      status: { enum: ['draft', 'published', 'archived'] },
      metadata: { type: 'object' },
      entries: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['order', 'lessonTemplateRef', 'label', 'outcomeRefs'],
          properties: {
            order: { type: 'number' },
            lessonTemplateRef: { type: 'string' },
            label: { type: 'string', minLength: 1 },
            outcomeRefs: { type: 'array', items: { type: 'string' } },
            assessmentStandardRefs: { type: 'array' }
          }
        }
      }
    }
  };

  const validate = ajv.compile(schema);

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const valid = validate(content);

    return {
      valid: !!valid,
      errors: validate.errors || []
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [{ message: `JSON parse error: ${error.message}` }]
    };
  }
}

/**
 * Discover SOW files in input directory
 */
function discoverSOWFiles(inputDir: string): SOWFile[] {
  const sowsDir = path.join(inputDir, 'input/sows');

  const sowFiles = fs.readdirSync(sowsDir)
    .filter(f => f.endsWith('.json'));

  return sowFiles.map(sowFile => {
    const name = sowFile.replace('.json', '');
    const parts = name.split('_');
    const subject = parts[0];
    const level = parts.slice(1).join('_');

    return {
      sowFile: path.join(sowsDir, sowFile),
      name,
      subject,
      level
    };
  });
}

/**
 * Generate batch processing report
 */
function generateBatchReport(results: BatchResult[], inputDir: string): void {
  const reportFile = path.join(inputDir, 'output/reports', `batch-report-${Date.now()}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  };

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`\n📊 Batch Summary:`);
  console.log(`   Total: ${report.total}`);
  console.log(`   ✅ Successful: ${report.successful}`);
  console.log(`   ❌ Failed: ${report.failed}`);
  console.log(`\n📁 Report saved: ${reportFile}`);
}

/**
 * Process batch of SOW files
 */
async function processBatch(inputDir: string, validateOnly: boolean = false, courseId?: string): Promise<BatchResult[]> {
  const sowFiles = discoverSOWFiles(inputDir);

  console.log(`\n📦 Batch Processing: ${sowFiles.length} SOW files found\n`);

  const results: BatchResult[] = [];

  for (const sow of sowFiles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${sow.name}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Validate
      const validation = await validateSOWFile(sow.sowFile);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
      }

      if (!validateOnly) {
        // Seed
        await seedSingleSOW(sow.sowFile, courseId);
      } else {
        console.log('✅ Validation passed (dry-run mode, no database writes)');
      }

      results.push({ name: sow.name, status: 'success' });
    } catch (error: any) {
      console.error(`❌ Failed to process ${sow.name}:`, error.message);
      results.push({ name: sow.name, status: 'failed', error: error.message });
    }
  }

  // Generate summary report
  generateBatchReport(results, inputDir);

  return results;
}

async function seedSingleSOW(sowFilePath: string, courseIdOverride?: string): Promise<void> {
  console.log('🌱 Starting Authored_SOW seed script...\n');

  // Validate environment variables
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    console.error('❌ Missing required environment variables:');
    if (!endpoint) console.error('  - NEXT_PUBLIC_APPWRITE_ENDPOINT');
    if (!projectId) console.error('  - NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    if (!apiKey) console.error('  - APPWRITE_API_KEY');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Project: ${projectId}\n`);

  // Create admin client with API key
  const adminClient = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(adminClient);

  console.log('✅ Admin client created with API key authentication\n');

  // Initialize server driver with admin client
  const sowDriver = new ServerAuthoredSOWDriver({
    client: adminClient,
    account: null as any,
    databases
  });

  console.log('✅ ServerAuthoredSOWDriver initialized\n');

  // Read the SOW file from provided path
  console.log(`📖 Reading SOW data from: ${sowFilePath}`);

  if (!fs.existsSync(sowFilePath)) {
    throw new Error(`File not found: ${sowFilePath}`);
  }

  const fileContent = fs.readFileSync(sowFilePath, 'utf-8');
  const sowData: SOWJSONFile = JSON.parse(fileContent);

  // Use courseIdOverride if provided, otherwise use from SOW data
  const courseId = courseIdOverride || sowData.courseId;

  console.log(`✅ Successfully loaded SOW data for course: ${courseId}`);
  console.log(`   Version: ${sowData.version}`);
  console.log(`   Status: ${sowData.status}`);
  console.log(`   Entries: ${sowData.entries.length} lessons\n`);

  // ============================================================
  // PHASE 0: Validate Prerequisites
  // ============================================================
  await validatePrerequisites(databases, courseId);

  // ============================================================
  // PHASE 1: Validate Outcome References
  // ============================================================
  console.log('📦 PHASE 1: Validate Outcome References');
  await validateOutcomeReferences(databases, sowData.entries, courseId);

  // ============================================================
  // PHASE 2: Create/Update Lesson Template Placeholders
  // ============================================================
  const referenceMap = await createOrUpdateLessonTemplates(
    databases,
    sowData.entries,
    courseId
  );

  // ============================================================
  // PHASE 3: Update Authored_SOW Entries with Real Template IDs
  // ============================================================
  const updatedEntries = await updateEntriesWithTemplateRefs(
    sowData.entries,
    referenceMap
  );

  // ============================================================
  // PHASE 4: Prepare and Upsert Authored_SOW Data
  // ============================================================
  const authoredSOWData: AuthoredSOWData = {
    courseId: courseId,
    version: String(sowData.version), // Ensure version is string
    status: sowData.status,
    entries: updatedEntries, // Use entries with real template IDs!
    metadata: {
      ...sowData.metadata,
      total_lessons: updatedEntries.length,
      total_estimated_minutes: updatedEntries.reduce((sum, entry) => sum + (entry.estMinutes || 0), 0),
      generated_at: new Date().toISOString(),
      author_agent_version: '1.0'
    },
    accessibility_notes: Array.isArray(sowData.metadata.accessibility_notes)
      ? sowData.metadata.accessibility_notes.join('\n')
      : sowData.metadata.accessibility_notes || ''
  };

  console.log('\n📊 Transformed data summary:');
  console.log(`   Total lessons: ${authoredSOWData.metadata.total_lessons}`);
  console.log(`   Total estimated minutes: ${authoredSOWData.metadata.total_estimated_minutes}`);
  console.log(`   Accessibility notes: ${authoredSOWData.accessibility_notes ? 'Yes' : 'No'}`);

  try {
    console.log('\n💾 Upserting to Authored_SOW collection...');

    const result = await sowDriver.upsertAuthoredSOW(authoredSOWData);

    console.log('\n✅ Successfully seeded Authored_SOW!');
    console.log(`   Document ID: ${result.$id}`);
    console.log(`   Course ID: ${result.courseId}`);
    console.log(`   Version: ${result.version}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Created At: ${result.$createdAt}`);
    console.log(`   Updated At: ${result.$updatedAt}`);

    // Parse and display entry count
    const entries = JSON.parse(result.entries);
    console.log(`   Entries stored: ${entries.length} lessons`);

    // ============================================================
    // PHASE 5: Validate All Template References
    // ============================================================
    await validateTemplateReferences(databases, updatedEntries);

    console.log('=' .repeat(60));
    console.log('🎉 Seed script completed successfully!');
    console.log('=' .repeat(60));
    console.log('\n📊 Final Summary:');
    console.log(`   ✅ Lesson templates: ${referenceMap.size} created/updated`);
    console.log(`   ✅ Authored_SOW: 1 document upserted`);
    console.log(`   ✅ Template references: All validated`);
    console.log(`   ✅ Total lessons: ${entries.length}`);

  } catch (error) {
    console.error('\n❌ Failed to seed Authored_SOW:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Main entry point - routes to appropriate mode based on CLI arguments
 */
async function main() {
  const args = parseCLIArgs();

  // Set default input directory
  const defaultInputDir = path.join(__dirname, '../../langgraph-author-agent/data/Seeding_Data');
  const inputDir = args.inputDir || defaultInputDir;

  // Validate directory structure
  const dirValidation = validateDirectoryStructure(inputDir);
  if (!dirValidation.valid) {
    console.error('❌ Invalid directory structure:');
    dirValidation.errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  // Route to appropriate mode
  if (args.mode === 'batch') {
    await processBatch(inputDir, args.validate || false, args.courseId);
  } else if (args.mode === 'named') {
    const sowFile = path.join(inputDir, 'input/sows', `${args.name}.json`);
    await seedSingleSOW(sowFile, args.courseId);
  } else {
    await seedSingleSOW(args.sowFile!, args.courseId);
  }
}

// Run the seed script
main()
  .then(() => {
    console.log('\n👋 Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:');
    console.error(error);
    process.exit(1);
  });
