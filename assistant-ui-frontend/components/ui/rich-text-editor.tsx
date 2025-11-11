"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './button';
import { MathInput } from './math-input';
import { MathShortcuts } from './math-shortcuts';
import { DrawingModal } from './drawing-modal';
import { Math } from '@/lib/tiptap-math-extension';
import { Image } from '@/lib/tiptap-image-extension';
import katex from 'katex';

// Multi-image vision API limits
const IMAGE_LIMITS = {
  MAX_IMAGES: 5,
  MAX_TOTAL_SIZE_MB: 3,
  MAX_INDIVIDUAL_SIZE_KB: 800,
  WARN_TOTAL_SIZE_MB: 2,
} as const;

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  stem?: string; // Optional lesson question/stem to show in drawing modal
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter your answer...",
  className = "",
  stem
}: RichTextEditorProps) {
  const [showMathInput, setShowMathInput] = useState(false);
  const [isMathfieldReady, setIsMathfieldReady] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [editingSceneData, setEditingSceneData] = useState<any>(null);
  const [imageCount, setImageCount] = useState(0);
  const mathfieldRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
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
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4',
      },
    },
  });

  const handleMathfieldReady = (ref: React.RefObject<any>) => {
    mathfieldRef.current = ref.current;
    setIsMathfieldReady(true);
  };

  const handleMathInsert = (latex: string) => {
    if (!latex.trim() || !editor) return;

    try {
      // Render LaTeX using KaTeX
      const html = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });

      // Use the custom insertMath command
      editor.chain().focus().insertMath(latex, html).insertContent(' ').run();

      setShowMathInput(false);
      setIsMathfieldReady(false);
    } catch (error) {
      // Only alert if KaTeX rendering fails, not editor operations
      if (error instanceof Error && error.message.includes('KaTeX')) {
        console.error('KaTeX render error:', error);
        alert('Invalid LaTeX formula. Please check your syntax.');
      } else {
        // Log other errors but don't alert (they might be internal editor state transitions)
        console.error('Math insert error:', error);
      }
    }
  };

  const handleMathCancel = () => {
    setShowMathInput(false);
    setIsMathfieldReady(false);
  };

  const handleDrawingInsert = (base64Image: string, sceneData?: any) => {
    if (!editor || !base64Image) return;

    try {
      // If editing, delete the old image first
      if (editingSceneData) {
        editor.chain().focus().deleteSelection().run();
      }

      // Insert image with base64 data URI and scene data for editing
      const dataUri = `data:image/png;base64,${base64Image}`;

      const sceneDataString = sceneData ? JSON.stringify(sceneData) : undefined;

      // Log drawing insertion
      console.log('🎨 Drawing inserted in RichTextEditor:', {
        size: base64Image ? `${(base64Image.length / 1024).toFixed(1)}KB` : 'missing',
        hasSceneData: !!sceneData,
        elements: sceneData?.elements?.length || 0,
        mode: editingSceneData ? 'edit' : 'new'
      });

      editor.chain()
        .focus()
        .setImage({
          src: dataUri,
          dataScene: sceneDataString  // Store scene for editing
        })
        .insertContent('<p></p>') // Add paragraph after image for continued typing
        .run();

      // Verify the image was inserted with scene data
      setTimeout(() => {
        const images = editor.view.dom.querySelectorAll('img');
        const lastImage = images[images.length - 1];
        if (lastImage) {
          const storedSceneData = lastImage.getAttribute('data-scene');
          if (storedSceneData) {
            console.log('%c✅ Scene data verified in DOM', 'color: #10B981; font-weight: bold;', `${storedSceneData.length} chars`);
          } else {
            console.warn('%c⚠️ Scene data NOT found in DOM', 'color: #F59E0B; font-weight: bold;');
          }
        }
      }, 100);

      // Clear editing state
      setEditingSceneData(null);
    } catch (error) {
      console.error('❌ Failed to insert drawing into editor:', error);
      alert('Failed to insert drawing. Please try again.');
    }
  };

  const handleImageClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Check if clicked element is an image with scene data
    if (target.tagName === 'IMG') {
      const img = target as HTMLImageElement;
      const sceneDataAttr = img.getAttribute('data-scene');

      if (sceneDataAttr) {
        try {
          const sceneData = JSON.parse(sceneDataAttr);
          console.log('🖱️ Image clicked - opening for edit:', {
            elements: sceneData.elements?.length || 0
          });

          // Select the image node in editor
          const pos = editor?.view.posAtDOM(img, 0);
          if (pos !== undefined && editor) {
            editor.commands.setNodeSelection(pos);
          }

          // Open modal with scene data for editing
          setEditingSceneData(sceneData);
          setShowDrawModal(true);
        } catch (error) {
          console.error('Failed to parse scene data:', error);
        }
      }
    }
  };

  // Attach click handler to editor for image editing
  React.useEffect(() => {
    if (!editor) return;

    const editorElement = editor.view.dom;
    editorElement.addEventListener('click', handleImageClick);

    return () => {
      editorElement.removeEventListener('click', handleImageClick);
    };
  }, [editor]);

  // Track image count in real-time
  useEffect(() => {
    if (!editor) return;

    const html = editor.getHTML();
    const imgRegex = /<img[^>]*src="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]*>/g;
    const matches = Array.from(html.matchAll(imgRegex));
    setImageCount(matches.length);
  }, [editor?.state.doc, value]); // Re-run when editor content changes

  if (!editor) {
    return <div className="h-[150px] border rounded-lg bg-gray-50 animate-pulse" />;
  }

  return (
    <>
      {/* CSS for selected image styling and edit affordance */}
      <style dangerouslySetInnerHTML={{__html: `
        .rich-text-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 3px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
          cursor: pointer;
        }

        .rich-text-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          transition: all 0.2s ease;
        }

        /* Editable diagrams (with data-scene) get special hover effect */
        .rich-text-editor .ProseMirror img[data-scene] {
          cursor: pointer;
          position: relative;
        }

        .rich-text-editor .ProseMirror img[data-scene]:hover {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
          transform: scale(1.02);
        }

        /* Non-editable images have default cursor */
        .rich-text-editor .ProseMirror img:not([data-scene]) {
          cursor: default;
        }

        .rich-text-editor .ProseMirror img:not([data-scene]):hover {
          outline: 1px solid #e5e7eb;
          outline-offset: 2px;
          border-radius: 4px;
        }
      `}} />

      <div className={`rich-text-editor border border-input rounded-lg overflow-hidden ${className}`}>
        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'bg-primary/10 text-primary' : ''}
        >
          <strong>B</strong>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-primary/10 text-primary' : ''}
        >
          <em>I</em>
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-primary/10 text-primary' : ''}
        >
          • List
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-primary/10 text-primary' : ''}
        >
          1. List
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowMathInput(!showMathInput)}
          className={`${showMathInput ? 'bg-primary/10 text-primary' : ''} md:text-sm text-base md:min-w-0 min-w-[100px] md:px-3 px-4 md:py-2 py-3`}
        >
          <span className="text-lg md:text-base">Σ</span>
          <span className="ml-1">Formula</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            // Prevent adding more diagrams when at limit
            if (imageCount >= IMAGE_LIMITS.MAX_IMAGES) {
              alert(`You've reached the maximum of ${IMAGE_LIMITS.MAX_IMAGES} diagrams. Please remove one to add a new diagram.`);
              return;
            }
            setShowDrawModal(true);
          }}
          className="md:text-sm text-base md:min-w-0 min-w-[100px] md:px-3 px-4 md:py-2 py-3"
        >
          <span className="text-lg md:text-base">✏️</span>
          <span className="ml-1">Draw</span>
        </Button>

        {/* Image Count Badge - Real-time feedback */}
        {imageCount > 0 && (
          <div className={`
            inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
            ${imageCount > IMAGE_LIMITS.MAX_IMAGES ? 'bg-red-100 text-red-700 border border-red-300' :
              imageCount === IMAGE_LIMITS.MAX_IMAGES ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
              'bg-green-100 text-green-700 border border-green-300'}
          `}>
            <span className="text-sm">
              {imageCount > IMAGE_LIMITS.MAX_IMAGES ? '❌' :
               imageCount === IMAGE_LIMITS.MAX_IMAGES ? '⚠️' : '📎'}
            </span>
            <span className="font-semibold">{imageCount}</span>
            <span className="text-gray-500">/</span>
            <span>{IMAGE_LIMITS.MAX_IMAGES}</span>
            {imageCount === IMAGE_LIMITS.MAX_IMAGES && (
              <span className="ml-1 text-xs font-bold">
                (Max)
              </span>
            )}
            {imageCount > IMAGE_LIMITS.MAX_IMAGES && (
              <span className="ml-1 text-xs font-bold">
                (Remove {imageCount - IMAGE_LIMITS.MAX_IMAGES})
              </span>
            )}
          </div>
        )}

        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().clearContent().run()}
        >
          Clear
        </Button>
      </div>

      {/* Math Input Visual Editor */}
      {showMathInput && (
        <>
          {/* Math Shortcuts */}
          <div className="px-2 py-2 border-b border-border bg-muted/20">
            <MathShortcuts
              mathfieldRef={mathfieldRef}
              disabled={!isMathfieldReady}
            />
          </div>

          <MathInput
            onInsert={handleMathInsert}
            onCancel={handleMathCancel}
            onMathfieldReady={handleMathfieldReady}
          />
        </>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} className="bg-white dark:bg-background" />

      {/* Drawing Modal */}
      <DrawingModal
        open={showDrawModal}
        onClose={() => {
          setShowDrawModal(false);
          setEditingSceneData(null);  // Clear editing state on close
        }}
        onInsert={handleDrawingInsert}
        stem={stem}
        initialSceneData={editingSceneData}
      />
      </div>
    </>
  );
}
