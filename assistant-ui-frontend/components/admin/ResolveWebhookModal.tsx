'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface ResolveWebhookModalProps {
  errorId: string;
  webhookEventId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * ResolveWebhookModal allows admins to resolve a webhook error.
 *
 * Provides options to mark as 'resolved' or 'ignored' with required admin notes.
 * Follows fast-fail pattern - throws errors without fallback.
 *
 * @param errorId - The webhook error document ID
 * @param webhookEventId - The Stripe webhook event ID for display
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback when modal is closed
 * @param onSuccess - Callback when resolution succeeds
 */
export function ResolveWebhookModal({
  errorId,
  webhookEventId,
  isOpen,
  onClose,
  onSuccess
}: ResolveWebhookModalProps) {
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'ignored'>('resolved');
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = adminNotes.trim().length >= 10;

  async function handleSubmit() {
    if (!isValid) {
      setError('Admin notes must be at least 10 characters');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log(`[ResolveWebhookModal] Resolving webhook error ${errorId}...`);

      const response = await fetch(`/api/admin/failed-webhooks/${errorId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resolutionStatus,
          adminNotes: adminNotes.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to resolve webhook error' }));
        throw new Error(errorData.error || 'Failed to resolve webhook error');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to resolve webhook error');
      }

      console.log(`[ResolveWebhookModal] Webhook error ${errorId} resolved successfully`);

      // Call success callback
      onSuccess();

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve webhook error';
      setError(message);
      console.error('[ResolveWebhookModal] Error resolving webhook error:', err);
      // Fast fail - error logged and displayed
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]" data-testid="resolve-webhook-modal">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <DialogTitle>Resolve Webhook Error</DialogTitle>
          </div>
          <DialogDescription className="pt-3">
            Resolving webhook event: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{webhookEventId.substring(0, 30)}...</code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resolution Status Radio Group */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Resolution Status <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  resolutionStatus === 'resolved' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                data-testid="status-option-resolved"
              >
                <input
                  type="radio"
                  name="resolutionStatus"
                  value="resolved"
                  checked={resolutionStatus === 'resolved'}
                  onChange={() => setResolutionStatus('resolved')}
                  className="h-4 w-4 text-green-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">Resolved</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Issue has been investigated and fixed
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                  resolutionStatus === 'ignored' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
                data-testid="status-option-ignored"
              >
                <input
                  type="radio"
                  name="resolutionStatus"
                  value="ignored"
                  checked={resolutionStatus === 'ignored'}
                  onChange={() => setResolutionStatus('ignored')}
                  className="h-4 w-4 text-gray-600"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Ignored</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Issue does not require action (e.g., duplicate, test event)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Admin Notes Textarea */}
          <div className="space-y-2">
            <label htmlFor="adminNotes" className="text-sm font-medium text-gray-700">
              Admin Notes <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">(min 10 characters)</span>
            </label>
            <textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Describe the resolution or reason for ignoring this error..."
              className={`w-full px-3 py-2 border rounded-md text-sm min-h-[100px] ${
                adminNotes.length > 0 && !isValid ? 'border-red-300' : 'border-gray-300'
              }`}
              disabled={isProcessing}
              data-testid="admin-notes-input"
            />
            <div className="flex justify-between text-xs">
              <span className={adminNotes.length > 0 && !isValid ? 'text-red-500' : 'text-gray-500'}>
                {adminNotes.trim().length}/10 minimum characters
              </span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="text-sm text-red-600 bg-red-50 p-3 rounded-md"
              data-testid="resolve-error-message"
            >
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !isValid}
            data-testid="submit-button"
          >
            {isProcessing ? 'Processing...' : `Mark as ${resolutionStatus === 'resolved' ? 'Resolved' : 'Ignored'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
