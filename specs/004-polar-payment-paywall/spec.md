# Feature Specification: Polar Payment Gateway with AI Lesson Paywall

**Feature Branch**: `004-polar-payment-paywall`
**Created**: 2025-11-13
**Status**: Draft
**Input**: User description: "i want to integrate polar for payment processing - integrating polar documentation is here - https://polar.sh/docs/integrate/sdk/adapters/nextjs - i want all features that consume llm tokens like lessons from @assistant-ui-frontend/components/dashboard/EnhancedStudentDashboard.tsx and lesson execution in @assistant-ui-frontend/components/SessionChatAssistant.tsx to be behind a paywall - use well used UX for non paying users to paywall. I also want test users to be granted access without bieng billed."

## Clarifications

### Session 2025-11-13

- Q: What is the monthly subscription price for the MVP premium tier? → A: $5.99/month USD (Polar only supports USD; GBP equivalent ~£4.60)
- Q: What should the premium subscription tier be called in the UI? → A: "Student Plus"
- Q: After how many consecutive webhook failures should the system alert administrators? → A: 3 consecutive failures
- Q: Should new subscribers get a free trial period before being charged? → A: No trial for MVP (immediate payment). Future enhancement: free lesson credits system to reduce user acquisition costs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Free User Discovers Value Before Paywall (Priority: P1)

A new user browses the course catalog and dashboard, sees AI-recommended lessons with preview information (lesson titles, descriptions, difficulty), but encounters a friendly paywall modal when attempting to start any AI-powered lesson. The modal explains the value proposition and offers a clear upgrade path.

**Why this priority**: This is the core conversion funnel - users must understand what they're paying for before committing. Without this, we have no revenue model.

**Independent Test**: Can be fully tested by creating a free account, navigating to dashboard, clicking "Start Lesson" on any recommended lesson, and verifying the paywall modal appears with clear messaging and upgrade CTA.

**Acceptance Scenarios**:

1. **Given** a user with no active subscription, **When** they view the student dashboard, **Then** they see lesson recommendations with titles, descriptions, and "Premium" badges but cannot start lessons
2. **Given** a free user clicks "Start Lesson", **When** the paywall modal appears, **Then** it displays: lesson title, value proposition (3-5 key benefits), pricing information, and "Upgrade Now" button
3. **Given** a user in the paywall modal, **When** they click "Upgrade Now", **Then** they are redirected to Polar checkout with their email pre-filled

---

### User Story 2 - Seamless Subscription Purchase Flow (Priority: P1)

A free user decides to upgrade after seeing the paywall. They click the upgrade button, are redirected to Polar's hosted checkout page with their email pre-filled, complete payment securely on Polar's domain, and are automatically redirected back to the application with immediate access to start lessons.

**Why this priority**: Critical for revenue generation - must be frictionless or users will abandon. This delivers immediate business value.

**Independent Test**: Can be tested end-to-end by starting as free user → clicking upgrade → completing Polar checkout (with test card) → verifying automatic redirect back to app → confirming ability to start lessons without page refresh.

**Acceptance Scenarios**:

1. **Given** a free user on the upgrade path, **When** redirected to Polar checkout, **Then** the checkout displays: product name, pricing, pre-filled email, and secure payment form
2. **Given** a user completes payment on Polar, **When** Polar processes the transaction, **Then** the user is redirected to the success URL with immediate benefit activation
3. **Given** a newly paid user returns to dashboard, **When** they click "Start Lesson", **Then** the lesson launches immediately without showing paywall

---

### User Story 3 - Paid User Accesses Premium Features (Priority: P1)

A user with an active subscription browses the dashboard and can freely start any AI-powered lesson, view AI recommendations without restrictions, and see confirmation of their subscription status in the UI (e.g., "Premium Member" badge, subscription expiry date).

**Why this priority**: This is the actual product delivery - paid users must receive what they paid for immediately and reliably.

**Independent Test**: Can be tested by manually activating a test subscription → verifying all AI features are accessible → confirming subscription status displays correctly → starting multiple lessons to ensure consistent access.

**Acceptance Scenarios**:

1. **Given** a user with active subscription, **When** they view the dashboard, **Then** they see no "Premium" badges on lessons and all "Start Lesson" buttons function normally
2. **Given** a paid user clicks "Start Lesson", **When** the session loads, **Then** the lesson starts immediately without any paywall check
3. **Given** a paid user views their profile/settings, **When** they navigate to subscription section, **Then** they see: subscription status (active), plan name, next billing date, and "Manage Subscription" button

---

### User Story 4 - Test User Bypass for Development (Priority: P2)

Designated test users (identified by specific email domains or explicit user IDs) can access all AI-powered features without requiring payment. These users see a visual indicator (e.g., "Test Account" badge) confirming their special status but otherwise experience the full paid feature set.

**Why this priority**: Essential for QA testing, demos, and development, but doesn't block revenue generation for real users.

**Independent Test**: Can be tested by creating a user with test email (e.g., test@scottishailessons.com) → verifying they can start lessons without payment → confirming no Polar charges are created → checking test badge displays correctly.

**Acceptance Scenarios**:

1. **Given** a user with test email domain (scottishailessons.com), **When** they attempt to start a lesson, **Then** the lesson launches immediately without paywall check
2. **Given** a test user on the dashboard, **When** viewing their account, **Then** they see a "Test Account" badge and no subscription management options
3. **Given** a test user starts multiple lessons, **When** backend logs are checked, **Then** no Polar API calls are logged and no token consumption is billed

---

### User Story 5 - Graceful Subscription Expiry Handling (Priority: P2)

When a user's subscription expires (payment fails, cancellation, or trial ends), they can still view the dashboard and see lesson recommendations, but attempting to start lessons triggers the paywall modal again with context-aware messaging (e.g., "Your subscription has expired. Renew to continue learning").

**Why this priority**: Prevents user confusion and provides re-engagement opportunity, but not critical for initial launch.

**Independent Test**: Can be tested by simulating subscription expiry (webhook event or manual database update) → verifying user can still access dashboard → confirming paywall appears on lesson start → checking messaging reflects expired status.

**Acceptance Scenarios**:

1. **Given** a user whose subscription expired, **When** they log in and view dashboard, **Then** they see all content but "Premium" badges reappear on lessons
2. **Given** an expired user clicks "Start Lesson", **When** paywall modal appears, **Then** it displays: "Your subscription expired on [DATE]", benefits reminder, and "Renew Subscription" CTA
3. **Given** an expired user clicks "Renew Subscription", **When** redirected to Polar, **Then** checkout pre-fills their previous payment details (if saved) for quick renewal

---

### User Story 6 - Subscription Management via Customer Portal (Priority: P3)

Paid users can access their subscription management portal to view billing history, update payment methods, change subscription plans, or cancel their subscription. All actions are handled securely through Polar's hosted portal with automatic synchronization back to the application.

**Why this priority**: Important for user autonomy and reducing support burden, but can be implemented after core payment flow is working.

**Independent Test**: Can be tested by logging in as paid user → clicking "Manage Subscription" → verifying redirect to Polar portal → making changes (update card, cancel) → confirming changes reflect in app dashboard.

**Acceptance Scenarios**:

1. **Given** a paid user in app settings, **When** they click "Manage Subscription", **Then** they are redirected to Polar's customer portal with authenticated session
2. **Given** a user in Polar portal updates payment method, **When** they return to the app, **Then** updated card details display in subscription section (last 4 digits)
3. **Given** a user cancels subscription in Polar portal, **When** cancellation webhook is received, **Then** app marks subscription as "cancelled" with access retained until period end

---

### Edge Cases

- **What happens when user closes payment page without completing?** User returns to app as free user, can retry payment anytime via upgrade button, no partial charges occur
- **How does system handle webhook delivery failures?** Polar retries webhooks automatically, app logs failed webhook attempts, alerts administrators after 3 consecutive failures, manual reconciliation available via admin panel for critical failures
- **What if user has multiple browser sessions when subscription activates?** Subscription check occurs on every protected action (lesson start), so all sessions gain access immediately without requiring refresh
- **How to handle downgrade scenarios?** If user downgrades mid-billing cycle, they retain current tier access until period end, then automatically transition to new tier
- **What if test user email domain changes?** Test user status is checked against current configuration on every request, so domain list updates apply immediately without user logout/login
- **How to prevent users from repeatedly creating free trials?** Track subscriptions by email address and payment method fingerprint, block duplicate trials with clear messaging
- **What happens during Polar API outages?** Cached subscription status (refreshed hourly) allows continued access for existing paid users, new checkouts temporarily unavailable with graceful error message
- **How to handle timezone differences in expiry dates?** All subscription dates stored in UTC, display converted to user's browser timezone, grace period of 24 hours before hard cutoff
- **What if webhook arrives before user redirects back from checkout?** Webhook processing sets subscription active, redirect handles gracefully even if redundant, user sees success message on return

## Requirements *(mandatory)*

### Functional Requirements

**Constitution Alignment**: All requirements MUST follow fast-fail principles (no fallback mechanisms). Use MUST for mandatory behavior, SHOULD for recommended but optional behavior. See `.specify/memory/constitution.md`.

#### Authentication & User Context

- **FR-001**: System MUST identify user subscription status by checking user record against active subscription records before rendering any AI-powered feature UI
- **FR-002**: System MUST designate users as "test users" based on configurable email domain list (e.g., @scottishailessons.com) or explicit user ID allowlist stored in environment configuration
- **FR-003**: System MUST throw detailed exception with user context if subscription check fails due to database unavailability (no silent fallback to free tier)

#### Paywall Enforcement

- **FR-004**: System MUST display paywall modal when free users attempt to start lessons from dashboard recommendations (EnhancedStudentDashboard component)
- **FR-005**: System MUST block access to lesson execution (SessionChatAssistant component) for free users by intercepting session start before any LLM tokens are consumed
- **FR-006**: System MUST allow test users to bypass paywall checks entirely without creating Polar customer records or logging token consumption to billing
- **FR-007**: Paywall modal MUST display: lesson title, value proposition (3-5 bullet points), current subscription tier, "$5.99/month Student Plus subscription" pricing, "Upgrade Now" CTA, and "Maybe Later" dismissal option
- **FR-008**: System MUST prevent free users from accessing LLM-powered features including: lesson recommendations API calls, lesson session starts, AI tutor interactions, and spaced repetition review generation

#### Polar Integration - Checkout Flow

- **FR-009**: System MUST initialize Polar SDK with environment-specific credentials (access token, webhook secret) and fail fast with clear error if credentials are missing or invalid
- **FR-010**: System MUST create Polar checkout sessions with pre-filled customer email, selected product/plan ID, success redirect URL (dashboard with confirmation message), and custom metadata (user ID, signup source)
- **FR-011**: Checkout redirect URL MUST use absolute URLs with protocol (https://) and include signed token parameter for return verification
- **FR-012**: System MUST log all Polar checkout creation attempts with user ID, timestamp, product selection, and outcome (success/failure with error details)

#### Polar Integration - Webhook Processing

- **FR-013**: System MUST validate incoming Polar webhooks using webhook secret signature verification and reject unsigned or invalid requests with 401 status
- **FR-014**: System MUST process webhook events for: `checkout.completed`, `subscription.created`, `subscription.updated`, `subscription.cancelled`, `benefit.grant.created`, `benefit.grant.revoked`
- **FR-015**: System MUST update user subscription status atomically within webhook handler and throw exception if database transaction fails (no partial updates)
- **FR-016**: System MUST send webhook acknowledgment (200 OK) only after successful processing and persist webhook event ID to prevent duplicate processing
- **FR-017**: System MUST log all webhook processing attempts with: event ID, event type, user affected, processing outcome, and execution duration for monitoring

#### Subscription Status Management

- **FR-018**: System MUST store subscription records with: user ID, Polar subscription ID, plan ID (referencing "Student Plus" product), status (active/cancelled/expired), billing cycle start date, next billing date, cancellation date (if applicable)
- **FR-019**: System MUST refresh cached subscription status on: user login, before starting premium actions, and automatically every 1 hour for active sessions
- **FR-020**: System MUST grant access to AI features if user has: active subscription with future expiry date, OR test user designation
- **FR-021**: System MUST revoke access immediately when subscription expires, is cancelled, or payment fails, with no grace period beyond billing cycle end date
- **FR-022**: System MUST handle subscription updates (plan changes, payment method updates) by processing webhook events and refreshing user session state

#### Customer Portal Integration

- **FR-023**: System MUST provide "Manage Subscription" link in user settings that redirects to Polar customer portal with authenticated customer session
- **FR-024**: Customer portal redirect MUST resolve customer identity using internal user ID to Polar customer ID mapping stored in subscription records
- **FR-025**: System MUST handle customer portal return URL and refresh subscription status immediately after user completes portal actions

#### UI/UX Requirements

- **FR-026**: Dashboard MUST display visual indicators for premium content including "Premium" badges on lessons, lock icons, and upgrade prompts
- **FR-027**: Paid user dashboard MUST display subscription status widget showing: "Student Plus" plan name, renewal date, "Manage Subscription" link
- **FR-028**: Paywall modal MUST be dismissible (close button, click outside) and remember dismissal for current session to avoid annoying repeated prompts
- **FR-029**: Test users MUST see "Test Account" badge in header/profile to distinguish their special access status
- **FR-030**: System MUST show loading states during: subscription checks, checkout redirect, webhook processing completion

#### Error Handling

- **FR-031**: System MUST throw exception with detailed context (user ID, action attempted, subscription status) when paywall check fails due to system error (no silent access grant)
- **FR-032**: Checkout creation failures MUST display user-friendly error message with retry option and support contact information
- **FR-033**: Webhook processing failures MUST log full error context and mark event for manual review without blocking user experience
- **FR-034**: Subscription status cache misses MUST trigger immediate database lookup and throw exception if lookup fails (no stale cache fallback)

### Key Entities

- **User**: Represents application user with fields: user ID, email, account creation date, test user flag, current subscription reference
- **Subscription**: Represents Polar subscription with fields: subscription ID, user reference, Polar subscription ID, Polar customer ID, plan ID, status (active/cancelled/expired), billing cycle start date, next billing date, cancellation date, created timestamp, last updated timestamp
- **Webhook Event Log**: Tracks processed webhooks with fields: event ID (Polar's), event type, processing status (pending/completed/failed), user affected, payload snapshot, processing timestamp, error details (if failed)
- **Product Plan**: Configuration data defining available subscription tiers with fields: plan ID (Polar product ID), display name ("Student Plus"), description, price ($5.99/month), billing interval (monthly), feature flags (JSON indicating which features unlock)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Free users encounter paywall within 2 seconds of attempting to start a premium lesson, with clear upgrade path presented
- **SC-002**: Paid users can start AI-powered lessons immediately after payment confirmation without requiring logout/login or page refresh
- **SC-003**: Checkout completion rate for $5.99/month Student Plus subscription exceeds 70% (users who click "Upgrade Now" complete payment on Polar)
- **SC-004**: Webhook processing completes within 5 seconds of receipt, with subscription status updated before user redirects back to app
- **SC-005**: Test users can access all premium features without generating Polar API calls or billing records
- **SC-006**: Zero false negatives (paid users incorrectly blocked) and zero false positives (free users gaining unauthorized access) in subscription checks
- **SC-007**: 95% of subscription status checks complete in under 500ms using cached data
- **SC-008**: System handles at least 100 concurrent checkout sessions without degradation
- **SC-009**: All webhook events are processed idempotently (duplicate events do not corrupt subscription state)
- **SC-010**: Users can cancel/modify subscriptions via Polar portal with changes reflecting in app within 1 minute

## Assumptions

1. Polar SDK is compatible with Next.js 14+ app router (based on documentation)
2. Application uses Appwrite for user authentication and database (based on existing codebase context)
3. Users have valid payment methods supported by Polar (credit cards, regional payment methods)
4. Subscription model is simple (single tier, monthly billing) - complex tier management is out of scope for MVP
5. Email is the primary user identifier for Polar customer matching
6. Application is hosted with webhook-accessible endpoints (not localhost for production webhooks)
7. Test user designation is sufficient for development/QA without requiring full sandbox environment
8. LLM token consumption tracking already exists and can be gated by subscription checks
9. Polar handles PCI compliance, secure payment processing, and fraud prevention - application only handles access control
10. Users accept that cancellation takes effect at billing cycle end (no partial refunds in MVP)
11. Polar only supports USD pricing; currency conversion for GBP/EUR users handled by payment providers at checkout

## Dependencies

- **External**: Polar SDK (`@polar-sh/nextjs` npm package), Polar API access with valid credentials
- **Internal**: Appwrite databases for subscription storage, existing authentication system for user session management
- **Environment**: Webhook-accessible deployment environment (production URLs), HTTPS endpoints for Polar redirects

## Out of Scope

- Multi-tier subscription plans with different feature sets (MVP uses single premium tier)
- Partial refunds or prorated charges on cancellation
- Family/team subscription plans with multiple user access
- Gift subscriptions or promo code systems
- Subscription analytics dashboard for admins (basic logging only)
- Automatic subscription pause/hold features
- Integration with accounting systems (Xero, QuickBooks)
- Custom billing intervals beyond monthly
- White-label payment pages (uses Polar's hosted checkout)
- Email receipts (handled by Polar automatically)
- Free lesson credits system (planned future enhancement to reduce user acquisition costs)

## Security Considerations

- **Webhook Signature Verification**: All incoming webhooks must be validated using Polar's signature mechanism to prevent unauthorized access
- **User ID Validation**: Subscription status checks must validate that requested user ID matches authenticated session user to prevent privilege escalation
- **Sensitive Data Exposure**: Payment details (card numbers, billing addresses) must never be stored in application database - only reference IDs
- **Test User Abuse Prevention**: Test user email domains must be configurable only by system administrators via environment variables, not user-facing UI
- **Checkout Tampering**: Checkout redirect URLs must include signed tokens to verify return legitimacy and prevent forged success responses

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Polar API downtime during checkout | High - users cannot upgrade | Low | Cache subscription status for existing users, display maintenance message for new checkouts, provide alternative payment contact method |
| Webhook delivery delays causing access delay | Medium - user frustration | Medium | Implement 5-minute client-side polling after checkout redirect to refresh status, display "Processing payment..." message |
| Test user designation leaks to production users | High - revenue loss | Low | Store test domain list in environment variables, log all test user access attempts for audit, regular review of test user list |
| Race condition between webhook and redirect | Low - user sees success then denial | Low | Process webhook with idempotency key, use optimistic locking on subscription updates, show loading state until confirmation |
| Subscription status cache becomes stale | Medium - paid users blocked | Low | Implement cache TTL of 1 hour, automatic refresh on 401 errors, manual refresh button in UI |

## Open Questions

None - all critical decisions have reasonable defaults documented in Assumptions section.
