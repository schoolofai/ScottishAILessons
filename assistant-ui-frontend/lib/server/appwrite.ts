/**
 * Server-Side Appwrite Client Utilities
 *
 * Following Appwrite's official SSR pattern for Next.js
 * Documentation: https://appwrite.io/docs/products/auth/server-side-rendering
 *
 * IMPORTANT:
 * - Uses node-appwrite (server SDK), not appwrite (client SDK)
 * - Creates fresh clients per request (never shared between requests)
 * - Admin client for server operations, session client for user operations
 */

import { Client, Account, Databases } from 'node-appwrite';
import { cookies } from 'next/headers';

// Session cookie name
export const SESSION_COOKIE = 'appwrite_session';

// Appwrite configuration from environment variables
const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

/**
 * Create admin client for server-side operations
 * Uses API key authentication - bypasses permissions and rate limits
 *
 * Use cases:
 * - Creating user sessions (login)
 * - Webhook processing
 * - Admin operations
 *
 * WARNING: Never share client instance between requests
 */
export async function createAdminClient() {
  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      'Missing Appwrite environment variables. Check .env.local:\n' +
      '- NEXT_PUBLIC_APPWRITE_ENDPOINT\n' +
      '- NEXT_PUBLIC_APPWRITE_PROJECT_ID\n' +
      '- APPWRITE_API_KEY'
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey); // API key for admin access

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
  };
}

/**
 * Create session client for authenticated user operations
 * Uses session cookie for authentication - respects row-level permissions
 *
 * Use cases:
 * - Fetching user data in API routes
 * - Database operations with user permissions
 * - Subscription status checks
 *
 * @throws {Error} If no session cookie found (user not logged in)
 * WARNING: Never share client instance between requests
 */
export async function createSessionClient() {
  if (!endpoint || !projectId) {
    throw new Error(
      'Missing Appwrite environment variables. Check .env.local:\n' +
      '- NEXT_PUBLIC_APPWRITE_ENDPOINT\n' +
      '- NEXT_PUBLIC_APPWRITE_PROJECT_ID'
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId);

  // Get session from httpOnly cookie
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);

  if (!session || !session.value) {
    throw new Error('No session found. User is not authenticated.');
  }

  // Set session for authentication
  client.setSession(session.value);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
  };
}

/**
 * Appwrite database configuration
 * Re-exported for convenience in API routes
 */
export const appwriteConfig = {
  endpoint: endpoint!,
  projectId: projectId!,
  databaseId: 'default',
  studentsCollectionId: 'students',
  subscriptionsCollectionId: 'subscriptions',
  subscriptionAuditLogsCollectionId: 'subscription_audit_logs',
  stripeWebhookEventsCollectionId: 'stripe_webhook_events',
  webhookErrorQueueCollectionId: 'webhook_error_queue',
};
