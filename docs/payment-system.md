# Payment System Documentation

**Project**: Scottish AI Lessons
**Last Updated**: 2025-11-18
**Status**: Production

## Overview

The Scottish AI Lessons application uses Stripe for subscription payments to gate access to AI-powered teaching features. This document covers the complete payment flow, webhook handling, and subscription management.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │  Next.js    │     │   Stripe    │     │  Appwrite   │
│   (User)    │────▶│  API Routes │────▶│   API       │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           ▲                   │                    ▲
                           │                   │                    │
                           └───────────────────┴────────────────────┘
                                     Webhooks (async)
```

### Key Design Decisions

1. **Stripe Checkout**: Use hosted checkout page for PCI compliance
2. **Webhook-Driven**: Subscription status updated via webhooks (not polling)
3. **Immediate Revocation**: Payment failures immediately revoke access (no grace period)
4. **No Caching**: Subscription status always fetched fresh (security-critical)
5. **Fast Fail**: All payment operations throw on failure (no silent errors)

---

## Quick Start: Test User Bypass

### What is a Test User?

A **test user** is a special account that can access all AI features **without paying**. This is essential for:

- **Development**: Developers need full access while building features
- **QA Testing**: Testers need to verify functionality without real payments
- **Demos**: Sales/support staff show features to prospects
- **Support**: Customer support debug issues in user accounts

### How Does the Bypass Work?

Every time a user tries to access AI features (start lesson, use tutor), the system checks:

```typescript
// In /api/stripe/subscription-status/route.ts (line 37)
const hasAccess = user.testUserFlag === true || user.subscriptionStatus === 'active';
```

**Translation**: A user can access AI features if:
1. Their `testUserFlag` is `true` (test user), OR
2. Their `subscriptionStatus` is `'active'` (paid subscriber)

If either condition is true, they're allowed in. No payment popup, no redirect.

### What Does the Flagging Script Do?

The script at `assistant-ui-frontend/scripts/flag-test-users.ts` does ONE thing: it sets `testUserFlag = true` on specific user accounts in the database.

**Step-by-step breakdown:**

1. **Connects to Appwrite** using your API key
2. **Looks up users** by their email addresses (from a hardcoded list)
3. **Updates each user's document** to set `testUserFlag: true`
4. **Logs everything** so you can see what happened

**Before running the script:**
```
students collection:
{
  email: "test@scottishailessons.com",
  testUserFlag: false  ← User is blocked from AI features
}
```

**After running the script:**
```
students collection:
{
  email: "test@scottishailessons.com",
  testUserFlag: true   ← User can now access everything!
}
```

### Quick Start Steps

#### Step 1: Create a Test User Account

First, create the account in your app:

1. Open `http://localhost:3000`
2. Click **Sign Up** or **Register**
3. Use one of these emails (they're in the script's list):
   - `test@scottishailessons.com`
   - `test2@scottishailessons.com`
   - `demo@scottishailessons.com`
   - `admin@scottishailessons.com`
   - Or any email ending with `@testuser.com`
4. Complete registration with any password

#### Step 2: Run the Flagging Script

```bash
# Navigate to the frontend directory
cd assistant-ui-frontend

# Run the script (use tsx, not ts-node - better ESM support)
npx tsx scripts/flag-test-users.ts
```

**Expected output:**
```
═══════════════════════════════════════════════════
    Test User Auto-Flagging Script (Phase 4)
═══════════════════════════════════════════════════

Step 1: Validating environment variables...
✅ Environment variables validated
   Endpoint: https://cloud.appwrite.io/v1
   Project ID: your-project-id
   Database ID: default

Step 2: Initializing Appwrite client...
✅ Appwrite client initialized

Step 3: Flagging test users from explicit list...
   Processing: test@scottishailessons.com
   📝 Audit: Flagged test@scottishailessons.com at 2025-11-18T10:30:00.000Z
   ✅ Flagged: test@scottishailessons.com (ID: 68d28c19...)

═══════════════════════════════════════════════════
                   Summary
═══════════════════════════════════════════════════

   Total explicit emails: 4
   Test domains: @testuser.com
   ✅ Flagged: 1
   ℹ️  Already flagged: 0
   ⚠️  Not found: 3
   ❌ Errors: 0

✅ Test user flagging completed successfully!
```

**Common output meanings:**
- **✅ Flagged**: User was found and `testUserFlag` was set to `true`
- **ℹ️ Already flagged**: User already has `testUserFlag: true`, no change needed
- **⚠️ Not found**: Email not found in database (user hasn't registered yet)
- **❌ Errors**: Something went wrong (check error message)

#### Step 3: Verify It Worked

**Option A - Check via API:**
```bash
# Login as the test user first, then call the API
curl http://localhost:3000/api/stripe/subscription-status \
  -H "Cookie: your-session-cookie"
```

Expected response:
```json
{
  "status": "inactive",
  "hasAccess": true,       ← This should be TRUE
  "testUserFlag": true,    ← This should be TRUE
  "stripeCustomerId": null,
  "stripeSubscriptionId": null
}
```

**Option B - Check in Appwrite Console:**
1. Go to **Appwrite Console** → **Databases** → `default`
2. Open the **students** collection
3. Find your test user document
4. Verify `testUserFlag: true`

**Option C - Test in the App:**
1. Login as the test user
2. Go to Dashboard
3. Click **Start Lesson** on any lesson
4. You should go directly to the AI tutor (no paywall!)

### Alternative: Flag Manually in Appwrite Console

If you prefer not to use the script:

1. Go to **Appwrite Console** → **Databases** → `default` → **students**
2. Find the user document by email
3. Click **Edit**
4. Set `testUserFlag` to `true`
5. Click **Save**

### Supported Test User Emails

The script flags these emails automatically:

**Explicit list:**
- `test@scottishailessons.com`
- `test2@scottishailessons.com`
- `demo@scottishailessons.com`
- `admin@scottishailessons.com`

**Domain pattern:**
- Any email ending with `@testuser.com` (e.g., `john@testuser.com`, `qa1@testuser.com`)

### Adding New Test Users

To add more test users to the script, edit `assistant-ui-frontend/scripts/flag-test-users.ts`:

```typescript
// Line 21-26: Add emails here
const TEST_USER_EMAILS = [
  'test@scottishailessons.com',
  'test2@scottishailessons.com',
  'demo@scottishailessons.com',
  'admin@scottishailessons.com',
  'newtestuser@example.com',  // ← Add new email here
];
```

### Troubleshooting

#### "APPWRITE_API_KEY is not configured"
- Add `APPWRITE_API_KEY` to your `.env.local` file
- Get the key from Appwrite Console → Project Settings → API Keys
- The key needs `databases.write` scope

#### "Not found" for all users
- The users haven't registered yet
- Create accounts first (Step 1), then run the script

#### Still seeing paywall after flagging
1. Clear browser cookies and re-login
2. Verify `testUserFlag: true` in Appwrite Console
3. Check the API returns `hasAccess: true`

#### Script shows "Errors"
- Check the error message for details
- Common issues: network problems, wrong API key, missing collection

### Security Note

⚠️ **Important**: Test users bypass payment entirely. In production:
- Keep the test user list small and controlled
- Use obvious test emails (not real customer emails)
- Regularly audit who has `testUserFlag: true`
- Never flag a real customer account

---

## Subscription Flow

### 1. Subscribe (New User)

```
User clicks Subscribe → Checkout Session created → Redirect to Stripe
→ Payment success → Webhook received → Database updated → Access granted
```

### 2. Payment Failed

```
Stripe detects failure → Webhook received → Status set to 'payment_failed'
→ Access immediately revoked → User sees banner to update payment method
```

### 3. Subscription Cancelled

```
User cancels in Portal → Webhook received → Status set to 'cancelled'
→ Access immediately revoked
```

### 4. Payment Recovery

```
User updates payment in Portal → Stripe retries payment → Success webhook
→ Status restored to 'active' → Access granted
```

## Environment Configuration

### Required Variables

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...           # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Client-side key
STRIPE_WEBHOOK_SECRET=whsec_...         # Webhook signature secret
STRIPE_PRICE_ID=price_...               # Monthly subscription price ID
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Getting Stripe Keys

1. **Dashboard Keys**: Stripe Dashboard → Developers → API keys
2. **Webhook Secret**: Run `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. **Price ID**: Stripe Dashboard → Products → Select product → Copy price ID

## API Routes

### Checkout Session

**POST** `/api/stripe/checkout`

Creates a Stripe Checkout Session for subscription purchase.

```typescript
// Request (no body needed - userId from session)
// Response
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Subscription Status

**GET** `/api/stripe/subscription-status`

Returns current user's subscription status.

```typescript
// Response
{
  "status": "active" | "inactive" | "payment_failed" | "cancelled",
  "hasAccess": true,
  "testUserFlag": false,
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  "subscriptionExpiresAt": null,
  "subscription": {
    "planType": "monthly_ai_access",
    "billingCycle": "monthly",
    "paymentStatus": "current",
    "nextBillingDate": "2025-12-18T00:00:00Z",
    "lastPaymentDate": "2025-11-18T00:00:00Z"
  }
}
```

### Customer Portal

**POST** `/api/stripe/portal`

Creates a Stripe Customer Portal session for subscription management.

```typescript
// Request (optional)
{
  "returnUrl": "http://localhost:3000/account"
}

// Response
{
  "url": "https://billing.stripe.com/...",
  "sessionId": "bps_..."
}
```

### Webhook Handler

**POST** `/api/stripe/webhook`

Receives and processes Stripe webhook events.

**Handled Events**:
- `checkout.session.completed` - New subscription activated
- `invoice.payment_failed` - Payment failed, revoke access
- `customer.subscription.updated` - Plan changes, renewals
- `customer.subscription.deleted` - Subscription cancelled

## Webhook Processing

### Signature Verification

**CRITICAL**: Never skip signature verification.

```typescript
import { verifyWebhookSignature } from '@/lib/stripe-helpers';

export async function POST(request: Request) {
  const body = await request.text(); // Raw body
  const signature = headers().get('stripe-signature');

  const event = verifyWebhookSignature(body, signature);
  // Signature verified ✅
}
```

### Idempotency

Webhooks are processed exactly once using the `stripe_webhook_events` collection:

1. Check if `event.id` exists → Skip if already processed
2. Create record with `processingStatus: 'processing'`
3. Process event
4. Update to `processingStatus: 'completed'`

### Error Queue

Failed webhooks are queued for manual admin intervention:

```typescript
// webhook_error_queue collection
{
  webhookEventId: "evt_...",
  errorMessage: "Database connection failed",
  retryCount: 0,
  resolutionStatus: "pending_admin_review"
}
```

## Database Schema

### Students Collection (Extended)

```typescript
{
  userId: string,                    // Links to Appwrite account
  subscriptionStatus: 'inactive' | 'active' | 'payment_failed' | 'cancelled',
  stripeCustomerId: string | null,   // "cus_..."
  stripeSubscriptionId: string | null, // "sub_..."
  testUserFlag: boolean,             // Bypass subscription check
  subscriptionExpiresAt: datetime | null
}
```

### Subscriptions Collection

```typescript
{
  userId: string,
  stripeSubscriptionId: string,
  planType: 'monthly_ai_access',
  status: 'active' | 'past_due' | 'cancelled',
  startDate: datetime,
  endDate: datetime | null,
  billingCycle: 'monthly',
  paymentStatus: 'current' | 'past_due' | 'failed',
  lastPaymentDate: datetime,
  nextBillingDate: datetime
}
```

### Audit Logs Collection

```typescript
{
  userId: string,
  subscriptionId: string,
  timestamp: datetime,
  previousStatus: string,
  newStatus: string,
  triggerSource: 'stripe_webhook' | 'admin_action' | 'test_user_setup',
  eventId: string | null,
  adminUserId: string | null,
  adminNotes: string | null
}
```

## Frontend Components

### useSubscription Hook

```typescript
import { useSubscription } from '@/hooks/useSubscription';

function MyComponent() {
  const {
    status,           // Current status
    hasAccess,        // Can use AI features
    testUserFlag,     // Is test user
    isLoading,
    error,
    refetch           // Force refresh
  } = useSubscription();

  if (!hasAccess) {
    return <PaywallModal />;
  }
}
```

### SubscriptionStatusCard

Displays subscription details on the account page.

```typescript
import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard';

<SubscriptionStatusCard />
```

### ManageSubscriptionButton

Opens Stripe Customer Portal.

```typescript
import { ManageSubscriptionButton } from '@/components/subscription/ManageSubscriptionButton';

<ManageSubscriptionButton disabled={!hasAccess} />
```

### SubscriptionPaywallModal

Shows when non-subscribed user tries to access AI features.

```typescript
import { SubscriptionPaywallModal } from '@/components/dashboard/SubscriptionPaywallModal';

<SubscriptionPaywallModal
  isOpen={showPaywall}
  onClose={() => setShowPaywall(false)}
  priceInfo={priceData}
/>
```

## Access Control

### hasAccess Calculation

```typescript
// A user has access if:
const hasAccess = testUserFlag === true || subscriptionStatus === 'active';
```

### Integration Points

1. **Dashboard**: Check before starting lesson (`handleStartLesson`)
2. **Chat Assistant**: Check at component mount
3. **Account Page**: Display subscription management

## Testing

### Local Development

1. Start Stripe CLI webhook forwarding:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

2. Copy webhook secret to `.env.local`

3. Test subscription flow with test card:
   - **Card**: 4242 4242 4242 4242
   - **Expiry**: Any future date
   - **CVC**: Any 3 digits

### Test Payment Failures

```bash
# Trigger payment failed event
stripe trigger invoice.payment_failed
```

### Test Subscription Events

```bash
# List available events
stripe trigger --help

# Trigger specific event
stripe trigger customer.subscription.updated
```

### E2E Tests

```typescript
// e2e/tests/stripe/account-page.spec.ts
test('should display subscription status on account page', async ({ page }) => {
  await page.goto('/account');
  await expect(page.locator('[data-testid="subscription-status-card"]'))
    .toBeVisible();
});
```

## Security Considerations

### Webhook Security

- **Signature Verification**: Always verify Stripe signature
- **Idempotency**: Process each event exactly once
- **Error Isolation**: Failed webhooks don't block future events

### API Security

- **Authentication**: All payment APIs require authenticated session
- **No Direct Stripe Access**: Clients never call Stripe directly
- **Sensitive Data**: Stripe keys never exposed to client

### PCI Compliance

- Use Stripe Checkout (hosted payment page)
- Never handle raw card numbers
- Stripe handles all PCI requirements

## Troubleshooting

### Common Issues

#### "Webhook signature verification failed"
- **Cause**: Wrong webhook secret or body parsing
- **Solution**: Use `request.text()` not `request.json()`

#### "No customer ID for user"
- **Cause**: User hasn't completed checkout yet
- **Solution**: Guide user to subscribe first

#### "Access revoked but should have subscription"
- **Cause**: Webhook not received or processed
- **Solution**: Check `stripe_webhook_events` collection

#### "Test user can't access AI features"
- **Cause**: `testUserFlag` not set
- **Solution**: Run flag-test-users script

### Debug Logging

```typescript
console.log('[Webhook] Event received:', {
  type: event.type,
  id: event.id,
  customerId: event.data.object.customer
});
```

### Stripe Dashboard

- **Events**: Stripe Dashboard → Developers → Events
- **Webhooks**: Stripe Dashboard → Developers → Webhooks
- **Customers**: Stripe Dashboard → Customers

## Production Deployment

### Checklist

- [ ] Switch to live Stripe keys (sk_live_*, pk_live_*)
- [ ] Create live subscription product
- [ ] Configure production webhook endpoint
- [ ] Update `.env.production` with live keys
- [ ] Test with real payment (small amount, then refund)
- [ ] Monitor webhook success rate

### Webhook Endpoint

Configure in Stripe Dashboard:
- **URL**: `https://yourapp.com/api/stripe/webhook`
- **Events**:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

## Related Documentation

- [Authentication System](./authentication-system.md)
- [Stripe Subscription Paywall Spec](../specs/004-stripe-subscription-paywall/spec.md)
- [Data Model](../specs/004-stripe-subscription-paywall/data-model.md)
- [Quickstart Guide](../specs/004-stripe-subscription-paywall/quickstart.md)
