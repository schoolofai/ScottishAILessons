"use client";

import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./button";
import { ExcalidrawCanvas, type ExcalidrawCanvasRef } from "./excalidraw-canvas";

interface DrawingModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (base64Image: string) => void;
}

/**
 * Drawing Modal Component
 *
 * Shows an Excalidraw canvas in a modal dialog, allowing users to draw
 * diagrams that can be inserted into rich text content.
 *
 * Usage in RichTextEditor:
 * - Click "Draw" button → modal opens
 * - Draw on canvas
 * - Click "Insert Drawing" → exports to PNG, closes modal, inserts into editor
 */
export function DrawingModal({ open, onClose, onInsert }: DrawingModalProps) {
  const canvasRef = useRef<ExcalidrawCanvasRef>(null);
  const [isInserting, setIsInserting] = useState(false);

  const handleInsert = async () => {
    try {
      // Validate canvas not empty
      if (canvasRef.current?.isEmpty()) {
        alert("Please draw something before inserting.");
        return;
      }

      setIsInserting(true);

      // Export canvas to base64 PNG
      const base64 = await canvasRef.current?.exportToPngBase64();

      if (!base64) {
        throw new Error("Failed to export drawing");
      }

      console.log('📊 Drawing exported:', {
        base64Length: base64.length,
        estimatedSize: `${Math.round(base64.length / 1024)}KB`
      });

      // Call parent's insert handler with base64 image
      onInsert(base64);

      // Close modal
      onClose();
    } catch (error) {
      console.error('❌ Failed to insert drawing:', error);
      alert("Failed to insert drawing. Please try again.");
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[98vw] sm:!max-w-[98vw] w-[95vw] h-[95vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>Draw a Diagram</DialogTitle>
        </DialogHeader>

        {/* Canvas Area - Fills available space */}
        <div className="flex-1 min-h-0 p-4">
          <ExcalidrawCanvas
            ref={canvasRef}
            height={Math.max(500, Math.floor(window.innerHeight * 0.8))}
            width="100%"
          />
        </div>

        {/* Instructions */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
            <p><strong>💡 Tip:</strong> Use shapes (rectangle, ellipse, arrow) or freehand drawing (press P or 7). Use the toolbar to customize colors, line styles, and more. Click "Insert Drawing" when finished.</p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex gap-2 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isInserting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleInsert}
            disabled={isInserting}
          >
            {isInserting ? "Inserting..." : "Insert Drawing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
