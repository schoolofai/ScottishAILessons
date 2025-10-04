#!/usr/bin/env ts-node

/**
 * Migration script for adding Phase 3 MVP2.5 fields to existing lesson templates
 *
 * This script adds default values for:
 * - lesson_type (default: 'teach')
 * - estMinutes (default: 50)
 * - engagement_tags (default: [])
 * - policy (default: {})
 *
 * Usage:
 *   npm run migrate:lesson-templates
 *   or
 *   tsx scripts/migrateLessonTemplates.ts
 *
 * Requirements:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT environment variable
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID environment variable
 *   - APPWRITE_API_KEY environment variable (admin API key)
 */

import { Client, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

interface LessonTemplate {
  $id: string;
  title: string;
  lesson_type?: string;
  estMinutes?: number;
  engagement_tags?: string;
  policy?: string;
}

async function migrateLessonTemplates() {
  console.log('🔄 Starting lesson template migration for Phase 3 MVP2.5...\n');

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

  try {
    // Get all existing lesson templates
    console.log('📖 Fetching existing lesson templates...');

    const response = await databases.listDocuments(
      'default',
      'lesson_templates',
      [Query.limit(500)] // Adjust if you have more templates
    );

    console.log(`✅ Found ${response.total} lesson templates\n`);

    if (response.total === 0) {
      console.log('ℹ️  No lesson templates to migrate');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const template of response.documents as LessonTemplate[]) {
      try {
        // Check if template already has new fields
        const hasNewFields =
          template.lesson_type !== undefined &&
          template.estMinutes !== undefined &&
          template.engagement_tags !== undefined &&
          template.policy !== undefined;

        if (hasNewFields) {
          console.log(`⏭️  Skipping ${template.title} (${template.$id}) - already migrated`);
          skipCount++;
          continue;
        }

        // Prepare default values for new fields
        const updates: any = {};

        if (template.lesson_type === undefined) {
          updates.lesson_type = 'teach'; // Default lesson type
        }

        if (template.estMinutes === undefined) {
          updates.estMinutes = 50; // Default 50 minutes
        }

        if (template.engagement_tags === undefined) {
          updates.engagement_tags = JSON.stringify([]); // Empty array
        }

        if (template.policy === undefined) {
          updates.policy = JSON.stringify({
            calculator_section: 'mixed',
            assessment_notes: '',
            accessibility: {
              dyslexia_friendly: false,
              plain_language_level: 'standard',
              extra_time: false
            }
          });
        }

        // Update the document
        await databases.updateDocument(
          'default',
          'lesson_templates',
          template.$id,
          updates
        );

        successCount++;
        console.log(`✅ Migrated: ${template.title} (${template.$id})`);

      } catch (error: any) {
        errorCount++;
        console.error(`❌ Failed to migrate ${template.title}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already migrated): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📈 Total processed: ${successCount + skipCount + errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Migration completed with errors. Please review the logs above.');
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    console.error('   Error message:', error.message);
    if (error.response) {
      console.error('   Response:', error.response);
    }
    process.exit(1);
  }
}

// Run migration
migrateLessonTemplates()
  .then(() => {
    console.log('\n👋 Exiting...');
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:');
    console.error(error);
    process.exit(1);
  });
