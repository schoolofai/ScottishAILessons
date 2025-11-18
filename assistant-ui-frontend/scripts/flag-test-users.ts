/**
 * Test User Auto-Flagging Script (Phase 4)
 *
 * Purpose: Mark specific user accounts as test users to prevent real Stripe charges
 * Contract: specs/004-stripe-subscription-paywall/contracts/05-test-user-flagging.md
 *
 * Following constitution principles:
 * - Fast fail: Throw exceptions if Appwrite connection fails
 * - No fallback mechanisms: Clear error messages for missing environment variables
 * - No caching: Fresh queries for each user
 *
 * Usage:
 *   npm run flag-test-users
 *   or
 *   npx ts-node scripts/flag-test-users.ts
 */

import { Client, Databases, Query } from 'node-appwrite';

// Test user email addresses to flag
const TEST_USER_EMAILS = [
  'test@scottishailessons.com',
  'test2@scottishailessons.com',
  'demo@scottishailessons.com',
  'admin@scottishailessons.com',
];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function main() {
  log('═══════════════════════════════════════════════════', colors.bright);
  log('    Test User Auto-Flagging Script (Phase 4)       ', colors.bright);
  log('═══════════════════════════════════════════════════', colors.bright);
  console.log('');

  // Step 1: Validate environment variables
  log('Step 1: Validating environment variables...', colors.blue);

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint) {
    throw new Error('NEXT_PUBLIC_APPWRITE_ENDPOINT is not configured');
  }
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_APPWRITE_PROJECT_ID is not configured');
  }
  if (!databaseId) {
    throw new Error('NEXT_PUBLIC_APPWRITE_DATABASE_ID is not configured');
  }
  if (!apiKey) {
    throw new Error(
      'APPWRITE_API_KEY is not configured. ' +
      'Create an API key in Appwrite Console with databases.write scope.'
    );
  }

  log('✅ Environment variables validated', colors.green);
  log(`   Endpoint: ${endpoint}`, colors.reset);
  log(`   Project ID: ${projectId}`, colors.reset);
  log(`   Database ID: ${databaseId}`, colors.reset);
  console.log('');

  // Step 2: Initialize Appwrite client
  log('Step 2: Initializing Appwrite client...', colors.blue);

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);

  log('✅ Appwrite client initialized', colors.green);
  console.log('');

  // Step 3: Flag test users
  log('Step 3: Flagging test users...', colors.blue);
  log(`   Test users to flag: ${TEST_USER_EMAILS.length}`, colors.reset);
  console.log('');

  let flaggedCount = 0;
  let notFoundCount = 0;
  let alreadyFlaggedCount = 0;
  let errorCount = 0;

  for (const email of TEST_USER_EMAILS) {
    try {
      log(`   Processing: ${email}`, colors.reset);

      // Query students collection by email
      const students = await databases.listDocuments(
        databaseId,
        'students',
        [Query.equal('email', email)]
      );

      if (students.documents.length === 0) {
        log(`   ⚠️  Not found: ${email}`, colors.yellow);
        notFoundCount++;
        continue;
      }

      const studentDoc = students.documents[0];

      // Check if already flagged
      const currentMetadata = studentDoc.metadata || {};
      if (currentMetadata.isTestUser === true) {
        log(`   ℹ️  Already flagged: ${email}`, colors.blue);
        alreadyFlaggedCount++;
        continue;
      }

      // Update metadata to flag as test user
      await databases.updateDocument(
        databaseId,
        'students',
        studentDoc.$id,
        {
          metadata: {
            ...currentMetadata,
            isTestUser: true,
            flaggedAt: new Date().toISOString(),
            flaggedBy: 'auto-flagging-script'
          }
        }
      );

      log(`   ✅ Flagged: ${email} (ID: ${studentDoc.$id})`, colors.green);
      flaggedCount++;

    } catch (error: any) {
      log(`   ❌ Error flagging ${email}: ${error.message}`, colors.red);
      errorCount++;
    }
  }

  console.log('');
  log('═══════════════════════════════════════════════════', colors.bright);
  log('                   Summary                          ', colors.bright);
  log('═══════════════════════════════════════════════════', colors.bright);
  console.log('');
  log(`   Total test users: ${TEST_USER_EMAILS.length}`, colors.reset);
  log(`   ✅ Flagged: ${flaggedCount}`, colors.green);
  log(`   ℹ️  Already flagged: ${alreadyFlaggedCount}`, colors.blue);
  log(`   ⚠️  Not found: ${notFoundCount}`, colors.yellow);
  log(`   ❌ Errors: ${errorCount}`, colors.red);
  console.log('');

  if (errorCount > 0) {
    log('⚠️  Some errors occurred. Check logs above.', colors.yellow);
    process.exit(1);
  }

  if (flaggedCount === 0 && notFoundCount > 0) {
    log('⚠️  No users were flagged. Create test users first.', colors.yellow);
    process.exit(1);
  }

  log('✅ Test user flagging completed successfully!', colors.green);
  console.log('');
  log('Next steps:', colors.bright);
  log('  1. Test users are now protected from Stripe charges', colors.reset);
  log('  2. Checkout API will skip these users automatically', colors.reset);
  log('  3. Run E2E tests to verify subscription flow', colors.reset);
  console.log('');
}

// Run the script
main().catch((error) => {
  console.error('');
  log('═══════════════════════════════════════════════════', colors.bright);
  log('                   Fatal Error                      ', colors.red);
  log('═══════════════════════════════════════════════════', colors.bright);
  console.error('');
  log(`Error: ${error.message}`, colors.red);
  console.error('');
  log('Stack trace:', colors.reset);
  console.error(error.stack);
  console.error('');
  process.exit(1);
});
