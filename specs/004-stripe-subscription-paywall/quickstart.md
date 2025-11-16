# Quickstart: Stripe Setup for Subscription Paywall

**Feature**: `004-stripe-subscription-paywall`
**Date**: 2025-11-14
**Audience**: Developers with NO prior Stripe knowledge
**Estimated Time**: 45-60 minutes (first-time setup)

## Overview

This guide walks you through setting up Stripe from scratch for subscription payments in the Scottish AI Lessons platform. You'll create a Stripe account, configure products and prices, set up webhooks, and test the integration end-to-end.

**What You'll Need**:
- Email address for Stripe account
- Access to the Scottish AI Lessons codebase
- Terminal access for Stripe CLI installation

## Table of Contents

1. [Create Stripe Account](#1-create-stripe-account)
2. [Create Product and Price](#2-create-product-and-price)
3. [Get API Keys](#3-get-api-keys)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Set Up Webhooks (Local Development)](#5-set-up-webhooks-local-development)
6. [Set Up Webhooks (Production)](#6-set-up-webhooks-production)
7. [Test Mode vs Live Mode](#7-test-mode-vs-live-mode)
8. [Testing the Integration](#8-testing-the-integration)
9. [Common Issues and Solutions](#9-common-issues-and-solutions)

---

## 1. Create Stripe Account

### Step 1.1: Sign Up

1. Go to [https://stripe.com](https://stripe.com)
2. Click "Sign in" → "Create an account"
3. Enter your email address and create a password
4. Verify your email address (check inbox for verification link)

**Result**: You now have a Stripe account in **Test Mode** (default).

### Step 1.2: Complete Account Profile (Optional for Testing)

For **test mode** development, you can skip business details. For **production**, you'll need to:
- Provide business information
- Add bank account details (for payouts)
- Verify identity

**Note**: Start with test mode. Complete production activation when ready to deploy.

---

## 2. Create Product and Price

### What is a Product?

A **product** represents what you're selling (e.g., "AI Lesson Access").
A **price** defines how much it costs and how often it's billed (e.g., £9.99/month).

### Step 2.1: Create Product

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Click "Add product"
3. Fill in product details:
   - **Name**: `AI Lesson Access`
   - **Description**: `Monthly subscription for AI-powered tutoring features`
   - **Image**: (Optional) Upload a logo or product image
4. Configure pricing:
   - **Pricing model**: `Standard pricing`
   - **Price**: Enter amount (e.g., `9.99`)
   - **Billing period**: Select `Monthly`
   - **Currency**: Select `GBP` (or your preferred currency)
5. Click "Save product"

**Result**: You now have a product with a price ID (format: `price_1ABC2DEF3GHI4JKL`)

### Step 2.2: Copy Price ID

1. On the product page, under "Pricing", find your monthly price
2. Click the price row to expand details
3. Copy the **Price ID** (starts with `price_`)
4. Save this ID - you'll need it for environment variables

**Example Price ID**: `price_1MqW3SLkdIwHu7ixK6VDdp3s`

---

## 3. Get API Keys

Stripe provides two types of API keys:

| Key Type | Purpose | Visibility | Example |
|----------|---------|------------|---------|
| **Publishable Key** | Frontend (client-side) | Public, safe to expose | `pk_test_...` |
| **Secret Key** | Backend (server-side) | Private, NEVER expose | `sk_test_...` |

### Step 3.1: Access API Keys

1. Go to [API Keys page](https://dashboard.stripe.com/test/apikeys)
2. You'll see two keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...` (click "Reveal test key" to show)

### Step 3.2: Copy Keys

**IMPORTANT**: Copy both keys to a secure location (password manager recommended).

**Security Warning**: NEVER commit secret keys to Git. Always use environment variables.

---

## 4. Configure Environment Variables

### Step 4.1: Development Environment (.env.local)

1. Navigate to your project root:
   ```bash
   cd assistant-ui-frontend
   ```

2. Create or edit `.env.local`:
   ```bash
   touch .env.local
   ```

3. Add Stripe configuration:
   ```bash
   # Stripe Configuration (Test Mode)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
   STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
   STRIPE_PRICE_ID=price_YOUR_PRICE_ID_HERE
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Replace placeholders:
   - `pk_test_YOUR_KEY_HERE` → Your publishable key from Step 3
   - `sk_test_YOUR_KEY_HERE` → Your secret key from Step 3
   - `price_YOUR_PRICE_ID_HERE` → Your price ID from Step 2

**Note**: Leave `STRIPE_WEBHOOK_SECRET` empty for now. We'll fill it in Step 5.

### Step 4.2: Production Environment (.env.production)

**DO NOT configure production until you're ready to deploy**. When ready:

1. Activate your Stripe account (complete business verification)
2. Switch to **Live Mode** in Stripe Dashboard (toggle in top-right)
3. Create a new product and price in Live Mode (repeat Step 2)
4. Get Live Mode API keys (repeat Step 3, but switch to "Live" keys)
5. Create `.env.production` with live keys

---

## 5. Set Up Webhooks (Local Development)

Webhooks allow Stripe to notify your application when events occur (e.g., payment succeeded).

### What is the Stripe CLI?

The **Stripe CLI** is a command-line tool that:
- Forwards webhook events from Stripe to your local server
- Generates a temporary webhook signing secret
- Allows you to trigger test events

### Step 5.1: Install Stripe CLI

#### macOS (Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

#### Windows (Scoop)
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

#### Linux (Download Binary)
```bash
wget https://github.com/stripe/stripe-cli/releases/download/v1.18.0/stripe_1.18.0_linux_x86_64.tar.gz
tar -xvf stripe_1.18.0_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Verify installation**:
```bash
stripe --version
```

### Step 5.2: Login to Stripe CLI

```bash
stripe login
```

This will:
1. Open your browser
2. Ask you to authorize the CLI
3. Return to terminal when complete

**Result**: CLI is now authenticated with your Stripe account.

### Step 5.3: Forward Webhooks to Local Server

1. Start your local development server (if not already running):
   ```bash
   cd assistant-ui-frontend
   npm run dev
   ```

2. In a **new terminal window**, run:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. The CLI will output:
   ```
   Ready! Your webhook signing secret is whsec_abc123def456...
   ```

4. **Copy the webhook signing secret** (`whsec_...`)

5. Add it to your `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_abc123def456...
   ```

6. **Restart your Next.js server** to load the new environment variable

**Important**: Keep the `stripe listen` terminal window open while developing. Webhooks will only work while this is running.

---

## 6. Set Up Webhooks (Production)

### Step 6.1: Configure Webhook Endpoint in Stripe Dashboard

1. Go to [Webhooks page](https://dashboard.stripe.com/test/webhooks) (Test Mode for now)
2. Click "Add endpoint"
3. Fill in details:
   - **Endpoint URL**: `https://yourdomain.com/api/stripe/webhook`
   - **Description**: `Production webhook for subscription events`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Click "Add endpoint"

### Step 6.2: Copy Webhook Signing Secret

1. After creating the endpoint, click on it to view details
2. Under "Signing secret", click "Reveal"
3. Copy the secret (format: `whsec_...`)
4. Add to your production environment variables

**Security Note**: The signing secret is different for test mode and live mode. When you switch to live mode, you'll need to create a new webhook endpoint and get a new signing secret.

---

## 7. Test Mode vs Live Mode

### Test Mode (Development)

- **API Keys**: Start with `pk_test_` and `sk_test_`
- **Payments**: Use test card numbers (no real money)
- **Webhooks**: Use Stripe CLI for local testing
- **Dashboard**: Toggle "Viewing test data" in top-right

**Test Card Numbers**:

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Payment fails (triggers `invoice.payment_failed`) |

**Expiry Date**: Any future date (e.g., `12/34`)
**CVC**: Any 3 digits (e.g., `123`)
**ZIP**: Any ZIP code (e.g., `12345`)

### Live Mode (Production)

- **API Keys**: Use `pk_live_` and `sk_live_`
- **Payments**: Real payments with real cards
- **Webhooks**: Configure in Stripe Dashboard (Step 6)
- **Dashboard**: Toggle "Viewing live data" in top-right

**Activation Checklist**:
- [ ] Complete business verification
- [ ] Add bank account for payouts
- [ ] Create live products and prices
- [ ] Get live API keys
- [ ] Configure live webhook endpoint
- [ ] Update production environment variables
- [ ] Test with real card (small amount first)

---

## 8. Testing the Integration

### Test 1: Create Checkout Session

1. Start your local server:
   ```bash
   cd assistant-ui-frontend
   npm run dev
   ```

2. Start Stripe CLI webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. Login to your application at `http://localhost:3000`

4. Navigate to a lesson and click "Start Lesson"

5. If not subscribed, you should see a paywall modal

6. Click "Subscribe" button

7. You should be redirected to Stripe Checkout page

8. Fill in test card details:
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - Name: `Test User`
   - Email: `test@example.com`

9. Click "Subscribe"

10. You should be redirected back to your dashboard

**Expected Results**:
- In Stripe CLI terminal, you'll see webhook events logged
- In your application, user subscription status should be "active"
- You can now access lessons without paywall

### Test 2: Verify Webhook Processing

1. Go to [Stripe Dashboard → Events](https://dashboard.stripe.com/test/events)

2. Find the `checkout.session.completed` event

3. Verify it was successfully sent to your endpoint

4. Check your database:
   ```typescript
   // In Appwrite Console or using API
   // Check users collection:
   // - subscriptionStatus should be 'active'
   // - stripeCustomerId should be set
   // - stripeSubscriptionId should be set

   // Check subscriptions collection:
   // - New subscription record created

   // Check subscription_audit_logs collection:
   // - Audit log entry for status change
   ```

### Test 3: Failed Payment Scenario

1. Create a new test user in your application

2. Start checkout flow again

3. Use test card that triggers payment failure: `4000 0000 0000 9995`

4. Complete checkout

5. **Expected Results**:
   - Webhook `invoice.payment_failed` is received
   - User subscription status changes to 'payment_failed'
   - User access is immediately revoked
   - In-app notification is shown

### Test 4: Subscription Cancellation

1. Go to Stripe Dashboard → Customers

2. Find your test customer

3. Click on their subscription → "Cancel subscription"

4. Choose "Cancel immediately"

5. **Expected Results**:
   - Webhook `customer.subscription.deleted` is received
   - User subscription status changes to 'cancelled'
   - User access is revoked

---

## 9. Common Issues and Solutions

### Issue 1: Webhook Signature Verification Failed

**Error**: `Webhook signature verification failed`

**Causes**:
- Using wrong webhook secret (test vs production)
- Webhook secret not loaded in environment variables
- Server was not restarted after adding webhook secret

**Solution**:
1. Verify you copied the correct webhook secret from Stripe CLI output
2. Check `.env.local` has `STRIPE_WEBHOOK_SECRET=whsec_...`
3. Restart your Next.js server: `Ctrl+C` then `npm run dev`
4. Ensure Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Issue 2: Checkout Session Not Created

**Error**: `Failed to create checkout session`

**Causes**:
- Invalid Stripe API keys
- Invalid price ID
- API keys not loaded in environment

**Solution**:
1. Verify API keys are correct in `.env.local`
2. Check price ID exists in Stripe Dashboard
3. Restart server after updating environment variables
4. Check server logs for detailed error message

### Issue 3: Webhooks Not Received

**Symptom**: Subscription status not updating after checkout

**Causes**:
- Stripe CLI not running
- Webhook endpoint URL incorrect
- Firewall blocking webhook requests

**Solution**:
1. Verify Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
2. Check CLI terminal for event logs
3. Verify Next.js server is running on port 3000
4. Check Stripe Dashboard → Events → Webhooks to see delivery attempts

### Issue 4: "Price Not Found" Error

**Error**: `No such price: 'price_...'`

**Causes**:
- Price ID is from live mode but using test mode keys (or vice versa)
- Price ID was copied incorrectly
- Price was deleted in Stripe Dashboard

**Solution**:
1. Verify you're in correct mode (test vs live) in Stripe Dashboard
2. Go to Products → Find your product → Copy price ID again
3. Update `.env.local` with correct price ID
4. Restart server

### Issue 5: Test Card Declined

**Symptom**: Test card `4242 4242 4242 4242` shows as declined

**Causes**:
- Using live mode keys with test card
- Stripe account requires additional verification

**Solution**:
1. Verify you're using **test mode** API keys (`pk_test_` and `sk_test_`)
2. Check Stripe Dashboard is showing "Viewing test data" (top-right toggle)
3. Try different test card number from Stripe's test card list

---

## Next Steps

After completing this quickstart:

1. **Implement Frontend Components**:
   - Paywall modal in `EnhancedStudentDashboard`
   - Subscription status check in `SessionChatAssistant`
   - Manage subscription button in user settings

2. **Set Up Admin Dashboard**:
   - Failed webhooks view
   - Manual reconciliation interface
   - Subscription analytics

3. **Test Edge Cases**:
   - Concurrent subscriptions
   - Webhook retry behavior
   - Network failures during checkout

4. **Prepare for Production**:
   - Complete Stripe account activation
   - Create live products and prices
   - Configure live webhook endpoint
   - Update production environment variables
   - Test with real payment (small amount)

---

## Additional Resources

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)

---

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] Stripe account is created and verified (email confirmed)
- [ ] Product and price are created in correct mode (test/live)
- [ ] API keys are copied correctly (no extra spaces)
- [ ] Environment variables are set in `.env.local`
- [ ] Server was restarted after updating environment variables
- [ ] Stripe CLI is installed and authenticated
- [ ] Stripe CLI webhook forwarding is running (`stripe listen`)
- [ ] Next.js server is running (`npm run dev`)
- [ ] Using test card numbers from Stripe's official list
- [ ] Webhook secret is from Stripe CLI output (for local dev)

If all checks pass and issues persist, check server logs (`npm run dev` terminal) and Stripe Dashboard → Events for detailed error messages.
