# API Contract: Admin Failed Webhooks Dashboard

**Endpoint**: `GET /api/admin/failed-webhooks`
**Purpose**: Retrieve list of failed webhook events for manual admin intervention
**Authentication**: Required (Appwrite session + admin role)

## Request

### Headers

```
Cookie: a_session_PROJECTID=<session_token>
```

### Query Parameters

```typescript
interface FailedWebhooksQuery {
  status?: 'pending_admin_review' | 'resolved' | 'ignored'; // Filter by resolution status
  limit?: number; // Default: 50, Max: 100
  offset?: number; // Pagination offset, Default: 0
}
```

**Example**: `GET /api/admin/failed-webhooks?status=pending_admin_review&limit=20`

## Response

### Success Response (200 OK)

```typescript
interface FailedWebhooksResponse {
  total: number; // Total count matching filter
  webhooks: FailedWebhook[];
}

interface FailedWebhook {
  $id: string; // Error queue document ID
  webhookEventId: string; // Stripe event ID
  eventType: string; // Event type (e.g., 'invoice.payment_failed')
  errorMessage: string; // Error details from processing
  retryCount: number; // Number of manual retry attempts
  lastRetryAt: string | null; // ISO 8601 timestamp
  resolutionStatus: 'pending_admin_review' | 'resolved' | 'ignored';
  adminUserId: string | null; // Admin who resolved (if resolved)
  adminNotes: string | null; // Resolution notes
  createdAt: string; // ISO 8601 timestamp
  resolvedAt: string | null; // ISO 8601 timestamp
  webhookPayload: WebhookEventPayload | null; // Full event details
}

interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  receivedAt: string;
  processingStatus: 'failed';
  payload: string; // JSON string of Stripe event
}
```

**Example**:
```json
{
  "total": 3,
  "webhooks": [
    {
      "$id": "error_66778",
      "webhookEventId": "evt_1ABC2DEF3GHI4JKL",
      "eventType": "invoice.payment_failed",
      "errorMessage": "Failed to update user subscription status: Appwrite database connection timeout",
      "retryCount": 1,
      "lastRetryAt": "2025-01-15T15:00:00.000Z",
      "resolutionStatus": "pending_admin_review",
      "adminUserId": null,
      "adminNotes": null,
      "createdAt": "2025-01-15T14:30:05.000Z",
      "resolvedAt": null,
      "webhookPayload": {
        "eventId": "evt_1ABC2DEF3GHI4JKL",
        "eventType": "invoice.payment_failed",
        "receivedAt": "2025-01-15T14:30:00.000Z",
        "processingStatus": "failed",
        "payload": "{\"id\":\"evt_1ABC2DEF3GHI4JKL\",\"object\":\"event\",...}"
      }
    }
  ]
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

#### 403 Forbidden

```json
{
  "error": "Access denied: Admin role required"
}
```

**Trigger**: User is authenticated but does not have admin role

#### 500 Internal Server Error

```json
{
  "error": "Failed to fetch failed webhooks: <error_details>"
}
```

**Trigger**: Database query failure or unexpected exception

## Business Logic

### Implementation

```typescript
import { createSessionClient } from '@/lib/appwrite-server';
import { databases } from '@/lib/appwrite-config';
import { Query } from 'node-appwrite';

export async function GET(request: Request) {
  try {
    // 1. Verify session and check admin role
    const { account } = await createSessionClient(request);
    const user = await account.get();

    // Check admin role (implementation depends on your role system)
    const userDoc = await databases.getDocument(DATABASE_ID, 'users', user.$id);
    if (!userDoc.roles?.includes('admin')) {
      return Response.json(
        { error: 'Access denied: Admin role required' },
        { status: 403 }
      );
    }

    // 2. Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending_admin_review';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 3. Query webhook error queue
    const queries = [
      Query.equal('resolutionStatus', status),
      Query.orderDesc('createdAt'),
      Query.limit(limit),
      Query.offset(offset)
    ];

    const errorQueue = await databases.listDocuments(
      DATABASE_ID,
      'webhook_error_queue',
      queries
    );

    // 4. Enrich with webhook event payloads
    const enrichedWebhooks = await Promise.all(
      errorQueue.documents.map(async (error) => {
        // Fetch webhook event details
        const webhookEvents = await databases.listDocuments(
          DATABASE_ID,
          'stripe_webhook_events',
          [Query.equal('eventId', error.webhookEventId)]
        );

        const webhookPayload = webhookEvents.documents[0] || null;

        return {
          $id: error.$id,
          webhookEventId: error.webhookEventId,
          eventType: webhookPayload?.eventType || 'unknown',
          errorMessage: error.errorMessage,
          retryCount: error.retryCount,
          lastRetryAt: error.lastRetryAt,
          resolutionStatus: error.resolutionStatus,
          adminUserId: error.adminUserId,
          adminNotes: error.adminNotes,
          createdAt: error.$createdAt,
          resolvedAt: error.resolvedAt,
          webhookPayload: webhookPayload ? {
            eventId: webhookPayload.eventId,
            eventType: webhookPayload.eventType,
            receivedAt: webhookPayload.receivedAt,
            processingStatus: webhookPayload.processingStatus,
            payload: webhookPayload.payload
          } : null
        };
      })
    );

    // 5. Return results
    return Response.json({
      total: errorQueue.total,
      webhooks: enrichedWebhooks
    });

  } catch (error) {
    console.error('[Admin Failed Webhooks] Error:', error);
    throw new Error(`Failed to fetch failed webhooks: ${error.message}`);
  }
}
```

## Frontend Integration

### Admin Dashboard Component

```typescript
'use client';

import { useState, useEffect } from 'react';

interface UseFailedWebhooksReturn {
  webhooks: FailedWebhook[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useFailedWebhooks(
  status: string = 'pending_admin_review',
  limit: number = 50
): UseFailedWebhooksReturn {
  const [webhooks, setWebhooks] = useState<FailedWebhook[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebhooks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/failed-webhooks?status=${status}&limit=${limit}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch failed webhooks');
      }

      const data = await response.json();
      setWebhooks(data.webhooks);
      setTotal(data.total);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, [status, limit]);

  return {
    webhooks,
    total,
    isLoading,
    error,
    refetch: fetchWebhooks
  };
}

export function AdminFailedWebhooksTable() {
  const [statusFilter, setStatusFilter] = useState('pending_admin_review');
  const { webhooks, total, isLoading, error, refetch } = useFailedWebhooks(statusFilter);

  if (isLoading) {
    return <div>Loading failed webhooks...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>Failed Webhooks ({total})</h2>

      {/* Filter controls */}
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="pending_admin_review">Pending Review</option>
        <option value="resolved">Resolved</option>
        <option value="ignored">Ignored</option>
      </select>

      {/* Webhooks table */}
      <table>
        <thead>
          <tr>
            <th>Event ID</th>
            <th>Event Type</th>
            <th>Error Message</th>
            <th>Retry Count</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((webhook) => (
            <tr key={webhook.$id}>
              <td><code>{webhook.webhookEventId}</code></td>
              <td>{webhook.eventType}</td>
              <td>{webhook.errorMessage}</td>
              <td>{webhook.retryCount}</td>
              <td>{new Date(webhook.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => handleResolve(webhook.$id)}>
                  Resolve
                </button>
                <button onClick={() => handleViewPayload(webhook.webhookPayload)}>
                  View Payload
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Security Considerations

- **Admin-Only Access**: MUST verify user has admin role before returning data
- **Sensitive Data**: Webhook payloads may contain PII - only expose to authorized admins
- **Audit Logging**: Log all admin access to failed webhooks for compliance

## Related Endpoints

This endpoint is typically paired with:
- `PATCH /api/admin/failed-webhooks/:id` - Resolve/ignore failed webhook
- `POST /api/admin/retry-webhook/:id` - Manually retry webhook processing

## References

- [Appwrite Roles and Permissions](https://appwrite.io/docs/permissions)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
