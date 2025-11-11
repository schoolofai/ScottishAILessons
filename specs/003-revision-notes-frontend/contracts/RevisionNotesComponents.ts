/**
 * RevisionNotesComponents - TypeScript interfaces for revision notes React components
 *
 * This file defines the prop interfaces and component contracts for all
 * revision notes UI components.
 *
 * @see specs/003-revision-notes-frontend/data-model.md for component hierarchy
 */

import { ReactNode } from 'react';
import { RevisionNoteContent, RevisionNotesError } from './RevisionNotesDriver';
import { LoadingStatus, RetryState } from './RevisionNotesHooks';

// ============================================================================
// Markdown Renderer Component
// ============================================================================

/**
 * Configuration for markdown renderer
 */
export interface MarkdownRendererConfig {
  supportsLaTeX?: boolean; // Default: true
  supportsMermaid?: boolean; // Default: true
  supportsSyntaxHighlighting?: boolean; // Default: true
  mobileOptimized?: boolean; // Default: true
  maxWidth?: string; // CSS max-width (e.g., "800px")
}

/**
 * Props for MarkdownRenderer component
 *
 * Renders full-featured markdown with LaTeX, Mermaid, and syntax highlighting
 *
 * @example
 * <MarkdownRenderer
 *   content={cheatSheetContent}
 *   config={{ supportsLaTeX: true, supportsMermaid: true }}
 *   onRenderComplete={() => console.log('Rendered')}
 * />
 */
export interface MarkdownRendererProps {
  /** Markdown source content */
  content: string;

  /** Optional configuration overrides */
  config?: MarkdownRendererConfig;

  /** CSS class names for styling */
  className?: string;

  /** Callback fired when rendering completes */
  onRenderComplete?: () => void;

  /** Error handlers for malformed syntax */
  onMermaidError?: (error: Error, diagram: string) => void;
  onLaTeXError?: (error: Error, expression: string) => void;
}

// ============================================================================
// Course Cheat Sheet Modal Component
// ============================================================================

/**
 * Props for CourseCheatSheetModal component
 *
 * Displays course-level cheat sheet in a modal dialog
 *
 * @example
 * <CourseCheatSheetModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   courseId="course_123"
 * />
 */
export interface CourseCheatSheetModalProps {
  /** Modal open state */
  isOpen: boolean;

  /** Close handler */
  onClose: () => void;

  /** Course ID for fetching cheat sheet */
  courseId: string;

  /** Optional course title for modal header */
  courseTitle?: string;
}

// ============================================================================
// Lesson Quick Notes Modal Component
// ============================================================================

/**
 * Props for LessonQuickNotesModal component
 *
 * Displays lesson-level quick notes in a modal dialog
 *
 * @example
 * <LessonQuickNotesModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   courseId="course_123"
 *   lessonOrder={5}
 *   lessonTitle="Fractions and Decimals"
 * />
 */
export interface LessonQuickNotesModalProps {
  /** Modal open state */
  isOpen: boolean;

  /** Close handler */
  onClose: () => void;

  /** Course ID */
  courseId: string;

  /** Lesson order number (1-based) */
  lessonOrder: number;

  /** Optional lesson title for modal header */
  lessonTitle?: string;
}

// ============================================================================
// Lesson Notes Side Panel Component
// ============================================================================

/**
 * Props for LessonNotesSidePanel component
 *
 * Displays lesson quick notes in a resizable side panel within SessionChatAssistant
 *
 * @example
 * <LessonNotesSidePanel
 *   isOpen={activeSidePanel === 'lesson_notes'}
 *   onClose={closePanel}
 *   sessionId="session_123"
 *   courseId="course_123"
 *   lessonOrder={5}
 *   panelWidth={33}
 *   onWidthChange={setPanelWidth}
 *   onResizeStart={startResize}
 *   onResizeEnd={stopResize}
 * />
 */
export interface LessonNotesSidePanelProps {
  /** Panel visibility state */
  isOpen: boolean;

  /** Close handler */
  onClose: () => void;

  /** Session ID for cache scoping */
  sessionId: string;

  /** Course ID */
  courseId: string;

  /** Lesson order number */
  lessonOrder: number;

  /** Panel width as percentage (20-50) */
  panelWidth: number;

  /** Width change handler */
  onWidthChange: (width: number) => void;

  /** Resize start handler */
  onResizeStart: () => void;

  /** Resize end handler */
  onResizeEnd: () => void;

  /** Optional lesson title for panel header */
  lessonTitle?: string;
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

/**
 * Configuration for loading skeleton structure
 */
export interface LoadingSkeletonConfig {
  headingCount?: number; // Default: 5
  paragraphBlocksPerSection?: number; // Default: 3
  hasCodeBlocks?: boolean; // Default: true
  hasDiagrams?: boolean; // Default: true
}

/**
 * Props for RevisionNotesLoadingSkeleton component
 *
 * Displays structured skeleton UI while markdown content is loading
 *
 * @example
 * <RevisionNotesLoadingSkeleton
 *   noteType="cheat_sheet"
 *   config={{ headingCount: 6, hasDiagrams: true }}
 * />
 */
export interface RevisionNotesLoadingSkeletonProps {
  /** Note type determines default skeleton structure */
  noteType: 'cheat_sheet' | 'lesson_note';

  /** Optional configuration overrides */
  config?: LoadingSkeletonConfig;

  /** CSS class names for styling */
  className?: string;
}

// ============================================================================
// Error Display Component
// ============================================================================

/**
 * Props for RevisionNotesErrorDisplay component
 *
 * Displays error messages with retry functionality
 *
 * @example
 * <RevisionNotesErrorDisplay
 *   error={error}
 *   retryState={retryState}
 *   onRetry={handleRetry}
 * />
 */
export interface RevisionNotesErrorDisplayProps {
  /** Error object from driver */
  error: RevisionNotesError;

  /** Current retry state */
  retryState: RetryState;

  /** Retry handler */
  onRetry: () => Promise<void>;

  /** CSS class names for styling */
  className?: string;
}

// ============================================================================
// Button Components
// ============================================================================

/**
 * Props for CourseCheatSheetButton component
 *
 * Button that opens course cheat sheet modal, disabled if not available
 *
 * @example
 * <CourseCheatSheetButton
 *   courseId="course_123"
 *   isAvailable={true}
 *   onClick={openModal}
 * />
 */
export interface CourseCheatSheetButtonProps {
  /** Course ID */
  courseId: string;

  /** Whether cheat sheet is available (null = checking, false = not available, true = available) */
  isAvailable: boolean | null;

  /** Click handler */
  onClick: () => void;

  /** CSS class names for styling */
  className?: string;

  /** Optional custom button label */
  label?: string;
}

/**
 * Props for LessonQuickNotesButton component
 *
 * Button that opens lesson quick notes modal, disabled if not available
 *
 * @example
 * <LessonQuickNotesButton
 *   courseId="course_123"
 *   lessonOrder={5}
 *   isAvailable={true}
 *   onClick={openModal}
 * />
 */
export interface LessonQuickNotesButtonProps {
  /** Course ID */
  courseId: string;

  /** Lesson order number */
  lessonOrder: number;

  /** Whether lesson notes are available */
  isAvailable: boolean | null;

  /** Click handler */
  onClick: () => void;

  /** CSS class names for styling */
  className?: string;

  /** Optional custom button label */
  label?: string;
}

/**
 * Props for LessonNotesToggleButton component
 *
 * Toggle button for opening/closing lesson notes side panel
 *
 * @example
 * <LessonNotesToggleButton
 *   isOpen={activeSidePanel === 'lesson_notes'}
 *   onClick={openLessonNotes}
 * />
 */
export interface LessonNotesToggleButtonProps {
  /** Panel open state */
  isOpen: boolean;

  /** Toggle handler */
  onClick: () => void;

  /** CSS class names for styling */
  className?: string;

  /** Optional icon component */
  icon?: ReactNode;
}

// ============================================================================
// Download Fallback Component
// ============================================================================

/**
 * Props for LargeFileDownloadFallback component
 *
 * Displayed when markdown file exceeds 5MB size threshold
 *
 * @example
 * <LargeFileDownloadFallback
 *   fileName="course_cheat_sheet.md"
 *   fileSize={6291456}
 *   downloadUrl="https://..."
 * />
 */
export interface LargeFileDownloadFallbackProps {
  /** File name for download */
  fileName: string;

  /** File size in bytes */
  fileSize: number;

  /** Download URL */
  downloadUrl: string;

  /** CSS class names for styling */
  className?: string;
}

// ============================================================================
// Shared Resize Handle Component
// ============================================================================

/**
 * Props for SidePanelResizeHandle component
 *
 * Draggable resize handle for side panels (shared between ContextChat and LessonNotes)
 *
 * @example
 * <SidePanelResizeHandle
 *   onResizeStart={startResize}
 *   onResize={handleResize}
 *   onResizeEnd={stopResize}
 *   minWidth={20}
 *   maxWidth={50}
 * />
 */
export interface SidePanelResizeHandleProps {
  /** Resize start handler */
  onResizeStart: () => void;

  /** Resize handler (called on mouse move) */
  onResize: (newWidth: number) => void;

  /** Resize end handler */
  onResizeEnd: () => void;

  /** Minimum width constraint (percentage) */
  minWidth: number;

  /** Maximum width constraint (percentage) */
  maxWidth: number;

  /** CSS class names for styling */
  className?: string;
}

// ============================================================================
// Availability Indicator Component
// ============================================================================

/**
 * Props for RevisionNotesAvailabilityBadge component
 *
 * Displays availability status for revision notes
 *
 * @example
 * <RevisionNotesAvailabilityBadge
 *   isAvailable={true}
 *   variant="cheat_sheet"
 * />
 */
export interface RevisionNotesAvailabilityBadgeProps {
  /** Availability status (null = checking) */
  isAvailable: boolean | null;

  /** Note type for contextual messaging */
  variant: 'cheat_sheet' | 'lesson_note';

  /** CSS class names for styling */
  className?: string;
}

// ============================================================================
// Component Export Map
// ============================================================================

/**
 * Map of component names to their expected file locations
 *
 * This serves as documentation for implementation planning
 */
export const COMPONENT_FILE_MAP = {
  // Core rendering
  MarkdownRenderer: 'components/revision-notes/MarkdownRenderer.tsx',

  // Modals
  CourseCheatSheetModal: 'components/revision-notes/CourseCheatSheetModal.tsx',
  LessonQuickNotesModal: 'components/revision-notes/LessonQuickNotesModal.tsx',

  // Side panel
  LessonNotesSidePanel: 'components/revision-notes/LessonNotesSidePanel.tsx',

  // Loading states
  RevisionNotesLoadingSkeleton: 'components/revision-notes/RevisionNotesLoadingSkeleton.tsx',

  // Error states
  RevisionNotesErrorDisplay: 'components/revision-notes/RevisionNotesErrorDisplay.tsx',

  // Buttons
  CourseCheatSheetButton: 'components/revision-notes/CourseCheatSheetButton.tsx',
  LessonQuickNotesButton: 'components/revision-notes/LessonQuickNotesButton.tsx',
  LessonNotesToggleButton: 'components/revision-notes/LessonNotesToggleButton.tsx',

  // Utilities
  LargeFileDownloadFallback: 'components/revision-notes/LargeFileDownloadFallback.tsx',
  SidePanelResizeHandle: 'components/revision-notes/SidePanelResizeHandle.tsx',
  RevisionNotesAvailabilityBadge: 'components/revision-notes/RevisionNotesAvailabilityBadge.tsx'
} as const;

/**
 * Expected directory structure for revision notes components
 */
export const DIRECTORY_STRUCTURE = `
assistant-ui-frontend/
├── components/
│   └── revision-notes/
│       ├── MarkdownRenderer.tsx
│       ├── CourseCheatSheetModal.tsx
│       ├── LessonQuickNotesModal.tsx
│       ├── LessonNotesSidePanel.tsx
│       ├── RevisionNotesLoadingSkeleton.tsx
│       ├── RevisionNotesErrorDisplay.tsx
│       ├── CourseCheatSheetButton.tsx
│       ├── LessonQuickNotesButton.tsx
│       ├── LessonNotesToggleButton.tsx
│       ├── LargeFileDownloadFallback.tsx
│       ├── SidePanelResizeHandle.tsx
│       └── RevisionNotesAvailabilityBadge.tsx
├── lib/
│   └── appwrite/
│       └── driver/
│           └── RevisionNotesDriver.ts
└── hooks/
    └── useRevisionNotes.ts (exports all hooks from contracts/RevisionNotesHooks.ts)
` as const;
