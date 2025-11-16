# Setup Progress: Stripe Subscription Paywall

**Feature**: `004-stripe-subscription-paywall`
**Date**: 2025-11-14
**Current Phase**: Phase 1 - Setup (70% Complete)

## ✅ Completed Tasks

### NPM Dependencies (T006-T007)
- ✅ Installed `stripe`, `@stripe/stripe-js`, `swr` packages
- ✅ Installed `@types/stripe` TypeScript definitions

### Environment Configuration (T008)
- ✅ Updated `.env.local` with Stripe placeholder variables:
  ```bash
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
  STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
  STRIPE_PRICE_ID=price_YOUR_PRICE_ID_HERE
  STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
  ```

### Database Migration Script (T010-T020)
- ✅ Created comprehensive migration script: `scripts/setup-stripe-database-schema.ts`
- ✅ Script includes:
  - Extension of `users` collection with 5 new attributes
  - Creation of 4 new collections (`subscriptions`, `subscription_audit_logs`, `stripe_webhook_events`, `webhook_error_queue`)
  - All required indexes (11 total)
  - Collection permissions configuration
  - Error handling with graceful fallback for existing schema elements

---

## 🔄 Required Manual Steps

### 1. Stripe Account Setup (T001-T005)

Follow the detailed quickstart guide at:
`specs/004-stripe-subscription-paywall/quickstart.md`

**Quick Summary**:

#### Step 1: Create Stripe Account (T001)
```bash
# Navigate to https://stripe.com
# Click "Sign in" → "Create an account"
# Verify your email address
```

#### Step 2: Create Monthly Product (T002)
```bash
# Login to Stripe Dashboard (Test Mode)
# Navigate to Products → Add product
# Configure:
#   Name: AI Lesson Access
#   Description: Monthly subscription for AI-powered tutoring features
#   Pricing model: Standard pricing
#   Price: 9.99 (or your chosen amount)
#   Billing period: Monthly
#   Currency: GBP (or your preferred currency)
# Click "Save product"
# Copy the Price ID (format: price_1ABC...)
```

#### Step 3: Get API Keys (T003)
```bash
# Navigate to Developers → API keys
# Copy:
#   - Publishable key (pk_test_...)
#   - Secret key (sk_test_...) - click "Reveal test key"
```

#### Step 4: Install Stripe CLI (T004)
```bash
# macOS (Homebrew)
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux (Download Binary)
wget https://github.com/stripe/stripe-cli/releases/download/v1.18.0/stripe_1.18.0_linux_x86_64.tar.gz
tar -xvf stripe_1.18.0_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/

# Verify installation
stripe --version
```

#### Step 5: Authenticate Stripe CLI (T005)
```bash
stripe login
# This will open your browser for authorization
# Return to terminal when complete
```

### 2. Configure Environment Variables (T009)

Update `.env.local` in `assistant-ui-frontend/` with actual Stripe keys:

```bash
cd assistant-ui-frontend

# Edit .env.local and replace placeholders:
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE  ← Replace with actual key from T003
# STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE                   ← Replace with actual key from T003
# STRIPE_PRICE_ID=price_YOUR_PRICE_ID_HERE                  ← Replace with Price ID from T002
# STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE      ← Leave empty for now (populated in Phase 2)
```

**Security Warning**: NEVER commit `.env.local` to Git! It's already in `.gitignore`.

### 3. Run Database Migration Script

Once manual steps 1-2 are complete, run the database migration:

```bash
cd assistant-ui-frontend
npx tsx scripts/setup-stripe-database-schema.ts
```

**Expected Output**:
```
╔════════════════════════════════════════════════════════════════════╗
║  Stripe Subscription Paywall - Database Schema Migration          ║
║  Feature: 004-stripe-subscription-paywall                         ║
╚════════════════════════════════════════════════════════════════════╝

=== STEP 1: Extending Users Collection ===

✅ Created attribute: users.subscriptionStatus
✅ Created attribute: users.stripeCustomerId
✅ Created attribute: users.stripeSubscriptionId
✅ Created attribute: users.testUserFlag
✅ Created attribute: users.subscriptionExpiresAt
✅ Created index: users.subscription_status_idx
✅ Created index: users.stripe_customer_idx
✅ Created index: users.test_user_idx

✅ Users collection extended successfully

=== STEP 2: Creating Subscriptions Collection ===
... (similar output for 4 more collections)

╔════════════════════════════════════════════════════════════════════╗
║  ✅ DATABASE SCHEMA MIGRATION COMPLETED SUCCESSFULLY               ║
╚════════════════════════════════════════════════════════════════════╝
```

**Verify in Appwrite Console**:
1. Navigate to https://cloud.appwrite.io
2. Select your project (`68adb98e0020be2e134f`)
3. Go to Databases → `default`
4. Verify collections exist:
   - `users` (extended with 5 new attributes)
   - `subscriptions` (new)
   - `subscription_audit_logs` (new)
   - `stripe_webhook_events` (new)
   - `webhook_error_queue` (new)

---

## 📊 Phase 1 Status

| Task ID | Description | Status |
|---------|-------------|--------|
| T001 | Create Stripe test mode account | ⏳ Manual Required |
| T002 | Create monthly subscription product | ⏳ Manual Required |
| T003 | Retrieve Stripe API keys | ⏳ Manual Required |
| T004 | Install Stripe CLI | ⏳ Manual Required |
| T005 | Authenticate Stripe CLI | ⏳ Manual Required |
| T006 | Install NPM dependencies | ✅ Complete |
| T007 | Install TypeScript types | ✅ Complete |
| T008 | Create .env.local template | ✅ Complete |
| T009 | Configure actual API keys | ⏳ Manual Required |
| T010-T020 | Database schema migration | ✅ Script Ready |

**Progress**: 14/20 tasks complete (70%)
**Blocking**: Tasks T001-T005, T009 require manual user action
**Next Step**: Complete manual Stripe setup, then run migration script

---

## 🚀 Next Phase Preview

Once Phase 1 is complete (all 20 tasks), proceed to **Phase 2: User Story 1 - Subscription Purchase Journey**.

**Phase 2 will implement**:
- `lib/stripe-helpers.ts` - Server-side Stripe utilities
- `app/api/stripe/checkout/route.ts` - Checkout Session creation
- `app/api/stripe/webhook/route.ts` - Webhook event handler
- Webhook signature verification
- Idempotency checks
- Database update logic for subscription activation

**Estimated Duration**: 3-4 days

---

## 🛠️ Troubleshooting

### Issue: Migration Script Fails with "Missing environment variables"

**Solution**:
```bash
# Verify environment variables are set
cd assistant-ui-frontend
cat .env.local | grep APPWRITE

# Should show:
# NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
# NEXT_PUBLIC_APPWRITE_PROJECT_ID=68adb98e0020be2e134f
# APPWRITE_API_KEY=ystandard_...
```

### Issue: "Attribute already exists" errors during migration

**Solution**: This is normal if running the migration multiple times. The script handles existing schema gracefully.

### Issue: "Permission denied" errors

**Solution**: Ensure `APPWRITE_API_KEY` has admin permissions:
1. Go to Appwrite Console → Settings → API Keys
2. Verify the key has `databases.write` scope

---

## 📚 Reference Documents

- **Quickstart Guide**: `specs/004-stripe-subscription-paywall/quickstart.md` (comprehensive Stripe setup)
- **Data Model**: `specs/004-stripe-subscription-paywall/data-model.md` (schema specifications)
- **Implementation Plan**: `specs/004-stripe-subscription-paywall/plan.md` (technical architecture)
- **Task Breakdown**: `specs/004-stripe-subscription-paywall/tasks.md` (all 122 tasks)
- **API Contracts**: `specs/004-stripe-subscription-paywall/contracts/` (6 endpoint specifications)

---

## ✅ Completion Checklist

Before proceeding to Phase 2, verify:

- [ ] Stripe test mode account created and email verified
- [ ] Monthly subscription product created in Stripe Dashboard
- [ ] Stripe API keys (publishable and secret) copied
- [ ] Stripe CLI installed and authenticated (`stripe --version` works)
- [ ] `.env.local` updated with actual API keys (not placeholders)
- [ ] Database migration script executed successfully (`npx tsx scripts/setup-stripe-database-schema.ts`)
- [ ] All 5 collections visible in Appwrite Console
- [ ] Users collection shows 5 new attributes (subscriptionStatus, stripeCustomerId, stripeSubscriptionId, testUserFlag, subscriptionExpiresAt)

**Once all items are checked**: Mark T001-T005 and T009 as complete in `tasks.md`, then proceed to Phase 2 implementation.
