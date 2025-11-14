# Quickstart: Polar Payment Integration

**Feature**: Polar Payment Gateway with AI Lesson Paywall
**Time to Setup**: ~30 minutes
**Prerequisites**: Node.js 18+, pnpm, Appwrite access, Polar sandbox account

## 1. Environment Setup (5 min)

### Create Polar Sandbox Account

1. Visit https://polar.sh and sign up
2. Navigate to Settings → API Keys
3. Create sandbox API key: `polar_at_sandbox_xxx`
4. Note your webhook secret: `whsec_xxx`
5. Create product "Student Plus" ($5.99/month) → get product ID

### Configure Environment Variables

```bash
cd assistant-ui-frontend

# Copy environment template
cp .env.local.example .env.local

# Add Polar variables
echo "POLAR_ACCESS_TOKEN=polar_at_sandbox_xxx" >> .env.local
echo "POLAR_WEBHOOK_SECRET=whsec_xxx" >> .env.local
echo "POLAR_PRODUCT_ID=prod_xxx" >> .env.local
echo "POLAR_SERVER=sandbox" >> .env.local
echo "TEST_USER_DOMAINS=scottishailessons.com" >> .env.local
```

## 2. Install Dependencies (2 min)

```bash
cd assistant-ui-frontend
pnpm install @polar-sh/nextjs zod
```

## 3. Create Appwrite Collections (5 min)

### Via Appwrite Console

1. Login to Appwrite console
2. Database: `default`
3. Create collection: `subscriptions`
   - ID Type: Custom
   - Permissions: `read(user)`, `create(any)`, `update(any)`
4. Create collection: `webhook_events`
   - ID Type: Custom
   - Permissions: `read(team:admins)`, `create(any)`

### Add Indexes

**subscriptions**:
- `userId` (unique)
- `polarSubscriptionId` (unique)
- `status` (key)
- `nextBillingDate` (key)

**webhook_events**:
- `eventId` (unique)
- `processingStatus` (key)
- `processedAt` (key)

## 4. Development Server (2 min)

```bash
# Start Next.js dev server
cd assistant-ui-frontend
pnpm dev

# Server runs at http://localhost:3000
```

## 5. Expose Webhook Endpoint (5 min)

### Option A: ngrok (Recommended for Testing)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Expose local server
ngrok http 3000

# Note the HTTPS URL: https://abc123.ngrok.io
```

### Option B: Vercel Preview Deploy

```bash
# Deploy to Vercel preview
vercel --prod=false

# Note the preview URL
```

### Configure Polar Webhook

1. Polar Dashboard → Webhooks
2. Add endpoint: `https://abc123.ngrok.io/api/polar/webhook`
3. Select events:
   - `checkout.completed`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.cancelled`
   - `benefit.grant.created`
   - `benefit.grant.revoked`

## 6. Test Flows (10 min)

### A. Test User Bypass

```bash
# 1. Login as test@scottishailessons.com
# 2. Navigate to dashboard
# 3. Click "Start Lesson" → Should bypass paywall
# 4. Verify "Test Account" badge displays
```

### B. Free User Paywall

```bash
# 1. Login as regular@example.com (non-test email)
# 2. Navigate to dashboard
# 3. Click "Start Lesson" → Should see paywall modal
# 4. Verify "Student Plus" and "$5.99/month" displayed
```

### C. Checkout Flow

```bash
# 1. From paywall modal, click "Upgrade Now"
# 2. Should redirect to Polar checkout
# 3. Use test card: 4242 4242 4242 4242
# 4. Complete checkout → redirect back to app
# 5. Verify subscription status shows "Student Plus"
# 6. Click "Start Lesson" → Should work without paywall
```

### D. Webhook Processing

```bash
# Watch webhook logs
tail -f .next/server/app/api/polar/webhook/route.ts.log

# Trigger test webhook (Polar CLI)
polar webhook test \
  --event checkout.completed \
  --url https://abc123.ngrok.io/api/polar/webhook

# Verify subscription created in Appwrite
```

## 7. Verify Installation

### Check API Routes

```bash
# Checkout endpoint
curl http://localhost:3000/api/polar/checkout?userId=test123

# Should redirect to Polar checkout

# Subscription status
curl http://localhost:3000/api/subscription/status \
  -H "Authorization: Bearer <appwrite-session>"

# Should return subscription JSON or 404
```

### Check Database

```bash
# Appwrite console → Database → subscriptions
# Should see documents created after checkout

# Appwrite console → Database → webhook_events
# Should see events logged
```

## 8. Common Issues & Solutions

### Issue: Webhook signature validation fails

**Symptom**: `401 Unauthorized` in webhook logs

**Solution**:
```bash
# Verify webhook secret matches Polar dashboard
echo $POLAR_WEBHOOK_SECRET

# Check .env.local has correct secret
grep POLAR_WEBHOOK_SECRET .env.local

# Restart dev server after changing env vars
pnpm dev
```

### Issue: Subscription not found after checkout

**Symptom**: User still sees paywall after payment

**Solution**:
```bash
# Check webhook received
# Appwrite console → webhook_events → verify event logged

# Check webhook processing succeeded
# Look for processingStatus: "completed"

# If failed, check errorDetails field

# Manual sync (if needed)
curl -X POST http://localhost:3000/api/polar/sync-subscription \
  -H "Content-Type: application/json" \
  -d '{"polarSubscriptionId": "sub_xxx"}'
```

### Issue: Test user not bypassing paywall

**Symptom**: test@scottishailessons.com sees paywall

**Solution**:
```bash
# Verify TEST_USER_DOMAINS set
echo $TEST_USER_DOMAINS

# Should output: scottishailessons.com

# Check email domain matches exactly
# ✅ test@scottishailessons.com → bypasses
# ❌ test@gmail.com → sees paywall

# Restart server if env var changed
```

### Issue: CORS errors in browser

**Symptom**: `Access-Control-Allow-Origin` errors

**Solution**:
```javascript
// next.config.js - add headers
module.exports = {
  async headers() {
    return [
      {
        source: '/api/polar/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
        ],
      },
    ];
  },
};
```

## 9. Production Checklist

Before deploying to production:

- [ ] Switch `POLAR_SERVER=production` in env vars
- [ ] Update `POLAR_ACCESS_TOKEN` to production key
- [ ] Update `POLAR_PRODUCT_ID` to production product
- [ ] Configure production webhook URL (not ngrok)
- [ ] Add webhook secret to Vercel env vars
- [ ] Test checkout with real card (small amount)
- [ ] Verify webhook processing in production
- [ ] Monitor Appwrite database for subscription creation
- [ ] Test subscription cancellation flow
- [ ] Set up monitoring/alerting for webhook failures

## 10. Development Workflow

### Daily Development

```bash
# 1. Start dev server
pnpm dev

# 2. Start ngrok (if testing webhooks)
ngrok http 3000

# 3. Watch logs
tail -f .next/server/*.log

# 4. Make changes
# 5. Test with Playwright
pnpm test:e2e

# 6. Commit
git add .
git commit -m "feat: implement paywall modal"
```

### Testing Webhooks Locally

```bash
# Option 1: Polar CLI (recommended)
polar webhook test --event checkout.completed

# Option 2: Manual curl
curl -X POST http://localhost:3000/api/polar/webhook \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: xxx" \
  -d @test-webhook.json

# Option 3: Replay production webhook
# Polar dashboard → Webhooks → Recent → Resend
```

### Debugging Tips

```typescript
// Enable verbose logging
// lib/services/polar-client.ts
const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server: 'sandbox',
  logLevel: 'debug' // Add this
});

// Check subscription cache
// Browser console
localStorage.getItem('subscription_cache');

// Force cache refresh
localStorage.removeItem('subscription_cache');
```

## Resources

- **Polar Docs**: https://polar.sh/docs
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Appwrite Databases**: https://appwrite.io/docs/products/databases
- **Playwright Testing**: https://playwright.dev/docs/intro

## Support

**Slack**: #scottish-ai-lessons-dev
**Email**: dev@scottishailessons.com
**Issues**: GitHub repository issues tab
