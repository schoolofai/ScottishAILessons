#!/usr/bin/env tsx

/**
 * TEMPORARY CLEANUP SCRIPT
 *
 * This script removes legacy lesson_templates created by the old
 * seedAuthoredSOW.ts before model versioning was implemented.
 *
 * ⚠️  DEPRECATED: This script will be removed after cleanup is complete.
 *
 * Run once per environment to clean up legacy data.
 *
 * Legacy templates are identified by:
 * - Missing model_version field (created before versioning)
 * - model_version === 'legacy' (explicitly marked)
 * - createdBy === 'sow_author_agent' (characteristic of SOW placeholders)
 *
 * Usage:
 *   # Preview only (no deletion)
 *   tsx scripts/cleanupLegacyTemplates.ts --preview
 *
 *   # Delete all legacy templates
 *   tsx scripts/cleanupLegacyTemplates.ts
 *
 *   # Filter by specific course
 *   tsx scripts/cleanupLegacyTemplates.ts --course-id course_c84774
 *
 *   # Preview for specific course
 *   tsx scripts/cleanupLegacyTemplates.ts --preview --course-id course_c84774
 */

import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Configuration
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;

const DATABASE_ID = 'default';
const LESSON_TEMPLATES_COLLECTION = 'lesson_templates';

interface LegacyTemplate {
  $id: string;
  title: string;
  courseId: string;
  sow_order: number;
  createdBy: string;
  model_version?: string;
  $createdAt: string;
  $updatedAt: string;
}

/**
 * Parse CLI arguments
 */
function parseCLIArgs(): { preview: boolean; courseId?: string } {
  const args = process.argv.slice(2);

  return {
    preview: args.includes('--preview'),
    courseId: args.includes('--course-id')
      ? args[args.indexOf('--course-id') + 1]
      : undefined
  };
}

/**
 * Sleep helper for rate limiting (defined before fetch function)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all lesson templates with pagination and rate limiting
 */
async function fetchAllTemplates(
  databases: Databases,
  courseId?: string
): Promise<any[]> {
  console.log('🔍 Fetching lesson templates with rate limiting...\n');

  const allTemplates: any[] = [];
  let offset = 0;
  const limit = 100;
  const DELAY_BETWEEN_FETCHES = 500; // 500ms delay between paginated fetches

  while (true) {
    const queries = [
      Query.limit(limit),
      Query.offset(offset)
    ];

    // Add course filter if specified
    if (courseId) {
      queries.push(Query.equal('courseId', courseId));
    }

    const batch = await databases.listDocuments(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      queries
    );

    allTemplates.push(...batch.documents);

    console.log(`   Fetched ${allTemplates.length} templates...`);

    if (batch.documents.length < limit) {
      break;
    }

    offset += limit;

    // Add delay between paginated fetches to avoid rate limits
    if (batch.documents.length === limit) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_FETCHES}ms before next batch...`);
      await sleep(DELAY_BETWEEN_FETCHES);
    }
  }

  console.log(`\n✅ Total templates fetched: ${allTemplates.length}\n`);

  return allTemplates;
}

/**
 * Filter legacy templates
 */
function filterLegacyTemplates(templates: any[]): LegacyTemplate[] {
  return templates.filter(doc => {
    // Legacy if:
    // 1. Missing model_version field
    // 2. model_version is null/undefined
    // 3. model_version === 'legacy'
    const hasNoModelVersion = !doc.hasOwnProperty('model_version') ||
                              doc.model_version === null ||
                              doc.model_version === undefined;
    const isExplicitlyLegacy = doc.model_version === 'legacy';

    return hasNoModelVersion || isExplicitlyLegacy;
  }) as LegacyTemplate[];
}

/**
 * Display legacy templates for review
 */
function displayLegacyTemplates(templates: LegacyTemplate[]): void {
  console.log('🔍 Legacy Templates Found:\n');
  console.log('═'.repeat(80));
  console.log('');

  if (templates.length === 0) {
    console.log('✅ No legacy templates found!');
    console.log('');
    console.log('═'.repeat(80));
    return;
  }

  // Group by course for better readability
  const byCourse = templates.reduce((acc, template) => {
    if (!acc[template.courseId]) {
      acc[template.courseId] = [];
    }
    acc[template.courseId].push(template);
    return acc;
  }, {} as Record<string, LegacyTemplate[]>);

  Object.entries(byCourse).forEach(([courseId, courseTemplates]) => {
    console.log(`📚 Course: ${courseId} (${courseTemplates.length} templates)`);
    console.log('─'.repeat(80));

    courseTemplates
      .sort((a, b) => a.sow_order - b.sow_order)
      .forEach((template, idx) => {
        console.log(`  ${idx + 1}. ${template.title}`);
        console.log(`     ID: ${template.$id}`);
        console.log(`     Order: ${template.sow_order}`);
        console.log(`     Created By: ${template.createdBy}`);
        console.log(`     Model Version: ${template.model_version || '❌ NOT SET (legacy)'}`);
        console.log(`     Created: ${template.$createdAt}`);
        console.log('');
      });

    console.log('');
  });

  console.log('═'.repeat(80));
  console.log(`\n📊 Total: ${templates.length} legacy templates\n`);
}

/**
 * Ask for confirmation
 */
async function confirmDeletion(count: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('⚠️  WARNING: This action cannot be undone!');
  console.log('');
  console.log(`You are about to delete ${count} lesson template(s).`);
  console.log('');
  console.log('These templates were created by the old seedAuthoredSOW.ts script');
  console.log('and lack model versioning. They should be regenerated using');
  console.log('seedAuthoredLesson.ts with proper model version tracking.');
  console.log('');

  const answer = await new Promise<string>((resolve) => {
    rl.question(`Type "DELETE" (all caps) to confirm deletion: `, resolve);
  });
  rl.close();

  return answer === 'DELETE';
}

/**
 * Delete legacy templates with rate limiting and retry logic
 */
async function deleteLegacyTemplates(
  databases: Databases,
  templates: LegacyTemplate[]
): Promise<{ deleted: number; failed: number; errors: string[] }> {
  console.log('\n🗑️  Deleting legacy templates with rate limiting...\n');

  let deletedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const BATCH_SIZE = 5; // Process 5 at a time
  const DELAY_BETWEEN_DELETES = 300; // 300ms between each delete
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second between batches
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds before retry

  for (let i = 0; i < templates.length; i++) {
    const template = templates[i];
    const progress = `[${i + 1}/${templates.length}]`;

    let retries = 0;
    let success = false;

    while (retries < MAX_RETRIES && !success) {
      try {
        await databases.deleteDocument(
          DATABASE_ID,
          LESSON_TEMPLATES_COLLECTION,
          template.$id
        );
        deletedCount++;
        console.log(`${progress} ✅ Deleted: ${template.title} (${template.$id})`);
        success = true;

        // Delay between individual deletes
        if (i < templates.length - 1) {
          await sleep(DELAY_BETWEEN_DELETES);
        }

      } catch (error: any) {
        // Check for authorization errors (most common issue)
        if (error.code === 401 || error.message?.includes('not authorized') || error.message?.includes('unauthorized')) {
          console.error('');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ AUTHORIZATION ERROR');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('');
          console.error('Your API key does not have DELETE permissions for lesson_templates.');
          console.error('');
          console.error('Fix this in Appwrite Console:');
          console.error('  1. Go to your Appwrite project');
          console.error('  2. Navigate to Settings → API Keys');
          console.error('  3. Find your API key (or create a new one)');
          console.error('  4. Under Scopes, ensure these are checked:');
          console.error('     ☑ databases.read');
          console.error('     ☑ databases.write');
          console.error('     ☑ collections.read');
          console.error('     ☑ documents.read');
          console.error('     ☑ documents.write');
          console.error('  5. Save and update APPWRITE_API_KEY in .env.local');
          console.error('');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('');
          throw error; // Exit immediately - no point continuing
        }

        // Check if it's a rate limit error (status 429)
        if (error.code === 429 || error.message?.includes('rate limit')) {
          retries++;
          if (retries < MAX_RETRIES) {
            console.warn(`${progress} ⏳ Rate limit hit, retrying in ${RETRY_DELAY/1000}s... (attempt ${retries}/${MAX_RETRIES})`);
            await sleep(RETRY_DELAY);
          } else {
            failedCount++;
            const errorMsg = `${progress} ❌ Failed after ${MAX_RETRIES} retries: ${template.title} - Rate limit exceeded`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        } else {
          // Non-rate-limit error
          failedCount++;
          const errorMsg = `${progress} ❌ Failed: ${template.title} (${template.$id}) - ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          break; // Don't retry non-rate-limit errors
        }
      }
    }

    // Add longer delay between batches
    if ((i + 1) % BATCH_SIZE === 0 && i < templates.length - 1) {
      console.log(`\n⏸️  Batch complete (${i + 1}/${templates.length}). Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...\n`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return { deleted: deletedCount, failed: failedCount, errors };
}

/**
 * Display summary
 */
function displaySummary(
  result: { deleted: number; failed: number; errors: string[] },
  totalProcessed: number,
  previewMode: boolean
): void {
  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 Cleanup Summary');
  console.log('═'.repeat(80));

  if (previewMode) {
    console.log(`\n🔍 Preview Mode - No Deletion Performed`);
    console.log(`\n📋 Would delete: ${totalProcessed} templates`);
    console.log('');
    console.log('To actually delete these templates, run without --preview flag:');
    console.log('  tsx scripts/cleanupLegacyTemplates.ts');
  } else {
    console.log(`\n✅ Deleted: ${result.deleted}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log(`📋 Total Processed: ${totalProcessed}`);

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      result.errors.forEach(err => console.log(`   ${err}`));
    }
  }

  console.log('');
  console.log('═'.repeat(80));
}

/**
 * Main function
 */
async function main() {
  console.log('🧹 Legacy Template Cleanup Script');
  console.log('═'.repeat(80));
  console.log('');

  // Parse CLI arguments
  const { preview, courseId } = parseCLIArgs();

  if (preview) {
    console.log('🔍 PREVIEW MODE - No deletion will be performed\n');
  }

  if (courseId) {
    console.log(`📚 Filtering by course: ${courseId}\n`);
  }

  // Validate environment variables
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing required environment variables:');
    if (!APPWRITE_ENDPOINT) console.error('  - NEXT_PUBLIC_APPWRITE_ENDPOINT');
    if (!APPWRITE_PROJECT_ID) console.error('  - NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    if (!APPWRITE_API_KEY) console.error('  - APPWRITE_API_KEY');
    console.error('');
    console.error('💡 Make sure .env.local exists in assistant-ui-frontend/ directory');
    process.exit(1);
  }

  // Debug: Show masked API key for verification
  const maskedKey = APPWRITE_API_KEY.substring(0, 10) + '...' + APPWRITE_API_KEY.substring(APPWRITE_API_KEY.length - 4);
  console.log('🔐 API Key loaded (masked): ' + maskedKey);
  console.log('');

  // Initialize Appwrite client with API key (admin authentication)
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  console.log('✅ Initialized Appwrite admin client');
  console.log(`   Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`   Project: ${APPWRITE_PROJECT_ID}`);
  console.log('');

  // Test connection with a simple read operation
  console.log('🔌 Testing connection and permissions...');
  try {
    // Try to list documents (read permission test)
    const testRead = await databases.listDocuments(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      [Query.limit(1)]
    );
    console.log(`   ✅ READ permission: OK (found ${testRead.total} total templates)`);
  } catch (error: any) {
    console.error('   ❌ READ permission: FAILED');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('💡 Your API key does not have database read permissions.');
    console.error('   Check your Appwrite console → API Keys → Scopes');
    process.exit(1);
  }
  console.log('');

  try {
    // Fetch all templates
    const allTemplates = await fetchAllTemplates(databases, courseId);

    // Filter legacy templates
    console.log('🔍 Filtering legacy templates...\n');
    const legacyTemplates = filterLegacyTemplates(allTemplates);

    console.log(`✅ Found ${legacyTemplates.length} legacy templates`);
    console.log(`   (out of ${allTemplates.length} total templates)\n`);

    // Display legacy templates
    displayLegacyTemplates(legacyTemplates);

    // Exit if no legacy templates found
    if (legacyTemplates.length === 0) {
      console.log('✅ No cleanup needed!');
      process.exit(0);
    }

    // Preview mode - just show what would be deleted
    if (preview) {
      displaySummary(
        { deleted: 0, failed: 0, errors: [] },
        legacyTemplates.length,
        true
      );
      process.exit(0);
    }

    // Ask for confirmation
    const confirmed = await confirmDeletion(legacyTemplates.length);

    if (!confirmed) {
      console.log('\n❌ Deletion cancelled by user.');
      console.log('');
      console.log('To preview without deleting, use:');
      console.log('  tsx scripts/cleanupLegacyTemplates.ts --preview');
      process.exit(0);
    }

    // Delete legacy templates
    const result = await deleteLegacyTemplates(databases, legacyTemplates);

    // Display summary
    displaySummary(result, legacyTemplates.length, false);

    // Exit with appropriate code
    process.exit(result.failed > 0 ? 1 : 0);

  } catch (error: any) {
    console.error('');
    console.error('═'.repeat(80));
    console.error('❌ ERROR: Cleanup failed');
    console.error('═'.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
