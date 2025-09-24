#!/usr/bin/env tsx

/**
 * Seed Data Migration Script
 *
 * This script migrates existing seeded data to be compatible with the new
 * collection structures (MasteryV2, SOWV2, enhanced Evidence, Routine).
 *
 * Usage:
 *   npm run migrate-seeds
 *   or
 *   npx tsx scripts/migrate-seed-data.ts
 *
 * What it does:
 * 1. Consolidates individual scheme_of_work entries into SOWV2 format
 * 2. Creates initial MasteryV2 records for enrolled students
 * 3. Validates lesson_template JSON parsing compatibility
 * 4. Prepares enhanced Evidence collection structure
 */

import { Client, Databases, Query } from 'appwrite';

// Configuration
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY; // Server API key required

interface MigrationStats {
  sowMigrated: number;
  masteryCreated: number;
  templatesValidated: number;
  errors: string[];
}

class SeedDataMigrator {
  private databases: Databases;
  private stats: MigrationStats = {
    sowMigrated: 0,
    masteryCreated: 0,
    templatesValidated: 0,
    errors: []
  };

  constructor() {
    if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      throw new Error('Missing required environment variables: APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
    }

    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);

    this.databases = new Databases(client);
  }

  /**
   * Run full migration process
   */
  async migrate(): Promise<void> {
    console.log('🚀 Starting seed data migration...');
    console.log('=====================================');

    try {
      await this.validateLessonTemplates();
      await this.migrateSOWData();
      await this.createInitialMasteryRecords();
      await this.prepareEvidenceStructure();

      this.printResults();
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Validate that lesson templates have proper JSON structure
   */
  private async validateLessonTemplates(): Promise<void> {
    console.log('📋 Validating lesson templates...');

    try {
      const templates = await this.databases.listDocuments('default', 'lesson_templates');

      for (const template of templates.documents) {
        try {
          // Test JSON parsing of outcomeRefs and cards
          const outcomeRefs = typeof template.outcomeRefs === 'string'
            ? JSON.parse(template.outcomeRefs)
            : template.outcomeRefs;

          const cards = typeof template.cards === 'string'
            ? JSON.parse(template.cards)
            : template.cards;

          // Validate structure
          if (!Array.isArray(outcomeRefs)) {
            this.stats.errors.push(`Template ${template.$id}: outcomeRefs is not an array`);
          }

          if (!Array.isArray(cards)) {
            this.stats.errors.push(`Template ${template.$id}: cards is not an array`);
          }

          this.stats.templatesValidated++;
        } catch (parseError) {
          this.stats.errors.push(`Template ${template.$id}: JSON parsing failed - ${parseError}`);
        }
      }

      console.log(`✅ Validated ${this.stats.templatesValidated} lesson templates`);
    } catch (error) {
      this.stats.errors.push(`Failed to validate lesson templates: ${error}`);
    }
  }

  /**
   * Migrate individual SOW entries to consolidated SOWV2 format
   */
  private async migrateSOWData(): Promise<void> {
    console.log('📚 Migrating SOW data to SOWV2...');

    try {
      // Get all individual SOW entries
      const sowEntries = await this.databases.listDocuments('default', 'scheme_of_work', [
        Query.orderAsc('studentId'),
        Query.orderAsc('courseId'),
        Query.orderAsc('order')
      ]);

      // Group by studentId + courseId
      const enrollmentGroups: { [key: string]: any[] } = {};

      for (const entry of sowEntries.documents) {
        const key = `${entry.studentId}-${entry.courseId}`;
        if (!enrollmentGroups[key]) {
          enrollmentGroups[key] = [];
        }
        enrollmentGroups[key].push(entry);
      }

      // Create SOWV2 records for each enrollment
      for (const [enrollmentKey, entries] of Object.entries(enrollmentGroups)) {
        const [studentId, courseId] = enrollmentKey.split('-');

        try {
          // Check if SOWV2 record already exists
          const existingSOWV2 = await this.databases.listDocuments('default', 'SOWV2', [
            Query.equal('studentId', studentId),
            Query.equal('courseId', courseId),
            Query.limit(1)
          ]);

          if (existingSOWV2.documents.length > 0) {
            console.log(`  → SOWV2 already exists for ${studentId}/${courseId}, skipping`);
            continue;
          }

          // Create consolidated entries
          const consolidatedEntries = entries
            .sort((a, b) => a.order - b.order)
            .map(entry => ({
              order: entry.order,
              lessonTemplateId: entry.lessonTemplateId,
              plannedAt: entry.plannedAt || undefined
            }));

          // Create SOWV2 document
          await this.databases.createDocument('default', 'SOWV2', 'unique()', {
            studentId,
            courseId,
            entries: JSON.stringify(consolidatedEntries),
            createdAt: entries[0]?.createdAt || new Date().toISOString()
          });

          this.stats.sowMigrated++;
          console.log(`  ✅ Migrated SOW for ${studentId}/${courseId} (${consolidatedEntries.length} lessons)`);
        } catch (error) {
          this.stats.errors.push(`Failed to migrate SOW for ${enrollmentKey}: ${error}`);
        }
      }

      console.log(`✅ Migrated ${this.stats.sowMigrated} SOW enrollments to SOWV2`);
    } catch (error) {
      this.stats.errors.push(`Failed to migrate SOW data: ${error}`);
    }
  }

  /**
   * Create initial MasteryV2 records for all enrolled students
   */
  private async createInitialMasteryRecords(): Promise<void> {
    console.log('🎯 Creating initial MasteryV2 records...');

    try {
      // Get all unique student/course enrollments from SOWV2
      const sowV2Records = await this.databases.listDocuments('default', 'SOWV2');

      for (const sowRecord of sowV2Records.documents) {
        try {
          // Check if MasteryV2 record already exists
          const existingMastery = await this.databases.listDocuments('default', 'MasteryV2', [
            Query.equal('studentId', sowRecord.studentId),
            Query.equal('courseId', sowRecord.courseId),
            Query.limit(1)
          ]);

          if (existingMastery.documents.length > 0) {
            console.log(`  → MasteryV2 already exists for ${sowRecord.studentId}/${sowRecord.courseId}, skipping`);
            continue;
          }

          // Create initial MasteryV2 record with empty EMA structure
          await this.databases.createDocument('default', 'MasteryV2', 'unique()', {
            studentId: sowRecord.studentId,
            courseId: sowRecord.courseId,
            emaByOutcome: JSON.stringify({}), // Start with empty EMAs
            updatedAt: new Date().toISOString()
          });

          this.stats.masteryCreated++;
          console.log(`  ✅ Created initial MasteryV2 for ${sowRecord.studentId}/${sowRecord.courseId}`);
        } catch (error) {
          this.stats.errors.push(`Failed to create MasteryV2 for ${sowRecord.studentId}/${sowRecord.courseId}: ${error}`);
        }
      }

      console.log(`✅ Created ${this.stats.masteryCreated} initial MasteryV2 records`);
    } catch (error) {
      this.stats.errors.push(`Failed to create initial mastery records: ${error}`);
    }
  }

  /**
   * Prepare enhanced Evidence collection structure
   */
  private async prepareEvidenceStructure(): Promise<void> {
    console.log('📊 Preparing enhanced Evidence structure...');

    try {
      // Check if Evidence collection has the new fields
      const existingEvidence = await this.databases.listDocuments('default', 'evidence', [
        Query.limit(1)
      ]);

      if (existingEvidence.documents.length > 0) {
        const sampleDoc = existingEvidence.documents[0];

        // Check if new fields exist
        const hasNewFields = 'attemptIndex' in sampleDoc && 'score' in sampleDoc && 'outcomeScores' in sampleDoc;

        if (hasNewFields) {
          console.log('  ✅ Evidence collection already has enhanced structure');
        } else {
          console.log('  ⚠️  Evidence collection needs new fields: attemptIndex, score, outcomeScores, submittedAt');
          console.log('      These will be auto-created when first evidence is recorded with EvidenceDriver');
        }
      } else {
        console.log('  ✅ Evidence collection is empty, new structure will be created on first use');
      }
    } catch (error) {
      this.stats.errors.push(`Failed to check Evidence structure: ${error}`);
    }
  }

  /**
   * Print migration results
   */
  private printResults(): void {
    console.log('');
    console.log('📊 Migration Results');
    console.log('===================');
    console.log(`SOW enrollments migrated: ${this.stats.sowMigrated}`);
    console.log(`MasteryV2 records created: ${this.stats.masteryCreated}`);
    console.log(`Lesson templates validated: ${this.stats.templatesValidated}`);
    console.log(`Errors encountered: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log('');
      console.log('⚠️  Errors:');
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('');
    if (this.stats.errors.length === 0) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with errors. Please review and fix.');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new SeedDataMigrator();
  migrator.migrate().catch(console.error);
}

export { SeedDataMigrator };