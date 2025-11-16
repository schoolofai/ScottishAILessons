# API Contract: Get Subscription Status

**Endpoint**: `GET /api/stripe/subscription-status`
**Purpose**: Check current user's subscription status for access control decisions
**Authentication**: Required (Appwrite session)

## Request

### Headers

```
Cookie: a_session_PROJECTID=<session_token>
```

### Query Parameters

None required - user ID extracted from session

## Response

### Success Response (200 OK)

```typescript
interface SubscriptionStatusResponse {
  status: 'active' | 'inactive' | 'payment_failed' | 'cancelled';
  hasAccess: boolean; // Computed: true if status is 'active' OR testUserFlag is true
  testUserFlag: boolean;
  subscriptionExpiresAt: string | null; // ISO 8601 timestamp or null
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscription: SubscriptionDetails | null; // Full subscription record if exists
}

interface SubscriptionDetails {
  planType: 'monthly_ai_access';
  billingCycle: 'monthly' | 'annual';
  paymentStatus: 'current' | 'past_due' | 'failed';
  nextBillingDate: string | null; // ISO 8601 timestamp
  lastPaymentDate: string | null; // ISO 8601 timestamp
}
```

**Example (Active Subscription)**:
```json
{
  "status": "active",
  "hasAccess": true,
  "testUserFlag": false,
  "subscriptionExpiresAt": null,
  "stripeCustomerId": "cus_ABC123DEF456",
  "stripeSubscriptionId": "sub_XYZ789UVW012",
  "subscription": {
    "planType": "monthly_ai_access",
    "billingCycle": "monthly",
    "paymentStatus": "current",
    "nextBillingDate": "2025-02-15T14:30:00.000Z",
    "lastPaymentDate": "2025-01-15T14:30:00.000Z"
  }
}
```

**Example (Test User)**:
```json
{
  "status": "inactive",
  "hasAccess": true,
  "testUserFlag": true,
  "subscriptionExpiresAt": null,
  "stripeCustomerId": null,
  "stripeSubscriptionId": null,
  "subscription": null
}
```

**Example (Inactive User)**:
```json
{
  "status": "inactive",
  "hasAccess": false,
  "testUserFlag": false,
  "subscriptionExpiresAt": null,
  "stripeCustomerId": null,
  "stripeSubscriptionId": null,
  "subscription": null
}
```

### Error Responses

#### 401 Unauthorized

```json
{
  "error": "Authentication failed: No valid session found"
}
```

**Trigger**: No Appwrite session cookie present or invalid session

#### 500 Internal Server Error

```json
{
  "error": "Failed to fetch subscription status: <error_details>"
}
```

**Trigger**: Database query failure or unexpected exception

## Business Logic

### Access Control Decision Flow

```
1. Verify Appwrite session → Get user ID
2. Fetch user record from Appwrite database
3. Check testUserFlag:
   - If true → hasAccess = true (bypass subscription check)
   - If false → hasAccess = (subscriptionStatus === 'active')
4. If subscriptionStatus is 'active', fetch subscription details
5. Return combined status object
```

### Implementation

```typescript
import { createSessionClient } from '@/lib/appwrite-server';
import { databases } from '@/lib/appwrite-config';
import { Query, ID } from 'node-appwrite';

export async function GET(request: Request) {
  try {
    // 1. Verify session and get user
    const { account } = await createSessionClient(request);
    const user = await account.get();

    // 2. Fetch user record with subscription metadata
    const userDoc = await databases.getDocument(
      DATABASE_ID,
      'users',
      user.$id
    );

    // 3. Compute access based on test flag or subscription status
    const hasAccess = userDoc.testUserFlag || userDoc.subscriptionStatus === 'active';

    // 4. Fetch full subscription details if active
    let subscriptionDetails = null;
    if (userDoc.stripeSubscriptionId) {
      const subscriptions = await databases.listDocuments(
        DATABASE_ID,
        'subscriptions',
        [Query.equal('stripeSubscriptionId', userDoc.stripeSubscriptionId)]
      );

      if (subscriptions.documents.length > 0) {
        const sub = subscriptions.documents[0];
        subscriptionDetails = {
          planType: sub.planType,
          billingCycle: sub.billingCycle,
          paymentStatus: sub.paymentStatus,
          nextBillingDate: sub.nextBillingDate,
          lastPaymentDate: sub.lastPaymentDate
        };
      }
    }

    // 5. Return combined status
    return Response.json({
      status: userDoc.subscriptionStatus,
      hasAccess,
      testUserFlag: userDoc.testUserFlag,
      subscriptionExpiresAt: userDoc.subscriptionExpiresAt,
      stripeCustomerId: userDoc.stripeCustomerId,
      stripeSubscriptionId: userDoc.stripeSubscriptionId,
      subscription: subscriptionDetails
    });

  } catch (error) {
    console.error('[Subscription Status] Error:', error);
    throw new Error(`Failed to fetch subscription status: ${error.message}`);
  }
}
```

## Frontend Integration

### React Hook Pattern

```typescript
import useSWR from 'swr';

interface UseSubscriptionReturn {
  status: SubscriptionStatusResponse | null;
  isLoading: boolean;
  error: Error | null;
  hasAccess: boolean;
  refetch: () => void;
}

export function useSubscription(): UseSubscriptionReturn {
  const { data, error, isLoading, mutate } = useSWR<SubscriptionStatusResponse>(
    '/api/stripe/subscription-status',
    async (url) => {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }
      return response.json();
    },
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: false, // Don't refetch on reconnect
      refreshInterval: 0, // No automatic polling (security-critical data)
      dedupingInterval: 5000 // Dedupe requests within 5 seconds
    }
  );

  return {
    status: data ?? null,
    isLoading,
    error: error ?? null,
    hasAccess: data?.hasAccess ?? false,
    refetch: () => mutate()
  };
}
```

### Usage in Components

```typescript
function LessonStartButton({ lessonId }: { lessonId: string }) {
  const { hasAccess, isLoading, status } = useSubscription();

  const handleStartLesson = async () => {
    if (!hasAccess) {
      // Show paywall modal
      setShowPaywallModal(true);
      return;
    }

    // Proceed with lesson start
    await startLessonSession(lessonId);
  };

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <>
      <Button onClick={handleStartLesson}>
        {hasAccess ? 'Start Lesson' : 'Subscribe to Access'}
      </Button>

      {status?.testUserFlag && (
        <Badge variant="warning">Test User - Full Access</Badge>
      )}
    </>
  );
}
```

## Caching Strategy

**DO NOT CACHE** subscription status on the frontend. Always fetch fresh data from the server to prevent access control bypasses.

**Rationale**:
- User subscription status can change at any time (payment failure, cancellation, manual admin intervention)
- Stale cached data could grant unauthorized access to paid features
- Single database query per lesson start is acceptable performance overhead for security-critical decision

## Security Considerations

- **Session Verification**: MUST verify Appwrite session on every request
- **No Caching**: Frontend MUST NOT cache subscription status
- **Access Control**: Use `hasAccess` boolean for all access control decisions
- **Test User Bypass**: Test users bypass all subscription checks (intentional)

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Database Queries | 2 | 1 for user record, 1 for subscription details (optional) |
| Expected Latency | 50-100ms | Appwrite query performance |
| Request Frequency | ~100/hour | Per lesson start + component mounts |
| Cache Strategy | No caching | Security-critical, always fetch fresh |

## Test Cases

| Scenario | Expected Response | Verification Method |
|----------|-------------------|---------------------|
| Active subscription | `hasAccess: true, status: 'active'` | Database check + API response |
| Inactive subscription | `hasAccess: false, status: 'inactive'` | API response |
| Test user (no subscription) | `hasAccess: true, testUserFlag: true` | Database flag check |
| Payment failed | `hasAccess: false, status: 'payment_failed'` | Webhook trigger + API response |
| Cancelled subscription | `hasAccess: false, status: 'cancelled'` | Webhook trigger + API response |
| Unauthenticated user | `401 Unauthorized` | API error response |

## References

- [SWR Data Fetching](https://swr.vercel.app/)
- [Appwrite Authentication](https://appwrite.io/docs/authentication)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
