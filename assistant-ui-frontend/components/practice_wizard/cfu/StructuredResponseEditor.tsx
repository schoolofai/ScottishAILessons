"use client";

/**
 * StructuredResponseEditor - Rich text editor with drawing support
 *
 * For longer form responses that may include diagrams and formatted text.
 * Uses the RichTextEditor and DrawingModal components for feature parity.
 */

import React, { useState, useCallback } from "react";
import { PenTool, FileText, Trash2 } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { DrawingModal } from "@/components/ui/drawing-modal";
import { Button } from "@/components/ui/button";

interface StructuredResponseEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Callback when drawing is saved - bubbles up for submission */
  onDrawingSave?: (dataUrl: string, sceneData?: unknown) => void;
}

export function StructuredResponseEditor({
  value,
  onChange,
  disabled = false,
  onDrawingSave,
}: StructuredResponseEditorProps) {
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);
  const [drawingSceneData, setDrawingSceneData] = useState<unknown | null>(null);

  const handleDrawingSave = useCallback(
    (dataUrl: string, sceneData?: unknown) => {
      setDrawingDataUrl(dataUrl);
      if (sceneData) {
        setDrawingSceneData(sceneData);
      }
      setShowDrawingModal(false);
      // Bubble up to parent for submission
      onDrawingSave?.(dataUrl, sceneData);
    },
    [onDrawingSave]
  );

  const handleClearDrawing = useCallback(() => {
    setDrawingDataUrl(null);
    setDrawingSceneData(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Rich Text Editor */}
      <div className="wizard-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Your Answer</span>
        </div>
        <div className="p-4">
          <RichTextEditor
            value={value}
            onChange={onChange}
            placeholder="Write your detailed answer here..."
            disabled={disabled}
            className="min-h-[200px]"
          />
        </div>
      </div>

      {/* Drawing Section */}
      <div className="wizard-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center">
              <PenTool className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium text-gray-700">Drawing (Optional)</span>
          </div>

          {drawingDataUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDrawing}
              disabled={disabled}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Drawing preview or add button */}
        {drawingDataUrl ? (
          <div
            className="relative rounded-xl overflow-hidden border-2 border-purple-200 bg-white cursor-pointer group"
            onClick={() => !disabled && setShowDrawingModal(true)}
          >
            <img
              src={drawingDataUrl}
              alt="Your drawing"
              className="w-full max-h-[300px] object-contain"
            />
            <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="bg-purple-500 text-white px-4 py-2 rounded-full font-medium shadow-lg">
                Edit Drawing
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDrawingModal(true)}
            disabled={disabled}
            className={`
              w-full py-8 rounded-xl border-2 border-dashed border-purple-200
              bg-purple-50/50 hover:bg-purple-100/50 hover:border-purple-300
              transition-all duration-200 flex flex-col items-center gap-2
              ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <PenTool className="w-8 h-8 text-purple-400" />
            <span className="text-purple-600 font-medium">Add a drawing</span>
            <span className="text-xs text-purple-400">
              Use diagrams to support your answer
            </span>
          </button>
        )}
      </div>

      {/* Drawing Modal */}
      <DrawingModal
        open={showDrawingModal}
        onOpenChange={setShowDrawingModal}
        onSave={handleDrawingSave}
        initialData={drawingSceneData}
      />
    </div>
  );
}

export default StructuredResponseEditor;
