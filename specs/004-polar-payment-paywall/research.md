# Technical Research: Polar SDK Integration

**Feature**: Polar Payment Gateway with AI Lesson Paywall
**Date**: 2025-11-13
**Purpose**: Document technical decisions and patterns for Polar SDK integration

## 1. Polar SDK Initialization

### Decision: Use Next.js SDK Adapter

**Installation**:
```bash
pnpm install @polar-sh/nextjs zod
```

**Environment Variables**:
```bash
# Required
POLAR_ACCESS_TOKEN=polar_at_xxx          # API authentication
POLAR_WEBHOOK_SECRET=whsec_xxx           # Webhook signature validation
POLAR_PRODUCT_ID=prod_xxx                # Student Plus product ID

# Optional
POLAR_SERVER=sandbox                     # or 'production'
TEST_USER_DOMAINS=scottishailessons.com  # Comma-separated
```

**Rationale**: Official SDK provides type safety, automatic retries, and webhook validation. Reduces boilerplate compared to raw API calls.

**Alternatives Considered**:
- Raw fetch() calls to Polar API → Rejected: No type safety, manual signature validation
- Stripe-style custom wrapper → Rejected: Reinventing wheel, SDK handles edge cases

### Server Configuration

**Sandbox vs Production**:
```typescript
// Development
const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: 'sandbox'
});

// Production
const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: 'production'
});
```

**Gotcha**: Sandbox and production use different product IDs. Must update `POLAR_PRODUCT_ID` when switching environments.

## 2. Webhook Security

### Decision: Signature Validation + Idempotency

**Signature Verification** (automatic with SDK):
```typescript
import { Webhooks } from '@polar-sh/nextjs';

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    // Signature already validated by SDK
    // Process payload safely
  }
});
```

**Idempotency Pattern**:
```typescript
async function processWebhook(event: PolarWebhookEvent) {
  const eventId = event.id;

  // Check if already processed
  const existing = await databases.getDocument('webhook_events', eventId);
  if (existing) {
    console.log(`[Webhook] Duplicate event ${eventId} - skipping`);
    return;
  }

  // Process event
  await syncSubscription(event.data);

  // Mark as processed
  await databases.createDocument('webhook_events', eventId, {
    eventType: event.type,
    processed: true,
    timestamp: new Date().toISOString()
  });
}
```

**Rationale**: Polar may retry webhooks on timeout/failure. Idempotency prevents duplicate charges or subscription state corruption.

### Webhook Event Types

**Monitored Events** (FR-014):
1. `checkout.completed` - Payment successful, activate subscription
2. `subscription.created` - New subscription started
3. `subscription.updated` - Plan change, payment method update
4. `subscription.cancelled` - User cancelled (access retained until period end)
5. `benefit.grant.created` - Benefit activated
6. `benefit.grant.revoked` - Benefit removed (on cancellation/expiry)

**Event Processing Strategy**:
```typescript
switch (event.type) {
  case 'checkout.completed':
  case 'subscription.created':
    await activateSubscription(event.data.subscription);
    break;

  case 'subscription.updated':
    await updateSubscription(event.data.subscription);
    break;

  case 'subscription.cancelled':
    await markCancelled(event.data.subscription);
    break;

  case 'benefit.grant.revoked':
    await revokeAccess(event.data);
    break;
}
```

## 3. Subscription State Machine

### Decision: Track Polar Status + Local Cache

**Status Values**:
- `active` - Paid, full access
- `cancelled` - Cancelled but access until period end
- `expired` - Period ended, no access
- `incomplete` - Payment failed (initial)
- `incomplete_expired` - Payment failed timeout

**State Transitions**:
```
[New User] → checkout.completed → active
active → subscription.cancelled → cancelled
cancelled → period_end → expired
active → payment_failed → incomplete
```

**Local Cache Pattern**:
```typescript
interface SubscriptionCache {
  status: 'active' | 'cancelled' | 'expired';
  expiresAt: Date;
  cachedAt: Date;
  cacheTTL: 3600; // 1 hour
}

async function getSubscriptionStatus(userId: string): Promise<SubscriptionCache> {
  // Check cache
  const cached = sessionCache.get(`sub:${userId}`);
  if (cached && Date.now() - cached.cachedAt < cached.cacheTTL * 1000) {
    return cached;
  }

  // Fetch from database
  const sub = await databases.getDocument('subscriptions', userId);
  if (!sub) throw new Error(`No subscription for user ${userId}`);

  // Update cache
  const status = {
    status: sub.status,
    expiresAt: new Date(sub.nextBillingDate),
    cachedAt: Date.now(),
    cacheTTL: 3600
  };
  sessionCache.set(`sub:${userId}`, status);

  return status;
}
```

**Rationale**: 1-hour cache reduces Appwrite queries (SC-007: 95% <500ms). Webhook updates invalidate cache immediately.

## 4. Customer ID Mapping

### Decision: Store Polar Customer ID in Subscription Record

**Mapping Pattern**:
```typescript
interface Subscription {
  userId: string;              // Internal user ID (Appwrite)
  polarCustomerId: string;     // Polar's customer ID
  polarSubscriptionId: string; // Polar's subscription ID
  // ... other fields
}

// On first checkout
async function createSubscription(userId: string, polarData: any) {
  await databases.createDocument('subscriptions', userId, {
    userId: userId,
    polarCustomerId: polarData.customer.id,
    polarSubscriptionId: polarData.id,
    status: 'active',
    createdAt: new Date().toISOString()
  });
}

// For customer portal
async function getPortalCustomerId(userId: string): Promise<string> {
  const sub = await databases.getDocument('subscriptions', userId);
  if (!sub) throw new Error(`No subscription for user ${userId}`);
  return sub.polarCustomerId;
}
```

**Rationale**: One-to-one mapping. User ID is primary key for fast lookups. Polar IDs enable customer portal redirects.

## 5. Error Handling Patterns

### Decision: Fast-Fail with Detailed Logging

**Polar API Errors**:
```typescript
try {
  const checkout = await polar.checkouts.create({
    productId: process.env.POLAR_PRODUCT_ID,
    customerEmail: user.email
  });
} catch (error) {
  if (error instanceof PolarAPIError) {
    console.error('[Polar] API Error:', {
      status: error.status,
      message: error.message,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    if (error.status === 429) {
      throw new Error('Payment system temporarily unavailable. Please try again in a moment.');
    } else if (error.status >= 500) {
      throw new Error('Payment system error. Please contact support if this persists.');
    } else {
      throw new Error(`Checkout failed: ${error.message}`);
    }
  }
  throw error; // Re-throw unknown errors
}
```

**Webhook Validation Failures**:
```typescript
export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    try {
      await processWebhook(payload);
    } catch (error) {
      console.error('[Webhook] Processing failed:', {
        eventId: payload.id,
        eventType: payload.type,
        error: error.message,
        stack: error.stack
      });

      // Log failure count
      await incrementWebhookFailureCount(payload.id);

      // Alert on 3 consecutive failures (FR-033)
      const failureCount = await getWebhookFailureCount();
      if (failureCount >= 3) {
        await alertAdmins('Webhook processing failing', failureCount);
      }

      throw error; // Return 500 to trigger Polar retry
    }
  }
});
```

**Rationale**: Fast-fail prevents silent data corruption. Detailed logs enable debugging. Graceful user messages prevent confusion.

## 6. Testing Strategy

### Decision: Sandbox Mode + Playwright E2E

**Test Card Numbers** (Polar sandbox):
```
4242 4242 4242 4242  - Success
4000 0000 0000 0002  - Card declined
4000 0000 0000 9995  - Insufficient funds
```

**Webhook Testing**:
```bash
# Use Polar CLI to send test events
polar webhook test \
  --event checkout.completed \
  --url http://localhost:3000/api/polar/webhook
```

**Playwright Test Pattern**:
```typescript
test('free user sees paywall', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard');
  await page.getByText('Start Lesson').click();

  // Should see paywall modal
  await expect(page.getByRole('dialog')).toContainText('Student Plus');
  await expect(page.getByRole('dialog')).toContainText('$5.99/month');
  await expect(page.getByText('Upgrade Now')).toBeVisible();
});

test('test user bypasses paywall', async ({ page, context }) => {
  // Login as test@scottishailessons.com
  await loginAsTestUser(page);

  await page.goto('http://localhost:3000/dashboard');
  await page.getByText('Start Lesson').click();

  // Should NOT see paywall - lesson starts immediately
  await expect(page).not.toHaveURL(/checkout/);
  await expect(page).toHaveURL(/session/);
});
```

**Rationale**: Sandbox mode prevents real charges. Playwright catches UX issues. Webhook CLI simulates production events safely.

## 7. Performance Optimizations

### Decision: Cache + Database Indexes

**Cache Strategy**:
- Session-level cache (1-hour TTL)
- Invalidate on webhook events
- Force refresh on 401 errors

**Database Indexes** (Appwrite):
```typescript
// subscriptions collection
indexes: [
  { key: 'userId', type: 'unique' },
  { key: 'polarSubscriptionId', type: 'unique' },
  { key: 'status', type: 'key' },
  { key: 'nextBillingDate', type: 'key' }
]

// webhook_events collection
indexes: [
  { key: 'eventId', type: 'unique' },
  { key: 'processedAt', type: 'key' }
]
```

**Query Optimization**:
```typescript
// Fast: indexed userId lookup
const sub = await databases.getDocument('subscriptions', userId);

// Slow: avoid full table scans
const activeSubs = await databases.listDocuments(
  'subscriptions',
  [Query.equal('status', 'active')] // Uses status index
);
```

**Rationale**: Indexed lookups meet <500ms target (SC-007). Cache reduces database load for high-traffic dashboard.

## 8. Security Considerations

### Test User Access Control

**Pattern**:
```typescript
function isTestUser(email: string): boolean {
  const testDomains = process.env.TEST_USER_DOMAINS?.split(',') || [];
  return testDomains.some(domain => email.endsWith(`@${domain.trim()}`));
}

async function checkAccess(userId: string): Promise<boolean> {
  const user = await databases.getDocument('students', userId);

  // Test users always have access
  if (isTestUser(user.email)) {
    console.log(`[Access] Test user ${user.email} granted access`);
    return true;
  }

  // Check subscription
  const sub = await getSubscriptionStatus(userId);
  if (sub.status !== 'active') {
    throw new Error(`Access denied: subscription ${sub.status}`);
  }

  return true;
}
```

**Security**: Test domains configured via environment variables (not UI). Prevents production users from gaining free access.

## Key Takeaways

1. **Use Polar SDK** - Type safety, webhook validation, retries
2. **Idempotency** - Process each webhook once, use event ID as dedup key
3. **Cache Aggressively** - 1-hour TTL, invalidate on webhooks
4. **Fast-Fail** - No silent fallbacks, detailed error logging
5. **Test Thoroughly** - Sandbox mode, Playwright E2E, webhook CLI
6. **Index Everything** - userId, polarSubscriptionId, status
7. **Monitor Failures** - Alert on 3 consecutive webhook failures
