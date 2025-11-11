"use client";

import React from "react";

interface LessonNotesToggleButtonProps {
  /** Whether the lesson notes panel is currently open */
  isOpen: boolean;
  /** Callback when the toggle button is clicked */
  onToggle: () => void;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Disable button when notes are unavailable */
  disabled?: boolean;
  /** Loading state while checking availability */
  isLoading?: boolean;
}

/**
 * LessonNotesToggleButton - Toggle button for lesson notes side panel
 *
 * Displays in SessionChatAssistant UI to open/close the lesson notes panel.
 * Shows different states: open, closed, disabled (notes unavailable), loading.
 *
 * @example
 * <LessonNotesToggleButton
 *   isOpen={isLessonNotesOpen}
 *   onToggle={() => toggleLessonNotes()}
 *   disabled={!notesAvailable}
 * />
 */
export function LessonNotesToggleButton({
  isOpen,
  onToggle,
  className = "",
  disabled = false,
  isLoading = false,
}: LessonNotesToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled || isLoading}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
        ${
          isOpen
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }
        ${
          disabled || isLoading
            ? "opacity-50 cursor-not-allowed"
            : "hover:shadow-md"
        }
        ${className}
      `}
      aria-label={
        isOpen ? "Close lesson notes panel" : "Open lesson notes panel"
      }
      aria-pressed={isOpen}
      title={
        disabled
          ? "Lesson notes not yet available"
          : isLoading
          ? "Checking lesson notes availability..."
          : isOpen
          ? "Close lesson notes"
          : "Open lesson notes"
      }
      data-testid="lesson-notes-toggle-button"
    >
      {/* Document icon */}
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {isLoading ? (
          // Loading spinner
          <g className="animate-spin origin-center">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </g>
        ) : (
          // Document icon
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        )}
      </svg>

      {/* Button text */}
      <span className="text-sm font-medium whitespace-nowrap">
        {isLoading
          ? "Loading..."
          : disabled
          ? "Notes Unavailable"
          : isOpen
          ? "Lesson Notes"
          : "Lesson Notes"}
      </span>

      {/* Expand/collapse indicator */}
      {!disabled && !isLoading && (
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isOpen ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"}
          />
        </svg>
      )}
    </button>
  );
}
