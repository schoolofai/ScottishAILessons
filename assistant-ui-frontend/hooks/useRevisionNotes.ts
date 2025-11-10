/**
 * useRevisionNotes - React hooks for revision notes state management
 *
 * This file exports all revision notes hooks in one place for easy importing.
 *
 * Usage:
 * ```tsx
 * import { useCourseCheatSheet, useLessonQuickNotes, useLessonNotesSidePanel } from '@/hooks/useRevisionNotes';
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { RevisionNotesDriver, RevisionNoteContent, RevisionNotesError } from '@/lib/appwrite/driver/RevisionNotesDriver';

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
  isRetrying: boolean;
}

/**
 * Hook result for course cheat sheet modal
 */
export interface UseCourseCheatSheetResult {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  content: RevisionNoteContent | null;
  status: LoadingStatus;
  error: RevisionNotesError | null;
  retryState: RetryState;
  handleRetry: () => Promise<void>;
  isAvailable: boolean | null;
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
 * @param courseId - Course identifier
 * @param driver - RevisionNotesDriver instance
 * @param externalIsOpen - Optional external modal state (for controlled components)
 */
export function useCourseCheatSheet(
  courseId: string,
  driver: RevisionNotesDriver,
  externalIsOpen?: boolean
): UseCourseCheatSheetResult {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [content, setContent] = useState<RevisionNoteContent | null>(null);
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<RevisionNotesError | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false,
    isRetrying: false
  });

  // Use external isOpen if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Check if cheat sheet exists on mount
  useEffect(() => {
    driver.courseCheatSheetExists(courseId)
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, [courseId, driver]);

  const fetchCheatSheet = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const cheatSheet = await driver.getCourseCheatSheet(courseId);

      if (cheatSheet.fileSize > 5 * 1024 * 1024) {
        setStatus('download_required');
        setContent(cheatSheet);
      } else {
        setStatus('success');
        setContent(cheatSheet);
      }
    } catch (err) {
      const revisionError = err as RevisionNotesError;
      setError(revisionError);
      setStatus('error');
    }
  }, [courseId, driver]);

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
      setRetryState({ retryCount: 0, lastRetryTime: null, showBackoffHint: false, isRetrying: false });
    }
  }, [isOpen, content, status, fetchCheatSheet]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);

    const now = new Date();
    const timeSinceLastRetry = retryState.lastRetryTime
      ? now.getTime() - retryState.lastRetryTime.getTime()
      : Infinity;

    // Detect rapid retries (3+ within 30 seconds)
    const showBackoffHint = retryState.retryCount >= 3 && timeSinceLastRetry < 30000;

    setRetryState({
      retryCount: retryState.retryCount + 1,
      lastRetryTime: now,
      showBackoffHint,
      isRetrying: true
    });

    await fetchCheatSheet();
    setIsRetrying(false);

    setRetryState(prev => ({
      ...prev,
      isRetrying: false
    }));
  }, [retryState, fetchCheatSheet]);

  const openModal = useCallback(() => setInternalIsOpen(true), []);
  const closeModal = useCallback(() => setInternalIsOpen(false), []);

  return {
    isOpen,
    openModal,
    closeModal,
    content,
    status,
    error,
    retryState: {
      ...retryState,
      isRetrying
    },
    handleRetry,
    isAvailable
  };
}

/**
 * Hook result for lesson quick notes modal
 */
export interface UseLessonQuickNotesResult {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  content: RevisionNoteContent | null;
  status: LoadingStatus;
  error: RevisionNotesError | null;
  retryState: RetryState;
  handleRetry: () => Promise<void>;
  isAvailable: boolean | null;
}

/**
 * Hook for lesson quick notes modal state management
 *
 * @param courseId - Course identifier
 * @param lessonOrder - Lesson order number
 * @param driver - RevisionNotesDriver instance
 * @param externalIsOpen - Optional external modal state (for controlled components)
 */
export function useLessonQuickNotes(
  courseId: string,
  lessonOrder: number,
  driver: RevisionNotesDriver,
  externalIsOpen?: boolean
): UseLessonQuickNotesResult {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [content, setContent] = useState<RevisionNoteContent | null>(null);
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<RevisionNotesError | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false,
    isRetrying: false
  });

  // Use external isOpen if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Check if lesson notes exist on mount
  useEffect(() => {
    driver.lessonNotesExist(courseId, lessonOrder)
      .then(setIsAvailable)
      .catch(() => setIsAvailable(false));
  }, [courseId, lessonOrder, driver]);

  const fetchLessonNotes = useCallback(async () => {
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
  }, [courseId, lessonOrder, driver]);

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
      setRetryState({ retryCount: 0, lastRetryTime: null, showBackoffHint: false, isRetrying: false });
    }
  }, [isOpen, content, status, fetchLessonNotes]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);

    const now = new Date();
    const timeSinceLastRetry = retryState.lastRetryTime
      ? now.getTime() - retryState.lastRetryTime.getTime()
      : Infinity;

    const showBackoffHint = retryState.retryCount >= 3 && timeSinceLastRetry < 30000;

    setRetryState({
      retryCount: retryState.retryCount + 1,
      lastRetryTime: now,
      showBackoffHint,
      isRetrying: true
    });

    await fetchLessonNotes();
    setIsRetrying(false);

    setRetryState(prev => ({
      ...prev,
      isRetrying: false
    }));
  }, [retryState, fetchLessonNotes]);

  const openModal = useCallback(() => setInternalIsOpen(true), []);
  const closeModal = useCallback(() => setInternalIsOpen(false), []);

  return {
    isOpen,
    openModal,
    closeModal,
    content,
    status,
    error,
    retryState: {
      ...retryState,
      isRetrying
    },
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
 * Hook result for lesson notes side panel
 */
export interface UseLessonNotesSidePanelResult {
  activeSidePanel: ActiveSidePanel;
  openLessonNotes: () => void;
  openContextChat: () => void;
  closePanel: () => void;
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  isResizing: boolean;
  startResize: () => void;
  stopResize: () => void;
  content: string | null;
  status: LoadingStatus;
  error: RevisionNotesError | null;
  retryState: RetryState;
  handleRetry: () => Promise<void>;
}

/**
 * Hook for lesson notes side panel state management in SessionChatAssistant
 *
 * Lifecycle:
 * 1. Fetch lesson notes on first panel open
 * 2. Cache content for entire lesson session
 * 3. Cache persists across panel toggles
 * 4. Cache cleared when session ends
 */
export function useLessonNotesSidePanel(
  sessionId: string,
  courseId: string,
  lessonOrder: number,
  driver: RevisionNotesDriver
): UseLessonNotesSidePanelResult {
  const [activeSidePanel, setActiveSidePanel] = useState<ActiveSidePanel>(ActiveSidePanel.None);
  const [panelWidth, setPanelWidth] = useState(33);
  const [isResizing, setIsResizing] = useState(false);
  const [status, setStatus] = useState<LoadingStatus>('idle');
  const [error, setError] = useState<RevisionNotesError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [retryState, setRetryState] = useState<RetryState>({
    retryCount: 0,
    lastRetryTime: null,
    showBackoffHint: false,
    isRetrying: false
  });

  // Session-scoped cache (persists across panel toggles)
  const contentCacheRef = useRef<string | null>(null);

  const fetchLessonNotes = useCallback(async () => {
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
  }, [courseId, lessonOrder, driver]);

  // Fetch lesson notes on first panel open
  useEffect(() => {
    if (activeSidePanel === ActiveSidePanel.LessonNotes && !contentCacheRef.current && status === 'idle') {
      fetchLessonNotes();
    }
  }, [activeSidePanel, status, fetchLessonNotes]);

  // Clear cache when session ends
  useEffect(() => {
    return () => {
      contentCacheRef.current = null;
    };
  }, [sessionId]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);

    const now = new Date();
    const timeSinceLastRetry = retryState.lastRetryTime
      ? now.getTime() - retryState.lastRetryTime.getTime()
      : Infinity;

    const showBackoffHint = retryState.retryCount >= 3 && timeSinceLastRetry < 30000;

    setRetryState({
      retryCount: retryState.retryCount + 1,
      lastRetryTime: now,
      showBackoffHint,
      isRetrying: true
    });

    await fetchLessonNotes();
    setIsRetrying(false);

    setRetryState(prev => ({
      ...prev,
      isRetrying: false
    }));
  }, [retryState, fetchLessonNotes]);

  const openLessonNotes = useCallback(() => {
    setActiveSidePanel(ActiveSidePanel.LessonNotes);
  }, []);

  const openContextChat = useCallback(() => {
    setActiveSidePanel(ActiveSidePanel.ContextChat);
  }, []);

  const closePanel = useCallback(() => {
    setActiveSidePanel(ActiveSidePanel.None);
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
    retryState: {
      ...retryState,
      isRetrying
    },
    handleRetry
  };
}
