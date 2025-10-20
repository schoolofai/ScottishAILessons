import { Query } from 'node-appwrite';
import { ServerBaseDriver } from './__tests__/support/ServerBaseDriver';
import { isCompressed } from './lib/appwrite/utils/compression';

async function verifyCompression() {
  console.log('🔍 Verifying Authored_SOW Compression Status');
  console.log('='.repeat(60));
  
  const driver = new ServerBaseDriver();
  
  try {
    const docs = await driver.list('Authored_SOW', [Query.limit(100)]);
    
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
      console.log('\n🎉 All documents are now compressed!');
    } else {
      console.log(`\n⚠️  ${uncompressedCount} document(s) still uncompressed`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyCompression().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
