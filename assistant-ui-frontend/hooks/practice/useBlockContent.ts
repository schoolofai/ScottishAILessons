"use client";

/**
 * useBlockContent - Hook for managing block content state during practice
 *
 * Provides caching, loading states, and prefetching for block explanatory content
 * displayed in the BlockReferencePanel during V2 practice mode.
 *
 * Features:
 * - In-memory cache persists during session (no re-fetching)
 * - Automatic prefetching of upcoming blocks
 * - Loading/error state management
 * - Fast-fail on errors (no silent fallbacks)
 */

import { useState, useRef, useMemo, useCallback } from "react";
import { PracticeQuestionDriver, type PracticeBlock } from "@/lib/appwrite/driver/PracticeQuestionDriver";
import type { ParsedBlockContent } from "@/types/practice-wizard-contracts";

export interface UseBlockContentReturn {
  /** Current block content (null if loading or not set) */
  currentContent: ParsedBlockContent | null;

  /** Upcoming blocks content (prefetched) */
  upcomingContent: ParsedBlockContent[];

  /** Whether current block is loading */
  isLoading: boolean;

  /** Error if loading failed */
  error: Error | null;

  /** Set the current block and load its content */
  setCurrentBlock: (lessonTemplateId: string, blockId: string) => Promise<void>;

  /** Prefetch upcoming blocks in background (best-effort) */
  prefetchUpcoming: (lessonTemplateId: string, blockIds: string[]) => void;

  /** Clear all cached content (for session reset) */
  clearCache: () => void;

  // ═══════════════════════════════════════════════════════════════════════════
  // Navigation State (Phase 6)
  // ═══════════════════════════════════════════════════════════════════════════

  /** All blocks for the current lesson (lightweight metadata for navigation) */
  allBlocks: PracticeBlock[];

  /** Current viewing index in allBlocks array */
  viewingIndex: number;

  /** Set the viewing index directly (used when syncing with current question) */
  setViewingIndex: (index: number) => void;

  /** Load all blocks for a lesson (lightweight, no content loading) */
  loadAllBlocks: (lessonTemplateId: string) => Promise<PracticeBlock[]>;

  /** Navigate to a specific block by index and load its content */
  navigateToBlock: (lessonTemplateId: string, index: number) => Promise<void>;

  /** Whether user can navigate to previous block */
  canGoBack: boolean;

  /** Whether user can navigate to next block */
  canGoForward: boolean;
}

/**
 * Hook for managing block content state during practice sessions.
 *
 * @param sessionToken - Optional Appwrite session token for authenticated requests
 * @returns Block content state and actions
 */
export function useBlockContent(sessionToken?: string): UseBlockContentReturn {
  // Cache persists across re-renders during session
  const cacheRef = useRef<Map<string, ParsedBlockContent>>(new Map());

  // Track current block ID to avoid duplicate loads
  const currentBlockIdRef = useRef<string | null>(null);

  // Track loading state in ref for stable callback (avoids dependency on isLoading state)
  const isLoadingRef = useRef(false);

  // Track blocks we've already attempted to load (prevents retry loops on error)
  const attemptedBlocksRef = useRef<Set<string>>(new Set());

  // State for current content and loading
  const [currentContent, setCurrentContent] = useState<ParsedBlockContent | null>(null);
  const [upcomingContent, setUpcomingContent] = useState<ParsedBlockContent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Navigation state (Phase 6)
  const [allBlocks, setAllBlocks] = useState<PracticeBlock[]>([]);
  const [viewingIndex, setViewingIndex] = useState(0);

  // Memoize driver instance to avoid recreation
  const driver = useMemo(
    () => new PracticeQuestionDriver(sessionToken),
    [sessionToken]
  );

  /**
   * Set the current block and load its content.
   * Uses cache if available, otherwise fetches from storage.
   *
   * NOTE: Uses isLoadingRef instead of isLoading state in the check to keep
   * callback reference stable. This prevents infinite loops when the callback
   * is in a useEffect dependency array.
   */
  const setCurrentBlock = useCallback(
    async (lessonTemplateId: string, blockId: string): Promise<void> => {
      // Skip if already loading this block (use ref for stable callback)
      if (currentBlockIdRef.current === blockId && isLoadingRef.current) {
        return;
      }

      // Check cache first - BEFORE attempted check so we can return cached content
      const cached = cacheRef.current.get(blockId);
      if (cached) {
        currentBlockIdRef.current = blockId;
        setCurrentContent(cached);
        setError(null);
        return;
      }

      // Skip if we've already attempted this block and it failed (prevents retry loops on error)
      // NOTE: This check is AFTER cache check so we can still return cached content
      if (attemptedBlocksRef.current.has(blockId)) {
        return;
      }

      // Mark as attempted before loading
      attemptedBlocksRef.current.add(blockId);

      // Not in cache - fetch from storage
      currentBlockIdRef.current = blockId;
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const content = await driver.getBlockContent(lessonTemplateId, blockId);

        // Store in cache
        cacheRef.current.set(blockId, content);
        setCurrentContent(content);
      } catch (e) {
        // Fast-fail: surface error to UI, don't silently fall back
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[useBlockContent] Failed to load block content:", err);
        setError(err);
        // Clear current content on error to show error state in UI
        setCurrentContent(null);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [driver] // Removed isLoading from deps - using ref instead for stable callback
  );

  /**
   * Prefetch upcoming blocks in background.
   * Best-effort: errors are logged but don't affect UI.
   */
  const prefetchUpcoming = useCallback(
    (lessonTemplateId: string, blockIds: string[]): void => {
      // Filter out already cached blocks
      const toLoad = blockIds.filter((id) => !cacheRef.current.has(id));

      if (toLoad.length === 0) {
        // Update upcomingContent from cache
        const upcoming = blockIds
          .map((id) => cacheRef.current.get(id))
          .filter((c): c is ParsedBlockContent => c !== undefined);
        setUpcomingContent(upcoming);
        return;
      }

      // Fire-and-forget - don't block UI
      driver
        .getBlockContentBatch(lessonTemplateId, toLoad)
        .then((results) => {
          // Store in cache
          for (const [id, content] of results) {
            cacheRef.current.set(id, content);
          }

          // Update upcomingContent state from cache
          const upcoming = blockIds
            .map((id) => cacheRef.current.get(id))
            .filter((c): c is ParsedBlockContent => c !== undefined);
          setUpcomingContent(upcoming);
        })
        .catch((e) => {
          // Best-effort - log but don't throw
          console.warn("[useBlockContent] Prefetch failed:", e);
        });
    },
    [driver]
  );

  /**
   * Clear all cached content.
   * Used when starting a new session or switching lessons.
   */
  const clearCache = useCallback((): void => {
    cacheRef.current.clear();
    attemptedBlocksRef.current.clear();
    currentBlockIdRef.current = null;
    isLoadingRef.current = false;
    setCurrentContent(null);
    setUpcomingContent([]);
    setError(null);
    setAllBlocks([]);
    setViewingIndex(0);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Navigation Methods (Phase 6)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load all blocks for a lesson (lightweight metadata only).
   * This fetches block list from Appwrite without loading the full content.
   * Used for navigation arrows in the reference panel.
   */
  const loadAllBlocks = useCallback(
    async (lessonTemplateId: string): Promise<PracticeBlock[]> => {
      try {
        const blocks = await driver.getBlocksForLesson(lessonTemplateId);
        setAllBlocks(blocks);
        return blocks;
      } catch (e) {
        // Fast-fail: surface error, don't silently fallback
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[useBlockContent] Failed to load blocks list:", err);
        throw err;
      }
    },
    [driver]
  );

  /**
   * Navigate to a specific block by index.
   * Updates viewing index and loads the block content.
   *
   * @throws Error if index is out of bounds (fast-fail, no fallback)
   */
  const navigateToBlock = useCallback(
    async (lessonTemplateId: string, index: number): Promise<void> => {
      if (index < 0 || index >= allBlocks.length) {
        throw new Error(`Invalid block index: ${index}. Valid range: 0-${allBlocks.length - 1}`);
      }

      setViewingIndex(index);
      const blockId = allBlocks[index].blockId;
      await setCurrentBlock(lessonTemplateId, blockId);
    },
    [allBlocks, setCurrentBlock]
  );

  // Navigation helpers
  const canGoBack = viewingIndex > 0;
  const canGoForward = viewingIndex < allBlocks.length - 1;

  return {
    currentContent,
    upcomingContent,
    isLoading,
    error,
    setCurrentBlock,
    prefetchUpcoming,
    clearCache,
    // Navigation (Phase 6)
    allBlocks,
    viewingIndex,
    setViewingIndex,
    loadAllBlocks,
    navigateToBlock,
    canGoBack,
    canGoForward,
  };
}

export default useBlockContent;
