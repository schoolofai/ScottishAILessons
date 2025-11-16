# API Contract: Create Customer Portal Session

**Endpoint**: `POST /api/stripe/portal`
**Purpose**: Create a Stripe Customer Portal session for subscription management (update payment method, cancel subscription, view invoices)
**Authentication**: Required (Appwrite session)

## Request

### Headers

```
Content-Type: application/json
Cookie: a_session_PROJECTID=<session_token>
```

### Body

```typescript
interface CreatePortalRequest {
  // No body parameters required - user info extracted from session
}
```

**Validation Rules**:
- User MUST be authenticated (valid Appwrite session)
- User MUST have an active Stripe customer ID (stripeCustomerId !== null)

## Response

### Success Response (200 OK)

```typescript
interface CreatePortalResponse {
  success: true;
  url: string; // Redirect URL to Stripe-hosted customer portal
}
```

**Example**:
```json
{
  "success": true,
  "url": "https://billing.stripe.com/p/session/live_YWNjdF8xT1..."
}
```

### Error Responses

#### 401 Unauthorized

```json
{
  "error": "Authentication failed: No valid session found"
}
```

**Trigger**: No Appwrite session cookie present or invalid session

#### 403 Forbidden

```json
{
  "error": "No active subscription found. Customer portal is only available to subscribers."
}
```

**Trigger**: User does not have a Stripe customer ID (never subscribed)

#### 500 Internal Server Error

```json
{
  "error": "Failed to create customer portal session: <error_details>"
}
```

**Trigger**: Stripe API error, database query failure, or configuration issue

## Business Logic

### Flow

```
1. Verify Appwrite session → Get user ID
2. Fetch user record from Appwrite database
3. Check user.stripeCustomerId !== null
   - If null → Return 403 (user has never subscribed)
4. Create Stripe Customer Portal Session with:
   - customer: user.stripeCustomerId
   - return_url: /dashboard (where user is redirected after portal actions)
5. Return portal URL to frontend
6. Frontend redirects user to Stripe portal
```

### Implementation

```typescript
import { createSessionClient } from '@/lib/appwrite-server';
import { databases } from '@/lib/appwrite-config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

export async function POST(request: Request) {
  try {
    // 1. Verify session and get user
    const { account } = await createSessionClient(request);
    const user = await account.get();

    // 2. Fetch user record with Stripe customer ID
    const userDoc = await databases.getDocument(
      DATABASE_ID,
      'users',
      user.$id
    );

    // 3. Validate customer ID exists
    if (!userDoc.stripeCustomerId) {
      throw new Error('No active subscription found. Customer portal is only available to subscribers.');
    }

    // 4. Create Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userDoc.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    // 5. Return portal URL
    return Response.json({
      success: true,
      url: portalSession.url
    });

  } catch (error) {
    console.error('[Customer Portal] Error:', error);

    if (error.message.includes('No active subscription')) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    throw new Error(`Failed to create customer portal session: ${error.message}`);
  }
}
```

### Stripe Customer Portal Configuration

The Customer Portal is configured in the Stripe Dashboard and provides these capabilities:

| Feature | Description | Configuration |
|---------|-------------|---------------|
| Update Payment Method | Add/remove cards, change default payment method | Enabled by default |
| Cancel Subscription | Immediate or end-of-period cancellation | Admin configures cancellation flow |
| View Invoices | Download past invoices and receipts | Enabled by default |
| Update Billing Info | Change billing address, email | Enabled by default |
| Subscription History | View all subscription events | Enabled by default |

**Configuration Steps** (in Stripe Dashboard):
1. Go to Settings → Customer Portal
2. Configure branding (logo, colors, business name)
3. Set cancellation policy:
   - Immediate cancellation (revoke access immediately)
   - End-of-period cancellation (access until billing period ends)
4. Configure proration behavior for plan changes

**Recommended Settings for MVP**:
- Immediate cancellation → Triggers `customer.subscription.deleted` webhook
- Allow payment method updates → Critical for failed payment recovery
- Show subscription history → Transparency for users

## Frontend Integration

### React Component

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ManageSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const { url } = await response.json();

      // Redirect to Stripe Customer Portal
      window.location.href = url;

    } catch (error) {
      console.error('Failed to open customer portal:', error);
      // Show error notification to user
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleManageSubscription}
      disabled={isLoading}
      variant="outline"
    >
      {isLoading ? 'Loading...' : 'Manage Subscription'}
    </Button>
  );
}
```

### Conditional Rendering

```typescript
function SubscriptionSettings() {
  const { status } = useSubscription();

  // Only show "Manage Subscription" button if user has Stripe customer ID
  const hasStripeCustomer = status?.stripeCustomerId !== null;

  return (
    <div>
      <h2>Subscription</h2>

      {hasStripeCustomer ? (
        <>
          <p>Status: {status.status}</p>
          <ManageSubscriptionButton />
        </>
      ) : (
        <p>You don't have an active subscription.</p>
      )}
    </div>
  );
}
```

## Security Considerations

- **Session Validation**: MUST verify Appwrite session before creating portal session
- **Customer ID Verification**: MUST confirm user owns the Stripe customer ID
- **Return URL**: MUST use HTTPS in production (Stripe requirement)
- **Portal Configuration**: Configure cancellation policy in Stripe Dashboard to match business requirements

## User Experience Flow

```
User Dashboard → Clicks "Manage Subscription"
  ↓
API creates portal session
  ↓
User redirected to Stripe portal (billing.stripe.com)
  ↓
User updates payment method / cancels subscription
  ↓
User clicks "Return to Dashboard"
  ↓
Redirected back to /dashboard
  ↓
Webhook events update subscription status in background
```

**Timing Note**: After user makes changes in portal and returns to dashboard, there may be a 1-5 second delay before webhook updates are reflected in the UI. Frontend should show a success message and refetch subscription status.

## Webhook Integration

Actions performed in the Customer Portal trigger webhooks:

| Portal Action | Webhook Event | Backend Action |
|---------------|---------------|----------------|
| Update payment method | `customer.updated` | No action required (Stripe handles it) |
| Cancel subscription (immediate) | `customer.subscription.deleted` | Revoke access, update status to 'cancelled' |
| Cancel subscription (end of period) | `customer.subscription.updated` (cancel_at_period_end: true) | Show "Cancellation pending" in UI |
| Change billing info | `customer.updated` | No action required |

**Important**: The portal handles all payment processing and subscription management. Backend only needs to listen for webhook events to update access control.

## Test Cases

| Scenario | Expected Response | HTTP Status |
|----------|-------------------|-------------|
| Authenticated user with subscription | Return portal URL | 200 |
| Authenticated user without subscription (never subscribed) | Error: No active subscription | 403 |
| Authenticated user with cancelled subscription | Return portal URL (can view history) | 200 |
| Unauthenticated user | Error: Authentication failed | 401 |
| Invalid Stripe API key | Error: Failed to create session | 500 |
| Test user (@testuser.com) with no Stripe customer | Error: No active subscription | 403 |

## Environment Configuration

### Development (.env.local)
```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (.env.production)
```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## References

- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Stripe Billing Portal Sessions API](https://stripe.com/docs/api/customer_portal/sessions/create)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
