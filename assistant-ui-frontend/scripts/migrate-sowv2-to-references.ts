import { config } from 'dotenv';
import { Client, Databases, Query, ID } from 'node-appwrite';

config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

async function migrateSOWV2ToReferences() {
  console.log('🔄 Starting SOWV2 migration to reference-based architecture...\n');

  // Step 1: Get all SOWV2 records
  const allRecords = await databases.listDocuments('default', 'SOWV2', [
    Query.limit(500)
  ]);

  console.log(`📊 Found ${allRecords.total} SOWV2 records\n`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const record of allRecords.documents) {
    try {
      // Skip if already has source_authored_sow_id
      if (record.source_authored_sow_id) {
        console.log(`✅ ${record.studentId}/${record.courseId} already migrated`);
        migratedCount++;
        continue;
      }

      // Find corresponding Authored_SOW by courseId
      const authoredSOWs = await databases.listDocuments('default', 'Authored_SOW', [
        Query.equal('courseId', record.courseId),
        Query.equal('status', 'published'),
        Query.limit(1)
      ]);

      if (authoredSOWs.documents.length === 0) {
        console.error(`❌ No Authored_SOW found for courseId: ${record.courseId}`);
        errorCount++;
        continue;
      }

      const authoredSOW = authoredSOWs.documents[0];

      // Update SOWV2 record with reference
      await databases.updateDocument('default', 'SOWV2', record.$id, {
        source_authored_sow_id: authoredSOW.$id,
        source_version: authoredSOW.version || 'v1.0'
      });

      console.log(`✅ Migrated ${record.studentId}/${record.courseId} → ${authoredSOW.$id}`);
      migratedCount++;

    } catch (error: any) {
      console.error(`❌ Failed to migrate ${record.$id}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Successfully migrated: ${migratedCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`\n🎉 Migration complete!`);
}

migrateSOWV2ToReferences().catch(console.error);
