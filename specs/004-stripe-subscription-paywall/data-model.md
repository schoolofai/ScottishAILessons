# Data Model: Stripe Subscription Paywall

**Feature**: `004-stripe-subscription-paywall`
**Date**: 2025-11-14
**Status**: Planning Phase
**Spec**: [spec.md](./spec.md)

## Overview

This document defines the complete database schema for subscription management in Appwrite. It includes 1 extended collection (users) and 4 new collections (subscriptions, subscription_audit_logs, stripe_webhook_events, webhook_error_queue).

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         users (extended)                     │
├─────────────────────────────────────────────────────────────┤
│ $id                         : string (PK)                    │
│ name                        : string                         │
│ email                       : string (unique)                │
│ subscriptionStatus          : enum (NEW)                     │
│ stripeCustomerId            : string (nullable) (NEW)        │
│ stripeSubscriptionId        : string (nullable) (NEW)        │
│ testUserFlag                : boolean (NEW)                  │
│ subscriptionExpiresAt       : datetime (nullable) (NEW)      │
│ ...existing fields                                          │
└─────────────────────────────────────────────────────────────┘
                               │
                               │ 1:N
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      subscriptions                           │
├─────────────────────────────────────────────────────────────┤
│ $id                         : string (PK)                    │
│ userId                      : string (FK → users.$id)        │
│ stripeSubscriptionId        : string (unique)                │
│ planType                    : enum                           │
│ status                      : enum                           │
│ startDate                   : datetime                       │
│ endDate                     : datetime (nullable)            │
│ billingCycle                : enum                           │
│ paymentStatus               : enum                           │
│ lastPaymentDate             : datetime (nullable)            │
│ nextBillingDate             : datetime (nullable)            │
│ createdAt                   : datetime (auto)                │
│ updatedAt                   : datetime (auto)                │
└─────────────────────────────────────────────────────────────┘
       │                              │
       │                              │
       │ 1:N                          │ 1:N
       ▼                              ▼
┌────────────────────────────┐  ┌────────────────────────────┐
│ subscription_audit_logs    │  │ stripe_webhook_events      │
├────────────────────────────┤  ├────────────────────────────┤
│ $id            : string PK │  │ $id            : string PK │
│ userId         : string FK │  │ eventId        : string UK │
│ subscriptionId : string FK │  │ eventType      : string    │
│ timestamp      : datetime  │  │ receivedAt     : datetime  │
│ previousStatus : enum      │  │ processingStatus: enum     │
│ newStatus      : enum      │  │ payload        : text      │
│ triggerSource  : enum      │  │ processedAt    : datetime  │
│ eventId        : string    │  │ errorMessage   : text      │
│ adminNotes     : text      │  │ createdAt      : datetime  │
└────────────────────────────┘  └────────────────────────────┘
                                             │
                                             │ 1:N
                                             ▼
                                ┌────────────────────────────┐
                                │ webhook_error_queue        │
                                ├────────────────────────────┤
                                │ $id            : string PK │
                                │ webhookEventId : string FK │
                                │ errorMessage   : text      │
                                │ retryCount     : integer   │
                                │ lastRetryAt    : datetime  │
                                │ resolutionStatus: enum     │
                                │ adminNotes     : text      │
                                │ createdAt      : datetime  │
                                │ resolvedAt     : datetime  │
                                └────────────────────────────┘
```

**Legend**: PK = Primary Key, FK = Foreign Key, UK = Unique Key

## Collection Definitions

### 1. users (Extended Collection)

**Purpose**: Extend existing users collection with subscription metadata for fast access control checks.

**Collection ID**: `users` (existing)

#### New Attributes

| Attribute Name | Type | Required | Default | Constraints | Purpose |
|----------------|------|----------|---------|-------------|---------|
| `subscriptionStatus` | enum | Yes | `inactive` | `inactive`, `active`, `payment_failed`, `cancelled` | Current subscription state for access control |
| `stripeCustomerId` | string | No | `null` | Max 255 chars | Stripe customer ID (format: `cus_...`) |
| `stripeSubscriptionId` | string | No | `null` | Max 255 chars | Stripe subscription ID (format: `sub_...`) |
| `testUserFlag` | boolean | Yes | `false` | N/A | If true, bypass subscription checks |
| `subscriptionExpiresAt` | datetime | No | `null` | ISO 8601 | When subscription access expires (null = active, non-null = grace period/cancelled) |

#### Indexes

```typescript
// Existing indexes (assumed)
// - $id (primary key, auto)
// - email (unique)

// New indexes required
{
  key: 'subscription_status_idx',
  type: 'key',
  attributes: ['subscriptionStatus'],
  orders: ['ASC']
}

{
  key: 'stripe_customer_idx',
  type: 'key',
  attributes: ['stripeCustomerId'],
  orders: ['ASC']
}

{
  key: 'test_user_idx',
  type: 'key',
  attributes: ['testUserFlag'],
  orders: ['ASC']
}
```

#### Sample Document

```json
{
  "$id": "user_12345",
  "name": "Jane Student",
  "email": "jane@example.com",
  "subscriptionStatus": "active",
  "stripeCustomerId": "cus_ABC123DEF456",
  "stripeSubscriptionId": "sub_XYZ789UVW012",
  "testUserFlag": false,
  "subscriptionExpiresAt": null,
  "$createdAt": "2025-01-10T10:00:00.000Z",
  "$updatedAt": "2025-01-15T14:30:00.000Z"
}
```

---

### 2. subscriptions (New Collection)

**Purpose**: Store detailed subscription records with billing history and status tracking.

**Collection ID**: `subscriptions`

#### Attributes

| Attribute Name | Type | Required | Default | Constraints | Purpose |
|----------------|------|----------|---------|-------------|---------|
| `$id` | string | Auto | Auto-generated | N/A | Appwrite document ID |
| `userId` | string | Yes | N/A | FK to users.$id | Owner of subscription |
| `stripeSubscriptionId` | string | Yes | N/A | Unique, Max 255 | Stripe subscription ID (format: `sub_...`) |
| `planType` | enum | Yes | N/A | `monthly_ai_access` | Subscription plan (future: `annual_ai_access`) |
| `status` | enum | Yes | `active` | `active`, `cancelled`, `past_due`, `incomplete` | Current subscription status in Stripe |
| `startDate` | datetime | Yes | N/A | ISO 8601 | When subscription became active |
| `endDate` | datetime | No | `null` | ISO 8601 | When subscription ends (null = ongoing) |
| `billingCycle` | enum | Yes | `monthly` | `monthly`, `annual` | Billing frequency |
| `paymentStatus` | enum | Yes | `current` | `current`, `past_due`, `failed` | Latest payment status |
| `lastPaymentDate` | datetime | No | `null` | ISO 8601 | Most recent successful payment |
| `nextBillingDate` | datetime | No | `null` | ISO 8601 | Next scheduled charge date |
| `$createdAt` | datetime | Auto | Auto-generated | ISO 8601 | Document creation timestamp |
| `$updatedAt` | datetime | Auto | Auto-generated | ISO 8601 | Last modification timestamp |

#### Indexes

```typescript
{
  key: 'user_id_idx',
  type: 'key',
  attributes: ['userId'],
  orders: ['ASC']
}

{
  key: 'stripe_subscription_id_idx',
  type: 'unique',
  attributes: ['stripeSubscriptionId'],
  orders: ['ASC']
}

{
  key: 'status_idx',
  type: 'key',
  attributes: ['status'],
  orders: ['ASC']
}

{
  key: 'next_billing_date_idx',
  type: 'key',
  attributes: ['nextBillingDate'],
  orders: ['ASC']
}
```

#### Permissions

```typescript
{
  read: ['role:admin', 'user:{userId}'], // Users can read their own subscriptions
  create: ['role:admin', 'role:system'], // Only admin/webhooks can create
  update: ['role:admin', 'role:system'], // Only admin/webhooks can update
  delete: ['role:admin'] // Only admin can delete (soft delete preferred)
}
```

#### Sample Document

```json
{
  "$id": "subscription_78910",
  "userId": "user_12345",
  "stripeSubscriptionId": "sub_XYZ789UVW012",
  "planType": "monthly_ai_access",
  "status": "active",
  "startDate": "2025-01-15T14:30:00.000Z",
  "endDate": null,
  "billingCycle": "monthly",
  "paymentStatus": "current",
  "lastPaymentDate": "2025-01-15T14:30:00.000Z",
  "nextBillingDate": "2025-02-15T14:30:00.000Z",
  "$createdAt": "2025-01-15T14:30:00.000Z",
  "$updatedAt": "2025-01-15T14:30:00.000Z"
}
```

---

### 3. subscription_audit_logs (New Collection)

**Purpose**: Immutable audit trail for all subscription status changes for compliance and debugging.

**Collection ID**: `subscription_audit_logs`

#### Attributes

| Attribute Name | Type | Required | Default | Constraints | Purpose |
|----------------|------|----------|---------|-------------|---------|
| `$id` | string | Auto | Auto-generated | N/A | Appwrite document ID |
| `userId` | string | Yes | N/A | FK to users.$id | User affected by status change |
| `subscriptionId` | string | Yes | N/A | FK to subscriptions.$id | Subscription record affected |
| `timestamp` | datetime | Yes | N/A | ISO 8601 | When status change occurred |
| `previousStatus` | enum | Yes | N/A | Same as users.subscriptionStatus | Status before change |
| `newStatus` | enum | Yes | N/A | Same as users.subscriptionStatus | Status after change |
| `triggerSource` | enum | Yes | N/A | `stripe_webhook`, `manual_admin`, `system_cron`, `api_call` | What caused the change |
| `eventId` | string | No | `null` | Max 255 | Stripe event ID if triggered by webhook |
| `adminUserId` | string | No | `null` | FK to users.$id | Admin who made manual change |
| `adminNotes` | text | No | `null` | Max 5000 chars | Admin notes for manual interventions |
| `$createdAt` | datetime | Auto | Auto-generated | ISO 8601 | Document creation timestamp (immutable) |

#### Indexes

```typescript
{
  key: 'user_id_idx',
  type: 'key',
  attributes: ['userId'],
  orders: ['DESC'] // Recent changes first
}

{
  key: 'subscription_id_idx',
  type: 'key',
  attributes: ['subscriptionId'],
  orders: ['DESC']
}

{
  key: 'timestamp_idx',
  type: 'key',
  attributes: ['timestamp'],
  orders: ['DESC'] // Recent events first
}

{
  key: 'trigger_source_idx',
  type: 'key',
  attributes: ['triggerSource'],
  orders: ['ASC']
}
```

#### Permissions

```typescript
{
  read: ['role:admin'], // Only admins can view audit logs
  create: ['role:admin', 'role:system'], // Webhooks and admin actions
  update: [], // IMMUTABLE - no updates allowed
  delete: [] // IMMUTABLE - no deletions allowed
}
```

#### Sample Document

```json
{
  "$id": "audit_11223",
  "userId": "user_12345",
  "subscriptionId": "subscription_78910",
  "timestamp": "2025-01-15T14:30:00.000Z",
  "previousStatus": "inactive",
  "newStatus": "active",
  "triggerSource": "stripe_webhook",
  "eventId": "evt_1ABC2DEF3GHI4JKL",
  "adminUserId": null,
  "adminNotes": null,
  "$createdAt": "2025-01-15T14:30:01.000Z"
}
```

---

### 4. stripe_webhook_events (New Collection)

**Purpose**: Prevent duplicate webhook processing using event ID idempotency pattern.

**Collection ID**: `stripe_webhook_events`

#### Attributes

| Attribute Name | Type | Required | Default | Constraints | Purpose |
|----------------|------|----------|---------|-------------|---------|
| `$id` | string | Auto | Auto-generated | N/A | Appwrite document ID |
| `eventId` | string | Yes | N/A | Unique, Max 255 | Stripe event ID (format: `evt_...`) |
| `eventType` | enum | Yes | N/A | `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*` | Webhook event type |
| `receivedAt` | datetime | Yes | N/A | ISO 8601 | When webhook was received |
| `processingStatus` | enum | Yes | `processing` | `processing`, `completed`, `failed` | Current processing state |
| `payload` | text | Yes | N/A | Max 100000 chars | Full JSON webhook payload (for debugging) |
| `processedAt` | datetime | No | `null` | ISO 8601 | When processing completed |
| `errorMessage` | text | No | `null` | Max 5000 chars | Error details if processing failed |
| `$createdAt` | datetime | Auto | Auto-generated | ISO 8601 | Document creation timestamp |

#### Indexes

```typescript
{
  key: 'event_id_idx',
  type: 'unique',
  attributes: ['eventId'],
  orders: ['ASC']
}

{
  key: 'event_type_idx',
  type: 'key',
  attributes: ['eventType'],
  orders: ['ASC']
}

{
  key: 'processing_status_idx',
  type: 'key',
  attributes: ['processingStatus'],
  orders: ['ASC']
}

{
  key: 'received_at_idx',
  type: 'key',
  attributes: ['receivedAt'],
  orders: ['DESC'] // Recent events first
}
```

#### Permissions

```typescript
{
  read: ['role:admin'], // Only admins can view webhook logs
  create: ['role:system'], // Only webhook handler can create
  update: ['role:system'], // Only webhook handler can update status
  delete: ['role:admin'] // Admin can delete old logs (data retention)
}
```

#### Sample Document

```json
{
  "$id": "webhook_44556",
  "eventId": "evt_1ABC2DEF3GHI4JKL",
  "eventType": "customer.subscription.updated",
  "receivedAt": "2025-01-15T14:30:00.000Z",
  "processingStatus": "completed",
  "payload": "{\"id\":\"evt_1ABC2DEF3GHI4JKL\",\"object\":\"event\",\"data\":{...}}",
  "processedAt": "2025-01-15T14:30:02.000Z",
  "errorMessage": null,
  "$createdAt": "2025-01-15T14:30:00.000Z"
}
```

---

### 5. webhook_error_queue (New Collection)

**Purpose**: Track failed webhook processing events for manual admin intervention.

**Collection ID**: `webhook_error_queue`

#### Attributes

| Attribute Name | Type | Required | Default | Constraints | Purpose |
|----------------|------|----------|---------|-------------|---------|
| `$id` | string | Auto | Auto-generated | N/A | Appwrite document ID |
| `webhookEventId` | string | Yes | N/A | FK to stripe_webhook_events.eventId | Which webhook failed |
| `errorMessage` | text | Yes | N/A | Max 5000 chars | Error details from processing attempt |
| `retryCount` | integer | Yes | `0` | Min 0 | Number of manual retry attempts |
| `lastRetryAt` | datetime | No | `null` | ISO 8601 | When last retry was attempted |
| `resolutionStatus` | enum | Yes | `pending_admin_review` | `pending_admin_review`, `resolved`, `ignored` | Current resolution state |
| `adminUserId` | string | No | `null` | FK to users.$id | Admin who resolved the error |
| `adminNotes` | text | No | `null` | Max 5000 chars | Admin notes on resolution |
| `$createdAt` | datetime | Auto | Auto-generated | ISO 8601 | When error was first queued |
| `resolvedAt` | datetime | No | `null` | ISO 8601 | When admin marked as resolved |

#### Indexes

```typescript
{
  key: 'webhook_event_id_idx',
  type: 'key',
  attributes: ['webhookEventId'],
  orders: ['ASC']
}

{
  key: 'resolution_status_idx',
  type: 'key',
  attributes: ['resolutionStatus'],
  orders: ['ASC']
}

{
  key: 'last_retry_at_idx',
  type: 'key',
  attributes: ['lastRetryAt'],
  orders: ['DESC'] // Most recent retries first
}

{
  key: 'created_at_idx',
  type: 'key',
  attributes: ['$createdAt'],
  orders: ['DESC'] // Newest errors first
}
```

#### Permissions

```typescript
{
  read: ['role:admin'], // Only admins can view error queue
  create: ['role:system'], // Only webhook handler can create
  update: ['role:admin', 'role:system'], // Admin for resolution, system for retries
  delete: ['role:admin'] // Admin can delete resolved errors
}
```

#### Sample Document

```json
{
  "$id": "error_66778",
  "webhookEventId": "evt_1ABC2DEF3GHI4JKL",
  "errorMessage": "Failed to update user subscription status: Appwrite database connection timeout",
  "retryCount": 1,
  "lastRetryAt": "2025-01-15T15:00:00.000Z",
  "resolutionStatus": "pending_admin_review",
  "adminUserId": null,
  "adminNotes": null,
  "$createdAt": "2025-01-15T14:30:05.000Z",
  "resolvedAt": null
}
```

---

## Data Flow Diagrams

### Subscription Activation Flow

```
┌─────────────────┐
│ Stripe Webhook  │
│ (checkout.      │
│  session.       │
│  completed)     │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 1. Check stripe_webhook_events.eventId       │
│    (Idempotency check)                       │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 2. Create stripe_webhook_events record       │
│    (status: 'processing')                    │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 3. Update users.subscriptionStatus = 'active'│
│    Set stripeCustomerId, stripeSubscriptionId│
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 4. Create subscriptions record               │
│    (status: 'active', paymentStatus:         │
│     'current')                               │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 5. Create subscription_audit_logs entry      │
│    (previousStatus: 'inactive',              │
│     newStatus: 'active',                     │
│     triggerSource: 'stripe_webhook')         │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 6. Update stripe_webhook_events              │
│    (processingStatus: 'completed',           │
│     processedAt: now)                        │
└──────────────────────────────────────────────┘
```

**Error Handling**: If any step 3-6 fails, create `webhook_error_queue` record and return 200 to Stripe to prevent retries.

### Subscription Revocation Flow (Failed Payment)

```
┌─────────────────┐
│ Stripe Webhook  │
│ (invoice.       │
│  payment_failed)│
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 1. Idempotency check (stripe_webhook_events) │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 2. Update users.subscriptionStatus =         │
│    'payment_failed'                          │
│    (IMMEDIATE REVOCATION - no grace period)  │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 3. Update subscriptions.paymentStatus =      │
│    'failed'                                  │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 4. Create audit log entry                    │
│    (previousStatus: 'active',                │
│     newStatus: 'payment_failed')             │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 5. Trigger in-app notification               │
│    (Banner: "Payment failed, access revoked")│
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 6. Attempt email notification (best-effort)  │
│    (Log failure if email service unavailable)│
└──────────────────────────────────────────────┘
```

### Access Control Check Flow

```
┌─────────────────┐
│ User clicks     │
│ "Start Lesson"  │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ 1. Check users.testUserFlag                  │
│    If true → GRANT ACCESS (bypass paywall)   │
└────────┬─────────────────────────────────────┘
         │ false
         ▼
┌──────────────────────────────────────────────┐
│ 2. Check users.subscriptionStatus            │
│    If 'active' → GRANT ACCESS                │
│    If 'inactive', 'payment_failed',          │
│       'cancelled' → SHOW PAYWALL             │
└──────────────────────────────────────────────┘
```

**Performance Note**: Single database query per lesson start (users collection only).

## Data Retention Policy

| Collection | Retention Period | Deletion Strategy |
|------------|------------------|-------------------|
| `users` | Permanent (GDPR: delete on user request) | Soft delete preferred |
| `subscriptions` | Permanent for active, 7 years for cancelled (tax compliance) | Soft delete |
| `subscription_audit_logs` | 7 years (compliance requirement) | Hard delete after retention period |
| `stripe_webhook_events` | 90 days | Hard delete via cron job |
| `webhook_error_queue` | Delete after resolution + 30 days | Hard delete |

## Migration Strategy

### Phase 1: Extend Users Collection

```typescript
// Add new attributes to existing users collection
await databases.createStringAttribute(
  DATABASE_ID,
  'users',
  'subscriptionStatus',
  255,
  true, // required
  'inactive', // default
  false // not array
);

await databases.createStringAttribute(
  DATABASE_ID,
  'users',
  'stripeCustomerId',
  255,
  false, // optional
  null,
  false
);

// ... repeat for all new user attributes
```

### Phase 2: Create New Collections

```typescript
// Create subscriptions collection
await databases.createCollection(
  DATABASE_ID,
  'subscriptions',
  'subscriptions',
  [Permission.read(Role.any())], // Adjust permissions
  true // documentSecurity enabled
);

// Add attributes
await databases.createStringAttribute(
  DATABASE_ID,
  'subscriptions',
  'userId',
  255,
  true
);
// ... add all attributes

// Create indexes
await databases.createIndex(
  DATABASE_ID,
  'subscriptions',
  'user_id_idx',
  'key',
  ['userId'],
  ['ASC']
);
```

### Phase 3: Backfill Existing Users

```typescript
// Set all existing users to inactive with testUserFlag = false
const users = await databases.listDocuments(DATABASE_ID, 'users');

for (const user of users.documents) {
  await databases.updateDocument(
    DATABASE_ID,
    'users',
    user.$id,
    {
      subscriptionStatus: 'inactive',
      testUserFlag: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionExpiresAt: null
    }
  );
}
```

### Phase 4: Flag Test Users

```typescript
// Auto-flag test users based on email domain
const users = await databases.listDocuments(
  DATABASE_ID,
  'users',
  [Query.endsWith('email', '@testuser.com')]
);

for (const user of users.documents) {
  await databases.updateDocument(
    DATABASE_ID,
    'users',
    user.$id,
    { testUserFlag: true }
  );
}
```

## Validation Rules

### Business Logic Validation

```typescript
// Before updating user subscription status
function validateSubscriptionStatusTransition(
  currentStatus: SubscriptionStatus,
  newStatus: SubscriptionStatus
): void {
  const validTransitions = {
    inactive: ['active'],
    active: ['payment_failed', 'cancelled'],
    payment_failed: ['active', 'cancelled'],
    cancelled: [] // No transitions from cancelled (must create new subscription)
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}`
    );
  }
}
```

### Data Integrity Checks

```typescript
// Ensure Stripe IDs are present for active subscriptions
function validateActiveSubscription(user: User): void {
  if (user.subscriptionStatus === 'active') {
    if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
      throw new Error(
        'Active subscription must have Stripe customer and subscription IDs'
      );
    }
  }
}
```

## Query Performance Optimization

### Common Query Patterns

```typescript
// 1. Check user subscription status (access control)
// Performance: O(1) lookup by user ID
const user = await databases.getDocument(DATABASE_ID, 'users', userId);
const hasAccess = user.testUserFlag || user.subscriptionStatus === 'active';

// 2. List failed webhooks (admin dashboard)
// Performance: Indexed query on resolutionStatus + created_at
const failedWebhooks = await databases.listDocuments(
  DATABASE_ID,
  'webhook_error_queue',
  [
    Query.equal('resolutionStatus', 'pending_admin_review'),
    Query.orderDesc('$createdAt'),
    Query.limit(50)
  ]
);

// 3. Get user subscription history (audit log)
// Performance: Indexed query on userId + timestamp
const auditLogs = await databases.listDocuments(
  DATABASE_ID,
  'subscription_audit_logs',
  [
    Query.equal('userId', userId),
    Query.orderDesc('timestamp'),
    Query.limit(100)
  ]
);

// 4. Idempotency check (webhook processing)
// Performance: O(1) unique index lookup
const existingEvent = await databases.listDocuments(
  DATABASE_ID,
  'stripe_webhook_events',
  [Query.equal('eventId', stripeEventId)]
);
```

### Expected Query Volumes

| Query | Frequency | Expected Latency | Caching Strategy |
|-------|-----------|------------------|------------------|
| User subscription status check | Every lesson start (~100/hour) | <50ms | No caching (security-critical) |
| Webhook idempotency check | Every webhook (~50/day) | <30ms | No caching |
| Admin dashboard failed webhooks | Manual access (~5/day) | <100ms | No caching |
| Audit log retrieval | Manual access (~10/day) | <200ms | No caching |

## References

- [Appwrite Database Documentation](https://appwrite.io/docs/databases)
- [Stripe Webhook Event Reference](https://stripe.com/docs/api/events)
- [Constitution Principles](../../.specify/memory/constitution.md)
