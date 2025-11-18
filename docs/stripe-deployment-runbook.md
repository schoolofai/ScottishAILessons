# Stripe Deployment Runbook

**Project**: Scottish AI Lessons
**Last Updated**: 2025-11-18
**Status**: Production Ready

## Overview

This runbook documents the steps required to deploy the Stripe subscription paywall to production. Follow these steps carefully to ensure a successful deployment.

## Pre-Deployment Checklist

### 1. Prerequisites

- [ ] Stripe account verified and activated for live payments
- [ ] Business details completed in Stripe Dashboard
- [ ] Bank account connected for payouts
- [ ] Production environment ready (Vercel/AWS/etc.)
- [ ] Appwrite production database configured

### 2. Test Mode Verification

Before going live, verify all test mode functionality:

- [ ] Subscription purchase flow working
- [ ] Webhook events processing correctly
- [ ] Access control enforcing subscriptions
- [ ] Customer Portal accessible
- [ ] Failed payment handling working
- [ ] Admin dashboard showing webhook errors

## Production Setup Steps

### Step 1: Create Live Mode Products

1. **Switch to Live Mode** in Stripe Dashboard (toggle in top-left)

2. **Create Subscription Product**:
   - Navigate to Products → Add product
   - Name: "Scottish AI Lessons Monthly"
   - Description: "Full access to AI-powered teaching features"
   - Pricing: £9.99/month (or your price)
   - Billing period: Monthly

3. **Copy IDs**:
   ```
   Product ID: prod_xxxxxxxxxxxxx
   Price ID: price_xxxxxxxxxxxxx    ← Use this in env
   ```

### Step 2: Get Live API Keys

1. Navigate to Developers → API keys
2. Copy your live keys:
   ```
   Publishable key: pk_live_xxxxxxxxxxxxx
   Secret key: sk_live_xxxxxxxxxxxxx
   ```

⚠️ **SECURITY**: Never commit live keys to version control

### Step 3: Configure Webhook Endpoint

1. Navigate to Developers → Webhooks
2. Click "Add endpoint"
3. Configure:
   ```
   Endpoint URL: https://yourdomain.com/api/stripe/webhook
   Description: Scottish AI Lessons - Subscription webhooks
   Events to send:
     - checkout.session.completed
     - customer.subscription.created
     - customer.subscription.updated
     - customer.subscription.deleted
     - invoice.payment_failed
     - invoice.payment_succeeded
   ```

4. Copy webhook signing secret:
   ```
   Signing secret: whsec_xxxxxxxxxxxxx
   ```

### Step 4: Update Environment Variables

Update your production environment with live Stripe keys:

```bash
# .env.production or hosting platform environment variables

# Stripe Live Keys
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PRICE_ID=price_xxxxxxxxxxxxx

# Application URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 5: Configure Customer Portal

1. Navigate to Settings → Billing → Customer portal
2. Enable portal features:
   - [ ] View subscription details
   - [ ] Cancel subscription (end of period)
   - [ ] Update payment method
   - [ ] View invoice history

3. Set portal branding:
   - Business name
   - Logo
   - Colors

4. Configure allowed actions:
   - Customers can switch plans: Disabled (single plan)
   - Proration behavior: Create prorations
   - Default payment method update: Enabled

### Step 6: Deploy Application

1. **Deploy to Production**:
   ```bash
   # Vercel
   vercel --prod

   # Or your deployment method
   npm run build && npm run start
   ```

2. **Verify deployment**:
   - [ ] Application accessible
   - [ ] Environment variables loaded
   - [ ] Database connected

### Step 7: Test Live Webhook Delivery

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select `checkout.session.completed`
4. Verify:
   - [ ] Webhook received (check logs)
   - [ ] 200 response returned
   - [ ] No errors in dashboard

## Post-Deployment Verification

### Smoke Test Checklist

Perform these tests with a real payment (small amount, then refund):

1. **Subscription Purchase**:
   - [ ] Navigate to application
   - [ ] Click Subscribe/Upgrade
   - [ ] Complete Stripe Checkout with real card
   - [ ] Verify redirect to success page
   - [ ] Verify subscription status = "active"
   - [ ] Verify AI features accessible

2. **Webhook Processing**:
   - [ ] Check Stripe Dashboard → Webhooks → Events
   - [ ] Verify events show 200 response
   - [ ] Check application logs for processing

3. **Customer Portal**:
   - [ ] Click "Manage Subscription"
   - [ ] Verify portal loads
   - [ ] Update payment method
   - [ ] Return to application

4. **Refund Test Payment**:
   - [ ] Go to Stripe Dashboard → Payments
   - [ ] Select the test payment
   - [ ] Issue full refund

### Monitoring Setup

1. **Stripe Dashboard Alerts**:
   - Configure email alerts for failed payments
   - Set up Slack integration (optional)

2. **Application Monitoring**:
   - Monitor `/api/stripe/webhook` endpoint
   - Set up alerts for 5xx errors
   - Monitor webhook processing time

3. **Admin Dashboard**:
   - Regularly check `/admin/webhooks` for errors
   - Resolve pending webhook failures

## Troubleshooting

### Webhook Failures

**Symptom**: Events showing failed in Stripe Dashboard

1. Check application logs for errors
2. Verify webhook secret matches
3. Check endpoint is accessible (no firewall blocks)
4. Verify request body parsing (must use `request.text()`)

### Subscription Not Activating

**Symptom**: User paid but status still "inactive"

1. Check `stripe_webhook_events` collection for event
2. Look for errors in `webhook_error_queue`
3. Manually verify Stripe customer ID matches user
4. If needed, manually update via admin dashboard

### Customer Portal Not Loading

**Symptom**: "Error creating portal session"

1. Verify user has `stripeCustomerId`
2. Check Customer Portal is enabled in Stripe settings
3. Verify API key permissions

## Rollback Procedure

If issues arise, follow this rollback:

1. **Immediate**: Update webhook endpoint to maintenance mode
2. **Notify Users**: Display maintenance banner
3. **Debug**: Review logs and webhook events
4. **Fix**: Deploy corrected code
5. **Re-enable**: Update webhook endpoint to active
6. **Verify**: Run smoke tests again

## Security Checklist

- [ ] Live secret keys never exposed to client
- [ ] Webhook signature verification enabled
- [ ] HTTPS enforced for all endpoints
- [ ] API keys rotated if compromised
- [ ] PCI compliance maintained (using Stripe Checkout)

## Replit Deployment Guide

Replit uses **Secrets** instead of `.env` files for environment variables. Follow these steps to configure your Replit deployment.

### Step 1: Access Replit Secrets

1. Open your Replit project
2. Click the **Tools** panel (left sidebar)
3. Select **Secrets**
4. Add each secret with the key and value

### Step 2: Required Secrets for Production

Add all the following secrets in Replit:

#### LangGraph Backend (Required)
```
NEXT_PUBLIC_LANGGRAPH_API_URL = https://your-langgraph-agent.us.langgraph.app
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID = agent
NEXT_PUBLIC_CONTEXT_CHAT_API_URL = https://your-context-chat.us.langgraph.app
NEXT_PUBLIC_LANGSMITH_API_KEY = lsv2_pt_your_key_here
```

#### Appwrite Configuration (Required)
```
NEXT_PUBLIC_APPWRITE_ENDPOINT = https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID = your_project_id
NEXT_PUBLIC_APPWRITE_DATABASE_ID = default
APPWRITE_API_KEY = standard_your_api_key_here
```

#### Application Configuration (Required)
```
NEXT_PUBLIC_APP_URL = https://your-replit-app.replit.app
OPENAI_API_KEY = sk-your_openai_key_here
```

#### Stripe Configuration - LIVE MODE (Required for Production)
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_your_publishable_key
STRIPE_SECRET_KEY = sk_live_your_secret_key
STRIPE_PRICE_ID = price_your_live_price_id
STRIPE_WEBHOOK_SECRET = whsec_your_webhook_secret
```

### Step 3: Configure Stripe Webhook for Replit

Your Replit webhook URL will be:
```
https://your-replit-app.replit.app/api/stripe/webhook
```

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint with your Replit URL
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

### Step 4: Replit Deployment Settings

1. **Run Command**: Ensure `package.json` has correct start script:
   ```json
   "scripts": {
     "start": "next start -p 5000",
     "build": "next build"
   }
   ```

2. **Always On**: Enable "Always On" in Replit for production to prevent cold starts

3. **Custom Domain** (Optional):
   - Go to Replit project settings → Custom domains
   - Add your domain and update `NEXT_PUBLIC_APP_URL`

### Step 5: Verify Replit Deployment

After deployment, verify:

- [ ] Application loads at your Replit URL
- [ ] Secrets are accessible (check logs for missing vars)
- [ ] Stripe webhook test passes in Dashboard
- [ ] Login flow works with Appwrite
- [ ] Subscription purchase completes

### Replit-Specific Troubleshooting

#### "Environment variable not found"
- Verify secret name matches exactly (case-sensitive)
- Restart the Replit after adding secrets
- Check for typos in secret names

#### Webhook returning 502/504
- Enable "Always On" to prevent cold starts
- Increase webhook timeout in Stripe (default 10s → 30s)
- Check Replit logs for errors

#### CORS Issues
- Verify `NEXT_PUBLIC_APP_URL` matches your Replit domain
- Check Appwrite CORS settings include Replit domain

### Quick Reference: All Secrets List

Copy this list to add all secrets in Replit:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `NEXT_PUBLIC_LANGGRAPH_API_URL` | Main LangGraph backend | `https://xxx.us.langgraph.app` |
| `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID` | Assistant ID | `agent` |
| `NEXT_PUBLIC_CONTEXT_CHAT_API_URL` | Context chat backend | `https://xxx.us.langgraph.app` |
| `NEXT_PUBLIC_LANGSMITH_API_KEY` | LangSmith API key | `lsv2_pt_xxx` |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Appwrite endpoint | `https://cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Appwrite project ID | `68adb98e0020be2e134f` |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Database ID | `default` |
| `APPWRITE_API_KEY` | Appwrite server API key | `standard_xxx` |
| `NEXT_PUBLIC_APP_URL` | Your Replit app URL | `https://xxx.replit.app` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-xxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe public key | `pk_live_xxx` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_xxx` |
| `STRIPE_PRICE_ID` | Subscription price ID | `price_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_xxx` |

**Total: 14 secrets required for full production deployment**

---

## Support Contacts

- **Stripe Support**: dashboard.stripe.com/support
- **Technical Issues**: [Your team contact]
- **Billing Disputes**: [Finance team contact]

## Related Documentation

- [Payment System Documentation](./payment-system.md)
- [Authentication System](./authentication-system.md)
- [Stripe Subscription Paywall Spec](../specs/004-stripe-subscription-paywall/spec.md)
- [Stripe Official Docs](https://stripe.com/docs)
