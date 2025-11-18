'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineLoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ResolveWebhookModal } from './ResolveWebhookModal';

interface WebhookError {
  $id: string;
  webhookEventId: string;
  errorMessage: string;
  retryCount: number;
  lastRetryAt: string | null;
  resolutionStatus: 'pending_admin_review' | 'resolved' | 'ignored';
  adminUserId: string | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  $createdAt: string;
  $updatedAt: string;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type StatusFilter = 'all' | 'pending_admin_review' | 'resolved' | 'ignored';

/**
 * AdminFailedWebhooksTable displays webhook errors from webhook_error_queue collection.
 * Allows admins to view, filter, and resolve webhook errors.
 *
 * Uses server API endpoints for all operations (no client SDK).
 * Follows fast-fail pattern - throws errors without fallback.
 */
export function AdminFailedWebhooksTable() {
  const [webhookErrors, setWebhookErrors] = useState<WebhookError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending_admin_review');
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 25,
    offset: 0,
    hasMore: false
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [resolveModalId, setResolveModalId] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhookErrors();
  }, [statusFilter]);

  async function fetchWebhookErrors(offset = 0) {
    try {
      setLoading(true);
      setError(null);

      console.log('[AdminFailedWebhooksTable] Fetching webhook errors via server API...');

      // Build query parameters
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: offset.toString()
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      // Use server API endpoint
      const response = await fetch(`/api/admin/failed-webhooks?${params}`, {
        method: 'GET',
        credentials: 'include', // Include httpOnly cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Admin access required.');
        }

        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch webhook errors' }));
        throw new Error(errorData.error || 'Failed to fetch webhook errors');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch webhook errors');
      }

      console.log(`[AdminFailedWebhooksTable] Fetched ${result.webhookErrors.length} webhook errors (total: ${result.pagination.total})`);

      setWebhookErrors(result.webhookErrors);
      setPagination(result.pagination);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load webhook errors';
      setError(message);
      console.error('[AdminFailedWebhooksTable] Error fetching webhook errors:', err);
      // Fast fail - error logged and displayed
    } finally {
      setLoading(false);
    }
  }

  function toggleRowExpanded(errorId: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(errorId)) {
        next.delete(errorId);
      } else {
        next.add(errorId);
      }
      return next;
    });
  }

  function handleResolveSuccess() {
    setResolveModalId(null);
    // Refresh the list
    fetchWebhookErrors(pagination.offset);
    toast.success('Webhook error resolved successfully!');
  }

  function handleLoadMore() {
    fetchWebhookErrors(pagination.offset + pagination.limit);
  }

  function handleLoadPrevious() {
    fetchWebhookErrors(Math.max(0, pagination.offset - pagination.limit));
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending_admin_review':
        return 'destructive';
      case 'resolved':
        return 'default';
      case 'ignored':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString();
  };

  if (loading && webhookErrors.length === 0) {
    return (
      <div className="space-y-4" data-testid="failed-webhooks-loading">
        <InlineLoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3"
        data-testid="failed-webhooks-error"
      >
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading Webhook Errors</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="failed-webhooks-table">
      {/* Header with filter controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Failed Webhooks</h2>
          <p className="text-sm text-gray-600 mt-1">
            {pagination.total} error{pagination.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border rounded-md px-3 py-2 text-sm"
            data-testid="status-filter-select"
          >
            <option value="all">All Statuses</option>
            <option value="pending_admin_review">Pending Review</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchWebhookErrors(pagination.offset)}
            disabled={loading}
            data-testid="refresh-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      {webhookErrors.length === 0 ? (
        <div className="text-center py-12" data-testid="no-webhook-errors">
          <p className="text-gray-600">No webhook errors found</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Event ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Error</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Retries</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {webhookErrors.map((webhookError) => (
                <>
                  <tr
                    key={webhookError.$id}
                    className="hover:bg-gray-50"
                    data-testid={`webhook-error-row-${webhookError.$id}`}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      <button
                        onClick={() => toggleRowExpanded(webhookError.$id)}
                        className="flex items-center gap-1 hover:text-blue-600"
                        data-testid={`expand-button-${webhookError.$id}`}
                      >
                        {expandedRows.has(webhookError.$id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        {webhookError.webhookEventId.substring(0, 20)}...
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                      {webhookError.errorMessage.substring(0, 50)}
                      {webhookError.errorMessage.length > 50 ? '...' : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {webhookError.retryCount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusBadgeVariant(webhookError.resolutionStatus)}>
                        {webhookError.resolutionStatus.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDate(webhookError.$createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {webhookError.resolutionStatus === 'pending_admin_review' && (
                        <Button
                          size="sm"
                          onClick={() => setResolveModalId(webhookError.$id)}
                          data-testid={`resolve-button-${webhookError.$id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                      {webhookError.resolutionStatus !== 'pending_admin_review' && (
                        <span className="text-sm text-gray-500">
                          {webhookError.resolutionStatus === 'resolved' ? (
                            <CheckCircle2 className="h-4 w-4 inline text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 inline text-gray-400" />
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                  {/* Expanded details row */}
                  {expandedRows.has(webhookError.$id) && (
                    <tr
                      key={`${webhookError.$id}-details`}
                      data-testid={`webhook-error-details-${webhookError.$id}`}
                    >
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Full Event ID</h4>
                            <p className="text-sm font-mono text-gray-900 mt-1">
                              {webhookError.webhookEventId}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Error Message</h4>
                            <pre className="text-sm text-gray-900 mt-1 whitespace-pre-wrap bg-white p-3 rounded border max-h-48 overflow-auto">
                              {webhookError.errorMessage}
                            </pre>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">Last Retry</h4>
                              <p className="text-sm text-gray-900 mt-1">
                                {formatDate(webhookError.lastRetryAt)}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">Updated</h4>
                              <p className="text-sm text-gray-900 mt-1">
                                {formatDate(webhookError.$updatedAt)}
                              </p>
                            </div>
                          </div>
                          {webhookError.resolvedAt && (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-700">Resolved At</h4>
                                <p className="text-sm text-gray-900 mt-1">
                                  {formatDate(webhookError.resolvedAt)}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-700">Resolved By</h4>
                                <p className="text-sm font-mono text-gray-900 mt-1">
                                  {webhookError.adminUserId || '—'}
                                </p>
                              </div>
                            </div>
                          )}
                          {webhookError.adminNotes && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700">Admin Notes</h4>
                              <p className="text-sm text-gray-900 mt-1 bg-white p-3 rounded border">
                                {webhookError.adminNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {(pagination.offset > 0 || pagination.hasMore) && (
        <div className="flex justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={handleLoadPrevious}
            disabled={pagination.offset === 0 || loading}
            data-testid="load-previous-button"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={!pagination.hasMore || loading}
            data-testid="load-more-button"
          >
            Next
          </Button>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalId && (
        <ResolveWebhookModal
          errorId={resolveModalId}
          webhookEventId={webhookErrors.find(e => e.$id === resolveModalId)?.webhookEventId || ''}
          isOpen={true}
          onClose={() => setResolveModalId(null)}
          onSuccess={handleResolveSuccess}
        />
      )}
    </div>
  );
}
