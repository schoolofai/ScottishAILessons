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

import { Client, Databases, Users, Query } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Test user email addresses to flag (explicit list)
const TEST_USER_EMAILS = [
  'test@scottishailessons.com',
  'test2@scottishailessons.com',
  'demo@scottishailessons.com',
  'admin@scottishailessons.com',
];

// Test user domains - any email ending with these domains is auto-flagged (T051)
const TEST_USER_DOMAINS = [
  '@testuser.com',  // Primary test domain per US3 spec
];

// Validate email domain (T051) - reject domains other than approved list
function isTestUserEmail(email: string): boolean {
  // Check explicit list first
  if (TEST_USER_EMAILS.includes(email.toLowerCase())) {
    return true;
  }

  // Check domain patterns
  const emailLower = email.toLowerCase();
  return TEST_USER_DOMAINS.some(domain => emailLower.endsWith(domain));
}

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
  const users = new Users(client);

  log('✅ Appwrite client initialized', colors.green);
  console.log('');

  // Step 3: Flag test users from explicit list
  log('Step 3: Flagging test users from explicit list...', colors.blue);
  log(`   Explicit test users: ${TEST_USER_EMAILS.length}`, colors.reset);
  console.log('');

  let flaggedCount = 0;
  let notFoundCount = 0;
  let alreadyFlaggedCount = 0;
  let errorCount = 0;

  // Process explicit email list
  for (const email of TEST_USER_EMAILS) {
    try {
      log(`   Processing: ${email}`, colors.reset);

      // Step A: Find auth user by email using Users API
      const authUsers = await users.list([
        Query.equal('email', email)
      ]);

      if (authUsers.users.length === 0) {
        log(`   ⚠️  Not found in auth: ${email}`, colors.yellow);
        notFoundCount++;
        continue;
      }

      const authUser = authUsers.users[0];
      const authUserId = authUser.$id;

      // Step B: Find student document by userId
      const students = await databases.listDocuments(
        databaseId,
        'students',
        [Query.equal('userId', authUserId)]
      );

      if (students.documents.length === 0) {
        log(`   ⚠️  No student record for: ${email} (userId: ${authUserId})`, colors.yellow);
        notFoundCount++;
        continue;
      }

      const studentDoc = students.documents[0];

      // Check if already flagged (testUserFlag at root level)
      if (studentDoc.testUserFlag === true) {
        log(`   ℹ️  Already flagged: ${email}`, colors.blue);
        alreadyFlaggedCount++;
        continue;
      }

      // Update testUserFlag at root level (matches access control logic)
      // Access control: hasAccess = testUserFlag === true || subscriptionStatus === 'active'
      await databases.updateDocument(
        databaseId,
        'students',
        studentDoc.$id,
        {
          testUserFlag: true
        }
      );

      // Log for audit trail (T052)
      log(`   📝 Audit: Flagged ${email} at ${new Date().toISOString()}`, colors.reset);

      log(`   ✅ Flagged: ${email} (ID: ${studentDoc.$id})`, colors.green);
      flaggedCount++;

    } catch (error: any) {
      log(`   ❌ Error flagging ${email}: ${error.message}`, colors.red);
      errorCount++;
    }
  }

  // Step 4: Flag test users by domain pattern (@testuser.com)
  console.log('');
  log('Step 4: Flagging test users by domain pattern...', colors.blue);
  log(`   Test domains: ${TEST_USER_DOMAINS.join(', ')}`, colors.reset);
  console.log('');

  try {
    // Query all auth users and filter by domain
    // Note: Appwrite doesn't support LIKE queries, so we fetch all and filter
    const allAuthUsers = await users.list([
      Query.limit(1000)  // Adjust limit as needed
    ]);

    const domainAuthUsers = allAuthUsers.users.filter(user => {
      const email = user.email?.toLowerCase() || '';
      return TEST_USER_DOMAINS.some(domain => email.endsWith(domain));
    });

    log(`   Found ${domainAuthUsers.length} auth users with test domains`, colors.reset);

    for (const authUser of domainAuthUsers) {
      const email = authUser.email;
      const authUserId = authUser.$id;

      // Find student document by userId
      const students = await databases.listDocuments(
        databaseId,
        'students',
        [Query.equal('userId', authUserId)]
      );

      if (students.documents.length === 0) {
        log(`   ⚠️  No student record for: ${email}`, colors.yellow);
        notFoundCount++;
        continue;
      }

      const studentDoc = students.documents[0];

      // Skip if already flagged
      if (studentDoc.testUserFlag === true) {
        log(`   ℹ️  Already flagged: ${email}`, colors.blue);
        alreadyFlaggedCount++;
        continue;
      }

      // Update testUserFlag
      await databases.updateDocument(
        databaseId,
        'students',
        studentDoc.$id,
        {
          testUserFlag: true
        }
      );

      // Audit log (T052)
      log(`   📝 Audit: Flagged ${email} at ${new Date().toISOString()}`, colors.reset);
      log(`   ✅ Flagged: ${email} (ID: ${studentDoc.$id})`, colors.green);
      flaggedCount++;
    }
  } catch (error: any) {
    log(`   ❌ Error querying domain users: ${error.message}`, colors.red);
    errorCount++;
  }

  console.log('');
  log('═══════════════════════════════════════════════════', colors.bright);
  log('                   Summary                          ', colors.bright);
  log('═══════════════════════════════════════════════════', colors.bright);
  console.log('');
  log(`   Total explicit emails: ${TEST_USER_EMAILS.length}`, colors.reset);
  log(`   Test domains: ${TEST_USER_DOMAINS.join(', ')}`, colors.reset);
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
