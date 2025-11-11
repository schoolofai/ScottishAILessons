"use client";

import React from "react";

interface SidePanelResizeHandleProps {
  /** Callback when mouse down event occurs (start resize) */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Whether resizing is currently active */
  isResizing: boolean;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * SidePanelResizeHandle - Draggable handle for resizing side panels
 *
 * Displays a vertical bar that users can drag to resize the side panel.
 * Provides visual feedback during resize with color change and hover effects.
 *
 * Used by both ContextChatPanel and LessonNotesSidePanel.
 *
 * @example
 * <SidePanelResizeHandle
 *   onMouseDown={handleMouseDown}
 *   isResizing={isResizing}
 * />
 */
export function SidePanelResizeHandle({
  onMouseDown,
  isResizing,
  className = "",
}: SidePanelResizeHandleProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        absolute left-0 top-0 w-1 h-full cursor-col-resize z-10
        transition-colors duration-200
        ${isResizing ? "bg-blue-500" : "bg-gray-300 hover:bg-blue-500"}
        ${className}
      `}
      style={{ marginLeft: "-2px" }}
      data-testid="resize-handle"
      title="Drag to resize panel"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
    />
  );
}
