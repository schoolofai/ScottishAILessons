/**
 * Script to check evidence collection schema
 */

import { Client, Databases } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://appwrite.scottishailessons.com/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

async function checkEvidenceSchema() {
  console.log('🔍 Checking evidence collection schema...\n');

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
    const collection = await databases.getCollection('default', 'evidence');

    console.log(`📋 Evidence Collection Schema:`);
    console.log(`  Name: ${collection.name}`);
    console.log(`  ID: ${collection.$id}`);
    console.log(`  Document Security: ${collection.documentSecurity}`);
    console.log(`\n  Required Attributes:`);

    const requiredAttrs = collection.attributes.filter((a: any) => a.required);
    requiredAttrs.forEach((attr: any) => {
      const array = attr.array ? '[]' : '';
      console.log(`    - ${attr.key}: ${attr.type}${array} (REQUIRED)`);
    });

    console.log(`\n  Optional Attributes:`);
    const optionalAttrs = collection.attributes.filter((a: any) => !a.required);
    optionalAttrs.forEach((attr: any) => {
      const array = attr.array ? '[]' : '';
      const defaultValue = attr.default !== undefined && attr.default !== null ? ` (default: ${attr.default})` : '';
      console.log(`    - ${attr.key}: ${attr.type}${array}${defaultValue}`);
    });

    console.log(`\n  Total Attributes: ${collection.attributes.length}`);

  } catch (error: any) {
    console.error('\n❌ Error:');
    console.error(`  Message: ${error.message}`);
    process.exit(1);
  }
}

checkEvidenceSchema();
