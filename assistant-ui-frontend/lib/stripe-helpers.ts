/**
 * Stripe Helper Functions
 *
 * Provides server-side utilities for Stripe integration:
 * - Stripe client initialization with API key validation
 * - Webhook signature verification for security
 * - No fallback mechanisms - fast fail on errors
 *
 * Following constitution principles:
 * - Fast fail: Throw exceptions immediately on configuration errors
 * - No caching: Fresh client instance for each request
 * - Function limit: Each function <50 lines
 */

import Stripe from 'stripe';

/**
 * Create authenticated Stripe client instance
 *
 * @throws {Error} If STRIPE_SECRET_KEY is missing or invalid
 * @returns {Stripe} Configured Stripe client
 */
export function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY environment variable is not configured. ' +
      'Add it to .env.local following specs/004-stripe-subscription-paywall/quickstart.md'
    );
  }

  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    throw new Error(
      `Invalid STRIPE_SECRET_KEY format: ${secretKey.substring(0, 10)}... ` +
      'Expected format: sk_test_... or sk_live_...'
    );
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia', // Latest stable API version
    typescript: true,
    telemetry: false // Disable telemetry for privacy
  });
}

/**
 * Verify Stripe webhook signature
 *
 * Validates that incoming webhook requests are authentic and from Stripe.
 * CRITICAL: Never bypass this check - prevents webhook spoofing attacks.
 *
 * @param rawBody - Raw request body text (NOT parsed JSON)
 * @param signature - Stripe-Signature header value
 * @throws {Error} If signature verification fails or webhook secret missing
 * @returns {Stripe.Event} Validated Stripe event object
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET environment variable is not configured. ' +
      'Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` ' +
      'and copy the webhook signing secret to .env.local'
    );
  }

  if (!signature) {
    throw new Error(
      'Missing stripe-signature header. ' +
      'Ensure webhook requests include the Stripe-Signature header'
    );
  }

  const stripe = createStripeClient();

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    return event;
  } catch (error: any) {
    throw new Error(
      `Webhook signature verification failed: ${error.message}. ` +
      'This may indicate an invalid webhook secret or tampered request.'
    );
  }
}

/**
 * Handle checkout.session.completed webhook event
 *
 * Activates subscription after successful payment
 * Updates user status, creates subscription record, and audit log
 *
 * @param event - Stripe checkout.session.completed event
 * @param databases - Appwrite Databases instance
 * @throws {Error} If user ID missing or database update fails
 */
export async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  databases: any,
  databaseId: string
): Promise<void> {
  const stripe = createStripeClient();
  const session = event.data.object as Stripe.Checkout.Session;

  const userId = session.client_reference_id;
  if (!userId) {
    throw new Error('Missing client_reference_id in checkout session');
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Fetch subscription details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Import Query and ID from node-appwrite (server SDK)
  const { ID, Query } = await import('node-appwrite');

  // Query students collection by userId field (NOT document ID)
  // Student document IDs ≠ Account IDs, so we must query by userId field
  const students = await databases.listDocuments(
    databaseId,
    'students',
    [Query.equal('userId', userId)]
  );

  if (students.documents.length === 0) {
    throw new Error(`No student record found for user ${userId}`);
  }

  const studentDoc = students.documents[0];

  // Update user subscription status using correct document ID
  await databases.updateDocument(databaseId, 'students', studentDoc.$id, {
    subscriptionStatus: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionExpiresAt: null
  });

  // Create subscription record
  await databases.createDocument(databaseId, 'subscriptions', ID.unique(), {
    userId,
    stripeSubscriptionId: subscriptionId,
    planType: 'monthly_ai_access',
    status: 'active',
    startDate: new Date(subscription.current_period_start * 1000).toISOString(),
    endDate: null,
    billingCycle: 'monthly',
    paymentStatus: 'current',
    lastPaymentDate: new Date().toISOString(),
    nextBillingDate: new Date(subscription.current_period_end * 1000).toISOString()
  });

  // Create audit log
  await databases.createDocument(databaseId, 'subscription_audit_logs', ID.unique(), {
    userId,
    subscriptionId: subscriptionId,
    timestamp: new Date().toISOString(),
    previousStatus: 'inactive',
    newStatus: 'active',
    triggerSource: 'stripe_webhook',
    eventId: event.id,
    adminUserId: null,
    adminNotes: null
  });

  console.log(`[Webhook] Subscription activated for user ${userId}`);
}
