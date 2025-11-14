# Feature Specification: Stripe Subscription Paywall for AI Features

**Feature Branch**: `004-stripe-subscription-paywall`
**Created**: 2025-11-14
**Status**: Draft
**Input**: User description: "I need to integrate stripe payment for a monthly subscription to the front end. All features that use langgraph backend like langgraph-generic-chat and langgraph-agent should be behind paywall and non paying accounts should not be able to use AI metered backend. These are accessed from EnhancedStudentDashboard taking lessons on any of the enrolled courses - taking a lesson takes user to SessionChatAssistant where user gets access to both langgraph-agent and langgraph-generic-chat which is cost inducing and costly so has to be behind paywall. I also want test users to have full access without the paywall. I also want you to add requirement for me to setup stripe product - i have a stripe account - and any manual steps that i need to do to make the integration work - assume that i do not have no knowledge of stripe - support both test and development and deployment instructions."

## Clarifications

### Session 2025-11-14

- Q: How long should users have to update their payment method after a payment failure before losing AI feature access? → A: Immediate revocation (no grace period)
- Q: What happens when a user completes Stripe checkout but the webhook fails to update the database? → A: Manual admin intervention with monitoring alerts
- Q: What specific email domain pattern should automatically flag users as test users? → A: Exact whitelist: @testuser.com only
- Q: What is the notification delivery strategy if email fails after a failed payment? → A: In-app banner primary, email best-effort

## User Scenarios & Testing

### User Story 1 - Subscription Purchase Journey (Priority: P1)

A new student registers and wants to access AI-powered lesson features. They are shown a clear subscription prompt explaining the benefits of the premium AI tutoring features. They can view pricing, purchase a monthly subscription, and immediately gain access to all AI-powered lessons without any additional friction.

**Why this priority**: This is the core monetization flow. Without the ability to purchase subscriptions, the paywall cannot function, and revenue cannot be generated. This represents the minimum viable product for the payment integration.

**Independent Test**: Can be fully tested by creating a new account, navigating to the dashboard, clicking "Subscribe", completing Stripe checkout, and verifying that AI lesson features become immediately accessible.

**Acceptance Scenarios**:

1. **Given** a non-subscribed user on the dashboard, **When** they attempt to start a lesson, **Then** they see a subscription prompt with pricing and benefits
2. **Given** a user on the subscription prompt, **When** they click "Subscribe Now", **Then** they are redirected to Stripe Checkout with the monthly subscription product
3. **Given** a user completes Stripe checkout successfully, **When** they return to the dashboard, **Then** they can immediately start AI-powered lessons without seeing the paywall again
4. **Given** a user completes payment, **When** the system processes the Stripe webhook, **Then** their subscription status is updated in the database within 5 seconds

---

### User Story 2 - Subscription Status Verification and Access Control (Priority: P1)

A subscribed user logs in and expects seamless access to all AI-powered features across sessions. The system verifies their active subscription status and grants access to EnhancedStudentDashboard lesson starts and SessionChatAssistant interactions. Non-subscribed users attempting to access these features are immediately blocked with clear messaging.

**Why this priority**: This is the enforcement mechanism for the paywall. Without proper access control, users could bypass payment and access costly AI services, leading to financial loss. This is equally critical to the purchase flow.

**Independent Test**: Can be tested independently by creating two accounts (one subscribed, one not), logging in with each, and verifying that lesson start buttons and AI tutor access behave correctly based on subscription status.

**Acceptance Scenarios**:

1. **Given** a subscribed user on the dashboard, **When** they click "Start Lesson" on any enrolled course, **Then** they are taken directly to the SessionChatAssistant without seeing a paywall
2. **Given** a non-subscribed user on the dashboard, **When** they click "Start Lesson", **Then** they see a paywall message with a "Subscribe" call-to-action
3. **Given** a subscribed user in an active lesson, **When** they interact with the AI Tutor (context chat), **Then** the feature works without interruption
4. **Given** a non-subscribed user attempts to access SessionChatAssistant directly via URL, **When** the page loads, **Then** they are redirected to the subscription page with an error message
5. **Given** a user's subscription expires, **When** they next attempt to start a lesson, **Then** they see the subscription prompt again

---

### User Story 3 - Test User Bypass (Priority: P2)

Test users (identified by a specific user flag or email domain) can access all AI features without subscribing. This allows the platform administrator to test lessons, provide demos, and troubleshoot issues without incurring subscription costs or creating fake payment records.

**Why this priority**: Essential for development, quality assurance, and customer support, but not required for general user functionality. This enables testing without requiring test payment setup.

**Independent Test**: Can be tested by flagging a user account as "test user", logging in, and verifying that they can start lessons and use AI features without any subscription prompts.

**Acceptance Scenarios**:

1. **Given** a user marked as "test user" in the database, **When** they log in and navigate to the dashboard, **Then** they see no subscription prompts
2. **Given** a test user on the dashboard, **When** they start any lesson, **Then** they access SessionChatAssistant without subscription checks
3. **Given** a test user account, **When** an administrator removes the test user flag, **Then** the user is subject to normal subscription checks on next login
4. **Given** an email address ending with @testuser.com, **When** they register, **Then** they are automatically flagged as a test user with subscription bypass enabled

---

### User Story 4 - Subscription Management (Priority: P2)

A subscribed user wants to view their subscription status, billing history, and manage their subscription (update payment method, cancel subscription). They access a subscription management page showing their current plan, next billing date, and payment history with clear options to make changes.

**Why this priority**: Important for user satisfaction and reducing support burden, but not required for the initial monetization flow. Users can still purchase and use subscriptions without this interface.

**Independent Test**: Can be tested by logging in as a subscribed user, navigating to account settings, viewing subscription details, and clicking "Manage Subscription" to open Stripe Customer Portal.

**Acceptance Scenarios**:

1. **Given** a subscribed user on their account settings page, **When** they view the subscription section, **Then** they see their current plan name, status, and next billing date
2. **Given** a subscribed user viewing subscription details, **When** they click "Manage Subscription", **Then** they are redirected to Stripe Customer Portal
3. **Given** a user in Stripe Customer Portal, **When** they update their payment method, **Then** the change is reflected in their next billing cycle
4. **Given** a user who cancels their subscription, **When** the cancellation is processed, **Then** they retain access until the end of their current billing period
5. **Given** a user whose subscription is cancelled and expired, **When** they log in, **Then** they see a prompt to re-subscribe

---

### User Story 5 - Failed Payment Recovery (Priority: P3)

A subscribed user's payment fails (expired card, insufficient funds). The system detects the failed payment via Stripe webhook, immediately revokes AI feature access, and displays an in-app banner notifying the user to update their payment method. Email notification is sent as a best-effort secondary channel.

**Why this priority**: Important for revenue protection and preventing unauthorized usage of costly AI features, but not critical for initial launch. Can be added after the core subscription flow is stable.

**Independent Test**: Can be tested by simulating a failed payment in Stripe test mode, verifying that access is immediately revoked and the in-app banner displays correctly on next login.

**Acceptance Scenarios**:

1. **Given** a subscription payment fails, **When** the Stripe webhook is received, **Then** the user's account is marked with a "payment_failed" status, AI feature access is immediately revoked, and an in-app banner is prepared for display
2. **Given** a user with failed payment, **When** they log in, **Then** they see a prominent in-app banner (mandatory) prompting them to update their payment method and cannot start lessons
3. **Given** a user with failed payment, **When** the system attempts email notification, **Then** email is sent on a best-effort basis (failure is logged but does not block access revocation)
4. **Given** a user with failed payment, **When** they attempt to start a lesson, **Then** they see the subscription paywall with a message about the failed payment
5. **Given** a user updates their payment method successfully, **When** Stripe retries the payment, **Then** their access is restored immediately upon successful payment

---

### Edge Cases

- **Webhook failure after successful checkout**: When a user completes Stripe checkout but the webhook fails to update the database (network timeout, server error), the system MUST trigger a monitoring alert for manual admin intervention. Admins will review failed webhook logs and manually reconcile subscription status via an admin dashboard.
- **Concurrent subscription attempts**: System MUST use Stripe's idempotency keys to prevent duplicate subscription creation when users click "Subscribe" multiple times
- **Test user flag on paying customer**: System MUST log a warning when test user flag is detected on an account with active Stripe subscription; admin dashboard must highlight these conflicts for manual review
- **Test user domain validation**: System MUST reject test user auto-flagging for email domains other than @testuser.com (exact whitelist match only); attempts to use wildcards or regex patterns must fail with detailed error logging
- **Webhook replay attacks**: System MUST store processed webhook event IDs and reject duplicate events with the same ID (idempotent webhook processing)
- **Stripe vs local database state mismatch**: When subscription is active in Stripe but marked inactive locally, monitoring alerts trigger for admin review; admins use Stripe as source of truth for reconciliation
- **Timezone handling for expiration**: System MUST store all subscription timestamps in UTC; expiration checks MUST compare UTC timestamps to eliminate timezone ambiguity
- **Direct URL access during processing**: System MUST check subscription status synchronously before rendering SessionChatAssistant; if subscription is still processing (webhook pending), user sees a "Please wait" message with retry option
- **Partial Stripe API failures**: System MUST throw exceptions and log detailed error context if Stripe Checkout Session creation succeeds but subscription activation fails; no user state changes until webhook confirmation
- **Manual subscription grants/revocations**: System MUST provide admin dashboard functionality to manually override subscription status with audit logging (reason, admin ID, timestamp)
- **Email notification failures**: When email notification for failed payment cannot be delivered (invalid email, spam filter, quota exceeded), the system MUST log the failure with error details but MUST NOT block access revocation; in-app banner remains the mandatory notification channel

## Requirements

### Functional Requirements

**Constitution Alignment**: All requirements MUST follow fast-fail principles (no fallback mechanisms). Use MUST for mandatory behavior, SHOULD for recommended but optional behavior.

#### Subscription Purchase Flow

- **FR-001**: System MUST display a subscription paywall to non-subscribed users when they attempt to start a lesson from EnhancedStudentDashboard
- **FR-002**: Paywall MUST clearly communicate the monthly subscription cost, benefits (AI tutoring features), and a "Subscribe Now" call-to-action
- **FR-003**: System MUST integrate with Stripe Checkout to process monthly subscription payments
- **FR-004**: System MUST create a Stripe Checkout Session with the configured monthly subscription product ID and price ID
- **FR-005**: System MUST redirect users to Stripe-hosted checkout page with automatic return to application after successful payment
- **FR-006**: System MUST handle Stripe webhook events to update user subscription status in near real-time (within 5 seconds)
- **FR-007**: System MUST throw detailed exceptions if Stripe API calls fail (no silent fallbacks or default states)

#### Access Control and Verification

- **FR-008**: System MUST verify subscription status before allowing access to SessionChatAssistant component
- **FR-009**: System MUST verify subscription status before allowing lesson start actions in EnhancedStudentDashboard
- **FR-010**: System MUST block non-subscribed users from accessing langgraph-agent and langgraph-generic-chat backends
- **FR-011**: System MUST store subscription status (active, inactive, expired, payment_failed) in the user database
- **FR-012**: System MUST check subscription status on every lesson start attempt (no client-side caching of access permissions)
- **FR-013**: System MUST redirect non-subscribed users attempting to access protected routes directly via URL to the subscription page with an error message
- **FR-014**: System MUST log all subscription verification checks with user ID, timestamp, and result (approved/denied) for audit purposes

#### Test User Management

- **FR-015**: System MUST allow administrators to flag user accounts as "test users" via a database field
- **FR-016**: System MUST bypass all subscription checks for users flagged as test users
- **FR-017**: System MUST automatically flag users with email addresses ending in @testuser.com as test users (exact whitelist matching only)
- **FR-018**: System MUST log test user access separately from regular user access for usage tracking
- **FR-019**: System MUST reject test user auto-flagging for any email domain other than @testuser.com (no regex patterns or wildcards)

#### Subscription Status Management

- **FR-020**: System MUST store Stripe customer ID and subscription ID for each subscribed user
- **FR-021**: System MUST update subscription status to "active" when checkout.session.completed webhook is received
- **FR-022**: System MUST update subscription status to "expired" when customer.subscription.deleted webhook is received
- **FR-023**: System MUST update subscription status to "payment_failed" when invoice.payment_failed webhook is received
- **FR-024**: System MUST verify Stripe webhook signatures to prevent webhook spoofing attacks
- **FR-025**: System MUST throw exceptions with detailed error context if webhook signature verification fails

#### Stripe Product Configuration

- **FR-026**: System MUST be configured with Stripe API keys (publishable key for frontend, secret key for backend)
- **FR-027**: System MUST be configured with a Stripe monthly subscription product ID and price ID
- **FR-028**: System MUST support separate Stripe configurations for test mode (development) and live mode (production)
- **FR-029**: System MUST throw exceptions if required Stripe configuration values are missing (no default product IDs)

#### User Interface Requirements

- **FR-030**: Dashboard MUST display subscription status indicator (subscribed, expired, or prompt to subscribe)
- **FR-031**: Subscription paywall MUST be visually distinct from regular lesson content to prevent user confusion
- **FR-032**: System MUST display user-friendly error messages if Stripe checkout fails (e.g., "Payment processing is temporarily unavailable")
- **FR-033**: System MUST provide a "Manage Subscription" link in user account settings that redirects to Stripe Customer Portal

#### Notification Requirements

- **FR-045**: System MUST display in-app banner notification when a user with "payment_failed" status logs in (mandatory notification channel)
- **FR-046**: System MUST attempt to send email notification for failed payments on a best-effort basis (email delivery failure does not block access revocation)
- **FR-047**: System MUST log email delivery failures with error details but MUST NOT retry failed email attempts automatically
- **FR-048**: In-app banner for failed payment MUST be prominently displayed at the top of the dashboard and persist until user updates payment method

#### Data Persistence and Audit

- **FR-034**: System MUST persist subscription status changes with timestamp and source (webhook event type)
- **FR-035**: System MUST log all Stripe webhook events received with event ID, type, and processing result
- **FR-036**: System MUST throw exceptions if database updates for subscription status fail (no silent failures)

#### Monitoring and Admin Intervention

- **FR-037**: System MUST trigger monitoring alerts when webhook processing fails (e.g., database connection error, timeout)
- **FR-038**: System MUST store failed webhook events in a dedicated error queue with retry metadata (timestamp, retry count, error details)
- **FR-039**: System MUST provide admin dashboard functionality to view failed webhook events and subscription state mismatches
- **FR-040**: System MUST allow admins to manually reconcile subscription status using Stripe as source of truth
- **FR-041**: System MUST log all manual admin interventions with admin user ID, reason, timestamp, and state change details
- **FR-042**: System MUST use Stripe idempotency keys for all Checkout Session creation requests to prevent duplicate subscriptions
- **FR-043**: System MUST store processed webhook event IDs and reject duplicate webhook events (idempotent processing)
- **FR-044**: System MUST display "Please wait - subscription processing" message if user accesses protected routes before webhook confirmation

### Key Entities

- **User**: Represents a student account with fields for subscription status, Stripe customer ID, Stripe subscription ID, test user flag, and subscription expiration date
- **Subscription**: Represents an active or past subscription with fields for plan type, status, start date, end date, billing cycle, and payment status
- **SubscriptionAuditLog**: Represents a historical record of subscription status changes with fields for timestamp, user ID, previous status, new status, trigger source (webhook event type), event ID, and admin intervention details (if manually updated)
- **StripeWebhookEvent**: Represents received Stripe webhook events with fields for event ID, event type, received timestamp, processing status, and payload (for debugging failed webhooks)
- **WebhookErrorQueue**: Represents failed webhook processing attempts with fields for webhook event ID, error message, retry count, last retry timestamp, resolution status (pending/resolved), and admin resolution notes

## Success Criteria

### Measurable Outcomes

- **SC-001**: Non-subscribed users attempting to start lessons see the subscription prompt 100% of the time
- **SC-002**: Subscribed users can start lessons and access AI features without friction or additional prompts 100% of the time
- **SC-003**: Stripe webhook events update user subscription status in the database within 5 seconds of receipt
- **SC-004**: Test users flagged in the system can access all AI features without subscription prompts 100% of the time
- **SC-005**: Failed payment scenarios are detected within 5 seconds via webhook, AI feature access is revoked immediately, and in-app banner notification is displayed on next user login (mandatory); email notification is sent best-effort within 1 hour
- **SC-006**: Zero unauthorized access to langgraph-agent or langgraph-generic-chat backends by non-subscribed users (verified via backend logs)
- **SC-007**: Users can complete the entire subscription purchase flow from dashboard to active lesson start in under 3 minutes
- **SC-008**: System handles Stripe webhook signature verification failures by throwing exceptions and logging security events (no silent acceptance of invalid webhooks)
- **SC-009**: Webhook processing failures trigger monitoring alerts within 1 minute and are queued for admin review with 100% capture rate
- **SC-010**: Only email addresses ending with @testuser.com are auto-flagged as test users; zero false positives from similar domains (e.g., @mytest.com, @testuser.net)
- **SC-011**: In-app banner for failed payment is displayed to 100% of affected users on next login; email delivery rate is tracked but failure does not impact access revocation

## Assumptions

- Users will primarily subscribe using credit/debit cards supported by Stripe (Visa, Mastercard, Amex)
- Monthly subscription billing will occur on the same day of each month as the initial purchase
- Stripe webhooks will be delivered reliably to the configured endpoint (the application will have public HTTPS access)
- Failed payments will immediately revoke AI feature access; Stripe's automatic retry logic will attempt payment recovery in the background
- Test users will be a small percentage of total users (under 5%) to minimize financial impact of free access
- The existing Appwrite authentication system will continue to handle user login/logout separately from subscription status
- Subscription status checks will add minimal latency (under 100ms) to lesson start actions
- The frontend is already configured to communicate with the backend via HTTPS for secure API key transmission
- Admin staff will be available to respond to webhook failure alerts within 24 hours for manual subscription reconciliation
- The @testuser.com domain is strictly controlled and not publicly accessible for registration (prevents abuse of test user bypass)
- Email delivery may fail due to spam filters, invalid addresses, or quota limits; in-app notifications are considered the primary reliable notification channel

## Stripe Setup Requirements

### Prerequisites

- Active Stripe account (stripe.com)
- Ability to create Stripe products and prices
- Access to Stripe Dashboard for webhook configuration
- HTTPS endpoint for receiving webhooks (required for production, optional for development with Stripe CLI)

### Development Environment Setup

1. **Create Test Mode Product**:
   - Log in to Stripe Dashboard (dashboard.stripe.com)
   - Switch to "Test Mode" using toggle in top-right corner
   - Navigate to Products → Click "Add Product"
   - Enter product name: "Scottish AI Lessons - Monthly Subscription"
   - Enter description: "Access to AI-powered tutoring features"
   - Pricing model: Select "Recurring"
   - Price: Enter monthly amount (e.g., $9.99)
   - Billing period: Select "Monthly"
   - Currency: Select appropriate currency (e.g., USD, GBP)
   - Click "Save product"
   - Copy the Product ID (starts with `prod_`) and Price ID (starts with `price_`)

2. **Retrieve Test API Keys**:
   - Navigate to Developers → API keys
   - Copy "Publishable key" (starts with `pk_test_`)
   - Click "Reveal test key" under "Secret key"
   - Copy "Secret key" (starts with `sk_test_`)
   - Store these securely in application environment variables

3. **Configure Webhook Endpoint (Local Development)**:
   - Install Stripe CLI: https://stripe.com/docs/stripe-cli
   - Run: `stripe login` (authenticate with Stripe account)
   - Run: `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`
   - Copy the webhook signing secret (starts with `whsec_`)
   - This creates a local webhook tunnel for testing

4. **Set Environment Variables (Development)**:
   - Create or update `.env.local` in assistant-ui-frontend:
     ```
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
     STRIPE_SECRET_KEY=sk_test_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     STRIPE_SUBSCRIPTION_PRICE_ID=price_...
     ```

### Production Environment Setup

1. **Create Live Mode Product**:
   - Switch Stripe Dashboard to "Live Mode"
   - Repeat the product creation steps from development setup
   - Copy the LIVE Product ID and Price ID (these will be different from test mode)

2. **Retrieve Live API Keys**:
   - Navigate to Developers → API keys
   - Copy "Publishable key" (starts with `pk_live_`)
   - Click "Reveal live key" under "Secret key"
   - Copy "Secret key" (starts with `sk_live_`)
   - **CRITICAL**: Never commit live keys to version control

3. **Configure Production Webhook Endpoint**:
   - Deploy application with HTTPS endpoint for webhooks (e.g., https://yourdomain.com/api/webhooks/stripe)
   - Navigate to Developers → Webhooks
   - Click "Add endpoint"
   - Enter webhook URL: https://yourdomain.com/api/webhooks/stripe
   - Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
   - Click "Add endpoint"
   - Copy the webhook signing secret (starts with `whsec_`)

4. **Set Environment Variables (Production)**:
   - Configure production environment with:
     ```
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
     STRIPE_SECRET_KEY=sk_live_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     STRIPE_SUBSCRIPTION_PRICE_ID=price_...
     ```
   - Use secure secret management (e.g., environment variables, secrets manager, not plain text files)

### Manual Testing Checklist

#### Test Mode (Development)
- [ ] Verify test product appears in Stripe Dashboard
- [ ] Verify test price is configured correctly (amount, currency, recurring)
- [ ] Verify Stripe CLI webhook tunnel is running (`stripe listen --forward-to...`)
- [ ] Test successful subscription purchase using test card: 4242 4242 4242 4242
- [ ] Test failed payment using test card: 4000 0000 0000 0002
- [ ] Verify webhook events are received in application logs
- [ ] Verify subscription status updates correctly in database after successful payment
- [ ] Test subscription cancellation in Stripe Dashboard and verify status update

#### Live Mode (Production)
- [ ] Verify live product is created with correct pricing
- [ ] Verify webhook endpoint is publicly accessible via HTTPS
- [ ] Verify webhook events are being received (check Developers → Webhooks → Event logs)
- [ ] **DO NOT test with real payment cards until fully tested in test mode**
- [ ] Enable Stripe billing emails for customers
- [ ] Configure Stripe Customer Portal for subscription management

### Deployment Checklist

- [ ] Test mode fully functional in development environment
- [ ] All test scenarios passing with test mode API keys
- [ ] Live mode product created with correct pricing
- [ ] Live mode webhook endpoint configured and receiving events
- [ ] Production environment variables configured with live mode API keys
- [ ] Webhook signature verification enabled and tested
- [ ] Test user accounts flagged correctly in production database
- [ ] Subscription status checks integrated into EnhancedStudentDashboard and SessionChatAssistant
- [ ] Error logging and monitoring configured for Stripe API failures
- [ ] Customer support documentation updated with subscription management instructions

### Security Considerations

- **API Key Protection**: Never expose Stripe secret key in client-side code or version control
- **Webhook Verification**: Always verify webhook signatures to prevent spoofing attacks
- **HTTPS Enforcement**: Production webhooks MUST use HTTPS endpoints
- **Test User Access**: Monitor test user usage to prevent abuse of free access
- **Audit Logging**: Log all subscription status changes with timestamps and sources for security audits
