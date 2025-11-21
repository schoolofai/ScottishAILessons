/**
 * Script to list all collections in the Appwrite database
 *
 * Usage: tsx scripts/list-collections.ts
 */

import { Client, Databases } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://appwrite.scottishailessons.com/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

async function listCollections() {
  console.log('📋 Listing all collections in the database...\n');

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
    const collections = await databases.listCollections('default');

    console.log(`✅ Found ${collections.total} collections:\n`);

    for (const collection of collections.collections) {
      console.log(`📁 ${collection.name} (${collection.$id})`);
      console.log(`   Document Security: ${collection.documentSecurity}`);
      console.log(`   Created: ${collection.$createdAt}`);
      console.log(`   Attributes: ${collection.attributes.length}`);

      // Show first few attributes
      if (collection.attributes.length > 0) {
        console.log('   Key attributes:');
        collection.attributes.slice(0, 5).forEach((attr: any) => {
          console.log(`     - ${attr.key} (${attr.type})`);
        });
        if (collection.attributes.length > 5) {
          console.log(`     ... and ${collection.attributes.length - 5} more`);
        }
      }
      console.log('');
    }

    // Look for routine-related collections
    console.log('\n🔍 Searching for routine-related collections:');
    const routineCollections = collections.collections.filter((c: any) =>
      c.name.toLowerCase().includes('routine') || c.$id.toLowerCase().includes('routine')
    );

    if (routineCollections.length > 0) {
      console.log(`Found ${routineCollections.length} routine-related collection(s):`);
      routineCollections.forEach((c: any) => {
        console.log(`  - ${c.name} (ID: ${c.$id})`);
      });
    } else {
      console.log('⚠️  No routine-related collections found!');
      console.log('\nThis explains why routine records cannot be created.');
      console.log('The routineV2 collection needs to be created in Appwrite.');
    }

    // Look for mastery collections
    console.log('\n🔍 Searching for mastery-related collections:');
    const masteryCollections = collections.collections.filter((c: any) =>
      c.name.toLowerCase().includes('mastery') || c.$id.toLowerCase().includes('mastery')
    );

    if (masteryCollections.length > 0) {
      console.log(`Found ${masteryCollections.length} mastery-related collection(s):`);
      masteryCollections.forEach((c: any) => {
        console.log(`  - ${c.name} (ID: ${c.$id})`);
      });
    }

  } catch (error: any) {
    console.error('\n❌ Error listing collections:');
    console.error(`  Message: ${error.message}`);
    process.exit(1);
  }
}

listCollections();
