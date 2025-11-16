# Research: Stripe Subscription Paywall Integration

**Feature**: `004-stripe-subscription-paywall`
**Date**: 2025-11-14
**Status**: Planning Phase
**Spec**: [spec.md](./spec.md)

## Overview

This document captures technical research for integrating Stripe subscription payments into the Scottish AI Lessons platform. The research covers API integration patterns, webhook security, database design, and deployment strategies.

## 1. Stripe Checkout Sessions API Integration

### Core Pattern: Redirect-Based Checkout

Stripe Checkout provides a hosted payment page that eliminates PCI compliance burden. The integration flow:

```
User clicks "Subscribe"
  → Frontend creates Checkout Session via API route
  → Stripe returns session.url
  → Frontend redirects to Stripe-hosted page
  → User completes payment
  → Stripe redirects back to success_url or cancel_url
  → Webhook confirms subscription status
```

**Key API Endpoints**:
- `POST /v1/checkout/sessions` - Create new checkout session
- `POST /v1/billing_portal/sessions` - Create customer portal session (for managing subscriptions)

**Critical Parameters**:
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: user.email, // Pre-fill if known
  client_reference_id: user.$id, // Link to Appwrite user ID
  line_items: [{
    price: process.env.STRIPE_PRICE_ID, // Monthly price ID
    quantity: 1,
  }],
  success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/dashboard?canceled=true`,
  metadata: {
    userId: user.$id,
    subscriptionType: 'monthly_ai_access'
  }
});
```

**Best Practices**:
- Always use `client_reference_id` to link Stripe customer to Appwrite user
- Include user context in `metadata` for webhook processing
- Use environment variables for `price_id` (different for test/production)
- Implement idempotency keys for session creation to prevent duplicate charges

### Customer Portal Integration

Allow users to manage subscriptions without custom UI:

```typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${origin}/dashboard`,
});
// Redirect to portalSession.url
```

**Capabilities**:
- Update payment method
- View invoices and payment history
- Cancel subscription
- Download receipts

## 2. Next.js API Route Patterns

### File Structure

```
assistant-ui-frontend/
├── app/
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/
│   │   │   │   └── route.ts          # POST create checkout session
│   │   │   ├── webhook/
│   │   │   │   └── route.ts          # POST handle Stripe webhooks
│   │   │   ├── portal/
│   │   │   │   └── route.ts          # POST create portal session
│   │   │   └── subscription-status/
│   │   │       └── route.ts          # GET check subscription status
```

### Authentication Pattern

All API routes MUST verify Appwrite session:

```typescript
import { createSessionClient } from '@/lib/appwrite-server';

export async function POST(request: Request) {
  try {
    const { account } = await createSessionClient(request);
    const user = await account.get();

    // Proceed with authenticated logic

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
```

**Exception**: Webhook route uses Stripe signature verification instead of session auth.

### Error Handling Pattern (Constitution Compliance)

```typescript
export async function POST(request: Request) {
  try {
    // Business logic
    return Response.json({ success: true, data });
  } catch (error) {
    // Log error details
    console.error('[API Route] Error:', error);

    // THROW exception - NO FALLBACKS
    throw new Error(`Operation failed: ${error.message}`);
  }
}
```

**Constitution Principle**: Fast-fail with detailed error logging. Never use fallback mechanisms.

## 3. Webhook Security and Processing

### Signature Verification (MANDATORY)

```typescript
import { headers } from 'next/headers';
import Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text();
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
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  // Process verified event
}
```

**Critical**: NEVER bypass signature verification. This prevents webhook spoofing attacks.

### Idempotency Pattern

Prevent duplicate event processing using event IDs:

```typescript
// Check if event already processed
const existingEvent = await databases.listDocuments(
  DATABASE_ID,
  WEBHOOK_EVENTS_COLLECTION_ID,
  [Query.equal('eventId', event.id)]
);

if (existingEvent.documents.length > 0) {
  console.log(`Event ${event.id} already processed`);
  return Response.json({ received: true }); // Return 200, skip processing
}

// Store event ID atomically with processing
await databases.createDocument(
  DATABASE_ID,
  WEBHOOK_EVENTS_COLLECTION_ID,
  ID.unique(),
  {
    eventId: event.id,
    eventType: event.type,
    receivedTimestamp: new Date().toISOString(),
    processingStatus: 'processing',
    payload: JSON.stringify(event.data)
  }
);

// Process event logic
```

### Event Types to Handle

| Event Type | Action | Priority |
|------------|--------|----------|
| `checkout.session.completed` | Create subscription record, set user status to 'active' | P1 |
| `customer.subscription.updated` | Update subscription status and metadata | P1 |
| `customer.subscription.deleted` | Set user status to 'inactive', revoke access | P1 |
| `invoice.payment_failed` | Set user status to 'payment_failed', trigger notification | P1 |
| `invoice.payment_succeeded` | Update payment status to 'current' | P2 |
| `customer.subscription.trial_will_end` | Send trial ending notification (if trials enabled) | P3 |

### Error Queue Pattern

When webhook processing fails:

```typescript
try {
  // Webhook processing logic
  await updateSubscriptionStatus(userId, newStatus);

  // Mark webhook as processed
  await databases.updateDocument(
    DATABASE_ID,
    WEBHOOK_EVENTS_COLLECTION_ID,
    webhookDocId,
    { processingStatus: 'completed' }
  );
} catch (error) {
  // Add to error queue for manual intervention
  await databases.createDocument(
    DATABASE_ID,
    WEBHOOK_ERROR_QUEUE_COLLECTION_ID,
    ID.unique(),
    {
      webhookEventId: event.id,
      errorMessage: error.message,
      retryCount: 0,
      lastRetryTimestamp: new Date().toISOString(),
      resolutionStatus: 'pending_admin_review',
      adminResolutionNotes: null
    }
  );

  // Still return 200 to Stripe to prevent retries
  // Admin will manually reconcile
  return Response.json({ received: true, queued: true });
}
```

## 4. Appwrite Database Schema Design

### Collection Overview

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` (extended) | Store subscription metadata | `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId` |
| `subscriptions` (new) | Track subscription details | `userId`, `planType`, `status`, `billingCycle` |
| `subscription_audit_logs` (new) | Audit trail for status changes | `userId`, `previousStatus`, `newStatus`, `triggerSource` |
| `stripe_webhook_events` (new) | Prevent duplicate processing | `eventId`, `eventType`, `processingStatus` |
| `webhook_error_queue` (new) | Failed webhook manual intervention | `webhookEventId`, `errorMessage`, `resolutionStatus` |

### Indexing Strategy

**Performance-critical queries**:
```typescript
// Check subscription status (called on every lesson start)
Query.equal('userId', userId)
Query.equal('status', 'active')

// List failed webhooks (admin dashboard)
Query.equal('resolutionStatus', 'pending_admin_review')
Query.orderDesc('lastRetryTimestamp')

// Find webhook by event ID (idempotency check)
Query.equal('eventId', stripeEventId)
```

**Required Indexes**:
- `users.userId` (primary key, auto-indexed)
- `users.subscriptionStatus` + `users.testUserFlag` (composite for access control)
- `subscriptions.userId` (foreign key)
- `subscriptions.status` (filter active subscriptions)
- `stripe_webhook_events.eventId` (unique, for idempotency)
- `webhook_error_queue.resolutionStatus` (admin dashboard filter)

### Data Consistency Pattern

Use transactions where Appwrite supports them, otherwise implement compensating actions:

```typescript
// Atomic subscription activation
try {
  // 1. Update user subscription status
  await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, userId, {
    subscriptionStatus: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionExpiresAt: null // Active subscription has no expiry
  });

  // 2. Create subscription record
  await databases.createDocument(DATABASE_ID, SUBSCRIPTIONS_COLLECTION_ID, ID.unique(), {
    userId,
    stripeSubscriptionId: subscriptionId,
    planType: 'monthly_ai_access',
    status: 'active',
    startDate: new Date().toISOString(),
    billingCycle: 'monthly'
  });

  // 3. Log audit trail
  await databases.createDocument(DATABASE_ID, AUDIT_LOGS_COLLECTION_ID, ID.unique(), {
    userId,
    previousStatus: 'inactive',
    newStatus: 'active',
    triggerSource: 'stripe_webhook',
    eventId: event.id
  });
} catch (error) {
  // If any step fails, add to error queue for manual rollback
  // DO NOT attempt automatic compensating actions
  throw error; // Fast-fail
}
```

## 5. Admin Dashboard Patterns

### Failed Webhooks View

Component structure for manual intervention:

```typescript
interface WebhookError {
  $id: string;
  webhookEventId: string;
  errorMessage: string;
  retryCount: number;
  lastRetryTimestamp: string;
  resolutionStatus: 'pending_admin_review' | 'resolved' | 'ignored';
  adminResolutionNotes: string | null;
}

// Fetch failed webhooks
const failedWebhooks = await databases.listDocuments<WebhookError>(
  DATABASE_ID,
  WEBHOOK_ERROR_QUEUE_COLLECTION_ID,
  [
    Query.equal('resolutionStatus', 'pending_admin_review'),
    Query.orderDesc('lastRetryTimestamp'),
    Query.limit(50)
  ]
);
```

**Manual Reconciliation Actions**:
1. View webhook payload from `stripe_webhook_events.payload`
2. Compare Stripe dashboard data with Appwrite user records
3. Manually update user subscription status if discrepancy found
4. Mark error as resolved with notes

### Monitoring Alerts

Integration points for future monitoring:

```typescript
// Example: Send alert when webhook error queue grows
if (failedWebhooks.total > 10) {
  // TODO: Integrate with monitoring service (e.g., Sentry, email alert)
  console.error(`[ALERT] ${failedWebhooks.total} failed webhooks pending review`);
}
```

## 6. Test Mode vs Production Configuration

### Environment Variables Pattern

```bash
# .env.local (development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_test_...  # Test price ID

# .env.production (deployment)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_live_...  # Live price ID
```

### Test Card Numbers (Stripe Test Mode)

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Payment fails, triggers `invoice.payment_failed` |

**Test User Strategy**:
- Users with `@testuser.com` emails are flagged automatically
- Test users bypass subscription checks entirely
- Test mode payments do NOT affect production access

### Webhook Configuration

**Test Mode**:
```bash
# Use Stripe CLI for local testing
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Outputs webhook signing secret: whsec_...
```

**Production**:
- Configure webhook endpoint in Stripe Dashboard: `https://yourdomain.com/api/stripe/webhook`
- Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`
- Copy webhook signing secret to production environment

## 7. Security Best Practices

### API Route Security Checklist

- ✅ Verify Appwrite session on all authenticated routes
- ✅ Validate Stripe webhook signatures (MANDATORY)
- ✅ Use HTTPS in production (Stripe requires it for webhooks)
- ✅ Store secrets in environment variables, never in code
- ✅ Implement rate limiting on checkout creation (prevent abuse)
- ✅ Sanitize user inputs before Stripe API calls
- ✅ Log security events (failed signature verifications, auth failures)

### Data Privacy

- User payment details are stored by Stripe, NOT in Appwrite
- Only store: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`
- Never log full webhook payloads in production (contain PII)
- Implement data retention policy for audit logs

## 8. Performance Considerations

### Caching Strategy

**DO NOT cache subscription status** - always fetch fresh data from Appwrite to prevent access control bypasses.

**Cache Stripe product metadata** (prices, plans) using Next.js:
```typescript
import { unstable_cache } from 'next/cache';

export const getStripePrices = unstable_cache(
  async () => {
    const prices = await stripe.prices.list({ active: true });
    return prices.data;
  },
  ['stripe-prices'],
  { revalidate: 3600 } // Cache for 1 hour
);
```

### Query Optimization

**Avoid N+1 queries** when checking access:
```typescript
// BAD: Separate query for each lesson
for (const lesson of lessons) {
  const hasAccess = await checkSubscription(userId); // N+1 queries
}

// GOOD: Single query at component mount
const subscription = await checkSubscription(userId);
const accessibleLessons = subscription.status === 'active' ? lessons : [];
```

## 9. Testing Strategy

### Manual Testing with Playwright

Constitution requires Playwright tests for manual validation:

```typescript
test('Subscription purchase flow', async ({ page }) => {
  // 1. Login as non-subscribed user
  await page.goto('http://localhost:3000/dashboard');
  await login(page, 'test@example.com', 'password');

  // 2. Attempt to start lesson (should show paywall)
  await page.click('[data-testid="start-lesson-btn"]');
  await expect(page.locator('[data-testid="paywall-modal"]')).toBeVisible();

  // 3. Click subscribe button
  await page.click('[data-testid="subscribe-btn"]');

  // 4. Fill Stripe test card (use test mode)
  // Note: Stripe Checkout is hosted, requires manual completion
  // Mark this step as manual intervention in test suite

  // 5. Verify access granted after webhook processing
  // Wait for webhook (may take 2-5 seconds)
  await page.waitForTimeout(5000);
  await page.reload();
  await page.click('[data-testid="start-lesson-btn"]');
  await expect(page.locator('[data-testid="session-chat"]')).toBeVisible();
});
```

### Test Scenarios

| Scenario | Expected Outcome | Verification Method |
|----------|------------------|---------------------|
| Non-subscribed user starts lesson | Paywall modal appears | Visual + Playwright |
| Test user (@testuser.com) starts lesson | No paywall, direct access | Playwright |
| Successful checkout | User status changes to 'active' | Database check + Playwright |
| Failed payment | User status changes to 'payment_failed', banner shown | Playwright |
| Subscription cancellation | User status changes to 'inactive', access revoked | Playwright |
| Webhook signature mismatch | Webhook rejected, error logged | Server logs |
| Duplicate webhook event | Idempotent processing, no duplicate records | Database check |

## 10. Deployment Checklist

### Pre-Deployment

- [ ] Create Stripe product and price in live mode
- [ ] Set up production webhook endpoint in Stripe Dashboard
- [ ] Configure environment variables in deployment platform
- [ ] Test webhook delivery with Stripe CLI in production-like environment
- [ ] Verify Appwrite database indexes are created
- [ ] Review and test manual reconciliation workflow

### Post-Deployment

- [ ] Monitor webhook error queue for first 24 hours
- [ ] Verify successful checkout flows with test transactions (use live mode test cards)
- [ ] Confirm audit logs are being written correctly
- [ ] Test customer portal access and subscription management
- [ ] Verify email notifications are delivered (if implemented)
- [ ] Document common failure scenarios for support team

## 11. Known Limitations and Future Enhancements

### Current Scope Limitations

- Single subscription tier (monthly AI access)
- Email notifications are best-effort, not guaranteed delivery
- Manual admin intervention required for webhook failures
- No automatic retry logic for failed webhooks

### Future Enhancement Opportunities

- Multiple subscription tiers (basic, premium, enterprise)
- Annual billing with discounts
- Usage-based billing for AI token consumption
- Automatic webhook retry with exponential backoff
- Integration with email service provider (SendGrid, Postmark) for reliable notifications
- Student subscription analytics dashboard
- Dunning management for failed payments

## References

- [Stripe Checkout Sessions API](https://stripe.com/docs/api/checkout/sessions)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Appwrite Database Queries](https://appwrite.io/docs/databases)
- [Constitution Principles](../../.specify/memory/constitution.md)
