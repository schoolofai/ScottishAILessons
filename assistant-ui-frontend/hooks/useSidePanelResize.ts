import { useState, useEffect, useCallback } from "react";

interface UseSidePanelResizeOptions {
  /** Initial panel width as percentage (default: 33) */
  initialWidth?: number;
  /** Minimum panel width as percentage (default: 20) */
  minWidth?: number;
  /** Maximum panel width as percentage (default: 50) */
  maxWidth?: number;
}

interface UseSidePanelResizeReturn {
  /** Current panel width as percentage */
  panelWidth: number;
  /** Whether resizing is currently active */
  isResizing: boolean;
  /** Start resizing (call on mouse down) */
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Manually set panel width (constrained to min/max) */
  setPanelWidth: (width: number) => void;
}

/**
 * useSidePanelResize - Shared hook for resizable side panels
 *
 * Provides drag-to-resize functionality for side panels (ContextChat, LessonNotes).
 * Handles mouse events, width constraints, and cursor management.
 *
 * Based on existing resize logic from SessionChatAssistant.tsx (lines 284-320).
 *
 * @param options - Configuration for resize behavior
 * @returns Panel width, resize state, and event handlers
 *
 * @example
 * const { panelWidth, isResizing, handleMouseDown } = useSidePanelResize({
 *   initialWidth: 33,
 *   minWidth: 20,
 *   maxWidth: 50
 * });
 */
export function useSidePanelResize(
  options: UseSidePanelResizeOptions = {}
): UseSidePanelResizeReturn {
  const {
    initialWidth = 33,
    minWidth = 20,
    maxWidth = 50,
  } = options;

  const [panelWidth, setPanelWidthInternal] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Constrain width to min/max bounds
  const setPanelWidth = useCallback(
    (width: number) => {
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, width));
      setPanelWidthInternal(constrainedWidth);
    },
    [minWidth, maxWidth]
  );

  // Start resizing on mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Handle mouse move and mouse up events with requestAnimationFrame for >30 FPS
  useEffect(() => {
    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Throttle updates with requestAnimationFrame for smooth >30 FPS performance
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const windowWidth = window.innerWidth;
        const mouseX = e.clientX;
        const newWidth = ((windowWidth - mouseX) / windowWidth) * 100;

        // Constrain to min/max
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setPanelWidthInternal(constrainedWidth);
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isResizing, minWidth, maxWidth]);

  return {
    panelWidth,
    isResizing,
    handleMouseDown,
    setPanelWidth,
  };
}
