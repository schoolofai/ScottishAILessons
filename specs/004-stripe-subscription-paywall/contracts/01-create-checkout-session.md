# API Contract: Create Checkout Session

**Endpoint**: `POST /api/stripe/checkout`
**Purpose**: Create a Stripe Checkout Session for subscription purchase
**Authentication**: Required (Appwrite session)

## Request

### Headers

```
Content-Type: application/json
Cookie: a_session_PROJECTID=<session_token>
```

### Body

```typescript
interface CreateCheckoutRequest {
  // No body parameters required - user info extracted from session
}
```

**Validation Rules**:
- User MUST be authenticated (valid Appwrite session)
- User MUST NOT already have an active subscription (subscriptionStatus !== 'active')

## Response

### Success Response (200 OK)

```typescript
interface CreateCheckoutResponse {
  success: true;
  sessionId: string; // Stripe checkout session ID (format: cs_test_... or cs_live_...)
  url: string; // Redirect URL to Stripe-hosted checkout page
}
```

**Example**:
```json
{
  "success": true,
  "sessionId": "cs_test_a1B2c3D4e5F6g7H8i9J0k1L2",
  "url": "https://checkout.stripe.com/pay/cs_test_a1B2c3D4e5F6g7H8i9J0k1L2"
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

#### 409 Conflict

```json
{
  "error": "User already has an active subscription"
}
```

**Trigger**: User's `subscriptionStatus` is already `'active'`

#### 500 Internal Server Error

```json
{
  "error": "Failed to create checkout session: <error_details>"
}
```

**Trigger**: Stripe API error, database query failure, or configuration issue

## Business Logic

### Flow

```
1. Verify Appwrite session → Get user ID
2. Fetch user record from Appwrite database
3. Check user.subscriptionStatus !== 'active'
4. Create Stripe Checkout Session with:
   - mode: 'subscription'
   - line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]
   - customer_email: user.email
   - client_reference_id: user.$id
   - success_url: /dashboard?session_id={CHECKOUT_SESSION_ID}
   - cancel_url: /dashboard?canceled=true
   - metadata: { userId: user.$id, subscriptionType: 'monthly_ai_access' }
5. Return session ID and URL to frontend
6. Frontend redirects user to Stripe checkout page
```

### Stripe Configuration

```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer_email: user.email,
  client_reference_id: user.$id, // Link to Appwrite user
  line_items: [{
    price: process.env.STRIPE_PRICE_ID!, // Environment-specific price ID
    quantity: 1,
  }],
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
  metadata: {
    userId: user.$id,
    subscriptionType: 'monthly_ai_access',
    environment: process.env.NODE_ENV
  },
  allow_promotion_codes: true, // Optional: Enable promo codes
  billing_address_collection: 'required'
});
```

## Security Considerations

- **Session Validation**: MUST verify Appwrite session before creating checkout session
- **User Verification**: MUST check existing subscription status to prevent duplicate subscriptions
- **Environment Variables**: Stripe keys and price IDs MUST be stored in environment variables
- **HTTPS Required**: Stripe requires HTTPS in production
- **Idempotency**: Stripe checkout sessions have built-in idempotency (30-day expiry)

## Frontend Integration

```typescript
// Example frontend usage
async function handleSubscribe() {
  try {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      credentials: 'include', // Include session cookie
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const { url } = await response.json();

    // Redirect to Stripe checkout
    window.location.href = url;
  } catch (error) {
    console.error('Checkout failed:', error);
    // Show error notification to user
  }
}
```

## Rate Limiting

**Recommended**: 5 requests per user per minute to prevent abuse

**Implementation** (future enhancement):
```typescript
const rateLimitKey = `checkout:${user.$id}`;
const requestCount = await redis.incr(rateLimitKey);
if (requestCount === 1) {
  await redis.expire(rateLimitKey, 60); // 1 minute TTL
}
if (requestCount > 5) {
  throw new Error('Rate limit exceeded. Please try again later.');
}
```

## Test Cases

| Scenario | Expected Response | HTTP Status |
|----------|-------------------|-------------|
| Authenticated user with no subscription | Return checkout URL | 200 |
| Authenticated user with active subscription | Error: Already subscribed | 409 |
| Unauthenticated user | Error: Authentication failed | 401 |
| Invalid Stripe API key | Error: Failed to create session | 500 |
| Test user (@testuser.com) | Return checkout URL (test mode) | 200 |

## Environment Configuration

### Development (.env.local)
```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (.env.production)
```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_ID=price_live_...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## References

- [Stripe Checkout Sessions API](https://stripe.com/docs/api/checkout/sessions/create)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Appwrite Authentication](https://appwrite.io/docs/authentication)
