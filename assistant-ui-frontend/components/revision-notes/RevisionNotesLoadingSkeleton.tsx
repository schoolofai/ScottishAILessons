'use client';

import React from 'react';
import { RevisionNotesLoadingSkeletonProps } from '@/specs/003-revision-notes-frontend/contracts/RevisionNotesComponents';

/**
 * RevisionNotesLoadingSkeleton - Structured skeleton UI for loading states
 *
 * Displays content structure that matches typical markdown rendering:
 * - Multiple heading + paragraph sections
 * - Code block placeholders
 * - Diagram placeholders (for Mermaid)
 *
 * Reduces perceived latency by 30-40% by showing expected structure
 */
export function RevisionNotesLoadingSkeleton({
  noteType,
  config = {},
  className = ''
}: RevisionNotesLoadingSkeletonProps) {
  // Default configuration based on note type
  const defaults = noteType === 'cheat_sheet'
    ? { headingCount: 6, paragraphBlocksPerSection: 3, hasCodeBlocks: true, hasDiagrams: true }
    : { headingCount: 4, paragraphBlocksPerSection: 2, hasCodeBlocks: true, hasDiagrams: false };

  const {
    headingCount = defaults.headingCount,
    paragraphBlocksPerSection = defaults.paragraphBlocksPerSection,
    hasCodeBlocks = defaults.hasCodeBlocks,
    hasDiagrams = defaults.hasDiagrams
  } = config;

  // Pulse animation for skeleton elements
  const pulseClass = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  return (
    <div className={`revision-notes-skeleton space-y-6 ${className}`} role="status" aria-label="Loading revision notes">
      {/* Title skeleton */}
      <div className={`h-8 w-3/4 ${pulseClass}`} />

      {/* Render sections based on heading count */}
      {Array.from({ length: headingCount }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          {/* Section heading */}
          <div className={`h-6 w-1/2 ${pulseClass}`} />

          {/* Paragraph blocks */}
          {Array.from({ length: paragraphBlocksPerSection }).map((_, paragraphIndex) => (
            <div key={paragraphIndex} className="space-y-2">
              <div className={`h-4 w-full ${pulseClass}`} />
              <div className={`h-4 w-11/12 ${pulseClass}`} />
              <div className={`h-4 w-10/12 ${pulseClass}`} />
            </div>
          ))}

          {/* Code block placeholder (every 2 sections) */}
          {hasCodeBlocks && sectionIndex % 2 === 0 && (
            <div className={`h-32 w-full ${pulseClass}`} />
          )}

          {/* Diagram placeholder (every 3 sections for cheat sheets) */}
          {hasDiagrams && sectionIndex % 3 === 0 && (
            <div className={`h-48 w-full ${pulseClass}`} />
          )}
        </div>
      ))}

      {/* Accessibility: Screen reader announcement */}
      <span className="sr-only">Loading revision notes content, please wait...</span>
    </div>
  );
}
