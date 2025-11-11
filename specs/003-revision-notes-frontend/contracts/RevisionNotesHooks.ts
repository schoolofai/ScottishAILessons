/**
 * RevisionNotesHooks - React hooks for revision notes state management
 *
 * These hooks encapsulate the business logic for fetching, caching, and displaying
 * revision notes in modals and side panels.
 *
 * @see specs/003-revision-notes-frontend/data-model.md for entity definitions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { RevisionNotesDriver, RevisionNoteContent, RevisionNotesError } from './RevisionNotesDriver';

/**
 * Loading state for revision notes
 */
export type LoadingStatus = 'idle' | 'loading' | 'success' | 'error' | 'download_required';

/**
 * Retry state for exponential backoff hints
 */
export interface RetryState {
  retryCount: number;
  lastRetryTime: Date | null;
  showBackoffHint: boolean;
}

/**
 * Hook result for course cheat sheet modal
 */
export interface UseCourseCheatSheetResult {
  // Modal state
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Content state
  content: RevisionNoteContent | null;
  status: LoadingStatus;
  error: RevisionNotesError | null;

  // Retry state
  retryState: RetryState;
  handleRetry: () => Promise<void>;

  // Availability check
  isAvailable: boolean | null; // null = loading check, false = not available, true = available
}

/**
 * Hook for course cheat sheet modal state management
 *
 * Lifecycle:
 * 1. Check if cheat sheet exists on mount
 * 2. Fetch markdown content when modal opens
 * 3. Cache content while modal is open
 * 4. Clear cache when modal closes
 *
 * @param courseId - Course ID
 * @param driver - RevisionNotesDriver instance
 * @returns UseCourseCheatSheetResult
 */
export function useCourseCheatSheet(
  courseId: string,
  driver: RevisionNotesDriver
): UseCourseCheatSheetResult {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<RevisionNoteContent | null>(null);
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<RevisionNotesError | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false
  });

  // Check if cheat sheet exists on mount
  useEffect(() => {
    driver.courseCheatSheetExists(courseId)
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false)); // Assume not available on error
  }, [courseId]);

  // Fetch content when modal opens
  useEffect(() => {
    if (isOpen && !content && status === 'idle') {
      fetchCheatSheet();
    }

    // Clear cache when modal closes
    if (!isOpen && content) {
      setContent(null);
      setStatus('idle');
      setError(null);
      setRetryState({ retryCount: 0, lastRetryTime: null, showBackoffHint: false });
    }
  }, [isOpen]);

  const fetchCheatSheet = async () => {
    setStatus('loading');
    setError(null);

    try {
      const cheatSheet = await driver.getCourseCheatSheet(courseId);

      // Check if file size exceeds 5MB threshold
      if (cheatSheet.fileSize > 5 * 1024 * 1024) {
        setStatus('download_required');
        setContent(cheatSheet); // Still set content for metadata
      } else {
        setStatus('success');
        setContent(cheatSheet);
      }
    } catch (err) {
      const revisionError = err as RevisionNotesError;
      setError(revisionError);
      setStatus('error');
    }
  };

  const handleRetry = useCallback(async () => {
    const now = new Date();
    const timeSinceLastRetry = retryState.lastRetryTime
      ? now.getTime() - retryState.lastRetryTime.getTime()
      : Infinity;

    // Detect rapid retries (3+ within 30 seconds)
    if (retryState.retryCount >= 3 && timeSinceLastRetry < 30000) {
      setRetryState(prev => ({ ...prev, showBackoffHint: true }));
    } else {
      setRetryState(prev => ({ ...prev, showBackoffHint: false }));
    }

    setRetryState(prev => ({
      retryCount: prev.retryCount + 1,
      lastRetryTime: now,
      showBackoffHint: prev.showBackoffHint
    }));

    await fetchCheatSheet();
  }, [retryState, courseId]);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    openModal,
    closeModal,
    content,
    status,
    error,
    retryState,
    handleRetry,
    isAvailable
  };
}

/**
 * Hook result for lesson quick notes modal
 */
export interface UseLessonQuickNotesResult {
  // Modal state
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Content state
  content: RevisionNoteContent | null;
  status: LoadingStatus;
  error: RevisionNotesError | null;

  // Retry state
  retryState: RetryState;
  handleRetry: () => Promise<void>;

  // Availability check
  isAvailable: boolean | null;
}

/**
 * Hook for lesson quick notes modal state management
 *
 * Same lifecycle as course cheat sheet but for individual lessons
 *
 * @param courseId - Course ID
 * @param lessonOrder - Lesson order number
 * @param driver - RevisionNotesDriver instance
 * @returns UseLessonQuickNotesResult
 */
export function useLessonQuickNotes(
  courseId: string,
  lessonOrder: number,
  driver: RevisionNotesDriver
): UseLessonQuickNotesResult {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<RevisionNoteContent | null>(null);
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<RevisionNotesError | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false
  });

  // Check if lesson notes exist on mount
  useEffect(() => {
    driver.lessonNotesExist(courseId, lessonOrder)
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, [courseId, lessonOrder]);

  // Fetch content when modal opens
  useEffect(() => {
    if (isOpen && !content && status === 'idle') {
      fetchLessonNotes();
    }

    // Clear cache when modal closes
    if (!isOpen && content) {
      setContent(null);
      setStatus('idle');
      setError(null);
      setRetryState({ retryCount: 0, lastRetryTime: null, showBackoffHint: false });
    }
  }, [isOpen]);

  const fetchLessonNotes = async () => {
    setStatus('loading');
    setError(null);

    try {
      const lessonNotes = await driver.getLessonQuickNotes(courseId, lessonOrder);

      if (lessonNotes.fileSize > 5 * 1024 * 1024) {
        setStatus('download_required');
        setContent(lessonNotes);
      } else {
        setStatus('success');
        setContent(lessonNotes);
      }
    } catch (err) {
      const revisionError = err as RevisionNotesError;
      setError(revisionError);
      setStatus('error');
    }
  };

  const handleRetry = useCallback(async () => {
    const now = new Date();
    const timeSinceLastRetry = retryState.lastRetryTime
      ? now.getTime() - retryState.lastRetryTime.getTime()
      : Infinity;

    if (retryState.retryCount >= 3 && timeSinceLastRetry < 30000) {
      setRetryState(prev => ({ ...prev, showBackoffHint: true }));
    } else {
      setRetryState(prev => ({ ...prev, showBackoffHint: false }));
    }

    setRetryState(prev => ({
      retryCount: prev.retryCount + 1,
      lastRetryTime: now,
      showBackoffHint: prev.showBackoffHint
    }));

    await fetchLessonNotes();
  }, [retryState, courseId, lessonOrder]);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    openModal,
    closeModal,
    content,
    status,
    error,
    retryState,
    handleRetry,
    isAvailable
  };
}

/**
 * Active side panel type (ContextChat vs LessonNotes)
 */
export enum ActiveSidePanel {
  None = 'none',
  ContextChat = 'context_chat',
  LessonNotes = 'lesson_notes'
}

/**
 * Hook result for lesson notes side panel (in SessionChatAssistant)
 */
export interface UseLessonNotesSidePanelResult {
  // Panel state
  activeSidePanel: ActiveSidePanel;
  openLessonNotes: () => void;
  openContextChat: () => void;
  closePanel: () => void;

  // Resize state
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  isResizing: boolean;
  startResize: () => void;
  stopResize: () => void;

  // Content state (session-scoped cache)
  content: string | null;
  status: LoadingStatus;
  error: RevisionNotesError | null;

  // Retry state
  retryState: RetryState;
  handleRetry: () => Promise<void>;
}

/**
 * Hook for lesson notes side panel state management in SessionChatAssistant
 *
 * Lifecycle:
 * 1. Fetch lesson notes on first panel open OR session start
 * 2. Cache content for entire lesson session duration
 * 3. Cache persists across panel toggles (not cleared on close)
 * 4. Cache cleared when session ends (component unmount)
 *
 * Mutual exclusivity:
 * - Opening LessonNotes auto-collapses ContextChat
 * - Opening ContextChat auto-collapses LessonNotes
 *
 * @param sessionId - Lesson session ID
 * @param courseId - Course ID
 * @param lessonOrder - Lesson order number
 * @param driver - RevisionNotesDriver instance
 * @returns UseLessonNotesSidePanelResult
 */
export function useLessonNotesSidePanel(
  sessionId: string,
  courseId: string,
  lessonOrder: number,
  driver: RevisionNotesDriver
): UseLessonNotesSidePanelResult {
  const [activeSidePanel, setActiveSidePanel] = useState<ActiveSidePanel>(ActiveSidePanel.None);
  const [panelWidth, setPanelWidth] = useState(33); // 33% default width
  const [isResizing, setIsResizing] = useState(false);
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<RevisionNotesError | null>(null);

  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false
  });

  // Session-scoped cache (persists across panel toggles)
  const contentCacheRef = useRef<string | null>(null);

  // Fetch lesson notes on first panel open
  useEffect(() => {
    if (activeSidePanel === ActiveSidePanel.LessonNotes && !contentCacheRef.current && status === 'idle') {
      fetchLessonNotes();
    }
  }, [activeSidePanel]);

  // Clear cache when session ends (component unmount)
  useEffect(() => {
    return () => {
      contentCacheRef.current = null;
    };
  }, [sessionId]);

  const fetchLessonNotes = async () => {
    setStatus('loading');
    setError(null);

    try {
      const lessonNotes = await driver.getLessonQuickNotes(courseId, lessonOrder);
      contentCacheRef.current = lessonNotes.markdownContent;
      setStatus('success');
    } catch (err) {
      const revisionError = err as RevisionNotesError;
      setError(revisionError);
      setStatus('error');
    }
  };

  const handleRetry = useCallback(async () => {
    const now = new Date();
    const timeSinceLastRetry = retryState.lastRetryTime
      ? now.getTime() - retryState.lastRetryTime.getTime()
      : Infinity;

    if (retryState.retryCount >= 3 && timeSinceLastRetry < 30000) {
      setRetryState(prev => ({ ...prev, showBackoffHint: true }));
    } else {
      setRetryState(prev => ({ ...prev, showBackoffHint: false }));
    }

    setRetryState(prev => ({
      retryCount: prev.retryCount + 1,
      lastRetryTime: now,
      showBackoffHint: prev.showBackoffHint
    }));

    await fetchLessonNotes();
  }, [retryState]);

  const openLessonNotes = useCallback(() => {
    setActiveSidePanel(ActiveSidePanel.LessonNotes);
  }, []);

  const openContextChat = useCallback(() => {
    setActiveSidePanel(ActiveSidePanel.ContextChat);
  }, []);

  const closePanel = useCallback(() => {
    setActiveSidePanel(ActiveSidePanel.None);
    // NOTE: Cache NOT cleared here - persists for session duration
  }, []);

  const constrainedSetPanelWidth = useCallback((width: number) => {
    const constrained = Math.max(20, Math.min(50, width));
    setPanelWidth(constrained);
  }, []);

  const startResize = useCallback(() => setIsResizing(true), []);
  const stopResize = useCallback(() => setIsResizing(false), []);

  return {
    activeSidePanel,
    openLessonNotes,
    openContextChat,
    closePanel,
    panelWidth,
    setPanelWidth: constrainedSetPanelWidth,
    isResizing,
    startResize,
    stopResize,
    content: contentCacheRef.current,
    status,
    error,
    retryState,
    handleRetry
  };
}
