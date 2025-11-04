"use client";

import React, { useRef, useState, useImperativeHandle, forwardRef } from "react";
import { ReactSketchCanvas, type ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "./button";

/**
 * Ref interface exposed to parent components
 */
export interface DrawingCanvasRef {
  /**
   * Export the current canvas as a base64-encoded PNG string
   * @returns Promise resolving to base64 string (without data URI prefix)
   */
  exportToPngBase64: () => Promise<string>;

  /**
   * Check if the canvas is empty (no elements drawn)
   */
  isEmpty: () => boolean;

  /**
   * Clear all drawings from canvas
   */
  clearCanvas: () => void;

  /**
   * Undo last drawing action
   */
  undo: () => void;

  /**
   * Redo last undone action
   */
  redo: () => void;
}

/**
 * Props for DrawingCanvas component
 */
interface DrawingCanvasProps {
  /**
   * Canvas height in pixels
   * Default: 400px
   */
  height?: number;

  /**
   * Canvas width
   * Default: "100%"
   */
  width?: string;
}

/**
 * Drawing Canvas Component
 *
 * A simple drawing canvas using react-sketch-canvas with export functionality.
 * Designed for student diagram submissions in lesson cards.
 *
 * Features:
 * - Free-hand drawing
 * - Export to base64 PNG for backend submission
 * - Undo/Redo functionality
 * - Clear canvas
 * - Configurable stroke color and width
 */
export const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ height = 400, width = "100%" }, ref) => {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [strokeColor, setStrokeColor] = useState("#000000");
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      exportToPngBase64: async (): Promise<string> => {
        if (!canvasRef.current) {
          throw new Error("Canvas not ready");
        }

        try {
          console.log('🎨 Exporting canvas to PNG...');

          // Export canvas as data URL
          const dataUrl = await canvasRef.current.exportImage("png");

          // Remove "data:image/png;base64," prefix
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

          console.log(`✅ Base64 export complete: ${base64.length} characters`);
          return base64;
        } catch (error) {
          console.error('❌ Export to PNG failed:', error);
          throw error;
        }
      },

      isEmpty: (): boolean => {
        return !hasDrawn;
      },

      clearCanvas: () => {
        if (canvasRef.current) {
          canvasRef.current.clearCanvas();
          setHasDrawn(false);
        }
      },

      undo: () => {
        if (canvasRef.current) {
          canvasRef.current.undo();
        }
      },

      redo: () => {
        if (canvasRef.current) {
          canvasRef.current.redo();
        }
      }
    }));

    const handleStroke = () => {
      setHasDrawn(true);
    };

    return (
      <div className="flex flex-col gap-3">
        {/* Drawing Tools */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Color:</label>
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Width:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm text-gray-600 min-w-[2rem]">{strokeWidth}px</span>
          </div>

          <div className="flex-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => canvasRef.current?.undo()}
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => canvasRef.current?.redo()}
          >
            Redo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              canvasRef.current?.clearCanvas();
              setHasDrawn(false);
            }}
          >
            Clear
          </Button>
        </div>

        {/* Drawing Canvas */}
        <div
          style={{
            height: `${height}px`,
            width,
            border: "2px solid #e5e7eb",
            borderRadius: "8px",
            overflow: "hidden",
            backgroundColor: "#ffffff"
          }}
        >
          <ReactSketchCanvas
            ref={canvasRef}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            canvasColor="#ffffff"
            style={{
              border: "none",
            }}
            onStroke={handleStroke}
          />
        </div>
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";
