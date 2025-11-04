"use client";

import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./dialog";
import { Button } from "./button";
import { ExcalidrawCanvas, type ExcalidrawCanvasRef } from "./excalidraw-canvas";
import { QuickAccessPanel } from "./quick-access-panel";
import ReactMarkdown from 'react-markdown';

interface DrawingModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (base64Image: string, sceneData?: any) => void;  // Now includes scene data for editing
  stem?: string; // Optional lesson question/stem to display
  initialSceneData?: any; // Optional scene data to restore previous drawing
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
export function DrawingModal({ open, onClose, onInsert, stem, initialSceneData }: DrawingModalProps) {
  const canvasRef = useRef<ExcalidrawCanvasRef>(null);
  const isMountedRef = useRef<boolean>(false); // Track component mount state
  const [isInserting, setIsInserting] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true); // Start open by default

  // Track component mount/unmount state
  useEffect(() => {
    isMountedRef.current = true;
    console.log('✅ DrawingModal mounted');

    return () => {
      isMountedRef.current = false;
      console.log('🔄 DrawingModal unmounting');
    };
  }, []);

  // Load initial scene data when modal opens with existing drawing
  useEffect(() => {
    if (!open) return;

    console.log('🚪 ═══════════════════════════════════════════════════');
    console.log('🚪 DRAWING MODAL OPENED');
    console.log('🚪 ═══════════════════════════════════════════════════');

    // CRITICAL FIX: Clear Excalidraw localStorage on modal open
    // This prevents zoom/scroll pollution from previous sessions
    if (typeof window !== 'undefined') {
      try {
        // Clear all Excalidraw-related localStorage keys
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('excalidraw')) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });

        if (keysToRemove.length > 0) {
          console.log(`🧹 Cleared ${keysToRemove.length} Excalidraw localStorage keys to prevent viewport pollution`);
          console.log('🧹 Removed keys:', keysToRemove);
        } else {
          console.log('🧹 No Excalidraw localStorage keys found to clear');
        }
      } catch (error) {
        console.warn('⚠️ Failed to clear Excalidraw localStorage:', error);
      }
    }

    if (initialSceneData) {
      console.log('🎨 MODAL - Rendering with initial scene data:', {
        hasInitialSceneData: !!initialSceneData,
        elements: initialSceneData?.elements?.length || 0,
        hasAppState: !!initialSceneData?.appState,
        hasFiles: !!initialSceneData?.files
      });

      // Log element positions in the scene data for debugging
      if (initialSceneData?.elements && initialSceneData.elements.length > 0) {
        console.log('🎯 MODAL - Scene data element positions (first 3):');
        initialSceneData.elements.slice(0, 3).forEach((el: any, idx: number) => {
          console.log(`  Element ${idx}: type=${el.type}, x=${el.x}, y=${el.y}, width=${el.width}, height=${el.height}`);
        });
      }

      console.log('✅ MODAL - Elements passed directly via initialElements prop (single-phase initialization)');
    } else {
      console.log('ℹ️ Modal opened without initial scene data (new drawing)');
    }

    console.log('🚪 ═══════════════════════════════════════════════════');

    // CRITICAL FIX: Force Excalidraw to refresh canvas position after modal layout completes
    // This fixes the 10px cursor offset bug for BOTH new drawings and editing existing ones
    // The offset can appear on subsequent modal opens even without scene data due to cached DOM layout
    const refreshTimer = setTimeout(() => {
      // Only refresh if component is still mounted - prevents React setState warning
      if (isMountedRef.current && canvasRef.current) {
        try {
          // Call our refreshCanvas method to recalculate canvas coordinates
          canvasRef.current.refreshCanvas();
          console.log('🔄 CRITICAL FIX: Forced canvas position refresh after modal layout');
        } catch (error) {
          console.warn('⚠️ Failed to refresh canvas position:', error);
        }
      } else if (!isMountedRef.current) {
        console.log('⏭️ Skipping refresh - component unmounted before timeout');
      }
    }, 250); // Increased delay to ensure Excalidraw completes internal initialization

    return () => clearTimeout(refreshTimer);
  }, [open, initialSceneData]);

  const handleQuickInsert = (itemId: string) => {
    console.log(`🚀 Quick insert requested: ${itemId}`);
    canvasRef.current?.insertLibraryItem(itemId);
  };

  // Stem renderer component - matches LessonCardPresentationTool formatting
  const StemRenderer = ({ stem, className }: { stem: string; className?: string }) => {
    // Handle both literal "\n" strings and actual newline characters
    // Convert them to double newlines for proper markdown paragraph breaks
    let processedStem = stem;

    // First, convert literal "\n" strings (escaped) to actual newlines
    processedStem = processedStem.replace(/\\n/g, '\n');

    // Then convert single newlines to double newlines for markdown paragraphs
    processedStem = processedStem.replace(/\n/g, '\n\n');

    return (
      <div className={`prose prose-sm max-w-none ${className || ''}`}>
        <ReactMarkdown
          components={{
            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
            strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
            em: ({ node, ...props }) => <em className="italic" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2" {...props} />,
            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          }}
        >
          {processedStem}
        </ReactMarkdown>
      </div>
    );
  };

  const handleInsert = async () => {
    try {
      // Validate canvas not empty
      if (canvasRef.current?.isEmpty()) {
        alert("Please draw something before inserting.");
        return;
      }

      setIsInserting(true);

      // Export canvas to base64 PNG (for display)
      const base64 = await canvasRef.current?.exportToPngBase64();

      if (!base64) {
        throw new Error("Failed to export drawing");
      }

      // Export scene data (for editing)
      const sceneData = canvasRef.current?.exportSceneData();

      console.log('📊 Drawing exported:', {
        base64Length: base64.length,
        estimatedSize: `${Math.round(base64.length / 1024)}KB`,
        sceneElements: sceneData?.elements?.length || 0
      });

      // Call parent's insert handler with both PNG and scene data
      onInsert(base64, sceneData);

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
      <DialogContent
        className="!max-w-[98vw] sm:!max-w-[98vw] w-[95vw] h-[95vh] p-0 gap-0 flex flex-col"
        onEscapeKeyDown={(e) => {
          e.preventDefault(); // Block Escape key from closing modal
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault(); // Block outside clicks from closing modal
        }}
        onInteractOutside={(e) => {
          e.preventDefault(); // Block all outside interactions
        }}
      >
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle>Draw a Diagram</DialogTitle>
        </DialogHeader>

        {/* Main Content Area - Two column layout if stem provided */}
        <div className="flex-1 min-h-0 flex">
          {/* Left Column - Lesson Stem/Question (if provided) */}
          {stem && (
            <div className="w-[30%] border-r border-gray-200 bg-gray-50 overflow-y-auto flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-sm font-semibold text-gray-800">📝 Question</h3>
              </div>
              <div className="flex-1 p-4">
                <StemRenderer stem={stem} />
              </div>
            </div>
          )}

          {/* Right Column - Canvas Area */}
          <div className={`${stem ? 'w-[70%]' : 'w-full'} flex flex-col`}>
            <div className="flex-1 min-h-0 relative overflow-visible">
              <ExcalidrawCanvas
                ref={canvasRef}
                height={Math.max(500, Math.floor(window.innerHeight * 0.8))}
                width="100%"
                initialElements={initialSceneData?.elements || []}
              />

              {/* Quick Access Panel - Inside canvas container */}
              <QuickAccessPanel
                onInsertItem={handleQuickInsert}
                isOpen={isPanelOpen}
                onToggle={() => setIsPanelOpen(!isPanelOpen)}
              />
            </div>

            {/* Instructions */}
            <div className="px-4 py-3 flex-shrink-0">
              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
                <p><strong>💡 Tip:</strong> Use shapes (rectangle, ellipse, arrow) or freehand drawing (press P or 7). Use the toolbar to customize colors, line styles, and more.</p>
              </div>
            </div>
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
