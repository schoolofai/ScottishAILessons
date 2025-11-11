"use client";

import React from "react";

interface AITutorToggleButtonProps {
  /** Whether the AI tutor panel is currently open */
  isOpen: boolean;
  /** Callback when the toggle button is clicked */
  onToggle: () => void;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * AITutorToggleButton - Toggle button for AI tutor context chat panel
 *
 * Displays in SessionChatAssistant header to open/close the AI tutor panel.
 * Matches the styling and behavior of LessonNotesToggleButton for consistency.
 *
 * @example
 * <AITutorToggleButton
 *   isOpen={isContextChatOpen}
 *   onToggle={() => toggleContextChat()}
 * />
 */
export function AITutorToggleButton({
  isOpen,
  onToggle,
  className = "",
}: AITutorToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
        ${
          isOpen
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }
        hover:shadow-md
        ${className}
      `}
      aria-label={isOpen ? "Close AI tutor panel" : "Open AI tutor panel"}
      aria-pressed={isOpen}
      title={isOpen ? "Close AI tutor" : "Open AI tutor"}
      data-testid="ai-tutor-toggle-button"
    >
      {/* Chat bubble icon */}
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>

      {/* Button text */}
      <span className="text-sm font-medium whitespace-nowrap">AI Tutor</span>

      {/* Expand/collapse indicator */}
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
    </button>
  );
}
