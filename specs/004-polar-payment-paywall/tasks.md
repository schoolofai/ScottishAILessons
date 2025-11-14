---
description: "Implementation tasks for Polar Payment Gateway with AI Lesson Paywall"
---

# Tasks: Polar Payment Gateway with AI Lesson Paywall

**Input**: Design documents from `/specs/004-polar-payment-paywall/`
**Prerequisites**: plan.md, spec.md (6 user stories), research.md, data-model.md, contracts/

**Tests**: No automated tests requested in spec.md - manual Playwright validation only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

**Constitution Compliance**: All tasks must respect `.specify/memory/constitution.md`:
- Fast-fail: No fallback patterns - exceptions with detailed logging
- Code quality: Files <500 lines, functions <50 lines (refactor if needed)
- Documentation: Update CLAUDE.md as part of completion
- Testing: Playwright manual validation per story

## Path Conventions
- Web app structure: `assistant-ui-frontend/` at repository root
- API routes: `assistant-ui-frontend/app/api/`
- Components: `assistant-ui-frontend/components/`
- Services: `assistant-ui-frontend/lib/services/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependencies

- [ ] T001 Install Polar SDK and validation dependencies: `pnpm install @polar-sh/nextjs zod` in assistant-ui-frontend/
- [ ] T002 Add Polar environment variables to assistant-ui-frontend/.env.local.example: POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_ID, POLAR_SERVER, TEST_USER_DOMAINS
- [ ] T003 Create API routes directory structure: assistant-ui-frontend/app/api/polar/ with checkout/, portal/, webhook/ subdirectories
- [ ] T004 Create services directory: assistant-ui-frontend/lib/services/ if not exists
- [ ] T005 Create middleware directory: assistant-ui-frontend/lib/middleware/ if not exists
- [ ] T006 Create paywall components directory: assistant-ui-frontend/components/paywall/
- [ ] T007 Create types directory: assistant-ui-frontend/lib/types/ if not exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create subscriptions collection in Appwrite: add schema per data-model.md with fields userId, polarCustomerId, polarSubscriptionId, planId, status, billingCycleStart, nextBillingDate, cancellationDate
- [ ] T009 Create unique index on subscriptions.userId in Appwrite console
- [ ] T010 Create unique index on subscriptions.polarSubscriptionId in Appwrite console
- [ ] T011 Create key index on subscriptions.status in Appwrite console
- [ ] T012 Create key index on subscriptions.nextBillingDate in Appwrite console
- [ ] T013 Create webhook_events collection in Appwrite: add schema with fields eventId, eventType, processingStatus, userId, payloadSnapshot, processedAt, processingDuration, errorDetails, retryCount
- [ ] T014 Create unique index on webhook_events.eventId in Appwrite console
- [ ] T015 Create key index on webhook_events.processingStatus in Appwrite console
- [ ] T016 Create key index on webhook_events.processedAt in Appwrite console
- [ ] T017 [P] Create TypeScript interfaces in assistant-ui-frontend/lib/types/subscription.ts: Subscription, WebhookEvent, SubscriptionStatus, PolarCustomer types matching data-model.md schemas
- [ ] T018 [P] Create Polar client wrapper in assistant-ui-frontend/lib/services/polar-client.ts: initialize SDK with env vars, export configured client, add error handling per research.md patterns
- [ ] T019 Create SubscriptionService in assistant-ui-frontend/lib/services/subscription-service.ts: implement getSubscription(), createSubscription(), updateSubscription(), checkAccess() with 1-hour cache per research.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Free User Discovers Value Before Paywall (Priority: P1) 🎯 MVP

**Goal**: Free users see paywall modal when attempting to start AI-powered lessons, with clear value proposition and upgrade CTA

**Independent Test**: Create free account → navigate to dashboard → click "Start Lesson" → verify paywall modal displays with "Student Plus", "$5.99/month", and "Upgrade Now" button

### Implementation for User Story 1

- [ ] T020 [P] [US1] Create PaywallModal component in assistant-ui-frontend/components/paywall/PaywallModal.tsx: display lesson title prop, 3-5 value proposition bullets, "$5.99/month Student Plus", "Upgrade Now" button (links to /api/polar/checkout), "Maybe Later" dismiss
- [ ] T021 [P] [US1] Create PaywallGuard middleware in assistant-ui-frontend/lib/middleware/paywall-guard.ts: implement checkAccess(userId) → calls SubscriptionService.checkAccess() → throws exception on failure (fast-fail, no silent fallback)
- [ ] T022 [US1] Modify EnhancedStudentDashboard component in assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx: add subscription status check before lesson start, show PaywallModal if access denied, add "Premium" badges to lessons for free users
- [ ] T023 [US1] Modify SessionChatAssistant component in assistant-ui-frontend/components/SessionChatAssistant.tsx: add paywall check on session initialization, block LLM token consumption if access denied, display PaywallModal for free users
- [ ] T024 [US1] Add logging to PaywallGuard in assistant-ui-frontend/lib/middleware/paywall-guard.ts: log all access checks with userId, action attempted, outcome (allowed/denied), timestamp
- [ ] T025 [US1] Style PaywallModal in assistant-ui-frontend/components/paywall/PaywallModal.tsx: implement dismissible modal (close button, click outside), ensure mobile responsiveness, match existing design system

**Checkpoint**: At this point, free users should see paywall when clicking "Start Lesson". Verify manually via Playwright.

---

## Phase 4: User Story 2 - Seamless Subscription Purchase Flow (Priority: P1)

**Goal**: Free users can upgrade via Polar checkout, complete payment securely, and automatically gain access upon return to app

**Independent Test**: Start as free user → click "Upgrade Now" in paywall → complete Polar checkout with test card 4242 4242 4242 4242 → verify automatic redirect back to app → confirm ability to start lessons without page refresh

### Implementation for User Story 2

- [ ] T026 [US2] Create checkout API route in assistant-ui-frontend/app/api/polar/checkout/route.ts: implement GET handler that creates Polar checkout session with pre-filled email, product ID from env, success/cancel URLs, custom metadata (userId), redirect with 302 status
- [ ] T027 [US2] Add checkout error handling in assistant-ui-frontend/app/api/polar/checkout/route.ts: catch Polar API errors (429 rate limit, 500 server errors), return user-friendly messages per research.md patterns, log detailed error context
- [ ] T028 [US2] Create webhook API route in assistant-ui-frontend/app/api/polar/webhook/route.ts: use Polar SDK Webhooks() helper with signature validation, implement onPayload handler, return 200 OK on success
- [ ] T029 [US2] Implement webhook event processing in assistant-ui-frontend/app/api/polar/webhook/route.ts: handle checkout.completed → call SubscriptionService.createSubscription(), handle subscription.created/updated/cancelled → call SubscriptionService.updateSubscription()
- [ ] T030 [US2] Add webhook idempotency check in assistant-ui-frontend/app/api/polar/webhook/route.ts: check webhook_events collection for event.id before processing, skip if already processed, log to webhook_events after processing per research.md idempotency pattern
- [ ] T031 [US2] Add webhook failure alerting in assistant-ui-frontend/app/api/polar/webhook/route.ts: track consecutive failure count in webhook_events, log alert after 3 consecutive failures (FR-033), throw exception to trigger Polar retry
- [ ] T032 [US2] Implement subscription sync in assistant-ui-frontend/lib/services/subscription-service.ts: add syncFromPolar() method that updates subscriptions collection from webhook event data, invalidate cache on update
- [ ] T033 [US2] Add checkout session logging in assistant-ui-frontend/app/api/polar/checkout/route.ts: log all checkout creation attempts with userId, timestamp, product selection, outcome (success/failure with error details)

**Checkpoint**: At this point, users should complete checkout and automatically gain access. Test with Polar sandbox test cards.

---

## Phase 5: User Story 3 - Paid User Accesses Premium Features (Priority: P1)

**Goal**: Paid users freely access AI lessons, view subscription status in UI, and see confirmation of membership

**Independent Test**: Manually activate test subscription → verify all AI features accessible → confirm subscription status displays correctly (plan name, expiry date, "Manage Subscription" button) → start multiple lessons to ensure consistent access

### Implementation for User Story 3

- [ ] T034 [P] [US3] Create subscription status API route in assistant-ui-frontend/app/api/subscription/status/route.ts: implement GET handler that returns current user's subscription status from SubscriptionService, include 1-hour cache headers, return 404 if no subscription
- [ ] T035 [P] [US3] Create SubscriptionBadge component in assistant-ui-frontend/components/paywall/SubscriptionBadge.tsx: display "Student Plus" plan name, next billing date, subscription status indicator (active/cancelled), "Manage Subscription" button
- [ ] T036 [US3] Update EnhancedStudentDashboard component in assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx: fetch subscription status on mount, remove "Premium" badges for paid users, display SubscriptionBadge in header/settings
- [ ] T037 [US3] Update SessionChatAssistant component in assistant-ui-frontend/components/SessionChatAssistant.tsx: verify paid access before session start, allow immediate lesson launch without paywall check for paid users
- [ ] T038 [US3] Add subscription status response schemas in assistant-ui-frontend/lib/types/subscription.ts: SubscriptionStatus interface with hasAccess, status, planName, nextBillingDate, cancellationDate, isTestUser, cached, cachedAt fields
- [ ] T039 [US3] Add error responses to subscription status API in assistant-ui-frontend/app/api/subscription/status/route.ts: return 401 if not authenticated, return 500 with error code on database failure (fast-fail per constitution)

**Checkpoint**: Paid users should see subscription status and access all features without paywall. Test subscription status API responses.

---

## Phase 6: User Story 4 - Test User Bypass for Development (Priority: P2)

**Goal**: Designated test users (by email domain) access all AI features without payment, with visual "Test Account" badge

**Independent Test**: Create user with test email test@scottishailessons.com → verify can start lessons without payment → confirm no Polar charges created → check "Test Account" badge displays

### Implementation for User Story 4

- [ ] T040 [P] [US4] Implement test user detection in assistant-ui-frontend/lib/services/subscription-service.ts: add isTestUser(email) helper that checks TEST_USER_DOMAINS env var, modify checkAccess() to return true immediately for test users
- [ ] T041 [P] [US4] Create TestUserBadge component in assistant-ui-frontend/components/paywall/TestUserBadge.tsx: display "Test Account" indicator with distinct styling (different from paid user badge)
- [ ] T042 [US4] Update PaywallGuard middleware in assistant-ui-frontend/lib/middleware/paywall-guard.ts: add test user check before subscription lookup, log test user access grants separately
- [ ] T043 [US4] Update subscription status API in assistant-ui-frontend/app/api/subscription/status/route.ts: include isTestUser field in response, return status="test" for test users
- [ ] T044 [US4] Update EnhancedStudentDashboard component in assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx: display TestUserBadge instead of SubscriptionBadge for test users, hide subscription management options
- [ ] T045 [US4] Add test user logging in assistant-ui-frontend/lib/services/subscription-service.ts: log all test user access grants with email, action, timestamp for audit trail

**Checkpoint**: Test users should bypass paywall without Polar API calls. Verify no billing records created.

---

## Phase 7: User Story 5 - Graceful Subscription Expiry Handling (Priority: P2)

**Goal**: Expired users can view dashboard but encounter paywall with context-aware messaging (e.g., "Your subscription expired on [DATE]")

**Independent Test**: Simulate subscription expiry (manual database update or webhook) → verify user can access dashboard → confirm paywall appears on lesson start → check messaging reflects expired status

### Implementation for User Story 5

- [ ] T046 [US5] Add expiry detection in assistant-ui-frontend/lib/services/subscription-service.ts: modify checkAccess() to check nextBillingDate against current date, return false if expired
- [ ] T047 [US5] Update PaywallModal component in assistant-ui-frontend/components/paywall/PaywallModal.tsx: add expiry context prop, display "Your subscription expired on [DATE]" if subscription exists but expired, change CTA to "Renew Subscription"
- [ ] T048 [US5] Handle subscription.cancelled webhook in assistant-ui-frontend/app/api/polar/webhook/route.ts: update subscription status to "cancelled", set cancellationDate, maintain access until nextBillingDate (period end)
- [ ] T049 [US5] Update subscription status API in assistant-ui-frontend/app/api/subscription/status/route.ts: return status="expired" and hasAccess=false for expired subscriptions, include cancellationDate in response
- [ ] T050 [US5] Update PaywallGuard middleware in assistant-ui-frontend/lib/middleware/paywall-guard.ts: pass subscription expiry context to PaywallModal when denying access to expired users

**Checkpoint**: Expired users should see contextual paywall messaging. Test by updating subscription status to "expired" in database.

---

## Phase 8: User Story 6 - Subscription Management via Customer Portal (Priority: P3)

**Goal**: Paid users access Polar customer portal to manage subscriptions (view billing history, update payment, cancel)

**Independent Test**: Log in as paid user → click "Manage Subscription" → verify redirect to Polar portal → make changes (update card or cancel) → confirm changes reflect in app dashboard

### Implementation for User Story 6

- [ ] T051 [US6] Create portal API route in assistant-ui-frontend/app/api/polar/portal/route.ts: implement GET handler that resolves customer ID from user session, creates Polar portal session, redirects with 302 status
- [ ] T052 [US6] Add customer ID resolution in assistant-ui-frontend/lib/services/subscription-service.ts: implement getCustomerId(userId) method that retrieves polarCustomerId from subscriptions collection
- [ ] T053 [US6] Add portal redirect error handling in assistant-ui-frontend/app/api/polar/portal/route.ts: catch errors if no subscription found, return user-friendly message, log error context
- [ ] T054 [US6] Update SubscriptionBadge component in assistant-ui-frontend/components/paywall/SubscriptionBadge.tsx: add "Manage Subscription" button that links to /api/polar/portal
- [ ] T055 [US6] Handle portal return URL in assistant-ui-frontend/app/api/polar/portal/route.ts: configure return URL to dashboard, refresh subscription status immediately on return
- [ ] T056 [US6] Add portal access logging in assistant-ui-frontend/app/api/polar/portal/route.ts: log all portal access attempts with userId, timestamp, outcome

**Checkpoint**: Paid users should access Polar portal and see changes reflected in app within 1 minute via webhooks.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T057 [P] Update CLAUDE.md documentation in repository root: add Polar integration setup instructions, environment variables, webhook configuration, testing with sandbox
- [ ] T058 [P] Add Polar sandbox setup guide to quickstart.md in specs/004-polar-payment-paywall/: document test card numbers, webhook testing with Polar CLI, ngrok setup
- [ ] T059 Code review: verify all files <500 lines (refactor if needed), functions <50 lines (extract helpers), no fallback patterns (all fast-fail with exceptions)
- [ ] T060 Validate quickstart.md end-to-end: follow setup guide from scratch, verify all API routes working, test checkout flow, simulate webhook events
- [ ] T061 [P] Add loading states in assistant-ui-frontend/components/paywall/PaywallModal.tsx: show spinner during checkout redirect, prevent double-click on "Upgrade Now" button
- [ ] T062 [P] Add loading states in assistant-ui-frontend/components/paywall/SubscriptionBadge.tsx: show loading indicator while fetching subscription status
- [ ] T063 Optimize subscription status cache in assistant-ui-frontend/lib/services/subscription-service.ts: verify 1-hour TTL implementation, confirm cache invalidation on webhook events, measure <500ms response time
- [ ] T064 Security review: verify webhook signature validation enabled, user ID validation in API routes (prevent privilege escalation), no payment details stored locally
- [ ] T065 Manual Playwright test validation for US1: test as free user, verify paywall appears <2 seconds on lesson click, check value proposition display
- [ ] T066 Manual Playwright test validation for US2: complete checkout with test card, verify redirect, confirm immediate access without refresh
- [ ] T067 Manual Playwright test validation for US3: verify paid user dashboard display, test subscription status API, start multiple lessons
- [ ] T068 Manual Playwright test validation for US4: test with test@scottishailessons.com, verify bypass, check no Polar API calls logged
- [ ] T069 Manual Playwright test validation for US5: simulate expiry, verify contextual paywall messaging
- [ ] T070 Manual Playwright test validation for US6: access portal, make changes, verify sync

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (US1, P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (US2, P1)**: Can start after Foundational (Phase 2) - No dependencies on US1 (webhook processing is independent)
- **User Story 3 (US3, P1)**: Can start after Foundational (Phase 2) - Integrates with US1 components but independently testable
- **User Story 4 (US4, P2)**: Can start after Foundational (Phase 2) - Extends US1 logic but independently testable
- **User Story 5 (US5, P2)**: Can start after US2 (webhook processing) and US1 (paywall modal) - Enhances existing flows
- **User Story 6 (US6, P3)**: Can start after US3 (subscription badge) - Portal is separate feature

### Within Each User Story

- Models/types before services
- Services before API routes
- API routes before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] (T017, T018 in Phase 2) can run in parallel
- Once Foundational phase completes, US1, US2, US3 can start in parallel (all P1 priority)
- Within each story, tasks marked [P] can run in parallel:
  - US1: T020, T021 (PaywallModal and PaywallGuard)
  - US3: T034, T035 (API route and Badge component)
  - US4: T040, T041 (test detection and badge)
  - Phase 9: T057, T058, T061, T062 (documentation and loading states)

---

## Parallel Example: User Story 1

```bash
# Launch PaywallModal and PaywallGuard together (different files):
Task T020: "Create PaywallModal component in assistant-ui-frontend/components/paywall/PaywallModal.tsx"
Task T021: "Create PaywallGuard middleware in assistant-ui-frontend/lib/middleware/paywall-guard.ts"
```

---

## Parallel Example: Phase 2 Foundational

```bash
# After collections are created (T008-T016), launch type definitions and service stubs in parallel:
Task T017: "Create TypeScript interfaces in assistant-ui-frontend/lib/types/subscription.ts"
Task T018: "Create Polar client wrapper in assistant-ui-frontend/lib/services/polar-client.ts"
```

---

## Implementation Strategy

### MVP First (P1 User Stories Only)

1. Complete Phase 1: Setup (T001-T007)
2. Complete Phase 2: Foundational (T008-T019) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T020-T025) - Paywall display
4. Complete Phase 4: User Story 2 (T026-T033) - Checkout flow
5. Complete Phase 5: User Story 3 (T034-T039) - Paid access
6. **STOP and VALIDATE**: Test P1 stories independently with Playwright
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Paywall visible!)
3. Add User Story 2 → Test independently → Deploy/Demo (Checkout working!)
4. Add User Story 3 → Test independently → Deploy/Demo (Paid access confirmed! MVP complete!)
5. Add User Story 4 → Test independently → Deploy/Demo (Test users can develop)
6. Add User Story 5 → Test independently → Deploy/Demo (Expiry handling graceful)
7. Add User Story 6 → Test independently → Deploy/Demo (Full feature set)
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T019)
2. Once Foundational is done:
   - Developer A: User Story 1 (T020-T025) - Paywall UI
   - Developer B: User Story 2 (T026-T033) - Checkout & Webhooks
   - Developer C: User Story 3 (T034-T039) - Subscription Status
3. Stories complete and integrate independently
4. P2 stories (US4, US5) can proceed after P1 merge
5. P3 story (US6) completes last

---

## Task Summary

- **Total Tasks**: 70 tasks
- **Setup (Phase 1)**: 7 tasks
- **Foundational (Phase 2)**: 12 tasks (2 parallelizable)
- **User Story 1 (P1)**: 6 tasks (2 parallelizable)
- **User Story 2 (P1)**: 8 tasks
- **User Story 3 (P1)**: 6 tasks (2 parallelizable)
- **User Story 4 (P2)**: 6 tasks (2 parallelizable)
- **User Story 5 (P2)**: 5 tasks
- **User Story 6 (P3)**: 6 tasks
- **Polish (Phase 9)**: 14 tasks (4 parallelizable)

**Parallel Opportunities**: 12 tasks can run in parallel (marked with [P])

**Independent Test Criteria**:
- US1: Paywall appears when free user clicks "Start Lesson"
- US2: Checkout completes and access granted without refresh
- US3: Paid users see subscription status and access features
- US4: Test users bypass paywall without billing
- US5: Expired users see contextual messaging
- US6: Portal access works and changes sync

**Suggested MVP Scope**: Complete Phases 1-5 (US1, US2, US3 - all P1 priority) for fully functional payment system with 37 tasks.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All API routes must follow fast-fail pattern (no silent fallbacks)
- Verify webhook idempotency before deploying to production
- Use Polar sandbox mode with test cards for all development
- Monitor subscription status cache hit rate (target: >95% within 500ms)
