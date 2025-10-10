#!/usr/bin/env tsx

/**
 * Backfill existing lesson templates with model versioning fields
 *
 * This script only updates documents - it assumes attributes and indexes
 * have already been created via Appwrite MCP tools or console.
 *
 * Updates:
 * - authored_sow_id: Links to Authored_SOW.$id
 * - authored_sow_version: Denormalized SOW version
 * - model_version: Set to "legacy" for existing lessons
 *
 * Usage:
 *   npm run backfill:lesson-versioning
 */

import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DATABASE_ID = 'default';
const LESSON_TEMPLATES_COLLECTION = 'lesson_templates';
const AUTHORED_SOW_COLLECTION = 'Authored_SOW';

async function main() {
  console.log('🔄 Starting Lesson Template Backfill');
  console.log('='.repeat(60));
  console.log('');

  // Validate environment variables
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  console.log('✅ Environment validated');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Project: ${projectId}\n`);

  // Initialize client
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  try {
    // Query all lesson templates (no filter - backfill all)
    console.log('📚 Fetching lesson templates...\n');

    const response = await databases.listDocuments(
      DATABASE_ID,
      LESSON_TEMPLATES_COLLECTION,
      [Query.limit(1000)] // Adjust if you have more than 1000 lessons
    );

    const lessons = response.documents;
    console.log(`   Found ${lessons.length} lesson templates\n`);

    if (lessons.length === 0) {
      console.log('✅ No lessons to backfill');
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let alreadyFilledCount = 0;
    let errorCount = 0;

    // Rate limiting: delay between updates (milliseconds)
    const DELAY_BETWEEN_UPDATES = 200; // 200ms = 5 updates per second

    for (const lesson of lessons) {
      try {
        // Skip if already has model_version set (and it's not empty string)
        if (lesson.model_version && lesson.model_version !== '') {
          console.log(`   ⏭️  Skipping ${lesson.$id}: Already has model_version="${lesson.model_version}"`);
          alreadyFilledCount++;
          continue;
        }

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
          console.warn(`   ⚠️  Skipping ${lesson.$id}: No Authored_SOW found for courseId ${lesson.courseId}`);
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
            model_version: 'legacy'
          }
        );

        successCount++;

        if (successCount % 5 === 0) {
          console.log(`   ✓ Processed ${successCount} lessons...`);
        }

        // Rate limiting: wait before next update to avoid hitting Appwrite rate limits
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_UPDATES));

      } catch (error: any) {
        // Check if it's a rate limit error and retry after a longer delay
        if (error.message?.includes('Rate limit')) {
          console.warn(`   ⏳ Rate limit hit for ${lesson.$id}, waiting 2 seconds and retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

          try {
            // Retry the query and update
            const sowResponse = await databases.listDocuments(
              DATABASE_ID,
              AUTHORED_SOW_COLLECTION,
              [
                Query.equal('courseId', lesson.courseId),
                Query.limit(1)
              ]
            );

            if (sowResponse.documents.length > 0) {
              const authoredSOW = sowResponse.documents[0];
              await databases.updateDocument(
                DATABASE_ID,
                LESSON_TEMPLATES_COLLECTION,
                lesson.$id,
                {
                  authored_sow_id: authoredSOW.$id,
                  authored_sow_version: authoredSOW.version || 'v1.0',
                  model_version: 'legacy'
                }
              );
              successCount++;
              console.log(`   ✅ Retry succeeded for ${lesson.$id}`);
              // Extra delay after rate limit recovery
              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_UPDATES * 2));
            }
          } catch (retryError: any) {
            console.error(`   ❌ Retry failed for ${lesson.$id}: ${retryError.message}`);
            errorCount++;
          }
        } else {
          console.error(`   ❌ Failed to update lesson ${lesson.$id}: ${error.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log('='.repeat(60));
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ⏭️  Already filled: ${alreadyFilledCount}`);
    console.log(`   ⚠️  Skipped (no SOW): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${lessons.length}`);
    console.log('');

    if (errorCount > 0) {
      throw new Error(`Backfill completed with ${errorCount} errors`);
    }

    console.log('🎉 Backfill completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Backfill failed:', error.message);
    process.exit(1);
  }
}

main();
