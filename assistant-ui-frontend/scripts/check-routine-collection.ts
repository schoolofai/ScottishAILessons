/**
 * Script to check the existing routine collection schema and data
 *
 * Usage: tsx scripts/check-routine-collection.ts
 */

import { Client, Databases, Query } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://appwrite.scottishailessons.com/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

const studentId = '68d28c190016b1458092';
const courseId = 'course_c84473';

async function checkRoutineCollection() {
  console.log('🔍 Checking existing routine collection...\n');

  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    // Get collection details
    console.log('📋 Collection Schema for "routine":');
    const collection = await databases.getCollection('default', 'routine');

    console.log(`  Name: ${collection.name}`);
    console.log(`  ID: ${collection.$id}`);
    console.log(`  Document Security: ${collection.documentSecurity}`);
    console.log(`  Created: ${collection.$createdAt}`);
    console.log(`\n  Attributes (${collection.attributes.length}):`);

    collection.attributes.forEach((attr: any) => {
      const required = attr.required ? 'required' : 'optional';
      const array = attr.array ? '[]' : '';
      console.log(`    - ${attr.key}: ${attr.type}${array} (${required})`);
      if (attr.default !== undefined && attr.default !== null) {
        console.log(`      default: ${attr.default}`);
      }
    });

    // Query for this student's routine data
    console.log(`\n\n📊 Querying routine collection for student ${studentId}...`);
    const routineResult = await databases.listDocuments(
      'default',
      'routine',
      [Query.equal('studentId', studentId)]
    );

    console.log(`\n✅ Found ${routineResult.documents.length} routine records for this student\n`);

    if (routineResult.documents.length > 0) {
      for (const doc of routineResult.documents) {
        console.log('─────────────────────────────────────────');
        console.log(`Routine ID: ${doc.$id}`);
        console.log(`Student ID: ${doc.studentId}`);
        console.log(`Course ID: ${doc.courseId}`);
        console.log(`Last Session Date: ${doc.lastSessionDate || 'N/A'}`);
        console.log(`Days Since Last Session: ${doc.daysSinceLastSession || 'N/A'}`);
        console.log(`Last Taught At: ${doc.lastTaughtAt || 'N/A'}`);
        console.log(`Created: ${doc.$createdAt}`);
        console.log(`Updated: ${doc.$updatedAt}`);

        // Show all fields
        console.log('\nAll fields:');
        Object.entries(doc).forEach(([key, value]) => {
          if (!key.startsWith('$')) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        });
      }
      console.log('─────────────────────────────────────────\n');
    }

    // Check what the completion API expects
    console.log('\n🔍 Comparison with API expectations:');
    console.log('\nAPI code expects routineV2 with:');
    console.log('  - studentId (string)');
    console.log('  - courseId (string)');
    console.log('  - dueAtByOutcome (JSON string): { outcomeId: ISO date, ... }');
    console.log('\nExisting routine collection has:');
    collection.attributes.forEach((attr: any) => {
      console.log(`  - ${attr.key} (${attr.type})`);
    });

    console.log('\n📝 Conclusion:');
    if (collection.attributes.some((a: any) => a.key === 'dueAtByOutcome')) {
      console.log('✅ The existing routine collection has dueAtByOutcome field');
      console.log('   The API should use collection ID "routine" instead of "routineV2"');
    } else {
      console.log('❌ The existing routine collection has a DIFFERENT schema');
      console.log('   Options:');
      console.log('   1. Create a new routineV2 collection with the expected schema');
      console.log('   2. Update the existing routine collection to add dueAtByOutcome field');
      console.log('   3. Change the API to use a different approach');
    }

  } catch (error: any) {
    console.error('\n❌ Error:');
    console.error(`  Message: ${error.message}`);
    process.exit(1);
  }
}

checkRoutineCollection();
