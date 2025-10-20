import { config } from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';
import { decompressJSON, compressJSON } from '../lib/appwrite/utils/compression';

config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

async function fixLastDocument() {
  console.log('🔧 Converting last document from Python to TypeScript compression format');
  console.log('='.repeat(60));

  try {
    // Find the document with course_c74774
    const result = await databases.listDocuments('default', 'Authored_SOW', [
      Query.equal('courseId', 'course_c74774'),
      Query.limit(1)
    ]);

    if (result.documents.length === 0) {
      console.log('❌ Document not found');
      process.exit(1);
    }

    const doc = result.documents[0];
    const courseId = doc.courseId;
    const docId = doc.$id;
    const entriesField = doc.entries;
    const originalSize = entriesField.length;

    console.log(`\n📝 ${courseId} (${docId})`);
    console.log(`   Original format: ${originalSize} chars`);

    // Decompress using flexible decompressJSON (handles Python format)
    console.log('   Decompressing from Python format...');
    const decompressed = decompressJSON(entriesField);

    if (!decompressed) {
      throw new Error('Failed to decompress data');
    }

    // Re-compress using TypeScript format (with gzip: prefix)
    console.log('   Re-compressing to TypeScript format...');
    const recompressed = compressJSON(decompressed);
    const newSize = recompressed.length;
    const savings = originalSize - newSize;

    console.log(`   New format:      ${newSize} chars`);
    console.log(`   Savings:         ${savings} chars (${((savings/originalSize)*100).toFixed(1)}%)`);

    // Update in database
    console.log('   Updating database...');
    await databases.updateDocument('default', 'Authored_SOW', docId, {
      entries: recompressed
    });

    console.log(`   ✅ Updated in database`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Document conversion complete!');
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Conversion failed:', error.message);
    process.exit(1);
  }
}

fixLastDocument();
