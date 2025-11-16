# Manual Testing Guide: Stripe Subscription Flow
**Feature**: 004-stripe-subscription-paywall
**Date**: 2025-11-16
**Purpose**: Step-by-step manual testing instructions for subscription purchase and webhook verification

---

## Prerequisites

Before testing, ensure:
- ✅ Frontend running on `http://localhost:3000`
- ✅ Backend running on `http://localhost:2024`
- ✅ Stripe CLI installed (`stripe --version` confirms)
- ✅ `.env.local` has all Stripe keys configured
- ✅ Test user account: `test@scottishailessons.com` / `red12345`

---

## Test 1: Paywall Modal Display

**Purpose**: Verify dynamic pricing and instant modal display

### Steps:
1. Navigate to `http://localhost:3000`
2. Login with test credentials
3. Wait for dashboard to fully load
4. **Check console**: Should see `[Dashboard] Subscription price prefetched: £4.99`
5. Click any lesson "Start" button

### Expected Results:
- ✅ Modal appears **instantly** (no loading flicker)
- ✅ Price shows **£4.99/month** (dynamic from Stripe)
- ✅ Four benefit bullets displayed
- ✅ "Subscribe Now" button enabled
- ✅ "Cancel anytime" text visible
- ✅ "Powered by Stripe" footer present

### ✅ **VERIFIED 2025-11-16**:
- Prefetching pattern working perfectly
- Zero perceived delay on modal open
- Dynamic pricing from API endpoint functional

---

## Test 2: Stripe Checkout Redirect

**Purpose**: Verify checkout session creation and redirect

### Steps:
1. From paywall modal, click "Subscribe Now"
2. Browser should redirect to `checkout.stripe.com`

### Expected Results:
- ✅ Redirect happens within 1-2 seconds
- ✅ Stripe checkout page loads with correct product
- ✅ Price shows **£4.99 per month**
- ✅ Product name: "Student Plus"
- ✅ Description: "Get all premium AI tutoring features"
- ✅ "TEST MODE" badge visible (orange)

### ✅ **VERIFIED 2025-11-16**:
- Checkout session API working correctly
- Price passed from backend to Stripe matches
- Professional checkout page displayed

---

## Test 3: Complete Purchase Flow (WITH WEBHOOK TESTING)

**Purpose**: Verify end-to-end payment processing and webhook delivery

### Setup - Start Webhook Listener:

```bash
# Terminal 1: Start webhook forwarding
cd assistant-ui-frontend
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret that appears:
# "Ready! Your webhook signing secret is whsec_..."
```

**IMPORTANT**: Add the webhook secret to `.env.local`:

```bash
# Update .env.local
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_FROM_STRIPE_CLI
```

Then **restart the Next.js server**:

```bash
# Terminal 2: Restart frontend (press Ctrl+C first)
npm run dev
```

### Payment Steps:

1. Fill in Stripe checkout form:
   - **Email**: `test@scottishailessons.com`
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: `12/34`
   - **CVC**: `123`
   - **Name**: `Test User`
   - **Country**: United Kingdom
   - **Postal code**: Any valid UK postcode (e.g., `SW1A 1AA`)

2. Click "Pay and subscribe"

3. **Watch the Stripe CLI terminal** for webhook events

### Expected Results:

#### In Stripe CLI Terminal:
```
✅ 2025-11-16 16:20:15   --> checkout.session.completed [evt_xxx]
✅ 2025-11-16 16:20:15   <--  [200] POST http://localhost:3000/api/stripe/webhook [evt_xxx]
```

#### In Browser:
- ✅ Redirects back to `http://localhost:3000/dashboard?session_id=cs_test_...`
- ✅ Dashboard loads successfully
- ✅ No paywall appears when clicking "Start Lesson"
- ✅ Lesson starts immediately

#### In Appwrite Console (`https://cloud.appwrite.io`):

**Check Users Collection**:
1. Navigate to your database → Users collection
2. Find user with email `test@scottishailessons.com`
3. Verify fields updated:
   - `subscriptionStatus`: `'active'`
   - `stripeCustomerId`: `'cus_...'` (customer ID)
   - `stripeSubscriptionId`: `'sub_...'` (subscription ID)
   - `subscriptionStartDate`: Recent ISO timestamp
   - `subscriptionCurrentPeriodEnd`: One month from start

**Check Subscriptions Collection**:
1. Navigate to Subscriptions collection
2. Find record with matching `userId`
3. Verify:
   - `status`: `'active'`
   - `stripeSubscriptionId` matches user record
   - `currentPeriodStart` and `currentPeriodEnd` populated

**Check StripeWebhookEvents Collection**:
1. Navigate to StripeWebhookEvents collection
2. Find most recent `checkout.session.completed` event
3. Verify:
   - `processingStatus`: `'completed'`
   - `processedAt`: Recent timestamp
   - `errorMessage`: `null`

**Check SubscriptionAuditLogs Collection**:
1. Navigate to SubscriptionAuditLogs collection
2. Find entry with matching `userId`
3. Verify:
   - `eventType`: `'subscription_activated'`
   - `previousStatus`: `'inactive'`
   - `newStatus`: `'active'`

### ❌ **NOT YET VERIFIED** (Requires Webhook Testing):
- Webhook delivery and processing
- Database updates via webhook handler
- Subscription activation

---

## Test 4: Access Control Enforcement

**Purpose**: Verify subscribed users have unrestricted access

### Steps:
1. After successful purchase (from Test 3)
2. Navigate to dashboard
3. Click "Start" on any lesson
4. Verify no paywall appears
5. Lesson should start immediately

### Expected Results:
- ✅ No paywall modal
- ✅ Direct access to SessionChatAssistant
- ✅ Console shows: `✅ [Subscription] User has access`

---

## Test 5: Subscription Cancellation (Manual via Stripe Dashboard)

**Purpose**: Verify access revocation when subscription cancelled

### Steps:
1. Go to [Stripe Dashboard → Customers](https://dashboard.stripe.com/test/customers)
2. Find customer by email: `test@scottishailessons.com`
3. Click on customer name
4. Under "Subscriptions", click the subscription
5. Click "Cancel subscription" → "Cancel immediately"
6. Return to your app
7. Refresh dashboard page
8. Try to start a lesson

### Expected Results (IF Webhooks Working):
- ✅ Webhook `customer.subscription.deleted` received
- ✅ Stripe CLI shows successful 200 response
- ✅ User `subscriptionStatus` updated to `'cancelled'`
- ✅ Paywall appears when trying to start lesson

### ✅ **VERIFIED 2025-11-16** (Manual Database Update):
- Manually set `subscriptionStatus` to `'inactive'` in Appwrite
- Paywall correctly appeared on lesson start
- Dynamic pricing displayed correctly

---

## Test 6: Failed Payment Scenario

**Purpose**: Verify handling of declined cards

### Steps:
1. Start new subscription purchase
2. Use **failed payment test card**: `4000 0000 0000 9995`
3. Fill other fields normally
4. Submit payment

### Expected Results (IF Webhooks Working):
- ✅ Webhook `invoice.payment_failed` received
- ✅ User `subscriptionStatus` updated to `'payment_failed'`
- ✅ Access immediately revoked
- ✅ Paywall appears on next lesson attempt

### ❌ **NOT YET IMPLEMENTED**:
- Failed payment webhook handler (Phase 6 - Task T072)

---

## Troubleshooting

### Issue: Webhook Not Received

**Symptoms**:
- Stripe CLI shows no events
- Database not updated after payment
- User still sees paywall after purchase

**Solutions**:
1. Verify Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
2. Check webhook secret in `.env.local` matches CLI output
3. Restart Next.js server after updating `.env.local`
4. Verify frontend running on port 3000: `lsof -ti:3000`

### Issue: Incorrect Price Displayed

**Symptoms**:
- Modal shows wrong price (e.g., £9.99 instead of £4.99)

**Solutions**:
1. Check `STRIPE_PRICE_ID` in `.env.local`
2. Verify price in Stripe Dashboard matches
3. Test API endpoint: `curl http://localhost:3000/api/stripe/product-info`
4. Clear browser cache and refresh

### Issue: Paywall Still Appears After Purchase

**Symptoms**:
- Payment succeeded in Stripe
- Paywall still blocks access

**Diagnosis**:
1. Check webhook was received: Look in Stripe CLI output
2. Check database was updated: Verify Appwrite users collection
3. Check browser session: Clear cookies and re-login

**Temporary Fix** (for testing only):
1. Go to Appwrite Console
2. Navigate to Users collection
3. Find test user
4. Manually update:
   - `subscriptionStatus` → `'active'`
   - `subscriptionStartDate` → Current ISO timestamp
   - `subscriptionCurrentPeriodEnd` → One month from now

---

## Next Steps After Successful Testing

Once all tests pass:

1. **Production Setup** (when ready to deploy):
   - Switch from test mode to live mode in Stripe Dashboard
   - Create live product and price
   - Get live API keys
   - Configure production webhook endpoint
   - Update `.env.production` with live keys

2. **Phase 4**: Test User Bypass Implementation
   - Allow `@testuser.com` emails to bypass paywall
   - Useful for demos and testing

3. **Phase 5**: Subscription Management UI
   - Settings page for viewing subscription
   - Cancel subscription button
   - Manage billing link

4. **Phase 6**: Failed Payment Recovery
   - Email notifications for failed payments
   - Retry payment button
   - Grace period before access revocation

---

## Testing Checklist

### MVP (Phases 1-3) - ✅ COMPLETE
- [x] T042: Dashboard subscription check integration
- [x] T043: Paywall modal on lesson start
- [x] T044: Session chat subscription check
- [x] T045: AI tutor access protection
- [x] Dynamic pricing from Stripe API
- [x] Instant modal display (prefetching)
- [x] Stripe checkout redirect
- [ ] Webhook delivery and processing (requires manual Stripe CLI setup)
- [ ] Database updates via webhooks
- [ ] Access granted after successful payment

### Additional Testing Required
- [ ] T046: Subscribed user - direct access to lessons
- [ ] T047: Non-subscribed user - paywall blocks access
- [ ] T048: Direct URL access to `/session/[id]` - redirect or block
- [ ] T049: Backend logs - verify zero unauthorized requests

---

**Last Updated**: 2025-11-16
**Status**: Core flow verified, webhook testing pending Stripe CLI setup
**Next Test**: Manual webhook verification with `stripe listen`
