"use client";

/**
 * StructuredResponseEditor - Rich text editor with drawing support
 *
 * For longer form responses that may include diagrams and formatted text.
 * The RichTextEditor component has built-in drawing toolbar functionality.
 */

import React from "react";
import { FileText } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

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
}: StructuredResponseEditorProps) {
  return (
    <div className="space-y-4">
      {/* Rich Text Editor with built-in drawing toolbar */}
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
    </div>
  );
}

export default StructuredResponseEditor;
