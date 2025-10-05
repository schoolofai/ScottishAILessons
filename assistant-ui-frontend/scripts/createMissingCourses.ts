#!/usr/bin/env tsx

/**
 * Create Missing Courses - One-time fix for orphaned course data
 *
 * This script creates course documents for courseIds that exist in child collections
 * (Authored_SOW, lesson_templates, course_outcomes) but are missing from the courses collection.
 *
 * Background:
 * The SOW authoring agent generated courseIds like "course_c84474" and the seeding script
 * created child documents without creating the parent course document. Appwrite's NoSQL
 * database doesn't enforce referential integrity, so the orphaned data was created successfully.
 *
 * This is a one-time fix. Future seeding runs will use the updated seedAuthoredSOW.ts
 * which includes ensureCourseExists() to prevent this issue.
 *
 * Usage:
 *   npm run create:missing-courses
 */

import { Client as AppwriteClient, Databases, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Configuration
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;

const DATABASE_ID = 'default';
const COURSES_COLLECTION = 'courses';

interface CourseData {
  courseId: string;
  subject: string;
  level: string;
}

// Missing courses extracted from Authored_SOW metadata
const MISSING_COURSES: CourseData[] = [
  {
    courseId: 'course_c84473',
    subject: 'application-of-mathematics',
    level: 'national-3'
  },
  {
    courseId: 'course_c84474',
    subject: 'application-of-mathematics',
    level: 'national-4'
  },
  {
    courseId: 'course_c84774',
    subject: 'mathematics',
    level: 'national-4'
  }
];

async function main() {
  console.log('🔧 Creating Missing Course Documents');
  console.log('=====================================');
  console.log('');

  // Initialize Appwrite client
  const appwrite = new AppwriteClient()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(appwrite);

  let created = 0;
  let skipped = 0;

  for (const course of MISSING_COURSES) {
    console.log(`📋 Processing: ${course.courseId}`);
    console.log(`   Subject: ${course.subject}`);
    console.log(`   Level: ${course.level}`);

    try {
      // Check if course already exists
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COURSES_COLLECTION,
        [Query.equal('courseId', course.courseId)]
      );

      if (existing.documents.length > 0) {
        console.log(`⏭️  Course already exists (skipping)`);
        console.log('');
        skipped++;
        continue;
      }

      // Create course with simplified schema v2
      await databases.createDocument(
        DATABASE_ID,
        COURSES_COLLECTION,
        'unique()',
        {
          courseId: course.courseId,
          subject: course.subject,
          level: course.level,
          schema_version: 2
        }
      );

      console.log(`✅ Created course successfully`);
      console.log('');
      created++;

    } catch (error: any) {
      console.error(`❌ Error creating course ${course.courseId}:`);
      console.error(`   ${error.message}`);
      console.log('');
      throw error; // Fast fail - do not continue if creation fails
    }
  }

  console.log('=====================================');
  console.log('📊 Summary');
  console.log('=====================================');
  console.log(`✅ Created: ${created} course(s)`);
  console.log(`⏭️  Skipped: ${skipped} course(s) (already existed)`);
  console.log(`📝 Total: ${MISSING_COURSES.length} course(s) processed`);
  console.log('');

  if (created > 0) {
    console.log('🎉 SUCCESS! Missing courses have been created.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify courses in Appwrite console');
    console.log('2. Run seedAuthoredSOW.ts with updated auto-creation logic');
    console.log('3. Future seeding will automatically create courses from SOW filenames');
  } else {
    console.log('ℹ️  No courses were created (all already existed).');
  }
}

// Run the script
main().catch((error) => {
  console.error('');
  console.error('=====================================');
  console.error('❌ FATAL ERROR');
  console.error('=====================================');
  console.error(error);
  process.exit(1);
});
