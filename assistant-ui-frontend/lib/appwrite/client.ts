import { Client, Account, Databases, ID } from 'appwrite';

// SECURITY: This file contains API keys and MUST only be imported by server-side code
// Fail fast if imported client-side to prevent API key exposure
if (typeof window !== 'undefined') {
  throw new Error(
    '[SECURITY] lib/appwrite/client.ts cannot be imported in client-side code! ' +
    'This file contains API keys. Use lib/server/appwrite.ts for server-side operations, ' +
    'or call API routes from client components.'
  );
}

export const appwriteConfig = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
  apiKey: process.env.APPWRITE_API_KEY!,
  databaseId: 'default',
  studentsCollectionId: 'students',
  // Stripe subscription collections (Feature: 004-stripe-subscription-paywall)
  // Note: Subscription fields are stored in 'students' collection, not separate 'users' collection
  subscriptionsCollectionId: 'subscriptions',
  subscriptionAuditLogsCollectionId: 'subscription_audit_logs',
  stripeWebhookEventsCollectionId: 'stripe_webhook_events',
  webhookErrorQueueCollectionId: 'webhook_error_queue',
};

export const createAdminClient = () => {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

  // Set API key for server-side operations
  if (appwriteConfig.apiKey) {
    // In Appwrite v19, use setDevKey for server-side authentication
    if (typeof (client as any).setDevKey === 'function') {
      (client as any).setDevKey(appwriteConfig.apiKey);
    } else if (typeof (client as any).setKey === 'function') {
      (client as any).setKey(appwriteConfig.apiKey);
    } else {
      console.error('No API key method found on client');
    }
  }

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
  };
};

export const createSessionClient = (sessionSecret?: string) => {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);
  
  if (sessionSecret) {
    // Use the session secret for authentication
    client.setSession(sessionSecret);
  }

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
  };
};

export { ID };