import { config } from 'dotenv';
import { Client, Databases, Query } from 'node-appwrite';

config({ path: '.env.local' });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

// Check for TypeScript gzip prefix (gzip:)
function isCompressed(data: string): boolean {
  if (!data) return false;
  return data.startsWith('gzip:');  // TypeScript format with prefix
}

async function verifyCompression() {
  console.log('🔍 Verifying Authored_SOW Compression Status');
  console.log('='.repeat(60));
  
  try {
    const result = await databases.listDocuments('default', 'Authored_SOW', [
      Query.limit(100)
    ]);
    
    const docs = result.documents;
    console.log(`📊 Total documents: ${docs.length}\n`);
    
    let compressedCount = 0;
    let uncompressedCount = 0;
    
    for (const doc of docs) {
      const courseId = doc.courseId;
      const docId = doc.$id;
      const entriesField = doc.entries;
      const originalSize = entriesField.length;
      
      const isCompressedStatus = isCompressed(entriesField);
      
      if (isCompressedStatus) {
        console.log(`✅ ${courseId} (${docId})`);
        console.log(`   Status: COMPRESSED (${originalSize} chars)\n`);
        compressedCount++;
      } else {
        console.log(`❌ ${courseId} (${docId})`);
        console.log(`   Status: UNCOMPRESSED (${originalSize} chars)\n`);
        uncompressedCount++;
      }
    }
    
    console.log('='.repeat(60));
    console.log('📊 Verification Summary');
    console.log('='.repeat(60));
    console.log(`Total documents:    ${docs.length}`);
    console.log(`Compressed:         ${compressedCount}`);
    console.log(`Uncompressed:       ${uncompressedCount}`);
    console.log('='.repeat(60));
    
    if (uncompressedCount === 0) {
      console.log('\n🎉 SUCCESS: All documents are now compressed!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  WARNING: ${uncompressedCount} document(s) still uncompressed`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyCompression();
