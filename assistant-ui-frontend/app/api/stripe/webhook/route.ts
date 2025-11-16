/**
 * API Route: Stripe Webhook Handler
 *
 * Endpoint: POST /api/stripe/webhook
 * Purpose: Process Stripe webhook events for subscription lifecycle management
 * Authentication: Stripe signature verification (NOT Appwrite session)
 *
 * Contract: specs/004-stripe-subscription-paywall/contracts/02-webhook-handler.md
 *
 * Following constitution principles:
 * - Fast fail: Throw exceptions for invalid signatures
 * - No fallback mechanisms: Queue failures for manual intervention
 * - No caching: Fresh database queries for each event
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { Query } from 'node-appwrite'; // Changed from 'appwrite' to 'node-appwrite' for server-side
import { verifyWebhookSignature, handleCheckoutSessionCompleted } from '@/lib/stripe-helpers';
import { createAdminClient, appwriteConfig } from '@/lib/server/appwrite'; // Changed from client to server
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    // Step 1: Get raw body and signature
    const rawBody = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Step 2: Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(rawBody, signature);
    } catch (error: any) {
      console.error('[Webhook] Signature verification failed:', error);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

    // Step 3: Check idempotency - prevent duplicate processing
    const { databases } = await createAdminClient();
    const existingEvent = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.stripeWebhookEventsCollectionId,
      [Query.equal('eventId', event.id)]
    );

    if (existingEvent.documents.length > 0) {
      console.log(`[Webhook] Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    // Step 4: Store webhook event atomically (T027 - Idempotency check)
    const { ID } = await import('appwrite');
    const webhookDoc = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.stripeWebhookEventsCollectionId,
      ID.unique(),
      {
        eventId: event.id,
        eventType: event.type,
        receivedAt: new Date().toISOString(),
        processingStatus: 'processing',
        payload: JSON.stringify(event.data.object),
        processedAt: null,
        errorMessage: null
      }
    );

    // Step 5: Process event based on type
    try {
      await processEventByType(event, databases, appwriteConfig.databaseId);

      // Mark as completed
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.stripeWebhookEventsCollectionId,
        webhookDoc.$id,
        {
          processingStatus: 'completed',
          processedAt: new Date().toISOString()
        }
      );

      console.log(`[Webhook] Event ${event.id} processed successfully`);
      return NextResponse.json({ received: true });

    } catch (error: any) {
      console.error(`[Webhook] Processing error for event ${event.id}:`, error);

      // T028: Add to error queue for manual intervention
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.webhookErrorQueueCollectionId,
        ID.unique(),
        {
          webhookEventId: event.id,
          errorMessage: error.message || 'Unknown error',
          retryCount: 0,
          lastRetryAt: null,
          resolutionStatus: 'pending_admin_review',
          adminUserId: null,
          adminNotes: null,
          resolvedAt: null
        }
      );

      // Mark webhook as failed
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.stripeWebhookEventsCollectionId,
        webhookDoc.$id,
        {
          processingStatus: 'failed',
          processedAt: new Date().toISOString(),
          errorMessage: error.message
        }
      );

      // Return 200 to prevent Stripe retries - admin will manually reconcile
      console.log(`[Webhook] Event ${event.id} queued for manual review`);
      return NextResponse.json({
        received: true,
        queued: true,
        error: 'Processing failed, queued for admin review'
      });
    }

  } catch (error: any) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: `Webhook processing failed: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Route webhook events to appropriate handlers
 * T026: Implement event-specific handlers
 */
async function processEventByType(
  event: Stripe.Event,
  databases: any,
  databaseId: string
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event, databases, databaseId);
      break;

    case 'invoice.payment_failed':
      // TODO: Implement handleInvoicePaymentFailed (Phase 6 - T072)
      console.log(`[Webhook] Skipping unimplemented event type: ${event.type}`);
      break;

    case 'customer.subscription.updated':
      // TODO: Implement handleSubscriptionUpdated (Phase 6 - T074)
      console.log(`[Webhook] Skipping unimplemented event type: ${event.type}`);
      break;

    case 'customer.subscription.deleted':
      // TODO: Implement handleSubscriptionDeleted (Phase 6 - T073)
      console.log(`[Webhook] Skipping unimplemented event type: ${event.type}`);
      break;

    case 'invoice.payment_succeeded':
      // TODO: Implement handleInvoicePaymentSucceeded (Phase 6 - optional)
      console.log(`[Webhook] Skipping unimplemented event type: ${event.type}`);
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }
}
