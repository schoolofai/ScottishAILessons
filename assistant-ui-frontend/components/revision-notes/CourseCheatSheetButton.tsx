'use client';

import React, { useState } from 'react';
import { CourseCheatSheetButtonProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';
import { CourseCheatSheetModal } from './CourseCheatSheetModal';

/**
 * CourseCheatSheetButton - Button to open course cheat sheet modal
 *
 * Displays availability status and opens the cheat sheet modal on click.
 * Disabled if cheat sheet is not yet available.
 *
 * Usage:
 * ```tsx
 * <CourseCheatSheetButton
 *   courseId="nat3_app_maths"
 *   isAvailable={true}
 *   onClick={() => console.log('Opening cheat sheet')}
 * />
 * ```
 */
export function CourseCheatSheetButton({
  courseId,
  isAvailable,
  onClick,
  className = '',
  label = 'Course Cheat Sheet'
}: CourseCheatSheetButtonProps) {
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

  // Determine button state
  const isDisabled = isAvailable === false || isAvailable === null;
  const isChecking = isAvailable === null;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`inline-flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
          isDisabled
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm'
        } ${className}`}
        title={
          isChecking
            ? 'Checking availability...'
            : isAvailable === false
            ? 'Cheat sheet not yet available for this course'
            : 'Open course cheat sheet'
        }
      >
        {/* Icon */}
        {isChecking ? (
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
        ) : (
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
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
        <span>
          {isChecking
            ? 'Checking...'
            : isAvailable === false
            ? 'Not Available'
            : label}
        </span>

        {/* Availability badge (optional visual indicator) */}
        {isAvailable === true && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Available
          </span>
        )}
      </button>

      {/* Modal */}
      <CourseCheatSheetModal
        isOpen={isModalOpen}
        onClose={handleClose}
        courseId={courseId}
      />
    </>
  );
}
