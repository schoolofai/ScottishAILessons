"use client";

import React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { RevisionNotesLoadingSkeleton } from "./RevisionNotesLoadingSkeleton";
import { RevisionNotesErrorDisplay } from "./RevisionNotesErrorDisplay";
import { SidePanelResizeHandle } from "./SidePanelResizeHandle";
import { LoadingStatus, RetryState } from "@/hooks/useRevisionNotes";
import { RevisionNotesError } from "@/lib/appwrite/driver/RevisionNotesDriver";

interface LessonNotesSidePanelProps {
  /** Markdown content to display */
  content: string | null;
  /** Loading status */
  status: LoadingStatus;
  /** Error object if fetch failed */
  error: RevisionNotesError | null;
  /** Retry state for exponential backoff */
  retryState: RetryState;
  /** Callback to retry failed fetch */
  onRetry: () => Promise<void>;
  /** Callback to close the panel */
  onClose: () => void;
  /** Panel width as percentage */
  panelWidth: number;
  /** Whether resizing is active */
  isResizing: boolean;
  /** Callback when resize drag starts */
  onResizeStart: (e: React.MouseEvent) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * LessonNotesSidePanel - Side panel displaying lesson notes in SessionChatAssistant
 *
 * Features:
 * - Resizable panel (20%-50% of screen width)
 * - Session-scoped caching (persists across panel toggles)
 * - LaTeX and Mermaid diagram rendering
 * - Loading skeleton, error handling with retry
 * - Mutual exclusivity with ContextChat panel
 *
 * @example
 * <LessonNotesSidePanel
 *   content={lessonNotesContent}
 *   status={status}
 *   error={error}
 *   retryState={retryState}
 *   onRetry={handleRetry}
 *   onClose={closeLessonNotes}
 *   panelWidth={panelWidth}
 *   isResizing={isResizing}
 *   onResizeStart={handleMouseDown}
 * />
 */
export function LessonNotesSidePanel({
  content,
  status,
  error,
  retryState,
  onRetry,
  onClose,
  panelWidth,
  isResizing,
  onResizeStart,
  className = "",
}: LessonNotesSidePanelProps) {
  // Keyboard navigation: Esc to close panel
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`relative flex-shrink-0 bg-white border-l border-gray-200 flex flex-col h-screen ${className}`}
      style={{ width: `${panelWidth}%`, minWidth: '280px' }}
      data-testid="lesson-notes-side-panel"
    >
      {/* Resize Handle - hidden on mobile */}
      <div className="hidden md:block">
        <SidePanelResizeHandle
          onMouseDown={onResizeStart}
          isResizing={isResizing}
        />
      </div>

      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Document icon */}
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className="text-xs sm:text-sm font-semibold text-gray-900">Lesson Notes</h2>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors"
          aria-label="Close lesson notes panel"
          data-testid="close-panel-button"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600"
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
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4" data-testid="panel-content">
        {status === "loading" && (
          <RevisionNotesLoadingSkeleton
            headingCount={5}
            paragraphBlocksPerSection={2}
            hasCodeBlocks={true}
            hasDiagrams={false}
          />
        )}

        {status === "error" && error && (
          <RevisionNotesErrorDisplay
            error={error}
            retryState={retryState}
            onRetry={onRetry}
          />
        )}

        {status === "success" && content && (
          <MarkdownRenderer
            content={content}
            className="prose prose-xs sm:prose-sm max-w-none"
            config={{
              supportsLaTeX: true,
              supportsMermaid: true,
              mobileOptimized: true
            }}
          />
        )}

        {status === "download_required" && content && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
            <h3 className="text-sm sm:text-base font-semibold text-yellow-900">
              ⚠️ File Too Large
            </h3>
            <p className="text-xs sm:text-sm text-yellow-700 mt-1">
              This lesson note file is larger than 5MB and cannot be displayed
              inline. Please download it instead.
            </p>
            <a
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(
                content
              )}`}
              download="lesson-notes.md"
              className="mt-3 inline-block rounded bg-yellow-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white hover:bg-yellow-700"
            >
              Download Lesson Notes
            </a>
          </div>
        )}

        {status === "idle" && (
          <div className="text-center text-gray-500 py-8">
            <svg
              className="w-12 h-12 mx-auto text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm">Lesson notes will load when you open the panel</p>
          </div>
        )}
      </div>
    </div>
  );
}
