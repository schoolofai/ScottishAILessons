'use client';

import React, { useState } from 'react';
import { LessonQuickNotesButtonProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';
import { LessonQuickNotesModal } from './LessonQuickNotesModal';

/**
 * LessonQuickNotesButton - Button to open lesson quick notes modal
 *
 * Compact button suitable for lesson list items.
 * Disabled if lesson notes are not yet available.
 */
export function LessonQuickNotesButton({
  courseId,
  lessonOrder,
  isAvailable,
  onClick,
  className = '',
  label = 'Quick Notes'
}: LessonQuickNotesButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (isAvailable === true) {
      setIsModalOpen(true);
      onClick();
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const isDisabled = isAvailable === false || isAvailable === null;
  const isChecking = isAvailable === null;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isDisabled
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-400'
        } ${className}`}
        title={
          isChecking
            ? 'Checking availability...'
            : isAvailable === false
            ? 'Lesson notes not yet available'
            : 'Open lesson quick notes'
        }
      >
        {/* Icon */}
        {isChecking ? (
          <svg
            className="animate-spin h-3 w-3"
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
        ) : (
          <svg
            className="w-3 h-3"
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
        )}

        {/* Label */}
        <span>{isChecking ? 'Checking...' : label}</span>
      </button>

      {/* Modal */}
      <LessonQuickNotesModal
        isOpen={isModalOpen}
        onClose={handleClose}
        courseId={courseId}
        lessonOrder={lessonOrder}
      />
    </>
  );
}
