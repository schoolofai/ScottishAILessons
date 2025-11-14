# Data Model: Polar Subscription System

**Feature**: Polar Payment Gateway with AI Lesson Paywall
**Database**: Appwrite (existing)
**Date**: 2025-11-13

## Collections Overview

| Collection | Purpose | Size Estimate |
|------------|---------|---------------|
| `subscriptions` | Active subscription records | ~100 docs (matches user count) |
| `webhook_events` | Webhook audit log | ~50-100/day growth |
| `students` (modified) | Add test user flag | Existing collection |

## 1. subscriptions Collection

**Purpose**: Store user subscription data synced from Polar webhooks

### Schema

```typescript
interface Subscription {
  // Primary Keys
  $id: string;                    // Document ID = userId (for fast lookups)
  userId: string;                 // Reference to students collection

  // Polar References
  polarCustomerId: string;        // Polar's customer ID (for portal redirects)
  polarSubscriptionId: string;    // Polar's subscription ID
  planId: string;                 // "Student Plus" product ID from Polar

  // Status Fields
  status: 'active' | 'cancelled' | 'expired' | 'incomplete' | 'incomplete_expired';
  billingCycleStart: string;      // ISO 8601 timestamp
  nextBillingDate: string;        // ISO 8601 timestamp
  cancellationDate?: string;      // ISO 8601 timestamp (if cancelled)

  // Audit Fields
  createdAt: string;              // ISO 8601 timestamp
  updatedAt: string;              // ISO 8601 timestamp
  lastSyncedAt: string;           // Last webhook sync timestamp
}
```

### Indexes

```typescript
// Required for performance (FR-019, SC-007)
indexes: [
  { key: 'userId', type: 'unique' },           // Primary lookup (O(1))
  { key: 'polarSubscriptionId', type: 'unique' }, // Webhook lookup
  { key: 'status', type: 'key' },              // Filter active subs
  { key: 'nextBillingDate', type: 'key' }      // Expiry checks
]
```

### Permissions

```typescript
permissions: [
  Permission.read(Role.user('<userId>')),    // Users read own subscription
  Permission.write(Role.team('admins')),     // Admins can modify
  Permission.create(Role.any()),             // Webhooks can create
  Permission.update(Role.any())              // Webhooks can update
]
```

### Example Document

```json
{
  "$id": "user_abc123",
  "userId": "user_abc123",
  "polarCustomerId": "cus_polar_xyz",
  "polarSubscriptionId": "sub_polar_123",
  "planId": "prod_student_plus",
  "status": "active",
  "billingCycleStart": "2025-01-15T00:00:00Z",
  "nextBillingDate": "2025-02-15T00:00:00Z",
  "cancellationDate": null,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z",
  "lastSyncedAt": "2025-01-15T10:30:00Z"
}
```

### Validation Rules

```typescript
// Field constraints
const SubscriptionSchema = z.object({
  userId: z.string().min(1),
  polarCustomerId: z.string().startsWith('cus_'),
  polarSubscriptionId: z.string().startsWith('sub_'),
  planId: z.string().min(1),
  status: z.enum(['active', 'cancelled', 'expired', 'incomplete', 'incomplete_expired']),
  billingCycleStart: z.string().datetime(),
  nextBillingDate: z.string().datetime(),
  cancellationDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime()
});
```

### State Transitions

```
[New] → checkout.completed → active
active → subscription.cancelled → cancelled
cancelled → (period expires) → expired
active → payment_failed → incomplete
incomplete → (retry timeout) → incomplete_expired
expired → subscription.created → active (re-subscription)
```

## 2. webhook_events Collection

**Purpose**: Audit log for webhook processing, enable idempotency

### Schema

```typescript
interface WebhookEvent {
  // Primary Key
  $id: string;                    // Document ID = Polar event ID

  // Event Metadata
  eventId: string;                // Polar's event ID (duplicate for querying)
  eventType: string;              // e.g., "checkout.completed"

  // Processing Status
  processingStatus: 'pending' | 'completed' | 'failed';
  userId?: string;                // Affected user (if applicable)

  // Audit Data
  payloadSnapshot: string;        // JSON.stringify(payload) for debugging
  processedAt: string;            // ISO 8601 timestamp
  processingDuration?: number;    // Milliseconds
  errorDetails?: string;          // Error message if failed
  retryCount: number;             // Number of retry attempts
}
```

### Indexes

```typescript
indexes: [
  { key: 'eventId', type: 'unique' },        // Idempotency check (O(1))
  { key: 'processingStatus', type: 'key' },  // Filter failed events
  { key: 'processedAt', type: 'key' },       // Time-based queries
  { key: 'eventType', type: 'key' }          // Filter by event type
]
```

### Permissions

```typescript
permissions: [
  Permission.create(Role.any()),             // Webhooks can create
  Permission.read(Role.team('admins')),      // Admins can audit
  Permission.update(Role.any())              // Webhooks can update status
]
```

### Example Document

```json
{
  "$id": "evt_polar_abc123",
  "eventId": "evt_polar_abc123",
  "eventType": "checkout.completed",
  "processingStatus": "completed",
  "userId": "user_xyz789",
  "payloadSnapshot": "{\"id\":\"evt_polar_abc123\",\"type\":\"checkout.completed\",\"data\":{...}}",
  "processedAt": "2025-01-15T10:30:15Z",
  "processingDuration": 234,
  "errorDetails": null,
  "retryCount": 0
}
```

### Retention Policy

**Strategy**: Keep events for 90 days, then archive to cold storage

```typescript
// Cleanup job (run daily)
async function archiveOldWebhooks() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const oldEvents = await databases.listDocuments(
    'webhook_events',
    [Query.lessThan('processedAt', ninetyDaysAgo.toISOString())]
  );

  // Export to cold storage (S3, etc.)
  await exportToArchive(oldEvents);

  // Delete from Appwrite
  for (const event of oldEvents.documents) {
    await databases.deleteDocument('webhook_events', event.$id);
  }
}
```

## 3. students Collection (Modified)

**Purpose**: Add test user flag for paywall bypass

### Schema Addition

```typescript
interface Student {
  // Existing fields...
  $id: string;
  userId: string;
  name: string;
  email: string;
  role: 'student';

  // NEW: Test user indicator (computed field)
  testUser: boolean;  // Computed from email domain on read
}
```

### Computed Field Pattern

```typescript
// Don't store in database - compute at runtime
function enrichStudentWithTestFlag(student: any): Student {
  const testDomains = process.env.TEST_USER_DOMAINS?.split(',') || [];
  const isTest = testDomains.some(domain =>
    student.email.endsWith(`@${domain.trim()}`)
  );

  return {
    ...student,
    testUser: isTest
  };
}
```

**Rationale**: Test user status depends on environment config (can change). Computing at runtime avoids database migrations when test domains change.

## Data Access Patterns

### Query Patterns

```typescript
// 1. Check user subscription (most frequent - cached)
async function getSubscription(userId: string): Promise<Subscription | null> {
  try {
    return await databases.getDocument('subscriptions', userId);
  } catch (error) {
    if (error.code === 404) return null;
    throw error;
  }
}

// 2. Check webhook processed (idempotency)
async function webhookProcessed(eventId: string): Promise<boolean> {
  try {
    await databases.getDocument('webhook_events', eventId);
    return true;
  } catch (error) {
    if (error.code === 404) return false;
    throw error;
  }
}

// 3. Find subscription by Polar ID (webhook processing)
async function findByPolarId(polarSubId: string): Promise<Subscription | null> {
  const result = await databases.listDocuments(
    'subscriptions',
    [Query.equal('polarSubscriptionId', polarSubId)]
  );
  return result.documents[0] || null;
}

// 4. Get active subscriptions (admin dashboard)
async function getActiveSubscriptions(): Promise<Subscription[]> {
  const result = await databases.listDocuments(
    'subscriptions',
    [Query.equal('status', 'active')]
  );
  return result.documents;
}

// 5. Get failed webhooks (monitoring)
async function getFailedWebhooks(limit = 10): Promise<WebhookEvent[]> {
  const result = await databases.listDocuments(
    'webhook_events',
    [
      Query.equal('processingStatus', 'failed'),
      Query.orderDesc('processedAt'),
      Query.limit(limit)
    ]
  );
  return result.documents;
}
```

### Write Patterns

```typescript
// 1. Create subscription (checkout.completed)
async function createSubscription(data: Partial<Subscription>): Promise<void> {
  await databases.createDocument(
    'subscriptions',
    data.userId!, // Use userId as document ID
    {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    }
  );
}

// 2. Update subscription (subscription.updated)
async function updateSubscription(userId: string, updates: Partial<Subscription>): Promise<void> {
  await databases.updateDocument(
    'subscriptions',
    userId,
    {
      ...updates,
      updatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    }
  );
}

// 3. Log webhook event
async function logWebhook(event: any): Promise<void> {
  const startTime = Date.now();

  try {
    // Process webhook
    await processWebhook(event);

    // Log success
    await databases.createDocument(
      'webhook_events',
      event.id,
      {
        eventId: event.id,
        eventType: event.type,
        processingStatus: 'completed',
        payloadSnapshot: JSON.stringify(event),
        processedAt: new Date().toISOString(),
        processingDuration: Date.now() - startTime,
        retryCount: 0
      }
    );
  } catch (error) {
    // Log failure
    await databases.createDocument(
      'webhook_events',
      event.id,
      {
        eventId: event.id,
        eventType: event.type,
        processingStatus: 'failed',
        payloadSnapshot: JSON.stringify(event),
        processedAt: new Date().toISOString(),
        processingDuration: Date.now() - startTime,
        errorDetails: error.message,
        retryCount: 0
      }
    );
    throw error;
  }
}
```

## Migration Strategy

### Phase 1: Create Collections

```bash
# Use Appwrite console or CLI
appwrite databases create-collection \
  --databaseId default \
  --collectionId subscriptions \
  --name "Subscriptions" \
  --permissions '["read(user)"]'

appwrite databases create-collection \
  --databaseId default \
  --collectionId webhook_events \
  --name "Webhook Events" \
  --permissions '["read(team:admins)"]'
```

### Phase 2: Add Indexes

```bash
# subscriptions indexes
appwrite databases create-index \
  --databaseId default \
  --collectionId subscriptions \
  --key userId \
  --type unique

appwrite databases create-index \
  --databaseId default \
  --collectionId subscriptions \
  --key polarSubscriptionId \
  --type unique

# webhook_events indexes
appwrite databases create-index \
  --databaseId default \
  --collectionId webhook_events \
  --key eventId \
  --type unique
```

### Phase 3: Backfill (if needed)

```typescript
// No backfill needed - new feature, no existing subscriptions
```

## Monitoring Queries

### Subscription Health

```typescript
// Active subscriptions count
const activeCount = await databases.listDocuments(
  'subscriptions',
  [Query.equal('status', 'active')]
).then(r => r.total);

// Expiring soon (next 7 days)
const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const expiringSoon = await databases.listDocuments(
  'subscriptions',
  [
    Query.equal('status', 'active'),
    Query.lessThan('nextBillingDate', nextWeek.toISOString())
  ]
);
```

### Webhook Health

```typescript
// Failed webhooks last 24h
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recentFailures = await databases.listDocuments(
  'webhook_events',
  [
    Query.equal('processingStatus', 'failed'),
    Query.greaterThan('processedAt', yesterday.toISOString())
  ]
);

// Average processing time
const recent = await databases.listDocuments(
  'webhook_events',
  [
    Query.equal('processingStatus', 'completed'),
    Query.orderDesc('processedAt'),
    Query.limit(100)
  ]
);

const avgDuration = recent.documents.reduce((sum, e) => sum + e.processingDuration, 0) / recent.documents.length;
console.log(`Avg webhook processing: ${avgDuration}ms`);
```
