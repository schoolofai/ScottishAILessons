import { config } from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';
import { compressJSON, isCompressed } from '../lib/appwrite/utils/compression';

config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

// Dry run flag from command line
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Migrate Authored_SOW documents by compressing uncompressed entries fields.
 *
 * This script:
 * 1. Fetches all Authored_SOW documents
 * 2. Skips already-compressed documents
 * 3. Compresses uncompressed entries using gzip+base64
 * 4. Updates documents in database
 *
 * Run with --dry-run flag to preview changes without applying them.
 */
async function migrateCompressAuthoredSOWs() {
  console.log('🗜️  Authored_SOW Entries Compression Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '⚡ LIVE (will update)'}\n`);

  // Fetch all documents
  const result = await databases.listDocuments('default', 'Authored_SOW', [
    Query.limit(100)
  ]);

  const docs = result.documents;
  console.log(`📊 Total documents: ${docs.length}\n`);

  let compressed = 0;
  let alreadyCompressed = 0;
  let errors = 0;
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  const results: Array<{ courseId: string; id: string; status: 'compressed' | 'skipped' | 'error' }> = [];

  // Process each document
  for (const doc of docs) {
    const id = doc.$id;
    const courseId = doc.courseId;
    const entriesField = doc.entries;
    const originalSize = entriesField.length;

    try {
      // Check if already compressed
      if (isCompressed(entriesField)) {
        console.log(`✅ ${courseId} (${id})`);
        console.log(`   Already compressed: ${originalSize.toLocaleString()} chars\n`);
        alreadyCompressed++;
        results.push({ courseId, id, status: 'skipped' });
        continue;
      }

      // Parse uncompressed JSON
      let entriesArray;
      try {
        entriesArray = JSON.parse(entriesField);
      } catch (parseError) {
        console.error(`❌ ${courseId} (${id}) - JSON parse failed`);
        console.error(`   Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}\n`);
        errors++;
        results.push({ courseId, id, status: 'error' });
        continue;
      }

      // Compress
      const compressedEntries = compressJSON(entriesArray);
      const compressedSize = compressedEntries.length;
      const saved = originalSize - compressedSize;
      const savingsPercent = ((saved / originalSize) * 100).toFixed(1);

      totalOriginalSize += originalSize;
      totalCompressedSize += compressedSize;

      console.log(`🗜️  ${courseId} (${id})`);
      console.log(`   Original:   ${originalSize.toLocaleString()} chars`);
      console.log(`   Compressed: ${compressedSize.toLocaleString()} chars`);
      console.log(`   Savings:    ${saved.toLocaleString()} chars (-${savingsPercent}%)`);

      if (!DRY_RUN) {
        // Update in database
        await databases.updateDocument('default', 'Authored_SOW', id, {
          entries: compressedEntries
        });
        console.log(`   ✅ Updated in database\n`);
      } else {
        console.log(`   🔍 Would update (dry run)\n`);
      }

      compressed++;
      results.push({ courseId, id, status: 'compressed' });

    } catch (error: any) {
      console.error(`❌ ${courseId} (${id}) - Error: ${error.message}\n`);
      errors++;
      results.push({ courseId, id, status: 'error' });
    }
  }

  // Summary
  const totalSaved = totalOriginalSize - totalCompressedSize;
  const avgSavings = compressed > 0
    ? ((totalSaved / totalOriginalSize) * 100).toFixed(1)
    : '0';

  console.log('='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`Total documents:        ${docs.length}`);
  console.log(`Already compressed:     ${alreadyCompressed}`);
  console.log(`Newly compressed:       ${compressed}`);
  console.log(`Errors:                 ${errors}`);
  console.log(`Total original size:    ${totalOriginalSize.toLocaleString()} chars`);
  console.log(`Total compressed size:  ${totalCompressedSize.toLocaleString()} chars`);
  console.log(`Total space saved:      ${totalSaved.toLocaleString()} chars (~${(totalSaved/1024).toFixed(1)} KB)`);
  if (compressed > 0) {
    console.log(`Average compression:    ${avgSavings}%`);
  }
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No changes were made');
    console.log('To perform migration, run:');
    console.log('  npm run migrate:compress-sow-entries\n');
  } else {
    if (errors === 0 && compressed > 0) {
      console.log('\n🎉 Migration complete successfully!\n');
    } else if (errors > 0) {
      console.log('\n⚠️  Migration complete with errors. Review the errors above.\n');
    }
  }
}

// Run migration
migrateCompressAuthoredSOWs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
