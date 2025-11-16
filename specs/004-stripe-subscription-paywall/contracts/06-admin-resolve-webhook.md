# API Contract: Resolve Failed Webhook

**Endpoint**: `PATCH /api/admin/failed-webhooks/:errorId`
**Purpose**: Mark a failed webhook as resolved or ignored with admin notes
**Authentication**: Required (Appwrite session + admin role)

## Request

### Headers

```
Content-Type: application/json
Cookie: a_session_PROJECTID=<session_token>
```

### Path Parameters

```typescript
interface ResolveWebhookParams {
  errorId: string; // webhook_error_queue document ID
}
```

### Body

```typescript
interface ResolveWebhookRequest {
  resolutionStatus: 'resolved' | 'ignored';
  adminNotes: string; // Required: Explanation of resolution action
  manualAction?: string; // Optional: Description of manual intervention performed
}
```

**Validation Rules**:
- `resolutionStatus` MUST be either 'resolved' or 'ignored'
- `adminNotes` MUST be non-empty string (min 10 chars, max 5000 chars)
- User MUST have admin role

**Example**:
```json
{
  "resolutionStatus": "resolved",
  "adminNotes": "Manually verified user subscription status in Stripe Dashboard. Updated Appwrite user record to match Stripe. Access has been granted.",
  "manualAction": "Updated user 'user_12345' subscription status from 'inactive' to 'active' and set stripeCustomerId to 'cus_ABC123'"
}
```

## Response

### Success Response (200 OK)

```typescript
interface ResolveWebhookResponse {
  success: true;
  errorId: string;
  resolutionStatus: 'resolved' | 'ignored';
  resolvedAt: string; // ISO 8601 timestamp
  adminUserId: string; // ID of admin who resolved
  adminNotes: string;
}
```

**Example**:
```json
{
  "success": true,
  "errorId": "error_66778",
  "resolutionStatus": "resolved",
  "resolvedAt": "2025-01-15T16:30:00.000Z",
  "adminUserId": "admin_99999",
  "adminNotes": "Manually verified user subscription status in Stripe Dashboard..."
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

#### 400 Bad Request

```json
{
  "error": "Invalid resolution status. Must be 'resolved' or 'ignored'"
}
```

**Trigger**: Invalid `resolutionStatus` value

```json
{
  "error": "Admin notes required (min 10 characters)"
}
```

**Trigger**: Missing or too short `adminNotes`

#### 404 Not Found

```json
{
  "error": "Failed webhook error not found"
}
```

**Trigger**: Invalid `errorId` or error already resolved

#### 500 Internal Server Error

```json
{
  "error": "Failed to resolve webhook error: <error_details>"
}
```

**Trigger**: Database update failure or unexpected exception

## Business Logic

### Implementation

```typescript
import { createSessionClient } from '@/lib/appwrite-server';
import { databases } from '@/lib/appwrite-config';
import { ID } from 'node-appwrite';

export async function PATCH(
  request: Request,
  { params }: { params: { errorId: string } }
) {
  try {
    // 1. Verify session and check admin role
    const { account } = await createSessionClient(request);
    const user = await account.get();

    const userDoc = await databases.getDocument(DATABASE_ID, 'users', user.$id);
    if (!userDoc.roles?.includes('admin')) {
      return Response.json(
        { error: 'Access denied: Admin role required' },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { resolutionStatus, adminNotes, manualAction } = body;

    // 3. Validate inputs
    if (!['resolved', 'ignored'].includes(resolutionStatus)) {
      return Response.json(
        { error: "Invalid resolution status. Must be 'resolved' or 'ignored'" },
        { status: 400 }
      );
    }

    if (!adminNotes || adminNotes.trim().length < 10) {
      return Response.json(
        { error: 'Admin notes required (min 10 characters)' },
        { status: 400 }
      );
    }

    // 4. Fetch error record
    const errorRecord = await databases.getDocument(
      DATABASE_ID,
      'webhook_error_queue',
      params.errorId
    );

    if (!errorRecord) {
      return Response.json(
        { error: 'Failed webhook error not found' },
        { status: 404 }
      );
    }

    // 5. Update error record
    const resolvedAt = new Date().toISOString();

    const updatedError = await databases.updateDocument(
      DATABASE_ID,
      'webhook_error_queue',
      params.errorId,
      {
        resolutionStatus,
        adminUserId: user.$id,
        adminNotes: `${adminNotes}\n\nManual Action: ${manualAction || 'None specified'}`,
        resolvedAt
      }
    );

    // 6. Create audit log entry for admin action
    await databases.createDocument(
      DATABASE_ID,
      'subscription_audit_logs',
      ID.unique(),
      {
        userId: 'system', // System-level action
        subscriptionId: 'N/A',
        timestamp: resolvedAt,
        previousStatus: 'webhook_error_pending',
        newStatus: `webhook_error_${resolutionStatus}`,
        triggerSource: 'manual_admin',
        eventId: errorRecord.webhookEventId,
        adminUserId: user.$id,
        adminNotes: `Webhook error ${resolutionStatus}: ${adminNotes}`
      }
    );

    // 7. Return success response
    return Response.json({
      success: true,
      errorId: params.errorId,
      resolutionStatus,
      resolvedAt,
      adminUserId: user.$id,
      adminNotes
    });

  } catch (error) {
    console.error('[Resolve Webhook] Error:', error);
    throw new Error(`Failed to resolve webhook error: ${error.message}`);
  }
}
```

### Resolution Workflow

```
Admin reviews failed webhook in dashboard
  ↓
Admin investigates error details and webhook payload
  ↓
Admin performs manual intervention (if needed):
  - Verify Stripe Dashboard subscription status
  - Compare with Appwrite user record
  - Manually update user subscription status if discrepancy found
  ↓
Admin marks webhook as 'resolved' or 'ignored' with notes
  ↓
System updates webhook_error_queue record
  ↓
System creates audit log entry for admin action
```

## Frontend Integration

### Resolve Webhook Modal Component

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ResolveWebhookModalProps {
  webhook: FailedWebhook;
  onResolved: () => void;
  onClose: () => void;
}

export function ResolveWebhookModal({
  webhook,
  onResolved,
  onClose
}: ResolveWebhookModalProps) {
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'ignored'>('resolved');
  const [adminNotes, setAdminNotes] = useState('');
  const [manualAction, setManualAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (adminNotes.length < 10) {
      alert('Please provide detailed admin notes (min 10 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/failed-webhooks/${webhook.$id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolutionStatus,
          adminNotes,
          manualAction
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      alert('Webhook resolved successfully');
      onResolved(); // Refresh webhook list
      onClose();

    } catch (error) {
      console.error('Failed to resolve webhook:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal">
      <h2>Resolve Failed Webhook</h2>

      <div>
        <strong>Event ID:</strong> {webhook.webhookEventId}
      </div>
      <div>
        <strong>Event Type:</strong> {webhook.eventType}
      </div>
      <div>
        <strong>Error:</strong> {webhook.errorMessage}
      </div>

      <hr />

      <label>
        Resolution Status:
        <select
          value={resolutionStatus}
          onChange={(e) => setResolutionStatus(e.target.value as 'resolved' | 'ignored')}
        >
          <option value="resolved">Resolved (issue fixed)</option>
          <option value="ignored">Ignored (non-critical, skip)</option>
        </select>
      </label>

      <label>
        Manual Action Performed (optional):
        <Textarea
          placeholder="Describe any manual intervention (e.g., 'Updated user subscription status in Appwrite')"
          value={manualAction}
          onChange={(e) => setManualAction(e.target.value)}
          rows={3}
        />
      </label>

      <label>
        Admin Notes (required, min 10 chars):
        <Textarea
          placeholder="Explain why this was resolved/ignored and what investigation was done"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={5}
        />
      </label>

      <div className="modal-actions">
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Resolution'}
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

## Security Considerations

- **Admin-Only Access**: MUST verify user has admin role before allowing resolution
- **Audit Trail**: ALL admin actions MUST be logged to `subscription_audit_logs`
- **Immutability**: Once resolved, error records should NOT be editable (enforce in UI)
- **Detailed Notes**: Require comprehensive admin notes for compliance and debugging

## Common Resolution Scenarios

### Scenario 1: User Subscription Status Mismatch

**Error**: "Failed to update user subscription status: User record not found"

**Investigation**:
1. Check Stripe Dashboard for subscription status
2. Check Appwrite users collection for user record
3. Verify user ID mapping (client_reference_id in Stripe)

**Resolution Action**:
- If user exists in Appwrite but subscription status is wrong: Manually update `subscriptionStatus`, `stripeCustomerId`, `stripeSubscriptionId`
- Mark as 'resolved' with notes explaining manual update

### Scenario 2: Database Connection Timeout

**Error**: "Failed to update user subscription status: Appwrite database connection timeout"

**Investigation**:
1. Check Appwrite service status during error timestamp
2. Verify error was transient (network issue, server restart)

**Resolution Action**:
- Check current user subscription status in Appwrite
- If status is correct (webhook retry succeeded): Mark as 'ignored' with notes
- If status is incorrect: Manually update and mark as 'resolved'

### Scenario 3: Invalid User ID in Webhook

**Error**: "No user found for Stripe customer cus_ABC123"

**Investigation**:
1. Check Stripe customer metadata for `userId`
2. Check if user was deleted from Appwrite
3. Verify customer ID is valid in Stripe

**Resolution Action**:
- If user was deleted: Mark as 'ignored' (orphaned subscription)
- If customer ID mismatch: Update Stripe customer metadata and mark as 'resolved'

## References

- [Appwrite Database Updates](https://appwrite.io/docs/databases#update-document)
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Stripe Dashboard](https://dashboard.stripe.com/)
