/**
 * Script to check for routine records in the database
 *
 * Usage: tsx scripts/check-routine-records.ts
 */

import { Client, Databases, Query } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://appwrite.scottishailessons.com/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

const studentId = '68d28c190016b1458092';
const courseId = 'course_c84473';

async function checkRoutineRecords() {
  console.log('🔍 Checking for routine records...\n');
  console.log('Configuration:');
  console.log(`  Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`  Project ID: ${APPWRITE_PROJECT_ID}`);
  console.log(`  Student ID: ${studentId}`);
  console.log(`  Course ID: ${courseId}\n`);

  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing environment variables:');
    console.error('  NEXT_PUBLIC_APPWRITE_PROJECT_ID:', !!APPWRITE_PROJECT_ID);
    console.error('  APPWRITE_API_KEY:', !!APPWRITE_API_KEY);
    console.error('\nMake sure .env.local has these values.');
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    // Check routineV2 collection
    console.log('📊 Querying routineV2 collection...');
    const routineResult = await databases.listDocuments(
      'default',
      'routineV2',
      [
        Query.equal('studentId', studentId),
        Query.equal('courseId', courseId)
      ]
    );

    console.log(`\n✅ Found ${routineResult.documents.length} routine records\n`);

    if (routineResult.documents.length > 0) {
      for (const doc of routineResult.documents) {
        console.log('─────────────────────────────────────────');
        console.log(`Routine ID: ${doc.$id}`);
        console.log(`Student ID: ${doc.studentId}`);
        console.log(`Course ID: ${doc.courseId}`);

        // Parse dueAtByOutcome if it's a string
        let dueAtByOutcome = doc.dueAtByOutcome;
        if (typeof dueAtByOutcome === 'string') {
          try {
            dueAtByOutcome = JSON.parse(dueAtByOutcome);
          } catch (e) {
            console.log(`Raw dueAtByOutcome: ${doc.dueAtByOutcome}`);
          }
        }

        if (dueAtByOutcome && typeof dueAtByOutcome === 'object') {
          console.log(`\nScheduled outcomes (${Object.keys(dueAtByOutcome).length}):`);
          const now = new Date();

          for (const [outcomeId, dueDate] of Object.entries(dueAtByOutcome)) {
            const due = new Date(dueDate as string);
            const isOverdue = due <= now;
            const status = isOverdue ? '⚠️  OVERDUE' : '✓ Scheduled';
            console.log(`  ${status} - ${outcomeId}: ${due.toISOString()}`);
          }
        } else {
          console.log('No scheduled outcomes');
        }

        console.log(`Created: ${doc.$createdAt}`);
        console.log(`Updated: ${doc.$updatedAt}`);
      }
      console.log('─────────────────────────────────────────\n');
    } else {
      console.log('⚠️  No routine records found for this student/course combination');
      console.log('\nThis explains why the Review tab is empty!');
      console.log('\nPossible reasons:');
      console.log('  1. Previous lesson completions failed to create routine records');
      console.log('  2. Routine creation logic was broken during auth migration');
      console.log('  3. Database collection permissions prevent creation');
    }

    // Also check for ANY routine records for this student (across all courses)
    console.log('\n📊 Checking all routine records for this student...');
    const allRoutinesResult = await databases.listDocuments(
      'default',
      'routineV2',
      [Query.equal('studentId', studentId)]
    );

    console.log(`Found ${allRoutinesResult.documents.length} total routine records for student\n`);

    if (allRoutinesResult.documents.length > 0) {
      console.log('Courses with routine records:');
      const courseIds = new Set(allRoutinesResult.documents.map(doc => doc.courseId));
      courseIds.forEach(id => console.log(`  - ${id}`));
    }

  } catch (error: any) {
    console.error('\n❌ Error querying database:');
    console.error(`  Type: ${error.type || error.name}`);
    console.error(`  Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);

    if (error.code === 401) {
      console.error('\n💡 API key is invalid or missing required permissions.');
      console.error('   Check APPWRITE_API_KEY in .env.local');
    } else if (error.code === 404) {
      console.error('\n💡 Collection "routineV2" might not exist.');
      console.error('   Check Appwrite console to verify collection name.');
    }

    process.exit(1);
  }
}

checkRoutineRecords();
