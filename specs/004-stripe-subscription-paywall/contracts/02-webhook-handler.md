# API Contract: Stripe Webhook Handler

**Endpoint**: `POST /api/stripe/webhook`
**Purpose**: Receive and process Stripe webhook events for subscription lifecycle management
**Authentication**: Stripe signature verification (NOT Appwrite session)

## Request

### Headers

```
Content-Type: application/json
Stripe-Signature: t=<timestamp>,v1=<signature> [REQUIRED]
```

**Critical**: The `Stripe-Signature` header MUST be present and valid. Requests without valid signatures MUST be rejected with 400 Bad Request.

### Body

```typescript
interface StripeWebhookEvent {
  id: string; // Event ID (e.g., "evt_1ABC2DEF3GHI4JKL")
  object: 'event';
  type: string; // Event type (see supported events below)
  data: {
    object: any; // Stripe resource (Subscription, Invoice, etc.)
  };
  created: number; // Unix timestamp
  livemode: boolean; // true for production, false for test
}
```

### Supported Event Types

| Event Type | Priority | Purpose |
|------------|----------|---------|
| `checkout.session.completed` | P1 | Activate subscription after successful payment |
| `customer.subscription.updated` | P1 | Update subscription metadata (plan changes, renewals) |
| `customer.subscription.deleted` | P1 | Revoke access when subscription cancelled |
| `invoice.payment_failed` | P1 | Revoke access immediately on payment failure |
| `invoice.payment_succeeded` | P2 | Update payment status to 'current' |
| `customer.subscription.trial_will_end` | P3 | Send trial ending notification (future) |

## Response

### Success Response (200 OK)

```json
{
  "received": true
}
```

**IMPORTANT**: Always return 200 OK after successfully processing OR if the event is already processed (idempotency). This prevents Stripe from retrying the webhook.

### Error Responses

#### 400 Bad Request

```json
{
  "error": "Webhook signature verification failed"
}
```

**Trigger**: Missing or invalid `Stripe-Signature` header

#### 500 Internal Server Error

```json
{
  "error": "Webhook processing failed: <error_details>",
  "received": true,
  "queued": true
}
```

**Trigger**: Database error, unexpected exception during processing. Event is queued for manual review, but 200 OK is returned to Stripe to prevent retries.

**Note**: Even when returning 500, Stripe will retry the webhook. For non-transient errors, the handler should still return 200 with `queued: true` to prevent infinite retries.

## Business Logic

### Signature Verification (MANDATORY)

```typescript
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(request: Request) {
  const body = await request.text(); // MUST use raw body text, not JSON
  const signature = headers().get('stripe-signature');

  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err);
    throw new Error('Webhook signature verification failed');
  }

  // Signature verified - proceed with processing
  await processWebhookEvent(event);
  return Response.json({ received: true });
}
```

**Security Note**: NEVER bypass signature verification. This prevents webhook spoofing attacks.

### Idempotency Check

```typescript
async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  // Check if event already processed
  const existingEvent = await databases.listDocuments(
    DATABASE_ID,
    'stripe_webhook_events',
    [Query.equal('eventId', event.id)]
  );

  if (existingEvent.documents.length > 0) {
    console.log(`[Webhook] Event ${event.id} already processed, skipping`);
    return; // Return 200 to Stripe without re-processing
  }

  // Store event atomically before processing
  const webhookDoc = await databases.createDocument(
    DATABASE_ID,
    'stripe_webhook_events',
    ID.unique(),
    {
      eventId: event.id,
      eventType: event.type,
      receivedAt: new Date().toISOString(),
      processingStatus: 'processing',
      payload: JSON.stringify(event.data)
    }
  );

  // Process event based on type
  try {
    await handleEventType(event);

    // Mark as completed
    await databases.updateDocument(
      DATABASE_ID,
      'stripe_webhook_events',
      webhookDoc.$id,
      {
        processingStatus: 'completed',
        processedAt: new Date().toISOString()
      }
    );
  } catch (error) {
    // Add to error queue for manual intervention
    await addToErrorQueue(webhookDoc.$id, event.id, error);
    throw error; // Re-throw to return 500 (or catch and return 200 with queued: true)
  }
}
```

### Event-Specific Handlers

#### 1. `checkout.session.completed`

**Purpose**: Activate subscription after successful checkout

```typescript
async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Extract user ID from client_reference_id
  const userId = session.client_reference_id!;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Fetch full subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Update user subscription status
  await databases.updateDocument(DATABASE_ID, 'users', userId, {
    subscriptionStatus: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionExpiresAt: null
  });

  // Create subscription record
  await databases.createDocument(DATABASE_ID, 'subscriptions', ID.unique(), {
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
  await databases.createDocument(DATABASE_ID, 'subscription_audit_logs', ID.unique(), {
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
```

#### 2. `invoice.payment_failed`

**Purpose**: Immediately revoke access on payment failure (no grace period)

```typescript
async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;

  // Get subscription and customer
  const subscriptionId = invoice.subscription as string;
  const customerId = invoice.customer as string;

  // Find user by Stripe customer ID
  const users = await databases.listDocuments(
    DATABASE_ID,
    'users',
    [Query.equal('stripeCustomerId', customerId)]
  );

  if (users.documents.length === 0) {
    throw new Error(`No user found for Stripe customer ${customerId}`);
  }

  const user = users.documents[0];

  // IMMEDIATE REVOCATION - no grace period
  await databases.updateDocument(DATABASE_ID, 'users', user.$id, {
    subscriptionStatus: 'payment_failed'
    // subscriptionExpiresAt remains null (immediate revocation)
  });

  // Update subscription record
  await databases.updateDocument(DATABASE_ID, 'subscriptions', subscriptionId, {
    paymentStatus: 'failed'
  });

  // Create audit log
  await databases.createDocument(DATABASE_ID, 'subscription_audit_logs', ID.unique(), {
    userId: user.$id,
    subscriptionId: subscriptionId,
    timestamp: new Date().toISOString(),
    previousStatus: 'active',
    newStatus: 'payment_failed',
    triggerSource: 'stripe_webhook',
    eventId: event.id,
    adminUserId: null,
    adminNotes: 'Immediate access revocation - payment failed'
  });

  // Trigger notifications
  await sendInAppNotification(user.$id, {
    type: 'payment_failed',
    message: 'Your payment has failed. Access to AI features has been revoked. Please update your payment method.',
    priority: 'high'
  });

  await sendEmailNotification(user.email, {
    template: 'payment_failed',
    data: { userName: user.name }
  }).catch(err => {
    // Email is best-effort - log failure but don't throw
    console.error(`[Webhook] Email notification failed for user ${user.$id}:`, err);
  });

  console.log(`[Webhook] Access revoked for user ${user.$id} due to payment failure`);
}
```

#### 3. `customer.subscription.deleted`

**Purpose**: Revoke access when subscription is cancelled

```typescript
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const subscriptionId = subscription.id;
  const customerId = subscription.customer as string;

  // Find user
  const users = await databases.listDocuments(
    DATABASE_ID,
    'users',
    [Query.equal('stripeCustomerId', customerId)]
  );

  if (users.documents.length === 0) {
    throw new Error(`No user found for Stripe customer ${customerId}`);
  }

  const user = users.documents[0];

  // Update user status
  await databases.updateDocument(DATABASE_ID, 'users', user.$id, {
    subscriptionStatus: 'cancelled',
    subscriptionExpiresAt: new Date().toISOString() // Immediate cancellation
  });

  // Update subscription record
  await databases.updateDocument(DATABASE_ID, 'subscriptions', subscriptionId, {
    status: 'cancelled',
    endDate: new Date().toISOString()
  });

  // Create audit log
  await databases.createDocument(DATABASE_ID, 'subscription_audit_logs', ID.unique(), {
    userId: user.$id,
    subscriptionId: subscriptionId,
    timestamp: new Date().toISOString(),
    previousStatus: 'active',
    newStatus: 'cancelled',
    triggerSource: 'stripe_webhook',
    eventId: event.id,
    adminUserId: null,
    adminNotes: null
  });

  console.log(`[Webhook] Subscription cancelled for user ${user.$id}`);
}
```

### Error Queue Pattern

```typescript
async function addToErrorQueue(
  webhookDocId: string,
  eventId: string,
  error: any
): Promise<void> {
  await databases.createDocument(
    DATABASE_ID,
    'webhook_error_queue',
    ID.unique(),
    {
      webhookEventId: eventId,
      errorMessage: error.message || String(error),
      retryCount: 0,
      lastRetryAt: null,
      resolutionStatus: 'pending_admin_review',
      adminUserId: null,
      adminNotes: null
    }
  );

  // Update webhook processing status
  await databases.updateDocument(
    DATABASE_ID,
    'stripe_webhook_events',
    webhookDocId,
    {
      processingStatus: 'failed',
      errorMessage: error.message || String(error)
    }
  );

  console.error(`[Webhook] Event ${eventId} added to error queue:`, error);
}
```

## Security Considerations

### Signature Verification Flow

```
1. Extract raw request body as text (NOT parsed JSON)
2. Get Stripe-Signature header
3. Call stripe.webhooks.constructEvent(body, signature, secret)
4. If verification fails → throw error (return 400)
5. If verification succeeds → process event
```

**Common Mistakes**:
- ❌ Parsing body as JSON before verification → signatures will fail
- ❌ Using wrong webhook secret (test vs production) → signatures will fail
- ❌ Bypassing verification in development → security vulnerability

### Environment-Specific Secrets

| Environment | Webhook Secret Format | Example |
|-------------|----------------------|---------|
| Local Development (Stripe CLI) | `whsec_...` (temporary) | `whsec_abc123def456...` |
| Production | `whsec_...` (permanent) | `whsec_xyz789uvw012...` |

**Setup**:
```bash
# Local (using Stripe CLI)
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Outputs: whsec_abc123... → Save to .env.local

# Production (Stripe Dashboard)
# Configure webhook at https://dashboard.stripe.com/webhooks
# Copy signing secret → Save to .env.production
```

## Testing Strategy

### Manual Testing with Stripe CLI

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

### Test Cases

| Scenario | Expected Behavior | Verification |
|----------|-------------------|--------------|
| Valid signature | Event processed, return 200 | Check `stripe_webhook_events` table |
| Invalid signature | Return 400, event not processed | Check server logs for error |
| Duplicate event ID | Return 200, skip processing | Check `stripe_webhook_events` count |
| Database error during processing | Event queued in `webhook_error_queue` | Check error queue table |
| Unknown event type | Log warning, return 200 | Check server logs |
| Test mode event in production | Process normally (flag with `livemode: false`) | Check `payload` field |

## Monitoring and Alerting

### Key Metrics to Track

```typescript
// Example monitoring integration
interface WebhookMetrics {
  totalEventsReceived: number;
  eventsProcessedSuccessfully: number;
  eventsFailed: number;
  averageProcessingTime: number;
  queuedErrorsCount: number;
}
```

**Alert Triggers**:
- Failed webhook count > 5 in 1 hour → Notify admin
- Webhook processing time > 5 seconds → Performance issue
- Error queue size > 10 → Manual intervention required

## References

- [Stripe Webhook Security](https://stripe.com/docs/webhooks#verify-events)
- [Stripe Event Types](https://stripe.com/docs/api/events/types)
- [Next.js API Routes - Raw Body](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#request-body)
- [Stripe CLI Testing](https://stripe.com/docs/stripe-cli)
