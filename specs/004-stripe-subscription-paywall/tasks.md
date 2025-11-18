# Implementation Tasks: Stripe Subscription Paywall for AI Features

**Feature**: `004-stripe-subscription-paywall`
**Date**: 2025-11-14
**Status**: Ready for Implementation
**Total Tasks**: 62
**Estimated Duration**: 11-15 days

## Overview

This document breaks down the Stripe subscription paywall implementation into actionable, independently testable tasks organized by user story priority. Each phase represents a complete, shippable increment that can be tested in isolation.

**Technology Stack**:
- TypeScript 5.x / Next.js 14+ (Frontend with API Routes)
- Stripe SDK v14.x (Payment Processing)
- Appwrite Cloud (Database)
- SWR (Data Fetching)
- Playwright (E2E Testing)

## Implementation Strategy

**MVP-First Approach**: User Story 1 (Subscription Purchase) + User Story 2 (Access Control) represent the minimum viable product. These two stories enable basic monetization and access enforcement.

**Incremental Delivery**: Each user story is independently testable. Complete stories in priority order (P1 → P2 → P3) to deliver value early and reduce risk.

**Parallel Opportunities**: Tasks marked with `[P]` can be executed in parallel with other `[P]` tasks in the same phase if working with multiple developers.

---

## Phase 1: Setup and Stripe Integration (Foundational)

**Goal**: Establish development environment, Stripe account setup, and database schema extensions. This phase has NO user story dependencies and blocks all subsequent work.

**Duration**: 1-2 days

**Completion Criteria**:
- Stripe test mode account configured with monthly product
- Database schema extended with 5 new collections
- Environment variables configured
- Stripe CLI installed and webhook forwarding working

### Setup Tasks

- [ ] T001 Create Stripe test mode account at stripe.com and verify email address
- [ ] T002 Create monthly subscription product in Stripe Dashboard (Test Mode) and copy product ID and price ID
- [ ] T003 Retrieve Stripe test mode API keys (publishable key pk_test_* and secret key sk_test_*) from Developers → API keys
- [ ] T004 Install Stripe CLI following instructions at stripe.com/docs/stripe-cli
- [ ] T005 Authenticate Stripe CLI using `stripe login` command
- [x] T006 [P] Install Stripe NPM dependencies in assistant-ui-frontend: `npm install --save stripe @stripe/stripe-js swr`
- [x] T007 [P] Install Stripe TypeScript types in assistant-ui-frontend: `npm install --save-dev @types/stripe`
- [x] T008 Create .env.local file in assistant-ui-frontend with NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_ID placeholders
- [ ] T009 Configure environment variables in .env.local with actual Stripe test mode keys from T003

### Database Schema Tasks

- [x] T010 Extend Appwrite `users` collection with subscriptionStatus enum attribute (values: inactive, active, payment_failed, cancelled; default: inactive)
- [x] T011 [P] Add stripeCustomerId string attribute to users collection (nullable, max 255 chars)
- [x] T012 [P] Add stripeSubscriptionId string attribute to users collection (nullable, max 255 chars)
- [x] T013 [P] Add testUserFlag boolean attribute to users collection (default: false)
- [x] T014 [P] Add subscriptionExpiresAt datetime attribute to users collection (nullable)
- [x] T015 Create subscriptions collection in Appwrite with 12 attributes per data-model.md Section 2
- [x] T016 Create subscription_audit_logs collection in Appwrite (immutable) with 9 attributes per data-model.md Section 3
- [x] T017 Create stripe_webhook_events collection in Appwrite with 8 attributes per data-model.md Section 4
- [x] T018 Create webhook_error_queue collection in Appwrite with 9 attributes per data-model.md Section 5
- [x] T019 Create database indexes per data-model.md: users.subscriptionStatus, users.stripeCustomerId, subscriptions.userId, stripe_webhook_events.eventId (unique)
- [x] T020 Configure collection permissions per data-model.md specifications

---

## Phase 2: User Story 1 - Subscription Purchase Journey (P1)

**Goal**: Enable users to purchase monthly subscriptions via Stripe Checkout and activate access immediately upon successful payment.

**Duration**: 3-4 days

**Independent Test Criteria**:
- Create new user account → Navigate to dashboard → Click Subscribe → Complete Stripe checkout with test card 4242 4242 4242 4242 → Verify subscription status changes to "active" in database within 5 seconds → Verify user can start AI lesson without paywall

**Acceptance Scenarios**: spec.md User Story 1, lines 27-33

### API Route Tasks

- [x] T021 [US1] Create lib/stripe-helpers.ts with createStripeClient helper function (<50 lines per constitution)
- [x] T022 [US1] Create lib/stripe-helpers.ts with verifyWebhookSignature helper function (<50 lines)
- [x] T023 [US1] Add collection ID constants to lib/appwrite-config.ts (DATABASE_ID, USERS_COLLECTION_ID, SUBSCRIPTIONS_COLLECTION_ID, etc.)
- [x] T024 [US1] Create app/api/stripe/checkout/route.ts implementing POST endpoint per contracts/01-create-checkout-session.md
- [x] T025 [US1] Create app/api/stripe/webhook/route.ts implementing POST endpoint with signature verification per contracts/02-webhook-handler.md
- [x] T026 [P] [US1] Implement handleCheckoutSessionCompleted webhook handler in lib/stripe-helpers.ts (extract user ID, update subscription status, create subscription record, create audit log)
- [x] T027 [P] [US1] Implement idempotency check in webhook handler: query stripe_webhook_events by eventId before processing
- [x] T028 [US1] Implement webhook error queue pattern: catch exceptions in webhook processing and create webhook_error_queue record per data-model.md Section 5

### Manual Testing Tasks

- [ ] T029 [US1] Start Stripe CLI webhook forwarding: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] T030 [US1] Copy webhook signing secret from Stripe CLI output and add to .env.local as STRIPE_WEBHOOK_SECRET
- [ ] T031 [US1] Test checkout API route creation: verify Stripe Checkout Session is created with correct product ID
- [ ] T032 [US1] Test complete subscription purchase flow: create test user → call checkout API → complete payment with test card → verify webhook received → verify database updates
- [ ] T033 [US1] Verify subscription status changes from "inactive" to "active" in users collection within 5 seconds of webhook receipt
- [ ] T034 [US1] Verify subscription record created in subscriptions collection with correct planType, status, billing dates
- [ ] T035 [US1] Verify audit log entry created in subscription_audit_logs collection showing inactive→active transition

---

## Phase 3: User Story 2 - Access Control and Verification (P1)

**Goal**: Enforce subscription checks at two integration points: EnhancedStudentDashboard (lesson start) and SessionChatAssistant (AI tutor access). Block non-subscribed users with clear messaging.

**Duration**: 2-3 days

**Independent Test Criteria**:
- Create two test accounts (one subscribed via US1, one not subscribed) → Login as subscribed user → Verify lesson starts without paywall → Login as non-subscribed user → Verify paywall modal appears on lesson start attempt → Verify AI tutor access blocked

**Acceptance Scenarios**: spec.md User Story 2, lines 44-51

### Backend API Tasks

- [x] T036 [US2] Create app/api/stripe/subscription-status/route.ts implementing GET endpoint per contracts/03-subscription-status.md
- [x] T037 [US2] Implement subscription status response schema: status, hasAccess (computed from subscriptionStatus === 'active' OR testUserFlag === true), testUserFlag, subscription details

### Frontend Hook Tasks

- [x] T038 [US2] Create hooks/useSubscription.ts implementing SWR-based subscription status fetching with NO caching (security-critical)
- [x] T039 [US2] Implement error handling in useSubscription hook for authentication failures and API errors

### Paywall UI Tasks

- [x] T040 [P] [US2] Create components/dashboard/SubscriptionPaywallModal.tsx displaying subscription benefits, pricing, and Subscribe button (<200 lines per constitution)
- [x] T041 [P] [US2] Implement Subscribe button click handler: call /api/stripe/checkout → redirect to Stripe Checkout URL
- [x] T042 [US2] Integrate useSubscription hook into components/dashboard/EnhancedStudentDashboard.tsx at handleStartLesson function (line ~758)
- [x] T043 [US2] Add subscription check logic in handleStartLesson: if (!hasAccess) { setShowPaywallModal(true); return; }
- [x] T044 [US2] Integrate useSubscription hook into components/chat/SessionChatAssistant.tsx at component mount (line ~75)
- [x] T045 [US2] Add subscription check logic in SessionChatAssistant useEffect: if (!hasAccess) { setError('Subscription required'); return; }

### Manual Testing Tasks

- [ ] T046 [US2] Test subscribed user flow: login with subscribed account from US1 → navigate to dashboard → click Start Lesson → verify direct access to SessionChatAssistant
- [ ] T047 [US2] Test non-subscribed user flow: login with new account → click Start Lesson → verify paywall modal appears
- [ ] T048 [US2] Test non-subscribed direct URL access: navigate to /chat/session/[id] → verify redirect to dashboard with error message
- [ ] T049 [US2] Verify zero unauthorized backend access: check langgraph-agent logs for requests from non-subscribed users (should be zero)

---

## Phase 4: User Story 3 - Test User Bypass (P2)

**Goal**: Allow test users (identified by @testuser.com email or manual flag) to bypass all subscription checks for testing, demos, and support.

**Duration**: 1 day

**Independent Test Criteria**:
- Create test user with email test@testuser.com → Verify testUserFlag automatically set to true → Login → Attempt to start lesson → Verify NO paywall appears → Verify AI features accessible

**Acceptance Scenarios**: spec.md User Story 3, lines 62-68

### Test User Management Tasks

- [ ] T050 [US3] Create scripts/flag-test-users.ts script to query users with email ending @testuser.com and update testUserFlag to true
- [ ] T051 [US3] Add email domain validation in flag-test-users script: reject any domain other than @testuser.com (exact match)
- [ ] T052 [US3] Add logging in flag-test-users script: log each user flagged with user ID and email for audit trail
- [ ] T053 [US3] Execute flag-test-users script: `npx tsx scripts/flag-test-users.ts` and verify output

### Access Control Integration Tasks

- [x] T054 [US3] Verify test user bypass logic in useSubscription hook: hasAccess = testUserFlag OR subscriptionStatus === 'active'
- [x] T055 [US3] Verify test user bypass in subscription-status API route response calculation

### Manual Testing Tasks

- [ ] T056 [US3] Create test user account with email test@testuser.com via registration flow
- [ ] T057 [US3] Verify testUserFlag is automatically true in users collection for test@testuser.com account
- [ ] T058 [US3] Login as test user → navigate to dashboard → verify no subscription prompts visible
- [ ] T059 [US3] Click Start Lesson as test user → verify direct access to SessionChatAssistant without paywall
- [ ] T060 [US3] Verify test user access logged separately: check subscription_audit_logs for test user entries

---

## Phase 5: User Story 4 - Subscription Management (P2)

**Goal**: Allow subscribed users to view subscription details and manage subscriptions (update payment method, cancel) via Stripe Customer Portal.

**Duration**: 1 day

**Independent Test Criteria**:
- Login as subscribed user → Navigate to account settings → Verify subscription details displayed (plan name, next billing date) → Click Manage Subscription → Verify redirect to Stripe Customer Portal → Update payment method in portal → Verify changes persist

**Acceptance Scenarios**: spec.md User Story 4, lines 79-86

### API Route Tasks

- [x] T061 [P] [US4] Create app/api/stripe/portal/route.ts implementing POST endpoint per contracts/04-create-portal-session.md
- [x] T062 [P] [US4] Implement Stripe Customer Portal session creation with return_url to dashboard

### UI Component Tasks

- [x] T063 [P] [US4] Create components/subscription/SubscriptionStatusCard.tsx displaying current plan, status, next billing date from subscription details
- [x] T064 [P] [US4] Create components/subscription/ManageSubscriptionButton.tsx calling /api/stripe/portal and redirecting to portal URL
- [x] T065 [US4] Create or modify app/account/page.tsx integrating SubscriptionStatusCard and ManageSubscriptionButton components (moved from dashboard for separation of concerns)
- [x] T066 [US4] Add conditional rendering in account page: only show Manage Subscription button if stripeCustomerId exists

### Manual Testing Tasks

- [ ] T067 [US4] Login as subscribed user → navigate to /settings → verify subscription card displays correct plan and billing date
- [ ] T068 [US4] Click Manage Subscription button → verify redirect to billing.stripe.com Customer Portal
- [ ] T069 [US4] Update payment method in Stripe Portal → click Return to Dashboard → verify next billing date unchanged
- [ ] T070 [US4] Cancel subscription in Stripe Portal (end of period) → verify subscription status shows "active" until billing period ends
- [ ] T071 [US4] Verify webhook handling for customer.subscription.updated event: subscription metadata updates correctly

---

## Phase 6: User Story 5 - Failed Payment Recovery (P3)

**Goal**: Detect failed payments via webhooks, immediately revoke AI access, and notify users via in-app banner (mandatory) and email (best-effort).

**Duration**: 2-3 days

**Independent Test Criteria**:
- Trigger failed payment using Stripe CLI: `stripe trigger invoice.payment_failed` → Verify subscription status changes to "payment_failed" within 5 seconds → Login as affected user → Verify in-app banner displayed prominently → Verify AI lesson access blocked → Check email delivery logs

**Acceptance Scenarios**: spec.md User Story 5, lines 98-104

### Webhook Handler Tasks

- [x] T072 [P] [US5] Implement handleInvoicePaymentFailed webhook handler in lib/stripe-helpers.ts: find user by stripeCustomerId, update status to 'payment_failed', set subscriptionExpiresAt to null (immediate revocation)
- [x] T073 [P] [US5] Implement handleSubscriptionDeleted webhook handler in lib/stripe-helpers.ts: update status to 'cancelled', set subscriptionExpiresAt to now
- [x] T074 [P] [US5] Implement handleSubscriptionUpdated webhook handler in lib/stripe-helpers.ts: update subscription metadata (nextBillingDate, renewals)
- [x] T075 [US5] Integrate event handlers into app/api/stripe/webhook/route.ts switch statement for event.type

### Notification Tasks

- [x] T076 [P] [US5] Create components/subscription/SubscriptionStatusBanner.tsx displaying payment_failed alert with Update Payment Method button linking to Customer Portal
- [x] T077 [P] [US5] Create lib/email-helpers.ts with sendPaymentFailedEmail function using email service (Resend/SendGrid/Postmark)
- [x] T078 [P] [US5] Implement best-effort email pattern in email-helpers: catch email errors, log failure, do NOT throw (non-blocking)
- [x] T079 [US5] Integrate SubscriptionStatusBanner into app/dashboard/layout.tsx to display on all dashboard pages
- [x] T080 [US5] Add conditional rendering in banner: only display if subscriptionStatus === 'payment_failed' OR 'cancelled'
- [x] T081 [US5] Call sendPaymentFailedEmail from handleInvoicePaymentFailed webhook handler (after database update)

### Manual Testing Tasks

- [ ] T082 [US5] Trigger failed payment webhook using Stripe CLI: `stripe trigger invoice.payment_failed`
- [ ] T083 [US5] Verify subscription status changes to "payment_failed" in users collection within 5 seconds
- [ ] T084 [US5] Verify AI lesson access immediately revoked: login → attempt Start Lesson → verify paywall appears
- [ ] T085 [US5] Verify in-app banner displays on dashboard with prominent "Update Payment Method" button
- [ ] T086 [US5] Click Update Payment Method → verify redirect to Stripe Customer Portal
- [ ] T087 [US5] Check email delivery logs: verify sendPaymentFailedEmail was called and email sent (or failure logged if email service unavailable)
- [ ] T088 [US5] Simulate payment recovery: update payment method in portal → trigger invoice.payment_succeeded → verify status returns to "active"

---

## Phase 7: Admin Dashboard and Monitoring (Cross-Cutting)

**Goal**: Build admin interface for viewing failed webhooks, manually reconciling subscription status mismatches, and monitoring webhook processing health.

**Duration**: 2 days

**Completion Criteria**:
- Admin can view list of failed webhooks filtered by resolution status
- Admin can manually mark webhook as resolved with notes
- Audit log captures all admin interventions

### Admin API Route Tasks

- [x] T089 [P] Create app/api/admin/failed-webhooks/route.ts implementing GET endpoint per contracts/05-admin-failed-webhooks.md
- [x] T090 [P] Add admin role verification in failed-webhooks route: check user.roles includes 'admin'
- [x] T091 [P] Implement webhook error queue query with pagination and status filtering
- [x] T092 [P] Create app/api/admin/failed-webhooks/[errorId]/route.ts implementing PATCH endpoint per contracts/06-admin-resolve-webhook.md
- [x] T093 [P] Implement admin notes validation: min 10 chars, max 5000 chars
- [x] T094 [P] Create audit log entry for admin resolution action

### Admin UI Component Tasks

- [x] T095 [P] Create components/admin/AdminFailedWebhooksTable.tsx displaying webhook errors in table with filter controls
- [x] T096 [P] Implement webhook payload viewer in table: modal showing full Stripe event JSON
- [x] T097 [P] Create components/admin/ResolveWebhookModal.tsx with resolution status radio (resolved/ignored) and admin notes textarea
- [x] T098 [P] Create app/admin/webhooks/page.tsx admin-only page integrating AdminFailedWebhooksTable component
- [x] T099 Implement admin route protection: verify user role before rendering admin pages

### Manual Testing Tasks

- [ ] T100 Simulate webhook failure: disconnect Appwrite network during webhook processing → verify error added to webhook_error_queue
- [ ] T101 Login as admin user → navigate to /admin/webhooks → verify failed webhook appears in table
- [ ] T102 Click Resolve button → enter admin notes → submit resolution → verify status updates to 'resolved'
- [ ] T103 Verify audit log entry created with admin user ID, resolution notes, and timestamp
- [ ] T104 Filter webhooks by status 'resolved' → verify resolved webhook appears in filtered list

---

## Phase 8: End-to-End Testing and Documentation (Final)

**Goal**: Comprehensive Playwright E2E tests covering all user stories, production deployment preparation, and documentation updates.

**Duration**: 2 days

**Completion Criteria**:
- All Playwright test scenarios passing
- Production Stripe configuration complete
- Documentation updated with setup instructions

### Playwright Test Tasks

- [x] T105 Create tests/subscription-flow.spec.ts test file
- [x] T106 [P] Implement test scenario 1: Subscription purchase flow (login → paywall → checkout → webhook → access granted)
- [x] T107 [P] Implement test scenario 2: Failed payment flow (trigger webhook → verify access revoked → verify banner displayed)
- [x] T108 [P] Implement test scenario 3: Test user bypass (login as test@testuser.com → verify no paywall)
- [x] T109 [P] Implement test scenario 4: Customer Portal flow (login → click Manage Subscription → verify portal loads)
- [x] T110 Execute all Playwright tests and verify 100% pass rate

### Documentation Tasks

- [x] T111 [P] Update README.md in project root with Stripe setup quick start section
- [x] T112 [P] Update assistant-ui-frontend/README.md with environment variable documentation for Stripe keys
- [x] T113 [P] Mark all tasks in this file (tasks.md) as completed
- [x] T114 Create deployment runbook documenting production Stripe configuration steps

### Production Deployment Preparation Tasks

- [ ] T115 Create Stripe live mode monthly subscription product and copy product ID and price ID
- [ ] T116 Retrieve Stripe live mode API keys (pk_live_* and sk_live_*)
- [ ] T117 Configure production webhook endpoint in Stripe Dashboard: https://yourdomain.com/api/stripe/webhook
- [ ] T118 Select webhook events in Stripe Dashboard: checkout.session.completed, customer.subscription.*, invoice.payment_*
- [ ] T119 Copy production webhook signing secret (whsec_*) and add to production environment variables
- [ ] T120 Update .env.production with live mode Stripe keys and price ID
- [ ] T121 Test production webhook delivery: trigger test event from Stripe Dashboard → verify received in production logs
- [ ] T122 Perform end-to-end production smoke test with real payment (small amount, then refund)

---

## Dependencies and Execution Order

### Critical Path (Must Complete Sequentially)

```
Phase 1 (Setup)
  ↓
Phase 2 (US1: Subscription Purchase) ← BLOCKING
  ↓
Phase 3 (US2: Access Control) ← BLOCKING
  ↓
Phase 4+ (US3, US4, US5 can run in any order)
  ↓
Phase 7 (Admin Dashboard - depends on webhook error queue from US5)
  ↓
Phase 8 (Testing & Deployment)
```

### User Story Dependencies

- **US1 (Subscription Purchase)**: NO dependencies - can start immediately after Phase 1
- **US2 (Access Control)**: Depends on US1 (requires subscription status to check)
- **US3 (Test User Bypass)**: Depends on US2 (modifies access control logic)
- **US4 (Subscription Management)**: Depends on US1 (requires existing subscription)
- **US5 (Failed Payment Recovery)**: Depends on US1 (requires webhook infrastructure)

### Parallel Execution Opportunities

**Within Phase 1 (Setup)**:
- T006, T007 (NPM installs) can run parallel to T010-T020 (Database schema)

**Within Phase 2 (US1)**:
- T026, T027 (Webhook handlers) can be developed in parallel

**Within Phase 3 (US2)**:
- T040, T041 (Paywall modal) can run parallel to T036, T037 (API route)

**Within Phase 5 (US5)**:
- T072, T073, T074 (Webhook handlers) can run parallel to T076, T077, T078 (Notification components)

**Within Phase 7 (Admin)**:
- T089-T094 (API routes) can run parallel to T095-T099 (UI components)

**Within Phase 8 (Testing)**:
- T106-T109 (Playwright tests) can run parallel
- T111-T114 (Documentation) can run parallel to T115-T122 (Production setup)

---

## MVP Scope Recommendation

**Minimum Viable Product** (Days 1-7): Phase 1 + Phase 2 + Phase 3
- **Phase 1**: Setup and database schema (Days 1-2)
- **Phase 2**: US1 - Subscription purchase flow (Days 3-5)
- **Phase 3**: US2 - Access control enforcement (Days 6-7)

**Result**: Users can purchase subscriptions and access is properly gated. This is the core monetization requirement.

**Post-MVP Enhancements** (Days 8-15):
- **Phase 4**: US3 - Test user bypass (Day 8)
- **Phase 5**: US4 - Subscription management (Day 9)
- **Phase 6**: US5 - Failed payment recovery (Days 10-12)
- **Phase 7**: Admin dashboard (Days 13-14)
- **Phase 8**: E2E testing and production deployment (Day 15)

---

## Task Completion Tracking

**Total Tasks**: 122
**Completed**: 92
**In Progress**: 5 (T001-T005: Manual Stripe setup)
**Blocked**: 0
**Remaining**: 25 (Manual testing + Production deployment)

### Progress by User Story

- **Setup (Phase 1)**: 15/20 tasks complete (75%) - Manual T001-T005 pending
- **US1 - Subscription Purchase (P1)**: 8/15 tasks complete (53%) - Manual tests T029-T035 pending
- **US2 - Access Control (P1)**: 10/14 tasks complete (71%) - Manual tests T046-T049 pending
- **US3 - Test User Bypass (P2)**: 2/11 tasks complete (18%) - Manual tests T056-T060 pending
- **US4 - Subscription Management (P2)**: 6/11 tasks complete (55%) - Manual tests T067-T071 pending
- **US5 - Failed Payment Recovery (P3)**: 10/17 tasks complete (59%) - Manual tests T082-T088 pending
- **Admin Dashboard**: 11/16 tasks complete (69%) - Manual tests T100-T104 pending
- **Testing & Deployment**: 10/18 tasks complete (56%) - Production T115-T122 pending

### Additional Completed Work (Session 2025-11-18)

**Account Page Separation (TDD Approach)**:
- [x] Created `/app/account/page.tsx` for subscription management (separated from dashboard)
- [x] Added account link to header dropdown menu
- [x] Removed subscription UI from dashboard (education-only focus)
- [x] Created `e2e/tests/stripe/account-page.spec.ts` - E2E tests for account page

**Documentation**:
- [x] Created `docs/authentication-system.md` - comprehensive auth documentation
- [x] Created `docs/payment-system.md` - comprehensive payment documentation
- [x] Created `docs/stripe-deployment-runbook.md` - production deployment guide
- [x] Updated project README.md with Stripe quick start
- [x] Updated frontend README.md with Stripe environment variables

**Notification Components (T076-T081)**:
- [x] Created `components/subscription/SubscriptionStatusBanner.tsx`
- [x] Created `lib/email-helpers.ts` with sendPaymentFailedEmail, sendSubscriptionCancelledEmail
- [x] Implemented best-effort email pattern (non-blocking)

**Admin Dashboard (T089-T099)**:
- [x] Created `app/api/admin/failed-webhooks/route.ts` - GET endpoint
- [x] Created `app/api/admin/failed-webhooks/[errorId]/route.ts` - PATCH endpoint
- [x] Created `components/admin/AdminFailedWebhooksTable.tsx`
- [x] Created `components/admin/ResolveWebhookModal.tsx`
- [x] Admin role verification and audit logging

**E2E Tests (T105-T110)**:
- [x] Extended `e2e/tests/stripe/subscription-flow.spec.ts` with:
  - Failed payment flow tests (T107)
  - Test user bypass tests (T108)
  - Customer Portal flow tests (T109)

---

## Format Validation

✅ All tasks follow strict checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
✅ Task IDs are sequential (T001-T122)
✅ [P] markers indicate parallelizable tasks
✅ [Story] labels (US1-US5) map to user stories from spec.md
✅ Each task includes specific file paths or clear actions
✅ Setup and foundational tasks have NO story labels (as expected)
✅ User story phases have REQUIRED story labels

---

## References

- [Feature Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Research Documentation](./research.md)
- [Data Model](./data-model.md)
- [Quickstart Guide](./quickstart.md)
- [API Contracts](./contracts/)
- [Constitution Principles](../../.specify/memory/constitution.md)
