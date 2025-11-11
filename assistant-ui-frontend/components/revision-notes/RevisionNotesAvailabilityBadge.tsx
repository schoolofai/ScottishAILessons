/**
 * RevisionNotesAvailabilityBadge Component
 *
 * Displays availability status for revision notes (course cheat sheets or lesson notes).
 * Shows loading state when checking availability, and clear messaging when available or unavailable.
 *
 * @see specs/003-revision-notes-frontend/contracts/RevisionNotesComponents.ts
 */

'use client';

import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export interface RevisionNotesAvailabilityBadgeProps {
  /** Availability status (null = checking) */
  isAvailable: boolean | null;

  /** Note type for contextual messaging */
  variant: 'cheat_sheet' | 'lesson_note';

  /** CSS class names for styling */
  className?: string;
}

export function RevisionNotesAvailabilityBadge({
  isAvailable,
  variant,
  className = ''
}: RevisionNotesAvailabilityBadgeProps) {
  // Loading state (checking availability)
  if (isAvailable === null) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking availability...</span>
      </div>
    );
  }

  // Available state
  if (isAvailable) {
    const label = variant === 'cheat_sheet' ? 'Course Cheat Sheet Available' : 'Lesson Notes Available';
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm ${className}`}>
        <CheckCircle className="h-4 w-4" />
        <span>{label}</span>
      </div>
    );
  }

  // Unavailable state
  const label = variant === 'cheat_sheet' ? 'Course Cheat Sheet Not Yet Available' : 'Lesson Notes Not Yet Available';
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-sm ${className}`}>
      <XCircle className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}
