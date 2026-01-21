"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './button';
import { MathInput } from './math-input';
import { SimplifiedMathShortcuts, SimplifiedLevel } from './simplified-math-shortcuts';
import { DrawingModal } from './drawing-modal';
import { Math } from '@/lib/tiptap-math-extension';
import { Image } from '@/lib/tiptap-image-extension';
import katex from 'katex';

/**
 * Level-specific configuration for the editor
 */
interface LevelConfig {
  minHeight: number;
  maxImages: number;
  showHints: boolean;
  borderColorVar: string;
  bgColorVar: string;
}

/**
 * Configuration per SQA level
 * NAT3: Larger area, more guidance, fewer images allowed
 * NAT4: Standard sizing, moderate guidance
 */
const LEVEL_CONFIGS: Record<SimplifiedLevel, LevelConfig> = {
  n3: {
    minHeight: 180,
    maxImages: 3,
    showHints: true,
    borderColorVar: '--level-n3',
    bgColorVar: '--level-n3-bg',
  },
  n4: {
    minHeight: 150,
    maxImages: 4,
    showHints: true,
    borderColorVar: '--level-n4',
    bgColorVar: '--level-n4-bg',
  },
};

interface SimplifiedRichTextEditorProps {
  /** Current HTML content */
  value: string;
  /** Callback when content changes */
  onChange: (value: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** SQA level for styling and configuration */
  level: SimplifiedLevel;
  /** Optional question stem for drawing modal context */
  stem?: string;
  /** Whether to show math input functionality */
  allowMath?: boolean;
  /** Whether to show drawing functionality */
  allowDrawing?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SimplifiedRichTextEditor - Age-appropriate rich text entry for NAT3/NAT4
 *
 * A streamlined version of RichTextEditor designed for younger students with:
 * - Level-based color theming using design system tokens
 * - Reduced toolbar complexity
 * - Larger touch targets (48px minimum)
 * - Helpful hints and tips
 * - Optional math and drawing support
 *
 * @example
 * ```tsx
 * <SimplifiedRichTextEditor
 *   value={workingOut}
 *   onChange={setWorkingOut}
 *   level="n3"
 *   allowMath={true}
 *   allowDrawing={true}
 *   stem="Calculate 15 + 27"
 * />
 * ```
 */
export function SimplifiedRichTextEditor({
  value,
  onChange,
  placeholder = "Type your answer here...",
  level,
  stem,
  allowMath = true,
  allowDrawing = true,
  className = "",
}: SimplifiedRichTextEditorProps) {
  const [showMathInput, setShowMathInput] = useState(false);
  const [isMathfieldReady, setIsMathfieldReady] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [editingSceneData, setEditingSceneData] = useState<any>(null);
  const [imageCount, setImageCount] = useState(0);
  const mathfieldRef = useRef<any>(null);

  const config = LEVEL_CONFIGS[level];

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features for simpler toolbar
        blockquote: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Math,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none p-4`,
        style: `min-height: ${config.minHeight}px;`,
      },
    },
  });

  // Handle mathfield ready callback
  const handleMathfieldReady = (ref: React.RefObject<any>) => {
    mathfieldRef.current = ref.current;
    setIsMathfieldReady(true);
  };

  // Insert math formula into editor
  const handleMathInsert = (latex: string) => {
    if (!latex.trim() || !editor) return;

    try {
      const html = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });

      editor.chain().focus().insertMath(latex, html).insertContent(' ').run();

      setShowMathInput(false);
      setIsMathfieldReady(false);
    } catch (error) {
      if (error instanceof Error && error.message.includes('KaTeX')) {
        console.error('KaTeX render error:', error);
        alert('Invalid formula. Please check your input.');
      } else {
        console.error('Math insert error:', error);
      }
    }
  };

  // Cancel math input
  const handleMathCancel = () => {
    setShowMathInput(false);
    setIsMathfieldReady(false);
  };

  // Insert drawing into editor
  const handleDrawingInsert = (base64Image: string, sceneData?: any) => {
    if (!editor || !base64Image) return;

    try {
      if (editingSceneData) {
        editor.chain().focus().deleteSelection().run();
      }

      const dataUri = `data:image/png;base64,${base64Image}`;
      const sceneDataString = sceneData ? JSON.stringify(sceneData) : undefined;

      editor.chain()
        .focus()
        .setImage({
          src: dataUri,
          dataScene: sceneDataString,
        })
        .insertContent('<p></p>')
        .run();

      setEditingSceneData(null);
    } catch (error) {
      console.error('Failed to insert drawing:', error);
      alert('Failed to insert drawing. Please try again.');
    }
  };

  // Handle image click for editing
  const handleImageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const sceneDataAttr = img.getAttribute('data-scene');

      if (sceneDataAttr) {
        try {
          const sceneData = JSON.parse(sceneDataAttr);
          const pos = editor?.view.posAtDOM(img, 0);
          if (pos !== undefined && editor) {
            editor.commands.setNodeSelection(pos);
          }
          setEditingSceneData(sceneData);
          setShowDrawModal(true);
        } catch (error) {
          console.error('Failed to parse scene data:', error);
        }
      }
    }
  };

  // Attach click handler for image editing
  useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleImageClick);

    return () => {
      editorElement.removeEventListener('click', handleImageClick);
    };
  }, [editor]);

  // Track image count
  useEffect(() => {
    if (!editor) return;

    const html = editor.getHTML();
    const imgRegex = /<img[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]*>/g;
    const matches = Array.from(html.matchAll(imgRegex));
    setImageCount(matches.length);
  }, [editor?.state.doc, value]);

  if (!editor) {
    return (
      <div
        className="border rounded-lg bg-gray-50 animate-pulse"
        style={{ height: `${config.minHeight}px` }}
      />
    );
  }

  // Level-specific styles using CSS custom properties
  const borderColor = `var(${config.borderColorVar})`;
  const bgColor = `var(${config.bgColorVar})`;

  return (
    <>
      {/* CSS for selected image styling */}
      <style dangerouslySetInnerHTML={{__html: `
        .simplified-rich-text-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 3px solid ${borderColor};
          outline-offset: 2px;
          border-radius: 4px;
        }

        .simplified-rich-text-editor .ProseMirror img[data-scene] {
          cursor: pointer;
        }

        .simplified-rich-text-editor .ProseMirror img[data-scene]:hover {
          outline: 2px solid ${borderColor};
          outline-offset: 2px;
          border-radius: 4px;
        }
      `}} />

      <div
        className={`simplified-rich-text-editor border-2 rounded-lg overflow-hidden ${className}`}
        data-level={level}
        style={{ borderColor }}
      >
        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-1 p-2 border-b"
          style={{ backgroundColor: bgColor, borderColor }}
        >
          {/* Basic formatting */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`min-h-[44px] min-w-[44px] ${editor.isActive('bold') ? 'bg-primary/10 text-primary' : ''}`}
          >
            <strong>B</strong>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`min-h-[44px] ${editor.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}`}
          >
            • List
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Math button */}
          {allowMath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMathInput(!showMathInput)}
              className={`min-h-[44px] min-w-[80px] gap-1 ${showMathInput ? 'bg-primary/10 text-primary' : ''}`}
            >
              <span className="text-lg">Σ</span>
              <span>Math</span>
            </Button>
          )}

          {/* Draw button */}
          {allowDrawing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (imageCount >= config.maxImages) {
                  alert(`Maximum of ${config.maxImages} drawings allowed. Remove one to add another.`);
                  return;
                }
                setShowDrawModal(true);
              }}
              className="min-h-[44px] min-w-[80px] gap-1"
            >
              <span className="text-lg">✏️</span>
              <span>Draw</span>
            </Button>
          )}

          {/* Image count badge */}
          {imageCount > 0 && (
            <div className={`
              inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ml-auto
              ${imageCount >= config.maxImages ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-green-100 text-green-700 border border-green-300'}
            `}>
              <span>📎 {imageCount}/{config.maxImages}</span>
            </div>
          )}

          <div className="w-px h-6 bg-border mx-1" />

          {/* Clear button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().clearContent().run()}
            className="min-h-[44px]"
          >
            Clear
          </Button>
        </div>

        {/* Math Input Panel */}
        {showMathInput && allowMath && (
          <>
            {/* Simplified Math Shortcuts */}
            <div className="px-3 py-2 border-b" style={{ backgroundColor: bgColor, borderColor }}>
              <SimplifiedMathShortcuts
                mathfieldRef={mathfieldRef}
                disabled={!isMathfieldReady}
                level={level}
              />
            </div>

            {/* MathLive Editor */}
            <MathInput
              onInsert={handleMathInsert}
              onCancel={handleMathCancel}
              onMathfieldReady={handleMathfieldReady}
            />
          </>
        )}

        {/* Hint for younger students */}
        {config.showHints && !showMathInput && (
          <div className="px-3 py-2 text-xs text-muted-foreground" style={{ backgroundColor: bgColor }}>
            💡 <strong>Tip:</strong> Click <strong>Math</strong> to add fractions or equations •
            Click <strong>Draw</strong> to sketch diagrams
          </div>
        )}

        {/* Editor Content */}
        <EditorContent
          editor={editor}
          className="bg-white dark:bg-background"
        />

        {/* Drawing Modal */}
        {allowDrawing && (
          <DrawingModal
            open={showDrawModal}
            onClose={() => {
              setShowDrawModal(false);
              setEditingSceneData(null);
            }}
            onInsert={handleDrawingInsert}
            stem={stem}
            initialSceneData={editingSceneData}
          />
        )}
      </div>
    </>
  );
}
