'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LessonQuickNotesModalProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';
import { useLessonQuickNotes } from '@/hooks/useRevisionNotes';
import { RevisionNotesDriver } from '@/lib/appwrite/driver/RevisionNotesDriver';
import { MarkdownRenderer } from './MarkdownRenderer';
import { RevisionNotesLoadingSkeleton } from './RevisionNotesLoadingSkeleton';
import { RevisionNotesErrorDisplay } from './RevisionNotesErrorDisplay';
import { LargeFileDownloadFallback } from './LargeFileDownloadFallback';

/**
 * LessonQuickNotesModal - Lesson-level quick notes modal dialog
 *
 * Displays lesson quick notes in an accessible Radix UI Dialog modal.
 *
 * Features:
 * - Modal-based caching (fetch on open, clear on close)
 * - LaTeX and Mermaid diagram support
 * - Structured loading skeleton
 * - Detailed error display with retry
 * - >5MB file download fallback
 * - Keyboard accessible (Esc to close)
 */
export function LessonQuickNotesModal({
  isOpen,
  onClose,
  courseId,
  lessonOrder,
  lessonTitle
}: LessonQuickNotesModalProps) {
  const driver = React.useMemo(() => new RevisionNotesDriver(), []);

  // Pass isOpen to trigger fetch when modal opens
  const {
    content,
    status,
    error,
    retryState,
    handleRetry
  } = useLessonQuickNotes(courseId, lessonOrder, driver, isOpen);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-[85vh] flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">

          {/* Modal Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {lessonTitle ? `Lesson ${lessonOrder}: ${lessonTitle}` : `Lesson ${lessonOrder} Quick Notes`}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Quick reference for this lesson
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                className="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Modal Body - Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Loading State */}
            {status === 'loading' && (
              <RevisionNotesLoadingSkeleton noteType="lesson_note" />
            )}

            {/* Success State */}
            {status === 'success' && content && (
              <MarkdownRenderer
                content={content.markdownContent}
                config={{
                  supportsLaTeX: true,
                  supportsMermaid: true,
                  mobileOptimized: true
                }}
              />
            )}

            {/* Download Required State */}
            {status === 'download_required' && content && (
              <LargeFileDownloadFallback
                fileName={`${courseId}_lesson_${String(lessonOrder).padStart(2, '0')}_notes.md`}
                fileSize={content.fileSize}
                downloadUrl={`${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/documents/files/${content.metadata.markdown_file_id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`}
              />
            )}

            {/* Error State */}
            {status === 'error' && error && (
              <RevisionNotesErrorDisplay
                error={error}
                retryState={retryState}
                onRetry={handleRetry}
              />
            )}

            {/* Idle State */}
            {status === 'idle' && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <p>Loading lesson notes...</p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {status === 'success' && content && (
                <p>
                  Last updated: {new Date(content.metadata.updatedAt).toLocaleDateString()}
                  {' • '}
                  {(content.fileSize / 1024).toFixed(2)} KB
                </p>
              )}
            </div>

            <Dialog.Close asChild>
              <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md text-gray-900 dark:text-gray-100 font-medium transition-colors">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
