/**
 * Comprehensive schema inspection for lesson completion feature
 *
 * Collections involved:
 * 1. sessions - stores lesson session metadata
 * 2. evidence - stores student responses to questions
 * 3. MasteryV2 - stores EMA scores per outcome
 * 4. routine - stores spaced repetition schedules
 */

import { Client, Databases } from 'node-appwrite';

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

interface AttributeInfo {
  key: string;
  type: string;
  required: boolean;
  array: boolean;
  default?: any;
  size?: number;
  min?: number;
  max?: number;
}

function formatAttribute(attr: AttributeInfo): string {
  const parts = [];

  // Name and type
  parts.push(`${attr.key}: ${attr.type}`);

  // Array indicator
  if (attr.array) {
    parts.push('[]');
  }

  // Size for strings
  if (attr.size) {
    parts.push(`(size: ${attr.size})`);
  }

  // Min/max for numbers
  if (attr.min !== undefined || attr.max !== undefined) {
    const range = [];
    if (attr.min !== undefined) range.push(`min: ${attr.min}`);
    if (attr.max !== undefined) range.push(`max: ${attr.max}`);
    parts.push(`(${range.join(', ')})`);
  }

  // Required/optional
  parts.push(attr.required ? '[REQUIRED]' : '[optional]');

  // Default value
  if (attr.default !== undefined && attr.default !== null) {
    const defaultStr = typeof attr.default === 'string'
      ? `"${attr.default}"`
      : JSON.stringify(attr.default);
    parts.push(`default: ${defaultStr}`);
  }

  return parts.join(' ');
}

async function inspectCollection(databases: Databases, collectionId: string, collectionName: string) {
  try {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 ${collectionName.toUpperCase()} COLLECTION`);
    console.log(`${'═'.repeat(80)}`);

    const collection = await databases.getCollection('default', collectionId);

    console.log(`\nCollection ID: ${collection.$id}`);
    console.log(`Name: ${collection.name}`);
    console.log(`Document Security: ${collection.documentSecurity}`);
    console.log(`Created: ${collection.$createdAt}`);
    console.log(`Total Attributes: ${collection.attributes.length}`);

    // Separate required and optional attributes
    const requiredAttrs = collection.attributes.filter((a: any) => a.required);
    const optionalAttrs = collection.attributes.filter((a: any) => !a.required);

    if (requiredAttrs.length > 0) {
      console.log(`\n🔴 REQUIRED ATTRIBUTES (${requiredAttrs.length}):`);
      requiredAttrs.forEach((attr: any) => {
        console.log(`  ${formatAttribute(attr)}`);
      });
    }

    if (optionalAttrs.length > 0) {
      console.log(`\n🟡 OPTIONAL ATTRIBUTES (${optionalAttrs.length}):`);
      optionalAttrs.forEach((attr: any) => {
        console.log(`  ${formatAttribute(attr)}`);
      });
    }

    // Show indexes if any
    if (collection.indexes && collection.indexes.length > 0) {
      console.log(`\n📊 INDEXES (${collection.indexes.length}):`);
      collection.indexes.forEach((index: any) => {
        console.log(`  ${index.key}: [${index.attributes.join(', ')}] (${index.type})`);
      });
    }

    return { success: true, collection };
  } catch (error: any) {
    console.error(`\n❌ Error inspecting ${collectionName}:`);
    console.error(`  ${error.message}`);
    return { success: false, error };
  }
}

async function inspectAllSchemas() {
  console.log('🔍 LESSON COMPLETION FEATURE - SCHEMA INSPECTION');
  console.log('═'.repeat(80));
  console.log(`Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`Project ID: ${APPWRITE_PROJECT_ID}`);
  console.log(`Database: default\n`);

  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error('❌ Missing environment variables');
    console.error('  NEXT_PUBLIC_APPWRITE_PROJECT_ID:', !!APPWRITE_PROJECT_ID);
    console.error('  APPWRITE_API_KEY:', !!APPWRITE_API_KEY);
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  // Inspect all collections in order of data flow
  const collections = [
    { id: 'sessions', name: 'Sessions' },
    { id: 'evidence', name: 'Evidence' },
    { id: 'MasteryV2', name: 'MasteryV2' },
    { id: 'routine', name: 'Routine (Spaced Repetition)' }
  ];

  const results = [];

  for (const { id, name } of collections) {
    const result = await inspectCollection(databases, id, name);
    results.push({ id, name, ...result });
  }

  // Summary
  console.log(`\n${'═'.repeat(80)}`);
  console.log('📊 INSPECTION SUMMARY');
  console.log(`${'═'.repeat(80)}`);

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.id})`);
  });

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} collection(s) failed inspection`);
  } else {
    console.log(`\n✅ All collections inspected successfully`);
  }

  console.log('\n');
}

inspectAllSchemas().catch(console.error);
