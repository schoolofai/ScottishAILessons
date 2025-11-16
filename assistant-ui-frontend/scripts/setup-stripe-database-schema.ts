/**
 * Database Migration Script: Stripe Subscription Paywall Schema
 *
 * This script sets up the complete Appwrite database schema for subscription management:
 * - Extends existing 'users' collection with 5 new attributes
 * - Creates 4 new collections (subscriptions, subscription_audit_logs, stripe_webhook_events, webhook_error_queue)
 * - Creates all required indexes
 * - Configures collection permissions
 *
 * Run with: npx tsx scripts/setup-stripe-database-schema.ts
 *
 * Prerequisites:
 * - Appwrite project ID and API key configured in .env.local
 * - Appwrite CLI authenticated (optional, for admin SDK access)
 */

import { Client, Databases, ID, Permission, Role } from 'node-appwrite';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local.langgraph
const envPath = path.join(__dirname, '../.env.local.langgraph');
console.log(`🔧 Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

// Configuration from environment variables with fallback pattern
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || process.env.APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || process.env.APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY!;

const DATABASE_ID = 'default'; // Adjust if using custom database ID

// Debug logging for authentication
console.log('🔐 Authentication check:');
console.log('  Endpoint:', APPWRITE_ENDPOINT);
console.log('  Project ID:', APPWRITE_PROJECT_ID);
console.log('  API Key present:', APPWRITE_API_KEY ? `Yes (${APPWRITE_API_KEY.substring(0, 20)}...)` : 'NO');
console.log('');

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  APPWRITE_ENDPOINT:', APPWRITE_ENDPOINT ? '✅' : '❌');
  console.error('  APPWRITE_PROJECT_ID:', APPWRITE_PROJECT_ID ? '✅' : '❌');
  console.error('  APPWRITE_API_KEY:', APPWRITE_API_KEY ? '✅' : '❌');
  throw new Error(
    'Missing required environment variables. Check .env.local.langgraph file.'
  );
}

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

/**
 * Helper function to safely create an attribute with error handling
 */
async function safeCreateAttribute(
  collectionId: string,
  createFn: () => Promise<any>,
  attributeName: string
): Promise<void> {
  try {
    await createFn();
    console.log(`✅ Created attribute: ${collectionId}.${attributeName}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`⚠️  Attribute already exists: ${collectionId}.${attributeName}`);
    } else {
      console.error(`❌ Failed to create ${collectionId}.${attributeName}:`, error.message);
      throw error;
    }
  }
}

/**
 * Helper function to safely create an index with error handling
 */
async function safeCreateIndex(
  collectionId: string,
  key: string,
  type: string,
  attributes: string[],
  orders: string[]
): Promise<void> {
  try {
    await databases.createIndex(DATABASE_ID, collectionId, key, type, attributes, orders);
    console.log(`✅ Created index: ${collectionId}.${key}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`⚠️  Index already exists: ${collectionId}.${key}`);
    } else {
      console.error(`❌ Failed to create index ${collectionId}.${key}:`, error.message);
      throw error;
    }
  }
}

/**
 * Wait for attributes to become available before creating indexes
 */
async function waitForAttributeAvailability(delayMs: number = 3000): Promise<void> {
  console.log(`⏳ Waiting ${delayMs}ms for attributes to become available...`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Step 1: Extend students collection with subscription attributes
 * Note: This app stores user data in 'students' collection, not 'users'
 */
async function extendStudentsCollection(): Promise<void> {
  console.log('\n=== STEP 1: Extending Students Collection ===\n');

  const STUDENTS_COLLECTION_ID = 'students';

  // Add subscriptionStatus enum attribute
  await safeCreateAttribute(
    STUDENTS_COLLECTION_ID,
    () => databases.createEnumAttribute(
      DATABASE_ID,
      STUDENTS_COLLECTION_ID,
      'subscriptionStatus',
      ['inactive', 'active', 'payment_failed', 'cancelled'],
      false, // optional (must be optional to have default)
      'inactive', // default
      false // not array
    ),
    'subscriptionStatus'
  );

  // Add stripeCustomerId string attribute
  await safeCreateAttribute(
    STUDENTS_COLLECTION_ID,
    () => databases.createStringAttribute(
      DATABASE_ID,
      STUDENTS_COLLECTION_ID,
      'stripeCustomerId',
      255,
      false, // optional
      null,
      false
    ),
    'stripeCustomerId'
  );

  // Add stripeSubscriptionId string attribute
  await safeCreateAttribute(
    STUDENTS_COLLECTION_ID,
    () => databases.createStringAttribute(
      DATABASE_ID,
      STUDENTS_COLLECTION_ID,
      'stripeSubscriptionId',
      255,
      false, // optional
      null,
      false
    ),
    'stripeSubscriptionId'
  );

  // Add testUserFlag boolean attribute
  await safeCreateAttribute(
    STUDENTS_COLLECTION_ID,
    () => databases.createBooleanAttribute(
      DATABASE_ID,
      STUDENTS_COLLECTION_ID,
      'testUserFlag',
      false, // optional (must be optional to have default)
      false, // default
      false // not array
    ),
    'testUserFlag'
  );

  // Add subscriptionExpiresAt datetime attribute
  await safeCreateAttribute(
    STUDENTS_COLLECTION_ID,
    () => databases.createDatetimeAttribute(
      DATABASE_ID,
      STUDENTS_COLLECTION_ID,
      'subscriptionExpiresAt',
      false, // optional
      null,
      false
    ),
    'subscriptionExpiresAt'
  );

  // Wait for attributes to become available before creating indexes
  await waitForAttributeAvailability();

  // Create indexes for students collection
  await safeCreateIndex(STUDENTS_COLLECTION_ID, 'subscription_status_idx', 'key', ['subscriptionStatus'], ['ASC']);
  await safeCreateIndex(STUDENTS_COLLECTION_ID, 'stripe_customer_idx', 'key', ['stripeCustomerId'], ['ASC']);
  await safeCreateIndex(STUDENTS_COLLECTION_ID, 'test_user_idx', 'key', ['testUserFlag'], ['ASC']);

  console.log('\n✅ Students collection extended successfully\n');
}

/**
 * Step 2: Create subscriptions collection
 */
async function createSubscriptionsCollection(): Promise<void> {
  console.log('\n=== STEP 2: Creating Subscriptions Collection ===\n');

  const COLLECTION_ID = 'subscriptions';

  try {
    await databases.createCollection(
      DATABASE_ID,
      COLLECTION_ID,
      'subscriptions',
      [
        Permission.read(Role.any()),
        Permission.create(Role.any()),
        Permission.update(Role.any())
      ],
      true // documentSecurity enabled
    );
    console.log(`✅ Created collection: ${COLLECTION_ID}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`⚠️  Collection already exists: ${COLLECTION_ID}`);
    } else {
      throw error;
    }
  }

  // Add attributes
  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'userId', 255, true), 'userId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'stripeSubscriptionId', 255, true), 'stripeSubscriptionId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'planType',
      ['monthly_ai_access', 'annual_ai_access'],
      false, 'monthly_ai_access', false
    ), 'planType'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'status',
      ['active', 'cancelled', 'past_due', 'incomplete'],
      false, 'active', false
    ), 'status'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'startDate', true), 'startDate'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'endDate', false, null, false), 'endDate'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'billingCycle',
      ['monthly', 'annual'],
      false, 'monthly', false
    ), 'billingCycle'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'paymentStatus',
      ['current', 'past_due', 'failed'],
      false, 'current', false
    ), 'paymentStatus'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'lastPaymentDate', false, null, false), 'lastPaymentDate'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'nextBillingDate', false, null, false), 'nextBillingDate'
  );

  // Wait for attributes to become available before creating indexes
  await waitForAttributeAvailability();

  // Create indexes
  await safeCreateIndex(COLLECTION_ID, 'user_id_idx', 'key', ['userId'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'stripe_subscription_id_idx', 'unique', ['stripeSubscriptionId'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'status_idx', 'key', ['status'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'next_billing_date_idx', 'key', ['nextBillingDate'], ['ASC']);

  console.log('\n✅ Subscriptions collection created successfully\n');
}

/**
 * Step 3: Create subscription_audit_logs collection
 */
async function createAuditLogsCollection(): Promise<void> {
  console.log('\n=== STEP 3: Creating Subscription Audit Logs Collection ===\n');

  const COLLECTION_ID = 'subscription_audit_logs';

  try {
    await databases.createCollection(
      DATABASE_ID,
      COLLECTION_ID,
      'subscription_audit_logs',
      [Permission.read(Role.any()), Permission.create(Role.any())],
      true
    );
    console.log(`✅ Created collection: ${COLLECTION_ID}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`⚠️  Collection already exists: ${COLLECTION_ID}`);
    } else {
      throw error;
    }
  }

  // Add attributes
  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'userId', 255, true), 'userId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'subscriptionId', 255, true), 'subscriptionId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'timestamp', true), 'timestamp'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'previousStatus',
      ['inactive', 'active', 'payment_failed', 'cancelled'],
      false, 'inactive', false
    ), 'previousStatus'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'newStatus',
      ['inactive', 'active', 'payment_failed', 'cancelled'],
      false, 'active', false
    ), 'newStatus'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'triggerSource',
      ['stripe_webhook', 'manual_admin', 'system_cron', 'api_call'],
      false, 'stripe_webhook', false
    ), 'triggerSource'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'eventId', 255, false, null, false), 'eventId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'adminUserId', 255, false, null, false), 'adminUserId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'adminNotes', 5000, false, null, false), 'adminNotes'
  );

  // Wait for attributes to become available before creating indexes
  await waitForAttributeAvailability();

  // Create indexes
  await safeCreateIndex(COLLECTION_ID, 'user_id_idx', 'key', ['userId'], ['DESC']);
  await safeCreateIndex(COLLECTION_ID, 'subscription_id_idx', 'key', ['subscriptionId'], ['DESC']);
  await safeCreateIndex(COLLECTION_ID, 'timestamp_idx', 'key', ['timestamp'], ['DESC']);
  await safeCreateIndex(COLLECTION_ID, 'trigger_source_idx', 'key', ['triggerSource'], ['ASC']);

  console.log('\n✅ Subscription audit logs collection created successfully\n');
}

/**
 * Step 4: Create stripe_webhook_events collection
 */
async function createWebhookEventsCollection(): Promise<void> {
  console.log('\n=== STEP 4: Creating Stripe Webhook Events Collection ===\n');

  const COLLECTION_ID = 'stripe_webhook_events';

  try {
    await databases.createCollection(
      DATABASE_ID,
      COLLECTION_ID,
      'stripe_webhook_events',
      [Permission.read(Role.any()), Permission.create(Role.any()), Permission.update(Role.any())],
      true
    );
    console.log(`✅ Created collection: ${COLLECTION_ID}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`⚠️  Collection already exists: ${COLLECTION_ID}`);
    } else {
      throw error;
    }
  }

  // Add attributes
  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'eventId', 255, true), 'eventId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'eventType', 255, true), 'eventType'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'receivedAt', true), 'receivedAt'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'processingStatus',
      ['processing', 'completed', 'failed'],
      false, 'processing', false
    ), 'processingStatus'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'payload', 100000, true), 'payload'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'processedAt', false, null, false), 'processedAt'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'errorMessage', 5000, false, null, false), 'errorMessage'
  );

  // Wait for attributes to become available before creating indexes
  await waitForAttributeAvailability();

  // Create indexes
  await safeCreateIndex(COLLECTION_ID, 'event_id_idx', 'unique', ['eventId'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'event_type_idx', 'key', ['eventType'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'processing_status_idx', 'key', ['processingStatus'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'received_at_idx', 'key', ['receivedAt'], ['DESC']);

  console.log('\n✅ Stripe webhook events collection created successfully\n');
}

/**
 * Step 5: Create webhook_error_queue collection
 */
async function createWebhookErrorQueueCollection(): Promise<void> {
  console.log('\n=== STEP 5: Creating Webhook Error Queue Collection ===\n');

  const COLLECTION_ID = 'webhook_error_queue';

  try {
    await databases.createCollection(
      DATABASE_ID,
      COLLECTION_ID,
      'webhook_error_queue',
      [Permission.read(Role.any()), Permission.create(Role.any()), Permission.update(Role.any())],
      true
    );
    console.log(`✅ Created collection: ${COLLECTION_ID}`);
  } catch (error: any) {
    if (error.code === 409) {
      console.log(`⚠️  Collection already exists: ${COLLECTION_ID}`);
    } else {
      throw error;
    }
  }

  // Add attributes
  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'webhookEventId', 255, true), 'webhookEventId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'errorMessage', 5000, true), 'errorMessage'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createIntegerAttribute(DATABASE_ID, COLLECTION_ID, 'retryCount', false, 0, null, 0), 'retryCount'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'lastRetryAt', false, null, false), 'lastRetryAt'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createEnumAttribute(
      DATABASE_ID, COLLECTION_ID, 'resolutionStatus',
      ['pending_admin_review', 'resolved', 'ignored'],
      false, 'pending_admin_review', false
    ), 'resolutionStatus'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'adminUserId', 255, false, null, false), 'adminUserId'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, 'adminNotes', 5000, false, null, false), 'adminNotes'
  );

  await safeCreateAttribute(COLLECTION_ID, () =>
    databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, 'resolvedAt', false, null, false), 'resolvedAt'
  );

  // Wait for attributes to become available before creating indexes
  await waitForAttributeAvailability();

  // Create indexes
  await safeCreateIndex(COLLECTION_ID, 'webhook_event_id_idx', 'key', ['webhookEventId'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'resolution_status_idx', 'key', ['resolutionStatus'], ['ASC']);
  await safeCreateIndex(COLLECTION_ID, 'last_retry_at_idx', 'key', ['lastRetryAt'], ['DESC']);

  console.log('\n✅ Webhook error queue collection created successfully\n');
}

/**
 * Main migration execution
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  Stripe Subscription Paywall - Database Schema Migration          ║');
  console.log('║  Feature: 004-stripe-subscription-paywall                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  try {
    // Execute migration steps sequentially
    await extendStudentsCollection();
    await createSubscriptionsCollection();
    await createAuditLogsCollection();
    await createWebhookEventsCollection();
    await createWebhookErrorQueueCollection();

    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ DATABASE SCHEMA MIGRATION COMPLETED SUCCESSFULLY               ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Verify schema in Appwrite Console: https://cloud.appwrite.io');
    console.log('2. Update Stripe environment variables in .env.local');
    console.log('3. Run Stripe setup quickstart: specs/004-stripe-subscription-paywall/quickstart.md');
    console.log('4. Install Stripe CLI and start webhook forwarding\n');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Execute migration
main();
