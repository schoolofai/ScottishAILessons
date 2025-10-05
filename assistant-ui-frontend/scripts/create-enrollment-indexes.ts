/**
 * Create Appwrite Indexes for Enrollment System - Phase 1 MVP2
 *
 * Creates required database indexes to support:
 * - Enrollment uniqueness constraints
 * - Fast enrollment lookups
 * - SOWV2 and MasteryV2 uniqueness
 *
 * Usage:
 *   tsx scripts/create-enrollment-indexes.ts
 *
 * Environment variables required:
 *   - APPWRITE_ENDPOINT
 *   - APPWRITE_PROJECT_ID
 *   - APPWRITE_API_KEY
 */

import { Client, Databases } from 'node-appwrite';

// ============================================================================
// Configuration
// ============================================================================

const ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   APPWRITE_ENDPOINT:', ENDPOINT ? '✅' : '❌');
  console.error('   APPWRITE_PROJECT_ID:', PROJECT_ID ? '✅' : '❌');
  console.error('   APPWRITE_API_KEY:', API_KEY ? '✅' : '❌');
  process.exit(1);
}

// ============================================================================
// Index Definitions
// ============================================================================

interface IndexDefinition {
  collection: string;
  key: string;
  type: 'unique' | 'key';
  attributes: string[];
  orders?: string[];
  description: string;
}

const INDEXES: IndexDefinition[] = [
  {
    collection: 'enrollments',
    key: 'enrollment_student_course_unique',
    type: 'unique',
    attributes: ['studentId', 'courseId'],
    description: 'Prevent duplicate enrollments & enable fast lookups'
  },
  {
    collection: 'SOWV2',
    key: 'unique_student_course',
    type: 'unique',
    attributes: ['studentId', 'courseId'],
    description: 'One SOWV2 per student per course'
  },
  {
    collection: 'MasteryV2',
    key: 'unique_student_course',
    type: 'unique',
    attributes: ['studentId', 'courseId'],
    description: 'One MasteryV2 record per student per course'
  },
  {
    collection: 'sessions',
    key: 'student_course_lesson_idx',
    type: 'key',
    attributes: ['studentId', 'courseId', 'lessonTemplateId'],
    description: 'Fast session lookups for progress calculation'
  },
  {
    collection: 'sessions',
    key: 'student_course_stage_idx',
    type: 'key',
    attributes: ['studentId', 'courseId', 'stage'],
    description: 'Fast completed session queries'
  }
];

// ============================================================================
// Index Creation
// ============================================================================

async function createIndex(databases: Databases, index: IndexDefinition): Promise<boolean> {
  try {
    console.log(`\n📝 Creating index: ${index.collection}.${index.key}`);
    console.log(`   Type: ${index.type}`);
    console.log(`   Attributes: ${index.attributes.join(', ')}`);
    console.log(`   Purpose: ${index.description}`);

    await databases.createIndex(
      'default',
      index.collection,
      index.key,
      index.type,
      index.attributes,
      index.orders
    );

    console.log(`✅ Created index: ${index.key}`);
    return true;
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`ℹ️  Index already exists: ${index.key}`);
      return true;
    } else if (error.code === 404) {
      console.error(`❌ Collection not found: ${index.collection}`);
      console.error(`   Please ensure the collection exists before creating indexes.`);
      return false;
    } else {
      console.error(`❌ Failed to create index ${index.key}:`, error.message);
      return false;
    }
  }
}

async function main() {
  console.log('🚀 Creating Appwrite Indexes for Enrollment System');
  console.log('==================================================');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log('');

  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint(ENDPOINT!)
    .setProject(PROJECT_ID!)
    .setKey(API_KEY!);

  const databases = new Databases(client);

  // Create all indexes
  const results = await Promise.all(
    INDEXES.map(index => createIndex(databases, index))
  );

  // Summary
  console.log('\n==================================================');
  console.log('📊 Index Creation Summary');
  console.log('==================================================');

  const successful = results.filter(r => r).length;
  const failed = results.filter(r => !r).length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${INDEXES.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Some indexes failed to create. Please check the errors above.');
    process.exit(1);
  }

  console.log('\n🎉 All indexes created successfully!');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
