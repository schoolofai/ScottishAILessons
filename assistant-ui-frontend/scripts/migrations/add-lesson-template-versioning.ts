#!/usr/bin/env tsx

/**
 * Schema Migration: Add Lesson Template Model Versioning
 *
 * This migration enables A/B testing of different AI models (GPT-4, Claude, Gemini)
 * by allowing multiple lesson template versions for the same curriculum position.
 *
 * Changes:
 * 1. Adds three new optional attributes:
 *    - authored_sow_id: FK to Authored_SOW.$id
 *    - authored_sow_version: Denormalized version string
 *    - model_version: AI model identifier (e.g., "gpt4", "claude-sonnet-4")
 *
 * 2. Creates two indexes for efficient querying:
 *    - sow_model_lookup_idx: (authored_sow_id, sow_order, model_version)
 *    - lesson_comparison_idx: (courseId, sow_order, model_version)
 *
 * 3. Backfills existing lesson templates with model_version="legacy"
 *
 * Usage:
 *   npm run migrate:lesson-versioning
 *
 * Prerequisites:
 *   - APPWRITE_API_KEY must be set in .env.local
 *   - lesson_templates collection must exist
 */

import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const DATABASE_ID = 'default';
const LESSON_TEMPLATES_COLLECTION = 'lesson_templates';
const AUTHORED_SOW_COLLECTION = 'Authored_SOW';

/**
 * Wait for attribute to become available (Appwrite processes async)
 */
async function waitForAttributeAvailable(
  databases: Databases,
  attributeKey: string,
  maxAttempts: number = 30
): Promise<void> {
  console.log(`   Waiting for attribute "${attributeKey}" to become available...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const attribute = await databases.getAttribute(
        DATABASE_ID,
        LESSON_TEMPLATES_COLLECTION,
        attributeKey
      );

      if (attribute.status === 'available') {
        console.log(`   ✅ Attribute "${attributeKey}" is available`);
        return;
      }

      if (attribute.status === 'failed') {
        throw new Error(`Attribute creation failed: ${attribute.error || 'Unknown error'}`);
      }

      // Status is 'processing' - wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

    } catch (error: any) {
      if (attempt === maxAttempts) {
        throw new Error(`Timeout waiting for attribute "${attributeKey}": ${error.message}`);
      }
      // Retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error(`Attribute "${attributeKey}" did not become available after ${maxAttempts} attempts`);
}

/**
 * Add new attributes to lesson_templates collection
 */
async function addAttributes(databases: Databases): Promise<void> {
  console.log('\n📝 Step 1: Adding new attributes to lesson_templates collection\n');

  try {
    // Attribute 1: authored_sow_id
    console.log('   Adding authored_sow_id...');
    await databases.createStringAttribute(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      'authored_sow_id',
      50,     // size
      false   // required
    );
    console.log('   ✅ authored_sow_id attribute created');

    // Attribute 2: authored_sow_version
    console.log('   Adding authored_sow_version...');
    await databases.createStringAttribute(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      'authored_sow_version',
      20,     // size
      false   // required
    );
    console.log('   ✅ authored_sow_version attribute created');

    // Attribute 3: model_version
    console.log('   Adding model_version...');
    await databases.createStringAttribute(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      'model_version',
      50,     // size
      false,  // required
      ''      // default value
    );
    console.log('   ✅ model_version attribute created');

    // Wait for all attributes to become available
    console.log('\n⏳ Waiting for attributes to be processed by Appwrite...\n');
    await waitForAttributeAvailable(databases, 'authored_sow_id');
    await waitForAttributeAvailable(databases, 'authored_sow_version');
    await waitForAttributeAvailable(databases, 'model_version');

    console.log('\n✅ All attributes are available and ready for use\n');

  } catch (error: any) {
    // Check if attribute already exists
    if (error.code === 409 || error.message?.includes('already exists')) {
      console.log('   ⚠️  Attributes may already exist, continuing...');
    } else {
      throw new Error(`Failed to add attributes: ${error.message}`);
    }
  }
}

/**
 * Create indexes for efficient querying
 */
async function createIndexes(databases: Databases): Promise<void> {
  console.log('📊 Step 2: Creating indexes for efficient querying\n');

  try {
    // Index 1: sow_model_lookup_idx
    console.log('   Creating sow_model_lookup_idx...');
    console.log('   Purpose: Fast lookup by SOW + model (e.g., "Get all GPT-4 lessons from SOW v2.1")');
    await databases.createIndex(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      'sow_model_lookup_idx',
      'key',
      ['authored_sow_id', 'sow_order', 'model_version'],
      ['ASC', 'ASC', 'ASC']
    );
    console.log('   ✅ sow_model_lookup_idx created\n');

    // Index 2: lesson_comparison_idx
    console.log('   Creating lesson_comparison_idx...');
    console.log('   Purpose: Compare all model versions of same lesson (e.g., "GPT-4 vs Claude for lesson #5")');
    await databases.createIndex(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      'lesson_comparison_idx',
      'key',
      ['courseId', 'sow_order', 'model_version'],
      ['ASC', 'ASC', 'ASC']
    );
    console.log('   ✅ lesson_comparison_idx created\n');

    console.log('✅ All indexes created successfully\n');

  } catch (error: any) {
    // Check if index already exists
    if (error.code === 409 || error.message?.includes('already exists')) {
      console.log('   ⚠️  Indexes may already exist, continuing...');
    } else {
      throw new Error(`Failed to create indexes: ${error.message}`);
    }
  }
}

/**
 * Backfill existing lesson templates with references to Authored_SOW
 */
async function backfillExistingLessons(databases: Databases): Promise<void> {
  console.log('🔄 Step 3: Backfilling existing lesson templates\n');

  try {
    // Query all lessons without authored_sow_id (new lessons will have this field)
    const response = await databases.listDocuments(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      [Query.isNull('authored_sow_id')]
    );

    const lessons = response.documents;

    if (lessons.length === 0) {
      console.log('   ✅ No lessons to backfill (all already have authored_sow_id)');
      return;
    }

    console.log(`   Found ${lessons.length} lessons to backfill\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const lesson of lessons) {
      try {
        // Find matching Authored_SOW by courseId
        const sowResponse = await databases.listDocuments(
          DATABASE_ID,
          AUTHORED_SOW_COLLECTION,
          [
            Query.equal('courseId', lesson.courseId),
            Query.limit(1)
          ]
        );

        if (sowResponse.documents.length === 0) {
          console.warn(`   ⚠️  Skipping lesson ${lesson.$id}: No Authored_SOW found for courseId ${lesson.courseId}`);
          skippedCount++;
          continue;
        }

        const authoredSOW = sowResponse.documents[0];

        // Update lesson with references
        await databases.updateDocument(
          DATABASE_ID,
          LESSON_TEMPLATES_COLLECTION,
          lesson.$id,
          {
            authored_sow_id: authoredSOW.$id,
            authored_sow_version: authoredSOW.version || 'v1.0',
            model_version: 'legacy'  // Mark pre-versioning lessons
          }
        );

        successCount++;

        if (successCount % 10 === 0) {
          console.log(`   ✓ Processed ${successCount} lessons...`);
        }

      } catch (error: any) {
        console.error(`   ❌ Failed to update lesson ${lesson.$id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ⚠️  Skipped (no SOW): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${lessons.length}\n`);

    if (errorCount > 0) {
      throw new Error(`Backfill completed with ${errorCount} errors`);
    }

  } catch (error: any) {
    throw new Error(`Backfill failed: ${error.message}`);
  }
}

/**
 * Main migration execution
 */
async function main() {
  console.log('🚀 Starting Lesson Template Model Versioning Migration');
  console.log('='.repeat(60));
  console.log('');

  // Validate environment variables
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    console.error('❌ Missing required environment variables:');
    if (!endpoint) console.error('   - NEXT_PUBLIC_APPWRITE_ENDPOINT');
    if (!projectId) console.error('   - NEXT_PUBLIC_APPWRITE_PROJECT_ID');
    if (!apiKey) console.error('   - APPWRITE_API_KEY');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Project: ${projectId}`);
  console.log('');

  // Initialize Appwrite client with admin API key
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  console.log('✅ Admin client initialized\n');

  try {
    // Step 1: Add attributes
    await addAttributes(databases);

    // Step 2: Create indexes
    await createIndexes(databases);

    // Step 3: Backfill existing data
    await backfillExistingLessons(databases);

    console.log('='.repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Verify attributes in Appwrite console:');
    console.log('      - authored_sow_id (string, 50 chars)');
    console.log('      - authored_sow_version (string, 20 chars)');
    console.log('      - model_version (string, 50 chars, default: "")');
    console.log('');
    console.log('   2. Verify indexes in Appwrite console:');
    console.log('      - sow_model_lookup_idx');
    console.log('      - lesson_comparison_idx');
    console.log('');
    console.log('   3. Test seeding script with model versioning:');
    console.log('      npm run seed:authored-lesson "course_c84774" 0 "path/to/pack.txt" "gpt4"');
    console.log('      npm run seed:authored-lesson "course_c84774" 0 "path/to/pack.txt" "claude-sonnet-4"');
    console.log('');

  } catch (error: any) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Migration failed');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   - Check that lesson_templates collection exists');
    console.error('   - Verify admin API key has write permissions');
    console.error('   - Ensure no conflicting attributes exist');
    console.error('   - Check Appwrite console for error details');
    console.error('');
    process.exit(1);
  }
}

// Run migration
main();
