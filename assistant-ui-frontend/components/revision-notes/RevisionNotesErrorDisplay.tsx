'use client';

import React from 'react';
import { RevisionNotesErrorDisplayProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';
import { RevisionNotesErrorCode } from '@/lib/appwrite/driver/RevisionNotesDriver';

/**
 * RevisionNotesErrorDisplay - Error UI with retry functionality
 *
 * Displays detailed error messages with contextual actions:
 * - FILE_NOT_FOUND: Explains content not yet generated (no retry)
 * - NETWORK_ERROR: Suggests network issues (retry available)
 * - STORAGE_UNAVAILABLE: Temporary storage issue (retry available)
 * - FETCH_FAILED: Generic failure (retry available)
 *
 * Fast-fail principle: No silent fallbacks, detailed error messages
 */
export function RevisionNotesErrorDisplay({
  error,
  retryState,
  onRetry,
  className = ''
}: RevisionNotesErrorDisplayProps) {
  const { retryCount, isRetrying, lastRetryTime } = retryState;

  // Determine error styling based on severity
  const errorStyle = error.retryable
    ? 'border-yellow-300 bg-yellow-50 text-yellow-800'
    : 'border-red-300 bg-red-50 text-red-800';

  const iconStyle = error.retryable ? 'text-yellow-500' : 'text-red-500';

  // Error-specific messages
  const getErrorMessage = () => {
    switch (error.code) {
      case RevisionNotesErrorCode.FILE_NOT_FOUND:
        return {
          title: 'Revision Notes Not Available Yet',
          message: 'This content has not been generated yet. Please check back later or contact your instructor.',
          icon: '📝'
        };

      case RevisionNotesErrorCode.NETWORK_ERROR:
        return {
          title: 'Network Connection Issue',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          icon: '🌐'
        };

      case RevisionNotesErrorCode.STORAGE_UNAVAILABLE:
        return {
          title: 'Storage Service Unavailable',
          message: 'The file storage service is temporarily unavailable. This is usually resolved quickly.',
          icon: '💾'
        };

      case RevisionNotesErrorCode.FETCH_FAILED:
        return {
          title: 'Failed to Load Content',
          message: 'An unexpected error occurred while loading the revision notes. Please try again.',
          icon: '⚠️'
        };

      case RevisionNotesErrorCode.PARSE_ERROR:
        return {
          title: 'Content Format Error',
          message: 'The revision notes content could not be processed. This may be due to malformed data.',
          icon: '📄'
        };

      case RevisionNotesErrorCode.INVALID_DOCUMENT_ID:
        return {
          title: 'Invalid Request',
          message: 'The requested revision notes could not be found. Please verify the course or lesson details.',
          icon: '🔍'
        };

      default:
        return {
          title: 'Unknown Error',
          message: error.message || 'An unexpected error occurred.',
          icon: '❌'
        };
    }
  };

  const errorContent = getErrorMessage();

  // Calculate backoff hint for rapid retries (exponential backoff awareness)
  const getBackoffHint = () => {
    // Check for rapid retries within 30 seconds
    if (lastRetryTime) {
      const timeSinceLastRetry = Date.now() - lastRetryTime;
      const isRapidRetry = timeSinceLastRetry < 30000; // 30 seconds

      if (isRapidRetry && retryCount >= 3) {
        const recommendedWait = Math.pow(2, retryCount - 2); // Exponential: 2^1=2s, 2^2=4s, 2^3=8s, etc.
        return `⏳ You've retried ${retryCount} times in quick succession. Please wait at least ${recommendedWait} seconds before trying again to avoid overwhelming the server.`;
      }
    }

    // General backoff for multiple retries
    if (retryCount >= 3) {
      return 'You\'ve tried several times. Consider waiting a few minutes before trying again.';
    }

    return null;
  };

  const backoffHint = getBackoffHint();

  return (
    <div className={`revision-notes-error ${className}`}>
      <div className={`p-6 border rounded-lg ${errorStyle}`}>
        {/* Error icon and title */}
        <div className="flex items-start space-x-3">
          <span className={`text-2xl ${iconStyle}`}>{errorContent.icon}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{errorContent.title}</h3>
            <p className="text-sm mb-4">{errorContent.message}</p>

            {/* Technical details (collapsible) */}
            <details className="mb-4">
              <summary className="text-xs cursor-pointer hover:underline">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border text-xs font-mono">
                <p><strong>Error Code:</strong> {error.code}</p>
                <p><strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}</p>
                <p><strong>Message:</strong> {error.message}</p>
                {retryCount > 0 && (
                  <p><strong>Retry Attempts:</strong> {retryCount}</p>
                )}
                {lastRetryTime && (
                  <p><strong>Last Retry:</strong> {new Date(lastRetryTime).toLocaleTimeString()}</p>
                )}
              </div>
            </details>

            {/* Retry button (only for retryable errors) */}
            {error.retryable && (
              <div className="space-y-2">
                {backoffHint && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 italic">
                    {backoffHint}
                  </p>
                )}

                <button
                  onClick={onRetry}
                  disabled={isRetrying}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                    isRetrying
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                  }`}
                >
                  {isRetrying ? (
                    <span className="flex items-center space-x-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Retrying...</span>
                    </span>
                  ) : (
                    `Try Again ${retryCount > 0 ? `(${retryCount})` : ''}`
                  )}
                </button>
              </div>
            )}

            {/* Non-retryable error guidance */}
            {!error.retryable && (
              <p className="text-xs text-red-600 dark:text-red-400 italic">
                This error cannot be resolved by retrying. Please contact support if the issue persists.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
